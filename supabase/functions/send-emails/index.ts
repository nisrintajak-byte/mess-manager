/**
 * send-emails — background worker called every few minutes by the database scheduler.
 *  1. removes private files queued by the retention/deletion jobs (Storage API)
 *  2. sends queued emails (Resend) with PDF + CSV statements in the member's language
 * Protected by a shared secret kept in the database vault (header x-worker-secret).
 * Settings (Edge Function secrets): RESEND_API_KEY, EMAIL_FROM, DELETE_PAGE_URL.
 */
import { createClient } from '@supabase/supabase-js';

import { compose, type QueuedEmail } from './emails.ts';
import { buildReportPdf, fetchFonts, type FontBytes } from './pdf.ts';
import { serverFormat } from './emails.ts';
import type { ReportData } from './report.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Mess Manager <onboarding@resend.dev>';
const DELETE_PAGE_URL =
  Deno.env.get('DELETE_PAGE_URL') ?? 'https://nisrintajak-byte.github.io/mess-manager/delete-account/';

let fonts: FontBytes | null = null;

function toBase64(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function purgeFiles(): Promise<number> {
  const { data: paths, error } = await db.rpc('storage_purge_claim', { p_limit: 100 });
  if (error || !paths?.length) return 0;
  const { error: rmError } = await db.storage.from('room-files').remove(paths as string[]);
  if (rmError) return 0;
  await db.rpc('storage_purge_done', { p_paths: paths });
  return (paths as string[]).length;
}

async function sendEmails(): Promise<{ sent: number; failed: number } | 'not_configured'> {
  if (!RESEND_API_KEY) return 'not_configured';
  const { data: batch, error } = await db.rpc('email_claim', { p_limit: 10 });
  if (error) throw error;
  if (!batch?.length) return { sent: 0, failed: 0 };
  fonts ??= await fetchFonts(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()));
  let sent = 0;
  let failed = 0;
  for (const e of batch as QueuedEmail[]) {
    try {
      const { data: prof } = await db
        .from('profiles')
        .select('display_name')
        .eq('id', e.user_id ?? '')
        .maybeSingle();
      const mail = await compose(e, {
        fonts,
        deletePageUrl: DELETE_PAGE_URL,
        userName: (prof as { display_name?: string } | null)?.display_name ?? null,
        load: async ({ user, room, cycle, scope, from, to }) => {
          const { data, error: rErr } = await db.rpc('report_data_internal', {
            p_user: user,
            p_room: room,
            p_cycle: cycle || null,
            p_scope: scope,
            p_from: from ?? null,
            p_to: to ?? null,
            p_channel: 'email',
          });
          if (rErr) throw rErr;
          return data as ReportData;
        },
      });
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [e.to_email],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: mail.attachments.map((a) => ({ filename: a.filename, content: toBase64(a.content) })),
        }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await db.rpc('email_done', { p_id: e.id, p_ok: true });
      sent++;
    } catch (err) {
      await db.rpc('email_done', {
        p_id: e.id,
        p_ok: false,
        p_error: String((err as Error)?.message ?? err),
      });
      failed++;
    }
  }
  return { sent, failed };
}

/** Renders a small statement in every language to prove fonts + shaping work on the server. */
async function selfTest() {
  const started = Date.now();
  fonts ??= await fetchFonts(async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()));
  const sample: ReportData = {
    ref: 'MM-SELFTEST',
    generated_at: new Date().toISOString(),
    scope: 'room',
    requester: 'a',
    room: { name: 'Test — اختبار — परीक्षण', currency: 'KWD', decimals: 3, time_zone: 'Asia/Kuwait' },
    period: { from: '2026-10-01', to: '2026-10-31' },
    people: {
      a: {
        name: 'أحمد',
        deleted: false,
        role: 'admin',
        status: 'approved',
        joined_on: '2026-10-01',
        left_on: null,
      },
      b: {
        name: 'सीमा',
        deleted: false,
        role: 'member',
        status: 'removed',
        joined_on: '2026-10-01',
        left_on: '2026-10-20',
      },
    },
    members: [
      { user_id: 'a', paid: 1250, share: 625 },
      { user_id: 'b', paid: 0, share: 625 },
    ],
    cycles: [],
    settlements: [],
    payments: [],
    disputes: [],
    audit: [],
    expenses: [
      {
        id: 'e',
        cycle_id: 'c',
        date: '2026-10-02',
        title: 'چاول दूध Rice',
        amount: 1250,
        currency: 'KWD',
        paid_by: 'a',
        created_by: 'a',
        created_at: '2026-10-02T10:00:00Z',
        notes: null,
        deleted: false,
        adjustment: false,
        late_entry_from: null,
        has_receipt: false,
        my_share: 1250,
        participants: 1,
      },
    ],
  };
  const sizes: Record<string, number> = {};
  for (const lang of ['en', 'ar', 'ur', 'hi'])
    sizes[lang] = (await buildReportPdf([sample], serverFormat(lang), fonts)).length;
  return { ok: true, sizes, ms: Date.now() - started };
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-worker-secret') ?? '';
  const { data: ok } = await db.rpc('worker_check', { p_secret: secret });
  if (ok !== true) return new Response('forbidden', { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body?.selftest) return Response.json(await selfTest());
  const files = await purgeFiles().catch(() => 0);
  const emails = await sendEmails().catch((e) => ({ error: String(e?.message ?? e) }));
  return Response.json({ files, emails });
});

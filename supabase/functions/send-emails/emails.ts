/** Compose the localized emails (subject, HTML body, attachments) for each queued kind. */
import { buildReportPdf, type FontBytes, serverMoney } from './pdf.ts';
import { RTL_LANGS, translator } from './i18n.ts';
import {
  buildReportBody,
  buildReportCsv,
  type ReportData,
  type ReportFormat,
  reportFileName,
  wrapHtml,
} from './report.ts';

export type QueuedEmail = {
  id: string;
  user_id: string | null;
  to_email: string;
  language: string;
  kind:
    | 'retention_notice'
    | 'leave_statement'
    | 'account_deleted'
    | 'account_final'
    | 'member_account_final'
    | 'deletion_confirm';
  room_id: string | null;
  payload: Record<string, unknown>;
};

export type Attachment = { filename: string; content: Uint8Array | string };
export type Composed = { subject: string; html: string; text: string; attachments: Attachment[] };

/** Loads report JSON for a user/room (server function `report_data_internal`). */
export type LoadReport = (args: {
  user: string;
  room: string;
  cycle?: string | null;
  scope: 'mine' | 'room';
  from?: string | null;
  to?: string | null;
}) => Promise<ReportData>;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function serverFormat(lang: string): ReportFormat {
  return { t: translator(lang), lang, rtl: RTL_LANGS.has(lang), money: serverMoney, digits: (s) => s };
}

function shell(f: ReportFormat, lead: string[], extra = ''): string {
  const t = f.t;
  return wrapHtml(
    'Mess Manager',
    `<section class="report">${lead.map((p) => `<p>${esc(p)}</p>`).join('')}${extra}
<footer class="muted"><p>${esc(t('email.footer'))}</p><p>Mess Manager · Uyoon Tech Solutions</p></footer></section>`,
    f,
  );
}

async function statement(reports: ReportData[], f: ReportFormat, fonts: FontBytes, withCsv = true) {
  const attachments: Attachment[] = [];
  const pdf = await buildReportPdf(reports, f, fonts);
  const first = reports[0];
  if (first) attachments.push({ filename: reportFileName(first, 'pdf'), content: pdf });
  if (withCsv)
    for (const r of reports)
      attachments.push({ filename: reportFileName(r, 'csv'), content: buildReportCsv(r, f.t) });
  return attachments;
}

export async function compose(
  e: QueuedEmail,
  ctx: { load: LoadReport; fonts: FontBytes; deletePageUrl: string; userName: string | null },
): Promise<Composed> {
  const f = serverFormat(e.language);
  const { t } = f;
  const p = e.payload;
  const s = (v: unknown) => (v == null ? '' : String(v));
  const hello = ctx.userName ? [t('email.greeting', { name: ctx.userName })] : [];
  const files = (a: Attachment[]) =>
    a.length ? [t('email.attached', { files: a.map((x) => x.filename).join(', ') })] : [];
  const bodyOf = (r: ReportData[]) => r.map((x) => buildReportBody(x, f)).join('');

  switch (e.kind) {
    case 'retention_notice': {
      const r = await ctx.load({ user: e.user_id!, room: e.room_id!, cycle: s(p.cycle_id), scope: 'room' });
      const vars = { room: r.room.name, from: s(p.from), to: s(p.to), date: s(p.delete_on) };
      const attachments = await statement([r], f, ctx.fonts);
      const lead = [...hello, t('email.retention_body', vars), ...files(attachments)];
      return {
        subject: t('email.retention_subject', vars),
        html: shell(f, lead, bodyOf([r])),
        text: lead.join('\n\n'),
        attachments,
      };
    }
    case 'leave_statement': {
      const r = await ctx.load({
        user: e.user_id!,
        room: e.room_id!,
        scope: 'mine',
        from: s(p.from) || null,
        to: s(p.to) || null,
      });
      const vars = { room: r.room.name, from: s(p.from), to: s(p.to) };
      const attachments = await statement([r], f, ctx.fonts);
      const lead = [
        ...hello,
        t(p.removed ? 'email.removed_body' : 'email.leave_body', vars),
        ...files(attachments),
      ];
      return {
        subject: t('email.leave_subject', vars),
        html: shell(f, lead, bodyOf([r])),
        text: lead.join('\n\n'),
        attachments,
      };
    }
    case 'account_deleted': {
      const lead = [...hello, t('email.deleted_body', { date: s(p.purge_after) })];
      return {
        subject: t('email.deleted_subject'),
        html: shell(f, lead),
        text: lead.join('\n\n'),
        attachments: [],
      };
    }
    case 'account_final': {
      const rooms = (Array.isArray(p.rooms) ? p.rooms : []) as string[];
      const reports: ReportData[] = [];
      for (const room of rooms) {
        try {
          reports.push(await ctx.load({ user: e.user_id!, room, scope: 'mine' }));
        } catch {
          // a Room that no longer exists has nothing left to report
        }
      }
      const attachments = reports.length ? await statement(reports, f, ctx.fonts) : [];
      const lead = [...hello, t('email.final_body'), ...files(attachments)];
      return {
        subject: t('email.final_subject'),
        html: shell(f, lead, bodyOf(reports)),
        text: lead.join('\n\n'),
        attachments,
      };
    }
    case 'member_account_final': {
      const r = await ctx.load({ user: s(p.deleted_user), room: e.room_id!, scope: 'mine' });
      const vars = { name: s(p.name), room: r.room.name };
      const attachments = await statement([r], f, ctx.fonts);
      const lead = [...hello, t('email.member_final_body', vars), ...files(attachments)];
      return {
        subject: t('email.member_final_subject', vars),
        html: shell(f, lead, bodyOf([r])),
        text: lead.join('\n\n'),
        attachments,
      };
    }
    case 'deletion_confirm': {
      const link = `${ctx.deletePageUrl}?lang=${encodeURIComponent(e.language)}#t=${encodeURIComponent(s(p.token))}`;
      const lead = [...hello, t('email.confirm_body')];
      const button = `<p><a href="${esc(link)}" style="display:inline-block;background:#1F6F5C;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(
        t('email.confirm_button'),
      )}</a></p><p class="muted" style="word-break:break-all">${esc(link)}</p>`;
      return {
        subject: t('email.confirm_subject'),
        html: shell(f, lead, button),
        text: [...lead, link].join('\n\n'),
        attachments: [],
      };
    }
  }
}

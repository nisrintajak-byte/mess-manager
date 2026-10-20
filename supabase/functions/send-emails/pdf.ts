/**
 * Server-side PDF statements for emails (PRD §15, §18.2–18.3).
 *
 * HarfBuzz (WebAssembly) shapes every script properly — Arabic joining, Urdu Nastaliq,
 * Devanagari clusters — and bidi-js orders mixed right-to-left / left-to-right text. pdf-lib only
 * writes the page: each glyph is placed by id at the position HarfBuzz gives it.
 *
 * Runs in Deno (Supabase Edge Function) and in Node (CI sample render) — no runtime-specific APIs.
 */
import fontkit from '@pdf-lib/fontkit';
import bidiFactory from 'bidi-js';
import hbjs from 'harfbuzzjs/hbjs.js';
import * as pdfLibNs from 'pdf-lib';
import type { PDFDocument as PDFDocumentT, PDFFont, PDFPage } from 'pdf-lib';

import {
  isolateLtr,
  type ReportData,
  type ReportFormat,
  minorToDecimal,
  memberRows,
  personName,
  reportTitle,
  reportTotals,
} from './report.ts';

// pdf-lib is CommonJS under Node and ESM under Deno; accept both shapes.
// deno-lint-ignore no-explicit-any
const pdfLib: typeof pdfLibNs = (pdfLibNs as any).PDFDocument ? pdfLibNs : (pdfLibNs as any).default;
const {
  PDFDocument,
  PDFHexString,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  beginText,
  endText,
  setFontAndSize,
  setTextMatrix,
  showText,
  setFillingColor,
} = pdfLib;
type PDFDocument = PDFDocumentT;
type Color = ReturnType<typeof rgb>;

export type FontBytes = {
  latin: Uint8Array;
  latinBold: Uint8Array;
  arabic: Uint8Array;
  arabicBold: Uint8Array;
  urdu: Uint8Array;
  urduBold: Uint8Array;
  devanagari: Uint8Array;
  devanagariBold: Uint8Array;
  harfbuzz: Uint8Array;
  harfbuzzSubset: Uint8Array;
};

const CDN = 'https://cdn.jsdelivr.net/npm';
export const FONT_URLS: Record<keyof FontBytes, string> = {
  latin: `${CDN}/@expo-google-fonts/noto-sans@0.4.1/400Regular/NotoSans_400Regular.ttf`,
  latinBold: `${CDN}/@expo-google-fonts/noto-sans@0.4.1/700Bold/NotoSans_700Bold.ttf`,
  arabic: `${CDN}/@expo-google-fonts/noto-naskh-arabic@0.4.1/400Regular/NotoNaskhArabic_400Regular.ttf`,
  arabicBold: `${CDN}/@expo-google-fonts/noto-naskh-arabic@0.4.1/700Bold/NotoNaskhArabic_700Bold.ttf`,
  urdu: `${CDN}/@expo-google-fonts/noto-nastaliq-urdu@0.4.2/400Regular/NotoNastaliqUrdu_400Regular.ttf`,
  urduBold: `${CDN}/@expo-google-fonts/noto-nastaliq-urdu@0.4.2/700Bold/NotoNastaliqUrdu_700Bold.ttf`,
  devanagari: `${CDN}/@expo-google-fonts/noto-sans-devanagari@0.4.1/400Regular/NotoSansDevanagari_400Regular.ttf`,
  devanagariBold: `${CDN}/@expo-google-fonts/noto-sans-devanagari@0.4.1/700Bold/NotoSansDevanagari_700Bold.ttf`,
  harfbuzz: `${CDN}/harfbuzzjs@0.3.6/hb.wasm`,
  harfbuzzSubset: `${CDN}/harfbuzzjs@0.3.6/hb-subset.wasm`,
};

export async function fetchFonts(fetchBytes: (url: string) => Promise<Uint8Array>): Promise<FontBytes> {
  const keys = Object.keys(FONT_URLS) as (keyof FontBytes)[];
  const bytes = await Promise.all(keys.map((k) => fetchBytes(FONT_URLS[k])));
  return Object.fromEntries(keys.map((k, i) => [k, bytes[i]])) as FontBytes;
}

type Script = 'latin' | 'arabic' | 'devanagari';
const bidi = bidiFactory();

function scriptOf(cp: number): Script | null {
  if (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  )
    return 'arabic';
  if ((cp >= 0x0900 && cp <= 0x097f) || (cp >= 0xa8e0 && cp <= 0xa8ff)) return 'devanagari';
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f)) return 'latin';
  return null; // digits, spaces, punctuation: follow the neighbouring script
}

export type Run = { text: string; level: number; script: Script };

/** Split one line into runs arranged left to right; each run keeps its text in logical order. */
export function visualRuns(text: string, rtl: boolean): Run[] {
  if (!text) return [];
  const levelsInfo = bidi.getEmbeddingLevels(text, rtl ? 'rtl' : 'ltr');
  const { levels } = levelsInfo;
  // script of each UTF-16 position; neutrals follow the previous strong character
  const scripts: Script[] = new Array(text.length);
  let prev: Script = rtl ? 'arabic' : 'latin';
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    const s = cp >= 0x30 && cp <= 0x39 ? 'latin' : scriptOf(cp);
    scripts[i] = s ?? prev;
    if (s && !(cp >= 0x30 && cp <= 0x39)) prev = s;
  }
  const order: number[] = bidi.getReorderedIndices(text, levelsInfo);
  const out: (Run & { idx: number[] })[] = [];
  for (const i of order) {
    const level = levels[i] ?? 0;
    const script = scripts[i] ?? 'latin';
    const last = out[out.length - 1];
    if (last && last.level === level && last.script === script) last.idx.push(i);
    else out.push({ text: '', level, script, idx: [i] });
  }
  return out.map((r) => {
    const idx = r.level % 2 ? [...r.idx].reverse() : r.idx; // back to logical order for shaping
    return { text: idx.map((i) => text[i]).join(''), level: r.level, script: r.script };
  });
}

type Glyph = { id: number; x: number; y: number };
// deno-lint-ignore no-explicit-any
type Face = { key: string; pdf: PDFFont | null; hb: any; upem: number };

class Shaper {
  // deno-lint-ignore no-explicit-any
  hb: any;
  faces: Record<string, Face>;
  cache = new Map<string, { glyphs: Glyph[]; width: number }>();
  // deno-lint-ignore no-explicit-any
  constructor(hb: any, faces: Record<string, Face>) {
    this.hb = hb;
    this.faces = faces;
  }
  face(script: Script, bold: boolean): Face {
    return this.faces[`${script}${bold ? 'Bold' : ''}`]!;
  }
  /** Glyphs of one run in visual order, positions in units of 1pt font size. */
  shape(run: Run, bold: boolean): { glyphs: Glyph[]; width: number } {
    const key = `${run.script}|${bold}|${run.level % 2}|${run.text}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const face = this.face(run.script, bold);
    const buf = this.hb.createBuffer();
    buf.addText(run.text);
    buf.guessSegmentProperties();
    buf.setDirection(run.level % 2 ? 'rtl' : 'ltr');
    this.hb.shape(face.hb, buf);
    const out = buf.json() as { g: number; ax: number; ay: number; dx: number; dy: number }[];
    buf.destroy();
    let x = 0;
    const glyphs: Glyph[] = [];
    for (const g of out) {
      glyphs.push({ id: g.g, x: (x + g.dx) / face.upem, y: g.dy / face.upem });
      x += g.ax;
    }
    const res = { glyphs, width: x / face.upem };
    this.cache.set(key, res);
    return res;
  }
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const INK = rgb(0.086, 0.125, 0.11);
const MUTED = rgb(0.36, 0.4, 0.38);
const ACCENT = rgb(0.12, 0.435, 0.36);
const RULE = rgb(0.85, 0.87, 0.85);
const HEAD_BG = rgb(0.945, 0.957, 0.945);

type Align = 'start' | 'end';

class Writer {
  doc: PDFDocument;
  page!: PDFPage;
  y = 0;
  shaper: Shaper;
  rtl: boolean;
  footer: string;
  lineFactor: number;
  constructor(doc: PDFDocument, shaper: Shaper, rtl: boolean, footer: string, lineFactor: number) {
    this.doc = doc;
    this.shaper = shaper;
    this.rtl = rtl;
    this.footer = footer;
    this.lineFactor = lineFactor;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
    const n = this.doc.getPageCount();
    this.drawLine(
      `${this.footer} · ${n}`,
      MARGIN,
      MARGIN - 18,
      PAGE_W - 2 * MARGIN,
      7.5,
      false,
      MUTED,
      'start',
    );
  }

  ensure(h: number) {
    if (this.y - h < MARGIN + 6) this.newPage();
  }

  width(text: string, size: number, bold: boolean): number {
    return visualRuns(text, this.rtl).reduce((w, r) => w + this.shaper.shape(r, bold).width * size, 0);
  }

  /** Draw one already-fitting line inside [x, x+w], aligned to the reading direction. */
  drawLine(
    text: string,
    x: number,
    y: number,
    w: number,
    size: number,
    bold: boolean,
    color: Color = INK,
    align: Align = 'start',
  ) {
    const runs = visualRuns(text, this.rtl).map((r) => ({ r, s: this.shaper.shape(r, bold) }));
    const total = runs.reduce((acc, it) => acc + it.s.width * size, 0);
    const toRight = (align === 'start') === this.rtl;
    let cx = toRight ? x + w - total : x;
    const ops = [pushGraphicsState(), setFillingColor(color), beginText()];
    for (const { r, s } of runs) {
      const face = this.shaper.face(r.script, bold);
      let used = this.glyphs.get(face.key);
      if (!used) this.glyphs.set(face.key, (used = new Set([0])));
      for (const g of s.glyphs) used.add(g.id);
      if (!face.pdf) continue; // measuring pass: nothing is drawn
      const fontKey = this.fontKey(face.pdf);
      ops.push(setFontAndSize(fontKey, size));
      for (const g of s.glyphs) {
        ops.push(setTextMatrix(1, 0, 0, 1, cx + g.x * size, y + g.y * size));
        ops.push(showText(PDFHexString.of(g.id.toString(16).padStart(4, '0'))));
      }
      cx += s.width * size;
    }
    ops.push(endText(), popGraphicsState());
    this.page.pushOperators(...ops);
  }

  glyphs = new Map<string, Set<number>>();
  fontKeys = new Map<PDFPage, Map<PDFFont, string>>();
  used = new Set<PDFFont>();
  fontKey(font: PDFFont): string {
    this.used.add(font);
    let m = this.fontKeys.get(this.page);
    if (!m) this.fontKeys.set(this.page, (m = new Map()));
    let k = m.get(font);
    if (!k) {
      // deno-lint-ignore no-explicit-any
      k = (this.page.node as any).newFontDictionary(font.name, font.ref).toString() as string;
      m.set(font, k);
    }
    return k.replace(/^\//, '');
  }

  /** Wrap text (logical order) into lines that fit `w`. */
  wrap(text: string, w: number, size: number, bold: boolean): string[] {
    const lines: string[] = [];
    for (const para of text.split('\n')) {
      const words = para.split(/(\s+)/);
      let line = '';
      for (const word of words) {
        const next = line + word;
        if (line && this.width(next.trim(), size, bold) > w) {
          lines.push(line.trim());
          line = word.trimStart();
        } else line = next;
        while (this.width(line, size, bold) > w && line.length > 1) {
          let k = line.length - 1;
          while (k > 1 && this.width(line.slice(0, k), size, bold) > w) k--;
          lines.push(line.slice(0, k));
          line = line.slice(k);
        }
      }
      lines.push(line.trim());
    }
    return lines;
  }

  text(text: string, size = 10, opts: { bold?: boolean; color?: Color; gap?: number } = {}) {
    const lh = size * 1.55 * this.lineFactor;
    for (const line of this.wrap(text, PAGE_W - 2 * MARGIN, size, !!opts.bold)) {
      this.ensure(lh);
      this.y -= lh;
      this.drawLine(
        line,
        MARGIN,
        this.y + lh * 0.3,
        PAGE_W - 2 * MARGIN,
        size,
        !!opts.bold,
        opts.color ?? INK,
      );
    }
    this.y -= opts.gap ?? 2;
  }

  heading(text: string) {
    this.ensure(40);
    this.y -= 12;
    this.text(text, 12.5, { bold: true, color: ACCENT, gap: 0 });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y - 2 },
      end: { x: PAGE_W - MARGIN, y: this.y - 2 },
      thickness: 1.2,
      color: ACCENT,
    });
    this.y -= 8;
  }

  table(cols: { title: string; w: number; align?: Align }[], rows: string[][], size = 8.5) {
    const total = PAGE_W - 2 * MARGIN;
    const sum = cols.reduce((s, c) => s + c.w, 0);
    const widths = cols.map((c) => (c.w / sum) * total);
    const xs: number[] = [];
    let acc = 0;
    for (const w of widths) {
      xs.push(this.rtl ? MARGIN + total - acc - w : MARGIN + acc);
      acc += w;
    }
    const pad = 3;
    const lh = size * 1.45 * this.lineFactor;
    const drawRow = (cells: string[], bold: boolean, bg?: Color) => {
      const wrapped = cells.map((c, i) => this.wrap(c ?? '', (widths[i] ?? 10) - 2 * pad, size, bold));
      const h = Math.max(...wrapped.map((l) => l.length)) * lh + 2 * pad;
      if (this.y - h < MARGIN + 6) {
        this.newPage();
        if (!bold) drawHeader();
      }
      if (bg) this.page.drawRectangle({ x: MARGIN, y: this.y - h, width: total, height: h, color: bg });
      wrapped.forEach((lines, i) => {
        lines.forEach((line, k) => {
          this.drawLine(
            line,
            (xs[i] ?? MARGIN) + pad,
            this.y - pad - (k + 1) * lh + lh * 0.3,
            (widths[i] ?? 10) - 2 * pad,
            size,
            bold,
            INK,
            cols[i]?.align ?? 'start',
          );
        });
      });
      this.y -= h;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: PAGE_W - MARGIN, y: this.y },
        thickness: 0.5,
        color: RULE,
      });
    };
    const drawHeader = () =>
      drawRow(
        cols.map((c) => c.title),
        true,
        HEAD_BG,
      );
    drawHeader();
    for (const r of rows) drawRow(r, false);
    this.y -= 6;
  }
}

// deno-lint-ignore no-explicit-any
let hbInstance: any = null;
async function harfbuzz(wasm: Uint8Array) {
  if (!hbInstance) {
    const { instance } = await WebAssembly.instantiate(wasm);
    hbInstance = hbjs(instance);
  }
  return hbInstance;
}

/**
 * Font subsetting with HarfBuzz, keeping glyph ids unchanged, so a statement carries only the
 * glyphs it uses (tens of KB instead of megabytes) and the ids from shaping stay valid.
 */
// deno-lint-ignore no-explicit-any
let subsetExports: any = null;
async function subsetter(wasm: Uint8Array) {
  if (!subsetExports) subsetExports = (await WebAssembly.instantiate(wasm)).instance.exports;
  const e = subsetExports;
  return (font: Uint8Array, glyphs: Set<number>): Uint8Array => {
    const ptr = e.malloc(font.length);
    new Uint8Array(e.memory.buffer).set(font, ptr);
    const blob = e.hb_blob_create(ptr, font.length, 2 /* writable */, 0, 0);
    const face = e.hb_face_create(blob, 0);
    e.hb_blob_destroy(blob);
    const input = e.hb_subset_input_create_or_fail();
    const set = e.hb_subset_input_glyph_set(input);
    for (const g of glyphs) e.hb_set_add(set, g);
    e.hb_subset_input_set_flags(input, 0x1 /* no hinting */ | 0x2 /* retain glyph ids */);
    const sub = e.hb_subset_or_fail(face, input);
    e.hb_subset_input_destroy(input);
    if (!sub) {
      e.hb_face_destroy(face);
      e.free(ptr);
      return font; // keep the full font rather than fail the statement
    }
    const outBlob = e.hb_face_reference_blob(sub);
    const off = e.hb_blob_get_data(outBlob, 0);
    const len = e.hb_blob_get_length(outBlob);
    const out = new Uint8Array(e.memory.buffer, off, len).slice();
    e.hb_blob_destroy(outBlob);
    e.hb_face_destroy(sub);
    e.hb_face_destroy(face);
    e.free(ptr);
    return out;
  };
}

/** One PDF with one or several report sections (e.g. a final statement for each former Room). */
export async function buildReportPdf(
  reports: ReportData[],
  f: ReportFormat,
  fontBytes: FontBytes,
  heading?: string,
): Promise<Uint8Array> {
  const hb = await harfbuzz(fontBytes.harfbuzz);
  const urdu = f.lang === 'ur';
  const files: Record<string, Uint8Array> = {
    latin: fontBytes.latin,
    latinBold: fontBytes.latinBold,
    arabic: urdu ? fontBytes.urdu : fontBytes.arabic,
    arabicBold: urdu ? fontBytes.urduBold : fontBytes.arabicBold,
    devanagari: fontBytes.devanagari,
    devanagariBold: fontBytes.devanagariBold,
  };
  // pass 1 measures and records which glyphs are needed; pass 2 draws with subset fonts
  const first = await renderPass(reports, f, hb, files, null, heading);
  const subset = await subsetter(fontBytes.harfbuzzSubset);
  const embed: Record<string, Uint8Array> = {};
  for (const [key, glyphs] of first.glyphs) {
    const bytes = files[key];
    if (bytes) embed[key] = subset(bytes, glyphs);
  }
  return (await renderPass(reports, f, hb, files, embed, heading)).pdf!;
}

async function renderPass(
  reports: ReportData[],
  f: ReportFormat,
  // deno-lint-ignore no-explicit-any
  hb: any,
  files: Record<string, Uint8Array>,
  embed: Record<string, Uint8Array> | null,
  heading?: string,
): Promise<{ glyphs: Map<string, Set<number>>; pdf: Uint8Array | null }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit); // only to read the font files; HarfBuzz does the layout
  const urdu = f.lang === 'ur';
  const faces: Record<string, Face> = {};
  for (const [key, bytes] of Object.entries(files)) {
    const face = hb.createFace(hb.createBlob(bytes), 0);
    const toEmbed = embed?.[key];
    const pdf = toEmbed ? await doc.embedFont(toEmbed, { subset: false }) : null;
    faces[key] = { key, hb: hb.createFont(face), upem: face.upem, pdf };
  }

  const shaper = new Shaper(hb, faces);
  const { t } = f;
  doc.setTitle(heading ?? reports.map((r) => `${reportTitle(r, t)} · ${r.room.name}`).join(' / '));
  doc.setProducer('Mess Manager · Uyoon Tech Solutions');
  doc.setLanguage(f.lang);
  const w = new Writer(
    doc,
    shaper,
    f.rtl,
    `Mess Manager · ${reports.map((r) => r.ref).join(', ')}`,
    urdu ? 1.45 : 1,
  );

  reports.forEach((data, index) => {
    if (index > 0) w.newPage();
    const m = (v: number, c = data.room.currency, d = data.room.decimals) => f.money(v, c, d);
    const who = (uid: string | null) => personName(data, uid, t);
    const day = (s: string | null) => isolateLtr(f.digits(s ? s.slice(0, 10) : '—'), f.rtl);
    const time = (s: string | null) =>
      isolateLtr(f.digits(s ? s.slice(0, 16).replace('T', ' ') : '—'), f.rtl);
    const range = (a: string | null, b: string | null) => t('cycle.range', { from: day(a), to: day(b) });
    const totals = reportTotals(data);
    const cycleById = new Map(data.cycles.map((c) => [c.id, c]));

    if (heading && index === 0) w.text(heading, 11, { color: MUTED });
    w.text(reportTitle(data, t), 18, { bold: true });
    w.text(`${data.room.name} · ${data.room.currency}`, 11, { bold: true });
    w.text(`${t('report.period')}: ${range(data.period.from, data.period.to)}`, 9, { color: MUTED, gap: 0 });
    w.text(`${t('report.generated')}: ${time(data.generated_at)} UTC`, 9, { color: MUTED, gap: 0 });
    w.text(`${t('report.refLabel')}: ${isolateLtr(data.ref, f.rtl)}`, 9, { color: MUTED, gap: 0 });
    if (data.scope !== 'room' && data.requester)
      w.text(`${t('report.for')}: ${who(data.requester)}`, 9, { color: MUTED, gap: 0 });
    w.y -= 6;
    const summary: [string, string][] = [[t('report.totalExpenses'), m(totals.total)]];
    if (data.scope !== 'room') {
      summary.push(
        [t('report.youPaid'), m(totals.myPaid)],
        [t('report.yourShare'), m(totals.myShare)],
        [t('report.difference'), m(totals.net)],
      );
    }
    w.table(
      summary.map(([k]) => ({ title: k, w: 1, align: 'start' as Align })),
      [summary.map(([, v]) => v)],
      9.5,
    );

    const members = memberRows(data, t, (x) => day(x));
    if (members.length) {
      w.heading(t('report.members'));
      w.text(t('report.membersNote'), 8.5, { color: MUTED });
      w.table(
        [
          { title: t('report.colMember'), w: 1.8 },
          { title: t('report.colStatus'), w: 2.2 },
          { title: t('report.colPaid'), w: 1.3, align: 'end' },
          { title: t('report.colShare'), w: 1.3, align: 'end' },
          { title: t('report.colNet'), w: 1.3, align: 'end' },
        ],
        members.map((r) => [r.name, r.status, m(r.paid), m(r.share), m(r.net)]),
      );
    }

    w.heading(t('report.expenses'));
    if (!data.expenses.length) w.text(t('report.none'), 9, { color: MUTED });
    else
      w.table(
        [
          { title: t('report.colDate'), w: 1.1 },
          { title: t('report.colItem'), w: 2.6 },
          { title: t('report.colPaidBy'), w: 1.4 },
          { title: t('report.colAmount'), w: 1.3, align: 'end' },
          { title: t('report.colMyShare'), w: 1.3, align: 'end' },
        ],
        data.expenses.map((e) => {
          const tags = [
            e.deleted ? t('report.tagDeleted') : '',
            e.adjustment ? t('report.tagAdjustment') : '',
            e.late_entry_from ? t('report.tagLate', { date: day(e.late_entry_from) }) : '',
            e.has_receipt ? t('report.tagReceipt') : '',
          ].filter(Boolean);
          const item = [e.title, e.notes ?? '', tags.length ? `[${tags.join(' · ')}]` : '']
            .filter(Boolean)
            .join('\n');
          return [
            day(e.date),
            item,
            who(e.paid_by),
            m(e.amount, e.currency),
            e.my_share == null ? '—' : m(e.my_share, e.currency),
          ];
        }),
      );

    w.heading(t('report.settlements'));
    if (!data.settlements.length) w.text(t('report.none'), 9, { color: MUTED });
    for (const s of data.settlements) {
      const c = cycleById.get(s.cycle_id);
      w.text(
        `${c ? range(c.starts_on, c.ends_on) : ''} · ${t('report.total')} ${f.money(s.total, s.currency, s.decimals)}`,
        9.5,
        { bold: true },
      );
      w.table(
        [
          { title: t('report.colMember'), w: 2 },
          { title: t('report.colShare'), w: 1.3, align: 'end' },
          { title: t('report.colPaid'), w: 1.3, align: 'end' },
          { title: t('report.colNet'), w: 1.3, align: 'end' },
          { title: t('report.colConfirmed'), w: 1.3, align: 'end' },
        ],
        s.lines.map((l) => [
          who(l.user_id),
          f.money(l.share, s.currency, s.decimals),
          f.money(l.paid, s.currency, s.decimals),
          f.money(l.net, s.currency, s.decimals),
          f.money(l.confirmed, s.currency, s.decimals),
        ]),
      );
    }

    w.heading(t('report.payments'));
    if (!data.payments.length) w.text(t('report.none'), 9, { color: MUTED });
    else
      w.table(
        [
          { title: t('report.colDate'), w: 1.4 },
          { title: t('report.colMember'), w: 1.5 },
          { title: t('report.colAmount'), w: 1.3, align: 'end' },
          { title: t('report.colMethod'), w: 1.8 },
          { title: t('report.colStatus'), w: 1.6 },
        ],
        data.payments.map((p) => [
          time(p.claimed_at),
          who(p.payer),
          m(p.amount, p.currency),
          [
            t(`payment.method_${p.method}`),
            p.reference ? `${t('report.reference')}: ${p.reference}` : '',
            p.has_proof ? t('report.proofAttached') : '',
          ]
            .filter(Boolean)
            .join('\n'),
          [
            t(`payment.status_${p.status}`),
            p.decided_by ? `${who(p.decided_by)} · ${time(p.decided_at)}` : '',
            p.reject_reason ?? '',
          ]
            .filter(Boolean)
            .join('\n'),
        ]),
      );

    w.heading(t('report.disputes'));
    if (!data.disputes.length) w.text(t('report.none'), 9, { color: MUTED });
    else
      w.table(
        [
          { title: t('report.colDate'), w: 1.4 },
          { title: t('report.colBy'), w: 1.4 },
          { title: t('report.colItem'), w: 1.4 },
          { title: t('report.colReason'), w: 2.2 },
          { title: t('report.colStatus'), w: 1.6 },
        ],
        data.disputes.map((x) => [
          time(x.created_at),
          who(x.raised_by),
          t(`flag.on_${x.target_type}`),
          [t(`flag.r_${x.reason}`), x.note ?? ''].filter(Boolean).join('\n'),
          [t(`flag.s_${x.status}`), x.resolution_note ?? ''].filter(Boolean).join('\n'),
        ]),
      );

    w.heading(t('report.audit'));
    if (!data.audit.length) w.text(t('report.none'), 9, { color: MUTED });
    else
      w.table(
        [
          { title: t('report.colTime'), w: 1.4 },
          { title: t('report.colBy'), w: 1.4 },
          { title: t('report.colAction'), w: 1.8 },
          { title: t('report.colItem'), w: 2.4 },
        ],
        data.audit.map((a) => [
          time(a.at),
          who(a.actor),
          `${t(`report.a_${a.entity}`)} · ${t(`report.act_${a.action}`)}`,
          a.title ?? '',
        ]),
        8,
      );

    const deleteOn = data.cycles
      .map((c) => c.delete_on)
      .filter((x): x is string => !!x)
      .sort()[0];
    w.y -= 8;
    w.text(
      t('report.retentionNote') + (deleteOn ? ' ' + t('report.deleteOn', { date: day(deleteOn) }) : ''),
      8.5,
      { color: MUTED },
    );
    w.text(t('report.verifyNote', { ref: data.ref }), 8.5, { color: MUTED });
  });

  if (!embed) return { glyphs: w.glyphs, pdf: null };
  // deno-lint-ignore no-explicit-any
  const d = doc as any;
  d.fonts = d.fonts.filter((ft: PDFFont) => w.used.has(ft));
  return { glyphs: w.glyphs, pdf: await doc.save() };
}

/** Money for server documents: ISO code + plain decimals with thousands grouping. */
export function serverMoney(minor: number, currency: string, decimals: number): string {
  const [whole, frac] = minorToDecimal(minor, decimals).split('.');
  const neg = whole?.startsWith('-');
  const digits = (whole ?? '0').replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency} ${neg ? '-' : ''}${digits}${frac ? '.' + frac : ''}`;
}

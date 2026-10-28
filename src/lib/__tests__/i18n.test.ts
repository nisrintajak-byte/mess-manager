import * as fs from 'fs';
import * as path from 'path';

import ar from '../../i18n/locales/ar.json';
import en from '../../i18n/locales/en.json';
import hi from '../../i18n/locales/hi.json';
import ur from '../../i18n/locales/ur.json';

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const base = flatten(en as Tree);
const PLURAL = /_(zero|one|two|few|many|other)$/;
const stem = (k: string) => k.replace(PLURAL, '');
const placeholders = (s: string) =>
  (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

describe.each([
  ['ar', ar],
  ['ur', ur],
  ['hi', hi],
] as const)('%s translation', (_lang, file) => {
  const tr = flatten(file as Tree);
  delete tr._draft;

  test('has every English key (plural forms may differ)', () => {
    const have = new Set(Object.keys(tr).map(stem));
    const missing = Object.keys(base)
      .map(stem)
      .filter((k) => !have.has(k));
    expect(missing).toEqual([]);
  });

  test('has no extra keys', () => {
    const want = new Set(Object.keys(base).map(stem));
    const extra = Object.keys(tr)
      .map(stem)
      .filter((k) => !want.has(k));
    expect(extra).toEqual([]);
  });

  test('keeps the same {{placeholders}} as English', () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(tr)) {
      const en = base[k] ?? base[`${stem(k)}_other`] ?? base[`${stem(k)}_one`];
      if (en === undefined) continue;
      const a = placeholders(en);
      const b = placeholders(v);
      // plural forms such as "one" may legitimately omit {{count}}
      const ok = PLURAL.test(k) ? b.every((p) => a.includes(p)) : a.join() === b.join();
      if (!ok) bad.push(k);
    }
    expect(bad).toEqual([]);
  });

  test('is not empty', () => {
    expect(Object.values(tr).filter((v) => v.trim() === '')).toEqual([]);
  });
});

describe('no hard-coded UI text (PRD §16.2)', () => {
  const roots = ['src/screens', 'src/ui', 'src/navigation'].map((r) => path.join(process.cwd(), r));
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  roots.forEach(walk);

  test('JSX text nodes contain no literal words', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      // text between a closing > and the next < that contains letters and is not a {expression}
      const re = />\s*([A-Za-z؀-ۿऀ-ॿ][^<>{}]*[A-Za-z؀-ۿऀ-ॿ.?!])\s*</g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const before = src.slice(Math.max(0, m.index - 40), m.index);
        if (/=\s*$/.test(before) || /\bextends\b|=>\s*$/.test(before)) continue;
        offenders.push(`${path.relative(process.cwd(), f)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('server error codes', () => {
  test('every code the database raises has an errors.<code> text (else the raw key shows)', () => {
    const dir = path.join(process.cwd(), 'supabase/migrations');
    const codes = new Set<string>();
    for (const f of fs.readdirSync(dir)) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of sql.matchAll(/raise exception '([a-z_]+)'/gi)) codes.add(m[1]!);
    }
    const missing = [...codes].filter((c) => base[`errors.${c}`] === undefined).sort();
    expect(missing).toEqual([]);
  });
});

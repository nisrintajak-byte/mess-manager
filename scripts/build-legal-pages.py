#!/usr/bin/env python3
"""Builds the public web pages of the Privacy Policy and Terms (needed for Google Play) from the
same texts the app shows (src/legal/*.json). Run after editing a legal text; CI checks it."""
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
LANGS = ['en', 'ar', 'ur', 'hi']
NAMES = {'en': 'English', 'ar': 'العربية', 'ur': 'اردو', 'hi': 'हिन्दी'}
texts = {l: json.loads((ROOT / f'src/legal/{l}.json').read_text(encoding='utf-8')) for l in LANGS}

CSS = """
:root{--bg:#F6F7F4;--card:#fff;--ink:#16201C;--muted:#5B6762;--line:#D9DED9;--accent:#1F6F5C;--warn:#FFF4D6}
@media (prefers-color-scheme:dark){:root{--bg:#0F1714;--card:#18231F;--ink:#E8EFEA;--muted:#A3B1AA;--line:#2C3A35;--accent:#4FB89B;--warn:#3A3010}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Naskh Arabic","Noto Sans Devanagari",sans-serif}
html[lang=ur] body{font-family:"Noto Nastaliq Urdu","Jameel Noori Nastaleeq","Noto Naskh Arabic",system-ui,sans-serif;line-height:2.1}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}h1{font-size:26px;margin:12px 0 4px}h2{font-size:18px;margin:22px 0 6px}
.muted{color:var(--muted);font-size:14px}.draft{background:var(--warn);border-radius:10px;padding:10px 12px;margin:12px 0}
nav{display:flex;gap:8px;flex-wrap:wrap}nav a{color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:14px}
nav a[aria-current]{background:var(--accent);color:#fff;border-color:var(--accent)}section[hidden]{display:none}
"""

def page(doc: str) -> str:
    parts = []
    for l in LANGS:
        t = texts[l]
        d = t[doc]
        body = ''.join(
            f'<h2>{html.escape(s["h"])}</h2>' + ''.join(f'<p>{html.escape(p)}</p>' for p in s['p'])
            for s in d['sections'])
        parts.append(f'<section data-lang="{l}" lang="{l}" dir="{"rtl" if l in ("ar", "ur") else "ltr"}" hidden>'
                     f'<h1>{html.escape(d["title"])}</h1><p class="muted">{html.escape(t["updated"])}</p>'
                     f'<div class="draft">{html.escape(t["draft"])}</div>{body}</section>')
    nav = ''.join(f'<a href="?lang={l}" data-l="{l}" lang="{l}">{NAMES[l]}</a>' for l in LANGS)
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(texts['en'][doc]['title'])} — Mess Manager</title><style>{CSS}</style></head>
<body><main><nav>{nav}</nav>{''.join(parts)}<p class="muted">Mess Manager · Uyoon Tech Solutions</p></main>
<script>
(function(){{var q=new URLSearchParams(location.search).get('lang');var b=(navigator.language||'en').slice(0,2);
var langs={json.dumps(LANGS)};var l=langs.indexOf(q)>=0?q:(langs.indexOf(b)>=0?b:'en');
function show(x){{document.documentElement.lang=x;document.documentElement.dir=(x==='ar'||x==='ur')?'rtl':'ltr';
document.querySelectorAll('section[data-lang]').forEach(function(s){{s.hidden=s.dataset.lang!==x}});
document.querySelectorAll('nav a').forEach(function(a){{if(a.dataset.l===x)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')}});}}
document.querySelectorAll('nav a').forEach(function(a){{a.addEventListener('click',function(e){{e.preventDefault();history.replaceState(null,'','?lang='+a.dataset.l);show(a.dataset.l)}})}});
show(l);}})();
</script></body></html>
"""

for doc in ['privacy', 'terms']:
    out = ROOT / 'public' / doc / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page(doc), encoding='utf-8')
print('legal pages written')

#!/usr/bin/env bash
# The send-emails server function renders reports with the app's own code and translations.
# Copy them in (run after changing src/lib/report.ts or any locale). CI fails if they differ.
# Only the translation sections the server uses are copied, to keep the function small.
set -euo pipefail
cd "$(dirname "$0")/.."
dst=supabase/functions/send-emails
cp src/lib/report.ts "$dst/report.ts"
mkdir -p "$dst/locales"
python3 - "$dst" <<'PY'
import json, sys
dst = sys.argv[1]
KEEP = {'report': None, 'email': None, 'account': ['deletedName', 'deletedUser'], 'cycle': ['range'],
        'payment': 'method_|status_', 'flag': 'r_|s_|on_', 'settlement': 'status_|toPay|toReceive|even',
        'common': ['yes', 'no'], 'inbox': 'k_', 'app': ['name']}
for lang in ['en', 'ar', 'ur', 'hi']:
    src = json.load(open(f'src/i18n/locales/{lang}.json', encoding='utf-8'))
    out = {}
    for sec, rule in KEEP.items():
        d = src.get(sec, {})
        if rule is None:
            out[sec] = d
        elif isinstance(rule, list):
            out[sec] = {k: d[k] for k in rule if k in d}
        else:
            pre = tuple(rule.split('|'))
            out[sec] = {k: v for k, v in d.items() if k.startswith(pre)}
    with open(f'{dst}/locales/{lang}.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
PY

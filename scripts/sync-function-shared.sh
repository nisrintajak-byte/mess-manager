#!/usr/bin/env bash
# The send-emails server function renders reports with the app's own code and translations.
# Copy them in (run after changing src/lib/report.ts or any locale). CI fails if they differ.
set -euo pipefail
cd "$(dirname "$0")/.."
dst=supabase/functions/send-emails
cp src/lib/report.ts "$dst/report.ts"
mkdir -p "$dst/locales"
cp src/i18n/locales/*.json "$dst/locales/"

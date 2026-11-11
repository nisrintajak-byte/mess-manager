#!/usr/bin/env bash
# QA-only: pick the banner code to test (.github/anr-variant = baseline | fixed) and log each
# banner load with its screen name. Never committed to the app.
set -e
V=$(cat .github/anr-variant 2>/dev/null || echo fixed)
if [ "$V" = baseline ]; then
  cp .github/qa-baseline-AdSlot.native.tsx src/ui/AdSlot.native.tsx
  cp .github/qa-baseline-files.ts src/lib/files.ts
fi
python3 - src/ui/AdSlot.native.tsx <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("<BannerAd\n","<BannerAd\n        onAdLoaded={() => console.log('MMQA adLoaded ' + screen)}\n",1)
open(p,'w').write(s)
PY
echo "variant: $V"; grep -n "MMQA" src/ui/AdSlot.native.tsx

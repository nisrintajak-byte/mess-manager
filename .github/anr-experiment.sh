#!/usr/bin/env bash
# QA-only (never committed to the app): show the Home banner on the Welcome screen and re-render
# that screen every 2 s like a normal data screen does, logging every banner load, so the probe
# can count how often the banner is re-created without needing to sign in.
set -e
# 'baseline' in .github/anr-experiment-on = test the AdSlot from before the fix
if grep -q baseline .github/anr-experiment-on; then cp .github/qa-baseline-AdSlot.native.tsx src/ui/AdSlot.native.tsx; fi
F=src/screens/auth/WelcomeScreen.tsx
python3 - "$F" <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("import { useTranslation } from 'react-i18next';",
 "import { useEffect, useState } from 'react';\nimport { useTranslation } from 'react-i18next';\nimport { AdSlot } from '../../ui/AdSlot';",1)
s=s.replace("  const insets = useSafeAreaInsets();\n  return (",
 "  const insets = useSafeAreaInsets();\n  const [tick, setTick] = useState(0);\n  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 2000); return () => clearInterval(id); }, []);\n  console.log('MMQA render ' + tick);\n  return (",1)
s=s.replace("          <GoogleButton />","          <GoogleButton />\n          <AdSlot screen=\"Home\" />",1)
open(p,'w').write(s)
PY
python3 - src/ui/AdSlot.native.tsx <<'PY'
import sys
p=sys.argv[1]; s=open(p).read()
s=s.replace("onAdFailedToLoad={","onAdLoaded={() => console.log('MMQA adLoaded')}\n        onAdFailedToLoad={(e: unknown) => { console.log('MMQA adFailed ' + String((e as Error)?.message)); }}\n        data-x={",1)
open(p,'w').write(s)
PY
grep -n "MMQA\|AdSlot" $F src/ui/AdSlot.native.tsx

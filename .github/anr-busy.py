#!/usr/bin/env python3
"""Count stack samples where the app's main thread was busy (not waiting for work)."""
import re, sys
text = open(sys.argv[1], errors='replace').read()
blocks = re.findall(r'^"main" .*?(?=^\s*$)', text, flags=re.M | re.S)
busy = sum(1 for b in blocks if 'nativePollOnce' not in b)
print(f'{busy}/{len(blocks)}')

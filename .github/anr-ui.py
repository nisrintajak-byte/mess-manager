#!/usr/bin/env python3
"""Tiny UI driver for the ANR probe: tap a text, type into the n-th input, list screen text."""
import re, subprocess, sys, time

def sh(*a):
    return subprocess.run(['adb', 'shell', *a], capture_output=True, text=True).stdout

def dump():
    sh('uiautomator', 'dump', '/sdcard/ui.xml')
    return sh('cat', '/sdcard/ui.xml')

def nodes(xml):
    for m in re.finditer(r'<node [^>]*>', xml):
        n = m.group(0)
        g = lambda k: (re.search(k + r'="([^"]*)"', n) or [None, ''])[1]
        b = re.findall(r'\d+', g('bounds'))
        if len(b) == 4:
            x1, y1, x2, y2 = map(int, b)
            yield {'text': g('text'), 'desc': g('content-desc'), 'cls': g('class'), 'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2}

def tap_text(t, last=False):
    for _ in range(5):
        hits = [n for n in nodes(dump()) if n['text'] == t or n['desc'] == t]
        if hits:
            n = hits[-1] if last else hits[0]
            sh('input', 'tap', str(n['x']), str(n['y']))
            return True
        time.sleep(2)
    return False

def type_into(i, value):
    edits = [n for n in nodes(dump()) if n['cls'].endswith('EditText')]
    if len(edits) <= i:
        return False
    sh('input', 'tap', str(edits[i]['x']), str(edits[i]['y']))
    time.sleep(0.5)
    sh('input', 'text', value.replace(' ', '%s').replace('@', '\\@'))
    return True

cmd = sys.argv[1]
if cmd == 'tap':
    print('tap', sys.argv[2], tap_text(sys.argv[2]))
elif cmd == 'taplast':
    print('taplast', sys.argv[2], tap_text(sys.argv[2], last=True))
elif cmd == 'type':
    print('type', sys.argv[2], type_into(int(sys.argv[2]), sys.argv[3]))
elif cmd == 'texts':
    print(' | '.join(n['text'] for n in nodes(dump()) if n['text']))
elif cmd == 'tapfirst':  # tap the first node whose text contains any of the args
    for n in nodes(dump()):
        if any(a in n['text'] for a in sys.argv[2:]) and n['text']:
            sh('input', 'tap', str(n['x']), str(n['y'])); print('tapped', n['text']); break

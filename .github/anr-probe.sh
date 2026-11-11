#!/usr/bin/env bash
# Used by .github/workflows/anr-probe.yml (runs inside the emulator step).
set -x
PKG=com.uyoontech.messmanager
mkdir -p out
adb root || true
sleep 3
adb install -r app.apk
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity | tee out/start.txt
# main-thread samples during start-up (every 1.5 s for 30 s)
for i in $(seq 1 20); do
  sleep 1.5
  P=$(adb shell pidof $PKG | tr -d '\r')
  [ -n "$P" ] && adb shell kill -3 $P
done
sleep 3
adb shell 'ls -la /data/anr' > out/anr-dir-after-start.txt 2>&1
adb shell 'cat /data/anr/*' > out/startup-traces.txt 2>&1
adb shell 'rm -f /data/anr/*' || true
adb shell dumpsys gfxinfo $PKG > out/gfxinfo-start.txt
adb exec-out screencap -p > out/screen-start.png
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml out/ui-start.xml || true
# random use: taps, swipes, back key; monkey stops and prints "NOT RESPONDING" on an ANR
adb shell monkey -p $PKG --pct-syskeys 0 --pct-appswitch 0 --pct-anyevent 0 --throttle 150 -v -s 7 2500 > out/monkey.txt 2>&1
adb shell 'ls -la /data/anr' > out/anr-dir-after-monkey.txt 2>&1
adb shell 'cat /data/anr/anr_* 2>/dev/null' > out/anr-traces.txt 2>&1
adb shell dumpsys gfxinfo $PKG > out/gfxinfo-monkey.txt
adb shell dumpsys activity processes > /dev/null
adb exec-out screencap -p > out/screen-end.png
adb logcat -d > out/logcat.txt || true
grep -nE "ANR in|NOT RESPONDING|Input dispatching timed out|Skipped [0-9]+ frames|Davey|FATAL EXCEPTION|Application Not Responding" out/logcat.txt out/monkey.txt | head -200 > out/summary.txt
echo "done"

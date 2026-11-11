#!/usr/bin/env bash
# Used by the ANR probe workflows (runs inside the emulator step). Optional QA_EMAIL/QA_PASSWORD
# (repository secrets) sign in first so the screens after login are exercised too.
set -x
PKG=com.uyoontech.messmanager
UI="python3 .github/anr-ui.py"
mkdir -p out
adb root || true
sleep 3
adb install -r app.apk
adb logcat -c
adb logcat -G 16M || true

sample() { # $1 = label, $2 = count: main-thread stacks every 1 s
  for i in $(seq 1 $2); do
    sleep 1
    P=$(adb shell pidof $PKG | tr -d '\r')
    [ -n "$P" ] && adb shell kill -3 $P
  done
  sleep 2
  adb shell 'cat /data/anr/trace_* 2>/dev/null' > out/traces-$1.txt
  adb shell 'rm -f /data/anr/trace_*' || true
}

adb shell am start -W -n $PKG/.MainActivity | tee out/start.txt
if [ -n "$QA_EXPERIMENT" ]; then
  sample experiment 40
  adb exec-out screencap -p > out/screen-experiment.png
  adb shell dumpsys gfxinfo $PKG > out/gfxinfo-experiment.txt
  adb logcat -d > out/logcat-experiment-full.txt
  grep -E "MMQA" out/logcat-experiment-full.txt > out/experiment-mmqa.txt
  { echo "renders: $(grep -c 'MMQA render' out/experiment-mmqa.txt)"; echo "ad loads: $(grep -c 'MMQA adLoaded' out/experiment-mmqa.txt)"; echo "ad fails: $(grep -c 'MMQA adFailed' out/experiment-mmqa.txt)"; } > out/experiment-result.txt
  grep -E "Skipped [0-9]+ frames|Davey" out/logcat-experiment-full.txt | grep -v systemui > out/experiment-jank.txt
  rm out/logcat-experiment-full.txt
  cat out/experiment-result.txt
  exit 0
fi
sample start 15
adb exec-out screencap -p > out/screen-1-start.png
$UI texts > out/texts-1-start.txt

if [ -n "$QA_EMAIL" ]; then
  $UI tap "Log in"; sleep 3
  $UI type 0 "$QA_EMAIL"; $UI type 1 "$QA_PASSWORD"
  adb shell input keyevent 4; sleep 1
  $UI tap "Log in"
  sample login 25
  adb exec-out screencap -p > out/screen-2-home.png
  $UI texts > out/texts-2-home.txt
  # scroll home, open the first Room
  for i in 1 2 3; do adb shell input swipe 500 1600 500 600 300; sleep 1; done
  for i in 1 2 3; do adb shell input swipe 500 600 500 1600 300; sleep 1; done
  $UI tapfirst "Room" "room" "KWD" "INR" "SAR" "AED"
  sample room 20
  adb exec-out screencap -p > out/screen-3-room.png
  $UI texts > out/texts-3-room.txt
  for i in 1 2 3 4 5; do adb shell input swipe 500 1600 500 500 200; sleep 0.5; done
  sample roomscroll 10
  adb shell input keyevent 4; sleep 2
fi

adb shell dumpsys gfxinfo $PKG > out/gfxinfo-before-monkey.txt
adb shell monkey -p $PKG --pct-syskeys 0 --pct-appswitch 0 --pct-anyevent 0 --throttle 200 -v -s 7 1500 > out/monkey.txt 2>&1
adb shell 'ls -la /data/anr' > out/anr-dir.txt 2>&1
adb shell 'cat /data/anr/anr_* 2>/dev/null' > out/anr-traces.txt 2>&1
adb shell dumpsys gfxinfo $PKG > out/gfxinfo-end.txt
adb exec-out screencap -p > out/screen-9-end.png
adb logcat -d > out/logcat.txt || true
P0=$(grep -m1 -oE "Start proc [0-9]+:$PKG" out/logcat.txt | grep -oE '[0-9]+' | head -1)
grep -nE "ANR in|NOT RESPONDING|Input dispatching timed out|FATAL EXCEPTION|Application Not Responding" out/logcat.txt out/monkey.txt | head -100 > out/summary.txt
grep -E "^\S+ \S+ +$P0 " out/logcat.txt | grep -E "Skipped [0-9]+ frames|Davey|ReactNativeJS|E AndroidRuntime" | head -200 >> out/summary.txt
# keep the log small: only lines from the app process
grep -E "^\S+ \S+ +$P0 |ActivityManager|ANR" out/logcat.txt > out/logcat-app.txt; rm out/logcat.txt
echo done

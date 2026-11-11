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
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
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
  sample experiment 20
  adb shell dumpsys meminfo $PKG > out/experiment-views-welcome.txt
  python3 .github/anr-ui.py tap "Log in"
  sleep 12
  adb shell dumpsys meminfo $PKG > out/experiment-views-login.txt
  { echo "Welcome: $(grep -E 'WebViews' out/experiment-views-welcome.txt | tr -s ' ')"; echo "after opening Log in: $(grep -E 'WebViews' out/experiment-views-login.txt | tr -s ' ')"; } > out/experiment-adviews.txt
  adb exec-out screencap -p > out/screen-experiment.png
  adb shell dumpsys gfxinfo $PKG > out/gfxinfo-experiment.txt
  adb logcat -d > out/logcat-experiment-full.txt
  grep -E "MMQA" out/logcat-experiment-full.txt > out/experiment-mmqa.txt
  { echo "renders: $(grep -c 'MMQA render' out/experiment-mmqa.txt)"; echo "ad loads: $(grep -c 'MMQA adLoaded' out/experiment-mmqa.txt)"; echo "ad fails: $(grep -c 'MMQA adFailed' out/experiment-mmqa.txt)"; } > out/experiment-result.txt
  grep -E "Skipped [0-9]+ frames|Davey" out/logcat-experiment-full.txt | grep -v systemui > out/experiment-jank.txt
  rm out/logcat-experiment-full.txt
  cat out/experiment-adviews.txt >> out/experiment-result.txt
  echo "skipped frames: $(grep -oE 'Skipped [0-9]+' out/experiment-jank.txt | awk '{s+=$2} END {print s+0}')" >> out/experiment-result.txt
  echo "longest frame: $(grep -oE 'duration=[0-9]+' out/experiment-jank.txt | cut -d= -f2 | sort -n | tail -1) ms" >> out/experiment-result.txt
  rm -f out/experiment-views-*.txt
  cat out/experiment-result.txt
  exit 0
fi
sample start 15
adb exec-out screencap -p > out/screen-1-start.png
$UI texts > out/texts-1-start.txt

if [ -n "$QA_EMAIL" ]; then
  taps() { for k in $(seq 1 $1); do adb shell input tap 540 1200; sleep 0.4; done; }  # a person tapping while it loads
  $UI tap "Log in"; sleep 3
  $UI type 0 "$QA_EMAIL"; $UI type 1 "$QA_PASSWORD"
  adb shell input keyevent 4; sleep 1
  adb logcat -c
  date +%s > out/t-signin.txt
  $UI tap "Log in"
  sleep 4; taps 10
  sample home 15
  adb exec-out screencap -p > out/screen-2-home.png
  $UI texts > out/texts-2-home.txt
  for i in 1 2 3; do adb shell input swipe 540 1600 540 600 300; sleep 1; done
  for i in 1 2 3; do adb shell input swipe 540 600 540 1600 300; sleep 1; done
  $UI tapfirst "QA Room"
  sleep 1; taps 10
  sample room 15
  adb exec-out screencap -p > out/screen-3-room.png
  $UI texts > out/texts-3-room.txt
  for i in 1 2 3 4 5; do adb shell input swipe 540 1600 540 500 200; sleep 0.5; done
  for i in 1 2 3 4 5; do adb shell input swipe 540 500 540 1600 200; sleep 0.5; done
  $UI tap "Need Requests"
  sleep 1; taps 8
  sample needs 15
  adb exec-out screencap -p > out/screen-4-needs.png
  adb shell dumpsys meminfo $PKG | grep -E "WebViews|Views:" > out/views-deep-stack.txt
  # stay on the deepest screen: the screens underneath must not keep their banners busy
  sample idle 40
  adb shell input keyevent 4; sleep 3; adb shell input keyevent 4; sleep 3
  $UI tap "Inbox"; sleep 1; taps 8
  sample inbox 12
  adb shell input keyevent 4; sleep 3
  adb logcat -d > out/logcat-signedin.txt
  P1=$(adb shell pidof $PKG | tr -d '\r')
  {
    echo "app process alive: $([ -n "$P1" ] && echo yes || echo NO)"
    echo "ANR: $(grep -cE "ANR in $PKG|Input dispatching timed out" out/logcat-signedin.txt)"
    echo "banner loads: $(grep -c 'MMQA adLoaded' out/logcat-signedin.txt)  ($(grep -oE 'MMQA adLoaded \w+' out/logcat-signedin.txt | awk '{print $3}' | sort | uniq -c | tr -s ' ' | tr '\n' ','))"
    echo "skipped frames (app): $(grep -E " $P1 .*Skipped [0-9]+ frames" out/logcat-signedin.txt | grep -oE 'Skipped [0-9]+' | awk '{s+=$2} END {print s+0}')"
    echo "frames over 700 ms: $(grep -E " $P1 .*Davey" out/logcat-signedin.txt | grep -oE 'duration=[0-9]+' | cut -d= -f2 | awk '$1>700' | wc -l)"
    echo "longest frame: $(grep -E " $P1 .*Davey" out/logcat-signedin.txt | grep -oE 'duration=[0-9]+' | cut -d= -f2 | sort -n | tail -1) ms"
    echo "busy main-thread samples: home $(python3 .github/anr-busy.py out/traces-home.txt), room $(python3 .github/anr-busy.py out/traces-room.txt), needs $(python3 .github/anr-busy.py out/traces-needs.txt), idle on needs $(python3 .github/anr-busy.py out/traces-idle.txt), inbox $(python3 .github/anr-busy.py out/traces-inbox.txt)"
    echo "live WebViews on Need Requests: $(cat out/views-deep-stack.txt | tr -s ' ' | tr '\n' ' ')"
  } > out/signedin-result.txt
  grep -E " $P1 .*(Davey|Skipped|MMQA|ReactNativeJS)" out/logcat-signedin.txt | cut -c1-220 > out/signedin-jank.txt
  rm out/logcat-signedin.txt
  cat out/signedin-result.txt
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

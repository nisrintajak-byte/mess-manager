/* global require, module, process, __dirname */
const { chromium } = require('playwright');
const fs = require('fs');
const C = require('./captions.json');
const path = require('path');
const NM = path.join(__dirname, '../../node_modules/@expo-google-fonts');
const order = ['1home', '2room', '3add', '4settle', '5proof', '6history', '7needs'];
const OUT = process.argv[2] || path.join(__dirname, '../../docs/store/screenshots');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const lang of Object.keys(C)) {
    fs.mkdirSync(`${OUT}/${lang}`, { recursive: true });
    const rtl = lang === 'ar' || lang === 'ur';
    const font =
      lang === 'ur'
        ? "'Nastaliq'"
        : lang === 'hi'
          ? "'Deva', Inter"
          : lang === 'ar'
            ? "'Noto Sans Arabic','Noto Naskh Arabic',sans-serif"
            : 'Inter';
    for (let i = 0; i < order.length; i++) {
      const [h, sub] = C[lang][i];
      const html = `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
  @font-face{font-family:Nastaliq;src:url(file://${NM}/noto-nastaliq-urdu/700Bold/NotoNastaliqUrdu_700Bold.ttf);font-weight:700}
  @font-face{font-family:Nastaliq;src:url(file://${NM}/noto-nastaliq-urdu/400Regular/NotoNastaliqUrdu_400Regular.ttf);font-weight:400}
  @font-face{font-family:Deva;src:url(file://${NM}/noto-sans-devanagari/800ExtraBold/NotoSansDevanagari_800ExtraBold.ttf);font-weight:800}
  @font-face{font-family:Deva;src:url(file://${NM}/noto-sans-devanagari/500Medium/NotoSansDevanagari_500Medium.ttf);font-weight:500}
  html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
  body{background:radial-gradient(circle at 85% 8%,rgba(94,234,212,.18),transparent 38%),linear-gradient(165deg,#0F3550 0%,#0A2233 55%,#061826 100%);font-family:${font};color:#fff;position:relative}
  .top{position:absolute;top:${lang === 'ur' ? 40 : 80}px;left:80px;right:80px;text-align:center}
  h1{margin:0;font-size:${lang === 'ur' ? 56 : 68}px;line-height:${lang === 'ur' ? 1.7 : 1.15};font-weight:800;letter-spacing:${rtl || lang === 'hi' ? 0 : -1}px}
  .bar{width:120px;height:10px;border-radius:5px;margin:${lang === 'ur' ? 14 : 30}px auto ${lang === 'ur' ? 10 : 26}px;background:linear-gradient(90deg,#FFE08A,#F59E0B)}
  p{margin:0;font-size:${lang === 'ur' ? 32 : 38}px;line-height:${lang === 'ur' ? 1.85 : 1.35};color:#B9E9E2;font-weight:${lang === 'ur' ? 400 : 500}}
  .phone{position:absolute;left:50%;transform:translateX(-50%);bottom:-60px;width:750px;height:1500px;border-radius:64px;background:#03101a;padding:18px;box-sizing:border-box;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 3px rgba(94,234,212,.35)}
  .phone img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:48px;display:block}
  </style></head><body>
  <div class="top"><h1>${h}</h1><div class="bar"></div><p>${sub}</p></div>
  <div class="phone"><img src="file://${__dirname}/raw/${lang}-${order[i]}.png"></div>
  </body></html>`;
      fs.writeFileSync(`${__dirname}/raw/frame.html`, html);
      await pg.goto(`file://${__dirname}/raw/frame.html`);
      await pg.waitForTimeout(400);
      await pg.screenshot({
        path: `${OUT}/${lang}/${String(i + 1).padStart(2, '0')}-${order[i].slice(1)}.jpg`,
        type: 'jpeg',
        quality: 90,
      });
    }
  }
  await b.close();
})();

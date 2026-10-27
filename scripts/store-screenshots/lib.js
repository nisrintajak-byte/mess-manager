/* global require, module, process, __dirname */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { build, handle } = require('./mock');
const ROOT = process.env.WEB_DIST || path.join(__dirname, 'web-dist');
function serve(port) {
  return http
    .createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/mess-manager/, '');
      let f = path.join(ROOT, p);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
      const ext = path.extname(f);
      res.writeHead(200, {
        'content-type':
          {
            '.js': 'text/javascript',
            '.html': 'text/html',
            '.ttf': 'font/ttf',
            '.png': 'image/png',
            '.css': 'text/css',
          }[ext] || 'application/octet-stream',
      });
      fs.createReadStream(f).pipe(res);
    })
    .listen(port);
}
async function openApp(browser, lang, opts = {}) {
  const db = build(lang);
  const user = {
    id: 'u1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'asha@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: { display_name: db.tables.profiles[0].display_name },
    app_metadata: {},
  };
  db.user = user;
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    locale: lang,
    timezoneId: 'Asia/Kolkata',
  });
  await ctx.clock?.setFixedTime?.(new Date('2026-10-27T15:20:00+05:30'));
  const pg = await ctx.newPage();
  const now = Math.floor(new Date('2026-10-27T10:00:00Z').getTime() / 1000);
  await pg.addInitScript(
    ([s, lang]) => {
      localStorage.setItem('sb-egylgjgimuytmnmrvzhs-auth-token', s);
      localStorage.setItem('mm.lang', lang);
      localStorage.setItem('mm.tourSeen', '1');
      localStorage.setItem('mm.setupHidden', '1');
      localStorage.setItem('mm.firstExpense', '1');
    },
    [
      JSON.stringify({
        access_token: 'x.y.z',
        refresh_token: 'r',
        token_type: 'bearer',
        expires_in: 3600000,
        expires_at: now + 3600000,
        user,
      }),
      lang,
    ],
  );
  await pg.route(/supabase\.co/, (r) => handle(r, db, opts.log));
  pg.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));
  await pg.goto('http://localhost:8099/mess-manager/');
  await pg.waitForTimeout(3500);
  return { pg, ctx, db };
}
module.exports = { serve, openApp, chromium };

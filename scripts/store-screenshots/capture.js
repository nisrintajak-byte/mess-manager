/* global require, module, process, __dirname */
const { serve, openApp, chromium } = require('./lib');
const { L } = require('./mock');
const lang = process.argv[2] || 'en';
const T = require(`../../src/i18n/locales/${lang}.json`);
const t = (k) => k.split('.').reduce((o, x) => o[x], T);
(async () => {
  const s = serve(8099);
  const b = await chromium.launch();
  const { pg, db } = await openApp(b, lang, { log: console.log });
  await pg.setViewportSize({ width: 360, height: 720 });
  await pg.waitForTimeout(800);
  const vis = (txt, exact = true) => pg.getByText(txt, { exact }).filter({ visible: true });
  require('fs').mkdirSync(__dirname + '/raw', { recursive: true });
  const shot = async (n) => {
    await pg.waitForTimeout(1300);
    await pg.screenshot({ path: `${__dirname}/raw/${lang}-${n}.png` });
  };
  const wheel = async (dy) => {
    await pg.mouse.move(180, 420);
    await pg.mouse.wheel(0, dy);
    await pg.waitForTimeout(800);
  };
  const back = async () => {
    await pg.goBack();
    await pg.waitForTimeout(1300);
  };
  const into = async (loc) => {
    await loc.first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await pg.waitForTimeout(800);
  };
  await shot('1home');
  await vis(db.tables.rooms[0].name).first().click();
  await pg.waitForTimeout(1500);
  await wheel(330);
  await shot('2room');
  await wheel(-2000);
  await vis(t('settlement.list')).first().click();
  await pg.waitForTimeout(800);
  await vis('2026-09-01', false).last().click();
  await pg.waitForTimeout(1000);
  await wheel(250);
  await shot('4settle');
  await into(vis('TXN 48211907', false));
  await wheel(-160);
  await shot('5proof');
  await back();
  await vis(t('room.tabExpenses')).first().click();
  await pg.waitForTimeout(800);
  await vis(db.tables.expenses[0].title).first().click();
  await pg.waitForTimeout(1200);
  await into(vis(t('expense.history')));
  await wheel(-60);
  await shot('6history');
  await back();
  await vis(t('room.addExpense')).last().click();
  await pg.waitForTimeout(1200);
  const inputs = pg.locator('input:visible');
  await inputs.nth(0).fill(L[lang].needs[2][0]);
  const big = L[lang].f >= 50;
  await inputs
    .nth(1)
    .fill(
      big
        ? String(Math.round((9.6 * L[lang].f) / 10) * 10)
        : String(L[lang].f === 1 ? '9.60' : Math.round(9.6 * L[lang].f)),
    );
  await pg.mouse.click(180, 700);
  await shot('3add');
  await back();
  await vis(t('need.title'), false).first().click();
  await pg.waitForTimeout(1000);
  await wheel(330);
  await shot('7needs');
  await b.close();
  s.close();
})();

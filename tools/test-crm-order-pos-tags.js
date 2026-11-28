// Test gắn thẻ Pos ô "NV chăm sóc" + "Marketer" (js/99-f-crm-order-pos-tags.js) trên Chromium thật. Chạy: node tools/test-crm-order-pos-tags.js (cần playwright)
const path = require('path'), { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
(async () => {
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 1200, height: 900 } }), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.setContent('<meta charset="utf-8"><style>:root{--border:#ddd;--muted:#666}body{font-family:sans-serif}</style><div id="tab-taodon"><div id="xt-wrap-taodon"></div></div>');
  await pg.evaluate(() => {
    window.gsUrl = 'https://gs/exec'; window.currentUser = { name: 'Admin' }; window.registerExtraTab = () => {}; window.toasts = []; window.toast = m => toasts.push(m);
    window.SALE_PERSON_TAGS = { 'Thu Thủy': ['thuthuy95'] };
    window.fetch = async u => ({ json: async () => /salesReportOptions/.test(u) ? { saleB: ['dungnguyen1995', 'bichnguyen1993', 'anhNP1999'], marketer: ['Mkt Hà', 'Mkt Lan'] } : {} });
  });
  for (const f of ['js/99-d-crm-order.js', 'js/99-f-crm-order-pos-tags.js']) await pg.addScriptTag({ path: path.join(root, f) });
  await pg.evaluate(() => _coRender());
  const val = k => pg.evaluate(k => _co[k], k);
  await pg.click('#co-f-careName');
  await pg.waitForSelector('#co-taglist-careName >> text=dungnguyen1995');
  ok(!(await pg.textContent('#co-taglist-careName')).includes('Mkt Hà'), 'ô chăm sóc không gợi ý tên marketer');
  await pg.fill('#co-f-careName', 'dung'); await pg.press('#co-f-careName', 'Enter');
  ok(await val('careName') === 'dungnguyen1995', 'gõ + Enter gắn thẻ khớp');
  await pg.fill('#co-f-careName', 'bich'); await pg.click('#co-taglist-careName >> text=bichnguyen1993');
  ok(await val('careName') === 'dungnguyen1995, bichnguyen1993', 'bấm gợi ý gắn thẻ thứ 2');
  await pg.click('[aria-label="Gỡ thẻ dungnguyen1995"]');
  ok(await val('careName') === 'bichnguyen1993', '✕ gỡ thẻ');
  await pg.click('#co-f-marketer');
  ok((await pg.textContent('#co-taglist-marketer')).indexOf('Mkt Hà') === 0, 'ô marketer đưa tên marketer lên trước');
  await pg.fill('#co-f-marketer', 'mkt ha'); await pg.press('#co-f-marketer', 'Enter');
  await pg.fill('#co-f-marketer', 'người mới'); await pg.click('#co-f-note');
  ok(await val('marketer') === 'Mkt Hà, người mới', 'tìm không dấu + gõ tay rồi rời ô vẫn lưu');
  const P = await pg.evaluate(() => _coPayload(_co));
  ok(P.careName === 'bichnguyen1993' && P.marketer === 'Mkt Hà, người mới', 'payload gửi đúng chuỗi');
  await pg.evaluate(() => _coRender());
  ok(await pg.locator('#co-tags-marketer > span').count() === 2, 'vẽ lại form vẫn còn thẻ');
  await pg.fill('#co-f-marketer', 'x'.repeat(100));
  ok((await val('marketer')).length <= 80, 'không vượt 80 ký tự');
  await pg.fill('#co-f-marketer', '');
  await pg.evaluate(() => { _co = _coBlank(); _coRender(); });
  ok(await pg.locator('#co-tags-marketer > span').count() === 0, 'đơn mới xoá thẻ cũ');
  if (process.env.SHOT) {
    await pg.evaluate(() => { _co.careName = 'bichnguyen1993, anhNP1999'; _coRender(); });
    await pg.click('#co-f-marketer');
    await pg.locator('#co-f-note').scrollIntoViewIfNeeded();
    await pg.screenshot({ path: process.env.SHOT });
  }
  ok(!errs.length, 'không lỗi JS ' + errs.join('; '));
  await br.close();
})();

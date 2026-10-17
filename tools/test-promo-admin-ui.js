// Smoke test màn admin khuyến mãi (cần jsdom). node tools/test-promo-admin-ui.js
const fs = require('fs'), assert = require('assert');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: không có jsdom'); process.exit(0); }
const dom = new JSDOM('<body><div id="toast"></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window; let saved = null;
w.eval('var gsUrl="http://x/exec"; function esc(s){return String(s==null?"":s).replace(/[&<>"\']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c];});} function toast(){}');
w.fetch = async (u, o) => { if (o && o.body) { saved = JSON.parse(o.body); return { json: async () => ({ ok: true }) }; } return { json: async () => ({ values: {} }) }; };
w.confirm = () => true;
for (const f of ['53-fn-promo-engine.js', '54-fn-promo-admin.js']) w.eval(fs.readFileSync(__dirname + '/../js/' + f, 'utf8'));
(async () => {
  w.window._promoCfgCur = [];
  w.openPromoConfig();
  const d = w.document, $ = (s) => d.querySelector(s);
  $('#promo-add').click();
  $('#pf-name').value = 'Giảm 10%'; $('#pf-type').value = 'percent'; $('#pf-type').dispatchEvent(new w.Event('change')); $('#pf-value').value = '10'; $('#pf-save').click();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(saved && saved.key === 'promoConfig', 'phải gọi setSetting promoConfig');
  const v = JSON.parse(saved.value); assert.strictEqual(v.promos.length, 1); assert.strictEqual(v.promos[0].value, 10); assert.strictEqual(v.promos[0].stackable, false);
  $('#promo-t-run').click();
  assert.ok($('#promo-t-out').textContent.includes('Giá cuối'), 'thử tính phải hiện kết quả');
  assert.ok($('#promo-t-out').textContent.includes('Giảm 10%'));
  $('#promo-add').click(); $('#pf-name').value = ''; $('#pf-save').click();
  assert.ok($('#promo-st').textContent.includes('Chưa hợp lệ'));
  console.log('OK: màn admin khuyến mãi (thêm → lưu setSetting → thử tính → báo lỗi nhập sai)');
})().catch(e => { console.error(e); process.exit(1); });

#!/usr/bin/env node
// SMOKE TEST (jsdom): nap NGUYEN extension-zalo/zalo-content.js voi chrome/fetch gia, kiem tra panel dung len khong loi, cac muc menu moi (quy tac song song)
// va vung gio hang hoat dong. Bat loi kieu "bien khong ton tai luc chay" ma node -c khong thay. CAN: npm i jsdom (thieu thi bo qua).
// Chay: node tools/test-zalo-smoke.js -> "ZALO SMOKE OK".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { url: 'https://chat.zalo.me/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, errs = [], store = { ome_gas_url: 'https://script.google.com/macros/s/X/exec' }, noop = () => {};
w.chrome = { runtime: { onMessage: { addListener: noop }, sendMessage: noop, getURL: x => x, lastError: null }, storage: { local: { get: (k, cb) => { const o = {}; (Array.isArray(k) ? k : (k === null ? Object.keys(store) : [k])).forEach(x => { if (store[x] !== undefined) o[x] = store[x]; }); if (cb) cb(o); return Promise.resolve(o); }, set: (o, cb) => { Object.assign(store, o); if (cb) cb(); return Promise.resolve(); }, remove: noop }, onChanged: { addListener: noop } } };
w.fetch = async () => ({ json: async () => ({}), text: async () => '' });
w.addEventListener('error', e => errs.push('ERR ' + e.message));
w.console.error = (...a) => errs.push('console.error ' + a.join(' '));
process.on('unhandledRejection', e => errs.push('REJ ' + (e && e.message)));
try { w.eval(src); } catch (e) { errs.push('EVAL ' + e.message); }
const fail = m => { console.error('FAIL: ' + m + (errs.length ? '\n' + errs.slice(0, 5).join('\n') : '')); process.exit(1); };
setTimeout(() => {
  const d = w.document, byId = id => d.getElementById(id);
  if (!d.querySelector('[id*=zai-panel]')) fail('panel khong dung len');
  for (const id of ['zai-cart-section', 'zai-cart-add-manual', 'zai-ctkm-body', 'zai-stats-body', 'zai-img-body', 'zai-tpl-body', 'zai-price-ai-btn', 'zai-cart-gold-label', 'zai-price-mode-tabs', 'zai-price-search-mode', 'zai-price-builder-mode', 'zai-builder-steps', 'zai-stone-row']) if (!byId(id)) fail('thieu #' + id);
  const opts = [...byId('zai-ctkm-body').parentElement.parentElement.querySelectorAll('select option')].map(o => o.value);
  for (const v of ['ctkm', 'img', 'tpl', 'stats']) if (!opts.includes(v)) fail('thieu muc menu ' + v + ' (co: ' + opts + ')');
  if (byId('zai-cart-section').style.display !== 'none') fail('gio hang phai AN cho toi khi dung');
  byId('zai-price-mode-tabs').querySelectorAll('button')[1].click();   // mo "Soan don (chon tung buoc)"
  if (byId('zai-price-builder-mode').style.display === 'none' || byId('zai-price-search-mode').style.display !== 'none') fail('tab Soan don khong chuyen che do');
  byId('zai-cart-add-manual').click();
  setTimeout(() => {
    if (d.querySelectorAll('.zai-cart-row').length !== 1) fail('Them dong thu cong khong tao dong');
    if (errs.length) fail('co loi luc chay');
    console.log('ZALO SMOKE OK'); process.exit(0);
  }, 100);
}, 600);

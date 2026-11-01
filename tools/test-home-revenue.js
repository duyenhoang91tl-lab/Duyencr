#!/usr/bin/env node
// Test (jsdom): the "Doanh thu Pos" o Tong quan phai la TONG cua Bao cao B (toan cong ty) — khong lay so theo nguoi c.revenue (co the = 0).
// CAN: npm i jsdom (thieu thi tu bo qua).  node tools/test-home-revenue.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '42-fn-homesummary.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function boot(opts) {
  const dom = new JSDOM('<!doctype html><body><div id="hs-summary"></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window, reqs = [];
  w.gsUrl = 'https://gas.test/exec';
  w.esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  w._ovMoney = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' tỷ' : Math.round(n) + 'đ');
  w._ovN = (s) => String(s || '').toLowerCase();
  w.eval("var _ov = { data: { from: '2026-10-01', to: '2026-10-16', days: 16 }, dept: '" + (opts.dept || '') + "', team: '', q: '' };");
  w._ovScope = () => ({ mode: 'all', people: [{ name: 'A' }, { name: 'B' }] });
  w._ovFilteredPeople = (s) => s.people;
  w._ovAgg = () => ({ revenue: 0, orders: 0, tyLeChot: 1.2 });          // so theo nguoi cua Tong quan = 0 (dung loi nguoi dung gap)
  w.fetch = async (url) => {
    reqs.push(url);
    if (/salesReportB/.test(url)) { if (opts.fail) throw new Error('net'); return { json: async () => ({ totalGiaTri: 5236000000, totalOrders: 589, byNguon: [{ name: 'Quầy', giaTri: 2220000000, orders: 300 }] }) }; }
    return { json: async () => ({ stages: [] }) };
  };
  w.eval(code);
  return { w, d: w.document, reqs };
}
(async () => {
  let t = boot({}); t.w.hsRender(); ok(/đang tải/.test(t.d.getElementById('hs-summary').textContent), 'luc dau hien dang tai (khong hien 0d)');
  await sleep(30); let txt = t.d.getElementById('hs-summary').textContent;
  ok(/Doanh thu Pos/.test(txt) && /5\.24 tỷ/.test(txt) && /589 đơn · toàn công ty/.test(txt), 'The Doanh thu Pos = tong Bao cao B toan cong ty: ' + txt.slice(0, 400));
  ok(!/Doanh thu Pos\s*0đ/.test(txt), 'khong con hien 0d');
  // Co loc Phong/Team -> ghi ro "theo bo loc"
  t = boot({ dept: 'D1' }); t.w.eval("_ovScope = function(){ return { mode: 'dept', people: [{ name: 'A' }] }; }"); t.w.hsRender(); await sleep(30);
  ok(/589 đơn · theo bộ lọc/.test(t.d.getElementById('hs-summary').textContent), 'co bo loc: ghi theo bo loc');
  ok(t.reqs.some((u) => /salesReportB.*sale=A/.test(u)), 'co loc: gui sale= theo nguoi duoc loc');
  // Bao cao B loi -> khong hien so sai
  t = boot({ fail: true }); t.w.hsRender(); await sleep(30); txt = t.d.getElementById('hs-summary').textContent;
  ok(/không tải được Báo cáo B/.test(txt) && !/Doanh thu Pos\s*0đ/.test(txt), 'loi tai B: bao khong tai duoc, khong hien 0d');
  console.log('ALL HOME REVENUE TESTS PASSED');
})().catch((e) => { console.error('FAIL (exception):', e); process.exit(1); });

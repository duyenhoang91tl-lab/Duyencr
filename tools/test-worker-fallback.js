#!/usr/bin/env node
// Test (jsdom): GET doc-du-lieu qua Worker gap 502/404/loi mang -> tu goi lai THANG Apps Script; POST/action ghi KHONG thu lai; Worker tot thi khong dong.
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '59-conn-diag.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const WORKER = 'https://cache.test', DIRECT = 'https://script.google.test/exec';
function boot(net) {
  const dom = new JSDOM('<!doctype html><body><div id="data-view"></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window, calls = [];
  w.eval("var gsUrl='" + WORKER + "'; var WORKER_URL='" + WORKER + "'; var GAS_URL_DIRECT='" + DIRECT + "'; var allCustomers=[]; var customerMap={};");
  w.toast = (m) => { (w.__t = w.__t || []).push(m); };
  w.fetch = async (url) => { calls.push(url); const r = net(url); if (r === 'abort') throw new Error('net::ERR'); return { ok: r === 200, status: r, headers: { get: () => '' }, text: async () => '{}' }; };
  try { w.eval(code); } catch (e) { /* phan giao dien cua file co the thieu hamtro: bo qua */ }
  return { w, calls };
}
(async () => {
  let t = boot(u => u.indexOf(WORKER) === 0 ? 502 : 200);
  let r = await t.w.fetch(WORKER + '?action=orders&src=web');
  ok(r.status === 200 && t.calls[1] === DIRECT + '?action=orders&src=web', 'Worker 502 -> goi lai THANG Apps Script, nhan 200');
  ok(t.w.eval('gsUrl') === DIRECT && (t.w.__t || []).length === 1, 'doi sang Apps Script cho ca phien + bao 1 lan');
  t = boot(u => u.indexOf(WORKER) === 0 ? 404 : 200);
  r = await t.w.fetch(WORKER + '?action=donPhones&token=X'); ok(r.status === 200, 'Worker 404 -> thu lai thang, 200');
  t = boot(u => u.indexOf(WORKER) === 0 ? 'abort' : 200);
  r = await t.w.fetch(WORKER + '?action=customers'); ok(r.status === 200, 'loi mang Worker -> thu lai thang, 200');
  t = boot(() => 502);
  r = await t.w.fetch(WORKER + '?action=orders'); ok(r.status === 502 && t.w.eval('gsUrl') === WORKER, 'ca hai deu loi -> tra loi goc va giu Worker (khong ket o Apps Script)');
  t = boot(() => 502);
  await t.w.fetch(WORKER + '?action=saveSingle'); ok(t.calls.length === 1, 'action ghi (saveSingle) KHONG thu lai');
  t = boot(() => 502);
  await t.w.fetch(WORKER, { method: 'POST', body: '{}' }); ok(t.calls.length === 1, 'POST KHONG thu lai');
  t = boot(() => 200);
  await t.w.fetch(WORKER + '?action=orders'); ok(t.calls.length === 1 && t.w.eval('gsUrl') === WORKER, 'Worker tot -> khong dong gi');
  process.exit(fails ? 1 : 0);
})();

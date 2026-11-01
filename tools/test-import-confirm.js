#!/usr/bin/env node
// Test: nhap file KHONG dung confirm() cua trinh duyet (bi tu dong Huy) — hop xac nhan trong trang + tu thu lai xem truoc khi 502/524 + thong bao loi theo giai doan.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\('); const m = re.exec(js); if (!m) throw new Error('khong thay ham ' + name);
  let d = 0, k = js.indexOf('{', m.index); for (let j = k; j < js.length; j++) { if (js[j] === '{') d++; else if (js[j] === '}' && --d === 0) return js.slice(m.index, j + 1); } }
const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
const w = dom.window;
const toasts = [], fetchLog = []; let nativeConfirm = 0, fetchPlan = [];
const ctx = vm.createContext({ console, JSON, Date, Number, String, Object, Array, Math, Promise, document: w.document, window: w,
  setTimeout: (f, ms) => { ctx.__waits.push(ms); return setTimeout(f, 0); }, __waits: [],
  fmt: (n) => String(n), esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  toast: (m) => toasts.push(m), confirm: () => { nativeConfirm++; return false; }, logAudit() {}, localStorage: { getItem: () => 'TOK' },
  gsUrl: 'https://worker/', GAS_URL_DIRECT: 'https://gas/exec', _srState: {}, _impRender_() {},
  _impState: { baseRows: [['x']], baseFileName: 'b.xls', baseWarn: '', posRows: null, uploading: false, result: null }, _impHist: { items: [] }, _impTok_: () => 'TOK',
  fetch: async (u, o) => { fetchLog.push({ u, body: o && o.body ? JSON.parse(o.body) : null }); const p = fetchPlan.shift(); if (p instanceof Error) throw p;
    return { status: p.status || 200, text: async () => (typeof p.body === 'string' ? p.body : JSON.stringify(p.body)) }; } });
vm.runInContext(['_impJson_', '_impAsk_', '_impPost_', '_impUpload'].map(fnSrc).join('\n'), ctx);
const tick = () => new Promise((r) => setTimeout(r, 5));
(async () => {
  // ---- _impAsk_ ----
  let p = ctx._impAsk_('Tieu de <b>', 'Se THEM 2.000 dong\nDa co 0', 'Nhap');
  await tick();
  const ov = w.document.getElementById('imp-ask-ov');
  ok(!!ov && /Se THEM 2\.000 dong/.test(ov.textContent) && ov.textContent.indexOf('<b>') > -1 && ov.innerHTML.indexOf('<b>') === -1, 'hop xac nhan hien trong trang, noi dung escape, giu xuong dong');
  ok(nativeConfirm === 0, 'KHONG goi confirm() cua trinh duyet');
  ov.querySelector('button[data-v="1"]').click(); ok((await p) === true && !w.document.getElementById('imp-ask-ov'), 'bam Nhap -> true, hop bi go');
  p = ctx._impAsk_('t', 'b', 'Nhap'); await tick(); w.document.querySelector('#imp-ask-ov button[data-v="0"]').click(); ok((await p) === false, 'bam Huy -> false');
  p = ctx._impAsk_('t', 'b', 'Nhap'); await tick(); w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' })); ok((await p) === false && !w.document.getElementById('imp-ask-ov'), 'Esc -> huy');
  p = ctx._impAsk_('t', 'b', 'Nhap'); await tick(); w.document.querySelector('#imp-ask-ov div div').click(); await tick();
  ok(!!w.document.getElementById('imp-ask-ov'), 'bam vao noi dung hop KHONG dong hop (chi 2 nut moi quyet dinh)'); w.document.querySelector('#imp-ask-ov button[data-v="0"]').click(); await p;

  // ---- _impJson_ ----
  let e1; try { await ctx._impJson_({ status: 502, text: async () => '<html><h1>502 Server Error</h1></html>' }, 'preview'); } catch (e) { e1 = e; }
  ok(e1 && /HTTP 502: 502 Server Error/.test(e1.message) && /chưa ghi gì với bước xem trước/.test(e1.message), 'xem truoc loi 502: hien ma HTTP + "chua ghi gi"');
  let e2; try { await ctx._impJson_({ status: 524, text: async () => 'error code: 524' }, 'write'); } catch (e) { e2 = e; }
  ok(e2 && /HTTP 524/.test(e2.message) && /có thể máy chủ đã ghi/.test(e2.message) && !/chưa ghi gì/.test(e2.message), 'GHI THAT loi: canh bao CO THE DA GHI, khong noi "chua ghi gi" (sai su that)');
  ok((await ctx._impJson_({ status: 200, text: async () => '{"ok":true}' })).ok === true, 'JSON hop le tra binh thuong');

  // ---- _impPost_ retry ----
  fetchLog.length = 0; ctx.__waits.length = 0;
  fetchPlan = [{ status: 502, body: '<h1>502</h1>' }, new Error('Failed to fetch'), { body: { ok: true, dryRun: true } }];
  let r = await ctx._impPost_('u', { a: 1 }, 'preview', 2);
  ok(r.dryRun && fetchLog.length === 3 && ctx.__waits.join() === '2500,5000', 'xem truoc: 502 + loi mang -> tu thu lai, lan 3 thanh cong (doi 2,5s roi 5s)');
  fetchLog.length = 0; fetchPlan = [{ status: 502, body: '<h1>502</h1>' }];
  let e3; try { await ctx._impPost_('u', {}, 'write', 0); } catch (e) { e3 = e; }
  ok(e3 && fetchLog.length === 1, 'GHI THAT: KHONG tu thu lai (chi 1 lan goi)');
  fetchLog.length = 0; fetchPlan = [{ status: 502, body: 'x' }, { status: 502, body: 'x' }, { status: 502, body: 'x' }];
  let e4; try { await ctx._impPost_('u', {}, 'preview', 2); } catch (e) { e4 = e; }
  ok(e4 && fetchLog.length === 3 && /HTTP 502/.test(e4.message), 'xem truoc loi ca 3 lan -> bao loi (khong lap vo han)');

  // ---- _impUpload ----
  const pv = { dryRun: true, wouldWrite: 2000, skippedExisting: 0, wouldUpdateRows: 0, wouldUpdateCells: 0, skippedDupInFile: 0 };
  // a) bam Huy tren hop trong trang -> thong bao co so lieu xem truoc, khong ghi
  fetchLog.length = 0; toasts.length = 0; fetchPlan = [{ body: pv }]; ctx._impState.uploading = false;
  let up = ctx._impUpload('base'); await tick(); await tick();
  const ov2 = w.document.getElementById('imp-ask-ov');
  ok(!!ov2 && /THÊM 2000 dòng MỚI/.test(ov2.textContent) && /Tiếp tục nhập\?/.test(ov2.textContent) && /NHẬP DỮ LIỆU Base/.test(ov2.textContent), 'nhap file: hop xac nhan in-page co so lieu xem truoc (them 2000 dong)');
  ov2.querySelector('button[data-v="0"]').click(); await up;
  ok(fetchLog.length === 1 && fetchLog[0].body.dryRun === true && toasts.some((t) => /Đã hủy — chưa ghi gì\. \(Xem trước: thêm 2000 dòng mới, 0 đơn đã có\.\)/.test(t)) && nativeConfirm === 0, 'Huy: chi goi xem truoc, KHONG ghi; thong bao kem so lieu xem truoc; khong dung confirm()');
  ok(ctx._impState.uploading === false, 'het trang thai uploading');
  // b) dong y -> goi that
  fetchLog.length = 0; toasts.length = 0; ctx._impState.baseRows = [['x']]; fetchPlan = [{ body: pv }, { body: { ok: true, written: 2000, skippedExisting: 0, batchId: 'imp_1' } }];
  up = ctx._impUpload('base'); await tick(); await tick(); w.document.querySelector('#imp-ask-ov button[data-v="1"]').click(); await up;
  ok(fetchLog.length === 2 && fetchLog[1].body.dryRun === undefined && fetchLog[1].body.action === 'importSheetRows' && fetchLog[1].body.token === 'TOK' && toasts.some((t) => /Đã nhập 2000 dòng mới/.test(t)), 'Dong y: goi GHI THAT 1 lan (co token), bao da nhap');
  // c) chay khi tab o nen (modal khong bi tu dong huy): khong co phan hoi nguoi dung -> van cho
  fetchLog.length = 0; toasts.length = 0; ctx._impState.baseRows = [['x']]; fetchPlan = [{ body: pv }];
  up = ctx._impUpload('base'); await tick(); await tick(); await tick();
  ok(!!w.document.getElementById('imp-ask-ov') && !toasts.some((t) => /Đã hủy/.test(t)) && fetchLog.length === 1, 'chua ai bam gi: hop van cho, KHONG tu "Da huy" (khac confirm() bi chan)');
  w.document.querySelector('#imp-ask-ov button[data-v="0"]').click(); await up;
  // d) khong con dong moi
  fetchLog.length = 0; toasts.length = 0; ctx._impState.baseRows = [['x']]; fetchPlan = [{ body: { dryRun: true, wouldWrite: 0, skippedExisting: 2000, wouldUpdateRows: 0 } }];
  await ctx._impUpload('base'); ok(!w.document.getElementById('imp-ask-ov') && toasts.some((t) => /đều ĐÃ CÓ/.test(t)) && fetchLog.length === 1, 'tat ca da co: khong hoi, khong ghi');
  // ---- index.html ----
  ok(/if \(!t \|\| !t\.parentNode \|\| t\.closest\('\.table-scroll'\)\) return;/.test(idx), 'index.html: wrapTable bo qua bang da bi go khoi DOM (het loi insertBefore null)');
  ok(!/if \(!confirm\('NHẬP DỮ LIỆU/.test(js), 'js/11 khong con confirm() cho viec nhap file');
  console.log(fail ? '\nFAILED ' + fail : '\nALL IMPORT-CONFIRM TESTS PASSED'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('LOI', e && e.stack || e); process.exit(1); });

#!/usr/bin/env node
// Test giao dien: "Lich su nhap" + nut Hoan tac trong tab nhap file (js/11-fn-srload.js). Chay ham THAT voi fetch/confirm/toast gia.
const fs = require('fs'), vm = require('vm'), path = require('path');
const js = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\('); const m = re.exec(js); if (!m) throw new Error('khong thay ham ' + name);
  let d = 0, k = js.indexOf('{', m.index); for (let j = k; j < js.length; j++) { if (js[j] === '{') d++; else if (js[j] === '}' && --d === 0) return js.slice(m.index, j + 1); } }
const calls = [], toasts = [], confirms = []; let renders = 0, answers = {}, confirmAnswer = true;
const ctx = { console, JSON, Date, Number, String, Object, Array, Math, encodeURIComponent, setTimeout: (f) => { ctx.__timers.push(f); }, __timers: [],
  localStorage: { getItem: (k) => (k === 'ome_sess_token' ? 'TOK123' : null) }, GAS_URL_DIRECT: 'https://gas.example/exec', gsUrl: 'https://worker.example/',
  fmt: (n) => String(n), esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  toast: (m) => toasts.push(m), confirm: (m) => { confirms.push(m); return confirmAnswer; }, renderSalesReportTab: () => { renders++; }, logAudit() {},
  _srState: { dataA: 1, dataB: 1, dataC: 1, dataE: 1, dataF: 1, dataG: 1, dataH: 1 },
  _impJson_: async (r) => r.json(),
  fetch: async (u, o) => { calls.push({ u, body: o && o.body ? JSON.parse(o.body) : null }); const key = o && o.body ? JSON.parse(o.body).action + ':' + (JSON.parse(o.body).dryRun ? 'dry' : 'real') : 'GET'; const a = answers[key] || answers.GET; return { json: async () => (typeof a === 'function' ? a() : a), text: async () => JSON.stringify(a) }; } };
vm.createContext(ctx);
vm.runInContext('var _impHist = { items: null, loading: false, err: "", busy: "" };\n' + ['_impTok_', '_impGasUrl_', '_impLoadHist_', '_impUndo_', '_impHistHtml_'].map(fnSrc).join('\n'), ctx);

// ---- tai lich su ----
answers.GET = { ok: true, items: [
  { id: 'imp_1', time: '2026-10-20T03:00:00.000Z', who: 'duyenht', sheet: 'dữ liệu đơn', written: 120, updatedCells: 5, status: 'ok' },
  { id: 'imp_2', time: '2026-10-19T03:00:00.000Z', who: 'a<b>', sheet: 'DT TỔNG ', written: 9, updatedCells: 0, status: 'da-hoan-tac', undoneBy: 'duyenht' },
  { id: 'imp_3', time: '2026-10-18T03:00:00.000Z', who: '', sheet: 'dữ liệu đơn', written: 6000, updatedCells: 0, status: 'khong-hoan-tac-duoc' } ] };
(async () => {
  await ctx._impLoadHist_();
  ok(calls[0].u.indexOf('https://gas.example/exec?action=importBatches&token=TOK123') === 0, 'tai lich su: goi THANG Apps Script, kem token: ' + calls[0].u);
  ok(ctx._impHist.items.length === 3 && !ctx._impHist.loading && !ctx._impHist.err, 'luu 3 lan nhap, het trang thai loading');
  let h = ctx._impHistHtml_();
  ok(/Hoàn tác<\/button>/.test(h) && /_impUndo_\('imp_1'\)/.test(h), 'lan nhap ok: co nut Hoan tac goi _impUndo_(id)');
  ok(h.split('_impUndo_').length === 2, 'CHI lan "ok" co nut (da hoan tac / qua lon khong co)');
  ok(/Đã hoàn tác bởi duyenht/.test(h) && /Không hoàn tác được/.test(h), 'hien trang thai da hoan tac + qua lon');
  ok(h.indexOf('a<b>') === -1 && h.indexOf('a&lt;b&gt;') > -1, 'ten nguoi nhap duoc escape (khong chen HTML)');
  ok(/\(không rõ\)/.test(h), 'lan nhap khong ghi nguoi -> "(khong ro)"');
  // khong chu so huu
  ctx._impHist.items = null; answers.GET = { error: 'Chi quan tri vien chinh moi duoc sua/xoa don hang.', code: 'FORBIDDEN' };
  await ctx._impLoadHist_();
  ok(/Chỉ chủ sở hữu/.test(ctx._impHistHtml_()) && ctx._impHist.items.length === 0, 'khong phai chu so huu -> thong bao ro, KHONG lap tai lai (items=[])');
  // rong
  ctx._impHist.items = []; ctx._impHist.err = ''; ok(/Chưa có lần nhập nào/.test(ctx._impHistHtml_()), 'chua co lan nhap -> huong dan');

  // ---- hoan tac: xem truoc -> xac nhan -> that ----
  calls.length = 0; toasts.length = 0; confirms.length = 0; confirmAnswer = true;
  answers['importUndo:dry'] = { ok: true, dryRun: true, time: '2026-10-20T03:00:00.000Z', who: 'duyenht', sheet: 'dữ liệu đơn', wouldDelete: 120, wouldRestoreCells: 4, skippedEdited: 1, missing: 2, skippedNoRow: 0 };
  answers['importUndo:real'] = { ok: true, deleted: 120, restoredCells: 4 };
  ctx._impHist.items = [{ id: 'imp_1' }];
  await ctx._impUndo_('imp_1');
  ok(calls.length === 2 && calls[0].body.dryRun === true && calls[1].body.dryRun === false && calls.every((c) => c.u === 'https://gas.example/exec' && c.body.token === 'TOK123' && c.body.batchId === 'imp_1' && c.body.action === 'importUndo'), 'goi XEM TRUOC truoc roi moi goi THAT, deu kem token + batchId, di thang Apps Script');
  ok(confirms.length === 1 && /XÓA 120 dòng/.test(confirms[0]) && /KHÔI PHỤC 4 ô/.test(confirms[0]) && /GIỮ NGUYÊN 1 ô/.test(confirms[0]) && /2 dòng không còn/.test(confirms[0]) && /SAO LƯU/.test(confirms[0]), 'hop xac nhan neu dung so dong/o/bo qua/sao luu');
  ok(toasts.some((t) => /Đã hoàn tác: xóa 120 dòng, khôi phục 4 ô/.test(t)), 'bao ket qua');
  ok(ctx._srState.dataA === null && ctx._srState.dataH === null && ctx._impHist.items === null && ctx._impHist.busy === '', 'xoa cache bao cao + lam moi lich su + het busy');
  // huy o buoc xac nhan -> KHONG goi that
  calls.length = 0; toasts.length = 0; confirmAnswer = false; ctx._impHist.items = [{ id: 'imp_1' }];
  await ctx._impUndo_('imp_1');
  ok(calls.length === 1 && calls[0].body.dryRun === true && toasts.some((t) => /Đã hủy/.test(t)), 'bam Huy: chi co lan xem truoc, KHONG goi hoan tac that');
  // khong con gi de hoan tac
  calls.length = 0; toasts.length = 0; confirms.length = 0; confirmAnswer = true;
  answers['importUndo:dry'] = { ok: true, dryRun: true, wouldDelete: 0, wouldRestoreCells: 0, missing: 3 };
  await ctx._impUndo_('imp_1');
  ok(calls.length === 1 && confirms.length === 0 && toasts.some((t) => /Không còn gì để hoàn tác/.test(t)), 'khong con gi de hoan tac: bao ro, khong hoi xac nhan');
  // loi backend
  calls.length = 0; toasts.length = 0; answers['importUndo:dry'] = { error: 'Lần nhập này đã được hoàn tác rồi.' };
  await ctx._impUndo_('imp_1');
  ok(toasts.some((t) => /Hoàn tác lỗi: Lần nhập này đã được hoàn tác rồi/.test(t)) && ctx._impHist.busy === '', 'loi tu server hien ro, het busy');
  answers['importUndo:dry'] = { error: 'Cần đăng nhập', code: 'AUTH' }; toasts.length = 0;
  await ctx._impUndo_('imp_1'); ok(toasts.some((t) => /Cần đăng nhập/.test(t)), 'chua dang nhap -> bao ro');
  // chong bam 2 lan
  calls.length = 0; ctx._impHist.busy = 'imp_9'; await ctx._impUndo_('imp_1'); ok(calls.length === 0, 'dang xu ly lan khac -> khong goi them');
  ctx._impHist.busy = '';

  // ---- nhap file: kem token + tab J goi lich su ----
  ok((js.match(/action:'importSheetRows', token: _impTok_\(\)/g) || []).length === 2, 'CA 2 loi goi importSheetRows (xem truoc + that) deu kem token (de nhat ky ghi dung nguoi nhap)');
  ok(/_impHist\.items === null && !_impHist\.loading\) setTimeout\(_impLoadHist_, 0\)/.test(js) && /html \+= _impHistHtml_\(\);/.test(js), 'tab nhap file tu tai lich su 1 lan va ve bang');
  ok(/_impHist\.items = null;\s+\/\/ co lan nhap moi/.test(js), 'nhap xong -> tai lai lich su');
  console.log(fail ? '\nFAILED ' + fail : '\nALL IMPORT-UNDO-UI TESTS PASSED'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('LOI', e && e.stack || e); process.exit(1); });

#!/usr/bin/env node
// Test: GIAO DIEN nhap "Nguon don tu Base" (js/11 _impSrcCard_/_impOnSrcFileSelected/_impUploadBaseSrc) — 2026-11-21.
// Do cot theo TEN tieu de (khong biet truoc file mau), xem truoc -> ghi that, bao ket qua, escape HTML, khong ghi khi backend cu.
// Can jsdom (+ xlsx neu co de doc file that). Chay: node tools/test-import-base-source-ui.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
let XLSX = null; try { XLSX = require('xlsx'); } catch (e) {}
const js = fs.readFileSync(path.join(__dirname, '..', 'js', '11-fn-srload.js'), 'utf8');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const st16 = fs.readFileSync(path.join(__dirname, '..', 'js', '16-main-currentuser.js'), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\('); const m = re.exec(js); if (!m) throw new Error('khong thay ham ' + name);
  let d = 0, k = js.indexOf('{', m.index); for (let j = k; j < js.length; j++) { if (js[j] === '{') d++; else if (js[j] === '}' && --d === 0) return js.slice(m.index, j + 1); } }
const a0 = js.indexOf('// ═══ NHẬP "BÁO CÁO NGUỒN" TỪ BASE'), a1 = js.indexOf('function _impPickCard_(');
if (a0 < 0 || a1 < a0) throw new Error('khong thay khoi nhap bao cao nguon trong js/11');
const block = js.slice(a0, a1);

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
const w = dom.window;
const toasts = [], fetchLog = [], audits = []; let fetchPlan = [], renders = 0;
const ctx = vm.createContext({ console, JSON, Date, Number, String, Object, Array, Math, Promise, RegExp, Uint8Array, ArrayBuffer, document: w.document, window: w, FileReader: w.FileReader, XLSX,
  setTimeout: (f) => setTimeout(f, 0), fmt: (n) => String(n), esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  toast: (m) => toasts.push(m), logAudit: (...a) => audits.push(a.join('|')), gsUrl: 'https://worker/', GAS_URL_DIRECT: 'https://gas/exec', _impTok_: () => 'TOK', _impGasUrl_: () => 'https://gas/exec',
  _srState: { dataA: 1, dataB: 1, dataC: 1, dataE: 1, dataF: 1, dataG: 1, dataH: 1 }, _impRender_() { renders++; },
  _impState: { baseRows: null, posRows: null, srcItems: null, srcFileName: '', srcInfo: '', srcWarn: '', uploading: false, result: null }, _impHist: { items: [] },
  fetch: async (u, o) => { fetchLog.push({ u, body: o && o.body ? JSON.parse(o.body) : null }); const p = fetchPlan.shift(); if (p instanceof Error) throw p;
    return { status: p.status || 200, text: async () => (typeof p.body === 'string' ? p.body : JSON.stringify(p.body)) }; } });
vm.runInContext(['_impJson_', '_impPost_'].map(fnSrc).join('\n') + '\n' + block, ctx);
const tick = () => new Promise((r) => setTimeout(r, 5));
const reset = () => { fetchLog.length = 0; toasts.length = 0; audits.length = 0; fetchPlan = []; Object.assign(ctx._impState, { srcItems: null, srcFileName: '', srcInfo: '', srcWarn: '', uploading: false, result: null });
  ['A', 'B', 'C', 'E', 'F', 'G', 'H'].forEach((k) => { ctx._srState['data' + k] = 1; }); ctx._impHist.items = []; };

(async () => {
  // ---------- 1) do cot theo ten tieu de ----------
  let d = ctx._impDetectSrcCols_([['Mã đơn', 'Khách', 'Kênh bán']]);
  ok(d && d.headerRow === 0 && d.keyCols.length === 1 && d.keyCols[0].col === 0 && d.kenhCol.col === 2, 'Ma don + Kenh ban (co dau, hoa/thuong) -> do dung cot');
  d = ctx._impDetectSrcCols_([['Báo cáo nguồn tháng 11'], [], ['STT', 'ID', 'Mã bộ đếm', 'Nguồn']]);
  ok(d && d.headerRow === 2 && d.keyCols.map((k) => k.col).join() === '1,2' && d.kenhCol.col === 3, 'tieu de nam o dong 3 (co dong tieu de bao cao phia tren); ID + Ma bo dem DEU duoc dung lam khoa');
  d = ctx._impDetectSrcCols_([['Mã đơn hàng', 'Nguồn', 'Kênh bán']]);
  ok(d && d.kenhCol.name === 'Kênh bán', 'co ca "Nguon" va "Kenh ban" -> uu tien "Kenh ban"');
  d = ctx._impDetectSrcCols_([['MÃ ĐƠN', 'Nguồn đơn']]);
  ok(d && d.kenhCol.col === 1, '"Nguon don" cung nhan');
  d = ctx._impDetectSrcCols_([['Khách hàng', 'SĐT', 'ID khách hàng', 'Kênh bán']]);
  ok(d === null, 'chi co "ID khach hang" (khong phai ma don) -> KHONG nhan nham lam ma don');
  ok(ctx._impDetectSrcCols_([['Mã đơn', 'Khách', 'Ghi chú']]) === null && ctx._impDetectSrcCols_([['Khách', 'Kênh bán']]) === null && ctx._impDetectSrcCols_([]) === null, 'thieu cot ma hoac thieu cot nguon hoac rong -> null');

  // ---------- 2) tao cap {ma, kenh} ----------
  const aoa = [['STT', 'ID', 'Mã bộ đếm', 'Kênh bán'],
    ['1', '3456789001', 'DH101T11/2026', 'Fanpage A'],
    ['2', '3456789002', '', ' Landipage '],
    ['3', '', 'DH103T11/2026', 'Zalo'],
    ['4', '3456789004', 'DH104T11/2026', ''],            // nguon trong -> bo qua
    ['5', '3.46E+14', 'DH105T11/2026', 'Web'],           // ID bi Excel doi E+ -> bo, ma bo dem van dung
    ['6', '', '', 'Facebook']];                          // khong co ma -> bo
  d = ctx._impDetectSrcCols_(aoa); let b = ctx._impBuildSrcItems_(aoa, d);
  ok(JSON.stringify(b.items) === JSON.stringify([{ ma: '3456789001', kenh: 'Fanpage A' }, { ma: 'DH101T11/2026', kenh: 'Fanpage A' }, { ma: '3456789002', kenh: 'Landipage' }, { ma: 'DH103T11/2026', kenh: 'Zalo' }, { ma: 'DH105T11/2026', kenh: 'Web' }]), 'cap {ma,kenh}: moi cot ma 1 cap, cat khoang trang, bo nguon trong / khong ma');
  ok(b.rows === 5 && b.noKenh === 1 && b.sci === 1, 'dem: 5 don co ma, 1 don nguon trong, 1 ma dang E+');

  // ---------- 3) doc file .xlsx that + chon file ----------
  if (XLSX) {
    const mk = (rows) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1'); return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }); };
    const pick = async (rows, name) => { const input = { files: [new w.File([mk(rows)], name || 'nguon.xlsx')] }; await ctx._impOnSrcFileSelected(input); await tick(); };
    reset(); await pick([['Mã đơn', 'Kênh bán'], ['A1', 'Facebook'], ['A2', 'Zalo'], ['A3', '']]);
    ok(ctx._impState.srcItems && ctx._impState.srcItems.length === 2 && ctx._impState.srcFileName === 'nguon.xlsx' && /"Mã đơn"/.test(ctx._impState.srcInfo) && /"Kênh bán"/.test(ctx._impState.srcInfo) && /1 đơn có mã nhưng ô nguồn TRỐNG/.test(ctx._impState.srcWarn), 'file that: doc 2 cap, ten file, thong tin cot, canh bao 1 don nguon trong');
    reset(); await pick([['Khách', 'SĐT', 'Ghi chú'], ['A', '090', 'x']]);
    ok(ctx._impState.srcItems === null && toasts.some((t) => /Không tìm thấy cột MÃ ĐƠN/.test(t) && /Khách \| SĐT \| Ghi chú/.test(t)), 'file sai: bao ro + liet ke tieu de doc duoc de Duyen doi chieu');
    reset(); await pick([['Mã đơn', 'Kênh bán'], ['3.5E+14', 'Zalo']]);
    ok(ctx._impState.srcItems === null && toasts.some((t) => /E\+/.test(t)), 'tat ca ma bi doi E+ -> khong cho nhap, huong dan xuat lai cot ma dang van ban');
    reset(); await ctx._impOnSrcFileSelected({ files: [] }); ok(toasts.length === 0 && ctx._impState.srcItems === null, 'khong chon file -> khong lam gi');
  } else console.log('skip  (khong co module xlsx: bo qua phan doc file that)');

  // ---------- 4) nhap: xem truoc -> ghi that ----------
  const ITEMS = [{ ma: 'A1', kenh: 'Facebook' }, { ma: 'A2', kenh: 'Zalo' }];
  const setItems = () => { ctx._impState.srcItems = ITEMS.slice(); ctx._impState.srcFileName = 'n.xlsx'; ctx._impState.srcInfo = 'i'; };
  reset(); setItems();
  fetchPlan = [{ body: { ok: true, dryRun: true, wouldUpdateRows: 2, matchedSame: 0, unmatched: 0 } }, { body: { ok: true, updatedRows: 2, updatedCells: 2, matchedSame: 0, unmatched: 1, unmatchedSample: ['ZZ<b>'], batchId: 'imp_1' } }];
  await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 2 && fetchLog[0].body.action === 'importBaseSource' && fetchLog[0].body.dryRun === true && fetchLog[0].body.token === 'TOK' && fetchLog[0].body.items.length === 2 && fetchLog[0].u === 'https://gas/exec', 'goi THANG Apps Script: xem truoc (dryRun + token + items)');
  ok(fetchLog[1].body.action === 'importBaseSource' && fetchLog[1].body.dryRun === undefined && fetchLog[1].body.items.length === 2, 'roi GHI THAT 1 lan (khong dryRun), khong hoi xac nhan');
  ok(toasts.some((t) => /Đã cập nhật Kênh bán cho 2 đơn Base/.test(t) && /1 mã không tìm thấy/.test(t)) && audits.some((a) => /import_basesrc/.test(a)), 'bao da cap nhat + ghi nhat ky he thong (audit)');
  ok(ctx._impState.srcItems === null && ctx._impState.uploading === false && ctx._impHist.items === null && ctx._srState.dataA === null && ctx._srState.dataH === null, 'don file, het uploading, tai lai lich su, xoa cache bao cao (Kenh ban da doi)');
  const html = ctx._impSrcCard_();
  ok(/Đã cập nhật Kênh bán cho <b>2<\/b> đơn Base/.test(html) && /KHÔNG tìm thấy trên Base/.test(html) && html.indexOf('ZZ<b>') === -1 && /ZZ&lt;b&gt;/.test(html), 'the ket qua: so don cap nhat + ma khong tim thay, mau ma duoc ESCAPE HTML');
  // 4b) khong co gi can cap nhat -> khong ghi
  reset(); setItems(); fetchPlan = [{ body: { ok: true, dryRun: true, wouldUpdateRows: 0, matchedSame: 2, unmatched: 0 } }];
  await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 1 && toasts.some((t) => /Không có đơn nào cần cập nhật/.test(t) && /Không ghi gì/.test(t)) && ctx._impState.result.kind === 'src' && ctx._impState.srcItems !== null, 'tat ca da dung nguon: chi xem truoc, KHONG ghi, giu file de xem ket qua');
  // 4c) backend cu (chua deploy) -> khong ghi
  reset(); setItems(); fetchPlan = [{ body: { error: 'Unknown action' } }];
  await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 1 && toasts.some((t) => /Nhập lỗi: Unknown action/.test(t)) && ctx._impState.uploading === false, 'backend bao loi action la -> bao loi, khong ghi');
  reset(); setItems(); fetchPlan = [{ body: { ok: true, written: 5 } }];
  await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 1 && toasts.some((t) => /chưa có bản cập nhật mới/.test(t) && /Chưa ghi gì/.test(t)), 'backend tra loi kieu cu (khong co dryRun) -> khong ghi lan 2, bao doi deploy');
  // 4d) GHI THAT loi mang -> bao co the da ghi mot phan, khong tu thu lai
  reset(); setItems(); fetchPlan = [{ body: { ok: true, dryRun: true, wouldUpdateRows: 2 } }, new Error('Failed to fetch')];
  await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 2 && toasts.some((t) => /MỘT PHẦN/.test(t)) && ctx._impState.uploading === false, 'ghi that loi mang: bao CO THE DA GHI mot phan + huong dan, khong tu thu lai');
  // 4e) chong bam dup
  reset(); setItems(); ctx._impState.uploading = true; await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 0, 'dang nhap -> bam lan 2 khong goi them (chong bam dup)');
  // 4f) xem truoc loi tam thoi (502) tu thu lai
  reset(); setItems(); fetchPlan = [{ status: 502, body: '<h1>502</h1>' }, { body: { ok: true, dryRun: true, wouldUpdateRows: 0, matchedSame: 2 } }];
  await ctx._impUploadBaseSrc();
  ok(fetchLog.length === 2 && fetchLog.every((f) => f.body.dryRun === true), 'xem truoc loi 502 -> tu thu lai (an toan vi chua ghi gi)');

  // ---------- 5) the giao dien ----------
  reset(); let h0 = ctx._impSrcCard_();
  ok(/id="imp-file-src"/.test(h0) && /onchange="_impOnSrcFileSelected\(this\)"/.test(h0) && h0.indexOf('_impUploadBaseSrc') === -1, 'chua chon file: co o chon file, CHUA co nut nhap');
  setItems(); ctx._impState.srcWarn = 'canh <b>bao</b>'; h0 = ctx._impSrcCard_();
  ok(/_impUploadBaseSrc\(\)/.test(h0) && /Cập nhật nguồn cho Base/.test(h0) && h0.indexOf('<b>bao</b>') === -1, 'da chon file: co nut nhap, canh bao duoc escape');
  ctx._impState.result = { kind: 'src', updatedRows: 0, matchedSame: 3, ambiguous: 2, ambiguousSample: ['T1'], conflictInFile: 1, updateOverLimit: 7 };
  h0 = ctx._impSrcCard_();
  ok(/3 đơn đã đúng nguồn/.test(h0) && /2 mã khớp NHIỀU dòng Base/.test(h0) && /1 đơn file ghi 2 nguồn khác nhau/.test(h0) && /nhập lại cùng file để làm tiếp/.test(h0), 'the ket qua liet ke: da dung nguon / mo ho / xung dot / qua gioi han');
  ctx._impState.result = { kind: 'base', written: 5 }; ok(ctx._impSrcCard_().indexOf('Đã cập nhật Kênh bán') === -1, 'ket qua cua the Base/Pos KHONG hien o the Nguon');

  // ---------- 6) noi vao trang + khong pha test cu ----------
  ok(/html \+= _impPickCard_\('pos'[^\n]*\n\s*html \+= _impSrcCard_\(\);/.test(js), 'tab Up du lieu ve the Nguon ngay sau the Pos');
  ok((js.match(/action:'importSheetRows', token: _impTok_\(\)/g) || []).length === 2, 'js/11 van dung 2 cho goi importSheetRows (test-import-undo-ui khong bi vo)');
  ok(/srcItems: null, srcFileName: '', srcInfo: '', srcWarn: ''/.test(st16), 'js/16 _impState co du truong src*');
  ok(/js\/11-fn-srload\.js\?v=20261121a/.test(idx) && /js\/16-main-currentuser\.js\?v=20261121a/.test(idx), 'index.html da bump ?v= cho js/11 va js/16 (Ctrl+F5)');
  ok(!/importBaseSource', token: _impTok_\(\), items: items, dryRun: true \}, 'write'/.test(js), 'xem truoc khong dung phase "write" (phai la preview co thu lai)');

  console.log(fail ? '\n' + fail + ' LOI' : '\nTAT CA XANH');
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
// Test Node (fetch gia, sheet gia) cho BUOC 4a cua docs/SUPABASE-PLAN.md: backfill + doi chieu dt_tong / don_chi_tiet.
// Chay: node tools/test-supabase-orders.js  -> in "ALL ORDER BACKFILL TESTS PASSED". Khong goi mang that, khong can key that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
function fnSrc(name) {            // cat 1 ham cap cao nhat theo dau ngoac nhon
  const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name);
  let d = 0, k = src.indexOf('{', i);
  for (let j = k; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
  throw new Error('khong khop ngoac ' + name);
}
function between(a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('khong thay moc ' + a); return src.slice(i, j); }
const consts = between("var DT_TONG_SHEET", "// SUA 2026-10-04: 15") + between("var DON_CHITIET_WIDTH = 17;", "// ─── DT TỔNG = nguon") + between("var DT_COL_NGAYTAO", "// Sentinel dung thay cho");
const code = [consts, 'var VN_OFFSET_MS = 7 * 3600 * 1000;', fnSrc('_vnYmdParts_'), fnSrc('normPhone_'), fnSrc('_dtCellToVnStr_'), fnSrc('_normMoney_'),
  fnSrc('_donConvertRows_'), src.slice(src.indexOf('var SB_BATCH_ ='))].join('\n');
// ^ tu 'var SB_BATCH_' den het file = toan bo khoi Supabase (buoc 2/3/4a; can cho sbCfg_/sb_/_sbHeader_).

const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const D = (y, m, d, h = 0, mi = 0) => new Date(Date.UTC(y, m - 1, d, h, mi));

// ---- Sheet "DT TỔNG " gia: 20 cot A:T. 1100 dong don + 1 dong chi co gia tri (khong SDT/id) + 2 dong rong ----
const dtRows = [];
for (let i = 0; i < 1100; i++) {
  const r = new Array(20).fill('');
  r[0] = i % 3 === 0 ? D(2026, 10, 1 + (i % 28), 9, 30) : '0' + (1 + (i % 9)) + '/10/2026 08:00';   // Date that hoac chuoi dd/MM/yyyy
  r[1] = ' Nguoi ' + (i % 4) + ' '; r[2] = 'giao' + i;
  r[3] = i % 7 === 0 ? Number('912' + String(100000 + i)) : '0912' + String(100000 + i);          // 1/7 SDT la number thieu so 0
  r[6] = 'gd' + (i % 3); r[7] = 'Hoan thanh'; r[10] = D(2026, 10, 2 + (i % 27), 14, 5);
  r[12] = ' kenh' + (i % 2) + ' '; r[13] = 'Sale A, Sale B'; r[14] = 'sp ' + i; r[15] = 'pl';
  r[16] = 100000; r[17] = i % 5 === 0 ? '1.500.000đ' : 2000000 + i; r[18] = -5; r[19] = 'ID' + i;
  dtRows.push(r);
}
const onlyVal = new Array(20).fill(''); onlyVal[17] = 777000; dtRows.splice(500, 0, onlyVal);     // dong chi co gia tri: PHAI duoc giu (giong readDTTong_)
dtRows.push(new Array(20).fill(''), new Array(20).fill(''));
dtRows[10][0] = '31/02/2026 10:00';                                                              // ngay khong hop le -> ngay_tao_d = null, van giu dong

// ---- Sheet "dữ liệu đơn" gia: 17 cot A:Q ----
const donRows = [];
for (let i = 0; i < 1100; i++) {
  const r = new Array(17).fill('');
  r[1] = i % 10 === 5 ? '' : D(2026, 10, 1 + (i % 28), 0, 0);      // moi dong thu 10 thieu ngay -> ke thua ngay dong tren
  r[2] = 'Sale A,Sale B'; r[3] = 'Khach ' + i; r[4] = '0912' + String(200000 + i); r[7] = 'Base'; r[8] = 'SP ' + i; r[9] = 'M' + i; r[10] = '1';
  r[11] = 1000000 + i; r[12] = 30000; r[13] = ' Mkt ' + (i % 3); r[14] = 'Hoan thanh';
  donRows.push(r);
}
donRows[300] = new Array(17).fill('');                                                           // dong rong -> bo (khong anh huong ke thua)
donRows[301] = new Array(17).fill(''); donRows[301][16] = 'BD-123';                              // khong ngay, khong khach, co ma o cot Q -> van la don that
donRows.push(new Array(17).fill(''));                                                            // dong cuoi rong

const sheets = {
  'DT TỔNG ': { rows: [new Array(20).fill('h')].concat(dtRows), maxCols: 20 },
  'dữ liệu đơn': { rows: [new Array(17).fill('h')].concat(donRows), maxCols: 17 }
};
const mkSheet = o => ({ getLastRow: () => o.rows.length, getMaxColumns: () => o.maxCols,
  getRange: (r, c, n, w) => ({ getValues: () => o.rows.slice(r - 1, r - 1 + n).map(x => { const y = x.slice(c - 1, c - 1 + w); while (y.length < w) y.push(''); return y; }) }) });

// ---- Supabase gia (PostgREST toi thieu) ----
const tables = { dt_tong: new Map(), don_chi_tiet: new Map() };
const keyOf = (t, r) => t === 'dt_tong' ? r.id + '|' + r.src_row : String(r.src_row);
let postNo = 0, failPostNo = 0, failAll = false, deletes = 0;
const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
const R = (code, body, h) => ({ getResponseCode: () => code, getContentText: () => body, getAllHeaders: () => h || {} });
const ctx = {
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => props[k] = v, deleteProperty: k => delete props[k] }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  getDTSS_: () => ({ getSheetByName: n => sheets[n] ? mkSheet(sheets[n]) : null }),
  UrlFetchApp: { fetch(url, o) {
    if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
    if (failAll) return R(500, 'boom');
    const u = new URL(url), t = u.pathname.split('/').pop(), tb = tables[t];
    if (!tb) return R(404, 'khong co bang ' + t);
    if (o.method === 'DELETE') { deletes++; tb.clear(); return R(204, ''); }
    if (o.method === 'POST') {
      postNo++; if (failPostNo && postNo === failPostNo) return R(500, 'boom o lo ' + postNo);
      const a = JSON.parse(o.payload), seen = new Set(), keys0 = Object.keys(a[0]).join();
      for (const r of a) {
        if (Object.keys(r).join() !== keys0) return R(400, 'All object keys must match');
        const k = keyOf(t, r); if (seen.has(k)) return R(400, 'ON CONFLICT row twice'); seen.add(k);
      }
      for (const r of a) tb.set(keyOf(t, r), r);
      return R(201, '');
    }
    const sr = u.searchParams.get('src_row');
    if (sr && sr.startsWith('in.(')) { const set = new Set(sr.slice(4, -1).split(',').map(Number)); return R(200, JSON.stringify([...tb.values()].filter(r => set.has(r.src_row)))); }
    if (o.headers.Prefer === 'count=exact') return R(206, '[]', { 'Content-Range': '0-0/' + [...tb.values()].filter(r => !r.archived).length });
    return R(200, '[]'); } }
};
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = c => vm.runInContext(c, ctx);

// ===== Chuyen doi tung dong =====
let rec;
ctx.__r = dtRows[0]; rec = run('sbDtRowToRec_(__r, 2)');
ok(rec.id === 'ID0' && rec.src_row === 2 && rec.phone === '0912100000' && rec.nguoi_tao === 'Nguoi 0' && rec.kenh_ban === 'kenh0', 'rec dt co ban: ' + JSON.stringify(rec));
ok(rec.ngay_tao === '01/10/2026 09:30' && rec.ngay_tao_d === '2026-10-01' && rec.thoi_gian_ht_d === '2026-10-02', 'ngay Date: ' + rec.ngay_tao + ' ' + rec.ngay_tao_d);
ok(rec.gia_tri_don === 1500000 && rec.gia_tri_coc === 100000 && rec.gia_tri_chenh === -5, 'tien "1.500.000đ" -> 1500000: ' + rec.gia_tri_don);
ok(rec.raw.length === 20 && rec.raw[0].__d === dtRows[0][0].getTime() && rec.raw[17] === '1.500.000đ', 'raw giu nguyen o goc (Date -> __d, chuoi tien giu nguyen)');
ctx.__r = dtRows[7]; rec = run('sbDtRowToRec_(__r, 9)');
ok(rec.phone === '0912100007' && rec.ngay_tao_d === '2026-10-08', 'SDT number thieu so 0 + ngay chuoi dd/MM/yyyy: ' + rec.phone + ' ' + rec.ngay_tao_d);
ctx.__r = dtRows[10]; rec = run('sbDtRowToRec_(__r, 12)');
ok(rec.ngay_tao_d === null && rec.ngay_tao === '31/02/2026 10:00', 'ngay khong hop le -> null, khong nem loi');
ctx.__r = new Array(20).fill(''); ok(run('sbDtRowToRec_(__r, 2)') === null, 'dong rong bi bo');
ctx.__r = onlyVal; rec = run('sbDtRowToRec_(__r, 2)'); ok(rec && rec.id === '' && rec.gia_tri_don === 777000, 'dong chi co gia tri duoc giu (id rong)');
ctx.__r = dtRows[0]; ctx.__raw = JSON.parse(JSON.stringify(run('sbDtRowToRec_(__r, 2)').raw));   // di qua JSON that nhu khi luu jsonb
const back = run('sbRawToRow_(__raw, 20)');
ok(Object.prototype.toString.call(back[0]) === '[object Date]' && back[0].getTime() === dtRows[0][0].getTime() && back[10].getTime() === dtRows[0][10].getTime() && back[17] === '1.500.000đ', 'raw -> row dung lai Date that');
ok(run("_sbDateIso_('2026-10-05T01:00:00Z')") === '2026-10-05' && run("_sbDateIso_('5/3/2026 10:00')") === '2026-03-05' && run("_sbDateIso_('abc')") === null && run("_sbDateIso_('')") === null, '_sbDateIso_ cac dang chuoi');

// ===== Backfill dt_tong =====
let r = run('sbBackfillDT_({})');
ok(r.ok && r.dryRun && r.done && r.batches === 3 && r.pushed === 1101 && r.skippedBlank === 2, 'dryRun mac dinh: ' + JSON.stringify(r));
ok(tables.dt_tong.size === 0 && !props.SB_DT_CURSOR, 'dryRun KHONG ghi / dich con tro');
r = run('sbBackfillDT_({dryRun:false})');
ok(r.ok && r.done && tables.dt_tong.size === 1101, 'ghi that dt: size ' + tables.dt_tong.size + ' ' + JSON.stringify(r));
ok(JSON.parse(props.SB_DT_CURSOR).row === 1105, 'con tro sau khi xong = lastRow+1: ' + props.SB_DT_CURSOR);
ok(tables.dt_tong.has('ID0|2') && tables.dt_tong.has('|502'), 'khoa (id, src_row), dong thieu id dung id rong + src_row');

// resume: ngan sach am -> dung 1 lo moi lan goi; sau do chay du
run('SB_TIME_BUDGET_MS_=-1'); props.SB_DT_CURSOR = undefined; delete props.SB_DT_CURSOR; tables.dt_tong.clear();
let a = run('sbBackfillDT_({dryRun:false})');
ok(!a.done && a.batches === 1 && a.nextRow === 502, 'het ngan sach van chay dung 1 lo: ' + JSON.stringify(a));
let calls = 1; while (!a.done) { a = run('sbBackfillDT_({dryRun:false})'); calls++; ok(calls < 10, 'resume lap vo han'); }
ok(calls === 3 && tables.dt_tong.size === 1101, 'resume qua 3 lan goi: ' + calls + ' size ' + tables.dt_tong.size);
run('SB_TIME_BUDGET_MS_=240000');
// loi HTTP o lo 2: con tro dung o dau lo loi, khong lo key; goi lai chay tiep
delete props.SB_DT_CURSOR; tables.dt_tong.clear(); postNo = 0; failPostNo = 2;
r = run('sbBackfillDT_({dryRun:false})');
ok(!r.ok && !JSON.stringify(r).includes('SECRETKEY') && r.error.includes('HTTP 500') && JSON.parse(props.SB_DT_CURSOR).row === 502, 'loi HTTP: ' + JSON.stringify(r) + ' cursor ' + props.SB_DT_CURSOR);
failPostNo = 0; r = run('sbBackfillDT_({dryRun:false})');
ok(r.ok && r.done && tables.dt_tong.size === 1101, 'chay tiep sau loi');

// ===== Doi chieu dt =====
let c = run('sbCompareDT_({sample:300})');
ok(c.ok && c.expectedRows === 1101 && c.supabaseRows === 1101 && c.mismatchCount === 0 && c.sampleChecked === 300, 'compare dt khop: ' + JSON.stringify(c));
const k3 = tables.dt_tong.get('ID3|5'); const oldDon = k3.gia_tri_don;
k3.gia_tri_don = 1; c = run('sbCompareDT_({sample:300})'); ok(!c.ok && c.mismatches[0].cols.join() === 'gia_tri_don', 'phat hien lech gia tri don: ' + JSON.stringify(c.mismatches));
k3.gia_tri_don = oldDon; k3.raw[13] = 'Sale Z'; c = run('sbCompareDT_({sample:300})'); ok(!c.ok && c.mismatches[0].cols.join() === 'raw', 'phat hien lech raw');
k3.raw[13] = 'Sale A, Sale B';
tables.dt_tong.delete('ID6|8'); c = run('sbCompareDT_({sample:300})'); ok(!c.ok && c.supabaseRows === 1100 && c.mismatches.some(m => m.problem === 'thieu tren Supabase'), 'phat hien thieu dong');
failAll = true; c = run('sbCompareDT_({})'); ok(!c.ok && !JSON.stringify(c).includes('SECRETKEY'), 'compare loi HTTP'); failAll = false;
// Sheet bi xoa 1 dong sau backfill -> src_row lech -> compare KHONG ok; chay lai tu dau (reset) -> xoa sach + khop
sheets['DT TỔNG '].rows.splice(51, 1);
c = run('sbCompareDT_({sample:300})'); ok(!c.ok, 'xoa dong tren Sheet phai lam compare KHONG ok');
r = run('sbBackfillDT_({dryRun:true,reset:true})'); ok(r.ok && deletes === 0, 'reset + dryRun KHONG duoc xoa bang Supabase');
r = run('sbBackfillDT_({dryRun:false,reset:true})'); ok(r.ok && r.done && deletes === 1 && tables.dt_tong.size === 1100, 'reset: xoa sach + day lai: ' + JSON.stringify(r) + ' size ' + tables.dt_tong.size);
c = run('sbCompareDT_({sample:300})'); ok(c.ok, 'compare khop sau reset: ' + JSON.stringify(c));
ok(run('sbBackfillDT_({})').dryRun === true && run("sbBackfillDT_({dryRun:'false'})").dryRun === false, 'dryRun: mac dinh true, chuoi false = ghi that');

// ===== Backfill don_chi_tiet =====
sheets['dữ liệu đơn'].rows[501][1] = '';       // dong dau lo 2 (src_row 502) thieu ngay -> PHAI ke thua tu lo truoc (con tro luu lastNgay)
r = run('sbBackfillDon_({})');
ok(r.ok && r.dryRun && r.done && r.batches === 3 && r.pushed === 1099 && r.skippedBlank === 2, 'dryRun don: ' + JSON.stringify(r));
run('SB_TIME_BUDGET_MS_=1');                   // moi lan chi 1 lo -> ke thua ngay phai di qua con tro
calls = 0; do { r = run('sbBackfillDon_({dryRun:false})'); calls++; ok(r.ok && calls < 10, 'don resume: ' + JSON.stringify(r)); } while (!r.done);
run('SB_TIME_BUDGET_MS_=240000');
ok(calls >= 2 && tables.don_chi_tiet.size === 1099, 'ghi that don: ' + calls + ' lan, size ' + tables.don_chi_tiet.size);
const d502 = tables.don_chi_tiet.get('502');
ok(d502.ngay_tao_don === '24/10/2026' && d502.ngay_tao_d === '2026-10-24', 'ke thua ngay xuyen lo: ' + JSON.stringify([d502.ngay_tao_don, d502.ngay_tao_d]));
const d303 = tables.don_chi_tiet.get('303');
ok(d303 && d303.ghi_chu === 'BD-123' && d303.phone === '' && d303.ngay_tao_d === '2026-10-20', 'dong chi co ma o cot Q van la don, ke thua ngay dong co ngay phia tren (bo qua dong rong): ' + JSON.stringify(d303 && [d303.ghi_chu, d303.ngay_tao_d]));
ok(!tables.don_chi_tiet.has('302'), 'dong rong bi bo');
const d2 = tables.don_chi_tiet.get('2');
ok(d2.phone === '0912200000' && d2.nguon_don === 'Base' && d2.the_sale === 'Sale A,Sale B' && d2.san_pham === 'SP 0' && d2.marketer === 'Mkt 0' && d2.gia_tri_sau_giam === 1000000 && d2.raw.length === 17 && d2.raw[1].__d === donRows[0][1].getTime(), 'rec don co ban');
// don: ket qua phai GIONG HET readDonChiTiet_ (cung _donConvertRows_)
const full = run("_donConvertRows_(getDTSS_().getSheetByName(DON_CHITIET_SHEET).getRange(2, 1, 1102, 17).getValues(), 2, '')");
ok(full.items.length === 1099 && full.items.find(x => x.srcRow === 502).obj.ngayTaoDon === '24/10/2026', 'converter chung chay 1 lo = chay nhieu lo');
c = run('sbCompareDon_({sample:300})');
ok(c.ok && c.expectedRows === 1099 && c.supabaseRows === 1099 && c.mismatchCount === 0 && c.sampleChecked === 300, 'compare don khop: ' + JSON.stringify(c));
tables.don_chi_tiet.get('5').phone = '0999'; c = run('sbCompareDon_({sample:300})'); ok(!c.ok && c.mismatches[0].cols.join() === 'phone', 'don: phat hien lech phone');
tables.don_chi_tiet.get('5').phone = '0912200003';
tables.don_chi_tiet.delete('8'); c = run('sbCompareDon_({sample:300})'); ok(!c.ok && c.supabaseRows === 1098, 'don: phat hien thieu dong');
// khong cau hinh / thieu sheet
const key = props.SUPABASE_KEY; delete props.SUPABASE_KEY;
r = run('sbBackfillDT_({})'); ok(!r.ok && r.error.includes('Chua cau hinh'), 'chua cau hinh'); props.SUPABASE_KEY = key;
const keep = sheets['dữ liệu đơn']; delete sheets['dữ liệu đơn'];
r = run('sbBackfillDon_({})'); ok(!r.ok && r.error.includes('Khong tim thay sheet'), 'thieu sheet bao loi ro rang, khong im lang: ' + JSON.stringify(r)); sheets['dữ liệu đơn'] = keep;

// ===== 4b: danh dau "dirty" khi CRM ghi don hang =====
run("sbMarkOrdersDirty_('dt', 'test')"); ok(Number(props.SB_DT_DIRTY) > 0 && props.SB_DON_DIRTY === undefined, 'dirty dt chi dat SB_DT_DIRTY');
run("sbMarkOrdersDirty_('don', 'test')"); ok(Number(props.SB_DON_DIRTY) > 0, 'dirty don dat SB_DON_DIRTY');
// moi duong ghi cua CRM phai goi sbMarkOrdersDirty_ (kiem tra tinh tren ma nguon: ham -> phai co loi goi trong than ham)
[['patchOrder_', "'dt'"], ['deleteOrder_', "'dt'"], ['deleteDuplicateOrders_', "'dt'"], ['doImportSheetRowsLocked_', "'don'"], ['onChangeDedupTrigger_', "'don'"], ['archiveOldOrders_', "'don'"]]
  .forEach(([fn, arg]) => ok(fnSrc(fn).includes('sbMarkOrdersDirty_(') && fnSrc(fn).includes(arg), fn + ' phai goi sbMarkOrdersDirty_'));
console.log('ALL ORDER BACKFILL TESTS PASSED');

// ── KH "Chăm sóc" thêm nhanh — sheet RIÊNG, độc lập CareData/DT TỔNG/dữ liệu đơn ──
// ═══════════════════════════════════════════════════════════════
//  NGUON "CSKH-Duyên" — sheet thu 3 (cung file voi DT TONG / "dữ liệu đơn"), yeu cau Duyen 2026-10-06:
//  dua du lieu khach VIP/SPV (CSKH-Duyên) len CRM de CHIA DATA cho CS va CS cham soc; khach co cung SDT o DT TONG,
//  "dữ liệu đơn" va CSKH-Duyên thi CRM gop thanh 1 khach (gop theo SDT o index.html) co du thong tin tu 3 nguon.
//  Doc theo TEN TIEU DE cot (khong theo vi tri) nen them/doi thu tu cot khong lam hong. KHONG doc cot
//  "Mã số thuế/CCCD (theo dữ liệu gốc)" — CCCD la dinh danh ca nhan nhay cam, CS khong can de cham soc.
//  Dong KHONG co SDT khong the gop theo SDT -> khong dua vao danh sach khach, chi dem trong noPhone de bao.
// ═══════════════════════════════════════════════════════════════
var CSKH_DUYEN_SHEET_KEY_ = 'cskh-duyen'; // so khop ten sheet da bo dau/hoa-thuong: "CSKH-Duyên" / "cskh-duyen"
// Moi truong: [ten truong, [cac cum tu PHAI co mat (nguyen tu) trong tieu de da bo dau]] — xet theo thu tu, cum cu the truoc
var CSKH_DUYEN_FIELDS_ = [
  ['taxCompany', ['ma so thue', 'cong ty']],
  ['company',    ['ten', 'cong ty']],
  ['codeOrig',   ['ma khach hang', 'goc']],
  ['codeOther',  ['ma khach hang', 'khac']],
  ['dupCount',   ['so lan trung']],
  ['phone',      ['sdt']],
  ['name',       ['ten khach hang']],
  ['tier',       ['phan loai']],
  ['internal',   ['doi tuong noi bo']],
  ['address',    ['dia chi']],
  ['birthday',   ['ngay sinh']],
  ['gender',     ['gioi tinh']],
  ['debt',       ['cong no']],
  ['email',      ['email']],
  ['staff',      ['nhan vien phu trach']],
  ['source',     ['nguon du lieu']],
  ['note',       ['ghi chu']]
];
function _findCskhDuyenSheet_() {
  var sheets = getDTSS_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (_stripVN_(sheets[i].getName()).replace(/\s+/g, '') === CSKH_DUYEN_SHEET_KEY_) return sheets[i];
  }
  return null;
}
function _cskhHeaderMap_(headerRow) {
  var map = {}, used = {};
  CSKH_DUYEN_FIELDS_.forEach(function(f) {
    for (var c = 0; c < headerRow.length; c++) {
      if (used[c]) continue;
      var h = ' ' + _stripVN_(headerRow[c]).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
      if (h.trim() === '') continue;
      var ok = f[1].every(function(kw) { return h.indexOf(' ' + kw + ' ') !== -1; });
      if (ok) { map[f[0]] = c; used[c] = true; break; }
    }
  });
  return map;
}
function _cskhCell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Etc/GMT-7', 'dd/MM/yyyy');
  return String(v).replace(/\s+/g, ' ').trim();
}
// Tra ve { found, rows:[{phone,name,tier,...}], total, noPhone, noPhoneSample:[ten], cols:{truong:chi so cot} }
//
// CANH BAO HIEU NANG (van GIU lai ham nay vi action 'cskhDuyen' du khong con FE nao goi, nhung
// de phong can cho debug/export sau nay): doc+parse FULL moi truong x TOAN BO dong sheet, voi
// sheet toi ~134k dong ham nay RAT NANG (hang chuc MB) va cache _cacheGetBig_ gan nhu chac chan
// THAT BAI AM THAM voi payload lon co nay (CacheService khong du suc chua), nghia la MOI LAN goi
// deu doc+xu ly lai TU DAU. KHONG duoc goi ham nay cho cac thao tac THUONG XUYEN (vd tra cuu 1
// khach) — xem findCskhRowsByPhone_ (dung index nhe hon nhieu) va readCskhDuyenLite_ (ban rut
// gon 3 truong cho FE keo hang loat) ngay duoi day, day moi la 2 duong CHINH dang duoc dung.
function readCskhDuyen_() {
  var cached = _cacheGetBig_('cskhDuyen_v1');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  var out = { found: false, rows: [], total: 0, noPhone: 0, noPhoneSample: [], cols: {} };
  var sh = _findCskhDuyenSheet_();
  if (!sh) return out;
  out.found = true;
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) return out;
  var vals = sh.getRange(1, 1, last, width).getValues();
  var map = _cskhHeaderMap_(vals[0]);
  out.cols = map;
  if (map.phone === undefined && map.name === undefined) return out; // khong nhan ra tieu de nao -> khong doan
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i], o = {};
    Object.keys(map).forEach(function(k) { o[k] = _cskhCell_(r[map[k]]); });
    var raw = map.phone !== undefined ? r[map.phone] : '';
    o.phone = normPhone_(raw);
    if (!o.phone && !o.name) continue; // dong trong
    out.total++;
    if (!o.phone || o.phone.length < 8) {
      out.noPhone++;
      if (out.noPhoneSample.length < 20 && o.name) out.noPhoneSample.push(o.name);
      continue;
    }
    out.rows.push(o);
  }
  try { _cachePutBig_('cskhDuyen_v1', JSON.stringify(out), 300); } catch (e2) {}
  return out;
}

// ═══ FIX HIEU NANG (01/10/2026, Duyen bao CRM lag sau khi them sheet CSKH-Duyên len ~134k dong) ═══
// Nguyen nhan chinh: findCskhRowsByPhone_ (ban CU) goi THANG readCskhDuyen_() — doc+parse FULL
// 17 truong x TOAN BO ~134k dong MOI LAN tra cuu 1 SDT. Ham nay duoc goi tu action 'lookup',
// von duoc goi RAT THUONG XUYEN (moi lan CS/extension xem 1 ho so khach) — nen moi lan xem ho so
// la CRM phai doc lai toan bo sheet khong lo nay, rat cham. Cache _cacheGetBig_ cho ban FULL
// cung gan nhu chac chan that bai am tham voi payload hang chuc MB nay nen khong co tac dung.
//
// Fix: tach rieng 1 INDEX NHE — chi SDT -> so dong (khong keo du lieu 17 truong) — bang cach chi
// doc 1 COT SDT (thay vi 17 cot) cho TOAN BO sheet 1 lan, cache index nay (nho hon nhieu, de
// cache thanh cong hon). Tra cuu 1 SDT: tra index de biet SDT nam o (nhung) dong nao, roi CHI
// doc FULL BE RONG cho DUNG (vai) dong do — khong dong nao khac.
function _cskhPhoneIndex_() {
  var cached = _cacheGetBig_('cskhDuyen_idx_v1');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  var idx = { phoneCol: -1, map: {} }; // map: SDT -> [so dong 1-based tren sheet, co the >1 neu trung SDT]
  var sh = _findCskhDuyenSheet_();
  if (!sh) { try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e2) {} return idx; }
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) { try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e2) {} return idx; }
  var headerRow = sh.getRange(1, 1, 1, width).getValues()[0];
  var map0 = _cskhHeaderMap_(headerRow);
  if (map0.phone === undefined) { try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e2) {} return idx; }
  idx.phoneCol = map0.phone;
  var phoneVals = sh.getRange(2, map0.phone + 1, last - 1, 1).getValues(); // CHI 1 cot, khong phai 17
  for (var i = 0; i < phoneVals.length; i++) {
    var p = normPhone_(phoneVals[i][0]);
    if (!p || p.length < 8) continue;
    if (!idx.map[p]) idx.map[p] = [];
    idx.map[p].push(i + 2); // +2: hang 1 la tieu de, i bat dau tu 0
  }
  try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e3) {} // co the van qua lon voi sheet SIEU to, nhung du khong cache duoc thi viec doc 1 cot van NHE HON NHIEU so voi doc 17 cot nhu truoc
  return idx;
}

function findCskhRowsByPhone_(phone) {
  var p = normPhone_(phone);
  if (!p) return [];
  try {
    var idx = _cskhPhoneIndex_();
    var rowNums = idx.map[p];
    if (!rowNums || !rowNums.length) return [];
    var sh = _findCskhDuyenSheet_();
    if (!sh) return [];
    var width = sh.getLastColumn();
    var headerRow = sh.getRange(1, 1, 1, width).getValues()[0];
    var map = _cskhHeaderMap_(headerRow);
    var out = [];
    rowNums.forEach(function(rn) {
      var r = sh.getRange(rn, 1, 1, width).getValues()[0];
      var o = {};
      Object.keys(map).forEach(function(k) { o[k] = _cskhCell_(r[map[k]]); });
      o.phone = p;
      out.push(o);
    });
    return out;
  } catch (e) { return []; }
}

// TOI UU TOC DO (06/10/2026): 'lookup' duoc extension goi moi lan chuyen chat + poll 6 giay, cache
// ket qua tong cua lookup chi 15s -> cu het han la findCskhRowsByPhone_ lai doc CA COT SDT cua sheet
// CSKH-Duyen (~134k dong; index qua lon nen _cachePutBig_ that bai am tham). Sheet nay gan nhu
// tinh (danh sach khach VIP), nen cache RIENG theo tung SDT 5 phut — ke ca ket qua RONG (da so
// khach khong co trong CSKH-Duyen, neu khong cache [] thi van doc lai index moi lan).
function findCskhRowsCached_(phone) {
  var p = normPhone_(phone);
  if (!p) return [];
  var cache = CacheService.getScriptCache();
  var key = 'ckr_' + p;
  try {
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
  } catch (e) {}
  var rows = findCskhRowsByPhone_(phone);
  try { cache.put(key, JSON.stringify(rows), 300); } catch (e2) {}
  return rows;
}

// Ban "NHE" cua CSKH-Duyên — CHI 3 truong (phone,name,tier) thay vi du 17 truong, dung cho FE
// keo HANG LOAT khi tai trang/poll dinh ky (action=cskhDuyenLite — FE da san sang goi action nay
// nhung TRUOC DAY CHUA CO handler o backend nen luon loi am tham, khien danh sach CSKH-Duyên
// khong len duoc tren CRM). Chi tiet day du 1 khach (dia chi/cong ty/no/ghi chu...) CHI lay rieng
// qua findCskhRowsByPhone_ khi CS thuc su mo ho so khach do (lazy), KHONG keo full 17 truong x
// toan bo ~134k dong moi lan tai trang/poll nua.
function readCskhDuyenLite_() {
  var cached = _cacheGetBig_('cskhDuyen_lite_v2');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  // NGUYÊN NHÂN GỐC (đã sửa) lỗi thỉnh thoảng trả HTML 404/quá tải: khi cache hết hạn, MỌI request đang chờ (nhiều CS mở CRM
  // cùng lúc + vòng poll) đều tự đọc lại ~134k dòng của sheet CSKH-Duyên song song -> vượt giới hạn thực thi đồng thời của
  // Apps Script -> lỗi cho cả các action khác (customers, users, assignHistory...). Nay chỉ 1 request dựng lại; các request
  // còn lại thấy cờ "đang dựng" thì chờ tối đa ~18s rồi lấy kết quả từ cache (không dùng LockService để khỏi chặn các thao tác ghi).
  var _cacheB = null;
  try { _cacheB = CacheService.getScriptCache(); } catch (eCb) {}
  if (_cacheB && _cacheB.get('cskhDuyen_lite_building')) {
    for (var w = 0; w < 12; w++) {
      Utilities.sleep(1500);
      var c2 = _cacheGetBig_('cskhDuyen_lite_v2');
      if (c2) { try { return JSON.parse(c2); } catch (e3) {} }
      if (!_cacheB.get('cskhDuyen_lite_building')) break;
    }
  }
  try { if (_cacheB) _cacheB.put('cskhDuyen_lite_building', '1', 60); } catch (eFl) {}
  try {
    return _readCskhDuyenLiteBuild_();
  } finally {
    try { if (_cacheB) _cacheB.remove('cskhDuyen_lite_building'); } catch (eRm) {}
  }
}
function _readCskhDuyenLiteBuild_() {
  var out = { found: false, rows: [], total: 0, noPhone: 0, noPhoneSample: [] };
  var sh = _findCskhDuyenSheet_();
  if (!sh) return out;
  out.found = true;
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) return out;
  var headerRow = sh.getRange(1, 1, 1, width).getValues()[0];
  var map = _cskhHeaderMap_(headerRow);
  if (map.phone === undefined && map.name === undefined) return out;
  // CHI lay SDT + TEN (de tim kiem/hien thi danh sach). Phan loai/dia chi/... lay luon khi mo ho so (action=cskhDetail).
  var wantedCols = [map.phone, map.name].filter(function(x) { return x !== undefined; });
  if (!wantedCols.length) return out;
  var minC = Math.min.apply(null, wantedCols), maxC = Math.max.apply(null, wantedCols);
  var block = sh.getRange(2, minC + 1, last - 1, maxC - minC + 1).getValues();
  for (var i = 0; i < block.length; i++) {
    var r = block[i];
    var nameV = map.name !== undefined ? _cskhCell_(r[map.name - minC]) : '';
    var rawPhone = map.phone !== undefined ? r[map.phone - minC] : '';
    var p = normPhone_(rawPhone);
    if (!p && !nameV) continue;
    out.total++;
    if (!p || p.length < 8) {
      out.noPhone++;
      if (out.noPhoneSample.length < 20 && nameV) out.noPhoneSample.push(nameV);
      continue;
    }
    out.rows.push([p, nameV]);
  }
  try { _cachePutBig_('cskhDuyen_lite_v2', JSON.stringify(out), 600); } catch (e2) {}
  return out;
}

// ═══ XOA HAN SDT KHONG PHAI DI DONG VIET NAM (them 2026-10-10 theo yeu cau Duyen: "xoa luon") ═══
// Pham vi = 3 sheet DANH SACH KHACH: CareData, "KH Cham soc moi", CSKH-Duyen. KHONG dong vao DT TONG / "du lieu don" (xoa don = mat doanh thu bao cao);
// dry-run se chi DEM so don co SDT la de Duyen tu quyet. Chi xoa dong co SDT khong hop le (isValidVnPhone_) VA co it nhat 1 chu so; o SDT trong/chu thuan
// (khong co so) giu nguyen. MOI dong bi xoa duoc luu truoc vao sheet "XoaSDT_Backup" (thoi gian | sheet | SDT | JSON ca dong) de khoi phuc duoc.
// Xoa tung KHOI dong lien tiep tu duoi len; het ngan sach thoi gian thi tra done:false -> chay lai (tinh lai tu dau, khong trung lap vi dong da xoa khong con).
var XOA_SDT_BUDGET_MS_ = 240000;
function _xoaSdtScan_(vals, phoneCol) {   // vals: mang 2 chieu tu dong 2; tra mang chi so (0-based theo vals) can xoa
  var bad = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i][phoneCol];
    if (raw === '' || raw === null || raw === undefined) continue;
    if (!/\d/.test(String(raw))) continue;
    if (!isValidVnPhone_(raw)) bad.push(i);
  }
  return bad;
}
function _xoaSdtRuns_(bad) {   // [[start,end],...] cac khoi lien tiep (chi so 0-based)
  var runs = [];
  for (var i = 0; i < bad.length; i++) {
    if (runs.length && bad[i] === runs[runs.length - 1][1] + 1) runs[runs.length - 1][1] = bad[i];
    else runs.push([bad[i], bad[i]]);
  }
  return runs;
}
function xoaSdtKhongPhaiVN_(opts) {
  opts = opts || {};
  var dry = !(opts.dryRun === false || opts.dryRun === 'false');
  var which = opts.sheets || ['care', 'leads', 'cskh'];
  var t0 = new Date().getTime(), res = { ok: true, dryRun: dry, done: true, sheets: {}, orders: {} };
  var lock = null;
  try {
    if (!dry) { lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { ok: false, error: 'Dang co thao tac luu khac, thu lai sau it phut.' }; }
    var targets = [];
    if (which.indexOf('care') >= 0) { var shC = getSheet_(SH_CARE, CARE_HEADERS); targets.push({ key: 'CareData', sh: shC, col: 0 }); }
    if (which.indexOf('leads') >= 0) { var shL = getSheet_(SH_CARE_LEAD, CARE_LEAD_HEADERS); targets.push({ key: SH_CARE_LEAD, sh: shL, col: 0 }); }
    if (which.indexOf('cskh') >= 0) {
      var shK = _findCskhDuyenSheet_();
      if (shK && shK.getLastRow() >= 2) {
        var mapK = _cskhHeaderMap_(shK.getRange(1, 1, 1, shK.getLastColumn()).getValues()[0]);
        if (mapK.phone !== undefined) targets.push({ key: 'CSKH-Duyen', sh: shK, col: mapK.phone });
        else res.sheets['CSKH-Duyen'] = { skipped: 'khong nhan ra cot SDT' };
      }
    }
    var bk = null, backupRows = 0;
    targets.forEach(function (tg) {
      var last = tg.sh.getLastRow(), info = { total: Math.max(0, last - 1), invalid: 0, deleted: 0, sample: [] };
      res.sheets[tg.key] = info;
      if (last < 2) return;
      var width = tg.sh.getLastColumn();
      var vals = tg.sh.getRange(2, 1, last - 1, width).getValues();
      var bad = _xoaSdtScan_(vals, tg.col);
      info.invalid = bad.length;
      if (tg.key === 'CSKH-Duyen') {   // chi DEM so SDT hop le bi lap nhieu dong (khong xoa — dong lap co the khac ten/phan loai); de Duyen tu quyet dinh
        var seenP = {}, dupRows = 0;
        for (var d = 0; d < vals.length; d++) { var np = normPhone_(String(vals[d][tg.col] || '')); if (!np || !isValidVnPhone_(np)) continue; if (seenP[np]) dupRows++; else seenP[np] = 1; }
        info.duplicateRowsKeptNotDeleted = dupRows;
      }
      for (var s = 0; s < bad.length && s < 10; s++) info.sample.push(String(vals[bad[s]][tg.col]));
      if (dry || !bad.length) return;
      if (!bk) { bk = getCrmSS_().getSheetByName('XoaSDT_Backup') || getCrmSS_().insertSheet('XoaSDT_Backup'); if (bk.getLastRow() === 0) bk.appendRow(['Thoi gian', 'Sheet', 'SDT', 'Du lieu dong (JSON)']); }
      var runs = _xoaSdtRuns_(bad), stamp = new Date().toISOString();
      for (var r = runs.length - 1; r >= 0; r--) {
        if (new Date().getTime() - t0 > XOA_SDT_BUDGET_MS_) { res.done = false; break; }
        var a = runs[r][0], b = runs[r][1], rowsOut = [];
        for (var k = a; k <= b; k++) {
          var jr = JSON.stringify(vals[k].map(function (v) { return v instanceof Date ? v.toISOString() : v; }));
          rowsOut.push([stamp, tg.key, String(vals[k][tg.col]), jr.length > 49000 ? jr.slice(0, 49000) : jr]);
        }
        bk.getRange(bk.getLastRow() + 1, 1, rowsOut.length, 4).setValues(rowsOut);   // LUU TRUOC khi xoa
        tg.sh.deleteRows(a + 2, b - a + 1);
        info.deleted += b - a + 1;
      }
    });
    if (!dry) {
      var cache = CacheService.getScriptCache();
      ['customers_v12', 'cskhDuyen_v1_n', 'cskhDuyen_idx_v1_n', 'cskhDuyen_lite_v2_n'].forEach(function (k) { try { cache.remove(k); } catch (e) {} });
      if (res.sheets.CareData && res.sheets.CareData.deleted) sbMarkStale_('xoaSdtKhongPhaiVN');   // Supabase care_data con dong cu -> khong doc Supabase cho toi khi backfill lai
    }
    // DT TONG / du lieu don: CHI DEM (khong xoa)
    try {
      var bo = 0; readAllOrders_().forEach(function (o) { if (o.phone && !isValidVnPhone_(o.phone)) bo++; });
      res.orders = { dtTongDonSdtKhongHopLe: bo, ghiChu: 'KHONG xoa don (mat doanh thu). Neu muon xoa, bao Claude de lam rieng kem sao luu.' };
    } catch (eo) { res.orders = { error: String(eo && eo.message || eo) }; }
    res.ms = new Date().getTime() - t0;
    if (!dry && !res.done) res.hint = 'Chua het (het ngan sach thoi gian) — chay lai xoaSdtLoiThat.';
    return res;
  } catch (e) { return { ok: false, error: String(e && e.message || e), partial: res }; }
  finally { try { if (lock) lock.releaseLock(); } catch (e2) {} }
}
// Chay tay tu Editor (chon ten ham o o Run, xem Execution log): xoaSdtLoiThu (CHI DEM, khong xoa) -> xoaSdtLoiThat (xoa that, lap den khi XONG).
// Rieng sheet CSKH-Duyen (~134k dong): xoaSdtLoiCskhThu (CHI DEM) -> xoaSdtLoiCskhThat (xoa that, bam lai den khi XONG; moi lan toi da ~4 phut).
function xoaSdtLoiCskhThu() { Logger.log(JSON.stringify(xoaSdtKhongPhaiVN_({ dryRun: true, sheets: ['cskh'] }), null, 2)); }
function xoaSdtLoiCskhThat() {
  var r = xoaSdtKhongPhaiVN_({ dryRun: false, sheets: ['cskh'] });
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error".' : (r.done ? 'XONG. Dong da xoa luu o sheet XoaSDT_Backup (CRM).' : 'CHUA HET — bam Run lai xoaSdtLoiCskhThat.'));
}
function xoaSdtLoiThu() { Logger.log(JSON.stringify(xoaSdtKhongPhaiVN_({ dryRun: true }), null, 2)); }
function xoaSdtLoiThat() {
  var r = xoaSdtKhongPhaiVN_({ dryRun: false });
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error".' : (r.done ? 'XONG. Dong da xoa luu o sheet XoaSDT_Backup (CRM) — can thi khoi phuc tu do.' : 'CHUA HET — bam Run lai xoaSdtLoiThat.'));
}

function readCareLeads_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CARE_LEAD);
  if (!sh || sh.getLastRow() < 2) return [];
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, CARE_LEAD_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[0]) continue;
    out.push({
      phone: normPhone_(String(r[0])), name: String(r[1]||''), note: String(r[2]||''),
      cs: String(r[3]||''), createdAt: r[4] || ''
    });
  }
  return out;
}

function addCareLead_(data) {
  var sh = getSheet_(SH_CARE_LEAD, CARE_LEAD_HEADERS);
  var phone = normPhone_(String(data.phone||''));
  if (!phone) return jsonOut_({ ok: false, error: 'Thieu SDT' });
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var colP = sh.getRange(2, 1, last-1, 1).getValues();
    for (var i = 0; i < colP.length; i++) {
      if (normPhone_(String(colP[i][0])) === phone) { rowIdx = i + 2; break; }
    }
  }
  var row = [phone, data.name||'', data.note||'', data.cs||'', new Date().toISOString()];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, CARE_LEAD_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  try { CacheService.getScriptCache().remove('care_leads_v1'); } catch(ec) {}
  return jsonOut_({ ok: true, found: rowIdx > 0 });
}

// ── Chỉ tra cứu tập SDT co trong "dữ liệu đơn" (Bao cao B) — dung de LOC nguon o
// man hinh chinh, KHONG keo chi tiet san pham vao danh sach khach ──
function readDonPhones_(rows) {
  rows = rows || readDonChiTiet_();   // tham so tuy chon: truyen san rows de khong doc lai (xem action donPhones)
  var set = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (ph) set[ph] = true;
  }
  return Object.keys(set);
}
// Map SDT -> mang ten sale tham gia don (cot "Thẻ", tach theo dau phay — 1 don co the nhieu
// sale). Dung o client de gop vao csSet, dam bao CS dung ten o BAT KY don nao trong
// "dữ liệu đơn" (du don co nhieu sale) van xem duoc KH do.
function getDonSaleByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    var names = _donSaleNamesFromThe_(rows[i].theSale);
    if (!names.length) continue;
    if (!map[ph]) map[ph] = [];
    for (var j = 0; j < names.length; j++) {
      if (map[ph].indexOf(names[j]) === -1) map[ph].push(names[j]);
    }
  }
  return map;
}

// Map SDT -> so dong (so don) trong "dữ liệu đơn" — dung de PHAN LOAI HANG KH (VIP/Than
// thiet/Tiem nang/Chua ban lai duoc) theo tieu chi moi: dem theo SO DONG trong sheet nay,
// KHONG con dua theo nguon Renew trong DT TONG nhu truoc.
// Thong ke POS theo SDT: { phone: { n: so don, rev: tong doanh thu sau giam } } -- BO don 'Da hoan'/'Dang hoan' (cung quy tac Bao cao B).
// Dung cho tong don/tong doanh thu + PHAN HANG KH cua KH da co don Pos (Pos la chuan, bo qua Base). KHONG dung cho Phan loai (van dem n tu getDonOrderCountByPhone_).
function getDonStatsByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (_donHasExcludedStatus_(r.trangThai)) continue;
    var ph = normPhone_(String(r.soDienThoai || ''));
    if (!ph) continue;
    var m = map[ph] || (map[ph] = { n: 0, rev: 0 });
    m.n += 1;
    m.rev += Number(r.giaTriSauGiam) || 0;
  }
  return map;
}

function getDonOrderCountByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    map[ph] = (map[ph] || 0) + 1;
  }
  return map;
}

// Ngay mua GAN NHAT (nguon Pos = sheet "dữ liệu đơn") theo SDT -> { phone: 'yyyy-mm-dd' }. Dung cho cot "Ngày mua gần nhất"
// o Danh sach KH (index.html). Bo qua dong khong parse duoc ngay.
// Don POS cua 1 SDT (moi nhat truoc). Doc tu readDonChiTiet_ (cache 90s) nen goi lien tiep nhieu KH khong doc lai sheet.
function getDonOrdersByPhone_(phone) {
  var ph = normPhone_(String(phone || ''));
  var out = [];
  if (!ph) return out;
  var rows = readDonChiTiet_();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (normPhone_(String(r.soDienThoai || '')) !== ph) continue;
    if (_donHasExcludedStatus_(r.trangThai)) continue;   // bo don hoan -- khop getDonStatsByPhone_ (tong tren ho so = tong lich su Pos)
    var dt = parseVNDate_(r.ngayTaoDon);
    out.push({
      date: dt ? _vnYmd_(dt) : '',
      product: r.sanPham || '',
      productCode: r.maSanPham || '',
      qty: r.soLuong || '',
      revenue: Number(r.giaTriSauGiam) || 0,
      cod: Number(r.cod) || 0,
      source: r.nguonDon || '',
      status: r.trangThai || '',
      sale: r.theSale || '',
      marketer: r.marketer || '',
      note: r.ghiChu || ''
    });
  }
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}

// Danh sach SAN PHAM (ma + ten) co trong "du lieu don" — nguon cho o tim/tick san pham cua Chuong trinh thuong (js/12 modal "Chuong trinh thuong").
// 3 cot dung 3 dau phan cach KHAC NHAU (xem buildSalesReportB_): ten ',' | ma ';' | so luong ','; ghep theo VI TRI. Ten chi lay khi dong khop so luong
// ten = so luong ma (dong lech cot thi ten khong chac khop ma -> bo qua ten, van ghi nhan ma). Tra [{code,name,n(so dong don),qty}] sap theo qty giam dan.
function buildDonProducts_(rows) {
  rows = rows || readDonChiTiet_();
  var by = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (_donHasExcludedStatus_(r.trangThai)) continue;
    var codes = splitMulti_(r.maSanPham, ';'), names = splitMulti_(r.sanPham, ','), qtys = splitMulti_(r.soLuong, ',');
    if (!codes.length) continue;
    var aligned = names.length === codes.length;
    for (var k = 0; k < codes.length; k++) {
      var code = String(codes[k] || '').trim(); if (!code) continue;
      var key = code.toLowerCase(), o = by[key] || (by[key] = { code: code, name: '', n: 0, qty: 0, nameVotes: {} });
      o.n++; o.qty += Number(String(qtys[k] || '0').replace(',', '.')) || 0;
      if (aligned && names[k]) { var nm = String(names[k]).trim(); o.nameVotes[nm] = (o.nameVotes[nm] || 0) + 1; }
    }
  }
  var out = Object.keys(by).map(function (key) {
    var o = by[key], best = '', bc = 0;
    Object.keys(o.nameVotes).forEach(function (nm) { if (o.nameVotes[nm] > bc) { bc = o.nameVotes[nm]; best = nm; } });
    return { code: o.code, name: best, n: o.n, qty: o.qty };
  });
  out.sort(function (a, b) { return b.qty - a.qty; });
  return out;
}

function getDonLastDateByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    var dt = parseVNDate_(rows[i].ngayTaoDon);
    if (!dt) continue;
    var iso = _vnYmd_(dt); // ngay duong lich VN (parseVNDate_ tra ve 00:00 gio VN = 17:00Z hom truoc, KHONG dung getDate() theo mui gio du an)
    if (!iso) continue;
    if (!map[ph] || iso > map[ph]) map[ph] = iso;
  }
  return map;
}

// Chuyen cac dong tho cua "dữ liệu đơn" thanh object don (TACH TU readDonChiTiet_ 2026-10-09 de Supabase backfill/doc dung CHUNG 1 logic —
// khong duoc co 2 ban logic lech nhau). vals = mang dong (getValues, bat dau tu so dong firstRow, 1-based); lastNgay = ngay ke thua tu dong
// co ngay gan nhat TRUOC lo nay ('' o lo dau). Tra { items:[{srcRow, obj}], lastNgay } — dong bi bo (rong/dong Tong) khong co trong items.
function _donConvertRows_(vals, firstRow, lastNgay) {
  var items = [];
  var lastNgayTaoDon = (lastNgay === undefined || lastNgay === null) ? '' : lastNgay; // ngay cua dong co ngay gan nhat phia tren — de dong thieu ngay van loc duoc theo ky
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    // SUA 2026-10-04 theo yeu cau Duyen: dong KHONG co ngay va KHONG co ten khach van la don THAT neu cot Q
    // "Ghi chú đơn" co ma bo dem (= ma bo dem cot U cua don goc o DT TONG: don len DT TONG truoc, khong bi
    // huy moi len Pos kem ghi chu; don Pos huy thi Base huy theo) -> PHAI tinh. Dong khong ngay, khong khach,
    // khong ma o Q (dong rong, dong "Tong" cuoi sheet, dong noi tiep khong phai don) thi bo.
    if (!r[1] && !r[3] && !(r[DON_COL_GHICHU] && String(r[DON_COL_GHICHU]).trim())) continue;
    var nguonDon = r[7] ? String(r[7]).trim() : '';
    // SUA 2026-09-30: TRUOC DAY loai don nguon "Bảo hành" khoi Bao cao B/C — nhung doi chieu
    // voi bang ke toan (Duyen xac nhan), doanh thu don bao hanh CO duoc tinh (vd nguyenngo1988
    // ky 1-10/9: 18.505.000 chi khop tuyet doi neu TINH ca 28 don nguon "Bảo hành" trong ky).
    // Bo han dieu kien loai nay — khong con exclude theo nguonDon nua.
    // Chuan hoa ve chuoi "dd/MM/yyyy" NGAY TAI DAY (khong giu nguyen Date object) — de:
    //  (1) parseVNDate_ luon nhan dung 1 dinh dang bat ke o goc la Date hay text,
    //  (2) ket qua serialize/deserialize duoc qua JSON.stringify khi cache (Date bi doi
    //      thanh chuoi ISO "T..." se KHONG khop dinh dang parseVNDate_ dang cho, gay sai lech
    //      ngay am tham neu khong chuan hoa truoc).
    // FIX: KHONG dung Utilities.formatDate/Session.getScriptTimeZone() (code truoc do dung) —
    // ca 2 deu phu thuoc cau hinh Time Zone cua du an Apps Script, chinh la nguyen nhan da gay
    // bug "ngay hom truoc lan sang ngay hom sau" tung gap (xem giai thich day du o _vnYmd_ phia
    // tren). Dung _vnYmdParts_ (offset VN +7 co dinh, khong phu thuoc cau hinh du an) de chuyen
    // Date -> "dd/MM/yyyy" AN TOAN TUYET DOI, dung voi moi du an bat ke Time Zone dang de la gi.
    var ngayRaw = r[1];
    var ngayTaoDon = ngayRaw;
    if (Object.prototype.toString.call(ngayRaw) === '[object Date]' && !isNaN(ngayRaw)) {
      var pDon = _vnYmdParts_(ngayRaw);
      if (pDon) ngayTaoDon = String(pDon.d).padStart(2, '0') + '/' + String(pDon.mo).padStart(2, '0') + '/' + pDon.y;
    }
    // Dong thieu ngay -> ke thua ngay cua dong co ngay gan nhat phia tren (neu khong, dateInRange_ se loai no
    // ngay khi co bo loc ngay va doanh thu bi mat am tham).
    if (ngayTaoDon === '' || ngayTaoDon === null || ngayTaoDon === undefined) ngayTaoDon = lastNgayTaoDon;
    else lastNgayTaoDon = ngayTaoDon;
    items.push({ srcRow: firstRow + i, obj: {
      ngayTaoDon:    ngayTaoDon,
      khachHang:     r[3],
      soDienThoai:   r[4],
      nguonDon:      nguonDon,
      theSale:       r[2] ? String(r[2]) : '',   // cot "Thẻ" (C) — danh sach sale tham gia don, tach bang dau phay ','
      trangThai:     r[14] ? String(r[14]).trim() : '', // cot "Trạng thái" (O) — nguon RIENG, doc lap voi trang thai co the lap trong cot "Thẻ"
      sanPham:       r[8] ? String(r[8]) : '',   // tach bang dau phay ','
      maSanPham:     r[9] ? String(r[9]) : '',   // tach bang dau cham phay ';' — KHAC voi sanPham/soLuong
      soLuong:       r[10] ? String(r[10]) : '', // tach bang dau phay ','
      giaTriSauGiam: _normMoney_(r[11]),
      cod:           _normMoney_(r[12]),
      marketer:      r[13] ? String(r[13]).trim() : '',
      ghiChu:        r[DON_COL_GHICHU] ? String(r[DON_COL_GHICHU]) : '' // cot Q — ghi chu don ("Ghép cùng đơn" + ma bo dem)
    } });
  }
  return { items: items, lastNgay: lastNgayTaoDon };
}

// ── Doc toan bo sheet "dữ liệu đơn" thanh mang object ──
// Doc sheet "dữ liệu đơn" (nguon Bao cao B — Pos), co CACHE ngan (90s) vi day la sheet lon
// (hang nghin dong) chi de DOC (CRM khong bao gio ghi vao sheet nay — du lieu vao tu Base/Pos
// dong bo rieng), nen cache ngan giup Bao cao B/thay doi bo loc khong phai doc lai toan bo
// sheet moi lan bam Loc — tang toc ro ret ma van cap nhat du lieu moi trong vong <=90s.
function readDonChiTiet_() {
  var cached = _cacheGetBig_('donChiTiet_v4'); // v4: giu dong thieu ngay/khach co ma bo dem o cot Q + ke thua ngay
  if (cached) { try { return JSON.parse(cached); } catch (eParse) {} }

  var ss = getDTSS_();
  var sh = ss.getSheetByName(DON_CHITIET_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, Math.min(DON_CHITIET_WIDTH, sh.getMaxColumns())).getValues();
  var conv = _donConvertRows_(vals, 2, '');
  var out = conv.items.map(function (it) { return it.obj; });
  try { _cachePutBig_('donChiTiet_v4', JSON.stringify(out), 90); } catch (eCache) {}
  return out;
}

// ── BAO CAO A: theo "DT TỔNG " ──
// filters: { dateFrom, dateTo, dateField ('ngayTao'|'thoiGianHT'), sale (mang ten hoac ''), kenh ('' = tat ca) }
// ── Lay danh sach Sale ban / Kenh ban distinct (cho UI chon, thay vi go dung ten) ──
// Tim 1 tab trong spreadsheet theo gid (lay tu URL "#gid=..."). Khong thay thi lui ve tab DAU
// TIEN cua file (gid=0 hau het la tab mac dinh nay) de khong bao giolam ho ghi that bai vi le
// nguoi dung xoa/doi ten tab do.
function _sheetByGid_(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) { if (sheets[i].getSheetId() === gid) return sheets[i]; }
  return sheets[0] || null;
}


function buildDashboard_() {
  var care = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  var orders = readAllOrders_();
  var phones = {}, revenue = 0, friend = 0;
  for (var i = 0; i < care.length; i++) {
    if (care[i].zalo === 'Da ket ban' || care[i].zalo === 'Đã kết bạn') friend++;
  }
  for (var j = 0; j < orders.length; j++) {
    phones[orders[j].phone] = true;
    revenue += Number(orders[j].revenue) || 0;
  }
  return { totalCustomers: Object.keys(phones).length, totalOrders: orders.length,
           totalRevenue: revenue, careRows: care.length, zaloFriends: friend };
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO DOANH SO CRM MOI (nguon: Google Sheet "DT tong" goc)
//  KHONG dung ORDER_SS_ID/ORDER_SHEETS cu — day la nguon doc lap moi.
//  Bao cao A = sheet "DT TỔNG " (cap don hang)
//  Bao cao B = sheet "dữ liệu đơn" (cap san pham, da gui khach)
// ═══════════════════════════════════════════════════════════════

var DT_SS_ID = '1fiWXPMZcHuEh0zYqD6pgQjZDM0PhWzpiSK7Igj6Cug8'; // Google Sheet "DT tong" goc

var DT_TONG_SHEET     = 'DT TỔNG ';    // luu y: co dau cach o cuoi ten sheet, giu nguyen
var DON_CHITIET_SHEET = 'dữ liệu đơn';
// SUA 2026-10-04: 15 -> 17 (them cot P + Q). Cot Q (index 16) = GHI CHU don ("Ghép cùng đơn" + ma bo dem
// don goc ben Base) — readDonChiTiet_ doc them cot nay. Dung chung cho _autoDedupExactRowsInSheet_: nang
// len 17 de 2 dong giong het A:O nhung KHAC ghi chu Q (vd 2 don ghep khac nhau) KHONG bi xoa nham la trung.
var DON_CHITIET_WIDTH = 17; // A:Q
var DON_COL_GHICHU = 16;    // cot Q (thu 17) trong "dữ liệu đơn"


// ─── DT TỔNG = nguon "don hang" CHUAN MOI (thay the hoan toan OrderData21_22..26 cu) ───
// Cot (0-indexed, A=0): A=ngayTao | C=giaoCho | D=SDT khach (dat ten cot la "Ten nhiem vu"
// nhung thuc chat luu SDT theo quy uoc noi bo) | G=giaiDoan | H=trangThai | K=thoiGianHT
// (dung lam "ngay mua" chinh, theo yeu cau Duyen 22/8/2026) | M=kenhBan | N=saleBan |
// O=sanPham (LUU Y: cot nay la text tu do nhan vien go tay ten KH+dia chi, KHONG phai
// ten san pham sach — khong dung de so khop san pham cho hoi tham tu dong/bao cao SP) |
// P=phanLoai | Q=giaTriCoc | R=giaTriDon (dung lam revenue) | S=giaTriChenh | T=id (duy
// nhat, dung de sua/xoa dong chinh xac thay vi do theo phone+nam+thang+doanh thu nhu truoc)
var DT_COL_NGAYTAO    = 0;
var DT_COL_GIAOCHO    = 2;
var DT_COL_PHONE      = 3;
var DT_COL_GIAIDOAN   = 6;
var DT_COL_TRANGTHAI  = 7;
var DT_COL_THOIGIANHT = 10;
var DT_COL_KENHBAN    = 12;
var DT_COL_SALEBAN    = 13;
var DT_COL_SANPHAM    = 14;
var DT_COL_PHANLOAI   = 15;
var DT_COL_GIATRICOC  = 16;
var DT_COL_GIATRIDON  = 17;
var DT_COL_GIATRICHENH= 18;
var DT_COL_ID         = 19;
var DT_TONG_WIDTH     = 20; // A:T
// Sentinel dung thay cho "instanceof Date" khi gia tri tho cua "DT TỔNG " di qua cache (xem
// _readDTTongRawValuesCached_) — JSON.stringify bien Date thanh chuoi ISO, mat instanceof Date.
var DT_DATE_SENTINEL_ = '\u0000__DATE__\u0000';

// Chuyen 1 hang tho cua DT TONG thanh object "don hang" (giu ten truong nhu ORDER_HEADERS
// cu de cac cho khac trong code/frontend it phai sua nhat co the)
function dtRowToOrder_(row, rowIndex) {
  var dtVal = _dtCellToVnStr_(row[DT_COL_THOIGIANHT]);
  var ngayTaoStr = _dtCellToVnStr_(row[DT_COL_NGAYTAO]);
  var d = parseVNDate_(dtVal);
  return {
    id: row[DT_COL_ID] != null ? String(row[DT_COL_ID]) : '',
    rowIndex: rowIndex,
    phone: normPhone_(String(row[DT_COL_PHONE] || '')),
    name: '', // KHONG co san ten khach rieng trong DT TONG (chi co SDT), de trong
    date: dtVal || ngayTaoStr || '',
    // orderDate: LUON la Ngay tao, KHONG bao gio doi theo trang thai don (khac voi 'date' o
    // tren, von chuyen sang Thoi gian hoan thanh ngay khi don duoc danh dau xong). Dung field
    // nay lam moc goc cho cac tinh toan can ON DINH qua thoi gian (vd: lich nhac auto Data Dao
    // +7/+14 ngay) — neu dung 'date' cu, moc goc se nhay sang ngay khac ngay khi don hoan thanh,
    // lam ID lich nhac doi theo va khien lich da xoa/da lam bi tao lai y het (bug da gap).
    orderDate: ngayTaoStr || '',
    year: d ? _vnYmdParts_(d).y : '',
    month: d ? _vnYmdParts_(d).mo : '',
    cs: String(row[DT_COL_SALEBAN] || ''),   // cot "Sale bán" — sale tham gia ban (co the nhieu ten, tach bang dau phay)
    creator: row[1] ? String(row[1]).trim() : '',   // cot B "Người tạo" cua DT TONG = NGUOI LEN DON (xem readDTTong_ nguoiTao)
    source: row[DT_COL_KENHBAN] ? String(row[DT_COL_KENHBAN]).trim() : '',
    revenue: _normMoney_(row[DT_COL_GIATRIDON]),
    product: String(row[DT_COL_SANPHAM] || ''),       // text tu do, xem luu y o tren
    productDetail: String(row[DT_COL_PHANLOAI] || ''),
    status: String(row[DT_COL_TRANGTHAI] || ''),
    zalo: '',
    note: String(row[DT_COL_GIAIDOAN] || ''),
    careCS: '' // DT TONG khong co cot rieng cho careCS — xem setOrderCareCS_ ben duoi
  };
}

function readAllOrders_() {
  // Reset thong ke loi cua lan goi truoc (doc qua readAllOrders_.lastErrorCount/lastErrorSample
  // NGAY SAU khi goi ham nay trong cung 1 request — dung de tra ve kem theo response cho action
  // 'orders', tranh tinh trang loi hang loat bi NUOT AM THAM chi con thay trong Logger.log rieng
  // ma khong ai de y — xem bug ngay 20/09: 1 dong loi -> ca readAllOrders_ throw -> 'orders'
  // tra error -> app KHONG rebuild allCustomers (giu nguyen ban cu, van con du 2k2 KH, khong ai
  // phat hien). Sau khi them try/catch (giao dien am tham hon), N dong loi bi bo qua -> chi con
  // vai dong song sot -> app REBUILD allCustomers day du nhung chi voi vai KH — mat du lieu am
  // tham con nguy hiem hon ban dau. Phai bao loi ro ra ngoai thay vi chi Logger.log noi bo.
  readAllOrders_.lastErrorCount = 0;
  readAllOrders_.lastErrorSample = '';
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  // QUAN TRONG: truoc day dong nay la `if (!sh || sh.getLastRow() < 2) return [];` — gop chung
  // 2 truong hop rat khac nhau vao 1 nhanh IM LANG (khong loi, khong log): (a) sheet CO ton tai
  // nhung chua co don nao (hop le, dung tra ve rong) va (b) sheet KHONG con ton tai/bi doi ten
  // (vd DT_TONG_SHEET = 'DT TỔNG ' co dau cach cuoi rat de bi xoa nham khi co ai sua sheet, hoac
  // DT_SS_ID tro sang spreadsheet khac/mat quyen truy cap) — day la LOI THAT nhung truoc day bi
  // nuot am tham thanh "0 don", khien app chi con hien vai KH tu luu tay (careLeads) ma khong ai
  // biet ly do vi khong co canh bao nao ca. Tach rieng: sheet KHONG ton tai -> throw ro rang
  // (doGet se bat va tra { error: ... } cho client hien canh bao that su); sheet CO ton tai nhung
  // rong -> van tra ve [] nhu cu (hop le, khong phai loi).
  if (!sh) {
    throw new Error('Khong tim thay sheet "' + DT_TONG_SHEET + '" trong spreadsheet don hang (DT_SS_ID) — kiem tra sheet co bi doi ten/xoa khong, hoac DT_SS_ID co con dung khong.');
  }
  if (sh.getLastRow() < 2) return [];
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  var out = [];
  var errCount = 0, firstErr = '';
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[DT_COL_PHONE] && !r[DT_COL_ID]) continue; // dong rong
    try {
      out.push(dtRowToOrder_(r, i + 2));
    } catch (eRow) {
      // 1 dong loi (vd gia tri ngay bat thuong) KHONG duoc lam hong ca danh sach — bo qua
      // rieng dong do, ghi log de con dieu tra, cac dong khac van doc binh thuong.
      errCount++;
      var msg = 'dong ' + (i + 2) + ': ' + (eRow && eRow.message ? eRow.message : eRow);
      if (!firstErr) firstErr = msg;
      Logger.log('readAllOrders_: loi doc dong ' + (i + 2) + ': ' + eRow);
    }
  }
  readAllOrders_.lastErrorCount = errCount;
  readAllOrders_.lastErrorSample = firstErr;
  return out;
}

// Cac don cua 1 SDT trong sheet "dữ liệu đơn" (Base/Pos): ngay, danh sach SALE THAM GIA DON (cot "Thẻ" da loc tag/trang thai bang
// _donSaleNamesFromThe_), kenh, san pham (cat ngan), gia tri. Dung cho extension (action=lookup -> don). Loi doc sheet khong lam hong lookup.
function findDonRowsByPhone_(phone) {
  var ph = normPhone_(phone), out = [];
  try {
    var rows = readDonChiTiet_();
    for (var i = 0; i < rows.length; i++) {
      if (normPhone_(String(rows[i].soDienThoai || '')) !== ph) continue;
      out.push({
        date: String(rows[i].ngayTaoDon || ''),
        sales: _donSaleNamesFromThe_(rows[i].theSale),
        source: String(rows[i].nguonDon || ''),
        product: String(rows[i].sanPham || '').slice(0, 80),
        value: rows[i].giaTriSauGiam || 0,
        marketer: String(rows[i].marketer || '')
      });
    }
  } catch (e) { Logger.log('findDonRowsByPhone_: ' + e); }
  return out.length > 30 ? out.slice(out.length - 30) : out;
}

function readOrdersByPhone_(phone) {
  var ph = normPhone_(phone);
  // TOI UU TOC DO (06/10/2026): truoc day goi readAllOrders_() = doc A:T TOAN BO DT TONG roi dung
  // object cho TUNG dong chi de loc 1 SDT. Gio chi doc cot SDT (cot D) de tim so dong khop, roi
  // chi doc A:T cua dung cac dong do va dung dtRowToOrder_ y het nhu cu (ket qua giong het).
  var out = [];
  if (!ph) return out;
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) {
    throw new Error('Khong tim thay sheet "' + DT_TONG_SHEET + '" trong spreadsheet don hang (DT_SS_ID) — kiem tra sheet co bi doi ten/xoa khong, hoac DT_SS_ID co con dung khong.');
  }
  var last = sh.getLastRow();
  if (last < 2) return out;
  var phoneCol = sh.getRange(2, DT_COL_PHONE + 1, last - 1, 1).getValues();
  var hits = [];
  for (var h = 0; h < phoneCol.length; h++) {
    if (normPhone_(String(phoneCol[h][0] || '')) === ph) hits.push(h + 2);
  }
  if (hits.length) {
    var rowsData = [];
    if (hits.length <= 12) {
      for (var q = 0; q < hits.length; q++) rowsData.push(sh.getRange(hits[q], 1, 1, DT_TONG_WIDTH).getValues()[0]);
    } else {
      var blk = sh.getRange(hits[0], 1, hits[hits.length - 1] - hits[0] + 1, DT_TONG_WIDTH).getValues();
      for (var q2 = 0; q2 < hits.length; q2++) rowsData.push(blk[hits[q2] - hits[0]]);
    }
    for (var z = 0; z < rowsData.length; z++) {
      try { out.push(dtRowToOrder_(rowsData[z], hits[z])); } catch (eRow) { Logger.log('readOrdersByPhone_: loi doc dong ' + hits[z] + ': ' + eRow); }
    }
  }
  // Khu trung dong GIONG HET (cung ngay+doanh thu+san pham) — giu logic cu, KHONG tu dong
  // xoa o day, chi de UI/extension tu phat hien va hoi xac nhan (xem findDuplicateOrders_)
  var seen = {}, deduped = [];
  for (var k = 0; k < out.length; k++) {
    var key = String(out[k].date) + '|' + String(out[k].revenue) + '|' + String(out[k].product);
    if (!seen[key]) { seen[key] = true; deduped.push(out[k]); }
  }
  return deduped;
}

// ═══════════════════════════════════════════════════════════════
//  TACH TEN KHACH TU DON HANG (backfill hang loat)
//  Cot "San pham" trong DT TONG la text tu do NV go tay, KHONG theo khuon co dinh: co don ghi
//  "Ten Sdt Dia chi...", co don ghi "Dia chi Sdt ... Ten Nhắn...", co don chi toan dia chi/ghi
//  chu gop don khong he co ten. Doan ten tu dong, CHI de xuat cho SDT hien CHUA co ten trong
//  CareData — nguoi dung phai xem/duyet tren UI truoc khi ghi that (giong het co che
//  findDuplicateOrders_ + confirm truoc khi xoa), tranh doan sai lam hong du lieu ten dang co.
// ═══════════════════════════════════════════════════════════════
var NAME_ADDR_KEYWORDS_RE_ = /\b(đường|phố|phường|xã|quận|huyện|thành phố|tỉnh|ngõ|ngách|khu|tổ|ấp|thôn|xóm|số nhà|tòa|chung cư|đc|địa chỉ)\b/i;
var NAME_MERGE_LABEL_RE_ = /^(gộp\s*(đơn|cùng)|ghép\s*đơn|địa chỉ)/i;
var NAME_ALLOWED_CHARS_RE_ = /^[a-zA-ZÀ-ỹ\s.'-]+$/;

function _stripHonorific_(s) {
  return s.replace(/^(anh|chị|chi|ông|ong|bà|ba|em|c|a)(?=[\s:.]|$)\s*[:.]?\s*/i, '').trim();
}
function _truncateAtAddressOrDigit_(s) {
  var digitIdx = s.search(/\d/);
  var kwMatch = s.match(NAME_ADDR_KEYWORDS_RE_);
  var kwIdx = kwMatch ? kwMatch.index : -1;
  var cut = -1;
  if (digitIdx >= 0 && kwIdx >= 0) cut = Math.min(digitIdx, kwIdx);
  else if (digitIdx >= 0) cut = digitIdx;
  else if (kwIdx >= 0) cut = kwIdx;
  if (cut >= 0) s = s.substring(0, cut);
  return s.trim();
}
function _isPlausibleName_(s) {
  if (!s) return false;
  s = s.trim();
  if (s.length < 2 || s.length > 40) return false;
  if (!NAME_ALLOWED_CHARS_RE_.test(s)) return false;
  if (s.split(/\s+/).length > 5) return false;
  return true;
}
// Tra ve TAT CA ten "ung vien" hop le tim duoc trong 1 doan text don hang, thu 2 cach:
// (A) dau dong, cat truoc so/tu khoa dia chi dau tien (bat truong hop "Ten Sdt Dia chi...")
// (B) doan ngay SAU so dien thoai, truoc chu "Nhắn" (bat truong hop "...Sdt Ten Nhắn...")
function _guessNameCandidatesFromOrderText_(text, phoneDigits) {
  var out = [];
  if (!text) return out;
  var raw = String(text);
  var firstLine = raw.split('\n')[0].trim();
  if (firstLine && !NAME_MERGE_LABEL_RE_.test(firstLine)) {
    var a = firstLine.replace(/(\+?84|0)\d{8,10}/g, '');
    a = _stripHonorific_(a);
    a = a.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '');
    a = _truncateAtAddressOrDigit_(a);
    if (_isPlausibleName_(a)) out.push(a);
  }
  if (phoneDigits) {
    var idx = raw.indexOf(phoneDigits);
    if (idx >= 0) {
      var after = raw.substring(idx + phoneDigits.length);
      var nhanMatch = after.match(/nh[ắaằ]n\b/i);
      var seg = nhanMatch ? after.substring(0, nhanMatch.index) : after.substring(0, 40);
      seg = _stripHonorific_(seg.trim());
      seg = seg.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '');
      seg = _truncateAtAddressOrDigit_(seg);
      if (_isPlausibleName_(seg)) out.push(seg);
    }
  }
  return out;
}
// Giu lai ten cu de tuong thich cac cho khac co the dang goi (tra ve ung vien dau tien theo
// cach (A) - hanh vi gan giong ham cu, chi them buoc cat tai dia chi/so cho chinh xac hon).
function _parseNameFromOrderText_(text) {
  var cands = _guessNameCandidatesFromOrderText_(text, '');
  return cands.length ? cands[0] : '';
}
// Quet TAT CA don cua 1 sdt, gom ung vien ten tu tung don, lay ten xuat hien NHIEU LAN NHAT
// (thay vi chi lay don dau tien tim thay — tranh vo tinh chon phai don khong co ten/co nhan
// gop don ma bo qua cac don khac cua cung khach da co ten ro rang).
function _guessNameForPhone_(orders, phoneDigits) {
  var freq = {}, bestKey = null;
  for (var i = 0; i < orders.length; i++) {
    var cands = _guessNameCandidatesFromOrderText_(orders[i].product, phoneDigits);
    for (var j = 0; j < cands.length; j++) {
      var key = cands[j].toLowerCase();
      if (!freq[key]) freq[key] = { count: 0, sample: cands[j] };
      freq[key].count++;
      if (!bestKey || freq[key].count > freq[bestKey].count) bestKey = key;
    }
  }
  return bestKey ? freq[bestKey].sample : '';
}

// Quet toan bo DT TONG, doan ten cho tung SDT (gom TAT CA don cua sdt do, lay ten xuat hien
// nhieu lan nhat) — CHI tra ve de UI hien danh sach cho nguoi dung duyet, KHONG ghi gi vao Sheet.
function previewCustomerNameGuesses_() {
  var orders = readAllOrders_();
  var careRows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  var existingNames = {};
  for (var c = 0; c < careRows.length; c++) {
    if (careRows[c].name) existingNames[normPhone_(String(careRows[c].phone))] = true;
  }
  var byPhone = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (!o.phone || existingNames[o.phone]) continue;
    if (!byPhone[o.phone]) byPhone[o.phone] = [];
    byPhone[o.phone].push(o);
  }
  var out = [];
  Object.keys(byPhone).forEach(function (phone) {
    var phoneOrders = byPhone[phone];
    var guess = _guessNameForPhone_(phoneOrders, phone);
    if (!guess) return;
    out.push({ phone: phone, guessedName: guess, sample: String(phoneOrders[0].product || '').split('\n')[0].trim().substring(0, 120) });
  });
  return { ok: true, count: out.length, items: out };
}


// Ghi that danh sach ten DA DUOC NGUOI DUNG XAC NHAN tren UI (items: [{phone, name}]).
// Kiem tra lai lan nua tren server: chi ghi cho SDT VAN CHUA co ten tai thoi diem ghi
// (tranh ghi de neu vua co ai do — vd Pancake AI — cap nhat ten trong luc dang duyet danh sach).
function applyCustomerNameGuesses_(items) {
  if (!items || !items.length) return jsonOut_({ ok: false, error: 'Danh sach rong' });
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow();
  var index = {};
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, CARE_HEADERS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (vals[i][0]) index[normPhone_(String(vals[i][0]))] = { rowNum: i + 2, name: vals[i][19] || '' };
    }
  }
  var updated = 0, appended = 0, skipped = 0;
  var newRows = [];
  for (var k = 0; k < items.length; k++) {
    var it = items[k];
    var phone = normPhone_(String(it.phone || ''));
    var name = String(it.name || '').trim();
    if (!phone || !name) { skipped++; continue; }
    var ex = index[phone];
    if (ex) {
      if (ex.name) { skipped++; continue; }
      sh.getRange(ex.rowNum, 20).setValue(name);
      updated++;
    } else {
      newRows.push(careRow_({ phone: phone, name: name }));
      appended++;
    }
  }
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, CARE_HEADERS.length).setValues(newRows);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch (ec) {}
  return jsonOut_({ ok: true, updated: updated, appended: appended, skipped: skipped });
}

function getDTSS_() {
  return DT_SS_ID
    ? SpreadsheetApp.openById(DT_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// Chuyen 1 gia tri o "Ngay tao"/"Thoi gian hoan thanh" cua sheet DT TONG thanh chuoi
// 'dd/MM/yyyy HH:mm'.
//
// QUAN TRONG — DA DOI CHIEU TUNG DON VOI BAO CAO CHUAN CUA BASE (19/09/2026) DE XAC NHAN:
// Date object doc duoc tu cot nay co GIO/PHUT DUNG Y HET so dang hien tren man hinh Sheet
// (vd o hien "18/09/2026 23:14" thi val.getUTCHours()=23, val.getUTCMinutes()=14) — TUC LA
// KHONG CAN CONG/TRU GI THEM, chi can doc thang cac thanh phan UTC cua Date la ra dung.
//
// Vi vay ham nay KHONG dung Utilities.formatDate(val, tz, ...) voi bat ky ma mui gio nao
// (khong ss.getSpreadsheetTimeZone(), cang khong hardcode 'Asia/Ho_Chi_Minh') — ca 2 cach
// do DEU SAI cho rieng cot nay:
//   - 'Asia/Ho_Chi_Minh' (GMT+7): CONG THEM +7 tieng vao so da dung san -> don tao khung
//     18h-24h bi day nham sang NGAY HOM SAU (bug goc, da fix 20/09 sang nhung bi 1 ban vá
//     sau do vo tinh dua "Asia/Ho_Chi_Minh" vao lam fallback nen tai dien: Page HT3 nhay
//     tu dung 106tr len sai 180tr — chinh la trieu chung Duyen bao lai).
//   - ss.getSpreadsheetTimeZone(): co the tra ve gia tri khien Utilities.formatDate throw
//     "Đối số không hợp lệ: timeZone" hang loat (2.432 dong), lam rong ca danh sach don.
// Doc thang tu cac ham getUTC*() cua JS Date (khong qua Utilities/mui gio nao ca) vua tranh
// duoc crash (thuan JS, khong goi API nao co the loi "timeZone khong hop le") vua khong bao
// gio cong/tru sai gio, bat ke Date object do lay tu Sheet dang cau hinh mui gio gi.
function _dtCellToVnStr_(val) {
  if (val === '' || val === null || val === undefined) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    if (isNaN(val.getTime())) return '';
    var pad2 = function(n) { return (n < 10 ? '0' : '') + n; };
    return pad2(val.getUTCDate()) + '/' + pad2(val.getUTCMonth() + 1) + '/' + val.getUTCFullYear() +
      ' ' + pad2(val.getUTCHours()) + ':' + pad2(val.getUTCMinutes());
  }
  return val;
}

// ── Parse ngay dang DD/MM/YYYY (chuoi) hoac Date that (doc truc tiep tu Google Sheet) ──
// KHONG dung new Date(chuoi) truc tiep: JS hieu chuoi kieu MM/DD/YYYY, se sai am tham
// voi cac ngay <=12 (vd 01/07/2026 se bi hieu la 1 thang 7 thay vi 7 thang 1).
// Chuan hoa gio VN: dung Date.UTC() (LUON tuyet doi, khong phu thuoc cau hinh Time Zone cua du
// an Apps Script) roi tru/cong 7 tieng — TRANH HOAN TOAN phu thuoc vao "Time Zone" cua du an
// (Project Settings > Time zone / appsscript.json). Neu cau hinh do vo tinh KHONG phai gio VN
// (vd bi de mac dinh khac, hoac chua ai chinh), moi cho dung new Date(chuoi)/new
// Date(y,mo-1,d)/.getFullYear() kieu cu se BI LECH GIO AM THAM — day chinh la nguyen nhan bug
// "ngay hom truoc lan sang ngay hom sau" da gap (Duyen xac nhan ngay 19/09/2026).
var VN_OFFSET_MS = 7 * 3600 * 1000;
function _vnMidnight_(y, mo, d) { return new Date(Date.UTC(y, mo - 1, d) - VN_OFFSET_MS); }
// Tra ve chuoi 'yyyy-MM-dd' CUA DUNG NGAY DUONG LICH VIET NAM cho 1 thoi diem (Date) bat ky —
// khong dung Utilities.formatDate/Session.getScriptTimeZone() vi ban than 2 cai do cung phu
// thuoc cau hinh du an; tu tinh tay bang offset co dinh +7 (Viet Nam khong co DST) la chac chan
// dung 100% du du an cau hinh Time Zone la gi.
function _vnYmd_(dt) {
  if (!dt || isNaN(dt.getTime())) return '';
  var shifted = new Date(dt.getTime() + VN_OFFSET_MS);
  return shifted.getUTCFullYear() + '-' + String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-' + String(shifted.getUTCDate()).padStart(2, '0');
}
// Tra ve {y, mo (1-12), d} la NGAY DUONG LICH VN dung cua 1 thoi diem (Date) bat ky — dung
// cho MOI noi can tach nam/thang/ngay (tuan/thang/quy Bao cao C, year/month cua don hang...).
// Cung 1 co che UTC + offset co dinh voi _vnMidnight_/_vnYmd_ o tren, khong bao gio dung
// .getFullYear()/.getMonth()/.getDate() truc tiep (phu thuoc cau hinh Time Zone du an).
function _vnYmdParts_(dt) {
  if (!dt || isNaN(dt.getTime())) return null;
  var shifted = new Date(dt.getTime() + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

function parseVNDate_(val) {
  if (!val && val !== 0) return null;
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return isNaN(val.getTime()) ? null : val;
  }
  var s = String(val).trim();
  if (!s) return null;
  // tach phan ngay khoi phan gio neu co (vd "21/08/2026 10:30")
  var datePart = s.split(' ')[0];
  var m = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (y < 100) y += 2000;
  var dt = _vnMidnight_(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// Chuyen 1 chuoi ngay bat ky (co the la 'yyyy-MM-dd' tu <input type=date>, hoac 'DD/MM/YYYY')
// thanh chuoi 'yyyy-MM-dd' CHUAN GIO VN. Voi 'yyyy-MM-dd' thi dung thang khong qua Date object
// nao ca — an toan tuyet doi, khong co co hoi lech gio.
function _dateStrToVnYmd_(s) {
  if (!s) return '';
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = parseVNDate_(s);
  return d ? _vnYmd_(d) : '';
}

function dateInRange_(dt, fromStr, toStr) {
  if (!dt) return !fromStr && !toStr; // khong parse duoc: chi loai neu co bo loc ngay
  // So sanh bang CHUOI 'yyyy-MM-dd' (gio VN, tinh tay bang offset co dinh +7) thay vi tru Date
  // object — tranh hoan toan cac bug lech gio do Date instant + ambient timezone gay ra (da gap
  // bug "ngay hom truoc lan sang ngay hom sau" khi so sanh kieu cu).
  var dKey = _vnYmd_(dt);
  if (fromStr) {
    var fKey = _dateStrToVnYmd_(fromStr);
    if (fKey && dKey < fKey) return false;
  }
  if (toStr) {
    var tKey = _dateStrToVnYmd_(toStr);
    if (tKey && dKey > tKey) return false;
  }
  return true;
}

// Loai don khoi doanh so/so don theo dung 1 nguon DUY NHAT: cot "Trang thai don" (DT TONG:
// cot H; Bao cao B/POS: token khong-khoang-trang... KHONG, token CO khoang trang trong cot
// "Thẻ" — xem _donHasExcludedStatus_). KHONG suy dien them tu "Giai doan"/nguon khac.
// Theo xac nhan cua Duyen (24/09/2026): cot nay CHI TUNG xuat hien dung 6 gia tri can loai —
// Da hoan, Dang hoan, Dang hoan hang, Da hoan hang, Hoan hang, Hoan tien — so sanh KHOP TOAN
// BO chuoi (khong phai substring) de tuyet doi khong dung nham cac trang thai khac (vd "Hoan
// thanh" la don TOT, khong duoc loai). Neu sau nay Pancake/Base sinh them trang thai moi cung
// nghia "hoan/huy" thi them dung vao mang duoi day, khong doan mo rong bang regex.
var EXCLUDED_ORDER_STATUSES_ = ['huy', 'da huy', 'da hoan', 'dang hoan', 'dang hoan hang', 'da hoan hang', 'hoan hang', 'hoan tien']; // 'huy'/'da huy' them 2026-09-30 theo xac nhan cua Duyen (rieng cot Trạng thái cua Bao cao B/POS co gia tri nay)
function _isExcludedOrderStatus_(trangThai) {
  var s = _stripVN_(trangThai).trim();
  if (!s) return false;
  return EXCLUDED_ORDER_STATUSES_.indexOf(s) !== -1;
}


// Chuan hoa gia tri tien: khong co don nao thuc te duoi 1 nghin dong. Neu Sheet nhap thieu 3 so 0
// (vd go "900" thay vi "900000" — pho bien khi go tat theo don vi nghin), gia tri doc len se < 1000
// va SAI mot cach am tham (thieu dung 1000 lan) neu khong xu ly. Voi moi so > 0 va < 1000, hieu la
// dang nhap theo don vi nghin dong va nhan lai 1000 cho dung don vi dong that.
function _normMoney_(n) {
  // Neu o tien la CHUOI TEXT (thuong gap khi copy/paste tu Excel/file khac, hoac o duoc dinh
  // dang dang Text trong Sheet) co dau phay/cham phan cach hang nghin va/hoac ky hieu tien te
  // (vd "1,000,000", "1.000.000đ", "1,000,000 ₫") thi Number(...) se ra NaN, va "NaN || 0" se
  // AM THAM tra ve 0 — lam mat doanh thu ma khong bao loi gi. Don vi VND khong dung phan thap
  // phan (khong co le), nen an toan de bo HET dau cham/phay/khoang trang/ky hieu tien te truoc
  // khi parse so.
  if (typeof n === 'string') {
    n = n.replace(/[.,\s₫đĐ]/g, '');
  }
  n = Number(n) || 0;
  if (n > 0 && n < 1000) return n * 1000;
  return n;
}

function splitMulti_(str, delimiter) {
  if (!str && str !== 0) return [];
  var s = String(str);
  if (!s.trim()) return [];
  return s.split(delimiter).map(function(x){ return x.trim(); }).filter(function(x){ return x !== ''; });
}

// Toan bo ten that da tung duoc ghi nhan la Nhan vien/Sale (gop ca ten hien thi tren Pancake
// VA ten Sale CRM da khop trong bang "Khớp tên Nhân viên Pancake ↔ Sale CRM"), chuan hoa qua
// _normTxt_ (bo khoang trang thua + chu thuong, GIU dau) de so khop khong phan biet hoa/thuong.
// Cache trong pham vi 1 lan chay (doGet/doPost) — khong can doc lai sheet nhieu lan trong cung
// 1 request du goi _donSaleNamesFromThe_ hang chuc/hang tram lan (vd duyet het dong "dữ liệu đơn").
var __pancakeKnownSaleSet_ = null;
function _pancakeKnownSaleNameSet_() {
  if (__pancakeKnownSaleSet_) return __pancakeKnownSaleSet_;
  var set = {};
  try { pancakeAllNames_().forEach(function(n){ set[_normTxt_(n)] = true; }); } catch (e) {}
  try {
    var map = readPancakeMap_();
    Object.keys(map).forEach(function(k){
      set[_normTxt_(k)] = true;
      if (map[k]) set[_normTxt_(map[k])] = true;
    });
  } catch (e) {}
  __pancakeKnownSaleSet_ = set;
  return set;
}

// Cot "Thẻ" trong sheet "dữ liệu đơn" (Pancake POS) chua CA ten sale LAN cac tag KHONG PHAI
// sale (trang thai don nhu "Đang giao hàng"/"Chưa đối soát"/"Giao không thành", hoac cac nhan
// khac nhu "VIP"/"Freeship"...), vd "anhNP1999, Đang đối soát, VIP" hoac "dungnguyen1995,
// bichnguyen1993, Giao không thành" (nhieu sale + nhieu tag khac). Ban chat: don vAn chia cho
// DUNG NHUNG SALE THAT SU co mat, bat ke con lai bao nhieu hang muc the khac khong phai sale.
// Uu tien doi chieu tung token voi danh sach Nhan vien/Sale THAT SU da tung ghi nhan (xem
// _pancakeKnownSaleNameSet_) — cach nay dung duoc ca voi tag 1-tu khong phai sale (vd "VIP",
// "Freeship") ma heuristic khoang-trang truoc day khong loai duoc. Chi khi KHONG token nao
// khop duoc danh sach da biet (vd sale qua moi, chua tung xuat hien o dau) moi lui ve heuristic
// cu: giu token khong co khoang trang (ten dang nhap Pancake khong co dau cach; tag/trang thai
// tieng Viet nhieu chu luon co) — de khong lam mat hoan toan 1 sale that nhung chua kip ghi nhan.
// Loc "Theo Team" o Bao cao B (POS) bi ra 0 doanh thu du Team da co du thanh vien — nguyen nhan:
// cot "Thẻ" trong sheet "dữ liệu đơn" ghi USERNAME dang nhap Pancake (vd "ninhnga99"), trong khi
// Team/CareData.cs dung TEN SALE CHUAN (vd "Ngà") — 2 dang ten KHAC NHAU, so sanh truc tiep
// khong bao gio khop. PancakeNameMap da co san anh xa 2 chieu nay (dung cho Bao cao tuong tac/SDT
// Pancake) — tai su dung de MO RONG moi ten trong bo loc thanh ca chinh no LAN cac username
// Pancake da tung khop voi ten do, truoc khi dem so sanh voi "Thẻ".
function _expandSaleFilterWithPancakeAliases_(names) {
  if (!names || !names.length) return names;
  var map = readPancakeMap_(); // pancakeName -> saleName (co the "saleA|saleB")
  var foldIn = {};
  names.forEach(function(n) { if (n) foldIn[_normTxt_(n)] = true; });
  var out = names.slice();
  Object.keys(map).forEach(function(pancakeName) {
    var saleNames = String(map[pancakeName] || '').split('|').map(function(s){ return s.trim(); }).filter(Boolean);
    if (saleNames.some(function(sn) { return foldIn[_normTxt_(sn)]; })) out.push(pancakeName);
  });
  return out;
}

// Ten "sale" dac biet co khoang trang tren cot The (khong phai username Pancake) nhung ke toan van tinh la 1 sale rieng — vd
// "Diệu Tâm DMP" (don Kenh Duoc, thang 9: 2 don / 32.250.000d). Khong them thi bi coi la tag va don roi vao "(chưa gán sale)".
// Gia tri phai o dang chuan hoa _normTxt_ (chu thuong, giu dau).
var POS_EXTRA_SALE_NAMES_ = ['diệu tâm dmp'];
function _donSaleNamesFromThe_(theStr) {
  var tokens = splitMulti_(theStr, ',');
  if (!tokens.length) return [];
  var known = _pancakeKnownSaleNameSet_();
  // SUA 2026-10-05 (loi lech doanh thu Pos vs ke toan, vd ninhnga99 906.411.333 vs 816.953.667): TRUOC DAY chi giu token
  // nam trong danh sach "known" (PancakeStats + PancakeNameMap). Sale THAT chua tung duoc nhap vao 2 sheet do (vd
  // biichnguyen1993, dungnguyen1995, giangnguyen1990, nguyenngo1988, thuydinh95, nonghong88, mainguyen97...) bi BO RA ngay khi
  // don co >=1 sale khac da biet — don chia 2 nguoi chi con 1 nguoi nhan CA tien (nguoi kia mat phan), nen sale nay bi thieu
  // (bichnguyen1993 86 don -> 39) va sale di cung bi thua (ninhnga99 +89tr). Fix: ngoai danh sach known, van nhan token
  // KHONG khoang trang va co CHU SO (ten dang nhap Pancake luon dang "ninhnga99"), con tag/trang thai thuong co khoang trang
  // ("Chưa đối soát", "Giao không thành") hoac khong co so ("VIP", "Freeship") van bi loai nhu cu.
  var matched = tokens.filter(function(tok) {
    if (known[_normTxt_(tok)]) return true;
    if (POS_EXTRA_SALE_NAMES_.indexOf(_normTxt_(tok)) !== -1) return true;
    return !/\s/.test(tok) && /\d/.test(tok);
  });
  if (matched.length) return matched;
  return tokens.filter(function(tok) { return tok && !/\s/.test(tok); });
}
// SUA 2026-09-30 theo xac nhan CUOI CUNG cua Duyen: viec loai don khoi doanh so Bao cao B
// CHI dua vao MOT nguon DUY NHAT — cot rieng "Trạng thái" (cot O trong sheet "dữ liệu đơn"):
// loai neu la Huỷ / Đã hoàn / Đang hoàn. Cot "Thẻ" (C) TUYET DOI KHONG con dung de xet trang
// thai nua — chi dung de tach ten sale chia doanh thu (xem _donSaleNamesFromThe_ o tren).
// (Ban than sheet cung da duoc Duyen xoa het cac dong Huy/Hoan/Dang hoan thu cong; ham nay
// van giu de an toan cho du lieu phat sinh sau nay.)
// SUA 2026-10-03 theo xac nhan cua Duyen: POS (sheet "dữ liệu đơn") CHI loai 2 trang thai "Đã hoàn"
// va "Đang hoàn" (khop TOAN BO chuoi, khong dau/khong phan biet hoa-thuong). TRUOC DAY Pos dung chung
// EXCLUDED_ORDER_STATUSES_ voi Base (con loai them Huy/Hoan hang/Hoan tien...) nen khac dinh nghia
// thuc te cua Pos. Danh sach Base (EXCLUDED_ORDER_STATUSES_) GIU NGUYEN, chi anh huong DT TONG.
// Ham nay CHI duoc goi boi Bao cao B (+E/F doc qua B) va G — khong dung cho Base.
var POS_EXCLUDED_ORDER_STATUSES_ = ['da hoan', 'dang hoan'];
function _donHasExcludedStatus_(trangThaiCol) {
  var s = _stripVN_(trangThaiCol).trim();
  if (!s) return false;
  return POS_EXCLUDED_ORDER_STATUSES_.indexOf(s) !== -1;
}

// ── Doc toan bo sheet "DT TỔNG " thanh mang object ──
// Cai dat "An/Hien Page & Sale khoi bao cao chung" (yeu cau 2026-09-25): admin tu chon
// nhung Page/kenh va Sale khong thuoc pham vi quan ly cua minh de AN khoi moi bao cao
// dung chung (Dashboard, Bao cao doanh so A-E, KPI Pancake...). Luu 2 setting JSON array
// dung chung pattern voi cac setting khac (getSetting_/setSetting_).
function _hiddenPageSaleSets_() {
  var hc = [], hs = [];
  try { var v = getSetting_('hiddenChannels'); if (v) hc = JSON.parse(v); } catch (e) {}
  try { var v2 = getSetting_('hiddenSales'); if (v2) hs = JSON.parse(v2); } catch (e2) {}
  return { channels: hc, sales: hs };
}
// 1 dong DT TONG bi AN neu: kenh ban nam trong danh sach an, HOAC tat ca sale tren dong do
// (co the nhieu ten, cach nhau dau phay) deu nam trong danh sach an sale (con >=1 sale
// KHONG bi an thi van hien binh thuong, tranh an nham don co ca sale minh quan ly dung chung).
function _isDTRowHidden_(kenhBan, saleBan, sets) {
  if (sets.channels.length && kenhBan && sets.channels.indexOf(kenhBan) !== -1) return true;
  if (sets.sales.length && saleBan) {
    var names = String(saleBan).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if (names.length && names.every(function(n){ return sets.sales.indexOf(n) !== -1; })) return true;
  }
  return false;
}

function readDTTong_() {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 20).getValues();
  var hiddenSets = _hiddenPageSaleSets_();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    // Dong rong that su: khong SDT, khong ID, VA khong co gia tri don hang (r[17]) — truoc day
    // chi check thieu SDT+ID la bo qua ca dong, nhung neu dong do LAI CO gia tri doanh thu that
    // (vd don nhap tay/import cu chua kip gan SDT/ID) thi se bi am tham mat doanh thu khoi
    // Bao cao A (thap hon thuc te ma khong bao loi gi). Them dieu kien r[17] de an toan hon.
    if (!r[3] && !r[19] && !r[17]) continue;
    var kenhBan = r[12] ? String(r[12]).trim() : '';
    var saleBan = r[13] ? String(r[13]) : '';
    if (_isDTRowHidden_(kenhBan, saleBan, hiddenSets)) continue;
    try {
      out.push({
        ngayTao:        _dtCellToVnStr_(r[0]),
        nguoiTao:       r[1] ? String(r[1]).trim() : '',
        giaoCho:        r[2],
        giaiDoan:       r[6],
        trangThai:      r[7],
        thoiGianHT:     _dtCellToVnStr_(r[10]),
        kenhBan:        kenhBan,
        saleBan:        saleBan,
        sanPham:        r[14],
        phanLoai:       r[15],
        giaTriCoc:      _normMoney_(r[16]),
        giaTriDon:      _normMoney_(r[17]),
        giaTriChenh:    _normMoney_(r[18]),
        id:             r[19]
      });
    } catch (eRow) {
      Logger.log('readDTTong_: loi doc dong ' + (i + 2) + ': ' + eRow);
    }
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════
//  BROADCAST — Gui tin hang loat qua Zalo (ZaloAI extension) — v13.1
//  Luu 1 sheet "Broadcasts": moi hang la 1 chien dich
//  Anh dinh kem duoc upload len 1 folder Google Drive rieng (xem BROADCAST_FOLDER_ID)
// ═══════════════════════════════════════════════════════════════
var SH_BROADCAST = 'Broadcasts';
var BROADCAST_HEADERS = ['id','label','message','imagesJson','phonesJson','sentJson','csName','createdAt','status','expectedNick','perPhoneMsgJson','perPhoneNickJson'];

// ⚠️ BAT BUOC: tao 1 folder rieng trong Google Drive de luu anh chien dich,
//    mo folder -> copy ID trong URL (phan sau /folders/) -> dan vao day.
//    Nho: folder do se duoc set quyen "Anyone with link" cho tung anh khi upload.
var BROADCAST_FOLDER_ID = '1q4uoHhjmf1yfUjHoYLPAjcNWkr4Ue2J8';

function getBroadcastSheet_() {
  return getSheet_(SH_BROADCAST, BROADCAST_HEADERS);
}

function readBroadcasts_() {
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, BROADCAST_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[0]) continue;
    var images = [], phones = [], sent = {}, perPhoneMsg = {}, perPhoneNick = {};
    try { images = JSON.parse(r[3] || '[]'); } catch (e) {}
    try { phones = JSON.parse(r[4] || '[]'); } catch (e) {}
    try { sent = JSON.parse(r[5] || '{}'); } catch (e) {}
    try { perPhoneMsg = JSON.parse(r[10] || '{}'); } catch (e) {}
    try { perPhoneNick = JSON.parse(r[11] || '{}'); } catch (e) {}
    out.push({
      id: r[0], label: r[1], message: r[2],
      images: images, phones: phones, sent: sent,
      csName: r[6], createdAt: r[7], status: r[8] || 'active',
      expectedNick: r[9] || '', perPhoneMsg: perPhoneMsg, perPhoneNick: perPhoneNick
    });
  }
  return out;
}

// Tao moi hoac cap nhat 1 chien dich (giu nguyen sentJson neu da co, tru khi truyen kem)
function saveBroadcast_(b) {
  if (!b || !b.phones || !b.phones.length) return jsonOut_({ ok: false, error: 'Thieu danh sach SDT' });
  var sh = getBroadcastSheet_();
  var id = b.id || ('bc_' + Date.now());
  var last = sh.getLastRow();
  var foundRow = -1, existingSent = {};
  if (last >= 2) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {
        foundRow = i + 2;
        try { existingSent = JSON.parse(sh.getRange(foundRow, 6).getValue() || '{}'); } catch (e) {}
        break;
      }
    }
  }
  var sentMap = b.sent || existingSent || {};
  var row = [
    id, b.label || '', b.message || '',
    JSON.stringify(b.images || []),
    JSON.stringify(b.phones || []),
    JSON.stringify(sentMap),
    b.csName || '',
    b.createdAt || new Date().toISOString(),
    b.status || 'active',
    b.expectedNick || '',
    JSON.stringify(b.perPhoneMsg || {}),
    JSON.stringify(b.perPhoneNick || {})
  ];
  if (foundRow > 0) sh.getRange(foundRow, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true, id: id });
}

// Danh dau 1 SDT la da gui / loi / bo qua trong 1 chien dich cu the
function broadcastMark_(id, phone, status) {
  if (!id || !phone) return jsonOut_({ ok: false, error: 'Thieu id/phone' });
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonOut_({ ok: false, error: 'Chua co chien dich nao' });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      var rowIdx = i + 2;
      var sent = {};
      try { sent = JSON.parse(sh.getRange(rowIdx, 6).getValue() || '{}'); } catch (e) {}
      sent[normPhone_(phone)] = { status: status || 'sent', ts: new Date().toISOString() };
      sh.getRange(rowIdx, 6).setValue(JSON.stringify(sent));
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ ok: false, error: 'Khong tim thay chien dich' });
}

// Danh sach chien dich dang active + cac SDT CHUA gui, loc theo CS dang dung extension
// (neu chien dich khong gan csName cu the thi hien cho tat ca CS)
function broadcastQueueForCS_(csName) {
  var all = readBroadcasts_().filter(function (b) {
    var st = b.status || 'active';
    return st === 'active' || st === 'paused';
  });
  // CS cham soc tung khach (CareData) -> extension chi gui khach cua CS dang chon
  var csMap = {};
  try {
    var careRowsQ = readCare_(getCrmSS_().getSheetByName(SH_CARE));
    for (var cqi = 0; cqi < careRowsQ.length; cqi++) {
      csMap[normPhone_(careRowsQ[cqi].phone)] = String(careRowsQ[cqi].cs || '').trim().toLowerCase();
    }
  } catch (e) {}
  var out = [];
  all.forEach(function (b) {
    if (csName && b.csName) {
      var csList = String(b.csName).toLowerCase().split(',').map(function(x){ return x.trim(); }).filter(String);
      if (csList.length && csList.indexOf(String(csName).toLowerCase().trim()) === -1) return;
    }
    var pending = (b.phones || []).filter(function (p) {
      var np = normPhone_(p);
      return !b.sent || !b.sent[np];
    });
    if (pending.length) {
      out.push({
        id: b.id, label: b.label, message: b.message, images: b.images,
        pendingPhones: pending,
        total: b.phones.length,
        doneCount: b.phones.length - pending.length,
        status: b.status || 'active',
        createdAt: b.createdAt || '',
        expectedNick: b.expectedNick || '',
        perPhoneMsg: b.perPhoneMsg || {},
        perPhoneNick: b.perPhoneNick || {},
        perPhoneCS: (function () {
          var m = {};
          for (var pqi = 0; pqi < pending.length; pqi++) m[pending[pqi]] = csMap[pending[pqi]] || '';
          return m;
        })()
      });
    }
  });
  return out;
}

// Upload 1 anh (base64) len Drive folder rieng, set quyen xem cong khai qua link, tra ve URL
function uploadBroadcastImage_(base64, filename, mimeType) {
  if (!base64) return jsonOut_({ ok: false, error: 'Thieu du lieu anh' });
  var folder;
  try { folder = DriveApp.getFolderById(BROADCAST_FOLDER_ID); }
  catch (e) { return jsonOut_({ ok: false, error: 'Chua cau hinh dung BROADCAST_FOLDER_ID (xem comment dau ham)' }); }
  try {
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', filename || ('img_' + Date.now() + '.jpg'));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var directUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return jsonOut_({ ok: true, url: directUrl, fileId: file.getId() });
  } catch (e) {
    return jsonOut_({ ok: false, error: e.message });
  }
}

// Huy 1 chien dich (khong xoa du lieu, chi doi status de extension ngung lay ve)
function broadcastSetStatus_(id, status) {
  if (!id) return jsonOut_({ ok: false, error: 'Thieu id' });
  status = (status === 'paused') ? 'paused' : 'active';
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonOut_({ ok: false, error: 'Chua co chien dich' });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) { sh.getRange(i + 2, 9).setValue(status); return jsonOut_({ ok: true, status: status }); }
  }
  return jsonOut_({ ok: false, error: 'Khong tim thay chien dich' });
}

function broadcastCancel_(id) {
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonOut_({ ok: false });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) { sh.getRange(i + 2, 9).setValue('cancelled'); return jsonOut_({ ok: true }); }
  }
  return jsonOut_({ ok: false, error: 'Khong tim thay chien dich' });
}

// ═══════════════════════════════════════════════════════════════
//  HOI THAM TU DONG THEO NGAY MUA (Follow-up scheduler)
//  - Doi chieu OrderData (uu tien) + ZaloContactScan (du phong, doc tu
//    ten hien thi Zalo do CS dat theo cu phap: "6+7 HH Ten khach, SDT")
//  - Cac moc ngay + noi dung tin theo tung san pham duoc cau hinh trong
//    sheet "FollowUpTemplates" (tu quan ly, khong can sua code):
//      cot A productCode | cot B days | cot C template
//      VD: HH | 7 | "Chao {name}, {name} dung Healthouse duoc 7 ngay roi..."
//    Placeholder ho tro trong template: {name} {phone} {days} {product}
//  - Chay 1 lan/ngay qua Time-driven Trigger goi runFollowUpScan (xem
//    huong dan setup trigger o cuoi file)
// ═══════════════════════════════════════════════════════════════
var SH_FU_TEMPLATE = 'FollowUpTemplates';
var FU_TEMPLATE_HEADERS = ['productCode', 'days', 'template', 'cs'];
var SH_FU_LOG = 'FollowUpLog';
var FU_LOG_HEADERS = ['phone', 'orderKey', 'days', 'sentAt', 'source'];
var SH_ZALO_SCAN = 'ZaloContactScan';
var ZALO_SCAN_HEADERS = ['phone', 'rawName', 'nameGuess', 'orderDateGuess', 'productCodeGuess', 'scannedAt', 'scannedBy'];
var FU_CHECKPOINTS = [7, 14, 30, 60]; // ngay: 7, 14, 1 thang, 2 thang
// Chi hoi tham khach mua tu 5/2026 tro di (don cu hon bo qua hoan toan)
var FU_START = new Date(2026, 4, 1); // thang 5/2026 (thang tinh tu 0)
// Chi hoi tham khach den tu cac nguon nay (so khop chua-chuoi, khong phan biet hoa thuong).
// Don hang nguon khac (KH Renew, Data Dao...) KHONG gui hoi tham tu dong.
var FU_SOURCES = ['landipage', 'landing', 'messenger', 'mess', 'web'];
function fuSourceAllowed_(source) {
  var sl = String(source || '').toLowerCase();
  if (!sl) return false;
  for (var i = 0; i < FU_SOURCES.length; i++) {
    if (sl.indexOf(FU_SOURCES[i]) !== -1) return true;
  }
  return false;
}

// Bang quy doi ten/viet tat san pham -> ma san pham chuan (dung chung cho
// OrderData.product/productDetail VA ten hien thi Zalo do CS dat).
// DAY LA BANG DU PHONG (dung khi sheet "Mã Zalo" chua co/chua doc duoc).
// Nguon chinh la sheet "Mã Zalo" (muc 2 - Bảng mã sản phẩm) trong file CareData —
// sua/them ma san pham moi thi sua truc tiep trong Sheet, KHONG can sua code.
var PRODUCT_CODE_MAP_ = [
  ['HH',  ['hh', 'healthouse']],
  ['CF',  ['cf', 'cafe', 'ca phe', 'càphê', 'cà phê']],
  ['M9',  ['m9', 'make9', 'make 9']],
  ['LV',  ['lv', 'louisviel']],
  ['TEA', ['tea', 'tb', 'trà', 'tra']],
  ['VIK', ['vik', 'vi kim', 'vikim', 'fractional', 'fractional cc']],
  ['EVE', ['eve', 'every', 'every routine']],
  ['RS',  ['rs', 'reason']],
  ['DA',  ['da', 'dear', 'dearglam']]
];

// Doc bang mo rong tu sheet "Mã Zalo" (muc 2 - "Bảng mã sản phẩm"):
// tim dong tieu de co chua "Mã chuẩn hoá", doc cac dong ngay sau do
// (cot A = Mã viết tắt, cot B = Tên đầy đủ, cot C = Mã chuẩn hoá) cho den
// khi het du lieu. Tra ve null neu khong tim thay sheet/bang (de goi noi
// dung fallback ve PRODUCT_CODE_MAP_).
function readProductCodeMapFromSheet_() {
  try {
    var ss = getCrmSS_();
    var sh = ss.getSheetByName('Mã Zalo');
    if (!sh || sh.getLastRow() < 2) return null;
    var vals = sh.getDataRange().getValues();
    var headerRow = -1;
    for (var i = 0; i < vals.length; i++) {
      for (var j = 0; j < vals[i].length; j++) {
        if (String(vals[i][j]).indexOf('Mã chuẩn hoá') !== -1) { headerRow = i; break; }
      }
      if (headerRow !== -1) break;
    }
    if (headerRow === -1) return null;
    var map = [];
    for (var r = headerRow + 1; r < vals.length; r++) {
      var abbrevRaw = String(vals[r][0] || '').trim();
      var fullName = String(vals[r][1] || '').trim();
      var code = String(vals[r][2] || '').trim().toUpperCase();
      if (!abbrevRaw || !code) break; // het du lieu bang nay / gap section khac
      var kws = abbrevRaw.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      if (fullName && kws.indexOf(fullName.toLowerCase()) === -1) kws.push(fullName.toLowerCase());
      map.push([code, kws]);
    }
    return map.length ? map : null;
  } catch (e) { return null; }
}

// Cache trong 1 lan chay (tranh doc lai Sheet nhieu lan khi loop hang ngan don hang)
var _productCodeMapCache_ = null;
function getProductCodeMap_() {
  if (_productCodeMapCache_) return _productCodeMapCache_;
  var dyn = readProductCodeMapFromSheet_();
  _productCodeMapCache_ = (dyn && dyn.length) ? dyn : PRODUCT_CODE_MAP_;
  return _productCodeMapCache_;
}

function productCodeFromText_(text, map) {
  if (!text) return '';
  var m = map || getProductCodeMap_();
  var up = String(text).toLowerCase();
  for (var i = 0; i < m.length; i++) {
    var code = m[i][0], kws = m[i][1];
    for (var j = 0; j < kws.length; j++) {
      if (up.indexOf(kws[j]) !== -1) return code;
    }
  }
  return '';
}

// Doc bang mau tin: { 'HH|7': 'template...', 'CF|14': '...', ... }
// Ma san pham '*' dung lam mau mac dinh cho moi san pham o moc ngay do.
function readFollowUpTemplates_() {
  var sh = getSheet_(SH_FU_TEMPLATE, FU_TEMPLATE_HEADERS);
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, FU_TEMPLATE_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    var code = String(vals[i][0] || '').trim().toUpperCase();
    var days = String(vals[i][1] || '').trim();
    var tpl = String(vals[i][2] || '').trim();
    var cs = String(vals[i][3] || '').trim().toLowerCase();
    if (!days || !tpl) continue;
    // Ma SP ho tro NHIEU ma cach nhau dau phay: "CF,TEA" -> ap dung cung mau cho ca CF va TEA
    var codeList = code.split(',').map(function (c) { return c.trim(); }).filter(String);
    if (!codeList.length) codeList = ['*'];
    for (var ci2 = 0; ci2 < codeList.length; ci2++) {
      // key co CS: "HH|7|duyenht"; mau chung: "HH|7"
      map[codeList[ci2] + '|' + days + (cs ? '|' + cs : '')] = tpl;
    }
  }
  return map;
}

// Danh sach dang mang (cho UI Sasum sua truc tiep)
function listFollowUpTemplates_() {
  var sh = getSheet_(SH_FU_TEMPLATE, FU_TEMPLATE_HEADERS);
  var last = sh.getLastRow();
  var out = [];
  if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, FU_TEMPLATE_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][1] || '').trim()) continue;
    out.push({
      productCode: String(vals[i][0] || '').trim().toUpperCase(),
      days: String(vals[i][1] || '').trim(),
      template: String(vals[i][2] || ''),
      cs: String(vals[i][3] || '').trim().toLowerCase()
    });
  }
  return out;
}

// Ghi de toan bo bang mau tin (UI Sasum gui len danh sach day du sau khi sua)
function saveFollowUpTemplates_(list) {
  if (!Array.isArray(list)) return jsonOut_({ error: 'templates phai la mang' });
  var sh = getSheet_(SH_FU_TEMPLATE, FU_TEMPLATE_HEADERS);
  sh.clearContents();
  var matrix = [FU_TEMPLATE_HEADERS];
  for (var i = 0; i < list.length; i++) {
    var t = list[i] || {};
    if (!String(t.days || '').trim() || !String(t.template || '').trim()) continue;
    matrix.push([
      String(t.productCode || '*').trim().toUpperCase(),
      String(t.days).trim(),
      String(t.template),
      String(t.cs || '').trim().toLowerCase()
    ]);
  }
  sh.getRange(1, 1, matrix.length, FU_TEMPLATE_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: matrix.length - 1 });
}

function renderFollowUpTemplate_(tpl, ctx) {
  return String(tpl)
    .replace(/\{name\}/g, ctx.name || 'bạn')
    .replace(/\{phone\}/g, ctx.phone || '')
    .replace(/\{days\}/g, String(ctx.days || ''))
    .replace(/\{product\}/g, ctx.product || '');
}

function readFollowUpLogKeys_() {
  var sh = getSheet_(SH_FU_LOG, FU_LOG_HEADERS);
  var last = sh.getLastRow();
  var set = {};
  if (last < 2) return set;
  var vals = sh.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < vals.length; i++) {
    set[String(vals[i][0]) + '|' + String(vals[i][1]) + '|' + String(vals[i][2])] = true;
  }
  return set;
}

function appendFollowUpLogRows_(rows) {
  if (!rows.length) return;
  var sh = getSheet_(SH_FU_LOG, FU_LOG_HEADERS);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, FU_LOG_HEADERS.length).setValues(rows);
}

// Doc du phong tu ban CS quet danh ba Zalo (chi dung cho SDT KHONG co don hang nao trong OrderData)
function readZaloScanByPhone_() {
  var sh = getSheet_(SH_ZALO_SCAN, ZALO_SCAN_HEADERS);
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, ZALO_SCAN_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    var phone = normPhone_(vals[i][0]);
    if (!phone) continue;
    // giu ban quet moi nhat cho moi SDT
    map[phone] = {
      phone: phone, rawName: vals[i][1] || '', nameGuess: vals[i][2] || '',
      orderDateGuess: vals[i][3] || '', productCodeGuess: String(vals[i][4] || '').toUpperCase(),
      scannedAt: vals[i][5] || ''
    };
  }
  return map;
}

// Nhan mang cac ban ghi quet tu extension: [{phone, rawName, nameGuess, orderDateGuess, productCodeGuess, scannedBy}]
function dedupeCare_() {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow();
  if (last < 3) return jsonOut_({ ok: true, removed: 0 });
  var data = sh.getDataRange().getValues();
  var best = {}; // np -> {rowVals, score}
  function score(row){ var n=0; for (var j=1;j<row.length;j++){ if (String(row[j]||'').trim()) n++; } return n; }
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var np = normPhone_(String(data[i][0]));
    if (!np) continue;
    var sc = score(data[i]);
    if (!best[np] || sc > best[np].score) best[np] = { row: data[i], score: sc };
  }
  var W = CARE_HEADERS.length;
  // Chuẩn hoá mỗi dòng đúng W cột (dòng cũ có thể thiếu cột birthday → pad; thừa → cắt)
  function fit(row){
    var r = (row || []).slice(0, W);
    while (r.length < W) r.push('');
    return r;
  }
  var out = [CARE_HEADERS.slice()];
  Object.keys(best).forEach(function(np){ out.push(fit(best[np].row)); });
  var removed = (data.length - 1) - (out.length - 1);
  sh.clearContents();
  sh.getRange(1, 1, out.length, W).setValues(out);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
  if (sbMode_() !== 'off') sbMarkStale_('dedupeCare_ xoa/sap xep lai dong CareData');   // dong GIU LAI co the khac dong da backfill
  return jsonOut_({ ok: true, removed: removed, kept: out.length - 1 });
}

// ─── CHAY TAY TU APPS SCRIPT EDITOR (chon ham roi bam Run, xem ket qua o Executions) ───
function runDedupeCare() {
  var res = dedupeCare_();
  Logger.log('DEDUPE CARE: ' + res.getContent());
}
function saveZaloScan_(rows) {
  if (!rows || !rows.length) return jsonOut_({ ok: false, error: 'Khong co du lieu quet' });
  var sh = getSheet_(SH_ZALO_SCAN, ZALO_SCAN_HEADERS);
  var now = new Date().toISOString();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var phone = normPhone_(r.phone);
    if (!phone) continue;
    out.push([phone, r.rawName || '', r.nameGuess || '', r.orderDateGuess || '', String(r.productCodeGuess || '').toUpperCase(), now, r.scannedBy || '']);
  }
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, ZALO_SCAN_HEADERS.length).setValues(out);
  return jsonOut_({ ok: true, count: out.length });
}

// Ham chinh: quet OrderData (uu tien) + ZaloContactScan (du phong), gom cac
// KH toi dung moc ngay (7/14/30/60) thanh 1 chien dich broadcast tu dong,
// noi dung rieng cho tung khach (perPhoneMsg) de extension da co san tu
// dong gui (startBroadcast_ trong content.js).
function runFollowUpScan_() {
  var templates = readFollowUpTemplates_();
  var doneKeys = readFollowUpLogKeys_();
  var today = new Date(); today.setHours(0, 0, 0, 0);

  // Moc ngay lay DONG tu bang mau tin (CS dat tuy y: 7, 14, 30, 60, 90...).
  // Neu bang mau trong -> dung bo moc mac dinh FU_CHECKPOINTS.
  var fuDaysSet = {};
  Object.keys(templates).forEach(function (k) {
    var d = parseInt(k.split('|')[1], 10);
    if (d > 0) fuDaysSet[d] = true;
  });
  if (!Object.keys(fuDaysSet).length) {
    for (var fci = 0; fci < FU_CHECKPOINTS.length; fci++) fuDaysSet[FU_CHECKPOINTS[fci]] = true;
  }

  // Doc CareData 1 lan: phone -> { cs phu trach, cac nick Zalo da ket ban }
  var careMap = {};
  var careRows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  for (var ci = 0; ci < careRows.length; ci++) {
    var cr = careRows[ci];
    careMap[normPhone_(cr.phone)] = {
      cs: String(cr.cs || '').trim(),
      nicks: Array.isArray(cr.nickZalos) ? cr.nickZalos : []
    };
  }

  var perPhoneMsg = {}, phones = [], logRows = [];
  var matchedPhones = {}; // tranh trung SDT trong cung 1 lan chay neu khop nhieu moc

  function tryAdd(phone, orderDate, productText, name, source) {
    if (!phone || !orderDate) return;
    var d = parseVNDate_(orderDate); // ho tro ca Date that lan chuoi 'dd/MM/yyyy...' (readAllOrders_ tra ve chuoi)
    if (!d || isNaN(d)) return;
    d.setHours(0, 0, 0, 0);
    if (d < FU_START) return; // chi hoi tham khach mua tu 5/2026 tro di
    var daysSince = Math.round((today - d) / 86400000);
    if (!fuDaysSet[daysSince]) return;
    var np = normPhone_(phone);
    if (!np || matchedPhones[np]) return; // 1 KH chi nhan 1 tin moi lan chay, tranh spam neu khop nhieu don

    var orderKey = _vnYmd_(d) || String(orderDate);
    var logKey = np + '|' + orderKey + '|' + daysSince;
    if (doneKeys[logKey]) return;

    var code = productCodeFromText_(productText) || '*';
    var csOwn = ((careMap[np] && careMap[np].cs) || '').toLowerCase();
    // Uu tien: mau rieng cua CS (theo ma SP -> mac dinh) -> mau chung (theo ma SP -> mac dinh)
    var tpl = (csOwn && (templates[code + '|' + daysSince + '|' + csOwn] || templates['*|' + daysSince + '|' + csOwn]))
      || templates[code + '|' + daysSince] || templates['*|' + daysSince];
    if (!tpl) return; // chua co mau cho san pham/moc ngay nay -> khong gui (tranh gui tin rong/chung chung)

    var msg = renderFollowUpTemplate_(tpl, { name: name || '', phone: np, days: daysSince, product: productText || '' });
    perPhoneMsg[np] = msg;
    phones.push(np);
    matchedPhones[np] = true;
    logRows.push([np, orderKey, daysSince, new Date().toISOString(), source]);
  }

  // 1) Uu tien du lieu don hang that trong DT TONG (thay the OrderData cu)
  var orders = readAllOrders_();
  var phonesWithOrders = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.phone) phonesWithOrders[normPhone_(o.phone)] = true;
    if (!fuSourceAllowed_(o.source)) continue; // chi nguon landipage / messenger / web
    tryAdd(o.phone, o.date, o.product || o.productDetail, o.name, 'order');
  }

  // 2) Ban quet ten Zalo (ZaloContactScan) KHONG dung lam nguon ngay/san pham nua.
  // Ngay mua + san pham CHI tinh theo don hang that trong Sasum (OrderData).
  // Ban quet chi de doi chieu SDT nao dang co tren Zalo (phuc vu gui tin dung nick).

  if (!phones.length) return { ok: true, count: 0, message: 'Khong co KH nao toi moc hoi tham hom nay (hoac chua co mau tin cho san pham/moc ngay tuong ung).' };

  // ── TACH CHIEN DICH THEO CS PHU TRACH (tu CareData.cs) ──
  // Moi CS 1 chien dich rieng -> CS nao mo extension chi thay khach cua minh.
  // Khach chua gan CS -> vao chien dich chung (csName rong, moi CS deu thay).
  var groups = {}; // csName -> [phones]
  for (var gi = 0; gi < phones.length; gi++) {
    var gp = phones[gi];
    var gcs = (careMap[gp] && careMap[gp].cs) || '';
    if (!groups[gcs]) groups[gcs] = [];
    groups[gcs].push(gp);
  }

  var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd_HHmm');
  var dateLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
  var created = [];
  Object.keys(groups).forEach(function (csName) {
    var grpPhones = groups[csName];
    var grpMsg = {}, grpNick = {};
    for (var pi = 0; pi < grpPhones.length; pi++) {
      var pp = grpPhones[pi];
      grpMsg[pp] = perPhoneMsg[pp];
      grpNick[pp] = (careMap[pp] && careMap[pp].nicks) || [];
    }
    var broadcast = {
      id: 'fu_' + todayStr + (csName ? '_' + csName : '_chung'),
      label: 'Tự động hỏi thăm ' + dateLabel + (csName ? ' — ' + csName : ' — chưa gán CS'),
      message: '(Nội dung cá nhân hoá riêng theo từng khách — xem chi tiết trong extension)',
      images: [],
      phones: grpPhones,
      csName: csName,
      expectedNick: '',
      createdAt: new Date().toISOString(),
      status: 'active',
      perPhoneMsg: grpMsg,
      perPhoneNick: grpNick
    };
    saveBroadcast_(broadcast);
    created.push({ id: broadcast.id, cs: csName || '(chung)', count: grpPhones.length });
  });

  appendFollowUpLogRows_(logRows);
  return { ok: true, count: phones.length, campaigns: created };
}

// ─── HUONG DAN DAT LICH CHAY TU DONG (setup 1 lan) ───────────────
// Trong Apps Script editor: Trigger (bieu tuong dong ho o thanh ben trai)
// → + Add Trigger → Chon ham "runFollowUpScanTrigger" → Chon nguon su kien
// "Time-driven" → "Day timer" → chon khung gio (VD 8-9 sang) → Save.
// Ham nay chi la wrapper khong tra ve gi (trigger yeu cau void), log lai
// ket qua vao Logger de kiem tra trong "Executions" cua Apps Script.
function runFollowUpScanTrigger() {
  var res = runFollowUpScan_();
  Logger.log(JSON.stringify(res));
}

// ═══════════════════════════════════════════════════════════════
//  TASKS ADDON — Quản lý công việc (Công việc + CS tham gia)
//  Dán TOÀN BỘ khối này vào CUỐI file gas_v13.js (trước dòng cuối cùng)
// ═══════════════════════════════════════════════════════════════


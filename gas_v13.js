// ═══════════════════════════════════════════════════════════════
//  OME CS Portal — Google Apps Script — PHIEN BAN 10.57.13.7.2026 (gio.phut.ngay.thang.nam)
//  v12.0: Hop nhat appweb v10.0 + ZaloAI v11.2
//         Them birthday vao CareData (col 18)
//         saveAllCare / saveSingleCare bao toan truong mo rong (khStatus, nickZalos, birthday)
//         action=lookup, reminders, getSetting (cho Zalo AI extension)
//         Groq AI thay Gemini, AIContext day du
//         getSetting_ nhat quan 1 signature: getSetting_(key)
//  Type: Web app | Execute as: Me | Who has access: Anyone
//  LUU Y: moi lan sua phai Deploy lai (New deployment hoac version moi)
// ═══════════════════════════════════════════════════════════════

var SH_CARE    = 'CareData';
var SH_TEAM    = 'Teams';
var SH_AUDIT   = 'AuditLog';
var SH_SET     = 'Settings';
var SH_ASSIGN  = 'AssignData';
var SH_USER    = 'Users';
var SH_CONTEXT = 'AIContext';

var ORDER_SS_ID = '1PQT933_mEDfnnTe-cJkYAbLd8n9bMPN_yW4bc4gKxnU'; // File chua OrderData2x (doanh thu/don hang)
var CRM_SS_ID   = '1XiPfMZObRgK4EfzJoqlPdBMLQY2Ej5ug6vMmz7m1zKY'; // File chua CareData/Users/Teams/Settings/AuditLog/AssignData/AIContext (CRM).
                        // De trong = dung file dang gan Apps Script nay (mac dinh, hanh vi cu).
                        // Dan Spreadsheet ID moi vao day de doi nguon CRM MA KHONG can gan lai script vao file khac.
// >>> Muon doi nguon du lieu sau nay: chi can sua 2 dong ID o tren (ORDER_SS_ID va/hoac CRM_SS_ID) roi Deploy lai. <<<

function getOrderSS_() {
  return ORDER_SS_ID
    ? SpreadsheetApp.openById(ORDER_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getCrmSS_() {
  return CRM_SS_ID
    ? SpreadsheetApp.openById(CRM_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

var ORDER_SHEETS = [
  { name: 'OrderData21_22', years: [21, 22, 2021, 2022] },
  { name: 'OrderData23',    years: [23, 2023] },
  { name: 'OrderData24',    years: [24, 2024] },
  { name: 'OrderData25',    years: [25, 2025] },
  { name: 'OrderData26',    years: [26, 2026] }
];
var SH_ORDER_DEFAULT = 'OrderData26';

// CARE_HEADERS: 19 cols (v10.0 co 15, v11.2 co 17, v12.0 them birthday, v13.1 them zaloSetBy)
var CARE_HEADERS = ['phone','status','zalo','cs','note','schedules',
  'schedGoi','schedGoiNote','schedSP','schedSPNote',
  'schedCS','schedCSNote','schedHen','schedHenNote','updated',
  'khStatus','nickZalos','birthday','zaloSetBy'];

var ORDER_HEADERS  = ['phone','name','date','year','month','cs','source','revenue',
  'product','productDetail','status','zalo','note','careCS'];
var TEAM_HEADERS   = ['id','name','leader','members','color'];
var AUDIT_HEADERS  = ['timestamp','user','action','phone','oldValue','newValue'];
var SET_HEADERS    = ['key','value'];
var ASSIGN_HEADERS = ['id','date','csName','label','phones','donePhones'];
var USER_HEADERS   = ['username','passHash','role','name','team','active'];

// ─── HELPERS ───────────────────────────────────────────────────
function getSheet_(name, headers) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers) sh.appendRow(headers);
  else if (headers && sh.getLastRow() > 0) {
    // Neu sheet da co san (tao tu ban cu, it cot hon) -> bo sung cac cot header con thieu
    // o cuoi, KHONG dung lai/xoa du lieu hien co. Vi du: them cot 'zaloSetBy' o ban v13.1.
    var curLastCol = sh.getLastColumn();
    if (curLastCol < headers.length) {
      var curHeaders = curLastCol > 0 ? sh.getRange(1, 1, 1, curLastCol).getValues()[0] : [];
      var missing = headers.slice(curHeaders.length);
      if (missing.length) sh.getRange(1, curHeaders.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sh;
}
function getOrderSheet_(name) {
  var ss = getOrderSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(ORDER_HEADERS); }
  return sh;
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function getOrderSheetName_(year) {
  var y = Number(year);
  for (var i = 0; i < ORDER_SHEETS.length; i++) {
    if (ORDER_SHEETS[i].years.indexOf(y) !== -1) return ORDER_SHEETS[i].name;
  }
  return SH_ORDER_DEFAULT;
}
function normPhone_(p) {
  if (!p) return '';
  var s = String(p).replace(/[^0-9]/g, '');
  if (s.length === 11 && s.indexOf('84') === 0) s = '0' + s.substring(2);
  if (s.length === 9 && /^[3-9]/.test(s)) s = '0' + s;
  return s;
}

// ─── SETTINGS (1 signature duy nhat) ──────────────────────────
function getSetting_(key) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === key) return vals[i][1] || null;
  }
  return null;
}
function setSetting_(key, value) {
  var sh = getSheet_(SH_SET, SET_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last-1, 1).createTextFinder(String(key)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  if (rowIdx > 0) sh.getRange(rowIdx, 2).setValue(value);
  else sh.appendRow([key, value]);
  return jsonOut_({ ok: true });
}
function addZaloNick_(nick) {
  nick = String(nick || '').trim();
  if (!nick) return jsonOut_({ error: 'Thieu nick' });
  var raw = getSetting_('nickZaloList');
  var list = [];
  try { list = JSON.parse(raw || '[]'); } catch (e) {}
  if (!Array.isArray(list)) list = [];
  if (list.indexOf(nick) === -1) list.push(nick);
  setSetting_('nickZaloList', JSON.stringify(list));
  return jsonOut_({ ok: true, list: list });
}

function readCareStatus_(ss) {
  var sh = ss.getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === 'careStatus') { try { return JSON.parse(vals[i][1]); } catch(e) { return null; } }
  }
  return null;
}

// ─── CARE READ / WRITE ─────────────────────────────────────────
// Chuyen 1 hang sheet thanh object care (xu ly graceful neu sheet co it cot hon)
function careObjFromRow_(row) {
  var parseNZ = function(v) { try { return JSON.parse(v||'[]'); } catch(e) { return []; } };
  var parseSetBy = function(v) { try { return JSON.parse(v||'null'); } catch(e) { return null; } };
  return {
    phone:        String(row[0]||''),
    status:       row[1]||'',
    zalo:         row[2]||'',
    cs:           row[3]||'',
    note:         row[4]||'',
    schedules:    row[5]||'',
    schedGoi:     row[6]||'',
    schedGoiNote: row[7]||'',
    schedSP:      row[8]||'',
    schedSPNote:  row[9]||'',
    schedCS:      row[10]||'',
    schedCSNote:  row[11]||'',
    schedHen:     row[12]||'',
    schedHenNote: row[13]||'',
    updated:      row[14]||'',
    khStatus:     row[15]||'',
    nickZalos:    parseNZ(row[16]),
    birthday:     row[17]||'',
    zaloSetBy:    parseSetBy(row[18]) // { cs, nick, at } - ai/nick nao vua ghi trang thai 'zalo' gan nhat
  };
}

function readCare_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    out.push(careObjFromRow_(vals[i]));
  }
  return out;
}

function findCareByPhone_(phone) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CARE);
  if (!sh || sh.getLastRow() < 2) return null;
  var ph = normPhone_(phone);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    if (normPhone_(vals[i][0]) === ph) return careObjFromRow_(vals[i]);
  }
  return null;
}

// careRow_: 19 cols. Neu truong khong co thi de trong.
function careRow_(r) {
  var nz = r.nickZalos;
  if (!Array.isArray(nz)) { try { nz = JSON.parse(nz||'[]'); } catch(e) { nz = []; } }
  var setBy = r.zaloSetBy;
  if (setBy && typeof setBy !== 'string') { try { setBy = JSON.stringify(setBy); } catch(e) { setBy = ''; } }
  return [
    r.phone||'', r.status||'', r.zalo||'', r.cs||'', r.note||'', r.schedules||'',
    r.schedGoi||'', r.schedGoiNote||'', r.schedSP||'', r.schedSPNote||'',
    r.schedCS||'', r.schedCSNote||'', r.schedHen||'', r.schedHenNote||'',
    new Date().toISOString(),
    r.khStatus||'', JSON.stringify(nz), r.birthday||'', setBy||''
  ];
}

// Doc du lieu existing de bao toan truong mo rong (khStatus, nickZalos, birthday, zaloSetBy)
// khi appweb gui len khong co cac truong nay
function readExistingExtFields_(sh) {
  var map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    map[String(vals[i][0])] = {
      khStatus:  vals[i][15]||'',
      nickZalos: vals[i][16]||'[]',
      birthday:  vals[i][17]||'',
      zaloSetBy: vals[i][18]||''
    };
  }
  return map;
}

// Merge incoming row voi existing ext fields neu incoming khong co
function mergeExtFields_(r, ex) {
  if (!ex) return r;
  if (r.khStatus  === undefined || r.khStatus  === null || r.khStatus  === '') r.khStatus  = ex.khStatus  || '';
  if (r.birthday  === undefined || r.birthday  === null || r.birthday  === '') r.birthday  = ex.birthday  || '';
  if (r.zaloSetBy === undefined || r.zaloSetBy === null || r.zaloSetBy === '') r.zaloSetBy = ex.zaloSetBy || '';
  if (r.nickZalos === undefined || r.nickZalos === null ||
      (Array.isArray(r.nickZalos) && r.nickZalos.length === 0)) {
    try { r.nickZalos = JSON.parse(ex.nickZalos||'[]'); } catch(e) { r.nickZalos = []; }
  }
  return r;
}

// ─── ORDER READ ────────────────────────────────────────────────
function readOrdersByPhone_(phone) {
  var ss = getOrderSS_();
  var ph = normPhone_(phone);
  var out = [];
  for (var i = ORDER_SHEETS.length - 1; i >= 0; i--) {
    var sh = ss.getSheetByName(ORDER_SHEETS[i].name);
    if (!sh || sh.getLastRow() < 2) continue;
    var vals = sh.getDataRange().getValues();
    for (var j = 1; j < vals.length; j++) {
      if (!vals[j][0]) continue;
      if (normPhone_(vals[j][0]) !== ph) continue;
      out.push({
        sheet: sh.getName(), rowIndex: j + 1,
        phone: vals[j][0], name: vals[j][1]||'', date: vals[j][2]||'', year: vals[j][3]||'',
        month: vals[j][4]||'', cs: vals[j][5]||'', source: vals[j][6]||'', revenue: vals[j][7]||0,
        product: vals[j][8]||'', productDetail: vals[j][9]||'', status: vals[j][10]||'',
        zalo: vals[j][11]||'', note: vals[j][12]||'', careCS: vals[j][13]||''
      });
    }
  }
  // Luu y: chi khu trung dong GIONG HET (cung ngay+doanh thu+san pham). Cac dong "mat 3
  // so 0" (doanh thu lech nhau 1000 lan, VD 708 vs 708.000) CO chu y GIU LAI ca 2 de FE
  // (extension) tu phat hien va hien nut × cho CS xoa dung dong loi (xem _dupRevenueFlags_
  // trong content.js) — khong tu dong xoa o day de tranh xoa nham khi chua xac nhan.
  var seen = {}, deduped = [];
  for (var k = 0; k < out.length; k++) {
    var key = String(out[k].date)+'|'+String(out[k].revenue)+'|'+String(out[k].product);
    if (!seen[key]) { seen[key] = true; deduped.push(out[k]); }
  }
  return deduped;
}

function readAllOrders_() {
  var ss = getOrderSS_(), out = [];
  for (var i = 0; i < ORDER_SHEETS.length; i++) {
    var sh = ss.getSheetByName(ORDER_SHEETS[i].name);
    if (sh) out = out.concat(readOrders_(sh));
  }
  return out;
}

function readOrders_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var ov = sh.getDataRange().getValues();
  for (var j = 1; j < ov.length; j++) {
    if (!ov[j][0]) continue;
    out.push({
      phone: ov[j][0], name: ov[j][1]||'', date: ov[j][2]||'', year: ov[j][3]||'',
      month: ov[j][4]||'', cs: ov[j][5]||'', source: ov[j][6]||'', revenue: ov[j][7]||0,
      product: ov[j][8]||'', productDetail: ov[j][9]||'', status: ov[j][10]||'',
      zalo: ov[j][11]||'', note: ov[j][12]||'', careCS: ov[j][13]||''
    });
  }
  return out;
}

function readTeams_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0] && !v[i][1]) continue;
    var members = [];
    try { members = v[i][3] ? JSON.parse(v[i][3]) : []; } catch(e) { members = (''+v[i][3]).split(',').filter(String); }
    out.push({ id: v[i][0], name: v[i][1]||'', leader: v[i][2]||'', members: members, color: v[i][4]||'' });
  }
  return out;
}

function readUsers_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({
      username: String(v[i][0]), passHash: String(v[i][1]||''), role: v[i][2]||'cs',
      name: v[i][3]||'', team: v[i][4]||'',
      active: (v[i][5]===''||v[i][5]===undefined) ? true :
              (v[i][5]===true||v[i][5]==='TRUE'||v[i][5]==='true'||v[i][5]===1)
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  doGet
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var ss = getCrmSS_();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    // ── lookup theo phone (ZaloAI extension) ──
    if (action === 'lookup') {
      var phone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phone) return jsonOut_({ error: 'Thieu phone' });
      var cache = CacheService.getScriptCache();
      var cKey = 'lk_' + normPhone_(phone);
      var cached = cache.get(cKey);
      if (cached) { try { return jsonOut_(JSON.parse(cached)); } catch(ec) {} }
      var res = { ok: true, care: findCareByPhone_(phone), orders: readOrdersByPhone_(phone) };
      try { cache.put(cKey, JSON.stringify(res), 15); } catch(ec) {}
      return jsonOut_(res);
    }

    // ── danh sach KH + trang thai CS (appweb + extension) ──
    if (action === 'customers') {
      var cache2 = CacheService.getScriptCache();
      var cKey2  = 'customers_v12';
      var cached2 = cache2.get(cKey2);
      if (cached2) { try { return jsonOut_(JSON.parse(cached2)); } catch(ec) {} }
      var res2 = { rows: readCare_(ss.getSheetByName(SH_CARE)), careStatus: readCareStatus_(ss) };
      try { cache2.put(cKey2, JSON.stringify(res2), 300); } catch(ec) {}
      return jsonOut_(res2);
    }

    if (action === 'orders')    return jsonOut_({ orders: readAllOrders_() });
    if (action === 'teams')     return jsonOut_({ teams: readTeams_(ss.getSheetByName(SH_TEAM)) });
    if (action === 'users')     return jsonOut_({ users: readUsers_(ss.getSheetByName(SH_USER)) });

    if (action === 'audit') {
      var shA = ss.getSheetByName(SH_AUDIT); var auditRows = [];
      if (shA && shA.getLastRow() > 1) {
        var lastA = shA.getLastRow();
        var nA = Math.min(200, lastA - 1);
        var vA = shA.getRange(lastA - nA + 1, 1, nA, 6).getValues();
        for (var ai = vA.length - 1; ai >= 0; ai--) {
          auditRows.push({ timestamp: vA[ai][0], user: vA[ai][1], action: vA[ai][2],
            phone: vA[ai][3], oldValue: vA[ai][4], newValue: vA[ai][5] });
        }
      }
      return jsonOut_({ audit: auditRows });
    }

    if (action === 'dashboard') return jsonOut_(buildDashboard_());

    if (action === 'assign')    return jsonOut_({ assignHistory: readAssign_(ss.getSheetByName(SH_ASSIGN)) });
    if (action === 'tasks')     return jsonOut_({ tasks: readTasks_(ss.getSheetByName(SH_TASK)) });
    if (action === 'taskComments') return jsonOut_({ comments: readTaskComments_(ss.getSheetByName(SH_TASKCM), e.parameter.taskId) });

    if (action === 'count') {
      var shC = ss.getSheetByName(SH_CARE); var totalOrders = 0;
      for (var si = 0; si < ORDER_SHEETS.length; si++) {
        var sho = getOrderSS_().getSheetByName(ORDER_SHEETS[si].name);
        if (sho) totalOrders += Math.max(0, sho.getLastRow() - 1);
      }
      return jsonOut_({ orderRows: totalOrders, careRows: shC ? Math.max(0, shC.getLastRow()-1) : 0, ver: 'v10.57.13.7.2026' });
    }

    // ── lich hen hom nay / qua han (ZaloAI extension) ──
    if (action === 'reminders') {
      var csFilter = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      var shR = ss.getSheetByName(SH_CARE);
      if (!shR || shR.getLastRow() < 2) return jsonOut_({ reminders: [] });
      var valsR = shR.getDataRange().getValues();
      var today = new Date(); today.setHours(0,0,0,0);
      var reminders = [], seenR = {};
      for (var ri = 1; ri < valsR.length; ri++) {
        if (!valsR[ri][0]) continue;
        var rcs = String(valsR[ri][3]||'').trim();
        if (csFilter && rcs !== csFilter) continue;
        var rhen = valsR[ri][12];
        if (!rhen) continue;
        var rdate = new Date(rhen); rdate.setHours(0,0,0,0);
        // CHỈ hẹn TRONG NGÀY hôm nay (không lấy quá hạn) — extension chỉ nhắc lịch của ngày
        if (rdate.getTime() !== today.getTime()) continue;
        // Gộp trùng: mỗi SĐT chỉ 1 nhắc (tránh nhân bản do CareData có dòng trùng)
        var npR = normPhone_(String(valsR[ri][0]));
        if (seenR[npR]) continue;
        seenR[npR] = true;
        reminders.push({
          phone: String(valsR[ri][0]), schedHen: String(rhen),
          schedHenNote: String(valsR[ri][13]||''), cs: rcs,
          status: String(valsR[ri][1]||''), zalo: String(valsR[ri][2]||''), overdue: false
        });
      }
      return jsonOut_({ reminders: reminders });
    }

    // ── lay 1 setting (ZaloAI extension: careStatus, nickZaloList) ──
    if (action === 'getSetting') {
      var skey = (e && e.parameter && e.parameter.key) ? String(e.parameter.key) : '';
      return jsonOut_({ value: getSetting_(skey) });
    }

    // ── BROADCAST: hang doi tin gui hang loat cho 1 CS (ZaloAI extension) ──
    if (action === 'broadcastQueue') {
      var bcCs = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      return jsonOut_({ broadcasts: broadcastQueueForCS_(bcCs) });
    }
    // ── BROADCAST: danh sach toan bo chien dich (Sasum quan ly) ──
    if (action === 'broadcastList') {
      return jsonOut_({ broadcasts: readBroadcasts_() });
    }

    // ── HOI THAM TU DONG: xem mau tin hien co (de kiem tra da cau hinh chua) ──
    if (action === 'followUpTemplates') {
      var fuTpls = readFollowUpTemplates_();
      var fuDays = {};
      Object.keys(fuTpls).forEach(function (k) { var dd = parseInt(k.split('|')[1], 10); if (dd > 0) fuDays[dd] = true; });
      var fuDayList = Object.keys(fuDays).map(Number).sort(function(a,b){return a-b;});
      return jsonOut_({ templates: fuTpls, list: listFollowUpTemplates_(), checkpoints: fuDayList.length ? fuDayList : FU_CHECKPOINTS });
    }
    // ── HOI THAM TU DONG: bang ma san pham (doc dong tu sheet "Mã Zalo", ZaloAI extension dung de doc ten Zalo) ──
    if (action === 'productCodeMap') {
      return jsonOut_({ map: getProductCodeMap_() });
    }
    // ── HOI THAM TU DONG: kich hoat thu cong ngay (thay vi cho Time-driven trigger) ──
    if (action === 'runFollowUpScan') {
      return jsonOut_(runFollowUpScan_());
    }
    // ── XOA DON TRUNG: quet don trung (cung SDT+nam+thang+doanh thu). Truyen &phone= de chi quet 1 khach (ZaloAI extension) ──
    if (action === 'findDuplicateOrders') {
      var fdoPhone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      return jsonOut_(findDuplicateOrders_(fdoPhone));
    }
    if (action === 'dedupeCare') return dedupeCare_();

    // default — backward compat voi appweb v10
    var resD = { rows: readCare_(ss.getSheetByName(SH_CARE)), orders: [] };
    if (!(e && e.parameter && e.parameter.noOrders)) resD.orders = readAllOrders_();
    resD.careStatus = readCareStatus_(ss);
    return jsonOut_(resD);

  } catch(err) {
    return jsonOut_({ error: err.message });
  }
}

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
//  doPost
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  if (!e || !e.postData) return jsonOut_({ error: 'No postData' });
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    if (action === 'save')                return saveAllCare_(data.rows);
    if (action === 'saveSingle')          return saveSingleCare_(data.row);
    if (action === 'saveBatch')           return saveBatchCare_(data.rows);
    if (action === 'saveOrders')          return saveOrders_(data.orders);
    if (action === 'patchOrder')          return patchOrder_(data);
    if (action === 'deleteOrder')         return deleteOrder_(data);
    // ── XOA DON TRUNG: xoa cac dong trung da duoc CS/admin xac nhan (danh sach items tra ve tu findDuplicateOrders) ──
    if (action === 'deleteDuplicateOrders') return deleteDuplicateOrders_(data.items);
    if (action === 'replaceOrders')       return replaceOrders_(data.orders, data);
    if (action === 'setOrderCareCS')      return setOrderCareCS_(data.phone, data.careCS);
    if (action === 'setOrderCareCSBatch') return setOrderCareCSBatch_(data.updates);
    if (action === 'saveTeams')           return saveTeams_(data.teams);
    if (action === 'saveUsers')           return saveUsers_(data.users);
    if (action === 'saveAudit')           return saveAudit_(data.rows);
    if (action === 'setSetting')          return setSetting_(data.key, data.value);
    // Them 1 nick Zalo vao danh sach chung (MERGE tren server -> khong ghi de mat nick cu)
    if (action === 'addZaloNick')         return addZaloNick_(data.nick);
    if (action === 'saveAssign')          return saveAssignEntry_(data.entry);
    if (action === 'saveAssignHistory')   return saveAssignHistory_(data.history);
    if (action === 'saveTask')  return saveTaskEntry_(data.task);
    if (action === 'deleteTask') return deleteTask_(data.id);
    if (action === 'saveTaskComment') return saveTaskComment_(data.comment);
    if (action === 'saveCareStatus')      return saveCareStatus_(data.careStatus);
    if (action === 'saveAIContext')        return saveAIContext_(data.type, data.content, data.context);
    if (action === 'ai')                  return callGroqAI_(data);
    // ── BROADCAST: tao/cap nhat 1 chien dich gui tin hang loat ──
    if (action === 'saveBroadcast')        return saveBroadcast_(data.broadcast || data);
    // ── BROADCAST: danh dau 1 SDT da gui/loi/bo qua trong 1 chien dich ──
    if (action === 'broadcastMark')        return broadcastMark_(data.id, data.phone, data.status);
    // ── BROADCAST: upload 1 anh (base64) len Drive, tra ve link xem truc tiep ──
    if (action === 'uploadBroadcastImg')   return uploadBroadcastImage_(data.base64, data.filename, data.mimeType);
    // ── BROADCAST: huy 1 chien dich (dung gui tiep) ──
    if (action === 'broadcastCancel')      return broadcastCancel_(data.id);
    // ── BROADCAST: bat/tat (kich hoat/tam tat) 1 chien dich ──
    if (action === 'broadcastSetStatus')   return broadcastSetStatus_(data.id, data.status);
    // ── HOI THAM TU DONG: nhan ket qua quet ten Zalo tu extension (du phong khi thieu OrderData) ──
    if (action === 'saveZaloScan')         return saveZaloScan_(data.rows);
    // ── ZALO AI: dong bo trang thai ket ban (Da ket ban/Chan/...) tu nut "Quet man hinh" trong extension.
    //     dryRun=true -> CHI kiem tra xung dot (SDT nao dang duoc CS/Nick khac ghi nhan khac trang thai),
    //     khong ghi gi ca; extension se hoi CS xac nhan roi moi goi lai voi dryRun=false (that su ghi). ──
    if (action === 'syncZaloFriendStatus') return syncZaloFriendStatus_(data.rows, !!data.dryRun);
    // Dọn dòng CareData bị nhân bản (giữ dòng đầy đủ nhất cho mỗi SĐT)
    if (action === 'dedupeCare')           return dedupeCare_();
    // ── HOI THAM TU DONG: luu bang mau tin (UI Sasum) ──
    if (action === 'saveFollowUpTemplates') return saveFollowUpTemplates_(data.templates);
    return jsonOut_({ error: 'Unknown action: ' + action });
  } catch(err) {
    return jsonOut_({ error: err.message });
  }
}

// ─── SAVE CARE ─────────────────────────────────────────────────
// BUG FIX: doc existing ext fields truoc khi xoa, de bao toan du lieu
// khi appweb sync khong gui khStatus/nickZalos/birthday
// Xoa cache 'lookup' theo tung SDT (goi sau moi lan ghi de dong bo GAY tuc thoi voi Zalo AI extension)
function invalidateLookupCache_(phones) {
  try {
    var cache = CacheService.getScriptCache();
    var keys = [];
    for (var i = 0; i < phones.length; i++) { if (phones[i]) keys.push('lk_' + normPhone_(String(phones[i]))); }
    for (var j = 0; j < keys.length; j += 100) { cache.removeAll(keys.slice(j, j + 100)); }
  } catch(ec) {}
}

function saveAllCare_(rows) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var extMap = readExistingExtFields_(sh);
  sh.clearContents();
  var matrix = [CARE_HEADERS];
  var phones = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    mergeExtFields_(r, extMap[String(r.phone)]);
    matrix.push(careRow_(r));
    phones.push(r.phone);
  }
  sh.getRange(1, 1, matrix.length, CARE_HEADERS.length).setValues(matrix);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
  invalidateLookupCache_(phones);
  return jsonOut_({ ok: true, written: rows.length });
}

function saveSingleCare_(r) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  var npR = normPhone_(String(r.phone));
  if (last >= 2) {
    var colP = sh.getRange(2, 1, last-1, 1).getValues();
    for (var pi = 0; pi < colP.length; pi++) {
      if (normPhone_(String(colP[pi][0])) === npR) { rowIdx = pi + 2; break; }
    }
  }
  if (rowIdx > 0) {
    // Doc du lieu hien tai de bao toan truong mo rong neu incoming khong co
    var existRow = sh.getRange(rowIdx, 1, 1, CARE_HEADERS.length).getValues()[0];
    mergeExtFields_(r, { khStatus: existRow[15]||'', nickZalos: existRow[16]||'[]', birthday: existRow[17]||'', zaloSetBy: existRow[18]||'' });
    sh.getRange(rowIdx, 1, 1, CARE_HEADERS.length).setValues([careRow_(r)]);
  } else {
    sh.appendRow(careRow_(r));
  }
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('customers_v12');
    cache.remove('lk_' + normPhone_(String(r.phone)));
  } catch(ec) {}
  return jsonOut_({ ok: true, found: rowIdx > 0 });
}

function saveBatchCare_(rows) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var data = sh.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < data.length; i++) { if (data[i][0]) index[normPhone_(String(data[i][0]))] = i; }
  var appended = 0, updated = 0;
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k]; var key = normPhone_(String(r.phone));
    if (index[key] !== undefined) {
      mergeExtFields_(r, { khStatus: data[index[key]][15]||'', nickZalos: data[index[key]][16]||'[]', birthday: data[index[key]][17]||'', zaloSetBy: data[index[key]][18]||'' });
      data[index[key]] = careRow_(r); updated++;
    } else {
      data.push(careRow_(r)); index[key] = data.length - 1; appended++;
    }
  }
  var Wb = CARE_HEADERS.length;
  for (var bi = 1; bi < data.length; bi++) {
    var brow = data[bi] || [];
    if (brow.length > Wb) brow = brow.slice(0, Wb);
    while (brow.length < Wb) brow.push('');
    data[bi] = brow;
  }
  sh.getRange(1, 1, data.length, Wb).setValues(data);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
  invalidateLookupCache_(rows.map(function(r){ return r.phone; }));
  return jsonOut_({ ok: true, updated: updated, appended: appended });
}

// ── ZALO AI: dong bo trang thai ket ban tu nut "Quet man hinh hien tai" trong extension ──
// rows: [{phone, zalo, scannedBy, nick}]
// CHI cap nhat cot 'zalo' (trang thai ket ban) + nickZalos + zaloSetBy, KHONG dung careRow_/saveBatchCare_
// vi careRow_ se ghi de rong cac cot status/cs/note/schedules neu incoming row thieu cac truong do.
//
// dryRun = true: CHI kiem tra xem SDT nao dang doi trang thai ma truoc do da duoc 1 CS/Nick KHAC ghi nhan
//          (zaloSetBy.cs khac scannedBy hien tai) VA gia tri zalo thuc su khac nhau -> tra ve danh sach
//          conflicts de extension hoi CS "co muon ghi de khong", KHONG ghi gi vao sheet ca.
// dryRun = false (mac dinh): ghi that su. Cac dong CS da xac nhan de-o het thi gui nguyen rows nhu binh thuong.
// TOI UU (v13.1): KHONG doc/ghi toan bo sheet CareData (co the toi 40.000+ dong).
// Truoc day ham nay lam sh.getDataRange().getValues() + setValues() lai TOAN BO sheet
// chi de cap nhat vai chuc dong -> voi sheet lon thao tac nay co the mat rat lau,
// khien ket noi bi ngat truoc khi Apps Script tra ve ket qua -> loi "Failed to fetch"
// phia extension (dung xem la loi mang; ban chat la request bi timeout do qua cham).
// Cach moi: chi doc cot A (phone) de dung index, roi CHI ghi dung cac o can doi cho
// tung dong duoc chon (thay vi ghi de ca sheet), va CHI them dong moi bang appendRow
// theo khoi (khong dung lai toan bo data array).
function syncZaloFriendStatus_(rows, dryRun) {
  if (!rows || !rows.length) return jsonOut_({ ok: false, error: 'Khong co du lieu de dong bo' });
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var W = CARE_HEADERS.length;
  var lastRow = sh.getLastRow();

  // Chi doc cot A (phone) cho toan bo sheet -> nhe hon nhieu so voi doc ca 19 cot
  var index = {}; // phone -> so dong tren sheet (1-based, >=2)
  if (lastRow >= 2) {
    var phoneCol = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < phoneCol.length; i++) {
      if (phoneCol[i][0]) index[normPhone_(String(phoneCol[i][0]))] = i + 2;
    }
  }

  if (dryRun) {
    var conflicts = [];
    for (var c = 0; c < rows.length; c++) {
      var rc = rows[c];
      var phoneC = normPhone_(String(rc.phone || ''));
      var rn = phoneC ? index[phoneC] : undefined;
      if (!phoneC || rn === undefined) continue;
      // Chi doc 2 o can thiet (zalo + zaloSetBy) cho dong nay, khong doc ca dong/ca sheet
      var oldZalo = sh.getRange(rn, 3).getValue() || '';
      if (!oldZalo || oldZalo === (rc.zalo || '')) continue; // chua tung ghi, hoac gia tri khong doi -> khong tinh la xung dot
      var oldSetByRaw = sh.getRange(rn, 19).getValue();
      var oldSetBy = null;
      try { oldSetBy = JSON.parse(oldSetByRaw || 'null'); } catch (e) { oldSetBy = null; }
      var oldCs = oldSetBy ? (oldSetBy.cs || '') : '';
      var oldNick = oldSetBy ? (oldSetBy.nick || '') : '';
      if (oldCs && oldCs !== (rc.scannedBy || '')) {
        conflicts.push({ phone: rc.phone, oldZalo: oldZalo, oldCs: oldCs, oldNick: oldNick, newZalo: rc.zalo || '' });
      }
    }
    return jsonOut_({ ok: true, dryRun: true, conflicts: conflicts });
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (eLock) { /* tiep tuc, chap nhan rui ro hiem gap trung dong moi */ }

  var updated = 0, appended = 0;
  var now = new Date().toISOString();
  var newRows = [];
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var phone = normPhone_(String(r.phone || ''));
    if (!phone) continue;
    var zaloStatus = r.zalo || '';
    var nick = String(r.nick || '').trim();
    var setBy = JSON.stringify({ cs: r.scannedBy || '', nick: nick, at: now });

    var rowNum = index[phone];
    if (rowNum !== undefined) {
      // FIX: chi ghi neu THUC SU co gi thay doi (zalo status khac, hoac nick moi chua co).
      // Truoc day ham nay luon ghi lai cot 'updated' (O) cho MOI dong duoc quet, ke ca khi
      // trang thai zalo khong doi gi ca -> Sasum tuong lam la "khach vua co cap nhat moi"
      // moi lan CS chi don gian mo lai doan chat / bam quet man hinh, gay bao dong gia.
      var curZalo = sh.getRange(rowNum, 3).getValue() || '';
      var nickAlreadyThere = true;
      var curNzRaw = '';
      if (nick) {
        curNzRaw = sh.getRange(rowNum, 17).getValue();
        var nzChk = [];
        try { nzChk = JSON.parse(curNzRaw || '[]'); } catch (e) { nzChk = []; }
        if (!Array.isArray(nzChk)) nzChk = [];
        nickAlreadyThere = nzChk.indexOf(nick) !== -1;
      }
      if (curZalo === zaloStatus && nickAlreadyThere) {
        // Khong co gi thay doi -> bo qua hoan toan, KHONG dung vao cot 'updated'
        continue;
      }
      // Chi ghi dung 3 vung o thay doi cua dong nay: zalo(C), updated(O), zaloSetBy(S) [+ nickZalos(Q) neu co nick moi]
      if (curZalo !== zaloStatus) sh.getRange(rowNum, 3).setValue(zaloStatus);
      sh.getRange(rowNum, 15).setValue(now);
      if (nick && !nickAlreadyThere) {
        var nz = [];
        try { nz = JSON.parse(curNzRaw || '[]'); } catch (e) { nz = []; }
        if (!Array.isArray(nz)) nz = [];
        nz.push(nick);
        sh.getRange(rowNum, 17).setValue(JSON.stringify(nz));
      }
      sh.getRange(rowNum, 19).setValue(setBy);
      updated++;
    } else {
      var newRow = careRow_({ phone: phone, zalo: zaloStatus, nickZalos: nick ? [nick] : [], zaloSetBy: setBy });
      if (newRow.length > W) newRow = newRow.slice(0, W);
      while (newRow.length < W) newRow.push('');
      newRows.push(newRow);
      index[phone] = lastRow + newRows.length; // du phong neu co SDT trung lap trong cung 1 lan sync
      appended++;
    }
  }

  if (newRows.length) {
    sh.getRange(lastRow + 1, 1, newRows.length, W).setValues(newRows);
  }

  try { lock.releaseLock(); } catch (eu) {}
  try { CacheService.getScriptCache().remove('customers_v12'); } catch (ec) {}
  invalidateLookupCache_(rows.map(function (r) { return r.phone; }));
  return jsonOut_({ ok: true, updated: updated, appended: appended });
}

// ─── SAVE ORDERS ───────────────────────────────────────────────
function saveOrders_(orders) {
  if (!orders || !orders.length) return jsonOut_({ ok: true, written: 0, skipped: 0 });
  var ss = getOrderSS_(); var groups = {};
  for (var k = 0; k < orders.length; k++) {
    var o = orders[k]; var shName = getOrderSheetName_(o.year);
    if (!groups[shName]) groups[shName] = [];
    groups[shName].push(o);
  }
  var totalWritten = 0, totalSkipped = 0;
  for (var sName in groups) {
    var sh = getOrderSheet_(sName);
    var existing = sh.getDataRange().getValues(); var keys = {};
    for (var i = 1; i < existing.length; i++) {
      if (!existing[i][0]) continue;
      keys[existing[i][0]+'|'+existing[i][3]+'|'+existing[i][4]+'|'+existing[i][7]] = true;
    }
    var toAppend = []; var grp = groups[sName];
    for (var j = 0; j < grp.length; j++) {
      var ord = grp[j];
      var key = (ord.phone||'')+'|'+(ord.year||'')+'|'+(ord.month||'')+'|'+(ord.revenue||0);
      if (keys[key]) { totalSkipped++; continue; }
      keys[key] = true;
      toAppend.push([ord.phone||'', ord.name||'', ord.date||'', ord.year||'', ord.month||'',
        ord.cs||'', ord.source||'', ord.revenue||0, ord.product||'', ord.productDetail||'',
        ord.status||'', ord.zalo||'', ord.note||'', ord.careCS||'']);
    }
    if (toAppend.length) {
      sh.getRange(sh.getLastRow()+1, 1, toAppend.length, ORDER_HEADERS.length).setValues(toAppend);
      totalWritten += toAppend.length;
    }
  }
  return jsonOut_({ ok: true, written: totalWritten, skipped: totalSkipped });
}

function patchOrder_(data) {
  var ss = getOrderSS_();
  var shName = getOrderSheetName_(data.oldYear);
  var sheetsToSearch = [shName];
  for (var si = 0; si < ORDER_SHEETS.length; si++) {
    if (ORDER_SHEETS[si].name !== shName) sheetsToSearch.push(ORDER_SHEETS[si].name);
  }
  for (var si2 = 0; si2 < sheetsToSearch.length; si2++) {
    var sh = ss.getSheetByName(sheetsToSearch[si2]);
    if (!sh || sh.getLastRow() < 2) continue;
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      if (String(r[0]) !== String(data.phone))      continue;
      if (String(r[3]) !== String(data.oldYear))    continue;
      if (String(r[4]) !== String(data.oldMonth))   continue;
      if (Number(r[7]) !== Number(data.oldRevenue)) continue;
      if (data.newDate    !== undefined) sh.getRange(i+1, 3).setValue(data.newDate);
      if (data.newYear    !== undefined) sh.getRange(i+1, 4).setValue(data.newYear);
      if (data.newMonth   !== undefined) sh.getRange(i+1, 5).setValue(data.newMonth);
      if (data.newRevenue !== undefined) sh.getRange(i+1, 8).setValue(data.newRevenue);
      if (data.newProduct)               sh.getRange(i+1, 9).setValue(data.newProduct);
      if (data.newDetail)                sh.getRange(i+1,10).setValue(data.newDetail);
      try { CacheService.getScriptCache().remove('lk_' + normPhone_(String(data.phone))); } catch(ec) {}
      return jsonOut_({ ok: true, updated: true });
    }
  }
  var newSh = getOrderSheet_(getOrderSheetName_(data.newYear || data.oldYear));
  newSh.appendRow([data.phone||'', '', data.newDate||'', data.newYear||data.oldYear||'',
    data.newMonth||data.oldMonth||'', '', '', data.newRevenue||0,
    data.newProduct||'', data.newDetail||'', '', '', '', '']);
  return jsonOut_({ ok: true, updated: false, appended: true });
}

function deleteOrder_(data) {
  var ss = getOrderSS_();
  var shName = getOrderSheetName_(data.oldYear);
  var sheetsToSearch = [shName];
  for (var si = 0; si < ORDER_SHEETS.length; si++) {
    if (ORDER_SHEETS[si].name !== shName) sheetsToSearch.push(ORDER_SHEETS[si].name);
  }
  for (var si2 = 0; si2 < sheetsToSearch.length; si2++) {
    var sh = ss.getSheetByName(sheetsToSearch[si2]);
    if (!sh || sh.getLastRow() < 2) continue;
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      if (String(r[0]) !== String(data.phone))      continue;
      if (String(r[3]) !== String(data.oldYear))    continue;
      if (String(r[4]) !== String(data.oldMonth))   continue;
      if (Number(r[7]) !== Number(data.oldRevenue)) continue;
      sh.deleteRow(i + 1);
      try { CacheService.getScriptCache().remove('lk_' + normPhone_(String(data.phone))); } catch(ec) {}
      return jsonOut_({ ok: true, deleted: true });
    }
  }
  return jsonOut_({ ok: true, deleted: false });
}

// ─── XOA DON TRUNG ────────────────────────────────────────────────
// Truoc day so trung theo SDT+nam+thang+DOANH THU — nhung co truong hop
// 1 don bi nhan bản do loi sheet/import lam MAT 3 SO 0 o doanh thu (VD:
// 689 thay vi 689.000), khien 2 dong thuc chat la 1 don nhung KHONG
// trung theo doanh thu -> khong phat hien duoc. Nen doi key so trung
// sang SDT + NGAY MUA CU THE + san pham (BO doanh thu ra khoi key).
// - Neu ca nhom co doanh thu GIONG HET nhau -> "trung chinh xac", tu
//   dong de xuat giu dong dau, xoa cac dong con lai (extras da tick san).
// - Neu doanh thu KHAC NHAU trong nhom (nhu ca "mat so 0" o tren) ->
//   danh dau needsReview=true, KHONG tu chon dong nao de xoa — giao
//   dien phai hien ro doanh thu tung dong de CS/admin tu chon dong SAI
//   can xoa, tranh xoa nham dong co doanh thu DUNG.
function normOrderDate_(v) {
  if (!v) return '';
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d)) return String(v).trim();
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd');
}
function _normTxt_(s) { return String(s || '').trim().toLowerCase(); }

function findDuplicateOrders_(phoneFilter) {
  var ss = getOrderSS_();
  var normP = phoneFilter ? normPhone_(phoneFilter) : '';
  var groupsByKey = {};
  for (var si = 0; si < ORDER_SHEETS.length; si++) {
    var shName = ORDER_SHEETS[si].name;
    var sh = ss.getSheetByName(shName);
    if (!sh || sh.getLastRow() < 2) continue;
    var vals = sh.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      if (!r[0]) continue;
      var np = normPhone_(r[0]);
      if (normP && np !== normP) continue;
      var nDate = normOrderDate_(r[2]);
      var key = np + '|' + nDate + '|' + _normTxt_(r[8]) + '|' + _normTxt_(r[9]);
      if (!groupsByKey[key]) groupsByKey[key] = [];
      groupsByKey[key].push({
        sheet: shName, rowIndex: i + 1, phone: r[0], name: r[1] || '', date: r[2] || '',
        year: r[3] || '', month: r[4] || '', cs: r[5] || '', source: r[6] || '',
        revenue: r[7] || 0, product: r[8] || '', productDetail: r[9] || '', status: r[10] || ''
      });
    }
  }
  var dupGroups = [];
  Object.keys(groupsByKey).forEach(function (k) {
    var g = groupsByKey[k];
    if (g.length < 2) return;
    g.sort(function (a, b) { return a.rowIndex - b.rowIndex; });
    var firstRev = Number(g[0].revenue) || 0;
    var allSameRevenue = g.every(function (row) { return (Number(row.revenue) || 0) === firstRev; });
    var note = '';
    var maxRev = firstRev;
    var zeroLossPattern = false;
    if (!allSameRevenue) {
      for (var a = 0; a < g.length; a++) { var ra0 = Number(g[a].revenue) || 0; if (ra0 > maxRev) maxRev = ra0; }
      for (var a = 0; a < g.length && !note; a++) {
        for (var b = 0; b < g.length && !note; b++) {
          if (a === b) continue;
          var ra = Number(g[a].revenue) || 0, rb = Number(g[b].revenue) || 0;
          if (ra > 0 && rb > 0 && ra !== rb && (ra === rb * 1000 || rb === ra * 1000)) {
            zeroLossPattern = true;
            note = 'Doanh thu lệch nhau đúng 1000 lần (VD ' + rb + ' vs ' + ra + ') — nghi ngờ lỗi MẤT 3 SỐ 0 khi nhập liệu, không phải 2 đơn thật. Đề xuất giữ dòng doanh thu LỚN HƠN (' + maxRev.toLocaleString('vi-VN') + 'đ), xóa (các) dòng nhỏ hơn — vui lòng xác nhận lại trước khi xóa.';
          }
        }
      }
      if (!note) note = 'Các dòng trùng ngày mua + sản phẩm nhưng DOANH THU KHÁC NHAU — kiểm tra kỹ trước khi xóa, có thể là 2 đơn thật khác nhau, hệ thống KHÔNG tự đề xuất dòng để xóa.';
    }
    // Đề xuất dòng để xóa (tick sẵn ở UI) — CHỈ đề xuất, người dùng vẫn phải xác nhận trước khi xóa thật:
    // - Nhóm giống hệt: giữ dòng đầu, đề xuất xóa các dòng còn lại.
    // - Nhóm nghi mất số 0 (lệch đúng 1000 lần): giữ dòng doanh thu LỚN hơn, đề xuất xóa (các) dòng NHỎ hơn.
    // - Nhóm lệch doanh thu kiểu khác: KHÔNG đề xuất dòng nào, để người dùng tự chọn.
    var autoDeleteRows;
    if (allSameRevenue) autoDeleteRows = g.slice(1);
    else if (zeroLossPattern) autoDeleteRows = g.filter(function (row) { return (Number(row.revenue) || 0) < maxRev; });
    else autoDeleteRows = [];
    dupGroups.push({
      key: k, phone: g[0].phone, name: g[0].name, year: g[0].year, month: g[0].month,
      date: g[0].date, product: g[0].product, productDetail: g[0].productDetail,
      count: g.length, exact: allSameRevenue, zeroLossPattern: zeroLossPattern, note: note,
      rows: g,
      keep: allSameRevenue ? g[0] : null,
      extras: autoDeleteRows
    });
  });
  var totalExtra = 0;
  dupGroups.forEach(function (g) { totalExtra += g.extras.length; });
  return { ok: true, groups: dupGroups, groupCount: dupGroups.length, totalExtra: totalExtra };
}

// items: [{sheet, rowIndex, phone?, date?, revenue?, product?}, ...] — lay tu extras (nhom exact)
// hoac do CS/admin tu chon (nhom needsReview) trong findDuplicateOrders_, hoac 1 dong le CS tu bam xoa.
// Neu co gui kem phone/date/revenue/product, se XAC MINH LAI dung dong do truoc khi xoa — tranh
// truong hop rowIndex bi lech (co CS khac vua them/xoa dong khac trong luc do) dan den xoa NHAM dong.
function deleteDuplicateOrders_(items) {
  if (!items || !items.length) return jsonOut_({ ok: true, deleted: 0, skipped: 0 });
  var ss = getOrderSS_();
  var bySheet = {};
  items.forEach(function (it) {
    if (!it || !it.sheet || !it.rowIndex) return;
    if (!bySheet[it.sheet]) bySheet[it.sheet] = [];
    bySheet[it.sheet].push(it);
  });
  var deleted = 0, skipped = 0, affectedPhones = {};
  Object.keys(bySheet).forEach(function (shName) {
    var sh = ss.getSheetByName(shName);
    if (!sh) return;
    // Xoa tu duoi len tren trong cung 1 sheet de khong lam lech chi so cac dong con lai
    var arr = bySheet[shName].slice().sort(function (a, b) { return b.rowIndex - a.rowIndex; });
    arr.forEach(function (it) {
      try {
        var rowVals = sh.getRange(it.rowIndex, 1, 1, 10).getValues()[0]; // phone..productDetail
        var match = true;
        if (it.phone   != null && it.phone   !== '' && normPhone_(String(rowVals[0])) !== normPhone_(String(it.phone))) match = false;
        if (match && it.date    != null && it.date    !== '' && normOrderDate_(rowVals[2]) !== normOrderDate_(it.date)) match = false;
        if (match && it.revenue != null && it.revenue !== '' && (Number(rowVals[7]) || 0) !== (Number(it.revenue) || 0)) match = false;
        if (match && it.product != null && it.product !== '' && _normTxt_(rowVals[8]) !== _normTxt_(it.product)) match = false;
        if (!match) { skipped++; return; } // dong da bi dich/doi khac voi luc CS bam xoa -> KHONG xoa, tranh xoa nham
        if (rowVals[0]) affectedPhones[normPhone_(String(rowVals[0]))] = true;
        sh.deleteRow(it.rowIndex);
        deleted++;
      } catch (e) { skipped++; }
    });
  });
  try {
    var cache = CacheService.getScriptCache();
    Object.keys(affectedPhones).forEach(function (p) { cache.remove('lk_' + p); });
  } catch (ec) {}
  return jsonOut_({ ok: true, deleted: deleted, skipped: skipped });
}

function replaceOrders_(orders, data) {
  orders = orders || [];
  var allowEmpty = data && data.allowEmpty === true;
  var force      = data && data.force === true;
  var ss = getOrderSS_(); var prev = 0;
  for (var si = 0; si < ORDER_SHEETS.length; si++) {
    var sh0 = ss.getSheetByName(ORDER_SHEETS[si].name);
    if (sh0) prev += Math.max(0, sh0.getLastRow() - 1);
  }
  if (orders.length === 0 && !allowEmpty) {
    return jsonOut_({ error: 'TU_CHOI: Du lieu rong. Gui kem allowEmpty=true neu muon xoa sach.', prev: prev });
  }
  if (orders.length > 0 && prev > 50 && orders.length < prev * 0.4 && !force) {
    return jsonOut_({ warn: true, needForce: true, prev: prev, incoming: orders.length,
      error: 'CANH_BAO: Du lieu moi ('+orders.length+') it hon 40% du lieu cu ('+prev+'). Gui lai voi force=true.' });
  }
  var groups = {};
  for (var si2 = 0; si2 < ORDER_SHEETS.length; si2++) groups[ORDER_SHEETS[si2].name] = [];
  for (var k = 0; k < orders.length; k++) {
    var o = orders[k]; var shName = getOrderSheetName_(o.year);
    if (!groups[shName]) groups[shName] = [];
    groups[shName].push(o);
  }
  var totalWritten = 0;
  for (var sName in groups) {
    var sh = getOrderSheet_(sName);
    sh.clearContents();
    sh.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS]);
    var grp = groups[sName]; var CHUNK = 50000; var rowPtr = 2;
    for (var start = 0; start < grp.length; start += CHUNK) {
      var end = Math.min(start + CHUNK, grp.length); var matrix = [];
      for (var j = start; j < end; j++) {
        var ord = grp[j];
        matrix.push([ord.phone||'', ord.name||'', ord.date||'', ord.year||'', ord.month||'',
          ord.cs||'', ord.source||'', ord.revenue||0, ord.product||'', ord.productDetail||'',
          ord.status||'', ord.zalo||'', ord.note||'', ord.careCS||'']);
      }
      if (matrix.length) { sh.getRange(rowPtr, 1, matrix.length, ORDER_HEADERS.length).setValues(matrix); rowPtr += matrix.length; }
      SpreadsheetApp.flush();
    }
    totalWritten += grp.length;
  }
  return jsonOut_({ ok: true, mode: 'replace', prev: prev, written: totalWritten });
}

function setOrderCareCS_(phone, careCS) {
  if (!phone) return jsonOut_({ error: 'thieu phone' });
  var ss = getOrderSS_(); var totalUpdated = 0;
  for (var si = 0; si < ORDER_SHEETS.length; si++) {
    var sh = ss.getSheetByName(ORDER_SHEETS[si].name);
    if (!sh || sh.getLastRow() < 2) continue;
    var found = sh.getRange(2, 1, sh.getLastRow()-1, 1).createTextFinder(String(phone)).matchEntireCell(true).findAll();
    for (var i = 0; i < found.length; i++) sh.getRange(found[i].getRow(), ORDER_HEADERS.length).setValue(careCS||'');
    totalUpdated += found.length;
  }
  return jsonOut_({ ok: true, updated: totalUpdated });
}

function setOrderCareCSBatch_(updates) {
  updates = updates || [];
  if (!updates.length) return jsonOut_({ ok: true, updated: 0 });
  var map = {};
  for (var u = 0; u < updates.length; u++) { if (updates[u] && updates[u].phone != null) map[String(updates[u].phone)] = (updates[u].careCS||''); }
  var ss = getOrderSS_(); var changed = 0;
  for (var si = 0; si < ORDER_SHEETS.length; si++) {
    var sh = ss.getSheetByName(ORDER_SHEETS[si].name);
    if (!sh || sh.getLastRow() < 2) continue;
    var last = sh.getLastRow(); var col = ORDER_HEADERS.length;
    var phones  = sh.getRange(2, 1, last-1, 1).getValues();
    var careCol = sh.getRange(2, col, last-1, 1).getValues();
    for (var r = 0; r < phones.length; r++) {
      var ph = String(phones[r][0]);
      if (ph && map.hasOwnProperty(ph)) { careCol[r][0] = map[ph]; changed++; }
    }
    sh.getRange(2, col, last-1, 1).setValues(careCol);
  }
  return jsonOut_({ ok: true, updated: changed });
}

// ─── TEAMS / USERS / AUDIT ─────────────────────────────────────
function saveTeams_(teams) {
  var sh = getSheet_(SH_TEAM, TEAM_HEADERS);
  sh.clearContents();
  var matrix = [TEAM_HEADERS];
  for (var i = 0; i < teams.length; i++) {
    var t = teams[i];
    matrix.push([t.id||'', t.name||'', t.leader||'', JSON.stringify(t.members||[]), t.color||'']);
  }
  sh.getRange(1, 1, matrix.length, TEAM_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: teams.length });
}

function saveUsers_(users) {
  users = users || [];
  var adminCount = 0;
  for (var a = 0; a < users.length; a++) { if (users[a] && users[a].role === 'admin') adminCount++; }
  if (users.length > 0 && adminCount === 0) return jsonOut_({ error: 'TU_CHOI: Phai con it nhat 1 tai khoan Admin.' });
  var sh = getSheet_(SH_USER, USER_HEADERS);
  sh.clearContents();
  var matrix = [USER_HEADERS];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    matrix.push([String(u.username||''), String(u.passHash||''), u.role||'cs', u.name||'', u.team||'', (u.active===false?false:true)]);
  }
  sh.getRange(1, 1, matrix.length, USER_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: users.length });
}

function saveAudit_(rows) {
  var sh = getSheet_(SH_AUDIT, AUDIT_HEADERS);
  if (!rows || !rows.length) return jsonOut_({ ok: true, written: 0 });
  var matrix = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    matrix.push([r.timestamp||new Date().toISOString(), r.user||'', r.action||'', r.phone||'', r.oldValue||'', r.newValue||'']);
  }
  sh.getRange(sh.getLastRow()+1, 1, matrix.length, AUDIT_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: matrix.length });
}

// ─── CARE STATUS / ASSIGN ──────────────────────────────────────
function saveCareStatus_(list) {
  if (!Array.isArray(list)) return jsonOut_({ error: 'careStatus phai la mang.' });
  return setSetting_('careStatus', JSON.stringify(list));
}

function readAssign_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    var phones = [], donePhones = [];
    try { phones = JSON.parse(vals[i][4]||'[]'); } catch(e) { phones = []; }
    try { donePhones = JSON.parse(vals[i][5]||'[]'); } catch(e) { donePhones = []; }
    out.push({ id: String(vals[i][0]), date: String(vals[i][1]||''), csName: String(vals[i][2]||''),
               label: String(vals[i][3]||''), phones: phones, donePhones: donePhones });
  }
  return out;
}

function saveAssignEntry_(entry) {
  if (!entry || !entry.id) return jsonOut_({ error: 'no entry.id' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last-1, 1).createTextFinder(String(entry.id)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  var row = [entry.id||'', entry.date||'', entry.csName||'', entry.label||'',
             JSON.stringify(entry.phones||[]), JSON.stringify(entry.donePhones||[])];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, ASSIGN_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true });
}

function saveAssignHistory_(history) {
  if (!history) return jsonOut_({ error: 'no history' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  sh.clearContents();
  var matrix = [ASSIGN_HEADERS];
  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    matrix.push([h.id||'', h.date||'', h.csName||'', h.label||'',
                 JSON.stringify(h.phones||[]), JSON.stringify(h.donePhones||[])]);
  }
  sh.getRange(1, 1, matrix.length, ASSIGN_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: history.length });
}

// ═══════════════════════════════════════════════════════════════
//  AI — Groq + AIContext
// ═══════════════════════════════════════════════════════════════
function readAIContext_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CONTEXT);
  var result = {
    systemPrompt: '', careProcess: '', callbackScript: '',
    salesScriptCu: '', salesScriptMoi: '',
    products: [], faqs: [], combos: []
  };
  if (!sh || sh.getLastRow() < 2) return result;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var type    = String(vals[i][0]||'').trim();
    var content = String(vals[i][1]||'').trim();
    if (!content) continue;
    if      (type === 'system_prompt')         result.systemPrompt   = content;
    else if (type === 'care_process')          result.careProcess    = content;
    else if (type === 'callback_script')       result.callbackScript = content;
    else if (type === 'sales_script_cu')       result.salesScriptCu  = content;
    else if (type === 'sales_script_moi')      result.salesScriptMoi = content;
    else if (type === 'product')               result.products.push(content);
    else if (type === 'faq')                   result.faqs.push(content);
    else if (type === 'combo_template')        result.combos.push(content);
  }
  return result;
}

function saveAIContext_(type, content, context) {
  if (!type || !content) return jsonOut_({ error: 'Thieu type hoac content' });
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CONTEXT);
  if (!sh) { sh = ss.insertSheet(SH_CONTEXT); sh.appendRow(['type','content','context','created']); }
  sh.appendRow([type, content, context||'', new Date().toISOString()]);
  return jsonOut_({ ok: true });
}

// ─── SAN PHAM CHI TIET TU GOOGLE SHEET RIENG, NHIEU TAB (moi tab = 1 hang) ─────────
// Cau hinh: setSetting_('productSheetUrl', <link Google Sheet>) — file phai duoc chia
// se cho tai khoan dang chay Apps Script nay (hoac "Bat ky ai co lien ket" > Xem).
// Dong 1 moi tab = tieu de cot (ten tuy y). Cot dau = ten san pham. Cac o mo ta co the
// RAT DAI (nhu anh Duyen gui — mo ta chi tiet thanh phan/cong dung tung dong nhieu tram
// tu) VA co nhieu tab (nhieu hang) => KHONG duoc nhet toan bo sheet vao 1 prompt (qua
// nang, cham, ton phi AI). Cach lam:
//   1) Cache 1 "muc luc" NHE cho tung tab (ten SP + vi tri dong + doan trich ngan) —
//      cache rieng tung tab de khong vuot gioi han 100KB/1 cache key.
//   2) Khi co cau hoi (query = noi dung prompt dang gui cho AI, gom ca "Ngu canh" CS
//      nhap tay vd go "AHA"), tim trong muc luc cac dong co TU KHOA khop, xep hang theo
//      so tu khop.
//   3) CHI luc do moi doc lai NGUYEN VAN vai dong diem cao nhat (toi da 4 dong) tu dung
//      sheet — vua chinh xac vua khong lam prompt qua tai.
var _PSHEET_STOPWORDS_ = ['khach','san','pham','hang','chao','nhan','tin','giong','van',
  'yeu','cau','tra','loi','cham','soc','mua','goi','ngan','gon','tieng','viet','duoc',
  'nay','cho','voi','theo','mot','cac','trong','nguoi','minh','ban','the','nao','khong'];

function _psheetNoAccent_(s) {
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function _productSheetIndexForTab_(ss, tabName) {
  var cacheKey = 'ext_idx_v2_' + tabName;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}
  var idx = [];
  try {
    var sh = ss.getSheetByName(tabName);
    if (sh && sh.getLastRow() >= 2 && sh.getLastColumn() >= 1) {
      var vals = sh.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var row = vals[i];
        if (!row[0]) continue;
        var snippet = row.map(function(v){ return String(v||'').trim(); }).filter(Boolean).join(' ').substring(0, 250);
        idx.push({ row: i + 1, name: String(row[0]).trim(), snippet: snippet });
      }
    }
  } catch (e) { /* tab loi/khong doc duoc -> bo qua tab nay */ }
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(idx), 900); } catch (ec2) {} // 15 phut
  return idx;
}

// ─── Q&A / FAQ: doc sheet "FAQ" trong CareData, khop tu khoa cau hoi khach -> lay top Q&A ───
// Cot: A=STT | B=Ten SP | C=Trang thai | D=CAU HOI | E=CAU TRA LOI (dong 1 la tieu de)
function readFaqSheet_(query) {
  var ss = getCrmSS_();
  var sh = null;
  var names = ['FAQ', 'Q&A', 'QA', 'FAQs', 'Hỏi đáp', 'Hoi dap', 'HoiDap'];
  for (var n = 0; n < names.length; n++) { sh = ss.getSheetByName(names[n]); if (sh) break; }
  if (!sh || sh.getLastRow() < 2) return '';
  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var vals = sh.getDataRange().getValues();
  // Tu do cot: tim cot tieu de chua "cau hoi" / "cau tra loi" / "ten sp"
  var header = vals[0].map(function(h){ return _psheetNoAccent_(h); });
  var findCol = function(kw, def){ for (var c=0;c<header.length;c++){ if (header[c].indexOf(kw)!==-1) return c; } return def; };
  var cQ  = findCol('cau hoi', 3);
  var cA  = findCol('tra loi', 4);
  var cSP = findCol('ten sp', 1);
  var cands = [];
  for (var i = 1; i < vals.length; i++) {
    var sp   = String(vals[i][cSP] || '').trim();
    var ques = String(vals[i][cQ] || '').trim();
    var ans  = String(vals[i][cA] || '').trim();
    if (!ques || !ans) continue;
    var hay = _psheetNoAccent_(sp + ' ' + ques + ' ' + ans);
    var score = 0;
    for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
    if (score > 0) cands.push({ sp: sp, q: ques, a: ans, score: score });
  }
  if (!cands.length) return '';
  cands.sort(function(a, b) { return b.score - a.score; });
  var top = cands.slice(0, 4);
  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    var a = top[k].a; if (a.length > 700) a = a.substring(0, 700) + '...';
    blocks.push((top[k].sp ? '[' + top[k].sp + '] ' : '') + 'HOI: ' + top[k].q + '\nTRA LOI MAU: ' + a);
  }
  return blocks.join('\n\n');
}

function readExternalProductSheet_(query) {
  var url = getSetting_('productSheetUrl');
  if (!url) return '';
  var ss;
  try { ss = SpreadsheetApp.openByUrl(url); } catch (e) { return ''; } // chua chia se quyen / URL sai

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var tabNames = ss.getSheets().map(function(s) { return s.getName(); });
  var candidates = [];
  for (var t = 0; t < tabNames.length; t++) {
    var idx = _productSheetIndexForTab_(ss, tabNames[t]);
    for (var i = 0; i < idx.length; i++) {
      var hay = _psheetNoAccent_(idx[i].name + ' ' + idx[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > 0) candidates.push({ brand: tabNames[t], row: idx[i].row, score: score });
    }
  }
  if (!candidates.length) return '';
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 4);

  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    try {
      var sh2 = ss.getSheetByName(top[k].brand);
      var lastCol = sh2.getLastColumn();
      var headerVals = sh2.getRange(1, 1, 1, lastCol).getValues()[0];
      var rowVals = sh2.getRange(top[k].row, 1, 1, lastCol).getValues()[0];
      var parts = [];
      for (var c = 0; c < headerVals.length; c++) {
        var h = String(headerVals[c] || '').trim();
        var v = String(rowVals[c] || '').trim();
        if (h && v && !/hinh|image|ảnh/i.test(h)) parts.push(h + ': ' + v);
      }
      var block = '[Hãng: ' + top[k].brand + ']\n' + parts.join('\n');
      if (block.length > 1800) block = block.substring(0, 1800) + '...';
      blocks.push(block);
    } catch (e) { /* bo qua dong loi, khong chan cac dong khac */ }
  }
  return blocks.join('\n\n---\n\n');
}

function callGroqAI_(data) { return callAI_(data); } // alias tuong thich cu

// ─── Prompt he thong: kien thuc san pham CHI nap khi CS bat "Tra cuu san pham" ───
function _buildAISystemPrompt_(userMsg, withProducts) {
  var ctx = readAIContext_();
  var trunc_ = function(str, n) { return str && str.length > n ? str.substring(0, n) + '...' : str; };
  var parts = [];
  parts.push(ctx.systemPrompt || 'Ban la chuyen vien cham soc khach hang cua cong ty my pham OME. Tra loi bang tieng Viet, than thien, ngan gon.');
  if (ctx.careProcess)    parts.push('\n\nQUY TRINH CSKH:\n'    + trunc_(ctx.careProcess, 600));
  if (ctx.callbackScript) parts.push('\n\nKICH BAN GOI LAI:\n'  + trunc_(ctx.callbackScript, 500));
  if (ctx.salesScriptCu)  parts.push('\n\nKICH BAN KHACH CU:\n' + trunc_(ctx.salesScriptCu, 500));
  if (ctx.salesScriptMoi) parts.push('\n\nKICH BAN KHACH MOI:\n'+ trunc_(ctx.salesScriptMoi, 500));
  // Chi nap kien thuc san pham (nang) khi CS chu dong bat "Tra cuu san pham" -> giu prompt nhe, tranh 429
  if (withProducts) {
    if (ctx.products.length > 0) parts.push('\n\nSAN PHAM OME:\n' + ctx.products.slice(0, 12).join('\n'));
    if (ctx.faqs.length > 0)     parts.push('\n\nFAQ:\n'          + ctx.faqs.slice(0, 4).join('\n'));
    if (ctx.combos.length > 0)   parts.push('\n\nMAU TIN NHAN:\n' + ctx.combos.slice(0, 5).join('\n'));
    var ext = readExternalProductSheet_(userMsg);
    if (ext) parts.push('\n\nTHONG TIN CHI TIET SAN PHAM / THANH PHAN (nguon: Google Sheet rieng cua team, khop tu khoa trong yeu cau — uu tien dung khi tra loi ve thanh phan/cong dung cu the):\n' + ext);
  }
  // Q&A tu sheet FAQ (khop tu khoa cau hoi khach) — de AI hoc cach xu ly cau hoi kho theo team
  var faq = readFaqSheet_(userMsg);
  if (faq) parts.push('\n\nCAC CAU HOI KHO & CACH TRA LOI MAU CUA TEAM (uu tien bam sat cach xu ly / giong dieu nay khi tra loi cau tuong tu; dieu chinh cho hop ngu canh khach, KHONG copy nguyen van neu khong khop hoan toan):\n' + faq);
  parts.push('\n\nYEU CAU: Chi dua ra DUY NHAT 1 cau tra loi ngan gon (toi da 150 tu). Khong danh so, khong giai thich them.');
  return parts.join('');
}

// ─── Goi provider dang OpenAI-compatible (Groq, Cerebras) ───
function _aiOpenAICompat_(prov, sys, userMsg) {
  try {
    var res = UrlFetchApp.fetch(prov.url, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + prov.key },
      contentType: 'application/json',
      payload: JSON.stringify({
        model: prov.model,
        messages: [ { role: 'system', content: sys }, { role: 'user', content: userMsg } ],
        temperature: 0.7, max_tokens: 400
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode(), txt = res.getContentText();
    if (code !== 200) return { ok: false, error: code + ' ' + txt.substring(0, 200) };
    var d = JSON.parse(txt);
    var t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return { ok: true, text: t || '' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─── Goi Gemini (dinh dang rieng cua Google) ───
function _aiGemini_(prov, sys, userMsg) {
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + prov.model + ':generateContent?key=' + encodeURIComponent(prov.key);
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({
        systemInstruction: { parts: [ { text: sys } ] },
        contents: [ { role: 'user', parts: [ { text: userMsg } ] } ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode(), txt = res.getContentText();
    if (code !== 200) return { ok: false, error: code + ' ' + txt.substring(0, 200) };
    var d = JSON.parse(txt);
    var t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
    return { ok: true, text: t || '' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─── AI da nha cung cap: Groq -> Cerebras -> Gemini (dung cai nao co key & tra loi duoc) ───
function callAI_(data) {
  var userMsg = data.prompt || '';
  if (!userMsg) return jsonOut_({ error: 'Thieu noi dung' });
  var withProducts = !!data.withProducts;
  var sys = _buildAISystemPrompt_(userMsg, withProducts);

  var providers = [
    { name: 'Groq',     key: getSetting_('apiGroq') || getSetting_('geminiKey'), fn: _aiOpenAICompat_, url: 'https://api.groq.com/openai/v1/chat/completions',     model: 'llama-3.3-70b-versatile' },
    { name: 'Cerebras', key: getSetting_('apiCerebras'),                          fn: _aiOpenAICompat_, url: 'https://api.cerebras.ai/v1/chat/completions',        model: 'llama-3.3-70b' },
    { name: 'Gemini',   key: getSetting_('apiGemini'),                            fn: _aiGemini_,       model: 'gemini-2.0-flash' }
  ];

  var errors = [], anyKey = false;
  for (var i = 0; i < providers.length; i++) {
    var pv = providers[i];
    if (!pv.key) continue;
    anyKey = true;
    var r = pv.fn(pv, sys, userMsg);
    if (r.ok && r.text) return jsonOut_({ ok: true, text: r.text, provider: pv.name });
    errors.push(pv.name + ': ' + (r.error || 'rong'));
    // loi (429/sai key/...) -> tu dong thu provider ke tiep
  }
  if (!anyKey) return jsonOut_({ error: 'Chua co API Key nao. Mo extension → banh rang → nhap it nhat 1 key (Groq/Cerebras/Gemini).' });
  return jsonOut_({ error: 'Tat ca API deu loi: ' + errors.join(' | ') });
}


// ═══════════════════════════════════════════════════════════════
//  testScript — chay 1 lan de tao sheet + kiem tra
// ═══════════════════════════════════════════════════════════════
function testScript() {
  getSheet_(SH_CARE, CARE_HEADERS);
  getSheet_(SH_TEAM, TEAM_HEADERS);
  getSheet_(SH_AUDIT, AUDIT_HEADERS);
  getSheet_(SH_SET, SET_HEADERS);
  getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  getSheet_(SH_USER, USER_HEADERS);
  var oss = getOrderSS_();
  for (var i = 0; i < ORDER_SHEETS.length; i++) {
    var _s = oss.getSheetByName(ORDER_SHEETS[i].name) || oss.insertSheet(ORDER_SHEETS[i].name);
    if (_s.getLastRow() === 0) _s.appendRow(ORDER_HEADERS);
  }
  var ss   = getCrmSS_();
  var oss2 = getOrderSS_();
  var log  = 'OK v12.0 - CareData:' + ss.getSheetByName(SH_CARE).getLastRow();
  for (var j = 0; j < ORDER_SHEETS.length; j++) {
    var sh = oss2.getSheetByName(ORDER_SHEETS[j].name);
    log += ' | ' + ORDER_SHEETS[j].name + ':' + (sh ? sh.getLastRow() : 'missing');
  }
  Logger.log(log);
  var testLookup = findCareByPhone_('0978000000');
  Logger.log('Test lookup: ' + JSON.stringify(testLookup));
}

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
    var d = (orderDate instanceof Date) ? orderDate : new Date(orderDate);
    if (isNaN(d)) return;
    d.setHours(0, 0, 0, 0);
    if (d < FU_START) return; // chi hoi tham khach mua tu 5/2026 tro di
    var daysSince = Math.round((today - d) / 86400000);
    if (!fuDaysSet[daysSince]) return;
    var np = normPhone_(phone);
    if (!np || matchedPhones[np]) return; // 1 KH chi nhan 1 tin moi lan chay, tranh spam neu khop nhieu don

    var orderKey = (orderDate instanceof Date ? orderDate.toISOString().slice(0, 10) : String(orderDate));
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

  // 1) Uu tien du lieu don hang that trong OrderData
  // Chi doc sheet nam hien tai + nam truoc (moc xa nhat la 60 ngay, khong can doc 21-25)
  var orders = [];
  var curY = today.getFullYear();
  var ossFU = getOrderSS_();
  for (var syi = 0; syi < ORDER_SHEETS.length; syi++) {
    var shYears = ORDER_SHEETS[syi].years;
    if (shYears.indexOf(curY) === -1 && shYears.indexOf(curY - 1) === -1) continue;
    var shFU = ossFU.getSheetByName(ORDER_SHEETS[syi].name);
    if (shFU) orders = orders.concat(readOrders_(shFU));
  }
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

var SH_TASK = 'Tasks';
var TASK_HEADERS = ['id','title','description','csAssigned','deadline','status','createdBy','createdAt','updatedAt','result','images','teamsAssigned'];

var SH_TASKCM = 'TaskComments';
var TASKCM_HEADERS = ['id','taskId','author','content','images','createdAt'];

function readTasks_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    var cs = [];
    try { cs = v[i][3] ? JSON.parse(v[i][3]) : []; } catch (e) { cs = String(v[i][3] || '').split(',').filter(Boolean); }
    var imgs = [];
    try { imgs = v[i][10] ? JSON.parse(v[i][10]) : []; } catch (e2) { imgs = []; }
    var teamsAssigned = [];
    try { teamsAssigned = v[i][11] ? JSON.parse(v[i][11]) : []; } catch (e3) { teamsAssigned = []; }
    out.push({
      id: String(v[i][0]),
      title: String(v[i][1] || ''),
      description: String(v[i][2] || ''),
      csAssigned: cs,
      deadline: v[i][4] ? String(v[i][4]) : '',
      status: String(v[i][5] || 'Chưa làm'),
      createdBy: String(v[i][6] || ''),
      createdAt: String(v[i][7] || ''),
      updatedAt: String(v[i][8] || ''),
      result: String(v[i][9] || ''),
      images: imgs,
      teamsAssigned: teamsAssigned
    });
  }
  return out;
}

// Tạo mới (khi t.id rỗng) hoặc cập nhật (khi t.id đã tồn tại) — cùng 1 hàm, giống pattern saveAssignEntry_
function saveTaskEntry_(t) {
  if (!t || !String(t.title || '').trim()) return jsonOut_({ error: 'Thieu title' });
  var sh = getSheet_(SH_TASK, TASK_HEADERS);
  var now = new Date().toISOString();
  var id = t.id || ('tk_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
  var last = sh.getLastRow(); var rowIdx = -1;
  if (t.id && last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(t.id)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  var createdAt = t.createdAt || now;
  var row = [id, t.title || '', t.description || '', JSON.stringify(t.csAssigned || []),
             t.deadline || '', t.status || 'Chưa làm', t.createdBy || '', createdAt, now,
             t.result || '', JSON.stringify(t.images || []), JSON.stringify(t.teamsAssigned || [])];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, TASK_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true, id: id });
}

function deleteTask_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id' });
  var sh = getSheet_(SH_TASK, TASK_HEADERS);
  var last = sh.getLastRow();
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (cell) sh.deleteRow(cell.getRow());
  }
  return jsonOut_({ ok: true });
}

// ── THẢO LUẬN (bình luận) theo từng công việc ──────────────────
function readTaskComments_(sh, taskId) {
  var out = [];
  if (!sh || sh.getLastRow() < 2 || !taskId) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0] || String(v[i][1]) !== String(taskId)) continue;
    var imgs = [];
    try { imgs = v[i][4] ? JSON.parse(v[i][4]) : []; } catch (e) { imgs = []; }
    out.push({
      id: String(v[i][0]),
      taskId: String(v[i][1]),
      author: String(v[i][2] || ''),
      content: String(v[i][3] || ''),
      images: imgs,
      createdAt: String(v[i][5] || '')
    });
  }
  out.sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  return out;
}

// Bình luận chỉ được thêm mới, không sửa/xóa (giống chat/thảo luận)
function saveTaskComment_(c) {
  if (!c || !c.taskId || (!String(c.content || '').trim() && !(c.images || []).length)) {
    return jsonOut_({ error: 'Thieu noi dung binh luan' });
  }
  var sh = getSheet_(SH_TASKCM, TASKCM_HEADERS);
  var now = new Date().toISOString();
  var id = 'cm_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  sh.appendRow([id, c.taskId, c.author || '', c.content || '', JSON.stringify(c.images || []), now]);
  return jsonOut_({ ok: true, id: id });
}


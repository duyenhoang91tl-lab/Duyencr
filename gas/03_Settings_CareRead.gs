// ─── SETTINGS (1 signature duy nhat) ──────────────────────────
function getSetting_(key) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    // .trim() o CA 2 ve: copy-paste API key rat hay dinh khoang trang/xuong dong o cuoi,
    // ma ky tu do lot vao header Authorization se lam request hong -> bao "Invalid API Key"
    // du key go dung. Truoc day khong trim nen loi nay rat kho doan ra.
    if (String(vals[i][0]).trim() === key) {
      var v = vals[i][1];
      if (v === '' || v === null || v === undefined) return null;
      return String(v).trim() || null;
    }
  }
  return null;
}
// Chia gas_v13.js thanh nhieu manh <=45.000 ky tu, ghi qua setSetting_ (gasSourceChunk_0, _1,...).
// Neu ban moi it manh hon ban truoc, xoa het cac key manh du (gasSourceChunk_N tro len) de khong
// bi lan sang du lieu manh cu khi getGasSource_ doc.
function setGasSource_(code) {
  code = String(code || '');
  var CHUNK = 45000;
  var oldCount = parseInt(getSetting_('gasSourceChunkCount') || '0', 10) || 0;
  var chunks = [];
  for (var i = 0; i < code.length; i += CHUNK) chunks.push(code.slice(i, i + CHUNK));
  for (var c = 0; c < chunks.length; c++) setSetting_('gasSourceChunk_' + c, chunks[c]);
  for (var d = chunks.length; d < oldCount; d++) setSetting_('gasSourceChunk_' + d, '');
  setSetting_('gasSourceChunkCount', String(chunks.length));
  setSetting_('gasSourceUpdatedAt', new Date().toISOString());
  return jsonOut_({ ok: true, chunks: chunks.length, length: code.length });
}
// ─── NHOM SALE (truoc chi co 2 nhom co dinh Online/Van phong, gio Admin tu dinh nghia them nhom
// moi vd CSKH/Quay...) — luu trong setting 'saleGroups' = [{key,label}]. 'online'/'offline' la 2
// key MAC DINH giu nguyen de KHONG vo du lieu cu (saleChannels/saleType dang dung dung 2 key nay).
var SALE_GROUPS_DEFAULT_ = [
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Văn phòng' },
  { key: 'probation', label: 'Thử việc' }
];
function readSaleGroups_() {
  try {
    var raw = getSetting_('saleGroups');
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.filter(function(g) { return g && g.key; }).map(function(g) { return { key: String(g.key), label: String(g.label || g.key) }; });
      }
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(SALE_GROUPS_DEFAULT_));
}
function saveSaleGroups_(list) {
  if (!Array.isArray(list)) return jsonOut_({ ok: false, error: 'Danh sách nhóm không hợp lệ' });
  var clean = [], seen = {};
  for (var i = 0; i < list.length; i++) {
    var key = String((list[i] && list[i].key) || '').trim();
    var label = String((list[i] && list[i].label) || '').trim();
    if (!key || !label || seen[key]) continue;
    seen[key] = true;
    clean.push({ key: key, label: label });
  }
  if (!clean.length) return jsonOut_({ ok: false, error: 'Cần ít nhất 1 nhóm' });
  return setSetting_('saleGroups', JSON.stringify(clean));
}
function _saleGroupLabel_(key, groups) {
  groups = groups || readSaleGroups_();
  var g = groups.filter(function(x) { return x.key === key; })[0];
  return g ? g.label : '';
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
  // "🏷️ Phân loại Online/Offline" (Quan ly Team) ghi vao day — dong bo luon sang truong saleType
  // cua tai khoan dang nhap trung ten, de PHAN LOAI NAY AP DUNG CA CHO DANG NHAP (theo yeu cau
  // Duyen 2026-09: 1 nguon phan loai Online/Offline dung chung MOI NOI, ke ca tai khoan dang nhap),
  // khong chi rieng cac bao cao doanh so.
  if (key === 'saleChannels') { try { _syncSaleChannelsToUsers_(value); } catch (eSync) {} }
  return jsonOut_({ ok: true });
}
function _syncSaleChannelsToUsers_(rawValue) {
  var channels; try { channels = JSON.parse(rawValue); } catch (e) { return; }
  if (!channels || typeof channels !== 'object') return;
  var validKeys = {}; readSaleGroups_().forEach(function(g) { validKeys[g.key] = true; }); // chap nhan BAT KY nhom nao Admin da dinh nghia, khong con chi 2 gia tri co dinh
  var shU = getSheet_(SH_USER, USER_HEADERS);
  if (shU.getLastRow() < 2) return;
  var v = shU.getRange(2, 1, shU.getLastRow() - 1, USER_HEADERS.length).getValues();
  var saleTypeCol = USER_HEADERS.indexOf('saleType'); // cot 'saleType' (index 8)
  if (saleTypeCol === -1) return;
  for (var i = 0; i < v.length; i++) {
    // Dung DUNG cach doc 'names' nhu readUsers_: JSON array o cot 'names' (index 6), fallback ve
    // 1 phan tu tu cot 'name' don (index 3) neu tai khoan cu chua co cot 'names'.
    var namesArr = []; try { namesArr = v[i][6] ? JSON.parse(v[i][6]) : []; } catch (e2) { namesArr = []; }
    if (!namesArr.length && v[i][3]) namesArr = [String(v[i][3])];
    var matchCh = null;
    for (var j = 0; j < namesArr.length; j++) {
      if (channels[namesArr[j]] !== undefined) { matchCh = channels[namesArr[j]]; break; }
    }
    if (matchCh && validKeys[matchCh] && String(v[i][saleTypeCol] || '') !== matchCh) {
      shU.getRange(i + 2, saleTypeCol + 1).setValue(matchCh);
    }
  }
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
    zaloSetBy:    parseSetBy(row[18]), // { cs, nick, at } - ai/nick nao vua ghi trang thai 'zalo' gan nhat
    name:         row[19]||'',
    // Gia tri cac "truong tu tao" admin them (xem CUSTOM_FIELDS ben index.html) — luu gop 1 cot
    // JSON de khong phai them cot moi moi lan admin tao them truong.
    custom:       (function(v){ try { var o = JSON.parse(v||'{}'); return (o && typeof o === 'object') ? o : {}; } catch(e) { return {}; } })(row[20]),
    // SDT khach dung de ket ban Zalo (mang chuoi, CS tu them) — xem chu thich tai CARE_HEADERS
    zaloPhones:   (function(v){ try { var a = JSON.parse(v||'[]'); return Array.isArray(a) ? a : []; } catch(e) { return []; } })(row[21])
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

// ── DELTA SYNC CareData (action=customers&since=<ISO>) ─────────────────────────────────────────────
// NGUYEN NHAN (da sua): moi nhip 3s moi may deu goi action=customers => readCare_ doc FULL CareData (hang chuc/tram nghin dong
// x 22 cot) roi JSON hoa; cache 'customers_v12' khong bao gio put duoc vi CacheService chi nhan <=100KB/gia tri. Nay chi doc
// cot 'updated' (1 cot), lay cac dong co updated > since roi doc dung cac dong do. Moi ham ghi CareData deu dong dau 'updated'
// (careRow_ / syncZaloFriendStatus_). Dong bi XOA (dedupeCare_) hoac sua tay tren Sheet khong co 'updated' se do lan keo FULL
// dinh ky cua client (5 phut) dong bo. Tra null neu qua nhieu dong/doan roi rac => caller tra FULL nhu cu.
function readCareDelta_(sh, since) {
  if (!sh || sh.getLastRow() < 2) return { delta: true, rows: [] };
  var last = sh.getLastRow();
  var upd = sh.getRange(2, 15, last - 1, 1).getValues();
  var idx = [];
  for (var i = 0; i < upd.length; i++) {
    var u = upd[i][0];
    var us = (u instanceof Date) ? u.toISOString() : String(u || '');
    if (us && us > since) idx.push(i + 2);
  }
  if (!idx.length) return { delta: true, rows: [] };
  var runs = [], a = idx[0], b = idx[0];
  for (var k = 1; k < idx.length; k++) {
    if (idx[k] === b + 1) { b = idx[k]; } else { runs.push([a, b]); a = idx[k]; b = idx[k]; }
  }
  runs.push([a, b]);
  if (runs.length > 25 || idx.length > 3000) return null;   // qua nhieu thay doi (may ngung lau) -> keo FULL
  var rows = [];
  for (var r = 0; r < runs.length; r++) {
    var vals = sh.getRange(runs[r][0], 1, runs[r][1] - runs[r][0] + 1, CARE_HEADERS.length).getValues();
    for (var v = 0; v < vals.length; v++) { if (vals[v][0]) rows.push(careObjFromRow_(vals[v])); }
  }
  return { delta: true, rows: rows };
}

// Lich hen CHAM SOC cua HOM NAY (khong lay qua han) tu CareData. Tach tu action 'reminders' (4c) de doc duoc Supabase hoac Sheets.
// Cung 1 ham chuyen doi (_remindersFromRows_) cho ca 2 nguon. Khac nhau duy nhat: thu tu ket qua tu Supabase = theo SDT (Sheets: theo thu tu dong).
function readRemindersToday_(csFilter) {
  var sbRows = sbReadRemindersRows_();   // undefined = doc Sheets nhu cu
  if (sbRows !== undefined) return _remindersFromRows_(sbRows, csFilter);
  var ss = getCrmSS_();
  var shR = ss.getSheetByName(SH_CARE);
  if (!shR || shR.getLastRow() < 2) return [];
  return _remindersFromRows_(shR.getDataRange().getValues().slice(1), csFilter);
}
// rows: mang dong CareData (cot 0 SDT, 1 status, 2 zalo, 3 cs, 12 schedHen, 13 schedHenNote) — KHONG gom dong tieu de.
function _remindersFromRows_(rows, csFilter) {
  var today = new Date(); today.setHours(0,0,0,0);
  var reminders = [], seenR = {};
  for (var ri = 0; ri < rows.length; ri++) {
    var rw = rows[ri];
    if (!rw[0]) continue;
    var rcs = String(rw[3]||'').trim();
    if (csFilter && rcs !== csFilter) continue;
    var rhen = rw[12];
    if (!rhen) continue;
    var rdate = new Date(rhen); rdate.setHours(0,0,0,0);
    // CHỈ hẹn TRONG NGÀY hôm nay (không lấy quá hạn) — extension chỉ nhắc lịch của ngày
    if (rdate.getTime() !== today.getTime()) continue;
    // Gộp trùng: mỗi SĐT chỉ 1 nhắc (tránh nhân bản do CareData có dòng trùng)
    var npR = normPhone_(String(rw[0]));
    if (seenR[npR]) continue;
    seenR[npR] = true;
    reminders.push({
      phone: String(rw[0]), schedHen: String(rhen),
      schedHenNote: String(rw[13]||''), cs: rcs,
      status: String(rw[1]||''), zalo: String(rw[2]||''), overdue: false
    });
  }
  return reminders;
}

function findCareByPhone_(phone) {
  var sbc = sbReadCare_(phone);   // che do 'read': doc Supabase; undefined = phai doc Sheets nhu cu (xem khoi SUPABASE cuoi file)
  if (sbc !== undefined) return sbc;
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CARE);
  if (!sh || sh.getLastRow() < 2) return null;
  var ph = normPhone_(phone);
  // TOI UU TOC DO (06/10/2026): truoc day doc TOAN BO sheet CareData (getDataRange, moi cot) moi
  // lan tra cuu 1 SDT. Gio chi doc 1 COT SDT de tim dong dau tien khop, roi doc dung 1 dong do.
  var last = sh.getLastRow();
  var phoneCol = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < phoneCol.length; i++) {
    if (!phoneCol[i][0]) continue;
    if (normPhone_(phoneCol[i][0]) === ph) {
      var width = Math.max(sh.getLastColumn(), 1);
      var rowVals = sh.getRange(i + 2, 1, 1, width).getValues()[0];
      return careObjFromRow_(rowVals);
    }
  }
  return null;
}

// careRow_: 21 cols. Neu truong khong co thi de trong.
function careRow_(r) {
  var nz = r.nickZalos;
  if (!Array.isArray(nz)) { try { nz = JSON.parse(nz||'[]'); } catch(e) { nz = []; } }
  var setBy = r.zaloSetBy;
  if (setBy && typeof setBy !== 'string') { try { setBy = JSON.stringify(setBy); } catch(e) { setBy = ''; } }
  var cust = r.custom;
  if (typeof cust === 'string') { try { cust = JSON.parse(cust||'{}'); } catch(e) { cust = {}; } }
  if (!cust || typeof cust !== 'object') cust = {};
  var zp = r.zaloPhones;
  if (!Array.isArray(zp)) { try { zp = JSON.parse(zp||'[]'); } catch(e) { zp = []; } }
  return [
    r.phone||'', r.status||'', r.zalo||'', r.cs||'', r.note||'', r.schedules||'',
    r.schedGoi||'', r.schedGoiNote||'', r.schedSP||'', r.schedSPNote||'',
    r.schedCS||'', r.schedCSNote||'', r.schedHen||'', r.schedHenNote||'',
    new Date().toISOString(),
    r.khStatus||'', JSON.stringify(nz), r.birthday||'', setBy||'', r.name||'',
    JSON.stringify(cust), JSON.stringify(zp)
  ];
}

// Doc du lieu existing de bao toan truong mo rong (khStatus, nickZalos, birthday, zaloSetBy, name)
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
      zaloSetBy: vals[i][18]||'',
      name:      vals[i][19]||'',
      zaloPhones: vals[i][21]||'[]'
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
  if (r.name      === undefined || r.name      === null || r.name      === '') r.name      = ex.name      || '';
  if (r.nickZalos === undefined || r.nickZalos === null ||
      (Array.isArray(r.nickZalos) && r.nickZalos.length === 0)) {
    try { r.nickZalos = JSON.parse(ex.nickZalos||'[]'); } catch(e) { r.nickZalos = []; }
  }
  // zaloPhones: CHỈ bảo tồn khi client không hề biết đến trường này (undefined/null — gửi
  // thiếu hẳn key, như mọi lời gọi saveSingle/saveBatch có TỪ TRƯỚC khi trường này ra đời).
  // KHÔNG áp dụng "mảng rỗng cũng bảo tồn" như nickZalos ở trên: CRM/Pancake là 2 nơi DUY NHẤT
  // quản lý trường này, và mảng rỗng [] do 2 nơi đó gửi lên nghĩa là Sale CHỦ ĐỘNG xoá hết SĐT
  // (vd bỏ nốt SĐT cuối cùng) — nếu coi rỗng là "chưa gửi" thì sẽ không bao giờ xoá về 0 được.
  if (r.zaloPhones === undefined || r.zaloPhones === null) {
    try { r.zaloPhones = JSON.parse(ex.zaloPhones||'[]'); } catch(e) { r.zaloPhones = []; }
  } else if (!Array.isArray(r.zaloPhones)) {
    try { r.zaloPhones = JSON.parse(r.zaloPhones||'[]'); } catch(e) { r.zaloPhones = []; }
  }
  return r;
}

// ─── ORDER READ ────────────────────────────────────────────────
// (readOrdersByPhone_/readAllOrders_ nay doc tu DT TONG — dinh nghia o gan DT_SS_ID ben duoi)
function _legacyReadOrdersUnused_(sh) {
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
    // channels: danh sach ten Kenh ban (kenhBan) ma team NAY chi tinh doanh thu trong do — de
    // trong (mang rong) = khong gioi han kenh, tinh het nhu truoc gio. Dung khi 1 so CS thuoc
    // team khac nhung chi chay tren 1 kenh nhat dinh, can tach doanh thu rieng theo kenh do.
    var channels = [];
    try { channels = v[i][5] ? JSON.parse(v[i][5]) : []; } catch(e2) { channels = (''+v[i][5]).split(',').map(function(s){return s.trim();}).filter(String); }
    // % hoa hong theo team cho don >=15tr / <15tr (xem COMMISSION_THRESHOLD) - admin cai o
    // "Quan ly Team". Sheet tao truoc khi co tinh nang nay chua co cot nay -> mac dinh {0,0}.
    var ratePct = { above15: 0, below15: 0 };
    try { var rp = v[i][6] ? JSON.parse(v[i][6]) : null; if (rp && typeof rp === 'object') ratePct = { above15: Number(rp.above15)||0, below15: Number(rp.below15)||0 }; } catch(e) {}
    out.push({ id: v[i][0], name: v[i][1]||'', leader: v[i][2]||'', members: members, color: v[i][4]||'', channels: channels, ratePct: ratePct });
  }
  return out;
}

function readUsers_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    // Tài khoản CS có thể gắn NHIỀU tên (vd 1 tài khoản dùng chung, hoặc gộp nhiều bí danh của
    // cùng 1 sale) — luu o cot 'names' (JSON array), moi rieng bien tuong thich nguoc: tai khoan
    // tao truoc khi co tinh nang nay chi co cot 'name' don (chuoi thuong), luc do fallback ve
    // mang 1 phan tu tu chinh cot do.
    var namesArr = [];
    try { namesArr = v[i][6] ? JSON.parse(v[i][6]) : []; } catch (e) { namesArr = []; }
    if (!namesArr.length && v[i][3]) namesArr = [String(v[i][3])];
    // perms: danh sach ID cac tab/menu tai khoan nay DUOC PHEP xem (Admin gan qua modal
    // "Tai khoan"). null/rong = KHONG gioi han (thay theo mac dinh phan quyen vai tro cu),
    // chi khi Admin CHU DONG gioi han moi thu hep lai — tranh tai khoan cu tu dung bi khoa
    // het menu khi nang cap len ban co tinh nang nay.
    var permsArr = null;
    try { var pRaw = v[i][7]; if (pRaw) { var pParsed = JSON.parse(pRaw); if (Array.isArray(pParsed)) permsArr = pParsed; } } catch (e) { permsArr = null; }
    out.push({
      username: String(v[i][0]), passHash: String(v[i][1]||''), role: v[i][2]||'cs',
      name: v[i][3]||'', team: v[i][4]||'',
      active: (v[i][5]===''||v[i][5]===undefined) ? true :
              (v[i][5]===true||v[i][5]==='TRUE'||v[i][5]==='true'||v[i][5]===1),
      names: namesArr,
      perms: permsArr,
      saleType: v[i][8] || '',   // 'online' | 'offline' | '' — dung de tinh Bao cao hoa hong dung chuong trinh thuong
      startDate: v[i][9] || ''   // YYYY-MM-DD — moc "ngay bat dau" de tinh cac muc thuong theo "ngay thu N" (sale thu viec)
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  KHOA BAO MAT + TAI KHOAN TEST (them 2026-10-08)
//  - getGasSource/setGasSource (lay/ghi ma nguon GAS): BAT BUOC co khoa quan tri = gia tri key "adminKey"
//    trong sheet Settings (them 1 dong: key=adminKey, value=chuoi bi mat). Chua dat khoa -> tu choi het.
//  - getSetting khong tra cac key nhay cam: api* (key AI), geminiKey, gasSource*, adminKey, demoToken.
//  - setSetting khong cho ghi adminKey/demoToken/gasSource* neu thieu adminKey.
//  - Tai khoan role "demo": dang nhap qua POST demoLogin -> nhan demoToken. Moi request co token chi duoc goi
//    cac action xem bao cao trong DEMO_ALLOWED_GET_, cac mang dong chi tiet bi cat con DEMO_MAX_ROWS_ dong,
//    moi thao tac ghi (POST) bi tu choi.
//  LUU Y: cac request KHONG co token van chay nhu cu (extension Zalo/Pancake, CS dang dung) — xem docs/TAI-KHOAN-TEST.md.
// ═══════════════════════════════════════════════════════════════
var DEMO_MAX_ROWS_ = 5;
var DEMO_ALLOWED_GET_ = {
  salesReportA: 1, salesReportB: 1, salesReportC: 1, careLeadReport: 1, saleKpiReport: 1, failedOrderReport: 1,
  salesReportOptions: 1, kpiReport: 1, mktChecklist: 1, pancakeReport: 1, pancakeSdtReport: 1,
  pancakePageMap: 1, pancakeNameMap: 1, saleDirectory: 1, saleGroups: 1, teams: 1, mktTeams: 1, getSetting: 1, count: 1,
  orders: 1, careLeads: 1, cskhDuyenLite: 1
};
// Mang dong CHI TIET (don/khach) bi cat con DEMO_MAX_ROWS_. "rows" chi cat o cac action tra danh sach khach/lead
// (o saleKpiReport "rows" la bang KPI tung sale — khong cat).
var DEMO_CLIP_KEYS_ = ['orders', 'ordersCur', 'ordersPrev', 'ordersDetail'];
var DEMO_CLIP_ROWS_ACTIONS_ = { careLeads: 1, careLeadReport: 1, cskhDuyenLite: 1 };
function _secEq_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function _adminKeyOk_(k) { return _secEq_(k, getSetting_('adminKey')); }
function _isSensitiveSettingKey_(key) {
  var k = String(key || '').trim();
  return /^api/i.test(k) || /^geminiKey$/i.test(k) || /^gasSource/i.test(k) || k === 'adminKey' || k === 'demoToken';
}
function _isSensitiveWriteKey_(key) {
  var k = String(key || '').trim();
  return k === 'adminKey' || k === 'demoToken' || /^gasSource/i.test(k);
}
function _demoToken_() {
  var t = getSetting_('demoToken');
  if (!t) {
    t = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    setSetting_('demoToken', t);
  }
  return t;
}
function _demoTokenOk_(tok) { return _secEq_(tok, getSetting_('demoToken')); }
// Cat mang dong chi tiet cho tai khoan test: toi da DEMO_MAX_ROWS_ dong CHO MOI NGUON (cot 'source' cua don, hoac 'kenhBan' o cac
// bao cao). NGUYEN NHAN GOC: truoc day slice(0,5) cat 5 dong DAU CHUNG -> toan bo 5 dong thuong cung 1 nguon (dong dau sheet),
// nguoi test khong thay duoc cac nguon con lai. Dong khong co nguon (mang dong dang mang [phone,name,tier], lead...) -> 5 dong dau.
function _demoSrcOf_(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  var v = it.source != null ? it.source : (it.kenhBan != null ? it.kenhBan : it.nguon);
  return v == null ? null : String(v).trim();
}
function _demoClipPerSource_(arr) {
  var hasSrc = false;
  for (var i = 0; i < arr.length && !hasSrc; i++) { if (_demoSrcOf_(arr[i]) !== null) hasSrc = true; }
  if (!hasSrc) return arr.slice(0, DEMO_MAX_ROWS_);
  var cnt = {}, out = [];
  for (var j = 0; j < arr.length; j++) {
    var sv = _demoSrcOf_(arr[j]); if (sv === null) sv = '';
    cnt[sv] = (cnt[sv] || 0) + 1;
    if (cnt[sv] <= DEMO_MAX_ROWS_) out.push(arr[j]);
  }
  return out;
}
// CHE SDT cho tai khoan test (v13.22). NGUYEN NHAN GOC: truoc day tai khoan test chi bi cat so dong, SDT khach van hien DAY DU
// (ca tren man hinh lan trong file tai ve CSV/XLSX vi client dung chinh du lieu API de xuat file) -> lo so dien thoai that cho nguoi ngoai.
// Nay che 4 SO CUOI ngay tai may chu (sau khi cat dong, truoc khi tra ve) nen moi noi hien/tai deu da bi che, khong the lay lai tu client.
// Che theo GIA TRI (9-12 chu so) chu khong theo ten key, vi key nhu sdtMangVe/soDonChot la SO DEM, khong phai SDT.
// Giu nguyen dang chu so (4 so cuoi -> 0000) de client van parse/loc duoc; so dang number van la number.
var DEMO_PHONE_KEY_RE_ = /phone|sdt|sodienthoai|dienthoai/i;
var DEMO_NOTE_KEY_RE_ = /note|ghichu|noidung|message|content/i;   // truong van ban tu do: che SDT nam trong cau chu
function _demoMaskPhone_(v) {
  var s = String(v), d = s.replace(/\D/g, '');
  if (d.length < 9 || d.length > 12) return v;
  var left = 4, a = s.split('');
  for (var i = a.length - 1; i >= 0 && left > 0; i--) { if (/\d/.test(a[i])) { a[i] = '0'; left--; } }
  var r = a.join('');
  return typeof v === 'number' ? Number(r) : r;
}
function _demoMaskText_(t) {
  return String(t).replace(/(^|[^\d])(0\d{9}|84\d{9})(?!\d)/g, function(m, pre, ph) { return pre + _demoMaskPhone_(ph); });
}
var DEMO_PHONE_STR_RE_ = /^\+?\d[\d .\-]{7,14}\d$/;
function _demoMaskDeep_(node) {
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var it = node[i];
      if (it && typeof it === 'object') _demoMaskDeep_(it);
      else if (typeof it === 'string' && DEMO_PHONE_STR_RE_.test(it.trim())) node[i] = _demoMaskPhone_(it);   // dong dang mang [sdt, ten]
    }
    return node;
  }
  if (!node || typeof node !== 'object') return node;
  Object.keys(node).forEach(function(k) {
    var v = node[k];
    if (v && typeof v === 'object') { _demoMaskDeep_(v); return; }
    if (typeof v !== 'string' && typeof v !== 'number') return;
    if (DEMO_PHONE_KEY_RE_.test(k)) node[k] = _demoMaskPhone_(v);
    else if (typeof v === 'string' && DEMO_NOTE_KEY_RE_.test(k)) node[k] = _demoMaskText_(v);
  });
  return node;
}
function _demoClip_(out, action) {
  var o;
  try { o = JSON.parse(out.getContent()); } catch (e) { return out; }
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    var keys = DEMO_CLIP_KEYS_.slice();
    if (DEMO_CLIP_ROWS_ACTIONS_[action]) keys.push('rows');
    keys.forEach(function(k) {
      if (Array.isArray(o[k]) && o[k].length > DEMO_MAX_ROWS_) {
        o['_demoTotal_' + k] = o[k].length;
        o[k] = _demoClipPerSource_(o[k]);
      }
    });
    o._demo = true;
  }
  _demoMaskDeep_(o);
  return jsonOut_(o);
}
// Dang nhap tai khoan test: kiem tra user role "demo" trong sheet Users (passHash do client gui len).
function demoLogin_(data) {
  var uname = String((data && data.username) || '').trim().toLowerCase();
  var ph = String((data && data.passHash) || '');
  if (!uname || !ph) return jsonOut_({ ok: false, error: 'Thieu tai khoan/mat khau' });
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (String(u.username).trim().toLowerCase() !== uname) continue;
    if (u.role !== 'demo' || u.active === false) break;
    if (_secEq_(u.passHash, ph)) return jsonOut_({ ok: true, token: _demoToken_(), name: u.name || u.username });
    break;
  }
  return jsonOut_({ ok: false, error: 'Sai tai khoan hoac mat khau' });
}


// ─── SETTINGS (1 signature duy nhat) ──────────────────────────
// TOI UU (2026-10-10, Duyen bao luu cau hinh chia data cham): NGUYEN NHAN GOC — ban cu getDataRange().getValues() doc CA sheet Settings
// (gom cac manh ma GAS gasSourceChunk_* moi o toi 45.000 ky tu, tong ~330KB) cho MOI lan getSetting_ — ma ham nay duoc goi o moi
// getSetting/adminKey/demoToken/autoAssign... Nay chi doc COT A (ten key) roi doc dung 1 o gia tri cua key can lay.
// Khop key giu nguyen: .trim() o CA 2 ve (copy-paste API key hay dinh khoang trang/xuong dong; thieu trim se bao "Invalid API Key"), lay dong DAU khop.
function getSetting_(key) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_SET);
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      var v = sh.getRange(i + 2, 2).getValue();
      if (v === '' || v === null || v === undefined) return null;
      return String(v).trim() || null;
    }
  }
  return null;
}
// Lay NHIEU key trong 1 lan goi (doc cot A 1 lan) — dung cho FE can nhieu key cung luc (vd cau hinh + trang thai chia tu dong). Bo key nhay cam.
function getSettingsMulti_(keyList) {
  var out = {}, want = {}, any = false;
  (keyList || []).forEach(function (k) { k = String(k || '').trim(); if (k && !_isSensitiveSettingKey_(k)) { want[k] = true; any = true; out[k] = null; } });
  if (!any) return out;
  var sh = getCrmSS_().getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return out;
  var last = sh.getLastRow(), keys = sh.getRange(2, 1, last - 1, 1).getValues(), seen = {};
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0]).trim();
    if (want[k] && !seen[k]) {
      seen[k] = true;
      var v = sh.getRange(i + 2, 2).getValue();
      out[k] = (v === '' || v === null || v === undefined) ? null : (String(v).trim() || null);
    }
  }
  return out;
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
// ─── CHOT THANG POS + TRU HOAN/HUY THANG TRUOC (quy tac 5 cua Duyen, 10/2026) ───
// Doanh thu Pos thang M = doanh thu trong thang M − phan hoan/huy cua thang M-1. CHI tien hanh khi Duyen bam
// "Chot thang" (vao ngay mung 1 sau khi cap nhat du du lieu thang truoc) — chua chot thi KHONG tru gi ca,
// cac bao cao giu nguyen. Cach lam: luc chot, luu "anh chup" doanh thu Pos tung sale cua thang M-1 (da loai
// hoan/huy hien co + chia ghep/30-70 dung quy tac). Don thang M-1 bi hoan/huy SAU luc chot lam doanh thu
// tinh lai nho di; khoan chenh (anh chup − tinh lai hien tai) chinh la so tru vao thang M, chia ve dung sale
// vi dung chung cach tinh/chia cua Bao cao B (khong can ngay thay doi trang thai). Luu o setting 'posMonthSnapshots'.
function _ymAdd_(ym, delta) {
  var p = String(ym).split('-'), y = +p[0], m = +p[1] - 1 + delta;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + '-' + ('0' + (m + 1)).slice(-2);
}
function _posRevenueBySale_(ym) {
  var a = buildSalesReportB_({ dateFrom: _ymFirstDay_(ym), dateTo: _ymLastDay_(ym) });
  var out = {};
  (a.bySale || []).forEach(function(s) { out[s.name] = Number(s.giaTri) || 0; });
  return { bySale: out, total: Number(a.totalGiaTri) || 0 };
}
function _readPosSnapshots_() {
  try { var raw = getSetting_('posMonthSnapshots'); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') return o; } } catch (e) {}
  return {};
}
function closePosMonth_(month, force) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return { ok: false, error: 'Tháng không hợp lệ (cần dạng YYYY-MM)' };
  if (month >= _todayYm_()) return { ok: false, error: 'Chỉ chốt được tháng đã qua (tháng ' + month + ' chưa kết thúc). Chốt vào ngày mùng 1 sau khi đã cập nhật đủ dữ liệu tháng đó.' };
  var snaps = _readPosSnapshots_();
  if (snaps[month] && !force) return { ok: false, needForce: true, closedAt: snaps[month].closedAt, error: 'Tháng ' + month + ' đã chốt lúc ' + snaps[month].closedAt + '. Chốt lại sẽ GHI ĐÈ mốc cũ (và làm đổi số trừ hoàn/hủy).' };
  var cur = _posRevenueBySale_(month);
  snaps[month] = { closedAt: _vnYmd_(new Date()), total: cur.total, bySale: cur.bySale };
  setSetting_('posMonthSnapshots', JSON.stringify(snaps));
  return { ok: true, month: month, closedAt: snaps[month].closedAt, total: cur.total, saleCount: Object.keys(cur.bySale).length };
}
function posMonthAdjust_(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) month = _todayYm_();
  var prev = _ymAdd_(month, -1);
  var snaps = _readPosSnapshots_();
  var cur = _posRevenueBySale_(month);
  var closedMonths = Object.keys(snaps).sort();
  var snap = snaps[prev];
  if (!snap) {
    return { ok: true, month: month, prevMonth: prev, applied: false, closedMonths: closedMonths, total: cur.total,
      reason: 'Chưa chốt tháng ' + prev + ' nên chưa trừ hoàn/hủy tháng trước (bấm "Chốt tháng" cho ' + prev + ' vào ngày mùng 1, sau khi cập nhật đủ dữ liệu).',
      rows: Object.keys(cur.bySale).map(function(n) { return { name: n, revenue: cur.bySale[n], deduction: 0, net: cur.bySale[n] }; }).sort(function(a, b) { return b.net - a.net; }) };
  }
  var now = _posRevenueBySale_(prev); // doanh thu thang truoc tinh lai theo du lieu HIEN TAI (da loai don hoan/huy phat sinh sau luc chot)
  var names = {}; Object.keys(cur.bySale).forEach(function(n) { names[n] = 1; }); Object.keys(snap.bySale || {}).forEach(function(n) { names[n] = 1; });
  var rows = Object.keys(names).map(function(n) {
    var deduction = (Number(snap.bySale[n]) || 0) - (Number(now.bySale[n]) || 0);
    var revenue = Number(cur.bySale[n]) || 0;
    return { name: n, revenue: revenue, deduction: deduction, net: revenue - deduction };
  }).filter(function(r) { return r.revenue || r.deduction; }).sort(function(a, b) { return b.net - a.net; });
  var totalDed = rows.reduce(function(s, r) { return s + r.deduction; }, 0);
  return { ok: true, month: month, prevMonth: prev, applied: true, closedAt: snap.closedAt, closedMonths: closedMonths,
    total: cur.total, totalDeduction: totalDed, totalNet: cur.total - totalDed, rows: rows };
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

// ═══════════════════════════════════════════════════════════════
//  NHAT KY THAY DOI CAU HINH (0e, 2026-10-12): moi lan doi cai dat, tai khoan, team... ghi 1 dong vao AuditLog
//  (action 'config:<ten>', user = nguoi doi theo token phien, oldValue/newValue = truoc/sau). Nguyen nhan goc can lam: truoc day AuditLog
//  chi ghi thao tac tren KHACH tu client, con cau hinh (hang, trang thai, nhom sale, tai khoan, team...) doi xong khong ai biet ai doi/doi gi.
//  Khoa nhay cam (API key, adminKey) chi ghi "da doi", KHONG ghi gia tri. Khoa may tu cap nhat (gasSource*, ttLastTrackedMs, autoAssignState...)
//  khong ghi de khong day nhat ky. Loi ghi nhat ky bi nuot — khong bao gio lam hong thao tac luu that.
// ═══════════════════════════════════════════════════════════════
var _AUDIT_TOKEN_ = '';
var AUDIT_SKIP_SETTING_ = /^(gasSource|ttLastTrackedMs$|demoToken$|chotOrders_|assignReportManual_|autoAssignState$)/;
function _auditClip_(v) { v = String(v == null ? '' : v); return v.length > 1500 ? v.slice(0, 1500) + '…(+' + (v.length - 1500) + ' ký tự)' : v; }
function _auditActor_() {
  try { var p = _sessVerify_(_AUDIT_TOKEN_); if (p && p.u) return String(p.u); } catch (e) {}
  return _AUDIT_TOKEN_ ? '(token hết hạn)' : '(không token)';
}
// rows: [[what, oldValue, newValue], ...]
function _auditCfg_(rows) {
  try {
    if (!rows || !rows.length) return;
    var who = _auditActor_(), now = new Date().toISOString();
    var m = rows.slice(0, 40).map(function (r) { return [now, who, 'config:' + r[0], '', _auditClip_(r[1]), _auditClip_(r[2])]; });
    var sh = getSheet_(SH_AUDIT, AUDIT_HEADERS);
    sh.getRange(sh.getLastRow() + 1, 1, m.length, AUDIT_HEADERS.length).setValues(m);
  } catch (e) {}
}
// oldMap/newMap: {khoa: chuoi_dac_trung}. Moi muc them / xoa / doi thanh 1 dong.
function _auditDiffRows_(what, oldMap, newMap) {
  var out = [];
  Object.keys(newMap).forEach(function (k) {
    if (!(k in oldMap)) out.push([what, '', k + ': ' + newMap[k]]);
    else if (oldMap[k] !== newMap[k]) out.push([what, k + ': ' + oldMap[k], k + ': ' + newMap[k]]);
  });
  Object.keys(oldMap).forEach(function (k) { if (!(k in newMap)) out.push([what, k + ': ' + oldMap[k], '(đã xóa)']); });
  return out;
}
function _auditUserSig_(u) {
  return 'vai trò ' + (u.role || 'cs') + ', ' + (u.active === false ? 'KHÓA' : 'hoạt động') + ', team ' + (u.team || '-') +
    ', tên [' + ((u.names && u.names.length) ? u.names : (u.name ? [u.name] : [])).join('/') + ']' +
    ', quyền tab ' + (Array.isArray(u.perms) ? '[' + u.perms.join(',') + ']' : 'không giới hạn') +
    (u.saleType ? ', loại ' + u.saleType : '');
}
function setSetting_(key, value) {
  var sh = getSheet_(SH_SET, SET_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last-1, 1).createTextFinder(String(key)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  var _oldSet = rowIdx > 0 ? sh.getRange(rowIdx, 2).getValue() : '';
  if (rowIdx > 0) sh.getRange(rowIdx, 2).setValue(value);
  else sh.appendRow([key, value]);
  if (!AUDIT_SKIP_SETTING_.test(String(key)) && String(_oldSet) !== String(value == null ? '' : value)) {
    if (_isSensitiveSettingKey_(key)) _auditCfg_([['setting:' + key, '', '(đã đổi — ẩn giá trị)']]);
    else _auditCfg_([['setting:' + key, _oldSet, value]]);
  }
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
    // Nhan phan loai (tu dat) — luu o custom.tag (khong them cot moi), lop ra thanh truong 'tag' de CRM (js/01) doc nhu cu.
    tag:          (function(v){ try { var o = JSON.parse(v||'{}'); return (o && typeof o === 'object' && o.tag) ? String(o.tag) : ''; } catch(e) { return ''; } })(row[20]),
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
// rows: mang dong CareData (cot 0 SDT, 1 status, 2 zalo, 3 cs, 5 schedules(JSON), 12 schedHen, 13 schedHenNote) — KHONG gom dong tieu de.
// Duong Supabase (sbReadRemindersRows_) cung kem cot schedules (query ilike theo ngay hom nay) nen lich nhac nhanh van vao nhac khi SB_MODE=read.
function _remindersFromRows_(rows, csFilter) {
  var today = new Date(); today.setHours(0,0,0,0);
  // Ngay hom nay dang YYYY-MM-DD (gio dia phuong) de loc nhanh cot schedules truoc khi JSON.parse (ham nay chay moi ~5 phut/may).
  var todayYmd = today.getFullYear() + '-' + ('0' + (today.getMonth()+1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
  var reminders = [], byPhone = {};
  for (var ri = 0; ri < rows.length; ri++) {
    var rw = rows[ri];
    if (!rw[0]) continue;
    var rcs = String(rw[3]||'').trim();
    if (csFilter && rcs !== csFilter) continue;
    var npR = normPhone_(String(rw[0]));
    // (1) Hen chinh (cot schedHen) — CHI hen TRONG NGAY hom nay (khong lay qua han), nhu cu.
    var rhen = rw[12];
    var hasHen = false;
    if (rhen) {
      var rdate = new Date(rhen); rdate.setHours(0,0,0,0);
      hasHen = (rdate.getTime() === today.getTime());
    }
    // (2) Lich nhac nhanh (cot schedules, JSON: CRM/Pancake AI them) co ngay = hom nay, chua xong, khong phai sinh nhat tu dong.
    var schedNotes = [];
    var rsch = rw[5];
    if (rsch && typeof rsch === 'string' && rsch.indexOf(todayYmd) !== -1) {
      try {
        var sa = JSON.parse(rsch);
        if (Array.isArray(sa)) sa.forEach(function(x) {
          if (!x || x.done || x.type === 'birthday' || !x.date) return;
          if (String(x.date).slice(0, 10) !== todayYmd) return;
          schedNotes.push(String(x.note || x.customLabel || ''));
        });
      } catch (eS) {}
    }
    if (!hasHen && !schedNotes.length) continue;
    // Gop trung: moi SDT chi 1 nhac (tranh nhan ban do CareData co dong trung) — dong trung chi duoc BO SUNG ghi chu, khong tao nhac moi.
    var note = (hasHen ? String(rw[13]||'') : '');
    var cur = byPhone[npR];
    if (cur) {
      schedNotes.forEach(function(n) { if (n && cur.schedHenNote.indexOf(n) === -1) cur.schedHenNote += (cur.schedHenNote ? ' · ' : '') + n; });
      continue;
    }
    var allNotes = [note].concat(schedNotes).filter(function(n, i, a) { return n && a.indexOf(n) === i; }).join(' · ');
    cur = {
      phone: String(rw[0]), schedHen: hasHen ? String(rhen) : todayYmd,
      schedHenNote: allNotes, cs: rcs,
      status: String(rw[1]||''), zalo: String(rw[2]||''), overdue: false
    };
    byPhone[npR] = cur;
    reminders.push(cur);
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
  // Nhan phan loai (tu dat): client gui 'tag' rieng (CRM) HOAC nam san trong custom.tag (Pancake/Zalo copy nguyen custom).
  // r.tag === undefined -> giu nguyen custom.tag client gui; r.tag la chuoi (ke ca rong) -> la gia tri moi (rong = xoa nhan).
  if (r.tag !== undefined && r.tag !== null) {
    var tg = String(r.tag).trim();
    if (tg) cust.tag = tg; else delete cust.tag;
  }
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
    // NGUYEN NHAN GOC (nguon CSKH-Duyen): cskhDuyenLite tra kem total/noPhone (so that ~134k) va noPhoneSample (toi da 20 TEN khach that,
    // khong che) — cat 5 dong 'rows' nhung cac truong nay van lo du lieu that cho tai khoan test. Nay chi con dung 5 dong da cat.
    if (action === 'cskhDuyenLite' || action === 'cskhDuyen') {
      var _nCk = Array.isArray(o.rows) ? o.rows.length : 0;
      delete o._demoTotal_rows;
      o.total = _nCk; o.noPhone = 0; o.noPhoneSample = [];
    }
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

// ═══════════════════════════════════════════════════════════════
//  PHIEN DANG NHAP MAY CHU (them 2026-10-11) — buoc 1+2 cua ke hoach bao mat
//  Truoc day: trinh duyet tai ca danh sach tai khoan KEM passHash (action=users khong can xac thuc) roi tu so hash,
//  va saveUsers ai goi cung duoc -> ai biet URL GAS cung doc duoc hash / tu tao admin.
//  Nay: (1) POST webLogin kiem tra mat khau O SERVER, tra token ky HMAC (het han SESS_TTL_MS_); (2) action=users KHONG BAO GIO tra passHash,
//  chi tra danh sach rut gon neu khong co token hop le (extension Zalo/Pancake chi can username/name/active); (3) saveUsers bat buoc token admin
//  (tru khi sheet Users dang trong = tao admin dau tien). Mat khau moi gui dang van ban qua HTTPS trong truong setPassword, server tu bam.
//  Bi mat ky token nam trong Script Properties (sessSecret), KHONG nam trong sheet Settings (CRM doc duoc).
// ═══════════════════════════════════════════════════════════════
var SESS_TTL_MS_ = 7 * 24 * 3600 * 1000;
function _sessSecret_() {
  var props = PropertiesService.getScriptProperties();
  var sec = props.getProperty('sessSecret');
  if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(); props.setProperty('sessSecret', sec); }
  return sec;
}
function _sessSign_(b64) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(b64, _sessSecret_()));
}
function _sessIssue_(acct) {
  var payload = { u: String(acct.username || ''), e: Date.now() + SESS_TTL_MS_ };
  var b64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return b64 + '.' + _sessSign_(b64);
}
function _sessVerify_(tok) {
  tok = String(tok || '');
  var i = tok.indexOf('.');
  if (i < 1) return null;
  var b64 = tok.slice(0, i), sig = tok.slice(i + 1);
  if (!_secEq_(sig, _sessSign_(b64))) return null;
  var p = null;
  try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b64)).getDataAsString()); } catch (e) { return null; }
  if (!p || !p.u || !p.e || p.e < Date.now()) return null;
  return p;
}
// Tra tai khoan THAT trong sheet Users (vai tro/active doc truc tiep, khong tin payload) hoac null neu token sai/het han/tai khoan bi khoa.
function _sessUser_(tok) {
  var p = _sessVerify_(tok);
  if (!p) return null;
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  var un = String(p.u).trim().toLowerCase();
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username || '').trim().toLowerCase() === un) return users[i].active === false ? null : users[i];
  }
  return null;
}
// Chi tra cac truong an toan. full=true (co token hop le) them perms/saleType/startDate. KHONG BAO GIO co passHash.
function _usersForClient_(users, full) {
  return (users || []).map(function(u) {
    var o = { username: u.username, name: u.name, names: u.names, team: u.team, role: u.role, active: u.active };
    if (full) { o.perms = u.perms; o.saleType = u.saleType; o.startDate = u.startDate; o.hasPass = !!u.passHash; }
    return o;
  });
}
// ═══════════════════════════════════════════════════════════════
//  PHAN QUYEN THEO VAI TRO + BO PHAN (0b/0c, 2026-10-13) — admin cai o trang "Phan quyen" (js/40-fn-rolesettings.js).
//  Nguyen nhan goc can lam: truoc day chi co 4 vai tro cung (admin/manager/leader/cs) + "perms" tung tai khoan; khong co CEO / truong phong,
//  khong co cach noi "bo phan nao duoc xem hang muc nao", va moi kiem tra quyen nam o client (de bi qua mat).
//  Mo hinh: moi VAI TRO co "base" = cach cat pham vi DU LIEU da co san (admin: tat ca + quan tri | viewer: xem toan cong ty, khong quan tri |
//  manager: theo phong phu trach | leader: theo team | cs: chi du lieu cua minh) — nen code cu (so sanh role === 'leader'...) KHONG phai sua, chi doi
//  role -> base qua _roleBase_. Quyen XEM HANG MUC (feature id: id tab nhu 'salesreport', hoac 'act:<ten>' cho tac vu) khai theo vai tro va theo bo phan:
//  perms = null (hoac thieu) = KHONG gioi han (mac dinh, nen chua cai gi thi moi thu nhu cu); perms = [..] = chi cac muc do.
//  Quyen cuoi cung = (quyen rieng cua tai khoan neu admin da gioi han tab) HOAC (quyen vai tro VA quyen bo phan).
//  Luu o Settings 'roleConfig' (JSON) — ghi qua action saveRoleConfig (chi admin; setSetting_ tu ghi AuditLog).
// ═══════════════════════════════════════════════════════════════
var ROLE_BUILTIN_ = [
  { key: 'admin',   label: 'Admin',           base: 'admin',   locked: true, desc: 'Toàn quyền hệ thống: tài khoản, cài đặt, mọi dữ liệu.' },
  { key: 'ceo',     label: 'CEO / Giám đốc',  base: 'viewer',  desc: 'Xem toàn bộ dữ liệu công ty, không có quyền quản trị tài khoản.' },
  { key: 'tp',      label: 'Trưởng phòng',    base: 'manager', desc: 'Xem dữ liệu của các phòng được giao phụ trách.' },
  { key: 'manager', label: 'Quản lý',         base: 'manager', desc: 'Xem dữ liệu của các phòng/sale được giao phụ trách.' },
  { key: 'leader',  label: 'Trưởng team',     base: 'leader',  desc: 'Xem dữ liệu của cả team mình làm trưởng.' },
  { key: 'cs',      label: 'Nhân viên',       base: 'cs',      desc: 'Chỉ thấy dữ liệu của chính mình.' },
  { key: 'demo',    label: 'Tài khoản test',  base: 'cs',      locked: true, hidden: true, desc: 'Chỉ xem báo cáo mẫu.' }
];
var ROLE_BASES_ = { admin: 1, viewer: 1, manager: 1, leader: 1, cs: 1 };
function _roleStrList_(a, max) {
  if (!Array.isArray(a)) return null;
  var seen = {}, out = [];
  a.forEach(function (x) { x = String(x || '').trim().slice(0, 60); if (x && !seen[x] && out.length < (max || 200)) { seen[x] = 1; out.push(x); } });
  return out;
}
// Chuan hoa cau hinh tu client/Settings: sai kieu -> bo, khong bao gio nem loi. Admin luon perms=null (khong tu khoa minh).
function _roleCfgNormalize_(raw) {
  var cfg = { v: 1, roles: [], deptPerms: {} };
  if (!raw || typeof raw !== 'object') return cfg;
  var builtinKeys = {}; ROLE_BUILTIN_.forEach(function (r) { builtinKeys[r.key] = r; });
  var seen = {};
  (Array.isArray(raw.roles) ? raw.roles : []).slice(0, 40).forEach(function (r) {
    if (!r) return;
    var key = String(r.key || '').trim().toLowerCase();
    if (!/^[a-z0-9_]{2,24}$/.test(key) || seen[key]) return;
    seen[key] = 1;
    var b = builtinKeys[key];
    var o = { key: key, label: String(r.label || (b && b.label) || key).trim().slice(0, 40) || key,
              desc: String(r.desc == null ? '' : r.desc).trim().slice(0, 200), perms: _roleStrList_(r.perms) };
    if (b) { o.base = b.base; o.builtin = true; if (b.locked) { o.label = b.label; o.perms = null; } }
    else { o.base = ROLE_BASES_[r.base] && r.base !== 'admin' ? r.base : 'cs'; }
    if (key === 'admin') o.perms = null;
    cfg.roles.push(o);
  });
  var dp = raw.deptPerms && typeof raw.deptPerms === 'object' ? raw.deptPerms : {};
  Object.keys(dp).slice(0, 80).forEach(function (k) {
    var kk = String(k).trim().slice(0, 40); if (!kk) return;
    var l = _roleStrList_(dp[k]);
    if (l) cfg.deptPerms[kk] = l;
  });
  return cfg;
}
function readRoleConfig_() {
  var raw = null;
  try { raw = JSON.parse(getSetting_('roleConfig') || 'null'); } catch (e) { raw = null; }
  return _roleCfgNormalize_(raw);
}
// Vai tro da gop (built-in + tuy chinh). key la -> coi nhu nhan vien (base cs), khong gioi han.
function _roleResolve_(key, cfg) {
  key = String(key || 'cs').trim().toLowerCase();
  cfg = cfg || readRoleConfig_();
  var ov = null; cfg.roles.forEach(function (r) { if (r.key === key) ov = r; });
  var b = null; ROLE_BUILTIN_.forEach(function (r) { if (r.key === key) b = r; });
  if (ov) return { key: key, label: ov.label, base: b ? b.base : ov.base, desc: ov.desc, perms: ov.perms, builtin: !!b };
  if (b) return { key: key, label: b.label, base: b.base, desc: b.desc, perms: null, builtin: true };
  return { key: key, label: key, base: 'cs', desc: '', perms: null, builtin: false };
}
function _roleBase_(key) { return _roleResolve_(key).base; }
// Phong cua 1 tai khoan: manager/truong phong -> cot team (key phong, cach nhau dau phay); nguoi khac -> saleDepts theo ten.
function _userDeptKeys_(u) {
  var out = {}, base = _roleBase_(u.role);
  if (base === 'manager') String(u.team || '').split(',').forEach(function (k) { k = String(k).trim(); if (k) out[k] = 1; });
  var sd = readSaleDepts_();
  var names = (u.names && u.names.length) ? u.names : (u.name ? [u.name] : []);
  names.forEach(function (n) { var h = sd.byNorm[_normTxt_(n)]; if (h && h.key) out[h.key] = 1; });
  return Object.keys(out);
}
// user = ban ghi tu readUsers_. fid = id hang muc. Mac dinh cho phep (perms null).
function _featureAllowed_(user, fid, cfg, skipUserPerms) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  cfg = cfg || readRoleConfig_();
  if (!skipUserPerms && String(fid).indexOf('act:') !== 0 && Array.isArray(user.perms) && user.perms.length) return user.perms.indexOf(fid) !== -1;   // gioi han tab rieng cua tai khoan (co san tu truoc)
  var r = _roleResolve_(user.role, cfg);
  if (Array.isArray(r.perms) && r.perms.indexOf(fid) === -1) return false;
  if (!Object.keys(cfg.deptPerms || {}).length) return true;
  var dk = _userDeptKeys_(user);
  if (!dk.length) return true;
  var ok = false;
  dk.forEach(function (k) { var p = cfg.deptPerms[k]; if (!Array.isArray(p) || p.indexOf(fid) !== -1) ok = true; });
  return ok;
}
// Chan o backend: action bao cao -> hang muc. Chi chan khi co token hop le va admin da gioi han.
var ACTION_FEATURE_ = { salesReportA:'salesreport', salesReportB:'salesreport', salesReportC:'salesreport', saleKpiReport:'salesreport', failedOrderReport:'salesreport', careLeadReport:'salesreport', kpiReport:'kpipancake', pancakeReport:'pancake', pancakeSdtReport:'pancake', mktChecklist:'mktchecklist', orgOverview:'overview', teamAnalysis:'overview', audit:'audit' };
function _featureGate_(action, token) {
  var f = ACTION_FEATURE_[action];
  if (!f || !token) return null;
  try {
    var u = _sessUser_(token);
    if (u && !_featureAllowed_(u, f, null, true)) return { error: 'Ban khong co quyen xem muc nay (Admin chua cap cho vai tro/bo phan cua ban).', code: 'FORBIDDEN', feature: f };
  } catch (e) {}
  return null;
}
// Goi cho client: cau hinh day du cho admin; nguoi khac chi nhan phan cua minh (khong lo quyen cua nguoi khac).
function roleConfigForClient_(user) {
  var cfg = readRoleConfig_(), r = _roleResolve_(user.role, cfg), dk = _userDeptKeys_(user), dp = {};
  dk.forEach(function (k) { dp[k] = Array.isArray(cfg.deptPerms[k]) ? cfg.deptPerms[k] : null; });
  var out = { ok: true, builtin: ROLE_BUILTIN_, access: { role: user.role, base: r.base, label: r.label, rolePerms: r.perms, deptKeys: dk, deptPerms: dp } };
  if (user.role === 'admin') out.config = cfg;
  return out;
}
function saveRoleConfig_(cfg, tok) {
  var su = _sessUser_(tok);
  if (!su || su.role !== 'admin') return jsonOut_({ error: 'Chi admin moi duoc sua phan quyen.', code: 'AUTH' });
  var n = _roleCfgNormalize_(cfg);
  var r = setSetting_('roleConfig', JSON.stringify(n));
  return jsonOut_({ ok: true, config: n });
}

function _usersWriteAuth_(tok) {
  var existing = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  if (!existing.length) return { ok: true, bootstrap: true };   // chua co tai khoan nao: cho tao admin dau tien
  var su = _sessUser_(tok);
  if (!su) return { ok: false, error: 'Phien dang nhap het han hoac chua dang nhap — dang nhap lai roi thu lai.' };
  if (su.role !== 'admin') return { ok: false, error: 'Chi admin moi duoc sua tai khoan.' };
  return { ok: true };
}
function _upgradePwHash_(username, newHash) {
  try {
    var sh = getCrmSS_().getSheetByName(SH_USER);
    if (!sh || sh.getLastRow() < 2) return;
    var col = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    var un = String(username || '').trim().toLowerCase();
    for (var i = 0; i < col.length; i++) {
      if (String(col[i][0]).trim().toLowerCase() === un) { sh.getRange(i + 2, 2).setValue(newHash); return; }
    }
  } catch (e) {}
}
// Dung chung cho verifyLogin_ (extension) va webLogin_ (web). Tra {acct} hoac {error}.
function _checkLogin_(username, password) {
  var uname = String(username || '').trim().toLowerCase();
  if (!uname || !password) return { error: 'Nhập đủ tài khoản và mật khẩu.' };
  var cache = CacheService.getScriptCache();
  var failKey = 'vlfail_' + uname.replace(/[^a-z0-9]/g, '_').slice(0, 80);
  var fails = parseInt(cache.get(failKey) || '0', 10) || 0;
  if (fails >= 5) return { error: 'Sai quá nhiều lần — thử lại sau 10 phút.' };
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  var acct = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username || '').trim().toLowerCase() === uname) { acct = users[i]; break; }
  }
  var okPw = false, usedOld = false;
  if (acct && acct.passHash) {
    okPw = _secEq_(_pwHash_(password, _PW_SALT_), acct.passHash);
    if (!okPw && _secEq_(_pwHash_(password, _PW_SALT_OLD_), acct.passHash)) { okPw = true; usedOld = true; }
  }
  if (!acct || !okPw) {
    cache.put(failKey, String(fails + 1), 600);
    return { error: 'Sai tài khoản hoặc mật khẩu.' };
  }
  if (acct.active === false) return { error: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' };
  cache.remove(failKey);
  if (usedOld) _upgradePwHash_(acct.username, _pwHash_(password, _PW_SALT_));   // nang salt cu -> moi (truoc day client tu lam)
  return { acct: acct };
}
function webLogin_(d) {
  var r = _checkLogin_(d && d.username, d && d.password);
  if (r.error) return jsonOut_({ ok: false, error: r.error });
  var out = { ok: true, token: _sessIssue_(r.acct), expiresInMs: SESS_TTL_MS_, user: _usersForClient_([r.acct], true)[0] };
  if (r.acct.role === 'demo') out.demoToken = _demoToken_();   // tai khoan test: client van can demoToken nhu cu
  return jsonOut_(out);
}

// ═══════════════════════════════════════════════════════════════
//  BUOC 3 KE HOACH BAO MAT (them 2026-10-11): GHI LOG request du lieu khong co token hop le — CHUA CHAN gi.
//  Nguyen nhan goc can lam: truoc khi bat buoc token (buoc 4) phai biet nguoi goi nao (web, extension Zalo, extension Pancake,
//  Worker...) con goi tran; bat buoc ngay se lam hong extension. Dem theo ngay + action + nguon (tham so `src`, mac dinh '?')
//  + co/khong token. Luu o CacheService (TTL toi da 6 gio, cap nhat moi lan ghi) nen KHONG cham duong luu cua CS (khong khoa, khong ghi sheet);
//  dem gan dung khi nhieu request cung luc. Xem: GET action=ntlReport&adminKey=... hoac chay ham xemLogKhongToken trong Editor.
// ═══════════════════════════════════════════════════════════════
var NTL_ACTIONS_ = {
  customers:1, lookup:1, donOrdersByPhone:1, cskhDetail:1, reminders:1, tasks:1, taskComments:1,
  save:1, saveSingle:1, saveBatch:1, syncZaloFriendStatus:1, addCareLead:1, applyCustomerNameGuesses:1, dedupeCare:1,
  saveOrders:1, patchOrder:1, deleteOrder:1, deleteDuplicateOrders:1, replaceOrders:1, importSheetRows:1, archiveOrders:1,
  setOrderCareCS:1, setOrderCareCSBatch:1, saveAssign:1, saveAssignHistory:1, toggleAssignDone:1,
  saveTask:1, deleteTask:1, saveTaskComment:1, taskFlows:1, taskRequests:1, saveTaskFlow:1, deleteTaskFlow:1, taskAdvance:1, taskRequestDecide:1, taskReassign:1, notifications:1, notifRead:1, notifMention:1, roleConfig:1, saveRoleConfig:1, saveTeams:1, saveMktTeams:1, saveSaleGroups:1, saveCareStatus:1,
  broadcastMark:1, saveBroadcast:1, broadcastCancel:1, broadcastSetStatus:1, saveFollowUpTemplates:1, saveAudit:1
};
function _ntlKey_() { return 'ntl_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd'); }
// Ghi 1 request vao bo dem. method: 'GET'|'POST'. Moi loi bi nuot — log KHONG BAO GIO duoc lam hong request that.
// ═══════════════════════════════════════════════════════════════
//  KHOA API CHO EXTENSION (buoc 4a — CHI GHI LOG, chua chan gi). Moi extension (zalo, pancake) 1 khoa, luu trong Script Properties
//  ('extApiKeys', KHONG nam trong sheet Settings vi CRM doc duoc sheet do; repo public nen khoa tuyet doi khong nam trong code extension).
//  Extension gui khoa qua tham so `ek` (GET) / truong "ek" (POST). KHONG dung ten `key` vi getSetting&key=... / setSetting.key da dung ten nay.
//  Lay/doi khoa: chay xemKhoaExtension / doiKhoaZalo / doiKhoaPancake trong Apps Script Editor (xem Execution log), roi dan vao
//  trang Cai dat cua tung extension. Muc dich: biet extension nao da co khoa truoc khi BAT BUOC (buoc 4b).
// ═══════════════════════════════════════════════════════════════
var EXT_KEY_NAMES_ = ['zalo', 'pancake'];
function _extKeys_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('extApiKeys') || '{}') || {}; } catch (e) { return {}; }
}
function _extKeyNew_() { return 'ek_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function _extKeyEnsure_() {
  var ks = _extKeys_(), ch = false;
  EXT_KEY_NAMES_.forEach(function (n) { if (!ks[n]) { ks[n] = _extKeyNew_(); ch = true; } });
  if (ch) PropertiesService.getScriptProperties().setProperty('extApiKeys', JSON.stringify(ks));
  return ks;
}
function _extKeyRotate_(which) {
  var ks = _extKeyEnsure_();
  if (EXT_KEY_NAMES_.indexOf(which) < 0) throw new Error('Ten extension khong hop le: ' + which);
  ks[which] = _extKeyNew_();
  PropertiesService.getScriptProperties().setProperty('extApiKeys', JSON.stringify(ks));
  return ks;
}
// '' = khong gui khoa; 'sai' = gui nhung khong khop khoa nao; 'zalo' / 'pancake' = khop khoa cua extension do (so sanh hang thoi gian).
function _extKeyWho_(ek) {
  ek = String(ek || '');
  if (!ek) return '';
  var ks = _extKeys_();
  for (var i = 0; i < EXT_KEY_NAMES_.length; i++) { if (ks[EXT_KEY_NAMES_[i]] && _secEq_(ek, ks[EXT_KEY_NAMES_[i]])) return EXT_KEY_NAMES_[i]; }
  return 'sai';
}
function xemKhoaExtension() {
  var ks = _extKeyEnsure_();
  Logger.log('Khoa Duyen AI - Zalo   : ' + ks.zalo);
  Logger.log('Khoa Duyen AI - Pancake: ' + ks.pancake);
  Logger.log('Dan tung khoa vao trang Cai dat (Options) cua dung extension, o "Khoa truy cap CRM". Doi khoa: chay doiKhoaZalo / doiKhoaPancake.');
  return ks;
}
function doiKhoaZalo() { _extKeyRotate_('zalo'); return xemKhoaExtension(); }
function doiKhoaPancake() { _extKeyRotate_('pancake'); return xemKhoaExtension(); }

// ═══════════════════════════════════════════════════════════════
//  BUOC 4b — BAT BUOC XAC THUC (MAC DINH TAT: chua bat thi hanh vi y het truoc, chi ghi log)
//  Pham vi: cac action DU LIEU trong NTL_ACTIONS_ (khach/don/nhac hen/giao viec/...). Request duoc qua neu:
//    (a) co token phien web hop le (ky HMAC, chua het han), HOAC
//    (b) co khoa extension hop le VA action nam trong EXT_ALLOWED_ cua extension do (rut tu code extension: Zalo/Pancake chi goi cac action nay), HOAC
//    (c) cong tac cua NGUON do (theo `src` tu khai) dang TAT.
//  Cong tac theo nguon: web | zalo | pancake | other (src la/thieu/worker). Bat tung nguon khi log sach; loi thi tat lai ngay, KHONG can deploy lai.
//  LUU Y: `src` do client tu khai nen chi chan duoc nguon da bat; bao ve that chi co khi bat DU CA 4 (other = ke gia src la / khong src).
//  Chay trong Apps Script Editor (xem Execution log): xemTrangThaiChan, batChanWeb/tatChanWeb, batChanZalo/tatChanZalo,
//  batChanPancake/tatChanPancake, batChanKhac/tatChanKhac. Cong tac co hieu luc sau toi da ~20 giay (bo nho dem).
//  CHUA lam (buoc 4c): han che theo VAI TRO (token hop le = moi vai tro deu goi duoc moi action), loc du lieu khach theo CS o server,
//  va cac action KHONG nam trong NTL_ACTIONS_ (assign, setSetting, saveCannedResponse...).
// ═══════════════════════════════════════════════════════════════
var EXT_ALLOWED_ = {
  zalo: { addCareLead: 1, broadcastMark: 1, customers: 1, deleteDuplicateOrders: 1, lookup: 1, reminders: 1, saveSingle: 1, syncZaloFriendStatus: 1 },
  pancake: { addCareLead: 1, customers: 1, donOrdersByPhone: 1, lookup: 1, reminders: 1, saveSingle: 1, toggleAssignDone: 1 }
};
var ENF_SOURCES_ = ['web', 'zalo', 'pancake', 'other'];
function _enfModes_() {
  var cache = CacheService.getScriptCache(), raw = null;
  try { raw = cache.get('enf_modes'); } catch (e) {}
  if (raw === null || raw === undefined) {
    raw = PropertiesService.getScriptProperties().getProperty('enforceModes') || '{}';
    try { cache.put('enf_modes', raw, 20); } catch (e) {}
  }
  var o = {}; try { o = JSON.parse(raw) || {}; } catch (e) { o = {}; }
  var m = {}; ENF_SOURCES_.forEach(function (k) { m[k] = o[k] === 1 || o[k] === true; });
  return m;
}
function _enfSet_(src, on) {
  if (ENF_SOURCES_.indexOf(src) < 0) throw new Error('Nguon khong hop le: ' + src);
  var props = PropertiesService.getScriptProperties(), o = {};
  try { o = JSON.parse(props.getProperty('enforceModes') || '{}') || {}; } catch (e) { o = {}; }
  o[src] = on ? 1 : 0;
  props.setProperty('enforceModes', JSON.stringify(o));
  try { CacheService.getScriptCache().remove('enf_modes'); } catch (e) {}
  return xemTrangThaiChan();
}
function _srcBucket_(src) {
  src = String(src || '').toLowerCase();
  return (src === 'web' || src === 'zalo' || src === 'pancake') ? src : 'other';
}
// null = cho qua; object = tu choi (tra nguyen cho client).
function _enforceCheck_(action, token, ek, src) {
  if (!NTL_ACTIONS_[action]) return null;
  var m = _enfModes_();
  if (!m.web && !m.zalo && !m.pancake && !m.other) return null;
  if (token && _sessVerify_(token)) return null;
  var who = _extKeyWho_(ek);
  if (who === 'zalo' || who === 'pancake') {
    if (!m[who]) return null;
    return EXT_ALLOWED_[who][action] === 1 ? null : { error: 'Khoa extension nay khong duoc phep thao tac "' + action + '".', code: 'FORBIDDEN' };
  }
  if (!m[_srcBucket_(src)]) return null;
  return { error: 'Can dang nhap lai (token het han/chua co) hoac khoa extension hop le.', code: 'AUTH' };
}
function xemTrangThaiChan() {
  var m = _enfModes_();
  ENF_SOURCES_.forEach(function (k) { Logger.log('Chan nguon ' + k + ': ' + (m[k] ? 'DANG BAT' : 'tat')); });
  Logger.log('Chay batChanWeb/batChanZalo/batChanPancake/batChanKhac de bat, tatChan... de tat. Nen bat theo thu tu web -> zalo -> pancake -> khac.');
  return m;
}
function batChanWeb() { return _enfSet_('web', true); }
function tatChanWeb() { return _enfSet_('web', false); }
function batChanZalo() { return _enfSet_('zalo', true); }
function tatChanZalo() { return _enfSet_('zalo', false); }
function batChanPancake() { return _enfSet_('pancake', true); }
function tatChanPancake() { return _enfSet_('pancake', false); }
function batChanKhac() { return _enfSet_('other', true); }
function tatChanKhac() { return _enfSet_('other', false); }
// ═══════════════════════════════════════════════════════════════
//  BUOC 4c-1 (v13.46): CHI CHU SO HUU (admin Duyent) moi duoc SUA/XOA don o backend.
//  Nguyen nhan goc: token hop le = moi vai tro goi duoc moi action, nen CS goi thang API van xoa/sua duoc don du UI da an nut.
//  Danh sach chu so huu luu Script Properties 'ownerUsers' (mang username, KHONG nam trong sheet/code). Chua cai -> du phong = moi tai khoan role admin
//  (khong doi hanh vi cu). Cai: chay datChuSoHuu('ten_dang_nhap') trong Editor; xem: xemChuSoHuu. Chi chan khi co token hop le
//  (token thieu/het han do cong tac 4b xu ly) va KHONG chan khoa extension (extension dung `ek`, xem EXT_ALLOWED_).
// ═══════════════════════════════════════════════════════════════
var OWNER_ONLY_ACTIONS_ = { patchOrder: 1, deleteOrder: 1, deleteDuplicateOrders: 1, replaceOrders: 1, importSheetRows: 1, dedupeCare: 1 };
function _ownerUsers_() {
  var a = [];
  try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty('ownerUsers') || '[]') || []; } catch (e) { a = []; }
  return a.map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean);
}
function _isOwner_(user) {
  if (!user) return false;
  var owners = _ownerUsers_();
  if (!owners.length) return user.role === 'admin';
  return owners.indexOf(String(user.username || '').trim().toLowerCase()) !== -1;
}
function _ownerGate_(action, token) {
  if (!OWNER_ONLY_ACTIONS_[action] || !token) return null;
  try {
    var u = _sessUser_(token);
    if (u && !_isOwner_(u)) return { error: 'Chi quan tri vien chinh moi duoc sua/xoa don hang.', code: 'FORBIDDEN', action: action };
  } catch (e) {}
  return null;
}
function datChuSoHuu(username) {
  var un = String(username || '').trim().toLowerCase();
  if (!un) throw new Error('Nhap ten dang nhap: datChuSoHuu("ten_dang_nhap")');
  var a = _ownerUsers_(); if (a.indexOf(un) < 0) a.push(un);
  PropertiesService.getScriptProperties().setProperty('ownerUsers', JSON.stringify(a));
  return xemChuSoHuu();
}
function xoaChuSoHuu(username) {
  var un = String(username || '').trim().toLowerCase();
  var a = _ownerUsers_().filter(function (x) { return x !== un; });
  PropertiesService.getScriptProperties().setProperty('ownerUsers', JSON.stringify(a));
  return xemChuSoHuu();
}
function xemChuSoHuu() {
  var a = _ownerUsers_();
  Logger.log(a.length ? 'Chu so huu (duoc sua/xoa don): ' + a.join(', ') : 'Chua cai chu so huu -> du phong: moi tai khoan role admin duoc sua/xoa don. Chay datChuSoHuu("ten_dang_nhap") de gioi han.');
  return a;
}

// ═══════════════════════════════════════════════════════════════
//  BUOC 4c-2a (v13.47): PHAM VI KHACH THEO CS o server cho tra cuu TUNG SDT (lookup, donOrdersByPhone, cskhDetail).
//  Nguyen nhan goc: web chi loc "khach cua toi" o client (_inUserScope), con token hop le goi thang ?action=lookup&phone=... lay duoc ho so BAT KY khach nao.
//  Logic khop client: CS/manager thuoc pham vi neu ten minh nam trong careCS (CareData.cs) / CS phu trach don (DT TONG "Sale ban") / sale trong du lieu don /
//  careLeads.cs / AssignData (da chia). admin + vai tro khac (viewer, ceo...) -> khong gioi han (nhu client). LEADER: chua kiem o server (phai biet team) -> 'unchecked', cho qua.
//  Cong tac Script Properties 'scopeMode': off (mac dinh, khong lam gi) | log (chi ghi dem ai lay khach NGOAI pham vi, KHONG chan) | enforce (chan FORBIDDEN).
//  Chi chay khi co token hop le (extension dung khoa ek -> khong qua day; xem SECURITY-PLAN). Lenh trong Editor: datPhamVi('log'|'enforce'|'off'), xemPhamVi, xemLogPhamVi.
// ═══════════════════════════════════════════════════════════════
var SCOPE_ACTIONS_ = { lookup: 1, donOrdersByPhone: 1, cskhDetail: 1 };
function _scopeMode_() {
  var v = '';
  try { v = PropertiesService.getScriptProperties().getProperty('scopeMode') || ''; } catch (e) {}
  return (v === 'enforce' || v === 'log') ? v : 'off';
}
function _scopeSplit_(str, out) {
  String(str || '').split(',').forEach(function (n) { n = n.trim(); if (n) out[n] = 1; });
}
// phone -> [csName] tu AssignData (cache 120s, chia manh vi sheet lon).
function _scopeAssignIndex_() {
  var raw = null;
  try { raw = _cacheGetBig_('scope_asg_v1'); } catch (e) {}
  if (raw) { try { return JSON.parse(raw) || {}; } catch (e2) {} }
  var idx = {};
  try {
    readAssign_(getCrmSS_().getSheetByName(SH_ASSIGN)).forEach(function (en) {
      var nm = String(en.csName || '').trim(); if (!nm) return;
      (en.phones || []).forEach(function (ph) {
        var k = normPhone_(String(ph)); if (!k) return;
        if (!idx[k]) idx[k] = [];
        if (idx[k].indexOf(nm) < 0) idx[k].push(nm);
      });
    });
  } catch (e3) { Logger.log('_scopeAssignIndex_: ' + e3); }
  try { _cachePutBig_('scope_asg_v1', JSON.stringify(idx), 120); } catch (e4) {}
  return idx;
}
// Tap ten CS "so huu" 1 SDT (object ten->1). Chi doc dung 1 SDT nhu action lookup.
function _scopeNamesForPhone_(phone) {
  var ph = normPhone_(String(phone || '')), names = {};
  if (!ph) return names;
  var care = null; try { care = findCareByPhone_(phone); } catch (e) {}
  if (care) _scopeSplit_(care.cs, names);
  try { readOrdersByPhone_(phone).forEach(function (o) { _scopeSplit_(o && o.cs, names); }); } catch (e1) {}
  try { findDonRowsByPhone_(phone).forEach(function (r) { (r.sales || []).forEach(function (n) { n = String(n || '').trim(); if (n) names[n] = 1; }); }); } catch (e2) {}
  try { readCareLeads_().forEach(function (r) { if (r.phone === ph) _scopeSplit_(r.cs, names); }); } catch (e3) {}
  var ai = _scopeAssignIndex_(); (ai[ph] || []).forEach(function (n) { names[n] = 1; });
  return names;
}
// true = trong pham vi | false = NGOAI pham vi | null = khong kiem duoc (leader) -> cho qua.
function _scopeVerdict_(user, phone, namesFn) {
  if (!user) return null;
  var role = String(user.role || '');
  if (role === 'admin') return true;
  if (role === 'leader') return null;
  if (role !== 'cs' && role !== 'manager') return true;   // viewer/ceo/... : client khong gioi han
  var mine = (user.names && user.names.length) ? user.names : (user.name ? [user.name] : []);
  mine = mine.map(function (n) { return String(n || '').trim(); }).filter(Boolean);
  if (!mine.length) return false;
  var have = (namesFn || _scopeNamesForPhone_)(phone);
  for (var i = 0; i < mine.length; i++) { if (have[mine[i]]) return true; }
  return false;
}
function _scopeKey_() { return 'scp_' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd'); }
function _scopeNote_(user, action, phone, verdict) {
  try {
    var cache = CacheService.getScriptCache(), key = _scopeKey_(), raw = cache.get(key), m = {};
    if (raw) { try { m = JSON.parse(raw) || {}; } catch (e0) { m = {}; } }
    var k = String(user.username || '?') + ' | ' + action + ' | ' + verdict;
    m[k] = (m[k] || 0) + 1;
    if (verdict === 'OUT') {
      var ph = String(phone || ''), smp = m._s || [];
      if (smp.length < 20) { smp.push(String(user.username || '?') + ':***' + ph.slice(-3)); m._s = smp; }
    }
    if (Object.keys(m).length > 200) return;
    cache.put(key, JSON.stringify(m), 21600);
  } catch (e) {}
}
function _scopeGate_(action, token, phone) {
  if (!SCOPE_ACTIONS_[action] || !token || !phone) return null;
  var mode = _scopeMode_();
  if (mode === 'off') return null;
  try {
    var u = _sessUser_(token);
    if (!u) return null;
    var v = _scopeVerdict_(u, phone);
    _scopeNote_(u, action, phone, v === true ? 'in' : (v === false ? 'OUT' : 'unchecked'));
    if (v === false && mode === 'enforce') return { error: 'Khach nay khong thuoc pham vi cua ban.', code: 'FORBIDDEN', action: action };
  } catch (e) {}
  return null;
}
function _scopeReport_() {
  var raw = CacheService.getScriptCache().get(_scopeKey_()), m = {};
  if (raw) { try { m = JSON.parse(raw) || {}; } catch (e0) { m = {}; } }
  var rows = Object.keys(m).filter(function (k) { return k !== '_s'; }).map(function (k) { return { k: k, n: m[k] }; });
  rows.sort(function (a, b) { var ao = a.k.indexOf('| OUT') >= 0 ? 0 : 1, bo = b.k.indexOf('| OUT') >= 0 ? 0 : 1; return ao !== bo ? ao - bo : b.n - a.n; });
  return { ok: true, mode: _scopeMode_(), rows: rows, outSamples: m._s || [] };
}
function datPhamVi(mode) {
  if (mode !== 'off' && mode !== 'log' && mode !== 'enforce') throw new Error('datPhamVi("off" | "log" | "enforce")');
  PropertiesService.getScriptProperties().setProperty('scopeMode', mode);
  return xemPhamVi();
}
function xemPhamVi() { var m = _scopeMode_(); Logger.log('Che do pham vi khach (lookup/donOrdersByPhone/cskhDetail): ' + m + '. Bat theo thu tu off -> log (xem xemLogPhamVi vai ngay) -> enforce.'); return m; }
function xemLogPhamVi() {
  var r = _scopeReport_();
  Logger.log('Che do: ' + r.mode);
  r.rows.forEach(function (x) { Logger.log(x.n + '  ' + x.k); });
  Logger.log('Mau SDT NGOAI pham vi (che SDT): ' + r.outSamples.join(', '));
  return r;
}

// ═══════════════════════════════════════════════════════════════
//  BUOC 4c-2b (v13.48): LOC DANH SACH THEO PHAM VI o server: customers, orders, careLeads, reminders.
//  Nguyen nhan goc: 4c-2a moi chan tra cuu tung SDT; cac action tra CA DANH SACH van tra toan bo khach/don cho moi token (client loc sau o _inUserScope).
//  Dung cung cong tac scopeMode (off|log|enforce) va cung tieu chi 4c-2a, mo rong cho LEADER: pham vi = ten leader + thanh vien team (teams.leader/members, hoac team trung user.team).
//  CS/manager: tap ten = names duoc gan. Mot SDT thuoc pham vi neu BAT KY ten nao so huu SDT do (careCS, Sale ban cua don, du lieu don, careLeads, AssignData) nam trong tap ten.
//  log = chi dem "se bi loc bao nhieu", tra du lieu nguyen ven; enforce = loc that. admin/viewer/ceo/... khong loc. Chi khi co token hop le (extension dung ek khong qua day).
//  Tap SDT thuoc pham vi cache 60s moi nguoi (_cachePutBig_). Worker: customers/orders/careLeads vao GATED_ACTIONS de cache khoa theo user.
// ═══════════════════════════════════════════════════════════════
var SCOPE_LIST_ACTIONS_ = { customers: 1, orders: 1, careLeads: 1, reminders: 1 };
function _scopeAllowedNames_(user) {   // null = khong gioi han; object ten->1 = gioi han
  if (!user) return null;
  var role = String(user.role || '');
  if (role !== 'cs' && role !== 'manager' && role !== 'leader') return null;
  var mine = (user.names && user.names.length) ? user.names : (user.name ? [user.name] : []);
  var out = {};
  mine.forEach(function (n) { n = String(n || '').trim(); if (n) out[n] = 1; });
  if (role === 'leader') {
    try {
      readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function (t) {
        if (out[String(t.leader || '').trim()] || (user.team && String(t.name || '') === String(user.team))) {
          if (t.leader) out[String(t.leader).trim()] = 1;
          (t.members || []).forEach(function (m) { m = String(m || '').trim(); if (m) out[m] = 1; });
        }
      });
    } catch (e) {}
  }
  return out;
}
function _scopeHit_(str, allowed) {
  var a = String(str || '').split(',');
  for (var i = 0; i < a.length; i++) { var n = a[i].trim(); if (n && allowed[n]) return true; }
  return false;
}
// Tap SDT (da chuan hoa) thuoc pham vi cua `allowed`; cache 60s theo username.
function _scopePhoneSet_(user, allowed) {
  var ckey = 'scope_ps_' + String(user.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40);
  var cached = null; try { cached = _cacheGetBig_(ckey); } catch (e) {}
  if (cached) { try { var arr0 = JSON.parse(cached); var o0 = {}; arr0.forEach(function (x) { o0[x] = 1; }); return o0; } catch (e2) {} }
  var set = {};
  function add(ph) { var k = normPhone_(String(ph || '')); if (k) set[k] = 1; }
  try {
    var careRows = sbReadCareAll_();
    if (careRows === undefined) careRows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
    (careRows || []).forEach(function (r) { if (_scopeHit_(r.cs, allowed)) add(r.phone); });
  } catch (e3) { Logger.log('_scopePhoneSet_ care: ' + e3); }
  try {
    var oc = _cacheGetBig_('orders_v1'), ords = null;
    if (oc) { try { ords = (JSON.parse(oc) || {}).orders; } catch (e4) {} }
    if (!ords) ords = readAllOrders_();
    (ords || []).forEach(function (o) { if (o && _scopeHit_(o.cs, allowed)) add(o.phone); });
  } catch (e5) { Logger.log('_scopePhoneSet_ orders: ' + e5); }
  try {
    readDonChiTiet_().forEach(function (r) {
      var sl = _donSaleNamesFromThe_(r.theSale) || [];
      for (var i = 0; i < sl.length; i++) { if (allowed[String(sl[i] || '').trim()]) { add(r.soDienThoai); break; } }
    });
  } catch (e6) { Logger.log('_scopePhoneSet_ don: ' + e6); }
  try { readCareLeads_().forEach(function (r) { if (_scopeHit_(r.cs, allowed)) add(r.phone); }); } catch (e7) {}
  try {
    var ai = _scopeAssignIndex_();
    Object.keys(ai).forEach(function (ph) { for (var i = 0; i < ai[ph].length; i++) { if (allowed[ai[ph][i]]) { set[ph] = 1; break; } } });
  } catch (e8) {}
  try { _cachePutBig_(ckey, JSON.stringify(Object.keys(set)), 60); } catch (e9) {}
  return set;
}
// Loc obj theo action. Tra {obj, total, kept}. Chi dong vao mang du lieu, giu nguyen cac truong khac (careStatus, errorCount...).
function _scopeFilterObj_(action, obj, phoneSet) {
  var key = action === 'orders' ? 'orders' : (action === 'reminders' ? 'reminders' : 'rows');
  if (!obj || !Array.isArray(obj[key])) return { obj: obj, total: 0, kept: 0 };
  var arr = obj[key], kept = arr.filter(function (x) { return phoneSet[normPhone_(String((x && x.phone) || ''))]; });
  var copy = {}; Object.keys(obj).forEach(function (k) { copy[k] = obj[k]; });
  copy[key] = kept;
  return { obj: copy, total: arr.length, kept: kept.length };
}
// Goi tu doGet. Tra null = khong lien quan (off / khong gioi han / loi) -> doGet tu chay doGetCore_ nhu cu.
function _scopeListServe_(action, p, e) {
  if (!SCOPE_LIST_ACTIONS_[action] || !p.token) return null;
  var mode = _scopeMode_();
  if (mode === 'off') return null;
  var user, allowed, resp, obj;
  try {
    user = _sessUser_(p.token);
    allowed = _scopeAllowedNames_(user);
    if (!allowed) return null;
    resp = doGetCore_(e);
    obj = JSON.parse(resp.getContent());
  } catch (e1) { return null; }
  try {
    if (!Object.keys(allowed).length) { var phs0 = {}; } else { phs0 = _scopePhoneSet_(user, allowed); }
    var f = _scopeFilterObj_(action, obj, phs0);
    _scopeNote_(user, action, '', 'LIST ' + (mode === 'enforce' ? 'filtered' : 'would-filter') + ' ' + (f.total - f.kept) + '/' + f.total);
    if (mode === 'enforce') return jsonOut_(f.obj);
  } catch (e2) { Logger.log('_scopeListServe_: ' + e2); }
  return resp;
}

// Bi mat ky token phien — dan vao bien Secret SESS_SECRET cua Cloudflare Worker de Worker chi phuc vu cache cho token hop le. KHONG dan vao chat/repo.
function xemBiMatPhien() { Logger.log('SESS_SECRET = ' + _sessSecret_()); }

function _ntlNote_(method, action, token, src, ek) {
  try {
    action = String(action || '');
    if (!NTL_ACTIONS_[action]) return;
    var tokOk = !!(token && _sessVerify_(token));
    var who = tokOk ? '' : _extKeyWho_(ek);
    var cache = CacheService.getScriptCache();
    var key = _ntlKey_(), raw = cache.get(key), m = {};
    if (raw) { try { m = JSON.parse(raw) || {}; } catch (e0) { m = {}; } }
    var sc = String(src || '?').replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 16) || '?';
    var lbl = tokOk ? 'token' : (who && who !== 'sai' ? 'key-' + who : 'NO-TOKEN' + (who === 'sai' ? '(key-sai)' : ''));
    var k = method + ' ' + action + ' | src=' + sc + ' | ' + lbl;
    m[k] = (m[k] || 0) + 1;
    if (Object.keys(m).length > 200) return;   // chan phinh to bat thuong (vd ai do gui action/src ngau nhien)
    cache.put(key, JSON.stringify(m), 21600);
  } catch (e) {}
}
// Tra {date, rows:[{k, n}], noTokenTotal, tokenTotal} — sap xep NO-TOKEN truoc, nhieu nhat truoc.
function _ntlReport_() {
  var raw = CacheService.getScriptCache().get(_ntlKey_()), m = {};
  if (raw) { try { m = JSON.parse(raw) || {}; } catch (e0) { m = {}; } }
  var rows = Object.keys(m).map(function (k) { return { k: k, n: m[k] }; });
  rows.sort(function (a, b) {
    var an = a.k.indexOf('NO-TOKEN') >= 0 ? 0 : 1, bn = b.k.indexOf('NO-TOKEN') >= 0 ? 0 : 1;
    return an !== bn ? an - bn : b.n - a.n;
  });
  var noTok = 0, tok = 0, keyed = 0;
  rows.forEach(function (r) { if (r.k.indexOf('NO-TOKEN') >= 0) noTok += r.n; else if (r.k.indexOf('| key-') >= 0) keyed += r.n; else tok += r.n; });
  return { ok: true, date: _ntlKey_().slice(4), noTokenTotal: noTok, tokenTotal: tok, keyTotal: keyed, rows: rows,
    note: 'Dem gan dung, luu o cache toi da 6 gio (ngung 6 gio thi bat dau dem lai). src=? nghia la nguoi goi chua gui tham so src.' };
}
// Chay tay trong Apps Script Editor (khong can adminKey): xem Execution log.
function xemLogKhongToken() {
  var r = _ntlReport_();
  Logger.log('Ngay ' + r.date + ': KHONG token=' + r.noTokenTotal + ', co token=' + r.tokenTotal);
  r.rows.slice(0, 60).forEach(function (x) { Logger.log(x.n + '  ' + x.k); });
  return r;
}


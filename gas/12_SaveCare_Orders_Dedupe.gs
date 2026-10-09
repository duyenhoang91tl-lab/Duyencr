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
  if (sbMode_() !== 'off') sbMarkStale_('saveAllCare_ ghi de ca sheet CareData');   // Supabase se lech dien rong -> khong doc Supabase cho den khi backfill lai
  return jsonOut_({ ok: true, written: rows.length });
}

function saveSingleCare_(r) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1; var rowW;
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
    mergeExtFields_(r, { khStatus: existRow[15]||'', nickZalos: existRow[16]||'[]', birthday: existRow[17]||'', zaloSetBy: existRow[18]||'', name: existRow[19]||'', zaloPhones: existRow[21]||'[]' });
    rowW = careRow_(r);
    sh.getRange(rowIdx, 1, 1, CARE_HEADERS.length).setValues([rowW]);
  } else {
    rowW = careRow_(r);
    sh.appendRow(rowW);
  }
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('customers_v12');
    cache.remove('lk_' + normPhone_(String(r.phone)));
  } catch(ec) {}
  sbMirrorCare_(sbRowsToRecs_([rowW]), 'saveSingleCare_');   // Sheets da ghi xong; mirror loi KHONG lam hong thao tac luu
  return jsonOut_({ ok: true, found: rowIdx > 0 });
}

function saveBatchCare_(rows) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  // LO NHO (da so voi moi lan CS sua 1-vai KH): truoc day LUON doc ca sheet roi ghi de ca sheet (hang trieu o) chi de luu vai dong.
  // Nay chi doc cot SDT, doc/ghi dung cac dong can doi, them dong moi bang 1 lan setValues. Lo lon (chia data) giu cach cu: 1 doc + 1 ghi.
  if (rows.length <= 50) {
    var Ws = CARE_HEADERS.length, lastS = sh.getLastRow(), idxS = {};
    if (lastS >= 2) {
      var colA = sh.getRange(2, 1, lastS - 1, 1).getValues();
      for (var ci = 0; ci < colA.length; ci++) { if (colA[ci][0]) idxS[normPhone_(String(colA[ci][0]))] = ci + 2; }
    }
    var exOf = function(row) { return { khStatus: row[15]||'', nickZalos: row[16]||'[]', birthday: row[17]||'', zaloSetBy: row[18]||'', name: row[19]||'', zaloPhones: row[21]||'[]' }; };
    var updS = 0, appS = 0, newRowsS = [], newIdxS = {}, mirS = [];
    for (var ks = 0; ks < rows.length; ks++) {
      var rs = rows[ks]; var keyS = normPhone_(String(rs.phone));
      if (idxS[keyS] !== undefined) {
        var exRow = sh.getRange(idxS[keyS], 1, 1, Ws).getValues()[0];
        mergeExtFields_(rs, exOf(exRow));
        var rowU = careRow_(rs); sh.getRange(idxS[keyS], 1, 1, Ws).setValues([rowU]); updS++; mirS.push(rowU);
      } else if (newIdxS[keyS] !== undefined) {
        mergeExtFields_(rs, exOf(newRowsS[newIdxS[keyS]]));
        newRowsS[newIdxS[keyS]] = careRow_(rs); updS++;
      } else {
        newRowsS.push(careRow_(rs)); newIdxS[keyS] = newRowsS.length - 1; appS++;
      }
    }
    if (newRowsS.length) sh.getRange(lastS + 1, 1, newRowsS.length, Ws).setValues(newRowsS);
    try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
    invalidateLookupCache_(rows.map(function(r){ return r.phone; }));
    sbMirrorCare_(sbRowsToRecs_(mirS.concat(newRowsS)), 'saveBatchCare_');
    return jsonOut_({ ok: true, updated: updS, appended: appS });
  }
  var data = sh.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < data.length; i++) { if (data[i][0]) index[normPhone_(String(data[i][0]))] = i; }
  var appended = 0, updated = 0;
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k]; var key = normPhone_(String(r.phone));
    if (index[key] !== undefined) {
      mergeExtFields_(r, { khStatus: data[index[key]][15]||'', nickZalos: data[index[key]][16]||'[]', birthday: data[index[key]][17]||'', zaloSetBy: data[index[key]][18]||'', name: data[index[key]][19]||'', zaloPhones: data[index[key]][21]||'[]' });
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
  if (sbWriteOn_()) {
    var mirB = [];
    for (var mk = 0; mk < rows.length; mk++) { var ixm = index[normPhone_(String(rows[mk].phone))]; if (ixm !== undefined) mirB.push(data[ixm]); }
    sbMirrorCare_(sbRowsToRecs_(mirB), 'saveBatchCare_(lo lon)');
  }
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

  var updated = 0, appended = 0, touchedRows = [];
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
      updated++; touchedRows.push(rowNum);
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
  sbMirrorSheetRows_(sh, touchedRows, newRows, 'syncZaloFriendStatus_');
  return jsonOut_({ ok: true, updated: updated, appended: appended });
}

// ─── SAVE ORDERS ───────────────────────────────────────────────
// Import hang loat khong con duoc dung nua tu khi bo Sasum (DT TONG do nhan vien
// tu quan ly truc tiep tren Sheet) — tra loi ro de tranh ghi nham cot vao sheet
// dang duoc quan ly thu cong.
function saveOrders_(orders) {
  return jsonOut_({ ok: false, error: 'Da ngung ho tro import hang loat don hang (saveOrders). DT TONG gio duoc quan ly truc tiep tren Google Sheet, khong con dong bo tu Sasum nua.' });
}

// Sua 1 don hang trong DT TONG. Uu tien khop theo data.id (cot T, chinh xac tuyet doi).
// Neu khong co id (client cu chua gui), du phong khop theo phone + oldYear/oldMonth (tu
// Thoi gian hoan thanh) + oldRevenue nhu co che cu.
function patchOrder_(data) {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh || sh.getLastRow() < 2) return jsonOut_({ ok: false, error: 'Khong tim thay sheet DT TONG' });
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  var rowIdx = -1;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (data.id) {
      if (String(r[DT_COL_ID]) === String(data.id)) { rowIdx = i + 2; break; }
      continue;
    }
    var ph = normPhone_(String(r[DT_COL_PHONE] || ''));
    if (ph !== normPhone_(String(data.phone || ''))) continue;
    var d = parseVNDate_(r[DT_COL_THOIGIANHT]);
    var _p = d ? _vnYmdParts_(d) : null; var yy = _p ? _p.y : '', mm = _p ? _p.mo : '';
    if (String(yy) !== String(data.oldYear)) continue;
    if (String(mm) !== String(data.oldMonth)) continue;
    if (_normMoney_(r[DT_COL_GIATRIDON]) !== _normMoney_(data.oldRevenue)) continue;
    rowIdx = i + 2; break;
  }
  if (rowIdx === -1) return jsonOut_({ ok: false, updated: false, error: 'Khong tim thay dong don hang phu hop trong DT TONG' });

  if (data.newDate !== undefined) {
    var dnew = parseVNDate_(data.newDate) || new Date(data.newDate);
    if (dnew && !isNaN(dnew.getTime())) sh.getRange(rowIdx, DT_COL_THOIGIANHT + 1).setValue(dnew);
  }
  if (data.newRevenue !== undefined) sh.getRange(rowIdx, DT_COL_GIATRIDON + 1).setValue(data.newRevenue);
  if (data.newProduct)               sh.getRange(rowIdx, DT_COL_SANPHAM + 1).setValue(data.newProduct);
  if (data.newDetail)                sh.getRange(rowIdx, DT_COL_PHANLOAI + 1).setValue(data.newDetail);
  _ordersCacheClear_();
  try { CacheService.getScriptCache().remove('lk_' + normPhone_(String(data.phone))); } catch (ec) {}
  return jsonOut_({ ok: true, updated: true });
}

// Xoa 1 don hang trong DT TONG. Uu tien khop theo data.id; du phong theo phone+year/month/revenue.
function deleteOrder_(data) {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh || sh.getLastRow() < 2) return jsonOut_({ ok: false, deleted: false, error: 'Khong tim thay sheet DT TONG' });
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (data.id) {
      if (String(r[DT_COL_ID]) !== String(data.id)) continue;
    } else {
      var ph = normPhone_(String(r[DT_COL_PHONE] || ''));
      if (ph !== normPhone_(String(data.phone || ''))) continue;
      var d = parseVNDate_(r[DT_COL_THOIGIANHT]);
      var _p = d ? _vnYmdParts_(d) : null; var yy = _p ? _p.y : '', mm = _p ? _p.mo : '';
      if (String(yy) !== String(data.oldYear)) continue;
      if (String(mm) !== String(data.oldMonth)) continue;
      if (_normMoney_(r[DT_COL_GIATRIDON]) !== _normMoney_(data.oldRevenue)) continue;
    }
    sh.deleteRow(i + 2);
    _ordersCacheClear_();
    try { CacheService.getScriptCache().remove('lk_' + normPhone_(String(data.phone))); } catch (ec) {}
    return jsonOut_({ ok: true, deleted: true });
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
  // KHONG dung Session.getScriptTimeZone() nua (co the sai neu cau hinh Time Zone cua du an
  // khong phai gio VN) — dung parseVNDate_ (da chuan hoa gio VN tuyet doi qua Date.UTC+offset)
  // roi format bang _vnYmd_ (cung offset co dinh, khong qua ambient timezone nao ca).
  var d = parseVNDate_(v);
  if (d) return _vnYmd_(d);
  var d2 = (v instanceof Date) ? v : new Date(v);
  if (!isNaN(d2)) return _vnYmd_(d2);
  return String(v).trim();
}
// Chuan hoa ten de SO SANH (khong dung de hien thi): bo khoang trang dau/cuoi + cac ky tu
// khoang trang/vo hinh Unicode hay dinh kem khi copy-paste (NBSP, zero-width space...), gop
// nhieu khoang trang lien tiep thanh 1, roi ha chu thuong. Dung o MOI cho gop ten Sale/Nhan
// vien theo key (Pancake report, KPI report...) de tranh 1 nguoi bi tach thanh 2 dong chi vi
// khac hoa/thuong hoac dinh khoang trang an khi go/copy tu Pancake.
function _normTxt_(s) {
  return String(s || '')
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '') // NBSP + cac ky tu vo hinh thuong gap
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function findDuplicateOrders_(phoneFilter) {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  var normP = phoneFilter ? normPhone_(phoneFilter) : '';
  var groupsByKey = {};
  if (sh && sh.getLastRow() >= 2) {
    var last = sh.getLastRow();
    var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      if (!r[DT_COL_PHONE]) continue;
      var np = normPhone_(String(r[DT_COL_PHONE]));
      if (normP && np !== normP) continue;
      var nDate = normOrderDate_(r[DT_COL_THOIGIANHT]);
      var key = np + '|' + nDate + '|' + _normTxt_(r[DT_COL_SANPHAM]);
      if (!groupsByKey[key]) groupsByKey[key] = [];
      groupsByKey[key].push({
        sheet: DT_TONG_SHEET, rowIndex: i + 2, id: r[DT_COL_ID] != null ? String(r[DT_COL_ID]) : '',
        phone: r[DT_COL_PHONE], name: '', date: r[DT_COL_THOIGIANHT] || '',
        year: '', month: '', cs: r[DT_COL_SALEBAN] || '', source: r[DT_COL_KENHBAN] || '',
        revenue: _normMoney_(r[DT_COL_GIATRIDON]), product: r[DT_COL_SANPHAM] || '',
        productDetail: r[DT_COL_PHANLOAI] || '', status: r[DT_COL_TRANGTHAI] || ''
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
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) return jsonOut_({ ok: false, deleted: 0, skipped: items.length, error: 'Khong tim thay sheet DT TONG' });
  // Xoa tu duoi len tren de khong lam lech chi so cac dong con lai
  var arr = items.slice().sort(function (a, b) { return (b.rowIndex||0) - (a.rowIndex||0); });
  var deleted = 0, skipped = 0, affectedPhones = {};
  arr.forEach(function (it) {
    if (!it || !it.rowIndex) { skipped++; return; }
    try {
      var rowVals = sh.getRange(it.rowIndex, 1, 1, DT_TONG_WIDTH).getValues()[0];
      var match = true;
      // Uu tien xac minh theo id (chinh xac tuyet doi); neu khong co id, du phong theo phone/date/revenue/product
      if (it.id) {
        if (String(rowVals[DT_COL_ID]) !== String(it.id)) match = false;
      } else {
        if (it.phone   != null && it.phone   !== '' && normPhone_(String(rowVals[DT_COL_PHONE])) !== normPhone_(String(it.phone))) match = false;
        if (match && it.date    != null && it.date    !== '' && normOrderDate_(rowVals[DT_COL_THOIGIANHT]) !== normOrderDate_(it.date)) match = false;
        if (match && it.revenue != null && it.revenue !== '' && _normMoney_(rowVals[DT_COL_GIATRIDON]) !== _normMoney_(it.revenue)) match = false;
        if (match && it.product != null && it.product !== '' && _normTxt_(rowVals[DT_COL_SANPHAM]) !== _normTxt_(it.product)) match = false;
      }
      if (!match) { skipped++; return; } // dong da bi dich/doi khac voi luc CS bam xoa -> KHONG xoa, tranh xoa nham
      if (rowVals[DT_COL_PHONE]) affectedPhones[normPhone_(String(rowVals[DT_COL_PHONE]))] = true;
      sh.deleteRow(it.rowIndex);
      deleted++;
    } catch (e) { skipped++; }
  });
  if (deleted) _ordersCacheClear_();
  try {
    var cache = CacheService.getScriptCache();
    Object.keys(affectedPhones).forEach(function (p) { cache.remove('lk_' + p); });
  } catch (ec) {}
  return jsonOut_({ ok: true, deleted: deleted, skipped: skipped });
}

// ═══ TỰ ĐỘNG XOÁ DÒNG TRÙNG TUYỆT ĐỐI (Base + Pos) — thêm 2026-10-04 theo yêu cầu Duyên ═══
// Khác với findDuplicateOrders_/deleteDuplicateOrders_ ở trên (chỉ ĐỀ XUẤT, bắt buộc người
// dùng xác nhận trước khi xoá — vì nhóm trùng theo SĐT+ngày+SP có thể là 2 đơn THẬT lệch
// doanh thu): hàm dưới đây CHỈ xử lý trường hợp an toàn tuyệt đối — 1 dòng GIỐNG Y HỆT từng
// cột với 1 dòng khác (gần như chắc chắn là lỡ tay dán/nạp trùng 2 lần, không phải 2 đơn khác
// nhau) — nên mới được phép tự xoá mà KHÔNG cần ai xác nhận, chạy ngay khi sheet "DT TỔNG "
// (Base) hoặc "dữ liệu đơn" (Pos) có thay đổi (xem onChangeDedupTrigger_ + installAutoDedupTrigger_).
function _rowKeyExact_(row) {
  return JSON.stringify(row.map(function (v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return 'D:' + v.getTime();
    return v;
  }));
}
function _rowIsBlank_(row) {
  return row.every(function (v) { return v === '' || v === null || v === undefined; });
}
// Xoá các dòng trùng TUYỆT ĐỐI (mọi cột giống y hệt) trong 1 sheet, giữ lại dòng ĐẦU TIÊN
// của mỗi nhóm trùng, xoá (các) dòng còn lại. Bỏ qua dòng rỗng hoàn toàn (không tính là trùng).
function _autoDedupExactRowsInSheet_(sh, width) {
  if (!sh) return { deleted: 0, groupCount: 0 };
  var last = sh.getLastRow();
  if (last < 3) return { deleted: 0, groupCount: 0 }; // can >=2 dong du lieu moi co the trung
  width = Math.min(width, sh.getMaxColumns()); // sheet co the it cot hon width (tranh getRange vuot cot)
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  var seen = {}, toDelete = [], groupCount = 0;
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    if (_rowIsBlank_(row)) continue;
    var key = _rowKeyExact_(row);
    if (!seen[key]) { seen[key] = true; }
    else { toDelete.push(i + 2); groupCount++; }
  }
  if (!toDelete.length) return { deleted: 0, groupCount: 0 };
  toDelete.sort(function (a, b) { return b - a; }); // xoa tu duoi len tren, tranh lech chi so
  var deleted = 0;
  toDelete.forEach(function (rowIdx) {
    try { sh.deleteRow(rowIdx); deleted++; } catch (e) {}
  });
  return { deleted: deleted, groupCount: groupCount };
}
var SH_AUTO_DEDUP_LOG = 'Nhật ký xoá trùng tự động';
var AUTO_DEDUP_LOG_HEADERS = ['thoiGian', 'sheet', 'soDongDaXoa', 'ghiChu'];
function _autoDedupLog_(sheetName, deleted) {
  if (!deleted) return;
  try {
    var sh = getSheet_(SH_AUTO_DEDUP_LOG, AUTO_DEDUP_LOG_HEADERS);
    sh.appendRow([new Date(), sheetName, deleted, 'Tự động xoá dòng trùng tuyệt đối (trigger onChange) — xem lại sheet "' + sheetName + '" nếu thấy nghi ngờ.']);
  } catch (e) {}
}
// Ham duoc Google Sheets TU GOI khi spreadsheet DT_SS_ID (chua ca Base + Pos) co bat ky thay
// doi nao (dan/nhap/xoa dong, sua 1 o...) — xem installAutoDedupTrigger_ o duoi de cai dat
// trigger nay 1 LAN. Dung LockService de tranh 2 lan chay cung luc dam vao nhau khi co nhieu
// thay doi lien tiep gan nhau (vd dan nhieu lo du lieu gan sat nhau).
function onChangeDedupTrigger_(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // dang co lan chay khac xu ly, bo qua lan nay (se duoc don o lan thay doi tiep theo)
  try {
    var ss = getDTSS_();
    var resBase = _autoDedupExactRowsInSheet_(ss.getSheetByName(DT_TONG_SHEET), DT_TONG_WIDTH);
    _autoDedupLog_(DT_TONG_SHEET, resBase.deleted);
    var resPos = _autoDedupExactRowsInSheet_(ss.getSheetByName(DON_CHITIET_SHEET), DON_CHITIET_WIDTH);
    _autoDedupLog_(DON_CHITIET_SHEET, resPos.deleted);
    try {
      var cache = CacheService.getScriptCache();
      // SUA 2026-10-07: key cache dung truoc day la 'donChiTiet_v3_n' nhung readDonChiTiet_ da doi
      // sang luu duoi key 'donChiTiet_v4' tu lau (xem _cachePutBig_('donChiTiet_v4',...) o tren) —
      // xoa nham key cu 'v3_n' khong con ton tai KHONG lam gi ca, nen cache 'v4' van song toi het
      // 90s TTL du sheet Pos vua bi xoa dong trung, khien bao cao B/E/F/G co the tam thoi van hien
      // dong da bi xoa. _cacheGetBig_ chi can mat key "<key>_n" la coi nhu cache rong (xem ham do),
      // nen chi can xoa dung '_n' cua key HIEN TAI 'donChiTiet_v4' la du, khong can xoa tung manh.
      if (resPos.deleted) cache.removeAll(['donChiTiet_v4_n', 'don_phones_v6_n']); // force doc lai sheet Pos ngay, khong doi het 90s cache
      if (resBase.deleted) cache.removeAll(['srptOptions_v3', 'orders_v1_n']);
    } catch (ecCache) {}
  } finally {
    lock.releaseLock();
  }
}
// CHAY 1 LAN DUY NHAT tu Apps Script Editor (chon ham "installAutoDedupTrigger_" trong dropdown
// -> bam Run, lan dau se hoi cap quyen thi Allow) de cai dat trigger "On change" cho spreadsheet
// DT_SS_ID. Trigger nay la installable trigger, TON TAI DOC LAP voi cac lan deploy Web App ve
// sau (khong bi mat khi dan de code moi + Deploy New version) — nen KHONG can chay lai ham nay
// moi lan sua code, chi can chay 1 LAN duy nhat. Ham tu kiem tra truoc, chay lai nhieu lan van
// an toan (khong tao trigger trung).
function installAutoDedupTrigger_() {
  var ss = getDTSS_();
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'onChangeDedupTrigger_' && t.getTriggerSourceId() === ss.getId();
  });
  if (existing.length) return 'Trigger "onChangeDedupTrigger_" da ton tai (' + existing.length + '), khong tao them.';
  ScriptApp.newTrigger('onChangeDedupTrigger_').forSpreadsheet(ss).onChange().create();
  return 'Da tao trigger "On change" cho spreadsheet DT_SS_ID (' + ss.getId() + ') thanh cong.';
}

// ═══ NHAP DU LIEU BASE/POS TU FILE EXPORT (thay copy tay vao Google Sheet) — them 2026-10-07 theo
// yeu cau Duyen: "tạo 1 mục up data base pos lên CRM, nối tiếp vào 2 sheet [...] base là DT tổng
// và pos là dữ liệu đơn". Client (index.html, renderSalesReportTabI_/_impUpload) doc file Excel
// bang SheetJS, GUI NGUYEN mang 2 chieu (header + cot rong thua da bi cat o client) len day qua
// action 'importSheetRows'. Ham nay CHI ghi noi tiep (append) — khong bao gio ghi de/xoa du lieu
// cu, an toan voi sheet dang duoc nhan vien thao tac truc tiep hang ngay.
// SUA 2026-10-08 — KHOA KHU TRUNG THEO DON (khong con chi so khop "giong het moi cot").
// NGUYEN NHAN GOC cua loi "nhap lai file Excel van them don trung -> doanh thu x2": truoc day chi khu
// trung TUYET DOI (moi cot giong y het, xem _rowKeyExact_). Nhung nhan vien sua tay cac cot ben phai
// (Giao cho / Giai doan / Trang thai / Ghi chu) tren Sheet, va file export moi cung co the doi gia tri
// (trang thai don, dinh dang so "1,200,000" vs 1200000, ngay dang chuoi vs Date...) -> cung 1 don
// nhung KHAC o 1 cot la hoi tiet -> khong bi coi la trung -> ghi them dong thu 2 -> doanh thu x2.
// Cach moi: tinh KHOA DON da chuan hoa cho dong trong file VA dong da co san trong Sheet, bo qua dong
// nao khoa da ton tai (khong ghi de/khong xoa dong cu).
//  - Base (DT TONG): ID don (cot T) neu co; thieu ID thi SDT + ngay tao + thoi gian HT + gia tri don + san pham.
//  - Pos (du lieu don): khong co cot ID, cot A (STT) doi moi lan export nen BO QUA; dung ngay+gio tao,
//    SDT, ten khach, san pham, ma SP, so luong, gia tri sau giam, COD.
function _impHm_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    var sh = new Date(v.getTime() + VN_OFFSET_MS);
    return String(sh.getUTCHours()).padStart(2, '0') + ':' + String(sh.getUTCMinutes()).padStart(2, '0');
  }
  var m = String(v == null ? '' : v).trim().match(/\s(\d{1,2}):(\d{2})/);
  return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : '';
}
function _impOrderKey_(sheetKey, row) {
  if (sheetKey === 'base') {
    var id = String(row[DT_COL_ID] == null ? '' : row[DT_COL_ID]).trim();
    if (id) return 'id|' + id;
    var ph = normPhone_(String(row[DT_COL_PHONE] || ''));
    if (!ph) return 'x|' + _rowKeyExact_(row);
    return 'f|' + ph + '|' + normOrderDate_(row[DT_COL_NGAYTAO]) + '|' + normOrderDate_(row[DT_COL_THOIGIANHT]) + '|' +
      _normMoney_(row[DT_COL_GIATRIDON]) + '|' + _normTxt_(row[DT_COL_SANPHAM]);
  }
  var phP = normPhone_(String(row[4] || ''));
  var nameP = _normTxt_(row[3]), spP = _normTxt_(row[8]);
  if (!phP && !nameP && !spP) return 'x|' + _rowKeyExact_(row);
  return 'p|' + normOrderDate_(row[1]) + '|' + _impHm_(row[1]) + '|' + phP + '|' + nameP + '|' + spP + '|' +
    _normTxt_(row[9]) + '|' + _normTxt_(row[10]) + '|' + _normMoney_(row[11]) + '|' + _normMoney_(row[12]);
}

function doImportSheetRows_(sheetKey, rows) {
  if (!Array.isArray(rows) || !rows.length) return jsonOut_({ error: 'Không có dòng nào để nhập.' });
  var sheetName = sheetKey === 'pos' ? DON_CHITIET_SHEET : (sheetKey === 'base' ? DT_TONG_SHEET : '');
  if (!sheetName) return jsonOut_({ error: 'Tham số sheet không hợp lệ (chỉ nhận "base" hoặc "pos").' });
  var ss = getDTSS_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return jsonOut_({ error: 'Không tìm thấy sheet "' + sheetName + '" trong Google Sheet.' });

  // Khoa: bam "Nhap" 2 lan / 2 admin nhap cung luc khong duoc cung doc-roi-ghi (se cung thay "chua co" -> ghi 2 lan).
  var impLock = LockService.getScriptLock();
  if (!impLock.tryLock(25000)) return jsonOut_({ error: 'Hệ thống đang xử lý 1 lần nhập khác — đợi vài giây rồi bấm lại (KHÔNG bấm liên tục).' });
  try {
    return doImportSheetRowsLocked_(sheetKey, sheetName, sh, rows);
  } finally {
    try { impLock.releaseLock(); } catch (eRel) {}
  }
}
function doImportSheetRowsLocked_(sheetKey, sheetName, sh, rows) {
  var width = 0;
  for (var i = 0; i < rows.length; i++) {
    if (!Array.isArray(rows[i])) return jsonOut_({ error: 'Dữ liệu dòng ' + (i + 1) + ' không đúng định dạng (không phải mảng).' });
    width = Math.max(width, rows[i].length);
  }
  if (width < 1 || width > 40) return jsonOut_({ error: 'Số cột dữ liệu không hợp lệ (' + width + ') — kiểm tra lại file.' });

  // Khu trung NGAY TRONG CHINH FILE dang nhap (vd lo xuat 2 lan trung 1 doan ngay) — chi so sanh
  // gia tri THO (chuoi/so) nhan tu JSON cua client, CHUA lien quan Date object cua Google Sheet
  // (xem giai thich ky hon o duoi, truoc khi goi _autoDedupExactRowsInSheet_).
  var toWrite = [], seenInFile = {}, skippedDupInFile = 0;
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r].slice(0, width);
    while (row.length < width) row.push('');
    if (_rowIsBlank_(row)) continue;
    var key = JSON.stringify(row);
    if (seenInFile[key]) { skippedDupInFile++; continue; }
    seenInFile[key] = true;
    toWrite.push(row);
  }
  // Bo cac dong DON DA CO SAN trong Sheet (theo khoa don chuan hoa — xem _impOrderKey_). Doc lai chinh
  // Sheet (khong tin cache) trong luc dang giu khoa.
  var keyW = (sheetKey === 'pos') ? DON_CHITIET_WIDTH : DT_TONG_WIDTH;
  var existKeys = {};
  var lastNow = sh.getLastRow();
  if (lastNow >= 2) {
    var exVals = sh.getRange(2, 1, lastNow - 1, Math.min(keyW, sh.getMaxColumns())).getValues();
    for (var e = 0; e < exVals.length; e++) {
      var er = exVals[e];
      if (_rowIsBlank_(er)) continue;
      while (er.length < keyW) er.push('');
      existKeys[_impOrderKey_(sheetKey, er)] = true;
    }
  }
  var fresh = [], skippedExisting = 0, seenKey = {};
  for (var w = 0; w < toWrite.length; w++) {
    var kr = toWrite[w].slice(0);
    while (kr.length < keyW) kr.push('');
    var k2 = _impOrderKey_(sheetKey, kr);
    if (existKeys[k2]) { skippedExisting++; continue; }
    if (seenKey[k2]) { skippedDupInFile++; continue; }
    seenKey[k2] = true;
    fresh.push(toWrite[w]);
  }
  toWrite = fresh;
  if (!toWrite.length) return jsonOut_({ ok: true, written: 0, skippedDupInFile: skippedDupInFile, skippedExisting: skippedExisting, dedupedAfter: 0 });

  sh.getRange(sh.getLastRow() + 1, 1, toWrite.length, width).setValues(toWrite);

  // Khu trung TUYET DOI voi du lieu DA CO SAN trong sheet: CO Y khong tu so sanh truoc khi ghi —
  // cac dong moi gui len tu client la gia tri THO tu JSON (vd ngay la chuoi "06/10/2026 23:46"),
  // trong khi cac dong co san doc qua getValues() co the da la Date object (Google Sheet tu nhan
  // dang dinh dang ngay) — 2 kieu nay so sanh truc tiep se KHONG BAO GIO khop, lam dedup vo tac
  // dung voi moi dong co cot ngay. Giai phap: ghi xong RỒI doc lai CA 2 phia tu chinh Sheet qua
  // _autoDedupExactRowsInSheet_ (dung CHUNG ham + do rong voi trigger onChange co san, xem
  // onChangeDedupTrigger_ o tren) — luc nay Sheets da tu chuan hoa kieu du lieu cho CA dong cu LAN
  // dong vua ghi giong het nhau, so sanh moi dung. Dong moi trung voi dong cu se bi xoa, GIU LAI
  // dong cu (dung dung thu tu uu tien "dong dau tien" cua ham dung chung).
  var dedupWidth = (sheetName === DON_CHITIET_SHEET) ? DON_CHITIET_WIDTH : DT_TONG_WIDTH;
  var dedupRes = _autoDedupExactRowsInSheet_(sh, dedupWidth);
  _autoDedupLog_(sheetName, dedupRes.deleted);

  try {
    var cache = CacheService.getScriptCache();
    if (sheetName === DON_CHITIET_SHEET) cache.removeAll(['donChiTiet_v4_n', 'don_phones_v6_n']);
    else cache.removeAll(['srptOptions_v3', 'orders_v1_n']);
  } catch (ec) {}

  return jsonOut_({ ok: true, written: toWrite.length, skippedDupInFile: skippedDupInFile, skippedExisting: skippedExisting, dedupedAfter: dedupRes.deleted });
}

// Da ngung ho tro thay toan bo du lieu don hang tu client (truoc day dung khi dong bo
// hang loat tu Sasum). DT TONG gio la sheet duoc nhan vien quan ly truc tiep — ghi de
// toan bo se rat nguy hiem (mat cot Giao cho/Giai doan... ma noi bo dang dung hang ngay).
function replaceOrders_(orders, data) {
  return jsonOut_({ ok: false, error: 'Da ngung ho tro thay toan bo don hang (replaceOrders). DT TONG gio duoc quan ly truc tiep tren Google Sheet — dung sua/xoa tung dong qua patchOrder/deleteOrder thay vi ghi de ca sheet.' });
}

// DT TONG khong co cot rieng danh cho "careCS" (CS phu trach cham soc sau ban hang cho
// tung don) — khac voi CareData.cs (CS phu trach chung 1 khach) van hoat dong binh thuong.
// Tam thoi bao loi ro rang thay vi im lang khong lam gi, de tranh CS tuong nham la da luu.
function setOrderCareCS_(phone, careCS) {
  return jsonOut_({ ok: false, updated: 0, error: 'Tinh nang gan careCS rieng cho tung don khong con duoc ho tro sau khi chuyen sang DT TONG (khong co cot luu). CS phu trach chung 1 khach van dung binh thuong o CareData.' });
}

function setOrderCareCSBatch_(updates) {
  return jsonOut_({ ok: false, updated: 0, error: 'Tinh nang gan careCS rieng cho tung don khong con duoc ho tro sau khi chuyen sang DT TONG (khong co cot luu). CS phu trach chung 1 khach van dung binh thuong o CareData.' });
}


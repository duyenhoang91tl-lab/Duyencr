// ═══════════════════════════════════════════════════════════════
//  LUU TRU DON CU (yeu cau Duyen 2026-10-08): chuyen don cu hon 6–12 thang tu "DT TỔNG " va "dữ liệu đơn"
//  sang 2 sheet luu tru CUNG spreadsheet (DT_SS_ID) de bao cao hang ngay doc it dong hon.
//  An toan: (1) mac dinh DRY-RUN, chi dem; (2) COPY sang sheet luu tru -> DOI CHIEU lai tung o -> moi XOA
//  khoi sheet goc (sai 1 o la huy, xoa ban copy, KHONG xoa goc); (3) chi chay khi co adminKey + khoa script;
//  (4) moi lan chay gioi han so dong/so khoi xoa de khong vuot 6 phut giua chung (copy xong ma chua xoa het
//  se gay trung khi chay lai).
//  TIEN DO (xem docs/ARCHIVE-PLAN.md): buoc 1 = ham luu tru + dry-run (xong). Buoc 2 = cac ham doc lich su khach
//  (lookup/allCustomers/donStats) + bao cao co khoang ngay cu phai doc them sheet luu tru; CHUA xong thi
//  ARCHIVE_APPLY_ENABLED_ = false nen chay that bi tu choi — tranh mat lich su khach.
// ═══════════════════════════════════════════════════════════════
var ARCHIVE_SUFFIX_ = '_LƯU TRỮ';
var ARCHIVE_LOG_SHEET_ = '_ARCHIVE_LOG';
var ARCHIVE_DEFAULT_MONTHS_ = 12;
var ARCHIVE_MIN_MONTHS_ = 6;
var ARCHIVE_MAX_ROWS_PER_RUN_ = 20000;
var ARCHIVE_MAX_DELETE_RUNS_ = 300;
var ARCHIVE_APPLY_ENABLED_ = false; // bat len true CHI KHI buoc 2 (doc lich su ca sheet luu tru) da xong

// Ngay -> so yyyymmdd (0 neu khong doc duoc). Date: theo gio VN co dinh (_vnYmdParts_); chuoi: dd/MM/yyyy[ ...].
function _arcYmd_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var p = _vnYmdParts_(v);
    return p ? p.y * 10000 + p.mo * 100 + p.d : 0;
  }
  var m = String(v == null ? '' : v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 0;
  var d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return 0;
  return y * 10000 + mo * 100 + d;
}

// Moc cat: hom nay (gio VN) lui `months` thang -> yyyymmdd. Don co ngay < moc cat moi bi luu tru.
function _arcCutoffYmd_(months) {
  var p = _vnYmdParts_(new Date());
  var mo = p.mo - months, y = p.y;
  while (mo < 1) { mo += 12; y--; }
  var dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return y * 10000 + mo * 100 + Math.min(p.d, dim);
}

function _arcMonths_(months) {
  var m = parseInt(months, 10);
  if (!m || isNaN(m)) m = parseInt(getSetting_('archiveMonths'), 10) || ARCHIVE_DEFAULT_MONTHS_;
  return Math.max(ARCHIVE_MIN_MONTHS_, m);
}

// Chon cac dong (index 0-based trong vals) can luu tru. kind: 'base' (DT TONG) | 'pos' (du lieu don).
// base: dong du lieu that (co SDT/ID/gia tri don) va MOI ngay doc duoc (cot A ngayTao, cot K thoiGianHT) deu < moc cat;
//       khong doc duoc ngay nao -> GIU.
// pos : ngay = cot B, dong thieu ngay ke thua ngay dong co ngay gan nhat phia tren (y het readDonChiTiet_), nen dong
//       noi tiep luon di cung dong cha; dong khong phai don (rong/"Tong") -> GIU.
function _arcPickRows_(vals, kind, cutoff) {
  var picked = [], runs = 0, prev = -2, lastYmd = 0, oldest = 0, newest = 0;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i], ymd = 0, real = false;
    if (kind === 'base') {
      real = !!(r[DT_COL_PHONE] || r[DT_COL_ID] || r[DT_COL_GIATRIDON]);
      if (real) {
        var a = _arcYmd_(r[DT_COL_NGAYTAO]), k = _arcYmd_(r[DT_COL_THOIGIANHT]);
        ymd = Math.max(a, k);
      }
    } else {
      real = !!(r[1] || r[3] || (r[DON_COL_GHICHU] && String(r[DON_COL_GHICHU]).trim()));
      if (real) {
        var b = _arcYmd_(r[1]);
        if (b) lastYmd = b; else b = lastYmd;
        ymd = b;
      }
    }
    if (!real || !ymd || ymd >= cutoff) continue;
    if (picked.length >= ARCHIVE_MAX_ROWS_PER_RUN_) break;
    var newRun = (i !== prev + 1);
    if (newRun && runs >= ARCHIVE_MAX_DELETE_RUNS_) break;
    if (newRun) runs++;
    picked.push(i); prev = i;
    if (!oldest || ymd < oldest) oldest = ymd;
    if (ymd > newest) newest = ymd;
  }
  return { idx: picked, runs: runs, oldest: oldest, newest: newest };
}

function _arcSig_(row) { return row.map(function(v) { return String(v); }).join('\u0001'); }

// Chong Sheets tu doi chuoi giong so/ngay/cong thuc khi setValues (vd "0912..." mat so 0, "08/10/2026" thanh ngay).
function _arcSafeCell_(v) {
  return (typeof v === 'string' && v !== '' && /^['0-9=+\-]/.test(v)) ? "'" + v : v;
}

function _arcLogRow_(ss, arr) {
  try {
    var lg = ss.getSheetByName(ARCHIVE_LOG_SHEET_);
    if (!lg) { lg = ss.insertSheet(ARCHIVE_LOG_SHEET_); lg.appendRow(['Thoi gian', 'Sheet goc', 'So thang', 'Moc cat (yyyymmdd)', 'So dong chuyen', 'Dong dau trong luu tru', 'Ghi chu']); }
    lg.appendRow(arr);
  } catch (e) { Logger.log('_arcLogRow_: ' + e); }
}

// 1 sheet: kind 'base'|'pos'. apply=false -> chi dem. Tra ve object ket qua (khong jsonOut).
function _arcOneSheet_(ss, sheetName, kind, cutoff, months, apply) {
  var res = { sheet: sheetName, archiveSheet: sheetName.replace(/\s+$/, '') + ARCHIVE_SUFFIX_, kind: kind };
  var sh = ss.getSheetByName(sheetName);
  if (!sh) { res.error = 'Khong thay sheet ' + sheetName; return res; }
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  res.totalRows = Math.max(0, last - 1);
  if (last < 2) { res.toArchive = 0; return res; }
  var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
  var pick = _arcPickRows_(vals, kind, cutoff);
  res.toArchive = pick.idx.length; res.deleteRuns = pick.runs;
  res.oldestYmd = pick.oldest; res.newestYmd = pick.newest;
  res.capped = pick.idx.length >= ARCHIVE_MAX_ROWS_PER_RUN_ || pick.runs >= ARCHIVE_MAX_DELETE_RUNS_;
  if (!apply || !pick.idx.length) return res;

  var n = pick.idx.length;
  var block = pick.idx.map(function(i) { return vals[i]; });
  var sigs = block.map(_arcSig_);
  var arch = ss.getSheetByName(res.archiveSheet);
  if (!arch) {
    arch = ss.insertSheet(res.archiveSheet);
    sh.getRange(1, 1, 1, lastCol).copyTo(arch.getRange(1, 1, 1, lastCol)); // tieu de + dinh dang tieu de
  }
  var startRow = arch.getLastRow() + 1;
  if (startRow < 2) startRow = 2;
  if (arch.getMaxRows() < startRow + n - 1) arch.insertRowsAfter(arch.getMaxRows(), startRow + n - 1 - arch.getMaxRows());
  if (arch.getMaxColumns() < lastCol) arch.insertColumnsAfter(arch.getMaxColumns(), lastCol - arch.getMaxColumns());
  for (var s = 0; s < n; s += 5000) {
    var chunk = block.slice(s, s + 5000).map(function(row) { return row.map(_arcSafeCell_); });
    arch.getRange(startRow + s, 1, chunk.length, lastCol).setValues(chunk);
  }
  SpreadsheetApp.flush();
  // DOI CHIEU tung o ban copy voi goc truoc khi xoa
  var back = arch.getRange(startRow, 1, n, lastCol).getValues(), bad = 0;
  for (var q = 0; q < n; q++) { if (_arcSig_(back[q]) !== sigs[q]) bad++; }
  if (bad) {
    arch.getRange(startRow, 1, n, lastCol).clearContent();
    res.error = 'Doi chieu loi ' + bad + '/' + n + ' dong -> HUY, da xoa ban copy, KHONG xoa du lieu goc.';
    return res;
  }
  // Goc co the vua bi sua/chen dong trong luc ta xu ly -> doc lai & so sanh dung vi tri truoc khi xoa
  var cur = sh.getRange(2, 1, Math.min(sh.getLastRow() - 1, last - 1), lastCol).getValues();
  for (var c = 0; c < n; c++) {
    var cr = cur[pick.idx[c]];
    if (!cr || _arcSig_(cr) !== sigs[c]) {
      arch.getRange(startRow, 1, n, lastCol).clearContent();
      res.error = 'Sheet goc vua bi thay doi trong luc luu tru (dong ' + (pick.idx[c] + 2) + ') -> HUY, da xoa ban copy, KHONG xoa du lieu goc. Chay lai.';
      return res;
    }
  }
  // Xoa tu duoi len theo tung khoi lien tiep
  var runsArr = [], st = pick.idx[0], pv = st;
  for (var k = 1; k < n; k++) { if (pick.idx[k] === pv + 1) { pv = pick.idx[k]; } else { runsArr.push([st, pv]); st = pick.idx[k]; pv = st; } }
  runsArr.push([st, pv]);
  for (var z = runsArr.length - 1; z >= 0; z--) sh.deleteRows(runsArr[z][0] + 2, runsArr[z][1] - runsArr[z][0] + 1);
  res.archived = n; res.archiveStartRow = startRow;
  _arcLogRow_(ss, [new Date(), sheetName, months, cutoff, n, startRow, 'OK']);
  return res;
}

// opts: { months, dryRun (mac dinh true), which: 'base'|'pos'|'both' (mac dinh both) }
function archiveOldOrders_(opts) {
  opts = opts || {};
  var months = _arcMonths_(opts.months);
  var cutoff = _arcCutoffYmd_(months);
  var apply = opts.dryRun === false || opts.dryRun === 'false' || opts.dryRun === 0 || opts.dryRun === '0';
  var out = { ok: true, months: months, cutoffYmd: cutoff, dryRun: !apply, sheets: [] };
  if (apply && !ARCHIVE_APPLY_ENABLED_) {
    out.ok = false; out.dryRun = true;
    out.error = 'Chua cho phep chay that: cac ham doc lich su khach/bao cao chua doc sheet luu tru (xem docs/ARCHIVE-PLAN.md). Chi dung dryRun.';
    apply = false;
  }
  var which = opts.which || 'both';
  var lock = null;
  if (apply) { lock = LockService.getScriptLock(); lock.waitLock(30000); }
  try {
    var ss = getDTSS_();
    if (which === 'both' || which === 'base') out.sheets.push(_arcOneSheet_(ss, DT_TONG_SHEET, 'base', cutoff, months, apply));
    if (which === 'both' || which === 'pos')  out.sheets.push(_arcOneSheet_(ss, DON_CHITIET_SHEET, 'pos', cutoff, months, apply));
    if (apply) {
      setSetting_('archiveBoundaryYmd', String(cutoff));
      sbMarkOrdersDirty_('dt', 'archive'); sbMarkOrdersDirty_('don', 'archive');   // Supabase buoc 4b: archive xoa dong khoi Sheet
      try {
        var cache = CacheService.getScriptCache();
        cache.removeAll(['srptOptions_v3', 'orders_v1_n', 'donChiTiet_v4_n', 'don_phones_v6_n']);
      } catch (ec) {}
    }
  } finally { if (lock) lock.releaseLock(); }
  out.sheets.forEach(function(s) { if (s.error) out.ok = false; });
  return out;
}


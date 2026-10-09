// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE (Postgres) — BUOC 2/5 cua docs/SUPABASE-PLAN.md. CHUA doi lookup/saveSingle (khong anh huong extension).
//  Cau hinh: Apps Script -> Project Settings -> Script Properties: SUPABASE_URL (https://xxxx.supabase.co) va
//  SUPABASE_KEY (service_role). KHONG luu key trong Settings sheet / code / chat (Settings sheet de CRM doc duoc).
//  Cac action Supabase deu can adminKey. Backfill chay lap lai den khi done=true (moi lan toi da ~4 phut, con tro o Script Properties).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_BATCH_ = 500;
var SB_TIME_BUDGET_MS_ = 240000;   // Apps Script cat o 6 phut — dung 4 phut roi tra ve de goi lai
var SB_CARE_COLS_ = ['phone','status','zalo','cs','note','schedules','sched_goi','sched_goi_note','sched_sp','sched_sp_note',
  'sched_cs','sched_cs_note','sched_hen','sched_hen_note','updated','kh_status','nick_zalos','birthday','zalo_set_by','name','custom','zalo_phones'];
// Thu tu PHAI giong CARE_HEADERS (22 cot) va supabase/schema.sql — sbCareRowToRec_ map theo vi tri.

function sbCfg_() {
  var pr = PropertiesService.getScriptProperties();
  var url = String(pr.getProperty('SUPABASE_URL') || '').replace(/\/+$/, '');
  var key = String(pr.getProperty('SUPABASE_KEY') || '');
  return { url: url, key: key, ok: !!(url && key) };
}

// Goi REST Supabase. Tra { code, text, json, headers }. Nem loi (KHONG kem key) neu HTTP >= 300.
function sb_(method, path, body, extraHeaders) {
  var cfg = sbCfg_();
  if (!cfg.ok) throw new Error('Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.');
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  var k;
  if (extraHeaders) for (k in extraHeaders) headers[k] = extraHeaders[k];
  var opt = { method: method, headers: headers, muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined && body !== null) opt.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, opt);
  var code = res.getResponseCode(), text = res.getContentText() || '';
  if (code >= 300) throw new Error('Supabase HTTP ' + code + ' (' + method + ' ' + String(path).split('?')[0] + '): ' + text.slice(0, 300));
  var json = null;
  if (text) { try { json = JSON.parse(text); } catch (eJ) {} }
  return { code: code, text: text, json: json, headers: res.getAllHeaders ? res.getAllHeaders() : {} };
}

function _sbCell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v);
}

// 1 dong sheet CareData (mang 22 o) -> object cot Supabase. null neu khong co SDT hop le.
function sbCareRowToRec_(row) {
  var phone = normPhone_(_sbCell_(row[0]));
  if (!phone) return null;
  var rec = {};
  for (var i = 0; i < SB_CARE_COLS_.length; i++) rec[SB_CARE_COLS_[i]] = _sbCell_(row[i]);
  rec.phone = phone;
  if (!rec.nick_zalos) rec.nick_zalos = '[]';
  if (!rec.zalo_phones) rec.zalo_phones = '[]';
  var d = rec.updated ? new Date(rec.updated) : null;
  rec.updated_at = (d && !isNaN(d.getTime())) ? d.toISOString() : new Date().toISOString();
  return rec;
}

// Kiem tra ket noi Supabase (doc 1 dong care_data). KHONG tra key. Dung cho action sbPing va trigger hang ngay.
function sbPing_() {
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, configured: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var t0 = Date.now();
  try {
    sb_('GET', 'care_data?select=phone&limit=1');
    return { ok: true, configured: true, ms: Date.now() - t0 };
  } catch (e) { return { ok: false, configured: true, error: String(e && e.message || e) }; }
}

// Trigger hang ngay: Supabase free tu pause sau 7 ngay khong hoat dong -> goi nhe moi ngay de giu hoat dong.
// Chay 1 lan thu cong: chon ham caiTriggerSbPing trong Apps Script Editor -> Run (xem log).
function sbPingTick_() { Logger.log('sbPing ' + JSON.stringify(sbPing_())); }
function installSbPingTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sbPingTick_'; });
  if (ex.length) return 'Trigger "sbPingTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('sbPingTick_').timeBased().everyDays(1).create();
  return 'Da tao trigger sbPingTick_ chay moi ngay (giu Supabase free khong bi pause).';
}
function caiTriggerSbPing() { Logger.log(installSbPingTrigger_()); }

// Day CareData len Supabase theo lo SB_BATCH_ dong, upsert theo phone, co con tro resume (Script Properties SB_CARE_CURSOR = so dong ke tiep).
// opts: { dryRun (mac dinh TRUE = chi dem, khong ghi, khong dich con tro), reset (ve dong 2) }. Goi lai den khi done=true.
// SDT trung nhieu dong: CHI day dong DAU TIEN cua moi SDT (giong saveSingleCare_ va sbCompareCare_), dong sau tinh vao dupSkipped.
// Luu y: neu co dong bi chen/xoa phia tren con tro giua 2 lan goi thi con tro lech -> chay lai voi reset:true roi sbCompareCare.
function sbBackfillCare_(opts) {
  opts = opts || {};
  var dryRun = opts.dryRun !== false && opts.dryRun !== 'false';
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'Dang co lan backfill/ghi khac chay — thu lai sau.' };
  var t0 = Date.now();
  try {
    var pr = PropertiesService.getScriptProperties();
    if (opts.reset === true || opts.reset === 'true') pr.deleteProperty('SB_CARE_CURSOR');
    var cursor = parseInt(pr.getProperty('SB_CARE_CURSOR') || '2', 10);
    if (!(cursor >= 2)) cursor = 2;
    var sh = getSheet_(SH_CARE, CARE_HEADERS);
    var last = sh.getLastRow();
    // Dong dau tien cua moi SDT (1 lan doc cot A) de bo cac dong trung xuyen suot cac lo.
    var firstRow = {};
    if (last >= 2) {
      var colA = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var ci = 0; ci < colA.length; ci++) {
        var pc = normPhone_(_sbCell_(colA[ci][0]));
        if (pc && firstRow[pc] === undefined) firstRow[pc] = ci + 2;
      }
    }
    var st = { pushed: 0, dupSkipped: 0, skippedNoPhone: 0, batches: 0 };
    // Luon chay it nhat 1 lo moi lan goi (st.batches===0) de chac chan co tien trien du doc cot A da ton het ngan sach.
    while (cursor <= last && (st.batches === 0 || (Date.now() - t0) < SB_TIME_BUDGET_MS_)) {
      var n = Math.min(SB_BATCH_, last - cursor + 1);
      var vals = sh.getRange(cursor, 1, n, CARE_HEADERS.length).getValues();
      var recs = [];
      for (var i = 0; i < vals.length; i++) {
        var rec = sbCareRowToRec_(vals[i]);
        if (!rec) { st.skippedNoPhone++; continue; }
        if (firstRow[rec.phone] !== cursor + i) { st.dupSkipped++; continue; }
        recs.push(rec);
      }
      if (recs.length && !dryRun) {
        sb_('POST', 'care_data?on_conflict=phone', recs, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      }
      st.pushed += recs.length; st.batches++;
      cursor += n;
      if (!dryRun) pr.setProperty('SB_CARE_CURSOR', String(cursor));   // dryRun KHONG dich con tro; lo loi thi nhay vao catch, con tro giu nguyen
    }
    var done = cursor > last;
    return { ok: true, dryRun: dryRun, done: done, nextRow: cursor, lastRow: last, pushed: st.pushed, batches: st.batches,
      dupSkipped: st.dupSkipped, skippedNoPhone: st.skippedNoPhone, ms: Date.now() - t0,
      hint: dryRun ? 'Day la chay thu (chua ghi). Gui dryRun:false de ghi that.' : (done ? 'Xong. Chay sbCompareCare de doi chieu.' : 'Chua het — goi lai action nay (dryRun:false) de tiep tuc.') };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { try { lock.releaseLock(); } catch (eL) {} }
}

function _sbHeader_(headers, name) {
  var low = String(name).toLowerCase();
  for (var k in headers) if (String(k).toLowerCase() === low) return headers[k];
  return '';
}

// Doi chieu CareData (Sheet) vs care_data (Supabase): (1) so SDT khac nhau tren Sheet == so dong Supabase, (2) so sanh TUNG TRUONG tren
// mau rai deu cac dong dau tien cua moi SDT. opts.sample (mac dinh 100, toi da 300). ok=true chi khi (1) khop va khong co lech o (2).
// Day la doi chieu theo mau (khong phai checksum toan bang): muon chac hon thi tang sample hoac chay nhieu lan sau khi backfill xong.
function sbCompareCare_(opts) {
  opts = opts || {};
  var sample = Math.max(1, Math.min(300, parseInt(opts.sample, 10) || 100));
  try {
    var sh = getSheet_(SH_CARE, CARE_HEADERS);
    var last = sh.getLastRow();
    var rows = Math.max(0, last - 1), distinct = {}, nDistinct = 0, noPhone = 0, picks = [];
    if (rows) {
      var col = sh.getRange(2, 1, rows, 1).getValues();
      for (var i = 0; i < col.length; i++) {
        var p = normPhone_(_sbCell_(col[i][0]));
        if (!p) { noPhone++; continue; }
        if (!distinct[p]) { distinct[p] = i + 2; nDistinct++; }   // dong DAU tien cua moi SDT
      }
      var firstRows = []; for (var ph in distinct) firstRows.push(distinct[ph]);
      firstRows.sort(function (a, b) { return a - b; });
      var step = Math.max(1, Math.floor(firstRows.length / sample));
      for (var s = 0; s < firstRows.length && picks.length < sample; s += step) picks.push(firstRows[s]);
    }
    // limit=1 + count=exact -> Content-Range "0-0/N" (hoac "*/0" khi bang rong); khong dung header Range de tranh 416 tren bang rong.
    var res = sb_('GET', 'care_data?select=phone&limit=1', null, { Prefer: 'count=exact' });
    var cr = String(_sbHeader_(res.headers, 'content-range') || ''), m = cr.match(/\/(\d+)$/);
    var sbCount = m ? parseInt(m[1], 10) : -1;
    var checked = 0, mismatches = [];
    for (var b = 0; b < picks.length; b += 50) {
      var chunk = picks.slice(b, b + 50), recs = {}, inList = [];
      for (var c = 0; c < chunk.length; c++) {
        var rec = sbCareRowToRec_(sh.getRange(chunk[c], 1, 1, CARE_HEADERS.length).getValues()[0]);
        if (rec) { recs[rec.phone] = rec; inList.push('"' + rec.phone + '"'); }
      }
      if (!inList.length) continue;
      var got = sb_('GET', 'care_data?select=*&phone=in.(' + encodeURIComponent(inList.join(',')) + ')').json || [];
      var byPhone = {}; got.forEach(function (g) { byPhone[g.phone] = g; });
      for (var ph2 in recs) {
        checked++;
        var g2 = byPhone[ph2];
        if (!g2) { mismatches.push({ phone: ph2, problem: 'thieu tren Supabase' }); continue; }
        var diff = [];
        SB_CARE_COLS_.forEach(function (colName) { if (String(g2[colName] == null ? '' : g2[colName]) !== recs[ph2][colName]) diff.push(colName); });
        if (diff.length) mismatches.push({ phone: ph2, problem: 'khac cot', cols: diff });
      }
    }
    return { ok: (sbCount === nDistinct && mismatches.length === 0), sheetRows: rows, sheetDistinctPhones: nDistinct, sheetNoPhone: noPhone,
      supabaseRows: sbCount, sampleChecked: checked, mismatches: mismatches.slice(0, 20), mismatchCount: mismatches.length };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 3/5: GHI SONG SONG (dual-write) CareData + DOC lookup tu Supabase (3a: ha tang; 3b: noi vao cac ham ghi; 3c: lookup)
//  Che do luu o Script Property SB_MODE (KHONG dung Settings sheet: getSetting_ doc ca sheet Settings, co ca cac manh ma GAS rat lon,
//  qua nang cho duong luu cua CS):  'off' (mac dinh, khong lam gi) | 'write' (ghi Sheets roi mirror sang Supabase, van DOC Sheets) |
//  'read' (nhu 'write' + lookup doc Supabase). Doi bang action POST sbSetMode (adminKey). Rollback = sbSetMode mode:'off'.
//  NGUYEN TAC: Sheets van la nguon that. Mirror loi KHONG BAO GIO lam hong thao tac luu — chi ghi log + danh dau:
//    - SB_DIRTY_CARE: danh sach SDT mirror loi (toi da SB_DIRTY_MAX_). lookup cac SDT nay van doc Sheets. Sua bang action sbResyncCare.
//    - SB_STALE: Supabase co the LECH dien rong (ghi de ca sheet, dedupe, qua nhieu dong, khong khoa duoc...). Dang STALE thi lookup KHONG
//      doc Supabase. Go bang: backfill lai (reset:true) + sbCompareCare ok:true roi sbSetMode mode:'read' clearStale:true.
//  Thu tu bat an toan: sbSetMode 'write' -> sbBackfillCare (dryRun:false, lap den done) -> sbCompareCare ok:true -> sbSetMode 'read' clearStale:true.
//  Biet truoc: SDT trung nhieu dong tren Sheet (chay dedupeCare TRUOC khi backfill) va sua tay truc tiep tren Sheet KHONG duoc mirror
//  (khong co onEdit) -> sbCompareCare se lo ra.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_MIRROR_MAX_ = 2000;          // toi da so dong cho 1 lan mirror (= 4 lo SB_BATCH_); vuot -> danh dau STALE thay vi ghi
var SB_DIRTY_MAX_ = 300;            // toi da so SDT trong danh sach dirty (Script Property gioi han ~9KB); vuot -> STALE
var SB_READ_FALLBACK_ON_MISS_ = true; // lookup o che do 'read': Supabase khong co SDT -> doc them Sheets cho chac (dat false khi da tin Supabase)

function sbMode_() {
  var m = '';
  try { m = String(PropertiesService.getScriptProperties().getProperty('SB_MODE') || '').toLowerCase(); } catch (e) {}
  return (m === 'write' || m === 'read') ? m : 'off';
}
// Co can mirror ghi sang Supabase khong (che do != off VA da cau hinh URL/key).
function sbWriteOn_() { return sbMode_() !== 'off' && sbCfg_().ok; }

function sbStaleInfo_() { try { return PropertiesService.getScriptProperties().getProperty('SB_STALE') || ''; } catch (e) { return ''; } }
function sbMarkStale_(why) {
  try { PropertiesService.getScriptProperties().setProperty('SB_STALE', new Date().toISOString() + ' ' + String(why || '').slice(0, 200)); } catch (e) {}
}
function sbDirtyList_() {
  var a = [];
  try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty('SB_DIRTY_CARE') || '[]'); } catch (e) { a = []; }
  return Array.isArray(a) ? a : [];
}
// Them SDT vao danh sach dirty (can khoa de tranh 2 luot ghi de nhau). Khong khoa duoc -> danh dau STALE (an toan hon la mat dau).
function sbMarkDirty_(phones, why) {
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(3000); } catch (e) { got = false; }
  try {
    if (!got) { sbMarkStale_('khong khoa duoc de ghi dirty: ' + why); return; }
    var set = {};
    sbDirtyList_().forEach(function (p) { set[p] = 1; });
    (phones || []).forEach(function (p) { if (p) set[p] = 1; });
    var list = Object.keys(set);
    if (list.length > SB_DIRTY_MAX_) { sbMarkStale_('qua nhieu dong dirty (' + list.length + '): ' + why); return; }
    PropertiesService.getScriptProperties().setProperty('SB_DIRTY_CARE', JSON.stringify(list));
  } finally { if (got) { try { lock.releaseLock(); } catch (e2) {} } }
}

function _sbInList_(phones) {
  return encodeURIComponent(phones.map(function (p) { return '"' + p + '"'; }).join(','));
}
// Moi SDT 1 rec: rec SAU CUNG thang (dung noi dung vua ghi), giu thu tu xuat hien dau tien.
function _sbUniqByPhone_(recs) {
  var m = {}, order = [];
  (recs || []).forEach(function (r) { if (!r || !r.phone) return; if (m[r.phone] === undefined) order.push(r.phone); m[r.phone] = r; });
  return order.map(function (p) { return m[p]; });
}
// Cac dong sheet (mang 22 o) -> mang rec Supabase (bo dong khong co SDT).
function sbRowsToRecs_(rows) {
  var out = [];
  (rows || []).forEach(function (r) { var rec = sbCareRowToRec_(r); if (rec) out.push(rec); });
  return out;
}

// Mirror cac rec DAY DU (22 cot) sang care_data. KHONG BAO GIO nem loi ra ngoai. Tra true neu da ghi / khong can ghi.
// Phai goi SAU KHI da ghi Sheets xong (va sau khi nha khoa script neu ham ghi dang giu khoa).
function sbMirrorCare_(recs, why) {
  try {
    if (!recs || !recs.length || !sbWriteOn_()) return true;
    recs = _sbUniqByPhone_(recs);
    if (recs.length > SB_MIRROR_MAX_) { sbMarkStale_('mirror ' + recs.length + ' dong > ' + SB_MIRROR_MAX_ + ' (' + why + ')'); return false; }
    for (var i = 0; i < recs.length; i += SB_BATCH_) {
      var chunk = recs.slice(i, i + SB_BATCH_);
      try {
        sb_('POST', 'care_data?on_conflict=phone', chunk, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      } catch (e) {
        sbMarkDirty_(recs.slice(i).map(function (r) { return r.phone; }), why);
        try { Logger.log('sbMirrorCare_ (' + why + ') loi: ' + String(e && e.message || e)); } catch (el) {}
        return false;
      }
    }
    return true;
  } catch (e0) {
    try { sbMarkStale_('sbMirrorCare_ ngoai le (' + why + '): ' + String(e0 && e0.message || e0)); } catch (e1) {}
    return false;
  }
}

// Cap nhat 1 so TRUONG cho cac dong DA CO tren Supabase (PATCH; dong chua co thi bi bo qua, KHONG tao dong thieu cot nhu upsert mot phan).
// Dung cho ham chi doi vai cot tren nhieu dong (vd _aaSetCareCS_: cs + updated). Khong nem loi ra ngoai.
function sbPatchCare_(phones, fields, why) {
  try {
    if (!phones || !phones.length || !sbWriteOn_()) return true;
    for (var i = 0; i < phones.length; i += 100) {
      var chunk = phones.slice(i, i + 100);
      try {
        sb_('PATCH', 'care_data?phone=in.(' + _sbInList_(chunk) + ')', fields, { Prefer: 'return=minimal' });
      } catch (e) {
        sbMarkDirty_(phones.slice(i), why);
        try { Logger.log('sbPatchCare_ (' + why + ') loi: ' + String(e && e.message || e)); } catch (el) {}
        return false;
      }
    }
    return true;
  } catch (e0) {
    try { sbMarkStale_('sbPatchCare_ ngoai le (' + why + '): ' + String(e0 && e0.message || e0)); } catch (e1) {}
    return false;
  }
}

// Sua cac SDT dirty: doc lai DONG DAU cua tung SDT tu Sheets va upsert len Supabase; SDT khong con tren Sheets -> xoa khoi Supabase.
function sbResyncCare_() {
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'Dang co lan backfill/ghi khac chay — thu lai sau.' };
  try {
    var dirty = sbDirtyList_();
    var out = { ok: true, dirtyBefore: dirty.length, resynced: 0, removed: 0, stale: sbStaleInfo_() || null };
    if (!dirty.length) return out;
    var want = {}; dirty.forEach(function (p) { want[p] = 1; });
    var sh = getSheet_(SH_CARE, CARE_HEADERS), last = sh.getLastRow(), rowOf = {};
    if (last >= 2) {
      var colA = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < colA.length; i++) {
        var p = normPhone_(_sbCell_(colA[i][0]));
        if (p && want[p] && rowOf[p] === undefined) rowOf[p] = i + 2;
      }
    }
    var recs = [], gone = [];
    dirty.forEach(function (ph) {
      if (rowOf[ph] === undefined) { gone.push(ph); return; }
      var rec = sbCareRowToRec_(sh.getRange(rowOf[ph], 1, 1, CARE_HEADERS.length).getValues()[0]);
      if (rec) recs.push(rec); else gone.push(ph);
    });
    for (var b = 0; b < recs.length; b += SB_BATCH_) {
      sb_('POST', 'care_data?on_conflict=phone', recs.slice(b, b + SB_BATCH_), { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    for (var g = 0; g < gone.length; g += 100) {
      sb_('DELETE', 'care_data?phone=in.(' + _sbInList_(gone.slice(g, g + 100)) + ')', null, { Prefer: 'return=minimal' });
    }
    PropertiesService.getScriptProperties().deleteProperty('SB_DIRTY_CARE');   // dang giu khoa nen khong co ai them dirty xen vao
    out.resynced = recs.length; out.removed = gone.length;
    return out;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { try { lock.releaseLock(); } catch (eL) {} }
}

function sbStatus_() {
  var dirty = sbDirtyList_();
  return { ok: true, mode: sbMode_(), configured: sbCfg_().ok, stale: sbStaleInfo_() || null, dirtyCount: dirty.length, dirtySample: dirty.slice(0, 10) };
}

// Doi che do. mode: 'off' | 'write' | 'read'. 'read' khi dang STALE bi tu choi tru khi clearStale:true (nguoi dung xac nhan da backfill + compare ok).
function sbSetMode_(mode, clearStale) {
  mode = String(mode || '').toLowerCase();
  if (mode !== 'off' && mode !== 'write' && mode !== 'read') return { ok: false, error: "mode phai la 'off', 'write' hoac 'read'." };
  if (mode !== 'off' && !sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var pr = PropertiesService.getScriptProperties();
  var clear = (clearStale === true || clearStale === 'true');
  if (mode === 'read' && sbStaleInfo_() && !clear) {
    return { ok: false, error: 'Supabase dang STALE (' + sbStaleInfo_() + '). Backfill lai (reset:true) + sbCompareCare ok:true roi goi lai voi clearStale:true.' };
  }
  if (clear) pr.deleteProperty('SB_STALE');
  pr.setProperty('SB_MODE', mode);
  return sbStatus_();
}

// Doc cac dong sheet CareData theo SO DONG (1-based) -> mang dong 22 o. Gom cac dong lien nhau thanh 1 lan doc; qua phan tan thi doc 1 doan
// bao ca (toi da 20000 dong). Tra null neu khong doc duoc gon (caller danh dau STALE).
function sbReadSheetRows_(sh, rowNums) {
  var W = CARE_HEADERS.length, nums = rowNums.slice().sort(function (a, b) { return a - b; }), runs = [], i = 0;
  while (i < nums.length) {
    var j = i;
    while (j + 1 < nums.length && nums[j + 1] <= nums[j] + 1) j++;
    runs.push([nums[i], nums[j]]); i = j + 1;
  }
  var out = [], k;
  if (runs.length > 40) {
    var lo = nums[0], hi = nums[nums.length - 1];
    if (hi - lo + 1 > 20000) return null;
    var span = sh.getRange(lo, 1, hi - lo + 1, W).getValues(), seen = {};
    for (k = 0; k < nums.length; k++) { if (!seen[nums[k]]) { seen[nums[k]] = 1; out.push(span[nums[k] - lo]); } }
    return out;
  }
  for (k = 0; k < runs.length; k++) {
    var vals = sh.getRange(runs[k][0], 1, runs[k][1] - runs[k][0] + 1, W).getValues();
    for (var v = 0; v < vals.length; v++) out.push(vals[v]);
  }
  return out;
}

// Mirror cac dong VUA GHI tren Sheet: rowNums = dong da sua (doc lai tu Sheet de lay dung noi dung), newRows = dong moi (mang 22 o).
function sbMirrorSheetRows_(sh, rowNums, newRows, why) {
  try {
    if (!sbWriteOn_()) return true;
    var rows = [];
    if (rowNums && rowNums.length) {
      rows = sbReadSheetRows_(sh, rowNums);
      if (rows === null) { sbMarkStale_('khong doc gon duoc ' + rowNums.length + ' dong de mirror (' + why + ')'); return false; }
    }
    return sbMirrorCare_(sbRowsToRecs_(rows.concat(newRows || [])), why);
  } catch (e) {
    try { sbMarkStale_('sbMirrorSheetRows_ ngoai le (' + why + '): ' + String(e && e.message || e)); } catch (e2) {}
    return false;
  }
}

// Object cot Supabase -> object care (cung dinh dang findCareByPhone_ cu, de KHONG phai sua 2 extension / index.html).
function sbRecToCareObj_(g) {
  var row = [];
  for (var i = 0; i < SB_CARE_COLS_.length; i++) row.push(g[SB_CARE_COLS_[i]] == null ? '' : g[SB_CARE_COLS_[i]]);
  return careObjFromRow_(row);
}

// 3c: tra cuu 1 SDT tu Supabase. Tra UNDEFINED = "hay doc Sheets nhu cu" khi: khong o che do 'read', dang STALE, SDT dang dirty,
// Supabase loi, hoac Supabase khong co SDT do (SB_READ_FALLBACK_ON_MISS_). Tra object care khi tim thay.
function sbReadCare_(phone) {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_MODE || '').toLowerCase() !== 'read' || pr.SB_STALE || !sbCfg_().ok) return undefined;
    var ph = normPhone_(phone);
    if (!ph) return undefined;
    var dirty = [];
    try { dirty = JSON.parse(pr.SB_DIRTY_CARE || '[]'); } catch (e0) { dirty = []; }
    if (dirty.indexOf(ph) !== -1) return undefined;
    var res = sb_('GET', 'care_data?select=*&phone=eq.' + encodeURIComponent(ph) + '&limit=1');
    var g = res.json && res.json[0];
    if (!g) return SB_READ_FALLBACK_ON_MISS_ ? undefined : null;
    return sbRecToCareObj_(g);
  } catch (e) {
    try { Logger.log('sbReadCare_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  CHAY TAY TU APPS SCRIPT EDITOR — khong can adminKey / URL. Chon ten ham o o "Run" phia tren, bam Run, xem ket qua o "Execution log".
//  (Cac action sbSetMode / sbBackfillCare... la action cua web app, KHONG hien trong o Run vi ten ham ket thuc bang dau gach duoi.)
//  Thu tu bat: 1) runDedupeCare  2) sbKiemTraKetNoi  3) sbBatGhiSongSong  4) sbBackfillThat (bam lai den khi log bao XONG)
//              5) sbDoiChieu (phai ok:true)  6) sbBatDocSupabase.   Ve nhu cu bat cu luc nao: sbTatSupabase.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function sbXemTrangThai() { Logger.log(JSON.stringify(sbStatus_(), null, 2)); }
function sbKiemTraKetNoi() { Logger.log(JSON.stringify(sbPing_(), null, 2)); }
function sbBatGhiSongSong() { Logger.log(JSON.stringify(sbSetMode_('write', false), null, 2)); }
function sbBackfillThu() { Logger.log(JSON.stringify(sbBackfillCare_({ dryRun: true }), null, 2)); }
function sbBackfillThat() {
  var r = sbBackfillCare_({ dryRun: false });
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error" o tren.' : (r.done ? 'XONG. Chay tiep sbDoiChieu.' : 'CHUA HET — bam Run lai sbBackfillThat de chay tiep (con tro duoc nho).'));
}
function sbBackfillTuDau() { Logger.log(JSON.stringify(sbBackfillCare_({ dryRun: false, reset: true }), null, 2)); }
function sbDoiChieu() { Logger.log(JSON.stringify(sbCompareCare_({ sample: 300 }), null, 2)); }
function sbSuaSDTLoi() { Logger.log(JSON.stringify(sbResyncCare_(), null, 2)); }
function sbTatSupabase() { Logger.log(JSON.stringify(sbSetMode_('off', false), null, 2)); }
// Chi bat doc tu Supabase khi doi chieu ok:true (tu dong xoa co STALE). Khong ok -> KHONG bat, log ly do.
function sbBatDocSupabase() {
  var c = sbCompareCare_({ sample: 300 });
  if (!c.ok) { Logger.log('KHONG BAT: doi chieu chua khop. ' + JSON.stringify(c, null, 2)); return; }
  Logger.log(JSON.stringify(sbSetMode_('read', true), null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4a/5: BACKFILL don hang "DT TỔNG " -> dt_tong va "dữ liệu đơn" -> don_chi_tiet (Sheets van la nguon that).
//  Cung khuon voi sbBackfillCare_: lo SB_BATCH_ dong, upsert, con tro resume (Script Properties), dryRun mac dinh TRUE, chay lap den done.
//  - dt_tong: khoa (id, src_row), upsert on_conflict=id,src_row. Moi dong luu 20 o goc trong cot raw (Date -> {"__d": epochMs}) de buoc 4c
//    dung lai NGUYEN dtRowToOrder_/readDTTong_ (khong viet lai logic chuyen doi -> khong lech ket qua bao cao).
//  - don_chi_tiet: khoa src_row. Dung CHUNG _donConvertRows_ voi readDonChiTiet_ (quy tac bo dong + ke thua ngay cua dong tren), nen con tro
//    luu them lastNgay (ngay ke thua) de lo sau tiep noi dung lo truoc.
//  - reset:true (khi dryRun:false) XOA SACH bang Supabase tuong ung roi chay lai tu dong 2. Bat buoc khi Sheet da xoa/chen dong ke tu lan backfill
//    truoc (src_row lech -> dong cu nam sai cho). Lo loi giua chung: con tro dung o dau lo loi, goi lai se chay tiep.
//  - KHONG loc theo bo loc "an trang/kenh" (_isDTRowHidden_) o day: day la loc luc DOC (phu thuoc Settings), Supabase luu day du.
//  CHUA noi vao duong ghi/doc nao: bang Supabase chi la ban sao cho den khi lam 4b (dong bo gia tang) va 4c (doc).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_DT_COLS_ = ['id','src_row','ngay_tao','ngay_tao_d','nguoi_tao','giao_cho','phone','giai_doan','trang_thai','thoi_gian_ht','thoi_gian_ht_d',
  'kenh_ban','sale_ban','san_pham','phan_loai','gia_tri_coc','gia_tri_don','gia_tri_chenh','raw','archived'];
var SB_DON_COLS_ = ['src_row','ngay_tao_don','ngay_tao_d','phone','nguon_don','the_sale','san_pham','marketer','gia_tri_sau_giam','ghi_chu','raw','archived'];
var SB_DT_NUM_ = { gia_tri_coc: 1, gia_tri_don: 1, gia_tri_chenh: 1, gia_tri_sau_giam: 1 };

// O sheet (Date/chuoi dd/MM/yyyy[ HH:mm]/chuoi ISO) -> 'yyyy-MM-dd' hoac null. Date doc theo getUTC* y het _dtCellToVnStr_ (de cot *_d luon
// khop chuoi hien thi ngay_tao/thoi_gian_ht tren cung 1 dong). Ngay khong hop le -> null (cot date cho phep null).
function _sbDateIso_(v) {
  if (v === null || v === undefined || v === '') return null;
  var y, mo, d, m;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    y = v.getUTCFullYear(); mo = v.getUTCMonth() + 1; d = v.getUTCDate();
  } else {
    var s = String(v).trim();
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?!\d)/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else return null;
  }
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100)) return null;
  var dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();   // so ngay trong thang
  if (d > dim) return null;
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// O goc -> gia tri JSON an toan de luu trong raw (jsonb): Date -> {"__d": epochMs}; so/boolean/chuoi giu nguyen; null/undefined -> ''.
function _sbRawCell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : { __d: v.getTime() };
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (typeof v === 'boolean') return v;
  return String(v);
}
// Nguoc lai: raw (mang) -> mang dong nhu getValues() tra ve (Date that), de dua lai cho dtRowToOrder_/_donConvertRows_. width = so o can du.
function sbRawToRow_(raw, width) {
  var row = [], a = Array.isArray(raw) ? raw : [];
  for (var i = 0; i < width; i++) {
    var v = a[i];
    row.push((v && typeof v === 'object' && typeof v.__d === 'number') ? new Date(v.__d) : (v === undefined || v === null ? '' : v));
  }
  return row;
}

// 1 dong "DT TỔNG " (mang 20 o) -> rec dt_tong. null neu la dong rong theo DUNG quy tac readDTTong_ (khong SDT, khong id, khong gia tri don).
function sbDtRowToRec_(r, srcRow) {
  if (!r[DT_COL_PHONE] && !r[DT_COL_ID] && !r[DT_COL_GIATRIDON]) return null;
  var raw = [];
  for (var i = 0; i < DT_TONG_WIDTH; i++) raw.push(_sbRawCell_(r[i]));
  return {
    id: (r[DT_COL_ID] === null || r[DT_COL_ID] === undefined) ? '' : String(r[DT_COL_ID]),
    src_row: srcRow,
    ngay_tao: _sbCell_(_dtCellToVnStr_(r[DT_COL_NGAYTAO])),
    ngay_tao_d: _sbDateIso_(r[DT_COL_NGAYTAO]),
    nguoi_tao: r[1] ? String(r[1]).trim() : '',
    giao_cho: _sbCell_(r[DT_COL_GIAOCHO]),
    phone: normPhone_(_sbCell_(r[DT_COL_PHONE])),
    giai_doan: _sbCell_(r[DT_COL_GIAIDOAN]),
    trang_thai: _sbCell_(r[DT_COL_TRANGTHAI]),
    thoi_gian_ht: _sbCell_(_dtCellToVnStr_(r[DT_COL_THOIGIANHT])),
    thoi_gian_ht_d: _sbDateIso_(r[DT_COL_THOIGIANHT]),
    kenh_ban: r[DT_COL_KENHBAN] ? String(r[DT_COL_KENHBAN]).trim() : '',
    sale_ban: r[DT_COL_SALEBAN] ? String(r[DT_COL_SALEBAN]) : '',
    san_pham: _sbCell_(r[DT_COL_SANPHAM]),
    phan_loai: _sbCell_(r[DT_COL_PHANLOAI]),
    gia_tri_coc: _normMoney_(r[DT_COL_GIATRICOC]),
    gia_tri_don: _normMoney_(r[DT_COL_GIATRIDON]),
    gia_tri_chenh: _normMoney_(r[DT_COL_GIATRICHENH]),
    raw: raw,
    archived: false
  };
}

// Cac dong "dữ liệu đơn" -> recs don_chi_tiet, dung _donConvertRows_ (cung quy tac bo dong / ke thua ngay voi readDonChiTiet_).
// st = { lastNgay } tiep noi giua cac lo. Tra { recs, skipped, st }.
function sbDonRowsToRecs_(vals, firstRow, st) {
  var conv = _donConvertRows_(vals, firstRow, st ? st.lastNgay : '');
  var recs = conv.items.map(function (it) {
    var raw = [], r = vals[it.srcRow - firstRow];
    for (var i = 0; i < DON_CHITIET_WIDTH; i++) raw.push(_sbRawCell_(r[i]));
    var o = it.obj;
    return {
      src_row: it.srcRow,
      ngay_tao_don: _sbCell_(o.ngayTaoDon),
      ngay_tao_d: _sbDateIso_(o.ngayTaoDon),
      phone: normPhone_(_sbCell_(o.soDienThoai)),
      nguon_don: o.nguonDon || '',
      the_sale: o.theSale || '',
      san_pham: o.sanPham || '',
      marketer: o.marketer || '',
      gia_tri_sau_giam: o.giaTriSauGiam || 0,
      ghi_chu: o.ghiChu || '',
      raw: raw,
      archived: false
    };
  });
  return { recs: recs, skipped: vals.length - recs.length, st: { lastNgay: conv.lastNgay } };
}

// Dinh nghia 2 bang: ten sheet, bang Supabase, khoa upsert, cot, do rong doc, ham chuyen lo dong -> recs, key de doi chieu.
function _sbOrderDef_(which) {
  if (which === 'dt') return { which: 'dt', sheetName: DT_TONG_SHEET, table: 'dt_tong', conflict: 'id,src_row', cursorKey: 'SB_DT_CURSOR', cols: SB_DT_COLS_,
    width: function () { return DT_TONG_WIDTH; },
    convert: function (vals, firstRow, st) {
      var recs = [];
      for (var i = 0; i < vals.length; i++) { var rec = sbDtRowToRec_(vals[i], firstRow + i); if (rec) recs.push(rec); }
      return { recs: recs, skipped: vals.length - recs.length, st: null };
    } };
  return { which: 'don', sheetName: DON_CHITIET_SHEET, table: 'don_chi_tiet', conflict: 'src_row', cursorKey: 'SB_DON_CURSOR', cols: SB_DON_COLS_,
    width: function (sh) { return Math.min(DON_CHITIET_WIDTH, sh.getMaxColumns()); },
    convert: sbDonRowsToRecs_ };
}

function _sbOpenOrderSheet_(def) {
  var sh = getDTSS_().getSheetByName(def.sheetName);
  if (!sh) throw new Error('Khong tim thay sheet "' + def.sheetName + '" trong spreadsheet don hang (DT_SS_ID).');
  return sh;
}

// Con tro luu dang JSON {row, st}; gia tri cu kieu so thuan van doc duoc.
function _sbGetCursor_(pr, key) {
  var raw = pr.getProperty(key), c = { row: 2, st: null };
  if (raw) { try { var j = JSON.parse(raw); if (j && j.row >= 2) c = { row: j.row, st: j.st || null }; } catch (e) {} }
  return c;
}

// Backfill 1 bang don hang. opts: { dryRun (mac dinh TRUE), reset (xoa bang Supabase + ve dong 2; chi co tac dung khi dryRun:false) }.
function sbBackfillOrders_(which, opts) {
  opts = opts || {};
  var def = _sbOrderDef_(which), dryRun = opts.dryRun !== false && opts.dryRun !== 'false';
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'Dang co lan backfill/ghi khac chay — thu lai sau.' };
  var t0 = Date.now();
  try {
    var pr = PropertiesService.getScriptProperties();
    var wantReset = opts.reset === true || opts.reset === 'true';
    if (wantReset && !dryRun) {
      sb_('DELETE', def.table + '?src_row=gte.0', null, { Prefer: 'return=minimal' });   // xoa sach — dong cu o vi tri cu se khong con ton tai sai cho
      pr.deleteProperty(def.cursorKey);
    }
    var cur = (wantReset && dryRun) ? { row: 2, st: null } : _sbGetCursor_(pr, def.cursorKey);
    var cursor = cur.row, st = cur.st;
    var sh = _sbOpenOrderSheet_(def), last = sh.getLastRow(), width = def.width(sh);
    var tot = { pushed: 0, skipped: 0, batches: 0 };
    while (cursor <= last && (tot.batches === 0 || (Date.now() - t0) < SB_TIME_BUDGET_MS_)) {
      var n = Math.min(SB_BATCH_, last - cursor + 1);
      var vals = sh.getRange(cursor, 1, n, width).getValues();
      var res = def.convert(vals, cursor, st);
      if (res.recs.length && !dryRun) {
        sb_('POST', def.table + '?on_conflict=' + def.conflict, res.recs, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      }
      st = res.st;
      tot.pushed += res.recs.length; tot.skipped += res.skipped; tot.batches++;
      cursor += n;
      if (!dryRun) pr.setProperty(def.cursorKey, JSON.stringify({ row: cursor, st: st }));   // lo loi nhay vao catch, con tro giu nguyen
    }
    var done = cursor > last;
    return { ok: true, table: def.table, dryRun: dryRun, done: done, nextRow: cursor, lastRow: last, pushed: tot.pushed, batches: tot.batches,
      skippedBlank: tot.skipped, ms: Date.now() - t0,
      hint: dryRun ? 'Day la chay thu (chua ghi). Chay ban That de ghi.' : (done ? 'Xong. Chay ham Doi chieu tuong ung.' : 'Chua het — chay lai de tiep tuc (con tro duoc nho).') };
  } catch (e) {
    return { ok: false, table: def.table, error: String(e && e.message || e) };
  } finally { try { lock.releaseLock(); } catch (eL) {} }
}
function sbBackfillDT_(opts) { return sbBackfillOrders_('dt', opts); }
function sbBackfillDon_(opts) { return sbBackfillOrders_('don', opts); }

// So dong cua 1 bang Supabase (Content-Range), chi tinh dong chua archived.
function _sbCountTable_(table) {
  var res = sb_('GET', table + '?select=src_row&archived=eq.false&limit=1', null, { Prefer: 'count=exact' });
  var cr = String(_sbHeader_(res.headers, 'content-range') || ''), m = cr.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

// So khop 1 truong giua rec (tu Sheet) va dong Supabase. Tra true neu khop.
function _sbFieldEq_(col, want, got) {
  if (col === 'raw') return JSON.stringify(got === undefined ? null : got) === JSON.stringify(want);
  if (SB_DT_NUM_[col]) return Number(got) === Number(want);
  if (col === 'ngay_tao_d' || col === 'thoi_gian_ht_d') return (got || null) === (want || null);
  if (col === 'archived') return !!got === !!want;
  return String(got === null || got === undefined ? '' : got) === String(want === null || want === undefined ? '' : want);
}

// Doi chieu 1 bang: (1) so dong ky vong tu Sheet (chay lai DUNG logic chuyen doi) == so dong Supabase (archived=false);
// (2) so TUNG TRUONG (ke ca raw) tren mau rai deu opts.sample (mac dinh 100, toi da 300). ok:true chi khi (1) khop va (2) khong lech.
// Doi chieu theo mau — khong phai checksum toan bang.
function sbCompareOrders_(which, opts) {
  opts = opts || {};
  var def = _sbOrderDef_(which), sample = Math.max(1, Math.min(300, parseInt(opts.sample, 10) || 100));
  try {
    var sh = _sbOpenOrderSheet_(def), last = sh.getLastRow(), width = def.width(sh);
    var expected = [], skipped = 0, st = null;
    for (var row = 2; row <= last; row += SB_BATCH_) {
      var n = Math.min(SB_BATCH_, last - row + 1);
      var res = def.convert(sh.getRange(row, 1, n, width).getValues(), row, st);
      st = res.st; skipped += res.skipped;
      for (var q = 0; q < res.recs.length; q++) expected.push(res.recs[q]);
    }
    var sbCount = _sbCountTable_(def.table);
    var step = Math.max(1, Math.floor(expected.length / sample)), picks = [];
    for (var s = 0; s < expected.length && picks.length < sample; s += step) picks.push(expected[s]);
    var checked = 0, mismatches = [];
    for (var b = 0; b < picks.length; b += 100) {
      var chunk = picks.slice(b, b + 100), nums = chunk.map(function (r) { return r.src_row; });
      var got = sb_('GET', def.table + '?select=*&src_row=in.(' + nums.join(',') + ')').json || [];
      var bySrc = {};
      got.forEach(function (g) { (bySrc[g.src_row] = bySrc[g.src_row] || []).push(g); });
      chunk.forEach(function (rec) {
        checked++;
        var cands = bySrc[rec.src_row] || [];
        var g = null;
        for (var c = 0; c < cands.length; c++) if (def.which !== 'dt' || String(cands[c].id) === rec.id) g = cands[c];
        if (!g) { mismatches.push({ srcRow: rec.src_row, problem: 'thieu tren Supabase' }); return; }
        var diff = [];
        def.cols.forEach(function (col) { if (!_sbFieldEq_(col, rec[col], g[col])) diff.push(col); });
        if (diff.length) mismatches.push({ srcRow: rec.src_row, problem: 'khac cot', cols: diff });
      });
    }
    return { ok: (sbCount === expected.length && mismatches.length === 0), table: def.table, sheetRows: Math.max(0, last - 1), expectedRows: expected.length,
      skippedBlank: skipped, supabaseRows: sbCount, sampleChecked: checked, mismatches: mismatches.slice(0, 20), mismatchCount: mismatches.length };
  } catch (e) { return { ok: false, table: def.table, error: String(e && e.message || e) }; }
}
function sbCompareDT_(opts) { return sbCompareOrders_('dt', opts); }
function sbCompareDon_(opts) { return sbCompareOrders_('don', opts); }

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4a) — chon ten ham o o "Run", bam Run, xem "Execution log". Khong can adminKey / URL. ──
//  Thu tu: sbDonHangThuDT -> sbDonHangDayDT (bam lai den khi log bao XONG) -> sbDonHangDoiChieuDT (phai ok:true); lam tiep giong het cho Don.
function _sbLogBackfill_(r) {
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error" o tren.' : (r.dryRun ? 'CHAY THU xong (chua ghi gi).' : (r.done ? 'XONG. Chay tiep ham Doi chieu.' : 'CHUA HET — bam Run lai de chay tiep (con tro duoc nho).')));
}
function sbDonHangThuDT() { _sbLogBackfill_(sbBackfillDT_({ dryRun: true })); }
function sbDonHangDayDT() { _sbLogBackfill_(sbBackfillDT_({ dryRun: false })); }
function sbDonHangDayLaiTuDauDT() { _sbLogBackfill_(sbBackfillDT_({ dryRun: false, reset: true })); }
function sbDonHangDoiChieuDT() { Logger.log(JSON.stringify(sbCompareDT_({ sample: 300 }), null, 2)); }
function sbDonHangThuDon() { _sbLogBackfill_(sbBackfillDon_({ dryRun: true })); }
function sbDonHangDayDon() { _sbLogBackfill_(sbBackfillDon_({ dryRun: false })); }
function sbDonHangDayLaiTuDauDon() { _sbLogBackfill_(sbBackfillDon_({ dryRun: false, reset: true })); }
function sbDonHangDoiChieuDon() { Logger.log(JSON.stringify(sbCompareDon_({ sample: 300 }), null, 2)); }

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
  if (mode === 'off') { _sbSetReadOff_(pr, 'SB_ORD_READ'); _sbSetReadOff_(pr, 'SB_CARE_DELTA_READ'); _sbSetReadOff_(pr, 'SB_CARE_FULL_READ'); }   // 4c: rollback = ve Sheets hoan toan (ca doc don hang)
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
function sbXemTrangThai() { Logger.log(JSON.stringify(Object.assign(sbStatus_(), { careListRead: sbCareListStatus_() }), null, 2)); }
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
      pr.deleteProperty(def.which === 'dt' ? 'SB_DT_DIGESTS' : 'SB_DON_DIGESTS');   // bang vua xoa sach: dau van tay dong bo (4b) cu khong con dung
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

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4b/5 (muc 1): DANH DAU "ban sao don hang tren Supabase dang cu".
//  Ai ghi vao 2 sheet (kiem tra bang grep, 2026-10-09):
//   - "DT TỔNG ": CRM ghi qua patchOrder_ (sua o), deleteOrder_ / deleteDuplicateOrders_ (xoa dong), doImportSheetRows_ (them dong), tu dong xoa
//     dong trung (_autoDedupExactRowsInSheet_ qua onChangeDedupTrigger_) va luu tru (archiveOldOrders_, dang khoa). Ngoai CRM: nhan vien sua tay,
//     tool Base day don vao -> CRM KHONG biet => chi tick dong bo dinh ky (sbOrdersTick_) moi bat duoc.
//   - "dữ liệu đơn": CRM chi them (doImportSheetRows_) / xoa dong trung tu dong / luu tru; du lieu chinh vao tu Base/Pos ben ngoai.
//  Moi duong ghi cua CRM goi sbMarkOrdersDirty_ SAU KHI ghi Sheet xong: luu moc thoi gian vao Script Property SB_DT_DIRTY / SB_DON_DIRTY.
//  Nguoi doc Supabase (4c) thay moc nay => doc Sheets nhu cu cho toi khi 1 lan dong bo BAT DAU SAU moc do chay xong (sbSyncOrders_ xoa moc).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function sbMarkOrdersDirty_(which, why) {
  try {
    PropertiesService.getScriptProperties().setProperty(which === 'don' ? 'SB_DON_DIRTY' : 'SB_DT_DIRTY', String(Date.now()));
  } catch (e) { try { Logger.log('sbMarkOrdersDirty_ (' + why + ') loi: ' + String(e && e.message || e)); } catch (el) {} }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4b/5 (muc 2): DONG BO DINH KY (trigger) "DT TỔNG " -> dt_tong, "dữ liệu đơn" -> don_chi_tiet.
//  Vi sao khong chi dong bo "dong moi": nhan vien sua o trong dong cu (doi trang thai, gia tri...) va xoa/chen dong ngoai CRM — chi so sanh
//  dong moi se bo sot. Cach lam: moi lan chay doc TOAN BO sheet 1 lan (trigger chay nen, khong anh huong nguoi dung), dung CHINH logic backfill
//  chuyen ra recs, chia thanh khoi SB_ORD_BLOCK_ dong theo src_row, tinh "dau van tay" (hash 32-bit cua JSON recs) tung khoi, so voi
//  dau van tay luu o Script Property (SB_DT_DIGESTS / SB_DON_DIGESTS). Khoi nao khac -> XOA khoang src_row cua khoi tren Supabase roi POST lai
//  (xoa-roi-ghi de dong thoi xu ly ca truong hop id doi o cung src_row). Chen/xoa dong lam doi khoi phia sau -> tu day lai phan do.
//  Dau van tay chi luu SAU khi khoi ghi thanh cong => loi giua chung thi lan sau tu chay tiep. Het thoi gian (SB_TIME_BUDGET_MS_ chia doi cho 2 bang)
//  thi dung, lan sau chay tiep (complete:false).
//  Moc "da dong bo xong lan cuoi" luu o SB_ORD_STATE (syncedAt = luc BAT DAU lan chay hoan chinh, de buoc 4c biet do cu toi da bao lau). Moc dirty
//  (4b-1) chi duoc xoa khi syncedAt > moc dirty. Khong dung khoa Script Lock lau (se chan CS luu du lieu) — dung co SB_ORD_RUNNING (het han sau 6 phut).
//  Nang luc: dau van tay luu trong 1 Script Property (gioi han ~9KB) -> toi da ~1000 khoi = ~200.000 dong/sheet; vuot thi bao loi ro rang.
//  Chay 1 lan trong Editor: sbDonHangCaiTrigger (moi 10 phut), go: sbDonHangGoTrigger. Xem tinh trang: sbDonHangTrangThai.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_ORD_BLOCK_ = 200;
var SB_ORD_MAX_BLOCKS_ = 1000;
var SB_ORD_RUN_TTL_MS_ = 6 * 60 * 1000;
var SB_ORD_TICK_MINUTES_ = 10;

function _sbHash32_(str) {   // FNV-1a 32 bit -> base36
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

// Dat co "dang chay" (het han SB_ORD_RUN_TTL_MS_). Tra true neu lay duoc. Chi giu Script Lock vai ms de kiem-roi-dat.
function _sbOrdRunAcquire_(pr) {
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(3000); } catch (e) { got = false; }
  if (!got) return false;
  try {
    var t = parseInt(pr.getProperty('SB_ORD_RUNNING') || '0', 10);
    if (t && Date.now() - t < SB_ORD_RUN_TTL_MS_) return false;
    pr.setProperty('SB_ORD_RUNNING', String(Date.now()));
    return true;
  } finally { try { lock.releaseLock(); } catch (e2) {} }
}
function _sbOrdState_(pr) { var s = {}; try { s = JSON.parse(pr.getProperty('SB_ORD_STATE') || '{}') || {}; } catch (e) { s = {}; } return s; }

// Dong bo 1 bang. opts: { budgetMs, fresh (xoa sach bang Supabase + dau van tay roi day lai tat ca) }. KHONG nem loi ra ngoai.
function sbSyncOrders_(which, opts) {
  opts = opts || {};
  var def = _sbOrderDef_(which), digestKey = which === 'dt' ? 'SB_DT_DIGESTS' : 'SB_DON_DIGESTS', dirtyKey = which === 'dt' ? 'SB_DT_DIRTY' : 'SB_DON_DIRTY';
  if (!sbCfg_().ok) return { ok: false, table: def.table, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var pr = PropertiesService.getScriptProperties();
  var own = !opts.noAcquire;
  if (own && !_sbOrdRunAcquire_(pr)) return { ok: true, skipped: true, table: def.table, note: 'Dang co lan dong bo khac chay — bo qua.' };
  var t0 = Date.now(), budget = opts.budgetMs || SB_TIME_BUDGET_MS_, B = SB_ORD_BLOCK_, st = null, err = '';
  var out = { ok: false, table: def.table, complete: false, changedBlocks: 0, pushedRows: 0 };
  try {
    var sh = _sbOpenOrderSheet_(def), last = sh.getLastRow(), width = def.width(sh);
    if (opts.fresh) { sb_('DELETE', def.table + '?src_row=gte.0', null, { Prefer: 'return=minimal' }); pr.deleteProperty(digestKey); }
    var recs = [];
    for (var row = 2; row <= last; row += SB_BATCH_) {
      var n = Math.min(SB_BATCH_, last - row + 1);
      var res = def.convert(sh.getRange(row, 1, n, width).getValues(), row, st);
      st = res.st;
      for (var q = 0; q < res.recs.length; q++) recs.push(res.recs[q]);
    }
    var nBlocks = last >= 2 ? Math.ceil((last - 1) / B) : 0;
    if (nBlocks > SB_ORD_MAX_BLOCKS_) throw new Error('Sheet qua lon (' + nBlocks + ' khoi > ' + SB_ORD_MAX_BLOCKS_ + ') cho Script Property dau van tay — can doi cach luu.');
    var byBlock = [], i;
    for (i = 0; i < nBlocks; i++) byBlock.push([]);
    recs.forEach(function (r) { byBlock[Math.floor((r.src_row - 2) / B)].push(r); });
    var fresh = byBlock.map(function (b) { return _sbHash32_(JSON.stringify(b)); });
    var raw = pr.getProperty(digestKey), stored = raw ? raw.split(',') : [];
    var shrank = stored.length > nBlocks;
    stored.length = Math.min(stored.length, nBlocks);
    for (i = 0; i < nBlocks; i++) {
      if (stored[i] === fresh[i]) continue;
      if (out.changedBlocks > 0 && Date.now() - t0 >= budget) { out.timeUp = true; break; }
      var lo = 2 + i * B, hi = lo + B - 1;
      sb_('DELETE', def.table + '?src_row=gte.' + lo + '&src_row=lte.' + hi, null, { Prefer: 'return=minimal' });
      if (byBlock[i].length) sb_('POST', def.table + '?on_conflict=' + def.conflict, byBlock[i], { Prefer: 'resolution=merge-duplicates,return=minimal' });
      while (stored.length < i) stored.push('');   // khoi truoc chua co dau van tay (khong xay ra khi chay tuan tu) — de trong
      stored[i] = fresh[i];
      pr.setProperty(digestKey, stored.join(','));
      out.changedBlocks++; out.pushedRows += byBlock[i].length;
    }
    var complete = !out.timeUp;
    if (complete) {
      if (shrank || !raw) sb_('DELETE', def.table + '?src_row=gt.' + (last >= 2 ? last : 1), null, { Prefer: 'return=minimal' });   // sheet ngan di (hoac lan dau, chua co dau van tay): bo dong thua phia duoi
      pr.setProperty(digestKey, stored.join(','));
      var state = _sbOrdState_(pr);
      state[which] = { syncedAt: t0, last: last, blocks: nBlocks, rows: recs.length };
      pr.setProperty('SB_ORD_STATE', JSON.stringify(state));
      var dirty = parseInt(pr.getProperty(dirtyKey) || '0', 10);
      if (dirty && dirty <= t0) pr.deleteProperty(dirtyKey);   // lan doc nay BAT DAU sau moc dirty nen da co moi thay doi cua CRM
    }
    out.ok = true; out.complete = complete; out.blocks = nBlocks; out.lastRow = last; out.rows = recs.length; out.ms = Date.now() - t0;
    return out;
  } catch (e) {
    err = String(e && e.message || e);
    try { var s2 = _sbOrdState_(pr); s2[which] = Object.assign({}, s2[which] || {}, { err: err, errAt: Date.now() }); pr.setProperty('SB_ORD_STATE', JSON.stringify(s2)); } catch (e2) {}
    out.error = err; out.ms = Date.now() - t0;
    return out;
  } finally { if (own) { try { pr.deleteProperty('SB_ORD_RUNNING'); } catch (e3) {} } }
}

// Dong bo CA 2 bang trong 1 lan (dung chung co chay, ngan sach thoi gian chia doi). Ham cua trigger.
function sbOrdersSync_(opts) {
  opts = opts || {};
  var pr = PropertiesService.getScriptProperties();
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  if (!_sbOrdRunAcquire_(pr)) return { ok: true, skipped: true, note: 'Dang co lan dong bo khac chay — bo qua.' };
  try {
    var half = Math.floor(SB_TIME_BUDGET_MS_ / 2);
    var dt = sbSyncOrders_('dt', { budgetMs: half, noAcquire: true, fresh: opts.fresh });
    var don = sbSyncOrders_('don', { budgetMs: half, noAcquire: true, fresh: opts.fresh });
    return { ok: !!(dt.ok && don.ok), complete: !!(dt.complete && don.complete), dt: dt, don: don };
  } finally { try { pr.deleteProperty('SB_ORD_RUNNING'); } catch (e) {} }
}
function sbOrdersTick_() { try { Logger.log('sbOrdersTick ' + JSON.stringify(sbOrdersSync_())); } catch (e) { Logger.log('sbOrdersTick loi: ' + e); } }
function installSbOrdersTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; });
  if (ex.length) return 'Trigger "sbOrdersTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('sbOrdersTick_').timeBased().everyMinutes(SB_ORD_TICK_MINUTES_).create();
  return 'Da tao trigger sbOrdersTick_ chay moi ' + SB_ORD_TICK_MINUTES_ + ' phut.';
}
function removeSbOrdersTrigger_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sbOrdersTick_') { ScriptApp.deleteTrigger(t); n++; } });
  return 'Da go ' + n + ' trigger sbOrdersTick_.';
}
function sbOrdersStatus_() {
  var pr = PropertiesService.getScriptProperties(), s = _sbOrdState_(pr), now = Date.now();
  var info = function (w, dk) {
    var x = s[w] || {}, d = parseInt(pr.getProperty(dk) || '0', 10);
    return { syncedAt: x.syncedAt ? new Date(x.syncedAt).toISOString() : null, ageMin: x.syncedAt ? Math.round((now - x.syncedAt) / 60000) : null,
      rows: x.rows == null ? null : x.rows, lastRow: x.last == null ? null : x.last, dirtySinceSync: !!(d && (!x.syncedAt || d > x.syncedAt)), lastError: x.err || null };
  };
  return { ok: true, orderRead: sbOrdReadStatus_(), dt: info('dt', 'SB_DT_DIRTY'), don: info('don', 'SB_DON_DIRTY') };
}

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4b) ──
function _sbLogSync_(r) {
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error" o tren.' : (r.skipped ? 'DANG CO LAN KHAC CHAY — thu lai sau it phut.' : (r.complete ? 'XONG — Supabase khop Sheet tai thoi diem doc.' : 'CHUA HET — bam Run lai.')));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC B (docs/MIGRATE-SUPABASE-FULL.md): dong bo DINH KY CareData Sheet -> care_data (luoi an toan).
//  Van de: CareData chi len Supabase qua ghi song song cua CRM; sua TAY / import thang tren Sheet khong len -> CRM (dang doc Supabase)
//  khong thay. Cach lam (khung giong 4b don hang): chia Sheet thanh khoi SB_CARE_SYNC_BLOCK_ dong, bam noi dung tung khoi (FNV, luu
//  Script Property SB_CARE_DIGESTS), CHI day khoi doi len Supabase (upsert theo phone). KHONG xoa dong nao tren Supabase (an toan).
//  - Moi khoi: giu Script Lock (cung khoa voi ghi song song/backfill) luc DOC khoi + DAY khoi, de khong ghi de ban ghi CRM vua luu.
//  - Dong dau tien cua moi SDT thang (giong backfill) — SDT trung ben duoi bi bo.
//  - Dong day len co updated_at = luc dong bo (khong dung chuoi `updated`): sua tay khong doi cot `updated` van duoc client delta thay.
//  - Khong tu xoa co dirty/STALE cua ghi song song (viec do thuoc cong an toan cu).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_CARE_SYNC_BLOCK_ = 200;
var SB_CARE_SYNC_MAX_BLOCKS_ = 500;      // 500 khoi x ~9 ky tu < gioi han ~9KB cua 1 Script Property
var SB_CARE_SYNC_TICK_MINUTES_ = 10;
function _sbCareState_(pr) { var s = {}; try { s = JSON.parse(pr.getProperty('SB_CARE_SYNC_STATE') || '{}') || {}; } catch (e) { s = {}; } return s; }
// opts: { budgetMs, fresh (bo qua dau van tay: day lai TAT CA khoi, KHONG xoa gi tren Supabase) }. KHONG nem loi ra ngoai.
function sbSyncCare_(opts) {
  opts = opts || {};
  var out = { ok: false, complete: false, changedBlocks: 0, pushedRows: 0, dupSkipped: 0, skippedNoPhone: 0, lockBusy: 0, timeUp: false };
  var t0 = Date.now(), budget = opts.budgetMs || SB_TIME_BUDGET_MS_;
  if (!sbCfg_().ok) { out.error = 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.'; return out; }
  var pr = PropertiesService.getScriptProperties();
  try {
    var sh = getSheet_(SH_CARE, CARE_HEADERS), last = sh.getLastRow(), B = SB_CARE_SYNC_BLOCK_;
    var nBlocks = last >= 2 ? Math.ceil((last - 1) / B) : 0;
    if (nBlocks > SB_CARE_SYNC_MAX_BLOCKS_) throw new Error('CareData qua lon (' + nBlocks + ' khoi > ' + SB_CARE_SYNC_MAX_BLOCKS_ + ') cho Script Property dau van tay — can doi cach luu.');
    var firstRow = {};   // dong dau tien cua moi SDT (1 lan doc cot A)
    if (last >= 2) {
      var colA = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var ci = 0; ci < colA.length; ci++) {
        var pc = normPhone_(_sbCell_(colA[ci][0]));
        if (pc && firstRow[pc] === undefined) firstRow[pc] = ci + 2;
      }
    }
    var raw = opts.fresh ? '' : (pr.getProperty('SB_CARE_DIGESTS') || ''), stored = raw ? raw.split(',') : [];
    stored.length = Math.min(stored.length, nBlocks);
    while (stored.length < nBlocks) stored.push('');
    var lock = LockService.getScriptLock();
    for (var i = 0; i < nBlocks; i++) {
      if (out.changedBlocks > 0 && Date.now() - t0 >= budget) { out.timeUp = true; break; }
      var got = false;
      try { got = lock.tryLock(10000); } catch (eLk) { got = false; }
      if (!got) { out.lockBusy++; stored[i] = ''; continue; }   // khoi nay de lan sau (dau van tay rong = chua dong bo)
      try {
        var lo = 2 + i * B, n = Math.min(B, last - lo + 1);
        var vals = sh.getRange(lo, 1, n, CARE_HEADERS.length).getValues();
        var h = _sbHash32_(JSON.stringify(vals.map(function (r) { return r.map(_sbCell_); })));
        if (stored[i] === h) continue;
        var recs = [], nowIso = new Date().toISOString();
        for (var k = 0; k < vals.length; k++) {
          var rec = sbCareRowToRec_(vals[k]);
          if (!rec) { out.skippedNoPhone++; continue; }
          if (firstRow[rec.phone] !== lo + k) { out.dupSkipped++; continue; }
          rec.updated_at = nowIso;
          recs.push(rec);
        }
        if (recs.length) sb_('POST', 'care_data?on_conflict=phone', recs, { Prefer: 'resolution=merge-duplicates,return=minimal' });
        stored[i] = h;
        pr.setProperty('SB_CARE_DIGESTS', stored.join(','));
        out.changedBlocks++; out.pushedRows += recs.length;
      } finally { try { lock.releaseLock(); } catch (eR) {} }
    }
    out.complete = !out.timeUp && out.lockBusy === 0;
    if (out.complete) pr.setProperty('SB_CARE_DIGESTS', stored.join(','));
    var st = _sbCareState_(pr);
    if (out.complete) st = { syncedAt: t0, last: last, blocks: nBlocks };
    pr.setProperty('SB_CARE_SYNC_STATE', JSON.stringify(st));
    out.ok = true; out.blocks = nBlocks; out.lastRow = last; out.ms = Date.now() - t0;
    return out;
  } catch (e) {
    out.error = String(e && e.message || e); out.ms = Date.now() - t0;
    try { var s2 = _sbCareState_(pr); s2.err = out.error; s2.errAt = Date.now(); pr.setProperty('SB_CARE_SYNC_STATE', JSON.stringify(s2)); } catch (e2) {}
    return out;
  }
}
function sbCareTick_() { try { Logger.log('sbCareTick ' + JSON.stringify(sbSyncCare_())); } catch (e) { Logger.log('sbCareTick loi: ' + e); } }
function installSbCareTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sbCareTick_'; });
  if (ex.length) return 'Trigger "sbCareTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('sbCareTick_').timeBased().everyMinutes(SB_CARE_SYNC_TICK_MINUTES_).create();
  return 'Da tao trigger sbCareTick_ chay moi ' + SB_CARE_SYNC_TICK_MINUTES_ + ' phut.';
}
function removeSbCareTrigger_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sbCareTick_') { ScriptApp.deleteTrigger(t); n++; } });
  return 'Da go ' + n + ' trigger sbCareTick_.';
}
function sbCareSyncStatus_() {
  var pr = PropertiesService.getScriptProperties(), s = _sbCareState_(pr), has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbCareTick_'; });
  return { ok: true, triggerOn: has, syncedAt: s.syncedAt ? new Date(s.syncedAt).toISOString() : null, ageMin: s.syncedAt ? Math.round((Date.now() - s.syncedAt) / 60000) : null,
    blocks: s.blocks == null ? null : s.blocks, lastRow: s.last == null ? null : s.last, lastError: s.err || null };
}
// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc B) ──
function sbKHDongBo()    { _sbLogSync_(sbSyncCare_()); }
function sbKHDongBoLai() { _sbLogSync_(sbSyncCare_({ fresh: true })); }   // bo qua dau van tay, day lai moi khoi (khong xoa gi tren Supabase)
function sbKHCaiTrigger() { Logger.log(installSbCareTrigger_()); }
function sbKHGoTrigger()  { Logger.log(removeSbCareTrigger_()); }
function sbKHTrangThaiDongBo() { Logger.log(JSON.stringify(sbCareSyncStatus_(), null, 2)); }
// ═══════════════════════════════════════════════════════════════
//  CHAN DOAN TY LE CHOT THEO SALE (chay tay: chanDoanTyLeChot). Khong ghi gi, chi doc + Logger.log.
//  Lap lai DUNG quy tac cua _srCloseRateSectionsFromBase_/_srCloseRateSections_ nhung ghi LY DO vi sao tung don khong tinh cho sale:
//   (1) don khong duoc dem vi KENH chua gan Page Pancake / Page chua nap tuong tac ngay do (_srOrderCovered_)
//   (2) NGUOI TAO (cot B DT TONG) khong khop ten nao co tuong tac Pancake / Danh sach Sale -> dom vao "(chua gan sale)"
//   (3) don tinh cho nguoi tao theo tung "nguoi" (khoa cung 1 nguoi) -> so voi so don theo "Sale ban" va tuong tac Pancake.
// ═══════════════════════════════════════════════════════════════
function _tlcDiagnose_(filters) {
  var fFrom = _dateStrToVnYmd_(filters.dateFrom), fTo = _dateStrToVnYmd_(filters.dateTo);
  var covered = _pkTrackedDatesByPageAndSale_(fFrom, fTo).datesByPage || {};
  var pkMap = readPancakePageMap_() || {}, kenhPages = {};
  Object.keys(pkMap).forEach(function (pid) { var kn = pkMap[pid]; if (!kn) return; (kenhPages[kn] = kenhPages[kn] || []).push(pid); });
  var pkFn = _salePersonKeyFn_(), known = {};
  var rep = buildPancakeReport_(filters.dateFrom, filters.dateTo, 'equal'), byCS = rep.byCS || [];
  var anchorNames = byCS.filter(function (r) { return (r.tongTT || 0) > 0; }).map(function (r) { return r.name; });
  var rows = readDTTong_(true), inRange = [], i;
  var skipped = { bhZero: 0, trangThaiLoai: 0, ngoaiKy: 0 };
  for (i = 0; i < rows.length; i++) {
    var r0 = rows[i];
    if (r0.bhZero) { skipped.bhZero++; continue; }
    if (_isExcludedOrderStatus_(r0.trangThai)) { skipped.trangThaiLoai++; continue; }
    if (!dateInRange_(parseVNDate_(r0.ngayTao), filters.dateFrom, filters.dateTo)) { skipped.ngoaiKy++; continue; }
    inRange.push(r0);
  }
  var orderNames = [];
  inRange.forEach(function (r) { if (r.nguoiTao) orderNames.push(String(r.nguoiTao).trim()); });
  var personKey = _salePersonKeyWithOrphanFold_(pkFn, anchorNames, orderNames);
  byCS.forEach(function (n) { known[personKey(n.name)] = n.name; });
  try { Object.keys(readSaleDirectory_().byName || {}).forEach(function (k) { if (!known[personKey(k)]) known[personKey(k)] = k; }); } catch (e) {}
  var disp = {}, held = {}, byCreator = {}, bySaleBan = {}, bySaleBanCov = {}, notCovered = {}, unknownCreators = {}, noCreator = 0, countedTotal = 0, unassignedTotal = 0;
  byCS.forEach(function (n) { var k = personKey(n.name); disp[k] = disp[k] || n.name; held[k] = (held[k] || 0) + (n.tongTT || 0); });
  inRange.forEach(function (r) {
    var dt = parseVNDate_(r.ngayTao), ymd = dt ? _vnYmd_(dt) : '';
    var kn = r.kenhBan || '(chưa có kênh)', pids = kenhPages[r.kenhBan] || [];
    splitMulti_(r.saleBan, ',').forEach(function (sn) { var k = personKey(sn); disp[k] = disp[k] || sn; bySaleBan[k] = (bySaleBan[k] || 0) + 1; });
    var isCov = pids.some(function (pid) { return covered[pid] && covered[pid][ymd]; });
    if (isCov) splitMulti_(r.saleBan, ',').forEach(function (sn) { var k2 = personKey(sn); bySaleBanCov[k2] = (bySaleBanCov[k2] || 0) + 1; });
    if (!isCov) {
      var why = pids.length ? 'kênh có Page nhưng Page chưa nạp tương tác ngày đơn' : 'kênh CHƯA gán Page Pancake';
      var key = kn + ' — ' + why; notCovered[key] = (notCovered[key] || 0) + 1; return;
    }
    var creator = r.nguoiTao ? String(r.nguoiTao).trim() : '';
    if (!creator) { noCreator++; unassignedTotal++; return; }
    if (!known[personKey(creator)]) { unknownCreators[creator] = (unknownCreators[creator] || 0) + 1; unassignedTotal++; return; }
    var pk = personKey(creator); disp[pk] = disp[pk] || creator;
    byCreator[pk] = (byCreator[pk] || 0) + 1; countedTotal++;
  });
  var keys = {}; [held, byCreator, bySaleBan, bySaleBanCov].forEach(function (m) { Object.keys(m).forEach(function (k) { keys[k] = 1; }); });
  var people = Object.keys(keys).map(function (k) {
    var h = held[k] || 0, c = byCreator[k] || 0;
    var sc = bySaleBanCov[k] || 0;
    return { name: disp[k] || k, held: Math.round(h), byCreator: c, bySaleBan: bySaleBan[k] || 0, bySaleBanCov: sc, rate: h ? Math.round(c / h * 1000) / 10 : null, rateSaleBan: h ? Math.round(sc / h * 1000) / 10 : null };
  }).sort(function (a, b) { return b.bySaleBan - a.bySaleBan; });
  var ncTotal = 0; Object.keys(notCovered).forEach(function (k) { ncTotal += notCovered[k]; });
  return { mode: _closeRateBy_(), from: filters.dateFrom, to: filters.dateTo, rowsRead: rows.length, skipped: skipped, ordersInRange: inRange.length, countedForSale: countedTotal,
           unassigned: unassignedTotal, noCreator: noCreator, unknownCreators: unknownCreators, notCovered: notCovered, notCoveredTotal: ncTotal, people: people, anchorNames: anchorNames };
}
function chanDoanTyLeChot() {
  var today = _vnYmd_(new Date()), from = today.substring(0, 8) + '01';
  var f = { dateFrom: from, dateTo: today };
  var d = _tlcDiagnose_(f);
  Logger.log('=== CHẨN ĐOÁN TỶ LỆ CHỐT THEO SALE · ' + d.from + ' → ' + d.to + ' ===');
  Logger.log('Cách gán đơn đang dùng cho Tỷ lệ chốt: ' + (d.mode === 'saleban' ? 'SALE BÁN (mỗi sale ghi trên đơn +1 đơn)' : 'NGƯỜI TẠO (cột B DT TỔNG)') + '. Đổi: datTyLeChotTheo(\'saleban\' | \'nguoitao\').');
  Logger.log('Đọc ' + d.rowsRead + ' dòng DT TỔNG; bỏ: đơn BH 0đ ' + d.skipped.bhZero + ', trạng thái loại ' + d.skipped.trangThaiLoai + ', ngoài kỳ ' + d.skipped.ngoaiKy + ' → còn ' + d.ordersInRange + ' đơn trong kỳ.');
  Logger.log('KẾT QUẢ: ' + d.countedForSale + ' đơn tính cho sale (theo NGƯỜI TẠO) | ' + d.unassigned + ' đơn "(chưa gán sale)" | ' + d.notCoveredTotal + ' đơn KHÔNG được đếm (kênh/ngày chưa có Pancake).');
  Logger.log('--- (A) Đơn KHÔNG được đếm vì kênh/ngày chưa có tương tác Pancake ---');
  Object.keys(d.notCovered).sort(function (a, b) { return d.notCovered[b] - d.notCovered[a]; }).forEach(function (k) { Logger.log('  ' + d.notCovered[k] + ' đơn · ' + k); });
  Logger.log('--- (B) NGƯỜI TẠO không khớp tên nào có tương tác Pancake → "(chưa gán sale)" (' + d.noCreator + ' đơn không có người tạo) ---');
  Object.keys(d.unknownCreators).sort(function (a, b) { return d.unknownCreators[b] - d.unknownCreators[a]; }).forEach(function (k) { Logger.log('  ' + d.unknownCreators[k] + ' đơn · người tạo = "' + k + '"'); });
  Logger.log('--- (C) Từng người: đơn theo NGƯỜI TẠO (dùng cho tỷ lệ chốt) so với đơn theo SALE BÁN (bảng bên trái) ---');
  d.people.forEach(function (p) {
    Logger.log('  ' + p.name + ' | tương tác ' + p.held + ' | đơn theo người tạo ' + p.byCreator + ' | đơn theo sale bán ' + p.bySaleBan + ' (trong kênh Pancake ' + p.bySaleBanCov + ') | tỷ lệ theo người tạo ' + (p.rate == null ? '-' : p.rate + '%') + ' | theo sale bán ' + (p.rateSaleBan == null ? '-' : p.rateSaleBan + '%') + (p.bySaleBan > p.byCreator ? ' | LỆCH ' + (p.bySaleBan - p.byCreator) + ' đơn' : ''));
  });
  return d;
}
// Chay tay: so Ty le chot theo KENH + theo SALE cua Bao cao A (Base) voi Bao cao B (Pos) THANG NAY — phai GIONG HET (cung nguon don Base).
function xemTyLeChotAB() {
  var today = _vnYmd_(new Date()), from = today.substring(0, 8) + '01';
  var f = { dateFrom: from, dateTo: today, sale: [], nguon: [], marketer: [], sanPham: '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '' };
  var a = buildSalesReportA_(f), b = buildSalesReportB_(f), diff = 0;
  Logger.log('Kỳ ' + from + ' → ' + today);
  function cmp(label, x, y) {
    var mx = {}, my = {}; (x || []).forEach(function(r) { mx[r.name] = r.closed + '/' + r.held + '=' + r.closeRate; }); (y || []).forEach(function(r) { my[r.name] = r.closed + '/' + r.held + '=' + r.closeRate; });
    Object.keys(mx).concat(Object.keys(my)).filter(function(k, i, arr) { return arr.indexOf(k) === i; }).forEach(function(k) {
      var same = mx[k] === my[k]; if (!same) diff++;
      Logger.log((same ? 'KHOP  ' : 'LECH  ') + label + ' ' + k + ' | A(Base): ' + (mx[k] || '-') + ' | B(Pos): ' + (my[k] || '-'));
    });
  }
  cmp('KENH', a.kenhCloseRate, b.kenhCloseRate); cmp('SALE', a.saleCloseRate, b.saleCloseRate);
  Logger.log(diff ? ('=> ' + diff + ' dong LECH — gui log nay de kiem tra') : '=> KHOP HET: Ty le chot A (Base) va B (Pos) giong nhau.');
}
function sbDonHangDongBo() { _sbLogSync_(sbOrdersSync_()); }
function sbDonHangDongBoLai() { _sbLogSync_(sbOrdersSync_({ fresh: true })); }   // xoa sach 2 bang Supabase roi day lai tat ca (dung khi nghi Supabase bi sua tay / lech)
function sbDonHangCaiTrigger() { Logger.log(installSbOrdersTrigger_()); }
function sbDonHangGoTrigger() { Logger.log(removeSbOrdersTrigger_()); }
function sbDonHangTrangThai() { Logger.log(JSON.stringify(sbOrdersStatus_(), null, 2)); }


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4c/5: DOC don hang / lich hen tu Supabase (MAC DINH TAT; moi ham tu fallback ve Sheets).
//  Cac ham doc: readOrdersByPhone_ (dt_tong theo SDT), findDonRowsByPhone_ (don_chi_tiet theo SDT), readDTTong_ (ca bang dt_tong),
//  reminders (care_data). JSON tra ve GIU NGUYEN: don hang di qua dung dtRowToOrder_ / vong lap readDTTong_ / vong lap findDonRowsByPhone_
//  voi mang dong dung lai tu cot raw (sbRawToRow_) — khong co ban logic chuyen doi thu hai.
//  Cong tac RIENG cho don hang: Script Property SB_ORD_READ = 'on' (bat bang sbDonHangBatDoc, tat bang sbDonHangTatDoc; sbTatSupabase
//  cung tat luon). Lich hen (reminders) dung cong tac cu SB_MODE='read' cua CareData.
//  Doc Supabase chi khi TAT CA dieu kien dung (sai 1 cai -> undefined = doc Sheets nhu cu), xem _sbOrdReadGate_:
//   - SB_ORD_READ = on va da cau hinh URL/key;  - lan dong bo HOAN CHINH gan nhat cua bang do (SB_ORD_STATE.<dt|don>.syncedAt) khong qua
//     SB_ORD_MAX_AGE_MS_ (trigger 10 phut/lan => qua 30 phut = trigger chet => tu ve Sheets);
//   - khong co co dirty (SB_DT_DIRTY / SB_DON_DIRTY: CRM da ghi Sheet ma chua dong bo lai);  - khong co lan dong bo dang chay (SB_ORD_RUNNING
//     con han: dang xoa-roi-ghi lai tung khoi nen Supabase tam thieu dong);  - Supabase khong loi.
//  readDTTong_ doc CA bang nen con doi chieu SO DONG voi SB_ORD_STATE.dt.rows (so dong lan dong bo cuoi); lech => doc Sheets.
//  Luu y: doc theo SDT KHONG co fallback "khong tim thay thi doc Sheets" (khach chua co don la chuyen thuong, fallback se mat het loi ich toc do);
//  an toan dua vao cac dieu kien tren. Sua TAY ngoai CRM tren Sheet chi len Supabase o tick ke tiep (toi da ~10 phut) — doc nhu da ghi o 4b.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_ORD_MAX_AGE_MS_ = 30 * 60 * 1000;   // du lieu Supabase cu toi da (tinh tu luc BAT DAU lan dong bo hoan chinh cuoi) moi duoc doc don hang
var SB_PAGE_ = 1000;                        // PostgREST tra toi da 1000 dong/lan mac dinh
var SB_PAR_ = 10;                           // so trang tai song song trong 1 lan UrlFetchApp.fetchAll

function sbOrdReadOn_() {
  try { return String(PropertiesService.getScriptProperties().getProperty('SB_ORD_READ') || '').toLowerCase() === 'on'; } catch (e) { return false; }
}

// Tra object { syncedAt, rows, ... } cua bang ('dt'|'don') neu DUOC PHEP doc Supabase luc nay, nguoc lai null. Khong bao gio nem loi.
function _sbOrdReadGate_(which) {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_ORD_READ || '').toLowerCase() !== 'on' || !sbCfg_().ok) return null;
    var st = {};
    try { st = JSON.parse(pr.SB_ORD_STATE || '{}') || {}; } catch (e0) { st = {}; }
    var x = st[which === 'don' ? 'don' : 'dt'];
    if (!x || !x.syncedAt || Date.now() - x.syncedAt > SB_ORD_MAX_AGE_MS_) return null;
    if (pr[which === 'don' ? 'SB_DON_DIRTY' : 'SB_DT_DIRTY']) return null;
    var run = parseInt(pr.SB_ORD_RUNNING || '0', 10);
    if (run && Date.now() - run < SB_ORD_RUN_TTL_MS_) return null;
    return x;
  } catch (e) { return null; }
}

// Tai nhieu trang song song (biet truoc so dong ky vong). basePath da co dau '?' va cac tham so loc/order. Tra mang dong; nem loi neu HTTP loi.
function _sbGetAllRows_(basePath, expected) {
  var cfg = sbCfg_(), headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  var pages = Math.ceil(expected / SB_PAGE_) + 1;   // +1 trang du de bat truong hop Supabase co NHIEU dong hon ky vong (se lech so dong -> ve Sheets)
  var out = [];
  for (var p0 = 0; p0 < pages; p0 += SB_PAR_) {
    var reqs = [];
    for (var p = p0; p < Math.min(pages, p0 + SB_PAR_); p++) {
      reqs.push({ url: cfg.url + '/rest/v1/' + basePath + '&limit=' + SB_PAGE_ + '&offset=' + (p * SB_PAGE_), method: 'get', headers: headers, muteHttpExceptions: true });
    }
    var rs = UrlFetchApp.fetchAll(reqs);
    for (var i = 0; i < rs.length; i++) {
      var code = rs[i].getResponseCode(), text = rs[i].getContentText() || '';
      if (code >= 300) throw new Error('Supabase HTTP ' + code + ' (GET ' + String(basePath).split('?')[0] + '): ' + text.slice(0, 300));
      var a = JSON.parse(text || '[]');
      if (!Array.isArray(a)) throw new Error('Supabase tra du lieu khong phai mang (' + String(basePath).split('?')[0] + ')');
      for (var j = 0; j < a.length; j++) out.push(a[j]);
    }
  }
  return out;
}

// Tai lan luot tung trang cho den khi het (khi KHONG biet truoc so dong, vd care_data).
function _sbGetPagesSeq_(basePath) {
  var out = [], off = 0;
  for (var guard = 0; guard < 500; guard++) {
    var a = sb_('GET', basePath + '&limit=' + SB_PAGE_ + '&offset=' + off).json;
    if (!Array.isArray(a)) throw new Error('Supabase tra du lieu khong phai mang (' + String(basePath).split('?')[0] + ')');
    for (var j = 0; j < a.length; j++) out.push(a[j]);
    if (a.length < SB_PAGE_) return out;
    off += SB_PAGE_;
  }
  throw new Error('Qua nhieu trang (' + String(basePath).split('?')[0] + ')');
}

// readDTTong_: tra { vals (mang dong 20 o nhu getValues), rowNums (src_row cua tung dong) } hoac UNDEFINED = doc Sheets nhu cu.
function sbReadDTTongVals_() {
  try {
    var g = _sbOrdReadGate_('dt');
    if (!g || g.rows == null) return undefined;
    var rows = _sbGetAllRows_('dt_tong?select=src_row,raw&archived=eq.false&order=src_row.asc', g.rows);
    if (rows.length !== g.rows) { Logger.log('sbReadDTTongVals_: lech so dong (Supabase ' + rows.length + ' vs dong bo cuoi ' + g.rows + ') — doc Sheets thay the'); return undefined; }
    if (!_sbOrdReadGate_('dt')) return undefined;   // trong luc tai co dong bo/ghi xen vao -> bo, doc Sheets
    var vals = [], nums = [];
    for (var i = 0; i < rows.length; i++) { vals.push(sbRawToRow_(rows[i].raw, DT_TONG_WIDTH)); nums.push(rows[i].src_row); }
    return { vals: vals, rowNums: nums };
  } catch (e) {
    try { Logger.log('sbReadDTTongVals_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// readOrdersByPhone_: tra mang order (dtRowToOrder_) theo thu tu dong, hoac UNDEFINED = doc Sheets nhu cu. ph da qua normPhone_.
function sbReadOrdersByPhone_(ph) {
  try {
    if (!_sbOrdReadGate_('dt')) return undefined;
    var rows = sb_('GET', 'dt_tong?select=src_row,raw&archived=eq.false&phone=eq.' + encodeURIComponent(ph) + '&order=src_row.asc&limit=' + SB_PAGE_).json;
    if (!Array.isArray(rows)) return undefined;
    if (!_sbOrdReadGate_('dt')) return undefined;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      try { out.push(dtRowToOrder_(sbRawToRow_(rows[i].raw, DT_TONG_WIDTH), rows[i].src_row)); }
      catch (eRow) { Logger.log('sbReadOrdersByPhone_: loi doc dong ' + rows[i].src_row + ': ' + eRow); }
    }
    return out;
  } catch (e) {
    try { Logger.log('sbReadOrdersByPhone_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// findDonRowsByPhone_: tra mang object cung HINH voi readDonChiTiet_ (chi cac truong findDonRowsByPhone_ dung), hoac UNDEFINED = doc Sheets.
// Dung cot da chuyen doi san luc dong bo (ngay_tao_don da ke thua ngay dong tren — khong the dung lai tu raw cua rieng dong nay).
function sbReadDonByPhone_(ph) {
  try {
    if (!_sbOrdReadGate_('don')) return undefined;
    var rows = sb_('GET', 'don_chi_tiet?select=src_row,ngay_tao_don,phone,nguon_don,the_sale,san_pham,marketer,gia_tri_sau_giam&archived=eq.false&phone=eq.' +
      encodeURIComponent(ph) + '&order=src_row.asc&limit=' + SB_PAGE_).json;
    if (!Array.isArray(rows)) return undefined;
    if (!_sbOrdReadGate_('don')) return undefined;
    return rows.map(function (g) {
      return { ngayTaoDon: g.ngay_tao_don == null ? '' : g.ngay_tao_don, soDienThoai: g.phone, nguonDon: g.nguon_don || '', theSale: g.the_sale || '',
        sanPham: g.san_pham || '', marketer: g.marketer || '', giaTriSauGiam: Number(g.gia_tri_sau_giam) || 0 };
    });
  } catch (e) {
    try { Logger.log('sbReadDonByPhone_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// O ngay trong care_data duoc luu bang _sbCell_ (Date -> ISO 'Z'). Dua nguoc ve Date de String(rhen) cua action reminders ra DUNG dinh dang
// nhu doc tu Sheets; chuoi khac (nguoi go tay) giu nguyen.
function _sbCareTextToCell_(t) {
  var s = String(t == null ? '' : t);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s)) { var d = new Date(s); if (!isNaN(d.getTime())) return d; }
  return s;
}

// reminders: tra mang dong kieu CareData (chi cac cot 0-3, 5, 12, 13 co nghia) hoac UNDEFINED = doc Sheets. Can SB_MODE='read', khong STALE, KHONG co
// SDT dirty nao (dirty = Sheets moi hon Supabase cho SDT do; lich hen cua no co the sai -> doc Sheets cho chac, het dirty bang sbSuaSDTLoi).
// KHONG loc cs o phia server vi Sheets so sanh sau khi trim(); _remindersFromRows_ loc y nhu cu. SDT tra ve la SDT chuan hoa (Sheets: o goc).
function sbReadRemindersRows_() {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_MODE || '').toLowerCase() !== 'read' || pr.SB_STALE || !sbCfg_().ok) return undefined;
    var dirty = [];
    try { dirty = JSON.parse(pr.SB_DIRTY_CARE || '[]'); } catch (e0) { dirty = []; }
    if (dirty.length) return undefined;
    var recs = _sbGetPagesSeq_('care_data?select=phone,status,zalo,cs,sched_hen,sched_hen_note&sched_hen=neq.&order=phone.asc');
    // Lich nhac nhanh (cot schedules, JSON): chi lay dong co chua chuoi ngay HOM NAY (cung cach loc nhanh voi _remindersFromRows_), query rieng
    // de khong doi cau query cu. Gop theo SDT: dong da co o tren thi bo sung cot 5, chua co thi them dong moi (chi cot 0-3, 5 co nghia).
    var tdy = new Date(), tY = tdy.getFullYear() + '-' + ('0' + (tdy.getMonth() + 1)).slice(-2) + '-' + ('0' + tdy.getDate()).slice(-2);
    var recS = _sbGetPagesSeq_('care_data?select=phone,status,zalo,cs,schedules&schedules=ilike.*' + tY + '*&order=phone.asc');
    var again = PropertiesService.getScriptProperties().getProperties();
    if (again.SB_STALE || String(again.SB_MODE || '').toLowerCase() !== 'read' || (again.SB_DIRTY_CARE && again.SB_DIRTY_CARE !== '[]')) return undefined;
    var rows = recs.map(function (g) {
      return [g.phone, g.status || '', g.zalo || '', g.cs || '', '', '', '', '', '', '', '', '', _sbCareTextToCell_(g.sched_hen), g.sched_hen_note || ''];
    });
    var byPh = {};
    rows.forEach(function (r, i) { byPh[r[0]] = i; });
    recS.forEach(function (g) {
      if (byPh[g.phone] !== undefined) { rows[byPh[g.phone]][5] = g.schedules || ''; return; }
      byPh[g.phone] = rows.length;
      rows.push([g.phone, g.status || '', g.zalo || '', g.cs || '', '', g.schedules || '', '', '', '', '', '', '', '', '']);
    });
    return rows;
  } catch (e) {
    try { Logger.log('sbReadRemindersRows_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

function sbOrdReadStatus_() {
  var on = sbOrdReadOn_(), now = Date.now(), pr = PropertiesService.getScriptProperties(), s = _sbOrdState_(pr);
  var one = function (w) { var g = _sbOrdReadGate_(w), x = s[w] || {}; return { readsSupabaseNow: !!g, ageMin: x.syncedAt ? Math.round((now - x.syncedAt) / 60000) : null }; };
  return { on: on, maxAgeMin: Math.round(SB_ORD_MAX_AGE_MS_ / 60000), dt: one('dt'), don: one('don') };
}

// Bat doc don hang tu Supabase. Chi bat khi: da cau hinh, ca 2 bang da dong bo hoan chinh it nhat 1 lan va con moi, doi chieu 2 bang ok:true.
function sbOrdReadEnable_() {
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var st = sbOrdersStatus_(), why = [];
  ['dt', 'don'].forEach(function (w) {
    var x = st[w];
    if (x.syncedAt == null) why.push(w + ': chua tung dong bo xong (chay sbDonHangDongBo)');
    else if (x.ageMin > SB_ORD_MAX_AGE_MS_ / 60000) why.push(w + ': du lieu dong bo da ' + x.ageMin + ' phut (> ' + (SB_ORD_MAX_AGE_MS_ / 60000) + ') — chay lai sbDonHangDongBo / cai trigger');
    if (x.dirtySinceSync) why.push(w + ': CRM da ghi Sheet sau lan dong bo cuoi — chay sbDonHangDongBo roi thu lai');
  });
  if (why.length) return { ok: false, error: why.join('; ') };
  var cdt = sbCompareDT_({ sample: 300 }), cdon = sbCompareDon_({ sample: 300 });
  if (!cdt.ok || !cdon.ok) return { ok: false, error: 'Doi chieu chua khop', dt: cdt, don: cdon };
  _sbSetReadOn_(PropertiesService.getScriptProperties(), 'SB_ORD_READ');
  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; });
  return { ok: true, orderRead: sbOrdReadStatus_(), warning: hasTrigger ? null : 'Chua co trigger dong bo (sbDonHangCaiTrigger) — sau ' + (SB_ORD_MAX_AGE_MS_ / 60000) + ' phut se tu quay ve doc Sheets.' };
}
function sbOrdReadDisable_() {
  _sbSetReadOff_(PropertiesService.getScriptProperties(), 'SB_ORD_READ');
  return { ok: true, orderRead: sbOrdReadStatus_() };
}

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4c) — chon ten ham o o "Run", bam Run, xem "Execution log". Khong can adminKey / URL. ──
//  Dieu kien truoc: 4b xong (sbDonHangDongBo XONG + sbDonHangCaiTrigger). Bat: sbDonHangBatDoc (tu tu choi neu chua dong bo/doi chieu khong khop).
//  Theo doi: sbDonHangTrangThai (muc orderRead). Ve nhu cu: sbDonHangTatDoc (hoac sbTatSupabase). Lich hen: dung cong tac cu sbBatDocSupabase.
function sbDonHangBatDoc() { Logger.log(JSON.stringify(sbOrdReadEnable_(), null, 2)); }
function sbDonHangTatDoc() { Logger.log(JSON.stringify(sbOrdReadDisable_(), null, 2)); }


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4e/5: DOC DANH SACH KHACH (CareData) cua action 'customers' tu Supabase (MAC DINH TAT; fallback Sheets).
//   4e-1  delta (action=customers&since=...): client goi moi ~3 giay/may  -> sbReadCareDelta_   (cong tac SB_CARE_DELTA_READ=on)
//   4e-2  FULL  (action=customers khong since): client keo moi ~5 phut    -> sbReadCareAll_     (cong tac SB_CARE_FULL_READ=on)
//  Dieu kien chung (sai 1 cai -> undefined = doc Sheets nhu cu): SB_MODE=read (cong tac CareData cu, da doi chieu sbDoiChieu ok) + khong STALE +
//  KHONG co SDT dirty nao (dirty = Sheet moi hon Supabase) + cong tac rieng cua muc do = on + da cau hinh URL/key + Supabase khong loi.
//  Delta: truy van Supabase theo updated_at >= since-1h (cot timestamptz) roi LOC LAI bang dung quy tac Sheets (chuoi updated > since) nen ket qua
//  giong het; > 3000 dong -> null (client keo FULL, y nhu readCareDelta_). Chi doi action 'customers'; readCare_ cho bao cao/dashboard noi bo van doc Sheets.
//  Gioi han da biet: (1) dong bi mirror tre vai tram ms sau khi ghi Sheet co the lo mot nhip delta — lan keo FULL (5 phut) tu sua; (2) sua TAY tren Sheet
//  khong co updated => khong vao delta (giong Sheets) va chi vao Supabase khi backfill lai; (3) SDT trung nhieu dong chi con 1 ban (xu ly truoc bang
//  runDedupeCare); (4) SDT tra ve la SDT chuan hoa (Sheets: o goc, vd so thieu 0) — client gop theo SDT chuan hoa nen khong anh huong.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_CARE_DELTA_MAX_ = 3000;   // = nguong idx.length cua readCareDelta_

function _sbCareListGate_(flagKey) {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_MODE || '').toLowerCase() !== 'read' || pr.SB_STALE || !sbCfg_().ok) return false;
    if (String(pr[flagKey] || '').toLowerCase() !== 'on') return false;
    var dirty = [];
    try { dirty = JSON.parse(pr.SB_DIRTY_CARE || '[]'); } catch (e0) { dirty = []; }
    return dirty.length === 0;
  } catch (e) { return false; }
}

// 4e-2. Tra mang careObj (tat ca SDT) | undefined (doc Sheets). Dem truoc (count=exact) roi tai song song; lech so dong -> Sheets.
function sbReadCareAll_() {
  try {
    if (!_sbCareListGate_('SB_CARE_FULL_READ')) return undefined;
    var res = sb_('GET', 'care_data?select=phone&limit=1', null, { Prefer: 'count=exact' });
    var m = String(_sbHeader_(res.headers, 'content-range') || '').match(/\/(\d+)$/);
    if (!m) return undefined;
    var total = parseInt(m[1], 10);
    var recs = _sbGetAllRows_('care_data?select=*&order=phone.asc', total);
    if (recs.length !== total) { Logger.log('sbReadCareAll_: lech so dong (tai ' + recs.length + ' vs dem ' + total + ') — doc Sheets thay the'); return undefined; }
    if (!_sbCareListGate_('SB_CARE_FULL_READ')) return undefined;   // trong luc tai co dirty/STALE/tat -> bo, doc Sheets
    var out = [];
    for (var i = 0; i < recs.length; i++) if (recs[i].phone) out.push(sbRecToCareObj_(recs[i]));
    return out;
  } catch (e) {
    try { Logger.log('sbReadCareAll_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// 4e-1. Tra { delta:true, rows } | null (qua nhieu -> keo FULL) | undefined (doc Sheets).
function sbReadCareDelta_(since) {
  try {
    if (!_sbCareListGate_('SB_CARE_DELTA_READ')) return undefined;
    var t = new Date(since);
    if (isNaN(t.getTime())) return undefined;
    var lo = new Date(t.getTime() - 3600000).toISOString();
    var recs = _sbGetPagesSeq_('care_data?select=*&updated_at=gte.' + encodeURIComponent(lo) + '&order=phone.asc');
    if (!_sbCareListGate_('SB_CARE_DELTA_READ')) return undefined;   // trong luc tai co dirty/STALE/tat -> bo, doc Sheets
    var rows = [];
    for (var i = 0; i < recs.length; i++) {
      var us = String(recs[i].updated || '');
      if (us && us > since && recs[i].phone) rows.push(recs[i]);   // CUNG quy tac voi readCareDelta_
    }
    if (rows.length > SB_CARE_DELTA_MAX_) return null;
    return { delta: true, rows: rows.map(sbRecToCareObj_) };
  } catch (e) {
    try { Logger.log('sbReadCareDelta_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

function sbCareListStatus_() {
  var pr = PropertiesService.getScriptProperties();
  return { deltaOn: String(pr.getProperty('SB_CARE_DELTA_READ') || '') === 'on', fullOn: String(pr.getProperty('SB_CARE_FULL_READ') || '') === 'on',
    deltaReadsSupabaseNow: _sbCareListGate_('SB_CARE_DELTA_READ'), fullReadsSupabaseNow: _sbCareListGate_('SB_CARE_FULL_READ') };
}
// Bat 1 muc (flagKey = 'SB_CARE_DELTA_READ' | 'SB_CARE_FULL_READ'). Chi bat khi SB_MODE=read, khong STALE, khong dirty, doi chieu CareData ok:true.
function sbCareListEnable_(flagKey) {
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  if (sbMode_() !== 'read') return { ok: false, error: "Phai bat doc CareData truoc (sbBatDocSupabase -> SB_MODE=read), hien dang '" + sbMode_() + "'." };
  if (sbStaleInfo_()) return { ok: false, error: 'Supabase dang STALE (' + sbStaleInfo_() + ').' };
  if (sbDirtyList_().length) return { ok: false, error: 'Con ' + sbDirtyList_().length + ' SDT dirty — chay sbSuaSDTLoi roi thu lai.' };
  var c = sbCompareCare_({ sample: 300 });
  if (!c.ok) return { ok: false, error: 'Doi chieu CareData chua khop', compare: c };
  _sbSetReadOn_(PropertiesService.getScriptProperties(), flagKey);
  return { ok: true, careListRead: sbCareListStatus_() };
}
function sbCareListDisable_(flagKey) { _sbSetReadOff_(PropertiesService.getScriptProperties(), flagKey); return { ok: true, careListRead: sbCareListStatus_() }; }

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4e) — chon ten ham o o "Run", bam Run, xem "Execution log". ──
//  Dieu kien truoc: sbBatDocSupabase da chay (SB_MODE=read) va sbXemTrangThai khong STALE/dirty. Nen bat DELTA truoc, theo doi, roi moi bat FULL.
//  Ve nhu cu: sbKHDeltaTat / sbKHFullTat (hoac sbTatSupabase tat het).
function sbKHDeltaBat() { Logger.log(JSON.stringify(sbCareListEnable_('SB_CARE_DELTA_READ'), null, 2)); }
function sbKHDeltaTat() { Logger.log(JSON.stringify(sbCareListDisable_('SB_CARE_DELTA_READ'), null, 2)); }
function sbKHFullBat()  { Logger.log(JSON.stringify(sbCareListEnable_('SB_CARE_FULL_READ'), null, 2)); }
function sbKHFullTat()  { Logger.log(JSON.stringify(sbCareListDisable_('SB_CARE_FULL_READ'), null, 2)); }


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 5a/5: KIEM TRA SAN SANG truoc khi bo dual-write. CHI DOC: khong doi cong tac, khong ghi du lieu, khong tu bo dual-write.
//  Chay tay: sbSanSangBuoc5 (Apps Script Editor > Run > xem Execution log). Ket qua: autoOk=true chi nghia la CAC DIEU KIEN TU DONG DAT;
//  danh sach "manual" (viec phai lam / quyet dinh cua nguoi) luon di kem — bo dual-write chi khi ca 2 deu xong. Thiet ke: docs/SUPABASE-PLAN.md muc "Buoc 5".
//  Moc thoi gian bat doc: moi cong tac doc (SB_ORD_READ, SB_CARE_DELTA_READ, SB_CARE_FULL_READ) co them Script Property <ten>_AT (ms) ghi LUC BAT
//  (_sbSetReadOn_) va xoa khi tat — de tinh "da bat du lau" (SB_SOAK_DAYS_). Cong tac bat truoc ban nay chua co moc -> phai tat roi bat lai.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_SOAK_DAYS_ = 7;   // phai bat doc lien tuc it nhat chung nay ngay moi coi la "da chay thu du lau"

function _sbSetReadOn_(pr, key) {
  pr.setProperty(key, 'on');
  if (!pr.getProperty(key + '_AT')) pr.setProperty(key + '_AT', String(Date.now()));   // giu moc dau tien neu bat lai khi dang bat
}
function _sbSetReadOff_(pr, key) { pr.deleteProperty(key); pr.deleteProperty(key + '_AT'); }

// CareData: toi da tuoi du lieu dong bo dinh ky (Buoc B) duoc coi la "moi" = 3 chu ky trigger (giong SB_ORD_MAX_AGE_MS_ cua don hang).
var SB_CARE_MAX_AGE_MS_ = 3 * SB_CARE_SYNC_TICK_MINUTES_ * 60000;
var SB_STEP5_MANUAL_ = [
  'CareData da co dong bo dinh ky Sheet -> Supabase (Buoc B, sbSyncCare_) nhung CHI upsert: dong bi XOA tren Sheet (dedupe, xoa tay) KHONG tu xoa tren Supabase — phai chay tay sbXoaDongThuaThu / sbXoaDongThuaThat (co check theo doi). Neu bo ghi song song, moi lan CS luu van chi len Supabase qua tick (tre toi da ~10 phut) va cong an toan (dirty) khong con. Can thiet ke duong ghi chinh vao Supabase (Buoc C) + dong bo xoa truoc.',
  'Duong ghi NGOAI CRM: tool Base/Pos day don vao Sheet va nhan vien sua TAY tren Sheet — len Supabase o tick dinh ky (don hang 4b, CareData Buoc B; toi da ~10 phut); dong BI XOA tren Sheet cua CareData chi mat khoi Supabase khi chay tay sbXoaDongThuaThat.',
  'Bao cao/dashboard noi bo van doc readCare_/readAllOrders_ tu Sheets (4e-3 chua lam): neu Sheets ngung cap nhat thi bao cao cu dan.',
  'Quy tac nghiep vu: DT Tong duoc quan ly truc tiep tren Google Sheets (saveOrders co y tat). Chuyen nguon that cua don hang sang Supabase la quyet dinh cua Duyen, khong phai ky thuat.',
  'Da co sao luu Supabase ra Drive (sbBackup_, hang ngay) nhung CHUA thu KHOI PHUC that (sbKhoiPhuc*) va chua quyet huong archive (docs/ARCHIVE-PLAN.md) chong cheo voi Supabase.',
  'Chua thu ROLLBACK that tren du lieu that: tat het cong tac doc bang sbTatSupabase roi kiem tra CRM van chay dung tu Sheets.'
];

function sbSanSangBuoc5_(opts) {
  opts = opts || {};
  var sample = Math.max(1, Math.min(300, parseInt(opts.sample, 10) || 200));
  var checks = [];
  var add = function (name, ok, detail) { checks.push({ name: name, ok: !!ok, detail: detail || '' }); };
  var safe = function (fn) { try { return fn(); } catch (e) { return { ok: false, error: String(e && e.message || e) }; } };
  var cfg = sbCfg_().ok;
  add('Da cau hinh SUPABASE_URL / SUPABASE_KEY', cfg, cfg ? '' : 'Thieu trong Script Properties');
  if (cfg) {
    var pr = PropertiesService.getScriptProperties(), now = Date.now();
    add("CareData dang o che do 'read'", sbMode_() === 'read', "hien dang '" + sbMode_() + "'");
    var stale = sbStaleInfo_(); add('Supabase khong STALE', !stale, stale || '');
    var dirty = sbDirtyList_(); add('Khong co SDT dirty (CareData)', dirty.length === 0, dirty.length ? dirty.length + ' SDT dirty (chay sbSuaSDTLoi)' : '');
    var cc = safe(function () { return sbCompareCare_({ sample: sample }); });
    add('Doi chieu CareData khop (mau ' + sample + ')', cc.ok === true, cc.ok === true ? '' : JSON.stringify(cc).slice(0, 300));
    var os = safe(function () { return sbOrdersStatus_(); });
    ['dt', 'don'].forEach(function (w) {
      var x = (os && os[w]) || {}, bad = [];
      if (x.syncedAt == null) bad.push('chua dong bo xong lan nao');
      else if (x.ageMin > SB_ORD_MAX_AGE_MS_ / 60000) bad.push('du lieu dong bo da ' + x.ageMin + ' phut');
      if (x.dirtySinceSync) bad.push('CRM da ghi sau lan dong bo cuoi');
      if (x.lastError) bad.push('loi gan nhat: ' + String(x.lastError).slice(0, 120));
      add('Don hang (' + w + '): dong bo moi, khong dirty, khong loi', bad.length === 0, bad.join('; '));
      var cmp = safe(function () { return sbCompareOrders_(w, { sample: sample }); });
      add('Doi chieu don hang (' + w + ') khop (mau ' + sample + ')', cmp.ok === true, cmp.ok === true ? '' : JSON.stringify(cmp).slice(0, 300));
    });
    var hasTick = false; try { hasTick = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; }); } catch (eT) {}
    add('Trigger dong bo don hang (sbOrdersTick_) dang chay', hasTick, hasTick ? '' : 'Chay sbDonHangCaiTrigger');
    // Buoc B: dong bo dinh ky CareData — luoi an toan cho sua tay/import tren Sheet (ghi song song khong bat duoc)
    var cs = safe(function () { return sbCareSyncStatus_(); }), badC = [];
    if (cs.ok === false) badC.push('khong doc duoc trang thai: ' + String(cs.error || '').slice(0, 120));
    else {
      if (cs.syncedAt == null) badC.push('chua dong bo xong lan nao (chay sbKHDongBo)');
      else if (cs.ageMin > SB_CARE_MAX_AGE_MS_ / 60000) badC.push('du lieu dong bo da ' + cs.ageMin + ' phut (toi da ' + SB_CARE_MAX_AGE_MS_ / 60000 + ')');
      if (cs.lastError) badC.push('loi gan nhat: ' + String(cs.lastError).slice(0, 120));
    }
    add('CareData: dong bo dinh ky (Buoc B) moi, khong loi', badC.length === 0, badC.join('; '));
    var careTick = cs && cs.triggerOn === true;
    add('Trigger dong bo CareData (sbCareTick_) dang chay', careTick, careTick ? '' : 'Chay sbKHCaiTrigger');
    // Sao luu Supabase ra Drive (Free khong co backup tu dong): ban gan nhat phai moi + trigger hang ngay phai song
    var bk = safe(function () { return sbBackupStatus_(); }), badB = [];
    if (bk.ok === false) badB.push('khong doc duoc trang thai: ' + String(bk.error || '').slice(0, 120));
    else {
      if (bk.lastOkAt == null) badB.push('chua co ban sao luu day du nao (chay sbSaoLuuSupabase)');
      else if (bk.ageHours > SB_BACKUP_MAX_AGE_MS_ / 3600000) badB.push('ban gan nhat da ' + bk.ageHours + ' gio (toi da ' + SB_BACKUP_MAX_AGE_MS_ / 3600000 + ')');
      if (bk.lastError) badB.push('loi gan nhat: ' + String(bk.lastError).slice(0, 120));
    }
    add('Sao luu Supabase ra Drive: ban gan nhat moi, khong loi', badB.length === 0, badB.join('; '));
    var bkTick = bk && bk.triggerOn === true;
    add('Trigger sao luu Supabase (sbBackupTick_) dang chay', bkTick, bkTick ? '' : 'Chay sbSaoLuuCaiTrigger');
    // Dong DA XOA khoi Sheet nhung con tren Supabase (Buoc B chi upsert): dry-run, khong xoa gi
    var pc = safe(function () { return sbPruneCare_({ dryRun: true }); });
    var pcOk = pc.ok === true && pc.extra === 0;
    add('CareData: khong con dong thua tren Supabase (da xoa khoi Sheet)', pcOk, pcOk ? '' : (pc.ok === false ? 'khong kiem tra duoc: ' + String(pc.error || '').slice(0, 120) : pc.extra + ' SDT thua (vd ' + (pc.sample || []).slice(0, 3).join(', ') + ') — chay sbXoaDongThuaThu roi sbXoaDongThuaThat'));
    [['SB_ORD_READ', 'Doc don hang tu Supabase'], ['SB_CARE_DELTA_READ', 'Doc khach (delta) tu Supabase'], ['SB_CARE_FULL_READ', 'Doc khach (FULL) tu Supabase']].forEach(function (c) {
      var on = String(pr.getProperty(c[0]) || '').toLowerCase() === 'on', at = parseInt(pr.getProperty(c[0] + '_AT') || '0', 10);
      var days = at ? Math.floor((now - at) / 86400000) : null, ok = on && at > 0 && days >= SB_SOAK_DAYS_, d = '';
      if (!on) d = 'dang TAT';
      else if (!at) d = 'chua co moc thoi gian bat (bat truoc ban nay) — tat roi bat lai de tinh';
      else if (days < SB_SOAK_DAYS_) d = 'moi bat ' + days + ' ngay, can >= ' + SB_SOAK_DAYS_;
      add(c[1] + ' da bat >= ' + SB_SOAK_DAYS_ + ' ngay', ok, d);
    });
  }
  var failing = checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.name; });
  var autoOk = failing.length === 0;
  return { ok: true, autoOk: autoOk, failing: failing, checks: checks, manual: SB_STEP5_MANUAL_.slice(),
    verdict: autoOk ? 'Cac dieu kien TU DONG da dat. Van con ' + SB_STEP5_MANUAL_.length + ' muc thu cong (manual) — CHI bo dual-write khi tat ca da xong va Duyen dong y.'
      : 'CHUA nen bo dual-write: ' + failing.length + ' dieu kien tu dong chua dat. Khong co gi bi doi.' };
}

// CHAY TAY (buoc 5a): chi doc/ghi log, khong doi gi. Muc "manual" luon phai doc.
function sbSanSangBuoc5() {
  var r = sbSanSangBuoc5_();
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(r.verdict);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — SAO LUU RA GOOGLE DRIVE (docs/MIGRATE-SUPABASE-FULL.md, giai doan 2): Supabase Free KHONG co sao luu hang ngay.
//  Moi lan chay: doc TOAN BO 3 bang (care_data, dt_tong, don_chi_tiet; ke ca dong archived) phan trang 1000 dong, moi bang 1 file
//  `<bang>_<yyyy-MM-dd_HHmm>.json.gz` trong thu muc Drive RIENG "CRM Supabase Backup" (rieng tu — chua du lieu khach, KHONG chia se,
//  KHONG dua vao repo). Ghi xong DOC LAI file de kiem tra (so dong) roi moi xoa ban cu (giu SB_BACKUP_KEEP_ ban moi nhat moi bang).
//  Chay het 3 bang moi tinh la "xong"; het gio giua chung thi lan sau tiep tuc (SB_BACKUP_STATE). Khong dung Script Lock (khong chan CS luu):
//  dung co SB_BACKUP_RUNNING (het han sau 8 phut). Doc theo OFFSET nen neu CRM ghi trong luc sao luu, so dong co the lech nhe — co canh bao `warn`.
//  KHOI PHUC (sbRestoreBackup_): chi UPSERT lai cac dong trong file (khong xoa dong thua), mac dinh chay thu (dryRun). Khoi phuc se GHI DE
//  gia tri moi hon bang gia tri cua ban sao luu — chi dung khi du lieu Supabase hong/mat; sau do chay sbKHDongBoLai de Sheet -> Supabase neu can.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_BACKUP_TABLES_ = [
  { t: 'care_data', order: 'phone.asc', key: ['phone'] },
  { t: 'dt_tong', order: 'id.asc,src_row.asc', key: ['id', 'src_row'] },
  { t: 'don_chi_tiet', order: 'src_row.asc', key: ['src_row'] }
];
var SB_BACKUP_PAGE_ = 1000;                    // dong/trang (PostgREST mac dinh toi da 1000)
var SB_BACKUP_KEEP_ = 7;                       // so ban giu lai moi bang
var SB_BACKUP_FOLDER_NAME_ = 'CRM Supabase Backup';
var SB_BACKUP_MAX_AGE_MS_ = 36 * 3600 * 1000;  // ban sao luu day du gan nhat qua 36 gio = cu (sbSanSangBuoc5)
var SB_BACKUP_RUN_TTL_MS_ = 8 * 60 * 1000;
var SB_BACKUP_STALE_RUN_MS_ = 20 * 3600 * 1000; // dot do dang tu hom truoc thi bo, bat dau dot moi

function _sbBackupState_(pr) { var s = {}; try { s = JSON.parse(pr.getProperty('SB_BACKUP_STATE') || '{}') || {}; } catch (e) { s = {}; } return s; }
function _sbBackupStamp_() {   // yyyy-MM-dd_HHmm theo gio VN (+7 co dinh, khong phu thuoc Time Zone cua du an)
  var d = new Date(Date.now() + VN_OFFSET_MS), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) + '_' + p2(d.getUTCHours()) + p2(d.getUTCMinutes());
}
function _sbBackupFolder_() {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('SB_BACKUP_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(SB_BACKUP_FOLDER_NAME_), f = it.hasNext() ? it.next() : DriveApp.createFolder(SB_BACKUP_FOLDER_NAME_);
  pr.setProperty('SB_BACKUP_FOLDER_ID', f.getId());
  return f;
}
function _sbBackupFiles_(folder, table) {   // cac file sao luu cua 1 bang, MOI NHAT truoc
  var out = [], it = folder.getFiles(), pre = table + '_';
  while (it.hasNext()) { var f = it.next(), n = String(f.getName()); if (n.indexOf(pre) === 0 && /\.json\.gz$/.test(n)) out.push(f); }
  out.sort(function (a, b) { return a.getName() < b.getName() ? 1 : (a.getName() > b.getName() ? -1 : 0); });
  return out;
}
function _sbBackupFetchTable_(spec, deadline) {
  var rows = [], seen = {}, total = -1, off = 0, dup = 0;
  for (;;) {
    var res = sb_('GET', spec.t + '?select=*&order=' + spec.order + '&limit=' + SB_BACKUP_PAGE_ + '&offset=' + off, null, off === 0 ? { Prefer: 'count=exact' } : null);
    if (off === 0) { var m = String(_sbHeader_(res.headers, 'content-range') || '').match(/\/(\d+)$/); total = m ? parseInt(m[1], 10) : -1; }
    var arr = res.json;
    if (!Array.isArray(arr)) throw new Error('Phan hoi ' + spec.t + ' khong phai mang');
    for (var i = 0; i < arr.length; i++) {
      var k = spec.key.map(function (c) { return String(arr[i][c]); }).join('|');
      if (seen[k]) { dup++; continue; }
      seen[k] = 1; rows.push(arr[i]);
    }
    if (arr.length < SB_BACKUP_PAGE_) break;
    off += SB_BACKUP_PAGE_;
    if (Date.now() > deadline) throw new Error('Het gio khi doc ' + spec.t + ' (da ' + rows.length + ' dong) — chay lai');
  }
  return { rows: rows, total: total, dup: dup };
}
// opts: { fresh (bo dot dang do, bat dau dot moi) }. KHONG nem loi ra ngoai. Tra { ok, complete, tables:{<bang>:{name,id,rows,total,bytes,at,warn}}, error? }
function sbBackup_(opts) {
  opts = opts || {};
  var out = { ok: false, complete: false, tables: {} };
  if (!sbCfg_().ok) { out.error = 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.'; return out; }
  var pr = PropertiesService.getScriptProperties(), t0 = Date.now(), running = parseInt(pr.getProperty('SB_BACKUP_RUNNING') || '0', 10);
  if (running && t0 - running < SB_BACKUP_RUN_TTL_MS_) { out.ok = true; out.skipped = true; return out; }
  pr.setProperty('SB_BACKUP_RUNNING', String(t0));
  var deadline = t0 + SB_TIME_BUDGET_MS_;
  try {
    var st = _sbBackupState_(pr), run = st.run;
    if (!run || run.complete || opts.fresh || t0 - run.startedAt > SB_BACKUP_STALE_RUN_MS_) run = { stamp: _sbBackupStamp_(), startedAt: t0, done: {}, complete: false };
    var folder = _sbBackupFolder_();
    for (var i = 0; i < SB_BACKUP_TABLES_.length; i++) {
      var spec = SB_BACKUP_TABLES_[i];
      if (run.done[spec.t]) continue;
      if (Object.keys(out.tables).length && Date.now() >= deadline) { out.timeUp = true; break; }
      var data = _sbBackupFetchTable_(spec, deadline), n = data.rows.length, name = spec.t + '_' + run.stamp + '.json.gz';
      var payload = JSON.stringify({ table: spec.t, takenAt: new Date().toISOString(), count: n, total: data.total, rows: data.rows });
      var gz = Utilities.gzip(Utilities.newBlob(payload, 'application/json', spec.t + '_' + run.stamp + '.json'), name);
      var file = folder.createFile(gz);
      var back = null; try { back = JSON.parse(Utilities.ungzip(file.getBlob()).getDataAsString()); } catch (eV) {}
      if (!back || back.count !== n || !Array.isArray(back.rows) || back.rows.length !== n) { try { file.setTrashed(true); } catch (eT) {} throw new Error('Doc lai file ' + name + ' de kiem tra: KHONG khop — da xoa file loi, ban cu giu nguyen.'); }
      var info = { name: name, id: file.getId(), rows: n, total: data.total, bytes: gz.getBytes().length, at: new Date().toISOString(), warn: '' };
      if (data.total >= 0 && data.total !== n) info.warn = 'so dong doc (' + n + ') khac so dem (' + data.total + ') — du lieu doi trong luc sao luu, nen chay lai neu can ban chinh xac';
      run.done[spec.t] = info; out.tables[spec.t] = info; st.run = run;
      pr.setProperty('SB_BACKUP_STATE', JSON.stringify(st));   // luu ngay sau MOI bang (het gio giua chung van giu phan da xong)
      var old = _sbBackupFiles_(folder, spec.t);                // chi xoa ban cu SAU khi ban moi da doc lai OK
      for (var k = SB_BACKUP_KEEP_; k < old.length; k++) { try { old[k].setTrashed(true); } catch (eD) {} }
    }
    run.complete = SB_BACKUP_TABLES_.every(function (sp) { return !!run.done[sp.t]; });
    st.run = run;
    if (run.complete) { st.lastOkAt = t0; st.last = run.done; st.err = ''; st.errAt = 0; }
    pr.setProperty('SB_BACKUP_STATE', JSON.stringify(st));
    out.ok = true; out.complete = run.complete; out.ms = Date.now() - t0;
    return out;
  } catch (e) {
    out.error = String(e && e.message || e); out.ms = Date.now() - t0;
    try { var s2 = _sbBackupState_(pr); s2.err = out.error; s2.errAt = Date.now(); pr.setProperty('SB_BACKUP_STATE', JSON.stringify(s2)); } catch (e2) {}
    return out;
  } finally { try { pr.deleteProperty('SB_BACKUP_RUNNING'); } catch (eF) {} }
}
function sbBackupTick_() { try { Logger.log('sbBackupTick ' + JSON.stringify(sbBackup_())); } catch (e) { Logger.log('sbBackupTick loi: ' + e); } }
function installSbBackupTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sbBackupTick_'; });
  if (ex.length) return 'Trigger "sbBackupTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('sbBackupTick_').timeBased().everyDays(1).atHour(2).create();
  return 'Da tao trigger sbBackupTick_ chay moi ngay (khoang 2h sang).';
}
function removeSbBackupTrigger_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sbBackupTick_') { ScriptApp.deleteTrigger(t); n++; } });
  return 'Da go ' + n + ' trigger sbBackupTick_.';
}
function sbBackupStatus_() {
  var pr = PropertiesService.getScriptProperties(), s = _sbBackupState_(pr), has = false;
  try { has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbBackupTick_'; }); } catch (e) {}
  var files = {}; Object.keys(s.last || {}).forEach(function (t) { var x = s.last[t]; files[t] = { name: x.name, rows: x.rows, bytes: x.bytes, warn: x.warn || '' }; });
  return { ok: true, triggerOn: has, lastOkAt: s.lastOkAt ? new Date(s.lastOkAt).toISOString() : null, ageHours: s.lastOkAt ? Math.round((Date.now() - s.lastOkAt) / 360000) / 10 : null,
    lastError: s.err || null, running: !!(s.run && !s.run.complete), files: files, folderId: pr.getProperty('SB_BACKUP_FOLDER_ID') || null };
}
// opts: { table: 'care_data'|'dt_tong'|'don_chi_tiet', fileId (mac dinh: ban MOI NHAT), dryRun (mac dinh TRUE), reset }. Upsert tung lo 500, con tro SB_RESTORE_<bang>.
function sbRestoreBackup_(opts) {
  opts = opts || {};
  var dryRun = opts.dryRun !== false && opts.dryRun !== 'false';
  var spec = SB_BACKUP_TABLES_.filter(function (x) { return x.t === opts.table; })[0];
  if (!spec) return { ok: false, error: 'table phai la care_data | dt_tong | don_chi_tiet' };
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var pr = PropertiesService.getScriptProperties(), curKey = 'SB_RESTORE_' + spec.t.toUpperCase();
  try {
    var file = opts.fileId ? DriveApp.getFileById(opts.fileId) : (_sbBackupFiles_(_sbBackupFolder_(), spec.t)[0] || null);
    if (!file) return { ok: false, error: 'Khong co file sao luu nao cho ' + spec.t + ' (chay sbSaoLuuSupabase truoc).' };
    var back = JSON.parse(Utilities.ungzip(file.getBlob()).getDataAsString());
    if (!back || back.table !== spec.t || !Array.isArray(back.rows)) return { ok: false, error: 'File ' + file.getName() + ' khong phai ban sao luu cua ' + spec.t };
    var cur = -1; try { var m = String(_sbHeader_(sb_('GET', spec.t + '?select=' + spec.key[0] + '&limit=1', null, { Prefer: 'count=exact' }).headers, 'content-range') || '').match(/\/(\d+)$/); cur = m ? parseInt(m[1], 10) : -1; } catch (eC) {}
    var res = { ok: true, dryRun: dryRun, table: spec.t, file: file.getName(), takenAt: back.takenAt, backupRows: back.rows.length, supabaseRowsNow: cur };
    if (dryRun) { res.hint = 'Chay thu (chua ghi). Khoi phuc that se GHI DE dong hien co bang gia tri cua ban sao luu; khong xoa dong thua.'; return res; }
    if (opts.reset === true || opts.reset === 'true') pr.deleteProperty(curKey);
    var c = {}; try { c = JSON.parse(pr.getProperty(curKey) || '{}') || {}; } catch (eP) { c = {}; }
    var i = (c.file === file.getName() && c.i > 0) ? c.i : 0, t0 = Date.now(), batches = 0;
    while (i < back.rows.length && (batches === 0 || Date.now() - t0 < SB_TIME_BUDGET_MS_)) {
      sb_('POST', spec.t + '?on_conflict=' + spec.key.join(','), back.rows.slice(i, i + SB_BATCH_), { Prefer: 'resolution=merge-duplicates,return=minimal' });
      i += SB_BATCH_; batches++;
      pr.setProperty(curKey, JSON.stringify({ file: file.getName(), i: Math.min(i, back.rows.length) }));
    }
    res.done = i >= back.rows.length; res.restored = Math.min(i, back.rows.length);
    if (res.done) pr.deleteProperty(curKey);
    res.hint = res.done ? 'XONG khoi phuc ' + spec.t + '. Chay sbDoiChieu / sbSanSangBuoc5 de kiem tra.' : 'CHUA HET — chay lai de tiep tuc.';
    return res;
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
// ── CHAY TAY TU APPS SCRIPT EDITOR (sao luu) ──
function sbSaoLuuSupabase() { var r = sbBackup_(); Logger.log(JSON.stringify(r, null, 2)); Logger.log(!r.ok ? 'LOI — xem "error".' : (r.skipped ? 'DANG CO LAN KHAC CHAY — thu lai sau it phut.' : (r.complete ? 'XONG — 3 bang da sao luu vao Drive, thu muc "' + SB_BACKUP_FOLDER_NAME_ + '".' : 'CHUA HET — bam Run lai.'))); }
function sbSaoLuuLai() { var r = sbBackup_({ fresh: true }); Logger.log(JSON.stringify(r, null, 2)); }   // bo dot dang do, sao luu moi tu dau
function sbSaoLuuCaiTrigger() { Logger.log(installSbBackupTrigger_()); }
function sbSaoLuuGoTrigger() { Logger.log(removeSbBackupTrigger_()); }
function sbSaoLuuTrangThai() { Logger.log(JSON.stringify(sbBackupStatus_(), null, 2)); }
function _sbLogRestore_(r) { Logger.log(JSON.stringify(r, null, 2)); }
function sbKhoiPhucThu() { SB_BACKUP_TABLES_.forEach(function (sp) { _sbLogRestore_(sbRestoreBackup_({ table: sp.t, dryRun: true })); }); }   // CHI DOC: xem file + so dong, KHONG ghi
function sbKhoiPhucThatCare() { _sbLogRestore_(sbRestoreBackup_({ table: 'care_data', dryRun: false })); }          // GHI DE care_data bang ban sao luu moi nhat
function sbKhoiPhucThatDT() { _sbLogRestore_(sbRestoreBackup_({ table: 'dt_tong', dryRun: false })); }
function sbKhoiPhucThatDon() { _sbLogRestore_(sbRestoreBackup_({ table: 'don_chi_tiet', dryRun: false })); }

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — DONG BO XOA dong CareData (Buoc B chi UPSERT nen dong bi xoa khoi Sheet — dedupe/xoa tay — van con tren Supabase va
//  cong doc se tiep tuc hien khach da xoa). sbPruneCare_ so KHOA SDT: Supabase co ma Sheet khong con => xoa khoi Supabase.
//  An toan (xoa du lieu THAT, nen nhieu lop): (1) MAC DINH CHAY THU (dryRun); (2) doc Supabase TRUOC roi moi doc Sheet — dong CRM vua them
//  (Sheet ghi truoc, mirror sau) luon co mat o Sheet, khong bi coi la thua; (3) bo qua dong cap nhat trong SB_PRUNE_GRACE_MS_ gan day;
//  (4) tu choi neu Sheet khong co SDT nao; (5) tu choi neu so dong thua > max(SB_PRUNE_MAX_ABS_, SB_PRUNE_MAX_PCT_ x tong) (bao ve khi Sheet bi
//  loi/xoa nham nhieu) — vuot thi dung va bao, KHONG xoa; (6) chi xoa that khi co ban SAO LUU day du <= SB_BACKUP_MAX_AGE_MS_;
//  (7) luu ban sao day du cac dong sap xoa ra Drive (pruned_care_data_*.json.gz, doc lai kiem tra) TRUOC khi xoa. KHONG tu chay (khong trigger).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_PRUNE_MAX_ABS_ = 20;
var SB_PRUNE_MAX_PCT_ = 0.02;
var SB_PRUNE_GRACE_MS_ = 60 * 60000;
var SB_PRUNE_CHUNK_ = 100;
function _sbCareKeys_() {   // [{phone, updated_at}] cua TOAN BO care_data (phan trang 1000)
  var out = [], off = 0;
  for (;;) {
    var arr = sb_('GET', 'care_data?select=phone,updated_at&order=phone.asc&limit=1000&offset=' + off).json;
    if (!Array.isArray(arr)) throw new Error('Phan hoi care_data khong phai mang');
    out = out.concat(arr);
    if (arr.length < 1000) break;
    off += 1000;
  }
  return out;
}
// opts: { dryRun (mac dinh TRUE), max (ghi de nguong, so dong) }. Khong nem loi. Tra { ok, dryRun, extra, sample, graced, maxAllowed, refused?, deleted?, backupFile? }
function sbPruneCare_(opts) {
  opts = opts || {};
  var dryRun = opts.dryRun !== false && opts.dryRun !== 'false';
  var out = { ok: false, dryRun: dryRun };
  if (!sbCfg_().ok) { out.error = 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.'; return out; }
  try {
    var sbRows = _sbCareKeys_();   // 1) Supabase TRUOC ...
    var sh = getSheet_(SH_CARE, CARE_HEADERS), last = sh.getLastRow(), on = {}, nSheet = 0;
    if (last >= 2) {                 // 2) ... roi moi toi Sheet
      var col = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < col.length; i++) { var p = normPhone_(_sbCell_(col[i][0])); if (p && !on[p]) { on[p] = 1; nSheet++; } }
    }
    out.supabaseRows = sbRows.length; out.sheetPhones = nSheet;
    if (!nSheet) { out.ok = true; out.refused = 'Sheet CareData khong co SDT nao — khong xoa gi.'; out.extra = null; return out; }
    var now = Date.now(), cand = [], graced = 0;
    sbRows.forEach(function (r) {
      if (on[r.phone]) return;
      var t = Date.parse(r.updated_at);
      if (t && now - t < SB_PRUNE_GRACE_MS_) { graced++; return; }
      if (!/^\d+$/.test(String(r.phone))) return;   // khoa la so — khong dung ky tu la trong bo loc xoa
      cand.push(String(r.phone));
    });
    var maxAllowed = opts.max != null ? Math.max(0, parseInt(opts.max, 10) || 0) : Math.max(SB_PRUNE_MAX_ABS_, Math.ceil(sbRows.length * SB_PRUNE_MAX_PCT_));
    out.extra = cand.length; out.sample = cand.slice(0, 10); out.graced = graced; out.maxAllowed = maxAllowed;
    var bk = sbBackupStatus_(); out.backupAgeHours = bk.ageHours; out.backupOk = bk.lastOkAt != null && bk.ageHours <= SB_BACKUP_MAX_AGE_MS_ / 3600000;
    out.ok = true;
    if (!cand.length) { out.hint = 'Khong co dong thua.'; return out; }
    if (cand.length > maxAllowed) { out.refused = 'So dong thua (' + cand.length + ') vuot nguong an toan (' + maxAllowed + ') — DUNG, khong xoa. Kiem tra Sheet CareData co bi mat/xoa nham khong; neu dung that su, goi lai voi max lon hon.'; return out; }
    if (dryRun) { out.hint = 'Chay thu (chua xoa). Goi sbXoaDongThuaThat (can ban sao luu <= ' + SB_BACKUP_MAX_AGE_MS_ / 3600000 + ' gio).'; return out; }
    if (!out.backupOk) { out.refused = 'Chua co ban sao luu day du <= ' + SB_BACKUP_MAX_AGE_MS_ / 3600000 + ' gio (chay sbSaoLuuSupabase truoc) — khong xoa.'; return out; }
    // (7) luu ban sao day du cac dong sap xoa, doc lai kiem tra, ROI MOI xoa
    var full = [];
    for (var a = 0; a < cand.length; a += SB_PRUNE_CHUNK_) {
      var got = sb_('GET', 'care_data?select=*&phone=in.(' + cand.slice(a, a + SB_PRUNE_CHUNK_).join(',') + ')').json;
      if (!Array.isArray(got)) throw new Error('Phan hoi khong phai mang khi luu ban sao');
      full = full.concat(got);
    }
    var name = 'pruned_care_data_' + _sbBackupStamp_() + '.json.gz';
    var gz = Utilities.gzip(Utilities.newBlob(JSON.stringify({ table: 'care_data', pruned: true, takenAt: new Date().toISOString(), count: full.length, rows: full }), 'application/json', name.replace(/\.gz$/, '')), name);
    var file = _sbBackupFolder_().createFile(gz), back = null;
    try { back = JSON.parse(Utilities.ungzip(file.getBlob()).getDataAsString()); } catch (eV) {}
    if (!back || back.count !== full.length || !Array.isArray(back.rows) || back.rows.length !== full.length) { try { file.setTrashed(true); } catch (eT) {} throw new Error('Doc lai file ban sao ' + name + ' KHONG khop — chua xoa gi.'); }
    out.backupFile = name; out.backupRows = full.length;
    var del = 0;
    for (var b = 0; b < cand.length; b += SB_PRUNE_CHUNK_) {
      var chunk = cand.slice(b, b + SB_PRUNE_CHUNK_);
      sb_('DELETE', 'care_data?phone=in.(' + chunk.join(',') + ')', null, { Prefer: 'return=minimal' });
      del += chunk.length;
    }
    out.deleted = del; out.hint = 'Da xoa ' + del + ' dong thua khoi Supabase (ban sao: ' + name + ').';
    try { PropertiesService.getScriptProperties().setProperty('SB_CARE_PRUNE_STATE', JSON.stringify({ at: now, deleted: del, file: name })); } catch (eS) {}
    try { CacheService.getScriptCache().remove('customers_v12'); } catch (eC) {}
    try { invalidateLookupCache_(cand); } catch (eL) {}
    return out;
  } catch (e) { out.ok = false; out.error = String(e && e.message || e); return out; }
}
function sbXoaDongThuaThu() { var r = sbPruneCare_({ dryRun: true }); Logger.log(JSON.stringify(r, null, 2)); Logger.log(r.refused || r.hint || r.error || ''); }   // CHI DOC
function sbXoaDongThuaThat() { var r = sbPruneCare_({ dryRun: false }); Logger.log(JSON.stringify(r, null, 2)); Logger.log(r.refused || r.hint || r.error || ''); }


// ═══════════════════════════════════════════════════════════════
//  BAO CAO L — KHACH QUA CUA HANG (yeu cau Duyen 2026-10)
//  Nguon: Google Sheet "Khách Sale qua cửa hàng" (tab dau "Bảng theo dõi KH qua CH") do cua hang/sale tu ghi
//  lich khach hen qua cua hang. Cua hang DOI KHI QUEN note/gan the Sale tren Pos nen CRM doc thang trang tinh nay:
//   - Cot Thang (B) + Ngay KH hen qua CH (C): "10-11" / "25-26-27" / "28/29" = TUNG NGAY LIET KE (2 ngay: 10 va 11).
//   - Ten sale tu van (G): ten tren Base/Pos hoac ten hien thi, nhieu sale cach nhau dau phay; tu khop qua danh sach
//     Sale (SaleDirectory) + bang khop ten Pancake (PancakeNameMap) + ten tren the Pos.
//   - Khop DON POS (sheet "dữ liệu đơn", cung nguon voi Bao cao B/ke toan) theo SDT + ngay qua cua hang.
//   - Sale duoc tinh 30% doanh thu don (cung ty le "Quầy Hào Nam" 30/70 dang dung o Bao cao B, QUAY_SALE_RATIO_);
//     nhieu sale thi CHIA DEU 30% do. Sale da co ten tren cot The cua don Pos => don TRUNG (da tinh o Bao cao Pos), bo qua.
//   - Xuat chi tiet kem ma bo dem (cot Q Pos) + so dong sheet Pos de doi chieu ke toan.
// ═══════════════════════════════════════════════════════════════
var STORE_CASE_SS_ID_DEFAULT_ = '1zckCf-XECSm1o4WrZycAxNBScnKI-P__Q3m_IQ95Py4';

function _storeCaseShare_() {
  try {
    var v = parseFloat(String(getSetting_('storeCaseSharePct') || '').replace(',', '.'));
    if (!isNaN(v) && v > 0 && v <= 100) return v / 100;
  } catch (e) {}
  return QUAY_SALE_RATIO_;
}

// Tach "10-11" / "25-26-27" / "28/29" / "3,4" thanh cac NGAY (yyyy-MM-dd). Thang lay o cot Thang; nam suy ra:
// nam hien tai, neu ngay do con xa hon 45 ngay trong TUONG LAI thi lui 1 nam. Ngay khong ton tai (31/9) bo qua.
function _storeCaseVisitDates_(monthCell, dayCell, todayYmd) {
  var out = [], seen = {};
  var dayStr = String(dayCell || '').trim();
  if (!dayStr) return out;
  if (/\d{4}/.test(dayStr)) { // co nam day du (vd 10/10/2026 hoac 2026-10-10)
    var full = /^\d{4}-\d{2}-\d{2}/.test(dayStr) ? dayStr.substring(0, 10) : (function() { var d0 = parseVNDate_(dayStr); return d0 ? _vnYmd_(d0) : ''; })();
    if (full) out.push(full);
    return out;
  }
  var mo = parseInt(String(monthCell || '').replace(/\D/g, ''), 10);
  if (!(mo >= 1 && mo <= 12)) return out;
  var tp = todayYmd.split('-'), yNow = +tp[0], todayUtc = Date.UTC(+tp[0], +tp[1] - 1, +tp[2]);
  var toks = dayStr.match(/\d{1,2}/g) || [];
  toks.forEach(function(t) {
    var d = parseInt(t, 10);
    if (!(d >= 1 && d <= 31)) return;
    var y = yNow;
    if (Date.UTC(y, mo - 1, d) - todayUtc > 45 * 86400000) y -= 1;
    if (new Date(Date.UTC(y, mo - 1, d)).getUTCMonth() !== mo - 1) return;
    var ymd = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (!seen[ymd]) { seen[ymd] = true; out.push(ymd); }
  });
  return out;
}

// Doc tab dau cua trang tinh cua hang. Tim cot theo TEN TIEU DE (khong theo vi tri cung) nen them/doi cot khong hong.
function _storeCaseReadSheet_() {
  var cached = _cacheGetBig_('storeCaseRows_v1');
  if (cached) { try { return JSON.parse(cached); } catch (eP) {} }
  var id = '';
  try { id = String(getSetting_('storeCaseSheetId') || '').trim(); } catch (e0) {}
  var mId = id.match(/\/d\/([a-zA-Z0-9_-]+)/); if (mId) id = mId[1];
  id = id || STORE_CASE_SS_ID_DEFAULT_;
  var sh;
  try { sh = _sheetByGid_(SpreadsheetApp.openById(id), 0); }
  catch (eOpen) { return { error: 'Không mở được trang tính "Khách Sale qua cửa hàng" (' + String(eOpen && eOpen.message || eOpen) + ') — kiểm tra quyền truy cập của tài khoản chạy Apps Script.', rows: [] }; }
  if (!sh) return { error: 'Trang tính không có tab nào.', rows: [] };
  var lastRow = sh.getLastRow(), lastCol = Math.min(sh.getLastColumn(), 26);
  var res = { sheetId: id, sheetName: sh.getName(), rows: [] };
  if (lastRow < 2 || lastCol < 1) return res;
  var vals = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues(); // doc dang HIEN THI: "10-11" khong bi Sheets doi thanh ngay
  var hdr = vals[0].map(function(h) { return _stripVN_(String(h || '')).replace(/\s+/g, ' ').trim(); });
  function col(subs, fb, exact) {
    for (var c = 0; c < hdr.length; c++) {
      if (exact) { if (hdr[c] === exact) return c; continue; }
      var ok = true;
      for (var s = 0; s < subs.length; s++) if (hdr[c].indexOf(subs[s]) === -1) { ok = false; break; }
      if (ok && hdr[c]) return c;
    }
    return fb;
  }
  var C = {
    stt: col(['stt'], 0), thang: col([], 1, 'thang'), ngayHen: col(['hen', 'qua'], 2), kenh: col(['kenh'], 5),
    sale: col(['ten sale'], 6), tenKh: col(['ten kh'], 7), phone: col(['so dien thoai'], 8),
    thongTin: col(['thong tin kh'], 9), spOrder: col(['san pham kh order'], 10), capNhat: col(['cap nhat'], 11),
    tinhTrang: col([], 12, 'tinh trang'), ngayDen: col(['ngay kh den'], 13), spMua: col(['san pham kh mua'], 14),
    doanhThu: col(['doanh thu'], 15), nvCh: col(['nhan vien ch'], 16)
  };
  function g(r, k) { var v = r[C[k]]; return v === undefined || v === null ? '' : String(v).trim(); }
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var row = { row: i + 1, stt: g(r, 'stt'), thang: g(r, 'thang'), ngayHen: g(r, 'ngayHen'), kenh: g(r, 'kenh'),
      saleRaw: g(r, 'sale'), tenKh: g(r, 'tenKh'), phone: g(r, 'phone'), thongTin: g(r, 'thongTin'), spOrder: g(r, 'spOrder'),
      capNhat: g(r, 'capNhat'), tinhTrang: g(r, 'tinhTrang'), ngayDen: g(r, 'ngayDen'), spMua: g(r, 'spMua'),
      doanhThuSheet: g(r, 'doanhThu'), nvCh: g(r, 'nvCh') };
    if (!row.phone && !row.saleRaw && !row.tenKh && !row.ngayHen) continue; // dong mau trong (chi co STT)
    res.rows.push(row);
  }
  try { _cachePutBig_('storeCaseRows_v1', JSON.stringify(res), 60); } catch (eC) {}
  return res;
}

// Bo khop ten Sale: ten ghi tren trang tinh (hien thi/username/viet tat) -> ten Sale tren Pos/Base.
// Nguon: SaleDirectory (userBase/ten Facebook/tag Pancake) + bang khop ten Pancake + ten dang co tren cot The Pos.
function _storeCaseBuildCtx_(posNameSet) {
  var variants = {}, outs = {}, aliasOf = {};
  var personKey = _salePersonKeyFn_();   // Khop Sale (The / tai khoan Sale / SaleDirectory / PancakeNameMap): cung nguoi -> cung khoa
  function addOut(n) { n = String(n || '').trim(); if (n) outs[n] = _foldSaleKey_(n); }
  function addVariant(v, out, how) { var f = _foldSaleKey_(v); if (f && !variants[f]) variants[f] = { name: out, how: how }; }
  try {
    (readSaleDirectory_().list || []).forEach(function(rec) {
      var out = rec.userBase || rec.tenFacebook || rec.tenTagPancake; if (!out) return;
      addOut(out);
      [rec.userBase, rec.tenFacebook, rec.tenTagPancake, rec.code].forEach(function(v) { addVariant(v, out, 'danh sách Sale'); });
    });
  } catch (e1) {}
  Object.keys(posNameSet || {}).forEach(function(n) { addOut(n); addVariant(n, n, 'tên trên Pos'); });
  try {
    var pm = readPancakeMap_();
    Object.keys(pm).forEach(function(pn) {
      var sales = String(pm[pn] || '').split('|').map(function(s) { return s.trim(); }).filter(Boolean);
      var fp = _foldSaleKey_(pn);
      sales.forEach(function(s) {
        var fs = _foldSaleKey_(s); if (!fs || !fp) return;
        (aliasOf[fs] = aliasOf[fs] || []).push(fp);
        (aliasOf[fp] = aliasOf[fp] || []).push(fs);
      });
      if (sales.length) {
        var target = (variants[_foldSaleKey_(sales[0])] || {}).name || sales[0];
        addOut(target); addVariant(pn, target, 'khớp tên Pancake');
      }
    });
  } catch (e2) {}
  function stripD(f) { return f.replace(/[0-9]+$/, ''); }
  return {
    resolve: function(raw) {
      var f = _foldSaleKey_(raw);
      if (!f) return { raw: raw, name: '', how: 'trống' };
      if (variants[f]) return { raw: raw, name: variants[f].name, how: variants[f].how };
      var nf = stripD(f);
      if (nf.length >= 4) {
        var cands = [];
        Object.keys(outs).forEach(function(o) {
          var on = stripD(outs[o]);
          if (on === nf || (nf.length >= 6 && on.indexOf(nf) === 0)) cands.push(o);
        });
        if (cands.length === 1) return { raw: raw, name: cands[0], how: 'khớp gần đúng' };
        if (cands.length > 1) return { raw: raw, name: '', how: 'trùng nhiều tên: ' + cands.slice(0, 3).join(' / ') };
      }
      return { raw: raw, name: '', how: 'chưa khớp' };
    },
    same: function(a, b) {
      var fa = _foldSaleKey_(a), fb = _foldSaleKey_(b);
      if (!fa || !fb) return false;
      if (fa === fb) return true;
      var na = stripD(fa), nb = stripD(fb);
      if (na.length >= 4 && na === nb) return true;
      var pa = personKey(a), pb = personKey(b);
      if (pa && pa === pb) return true;   // 2 ten da khop thu cong (Khop Sale) la cung 1 nguoi
      return (aliasOf[fa] || []).indexOf(fb) !== -1 || (aliasOf[fb] || []).indexOf(fa) !== -1;
    }
  };
}

function buildStoreCaseReport_(filters) {
  filters = filters || {};
  var todayYmd = _vnYmd_(new Date());
  var pctNum = parseFloat(String(filters.pct || '').replace(',', '.'));
  var share = (!isNaN(pctNum) && pctNum > 0 && pctNum <= 100) ? pctNum / 100 : _storeCaseShare_();
  var from = _dateStrToVnYmd_(filters.dateFrom), to = _dateStrToVnYmd_(filters.dateTo);
  var saleFilter = (filters.sale || []).filter(Boolean);

  var sheet = _storeCaseReadSheet_();
  if (sheet.error) return { ok: false, error: sheet.error };

  // Chat luong du lieu tren TOAN trang tinh (khong phu thuoc bo loc ngay) — de nhac cua hang bo sung thong tin
  var dq = { tongDong: sheet.rows.length, thieuSdt: 0, thieuNgay: 0, thieuSale: 0 };

  // 1) Dong trang tinh -> ngay qua cua hang, loc theo khoang ngay
  var kept = [], wanted = {};
  sheet.rows.forEach(function(r) {
    r.visitDates = _storeCaseVisitDates_(r.thang, r.ngayHen, todayYmd);
    r.phoneNorm = normPhone_(r.phone);
    if (!r.phoneNorm) dq.thieuSdt++;
    if (!r.visitDates.length) dq.thieuNgay++;
    if (!String(r.saleRaw || '').trim()) dq.thieuSale++;
    var inRange = r.visitDates.filter(function(ymd) { return (!from || ymd >= from) && (!to || ymd <= to); });
    if (r.visitDates.length && !inRange.length) return;       // co ngay nhung khong roi vao khoang loc
    if (!r.visitDates.length && (from || to)) return;         // thieu ngay: chi hien khi KHONG loc ngay
    r.activeDates = inRange;
    kept.push(r);
    if (r.phoneNorm) inRange.forEach(function(ymd) { wanted[r.phoneNorm + '|' + ymd] = true; });
  });

  // 2) Don Pos khop SDT + ngay (1 luot qua sheet "dữ liệu đơn", cung nguon Bao cao B/ke toan)
  var posRows = readDonChiTiet_();
  var posByKey = {}, posNameSet = {};
  for (var i = 0; i < posRows.length; i++) {
    var pr = posRows[i];
    if (pr.theSale) {
      var nm = _donSaleNamesFromThe_(pr.theSale);
      pr.__names = nm;
      for (var k = 0; k < nm.length; k++) posNameSet[nm[k]] = true;
    }
    var ph = normPhone_(pr.soDienThoai); if (!ph) continue;
    var dtP = parseVNDate_(pr.ngayTaoDon); var ymdP = dtP ? _vnYmd_(dtP) : ''; if (!ymdP) continue;
    var key = ph + '|' + ymdP;
    if (wanted[key]) (posByKey[key] = posByKey[key] || []).push({ pr: pr, ymd: ymdP });
  }

  var ctx = _storeCaseBuildCtx_(posNameSet);

  // 3) Ghep tung dong + tinh chia
  var stats = {}, unresolved = {}, uniqueOrders = {}, totals = { dongHen: 0, dongCoDon: 0, soDon: 0, doanhThuDon: 0, daTinh: 0, trungBoQua: 0 };
  function st(name) { return stats[name] || (stats[name] = { sale: name, khHen: 0, khCoDon: 0, soDon: 0, doanhThuDon: 0, credited: 0, dupSkipped: 0 }); }
  var outRows = [];
  kept.forEach(function(r) {
    var tokens = String(r.saleRaw || '').split(/[,;&+\n]|\s+và\s+/i).map(function(s) { return s.trim(); }).filter(Boolean);
    var sales = [], seenS = {}, unres = [];
    tokens.forEach(function(t) {
      var rs = ctx.resolve(t);
      if (rs.name) { var kS = _foldSaleKey_(rs.name); if (!seenS[kS]) { seenS[kS] = true; sales.push({ raw: t, name: rs.name, how: rs.how }); } }
      else { unres.push({ raw: t, how: rs.how }); var uk = _foldSaleKey_(t); unresolved[uk] = unresolved[uk] || { raw: t, how: rs.how, count: 0 }; unresolved[uk].count++; }
    });
    if (saleFilter.length) {
      var hit = false;
      for (var a = 0; a < sales.length && !hit; a++) for (var b = 0; b < saleFilter.length; b++) if (ctx.same(sales[a].name, saleFilter[b])) { hit = true; break; }
      if (!hit) for (var c2 = 0; c2 < tokens.length && !hit; c2++) for (var d2 = 0; d2 < saleFilter.length; d2++) if (ctx.same(tokens[c2], saleFilter[d2])) { hit = true; break; }
      if (!hit) return;
    }
    var koDen = /(^|[^a-z])(ko|k|khong|chua)\s*den/.test(_stripVN_(r.capNhat + ' ' + r.tinhTrang));
    var flags = [];
    if (koDen) flags.push('Ko đến');
    if (!r.phoneNorm) flags.push('Thiếu SĐT');
    if (!r.visitDates.length) flags.push('Thiếu ngày hẹn');
    if (!tokens.length) flags.push('Thiếu tên Sale');
    if (unres.length) flags.push('Chưa khớp tên Sale: ' + unres.map(function(u) { return u.raw; }).join(', '));

    var orders = [];
    if (r.phoneNorm && !koDen) {
      r.activeDates.forEach(function(ymd) {
        (posByKey[r.phoneNorm + '|' + ymd] || []).forEach(function(hitO) {
          var pr2 = hitO.pr;
          var excluded = _donHasExcludedStatus_(pr2.trangThai);
          var giaTri = pr2.giaTriSauGiam || 0;
          var theNames = pr2.__names || [];
          var o = { posRow: pr2.posRow, ngay: pr2.ngayTaoDon, ymd: hitO.ymd, nguonDon: pr2.nguonDon, khachHang: pr2.khachHang,
            sanPham: String(pr2.sanPham || '').substring(0, 160), trangThai: pr2.trangThai, theSale: pr2.theSale, giaTri: giaTri,
            ghiChu: String(pr2.ghiChu || '').substring(0, 200), codes: _extractCounterCodes_(pr2.ghiChu), excluded: excluded, credits: [], note: '' };
          if (excluded) { o.status = 'hoan'; o.note = 'Đơn ' + pr2.trangThai + ' — không tính doanh thu'; orders.push(o); return; }
          if (!sales.length) { o.status = 'khong-sale'; o.note = 'Chưa khớp được tên Sale trên trang tính — chưa tính cho ai'; orders.push(o); return; }
          var pool = giaTri * share, per = pool / sales.length, nDup = 0;
          sales.forEach(function(s) {
            var dup = theNames.some(function(tn) { return ctx.same(tn, s.name); });
            if (dup) nDup++;
            o.credits.push({ sale: s.name, raw: s.raw, amount: dup ? 0 : Math.round(per), wouldBe: Math.round(per), dup: dup });
          });
          o.status = nDup === 0 ? 'tinh' : (nDup === sales.length ? 'trung' : 'mot-phan');
          if (o.status === 'trung') o.note = 'Đã có thẻ Sale trên Pos → đơn trùng, bỏ qua (đã tính ở Báo cáo Pos)';
          else if (o.status === 'mot-phan') o.note = 'Một phần Sale đã có thẻ trên Pos (bỏ qua phần đó), phần còn lại tính thêm';
          else o.note = theNames.length ? ('Thẻ Pos đang ghi: ' + theNames.join(', ') + ' (khác Sale trên trang tính) → tính thêm ' + Math.round(share * 100) + '%') : ('Đơn Pos chưa gắn thẻ Sale → tính ' + Math.round(share * 100) + '% cho Sale');
          if (nDup > 0 && _stripVN_(pr2.nguonDon).indexOf('quay hao nam') !== -1 && _quaySaleRatio_(pr2.nguonDon, pr2.ghiChu, true) === 1) {
            o.note += ' | ⚠️ Thẻ đã có Sale nhưng ghi chú chưa có "30/70" nên Báo cáo Pos đang tính 100% — nên bổ sung note';
          }
          orders.push(o);
        });
      });
    }
    var valid = orders.filter(function(o) { return !o.excluded; });
    if (r.phoneNorm && !koDen && !orders.length) flags.push('Chưa có đơn Pos khớp SĐT + ngày');
    if (orders.length && !valid.length) flags.push('Chỉ có đơn hoàn');

    if (!koDen) {
      totals.dongHen++;
      if (valid.length) totals.dongCoDon++;
      sales.forEach(function(s) {
        var x = st(s.name); x.khHen++; if (valid.length) x.khCoDon++;
        valid.forEach(function(o) {
          x.soDon++; x.doanhThuDon += o.giaTri;
          o.credits.forEach(function(cr) { if (cr.sale === s.name) { x.credited += cr.amount; if (cr.dup) x.dupSkipped += cr.wouldBe; } });
        });
      });
      valid.forEach(function(o) {
        if (!uniqueOrders[o.posRow]) { uniqueOrders[o.posRow] = true; totals.soDon++; totals.doanhThuDon += o.giaTri; }
        o.credits.forEach(function(cr) { if (cr.dup) totals.trungBoQua += cr.wouldBe; else totals.daTinh += cr.amount; });
      });
    }
    outRows.push({ row: r.row, stt: r.stt, thang: r.thang, ngayHen: r.ngayHen, visitDates: r.activeDates.length ? r.activeDates : r.visitDates,
      kenh: r.kenh, saleRaw: r.saleRaw, sales: sales, tenKh: r.tenKh, phone: r.phoneNorm || r.phone, thongTin: r.thongTin, spOrder: r.spOrder,
      capNhat: r.capNhat, tinhTrang: r.tinhTrang, spMua: r.spMua, doanhThuSheet: r.doanhThuSheet, nvCh: r.nvCh,
      koDen: koDen, flags: flags, orders: orders });
  });

  outRows.sort(function(x, y) { var dx = (x.visitDates[0] || ''), dy = (y.visitDates[0] || ''); if (dx !== dy) return dx < dy ? 1 : -1; return y.row - x.row; });
  var bySale = Object.keys(stats).map(function(k) { return stats[k]; }).sort(function(a, b) { return b.credited - a.credited; });
  return {
    ok: true, sheetId: sheet.sheetId, sheetName: sheet.sheetName, dateFrom: from, dateTo: to, sharePct: Math.round(share * 1000) / 10,
    rows: outRows, bySale: bySale, totals: totals, dataQuality: dq,
    unresolved: Object.keys(unresolved).map(function(k) { return unresolved[k]; }),
    note: 'Nguồn đơn: Pos ("dữ liệu đơn", cùng nguồn Báo cáo B). Doanh thu chia = giá trị sau giảm giá × ' + Math.round(share * 100) + '% (nhiều Sale chia đều); Sale đã có thẻ trên đơn Pos được coi là đơn trùng (bỏ qua).'
  };
}


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

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
  if (mode === 'off') pr.deleteProperty('SB_ORD_READ');   // 4c: rollback = ve Sheets hoan toan (ca doc don hang)
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

// reminders: tra mang dong kieu CareData (chi cac cot 0-3, 12, 13 co nghia) hoac UNDEFINED = doc Sheets. Can SB_MODE='read', khong STALE, KHONG co
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
    var again = PropertiesService.getScriptProperties().getProperties();
    if (again.SB_STALE || String(again.SB_MODE || '').toLowerCase() !== 'read' || (again.SB_DIRTY_CARE && again.SB_DIRTY_CARE !== '[]')) return undefined;
    return recs.map(function (g) {
      var row = [g.phone, g.status || '', g.zalo || '', g.cs || '', '', '', '', '', '', '', '', '', _sbCareTextToCell_(g.sched_hen), g.sched_hen_note || ''];
      return row;
    });
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
  PropertiesService.getScriptProperties().setProperty('SB_ORD_READ', 'on');
  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; });
  return { ok: true, orderRead: sbOrdReadStatus_(), warning: hasTrigger ? null : 'Chua co trigger dong bo (sbDonHangCaiTrigger) — sau ' + (SB_ORD_MAX_AGE_MS_ / 60000) + ' phut se tu quay ve doc Sheets.' };
}
function sbOrdReadDisable_() {
  PropertiesService.getScriptProperties().deleteProperty('SB_ORD_READ');
  return { ok: true, orderRead: sbOrdReadStatus_() };
}

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4c) — chon ten ham o o "Run", bam Run, xem "Execution log". Khong can adminKey / URL. ──
//  Dieu kien truoc: 4b xong (sbDonHangDongBo XONG + sbDonHangCaiTrigger). Bat: sbDonHangBatDoc (tu tu choi neu chua dong bo/doi chieu khong khop).
//  Theo doi: sbDonHangTrangThai (muc orderRead). Ve nhu cu: sbDonHangTatDoc (hoac sbTatSupabase). Lich hen: dung cong tac cu sbBatDocSupabase.
function sbDonHangBatDoc() { Logger.log(JSON.stringify(sbOrdReadEnable_(), null, 2)); }
function sbDonHangTatDoc() { Logger.log(JSON.stringify(sbOrdReadDisable_(), null, 2)); }

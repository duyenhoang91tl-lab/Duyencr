// ═══════════════════════════════════════════════════════════════
//  BAO CAO F: TY LE HOAN THANH KPI THEO SALE — theo yeu cau Duyen 2026-09.
//  - Sale van phong (Nhom = "Văn phòng" trong SaleDirectory) duoc gan 1 trong 3 BAC, moi bac 1
//    muc KPI rieng (mac dinh Bac 1 = 400tr, Bac 2 = 500tr, Bac 3 = 500tr — Duyen tu sua duoc).
//  - Sale online (Nhom = "Online") KHONG chia bac, dung CHUNG 1 muc KPI (mac dinh 500tr).
//  - Moi Sale (bat ke van phong/online) co the dat 1 muc KPI COMMIT RIENG. SUA 2026-10-04 (Duyen
//    yeu cau giong file Excel "Theo doi doanh thu"): Commit rieng nay la MUC TIEU SONG SONG voi
//    KPI theo bac — co %HT rieng (pctCommit) — KHONG con GHI DE/thay the KPI theo bac nhu truoc
//    (truoc do 'overrides' lam target = so Commit va bo qua het bac). Ten field luu tru 'overrides'
//    va cac bien/ham noi bo '_srKpiEditSetOverride'/'override' o index.html GIU NGUYEN de khong
//    phai migrate du lieu Settings da luu (tuong thich nguoc), nhung tu nay KHONG con nghia la
//    "ghi de" nua — xem buildSaleKpiReport_ ben duoi va _srRenderF_ o index.html.
//  Cau hinh luu O 1 SETTING DUY NHAT 'saleKpiConfig' — KHONG chia theo thang, sua la ap dung
//  ngay (giong het co che "% hoa hong ca nhan" / individualRates da co san, client tu doc/ghi
//  qua action getSetting/setSetting chung, KHONG can route rieng cho phan luu cau hinh).
// ═══════════════════════════════════════════════════════════════
// 9 bac: TVF1/TVF2 (thu viec, F track) -> F1/F2/F3 (Van phong chinh thuc) VA O1/O2/O3 (Online
// co nhay bac) VA O (Online KHONG nhay bac, giu nguyen KPI mai mai). Theo dung sheet "Bậc" Duyen
// gui 2026-10-01. track dung de +-1 cap (F1<->F2<->F3, O1<->O2<->O3); probation=true: luon CHI
// giu dung 1 thang roi tu dong chuyen F1 (bat ke ket qua thang do), khong xet 3 thang nhu binh
// thuong; track 'OFLAT': khong bao gio doi bac, bo qua toan bo cong thuc tang/giam.
// ═══ 2026-11-27 (Duyên chốt): CHỈ CÒN 2 BẬC — Thử việc (KPI 100tr, ĐÚNG 1 THÁNG) rồi tháng sau tự lên Chính thức (KPI 500tr). Áp dụng cho cả Sale Offline.
// BỎ hết hệ 9 bậc cũ (TVF1/TVF2/F1-F3/O1-O3/O) và quy tắc tự lên/xuống bậc theo 3 tháng. Bậc cũ trong cấu hình đã lưu được đổi 1 lần
// (SALE_TIER_LEGACY_ → CT, xem _saleKpiMigrate_): cả đội cũ = Chính thức; chỉ thuongBT, nguyetTTA, ngocNM = Thử việc.
var SALE_TIER_ORDER_ = ['TV', 'CT'];
var SALE_TIER_DEFAULT_TARGETS_ = { TV: 100000000, CT: 500000000 };
var SALE_TIER_META_ = {
  TV: { track: 'TV', level: 0, probation: true },
  CT: { track: 'CT', level: 0 }
};
var SALE_TIER_LEGACY_ = { TVF1: 1, TVF2: 1, F1: 1, F2: 1, F3: 1, O1: 1, O2: 1, O3: 1, O: 1 };   // bậc hệ cũ → coi là Chính thức
var SALE_TIER_TRIAL_NAMES_ = ['thuongbt', 'nguyettta', 'ngocnm'];                                  // chỉ những bạn này là Thử việc khi chuyển đổi (khớp tiền tố, không phân biệt hoa/thường)
var SALE_KPI_DEFAULT_CFG_ = {
  tierTargets: JSON.parse(JSON.stringify(SALE_TIER_DEFAULT_TARGETS_)),
  startTier: {},                   // ten Sale (dung y het chuoi "Sale bán"/"Thẻ") -> 'TV' | 'CT'
  startMonth: {},                  // ten Sale -> 'YYYY-MM' thang BAT DAU bac (Thu viec = thang nay, thang sau tu len CT; thang truoc do KHONG tinh KPI). Trong = tu trackingStartMonth
  tierModel: 2,                    // 2 = mo hinh 2 bac (27/11/2026)
  trackingStartMonth: '2026-09',   // 'YYYY-MM' - thang bat dau tu dong tinh bac theo quy che
  overrides: {}                    // ten Sale -> so tien KPI rieng (uu tien tuyet doi, bo qua bac tu dong)
};

// Chuyển cấu hình KPI hệ 9 bậc cũ → 2 bậc (1 LẦN, rồi lưu lại): mọi Sale đã được gán / có Commit riêng / đã phân loại đội → Chính thức (CT),
// riêng thuongBT, nguyetTTA, ngocNM → Thử việc (TV) bắt đầu từ THÁNG HIỆN TẠI (Duyên sửa lại tháng ở Cài đặt KPI nếu khác). Trả true nếu có đổi.
function _saleKpiMigrate_(out, o) {
  var names = {};
  Object.keys(out.startTier).forEach(function(n) { names[n] = 1; });
  Object.keys(out.overrides || {}).forEach(function(n) { names[n] = 1; });
  try { var rawCh = getSetting_('saleChannels'); if (rawCh) { var oCh = JSON.parse(rawCh); Object.keys(oCh || {}).forEach(function(n) { if (oCh[n]) names[n] = 1; }); } } catch (eCh) {}
  var cur = _todayYm_();
  Object.keys(names).forEach(function(n) {
    var low = String(n).trim().toLowerCase();
    var trial = SALE_TIER_TRIAL_NAMES_.some(function(t) { return low.indexOf(t) === 0; });
    out.startTier[n] = trial ? 'TV' : 'CT';
    if (trial && !out.startMonth[n]) out.startMonth[n] = cur;
  });
  out.tierModel = 2;
  return true;
}

function readSaleKpiConfig_() {
  var out = JSON.parse(JSON.stringify(SALE_KPI_DEFAULT_CFG_)), o = null;
  try { var raw = getSetting_('saleKpiConfig'); if (raw) { o = JSON.parse(raw); if (!o || typeof o !== 'object') o = null; } } catch (e) { o = null; }
  if (!o) return out;
  if (o.tierTargets && typeof o.tierTargets === 'object') {
    SALE_TIER_ORDER_.forEach(function(k) { var n = Number(o.tierTargets[k]); if (!isNaN(n) && n >= 0 && o.tierTargets[k] !== '' && o.tierTargets[k] != null) out.tierTargets[k] = n; });
  }
  if (o.trackingStartMonth) out.trackingStartMonth = String(o.trackingStartMonth);
  if (o.overrides && typeof o.overrides === 'object') out.overrides = o.overrides;
  if (o.startMonth && typeof o.startMonth === 'object') Object.keys(o.startMonth).forEach(function(n) { if (/^\d{4}-\d{2}$/.test(String(o.startMonth[n]))) out.startMonth[n] = String(o.startMonth[n]); });
  if (o.startTier && typeof o.startTier === 'object') {
    Object.keys(o.startTier).forEach(function(name) {
      var v = o.startTier[name];
      if (SALE_TIER_META_[v]) out.startTier[name] = v; else if (SALE_TIER_LEGACY_[v]) out.startTier[name] = 'CT';
    });
  }
  if (Number(o.tierModel) !== 2) {
    // Cấu hình cũ (≤ 26/11/2026, hệ 9 bậc): đổi sang 2 bậc và lưu 1 lần để các lần đọc sau không đổi lại phần Duyên đã chỉnh.
    _saleKpiMigrate_(out, o);
    try { setSetting_('saleKpiConfig', JSON.stringify(out)); } catch (eS) {}
  }
  return out;
}

// ── Thang (YYYY-MM) helpers cho state machine tinh bac tu dong ──
function _ymAdd_(ym, delta) {
  var parts = String(ym).split('-');
  var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
  m += delta; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
}
function _ymMonthsBetween_(fromYm, toYm) {
  var out = [], cur = fromYm, guard = 0;
  while (true) {
    out.push(cur);
    if (cur === toYm || guard++ > 240) break; // guard 20 nam, tranh vong lap vo han neu cau hinh loi
    cur = _ymAdd_(cur, 1);
  }
  return out;
}
function _ymFirstDay_(ym) { return ym + '-01'; }
function _ymLastDay_(ym) {
  var parts = ym.split('-'), y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  var last = new Date(y, m, 0).getDate();
  return ym + '-' + (last < 10 ? '0' : '') + last;
}
function _todayYm_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM');
}

// Doanh thu THEO TUNG THANG cho moi Sale, tu buildSalesReportB_ (POS/"dữ liệu đơn", dung nguon
// voi Bao cao B/E) — can de chay state machine tang/giam bac (xem _computeSaleTierTimeline_).
// Cache 5 phut qua _cachePutBig_/_cacheGetBig_ (ho tro payload lon, khac CacheService.put thuong
// bi am tham bo qua khi vuot ~100KB) — danh sach thang it doi trong ngay nen cache ngan la du,
// tranh phai quet lai sheet don cho moi lan bam Loc/doi bo loc trong Bao cao F.
function _computeSaleMonthlyRevenue_(months) {
  var cKey = 'saleMonthlyRev_v2_' + months[0] + '_' + months[months.length - 1];
  try { var cached = _cacheGetBig_(cKey); if (cached) return JSON.parse(cached); } catch (e) {}
  var out = {};
  months.forEach(function(ym) {
    var res = buildSalesReportB_({ dateFrom: _ymFirstDay_(ym), dateTo: _ymLastDay_(ym) });
    (res.bySale || []).forEach(function(s) {
      if (!out[s.name]) out[s.name] = {};
      out[s.name][ym] = s.giaTri;
    });
  });
  try { _cachePutBig_(cKey, JSON.stringify(out), 300); } catch (e) {}
  return out;
}

// Bậc từng tháng của 1 Sale (mô hình 2 bậc, Duyên chốt 27/11/2026): Thử việc (TV) chỉ ĐÚNG 1 THÁNG, tháng sau tự lên Chính thức (CT) và giữ CT
// (không còn tự lên/xuống bậc theo 3 tháng). beginYm (tuỳ chọn) = tháng bắt đầu của Sale: các tháng TRƯỚC đó không có bậc (chưa tính KPI);
// nếu bắt đầu TV từ trước tháng đầu theo dõi mà đã qua 1 tháng thì tháng đầu theo dõi đã là CT.
function _computeSaleTierTimeline_(startTier, months, monthlyRevenue, tierTargets, beginYm) {
  var timeline = {}, begun = false, prev = '';
  var first = months.length ? months[0] : '';
  if (beginYm && first && beginYm < first && SALE_TIER_META_[startTier] && SALE_TIER_META_[startTier].probation) startTier = 'CT';
  for (var i = 0; i < months.length; i++) {
    var ym = months[i];
    if (!begun) {
      if (beginYm && ym < beginYm) continue;
      begun = true; prev = startTier; timeline[ym] = prev; continue;
    }
    var meta = SALE_TIER_META_[prev];
    if (meta && meta.probation) prev = 'CT';
    timeline[ym] = prev;
  }
  return timeline;
}

// ═══ LƯƠNG CƠ BẢN (LCB) SALE OFFLINE — Quy chế lương, hoa hồng và phân ca (26/10/2026, áp dụng 01/11/2026), PHẦN I mục 1 ═══
//  LCB theo TỶ LỆ ĐẠT KPI của tháng: < 65% = 3.000.000 · 65% → <85% = 3.500.000 · 85% → <100% = 4.250.000 · ≥ 100% = 5.000.000
//  (KPI Chính thức 500tr ⇒ mốc 325tr / 425tr / 500tr; KPI Thử việc 100tr — bậc lấy từ Báo cáo F: bậc + tháng bắt đầu, xem SALE_TIER_ORDER_).
//  LCB thực nhận = (LCB theo tỷ lệ đạt KPI / NGÀY CÔNG CHUẨN của tháng) × NGÀY CÔNG THỰC TẾ đi làm.
//  Ngày công chuẩn + ngày công thực tế do ADMIN NHẬP TAY cuối tháng (Settings 'salaryWorkdays' = { 'YYYY-MM': { standard: n, byName: { tên: ngày } } });
//  chưa nhập ngày công của ai → hiện LCB theo tỷ lệ (chưa chia ngày công) và đánh dấu "chưa nhập ngày công".
//  ⚠ Thử việc "KPI 100tr tính theo ngày làm việc thực tế, không gồm thời gian đào tạo": hiện KPI giữ nguyên 100tr/tháng (chưa quy theo ngày công) — Duyên chốt lại nếu cần.
//  Chỉ các Sale thuộc kênh trong cfg.channels (mặc định offline + thử việc) — Sale Online không lương cứng (xem phụ cấp ở Team Bonus).
var SALARY_DEFAULT_CFG_ = {
  standardDays: 26,
  lcbTiers: [ { minPct: 0, amount: 3000000 }, { minPct: 65, amount: 3500000 }, { minPct: 85, amount: 4250000 }, { minPct: 100, amount: 5000000 } ],
  channels: ['offline', 'probation']
};
function readSalaryConfig_() {
  var out = JSON.parse(JSON.stringify(SALARY_DEFAULT_CFG_)), raw = null;
  try { var r0 = getSetting_('salaryConfig'); if (r0) raw = JSON.parse(r0); } catch (e) { raw = null; }
  if (raw && typeof raw === 'object') {
    var sd = Number(raw.standardDays); if (isFinite(sd) && sd >= 1 && sd <= 31) out.standardDays = sd;
    if (Array.isArray(raw.lcbTiers)) {
      var t = raw.lcbTiers.map(function (x) { return { minPct: Number(x && x.minPct), amount: Number(x && x.amount) }; }).filter(function (x) { return isFinite(x.minPct) && x.minPct >= 0 && isFinite(x.amount) && x.amount >= 0; }).sort(function (a, b) { return a.minPct - b.minPct; });
      if (t.length) out.lcbTiers = t;
    }
    if (Array.isArray(raw.channels)) { var ch = raw.channels.map(function (x) { return String(x || '').trim(); }).filter(Boolean); if (ch.length) out.channels = ch; }
  }
  return out;
}
function readSalaryWorkdays_() {
  var out = {};
  try { var raw = getSetting_('salaryWorkdays'); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') out = o; } } catch (e) { out = {}; }
  return out;
}
// Mức LCB theo tỷ lệ đạt KPI (%): lấy mốc cao nhất có minPct <= pct; pct null/NaN → null (chưa có KPI để so).
function _lcbFor_(pct, tiers) {
  if (pct === null || pct === undefined || !isFinite(Number(pct))) return null;
  var hit = null; (tiers || []).forEach(function (t) { if (Number(pct) >= t.minPct) hit = t; });
  return hit ? hit.amount : null;
}
// LCB thực nhận theo ngày công; wd = null (chưa nhập) → trả LCB nguyên (chưa chia ngày công).
function _lcbNet_(lcb, standard, wd) {
  if (lcb === null) return null;
  if (wd === null || wd === undefined || wd === '') return lcb;
  return Math.round(lcb / standard * Number(wd));
}
// GET action=salaryReport&month=YYYY-MM&all=1 — CHỈ ADMIN (là bảng lương).
function buildSalaryReport_(p) {
  var viewer = _sessUser_(p.token);
  if (!viewer) return { ok: false, error: 'Cần đăng nhập.', code: 'AUTH' };
  if (viewer.role !== 'admin') return { ok: false, error: 'Chỉ admin xem được bảng lương cơ bản.', code: 'FORBIDDEN' };
  var month = String(p.month || '').trim() || _todayYm_();
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: 'Tháng không hợp lệ (YYYY-MM).' };
  var cfg = readSalaryConfig_(), wdMap = readSalaryWorkdays_(), wm = wdMap[month] || {};
  var standard = Number(wm.standard); if (!isFinite(standard) || standard < 1 || standard > 31) standard = cfg.standardDays;
  var byName = (wm.byName && typeof wm.byName === 'object') ? wm.byName : {};
  var from = month + '-01', to = _tbMonthEnd_(month);
  var k = buildSaleKpiReport_({ dateFrom: from, dateTo: to, dateField: 'ngayTao', sale: [], kenh: [], sanPham: '', byCreator: false });
  var all = String(p.all || '') === '1', rows = [];
  (k.rows || []).forEach(function (r) {
    if (!r.tier) return;                                        // chưa gán bậc / chưa bắt đầu → chưa có KPI
    if (!all && cfg.channels.indexOf(r.nhomKey) === -1) return; // chỉ Sale Offline / Thử việc
    var lcb = _lcbFor_(r.pct, cfg.lcbTiers);
    var wdRaw = byName[r.name], wd = (wdRaw === undefined || wdRaw === null || wdRaw === '') ? null : Number(wdRaw);
    rows.push({ name: r.name, tier: r.tier, channel: r.nhomKey || '', revenue: r.revenue, target: r.target, pct: r.pct, lcbTier: lcb,
                workdays: wd, lcbNet: _lcbNet_(lcb, standard, wd), missingWorkdays: wd === null });
  });
  rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'vi'); });
  return { ok: true, month: month, standardDays: standard, lcbTiers: cfg.lcbTiers, channels: cfg.channels, rows: rows,
           total: rows.reduce(function (s0, r) { return s0 + (r.lcbNet || 0); }, 0), missingCount: rows.filter(function (r) { return r.missingWorkdays; }).length };
}
// POST action=salarySaveWorkdays { token, month, standard, byName:{tên:ngày} } — CHỈ ADMIN; gộp vào tháng đã có (tên nào gửi mới ghi đè; ngày trống = xoá).
function salarySaveWorkdays_(d) {
  var viewer = _sessUser_(d.token);
  if (!viewer) return jsonOut_({ ok: false, error: 'Cần đăng nhập.', code: 'AUTH' });
  if (viewer.role !== 'admin') return jsonOut_({ ok: false, error: 'Chỉ admin nhập ngày công.', code: 'FORBIDDEN' });
  var month = String(d.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return jsonOut_({ ok: false, error: 'Tháng không hợp lệ (YYYY-MM).' });
  var std = Number(d.standard);
  if (d.standard !== undefined && d.standard !== '' && (!isFinite(std) || std < 1 || std > 31)) return jsonOut_({ ok: false, error: 'Ngày công chuẩn phải từ 1 đến 31.' });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var map = readSalaryWorkdays_(), cur = map[month] || {};
    var by = (cur.byName && typeof cur.byName === 'object') ? cur.byName : {};
    var bad = '';
    Object.keys(d.byName || {}).forEach(function (n) {
      var name = String(n || '').replace(/\s+/g, ' ').trim(); if (!name || name.length > 60) return;
      var v = d.byName[n];
      if (v === '' || v === null) { delete by[name]; return; }
      var num = Number(v);
      if (!isFinite(num) || num < 0 || num > 31) { bad = bad || ('Ngày công của "' + name + '" phải từ 0 đến 31.'); return; }
      by[name] = Math.round(num * 2) / 2;   // bước 0,5 ngày (nghỉ nửa ngày)
    });
    if (bad) return jsonOut_({ ok: false, error: bad });
    map[month] = { standard: (d.standard !== undefined && d.standard !== '') ? std : (cur.standard || null), byName: by };
    if (map[month].standard === null) delete map[month].standard;
    setSetting_('salaryWorkdays', JSON.stringify(map));   // setSetting_ tự ghi AuditLog (người đổi theo token)
  } finally { try { lock.releaseLock(); } catch (eL) {} }
  return jsonOut_({ ok: true, month: month });
}

function buildSaleKpiReport_(filters) {
  var a = buildSalesReportB_(filters);
  var cfg = readSaleKpiConfig_();

  var todayYm = _todayYm_();
  var startYm = cfg.trackingStartMonth || '2026-09';
  var months = (startYm <= todayYm) ? _ymMonthsBetween_(startYm, todayYm) : [startYm];
  var monthlyRevByName = _computeSaleMonthlyRevenue_(months);

  // Nhom chung (Online/Van phong/CSKH/Quay...) — CHI dung de LOC/hien thi trong bao cao nay, khac
  // hoan toan voi F-track/O-track cua he thong bac tu dong (van la nguon tinh KPI DUY NHAT, khong
  // dong vao nhau). Doc tu cung 1 nguon voi "🏷️ Phân loại đội Sale" o Quan ly Team.
  var channels = {};
  try { var rawCh = getSetting_('saleChannels'); if (rawCh) { var oCh = JSON.parse(rawCh); if (oCh && typeof oCh === 'object') channels = oCh; } } catch (eCh) {}
  var groupDefs = readSaleGroups_();

  var rowsMap = {};
  function ensureRow(name) {
    if (!rowsMap[name]) {
      var nhomKey = channels[name] || '';
      rowsMap[name] = { name: name, nhomKey: nhomKey, revenue: 0, orders: 0 };
    }
    return rowsMap[name];
  }
  (a.bySale || []).forEach(function(s) {
    var r = ensureRow(s.name);
    r.revenue += s.giaTri; r.orders += s.orders;
  });
  // Them ca Sale DA duoc gan Bac bat dau / dat KPI rieng / da phan loai doi nhung CHUA co doanh
  // thu trong ky dang xem (0d) — de van thay duoc muc tieu/0% thay vi bien mat khoi bao cao.
  Object.keys(cfg.startTier).forEach(function(name) { ensureRow(name); });
  Object.keys(cfg.overrides).forEach(function(name) { ensureRow(name); });
  Object.keys(channels).forEach(function(name) { if (channels[name]) ensureRow(name); });

  // Thang nao trong "months" thuc su nam trong ky dang xem (filters.dateFrom/dateTo) — de cong
  // dung KPI muc tieu cua DUNG CAC THANG duoc xem, ke ca khi ky xem trai dai nhieu thang.
  var rangeFrom = filters.dateFrom || _ymFirstDay_(months[0]);
  var rangeTo = filters.dateTo || _ymLastDay_(months[months.length - 1]);
  var monthsInRange = months.filter(function(ym) { return _ymLastDay_(ym) >= rangeFrom && _ymFirstDay_(ym) <= rangeTo; });
  if (!monthsInRange.length) monthsInRange = [months[months.length - 1]]; // ky loc nam ngoai pham vi theo doi -> tam lay thang gan nhat de van co so hien thi

  var rows = Object.keys(rowsMap).map(function(name) {
    var r = rowsMap[name];
    var target = null, source = 'no-tier', tierNow = '', timeline = null;
    if (cfg.startTier[name]) {
      timeline = _computeSaleTierTimeline_(cfg.startTier[name], months, monthlyRevByName[name] || {}, cfg.tierTargets, cfg.startMonth[name] || '');
      // Tháng chưa bắt đầu (trước startMonth) không có bậc → không cộng KPI; bậc hiện tại = bậc tháng cuối trong kỳ xem (không có thì '').
      tierNow = timeline[monthsInRange[monthsInRange.length - 1]] || '';
      target = monthsInRange.reduce(function(sum, ym) { return sum + (timeline[ym] ? (cfg.tierTargets[timeline[ym]] || 0) : 0); }, 0);
      source = 'tier-auto';
    }
    // "Commit rieng" (cfg.overrides) tu 2026-10-04 la MUC TIEU SONG SONG voi KPI theo bac (xem
    // ghi chu dau ham buildSaleKpiReport_) — KHONG con gan vao 'target'/'source' nhu truoc, ma
    // tra ve rieng o 'commit'/'pctCommit' de client ve them 2 cot canh KPI theo bac, giong het
    // cap "Commit/%HT Commit" trong file Excel "Theo doi doanh thu".
    var commit = null;
    if (cfg.overrides[name] !== undefined && cfg.overrides[name] !== null && cfg.overrides[name] !== '') {
      commit = Number(cfg.overrides[name]) || 0;
    }
    var meta = tierNow ? SALE_TIER_META_[tierNow] : null;
    var nhom = meta ? (meta.probation ? 'Thử việc' : 'Chính thức') : '(chưa gán bậc)';
    var pct = (target && target > 0) ? Math.round(r.revenue / target * 1000) / 10 : null;
    var pctCommit = (commit && commit > 0) ? Math.round(r.revenue / commit * 1000) / 10 : null;
    return { name: name, nhom: nhom, tier: tierNow, revenue: r.revenue, orders: r.orders,
      target: target, source: source, pct: pct, passed: (pct !== null) ? pct >= 100 : null,
      commit: commit, pctCommit: pctCommit, passedCommit: (pctCommit !== null) ? pctCommit >= 100 : null,
      timeline: timeline, startMonth: cfg.startMonth[name] || '',
      // Doi chung (Online/Van phong/CSKH/Quay...) — rieng cho LOC/hien thi, khong dinh gi den
      // target/tier/commit phia tren. nhomChung = '' neu chua phan loai o "🏷️ Phân loại đội Sale".
      nhomChungKey: r.nhomKey, nhomChung: r.nhomKey ? (_saleGroupLabel_(r.nhomKey, groupDefs) || r.nhomKey) : '' };
  });
  // Xep theo % THUC DAT tren KPI, TU TREN XUONG DUOI (cao nhat len dau) — theo yeu cau Duyen
  // 2026-10 ("tinh ty le thuc dat tren KPI... xep tu tren xuong duoi"), thay cho kieu xep theo
  // nhom/bac truoc day. Ai chua co bac/muc tieu (pct = null) xep xuong cuoi (theo doanh thu),
  // khong lam xao tron thu hang nhung nguoi da co % that su.
  rows.sort(function(x, y) {
    if (x.pct === null && y.pct === null) return y.revenue - x.revenue;
    if (x.pct === null) return 1;
    if (y.pct === null) return -1;
    return y.pct - x.pct;
  });

  var totalRevenue = rows.reduce(function(s, r) { return s + r.revenue; }, 0);
  var totalTarget = rows.reduce(function(s, r) { return s + (r.target || 0); }, 0);
  var totalCommit = rows.reduce(function(s, r) { return s + (r.commit || 0); }, 0);
  return { ok: true, rows: rows, config: cfg, trackedMonths: months, saleGroups: groupDefs,
    totalRevenue: totalRevenue, totalTarget: totalTarget,
    totalCommit: totalCommit, totalPctCommit: totalCommit > 0 ? Math.round(totalRevenue / totalCommit * 1000) / 10 : null,
    totalPct: totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 1000) / 10 : null,
    totalOrders: a.totalOrders, totalGiaTri: a.totalGiaTri };
}

// ── BAO CAO G: DON BI LOAI — NGUON POS (sheet "dữ liệu đơn", cung nguon voi Bao cao B/E/F) ──
// SUA 2026-10-03 (Duyen yeu cau E, F, G deu tinh theo Pos): TRUOC DAY G doc "DT TỔNG " (Base)
// qua readDTTong_ nen so don bi loai KHONG khop voi E/F/B (da la Pos) — cung 1 don co the
// bi loai o Base nhung van tinh doanh thu o Pos hoac nguoc lai. Nay dung readDonChiTiet_ +
// cung dinh nghia trang thai bi loai (_donHasExcludedStatus_ -> cot "Trạng thái") nhung DAO
// NGUOC dieu kien cua Bao cao B: CHI lay cac dong DA BI LOAI. Bo loc giong B: Sale (cot "Thẻ",
// qua _expandSaleFilterWithPancakeAliases_), Nguon don, Marketer, San pham. "Kenh ban" cua Pos chinh la cot "Nguon don" (Duyen xac nhan 2026-10-03) nen loc/nhom theo nguonDon;
// Pos khong co "thoiGianHT" nen bo loc do (ngay luon theo "ngayTaoDon"). So don/sale: moi sale tren don
// deu tinh 1 don (khong chia deu) — muc dich xem "don bi loai thuoc ve ai", khong phai doanh thu.
function buildFailedOrderReport_(filters) {
  filters = filters || {};
  function toArr(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v).trim()] : []); }
  var saleFilterArr = _expandSaleFilterWithPancakeAliases_(toArr(filters.sale));
  var saleFilterFold = saleFilterArr.map(_normTxt_);
  var wantSaleF_ = _saleWantedFn_(saleFilterFold);
  var nguonFilterArr = toArr(filters.nguon);
  var marketerFilterArr = toArr(filters.marketer);
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);

  var rows = readDonChiTiet_();
  var matched = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!_donHasExcludedStatus_(row.trangThai)) continue; // CHI lay don bi loai (nguoc voi Bao cao B)
    var dt = parseVNDate_(row.ngayTaoDon);
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) continue;
    if (nguonFilterArr.length && nguonFilterArr.indexOf(row.nguonDon) === -1) continue;
    if (marketerFilterArr.length && marketerFilterArr.indexOf(row.marketer) === -1) continue;
    if (saleFilterFold.length) {
      var salesOnRow = _donSaleNamesFromThe_(row.theSale).map(_normTxt_);
      var hit = false;
      for (var si = 0; si < saleFilterFold.length; si++) { if (salesOnRow.indexOf(saleFilterFold[si]) !== -1) { hit = true; break; } }
      if (!hit) continue;
    }
    if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
    matched.push(row);
  }

  var totalCod = 0, totalGiaTri = 0;
  var bySale = {}, byNguon = {}, byMkt = {}, byLyDo = {};
  var UNASSIGNED = '(chưa gán sale)', UNASSIGNED_MKT = '(chưa gán MKT)';
  function add_(obj, key, m) {
    if (!obj[key]) obj[key] = { orders: 0, cod: 0, giaTri: 0 };
    obj[key].orders += 1; obj[key].cod += m.cod; obj[key].giaTri += m.giaTriSauGiam;
  }
  for (var j = 0; j < matched.length; j++) {
    var m = matched[j];
    totalCod += m.cod; totalGiaTri += m.giaTriSauGiam;
    add_(byNguon, m.nguonDon || '(chưa có nguồn)', m);
    add_(byMkt, m.marketer || UNASSIGNED_MKT, m);
    add_(byLyDo, String(m.trangThai || '(không ghi rõ)').trim() || '(không ghi rõ)', m);
    var salesList = _donSaleNamesFromThe_(m.theSale);
    if (salesList.length === 0) salesList = [UNASSIGNED];
    for (var k = 0; k < salesList.length; k++) { if (!wantSaleF_(salesList[k])) continue; add_(bySale, salesList[k], m); }   // dang loc Sale: khong liet ke nguoi dong ban nam ngoai bo loc
  }
  function toArrG(obj) {
    var arr = [];
    for (var key in obj) arr.push({ name: key, orders: obj[key].orders, cod: obj[key].cod, giaTri: obj[key].giaTri });
    arr.sort(function(a, b){ return b.orders - a.orders; });
    return arr;
  }
  return {
    totalOrders: matched.length, totalCod: totalCod, totalGiaTri: totalGiaTri,
    bySale: toArrG(bySale).filter(function(x){ return x.name !== UNASSIGNED; }), byNguon: toArrG(byNguon), byMkt: toArrG(byMkt), byLyDo: toArrG(byLyDo),
    orders: matched.map(function(m){
      return { ngayTao: m.ngayTaoDon, nguonDon: m.nguonDon, marketer: m.marketer,
        saleBan: _donSaleNamesFromThe_(m.theSale).join(', '), sanPham: m.sanPham,
        giaTriDon: m.giaTriSauGiam, cod: m.cod, trangThai: m.trangThai };
    })
  };
}

// ── BAO CAO B: theo "dữ liệu đơn" (bao gom bao cao san pham) ──
// filters: { dateFrom, dateTo, nguon, marketer }
// ═══════════════════════════════════════════════════════════════
//  GHEP DON POS <-> BASE THEO "MA BO DEM" (yeu cau Duyen 2026-10-04)
//  Don Pos co ghi chu (cot Q "dữ liệu đơn") dang "980T09 + 16QT09/2026", "Ghép cùng đơn / Bh395T09/2026 /
//  835T09/2026"... = don Pos nay GOP nhieu don goc ben Base. Khi do KHONG chia doanh thu theo Pos
//  (chia deu cot "Thẻ") nua, ma tinh theo DON GOC ben Base: tong doanh thu don Pos = tong doanh thu
//  cac don goc khop tren "DT TỔNG ", va nguoi tham gia/sale chia theo dung sale cua tung don goc.
// ═══════════════════════════════════════════════════════════════


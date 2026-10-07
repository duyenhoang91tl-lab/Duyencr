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
var SALE_TIER_ORDER_ = ['TVF1', 'TVF2', 'F1', 'F2', 'F3', 'O1', 'O2', 'O3', 'O'];
var SALE_TIER_DEFAULT_TARGETS_ = {
  TVF1: 240000000, TVF2: 300000000,
  F1: 400000000, F2: 500000000, F3: 600000000,
  O1: 700000000, O2: 800000000, O3: 900000000,
  O: 500000000
};
var SALE_TIER_META_ = {
  TVF1: { track: 'F', level: 0, probation: true },
  TVF2: { track: 'F', level: 0, probation: true },
  F1: { track: 'F', level: 1 },
  F2: { track: 'F', level: 2 },
  F3: { track: 'F', level: 3 },
  O1: { track: 'O', level: 1 },
  O2: { track: 'O', level: 2 },
  O3: { track: 'O', level: 3 },
  O: { track: 'OFLAT', level: 0 }
};
var SALE_KPI_DEFAULT_CFG_ = {
  tierTargets: JSON.parse(JSON.stringify(SALE_TIER_DEFAULT_TARGETS_)),
  startTier: {},                   // ten Sale (dung y het chuoi "Sale bán"/"Thẻ") -> 1 trong SALE_TIER_ORDER_
  trackingStartMonth: '2026-09',   // 'YYYY-MM' - thang bat dau tu dong tinh bac theo quy che
  overrides: {}                    // ten Sale -> so tien KPI rieng (uu tien tuyet doi, bo qua bac tu dong)
};

function readSaleKpiConfig_() {
  var out = JSON.parse(JSON.stringify(SALE_KPI_DEFAULT_CFG_));
  try {
    var raw = getSetting_('saleKpiConfig');
    if (raw) {
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        if (o.tierTargets && typeof o.tierTargets === 'object') {
          SALE_TIER_ORDER_.forEach(function(k) { var n = Number(o.tierTargets[k]); if (!isNaN(n) && n >= 0) out.tierTargets[k] = n; });
        }
        if (o.trackingStartMonth) out.trackingStartMonth = String(o.trackingStartMonth);
        if (o.startTier && typeof o.startTier === 'object') {
          Object.keys(o.startTier).forEach(function(name) { if (SALE_TIER_META_[o.startTier[name]]) out.startTier[name] = o.startTier[name]; });
        }
        if (o.overrides && typeof o.overrides === 'object') out.overrides = o.overrides;
        // Migration tu cau hinh CU (truoc 2026-10, 3 bac chung "1"/"2"/"3" + 1 muc Online phang):
        // neu CHUA co startTier moi ma con du lieu cu (o.tiers), tu suy startTier 1 lan de khong
        // mat trang toan bo cau hinh da cham truoc do. "1"/"2"/"3" (Van phong) -> F1/F2/F3; Sale
        // tung duoc gan saleChannels='online' nhung chua co trong o.tiers -> mac dinh 'O' (phang,
        // an toan nhat vi khong biet ho dang o muc nao trong O1-O3) — Duyen sua lai tung nguoi sau.
        if ((!o.startTier || !Object.keys(o.startTier).length)) {
          var oldMap = { '1': 'F1', '2': 'F2', '3': 'F3' };
          if (o.tiers && typeof o.tiers === 'object') {
            Object.keys(o.tiers).forEach(function(name) { var mapped = oldMap[o.tiers[name]]; if (mapped) out.startTier[name] = mapped; });
          }
          try {
            var rawCh = getSetting_('saleChannels');
            if (rawCh) {
              var oCh = JSON.parse(rawCh);
              Object.keys(oCh || {}).forEach(function(name) { if (oCh[name] === 'online' && !out.startTier[name]) out.startTier[name] = 'O'; });
            }
          } catch (eCh) {}
        }
      }
    }
  } catch (e) {}
  // Config cu chi co onlineTarget, chua tung luu targets.online rieng -> lay onlineTarget lam gia tri khoi diem.
  if (out.targets.online === SALE_KPI_DEFAULT_CFG_.targets.online && out.onlineTarget !== SALE_KPI_DEFAULT_CFG_.onlineTarget) {
    out.targets.online = out.onlineTarget;
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

// State machine tinh bac tung thang cho 1 Sale, bat dau tu startTier o thang dau tien cua mang
// months (= trackingStartMonth). Quy tac (theo sheet "Bậc" + xac nhan Duyen 2026-10-01, va xac
// nhan rieng ve "Riêng Bậc 2" ngay 2026-10-04):
//  - Bac thu viec (probation): CHI giu dung 1 thang. Thang ke tiep tu dong ky chinh thuc:
//      + TVF1 -> F1 (binh thuong, khong co dieu kien gi them).
//      + TVF2 -> F2 (vao thang chinh thuc DAU TIEN), NHUNG rieng truong hop nay phai qua them
//        1 lan kiem tra rieng ("Riêng Bậc 2"): DUNG 2 THANG DAU TIEN lam F2 phai MOI THANG rieng
//        deu dat >=100% KPI cua F2 — khong dat (du chi 1 trong 2 thang) thi HA NGAY xuong F1 o
//        thang thu 3 de "chay lai" tu dau theo quy tac thuong (khong cho o lai F2 cho het 3 thang
//        nhu quy tac tang/giam binh thuong). Neu qua duoc 2 thang nay, tu thang thu 3 tro di xet
//        theo dung quy tac 3-thang binh thuong nhu moi bac khac.
//  - Bac 'O' (track OFLAT): khong bao gio doi, giu nguyen KPI mai mai.
//  - Bac chinh thuc (F1-F3, O1-O3) O NGOAI giai doan kiem tra rieng 2 thang dau cua F2 noi tren:
//    moi thang, neu 3 thang LIEN TIEP NGAY TRUOC do CUNG o dung 1 bac nay (tranh xet nua voi
//    trong luc dang doi bac):
//      + TB doanh thu 3 thang do >= 125% KPI bac hien tai VA KHONG thang nao < 70% KPI bac hien
//        tai => TANG 1 bac (toi da bac 3 trong track, F3/O3 khong tang them).
//      + TB doanh thu 3 thang do < 80% KPI bac hien tai => GIAM 1 bac (toi thieu bac 1, F1/O1
//        khong giam them).
//      + Nguoc lai: giu nguyen bac.
function _computeSaleTierTimeline_(startTier, months, monthlyRevenue, tierTargets) {
  var timeline = {};
  for (var i = 0; i < months.length; i++) {
    var ym = months[i];
    if (i === 0) { timeline[ym] = startTier; continue; }
    var prevYm = months[i - 1], prevTier = timeline[prevYm], meta = SALE_TIER_META_[prevTier];
    if (!meta) { timeline[ym] = prevTier; continue; }
    if (meta.probation) { timeline[ym] = (prevTier === 'TVF2') ? 'F2' : 'F1'; continue; }
    if (meta.track === 'OFLAT') { timeline[ym] = prevTier; continue; }
    // "Riêng Bậc 2": dung luc dang o thang thu 3 lam F2 ke tu khi ky chinh thuc tu TVF2 (2 thang
    // truoc la TVF2 -> F2, van con F2 den gio) — kiem tra RIENG 2 thang do thay vi quy tac 3-thang
    // thuong. Dat dieu kien nay TRUOC quy tac 3-thang chung de khong bi dung nham (thang i-3 la
    // TVF2 chu khong phai F2 nen quy tac 3-thang thuong cung khong khop o day, nhung ghi ro cho de doc).
    if (prevTier === 'F2' && i >= 3 && timeline[months[i - 3]] === 'TVF2' && timeline[months[i - 2]] === 'F2') {
      var kpiF2 = tierTargets['F2'] || 0;
      var rm2 = monthlyRevenue[months[i - 2]] || 0, rm1 = monthlyRevenue[prevYm] || 0;
      var passed2mo = kpiF2 > 0 && rm2 >= kpiF2 && rm1 >= kpiF2; // CA 2 thang deu phai rieng >=100%
      timeline[ym] = passed2mo ? 'F2' : 'F1';
      continue;
    }
    if (i >= 3 && timeline[months[i - 3]] === prevTier && timeline[months[i - 2]] === prevTier) {
      var kpi = tierTargets[prevTier] || 0;
      var r1 = monthlyRevenue[months[i - 3]] || 0, r2 = monthlyRevenue[months[i - 2]] || 0, r3 = monthlyRevenue[prevYm] || 0;
      var avg3 = (r1 + r2 + r3) / 3, min3 = Math.min(r1, r2, r3);
      if (kpi > 0 && avg3 >= kpi * 1.25 && min3 >= kpi * 0.70 && meta.level < 3) { timeline[ym] = meta.track + (meta.level + 1); continue; }
      if (kpi > 0 && avg3 < kpi * 0.80 && meta.level > 1) { timeline[ym] = meta.track + (meta.level - 1); continue; }
    }
    timeline[ym] = prevTier;
  }
  return timeline;
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
      timeline = _computeSaleTierTimeline_(cfg.startTier[name], months, monthlyRevByName[name] || {}, cfg.tierTargets);
      tierNow = timeline[monthsInRange[monthsInRange.length - 1]] || cfg.startTier[name];
      target = monthsInRange.reduce(function(sum, ym) { return sum + (cfg.tierTargets[timeline[ym] || cfg.startTier[name]] || 0); }, 0);
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
    var nhom = meta ? (meta.track === 'F' ? 'Văn phòng' : 'Online') : '(chưa gán bậc)';
    var pct = (target && target > 0) ? Math.round(r.revenue / target * 1000) / 10 : null;
    var pctCommit = (commit && commit > 0) ? Math.round(r.revenue / commit * 1000) / 10 : null;
    return { name: name, nhom: nhom, tier: tierNow, revenue: r.revenue, orders: r.orders,
      target: target, source: source, pct: pct, passed: (pct !== null) ? pct >= 100 : null,
      commit: commit, pctCommit: pctCommit, passedCommit: (pctCommit !== null) ? pctCommit >= 100 : null,
      timeline: timeline,
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
    for (var k = 0; k < salesList.length; k++) add_(bySale, salesList[k], m);
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


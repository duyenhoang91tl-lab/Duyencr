// ─── SAN PHAM CHI TIET TU GOOGLE SHEET RIENG, NHIEU TAB (moi tab = 1 hang) ─────────
// Cau hinh: setSetting_('productSheetUrl', <link Google Sheet>) — file phai duoc chia
// se cho tai khoan dang chay Apps Script nay (hoac "Bat ky ai co lien ket" > Xem).
// Dong 1 moi tab = tieu de cot (ten tuy y). Cot dau = ten san pham. Cac o mo ta co the
// RAT DAI (nhu anh Duyen gui — mo ta chi tiet thanh phan/cong dung tung dong nhieu tram
// tu) VA co nhieu tab (nhieu hang) => KHONG duoc nhet toan bo sheet vao 1 prompt (qua
// nang, cham, ton phi AI). Cach lam:
//   1) Cache 1 "muc luc" NHE cho tung tab (ten SP + vi tri dong + doan trich ngan) —
//      cache rieng tung tab de khong vuot gioi han 100KB/1 cache key.
//   2) Khi co cau hoi (query = noi dung prompt dang gui cho AI, gom ca "Ngu canh" CS
//      nhap tay vd go "AHA"), tim trong muc luc cac dong co TU KHOA khop, xep hang theo
//      so tu khop.
//   3) CHI luc do moi doc lai NGUYEN VAN vai dong diem cao nhat (toi da 4 dong) tu dung
//      sheet — vua chinh xac vua khong lam prompt qua tai.
var _PSHEET_STOPWORDS_ = ['khach','san','pham','hang','chao','nhan','tin','giong','van',
  'yeu','cau','tra','loi','cham','soc','mua','goi','ngan','gon','tieng','viet','duoc',
  'nay','cho','voi','theo','mot','cac','trong','nguoi','minh','ban','the','nao','khong'];

function _psheetNoAccent_(s) {
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

// Map SDT (da normPhone_) -> care object day du (status, khStatus, zalo, nickZalos...) —
// dung de loc Bao cao B theo tieu chi CRM (chi B co cot SDT trong "dữ liệu đơn").
function _careMapByPhone_() {
  var rows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(rows[i].phone);
    if (ph) map[ph] = rows[i];
  }
  return map;
}
// Khop 1 chuoi voi bat ky tu khoa nao trong danh sach (khong dau, khong phan biet hoa/thuong).
// terms rong -> coi nhu KHONG loc (tra ve true).
function _pMatchAny_(text, foldedTerms) {
  if (!foldedTerms || !foldedTerms.length) return true;
  var t = _psheetNoAccent_(text || '');
  for (var i = 0; i < foldedTerms.length; i++) {
    if (foldedTerms[i] && t.indexOf(foldedTerms[i]) !== -1) return true;
  }
  return false;
}
function _foldTermsCSV_(s) {
  return s ? String(s).split(',').map(function(x){ return _psheetNoAccent_(x.trim()); }).filter(function(x){ return x; }) : [];
}

function _productSheetIndexForTab_(ss, tabName) {
  var cacheKey = 'ext_idx_v2_' + tabName;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}
  var idx = [];
  try {
    var sh = ss.getSheetByName(tabName);
    if (sh && sh.getLastRow() >= 2 && sh.getLastColumn() >= 1) {
      var vals = sh.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var row = vals[i];
        if (!row[0]) continue;
        var snippet = row.map(function(v){ return String(v||'').trim(); }).filter(Boolean).join(' ').substring(0, 250);
        idx.push({ row: i + 1, name: String(row[0]).trim(), snippet: snippet });
      }
    }
  } catch (e) { /* tab loi/khong doc duoc -> bo qua tab nay */ }
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(idx), 900); } catch (ec2) {} // 15 phut
  return idx;
}

// ─── Q&A / FAQ: doc sheet "FAQ" trong CareData, khop tu khoa cau hoi khach -> lay top Q&A ───
// Cot: A=STT | B=Ten SP | C=Trang thai | D=CAU HOI | E=CAU TRA LOI (dong 1 la tieu de)
function readFaqSheet_(query) {
  var ss = getCrmSS_();
  var sh = null;
  var names = ['FAQ', 'Q&A', 'QA', 'FAQs', 'Hỏi đáp', 'Hoi dap', 'HoiDap'];
  for (var n = 0; n < names.length; n++) { sh = ss.getSheetByName(names[n]); if (sh) break; }
  if (!sh || sh.getLastRow() < 2) return '';
  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var vals = sh.getDataRange().getValues();
  // Tu do cot: tim cot tieu de chua "cau hoi" / "cau tra loi" / "ten sp"
  var header = vals[0].map(function(h){ return _psheetNoAccent_(h); });
  var findCol = function(kw, def){ for (var c=0;c<header.length;c++){ if (header[c].indexOf(kw)!==-1) return c; } return def; };
  var cQ  = findCol('cau hoi', 3);
  var cA  = findCol('tra loi', 4);
  var cSP = findCol('ten sp', 1);
  var cands = [];
  for (var i = 1; i < vals.length; i++) {
    var sp   = String(vals[i][cSP] || '').trim();
    var ques = String(vals[i][cQ] || '').trim();
    var ans  = String(vals[i][cA] || '').trim();
    if (!ques || !ans) continue;
    var hay = _psheetNoAccent_(sp + ' ' + ques + ' ' + ans);
    var score = 0;
    for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
    if (score > 0) cands.push({ sp: sp, q: ques, a: ans, score: score });
  }
  if (!cands.length) return '';
  cands.sort(function(a, b) { return b.score - a.score; });
  var top = cands.slice(0, 4);
  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    var a = top[k].a; if (a.length > 700) a = a.substring(0, 700) + '...';
    blocks.push((top[k].sp ? '[' + top[k].sp + '] ' : '') + 'HOI: ' + top[k].q + '\nTRA LOI MAU: ' + a);
  }
  return blocks.join('\n\n');
}

function readExternalProductSheet_(query) {
  var url = getSetting_('productSheetUrl') || DEFAULT_PRODUCT_SHEET_URL;
  if (!url) return '';
  var ss;
  try { ss = SpreadsheetApp.openByUrl(url); } catch (e) { return ''; } // chua chia se quyen / URL sai

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var tabNames = ss.getSheets().map(function(s) { return s.getName(); });
  var candidates = [];
  for (var t = 0; t < tabNames.length; t++) {
    var idx = _productSheetIndexForTab_(ss, tabNames[t]);
    for (var i = 0; i < idx.length; i++) {
      var hay = _psheetNoAccent_(idx[i].name + ' ' + idx[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > 0) candidates.push({ brand: tabNames[t], row: idx[i].row, score: score });
    }
  }
  if (!candidates.length) return '';
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 4);

  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    try {
      var sh2 = ss.getSheetByName(top[k].brand);
      var lastCol = sh2.getLastColumn();
      var headerVals = sh2.getRange(1, 1, 1, lastCol).getValues()[0];
      var rowVals = sh2.getRange(top[k].row, 1, 1, lastCol).getValues()[0];
      var parts = [];
      for (var c = 0; c < headerVals.length; c++) {
        var h = String(headerVals[c] || '').trim();
        var v = String(rowVals[c] || '').trim();
        if (h && v && !/hinh|image|ảnh/i.test(h)) parts.push(h + ': ' + v);
      }
      var block = '[Hãng: ' + top[k].brand + ']\n' + parts.join('\n');
      if (block.length > 1800) block = block.substring(0, 1800) + '...';
      blocks.push(block);
    } catch (e) { /* bo qua dong loi, khong chan cac dong khac */ }
  }
  return blocks.join('\n\n---\n\n');
}

function callGroqAI_(data) { return callAI_(data); } // alias tuong thich cu

// ═══════════════════════════════════════════════════════════════
//  CHI SO POS DUNG CHUNG (P0d cua docs/ROADMAP-YEU-CAU.md) — posMetrics_
//  MOT cho tinh cac chi so cua nguon Pos ("dữ liệu đơn") cho moi man moi (tong quan, ho so sale, AI tom tat, chien dich):
//  doanh thu, so don, don huy/hoan, ty le huy/hoan, don BAN LAI (renew). KHONG tinh lai logic: doanh thu + so don lay NGUYEN tu
//  buildSalesReportB_ (da loc "Đã hoàn"/"Đang hoàn", gop don tach, chia sale), huy/hoan lay NGUYEN tu buildFailedOrderReport_ (Bao cao G)
//  -> so tren man moi KHONG THE lech Bao cao B/G. Chi phan "ban lai" la moi (tinh tren chinh danh sach don cua B).
//  Dinh nghia (Duyen chot 2026-10-11, Q5/Q6):
//   - Huy/hoan = don Pos co cot "Trạng thái" la "Đã hoàn"/"Đang hoàn" (_donHasExcludedStatus_). Ty le = huy/hoan ÷ (don tinh doanh thu + huy/hoan).
//   - Ban lai (renew; "renew" va "bán lại" la MOT khai niem) = don tinh doanh thu ma KHACH (SDT chuan hoa) da co it nhat 1 don Pos hop le
//     (khong bi loai) o NGAY TRUOC do. Don cung ngay voi don dau tien cua khach van la don MOI. Don khong co SDT -> khong xep loai duoc
//     (dem rieng o unknownPhoneOrders, khong tinh vao ty le). Lich su doc tu CA sheet "dữ liệu đơn" (khong chi trong ky loc).
//     CHUA CHOT (Q6): neu Duyen muon "renew" tinh theo NGUON don thay vi theo lich su khach thi chi can sua _posIsResale_.
//   - Moi sale: don dem 1 cho MOI sale tren don, doanh thu chia dung ty le nhu Bao cao B (chia deu / ghep Base / quay 30-70).
//   - Chi so khong co du lieu -> null (khong tra 0) de man hinh hien "chua co du lieu".
//  Luu y: neu sau nay bat luu tru don cu (ARCHIVE_APPLY_ENABLED_), lich su ban lai phai doc them sheet luu tru (docs/ARCHIVE-PLAN.md buoc 2).
// ═══════════════════════════════════════════════════════════════
function _posEarliestValidDayByPhone_() {
  var rows = readDonChiTiet_(), first = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (_donHasExcludedStatus_(r.trangThai)) continue;
    var ph = normPhone_(r.soDienThoai); if (!ph) continue;
    var d = _vnYmd_(parseVNDate_(r.ngayTaoDon)); if (!d) continue;
    if (first[ph] === undefined || d < first[ph]) first[ph] = d;
  }
  return first;
}
// 1 don (phan tu cua buildSalesReportB_().orders) co phai don BAN LAI khong. true/false; null = khong xep loai duoc (thieu SDT hoac ngay).
function _posIsResale_(order, firstDayByPhone) {
  var ph = normPhone_(order.soDienThoai); if (!ph) return null;
  var d = _vnYmd_(parseVNDate_(order.ngayTaoDon)); if (!d) return null;
  var f = firstDayByPhone[ph];
  return f !== undefined && f < d;
}
// Ty le chia cua 1 don cho tung sale — GIONG HET vong lap bySale trong buildSalesReportB_ (ghep Base -> frac; thuong -> chia deu; quay 30/70 -> x saleRatio).
function _posSaleFractions_(order) {
  var out = [], ratio = order.saleRatio || 1, names;
  if (order.saleShares && order.saleShares.length) {
    order.saleShares.forEach(function(x) { out.push({ name: x.name, frac: x.frac * ratio }); });
    return out;
  }
  names = String(order.saleBanValid || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  names.forEach(function(n) { out.push({ name: n, frac: ratio / names.length }); });
  return out;
}
// opts: { from, to ('YYYY-MM-DD'), sale[], nguon[], marketer[], sanPham } — cung bo loc voi Bao cao B/G.
function posMetrics_(opts) {
  opts = opts || {};
  var today = _vnYmd_(new Date());
  var from = opts.from || opts.dateFrom || (today.substring(0, 8) + '01'), to = opts.to || opts.dateTo || today;
  var warnings = [];
  var f = { dateFrom: from, dateTo: to, sale: opts.sale || [], nguon: opts.nguon || [], marketer: opts.marketer || [], sanPham: opts.sanPham || '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '', withDaily: !!opts.withDaily };
  // opts.parts (mac dinh du 3): ['revenue','failed','resale'] — man chi can 1 phan (vd tong quan chi can huy/hoan) thi khong phai doc/tinh phan kia.
  var want = { revenue: true, failed: true, resale: true };
  if (Array.isArray(opts.parts)) { want = {}; opts.parts.forEach(function(x) { want[x] = true; }); }
  var out = { ok: true, source: 'pos', from: from, to: to, total: null, bySale: [], byDay: [], resale: null, warnings: warnings };
  var rb = null, rg = null;
  if (want.revenue || want.resale) try { rb = buildSalesReportB_(f); } catch (e1) { warnings.push('Không đọc được doanh thu Pos: ' + e1.message); }
  if (want.failed) try { rg = buildFailedOrderReport_(f); } catch (e2) { warnings.push('Không đọc được đơn hủy/hoàn Pos: ' + e2.message); }
  if (!rb && !rg) { out.ok = false; return out; }

  var bySale = {};
  function S(name) { return bySale[name] || (bySale[name] = { name: name, orders: 0, revenue: 0, failedOrders: 0, failedValue: 0, resaleOrders: 0, resaleRevenue: 0 }); }
  var byDay = {};
  function Dy(d) { return byDay[d] || (byDay[d] = { day: d, orders: 0, revenue: 0, failedOrders: 0, failedValue: 0, resaleOrders: 0 }); }

  if (rb) {
    (rb.bySale || []).forEach(function(r) { var s = S(r.name); s.orders = r.orders; s.revenue = r.giaTri; });
    (rb.orders || []).forEach(function(o) { var d = _vnYmd_(parseVNDate_(o.ngayTaoDon)); if (!d) return; var y = Dy(d); y.orders += 1; y.revenue += Number(o.giaTriSauGiam) || 0; });
  }
  if (rg) {
    (rg.bySale || []).forEach(function(r) { var s = S(r.name); s.failedOrders = r.orders; s.failedValue = r.giaTri; });
    (rg.orders || []).forEach(function(o) { var d = _vnYmd_(parseVNDate_(o.ngayTao)); if (!d) return; var y = Dy(d); y.failedOrders += 1; y.failedValue += Number(o.giaTriDon) || 0; });
  }

  // BAN LAI (renew) — chi tinh tren cac don da qua bo loc cua Bao cao B
  var resale = null;
  if (rb && want.resale) {
    try {
      var first = _posEarliestValidDayByPhone_();
      resale = { orders: 0, revenue: 0, newOrders: 0, newRevenue: 0, unknownPhoneOrders: 0, unknownPhoneRevenue: 0, rate: null };
      (rb.orders || []).forEach(function(o) {
        var v = Number(o.giaTriSauGiam) || 0, isR = _posIsResale_(o, first), d = _vnYmd_(parseVNDate_(o.ngayTaoDon));
        if (isR === null) { resale.unknownPhoneOrders += 1; resale.unknownPhoneRevenue += v; return; }
        if (isR) { resale.orders += 1; resale.revenue += v; if (d) Dy(d).resaleOrders += 1; } else { resale.newOrders += 1; resale.newRevenue += v; }
        if (isR) _posSaleFractions_(o).forEach(function(sf) { var s = S(sf.name); s.resaleOrders += 1; s.resaleRevenue += v * sf.frac; });
      });
      var classified = resale.orders + resale.newOrders;
      resale.rate = classified ? Math.round(resale.orders / classified * 1000) / 10 : null;
    } catch (e3) { warnings.push('Không tính được đơn bán lại: ' + e3.message); resale = null; }
  }
  if (typeof ARCHIVE_APPLY_ENABLED_ !== 'undefined' && ARCHIVE_APPLY_ENABLED_) warnings.push('Đã bật lưu trữ đơn cũ: lịch sử khách để tính "bán lại" có thể thiếu (xem docs/ARCHIVE-PLAN.md bước 2).');

  var revenue = rb ? rb.totalGiaTri : null, orders = rb ? rb.totalOrders : null;
  var failed = rg ? rg.totalOrders : null, failedValue = rg ? rg.totalGiaTri : null;
  out.total = {
    revenue: revenue, orders: orders, aov: orders ? Math.round(revenue / orders) : null,
    failedOrders: failed, failedValue: failedValue,
    failRate: (orders !== null && failed !== null && (orders + failed)) ? Math.round(failed / (orders + failed) * 1000) / 10 : null
  };
  out.resale = resale;
  if (opts.withDaily && rb) out.bySaleDay = rb.bySaleDay || {};   // {ten sale: {YYYY-MM-DD: [so don, doanh thu]}} — nguyen tu Bao cao B
  out.bySale = Object.keys(bySale).map(function(k) {
    var s = bySale[k], n = s.orders + s.failedOrders;
    s.aov = s.orders ? Math.round(s.revenue / s.orders) : null;
    s.failRate = n ? Math.round(s.failedOrders / n * 1000) / 10 : null;
    return s;
  }).sort(function(a, b) { return b.revenue - a.revenue; });
  out.byDay = Object.keys(byDay).sort().map(function(k) { return byDay[k]; });
  return out;
}
// Chay tay trong Apps Script Editor (chon ten ham o o "Run" -> Run -> xem "Execution log"): chi so Pos thang nay + doi chieu voi Bao cao B/G.
function xemChiSoPos() {
  var today = _vnYmd_(new Date()), from = today.substring(0, 8) + '01';
  var m = posMetrics_({ from: from, to: today });
  var f = { dateFrom: from, dateTo: today, sale: [], nguon: [], marketer: [], sanPham: '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '' };
  var b = buildSalesReportB_(f), g = buildFailedOrderReport_(f);
  var khop = m.total.orders === b.totalOrders && m.total.revenue === b.totalGiaTri && m.total.failedOrders === g.totalOrders;
  Logger.log('Kỳ ' + from + ' → ' + today + ' | doanh thu Pos ' + m.total.revenue + ' | ' + m.total.orders + ' đơn | hủy/hoàn ' + m.total.failedOrders + ' đơn (' + m.total.failRate + '%) | bán lại ' + (m.resale ? m.resale.orders + ' đơn (' + m.resale.rate + '%)' : 'chưa có dữ liệu'));
  Logger.log('Đối chiếu với Báo cáo B/G: ' + (khop ? 'KHỚP' : 'LỆCH — B: ' + b.totalOrders + ' đơn / ' + b.totalGiaTri + ', G: ' + g.totalOrders + ' đơn'));
  if (m.warnings.length) Logger.log('Cảnh báo: ' + m.warnings.join(' | '));
  return m;
}

// ═══════════════════════════════════════════════════════════════
//  AI PHAN TICH TOAN TEAM (v13.23) — action GET teamAnalysis
//  Gom so lieu tung nguoi tu CAC BAO CAO DA CO (KPI Sale / Pancake KPI / don that bai / CS them KH moi),
//  CHAM DIEM + XEP LOAI bang quy tac CO DINH (on dinh, giai thich duoc) roi nho AI viet nhan xet. AI loi/thieu key van ra bang
//  day du (nhan xet dung quy tac). Khong gui SDT khach cho AI — chi gui ten nhan vien + chi so tong hop.
//  Chi admin/leader dung duoc (client an menu; tai khoan test khong nam trong DEMO_ALLOWED_GET_).
// ═══════════════════════════════════════════════════════════════
function _taNum_(v) { v = Number(v); return isFinite(v) ? v : 0; }
function _taClamp_(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function _taMedian_(arr) {
  var a = arr.slice().sort(function(x, y) { return x - y; });
  if (!a.length) return 0;
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
// pos (tuy chon) = ket qua posMetrics_ da co san: lay don huy/hoan tu do (cung so voi Bao cao G) thay vi goi G lan nua.
function buildTeamMetrics_(from, to, pos) {
  var warnings = [], people = {};
  var pkeyTM = _salePersonKeyFn_();   // KHOP SALE: KPI Sale (Pos/Base), KPI Pancake, don huy, CS them KH co the goi CUNG 1 nguoi bang cac ten khac nhau -> gom ve 1 nguoi
  function P(name) {
    var k = pkeyTM(name); if (!k) return null;
    if (!people[k]) people[k] = { name: String(name).trim(), nhom: '', tier: '', revenue: 0, orders: 0, target: 0, pct: null, commit: 0, pctCommit: null,
      tongTT: 0, sdtMangVe: 0, tyLeChot: null, failedOrders: 0, careLeads: 0, deptKey: '', dept: '' };
    return people[k];
  }
  try {
    var k1 = buildSaleKpiReport_({ dateFrom: from, dateTo: to, dateField: 'ngayTao', sale: [], kenh: [], sanPham: '', byCreator: false });
    (k1.rows || []).forEach(function(r) {
      var p = P(r.name); if (!p) return;
      // 1 nguoi co the co NHIEU dong KPI (moi ten 1 dong) -> CONG don doanh thu/so don; nhom/bac/muc tieu lay dong dau co gia tri (1 nguoi chi co 1 muc tieu)
      if (!p.nhom) p.nhom = r.nhomChung || r.nhom || ''; if (!p.tier) p.tier = r.tier || '';
      if (!p.deptKey) { p.deptKey = r.nhomChungKey || ''; p.dept = r.nhomChung || ''; }
      p.revenue += _taNum_(r.revenue); p.orders += _taNum_(r.orders);
      var tg = _taNum_(r.target), cm = _taNum_(r.commit);
      if (!p.target && tg) p.target = tg; if (!p.commit && cm) p.commit = cm;
    });
    // pct tinh lai tu doanh thu DA GOP (cung cong thuc buildSaleKpiReport_)
    Object.keys(people).forEach(function(k) {
      var q = people[k];
      q.pct = (q.target && q.target > 0) ? Math.round(q.revenue / q.target * 1000) / 10 : null;
      q.pctCommit = (q.commit && q.commit > 0) ? Math.round(q.revenue / q.commit * 1000) / 10 : null;
    });
  } catch (e1) { warnings.push('Không đọc được KPI Sale: ' + e1.message); }
  try {
    var k2 = buildKpiReport_(from, to, []);
    var tcW = {};   // tong (ty le chot x tuong tac) de tinh trung binh co trong so khi 1 nguoi co nhieu ten tren Pancake
    (k2.bySale || []).forEach(function(r) {
      var p = P(r.name); if (!p) return;
      var tt = _taNum_(r.tongTT), kk = pkeyTM(r.name);
      p.tongTT += tt; p.sdtMangVe += _taNum_(r.sdtMangVe);
      tcW[kk] = (tcW[kk] || 0) + (tt ? _taNum_(r.tyLeChot) * tt : 0);
      p.tyLeChot = p.tongTT ? Math.round(tcW[kk] / p.tongTT * 100) / 100 : null;
      // KHONG con lay doanh thu/so don tu Pancake khi Pos chua co (Duyen chot 2026-10-12: bao cao tinh tu Pos; Base chi check nguoc cho don GHEP/TACH, viec do nam trong buildSalesReportB_). Pancake chi cho chi so hoi thoai (tongTT/sdtMangVe/tyLeChot).
    });
  } catch (e2) { warnings.push('Không đọc được KPI Pancake: ' + e2.message); }
  if (pos && pos.total && pos.total.failedOrders !== null && pos.total.failedOrders !== undefined) {
    (pos.bySale || []).forEach(function(r) { if (!r.failedOrders) return; var p = P(r.name); if (p) p.failedOrders += _taNum_(r.failedOrders); });   // chi nguoi CO don huy/hoan, giong G (khong tao them nguoi chi co doanh thu)
  } else try {
    var k3 = buildFailedOrderReport_({ dateFrom: from, dateTo: to, sale: [], nguon: [], marketer: [], sanPham: '' });
    (k3.bySale || []).forEach(function(r) { var p = P(r.name); if (p) p.failedOrders += _taNum_(r.orders); });
  } catch (e3) { warnings.push('Không đọc được báo cáo đơn thất bại: ' + e3.message); }
  try {
    var k4 = buildCareLeadReport_({ dateFrom: from, dateTo: to, cs: [] });
    (k4.byCS || []).forEach(function(r) { var p = P(r.name); if (p) p.careLeads += _taNum_(r.count); });
  } catch (e4) { warnings.push('Không đọc được báo cáo CS thêm KH: ' + e4.message); }
  return { list: Object.keys(people).map(function(k) { return people[k]; }), warnings: warnings };
}
// Cham diem 0-100 + xep loai. Diem = trung binh co trong so cua cac thanh phan CO DU LIEU (khong phat nguoi thieu 1 nguon so lieu).
function scoreTeam_(list) {
  var act = list.filter(function(p) { return p.orders > 0 || p.tongTT > 0 || p.failedOrders > 0 || p.careLeads > 0 || p.revenue > 0; });
  var closeVals = act.filter(function(p) { return p.tongTT >= 10 && p.tyLeChot !== null; }).map(function(p) { return p.tyLeChot; });
  var medClose = _taMedian_(closeVals);
  var totOrders = 0, totFailed = 0, totRev = 0;
  act.forEach(function(p) { totOrders += p.orders; totFailed += p.failedOrders; totRev += p.revenue; });
  var teamFail = (totOrders + totFailed) ? totFailed / (totOrders + totFailed) : 0;
  var byRev = act.slice().sort(function(a, b) { return b.revenue - a.revenue; });
  byRev.forEach(function(p, i) { p._revPct = byRev.length > 1 ? (byRev.length - 1 - i) / (byRev.length - 1) * 100 : 100; });
  act.forEach(function(p) {
    var comps = [], strengths = [], issues = [];
    p.failRate = (p.orders + p.failedOrders) ? p.failedOrders / (p.orders + p.failedOrders) : null;
    if (p.pct !== null) {
      comps.push({ w: 45, v: _taClamp_(p.pct, 0, 120) / 120 * 100 });
      if (p.pct >= 100) strengths.push('Đạt ' + p.pct + '% KPI');
      else if (p.pct < 70) issues.push('Mới đạt ' + p.pct + '% KPI');
    }
    if (p.revenue > 0 || p.orders > 0) {
      comps.push({ w: 20, v: p._revPct });
      if (p._revPct >= 75 && byRev.length >= 4) strengths.push('Doanh thu thuộc nhóm đứng đầu team');
      else if (p._revPct <= 25 && byRev.length >= 4) issues.push('Doanh thu thuộc nhóm thấp nhất team');
    }
    if (p.tongTT >= 10 && p.tyLeChot !== null && medClose > 0) {
      comps.push({ w: 20, v: _taClamp_(p.tyLeChot / (medClose * 1.5) * 100, 0, 100) });
      if (p.tyLeChot >= medClose * 1.2) strengths.push('Tỷ lệ chốt ' + p.tyLeChot + '% cao hơn mức giữa team (' + Math.round(medClose * 10) / 10 + '%)');
      else if (p.tyLeChot < medClose * 0.7) issues.push('Tỷ lệ chốt ' + p.tyLeChot + '% thấp hơn mức giữa team (' + Math.round(medClose * 10) / 10 + '%)');
    }
    if (p.failRate !== null && (p.orders + p.failedOrders) >= 5) {
      comps.push({ w: 15, v: _taClamp_(100 - p.failRate * 100 * 2.5, 0, 100) });
      if (p.failedOrders >= 3 && p.failRate > Math.max(teamFail * 1.5, 0.1)) issues.push(p.failedOrders + ' đơn thất bại (' + Math.round(p.failRate * 1000) / 10 + '% so với mức chung ' + Math.round(teamFail * 1000) / 10 + '%)');
      else if (p.failRate <= teamFail * 0.5 && p.orders >= 5) strengths.push('Ít đơn thất bại');
    }
    var wSum = comps.reduce(function(s, c) { return s + c.w; }, 0);
    p.score = wSum ? Math.round(comps.reduce(function(s, c) { return s + c.w * c.v; }, 0) / wSum) : null;
    p.enough = comps.length >= 2 || (p.pct !== null);
    p.rating = !p.enough || p.score === null ? 'chuadu' : (p.score >= 70 ? 'tot' : (p.score >= 45 ? 'trungbinh' : 'kem'));
    if (p.rating === 'chuadu') { p.score = null; strengths = []; issues = []; }   // it so lieu -> khong ket luan hay/do, tranh nhan xet gay hieu nham
    p.strengths = strengths; p.issues = issues;
    p.comment = p.rating === 'chuadu' ? 'Chưa đủ số liệu trong kỳ này để đánh giá (ít đơn / chưa có KPI hoặc dữ liệu Pancake).' : ((strengths.concat(issues)).join('; ') || 'Chưa có điểm nổi bật hay điểm yếu rõ ràng trong kỳ này.');
    delete p._revPct;
  });
  var order = { tot: 0, trungbinh: 1, kem: 2, chuadu: 3 };
  act.sort(function(a, b) { return (order[a.rating] - order[b.rating]) || ((b.score || 0) - (a.score || 0)) || (b.revenue - a.revenue); });
  return { people: act, team: { soNguoi: act.length, totalRevenue: Math.round(totRev), totalOrders: totOrders, totalFailed: totFailed, tyLeThatBai: Math.round(teamFail * 1000) / 10, tyLeChotGiuaTeam: Math.round(medClose * 10) / 10,
    tot: act.filter(function(p) { return p.rating === 'tot'; }).length, trungbinh: act.filter(function(p) { return p.rating === 'trungbinh'; }).length,
    kem: act.filter(function(p) { return p.rating === 'kem'; }).length, chuadu: act.filter(function(p) { return p.rating === 'chuadu'; }).length } };
}
// Goi AI da nha cung cap, tra ve chuoi JSON (parse tai _taParseJson_). Gioi han token cao hon callAI_ (400) vi bang nhieu nguoi.
function _taCallAI_(sys, userMsg) {
  var providers = [
    { name: 'Groq',       key: getSetting_('apiGroq') || getSetting_('geminiKey'), fn: _aiOpenAICompat_, url: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b' },
    { name: 'Cerebras',   key: getSetting_('apiCerebras'),                         fn: _aiOpenAICompat_, url: 'https://api.cerebras.ai/v1/chat/completions',    model: 'gpt-oss-120b' },
    { name: 'Gemini',     key: getSetting_('apiGemini'),                           fn: _aiGemini_,       model: 'gemini-flash-latest' }
  ];
  var errors = [], any = false;
  for (var i = 0; i < providers.length; i++) {
    var pv = providers[i]; if (!pv.key) continue; any = true;
    pv.maxTokens = 6000; pv.temperature = 0.3;
    var r = pv.fn(pv, sys, userMsg);
    if (r.ok && r.text) return { ok: true, text: r.text, provider: pv.name };
    errors.push(pv.name + ': ' + (r.error || 'tra loi rong'));
  }
  return { ok: false, error: any ? errors.join(' | ') : 'Chưa cấu hình key AI (Settings: apiGroq / apiCerebras / apiGemini).' };
}
function _taParseJson_(t) {
  var s = String(t || '').replace(/```json|```/gi, '').trim();
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.substring(a, b + 1)); } catch (e) { return null; }
}
function teamAnalysis_(p) {
  var today = _vnYmd_(new Date());
  var from = p.from || p.dateFrom || (today.substring(0, 8) + '01'), to = p.to || p.dateTo || today;
  if (from > to) return jsonOut_({ ok: false, error: 'Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ').' });
  var wantAI = p.ai !== '0', cacheKey = 'teamAI_v1_' + from + '_' + to, cache = CacheService.getScriptCache();
  if (wantAI && p.refresh !== '1') {
    var hit = cache.get(cacheKey);
    if (hit) { try { var o = JSON.parse(hit); o.cached = true; return jsonOut_(o); } catch (eh) {} }
  }
  var m = buildTeamMetrics_(from, to), sc = scoreTeam_(m.list);
  var out = { ok: true, from: from, to: to, generatedAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'), team: sc.team, people: sc.people,
    overview: '', highlights: [], risks: [], aiProvider: '', aiError: '', warnings: m.warnings,
    note: 'Điểm = trung bình có trọng số: %KPI (45) + doanh thu so với team (20) + tỷ lệ chốt so với mức giữa team (20) + chất lượng đơn (15; tỷ lệ thất bại = đơn thất bại ÷ (đơn + đơn thất bại)). Thành phần thiếu số liệu thì bỏ qua, không trừ điểm. Từ 70 là "Làm tốt", 45–69 "Trung bình", dưới 45 "Cần cải thiện".' };
  if (!sc.people.length) { out.overview = 'Không có số liệu của nhân viên nào trong khoảng ngày này.'; return jsonOut_(out); }
  if (wantAI) {
    var slim = sc.people.slice(0, 40).map(function(x) { return { ten: x.name, nhom: x.nhom, doanhThu: Math.round(x.revenue), soDon: x.orders, kpiPct: x.pct, tyLeChotPct: x.tyLeChot, soTinNhan: x.tongTT,
      donThatBai: x.failedOrders, khThemMoi: x.careLeads, diem: x.score, xepLoai: x.rating, diemManh: x.strengths, diemYeu: x.issues }; });
    var sys = 'Bạn là chuyên viên phân tích vận hành bán hàng cho một doanh nghiệp bán trang sức phong thủy. Trả lời bằng TIẾNG VIỆT, chỉ dùng số liệu được cung cấp, không bịa số, không đổi xếp loại đã tính. ' +
      'Giọng điệu thẳng thắn nhưng công bằng, nêu việc cụ thể cần làm. Chỉ trả về MỘT đối tượng JSON, không kèm văn bản hay markdown khác.';
    var user = 'Kỳ phân tích: ' + from + ' → ' + to + '. Tổng quan team: ' + JSON.stringify(sc.team) + '.\nDữ liệu từng người (xepLoai: tot=làm tốt, trungbinh, kem=cần cải thiện, chuadu=chưa đủ dữ liệu):\n' + JSON.stringify(slim) +
      '\nTrả về JSON đúng dạng: {"overview":"3-5 câu tổng quan hiệu quả team","highlights":["2-4 điểm tốt của team"],"risks":["2-4 rủi ro/điểm cần xử lý"],"people":[{"name":"đúng tên như dữ liệu","comment":"1-2 câu nhận xét vì sao làm tốt/chưa tốt","action":"1 việc cụ thể nên làm tiếp"}]}';
    var ai = _taCallAI_(sys, user);
    if (ai.ok) {
      var j = _taParseJson_(ai.text);
      if (j) {
        out.overview = String(j.overview || ''); out.highlights = Array.isArray(j.highlights) ? j.highlights.slice(0, 6).map(String) : []; out.risks = Array.isArray(j.risks) ? j.risks.slice(0, 6).map(String) : [];
        var byName = {}; (Array.isArray(j.people) ? j.people : []).forEach(function(x) { if (x && x.name) byName[_normTxt_(x.name)] = x; });
        out.people.forEach(function(x) { var a = byName[_normTxt_(x.name)]; if (a) { if (a.comment) x.comment = String(a.comment); x.action = a.action ? String(a.action) : ''; } });
        out.aiProvider = ai.provider;
        try { cache.put(cacheKey, JSON.stringify(out), 600); } catch (ec) {}
      } else { out.aiError = 'AI trả về không đúng định dạng JSON — đang hiển thị nhận xét theo quy tắc.'; }
    } else { out.aiError = ai.error; }
  }
  if (!out.overview) {
    var t = sc.team;
    out.overview = 'Kỳ ' + from + ' → ' + to + ': ' + t.soNguoi + ' nhân viên có số liệu, ' + t.tot + ' làm tốt, ' + t.trungbinh + ' trung bình, ' + t.kem + ' cần cải thiện, ' + t.chuadu + ' chưa đủ dữ liệu. (Nhận xét tự động theo quy tắc, chưa có phần AI viết.)';
  }
  return jsonOut_(out);
}

// ═══════════════════════════════════════════════════════════════
//  TONG QUAN TO CHUC (v13.24) — action GET orgOverview
//  Man hinh dau tien cua CRM + ho so nhan su: tong hop theo CONG TY -> PHONG -> TEAM -> NHAN VIEN.
//  - Phong = nhom Sale da phan loai o "Phan loai doi Sale" (saleChannels/saleGroups: Online, Van phong, ...), CHUA phan loai = "(chua phan phong)".
//  - Team = sheet Teams (leader + members). 1 nguoi o nhieu team thi tinh vao CA 2 team (tong team co the lech tong phong/cong ty).
//  - Moi nguoi: doanh thu, so don, don/ngay, don trung binh, %KPI, ty le chot, don that bai, diem + xep loai (dung scoreTeam_), don theo ngay.
//  Phan quyen XEM (admin: tat ca; quan ly: phong cua minh; leader: team cua minh; nhan vien: chinh minh) do CLIENT loc (giong cac bao cao khac).
// ═══════════════════════════════════════════════════════════════
function _orgAgg_(plist, days) {
  var a = { soNguoi: plist.length, revenue: 0, orders: 0, failed: 0, careLeads: 0, target: 0, revTarget: 0, tongTT: 0, closeW: 0, tot: 0, trungbinh: 0, kem: 0, chuadu: 0, scoreSum: 0, scoreN: 0 };
  plist.forEach(function(p) {
    a.revenue += p.revenue; a.orders += p.orders; a.failed += p.failedOrders; a.careLeads += p.careLeads;
    if (p.target > 0) { a.target += p.target; a.revTarget += p.revenue; }
    a.tongTT += p.tongTT; if (p.tyLeChot !== null && p.tyLeChot !== undefined) a.closeW += p.tyLeChot * p.tongTT;
    a[p.rating] = (a[p.rating] || 0) + 1;
    if (p.score !== null && p.score !== undefined) { a.scoreSum += p.score; a.scoreN++; }
  });
  return { soNguoi: a.soNguoi, revenue: Math.round(a.revenue), orders: a.orders,
    aov: a.orders ? Math.round(a.revenue / a.orders) : 0,
    ordersPerDay: Math.round(a.orders / days * 10) / 10,
    pct: a.target > 0 ? Math.round(a.revTarget / a.target * 1000) / 10 : null,
    tyLeChot: a.tongTT ? Math.round(a.closeW / a.tongTT * 10) / 10 : null,
    failed: a.failed, careLeads: a.careLeads,
    failRate: (a.orders + a.failed) ? Math.round(a.failed / (a.orders + a.failed) * 1000) / 10 : 0,
    tot: a.tot, trungbinh: a.trungbinh, kem: a.kem, chuadu: a.chuadu, avgScore: a.scoreN ? Math.round(a.scoreSum / a.scoreN) : null };
}
// ── PHONG BAN (yeu cau Duyen 2026-10-11): TACH RIENG khoi 'doi' Online/Van phong/Thu viec (SALE_GROUPS) de gan phong KHONG anh huong
//    doi tuong Chuong trinh thuong. Luu o Settings: deptList = [{key,label}], saleDepts = {tenNguoi: keyPhong}.
var DEPT_LIST_DEFAULT_ = [
  { key: 'marketing', label: 'Marketing' }, { key: 'sale', label: 'Sale' }, { key: 'cuahang', label: 'Cửa hàng' },
  { key: 'sanxuat', label: 'Sản xuất' }, { key: 'thanhpham', label: 'Thành phẩm' }, { key: 'nguon', label: 'Nguồn' },
  { key: 'ketoan', label: 'Kế toán' }, { key: 'hr', label: 'HR' }, { key: 'media', label: 'Media' }
];
function readDeptList_() {
  try {
    var raw = getSetting_('deptList');
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr.filter(function(g) { return g && g.key; }).map(function(g) { return { key: String(g.key), label: String(g.label || g.key) }; });
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEPT_LIST_DEFAULT_));
}
// raw: {ten: key} dung nguyen de tra client; byNorm: {tenChuanHoa: {name,key}} de khop ten khong phan biet hoa/thuong/dau
function readSaleDepts_() {
  var out = { raw: {}, byNorm: {} };
  try {
    var raw = getSetting_('saleDepts');
    if (raw) {
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') Object.keys(o).forEach(function(n) {
        var k = _normTxt_(n);
        if (k && o[n]) { out.raw[n] = String(o[n]); out.byNorm[k] = { name: String(n).trim(), key: String(o[n]) }; }
      });
    }
  } catch (e) {}
  return out;
}
// Gan phong cho tung nguoi theo saleDepts (nguoi nao chua gan = '(chua phan phong)'); nguoi CHI co trong saleDepts (ke toan, HR...)
// ma chua co so lieu thi them vao danh sach voi so lieu 0 de dem dau nguoi cua phong.
function _orgApplyDepts_(people, byKey, sd, deptList, UNK) {
  var lbl = {}; deptList.forEach(function(g) { lbl[g.key] = g.label; });
  var pkeyOD = _salePersonKeyFn_(), byPk = {};   // cau hinh phong luu theo TEN Sale; doi sang khoa danh tinh de ten khac cua cung nguoi cung ra phong do
  Object.keys(sd.byNorm).forEach(function(k0) { var pk0 = pkeyOD(k0); if (!byPk[pk0]) byPk[pk0] = sd.byNorm[k0]; });
  Object.keys(byPk).forEach(function(k) {
    if (byKey[k]) return;
    byKey[k] = { name: byPk[k].name, nhom: '', tier: '', deptKey: '', dept: '', revenue: 0, orders: 0, target: 0, pct: null, tongTT: 0, sdtMangVe: 0, tyLeChot: null, failedOrders: 0, careLeads: 0, score: null, rating: 'chuadu', strengths: [], issues: [], comment: 'Chưa có số liệu trong kỳ này.' };
    people.push(byKey[k]);
  });
  people.forEach(function(x) {
    var dm = byPk[pkeyOD(x.name)];
    if (dm && lbl[dm.key]) { x.deptKey = dm.key; x.dept = lbl[dm.key]; } else { x.deptKey = ''; x.dept = UNK; }
  });
}
// ── PHAN BO PHONG BAN THEO FILE NHAN SU (Duyen yeu cau 2026-10-21) ──
// Nguon: FILE_NHAN_SU_TONG_HOP.xlsx (cot BO PHAN + TEN NHAN VIEN; KHONG luu CCCD/ngay sinh/SDT/dia chi). Ghi 2 Settings: deptList (them phong con thieu) + saleDepts (ten -> key phong).
// CHAY TAY 1 LAN trong Apps Script Editor: datPhongBanTuFileNhanSu() = XEM TRUOC (chi ghi Logger, khong ghi gi); datPhongBanTuFileNhanSu(true) = GHI THAT.
// GOP, khong de: giu moi phong/nguoi dang co ngoai file; nguoi da co (khop ten khong phan biet hoa/thuong) thi doi sang phong theo file, khong tao khoa trung.
// Ten xuat hien o 2 bo phan khac nhau trong file (cung ten 2 nguoi) -> BO QUA va bao trong Logger de gan tay o Settings > Phong ban.
var PHONGBAN_NHANSU_NEW_ = [
  { key: 'banlanhdao', label: 'Ban lãnh đạo' }, { key: 'cskh', label: 'CSKH' }, { key: 'khobaohanh', label: 'Kho bảo hành' },
  { key: 'khoncc', label: 'Kho NCC + SX' }, { key: 'khonhacungcap', label: 'Kho nhà cung cấp' }
];
var PHONGBAN_NHANSU_ = [
  ['Lại Thị Thảo', 'banlanhdao'],
  ['Nguyễn Thị Diệu My', 'hr'],
  ['Nguyễn Thị Mậu', 'hr'],
  ['Lê Xuân Cảnh', 'hr'],
  ['Nguyễn Thị Thúy Hoàn', 'cuahang'],
  ['Lê Trà My', 'cuahang'],
  ['Nguyễn Thùy Trang', 'cuahang'],
  ['Nguyễn Lan Hương', 'cuahang'],
  ['Trần Tú Anh', 'cuahang'],
  ['Hà Thị Kim Thúy', 'cuahang'],
  ['Dương Thị Thanh Tâm', 'nguon'],
  ['Nguyễn Thanh Hồng', 'nguon'],
  ['Hoàng Ngọc Tuấn Tú', 'khobaohanh'],
  ['Vương Minh Anh', 'khobaohanh'],
  ['Võ Hoàng Lan', 'khobaohanh'],
  ['Nguyễn Thị Xoan', 'thanhpham'],
  ['Nguyễn Thị Hồng Vân', 'thanhpham'],
  ['Nghiêm Thị Thu Hằng', 'thanhpham'],
  ['Nguyễn Thu Huyền', 'thanhpham'],
  ['Trần Thị Thơm', 'thanhpham'],
  ['Lê Thị Thanh Hoa', 'thanhpham'],
  ['Vương Thị Trang', 'thanhpham'],
  ['Nguyễn Thị Kim Thu', 'khoncc'],
  ['Phạm Thu Hà', 'sanxuat'],
  ['Nguyễn Thị Lan', 'sanxuat'],
  ['Nguyễn Thu Thủy', 'sanxuat'],
  ['Nguyễn Thị Nhung', 'sanxuat'],
  ['Ngô Trung Thành', 'khonhacungcap'],
  ['Lê Hồng Vân', 'khonhacungcap'],
  ['Ngô Duy Nguyện', 'khonhacungcap'],
  ['Nguyễn Khánh Ly', 'ketoan'],
  ['Nguyễn Thu Huyền', 'ketoan'],
  ['Vương Thúy Anh', 'ketoan'],
  ['Phạm Thị Oanh', 'ketoan'],
  ['Đào Thị Hồng Hạnh', 'ketoan'],
  ['Kiều Mai Thanh Thùy', 'ketoan'],
  ['Âu Thị Hải Yến', 'ketoan'],
  ['Phạm Thị Hồng', 'ketoan'],
  ['Trịnh Tuấn Anh', 'ketoan'],
  ['Nguyễn Lâm Yến Nhi', 'ketoan'],
  ['Nguyễn Thế Anh', 'ketoan'],
  ['Trần Văn Trường', 'media'],
  ['Trần Anh Tuấn', 'media'],
  ['Trần Huy Hoàng', 'media'],
  ['Nguyễn Thúy Quỳnh', 'cskh'],
  ['Bùi Đoàn Thùy Mến', 'cskh'],
  ['Vũ Thị Thu Trang', 'cskh'],
  ['Trịnh Hằng Nga', 'cskh'],
  ['Nguyễn Mỹ Linh', 'cskh'],
  ['Ngô Việt Huy', 'marketing'],
  ['Nguyễn Văn Hưng', 'marketing'],
  ['Hoàng Thị Duyên', 'sale'],
  ['Trịnh Phương Anh', 'sale'],
  ['Nguyễn Thị Hải Yến', 'sale'],
  ['Nguyễn Phương Anh', 'sale'],
  ['Nguyễn Huyền Trang', 'sale'],
  ['Lê Kiều Ninh', 'sale'],
  ['Phan Thị Ngọc Hà', 'sale'],
  ['Nguyễn Phương Thanh', 'sale'],
  ['NguyễN Bích Ngọc', 'sale'],
  ['Đinh Thị Thu Thủy', 'sale'],
  ['Ninh Thị Ngà', 'sale'],
  ['Nguyễn Thị Phương Thảo', 'sale'],
  ['Mai Thi Thu Huyền', 'sale'],
  ['Nguyễn Thị Bích', 'sale'],
  ['Nguyễn Thị Thùy Dung', 'sale'],
  ['Tạ Thúy Hà', 'sale'],
  ['Quách Thị Minh', 'sale'],
  ['Phạm Thị Hoàng Tươi', 'sale'],
  ['Nguyễn Thị Tuyết Mai', 'sale']
];
function _phongBanNhanSuPlan_(deptListCur, saleDeptsCur) {
  var list = (deptListCur || []).map(function (g) { return { key: g.key, label: g.label }; });
  var haveKey = {}; list.forEach(function (g) { haveKey[g.key] = 1; });
  var addDepts = [];
  // Them MOI phong ma file dung ma deptList dang chay chua co (ke ca phong mac dinh da bi xoa/sua tren CRM) — thieu key thi nguoi duoc gan se hien '(chua phan phong)'.
  var used = {}; PHONGBAN_NHANSU_.forEach(function (r) { used[r[1]] = 1; });
  DEPT_LIST_DEFAULT_.concat(PHONGBAN_NHANSU_NEW_).forEach(function (g) { if (used[g.key] && !haveKey[g.key]) { haveKey[g.key] = 1; list.push({ key: g.key, label: g.label }); addDepts.push(g.key); } });
  var cnt = {}; PHONGBAN_NHANSU_.forEach(function (r) { var k = _normTxt_(r[0]); cnt[k] = (cnt[k] || {}); cnt[k][r[1]] = 1; });
  var map = {}; Object.keys(saleDeptsCur || {}).forEach(function (n) { map[n] = saleDeptsCur[n]; });
  var byNorm = {}; Object.keys(map).forEach(function (n) { byNorm[_normTxt_(n)] = n; });
  var added = [], changed = [], same = [], skipped = [];
  PHONGBAN_NHANSU_.forEach(function (r) {
    var k = _normTxt_(r[0]);
    if (Object.keys(cnt[k]).length > 1) { if (skipped.indexOf(r[0]) < 0) skipped.push(r[0]); return; }
    var exist = byNorm[k];
    if (exist === undefined) { map[r[0]] = r[1]; byNorm[k] = r[0]; added.push(r[0] + ' -> ' + r[1]); }
    else if (map[exist] !== r[1]) { changed.push(exist + ': ' + map[exist] + ' -> ' + r[1]); map[exist] = r[1]; }
    else same.push(exist);
  });
  return { deptList: list, saleDepts: map, addDepts: addDepts, added: added, changed: changed, same: same, skipped: skipped };
}
function datPhongBanTuFileNhanSu(apply) {
  var cur = {}; try { cur = JSON.parse(getSetting_('saleDepts') || '{}') || {}; } catch (e) { cur = {}; }
  var plan = _phongBanNhanSuPlan_(readDeptList_(), cur);
  Logger.log('Phong moi them vao danh sach: ' + (plan.addDepts.join(', ') || '(khong)'));
  Logger.log('Nguoi THEM MOI (' + plan.added.length + '): ' + plan.added.join(' | '));
  Logger.log('Nguoi DOI PHONG (' + plan.changed.length + '): ' + (plan.changed.join(' | ') || '(khong)'));
  Logger.log('Nguoi da dung phong (' + plan.same.length + ') — giu nguyen');
  Logger.log('BO QUA vi trung ten o nhieu bo phan (' + plan.skipped.length + '): ' + (plan.skipped.join(', ') || '(khong)') + ' — gan tay o Settings > Phong ban');
  if (apply !== true) { Logger.log('=> XEM TRUOC, chua ghi gi. Chay datPhongBanTuFileNhanSu(true) de ghi that.'); return plan; }
  setSetting_('deptList', JSON.stringify(plan.deptList));
  setSetting_('saleDepts', JSON.stringify(plan.saleDepts));
  try { CacheService.getScriptCache().remove('orgOv_v2_'); } catch (e2) {}
  Logger.log('=> DA GHI deptList + saleDepts. Vao CRM Ctrl+F5 > Settings > Phong ban de kiem tra (hoac bam Lam moi o Tong quan).');
  return plan;
}

function orgOverview_(p) {
  var today = _vnYmd_(new Date());
  var from = p.from || p.dateFrom || (today.substring(0, 8) + '01'), to = p.to || p.dateTo || today;
  if (from > to) return jsonOut_({ ok: false, error: 'Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ').' });
  var cacheKey = 'orgOv_v2_' + from + '_' + to;
  if (p.refresh !== '1') {
    var hit = _cacheGetBig_(cacheKey);
    if (hit) { try { var o = JSON.parse(hit); o.cached = true; return jsonOut_(o); } catch (eh) {} }
  }
  var pkeyOrg = _salePersonKeyFn_(); function nkOrg(n) { return pkeyOrg(n); }   // KHOP SALE: ten khac nhau cua cung 1 nguoi (KPI, Pancake, Teams, ngay) -> 1 nguoi
  var effTo = to > today ? today : to;
  var days = Math.max(1, Math.round((Date.parse(effTo + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1);
  // Chi so Pos (don huy/hoan + don theo ngay tung nguoi) lay qua posMetrics_ DUNG CHUNG (P0d) — 1 lan doc Pos thay vi tu goi B/G rieng. Doanh thu/so don/KPI van tu KPI Sale (Base), KHONG doi.
  var dailySkipped = days > 93, daily = {}, posWarn = [];
  var pos = null;
  try { pos = posMetrics_({ from: from, to: to, parts: dailySkipped ? ['failed'] : ['revenue', 'failed'], withDaily: !dailySkipped }); } catch (eP) { posWarn.push('Không đọc được chỉ số Pos: ' + eP.message); }
  if (pos) posWarn = posWarn.concat(pos.warnings || []);
  var m = buildTeamMetrics_(from, to, pos && pos.ok ? pos : null), sc = scoreTeam_(m.list), warnings = m.warnings.concat(posWarn);
  var people = sc.people, byKey = {};
  people.forEach(function(x) { byKey[nkOrg(x.name)] = x; });
  // Don theo ngay tung nguoi (chi khi ky <= 93 ngay de payload gon)
  if (!dailySkipped) {
    if (pos && pos.bySaleDay) Object.keys(pos.bySaleDay).forEach(function(nm) { daily[nkOrg(nm)] = pos.bySaleDay[nm]; });
    else { warnings.push('Không đọc được đơn theo ngày.'); dailySkipped = true; }
  }
  // Team + thanh vien (ke ca nguoi chua co so lieu -> hien o "Chua du du lieu" de quan ly thay)
  var teams = [];
  try { teams = readTeams_(getCrmSS_().getSheetByName(SH_TEAM)); } catch (eT) { warnings.push('Không đọc được danh sách team: ' + eT.message); }
  var teamsOf = {}, leaderOf = {};
  teams.forEach(function(t) {
    var names = [], seen = {};
    function add(n) { var k = nkOrg(n); if (!k || seen[k]) return; seen[k] = true; names.push(String(n).trim());
      if (!byKey[k]) { byKey[k] = { name: String(n).trim(), nhom: '', tier: '', deptKey: '', dept: '', revenue: 0, orders: 0, target: 0, pct: null, tongTT: 0, sdtMangVe: 0, tyLeChot: null, failedOrders: 0, careLeads: 0, score: null, rating: 'chuadu', strengths: [], issues: [], comment: 'Chưa có số liệu trong kỳ này.' }; people.push(byKey[k]); }
      (teamsOf[k] = teamsOf[k] || []).push(t.name); }
    add(t.leader); (t.members || []).forEach(add);
    t._names = names;
    if (nkOrg(t.leader)) (leaderOf[nkOrg(t.leader)] = leaderOf[nkOrg(t.leader)] || []).push(t.name);
  });
  var UNK = '(chưa phân phòng)';
  var deptList = readDeptList_(), saleDeptsCfg = readSaleDepts_();
  _orgApplyDepts_(people, byKey, saleDeptsCfg, deptList, UNK);   // phong = cai dat rieng (deptList/saleDepts), KHONG dung doi Online/Offline
  people.forEach(function(x) {
    var k = nkOrg(x.name);
    x.ordersPerDay = Math.round(x.orders / days * 10) / 10;
    x.aov = x.orders ? Math.round(x.revenue / x.orders) : 0;
    x.teams = teamsOf[k] || []; x.leaderOf = leaderOf[k] || []; x.isLeader = x.leaderOf.length > 0;
    var ls = {}; teams.forEach(function(t) { if ((teamsOf[k] || []).indexOf(t.name) !== -1 && t.leader && nkOrg(t.leader) !== k) ls[String(t.leader).trim()] = true; });
    x.leaders = Object.keys(ls);
    var d = daily[k] || {}, ds = Object.keys(d).sort();
    x.activeDays = ds.length;
    x.ordersPerActiveDay = ds.length ? Math.round(x.orders / ds.length * 10) / 10 : 0;
    x.daily = dailySkipped ? null : ds.map(function(dd) { return [dd, d[dd][0], Math.round(d[dd][1])]; });
  });
  var teamOut = teams.map(function(t) {
    var pl = t._names.map(function(n) { return byKey[nkOrg(n)]; }).filter(Boolean), cnt = {};
    pl.forEach(function(x) { if (x.deptKey) { cnt[x.deptKey] = cnt[x.deptKey] || { n: 0, rev: 0, label: x.dept }; cnt[x.deptKey].n++; cnt[x.deptKey].rev += x.revenue; } });
    var best = Object.keys(cnt).sort(function(a, b) { return (cnt[b].n - cnt[a].n) || (cnt[b].rev - cnt[a].rev); })[0];
    var o = _orgAgg_(pl, days);
    o.id = t.id; o.name = t.name; o.color = t.color || ''; o.leader = t.leader || ''; o.members = t._names; o.deptKey = best || ''; o.dept = best ? cnt[best].label : UNK;
    return o;
  });
  var dmap = {};
  people.forEach(function(x) { var k = x.deptKey || '_none'; (dmap[k] = dmap[k] || { key: x.deptKey || '', label: x.dept, list: [] }).list.push(x); });
  deptList.forEach(function(g) { if (!dmap[g.key]) dmap[g.key] = { key: g.key, label: g.label, list: [] }; });   // hien du cac phong ke ca phong chua co ai
  var deptOut = Object.keys(dmap).map(function(k) {
    var g = dmap[k], o = _orgAgg_(g.list, days);
    o.key = g.key; o.label = g.label;
    o.teams = teamOut.filter(function(t) { return t.deptKey === g.key; }).map(function(t) { return t.name; });
    var ls = {}; teamOut.forEach(function(t) { if (t.deptKey === g.key && t.leader) ls[t.leader] = true; }); o.leaders = Object.keys(ls);
    return o;
  }).sort(function(a, b) { return b.revenue - a.revenue; });
  teamOut.sort(function(a, b) { return b.revenue - a.revenue; });
  var order = { tot: 0, trungbinh: 1, kem: 2, chuadu: 3 };
  people.sort(function(a, b) { return (order[a.rating] - order[b.rating]) || ((b.score || 0) - (a.score || 0)) || (b.revenue - a.revenue); });
  var out = { ok: true, from: from, to: to, days: days, generatedAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'),
    company: _orgAgg_(people, days), depts: deptOut, teams: teamOut, people: people, deptList: deptList, saleDepts: saleDeptsCfg.raw, dailySkipped: dailySkipped, warnings: warnings,
    note: 'Phòng = cài đặt riêng ở nút “Cài đặt phòng” (không liên quan Online/Văn phòng/Thử việc và không ảnh hưởng thưởng). Một người thuộc nhiều team thì được tính ở cả các team đó (tổng các team có thể lớn hơn tổng phòng/công ty). Đơn/ngày = số đơn ÷ số ngày trong kỳ (tính đến hôm nay). Điểm & xếp loại: xem quy tắc ở "AI phân tích team".' };
  try { _cachePutBig_(cacheKey, JSON.stringify(out), 300); } catch (ec) {}
  return jsonOut_(out);
}

// ═══════════════════════════════════════════════════════════════
//  KIEN THUC TU THU MUC DRIVE (PDF / Google Doc / Google Sheet)
// ═══════════════════════════════════════════════════════════════
// Cau hinh: setSetting_('driveKnowledgeFolderUrl', <link thu muc Drive>) — thu muc phai
// duoc chia se cho tai khoan chay Apps Script nay (hoac "Bat ky ai co lien ket" > Xem).
// File anh trong thu muc bi bo qua o day (chi dung cho "kien thuc" van ban) — gui anh cho
// khach la tinh nang rieng, xem findDriveProductImage_() + _driveImageBase64_() ben duoi
// (da lam, dung chung thu muc nay lam nguon fallback anh khi chua co productSheetUrl/anh rieng).
//
// Cach hoat dong (giong het trieet ly readExternalProductSheet_ o tren — KHONG nhet ca
// thu muc vao 1 prompt vi qua nang/cham/ton phi AI):
//   1) Danh muc luc NHE cho tung file (ten file + tung "doan" van ban ~900 ky tu, kem
//      snippet 300 ky tu de tim kiem) — cache rieng tung file 15 phut.
//   2) Khi co cau hoi, tim cac doan co TU KHOA khop cau hoi khach, xep hang theo so tu khop.
//   3) CHI luc do moi lay lai NGUYEN VAN toi da 4 doan diem cao nhat de dua vao prompt.
//
// PDF: Apps Script co ban KHONG doc duoc chu trong PDF. Ham _extractPdfText_ thu OCR qua
// Drive Advanced Service (Drive.Files.copy voi ocr:true) — CAN BAT truoc trong Apps Script:
// Extensions > Apps Script > Services (dau +) > chon "Drive API" > Add. Neu chua bat, file
// PDF se tu dong bi bo qua (khong loi, khong chan cac file Doc/Sheet khac trong thu muc).
// Cach thay the KHONG can bat gi ca: trong Drive, chuot phai file PDF > Mo bang > Google
// Tai lieu — Drive tu OCR va tao ra 1 Google Doc cung thu muc, ham nay doc duoc Doc do binh
// thuong (khong can Advanced Service).

function _driveFolderIdFromUrl_(url) {
  if (!url) return '';
  var s = String(url).trim();
  var m = s.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s; // CS dan thang ID thay vi URL day du
  return '';
}

// Chia van ban dai thanh cac doan ~chunkLen ky tu, cat theo ranh gioi doan van (xuong dong)
// de khong cat ngang giua cau — dung cho Doc/PDF (khong co cau truc hang/cot nhu Sheet).
function _chunkText_(text, chunkLen) {
  var out = [];
  var paras = String(text || '').split(/\n{1,}/).map(function(p) { return p.trim(); }).filter(Boolean);
  var buf = '';
  for (var i = 0; i < paras.length; i++) {
    if (buf && (buf + '\n' + paras[i]).length > chunkLen) { out.push(buf); buf = paras[i]; }
    else buf = buf ? (buf + '\n' + paras[i]) : paras[i];
  }
  if (buf) out.push(buf);
  return out;
}

function _driveKnowFullTextCacheKey_(fileId) { return 'dkf_full_v1_' + fileId; }

// Cache tam noi dung day du cua 1 file (Doc/PDF) sau khi da doc/OCR 1 lan, de lan sau tra
// lai dung doan (chunk) khop khong phai doc/OCR lai (OCR PDF kha cham va ton quota).
function _cacheDriveKnowFullText_(fileId, text) {
  try {
    if (text && text.length <= 95000) CacheService.getScriptCache().put(_driveKnowFullTextCacheKey_(fileId), text, 900);
  } catch (e) {}
}

// PDF khong co API doc van ban truc tiep trong Apps Script co ban — thu OCR bang Drive
// Advanced Service. Neu chua bat service nay, ham nay se loi va tra ve '' (file bi bo qua,
// khong chan cac file khac).
function _extractPdfText_(fileId) {
  try {
    var tmp = Drive.Files.copy({ title: 'tmp_ocr_' + fileId }, fileId, { ocr: true, ocrLanguage: 'vi' });
    var text = DocumentApp.openById(tmp.id).getBody().getText();
    try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (ecTrash) {} // dep file OCR tam
    return text || '';
  } catch (e) { return ''; }
}

// Lay dung 1 doan (chunk) da tung duoc index cho 1 file Doc/PDF — uu tien doc tu cache
// full-text, chi doc/OCR lai truc tiep khi cache da het han (hiem, vi cung TTL voi muc luc).
function _driveKnowChunkText_(fileId, kind, chunkIdx, fallbackSnippet) {
  try {
    var full = CacheService.getScriptCache().get(_driveKnowFullTextCacheKey_(fileId));
    if (full !== null) {
      var chunks = _chunkText_(full, 900);
      if (chunks[chunkIdx]) return chunks[chunkIdx];
    }
  } catch (e) {}
  try {
    if (kind === 'doc') {
      var t = DocumentApp.openById(fileId).getBody().getText();
      var cs = _chunkText_(t, 900);
      return cs[chunkIdx] || fallbackSnippet;
    }
    if (kind === 'pdf') {
      var t2 = _extractPdfText_(fileId);
      var cs2 = _chunkText_(t2, 900);
      return cs2[chunkIdx] || fallbackSnippet;
    }
  } catch (e2) {}
  return fallbackSnippet;
}

// Muc luc 1 file trong thu muc kien thuc Drive (cache rieng tung file, 15 phut).
function _driveKnowledgeFileIndex_(file) {
  var fileId = file.getId();
  var idxKey = 'dkf_idx_v1_' + fileId;
  try {
    var cached = CacheService.getScriptCache().get(idxKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}

  var mime = file.getMimeType();
  var name = file.getName();
  var items = []; // {kind, name, tab?, row?, chunkIdx?, snippet}

  try {
    if (mime === MimeType.GOOGLE_DOCS) {
      var text = DocumentApp.openById(fileId).getBody().getText();
      _cacheDriveKnowFullText_(fileId, text);
      var chunks = _chunkText_(text, 900);
      for (var i = 0; i < chunks.length; i++) {
        items.push({ kind: 'doc', name: name, chunkIdx: i, snippet: chunks[i].substring(0, 300) });
      }
    } else if (mime === MimeType.GOOGLE_SHEETS) {
      var ss2 = SpreadsheetApp.openById(fileId);
      var tabs = ss2.getSheets();
      for (var t = 0; t < tabs.length; t++) {
        var tabName = tabs[t].getName();
        var idx = _productSheetIndexForTab_(ss2, tabName);
        for (var r = 0; r < idx.length; r++) {
          items.push({ kind: 'sheet', name: name, tab: tabName, row: idx[r].row, snippet: idx[r].name + ' ' + idx[r].snippet });
        }
      }
    } else if (mime === MimeType.PDF) {
      var pdfText = _extractPdfText_(fileId);
      if (pdfText) {
        _cacheDriveKnowFullText_(fileId, pdfText);
        var chunksP = _chunkText_(pdfText, 900);
        for (var p = 0; p < chunksP.length; p++) {
          items.push({ kind: 'pdf', name: name, chunkIdx: p, snippet: chunksP[p].substring(0, 300) });
        }
      }
    }
    // Anh (jpg/png...) va cac dinh dang khac: bo qua o day — dung cho "kien thuc" van ban.
  } catch (e) { /* file loi/khong doc duoc (chua chia se, dinh dang la...) -> bo qua file nay */ }

  try { CacheService.getScriptCache().put(idxKey, JSON.stringify(items), 900); } catch (ec2) {}
  return items;
}

// Doc toan bo thu muc kien thuc Drive (PDF/Doc/Sheet), khop tu khoa cau hoi khach, tra ve
// toi da 4 doan lien quan nhat de dua vao prompt AI.
function readDriveKnowledgeFolder_(query) {
  var url = getSetting_('driveKnowledgeFolderUrl') || DEFAULT_DRIVE_KNOWLEDGE_FOLDER_URL;
  var folderId = _driveFolderIdFromUrl_(url);
  if (!folderId) return '';

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var folder;
  try { folder = DriveApp.getFolderById(folderId); } catch (e) { return ''; } // chua chia se / ID sai

  var files = folder.getFiles();
  var candidates = [];
  var count = 0;
  while (files.hasNext() && count < 40) { // gioi han so file quet 1 lan, tranh cham qua
    var f = files.next(); count++;
    var items = _driveKnowledgeFileIndex_(f);
    for (var i = 0; i < items.length; i++) {
      var hay = _psheetNoAccent_(items[i].name + ' ' + items[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > 0) candidates.push({ fileId: f.getId(), item: items[i], score: score });
    }
  }
  if (!candidates.length) return '';
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 4);

  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    var c = top[k];
    var block = '';
    try {
      if (c.item.kind === 'sheet') {
        var ss3 = SpreadsheetApp.openById(c.fileId);
        var sh3 = ss3.getSheetByName(c.item.tab);
        var lastCol = sh3.getLastColumn();
        var headerVals = sh3.getRange(1, 1, 1, lastCol).getValues()[0];
        var rowVals = sh3.getRange(c.item.row, 1, 1, lastCol).getValues()[0];
        var parts = [];
        for (var cc = 0; cc < headerVals.length; cc++) {
          var h = String(headerVals[cc] || '').trim();
          var v = String(rowVals[cc] || '').trim();
          if (h && v && !/hinh|image|ảnh/i.test(h)) parts.push(h + ': ' + v);
        }
        block = '[' + c.item.name + ' — ' + c.item.tab + ']\n' + parts.join('\n');
      } else {
        var seg = _driveKnowChunkText_(c.fileId, c.item.kind, c.item.chunkIdx, c.item.snippet);
        block = '[' + c.item.name + ']\n' + seg;
      }
    } catch (e) { continue; }
    if (block.length > 1500) block = block.substring(0, 1500) + '...';
    blocks.push(block);
  }
  return blocks.join('\n\n---\n\n');
}

// ═══════════════════════════════════════════════════════════════
//  ANH SAN PHAM — doc tu thu muc RIENG driveProductImagesFolderUrl (khac voi
//  driveKnowledgeFolderUrl o tren) vi day thuong la thu muc CHUA CAC THU MUC
//  CON theo tung san pham, vd "Serum AHA 30ml/anh1.jpg". Neu chua cau hinh
//  thu muc rieng nay thi fallback dung tam driveKnowledgeFolderUrl.
//  Quet ca file anh nam THANG trong thu muc goc LAN anh nam trong 1 cap
//  thu muc con (khong quet sau hon 1 cap). So khop dung TEN THU MUC CON (neu
//  co) + TEN FILE voi tu khoa cau hoi khach — khong doc noi dung anh, nen dat
//  ten thu muc con / ten file ro rang (vd thu muc "Serum AHA 30ml") thi AI
//  moi tim dung.
// ═══════════════════════════════════════════════════════════════

// Muc luc NHE cac file anh trong thu muc + 1 cap thu muc con (cache rieng 15
// phut, tach voi muc luc van ban _driveKnowledgeFileIndex_ de khong dam cache).
function _driveImageIndex_(folderId) {
  var cacheKey = 'dkf_img_v2_' + folderId;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}

  var out = [];
  try {
    var folder = DriveApp.getFolderById(folderId);

    // 1) Anh nam thang trong thu muc goc (truong hop khong chia theo thu muc con)
    var files = folder.getFiles();
    var count = 0;
    while (files.hasNext() && count < 200) {
      var f = files.next(); count++;
      if (f.getMimeType().indexOf('image/') === 0) {
        out.push({ fileId: f.getId(), tag: f.getName(), name: f.getName() });
      }
    }

    // 2) 1 cap thu muc con — vd moi san pham 1 thu muc rieng chua nhieu anh.
    // Ten thu muc con duoc gop vao 'tag' de so khop (anh ben trong co the dat
    // ten chung chung nhu 1.jpg, IMG_001.jpg...); 'name' hien cho CS lay theo
    // TEN THU MUC (de doc/co nghia hon ten file), lay toi da 3 anh dai dien
    // moi thu muc con la du, khong can liet ke het.
    var subfolders = folder.getFolders();
    var fCount = 0;
    while (subfolders.hasNext() && fCount < 150) {
      var sf = subfolders.next(); fCount++;
      var sfFiles = sf.getFiles();
      var picked = 0;
      while (sfFiles.hasNext() && picked < 3) {
        var sf_f = sfFiles.next();
        if (sf_f.getMimeType().indexOf('image/') === 0) {
          out.push({ fileId: sf_f.getId(), tag: sf.getName() + ' ' + sf_f.getName(), name: sf.getName() });
          picked++;
        }
      }
    }
  } catch (e) { /* chua chia se / ID sai -> danh sach rong, khong chan cac tinh nang khac */ }

  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(out), 900); } catch (ec2) {}
  return out;
}

// Nhan 1 link Drive (FILE hoac FOLDER, nhieu dinh dang khac nhau tuy cach copy-share
// cua Drive) va tra ve 1 anh dai dien {fileId, name}. La FILE anh -> dung luon. La
// FOLDER -> lay anh dau tien tim thay ben trong. Tra ve null neu khong doc duoc/khong
// phai anh.
function _driveImageFromLink_(link) {
  var s = String(link || '').trim();
  if (!s) return null;

  var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  var fileId = m ? m[1] : null;
  if (fileId) {
    try {
      var f = DriveApp.getFileById(fileId);
      if (f.getMimeType().indexOf('image/') === 0) return { fileId: f.getId(), name: f.getName() };
    } catch (e) {}
  }

  var folderId = _driveFolderIdFromUrl_(s);
  if (folderId) {
    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      while (files.hasNext()) {
        var ff = files.next();
        if (ff.getMimeType().indexOf('image/') === 0) return { fileId: ff.getId(), name: ff.getName() };
      }
    } catch (e2) {}
    if (!fileId) { // la bare ID nhung khong phai folder -> co the la fileId, thu lai truoc khi bo cuoc
      try {
        var f2 = DriveApp.getFileById(folderId);
        if (f2.getMimeType().indexOf('image/') === 0) return { fileId: f2.getId(), name: f2.getName() };
      } catch (e3) {}
    }
  }
  return null;
}

// Tim anh gan DUNG voi dong san pham dang khop nhat trong Sheet ngoai
// (productSheetUrl) — chinh xac hon so ten thu muc vi bam theo DUNG dong/
// variant (vd dung Kieu/Size) dang tra loi khach. Doc lai cot co tieu de chua
// "hinh/image/ảnh" (dung chinh quy tac da dung de LOAI cot nay khoi prompt
// van ban o readExternalProductSheet_) — CS dan link Drive (file hoac folder)
// vao do la dung duoc ngay, khong can sua code khi dien them dong moi.
function findProductSheetImage_(query) {
  var url = getSetting_('productSheetUrl') || DEFAULT_PRODUCT_SHEET_URL;
  if (!url) return null;
  var ss;
  try { ss = SpreadsheetApp.openByUrl(url); } catch (e) { return null; }

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return null;

  var tabNames = ss.getSheets().map(function(s) { return s.getName(); });
  var bestTab = null, bestRow = 0, bestScore = 0;
  for (var t = 0; t < tabNames.length; t++) {
    var idx = _productSheetIndexForTab_(ss, tabNames[t]);
    for (var i = 0; i < idx.length; i++) {
      var hay = _psheetNoAccent_(idx[i].name + ' ' + idx[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > bestScore) { bestScore = score; bestTab = tabNames[t]; bestRow = idx[i].row; }
    }
  }
  if (!bestTab) return null;

  try {
    var sh = ss.getSheetByName(bestTab);
    var lastCol = sh.getLastColumn();
    var headerVals = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowVals = sh.getRange(bestRow, 1, 1, lastCol).getValues()[0];
    var imgCol = -1;
    for (var c = 0; c < headerVals.length; c++) {
      if (/hinh|image|ảnh/i.test(String(headerVals[c] || ''))) { imgCol = c; break; }
    }
    if (imgCol === -1) return null;
    return _driveImageFromLink_(rowVals[imgCol]);
  } catch (e2) { return null; }
}

// Tim 1 anh san pham phu hop voi cau hoi khach — 2 nguon, thu lan luot:
// 1) Link anh dien truc tiep trong dong Sheet san pham dang khop (chinh xac
//    nhat — xem findProductSheetImage_).
// 2) Fallback: thu muc anh rieng (driveProductImagesFolderUrl), so ten thu
//    muc con + ten file — dung cho san pham CHUA kip dien link vao Sheet.
// Tra ve {fileId, name} hoac null neu ca 2 nguon deu khong khop.
function findDriveProductImage_(query) {
  var fromSheet = findProductSheetImage_(query);
  if (fromSheet) return fromSheet;

  var url = getSetting_('driveProductImagesFolderUrl') || DEFAULT_DRIVE_PRODUCT_IMAGES_FOLDER_URL
    || getSetting_('driveKnowledgeFolderUrl') || DEFAULT_DRIVE_KNOWLEDGE_FOLDER_URL;
  var folderId = _driveFolderIdFromUrl_(url);
  if (!folderId) return null;

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return null;

  var images = _driveImageIndex_(folderId);
  if (!images.length) return null;

  var best = null, bestScore = 0;
  for (var i = 0; i < images.length; i++) {
    var hay = _psheetNoAccent_(images[i].tag);
    var score = 0;
    for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
    if (score > bestScore) { bestScore = score; best = images[i]; }
  }
  return best;
}

// Doc noi dung anh ra base64 de gui thang trong cung response voi cau tra loi AI —
// KHONG doi quyen chia se cua file, chi doc byte qua tai khoan dang chay Apps Script.
// Gioi han ~3MB de tranh payload qua nang lam cham/loi ca response; anh qua lon se
// tra ve null (van tra loi text binh thuong, chi thieu anh) thay vi lam hong tat ca.
var _DRIVE_IMG_MAX_BYTES_ = 3 * 1024 * 1024;
function _driveImageBase64_(fileId) {
  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    var bytes = blob.getBytes();
    if (bytes.length > _DRIVE_IMG_MAX_BYTES_) return null;
    return { base64: Utilities.base64Encode(bytes), mimeType: blob.getContentType() };
  } catch (e) { return null; }
}


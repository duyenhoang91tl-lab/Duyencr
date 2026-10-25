// ═══════════════════════════════════════════════════════
//  DON CHIA (yeu cau Duyen 2026-10): "don chia" = don Pos co >=2 sale CUNG CHIA (the sale co nhieu ten / ghep Base / file ke toan chia khong deu).
//  (1) GET splitOrderReport — BAO CAO M (man rieng trong Bao cao doanh so): tong don (thuc te), doanh thu, TB/don + so don chia, doanh thu tu don chia,
//      TB/don chia, theo TUNG sale. (2) GET splitOrderMine — "Danh sach don chia" (loc nguon du lieu o Danh sach KH): don ma NGUOI DANG NHAP duoc sale khac
//      chia + tong ket nhanh (so don chia, doanh thu tu don chia). Nguon so lieu = buildSalesReportB_ (CUNG bo loc/quy tac chia voi Bao cao B + posMetrics_),
//      nen khop so lieu bao cao hien co. Phan quyen LAY TU PHIEN (token), bo qua tham so sale client gui khi khong du quyen. Khong token -> tu choi.
// ═══════════════════════════════════════════════════════
var SPLIT_ORDER_MAX_ROWS_ = 3000;
var SPLIT_GET_ACTIONS_ = { splitOrderReport: 1, splitOrderMine: 1, splitOrderDetail: 1 };
var SPLIT_UNASSIGNED_ = '(chưa gán sale)';

// [{name, frac}] cac sale THAT cua don (frac da nhan saleRatio quay 30/70); don chia khi co >=2 nguoi khac nhau.
function _splitSales_(o) {
  var seen = {}, out = [];
  _posSaleFractions_(o).forEach(function (x) {
    var k = _normTxt_(x && x.name);
    if (!k || x.name === SPLIT_UNASSIGNED_ || !(x.frac > 0) || seen[k]) return;
    seen[k] = 1; out.push({ name: String(x.name), frac: x.frac });
  });
  return out;
}
// SUA 2026-10-23 (Duyen bao: don 749T10/2026 the sale "thuydinh95, ninhLTK1984" co du tren Base + Pos nhung Bao cao M khong tinh don chia cho 2 sale nay).
// NGUYEN NHAN GOC: tu 2026-10-15 buildSalesReportB_ tra don.saleShares/saleBanValid theo TEN CHINH cua nguoi (_saleCanonOrders_), con rb.bySale (dong tung sale o Bao cao M)
// van keyed theo TEN GOC tren Pos. Bao cao M/Danh sach don chia/Chi tiet doi soat tra dong bang so khop CHUOI ten => ten chinh != ten goc (vd thuydinh95 -> thuydinh1995,
// ninhLTK1984 -> ninhLTK) thi KHONG tim thay dong => don van dem vao tong nhung KHONG cong cho sale nao (Tong cong theo sale chi 152 trong khi 158 don chia x >=2 sale).
// Sua: so khop theo DANH TINH (cung nguoi = cung khoa) thay vi theo chuoi ten. Don co 2 ten cua CUNG 1 nguoi van KHONG phai don chia (1 nguoi).
function _splitIdentityFor_(names, orders) {
  var obs = (names || []).slice();
  (orders || []).forEach(function (o) { _splitSales_(o).forEach(function (s) { obs.push(s.name); }); });
  return _salePersonIdentity_(obs);
}
// Tra ham (ten chinh/ten bat ky) -> dong bySale cua nguoi do: uu tien dong trung ten, khong co thi dong cung nguoi co nhieu don nhat.
function _splitRowFinder_(byRaw, orders) {
  var id = _splitIdentityFor_(Object.keys(byRaw), orders), idx = {};
  Object.keys(byRaw).forEach(function (n) { var k = id.key(n); (idx[k] = idx[k] || []).push(byRaw[n]); });
  return function (name) {
    if (Object.prototype.hasOwnProperty.call(byRaw, name)) return byRaw[name];
    var list = idx[id.key(name)]; if (!list || !list.length) return null;
    var best = list[0]; list.forEach(function (r) { if ((r.orders || 0) > (best.orders || 0)) best = r; });
    return best;
  };
}
// ---- CHECK NGUOC VOI BASE (yeu cau Duyen 2026-10-24) ----
// Nguoi len don tren Pos co the gan THIEU/SAI the sale so voi don goc tren Base. Chi tiet don chia phai cho thay lech de Duyen yeu cau ke toan sua.
// CHI HIEN THI — KHONG doi cach chia tien (don co 0-1 ma bo dem van chia theo The Pos nhu quy tac cu; don >=2 ma van ghep Base nhu cu).
// So sanh theo NGUOI (id.key), khong theo chuoi ten. Tra {status:'khop'|'lech'|'khongCoBase', posSales[], baseSales[], missing[] (co tren Base, thieu tren Pos), extra[] (co tren Pos, khong co tren Base)}.
function _splitSaleSet_(names, id) {
  var out = {}, order = [];
  (names || []).forEach(function (n) {
    n = String(n == null ? '' : n).trim();
    if (!n || _isNumericTag_(n) || n === SPLIT_UNASSIGNED_) return;
    var k = id.key(n); if (!out[k]) { out[k] = n; order.push(k); }
  });
  return { map: out, keys: order };
}
function _splitCompareSales_(posNames, baseNames, id, hasBase) {
  var P = _splitSaleSet_(posNames, id), B = _splitSaleSet_(baseNames, id), missing = [], extra = [];
  B.keys.forEach(function (k) { if (!P.map[k]) missing.push(B.map[k]); });
  P.keys.forEach(function (k) { if (!B.map[k]) extra.push(P.map[k]); });
  return { status: !hasBase ? 'khongCoBase' : (missing.length || extra.length ? 'lech' : 'khop'),
    posSales: P.keys.map(function (k) { return P.map[k]; }), baseSales: B.keys.map(function (k) { return B.map[k]; }), missing: missing, extra: extra };
}
function _splitDayDiff_(ymdA, ymdB) {
  var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymdA || ''), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymdB || '');
  if (!a || !b) return null;
  return Math.abs(Date.UTC(+a[1], +a[2] - 1, +a[3]) - Date.UTC(+b[1], +b[2] - 1, +b[3])) / 86400000;
}
// Don Base cung SDT, ngay tao cach ngay don Pos <= maxDays (khi ghi chu Pos khong co ma bo dem / ma khong ra don Base). rows = readDTTong_(false,true). Dong Huy/Hoan (dinh nghia Base) bi loai.
function _splitPhoneCandidates_(rows, phone, posYmd, maxDays) {
  var out = [];
  (rows || []).forEach(function (r) {
    if (!phone || r.soDienThoai !== phone || _isExcludedOrderStatus_(r.trangThai)) return;
    var bd = _splitDmy_(r.ngayTao), d = _splitDayDiff_(bd.ymd, posYmd);
    if (d === null || d > maxDays) return;
    out.push({ ma: String(r.maBoDem || r.id || ''), ngay: bd.ymd, saleBan: String(r.saleBan || ''), giaTri: Number(r.giaTriDon) || 0, sanPham: String(r.sanPham || '') });
  });
  return out;
}
// ---- SALE PHAN HOI (yeu cau Duyen 2026-10-24) ----
// O "Sale phan hoi" tren tung dong Chi tiet Pos de sale tra loi khi don LECH Base; luu o sheet PhanHoiDonChia (key, sale, text, by, at) va xuat vao Excel doi soat cho ke toan.
// Khoa = <dong Pos|SDT|ngay|gia tri>#<ten sale chuan hoa> => moi sale phan hoi RIENG cho cung 1 don. Luu RIENG (khong nam trong cache chi tiet 120s) de sua xong hien ngay.
var SH_SPLIT_FB_ = 'PhanHoiDonChia', SPLIT_FB_HEADERS_ = ['key', 'sale', 'text', 'by', 'at'], SPLIT_FB_MAXLEN_ = 500;
function _splitFbKey_(o, sale) {
  var ph = normPhone_(o.soDienThoai) || String(o.soDienThoai || '');
  return [o.posRow || '', ph, _splitDmy_(o.ngayTaoDon).ymd, _splitRound_(o.giaTriSauGiam)].join('|') + '#' + _normTxt_(sale);
}
function _splitFbRead_() {
  var sh = getSheet_(SH_SPLIT_FB_, SPLIT_FB_HEADERS_), last = sh.getLastRow(), map = {};
  if (last < 2) return map;
  sh.getRange(2, 1, last - 1, 5).getValues().forEach(function (r, i) { if (r[0]) map[String(r[0])] = { row: i + 2, text: String(r[2] || ''), by: String(r[3] || ''), at: String(r[4] || '') }; });
  return map;
}
function _splitAttachFeedback_(out) {
  if (!out || !out.pos || !out.pos.length) return out;
  var m; try { m = _splitFbRead_(); } catch (e) { return out; }
  out.pos.forEach(function (x) { var f = m[x.fbKey]; x.feedback = f ? f.text : ''; x.feedbackBy = f ? f.by : ''; x.feedbackAt = f ? f.at : ''; });
  return out;
}
function saveSplitFeedback_(data) {
  var user = data && data.token ? _sessUser_(data.token) : null;
  if (!user) return { ok: false, code: 'AUTH', error: 'Can dang nhap (tai khoan that) de ghi phan hoi.' };
  var key = String(data.key || ''), sale = String(data.sale || '').trim(), text = String(data.text == null ? '' : data.text).replace(/[\r\n]+/g, ' ').trim();
  if (!sale || !/^[^#]*\|[^#]*\|[^#]*\|-?\d+#.+$/.test(key)) return { ok: false, error: 'Khoa dong khong hop le.' };
  if (key.substring(key.lastIndexOf('#') + 1) !== _normTxt_(sale)) return { ok: false, error: 'Khoa dong khong khop ten sale.' };
  if (text.length > SPLIT_FB_MAXLEN_) return { ok: false, error: 'Phan hoi toi da ' + SPLIT_FB_MAXLEN_ + ' ky tu.' };
  var sc = _splitScope_(user);
  if (!sc.all && !_profFold_(sc.names)[_normTxt_(sale)]) return { ok: false, error: 'Ban khong co quyen ghi phan hoi cho sale nay (chi ghi duoc trong pham vi cua minh).' };
  var lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (eL) { return { ok: false, error: 'He thong dang ban, thu lai sau it giay.' }; }
  try {
    var sh = getSheet_(SH_SPLIT_FB_, SPLIT_FB_HEADERS_), cur = _splitFbRead_()[key], by = String(user.name || user.username || ''), at = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
    if (cur) sh.getRange(cur.row, 1, 1, 5).setValues([[key, sale, text, by, at]]);
    else if (text) sh.appendRow([key, sale, text, by, at]);
    return { ok: true, key: key, text: text, by: by, at: at };
  } finally { try { lock.releaseLock(); } catch (eU) {} }
}
// Pham vi xem theo vai tro: Admin/CEO (co so 'viewer') = tat ca; Truong team = team minh; Quan ly/Truong phong = phong minh phu trach; con lai = chi ten cua minh.
function _splitScope_(user) {
  var base = _roleBase_(user.role);
  if (user.role === 'admin' || base === 'viewer') return { all: true, names: [] };
  var seen = {}, list = [];
  function add(n) { var k = _normTxt_(n); if (k && !seen[k]) { seen[k] = 1; list.push(String(n)); } }
  _profNames_(user).forEach(add);
  if (base === 'leader') {
    var vN = {}; _profNames_(user).forEach(function (n) { vN[_normTxt_(n)] = true; });
    readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function (t) {
      var mine = (t.leader && vN[_normTxt_(t.leader)]) || (user.team && _normTxt_(t.name) === _normTxt_(user.team));
      if (!mine) return;
      add(t.leader); (t.members || []).forEach(add);
    });
  } else if (base === 'manager') {
    var keys = {}; _userDeptKeys_(user).forEach(function (k) { keys[_normTxt_(k)] = 1; });
    var by = readSaleDepts_().byNorm;
    Object.keys(by).forEach(function (n) { var h = by[n]; if (h && h.key && keys[_normTxt_(h.key)]) add(h.name || n); });
  }
  return { all: false, names: list };
}
function _splitCSV_(s) { return s ? String(s).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []; }
function _splitRange_(p) {
  var today = _vnYmd_(new Date());
  return { from: p.dateFrom || (today.substring(0, 8) + '01'), to: p.dateTo || today };
}
function _splitFilters_(from, to, saleNames) {
  return { dateFrom: from, dateTo: to, sale: saleNames || [], nguon: [], marketer: [], sanPham: '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '' };
}
function _splitRound_(n) { return Math.round(Number(n) || 0); }

// ---- BAO CAO M ----
function splitOrderReport_(p, user) {
  var sc = _splitScope_(user), r = _splitRange_(p), want = _splitCSV_(p.sale), names;
  if (sc.all) names = want;
  else {
    var inScope = {}; sc.names.forEach(function (n) { inScope[_normTxt_(n)] = 1; });
    names = want.length ? want.filter(function (n) { return inScope[_normTxt_(n)]; }) : sc.names;   // khong vuot pham vi du client gui sale khac
    if (!names.length) return { ok: true, from: r.from, to: r.to, scope: 'own', total: { orders: 0, revenue: 0, aov: 0, splitOrders: 0, splitRevenue: 0, splitValue: 0, splitPctOrders: null, splitPctRevenue: null }, bySale: [], warnings: [want.length ? 'Ban khong co quyen xem sale da chon (chi xem duoc pham vi cua minh).' : 'Tai khoan chua gan ten sale nen khong co so lieu.'] };
  }
  var cache = CacheService.getScriptCache(), ck = _reportCacheKey_('splitrep1_', { f: _splitFilters_(r.from, r.to, names), a: sc.all ? 1 : 0 }), hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e0) {} }
  var rb = buildSalesReportB_(_splitFilters_(r.from, r.to, names));
  var by = {};
  (rb.bySale || []).forEach(function (s) { by[s.name] = { name: s.name, orders: s.orders, revenue: _splitRound_(s.giaTri), aov: s.orders ? _splitRound_(s.giaTri / s.orders) : 0, splitOrders: 0, splitRevenue: 0 }; });
  var splitOrders = 0, splitValue = 0, rowOf = _splitRowFinder_(by, rb.orders);
  (rb.orders || []).forEach(function (o) {
    var ss = _splitSales_(o); if (ss.length < 2) return;
    var v = Number(o.giaTriSauGiam) || 0; splitOrders += 1; splitValue += v;
    ss.forEach(function (s) { var row = rowOf(s.name); if (!row) return; row.splitOrders += 1; row.splitRevenue += v * s.frac; });
  });
  var rows = Object.keys(by).map(function (k) {
    var x = by[k]; x.splitRevenue = _splitRound_(x.splitRevenue);
    x.splitAov = x.splitOrders ? _splitRound_(x.splitRevenue / x.splitOrders) : 0;
    x.splitPct = x.revenue ? Math.round(x.splitRevenue / x.revenue * 1000) / 10 : null;
    return x;
  }).sort(function (a, b) { return b.splitRevenue - a.splitRevenue || b.splitOrders - a.splitOrders || b.revenue - a.revenue; });
  var splitRevenue = rows.reduce(function (s, x) { return s + x.splitRevenue; }, 0), orders = rb.totalOrders || 0, revenue = _splitRound_(rb.totalGiaTri);
  var out = { ok: true, from: r.from, to: r.to, scope: sc.all ? 'all' : 'scoped',
    total: { orders: orders, revenue: revenue, aov: orders ? _splitRound_(revenue / orders) : 0, splitOrders: splitOrders, splitRevenue: splitRevenue, splitValue: _splitRound_(splitValue),
      splitAov: splitOrders ? _splitRound_(splitRevenue / splitOrders) : 0,
      splitPctOrders: orders ? Math.round(splitOrders / orders * 1000) / 10 : null, splitPctRevenue: revenue ? Math.round(splitRevenue / revenue * 1000) / 10 : null },
    bySale: rows, warnings: [] };
  try { cache.put(ck, JSON.stringify(out), 120); } catch (e1) {}
  return out;
}

// ---- DANH SACH DON CHIA cua chinh nguoi dang nhap ----
function splitOrderMine_(p, user) {
  var sc = _splitScope_(user), r = _splitRange_(p), mineNames = sc.all ? [] : _profNames_(user);
  if (!sc.all && !mineNames.length) return { ok: true, from: r.from, to: r.to, all: false, summary: { orders: 0, customers: 0, revenue: 0, value: 0 }, items: [], note: 'Tai khoan chua gan ten sale.' };
  var cache = CacheService.getScriptCache(), ck = _reportCacheKey_('splitmine1_', { u: String(user.username).toLowerCase(), from: r.from, to: r.to, a: sc.all ? 1 : 0 }), hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e0) {} }
  var rb = buildSalesReportB_(_splitFilters_(r.from, r.to, sc.all ? [] : mineNames)), items = [], phones = {}, value = 0, revenue = 0;
  var idm = sc.all ? null : _splitIdentityFor_(mineNames, rb.orders), myKeys = {};   // so khop theo NGUOI (xem _splitRowFinder_), khong theo chuoi ten
  if (idm) mineNames.forEach(function (n) { myKeys[idm.key(n)] = 1; });
  (rb.orders || []).forEach(function (o) {
    var ss = _splitSales_(o); if (ss.length < 2) return;
    var my = null, others = [];
    ss.forEach(function (s) { if (idm && myKeys[idm.key(s.name)]) { if (!my) my = s; } else others.push(s.name); });
    if (!sc.all && !my) return;
    var v = Number(o.giaTriSauGiam) || 0, share = sc.all ? ss.reduce(function (a, s) { return a + v * s.frac; }, 0) : v * my.frac;
    value += v; revenue += share;
    var ph = normPhone_(o.soDienThoai); if (ph) phones[ph] = 1;
    items.push({ phone: ph, name: String(o.khachHang || ''), date: String(o.ngayTaoDon || ''), product: String(o.sanPham || '').substring(0, 80), value: _splitRound_(v), share: _splitRound_(share),
      frac: sc.all ? null : Math.round(my.frac * 1000) / 1000, withSales: sc.all ? ss.map(function (s) { return s.name; }) : others });
  });
  items.sort(function (a, b) { var da = parseVNDate_(a.date), db = parseVNDate_(b.date); return (db ? db.getTime() : 0) - (da ? da.getTime() : 0); });
  var truncated = items.length > SPLIT_ORDER_MAX_ROWS_;
  var out = { ok: true, from: r.from, to: r.to, all: sc.all, truncated: truncated,
    summary: { orders: items.length, customers: Object.keys(phones).length, revenue: _splitRound_(revenue), value: _splitRound_(value) },
    items: truncated ? items.slice(0, SPLIT_ORDER_MAX_ROWS_) : items };
  try { cache.put(ck, JSON.stringify(out).length < 90000 ? JSON.stringify(out) : '', 120); } catch (e1) {}
  return out;
}
// ---- CHI TIET DON CHIA CUA 1 SALE (bam vao 1 dong o Bao cao M; Duyen yeu cau 2026-10-21): 2 danh sach de DOI SOAT voi ke toan ----
// pos[] = MOI DON POS chia cho sale nay (ngay/thang len don Pos, khach, SDT, ghi chu, sale tren THE, san pham Pos, tong doanh thu da tinh trong bao cao,
//         phan sale nay duoc chia = dung so cua cot "Doanh thu tu don chia" o Bao cao M -> cong lai khop dong cua sale do).
// base[] = MOI DON GOC BASE da ghep voi don Pos do (ngay/thang len don Base, ma bo dem, sale ban tren Base, san pham Base, gia tri don Base, phan cua sale nay).
//         CHI co o don chia kieu "ghep Base" (don chia theo the sale chia deu / file ke toan / quay 30-70 khong co don goc Base -> dem o summary.noBaseOrders).
// Phan cua sale tren 1 don Base = gia tri / so ten sale ban (cung quy tac _resolveGhepDon_) x saleRatio quay -> tong base[].share = tong phan don ghep Base o pos[].
function _splitDmy_(v) {
  var d = !v ? '' : (Object.prototype.toString.call(v) === '[object Date]' ? _vnYmd_(v) : _dateStrToVnYmd_(v));   // ngay Pos 'dd/MM/yyyy' HOAC ngay don goc Base 'yyyy-MM-dd' (parseVNDate_ khong doc duoc dang sau)
  return d ? { dmy: d.substring(8, 10) + '/' + d.substring(5, 7) + '/' + d.substring(0, 4), month: d.substring(5, 7) + '/' + d.substring(0, 4), ymd: d } : { dmy: String(v || ''), month: '', ymd: '' };
}
function splitOrderDetail_(p, user) {
  var sale = String(p.sale || '').trim(), r = _splitRange_(p);
  var empty = function (w) { return { ok: true, from: r.from, to: r.to, sale: sale, pos: [], base: [], summary: { posOrders: 0, posTotal: 0, posShare: 0, baseOrders: 0, baseTotal: 0, baseShare: 0, noBaseOrders: 0 }, warnings: w ? [w] : [] }; };
  if (!sale) return { ok: false, error: 'Thieu ten sale.' };
  var sc = _splitScope_(user);
  if (!sc.all && !_profFold_(sc.names)[_normTxt_(sale)]) return empty('Ban khong co quyen xem sale nay (chi xem duoc pham vi cua minh).');
  var cache = CacheService.getScriptCache(), ck = _reportCacheKey_('splitdet2_', { f: _splitFilters_(r.from, r.to, [sale]) }), hit = cache.get(ck);
  if (hit) { try { return _splitAttachFeedback_(JSON.parse(hit)); } catch (e0) {} }
  var f = _splitFilters_(r.from, r.to, [sale]); f.withBaseProduct = true;
  var rb = buildSalesReportB_(f), key = _normTxt_(sale), pos = [], base = [], noBase = 0, sm = { pt: 0, ps: 0, bt: 0, bs: 0 };
  var refCnt = 0, observed = [sale];
  (rb.orders || []).forEach(function (o) { _splitSales_(o).forEach(function (s) { observed.push(s.name); }); });
  (rb.orders || []).forEach(function (o) { (o.ghepBase || []).forEach(function (b) { String(b.saleBan || '').split(',').forEach(function (n) { n = n.trim(); if (n && !_isNumericTag_(n)) observed.push(n); }); }); }); // loai STT Pancake
  var id = _salePersonIdentity_(observed), me = _normTxt_(id.primary(sale));
  // Don cua sale nay (de doc Base 1 lan cho check nguoc): don chia ma sale la 1 trong cac nguoi chia.
  var mineO = (rb.orders || []).filter(function (o) { var ss0 = _splitSales_(o); if (ss0.length < 2) return false; return ss0.some(function (s) { return id.key(s.name) === id.key(sale); }); });
  var wantCodes = {}, needPhone = false;
  mineO.forEach(function (o) {
    if (o.ghepBase && o.ghepBase.length) return;
    var cds = _splitBhCodes_(_extractCounterCodes_(o.ghiChu)).normal;
    cds.forEach(function (c) { wantCodes[c] = true; });
    needPhone = true;
  });
  var refIdx = null, dtRows = null, refErr = '';
  try { if (Object.keys(wantCodes).length) refIdx = _readBaseRowsByCounterCodes_(wantCodes, true); } catch (eR1) { refErr = 'Khong doc duoc don Base theo ma bo dem: ' + (eR1 && eR1.message || eR1); }
  var refPhoneRows = function () { if (dtRows === null) { try { dtRows = readDTTong_(false, true); } catch (eR2) { dtRows = []; refErr = refErr || ('Khong doc duoc DT TONG de doi chieu theo SDT: ' + (eR2 && eR2.message || eR2)); } } return dtRows; };
  var chkSm = { khop: 0, lech: 0, khongCoBase: 0, goiY: 0 };
  (rb.orders || []).forEach(function (o) {
    var ss = _splitSales_(o); if (ss.length < 2) return;
    var my = null; ss.forEach(function (s) { if (!my && id.key(s.name) === id.key(sale)) my = s; });
    if (!my) return;
    var v = Number(o.giaTriSauGiam) || 0, share = v * my.frac, pd = _splitDmy_(o.ngayTaoDon), ph = normPhone_(o.soDienThoai) || String(o.soDienThoai || '');
    var ratio = o.saleRatio || 1;
    pos.push({ date: pd.dmy, month: pd.month, ymd: pd.ymd, name: String(o.khachHang || ''), phone: ph, note: String(o.ghiChu || ''),
      sales: String(o.saleThe || ''), product: String(o.sanPham || '').substring(0, 300), total: _splitRound_(v),
      posValue: o.giaTriPos !== undefined ? _splitRound_(o.giaTriPos) : null, share: _splitRound_(share), frac: Math.round(my.frac * 1000) / 1000,
      kind: o.dieuChinh || (o.saleRatio ? 'quay' : 'the'), fbKey: _splitFbKey_(o, sale) });
    var chkRows = [], chkSrc = '';
    if (o.ghepBase && o.ghepBase.length) { o.ghepBase.forEach(function (b) { if (b.tinh) chkRows.push({ ma: String(b.ma || ''), ngay: String(b.ngay || ''), saleBan: String(b.saleBan || ''), giaTri: Number(b.giaTri) || 0, sanPham: String(b.sanPham || '') }); }); if (chkRows.length) chkSrc = 'ma'; }
    else {
      if (refIdx) {
        var seenR = {};
        _splitBhCodes_(_extractCounterCodes_(o.ghiChu)).normal.forEach(function (c) {
          (_pickBaseRowsForCode_(c, refIdx) || []).forEach(function (r) {
            if (seenR[r.rowIndex] || _isExcludedOrderStatus_(r.trangThai)) return; seenR[r.rowIndex] = 1;
            chkRows.push({ ma: String(r.code || ''), ngay: _splitDmy_(r.ngayTao).ymd, saleBan: String(r.saleBan || ''), giaTri: Number(r.giaTriDon) || 0, sanPham: String(r.sanPham || '') });
          });
        });
        if (chkRows.length) chkSrc = 'ma';
      }
      if (!chkRows.length) { chkRows = _splitPhoneCandidates_(refPhoneRows(), normPhone_(o.soDienThoai), pd.ymd, 3); if (chkRows.length) chkSrc = 'sdt'; }
    }
    var baseNamesChk = []; chkRows.forEach(function (b) { String(b.saleBan || '').split(',').forEach(function (n) { baseNamesChk.push(n); }); });
    var cmp = _splitCompareSales_(_donSaleNamesFromThe_(o.theSale), baseNamesChk, id, chkRows.length > 0);
    pos[pos.length - 1].baseCheck = { status: cmp.status, nguon: chkSrc, posSales: cmp.posSales, baseSales: cmp.baseSales, missing: cmp.missing, extra: cmp.extra, baseCodes: chkRows.map(function (b) { return b.ma; }).filter(Boolean) };
    chkSm[cmp.status] += 1; if (chkSrc === 'sdt') chkSm.goiY += 1;
    sm.pt += v; sm.ps += share;
    var gb = o.ghepBase || [], any = false;
    gb.forEach(function (b) {
      if (!b.tinh) return;   // don goc Base da Huy/Hoan: khong tinh doanh thu
      var names = String(b.saleBan || '').split(',').map(function (x) { return x.trim(); }).filter(function(x){ return x && !_isNumericTag_(x); }); // loai STT Pancake
      if (!names.length) names = ['(chưa gán sale)'];
      var cnt = 0; names.forEach(function (n) { if (_normTxt_(id.primary(n)) === me) cnt++; });
      if (!cnt) return;
      any = true;
      var bv = Number(b.giaTri) || 0, bsh = bv * cnt / names.length * ratio, bd = _splitDmy_(b.ngay);
      base.push({ date: bd.dmy, month: bd.month, ymd: bd.ymd, name: String(o.khachHang || ''), phone: ph, code: String(b.ma || ''), sales: String(b.saleBan || ''),
        product: String(b.sanPham || '').substring(0, 300), total: _splitRound_(bv), share: _splitRound_(bsh) });
      sm.bt += bv; sm.bs += bsh;
    });
    if (!any) noBase += 1;
    // Don KHONG ghep Base (0-1 ma bo dem) nhung tim thay don Base de doi chieu: dua vao tab Base de THAM CHIEU (ref=true, share=0, KHONG cong vao tong phan chia).
    if (!gb.length && chkRows.length) chkRows.forEach(function (b) {
      var bd2 = _splitDmy_(b.ngay);
      base.push({ date: bd2.dmy, month: bd2.month, ymd: bd2.ymd, name: String(o.khachHang || ''), phone: ph, code: b.ma, sales: _saleNamesClean_(b.saleBan).join(', '), product: b.sanPham.substring(0, 300), total: _splitRound_(b.giaTri), share: 0, ref: true, nguon: chkSrc });
      refCnt += 1;
    });
  });
  var byYmd = function (a, b) { return a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0; };
  pos.sort(byYmd); base.sort(byYmd);
  var trunc = pos.length > SPLIT_ORDER_MAX_ROWS_ || base.length > SPLIT_ORDER_MAX_ROWS_;
  var out = { ok: true, from: r.from, to: r.to, sale: sale, truncated: trunc, pos: pos.slice(0, SPLIT_ORDER_MAX_ROWS_), base: base.slice(0, SPLIT_ORDER_MAX_ROWS_),
    summary: { posOrders: pos.length, posTotal: _splitRound_(sm.pt), posShare: _splitRound_(sm.ps), baseOrders: base.length - refCnt, baseTotal: _splitRound_(sm.bt), baseShare: _splitRound_(sm.bs), noBaseOrders: noBase, baseRefOrders: refCnt, check: chkSm }, warnings: refErr ? [refErr] : [] };
  try { var js = JSON.stringify(out); cache.put(ck, js.length < 90000 ? js : '', 120); } catch (e1) {}
  return _splitAttachFeedback_(out);
}
function splitDoGet_(action, p) {
  try {
    var u = p && p.token ? _sessUser_(p.token) : null;
    if (!u) return jsonOut_({ ok: false, code: 'AUTH', error: 'Can dang nhap (tai khoan that) de xem don chia.' });
    return jsonOut_(action === 'splitOrderReport' ? splitOrderReport_(p, u) : action === 'splitOrderDetail' ? splitOrderDetail_(p, u) : splitOrderMine_(p, u));
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi don chia: ' + (err && err.message || err) }); }
}

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
  var cache = CacheService.getScriptCache(), ck = _reportCacheKey_('splitdet1_', { f: _splitFilters_(r.from, r.to, [sale]) }), hit = cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch (e0) {} }
  var f = _splitFilters_(r.from, r.to, [sale]); f.withBaseProduct = true;
  var rb = buildSalesReportB_(f), key = _normTxt_(sale), pos = [], base = [], noBase = 0, sm = { pt: 0, ps: 0, bt: 0, bs: 0 };
  var observed = [sale];
  (rb.orders || []).forEach(function (o) { _splitSales_(o).forEach(function (s) { observed.push(s.name); }); });
  (rb.orders || []).forEach(function (o) { (o.ghepBase || []).forEach(function (b) { String(b.saleBan || '').split(',').forEach(function (n) { n = n.trim(); if (n) observed.push(n); }); }); });
  var id = _salePersonIdentity_(observed), me = _normTxt_(id.primary(sale));
  (rb.orders || []).forEach(function (o) {
    var ss = _splitSales_(o); if (ss.length < 2) return;
    var my = null; ss.forEach(function (s) { if (!my && id.key(s.name) === id.key(sale)) my = s; });
    if (!my) return;
    var v = Number(o.giaTriSauGiam) || 0, share = v * my.frac, pd = _splitDmy_(o.ngayTaoDon), ph = normPhone_(o.soDienThoai) || String(o.soDienThoai || '');
    var ratio = o.saleRatio || 1;
    pos.push({ date: pd.dmy, month: pd.month, ymd: pd.ymd, name: String(o.khachHang || ''), phone: ph, note: String(o.ghiChu || ''),
      sales: String(o.saleThe || ''), product: String(o.sanPham || '').substring(0, 300), total: _splitRound_(v),
      posValue: o.giaTriPos !== undefined ? _splitRound_(o.giaTriPos) : null, share: _splitRound_(share), frac: Math.round(my.frac * 1000) / 1000,
      kind: o.dieuChinh || (o.saleRatio ? 'quay' : 'the') });
    sm.pt += v; sm.ps += share;
    var gb = o.ghepBase || [], any = false;
    gb.forEach(function (b) {
      if (!b.tinh) return;   // don goc Base da Huy/Hoan: khong tinh doanh thu
      var names = String(b.saleBan || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
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
  });
  var byYmd = function (a, b) { return a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0; };
  pos.sort(byYmd); base.sort(byYmd);
  var trunc = pos.length > SPLIT_ORDER_MAX_ROWS_ || base.length > SPLIT_ORDER_MAX_ROWS_;
  var out = { ok: true, from: r.from, to: r.to, sale: sale, truncated: trunc, pos: pos.slice(0, SPLIT_ORDER_MAX_ROWS_), base: base.slice(0, SPLIT_ORDER_MAX_ROWS_),
    summary: { posOrders: pos.length, posTotal: _splitRound_(sm.pt), posShare: _splitRound_(sm.ps), baseOrders: base.length, baseTotal: _splitRound_(sm.bt), baseShare: _splitRound_(sm.bs), noBaseOrders: noBase }, warnings: [] };
  try { var js = JSON.stringify(out); cache.put(ck, js.length < 90000 ? js : '', 120); } catch (e1) {}
  return out;
}
function splitDoGet_(action, p) {
  try {
    var u = p && p.token ? _sessUser_(p.token) : null;
    if (!u) return jsonOut_({ ok: false, code: 'AUTH', error: 'Can dang nhap (tai khoan that) de xem don chia.' });
    return jsonOut_(action === 'splitOrderReport' ? splitOrderReport_(p, u) : action === 'splitOrderDetail' ? splitOrderDetail_(p, u) : splitOrderMine_(p, u));
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi don chia: ' + (err && err.message || err) }); }
}

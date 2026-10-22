// ═══════════════════════════════════════════════════════
//  DON CHIA (yeu cau Duyen 2026-10): "don chia" = don Pos co >=2 sale CUNG CHIA (the sale co nhieu ten / ghep Base / file ke toan chia khong deu).
//  (1) GET splitOrderReport — BAO CAO M (man rieng trong Bao cao doanh so): tong don (thuc te), doanh thu, TB/don + so don chia, doanh thu tu don chia,
//      TB/don chia, theo TUNG sale. (2) GET splitOrderMine — "Danh sach don chia" (loc nguon du lieu o Danh sach KH): don ma NGUOI DANG NHAP duoc sale khac
//      chia + tong ket nhanh (so don chia, doanh thu tu don chia). Nguon so lieu = buildSalesReportB_ (CUNG bo loc/quy tac chia voi Bao cao B + posMetrics_),
//      nen khop so lieu bao cao hien co. Phan quyen LAY TU PHIEN (token), bo qua tham so sale client gui khi khong du quyen. Khong token -> tu choi.
// ═══════════════════════════════════════════════════════
var SPLIT_ORDER_MAX_ROWS_ = 3000;
var SPLIT_GET_ACTIONS_ = { splitOrderReport: 1, splitOrderMine: 1 };
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
  var splitOrders = 0, splitValue = 0;
  (rb.orders || []).forEach(function (o) {
    var ss = _splitSales_(o); if (ss.length < 2) return;
    var v = Number(o.giaTriSauGiam) || 0; splitOrders += 1; splitValue += v;
    ss.forEach(function (s) { var row = by[s.name]; if (!row) return; row.splitOrders += 1; row.splitRevenue += v * s.frac; });
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
  var fold = sc.all ? null : _profFold_(mineNames);
  var rb = buildSalesReportB_(_splitFilters_(r.from, r.to, sc.all ? [] : mineNames)), items = [], phones = {}, value = 0, revenue = 0;
  (rb.orders || []).forEach(function (o) {
    var ss = _splitSales_(o); if (ss.length < 2) return;
    var my = null, others = [];
    ss.forEach(function (s) { if (fold && fold[_normTxt_(s.name)]) { if (!my) my = s; } else others.push(s.name); });
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
function splitDoGet_(action, p) {
  try {
    var u = p && p.token ? _sessUser_(p.token) : null;
    if (!u) return jsonOut_({ ok: false, code: 'AUTH', error: 'Can dang nhap (tai khoan that) de xem don chia.' });
    return jsonOut_(action === 'splitOrderReport' ? splitOrderReport_(p, u) : splitOrderMine_(p, u));
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi don chia: ' + (err && err.message || err) }); }
}

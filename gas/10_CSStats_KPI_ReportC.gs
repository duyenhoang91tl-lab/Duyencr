// ═══════════════════════════════════════════════════════════════
//  SO LIEU CA NHAN CUA 1 CS cho Pancake AI (action 'csStats') — yeu cau Duyen 2026-10-05:
//  tong so don, doanh thu, ty le chot, hoa hong (don >=15tr / <15tr + kenh co % rieng), tong hoa hong, chuong
//  trinh thuong. DUNG CHUNG nguon so lieu voi CRM: don + chia sale lay tu buildSalesReportB_ (Pos, da ghep Base,
//  da tinh 30/70), ty le chot tu saleCloseRate cua B; hoa hong/thuong la BAN PORT CUA _computeCommissionData_ /
//  _computeBonusData_ trong index.html (CRM) — NEU SUA QUY TAC HOA HONG/THUONG O CRM THI PHAI SUA CA O DAY.
// ═══════════════════════════════════════════════════════════════
var CS_COMMISSION_THRESHOLD_ = 15000000; // phai khop COMMISSION_THRESHOLD o index.html

function _csJsonSetting_(key, fallback) {
  try { var raw = getSetting_(key); if (!raw) return fallback; var v = JSON.parse(raw); return (v === null || v === undefined) ? fallback : v; }
  catch (e) { return fallback; }
}
function _csYmdFromDmy_(s) {
  var m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}
function _csDaysSinceStart_(startYmd, dateYmd) {
  var s = String(startYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/), d = String(dateYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!s || !d) return null;
  return Math.round((Date.UTC(+d[1], +d[2] - 1, +d[3]) - Date.UTC(+s[1], +s[2] - 1, +s[3])) / 86400000) + 1;
}
function _csBonusProductQty_(sanPham, keywordsStr) {
  var text = String(sanPham || '').toLowerCase();
  var kws = String(keywordsStr || '').split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
  if (!kws.length || !text) return { matched: false, qty: 0 };
  var totalQty = 0, matched = false;
  kws.forEach(function(kw) {
    var idx = 0;
    while (true) {
      var pos = text.indexOf(kw, idx);
      if (pos === -1) break;
      matched = true;
      var tail = text.substr(pos + kw.length, 10);
      var m = tail.match(/^[\s]*[x×][\s]*([0-9]+)/) || tail.match(/^[\s]*\(([0-9]+)\)/);
      totalQty += m ? (parseInt(m[1], 10) || 1) : 1;
      idx = pos + kw.length;
    }
  });
  return { matched: matched, qty: totalQty };
}
function _csBonusApplies_(p, dateStr, channel, startYmd) {
  if (p.dateFrom && dateStr && dateStr < p.dateFrom) return false;
  if (p.dateTo && dateStr && dateStr > p.dateTo) return false;
  var aud = p.audience || {};
  if (aud.online || aud.offline) {
    if (!channel) return false;
    if (channel === 'online' && !aud.online) return false;
    if (channel === 'offline' && !aud.offline) return false;
    if (channel === 'probation') return false;
  }
  if (p.probationDay && p.probationDay.enabled) {
    if (!startYmd) return false;
    var dayNum = _csDaysSinceStart_(startYmd, dateStr);
    if (dayNum === null || dayNum < 1) return false;
    var from = (p.probationDay.from !== '' && p.probationDay.from != null) ? Number(p.probationDay.from) : 1;
    var to = (p.probationDay.to !== '' && p.probationDay.to != null) ? Number(p.probationDay.to) : Infinity;
    if (dayNum < from || dayNum > to) return false;
  }
  return true;
}
// Tu khoa san pham BAT BUOC cua 1 CT thuong (port _bonusRequireKw_/_bonusRequireProductOk_ o index.html — sua 1 noi phai sua ca 2).
// CT "Bill vong mix charm" luu truoc khi co field requireProduct van chi tinh don co san pham "vòng" (yeu cau Duyen 2026-10-07).
function _csRequireProductOk_(p, sanPham) {
  var kw = (p.requireProduct !== undefined && p.requireProduct !== null) ? String(p.requireProduct).trim()
    : (/vòng/i.test(String(p.name || '').normalize('NFC')) ? 'vòng' : '');
  var kws = kw.split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean);
  if (!kws.length) return true;
  var text = String(sanPham || '').normalize('NFC').toLowerCase();
  return kws.some(function(k) { return text.indexOf(k.normalize('NFC')) !== -1; });
}
function _csMoney_(n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
// Mo ta ngan 1 chuong trinh thuong de hien cho CS (khong tu cham — chi doc cac dieu kien co cau truc)
function _csBonusSummary_(p) {
  var parts = [];
  if (p.tier && p.tier.enabled && (p.tier.rows || []).length) {
    parts.push('Số đơn/ngày: ' + p.tier.rows.slice().sort(function(a, b) { return Number(a.count) - Number(b.count); })
      .map(function(t) { return '≥' + t.count + ' đơn = ' + _csMoney_(t.bonus); }).join('; '));
  }
  if (p.revenue && p.revenue.enabled) {
    var lo = (p.revenue.min !== '' && p.revenue.min != null) ? 'từ ' + _csMoney_(p.revenue.min) : '';
    var hi = (p.revenue.max !== '' && p.revenue.max != null) ? ' đến ' + _csMoney_(p.revenue.max) : '';
    parts.push((p.revenue.scope === 'day' ? 'Doanh số ngày ' : 'Giá trị 1 đơn ') + (lo + hi).trim() + ' = ' + _csMoney_(p.bonusAmount));
  }
  if (p.product && String(p.product).trim()) parts.push('SP "' + String(p.product).trim() + '" = ' + _csMoney_(p.bonusAmount) + '/SP');
  if (p.firstOrder && p.firstOrder.enabled) parts.push('Đơn đầu tiên trong ngày = ' + _csMoney_(p.firstOrder.amount));
  return parts.join(' · ');
}

// ═══════════ BONUS CORE (BẢN SAO NGUYÊN VĂN của js/27-fn-bonuscore.js — sửa 1 nơi PHẢI sửa cả 2 nơi) ═══════════
// GAS: map/ovr KHÔNG lấy từ localStorage — buildCsStats_ đọc Settings 'bonusProductMap' / 'bonusOrderOvr' rồi truyền vào _bcOrderInfo_(o, map, ovr).
var BONUS_PRODUCT_MAP = {}, BONUS_ORDER_OVR = {};
function _bcFold_(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase().replace(/\s+/g,' ').trim(); }
// Mã bộ đếm sạch từ dòng đầu ghi chú Pos (vd "17T10/2026") — rỗng nếu không phải dạng đơn gốc.
function _bcCounterOf_(ghiChu){
  var first = String(ghiChu == null ? '' : ghiChu).split(/[\r\n]/)[0].trim();
  var m = /^([A-Za-z]{0,3}\d{1,6}[A-Za-z]{0,3}T\d{1,2}\/\d{2,4})$/.exec(first);
  return m ? m[1].replace(/\s+/g,'').toUpperCase() : '';
}
// Đoán loại dòng khi CHƯA có trong map. Trả {cls:'vong'|'charm'|'skip'|'gift'|'prod'}.
function _bcGuess_(code, name){
  var c = _bcFold_(code), n = _bcFold_(name), t = n + ' ' + c;
  if (/bi vang|(^|[-\s])bv($|[-\s])|cv10k-bv/.test(t)) return 'skip';
  if (/^qua |^qhts|^la bo de|^la-bd|^cb-|combo|qua tang|hop qua|bao hanh|chi phi/.test(t)) return 'gift';
  if (/^(vong tay|vong ngoc|hat( |$))|^hd-|^hdd|^vt|vtnl/.test(n || c) || (!n && /^(hd|vt)/.test(c))) return 'vong';
  if (/^day thep|^dich vu|^nguyen vat lieu|^ttv |^them tien|^ship|^phi |^pkd/.test(n || c) || (!n && /^(dtcd|ttv|nvl-|pkd)/.test(c))) return 'skip';
  if (/cuon |ngu dieu/.test(t)) return 'vong';
  if (/^charm|^c[a-z]{1,4}-/.test(n === '' ? c : n)) return 'charm';
  return 'prod';
}
function _bcLineCls_(code, name, map){
  var e = map && map[String(code||'').toLowerCase()];
  if (e){
    if (e.skip) return {cls:'skip', auto:false};
    if (e.gift) return {cls:'gift', auto:false};
    if (e.vong) return {cls:'vong', auto:false};
    if (e.charm) return {cls:'charm', auto:false};
    return {cls:'prod', auto:false};
  }
  return {cls:_bcGuess_(code, name), auto:true};
}
// Tách dòng sản phẩm của 1 đơn Pos: mã ';' ghép vị trí với SL ',' (tên ',' chỉ dùng khi số tên = số mã).
function _bcOrderLines_(o){
  var codes = String(o.maSanPham||'').split(';').map(function(x){ return x.trim(); });
  var qtys = String(o.soLuong||'').split(',').map(function(x){ return x.trim(); });
  var names = String(o.sanPham||'').split(',').map(function(x){ return x.trim(); });
  var aligned = names.length === codes.length;
  var out = [];
  codes.forEach(function(c, i){
    if (!c) return;
    var q = Number(String(qtys[i]||'1').replace(',', '.'));
    if (!isFinite(q) || q <= 0) q = 1;
    if (q > 50) q = 1;   // dữ liệu lệch cột (vd "2001") → coi là 1, đơn nằm trong danh sách "cần kiểm tra"
    out.push({ code:c, name: aligned ? names[i] : '', qty:q, qtyOdd: Number(String(qtys[i]||'1').replace(',', '.')) > 50 });
  });
  return out;
}
// Thông tin đếm của 1 đơn. map/ovr mặc định lấy từ biến toàn cục.
function _bcOrderInfo_(o, map, ovr){
  map = map || BONUS_PRODUCT_MAP; ovr = ovr || BONUS_ORDER_OVR;
  var counter = _bcCounterOf_(o.ghiChu);
  var total = Number(o.giaTriDon != null ? o.giaTriDon : o.giaTriSauGiam) || 0;
  var lines = _bcOrderLines_(o), reasons = [];
  lines.forEach(function(l){
    var k = (counter ? counter + '|' : '') + l.code.toLowerCase();
    var ov = (counter && ovr && ovr[k]) || {};
    var cl = _bcLineCls_(l.code, l.name, map);
    l.cls = cl.cls; l.auto = cl.auto; l.slot = ov.slot || '';
    if (l.slot === 'skip') l.cls = 'skip'; else if (l.slot === 'gift') l.cls = 'gift';
    l.rev = (ov.rev !== undefined && ov.rev !== '' && ov.rev !== null) ? Number(ov.rev) : null;
  });
  var hasVong = lines.some(function(l){ return l.cls === 'vong'; });
  lines.forEach(function(l){ if (l.cls === 'charm' && !hasVong) l.cls = 'prod'; });   // charm đứng riêng = sản phẩm riêng
  var vongLines = lines.filter(function(l){ return l.cls === 'vong' || l.cls === 'charm'; });
  var prodLines = lines.filter(function(l){ return l.cls === 'prod'; });
  var slots = {}, nProd = 0;
  prodLines.forEach(function(l){
    if (/^[0-9]+$/.test(String(l.slot||''))){ if (!slots[l.slot]){ slots[l.slot] = true; nProd += 1; } }
    else nProd += l.qty;
  });
  var nProducts = (hasVong ? 1 : 0) + nProd;
  var vongRev = null;
  if (hasVong){
    if (!prodLines.length) vongRev = total;
    else if (prodLines.every(function(l){ return l.rev !== null; })) vongRev = total - prodLines.reduce(function(s,l){ return s + l.rev; }, 0);
    else if (total >= 15000000) reasons.push('Đơn vòng ≥15tr có sản phẩm khác — nhập doanh thu từng dòng ở tab "Chi tiết thưởng" để tính mốc 15tr phần vòng + charm mix.');
  }
  var unconfirmed = lines.filter(function(l){ return l.auto; }).length;   // số dòng còn ĐOÁN TỰ ĐỘNG (chưa lưu trong BONUS_PRODUCT_MAP) — chỉ để hiển thị ở tab, không chặn tính thưởng
  if (lines.some(function(l){ return l.qtyOdd; })) reasons.push('Số lượng bất thường (lệch cột) — kiểm tra lại.');
  if (!lines.length) reasons.push('Đơn không có mã sản phẩm.');
  return { counter:counter, total:total, lines:lines, hasVong:hasVong, nProducts:nProducts, vongRev:vongRev, needReview:reasons.length>0, reasons:reasons, unconfirmed:unconfirmed };
}
// Số sản phẩm tối thiểu của CT "Đơn từ Xtr (combo N sản phẩm)" — field p.minProducts, thiếu thì đọc từ TÊN CT.
function _bcMinProducts_(p){
  if (p.minProducts !== undefined && p.minProducts !== null && p.minProducts !== '') return Number(p.minProducts) || 0;
  var m = /combo\s*(\d+)\s*s[aả]n\s*ph[aẩ]m/i.exec(String(p.name||'').normalize('NFC'));
  return m ? Number(m[1]) : 0;
}
// CT "Bill vòng mix charm": tính trên PHẦN VÒNG + CHARM MIX (không phải cả đơn).
function _bcIsVongProgram_(p){
  if (p.vongScope !== undefined && p.vongScope !== null) return !!p.vongScope;
  return /v[oò]ng\s*mix\s*charm/i.test(String(p.name||'').normalize('NFC'));
}
// CT "Tourmaline cao cấp": đơn phải CÓ nhẫn Tourmaline (Duyên 2026-10-10). Field p.requireProduct (nếu đã đặt) thắng.
function _bcRequireKw_(p){
  if (p.requireProduct !== undefined && p.requireProduct !== null) return String(p.requireProduct).trim();
  var nm = String(p.name||'').normalize('NFC');
  if (/tourmaline cao cấp/i.test(nm)) return 'nhẫn tour';
  return /vòng/i.test(nm) ? 'vòng' : '';
}
// ═══════════ HẾT BONUS CORE ═══════════

function buildCsStats_(cs, dateFrom, dateTo) {
  cs = String(cs || '').trim();
  if (!cs) return { ok: false, error: 'Thiếu tên CS.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom || '') || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo || '')) return { ok: false, error: 'Khoảng ngày không hợp lệ (cần dạng YYYY-MM-DD).' };
  if (dateFrom > dateTo) return { ok: false, error: 'Ngày bắt đầu phải trước ngày kết thúc.' };

  // 1) Tên của CS này: tên đang chọn + các tên/bí danh khai báo ở tài khoản (Users.names)
  // NGUYÊN NHÂN GỐC (đã sửa): ô "CS đang dùng" của Pancake AI lấy USERNAME đăng nhập (vd 'yennth' — xem
  // handleGetCsNames: u.username || u.name), còn đơn/Base ghi theo TÊN SALE (vd 'yenNTH2004' trong Users.names).
  // Trước đây chỉ so cs với names + name, KHÔNG so với username → không tìm ra tài khoản → names chỉ còn ['yennth']
  // → 0 đơn và không đọc được % hoa hồng/kênh/team ("Nguồn %: Chưa cài"). Nay so cả username.
  var names = [cs], user = null;
  try {
    readUsers_(getCrmSS_().getSheetByName(SH_USER)).forEach(function(u) {
      var all = (u.names || []).concat([u.name, u.username]);
      if (all.some(function(x) { return x && _normTxt_(x) === _normTxt_(cs); })) {
        user = user || u;
        all.forEach(function(x) { if (x && names.indexOf(x) === -1) names.push(x); });
      }
    });
  } catch (eU) {}
  var myFold = {};
  _expandSaleFilterWithPancakeAliases_(names).forEach(function(n) { myFold[_normTxt_(n)] = true; });
  function pick(map) { // lay gia tri cua ten dau tien co trong map (INDIVIDUAL_RATES/SALE_CHANNELS khoa theo ten Sale)
    if (!map || typeof map !== 'object') return undefined;
    for (var i = 0; i < names.length; i++) if (Object.prototype.hasOwnProperty.call(map, names[i])) return map[names[i]];
    return undefined;
  }

  // 2) Don cua CS trong ky (Pos da ghep Base, da chia sale/30-70) — cung bo loc voi Bao cao B/E
  var rep = buildSalesReportB_({ dateFrom: dateFrom, dateTo: dateTo, sale: names });

  // 3) Cau hinh hoa hong / thuong (admin cai o CRM)
  var indiv = pick(_csJsonSetting_('individualRates', {})) || {};
  var channel = pick(_csJsonSetting_('saleChannels', {})) || '';
  var chRates = _csJsonSetting_('channelCommissionRates', {});
  var programs = _csJsonSetting_('bonusPrograms', []); if (!Array.isArray(programs)) programs = [];
  var prodMap = _csJsonSetting_('bonusProductMap', {}), orderOvr = _csJsonSetting_('bonusOrderOvr', {}); // dem san pham / vong chuoi / charm mix (tab "Chi tiet thuong")
  var hasGocField = (rep.orders || []).some(function(x) { return !!x.baseNgayTao; }); // backend cu/khong ghep Base -> giu cach cu
  var teamRate = null, teamName = '';
  try {
    readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
      if (teamRate) return;
      var inTeam = names.some(function(n) { return t.leader === n || (t.members || []).indexOf(n) !== -1; });
      if (inTeam) { teamRate = t.ratePct || { above15: 0, below15: 0 }; teamName = t.name; }
    });
  } catch (eT) {}
  var hasA = indiv.above15 !== undefined && indiv.above15 !== null && indiv.above15 !== '';
  var hasB = indiv.below15 !== undefined && indiv.below15 !== null && indiv.below15 !== '';
  var teamA = teamRate && Number(teamRate.above15) > 0, teamB = teamRate && Number(teamRate.below15) > 0;
  var def = channel === 'online' ? { a: 1.5, b: 1, label: 'Mặc định Online' } : channel === 'offline' ? { a: 1, b: 0.8, label: 'Mặc định Offline' } : null;
  function src(has, teamHas) { return has ? 'Cá nhân' : (teamHas ? 'Team ' + teamName : (def ? def.label : 'Chưa cài')); }
  var rateA = hasA ? Number(indiv.above15) : (teamA ? Number(teamRate.above15) : (def ? def.a : 0));
  var rateB = hasB ? Number(indiv.below15) : (teamB ? Number(teamRate.below15) : (def ? def.b : 0));
  function channelRate(kenh) { // % rieng cua nguon don (vd facebook = 1%) — bo qua nguong 15tr
    var k = String(kenh || '').trim().toLowerCase();
    if (!k) return null;
    if (k === 'facebook' && !Object.prototype.hasOwnProperty.call(chRates, k)) return 1;
    if (!Object.prototype.hasOwnProperty.call(chRates, k)) return null;
    var v = chRates[k];
    return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  }

  // 4) Duyet don: so don, doanh thu (phan cua toi), hoa hong
  var T = CS_COMMISSION_THRESHOLD_;
  var totalOrders = 0, revenue = 0;
  var ordA = 0, ordB = 0, revA = 0, revB = 0, ordCh = 0, revCh = 0, commCh = 0, chBreak = {};
  var mine = []; // don cua toi (de cham thuong)
  (rep.orders || []).forEach(function(o) {
    var giaTri = Number(o.giaTriSauGiam) || 0, frac = 0;
    if (o.saleShares && o.saleShares.length) {
      o.saleShares.forEach(function(x) { if (myFold[_normTxt_(x.name)]) frac += Number(x.frac) || 0; });
    } else {
      var ns = String(o.saleBanValid || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
      if (ns.length) { var c = 0; ns.forEach(function(x) { if (myFold[_normTxt_(x)]) c++; }); frac = c / ns.length; }
    }
    if (!(frac > 0)) return;
    var share = giaTri * frac * (Number(o.saleRatio) || 1);
    totalOrders++; revenue += share;
    // THUONG THEO DON: don dat quy tac thi TIEN THUONG CHIA DEU cho cac sale tham gia (yeu cau Duyen 2026-10-08; thay cho
    // quy tac "chi nguoi tao" 2026-10-07). nSales = so sale tren don; moi nguoi nhan best.amount / nSales.
    var nSales = (o.saleShares && o.saleShares.length) ? o.saleShares.length
      : (String(o.saleBanValid || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).length || 1);
    var bInfo = _bcOrderInfo_(Object.assign({}, o, { giaTriDon: giaTri }), prodMap, orderOvr);
    mine.push({ date: o.baseNgayTao || _csYmdFromDmy_(o.ngayTaoDon), time: (String(o.ngayTaoDon || '').match(/(\d{1,2}):(\d{2})/) || [''])[0], giaTri: giaTri, share: share, nSales: nSales, sanPham: o.sanPham,
      goc: !hasGocField || !!o.donGoc, info: bInfo });
    var chR = channelRate(o.nguonDon);
    if (chR !== null) {
      ordCh++; revCh += share; commCh += share * chR / 100;
      var kk = String(o.nguonDon || '').trim();
      if (!chBreak[kk]) chBreak[kk] = { revenue: 0, rate: chR };
      chBreak[kk].revenue += share;
    } else if (giaTri >= T) { ordA++; revA += share; }
    else { ordB++; revB += share; }
  });
  var commA = revA * rateA / 100, commB = revB * rateB / 100;

  // 5) Thuong (port _computeBonusData_ cho 1 sale)
  var startYmd = (user && user.startDate) ? String(user.startDate) : '';
  var bonusItems = [], bonusTotal = 0;
  var byDay = {};
  mine.forEach(function(o) {
    if (!byDay[o.date]) byDay[o.date] = { date: o.date, revenue: 0, count: 0, first: null };
    var g = byDay[o.date];
    if (o.goc) g.revenue += o.share; // doanh so ngay = phan DOANH THU da chia cua sale, CHI don goc (ma bo dem sach, co tren Base+Pos), theo ngay tao Base
    g.count++;
    if (o.time && (g.first === null || o.time < g.first)) g.first = o.time;
  });
  Object.keys(byDay).forEach(function(k) {
    var g = byDay[k], bestTier = null, bestRev = null, bestFirst = null;
    programs.forEach(function(p) {
      if (!_csBonusApplies_(p, g.date, channel, startYmd)) return;
      if (p.revenue && p.revenue.enabled && p.revenue.scope === 'day') {
        var mn = (p.revenue.min !== '' && p.revenue.min != null) ? Number(p.revenue.min) : null;
        var mx = (p.revenue.max !== '' && p.revenue.max != null) ? Number(p.revenue.max) : null;
        if ((mn === null || g.revenue >= mn) && (mx === null || g.revenue <= mx)) {
          var amt = Number(p.bonusAmount) || 0;
          if (amt > 0 && (!bestRev || amt > bestRev.amount)) bestRev = { amount: amt, program: p, detail: 'Doanh số ngày ' + _csMoney_(g.revenue) };
        }
      }
      if (p.tier && p.tier.enabled && (p.tier.rows || []).length && g.count > 0) {
        var hit = null;
        p.tier.rows.slice().sort(function(a, b) { return Number(a.count) - Number(b.count); }).forEach(function(t) { if (g.count >= Number(t.count)) hit = t; });
        if (hit) {
          var amt2 = Number(hit.bonus) || 0;
          if (amt2 > 0 && (!bestTier || amt2 > bestTier.amount)) bestTier = { amount: amt2, program: p, detail: 'Đạt ' + g.count + ' đơn/ngày (bậc từ ' + hit.count + ' đơn)' };
        }
      }
      if (p.firstOrder && p.firstOrder.enabled && g.count > 0) {
        var amt3 = Number(p.firstOrder.amount) || 0;
        if (amt3 > 0 && (!bestFirst || amt3 > bestFirst.amount)) bestFirst = { amount: amt3, program: p, detail: 'Đơn đầu tiên trong ngày' + (g.first ? ' (lúc ' + g.first + ')' : '') };
      }
    });
    [[bestTier, 'Theo ngày (số đơn)'], [bestRev, 'Theo ngày (doanh số)'], [bestFirst, 'Theo ngày (đơn đầu tiên)']].forEach(function(pr) {
      if (!pr[0]) return;
      bonusTotal += pr[0].amount;
      bonusItems.push({ date: g.date, scope: pr[1], program: pr[0].program.name, amount: pr[0].amount, detail: pr[0].detail });
    });
  });
  mine.forEach(function(o) {
    var best = null;
    programs.forEach(function(p) {
      if (!_csBonusApplies_(p, o.date, channel, startYmd)) return;
      if (p.product && String(p.product).trim()) {
        var pq = _csBonusProductQty_(o.sanPham, p.product);
        if (pq.matched && pq.qty > 0) {
          var amt = (Number(p.bonusAmount) || 0) * pq.qty;
          if (amt > 0 && (!best || amt > best.amount)) best = { amount: amt, program: p, detail: 'SL ước tính: ' + pq.qty + ' — SP: "' + String(o.sanPham || '') + '"' };
        }
      }
      if (p.revenue && p.revenue.enabled && p.revenue.scope === 'order') {
        var mn = (p.revenue.min !== '' && p.revenue.min != null) ? Number(p.revenue.min) : null;
        var mx = (p.revenue.max !== '' && p.revenue.max != null) ? Number(p.revenue.max) : null;
        var isVongP = _bcIsVongProgram_(p), minSP = _bcMinProducts_(p), measured = o.giaTri, dtl = 'Giá trị đơn ' + _csMoney_(o.giaTri), okP = true;
        if (isVongP) { // Bill vong mix charm: moc tinh tren PHAN VONG + CHARM MIX (port y het js/12 _computeBonusData_)
          okP = o.info.hasVong && o.info.vongRev !== null;
          measured = o.info.vongRev; dtl = 'Phần vòng + charm mix ' + _csMoney_(o.info.vongRev || 0) + ' (đơn ' + _csMoney_(o.giaTri) + ')';
        } else {
          okP = _csRequireProductOk_(p, o.sanPham);
          var rk = _bcRequireKw_(p);
          if (rk && p.requireProduct === undefined) okP = _csRequireProductOk_({ requireProduct: rk }, o.sanPham);
          if (minSP > 0) { okP = okP && o.info.nProducts >= minSP; dtl += ' — ' + o.info.nProducts + ' sản phẩm'; }
        }
        if (okP && (mn === null || measured >= mn) && (mx === null || measured <= mx)) {
          var amt2 = Number(p.bonusAmount) || 0;
          if (amt2 > 0 && (!best || amt2 > best.amount)) best = { amount: amt2, program: p, detail: dtl };
        }
      }
    });
    if (best) {
      var n = o.nSales > 1 ? o.nSales : 1, part = Math.round(best.amount / n); // chia deu cho sale tham gia
      bonusTotal += part;
      bonusItems.push({ date: o.date, scope: 'Theo đơn', program: best.program.name, amount: part, detail: best.detail + (n > 1 ? ' — thưởng ' + _csMoney_(best.amount) + ' chia đều ' + n + ' sale' : '') });
    }
  });
  bonusItems.sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });

  // Chuong trinh thuong dang ap dung cho CS trong ky (de CS biet minh dang co chuong trinh nao)
  var activePrograms = programs.filter(function(p) {
    if (p.dateFrom && p.dateFrom > dateTo) return false;
    if (p.dateTo && p.dateTo < dateFrom) return false;
    return _csBonusApplies_(p, dateFrom, channel, '') || _csBonusApplies_(p, dateTo, channel, '') || !!(p.probationDay && p.probationDay.enabled);
  }).map(function(p) { return { name: p.name || '', dateFrom: p.dateFrom || '', dateTo: p.dateTo || '', summary: _csBonusSummary_(p) }; });

  // 6) Ty le chot (tu ty le chot theo Sale cua Bao cao B: so don chot / so khach tuong tac)
  var closeRate = null;
  (rep.saleCloseRate || []).forEach(function(r) {
    if (myFold[_normTxt_(r.name)]) {
      if (!closeRate) closeRate = { held: 0, closed: 0, rate: 0 };
      closeRate.held += Number(r.held) || 0; closeRate.closed += Number(r.closed) || 0;
    }
  });
  if (closeRate) closeRate.rate = closeRate.held ? Math.round(closeRate.closed / closeRate.held * 1000) / 10 : 0;

  return {
    ok: true, cs: cs, names: names, from: dateFrom, to: dateTo,
    totalOrders: totalOrders, revenue: Math.round(revenue),
    closeRate: closeRate,
    commission: {
      threshold: T, rateAbove15: rateA, rateBelow15: rateB, sourceAbove15: src(hasA, teamA), sourceBelow15: src(hasB, teamB),
      ordersAbove15: ordA, revenueAbove15: Math.round(revA), commissionAbove15: Math.round(commA),
      ordersBelow15: ordB, revenueBelow15: Math.round(revB), commissionBelow15: Math.round(commB),
      ordersChannel: ordCh, revenueChannel: Math.round(revCh), commissionChannel: Math.round(commCh), channelBreakdown: chBreak,
      total: Math.round(commA + commB + commCh)
    },
    bonus: { total: Math.round(bonusTotal), items: bonusItems, activePrograms: activePrograms },
    ghepLoi: (rep.ghep && rep.ghep.loi) ? rep.ghep.loi : ''
  };
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO C: SO SANH THEO KY (tuan/thang/quy/tuy chinh) — theo Nhan vien (Sale ban) & Kenh ban
//  Co doi chieu KPI/chi tieu (doc tu tab rieng KPI_ChiTieu, Duyen tu dien tay).
// ═══════════════════════════════════════════════════════════════

var KPI_SHEET = 'KPI_ChiTieu';

// Tao san tab KPI_ChiTieu (co huong dan + vi du) neu chua co — de Duyen tu dien chi tieu.
function ensureKPISheet_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(KPI_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(KPI_SHEET);
  var rows = [
    ['PeriodKey', 'LoaiDoiTuong', 'TenDoiTuong', 'KPI_ChiTieu', 'GhiChu'],
    ['2026-W35', 'sale', 'ngoctuoi2k3', 50000000, 'VÍ DỤ — tuần ISO: YYYY-Wnn (Thứ 2 → Chủ nhật). Xóa dòng ví dụ này.'],
    ['2026-08', 'sale', 'ngoctuoi2k3', 200000000, 'VÍ DỤ — tháng: YYYY-MM. Xóa dòng ví dụ này.'],
    ['2026-Q3', 'kenh', 'Tiktok', 500000000, 'VÍ DỤ — quý: YYYY-Qn (Q1..Q4). Xóa dòng ví dụ này.'],
    ['', '', '', '', 'LoaiDoiTuong chỉ nhận "sale" hoặc "kenh". TenDoiTuong phải gõ ĐÚNG y nguyên tên Sale bán / Kênh bán đang dùng trong DT TỔNG (phân biệt hoa/thường, khoảng trắng). Với kỳ "Tùy chỉnh" (2 khoảng ngày tự chọn) sẽ không tra được KPI vì không có PeriodKey cố định — chỉ áp dụng cho Tuần/Tháng/Quý.']
  ];
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  try { sh.autoResizeColumns(1, 5); } catch (ecw) {}
  return sh;
}

function readKPITargets_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(KPI_SHEET);
  if (!sh) { ensureKPISheet_(); sh = ss.getSheetByName(KPI_SHEET); }
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, 4).getValues();
  for (var i = 0; i < vals.length; i++) {
    var periodKey = String(vals[i][0] || '').trim();
    var entType = String(vals[i][1] || '').trim().toLowerCase();
    var entName = String(vals[i][2] || '').trim();
    var kpi = Number(vals[i][3]) || 0;
    if (!periodKey || !entType || !entName) continue;
    map[periodKey + '|' + entType + '|' + entName] = kpi;
  }
  return map;
}

function getKPI_(kpiMap, periodKey, entType, entName) {
  if (!periodKey) return 0;
  return kpiMap[periodKey + '|' + entType + '|' + entName] || 0;
}

// Thu 2 cua tuan chua ngay d (khong doi d truyen vao)
function _getMonday_(d) {
  // Tim dung Thu Hai cua tuan chua ngay duong lich VN cua d — tinh toan hoan toan bang UTC +
  // offset co dinh (qua _vnYmdParts_), KHONG dung .getDay()/.getDate() truc tiep cua d (phu
  // thuoc cau hinh Time Zone du an, cung nguyen nhan gay bug "nhay ngay" da gap).
  var p = _vnYmdParts_(d);
  var utcRep = new Date(Date.UTC(p.y, p.mo - 1, p.d)); // chi dung de doc thu trong tuan (getUTCDay doc dung, khong phu thuoc offset)
  var dow = utcRep.getUTCDay();
  var diff = (dow === 0 ? -6 : 1) - dow;
  var mp = new Date(Date.UTC(p.y, p.mo - 1, p.d + diff));
  return _vnMidnight_(mp.getUTCFullYear(), mp.getUTCMonth() + 1, mp.getUTCDate());
}
function _isoWeekRange_(baseDate, weekOffset) {
  var mon = _getMonday_(baseDate);
  // .setDate()/.getDate() o day CHI dung de CONG/TRU so ngay (khong doc ngay duong lich) —
  // an toan du may chu cau hinh Time Zone gi, vi Viet Nam khong co gio mua he nen +7 ngay luon
  // dung dung 7*24h bat ke mui gio nen la gi.
  mon.setDate(mon.getDate() + weekOffset * 7);
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: mon, to: sun };
}
function _isoWeekKey_(d) {
  var p = _vnYmdParts_(d);
  var dt = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  var dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return dt.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}
function _monthRange_(baseDate, monthOffset) {
  var p = _vnYmdParts_(baseDate);
  var y = p.y, m = (p.mo - 1) + monthOffset; // m la thang muc tieu, 0-index, truoc khi normalize nam
  var from = _vnMidnight_(y, m + 1, 1);
  var lastDayUtc = new Date(Date.UTC(y, m + 1, 0)); // ngay 0 cua thang ke tiep = ngay cuoi thang muc tieu
  var to = _vnMidnight_(lastDayUtc.getUTCFullYear(), lastDayUtc.getUTCMonth() + 1, lastDayUtc.getUTCDate());
  return { from: from, to: to };
}
function _monthKey_(d) { var p = _vnYmdParts_(d); return p.y + '-' + String(p.mo).padStart(2, '0'); }
function _quarterRange_(baseDate, quarterOffset) {
  var p = _vnYmdParts_(baseDate);
  var y = p.y, q = Math.floor((p.mo - 1) / 3) + quarterOffset;
  var yy = y + Math.floor(q / 4), qq = ((q % 4) + 4) % 4;
  var startMonth = qq * 3; // 0-index
  var from = _vnMidnight_(yy, startMonth + 1, 1);
  var lastDayUtc = new Date(Date.UTC(yy, startMonth + 3, 0));
  var to = _vnMidnight_(lastDayUtc.getUTCFullYear(), lastDayUtc.getUTCMonth() + 1, lastDayUtc.getUTCDate());
  return { from: from, to: to };
}
function _yearRange_(baseDate, yearOffset) {
  var p = _vnYmdParts_(baseDate);
  var y = p.y + yearOffset;
  return { from: _vnMidnight_(y, 1, 1), to: _vnMidnight_(y, 12, 31) };
}
function _yearKey_(d) { return String(_vnYmdParts_(d).y); }
function _quarterKey_(d) { var p = _vnYmdParts_(d); return p.y + '-Q' + (Math.floor((p.mo - 1) / 3) + 1); }
function _ymdLocal_(d) { return _vnYmd_(d); } // giu ten cu de khoi phai sua noi goi, tro thang ve ham VN chuan
function _labelVN_(d) {
  var p = _vnYmdParts_(d);
  return String(p.d).padStart(2, '0') + '/' + String(p.mo).padStart(2, '0') + '/' + p.y;
}

// Tinh khoang ngay + PeriodKey cua ky nay & ky truoc, tuy periodType.
function _resolvePeriods_(filters) {
  var today = new Date();
  var periodType = filters.periodType || 'week';
  var cur, prev, curKey = '', prevKey = '';

  if (periodType === 'week') {
    var wOff = Number(filters.weekOffset) || 0;
    cur = _isoWeekRange_(today, wOff);
    prev = _isoWeekRange_(today, wOff - 1);
    curKey = _isoWeekKey_(cur.from); prevKey = _isoWeekKey_(prev.from);
  } else if (periodType === 'month') {
    var mOff = Number(filters.monthOffset) || 0;
    cur = _monthRange_(today, mOff);
    prev = _monthRange_(today, mOff - 1);
    curKey = _monthKey_(cur.from); prevKey = _monthKey_(prev.from);
  } else if (periodType === 'quarter') {
    var qOff = Number(filters.quarterOffset) || 0;
    cur = _quarterRange_(today, qOff);
    prev = _quarterRange_(today, qOff - 1);
    curKey = _quarterKey_(cur.from); prevKey = _quarterKey_(prev.from);
  } else if (periodType === 'year') {
    var yOff = Number(filters.yearOffset) || 0;
    cur = _yearRange_(today, yOff);
    prev = _yearRange_(today, yOff - 1);
    curKey = _yearKey_(cur.from); prevKey = _yearKey_(prev.from);
  } else { // custom — 2 khoang ngay hoan toan tu chon, khong lien quan nhau, KHONG co PeriodKey KPI
    cur = { from: parseVNDate_(filters.customCurFrom) || today, to: parseVNDate_(filters.customCurTo) || today };
    prev = { from: parseVNDate_(filters.customPrevFrom) || today, to: parseVNDate_(filters.customPrevTo) || today };
    curKey = ''; prevKey = '';
  }
  return {
    curFrom: _ymdLocal_(cur.from), curTo: _ymdLocal_(cur.to), curKey: curKey, curLabel: _labelVN_(cur.from) + ' - ' + _labelVN_(cur.to),
    prevFrom: _ymdLocal_(prev.from), prevTo: _ymdLocal_(prev.to), prevKey: prevKey, prevLabel: _labelVN_(prev.from) + ' - ' + _labelVN_(prev.to)
  };
}

function buildSalesReportC_(filters) {
  filters = filters || {};
  var dateField = filters.dateField === 'thoiGianHT' ? 'thoiGianHT' : 'ngayTao';
  var per = _resolvePeriods_(filters);
  var kpiMap = readKPITargets_();
  var UNASSIGNED = '(chưa gán sale)';
  var saleFilterArr = Array.isArray(filters.sale) ? filters.sale.filter(function(s){return s;}) : [];
  var kenhFilterArr = Array.isArray(filters.kenh) ? filters.kenh.filter(function(s){return s;}) : [];
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);
  // Giong het quy uoc "Tinh theo nguoi tao don" cua buildSalesReportA_: tich thi tinh TRON VEN
  // ket qua cho DUNG 1 nguoi (cot "Người tạo" that su cua DT TONG), bo tich thi chia deu cho
  // tat ca sale dung ten tren don (mac dinh, giu nguyen hanh vi cu).
  var byCreator = !!filters.byCreator;

  var rows = readDTTong_();
  // Gom theo entity rieng cho tung ky (cur/prev), dung dung logic chia tien theo N sale/don
  // nhu buildSalesReportA_ (so don khong chia — o day khong can so don nen bo qua, chi lay tien).
  function aggregate(fromStr, toStr) {
    var bySale = {}, byKenh = {};
    var matchedOrders = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var dt = parseVNDate_(row[dateField]);
      if (!dateInRange_(dt, fromStr, toStr)) continue;
      if (_isExcludedOrderStatus_(row.trangThai)) continue; // bo don Huy/Tra lai/Hoan tien/Thai bai/Khieu nai (Quy che thu lao Sale)
      if (kenhFilterArr.length && kenhFilterArr.indexOf(row.kenhBan) === -1) continue;
      var salesOnRow = splitMulti_(row.saleBan, ',');
      if (saleFilterArr.length && !salesOnRow.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
      if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
      matchedOrders.push(row);
      var kName = row.kenhBan || '(chưa có kênh)';
      byKenh[kName] = (byKenh[kName] || 0) + row.giaTriDon;
      if (byCreator) {
        var creatorName = row.nguoiTao || UNASSIGNED;
        bySale[creatorName] = (bySale[creatorName] || 0) + row.giaTriDon;
      } else {
        var salesList = splitMulti_(row.saleBan, ',');
        if (salesList.length === 0) salesList = [UNASSIGNED];
        var n = salesList.length;
        for (var k = 0; k < salesList.length; k++) {
          bySale[salesList[k]] = (bySale[salesList[k]] || 0) + row.giaTriDon / n;
        }
      }
    }
    return { bySale: bySale, byKenh: byKenh, orders: matchedOrders };
  }

  var curAgg = aggregate(per.curFrom, per.curTo);
  var prevAgg = aggregate(per.prevFrom, per.prevTo);

  function buildTable(curMap, prevMap, entType) {
    var names = Object.keys(Object.assign({}, curMap, prevMap));
    var out = names.map(function(name) {
      var resultCur = curMap[name] || 0;
      var resultPrev = prevMap[name] || 0;
      var kpiCur = getKPI_(kpiMap, per.curKey, entType, name);
      var kpiPrev = getKPI_(kpiMap, per.prevKey, entType, name);
      var pctKpiCur = kpiCur > 0 ? (resultCur / kpiCur * 100) : null;
      var pctKpiPrev = kpiPrev > 0 ? (resultPrev / kpiPrev * 100) : null;
      var growthPct = resultPrev > 0 ? ((resultCur - resultPrev) / resultPrev * 100) : (resultCur > 0 ? null : 0);
      return {
        name: name, kpiPrev: kpiPrev, resultPrev: resultPrev, pctKpiPrev: pctKpiPrev,
        kpiCur: kpiCur, resultCur: resultCur, pctKpiCur: pctKpiCur, growthPct: growthPct
      };
    });
    out.sort(function(a, b) { return b.resultCur - a.resultCur; });
    return out;
  }

  var mapOrder = function(o) {
    return { ngayTao: o.ngayTao, thoiGianHT: o.thoiGianHT, kenhBan: o.kenhBan, saleBan: o.saleBan,
             sanPham: o.sanPham, giaTriCoc: o.giaTriCoc, giaTriDon: o.giaTriDon, giaiDoan: o.giaiDoan,
             trangThai: o.trangThai, id: o.id };
  };

  return {
    period: per,
    byEmployee: buildTable(curAgg.bySale, prevAgg.bySale, 'sale'),
    byKenh: buildTable(curAgg.byKenh, prevAgg.byKenh, 'kenh'),
    ordersCur: curAgg.orders.map(mapOrder),
    ordersPrev: prevAgg.orders.map(mapOrder)
  };
}

// ── BAO CAO D: KH "Chăm sóc" thêm nhanh (sheet rieng, KHONG gop bao cao A/B/C) ──
function buildCareLeadReport_(filters) {
  filters = filters || {};
  var csFilterArr = Array.isArray(filters.cs) ? filters.cs.filter(function(s){return s;})
    : (filters.cs ? [String(filters.cs).trim()] : []);
  var rows = readCareLeads_();
  var matched = rows.filter(function(r) {
    var dt = r.createdAt ? new Date(r.createdAt) : null;
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) return false;
    if (csFilterArr.length && csFilterArr.indexOf(String(r.cs||'')) === -1) return false;
    return true;
  });
  var byCS = {};
  matched.forEach(function(r) {
    var name = r.cs || '(chưa gán)';
    byCS[name] = (byCS[name] || 0) + 1;
  });
  var byCSArr = Object.keys(byCS).map(function(k) { return { name: k, count: byCS[k] }; });
  byCSArr.sort(function(a, b) { return b.count - a.count; });
  return { total: matched.length, byCS: byCSArr, rows: matched };
}


// ═══════════════════════════════════════════════════════════════
//  THUONG PHAT DOI SALE ONLINE + VAN PHONG (Phong kinh doanh) — Duyen yeu cau 2026-10-29. HIEN THI TRONG BAO CAO B, TACH RIENG cac chuong trinh thuong cua cong ty.
//  THUONG (tu dong, tinh tren DON GOC BASE — DT TONG theo NGAY TAO, KHONG tinh tren Pos vi Pos co the lech ngay):
//    (1) Sale nhieu don nhat TRONG NGAY, toi thieu 6 don, khong tinh don doi tra / bao hanh / thay day: 50k. (2) Top ty le chot TUAN (Thu 2 - Chu nhat): 50k.
//    (3) Top ty le chot THANG: 100k. (2)+(3) chi xet sale co so tuong tac trong ky >= tuong tac trung binh cua team. Ty le chot dung CUNG ham voi Bao cao A/B
//    (_srCloseRateSectionsFromBase_: don Base / tuong tac Pancake) nen ra cung so.
//  PHAT (nhap tay, vi du lieu nhan tin/bao cao khong co trong he thong): 5 loai — luu o sheet 'ThuongPhatDoiSale'. Chi admin ghi/xoa.
//  Doi sale = ten xep nhom Online/Van phong trong saleChannels. Ngay/tuan/thang theo gio Viet Nam. Tuan tinh vao THANG chua ngay Chu nhat cua tuan do.
//  So tien va quy tac luu o Settings 'teamBonusCfg' (JSON, thieu khoa thi lay mac dinh ben duoi).
// ═══════════════════════════════════════════════════════════════
var TEAM_BONUS_SECTION_ = 1;
var SH_TEAM_PENALTY_ = 'ThuongPhatDoiSale';
var TEAM_PENALTY_HEADERS_ = ['id', 'date', 'sale', 'type', 'amount', 'note', 'by', 'at'];
var TEAMBONUS_GET_ACTIONS_ = { teamBonusReport: 1, teamPenaltySuggest: 1 };
var TEAMBONUS_POST_ACTIONS_ = { teamPenaltySave: 1, teamPenaltyDelete: 1, teamPenaltyIgnore: 1 };
var TEAM_BONUS_DEFAULT_ = {
  dailyMinOrders: 6, dailyReward: 50000, weeklyReward: 50000, monthlyReward: 100000,
  excludeRe: 'doi tra|doi hang|bao hanh|thay day',   // so khop KHONG DAU voi Phan loai / Kenh ban / Giai doan cua don Base (don bhZero = BH khong doanh thu luon bi loai)
  penalties: [
    { type: 1, label: 'Tin trôi quá 30 phút không phản hồi (không phải tin nhảy từ Sale khác)', amount: 50000 },
    { type: 2, label: 'Không gửi báo cáo đúng khung giờ (sáng trước 9h30, chiều 13h30, kết thúc ca, tối 20h nếu bật tin)', amount: 50000 },
    { type: 3, label: 'Đã đọc nhưng không phản hồi', amount: 50000 },
    { type: 4, label: 'Đơn gộp Sale bán chung trong 72 giờ: Sale lên đơn không chia doanh thu cho các Sale cùng tham gia', amount: 200000 },
    { type: 5, label: 'Nhắn tin khai thác mong cầu trong 15 phút nhưng không gửi kèm từ 04 hình ảnh hoặc ghi âm', amount: 50000 }
  ]
};
function teamBonusCfg_() {
  var cfg = JSON.parse(JSON.stringify(TEAM_BONUS_DEFAULT_)), raw = null;
  try { raw = _csJsonSetting_('teamBonusCfg', null); } catch (e) {}
  if (raw && typeof raw === 'object') {
    ['dailyMinOrders', 'dailyReward', 'weeklyReward', 'monthlyReward'].forEach(function (k) { var n = Number(raw[k]); if (isFinite(n) && n >= 0) cfg[k] = n; });
    if (typeof raw.excludeRe === 'string' && raw.excludeRe.trim()) cfg.excludeRe = raw.excludeRe.trim();
    if (Array.isArray(raw.penalties)) raw.penalties.forEach(function (pn) {
      var t = Number(pn && pn.type), n = Number(pn && pn.amount);
      cfg.penalties.forEach(function (d) { if (d.type === t) { if (isFinite(n) && n >= 0) d.amount = n; if (pn.label) d.label = String(pn.label).slice(0, 200); } });
    });
  }
  return cfg;
}
function _tbPad_(n) { return (n < 10 ? '0' : '') + n; }
function _tbYmdAdd_(ymd, n) { var q = ymd.split('-'), d = new Date(Date.UTC(+q[0], +q[1] - 1, +q[2] + n)); return d.getUTCFullYear() + '-' + _tbPad_(d.getUTCMonth() + 1) + '-' + _tbPad_(d.getUTCDate()); }
function _tbDow_(ymd) { var q = ymd.split('-'); return (new Date(Date.UTC(+q[0], +q[1] - 1, +q[2])).getUTCDay() + 6) % 7; }   // Thu 2 = 0 ... Chu nhat = 6
function _tbMonthEnd_(ym) { var q = ym.split('-'); return ym + '-' + _tbPad_(new Date(Date.UTC(+q[0], +q[1], 0)).getUTCDate()); }
function _tbFmtDm_(ymd) { var q = ymd.split('-'); return q[2] + '/' + q[1]; }
// Doi sale: [{name, group, aliases}] (online/offline trong saleChannels, moi nguoi 1 dong) + memberOf[tenChuanHoa] = ten dai dien.
function _tbTeam_() {
  var chan = _csJsonSetting_('saleChannels', {}), id = _salePersonIdentity_(), team = [], seen = {}, memberOf = {};
  if (!chan || typeof chan !== 'object') chan = {};
  Object.keys(chan).forEach(function (n) {
    var g = String(chan[n] || '');
    if (g !== 'online' && g !== 'offline') return;
    var k = id.key(n); if (!k || seen[k]) return; seen[k] = 1;
    var al = id.members(n); try { al = al.concat(_expandSaleFilterWithPancakeAliases_([n])); } catch (e) {}
    var m = { name: String(n).trim(), group: g, aliases: al };
    team.push(m);
    al.concat([n]).forEach(function (a) { var ak = _normTxt_(a); if (ak && !memberOf[ak]) memberOf[ak] = m.name; });
  });
  team.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  return { list: team, memberOf: memberOf };
}
// Don Base duoc tinh vao "so don thuong ngay"? Bo: huy/hoan, BH khong doanh thu, doi tra / bao hanh / thay day.
function _tbOrderCounts_(r, re) {
  if (r.bhZero || _isExcludedOrderStatus_(r.trangThai)) return false;
  if (_dtIsExchangeOrder_(r.phanLoai)) return false;
  var blob = _stripVN_([r.phanLoai, r.kenhBan, r.giaiDoan].join(' ')).toLowerCase();
  if (re.test(blob)) return false;
  return true;
}
// Dem don theo ngay + theo sale doi (moi sale ghi o "Sale ban" +1 don, dung cach 'saleban' cua ty le chot). Tra { 'yyyy-MM-dd': { counts:{ten:n}, total:n, excluded:n } }
function _tbDailyCounts_(dtRows, from, to, memberOf, cfg) {
  var re; try { re = new RegExp(cfg.excludeRe, 'i'); } catch (e) { re = new RegExp(TEAM_BONUS_DEFAULT_.excludeRe, 'i'); }
  var out = {};
  for (var i = 0; i < dtRows.length; i++) {
    var r = dtRows[i], dt = parseVNDate_(r.ngayTao); if (!dt) continue;
    var ymd = _vnYmd_(dt); if (ymd < from || ymd > to) continue;
    var day = out[ymd] || (out[ymd] = { counts: {}, total: 0, excluded: 0 });
    if (!_tbOrderCounts_(r, re)) { day.excluded++; continue; }
    var seen = {}, any = false;
    splitMulti_(r.saleBan ? String(r.saleBan).trim() : '', ',').filter(function (x) { return x && !_isNumericTag_(x); }).forEach(function (n) {
      var m = memberOf[_normTxt_(n)]; if (!m || seen[m]) return; seen[m] = 1; any = true;
      day.counts[m] = (day.counts[m] || 0) + 1;
    });
    if (any) day.total++;
  }
  return out;
}
// Chon top ty le chot trong 1 ky tu dong "saleCloseRate" (held = tuong tac, closed = don Base, closeRate %).
function _tbPickClose_(rows, memberOf) {
  var mem = {};
  (rows || []).forEach(function (r) {
    var m = memberOf[_normTxt_(r.name)]; if (!m) return;
    var o = mem[m] || (mem[m] = { name: m, held: 0, closed: 0 });
    o.held += Number(r.held) || 0; o.closed += Number(r.closed) || 0;
  });
  var list = Object.keys(mem).map(function (k) { return mem[k]; }).filter(function (x) { return x.held > 0; });
  var sumHeld = 0; list.forEach(function (x) { sumHeld += x.held; });
  var avg = list.length ? sumHeld / list.length : 0;
  list.forEach(function (x) { x.closeRate = Math.round(x.closed / x.held * 1000) / 10; x.eligible = x.held >= avg; });
  list.sort(function (a, b) { return b.closeRate - a.closeRate || b.closed - a.closed || (a.name < b.name ? -1 : 1); });
  var el = list.filter(function (x) { return x.eligible && x.closed > 0; }), winners = [];
  if (el.length) winners = el.filter(function (x) { return x.closeRate === el[0].closeRate && x.closed === el[0].closed; });   // dong hang (cung ty le + cung so don) cung nhan
  return { avgHeld: Math.round(avg * 10) / 10, rows: list, winners: winners };
}
function _tbCloseFor_(dtRows, from, to, memberOf) {
  try {
    var sec = _srCloseRateSectionsFromBase_({ dateFrom: from, dateTo: to }, dtRows);
    var pick = _tbPickClose_(sec && sec.saleCloseRate, memberOf);
    pick.noData = !(sec && sec.saleCloseRate && sec.saleCloseRate.length);
    return pick;
  } catch (e) { Logger.log('_tbCloseFor_ ' + from + '..' + to + ': ' + e); return { avgHeld: 0, rows: [], winners: [], noData: true, error: String(e && e.message || e) }; }
}
// Phan THUONG (cache 10 phut; thang da qua cache lau hon). Nhat ky phat doc truc tiep, khong qua cache.
function _tbComputeRewards_(month, cfg) {
  var today = _vnYmd_(new Date()), from = month + '-01', mEnd = _tbMonthEnd_(month), to = mEnd < today ? mEnd : today;
  var team = _tbTeam_(), dtRows = readDTTong_(true), out = { daily: [], weekly: [], monthly: null, team: team.list.map(function (m) { return { name: m.name, group: m.group }; }) };
  var dc = _tbDailyCounts_(dtRows, from, to, team.memberOf, cfg);
  for (var d = from; d <= to; d = _tbYmdAdd_(d, 1)) {
    var day = dc[d] || { counts: {}, total: 0, excluded: 0 };
    var arr = Object.keys(day.counts).map(function (k) { return { name: k, orders: day.counts[k] }; }).sort(function (a, b) { return b.orders - a.orders || (a.name < b.name ? -1 : 1); });
    var top = arr.length ? arr[0].orders : 0, ok = top >= cfg.dailyMinOrders;
    out.daily.push({ date: d, partial: d === today, top: top, qualified: ok, winners: ok ? arr.filter(function (x) { return x.orders === top; }) : [], list: arr.slice(0, 8), excluded: day.excluded });
  }
  // Tuan: Thu 2 -> Chu nhat; tinh vao thang chua ngay Chu nhat. Tuan chua ket thuc / chua bat dau xu ly theo "to".
  var mon = from; while (_tbDow_(mon) !== 0) mon = _tbYmdAdd_(mon, -1);
  for (; mon <= mEnd; mon = _tbYmdAdd_(mon, 7)) {
    var sun = _tbYmdAdd_(mon, 6);
    if (sun < from || sun > mEnd) continue;           // chi tuan ket thuc (Chu nhat) trong thang
    if (mon > today) continue;
    var eff = sun < today ? sun : today, pk = _tbCloseFor_(dtRows, mon, eff, team.memberOf);
    out.weekly.push({ from: mon, to: sun, effTo: eff, partial: sun > today, label: _tbFmtDm_(mon) + ' – ' + _tbFmtDm_(sun), avgHeld: pk.avgHeld, rows: pk.rows, winners: pk.winners, noData: !!pk.noData });
  }
  var pm = _tbCloseFor_(dtRows, from, to, team.memberOf);
  out.monthly = { from: from, to: mEnd, effTo: to, partial: mEnd > today, avgHeld: pm.avgHeld, rows: pm.rows, winners: pm.winners, noData: !!pm.noData };
  return out;
}
function _tbReadPenalties_(from, to) {
  var sh = getSheet_(SH_TEAM_PENALTY_, TEAM_PENALTY_HEADERS_), last = sh.getLastRow(), out = [];
  if (last < 2) return out;
  var v = sh.getRange(2, 1, last - 1, TEAM_PENALTY_HEADERS_.length).getValues();
  for (var i = 0; i < v.length; i++) {
    var ymd = v[i][1] instanceof Date ? _vnYmd_(v[i][1]) : String(v[i][1] || '').trim();
    if (!v[i][0] || !ymd || ymd < from || ymd > to) continue;
    out.push({ id: String(v[i][0]), date: ymd, sale: String(v[i][2] || ''), type: Number(v[i][3]) || 0, amount: Number(v[i][4]) || 0, note: String(v[i][5] || ''), by: String(v[i][6] || ''), at: String(v[i][7] || '') });
  }
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}
function _tbAccess_(token) {
  var u = token ? _sessUser_(token) : null;
  if (!u) return { ok: false, code: 'AUTH', error: 'Can dang nhap (tai khoan that) de xem thuong phat doi Sale.' };
  var base = _roleBase_(u.role);
  return { ok: true, u: u, admin: u.role === 'admin', seeAll: u.role === 'admin' || base === 'viewer' || base === 'manager' || base === 'leader' };
}
function teamBonusReport_(p, acc) {
  var month = String(p.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) month = _vnYmd_(new Date()).substring(0, 7);
  var cfg = teamBonusCfg_(), today = _vnYmd_(new Date()), mEnd = _tbMonthEnd_(month);
  var ck = 'tb_rw_v1_' + month + '_' + JSON.stringify([cfg.dailyMinOrders, cfg.excludeRe]), rw = null;
  try { var raw = _cacheGetBig_(ck); if (raw) rw = JSON.parse(raw); } catch (e0) {}
  if (!rw || p.nocache === '1') {
    rw = _tbComputeRewards_(month, cfg);
    try { _cachePutBig_(ck, JSON.stringify(rw), mEnd < today ? 3600 : 600); } catch (e1) {}
  }
  var pen = _tbReadPenalties_(month + '-01', mEnd);
  // Danh sach thuong chi tiet + tong theo sale
  var rewards = [], totals = {};
  function tot(n) { return totals[n] || (totals[n] = { name: n, reward: 0, penalty: 0, net: 0, dayWins: 0, weekWins: 0, monthWins: 0, penaltyCount: 0 }); }
  rw.team.forEach(function (m) { tot(m.name); });
  rw.daily.forEach(function (d) { if (d.partial) return; d.winners.forEach(function (w) { rewards.push({ kind: 'day', period: d.date, name: w.name, amount: cfg.dailyReward, detail: w.orders + ' đơn' }); var t = tot(w.name); t.reward += cfg.dailyReward; t.dayWins++; }); });
  rw.weekly.forEach(function (w) { if (w.partial) return; w.winners.forEach(function (x) { rewards.push({ kind: 'week', period: w.label, name: x.name, amount: cfg.weeklyReward, detail: x.closeRate + '% (' + x.closed + '/' + x.held + ')' }); var t = tot(x.name); t.reward += cfg.weeklyReward; t.weekWins++; }); });
  if (rw.monthly && !rw.monthly.partial) rw.monthly.winners.forEach(function (x) { rewards.push({ kind: 'month', period: month, name: x.name, amount: cfg.monthlyReward, detail: x.closeRate + '% (' + x.closed + '/' + x.held + ')' }); var t = tot(x.name); t.reward += cfg.monthlyReward; t.monthWins++; });
  pen.forEach(function (e) { var t = tot(e.sale); t.penalty += e.amount; t.penaltyCount++; });
  // Nguoi khong phai admin/quan ly/truong team chi thay phat + tong cua chinh minh (thuong ngay/tuan/thang la bang xep hang chung).
  var mine = {}; _profNames_(acc.u).forEach(function (n) { mine[_normTxt_(n)] = 1; });
  if (!acc.seeAll) {
    pen = pen.filter(function (e) { return mine[_normTxt_(e.sale)]; });
    Object.keys(totals).forEach(function (k) { if (!mine[_normTxt_(k)]) delete totals[k]; });
  }
  var totalList = Object.keys(totals).map(function (k) { var t = totals[k]; t.net = t.reward - t.penalty; return t; }).sort(function (a, b) { return b.net - a.net || (a.name < b.name ? -1 : 1); });
  return { ok: true, month: month, today: today, cfg: cfg, canEdit: acc.admin, seeAll: acc.seeAll, team: rw.team, daily: rw.daily, weekly: rw.weekly, monthly: rw.monthly,
    rewards: rewards, penalties: pen, totals: totalList, note: 'Thuong tinh tren don goc Base (ngay tao), khong tinh theo Pos. Tuan tinh vao thang chua Chu nhat; ngay/tuan/thang chua ket thuc chi hien tam tinh, chua cong vao tien thuong.' };
}
function teamBonusDoGet_(action, p) {
  try {
    var acc = _tbAccess_(p && p.token); if (!acc.ok) return jsonOut_(acc);
    if (action === 'teamPenaltySuggest') return acc.admin ? jsonOut_(teamPenaltySuggest_(p, acc)) : jsonOut_({ ok: false, code: 'FORBIDDEN', error: 'Chi admin xem goi y phat.' });
    return jsonOut_(teamBonusReport_(p, acc));
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi thuong phat doi Sale: ' + (err && err.message || err) }); }
}
function teamBonusDoPost_(action, d) {
  try {
    var acc = _tbAccess_(d && d.token); if (!acc.ok) return jsonOut_(acc);
    if (!acc.admin) return jsonOut_({ ok: false, code: 'FORBIDDEN', error: 'Chi admin duoc ghi/xoa nhat ky phat.' });
    var lock = LockService.getScriptLock(); try { lock.waitLock(15000); } catch (eL) { return jsonOut_({ ok: false, error: 'He thong dang ban, thu lai sau it giay.' }); }
    try {
      var sh = getSheet_(SH_TEAM_PENALTY_, TEAM_PENALTY_HEADERS_), by = String(acc.u.name || acc.u.username || ''), at = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');
      try { sh.getRange('B:B').setNumberFormat('@'); } catch (eF) {}
      if (action === 'teamPenaltyIgnore') return teamPenaltyIgnore_(d);
      if (action === 'teamPenaltyDelete') {
        var id = String(d.id || '').trim(), last = sh.getLastRow();
        if (!id || last < 2) return jsonOut_({ ok: false, error: 'Khong co dong de xoa.' });
        var ids = sh.getRange(2, 1, last - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) { sh.deleteRow(i + 2); return jsonOut_({ ok: true, id: id }); }
        return jsonOut_({ ok: false, error: 'Khong tim thay dong phat nay (co the da xoa).' });
      }
      var cfg = teamBonusCfg_(), type = Number(d.type), ymd = String(d.date || '').trim(), sale = String(d.sale || '').trim();
      var def = null; cfg.penalties.forEach(function (x) { if (x.type === type) def = x; });
      if (!def) return jsonOut_({ ok: false, error: 'Loai phat khong hop le (1-5).' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return jsonOut_({ ok: false, error: 'Ngay khong hop le (yyyy-mm-dd).' });
      if (!sale) return jsonOut_({ ok: false, error: 'Chua chon sale.' });
      var tm = _tbTeam_(); sale = tm.memberOf[_normTxt_(sale)] || sale;
      var amount = (d.amount === '' || d.amount == null) ? NaN : Number(d.amount); if (!isFinite(amount) || amount < 0) amount = def.amount;   // de trong = so tien mac dinh cua loai phat
      var note = String(d.note == null ? '' : d.note).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, 300);
      var eid = String(d.id || '').trim();
      if (eid) {   // sua dong co san
        var last2 = sh.getLastRow(), ids2 = last2 >= 2 ? sh.getRange(2, 1, last2 - 1, 1).getValues() : [];
        for (var j = 0; j < ids2.length; j++) if (String(ids2[j][0]) === eid) { sh.getRange(j + 2, 1, 1, TEAM_PENALTY_HEADERS_.length).setValues([[eid, ymd, sale, type, amount, note, by, at]]); return jsonOut_({ ok: true, id: eid, sale: sale, amount: amount }); }
        return jsonOut_({ ok: false, error: 'Khong tim thay dong de sua.' });
      }
      var nid = 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      sh.appendRow([nid, ymd, sale, type, amount, note, by, at]);
      return jsonOut_({ ok: true, id: nid, sale: sale, amount: amount });
    } finally { try { lock.releaseLock(); } catch (eU) {} }
  } catch (err) { return jsonOut_({ ok: false, error: 'Loi ghi phat doi Sale: ' + (err && err.message || err) }); }
}

// ── GOI Y PHAT TU DONG tu tin nhan Pancake (Duyen 2026-10-31): CHI GOI Y, Admin duyet moi ghi vao Nhat ky phat; tinh ca ngay dem. ──
// Loai 1 "Tin troi qua 30 phut khong phan hoi": tin khach (direction 'in') cho lau hon 30 phut moi co tin tra loi ('out'), hoac den gio van chua tra loi (chua doc).
// Loai 3 "Da doc nhung khong phan hoi": hoi thoai da doc (seen) nhung chua tra loi qua 30 phut. Chi xet hoi thoai INBOX (khong tinh binh luan).
// GIOI HAN DA BIET (admin xem xet truoc khi ghi): (a) khong phan biet duoc "tin nhay tu Sale khac" (chuyen hoi thoai) — Pancake khong gui co nay; (b) ten nhan vien tra loi
// la ten Pancake co the thieu (xem docs/PANCAKE-INBOX.md) nen sale co the de trong de Admin chon; (c) tra loi tu dong (chatbot) van tinh la da tra loi.
var TB_MSG_SCAN_MAX_ROWS_ = 6000;
function _tbScanMsgs_(rows, nowMs, endMs, thrMin, staffNames, memberOf) {
  var by = {};
  (rows || []).forEach(function (r) {
    var t = Date.parse(r && r.sent_at); if (!r || !r.conversation_id || !isFinite(t)) return;
    var c = r.pk_conversations || {}; if (String(c.conv_type || 'INBOX').toUpperCase() === 'COMMENT') return;
    (by[r.conversation_id] || (by[r.conversation_id] = { conv: c, msgs: [] })).msgs.push({ t: t, dir: String(r.direction || ''), staff: String(r.crm_user || r.staff_name || '').trim() });
  });
  var out = [], cut = Math.min(nowMs, endMs);
  function who(name) { var k = _normTxt_(name); return (k && memberOf[k]) || ''; }
  function iso(t) { return new Date(t).toISOString().slice(0, 16); }
  Object.keys(by).forEach(function (cid) {
    var g = by[cid], c = g.conv; g.msgs.sort(function (a, b) { return a.t - b.t; });
    var pend = null, cust = String(c.customer_name || ''), ph = String(c.customer_phone || '');
    var ass = []; (c.assignee_ids || []).forEach(function (id) { var n = staffNames[String(id)]; if (n) ass.push(n); });
    g.msgs.forEach(function (m) {
      if (m.dir === 'in') { if (pend === null) pend = m.t; }
      else if (m.dir === 'out' && pend !== null) {
        var gap = (m.t - pend) / 60000;
        if (gap > thrMin) out.push({ key: 'm:' + cid + ':' + iso(pend), type: 1, convId: cid, customer: cust, phone: ph, inAt: new Date(pend).toISOString(), outAt: new Date(m.t).toISOString(), gapMin: Math.round(gap), open: false, sale: who(m.staff), saleRaw: m.staff, page: c.page_id || '' });
        pend = null;
      }
    });
    if (pend !== null && !(c.is_replied === true)) {
      var gap2 = (cut - pend) / 60000;
      if (gap2 > thrMin) {
        var sr = ass.join(', '), sl = ''; ass.forEach(function (n) { if (!sl) sl = who(n); });
        out.push({ key: 'm:' + cid + ':' + iso(pend), type: c.seen === true ? 3 : 1, convId: cid, customer: cust, phone: ph, inAt: new Date(pend).toISOString(), outAt: null, gapMin: Math.round(gap2), open: true, sale: sl, saleRaw: sr, page: c.page_id || '' });
      }
    }
  });
  out.sort(function (a, b) { return b.gapMin - a.gapMin; });
  return out;
}
// Doc tin 1 ngay (gio VN) tu Supabase theo trang 1000 dong. Tra { rows, truncated }.
function _tbReadDayMsgs_(ymd) {
  var from = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) - VN_OFFSET_MS), to = new Date(from.getTime() + 86400000);
  var sel = 'conversation_id,direction,sent_at,staff_name,crm_user,pk_conversations(conv_type,customer_name,customer_phone,seen,is_replied,assignee_ids,page_id)';
  var base = 'pk_messages?select=' + sel + '&sent_at=gte.' + _pkEnc_(from.toISOString()) + '&sent_at=lt.' + _pkEnc_(to.toISOString()) + '&order=sent_at.asc', rows = [], off = 0, truncated = false;
  for (;;) {
    var page = sb_('GET', base + '&limit=1000&offset=' + off).json || [];
    rows = rows.concat(page);
    if (page.length < 1000) break;
    off += 1000;
    if (rows.length >= TB_MSG_SCAN_MAX_ROWS_) { truncated = true; break; }
  }
  return { rows: rows, truncated: truncated, endMs: to.getTime() };
}
function _tbIgnored_() { try { var a = JSON.parse(getSetting_('tbPenIgnore') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
// GET teamPenaltySuggest&date=yyyy-mm-dd (Admin): danh sach goi y, da loai nhung dong da ghi phat (ghi chu co [pk:<key>]) va nhung dong da bo qua.
function teamPenaltySuggest_(p, acc) {
  var ymd = String(p.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) ymd = _vnYmd_(new Date());
  var ck = 'tb_sg_v1_' + ymd, hit = null;
  try { var raw = _cacheGetBig_(ck); if (raw) hit = JSON.parse(raw); } catch (e0) {}
  if (!hit || p.nocache === '1') {
    var day = _tbReadDayMsgs_(ymd), tm = _tbTeam_();
    hit = { items: _tbScanMsgs_(day.rows, Date.now(), day.endMs, 30, _pkStaffNames_(), tm.memberOf), truncated: day.truncated, scanned: day.rows.length };
    try { _cachePutBig_(ck, JSON.stringify(hit), 600); } catch (e1) {}
  }
  var done = {}, ig = {}; _tbReadPenalties_(ymd.slice(0, 8) + '01', _tbMonthEnd_(ymd.slice(0, 7))).forEach(function (e) { var m = /\[pk:([^\]]+)\]/.exec(e.note || ''); if (m) done[m[1]] = 1; });
  _tbIgnored_().forEach(function (k) { ig[k] = 1; });
  var items = hit.items.filter(function (x) { return !done[x.key] && !ig[x.key]; }).slice(0, 300);
  return { ok: true, date: ymd, items: items, hidden: hit.items.length - items.length, truncated: !!hit.truncated, scanned: hit.scanned, note: 'Chi la GOI Y tu du lieu Pancake. Admin kiem tra roi moi ghi phat; khong phan biet duoc tin nhay tu Sale khac.' };
}
function teamPenaltyIgnore_(d) {
  var key = String(d.key || '').trim(); if (!/^m:[A-Za-z0-9_\-:.]{1,120}$/.test(key)) return jsonOut_({ ok: false, error: 'Khoa khong hop le.' });
  var a = _tbIgnored_(); if (a.indexOf(key) < 0) a.push(key); if (a.length > 1500) a = a.slice(a.length - 1500);
  setSetting_('tbPenIgnore', JSON.stringify(a));
  return jsonOut_({ ok: true, key: key });
}

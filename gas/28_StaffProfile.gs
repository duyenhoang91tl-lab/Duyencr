// ═══════════════════════════════════════════════════════════════
//  HO SO NHAN VIEN (yeu cau Duyen 12/10/2026)
//  Moi nhan vien tu cap nhat ho so (ho ten, SDT, email, link Facebook); admin sua ho; quan ly/leader xem ho so + tong quan ket qua lam viec.
//  Luu o sheet "StaffProfiles" (tu tao). Moi action doi chieu TOKEN PHIEN (_sessUser_), KHONG tin username client gui.
//  Tong quan DUNG CHUNG nguon voi bao cao (khong tinh lai logic): don/doanh thu/hoa hong/thuong = buildCsStats_ (Bao cao B + cau hinh hoa hong/thuong);
//  xep hang theo doanh thu = posMetrics_ (khop B/G); ty le chot + ty le ket noi SDT = buildTeamMetrics_ (KPI Pancake: tongTT, sdtMangVe, tyLeChot);
//  phong kinh doanh = nhom KPI Sale (deptKey); team = sheet Teams. So khach dang giu / da ket ban do CLIENT dem (cung pham vi voi "Data cua toi").
// ═══════════════════════════════════════════════════════════════
var SH_PROFILE = 'StaffProfiles';
var PROFILE_HEADERS = ['username', 'fullName', 'phone', 'email', 'facebook', 'updatedAt', 'updatedBy'];

// Lam sach + kiem tra 1 ho so. Tra { ok, error, profile }. Chan ky tu mo dau cong thuc Sheets (= + - @) o ho ten.
function _profClean_(p) {
  p = p || {};
  var err = [];
  var fullName = String(p.fullName == null ? '' : p.fullName).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (fullName.length > 80) err.push('Họ tên tối đa 80 ký tự.');
  if (/^[=+\-@]/.test(fullName)) err.push('Họ tên không được bắt đầu bằng = + - @.');
  var phone = String(p.phone == null ? '' : p.phone).replace(/[\s.\-()]/g, '');
  if (phone && !/^\+?\d{8,15}$/.test(phone)) err.push('Số điện thoại không hợp lệ (8–15 chữ số).');
  var email = String(p.email == null ? '' : p.email).trim();
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) err.push('Email không hợp lệ.');
  var fb = String(p.facebook == null ? '' : p.facebook).trim();
  if (fb) {
    if (!/^https?:\/\//i.test(fb)) fb = 'https://' + fb;
    if (fb.length > 300 || /\s/.test(fb) || !/^https?:\/\/([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me|fb\.watch)(\/|\?|#|$)/i.test(fb)) err.push('Link Facebook không hợp lệ (dạng https://facebook.com/ten-ban).');
  }
  if (err.length) return { ok: false, error: err.join(' ') };
  return { ok: true, profile: { fullName: fullName, phone: phone, email: email, facebook: fb } };
}
function _profFindUser_(users, username) {
  var un = String(username || '').trim().toLowerCase();
  for (var i = 0; i < (users || []).length; i++) if (String(users[i].username || '').trim().toLowerCase() === un) return users[i];
  return null;
}
function _profNames_(u) {
  var out = [];
  (u && u.names || []).concat([u && u.name, u && u.username]).forEach(function(x) { if (x && out.indexOf(x) === -1) out.push(x); });
  return out;
}
function _profRead_(username) {
  var sh = getCrmSS_().getSheetByName(SH_PROFILE), un = String(username || '').trim().toLowerCase();
  var empty = { fullName: '', phone: '', email: '', facebook: '', updatedAt: '', updatedBy: '' };
  if (!sh || sh.getLastRow() < 2) return empty;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PROFILE_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() !== un) continue;
    var up = v[i][5] instanceof Date ? v[i][5].toISOString() : String(v[i][5] || '');
    return { fullName: String(v[i][1] || ''), phone: String(v[i][2] || ''), email: String(v[i][3] || ''), facebook: String(v[i][4] || ''), updatedAt: up, updatedBy: String(v[i][6] || '') };
  }
  return empty;
}
// So lieu KPI/Pancake/Pos cua ca ky, dung chung cho moi nguoi xem (cache 5 phut vi tinh nang — dat — 4 bao cao).
function _profMetrics_(from, to) {
  var key = 'profMet1_' + from + '|' + to, cache = CacheService.getScriptCache();
  try { var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e0) {}
  var pos = null, posRev = {}, warnings = [];
  try { pos = posMetrics_({ from: from, to: to, parts: ['revenue', 'failed'] }); } catch (e1) { warnings.push('Không đọc được doanh thu Pos: ' + e1.message); }
  if (pos && pos.ok === false) { warnings.push('Doanh thu Pos: ' + (pos.error || 'lỗi')); pos = null; }
  if (pos) (pos.bySale || []).forEach(function(r) { var k = _normTxt_(r.name); posRev[k] = (posRev[k] || 0) + (Number(r.revenue) || 0); });
  var tm = { list: [], warnings: [] };
  try { tm = buildTeamMetrics_(from, to, pos); } catch (e2) { warnings.push('Không đọc được chỉ số đội ngũ: ' + e2.message); }
  var out = { list: (tm.list || []).map(function(p) { return { name: p.name, dept: p.dept || '', deptKey: p.deptKey || '', revenue: p.revenue || 0, tongTT: p.tongTT || 0, sdtMangVe: p.sdtMangVe || 0, tyLeChot: p.tyLeChot }; }),
              posRev: posRev, hasPos: !!pos, warnings: warnings.concat(tm.warnings || []) };
  try { cache.put(key, JSON.stringify(out), 300); } catch (e3) {}
  return out;
}
function _profFold_(names) {
  var f = {};
  var arr = names || [];
  try { arr = _expandSaleFilterWithPancakeAliases_(arr); } catch (e) {}
  arr.forEach(function(n) { var k = _normTxt_(n); if (k) f[k] = true; });
  return f;
}
// viewer co duoc xem target khong? admin: tat ca; chinh minh; leader: thanh vien team minh lam leader; quan ly: nguoi thuoc phong (nhom KPI) minh phu trach.
function _profScope_(viewer, target, M) {
  if (String(viewer.username).toLowerCase() === String(target.username).toLowerCase()) return true;
  if (viewer.role === 'admin') return true;
  var tf = _profFold_(_profNames_(target));
  if (viewer.role === 'leader') {
    var vNames = {}; _profNames_(viewer).forEach(function(n) { vNames[_normTxt_(n)] = true; });
    var ok = false;
    readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
      if (ok) return;
      var isMine = (t.leader && vNames[_normTxt_(t.leader)]) || (viewer.team && _normTxt_(t.name) === _normTxt_(viewer.team));
      if (!isMine) return;
      var mem = [t.leader].concat(t.members || []);
      for (var i = 0; i < mem.length; i++) if (mem[i] && tf[_normTxt_(mem[i])]) { ok = true; return; }
    });
    return ok;
  }
  if (viewer.role === 'manager') {
    var depts = {}; String(viewer.team || '').split(',').forEach(function(k) { k = _normTxt_(k); if (k) depts[k] = true; });
    var rows = (M && M.list || []).filter(function(p) { return tf[_normTxt_(p.name)] && p.deptKey; });
    for (var j = 0; j < rows.length; j++) if (depts[_normTxt_(rows[j].deptKey)]) return true;
    return false;
  }
  return false;
}
// Thu hang cua target trong 1 nhom: ents = [{key, revenue}] (da gom moi ten cua target thanh 1 phan tu co key 'me'). Dong hang chung hang.
function _profRank_(ents) {
  var me = null; ents.forEach(function(e) { if (e.me) me = e; });
  if (!me) return null;
  var better = 0; ents.forEach(function(e) { if (!e.me && e.revenue > me.revenue) better++; });
  return { rank: better + 1, of: ents.length };
}
function _profMonthRange_(p) {
  var today = _vnYmd_(new Date());
  var from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || p.dateFrom || '') ? (p.from || p.dateFrom) : today.substring(0, 8) + '01';
  var to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || p.dateTo || '') ? (p.to || p.dateTo) : today;
  return { from: from, to: to };
}

// GET action=profileGet&token=..&username=.. (username bo trong = chinh minh)
function profileGet_(p) {
  var viewer = _sessUser_(p.token);
  if (!viewer) return { ok: false, error: 'Cần đăng nhập.', code: 'AUTH' };
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  var target = _profFindUser_(users, p.username || viewer.username);
  if (!target) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  var self = String(viewer.username).toLowerCase() === String(target.username).toLowerCase();
  if (!self && viewer.role !== 'admin') {
    var r = _profMonthRange_(p);
    if (!_profScope_(viewer, target, viewer.role === 'manager' ? _profMetrics_(r.from, r.to) : null)) return { ok: false, error: 'Bạn không có quyền xem hồ sơ này.', code: 'FORBIDDEN' };
  }
  return { ok: true, username: target.username, accountName: target.name || '', role: target.role || '', team: target.team || '', names: _profNames_(target),
           profile: _profRead_(target.username), canEdit: self || viewer.role === 'admin' };
}
// POST action=profileSave {token, username?, profile:{fullName,phone,email,facebook}} — chi sua ho so cua chinh minh (admin sua duoc cua nguoi khac)
function profileSave_(d) {
  var viewer = _sessUser_(d.token);
  if (!viewer) return jsonOut_({ ok: false, error: 'Cần đăng nhập.', code: 'AUTH' });
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  var target = _profFindUser_(users, d.username || viewer.username);
  if (!target) return jsonOut_({ ok: false, error: 'Không tìm thấy tài khoản.' });
  if (String(viewer.username).toLowerCase() !== String(target.username).toLowerCase() && viewer.role !== 'admin') return jsonOut_({ ok: false, error: 'Bạn chỉ sửa được hồ sơ của chính mình.', code: 'FORBIDDEN' });
  var c = _profClean_(d.profile);
  if (!c.ok) return jsonOut_({ ok: false, error: c.error });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (eL) { return jsonOut_({ ok: false, error: 'Hệ thống bận, thử lại sau vài giây.' }); }
  try {
    var sh = getSheet_(SH_PROFILE, PROFILE_HEADERS), un = String(target.username).trim().toLowerCase(), row = 0;
    if (sh.getLastRow() >= 2) {
      var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]).trim().toLowerCase() === un) { row = i + 2; break; }
    }
    if (!row) row = Math.max(sh.getLastRow(), 1) + 1;
    var rng = sh.getRange(row, 1, 1, PROFILE_HEADERS.length);
    rng.setNumberFormat('@');   // giu so 0 dau cua SDT, khong cho Sheets tu doi kieu
    rng.setValues([[target.username, c.profile.fullName, c.profile.phone, c.profile.email, c.profile.facebook, new Date().toISOString(), viewer.username]]);
  } finally { try { lock.releaseLock(); } catch (eR) {} }
  return jsonOut_({ ok: true, profile: _profRead_(target.username) });
}
// GET action=staffOverview&token=..&username=..&from=YYYY-MM-DD&to=YYYY-MM-DD
function staffOverview_(p) {
  var viewer = _sessUser_(p.token);
  if (!viewer) return { ok: false, error: 'Cần đăng nhập.', code: 'AUTH' };
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  var target = _profFindUser_(users, p.username || viewer.username);
  if (!target) return { ok: false, error: 'Không tìm thấy tài khoản.' };
  var rg = _profMonthRange_(p);
  if (rg.from > rg.to) return { ok: false, error: 'Ngày bắt đầu phải trước ngày kết thúc.' };
  var M = _profMetrics_(rg.from, rg.to);
  if (!_profScope_(viewer, target, M)) return { ok: false, error: 'Bạn không có quyền xem số liệu này.', code: 'FORBIDDEN' };
  var cache = CacheService.getScriptCache(), ck = 'staffOv1_' + String(target.username).toLowerCase() + '|' + rg.from + '|' + rg.to;
  try { var hit = cache.get(ck); if (hit) return JSON.parse(hit); } catch (e0) {}
  var cs = buildCsStats_(target.username, rg.from, rg.to);
  if (!cs || !cs.ok) return { ok: false, error: (cs && cs.error) || 'Không tính được số liệu.' };
  var fold = _profFold_(cs.names && cs.names.length ? cs.names : _profNames_(target));
  // Pancake: gom moi dong ten cua nguoi nay (tyLeChot tinh theo trong so tongTT)
  var tongTT = 0, sdt = 0, chotW = 0, deptKey = '', dept = '';
  M.list.forEach(function(r) {
    if (!fold[_normTxt_(r.name)]) return;
    tongTT += r.tongTT || 0; sdt += r.sdtMangVe || 0;
    if (r.tyLeChot !== null && r.tyLeChot !== undefined) chotW += (r.tyLeChot || 0) * (r.tongTT || 0);
    if (!deptKey && r.deptKey) { deptKey = r.deptKey; dept = r.dept || r.deptKey; }
  });
  function revOf(name, fallback) { var k = _normTxt_(name); return M.posRev[k] !== undefined ? M.posRev[k] : (M.hasPos ? 0 : (fallback || 0)); }
  var myRev = 0; Object.keys(M.posRev).forEach(function(k) { if (fold[k]) myRev += M.posRev[k]; });
  if (!M.hasPos) M.list.forEach(function(r) { if (fold[_normTxt_(r.name)]) myRev += r.revenue || 0; });
  // Team: thanh vien (+ leader) cua team chua nguoi nay
  var rankTeam = null;
  try {
    readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
      if (rankTeam) return;
      var mem = [t.leader].concat(t.members || []).filter(Boolean), has = mem.some(function(m) { return fold[_normTxt_(m)]; });
      if (!has) return;
      var seen = {}, ents = [{ me: true, revenue: myRev }];
      mem.forEach(function(m) { var k = _normTxt_(m); if (!k || fold[k] || seen[k]) return; seen[k] = true; ents.push({ revenue: revOf(m) }); });
      var rk = _profRank_(ents); if (rk) rankTeam = { name: t.name || '', rank: rk.rank, of: rk.of };
    });
  } catch (e1) {}
  // Phong kinh doanh = cung nhom KPI Sale (deptKey)
  var rankDept = null;
  if (deptKey) {
    var seenD = {}, entsD = [{ me: true, revenue: myRev }];
    M.list.forEach(function(r) { var k = _normTxt_(r.name); if (!k || fold[k] || seenD[k] || _normTxt_(r.deptKey) !== _normTxt_(deptKey)) return; seenD[k] = true; entsD.push({ revenue: revOf(r.name, r.revenue) }); });
    var rd = _profRank_(entsD); if (rd) rankDept = { name: dept, rank: rd.rank, of: rd.of };
  }
  var out = { ok: true, username: target.username, from: rg.from, to: rg.to, names: cs.names || [],
    totalOrders: cs.totalOrders, revenue: cs.revenue, commission: cs.commission ? cs.commission.total : null, bonus: cs.bonus ? cs.bonus.total : null,
    closeRatePancake: tongTT ? Math.round(chotW / tongTT * 10) / 10 : null,
    phoneConnectRate: tongTT ? Math.round(sdt / tongTT * 1000) / 10 : null, pancakeConversations: tongTT, phoneCollected: sdt,
    rankTeam: rankTeam, rankDept: rankDept, rankBasis: 'doanh thu',
    warnings: (M.warnings || []).concat(cs.ghepLoi ? [cs.ghepLoi] : []) };
  try { cache.put(ck, JSON.stringify(out), 120); } catch (e2) {}
  return out;
}


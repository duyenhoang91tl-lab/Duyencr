// ═══════════════════════════════════════════════════════
//  PHÂN QUYỀN THEO VAI TRÒ + BỘ PHẬN (0b/0c, 2026-10-13). Backend: gas_v13.js (roleConfig / saveRoleConfig / _featureAllowed_) — logic _featAllowed ở đây PHẢI giống _featureAllowed_.
//  - Trang "🛡 Phân quyền" (menu Settings, chỉ Admin): Vai trò | Quyền theo vai trò | Quyền theo bộ phận | Xem thử theo tài khoản.
//  - Mỗi vai trò có `base` quyết định cách cắt DỮ LIỆU (admin / viewer = xem toàn công ty / manager = theo phòng / leader = theo team / cs = của mình),
//    nên code cũ so sánh currentUser.role === 'leader'... không phải sửa: currentUser.role luôn là BASE, currentUser.roleKey là khoá vai trò thật.
//  - Quyền xem hạng mục (id tab như 'salesreport' hoặc 'act:<tên>' cho tác vụ trong menu): perms null = không giới hạn (mặc định); mảng = chỉ các mục đó.
// ═══════════════════════════════════════════════════════
var _ROLE_BUILTIN = [
  { key:'admin',   label:'Admin',          base:'admin',   locked:true, desc:'Toàn quyền hệ thống: tài khoản, cài đặt, mọi dữ liệu.' },
  { key:'ceo',     label:'CEO / Giám đốc', base:'viewer',  desc:'Xem toàn bộ dữ liệu công ty, không có quyền quản trị tài khoản.' },
  { key:'tp',      label:'Trưởng phòng',   base:'manager', desc:'Xem dữ liệu của các phòng được giao phụ trách.' },
  { key:'manager', label:'Quản lý',        base:'manager', desc:'Xem dữ liệu của các phòng/sale được giao phụ trách.' },
  { key:'leader',  label:'Trưởng nhóm',    base:'leader',  desc:'Xem dữ liệu của cả team mình làm trưởng.' },
  { key:'cs',      label:'Nhân viên kinh doanh', base:'cs',      desc:'Chỉ thấy dữ liệu của chính mình.' },
  { key:'demo',    label:'Tài khoản test', base:'demo',    locked:true, hidden:true, desc:'Chỉ xem báo cáo mẫu.' }
];
var _ROLE_BASE_LABEL = { viewer:'Xem toàn công ty (không quản trị)', manager:'Theo phòng phụ trách', leader:'Theo team mình làm trưởng', cs:'Chỉ dữ liệu của chính mình', admin:'Toàn quyền', demo:'Báo cáo mẫu' };
var _roleCfg = { v:1, roles:[], deptPerms:{} };     // đầy đủ — chỉ admin nhận từ máy chủ
var _roleAccess = null;                            // phần của CHÍNH MÌNH: {role, base, label, rolePerms, deptKeys, deptPerms}
var _roleBaseCache = {};                           // khoá vai trò tuỳ chỉnh -> base (nhớ qua các lần đăng nhập để lần sau map đúng ngay từ đầu)
try { _roleBaseCache = JSON.parse(localStorage.getItem('ome_role_base') || '{}') || {}; } catch (e) { _roleBaseCache = {}; }

function _roleBaseOf(key){
  key = String(key == null ? 'cs' : key).trim().toLowerCase();
  for (var i = 0; i < _ROLE_BUILTIN.length; i++) if (_ROLE_BUILTIN[i].key === key) return _ROLE_BUILTIN[i].base;
  for (var j = 0; j < _roleCfg.roles.length; j++) if (_roleCfg.roles[j].key === key) return _roleCfg.roles[j].base || 'cs';
  return _roleBaseCache[key] || 'cs';
}
function _roleLabel(key){
  key = String(key == null ? 'cs' : key).trim().toLowerCase();
  for (var j = 0; j < _roleCfg.roles.length; j++) if (_roleCfg.roles[j].key === key && _roleCfg.roles[j].label) return _roleCfg.roles[j].label;
  for (var i = 0; i < _ROLE_BUILTIN.length; i++) if (_ROLE_BUILTIN[i].key === key) return _ROLE_BUILTIN[i].label;
  return key;
}
function _roleKeysForSelect(){
  var ks = ['admin','ceo','tp','manager','leader','cs'];
  _roleCfg.roles.forEach(function(r){ if (ks.indexOf(r.key) === -1) ks.push(r.key); });
  ks.push('demo');
  return ks;
}
// Giống _featureAllowed_ (GAS) cho CHÍNH MÌNH — chỉ gọi sau khi đã kiểm perms riêng của tài khoản (xem _tabAllowedForUser).
function _featAllowed(id){
  if (!currentUser || currentUser.role === 'admin') return true;
  var a = _roleAccess; if (!a) return true;
  if (Array.isArray(a.rolePerms) && a.rolePerms.indexOf(id) === -1) return false;
  var dk = a.deptKeys || []; if (!dk.length) return true;
  var ok = false;
  dk.forEach(function(k){ var p = (a.deptPerms || {})[k]; if (!Array.isArray(p) || p.indexOf(id) !== -1) ok = true; });
  return ok;
}
// Mô phỏng cho 1 tài khoản bất kỳ (trang "Xem thử"): acct = {role, perms, team, names}; saleDepts = {tên: keyPhòng}.
function _featAllowedFor(acct, id, cfg, saleDepts){
  if (acct.role === 'admin') return true;
  if (id.indexOf('act:') !== 0 && Array.isArray(acct.perms) && acct.perms.length) return acct.perms.indexOf(id) !== -1;
  var r = null; (cfg.roles || []).forEach(function(x){ if (x.key === acct.role) r = x; });
  if (r && Array.isArray(r.perms) && r.perms.indexOf(id) === -1) return false;
  var dk = _deptKeysFor(acct, cfg, saleDepts); if (!dk.length) return true;
  var ok = false;
  dk.forEach(function(k){ var p = (cfg.deptPerms || {})[k]; if (!Array.isArray(p) || p.indexOf(id) !== -1) ok = true; });
  return ok;
}
function _deptKeysFor(acct, cfg, saleDepts){
  var out = {}, base = _roleBaseOfCfg(acct.role, cfg);
  if (base === 'manager') String(acct.team || '').split(',').forEach(function(k){ k = k.trim(); if (k) out[k] = 1; });
  var nm = (acct.names && acct.names.length) ? acct.names : (acct.name ? [acct.name] : []);
  var fold = function(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); };
  var sd = {}; Object.keys(saleDepts || {}).forEach(function(n){ sd[fold(n)] = saleDepts[n]; });
  nm.forEach(function(n){ var k = sd[fold(n)]; if (k) out[k] = 1; });
  return Object.keys(out);
}
function _roleBaseOfCfg(key, cfg){
  for (var i = 0; i < _ROLE_BUILTIN.length; i++) if (_ROLE_BUILTIN[i].key === key) return _ROLE_BUILTIN[i].base === 'viewer' ? 'viewer' : _ROLE_BUILTIN[i].base;
  var b = 'cs'; (cfg.roles || []).forEach(function(r){ if (r.key === key) b = r.base || 'cs'; });
  return b;
}

// ── Nhận quyền của chính mình sau khi đăng nhập ──
async function _rolesFetchMine(){
  try {
    if (typeof gsUrl === 'undefined' || !gsUrl || !localStorage.getItem('ome_sess_token') || localStorage.getItem('ome_demo_token')) return;
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=roleConfig', { redirect:'follow' });
    var j = await r.json();
    if (!j || !j.ok) return;
    _roleAccess = j.access || null;
    if (j.config) _roleCfg = j.config;
    if (_roleAccess && _roleAccess.role) { _roleBaseCache[_roleAccess.role] = _roleAccess.base; try { localStorage.setItem('ome_role_base', JSON.stringify(_roleBaseCache)); } catch (e) {} }
    if (currentUser && _roleAccess && currentUser.role !== 'admin' && currentUser.role !== 'demo' && _roleAccess.base && currentUser.role !== _roleAccess.base) {
      currentUser.role = _roleAccess.base;   // vai trò tuỳ chỉnh chưa biết base lúc đăng nhập -> cập nhật rồi vẽ lại theo phạm vi dữ liệu mới
      if (typeof renderRolePill === 'function') renderRolePill();
      if (typeof applyFilters === 'function') { try { applyFilters(); } catch (e2) {} }
    }
    _rolesReapply();
  } catch (e) {}
}
function _rolesReapply(){
  try { if (typeof _applyUserTabPermissions === 'function') _applyUserTabPermissions(); } catch (e) {}
  try { if (typeof window._snLayout === 'function') window._snLayout(); } catch (e) {}
}
(function(){
  if (typeof _applyAuthIdentity === 'function') {
    var orig = _applyAuthIdentity;
    _applyAuthIdentity = function(acct){ var r = orig.apply(this, arguments); setTimeout(_rolesFetchMine, 400); return r; };
  }
})();

// ═══ Trang cài đặt ═══
var _rs = { cfg:null, sec:'roles', tab:'role', sel:'ceo', pq:'', recent:null, dirty:false, depts:[], saleDepts:{}, loading:false, prevUser:'' };
var _RS_SECS = [['roles','👥 Vai trò'],['byrole','🧩 Quyền theo vai trò'],['bydept','🏢 Quyền theo bộ phận'],['preview','🔍 Xem thử theo tài khoản']];

function _rsCatalog(){
  var labelOf = {}; _PERM_TAB_DEFS.forEach(function(d){ labelOf[d.id] = d.label; });
  var used = {}, out = [];
  (window._SN_GROUPS || []).forEach(function(g){
    var items = [];
    g.ids.forEach(function(id){
      if (id.indexOf('act:') === 0) {
        var a = (window._SN_ACTS || {})[id.slice(4)];
        if (!a || a.admin) return;                               // tác vụ chỉ Admin: không cấp cho vai trò khác
        var t = typeof a.t === 'function' ? a.t() : a.t;
        items.push({ id:id, label:String(t).replace(/^\s*\S+\s/, function(m){ return /^[\wÀ-ỹ]/.test(m) ? m : ''; }) });
      } else if (labelOf[id]) items.push({ id:id, label:labelOf[id] });
      else return;
      used[id] = 1;
    });
    if (items.length) out.push({ title:g.t, items:items });
  });
  var rest = [];
  _PERM_TAB_DEFS.forEach(function(d){ if (!used[d.id]) rest.push({ id:d.id, label:d.label }); });
  if (rest.length) out.push({ title:'📁 Khác', items:rest });
  return out;
}
function _rsAllIds(){ var a = []; _rsCatalog().forEach(function(g){ g.items.forEach(function(i){ a.push(i.id); }); }); return a; }
function _rsRole(key){
  var r = null; _rs.cfg.roles.forEach(function(x){ if (x.key === key) r = x; });
  if (!r) {
    var b = null; _ROLE_BUILTIN.forEach(function(x){ if (x.key === key) b = x; });
    r = { key:key, label:b ? b.label : key, desc:b ? b.desc : '', base:b ? b.base : 'cs', perms:null };
    _rs.cfg.roles.push(r);
  }
  return r;
}
function _rsRolesList(){
  var out = [];
  _ROLE_BUILTIN.forEach(function(b){ if (!b.hidden) { var o = _rsRole(b.key); o.builtin = true; o.base = b.base; o.locked = !!b.locked; out.push(o); } });   // locked lấy từ định nghĩa có sẵn (cấu hình chưa có Admin vẫn phải khóa cột Admin)
  _rs.cfg.roles.forEach(function(r){ if (!_ROLE_BUILTIN.some(function(b){ return b.key === r.key; })) out.push(r); });
  return out;
}
function _rsUsersOf(key){ return (typeof accounts !== 'undefined' ? accounts : []).filter(function(a){ return String(a.role || 'cs') === key; }).length; }

async function openRoleSettings(){
  if (!currentUser || currentUser.role !== 'admin') { toast('Chỉ Admin mới cài đặt phân quyền.'); return; }
  var ov = document.getElementById('rs-page');
  if (!ov) { ov = document.createElement('div'); ov.id = 'rs-page'; ov.className = 'rs-page'; document.body.appendChild(ov); }
  ov.classList.add('open'); document.body.classList.add('rs-open');
  ov.innerHTML = '<div class="rs-loading">Đang tải phân quyền…</div>';
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=roleConfig', { redirect:'follow' }), j = await r.json();
    if (!j || !j.ok || !j.config) { ov.innerHTML = '<div class="rs-loading">Không tải được cấu hình phân quyền' + (j && j.error ? ': ' + esc(j.error) : '') + '. Kiểm tra GAS đã deploy bản v13.42-roles trở lên (?action=count).</div><button class="btn" onclick="closeRoleSettings(true)">Đóng</button>'; return; }
    _rs.cfg = JSON.parse(JSON.stringify(j.config)); _roleCfg = JSON.parse(JSON.stringify(j.config));
    try {   // bộ phận + gán phòng cho từng người (để Xem thử tính đúng)
      var d1 = await (await fetch(gsUrl + sep + 'action=getSetting&key=deptList', { redirect:'follow' })).json();
      var d2 = await (await fetch(gsUrl + sep + 'action=getSetting&key=saleDepts', { redirect:'follow' })).json();
      var dl = d1 && d1.value ? JSON.parse(d1.value) : null;
      _rs.depts = (Array.isArray(dl) && dl.length) ? dl : (typeof DEPT_LIST !== 'undefined' ? DEPT_LIST.slice() : []);
      _rs.saleDepts = d2 && d2.value ? (JSON.parse(d2.value) || {}) : {};
    } catch (e) { _rs.depts = (typeof DEPT_LIST !== 'undefined' ? DEPT_LIST.slice() : []); _rs.saleDepts = {}; }
    _rs.dirty = false; _rs.sec = 'roles'; _rs.tab = _rs.tab || 'role'; _rs.recent = null; _rsRender();
  } catch (e) { ov.innerHTML = '<div class="rs-loading">Lỗi kết nối: ' + esc(e.message) + '</div><button class="btn" onclick="closeRoleSettings(true)">Đóng</button>'; }
}
function closeRoleSettings(force){
  if (!force && _rs.dirty && !confirm('Có thay đổi CHƯA LƯU. Đóng và bỏ thay đổi?')) return;
  var ov = document.getElementById('rs-page'); if (ov) ov.classList.remove('open');
  document.body.classList.remove('rs-open');
}
function _rsSetSec(s){ var ch = _rs.sec !== s; _rs.sec = s; _rsRender(ch); }
function _rsDirty(){ _rs.dirty = true; var b = document.getElementById('rs-save'); if (b) { b.disabled = false; b.textContent = 'Lưu quyền'; } var d = document.getElementById('rs-discard'); if (d) d.disabled = false; var h = document.getElementById('rs-dirty'); if (h) h.style.display = ''; }

// ═══ GIAO DIỆN MỚI (L3, theo clip "CRM mẫu" 14/10/2026): 3 tab ═══
// Giữ NGUYÊN toàn bộ logic quyền (_rsCell/_rsLimit/_rsRole*/_featAllowedFor/_rsSave...) — chỉ đổi lớp hiển thị. Các hàm vẽ cũ (_rsRolesHtml/_rsMatrixHtml/_rsPreviewHtml) còn lại để test cũ chạy.
var _RS_TABS = [['role','Quyền vai trò'],['person','Quyền từng người'],['dept','Phòng ban & nhóm']];
var _RS_DESC = {
  'overview':'Xem màn Tổng quan: số liệu, nhắc việc và biểu đồ theo phạm vi dữ liệu của mình.',
  'tab-kh':'Xem và tìm danh sách khách hàng trong phạm vi được giao; mở hồ sơ khách.',
  'tab-schedule':'Xem lịch chăm sóc và lịch hẹn của khách trong phạm vi được giao.',
  'tab-overdue':'Xem các khách và công việc đã quá hạn chăm sóc.',
  'tab-mydata':'Xem dữ liệu khách được chia riêng cho mình.',
  'tab-zaloai':'Dùng Zalo AI: gợi ý trả lời và ghi chú trên Zalo.',
  'tab-chat':'Xem hộp thư hội thoại mạng xã hội (Pancake) trong phạm vi được giao.',
  'tab-teamchat':'Chat nội bộ giữa các thành viên.',
  'tab-task':'Xem và xử lý công việc (nhắc việc, lịch tự động) được giao.',
  'dashboard':'Xem Dashboard tổng hợp.',
  'team':'Xem và quản lý nhóm, thành viên (Quản lý Team).',
  'audit':'Xem Nhật ký thay đổi: ai đổi gì, lúc nào.',
  'salesreport':'Xem các báo cáo doanh số A–L (nhân viên, sản phẩm, kênh...).',
  'pancake':'Xem báo cáo hiệu quả Pancake (hội thoại, tin nhắn).',
  'kpipancake':'Xem KPI Pancake của nhân viên.',
  'mktchecklist':'Xem Checklist Marketing.',
  'dailybrief':'Xem báo cáo tổng hợp trong ngày.',
  'uploaddata':'Tải dữ liệu lên (Excel / đồng bộ) vào CRM.'
};
function _rsDesc(id, label){
  if (Object.prototype.hasOwnProperty.call(_RS_DESC, id)) return _RS_DESC[id];
  return id.indexOf('act:') === 0 ? 'Cho phép dùng tác vụ "' + label + '" trong menu Tác vụ.' : 'Cho phép mở mục "' + label + '".';
}
function _rsActLabel(a){ var t = typeof a.t === 'function' ? a.t() : a.t; return String(t).replace(/^\s*\S+\s/, function(m){ return /^[\wÀ-ỹ]/.test(m) ? m : ''; }); }
// Các tác vụ chỉ Admin (cố định, không cấp được cho vai trò khác).
function _rsFixedRows(){
  var out = []; var acts = window._SN_ACTS || {};
  Object.keys(acts).forEach(function(k){ var a = acts[k]; if (a && a.admin) out.push({ id:'act:' + k, label:_rsActLabel(a), desc:'Chỉ Quản trị viên — không thể cấp cho vai trò khác.' }); });
  return out;
}
function _rsTabsHtml(){
  return '<div class="rl-tabs">' + _RS_TABS.map(function(t){ return '<button class="rl-tab' + (_rs.tab === t[0] ? ' on' : '') + '" onclick="_rsSetTab(\'' + t[0] + '\')">' + t[1] + '</button>'; }).join('') + '</div>';
}
function _rsSetTab(t){ var ch = _rs.tab !== t; _rs.tab = t; _rs.adding = false; _rsRender(ch); }
function _rsAddOpen(){ _rs.adding = true; _rsRender(); var i = document.getElementById('rs-new-label'); if (i && i.focus) i.focus(); }
function _rsAddHtml(){
  if (!_rs.adding) return '';
  return '<div class="rl-det rl-add"><h3>Thêm vai trò mới</h3><div class="rl-det-grid"><div><label>Tên vai trò</label><input id="rs-new-label" class="rl-in" placeholder="VD: Kế toán, Trưởng marketing…"></div>' +
    '<div><label>Phạm vi dữ liệu</label><select id="rs-new-base" class="rl-in">' + ['viewer','manager','leader','cs'].map(function(b){ return '<option value="' + b + '">' + esc(_ROLE_BASE_LABEL[b]) + '</option>'; }).join('') + '</select></div></div>' +
    '<p class="rl-help">Vai trò mới bắt đầu không giới hạn tính năng; chỉnh ở bảng bên dưới rồi bấm <b>Lưu quyền</b>. <button class="rl-btn pri" onclick="_rsRoleAdd()">Tạo vai trò</button> <button class="rl-btn" onclick="_rs.adding=false;_rsRender()">Hủy</button></p></div>';
}
function _rsSelRole(k){ _rs.sel = k; _rsRender(); }
function _rsPickPerson(u){ _rs.prevUser = u; _rsRender(); }
function _rsPersonQ(v){ _rs.pq = v; _rsRender(); var i = document.getElementById('rl-pq'); if (i) { try { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} } }

// Bật/tắt 1 ô trong ma trận. Cột chưa giới hạn (perms null) = xem tất cả: bấm tắt 1 mục → chuyển sang giới hạn = mọi mục TRỪ mục đó; bật lại đủ mọi mục → trở về không giới hạn (null).
function _rsToggle(kind, id, fid){
  var all = _rsAllIds(), cur = _rsPermsOf(kind, id), p = cur === null ? all.slice() : cur.slice(), i = p.indexOf(fid);
  if (i === -1) p.push(fid); else p.splice(i, 1);
  var full = all.every(function(x){ return p.indexOf(x) !== -1; });
  _rsSetPerms(kind, id, full ? null : p); _rsDirty(); _rsRender();
}
function _rsDiscard(){
  if (!_rs.dirty) return;
  if (!confirm('Bỏ mọi thay đổi chưa lưu và tải lại cấu hình từ máy chủ?')) return;
  _rs.dirty = false; openRoleSettings();
}
// Tóm tắt 1 lần lưu từ AuditLog (oldValue/newValue là JSON cấu hình): vai trò / phòng nào đổi quyền.
function _rsDiffSummary(oldV, newV){
  try {
    var A = typeof oldV === 'string' ? JSON.parse(oldV) : (oldV || {}), B = typeof newV === 'string' ? JSON.parse(newV) : (newV || {});
    var key = function(p){ return JSON.stringify(p == null ? null : p); };
    var rolesA = {}; (A.roles || []).forEach(function(r){ rolesA[r.key] = r; });
    var lab = function(r){ if (r.label) return r.label; var b = null; _ROLE_BUILTIN.forEach(function(x){ if (x.key === r.key) b = x; }); return b ? b.label : r.key; };
    var roles = (B.roles || []).filter(function(r){ var o = rolesA[r.key]; return !o || key(o.perms) !== key(r.perms) || o.label !== r.label || o.desc !== r.desc || o.base !== r.base; }).map(lab);
    var dA = A.deptPerms || {}, dB = B.deptPerms || {}, ks = {}; Object.keys(dA).concat(Object.keys(dB)).forEach(function(k){ ks[k] = 1; });
    var depts = Object.keys(ks).filter(function(k){ return key(dA[k]) !== key(dB[k]); });
    var out = []; if (roles.length) out.push('Vai trò: ' + roles.join(', ')); if (depts.length) out.push('Phòng: ' + depts.join(', '));
    return out.join(' · ') || 'Cập nhật cấu hình';
  } catch (e) { return 'Cập nhật cấu hình'; }
}
async function _rsLoadRecent(){
  var el = document.getElementById('rl-recent-body'); if (!el) return;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var j = await (await fetch(gsUrl + sep + 'action=audit', { redirect:'follow' })).json();
    var rows = ((j && j.audit) || []).filter(function(r){ return String(r.action || '') === 'config:roleConfig'; }).slice(0, 5);
    _rs.recent = rows; _rsRecentPaint();
  } catch (e) { el.textContent = 'Không tải được lịch sử thay đổi.'; }
}
function _rsRecentPaint(){
  var el = document.getElementById('rl-recent-body'), hd = document.getElementById('rl-recent-time'); if (!el) return;
  var rows = _rs.recent || [];
  var fmt = function(t){ var d = new Date(t); if (isNaN(d.getTime())) return String(t || ''); var p = function(n){ return (n < 10 ? '0' : '') + n; }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  if (hd) hd.textContent = rows.length ? 'Cập nhật ' + fmt(rows[0].timestamp) : '';
  el.innerHTML = rows.length ? rows.map(function(r){ return '<div class="rl-ev"><span class="rl-ev-t">' + esc(fmt(r.timestamp)) + '</span><span class="rl-ev-u">' + esc(r.user || '') + '</span><span class="rl-ev-s">' + esc(_rsDiffSummary(r.oldValue, r.newValue)) + '</span></div>'; }).join('')
    : '<div class="rl-empty">Chưa có thay đổi. Hệ thống đang sử dụng quyền mặc định.</div>';
}

function _rsRoleCardsHtml(){
  var list = _rsRolesList(), sel = _rs.sel;
  var cards = list.map(function(r){
    var n = _rsUsersOf(r.key);
    return '<button class="rl-rc' + (sel === r.key ? ' on' : '') + '" onclick="_rsSelRole(' + _rsEsc(r.key) + ')"><div class="rl-rc-h"><b>' + esc(r.label) + '</b>' + (r.locked ? '<span class="rl-badge">🔒 Khóa</span>' : '') + '</div><div class="rl-rc-d">' + esc(r.desc || '') + '</div><div class="rl-rc-n">' + n + ' tài khoản</div></button>';
  }).join('') + '<button class="rl-rc rl-rc-add" onclick="_rsAddOpen()"><div class="rl-rc-h"><b>＋ Thêm vai trò</b></div><div class="rl-rc-d">Tạo vai trò riêng (vd: Kế toán, Trưởng marketing).</div></button>';
  return '<div class="rl-cards">' + cards + '</div>';
}
function _rsRoleDetailHtml(){
  var r = _rsRolesList().filter(function(x){ return x.key === _rs.sel; })[0];
  if (!r) return '';
  var n = _rsUsersOf(r.key), base = _ROLE_BASE_LABEL[r.base] || r.base;
  if (r.locked) return '<div class="rl-det"><h3>' + esc(r.label) + '</h3><p>' + esc(r.desc || '') + '</p><p class="rl-help">Phạm vi dữ liệu: ' + esc(base) + ' · ' + n + ' tài khoản.</p><p class="rl-help"><b>Quyền Quản trị viên luôn bật để bảo đảm truy cập quản trị.</b></p></div>';
  var baseSel = r.builtin ? '<span class="rl-chip">' + esc(base) + '</span>' :
    '<select class="rl-in" onchange="_rsRoleSet(' + _rsEsc(r.key) + ',\'base\',this.value)">' + ['viewer','manager','leader','cs'].map(function(b){ return '<option value="' + b + '"' + (r.base === b ? ' selected' : '') + '>' + esc(_ROLE_BASE_LABEL[b]) + '</option>'; }).join('') + '</select>';
  return '<div class="rl-det"><div class="rl-det-grid"><div><label>Tên vai trò</label><input class="rl-in" value="' + esc(r.label) + '" onchange="_rsRoleSet(' + _rsEsc(r.key) + ',\'label\',this.value)"></div>' +
    '<div><label>Phạm vi dữ liệu</label>' + baseSel + '</div>' +
    '<div class="rl-det-wide"><label>Mô tả</label><input class="rl-in" value="' + esc(r.desc || '') + '" onchange="_rsRoleSet(' + _rsEsc(r.key) + ',\'desc\',this.value)"></div></div>' +
    '<p class="rl-help">Khóa: <code>' + esc(r.key) + '</code>' + (r.builtin ? ' · vai trò có sẵn' : '') + ' · ' + n + ' tài khoản. Bấm vào ô <b>Bật/Tắt</b> ở bảng dưới để đổi quyền của vai trò này.' +
    (r.builtin ? '' : ' <button class="rl-link" onclick="_rsRoleDel(' + _rsEsc(r.key) + ')">Xóa vai trò</button>') + '</p></div>';
}
function _rsCountText(c){ var tot = _rsAllIds().length; return Array.isArray(c.perms) ? c.perms.length + '/' + tot + ' mục' : 'Xem tất cả'; }
function _rsDeptStats(key){
  var sales = Object.keys(_rs.saleDepts || {}).filter(function(n){ return _rs.saleDepts[n] === key; }).length;
  var mgr = (typeof accounts !== 'undefined' ? accounts : []).filter(function(a){ return _roleBaseOfCfg(a.role, _rs.cfg) === 'manager' && String(a.team || '').split(',').map(function(x){ return x.trim(); }).indexOf(key) !== -1; }).length;
  return { sales:sales, managers:mgr };
}
// Ma trận kiểu clip: dòng có tên + mô tả, nhóm có dòng tiêu đề, ô Bật/Tắt bấm được, cột Admin "Luôn bật · khóa", hàng "Quản trị hệ thống · cố định".
function _rsMatrix2(kind){
  var cat = _rsCatalog(), cols;
  if (kind === 'role') cols = _rsRolesList().map(function(r){ return { id:r.key, label:r.label, perms:r.perms, locked:!!r.locked }; });
  else cols = _rs.depts.map(function(d){ var p = _rs.cfg.deptPerms[d.key]; return { id:d.key, label:d.label, perms:Array.isArray(p) ? p : null, locked:false, st:_rsDeptStats(d.key) }; });
  if (!cols.length) return '<div class="rl-empty">Chưa có phòng ban nào. Tạo phòng ở <b>Tổng quan → Cài đặt phòng</b> rồi mở lại trang này.</div>';
  var head = '<tr><th class="rl-feat">Tính năng</th>' + cols.map(function(c){
    var sub = c.st ? c.st.sales + ' sale · ' + c.st.managers + ' trưởng phòng' : (c.locked ? 'Toàn quyền' : _rsCountText(c));
    return '<th class="rl-col' + (c.locked ? ' rl-lock' : '') + (kind === 'role' && c.id === _rs.sel ? ' rl-sel' : '') + '"><div class="rl-colname">' + esc(c.label) + '</div><div class="rl-colsub">' + esc(sub) + '</div></th>';
  }).join('') + '</tr>';
  var rows = cat.map(function(g){
    var gr = '<tr class="rl-grp"><td colspan="' + (cols.length + 1) + '">' + esc(g.title) + '</td></tr>';
    return gr + g.items.map(function(it){
      return '<tr><td class="rl-feat"><div class="rl-ft">' + esc(it.label) + '</div><div class="rl-fd">' + esc(_rsDesc(it.id, it.label)) + '</div></td>' + cols.map(function(c){
        if (c.locked) return '<td class="rl-cell rl-lock"><b>Bật</b><small>Luôn bật · khóa</small></td>';
        var on = !Array.isArray(c.perms) || c.perms.indexOf(it.id) !== -1;
        return '<td class="rl-cell' + (kind === 'role' && c.id === _rs.sel ? ' rl-sel' : '') + '"><button class="rl-tg ' + (on ? 'on' : 'off') + '" aria-pressed="' + on + '" onclick="_rsToggle(' + _rsEsc(kind) + ',' + _rsEsc(c.id) + ',' + _rsEsc(it.id) + ')">' + (on ? 'Bật' : 'Tắt') + '</button></td>';
      }).join('') + '</tr>';
    }).join('');
  }).join('');
  var fx = _rsFixedRows();
  if (kind === 'role' && fx.length) rows += '<tr class="rl-grp"><td colspan="' + (cols.length + 1) + '">Quản trị hệ thống · cố định</td></tr>' + fx.map(function(it){
    return '<tr><td class="rl-feat"><div class="rl-ft">' + esc(it.label) + '</div><div class="rl-fd">' + esc(it.desc) + '</div></td>' + cols.map(function(c){
      return c.locked ? '<td class="rl-cell rl-lock"><b>Bật</b><small>Có khóa</small></td>' : '<td class="rl-cell rl-na"><span>Không được cấp</span></td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="rl-scroll"><table class="rl-mx"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
}
function _rsCopyBar(kind){
  var cols = _rsCols(kind); if (cols.length < 2) return '';
  var opts = cols.map(function(c){ return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join('');
  return '<div class="rl-copy">Sao chép quyền từ <select id="rs-copy-from" class="rl-in">' + opts + '</select> sang <select id="rs-copy-to" class="rl-in">' + opts + '</select> <button class="rl-btn" onclick="_rsCopy(' + _rsEsc(kind) + ')">Sao chép</button></div>';
}
function _rsRoleTabHtml(){
  return '<h2>Quyền sử dụng theo vai trò</h2><p class="rl-sub">Xem phạm vi của ' + _rsRolesList().length + ' vai trò. Chọn một vai trò để đổi tên, mô tả, phạm vi dữ liệu; bấm ô <b>Bật/Tắt</b> để bật hoặc tắt tính năng cho tất cả người dùng thuộc vai trò đó. Quyền cuối cùng = quyền của <b>vai trò</b> VÀ quyền của <b>phòng ban</b> (tab Phòng ban & nhóm).</p>' +
    _rsRoleCardsHtml() + _rsAddHtml() + _rsRoleDetailHtml() + _rsCopyBar('role') + _rsMatrix2('role') +
    '<p class="rl-note">Khi lưu, quyền mới được kiểm tra ở máy chủ cho các thao tác tiếp theo. Công việc đã tạo và dữ liệu đã lưu vẫn được giữ.</p>' +
    '<div class="rl-recent"><div class="rl-recent-h"><h3>Thay đổi gần đây</h3><span id="rl-recent-time" class="rl-sub"></span></div><div id="rl-recent-body"><div class="rl-empty">Đang tải…</div></div></div>';
}
function _rsDeptTabHtml(){
  return '<h2>Phòng ban & nhóm</h2><p class="rl-sub">Quyền theo phòng ban: người thuộc phòng nào chỉ được dùng các tính năng được bật cho phòng đó (người chưa thuộc phòng nào không bị giới hạn theo phòng). Phòng ban tạo ở <b>Tổng quan → Cài đặt phòng</b>; tick cột để thu hẹp, để trống = xem tất cả.</p>' +
    _rsCopyBar('dept') + _rsMatrix2('dept') +
    '<div class="rl-chips">' + _rs.depts.map(function(d){ var st = _rsDeptStats(d.key), lim = Array.isArray(_rs.cfg.deptPerms[d.key]);
      return '<div class="rl-dc"><b>' + esc(d.label) + '</b><span>' + st.sales + ' sale · ' + st.managers + ' trưởng phòng</span><label class="rl-sw"><input type="checkbox"' + (lim ? ' checked' : '') + ' onchange="_rsLimit(\'dept\',' + _rsEsc(d.key).replace(/"/g, '&quot;') + ',this.checked)"> Giới hạn tính năng</label></div>'; }).join('') + '</div>';
}
function _rsPersonHtml(){
  var accs = (typeof accounts !== 'undefined' ? accounts : []).filter(function(a){ return a.role !== 'demo'; });
  var q = String(_rs.pq || '').toLowerCase().trim();
  var shown = accs.filter(function(a){ return !q || String(a.username || '').toLowerCase().indexOf(q) !== -1 || String(a.name || '').toLowerCase().indexOf(q) !== -1; });
  var list = shown.map(function(a){
    return '<button class="rl-pi' + (_rs.prevUser === a.username ? ' on' : '') + '" onclick="_rsPickPerson(' + _rsEsc(a.username) + ')"><div class="rl-pn">' + esc(a.name || a.username) + '</div><div class="rl-ps">' + esc(a.username) + ' · ' + esc(_rsLabelOf(a.role)) + (Array.isArray(a.perms) ? ' · <b>giới hạn riêng</b>' : '') + '</div></button>';
  }).join('') || '<div class="rl-empty">Không có tài khoản phù hợp.</div>';
  var a = accs.filter(function(x){ return x.username === _rs.prevUser; })[0];
  var left = '<div class="rl-pl"><input id="rl-pq" class="rl-in" placeholder="Tìm tài khoản..." value="' + esc(_rs.pq || '') + '" oninput="_rsPersonQ(this.value)"><div class="rl-plist">' + list + '</div></div>';
  if (!a) return '<h2>Quyền từng người</h2><p class="rl-sub">Chọn một tài khoản để xem họ được dùng gì, và đặt <b>giới hạn menu riêng</b> cho người đó.</p><div class="rl-two">' + left + '<div class="rl-pd"><div class="rl-empty">Chọn một tài khoản ở bên trái.</div></div></div>';
  var base = _roleBaseOfCfg(a.role, _rs.cfg), dk = _deptKeysFor(a, _rs.cfg, _rs.saleDepts);
  var dn = dk.map(function(k){ var d = _rs.depts.filter(function(x){ return x.key === k; })[0]; return d ? d.label : k; });
  var limited = Array.isArray(a.perms), uk = esc(a.username), cat = _rsCatalog();
  var head = '<div class="rl-pdh"><div><h3>' + esc(a.name || a.username) + '</h3><div class="rl-sub">' + esc(a.username) + ' · ' + esc(_rsLabelOf(a.role)) + ' · ' + esc(_ROLE_BASE_LABEL[base] || base) + ' · Phòng: ' + (dn.length ? esc(dn.join(', ')) : 'chưa thuộc phòng nào') + '</div></div>' +
    '<label class="rl-sw"><input type="checkbox"' + (limited ? ' checked' : '') + ' onchange="_rsPersonLimit(' + _rsEsc(a.username).replace(/"/g, '&quot;') + ',this.checked)"> Giới hạn menu riêng cho người này</label></div>' +
    '<p class="rl-note">' + (limited ? 'Đang giới hạn riêng: với các mục menu, danh sách riêng của người này được ưu tiên hơn vai trò và phòng ban. Thay đổi ở đây được <b>lưu ngay</b> (không cần bấm Lưu quyền).' : 'Chưa giới hạn riêng: người này dùng đúng quyền của vai trò và phòng ban. Bật công tắc để tự chọn mục cho riêng người này (lưu ngay).') + '</p>';
  var rows = cat.map(function(g){
    return '<tr class="rl-grp"><td colspan="4">' + esc(g.title) + '</td></tr>' + g.items.map(function(it){
      var isAct = it.id.indexOf('act:') === 0;
      var byRole = _featAllowedFor(Object.assign({}, a, { perms:null }), it.id, _rs.cfg, _rs.saleDepts), fin = _featAllowedFor(a, it.id, _rs.cfg, _rs.saleDepts);
      var own = (limited && !isAct) ? '<button class="rl-tg ' + (a.perms.indexOf(it.id) !== -1 ? 'on' : 'off') + '" onclick="_rsPersonToggle(' + _rsEsc(a.username) + ',' + _rsEsc(it.id) + ')">' + (a.perms.indexOf(it.id) !== -1 ? 'Bật' : 'Tắt') + '</button>' : '<span class="rl-dash">' + (isAct ? 'theo vai trò' : '—') + '</span>';
      return '<tr><td class="rl-feat"><div class="rl-ft">' + esc(it.label) + '</div><div class="rl-fd">' + esc(_rsDesc(it.id, it.label)) + '</div></td><td class="rl-cell"><span class="rl-st ' + (byRole ? 'on' : 'off') + '">' + (byRole ? 'Bật' : 'Tắt') + '</span></td><td class="rl-cell">' + own + '</td><td class="rl-cell"><span class="rl-st ' + (fin ? 'on' : 'off') + '">' + (fin ? 'Bật' : 'Tắt') + '</span></td></tr>';
    }).join('');
  }).join('');
  var tbl = '<div class="rl-scroll"><table class="rl-mx"><thead><tr><th class="rl-feat">Tính năng</th><th class="rl-col">Theo vai trò &amp; phòng</th><th class="rl-col">Riêng người này</th><th class="rl-col">Kết quả</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  return '<h2>Quyền từng người</h2><div class="rl-two">' + left + '<div class="rl-pd">' + head + tbl + '</div></div>';
}
// Giới hạn menu riêng dùng đúng hàm của hộp thoại Tài khoản (lưu ngay lên máy chủ).
function _rsPersonLimit(u, on){
  if (typeof acctTogglePermLimit !== 'function') { toast('Chưa tải xong chức năng tài khoản — tải lại trang.'); return; }
  acctTogglePermLimit(u, on); setTimeout(_rsRender, 120);
}
function _rsPersonToggle(u, id){
  if (typeof acctTogglePermTab !== 'function' || typeof _findAccount !== 'function') return;
  var a = _findAccount(u); if (!a || !Array.isArray(a.perms)) return;
  acctTogglePermTab(u, id, a.perms.indexOf(id) === -1); setTimeout(_rsRender, 120);
}

function _rsRender(resetScroll){
  var ov = document.getElementById('rs-page'); if (!ov) return;
  // Giữ vị trí cuộn (sửa 31da91a): innerHTML thay toàn bộ nên các khung cuộn bị tạo lại → scrollTop về 0 (nhảy lên đầu sau mỗi lần bấm ô). Đổi tab thì cuộn lại từ đầu.
  var _sv = [];
  try { ov.querySelectorAll('.rl-body,.rl-scroll,.rl-plist').forEach(function(el, i){ _sv.push([el.className, i, el.scrollTop, el.scrollLeft]); }); } catch (e) {}
  ov.className = 'rs-page rl-page open';
  if (!_rs.tab) _rs.tab = 'role';
  if (!_rs.sel) _rs.sel = 'ceo';
  var body = _rs.tab === 'person' ? _rsPersonHtml() : (_rs.tab === 'dept' ? _rsDeptTabHtml() : _rsRoleTabHtml());
  ov.innerHTML = '<div class="rl-top"><button class="rl-back" onclick="closeRoleSettings()">← Quay lại</button><div class="rl-titles"><div class="rl-crumb">QUẢN LÝ</div><h1>Vai trò &amp; quyền hạn</h1></div><span class="rl-sp"></span>' +
    '<span id="rs-dirty" class="rl-dirty" style="' + (_rs.dirty ? '' : 'display:none') + '">● Chưa lưu</span>' +
    '<button id="rs-discard" class="rl-btn" onclick="_rsDiscard()"' + (_rs.dirty ? '' : ' disabled') + '>Bỏ thay đổi</button>' +
    '<button id="rs-save" class="rl-btn pri" onclick="_rsSave()"' + (_rs.dirty ? '' : ' disabled') + '>Lưu quyền</button></div>' +
    '<div class="rl-body">' + _rsTabsHtml() + '<div class="rl-main">' + body + '</div></div>';
  if (!resetScroll) try {
    var _els = ov.querySelectorAll('.rl-body,.rl-scroll,.rl-plist');
    _sv.forEach(function(sv){ var el = _els[sv[1]]; if (el && el.className === sv[0]) { el.scrollTop = sv[2]; el.scrollLeft = sv[3]; } });
  } catch (e) {}
  if (_rs.tab === 'role') { if (_rs.recent) _rsRecentPaint(); else _rsLoadRecent(); }
}

// ── Mục 1: Vai trò ──
function _rsRolesHtml(){
  var rows = _rsRolesList().map(function(r){
    var baseSel = r.builtin ? '<span class="rs-chip">' + esc(_ROLE_BASE_LABEL[r.base] || r.base) + '</span>' :
      '<select onchange="_rsRoleSet(\'' + r.key + '\',\'base\',this.value)">' + ['viewer','manager','leader','cs'].map(function(b){ return '<option value="' + b + '"' + (r.base === b ? ' selected' : '') + '>' + esc(_ROLE_BASE_LABEL[b]) + '</option>'; }).join('') + '</select>';
    var n = _rsUsersOf(r.key);
    return '<tr><td><input class="rs-in" value="' + esc(r.label) + '"' + (r.locked ? ' disabled' : '') + ' onchange="_rsRoleSet(\'' + r.key + '\',\'label\',this.value)"><div class="rs-key">khoá: ' + esc(r.key) + (r.builtin ? ' · có sẵn' : '') + '</div></td>' +
      '<td>' + baseSel + '</td>' +
      '<td><input class="rs-in" value="' + esc(r.desc || '') + '"' + (r.locked ? ' disabled' : '') + ' onchange="_rsRoleSet(\'' + r.key + '\',\'desc\',this.value)"></td>' +
      '<td class="rs-c">' + n + '</td>' +
      '<td>' + (r.builtin ? '' : '<button class="btn secondary sm" onclick="_rsRoleDel(\'' + r.key + '\')">Xóa</button>') + '</td></tr>';
  }).join('');
  return '<h3>Danh sách vai trò</h3><div class="rs-help guide-text">“Phạm vi dữ liệu” quyết định người đó thấy dữ liệu của ai (khách, đơn, báo cáo…). Hạng mục được xem cài ở mục bên cạnh. Gán vai trò cho từng người trong <b>🔑 Tài khoản</b>.</div>' +
    '<table class="rs-tbl"><thead><tr><th>Tên vai trò</th><th>Phạm vi dữ liệu</th><th>Mô tả</th><th class="rs-c">Số tài khoản</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h3>Thêm vai trò mới</h3><div class="rs-add"><input id="rs-new-label" class="rs-in" placeholder="Tên vai trò (VD: Kế toán, Marketing lead…)">' +
    '<select id="rs-new-base">' + ['viewer','manager','leader','cs'].map(function(b){ return '<option value="' + b + '">' + esc(_ROLE_BASE_LABEL[b]) + '</option>'; }).join('') + '</select>' +
    '<button class="btn primary" onclick="_rsRoleAdd()">+ Thêm</button></div>';
}
function _rsRoleSet(key, f, v){ var r = _rsRole(key); if (f === 'label') { v = String(v).trim(); if (!v) { _rsRender(); return; } } r[f] = v; _rsDirty(); }
function _rsSlug(s){ return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20); }
function _rsRoleAdd(){
  var l = (document.getElementById('rs-new-label').value || '').trim(), b = document.getElementById('rs-new-base').value;
  if (!l) { toast('Nhập tên vai trò.'); return; }
  var k = _rsSlug(l); if (k.length < 2) k = 'role_' + Date.now().toString(36).slice(-5);
  if (_rsRolesList().some(function(r){ return r.key === k; }) || k === 'demo') k += '_' + Date.now().toString(36).slice(-3);
  _rs.cfg.roles.push({ key:k, label:l.slice(0, 40), desc:'', base:b, perms:null });
  _rs.adding = false; _rs.sel = k;
  _rsDirty(); _rsRender();
}
function _rsRoleDel(key){
  var n = _rsUsersOf(key);
  if (n) { alert('Còn ' + n + ' tài khoản đang dùng vai trò này. Đổi vai trò của họ trước khi xóa.'); return; }
  if (!confirm('Xóa vai trò này?')) return;
  _rs.cfg.roles = _rs.cfg.roles.filter(function(r){ return r.key !== key; });
  _rsDirty(); _rsRender();
}

// ── Mục 2 & 3: Ma trận hạng mục ──
function _rsCols(kind){
  if (kind === 'role') return _rsRolesList().filter(function(r){ return !r.locked; }).map(function(r){ return { id:r.key, label:r.label, perms:r.perms }; });
  return _rs.depts.map(function(d){ var p = _rs.cfg.deptPerms[d.key]; return { id:d.key, label:d.label, perms:Array.isArray(p) ? p : null }; });
}
function _rsPermsOf(kind, id){ var c = _rsCols(kind).filter(function(x){ return x.id === id; })[0]; return c ? c.perms : null; }
function _rsSetPerms(kind, id, arr){ if (kind === 'role') _rsRole(id).perms = arr; else { if (arr === null) delete _rs.cfg.deptPerms[id]; else _rs.cfg.deptPerms[id] = arr; } }
function _rsMatrixHtml(kind){
  var cols = _rsCols(kind), cat = _rsCatalog();
  if (!cols.length) return '<div class="rs-help">Chưa có bộ phận nào. Tạo bộ phận ở <b>Tổng quan → Cài đặt phòng</b> rồi mở lại trang này.</div>';
  var head = '<tr><th class="rs-feat">Hạng mục</th>' + cols.map(function(c){
    var lim = Array.isArray(c.perms);
    return '<th class="rs-col"><div class="rs-colname">' + esc(c.label) + '</div><label class="rs-lim"><input type="checkbox"' + (lim ? ' checked' : '') + ' onchange="_rsLimit(\'' + kind + '\',\'' + c.id + '\',this.checked)"> Giới hạn</label>' +
      (lim ? '<div class="rs-cnt">' + c.perms.length + '/' + _rsAllIds().length + ' mục</div>' : '<div class="rs-cnt">xem tất cả</div>') + '</th>';
  }).join('') + '</tr>';
  var body = cat.map(function(g){
    var ids = g.items.map(function(i){ return i.id; });
    var gr = '<tr class="rs-grp"><td>' + esc(g.title) + '</td>' + cols.map(function(c){
      if (!Array.isArray(c.perms)) return '<td class="rs-c"></td>';
      var n = ids.filter(function(i){ return c.perms.indexOf(i) !== -1; }).length;
      return '<td class="rs-c"><input type="checkbox" ' + (n === ids.length ? 'checked' : '') + ' title="Bật/tắt cả nhóm" onchange="_rsGroup(\'' + kind + '\',\'' + c.id + '\',' + _rsEsc(JSON.stringify(ids)) + ',this.checked)"><span class="rs-gn">' + n + '/' + ids.length + '</span></td>';
    }).join('') + '</tr>';
    var items = g.items.map(function(it){
      return '<tr><td class="rs-feat">' + esc(it.label) + '</td>' + cols.map(function(c){
        var lim = Array.isArray(c.perms), on = !lim || c.perms.indexOf(it.id) !== -1;
        return '<td class="rs-c"><input type="checkbox"' + (on ? ' checked' : '') + (lim ? '' : ' disabled') + ' onchange="_rsCell(\'' + kind + '\',\'' + c.id + '\',\'' + it.id + '\',this.checked)"></td>';
      }).join('') + '</tr>';
    }).join('');
    return gr + items;
  }).join('');
  var copy = '<div class="rs-copy">Sao chép quyền từ <select id="rs-copy-from">' + cols.map(function(c){ return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join('') + '</select> sang <select id="rs-copy-to">' + cols.map(function(c){ return '<option value="' + c.id + '">' + esc(c.label) + '</option>'; }).join('') + '</select> <button class="btn secondary sm" onclick="_rsCopy(\'' + kind + '\')">Sao chép</button></div>';
  return '<h3>' + (kind === 'role' ? 'Vai trò nào được xem hạng mục nào' : 'Bộ phận nào được xem hạng mục nào') + '</h3>' +
    '<div class="rs-help">' + (kind === 'role' ? 'Mỗi cột là một vai trò (Admin luôn xem tất cả nên không hiện). ' : 'Mỗi cột là một bộ phận (lấy từ <b>Cài đặt phòng</b> ở Tổng quan). Người chưa thuộc phòng nào không bị giới hạn theo bộ phận. ') +
    'Tick <b>Giới hạn</b> để chỉ cho xem các mục được tick; bỏ tick Giới hạn = xem tất cả.</div>' + copy +
    '<div class="rs-scroll"><table class="rs-mx"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
}
function _rsEsc(s){ return "'" + String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + "'"; }
function _rsLimit(kind, id, on){ _rsSetPerms(kind, id, on ? _rsAllIds() : null); _rsDirty(); _rsRender(); }
function _rsCell(kind, id, fid, on){
  var p = (_rsPermsOf(kind, id) || []).slice(), i = p.indexOf(fid);
  if (on && i === -1) p.push(fid); if (!on && i !== -1) p.splice(i, 1);
  _rsSetPerms(kind, id, p); _rsDirty(); _rsRender();
}
function _rsGroup(kind, id, ids, on){
  ids = JSON.parse(ids);
  var p = (_rsPermsOf(kind, id) || []).filter(function(x){ return ids.indexOf(x) === -1; });
  if (on) p = p.concat(ids);
  _rsSetPerms(kind, id, p); _rsDirty(); _rsRender();
}
function _rsCopy(kind){
  var f = document.getElementById('rs-copy-from').value, t = document.getElementById('rs-copy-to').value;
  if (f === t) { toast('Chọn 2 cột khác nhau.'); return; }
  var p = _rsPermsOf(kind, f);
  _rsSetPerms(kind, t, p === null ? null : p.slice()); _rsDirty(); _rsRender(); toast('Đã sao chép — nhớ bấm Lưu.');
}

// ── Mục 4: Xem thử ──
function _rsPreviewHtml(){
  var accs = (typeof accounts !== 'undefined' ? accounts : []).filter(function(a){ return a.role !== 'demo'; });
  var sel = '<select id="rs-pv-user" onchange="_rs.prevUser=this.value;_rsRender()"><option value="">— chọn tài khoản —</option>' + accs.map(function(a){
    return '<option value="' + esc(a.username) + '"' + (_rs.prevUser === a.username ? ' selected' : '') + '>' + esc(a.username) + ' — ' + esc(_rsLabelOf(a.role)) + '</option>'; }).join('') + '</select>';
  var out = '<h3>Xem thử: tài khoản này thấy gì?</h3><div class="rs-help guide-text">Tính theo cấu hình ĐANG HIỂN THỊ ở đây (kể cả phần chưa lưu).</div>' + sel;
  var a = accs.filter(function(x){ return x.username === _rs.prevUser; })[0];
  if (!a) return out;
  var base = _roleBaseOfCfg(a.role, _rs.cfg), dk = _deptKeysFor(a, _rs.cfg, _rs.saleDepts);
  var dn = dk.map(function(k){ var d = _rs.depts.filter(function(x){ return x.key === k; })[0]; return d ? d.label : k; });
  out += '<div class="rs-pv-meta"><b>Vai trò:</b> ' + esc(_rsLabelOf(a.role)) + ' · <b>Phạm vi dữ liệu:</b> ' + esc(_ROLE_BASE_LABEL[base] || base) + ' · <b>Bộ phận:</b> ' + (dn.length ? esc(dn.join(', ')) : 'chưa thuộc phòng nào') +
    (Array.isArray(a.perms) && a.perms.length ? ' · <b>Có giới hạn menu riêng</b> (ưu tiên cho các tab)' : '') + '</div>';
  out += _rsCatalog().map(function(g){
    return '<div class="rs-pv-g"><div class="rs-pv-t">' + esc(g.title) + '</div>' + g.items.map(function(it){
      var ok = _featAllowedFor(a, it.id, _rs.cfg, _rs.saleDepts);
      return '<span class="rs-pv-i ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ ' : '✕ ') + esc(it.label) + '</span>';
    }).join('') + '</div>';
  }).join('');
  return out;
}
function _rsLabelOf(key){ var l = key; _rs.cfg.roles.forEach(function(r){ if (r.key === key && r.label) l = r.label; }); if (l === key) _ROLE_BUILTIN.forEach(function(b){ if (b.key === key) l = b.label; }); return l; }

async function _rsSave(){
  var b = document.getElementById('rs-save'); if (b) { b.disabled = true; b.textContent = 'Đang lưu…'; }
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveRoleConfig', config:_rs.cfg }) });
    var j = await r.json();
    if (!j || !j.ok) { toast('Lỗi lưu: ' + ((j && j.error) || 'không rõ')); if (b) { b.disabled = false; b.textContent = 'Lưu quyền'; } return; }
    _rs.cfg = JSON.parse(JSON.stringify(j.config)); _roleCfg = JSON.parse(JSON.stringify(j.config)); _rs.dirty = false;
    toast('✓ Đã lưu phân quyền (ghi vào Nhật ký)'); _rs.recent = null; _rsRender();
    _rolesFetchMine();
  } catch (e) { toast('Lỗi kết nối, chưa lưu.'); if (b) { b.disabled = false; b.textContent = 'Lưu quyền'; } }
}

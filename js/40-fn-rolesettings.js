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
  { key:'leader',  label:'Trưởng team',    base:'leader',  desc:'Xem dữ liệu của cả team mình làm trưởng.' },
  { key:'cs',      label:'Nhân viên',      base:'cs',      desc:'Chỉ thấy dữ liệu của chính mình.' },
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
var _rs = { cfg:null, sec:'roles', dirty:false, depts:[], saleDepts:{}, loading:false, prevUser:'' };
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
  _ROLE_BUILTIN.forEach(function(b){ if (!b.hidden) { var o = _rsRole(b.key); o.builtin = true; o.base = b.base; out.push(o); } });
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
    _rs.dirty = false; _rs.sec = 'roles'; _rsRender();
  } catch (e) { ov.innerHTML = '<div class="rs-loading">Lỗi kết nối: ' + esc(e.message) + '</div><button class="btn" onclick="closeRoleSettings(true)">Đóng</button>'; }
}
function closeRoleSettings(force){
  if (!force && _rs.dirty && !confirm('Có thay đổi CHƯA LƯU. Đóng và bỏ thay đổi?')) return;
  var ov = document.getElementById('rs-page'); if (ov) ov.classList.remove('open');
  document.body.classList.remove('rs-open');
}
function _rsSetSec(s){ var ch = _rs.sec !== s; _rs.sec = s; _rsRender(ch); }
function _rsDirty(){ _rs.dirty = true; var b = document.getElementById('rs-save'); if (b) { b.disabled = false; b.textContent = '💾 Lưu phân quyền'; } var h = document.getElementById('rs-dirty'); if (h) h.style.display = ''; }

function _rsRender(resetScroll){
  var ov = document.getElementById('rs-page'); if (!ov) return;
  // Giữ vị trí cuộn: innerHTML thay toàn bộ làm .rs-main/.rs-scroll bị tạo lại → scrollTop về 0 (màn hình nhảy lên đầu sau mỗi lần bấm ô)
  var _sv = [];
  try {
    ov.querySelectorAll('.rs-main,.rs-scroll,.rs-nav').forEach(function(el, i){ _sv.push([el.className, i, el.scrollTop, el.scrollLeft]); });
  } catch (e) {}
  var body = _rs.sec === 'roles' ? _rsRolesHtml() : (_rs.sec === 'byrole' ? _rsMatrixHtml('role') : (_rs.sec === 'bydept' ? _rsMatrixHtml('dept') : _rsPreviewHtml()));
  ov.innerHTML = '<div class="rs-head"><button class="btn secondary sm" onclick="closeRoleSettings()">← Quay lại</button><div class="rs-title">🛡 Phân quyền hệ thống</div><span class="rs-sp"></span>' +
    '<span id="rs-dirty" class="rs-dirty" style="' + (_rs.dirty ? '' : 'display:none') + '">● Chưa lưu</span>' +
    '<button id="rs-save" class="btn primary" onclick="_rsSave()"' + (_rs.dirty ? '' : ' disabled') + '>💾 Lưu phân quyền</button></div>' +
    '<div class="rs-body"><div class="rs-nav">' + _RS_SECS.map(function(s){ return '<button class="rs-navbtn' + (_rs.sec === s[0] ? ' on' : '') + '" onclick="_rsSetSec(\'' + s[0] + '\')">' + s[1] + '</button>'; }).join('') +
    '<div class="rs-note">Mặc định chưa giới hạn gì: ai cũng thấy như trước. Chỉ khi bạn bật <b>Giới hạn hạng mục</b> cho một vai trò/bộ phận thì mới thu hẹp lại. Admin luôn thấy tất cả.<br><br>Quyền cuối cùng = quyền của <b>vai trò</b> VÀ quyền của <b>bộ phận</b> (người thuộc nhiều bộ phận được hợp các bộ phận). Giới hạn menu riêng của từng tài khoản (trong 🔑 Tài khoản) vẫn được ưu tiên cho các tab.</div></div>' +
    '<div class="rs-main">' + body + '</div></div>';
  if (!resetScroll) try {
    var _els = ov.querySelectorAll('.rs-main,.rs-scroll,.rs-nav');
    _sv.forEach(function(s){
      var el = _els[s[1]];
      if (el && el.className === s[0]) { el.scrollTop = s[2]; el.scrollLeft = s[3]; }
    });
  } catch (e) {}
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
  return '<h3>Danh sách vai trò</h3><div class="rs-help">“Phạm vi dữ liệu” quyết định người đó thấy dữ liệu của ai (khách, đơn, báo cáo…). Hạng mục được xem cài ở mục bên cạnh. Gán vai trò cho từng người trong <b>🔑 Tài khoản</b>.</div>' +
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
  var out = '<h3>Xem thử: tài khoản này thấy gì?</h3><div class="rs-help">Tính theo cấu hình ĐANG HIỂN THỊ ở đây (kể cả phần chưa lưu).</div>' + sel;
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
    if (!j || !j.ok) { toast('Lỗi lưu: ' + ((j && j.error) || 'không rõ')); if (b) { b.disabled = false; b.textContent = '💾 Lưu phân quyền'; } return; }
    _rs.cfg = JSON.parse(JSON.stringify(j.config)); _roleCfg = JSON.parse(JSON.stringify(j.config)); _rs.dirty = false;
    toast('✓ Đã lưu phân quyền (ghi vào Nhật ký)'); _rsRender();
    _rolesFetchMine();
  } catch (e) { toast('Lỗi kết nối, chưa lưu.'); if (b) { b.disabled = false; b.textContent = '💾 Lưu phân quyền'; } }
}

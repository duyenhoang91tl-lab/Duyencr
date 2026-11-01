// ═══════════════════════════════════════════════════════
//  KHỚP SALE (2026-10-15) — 1 chỗ duy nhất để khớp MỌI tên của cùng 1 người: Pancake, Base (Sale bán / Người tạo), Pos (cột Thẻ),
//  tên + tài khoản CRM, mã Sale, tài khoản Facebook, user Base, thẻ Pancake. Đã khớp = cùng 1 người ở MỌI bộ lọc/báo cáo, 2 chiều
//  (chọn tên nào trong nhóm cũng ra đủ). Lưu ở Settings 'salePersonTags' = { "<tên chính>": ["tên khác", ...] } (cùng kho với "Thẻ nhân viên",
//  js/50-person-tags.js + backend _userAliasGroups_ đọc sẵn). Danh sách tên: GET action=saleMatchCandidates (gas_v13.js, chỉ admin/quản lý).
//  Menu: Cài đặt team → "🔗 Khớp sale" (js/29-sidenav.js, ACTS.salematch).
// ═══════════════════════════════════════════════════════
var _sm = { names: [], tags: {}, tab: 'groups', q: '', sel: {}, dirty: false, errors: [] };
var _SM_SRC = { crm_user: 'CRM·TK', crm_name: 'CRM·Tên', dir_ma: 'Mã sale', facebook: 'Facebook', dir_base: 'User Base', pancake: 'Pancake', base: 'Base', base_creator: 'Base·Người tạo', pos: 'Pos' };
function _smF(x){ return String(x == null ? '' : x).trim().toLowerCase(); }
function _smKey(x){ return String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function _smRec(name){ var f = _smF(name); return _sm.names.find(function(r){ return _smF(r.name) === f; }) || null; }
// Mọi tên (đã khớp tay) -> tên chính của nhóm
function _smGroupIndex(){
  var idx = {};
  Object.keys(_sm.tags).forEach(function(p){ idx[_smF(p)] = p; (_sm.tags[p] || []).forEach(function(t){ idx[_smF(t)] = p; }); });
  return idx;
}
function _smBadges(rec){
  if (!rec) return '<span class="sm-b sm-b-x">tên tự nhập</span>';
  return Object.keys(rec.srcs).map(function(k){ return '<span class="sm-b" title="' + esc(_SM_SRC[k] || k) + ': ' + rec.srcs[k] + '">' + esc(_SM_SRC[k] || k) + (rec.srcs[k] > 1 ? ' ×' + rec.srcs[k] : '') + '</span>'; }).join('');
}
function _smToast(m){ if (typeof toast === 'function') toast(m); else alert(m); }

function _smEnsure(){
  var ov = document.getElementById('sm-overlay'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'sm-overlay'; ov.className = 'sm-overlay';
  ov.innerHTML = '<div class="sm-box"><div class="sm-head"><b>🔗 Khớp sale</b><span class="sm-sp"></span>' +
      '<button type="button" class="btn sm-save" id="sm-save" style="display:none">💾 Lưu</button><button type="button" class="btn secondary sm" id="sm-close">✕</button></div>' +
    '<div class="sm-note">Khớp mọi tên của <b>cùng 1 người</b> (Pancake, Base, Pos, tên/tài khoản CRM, Facebook…). Sau khi lưu, lọc bất kỳ tên nào trong nhóm đều ra đủ dữ liệu của cả nhóm — ở mọi báo cáo.</div>' +
    '<div class="sm-tabs"><button type="button" data-smtab="groups" class="active">Đã khớp</button><button type="button" data-smtab="free">Chưa khớp</button><button type="button" data-smtab="sug">Gợi ý</button>' +
      '<input id="sm-q" type="search" placeholder="Tìm tên…" autocomplete="off"></div>' +
    '<div class="sm-body" id="sm-body"></div><div class="sm-foot" id="sm-foot"></div></div><div class="sm-dlg" id="sm-dlg"></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) smClose(); });
  document.getElementById('sm-close').addEventListener('click', smClose);
  document.getElementById('sm-save').addEventListener('click', smSave);
  document.getElementById('sm-q').addEventListener('input', function(){ _sm.q = this.value; _smRender(); });
  ov.querySelectorAll('[data-smtab]').forEach(function(b){ b.addEventListener('click', function(){ _sm.tab = b.getAttribute('data-smtab'); ov.querySelectorAll('[data-smtab]').forEach(function(x){ x.classList.toggle('active', x === b); }); _smRender(); }); });
  document.getElementById('sm-body').addEventListener('click', _smBodyClick);
  document.getElementById('sm-body').addEventListener('change', function(e){ var c = e.target.closest('[data-smsel]'); if (c) { var n = c.getAttribute('data-smsel'); if (c.checked) _sm.sel[n] = 1; else delete _sm.sel[n]; _smRenderFoot(); } });
  return ov;
}
function smClose(){
  if (_sm.dirty && !confirm('Có thay đổi CHƯA LƯU. Đóng và bỏ thay đổi?')) return;
  var ov = document.getElementById('sm-overlay'); if (ov) ov.classList.remove('open'); _sm.dirty = false;
}
async function openSaleMatchModal(){
  if (typeof gsUrl === 'undefined' || !gsUrl) { _smToast('Chưa kết nối máy chủ'); return; }
  var ov = _smEnsure(); ov.classList.add('open');
  document.getElementById('sm-body').innerHTML = '<div class="sm-empty">Đang quét tên ở Pancake, Base, Pos, CRM… (có thể mất vài giây)</div>';
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=saleMatchCandidates', { redirect: 'follow' });
    var d = await r.json();
    if (!d || !d.ok) { document.getElementById('sm-body').innerHTML = '<div class="sm-empty">' + esc((d && d.error) || 'Không tải được') + '</div>'; return; }
    _sm.names = d.names || []; _sm.errors = d.errors || [];
    _sm.tags = JSON.parse(JSON.stringify((d.tags && typeof d.tags === 'object' && !Array.isArray(d.tags)) ? d.tags : {}));
    _sm.sel = {}; _sm.dirty = false; _smRender();
  } catch(e){ document.getElementById('sm-body').innerHTML = '<div class="sm-empty">Lỗi mạng: ' + esc(e.message) + '</div>'; }
}
function _smDirty(){ _sm.dirty = true; var b = document.getElementById('sm-save'); if (b) b.style.display = ''; }
function _smMatches(name){ var q = _smF(_sm.q); return !q || _smF(name).indexOf(q) >= 0 || _smKey(name).indexOf(_smKey(q)) >= 0; }

function _smRender(){
  var body = document.getElementById('sm-body'); if (!body) return;
  var save = document.getElementById('sm-save'); if (save) save.style.display = _sm.dirty ? '' : 'none';
  var idx = _smGroupIndex(), html = '';
  if (_sm.tab === 'groups') {
    var prim = Object.keys(_sm.tags).sort(function(a, b){ return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
    html = prim.filter(function(p){ return _smMatches(p) || (_sm.tags[p] || []).some(_smMatches); }).map(function(p){
      var mem = [p].concat(_sm.tags[p] || []);
      return '<div class="sm-card"><div class="sm-card-h"><b>👤 ' + esc(p) + '</b><span class="sm-sp"></span><button type="button" class="btn secondary sm" data-smren="' + esc(p) + '">Đổi tên chính</button>' +
        '<button type="button" class="btn secondary sm" data-smadd="' + esc(p) + '">＋ Thêm tên</button><button type="button" class="btn danger sm" data-smdel="' + esc(p) + '">Tách nhóm</button></div>' +
        '<div class="sm-chips">' + mem.map(function(n){ return '<span class="sm-chip">' + esc(n) + _smBadges(_smRec(n)) + '<button type="button" class="sm-x" data-smrm="' + esc(n) + '" title="Bỏ khỏi nhóm">✕</button></span>'; }).join('') + '</div></div>';
    }).join('');
    // Nhóm hệ thống tự gộp (qua Quản lý tài khoản / Users nhiều tên / PancakeNameMap) — chưa nằm trong khớp tay
    var auto = {}, hasFree = {};
    _sm.names.forEach(function(r){ if (!r.person) return; (auto[r.person] = auto[r.person] || []).push(r); if (!idx[_smF(r.name)]) hasFree[r.person] = true; });
    var autoHtml = Object.keys(auto).filter(function(k){ return hasFree[k] && auto[k].length > 1 && auto[k].some(function(r){ return _smMatches(r.name); }); }).map(function(k){
      return '<div class="sm-card sm-auto"><div class="sm-chips">' + auto[k].map(function(r){ return '<span class="sm-chip">' + esc(r.name) + _smBadges(r) + '</span>'; }).join('') + '</div>' +
        '<div class="sm-card-h"><span class="sm-muted">Hệ thống tự hiểu cùng 1 người (qua Quản lý tài khoản / Users / Pancake)</span><span class="sm-sp"></span><button type="button" class="btn secondary sm" data-smfix="' + esc(k) + '">Cố định thành nhóm</button></div></div>';
    }).join('');
    if (autoHtml) html += '<div class="sm-sec">Hệ thống đã tự gộp (từ Quản lý tài khoản / Users / Pancake)</div>' + autoHtml;
    if (!html) html = '<div class="sm-empty">Chưa có nhóm nào. Qua tab “Chưa khớp” chọn các tên của cùng 1 người rồi bấm “Gộp”.</div>';
  } else if (_sm.tab === 'free') {
    var free = _sm.names.filter(function(r){ return !idx[_smF(r.name)] && _smMatches(r.name); });
    html = free.length ? free.map(function(r){
      return '<label class="sm-row"><input type="checkbox" data-smsel="' + esc(r.name) + '"' + (_sm.sel[r.name] ? ' checked' : '') + '><span class="sm-nm">' + esc(r.name) + '</span>' + _smBadges(r) + '</label>';
    }).join('') : '<div class="sm-empty">Không có tên nào chưa khớp' + (_sm.q ? ' khớp từ khoá' : '') + '.</div>';
  } else {
    var clusters = {};
    _sm.names.forEach(function(r){
      if (idx[_smF(r.name)]) return;
      var k = _smKey(r.name).replace(/[0-9]+$/, ''); if (k.length < 4) return;
      (clusters[k] = clusters[k] || []).push(r);
    });
    var list = Object.keys(clusters).map(function(k){ return clusters[k]; }).filter(function(a){ return a.length > 1 && new Set(a.map(function(r){ return r.person; })).size > 1 && a.some(function(r){ return _smMatches(r.name); }); });
    html = list.length ? list.map(function(a, i){
      return '<div class="sm-card"><div class="sm-chips">' + a.map(function(r){ return '<span class="sm-chip">' + esc(r.name) + _smBadges(r) + '</span>'; }).join('') + '</div>' +
        '<div class="sm-card-h"><span class="sm-muted">Tên giống nhau (bỏ dấu/khoảng trắng/số đuôi) nhưng chưa khớp</span><span class="sm-sp"></span><button type="button" class="btn sm" data-smsug="' + esc(JSON.stringify(a.map(function(r){ return r.name; }))) + '">Gộp</button></div></div>';
    }).join('') : '<div class="sm-empty">Không có gợi ý nào.</div>';
  }
  if (_sm.errors.length) html += '<div class="sm-muted" style="padding:8px 14px">⚠ Một số nguồn không đọc được: ' + esc(_sm.errors.join('; ')) + '</div>';
  body.innerHTML = html; _smRenderFoot();
}
function _smRenderFoot(){
  var foot = document.getElementById('sm-foot'); if (!foot) return;
  var n = Object.keys(_sm.sel).length;
  foot.innerHTML = (_sm.tab === 'free' && n) ? '<span>Đã chọn <b>' + n + '</b> tên</span><span class="sm-sp"></span><button type="button" class="btn primary" id="sm-merge">🔗 Gộp thành 1 người</button>' : '';
  var m = document.getElementById('sm-merge'); if (m) m.addEventListener('click', function(){ _smMergeDlg(Object.keys(_sm.sel)); });
}
// ── thao tác trên dữ liệu làm việc ──
function _smRemoveFromGroups(name){
  var f = _smF(name);
  Object.keys(_sm.tags).forEach(function(p){
    if (_smF(p) === f) {
      var rest = (_sm.tags[p] || []).slice(); delete _sm.tags[p];
      if (rest.length > 1) _sm.tags[rest[0]] = rest.slice(1);   // tên chính bị bỏ -> tên đầu tiên còn lại làm chính
      return;
    }
    _sm.tags[p] = (_sm.tags[p] || []).filter(function(t){ return _smF(t) !== f; });
    if (!_sm.tags[p].length) delete _sm.tags[p];
  });
}
function _smAddTo(primary, names){
  names.forEach(function(n){ if (_smF(n) === _smF(primary)) return; _smRemoveFromGroups(n); });
  if (!_sm.tags[primary]) _sm.tags[primary] = [];
  var seen = {}; _sm.tags[primary].forEach(function(t){ seen[_smF(t)] = 1; }); seen[_smF(primary)] = 1;
  names.forEach(function(n){ if (!seen[_smF(n)]) { seen[_smF(n)] = 1; _sm.tags[primary].push(n); } });
  _smDirty();
}
function _smBodyClick(e){
  var t;
  if ((t = e.target.closest('[data-smrm]'))) { _smRemoveFromGroups(t.getAttribute('data-smrm')); _smDirty(); _smRender(); return; }
  if ((t = e.target.closest('[data-smdel]'))) { var p = t.getAttribute('data-smdel'); if (confirm('Tách nhóm “' + p + '”? Các tên sẽ về “Chưa khớp”.')) { delete _sm.tags[p]; _smDirty(); _smRender(); } return; }
  if ((t = e.target.closest('[data-smren]'))) {
    var old = t.getAttribute('data-smren'), nn = (prompt('Tên chính của nhóm:', old) || '').trim();
    if (nn && nn !== old) { var members = (_sm.tags[old] || []).slice(); delete _sm.tags[old]; _smRemoveFromGroups(nn); _sm.tags[nn] = members.filter(function(m){ return _smF(m) !== _smF(nn); }); if (_smF(nn) !== _smF(old) && !_sm.tags[nn].some(function(m){ return _smF(m) === _smF(old); })) _sm.tags[nn].unshift(old); _smDirty(); _smRender(); }
    return;
  }
  if ((t = e.target.closest('[data-smadd]'))) { _smPickDlg(t.getAttribute('data-smadd')); return; }
  if ((t = e.target.closest('[data-smfix]'))) {
    var all = _sm.names.filter(function(r){ return r.person === t.getAttribute('data-smfix'); }), gi = _smGroupIndex();
    var exist = all.map(function(r){ return gi[_smF(r.name)]; }).filter(Boolean)[0];   // đã có nhóm khớp tay -> thêm các tên còn lại vào đó
    var rest = all.filter(function(r){ return !gi[_smF(r.name)]; }).map(function(r){ return r.name; });
    if (exist) { _smAddTo(exist, rest); _smRender(); }
    else if (rest.length > 1) { _smAddTo(rest[0], rest.slice(1)); _smRender(); }
    return;
  }
  if ((t = e.target.closest('[data-smsug]'))) { var arr = JSON.parse(t.getAttribute('data-smsug')); _smAddTo(arr[0], arr.slice(1)); _smRender(); }
}
function _smDlg(html){ var d = document.getElementById('sm-dlg'); d.innerHTML = '<div class="sm-box sm-small">' + html + '</div>'; d.classList.add('open'); d.onclick = function(e){ if (e.target === d) _smDlgClose(); }; return d.firstChild; }
function _smDlgClose(){ var d = document.getElementById('sm-dlg'); d.classList.remove('open'); d.innerHTML = ''; }
// Gộp các tên đã chọn: vào nhóm có sẵn, hoặc tạo người mới (chọn tên chính)
function _smMergeDlg(names){
  var prim = Object.keys(_sm.tags).sort();
  var box = _smDlg('<div class="sm-head"><b>Gộp ' + names.length + ' tên</b><span class="sm-sp"></span><button type="button" class="btn secondary sm" id="sm-d-x">✕</button></div><div class="sm-form">' +
    '<div class="sm-muted">' + names.map(esc).join(' · ') + '</div>' +
    '<label>Gộp vào</label><select id="sm-d-to"><option value="">➕ Người mới</option>' + prim.map(function(p){ return '<option value="' + esc(p) + '">' + esc(p) + '</option>'; }).join('') + '</select>' +
    '<div id="sm-d-newwrap"><label>Tên chính của người mới</label><select id="sm-d-main">' + names.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</select></div>' +
    '<div class="sm-btns"><button type="button" class="btn primary" id="sm-d-ok">Gộp</button></div></div>');
  box.querySelector('#sm-d-x').onclick = _smDlgClose;
  box.querySelector('#sm-d-to').onchange = function(){ box.querySelector('#sm-d-newwrap').style.display = this.value ? 'none' : ''; };
  box.querySelector('#sm-d-ok').onclick = function(){
    var to = box.querySelector('#sm-d-to').value;
    if (to) _smAddTo(to, names);
    else { var main = box.querySelector('#sm-d-main').value; _smAddTo(main, names.filter(function(n){ return n !== main; })); if (!_sm.tags[main]) _sm.tags[main] = []; }
    _sm.sel = {}; _smDlgClose(); _smRender();
  };
}
// Thêm tên (chưa khớp) vào 1 nhóm
function _smPickDlg(primary){
  var idx = _smGroupIndex(), free = _sm.names.filter(function(r){ return !idx[_smF(r.name)]; });
  var box = _smDlg('<div class="sm-head"><b>Thêm tên vào “' + esc(primary) + '”</b><span class="sm-sp"></span><button type="button" class="btn secondary sm" id="sm-d-x">✕</button></div><div class="sm-form">' +
    '<input id="sm-d-q" type="search" placeholder="Tìm tên…"><div class="sm-pick" id="sm-d-list"></div>' +
    '<label>Hoặc gõ tên chưa có trong danh sách</label><input id="sm-d-new" placeholder="vd: ninhnga1999"><div class="sm-btns"><button type="button" class="btn primary" id="sm-d-ok">Thêm</button></div></div>');
  function list(){ var q = _smF(box.querySelector('#sm-d-q').value); box.querySelector('#sm-d-list').innerHTML = free.filter(function(r){ return !q || _smF(r.name).indexOf(q) >= 0 || _smKey(r.name).indexOf(_smKey(q)) >= 0; }).slice(0, 80).map(function(r){
    return '<label class="sm-row"><input type="checkbox" value="' + esc(r.name) + '"><span class="sm-nm">' + esc(r.name) + '</span>' + _smBadges(r) + '</label>'; }).join('') || '<div class="sm-empty">Không có tên phù hợp</div>'; }
  list(); box.querySelector('#sm-d-q').oninput = list; box.querySelector('#sm-d-x').onclick = _smDlgClose;
  box.querySelector('#sm-d-ok').onclick = function(){
    var names = [].slice.call(box.querySelectorAll('#sm-d-list input:checked')).map(function(c){ return c.value; });
    var typed = box.querySelector('#sm-d-new').value.trim(); if (typed) names.push(typed);
    if (!names.length) { _smToast('Chọn hoặc gõ ít nhất 1 tên'); return; }
    _smAddTo(primary, names); _smDlgClose(); _smRender();
  };
}
async function smSave(){
  var btn = document.getElementById('sm-save'); btn.disabled = true;
  try {
    SALE_PERSON_TAGS = JSON.parse(JSON.stringify(_sm.tags));
    await _ptSave();
    _sm.dirty = false; _smToast('Đã lưu khớp sale — mở lại báo cáo để áp dụng');
    await openSaleMatchModal();
  } catch(e){ _smToast('Lỗi lưu: ' + e.message); }
  btn.disabled = false;
}

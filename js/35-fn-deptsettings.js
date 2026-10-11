// ════════════════════════════════════════════════════════════════════
//  CÀI ĐẶT PHÒNG BAN (yêu cầu Duyên 2026-10-11) — admin chia người vào phòng ở màn Tổng quan.
//  TÁCH RIÊNG khỏi "đội" Online/Văn phòng/Thử việc (SALE_GROUPS/SALE_CHANNELS dùng cho Chương trình thưởng) nên gán phòng KHÔNG ảnh hưởng thưởng.
//  Lưu ở Settings: deptList = [{key,label}], saleDepts = {tênNgười: keyPhòng} (GAS orgOverview_ đọc: gas/…readDeptList_, readSaleDepts_, _orgApplyDepts_).
// ════════════════════════════════════════════════════════════════════
var DEPT_DEFAULT = [
  { key:'marketing', label:'Marketing' }, { key:'sale', label:'Sale' }, { key:'cuahang', label:'Cửa hàng' },
  { key:'sanxuat', label:'Sản xuất' }, { key:'thanhpham', label:'Thành phẩm' }, { key:'nguon', label:'Nguồn' },
  { key:'ketoan', label:'Kế toán' }, { key:'hr', label:'HR' }, { key:'media', label:'Media' }
];
var DEPT_LIST = DEPT_DEFAULT.slice();   // cập nhật theo d.deptList mỗi lần tải Tổng quan (js/31) — form tài khoản Quản lý (js/15) dùng danh sách này
var _dp = { list: [], map: {}, q: '' };

function openDeptSettings(){
  if (!currentUser || currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài đặt phòng.'); return; }
  if (typeof _ov === 'undefined' || !_ov || !_ov.data){ toast('Đợi màn Tổng quan tải xong rồi mở lại.'); return; }
  var base = (_ov.data.deptList && _ov.data.deptList.length) ? _ov.data.deptList : DEPT_LIST;
  _dp.list = base.map(function(g){ return { key:g.key, label:g.label }; });
  _dp.map = Object.assign({}, _ov.data.saleDepts || {});
  _dp.q = '';
  _dpCloseModal();
  var m = document.createElement('div');
  m.id = 'dept-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto';
  m.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:640px;width:100%;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.3)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:15px">⚙ Cài đặt phòng</b><button class="btn sm" onclick="_dpCloseModal()">✕ Đóng</button></div>' +
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px;line-height:1.5">Phòng ban độc lập với Online / Văn phòng / Thử việc — gán phòng <b>không ảnh hưởng</b> đối tượng thưởng hay các báo cáo khác.</div>' +
    '<div id="dp-rooms"></div><div id="dp-teams"></div><div id="dp-people"></div>' +
    '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end"><button class="btn sm" onclick="_dpCloseModal()">Hủy</button><button class="btn sm primary" id="dp-save" onclick="_dpSave()">💾 Lưu phòng</button></div></div>';
  document.body.appendChild(m);
  _dpRenderRooms(); _dpRenderTeams(); _dpRenderPeople();
}
function _dpCloseModal(){ var m = document.getElementById('dept-modal'); if (m) m.remove(); }
function _dpOpts(sel, blank){
  return '<option value="">' + blank + '</option>' + _dp.list.filter(function(g){ return String(g.label || '').trim(); }).map(function(g){
    return '<option value="' + esc(g.key) + '"' + (sel === g.key ? ' selected' : '') + '>' + esc(g.label) + '</option>'; }).join('');
}
function _dpCount(key){ return Object.keys(_dp.map).filter(function(n){ return _dp.map[n] === key; }).length; }

function _dpRenderRooms(){
  var el = document.getElementById('dp-rooms'); if (!el) return;
  el.innerHTML = '<div style="font-weight:600;font-size:13px;margin:4px 0 6px">🏢 Danh sách phòng</div>' + _dp.list.map(function(g, i){
    return '<div style="display:flex;gap:6px;align-items:center;margin-bottom:5px"><input type="text" value="' + esc(g.label) + '" placeholder="Tên phòng" oninput="_dp.list[' + i + '].label=this.value" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px">' +
      '<span style="font-size:11px;color:var(--muted);min-width:56px">' + _dpCount(g.key) + ' người</span>' +
      '<button class="btn xs danger" onclick="_dpDelRoom(' + i + ')" title="Xóa phòng">🗑</button></div>';
  }).join('') + '<button class="btn sm secondary" onclick="_dp.list.push({key:\'d\'+Date.now(),label:\'\'});_dpRenderRooms();_dpRenderTeams();_dpRenderPeople()">+ Thêm phòng</button>';
}
function _dpDelRoom(i){
  var g = _dp.list[i]; if (!g) return;
  var n = _dpCount(g.key);
  if (n && !confirm('Phòng "' + g.label + '" đang có ' + n + ' người. Xóa phòng thì những người này thành "chưa phân phòng". Xóa?')) return;
  Object.keys(_dp.map).forEach(function(k){ if (_dp.map[k] === g.key) delete _dp.map[k]; });
  _dp.list.splice(i, 1); _dpRenderRooms(); _dpRenderTeams(); _dpRenderPeople();
}
function _dpRenderTeams(){
  var el = document.getElementById('dp-teams'); if (!el) return;
  var teams = (_ov && _ov.data && _ov.data.teams) || [];
  if (!teams.length){ el.innerHTML = ''; return; }
  el.innerHTML = '<div style="font-weight:600;font-size:13px;margin:12px 0 6px">👥 Gán nhanh cả team vào phòng</div><table class="dash-table"><thead><tr><th>Team</th><th style="width:56px">Người</th><th style="width:170px">Gán vào phòng</th></tr></thead><tbody>' +
    teams.map(function(t, i){ return '<tr><td>' + esc(t.name) + '</td><td>' + (t.members || []).length + '</td><td><select onchange="_dpAssignTeam(' + i + ',this.value);this.value=\'\'" style="width:160px">' + _dpOpts('', '— chọn phòng —') + '</select></td></tr>'; }).join('') + '</tbody></table>';
}
function _dpAssignTeam(i, key){
  var t = ((_ov.data && _ov.data.teams) || [])[i]; if (!t || !key) return;
  (t.members || []).forEach(function(n){ _dp.map[n] = key; });
  _dpRenderRooms(); _dpRenderPeople();
}
function _dpNames(){
  var seen = {}, out = [];
  (((_ov && _ov.data && _ov.data.people) || []).map(function(p){ return p.name; }).concat(Object.keys(_dp.map))).forEach(function(n){
    var k = String(n || '').trim().toLowerCase(); if (!k || seen[k]) return; seen[k] = true; out.push(String(n).trim()); });
  return out.sort(function(a, b){ return a.localeCompare(b, 'vi'); });
}
function _dpRenderPeople(){
  var el = document.getElementById('dp-people'); if (!el) return;
  var q = (_dp.q || '').toLowerCase();
  var rows = _dpNames().filter(function(n){ return !q || n.toLowerCase().indexOf(q) !== -1; });
  el.innerHTML = '<div style="font-weight:600;font-size:13px;margin:12px 0 6px">🧑‍💼 Từng người</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap"><input type="text" placeholder="🔍 Tìm tên…" value="' + esc(_dp.q || '') + '" oninput="_dp.q=this.value;_dpRenderPeople();this.focus()" style="flex:1;min-width:140px;padding:5px 8px;border:1px solid var(--border);border-radius:6px">' +
    '<input type="text" id="dp-new-name" placeholder="+ Thêm người (kế toán, HR…)" style="flex:1;min-width:150px;padding:5px 8px;border:1px solid var(--border);border-radius:6px">' +
    '<select id="dp-new-room" style="width:140px">' + _dpOpts('', '— phòng —') + '</select><button class="btn sm" onclick="_dpAddPerson()">Thêm</button></div>' +
    '<div style="max-height:42vh;overflow:auto"><table class="dash-table"><thead><tr><th>Tên</th><th style="width:170px">Phòng</th></tr></thead><tbody>' +
    rows.map(function(n){ return '<tr><td>' + esc(n) + '</td><td><select data-n="' + esc(n) + '" onchange="_dpSetPerson(this.dataset.n,this.value)" style="width:160px">' + _dpOpts(_dp.map[n] || '', '— chưa phân phòng —') + '</select></td></tr>'; }).join('') +
    (rows.length ? '' : '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:12px">Không có tên nào khớp</td></tr>') + '</tbody></table></div>';
}
function _dpSetPerson(n, key){ if (key) _dp.map[n] = key; else delete _dp.map[n]; _dpRenderRooms(); }
function _dpAddPerson(){
  var n = ((document.getElementById('dp-new-name') || {}).value || '').trim(), k = (document.getElementById('dp-new-room') || {}).value;
  if (!n || !k){ toast('Nhập tên và chọn phòng'); return; }
  _dp.map[n] = k; _dp.q = ''; _dpRenderRooms(); _dpRenderPeople();
}
async function _dpSave(){
  var list = _dp.list.filter(function(g){ return String(g.label || '').trim(); }).map(function(g){ return { key:g.key, label:g.label.trim() }; });
  if (!list.length){ toast('Cần ít nhất 1 phòng'); return; }
  var ok = {}; list.forEach(function(g){ ok[g.key] = true; });
  var map = {}; Object.keys(_dp.map).forEach(function(n){ if (_dp.map[n] && ok[_dp.map[n]]) map[n] = _dp.map[n]; });
  if (!gsUrl){ toast('Chưa kết nối Google Apps Script'); return; }
  var btn = document.getElementById('dp-save'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang lưu…'; }
  try {
    var pairs = [['deptList', list], ['saleDepts', map]];
    for (var i = 0; i < pairs.length; i++){
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key: pairs[i][0], value: JSON.stringify(pairs[i][1]) }) });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) throw new Error(d.error);
    }
    DEPT_LIST = list; _dpCloseModal(); toast('✓ Đã lưu phòng');
    if (typeof _ovAfterRoomChange === 'function') _ovAfterRoomChange();
  } catch (e) {
    toast('Lưu lỗi: ' + (e && e.message || e));
    if (btn){ btn.disabled = false; btn.textContent = '💾 Lưu phòng'; }
  }
}

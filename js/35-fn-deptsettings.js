// ════════════════════════════════════════════════════════════════════
//  CÀI ĐẶT PHÒNG BAN (yêu cầu Duyên 2026-10-11; 2026-10-14: thành TRANG RIÊNG toàn màn hình, sửa lỗi lưu) — admin chia người vào phòng.
//  TÁCH RIÊNG khỏi "đội" Online/Văn phòng/Thử việc (SALE_GROUPS/SALE_CHANNELS dùng cho Chương trình thưởng) nên gán phòng KHÔNG ảnh hưởng thưởng.
//  Lưu ở Settings: deptList = [{key,label}], saleDepts = {tênNgười: keyPhòng} (GAS orgOverview_ đọc: readDeptList_, readSaleDepts_, _orgApplyDepts_).
//
//  NGUYÊN NHÂN GỐC lỗi "bấm cài không được" (bản modal cũ): (1) nút Lưu nằm ở cuối hộp thoại cuộn dài nên dễ không thấy; (2) mở phải ĐỢI màn Tổng quan
//  tải xong (cần _ov.data — màn này nặng 20–60 giây, khi GAS lỗi thì không mở được); (3) lỗi chỉ hiện 1 toast thoáng qua, và nếu máy chủ trả về trang HTML
//  (GAS chưa deploy/hết hạn mức) thì r.json() bị nuốt thành {} → coi như "lưu OK" dù KHÔNG lưu; (4) lưu 2 key liên tiếp, key thứ 2 lỗi thì không báo gì.
//  Giờ: trang riêng (mở từ Settings → 🏢 Phòng ban hoặc nút ⚙ Cài đặt phòng ở Tổng quan), tự đọc cấu hình trực tiếp từ máy chủ (không cần Tổng quan),
//  nút Lưu luôn ở thanh trên, mọi lỗi hiện nguyên văn ngay trên trang + gợi ý, lưu xong ĐỌC LẠI từ máy chủ để xác nhận thật sự đã lưu.
// ════════════════════════════════════════════════════════════════════
var DEPT_DEFAULT = [
  { key:'marketing', label:'Marketing' }, { key:'sale', label:'Sale' }, { key:'cuahang', label:'Cửa hàng' },
  { key:'sanxuat', label:'Sản xuất' }, { key:'thanhpham', label:'Thành phẩm' }, { key:'nguon', label:'Nguồn' },
  { key:'ketoan', label:'Kế toán' }, { key:'hr', label:'HR' }, { key:'media', label:'Media' }
];
var DEPT_LIST = DEPT_DEFAULT.slice();   // cập nhật theo d.deptList mỗi lần tải Tổng quan (js/31) — form tài khoản Quản lý (js/15) dùng danh sách này
var _dp = { list: [], map: {}, q: '', sec: 'rooms', dirty: false, err: '', ok: '', busy: false };
var _DP_SECS = [['rooms', '🏢 Danh sách phòng'], ['teams', '👥 Gán theo team'], ['people', '🧑‍💼 Từng người']];

// ── mạng: có hạn chờ, đọc JSON chặt chẽ (không nuốt lỗi) ──
async function _dpFetch(url, opts){
  var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null, timer = ac ? setTimeout(function(){ ac.abort(); }, 25000) : null;
  try { return await fetch(url, Object.assign({ redirect: 'follow' }, opts || {}, ac ? { signal: ac.signal } : {})); }
  catch (e) { throw new Error(e && e.name === 'AbortError' ? 'Quá thời gian chờ máy chủ (25 giây)' : ('Không kết nối được máy chủ: ' + (e && e.message || e))); }
  finally { if (timer) clearTimeout(timer); }
}
async function _dpJson(r){
  var t = await r.text(), j = null;
  try { j = JSON.parse(t); } catch (e) {}
  if (j === null || typeof j !== 'object')
    throw new Error('Máy chủ trả về trang không phải dữ liệu (HTTP ' + r.status + '): "' + String(t).replace(/\s+/g, ' ').slice(0, 110) + '…" — thường do Apps Script chưa deploy đúng, hết hạn mức hoặc mất mạng.');
  return j;
}
async function _dpGet(key){
  var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
  var j = await _dpJson(await _dpFetch(gsUrl + sep + 'action=getSetting&key=' + encodeURIComponent(key) + '&_t=' + Date.now()));   // _t: tránh bản cache
  if (j.error) throw new Error(j.error);
  return j;
}
async function _dpPost(key, val){
  var d = await _dpJson(await _dpFetch(gsUrl, { method: 'POST', body: JSON.stringify({ action: 'setSetting', key: key, value: JSON.stringify(val) }) }));
  if (d.error) throw new Error(d.error);
  if (d.ok !== true) throw new Error('Máy chủ phản hồi lạ: ' + JSON.stringify(d).slice(0, 120));
}
function _dpParse(j){ try { return (j && j.value) ? JSON.parse(j.value) : null; } catch (e) { return null; } }
function _dpSortKeys(o){ var r = {}; Object.keys(o || {}).sort().forEach(function(k){ r[k] = o[k]; }); return r; }

// ── mở / đóng trang ──
async function openDeptSettings(){
  if (!currentUser || currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài đặt phòng.'); return; }
  var ov = document.getElementById('dp-page');
  if (!ov){ ov = document.createElement('div'); ov.id = 'dp-page'; ov.className = 'rs-page'; document.body.appendChild(ov); }
  ov.classList.add('open'); document.body.classList.add('rs-open');
  _dp = { list: [], map: {}, q: '', sec: 'rooms', dirty: false, err: '', ok: '', busy: false };
  ov.innerHTML = '<div class="rs-loading">Đang tải cấu hình phòng…</div>';
  if (!gsUrl){ _dpLoadFail('Chưa kết nối Google Apps Script (chưa có link GAS).'); return; }
  try {
    var dl = _dpParse(await _dpGet('deptList')), sd = _dpParse(await _dpGet('saleDepts'));
    var base = (Array.isArray(dl) && dl.length) ? dl : ((typeof _ov !== 'undefined' && _ov && _ov.data && _ov.data.deptList && _ov.data.deptList.length) ? _ov.data.deptList : DEPT_DEFAULT);
    _dp.list = base.map(function(g){ return { key: g.key, label: g.label }; });
    _dp.map = (sd && typeof sd === 'object' && !Array.isArray(sd)) ? Object.assign({}, sd) : {};
    _dpRender();
  } catch (e) { _dpLoadFail(e && e.message || String(e)); }
}
function _dpLoadFail(msg){
  var ov = document.getElementById('dp-page'); if (!ov) return;
  ov.innerHTML = '<div class="rs-head"><button class="btn secondary sm" onclick="closeDeptSettings(true)">← Quay lại</button><div class="rs-title">🏢 Phòng ban</div></div>' +
    '<div class="rs-main"><div class="dpg-banner err"><b>Không tải được cấu hình phòng.</b><br>' + esc(msg) + '<br><span style="font-size:12px">Thử mở <code>' + esc((gsUrl || '') + (String(gsUrl || '').indexOf('?') > -1 ? '&' : '?') + 'action=count') + '</code> trong tab mới: phải thấy dữ liệu dạng <code>{"orderRows":…,"ver":"…"}</code>. Nếu không, GAS chưa deploy đúng / hết hạn mức.</span></div>' +
    '<button class="btn primary" onclick="openDeptSettings()">↻ Thử lại</button></div>';
}
function closeDeptSettings(force){
  if (!force && _dp.dirty && !confirm('Có thay đổi CHƯA LƯU. Đóng và bỏ thay đổi?')) return;
  var ov = document.getElementById('dp-page'); if (ov) ov.classList.remove('open');
  document.body.classList.remove('rs-open');
}
// Dat ten _dpMarkDirty (KHONG phai _dpDirty): js/06 da co `let _dpDirty` (co 'dang go do trong ho so khach') — trung ten la SyntaxError
// 'Identifier has already been declared', ca file nay khong chay duoc (trang Phong ban + DEPT_LIST mac dinh deu mat).
function _dpMarkDirty(){
  _dp.dirty = true; _dp.ok = '';
  var b = document.getElementById('dp-save'); if (b){ b.disabled = false; b.textContent = '💾 Lưu phòng'; }
  var h = document.getElementById('dp-dirty'); if (h) h.style.display = '';
  var o = document.getElementById('dp-okbar'); if (o) o.style.display = 'none';
}
function _dpSetSec(s){ _dp.sec = s; _dpRender(); }

// ── dữ liệu phụ ──
function _dpOpts(sel, blank){
  return '<option value="">' + blank + '</option>' + _dp.list.filter(function(g){ return String(g.label || '').trim(); }).map(function(g){
    return '<option value="' + esc(g.key) + '"' + (sel === g.key ? ' selected' : '') + '>' + esc(g.label) + '</option>'; }).join('');
}
function _dpCount(key){ return Object.keys(_dp.map).filter(function(n){ return _dp.map[n] === key; }).length; }
function _dpTeams(){
  var t = (typeof teams !== 'undefined' && Array.isArray(teams) && teams.length) ? teams : ((typeof _ov !== 'undefined' && _ov && _ov.data && _ov.data.teams) || []);
  return t.map(function(x){ return { name: x.name || '(chưa đặt tên)', members: Array.isArray(x.members) ? x.members : [] }; });
}
function _dpNames(){
  var seen = {}, out = [], src = [];
  _dpTeams().forEach(function(t){ src = src.concat(t.members); });
  if (typeof _ov !== 'undefined' && _ov && _ov.data && _ov.data.people) src = src.concat(_ov.data.people.map(function(p){ return p.name; }));
  if (typeof accounts !== 'undefined' && Array.isArray(accounts)) accounts.forEach(function(a){
    var ns = Array.isArray(a.names) ? a.names : String(a.names || '').split(','); src = src.concat(ns); if (a.name) src.push(a.name); });
  src = src.concat(Object.keys(_dp.map));
  src.forEach(function(n){ var k = String(n || '').trim().toLowerCase(); if (!k || seen[k]) return; seen[k] = true; out.push(String(n).trim()); });
  return out.sort(function(a, b){ return a.localeCompare(b, 'vi'); });
}

// ── vẽ trang ──
function _dpRender(){
  var ov = document.getElementById('dp-page'); if (!ov) return;
  var body = _dp.sec === 'rooms' ? _dpRoomsHtml() : (_dp.sec === 'teams' ? _dpTeamsHtml() : _dpPeopleHtml());
  var msgs = (_dp.err ? '<div class="dpg-banner err" id="dp-errbar"><b>Chưa lưu được.</b> ' + _dp.err + '</div>' : '') +
             '<div class="dpg-banner ok" id="dp-okbar" style="' + (_dp.ok ? '' : 'display:none') + '">' + esc(_dp.ok) + '</div>';
  ov.innerHTML = '<div class="rs-head"><button class="btn secondary sm" onclick="closeDeptSettings()">← Quay lại</button><div class="rs-title">🏢 Phòng ban</div><span class="rs-sp"></span>' +
    '<span id="dp-dirty" class="rs-dirty" style="' + (_dp.dirty ? '' : 'display:none') + '">● Chưa lưu</span>' +
    '<button id="dp-save" class="btn primary" onclick="_dpSave()"' + ((_dp.dirty && !_dp.busy) ? '' : ' disabled') + '>' + (_dp.busy ? '⏳ Đang lưu…' : '💾 Lưu phòng') + '</button></div>' +
    '<div class="rs-body"><div class="rs-nav">' + _DP_SECS.map(function(s){ return '<button class="rs-navbtn' + (_dp.sec === s[0] ? ' on' : '') + '" onclick="_dpSetSec(\'' + s[0] + '\')">' + s[1] + '</button>'; }).join('') +
    '<div class="rs-note">Phòng ban <b>độc lập</b> với Online / Văn phòng / Thử việc — gán phòng <b>không ảnh hưởng</b> đối tượng thưởng hay các báo cáo khác.<br><br>Chỉnh xong bấm <b>💾 Lưu phòng</b> ở thanh trên.</div></div>' +
    '<div class="rs-main">' + msgs + body + '</div></div>';
}
function _dpRoomsHtml(){
  return '<h3>🏢 Danh sách phòng</h3><div style="font-size:12px;color:var(--muted);margin-bottom:10px">Đặt tên phòng, thêm hoặc xóa tuỳ ý. Phòng để trống tên sẽ bị bỏ khi lưu.</div>' +
    _dp.list.map(function(g, i){
      return '<div class="dpg-row"><input type="text" value="' + esc(g.label) + '" placeholder="Tên phòng" oninput="_dpRoomLabel(' + i + ',this.value)" class="dpg-in">' +
        '<span class="dpg-cnt">' + _dpCount(g.key) + ' người</span>' +
        '<button class="btn xs danger" onclick="_dpDelRoom(' + i + ')" title="Xóa phòng">🗑</button></div>';
    }).join('') + '<button class="btn sm secondary" onclick="_dpAddRoom()">＋ Thêm phòng</button>';
}
function _dpRoomLabel(i, v){ if (_dp.list[i]){ _dp.list[i].label = v; _dpMarkDirty(); } }
function _dpAddRoom(){ _dp.list.push({ key: 'd' + Date.now(), label: '' }); _dpMarkDirty(); _dpRender(); }
function _dpDelRoom(i){
  var g = _dp.list[i]; if (!g) return;
  var n = _dpCount(g.key);
  if (n && !confirm('Phòng "' + g.label + '" đang có ' + n + ' người. Xóa phòng thì những người này thành "chưa phân phòng". Xóa?')) return;
  Object.keys(_dp.map).forEach(function(k){ if (_dp.map[k] === g.key) delete _dp.map[k]; });
  _dp.list.splice(i, 1); _dpMarkDirty(); _dpRender();
}
function _dpTeamsHtml(){
  var ts = _dpTeams();
  if (!ts.length) return '<h3>👥 Gán theo team</h3><div class="dpg-banner">Chưa có team nào. Tạo team ở <b>Cài đặt team</b> rồi quay lại đây (hoặc gán từng người ở mục “Từng người”).</div>';
  return '<h3>👥 Gán nhanh cả team vào phòng</h3><div style="font-size:12px;color:var(--muted);margin-bottom:10px">Chọn phòng cho team: tất cả thành viên của team được gán vào phòng đó (có thể chỉnh lại từng người ở mục “Từng người”).</div>' +
    '<table class="dash-table"><thead><tr><th>Team</th><th style="width:70px">Người</th><th style="width:190px">Gán vào phòng</th></tr></thead><tbody>' +
    ts.map(function(t, i){ return '<tr><td>' + esc(t.name) + '</td><td>' + t.members.length + '</td><td><select onchange="_dpAssignTeam(' + i + ',this.value);this.value=\'\'" style="width:180px">' + _dpOpts('', '— chọn phòng —') + '</select></td></tr>'; }).join('') + '</tbody></table>';
}
function _dpAssignTeam(i, key){
  var t = _dpTeams()[i]; if (!t || !key) return;
  t.members.forEach(function(n){ _dp.map[n] = key; });
  _dpMarkDirty(); _dp.ok = ''; toast('Đã gán ' + t.members.length + ' người của team "' + t.name + '" — nhớ bấm Lưu phòng');
}
function _dpPeopleHtml(){
  return '<h3>🧑‍💼 Từng người</h3>' +
    '<div class="dpg-bar"><input type="text" placeholder="🔍 Tìm tên…" value="' + esc(_dp.q || '') + '" oninput="_dp.q=this.value;_dpPeopleList()" class="dpg-in" style="min-width:140px">' +
    '<input type="text" id="dp-new-name" placeholder="+ Thêm người (kế toán, HR…)" class="dpg-in" style="min-width:150px">' +
    '<select id="dp-new-room" style="width:150px">' + _dpOpts('', '— phòng —') + '</select><button class="btn sm" onclick="_dpAddPerson()">Thêm</button></div>' +
    '<div id="dp-people-list">' + _dpPeopleListHtml() + '</div>';
}
function _dpPeopleListHtml(){
  var q = (_dp.q || '').toLowerCase();
  var rows = _dpNames().filter(function(n){ return !q || n.toLowerCase().indexOf(q) !== -1; });
  return '<div style="max-height:60vh;overflow:auto"><table class="dash-table"><thead><tr><th>Tên</th><th style="width:190px">Phòng</th></tr></thead><tbody>' +
    rows.map(function(n){ return '<tr><td>' + esc(n) + '</td><td><select data-n="' + esc(n) + '" onchange="_dpSetPerson(this.dataset.n,this.value)" style="width:180px">' + _dpOpts(_dp.map[n] || '', '— chưa phân phòng —') + '</select></td></tr>'; }).join('') +
    (rows.length ? '' : '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:12px">Không có tên nào khớp</td></tr>') + '</tbody></table></div>';
}
function _dpPeopleList(){ var el = document.getElementById('dp-people-list'); if (el) el.innerHTML = _dpPeopleListHtml(); }
function _dpSetPerson(n, key){ if (key) _dp.map[n] = key; else delete _dp.map[n]; _dpMarkDirty(); }
function _dpAddPerson(){
  var n = ((document.getElementById('dp-new-name') || {}).value || '').trim(), k = (document.getElementById('dp-new-room') || {}).value;
  if (!n || !k){ toast('Nhập tên và chọn phòng'); return; }
  _dp.map[n] = k; _dp.q = ''; _dpMarkDirty(); _dpRender();
}

// ── lưu: kiểm tra → ghi 2 key → ĐỌC LẠI xác nhận ──
async function _dpSave(){
  if (_dp.busy) return;
  _dp.err = '';
  var list = _dp.list.filter(function(g){ return String(g.label || '').trim(); }).map(function(g){ return { key: g.key, label: g.label.trim() }; });
  if (!list.length){ _dp.err = 'Cần ít nhất 1 phòng có tên.'; _dpRender(); return; }
  var seen = {}, dup = '';
  list.forEach(function(g){ var k = g.label.toLowerCase(); if (seen[k]) dup = g.label; seen[k] = true; });
  if (dup){ _dp.err = 'Hai phòng đang trùng tên “' + esc(dup) + '”. Đổi tên một trong hai rồi lưu lại.'; _dpRender(); return; }
  var ok = {}; list.forEach(function(g){ ok[g.key] = true; });
  var map = {}; Object.keys(_dp.map).forEach(function(n){ if (_dp.map[n] && ok[_dp.map[n]]) map[n] = _dp.map[n]; });
  if (!gsUrl){ _dp.err = 'Chưa kết nối Google Apps Script (chưa có link GAS).'; _dpRender(); return; }
  _dp.busy = true; _dpRender();
  var stage = 'ghi danh sách phòng';
  try {
    await _dpPost('deptList', list);
    stage = 'ghi người thuộc từng phòng'; await _dpPost('saleDepts', map);
    stage = 'đọc lại để xác nhận';
    var b1 = _dpParse(await _dpGet('deptList')), b2 = _dpParse(await _dpGet('saleDepts'));
    if (JSON.stringify(b1) !== JSON.stringify(list) || JSON.stringify(_dpSortKeys(b2 || {})) !== JSON.stringify(_dpSortKeys(map)))
      throw new Error('máy chủ báo đã lưu nhưng đọc lại thấy khác. Tải lại trang (Ctrl+F5) rồi kiểm tra lại.');
    DEPT_LIST = list; _dp.list = list.map(function(g){ return { key: g.key, label: g.label }; }); _dp.map = map; _dp.dirty = false;
    _dp.ok = '✓ Đã lưu và xác nhận trên máy chủ: ' + list.length + ' phòng, ' + Object.keys(map).length + ' người được gán phòng.';
    toast('✓ Đã lưu phòng');
  } catch (e) {
    var msg = esc(e && e.message || String(e));
    _dp.err = 'Lỗi ở bước “' + stage + '”: ' + msg + (stage === 'ghi người thuộc từng phòng' ? '<br>Danh sách phòng đã lưu, nhưng việc gán người CHƯA lưu — bấm 💾 Lưu phòng để thử lại.' : '') + '<br><span style="font-size:12px">Bấm 💾 Lưu phòng để thử lại; nếu vẫn lỗi, mở <code>' + esc(gsUrl) + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=count</code> trong tab mới để kiểm tra GAS có phản hồi không.</span>';
    _dp.dirty = true;
  } finally { _dp.busy = false; _dpRender(); }
  if (_dp.ok){ try { if (typeof _ovAfterRoomChange === 'function') _ovAfterRoomChange(); } catch (e2) {} }   // làm mới Tổng quan nền; lỗi ở đây KHÔNG được báo thành lỗi lưu
}

// ═══════════════════════════════════════════════════════
//  TỒN KHO (2026-10-12) — CRM thay Pos làm nơi cập nhật tồn thật. Backend: gas_v13.js (khối KHO, docs/crm-kb/07 + 08-kho.md).
//  Menu "📦 Tồn kho" (js/29-sidenav.js, ACTS.kho) mở modal này. Mọi người xem; sửa tồn: nhân viên/leader của kho + admin;
//  thêm/xoá mặt hàng + nhập Excel: leader + admin; tạo/sửa kho: admin. SERVER kiểm quyền thật — client chỉ ẩn/hiện nút.
//  Token phiên do bộ bọc fetch (js/06-main-renew-sources.js) tự gắn vào GET/POST.
// ═══════════════════════════════════════════════════════
var _tk = { kho: [], cur: '', items: [], q: '', low: false, shown: 200, busy: false, loaded: false };

function _tkNorm(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim(); }
function _tkNum(n){ var x = Number(n); return isFinite(x) ? x.toLocaleString('vi-VN') : String(n == null ? '' : n); }
function _tkUser(){ try { return String((typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) || (typeof currentUser !== 'undefined' && currentUser && currentUser.username) || '').trim().toLowerCase(); } catch(e){ return ''; } }
function _tkIsAdmin(){ try { return (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && !!_bootstrapAdmin); } catch(e){ return false; } }
// 'admin' | 'leader' | 'staff' | '' — chỉ để ẩn/hiện nút; server kiểm lại.
function _tkLevel(k){
  if (_tkIsAdmin()) return 'admin';
  var u = _tkUser(); if (!u || !k) return '';
  if ((k.leaders || []).indexOf(u) >= 0) return 'leader';
  if ((k.staff || []).indexOf(u) >= 0) return 'staff';
  return '';
}
function _tkCanEdit(k){ return !!_tkLevel(k); }
function _tkCanManage(k){ var l = _tkLevel(k); return l === 'admin' || l === 'leader'; }
function _tkCurKho(){ return _tk.kho.find(function(k){ return k.id === _tk.cur; }) || null; }
function _tkIsLow(it){ return it.minTon != null && Number(it.minTon) > 0 && Number(it.ton) <= Number(it.minTon); }

function _tkOn(){
  try { if (typeof gsUrl === 'undefined' || !gsUrl) return false; if (localStorage.getItem('ome_demo_token')) return false; return !!localStorage.getItem('ome_sess_token'); } catch(e){ return false; }
}
function _tkGet(qs){
  var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
  return fetch(gsUrl + sep + qs, { redirect: 'follow' }).then(function(r){ return r.json(); });
}
function _tkPost(action, body){
  return fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(Object.assign({ action: action }, body || {})) }).then(function(r){ return r.json(); });
}
function _tkErr(j){ return (j && j.error) ? j.error : 'Lỗi không rõ'; }

// ── Khung modal chính + hộp thoại phụ ──
function _tkEnsure(){
  var ov = document.getElementById('tk-overlay'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'tk-overlay'; ov.className = 'tk-overlay';
  ov.innerHTML =
    '<div class="tk-box">' +
      '<div class="tk-head"><b>📦 Tồn kho</b><select id="tk-kho"></select><span class="tk-sp"></span>' +
        '<button type="button" class="btn secondary sm" id="tk-manage" style="display:none">⚙ Quản lý kho</button>' +
        '<button type="button" class="btn secondary sm" id="tk-close">✕</button></div>' +
      '<div class="tk-tools"><input id="tk-q" type="search" placeholder="Tìm mã hoặc tên hàng…" autocomplete="off">' +
        '<label class="tk-chk"><input type="checkbox" id="tk-low"> Sắp hết</label>' +
        '<button type="button" class="btn secondary sm" id="tk-new" style="display:none">＋ Mặt hàng</button>' +
        '<button type="button" class="btn secondary sm" id="tk-imp" style="display:none">📥 Nhập Excel</button>' +
        '<button type="button" class="btn secondary sm" id="tk-hist">📜 Lịch sử</button></div>' +
      '<div class="tk-info" id="tk-info"></div>' +
      '<div class="tk-list" id="tk-list"></div>' +
    '</div>';
  document.body.appendChild(ov);
  var dlg = document.createElement('div'); dlg.id = 'tk-dlg'; dlg.className = 'tk-overlay tk-dlg'; document.body.appendChild(dlg);
  ov.addEventListener('click', function(e){ if (e.target === ov) tkClose(); });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) tkDlgClose(); });
  document.getElementById('tk-close').addEventListener('click', tkClose);
  document.getElementById('tk-kho').addEventListener('change', function(){ _tk.cur = this.value; _tk.shown = 200; tkLoadItems(); });
  document.getElementById('tk-q').addEventListener('input', function(){ _tk.q = this.value; _tk.shown = 200; _tkRenderList(); });
  document.getElementById('tk-low').addEventListener('change', function(){ _tk.low = this.checked; _tk.shown = 200; _tkRenderList(); });
  document.getElementById('tk-new').addEventListener('click', function(){ tkItemDlg(null); });
  document.getElementById('tk-imp').addEventListener('click', tkImportDlg);
  document.getElementById('tk-hist').addEventListener('click', function(){ tkHistDlg(''); });
  document.getElementById('tk-manage').addEventListener('click', tkManageDlg);
  document.getElementById('tk-list').addEventListener('click', function(e){
    var more = e.target.closest('[data-tk-more]'); if (more) { _tk.shown += 200; _tkRenderList(); return; }
    var b = e.target.closest('[data-tk-edit]'); if (b) { tkEditDlg(b.getAttribute('data-tk-edit')); return; }
    var h = e.target.closest('[data-tk-hist]'); if (h) tkHistDlg(h.getAttribute('data-tk-hist'));
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { if (document.getElementById('tk-dlg').classList.contains('open')) tkDlgClose(); else tkClose(); } });
  return ov;
}
function tkClose(){ var ov = document.getElementById('tk-overlay'); if (ov) ov.classList.remove('open'); tkDlgClose(); }
function tkDlgClose(){ var d = document.getElementById('tk-dlg'); if (d) { d.classList.remove('open'); d.innerHTML = ''; } }
function _tkDlg(html){ var d = document.getElementById('tk-dlg'); d.innerHTML = '<div class="tk-box tk-sm">' + html + '</div>'; d.classList.add('open'); return d.firstChild; }
function _tkToast(m){ if (typeof toast === 'function') toast(m); else alert(m); }

async function openKhoModal(){
  if (!_tkOn()) { _tkToast('Cần đăng nhập tài khoản thật để dùng Tồn kho'); return; }
  var ov = _tkEnsure(); ov.classList.add('open');
  document.getElementById('tk-list').innerHTML = '<div class="tk-empty">Đang tải…</div>';
  await tkLoadKho();
}
async function tkLoadKho(keep){
  try {
    var j = await _tkGet('action=khoList');
    var all = (j && j.kho) || [];
    _tk.kho = all.filter(function(k){ return k.active || _tkIsAdmin(); });
  } catch(e){ document.getElementById('tk-list').innerHTML = '<div class="tk-empty">Không tải được danh sách kho.</div>'; return; }
  var sel = document.getElementById('tk-kho');
  sel.innerHTML = _tk.kho.map(function(k){ return '<option value="' + esc(k.id) + '">' + esc(k.name) + (k.active ? '' : ' (ngưng)') + '</option>'; }).join('');
  if (!_tk.kho.some(function(k){ return k.id === _tk.cur; })) _tk.cur = _tk.kho.length ? _tk.kho[0].id : '';
  sel.value = _tk.cur;
  document.getElementById('tk-manage').style.display = _tkIsAdmin() ? '' : 'none';
  if (!_tk.cur) {
    _tk.items = [];
    document.getElementById('tk-info').textContent = '';
    document.getElementById('tk-list').innerHTML = '<div class="tk-empty">' + (_tkIsAdmin() ? 'Chưa có kho nào. Bấm “⚙ Quản lý kho” để tạo kho đầu tiên.' : 'Chưa có kho nào. Nhờ admin tạo kho.') + '</div>';
    _tkRenderTools(); return;
  }
  if (!keep) await tkLoadItems(); else _tkRenderList();
}
async function tkLoadItems(){
  if (!_tk.cur) return;
  var list = document.getElementById('tk-list'); list.innerHTML = '<div class="tk-empty">Đang tải…</div>';
  try {
    var j = await _tkGet('action=tonKho&khoId=' + encodeURIComponent(_tk.cur));
    _tk.items = (j && j.items) || []; _tk.loaded = true;
  } catch(e){ list.innerHTML = '<div class="tk-empty">Không tải được tồn kho.</div>'; return; }
  _tkRenderTools(); _tkRenderList();
}
function _tkRenderTools(){
  var k = _tkCurKho(), m = k && _tkCanManage(k);
  document.getElementById('tk-new').style.display = (m && k.active) ? '' : 'none';
  document.getElementById('tk-imp').style.display = (m && k.active) ? '' : 'none';
}
function _tkFiltered(){
  var q = _tkNorm(_tk.q);
  return _tk.items.filter(function(it){
    if (_tk.low && !_tkIsLow(it)) return false;
    if (!q) return true;
    return _tkNorm(it.maHang).indexOf(q) >= 0 || _tkNorm(it.tenHang).indexOf(q) >= 0;
  });
}
function _tkRenderList(){
  var k = _tkCurKho(), list = document.getElementById('tk-list'), info = document.getElementById('tk-info');
  if (!k) return;
  var rows = _tkFiltered(), low = _tk.items.filter(_tkIsLow).length, lv = _tkLevel(k);
  info.innerHTML = esc(k.name) + ' · ' + _tk.items.length + ' mặt hàng' + (low ? ' · <span class="tk-lowtxt">' + low + ' sắp hết</span>' : '') +
    ' · ' + (lv === 'admin' ? 'Bạn là admin' : lv === 'leader' ? 'Bạn là leader kho này' : lv === 'staff' ? 'Bạn là nhân viên kho này' : 'Chỉ xem') + (k.active ? '' : ' · <b>Kho đã ngưng hoạt động</b>') + (k.note ? '<br>' + esc(k.note) : '');
  if (!rows.length) { list.innerHTML = '<div class="tk-empty">' + (_tk.items.length ? 'Không có mặt hàng khớp.' : 'Kho chưa có mặt hàng. ' + (_tkCanManage(k) ? 'Thêm từng mặt hàng hoặc bấm “📥 Nhập Excel” (file Pos “Tổng hợp tồn kho”).' : '')) + '</div>'; return; }
  var can = _tkCanEdit(k) && k.active;
  list.innerHTML = rows.slice(0, _tk.shown).map(function(it){
    return '<div class="tk-row' + (_tkIsLow(it) ? ' low' : '') + '"><div class="tk-main"><div class="tk-code">' + esc(it.maHang) + '</div><div class="tk-name">' + esc(it.tenHang || '—') + '</div></div>' +
      '<div class="tk-qty"><b>' + _tkNum(it.ton) + '</b>' + (_tkIsLow(it) ? '<span class="tk-low">sắp hết (≤ ' + _tkNum(it.minTon) + ')</span>' : '') + '</div>' +
      '<div class="tk-act">' + (can ? '<button type="button" class="btn sm" data-tk-edit="' + esc(it.maHang) + '">Sửa</button>' : '') +
      '<button type="button" class="btn secondary sm" data-tk-hist="' + esc(it.maHang) + '" title="Lịch sử">📜</button></div></div>';
  }).join('') + (rows.length > _tk.shown ? '<div class="tk-more"><button type="button" class="btn secondary sm" data-tk-more="1">Hiện thêm (' + (rows.length - _tk.shown) + ')</button></div>' : '');
}
function _tkFind(code){ return _tk.items.find(function(x){ return x.maHang === code; }) || null; }
function _tkReplace(item){ if (!item) return; var i = _tk.items.findIndex(function(x){ return x.maHang === item.maHang; }); if (i >= 0) _tk.items[i] = item; else _tk.items.push(item); }

// ── Sửa tồn / thông tin / xoá 1 mặt hàng ──
function tkEditDlg(code){
  var k = _tkCurKho(), it = _tkFind(code); if (!k || !it) return;
  var mg = _tkCanManage(k);
  var box = _tkDlg('<div class="tk-head"><b>' + esc(it.maHang) + '</b><span class="tk-sp"></span><button type="button" class="btn secondary sm" id="tk-d-x">✕</button></div>' +
    '<div class="tk-form"><div class="tk-muted">' + esc(it.tenHang || '') + ' · hiện có <b>' + _tkNum(it.ton) + '</b> · sửa bởi ' + esc(it.updatedBy || '—') + '</div>' +
    '<label>Cách sửa</label><select id="tk-m"><option value="set">Kiểm kê — đặt đúng số</option><option value="in">Nhập thêm</option><option value="out">Xuất bớt</option></select>' +
    '<label>Số lượng</label><input id="tk-n" type="number" inputmode="decimal" min="0" step="any" placeholder="0">' +
    '<label>Lý do (bắt buộc)</label><input id="tk-w" list="tk-why" placeholder="Kiểm kê / Nhập hàng / Xuất bán…"><datalist id="tk-why"><option value="Kiểm kê"><option value="Nhập hàng"><option value="Xuất bán"><option value="Hàng lỗi / hỏng"><option value="Điều chỉnh sai sót"></datalist>' +
    '<div class="tk-btns"><button type="button" class="btn primary" id="tk-d-ok">Lưu số lượng</button></div>' +
    (mg ? '<hr><label>Tên hàng</label><input id="tk-nm" value="' + esc(it.tenHang || '') + '"><label>Cảnh báo sắp hết khi tồn ≤ (để trống = tắt)</label><input id="tk-mt" type="number" min="0" step="any" value="' + (it.minTon == null ? '' : esc(String(it.minTon))) + '">' +
      '<div class="tk-btns"><button type="button" class="btn" id="tk-d-info">Lưu thông tin</button><button type="button" class="btn danger" id="tk-d-del">Xoá mặt hàng</button></div>' : '') + '</div>');
  box.querySelector('#tk-d-x').onclick = tkDlgClose;
  function lock(on){ box.querySelectorAll('button').forEach(function(b){ b.disabled = on; }); }
  function handle(j){
    if (j && j.ok) { return true; }
    if (j && j.code === 'CONFLICT') { _tkToast('Có người vừa sửa mặt hàng này — đã tải lại số mới'); if (j.current) _tkReplace(j.current); tkDlgClose(); _tkRenderList(); return false; }
    _tkToast(_tkErr(j)); return false;
  }
  box.querySelector('#tk-d-ok').onclick = async function(){
    var m = box.querySelector('#tk-m').value, n = box.querySelector('#tk-n').value, w = box.querySelector('#tk-w').value.trim();
    if (n === '' || !isFinite(Number(n)) || Number(n) < 0) { _tkToast('Nhập số lượng hợp lệ'); return; }
    if (w.length < 2) { _tkToast('Nhập lý do'); return; }
    lock(true);
    try {
      var j = m === 'set' ? await _tkPost('tonKhoSet', { khoId: k.id, maHang: it.maHang, newQty: Number(n), lyDo: w, expectedVer: it.ver })
                          : await _tkPost('tonKhoAdjust', { khoId: k.id, maHang: it.maHang, delta: (m === 'in' ? 1 : -1) * Number(n), lyDo: w });
      if (handle(j)) { _tkReplace(j.item); tkDlgClose(); _tkRenderList(); _tkToast('Đã lưu'); } else lock(false);
    } catch(e){ _tkToast('Lỗi mạng: ' + e.message); lock(false); }
  };
  if (mg) {
    box.querySelector('#tk-d-info').onclick = async function(){
      lock(true);
      try { var j = await _tkPost('tonKhoItemSave', { khoId: k.id, maHang: it.maHang, tenHang: box.querySelector('#tk-nm').value, minTon: box.querySelector('#tk-mt').value });
        if (handle(j)) { _tkReplace(j.item); tkDlgClose(); _tkRenderList(); _tkToast('Đã lưu'); } else lock(false);
      } catch(e){ _tkToast('Lỗi mạng: ' + e.message); lock(false); }
    };
    box.querySelector('#tk-d-del').onclick = async function(){
      var w = box.querySelector('#tk-w').value.trim();
      if (w.length < 2) { _tkToast('Nhập lý do xoá ở ô “Lý do” phía trên'); return; }
      if (!confirm('Xoá mặt hàng ' + it.maHang + ' khỏi kho? (Lịch sử vẫn giữ)')) return;
      lock(true);
      try { var j = await _tkPost('tonKhoItemDelete', { khoId: k.id, maHang: it.maHang, lyDo: w, expectedVer: it.ver });
        if (handle(j)) { _tk.items = _tk.items.filter(function(x){ return x.maHang !== it.maHang; }); tkDlgClose(); _tkRenderList(); _tkToast('Đã xoá'); } else lock(false);
      } catch(e){ _tkToast('Lỗi mạng: ' + e.message); lock(false); }
    };
  }
}
// ── Thêm mặt hàng mới ──
function tkItemDlg(){
  var k = _tkCurKho(); if (!k) return;
  var box = _tkDlg('<div class="tk-head"><b>＋ Mặt hàng mới — ' + esc(k.name) + '</b><span class="tk-sp"></span><button type="button" class="btn secondary sm" id="tk-d-x">✕</button></div>' +
    '<div class="tk-form"><label>Mã hàng</label><input id="tk-c"><label>Tên hàng</label><input id="tk-nm"><label>Tồn ban đầu</label><input id="tk-n" type="number" min="0" step="any" value="0">' +
    '<label>Cảnh báo sắp hết khi tồn ≤ (để trống = tắt)</label><input id="tk-mt" type="number" min="0" step="any">' +
    '<div class="tk-btns"><button type="button" class="btn primary" id="tk-d-ok">Thêm</button></div></div>');
  box.querySelector('#tk-d-x').onclick = tkDlgClose;
  box.querySelector('#tk-d-ok').onclick = async function(){
    var c = box.querySelector('#tk-c').value.trim(); if (!c) { _tkToast('Nhập mã hàng'); return; }
    if (_tkFind(c) || _tk.items.some(function(x){ return String(x.maHang).toUpperCase() === c.toUpperCase(); })) { _tkToast('Mã này đã có trong kho'); return; }
    this.disabled = true;
    try { var j = await _tkPost('tonKhoItemSave', { khoId: k.id, maHang: c, tenHang: box.querySelector('#tk-nm').value, ton: box.querySelector('#tk-n').value, minTon: box.querySelector('#tk-mt').value, lyDo: 'Thêm mặt hàng' });
      if (j && j.ok) { _tkReplace(j.item); tkDlgClose(); _tkRenderList(); _tkToast('Đã thêm'); } else { _tkToast(_tkErr(j)); this.disabled = false; }
    } catch(e){ _tkToast('Lỗi mạng: ' + e.message); this.disabled = false; }
  };
}
// ── Nhập Excel Pos "Tổng hợp tồn kho" (Tên kho | Mã hàng | Tên hàng | Cuối kỳ) ──
function _tkParseSheet(rows){
  var h = -1, cMa = -1, cTen = -1, cTon = -1, cKho = -1;
  for (var i = 0; i < Math.min(rows.length, 30) && h < 0; i++) {
    var r = rows[i] || [], ma = -1, ton = -1, ten = -1, kho = -1;
    for (var c = 0; c < r.length; c++) {
      var t = _tkNorm(r[c]);
      if (/^ma (hang|sp|san pham|hang hoa)$|^ma$/.test(t)) ma = c;
      else if (/^ten (hang|san pham|hang hoa)$/.test(t)) ten = c;
      else if (/cuoi ky|^ton cuoi|^ton kho$|^ton$|^so luong$/.test(t)) ton = ton < 0 ? c : ton;
      else if (/^ten kho$|^kho$/.test(t)) kho = c;
    }
    if (ma >= 0 && ton >= 0) { h = i; cMa = ma; cTen = ten; cTon = ton; cKho = kho; }
  }
  if (h < 0) return { error: 'Không thấy dòng tiêu đề có “Mã hàng” và “Cuối kỳ”. Dùng đúng file Pos “Tổng hợp tồn kho”.' };
  var items = [], khos = {};
  for (var j = h + 1; j < rows.length; j++) {
    var row = rows[j] || [], code = String(row[cMa] == null ? '' : row[cMa]).trim();
    if (!code || /^(tong|cong|total)\b/i.test(_tkNorm(code))) continue;
    if (cKho >= 0 && row[cKho]) khos[String(row[cKho]).trim()] = true;
    items.push({ maHang: code, tenHang: cTen >= 0 ? String(row[cTen] == null ? '' : row[cTen]).trim() : '', ton: row[cTon] });
  }
  return { items: items, khos: Object.keys(khos) };
}
function tkImportDlg(){
  var k = _tkCurKho(); if (!k) return;
  var parsed = null;
  var box = _tkDlg('<div class="tk-head"><b>📥 Nhập Excel — ' + esc(k.name) + '</b><span class="tk-sp"></span><button type="button" class="btn secondary sm" id="tk-d-x">✕</button></div>' +
    '<div class="tk-form"><div class="tk-muted">File Excel xuất từ Pos (Tổng hợp tồn kho): cột Tên kho, Mã hàng, Tên hàng, Cuối kỳ. Mỗi kho nhập 1 file.</div>' +
    '<input id="tk-f" type="file" accept=".xlsx,.xls"><div id="tk-prev" class="tk-muted"></div>' +
    '<label>Cách nhập</label><select id="tk-mode"><option value="set">Đặt số đúng theo file (kiểm kê / nhập đầu kỳ)</option><option value="add">Cộng thêm vào số hiện có (nhập hàng)</option></select>' +
    '<label>Lý do</label><input id="tk-w" value="Nhập đầu kỳ từ file Pos">' +
    '<div class="tk-btns"><button type="button" class="btn primary" id="tk-d-ok" disabled>Nhập vào kho</button></div><div id="tk-res" class="tk-muted"></div></div>');
  box.querySelector('#tk-d-x').onclick = tkDlgClose;
  box.querySelector('#tk-f').onchange = async function(){
    var f = this.files && this.files[0], prev = box.querySelector('#tk-prev'); parsed = null; box.querySelector('#tk-d-ok').disabled = true;
    if (!f) return;
    if (typeof XLSX === 'undefined') { prev.textContent = 'Thư viện Excel chưa tải xong, đợi vài giây rồi chọn lại file.'; return; }
    try {
      var wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      var p = _tkParseSheet(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }));
      if (p.error) { prev.textContent = p.error; return; }
      if (!p.items.length) { prev.textContent = 'File không có dòng hàng nào.'; return; }
      parsed = p;
      var warn = (p.khos.length && !(p.khos.length === 1 && _tkNorm(p.khos[0]) === _tkNorm(k.name))) ? '<br><b style="color:var(--red,#d93025)">⚠ Tên kho trong file: ' + esc(p.khos.slice(0, 4).join(', ')) + ' — khác kho đang chọn “' + esc(k.name) + '”. Kiểm tra lại trước khi nhập.</b>' : '';
      prev.innerHTML = 'Đọc được <b>' + p.items.length + '</b> dòng hàng. Mẫu: ' + p.items.slice(0, 3).map(function(x){ return esc(x.maHang) + ' = ' + esc(String(x.ton)); }).join('; ') + warn;
      box.querySelector('#tk-d-ok').disabled = false;
    } catch(e){ prev.textContent = 'Không đọc được file: ' + e.message; }
  };
  box.querySelector('#tk-d-ok').onclick = async function(){
    if (!parsed) return;
    var mode = box.querySelector('#tk-mode').value, why = box.querySelector('#tk-w').value.trim() || 'Nhập Excel', btn = this, res = box.querySelector('#tk-res');
    if (!confirm('Nhập ' + parsed.items.length + ' dòng vào kho “' + k.name + '” (' + (mode === 'set' ? 'đặt số đúng theo file' : 'cộng thêm') + ')?')) return;
    btn.disabled = true; var tot = { created: 0, updated: 0, unchanged: 0, skipped: [] };
    try {
      for (var i = 0; i < parsed.items.length; i += 2000) {
        res.textContent = 'Đang nhập… ' + Math.min(i + 2000, parsed.items.length) + '/' + parsed.items.length;
        var j = await _tkPost('tonKhoImport', { khoId: k.id, items: parsed.items.slice(i, i + 2000), mode: mode, lyDo: why });
        if (!j || !j.ok) { res.innerHTML = '<b>Dừng ở dòng ' + (i + 1) + ':</b> ' + esc(_tkErr(j)) + ' (các dòng trước đó đã nhập)'; btn.disabled = false; await tkLoadItems(); return; }
        tot.created += j.created || 0; tot.updated += j.updated || 0; tot.unchanged += j.unchanged || 0; tot.skipped = tot.skipped.concat(j.skipped || []);
      }
      res.innerHTML = '✅ Mới ' + tot.created + ' · cập nhật ' + tot.updated + ' · không đổi ' + tot.unchanged + (tot.skipped.length ? ' · <b>bỏ qua ' + tot.skipped.length + '</b>: ' + tot.skipped.slice(0, 5).map(function(s){ return esc((s.maHang || 'dòng ' + s.n) + ' (' + s.reason + ')'); }).join(', ') : '');
      await tkLoadItems();
    } catch(e){ res.textContent = 'Lỗi mạng: ' + e.message; btn.disabled = false; }
  };
}
// ── Lịch sử ──
async function tkHistDlg(code){
  var k = _tkCurKho(); if (!k) return;
  var box = _tkDlg('<div class="tk-head"><b>📜 Lịch sử' + (code ? ' — ' + esc(code) : '') + '</b><span class="tk-sp"></span><button type="button" class="btn secondary sm" id="tk-d-x">✕</button></div><div class="tk-list" id="tk-h"><div class="tk-empty">Đang tải…</div></div>');
  box.querySelector('#tk-d-x').onclick = tkDlgClose;
  try {
    var j = await _tkGet('action=tonKhoLog&khoId=' + encodeURIComponent(k.id) + (code ? '&maHang=' + encodeURIComponent(code) : '') + '&limit=100');
    var lg = (j && j.log) || [], el = box.querySelector('#tk-h'); if (!el) return;
    var LB = { kiem_ke: 'Kiểm kê', nhap: 'Nhập', xuat: 'Xuất', tao: 'Thêm mới', import: 'Nhập Excel', xoa: 'Xoá' };
    el.innerHTML = lg.length ? lg.map(function(x){
      var d = x.delta; var ds = d == null ? '' : (d > 0 ? '+' : '') + _tkNum(d);
      return '<div class="tk-row"><div class="tk-main"><div class="tk-code">' + esc(x.maHang) + ' <span class="tk-muted">' + esc(LB[x.loai] || x.loai) + '</span></div><div class="tk-name">' + esc(x.lyDo || '') + '</div><div class="tk-muted">' + esc(x.user) + ' · ' + esc(new Date(x.ts).toLocaleString('vi-VN')) + '</div></div>' +
        '<div class="tk-qty"><b>' + esc(ds) + '</b><span class="tk-muted">' + (x.before == null ? '' : _tkNum(x.before) + ' → ') + (x.after == null ? '' : _tkNum(x.after)) + '</span></div></div>';
    }).join('') : '<div class="tk-empty">Chưa có thay đổi nào.</div>';
  } catch(e){ var el2 = box.querySelector('#tk-h'); if (el2) el2.innerHTML = '<div class="tk-empty">Không tải được lịch sử.</div>'; }
}
// ── Admin: tạo / sửa kho, gán leader + nhân viên ──
function tkManageDlg(){
  if (!_tkIsAdmin()) return;
  var box = _tkDlg('<div class="tk-head"><b>⚙ Quản lý kho</b><span class="tk-sp"></span><button type="button" class="btn secondary sm" id="tk-d-x">✕</button></div><div class="tk-form" id="tk-mg"></div>');
  box.querySelector('#tk-d-x').onclick = tkDlgClose;
  _tkManageList(box);
}
function _tkManageList(box){
  var el = box.querySelector('#tk-mg');
  el.innerHTML = _tk.kho.map(function(k){ return '<div class="tk-row"><div class="tk-main"><div class="tk-code">' + esc(k.name) + (k.active ? '' : ' <span class="tk-muted">(ngưng)</span>') + '</div><div class="tk-muted">Leader: ' + esc((k.leaders || []).join(', ') || '—') + ' · NV: ' + esc((k.staff || []).join(', ') || '—') + '</div></div><div class="tk-act"><button type="button" class="btn sm" data-id="' + esc(k.id) + '">Sửa</button></div></div>'; }).join('') +
    '<div class="tk-btns"><button type="button" class="btn primary" id="tk-newkho">＋ Tạo kho mới</button></div>';
  el.querySelectorAll('button[data-id]').forEach(function(b){ b.onclick = function(){ _tkKhoForm(box, b.getAttribute('data-id')); }; });
  el.querySelector('#tk-newkho').onclick = function(){ _tkKhoForm(box, ''); };
}
function _tkKhoForm(box, id){
  var k = id ? _tk.kho.find(function(x){ return x.id === id; }) : { name: '', note: '', active: true, leaders: [], staff: [] };
  var accs = (typeof accounts !== 'undefined' && Array.isArray(accounts) ? accounts : []).filter(function(a){ return a && a.username && a.role !== 'demo'; });
  var pick = function(kind, arr){ return accs.map(function(a){ var u = String(a.username).toLowerCase(); return '<label class="tk-pick"><input type="checkbox" data-' + kind + '="' + esc(u) + '"' + (arr.indexOf(u) >= 0 ? ' checked' : '') + '> ' + esc(a.name || a.username) + ' <span class="tk-muted">' + esc(u) + '</span></label>'; }).join(''); };
  var el = box.querySelector('#tk-mg');
  el.innerHTML = '<label>Tên kho</label><input id="tk-kn" value="' + esc(k.name) + '"><label>Ghi chú</label><input id="tk-kt" value="' + esc(k.note || '') + '">' +
    '<label class="tk-chk"><input type="checkbox" id="tk-ka"' + (k.active ? ' checked' : '') + '> Đang hoạt động</label>' +
    '<label>Leader (thêm/xoá mặt hàng, nhập Excel, sửa tồn)</label><div class="tk-picks">' + (pick('lead', k.leaders || []) || '<div class="tk-muted">Chưa có danh sách tài khoản.</div>') + '</div>' +
    '<label>Nhân viên (sửa tồn: kiểm kê / nhập / xuất)</label><div class="tk-picks">' + pick('staff', k.staff || []) + '</div>' +
    '<div class="tk-btns"><button type="button" class="btn secondary" id="tk-kback">← Quay lại</button><button type="button" class="btn primary" id="tk-ksave">Lưu kho</button></div>';
  el.querySelector('#tk-kback').onclick = function(){ _tkManageList(box); };
  el.querySelector('#tk-ksave').onclick = async function(){
    var name = el.querySelector('#tk-kn').value.trim(); if (!name) { _tkToast('Nhập tên kho'); return; }
    var leaders = [].slice.call(el.querySelectorAll('input[data-lead]:checked')).map(function(c){ return c.getAttribute('data-lead'); });
    var staff = [].slice.call(el.querySelectorAll('input[data-staff]:checked')).map(function(c){ return c.getAttribute('data-staff'); }).filter(function(u){ return leaders.indexOf(u) < 0; });
    this.disabled = true;
    try { var j = await _tkPost('khoSave', { kho: { id: id || undefined, name: name, note: el.querySelector('#tk-kt').value, active: el.querySelector('#tk-ka').checked, leaders: leaders, staff: staff } });
      if (j && j.ok) { _tkToast('Đã lưu kho'); if (!id && j.kho) _tk.cur = j.kho.id; await tkLoadKho(); _tkManageList(box); } else { _tkToast(_tkErr(j)); this.disabled = false; }
    } catch(e){ _tkToast('Lỗi mạng: ' + e.message); this.disabled = false; }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════
//  CHUẨN HÓA TÊN GỐC THEO PANCAKE CHO TÀI KHOẢN ĐÃ CÓ (Duyên 26/11: "lấy gốc theo tên trên Pancake cho dễ"; việc kế tiếp của HANDOFF 26/11)
//  NGUYÊN NHÂN GỐC: addAccount (js/15) chỉ đưa tên Pancake lên đầu (names[0] = tên chính) khi bấm Lưu tài khoản → tài khoản TẠO TRƯỚC đó vẫn mang tên chính
//  cũ (vd yenNTH2004 thay vì yennth) nên cùng 1 người còn bị tách 2 dòng ở các mục chọn theo tên.
//  Công cụ này (CHỈ admin) duyệt mọi tài khoản CS đang hoạt động, XEM TRƯỚC danh sách sẽ đổi (tên chính cũ → mới), admin tick rồi mới Lưu 1 lần (pushUsers).
//  KHÔNG tự lưu gì khi chưa bấm Lưu. Chỉ ĐỔI THỨ TỰ/THÊM tên Pancake lên đầu — không xoá tên nào của tài khoản. Dùng lại _pkOrigNameOf_/_acctPancakeFirst_ (js/15).
// ═══════════════════════════════════════════════════════════════════════════════════════
function _apnFold_(x){ return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }

// HÀM THUẦN: accounts + (names)=>danh sách tên của tài khoản → đề xuất. Mỗi đề xuất: { username, oldName, newName, oldNames, newNames, added, dupes:[{name,other}] }
// Chỉ tài khoản CS đang hoạt động, có tên, mà tên Pancake gốc khác tên chính hiện tại (hoặc chưa nằm trong danh sách). Tên Pancake sẽ được THÊM mà đang thuộc
// tài khoản khác → ghi vào dupes (mặc định không tick).
function _acctPkNormPlan_(accounts, namesOf, roleBaseOf){
  var out = [], owner = {};
  (accounts || []).forEach(function(a){
    if (!a || !a.username) return;
    (namesOf(a) || []).forEach(function(n){ var k = _apnFold_(n); if (k) (owner[k] = owner[k] || {})[_apnFold_(a.username)] = a.username; });
  });
  (accounts || []).forEach(function(a){
    if (!a || !a.username || a.active === false || roleBaseOf(a.role) !== 'cs') return;
    var names = (namesOf(a) || []).filter(function(n){ return _apnFold_(n); });
    if (!names.length) return;
    var orig = _pkOrigNameOf_(names); if (!orig) return;
    var nn = _acctPancakeFirst_(names);
    var oldName = names[0], newName = nn[0];
    if (_apnFold_(oldName) === _apnFold_(newName) && String(a.name || '') === String(newName)) return;   // đã chuẩn
    var inList = names.some(function(n){ return _apnFold_(n) === _apnFold_(orig); });
    var dupes = [];
    if (!inList){ var o = owner[_apnFold_(orig)] || {}; Object.keys(o).forEach(function(k){ if (k !== _apnFold_(a.username)) dupes.push({ name: orig, other: o[k] }); }); }
    out.push({ username: a.username, oldName: String(a.name || oldName), newName: newName, oldNames: names, newNames: nn, added: !inList, dupes: dupes });
  });
  return out;
}
// Áp các đề xuất đã chọn lên accounts (sửa tại chỗ). Trả số tài khoản đã đổi. team: chỉ cập nhật khi tìm thấy team theo bộ tên mới (giống addAccount nhưng KHÔNG xoá team cũ).
function _acctPkNormApply_(accounts, picks, teamOf){
  var by = {}; (picks || []).forEach(function(p){ by[_apnFold_(p.username)] = p; });
  var n = 0;
  (accounts || []).forEach(function(a){
    var p = by[_apnFold_(a && a.username)]; if (!p) return;
    a.name = p.newName; a.names = p.newNames.slice();
    if (teamOf){ var t = null; for (var i = 0; i < a.names.length && !t; i++) t = teamOf(a.names[i]); if (t && t.name) a.team = t.name; }
    n++;
  });
  return n;
}

(function(){
  var P = { list: [], busy: false };
  function esc2(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function roleBase(r){ try { return (typeof _roleBaseOf === 'function') ? _roleBaseOf(r) : r; } catch (e) { return r; } }
  function ensure(){
    var ov = document.getElementById('apn-overlay'); if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'apn-overlay'; ov.className = 'snm-overlay';
    ov.innerHTML = '<div class="snm-box" role="dialog" aria-modal="true"><div class="snm-head"><b>🥞 Chuẩn hóa tên gốc theo Pancake</b><button type="button" class="btn secondary sm" id="apn-close">✕ Đóng</button></div><div class="snm-body" id="apn-body"></div></div>';
    document.body.appendChild(ov);
    document.getElementById('apn-close').addEventListener('click', function(){ ov.classList.remove('open'); });
    ov.addEventListener('change', function(ev){ var t = ev.target; if (t.classList && t.classList.contains('apn-on')){ var p = P.list[+t.getAttribute('data-p')]; if (p) p.on = t.checked; count(); } });
    ov.addEventListener('click', function(ev){ if (ev.target.id === 'apn-save') save(); });
    return ov;
  }
  function count(){ var n = P.list.filter(function(p){ return p.on; }).length, b = document.getElementById('apn-save'); if (b){ b.disabled = P.busy || !n; b.textContent = '💾 Lưu ' + n + ' tài khoản đã tick'; } }
  function render(msg){
    var body = document.getElementById('apn-body'); if (!body) return;
    var h = '<div class="sp-mu snm-note">Đưa <b>tên Pancake</b> của từng người lên làm <b>tên chính</b> của tài khoản (lấy từ mục Khớp tên Pancake). Chỉ đổi thứ tự / thêm tên Pancake lên đầu, <b>không xoá tên nào</b>. Tick tài khoản muốn đổi rồi bấm Lưu.</div>';
    if (msg) h += '<div class="snm-msg">' + esc2(msg) + '</div>';
    if (!P.list.length) h += '<div class="sp-mu" style="padding:14px">Không có tài khoản CS nào cần chuẩn hóa (tên chính đã là tên Pancake, hoặc chưa có Khớp tên Pancake cho người đó).</div>';
    P.list.forEach(function(p, pi){
      h += '<div class="snm-row"><div class="snm-r1"><label><input type="checkbox" class="apn-on" data-p="' + pi + '"' + (p.on ? ' checked' : '') + '> <b>' + esc2(p.username) + '</b></label>' +
        '<span>' + esc2(p.oldName) + ' → <b>' + esc2(p.newName) + '</b>' + (p.added ? ' <span class="sp-mu">(thêm tên Pancake)</span>' : '') + '</span></div>' +
        '<div class="snm-names">' + p.newNames.map(function(n, i){ return '<span class="snm-nm">' + (i === 0 ? '★ ' : '') + esc2(n) + '</span>'; }).join('') + '</div>';
      if (p.dupes.length) h += '<div class="snm-warn">⚠ Tên ' + p.dupes.map(function(d){ return esc2(d.name) + ' đang thuộc tài khoản ' + esc2(d.other); }).join(', ') + ' — mặc định KHÔNG tick, kiểm tra trước khi đổi.</div>';
      h += '</div>';
    });
    if (P.list.length) h += '<div class="snm-foot"><button type="button" class="btn" id="apn-save">💾 Lưu</button></div>';
    body.innerHTML = h; count();
  }
  async function save(){
    if (P.busy) return;
    var picks = P.list.filter(function(p){ return p.on; }); if (!picks.length) return;
    P.busy = true; count();
    var n = _acctPkNormApply_(accounts, picks, (typeof _teamOf === 'function') ? _teamOf : null);
    var res = null; try { res = await pushUsers(); } catch (e) { res = { error: String(e && e.message || e) }; }
    P.busy = false;
    if (res && res.error){ render('⚠ Lỗi lưu: ' + res.error + ' (thay đổi mới ở máy này, chưa lên máy chủ — thử lại).'); return; }
    if (typeof logAudit === 'function') logAudit('account', '', '', 'Chuẩn hóa tên gốc theo Pancake: ' + picks.map(function(p){ return p.username + ' (' + p.oldName + '→' + p.newName + ')'; }).join(', '));
    if (typeof _authAccount !== 'undefined' && _authAccount && typeof _applyAuthIdentity === 'function'){
      var me = (typeof _findAccount === 'function') ? _findAccount(_authAccount.username) : null; if (me){ try { _applyAuthIdentity(me); } catch (e2) {} }
    }
    P.list = []; render('✓ Đã chuẩn hóa ' + n + ' tài khoản.');
    if (typeof renderAcctModal === 'function') renderAcctModal();
    if (typeof _renderAuthHeader === 'function') _renderAuthHeader();
  }
  async function open(){
    if (typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'admin'){ if (typeof toast === 'function') toast('Chỉ admin dùng được công cụ này.'); return; }
    var ov = ensure(); ov.classList.add('open');
    document.getElementById('apn-body').innerHTML = '<div class="sp-load"><i class="sp-spin"></i><span>Đang tải Khớp tên Pancake…</span></div>';
    try { if (typeof _pkState !== 'undefined' && !_pkState.nameMapLoaded && typeof _pkLoadNameMap === 'function') await _pkLoadNameMap(); } catch (e) {}
    if (typeof _pkState === 'undefined' || !_pkState || !_pkState.nameMap || !Object.keys(_pkState.nameMap).length){ P.list = []; render('Chưa có dữ liệu Khớp tên Pancake nên chưa chuẩn hóa được. Vào Pancake → Khớp tên Pancake trước.'); return; }
    P.list = _acctPkNormPlan_(accounts, _acctNamesOf, roleBase);
    P.list.forEach(function(p){ p.on = !p.dupes.length; });   // tên Pancake đang thuộc tài khoản khác: mặc định KHÔNG tick
    render();
  }
  window.openAcctPkNormalize = open;
})();

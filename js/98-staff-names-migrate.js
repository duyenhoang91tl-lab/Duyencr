// ═══════════════════════════════════════════════════════════════════════════════════════
//  GOM TÊN CŨ → HỒ SƠ CHUẨN (yêu cầu Duyên 26/11/2026, bước 5/5) — CHỈ ADMIN
//  Hiện Team/Báo cáo đang gộp 1 người nhiều tên bằng: tài khoản nhiều tên (`names`) + nhóm thẻ 'salePersonTags' (Quản lý Team → 🏷️).
//  Công cụ này ĐỀ XUẤT hồ sơ NHÁP từ 2 nguồn đó (mỗi tài khoản CS ≥2 tên, chưa có tên hệ thống trong hồ sơ): admin tick, nhập họ tên chuẩn,
//  chỉnh từng tên thuộc hệ thống nào (Pancake/CRM/Base/POS) rồi Lưu → GAS profileSave {merge:true, names, adoptTags}
//  (merge = giữ SĐT/email/Facebook cũ; adoptTags = nhóm thẻ cũ được gộp vào hồ sơ, xoá key cũ). KHÔNG tự lưu gì khi chưa bấm Lưu.
//  Mặc định: tên của tài khoản → CRM, tên từ nhóm thẻ → Base (không đoán được Pancake/POS — admin sửa lại nếu cần).
// ═══════════════════════════════════════════════════════════════════════════════════════
(function(){
  var SYS = [ ['crm', 'CRM'], ['base', 'Base'], ['pancake', 'Pancake'], ['pos', 'POS'] ];
  function fold(x){ return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function esc2(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function roleBase(r){ try { return (typeof _roleBaseOf === 'function') ? _roleBaseOf(r) : r; } catch (e) { return r; } }

  // HÀM THUẦN: accounts + salePersonTags + thư mục hồ sơ → danh sách đề xuất.
  // Mỗi đề xuất: { username, fullName, items:[{name, sys}], adoptTags:[khoá nhóm thẻ], dupes:[{name, other}] }
  function buildProposals(accounts, tags, dir){
    tags = (tags && typeof tags === 'object') ? tags : {};
    var dirBy = {}; (dir || []).forEach(function(e){ if (e && e.username) dirBy[fold(e.username)] = e; });
    var out = [];
    (accounts || []).forEach(function(a){
      if (!a || !a.username || a.active === false || roleBase(a.role) !== 'cs') return;
      var d = dirBy[fold(a.username)];
      if (d && d.all && d.all.length) return;                       // đã có tên hệ thống → không đề xuất lại
      var items = [], seen = {}, adopt = [], mine = {};
      function add(n, sys){ var k = fold(n); if (!k || seen[k]) return; seen[k] = 1; items.push({ name: String(n).replace(/\s+/g, ' ').trim(), sys: sys }); }
      add(a.username, 'crm');
      [a.name].concat(a.names || []).forEach(function(n){ add(n, 'crm'); mine[fold(n)] = 1; });
      mine[fold(a.username)] = 1;
      Object.keys(tags).forEach(function(K){
        var grp = [K].concat(Array.isArray(tags[K]) ? tags[K] : []);
        if (!grp.some(function(n){ return mine[fold(n)]; })) return;
        grp.forEach(function(n){ add(n, 'base'); });
        if (fold(K) !== fold(a.username)) adopt.push(K);
      });
      if (items.length < 2) return;                                 // không có tên phụ → không cần gom
      out.push({ username: a.username, fullName: (d && d.fullName) || '', items: items, adoptTags: adopt, dupes: [] });
    });
    // tên xuất hiện ở 2 đề xuất (2 tài khoản cùng nhận 1 tên) → cảnh báo, server cũng sẽ từ chối dòng thứ 2
    var owner = {};
    out.forEach(function(p){ p.items.forEach(function(it){ var k = fold(it.name); (owner[k] = owner[k] || []).push(p.username); }); });
    out.forEach(function(p){ p.items.forEach(function(it){ var o = owner[fold(it.name)]; if (o.length > 1) p.dupes.push({ name: it.name, other: o.filter(function(u){ return u !== p.username; }).join(', ') }); }); });
    return out;
  }
  // items → {pancake:[], crm:[], base:[], pos:[]}
  function namesOf(items){ var o = { pancake: [], crm: [], base: [], pos: [] }; (items || []).forEach(function(it){ if (o[it.sys]) o[it.sys].push(it.name); }); return o; }

  var P = { list: [], busy: false };
  function ensure(){
    var ov = document.getElementById('snm-overlay'); if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'snm-overlay'; ov.className = 'snm-overlay';
    ov.innerHTML = '<div class="snm-box" role="dialog" aria-modal="true"><div class="snm-head"><b>🧩 Gom tên cũ thành hồ sơ chuẩn</b><button type="button" class="btn secondary sm" id="snm-close">✕ Đóng</button></div><div class="snm-body" id="snm-body"></div></div>';
    document.body.appendChild(ov);
    document.getElementById('snm-close').addEventListener('click', function(){ ov.classList.remove('open'); });
    ov.addEventListener('change', function(ev){
      var t = ev.target; if (!t.classList) return;
      if (t.classList.contains('snm-sys')){ var p = P.list[+t.getAttribute('data-p')]; if (p && p.items[+t.getAttribute('data-i')]) p.items[+t.getAttribute('data-i')].sys = t.value; }
      else if (t.classList.contains('snm-fn')){ var q = P.list[+t.getAttribute('data-p')]; if (q) q.fullName = t.value; }
      else if (t.classList.contains('snm-on')){ var r = P.list[+t.getAttribute('data-p')]; if (r) r.on = t.checked; count(); }
    });
    ov.addEventListener('click', function(ev){ if (ev.target.id === 'snm-save') save(); });
    return ov;
  }
  function count(){ var n = P.list.filter(function(p){ return p.on && !p.done; }).length, b = document.getElementById('snm-save'); if (b){ b.disabled = P.busy || !n; b.textContent = '💾 Lưu ' + n + ' hồ sơ đã tick'; } }
  function render(msg){
    var body = document.getElementById('snm-body'); if (!body) return;
    var h = '<div class="sp-mu snm-note">Gom các tên đang được nối thủ công (tài khoản nhiều tên + nhóm thẻ ở Quản lý Team) thành <b>hồ sơ chuẩn</b>. Tick người muốn gom, nhập <b>họ tên chuẩn</b>, chỉnh tên nào thuộc hệ thống nào (mặc định: tên tài khoản = CRM, tên từ nhóm thẻ = Base), rồi bấm Lưu. SĐT/email/Facebook đã có được giữ nguyên.</div>';
    if (msg) h += '<div class="snm-msg">' + esc2(msg) + '</div>';
    if (!P.list.length) h += '<div class="sp-mu" style="padding:14px">Không còn tài khoản nào cần gom (mỗi tài khoản CS có từ 2 tên mà chưa có tên hệ thống trong hồ sơ).</div>';
    P.list.forEach(function(p, pi){
      h += '<div class="snm-row' + (p.done ? ' done' : '') + '"><div class="snm-r1"><label><input type="checkbox" class="snm-on" data-p="' + pi + '"' + (p.on ? ' checked' : '') + (p.done ? ' disabled' : '') + '> <b>' + esc2(p.username) + '</b></label>' +
        '<input class="sp-in snm-fn" data-p="' + pi + '" maxlength="80" placeholder="Họ tên chuẩn (vd Ninh Thị Ngà)" value="' + esc2(p.fullName) + '"' + (p.done ? ' disabled' : '') + '></div><div class="snm-names">';
      p.items.forEach(function(it, ii){
        h += '<span class="snm-nm">' + esc2(it.name) + ' <select class="snm-sys" data-p="' + pi + '" data-i="' + ii + '"' + (p.done ? ' disabled' : '') + '>' +
          SYS.map(function(s){ return '<option value="' + s[0] + '"' + (it.sys === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></span>';
      });
      h += '</div>';
      if (p.adoptTags.length) h += '<div class="sp-mu snm-sub">Sẽ gộp nhóm thẻ cũ: ' + p.adoptTags.map(esc2).join(', ') + '</div>';
      if (p.dupes.length) h += '<div class="snm-warn">⚠ Tên trùng với tài khoản khác: ' + p.dupes.map(function(d){ return esc2(d.name) + ' (' + esc2(d.other) + ')'; }).join(', ') + ' — chỉ nên gom ở 1 tài khoản.</div>';
      if (p.res) h += '<div class="' + (p.done ? 'snm-ok' : 'snm-err') + '">' + esc2(p.res) + '</div>';
      h += '</div>';
    });
    h += '<div class="snm-foot"><button type="button" class="btn" id="snm-save">💾 Lưu hồ sơ đã tick</button></div>';
    body.innerHTML = h; count();
  }
  function save(){
    if (P.busy) return;
    var todo = P.list.filter(function(p){ return p.on && !p.done; }); if (!todo.length) return;
    P.busy = true; count();
    var i = 0, okN = 0;
    (function next(){
      if (i >= todo.length){
        P.busy = false; render(okN + '/' + todo.length + ' hồ sơ đã lưu.');
        if (okN){ if (typeof _staffNamesReload === 'function') _staffNamesReload(); if (typeof _ptSyncFromGAS === 'function') { try { _ptSyncFromGAS(); } catch (e) {} } }
        return;
      }
      var p = todo[i++], payload = { action: 'profileSave', username: p.username, merge: true, profile: {}, names: namesOf(p.items), adoptTags: p.adoptTags };
      if (String(p.fullName || '').trim()) payload.profile.fullName = String(p.fullName).trim();
      fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify(payload) })
        .then(function(r){ return r.json(); }).catch(function(){ return { ok: false, error: 'Không kết nối được máy chủ.' }; })
        .then(function(r){ if (r && r.ok){ p.done = true; p.res = '✓ Đã lưu hồ sơ'; okN++; } else p.res = '⚠ ' + ((r && r.error) || 'Lưu không thành công'); next(); });
    })();
  }
  function open(){
    if (typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'admin'){ if (typeof toast === 'function') toast('Chỉ admin dùng được công cụ này.'); return; }
    if (typeof gsUrl === 'undefined' || !gsUrl){ if (typeof toast === 'function') toast('Chưa kết nối Google Sheets.'); return; }
    var ov = ensure(); ov.classList.add('open');
    document.getElementById('snm-body').innerHTML = '<div class="sp-load"><i class="sp-spin"></i><span>Đang tải hồ sơ…</span></div>';
    var go = function(){
      var tags = (typeof SALE_PERSON_TAGS !== 'undefined') ? SALE_PERSON_TAGS : {};
      P.list = buildProposals((typeof accounts !== 'undefined') ? accounts : [], tags, (typeof _staffDirList === 'function') ? _staffDirList() : []);
      P.list.forEach(function(p){ p.on = !p.dupes.length; });   // tên trùng nhiều tài khoản: mặc định KHÔNG tick
      render();
    };
    if (typeof _staffNamesReload === 'function') _staffNamesReload().then(go); else go();
  }
  window.openStaffNamesMigrate = open;
  window._snmBuildProposals = buildProposals;   // dùng cho test
  window._snmNamesOf = namesOf;                 // dùng cho test
})();

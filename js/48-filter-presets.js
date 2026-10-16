// ═══════════════════════════════════════════════════════
//  MẪU LỌC NHANH cho Báo cáo doanh số (A, B, C, D, E, F, G, L) — Duyên yêu cầu 12/10/2026 (lọc theo Team hay lỗi → tự tạo mẫu).
//  Mẫu = tên + danh sách Sale (+ các bộ lọc khác của báo cáo đó như Kênh/Nguồn/Sản phẩm…) — KHÔNG gồm ngày (ngày vẫn chọn riêng).
//  Bấm mẫu → gán thẳng bộ lọc rồi tải lại báo cáo, KHÔNG đi qua "Lọc theo Team" (_srSyncTeamToSale_).
//  Mẫu theo TỪNG báo cáo (A/B/C… có bộ lọc khác nhau) và theo TỪNG tài khoản; lưu ở trình duyệt (localStorage). Thanh mẫu chèn sau dòng chọn báo cáo
//  mỗi lần renderSalesReportTab chạy (bọc hàm, không sửa các renderer cũ).
//  (16/10/2026) Ô mẫu chuyển vào thanh công cụ chung .srb-bar, cùng hàng 🧰 Tác vụ: 1 mẫu = nút, ≥2 mẫu = dropdown, có nút ✕ Tắt lọc nhanh.
// ═══════════════════════════════════════════════════════
(function(){
  // Bộ lọc (không ngày, không team) của từng báo cáo; sale = khoá chứa danh sách Sale; team = ô "Lọc theo Team" (chỉ là công cụ điền ô Sale nên KHÔNG lưu);
  // opts = nơi lấy danh sách Sale để chọn trong hộp "Tạo mẫu"; custom = cờ "đã tự chỉnh Sale" để mặc định theo vai trò không ghi đè.
  var CFG = {
    A: { keys:['sale','kenh','aSanPham'], sale:'sale', team:'team', opts:'saleOptions' },
    B: { keys:['bSale','bNguon','bMarketer','bSanPham','bCareStatus','bKhStatus','bZaloStatus','bNickZalo'], sale:'bSale', team:'bTeam', opts:'saleBOptions' },
    C: { keys:['cSale','cKenh','cSanPham'], sale:'cSale', team:'cTeam', opts:'saleOptions' },
    D: { keys:['dCs'], sale:'dCs', team:'dTeam', opts:'saleOptions' },
    E: { keys:['eSale','eKenh'], sale:'eSale', team:'eTeam', opts:'saleBOptions', custom:'eSaleCustomized' },
    F: { keys:['fSale'], sale:'fSale', team:'fTeam', opts:'saleBOptions', custom:'fSaleCustomized' },
    G: { keys:['gSale','gNguon','gMarketer','gSanPham'], sale:'gSale', opts:'saleBOptions', custom:'gSaleCustomized' },
    L: { keys:['lSale'], sale:'lSale', opts:'saleBOptions', custom:'lSaleCustomized' }
  };
  var D = { editId:'', sub:'', name:'', sales:{}, q:'' };   // trạng thái hộp "Tạo / sửa mẫu"

  function e(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toastF(m){ if (typeof toast === 'function') toast(m); }
  function storeKey(){ var u = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) || ''; return 'ome_sr_filter_presets_v1:' + u; }
  function loadAll(){ try { var v = JSON.parse(localStorage.getItem(storeKey()) || '[]'); return Array.isArray(v) ? v : []; } catch(err){ return []; } }
  function saveAll(list){ try { localStorage.setItem(storeKey(), JSON.stringify(list)); return true; } catch(err){ toastF('⚠ Không lưu được mẫu (trình duyệt chặn lưu dữ liệu).'); return false; } }
  function forSub(sub){ return loadAll().filter(function(p){ return p && p.sub === sub; }); }
  function emptyLike(v){ return Array.isArray(v) ? [] : (typeof v === 'boolean' ? false : ''); }
  function snapshot(sub){
    var c = CFG[sub], f = {};
    c.keys.forEach(function(k){ var v = _srState[k]; f[k] = Array.isArray(v) ? v.slice() : (v == null ? '' : v); });
    return f;
  }
  function sameFilters(sub, f){
    var c = CFG[sub];
    return c.keys.every(function(k){
      var a = _srState[k], b = f[k];
      if (Array.isArray(a) || Array.isArray(b)) { a = (a || []).slice().sort(); b = (b || []).slice().sort(); return JSON.stringify(a) === JSON.stringify(b); }
      return String(a || '') === String(b || '');
    });
  }
  function describe(p){
    var c = CFG[p.sub], sales = (p.filters && p.filters[c.sale]) || [];
    var parts = [sales.length ? 'Sale: ' + sales.slice(0, 20).join(', ') + (sales.length > 20 ? '…' : '') : 'Không giới hạn Sale'];
    c.keys.forEach(function(k){
      if (k === c.sale) return;
      var v = p.filters && p.filters[k]; if (Array.isArray(v) ? v.length : v) parts.push(k + ': ' + (Array.isArray(v) ? v.join(', ') : v));
    });
    return parts.join(' · ');
  }
  function newId(){ return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── Ô mẫu nằm TRONG thanh công cụ (.srb-bar), cùng hàng với 🧰 Tác vụ ──
  //  0 mẫu: chỉ có menu "⚡ Mẫu lọc nhanh ▾" (Tạo mẫu / Lưu bộ lọc hiện tại) · 1 mẫu: 1 nút bấm là lọc · ≥2 mẫu: dropdown chọn mẫu.
  //  Đang dùng mẫu → hiện nút "✕ Tắt lọc nhanh" (bỏ các bộ lọc của báo cáo này và tải lại).
  var ACT = {};   // báo cáo -> id mẫu vừa bấm (ưu tiên khi 2 mẫu giống hệt nhau)
  function hasAny(sub, f){ return CFG[sub].keys.some(function(k){ var v = f[k]; return Array.isArray(v) ? v.length > 0 : !!v; }); }
  function activeOf(sub){
    var list = forSub(sub), t = list.filter(function(p){ return p.id === ACT[sub]; })[0];
    if (t && sameFilters(sub, t.filters || {})) return t;
    return list.filter(function(p){ return hasAny(sub, p.filters || {}) && sameFilters(sub, p.filters || {}); })[0] || null;
  }
  // ── Lọc nhanh theo ĐỘI (Văn phòng / Online / Thử việc…) lấy từ cách phân loại từng Sale (SALE_CHANNELS, Báo cáo E → "Phân loại Sale") —
  //    cùng bảng tên Sale với báo cáo nên không phụ thuộc "Quản lý Team". Tên Sale đổi sang đúng tên có trong dữ liệu của báo cáo đang xem.
  function foldN(x){ return String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function groupsFor(sub){
    var canon = {}; saleOptionsFor(sub).forEach(function(n){ canon[foldN(n)] = n; });
    var ch = (typeof SALE_CHANNELS !== 'undefined' && SALE_CHANNELS) || {}, gs = ((typeof SALE_GROUPS !== 'undefined' && SALE_GROUPS) || []).slice();
    if (!gs.some(function(g){ return g.key === 'probation'; }) && Object.keys(ch).some(function(n){ return ch[n] === 'probation'; })) gs.push({ key:'probation', label:'Thử việc' });
    return gs.map(function(g){
      var all = Object.keys(ch).filter(function(n){ return ch[n] === g.key; }), kept = [], miss = [];
      all.forEach(function(n){ var c2 = canon[foldN(n)]; if (c2 !== undefined) { if (kept.indexOf(c2) === -1) kept.push(c2); } else miss.push(n); });
      return { key:g.key, label:g.label, sales:kept, missing:miss, total:all.length };
    });
  }
  function sameSet(a, b){ a = (a || []).slice().sort(); b = (b || []).slice().sort(); return JSON.stringify(a) === JSON.stringify(b); }
  function groupMenuHtml(sub){
    var c = CFG[sub], cur = _srState[c.sale] || [], gs = groupsFor(sub);
    if (!gs.length) return '';
    return '<div class="fp-mh">Lọc nhanh theo đội</div>' + gs.map(function(g){
      var on = g.sales.length && sameSet(cur, g.sales);
      var tip = g.sales.length ? ('Lọc ' + g.sales.length + ' Sale: ' + g.sales.slice(0, 25).join(', ') + (g.sales.length > 25 ? '…' : '') + (g.missing.length ? ' — ⚠ ' + g.missing.length + ' tên được phân loại vào đội này nhưng không có trong dữ liệu báo cáo: ' + g.missing.slice(0, 12).join(', ') : ''))
        : (g.total ? 'Có ' + g.total + ' Sale được phân loại vào đội này nhưng không tên nào có trong dữ liệu báo cáo đang xem' : 'Chưa Sale nào được phân loại vào đội này (Báo cáo E → Phân loại Sale)');
      return '<div class="fp-grp' + (on ? ' on' : '') + (g.sales.length ? '' : ' off') + '" data-fp="grp" data-key="' + e(g.key) + '" onclick="_fpDo(\'grp\',this.getAttribute(\'data-key\'))" title="' + e(tip) + '">' + (on ? '✓ ' : '') + e(g.label) + ' <span class="fp-n">' + g.sales.length + ' sale</span></div>';
    }).join('');
  }
  // Bảng đối chiếu Team → Sale ngay dưới thanh công cụ (trước đây chỉ là toast thoáng qua): Team nào → Sale nào, tên nào bị bỏ vì không có trong dữ liệu báo cáo
  function infoHtml(sub){
    var c = CFG[sub]; if (!c.team) return '';
    var teamsSel = _srState[c.team] || [], info = (_srState._teamSyncInfo || {})[c.sale];
    if (!teamsSel.length || !info) return '';
    return '<div id="fp-info" class="fp-info">👥 Team <b>' + e(info.teams.join(', ')) + '</b> → đang lọc <b>' + info.sales.length + '</b> Sale: ' + e(info.sales.slice(0, 15).join(', ') + (info.sales.length > 15 ? '…' : '')) +
      (info.missing.length ? '<br><span class="fp-bad">⚠ ' + info.missing.length + ' tên trong Team không có trong dữ liệu báo cáo nên BỊ BỎ: ' + e(info.missing.slice(0, 15).join(', ')) + ' — sửa tên ở “Quản lý Team” hoặc gán Thẻ cho đúng.</span>' : '') +
      (info.notFound.length ? '<br><span class="fp-bad">⚠ Không tìm thấy Team: ' + e(info.notFound.join(', ')) + '</span>' : '') + '</div>';
  }
  function applyGroup(key){
    var sub = _srState.sub, c = CFG[sub]; if (!c) return;
    var g = groupsFor(sub).filter(function(x){ return x.key === key; })[0]; if (!g) return;
    if (!g.sales.length) { toastF('⚠ Đội “' + g.label + '”: ' + (g.total ? 'không tên Sale nào khớp dữ liệu báo cáo đang xem' : 'chưa có Sale nào được phân loại (Báo cáo E → Phân loại Sale)')); return; }
    _srState[c.sale] = g.sales.slice();
    if (c.team) _srState[c.team] = [];
    _srState['_autoSaleSig_' + c.sale] = '';
    if (c.custom) _srState[c.custom] = true;
    if (typeof _srEnforceScope === 'function') _srEnforceScope();
    toastF('Đã lọc đội “' + g.label + '” (' + g.sales.length + ' Sale)' + (g.missing.length ? ' — ' + g.missing.length + ' tên không có trong báo cáo' : ''));
    if (typeof _srApply === 'function') _srApply(); else renderSalesReportTab();
  }
  function ctlHtml(sub){
    var list = forSub(sub), c = CFG[sub], act = activeOf(sub), h = '<span class="fp-ctl" id="fp-ctl">';
    function nSale(p){ return ((p.filters && p.filters[c.sale]) || []).length; }
    if (list.length === 1){
      var p1 = list[0], n1 = nSale(p1);
      h += '<button type="button" class="btn sm fp-one' + (act ? ' on' : '') + '" data-fp="apply" data-id="' + e(p1.id) + '" onclick="_fpPick(this.getAttribute(\'data-id\'))" title="' + e(describe(p1)) + '">⚡ ' + e(p1.name) + (n1 ? ' <span class="fp-n">' + n1 + ' sale</span>' : '') + '</button>';
    } else if (list.length > 1){
      h += '<select class="fp-sel' + (act ? ' on' : '') + '" onchange="_fpPick(this.value)" title="Chọn mẫu lọc nhanh">' +
        '<option value="">⚡ Mẫu lọc nhanh…</option>' +
        list.map(function(p){ var n = nSale(p); return '<option value="' + e(p.id) + '"' + (act && act.id === p.id ? ' selected' : '') + '>' + e(p.name) + (n ? ' (' + n + ' sale)' : '') + '</option>'; }).join('') + '</select>';
    }
    if (act) h += '<button type="button" class="btn sm fp-off" data-fp="off" onclick="_fpOff()" title="Tắt lọc nhanh: bỏ các bộ lọc đang chọn của báo cáo này và tải lại">✕ Tắt lọc nhanh</button>';
    h += '<div class="gear-menu"><button type="button" class="btn sm" onclick="_srToggleGearMenu(event,\'fp-gear\')">' + (list.length ? '⚙ Mẫu ▾' : '⚡ Mẫu lọc nhanh ▾') + '</button>' +
      '<div class="gear-menu-list fp-gear" id="fp-gear">' +
      '<div data-fp="new" onclick="_fpDo(\'new\')">＋ Tạo mẫu (chọn sẵn các Sale)</div>' +
      '<div data-fp="save" onclick="_fpDo(\'save\')" title="Lưu đúng bộ lọc đang chọn (Sale, Kênh, Sản phẩm…, không gồm ngày) thành mẫu">💾 Lưu bộ lọc hiện tại thành mẫu</div>' +
      groupMenuHtml(sub) +
      (list.length ? '<div class="fp-mh">Quản lý mẫu</div>' : '') +
      list.map(function(p){
        return '<div class="fp-mrow" title="' + e(describe(p)) + '"><span class="fp-mn">' + e(p.name) + '</span>' +
          '<span class="fp-ic" data-fp="edit" data-id="' + e(p.id) + '" onclick="_fpDo(\'edit\',this.getAttribute(\'data-id\'))" title="Sửa tên / danh sách Sale của mẫu">✎</span>' +
          '<span class="fp-ic" data-fp="overwrite" data-id="' + e(p.id) + '" onclick="_fpDo(\'overwrite\',this.getAttribute(\'data-id\'))" title="Ghi đè mẫu bằng bộ lọc đang chọn">⟳</span>' +
          '<span class="fp-ic" data-fp="del" data-id="' + e(p.id) + '" onclick="_fpDo(\'del\',this.getAttribute(\'data-id\'))" title="Xoá mẫu">✕</span></div>';
      }).join('') + '</div></div></span>';
    return h;
  }
  function inject(){
    var wrap = document.getElementById('salesreport-wrap'); if (!wrap) return;
    ['fp-ctl','fp-bar','fp-info'].forEach(function(id){ var old = document.getElementById(id); if (old && old.parentNode) old.parentNode.removeChild(old); });
    var sub = (typeof _srState !== 'undefined') ? _srState.sub : ''; if (!CFG[sub]) return;
    var bar = wrap.querySelector('.srb-bar'); if (!bar) return;
    var anchor = null; for (var i = bar.children.length - 1; i >= 0; i--) { if (bar.children[i].classList.contains('gear-menu')) { anchor = bar.children[i]; break; } }
    if (anchor) anchor.insertAdjacentHTML('beforebegin', ctlHtml(sub)); else bar.insertAdjacentHTML('beforeend', ctlHtml(sub));
    var inf = infoHtml(sub); if (inf) bar.insertAdjacentHTML('afterend', inf);
  }

  function applyPreset(id){
    var p = loadAll().filter(function(x){ return x.id === id; })[0]; if (!p) return;
    var c = CFG[p.sub]; if (!c || _srState.sub !== p.sub) return;
    c.keys.forEach(function(k){ var v = p.filters ? p.filters[k] : undefined; _srState[k] = (v === undefined) ? emptyLike(_srState[k]) : (Array.isArray(v) ? v.slice() : v); });
    if (c.team) _srState[c.team] = [];          // ô "Lọc theo Team" chỉ là công cụ điền ô Sale — mẫu đã chứa sẵn danh sách Sale
    if (c.custom) _srState[c.custom] = true;     // E/F/G/L: đã tự chỉnh Sale → không bị ghi đè bởi mặc định theo vai trò
    if (typeof _srEnforceScope === 'function') _srEnforceScope();   // người bị giới hạn phạm vi (leader…) vẫn chỉ xem được phần của mình
    ACT[p.sub] = p.id;
    toastF('⚡ Đã áp dụng mẫu “' + p.name + '”');
    if (typeof _srApply === 'function') _srApply(); else renderSalesReportTab();
  }
  function turnOff(){
    var sub = _srState.sub, c = CFG[sub]; if (!c) return;
    c.keys.forEach(function(k){ _srState[k] = emptyLike(_srState[k]); });
    if (c.team) _srState[c.team] = [];
    if (c.custom) _srState[c.custom] = false;     // E/F/G/L: về mặc định theo vai trò
    ACT[sub] = '';
    if (typeof _srEnforceScope === 'function') _srEnforceScope();
    toastF('Đã tắt lọc nhanh');
    if (typeof _srApply === 'function') _srApply(); else renderSalesReportTab();
  }
  function saveCurrent(){
    var sub = _srState.sub, c = CFG[sub]; if (!c) return;
    var name = (prompt('Đặt tên cho mẫu lọc (vd “Văn phòng”, “Nhóm Online mới”):', '') || '').trim();
    if (!name) return;
    if (forSub(sub).some(function(p){ return p.name.toLowerCase() === name.toLowerCase(); })) { toastF('⚠ Đã có mẫu tên “' + name + '” — hãy đặt tên khác hoặc dùng ⟳ để ghi đè.'); return; }
    var list = loadAll(), np = { id:newId(), sub:sub, name:name, filters:snapshot(sub), created:Date.now() }; list.push(np);
    if (saveAll(list)) { ACT[sub] = np.id; toastF('✓ Đã lưu mẫu “' + name + '”'); inject(); }
  }
  function overwrite(id){
    var list = loadAll(), p = list.filter(function(x){ return x.id === id; })[0]; if (!p || p.sub !== _srState.sub) return;
    if (!confirm('Ghi đè mẫu “' + p.name + '” bằng bộ lọc đang chọn?')) return;
    p.filters = snapshot(p.sub);
    if (saveAll(list)) { toastF('✓ Đã cập nhật mẫu “' + p.name + '”'); inject(); }
  }
  function del(id){
    var list = loadAll(), p = list.filter(function(x){ return x.id === id; })[0]; if (!p) return;
    if (!confirm('Xoá mẫu “' + p.name + '”?')) return;
    if (saveAll(list.filter(function(x){ return x.id !== id; }))) { toastF('Đã xoá mẫu “' + p.name + '”'); inject(); }
  }

  // ── Hộp "Tạo / sửa mẫu": đặt tên + tick các Sale ──
  function saleOptionsFor(sub){
    var c = CFG[sub], arr = (_srState[c.opts] && _srState[c.opts].length) ? _srState[c.opts] : (_srState.saleOptions || _srState.saleBOptions || []);
    return arr.filter(Boolean).map(String);
  }
  function openEditor(id){
    var sub = _srState.sub, c = CFG[sub]; if (!c) return;
    var p = id ? loadAll().filter(function(x){ return x.id === id; })[0] : null;
    D.editId = p ? p.id : ''; D.sub = sub; D.name = p ? p.name : ''; D.q = ''; D.sales = {};
    ((p && p.filters && p.filters[c.sale]) || []).forEach(function(n){ D.sales[n] = true; });
    var ov = document.getElementById('fp-overlay');
    if (!ov){
      ov = document.createElement('div'); ov.id = 'fp-overlay'; ov.className = 'fp-overlay';
      ov.innerHTML = '<div class="fp-box" id="fp-box"></div>'; document.body.appendChild(ov);
      ov.addEventListener('click', function(ev){ if (ev.target === ov) closeEditor(); });
      ov.addEventListener('input', function(ev){
        if (ev.target.id === 'fp-name') D.name = ev.target.value;
        else if (ev.target.id === 'fp-q'){ D.q = ev.target.value; renderList(); }
      });
      ov.addEventListener('change', function(ev){
        var t = ev.target; if (t.getAttribute('data-fp-sale') === null) return;
        var n = t.getAttribute('data-fp-sale'); if (t.checked) D.sales[n] = true; else delete D.sales[n];
        renderCount();
      });
      ov.addEventListener('click', function(ev){
        var b = ev.target.closest && ev.target.closest('[data-fp-act]'); if (!b) return;
        var a = b.getAttribute('data-fp-act');
        if (a === 'close') closeEditor();
        else if (a === 'all'){ filtered().forEach(function(n){ D.sales[n] = true; }); renderList(); }
        else if (a === 'none'){ filtered().forEach(function(n){ delete D.sales[n]; }); renderList(); }
        else if (a === 'save') saveEditor();
      });
    }
    var opts = saleOptionsFor(sub);
    document.getElementById('fp-box').innerHTML =
      '<div class="fp-eh"><b>' + (p ? '✎ Sửa mẫu lọc' : '＋ Tạo mẫu lọc') + '</b><button type="button" class="btn secondary sm" data-fp-act="close" aria-label="Đóng">✕</button></div>' +
      '<div class="fp-eb"><label class="fp-l" for="fp-name">Tên mẫu</label><input id="fp-name" class="fp-in" maxlength="40" placeholder="vd Văn phòng" value="' + e(D.name) + '">' +
      '<label class="fp-l" for="fp-q">Chọn các Sale trong mẫu</label><input id="fp-q" class="fp-in" placeholder="🔍 Tìm Sale…" autocomplete="off">' +
      '<div class="fp-tools"><button type="button" class="btn sm secondary" data-fp-act="all">Chọn tất cả (đang hiện)</button><button type="button" class="btn sm secondary" data-fp-act="none">Bỏ chọn (đang hiện)</button><span class="fp-mu" id="fp-count"></span></div>' +
      '<div class="fp-list" id="fp-list"></div>' +
      (opts.length ? '' : '<div class="fp-warn">Chưa tải được danh sách Sale — đóng hộp, đợi báo cáo tải xong rồi mở lại.</div>') +
      (p ? '<div class="fp-mu">Các bộ lọc khác của mẫu (Kênh, Sản phẩm…) được giữ nguyên.</div>' : '<div class="fp-mu">Mẫu tạo ở đây chỉ chứa danh sách Sale (không kèm Kênh/Sản phẩm). Muốn kèm các lọc khác, đặt bộ lọc rồi bấm “💾 Lưu bộ lọc hiện tại”.</div>') + '</div>' +
      '<div class="fp-ef"><button type="button" class="btn secondary" data-fp-act="close">Huỷ</button><button type="button" class="btn" data-fp-act="save">💾 Lưu mẫu</button></div>';
    ov.classList.add('open'); renderList();
    var ni = document.getElementById('fp-name'); if (ni && !D.name) ni.focus();
  }
  function filtered(){
    var q = (D.q || '').trim().toLowerCase();
    return saleOptionsFor(D.sub).filter(function(n){ return !q || n.toLowerCase().indexOf(q) !== -1; });
  }
  function renderCount(){ var el = document.getElementById('fp-count'); if (el) el.textContent = 'Đã chọn ' + Object.keys(D.sales).length + ' Sale'; }
  function renderList(){
    var el = document.getElementById('fp-list'); if (!el) return;
    var list = filtered();
    el.innerHTML = list.length ? list.map(function(n){ return '<label class="fp-row"><input type="checkbox" data-fp-sale="' + e(n) + '"' + (D.sales[n] ? ' checked' : '') + '> ' + e(n) + '</label>'; }).join('') : '<div class="fp-mu" style="padding:10px">Không có Sale nào khớp.</div>';
    renderCount();
  }
  function closeEditor(){ var ov = document.getElementById('fp-overlay'); if (ov) ov.classList.remove('open'); }
  function saveEditor(){
    var sub = D.sub, c = CFG[sub], name = (D.name || '').trim();
    if (!name){ toastF('⚠ Hãy đặt tên cho mẫu.'); return; }
    var sales = Object.keys(D.sales);
    if (!sales.length && !confirm('Mẫu chưa chọn Sale nào — bấm mẫu sẽ KHÔNG giới hạn Sale. Vẫn lưu?')) return;
    var list = loadAll();
    if (list.some(function(p){ return p.sub === sub && p.id !== D.editId && p.name.toLowerCase() === name.toLowerCase(); })){ toastF('⚠ Đã có mẫu tên “' + name + '” — hãy đặt tên khác.'); return; }
    var p = D.editId ? list.filter(function(x){ return x.id === D.editId; })[0] : null;
    if (p){ p.name = name; p.filters = p.filters || {}; p.filters[c.sale] = sales; }
    else { var f = {}; c.keys.forEach(function(k){ f[k] = (k === c.sale) ? sales : emptyLike(_srState[k]); }); list.push({ id:newId(), sub:sub, name:name, filters:f, created:Date.now() }); }
    if (saveAll(list)){ toastF('✓ Đã lưu mẫu “' + name + '”'); closeEditor(); inject(); }
  }

  // Hành động từ ô mẫu trên thanh công cụ (gọi bằng onclick/onchange nhúng sẵn vì ô bị vẽ lại mỗi lần render)
  window._fpPick = function(id){ if (id) applyPreset(id); else { if (activeOf(_srState.sub)) turnOff(); else inject(); } };
  window._fpOff = turnOff;
  window._fpDo = function(a, id){
    if (a === 'grp') applyGroup(id); else if (a === 'new') openEditor(''); else if (a === 'edit') openEditor(id);
    else if (a === 'save') saveCurrent(); else if (a === 'overwrite') overwrite(id); else if (a === 'del') del(id);
  };
  window._fpRefresh = function(){ try { inject(); } catch(err){} };   // bộ lọc đổi qua menu 🔎 → cập nhật trạng thái mẫu đang dùng
  // Bọc renderSalesReportTab: sau mỗi lần vẽ báo cáo thì chèn lại thanh mẫu
  var _orig = window.renderSalesReportTab;
  if (typeof _orig === 'function') {
    window.renderSalesReportTab = renderSalesReportTab = function(){ var r = _orig.apply(this, arguments); try { inject(); } catch(err){} return r; };
  }
  window._fpApplyGroup = applyGroup; window._fpGroups = groupsFor; window._fpApply = applyPreset; window._fpList = loadAll;   // dùng cho test
})();

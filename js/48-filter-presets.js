// ═══════════════════════════════════════════════════════
//  MẪU LỌC NHANH cho Báo cáo doanh số (A, B, C, D, E, F, G, L) — Duyên yêu cầu 12/10/2026 (lọc theo Team hay lỗi → tự tạo mẫu).
//  Mẫu = tên + danh sách Sale (+ các bộ lọc khác của báo cáo đó như Kênh/Nguồn/Sản phẩm…) — KHÔNG gồm ngày (ngày vẫn chọn riêng).
//  Bấm mẫu → gán thẳng bộ lọc rồi tải lại báo cáo, KHÔNG đi qua "Lọc theo Team" (_srSyncTeamToSale_).
//  (18/10/2026, Duyên) MẪU DÙNG CHUNG MỌI BÁO CÁO: mẫu = tên + danh sách Sale (+ bộ lọc riêng của từng báo cáo nếu lưu từ báo cáo đó) — tạo ở 1 báo cáo thì
//  báo cáo nào có ô Sale cũng bấm được; tên Sale tự đổi sang đúng tên có trong báo cáo đang xem (khớp theo danh tính/bí danh). H, I (chọn 1 CS) và M không có ô
//  lọc nhiều Sale nên không có thanh mẫu. Mẫu theo TỪNG tài khoản; lưu ở trình duyệt (localStorage, khoá v2; mẫu cũ theo từng báo cáo (v1) tự gộp sang v2).
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
  CFG.K = CFG.G;   // K = màn Thưởng (cùng bộ lọc với G; _srState.sub === 'K' khi xem theo kiểu khác)
  function curSub(){ return (typeof _srState !== 'undefined') ? _srState.sub : ''; }
  var D = { editId:'', sub:'', name:'', sales:{}, q:'' };   // trạng thái hộp "Tạo / sửa mẫu"

  function e(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toastF(m){ if (typeof toast === 'function') toast(m); }
  function userKey(){ return (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) || ''; }
  function storeKey(){ return 'ome_sr_filter_presets_v2:' + userKey(); }
  function storeKeyV1(){ return 'ome_sr_filter_presets_v1:' + userKey(); }
  // Mẫu v1 (theo TỪNG báo cáo: {sub, filters}) -> v2 (dùng chung: {sales, extras:{báo cáo:{khoá:giá trị}}}); cùng tên (không phân biệt hoa/thường) thì gộp:
  // Sale hợp lại, bộ lọc riêng giữ theo từng báo cáo.
  function migrateV1(){
    var old = []; try { old = JSON.parse(localStorage.getItem(storeKeyV1()) || '[]'); } catch(err){ return []; }
    if (!Array.isArray(old) || !old.length) return [];
    var byName = {}, out = [];
    old.forEach(function(p){
      var c = p && CFG[p.sub]; if (!c) return;
      var key = String(p.name || '').toLowerCase(), q = byName[key];
      if (!q){ q = byName[key] = { id: p.id || newId(), name: p.name, sales: [], extras: {}, created: p.created || Date.now() }; out.push(q); }
      ((p.filters && p.filters[c.sale]) || []).forEach(function(n){ if (q.sales.indexOf(n) === -1) q.sales.push(n); });
      var ex = {}; c.keys.forEach(function(k){ if (k === c.sale) return; var v = p.filters ? p.filters[k] : undefined; if (Array.isArray(v) ? v.length : v) ex[k] = Array.isArray(v) ? v.slice() : v; });
      if (Object.keys(ex).length) q.extras[p.sub] = ex;
    });
    return out;
  }
  function loadAll(){
    try {
      var raw = localStorage.getItem(storeKey());
      if (raw === null || raw === undefined) { var m = migrateV1(); if (m.length) { try { localStorage.setItem(storeKey(), JSON.stringify(m)); } catch(err2){} } return m; }
      var v = JSON.parse(raw); return Array.isArray(v) ? v : [];
    } catch(err){ return []; }
  }
  function saveAll(list){ try { localStorage.setItem(storeKey(), JSON.stringify(list)); return true; } catch(err){ toastF('⚠ Không lưu được mẫu (trình duyệt chặn lưu dữ liệu).'); return false; } }
  function forSub(sub){ return CFG[sub] ? loadAll().filter(function(p){ return p; }) : []; }   // MỌI báo cáo có ô Sale đều thấy MỌI mẫu
  function emptyLike(v){ return Array.isArray(v) ? [] : (typeof v === 'boolean' ? false : ''); }
  // Bộ lọc riêng (không Sale) của báo cáo đang xem — chỉ khoá có giá trị
  function extrasOf(sub){
    var c = CFG[sub], ex = {};
    c.keys.forEach(function(k){ if (k === c.sale) return; var v = _srState[k]; if (Array.isArray(v) ? v.length : v) ex[k] = Array.isArray(v) ? v.slice() : v; });
    return ex;
  }
  // Tên Sale của mẫu -> tên có trong báo cáo `sub` (khớp không phân biệt hoa/thường/dấu và theo danh tính/bí danh). names = tên dùng được, missing = tên không có trong báo cáo này.
  function mapSales(sales, sub){
    var opts = saleOptionsFor(sub), out = [], missing = [], seen = {};
    if (!opts.length) return { names: (sales || []).slice(), missing: [], unchecked: true };   // chưa tải danh sách Sale -> giữ nguyên tên
    var byFold = {}; opts.forEach(function(o){ if (byFold[foldN(o)] === undefined) byFold[foldN(o)] = o; });
    (sales || []).forEach(function(n){
      var hit = byFold[foldN(n)];
      if (hit === undefined && typeof _cfgAliasesOf === 'function') {
        var al = _cfgAliasesOf(n); for (var i = 0; i < al.length && hit === undefined; i++) hit = byFold[foldN(al[i])];
      }
      if (hit === undefined && typeof _cfgAliasesOf === 'function') {   // chiều ngược: tên trong báo cáo là bí danh của tên trong mẫu
        for (var j = 0; j < opts.length && hit === undefined; j++) { if (_cfgAliasesOf(opts[j]).some(function(x){ return foldN(x) === foldN(n); })) hit = opts[j]; }
      }
      if (hit === undefined) { missing.push(n); return; }
      if (!seen[hit]) { seen[hit] = 1; out.push(hit); }
    });
    return { names: out, missing: missing };
  }
  function sameFilters(sub, p){
    var c = CFG[sub];
    if (!sameSet(_srState[c.sale] || [], mapSales(p.sales, sub).names)) return false;
    var ex = (p.extras && p.extras[sub]) || null;
    if (!ex) return true;   // mẫu không có bộ lọc riêng cho báo cáo này -> chỉ so Sale
    return c.keys.every(function(k){
      if (k === c.sale) return true;
      var a = _srState[k], b = ex[k];
      if (Array.isArray(a) || Array.isArray(b)) return sameSet(a || [], b || []);
      return String(a || '') === String(b || '');
    });
  }
  function describe(p){
    var parts = [(p.sales && p.sales.length) ? 'Sale: ' + p.sales.slice(0, 20).join(', ') + (p.sales.length > 20 ? '…' : '') : 'Không giới hạn Sale'];
    Object.keys(p.extras || {}).forEach(function(sb){ var ex = p.extras[sb]; Object.keys(ex).forEach(function(k){ var v = ex[k]; parts.push('BC ' + sb + ' · ' + k + ': ' + (Array.isArray(v) ? v.join(', ') : v)); }); });
    return parts.join(' · ');
  }
  function newId(){ return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ── Ô mẫu nằm TRONG thanh công cụ (.srb-bar), cùng hàng với 🧰 Tác vụ ──
  //  0 mẫu: chỉ có menu "⚡ Mẫu lọc nhanh ▾" (Tạo mẫu / Lưu bộ lọc hiện tại) · 1 mẫu: 1 nút bấm là lọc · ≥2 mẫu: dropdown chọn mẫu.
  //  Đang dùng mẫu → hiện nút "✕ Tắt lọc nhanh" (bỏ các bộ lọc của báo cáo này và tải lại).
  var ACT = {};   // báo cáo -> id mẫu vừa bấm (ưu tiên khi 2 mẫu giống hệt nhau)
  function hasAny(sub, p){ return !!((p.sales && p.sales.length) || (p.extras && p.extras[sub] && Object.keys(p.extras[sub]).length)); }
  function activeOf(sub){
    var list = forSub(sub), t = list.filter(function(p){ return p.id === ACT[sub]; })[0];
    if (t && sameFilters(sub, t)) return t;
    return list.filter(function(p){ return hasAny(sub, p) && sameFilters(sub, p); })[0] || null;
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
  // + 1 mục "Tất cả đội" = hợp mọi đội có Sale (vd Văn phòng + Online = toàn phòng kinh doanh)
  var _groupsFor0 = groupsFor;
  groupsFor = function(sub){
    var gs = _groupsFor0(sub), live = gs.filter(function(g){ return g.sales.length; });
    if (live.length >= 2) {
      var all = [], miss = [], total = 0;
      gs.forEach(function(g){ g.sales.forEach(function(n){ if (all.indexOf(n) === -1) all.push(n); }); g.missing.forEach(function(n){ if (miss.indexOf(n) === -1) miss.push(n); }); total += g.total; });
      gs = gs.concat([{ key:'__all__', label:'Tất cả đội (' + live.map(function(g){ return g.label; }).join(' + ') + ')', sales:all, missing:miss, total:total }]);
    }
    return gs;
  };
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
    var sub = curSub(), c = CFG[sub]; if (!c) return;
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
    function nSale(p){ return (p.sales || []).length; }
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
    var sub = curSub(); if (!CFG[sub]) return;
    var bar = wrap.querySelector('.srb-bar'); if (!bar) return;
    var anchor = null; for (var i = bar.children.length - 1; i >= 0; i--) { if (bar.children[i].classList.contains('gear-menu')) { anchor = bar.children[i]; break; } }
    // (18/10/2026) Cụm mẫu đặt SAU 🧰 Tác vụ: thanh công cụ dài quá thì chip mẫu xuống dòng, còn Tác vụ luôn ở hàng đầu cùng ô chọn báo cáo/ngày/Bộ lọc/Lọc.
    if (anchor) anchor.insertAdjacentHTML('afterend', ctlHtml(sub)); else bar.insertAdjacentHTML('beforeend', ctlHtml(sub));
    var inf = infoHtml(sub); if (inf) bar.insertAdjacentHTML('afterend', inf);
  }

  function applyPreset(id){
    var p = loadAll().filter(function(x){ return x.id === id; })[0]; if (!p) return;
    var sub = curSub(), c = CFG[sub]; if (!c) return;
    var mp = mapSales(p.sales, sub);
    _srState[c.sale] = mp.names.slice();            // Sale của mẫu -> đúng tên có trong báo cáo này
    // Đổi từ mẫu khác sang: gỡ bộ lọc riêng do MẪU TRƯỚC đặt (vd Kênh) để không dính sang mẫu mới; bộ lọc người dùng tự chọn ngoài mẫu thì giữ
    var prev = ACT[sub] && ACT[sub] !== p.id ? loadAll().filter(function(x){ return x.id === ACT[sub]; })[0] : null;
    if (prev && prev.extras && prev.extras[sub]) Object.keys(prev.extras[sub]).forEach(function(k){ if (c.keys.indexOf(k) !== -1) _srState[k] = emptyLike(_srState[k]); });
    var ex = p.extras && p.extras[sub];
    if (ex) c.keys.forEach(function(k){ if (k === c.sale) return; var v = ex[k]; _srState[k] = (v === undefined) ? emptyLike(_srState[k]) : (Array.isArray(v) ? v.slice() : v); });   // bộ lọc riêng lưu từ chính báo cáo này
    if (c.team) _srState[c.team] = [];          // ô "Lọc theo Team" chỉ là công cụ điền ô Sale — mẫu đã chứa sẵn danh sách Sale
    if (c.custom) _srState[c.custom] = true;     // E/F/G/L: đã tự chỉnh Sale → không bị ghi đè bởi mặc định theo vai trò
    var before = JSON.stringify(c.keys.map(function(k){ return _srState[k]; }));
    if (typeof _srEnforceScope === 'function') _srEnforceScope();   // người bị giới hạn phạm vi (leader…) vẫn chỉ xem được phần của mình
    var limited = before !== JSON.stringify(c.keys.map(function(k){ return _srState[k]; }));
    ACT[sub] = p.id;
    var note = mp.missing.length ? ' — ' + mp.missing.length + ' tên không có trong báo cáo này (' + mp.missing.slice(0, 5).join(', ') + (mp.missing.length > 5 ? '…' : '') + ')' : '';
    toastF(limited ? '⚠ Mẫu “' + p.name + '” bị giới hạn theo quyền của bạn — chỉ xem được dữ liệu của mình' : '⚡ Đã áp dụng mẫu “' + p.name + '” (' + mp.names.length + ' Sale)' + note);
    if (typeof _srApply === 'function') _srApply(); else renderSalesReportTab();
  }
  function turnOff(){
    var sub = curSub(), c = CFG[sub]; if (!c) return;
    c.keys.forEach(function(k){ _srState[k] = emptyLike(_srState[k]); });
    if (c.team) _srState[c.team] = [];
    if (c.custom) _srState[c.custom] = false;     // E/F/G/L: về mặc định theo vai trò
    ACT[sub] = '';
    if (typeof _srEnforceScope === 'function') _srEnforceScope();
    toastF('Đã tắt lọc nhanh');
    if (typeof _srApply === 'function') _srApply(); else renderSalesReportTab();
  }
  function nameTaken(name, exceptId){
    return loadAll().some(function(p){ return p.id !== exceptId && String(p.name || '').toLowerCase() === String(name).toLowerCase(); });
  }
  function saveCurrent(){
    var sub = curSub(), c = CFG[sub]; if (!c) return;
    var name = (prompt('Đặt tên cho mẫu lọc (vd “Văn phòng”, “Phòng KD”). Mẫu dùng được ở MỌI báo cáo:', '') || '').trim();
    if (!name) return;
    if (nameTaken(name, '')) { toastF('⚠ Đã có mẫu tên “' + name + '” — hãy đặt tên khác hoặc dùng ⟳ để ghi đè.'); return; }
    var ex = extrasOf(sub), np = { id:newId(), name:name, sales:(_srState[c.sale] || []).slice(), extras:{}, created:Date.now() };
    if (Object.keys(ex).length) np.extras[sub] = ex;
    var list = loadAll(); list.push(np);
    if (saveAll(list)) { ACT[sub] = np.id; toastF('✓ Đã lưu mẫu “' + name + '” — dùng được ở mọi báo cáo'); inject(); }
  }
  function overwrite(id){
    var list = loadAll(), p = list.filter(function(x){ return x.id === id; })[0], sub = curSub(), c = CFG[sub]; if (!p || !c) return;
    if (!confirm('Ghi đè mẫu “' + p.name + '” bằng bộ lọc đang chọn?')) return;
    p.sales = (_srState[c.sale] || []).slice();
    p.extras = p.extras || {}; var ex = extrasOf(sub); if (Object.keys(ex).length) p.extras[sub] = ex; else delete p.extras[sub];
    if (saveAll(list)) { toastF('✓ Đã cập nhật mẫu “' + p.name + '”'); inject(); }
  }
  function del(id){
    var list = loadAll(), p = list.filter(function(x){ return x.id === id; })[0]; if (!p) return;
    if (!confirm('Xoá mẫu “' + p.name + '” (khỏi MỌI báo cáo)?')) return;
    if (saveAll(list.filter(function(x){ return x.id !== id; }))) { toastF('Đã xoá mẫu “' + p.name + '”'); inject(); }
  }

  // ── Hộp "Tạo / sửa mẫu": đặt tên + tick các Sale ──
  function saleOptionsFor(sub){
    var c = CFG[sub], arr = (_srState[c.opts] && _srState[c.opts].length) ? _srState[c.opts] : (_srState.saleOptions || _srState.saleBOptions || []);
    return arr.filter(Boolean).map(String);
  }
  function openEditor(id){
    var sub = curSub(), c = CFG[sub]; if (!c) return;
    var p = id ? loadAll().filter(function(x){ return x.id === id; })[0] : null;
    D.editId = p ? p.id : ''; D.sub = sub; D.name = p ? p.name : ''; D.q = ''; D.sales = {};
    ((p && p.sales) || []).forEach(function(n){ D.sales[n] = true; });
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
      (p ? '<div class="fp-mu">Các bộ lọc khác của mẫu (Kênh, Sản phẩm…) được giữ nguyên. Mẫu dùng được ở mọi báo cáo.</div>' : '<div class="fp-mu">Mẫu chứa danh sách Sale và dùng được ở MỌI báo cáo (không kèm Kênh/Sản phẩm). Muốn kèm các lọc khác, đặt bộ lọc rồi bấm “💾 Lưu bộ lọc hiện tại”.</div>') + '</div>' +
      '<div class="fp-ef"><button type="button" class="btn secondary" data-fp-act="close">Huỷ</button><button type="button" class="btn" data-fp-act="save">💾 Lưu mẫu</button></div>';
    ov.classList.add('open'); renderList();
    var ni = document.getElementById('fp-name'); if (ni && !D.name) ni.focus();
  }
  function filtered(){
    var q = (D.q || '').trim().toLowerCase(), opts = saleOptionsFor(D.sub), have = {};
    opts.forEach(function(n){ have[n] = 1; });
    // tên đã có trong mẫu nhưng báo cáo này không có (mẫu tạo từ báo cáo khác): vẫn hiện để bỏ chọn được
    var extra = Object.keys(D.sales).filter(function(n){ return !have[n]; });
    return extra.concat(opts).filter(function(n){ return !q || n.toLowerCase().indexOf(q) !== -1; });
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
    var sales = Object.keys(D.sales);   // giữ cả tên không có trong báo cáo hiện tại (mẫu dùng chung nhiều báo cáo)
    if (!sales.length && !confirm('Mẫu chưa chọn Sale nào — bấm mẫu sẽ KHÔNG giới hạn Sale. Vẫn lưu?')) return;
    var list = loadAll();
    if (nameTaken(name, D.editId)){ toastF('⚠ Đã có mẫu tên “' + name + '” — hãy đặt tên khác.'); return; }
    var p = D.editId ? list.filter(function(x){ return x.id === D.editId; })[0] : null;
    if (p){ p.name = name; p.sales = sales; }
    else list.push({ id:newId(), name:name, sales:sales, extras:{}, created:Date.now() });
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

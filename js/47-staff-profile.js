// ═══════════════════════════════════════════════════════
//  HỒ SƠ NHÂN VIÊN — MÀN HÌNH ĐẦY ĐỦ (không phải hộp thoại nhỏ; nút ← Quay lại): nhân viên tự cập nhật họ tên / SĐT / email / link Facebook;
//  admin sửa hộ; quản lý + leader xem hồ sơ kèm tổng quan kết quả làm việc theo kỳ.
//  Backend: gas/28_StaffProfile.gs (action profileGet / profileSave / staffOverview) — SERVER kiểm quyền thật; client chỉ ẩn/hiện.
//  Token phiên do bộ bọc fetch ở js/06 tự gắn. Số đơn/doanh thu/hoa hồng/thưởng/Pancake/xếp hạng do server tính (cùng nguồn báo cáo);
//  số khách đang giữ + đã kết bạn đếm tại đây từ allCustomers (cùng nguồn danh sách KH).
// ═══════════════════════════════════════════════════════
(function(){
  var S = { username:'', quick:'thisMonth', from:'', to:'', data:null, ov:null, err:'', loading:false, seq:0, opts:null, optsLoading:false };
  function e(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function role(){ return (typeof currentUser !== 'undefined' && currentUser && currentUser.role) || ''; }
  function myUser(){ return (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) || ''; }
  function canPick(){ var r = role(); return r === 'admin' || r === 'manager' || r === 'leader'; }
  function toastS(m){ if (typeof toast === 'function') toast(m); }
  // TEN THEO HE THONG (yeu cau Duyen 26/11/2026): 1 ho so chuan = ten Pancake + CRM + Base + POS cua cung 1 nguoi. Chi admin sua; backend gop vao salePersonTags de bao cao gop theo NGUOI.
  var NAME_SYS = [ ['pancake', '🥞 Tên Pancake', 'tên sale trên Pancake'], ['crm', '🏷️ Tên CRM', 'tên đăng nhập / tên trong CRM'], ['base', '📦 Tên Base', 'cột Sale bán trên Base'], ['pos', '🧾 Tên POS', 'cột Thẻ trên POS'] ];
  function namesOf(p){ var n = (p && p.names) || {}, o = {}; NAME_SYS.forEach(function(x){ o[x[0]] = Array.isArray(n[x[0]]) ? n[x[0]] : []; }); return o; }
  function splitNames(v){ var seen = {}, out = []; String(v == null ? '' : v).split(/[,;\n]+/).forEach(function(x){ x = x.replace(/\s+/g, ' ').trim(); var k = x.toLowerCase(); if (x && !seen[k]){ seen[k] = 1; out.push(x); } }); return out; }
  function namesFromForm(){ var o = {}; NAME_SYS.forEach(function(x){ var el = document.getElementById('sp-nm-' + x[0]); o[x[0]] = splitNames(el ? el.value : ''); }); return o; }
  function namesHtml(d, p){
    var nm = namesOf(p), ed = !!d.canEditNames, h = '<div class="sp-sec sp-names"><div class="sp-st">🔗 Tên theo từng hệ thống</div>' +
      '<div class="sp-mu sp-wn">Điền tên của <b>cùng 1 người</b> ở mỗi hệ thống (nhiều tên cách nhau dấu phẩy). Cài Team sẽ chọn theo hồ sơ này; doanh thu / đơn của mọi tên được gộp cho nhân viên.' + (ed ? ' <b>Bấm chọn tên có sẵn bên dưới ô hoặc tự gõ</b> (tên đang thuộc người khác sẽ bị từ chối khi lưu).' : ' Bạn chỉ xem được, không sửa.') + '</div>';
    NAME_SYS.forEach(function(x){
      var val = nm[x[0]].slice();
      if (ed && x[0] === 'crm' && !val.length && d.username) val = [d.username];   // goi y san ten CRM = ten dang nhap
      h += '<label class="sp-lb" for="sp-nm-' + x[0] + '">' + e(x[1]) + '</label>';
      if (ed) h += '<input id="sp-nm-' + x[0] + '" class="sp-in" maxlength="400" placeholder="' + e(x[2]) + '" value="' + e(val.join(', ')) + '" autocomplete="off"><div class="sp-chips" id="sp-ch-' + x[0] + '"></div>';
      else h += '<div class="sp-ro">' + (val.length ? e(val.join(', ')) : '<span class="sp-mu">Chưa cập nhật</span>') + '</div>';
    });
    return h + '</div>';
  }
  // ── Gợi ý tick chọn tên (sale tự chọn tên của mình ở từng hệ thống) ──
  function foldN(x){ return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function refreshChips(sys){
    var box = document.getElementById('sp-ch-' + sys), inp = document.getElementById('sp-nm-' + sys); if (!box || !inp) return;
    var cur = splitNames(inp.value), curK = {}; cur.forEach(function(x){ curK[foldN(x)] = 1; });
    var opt = (S.opts && Array.isArray(S.opts[sys])) ? S.opts[sys] : [], seen = {}, list = [];
    opt.forEach(function(x){ var k = foldN(x); if (k && !seen[k]){ seen[k] = 1; list.push(x); } });
    cur.forEach(function(x){ var k = foldN(x); if (k && !seen[k]){ seen[k] = 1; list.push(x); } });   // tên đã chọn/gõ nhưng không có trong gợi ý vẫn hiện để bỏ chọn được
    var more = list.length > 80 ? list.length - 80 : 0; list = list.slice(0, 80);
    var h = list.map(function(x){ var on = !!curK[foldN(x)];
      return '<button type="button" class="sp-chip' + (on ? ' on' : '') + '" data-sys="' + e(sys) + '" data-name="' + e(x) + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '') + e(x) + '</button>'; }).join('');
    if (!opt.length) h += S.optsLoading ? '<span class="sp-mu">Đang tải gợi ý…</span>' : (S.opts ? '<span class="sp-mu">Chưa có gợi ý — hãy tự gõ tên ở ô trên.</span>' : '');
    if (more) h += '<span class="sp-mu">…và ' + more + ' tên nữa (gõ tên vào ô để thêm)</span>';
    box.innerHTML = h;
  }
  function refreshAllChips(){ NAME_SYS.forEach(function(x){ refreshChips(x[0]); }); }
  function toggleName(sys, name){
    var inp = document.getElementById('sp-nm-' + sys); if (!inp) return;
    var cur = splitNames(inp.value), k = foldN(name), out = cur.filter(function(x){ return foldN(x) !== k; });
    if (out.length === cur.length) out.push(name);   // chưa có → chọn; đã có → bỏ chọn
    inp.value = out.join(', '); refreshChips(sys);
  }
  function loadOptions(username, seq){
    S.opts = null; S.optsLoading = true; refreshAllChips();
    getJson({ action:'profileNameOptions', username:username }).then(function(r){
      if (seq !== S.seq || username !== S.username) return;
      S.optsLoading = false; S.opts = (r && r.ok && r.options) ? r.options : {}; refreshAllChips();
    });
  }
  function rangeOf(key){
    if (key === 'custom') return { from:S.from, to:S.to };
    var r = (typeof _pkQuickRange === 'function') ? _pkQuickRange(key) : null;
    return r || { from:'', to:'' };
  }
  // Danh sách tài khoản được chọn xem: admin tất cả; quản lý tất cả (server lọc theo phòng); leader chỉ cùng team; sale chỉ mình.
  function pickList(){
    var list = (typeof accounts !== 'undefined' && Array.isArray(accounts)) ? accounts : [];
    var me = myUser(), r = role(), team = (typeof currentUser !== 'undefined' && currentUser && currentUser.team) || '';
    return list.filter(function(a){
      if (!a || a.active === false || a.role === 'demo') return false;
      if (a.username === me) return true;
      if (r === 'admin' || r === 'manager') return true;
      if (r === 'leader') return a.role === 'cs' && team && a.team === team;
      return false;
    }).map(function(a){ return { u:a.username, l:(a.name || a.username) + ' (' + a.username + ')' }; });
  }
  function getJson(params){
    if (typeof gsUrl === 'undefined' || !gsUrl) return Promise.resolve({ ok:false, error:'Chưa kết nối Google Sheets.' });
    var q = Object.keys(params).filter(function(k){ return params[k] !== '' && params[k] != null; }).map(function(k){ return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + q, { redirect:'follow' }).then(function(r){ return r.json(); }).catch(function(){ return { ok:false, error:'Không kết nối được máy chủ.' }; });
  }
  // Đếm khách đang giữ (CS chăm sóc = tên của nhân viên) + đã kết bạn Zalo từ danh sách KH đang tải
  function custStats(names){
    var all = (typeof allCustomers !== 'undefined' && Array.isArray(allCustomers)) ? allCustomers : [];
    var want = {}; (names || []).forEach(function(n){ n = String(n || '').trim().toLowerCase(); if (n) want[n] = 1; });
    var held = 0, friends = 0;
    for (var i = 0; i < all.length; i++){
      var c = all[i], hit = false;
      if (c.careCSSet && c.careCSSet.size){ c.careCSSet.forEach(function(n){ if (!hit && want[String(n).toLowerCase()]) hit = true; }); }
      else { var h = (typeof _heldBy === 'function') ? _heldBy(c) : (c.careCS || ''); if (h && want[String(h).trim().toLowerCase()]) hit = true; }
      if (!hit) continue;
      held++; if (c.zaloStatus === 'Đã kết bạn') friends++;
    }
    return { held:held, friends:friends, total:all.length };
  }
  function ensure(){
    var ov = document.getElementById('sp-overlay'); if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'sp-overlay'; ov.className = 'sp-overlay';
    ov.innerHTML = '<div class="sp-box" role="dialog" aria-modal="true" aria-label="Hồ sơ nhân viên"><div class="sp-head"><button type="button" class="btn secondary sm" id="sp-close" aria-label="Quay lại">← Quay lại</button><b>🪪 Hồ sơ nhân viên</b><span class="sp-sp"></span></div><div class="sp-body" id="sp-body"></div></div>';
    document.body.appendChild(ov);
    document.getElementById('sp-close').addEventListener('click', close);
    document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') close(); });
    ov.addEventListener('input', function(ev){ var t = ev.target; if (t && /^sp-nm-/.test(t.id || '')) refreshChips(t.id.slice(6)); });   // gõ tay → chip tự đổi trạng thái chọn
    ov.addEventListener('change', function(ev){
      var t = ev.target;
      if (t.id === 'sp-pick') load(t.value);
      else if (t.id === 'sp-quick'){ S.quick = t.value; if (t.value !== 'custom'){ var r = rangeOf(t.value); S.from = r.from; S.to = r.to; } resetOverview(); render(); }
      else if (t.id === 'sp-from' || t.id === 'sp-to'){ S[t.id === 'sp-from' ? 'from' : 'to'] = t.value; resetOverview(); }
    });
    ov.addEventListener('click', function(ev){
      var t = ev.target.closest ? ev.target : null; if (!t) return;
      if (t.closest('#sp-save')) save();
      else if (t.closest('#sp-load-ov')) loadOverview();
      else { var ch = t.closest('.sp-chip'); if (ch) toggleName(ch.getAttribute('data-sys'), ch.getAttribute('data-name')); }   // CHỈ tải kết quả làm việc khi bấm nút (Duyên 26/11: đỡ lag)
    });
    return ov;
  }
  function close(){ var ov = document.getElementById('sp-overlay'); if (ov) ov.classList.remove('open'); document.documentElement.classList.remove('sp-lock'); }
  function money(n){ return (n === null || n === undefined) ? '—' : fmt(Math.round(n)) + 'đ'; }
  function pct(n){ return (n === null || n === undefined || !isFinite(n)) ? '—' : (Math.round(n * 10) / 10) + '%'; }
  function card(icon, label, val, sub){ return '<div class="sp-card"><div class="sp-cl">' + icon + ' ' + e(label) + '</div><div class="sp-cv">' + val + '</div><div class="sp-cs">' + sub + '</div></div>'; }
  function rankCard(icon, label, rk, none){
    if (!rk) return card(icon, label, '—', e(none));
    return card(icon, label, '<b>' + rk.rank + '</b><span class="sp-of">/' + rk.of + '</span>', e(rk.name || '') + ' · theo doanh thu');
  }
  function initials(s){ s = String(s || '?').trim(); var p = s.split(/\s+/); return e((p.length > 1 ? p[0].charAt(0) + p[p.length - 1].charAt(0) : s.slice(0, 2)).toUpperCase()); }
  function render(){
    var body = document.getElementById('sp-body'); if (!body) return;
    var d = S.data, h = '';
    if (canPick()){
      var pl = pickList();
      h += '<div class="sp-row"><label class="sp-lb" for="sp-pick">Nhân viên</label><select id="sp-pick" class="sp-in">' +
        pl.map(function(o){ return '<option value="' + e(o.u) + '"' + (o.u === S.username ? ' selected' : '') + '>' + e(o.l) + '</option>'; }).join('') + '</select></div>';
    }
    if (S.loading && !d){ body.innerHTML = h + '<div class="sp-load"><i class="sp-spin"></i><span>Đang tải hồ sơ…</span></div>'; return; }
    if (S.err && !d){ body.innerHTML = h + '<div class="sp-err">' + e(S.err) + '</div>'; return; }
    if (!d){ body.innerHTML = h; return; }
    var top = h; h = '';   // top = o chon nhan vien (admin/quan ly/leader); phan tiep theo = cot trai (ho so)
    var p = d.profile || {}, ed = !!d.canEdit, dis = ed ? '' : ' disabled';
    var shown = p.fullName || d.accountName || d.username;
    h += '<div class="sp-info"><div class="sp-av">' + initials(shown) + '</div><div class="sp-who"><div class="sp-nm">' + e(shown) + '</div>' +
      '<div class="sp-ac">Tài khoản: <b>' + e(d.username) + '</b> · ' + e(typeof _roleLabel === 'function' ? _roleLabel(d.role) : d.role) + (d.team ? ' · ' + e(d.team) : '') + '</div></div></div>';
    h += '<div class="sp-form">' +
      '<label class="sp-lb" for="sp-fullName">Họ tên</label><input id="sp-fullName" class="sp-in" maxlength="80" autocomplete="name" value="' + e(p.fullName) + '"' + dis + '>' +
      '<label class="sp-lb" for="sp-phone">Số điện thoại</label><input id="sp-phone" class="sp-in" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="' + e(p.phone) + '"' + dis + '>' +
      '<label class="sp-lb" for="sp-email">Email</label><input id="sp-email" class="sp-in" type="email" maxlength="120" autocomplete="email" value="' + e(p.email) + '"' + dis + '>' +
      '<label class="sp-lb" for="sp-facebook">Link Facebook</label>';
    if (ed) h += '<input id="sp-facebook" class="sp-in" type="url" maxlength="300" placeholder="https://facebook.com/ten-ban" value="' + e(p.facebook) + '">';
    else h += '<div class="sp-ro">' + (/^https:\/\//i.test(p.facebook || '') ? '<a href="' + e(p.facebook) + '" target="_blank" rel="noopener noreferrer">' + e(p.facebook) + '</a>' : (p.facebook ? e(p.facebook) : '<span class="sp-mu">Chưa cập nhật</span>')) + '</div>';
    h += '</div>';
    h += namesHtml(d, p);
    if (ed) h += '<div class="sp-act"><button type="button" class="btn" id="sp-save">💾 Lưu hồ sơ</button><span class="sp-mu" id="sp-upd">' + (p.updatedAt ? 'Cập nhật lần cuối: ' + e(new Date(p.updatedAt).toLocaleString('vi-VN')) : 'Chưa có hồ sơ — hãy điền và bấm Lưu') + '</span></div>';
    else h += '<div class="sp-act"><span class="sp-mu">' + (p.updatedAt ? 'Cập nhật lần cuối: ' + e(new Date(p.updatedAt).toLocaleString('vi-VN')) : 'Nhân viên chưa cập nhật hồ sơ') + '</span></div>';
    // ── Kết quả làm việc ── (cot phai tren man rong)
    var left = h; h = '';
    h += '<div class="sp-sec"><div class="sp-st">📊 Kết quả làm việc</div><div class="sp-rg">' +
      ((typeof _quickRangeSelectHtml === 'function') ? _quickRangeSelectHtml(S.quick, 'void 0').replace('<select ', '<select id="sp-quick" ').replace(/onchange="[^"]*"/, '') : '') +
      (S.quick === 'custom' ? '<input type="date" id="sp-from" class="sp-in sp-dt" value="' + e(S.from) + '"><input type="date" id="sp-to" class="sp-in sp-dt" value="' + e(S.to) + '">' : '<span class="sp-mu">' + e(S.from) + ' → ' + e(S.to) + '</span>') + '</div>';
    var o = S.ov;
    if (S.loading && !o) h += '<div class="sp-load"><i class="sp-spin"></i><span>Đang tính số liệu…</span></div>';
    else if (!o) {
      if (S.ovErr) h += '<div class="sp-err">' + e(S.ovErr) + '</div>';
      else h += '<div class="sp-mu sp-wn">Số liệu chỉ được tính khi bạn bấm nút bên dưới (để trang đỡ lag).</div>';
      h += '<div class="sp-act"><button type="button" class="btn" id="sp-load-ov">' + (S.ovErr ? '🔄 Thử tải lại' : '📊 Tải kết quả làm việc') + '</button></div>';
    }
    else {
      var cs = custStats(o.names && o.names.length ? o.names : d.names);
      var closeHeld = cs.held ? (o.totalOrders || 0) / cs.held * 100 : null;
      h += '<div class="sp-grid">' +
        card('🧾', 'Tổng số đơn', fmt(o.totalOrders || 0), 'trong kỳ') +
        card('💰', 'Tổng doanh thu', money(o.revenue), 'theo báo cáo doanh số') +
        card('🤝', 'Hoa hồng', money(o.commission), 'theo cấu hình hoa hồng') +
        card('🎁', 'Thưởng', money(o.bonus), 'theo chương trình thưởng') +
        card('👥', 'Khách đang giữ', fmt(cs.held), cs.total ? 'trong danh sách KH đã tải' : 'chưa tải danh sách KH') +
        card('💬', 'Đã kết bạn Zalo', fmt(cs.friends), cs.held ? pct(cs.friends / cs.held * 100) + ' khách đang giữ' : 'chưa có khách') +
        card('🎯', 'Tỷ lệ chốt (Pancake)', pct(o.closeRatePancake), o.pancakeConversations ? fmt(o.creatorOrders || 0) + ' đơn do sale tạo trên Base ÷ ' + fmt(o.pancakeConversations) + ' tương tác Pancake' : 'chưa có dữ liệu Pancake') +
        card('🌅', 'Chốt trong ngày (khách mới)', pct(o.closeRateNewDay), o.interactionsNew ? fmt(o.ordersNewCustomer || 0) + ' đơn ÷ ' + fmt(o.interactionsNew) + ' tương tác khách mới' : 'chưa có dữ liệu khách mới') +
        card('🔁', 'Chốt đơn hôm trước (khách cũ)', pct(o.closeRateOldCustomer), o.interactionsOld ? fmt(o.ordersOldCustomer || 0) + ' đơn ÷ ' + fmt(o.interactionsOld) + ' tương tác khách cũ' : 'chưa có dữ liệu khách cũ') +
        card('📈', 'Chốt / khách đang giữ', pct(closeHeld), cs.held ? fmt(o.totalOrders || 0) + ' đơn ÷ ' + fmt(cs.held) + ' khách' : 'chưa có khách đang giữ') +
        card('📞', 'Kết nối điện thoại', pct(o.phoneConnectRate), o.pancakeConversations ? fmt(o.phoneCollected || 0) + ' SĐT ÷ ' + fmt(o.pancakeConversations) + ' hội thoại' : 'chưa có dữ liệu Pancake') +
        rankCard('🏆', 'Xếp hạng team', o.rankTeam, 'chưa thuộc team nào') +
        rankCard('🏅', 'Xếp hạng phòng KD', o.rankDept, 'chưa thuộc phòng nào') + '</div>';
      h += '<div class="sp-mu sp-wn">Chốt trong ngày / khách cũ tính theo số đơn Pancake ghi nhận cho khách mới / khách cũ của từng nhân viên (tag L5, L5.1, L5.2, L9… chỉ thống kê theo Page nên chưa tách được theo người).</div>';
      if (o.warnings && o.warnings.length) h += '<div class="sp-mu sp-wn">⚠ ' + o.warnings.map(e).join(' · ') + '</div>';
    }
    h += '</div>';
    body.innerHTML = top + '<div class="sp-layout"><div class="sp-colL">' + left + '</div><div class="sp-colR">' + h + '</div></div>';
    refreshAllChips();
  }
  // Đổi nhân viên / khoảng ngày: bỏ kết quả cũ (huỷ yêu cầu đang chạy) và chờ người dùng bấm "Tải kết quả làm việc".
  function resetOverview(){ S.seq++; S.loading = false; S.ov = null; S.ovErr = ''; }
  function loadOverview(){
    if (!S.username || !S.from || !S.to || S.from > S.to) return;
    var seq = ++S.seq; S.loading = true; S.ov = null; S.ovErr = ''; render();
    getJson({ action:'staffOverview', username:S.username, from:S.from, to:S.to }).then(function(r){
      if (seq !== S.seq) return;
      S.loading = false;
      if (r && r.ok) S.ov = r; else S.ovErr = (r && r.error) || 'Không tính được số liệu.';
      render();
    });
  }
  function load(username){
    S.username = username || myUser(); S.data = null; S.ov = null; S.err = ''; S.ovErr = ''; S.loading = true; S.opts = null; S.optsLoading = false;
    var r = rangeOf(S.quick); if (S.quick !== 'custom'){ S.from = r.from; S.to = r.to; }
    var seq = ++S.seq; render();
    getJson({ action:'profileGet', username:S.username }).then(function(p){
      if (seq !== S.seq) return;
      if (!p || !p.ok){ S.loading = false; S.err = (p && p.error) || 'Không tải được hồ sơ.'; render(); return; }
      S.data = p; S.loading = false; render();   // KHÔNG tự tải kết quả làm việc — chờ bấm nút
      if (p.canEditNames) loadOptions(S.username, seq);   // gợi ý tên (nhẹ, chỉ khi được sửa tên)
    });
  }
  function save(){
    var g = function(id){ var el = document.getElementById(id); return el ? el.value : ''; };
    var btn = document.getElementById('sp-save'); if (btn) btn.disabled = true;
    var payload = { action:'profileSave', username:S.username, profile:{ fullName:g('sp-fullName'), phone:g('sp-phone'), email:g('sp-email'), facebook:g('sp-facebook') } };
    if (S.data && S.data.canEditNames) payload.names = namesFromForm();   // chi admin; nguoi khac khong gui -> server giu nguyen ten cu
    var body = JSON.stringify(payload);
    fetch(gsUrl, { method:'POST', redirect:'follow', body:body }).then(function(r){ return r.json(); }).catch(function(){ return { ok:false, error:'Không kết nối được máy chủ.' }; }).then(function(r){
      if (btn) btn.disabled = false;
      if (r && r.ok){ if (S.data) S.data.profile = r.profile; toastS('✓ Đã lưu hồ sơ'); render(); if (typeof window._staffNamesReload === 'function') window._staffNamesReload(); }
      else toastS('⚠ ' + ((r && r.error) || 'Lưu không thành công'));
    });
  }
  window.openProfileModal = function(username){
    if (typeof gsUrl === 'undefined' || !gsUrl){ toastS('Chưa kết nối Google Sheets.'); return; }
    if (!myUser()){ toastS('Hãy đăng nhập bằng tài khoản của bạn để dùng hồ sơ.'); return; }
    var ov = ensure(); ov.classList.add('open'); document.documentElement.classList.add('sp-lock');
    load(typeof username === 'string' && username ? username : (S.username || myUser()));
  };
  window._spCustStats = custStats;   // dùng cho test
  window._spSplitNames = splitNames;  // dùng cho test
})();

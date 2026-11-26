// ═══════════════════════════════════════════════════════════════════════════════════════
//  THƯ MỤC HỒ SƠ CHUẨN → CÀI ĐẶT TEAM (yêu cầu Duyên 26/11/2026, bước 3/5)
//  Mỗi nhân viên có hồ sơ chuẩn (họ tên + tên Pancake/CRM/Base/POS, nhập ở Hồ sơ nhân viên js/47). Cài đặt Team chỉ ĐỔI CÁCH HIỂN THỊ
//  + TÌM KIẾM theo hồ sơ: chip hiện họ tên chuẩn (rê chuột thấy tên từng hệ thống), ô chọn nhân viên tìm được theo họ tên / mọi tên hệ thống.
//  KHÔNG đổi cách lưu: t.members vẫn là danh sách TÊN như cũ; thêm 1 người thì addTeamMember thêm mọi tên cùng người nhờ _personAliases
//  (đã gồm 'salePersonTags' mà server gộp từ hồ sơ). Dữ liệu Team cũ chạy nguyên.
//  Dữ liệu: GAS action staffNamesList (admin/quản lý/leader; người khác bị từ chối → thư mục rỗng, Team hiện như cũ).
// ═══════════════════════════════════════════════════════════════════════════════════════
(function(){
  var S = { list: [], idx: {}, loaded: false, loading: false, failAt: 0 };
  var SYS = [ ['pancake', '🥞 Pancake'], ['crm', '🏷️ CRM'], ['base', '📦 Base'], ['pos', '🧾 POS'] ];
  function fold(x){ return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }   // cùng cách chuẩn hoá với _normTxt_ ở GAS
  function build(list){
    S.list = Array.isArray(list) ? list : []; S.idx = {};
    S.list.forEach(function(e){
      [e.username, e.accountName, e.fullName].concat(e.all || []).forEach(function(k){ k = fold(k); if (k && !S.idx[k]) S.idx[k] = e; });
    });
  }
  function load(force){
    if (S.loading) return; if (S.loaded && !force) return;
    if (!force && S.failAt && Date.now() - S.failAt < 60000) return;
    if (typeof gsUrl === 'undefined' || !gsUrl || typeof _authAccount === 'undefined' || !_authAccount) return;
    S.loading = true;
    fetch(gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=staffNamesList', { redirect: 'follow' })
      .then(function(r){ return r.json(); }).catch(function(){ return null; })
      .then(function(r){
        S.loading = false;
        if (r && r.ok){ build(r.list); S.loaded = true; S.failAt = 0; rerender(); }
        else S.failAt = Date.now();   // chưa đủ quyền / lỗi mạng: thử lại sau 1 phút, Team vẫn hiện như cũ
      });
  }
  function rerender(){
    try { if (document.getElementById('team-wrap') && typeof renderTeamTab === 'function') renderTeamTab(); } catch (e) {}
    try { var dp = document.getElementById('dp-page'); if (dp && dp.classList.contains('open') && typeof _dpRender === 'function') _dpRender(); } catch (e) {}   // trang Phòng ban đang mở: vẽ lại để hiện tên Pancake gốc
  }
  // Hồ sơ khớp với 1 nhóm tên (mảng tên của cùng 1 người) — chỉ trả khi hồ sơ có họ tên chuẩn (nếu không thì giữ cách hiện cũ).
  function entryOf(names){
    for (var i = 0; i < (names || []).length; i++){ var e = S.idx[fold(names[i])]; if (e && e.fullName) return e; }
    return null;
  }
  // { display, title } cho chip; null nếu không có hồ sơ chuẩn.
  window._staffChipInfo = function(names){
    load();
    var e = entryOf(names); if (!e) return null;
    var t = ['Hồ sơ: ' + e.fullName + ' (tài khoản ' + e.username + ')'];
    SYS.forEach(function(s){ var a = (e.names && e.names[s[0]]) || []; if (a.length) t.push(s[1] + ': ' + a.join(', ')); });
    var inTeam = (names || []).filter(function(n){ return fold(n) !== fold(e.fullName); });
    if (inTeam.length) t.push('Tên đang tính cho team: ' + inTeam.join(', '));
    return { display: e.fullName, title: t.join('\n') };
  };
  // Chuỗi phụ để ô tìm khớp theo họ tên + mọi tên hệ thống của người có tên này (không dấu/hoa thường do nơi gọi chuẩn hoá).
  window._staffSearchText = function(name){
    load();
    var e = S.idx[fold(name)]; if (!e) return '';
    return [e.fullName].concat(e.all || []).join(' ');
  };
  // Họ tên chuẩn của 1 tên (để ghi cạnh tên trong danh sách chọn); '' nếu chưa có hồ sơ.
  window._staffDisplayOf = function(name){ var e = S.idx[fold(name)]; return (e && e.fullName) || ''; };
  // Tên tài khoản CS chưa từng xuất hiện trong dữ liệu vẫn chọn được vào Team (vd bạn mới chưa có đơn/khách).
  window._staffExtraNames = function(){
    load();
    return S.list.filter(function(e){ return e.role === 'cs' && e.username; }).map(function(e){ return e.username; });
  };
  // Gộp theo NGƯỜI ngay khi có hồ sơ (không chờ Settings 'salePersonTags' đồng bộ về máy): cùng dữ liệu server đã gộp khi lưu hồ sơ, chỉ khác là áp dụng tức thì.
  // Cùng kiểu với js/50 (bọc _personAliases) nên mọi nơi dùng _groupNamesByPerson / addTeamMember / removeTeamMember tự khớp.
  (function(){
    var base = (typeof _personAliases === 'function') ? _personAliases : function(n){ return [n]; };
    _personAliases = function(name){
      var b = base(name) || [name], e = S.idx[fold(name)];
      if (!e || !(e.all && e.all.length)) return b;
      var seen = {}, out = [];
      b.concat([e.username], e.all).forEach(function(n){ var k = fold(n); if (n && !seen[k]){ seen[k] = 1; out.push(n); } });
      return out;
    };
  })();
  // TÊN PANCAKE (tên gốc theo Duyên 26/11) của người có 1 trong các tên này, theo HỒ SƠ CHUẨN; '' nếu hồ sơ chưa nhập tên Pancake.
  window._staffPancakeOf = function(names){
    load();
    for (var i = 0; i < (names || []).length; i++){ var e = S.idx[fold(names[i])]; if (e && e.names && e.names.pancake && e.names.pancake.length) return e.names.pancake[0]; }
    return '';
  };
  window._staffNamesReload = function(){ S.loaded = false; S.failAt = 0; load(true); };
  window._staffDirState = function(){ return { n: S.list.length, loaded: S.loaded }; };   // dùng cho test
  window._staffDirBuild = build;                                                              // dùng cho test
})();

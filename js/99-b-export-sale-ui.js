// ═══════════════════════════════════════════════════════════════════════════════════════
//  XUẤT DOANH THU BÁO CÁO B — CẢ TEAM / TỪNG SALE (yêu cầu Duyên 26/11/2026, bước 2/2: hộp thoại + nút)
//  Nút nằm ở menu Tác vụ của Báo cáo B (js/13 `_srbSubCfg_`), CHỈ admin + trưởng nhóm. Dữ liệu lấy từ `_srState.dataB` (đã bấm "Lọc"),
//  dựng file bằng `_srBxPlan_` (js/98) nên số luôn khớp màn hình. Gỡ = xoá dòng menu trong js/13 + 2 thẻ script (js/98, js/99).
// ═══════════════════════════════════════════════════════════════════════════════════════
var _srBx = { names: [], q: '', mode: 'team', label: '', list: [], busy: false };
function _srBxAllowed_(){
  try {
    if (typeof _srIsAdmin === 'function' && _srIsAdmin()) return true;
    return typeof currentUser !== 'undefined' && !!currentUser && currentUser.role === 'leader';
  } catch (e){ return false; }
}
// Chọn các sale trong dữ liệu B thuộc 1 team: trùng tên (không phân biệt hoa/thường/dấu) hoặc cùng người theo `aliasFn` (_personAliases). THUẦN → test được.
function _srBxTeamPick_(saleNames, members, aliasFn){
  var want = {};
  (members || []).forEach(function(m){
    want[_srBxFold_(m)] = 1;
    try { (aliasFn ? (aliasFn(m) || []) : []).forEach(function(a){ want[_srBxFold_(a)] = 1; }); } catch (e){}
  });
  return (saleNames || []).filter(function(n){ return want[_srBxFold_(n)] === 1; });
}
function _srBxFmt_(n){ return (typeof fmt === 'function') ? fmt(Math.round(Number(n) || 0)) : String(Math.round(Number(n) || 0)); }
function _srBxInfo_(){
  return { dateFrom: _srState.dateFrom, dateTo: _srState.dateTo, filters: (typeof _srBFilterDesc_ === 'function') ? _srBFilterDesc_() : [], at: new Date().toLocaleString('vi-VN') };
}
function openBExportSale_(){
  if (!_srBxAllowed_()){ alert('Chỉ admin hoặc trưởng nhóm được xuất doanh thu theo sale.'); return; }
  var dB = _srState && _srState.dataB;
  if (!dB || !dB.orders){ alert('Chưa có dữ liệu Báo cáo B — bấm "Lọc" trước rồi xuất lại.'); return; }
  if (typeof XLSX === 'undefined'){ alert('Thư viện xuất Excel chưa tải xong — thử lại sau vài giây.'); return; }
  var xb = _srBuildExportB_(dB, { allocSheet: 'Chia theo Sale' });
  _srBx.list = _srBxSaleList_(dB, xb); _srBx.names = []; _srBx.q = ''; _srBx.mode = 'team'; _srBx.label = ''; _srBx.busy = false;
  var ov = document.getElementById('srbx-modal');
  if (!ov){ ov = document.createElement('div'); ov.id = 'srbx-modal'; ov.className = 'modal-overlay'; ov.style.cssText = 'align-items:flex-start;justify-content:center;padding-top:40px;z-index:800';
    ov.onclick = function(e){ if (e.target === ov) closeBExportSale_(); }; document.body.appendChild(ov); }
  ov.style.display = 'flex'; ov.classList.add('open');
  _srBxRender_();
}
function closeBExportSale_(){ var ov = document.getElementById('srbx-modal'); if (ov){ ov.style.display = 'none'; ov.classList.remove('open'); } }
function _srBxVisible_(){ var q = _srBxFold_(_srBx.q); return _srBx.list.filter(function(x){ return !q || _srBxFold_(x.name).indexOf(q) !== -1; }); }
function _srBxRender_(){
  var ov = document.getElementById('srbx-modal'); if (!ov) return;
  var info = _srBxInfo_(), esc_ = (typeof esc === 'function') ? esc : function(s){ return String(s); };
  var tm = (typeof teams !== 'undefined' && teams && teams.length) ? teams : [];
  var teamBtns = tm.map(function(t){ return '<button class="btn btn-sm" style="margin:0 4px 4px 0" onclick="_srBxPickTeam_(\'' + esc_(String(t.id)).replace(/'/g, '') + '\')">👥 ' + esc_(t.name) + '</button>'; }).join('');
  var vis = _srBxVisible_(), sel = {}; _srBx.names.forEach(function(n){ sel[n] = 1; });
  var rows = vis.map(function(x, i){
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--border);cursor:pointer">' +
      '<input type="checkbox" data-i="' + i + '"' + (sel[x.name] ? ' checked' : '') + ' onchange="_srBxToggle_(this)">' +
      '<span style="flex:1">' + esc_(x.name) + (x.inWeb ? '' : ' <i style="color:var(--muted)">(không hiện ở bảng web)</i>') + '</span>' +
      '<span style="color:var(--muted);font-size:12px">' + (Number(x.orders) || 0) + ' đơn</span>' +
      '<b style="min-width:96px;text-align:right">' + _srBxFmt_(x.giaTri) + '</b></label>';
  }).join('') || '<div style="padding:14px;color:var(--muted);text-align:center">Không có sale nào.</div>';
  var modes = [['team', '1 file chung cả team', 'Sheet "Tổng hợp" + 1 sheet chi tiết của các sale đã chọn'], ['sheets', '1 file, mỗi sale 1 sheet', 'Tổng hợp + mỗi sale 1 sheet chi tiết'], ['files', 'Mỗi sale 1 file riêng', 'Để gửi từng bạn — file của ai chỉ có dữ liệu của người đó']];
  var modeHtml = modes.map(function(m){ return '<label style="display:flex;gap:8px;align-items:flex-start;margin:4px 0;cursor:pointer"><input type="radio" name="srbx-mode" value="' + m[0] + '"' + (_srBx.mode === m[0] ? ' checked' : '') + ' onchange="_srBx.mode=this.value;_srBxRefreshCount_()"><span><b>' + m[1] + '</b><br><span style="color:var(--muted);font-size:12px">' + m[2] + '</span></span></label>'; }).join('');
  ov.innerHTML = '<div class="modal" style="width:560px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column">' +
    '<div class="modal-hdr"><div class="modal-title">📤 Xuất doanh thu Báo cáo B — cả team / từng sale</div>' +
    '<div class="modal-sub">Khoảng ngày: <b>' + esc_((info.dateFrom || '...') + ' → ' + (info.dateTo || '...')) + '</b>' + (info.filters.length ? ' · ' + esc_(info.filters.join(' | ')) : '') + '. Số liệu lấy đúng bảng "Theo Sale" đang xem (tiền chia đều theo số sale trên đơn).</div></div>' +
    '<div class="modal-body" style="padding:12px 18px;overflow:auto">' +
    (teamBtns ? '<div style="margin-bottom:6px;font-size:12px;color:var(--muted)">Chọn nhanh theo team:</div><div>' + teamBtns + '</div>' : '') +
    '<div style="display:flex;gap:6px;margin:6px 0"><input class="form-input" id="srbx-q" placeholder="Tìm sale..." value="' + esc_(_srBx.q) + '" oninput="_srBx.q=this.value;_srBxRenderList_()" style="flex:1">' +
    '<button class="btn btn-sm" onclick="_srBxAll_(true)">Chọn hết</button><button class="btn btn-sm" onclick="_srBxAll_(false)">Bỏ chọn</button></div>' +
    '<div id="srbx-list" style="border:1px solid var(--border);border-radius:8px;max-height:260px;overflow:auto">' + rows + '</div>' +
    '<div style="margin-top:12px">' + modeHtml + '</div></div>' +
    '<div class="modal-footer" style="padding:10px 18px;display:flex;gap:8px;align-items:center;justify-content:flex-end">' +
    '<span id="srbx-count" style="flex:1;color:var(--muted);font-size:12px"></span>' +
    '<button class="btn" onclick="closeBExportSale_()">Đóng</button><button class="btn btn-primary" id="srbx-go" onclick="_srBxRun_()">⬇ Xuất Excel</button></div></div>';
  _srBxRefreshCount_();
}
function _srBxRenderList_(){   // vẽ lại riêng danh sách (giữ con trỏ ô tìm)
  var el = document.getElementById('srbx-list'); if (!el) return;
  var q = document.getElementById('srbx-q'), pos = q ? q.selectionStart : 0; _srBxRender_();
  var q2 = document.getElementById('srbx-q'); if (q2){ q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e){} }
}
function _srBxToggle_(cb){
  var x = _srBxVisible_()[Number(cb.getAttribute('data-i'))]; if (!x) return;
  var i = _srBx.names.indexOf(x.name); if (cb.checked && i === -1) _srBx.names.push(x.name); else if (!cb.checked && i !== -1) _srBx.names.splice(i, 1);
  _srBx.label = ''; _srBxRefreshCount_();
}
function _srBxAll_(on){ if (on) _srBxVisible_().forEach(function(x){ if (_srBx.names.indexOf(x.name) === -1) _srBx.names.push(x.name); }); else _srBx.names = []; _srBx.label = ''; _srBxRender_(); }
function _srBxPickTeam_(id){
  var t = (teams || []).filter(function(x){ return String(x.id) === String(id); })[0]; if (!t) return;
  var members = (typeof _teamMembersList === 'function') ? _teamMembersList(t) : [t.leader].concat(t.members || []).filter(Boolean);
  var pick = _srBxTeamPick_(_srBx.list.map(function(x){ return x.name; }), members, (typeof _personAliases === 'function') ? _personAliases : null);
  _srBx.names = pick; _srBx.label = t.name; _srBx.q = ''; _srBxRender_();
  if (!pick.length) toast('Team "' + t.name + '" không có sale nào trong dữ liệu đang xem.');
}
function _srBxRefreshCount_(){
  var el = document.getElementById('srbx-count'); if (!el) return;
  var n = _srBx.names.length, total = _srBx.list.length;
  el.textContent = (n ? 'Đã chọn ' + n + ' sale' : 'Chưa chọn → xuất TẤT CẢ ' + total + ' sale') + (_srBx.mode === 'files' ? ' · ra ' + (n || total) + ' file' : ' · ra 1 file');
}
function _srBxRun_(){
  if (_srBx.busy) return;
  var dB = _srState.dataB; if (!dB || !dB.orders){ alert('Chưa có dữ liệu Báo cáo B — bấm "Lọc" trước.'); return; }
  var plan = _srBxPlan_(dB, { mode: _srBx.mode, names: _srBx.names.slice(), label: _srBx.label, info: _srBxInfo_() });
  if (!plan.files.length){ alert('Không có sale nào để xuất.'); return; }
  _srBx.busy = true; var go = document.getElementById('srbx-go'); if (go){ go.disabled = true; go.textContent = '⏳ Đang xuất...'; }
  plan.files.forEach(function(f, i){
    setTimeout(function(){
      try {
        var wb = XLSX.utils.book_new();
        f.sheets.forEach(function(s){ var ws = XLSX.utils.aoa_to_sheet(s.rows); if (s.widths) ws['!cols'] = s.widths.map(function(w){ return { wch: w }; }); XLSX.utils.book_append_sheet(wb, ws, s.name); });
        XLSX.writeFile(wb, f.file);
      } catch (e){ toast('Lỗi xuất file ' + f.file + ': ' + e.message); }
      if (i === plan.files.length - 1){
        _srBx.busy = false; if (go){ go.disabled = false; go.textContent = '⬇ Xuất Excel'; }
        toast('✅ Đã xuất ' + plan.files.length + ' file' + (plan.files.length > 1 ? ' (nếu trình duyệt hỏi "tải nhiều file" hãy bấm Cho phép)' : '') + '.');
        if (plan.missing) toast('⚠ Máy chủ chưa trả phần chia chính xác theo sale — bấm "Lọc" lại rồi xuất lại.');
      }
    }, i * 700);
  });
}

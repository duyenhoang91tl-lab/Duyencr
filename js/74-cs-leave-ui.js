// ════════════════════════════════════════════════════════════════════
//  R6c-2 (BƯỚC 2/4: GIAO DIỆN) — nút "🏖 Nghỉ phép" trên màn Quá hạn + form đặt kỳ nghỉ + XEM TRƯỚC việc giao. Nạp SAU js/73, 72.
//  NGUYÊN NHÂN GỐC: có logic giao lại (js/73) nhưng chưa có chỗ để admin/nhân viên đặt kỳ nghỉ và xem ai nhận bao nhiêu khách.
//  Bước 2 = form + xem trước; bước 3 (js/75) nối nút "Lưu & giao" (clSave_) → lưu + giao thật. Bọc renderOverdueTab, không sửa js/02/72.
//  Ai chọn được nhân viên nào: admin = mọi CS (từ team + tài khoản); leader/manager = CS trong team của mình + chính mình; CS = chỉ chính mình.
//  Hàm thuần: clAllowedNames_ (test: node tools/test-cs-leave-ui.js)
// ════════════════════════════════════════════════════════════════════
var _clUi = { draft: null };
function clAllowedNames_(user, teams, accounts){
  var seen = {}, out = [];
  function add(n){ n = String(n || '').trim(); var k = n.toLowerCase(); if (!k || seen[k]) return; seen[k] = 1; out.push(n); }
  var mine = (user && user.names && user.names.length) ? user.names : (user && user.name ? [user.name] : []);
  var role = user && user.role;
  if (!role || role === 'admin'){
    (teams || []).forEach(function(t){ add(t.leader); (t.members || []).forEach(add); });
    (accounts || []).forEach(function(a){ if (a.role === 'admin') return; ((a.names && a.names.length) ? a.names : [a.name]).forEach(add); });
  } else if (role === 'leader' || role === 'manager'){
    (teams || []).forEach(function(t){
      var all = [t.leader].concat(t.members || []);
      if (all.some(function(n){ return mine.some(function(m){ return String(m).trim().toLowerCase() === String(n || '').trim().toLowerCase(); }); }) || t.name === user.team) all.forEach(add);
    });
    mine.forEach(add);
  } else mine.forEach(add);
  return out.sort(function(a, b){ return a.localeCompare(b, 'vi'); });
}
function clEsc_(s){ return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clLoad_(){   // số khách đang giữ của từng CS (để chia đều nghiêng về người ít khách)
  var m = {}; try { Object.keys(careData || {}).forEach(function(p){ clSplit_((careData[p] || {}).cs).forEach(function(n){ m[n] = (m[n] || 0) + 1; }); }); } catch (e) {}
  return m;
}
function clReadForm_(){
  var g = function(id){ var el = document.getElementById(id); return el ? el.value : ''; };
  var mode = (document.querySelector('input[name="cl-mode"]:checked') || {}).value || 'even';
  return { id: 'draft', name: g('cl-name'), from: g('cl-from'), to: g('cl-to'), mode: mode, target: g('cl-target') };
}
function clPreview_(){
  var box = document.getElementById('cl-preview'); if (!box) return;
  var l = clReadForm_(), today = scYmd_(new Date()), msg = '';
  if (!l.name) msg = 'Chọn nhân viên nghỉ.';
  else if (!l.from) msg = 'Chọn "Từ ngày".';
  else if (l.to && l.to < l.from) msg = '"Đến ngày" phải sau hoặc bằng "Từ ngày".';
  document.getElementById('cl-target-wrap').style.display = l.mode === 'to' ? '' : 'none';
  if (msg){ box.innerHTML = '<span class="cl-warn">' + clEsc_(msg) + '</span>'; return; }
  var leaves = (typeof _csLeaves !== 'undefined' && _csLeaves) ? _csLeaves : [];
  var day = l.from > today ? l.from : today;   // người nhận phải đi làm vào ngày bắt đầu nghỉ (hoặc hôm nay nếu đã bắt đầu)
  var p = clPlan_(l, schedules, careData, typeof _schedResponsibleCS === 'function' ? _schedResponsibleCS : function(){ return ''; }, teams, leaves.concat([l]), day, clLoad_());
  var skipped = Object.keys(p.skipped).map(function(k){ return p.skipped[k] + ' lịch ' + k; }).join(', ');
  if (p.noTarget){ box.innerHTML = '<span class="cl-warn">' + (l.mode === 'to' ? 'Chọn người nhận (không trùng người nghỉ, không phải người đang nghỉ).' : 'Không có CS cùng team đang đi làm để chia đều — chọn "Chuyển cho người khác".') + '</span>'; return; }
  if (!p.rows.length){ box.innerHTML = 'Không có khách nào cần giao (' + clEsc_(l.name) + ' không còn lịch chưa xong).' + (skipped ? '<div class="cl-sub">Bỏ qua: ' + clEsc_(skipped) + '</div>' : ''); return; }
  var by = {}; p.rows.forEach(function(r){ by[r.to] = (by[r.to] || 0) + 1; });
  box.innerHTML = '<b>' + p.rows.length + '</b> khách của <b>' + clEsc_(l.name) + '</b> sẽ giao: ' + Object.keys(by).map(function(n){ return clEsc_(n) + ' <b>' + by[n] + '</b>'; }).join(' · ') +
    (skipped ? '<div class="cl-sub">Bỏ qua: ' + clEsc_(skipped) + '</div>' : '') + '<div class="cl-sub">' + (l.to ? 'Nghỉ ' + clEsc_(l.from) + ' → ' + clEsc_(l.to) : 'Tạm nghỉ từ ' + clEsc_(l.from) + ', chưa biết ngày về (trả lại khi đi làm).') + '</div>';
}
function clOpen(){
  var names = clAllowedNames_(currentUser, teams, accounts);
  if (!names.length){ scToast_('Chưa có nhân viên nào để đặt nghỉ (chưa có team/tài khoản).'); return; }
  var old = document.getElementById('cl-modal'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'cl-modal'; ov.className = 'modal-overlay open';
  var all = clAllowedNames_({ role: 'admin' }, teams, accounts), today = scYmd_(new Date());
  ov.innerHTML = '<div class="modal cl-modal"><div class="cl-head">🏖 Đặt kỳ nghỉ + giao lại khách</div><div class="cl-body">' +
    '<label class="cl-f">Nhân viên nghỉ<select id="cl-name">' + (names.length > 1 ? '<option value="">— chọn —</option>' : '') + names.map(function(n){ return '<option>' + clEsc_(n) + '</option>'; }).join('') + '</select></label>' +
    '<div class="cl-2"><label class="cl-f">Từ ngày<input type="date" id="cl-from" value="' + today + '"></label><label class="cl-f">Đến ngày <i>(để trống = tạm nghỉ)</i><input type="date" id="cl-to"></label></div>' +
    '<div class="cl-f">Giao khách thế nào?<label class="cl-r"><input type="radio" name="cl-mode" value="even" checked> Chia đều cho CS cùng team</label><label class="cl-r"><input type="radio" name="cl-mode" value="to"> Chuyển cho người khác</label></div>' +
    '<label class="cl-f" id="cl-target-wrap" style="display:none">Người nhận<select id="cl-target"><option value="">— chọn —</option>' + all.map(function(n){ return '<option>' + clEsc_(n) + '</option>'; }).join('') + '</select></label>' +
    '<div id="cl-preview" class="cl-preview"></div></div>' +
    '<div class="cl-foot"><button type="button" class="btn sm" data-cl="close">Đóng</button><button type="button" class="btn sm primary" data-cl="save">Lưu & giao</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('input', clPreview_); ov.addEventListener('change', clPreview_);
  ov.addEventListener('click', function(e){
    if (e.target === ov || (e.target.closest && e.target.closest('[data-cl="close"]'))) { ov.remove(); return; }
    if (e.target.closest && e.target.closest('[data-cl="save"]')) clSave_(ov);
  });
  clPreview_();
}
function clSave_(ov){
  var l = clReadForm_(), today = scYmd_(new Date());
  if (!l.name || !l.from){ scToast_('Chọn nhân viên và "Từ ngày".'); return; }
  if (l.to && l.to < l.from){ scToast_('"Đến ngày" phải sau hoặc bằng "Từ ngày".'); return; }
  if (l.to && l.to < today){ scToast_('Kỳ nghỉ đã kết thúc trong quá khứ.'); return; }
  l.id = 'L' + Date.now(); l.by = (currentUser && currentUser.name) || ''; l.at = new Date().toISOString(); l.applied = false; l.ended = false; l.handed = [];
  if (l.mode === 'to' && !l.target){ scToast_('Chọn người nhận.'); return; }
  var day = l.from > today ? l.from : today, p = clPlanFor_(l, day);
  if (p.noTarget){ scToast_(l.mode === 'to' ? 'Người nhận không hợp lệ (trùng người nghỉ hoặc đang nghỉ).' : 'Không có CS cùng team đang đi làm để chia đều.'); return; }
  var future = l.from > today;
  if (!confirm(future ? 'Lưu kỳ nghỉ của ' + l.name + ' từ ' + l.from + '? Đến ngày đó hệ thống sẽ tự giao khách.' : 'Giao ' + p.rows.length + ' khách của ' + l.name + ' ngay bây giờ?')) return;
  _csLeaves.push(l);
  var msg = '✓ Đã lưu kỳ nghỉ';
  if (!future){ var r = clApplyLeave_(l, today); msg = '✓ Đã giao ' + r.n + ' khách của ' + l.name; }
  clSaveLeaves_();
  ov.remove();
  try { if (typeof updateSchedBadges === 'function') updateSchedBadges(); } catch (e) {}
  if (typeof renderOverdueTab === 'function') renderOverdueTab();
  if (typeof renderScheduleTab === 'function') renderScheduleTab();
  scToast_(msg + (future ? ' (tự giao khi tới ' + l.from + ')' : ''));
}
function clReturn_(id){
  var l = (_csLeaves || []).filter(function(x){ return x.id === id; })[0]; if (!l) return;
  var pending = !l.applied, p = clReturnPlan_(l, careData);
  var msg = pending ? 'Huỷ kỳ nghỉ hẹn của ' + l.name + '? (chưa giao khách nào)' : 'Trả lại ' + p.rows.length + ' khách cho ' + l.name + '?' + (p.skipped ? '\n(' + p.skipped + ' khách đã được đổi CS sau đó → giữ nguyên, không đè)' : '');
  if (!confirm(msg)) return;
  var r = clReturnLeave_(l);
  try { if (typeof updateSchedBadges === 'function') updateSchedBadges(); } catch (e) {}
  if (typeof renderOverdueTab === 'function') renderOverdueTab();
  if (typeof renderScheduleTab === 'function') renderScheduleTab();
  scToast_(pending ? '✓ Đã huỷ kỳ nghỉ hẹn' : '✓ Đã trả lại ' + r.rows.length + ' khách cho ' + l.name + (r.skipped ? ' · giữ nguyên ' + r.skipped : ''));
}
function clDecorate_(){
  var grid = document.getElementById('overdue-grid'); if (!grid) return;
  var old = document.getElementById('cl-bar'); if (old) old.remove();
  var bar = document.createElement('div'); bar.id = 'cl-bar'; bar.className = 'cl-bar';
  var today = scYmd_(new Date()), allowed = clAllowedNames_(currentUser, teams, accounts).map(function(n){ return n.toLowerCase(); }), isAdmin = !currentUser || currentUser.role === 'admin';
  var fd = function(y){ return y ? y.split('-').reverse().slice(0, 2).join('/') : ''; };
  var list = (typeof _csLeaves !== 'undefined' ? _csLeaves : []).filter(function(l){ return !l.ended && (isAdmin || allowed.indexOf(String(l.name).toLowerCase()) !== -1); }).map(function(l){
    var st = clStatus_(l, today), n = (l.handed || []).length;
    var txt = clEsc_(l.name) + ' · ' + fd(l.from) + (l.to ? '→' + fd(l.to) : ' (tạm nghỉ)') + (st === 'hen' ? ' · hẹn, chưa giao' : ' · đã giao ' + n + ' khách') + (st === 'het' ? ' · ĐÃ HẾT HẠN NGHỈ' : '');
    return '<span class="cl-chip' + (st === 'het' ? ' cl-chip-due' : '') + '">' + txt + ' <button type="button" class="cl-chip-b" data-cl="return" data-id="' + clEsc_(l.id) + '">' + (st === 'hen' ? 'Huỷ hẹn' : 'Trả lại') + '</button></span>';
  }).join('');
  bar.innerHTML = (list ? '<div class="cl-list">' + list + '</div>' : '') + '<button type="button" class="btn sm" data-cl="open">🏖 Nghỉ phép / giao lại khách</button>';
  bar.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('[data-cl]') : null; if (!t) return;
    e.stopPropagation();
    if (t.getAttribute('data-cl') === 'open'){ clOpen(); return; }
    if (t.getAttribute('data-cl') === 'return') clReturn_(t.getAttribute('data-id'));
  });
  grid.insertBefore(bar, grid.firstChild);
}
(function(){
  if (typeof window === 'undefined') return;
  var orig = window.renderOverdueTab;
  if (typeof orig !== 'function') return;
  window.renderOverdueTab = function(){ if (typeof clApplyDue_ === 'function') clApplyDue_(); orig.apply(this, arguments); clDecorate_(); };
})();
if (typeof module !== 'undefined' && module.exports){ module.exports = { clAllowedNames_: clAllowedNames_ }; }

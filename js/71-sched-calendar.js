// ════════════════════════════════════════════════════════════════════
//  R6b — LỊCH TUẦN / NGÀY cho lịch chăm sóc (tab "Lịch chăm sóc"). Nạp SAU js/02, 03, 04, 06, 32.
//  NGUYÊN NHÂN GỐC làm bước này: màn cũ chỉ là danh sách xếp theo ngày (mỗi lần xem 1 ngày, mở/đóng từng ngày), không thấy cả tuần cùng lúc,
//  không lọc theo loại (Gọi/SP/CS/Hẹn) và muốn dời lịch phải mở hồ sơ khách sửa ngày.
//  Ba kiểu xem (nút ở đầu tab, nhớ trong localStorage `sc_mode`): ☰ Danh sách (màn cũ, mặc định, KHÔNG đổi) | 🗓 Tuần (7 cột T2→CN) | 📆 Ngày.
//  Dữ liệu = biến toàn cục `schedules` (cùng nguồn, cùng bộ lọc CS `_schedCsFilter` như màn cũ). Lịch chỉ có NGÀY (không có giờ) nên
//  kiểu Ngày gom theo loại việc chứ không vẽ trục giờ.
//  Kéo thẻ sang ngày khác (hoặc nút ‹ › trên thẻ cho màn cảm ứng) = DỜI LỊCH: ghi lại `schedules`, và nếu là lịch nhanh Gọi/SP/CS/Hẹn thì
//  ghi cả ô ngày tương ứng trong `careData` (schedGoi/schedSP/schedCS/schedHen) để extension + hồ sơ khách không còn hiện ngày cũ rồi tạo lại lịch.
//  KHÔNG dời: lịch tự động theo mốc đơn (autoDao — hệ thống tính lại sẽ ghi đè), sinh nhật (lặp hằng năm), ngày đã qua.
//  Hàm thuần (scWeekStart_, scGroup_, scMoveCheck_, scApplyMove_) không đụng DOM → test: node tools/test-sched-calendar.js
// ════════════════════════════════════════════════════════════════════
var _SC_GROUPS = [
  { key: 'goi', label: '📞 Gọi' }, { key: 'sp', label: '🧴 Nhắc SP' }, { key: 'cs', label: '💬 Chăm sóc' },
  { key: 'hen', label: '🔁 Hẹn mua lại' }, { key: 'other', label: '… Khác' }
];
var _SC_FIELD = { goi: 'schedGoi', sp: 'schedSP', cs: 'schedCS', hen: 'schedHen' };
var _sc = { mode: 'list', day: '', types: [], busy: false };
try { var _scm = localStorage.getItem('sc_mode'); _sc.mode = (_scm === 'week' || _scm === 'day') ? _scm : 'list'; } catch (e) {}

function scYmd_(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function scParse_(s){ var p = String(s || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
function scAddDays_(ymd, n){ var d = scParse_(ymd); if (!d) return ''; d.setDate(d.getDate() + n); return scYmd_(d); }
// Thứ Hai của tuần chứa (hôm nay + offset tuần). todayYmd dạng YYYY-MM-DD
function scWeekStart_(todayYmd, offset){
  var d = scParse_(todayYmd); if (!d) return '';
  var dow = (d.getDay() + 6) % 7;                 // T2=0 … CN=6
  d.setDate(d.getDate() - dow + (offset || 0) * 7);
  return scYmd_(d);
}
function scGroupOf_(it){ return _SC_FIELD[it && it.type] ? it.type : 'other'; }
// Gom lịch chưa xong theo ngày (chỉ các ngày trong `days`), lọc theo nhóm loại (types rỗng = tất cả)
function scGroup_(items, days, types){
  var by = {}; days.forEach(function(d){ by[d] = []; });
  (items || []).forEach(function(it){
    if (it.done || !by[it.date]) return;
    if (types && types.length && types.indexOf(scGroupOf_(it)) === -1) return;
    by[it.date].push(it);
  });
  days.forEach(function(d){ by[d].sort(function(a, b){ return scGroupOf_(a) === scGroupOf_(b) ? String(a.phone).localeCompare(String(b.phone)) : _SC_GROUPS.findIndex(function(g){ return g.key === scGroupOf_(a); }) - _SC_GROUPS.findIndex(function(g){ return g.key === scGroupOf_(b); }); }); });
  return by;
}
function scCountByGroup_(items, days){
  var c = { goi: 0, sp: 0, cs: 0, hen: 0, other: 0 };
  (items || []).forEach(function(it){ if (!it.done && days.indexOf(it.date) !== -1) c[scGroupOf_(it)]++; });
  return c;
}
// Có được dời lịch `it` sang newDate không
function scMoveCheck_(it, newDate, todayYmd){
  if (!it) return { ok: false, msg: 'Không tìm thấy lịch' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate || '')) return { ok: false, msg: 'Ngày không hợp lệ' };
  if (it.date === newDate) return { ok: false, msg: '', same: true };
  if (it.autoDao) return { ok: false, msg: 'Lịch tự động theo mốc đơn — hệ thống tính lại nên không dời tay được (dùng nút Kết quả → Hẹn lại)' };
  if (it.type === 'birthday') return { ok: false, msg: 'Sinh nhật lặp hằng năm, không dời được' };
  if (newDate < todayYmd) return { ok: false, msg: 'Chỉ dời sang hôm nay hoặc ngày sau' };
  return { ok: true };
}
// Áp dời lịch lên bản sao dữ liệu, trả { schedules, care, careField } (thuần — nơi gọi mới ghi localStorage/đồng bộ)
function scApplyMove_(schedules, careData, id, newDate){
  var out = (schedules || []).map(function(x){ return x.id === id ? Object.assign({}, x, { date: newDate }) : x; });
  var it = (schedules || []).filter(function(x){ return x.id === id; })[0];
  var res = { schedules: out, care: null, careField: '' };
  if (!it) return res;
  var f = _SC_FIELD[it.type];
  var c = careData && careData[it.phone];
  if (f && c && c[f] === it.date){ res.care = Object.assign({}, c); res.care[f] = newDate; res.careField = f; }
  return res;
}

// ── Vẽ ──
function scEsc_(s){ return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function scColor_(it){
  var st = (typeof SCHED_TYPES !== 'undefined' && SCHED_TYPES.filter(function(x){ return x.key === it.type; })[0]) || (typeof SCHED_TYPES !== 'undefined' ? SCHED_TYPES[0] : null);
  return st ? st.color : '#64748b';
}
function scDayLabel_(ymd){
  var d = scParse_(ymd); if (!d) return ymd;
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}
function scChipHtml_(it, today){
  var c = typeof _customerByPhone === 'function' ? _customerByPhone(it.phone) : null;
  var name = c ? (typeof _lastWord === 'function' ? _lastWord(c.name) : c.name) : it.phone;
  var note = typeof _schedNoteShort === 'function' ? _schedNoteShort(it) : (it.note || '');
  var code = typeof _schedShortCode === 'function' ? _schedShortCode(it) : 'CS';
  var movable = !it.autoDao && it.type !== 'birthday';   // lịch tự động / sinh nhật không dời tay (xem scMoveCheck_)
  var h = '<div class="sc-chip" draggable="' + (movable ? 'true' : 'false') + '" style="--sc-c:' + scColor_(it) + '" data-id="' + scEsc_(it.id) + '" data-phone="' + scEsc_(it.phone) + '">';
  h += '<div class="sc-chip-h"><span class="sc-code">' + code + '</span><span class="sc-name">' + scEsc_(name) + '</span>' +
    (typeof _schedCsTag === 'function' ? _schedCsTag(it) : '') + '</div>';
  h += '<div class="sc-sub">' + scEsc_(it.phone) + '</div>';
  if (note) h += '<div class="sc-note">' + scEsc_(note) + '</div>';
  h += '<div class="sc-act">' +
    (movable ? '<button type="button" class="sc-b" data-act="mv" data-d="-1" data-id="' + scEsc_(it.id) + '" title="Dời lùi 1 ngày">‹</button>' : '<span></span>') +
    '<button type="button" class="sc-b sc-ok" data-act="ok" data-id="' + scEsc_(it.id) + '" title="Xong (xoá nhắc)">✓</button>' +
    (movable ? '<button type="button" class="sc-b" data-act="mv" data-d="1" data-id="' + scEsc_(it.id) + '" title="Dời tới 1 ngày">›</button>' : '<span></span>') + '</div>';
  return h + '</div>';
}
function scFilterBarHtml_(counts){
  return '<div class="sc-filters">' + _SC_GROUPS.map(function(g){
    var on = !_sc.types.length || _sc.types.indexOf(g.key) !== -1;
    return '<button type="button" class="sc-f' + (_sc.types.indexOf(g.key) !== -1 ? ' on' : '') + '" data-act="ft" data-k="' + g.key + '">' + g.label + ' <b>' + (counts[g.key] || 0) + '</b></button>';
  }).join('') + (_sc.types.length ? '<button type="button" class="sc-f sc-f-clear" data-act="ft" data-k="">✕ Bỏ lọc</button>' : '') + '</div>';
}
function scWeekDays_(){
  var today = scYmd_(new Date()), s = scWeekStart_(today, typeof schedOffset !== 'undefined' ? schedOffset : 0), days = [];
  for (var i = 0; i < 7; i++) days.push(scAddDays_(s, i));
  return days;
}
function scVisibleItems_(){
  var fl = typeof _csFilterListMatch === 'function' ? _csFilterListMatch() : [];
  return (typeof schedules !== 'undefined' ? schedules : []).filter(function(x){ return !x.done && (typeof _schedCsFilter !== 'function' || _schedCsFilter(x, fl)); });
}
function scWeekHtml_(items, days, today){
  var by = scGroup_(items, days, _sc.types);
  return scFilterBarHtml_(scCountByGroup_(items, days)) + '<div class="sc-week">' + days.map(function(d){
    return '<div class="sc-day' + (d === today ? ' sc-today' : '') + (d < today ? ' sc-past' : '') + '" data-day="' + d + '">' +
      '<div class="sc-day-h" data-act="goday" data-day="' + d + '"><span>' + scDayLabel_(d) + '</span><span class="sc-day-n">' + by[d].length + '</span></div>' +
      '<div class="sc-day-b">' + (by[d].map(function(it){ return scChipHtml_(it, today); }).join('') || '<div class="sc-none">—</div>') + '</div></div>';
  }).join('') + '</div>';
}
function scDayHtml_(items, day, today){
  var by = scGroup_(items, [day], _sc.types)[day], counts = scCountByGroup_(items, [day]);
  var secs = _SC_GROUPS.map(function(g){
    var list = by.filter(function(it){ return scGroupOf_(it) === g.key; });
    if (!list.length) return '';
    return '<div class="sc-sec"><div class="sc-sec-h">' + g.label + ' <b>' + list.length + '</b></div><div class="sc-sec-b">' + list.map(function(it){ return scChipHtml_(it, today); }).join('') + '</div></div>';
  }).join('');
  return scFilterBarHtml_(counts) + '<div class="sc-day sc-dayview' + (day === today ? ' sc-today' : '') + '" data-day="' + day + '">' +
    (secs || '<div class="sc-none sc-none-big">Không có lịch trong ngày này' + (_sc.types.length ? ' (đang lọc theo loại)' : '') + '</div>') + '</div>';
}
function scNavHtml_(today){
  if (_sc.mode === 'day'){
    return '<div class="sc-nav"><button type="button" class="btn sm" data-act="nav" data-d="-1">← Hôm trước</button><button type="button" class="btn sm" data-act="nav" data-d="0">Hôm nay</button><button type="button" class="btn sm" data-act="nav" data-d="1">Hôm sau →</button>' +
      '<span class="sc-nav-l">' + scDayLabel_(_sc.day) + (_sc.day === today ? ' · hôm nay' : '') + '</span></div>';
  }
  var days = scWeekDays_();
  return '<div class="sc-nav"><button type="button" class="btn sm" data-act="nav" data-d="-1">← Tuần trước</button><button type="button" class="btn sm" data-act="nav" data-d="0">Tuần này</button><button type="button" class="btn sm" data-act="nav" data-d="1">Tuần sau →</button>' +
    '<span class="sc-nav-l">' + scDayLabel_(days[0]) + ' – ' + scDayLabel_(days[6]) + '</span></div>';
}
function scRender(){
  var tab = document.getElementById('tab-schedule'); if (!tab) return;
  var cal = document.getElementById('sched-cal'), old = document.getElementById('sched-grid'), seg = document.getElementById('sched-view-bar');
  if (seg) seg.querySelectorAll('[data-mode]').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-mode') === _sc.mode); });
  var oldNav = tab.querySelector('.toolbar .tl-l');
  var calMode = _sc.mode !== 'list';
  if (old) old.style.display = calMode ? 'none' : '';
  if (oldNav) oldNav.style.display = calMode ? 'none' : '';
  if (!cal) return;
  cal.style.display = calMode ? '' : 'none';
  if (!calMode) return;
  var today = scYmd_(new Date());
  if (!_sc.day) _sc.day = today;
  var items = scVisibleItems_();
  cal.innerHTML = scNavHtml_(today) + (_sc.mode === 'week' ? scWeekHtml_(items, scWeekDays_(), today) : scDayHtml_(items, _sc.day, today));
  var lbl = document.getElementById('sched-date-label');
  if (lbl) lbl.textContent = _sc.mode === 'day' ? (_sc.day === today ? 'Hôm nay' : scDayLabel_(_sc.day)) : (schedOffset === 0 ? 'Tuần này' : schedOffset < 0 ? Math.abs(schedOffset) + ' tuần trước' : schedOffset + ' tuần sau');
}
function scSetMode(m){
  _sc.mode = (m === 'week' || m === 'day') ? m : 'list';
  try { localStorage.setItem('sc_mode', _sc.mode); } catch (e) {}
  if (_sc.mode === 'day' && !_sc.day) _sc.day = scYmd_(new Date());
  scRender();
}

// ── Hành động ──
function scToast_(msg){ if (!msg) return; if (typeof toast === 'function') toast(msg); else alert(msg); }
function scMove(id, newDate){
  var it = schedules.filter(function(x){ return x.id === id; })[0];
  var chk = scMoveCheck_(it, newDate, scYmd_(new Date()));
  if (!chk.ok){ scToast_(chk.msg); return false; }
  var r = scApplyMove_(schedules, careData, id, newDate);
  schedules = r.schedules;
  if (r.care) careData[it.phone] = r.care;
  try { saveLS('ome_sched', schedules); saveLS('ome_schedules', schedules); if (r.care) saveLS('ome_care', careData); } catch (e) {}
  try { if (typeof _touchCare === 'function') _touchCare(it.phone); saveLS('ome_care', careData); } catch (e) {}
  try { if (typeof logAudit === 'function') logAudit('sched', it.phone, it.note || '', 'Dời lịch ' + it.date + ' → ' + newDate); } catch (e) {}
  try { if (typeof gsUrl !== 'undefined' && gsUrl && typeof queueCareSync === 'function') queueCareSync(it.phone); } catch (e) {}
  try { if (typeof updateSchedBadges === 'function') updateSchedBadges(); if (typeof renderOverdueTab === 'function') renderOverdueTab(); if (typeof renderReminderPanel === 'function') renderReminderPanel(); if (typeof _refreshOpenDpTab === 'function') _refreshOpenDpTab(it.phone); } catch (e) {}
  scRender();
  scToast_('✓ Đã dời lịch sang ' + scDayLabel_(newDate));
  return true;
}
var _scDragId = '';
function scBind_(){
  var cal = document.getElementById('sched-cal');
  if (!cal || cal._scBound) return;
  cal._scBound = true;
  cal.addEventListener('dragstart', function(e){
    var c = e.target.closest && e.target.closest('.sc-chip'); if (!c) return;
    _scDragId = c.getAttribute('data-id'); c.classList.add('sc-drag');
    try { e.dataTransfer.setData('text/plain', _scDragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
  });
  cal.addEventListener('dragend', function(){
    _scDragId = '';
    cal.querySelectorAll('.sc-drag,.sc-drop,.sc-deny').forEach(function(el){ el.classList.remove('sc-drag', 'sc-drop', 'sc-deny'); });
  });
  cal.addEventListener('dragover', function(e){
    var day = e.target.closest && e.target.closest('.sc-day'); if (!day || !_scDragId) return;
    var it = schedules.filter(function(x){ return x.id === _scDragId; })[0];
    var chk = scMoveCheck_(it, day.getAttribute('data-day'), scYmd_(new Date()));
    cal.querySelectorAll('.sc-drop,.sc-deny').forEach(function(el){ if (el !== day) el.classList.remove('sc-drop', 'sc-deny'); });
    day.classList.toggle('sc-drop', !!chk.ok); day.classList.toggle('sc-deny', !chk.ok && !chk.same);
    if (chk.ok) e.preventDefault();
  });
  cal.addEventListener('drop', function(e){
    var day = e.target.closest && e.target.closest('.sc-day'); if (!day) return;
    e.preventDefault();
    var id = _scDragId || (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
    if (id) scMove(id, day.getAttribute('data-day'));
  });
  cal.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-act]');
    if (b){
      var act = b.getAttribute('data-act');
      e.stopPropagation();
      if (act === 'mv'){
        var it = schedules.filter(function(x){ return x.id === b.getAttribute('data-id'); })[0];
        if (it) scMove(it.id, scAddDays_(it.date, parseInt(b.getAttribute('data-d'), 10)));
      } else if (act === 'ok'){
        if (typeof markDone === 'function'){ markDone(b.getAttribute('data-id')); scRender(); }
      } else if (act === 'ft'){
        var k = b.getAttribute('data-k');
        if (!k) _sc.types = []; else { var i = _sc.types.indexOf(k); if (i === -1) _sc.types.push(k); else _sc.types.splice(i, 1); }
        scRender();
      } else if (act === 'goday'){
        _sc.day = b.getAttribute('data-day'); scSetMode('day');
      } else if (act === 'nav'){
        var dd = parseInt(b.getAttribute('data-d'), 10);
        if (_sc.mode === 'day') _sc.day = dd === 0 ? scYmd_(new Date()) : scAddDays_(_sc.day || scYmd_(new Date()), dd);
        else schedOffset = dd === 0 ? 0 : schedOffset + dd;
        scRender();
      }
      return;
    }
    var c = e.target.closest && e.target.closest('.sc-chip');
    if (c && typeof _openCustomerByPhone_ === 'function') _openCustomerByPhone_(c.getAttribute('data-phone'));
  });
}

// Vẽ lại lịch kiểu mới mỗi lần màn cũ vẽ lại (đổi bộ lọc CS, thêm/xoá lịch, nhập dữ liệu mới…)
(function(){
  if (typeof window === 'undefined') return;
  var orig = window.renderScheduleTab;
  if (typeof orig !== 'function') return;
  window.renderScheduleTab = function(){
    orig.apply(this, arguments);
    scBind_();
    scRender();
  };
})();

if (typeof module !== 'undefined' && module.exports){
  module.exports = { scWeekStart_: scWeekStart_, scAddDays_: scAddDays_, scGroup_: scGroup_, scCountByGroup_: scCountByGroup_, scMoveCheck_: scMoveCheck_, scApplyMove_: scApplyMove_, scGroupOf_: scGroupOf_ };
}

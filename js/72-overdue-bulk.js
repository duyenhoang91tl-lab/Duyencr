// ════════════════════════════════════════════════════════════════════
//  R6c (phần 1) — MÀN "⚠ QUÁ HẠN": CHỌN NHIỀU + DỜI HÀNG LOẠT + TÓM TẮT THEO CS. Nạp SAU js/02, 71.
//  NGUYÊN NHÂN GỐC: màn Quá hạn chỉ liệt kê; khi tồn vài chục lịch (nghỉ phép, dồn việc) CS phải mở từng khách để dời/xử lý, quản lý không biết
//  mỗi CS đang tồn bao nhiêu lịch quá hạn. Nay: ô tích từng dòng + "Chọn tất cả", nút "Dời sang hôm nay" / "Dời sang ngày…" (dùng đúng luật
//  dời của lịch Tuần/Ngày — js/71 `scMoveCheck_`/`scApplyMove_`: bỏ qua lịch tự động & sinh nhật), và dòng tóm tắt "Tồn theo CS" (bấm tên để chọn hết lịch của CS đó).
//  KHÔNG đổi renderOverdueTab ngoài việc thêm thuộc tính data-id vào dòng (để biết dòng nào là lịch nào). "Giao lại khi nghỉ" = phần 2, chờ Duyên chốt luật.
//  Hàm thuần: obPlan_ (test: node tools/test-overdue-bulk.js)
// ════════════════════════════════════════════════════════════════════
var _ob = { sel: [] };   // id các lịch đang chọn (giữ qua các lần vẽ lại, tự bỏ id không còn quá hạn)

// Kế hoạch dời hàng loạt: lịch nào dời được, lịch nào bị bỏ qua (kèm lý do, gộp đếm theo lý do)
function obPlan_(items, ids, newDate, todayYmd){
  var by = {}; (items || []).forEach(function(x){ by[x.id] = x; });
  var movable = [], skipped = {};
  (ids || []).forEach(function(id){
    var chk = scMoveCheck_(by[id], newDate, todayYmd);
    if (chk.ok) movable.push(id);
    else if (!chk.same){ var k = chk.msg || 'Không dời được'; skipped[k] = (skipped[k] || 0) + 1; }
  });
  return { movable: movable, skipped: skipped, skippedCount: Object.keys(skipped).reduce(function(n, k){ return n + skipped[k]; }, 0) };
}
// Đếm lịch quá hạn theo CS chịu trách nhiệm (resp(it) → tên; rỗng → "(chưa gán)")
function obByCs_(items, resp){
  var m = {};
  (items || []).forEach(function(it){
    String(resp(it) || '(chưa gán)').split(',').map(function(n){ return n.trim(); }).filter(Boolean).forEach(function(n){ (m[n] = m[n] || []).push(it.id); });
  });
  return Object.keys(m).map(function(n){ return { name: n, ids: m[n] }; }).sort(function(a, b){ return b.ids.length - a.ids.length || a.name.localeCompare(b.name, 'vi'); });
}

function obItems_(){
  var today = scYmd_(new Date()), fl = typeof _csFilterListMatch === 'function' ? _csFilterListMatch() : [];
  return schedules.filter(function(x){ return x.date < today && !x.done && (typeof _schedCsFilter !== 'function' || _schedCsFilter(x, fl)); });
}
function obEsc_(s){ return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function obDecorate(){
  var grid = document.getElementById('overdue-grid'); if (!grid) return;
  var items = obItems_(), alive = {}; items.forEach(function(x){ alive[x.id] = 1; });
  _ob.sel = _ob.sel.filter(function(id){ return alive[id]; });
  grid.querySelectorAll('.sched-item.sched-overdue[data-id]').forEach(function(row){
    if (row.querySelector('.ob-ck')) return;
    var id = row.getAttribute('data-id');
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'ob-ck'; cb.setAttribute('data-id', id); cb.checked = _ob.sel.indexOf(id) !== -1;
    row.insertBefore(cb, row.firstChild);
  });
  var old = document.getElementById('ob-bar'); if (old) old.remove();
  if (!items.length) return;
  var resp = typeof _schedResponsibleCS === 'function' ? _schedResponsibleCS : function(){ return ''; };
  var cs = obByCs_(items, resp);
  var bar = document.createElement('div'); bar.id = 'ob-bar'; bar.className = 'ob-bar';
  bar.innerHTML = '<div class="ob-row"><label class="ob-all"><input type="checkbox" id="ob-all"' + (_ob.sel.length && _ob.sel.length === items.length ? ' checked' : '') + '> Chọn tất cả (' + items.length + ')</label>' +
    '<span class="ob-n">' + (_ob.sel.length ? 'Đã chọn <b>' + _ob.sel.length + '</b>' : 'Chưa chọn') + '</span>' +
    '<button type="button" class="btn sm primary" data-ob="today"' + (_ob.sel.length ? '' : ' disabled') + '>Dời sang hôm nay</button>' +
    '<input type="date" id="ob-date" class="ob-date" min="' + scYmd_(new Date()) + '"><button type="button" class="btn sm" data-ob="date"' + (_ob.sel.length ? '' : ' disabled') + '>Dời sang ngày này</button></div>' +
    '<div class="ob-cs"><span class="ob-cs-t">Tồn theo CS:</span>' + cs.map(function(c){ return '<button type="button" class="ob-cs-b" data-ob="cs" data-cs="' + obEsc_(c.name) + '">' + obEsc_(c.name) + ' <b>' + c.ids.length + '</b></button>'; }).join('') + '</div>';
  grid.insertBefore(bar, grid.firstChild);
}
function obMoveSelected(newDate){
  var today = scYmd_(new Date()), items = obItems_();
  var plan = obPlan_(items, _ob.sel, newDate, today);
  if (!plan.movable.length){ scToast_(plan.skippedCount ? 'Không dời được: ' + Object.keys(plan.skipped).join('; ') : 'Chưa chọn lịch nào'); return; }
  var msg = 'Dời ' + plan.movable.length + ' lịch sang ' + newDate + '?' + (plan.skippedCount ? '\n(Bỏ qua ' + plan.skippedCount + ' lịch không dời được: ' + Object.keys(plan.skipped).join('; ') + ')' : '');
  if (!confirm(msg)) return;
  var phones = {}, cur = schedules;
  plan.movable.forEach(function(id){
    var it = cur.filter(function(x){ return x.id === id; })[0]; if (!it) return;
    var r = scApplyMove_(cur, careData, id, newDate);
    cur = r.schedules; if (r.care) careData[it.phone] = r.care;
    phones[it.phone] = 1;
    try { if (typeof logAudit === 'function') logAudit('sched', it.phone, it.note || '', 'Dời lịch quá hạn ' + it.date + ' → ' + newDate); } catch (e) {}
  });
  schedules = cur;
  try { saveLS('ome_sched', schedules); saveLS('ome_schedules', schedules); saveLS('ome_care', careData); } catch (e) {}
  Object.keys(phones).forEach(function(p){
    try { if (typeof _touchCare === 'function') _touchCare(p); } catch (e) {}
    try { if (typeof gsUrl !== 'undefined' && gsUrl && typeof queueCareSync === 'function') queueCareSync(p); } catch (e) {}
  });
  try { saveLS('ome_care', careData); } catch (e) {}
  _ob.sel = [];
  try { if (typeof updateSchedBadges === 'function') updateSchedBadges(); if (typeof renderReminderPanel === 'function') renderReminderPanel(); } catch (e) {}
  renderOverdueTab();
  if (typeof renderScheduleTab === 'function') renderScheduleTab();
  scToast_('✓ Đã dời ' + plan.movable.length + ' lịch sang ' + newDate + (plan.skippedCount ? ' · bỏ qua ' + plan.skippedCount : ''));
}
function obBind_(){
  var grid = document.getElementById('overdue-grid');
  if (!grid || grid._obBound) return;
  grid._obBound = true;
  grid.addEventListener('click', function(e){
    var t = e.target;
    if (t.classList && t.classList.contains('ob-ck')){ e.stopPropagation(); var id = t.getAttribute('data-id'), i = _ob.sel.indexOf(id); if (t.checked && i === -1) _ob.sel.push(id); if (!t.checked && i !== -1) _ob.sel.splice(i, 1); obDecorateBar_(); return; }
    if (t.id === 'ob-all'){ _ob.sel = t.checked ? obItems_().map(function(x){ return x.id; }) : []; grid.querySelectorAll('.ob-ck').forEach(function(c){ c.checked = t.checked; }); obDecorateBar_(); return; }
    var b = t.closest && t.closest('[data-ob]'); if (!b) return;
    e.stopPropagation();
    var k = b.getAttribute('data-ob');
    if (k === 'today') obMoveSelected(scYmd_(new Date()));
    else if (k === 'date'){ var v = (document.getElementById('ob-date') || {}).value; if (!v){ scToast_('Chọn ngày muốn dời tới'); return; } obMoveSelected(v); }
    else if (k === 'cs'){
      var name = b.getAttribute('data-cs'), resp = typeof _schedResponsibleCS === 'function' ? _schedResponsibleCS : function(){ return ''; };
      var ids = obByCs_(obItems_(), resp).filter(function(c){ return c.name === name; }).map(function(c){ return c.ids; })[0] || [];
      _ob.sel = ids.slice(); grid.querySelectorAll('.ob-ck').forEach(function(c){ c.checked = _ob.sel.indexOf(c.getAttribute('data-id')) !== -1; }); obDecorateBar_();
    }
  }, true);   // capture: chặn onclick mở hồ sơ khi bấm ô tích
}
// Cập nhật số "Đã chọn" + trạng thái nút mà không vẽ lại cả danh sách
function obDecorateBar_(){
  var bar = document.getElementById('ob-bar'); if (!bar) return;
  var n = _ob.sel.length, total = obItems_().length;
  var lbl = bar.querySelector('.ob-n'); if (lbl) lbl.innerHTML = n ? 'Đã chọn <b>' + n + '</b>' : 'Chưa chọn';
  bar.querySelectorAll('[data-ob="today"],[data-ob="date"]').forEach(function(b){ b.disabled = !n; });
  var all = document.getElementById('ob-all'); if (all) all.checked = n > 0 && n === total;
}

(function(){
  if (typeof window === 'undefined') return;
  var orig = window.renderOverdueTab;
  if (typeof orig !== 'function') return;
  window.renderOverdueTab = function(){
    orig.apply(this, arguments);
    obBind_();
    obDecorate();
  };
})();

if (typeof module !== 'undefined' && module.exports){ module.exports = { obPlan_: obPlan_, obByCs_: obByCs_ }; }

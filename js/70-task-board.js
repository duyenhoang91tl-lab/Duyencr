// ════════════════════════════════════════════════════════════════════
//  R6a — BẢNG CÔNG VIỆC DẠNG CỘT (kanban) cho tab Công việc. Nạp SAU js/26, 44, 45.
//  Hai kiểu bảng:
//   • Theo QUY TRÌNH (chọn 1 loại quy trình ở ô chọn): cột = các giai đoạn của quy trình + "Hoàn thành".
//     Kéo thẻ sang cột KẾ TIẾP = đúng việc bấm "Chuyển tiếp ➜" trong chi tiết (action GAS `taskAdvance`; giai đoạn cần duyệt thì gửi
//     yêu cầu duyệt, thẻ vẫn ở cột cũ + hiện ⏳). Không cho lùi / nhảy cóc / kéo thẻ người khác phụ trách (server vẫn kiểm quyền thật).
//   • KHÔNG quy trình (mặc định): cột = Chưa làm | Đang làm | Hoàn thành; kéo thẻ = đổi trạng thái (action `saveTask`).
//  Màn cảm ứng không có kéo thả HTML5 → mỗi thẻ có nút ‹ › bấm để chuyển (cùng quy tắc quyền).
//  Dùng lại bộ lọc của bảng danh sách (`_taskFilteredList` ở js/26) nên "Giao cho tôi / Quá hạn / ô tìm" áp cho cả hai kiểu xem.
//  Hàm thuần (tbColumns_, tbGroup_, tbDrop_) không đụng DOM → test được: node tools/test-task-board.js
// ════════════════════════════════════════════════════════════════════
var _TB_STATUS = ['Chưa làm', 'Đang làm', 'Hoàn thành'];
var _TB_DONE = '__done';
var _tb = { mode: 'list', flowId: '', busy: false };
try { _tb.mode = localStorage.getItem('tb_mode') === 'board' ? 'board' : 'list'; _tb.flowId = localStorage.getItem('tb_flow') || ''; } catch (e) {}

function tbFlowOf_(flows, flowId){
  for (var i = 0; i < (flows || []).length; i++) if (flows[i].id === flowId) return flows[i];
  return null;
}
// Cột của bảng: có quy trình → giai đoạn + Hoàn thành; không → 3 trạng thái
function tbColumns_(flowId, flows){
  var f = flowId ? tbFlowOf_(flows, flowId) : null;
  if (!f) return _TB_STATUS.map(function(s){ return { key: s, name: s, approval: false }; });
  var cols = f.stages.map(function(s){ return { key: s.id, name: s.name, approval: !!s.approval }; });
  cols.push({ key: _TB_DONE, name: '🏁 Hoàn thành', approval: false });
  return cols;
}
// Việc nằm ở cột nào ('' = không thuộc bảng này)
function tbColOf_(t, flowId, flows){
  var f = flowId ? tbFlowOf_(flows, flowId) : null;
  if (!f){
    if (flowId) return '';                       // quy trình đã bị xoá/không còn → không vẽ
    if (t.flowId) return '';                     // việc có quy trình chỉ hiện ở bảng của quy trình đó
    return _TB_STATUS.indexOf(t.status) !== -1 ? t.status : 'Chưa làm';
  }
  if (t.flowId !== f.id) return '';
  var i = t.stageIdx || 0;
  return i >= f.stages.length ? _TB_DONE : f.stages[i].id;
}
function tbDeadlineMs_(t){
  if (!t.deadline) return Infinity;
  var d = new Date(t.deadline); var ms = d.getTime();
  return isNaN(ms) ? Infinity : ms;
}
// Gom việc vào cột; trong cột: quá hạn trước → hạn gần trước → không hạn cuối
function tbGroup_(tasks, flowId, flows, isOverdueFn){
  var cols = tbColumns_(flowId, flows), map = {}, total = 0;
  cols.forEach(function(c){ c.tasks = []; map[c.key] = c; });
  (tasks || []).forEach(function(t){
    var k = tbColOf_(t, flowId, flows);
    if (k && map[k]){ map[k].tasks.push(t); total++; }
  });
  cols.forEach(function(c){
    c.tasks.sort(function(a, b){
      var oa = isOverdueFn && isOverdueFn(a) ? 0 : 1, ob = isOverdueFn && isOverdueFn(b) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      var da = tbDeadlineMs_(a), db = tbDeadlineMs_(b);
      return da === db ? 0 : (da < db ? -1 : 1);
    });
  });
  return { cols: cols, total: total };
}
// Người đang phụ trách (hiện trên thẻ): quy trình → người của giai đoạn hiện tại; không → csAssigned
function tbAssignees_(t, flow){
  if (flow && t.flowId === flow.id){
    var s = flow.stages[t.stageIdx || 0];
    if (s) return (t.stageAssignees || {})[s.id] || [];
    return [];
  }
  return t.csAssigned || [];
}
// Quyết định khi thả thẻ vào cột targetKey. Trả { kind:'none'|'advance'|'status'|'deny', msg, status? }
function tbDrop_(t, targetKey, flowId, flows, me, isAdmin){
  var f = flowId ? tbFlowOf_(flows, flowId) : null;
  var from = tbColOf_(t, flowId, flows);
  if (!from) return { kind: 'deny', msg: 'Việc này không thuộc bảng đang xem' };
  if (from === targetKey) return { kind: 'none' };
  if (!f){
    if (_TB_STATUS.indexOf(targetKey) === -1) return { kind: 'deny', msg: 'Cột không hợp lệ' };
    var mine = isAdmin || (me && ((t.csAssigned || []).indexOf(me) !== -1 || t.createdBy === me));
    if (!mine) return { kind: 'deny', msg: 'Chỉ người được giao, người tạo hoặc admin mới đổi trạng thái được' };
    return { kind: 'status', status: targetKey };
  }
  var cols = tbColumns_(flowId, flows);
  var ci = -1, ti = -1;
  cols.forEach(function(c, i){ if (c.key === from) ci = i; if (c.key === targetKey) ti = i; });
  if (ti < 0) return { kind: 'deny', msg: 'Cột không hợp lệ' };
  if (ci === cols.length - 1) return { kind: 'deny', msg: 'Việc đã hoàn thành, không chuyển ngược được' };
  if (ti < ci) return { kind: 'deny', msg: 'Không lùi về giai đoạn trước được' };
  if (ti > ci + 1) return { kind: 'deny', msg: 'Chuyển từng giai đoạn một, không nhảy cóc' };
  if ((t.pendingReq || []).some(function(q){ return q.status === 'pending' || !q.status; })) return { kind: 'deny', msg: 'Việc đang chờ duyệt chuyển tiếp' };
  var assignees = (t.stageAssignees || {})[from] || [];
  if (!(me && (assignees.indexOf(me) !== -1 || t.createdBy === me)))
    return { kind: 'deny', msg: 'Chỉ người phụ trách giai đoạn này (hoặc người tạo) mới chuyển tiếp được' };
  return { kind: 'advance', approval: !!cols[ci].approval };
}
// Cột trước/sau của 1 việc (cho nút ‹ › trên màn cảm ứng); trả key hoặc ''
function tbNeighbor_(t, dir, flowId, flows){
  var cols = tbColumns_(flowId, flows), from = tbColOf_(t, flowId, flows), i = -1;
  cols.forEach(function(c, k){ if (c.key === from) i = k; });
  var j = i + dir;
  return (i < 0 || j < 0 || j >= cols.length) ? '' : cols[j].key;
}

// ── Vẽ ──
function tbEsc_(s){ return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function tbMe_(){ return (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''; }
function tbIsAdmin_(){
  try { return (typeof _tfIsAdmin === 'function' && _tfIsAdmin()) || (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin'); } catch (e) { return false; }
}
function tbCardHtml_(t, flowId, flows){
  var f = flowId ? tbFlowOf_(flows, flowId) : null;
  var over = typeof _taskIsOverdue === 'function' && _taskIsOverdue(t);
  var pend = (t.pendingReq || []).length > 0;
  var who = tbAssignees_(t, f);
  var prev = tbNeighbor_(t, -1, flowId, flows), next = tbNeighbor_(t, 1, flowId, flows);
  var h = '<div class="tb-card' + (over ? ' tb-over' : '') + '" draggable="true" data-id="' + tbEsc_(t.id) + '">';
  h += '<div class="tb-title">' + tbEsc_(t.title) + '</div>';
  h += '<div class="tb-meta">';
  if (t.deadline) h += '<span class="tb-chip' + (over ? ' tb-chip-danger' : '') + '">' + (over ? '⚠ ' : '📅 ') + tbEsc_(t.deadline) + '</span>';
  if (pend) h += '<span class="tb-chip tb-chip-warn">⏳ chờ duyệt</span>';
  h += '</div>';
  h += '<div class="tb-who">' + (who.length ? who.map(function(n){ return '<span class="tb-av" title="' + tbEsc_(n) + '">' + tbEsc_((n || '?').trim().charAt(0).toUpperCase()) + '</span>'; }).join('') +
    '<span class="tb-who-n">' + tbEsc_(who.join(', ')) + '</span>' : '<span class="tb-who-n">Chưa giao</span>') + '</div>';
  h += '<div class="tb-mv">' +
    (prev ? '<button type="button" class="tb-mvb" data-act="mv" data-dir="-1" data-id="' + tbEsc_(t.id) + '" title="Về cột trước">‹</button>' : '<span></span>') +
    (next ? '<button type="button" class="tb-mvb" data-act="mv" data-dir="1" data-id="' + tbEsc_(t.id) + '" title="Sang cột sau">›</button>' : '<span></span>') + '</div>';
  return h + '</div>';
}
function tbBoardHtml_(g, flowId, flows){
  if (!g.total) return '<div class="tb-empty">Không có công việc nào khớp bộ lọc' + (flowId ? ' trong quy trình này.' : ' (việc có quy trình chỉ hiện khi chọn đúng quy trình ở ô bên trên).') + '</div>';
  return '<div class="tb-board">' + g.cols.map(function(c){
    return '<div class="tb-col" data-col="' + tbEsc_(c.key) + '"><div class="tb-col-h"><span class="tb-col-n">' + tbEsc_(c.name) + (c.approval ? ' <span class="tb-chip tb-chip-warn">cần duyệt</span>' : '') +
      '</span><span class="tb-col-c">' + c.tasks.length + '</span></div><div class="tb-col-b">' +
      (c.tasks.map(function(t){ return tbCardHtml_(t, flowId, flows); }).join('') || '<div class="tb-col-empty">—</div>') + '</div></div>';
  }).join('') + '</div>';
}
function tbFlowOptions_(flows, tasks){
  var cnt = {}; (tasks || []).forEach(function(t){ if (t.flowId) cnt[t.flowId] = (cnt[t.flowId] || 0) + 1; });
  var noFlow = (tasks || []).filter(function(t){ return !t.flowId; }).length;
  return '<option value="">Không theo quy trình — theo trạng thái (' + noFlow + ')</option>' +
    (flows || []).map(function(f){ return '<option value="' + tbEsc_(f.id) + '">' + tbEsc_(f.name) + ' (' + (cnt[f.id] || 0) + ')</option>'; }).join('');
}
function tbRender(){
  tbBind_();
  var wrap = document.getElementById('task-board-wrap'), tblWrap = document.getElementById('task-list-wrap'), bar = document.getElementById('task-view-bar');
  if (!wrap) return;
  var board = _tb.mode === 'board';
  if (tblWrap) tblWrap.style.display = board ? 'none' : '';
  wrap.style.display = board ? '' : 'none';
  if (bar){
    var bl = document.getElementById('task-vw-list'), bb = document.getElementById('task-vw-board'), sel = document.getElementById('task-board-flow');
    if (bl) bl.classList.toggle('active', !board);
    if (bb) bb.classList.toggle('active', board);
    if (sel){
      sel.style.display = board ? '' : 'none';
      if (board){
        var flows = typeof allTaskFlows !== 'undefined' ? allTaskFlows : [];
        sel.innerHTML = tbFlowOptions_(flows, typeof allTasks !== 'undefined' ? allTasks : []);
        if (_tb.flowId && !tbFlowOf_(flows, _tb.flowId)) _tb.flowId = '';
        sel.value = _tb.flowId;
      }
    }
  }
  if (!board) return;
  if (!_tfLoaded && !_tb.loadingFlows && typeof loadTaskFlows === 'function'){   // quy trình chưa nạp (vào thẳng bảng cột) → nạp 1 lần rồi vẽ lại
    _tb.loadingFlows = true;
    loadTaskFlows().then(function(){ _tb.loadingFlows = false; tbRender(); });
  }
  var flows2 = typeof allTaskFlows !== 'undefined' ? allTaskFlows : [];
  var g = tbGroup_(_taskFilteredList(), _tb.flowId, flows2, typeof _taskIsOverdue === 'function' ? _taskIsOverdue : null);
  wrap.innerHTML = tbBoardHtml_(g, _tb.flowId, flows2);
}
function tbSetMode(m){
  _tb.mode = m === 'board' ? 'board' : 'list';
  try { localStorage.setItem('tb_mode', _tb.mode); } catch (e) {}
  tbRender();
}
function tbSetFlow(id){
  _tb.flowId = id || '';
  try { localStorage.setItem('tb_flow', _tb.flowId); } catch (e) {}
  tbRender();
}

// ── Hành động ──
function tbToast_(msg){ if (typeof toast === 'function') toast(msg); else alert(msg); }
async function tbMove(taskId, targetKey){
  if (_tb.busy) return;
  var flows = typeof allTaskFlows !== 'undefined' ? allTaskFlows : [];
  var t = allTasks.find(function(x){ return x.id === taskId; });
  if (!t) return;
  var d = tbDrop_(t, targetKey, _tb.flowId, flows, tbMe_(), tbIsAdmin_());
  if (d.kind === 'none') return;
  if (d.kind === 'deny'){ tbToast_(d.msg); return; }
  _tb.busy = true;
  try {
    if (d.kind === 'advance'){
      var r = await _tfPost({ action: 'taskAdvance', taskId: taskId, by: tbMe_(), note: '', force: false });
      if (r && r.error) tbToast_(r.error);
      else if (r && r.pending) tbToast_('Đã gửi yêu cầu duyệt. Việc chuyển tiếp khi người duyệt chấp nhận.');
    } else {
      var old = t.status; t.status = d.status; tbRender();   // hiện ngay, lỗi thì trả về
      var task = {}; for (var k in t) task[k] = t[k];
      task.status = d.status; task.by = tbMe_();
      var r2 = await _tfPost({ action: 'saveTask', task: task });
      if (r2 && r2.error){ t.status = old; tbToast_('Lỗi: ' + r2.error); }
    }
  } catch (e) { tbToast_('Lỗi kết nối, thử lại'); }
  _tb.busy = false;
  await loadTasks();
}
var _tbDragId = '';
function tbBind_(){
  var wrap = document.getElementById('task-board-wrap');
  if (!wrap || wrap._tbBound) return;
  wrap._tbBound = true;
  wrap.addEventListener('dragstart', function(e){
    var c = e.target.closest && e.target.closest('.tb-card'); if (!c) return;
    _tbDragId = c.getAttribute('data-id'); c.classList.add('tb-drag');
    try { e.dataTransfer.setData('text/plain', _tbDragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
  });
  wrap.addEventListener('dragend', function(){
    _tbDragId = '';
    wrap.querySelectorAll('.tb-drag,.tb-over-col,.tb-deny-col').forEach(function(el){ el.classList.remove('tb-drag', 'tb-over-col', 'tb-deny-col'); });
  });
  wrap.addEventListener('dragover', function(e){
    var col = e.target.closest && e.target.closest('.tb-col'); if (!col || !_tbDragId) return;
    var flows = typeof allTaskFlows !== 'undefined' ? allTaskFlows : [];
    var t = allTasks.find(function(x){ return x.id === _tbDragId; });
    var d = t ? tbDrop_(t, col.getAttribute('data-col'), _tb.flowId, flows, tbMe_(), tbIsAdmin_()) : { kind: 'deny' };
    wrap.querySelectorAll('.tb-over-col,.tb-deny-col').forEach(function(el){ if (el !== col) el.classList.remove('tb-over-col', 'tb-deny-col'); });
    var ok = d.kind === 'advance' || d.kind === 'status';
    col.classList.toggle('tb-over-col', ok); col.classList.toggle('tb-deny-col', d.kind === 'deny');
    if (ok) e.preventDefault();   // chỉ cho thả ở cột hợp lệ
  });
  wrap.addEventListener('drop', function(e){
    var col = e.target.closest && e.target.closest('.tb-col'); if (!col) return;
    e.preventDefault();
    var id = _tbDragId || (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
    if (id) tbMove(id, col.getAttribute('data-col'));
  });
  wrap.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-act="mv"]');
    if (b){
      e.stopPropagation();
      var t = allTasks.find(function(x){ return x.id === b.getAttribute('data-id'); });
      var flows = typeof allTaskFlows !== 'undefined' ? allTaskFlows : [];
      var key = t ? tbNeighbor_(t, parseInt(b.getAttribute('data-dir'), 10), _tb.flowId, flows) : '';
      if (t && key) tbMove(t.id, key);
      return;
    }
    var c = e.target.closest && e.target.closest('.tb-card');
    if (c && typeof openTaskDetailModal === 'function') openTaskDetailModal(c.getAttribute('data-id'));
  });
}

// Vẽ lại bảng cột mỗi lần bảng danh sách vẽ lại (đổi bộ lọc / tải lại việc)
(function(){
  if (typeof window === 'undefined') return;
  var orig = window.renderTaskTables;
  if (typeof orig !== 'function') return;
  window.renderTaskTables = function(){
    orig.apply(this, arguments);
    tbRender();
  };
})();

if (typeof module !== 'undefined' && module.exports){
  module.exports = { tbColumns_: tbColumns_, tbColOf_: tbColOf_, tbGroup_: tbGroup_, tbDrop_: tbDrop_, tbNeighbor_: tbNeighbor_, tbAssignees_: tbAssignees_, tbBoardHtml_: tbBoardHtml_, tbFlowOptions_: tbFlowOptions_ };
}

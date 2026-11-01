// Công việc kiểu Base: quy trình + giai đoạn. Nạp SAU 26-loadtasks.js (bọc loadTasks/openTaskModal/openTaskDetailModal...).
// Backend: gas_v13.js (taskFlows, saveTask kèm flowId/stageAssignees/stageApprovers, taskAdvance, taskRequestDecide). Xem HANDOFF.md.
//  M2 chọn LOẠI QUY TRÌNH + người phụ trách/người duyệt khi tạo việc · M3 chi tiết (thanh giai đoạn, Chuyển tiếp, duyệt)
//  M4 thảo luận (dòng hệ thống, tệp bất kỳ, hiển thị tag, tab Tài liệu). Gõ "@" gợi ý tên + thông báo @tag: do js/39-fn-notify.js lo.
var allTaskFlows = [];
var _tfStageAssign = {};   // { stageId: [tên] } người thực hiện từng giai đoạn
var _tfStageApprove = {};  // { stageId: [tên] } người duyệt (chỉ giai đoạn approval=true)
var _tfLoaded = false;

async function loadTaskFlows(force){
  if (_tfLoaded && !force) return allTaskFlows;
  if (typeof gsUrl === 'undefined' || !gsUrl) return allTaskFlows;
  try{
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=taskFlows', { redirect:'follow' });
    var d = await r.json();
    if (d && Array.isArray(d.flows)){ allTaskFlows = d.flows; _tfLoaded = true; }
  }catch(e){ console.warn('loadTaskFlows failed:', e); }
  return allTaskFlows;
}
function _tfFlowById(id){ return allTaskFlows.find(function(f){ return f.id === id; }) || null; }

// Bọc loadTasks: tải kèm danh sách quy trình (1 lần / phiên, ép tải lại khi quản lý quy trình)
(function(){
  var orig = window.loadTasks;
  window.loadTasks = async function(){
    await Promise.all([orig.apply(this, arguments), loadTaskFlows()]);
    if (typeof renderTaskTables === 'function') renderTaskTables();
  };
})();

// Danh sách tên chọn được: TẤT CẢ tài khoản (kể cả admin/kế toán — có thể là người duyệt) + CS từ dữ liệu
function _tfUserNames(){
  var set = new Set();
  (typeof accounts !== 'undefined' ? accounts : []).forEach(function(a){
    var n = (a && (a.name || a.username)) || ''; if (n) set.add(n);
  });
  (typeof _allCSNames === 'function' ? _allCSNames() : []).forEach(function(n){ if (n) set.add(n); });
  return Array.from(set).sort(function(a,b){ return a.localeCompare(b,'vi'); });
}
function _tfFlowId(){
  var el = document.getElementById('task-f-flow');
  return el ? (el.value || '') : '';
}

// ═══ M2 — chọn quy trình khi tạo/sửa việc ═══
function _tfInit(t){
  _tfStageAssign = {}; _tfStageApprove = {};
  var sel = document.getElementById('task-f-flow');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Công việc thường (không quy trình) —</option>' +
    allTaskFlows.map(function(f){ return '<option value="'+esc(f.id)+'">'+esc(f.name)+' ('+f.stages.length+' giai đoạn)</option>'; }).join('');
  if (t && t.flowId){
    sel.value = t.flowId; sel.disabled = true;   // đổi quy trình giữa chừng làm lệch tiến độ → khoá
    _tfStageAssign = JSON.parse(JSON.stringify(t.stageAssignees || {}));
    _tfStageApprove = JSON.parse(JSON.stringify(t.stageApprovers || {}));
  } else { sel.value = ''; sel.disabled = false; }
  _tfOnFlowChange();
}
function _tfOnFlowChange(){
  var on = !!_tfFlowId();
  var legacy = document.getElementById('task-f-legacy-assign');
  if (legacy) legacy.style.display = on ? 'none' : '';
  var stRow = document.getElementById('task-f-status'); stRow = stRow && stRow.closest('.assign-form-row');
  if (stRow) stRow.style.display = on ? 'none' : '';   // trạng thái do quy trình tự quyết định
  var box = document.getElementById('task-f-flow-stages');
  if (box) box.style.display = on ? '' : 'none';
  _tfRender();
}
function _tfChipsHtml(kind, sid, names){
  return (names||[]).map(function(n){
    return '<span class="tf-chip">'+esc(n)+' <b data-k="'+kind+'" data-s="'+esc(sid)+'" data-n="'+esc(n)+'" onclick="_tfRemoveEl(this)" title="Bỏ">✕</b></span>';
  }).join('') || '<span class="tf-empty">chưa chọn</span>';
}
function _tfPickerHtml(kind, sid, chosen){
  var opts = _tfUserNames().filter(function(n){ return (chosen||[]).indexOf(n) === -1; });
  return '<select class="assign-input tf-sel" data-k="'+kind+'" data-s="'+esc(sid)+'" onchange="_tfAddEl(this)">'+
    '<option value="">+ Thêm người…</option>'+opts.map(function(n){ return '<option value="'+esc(n)+'">'+esc(n)+'</option>'; }).join('')+'</select>';
}
function _tfRender(){
  var box = document.getElementById('task-f-flow-stages');
  if (!box) return;
  var f = _tfFlowById(_tfFlowId());
  if (!f){ box.innerHTML = ''; return; }
  box.innerHTML = f.stages.map(function(s, i){
    var as = _tfStageAssign[s.id] || [], ap = _tfStageApprove[s.id] || [];
    return '<div class="tf-stage">'+
      '<div class="tf-stage-hd"><span class="tf-no">'+(i+1)+'</span><b>'+esc(s.name)+'</b>'+
        (s.approval ? '<span class="tf-badge">cần duyệt khi chuyển tiếp</span>' : '')+'</div>'+
      '<div class="tf-lbl">Người thực hiện</div>'+
      '<div class="tf-chips" id="tf-as-'+esc(s.id)+'">'+_tfChipsHtml('as', s.id, as)+'</div>'+_tfPickerHtml('as', s.id, as)+
      (s.approval ?
        '<div class="tf-lbl">Người duyệt <span class="tf-hint">(để trống = người nhận giai đoạn kế tiếp)</span></div>'+
        '<div class="tf-chips">'+_tfChipsHtml('ap', s.id, ap)+'</div>'+_tfPickerHtml('ap', s.id, ap) : '')+
    '</div>';
  }).join('');
}
function _tfAdd(kind, sid, name){
  if (!name) return;
  var m = kind === 'ap' ? _tfStageApprove : _tfStageAssign;
  m[sid] = m[sid] || [];
  if (m[sid].indexOf(name) === -1) m[sid].push(name);
  _tfRender();
}
function _tfRemove(kind, sid, name){
  var m = kind === 'ap' ? _tfStageApprove : _tfStageAssign;
  m[sid] = (m[sid] || []).filter(function(n){ return n !== name; });
  _tfRender();
}
function _tfAddEl(sel){ _tfAdd(sel.getAttribute('data-k'), sel.getAttribute('data-s'), sel.value); }
function _tfRemoveEl(el){ _tfRemove(el.getAttribute('data-k'), el.getAttribute('data-s'), el.getAttribute('data-n')); }
// Chuỗi lỗi (rỗng = hợp lệ): mỗi giai đoạn phải có ít nhất 1 người thực hiện
function _tfValidate(){
  var f = _tfFlowById(_tfFlowId());
  if (!f) return '';
  for (var i = 0; i < f.stages.length; i++){
    var s = f.stages[i];
    if (!(_tfStageAssign[s.id] || []).length) return 'Giai đoạn "'+s.name+'" chưa có người thực hiện';
  }
  return '';
}
// Phần dữ liệu quy trình ghép vào object task khi lưu (js/26 saveTaskFromModal)
function _tfCollect(){
  var fid = _tfFlowId();
  if (!fid) return {};
  var f = _tfFlowById(fid), as = {}, ap = {};
  f.stages.forEach(function(s){
    as[s.id] = (_tfStageAssign[s.id] || []).slice();
    if (s.approval) ap[s.id] = (_tfStageApprove[s.id] || []).slice();
  });
  return { flowId: fid, stageAssignees: as, stageApprovers: ap };
}
(function(){
  var orig = window.openTaskModal;
  window.openTaskModal = function(id){
    orig.apply(this, arguments);
    var t = id ? allTasks.find(function(x){ return x.id === id; }) : null;
    _tfInit(t);
    if (!_tfLoaded) loadTaskFlows().then(function(){ _tfInit(t); });
  };
})();

// ═══ M3 — Modal chi tiết: thanh giai đoạn, nút Chuyển tiếp, yêu cầu duyệt ═══
// Admin: cùng cách nhận diện với menu trái (js/29-sidenav isAdm). Chỉ để HIỆN nút — server mới là nơi kiểm quyền thật.
function _tfIsAdmin(){
  try { return (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && !!_bootstrapAdmin); } catch(e){ return false; }
}
function _tfMe(){ return (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''; }

// Mô hình hiển thị thuần (không đụng DOM → test được). Trả null nếu việc không có quy trình.
function _tfStageModel(t, flow, me, nowMs){
  if (!t || !flow) return null;
  nowMs = nowMs || Date.now();
  var n = flow.stages.length, cur = t.stageIdx || 0, finished = cur >= n;
  var pend = (t.pendingReq || []).filter(function(q){ return q.status === 'pending' || !q.status; });
  var rows = flow.stages.map(function(s, i){
    var lg = null; (t.stageLog || []).forEach(function(l){ if (l.stageId === s.id) lg = l; });
    var st = i < cur ? 'done' : (i === cur && !finished ? 'current' : 'todo');
    var hours = null;
    if (lg && lg.startedAt){
      var end = lg.doneAt ? new Date(lg.doneAt).getTime() : nowMs;
      hours = Math.max(0, (end - new Date(lg.startedAt).getTime()) / 3600000);
    }
    return { id: s.id, name: s.name, approval: !!s.approval, state: st,
      assignees: (t.stageAssignees || {})[s.id] || [], approvers: (t.stageApprovers || {})[s.id] || [],
      startedAt: lg && lg.startedAt || '', doneAt: lg && lg.doneAt || '', by: lg && lg.by || '', approvedBy: lg && lg.approvedBy || '', hours: hours };
  });
  var curRow = finished ? null : rows[cur];
  var canAdvance = !!(curRow && !pend.length && me && (curRow.assignees.indexOf(me) !== -1 || t.createdBy === me));
  return { finished: finished, curIdx: cur, rows: rows, current: curRow, pending: pend, canAdvance: canAdvance,
    needsApproval: !!(curRow && curRow.approval),
    myApprovals: pend.filter(function(q){ return (q.approvers || []).indexOf(me) !== -1; }) };
}
function _tfFmtTime(iso){
  if (!iso) return '';
  var d = new Date(iso); if (isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' });
}
function _tfDetailHtml(t){
  var flow = _tfFlowById(t.flowId), m = _tfStageModel(t, flow, _tfMe());
  if (!m) return '';
  var bar = m.rows.map(function(r){
    return '<span class="tf-step tf-'+r.state+'" title="'+esc(r.name)+'">'+(r.state==='done'?'✓ ':'')+esc(r.name)+'</span>';
  }).join('');
  var html = '<div class="tf-bar">'+bar+(m.finished ? '<span class="tf-step tf-done">🏁 Hoàn thành</span>' : '')+'</div>';
  m.pending.forEach(function(q){
    var mine = (q.approvers || []).indexOf(_tfMe()) !== -1;
    html += '<div class="tf-req"><div>⏳ <b>'+esc(q.requestedBy)+'</b> xin chuyển tiếp'+(q.note ? ' — <i>'+esc(q.note)+'</i>' : '')+
      '<div class="tf-sub">Chờ duyệt: '+esc((q.approvers||[]).join(', '))+' · '+esc(_tfFmtTime(q.createdAt))+'</div></div>'+
      (mine ? '<div class="tf-actions"><button class="btn primary sm" onclick="_tfDecide(\''+esc(q.id)+'\',\'approve\')">✔ Chấp nhận</button> '+
              '<button class="btn secondary sm" onclick="_tfDecide(\''+esc(q.id)+'\',\'reject\')">✖ Từ chối</button></div>' : '')+'</div>';
  });
  if (m.current){
    html += '<div class="tf-cur"><div><b>Đang ở giai đoạn:</b> '+esc(m.current.name)+(m.current.approval ? ' <span class="tf-badge">cần duyệt</span>' : '')+
      '<div class="tf-sub">Người thực hiện: '+esc(m.current.assignees.join(', ') || '—')+'</div></div>';
    if (m.canAdvance){
      html += '<div class="tf-adv"><input type="text" id="tf-note" class="assign-input" placeholder="Ghi chú khi chuyển tiếp (không bắt buộc)">'+
        '<button class="btn primary" id="tf-adv-btn" onclick="_tfAdvance(\''+esc(t.id)+'\')">'+(m.needsApproval ? 'Gửi yêu cầu duyệt ➜' : 'Chuyển tiếp ➜')+'</button></div>';
    } else if (!m.pending.length){
      html += '<div class="tf-sub">Chỉ người phụ trách giai đoạn này mới bấm được “Chuyển tiếp”.</div>';
    }
    if (_tfIsAdmin() && !m.canAdvance){
      html += '<div class="tf-adv"><button class="btn secondary sm" onclick="_tfAdvance(\''+esc(t.id)+'\', true)">⚡ Ép chuyển tiếp (admin)</button></div>';
    }
    html += '</div>';
  }
  html += '<div class="tf-tl">'+m.rows.map(function(r, i){
    var tm = r.startedAt ? ('Bắt đầu '+_tfFmtTime(r.startedAt)+(r.doneAt ? ' · xong '+_tfFmtTime(r.doneAt) : '')+(r.hours!=null ? ' · '+r.hours.toFixed(2)+'h' : '')) : 'Chưa tới';
    return '<div class="tf-tl-row tf-'+r.state+'"><span class="tf-no">'+(i+1)+'</span><div><b>'+esc(r.name)+'</b>'+
      '<div class="tf-sub">'+esc(r.assignees.join(', ') || '—')+(r.state!=='done' && _tfCanReassign(t,m) ? ' <a class="tf-link" onclick="_tfReassignOpen(\''+esc(t.id)+'\',\''+esc(r.id)+'\')">✏️ đổi người</a>' : '')+'</div>'+
      (r.approval ? '<div class="tf-sub">Duyệt: '+esc(r.approvers.join(', ') || 'người nhận giai đoạn kế tiếp')+'</div>' : '')+'<div class="tf-sub">'+esc(tm)+(r.approvedBy ? ' · duyệt bởi '+esc(r.approvedBy) : '')+'</div></div></div>';
  }).join('')+'</div>';
  return html;
}
function _tfRenderDetail(id){
  var box = document.getElementById('task-detail-flow');
  if (!box) return;
  var t = allTasks.find(function(x){ return x.id === id; });
  box.innerHTML = t && t.flowId ? _tfDetailHtml(t) : '';
  if (t && t.flowId){
    var f = _tfFlowById(t.flowId), m = _tfStageModel(t, f, _tfMe());
    if (m && m.current){
      var csEl = document.getElementById('task-detail-cs');
      if (csEl) csEl.textContent = m.current.assignees.join(', ') || '—';   // "Người thực thi" = người của giai đoạn hiện tại
    }
  }
}
async function _tfRefreshDetail(id){
  await loadTasks();
  _tfRenderDetail(id);
  var t = allTasks.find(function(x){ return x.id === id; });
  if (t){ document.getElementById('task-detail-status-wrap').innerHTML = _taskStatusBadge(t.status); }
  loadTaskComments(id);
}
async function _tfPost(payload){
  var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(payload) });
  return await r.json();
}
async function _tfAdvance(id, force){
  if (force && !confirm('Ép chuyển công việc sang giai đoạn kế tiếp? Mọi yêu cầu duyệt đang chờ sẽ bị hủy.')) return;
  var btn = document.getElementById('tf-adv-btn'); if (btn){ btn.disabled = true; btn.textContent = 'Đang xử lý...'; }
  try{
    var note = (document.getElementById('tf-note') || {}).value || '';
    var d = await _tfPost({ action:'taskAdvance', taskId:id, by:_tfMe(), note:note.trim(), force:!!force });
    if (d && d.error){ alert(d.error); }
    else if (d && d.pending){ alert('Đã gửi yêu cầu duyệt. Công việc sẽ chuyển tiếp khi người duyệt chấp nhận.'); }
  }catch(e){ alert('Lỗi kết nối, thử lại'); }
  await _tfRefreshDetail(id);
}
async function _tfDecide(reqId, decision){
  var note = '';
  if (decision === 'reject'){ note = prompt('Lý do từ chối (không bắt buộc):'); if (note === null) return; }
  try{
    var d = await _tfPost({ action:'taskRequestDecide', requestId:reqId, by:_tfMe(), decision:decision, note:(note||'').trim() });
    if (d && d.error) alert(d.error);
  }catch(e){ alert('Lỗi kết nối, thử lại'); }
  if (typeof _taskDetailId !== 'undefined' && _taskDetailId) await _tfRefreshDetail(_taskDetailId);
}
// Ai được đổi người phụ trách/người duyệt (chỉ để hiện link — server kiểm quyền thật): admin | người tạo | người đang phụ trách giai đoạn hiện tại
function _tfCanReassign(t, m){
  if (!t || !m || m.finished) return false;
  var me = _tfMe();
  return _tfIsAdmin() || (!!me && (t.createdBy === me || (m.current && m.current.assignees.indexOf(me) !== -1)));
}
var _tfRe = { taskId:'', stageId:'', approval:false, chosen:[], chosenAp:[] };
function _tfReassignOpen(taskId, stageId){
  var t = allTasks.find(function(x){ return x.id === taskId; }); if (!t) return;
  var f = _tfFlowById(t.flowId), st = f && f.stages.find(function(x){ return x.id === stageId; });
  _tfRe = { taskId:taskId, stageId:stageId, approval:!!(st && st.approval), chosen:((t.stageAssignees||{})[stageId]||[]).slice(), chosenAp:((t.stageApprovers||{})[stageId]||[]).slice() };
  var ov = document.getElementById('tf-re-overlay');
  if (!ov){
    ov = document.createElement('div'); ov.className = 'assign-modal-overlay'; ov.id = 'tf-re-overlay'; ov.style.zIndex = 10050;
    ov.innerHTML = '<div class="assign-modal" style="width:420px;max-height:85vh"><div class="assign-modal-hdr"><div class="assign-modal-title">✏️ Đổi người phụ trách</div>'+
      '<button class="close-btn" onclick="document.getElementById(\'tf-re-overlay\').classList.remove(\'open\')">✕</button></div>'+
      '<div class="assign-body" id="tf-re-body"></div></div>';
    document.body.appendChild(ov);
  }
  _tfReassignRender(); ov.classList.add('open');
}
function _tfReassignList(kind, label, chosen){
  var chips = _tfChipsHtml(kind, 'x', chosen).replace(/onclick="_tfRemoveEl\(this\)"/g, 'onclick="_tfReassignDel(this)"');
  return '<div class="tf-lbl">'+label+'</div><div class="tf-chips">'+chips+'</div>'+
    '<select class="assign-input tf-sel" data-k="'+kind+'" onchange="_tfReassignAdd(this)"><option value="">+ Thêm người…</option>'+
    _tfUserNames().filter(function(n){ return chosen.indexOf(n) === -1; }).map(function(n){ return '<option value="'+esc(n)+'">'+esc(n)+'</option>'; }).join('')+'</select>';
}
function _tfReassignRender(){
  var body = document.getElementById('tf-re-body'); if (!body) return;
  body.innerHTML = _tfReassignList('as', 'Người thực hiện', _tfRe.chosen) +
    (_tfRe.approval ? _tfReassignList('ap', 'Người duyệt <span class="tf-hint">(để trống = người nhận giai đoạn kế tiếp)</span>', _tfRe.chosenAp) : '')+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn secondary" onclick="document.getElementById(\'tf-re-overlay\').classList.remove(\'open\')">Hủy</button>'+
    '<button class="btn primary" id="tf-re-save" onclick="_tfReassignSave()">Lưu</button></div>';
}
function _tfReassignAdd(sel){
  var arr = sel.getAttribute('data-k') === 'ap' ? _tfRe.chosenAp : _tfRe.chosen;
  if (sel.value && arr.indexOf(sel.value) === -1){ arr.push(sel.value); _tfReassignRender(); }
}
function _tfReassignDel(el){
  var k = el.getAttribute('data-k'), n = el.getAttribute('data-n');
  if (k === 'ap') _tfRe.chosenAp = _tfRe.chosenAp.filter(function(x){ return x !== n; });
  else _tfRe.chosen = _tfRe.chosen.filter(function(x){ return x !== n; });
  _tfReassignRender();
}
async function _tfReassignSave(){
  if (!_tfRe.chosen.length){ alert('Cần ít nhất 1 người thực hiện'); return; }
  var btn = document.getElementById('tf-re-save'); if (btn){ btn.disabled = true; btn.textContent = 'Đang lưu...'; }
  var payload = { action:'taskReassign', taskId:_tfRe.taskId, stageId:_tfRe.stageId, assignees:_tfRe.chosen, by:_tfMe() };
  if (_tfRe.approval) payload.approvers = _tfRe.chosenAp;
  try{
    var d = await _tfPost(payload);
    if (d && d.error){ alert(d.error); if (btn){ btn.disabled = false; btn.textContent = 'Lưu'; } return; }
  }catch(e){ alert('Lỗi kết nối, thử lại'); if (btn){ btn.disabled = false; btn.textContent = 'Lưu'; } return; }
  document.getElementById('tf-re-overlay').classList.remove('open');
  await _tfRefreshDetail(_tfRe.taskId);
}
// Nhãn giai đoạn trong bảng danh sách công việc
function _tfListBadge(t){
  if (!t || !t.flowId) return '';
  var f = _tfFlowById(t.flowId); if (!f) return '';
  var i = t.stageIdx || 0;
  var s = i >= f.stages.length ? 'Hoàn thành' : f.stages[i].name;
  return ' <span class="tf-badge tf-badge-st">'+esc(s)+'</span>'+((t.pendingReq||[]).length ? ' <span class="tf-badge">⏳ chờ duyệt</span>' : '');
}
(function(){
  var orig = window.openTaskDetailModal;
  window.openTaskDetailModal = function(id){
    orig.apply(this, arguments);
    _tfRenderDetail(id);
    if (!_tfLoaded) loadTaskFlows().then(function(){ _tfRenderDetail(id); });
  };
})();

// ═══ M4 — Thảo luận: dòng hệ thống/yêu cầu, tệp bất kỳ, tab Tài liệu đính kèm ═══
var _TF_MAX_FILE = 10 * 1024 * 1024;   // 10MB/tệp (base64 qua GAS POST; lớn hơn dễ lỗi/timeout)
function _tfHighlight(content, mentions){
  var h = esc(content || '');
  (mentions || []).slice().sort(function(a,b){ return b.length - a.length; }).forEach(function(n){
    var key = esc('@' + n);
    h = h.split(key).join('<span class="tf-mention">'+key+'</span>');
  });
  return h;
}
function _tfIsImage(f){ return /^image\//.test((f && (f.mime || (f.file && f.file.type))) || ''); }
function _tfCommentHtml(c){
  var when = c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' }) : '';
  if (c.kind === 'system' || c.kind === 'request'){
    return '<div class="tf-sys'+(c.kind==='request'?' tf-sys-req':'')+'">'+(c.kind==='request'?'⏳':'⚙')+' <b>'+esc(c.author||'')+'</b> '+esc(c.content||'')+
      '<span class="tf-sys-time">'+when+'</span></div>';
  }
  var initial = (c.author || '?').trim().charAt(0).toUpperCase();
  var imgs = (c.images||[]).map(function(u){ return '<img src="'+esc(u)+'" class="task-cm-img" data-img-url="'+esc(u)+'">'; }).join('');
  var files = (c.files||[]).map(function(f){
    return '<a class="tf-file" href="'+esc(f.url)+'" target="_blank" rel="noopener">📎 '+esc(f.name||'Tệp')+(f.size?' <span class="tf-sub">('+Math.max(1,Math.round(f.size/1024))+' KB)</span>':'')+'</a>';
  }).join('');
  return '<div class="task-cm-item"><div class="task-cm-avatar">'+esc(initial)+'</div><div class="task-cm-bubble">'+
    '<div style="font-weight:700;font-size:12px">'+esc(c.author||'Ẩn danh')+'</div>'+
    (c.content ? '<div style="font-size:12.5px;white-space:pre-wrap;margin-top:2px">'+_tfHighlight(c.content, c.mentions)+'</div>' : '')+
    imgs+files+'<div style="font-size:10px;color:var(--muted);margin-top:4px">'+when+'</div></div></div>';
}
// Ghi đè renderTaskComments (js/26): thêm dòng hệ thống/yêu cầu, tệp, tô màu tag
window.renderTaskComments = function(){
  var listEl = document.getElementById('task-cm-list');
  var cntEl = document.getElementById('task-detail-cm-count');
  var real = allTaskComments.filter(function(c){ return !c.kind || c.kind === 'comment'; });
  cntEl.textContent = real.length ? '('+real.length+')' : '';
  listEl.innerHTML = allTaskComments.map(_tfCommentHtml).join('') ||
    '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Chưa có thảo luận nào</div>';
  listEl.querySelectorAll('.task-cm-img').forEach(function(img){
    img.addEventListener('click', function(){ window.open(img.getAttribute('data-img-url'), '_blank'); });
  });
  listEl.scrollTop = listEl.scrollHeight;
  _tfRenderAttachments();
};
// Chọn tệp bất kỳ (ảnh hoặc tài liệu); chặn tệp quá lớn
window._taskCmAddImages = function(files){
  Array.from(files || []).forEach(function(file){
    if (file.size > _TF_MAX_FILE){ alert('Tệp "'+file.name+'" lớn hơn 10MB, không gửi được'); return; }
    var reader = new FileReader();
    reader.onload = function(ev){
      _taskCmPendingImages.push({ file: file, dataUrl: ev.target.result });
      _renderTaskCmPendingImages();
    };
    reader.readAsDataURL(file);
  });
};
window._renderTaskCmPendingImages = function(){
  var wrap = document.getElementById('task-cm-pending-images');
  wrap.innerHTML = _taskCmPendingImages.map(function(it, idx){
    var rm = '<span onclick="_taskCmRemoveImage('+idx+')" style="position:absolute;top:-5px;right:-5px;background:#dc2626;color:#fff;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>';
    if (_tfIsImage(it)) return '<div style="position:relative"><img src="'+esc(it.dataUrl)+'" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">'+rm+'</div>';
    return '<div style="position:relative" class="tf-chip">📎 '+esc((it.file && it.file.name) || 'Tệp')+rm+'</div>';
  }).join('');
};
// Tải 1 mục lên Drive (qua action uploadBroadcastImg — nhận mọi mime); trả {name,url,mime,size}
async function _tfUploadItem(it){
  var base64 = it.dataUrl.split(',')[1];
  var mime = (it.file && it.file.type) || 'application/octet-stream';
  var name = (it.file && it.file.name) || ('file_'+Date.now());
  var d = await _tfPost({ action:'uploadBroadcastImg', base64:base64, filename:name, mimeType:mime });
  if (!d || !d.ok) throw new Error((d && d.error) || 'Tải tệp lỗi');
  var url = /^image\//.test(mime) ? d.url : ('https://drive.google.com/file/d/'+d.fileId+'/view');
  return { name:name, url:url, mime:mime, size:(it.file && it.file.size) || 0 };
}
// Người được tag KHÔNG gửi từ client: server tự đọc @tên trong nội dung (saveTaskComment_)
window.sendTaskComment = async function(){
  var input = document.getElementById('task-cm-input');
  var content = input.value.trim();
  if (!content && !_taskCmPendingImages.length) return;
  if (!gsUrl || !_taskDetailId) return;
  var sendBtn = document.querySelector('#task-cm-footer .btn.primary');
  if (sendBtn) sendBtn.disabled = true;
  try{
    var images = [], files = [];
    for (var i = 0; i < _taskCmPendingImages.length; i++){
      var up = await _tfUploadItem(_taskCmPendingImages[i]);
      if (/^image\//.test(up.mime)) images.push(up.url); else files.push(up);
    }
    var comment = { taskId:_taskDetailId, author:_tfMe() || 'Ẩn danh', content:content, images:images, files:files };
    var d = await _tfPost({ action:'saveTaskComment', comment:comment });
    if (d && d.error){ alert(d.error); return; }
  }catch(e){ alert('Gửi không được: '+(e && e.message || e)); return; }
  finally{ if (sendBtn) sendBtn.disabled = false; }
  input.value = '';
  _taskCmPendingImages = [];
  _renderTaskCmPendingImages();
  loadTaskComments(_taskDetailId);
};
// ── Tab "Tài liệu đính kèm": ảnh/tệp từ mô tả công việc + thảo luận ──
function _tfCollectAttachments(task, comments){
  var out = [];
  ((task && task.images) || []).forEach(function(u){ out.push({ kind:'image', url:u, name:'Ảnh mô tả', by:(task && task.createdBy) || '', at:(task && task.createdAt) || '' }); });
  (comments || []).forEach(function(c){
    (c.images || []).forEach(function(u){ out.push({ kind:'image', url:u, name:'Ảnh thảo luận', by:c.author, at:c.createdAt }); });
    (c.files || []).forEach(function(f){ out.push({ kind:'file', url:f.url, name:f.name || 'Tệp', size:f.size || 0, by:c.author, at:c.createdAt }); });
  });
  return out;
}
function _tfRenderAttachments(){
  var box = document.getElementById('task-detail-files-list'); if (!box) return;
  var t = allTasks.find(function(x){ return x.id === _taskDetailId; });
  var items = _tfCollectAttachments(t, allTaskComments);
  var cnt = document.getElementById('task-detail-files-count'); if (cnt) cnt.textContent = items.length ? '('+items.length+')' : '';
  var imgs = items.filter(function(i){ return i.kind === 'image'; }), files = items.filter(function(i){ return i.kind === 'file'; });
  box.innerHTML = !items.length ? '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Chưa có tài liệu đính kèm</div>' :
    (imgs.length ? '<div class="tf-grid">'+imgs.map(function(i){ return '<a href="'+esc(i.url)+'" target="_blank" rel="noopener" title="'+esc(i.by)+'"><img src="'+esc(i.url)+'"></a>'; }).join('')+'</div>' : '')+
    files.map(function(i){ return '<div class="tf-tl-row"><a class="tf-file" href="'+esc(i.url)+'" target="_blank" rel="noopener">📎 '+esc(i.name)+'</a><span class="tf-sub">'+esc(i.by)+' · '+esc(_tfFmtTime(i.at))+'</span></div>'; }).join('');
}
(function(){
  var orig = window.switchTaskDetailTab;
  window.switchTaskDetailTab = function(which){
    var fv = document.getElementById('task-detail-view-files'), ft = document.getElementById('task-detail-tab-files');
    if (which === 'files'){
      orig('overview');
      document.getElementById('task-detail-view-overview').style.display = 'none';
      document.getElementById('task-detail-tab-overview').classList.remove('active');
      if (fv) fv.style.display = 'block'; if (ft) ft.classList.add('active');
      _tfRenderAttachments();
    } else {
      if (fv) fv.style.display = 'none'; if (ft) ft.classList.remove('active');
      orig(which);
    }
  };
})();

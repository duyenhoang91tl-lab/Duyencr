// Công việc kiểu Base — quản lý loại quy trình (menu trái ⚙, admin) + bộ lọc "việc cần tôi".
// Nạp SAU 44-fn-taskflow.js. Backend: GAS saveTaskFlow/deleteTaskFlow (chặn đổi cấu trúc khi quy trình đang có việc dùng).
var _tfm = { draft: null };   // draft = { id, name, stages:[{id,name,approval}], used }

// ── Hàm thuần (test được) ──
function _tfmUsedCount(flowId){ return allTasks.filter(function(t){ return t.flowId === flowId; }).length; }
function _tfmMoveStage(stages, i, d){
  var j = i + d; if (j < 0 || j >= stages.length) return stages;
  var a = stages.slice(); var x = a[i]; a[i] = a[j]; a[j] = x; return a;
}
function _tfmValidate(draft){
  if (!draft || !String(draft.name || '').trim()) return 'Nhập tên quy trình';
  var st = (draft.stages || []).filter(function(s){ return String(s.name || '').trim(); });
  if (!st.length) return 'Cần ít nhất 1 giai đoạn';
  var seen = {};
  for (var i = 0; i < st.length; i++){
    var k = st[i].name.trim().toLowerCase();
    if (seen[k]) return 'Trùng tên giai đoạn: ' + st[i].name.trim();
    seen[k] = 1;
  }
  return '';
}
// Nhân bản: bỏ id (server cấp mới) để quy trình mới độc lập với việc đang chạy
function _tfmCloneDraft(flow){
  return { id: '', name: flow.name + ' (bản sao)', used: 0,
    stages: flow.stages.map(function(s){ return { id: '', name: s.name, approval: !!s.approval }; }) };
}
// "Việc cần tôi": undefined = không áp dụng bộ lọc này (để js/26 xử lý như cũ), true/false = khớp hay không
function _tfScopeMatch(t, scope, me){
  if (scope !== 'waitMe' && scope !== 'approveMe' && scope !== 'taggedMe') return undefined;
  if (!me) return false;
  if (scope === 'taggedMe') return (t.mentions || []).indexOf(me) !== -1;
  if (scope === 'approveMe') return (t.pendingReq || []).some(function(q){ return (q.approvers || []).indexOf(me) !== -1; });
  if (!t.flowId || t.status === 'Hoàn thành' || (t.pendingReq || []).length) return false;
  var f = _tfFlowById(t.flowId); if (!f) return false;
  var cur = f.stages[t.stageIdx || 0]; if (!cur) return false;
  return ((t.stageAssignees || {})[cur.id] || []).indexOf(me) !== -1;
}
function _tfCounts(tasks, me){
  var c = { waitMe: 0, approveMe: 0, taggedMe: 0 };
  (tasks || []).forEach(function(t){ Object.keys(c).forEach(function(k){ if (_tfScopeMatch(t, k, me) === true) c[k]++; }); });
  return c;
}
// Cập nhật số đếm trên các tab lọc sau mỗi lần vẽ bảng
(function(){
  var orig = window.renderTaskTables;
  window.renderTaskTables = function(){
    orig.apply(this, arguments);
    var c = _tfCounts(allTasks, _tfMe());
    document.querySelectorAll('#task-scope-tabs .assign-tab[data-scope]').forEach(function(el){
      var k = el.getAttribute('data-scope');
      if (!(k in c)) return;
      if (!el.getAttribute('data-label')) el.setAttribute('data-label', el.textContent);
      el.textContent = el.getAttribute('data-label') + (c[k] ? ' (' + c[k] + ')' : '');
    });
  };
})();

// ── Màn quản lý quy trình ──
function _tfmOverlay(){
  var ov = document.getElementById('tf-mgr-overlay');
  if (!ov){
    ov = document.createElement('div'); ov.className = 'assign-modal-overlay'; ov.id = 'tf-mgr-overlay';
    ov.innerHTML = '<div class="assign-modal" style="width:560px;max-height:90vh"><div class="assign-modal-hdr"><div class="assign-modal-title">🧩 Quy trình công việc</div>'+
      '<button class="close-btn" onclick="closeTaskFlowManager()">✕</button></div><div class="assign-body" id="tf-mgr-body"></div></div>';
    document.body.appendChild(ov);
  }
  return ov;
}
async function openTaskFlowManager(){
  _tfmOverlay().classList.add('open');
  document.getElementById('tf-mgr-body').innerHTML = '<div class="tf-sub" style="padding:16px;text-align:center">Đang tải...</div>';
  await Promise.all([loadTaskFlows(true), (allTasks.length ? Promise.resolve() : loadTasks())]);
  _tfm.draft = null; _tfmRender();
}
function closeTaskFlowManager(){ var ov = document.getElementById('tf-mgr-overlay'); if (ov) ov.classList.remove('open'); }
function _tfmRender(){
  var body = document.getElementById('tf-mgr-body'); if (!body) return;
  var d = _tfm.draft;
  if (!d){
    body.innerHTML = allTaskFlows.map(function(f){
      var used = _tfmUsedCount(f.id);
      return '<div class="tf-stage"><div class="tf-stage-hd"><b>'+esc(f.name)+'</b><span class="tf-sub">'+f.stages.length+' giai đoạn'+(used ? ' · '+used+' việc đang dùng' : '')+'</span></div>'+
        '<div class="tf-bar">'+f.stages.map(function(s){ return '<span class="tf-step">'+esc(s.name)+(s.approval ? ' 🔒' : '')+'</span>'; }).join('')+'</div>'+
        '<div class="tf-actions"><button class="btn secondary sm" data-id="'+esc(f.id)+'" onclick="_tfmEdit(this.getAttribute(\'data-id\'))">✏️ Sửa</button> '+
        '<button class="btn secondary sm" data-id="'+esc(f.id)+'" onclick="_tfmClone(this.getAttribute(\'data-id\'))">⧉ Nhân bản</button> '+
        '<button class="btn secondary sm" data-id="'+esc(f.id)+'" onclick="_tfmDelete(this.getAttribute(\'data-id\'))">🗑️ Xóa</button></div></div>';
    }).join('') + '<button class="btn primary sm" onclick="_tfmNew()">+ Tạo quy trình mới</button>'+
      '<div class="tf-sub" style="margin-top:8px">🔒 = rời giai đoạn này phải được người duyệt chấp nhận.</div>';
    return;
  }
  var locked = d.used > 0;
  body.innerHTML = '<div class="assign-form-row"><div class="assign-form-label">Tên quy trình</div><input class="assign-input" style="flex:1" value="'+esc(d.name)+'" oninput="_tfm.draft.name=this.value"></div>'+
    (locked ? '<div class="tf-req" style="margin-bottom:8px">🔒 Có '+d.used+' công việc đang dùng quy trình này → chỉ đổi được <b>tên giai đoạn</b> và ô <b>cần duyệt</b>. Muốn thêm/xóa/đổi thứ tự hãy bấm “Nhân bản”.</div>' : '')+
    d.stages.map(function(s, i){
      return '<div class="tf-edit-row"><span class="tf-no">'+(i+1)+'</span>'+
        '<input class="assign-input" style="flex:1;min-width:0" value="'+esc(s.name)+'" placeholder="Tên giai đoạn" oninput="_tfm.draft.stages['+i+'].name=this.value">'+
        '<label class="tf-sub" style="white-space:nowrap"><input type="checkbox" '+(s.approval ? 'checked' : '')+' onchange="_tfm.draft.stages['+i+'].approval=this.checked"> cần duyệt</label>'+
        (locked ? '' : '<span class="tf-ic" onclick="_tfmMove('+i+',-1)" title="Lên">↑</span><span class="tf-ic" onclick="_tfmMove('+i+',1)" title="Xuống">↓</span><span class="tf-ic" style="color:#dc2626" onclick="_tfmDelStage('+i+')" title="Xóa">✕</span>')+'</div>';
    }).join('')+
    (locked ? '' : '<button class="btn secondary sm" onclick="_tfmAddStage()">+ Thêm giai đoạn</button>')+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn secondary" onclick="_tfm.draft=null;_tfmRender()">Hủy</button>'+
    '<button class="btn primary" id="tf-mgr-save" onclick="_tfmSave()">Lưu</button></div>';
}
function _tfmNew(){ _tfm.draft = { id:'', name:'', used:0, stages:[{ id:'', name:'', approval:false }] }; _tfmRender(); }
function _tfmEdit(id){
  var f = _tfFlowById(id); if (!f) return;
  _tfm.draft = { id:f.id, name:f.name, used:_tfmUsedCount(id), stages:f.stages.map(function(s){ return { id:s.id, name:s.name, approval:!!s.approval }; }) };
  _tfmRender();
}
function _tfmClone(id){ var f = _tfFlowById(id); if (!f) return; _tfm.draft = _tfmCloneDraft(f); _tfmRender(); }
function _tfmAddStage(){ _tfm.draft.stages.push({ id:'', name:'', approval:false }); _tfmRender(); }
function _tfmDelStage(i){ if (_tfm.draft.stages.length > 1){ _tfm.draft.stages.splice(i, 1); _tfmRender(); } }
function _tfmMove(i, d){ _tfm.draft.stages = _tfmMoveStage(_tfm.draft.stages, i, d); _tfmRender(); }
async function _tfmSave(){
  var err = _tfmValidate(_tfm.draft); if (err){ alert(err); return; }
  var btn = document.getElementById('tf-mgr-save'); if (btn){ btn.disabled = true; btn.textContent = 'Đang lưu...'; }
  try{
    var d = _tfm.draft;
    var r = await _tfPost({ action:'saveTaskFlow', flow:{ id:d.id, name:d.name.trim(), createdBy:_tfMe(),
      stages:d.stages.filter(function(s){ return s.name.trim(); }).map(function(s){ return { id:s.id, name:s.name.trim(), approval:!!s.approval }; }) } });
    if (r && r.error){ alert(r.error); if (btn){ btn.disabled = false; btn.textContent = 'Lưu'; } return; }
  }catch(e){ alert('Lỗi kết nối, thử lại'); if (btn){ btn.disabled = false; btn.textContent = 'Lưu'; } return; }
  await loadTaskFlows(true); _tfm.draft = null; _tfmRender();
}
async function _tfmDelete(id){
  if (!confirm('Xóa quy trình này?')) return;
  try{ var r = await _tfPost({ action:'deleteTaskFlow', id:id }); if (r && r.error){ alert(r.error); return; } }
  catch(e){ alert('Lỗi kết nối, thử lại'); return; }
  await loadTaskFlows(true); _tfmRender();
}

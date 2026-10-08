
var allTasks = [];
var _taskEditId = null;
var _taskSelectedCS = new Set();
var _taskPendingImages = [];   // {file, dataUrl} — ảnh đang chọn trong modal tạo/sửa
var _taskScope = 'mine';       // mine | createdByMe | all
var _taskStatusFilter = 'all'; // all | Đang làm | Hoàn thành | overdue
var _taskDetailId = null;
var _taskCmPendingImages = []; // {file, dataUrl} — ảnh đang chọn trong ô thảo luận
var allTaskComments = [];
var _taskSelectedTeams = new Set();
var _taskIsAdmin = false;

async function loadTasks(){
  if (!gsUrl) return;
  try{
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=tasks', { redirect:'follow' });
    var d = await r.json();
    if (d && Array.isArray(d.tasks)) allTasks = d.tasks;
  }catch(e){ console.warn('loadTasks failed:', e); }
  renderTaskTables();
}

function _taskIsOverdue(t){
  if (!t.deadline || t.status === 'Hoàn thành') return false;
  var dl = new Date(t.deadline); dl.setHours(23,59,59,999);
  return dl.getTime() < Date.now();
}

function setTaskScope(scope, el){
  _taskScope = scope;
  document.querySelectorAll('#task-scope-tabs .assign-tab').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
  renderTaskTables();
}
function setTaskStatusFilter(st, el){
  _taskStatusFilter = st;
  document.querySelectorAll('.task-status-tab').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
  renderTaskTables();
}

function renderTaskTables(){
  var myName = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '';
  var q = (document.getElementById('task-search') ? document.getElementById('task-search').value : '').trim().toLowerCase();

  var filtered = allTasks.filter(function(t){
    if (_taskScope === 'mine' && myName && (t.csAssigned||[]).indexOf(myName) === -1) return false;
    if (_taskScope === 'createdByMe' && myName && t.createdBy !== myName) return false;
    if (_taskStatusFilter === 'overdue' && !_taskIsOverdue(t)) return false;
    if (_taskStatusFilter === 'Đang làm' && t.status !== 'Đang làm') return false;
    if (_taskStatusFilter === 'Hoàn thành' && t.status !== 'Hoàn thành') return false;
    if (q && (t.title||'').toLowerCase().indexOf(q) === -1 && (t.description||'').toLowerCase().indexOf(q) === -1) return false;
    return true;
  });

  txt('tb-task', allTasks.length);

  var tbM = document.getElementById('task-manage-tbody');
  if (tbM){
    tbM.innerHTML = filtered.map(function(t){
      var overdue = _taskIsOverdue(t);
      return '<tr style="cursor:pointer" onclick="openTaskDetailModal(\''+t.id+'\')">'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+esc(t.title)+
          (overdue ? ' <span class="assign-badge-pill has-assign">Quá hạn</span>' : '')+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border);color:var(--muted)">'+(esc(t.result||'') || '—')+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+
          (t.csAssigned||[]).map(function(n){ return '<span class="assign-badge-pill">'+esc(n)+'</span>'; }).join('') +
          ((t.csAssigned||[]).length ? '' : '<span style="color:var(--muted)">—</span>') + '</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+esc(t.deadline||'—')+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+_taskStatusBadge(t.status)+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border);white-space:nowrap" onclick="event.stopPropagation()">'+
          '<span style="cursor:pointer;margin-right:8px" title="Sửa" onclick="openTaskModal(\''+t.id+'\')">✏️</span>'+
          '<span style="cursor:pointer" title="Xóa" onclick="deleteTaskUI(\''+t.id+'\')">🗑️</span></td>'+
      '</tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Không có công việc nào'+(allTasks.length?' khớp bộ lọc':' — bấm "+ Tạo công việc" để bắt đầu')+'</td></tr>';
  }

  var tbT = document.getElementById('task-track-tbody');
  if (tbT){
    var byCS = {};
    allTasks.forEach(function(t){
      var list = (t.csAssigned && t.csAssigned.length) ? t.csAssigned : ['(chưa gán)'];
      list.forEach(function(cs){
        if (!byCS[cs]) byCS[cs] = { todo:0, doing:0, done:0, soon:0 };
        if (t.status==='Hoàn thành') byCS[cs].done++;
        else if (t.status==='Đang làm') byCS[cs].doing++;
        else byCS[cs].todo++;
        if (t.deadline && t.status!=='Hoàn thành'){
          var dl = new Date(t.deadline);
          var diffDays = Math.ceil((dl - new Date().setHours(0,0,0,0)) / 86400000);
          if (diffDays <= 2) byCS[cs].soon++;
        }
      });
    });
    var names = Object.keys(byCS).sort(function(a,b){ return a.localeCompare(b,'vi'); });
    tbT.innerHTML = names.map(function(cs){
      var s = byCS[cs]; var total = s.todo + s.doing + s.done;
      return '<tr>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+esc(cs)+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+s.todo+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+s.doing+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+s.done+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)"><strong>'+total+'</strong></td>'+
        '<td style="padding:8px;border-bottom:1px solid var(--border)">'+
          (s.soon>0 ? '<span class="assign-badge-pill has-assign">'+s.soon+' gần hạn</span>' : '<span style="color:var(--muted)">—</span>')+'</td>'+
      '</tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Chưa có dữ liệu</td></tr>';
  }
}

function _taskStatusBadge(st){
  st = st || 'Chưa làm';
  var color = st==='Hoàn thành' ? 'var(--green)' : st==='Đang làm' ? '#2563eb' : 'var(--muted)';
  var bg    = st==='Hoàn thành' ? 'var(--green-bg)' : st==='Đang làm' ? '#dbeafe' : 'var(--surface2)';
  return '<span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;color:'+color+';background:'+bg+'">'+esc(st)+'</span>';
}

function switchTaskSubTab(which){
  document.getElementById('task-subtab-manage').classList.toggle('active', which==='manage');
  document.getElementById('task-subtab-track').classList.toggle('active', which==='track');
  document.getElementById('task-view-manage').style.display = which==='manage' ? 'flex' : 'none';
  document.getElementById('task-view-track').style.display  = which==='track'  ? 'block' : 'none';
}

// ── MODAL TẠO/SỬA ──────────────────────────────────────────────
function openTaskModal(id){
  _taskEditId = id || null;
  _taskSelectedCS = new Set();
  _taskPendingImages = [];
  _taskSelectedTeams = new Set();
  var t = id ? allTasks.find(function(x){ return x.id===id; }) : null;

  document.getElementById('task-modal-title').textContent = t ? 'Sửa công việc' : 'Tạo công việc';
  document.getElementById('task-f-title').value = t ? t.title : '';
  document.getElementById('task-f-desc').value = t ? t.description : '';
  document.getElementById('task-f-deadline').value = t ? t.deadline : '';
  document.getElementById('task-f-status').value = t ? t.status : 'Chưa làm';
  document.getElementById('task-f-result').value = t ? (t.result||'') : '';
  var teamSearchEl = document.getElementById('task-f-team-search'); if (teamSearchEl) teamSearchEl.value = '';
  var csSearchEl = document.getElementById('task-f-cs-search'); if (csSearchEl) csSearchEl.value = '';
  if (t) (t.csAssigned||[]).forEach(function(n){ _taskSelectedCS.add(n); });
  if (t) (t.images||[]).forEach(function(u){ _taskPendingImages.push({ url: u }); });
  _renderTaskFormImages();

  // Suy ra Team đã chọn: ưu tiên teamsAssigned đã lưu, nếu không có thì suy từ csAssigned
  if (t && Array.isArray(t.teamsAssigned) && t.teamsAssigned.length){
    t.teamsAssigned.forEach(function(tn){ _taskSelectedTeams.add(tn); });
  } else if (t){
    (typeof teams !== 'undefined' ? teams : []).forEach(function(tm){
      var members = [tm.leader].concat(tm.members||[]).filter(Boolean);
      if (members.some(function(m){ return _taskSelectedCS.has(m); })) _taskSelectedTeams.add(tm.name);
    });
  }

  // Truoc day chi Admin moi duoc chon/doi nguoi tham gia — theo yeu cau Duyen, bo khoa nay de
  // MOI user tu giao duoc CS/Team khi tao/sua Cong viec.
  _taskIsAdmin = true;
  document.getElementById('task-f-perm-note').style.display = 'none';
  _taskRenderTeamChips();
  _taskRenderUserChips();

  document.getElementById('task-modal-overlay').classList.add('open');
}
function closeTaskModal(){ document.getElementById('task-modal-overlay').classList.remove('open'); }

function _taskAllUserNames(){
  // Danh sách user tổng: ưu tiên tài khoản đăng nhập (accounts), rồi bổ sung từ dữ liệu KH/lịch sử chia
  var set = new Set();
  (typeof accounts !== 'undefined' ? accounts : []).forEach(function(a){
    var n = (a && (a.name || a.username)) || '';
    if (n && a.role !== 'admin') set.add(n);
  });
  (typeof _allCSNames === 'function' ? _allCSNames() : []).forEach(function(n){ if (n) set.add(n); });
  return Array.from(set).sort(function(a,b){ return a.localeCompare(b,'vi'); });
}

function _taskRenderTeamChips(filter){
  if (filter === undefined){ var fi = document.getElementById('task-f-team-search'); filter = fi ? fi.value : ''; }
  var wrap = document.getElementById('task-f-team');
  var list = (typeof teams !== 'undefined' ? teams : []);
  if (!list.length){
    wrap.innerHTML = '<div style="color:var(--muted);font-size:12px">Chưa có Team nào — chọn trực tiếp user bên dưới</div>';
    return;
  }
  var q = _foldVi(filter||'');
  var filtered = q ? list.filter(function(tm){ return _foldVi(tm.name||'').indexOf(q)!==-1; }) : list;
  if (!filtered.length){
    wrap.innerHTML = '<div style="color:var(--muted);font-size:12px">Không tìm thấy Team nào khớp "'+esc(filter)+'"</div>';
    return;
  }
  wrap.innerHTML = filtered.map(function(tm){
    var sel = _taskSelectedTeams.has(tm.name);
    return '<div class="assign-cs-chip-multi'+(sel?' selected':'')+'" data-name="'+esc(tm.name)+'"'+
      (_taskIsAdmin ? ' onclick="_taskToggleTeam(this,this.dataset.name)"' : ' style="cursor:default;opacity:.6"')+
      '>'+esc(tm.name)+'</div>';
  }).join('');
}

function _taskRenderUserChips(filter){
  if (filter === undefined){ var fi = document.getElementById('task-f-cs-search'); filter = fi ? fi.value : ''; }
  var wrap = document.getElementById('task-f-cs');
  var noTeams = !(typeof teams !== 'undefined' && teams.length);
  var pool = new Set();

  if (noTeams){
    // Không có Team nào → cho chọn thẳng user (multi-select) từ toàn bộ danh sách user
    _taskAllUserNames().forEach(function(n){ pool.add(n); });
  } else {
    (typeof teams !== 'undefined' ? teams : []).forEach(function(tm){
      if (!_taskSelectedTeams.has(tm.name)) return;
      if (tm.leader) pool.add(tm.leader);
      (tm.members||[]).forEach(function(m){ if (m) pool.add(m); });
    });
  }
  // Bỏ chọn user không còn thuộc phạm vi hiện tại (team đã chọn, hoặc danh sách chung nếu không có team)
  Array.from(_taskSelectedCS).forEach(function(n){ if (!pool.has(n)) _taskSelectedCS.delete(n); });

  var names = Array.from(pool).sort(function(a,b){ return a.localeCompare(b,'vi'); });
  if (!names.length){
    wrap.innerHTML = '<div style="color:var(--muted);font-size:12px">'+
      (noTeams ? 'Chưa có user nào (thêm ở mục Tài khoản trước)'
        : (_taskSelectedTeams.size ? 'Team đã chọn chưa có thành viên' : 'Chọn Team ở trên trước để hiện danh sách user'))+
      '</div>';
    return;
  }
  var q = _foldVi(filter||'');
  var filteredNames = q ? names.filter(function(n){ return _foldVi(n).indexOf(q)!==-1; }) : names;
  if (!filteredNames.length){
    wrap.innerHTML = '<div style="color:var(--muted);font-size:12px">Không tìm thấy user nào khớp "'+esc(filter)+'"</div>';
    return;
  }
  wrap.innerHTML = filteredNames.map(function(n){
    var sel = _taskSelectedCS.has(n);
    return '<div class="assign-cs-chip-multi'+(sel?' selected':'')+'" data-name="'+esc(n)+'"'+
      (_taskIsAdmin ? ' onclick="_taskToggleCS(this,this.dataset.name)"' : ' style="cursor:default;opacity:.6"')+
      '>'+esc(n)+'</div>';
  }).join('');
}

function _taskToggleTeam(el, name){
  if (!_taskIsAdmin) return;
  if (_taskSelectedTeams.has(name)) _taskSelectedTeams.delete(name); else _taskSelectedTeams.add(name);
  el.classList.toggle('selected');
  _taskRenderUserChips();
}
function _taskToggleCS(el, name){
  if (!_taskIsAdmin) return;
  if (_taskSelectedCS.has(name)) _taskSelectedCS.delete(name); else _taskSelectedCS.add(name);
  el.classList.toggle('selected');
}

function _taskAddImages(files){
  Array.from(files || []).forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(ev){
      _taskPendingImages.push({ file: file, dataUrl: ev.target.result });
      _renderTaskFormImages();
    };
    reader.readAsDataURL(file);
  });
}
function _renderTaskFormImages(){
  var wrap = document.getElementById('task-f-images');
  wrap.innerHTML = _taskPendingImages.map(function(img, idx){
    var src = img.url || img.dataUrl;
    return '<div style="position:relative">'+
      '<img src="'+esc(src)+'" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">'+
      '<span onclick="_taskRemoveImage('+idx+')" style="position:absolute;top:-6px;right:-6px;background:#dc2626;color:#fff;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>'+
    '</div>';
  }).join('');
}
function _taskRemoveImage(idx){ _taskPendingImages.splice(idx,1); _renderTaskFormImages(); }

async function _uploadImagesToDrive(images){
  // images: array of {file,dataUrl} (chưa upload) hoặc {url} (đã có sẵn) → trả về mảng URL
  var urls = [];
  for (var i = 0; i < images.length; i++){
    if (images[i].url){ urls.push(images[i].url); continue; }
    try{
      var base64 = images[i].dataUrl.split(',')[1];
      var mimeType = (images[i].file && images[i].file.type) || 'image/jpeg';
      var fname = (images[i].file && images[i].file.name) || ('img_'+Date.now()+'.jpg');
      var r = await fetch(gsUrl, {
        method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'uploadBroadcastImg', base64: base64, filename: fname, mimeType: mimeType })
      });
      var d = await r.json();
      if (d.ok && d.url) urls.push(d.url);
    }catch(e){ console.warn('Upload ảnh lỗi:', e); }
  }
  return urls;
}

async function saveTaskFromModal(){
  var title = document.getElementById('task-f-title').value.trim();
  if (!title){ alert('Nhập tên công việc'); return; }
  if (!gsUrl){ alert('Chưa kết nối Google Sheets'); return; }
  var saveBtn = document.querySelector('#task-modal-overlay .assign-footer .btn.primary');
  if (saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...'; }
  try{
    var imageUrls = await _uploadImagesToDrive(_taskPendingImages);
    var task = {
      id: _taskEditId,
      title: title,
      description: document.getElementById('task-f-desc').value.trim(),
      deadline: document.getElementById('task-f-deadline').value,
      status: document.getElementById('task-f-status').value,
      result: document.getElementById('task-f-result').value.trim(),
      images: imageUrls,
      csAssigned: Array.from(_taskSelectedCS),
      teamsAssigned: Array.from(_taskSelectedTeams),
      createdBy: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''
    };
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveTask', task: task }) });
    var d = await r.json();
    if (d && d.error){ alert('Lỗi: '+d.error); return; }
  }catch(e){ alert('Lỗi kết nối, thử lại'); return; }
  finally{ if (saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Lưu'; } }
  closeTaskModal();
  loadTasks();
}

async function deleteTaskUI(id){
  if (!confirm('Xóa công việc này?')) return;
  try{
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'deleteTask', id: id }) });
  }catch(e){}
  loadTasks();
}

// ── MODAL CHI TIẾT (Tổng quan + Thảo luận) ──────────────────────
function openTaskDetailModal(id){
  var t = allTasks.find(function(x){ return x.id===id; });
  if (!t) return;
  _taskDetailId = id;

  document.getElementById('task-detail-title').textContent = t.title;
  document.getElementById('task-detail-cs').textContent = (t.csAssigned||[]).join(', ') || '—';
  document.getElementById('task-detail-deadline').textContent = t.deadline || '—';
  document.getElementById('task-detail-status-wrap').innerHTML = _taskStatusBadge(t.status) + (_taskIsOverdue(t) ? ' <span class="assign-badge-pill has-assign">Quá hạn</span>' : '');
  document.getElementById('task-detail-desc').textContent = t.description || 'Không có mô tả';
  document.getElementById('task-detail-images').innerHTML = (t.images||[]).map(function(u){
    return '<img src="'+esc(u)+'" class="task-detail-img" data-img-url="'+esc(u)+'" style="width:90px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--border);cursor:pointer">';
  }).join('');
  document.querySelectorAll('#task-detail-images .task-detail-img').forEach(function(img){
    img.addEventListener('click', function(){ window.open(img.getAttribute('data-img-url'), '_blank'); });
  });
  document.getElementById('task-detail-result').textContent = t.result || 'Chưa có kết quả';

  switchTaskDetailTab('overview');
  document.getElementById('task-detail-modal-overlay').classList.add('open');
  loadTaskComments(id);
}
function closeTaskDetailModal(){ document.getElementById('task-detail-modal-overlay').classList.remove('open'); _taskDetailId = null; }

function switchTaskDetailTab(which){
  document.getElementById('task-detail-tab-overview').classList.toggle('active', which==='overview');
  document.getElementById('task-detail-tab-discuss').classList.toggle('active', which==='discuss');
  document.getElementById('task-detail-view-overview').style.display = which==='overview' ? 'block' : 'none';
  document.getElementById('task-detail-view-discuss').style.display = which==='discuss' ? 'block' : 'none';
  document.getElementById('task-cm-footer').style.display = which==='discuss' ? 'flex' : 'none';
}

async function loadTaskComments(taskId){
  var listEl = document.getElementById('task-cm-list');
  listEl.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Đang tải...</div>';
  allTaskComments = [];
  if (gsUrl){
    try{
      var sep = gsUrl.includes('?') ? '&' : '?';
      var r = await fetch(gsUrl + sep + 'action=taskComments&taskId=' + encodeURIComponent(taskId), { redirect:'follow' });
      var d = await r.json();
      if (d && Array.isArray(d.comments)) allTaskComments = d.comments;
    }catch(e){ console.warn('loadTaskComments failed:', e); }
  }
  renderTaskComments();
}

function renderTaskComments(){
  var listEl = document.getElementById('task-cm-list');
  var cntEl = document.getElementById('task-detail-cm-count');
  cntEl.textContent = allTaskComments.length ? '('+allTaskComments.length+')' : '';
  listEl.innerHTML = allTaskComments.map(function(c){
    var initial = (c.author || '?').trim().charAt(0).toUpperCase();
    var when = c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' }) : '';
    var imgs = (c.images||[]).map(function(u){ return '<img src="'+esc(u)+'" class="task-cm-img" data-img-url="'+esc(u)+'">'; }).join('');
    return '<div class="task-cm-item">'+
      '<div class="task-cm-avatar">'+esc(initial)+'</div>'+
      '<div class="task-cm-bubble">'+
        '<div style="font-weight:700;font-size:12px">'+esc(c.author||'Ẩn danh')+'</div>'+
        (c.content ? '<div style="font-size:12.5px;white-space:pre-wrap;margin-top:2px">'+esc(c.content)+'</div>' : '')+
        imgs+
        '<div style="font-size:10px;color:var(--muted);margin-top:4px">'+when+'</div>'+
      '</div>'+
    '</div>';
  }).join('') || '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px">Chưa có thảo luận nào</div>';
  listEl.scrollTop = listEl.scrollHeight;
}

function _taskCmAddImages(files){
  Array.from(files || []).forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(ev){
      _taskCmPendingImages.push({ file: file, dataUrl: ev.target.result });
      _renderTaskCmPendingImages();
    };
    reader.readAsDataURL(file);
  });
}
function _renderTaskCmPendingImages(){
  var wrap = document.getElementById('task-cm-pending-images');
  wrap.innerHTML = _taskCmPendingImages.map(function(img, idx){
    return '<div style="position:relative">'+
      '<img src="'+esc(img.dataUrl)+'" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">'+
      '<span onclick="_taskCmRemoveImage('+idx+')" style="position:absolute;top:-5px;right:-5px;background:#dc2626;color:#fff;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;cursor:pointer">✕</span>'+
    '</div>';
  }).join('');
}
function _taskCmRemoveImage(idx){ _taskCmPendingImages.splice(idx,1); _renderTaskCmPendingImages(); }

async function sendTaskComment(){
  var input = document.getElementById('task-cm-input');
  var content = input.value.trim();
  if (!content && !_taskCmPendingImages.length) return;
  if (!gsUrl || !_taskDetailId) return;
  var sendBtn = document.querySelector('#task-cm-footer .btn.primary');
  if (sendBtn){ sendBtn.disabled = true; }
  try{
    var imageUrls = await _uploadImagesToDrive(_taskCmPendingImages);
    var comment = {
      taskId: _taskDetailId,
      author: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || 'Ẩn danh',
      content: content,
      images: imageUrls
    };
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveTaskComment', comment: comment }) });
  }catch(e){ console.warn('sendTaskComment failed:', e); }
  finally{ if (sendBtn){ sendBtn.disabled = false; } }
  input.value = '';
  _taskCmPendingImages = [];
  _renderTaskCmPendingImages();
  loadTaskComments(_taskDetailId);
}

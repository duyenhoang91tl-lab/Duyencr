var SH_TASK = 'Tasks';
var TASK_HEADERS = ['id','title','description','csAssigned','deadline','status','createdBy','createdAt','updatedAt','teamsAssigned','result','images',
                    'flowId','stageIdx','stageAssignees','stageApprovers','stageLog','mentions'];

function _taskJson_(v, dflt) {
  try { return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; }
}
// 1 dong sheet Tasks -> object. Dung chung cho readTasks_, saveTaskEntry_, taskAdvance_ (tranh lech cot).
function _taskFromRow_(r) {
  var cs = [];
  try { cs = r[3] ? JSON.parse(r[3]) : []; } catch (e) { cs = String(r[3] || '').split(',').filter(Boolean); }
  var tm = [];
  try { tm = r[9] ? JSON.parse(r[9]) : []; } catch (e) { tm = String(r[9] || '').split(',').filter(Boolean); }
  var si = (r[13] === '' || r[13] === undefined || r[13] === null) ? 0 : parseInt(r[13], 10);
  return {
    id: String(r[0]),
    title: String(r[1] || ''),
    description: String(r[2] || ''),
    csAssigned: cs,
    deadline: r[4] ? String(r[4]) : '',
    status: String(r[5] || 'Chưa làm'),
    createdBy: String(r[6] || ''),
    createdAt: String(r[7] || ''),
    updatedAt: String(r[8] || ''),
    teamsAssigned: tm,
    result: String(r[10] || ''),
    images: _taskJson_(r[11], []),
    flowId: String(r[12] || ''),
    stageIdx: isNaN(si) ? 0 : si,
    stageAssignees: _taskJson_(r[14], {}),
    stageApprovers: _taskJson_(r[15], {}),
    stageLog: _taskJson_(r[16], []),
    mentions: _taskJson_(r[17], [])
  };
}
function _taskToRow_(t) {
  return [t.id, t.title || '', t.description || '', JSON.stringify(t.csAssigned || []),
          t.deadline || '', t.status || 'Chưa làm', t.createdBy || '', t.createdAt || '', t.updatedAt || '',
          JSON.stringify(t.teamsAssigned || []), t.result || '', JSON.stringify(t.images || []),
          t.flowId || '', (t.stageIdx === undefined || t.stageIdx === null) ? 0 : t.stageIdx,
          JSON.stringify(t.stageAssignees || {}), JSON.stringify(t.stageApprovers || {}),
          JSON.stringify(t.stageLog || []), JSON.stringify(t.mentions || [])];
}
function _taskFind_(sh, id) {
  var last = sh.getLastRow();
  if (!id || last < 2) return null;
  var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  if (!cell) return null;
  var rowIdx = cell.getRow();
  var r = sh.getRange(rowIdx, 1, 1, TASK_HEADERS.length).getValues()[0];
  return { rowIdx: rowIdx, task: _taskFromRow_(r) };
}

function readTasks_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push(_taskFromRow_(v[i]));
  }
  return out;
}

// Tạo mới (khi t.id rỗng) hoặc cập nhật (khi t.id đã tồn tại) — cùng 1 hàm, giống pattern saveAssignEntry_.
// QUY TRINH (2026-10-11): cac truong flowId/stageIdx/stageLog CHI do server tinh (taskAdvance_), client sua
// task khong duoc ghi de -> khi cap nhat, giu nguyen stageIdx/stageLog/flowId cu; stageAssignees/stageApprovers
// chi ghi de khi client gui kem (de modal sua cu khong lam mat nguoi phu trach cac buoc).
function saveTaskEntry_(t) {
  if (!t || !String(t.title || '').trim()) return jsonOut_({ error: 'Thieu title' });
  var sh = getSheet_(SH_TASK, TASK_HEADERS);
  var now = new Date().toISOString();
  var found = t.id ? _taskFind_(sh, t.id) : null;
  var old = found ? found.task : null;
  var id = old ? old.id : (t.id || ('tk_' + Date.now() + '_' + Math.floor(Math.random() * 1000)));
  var rec = {
    id: id, title: t.title || '', description: t.description || '', csAssigned: t.csAssigned || [],
    deadline: t.deadline || '', status: t.status || 'Chưa làm', createdBy: old ? old.createdBy : (t.createdBy || ''),
    createdAt: old ? old.createdAt : (t.createdAt || now), updatedAt: now,
    teamsAssigned: t.teamsAssigned || [], result: t.result || '', images: t.images || [],
    flowId: old ? old.flowId : '', stageIdx: old ? old.stageIdx : 0,
    stageAssignees: (t.stageAssignees !== undefined) ? t.stageAssignees : (old ? old.stageAssignees : {}),
    stageApprovers: (t.stageApprovers !== undefined) ? t.stageApprovers : (old ? old.stageApprovers : {}),
    stageLog: old ? old.stageLog : [], mentions: old ? old.mentions : []
  };
  if (!old && t.flowId) {
    var flow = _taskFlowById_(t.flowId);
    if (!flow) return jsonOut_({ error: 'Khong tim thay quy trinh ' + t.flowId });
    rec.flowId = flow.id; rec.stageIdx = 0; rec.status = 'Đang làm';
    rec.stageLog = [{ stageId: flow.stages[0].id, startedAt: now }];
    // nguoi phu trach tong = hop cac nguoi phu trach cac buoc (de loc "Giao cho toi" dung)
    var all = {}; (rec.csAssigned || []).forEach(function (n) { all[n] = 1; });
    Object.keys(rec.stageAssignees || {}).forEach(function (k) { (rec.stageAssignees[k] || []).forEach(function (n) { all[n] = 1; }); });
    rec.csAssigned = Object.keys(all);
  }
  if (found) sh.getRange(found.rowIdx, 1, 1, TASK_HEADERS.length).setValues([_taskToRow_(rec)]);
  else sh.appendRow(_taskToRow_(rec));
  _notifyMentions_({ text: (rec.title || '') + ' ' + (rec.description || ''), skipText: old ? ((old.title || '') + ' ' + (old.description || '')) : '',
                     from: t.by || rec.createdBy, kind: 'task', refType: 'task', refId: id });
  if (!old && rec.flowId) _taskSysComment_(id, rec.createdBy, 'đã tạo công việc, bắt đầu giai đoạn "' + _taskFlowById_(rec.flowId).stages[0].name + '"', 'system', '');
  return jsonOut_({ ok: true, id: id });
}

function deleteTask_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id' });
  var sh = getSheet_(SH_TASK, TASK_HEADERS);
  var last = sh.getLastRow();
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (cell) sh.deleteRow(cell.getRow());
  }
  return jsonOut_({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
//  BINH LUAN / THAO LUAN TRONG 1 CONG VIEC (tab "Thao luan" cua Task)
//  Moi dong la 1 comment, khong sua/xoa - chi doc theo taskId + them moi.
// ═══════════════════════════════════════════════════════════════
var SH_TASK_COMMENT = 'TaskComments';
var TASK_COMMENT_HEADERS = ['id','taskId','author','content','images','createdAt','files','mentions','kind','refId'];

function readTaskComments_(sh, taskId) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    if (String(v[i][1]) !== String(taskId)) continue;
    out.push({
      id: String(v[i][0]),
      taskId: String(v[i][1]),
      author: String(v[i][2] || ''),
      content: String(v[i][3] || ''),
      images: _taskJson_(v[i][4], []),
      createdAt: String(v[i][5] || ''),
      files: _taskJson_(v[i][6], []),
      mentions: _taskJson_(v[i][7], []),
      kind: String(v[i][8] || 'comment'),
      refId: String(v[i][9] || '')
    });
  }
  // Cu -> moi, giong thu tu chat, de UI scroll xuong duoi cung la binh luan moi nhat
  out.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  THONG BAO @TAG (them 2026-10-11): ai @ten ai do trong ghi chu khach / binh luan / cong viec thi nguoi do thay thong bao o menu "Thong bao",
//  bam vao thi mo dung man hinh (khach / cong viec + binh luan). Luu sheet 'Notifications' (khoi luong nho; chuyen Supabase sau cung luc cac bang moi khac).
//  Nguoi nhan = tai khoan (username) khop @<name | 1 trong names | username>, khong phan biet hoa thuong, ten dai uu tien truoc ("@Ha My" khong bao nham "@Ha").
//  Hang loi bi nuot: tao thong bao KHONG BAO GIO lam hong viec luu ghi chu/binh luan/cong viec that.
// ═══════════════════════════════════════════════════════════════
var SH_NOTIF = 'Notifications';
var NOTIF_HEADERS = ['id', 'toUser', 'fromUser', 'kind', 'refType', 'refId', 'refId2', 'text', 'createdAt', 'readAt'];
function _notifIsWordCh_(ch) { return !!ch && /[0-9A-Za-zÀ-ỹ_]/.test(ch); }
// Tra mang username bi tag trong text. users = readUsers_(); chi tai khoan active.
function _notifParseMentions_(text, users) {
  text = String(text || '');
  if (text.indexOf('@') < 0) return [];
  var cand = [];
  (users || []).forEach(function (u) {
    if (u.active === false) return;
    var al = {};
    [u.name, u.username].concat(u.names || []).forEach(function (n) { n = String(n || '').trim(); if (n) al[n.toLowerCase()] = 1; });
    Object.keys(al).forEach(function (a) { cand.push({ a: a, un: String(u.username) }); });
  });
  cand.sort(function (x, y) { return y.a.length - x.a.length; });
  var low = text.toLowerCase(), hit = {};
  cand.forEach(function (c) {
    var from = 0, p;
    while ((p = low.indexOf('@' + c.a, from)) >= 0) {
      var end = p + 1 + c.a.length;
      if (!_notifIsWordCh_(low.charAt(end)) && (p === 0 || !_notifIsWordCh_(low.charAt(p - 1)))) {
        hit[c.un] = 1;
        low = low.slice(0, p) + new Array(end - p + 1).join(' ') + low.slice(end);   // che doan da khop de ten ngan hon khong khop lai
      }
      from = end;
    }
  });
  return Object.keys(hit);
}
// opts: {text, from (ten hien thi), fromUser (username, de khong tu bao minh), kind: note|comment|task, refType: customer|task, refId, refId2, skipText (text cu: chi bao nguoi MOI duoc tag)}
function _notifyMentions_(opts) {
  try {
    var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
    var tos = _notifParseMentions_(opts.text, users);
    if (opts.skipText) { var had = {}; _notifParseMentions_(opts.skipText, users).forEach(function (x) { had[x] = 1; }); tos = tos.filter(function (x) { return !had[x]; }); }
    // khong tu bao chinh minh: bo tai khoan nao co ten/bi danh/username trung nguoi gui
    var me = {};
    [opts.from, opts.fromUser].forEach(function (n) { n = String(n || '').trim().toLowerCase(); if (n) me[n] = 1; });
    var selfUn = {};
    users.forEach(function (u) { [u.name, u.username].concat(u.names || []).forEach(function (n) { if (me[String(n || '').trim().toLowerCase()]) selfUn[String(u.username)] = 1; }); });
    tos = tos.filter(function (x) { return !selfUn[x]; });
    if (!tos.length) return 0;
    var sh = getSheet_(SH_NOTIF, NOTIF_HEADERS), now = new Date().toISOString();
    var snip = String(opts.text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    var rows = tos.map(function (to, i) {
      return ['nt_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1000), to, opts.from || opts.fromUser || '', opts.kind || '',
              opts.refType || '', String(opts.refId || ''), String(opts.refId2 || ''), snip, now, ''];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIF_HEADERS.length).setValues(rows);
    return rows.length;
  } catch (e) { return 0; }
}
// Thong bao cua 1 tai khoan: moi nhat truoc, toi da 100; unread = tong chua doc (ca ngoai 100 dong dau).
function readNotifications_(username) {
  var sh = getCrmSS_().getSheetByName(SH_NOTIF), out = [], unread = 0;
  if (!sh || sh.getLastRow() < 2) return { ok: true, items: out, unread: 0 };
  var v = sh.getDataRange().getValues(), un = String(username || '').toLowerCase();
  for (var i = v.length - 1; i >= 1; i--) {
    if (!v[i][0] || String(v[i][1]).toLowerCase() !== un) continue;
    var rd = !!v[i][9];
    if (!rd) unread++;
    if (out.length < 100) out.push({ id: v[i][0], from: v[i][2], kind: v[i][3], refType: v[i][4], refId: String(v[i][5]), refId2: String(v[i][6]),
      text: v[i][7], createdAt: v[i][8] instanceof Date ? v[i][8].toISOString() : String(v[i][8]), read: rd });
  }
  return { ok: true, items: out, unread: unread };
}
// ids = mang id; hoac all=true. Chi dong cua chinh username do.
function markNotifRead_(username, ids, all) {
  var sh = getCrmSS_().getSheetByName(SH_NOTIF);
  if (!sh || sh.getLastRow() < 2) return { ok: true, marked: 0 };
  var v = sh.getDataRange().getValues(), un = String(username || '').toLowerCase(), want = {}, n = 0, now = new Date().toISOString();
  (ids || []).forEach(function (x) { want[String(x)] = 1; });
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0] || v[i][9] || String(v[i][1]).toLowerCase() !== un) continue;
    if (all || want[String(v[i][0])]) { sh.getRange(i + 1, 10).setValue(now); n++; }
  }
  return { ok: true, marked: n };
}
function saveTaskComment_(c) {
  if (!c || !c.taskId) return jsonOut_({ error: 'Thieu taskId' });
  if (!String(c.content || '').trim() && !(c.images || []).length && !(c.files || []).length) {
    return jsonOut_({ error: 'Binh luan rong' });
  }
  var sh = getSheet_(SH_TASK_COMMENT, TASK_COMMENT_HEADERS);
  var id = 'tc_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var now = new Date().toISOString();
  sh.appendRow([id, String(c.taskId), c.author || 'Ẩn danh', c.content || '',
                JSON.stringify(c.images || []), now,
                JSON.stringify(c.files || []), JSON.stringify(c.mentions || []), 'comment', '']);
  _notifyMentions_({ text: c.content, from: c.author, kind: 'comment', refType: 'task', refId: c.taskId, refId2: id });
  return jsonOut_({ ok: true, id: id });
}

// Dong thong bao he thong trong luong thao luan (chuyen buoc, gui/duyet yeu cau...). kind: system | request
function _taskSysComment_(taskId, author, content, kind, refId) {
  var sh = getSheet_(SH_TASK_COMMENT, TASK_COMMENT_HEADERS);
  var id = 'tc_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  sh.appendRow([id, String(taskId), author || 'Hệ thống', content || '', '[]', new Date().toISOString(),
                '[]', '[]', kind || 'system', refId || '']);
  return id;
}

// ═══════════════════════════════════════════════════════════════
//  QUY TRINH CONG VIEC (kieu Base): nhieu loai cong viec, moi loai co cac GIAI DOAN rieng;
//  moi giai doan co nguoi phu trach; xong thi bam "Chuyen tiep". Giai doan danh dau approval=true thi
//  chuyen tiep phai GUI YEU CAU cho nguoi duyet va cho ho Chap nhan/Tu choi (TaskRequests).
//  stage = { id, name, approval }. Task luu stageIdx (== stages.length nghia la da xong), stageAssignees
//  {stageId:[ten]}, stageApprovers {stageId:[ten]}, stageLog [{stageId,startedAt,doneAt,by}].
// ═══════════════════════════════════════════════════════════════
var SH_TASK_FLOW = 'TaskFlows';
var TASK_FLOW_HEADERS = ['id','name','stages','createdBy','updatedAt'];
var SH_TASK_REQ = 'TaskRequests';
var TASK_REQ_HEADERS = ['id','taskId','fromStageId','toStageId','requestedBy','approvers','status','decidedBy','decidedAt','note','createdAt'];

// Mau co san (khoi tao 1 lan khi sheet TaskFlows rong) — sua/xoa/them thoai mai tren giao dien.
function _taskFlowSeed_() {
  function st(prefix, names, approvalIdx) {
    return names.map(function (n, i) { return { id: prefix + (i + 1), name: n, approval: approvalIdx.indexOf(i) >= 0 }; });
  }
  return [
    { id: 'flow_hoantien', name: 'Hoàn tiền / chi tiền',
      stages: st('ht', ['Đề nghị chi', 'Xác nhận chi', 'Xác nhận thông tin hoàn tiền/thu mua', 'Thực hiện chi'], [1]) },
    { id: 'flow_donhang', name: 'Xử lý đơn hàng',
      stages: st('dh', ['Tiếp nhận đơn', 'Tạo đơn POS', 'Phân loại đơn', 'Phòng sản xuất', 'Kho thành phẩm', 'Đóng hàng'], []) }
  ];
}
function readTaskFlows_() {
  var sh = getSheet_(SH_TASK_FLOW, TASK_FLOW_HEADERS);
  if (sh.getLastRow() < 2) {
    var now = new Date().toISOString();
    _taskFlowSeed_().forEach(function (f) { sh.appendRow([f.id, f.name, JSON.stringify(f.stages), 'Hệ thống', now]); });
  }
  var v = sh.getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    out.push({ id: String(v[i][0]), name: String(v[i][1] || ''), stages: _taskJson_(v[i][2], []), createdBy: String(v[i][3] || ''), updatedAt: String(v[i][4] || '') });
  }
  return out;
}
function _taskFlowById_(id) {
  var all = readTaskFlows_();
  for (var i = 0; i < all.length; i++) if (all[i].id === String(id)) return all[i];
  return null;
}
function saveTaskFlow_(f) {
  if (!f || !String(f.name || '').trim()) return jsonOut_({ error: 'Thieu ten quy trinh' });
  var stages = (f.stages || []).filter(function (x) { return x && String(x.name || '').trim(); });
  if (!stages.length) return jsonOut_({ error: 'Quy trinh can it nhat 1 giai doan' });
  var seen = {};
  stages = stages.map(function (x, i) {
    var sid = String(x.id || ('s' + Date.now().toString(36) + i));
    if (seen[sid]) sid = sid + '_' + i;
    seen[sid] = 1;
    return { id: sid, name: String(x.name).trim(), approval: !!x.approval };
  });
  readTaskFlows_(); // dam bao sheet + mau da khoi tao
  var sh = getSheet_(SH_TASK_FLOW, TASK_FLOW_HEADERS);
  var id = f.id || ('flow_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
  var row = [id, String(f.name).trim(), JSON.stringify(stages), f.createdBy || '', new Date().toISOString()];
  var last = sh.getLastRow(), rowIdx = -1;
  if (f.id && last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(f.id)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, TASK_FLOW_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true, id: id });
}
function deleteTaskFlow_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id' });
  var used = readTasks_(getSheet_(SH_TASK, TASK_HEADERS)).filter(function (t) { return t.flowId === String(id); }).length;
  if (used) return jsonOut_({ error: 'Co ' + used + ' cong viec dang dung quy trinh nay — khong xoa duoc' });
  var sh = getSheet_(SH_TASK_FLOW, TASK_FLOW_HEADERS);
  var last = sh.getLastRow();
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (cell) sh.deleteRow(cell.getRow());
  }
  return jsonOut_({ ok: true });
}

function readTaskRequests_(taskId, onlyPending) {
  var sh = getSheet_(SH_TASK_REQ, TASK_REQ_HEADERS);
  var out = [];
  if (sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    if (taskId && String(v[i][1]) !== String(taskId)) continue;
    if (onlyPending && String(v[i][6]) !== 'pending') continue;
    out.push({ id: String(v[i][0]), taskId: String(v[i][1]), fromStageId: String(v[i][2]), toStageId: String(v[i][3]),
      requestedBy: String(v[i][4] || ''), approvers: _taskJson_(v[i][5], []), status: String(v[i][6] || 'pending'),
      decidedBy: String(v[i][7] || ''), decidedAt: String(v[i][8] || ''), note: String(v[i][9] || ''), createdAt: String(v[i][10] || '') });
  }
  return out;
}

// Dua task sang giai doan ke tiep (hoac Hoan thanh neu dang o buoc cuoi). Goi SAU khi da kiem tra quyen/duyet.
function _taskDoAdvance_(sh, found, flow, by, note, approvedBy) {
  var t = found.task, now = new Date().toISOString();
  var cur = flow.stages[t.stageIdx];
  var log = t.stageLog || [];
  for (var i = log.length - 1; i >= 0; i--) {
    if (log[i].stageId === cur.id && !log[i].doneAt) { log[i].doneAt = now; log[i].by = by; if (approvedBy) log[i].approvedBy = approvedBy; break; }
  }
  var msg;
  if (t.stageIdx >= flow.stages.length - 1) {
    t.stageIdx = flow.stages.length; t.status = 'Hoàn thành';
    msg = 'đã hoàn thành giai đoạn "' + cur.name + '" → công việc HOÀN THÀNH';
  } else {
    t.stageIdx++; t.status = 'Đang làm';
    var nx = flow.stages[t.stageIdx];
    log.push({ stageId: nx.id, startedAt: now });
    var nxA = (t.stageAssignees || {})[nx.id] || [];
    msg = 'đã chuyển tiếp "' + cur.name + '" → "' + nx.name + '"' + (nxA.length ? ' (người nhận: ' + nxA.join(', ') + ')' : '');
  }
  if (approvedBy) msg += ' — được duyệt bởi ' + approvedBy;
  if (note) msg += '. Ghi chú: ' + note;
  t.stageLog = log; t.updatedAt = now;
  sh.getRange(found.rowIdx, 1, 1, TASK_HEADERS.length).setValues([_taskToRow_(t)]);
  _taskSysComment_(t.id, by, msg, 'system', '');
  return t;
}

// Nguoi phu trach buoc hien tai bam "Chuyen tiep".
function taskAdvance_(p) {
  if (!p || !p.taskId || !p.by) return jsonOut_({ error: 'Thieu taskId/by' });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return jsonOut_({ error: 'He thong ban, thu lai' }); }
  try {
    var sh = getSheet_(SH_TASK, TASK_HEADERS);
    var found = _taskFind_(sh, p.taskId);
    if (!found) return jsonOut_({ error: 'Khong tim thay cong viec' });
    var t = found.task;
    if (!t.flowId) return jsonOut_({ error: 'Cong viec nay khong co quy trinh' });
    var flow = _taskFlowById_(t.flowId);
    if (!flow) return jsonOut_({ error: 'Quy trinh da bi xoa' });
    if (t.stageIdx >= flow.stages.length) return jsonOut_({ error: 'Cong viec da hoan thanh' });
    var cur = flow.stages[t.stageIdx];
    var assignees = (t.stageAssignees || {})[cur.id] || [];
    if (assignees.indexOf(p.by) < 0 && p.by !== t.createdBy) {
      return jsonOut_({ error: 'Ban khong phai nguoi phu trach giai doan "' + cur.name + '"' });
    }
    if (readTaskRequests_(t.id, true).length) return jsonOut_({ error: 'Dang cho nguoi duyet — chua the chuyen tiep' });
    var isLast = t.stageIdx >= flow.stages.length - 1;
    if (cur.approval) {
      var apr = (t.stageApprovers || {})[cur.id] || [];
      if (!apr.length && !isLast) apr = (t.stageAssignees || {})[flow.stages[t.stageIdx + 1].id] || [];
      apr = apr.filter(function (n) { return n !== p.by; });
      if (!apr.length) return jsonOut_({ error: 'Giai doan "' + cur.name + '" can nguoi duyet nhung chua chon ai (hoac chi co chinh ban)' });
      var rsh = getSheet_(SH_TASK_REQ, TASK_REQ_HEADERS);
      var rid = 'rq_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var to = isLast ? '' : flow.stages[t.stageIdx + 1].id;
      rsh.appendRow([rid, t.id, cur.id, to, p.by, JSON.stringify(apr), 'pending', '', '', p.note || '', new Date().toISOString()]);
      _taskSysComment_(t.id, p.by, 'gửi YÊU CẦU DUYỆT để rời giai đoạn "' + cur.name + '" — chờ: ' + apr.join(', ') + (p.note ? '. Ghi chú: ' + p.note : ''), 'request', rid);
      return jsonOut_({ ok: true, pending: true, requestId: rid });
    }
    var nt = _taskDoAdvance_(sh, found, flow, p.by, p.note || '', '');
    return jsonOut_({ ok: true, stageIdx: nt.stageIdx, status: nt.status });
  } finally { lock.releaseLock(); }
}

// Nguoi duyet Chap nhan / Tu choi 1 yeu cau chuyen buoc.
function taskRequestDecide_(p) {
  if (!p || !p.requestId || !p.by) return jsonOut_({ error: 'Thieu requestId/by' });
  var approve = (p.decision === 'approve');
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return jsonOut_({ error: 'He thong ban, thu lai' }); }
  try {
    var rsh = getSheet_(SH_TASK_REQ, TASK_REQ_HEADERS);
    var last = rsh.getLastRow();
    if (last < 2) return jsonOut_({ error: 'Khong co yeu cau' });
    var cell = rsh.getRange(2, 1, last - 1, 1).createTextFinder(String(p.requestId)).matchEntireCell(true).findNext();
    if (!cell) return jsonOut_({ error: 'Khong tim thay yeu cau' });
    var rowIdx = cell.getRow();
    var r = rsh.getRange(rowIdx, 1, 1, TASK_REQ_HEADERS.length).getValues()[0];
    if (String(r[6]) !== 'pending') return jsonOut_({ error: 'Yeu cau da duoc xu ly truoc do' });
    var approvers = _taskJson_(r[5], []);
    if (approvers.indexOf(p.by) < 0) return jsonOut_({ error: 'Ban khong nam trong danh sach nguoi duyet' });
    var now = new Date().toISOString();
    rsh.getRange(rowIdx, 7, 1, 4).setValues([[approve ? 'approved' : 'rejected', p.by, now, p.note || String(r[9] || '')]]);
    var sh = getSheet_(SH_TASK, TASK_HEADERS);
    var found = _taskFind_(sh, String(r[1]));
    if (!found) return jsonOut_({ ok: true });
    if (!approve) {
      _taskSysComment_(found.task.id, p.by, 'TỪ CHỐI yêu cầu chuyển tiếp' + (p.note ? ': ' + p.note : '') + ' — giai đoạn hiện tại giữ nguyên', 'system', String(r[0]));
      return jsonOut_({ ok: true, rejected: true });
    }
    var flow = _taskFlowById_(found.task.flowId);
    if (!flow || found.task.stageIdx >= flow.stages.length) return jsonOut_({ ok: true });
    if (flow.stages[found.task.stageIdx].id !== String(r[2])) return jsonOut_({ error: 'Cong viec da doi giai doan, yeu cau khong con hieu luc' });
    var nt = _taskDoAdvance_(sh, found, flow, String(r[4]), '', p.by);
    return jsonOut_({ ok: true, stageIdx: nt.stageIdx, status: nt.status });
  } finally { lock.releaseLock(); }
}

// ═══════════════════════════════════════════════════════════════
//  MESSENGER / PHONG THUY AI — them 2026-09, phuc vu extension-messenger.
//  CHI THEM MOI, khong sua ham/sheet nao o tren. Dung 2 sheet rieng (Menh, CannedResponses),
//  KHONG dung chung cot voi CareData — tranh dung do schema dang chay that cho Zalo/Pancake.
// ═══════════════════════════════════════════════════════════════
var SH_MENH = 'Menh';
var SH_CANNED = 'CannedResponses';

// Bang tra menh Ngu hanh nap am — TINH BANG CONG THUC cho 1900-2100 (da doi chieu voi chuoi nap am 60 nam).
// NGUYEN NHAN GOC da sua: bang cu "chep tu bang CS" chi phu 1954-2013 va SAI 44/60 nam (vd 1995 ghi Thuy, dung la Hoa;
// 1990 ghi Moc, dung la Tho). Cong thuc: Can (Giap,At=1; Binh,Dinh=2; Mau,Ky=3; Canh,Tan=4; Nham,Quy=5)
// + Chi (Ty,Suu,Ngo,Mui=0; Dan,Mao,Than,Dau=1; Thin,Ty,Tuat,Hoi=2); tong >5 thi tru 5 -> 1 Kim,2 Thuy,3 Hoa,4 Tho,5 Moc.
// Tinh theo nam duong lich (sinh truoc Tet thi lay nam truoc).
function menhFromYear_(y) {
  y = parseInt(y, 10);
  if (!y || y < 1900 || y > 2100) return null;
  var can = Math.floor(((y - 4) % 10) / 2) + 1;
  var chi = [0,0,1,1,2,2,0,0,1,1,2,2][(y - 4) % 12];
  var s = can + chi; if (s > 5) s -= 5;
  return ['', 'Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'][s];
}
function buildMenhRows_() {
  var order = ['Kim', 'Thủy', 'Hỏa', 'Mộc', 'Thổ'], by = {};
  order.forEach(function (m) { by[m] = []; });
  for (var y = 1900; y <= 2100; y++) by[menhFromYear_(y)].push(y);
  return order.map(function (m) { return [m, by[m].join(',')]; });
}
var MENH_DEFAULT_ROWS = buildMenhRows_();
var MENH_SHEET_MARK = 'napam-v2';

// 11 mau canned response (Phan A/B/C file mau Beeftext CS gui) — Nhom | ID | Ten | NoiDung
var CANNED_DEFAULT_ROWS = [
  ['Theo mệnh', 'menhkim', 'Mệnh Kim', 'Dạ với người mệnh Kim thì màu hợp là màu trắng, vàng, bạc (thuộc hành Kim và Thổ vì Thổ sinh Kim ạ), nên tránh dùng nhiều màu đỏ, hồng, tím (hành Hỏa khắc Kim).\nĐá phong thủy hợp mệnh Kim: đá thạch anh trắng, đá mắt hổ vàng, ngọc trai, đá obsidian đen (Thủy tương sinh).\nBên em hiện có $$ rất phù hợp với mệnh Kim ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhmoc', 'Mệnh Mộc', 'Dạ với người mệnh Mộc thì màu hợp là màu xanh lá, xanh dương, đen (hành Mộc và Thủy vì Thủy sinh Mộc ạ), nên tránh dùng nhiều màu trắng, bạc (hành Kim khắc Mộc).\nĐá phong thủy hợp mệnh Mộc: đá aventurine xanh, ngọc bích, đá obsidian đen.\nBên em hiện có $$ rất phù hợp với mệnh Mộc ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhthuy', 'Mệnh Thủy', 'Dạ với người mệnh Thủy thì màu hợp là màu đen, xanh dương, trắng (hành Thủy và Kim vì Kim sinh Thủy ạ), nên tránh dùng nhiều màu vàng nâu (hành Thổ khắc Thủy).\nĐá phong thủy hợp mệnh Thủy: đá obsidian đen, đá lapis lazuli xanh, đá thạch anh trắng.\nBên em hiện có $$ rất phù hợp với mệnh Thủy ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhhoa', 'Mệnh Hỏa', 'Dạ với người mệnh Hỏa thì màu hợp là màu đỏ, hồng, tím, xanh lá (hành Hỏa và Mộc vì Mộc sinh Hỏa ạ), nên tránh dùng nhiều màu đen, xanh dương (hành Thủy khắc Hỏa).\nĐá phong thủy hợp mệnh Hỏa: đá thạch anh hồng, đá garnet đỏ, đá aventurine xanh.\nBên em hiện có $$ rất phù hợp với mệnh Hỏa ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhtho', 'Mệnh Thổ', 'Dạ với người mệnh Thổ thì màu hợp là màu vàng, nâu, đỏ, hồng (hành Thổ và Hỏa vì Hỏa sinh Thổ ạ), nên tránh dùng nhiều màu xanh lá (hành Mộc khắc Thổ).\nĐá phong thủy hợp mệnh Thổ: đá mắt hổ vàng, đá citrine vàng, đá thạch anh hồng.\nBên em hiện có $$ rất phù hợp với mệnh Thổ ạ, chị/anh xem qua thử nhé.'],
  ['Giá & chính sách', 'chaohoi', 'Chào hỏi', 'Dạ em chào chị/anh, em là $$ bên shop phong thủy Thu Hiền ạ. Chị/anh cho em xin năm sinh để em tư vấn sản phẩm hợp mệnh nhất mình nhé ạ 🙏'],
  ['Giá & chính sách', 'giaba', 'Báo giá', 'Dạ sản phẩm $$ bên em giá là $$ ạ. Giá này đã bao gồm hộp đựng và thẻ bảo hành, chưa gồm phí ship ạ. Chị/anh có muốn em tư vấn thêm mẫu khác cùng tầm giá không ạ?'],
  ['Giá & chính sách', 'csship', 'Chính sách ship', 'Dạ bên em giao hàng toàn quốc qua đơn vị vận chuyển, thời gian dự kiến 2–4 ngày với nội thành và 3–5 ngày với tỉnh xa ạ. Chị/anh có thể xem hàng trước khi thanh toán (COD) ạ.'],
  ['Giá & chính sách', 'csdoitra', 'Đổi trả', 'Dạ sản phẩm bên em hỗ trợ đổi trong vòng 7 ngày nếu lỗi do nhà sản xuất hoặc không đúng mẫu đã đặt ạ, còn đổi ý cá nhân thì em xin phép hỗ trợ đổi mẫu khác tương đương giá trị trong 3 ngày ạ (khách chịu phí ship đổi). Chị/anh yên tâm mua ạ 🙏'],
  ['Giá & chính sách', 'xinttin', 'Xin thông tin lên đơn', 'Dạ để lên đơn cho chị/anh, em xin thông tin: \n- Họ tên: $$\n- Số điện thoại: $$\n- Địa chỉ nhận hàng: $$\nChị/anh gửi giúp em với ạ, em lên đơn ngay ạ.'],
  ['Giá & chính sách', 'follow2ngay', 'Follow-up 2 ngày', 'Dạ em là $$ bên phong thủy Thu Hiền ạ, hôm trước chị/anh có quan tâm sản phẩm $$, không biết chị/anh đã quyết định chưa ạ? Hiện bên em đang có ưu đãi $$, chị/anh xem thử nhé ạ 🙏']
];

function ensureMenhSheedSeeded_(sh) {
  // Sheet "Menh" cu (bang sai) da duoc seed tu truoc -> ghi de 1 lan, danh dau o C1 = 'napam-v2'.
  if (sh.getLastRow() < 2 || String(sh.getRange(1, 3).getValue()) !== MENH_SHEET_MARK) {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(2, sh.getLastColumn())).clearContent();
    sh.getRange(2, 1, MENH_DEFAULT_ROWS.length, 2).setValues(MENH_DEFAULT_ROWS);
    sh.getRange(1, 3).setValue(MENH_SHEET_MARK);
  }
  return sh;
}
function ensureCannedSheetSeeded_(sh) {
  if (sh.getLastRow() < 2) { for (var i = 0; i < CANNED_DEFAULT_ROWS.length; i++) sh.appendRow(CANNED_DEFAULT_ROWS[i]); }
  return sh;
}

function getMessengerKnowledge_() {
  var shMenh = ensureMenhSheedSeeded_(getSheet_(SH_MENH, ['Menh', 'NamSinh (cách nhau bởi dấu phẩy)']));
  var menhData = shMenh.getDataRange().getValues();
  var menhTable = {};
  for (var r = 1; r < menhData.length; r++) {
    var menh = String(menhData[r][0] || '').trim();
    if (!menh) continue;
    menhTable[menh] = String(menhData[r][1] || '').split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n); });
  }
  // Luon dung bang tinh bang cong thuc (khong tin du lieu sheet co the bi sua tay sai) — extension chi can bang day du 1900-2100.
  MENH_DEFAULT_ROWS.forEach(function (row) { menhTable[row[0]] = row[1].split(',').map(Number); });

  var shCanned = ensureCannedSheetSeeded_(getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']));
  var cannedData = shCanned.getDataRange().getValues();
  var canned = [];
  for (var c = 1; c < cannedData.length; c++) {
    if (!cannedData[c][1]) continue;
    canned.push({ nhom: cannedData[c][0], id: cannedData[c][1], label: cannedData[c][2], text: cannedData[c][3] });
  }
  return { ok: true, menhTable: menhTable, canned: canned, bannedWords: readBannedWords_() };
}

// ─── MAU AI DA HOC (AIContext, type = combo_template) — do CS bam "Luu de AI hoc" tren Pancake/Zalo ───
// Dinh danh 1 mau = cot 'created' (ISO, ghi luc luu) — khong dung so dong vi dong co the lech khi co nguoi xoa/chen.
// Neu Google Sheets tu doi chuoi ISO thanh Date thi chuan hoa lai ve ISO truoc khi so sanh.
function _aiExId_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v || '').trim();
}
function readAIExamples_() {
  var sh = getCrmSS_().getSheetByName(SH_CONTEXT);
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() !== 'combo_template') continue;
    var id = _aiExId_(vals[i][3]);
    if (!id || !String(vals[i][1] || '').trim()) continue;
    out.push({ id: id, content: String(vals[i][1]), context: String(vals[i][2] || ''), created: id });
  }
  out.reverse(); // moi nhat len dau — cung la thu tu backend dua vao prompt (5 mau cuoi)
  return out;
}
function saveAIExample_(id, content) {
  id = String(id || '').trim(); content = String(content || '').trim();
  if (!id || !content) return jsonOut_({ error: 'Thieu id hoac noi dung mau' });
  var sh = getCrmSS_().getSheetByName(SH_CONTEXT);
  if (!sh) return jsonOut_({ error: 'Chua co du lieu AI da hoc' });
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === 'combo_template' && _aiExId_(vals[i][3]) === id) {
      sh.getRange(i + 1, 2).setValue(content);
      return jsonOut_({ ok: true, id: id });
    }
  }
  return jsonOut_({ error: 'Khong tim thay mau (co the da bi xoa)' });
}
function deleteAIExample_(id) {
  id = String(id || '').trim();
  if (!id) return jsonOut_({ error: 'Thieu id mau can xoa' });
  var sh = getCrmSS_().getSheetByName(SH_CONTEXT);
  if (!sh) return jsonOut_({ ok: true });
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === 'combo_template' && _aiExId_(vals[i][3]) === id) {
      sh.deleteRow(i + 1);
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ ok: true, note: 'Khong tim thay (co the da bi xoa truoc do)' });
}

// ─── SUA / THEM / XOA "MAU CO SAN (PHONG THUY)" (sheet CannedResponses: Nhom | ID | Ten | NoiDung) ───
// Truoc day chi doc (getMessengerKnowledge_), CS khong sua duoc tren Pancake. Nay Pancake AI goi 2 action nay,
// ai cung sua duoc. data: {id (co + tim thay = sua; co + khong thay = tao voi id do; khong co = tao id moi), nhom, label, text}.
// Luu y: neu xoa HET mau thi ensureCannedSheetSeeded_ se nap lai 11 mau mac dinh o lan doc ke tiep.
function saveCannedResponse_(data) {
  if (!data || !String(data.label || '').trim() || !String(data.text || '').trim()) {
    return jsonOut_({ error: 'Thieu ten hoac noi dung mau' });
  }
  var sh = getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']);
  var nhom = String(data.nhom || '').trim() || 'Khac';
  var label = String(data.label).trim();
  var text = String(data.text).trim();
  var id = String(data.id || '').trim();
  var vals = sh.getDataRange().getValues();
  if (id) {
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1]) === id) {
        sh.getRange(i + 1, 1, 1, 4).setValues([[nhom, id, label, text]]);
        return jsonOut_({ ok: true, id: id });
      }
    }
  } else {
    id = 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }
  sh.appendRow([nhom, id, label, text]);
  return jsonOut_({ ok: true, id: id });
}

function deleteCannedResponse_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id mau can xoa' });
  var sh = getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(id)) { sh.deleteRow(i + 1); return jsonOut_({ ok: true }); }
  }
  return jsonOut_({ ok: true, note: 'Khong tim thay id (co the da bi xoa truoc do)' });
}

// ═══════════════════════════════════════════════════════════════
//  MAU TIN NHAN TU VAN KHACH (MessageTemplates) — them 2026-10. KHAC voi SH_CANNED (canned
//  response co dinh cho extension-messenger/phong thuy, KHONG co form sua): day la thu vien mau
//  do chinh team tu them/sua qua form tren CRM (tab ZALO AI), hien thi goi y khi tra cuu khach
//  tai CRM VA tai extension Pancake AI (action 'messageTemplates' dung chung cho ca 2 noi).
//  Sheet rieng, KHONG dung chung cot voi CareData/AIContext/CannedResponses.
// ═══════════════════════════════════════════════════════════════
var SH_MSG_TPL = 'MessageTemplates';
// 2026-10-12: them product (san pham, nhieu san pham cach nhau dau phay/;), topic (noi dung hoi thoai / tinh huong), status
// (approved | pending | rejected) + nguoi duyet. Hang CU (khong co status) coi la 'approved' de mau dang dung khong bi mat.
// getSheet_ tu bo sung cac cot header con thieu o cuoi sheet cu, KHONG dung toi du lieu san co.
var MSG_TPL_HEADERS = ['id', 'title', 'content', 'tags', 'createdBy', 'createdAt', 'updatedAt', 'product', 'topic', 'status', 'approvedBy', 'approvedAt', 'rejectReason'];
// Ai duoc duyet / sua / xoa MAU DA DUYET / tao mau thang o trang thai da duyet. Doi danh sach nay neu muon them vai tro (vd 'leader').
var MSG_TPL_APPROVER_ROLES_ = ['admin', 'manager'];
var MSG_TPL_STATUS_ = { approved: 1, pending: 1, rejected: 1 };

// Danh tinh nguoi goi: token phien web (that, doc vai tro tu sheet Users) > khoa extension (chi biet la extension, TEN tu khai) > an danh.
// Nhan vien (khong phai admin/manager) chi duoc DE XUAT mau (status=pending); chi admin/manager moi duyet duoc.
function _tplCaller_(token, ek, nameHint) {
  var c = { role: 'anon', name: '', priv: false, via: 'none' };
  var su = null;
  try { su = token ? _sessUser_(token) : null; } catch (e) { su = null; }
  if (su) {
    c.role = String(su.role || 'cs'); c.name = String(su.name || su.username || '').trim();
    c.priv = MSG_TPL_APPROVER_ROLES_.indexOf(c.role) >= 0; c.via = 'web';
    return c;
  }
  var who = _extKeyWho_(ek);
  c.via = (who === 'zalo' || who === 'pancake') ? 'ext' : 'none';
  c.role = c.via === 'ext' ? 'ext' : 'anon';
  c.name = String(nameHint || '').trim().slice(0, 60);
  return c;
}
function _tplRowToObj_(row) {
  var st = String(row[9] || '').toLowerCase();
  if (!MSG_TPL_STATUS_[st]) st = 'approved';
  return {
    id: String(row[0]), title: String(row[1] || ''), content: String(row[2] || ''), tags: String(row[3] || ''),
    createdBy: String(row[4] || ''), createdAt: row[5] || '', updatedAt: row[6] || '',
    product: String(row[7] || ''), topic: String(row[8] || ''), status: st,
    approvedBy: String(row[10] || ''), approvedAt: row[11] || '', rejectReason: String(row[12] || '')
  };
}
function _tplOwns_(t, c) { return !!(c && c.name) && String(t.createdBy || '').trim().toLowerCase() === c.name.toLowerCase(); }

// caller: admin/manager thay TAT CA; nguoi khac chi thay mau DA DUYET + mau cua CHINH MINH (dang cho duyet / bi tu choi). Khong truyen caller = chi mau da duyet.
function readMessageTemplates_(caller) {
  caller = caller || { priv: false, name: '' };
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (!row[0]) continue; // bo dong trong (id rong)
    var t = _tplRowToObj_(row);
    if (caller.priv || t.status === 'approved' || _tplOwns_(t, caller)) out.push(t);
  }
  // Moi nhat len dau. Dung getTime() (khong dung String(Date)) vi Date.toString() chi chinh xac den giay va
  // khong sap xep dung theo thoi gian thuc -> 2 mau luu cung giay se bi sap xep SAI thu tu neu so sanh chuoi.
  function tplTime_(t) { var d = t.updatedAt || t.createdAt; var ms = d ? new Date(d).getTime() : 0; return isNaN(ms) ? 0 : ms; }
  out.sort(function (a, b) { return tplTime_(b) - tplTime_(a); });
  return out;
}

// data: {id, title, content, tags, product, topic, createdBy}. Admin/manager: luu la 'approved' (admin cai san mau); nhan vien: tao moi -> 'pending',
// chi sua duoc mau CUA MINH chua duoc duyet (sua xong quay lai 'pending'); mau da duyet chi admin/manager sua.
function saveMessageTemplate_(data, caller) {
  caller = caller || { priv: false, name: '', via: 'none' };
  if (!data || !String(data.title || '').trim() || !String(data.content || '').trim()) {
    return jsonOut_({ error: 'Thieu tieu de hoac noi dung mau tin' });
  }
  var title = String(data.title).trim().slice(0, 200);
  var content = String(data.content).trim().slice(0, 4000);
  var tags = String(data.tags || '').trim().slice(0, 300);
  var product = String(data.product || '').trim().slice(0, 300);
  var topic = String(data.topic || '').trim().slice(0, 200);
  // Tai khoan web: nguoi tao = ten that trong token (khong tin client). Extension: ten tu khai.
  var author = caller.via === 'web' ? caller.name : (caller.name || String(data.createdBy || '').trim().slice(0, 60));
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  var now = new Date();

  if (data.id) {
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) !== String(data.id)) continue;
      var cur = _tplRowToObj_(vals[i]);
      if (caller.priv) {
        sh.getRange(i + 1, 2, 1, 3).setValues([[title, content, tags]]);
        sh.getRange(i + 1, 5).setValue(cur.createdBy || author);
        sh.getRange(i + 1, 7, 1, 4).setValues([[now, product, topic, cur.status]]);
        return jsonOut_({ ok: true, id: cur.id, status: cur.status });
      }
      if (cur.status === 'approved' || !_tplOwns_(cur, caller)) {
        return jsonOut_({ error: 'Chi admin/quan ly moi duoc sua mau da duyet. Hay tao mau moi de de xuat.', code: 'FORBIDDEN' });
      }
      sh.getRange(i + 1, 2, 1, 3).setValues([[title, content, tags]]);
      sh.getRange(i + 1, 7, 1, 4).setValues([[now, product, topic, 'pending']]);
      sh.getRange(i + 1, 11, 1, 3).setValues([['', '', '']]);
      return jsonOut_({ ok: true, id: cur.id, status: 'pending' });
    }
  }
  // Tao moi. Chi admin/quan ly moi duoc tu dat id (dong bo cu); nguoi khac luon nhan id moi (khong chiem id).
  var newId = (caller.priv && data.id) ? String(data.id) : 'mt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var status = caller.priv ? 'approved' : 'pending';
  sh.appendRow([newId, title, content, tags, author, now, now, product, topic, status, caller.priv ? author : '', caller.priv ? now : '', '']);
  return jsonOut_({ ok: true, id: newId, status: status });
}

function deleteMessageTemplate_(id, caller) {
  caller = caller || { priv: false, name: '' };
  if (!id) return jsonOut_({ error: 'Thieu id mau tin can xoa' });
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      var cur = _tplRowToObj_(vals[i]);
      if (!caller.priv && (cur.status === 'approved' || !_tplOwns_(cur, caller))) {
        return jsonOut_({ error: 'Chi admin/quan ly moi duoc xoa mau da duyet (nhan vien chi xoa duoc mau cua minh chua duyet).', code: 'FORBIDDEN' });
      }
      sh.deleteRow(i + 1);
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ ok: true, note: 'Khong tim thay id (co the da bi xoa truoc do)' });
}

// decision: 'approve' | 'reject'. CHI admin/quan ly (theo vai tro that trong sheet Users, qua token phien).
function approveMessageTemplate_(id, decision, reason, caller) {
  if (!caller || !caller.priv) return jsonOut_({ error: 'Chi admin / quan ly moi duoc duyet mau tin.', code: 'FORBIDDEN' });
  decision = String(decision || '').toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') return jsonOut_({ error: 'decision phai la approve hoac reject' });
  if (!id) return jsonOut_({ error: 'Thieu id mau tin' });
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) !== String(id)) continue;
    var st = decision === 'approve' ? 'approved' : 'rejected';
    sh.getRange(i + 1, 10, 1, 4).setValues([[st, caller.name, new Date(), decision === 'reject' ? String(reason || '').trim().slice(0, 300) : '']]);
    return jsonOut_({ ok: true, id: String(id), status: st });
  }
  return jsonOut_({ error: 'Khong tim thay mau tin' });
}


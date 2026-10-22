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
  if (!old && rec.flowId) {
    var flow0_ = _taskFlowById_(rec.flowId), st0_ = flow0_.stages[0];
    _taskSysComment_(id, rec.createdBy, 'đã tạo công việc, bắt đầu giai đoạn "' + st0_.name + '"', 'system', '');
    _notifyTaskEvent_((rec.stageAssignees || {})[st0_.id] || [], { name: rec.createdBy, aliases: [rec.createdBy] }, 'task_assign', rec,
                      'giao bạn xử lý giai đoạn "' + st0_.name + '" của việc "' + rec.title + '"');
  } else if (!old && (rec.csAssigned || []).length) {
    _notifyTaskEvent_(rec.csAssigned, { name: rec.createdBy, aliases: [rec.createdBy] }, 'task_assign', rec, 'giao bạn công việc "' + rec.title + '"');
  }
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
    if (opts.onlyUsers) tos = tos.filter(function (x) { return opts.onlyUsers[x] === 1; });   // vd. thao luan khach: chi bao cho nguoi co quyen xem
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
  // Nguoi duoc tag do SERVER tinh (cung bo phan tich voi thong bao @tag: khop ten hien thi / ten dang nhap) -> ten hien thi,
  // hop voi c.mentions client gui. Luu vao comment + gop vao Tasks.mentions (de loc "Toi duoc tag" khong phai quet TaskComments).
  var tagNames = _taskMentionNames_(c.content, c.mentions);
  sh.appendRow([id, String(c.taskId), c.author || 'Ẩn danh', c.content || '',
                JSON.stringify(c.images || []), now,
                JSON.stringify(c.files || []), JSON.stringify(tagNames), 'comment', '']);
  _notifyMentions_({ text: c.content, from: c.author, kind: 'comment', refType: 'task', refId: c.taskId, refId2: id });
  if (tagNames.length) {
    try {
      var shT = getSheet_(SH_TASK, TASK_HEADERS), ft = _taskFind_(shT, c.taskId);
      if (ft) {
        var merged = (ft.task.mentions || []).slice();
        tagNames.forEach(function (n) { if (merged.indexOf(n) < 0) merged.push(n); });
        if (merged.length !== (ft.task.mentions || []).length) shT.getRange(ft.rowIdx, 18).setValue(JSON.stringify(merged));
      }
    } catch (e) { /* loi gop mentions khong duoc lam hong viec luu binh luan */ }
  }
  return jsonOut_({ ok: true, id: id });
}

// ── Danh tinh nguoi thao tac + ten hien thi nguoi duoc tag (dung chung cho quy trinh cong viec) ──
// Co token phien hop le -> lay nguoi THAT tu sheet Users (khong tin truong `by` client gui, chong gia danh);
// khong co token (client cu / extension) -> tam dung `by` (chua bat buoc xac thuc: xem docs/SECURITY-PLAN.md).
function _taskActor_(p) {
  var su = null;
  try { su = (p && p.token) ? _sessUser_(p.token) : null; } catch (e) { su = null; }
  if (su) {
    var al = [su.name, su.username].filter(function (x) { return x; }).map(String);
    return { name: String(su.name || su.username), aliases: al, username: String(su.username || ''), verified: true, role: String(su.role || '') };
  }
  var by = String((p && p.by) || '').trim();
  return by ? { name: by, aliases: [by], username: '', verified: false, role: '' } : null;
}
// Admin ep chuyen tiep: HUY moi yeu cau duyet dang cho cua viec (status=cancelled) de viec khong ket
function _taskCancelPending_(taskId, actor) {
  var rsh = getSheet_(SH_TASK_REQ, TASK_REQ_HEADERS), last = rsh.getLastRow(), n = 0;
  if (last < 2) return 0;
  var v = rsh.getRange(2, 1, last - 1, TASK_REQ_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1]) === String(taskId) && String(v[i][6]) === 'pending') {
      rsh.getRange(i + 2, 7, 1, 4).setValues([['cancelled', actor.name, new Date().toISOString(), 'Admin ép chuyển']]); n++;
    }
  }
  return n;
}
function _taskInList_(list, actor) {
  if (!actor) return false;
  var low = {}; actor.aliases.forEach(function (a) { low[String(a).trim().toLowerCase()] = 1; });
  return (list || []).some(function (n) { return !!low[String(n || '').trim().toLowerCase()]; });
}
// text + mentions client gui -> mang TEN HIEN THI duy nhat (server tin bo phan tich cua no, gop them client de khong mat tag cu)
function _taskMentionNames_(text, clientMentions) {
  var out = [];
  try {
    var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
    var byUn = {}; users.forEach(function (u) { byUn[String(u.username)] = u; });
    _notifParseMentions_(text, users).forEach(function (un) { var u = byUn[un]; var n = u ? String(u.name || u.username) : un; if (out.indexOf(n) < 0) out.push(n); });
  } catch (e) { /* bo qua */ }
  (clientMentions || []).forEach(function (n) { n = String(n || '').trim(); if (n && out.indexOf(n) < 0) out.push(n); });
  return out;
}

// ── THONG BAO SU KIEN QUY TRINH (M6): ghi vao sheet Notifications co san (cung kenh voi thong bao @tag; client js/39-fn-notify.js hien) ──
// names = TEN HIEN THI nguoi nhan (assignees luu theo ten) -> doi sang username qua sheet Users. Khong bao chinh nguoi thao tac.
// kind: task_assign | task_turn | task_request | task_decision | task_done. Loi bi nuot — thong bao KHONG BAO GIO lam hong thao tac that.
function _notifyTaskEvent_(names, actor, kind, task, text) {
  try {
    var users = readUsers_(getCrmSS_().getSheetByName(SH_USER)), tos = {}, order = [];
    var self = actor || { aliases: [] };
    (names || []).forEach(function (n) {
      var key = String(n || '').trim().toLowerCase(); if (!key) return;
      users.forEach(function (u) {
        if (u.active === false) return;
        var al = [u.name, u.username].concat(u.names || []).map(function (x) { return String(x || '').trim().toLowerCase(); });
        if (al.indexOf(key) < 0) return;
        if (_taskInList_([u.name, u.username], self)) return;   // khong tu bao minh
        if (!tos[u.username]) { tos[u.username] = 1; order.push(String(u.username)); }
      });
    });
    if (!order.length) return 0;
    var sh = getSheet_(SH_NOTIF, NOTIF_HEADERS), now = new Date().toISOString();
    var snip = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    var rows = order.map(function (to, i) {
      return ['nt_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1000), to, (actor && actor.name) || 'Hệ thống', kind,
              'task', String(task.id), '', snip, now, ''];
    });
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIF_HEADERS.length).setValues(rows);
    return rows.length;
  } catch (e) { return 0; }
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
  var flowsNow_ = readTaskFlows_(); // dam bao sheet + mau da khoi tao
  // Viec dang chay luu stageIdx THEO THU TU -> neu quy trinh dang co viec dung thi CAM chen/xoa/doi thu tu giai doan
  // (se lam lech tien do, hoac mo lai viec da hoan thanh). Chi cho doi ten + co "can duyet". Muon doi cau truc: nhan ban.
  if (f.id) {
    var oldFlow_ = null; flowsNow_.forEach(function (x) { if (x.id === String(f.id)) oldFlow_ = x; });
    if (oldFlow_) {
      var usedN_ = readTasks_(getSheet_(SH_TASK, TASK_HEADERS)).filter(function (t) { return t.flowId === String(f.id); }).length;
      var oldIds_ = oldFlow_.stages.map(function (x) { return x.id; }).join('|');
      var newIds_ = stages.map(function (x) { return x.id; }).join('|');
      if (usedN_ && oldIds_ !== newIds_) return jsonOut_({ error: 'Co ' + usedN_ + ' cong viec dang dung quy trinh nay — chi duoc doi ten giai doan / co "can duyet". Muon doi cau truc hay nhan ban thanh quy trinh moi.' });
    }
  }
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
function _taskDoAdvance_(sh, found, flow, by, note, approvedBy, actor) {
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
  actor = actor || { name: by, aliases: [by] };
  if (t.stageIdx >= flow.stages.length) {
    _notifyTaskEvent_([t.createdBy], actor, 'task_done', t, 'công việc "' + t.title + '" đã HOÀN THÀNH');
  } else {
    var nx2 = flow.stages[t.stageIdx];
    _notifyTaskEvent_((t.stageAssignees || {})[nx2.id] || [], actor, 'task_turn', t, 'đã chuyển tiếp — đến lượt bạn xử lý giai đoạn "' + nx2.name + '" của việc "' + t.title + '"');
  }
  return t;
}

// Nguoi phu trach buoc hien tai bam "Chuyen tiep". Danh tinh: token phien (neu co) > truong `by`.
function taskAdvance_(p) {
  var actor = _taskActor_(p);
  if (!p || !p.taskId || !actor) return jsonOut_({ error: 'Thieu taskId/by' });
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
    // ADMIN EP CHUYEN: chi khi co token phien that cua admin (khong tin co `force`/`by` tu client): bo qua quyen phu trach + buoc duyet
    if (p.force) {
      if (!(actor.verified && actor.role === 'admin')) return jsonOut_({ error: 'Chi admin (dang dang nhap) moi duoc ep chuyen tiep' });
      var cancelled = _taskCancelPending_(t.id, actor);
      var ntF = _taskDoAdvance_(sh, found, flow, actor.name, 'ADMIN ÉP CHUYỂN' + (cancelled ? ' (đã hủy ' + cancelled + ' yêu cầu duyệt đang chờ)' : '') + (p.note ? '. ' + p.note : ''), '', actor);
      return jsonOut_({ ok: true, forced: true, stageIdx: ntF.stageIdx, status: ntF.status });
    }
    if (!_taskInList_(assignees, actor) && !_taskInList_([t.createdBy], actor)) {
      return jsonOut_({ error: 'Ban khong phai nguoi phu trach giai doan "' + cur.name + '"' });
    }
    if (readTaskRequests_(t.id, true).length) return jsonOut_({ error: 'Dang cho nguoi duyet — chua the chuyen tiep' });
    var isLast = t.stageIdx >= flow.stages.length - 1;
    if (cur.approval) {
      var apr = (t.stageApprovers || {})[cur.id] || [];
      if (!apr.length && !isLast) apr = (t.stageAssignees || {})[flow.stages[t.stageIdx + 1].id] || [];
      apr = apr.filter(function (n) { return !_taskInList_([n], actor); });
      if (!apr.length) return jsonOut_({ error: 'Giai doan "' + cur.name + '" can nguoi duyet nhung chua chon ai (hoac chi co chinh ban)' });
      var rsh = getSheet_(SH_TASK_REQ, TASK_REQ_HEADERS);
      var rid = 'rq_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var to = isLast ? '' : flow.stages[t.stageIdx + 1].id;
      rsh.appendRow([rid, t.id, cur.id, to, actor.name, JSON.stringify(apr), 'pending', '', '', p.note || '', new Date().toISOString()]);
      _taskSysComment_(t.id, actor.name, 'gửi YÊU CẦU DUYỆT để rời giai đoạn "' + cur.name + '" — chờ: ' + apr.join(', ') + (p.note ? '. Ghi chú: ' + p.note : ''), 'request', rid);
      _notifyTaskEvent_(apr, actor, 'task_request', t, 'xin bạn duyệt chuyển tiếp giai đoạn "' + cur.name + '" của việc "' + t.title + '"' + (p.note ? ' — ' + p.note : ''));
      return jsonOut_({ ok: true, pending: true, requestId: rid });
    }
    var nt = _taskDoAdvance_(sh, found, flow, actor.name, p.note || '', '', actor);
    return jsonOut_({ ok: true, stageIdx: nt.stageIdx, status: nt.status });
  } finally { lock.releaseLock(); }
}

// DOI NGUOI PHU TRACH (assignees) va/hoac NGUOI DUYET (approvers) cua 1 giai doan CHUA XONG (nguoi nghi/qua tai).
// Quyen: admin (token that) | nguoi tao viec | nguoi dang phu trach giai doan HIEN TAI. Giai doan da xong khong doi (giu lich su).
// Neu giai doan hien tai dang co YEU CAU DUYET cho -> cap nhat luon danh sach nguoi duyet cua yeu cau do (khong de viec ket
// vi nguoi duyet cu nghi). Nguoi MOI duoc thong bao.
function taskReassign_(p) {
  var actor = _taskActor_(p);
  if (!p || !p.taskId || !p.stageId || !actor) return jsonOut_({ error: 'Thieu taskId/stageId' });
  var hasAs = Array.isArray(p.assignees), hasAp = Array.isArray(p.approvers);
  if (!hasAs && !hasAp) return jsonOut_({ error: 'Thieu danh sach nguoi' });
  function clean(a) { var o = []; (a || []).forEach(function (n) { n = String(n || '').trim(); if (n && o.indexOf(n) < 0) o.push(n); }); return o; }
  var names = hasAs ? clean(p.assignees) : null, aps = hasAp ? clean(p.approvers) : null;
  if (hasAs && !names.length) return jsonOut_({ error: 'Giai doan can it nhat 1 nguoi phu trach' });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return jsonOut_({ error: 'He thong ban, thu lai' }); }
  try {
    var sh = getSheet_(SH_TASK, TASK_HEADERS);
    var found = _taskFind_(sh, p.taskId);
    if (!found) return jsonOut_({ error: 'Khong tim thay cong viec' });
    var t = found.task, flow = t.flowId ? _taskFlowById_(t.flowId) : null;
    if (!flow) return jsonOut_({ error: 'Cong viec khong co quy trinh' });
    var idx = -1; flow.stages.forEach(function (x, i) { if (x.id === String(p.stageId)) idx = i; });
    if (idx < 0) return jsonOut_({ error: 'Khong tim thay giai doan' });
    if (idx < t.stageIdx || t.stageIdx >= flow.stages.length) return jsonOut_({ error: 'Giai doan nay da xong, khong doi nguoi duoc' });
    var st = flow.stages[idx], curStage = flow.stages[t.stageIdx];
    if (hasAp && !st.approval) return jsonOut_({ error: 'Giai doan "' + st.name + '" khong can nguoi duyet' });
    var isAdmin = actor.verified && actor.role === 'admin';
    if (!isAdmin && !_taskInList_([t.createdBy], actor) && !_taskInList_((t.stageAssignees || {})[curStage.id] || [], actor)) {
      return jsonOut_({ error: 'Chi admin, nguoi tao viec hoac nguoi dang phu trach moi duoc doi nguoi phu trach' });
    }
    t.stageAssignees = t.stageAssignees || {}; t.stageApprovers = t.stageApprovers || {};
    var oldNames = t.stageAssignees[st.id] || [], oldAps = t.stageApprovers[st.id] || [];
    if (hasAs) t.stageAssignees[st.id] = names;
    // yeu cau duyet DANG CHO cua giai doan nay -> doi nguoi duyet cua yeu cau (tinh truoc khi ghi bat ky thu gi)
    var pend = null, effAps = null;
    if (hasAp && idx === t.stageIdx) {
      readTaskRequests_(t.id, true).forEach(function (q) { if (q.fromStageId === st.id) pend = q; });
      if (pend) {
        effAps = aps.slice();
        if (!effAps.length && idx < flow.stages.length - 1) effAps = (t.stageAssignees[flow.stages[idx + 1].id] || []).slice();
        effAps = effAps.filter(function (n) { return String(n).toLowerCase() !== String(pend.requestedBy).toLowerCase(); });
        if (!effAps.length) return jsonOut_({ error: 'Dang co yeu cau cho duyet — phai co it nhat 1 nguoi duyet (khac nguoi gui)' });
      }
    }
    if (hasAp) t.stageApprovers[st.id] = aps;
    var all = {}; Object.keys(t.stageAssignees).forEach(function (k) { (t.stageAssignees[k] || []).forEach(function (n) { all[n] = 1; }); });
    t.csAssigned = Object.keys(all); t.updatedAt = new Date().toISOString();
    sh.getRange(found.rowIdx, 1, 1, TASK_HEADERS.length).setValues([_taskToRow_(t)]);
    var parts = [];
    if (hasAs) parts.push('người phụ trách: ' + (oldNames.join(', ') || '—') + ' → ' + names.join(', '));
    if (hasAp) parts.push('người duyệt: ' + (oldAps.join(', ') || '—') + ' → ' + (aps.join(', ') || '—'));
    _taskSysComment_(t.id, actor.name, 'đổi ' + parts.join('; ') + ' (giai đoạn "' + st.name + '")', 'system', '');
    if (hasAs) {
      var added = names.filter(function (n) { return oldNames.indexOf(n) < 0; });
      _notifyTaskEvent_(added, actor, idx === t.stageIdx ? 'task_turn' : 'task_assign', t,
        (idx === t.stageIdx ? 'giao bạn xử lý ngay giai đoạn "' : 'giao bạn phụ trách giai đoạn "') + st.name + '" của việc "' + t.title + '"');
    }
    if (pend) {
      var rsh = getSheet_(SH_TASK_REQ, TASK_REQ_HEADERS), lr = rsh.getLastRow();
      var cell = lr >= 2 ? rsh.getRange(2, 1, lr - 1, 1).createTextFinder(String(pend.id)).matchEntireCell(true).findNext() : null;
      if (cell) rsh.getRange(cell.getRow(), 6).setValue(JSON.stringify(effAps));
      var addedAp = effAps.filter(function (n) { return (pend.approvers || []).indexOf(n) < 0; });
      _notifyTaskEvent_(addedAp, actor, 'task_request', t, 'xin bạn duyệt chuyển tiếp giai đoạn "' + st.name + '" của việc "' + t.title + '" (đổi người duyệt)');
    }
    return jsonOut_({ ok: true, assignees: t.stageAssignees[st.id], approvers: t.stageApprovers[st.id] || [] });
  } finally { lock.releaseLock(); }
}

// Nguoi duyet Chap nhan / Tu choi 1 yeu cau chuyen buoc.
function taskRequestDecide_(p) {
  var actor = _taskActor_(p);
  if (!p || !p.requestId || !actor) return jsonOut_({ error: 'Thieu requestId/by' });
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
    if (!_taskInList_(approvers, actor)) return jsonOut_({ error: 'Ban khong nam trong danh sach nguoi duyet' });
    var now = new Date().toISOString();
    rsh.getRange(rowIdx, 7, 1, 4).setValues([[approve ? 'approved' : 'rejected', actor.name, now, p.note || String(r[9] || '')]]);
    var sh = getSheet_(SH_TASK, TASK_HEADERS);
    var found = _taskFind_(sh, String(r[1]));
    if (!found) return jsonOut_({ ok: true });
    var requester = String(r[4]);
    if (!approve) {
      _taskSysComment_(found.task.id, actor.name, 'TỪ CHỐI yêu cầu chuyển tiếp' + (p.note ? ': ' + p.note : '') + ' — giai đoạn hiện tại giữ nguyên', 'system', String(r[0]));
      _notifyTaskEvent_([requester], actor, 'task_decision', found.task, 'đã TỪ CHỐI yêu cầu chuyển tiếp việc "' + found.task.title + '"' + (p.note ? ': ' + p.note : ''));
      return jsonOut_({ ok: true, rejected: true });
    }
    var flow = _taskFlowById_(found.task.flowId);
    if (!flow || found.task.stageIdx >= flow.stages.length) return jsonOut_({ ok: true });
    if (flow.stages[found.task.stageIdx].id !== String(r[2])) return jsonOut_({ error: 'Cong viec da doi giai doan, yeu cau khong con hieu luc' });
    _notifyTaskEvent_([requester], actor, 'task_decision', found.task, 'đã CHẤP NHẬN yêu cầu chuyển tiếp việc "' + found.task.title + '"');
    var nt = _taskDoAdvance_(sh, found, flow, requester, '', actor.name, actor);
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
var MSG_TPL_HEADERS = ['id', 'title', 'content', 'tags', 'createdBy', 'createdAt', 'updatedAt', 'product', 'topic', 'status', 'approvedBy', 'approvedAt', 'rejectReason', 'nhom'];
// nhom = NHOM SAN PHAM (cot 'Nhom SP' bang gia DANH_MUC) — Duyen 21/10/2026 "tao mau luu san": CS chon nhom/ten SP roi them mau tu van de AI hoc.
// Nhom do nguoi soan CHON tay -> ghi vao cot; de TRONG = he thong TU PHAN LOAI khi doc (khong ghi vao sheet: doi danh muc thi mau tu nhay theo nhom moi). Xem _tplClassify_.
// Ai duoc duyet / sua / xoa MAU DA DUYET / tao mau thang o trang thai da duyet. Doi danh sach nay neu muon them vai tro (vd 'leader').
var MSG_TPL_APPROVER_ROLES_ = ['admin'];   // 4c-3: CHI admin duyet/sua/xoa mau chuan (truoc day co 'manager')
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
    approvedBy: String(row[10] || ''), approvedAt: row[11] || '', rejectReason: String(row[12] || ''),
    nhom: String(row[13] || '').trim()   // nhom do nguoi soan chon ('' = chua chon; readMessageTemplates_ se dien nhom tu phan loai)
  };
}
// ── Nhom san pham cua mau tin (2026-10-16) ──
// Danh sach nhom + ten san pham lay tu DANH_MUC (buildPriceCatalogFlat_). Chi so nho (khoang vai chuc KB) duoc cache 10 phut
// de moi lan doc mau khong phai doc lai ca sheet gia. Loi doc DANH_MUC KHONG duoc lam hong viec doc mau -> chi so rong, mau hien nhu 'chung'.
var _tplCatIdxMemo_ = null;
var MSG_TPL_CAT_CACHE_KEY_ = 'tplcat_v1';
// Chuan hoa GIU DAU (chu thuong, bo ky tu la): 'nhan' (nhan vien) va 'nhan' (nhan vang) khac nhau -> khong phan loai nham mau ve nhan vien vao nhom Nhan.
function _tplFoldAcc_(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFC').replace(/[^a-z0-9\u00e0-\u1ef9]+/g, ' ').trim(); }
function _tplCatalogIndex_() {
  if (_tplCatIdxMemo_) return _tplCatIdxMemo_;
  var idx = null;
  try { var c = CacheService.getScriptCache().get(MSG_TPL_CAT_CACHE_KEY_); if (c) idx = JSON.parse(c); } catch (e0) { idx = null; }
  if (!idx || !idx.groups) {
    idx = { groups: [], names: [] };
    try {
      var items = (buildPriceCatalogFlat_().items) || [], gIdx = {}, nameMap = {};
      items.forEach(function (it) {
        var g = String(it.n || '').trim(); if (!g) return;
        if (gIdx[g] === undefined) { gIdx[g] = idx.groups.length; idx.groups.push(g); }
        [it.t, it.m].forEach(function (nm) {
          var f = _tplFoldAcc_(nm); if (f.length < 3) return;
          if (!nameMap[f]) nameMap[f] = {}; nameMap[f][gIdx[g]] = 1;
        });
      });
      // Ten san pham xuat hien o >= 2 nhom la mo ho -> khong dung de phan loai (tranh doan sai)
      Object.keys(nameMap).forEach(function (f) { var gs = Object.keys(nameMap[f]); if (gs.length === 1) idx.names.push([f, +gs[0]]); });
      try { CacheService.getScriptCache().put(MSG_TPL_CAT_CACHE_KEY_, JSON.stringify(idx), 600); } catch (e1) {}   // qua 100KB thi bo qua cache
    } catch (e2) { idx = { groups: [], names: [] }; }
  }
  _tplCatIdxMemo_ = idx;
  return idx;
}
// Tu phan loai: cham diem moi nhom = tong do dai cac ten san pham (va ten nhom, nhan doi) xuat hien NGUYEN TU trong tieu de/tag/san pham/chu de/noi dung.
// Khop GIU DAU; chi ten >= 2 tu moi duoc khop khi bo dau (nguoi go 'lac tay bac' khong dau). Hoa diem (2 nhom bang nhau) hoac khong khop gi -> ''
// (mau 'chung') — thua con hon phan loai sai. Mau chao hoi chung khong nhac san pham nao -> chung.
function _tplClassify_(t, idx) {
  idx = idx || _tplCatalogIndex_();
  if (!idx.groups.length) return '';
  var acc = ' ' + _tplFoldAcc_([t.title, t.tags, t.product, t.topic, t.content].join(' ')) + ' ';
  var plain = ' ' + _stripVN_(acc).trim() + ' ';
  function hit(name) {
    if (acc.indexOf(' ' + name + ' ') !== -1) return true;
    var pl = _stripVN_(name);
    return pl.indexOf(' ') !== -1 && plain.indexOf(' ' + pl + ' ') !== -1;
  }
  var score = {};
  idx.groups.forEach(function (g, gi) { var f = _tplFoldAcc_(g); if (f.length >= 3 && hit(f)) score[gi] = (score[gi] || 0) + f.length * 2; });
  idx.names.forEach(function (p) { if (hit(p[0])) score[p[1]] = (score[p[1]] || 0) + p[0].length; });
  var best = -1, bestSc = 0, tie = false;
  Object.keys(score).forEach(function (k) {
    if (score[k] > bestSc) { best = +k; bestSc = score[k]; tie = false; } else if (score[k] === bestSc) tie = true;
  });
  return (best >= 0 && !tie) ? idx.groups[best] : '';
}
// Danh sach nhom cho dropdown: nhom trong DANH_MUC (thu tu A-Z) + nhom da chon tay ma DANH_MUC khong con (de van sua/loc duoc)
function _tplGroupList_(list) {
  var idx = _tplCatalogIndex_(), seen = {}, out = [];
  idx.groups.forEach(function (g) { var k = _tplFoldAcc_(g); if (!seen[k]) { seen[k] = 1; out.push(g); } });
  (list || []).forEach(function (t) { if (t.nhom && !t.nhomAuto) { var k = _tplFoldAcc_(t.nhom); if (!seen[k]) { seen[k] = 1; out.push(t.nhom); } } });
  return out.sort(function (a, b) { return String(a).localeCompare(String(b), 'vi'); });
}
function _tplOwns_(t, c) { return !!(c && c.name) && String(t.createdBy || '').trim().toLowerCase() === c.name.toLowerCase(); }

// caller: admin thay TAT CA; nhan vien (web/extension, caller.role != 'anon') thay mau DA DUYET + mau CHO DUYET cua MOI NGUOI (Duyen 21/10/2026: cs khac xem duoc ca kho da duyet va chua duyet)
// + mau BI TU CHOI cua chinh minh. An danh / khong truyen caller = chi mau da duyet.
function readMessageTemplates_(caller) {
  caller = caller || { priv: false, name: '' };
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (!row[0]) continue; // bo dong trong (id rong)
    var t = _tplRowToObj_(row);
    var seePending = caller.role && caller.role !== 'anon';
    if (caller.priv || t.status === 'approved' || (seePending && t.status === 'pending') || _tplOwns_(t, caller)) out.push(t);
  }
  // Nhom: nguoi soan chon tay thi giu; de trong thi he thong tu phan loai (nhomAuto=true de UI ghi chu '(tu phan loai)')
  var cidx = null;
  out.forEach(function (t) {
    t.nhomAuto = false;
    if (t.nhom) return;
    if (!cidx) cidx = _tplCatalogIndex_();
    var g = _tplClassify_(t, cidx);
    if (g) { t.nhom = g; t.nhomAuto = true; }
  });
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
  // nhom: chuoi (ke ca rong = ve 'tu phan loai') -> ghi; KHONG gui truong nay (extension cu) -> giu nguyen nhom hien co.
  var nhomSet = (data.nhom !== undefined && data.nhom !== null);
  var nhom = nhomSet ? String(data.nhom).trim().slice(0, 200) : '';
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
        if (nhomSet) sh.getRange(i + 1, MSG_TPL_HEADERS.indexOf('nhom') + 1).setValue(nhom);
        return jsonOut_({ ok: true, id: cur.id, status: cur.status });
      }
      if (cur.status === 'approved' || !_tplOwns_(cur, caller)) {
        return jsonOut_({ error: 'Chi admin/quan ly moi duoc sua mau da duyet. Hay tao mau moi de de xuat.', code: 'FORBIDDEN' });
      }
      sh.getRange(i + 1, 2, 1, 3).setValues([[title, content, tags]]);
      sh.getRange(i + 1, 7, 1, 4).setValues([[now, product, topic, 'pending']]);
      sh.getRange(i + 1, 11, 1, 3).setValues([['', '', '']]);
      if (nhomSet) sh.getRange(i + 1, MSG_TPL_HEADERS.indexOf('nhom') + 1).setValue(nhom);
      _tplNotifyPending_(cur.id, title, author);   // mau da sua -> cho duyet lai: bao admin
      return jsonOut_({ ok: true, id: cur.id, status: 'pending' });
    }
  }
  // Tao moi. Chi admin/quan ly moi duoc tu dat id (dong bo cu); nguoi khac luon nhan id moi (khong chiem id).
  var newId = (caller.priv && data.id) ? String(data.id) : 'mt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var status = caller.priv ? 'approved' : 'pending';
  sh.appendRow([newId, title, content, tags, author, now, now, product, topic, status, caller.priv ? author : '', caller.priv ? now : '', '', nhom]);
  if (status === 'pending') _tplNotifyPending_(newId, title, author);   // de xuat mau moi -> bao admin duyet
  return jsonOut_({ ok: true, id: newId, status: status });
}

// AI HOC TU MAU DA LUU (Duyen 21/10/2026): chi mau DA DUYET (admin luu hoac admin duyet) moi vao prompt. Khop khi TEN SAN PHAM / NHOM SP / CHU DE / TAG cua mau
// xuat hien trong yeu cau (khong dau, khong phan biet hoa thuong). Toi da 3 mau, moi mau cat 500 ky tu -> prompt van nhe. Loi doc sheet KHONG lam hong AI.
function _tplPromptBlock_(userMsg) {
  var q = ' ' + _psheetNoAccent_(userMsg).replace(/\s+/g, ' ') + ' ';
  if (q.length < 4) return '';
  var list;
  try { list = readMessageTemplates_({ priv: false, name: '' }); } catch (e) { return ''; }
  var scored = [];
  list.forEach(function (t) {
    if (t.status !== 'approved') return;
    var keys = String(t.product || '').split(/[,;|\n]/).concat(String(t.nhom || '').split(/[,;|\n]/), String(t.topic || ''), String(t.tags || '').split(','));
    var sc = 0;
    keys.forEach(function (k) {
      k = _psheetNoAccent_(k).replace(/\s+/g, ' ').trim();
      if (k.length >= 3 && q.indexOf(' ' + k) >= 0) sc += k.length;   // dau ' ' truoc: khop dau tu, tranh khop giua tu
    });
    if (sc) scored.push({ t: t, sc: sc });
  });
  if (!scored.length) return '';
  scored.sort(function (a, b) { return b.sc - a.sc; });
  return scored.slice(0, 3).map(function (x, i) {
    var c = String(x.t.content || ''); if (c.length > 500) c = c.substring(0, 500) + '...';
    return 'Mau ' + (i + 1) + ' (' + (x.t.product || x.t.nhom || x.t.title) + (x.t.topic ? ' - ' + x.t.topic : '') + '):\n' + c;
  }).join('\n\n');
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
      _tplNotifClear_(id);   // mau bi xoa -> khong con gi de duyet
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
    _tplNotifClear_(id);   // da xu ly (o CRM HOAC o extension) -> thong bao cua MOI admin chuyen 'da doc'
    return jsonOut_({ ok: true, id: String(id), status: st });
  }
  return jsonOut_({ error: 'Khong tim thay mau tin' });
}
// ── THONG BAO MAU TIN CHO DUYET (kind 'tplpending', refType 'tpl', refId = id mau) ──
// NGUYEN NHAN GOC them: admin chi biet co mau cho duyet khi tu mo tab Quan ly mau (huy hieu 'n mau cho duyet'), nen mau cua nhan vien nam cho lau.
// Nay: nhan vien de xuat/sua mau -> moi admin (MSG_TPL_APPROVER_ROLES_) nhan thong bao tren CRM (chuong); extension Pancake AI doc cung nguon qua action tplPending.
// Dung 1 thong bao CHUA DOC cho moi (admin, mau) -> sua mau nhieu lan khong spam. Duyet/tu choi xong (o dau cung duoc) -> don het thong bao cua mau do.
function _tplNotifyPending_(id, title, author) {
  try {
    var users = readUsers_(getCrmSS_().getSheetByName(SH_USER)) || [], me = String(author || '').trim().toLowerCase(), to = [];
    users.forEach(function (u) {
      if (!u || u.active === false || MSG_TPL_APPROVER_ROLES_.indexOf(String(u.role || '')) < 0) return;
      if ([u.name, u.username].some(function (x) { return String(x || '').trim().toLowerCase() === me && me; })) return;   // khong tu bao minh
      to.push(String(u.username));
    });
    if (!to.length) return 0;
    var sh = getSheet_(SH_NOTIF, NOTIF_HEADERS), v = sh.getLastRow() >= 2 ? sh.getDataRange().getValues() : [], has = {};
    for (var i = 1; i < v.length; i++) { if (String(v[i][4]) === 'tpl' && String(v[i][5]) === String(id) && !v[i][9]) has[String(v[i][1]).toLowerCase()] = 1; }
    var now = new Date().toISOString(), txt = ('Mau tin cho duyet: ' + String(title || '').replace(/\s+/g, ' ').trim()).slice(0, 160), rows = [];
    to.forEach(function (u, k) {
      if (has[u.toLowerCase()]) return;
      rows.push(['nt_' + Date.now() + '_tpl' + k + '_' + Math.floor(Math.random() * 1000), u, String(author || 'Nhan vien'), 'tplpending', 'tpl', String(id), '', txt, now, '']);
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, NOTIF_HEADERS.length).setValues(rows);
    return rows.length;
  } catch (e) { return 0; }   // thong bao hong khong duoc lam hong viec luu mau
}
function _tplNotifClear_(id) {
  try {
    var sh = getCrmSS_().getSheetByName(SH_NOTIF); if (!sh || sh.getLastRow() < 2) return 0;
    var v = sh.getDataRange().getValues(), now = new Date().toISOString(), n = 0;
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][4]) === 'tpl' && String(v[i][5]) === String(id) && !v[i][9]) { sh.getRange(i + 1, 10).setValue(now); n++; }
    }
    return n;
  } catch (e) { return 0; }
}
// Danh sach mau CHO DUYET (nhe, cho extension Pancake AI hoi dinh ky). Chi admin/quan ly (theo token phien).
function tplPendingList_(caller) {
  if (!caller || !caller.priv) return jsonOut_({ error: 'Chi admin / quan ly moi xem duoc mau cho duyet.', code: 'FORBIDDEN' });
  var list = readMessageTemplates_(caller).filter(function (t) { return t.status === 'pending'; });
  list.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
  return jsonOut_({ ok: true, count: list.length, serverTime: new Date().toISOString(),
    items: list.slice(0, 30).map(function (t) { return { id: t.id, title: t.title, content: String(t.content || '').slice(0, 1200), product: t.product || '', topic: t.topic || '', createdBy: t.createdBy || '', createdAt: t.createdAt || '' }; }) });
}


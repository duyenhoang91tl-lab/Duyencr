#!/usr/bin/env node
// Test R6a — bảng công việc dạng cột (js/70-task-board.js). Logic thuần + (nếu có jsdom) kéo thả/nút ‹ ›. Chạy: node tools/test-task-board.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), path = require('path');
const m = require('../js/70-task-board.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const FLOW = { id: 'f1', name: 'Hoàn tiền', stages: [{ id: 'a', name: 'Đề nghị', approval: false }, { id: 'b', name: 'Xác nhận', approval: true }, { id: 'c', name: 'Chi', approval: false }] };
const FLOWS = [FLOW];
const T = (o) => Object.assign({ id: 'x', title: 't', status: 'Chưa làm', csAssigned: [], createdBy: 'Sếp', deadline: '', flowId: '', stageIdx: 0, stageAssignees: {}, pendingReq: [] }, o);

// ── cột ──
ok(m.tbColumns_('', FLOWS).map(c => c.key).join() === 'Chưa làm,Đang làm,Hoàn thành', 'không quy trình → 3 cột trạng thái');
ok(m.tbColumns_('f1', FLOWS).map(c => c.key).join() === 'a,b,c,__done', 'có quy trình → giai đoạn + __done');
ok(m.tbColumns_('f1', FLOWS)[1].approval === true, 'giai đoạn cần duyệt được đánh dấu');
ok(m.tbColumns_('khong-co', FLOWS).length === 3, 'quy trình không tồn tại → rơi về cột trạng thái');

// ── việc nằm cột nào ──
ok(m.tbColOf_(T({ status: 'Đang làm' }), '', FLOWS) === 'Đang làm', 'việc thường: theo status');
ok(m.tbColOf_(T({ status: 'lạ' }), '', FLOWS) === 'Chưa làm', 'status lạ → Chưa làm');
ok(m.tbColOf_(T({ flowId: 'f1', stageIdx: 1 }), '', FLOWS) === '', 'việc có quy trình KHÔNG hiện ở bảng trạng thái');
ok(m.tbColOf_(T({ flowId: 'f1', stageIdx: 1 }), 'f1', FLOWS) === 'b', 'việc quy trình: theo stageIdx');
ok(m.tbColOf_(T({ flowId: 'f1', stageIdx: 3 }), 'f1', FLOWS) === '__done', 'stageIdx >= số giai đoạn → Hoàn thành');
ok(m.tbColOf_(T({ status: 'Đang làm' }), 'f1', FLOWS) === '', 'việc thường không hiện ở bảng quy trình');
ok(m.tbColOf_(T({ flowId: 'f1' }), 'f9', FLOWS) === '', 'bảng của quy trình đã xoá → không vẽ');

// ── gom + sắp xếp: quá hạn trước, hạn gần trước, không hạn cuối ──
const over = t => t.id === 'o';
const g = m.tbGroup_([T({ id: 'n', deadline: '' }), T({ id: 'late', deadline: '2030-05-01' }), T({ id: 'soon', deadline: '2030-01-01' }), T({ id: 'o', deadline: '2020-01-01' }), T({ id: 'f', flowId: 'f1' })], '', FLOWS, over);
ok(g.total === 4, 'tổng không tính việc có quy trình');
ok(g.cols[0].tasks.map(t => t.id).join() === 'o,soon,late,n', 'thứ tự: quá hạn → hạn gần → hạn xa → không hạn');
ok(m.tbGroup_([], 'f1', FLOWS).total === 0, 'rỗng');

// ── thả thẻ: quy trình ──
const wf = (o) => T(Object.assign({ flowId: 'f1', stageIdx: 0, stageAssignees: { a: ['Oanh'], b: ['Thúy'], c: ['Kế'] } }, o));
let d = m.tbDrop_(wf(), 'b', 'f1', FLOWS, 'Oanh', false);
ok(d.kind === 'advance' && d.approval === false, 'người phụ trách kéo sang cột kế → advance');
d = m.tbDrop_(wf({ stageIdx: 1 }), 'c', 'f1', FLOWS, 'Thúy', false);
ok(d.kind === 'advance' && d.approval === true, 'giai đoạn cần duyệt → advance kèm approval=true');
d = m.tbDrop_(wf(), 'a', 'f1', FLOWS, 'Oanh', false); ok(d.kind === 'none', 'thả lại đúng cột → không làm gì');
d = m.tbDrop_(wf({ stageIdx: 1 }), 'a', 'f1', FLOWS, 'Thúy', false); ok(d.kind === 'deny' && /lùi/.test(d.msg), 'kéo lùi → từ chối');
d = m.tbDrop_(wf(), 'c', 'f1', FLOWS, 'Oanh', false); ok(d.kind === 'deny' && /nhảy cóc/.test(d.msg), 'nhảy cóc → từ chối');
d = m.tbDrop_(wf(), 'b', 'f1', FLOWS, 'Người lạ', false); ok(d.kind === 'deny' && /phụ trách/.test(d.msg), 'không phải người phụ trách → từ chối');
d = m.tbDrop_(wf({ createdBy: 'Sếp' }), 'b', 'f1', FLOWS, 'Sếp', false); ok(d.kind === 'advance', 'người tạo được chuyển (khớp _tfStageModel.canAdvance)');
d = m.tbDrop_(wf({ pendingReq: [{ status: 'pending' }] }), 'b', 'f1', FLOWS, 'Oanh', false); ok(d.kind === 'deny' && /chờ duyệt/.test(d.msg), 'đang chờ duyệt → từ chối');
d = m.tbDrop_(wf({ stageIdx: 3 }), 'c', 'f1', FLOWS, 'Kế', false); ok(d.kind === 'deny', 'đã hoàn thành → không kéo ngược');
d = m.tbDrop_(wf({ stageIdx: 2 }), '__done', 'f1', FLOWS, 'Kế', false); ok(d.kind === 'advance', 'giai đoạn cuối → cột Hoàn thành = advance');
d = m.tbDrop_(wf(), 'zzz', 'f1', FLOWS, 'Oanh', false); ok(d.kind === 'deny', 'cột lạ → từ chối');

// ── thả thẻ: trạng thái ──
d = m.tbDrop_(T({ csAssigned: ['Oanh'] }), 'Đang làm', '', FLOWS, 'Oanh', false); ok(d.kind === 'status' && d.status === 'Đang làm', 'người được giao đổi trạng thái');
d = m.tbDrop_(T({ csAssigned: ['Oanh'] }), 'Đang làm', '', FLOWS, 'Lạ', false); ok(d.kind === 'deny', 'người ngoài không đổi được');
d = m.tbDrop_(T({ csAssigned: ['Oanh'] }), 'Đang làm', '', FLOWS, 'Lạ', true); ok(d.kind === 'status', 'admin đổi được');
d = m.tbDrop_(T({ status: 'Đang làm', csAssigned: ['Oanh'] }), 'Đang làm', '', FLOWS, 'Oanh', false); ok(d.kind === 'none', 'cùng cột → none');
d = m.tbDrop_(T({ csAssigned: ['Oanh'] }), 'Quá hạn', '', FLOWS, 'Oanh', false); ok(d.kind === 'deny', 'cột không phải trạng thái → từ chối');

// ── nút ‹ › ──
ok(m.tbNeighbor_(wf({ stageIdx: 1 }), -1, 'f1', FLOWS) === 'a' && m.tbNeighbor_(wf({ stageIdx: 1 }), 1, 'f1', FLOWS) === 'c', 'láng giềng giữa quy trình');
ok(m.tbNeighbor_(wf({ stageIdx: 0 }), -1, 'f1', FLOWS) === '', 'cột đầu không có ‹');
ok(m.tbNeighbor_(wf({ stageIdx: 3 }), 1, 'f1', FLOWS) === '', 'cột cuối không có ›');
ok(m.tbNeighbor_(T({ status: 'Chưa làm' }), 1, '', FLOWS) === 'Đang làm', 'trạng thái: Chưa làm › Đang làm');

// ── HTML: thoát ký tự ──
const html = m.tbBoardHtml_(m.tbGroup_([T({ id: 'q"1', title: '<img onerror=x>' })], '', FLOWS), '', FLOWS);
ok(html.indexOf('<img') === -1 && html.indexOf('&lt;img') !== -1, 'tiêu đề việc được thoát HTML');
ok(html.indexOf('data-id="q&quot;1"') !== -1, 'id được thoát trong thuộc tính');
ok(/Không có công việc/.test(m.tbBoardHtml_({ cols: [], total: 0 }, '', FLOWS)), 'bảng rỗng có thông báo');
ok(m.tbFlowOptions_(FLOWS, [T({ flowId: 'f1' }), T({})]).indexOf('Hoàn tiền (1)') !== -1, 'ô chọn quy trình có số việc');

// ── đối chiếu với mô hình giai đoạn thật của js/44 (không tự bịa luật quyền khác) ──
{
  const vm = require('vm'), rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const ctx = { console, JSON, Array, Object, Set, Date, Math, document: { getElementById: () => null, querySelectorAll: () => [] }, esc: s => String(s), allTasks: [], loadTasks() {}, openTaskDetailModal() {}, window: {} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(rd('js/44-fn-taskflow.js'), ctx);
  for (const who of ['Oanh', 'Thúy', 'Sếp', 'Lạ']) for (const idx of [0, 1, 2, 3]) for (const pend of [0, 1]) {
    const t = wf({ stageIdx: idx, pendingReq: pend ? [{ status: 'pending' }] : [] });
    const sm = ctx._tfStageModel(t, FLOW, who);
    const next = idx >= 3 ? '' : ['b', 'c', '__done'][idx];
    const dd = next ? m.tbDrop_(t, next, 'f1', FLOWS, who, false) : { kind: 'deny' };
    ok((dd.kind === 'advance') === !!sm.canAdvance, `quyền kéo = canAdvance của js/44 (${who}, giai đoạn ${idx}, chờ duyệt ${pend})`);
  }
}

// ── jsdom (tuỳ chọn) ──
let JSDOM = null; try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('(bỏ qua phần DOM: chưa có jsdom — npm i --no-save jsdom@24)'); }
const finish = () => { console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0); };
if (!JSDOM) finish();
else {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/70-task-board.js'), 'utf8');
  const dom = new JSDOM('<div id="task-view-bar"><button id="task-vw-list"></button><button id="task-vw-board"></button><select id="task-board-flow"></select></div><div id="task-list-wrap"></div><div id="task-board-wrap"></div>', { runScripts: 'outside-only' });
  const w = dom.window; const posts = [];
  w.allTaskFlows = FLOWS; w._tfLoaded = true; w.currentUser = { name: 'Oanh' };
  w.allTasks = [wf({ id: 'k1', title: 'Việc A' }), T({ id: 'k2', title: 'Việc B', csAssigned: ['Oanh'] })];
  w._taskFilteredList = () => w.allTasks; w._taskIsOverdue = () => false; w.toast = (x) => { w._toast = x; };
  w._tfIsAdmin = () => false; w.loadTasks = async () => {}; w.openTaskDetailModal = (id) => { w._opened = id; };
  w._tfPost = async (p) => { posts.push(p); return {}; };
  w.eval(src.replace(/if \(typeof module[^\n]*\n[\s\S]*$/, ''));
  w.tbSetMode('board'); w.tbSetFlow('f1');
  const wrap = w.document.getElementById('task-board-wrap');
  ok(wrap.querySelectorAll('.tb-col').length === 4 && wrap.querySelectorAll('.tb-card').length === 1, 'bảng quy trình: 4 cột, 1 thẻ');
  ok(w.document.getElementById('task-list-wrap').style.display === 'none', 'ẩn bảng danh sách khi xem bảng cột');
  ok(w.document.getElementById('task-board-flow').value === 'f1', 'ô chọn quy trình giữ giá trị');
  (async () => {
    await w.tbMove('k1', 'b');
    ok(posts.length === 1 && posts[0].action === 'taskAdvance' && posts[0].taskId === 'k1' && posts[0].by === 'Oanh', 'kéo sang cột kế → gửi taskAdvance');
    await w.tbMove('k1', 'c'); ok(posts.length === 1 && /nhảy cóc/.test(w._toast), 'nhảy cóc: không gửi gì, có thông báo');
    w.tbSetFlow('');
    ok(wrap.querySelectorAll('.tb-card').length === 1 && wrap.querySelector('.tb-card').getAttribute('data-id') === 'k2', 'bảng trạng thái: chỉ việc thường');
    await w.tbMove('k2', 'Đang làm');
    ok(posts.length === 2 && posts[1].action === 'saveTask' && posts[1].task.status === 'Đang làm' && posts[1].task.id === 'k2', 'kéo trạng thái → saveTask đủ trường + status mới');
    wrap.querySelector('.tb-card').click(); ok(w._opened === 'k2', 'bấm thẻ → mở chi tiết');
    finish();
  })();
}

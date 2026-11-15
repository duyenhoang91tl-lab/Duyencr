#!/usr/bin/env node
// Test R6b — lịch chăm sóc dạng Tuần/Ngày (js/71-sched-calendar.js). Logic thuần + (nếu có jsdom) kéo thả/nút. Chạy: node tools/test-sched-calendar.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), path = require('path');
const m = require('../js/71-sched-calendar.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const S = (o) => Object.assign({ id: 'a', phone: '0900000001', type: 'goi', date: '2026-11-18', note: '', done: false }, o);

// ── tuần bắt đầu thứ Hai ──
ok(m.scWeekStart_('2026-11-15', 0) === '2026-11-09', 'CN 15/11/2026 → thứ Hai 09/11');
ok(m.scWeekStart_('2026-11-16', 0) === '2026-11-16', 'T2 → chính nó');
ok(m.scWeekStart_('2026-11-18', 1) === '2026-11-23', 'tuần sau');
ok(m.scWeekStart_('2026-11-18', -1) === '2026-11-09', 'tuần trước');
ok(m.scWeekStart_('2026-01-01', 0) === '2025-12-29', 'qua mốc năm');
ok(m.scAddDays_('2026-12-31', 1) === '2027-01-01' && m.scAddDays_('2026-03-01', -1) === '2026-02-28', 'cộng ngày qua tháng/năm');

// ── nhóm loại ──
ok(['goi', 'sp', 'cs', 'hen'].every(k => m.scGroupOf_({ type: k }) === k), 'Gọi/SP/CS/Hẹn đúng nhóm');
ok(['notify', 'birthday', 'custom', undefined].every(k => m.scGroupOf_({ type: k }) === 'other'), 'loại khác → other');

// ── gom theo ngày ──
const days = ['2026-11-16', '2026-11-17', '2026-11-18'];
const items = [S({ id: '1', date: '2026-11-18', type: 'cs' }), S({ id: '2', date: '2026-11-18', type: 'goi' }), S({ id: '3', date: '2026-11-17', type: 'sp' }),
  S({ id: '4', date: '2026-11-18', done: true }), S({ id: '5', date: '2026-12-01' }), S({ id: '6', date: '2026-11-18', type: 'birthday' })];
let g = m.scGroup_(items, days, []);
ok(g['2026-11-18'].map(x => x.id).join() === '2,1,6', 'trong ngày: Gọi → CS → Khác; bỏ việc đã xong');
ok(g['2026-11-16'].length === 0 && !g['2026-12-01'], 'ngày trống = []; ngày ngoài tuần bị bỏ');
g = m.scGroup_(items, days, ['cs', 'sp']);
ok(g['2026-11-18'].map(x => x.id).join() === '1' && g['2026-11-17'].length === 1, 'lọc theo loại');
const c = m.scCountByGroup_(items, days);
ok(c.goi === 1 && c.cs === 1 && c.sp === 1 && c.other === 1 && c.hen === 0, 'đếm theo nhóm (không đếm done / ngoài tuần)');

// ── luật dời ──
const T0 = '2026-11-15';
ok(m.scMoveCheck_(S(), '2026-11-20', T0).ok === true, 'dời bình thường');
ok(m.scMoveCheck_(S(), '2026-11-18', T0).same === true && !m.scMoveCheck_(S(), '2026-11-18', T0).ok, 'cùng ngày → không làm gì, không báo lỗi');
ok(/tự động/.test(m.scMoveCheck_(S({ autoDao: true }), '2026-11-20', T0).msg), 'lịch tự động không dời');
ok(/Sinh nhật/.test(m.scMoveCheck_(S({ type: 'birthday' }), '2026-11-20', T0).msg), 'sinh nhật không dời');
ok(/hôm nay/.test(m.scMoveCheck_(S(), '2026-11-14', T0).msg), 'không dời về quá khứ');
ok(m.scMoveCheck_(S(), T0, T0).ok === true, 'dời về đúng hôm nay được');
ok(!m.scMoveCheck_(null, '2026-11-20', T0).ok && !m.scMoveCheck_(S(), 'abc', T0).ok, 'đầu vào sai bị chặn');

// ── áp dời: schedules + careData ──
const care = { '0900000001': { schedGoi: '2026-11-18', schedGoiNote: 'x', schedSP: '2026-11-30' }, '0900000002': { schedGoi: '2026-11-18' } };
let r = m.scApplyMove_([S(), S({ id: 'b', phone: '0900000002' })], care, 'a', '2026-11-20');
ok(r.schedules.find(x => x.id === 'a').date === '2026-11-20' && r.schedules.find(x => x.id === 'b').date === '2026-11-18', 'chỉ đổi đúng lịch được dời');
ok(r.care && r.care.schedGoi === '2026-11-20' && r.care.schedGoiNote === 'x' && r.careField === 'schedGoi', 'lịch nhanh Gọi: ô schedGoi theo sang ngày mới, giữ ghi chú');
ok(care['0900000001'].schedGoi === '2026-11-18', 'KHÔNG sửa trực tiếp object careData đầu vào (hàm thuần)');
r = m.scApplyMove_([S({ type: 'sp' })], care, 'a', '2026-11-20');
ok(r.care === null, 'ô care không khớp ngày lịch (schedSP=11-30 ≠ 11-18) → không đụng careData');
r = m.scApplyMove_([S({ type: 'custom' })], care, 'a', '2026-11-20');
ok(r.care === null && r.schedules[0].date === '2026-11-20', 'loại không có ô care: chỉ đổi schedules');
r = m.scApplyMove_([S()], care, 'khong-co', '2026-11-20');
ok(r.schedules[0].date === '2026-11-18' && r.care === null, 'id không tồn tại → không đổi gì');

// ── jsdom (tuỳ chọn) ──
let JSDOM = null; try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('(bỏ qua phần DOM: chưa có jsdom — npm i --no-save jsdom@24)'); }
const finish = () => { console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0); };
if (!JSDOM) finish();
else {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/71-sched-calendar.js'), 'utf8').replace(/if \(typeof module[^\n]*\n[\s\S]*$/, '');
  const dom = new JSDOM('<div id="tab-schedule"><div class="toolbar"><span id="sched-date-label"></span><div class="tl-l"></div></div><div id="sched-view-bar"><button data-mode="list"></button><button data-mode="week"></button><button data-mode="day"></button></div><div id="sched-grid"></div><div id="sched-cal"></div></div>', { runScripts: 'outside-only' });
  const w = dom.window; const log = { sync: [], saved: [], opened: [], done: [] };
  const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const add = n => { const [y, mo, d] = today.split('-').map(Number); const x = new Date(y, mo - 1, d + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  w.eval('var schedules = [], careData = {}, schedOffset = 0;');
  w.schedules = null;
  w.eval(`schedules = ${JSON.stringify([S({ id: 'g1', date: today, phone: '0911' }), S({ id: 'x1', date: today, phone: '0922', autoDao: true }), S({ id: 'o1', date: add(-1), phone: '0933' })])};
          careData = { '0911': { schedGoi: '${today}' } };`);
  w.SCHED_TYPES = [{ key: 'goi', color: '#2563eb' }, { key: 'cs', color: '#7c3aed' }];
  w._csFilterListMatch = () => []; w._schedCsFilter = () => true; w._customerByPhone = () => null; w.esc = s => String(s);
  w.saveLS = (k, v) => log.saved.push(k); w._touchCare = () => {}; w.logAudit = () => {}; w.gsUrl = 'http://x'; w.queueCareSync = p => log.sync.push(p);
  w.updateSchedBadges = () => {}; w.renderOverdueTab = () => {}; w.renderReminderPanel = () => {}; w._refreshOpenDpTab = () => {};
  w.toast = x => { w._toast = x; }; w._openCustomerByPhone_ = p => log.opened.push(p); w.markDone = id => log.done.push(id);
  w.eval(src);
  w.scSetMode('week');
  const cal = w.document.getElementById('sched-cal');
  ok(cal.style.display !== 'none' && w.document.getElementById('sched-grid').style.display === 'none', 'chế độ Tuần: hiện lịch mới, ẩn danh sách cũ');
  ok(cal.querySelectorAll('.sc-day').length === 7, 'tuần có 7 cột');
  ok(cal.querySelector('.sc-chip[data-id="g1"]'), 'thẻ lịch hiện đúng');
  ok(cal.querySelector('.sc-chip[data-id="x1"]').getAttribute('draggable') === 'false', 'lịch tự động không kéo được');
  w.scSetMode('list');
  ok(w.document.getElementById('sched-grid').style.display === '' && cal.style.display === 'none', 'quay lại Danh sách: màn cũ hiện lại nguyên vẹn');
  w.scSetMode('week');
  w.scBind_();
  // dời bằng nút ›
  cal.querySelector('.sc-chip[data-id="g1"] [data-act="mv"][data-d="1"]').click();
  const g1 = w.eval('schedules.find(function(x){return x.id==="g1"})');
  ok(g1.date === add(1), 'nút › dời lịch sang ngày kế');
  ok(w.eval('careData["0911"].schedGoi') === add(1), 'ô schedGoi trong careData đi theo');
  ok(log.sync.join() === '0911' && log.saved.indexOf('ome_sched') !== -1 && log.saved.indexOf('ome_schedules') !== -1 && log.saved.indexOf('ome_care') !== -1, 'lưu cả 2 khoá lịch + care và xếp hàng đồng bộ đúng khách');
  // lịch tự động: nút › không có, gọi thẳng bị chặn
  ok(!cal.querySelector('.sc-chip[data-id="x1"] [data-act="mv"]'), 'lịch tự động không có nút dời');
  ok(w.scMove('x1', add(5)) === false && /tự động/.test(w._toast), 'dời lịch tự động bị chặn + có thông báo');
  ok(w.scMove('g1', add(-3)) === false && /hôm nay/.test(w._toast), 'dời về quá khứ bị chặn');
  // lọc loại
  cal.querySelector('[data-act="ft"][data-k="cs"]').click();
  ok(cal.querySelectorAll('.sc-chip').length === 0, 'lọc CS: không còn thẻ Gọi');
  cal.querySelector('[data-act="ft"][data-k=""]').click();
  ok(cal.querySelectorAll('.sc-chip').length >= 2, 'bỏ lọc: thẻ quay lại');
  // bấm thẻ / nút xong (đưa g1 về hôm nay để chắc chắn nằm trong tuần đang xem, kể cả khi hôm nay là Chủ nhật)
  w.scMove('g1', today);
  cal.querySelector('.sc-chip[data-id="g1"] .sc-name').click(); ok(log.opened.join() === '0911', 'bấm thẻ → mở hồ sơ khách');
  cal.querySelector('.sc-chip[data-id="g1"] [data-act="ok"]').click(); ok(log.done.join() === 'g1' && log.opened.length === 1, 'nút ✓ → markDone, không mở hồ sơ');
  // chế độ Ngày
  w.scSetMode('day'); w.eval('_sc.day = "' + today + '"'); w.scRender();
  ok(cal.querySelector('.sc-dayview') && cal.querySelectorAll('.sc-sec').length >= 1, 'kiểu Ngày gom theo loại việc');
  cal.querySelector('[data-act="nav"][data-d="1"]').click(); ok(w.eval('_sc.day') === add(1), 'Hôm sau → +1 ngày');
  cal.querySelector('[data-act="nav"][data-d="0"]').click(); ok(w.eval('_sc.day') === today, 'Hôm nay → về hôm nay');
  // vẽ lại qua renderScheduleTab (bọc hàm cũ)
  w.eval('var _oldCalls = 0; window.renderScheduleTab = function(){ _oldCalls++; };');
  w.eval(src.slice(src.indexOf('(function(){\n  if (typeof window')));
  w.renderScheduleTab(); ok(w.eval('_oldCalls') === 1, 'renderScheduleTab cũ vẫn được gọi (bọc, không thay)');
  finish();
}

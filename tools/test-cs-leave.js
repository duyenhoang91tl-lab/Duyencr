#!/usr/bin/env node
// Test R6c-2 bước 1 — logic nghỉ phép + giao lại (js/73-cs-leave.js). Chạy: node tools/test-cs-leave.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const m = require('../js/73-cs-leave.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const L = (o) => Object.assign({ id: 'l1', name: 'Oanh', from: '2026-11-16', to: '2026-11-20', mode: 'even', target: '' }, o);
const teams = [{ id: 't1', name: 'Team A', leader: 'Hà', members: ['Oanh', 'Thúy', 'Mai'] }, { id: 't2', name: 'Team B', leader: 'Lan', members: ['Vy'] }];

// clIsOnLeave_
ok(m.clIsOnLeave_([L()], 'oanh ', '2026-11-16') && m.clIsOnLeave_([L()], 'Oanh', '2026-11-20'), 'nghỉ tính cả ngày đầu + ngày cuối; tên không phân biệt hoa/thường/khoảng trắng');
ok(!m.clIsOnLeave_([L()], 'Oanh', '2026-11-15') && !m.clIsOnLeave_([L()], 'Oanh', '2026-11-21'), 'ngoài kỳ nghỉ → không nghỉ');
ok(m.clIsOnLeave_([L({ to: '' })], 'Oanh', '2027-03-01'), 'chưa biết ngày về (to rỗng) → nghỉ mãi tới khi trả lại');
ok(!m.clIsOnLeave_([L({ ended: true })], 'Oanh', '2026-11-17') && !m.clIsOnLeave_([], 'Oanh', '2026-11-17') && !m.clIsOnLeave_(null, '', '2026-11-17'), 'đã trả lại / không có dữ liệu / tên rỗng → không nghỉ');

// clPeers_
ok(m.clPeers_(teams, 'Oanh', [L()], '2026-11-17').join() === 'Hà,Mai,Thúy', 'cùng team (cả trưởng nhóm), bỏ chính mình, sắp theo tên');
ok(m.clPeers_(teams, 'Oanh', [L(), L({ id: 'l2', name: 'Mai' })], '2026-11-17').join() === 'Hà,Thúy', 'bạn cùng team cũng đang nghỉ → không chia cho');
ok(m.clPeers_(teams, 'Không team', [], '2026-11-17').length === 0, 'không thuộc team nào → không có người để chia đều');

// clReplaceName_
ok(m.clReplaceName_('Oanh', 'Oanh', 'Mai') === 'Mai', 'thay tên đơn');
ok(m.clReplaceName_('Oanh, Thúy', 'Oanh', 'Mai') === 'Mai, Thúy', 'CS gộp: chỉ thay phần người nghỉ');
ok(m.clReplaceName_('Oanh, Mai', 'Oanh', 'Mai') === 'Mai', 'người nhận đã có sẵn → không lặp tên');
ok(m.clReplaceName_('', 'Oanh', 'Mai') === 'Mai', 'chưa có CS → gán người nhận');

// clAssign_
let a = m.clAssign_(['1', '2', '3', '4', '5'], 'even', '', ['Hà', 'Mai', 'Thúy']);
const cnt = {}; a.forEach(x => { cnt[x.to] = (cnt[x.to] || 0) + 1; });
ok(a.length === 5 && Math.max(...Object.values(cnt)) - Math.min(...Object.values(cnt)) <= 1, 'chia đều: chênh lệch tối đa 1 khách');
ok(JSON.stringify(a) === JSON.stringify(m.clAssign_(['1', '2', '3', '4', '5'], 'even', '', ['Hà', 'Mai', 'Thúy'])), 'chạy lại ra y hệt (không ngẫu nhiên)');
a = m.clAssign_(['1', '2', '3'], 'even', '', ['Hà', 'Mai'], { Hà: 10, Mai: 0 });
ok(a.map(x => x.to).join() === 'Mai,Mai,Mai', 'người đang ít khách hơn nhận trước');
ok(m.clAssign_(['1', '2'], 'to', 'Vy', []).every(x => x.to === 'Vy') && m.clAssign_(['1'], 'to', '', []).length === 0 && m.clAssign_(['1'], 'even', '', []).length === 0, 'chuyển hết cho 1 người; thiếu người nhận → không giao');

// clPlan_
const S = (o) => Object.assign({ id: 'a', phone: '0900000001', type: 'goi', date: '2026-11-10', done: false }, o);
const care = { '0911': { cs: 'Oanh' }, '0922': { cs: 'Oanh, Thúy' }, '0933': { cs: 'Thúy' }, '0944': { cs: 'Oanh' } };
const sch = [S({ id: '1', phone: '0911' }), S({ id: '2', phone: '0911', type: 'cs' }), S({ id: '3', phone: '0922' }), S({ id: '4', phone: '0933' }),
  S({ id: '5', phone: '0944', done: true }), S({ id: '6', phone: '0944', autoDao: true }), S({ id: '7', phone: '0944', type: 'birthday' })];
const resp = it => (care[it.phone] || {}).cs || '';
let p = m.clPlan_(L({ mode: 'to', target: 'Vy' }), sch, care, resp, teams, [L({ mode: 'to', target: 'Vy' })], '2026-11-16');
ok(p.rows.map(r => r.phone).join() === '0911,0922', 'chỉ khách có lịch CHƯA xong của người nghỉ; khách có 2 lịch chỉ tính 1 lần; khách của người khác không đụng');
ok(p.rows[1].newCs === 'Vy, Thúy' && p.rows[1].prevCs === 'Oanh, Thúy', 'CS gộp: thay đúng phần người nghỉ + lưu CS cũ để trả lại');
ok(p.skipped['lịch tự động'] === 1 && p.skipped['sinh nhật'] === 1, 'lịch tự động + sinh nhật bị bỏ qua và báo rõ');
p = m.clPlan_(L(), sch, care, resp, teams, [L()], '2026-11-16');
ok(p.rows.length === 2 && p.rows.every(r => ['Hà', 'Mai', 'Thúy'].includes(r.to)), 'chia đều: chỉ cho CS cùng team');
p = m.clPlan_(L({ mode: 'to', target: 'Oanh' }), sch, care, resp, teams, [], '2026-11-16'); ok(p.noTarget && !p.rows.length, 'chuyển cho chính người nghỉ → không giao');
p = m.clPlan_(L({ mode: 'to', target: 'Vy' }), sch, care, resp, teams, [L({ id: 'x', name: 'Vy' })], '2026-11-16'); ok(p.noTarget, 'chuyển cho người cũng đang nghỉ → không giao');
p = m.clPlan_(L({ name: 'Không team' }), sch, care, resp, teams, [], '2026-11-16'); ok(p.noTarget, 'chia đều mà không có team → báo thiếu người nhận');
p = m.clPlan_(null, sch, care, resp, teams, [], '2026-11-16'); ok(!p.rows.length, 'không có kỳ nghỉ → rỗng, không văng lỗi');

console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);

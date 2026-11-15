#!/usr/bin/env node
// Test R6c-2 bước 3 — lưu + áp dụng kỳ nghỉ (js/75-cs-leave-store.js). Chạy: node tools/test-cs-leave-store.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs');
const m = require('../js/75-cs-leave-store.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const L = (o) => Object.assign({ id: 'l1', name: 'Oanh', from: '2026-11-16', to: '', mode: 'even', applied: false, ended: false }, o);
const g = m.clGroupRows_([{ phone: '1', newCs: 'Mai' }, { phone: '2', newCs: 'Hà, Thúy' }, { phone: '3', newCs: 'Mai' }]);
ok(g.length === 2 && g[0].csName === 'Mai' && g[0].phones.join() === '1,3' && g[1].phones.join() === '2', 'gom dòng theo CS mới (giữ thứ tự) cho _applyCareCSToAssigned');
ok(m.clGroupRows_([]).length === 0 && m.clGroupRows_(null).length === 0, 'rỗng → rỗng');
ok(m.clDue_([L()], '2026-11-16').length === 1 && m.clDue_([L()], '2026-11-15').length === 0, 'đến hạn đúng ngày bắt đầu, chưa tới thì chưa');
ok(m.clDue_([L({ applied: true })], '2026-11-17').length === 0 && m.clDue_([L({ ended: true })], '2026-11-17').length === 0, 'đã áp dụng / đã kết thúc → không áp dụng lại');
ok(m.clDue_([L({ to: '2026-11-18' })], '2026-11-19').length === 0 && m.clDue_([L()], '2027-01-01').length === 1, 'quá ngày "đến" thì thôi; tạm nghỉ (không có ngày về) vẫn đến hạn');
let r = m.clMergeLeaves_([L({ applied: true, handed: [{ phone: '1' }] })], [L(), L({ id: 'l2', name: 'Mai' })]);
ok(r.length === 2 && r[0].applied === true && r[0].handed.length === 1, 'local đã applied, GAS chưa → giữ đã applied + handed (không giao 2 lần)');
ok(r[1].id === 'l2', 'kỳ nghỉ mới chỉ có ở GAS được thêm vào');
r = m.clMergeLeaves_([L()], [L({ ended: true })]); ok(r[0].ended === true, 'GAS báo đã kết thúc → kết thúc');
r = m.clMergeLeaves_([L({ ended: true })], [L()]); ok(r[0].ended === true, 'local đã kết thúc, GAS chưa → vẫn kết thúc');
ok(m.clMergeLeaves_(null, null).length === 0, 'không có dữ liệu → rỗng');

// Chạy NGUYÊN clApplyLeave_/clApplyDue_ trên môi trường giả
const vm = require('vm'), src = fs.readFileSync(__dirname + '/../js/75-cs-leave-store.js', 'utf8').replace(/if \(typeof window[^\n]*\n/, '').replace(/if \(typeof module[^\n]*\n?[\s\S]*$/, '');
const logic = fs.readFileSync(__dirname + '/../js/73-cs-leave.js', 'utf8').replace(/if \(typeof module[^\n]*\n?[\s\S]*$/, '');
const calls = { applied: [], audit: 0, saved: 0 };
const sb = { console, loadLS: () => null, saveLS: () => { calls.saved++; }, gsUrl: '', scYmd_: () => '2026-11-16', clLoad_: () => ({}), logAudit: () => { calls.audit++; }, updateSchedBadges() {},
  _applyCareCSToAssigned: (e) => calls.applied.push(e), _schedResponsibleCS: it => sb.careData[it.phone].cs,
  teams: [{ name: 'A', leader: 'Hà', members: ['Oanh', 'Mai'] }],
  careData: { 1: { cs: 'Oanh' }, 2: { cs: 'Oanh' } }, schedules: [{ id: 'a', phone: '1', type: 'goi', date: '2026-11-10', done: false }, { id: 'b', phone: '2', type: 'goi', date: '2026-11-12', done: false }] };
vm.createContext(sb); vm.runInContext(logic + src, sb);
vm.runInContext('_csLeaves = [' + JSON.stringify(L()) + ']', sb);
let n = vm.runInContext('clApplyDue_()', sb);
const lv = vm.runInContext('_csLeaves[0]', sb);
ok(n === 2 && lv.applied === true && lv.handed.length === 2 && calls.applied.length === 1 && calls.audit === 1, 'clApplyDue_: giao 2 khách đúng 1 lần, ghi handed + nhật ký');
ok(calls.applied[0].every(e => ['Hà', 'Mai'].includes(e.csName)), 'chỉ giao cho CS cùng team còn đi làm');
n = vm.runInContext('clApplyDue_()', sb); ok(n === 0 && calls.applied.length === 1, 'chạy lại → không giao lần 2');
sb.schedules = []; vm.runInContext('_csLeaves = [' + JSON.stringify(L({ id: 'l9' })) + ']', sb);
n = vm.runInContext('clApplyDue_()', sb); ok(n === 0 && vm.runInContext('_csLeaves[0].applied', sb) === false, 'lịch chưa tải (rỗng) → KHÔNG áp dụng, không đánh dấu applied');
console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);

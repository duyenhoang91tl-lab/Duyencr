#!/usr/bin/env node
// Test R6c-2 bước 2 — giao diện nghỉ phép (js/74-cs-leave-ui.js). Chạy: node tools/test-cs-leave-ui.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), path = require('path');
const m = require('../js/74-cs-leave-ui.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const teams = [{ id: 't1', name: 'Team A', leader: 'Hà', members: ['Oanh', 'Thúy'] }, { id: 't2', name: 'Team B', leader: 'Lan', members: ['Vy'] }];
const accounts = [{ username: 'x', role: 'cs', name: 'Mai' }, { username: 'ad', role: 'admin', name: 'Admin' }, { username: 'y', role: 'cs', names: ['Oanh', 'Bích'] }];
ok(m.clAllowedNames_({ role: 'admin' }, teams, accounts).join() === 'Bích,Hà,Lan,Mai,Oanh,Thúy,Vy', 'admin: mọi CS từ team + tài khoản, không trùng, không có tài khoản admin');
ok(m.clAllowedNames_({ role: 'leader', name: 'Hà' }, teams, accounts).join() === 'Hà,Oanh,Thúy', 'leader: chỉ CS trong team của mình');
ok(m.clAllowedNames_({ role: 'cs', names: ['Oanh', 'Bích'] }, teams, accounts).join() === 'Bích,Oanh', 'CS thường: chỉ chính mình (nhiều tên gắn tài khoản đều có)');
ok(m.clAllowedNames_({ role: 'cs' }, teams, accounts).length === 0, 'CS chưa có tên → rỗng');
const css = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(css.includes('js/74-cs-leave-ui.js') && css.includes('css/24-cs-leave.css'), 'index.html đã nạp js/74 + css/24');
console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);

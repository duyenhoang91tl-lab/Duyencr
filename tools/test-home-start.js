// Nut lon dau man Tong quan: dung muc theo vai tro + phan quyen menu. Chay: node tools/test-home-start.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '36-fn-homechips.js'), 'utf8');
const g = {}; vm.createContext(g);
vm.runInContext(s.match(/^var _HM_START = [\s\S]*?\n\];\n/m)[0] + s.match(/^function hmStartItems_\([\s\S]*?\n}\n/m)[0], g);
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const all = () => ({ style: { display: '' } });
const ids = (role, find) => g.hmStartItems_(role, find || all).map(x => x[0]).join();
ok('nhan vien: khach duoc giao dung dau, khong co nut quan tri', ids('cs') === 'tab-mydata,tab-kh,tab-schedule,taodon,crmorders,tab-chat');
ok('truong nhom: them chia cho team', ids('leader').startsWith('tab-mydata,act:leadassign,tab-kh'));
ok('admin: chia data, doanh so, tai khoan; khong co "khach duoc giao"', ids('admin') === 'act:assign,tab-kh,tab-schedule,taodon,crmorders,tab-chat,salesreport,act:acct');
ok('muc bi phan quyen an hoac chua co trong menu thi khong hien', ids('cs', id => id === 'taodon' ? { style: { display: 'none' } } : id === 'tab-chat' ? null : all()) === 'tab-mydata,tab-kh,tab-schedule,crmorders');
ok('vai tro la (demo) khong thay nut quan tri', !/act:|salesreport/.test(ids('demo')));
ok('moi nut tro toi muc co that trong menu', g._HM_START.every(x => fs.readFileSync(path.join(__dirname, '..', 'js', '29-sidenav.js'), 'utf8').indexOf(x[0].startsWith('act:') ? x[0].slice(4) + ':' : "'" + x[0] + "'") !== -1));
process.exit(fail ? 1 : 0);

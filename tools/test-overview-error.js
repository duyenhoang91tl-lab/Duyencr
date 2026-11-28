// Tong quan loi: nguoi dung thuong thay cau de hieu + nut Thu lai; chi tiet ky thuat chi admin. Chay: node tools/test-overview-error.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'js', '31-fn-orgoverview.js'), 'utf8');
const g = { esc: x => String(x).replace(/</g, '&lt;') }; vm.createContext(g);
vm.runInContext(s.match(/^function _ovErrorHtml_\([\s\S]*?\n}\n/m)[0], g);
let fail = 0; const ok = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); if (!v) fail++; };
const user = g._ovErrorHtml_(new Error("Cannot read properties of undefined"), false), adm = g._ovErrorHtml_(new Error('Unknown action <x>'), true), slow = g._ovErrorHtml_({ name: 'AbortError' }, false);
ok('nhan vien: cau de hieu + nut thu lai, khong lo loi may', user.includes('Chưa tải được số liệu') && user.includes('onclick="_ovLoad(true)"') && !/Cannot read|GAS|deploy/.test(user));
ok('admin: co chi tiet, da escape, goi y ban GAS cu', adm.includes('Chi tiết: Unknown action &lt;x>') && adm.includes('bản cũ'));
ok('qua gio: goi y chon khoang ngay ngan hon', slow.includes('khoảng ngày ngắn hơn') && slow.includes('Thử lại'));
process.exit(fail ? 1 : 0);

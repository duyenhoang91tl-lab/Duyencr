// Test: SĐT được chia mà máy không có nguồn dữ liệu nào vẫn thành khách. Chạy: node tools/test-assign-customers.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'FAIL ') + m); if (!c) fail++; };
const ctx = { console, Set }; ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(`var map = {}, allCustomers = [], careLeads = {}, builds = 0, assignHistory = [], pulled = [];
function buildCustomers(){ builds++; posCustomersInject_(map); allCustomers = Object.values(map); }
function applyFilters(){}
async function pullAssignHistory(){ assignHistory = assignHistory.concat(pulled); pulled = []; }`, ctx);
vm.runInContext(read('89-pos-customers.js'), ctx);
vm.runInContext(read('100-assign-customers.js'), ctx);
const run = s => vm.runInContext(s, ctx);
(async () => {
  run(`map['0900000001']={phone:'0900000001',name:'Co san',orders:[]}; buildCustomers()`);
  run(`pulled=[{id:'a',csName:'sale1',phones:['0900000001','0900000002','0900000002','12']}]`);
  await run('pullAssignHistory()');
  ok(run('allCustomers.length') === 2, 'SDT duoc chia chua co du lieu -> hien thanh khach (khong trung, bo SDT rac)');
  ok(run(`map['0900000001'].name`) === 'Co san', 'khach da co giu nguyen');
  const b = run('builds'); await run('pullAssignHistory()');
  ok(run('builds') === b, 'dot chia khong doi -> khong dung lai');
  run(`posOrdersByPhone={'0900000002':[{ds:'2026-11-01',name:'Chi Lan'}]}; buildCustomers()`);
  ok(run(`map['0900000002'].name`) === 'Chi Lan', 'du lieu that ve sau -> thay khach tam');
  run(`posOrdersByPhone={}; delete map['0900000002']; buildCustomers(); assignHistory=[]; buildCustomers()`);
  ok(!run(`map['0900000002']`), 'xoa dot chia -> khach tam bien mat');
  process.exit(fail ? 1 : 0);
})();

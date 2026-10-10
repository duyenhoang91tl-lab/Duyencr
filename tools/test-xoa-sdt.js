#!/usr/bin/env node
// Test Node cho xoaSdtKhongPhaiVN_ (gas_v13.js): chi xoa dong co SDT khong phai di dong VN, backup truoc khi xoa, dryRun khong dong vao gi.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = n => { const i = src.indexOf('\nfunction ' + n + '('); if (i < 0) throw new Error(n); return src.slice(i + 1, src.indexOf('\n}\n', i) + 3); };
const a = src.indexOf('var XOA_SDT_BUDGET_MS_'), b = src.indexOf('function xoaSdtLoiThu');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const mkSheet = (rows) => ({ rows, getLastRow: () => rows.length, getLastColumn: () => rows[0].length,
  getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 1, r - 1 + n).map(x => x.slice(c - 1, c - 1 + (w || x.length))), setValues: v => { v.forEach((x, i) => rows[r - 1 + i] = x); } }),
  deleteRows: (r, n) => rows.splice(r - 1, n), appendRow: x => rows.push(x) });
const H = ['phone', 'x'];
const care = mkSheet([H, ['0912345678', 1], ['+441234567890', 2], ['0212345678', 3], [912345679, 4], ['abc', 5], ['', 6], ['841234567890', 7], ['0987654321', 8], ['12345', 9]]);
const lead = mkSheet([H, ['0912345678', 1]]);
const bk = mkSheet([['t']]); bk.appendRow = x => bk.rows.push(x);
const props = {}; const removed = [];
const ctx = { Logger: { log() {} }, SH_CARE: 'C', CARE_HEADERS: H, SH_CARE_LEAD: 'L', CARE_LEAD_HEADERS: H,
  getSheet_: n => n === 'C' ? care : lead, _findCskhDuyenSheet_: () => null, _cskhHeaderMap_: () => ({}),
  getCrmSS_: () => ({ getSheetByName: n => n === 'XoaSDT_Backup' ? bk : null, insertSheet: () => bk }),
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ remove: k => removed.push(k) }) },
  readAllOrders_: () => [{ phone: '0912345678' }, { phone: '+441' }], sbMarkStale_: w => props.stale = w };
vm.createContext(ctx);
vm.runInContext(fn('isValidVnPhone_') + src.slice(a, b), ctx);
const run = c => vm.runInContext(c, ctx);
let r = run('xoaSdtKhongPhaiVN_({})');
ok(r.ok && r.dryRun && r.sheets.CareData.invalid === 4 && care.rows.length === 10 && !props.stale, 'dryRun khong xoa: ' + JSON.stringify(r));
ok(r.orders.dtTongDonSdtKhongHopLe === 1, 'dem don');
r = run('xoaSdtKhongPhaiVN_({dryRun:false})');
ok(r.ok && r.done && r.sheets.CareData.deleted === 4, 'xoa that: ' + JSON.stringify(r));
const left = care.rows.slice(1).map(x => String(x[0]));
ok(JSON.stringify(left) === JSON.stringify(['0912345678', '912345679', 'abc', '', '0987654321']), 'con lai (chu thuan/trong giu nguyen): ' + left);
ok(bk.rows.length === 1 + 4 && bk.rows.slice(1).every(x => x[1] === 'CareData'), 'backup du 4 dong');
ok(props.stale && removed.includes('customers_v12'), 'stale + xoa cache');
ok(run('xoaSdtKhongPhaiVN_({dryRun:false})').sheets.CareData.deleted === 0, 'chay lai khong xoa them');
// het ngan sach -> done:false, chay lai tiep tuc
const care2 = mkSheet([H, ['+44111111111', 1], ['0912345678', 2], ['+44222222222', 3], ['0911111111', 4], ['+44333333333', 5]]); ctx.getSheet_ = n => n === 'C' ? care2 : lead;
run('XOA_SDT_BUDGET_MS_ = -1'); r = run('xoaSdtKhongPhaiVN_({dryRun:false,sheets:["care"]})'); ok(r.done === false && r.sheets.CareData.deleted === 0, 'het ngan sach');
run('XOA_SDT_BUDGET_MS_ = 240000'); r = run('xoaSdtKhongPhaiVN_({dryRun:false,sheets:["care"]})'); ok(r.done && care2.rows.length === 3, 'chay tiep: ' + care2.rows.length);
console.log('ALL XOA SDT TESTS PASSED');

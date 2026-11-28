#!/usr/bin/env node
// Test: loc khoang ngay trong Chia data tinh ca DON POS (nhu bang Danh sach KH, js/90) + tu tai them cua so POS khi khoang ngay xa. Chay: node tools/test-assign-date-pos.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src07 = fs.readFileSync(__dirname + '/../js/07-openassignmodal.js', 'utf8');
const src05 = fs.readFileSync(__dirname + '/../js/05-fn-saveeditphone.js', 'utf8');
const src90 = fs.readFileSync(__dirname + '/../js/90-pos-filter.js', 'utf8');
const grab = (src, name) => { const i = src.search(new RegExp('function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const W = { posOrders: { loadedAt: 1, from: '2026-08-30', days: 90 }, posOrdersByPhone: {}, console };
let ensured = [];
W.posOrdersEnsureDays_ = (n) => { ensured.push(n); return Promise.resolve(false); };
const ctx = Object.assign({ window: W, globalThis: W, document: { getElementById: () => null }, console, setTimeout }, {});
ctx.window = W; vm.createContext(ctx);
vm.runInContext('var window = this; ' , ctx);
Object.assign(ctx, W); ctx.window = ctx;
vm.runInContext(grab(src05, 'isValidVnPhone'), ctx);
vm.runInContext(src90.replace(/typeof applyFilters === 'function'/, 'false'), ctx);   // chi can posFilterView_
vm.runInContext('var _asgPosEnsuring = {}; var _advAssign = { srcSet: new Set(), dateFrom: "", dateTo: "" }; var _assignFilteredList = [];', ctx);
['_advAssignEnsurePos_', '_advAssignOrderDays_', '_advAssignValidBase', '_advAssignDateFilteredList'].forEach(n => vm.runInContext(grab(src07, n), ctx));
const CUST = {
  '0912345671': { phone: '0912345671', ymList: [{ ds: '2026-05-10' }], dataSrc: { don: 1 } },        // co don Base thang 5
  '0912345672': { phone: '0912345672', ymList: [{ ds: '2026-03-02' }], dataSrc: { don: 1 } },        // Base thang 3, POS thang 5 -> BANG hien, Chia data cu bo sot
  '0912345673': { phone: '0912345673', ymList: [{ ds: '2026-03-02' }], dataSrc: { don: 1 } },        // chi thang 3
  '0912345674': { phone: '0912345674', ymList: [], dataSrc: { don: 1 } } };
ctx._assignCustMap = () => new Map(Object.keys(CUST).map(k => [k, CUST[k]]));
ctx.posOrdersByPhone = { '0912345672': [{ ds: '2026-05-20', sales: ['A'] }] };
vm.runInContext('_assignFilteredList = ' + JSON.stringify(Object.keys(CUST)) + '; _advAssign.srcSet = new Set(["don"]); _advAssign.dateFrom = "2026-05-01"; _advAssign.dateTo = "2026-05-31";', ctx);
let r = vm.runInContext('_advAssignDateFilteredList()', ctx);
ok(r.join() === '0912345671,0912345672', 'khach co don POS thang 5 duoc tinh nhu bang: ' + r.join());
const g = vm.runInContext('_advAssign._diag', ctx); ok(g.dateOut === 2 && g.srcOut === 0, 'dem ly do loai: 2 khach khong co don trong khoang ngay: ' + JSON.stringify(g));
// khong co POS -> nhu cu
ctx.posOrdersByPhone = {}; r = vm.runInContext('_advAssignDateFilteredList()', ctx);
ok(r.join() === '0912345671', 'chua co don POS -> chi don Base nhu truoc');
// khoang ngay xa hon cua so POS (from 08-30) -> tu tai them 1 lan
ok(ensured.length === 1 && ensured[0] > 150, 'tu goi posOrdersEnsureDays_ (can ' + ensured[0] + ' ngay) khi khoang ngay xa cua so POS'); 
vm.runInContext('_advAssignDateFilteredList()', ctx); ok(ensured.length === 1, 'moi so ngay chi tai 1 lan');
// ngoai nguon
vm.runInContext('_advAssign.srcSet = new Set(["cs"]);', ctx); r = vm.runInContext('_advAssignDateFilteredList()', ctx);
ok(r.length === 0 && vm.runInContext('_advAssign._diag.srcOut', ctx) === 4, 'chon nguon khac -> dem so khach ngoai nguon');
// --- 28/11: don chi co thang/nam (ds rong) + khach POS chua bat dataSrc.don van phai duoc tinh khi loc thang 5 ---
CUST['0912345675'] = { phone: '0912345675', ymList: [{ ds: '', yr: 2026, mo: 5 }], dataSrc: { don: 1 } };      // don Base chi biet thang 5
CUST['0912345676'] = { phone: '0912345676', ymList: [{ ds: '', yr: 2026, mo: 6 }], dataSrc: { don: 1 } };      // chi thang 6
CUST['0912345677'] = { phone: '0912345677', ymList: [], dataSrc: {} };                                          // POS-only, dataSrc.don chua bat
ctx._assignCustMap = () => new Map(Object.keys(CUST).map(k => [k, CUST[k]]));
ctx.posOrdersByPhone = { '0912345672': [{ ds: '2026-05-20', sales: ['A'] }], '0912345677': [{ ds: '2026-05-03', sales: ['B'] }] };
vm.runInContext('_assignFilteredList = ' + JSON.stringify(Object.keys(CUST)) + '; _advAssign.srcSet = new Set(["don"]); _advAssign.dateFrom = "2026-05-01"; _advAssign.dateTo = "2026-05-31";', ctx);
r = vm.runInContext('_advAssignDateFilteredList()', ctx);
ok(r.join() === '0912345671,0912345672,0912345675,0912345677', 'thang 5: du don Base co ngay, don chi biet thang, khach POS-only: ' + r.join());
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

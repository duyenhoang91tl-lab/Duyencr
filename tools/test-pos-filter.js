#!/usr/bin/env node
// Test js/90-pos-filter.js (DANH SACH KH KHOP DON POS, buoc 4/7): loc ngay + CS theo don POS. Chay: node tools/test-pos-filter.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/90-pos-filter.js'), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const B = 'biichnguyen1993';
// Vi du Duyen 16/11: 9 khach co don POS ngay 16/11 cua B (nhieu don the chung 2-4 sale), CRM cu chi ra 3 khach (co don Base).
const names = ['Le phuong thao', 'Phuong Thuy', 'Huynh Kim Nguyet', 'Binh Le', 'Tran tuoi', 'Lo Lem', 'Thanh Phuong', 'Gau Panda', 'C Trang'];
const mk = (i) => '09000000' + String(i).padStart(2, '0');
const customers = names.map((n, i) => ({ phone: mk(i), name: n, orders: [], ymList: [], csSet: new Set(i < 3 ? [B] : [B, 'ninhnga99']) }));
// khach co don Base 16/11 (3 khach dau), va khach co don POS CU cua B ngoai khoang (khong duoc khop)
customers[0].orders = [{ cs: B }]; customers[0].ymList = [{ ds: '2026-11-16', yr: 2026, mo: 11, hr: 10 }];
customers[1].orders = [{ cs: B }]; customers[1].ymList = [{ ds: '2026-11-16', yr: 2026, mo: 11, hr: 9 }];
customers[2].orders = [{ cs: B }]; customers[2].ymList = [{ ds: '2026-11-16', yr: 2026, mo: 11, hr: 9 }];
const old = { phone: '0911111111', name: 'Khach cu', orders: [], ymList: [], csSet: new Set([B]) };   // POS cu 01/10 cua B
const other = { phone: '0922222222', name: 'Khach sale khac', orders: [], ymList: [], csSet: new Set(['ninhnga99', B]) };  // trong khoang 16/11 la ninhnga99 ; B chi o don cu
const noPos = { phone: '0933333333', name: 'Khong POS', orders: [{ cs: 'x' }], ymList: [{ ds: '2026-11-16', yr: 2026, mo: 11, hr: 1 }], csSet: new Set(['x']) };
const all = customers.concat([old, other, noPos]);
const by = {};
customers.forEach((c, i) => { by[c.phone] = [{ ds: '2026-11-16', name: c.name, sales: i % 2 ? [B, 'ninhnga99', 'thuydinh95'] : [B], rev: 1000000, shares: [] }]; });
by[old.phone] = [{ ds: '2026-10-01', name: 'Khach cu', sales: [B], rev: 500000, shares: [] }];
by[other.phone] = [{ ds: '2026-11-16', name: 'x', sales: ['ninhnga99'], rev: 1, shares: [] }, { ds: '2026-10-02', name: 'x', sales: [B], rev: 1, shares: [] }];

function boot(dom, posLoaded) {
  const calls = { orig: 0, ensure: [] };
  const ctx = { console, Set, Date, Promise, Math, isFinite, parseInt, String, Array, Object,
    document: { getElementById: (id) => (id in dom ? { value: dom[id] } : null) },
    allCustomers: all, careLeads: {}, calls,
    posOrders: posLoaded === false ? { loadedAt: 0 } : { loadedAt: 1, from: '2026-08-20', to: '2026-11-17', days: 90 },
    posOrdersByPhone: by,
    posOrdersEnsureDays_: (d) => { calls.ensure.push(d); return Promise.resolve(false); },
    posOrdersOnChange_: (fn) => { ctx._chg = fn; } };
  // applyFilters "goc" mo phong dung 2 phep kiem cua js/02: ngay doc ymList, CS doc csSet
  ctx.result = null; ctx.seen = null;
  vm.createContext(ctx);
  vm.runInContext(`function applyFilters(){ calls.orig++; var f=document.getElementById('ymf-date-from'), t=document.getElementById('ymf-date-to'); var from=f&&f.value||'', to=t&&t.value||'', cs=(document.getElementById('cs')||{}).value||'';
    result = allCustomers.filter(function(c){ if(from||to){ if(!c.ymList.some(function(o){ return o.ds && !(from&&o.ds<from) && !(to&&o.ds>to); })) return false; } if(cs && !c.csSet.has(cs)) return false; return true; }).map(function(c){return c.name;}); seen = allCustomers.map(function(c){return c.ymList.length;}); }`, ctx);
  vm.runInContext(src, ctx);
  return ctx;
}
const run = (c) => { vm.runInContext('applyFilters()', c); return c.result; };
(async () => {
  // 1) vi du Duyen: CS = B + ngay 16/11-30/11 -> du 9 khach (truoc: 3); khong lay khach cu / khach sale khac
  let c = boot({ 'ymf-date-from': '2026-11-16', 'ymf-date-to': '2026-11-30', cs: B });
  let r = run(c);
  ok(r.length === 9 && names.every(n => r.indexOf(n) >= 0), 'B + 16/11-30/11: du 9 khach POS (' + r.length + ')');
  ok(r.indexOf('Khach cu') < 0, 'don POS cu 01/10 cua B khong lot vao khoang 16/11');
  ok(r.indexOf('Khach sale khac') < 0, 'khach co don trong khoang la sale KHAC (B chi o don cu ngoai khoang) -> KHONG khop CS B');
  ok(r.indexOf('Khong POS') < 0, 'khach khong co don POS, CS khac -> khong khop (csSet goc giu nguyen)');
  // 2) the chung nhieu sale: loc CS = ninhnga99 -> khach the chung (i le) + khach sale khac
  c = boot({ 'ymf-date-from': '2026-11-16', 'ymf-date-to': '2026-11-30', cs: 'ninhnga99' });
  r = run(c);
  ok(r.indexOf('Phuong Thuy') >= 0 && r.indexOf('Khach sale khac') >= 0 && r.indexOf('Le phuong thao') < 0, 'the chung: ninhnga99 thay khach the chung va khach cua rieng no');
  // 3) tra nguyen trang thai sau khi loc (ymList/csSet khong bi sua)
  ok(customers[4].ymList.length === 0 && customers[4].csSet.size === 2 && customers[0].ymList.length === 1 && other.csSet.has(B), 'tra nguyen ymList/csSet sau khi loc');
  // 4) khong co khoang ngay: csSet giu nguyen, chi them ngay POS vao ymList (khong lam doi ket qua loc CS)
  c = boot({ cs: B }); r = run(c);
  ok(r.indexOf('Khach cu') >= 0 && r.indexOf('Khach sale khac') >= 0, 'khong loc ngay: loc CS nhu cu (csSet goc)');
  ok(JSON.stringify(vm.runInContext('seen', c)) !== '[]' && customers[0].ymList.length === 1, 'ymList duoc bo sung luc chay, da tra lai sau do');
  // 5) chua tai don POS -> goi ham goc y nguyen
  c = boot({ 'ymf-date-from': '2026-11-16', cs: B }, false); r = run(c);
  ok(r.indexOf('Binh Le') < 0, 'chua tai don POS -> hanh vi cu (khach chi co POS khong thay)');
  // 6) loc ngay xa hon cua so -> goi posOrdersEnsureDays_ voi so ngay du
  c = boot({ 'ymf-date-from': '2026-05-01' }); run(c);
  ok(c.calls.ensure.length === 1 && c.calls.ensure[0] > 90, 'ngay xa cua so 90 -> tai them (' + c.calls.ensure[0] + ' ngay)');
  run(c); ok(c.calls.ensure.length === 1, 'cung so ngay khong tai lai lan 2');
  // 7) ham goc nem loi -> van tra nguyen trang thai (finally)
  c = boot({ 'ymf-date-from': '2026-11-16', cs: B });
  vm.runInContext('var _o = applyFilters; ', c);
  const bad = boot({ 'ymf-date-from': '2026-11-16', cs: B });
  vm.runInContext('applyFilters = (function(p){ return function(){ p(); throw new Error("boom"); }; })(applyFilters)', bad);
  let threw = false; try { vm.runInContext('applyFilters()', bad); } catch (e) { threw = true; }
  ok(threw === true, 'ham goc nem loi -> loi van duoc truyen len (khong nuot)');
  ok(customers[4].csSet.size === 2 && other.csSet.has(B), 'sau loi van tra nguyen csSet');
  // 8) listener: doi du lieu POS khi dang loc ngay -> loc lai
  c = boot({ 'ymf-date-from': '2026-11-16' }); const n0 = c.calls.orig; c._chg(); ok(c.calls.orig === n0 + 1, 'don POS moi ve + dang loc ngay -> loc lai');
  c = boot({}); const n1 = c.calls.orig; c._chg(); ok(c.calls.orig === n1, 'khong loc ngay -> khong loc lai');
  // 9) ham thuan
  const v = vm.runInContext('posFilterView_', c)({ orders: [{ cs: 'a,b' }], ymList: [{ ds: '2026-11-16' }], csSet: new Set() }, [{ ds: '2026-11-16', sales: ['c'] }, { ds: '2026-11-20', sales: ['d'] }], '2026-11-16', '2026-11-16', ['e']);
  ok(v.ymList.length === 2 && v.ymList[1].yr === 2026 && v.ymList[1].mo === 11, 'ymList them ngay POS 20/11 (khong trung 16/11)');
  ok([...v.csSet].sort().join() === 'a,b,c,e', 'csSet = Base trong khoang + POS trong khoang + careLeads (khong co d)');
  ok(vm.runInContext('posFilterView_', c)({ orders: [], ymList: [] }, [], 'x', 'y') === null, 'khong co don POS -> null');
  console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA DAT'); process.exit(fails ? 1 : 0);
})();

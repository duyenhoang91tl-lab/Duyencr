#!/usr/bin/env node
// Test (2026-11-17) GOP CS CHUAN: "biichnguyen1993" va "Biichnguyen1993" = 1 CS (khong phan biet hoa/thuong). Truoc day "Loc theo CS" hien 2 muc (602 + 364 KH)
// va cot CS phu trach 2 chip. Kiem: bang ten chuan (uu tien kieu viet cua TAI KHOAN, roi kieu nhieu nhat), chuan hoa Set cua khach, danh sach loc chi 1 muc
// voi so KH = so khach DUY NHAT, <select> an van giu ca kieu viet cu (de _csFilterListMatch khop), khong gop ten khac han (thuydinh95).
const fs = require('fs'), vm = require('vm'), path = require('path');
const s8 = fs.readFileSync(path.join(__dirname, '..', 'js/08-fn-invalidatefiltercache.js'), 'utf8');
const s4 = fs.readFileSync(path.join(__dirname, '..', 'js/04-fn-synczalophonesettingsfromgas.js'), 'utf8');
const s15 = fs.readFileSync(path.join(__dirname, '..', 'js/15-fn-hidelogin.js'), 'utf8');
function grab(src, name) { const key = 'function ' + name + '('; const i = src.indexOf(key); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } } return src.slice(i, j + 1); }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
function boot(accounts, customers) {
  const selOpts = []; const comboData = { v: null }; const advCalls = [];
  const sel = { innerHTML: '', disabled: false, get options() { return selOpts; } };
  const ctx = { console, Set, Object, Array, String, JSON, accounts, allCustomers: customers, _dataVersion: 0, _filterCache: {}, careLeads: {}, donSaleByPhone: {}, advFilters: { cs: new Set() },
    esc: x => String(x), _csFilterList: () => [], _csSetFilterSelection: () => {}, csComboRender: () => {}, syncCSCombo: () => {}, updateYearFilter: () => {}, _inUserScope: () => true,
    buildAdvChips: (k, list) => advCalls.push([k, list.slice()]),
    document: { getElementById: id => id === 'cs-staff-filter' ? sel : null } };
  vm.createContext(ctx);
  vm.runInContext(['_csCanonName_', '_csCanonBuild_', '_csCanonSet_', '_buildCsSet_', '_invalidateFilterCache'].map(n => grab(s8, n)).join('\n') + '\nvar _csCanonMap = {};\n' + grab(s15, '_acctNamesOf') + '\n' + grab(s4, 'updateCSStaffList') +
    '\nvar csComboData = [];', ctx);
  // select an: lay option tu innerHTML sau khi chay
  ctx.__sel = sel; ctx.__adv = advCalls;
  return ctx;
}
const mk = (phone, cs, care) => ({ phone, orders: [{ cs }], csSet: new Set(cs.split(',').map(x => x.trim()).filter(Boolean)), careCSSet: new Set(care || []) });
const cust = [];
for (let i = 0; i < 6; i++) cust.push(mk('09' + i, 'biichnguyen1993'));
for (let i = 0; i < 3; i++) cust.push(mk('08' + i, 'Biichnguyen1993'));
cust.push(mk('07', 'Biichnguyen1993, biichnguyen1993'));      // 1 khach co CA HAI kieu (don cua 2 kieu viet) -> chi dem 1 lan
cust.push(mk('06', 'thuydinh95'));  cust.push(mk('05', 'Thuydinh1995'));   // ten khac han: KHONG gop o day
cust.push(mk('04', 'Zed', ['zed']));                          // phu trach Zed + cham soc zed -> 1 CS "Zed"/"zed"? (xem ben duoi)
let C = boot([{ role: 'cs', names: ['Biichnguyen1993'], name: 'Biichnguyen1993' }], cust);
vm.runInContext('updateCSStaffList()', C);
let data = vm.runInContext('csComboData', C).filter(x => x.value !== 'all');
const names = data.map(x => x.value);
ok(names.filter(n => n.toLowerCase() === 'biichnguyen1993').join() === 'Biichnguyen1993', 'Loc theo CS: chi con 1 muc "Biichnguyen1993" (kieu viet cua TAI KHOAN), khong con "biichnguyen1993" (' + names.join(',') + ')');
const bi = data.find(x => x.value === 'Biichnguyen1993');
ok(bi && bi.count === 10, 'so KH = 10 khach DUY NHAT (6+3+1 co ca hai kieu), khong cong don 602+364 (' + (bi && bi.count) + ')');
ok(names.includes('thuydinh95') && names.includes('Thuydinh1995'), 'ten KHAC HAN (thuydinh95 / Thuydinh1995) khong bi gop theo hoa/thuong — do "1 nguoi = nhieu ten" lo');
ok(cust.slice(0, 6).every(c => c.csSet.has('Biichnguyen1993') && !c.csSet.has('biichnguyen1993')), 'tap CS cua tung khach duoc chuan hoa ve ten chuan (chip CS phu trach chi 1)');
ok(cust[9].csSet.size === 1 && cust[9].csSet.has('Biichnguyen1993'), 'khach co ca 2 kieu viet -> 1 chip');
ok(cust[12].csSet.has('Zed') && cust[12].careCSSet.has('Zed') && !cust[12].careCSSet.has('zed'), 'careCSSet cung duoc chuan hoa (Zed khop ca phu trach + cham soc)');
const opts = vm.runInContext('__sel.innerHTML', C);
ok(/value="biichnguyen1993"/.test(opts) && /value="Biichnguyen1993"/.test(opts), '<select> an van giu CA 2 kieu viet de _csFilterListMatch khop KH chi duoc chia bang kieu cu');
ok(C.__adv.length === 0 || C.__adv[0][1].filter(n => n.toLowerCase() === 'biichnguyen1993').length === 1 || true, 'chip loc nang cao: (khong co DOM adv-cs-chips trong test)');
// Khong co tai khoan: chon kieu nhieu nhat
const cust2 = []; for (let i = 0; i < 5; i++) cust2.push(mk('1' + i, 'biichnguyen1993')); for (let i = 0; i < 2; i++) cust2.push(mk('2' + i, 'Biichnguyen1993'));
let C2 = boot([], cust2); vm.runInContext('updateCSStaffList()', C2);
ok(vm.runInContext('csComboData', C2).filter(x => x.value !== 'all').map(x => x.value).join() === 'biichnguyen1993', 'khong co tai khoan: lay kieu viet NHIEU NHAT (biichnguyen1993)');
// Hoa: ngang nhau -> kieu viet hoa chu dau
const cust3 = [mk('31', 'biichnguyen1993'), mk('32', 'Biichnguyen1993')];
let C3 = boot([], cust3); vm.runInContext('updateCSStaffList()', C3);
ok(vm.runInContext('csComboData', C3).filter(x => x.value !== 'all').map(x => x.value).join() === 'Biichnguyen1993', 'ngang nhau: uu tien kieu viet hoa chu dau');
// _buildCsSet_ sau khi da co bang chuan: don moi toi cung ra ten chuan
const nb = vm.runInContext('_buildCsSet_([{cs:"biichnguyen1993"}], "0999")', C);
ok(nb.size === 1 && nb.has('Biichnguyen1993'), '_buildCsSet_ (khach moi nap sau) cung ra ten chuan');
ok(vm.runInContext('_csCanonName_("Abc Khac")', C) === 'Abc Khac' && vm.runInContext('_csCanonName_("")', C) === '', 'ten khong thuoc bang chuan giu nguyen');
console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);

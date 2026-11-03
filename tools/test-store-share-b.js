#!/usr/bin/env node
// Test gop PHAN SALE 30% DON QUAY vao Bao cao B "Theo Sale" (js/63 _srMergeStoreIntoBySale_). Chay: node tools/test-store-share-b.js [/tmp/store_rows.json]
// Ca thuc: 18 sale On/Off T10/2026 — so Pos tren man hinh CRM (anh) + 24 dong don quay trong file KT Huyen => tong phai khop KT (tru M46575 chua vao CRM).
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const ctx = vm.createContext({}); vm.runInContext(fs.readFileSync(__dirname + '/../js/63-fn-saleincome.js', 'utf8'), ctx);
const M = (b, s) => vm.runInContext('_srMergeStoreIntoBySale_', ctx)(b, s);
// 1) quy tac loc + gop khong phan biet hoa/thuong + sale chi co don quay
let r = M([{ name: 'trangNH2005', orders: 10, giaTri: 100e6, cod: 5 }, { name: 'an', orders: 2, giaTri: 10e6, cod: 0 }], { rows: [
  { koDen: false, orders: [{ excluded: false, credits: [{ sale: 'TrangNH2005', amount: 3e6 }, { sale: 'binh', amount: 1e6 }, { sale: 'an', amount: 2e6, dup: true }] }] },
  { koDen: true, orders: [{ credits: [{ sale: 'an', amount: 9e6 }] }] },
  { koDen: false, orders: [{ excluded: true, credits: [{ sale: 'an', amount: 9e6 }] }] },
  { koDen: false, orders: [{ credits: [{ sale: 'an', amount: 0 }] }] }] });
const g = n => r.rows.find(x => x.name === n);
ok(g('trangNH2005').giaTri === 103e6 && g('trangNH2005').orders === 11 && g('trangNH2005').storeAmt === 3e6, 'TrangNH2005 gop vao trangNH2005 (+3tr, +1 luot don)');
ok(g('an').giaTri === 10e6 && g('an').storeAmt === undefined, 'khach KHONG den / don excluded / phan Trung / 0d khong cong');
ok(g('binh') && g('binh').giaTri === 1e6 && g('binh').cod === 0, 'sale chi co don quay -> them dong moi');
ok(r.storeTotal === 4e6 && r.storeOrders === 2, 'storeTotal=4tr / 2 luot');
ok(M([{ name: 'an', giaTri: 5 }], null).rows[0].giaTri === 5 && M(null, null).rows.length === 0, 'khong co du lieu quay -> giu nguyen');
// 1b) ten khac cua CUNG nguoi (alias): don quay ghi 'Thuydinh1995' = tai khoan thuydinh95 -> gop vao dong thuydinh95, KHONG tach dong rieng
vm.runInContext("_cfgAliasesOf = function(n){ return String(n).toLowerCase() === 'thuydinh1995' ? ['Thuydinh1995', 'thuydinh95'] : [n]; };", ctx);
r = M([{ name: 'thuydinh95', orders: 5, giaTri: 859603750 }], { rows: [{ koDen: false, orders: [{ credits: [{ sale: 'Thuydinh1995', amount: 3960000 }] }] }] });
ok(r.rows.length === 1 && r.rows[0].name === 'thuydinh95' && r.rows[0].giaTri === 859603750 + 3960000, 'Thuydinh1995 (alias) gop vao thuydinh95, khong tach dong');
vm.runInContext("_cfgAliasesOf = undefined;", ctx);
// 2) ca thuc T10: so Pos (anh CRM) + 24 dong don quay KT
const SCREEN = { huyenmaii1990: 973566167, ninhnga99: 947635917, thuydinh95: 859603750, anhtrinh1995: 640341250, thuyha88: 454242500, biichnguyen1993: 441945333, phuongthao2000: 427128250, trangNH2005: 417218000, yenNTH2004: 362280000, anhNP1999: 284332833, dungnguyen1995: 176408667, minhquach1995: 164435500, ninhLTK1984: 149172500, ngocNB2003saleoff: 62232000, haPTN: 31444333, tuoipham1993: 16300000, mainguyen97: 14319000, thanhNP: 10340667 };
const f = process.argv[2] || '/tmp/store_rows.json';
if (fs.existsSync(f)) {
  const R = M(Object.keys(SCREEN).map(n => ({ name: n, orders: 1, giaTri: SCREEN[n] })), { rows: JSON.parse(fs.readFileSync(f, 'utf8')) });
  const KT = 6500163967, SAVE = KT - 9002000;   // KT - don M46575 chua vao CRM
  const sum18 = R.rows.filter(x => SCREEN[x.name] !== undefined).reduce((s, x) => s + x.giaTri, 0);
  ok(Math.abs(sum18 - SAVE) < 5, 'tong 18 sale sau gop = KT - M46575 = ' + SAVE + ' (' + Math.round(sum18) + ')');
  ok(Math.abs(R.rows.find(x => x.name === 'yenNTH2004').giaTri - (362280000 + 14503800)) < 2, 'yenNTH2004 = Pos + 14.503.800 don quay');
  ok(Math.abs(R.storeTotal - (58215300 + 2700000)) < 5, 'tong don quay = 58.215.300 (18 sale) + 2.700.000 (2 sale ngoai)');
}
console.log(bad ? bad + ' LOI' : 'TAT CA QUA'); process.exit(bad ? 1 : 0);

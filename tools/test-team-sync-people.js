// Test _srSyncTeamToSale_ (js/11): bao "BI BO" theo NGUOI, khong theo tung ten/the phu. Chay: node tools/test-team-sync-people.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js/11-fn-srload.js'), 'utf8');
const i = src.indexOf('function _srSyncTeamToSale_(teamField){'), j = src.indexOf('function _srComboBuildData(domId)');
const toasts = [];
// Nhom the cua tung nguoi (giong SALE_PERSON_TAGS / tai khoan nhieu ten) — dung 5 truong hop Duyen bao 17/10/2026
const GROUPS = [
  ['anhtrinh1995', 'Trịnh Phương Anh', '6', 'S6 anhtrinh1995', 'Trịnh Phuong Anh', 'anhTP1995'],
  ['trangNH2005', 'Nguyễn Huyền Trang', 'S3 trangNH2005', 'Trang Ng'],
  ['yenNTH2004', 'Nguyễn Thị Hải Yến', 'Hai Yen Nguyen', 'S1 yenNTH2004'],
  ['ninhLTK1984', 'ninhLTK'],
  ['anhNP1999', 'Nguyễn Phương Anh', 'Anh NgPhuong', 'S2 anhNP1999'],
];
const ctx = { toast: m => toasts.push(m), _srState: {}, _srTeamFieldToSaleField_: { team: 'sale' }, teams: [],
  _personAliases: n => (GROUPS.find(g => g.some(x => x.toLowerCase() === String(n).toLowerCase())) || [n]),
  _srClearAutoSale_() {}, _srSaleSig_: a => JSON.stringify((a || []).slice().sort()) };
vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const run = (members, opts) => { toasts.length = 0; ctx._srState = { team: ['Team A'], saleOptions: opts, sale: [] }; ctx.teams = [{ name: 'Team A', leader: '', members }]; ctx._srSyncTeamToSale_('team'); return ctx._srState; };
const OPTS = ['anhtrinh1995', 'trangNH2005', 'yenNTH2004', 'ninhLTK1984', 'anhNP1999', 'thanhNP'];

// Truong hop that: moi nguoi duoc ghi trong Team bang NHIEU ten (ten that, the, "S6 the") nhung du lieu chi co 1 the chinh
let st = run(['Trịnh Phương Anh', 'S6 anhtrinh1995', 'anhTP1995', 'Nguyễn Huyền Trang', 'Trang Ng', 'Nguyễn Thị Hải Yến', 'ninhLTK', 'Nguyễn Phương Anh', 'thanhNP'], OPTS);
ok(JSON.stringify(st.sale.slice().sort()) === JSON.stringify(['anhNP1999', 'anhtrinh1995', 'ninhLTK1984', 'thanhNP', 'trangNH2005', 'yenNTH2004']), 'ca 5 nguoi + thanhNP deu duoc tinh dung ten chinh: ' + JSON.stringify(st.sale));
ok(st._teamSyncInfo.sale.missing.length === 0, 'KHONG con bao "bi bo" cho ten phu cua nguoi da khop: ' + JSON.stringify(st._teamSyncInfo.sale.missing));
ok(!toasts.some(m => /bỏ qua/.test(m)), 'khong toast canh bao sai');

// Nguoi that su khong khop ten nao -> van bao, theo TEN NGUOI (1 lan)
st = run(['Nguyễn Văn Z', 'Trịnh Phương Anh'], OPTS);
ok(JSON.stringify(st._teamSyncInfo.sale.missing) === JSON.stringify(['Nguyễn Văn Z']) && st.sale.length === 1 && st.sale[0] === 'anhtrinh1995', 'nguoi khong co the nao khop van bi bao dung 1 lan, khong dong nguoi khac: ' + JSON.stringify(st._teamSyncInfo.sale));
ok(toasts.some(m => /1 người/.test(m)), 'toast dem theo nguoi');

// "S6 anhtrinh1995" khong co nhom the van khop the that (bo tien to S<so>)
ctx._personAliases = n => [n];
st = run(['S6 anhtrinh1995', '6', 'S3 trangNH2005'], OPTS);
ok(JSON.stringify(st.sale.slice().sort()) === JSON.stringify(['anhtrinh1995', 'trangNH2005']), 'tien to "S<so>" duoc bo de khop the that: ' + JSON.stringify(st.sale));
ok(JSON.stringify(st._teamSyncInfo.sale.missing) === JSON.stringify(['6']), 'chi so "6" don le (khong the) bi bao: ' + JSON.stringify(st._teamSyncInfo.sale.missing));
// khop khong phan biet hoa/thuong + dau
st = run(['ANHTRINH1995', 'Yennth2004'], OPTS);
ok(st.sale.length === 2, 'hoa/thuong khong anh huong');
// khong co dong nao khop -> giu nguyen bo loc cu (khong ghi de rong)
st = run(['Khong Ai', 'Ten La'], OPTS);
ok(st.sale.length === 0 && toasts.some(m => /Không tên nào trong Team khớp/.test(m)), 'khong ai khop -> giu bo loc cu, bao ro');
console.log('ALL TEAM SYNC TESTS PASSED');

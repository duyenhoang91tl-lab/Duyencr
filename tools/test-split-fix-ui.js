// Test panel "Don lech Pos-Base" (js/50-split-orders.js): parse dong chia tay, gop/xoa trong acctSplitExtra, hien thi panel, luu qua setSetting. Chay: node tools/test-split-fix-ui.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/50-split-orders.js', 'utf8');
function grab(name, async_) { const key = (async_ ? 'async function ' : 'function ') + name + '('; const i = src.indexOf(key); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const names = ['splitEsc_', 'splitMoney_', 'splitFixCodeNy_', 'splitFixParseLines_', 'splitFixRemoveCode_', 'splitFixMergeExtra_', 'splitFixDefaultText_', 'splitFixSumHtml_', 'splitFixPanelHtml_', 'splitFixEdit_'];
const asyncNames = ['_splitFixGetExtra_', '_splitFixPutExtra_', 'splitFixSave_', 'splitFixDelete_'];
let SETTING = '', POSTS = [], TOASTS = [], CONFIRM = true, LOADS = 0;
const ctx = { _srState: { fixOpen: true, mDateFrom: '2026-10-01', mDateTo: '2026-10-31' }, _srIsAdmin_: () => true, gsUrl: 'http://gs', toast: m => TOASTS.push(m), confirm: () => CONFIRM,
  _srFetch: async (a) => a === 'getSetting' ? { value: SETTING } : null, _srLoad: () => { LOADS++; }, splitFixLoad_: () => {}, JSON, console, document: { getElementById: () => null },
  fetch: async (u, o) => { const b = JSON.parse(o.body); POSTS.push(b); if (b.action === 'setSetting') SETTING = b.value; return { json: async () => ({ ok: true }) }; } };
vm.createContext(ctx);
vm.runInContext(names.map(n => grab(n)).join('\n') + '\n' + asyncNames.map(n => grab(n, true)).join('\n') + '\n_splitFixRerender_ = function(){};', ctx);
const J = x => JSON.parse(JSON.stringify(x));
// parse
let p = J(vm.runInContext(`splitFixParseLines_('ninhnga99, huyenmaii1990 = 6.700.000\\nninhnga99 = 10708000\\n')`, ctx));
ok(p.errors.length === 0 && p.rows.length === 2 && p.rows[0].sales.join() === 'ninhnga99,huyenmaii1990' && p.rows[0].tong === 6700000 && p.total === 17408000, 'parse: 2 dong, tien co dau cham, tong 17.408.000');
p = J(vm.runInContext(`splitFixParseLines_('khong co dau bang\\n= 5000\\nan = abc')`, ctx));
ok(p.errors.length === 3 && p.rows.length === 0, 'parse: bao loi dong thieu "=", thieu sale, tien sai');
p = J(vm.runInContext(`splitFixParseLines_('an = 0')`, ctx));
ok(p.rows.length === 1 && p.rows[0].tong === 0, 'parse: tong 0 hop le (bo don)');
// merge / remove: thay dong cung ma (khac nam / hoa thuong), giu ma khac
const arr = [{ code: '17T10/2026', sales: ['a'], tong: 1 }, { code: '17t10', sales: ['b'], tong: 2 }, { code: '99T10/2026', sales: ['z'], tong: 9 }];
let m = J(vm.runInContext('splitFixMergeExtra_(' + JSON.stringify(arr) + ', "17T10/2026", [{sales:["n"],tong:5},{sales:["h"],tong:6}])', ctx));
ok(m.length === 3 && m[0].code === '99T10/2026' && m.filter(x => x.code === '17T10/2026').length === 2 && !m.some(x => x.sales[0] === 'a' || x.sales[0] === 'b'), 'merge: thay SACH dong cung ma (ke ca 17t10 khong nam), giu 99T10');
ok(J(vm.runInContext('splitFixRemoveCode_(' + JSON.stringify(arr) + ', "17T10")', ctx)).length === 1, 'remove: xoa moi dong cung ma');
// panel
const ROW = { code: '10T10/2026', ngay: '05/10/2026', khach: 'Khach <A>', sdt: '0900', posVal: 12000000, the: ['An'], baseSum: 15000000, lechTien: 3000000, lechSale: true,
  base: [{ ma: '10T10/2026', ngay: '2026-10-04', saleBan: 'An', giaTri: 10000000, trangThai: 'Hoàn thành', tinh: true }, { ma: '11T10/2026', ngay: '2026-10-04', saleBan: 'Binh', giaTri: 5000000, trangThai: 'Thất bại', tinh: false }],
  current: [{ name: 'An', tien: 8000000 }, { name: 'Binh', tien: 4000000 }], tong: 12000000 };
ctx._srState.fix = { edits: {}, data: { ok: true, total: 1, rows: [ROW] }, extra: [{ code: '17T10/2026', sales: ['ninhnga99', 'huyenmaii1990'], tong: 6700000 }, { code: '17T10/2026', sales: ['ninhnga99'], tong: 10708000 }] };
let h = vm.runInContext('splitFixPanelHtml_()', ctx);
ok(/10T10\/2026/.test(h) && /11T10\/2026/.test(h) && /line-through/.test(h) && /Khach &lt;A&gt;/.test(h) && /An = 8000000/.test(h), 'panel: hien ma don, don goc Base (don bi loai gach ngang), khach da escape, chia hien tai');
ok(/Chia tay đang lưu trong CRM<\/b> \(1 đơn\)/.test(h) && /ninhnga99, huyenmaii1990 = 6\.700\.000/.test(h), 'panel: liet ke chia tay dang luu (gop 2 dong cung ma = 1 don)');
ctx._srIsAdmin_ = () => false; ok(vm.runInContext('splitFixPanelHtml_()', ctx) === '', 'khong phai admin => khong hien panel'); ctx._srIsAdmin_ = () => true;
vm.runInContext('splitFixEdit_(0, "An = 9000000\\nBinh = 3000000")', ctx);
ok(/khớp/.test(vm.runInContext('splitFixSumHtml_(0)', ctx)), 'sua dong: tong 12tr = Pos => "khop"');
vm.runInContext('splitFixEdit_(0, "An = 9000000\\nBinh = 3500000")', ctx);
ok(/chênh \+500\.000/.test(vm.runInContext('splitFixSumHtml_(0)', ctx)), 'sua dong: tong 12,5tr => canh bao chenh +500.000');
// luu
(async () => {
  SETTING = JSON.stringify([{ code: '99T10/2026', sales: ['z'], tong: 9 }, { code: '10T10', sales: ['old'], tong: 1 }]);
  vm.runInContext('splitFixEdit_(0, "An = 9000000\\nBinh = 3000000")', ctx);
  await vm.runInContext('splitFixSave_(0)', ctx);
  const saved = JSON.parse(SETTING);
  ok(POSTS.length === 1 && POSTS[0].key === 'acctSplitExtra' && saved.length === 3 && saved.filter(x => x.code === '10T10/2026').length === 2 && !saved.some(x => x.sales[0] === 'old') && saved.find(x => x.sales[0] === 'An').tong === 9000000, 'luu: setSetting acctSplitExtra, thay dong cu cung ma, giu 99T10');
  ok(LOADS === 1 && /Đã lưu/.test(TOASTS[TOASTS.length - 1]), 'luu xong: tinh lai bao cao + bao thanh cong');
  POSTS = []; CONFIRM = false; await vm.runInContext('splitFixSave_(0)', ctx);
  ok(POSTS.length === 0, 'huy xac nhan => khong ghi');
  CONFIRM = true; vm.runInContext('splitFixEdit_(0, "loi")', ctx); await vm.runInContext('splitFixSave_(0)', ctx);
  ok(POSTS.length === 0 && /❌/.test(TOASTS[TOASTS.length - 1]), 'dong loi => bao loi, khong ghi');
  await vm.runInContext('splitFixDelete_("99T10/2026")', ctx);
  ok(JSON.parse(SETTING).every(x => x.code !== '99T10/2026') && JSON.parse(SETTING).length === 2, 'xoa chia tay 99T10 khoi bang');
  console.log(fail ? 'FAIL ' + fail : 'ALL OK'); process.exit(fail ? 1 : 0);
})();

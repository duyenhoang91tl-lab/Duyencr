// Test hộp "Tạo nhiệm vụ mới" (js/100-b-kenh-create.js): kiểm lỗi, payload khớp server thật (_kenhNormalize_), chống tạo trùng, giữ bản nháp.
// Chạy: node tools/test-kenh-create-ui.js -> "ALL KENH CREATE UI TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..'), R = p => fs.readFileSync(path.join(root, p), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const fnSrc = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
// server thật
const gas = R('gas_v13.js'), g = {};
vm.createContext(g);
vm.runInContext("var KENH_PHAN_LOAI_ = ['Thanh toán toàn bộ', 'Cọc trước', 'Thu COD'];" + ['_kenhList_', '_crmStr_', '_crmNum_', 'normPhone_', '_kenhNormalize_'].map(n => fnSrc(gas, n)).join('\n'), g);
const els = {}; const el = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, value: '', textContent: '', focus() {} });
let modal = null, posts = [], toasts = [], gets = 0, reply = null;
const doc = { getElementById: id => id === 'kn-modal' ? modal : id === 'knf-save' ? (modal && /id="knf-save"/.test(modal.innerHTML) ? el(id) : null) : /^knf-|^xt-wrap/.test(id) ? el(id) : null,
  createElement: () => ({ style: {}, innerHTML: '' }), body: { appendChild(o) { modal = o; o.parentNode = { removeChild() { modal = null; } }; } } };
const w = { gsUrl: 'https://gs/exec', toast: m => toasts.push(m), registerExtraTab: () => {}, localStorage: { getItem: () => 'TOK' }, document: doc,
  currentUser: { name: 'Hoa' }, accounts: [{ username: 'hoa', name: 'Hoa' }, { username: 'nam', name: 'Nam <b>' }, { username: 'off', name: 'Nghỉ', active: false }, { username: 'demo1', name: 'Test', role: 'demo' }],
  fetch: async (u, o) => { if (o && o.method === 'POST') { posts.push(JSON.parse(o.body)); const r = typeof reply === 'function' ? reply() : reply; return { json: async () => r }; } gets++; return { json: async () => ({ ok: true, stages: ['Tiếp nhận đơn'], channels: [], orders: [] }) }; },
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent, Promise, Array, parseInt };
w.window = w; vm.createContext(w);
vm.runInContext(fnSrc(R('js/05-fn-saveeditphone.js'), 'normPhone'), w);
vm.runInContext(R('js/100-a-kenh-board.js'), w); vm.runInContext(R('js/100-b-kenh-create.js'), w);
const run = c => vm.runInContext(c, w), flush = () => new Promise(r => setTimeout(r, 5));
(async () => {
  run("_kn.data = { stages:['Tiếp nhận đơn'], channels:[{name:'Page HT3',count:1}], phanLoai:['Thanh toán toàn bộ','Cọc trước','Thu COD'], orders:[] }; _kn.kenh = 'Zalo'");
  w._knOpenCreateSafe();
  let h = modal.innerHTML;
  ok(['Tên nhiệm vụ (SĐT khách)', 'Kênh bán', 'Sale bán', 'Sản phẩm order', 'Phân loại', 'Giá trị cọc', 'Tổng giá trị đơn (không ship)', 'Giá trị chênh đơn đổi', 'Mô tả', 'Người theo dõi'].every(t => h.includes(t)), 'đủ các trường của form Base');
  ok(w._knf.saleName === 'Hoa' && w._knf.kenh === 'Zalo', 'điền sẵn Sale = mình, Kênh = kênh đang lọc');
  ok(h.includes('Page HT3') && h.includes('Nam &lt;b&gt;') && !h.includes('Nghỉ') && !h.includes('value="demo1"'), 'gợi ý kênh + người đang hoạt động (đã thoát HTML, bỏ tài khoản nghỉ/test)');
  // định dạng tiền
  ok(w._knMoneyText('2250000') === '2.250.000' && w._knMoneyText('-500000', true) === '-500.000' && w._knMoneyText('-500000') === '500.000' && w._knMoneyVal('-500.000') === -500000, 'tiền có dấu chấm; chỉ ô chênh đổi nhận số âm');
  // validate
  const base = { phone: '0943 028 399', custName: 'Lan', kenh: 'Page HT3', saleName: 'Hoa, Nam', product: 'Vòng', phanLoai: 'Cọc trước', total: '2.250.000', deposit: '1.000.000', diffExchange: '-100.000', description: 'm', followers: ['nam'] };
  const bad = [['phone', '', /điện thoại/], ['kenh', ' ', /Kênh/], ['saleName', '', /Sale/], ['product', '', /Sản phẩm/], ['phanLoai', '', /Phân loại/], ['deposit', '3.000.000', /cọc/]];
  ok(bad.every(([k, v, re]) => re.test(w._knfValidate(Object.assign({}, base, { [k]: v })))), 'chặn thiếu SĐT/kênh/sale/sản phẩm/phân loại, cọc > tổng');
  ok(w._knfValidate(base) === '' && w._knfValidate(Object.assign({}, base, { phanLoai: 'Thanh toán toàn bộ', deposit: '3.000.000' })) === '', 'dữ liệu đúng qua; thanh toán toàn bộ không chặn cọc');
  const n = g._kenhNormalize_(w._knfPayload(base), false);
  ok(!n.error && n.v.phone === '0943028399' && n.v.total === 2250000 && n.v.deposit === 1000000 && n.v.diffExchange === -100000 && n.v.followers === 'nam' && n.v.saleName === 'Hoa, Nam', 'payload được server thật _kenhNormalize_ nhận đúng');
  // lưu: thiếu → không gửi
  await w._knfSave(); ok(posts.length === 0 && /điện thoại/.test(modal.innerHTML), 'thiếu dữ liệu: không gọi máy chủ, báo tại chỗ');
  // bản nháp giữ khi đóng nhầm
  Object.assign(w._knf, base); w._knfFollow('nam'); ok(w._knf.followers.length === 1, 'không thêm trùng người theo dõi');
  w._knModalClose(); w._knOpenCreate(); ok(modal.innerHTML.includes('0943 028 399') && w._knf.product === 'Vòng', 'bấm ra ngoài rồi mở lại: còn bản nháp');
  // lỗi server → giữ refKey; thử lại cùng refKey
  reply = { ok: false, error: 'Khong co quyen' }; await w._knfSave();
  ok(posts[0].action === 'kenhSave' && posts[0].token === 'TOK' && posts[0].refKey && /Khong co quyen/.test(modal.innerHTML) && !w._knf.busy, 'server báo lỗi: hiện lỗi, giữ form');
  reply = () => { throw new Error('mat mang'); }; await w._knfSave(); ok(posts[1].refKey === posts[0].refKey && /không bị tạo trùng/.test(modal.innerHTML), 'mất mạng rồi thử lại: cùng refKey');
  // bấm đúp khi đang gửi
  let release; reply = null; const orig = w.fetch; w.fetch = async (u, o) => { if (o && o.method === 'POST') { posts.push(JSON.parse(o.body)); return new Promise(r => { release = () => r({ json: async () => ({ ok: true, order: { id: '100005', maBoDem: '5T11/2026', kenh: 'Page HT3' } }) }); }); } return orig(u, o); };
  const g0 = gets, p1 = w._knfSave(); w._knfSave(); ok(posts.length === 3 && /Đang tạo/.test(modal.innerHTML), 'bấm đúp: chỉ gửi 1 lần');
  release(); await p1; await flush();
  ok(w._knf === null && modal === null && /5T11\/2026/.test(toasts.pop()) && gets === g0 + 1 && w._kn.kenh === '', 'tạo xong: đóng hộp, báo mã, tải lại bảng, bỏ lọc kênh khác');
  w._knOpenCreate(); ok(w._knf.phone === '' && w._knf.refKey === '', 'lần sau là form trống');
  Object.assign(w._knf, base); w._knfCancel(); ok(w._knf === null && modal === null, 'Huỷ: xoá nháp');
  ok(/js\/100-a-kenh-board\.js[\s\S]*js\/100-b-kenh-create\.js\?v=/.test(R('index.html')), 'index.html nạp 100-b sau 100-a');
  console.log('ALL KENH CREATE UI TESTS PASSED');
})().catch(e => { console.error('FAIL (exception): ' + (e && e.stack || e)); process.exit(1); });

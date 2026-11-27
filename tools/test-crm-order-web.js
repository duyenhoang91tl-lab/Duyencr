// Test web "Tao don" (js/99-d-crm-order.js): cong thuc tien KHOP server (gas/35_CrmOrder.gs _crmOrderNormalize_), so lieu trong clip, validate, payload, luong luu + refKey chong trung.
// Chay: node tools/test-crm-order-web.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
// ── server (GAS) ──
const g = { normPhone_: p => String(p).replace(/\D/g, '').replace(/^84/, '0') };
vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(root, 'gas/35_CrmOrder.gs'), 'utf8'), g);
// ── web ──
let posts = [], reply = null;
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '' });
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => id === 'xt-wrap-taodon' ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async (u, o) => { posts.push(JSON.parse(o.body)); const r = typeof reply === 'function' ? reply(posts[posts.length - 1]) : reply; return { json: async () => r }; },
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'js/99-d-crm-order.js'), 'utf8'), w);
const S = (items, extra) => Object.assign({ phone: '0912345678', items }, extra || {});
const itm = (qty, price, dt, dv) => ({ name: 'SP', qty, price, discType: dt || 'amt', discValue: dv || 0 });
// 1) so lieu clip
let c = w._coCalc(S([itm(1, 990000, 'pct', 10)], { shipFee: 40000, paid: 300000 }));
ok(c.total === 931000 && c.due === 631000 && c.itemDiscount === 99000, 'clip 1: 990.000 -10% +ship 40.000 = 931.000, CK 300.000 -> thieu 631.000');
c = w._coCalc(S([itm(1, 1250000)], { shipFee: 40000 }));
ok(c.total === 1290000 && c.due === 1290000, 'clip 2: 1.250.000 + 40.000 = 1.290.000');
c = w._coCalc(S([itm(2, 500000)], { shipFee: 40000, freeShip: true, surcharge: 15000, discType: 'pct', discValue: 150, paid: 5000000 }));
ok(c.orderDiscount === 1000000 && c.shipFee === 0 && c.total === 15000 && c.due === 0, 'giam >100% bi chan, mien ship, phu thu, thua CK -> thieu 0');
c = w._coCalc(S([{ name: 'A', qty: 1, price: 1000000, discType: 'pct', discValue: 10, taxPct: 8 }]));
ok(c.tax === 72000 && c.total === 972000, 'thue 8% tren 900.000 = 72.000 (cong vao can thu) — khop server');
// 2) khop server (fuzz 400 ca)
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let bad = 0;
for (let n = 0; n < 400; n++) {
  const items = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({ name: 'A', qty: 1 + Math.floor(rnd() * 5), price: Math.floor(rnd() * 3000) * 1000 + Math.floor(rnd() * 3) * 333, discType: rnd() < .5 ? 'pct' : 'amt', discValue: rnd() < .5 ? Math.floor(rnd() * 130) : Math.floor(rnd() * 900000), taxPct: rnd() < .5 ? 0 : Math.floor(rnd() * 120) }));
  const o = S(items, { discType: rnd() < .5 ? 'pct' : 'amt', discValue: Math.floor(rnd() * 120) * (rnd() < .5 ? 1 : 5000), freeShip: rnd() < .3, shipFee: Math.floor(rnd() * 80) * 1000, surcharge: Math.floor(rnd() * 30) * 1000, paid: Math.floor(rnd() * 5000) * 1000 });
  const a = w._coCalc(o), s = g._crmOrderNormalize_(w._coPayload(o));
  if (s.error || a.total !== s.order.total || a.due !== s.order.due || a.gross !== s.order.gross || a.itemDiscount !== s.order.itemDiscount || a.tax !== s.order.tax || a.orderDiscount !== s.order.orderDiscount) { bad++; if (bad < 3) console.error(JSON.stringify([o, a, s])); }
}
ok(bad === 0, 'cong thuc client KHOP server trong 400 ca ngau nhien (' + bad + ' lech)');
// 3) validate + payload
ok(/số điện thoại/.test(w._coValidate(S([itm(1, 1)], { phone: '09' }))), 'thieu SDT bi chan');
ok(/chưa có sản phẩm/.test(w._coValidate(S([]))), 'don rong bi chan');
ok(/số lượng/.test(w._coValidate(S([itm(0, 1)]))), 'SL 0 bi chan');
ok(w._coValidate(S([itm(1, 1000)])) === '', 'don hop le qua');
const P = w._coPayload(S([{ name: ' Lac ', qty: '2', price: '100000', note: ' x ' }], { custName: ' An ', freeShip: true }));
ok(P.items[0].name === 'Lac' && P.items[0].qty === 2 && P.items[0].price === 100000 && P.custName === 'An' && P.freeShip === true, 'payload lam sach chuoi/so');
// 4) render
w._co = w._coBlank(); w._co.items = [{ name: 'Nhẫn <b>', note: '', qty: 1, price: 1000, discType: 'amt', discValue: 0 }]; w._coRender();
const html = fakeEl('xt-wrap-taodon').innerHTML;
ok(/Tạo đơn trên CRM/.test(html) && /Lưu đơn \(F2\)/.test(html) && !/Nhẫn <b>/.test(html) && /Nhẫn &lt;b&gt;/.test(html), 'render form + escape HTML ten SP');
// 5) luong luu: loi giu refKey, thanh cong doi, duplicate
w._co = w._coBlank(); Object.assign(w._co, S([itm(1, 1000)]), { custName: 'An' }); posts = [];
reply = { ok: false, error: 'Mất mạng' }; (async () => {
  await w._coSave(); const k1 = posts[0].refKey;
  ok(k1 && w._co.refKey === k1 && /Mất mạng/.test(w._co.msg) && !w._co.busy, 'loi: giu refKey de thu lai, bao loi, mo khoa nut');
  reply = { ok: true, duplicate: false, order: { orderId: 'CRM261127-0001', phone: '0912345678', total: 1000, due: 1000, itemCount: 1, qty: 1 } };
  await w._coSave();
  ok(posts[1].refKey === k1 && posts[1].order.items.length === 1 && posts[1].action === 'crmOrderSave', 'thu lai gui DUNG refKey cu');
  ok(w._co.saved && w._co.saved.orderId === 'CRM261127-0001' && w._co.refKey === '', 'luu xong: hien ma don, reset refKey');
  ok(/CRM261127-0001/.test(fakeEl('xt-wrap-taodon').innerHTML) && /Tạo đơn mới/.test(fakeEl('xt-wrap-taodon').innerHTML), 'man ket qua co ma don + nut tao don moi');
  w._coNew(); ok(w._co.saved === null && w._co.items.length === 0 && w._co.saleName === 'Hoa', 'Tao don moi: sach don, giu ten sale');
  posts = []; Object.assign(w._co, S([])); await w._coSave(); ok(posts.length === 0 && /chưa có sản phẩm/.test(w._co.msg), 'validate chan truoc khi goi may chu');
  console.log('ALL CRM-ORDER-WEB TESTS PASSED');
})();

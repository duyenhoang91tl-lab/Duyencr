// Test web "Tao don" bước 4b-2 (js/99-d-crm-order.js): ô Dùng điểm — tiền khớp server (_loyaltyRedeem_), validate chặn vượt mức,
// pointsUse gửi Ở CẤP NGOÀI order, lỗi POINTS tải lại số dư, đổi SĐT xoá điểm cũ, kết quả tải muộn bị bỏ.
// Chạy: node tools/test-crm-order-points-web.js -> "ALL CRM-ORDER-POINTS-WEB TESTS PASSED"
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
// server: luật dùng điểm thật (gas/34) để so khớp
const g = { normPhone_: p => String(p).replace(/\D/g, '').replace(/^84/, '0') };
vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(root, 'gas/34_Loyalty.gs'), 'utf8'), g);
// web
let posts = [], gets = [], replyPost = null, replyGet = null;
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '', value: '' });
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => (id === 'xt-wrap-taodon' || /^co-/.test(id)) ? fakeEl(id) : null, addEventListener() {} },
  fetch: async (u, o) => {
    if (o && o.method === 'POST') { posts.push(JSON.parse(o.body)); const r = typeof replyPost === 'function' ? replyPost(posts[posts.length - 1]) : replyPost; return { json: async () => r }; }
    gets.push(u); const r = typeof replyGet === 'function' ? await replyGet(u) : replyGet; return { json: async () => r };
  }, Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'js/99-d-crm-order.js'), 'utf8'), w);
const LOY = (bal, tier) => ({ ok: true, tierLabel: tier || 'Vip', points: { balance: bal }, config: { pointValue: 1000, rate: 0.01 } });
const clip = { phone: '0943028399', items: [{ name: 'SP', qty: 1, price: 990000, discType: 'pct', discValue: 10 }], shipFee: 40000, paid: 300000 };
const calc = (extra, bal) => w._coCalc(Object.assign({}, clip, { pointsBalance: bal, pointValue: 1000 }, extra));
// 1) số liệu: 931.000 − 100 điểm = 831.000; CK 300.000 → còn thiếu 531.000
let c = calc({ pointsUse: 100 }, 160);
ok(c.totalBeforePoints === 931000 && c.pointsUsed === 100 && c.pointsDiscount === 100000 && c.total === 831000 && c.due === 531000, 'clip: 931.000 − 100 điểm = 831.000, thiếu 531.000');
c = calc({}, 160); ok(c.total === 931000 && c.pointsUsed === 0 && c.pointsMax === 160, 'không nhập điểm: tiền như cũ, mức tối đa 160');
c = w._coCalc(clip); ok(c.total === 931000 && c.pointsUsed === 0, 'không có số dư/điểm: _coCalc cũ không đổi');
// 2) khớp luật server (fuzz 400 ca): cùng số điểm tối đa & tiền giảm
let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; let bad = 0;
for (let i = 0; i < 400; i++) {
  const price = Math.floor(rnd() * 3000000), qty = 1 + Math.floor(rnd() * 3), ship = Math.floor(rnd() * 5) * 20000, bal = Math.floor(rnd() * 400), want = Math.floor(rnd() * 500);
  const cc = w._coCalc({ items: [{ name: 'A', qty, price }], shipFee: ship, pointsBalance: bal, pointValue: 1000, pointsUse: want });
  const sv = g._loyaltyRedeem_(cc.totalBeforePoints, bal, want, null);
  if (cc.pointsUsed !== sv.points || cc.pointsDiscount !== sv.discount || cc.total !== sv.payable) bad++;
}
ok(bad === 0, 'khớp _loyaltyRedeem_ của server trên 400 ca ngẫu nhiên');
// 3) validate: vượt mức bị chặn (không âm thầm cắt); chưa tải điểm cũng chặn; không dùng điểm thì không ảnh hưởng
ok(/tối đa 160 điểm/.test(w._coValidate(Object.assign({}, clip, { pointsBalance: 160, pointValue: 1000, pointsLoaded: true, pointsUse: 161 }))), 'vượt số dư bị chặn');
ok(/tối đa 50 điểm/.test(w._coValidate({ phone: '0912345678', items: [{ name: 'A', qty: 1, price: 50000 }], pointsBalance: 500, pointsLoaded: true, pointsUse: 60 })), 'vượt giá trị đơn ÷ 1.000 bị chặn');
ok(/Chưa tải được điểm/.test(w._coValidate(Object.assign({}, clip, { pointsLoaded: false, pointsUse: 10 }))), 'chưa tải được điểm mà nhập điểm → chặn');
ok(w._coValidate(Object.assign({}, clip, { pointsLoaded: false, pointsUse: 0 })) === '' && w._coValidate(Object.assign({}, clip, { pointsBalance: 160, pointsLoaded: true, pointsUse: 160 })) === '', 'không dùng điểm / dùng đúng mức → hợp lệ');
// 4) payload: pointsUse KHÔNG nằm trong order (server bỏ qua pointsUsed/pointsDiscount trong order)
ok(!('pointsUse' in w._coPayload(Object.assign({}, clip, { pointsUse: 50 }))) && w._coPointsUse({ pointsUse: '50.9' }) === 50 && w._coPointsUse({ pointsUse: -3 }) === 0, 'payload không chứa pointsUse; _coPointsUse làm tròn xuống, không âm');
// 5) luồng: nhập SĐT → loyaltyGet → nhập điểm → Lưu gửi pointsUse ở cấp ngoài
(async () => {
  replyGet = LOY(160); w._co.phone = '0943028399'; w._co.items = [Object.assign({}, clip.items[0])]; w._co.shipFee = 40000; w._co.paid = 300000;
  await w._coLoyLoad();
  ok(gets.length === 1 && /action=loyaltyGet&phone=0943028399/.test(gets[0]) && w._coLoy.data && w._coLoy.data.points.balance === 160, 'đổi SĐT → gọi loyaltyGet, có số dư 160');
  w._coPtsSet('100'); ok(w._co.pointsUse === 100 && /Dùng 100 điểm/.test(fakeEl('co-sum').innerHTML) && /831\.000đ/.test(fakeEl('co-sum').innerHTML), 'nhập 100 điểm → tóm tắt hiện dòng điểm + cần thu 831.000đ');
  w._coPtsMax(); ok(w._co.pointsUse === 160, 'nút "Dùng tối đa" = min(số dư, đơn ÷ 1.000) = 160');
  w._coPtsSet('100');
  replyPost = { ok: true, order: { orderId: 'CRM1', phone: '0943028399', total: 831000, due: 531000, pointsUsed: 100, pointsDiscount: 100000, itemCount: 1, qty: 1 } };
  await w._coSave();
  const p = posts[posts.length - 1];
  ok(p.action === 'crmOrderSave' && p.pointsUse === 100 && !('pointsUse' in p.order) && p.refKey, 'Lưu: gửi pointsUse=100 ở cấp ngoài order, kèm refKey');
  ok(/Đã dùng <b>100<\/b> điểm/.test(fakeEl('xt-wrap-taodon').innerHTML), 'màn đã lưu hiện số điểm đã dùng');
  w._coNew(); ok(w._co.pointsUse === 0 && w._coLoy.data === null, 'đơn mới: xoá số điểm + số dư cũ (phải tải lại)');
  // 6) vượt mức bị CHẶN ở client: không gọi server
  replyGet = LOY(60); w._co.phone = '0943028399'; w._co.items = [Object.assign({}, clip.items[0])]; await w._coLoyLoad();
  const n = posts.length; w._coPtsSet('100'); await w._coSave();
  ok(posts.length === n && /tối đa 60 điểm/.test(w._co.msg), 'vượt mức: chặn tại client, không gọi máy chủ');
  // 7) server từ chối POINTS (máy khác vừa dùng điểm) → báo lỗi + tải lại số dư
  w._coPtsSet('50'); replyGet = LOY(20); replyPost = { ok: false, code: 'POINTS', error: 'Khong du diem: muon dung 50 diem, toi da dung duoc 20 diem', maxPoints: 20 };
  const g0 = gets.length; await w._coSave(); await new Promise(r => setTimeout(r, 5));
  ok(!w._co.msgOk && /Khong du diem/.test(w._co.msg) && gets.length === g0 + 1 && w._coLoy.data.points.balance === 20 && w._co.refKey, 'POINTS: hiện lỗi server, tải lại số dư (20), giữ refKey để thử lại');
  // 8) đổi SĐT → xoá điểm đang nhập + số dư cũ; kết quả tải muộn của SĐT cũ bị bỏ
  w._co.phone = '0911111111'; w._coLoySync(); ok(w._co.pointsUse === 0 && w._coLoy.data === null && w._coLoy.phone === '0911111111', 'đổi SĐT: điểm đang nhập về 0, số dư cũ bị xoá');
  let release; replyGet = () => new Promise(r => { release = () => r(LOY(999)); });
  w._co.phone = '0922222222'; const slow = w._coLoyLoad(); w._co.phone = '0933333333'; replyGet = LOY(5); await w._coLoyLoad(); release(); await slow;
  ok(w._coLoy.phone === '0933333333' && w._coLoy.data.points.balance === 5, 'kết quả tải muộn của SĐT cũ không ghi đè khách hiện tại');
  // 9) lỗi GAS chưa có loyaltyGet: báo lỗi, KHÔNG chặn lưu đơn không dùng điểm
  replyGet = { ok: false, error: 'Unknown action' }; w._co.phone = '0944444444'; w._co.items = [Object.assign({}, clip.items[0])]; await w._coLoyLoad();
  ok(w._coLoy.err && /Unknown action/.test(w._coLoy.err) && w._coValidate(w._coNow()) === '', 'lỗi tải điểm hiện tại chỗ, vẫn lưu được đơn không dùng điểm');
  console.log('ALL CRM-ORDER-POINTS-WEB TESTS PASSED');
})().catch(e => { console.error('FAIL (exception): ' + (e && e.stack || e)); process.exit(1); });

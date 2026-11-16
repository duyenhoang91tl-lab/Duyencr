#!/usr/bin/env node
// 🐶 Linh vật Samoyed (js/79-mascot-samoyed.js): chạy file THẬT trong sandbox vm với DOM giả tối thiểu.
// Kiểm: bật/tắt + lưu localStorage, nhãn, điểm đến luôn trong biên, canvas không chặn chuột/z-index đúng, vẽ không lỗi,
// đi dạo thật sự di chuyển rồi ngồi nghỉ, giảm chuyển động = 1 khung tĩnh (không rAF), nối đúng vào menu Settings + index.html.
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SPEED_MAX_STEP = 10;   // chạy trốn 96px/s * 0.1s (dt tối đa) = 9.6px < 10
const SRC = fs.readFileSync(path.join(root, 'js/79-mascot-samoyed.js'), 'utf8');

function makeEnv(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.ls || {});
  const calls = { draw: 0, clear: 0, raf: 0, text: 0 };
  const ctx = new Proxy({}, { get(t, k) {
    if (k === 'clearRect') return () => { calls.clear++; };
    if (k === 'fillText') return () => { calls.text++; };
    if (k === 'fill') return () => { calls.draw++; };
    return t[k] !== undefined ? t[k] : () => {};
  }, set(t, k, v) { t[k] = v; return true; } });
  const mkEl = () => ({ style: {}, setAttribute() {}, appendChild() {}, getContext: () => ctx, id: '', width: 0, height: 0, textContent: '', getBoundingClientRect: () => ({ left: 0, top: 500, width: opts.w || 1200, height: 112 }) });
  const els = []; let rafCb = null;
  const win = {
    innerWidth: opts.w || 1200, devicePixelRatio: 1, __handlers: {},
    addEventListener(n, f) { (win.__handlers[n] = win.__handlers[n] || []).push(f); },
    matchMedia: () => ({ matches: !!opts.reduced, addEventListener() {} }),
    getComputedStyle: () => ({ display: opts.tabbar ? 'flex' : 'none', position: 'fixed' }),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    requestAnimationFrame: f => { calls.raf++; rafCb = f; return calls.raf; }, cancelAnimationFrame() {},
    toast: m => { win.__toast = m; },
  };
  const doc = {
    hidden: false, body: { appendChild: e => els.push(e) }, head: { appendChild() {} }, documentElement: { clientWidth: opts.w || 1200 },
    createElement: () => mkEl(), __h: {}, addEventListener(n, f) { (doc.__h[n] = doc.__h[n] || []).push(f); },
    getElementById: id => (id === 'pro-tabbar' && opts.tabbar ? { offsetHeight: 38 } : null),
  };
  win.window = win; win.document = doc;
  const sandbox = Object.assign(win, { localStorage: win.localStorage, document: doc, toast: win.toast, console, Math, Date, setTimeout: () => 0, clearTimeout() {} });
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { win: sandbox, doc, store, calls, els, step: ts => { const f = rafCb; rafCb = null; if (f) f(ts); return !!f; } };
}

// 1) Mặc định bật: tạo đúng 1 canvas, không bắt chuột, z-index 249 (dưới cánh đào 250, dưới thanh tab 310)
let e = makeEnv();
ok(e.els.length === 1, 'tạo đúng 1 canvas, có ' + e.els.length);
const cv = e.els[0];
ok(cv.id === 'mascot-fx', 'id mascot-fx');
ok(/pointer-events:none/.test(cv.style.cssText), 'canvas không bắt chuột');
ok(/z-index:249/.test(cv.style.cssText), 'z-index 249');
ok(cv.style.bottom === 'env(safe-area-inset-bottom,0px)', 'không có thanh tab → sát đáy theo vùng an toàn, có ' + cv.style.bottom);
ok(e.win._mascotIsOn() === true && e.win._mascotLabel() === '🐶 Tắt linh vật Samoyed', 'nhãn khi đang bật');

// 2) Có thanh tab → nằm ngay trên thanh tab
e = makeEnv({ tabbar: true });
ok(e.els[0].style.bottom === '38px', 'đặt trên thanh tab 38px, có ' + e.els[0].style.bottom);

// 3) Chạy vòng lặp: vẽ được, không lỗi; ngồi nghỉ xong thì đi dạo và x thật sự thay đổi trong biên
e = makeEnv({ w: 1000 });
let t = 1000, maxX = 0, minX = 1e9, sawWalk = false, drew = 0;
for (let i = 0; i < 4000; i++) { t += 40; if (!e.step(t)) break; }
ok(e.calls.draw > 500, 'vẽ nhiều khung không lỗi (fill=' + e.calls.draw + ')');
ok(e.calls.clear > 50, 'xoá canvas mỗi khung (' + e.calls.clear + ')');
ok(e.calls.text > 0, 'có nổi trái tim (fillText=' + e.calls.text + ')');

// 3b) Đi dạo THẬT: mô phỏng 160 giây — x phải đổi, luôn trong [44, w-140], có cả hướng trái lẫn phải, và có cả lúc đi lẫn lúc nghỉ
e = makeEnv({ w: 1000 });
t = 1000; const xs = [], modes = new Set(), faces = new Set(); let outOfRange = 0, tiny = 0, prevX = null;
for (let i = 0; i < 4000; i++) {
  t += 40; if (!e.step(t)) break;
  const st = e.win._mascotState_(); xs.push(st.x); modes.add(st.mode); faces.add(st.facing);
  if (st.x < 44 - 1e-6 || st.x > 1000 - 140 + 1e-6) outOfRange++;
  if (prevX !== null && Math.abs(st.x - prevX) > SPEED_MAX_STEP) tiny++;   // bước nhảy bất thường (> ~2px/khung) = dịch chuyển tức thời
  prevX = st.x;
}
ok(outOfRange === 0, 'vị trí vượt biên ' + outOfRange + ' khung');
ok(Math.max.apply(null, xs) - Math.min.apply(null, xs) > 100, 'đi dạo thật: biên độ x = ' + (Math.max.apply(null, xs) - Math.min.apply(null, xs)).toFixed(0) + 'px');
ok(modes.has('walk') && modes.has('idle'), 'có cả lúc đi lẫn lúc nghỉ: ' + Array.from(modes).join(','));
ok(faces.has(1) && faces.has(-1), 'đổi hướng mặt trái/phải');
ok(tiny === 0, 'không có bước nhảy tức thời (' + tiny + ' khung)');

// 3c) Vườn nhỏ: hoa theo bề rộng, bướm/ong bay trong biên suốt 160s, không toạ độ NaN
e = makeEnv({ w: 1000 });
let st0 = e.win._mascotState_();
ok(st0.flowers >= 8 && st0.flowers <= 28, 'số hoa trong [8,28]: ' + st0.flowers);
ok(st0.butterflies.length === 4 && st0.bees.length === 2, 'desktop: 4 bướm + 2 ong (' + st0.butterflies.length + '/' + st0.bees.length + ')');
let bad = 0, flyMoved = 0; const b0 = { x: st0.bees[0].x, y: st0.bees[0].y }; t = 1000;
for (let i = 0; i < 4000; i++) {
  t += 40; if (!e.step(t)) break;
  const g = e.win._mascotState_();
  g.butterflies.concat(g.bees).forEach(f => { if (!isFinite(f.x) || !isFinite(f.y) || f.y < 0 || f.y > g.ch || f.x < -21 || f.x > 1021) bad++; });
}
ok(bad === 0, 'bướm/ong luôn trong khung, không NaN (' + bad + ' lần sai)');
const g1 = e.win._mascotState_();
ok(Math.hypot(g1.bees[0].x - b0.x, g1.bees[0].y - b0.y) > 5, 'ong thật sự bay (đổi vị trí)');
e = makeEnv({ w: 390 }); st0 = e.win._mascotState_();
ok(st0.butterflies.length === 2 && st0.bees.length === 1, 'điện thoại: 2 bướm + 1 ong, nhẹ hơn (' + st0.butterflies.length + '/' + st0.bees.length + ')');
e = makeEnv({ w: 1000, reduced: true });
ok(e.calls.raf === 0, 'giảm chuyển động: vườn cũng đứng yên, không rAF');

// 3d) Chạy trốn ong: đặt ong sát chó lúc đang ngồi → chó chuyển sang chạy (run), tốc độ cao, chạy ngược hướng ong, tới nơi thì ngồi lại
let g;
e = makeEnv({ w: 1000 }); t = 1000; e.step(t); g = e.win._mascotState_();
let fled = false, dirOk = false, startX = 0, speedMax = 0, prev = null;
for (let i = 0; i < 3000 && !fled; i++) {
  g = e.win._mascotState_();
  if (g.dog.mode === 'idle') { g.dog.x = 500; g.dog.until = 1e9; g.bees.forEach((b, j) => { b.x = j ? 900 : 470; b.y = 66; b.v = 0; }); }
  t += 40; e.step(t); g = e.win._mascotState_();
  if (g.run) { fled = true; startX = 500; dirOk = g.dog.target > 500; }
}
ok(fled, 'ong sát chó → chó chạy trốn (run=true)');
ok(dirOk, 'ong ở bên trái → chó chạy sang phải (target=' + g.dog.target.toFixed(0) + ')');
let arrived = false;
for (let i = 0; i < 400 && !arrived; i++) { prev = g.dog.x; t += 40; e.step(t); g = e.win._mascotState_(); speedMax = Math.max(speedMax, Math.abs(g.dog.x - prev) / 0.04); if (g.mode === 'idle') arrived = true; }
ok(arrived && g.run === false, 'chạy tới nơi thì ngồi lại, hết run');
ok(speedMax > 60, 'chạy nhanh hơn đi dạo (' + speedMax.toFixed(0) + 'px/s)');
// mascotFlee_ thuần
let fleeBad = 0;
[320, 800, 1920].forEach(w => { for (let i = 0; i < 4000; i++) { const x = 44 + Math.random() * Math.max(40, w - 184), bx = Math.random() * w, f = e.win._mascotFlee_(w, x, bx, Math.random); if (!(f >= 44 && f <= Math.max(84, w - 140))) fleeBad++; } });
ok(fleeBad === 0, 'mascotFlee_ luôn trong biên (' + fleeBad + ' sai)');
ok(e.win._mascotFlee_(1000, 500, 450, () => 0.5) > 500 && e.win._mascotFlee_(1000, 500, 550, () => 0.5) < 500, 'chạy ngược hướng ong');

// 3e) Nút vườn RIÊNG: tắt vườn → chỉ còn chó (không vẽ hoa/bướm/ong, ong không làm chó giật mình); chó vẫn đi dạo; bật lại thì có lại
e = makeEnv({ w: 1000, ls: { ome_garden: '0' } });
ok(e.win._gardenIsOn() === false && e.win._gardenLabel() === '🌼 Bật vườn hoa-bướm-ong', 'ome_garden=0 → vườn tắt, nhãn "Bật"');
t = 1000; let fillsOff = 0;
for (let i = 0; i < 100; i++) { t += 40; e.step(t); }
const fOff = e.calls.draw / Math.max(1, e.calls.clear);   // số nét fill mỗi khung khi chỉ có chó
e = makeEnv({ w: 1000 }); t = 1000; for (let i = 0; i < 100; i++) { t += 40; e.step(t); }
const fOn = e.calls.draw / Math.max(1, e.calls.clear);
ok(fOn > fOff + 40, 'tắt vườn → vẽ ít nét hơn hẳn (' + fOff.toFixed(0) + ' < ' + fOn.toFixed(0) + ' nét/khung)');
// ong sát chó khi vườn tắt → KHÔNG chạy trốn
e = makeEnv({ w: 1000, ls: { ome_garden: '0' } }); t = 1000; e.step(t); let ran = false;
for (let i = 0; i < 1500; i++) {
  let gg = e.win._mascotState_();
  if (gg.dog.mode === 'idle') { gg.dog.x = 500; gg.dog.until = 1e9; gg.bees.forEach(b => { b.x = 470; b.y = 66; b.v = 0; }); }
  t += 40; e.step(t); if (e.win._mascotState_().run) { ran = true; break; }
}
ok(!ran, 'vườn tắt → ong sát chó cũng không làm chó giật mình');
// toggle: lưu '0'/'1', nhãn đổi, toast, KHÔNG đụng ome_mascot
e = makeEnv({ w: 1000 });
e.win.toggleGarden();
ok(e.store.ome_garden === '0' && e.win._gardenIsOn() === false && !('ome_mascot' in e.store), 'toggleGarden tắt → ome_garden=0, không đụng ome_mascot');
ok(/Đã tắt vườn/.test(e.win.__toast) && e.win._gardenLabel() === '🌼 Bật vườn hoa-bướm-ong', 'toast + nhãn khi tắt vườn');
ok(e.win._mascotIsOn() === true && e.els[0].style.display !== 'none', 'tắt vườn → chó + canvas vẫn còn');
e.win.toggleGarden();
ok(e.store.ome_garden === '1' && e.win._gardenIsOn() === true && /Đã bật vườn/.test(e.win.__toast), 'bật lại vườn');
// giảm chuyển động: bật/tắt vườn vẽ lại ngay 1 khung (không rAF)
e = makeEnv({ w: 1000, reduced: true }); const c0 = e.calls.clear; e.win.toggleGarden();
ok(e.calls.clear === c0 + 1 && e.calls.raf === 0, 'giảm chuyển động: toggle vườn vẽ lại đúng 1 khung, không rAF');

// 3f) BẤM vào chó: hitDog_ thuần + trình nghe pointerdown thật
const rect = { left: 0, top: 500, width: 1000, height: 112 }, dd = { x: 300 };
ok(e.win._mascotHit_(300, 582, rect, dd, 1), 'hitDog_: bấm giữa thân → trúng');
ok(!e.win._mascotHit_(340, 582, rect, dd, 1) && !e.win._mascotHit_(260, 582, rect, dd, 1), 'hitDog_: lệch ngang > 26px → trượt');
ok(!e.win._mascotHit_(300, 520, rect, dd, 1) && !e.win._mascotHit_(300, 620, rect, dd, 1), 'hitDog_: quá cao/quá thấp → trượt');
ok(e.win._mascotHit_(300, 582 - 30, rect, dd, 1) && e.win._mascotHit_(300, 582 + 25, rect, dd, 1), 'hitDog_: đầu và chân đều trúng');
function click(env, x, y, tgtHit, ev) {
  const hs = env.doc.__h.pointerdown || []; ev = ev || {};
  ev.clientX = x; ev.clientY = y; ev.target = { closest: () => (tgtHit ? {} : null) };
  ev.preventDefault = ev.preventDefault || (() => { ev.pd = (ev.pd || 0) + 1; }); ev.stopPropagation = ev.stopPropagation || (() => { ev.sp = (ev.sp || 0) + 1; });
  hs.forEach(h => h(ev)); return ev;
}
e = makeEnv({ w: 1000 }); t = 1000; e.step(t);
ok((e.doc.__h.pointerdown || []).length === 1, 'đăng ký đúng 1 trình nghe pointerdown');
g = e.win._mascotState_(); g.dog.mode = 'idle'; g.dog.until = 0.1; g.dog.x = 300;
let ev1 = click(e, 300, 582, false);
ok(g.dog.react && /Gâu|Hihi/.test(g.dog.react.txt), 'bấm vào chó → react + lời sủa (' + (g.dog.react && g.dog.react.txt) + ')');
ok(!ev1.pd && !ev1.sp, 'KHÔNG preventDefault/stopPropagation (không cản thao tác bên dưới)');
const r0 = g.dog.react; click(e, 300, 582, false);
ok(g.dog.react === r0, 'đang phản ứng thì bấm tiếp không khởi động lại');
for (let i = 0; i < 40; i++) { t += 40; e.step(t); }   // 1.6s
ok(e.win._mascotState_().mode === 'idle', 'đang ngồi: được ở lại chơi, không bỏ đi giữa chừng cú nhảy');
ok(e.win._mascotState_().dog.react === null, 'phản ứng tự kết thúc sau ~1.1s');
click(e, 300, 582, true);
ok(e.win._mascotState_().dog.react === null, 'bấm lên nút/liên kết (closest trúng) → chó KHÔNG phản ứng');
click(e, 700, 582, false);
ok(e.win._mascotState_().dog.react === null, 'bấm chỗ khác → không phản ứng');
e = makeEnv({ w: 1000, reduced: true }); g = e.win._mascotState_(); g.dog.x = 300; click(e, 300, 582, false);
ok(e.win._mascotState_().dog.react === null, 'giảm chuyển động → bấm chó không phản ứng');
e = makeEnv({ w: 1000, ls: { ome_mascot: '0' } }); click(e, 300, 582, false);
ok(e.els.length === 0, 'đã tắt linh vật → không canvas, bấm không lỗi');
e = makeEnv({ w: 1000 }); t = 1000; e.step(t); g = e.win._mascotState_(); g.dog.x = 300; g.dog.mode = 'idle'; g.dog.until = 1e9;
e.win.toggleMascot(); click(e, 300, 582, false);
ok(e.win._mascotState_().dog.react === null, 'vừa tắt linh vật → bấm không phản ứng');

// 3g) Ong ĐẬU hoa: đi tới → đậu đúng đầu hoa → bay tiếp; ong đang đậu KHÔNG dọa chó, ong bay thì có
function perchEnv() {
  const env = makeEnv({ w: 1000 }); let tt = 1000; env.step(tt);
  for (let i = 0; i < 120; i++) { tt += 40; env.step(tt); }   // qua 4s cooldown dọa
  const gg = env.win._mascotState_(); const nf = gg.flowers;
  return { env, tt, gg, nf };
}
let P = perchEnv(); e = P.env; t = P.tt; g = P.gg;
ok(g.bees.every(b => b.st === 'fly' || b.st === 'go' || b.st === 'sit'), 'trạng thái ong hợp lệ');
g = e.win._mascotState_();
let sat = false;
g.bees[0].fi = 0; g.bees[0].st = 'go'; g.bees[0].x = 5; g.bees[0].y = 40;
g.bees[1].x = 900; g.bees[1].y = 10; g.bees[1].st = 'fly';
for (let i = 0; i < 700 && !sat; i++) { t += 40; e.step(t); if (e.win._mascotState_().bees[0].st === 'sit') sat = true; }
ok(sat, 'ong chọn hoa → bay tới → đậu (sit) trong < 28s');
const bSit = e.win._mascotState_().bees[0];
ok(Math.abs(bSit.a - Math.PI / 2) < 1e-6 && bSit.y > 60 && bSit.y < 112, 'ong đậu: đầu hướng xuống, ở thấp sát hoa (y=' + bSit.y.toFixed(1) + ')');
let waited = 0, back = false;
for (let i = 0; i < 160 && !back; i++) { t += 40; e.step(t); waited += 0.04; if (e.win._mascotState_().bees[0].st === 'fly') back = true; }
ok(back && waited <= 5, 'đậu xong tự bay tiếp sau ≤ 4.5s (' + waited.toFixed(1) + 's)');
// đậu cạnh chó không làm chó chạy; ong bay sát chó thì có
function nearDog(state) {
  const Q = perchEnv(); let tq = Q.tt; const gq = Q.env.win._mascotState_();
  const last = gq.flowers - 1; gq.bees[0].fi = last; gq.bees[1].x = 100; gq.bees[1].y = 10; gq.bees[1].st = 'fly';
  gq.dog.mode = 'idle'; gq.dog.until = 1e9; gq.dog.run = false;
  // đặt chó đúng chỗ hoa cuối: lấy toạ độ qua bee đậu thử 1 khung
  gq.bees[0].st = 'go'; gq.bees[0].x = 990; gq.bees[0].y = 80;
  for (let i = 0; i < 400; i++) { tq += 40; Q.env.step(tq); if (Q.env.win._mascotState_().bees[0].st === 'sit') break; }
  const bb = Q.env.win._mascotState_().bees[0]; gq.dog.x = bb.x; gq.dog.mode = 'idle'; gq.dog.until = 1e9;
  if (state === 'fly') { bb.st = 'fly'; bb.v = 0; bb.a = 0; bb.fi = null; }
  gq.dog.run = false; gq.dog.react = null; gq.setFlee(0);   // đặt lại cờ chạy/hồi dọa còn sót từ lúc dàn cảnh
  let ran = false;
  for (let i = 0; i < 60; i++) { gq.dog.x = bb.x; tq += 40; Q.env.step(tq); if (Q.env.win._mascotState_().run) ran = true; if (state === 'fly') { bb.v = 0; } }
  return ran;
}
ok(nearDog('sit') === false, 'ong ĐẬU sát chó → chó không giật mình');
ok(nearDog('fly') === true, 'đối chứng: ong BAY sát chó → chó giật mình chạy');

// 4) mascotPlan_: luôn trong [44, w-140], thời gian nghỉ 5..12, đụng mép thì quay lại — thử nhiều seed + nhiều bề rộng
let badRange = 0, badIdle = 0, moved = 0;
[320, 390, 800, 1200, 1920].forEach(w => {
  for (let i = 0; i < 4000; i++) {
    const x = 44 + Math.random() * Math.max(40, w - 184);
    const p = e.win._mascotPlan_(w, x, Math.random);
    const hi = Math.max(84, w - 140);
    if (!(p.target >= 44 && p.target <= hi)) badRange++;
    if (!(p.idle >= 5 && p.idle <= 12)) badIdle++;
    if (Math.abs(p.target - x) >= 1) moved++;
  }
});
ok(badRange === 0, 'điểm đến vượt biên ' + badRange + ' lần');
ok(badIdle === 0, 'thời gian nghỉ ngoài 5–12s ' + badIdle + ' lần');
ok(moved > 19000, 'hầu như luôn đi sang chỗ khác (' + moved + '/20000)');
// sát mép trái: dù r() chọn đi trái vẫn phải quay sang phải
const pl = e.win._mascotPlan_(1000, 44, (() => { const v = [0.0, 0.5, 0.5]; let i = 0; return () => v[i++ % 3]; })());
ok(pl.target > 44, 'sát mép trái chọn trái → quay sang phải, target=' + pl.target);

// 5) Tắt/bật: lưu '0'/'1', nhãn đổi, canvas ẩn rồi hiện lại, có toast
e = makeEnv();
e.win.toggleMascot();
ok(e.store.ome_mascot === '0' && e.win._mascotIsOn() === false, 'tắt → ome_mascot=0');
ok(e.win._mascotLabel() === '🐶 Bật linh vật Samoyed', 'nhãn khi đang tắt');
ok(e.els[0].style.display === 'none', 'tắt → ẩn canvas');
ok(/Đã tắt/.test(e.win.__toast), 'toast khi tắt');
e.win.toggleMascot();
ok(e.store.ome_mascot === '1' && e.els[0].style.display === '', 'bật lại → hiện canvas');
ok(/Đã bật/.test(e.win.__toast), 'toast khi bật');

// 6) Đã tắt từ trước (ome_mascot=0): không tạo canvas, không chạy rAF
e = makeEnv({ ls: { ome_mascot: '0' } });
ok(e.els.length === 0 && e.calls.raf === 0, 'đã tắt → không canvas, không rAF');

// 7) Giảm chuyển động: có canvas + vẽ 1 khung tĩnh, KHÔNG chạy rAF
e = makeEnv({ reduced: true });
ok(e.els.length === 1 && e.calls.raf === 0, 'giảm chuyển động → không rAF (raf=' + e.calls.raf + ')');
ok(e.calls.draw >= 150 && e.calls.draw < 600, 'giảm chuyển động → vẽ đúng 1 khung tĩnh gồm chó+hoa+bướm+ong (fill=' + e.calls.draw + ')');

// 8) Nạp 2 lần không tạo 2 canvas (guard __mascotLoaded)
vm.runInContext(SRC, e.win);
ok(e.els.length === 1, 'nạp lại không nhân đôi canvas');

// 9) Nối đúng vào menu / trang cấu hình / index.html
const sn = fs.readFileSync(path.join(root, 'js/29-sidenav.js'), 'utf8');
ok(/'act:sakura','act:mascot','act:garden','act:errlog'/.test(sn), 'menu Settings có act:mascot + act:garden');
const gLine = sn.split('\n').find(l => /^\s*garden:\s*\{/.test(l)) || '';
ok(/f:'toggleGarden'/.test(gLine) && /open:true/.test(gLine) && !/admin:true/.test(gLine), 'ACTS.garden gọi toggleGarden, mọi vai trò');
const mLine = sn.split('\n').find(l => /^\s*mascot:\s*\{/.test(l)) || '';
ok(/f:'toggleMascot'/.test(mLine) && /open:true/.test(mLine) && !/admin:true/.test(mLine), 'ACTS.mascot gọi toggleMascot, mọi vai trò (không admin-only)');
const cf = fs.readFileSync(path.join(root, 'js/37-fn-configpage.js'), 'utf8');
ok(/it\('mascot', '🐶 Linh vật Samoyed'\)/.test(cf) && /k === 'mascot'/.test(cf), 'trang Cấu hình có nút + cập nhật nhãn tại chỗ');
ok(/it\('garden', '🌼 Vườn hoa-bướm-ong'\)/.test(cf) && /k === 'garden'/.test(cf), 'trang Cấu hình có nút vườn + cập nhật nhãn tại chỗ');
const ix = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok((ix.match(/js\/79-mascot-samoyed\.js/g) || []).length === 1, 'index.html nạp js/79 đúng 1 lần');
ok(ix.indexOf('js/66-sakura-petals.js') < ix.indexOf('js/79-mascot-samoyed.js') && ix.indexOf('js/79-mascot-samoyed.js') < ix.indexOf('js/68-ui-kit.js'), 'js/79 nằm ngay sau js/66, không đổi thứ tự thẻ cũ');
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);

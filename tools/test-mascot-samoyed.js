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
  // Mặc định mới: điện thoại (≤640px) CHƯA từng chọn → tắt. Các ca cũ kiểm cảnh ở bề rộng điện thoại = người dùng đã bật ('1'); ca mặc định dùng opts.fresh = true.
  if (opts.w && opts.w <= 640 && !opts.fresh && !('ome_mascot' in store)) store.ome_mascot = '1';
  const calls = { draw: 0, clear: 0, raf: 0, text: 0, texts: [] };
  const ctx = new Proxy({}, { get(t, k) {
    if (k === 'clearRect') return () => { calls.clear++; };
    if (k === 'fillText') return (tx, x, y) => { calls.text++; calls.texts.push({ tx: String(tx), x, y }); };
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
ok(st0.butterflies.every(b => Array.isArray(b.pal) && b.pal.length === 3) && new Set(st0.butterflies.map(b => b.pal[0])).size === st0.butterflies.length, 'bướm nhiều màu: mỗi con 1 bộ màu (cánh trên/dưới/chấm) khác nhau');
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
const CHT = e.win._mascotState_().ch;   // chiều cao canvas thật (không gắn cứng: đổi CH ở js/79 không làm test lệch)
const CYT = 500 + CHT - 30;             // y tâm chó = top + CH - 30
const rect = { left: 0, top: 500, width: 1000, height: CHT }, dd = { x: 300 };
ok(e.win._mascotHit_(300, CYT, rect, dd, 1), 'hitDog_: bấm giữa thân → trúng');
ok(!e.win._mascotHit_(340, CYT, rect, dd, 1) && !e.win._mascotHit_(260, CYT, rect, dd, 1), 'hitDog_: lệch ngang > 26px → trượt');
ok(!e.win._mascotHit_(300, CYT - 62, rect, dd, 1) && !e.win._mascotHit_(300, CYT + 38, rect, dd, 1), 'hitDog_: quá cao/quá thấp → trượt');
ok(e.win._mascotHit_(300, CYT - 30, rect, dd, 1) && e.win._mascotHit_(300, CYT + 25, rect, dd, 1), 'hitDog_: đầu và chân đều trúng');
function click(env, x, y, tgtHit, ev) {
  const hs = env.doc.__h.pointerdown || []; ev = ev || {};
  ev.clientX = x; ev.clientY = y; ev.target = { closest: () => (tgtHit ? {} : null) };
  ev.preventDefault = ev.preventDefault || (() => { ev.pd = (ev.pd || 0) + 1; }); ev.stopPropagation = ev.stopPropagation || (() => { ev.sp = (ev.sp || 0) + 1; });
  hs.forEach(h => h(ev)); return ev;
}
e = makeEnv({ w: 1000 }); t = 1000; e.step(t);
ok((e.doc.__h.pointerdown || []).length === 1, 'đăng ký đúng 1 trình nghe pointerdown');
g = e.win._mascotState_(); g.dog.mode = 'idle'; g.dog.until = 0.1; g.dog.x = 300;
let ev1 = click(e, 300, CYT, false);
ok(g.dog.react && /Gâu|Hihi/.test(g.dog.react.txt), 'bấm vào chó → react + lời sủa (' + (g.dog.react && g.dog.react.txt) + ')');
ok(!ev1.pd && !ev1.sp, 'KHÔNG preventDefault/stopPropagation (không cản thao tác bên dưới)');
const r0 = g.dog.react; click(e, 300, CYT, false);
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
ok(Math.abs(bSit.a - Math.PI / 2) < 1e-6 && bSit.y > CHT - 52 && bSit.y < CHT, 'ong đậu: đầu hướng xuống, ở thấp sát hoa (y=' + bSit.y.toFixed(1) + ')');
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
  for (let i = 0; i < 400; i++) { gq.bees[1].x = 500; gq.bees[1].y = 10; tq += 40; Q.env.step(tq); if (Q.env.win._mascotState_().bees[0].st === 'sit') break; }   // ghim ong 2 ở xa: nó bay vòng qua mép màn hình có thể hiện ra sát chó (chó bị ép đứng mép phải, nơi thực tế không tới được)
  const bb = Q.env.win._mascotState_().bees[0]; gq.dog.x = bb.x; gq.dog.mode = 'idle'; gq.dog.until = 1e9;
  if (state === 'fly') { bb.st = 'fly'; bb.v = 0; bb.a = 0; bb.fi = null; }
  gq.dog.run = false; gq.dog.react = null; gq.setFlee(0);   // đặt lại cờ chạy/hồi dọa còn sót từ lúc dàn cảnh
  let ran = false;
  for (let i = 0; i < 60; i++) { gq.dog.x = bb.x; gq.bees[1].x = 500; gq.bees[1].y = 10; tq += 40; Q.env.step(tq); if (Q.env.win._mascotState_().run) ran = true; if (state === 'fly') { bb.v = 0; } }
  return ran;
}
ok(nearDog('sit') === false, 'ong ĐẬU sát chó → chó không giật mình');
ok(nearDog('fly') === true, 'đối chứng: ong BAY sát chó → chó giật mình chạy');

// 3h) BƯỚM: bay nhấp nhô LÊN lẫn xuống (không chỉ chúi xuống), ĐẬU lên hoa rồi bay LÊN tiếp, luôn trong khung
{
  const Q = perchEnv(); let tq = Q.tt; const gq = Q.gg;
  ok(gq.butterflies.every(b => b.st === 'fly' || b.st === 'go' || b.st === 'sit'), 'trạng thái bướm hợp lệ');
  // (a) ghim bướm ở chế độ bay tự do, đo hướng dịch chuyển dọc từng khung trong 120s
  let up = 0, down = 0, badB = 0;
  const prevY = gq.butterflies.map(b => b.y);
  for (let i = 0; i < 3000; i++) {
    tq += 40; Q.env.step(tq);
    gq.butterflies.forEach((b, j) => { if (b.st === 'fly') { const d = b.y - prevY[j]; if (d < -0.01 && d > -5) up++; else if (d > 0.01 && d < 5) down++; } prevY[j] = b.y; if (!isFinite(b.y) || b.y < 0 || b.y > gq.ch || b.x < -21 || b.x > 1021) badB++; });
  }
  ok(up > 200 && down > 200, 'bướm bay cả LÊN (' + up + ') lẫn xuống (' + down + ')');
  ok(up > down * 0.6, 'không chỉ chúi xuống: lên/xuống = ' + (up / down).toFixed(2));
  ok(badB === 0, 'bướm luôn trong khung suốt 120s (' + badB + ' lần sai)');
  // (b) ép bướm 0 bay tới hoa 0 → đậu đúng đầu hoa → tự bay LÊN tiếp
  const bt = gq.butterflies[0]; bt.fi = 0; bt.st = 'go'; bt.x = 5; bt.y = 30;
  let sat2 = false; for (let i = 0; i < 900 && !sat2; i++) { tq += 40; Q.env.step(tq); if (bt.st === 'sit') sat2 = true; }
  ok(sat2, 'bướm chọn hoa → bay tới → ĐẬU (sit)');
  ok(bt.y > CHT - 52 && bt.y < CHT, 'bướm đậu thấp sát đầu hoa (y=' + bt.y.toFixed(1) + ')');
  const yS = bt.y; let left = false, minY = yS, w2 = 0;
  for (let i = 0; i < 260 && !left; i++) { tq += 40; w2 += 0.04; Q.env.step(tq); if (bt.st === 'fly') left = true; }
  ok(left && w2 >= 2.5 && w2 <= 7, 'đậu 3–6s rồi bay tiếp (' + w2.toFixed(1) + 's)');
  for (let i = 0; i < 25; i++) { tq += 40; Q.env.step(tq); minY = Math.min(minY, bt.y); }
  ok(yS - minY > 8, 'vừa cất cánh thì bay LÊN cao hơn chỗ đậu ≥8px (lên ' + (yS - minY).toFixed(1) + 'px)');
  // (c) hoa bị tạo lại (đổi cỡ màn hình) khi bướm đang đậu → về bay tự do, không kẹt
  bt.st = 'sit'; bt.fi = 9999; tq += 40; Q.env.step(tq);
  ok(bt.st === 'fly', 'hoa không còn → bướm về bay tự do');
}

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
// BONG BÓNG "Gâu!" KHÔNG ĐƯỢC BỊ CẮT (Duyên 16/11: tin nhắn của cún bị mất chữ). NGUYÊN NHÂN GỐC: bong bóng vẽ ở y = CH-30-lift-52*s-8 (đỉnh = 2-lift khi s=1)
// nên khi chó nhảy (lift tới 20px) đỉnh bong bóng nằm NGOÀI canvas (y<0) → mất nửa trên (kể cả chữ). Nay canvas cao hơn + drawBark kẹp đỉnh ≥ 2.
[1000, 500].forEach((W0) => {
  const eb = makeEnv({ w: W0 }); let tb = 1000; eb.step(tb);
  const gb = eb.win._mascotState_(); gb.dog.mode = 'idle'; gb.dog.until = 99; gb.dog.x = Math.min(300, W0 / 2);
  gb.dog.react = { t: 0, txt: 'Gâu gâu!' }; eb.calls.texts.length = 0;
  for (let i = 0; i < 30; i++) { tb += 40; eb.step(tb); }
  const bark = eb.calls.texts.filter((q) => q.tx === 'Gâu gâu!');
  const minTop = bark.length ? Math.min.apply(null, bark.map((q) => q.y - 14)) : NaN;
  ok(bark.length > 10 && minTop >= 0, 'bong bóng "Gâu gâu!" luôn nằm TRONG canvas suốt cú nhảy (W=' + W0 + ', đỉnh thấp nhất y=' + minTop.toFixed(1) + ' ≥ 0, ' + bark.length + ' khung)');
});
// 3f) CHUỒN CHUỒN (Duyên 17/11: "thêm vài con chuồn chuồn bay nữa"): số lượng theo màn, trong khung 160s không NaN,
// có cả bay nhanh lẫn LƠ LỬNG, bay nhanh hơn bướm, không đậu hoa, KHÔNG làm chó giật mình, tắt vườn thì không bay, vẽ không lỗi.
[[1200, 3], [500, 2]].forEach(([W0, n0]) => {
  const ed = makeEnv({ w: W0 }); let td = 1000; ed.step(td);
  const gd = ed.win._mascotState_();
  ok(gd.dragonflies.length === n0, 'W=' + W0 + ': ' + n0 + ' chuồn chuồn (có ' + gd.dragonflies.length + ')');
  ok(new Set(gd.dragonflies.map(d => d.pal[0])).size === n0, 'W=' + W0 + ': mỗi chuồn chuồn 1 màu thân khác nhau');
  gd.setFlee(1e9);   // chặn chó chạy trốn ong để đo riêng chuồn chuồn
  let badD = 0, hov = 0, fly = 0, dist = 0, nf = 0; const pv = gd.dragonflies.map(d => ({ x: d.x, y: d.y }));
  for (let i = 0; i < 1600; i++) {
    td += 100; ed.step(td);
    gd.dragonflies.forEach((d, j) => {
      if (!isFinite(d.x) || !isFinite(d.y) || !isFinite(d.a) || d.y < 0 || d.y > gd.ch || d.x < -21 || d.x > W0 + 21) badD++;
      if (d.st === 'hover') hov++; else if (d.st === 'fly') { fly++; const dx = d.x - pv[j].x, dy = d.y - pv[j].y; if (Math.abs(dx) < 60) { dist += Math.sqrt(dx * dx + dy * dy); nf++; } } else badD++;
      pv[j] = { x: d.x, y: d.y };
    });
  }
  ok(badD === 0, 'W=' + W0 + ': chuồn chuồn luôn trong khung 160s, trạng thái chỉ fly/hover, không NaN (' + badD + ' lần sai)');
  ok(hov > 40 && fly > 400, 'W=' + W0 + ': có cả LƠ LỬNG (' + hov + ') lẫn bay (' + fly + ')');
  const spd = dist / nf / 0.1;
  ok(spd > 40 && spd < 100, 'W=' + W0 + ': tốc độ bay trung bình ~' + spd.toFixed(0) + 'px/s (nhanh hơn bướm 16-28)');
});
{
  const ef = makeEnv(); let tf = 1000; ef.step(tf);
  const gf = ef.win._mascotState_(); gf.dog.mode = 'idle'; gf.dog.until = 1e9; gf.dog.x = 300; gf.setFlee(0);
  gf.bees.forEach(b => { b.x = -500; b.y = 20; b.v = 0; b.st = 'sit'; b.until = 1e9; b.fi = 0; });   // ong đậu xa → không dọa chó
  gf.dragonflies.forEach(d => { d.x = 300; d.y = gf.ch - 46; d.st = 'hover'; d.until = 1e9; });   // 3 chuồn chuồn lơ lửng ngay sát chó
  for (let i = 0; i < 20; i++) { tf += 100; ef.step(tf); }
  ok(gf.dog.mode === 'idle' && !gf.dog.run, 'chuồn chuồn bay sát chó KHÔNG làm chó giật mình (chỉ ong mới dọa)');
  ef.store['ome_garden'] = '0'; const hb = ef.calls.draw;
  const eg = makeEnv({ ls: { ome_garden: '0' } }); eg.step(1000); const gg = eg.win._mascotState_(); const x0 = gg.dragonflies.map(d => d.x + ',' + d.y).join('|');
  for (let i = 0; i < 20; i++) eg.step(1000 + (i + 1) * 100);
  ok(gg.dragonflies.map(d => d.x + ',' + d.y).join('|') === x0, 'tắt vườn → chuồn chuồn đứng yên (không cập nhật)');
}

// 8) Mặc định theo thiết bị: điện thoại (≤640px) chưa từng chọn → TẮT (không canvas, không rAF); máy tính → bật; đã chọn thì theo lựa chọn
e = makeEnv({ w: 390, fresh: true });
ok(e.win._mascotIsOn() === false && e.els.length === 0 && e.calls.raf === 0, 'điện thoại chưa chọn → mặc định TẮT (không canvas, không rAF)');
ok(e.win._mascotLabel() === '🐶 Bật linh vật Samoyed', 'điện thoại mặc định tắt → nhãn nút là "Bật"');
e.win.toggleMascot();
ok(e.store.ome_mascot === '1' && e.win._mascotIsOn() === true, 'điện thoại bấm "Bật" → lưu ome_mascot=1 và bật');
e = makeEnv({ w: 390, ls: { ome_mascot: '1' } });
ok(e.win._mascotIsOn() === true && e.els.length > 0, 'điện thoại đã chủ động bật → vẫn bật');
e = makeEnv({ w: 640, fresh: true });
ok(e.win._mascotIsOn() === false, 'đúng 640px vẫn tính là điện thoại → tắt');
e = makeEnv({ w: 641, fresh: true });
ok(e.win._mascotIsOn() === true, '641px trở lên chưa chọn → bật như cũ');
e = makeEnv({ fresh: true });
ok(e.win._mascotIsOn() === true && e.els.length > 0, 'máy tính chưa chọn → mặc định bật như cũ');

console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);

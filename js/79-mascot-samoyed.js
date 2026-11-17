// ════════════════════════════════════════════════════════════════════
//  79-mascot-samoyed.js (15/11/2026) — 🐶 LINH VẬT chó Samoyed (Duyên yêu cầu; cùng nhân vật với game ChromaBlast).
//  Hình vẽ vector bằng canvas, port từ hàm drawDog() của game (maps/map04.js, repo Chromblast — cùng chủ sở hữu).
//  Một <canvas id="mascot-fx"> cố định sát đáy màn hình, NẰM NGAY TRÊN thanh tab #pro-tabbar (nếu có),
//  KHÔNG bắt chuột (pointer-events:none), z-index 249: trên nội dung/header (200), dưới cánh đào (250),
//  dưới thanh tab/dock/hộp thoại/bong bóng chat (≥300) nên không che thao tác nào.
//  VƯỜN NHỎ quanh chó (như màn "chó chạy trốn ong" của game): hàng hoa đung đưa dọc đáy, vài con bướm bay lượn, vài con ong
//  bay lang thang; ong bay sát thì chó giật mình (dấu !) và CHẠY TRỐN sang chỗ khác. Hoa/bướm/ong vẽ lại từ map04.js của game.
//  Hành vi: ngồi nghỉ 5–12 giây (thở nhẹ, vẫy đuôi, chớp mắt, đôi khi nổi vài trái tim ♥) rồi đi dạo sang chỗ khác.
//  Nhẹ: vẽ ~30 khung/giây, tự dừng khi tab bị ẩn. Tôn trọng "giảm chuyển động" của hệ điều hành
//  (prefers-reduced-motion) → chỉ vẽ MỘT khung tĩnh, không chạy hoạt ảnh. Ẩn khi in.
//  Tương tác: BẤM vào chó → chó nhảy 2 cái, hiện bong bóng "Gâu!" + vài trái tim (nghe pointerdown ở cấp tài liệu, KHÔNG chặn chuột,
//  KHÔNG chặn thao tác bên dưới; bấm lên nút/liên kết/ô nhập thì chó không phản ứng; giảm chuyển động thì không phản ứng).
//  Bướm bay nhấp nhô lên-xuống, thỉnh thoảng ĐẬU lên hoa 3–6 giây (cánh khép/xoè chậm) rồi bay LÊN tiếp.
//  Ong thỉnh thoảng bay tới một bông hoa, ĐẬU 2.5–4.5 giây rồi bay tiếp; ong đang đậu không làm chó giật mình.
//  Chuồn chuồn (17/11/2026): 3 con desktop / 2 con điện thoại, bay NHANH theo đường thẳng rồi LƠ LỬNG (hover) 0.5–1.3s rồi lao tiếp; 4 cánh trong suốt
//  vỗ nhanh, thân dài nhiều màu. KHÔNG đậu hoa và KHÔNG làm chó giật mình (chỉ ong mới dọa chó). Chung nút vườn 'ome_garden'.
//  Bật/tắt: ☰ → ⚙ Settings → "🐶 Tắt/Bật linh vật Samoyed" (mọi vai trò); lưu localStorage 'ome_mascot' ('0' = tắt, mặc định bật).
//  Vườn (hoa + bướm + ong + chuồn chuồn) có nút RIÊNG "🌼 Tắt/Bật vườn hoa-bướm-ong" (localStorage 'ome_garden'): tắt vườn thì chỉ còn chó.
//  (Tắt chó thì cả canvas ẩn — vườn nằm chung canvas nên cũng ẩn theo.)
//  GỠ HẲN: xoá thẻ <script src="js/79-mascot-samoyed.js"> trong index.html + mục act:mascot ở js/29-sidenav.js
//  + mục it('mascot') / điều kiện k === 'mascot' ở js/37-fn-configpage.js + file này.
// ════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  if (window.__mascotLoaded) return; window.__mascotLoaded = true;

  var KEY = 'ome_mascot';
  var GKEY = 'ome_garden';   // nút bật/tắt RIÊNG cho vườn (hoa + bướm + ong); '0' = tắt, mặc định bật. Tắt vườn thì ong cũng không làm chó giật mình.
  var CH = 136;           // chiều cao canvas (px CSS) — 112 + 24: chừa chỗ cho bong bóng "Gâu!" khi chó nhảy (trước đây bong bóng bị cắt mép trên)
  var SPEED = 34;         // tốc độ đi dạo (px/giây)
  var RUN = 96;           // tốc độ chạy trốn ong (px/giây)
  var canvas = null, ctx = null, raf = 0, last = 0, W = 0, dpr = 1, rzTimer = 0, clock = 0;
  var dog = { x: 70, facing: 1, mode: 'idle', until: 6, target: 70, nextIdle: 8, walking: false, run: false, react: null };
  var hearts = [], flowers = [], butterflies = [], bees = [], dragonflies = [], fleeCool = 4;
  var INTERACTIVE = 'button,a,input,textarea,select,label,summary,[onclick],[role="button"],[contenteditable="true"]';
  var BARKS = ['Gâu!', 'Gâu gâu!', 'Hihi ♥', 'Gâu~'];
  var FCOL = ['#FF6B8A', '#FF4466', '#FFD700', '#FF69B4', '#FF8C42', '#DA70D6', '#FF6347', '#E040FB', '#FFAB40'];
  // Bướm nhiều màu: mỗi con = [cánh trên, cánh dưới, chấm/viền hoa văn]; con thứ i dùng bộ i % 10 (4 con desktop luôn khác nhau).
  var BPAL = [['#FF7043', '#FFCA28', '#FFF8E1'], ['#E040FB', '#7C4DFF', '#F3E5F5'], ['#29B6F6', '#3949AB', '#E1F5FE'], ['#FFD600', '#FF6D00', '#FFFDE7'],
              ['#66BB6A', '#00ACC1', '#E8F5E9'], ['#EC407A', '#FF8A80', '#FCE4EC'], ['#26C6DA', '#AB47BC', '#E0F7FA'], ['#EF5350', '#FFB74D', '#FFEBEE'],
              ['#5C6BC0', '#26A69A', '#E8EAF6'], ['#FFA726', '#D81B60', '#FFF3E0']];
  // Chuồn chuồn: mỗi con = [màu thân, màu đốt/mắt đậm]; con thứ i dùng bộ i % 5.
  var DPAL = [['#E53935', '#7F1D1D'], ['#1E88E5', '#0D3B7A'], ['#00ACC1', '#00505A'], ['#43A047', '#1B5E20'], ['#FB8C00', '#8A3B00']];
  var BCOL = BPAL.map(function(p){ return p[0]; });   // giữ BCOL: màu cánh trên (tương thích b.color)

  function isOn(){ try { return localStorage.getItem(KEY) !== '0'; } catch(e){ return true; } }
  function gardenOn(){ try { return localStorage.getItem(GKEY) !== '0'; } catch(e){ return true; } }
  function reduced(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ return false; } }
  function rnd(a, b){ return a + Math.random() * (b - a); }

  // Hàm THUẦN (có test): chọn điểm đến kế tiếp + thời gian ngồi nghỉ sau khi tới nơi. r = hàm trả số ngẫu nhiên 0..1.
  // Luôn trả điểm đến nằm trong [44, w-140] (chừa chỗ bên phải cho bong bóng chat), chạm mép thì quay chiều ngược lại.
  function mascotPlan_(w, x, r){
    var lo = 44, hi = Math.max(lo + 40, w - 140);
    var dir = r() < 0.5 ? -1 : 1, dist = 110 + r() * 270;
    var tx = x + dir * dist;
    if (tx < lo || tx > hi) tx = x - dir * dist;
    tx = Math.max(lo, Math.min(hi, tx));
    return { target: tx, idle: 5 + r() * 7 };
  }

  // Hàm THUẦN (có test): điểm chạy trốn khi ong (ở bx) bay sát chó (ở x) — chạy ngược hướng ong 150–260px, luôn trong [44, w-140].
  function mascotFlee_(w, x, bx, r){
    var lo = 44, hi = Math.max(lo + 40, w - 140);
    var dir = x >= bx ? 1 : -1, dist = 150 + r() * 110;
    var tx = x + dir * dist;
    if (tx < lo || tx > hi) tx = x - dir * dist;
    return Math.max(lo, Math.min(hi, tx));
  }

  // Hàm THUẦN (có test): điểm bấm (px,py — toạ độ cửa sổ) có trúng thân chó không. rect = vị trí canvas trên màn hình, sc = tỉ lệ chó.
  function hitDog_(px, py, rect, d, sc){
    var cx = rect.left + d.x, cy = rect.top + (CH - 30);
    return Math.abs(px - cx) <= 26 * sc && py >= cy - 44 * sc && py <= cy + 30 * sc;
  }
  function flowerHead_(f, t){ return { x: f.x + Math.sin(t * f.speed + f.phase) * 1.8, y: CH - 3 - f.stemH }; }   // đầu hoa (khớp drawFlower)

  // Đặt canvas ngay trên thanh tab dưới đáy (nếu đang hiện), không có thì sát đáy (chừa vùng an toàn của điện thoại).
  function placeBottom(){
    if (!canvas) return;
    var h = 0;
    try {
      var tab = document.getElementById('pro-tabbar');
      if (tab && window.getComputedStyle) {
        var cs = window.getComputedStyle(tab);
        if (cs.display !== 'none' && cs.position === 'fixed') h = tab.offsetHeight || 0;
      }
    } catch(e){}
    canvas.style.bottom = h ? (h + 'px') : 'env(safe-area-inset-bottom,0px)';
  }

  function ensureCanvas(){
    if (canvas) return true;
    if (!document.body) return false;
    var st = document.createElement('style');
    st.textContent = '@media print{#mascot-fx{display:none!important}}';
    document.head.appendChild(st);
    canvas = document.createElement('canvas');
    canvas.id = 'mascot-fx';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;bottom:0;width:100%;height:' + CH + 'px;pointer-events:none;z-index:249;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    return !!ctx;
  }

  function resize(){
    if (!canvas) return;
    W = window.innerWidth || document.documentElement.clientWidth || 800;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(CH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hi = Math.max(84, W - 140);
    if (dog.x > hi) dog.x = hi;
    if (dog.target > hi) dog.target = hi;
    initScene();
    placeBottom();
  }

  // ── Vườn nhỏ: hoa / bướm / ong ──
  function initScene(){
    var n = Math.max(8, Math.min(28, Math.round(W / 60)));   // hoa mọc theo bề rộng màn hình
    flowers = [];
    for (var i = 0; i < n; i++){
      flowers.push({ x: 8 + (i + rnd(0.1, 0.9)) * ((W - 16) / n), type: Math.random() < 0.22 ? 'sunflower' : 'daisy',
        size: rnd(7, 12), color: FCOL[(Math.random() * FCOL.length) | 0], phase: rnd(0, 6.283), speed: rnd(0.6, 1.6), stemH: rnd(9, 24) });
    }
    var nb = W < 600 ? 2 : 4, nz = W < 600 ? 1 : 2;
    while (butterflies.length < nb) butterflies.push({ x: rnd(0, W), y: rnd(14, CH - 44), a: rnd(0, 6.283), v: rnd(16, 28), ph: rnd(0, 6.283), size: rnd(4, 7), color: BCOL[butterflies.length % BCOL.length], pal: BPAL[butterflies.length % BPAL.length] });
    butterflies.length = nb;
    while (bees.length < nz) bees.push({ x: rnd(W * 0.4, W), y: rnd(18, CH - 40), a: rnd(0, 6.283), v: rnd(46, 70), ph: rnd(0, 6.283), size: rnd(6, 8) });
    bees.length = nz;
    var nd = W < 600 ? 2 : 3;   // chuồn chuồn: bay nhanh + lơ lửng, không đậu hoa
    while (dragonflies.length < nd) dragonflies.push({ x: rnd(0, W), y: rnd(14, CH - 44), a: rnd(0, 6.283), v: rnd(52, 84), ph: rnd(0, 6.283), size: rnd(5, 7), pal: DPAL[dragonflies.length % DPAL.length], st: 'fly', until: 0 });
    dragonflies.length = nd;
    dragonflies.forEach(function(d){ d.st = 'fly'; });
    bees.forEach(function(b){ b.st = 'fly'; });
    butterflies.forEach(function(b){ b.st = 'fly'; });   // hoa vừa được tạo lại → ong về trạng thái bay tự do
    butterflies.concat(bees, dragonflies).forEach(function(f){ if (f.x > W) f.x = rnd(0, W); });
  }

  function drawFlower(c, f, t){   // hoa lắc lư (từ _sagaDrawFlower của game): cúc trắng-màu và hướng dương
    var sway = Math.sin(t * f.speed + f.phase) * 1.8, x = f.x + sway, y = CH - 3;
    c.strokeStyle = '#3d8b40'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(f.x, y); c.quadraticCurveTo(x + sway * 0.6, y - f.stemH * 0.5, x, y - f.stemH); c.stroke();
    var cx = x, cy = y - f.stemH, r = f.size * 0.45, i, a;
    if (f.type === 'sunflower'){
      for (i = 0; i < 10; i++){ a = (i / 10) * 6.283 + t * 0.2;
        c.beginPath(); c.ellipse(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, r * 0.45, r * 0.22, a, 0, 6.283); c.fillStyle = '#FFD54F'; c.fill(); }
      c.beginPath(); c.arc(cx, cy, r * 0.55, 0, 6.283); c.fillStyle = '#6D4C41'; c.fill();
    } else {
      for (i = 0; i < 6; i++){ a = (i / 6) * 6.283 + f.phase;
        c.beginPath(); c.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.55, r * 0.28, a, 0, 6.283); c.fillStyle = f.color; c.fill(); }
      c.beginPath(); c.arc(cx, cy, r * 0.32, 0, 6.283); c.fillStyle = '#FFF8E7'; c.fill();
    }
  }

  function drawButterfly(c, b, t){   // bướm 4 cánh nhiều màu (cánh trên + cánh dưới + chấm + viền), vỗ cánh bằng scale ngang
    var pal = b.pal || [b.color, b.color, '#FFFFFF'], s = b.size * 1.15;
    var sit = b.st === 'sit';   // đậu hoa: vỗ cánh chậm (khép-xoè), thân không nhấp nhô
    var wf = Math.sin(t * (sit ? 1.7 : 8) + b.ph) * 0.6, k = Math.abs(Math.cos(wf)) * 0.85 + 0.15;   // k = độ xoè cánh 0.15..1
    c.save(); c.translate(b.x, b.y + (sit ? 0 : Math.sin(t * 3 + b.ph) * 3)); c.globalAlpha = 0.95;
    [1, -1].forEach(function(sd){
      c.save(); c.scale(sd * k, 1);
      c.beginPath(); c.ellipse(-s * 0.55, -s * 0.35, s * 0.95, s * 0.7, -0.35, 0, 6.283); c.fillStyle = pal[0]; c.fill();   // cánh trên
      c.lineWidth = 0.8; c.strokeStyle = 'rgba(60,30,60,0.55)'; c.stroke();
      c.beginPath(); c.ellipse(-s * 0.42, s * 0.42, s * 0.6, s * 0.48, 0.4, 0, 6.283); c.fillStyle = pal[1]; c.fill(); c.stroke();   // cánh dưới
      c.beginPath(); c.arc(-s * 0.7, -s * 0.4, s * 0.2, 0, 6.283); c.fillStyle = pal[2]; c.fill();   // chấm cánh trên
      c.beginPath(); c.arc(-s * 0.45, s * 0.45, s * 0.13, 0, 6.283); c.fillStyle = pal[2]; c.fill();   // chấm cánh dưới
      c.restore();
    });
    c.globalAlpha = 1; c.beginPath(); c.ellipse(0, 0, 1.3, s * 0.55, 0, 0, 6.283); c.fillStyle = '#3a2a2a'; c.fill();   // thân
    c.strokeStyle = '#3a2a2a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-0.5, -s * 0.5); c.lineTo(-s * 0.35, -s * 0.9); c.moveTo(0.5, -s * 0.5); c.lineTo(s * 0.35, -s * 0.9); c.stroke();   // 2 râu
    c.restore();
  }

  function drawBee(c, b, t){   // từ drawBee của game (đầu hướng lên -y nên xoay thêm 90° so với hướng bay)
    var s = b.size, wf = Math.sin(t * 25 + b.ph) * 0.5, i;
    c.save(); c.translate(b.x, b.y); c.rotate(b.a + Math.PI / 2);
    c.save(); c.globalAlpha = 0.92;   // cánh ong: gần đục, to hơn, có viền xanh để nhìn rõ trên nền sáng
    [[-1, -0.4 + wf, -0.2], [1, 0.4 - wf, 0.2]].forEach(function(w){
      c.save(); c.rotate(w[1]); c.beginPath(); c.ellipse(w[0] * s * 0.2, -s * 0.7, s * 0.45, s * 0.8, w[2], 0, 6.283);
      c.fillStyle = 'rgba(170,215,255,0.95)'; c.fill(); c.lineWidth = 1; c.strokeStyle = '#3F7FBF'; c.stroke(); c.restore();
    });
    c.restore();
    c.beginPath(); c.arc(0, -s * 0.4, s * 0.38, 0, 6.283); c.fillStyle = '#FFD54F'; c.fill();
    c.beginPath(); c.ellipse(0, s * 0.15, s * 0.35, s * 0.55, 0, 0, 6.283); c.fillStyle = '#FFD54F'; c.fill();
    for (i = -1; i <= 1; i++){ c.beginPath(); c.ellipse(0, s * 0.15 + i * s * 0.22, s * 0.33, s * 0.06, 0, 0, 6.283); c.fillStyle = '#333'; c.fill(); }
    c.beginPath(); c.arc(-s * 0.14, -s * 0.45, s * 0.1, 0, 6.283); c.arc(s * 0.14, -s * 0.45, s * 0.1, 0, 6.283); c.fillStyle = '#1A1008'; c.fill();
    c.beginPath(); c.moveTo(0, s * 0.7); c.lineTo(-1.5, s * 0.9); c.lineTo(1.5, s * 0.9); c.closePath(); c.fillStyle = '#333'; c.fill();   // ngòi
    c.restore();
  }

  function drawDragonfly(c, d, t){   // chuồn chuồn nhìn từ trên: thân dài nằm dọc hướng bay (+x), 2 đôi cánh trong suốt vỗ nhanh sang hai bên
    var s = d.size, pal = d.pal || DPAL[0], hov = d.st === 'hover';
    var fl = 0.62 + 0.38 * Math.abs(Math.sin(t * (hov ? 38 : 30) + d.ph));   // độ xoè cánh 0.62..1 (vỗ rất nhanh)
    var bob = hov ? Math.sin(t * 5 + d.ph) * 1.2 : 0, i;
    c.save(); c.translate(d.x, d.y + bob); c.rotate(d.a);
    c.globalAlpha = 0.9;
    [[s * 0.55, -0.25], [s * 0.05, 0.25]].forEach(function(w){   // [vị trí dọc thân, độ xiên]: cánh trước xiên ra trước, cánh sau xiên ra sau
      [1, -1].forEach(function(sd){
        c.save(); c.translate(w[0], sd * s * 0.2); c.rotate(sd * (Math.PI / 2 + w[1]));
        c.beginPath(); c.ellipse(0, -s * 0.9 * fl, s * 0.28, s * 1.05 * fl, 0, 0, 6.283);
        c.fillStyle = 'rgba(190,230,255,0.62)'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#3F7FBF'; c.stroke();
        c.beginPath(); c.moveTo(0, -s * 0.1); c.lineTo(0, -s * 1.9 * fl); c.lineWidth = 0.5; c.stroke();   // gân giữa cánh
        c.restore();
      });
    });
    c.globalAlpha = 1;
    c.beginPath(); c.moveTo(s * 0.3, 0); c.lineTo(-s * 2.1, 0); c.lineWidth = Math.max(1.6, s * 0.3); c.lineCap = 'round'; c.strokeStyle = pal[0]; c.stroke();   // bụng dài
    for (i = 0; i < 4; i++){ c.beginPath(); c.moveTo(-s * (0.5 + i * 0.4), -s * 0.15); c.lineTo(-s * (0.5 + i * 0.4), s * 0.15); c.lineWidth = 0.9; c.strokeStyle = pal[1]; c.stroke(); }   // đốt bụng
    c.beginPath(); c.arc(s * 0.5, 0, s * 0.3, 0, 6.283); c.fillStyle = pal[0]; c.fill();   // ngực
    c.beginPath(); c.arc(s * 0.95, 0, s * 0.26, 0, 6.283); c.fillStyle = pal[1]; c.fill();   // đầu
    c.beginPath(); c.arc(s * 1.05, -s * 0.2, s * 0.14, 0, 6.283); c.arc(s * 1.05, s * 0.2, s * 0.14, 0, 6.283); c.fillStyle = '#111'; c.fill();   // 2 mắt to
    c.restore();
  }

  // Bay lang thang: đổi hướng nhẹ ngẫu nhiên, chạm trần/sàn thì dội lại, ra mép trái/phải thì vòng sang phía đối diện.
  function flyStep(f, dt, ymin, ymax, jitter){
    f.a += rnd(-1, 1) * jitter * dt;
    f.x += Math.cos(f.a) * f.v * dt; f.y += Math.sin(f.a) * f.v * dt;
    if (f.y < ymin){ f.y = ymin; f.a = -f.a; } else if (f.y > ymax){ f.y = ymax; f.a = -f.a; }
    if (f.x > W + 20) f.x = -20; else if (f.x < -20) f.x = W + 20;
  }
  // Bướm: bay lượn NHẤP NHÔ lên-xuống (sóng dọc + được nâng lên khi xuống thấp) → thỉnh thoảng chọn 1 bông hoa bay tới ('go')
  // → ĐẬU ('sit') 3–6s đung đưa theo hoa, cánh khép/xoè chậm → vỗ cánh bay LÊN ('rise' ~1.2s) rồi lượn tiếp.
  function butterflyStep(b, dt){
    var f = b.fi != null ? flowers[b.fi] : null, hd;
    if (b.st === 'sit' || b.st === 'go'){
      if (!f){ b.st = 'fly'; b.a = rnd(-2.4, -0.7); return; }   // hoa đã bị tạo lại (đổi cỡ màn hình)
      hd = flowerHead_(f, clock);
      if (b.st === 'sit'){
        b.x = hd.x; b.y = hd.y - 2;
        if (clock >= b.until){ b.st = 'fly'; b.a = rnd(-2.4, -0.7); b.v = rnd(16, 28); b.rise = clock + 1.2; }   // cất cánh: bay chếch LÊN
      } else {
        var dx = hd.x - b.x, dy = (hd.y - 2) - b.y, dist = Math.sqrt(dx * dx + dy * dy), step = 26 * dt;
        if (dist <= step + 1.2){ b.st = 'sit'; b.until = clock + rnd(3, 6); b.x = hd.x; b.y = hd.y - 2; }
        else { b.x += dx / dist * step; b.y += dy / dist * step + Math.sin(clock * 5 + b.ph) * 0.25; }
      }
      return;
    }
    flyStep(b, dt, 12, CH - 44, 2.5);
    b.y += Math.sin(clock * 2.1 + b.ph) * 13 * dt - 3 * dt;           // sóng dọc: lúc lên lúc xuống, hơi nghiêng lên
    if (b.rise && clock < b.rise) b.y -= 20 * dt;                      // vừa cất cánh khỏi hoa → bay vút lên nhẹ
    if (b.y > CH - 70) b.y -= (b.y - (CH - 70)) * 0.9 * dt + 4 * dt;   // xuống thấp quá thì được nâng lên
    if (b.y < 12) b.y = 12; else if (b.y > CH - 44) b.y = CH - 44;
    if (flowers.length && Math.random() < 0.16 * dt){ b.fi = (Math.random() * flowers.length) | 0; b.st = 'go'; }   // ~1 lần / 6 giây
  }
  // Ong: bay tự do → thỉnh thoảng chọn 1 bông hoa bay tới ('go') → đậu ('sit') 2.5–4.5s đung đưa theo hoa → bay tiếp.
  function beeStep(b, dt){
    var f = b.fi != null ? flowers[b.fi] : null, hd;
    if (b.st === 'sit' || b.st === 'go'){
      if (!f){ b.st = 'fly'; b.a = rnd(-3, -0.2); return; }   // hoa đã bị tạo lại (đổi cỡ màn hình)
      hd = flowerHead_(f, clock);
      if (b.st === 'sit'){
        b.x = hd.x; b.y = hd.y; b.a = Math.PI / 2;   // đầu cắm xuống nhuỵ
        if (clock >= b.until){ b.st = 'fly'; b.a = rnd(-3, -0.2); b.v = rnd(46, 70); }
      } else {
        var dx = hd.x - b.x, dy = hd.y - b.y, dist = Math.sqrt(dx * dx + dy * dy), step = 46 * dt;
        b.a = Math.atan2(dy, dx);
        if (dist <= step + 1.5){ b.st = 'sit'; b.until = clock + rnd(2.5, 4.5); b.x = hd.x; b.y = hd.y; b.a = Math.PI / 2; }
        else { b.x += dx / dist * step; b.y += dy / dist * step; }
      }
      return;
    }
    flyStep(b, dt, 16, CH - 34, 6);
    if (flowers.length && Math.random() < 0.3 * dt){ b.fi = (Math.random() * flowers.length) | 0; b.st = 'go'; }   // ~1 lần / 3.5 giây
  }

  // Chuồn chuồn: lao nhanh gần như THẲNG (đổi hướng rất nhẹ) → thỉnh thoảng LƠ LỬNG 'hover' 0.5–1.3s (đứng yên, chỉ nhấp nhô) → đổi hướng lao tiếp.
  function dragonflyStep(d, dt){
    if (d.st === 'hover'){
      if (clock >= d.until){ d.st = 'fly'; d.a += rnd(-1.2, 1.2); d.v = rnd(52, 84); }
      return;
    }
    flyStep(d, dt, 12, CH - 40, 1.6);
    if (Math.random() < 0.22 * dt){ d.st = 'hover'; d.until = clock + rnd(0.5, 1.3); }   // ~1 lần / 4.5 giây
  }

  // ── Hình con Samoyed: port từ drawDog() của game (bỏ phần hoảng sợ/ong), thêm dáng ĐI DẠO. d = {x, y, facing, walking, s} ──
  function drawSamoyed(c, t, d){
    var x = d.x, y = d.y, facing = d.facing, walking = d.walking, run = !!d.run, sc = d.s || 1;
    var bob = run ? Math.sin(t * 14) * 2.4 : walking ? Math.sin(t * 9) * 1.6 : Math.sin(t * 2.2) * 1.2;
    var blink = Math.sin(t * 0.7) > 0.93;
    var tailWag = Math.sin(t * (run ? 14 : walking ? 9 : 5)) * (run ? 0.45 : walking ? 0.35 : 0.2);
    var legAnim = run ? Math.sin(t * 15) * 8 : walking ? Math.sin(t * 9) * 6 : 0;

    c.save();
    c.translate(x, y + bob);
    c.scale(facing * sc, sc);

    var lift = d.lift || 0, ls = Math.max(0.55, 1 - lift / 60);   // nhảy cao → bóng nhỏ lại, nằm sát mặt đất
    c.beginPath(); c.ellipse(0, 24 + lift / sc, 18 * (walking ? 0.92 : 1) * ls, 5 * ls, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fill();

    // Lông: vẽ 2 lượt — lượt 1 là VIỀN nâu nhạt (hình to hơn 1.3px) để chó trắng không bị "chìm" trên nền sáng của CRM,
    // lượt 2 là lông trắng như bản gốc của game.
    function fur(ol){
      var g = ol ? 1.3 : 0, white = ol ? '#d9cdc3' : '#FFFAF5', paw = ol ? '#d9cdc3' : '#FFF0E5';
      [[-7, 16], [7, 16]].forEach(function(p, i){
        var lx = p[0], ly = p[1], legOff = i === 0 ? legAnim : -legAnim;
        c.beginPath(); c.ellipse(lx + legOff * 0.3, ly + 2, 4 + g, 5 + g, legOff * 0.03, 0, Math.PI * 2);
        c.fillStyle = white; c.fill();
        c.beginPath(); c.ellipse(lx + legOff * 0.6, ly + 7, 4.5 + g, 3 + g, legOff * 0.04, 0, Math.PI * 2);
        c.fillStyle = paw; c.fill();
        if (!ol) for (var n = -1; n <= 1; n++){
          c.beginPath(); c.arc(lx + legOff * 0.6 + n * 2.5, ly + 8.5, 1.2, 0, Math.PI * 2);
          c.fillStyle = '#F0D8C8'; c.fill();
        }
      });

      c.save(); c.translate(-13, -8); c.rotate(-0.6 + tailWag);   // đuôi xù cuộn trên lưng
      [[0, -6, 6], [-4, -10, 5], [4, -10, 5], [-2, -14, 4], [2, -14, 4], [0, -16, 3]].forEach(function(p){
        c.beginPath(); c.arc(p[0], p[1], p[2] + g, 0, Math.PI * 2); c.fillStyle = white; c.fill();
      });
      c.restore();

      [[0, 0, 14], [-7, -3, 11], [7, -3, 11], [-4, 5, 12], [4, 5, 12], [0, -7, 10], [-9, 1, 9], [9, 1, 9], [0, 8, 10]].forEach(function(p){
        c.beginPath(); c.arc(p[0], p[1], p[2] + g, 0, Math.PI * 2); c.fillStyle = white; c.fill();   // thân lông trắng xù
      });

      [[0, -18, 12], [-6, -22, 7], [6, -22, 7], [0, -25, 6], [-8, -16, 6], [8, -16, 6], [-10, -19, 5], [10, -19, 5]].forEach(function(p){
        c.beginPath(); c.arc(p[0], p[1], p[2] + g, 0, Math.PI * 2); c.fillStyle = white; c.fill();   // đầu
      });
    }
    fur(true); fur(false);

    [-1, 1].forEach(function(sd){   // 2 tai (ngoài kem, trong hồng)
      c.beginPath(); c.ellipse(10 * sd, -25, 4.5, 7, 0.25 * sd, 0, Math.PI * 2); c.fillStyle = '#F5E0D0'; c.fill();
      c.beginPath(); c.ellipse(10 * sd, -24, 3, 5, 0.25 * sd, 0, Math.PI * 2); c.fillStyle = '#FFB8B8'; c.fill();
    });

    if (!blink){
      [-4, 4].forEach(function(ex){
        c.beginPath(); c.arc(ex, -19, 3, 0, Math.PI * 2); c.fillStyle = '#1A1008'; c.fill();
        c.beginPath(); c.arc(ex + 1, -20, 1.4, 0, Math.PI * 2); c.fillStyle = '#FFF'; c.fill();
        c.beginPath(); c.arc(ex - 1, -18, 0.7, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.6)'; c.fill();
      });
    } else {
      [-4, 4].forEach(function(ex){
        c.beginPath(); c.arc(ex, -18.5, 2.5, 0.1, Math.PI - 0.1);
        c.strokeStyle = '#1A1008'; c.lineWidth = 1.5; c.lineCap = 'round'; c.stroke();
      });
    }

    c.beginPath(); c.ellipse(0, -15, 2.2, 1.8, 0, 0, Math.PI * 2); c.fillStyle = '#1A1008'; c.fill();                 // mũi
    c.beginPath(); c.ellipse(-0.5, -15.8, 0.8, 0.5, -0.3, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fill();

    c.beginPath(); c.moveTo(-1.5, -13.2); c.quadraticCurveTo(-2.5, -11, -1, -10.5);                                      // miệng cười
    c.strokeStyle = '#1A1008'; c.lineWidth = 0.8; c.lineCap = 'round'; c.stroke();
    c.beginPath(); c.moveTo(1.5, -13.2); c.quadraticCurveTo(2.5, -11, 1, -10.5); c.stroke();
    c.beginPath(); c.ellipse(0, -9.5, 1.8, 2.8, 0.05, 0, Math.PI * 2); c.fillStyle = '#FF8FA0'; c.fill();                // lưỡi

    [-8, 8].forEach(function(cx){   // má hồng
      c.beginPath(); c.ellipse(cx, -15, 3, 1.8, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(255,100,100,0.25)'; c.fill();
    });

    if (run){   // giật mình: dấu ! đỏ trên đầu
      c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,60,60,0.95)';
      c.fillText('!', 0, -35 + Math.sin(t * 6) * 2); c.fillText('!', -7, -33 + Math.sin(t * 6) * 2);
    }
    c.restore();
  }

  function drawHearts(c){
    for (var i = 0; i < hearts.length; i++){
      var h = hearts[i], a = Math.max(0, Math.min(1, h.life / 0.5));
      c.globalAlpha = a * 0.85; c.fillStyle = '#ff7aa2';
      c.font = 'bold ' + h.sz + 'px sans-serif'; c.textAlign = 'center';
      c.fillText('♥', h.x, h.y);
    }
    c.globalAlpha = 1;
  }

  function drawBark(c, x, y, txt, a){   // bong bóng thoại bo tròn có đuôi nhọn
    var w = txt.length * 7 + 16, h = 20, r = 8, l = x - w / 2, t = Math.max(2, y - h);   // kẹp đỉnh ≥ 2: không bao giờ vẽ ra ngoài mép trên canvas (bong bóng bị cắt chữ)
    c.save(); c.globalAlpha = a;
    c.beginPath();
    c.moveTo(l + r, t); c.lineTo(l + w - r, t); c.quadraticCurveTo(l + w, t, l + w, t + r);
    c.lineTo(l + w, t + h - r); c.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
    c.lineTo(x + 5, t + h); c.lineTo(x, t + h + 6); c.lineTo(x - 3, t + h);
    c.lineTo(l + r, t + h); c.quadraticCurveTo(l, t + h, l, t + h - r);
    c.lineTo(l, t + r); c.quadraticCurveTo(l, t, l + r, t); c.closePath();
    c.fillStyle = 'rgba(255,255,255,0.97)'; c.fill(); c.strokeStyle = '#d9cdc3'; c.lineWidth = 1; c.stroke();
    c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#5a4636'; c.fillText(txt, x, t + 14);
    c.restore();
  }

  function draw(){
    if (!ctx) return;
    ctx.clearRect(0, 0, W, CH);
    var i;
    var g = gardenOn();
    if (g) for (i = 0; i < flowers.length; i++) drawFlower(ctx, flowers[i], clock);
    var sc = W < 600 ? 0.82 : 1, rt = dog.react ? dog.react.t : 0;
    var lift = dog.react ? 20 * Math.abs(Math.sin(Math.PI * rt / 0.55)) : 0;   // 2 cú nhảy trong 1.1 giây
    drawSamoyed(ctx, clock, { x: dog.x, y: CH - 30 - lift, lift: lift, facing: dog.facing, walking: dog.mode === 'walk', run: dog.run, s: sc });
    drawHearts(ctx);
    if (dog.react) drawBark(ctx, dog.x, CH - 30 - lift - 52 * sc - 8, dog.react.txt, rt < 0.9 ? 1 : Math.max(0, (1.1 - rt) / 0.2));
    if (g) for (i = 0; i < butterflies.length; i++) drawButterfly(ctx, butterflies[i], clock);
    if (g) for (i = 0; i < bees.length; i++) drawBee(ctx, bees[i], clock);
    if (g) for (i = 0; i < dragonflies.length; i++) drawDragonfly(ctx, dragonflies[i], clock);
  }

  function startIdle(){
    dog.mode = 'idle'; dog.run = false; dog.until = clock + dog.nextIdle;
    if (Math.random() < 0.5){   // tới nơi thì vui vẻ nổi vài trái tim
      for (var i = 0; i < 3; i++) hearts.push({ x: dog.x + rnd(-14, 14), y: CH - 66 - rnd(0, 6), vy: rnd(14, 24), life: rnd(1.4, 2.0), sz: Math.round(rnd(9, 13)) });
    }
    placeBottom();
  }

  function update(dt){
    clock += dt;
    if (dog.mode === 'walk'){
      var dx = dog.target - dog.x, step = (dog.run ? RUN : SPEED) * dt;
      if (Math.abs(dx) <= step){ dog.x = dog.target; startIdle(); }
      else { dog.x += (dx > 0 ? 1 : -1) * step; dog.facing = dx > 0 ? 1 : -1; }
    } else if (clock >= dog.until){
      var p = mascotPlan_(W, dog.x, Math.random);
      dog.target = p.target; dog.nextIdle = p.idle; dog.mode = 'walk';
      dog.facing = p.target >= dog.x ? 1 : -1;
    }
    var k, sc = W < 600 ? 0.82 : 1;
    var garden = gardenOn();
    if (garden){
      for (k = 0; k < butterflies.length; k++) butterflyStep(butterflies[k], dt);
      for (k = 0; k < bees.length; k++) beeStep(bees[k], dt);
      for (k = 0; k < dragonflies.length; k++) dragonflyStep(dragonflies[k], dt);
    }
    if (dog.react){ dog.react.t += dt; if (dog.react.t >= 1.1) dog.react = null; }
    fleeCool -= dt;
    if (garden && dog.mode === 'idle' && fleeCool <= 0){   // ong bay sát chó → giật mình chạy trốn (như màn "chó chạy trốn ong")
      for (k = 0; k < bees.length; k++){
        if (bees[k].st !== 'sit' && Math.abs(bees[k].x - dog.x) < 58 * sc && Math.abs(bees[k].y - (CH - 46)) < 46){   // ong đang đậu hoa thì không dọa chó
          dog.target = mascotFlee_(W, dog.x, bees[k].x, Math.random); dog.nextIdle = 5 + rnd(0, 7);
          dog.mode = 'walk'; dog.run = true; dog.facing = dog.target >= dog.x ? 1 : -1; fleeCool = 9; break;
        }
      }
    }
    for (var i = hearts.length - 1; i >= 0; i--){
      var h = hearts[i]; h.life -= dt; h.y -= h.vy * dt;
      if (h.life <= 0) hearts.splice(i, 1);
    }
  }

  function loop(ts){
    if (document.hidden || !isOn() || reduced()) { raf = 0; return; }
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    if (!last || dt >= 0.033) { last = ts; update(dt); draw(); }   // ~30 khung/giây là đủ mượt cho linh vật nhỏ, đỡ tốn máy
    raf = requestAnimationFrame(loop);
  }

  function start(){
    if (!isOn() || document.hidden) return;
    if (!ensureCanvas()) return;
    canvas.style.display = '';
    if (!W) resize();
    if (reduced()) { draw(); return; }   // giảm chuyển động: chỉ 1 khung tĩnh, không chạy hoạt ảnh
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }
  function stop(clear){
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (clear && canvas) { ctx.clearRect(0, 0, W, CH); canvas.style.display = 'none'; }
  }

  window.addEventListener('resize', function(){
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function(){ if (canvas) { resize(); if (!raf) draw(); } }, 150);
  });
  // BẤM vào chó → nhảy + "Gâu!". Chỉ NGHE (không preventDefault/stopPropagation), nên không cản thao tác nào bên dưới.
  document.addEventListener('pointerdown', function(e){
    try {
      if (!canvas || canvas.style.display === 'none' || !isOn() || reduced() || document.hidden || dog.react) return;
      var t = e.target;
      if (t && t.closest && t.closest(INTERACTIVE)) return;   // bấm lên nút/liên kết/ô nhập → để yên cho thao tác thật
      if (!hitDog_(e.clientX, e.clientY, canvas.getBoundingClientRect(), dog, W < 600 ? 0.82 : 1)) return;
      dog.react = { t: 0, txt: BARKS[(Math.random() * BARKS.length) | 0] };
      if (dog.mode === 'idle') dog.until = Math.max(dog.until, clock + 2.2);   // đang ngồi thì ở lại chơi thêm, không bỏ đi giữa chừng
      for (var i = 0; i < 3; i++) hearts.push({ x: dog.x + rnd(-14, 14), y: CH - 66 - rnd(0, 6), vy: rnd(14, 24), life: rnd(1.4, 2.0), sz: Math.round(rnd(9, 13)) });
    } catch(err){}
  }, true);
  document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(false); else start(); });
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMq = function(){ if (!isOn()) return; stop(false); start(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  } catch(e){}

  // ── Công khai cho menu Settings (js/29-sidenav.js mục act:mascot, js/37-fn-configpage.js) ──
  window._mascotIsOn = isOn;
  window._mascotLabel = function(){ return isOn() ? '🐶 Tắt linh vật Samoyed' : '🐶 Bật linh vật Samoyed'; };
  window.toggleMascot = function(){
    var on = !isOn();
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
    if (on) start(); else stop(true);
    if (typeof toast === 'function') toast(on ? '🐶 Đã bật linh vật Samoyed' : 'Đã tắt linh vật Samoyed');
  };
  window._gardenIsOn = gardenOn;
  window._gardenLabel = function(){ return gardenOn() ? '🌼 Tắt vườn hoa-bướm-ong' : '🌼 Bật vườn hoa-bướm-ong'; };
  window.toggleGarden = function(){
    var on = !gardenOn();
    try { localStorage.setItem(GKEY, on ? '1' : '0'); } catch(e){}
    if (canvas && !raf && isOn()) draw();   // đang đứng yên (giảm chuyển động / tab ẩn) → vẽ lại ngay để thấy thay đổi
    if (typeof toast === 'function') toast(on ? '🌼 Đã bật vườn hoa-bướm-ong' : 'Đã tắt vườn hoa-bướm-ong');
  };
  window._mascotPlan_ = mascotPlan_;   // chỉ để test
  window._mascotFlee_ = mascotFlee_;
  window._mascotHit_ = hitDog_;
  window._mascotState_ = function(){ return { x: dog.x, mode: dog.mode, facing: dog.facing, run: dog.run, w: W, ch: CH, flowers: flowers.length, butterflies: butterflies, bees: bees, dragonflies: dragonflies, dog: dog, setFlee: function(v){ fleeCool = v; } }; };   // chỉ để test

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

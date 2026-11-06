// ════════════════════════════════════════════════════════════════════
//  66-sakura-petals.js (04/11/2026) — 🌸 Hiệu ứng CÁNH ĐÀO RƠI rất nhẹ (Duyên yêu cầu).
//  Một <canvas> cố định phủ toàn trang, KHÔNG bắt chuột (pointer-events:none), z-index 250:
//  nằm trên nội dung + header (200) nhưng DƯỚI lớp nhắc hẹn/thanh tab/dock/hộp thoại (≥300) nên không che thao tác.
//  Rất nhẹ: 8–16 cánh nhỏ (5–9px), rơi chậm 16–32px/giây, mờ 38–68%; tự dừng khi tab bị ẩn.
//  Tôn trọng "giảm chuyển động" của hệ điều hành (prefers-reduced-motion) → không chạy.
//  Bật/tắt: ☰ → ⚙ Settings → "🌸 Tắt/Bật cánh đào rơi" (mọi vai trò); lưu localStorage 'ome_sakura' ('0' = tắt, mặc định bật).
//  GỠ HẲN: xoá thẻ <script src="js/66-sakura-petals.js"> trong index.html + mục act:sakura ở js/29-sidenav.js.
// ════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  if (window.__sakuraLoaded) return; window.__sakuraLoaded = true;

  var KEY = 'ome_sakura';
  var COLORS = ['#ffc6d9', '#ffb7cf', '#ffd6e5', '#f8a9c6', '#ffe0ec'];
  var canvas = null, ctx = null, petals = [], raf = 0, last = 0, W = 0, H = 0, dpr = 1, rzTimer = 0;

  function isOn(){ try { return localStorage.getItem(KEY) !== '0'; } catch(e){ return true; } }
  function reduced(){ try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ return false; } }
  function rnd(a, b){ return a + Math.random() * (b - a); }
  function targetCount(){ return Math.max(8, Math.min(16, Math.round(W / 95))); }   // màn nhỏ 8 cánh, màn rộng tối đa 16

  function newPetal(initial){
    return {
      bx: rnd(0, W), y: initial ? rnd(-20, H) : rnd(-40, -12),
      vx: rnd(3, 9),                       // gió nhẹ thổi lệch sang phải
      vy: rnd(16, 32),                     // tốc độ rơi (px/giây) — chậm
      s: rnd(5, 9),                        // nửa chiều dài cánh (px)
      amp: rnd(14, 38), sw: rnd(0.5, 1.1), ph: rnd(0, 6.283),   // đung đưa trái-phải
      rot: rnd(0, 6.283), vr: rnd(-0.6, 0.6),                   // xoay
      fl: rnd(0, 6.283), vf: rnd(0.8, 1.8),                     // lật mặt (giả 3D)
      a: rnd(0.38, 0.68), c: COLORS[(Math.random() * COLORS.length) | 0], t: 0
    };
  }

  function ensureCanvas(){
    if (canvas) return true;
    if (!document.body) return false;
    var st = document.createElement('style');
    st.textContent = '@media print{#sakura-fx{display:none!important}}';
    document.head.appendChild(st);
    canvas = document.createElement('canvas');
    canvas.id = 'sakura-fx';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:250;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    return !!ctx;
  }

  function resize(){
    if (!canvas) return;
    W = window.innerWidth || document.documentElement.clientWidth || 800;
    H = window.innerHeight || document.documentElement.clientHeight || 600;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = targetCount();
    while (petals.length < n) petals.push(newPetal(true));
    if (petals.length > n) petals.length = n;
    petals.forEach(function(p){ if (p.bx > W + 40) p.bx = rnd(0, W); });
  }

  function drawPetal(s){   // cánh đào: thon hình giọt, đầu cánh có khía nhỏ
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.8, -s * 0.85, -s * 0.14, -s);
    ctx.lineTo(0, -s * 0.78);
    ctx.lineTo(s * 0.14, -s);
    ctx.bezierCurveTo(s * 0.8, -s * 0.85, s * 0.95, s * 0.35, 0, s * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  function frame(dt){
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < petals.length; i++){
      var p = petals[i];
      p.t += dt; p.y += p.vy * dt; p.bx += p.vx * dt; p.rot += p.vr * dt; p.fl += p.vf * dt;
      if (p.y > H + 20) { petals[i] = p = newPetal(false); }
      if (p.bx > W + 50) p.bx = -50;
      var x = p.bx + Math.sin(p.t * p.sw + p.ph) * p.amp;
      ctx.save();
      ctx.translate(x, p.y); ctx.rotate(p.rot);
      ctx.scale(Math.max(0.35, Math.abs(Math.cos(p.fl))), 1);
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
      drawPetal(p.s);
      ctx.restore();
    }
  }

  function loop(ts){
    if (document.hidden || !isOn() || reduced()) { raf = 0; return; }
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;   // chặn nhảy vọt sau khi tab bị treo
    last = ts;
    frame(dt);
    raf = requestAnimationFrame(loop);
  }

  function start(){
    if (!isOn() || reduced() || document.hidden) return;
    if (!ensureCanvas()) return;
    canvas.style.display = '';
    if (!petals.length || !W) resize();
    if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  }
  function stop(clear){
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (clear && canvas) { ctx.clearRect(0, 0, W, H); canvas.style.display = 'none'; }
  }

  window.addEventListener('resize', function(){
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function(){ if (canvas) resize(); }, 150);
  });
  document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(false); else start(); });
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMq = function(){ if (reduced()) stop(true); else start(); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  } catch(e){}

  // ── Công khai cho menu Settings (js/29-sidenav.js, mục act:sakura) ──
  window._sakuraIsOn = isOn;
  window._sakuraLabel = function(){ return isOn() ? '🌸 Tắt cánh đào rơi' : '🌸 Bật cánh đào rơi'; };
  window.toggleSakura = function(){
    var on = !isOn();
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch(e){}
    if (on) start(); else stop(true);
    if (typeof toast === 'function') toast(on ? '🌸 Đã bật cánh đào rơi' : 'Đã tắt cánh đào rơi');
  };

  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

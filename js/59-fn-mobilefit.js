// Vừa màn điện thoại (≤ 640px): đo chiều cao THẬT của thanh trên (đã xuống dòng nên > 50px) và đặt biến CSS --hdr-h cho css/15-mobile.css
// (menu kéo, lớp phủ, khung chính, khung AI dịch theo). Màn rộng: bỏ biến → dùng 50px mặc định. Hàm thuần mobileFitHeaderH_ có test: node tools/test-mobile-fit.js
var MOBILE_FIT_MAX_W = 640;
function mobileFitHeaderH_(width, headerH){
  var h = Math.round(Number(headerH));
  if (!(width > 0) || width > MOBILE_FIT_MAX_W || !(h > 0) || h > 400) return null;   // màn rộng / chưa đo được / bất thường → không đặt (dùng 50px)
  return h;
}
// Chiều cao khung .app (px) = chiều cao màn hình THẬT trừ chiều cao thật của thanh trên. Cần vì: (1) css/01-base.css đặt .app{height:calc(100vh - 50px)} — thanh trên đã xuống dòng cao hơn 50px thì khung thừa phần đáy;
// (2) app Android (android-viettat/.../CrmWeb.kt vhFixJs) ép .app{height:(innerHeight-50)px!important} vì WebView nạp trang khi chưa có kích thước làm vh kẹt = 0 (trang trắng). Đặt thẳng style INLINE !important
// (thắng mọi luật !important trong stylesheet, kể cả luật app chèn) bằng innerHeight thật nên cả hai đều đúng. Màn báo cáo độc lập (rpt-mode, thanh trên ẩn → offsetHeight 0) tự ra đủ innerHeight.
function mobileFitAppH_(width, innerH, headerH){
  var w = Number(width), ih = Math.round(Number(innerH)), hh = Math.round(Number(headerH)) || 0;
  if (!(w > 0) || w > MOBILE_FIT_MAX_W || !(ih >= 120)) return null;   // màn rộng / WebView chưa có kích thước (innerHeight 0) → không đặt
  if (hh < 0 || hh > 400) hh = 0;
  var v = ih - hh;
  return v >= 80 ? v : null;
}
function mobileFitApply(){
  var root = document.documentElement, hd = document.querySelector('header'), app = document.querySelector('.app');
  var hh = hd ? hd.offsetHeight : 0, v = mobileFitHeaderH_(window.innerWidth || 0, hh);
  if (v === null) root.style.removeProperty('--hdr-h'); else root.style.setProperty('--hdr-h', v + 'px');
  var a = mobileFitAppH_(window.innerWidth || 0, window.innerHeight || 0, hh);
  if (app) { if (a === null) app.style.removeProperty('height'); else app.style.setProperty('height', a + 'px', 'important'); }
  return v;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') (function(){
  function init(){
    mobileFitApply();
    window.addEventListener('resize', mobileFitApply); window.addEventListener('orientationchange', function(){ setTimeout(mobileFitApply, 150); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', mobileFitApply);
    [500, 1500, 4000].forEach(function(ms){ setTimeout(mobileFitApply, ms); });   // WebView báo kích thước muộn (giống vhFixJs của app)
    var hd = document.querySelector('header');
    if (hd && window.ResizeObserver) new ResizeObserver(mobileFitApply).observe(hd);   // nút/nhãn thêm vào sau đăng nhập làm thanh trên đổi cao
    else setTimeout(mobileFitApply, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { mobileFitHeaderH_: mobileFitHeaderH_, mobileFitAppH_: mobileFitAppH_, MOBILE_FIT_MAX_W: MOBILE_FIT_MAX_W };

// Vừa màn điện thoại (≤ 640px): đo chiều cao THẬT của thanh trên (đã xuống dòng nên > 50px) và đặt biến CSS --hdr-h cho css/15-mobile.css
// (menu kéo, lớp phủ, khung chính, khung AI dịch theo). Màn rộng: bỏ biến → dùng 50px mặc định. Hàm thuần mobileFitHeaderH_ có test: node tools/test-mobile-fit.js
var MOBILE_FIT_MAX_W = 640;
function mobileFitHeaderH_(width, headerH){
  var h = Math.round(Number(headerH));
  if (!(width > 0) || width > MOBILE_FIT_MAX_W || !(h > 0) || h > 400) return null;   // màn rộng / chưa đo được / bất thường → không đặt (dùng 50px)
  return h;
}
function mobileFitApply(){
  var root = document.documentElement, hd = document.querySelector('header');
  var v = mobileFitHeaderH_(window.innerWidth || 0, hd ? hd.offsetHeight : 0);
  if (v === null) root.style.removeProperty('--hdr-h'); else root.style.setProperty('--hdr-h', v + 'px');
  return v;
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') (function(){
  function init(){
    mobileFitApply();
    window.addEventListener('resize', mobileFitApply); window.addEventListener('orientationchange', function(){ setTimeout(mobileFitApply, 150); });
    var hd = document.querySelector('header');
    if (hd && window.ResizeObserver) new ResizeObserver(mobileFitApply).observe(hd);   // nút/nhãn thêm vào sau đăng nhập làm thanh trên đổi cao
    else setTimeout(mobileFitApply, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { mobileFitHeaderH_: mobileFitHeaderH_, MOBILE_FIT_MAX_W: MOBILE_FIT_MAX_W };

// ════════════════════════════════════════════════════════════════════
//  B3b — BỘ LỌC "LOẠI KHÁCH": Tất cả / Chưa mua (khách tiềm năng) / Đã mua — giống 2 tab Khách tiềm năng / Khách đã mua của CRM mẫu
//  (docs/ROADMAP-CRM-MAU.md). "Đã mua" = có ít nhất 1 đơn: đơn trong hồ sơ (c.orders) HOẶC đơn Pos (donStatsByPhone). Lọc cộng dồn với Phân loại KH,
//  tình trạng chăm sóc, Zalo, CS... trong applyFilters (js/02). Reset khi đổi nguồn dữ liệu cùng chỗ reset currentTier.
// ════════════════════════════════════════════════════════════════════
var currentBuy = 'all';
function _isBoughtCustomer(c){
  if (!c) return false;
  if (c.orders && c.orders.length) return true;
  var ps = (typeof donStatsByPhone !== 'undefined' && donStatsByPhone) ? donStatsByPhone[c.phone] : null;
  return !!(ps && ps.n > 0);
}
function _buySyncUi(){
  var g = document.getElementById('buy-filters'); if (!g) return;
  Array.prototype.forEach.call(g.querySelectorAll('button[data-buy]'), function(b){ b.classList.toggle('active', b.getAttribute('data-buy') === currentBuy); });
}
function setBuy(v){
  currentBuy = v; _buySyncUi();
  if (typeof applyFilters === 'function') applyFilters();
}
function resetBuyFilter(){ currentBuy = 'all'; _buySyncUi(); }

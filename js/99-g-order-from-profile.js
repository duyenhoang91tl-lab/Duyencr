// ════════════════════════════════════════════════════════════════════
//  HỒ SƠ KHÁCH → "+ Thêm đơn hàng" / "🛒 Tạo đơn" MỞ ĐÚNG MÀN ➕ TẠO ĐƠN (js/99-d), có sẵn SĐT + tên khách.
//  NGUYÊN NHÂN GỐC (Duyên 28/11): nút "+ Thêm đơn hàng" ở tab Lịch sử đơn của hồ sơ vẫn mở form cũ chỉ có Sản phẩm / Doanh thu gõ tay,
//  KHÔNG chọn sản phẩm từ bảng giá, không địa chỉ/ship/khuyến mãi/điểm/thẻ POS — khác hẳn đơn tạo ở màn Tạo đơn nên số liệu sai.
//  Form cũ (addManualOrder) GIỮ NGUYÊN trong DOM làm dự phòng (nếu file này/js/99-d không nạp, nút tự rơi về form cũ).
//  Nạp SAU js/99-d-crm-order.js. Gỡ = xoá file + thẻ <script> + 2 chỗ gọi (js/03, js/33) tự rơi về form cũ.
// ════════════════════════════════════════════════════════════════════
function _coOpenFromProfile(phone){
  var ph = String(phone == null ? '' : phone).replace(/\D/g, '');
  if (typeof _coNew !== 'function' || typeof switchTab !== 'function') return false;   // thiếu js/99-d → để nơi gọi dùng form cũ
  try { if (typeof closeDp === 'function') closeDp(); } catch(e){}
  var bar = document.querySelector('#data-view .tabs .tab[data-bar-id="taodon"]');
  try { if (bar) bar.click(); else switchTab('taodon', document.querySelector('.tab')); } catch(e){ console.warn('[taodon]', e); return false; }
  try {
    _coNew();                                  // đơn trống (giữ sale/CS/nguồn đã chọn lần trước)
    _co.phone = ph;
    try { var lead = (typeof careLeads !== 'undefined' && careLeads) ? careLeads[ph] : null; if (lead && lead.cs && !_co.source) _co.source = 'Chăm sóc'; } catch(e2){}
    _coRender();
    _coFillCustomer();                         // điền tên/người nhận theo SĐT (có sẵn trên máy, thiếu thì hỏi GAS)
    if (typeof _coLoyLoad === 'function') _coLoyLoad();   // điểm tích luỹ của khách
  } catch(e){ console.warn('[taodon prefill]', e); }
  return true;
}

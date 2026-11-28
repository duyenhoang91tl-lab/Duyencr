// ════════════════════════════════════════════════════════════════════════════════════════
//  CHỐT KỲ HOA HỒNG + TRỪ ĐƠN HOÀN Ở KỲ SAU (mục 7, docs/CRM-11-HANG-MUC-TRANG-THAI.md) — bước 7b: HÀM THUẦN, chưa có sheet/UI,
//  CHƯA nối vào báo cáo hoa hồng hiện có (các hàm báo cáo vẫn tính như cũ).
//  Quy tắc chốt (Duyên 2026-11-27): kỳ = THÁNG theo NGÀY LÊN ĐƠN; đầu tháng sau chốt tháng trước, thường ngày 1–5; đơn hủy/hoàn KHÔNG có hoa hồng;
//  đơn HOÀN SAU KHI ĐÃ TRẢ hoa hồng → TRỪ LẠI ở kỳ sau. Số tiền âm không mất: phần trừ không hết được CHUYỂN sang kỳ kế tiếp (carry).
//  Dữ liệu vào: lines = hoa hồng TỪNG ĐƠN của từng sale (đã chia doanh thu theo mục 10), ledger = sổ đã trả/đã trừ của các kỳ ĐÃ CHỐT.
// ════════════════════════════════════════════════════════════════════════════════════════
var COMMCLOSE_SECTION_ = 1;
var COMMCLOSE_DEFAULT_ = { closeDay: 5 };   // "thường từ 1–5": quá ngày này mà chưa chốt → báo 'overdue'
function _commPeriodOf_(ymd) { var m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(ymd || '')); return m ? m[1] + '-' + m[2] : ''; }
function _commNextPeriod_(period) {
  var m = /^(\d{4})-(\d{2})$/.exec(String(period || '')); if (!m) return '';
  var y = +m[1], mo = +m[2] + 1; if (mo > 12) { mo = 1; y++; } return y + '-' + String(mo).padStart(2, '0');
}
// Trạng thái kỳ so với hôm nay: open (tháng chưa kết thúc) · closing (đang trong cửa sổ chốt 1..closeDay của tháng sau)
// · overdue (quá cửa sổ mà CHƯA chốt) · closed (đã chốt). closedPeriods = danh sách kỳ đã chốt.
function _commPeriodState_(period, todayYmd, closedPeriods, closeDay) {
  if ((closedPeriods || []).indexOf(period) >= 0) return 'closed';
  var next = _commNextPeriod_(period), today = String(todayYmd || '').slice(0, 10), cd = Number(closeDay);
  if (!next || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return 'open';
  if (today < next + '-01') return 'open';
  return (_commPeriodOf_(today) === next && Number(today.slice(8, 10)) <= (cd >= 1 && cd <= 28 ? cd : COMMCLOSE_DEFAULT_.closeDay)) ? 'closing' : 'overdue';
}
// Quyết toán 1 kỳ CHO MỌI SALE.
//  lines:  [{orderId, sale, date:'YYYY-MM-DD' (ngày lên đơn), commission (đồng, phần của sale này), refunded:bool (trạng thái HIỆN TẠI: hủy/hoàn)}]
//  ledger: [{orderId, sale, period, type:'pay'|'claw', amount}]  — pay = đã trả (dương), claw = đã trừ lại (ÂM) ở các kỳ trước
//  carryIn: {sale: số âm} — phần trừ chưa hết từ kỳ trước (tuỳ chọn)
// Trả { period, sales: {sale: {commission, clawback, carryIn, net, payable, carryOut, payItems, clawItems}}, totals }.
//  • commission: đơn của KỲ NÀY, chưa hủy/hoàn, chưa từng trả → trả lần này (mỗi đơn chỉ trả 1 lần dù chốt lại)
//  • clawback: đơn đã TRẢ ở kỳ trước nhưng NAY đã hủy/hoàn, chưa trừ → trừ đúng số đã trả (mỗi đơn chỉ trừ 1 lần)
//  • net = commission + clawback + carryIn; payable = max(0, net); carryOut = min(0, net) (chuyển sang kỳ sau)
function _commSettle_(lines, ledger, period, carryIn) {
  var paid = {}, clawed = {}, sales = {}, byOrder = {};
  function key(o, s) { return String(o) + '|' + String(s); }
  (ledger || []).forEach(function (e) {
    if (!e || String(e.period) > String(period)) return;   // sổ của kỳ SAU kỳ đang chốt không liên quan
    var k = key(e.orderId, e.sale), same = String(e.period) === String(period);
    if (e.type === 'pay') paid[k] = same ? (paid[k] || 0) : (paid[k] || 0) + (Number(e.amount) || 0);   // đã trả TRONG kỳ này (chốt lại) → không trả lại, cũng không trừ lại
    else if (e.type === 'claw') clawed[k] = true;
  });
  function S(name) { return sales[name] || (sales[name] = { commission: 0, clawback: 0, carryIn: Math.min(0, Math.round(Number((carryIn || {})[name]) || 0)), net: 0, payable: 0, carryOut: 0, payItems: [], clawItems: [] }); }
  (lines || []).forEach(function (l) {
    if (!l) return; var k = key(l.orderId, l.sale), c = Math.round(Number(l.commission) || 0); byOrder[k] = l;
    if (_commPeriodOf_(l.date) !== period || l.refunded || c <= 0 || paid[k] !== undefined) return;
    var s = S(l.sale); s.commission += c; s.payItems.push({ orderId: l.orderId, amount: c });
  });
  Object.keys(paid).forEach(function (k) {
    var amt = Math.round(paid[k]); if (amt <= 0 || clawed[k]) return;
    var l = byOrder[k]; if (!l || !l.refunded) return;
    var s = S(l.sale); s.clawback -= amt; s.clawItems.push({ orderId: l.orderId, amount: -amt });
  });
  Object.keys(carryIn || {}).forEach(function (n) { S(n); });
  var totals = { commission: 0, clawback: 0, payable: 0, carryOut: 0 };
  Object.keys(sales).forEach(function (n) {
    var s = sales[n]; s.net = s.commission + s.clawback + s.carryIn; s.payable = Math.max(0, s.net); s.carryOut = Math.min(0, s.net);
    totals.commission += s.commission; totals.clawback += s.clawback; totals.payable += s.payable; totals.carryOut += s.carryOut;
  });
  return { period: period, sales: sales, totals: totals };
}
// Dòng sổ cần GHI khi chốt kỳ (để kỳ sau không trả/trừ trùng): pay cho từng đơn trả lần này, claw cho từng đơn trừ lần này.
function _commLedgerRows_(settle) {
  var rows = [];
  Object.keys(settle.sales).forEach(function (n) {
    var s = settle.sales[n];
    s.payItems.forEach(function (i) { rows.push({ orderId: i.orderId, sale: n, period: settle.period, type: 'pay', amount: i.amount }); });
    s.clawItems.forEach(function (i) { rows.push({ orderId: i.orderId, sale: n, period: settle.period, type: 'claw', amount: i.amount }); });
  });
  return rows;
}


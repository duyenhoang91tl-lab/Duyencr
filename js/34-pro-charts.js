/* GIAO DIỆN PRO — P3: biểu đồ + ô số cho Báo cáo (chỉ dùng khi <html class="ui-pro">).
   _srChartSvg (js/10) gọi các hàm này khi ui-pro bật; tắt ui-pro thì _srChartSvg ra đúng HTML cũ. */
var _PRO_CHART_COLORS = ['#4a2c8f','#1d4ed8','#2e8b2e','#e8731a','#d93025','#0891b2','#6b3fb5','#4caf50','#f59e42','#be185d','#3b82f6','#64748b'];
function _proNum_(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN'); }
// 3 ô số màu: Tổng số đơn | Tổng doanh thu (hoặc số lượng) | Trung bình/đơn. Dùng cùng định dạng tiền _srMoney/fmt như bản cũ.
function _proKpiStrip_(totalOrders, total, avgOrder, moneyFmt, ordersLabel){
  var money = function(v){ return moneyFmt ? _srMoney(v) : fmt(v); };
  return '<div class="pro-grid" style="margin-bottom:14px">'
    + '<div class="pro-kpi blue"><span class="k-l">'+(ordersLabel||'Tổng số đơn')+'</span><span class="k-v">'+_proNum_(totalOrders)+'</span></div>'
    + '<div class="pro-kpi green"><span class="k-l">'+(moneyFmt?'Tổng doanh thu':'Tổng số lượng')+'</span><span class="k-v" style="font-size:22px">'+money(total)+'</span></div>'
    + '<div class="pro-kpi orange"><span class="k-l">Trung bình / đơn</span><span class="k-v" style="font-size:22px">'+money(avgOrder)+'</span></div>'
    + '</div>';
}
// Báo cáo không có cột đếm đơn: 1 ô "Tổng" thay dòng chữ "Tổng: …"
function _proTotalTile_(total, moneyFmt){
  var money = moneyFmt ? _srMoney(total) : fmt(total);
  return '<div class="pro-grid" style="margin-bottom:10px;grid-template-columns:minmax(150px,260px)"><div class="pro-kpi purple"><span class="k-l">Tổng</span><span class="k-v" style="font-size:22px">'+money+'</span></div></div>';
}

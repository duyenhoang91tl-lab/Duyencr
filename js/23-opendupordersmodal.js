
var _dupOrdersGroups = [];

async function openDupOrdersModal(){
  var m = document.getElementById('dup-orders-modal');
  m.classList.add('open');
  document.getElementById('dup-orders-summary').textContent = '';
  document.getElementById('dup-orders-delete-btn').disabled = true;
  document.getElementById('dup-orders-status').textContent = 'Đang quét toàn bộ đơn hàng...';
  document.getElementById('dup-orders-table').innerHTML = '';
  if (!gsUrl) { document.getElementById('dup-orders-status').innerHTML = '<span style="color:#dc2626">Chưa kết nối Google Sheets.</span>'; return; }
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=findDuplicateOrders', {redirect:'follow'});
    var d = await r.json();
    if (!d.ok) { document.getElementById('dup-orders-status').innerHTML = '<span style="color:#dc2626">Lỗi: '+esc(d.error||'không rõ')+'</span>'; return; }
    _dupOrdersGroups = d.groups || [];
    if (!_dupOrdersGroups.length) {
      document.getElementById('dup-orders-status').textContent = '✓ Không phát hiện đơn trùng nào.';
      return;
    }
    document.getElementById('dup-orders-status').textContent = '';
    renderDupOrdersTable();
  } catch(e) {
    document.getElementById('dup-orders-status').innerHTML = '<span style="color:#dc2626">Lỗi kết nối: '+esc(e.message)+'</span>';
  }
}
function closeDupOrdersModal(){ document.getElementById('dup-orders-modal').classList.remove('open'); }

function renderDupOrdersTable(){
  var box = document.getElementById('dup-orders-table');
  var html = '<table style="width:100%;border-collapse:collapse;font-size:12px">'
    + '<tr style="text-align:left;border-bottom:1px solid #e5e7eb;color:#6b7280">'
    + '<th style="padding:6px 4px">Khách</th><th>Ngày mua</th><th>SP</th><th>Doanh thu</th><th>CS / Nguồn</th><th>Xóa?</th></tr>';
  _dupOrdersGroups.forEach(function(g, gi){
    if (!g.exact){
      html += '<tr><td colspan="6" style="padding:8px 4px 2px;color:#b45309;font-size:11px;background:#fffbeb">⚠ '+esc(g.note||'Cần kiểm tra kỹ trước khi xóa')+'</td></tr>';
    }
    var extraRowIdx = {}; g.extras.forEach(function(ex){ extraRowIdx[g.rows.indexOf(ex)] = true; });
    var hasRecommendation = g.exact || g.zeroLossPattern;
    g.rows.forEach(function(row, ri){
      var isKeepRow = hasRecommendation && !extraRowIdx[ri];
      var defaultChecked = !!extraRowIdx[ri]; // tick san dong duoc de xuat xoa (dong du thua, hoac dong doanh thu nho hon nghi loi mat so 0)
      html += '<tr style="'+(isKeepRow?'background:#f0fdf4':'border-bottom:1px solid #f3f4f6')+'">'
        + '<td style="padding:6px 4px">'+(ri===0?esc(row.name||row.phone)+' <span style="color:#9ca3af">'+esc(row.phone)+'</span>':'<span style="color:#9ca3af">↳ trùng</span>')+'</td>'
        + '<td>'+esc(fmtDupDate_(row.date))+'</td>'
        + '<td>'+esc((row.product||'')+(row.productDetail?' — '+row.productDetail:''))+'</td>'
        + '<td style="font-weight:600">'+Number(row.revenue||0).toLocaleString('vi-VN')+'đ</td>'
        + '<td style="color:#6b7280">'+esc(row.cs||'—')+' · '+esc(row.source||'—')+'</td>'
        + '<td>'+(isKeepRow ? '<span style="color:#16a34a;font-weight:600">Giữ lại</span>' : '<input type="checkbox" '+(defaultChecked?'checked':'')+' data-gi="'+gi+'" data-ri="'+ri+'" onchange="updateDupOrdersSummary()">')+'</td></tr>';
    });
  });
  html += '</table>';
  box.innerHTML = html;
  updateDupOrdersSummary();
}
function fmtDupDate_(d){ try { return (typeof fmtDate_==='function') ? fmtDate_(d) : String(d); } catch(e){ return String(d||''); } }

function updateDupOrdersSummary(){
  var boxes = document.querySelectorAll('#dup-orders-table input[type=checkbox]');
  var checked = 0; boxes.forEach(function(b){ if (b.checked) checked++; });
  document.getElementById('dup-orders-summary').textContent = checked ? checked+' đơn sẽ bị xóa' : 'Chưa chọn đơn nào để xóa';
  document.getElementById('dup-orders-delete-btn').disabled = !checked;
}

async function confirmDeleteDupOrders(){
  var boxes = document.querySelectorAll('#dup-orders-table input[type=checkbox]:checked');
  if (!boxes.length) return;
  var items = [];
  boxes.forEach(function(b){
    var g = _dupOrdersGroups[+b.getAttribute('data-gi')];
    var row = g && g.rows[+b.getAttribute('data-ri')];
    if (row) items.push({sheet: row.sheet, rowIndex: row.rowIndex});
  });
  if (!confirm('Xác nhận XÓA '+items.length+' đơn hàng trùng?\n\nThao tác này không thể hoàn tác trên Google Sheets. Hãy chắc chắn bạn đã kiểm tra đúng dòng cần xóa (nhất là các nhóm có cảnh báo doanh thu khác nhau).')) return;
  var btn = document.getElementById('dup-orders-delete-btn');
  btn.disabled = true; btn.textContent = '⏳ Đang xóa...';
  try {
    var r = await fetch(gsUrl, {method:'POST', redirect:'follow', body: JSON.stringify({action:'deleteDuplicateOrders', items: items})});
    var d = await r.json();
    if (!d.ok) { alert('Lỗi: '+(d.error||'không rõ')); return; }
    if (typeof toast==='function') toast('✓ Đã xóa '+d.deleted+' đơn trùng');
    closeDupOrdersModal();
    // Tải lại dữ liệu từ Sheets để danh sách khớp lại
    if (typeof syncFromGS==='function') syncFromGS({pullOrders:true,manual:true});
  } catch(e) {
    alert('Lỗi kết nối: '+e.message);
  } finally {
    btn.textContent = '🗑️ Xóa các đơn đã chọn'; btn.disabled = false;
  }
}

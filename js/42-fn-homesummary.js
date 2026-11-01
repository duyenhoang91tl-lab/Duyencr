// ════════════════════════════════════════════════════════════════════
//  B1 (phần còn lại) — "HOẠT ĐỘNG KINH DOANH & CHĂM SÓC" ở Tổng quan (docs/ROADMAP-CRM-MAU.md): 4 thẻ số + Phân bổ giai đoạn + Nguồn khách.
//  Dùng chung KỲ + bộ lọc của Tổng quan (ô từ/đến ngày, bấm thẻ Phòng/Team, ô tìm tên): mọi số đều tính theo _ovFilteredPeople(scope).
//   • Khách mới trong kỳ  = Σ careLeads (khách chăm sóc mới ghi vào sheet "KH Chăm sóc mới")
//   • Đơn đang xử lý      = đơn Base chưa tới "Đóng hàng" (action stageBoard) + tổng giá trị đơn
//   • Doanh thu Pos       = TỔNG của Báo cáo B (totalGiaTri/totalOrders của action salesReportB: đã áp quy tắc hoàn/hủy, ghép, 30/70) — toàn công ty khi không lọc, theo bộ lọc Phòng/Team khi có lọc. KHÔNG lấy từ số theo người của Tổng quan (c.revenue) vì có thể trống/lệch (lỗi 2026-10-16: thẻ hiện 0đ trong khi Nguồn khách hiện hàng tỷ) — KHÔNG phải doanh thu kế toán
//   • Tỷ lệ chốt         = bình quân gia quyền theo SĐT mang về (cùng cách tính ở Tổng quan)
//  Phân bổ giai đoạn: stageBoard (cần GAS có gas/23_TodayTasks.gs); Nguồn khách: salesReportB.byNguon. Cả hai tải nền, lỗi thì chỉ ẩn khối đó.
// ════════════════════════════════════════════════════════════════════
var _hs = { key:'', stages:null, nguon:null, pos:null, busy:false, err:'' };   // pos: null = đang tải, false = lỗi, {revenue,orders} = tổng của Báo cáo B
function _hsPeople(d){ var s = _ovScope(d); return { s: s, list: (typeof _ovFilteredPeople === 'function') ? _ovFilteredPeople(s) : s.people }; }
function _hsKey(d, list){ return d.from + '|' + d.to + '|' + list.map(function(p){ return p.name; }).sort().join(','); }
async function hsLoad(d, list, isAll){
  var key = _hsKey(d, list); if (_hs.busy && _hs.key === key) return;
  _hs.key = key; _hs.busy = true; _hs.stages = null; _hs.nguon = null; _hs.pos = null; _hs.err = '';
  var names = isAll ? '' : list.map(function(p){ return p.name; }).join('|');
  var sep = gsUrl.indexOf('?') < 0 ? '?' : '&';
  var jobs = [
    fetch(gsUrl + sep + 'action=stageBoard&names=' + encodeURIComponent(names), { redirect:'follow' }).then(function(r){ return r.json(); }).then(function(j){ if (_hs.key === key) _hs.stages = (j && j.stages) ? j.stages : []; }).catch(function(){ if (_hs.key === key) _hs.stages = []; }),
    fetch(gsUrl + sep + 'action=salesReportB&dateFrom=' + d.from + '&dateTo=' + d.to + (isAll ? '' : '&sale=' + encodeURIComponent(list.map(function(p){ return p.name; }).join(','))), { redirect:'follow' }).then(function(r){ return r.json(); }).then(function(j){ if (_hs.key === key) { _hs.nguon = (j && j.byNguon) ? j.byNguon : []; _hs.pos = (j && j.totalGiaTri != null) ? { revenue: Number(j.totalGiaTri) || 0, orders: Number(j.totalOrders) || 0 } : false; } }).catch(function(){ if (_hs.key === key) { _hs.nguon = []; _hs.pos = false; } })
  ];
  await Promise.all(jobs); if (_hs.key === key){ _hs.busy = false; hsRender(); }
}
function _hsBars(rows, valFn, labFn, color){
  var max = Math.max.apply(null, rows.map(valFn).concat([1]));
  return rows.map(function(r){
    return '<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12.5px"><div style="width:120px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(r.name) + '">' + esc(r.name) + '</div>' +
      '<div style="flex:1;background:var(--surface2);border-radius:4px;height:10px"><div style="height:10px;border-radius:4px;background:' + color + ';width:' + Math.max(2, Math.round(valFn(r) / max * 100)) + '%"></div></div><div style="width:92px;text-align:right;flex-shrink:0">' + labFn(r) + '</div></div>';
  }).join('');
}
function hsRender(){
  var el = document.getElementById('hs-summary'), d = (typeof _ov !== 'undefined') ? _ov.data : null; if (!el) return; if (!d){ el.innerHTML = ''; return; }
  var P = _hsPeople(d), list = P.list, c = _ovAgg(list, d.days), isAll = P.s.mode === 'all' && !_ov.dept && !_ov.team && !(_ov.q || '').trim();
  var leads = list.reduce(function(a, p){ return a + (p.careLeads || 0); }, 0);
  var open = 0, openVal = 0;
  (_hs.stages || []).forEach(function(st){ if (_ovN(st.name) !== 'dong hang'){ open += st.count; st.items.forEach(function(it){ openVal += it.value || 0; }); } });
  var card = function(icon, label, big, sub){ return '<div class="ov-card" style="min-width:150px"><div class="l">' + icon + ' ' + label + '</div><div class="n" style="margin:4px 0">' + big + '</div><div style="font-size:11.5px;color:var(--muted)">' + sub + '</div></div>'; };
  var stageHtml = '', srcHtml = '';
  if (_hs.stages && _hs.stages.length) stageHtml = '<div class="ov-card" style="flex:1;min-width:280px"><div style="font-weight:700;margin-bottom:4px">Phân bổ giai đoạn đơn <a href="#" onclick="switchTab(\'stageboard\',document.querySelector(\'[data-bar-id=stageboard]\')||document.createElement(\'div\'));return false" style="font-weight:400;font-size:12px;margin-left:6px">Mở bảng theo giai đoạn →</a></div>' +
    _hsBars(_hs.stages, function(r){ return r.count; }, function(r){ return '<b>' + r.count + '</b>' + (r.stuck ? ' <span style="color:var(--red)">· ' + r.stuck + ' kẹt</span>' : ''); }, 'var(--blue,#3b82f6)') + '</div>';
  var ng = (_hs.nguon || []).slice().sort(function(a, b){ return (b.giaTri || 0) - (a.giaTri || 0); }).slice(0, 6);
  if (ng.length) srcHtml = '<div class="ov-card" style="flex:1;min-width:280px"><div style="font-weight:700;margin-bottom:4px">Nguồn khách (đơn Pos) <a href="#" onclick="switchTab(\'salesreport\',document.querySelector(\'[data-bar-id=salesreport]\')||document.createElement(\'div\'));return false" style="font-weight:400;font-size:12px;margin-left:6px">Xem báo cáo →</a></div>' +
    _hsBars(ng, function(r){ return r.giaTri || 0; }, function(r){ return '<b>' + _ovMoney(r.giaTri) + '</b> <span style="color:var(--muted)">· ' + (r.orders || 0) + ' đơn</span>'; }, 'var(--green,#16a34a)') + '</div>';
  el.innerHTML = '<div style="font-weight:700;margin:6px 0 8px">📊 Hoạt động kinh doanh & chăm sóc <span style="font-weight:400;font-size:12px;color:var(--muted)">· ' + esc(d.from) + ' → ' + esc(d.to) + (isAll ? '' : ' · theo bộ lọc đang chọn') + '</span></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px">' +
    card('👥', 'Khách mới trong kỳ', leads, 'khách chăm sóc mới') +
    card('📦', 'Đơn đang xử lý', _hs.stages ? open : '…', _hs.stages ? _ovMoney(openVal) + ' giá trị đơn (Base)' : 'đang tải') +
    card('💰', 'Doanh thu Pos', _hs.pos ? _ovMoney(_hs.pos.revenue) : (_hs.pos === false ? '—' : '…'), _hs.pos ? _hs.pos.orders + ' đơn · ' + (isAll ? 'toàn công ty' : 'theo bộ lọc') + ' · không phải doanh thu kế toán' : (_hs.pos === false ? 'không tải được Báo cáo B' : 'đang tải')) +
    card('🎯', 'Tỷ lệ chốt', c.tyLeChot === null || c.tyLeChot === undefined ? '—' : c.tyLeChot + '%', 'bình quân theo SĐT mang về') + '</div>' +
    ((stageHtml || srcHtml) ? '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">' + stageHtml + srcHtml + '</div>' : (_hs.busy ? '<div style="color:var(--muted);font-size:12px;margin-bottom:10px">⏳ Đang tải phân bổ giai đoạn và nguồn khách…</div>' : ''));
  var key = _hsKey(d, list);
  if (_hs.key !== key && typeof gsUrl !== 'undefined' && gsUrl) hsLoad(d, list, isAll);
}

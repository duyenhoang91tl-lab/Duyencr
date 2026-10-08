
function openBcStatModal(){
  document.getElementById('bcstat-modal').classList.add('open');
  if (!broadcastHistory.length) { pullBroadcastHistory().then(renderBcStat); }
  renderBcStat();
}

function _bcstatCsBreakdown(b){
  var byCS = {};
  Object.keys(b.sent || {}).forEach(function(ph){
    var rec = b.sent[ph];
    if (!rec || (rec.status || 'sent') !== 'sent') return;
    var cs = (careData[ph] && careData[ph].cs) || '(chưa gán)';
    byCS[cs] = (byCS[cs] || 0) + 1;
  });
  return byCS;
}

// Ngày (ms) của 1 đơn hàng — ưu tiên Date thật, rồi orderDate/date dạng chuỗi, cuối cùng fallback
// năm/tháng. Dùng để xét "có đơn MỚI sau khi gửi broadcast không". Đây chỉ là trùng khớp thời gian
// (KHÔNG khẳng định đơn đó chắc chắn đến từ chiến dịch) nên chỉ là chỉ số tham khảo.
function _bcOrderDateMs(o){
  if (!o) return null;
  if (o.date instanceof Date && !isNaN(o.date)) return o.date.getTime();
  var pd = (typeof _parseFlexDate === 'function') ? _parseFlexDate(o.orderDate || o.date) : null;
  if (pd && !isNaN(pd)) return pd.getTime();
  if (o.year && o.month) return new Date(o.year < 100 ? 2000 + o.year : o.year, o.month - 1, 1).getTime();
  return null;
}

// Tính đủ các chỉ số cho 1 chiến dịch: gửi thành công / lỗi / chờ gửi + số KH có đơn MỚI trong
// 14 ngày sau khi nhận tin. custByPhone là Map(phone -> khách) dùng chung cho cả modal để không
// phải quét lại allCustomers cho từng chiến dịch.
function _bcComputeStats(b, custByPhone){
  var total = (b.phones || []).length;
  var sentOk = 0, failed = 0, sentPhones = [];
  Object.keys(b.sent || {}).forEach(function(ph){
    var r = b.sent[ph];
    var st = r ? String(r.status || 'sent') : '';
    if (st === 'sent') {
      sentOk++;
      sentPhones.push({ phone: ph, ts: r.ts ? new Date(r.ts).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0) });
    } else if (st.indexOf('failed') === 0) {
      failed++;
    }
  });
  var pending = Math.max(0, total - sentOk - failed);
  var converted = 0;
  sentPhones.forEach(function(sp){
    var c = custByPhone.get(sp.phone);
    if (!c || !c.orders || !c.orders.length) return;
    var hit = c.orders.some(function(o){
      var ms = _bcOrderDateMs(o);
      if (ms == null) return false;
      var days = (ms - sp.ts) / 86400000;
      return days >= 0 && days <= 14;
    });
    if (hit) converted++;
  });
  return {
    total: total, sentOk: sentOk, failed: failed, pending: pending, converted: converted,
    pctSent: total ? Math.round(sentOk / total * 100) : 0,
    pctFail: total ? Math.round(failed / total * 100) : 0,
    pctConv: sentOk ? Math.round(converted / sentOk * 100) : 0
  };
}

function _bcKpi(val, label, color){
  return '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px">'+
    '<div style="font-size:15px;font-weight:800;color:'+color+';line-height:1.2">'+val+'</div>'+
    '<div style="font-size:10px;color:#6b7280;margin-top:2px">'+label+'</div></div>';
}

async function bcstatToggle(id, toStatus){
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl, {method:'POST', redirect:'follow', body: JSON.stringify({action:'broadcastSetStatus', id: id, status: toStatus})});
    var d = await r.json();
    if (d.ok){
      var b = broadcastHistory.find(function(x){ return x.id === id; });
      if (b) b.status = d.status;
      renderBcStat();
      toast(toStatus === 'active' ? '✓ Đã kích hoạt chiến dịch' : '✓ Đã tắt chiến dịch');
    } else toast('Lỗi: ' + (d.error || 'không rõ'));
  } catch(e){ toast('Lỗi kết nối: ' + e.message); }
}

function renderBcStat(){
  var box = document.getElementById('bcstat-table');
  var sumBox = document.getElementById('bcstat-summary');
  if (!box) return;
  var q = (document.getElementById('bcstat-search').value || '').toLowerCase();
  var stF = document.getElementById('bcstat-status').value;
  var sortEl = document.getElementById('bcstat-sort');
  var sortMode = sortEl ? sortEl.value : 'newest';
  var rows = broadcastHistory.filter(function(b){
    if (q && !(b.label || b.id).toLowerCase().includes(q)) return false;
    var st = b.status || 'active';
    if (stF && st !== stF) return false;
    return true;
  });

  var custByPhone = new Map((typeof allCustomers !== 'undefined' ? allCustomers : []).map(function(c){ return [c.phone, c]; }));
  var withStats = rows.map(function(b){ return { b: b, s: _bcComputeStats(b, custByPhone) }; });

  withStats.sort(function(x, y){
    if (sortMode === 'successRate') return y.s.pctSent - x.s.pctSent;
    if (sortMode === 'failRate') return y.s.pctFail - x.s.pctFail;
    if (sortMode === 'conversion') return y.s.pctConv - x.s.pctConv;
    return String(y.b.createdAt || '').localeCompare(String(x.b.createdAt || ''));
  });

  // Tổng quan toàn bộ chiến dịch đang lọc — nhìn được bức tranh chung ngay khi mở modal.
  if (sumBox){
    if (!withStats.length){ sumBox.innerHTML = ''; }
    else {
      var agg = withStats.reduce(function(a, x){
        a.campaigns++; a.total += x.s.total; a.sentOk += x.s.sentOk; a.failed += x.s.failed;
        a.pending += x.s.pending; a.converted += x.s.converted;
        return a;
      }, { campaigns: 0, total: 0, sentOk: 0, failed: 0, pending: 0, converted: 0 });
      var aggPctFail = agg.total ? Math.round(agg.failed / agg.total * 100) : 0;
      var aggPctConv = agg.sentOk ? Math.round(agg.converted / agg.sentOk * 100) : 0;
      sumBox.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:8px;margin-bottom:12px">'+
        _bcKpi(agg.campaigns, 'Chiến dịch', '#111827')+
        _bcKpi(fmt(agg.total), 'Khách nhắm tới', '#111827')+
        _bcKpi(fmt(agg.sentOk), 'Đã gửi', '#15803d')+
        _bcKpi(fmt(agg.failed) + ' (' + aggPctFail + '%)', 'Gửi lỗi', aggPctFail > 15 ? '#dc2626' : '#b45309')+
        _bcKpi(fmt(agg.pending), 'Chưa gửi / bỏ qua', '#6b7280')+
        _bcKpi(fmt(agg.converted) + ' (' + aggPctConv + '%)', '🎯 Có đơn sau gửi', '#7c3aed')+
      '</div>';
    }
  }

  if (!withStats.length){ box.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280;font-size:12px">Không có chiến dịch nào khớp bộ lọc.</div>'; return; }

  box.innerHTML = withStats.map(function(x){
    var b = x.b, s = x.s, st = b.status || 'active';
    var byCS = _bcstatCsBreakdown(b);
    var csChips = Object.keys(byCS).sort().map(function(cs){
      return '<span style="background:#dcfce7;color:#166534;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:600;margin-right:4px">'+esc(cs)+': '+byCS[cs]+'</span>';
    }).join('') || '<span style="font-size:10px;color:#9ca3af">chưa gửi khách nào</span>';
    var stBadge = st === 'active'
      ? '<span style="background:#dcfce7;color:#15803d;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700">ĐANG KÍCH HOẠT</span>'
      : st === 'paused'
      ? '<span style="background:#fef9c3;color:#a16207;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700">ĐANG TẮT</span>'
      : '<span style="background:#f3f4f6;color:#6b7280;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700">ĐÃ HỦY</span>';
    var warnBadge = (s.total >= 10 && s.pctFail > 15)
      ? '<span style="background:#fef2f2;color:#dc2626;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700">⚠ Tỷ lệ lỗi cao</span>' : '';
    var togBtn = st === 'cancelled' ? '' :
      '<button data-id="'+esc(b.id)+'" onclick="bcstatToggle(this.dataset.id,\''+(st==='active'?'paused':'active')+'\')" style="padding:3px 10px;border:1px solid '+(st==='active'?'#d1d5db':'#00b14f')+';background:#fff;color:'+(st==='active'?'#6b7280':'#00b14f')+';border-radius:5px;cursor:pointer;font-size:11px;font-weight:600">'+(st==='active'?'⏻ Tắt':'⏻ Kích hoạt')+'</button>';
    var dateStr = b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN') : '';
    var wSent = s.total ? (s.sentOk / s.total * 100) : 0;
    var wFail = s.total ? (s.failed / s.total * 100) : 0;
    var wPend = s.total ? (s.pending / s.total * 100) : 0;
    return '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#fff">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">'+
        '<span style="font-weight:700;font-size:13px;flex:1;min-width:0">'+esc(b.label || b.id)+'</span>'+stBadge+warnBadge+togBtn+
      '</div>'+
      '<div style="font-size:11px;color:#6b7280;margin-bottom:6px">'+(dateStr?'Tạo: '+esc(dateStr)+' · ':'')+(b.csName?'CS: '+esc(b.csName)+' · ':'')+
        'Gửi <b style="color:#15803d">'+s.sentOk+'</b> · Lỗi <b style="color:#dc2626">'+s.failed+'</b> · Chờ/bỏ qua <b style="color:#6b7280">'+s.pending+'</b> / '+s.total+' khách'+
        (s.sentOk ? ' · 🎯 <b style="color:#7c3aed">'+s.converted+'</b> có đơn mới trong 14 ngày sau gửi ('+s.pctConv+'%)' : '')+
      '</div>'+
      '<div style="background:#f3f4f6;border-radius:4px;height:6px;margin-bottom:6px;overflow:hidden;display:flex">'+
        '<div style="background:#00b14f;height:100%;width:'+wSent+'%"></div>'+
        '<div style="background:#dc2626;height:100%;width:'+wFail+'%"></div>'+
        '<div style="background:#d1d5db;height:100%;width:'+wPend+'%"></div>'+
      '</div>'+
      '<div style="font-size:11px;color:#374151"><b>Đã gửi theo CS:</b><br>'+csChips+'</div>'+
    '</div>';
  }).join('');
}

function exportBcStatReport(){
  if (!broadcastHistory.length){ toast('Chưa có dữ liệu chiến dịch để xuất'); return; }
  var custByPhone = new Map((typeof allCustomers !== 'undefined' ? allCustomers : []).map(function(c){ return [c.phone, c]; }));
  var rows = [['Chiến dịch','Trạng thái','Ngày tạo','CS','Tổng khách','Đã gửi','Gửi lỗi','Chưa gửi','% Thành công','% Lỗi','Có đơn sau gửi (14 ngày)','% trên số đã gửi']];
  broadcastHistory.forEach(function(b){
    var s = _bcComputeStats(b, custByPhone);
    rows.push([
      b.label || b.id, b.status || 'active', b.createdAt ? new Date(b.createdAt).toLocaleString('vi-VN') : '',
      b.csName || '', s.total, s.sentOk, s.failed, s.pending, s.pctSent, s.pctFail, s.converted, s.pctConv
    ]);
  });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Thống kê chiến dịch');
  XLSX.writeFile(wb, 'ThongKeChienDich_' + _ymd(new Date()) + '.xlsx');
}

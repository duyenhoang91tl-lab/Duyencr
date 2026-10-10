function _pkKpiPct(v){ return (v||v===0) ? (v+'%') : '—'; }

// ═══════════════════════════════════════════════════════════════
//  BO LOC CO CAO CUA CAC BANG "Theo Page"/"Theo Sale" (tab Bao cao KPI Pancake) — dang GENERIC,
//  KHONG dung chung state/co che voi bang "Danh sach KH" chinh (colFilters/openColDropdown), vi
//  du lieu 2 ben khac hinh dang hoan toan. Chi loc tren du lieu da tai o trinh duyet, khong goi
//  lai server; icon ▼ tren tieu de cot, bam ra popup danh sach gia tri (co the tim + chon nhieu).
// ═══════════════════════════════════════════════════════════════
function _pkUniqVals(rows, getter) {
  var seen = {}, out = [];
  rows.forEach(function(r) {
    var v = getter(r); v = (v === null || v === undefined) ? '' : String(v);
    if (!seen[v]) { seen[v] = true; out.push(v); }
  });
  out.sort(function(a, b) { return a.localeCompare(b, 'vi'); });
  return out;
}

function _pkApplyColFilters(rows, tableKey, getters) {
  var filters = _pkState.kpiColFilters[tableKey] || {};
  var activeCols = Object.keys(filters).filter(function(c) { return filters[c] && filters[c].size > 0; });
  if (!activeCols.length) return rows;
  return rows.filter(function(r) {
    return activeCols.every(function(c) {
      var v = getters[c] ? getters[c](r) : '';
      v = (v === null || v === undefined) ? '' : String(v);
      return filters[c].has(v);
    });
  });
}

function _pkColTh(tableKey, colKey, label, getter, allRowsFn, extraStyle) {
  var filters = _pkState.kpiColFilters[tableKey] || (_pkState.kpiColFilters[tableKey] = {});
  var active = filters[colKey] && filters[colKey].size > 0;
  return '<th style="' + (extraStyle || '') + '" onclick="_pkOpenColFilter(\'' + tableKey + '\',\'' + colKey + '\',event)">' +
    '<span style="cursor:pointer;white-space:nowrap">' + esc(label) +
    ' <span style="font-size:9px;opacity:' + (active ? '1' : '.45') + ';color:' + (active ? 'var(--green)' : 'inherit') + '">▼</span></span></th>';
}

function _pkOpenColFilter(tableKey, colKey, ev) {
  ev.stopPropagation();
  var old = document.getElementById('pk-colfilter-pop'); if (old) old.remove();
  var rep = _pkState.kpiReport; if (!rep) return;
  var rawRows = tableKey === 'page' ? (rep.byPage || []) : (rep.bySale || []);
  var getter = _PK_COL_GETTERS[tableKey][colKey];
  var values = _pkUniqVals(rawRows, getter);
  var filters = _pkState.kpiColFilters[tableKey] || (_pkState.kpiColFilters[tableKey] = {});
  var curSet = filters[colKey] || new Set();

  var pop = document.createElement('div');
  pop.id = 'pk-colfilter-pop';
  pop.style.cssText = 'position:fixed;z-index:5000;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.2);padding:8px;width:220px;font-size:12px';
  var rect = ev.target.closest('th').getBoundingClientRect();
  var top = rect.bottom + 4, left = Math.min(rect.left, window.innerWidth - 232);
  pop.style.top = top + 'px'; pop.style.left = left + 'px';

  pop.innerHTML = '<input type="text" placeholder="Tìm..." id="pk-colfilter-search" style="width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid var(--border);border-radius:5px;margin-bottom:6px;font-size:12px">' +
    '<div id="pk-colfilter-list" style="max-height:220px;overflow-y:auto"></div>' +
    '<div style="display:flex;gap:6px;margin-top:8px">' +
    '<button onclick="_pkColFilterApply(\'' + tableKey + '\',\'' + colKey + '\')" style="flex:1;padding:5px;background:var(--green);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Áp dụng</button>' +
    '<button onclick="_pkColFilterClear(\'' + tableKey + '\',\'' + colKey + '\')" style="flex:1;padding:5px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px">Xoá lọc</button>' +
    '</div>';
  document.body.appendChild(pop);

  function renderList(filterTxt) {
    var list = document.getElementById('pk-colfilter-list'); if (!list) return;
    var ft = (filterTxt || '').toLowerCase();
    list.innerHTML = values.filter(function(v) { return !ft || v.toLowerCase().indexOf(ft) !== -1; }).map(function(v) {
      var checked = curSet.size === 0 || curSet.has(v);
      var vAttr = esc(v).replace(/"/g, '&quot;');
      return '<label style="display:flex;align-items:center;gap:6px;padding:3px 2px;cursor:pointer">' +
        '<input type="checkbox" data-pkcv="' + vAttr + '" ' + (checked ? 'checked' : '') + '>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (v || '<i style="color:var(--muted)">(trống)</i>') + '</span></label>';
    }).join('') || '<div style="color:var(--muted);padding:6px 2px">Không có giá trị khớp.</div>';
  }
  renderList('');
  document.getElementById('pk-colfilter-search').addEventListener('input', function(e) { renderList(e.target.value); });
  document.getElementById('pk-colfilter-search').focus();

  setTimeout(function() {
    document.addEventListener('click', function _pkColFilterOutside(e) {
      if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', _pkColFilterOutside); }
    });
  }, 0);
}

function _pkColFilterApply(tableKey, colKey) {
  var pop = document.getElementById('pk-colfilter-pop'); if (!pop) return;
  var checked = Array.prototype.slice.call(pop.querySelectorAll('input[data-pkcv]:checked')).map(function(el) { return el.getAttribute('data-pkcv'); });
  var allCbs = pop.querySelectorAll('input[data-pkcv]');
  // Neu tich HET (khong con gioi han gi) -> coi nhu bo loc cot nay, tranh Set rong bi hieu nham la "an tat ca".
  var filters = _pkState.kpiColFilters[tableKey];
  filters[colKey] = (checked.length === allCbs.length) ? new Set() : new Set(checked);
  pop.remove();
  _pkRenderKpiPancake();
}
function _pkColFilterClear(tableKey, colKey) {
  _pkState.kpiColFilters[tableKey][colKey] = new Set();
  var pop = document.getElementById('pk-colfilter-pop'); if (pop) pop.remove();
  _pkRenderKpiPancake();
}

function _pkQuickRange(key){
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  function mk(yy,mm,dd){ return new Date(yy,mm,dd); }
  // Thu 2 dau tuan (ISO, VN): getDay()=0 la CN -> lui 6 ngay; con lai lui (getDay()-1) ngay
  function mondayOf(dt){ var dow = dt.getDay(); var diff = (dow===0?6:dow-1); return mk(dt.getFullYear(),dt.getMonth(),dt.getDate()-diff); }
  switch(key){
    case 'today':      return { from:_ymd(now), to:_ymd(now) };
    case 'yesterday':  { var y1=mk(y,m,d-1); return { from:_ymd(y1), to:_ymd(y1) }; }
    case 'thisWeek':   { var mo=mondayOf(now); var su=mk(mo.getFullYear(),mo.getMonth(),mo.getDate()+6); return { from:_ymd(mo), to:_ymd(su) }; }
    case 'lastWeek':   { var moT=mondayOf(now); var moL=mk(moT.getFullYear(),moT.getMonth(),moT.getDate()-7); var suL=mk(moL.getFullYear(),moL.getMonth(),moL.getDate()+6); return { from:_ymd(moL), to:_ymd(suL) }; }
    case 'thisMonth':  return { from:_ymd(mk(y,m,1)), to:_ymd(mk(y,m+1,0)) };
    case 'lastMonth':  return { from:_ymd(mk(y,m-1,1)), to:_ymd(mk(y,m,0)) };
    case 'thisQuarter':{ var q=Math.floor(m/3); return { from:_ymd(mk(y,q*3,1)), to:_ymd(mk(y,q*3+3,0)) }; }
    case 'lastQuarter':{ var q2=Math.floor(m/3)-1, yy2=y; if(q2<0){q2=3;yy2=y-1;} return { from:_ymd(mk(yy2,q2*3,1)), to:_ymd(mk(yy2,q2*3+3,0)) }; }
    case 'thisYear':   return { from:_ymd(mk(y,0,1)), to:_ymd(mk(y,11,31)) };
    case 'lastYear':   return { from:_ymd(mk(y-1,0,1)), to:_ymd(mk(y-1,11,31)) };
    default: return null;
  }
}
// Sinh HTML <select> bo loc nhanh dung chung. onchangeExpr la doan JS goi ham ap dung rieng
// cua tung tab (vd "_srApplyQuickRangeA(this.value)").
function _quickRangeSelectHtml(selectedKey, onchangeExpr, extraStyle){
  var st = 'font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)'+(extraStyle||'');
  return '<select style="'+st+'" onchange="'+onchangeExpr+'">'+
    _PK_QUICK_RANGES.map(function(o){ return '<option value="'+o.v+'"'+((selectedKey||'custom')===o.v?' selected':'')+'>'+o.l+'</option>'; }).join('')+
    '</select>';
}
function _pkKpiApplyQuickFilter(key){
  _pkState.kpiQuickFilter = key;
  if (key !== 'custom'){
    var r = _pkQuickRange(key);
    if (r){ _pkState.kpiFrom = r.from; _pkState.kpiTo = r.to; }
  }
  _pkRenderKpiPancake();
  _pkLoadKpiReport();
}

function _pkRenderKpiPancake(){
  var wrap = document.getElementById('kpipancake-wrap');
  if (!wrap) return;
  var st = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  var html = '';

  html += '<div class="dash-section-title">📈 Báo cáo KPI Pancake tổng hợp</div>';

  if (_pkState.kpiSaleScope && _pkState.kpiSaleScope.length){
    html += '<div style="margin:0 0 10px;padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;color:#1e40af">'+
      '🔒 Đang giới hạn theo phạm vi của bạn ('+(currentUser.role==='leader'?'Trưởng nhóm — cả team':'Sale')+'): '+
      esc(_pkState.kpiSaleScope.join(', '))+'. Số liệu Tương tác/SĐT theo Page vẫn hiện toàn Page (không tách được theo cá nhân), chỉ riêng Đơn/Doanh thu là đã lọc đúng phạm vi.</div>';
  }

  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'+
    '<select style="'+st+'" onchange="_pkKpiApplyQuickFilter(this.value)">'+
      _PK_QUICK_RANGES.map(function(o){ return '<option value="'+o.v+'"'+((_pkState.kpiQuickFilter||'custom')===o.v?' selected':'')+'>'+o.l+'</option>'; }).join('')+
    '</select>'+
    '<input type="date" value="'+esc(_pkState.kpiFrom)+'" onchange="_pkState.kpiFrom=this.value;_pkState.kpiQuickFilter=\'custom\'" style="'+st+'">'+
    '<span>→</span>'+
    '<input type="date" value="'+esc(_pkState.kpiTo)+'" onchange="_pkState.kpiTo=this.value;_pkState.kpiQuickFilter=\'custom\'" style="'+st+'">'+
    '<button class="btn primary" onclick="_pkLoadKpiReport()">'+(_pkState.kpiReportLoading?'Đang tải...':'Xem báo cáo')+'</button>'+
    ((_pkState.kpiReport && _pkState.kpiReport.from) ? '<span style="font-size:11px;color:var(--muted)">Đang xem: '+esc(_pkState.kpiReport.from)+' → '+esc(_pkState.kpiReport.to)+'</span>' : '')+
    (_pkState.kpiReport ? '<button class="btn sm secondary" onclick="_pkExportKpiReport()">⬇ Xuất Excel</button>' : '')+
    ((_pkState.kpiReport && _pkState.kpiReport.ordersDetail && _pkState.kpiReport.ordersDetail.length) ? '<button class="btn sm secondary" onclick="_pkExportKpiOrdersDetail()" title="Liệt kê từng đơn DT TỔNG đã tính vào báo cáo này (ID, kênh, ngày tạo, sale, giá trị) — dùng để tick từng dòng đối chiếu với Report Page / file xuất của Base">⬇ Xuất chi tiết đơn (đối chiếu Base)</button>' : '')+
  '</div>';

  // ── Xuất nhật ký báo cáo hàng ngày (Sale/Kênh/MKT/Tag) ra Google Sheet riêng ──
  html += '<div style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:16px;background:var(--surface2)">'+
    '<div style="font-weight:700;font-size:13px;margin-bottom:2px">📅 Xuất nhật ký báo cáo hàng ngày</div>'+
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Xuất báo cáo Sale bán + Kênh bán (theo Base/DT TỔNG) và MKT + Tag (tổng hợp từ Pancake) ra 4 sheet cố định trong 1 Google Sheet riêng — mỗi loại 1 sheet, mỗi ngày 1 dòng. Xuất lại trùng ngày sẽ tự thay thế dòng cũ của đúng ngày đó (tối đa 31 ngày/lần).</div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<span style="font-size:11px;color:var(--muted)">Từ:</span>'+
      '<input type="date" value="'+esc(_expLogState.from)+'" onchange="_expLogState.from=this.value" style="'+st+'">'+
      '<span style="font-size:11px;color:var(--muted)">Đến:</span>'+
      '<input type="date" value="'+esc(_expLogState.to)+'" onchange="_expLogState.to=this.value" style="'+st+'">'+
      '<button class="btn primary sm" onclick="_expLogRun()">'+(_expLogState.loading?'Đang xuất...':'📤 Xuất nhật ký')+'</button>'+
    '</div>'+
    (_expLogState.result ? _expLogRenderResult() : '')+
  '</div>';

  var rep = _pkState.kpiReport;
  if (!rep){
    html += '<div style="color:var(--muted);padding:10px">'+(_pkState.kpiReportLoading?'Đang tải...':'Chọn khoảng ngày rồi bấm "Xem báo cáo".')+'</div>';
    wrap.innerHTML = html; return;
  }

  if (rep.warnings && rep.warnings.length){
    html += '<div style="margin:0 0 14px;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:12px;color:#92400e">'+
      rep.warnings.map(function(w){ return '⚠️ '+esc(w); }).join('<br>')+'</div>';
  }

  if (rep.unmappedSales && rep.unmappedSales.length){
    html += '<div style="margin:0 0 14px;padding:8px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:12px;color:#9a3412">'+
      '⚠️ '+rep.unmappedSales.length+' tên Nhân viên Pancake chưa khớp Sale CRM (nên đơn/doanh thu của họ đang tính = 0): '+
      rep.unmappedSales.map(function(n){ return esc(n); }).join(', ')+
      ' — vào tab "📥 Báo cáo Pancake" → mục "Khớp tên" để khớp.</div>';
  }

  if (rep.unmappedPages && rep.unmappedPages.length){
    html += '<div style="margin:0 0 14px;padding:8px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:12px;color:#9a3412">'+
      '⚠️ '+rep.unmappedPages.length+' Page chưa khớp Kênh bán (nên đơn/doanh thu của Page này đang tính = 0): '+
      rep.unmappedPages.map(function(p){ return esc(p.pageName||p.pageId); }).join(', ')+
      ' — vào tab "📥 Báo cáo Pancake" → mục "🔗 Khớp Page Pancake ↔ Kênh bán CRM" để khớp.</div>';
  }

  // ── Tổng quan: tách khối "Kết quả bán hàng" nổi bật (chụp gửi sếp) khỏi khối phễu tương tác ──
  var kpiTbDon = rep.totalDonHang ? Math.round(rep.totalDoanhThu/rep.totalDonHang) : 0;
  html += '<div style="font-size:13px;font-weight:700;margin:4px 0 8px">💰 Kết quả bán hàng</div>';
  html += '<div class="kpi-grid" style="margin-bottom:14px">'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_pkN(rep.totalDonHang)+'</div><div class="kpi-label"><b>Đơn hàng</b> (DT TỔNG)</div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_dfmtV(rep.totalDoanhThu)+'</div><div class="kpi-label"><b>Doanh thu</b></div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+_dfmtV(kpiTbDon)+'</div><div class="kpi-label">Trung bình đơn</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+rep.tyLeChotChung+'%</div><div class="kpi-label">Tỷ lệ chốt chung</div></div>'+
  '</div>';
  html += '<div style="font-size:13px;font-weight:700;margin:4px 0 8px">💬 Phễu tương tác Pancake</div>';
  html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">'+
    _dkpi('Tổng tương tác', _pkN(rep.totalTongTT))+
    _dkpi('SĐT thu thập', _pkN(rep.totalSdtMangVe))+
  '</div>';

  // ── Phễu tag L1-L8 toàn hệ thống ──
  if (rep.tagFunnelTotal){
    html += '<div class="dash-section-title">Phễu chuyển đổi L1 → L8 (toàn hệ thống)</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">L1=Tổng tương tác · L2=Tổng SĐT thu thập (mẫu số riêng) · L3→L6=so với bước liền trước · L7=Tổng tương tác · L8=chỉ đếm số lượng (chưa có mẫu số tỷ lệ chuẩn). Di chuột vào tên tag để xem đầy đủ tiêu chí/điều kiện đạt chuẩn.</div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Chỉ số</th>'+
      _PK_KPI_TAG_ORDER.map(function(k){ return '<th style="text-align:right;white-space:nowrap" title="'+esc(_PK_STATUS_LABEL[k]+' — '+(_PK_STATUS_DESC[k]||''))+'">'+esc(_PK_STATUS_LABEL[k]||_PK_KPI_TAG_SHORT[k])+'</th>'; }).join('')+
      '</tr></thead><tbody>'+
      '<tr><td>Số lượng</td>'+_PK_KPI_TAG_ORDER.map(function(k){ return '<td style="text-align:right">'+_pkN(rep.tagFunnelTotal.counts[k])+'</td>'; }).join('')+'</tr>'+
      '<tr><td>Tỷ lệ</td>'+_PK_KPI_TAG_ORDER.map(function(k){ return '<td style="text-align:right;font-weight:700">'+(k==='L8'?'<span style="color:var(--hint)">—</span>':_pkKpiPct(rep.tagFunnelTotal.rates[k]))+'</td>'; }).join('')+'</tr>'+
      '</tbody></table></div>';
  }

  // ── Theo Page ──
  var pageRowsF = _pkApplyColFilters(rep.byPage || [], 'page', _PK_COL_GETTERS.page);
  html += '<div class="dash-section-title" style="margin-top:18px">Theo Page</div>';
  html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr>'+
    _pkColTh('page','page','Page',_PK_COL_GETTERS.page.page)+
    _pkColTh('page','kenh','Kênh bán (CRM)',_PK_COL_GETTERS.page.kenh)+
    '<th style="text-align:right">Tương tác</th><th style="text-align:right">SĐT thu thập</th>'+
    '<th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">TB/đơn</th>'+
    '<th style="text-align:right">Tỷ lệ chốt</th>'+
    _PK_KPI_TAG_ORDER.map(function(k){ return '<th style="text-align:right">'+esc(k)+'</th>'; }).join('')+
    '</tr></thead><tbody>';
  if (!pageRowsF.length){
    html += '<tr><td colspan="15" style="text-align:center;color:var(--muted);padding:14px">'+(rep.byPage.length?'Không có dòng nào khớp bộ lọc cột đang chọn.':'Chưa có dữ liệu — nạp báo cáo tương tác/SĐT/tag ở tab "📥 Báo cáo Pancake" trước.')+'</td></tr>';
  } else {
    pageRowsF.forEach(function(p){
      html += '<tr>'+
        '<td>'+esc(p.pageName)+'</td>'+
        '<td>'+(p.mapped ? esc(p.kenhBan) : '<span style="color:#9a3412">⚠️ chưa khớp</span>')+'</td>'+
        '<td style="text-align:right">'+_pkN(p.tongTT)+'</td>'+
        '<td style="text-align:right">'+_pkN(p.sdtMangVe)+'</td>'+
        '<td style="text-align:right">'+_pkN(p.donHang)+'</td>'+
        '<td style="text-align:right">'+_dfmtV(p.doanhThu)+'</td>'+
        '<td style="text-align:right">'+(p.trungBinhDon?_dfmtV(p.trungBinhDon):'—')+'</td>'+
        '<td style="text-align:right;font-weight:700">'+p.tyLeChot+'%</td>'+
        _PK_KPI_TAG_ORDER.map(function(k){ return '<td style="text-align:right">'+_pkKpiPct(p.tag && p.tag.rates[k])+'</td>'; }).join('')+
        '</tr>';
    });
  }
  html += '</tbody></table></div>';

  // ── Theo MKT ──
  if (rep.byMkt){
    html += '<div class="dash-section-title" style="margin-top:18px">Theo MKT</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Nhóm MKT chọn ở tab Team → "Nhóm MKT". Page chạy chung nhiều MKT được chia theo tỷ lệ đã nhập; đơn/doanh thu của 1 Kênh bán chỉ tính 1 lần.</div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>MKT</th><th>Page</th>'+
      '<th style="text-align:right">Tương tác</th><th style="text-align:right">SĐT thu thập</th>'+
      '<th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">TB/đơn</th><th style="text-align:right">Tỷ lệ chốt</th>'+
      '</tr></thead><tbody>';
    if (!rep.byMkt.length) html += '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:14px">Chưa có nhóm MKT — vào tab Team → "Nhóm MKT" để tạo.</td></tr>';
    rep.byMkt.forEach(function(g){
      html += '<tr><td><b>'+esc(g.name)+'</b></td><td style="font-size:11px;color:var(--muted)">'+esc((g.pages||[]).join(', '))+'</td>'+
        '<td style="text-align:right">'+_pkN(g.tongTT)+'</td><td style="text-align:right">'+_pkN(g.sdtMangVe)+'</td>'+
        '<td style="text-align:right">'+_pkN(g.donHang)+'</td><td style="text-align:right">'+_dfmtV(g.doanhThu)+'</td>'+
        '<td style="text-align:right">'+(g.trungBinhDon?_dfmtV(g.trungBinhDon):'—')+'</td>'+
        '<td style="text-align:right;font-weight:700">'+g.tyLeChot+'%</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  // ── Theo Sale ──
  if (rep.saleGroups && rep.saleGroups.length){
    html += '<div class="dash-section-title" style="margin-top:18px">Theo nhóm Sale</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Nhóm lấy từ danh sách Sale chuẩn (sheet SaleDirectory): mã tag S… = Sale văn phòng (offline), O… = Sale online.'+
      (rep.saleDirectoryCount ? '' : ' <b style="color:#9a3412">Chưa nạp danh sách Sale nên chưa chia nhóm được.</b>')+'</div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Nhóm</th><th style="text-align:right">Số Sale</th>'+
      '<th style="text-align:right">Tương tác</th><th style="text-align:right">SĐT thu thập</th>'+
      '<th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">TB/đơn</th><th style="text-align:right">Tỷ lệ chốt</th>'+
      '</tr></thead><tbody>';
    rep.saleGroups.forEach(function(g){
      html += '<tr><td><b>'+esc(g.nhom)+'</b></td><td style="text-align:right">'+_pkN(g.soSale)+'</td>'+
        '<td style="text-align:right">'+_pkN(g.tongTT)+'</td><td style="text-align:right">'+_pkN(g.sdtMangVe)+'</td>'+
        '<td style="text-align:right">'+_pkN(g.donHang)+'</td><td style="text-align:right">'+_dfmtV(g.doanhThu)+'</td>'+
        '<td style="text-align:right">'+(g.trungBinhDon?_dfmtV(g.trungBinhDon):'—')+'</td>'+
        '<td style="text-align:right;font-weight:700">'+g.tyLeChot+'%</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  var saleRowsF = _pkApplyColFilters(rep.bySale || [], 'sale', _PK_COL_GETTERS.sale);
  html += '<div class="dash-section-title" style="margin-top:18px">Theo Sale</div>';
  html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr>'+
    _pkColTh('sale','ma','Mã',_PK_COL_GETTERS.sale.ma)+
    _pkColTh('sale','ten','Sale',_PK_COL_GETTERS.sale.ten)+
    _pkColTh('sale','nhom','Nhóm',_PK_COL_GETTERS.sale.nhom)+
    '<th style="text-align:right">Tương tác</th><th style="text-align:right">SĐT thu thập</th>'+
    '<th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">TB/đơn</th><th style="text-align:right">Tỷ lệ chốt</th>'+
    '</tr></thead><tbody>';
  if (!saleRowsF.length){
    html += '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:14px">'+(rep.bySale.length?'Không có dòng nào khớp bộ lọc cột đang chọn.':'Chưa có dữ liệu.')+'</td></tr>';
  } else {
    saleRowsF.forEach(function(s){
      html += '<tr>'+
        '<td style="color:var(--muted);font-size:11px">'+esc(s.maSale||'—')+'</td>'+
        '<td>'+esc(s.name)+(s.mapped?'':' <span style="color:#9a3412;font-size:11px">⚠️ chưa khớp tên</span>')+'</td>'+
        '<td>'+(s.nhom ? esc(s.nhom) : '<span style="color:#9a3412;font-size:11px">ngoài danh sách</span>')+'</td>'+
        '<td style="text-align:right">'+_pkN(s.tongTT)+'</td>'+
        '<td style="text-align:right">'+_pkN(s.sdtMangVe)+'</td>'+
        '<td style="text-align:right">'+_pkN(s.donHang)+'</td>'+
        '<td style="text-align:right">'+_dfmtV(s.doanhThu)+'</td>'+
        '<td style="text-align:right">'+(s.trungBinhDon?_dfmtV(s.trungBinhDon):'—')+'</td>'+
        '<td style="text-align:right;font-weight:700">'+s.tyLeChot+'%</td>'+
        '</tr>';
    });
  }
  html += '</tbody></table></div>';

  wrap.innerHTML = html;
}

function _pkExportKpiReport(){
  var rep = _pkState.kpiReport; if (!rep) return;
  var wb = XLSX.utils.book_new();
  var pgHead = ['Page','Kênh bán','Tương tác','SĐT thu thập','Đơn','Doanh thu','TB/đơn','Tỷ lệ chốt(%)'].concat(_PK_KPI_TAG_ORDER.map(function(k){ return k==='L8' ? 'L8 (SL)' : k+'(%)'; }));
  var pgRows = [pgHead].concat(rep.byPage.map(function(p){
    return [p.pageName, p.kenhBan||'', p.tongTT, p.sdtMangVe, p.donHang, p.doanhThu, p.trungBinhDon, p.tyLeChot].concat(
      _PK_KPI_TAG_ORDER.map(function(k){ return k==='L8' ? ((p.tag && p.tag.counts.L8) || 0) : ((p.tag && p.tag.rates[k]) || 0); })
    );
  }));
  var saRows = [['Sale','Tương tác','SĐT thu thập','Đơn','Doanh thu','Tỷ lệ chốt(%)']].concat(
    rep.bySale.map(function(s){ return [s.name, s.tongTT, s.sdtMangVe, s.donHang, s.doanhThu, s.tyLeChot]; })
  );
  var fnHead = ['Chỉ số'].concat(_PK_KPI_TAG_ORDER);
  var fnRows = [fnHead,
    ['Số lượng'].concat(_PK_KPI_TAG_ORDER.map(function(k){ return rep.tagFunnelTotal.counts[k]; })),
    ['Tỷ lệ (%)'].concat(_PK_KPI_TAG_ORDER.map(function(k){ return rep.tagFunnelTotal.rates[k]; }))
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pgRows), 'Theo Page');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(saRows), 'Theo Sale');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fnRows), 'Phễu L1-L7');
  XLSX.writeFile(wb, 'BaoCaoKpiPancake_'+_pkState.kpiFrom+'_'+_pkState.kpiTo+'.xlsx');
}

// Liet ke tung don DT TONG da duoc tinh vao Bao cao KPI Pancake dang xem (theo dung khoang
// ngay + moc ngay "Ngay tao" ma buildKpiReport_ dung) — de CS/Admin tick tung dong doi chieu
// truc tiep voi "Report Page" hoac file xuat cua Base, thay vi chi nhin duoc so tong.
function _pkExportKpiOrdersDetail(){
  var rep = _pkState.kpiReport; if (!rep || !rep.ordersDetail) return;
  var wb = XLSX.utils.book_new();
  var head = ['ID đơn','Ngày tạo','Kênh bán (CRM)','Sale bán','SĐT','Sản phẩm','Giá trị đơn hàng'];
  var rows = [head].concat(rep.ordersDetail.map(function(o){
    return [o.id, o.ngayTao, o.kenhBan, o.sale, o.phone, o.sanPham, o.giaTriDon];
  }));
  var ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Chi tiet don');
  XLSX.writeFile(wb, 'ChiTietDonKpiPancake_'+_pkState.kpiFrom+'_'+_pkState.kpiTo+'.xlsx');
}

function _mktLabel(code){ return _PK_STATUS_LABEL[code] || ('L' + code.substring(1) + '. (tag mới)'); }

async function renderMktChecklistTab(){
  var wrap = document.getElementById('mktchecklist-wrap');
  if (!wrap) return;
  if (!_mktState.from || !_mktState.to){
    var r = _pkQuickRange(_mktState.quick) || _pkQuickRange('thisMonth');
    _mktState.from = r.from; _mktState.to = r.to;
  }
  if (!_mktState.loaded && !_mktState.loading) await _mktLoad();
  else _mktRender();
}

async function _mktLoad(){
  var wrap = document.getElementById('mktchecklist-wrap');
  if (!gsUrl){ if (wrap) wrap.innerHTML = '<div style="padding:16px;color:var(--muted)">Chưa kết nối Google Sheets.</div>'; return; }
  _mktState.loading = true; _mktRender();
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=mktChecklist&from='+encodeURIComponent(_mktState.from)+'&to='+encodeURIComponent(_mktState.to), { redirect:'follow' });
    _mktState.report = await r.json();
    _mktState.loaded = true;
  } catch(e){ toast('❌ Tải Checklist MKT lỗi: ' + e.message); }
  finally { _mktState.loading = false; _mktRender(); }
}

function _mktApplyQuickRange(key){
  _mktState.quick = key;
  if (key !== 'custom'){ var r = _pkQuickRange(key); if (r){ _mktState.from = r.from; _mktState.to = r.to; } }
  _mktState.cfgDraft = null;
  _mktLoad();
}
function _mktSetCustomDate(which, val){
  _mktState[which] = val; _mktState.quick = 'custom'; _mktState.cfgDraft = null; _mktLoad();
}

function _mktPctColor(passed){
  if (passed === null || passed === undefined) return 'var(--text)';
  return passed ? 'var(--green)' : 'var(--red, #d33)';
}
// So ngay trong khoang [from,to] (chuoi 'yyyy-MM-dd', ca 2 dau duoc tinh) — dung cho cot/dong
// "TB/ngày" trong Checklist MKT. parseVNDate_-style: new Date('yyyy-MM-dd') la UTC-safe, khong
// bi lech mui gio nhu dinh dang 'dd/MM/yyyy'. Toi thieu 1 de khong chia cho 0.
function _mktDaysInRange_(from, to){
  var a = new Date(String(from||'')+'T00:00:00Z'), b = new Date(String(to||'')+'T00:00:00Z');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  var days = Math.round((b.getTime()-a.getTime())/86400000) + 1;
  return days > 0 ? days : 1;
}

// ── Sửa mục tiêu (%) + mẫu số — áp dụng 1 lần cho CẢ THÁNG (tháng của ngày "Đến") ──
function _mktOpenCfgEditor(){
  var rep = _mktState.report; if (!rep) return;
  var draft = {};
  rep.tags.forEach(function(t){ draft[t.code] = { target: t.target===null ? '' : Math.round(t.target*1000)/10, denom: t.denom, op: t.op||'gte' }; });
  _mktState.cfgDraft = draft;
  _mktRender();
}
function _mktCfgSetTarget(code, val){ _mktState.cfgDraft[code].target = val; }
function _mktCfgSetDenom(code, val){
  // 'multi' = mau so la TONG so luong cua nhieu tag (vd L5 + L9), luu dang 'sum:L5+L9'
  _mktState.cfgDraft[code].denom = (val === 'multi') ? 'sum:L5+L9' : val;
  _mktRender();
}
function _mktCfgToggleSum(code, tag, on){
  var d = _mktState.cfgDraft[code];
  var cur = String(d.denom).indexOf('sum:')===0 ? String(d.denom).substring(4).split('+').filter(Boolean) : [];
  var i = cur.indexOf(tag);
  if (on && i<0) cur.push(tag); if (!on && i>=0) cur.splice(i,1);
  cur.sort(function(a,b){ return parseInt(a.substring(1),10)-parseInt(b.substring(1),10); });
  d.denom = cur.length ? 'sum:'+cur.join('+') : 'none';
  // giu o che do nhieu tag ke ca khi bo tick het (hien 'none' -> ve 'chi dem so luong'); re-render de cap nhat
  _mktRender();
}
function _mktCfgSetOp(code, val){ _mktState.cfgDraft[code].op = val; }
async function _mktSaveCfg(){
  var rep = _mktState.report; if (!rep || !_mktState.cfgDraft) return;
  var month = rep.month;
  var config = {};
  Object.keys(_mktState.cfgDraft).forEach(function(code){
    var d = _mktState.cfgDraft[code];
    var t = String(d.target).trim();
    config[code] = { target: t === '' ? null : Math.max(0, Number(t)) / 100, denom: d.denom, op: d.op||'gte' };
  });
  try {
    var res = await fetch(gsUrl, { method:'POST', redirect:'follow',
      body: JSON.stringify({ action:'saveMktChecklistConfig', month: month, config: config }) });
    var d2 = await res.json();
    if (d2 && d2.ok !== false){ toast('✓ Đã lưu mục tiêu cho tháng ' + month); _mktState.cfgDraft = null; _mktLoad(); }
    else toast('❌ Lỗi lưu: ' + (d2 && d2.error || 'không rõ'));
  } catch(e){ toast('❌ Lỗi kết nối: ' + e.message); }
}

function _mktGroupMatrixHtml_(title, rep, groups, note, nameFn, hintFn){
  var h = '<div class="dash-section-title" style="margin-top:22px">'+title+'</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">'+esc(note)+'</div>';
  if (!groups.length) return h + '<div style="color:var(--muted);font-size:12px;padding:10px">Chưa có dữ liệu nhóm.</div>';
  var cols = [{ name:'Tổng', hint:'', ref: rep }].concat(groups.map(function(g){ return { name: nameFn(g), hint: hintFn(g), ref: g }; }));
  h += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Chỉ số</th>'+
    cols.map(function(c){ return '<th style="text-align:right;white-space:nowrap" title="'+esc(c.hint)+'">'+esc(c.name)+'</th>'; }).join('')+'</tr></thead><tbody>';
  var simple = [['Tổng tương tác','tongTT'],['Tương tác KH mới','khMoiTotal'],['Tương tác KH cũ','khCuTotal'],['Tổng SĐT thu thập','sdtThuThap'],['Tổng đơn (Base)','baseOrders'],['Tổng đơn (kênh FB)','donFb']];
  simple.forEach(function(r){
    h += '<tr><td>'+r[0]+'</td>'+cols.map(function(c){ return '<td style="text-align:right">'+fmt(Math.round((c.ref[r[1]]||0)*100)/100)+'</td>'; }).join('')+'</tr>';
  });
  // Doanh thu/Trung bình đơn: tiền nên hiện bằng fmtVND (dạng "245k"/"1.23 tỷ") thay vì fmt thô.
  var money = [['Tổng doanh thu','baseRevenue'],['Trung bình đơn','trungBinhDon']];
  money.forEach(function(r){
    h += '<tr><td>'+r[0]+'</td>'+cols.map(function(c){
      var v = c.ref[r[1]];
      return '<td style="text-align:right" title="'+fmt(Math.round(v||0))+'đ">'+(v===null||v===undefined?'<span style="color:var(--muted)">—</span>':fmtVND(Math.round(v)))+'</td>';
    }).join('')+'</tr>';
  });
  h += '<tr><td>Tỷ lệ chốt tổng</td>'+cols.map(function(c){ return '<td style="text-align:right;font-weight:700">'+(c.ref.tyLeChotTong||0)+'%</td>'; }).join('')+'</tr>';
  (rep.tags||[]).forEach(function(t0, i){
    h += '<tr><td><b>'+esc(t0.code)+'</b>. '+esc(_mktLabel(t0.code))+'</td>'+cols.map(function(c){
      var t = (c.ref.tags||[])[i];
      if (!t || t.count===null || t.count===undefined) return '<td style="text-align:right;color:var(--muted)">—</td>';
      return '<td style="text-align:right">'+fmt(Math.round(t.count*100)/100)+
        (t.rate!==null && t.rate!==undefined ? ' <span style="font-weight:700;color:'+_mktPctColor(t.passed)+'">('+t.rate+'%)</span>' : '')+'</td>';
    }).join('')+'</tr>';
  });
  return h + '</tbody></table></div>';
}

function _mktRender(){
  var wrap = document.getElementById('mktchecklist-wrap');
  if (!wrap) return;
  if (_mktState.loading && !_mktState.loaded){ wrap.innerHTML = '<div style="padding:16px;color:var(--muted)">Đang tải...</div>'; return; }
  var rep = _mktState.report;

  var html = '<div class="dash-section-title">✅ Checklist chất lượng tin nhắn MKT</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Tự tính từ <b>Báo cáo Pancake</b> (Tổng tương tác / SĐT thu thập / số lượng từng tag L1..Ln) và <b>Base — DT tổng</b> (L5 = tổng số đơn, tính theo ngày tạo). Chỉ cần điền <b>mục tiêu (%) và mẫu số</b> một lần — áp dụng cho cả tháng, tháng sau tự kế thừa nếu không đổi.</div>';

  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'+
    _quickRangeSelectHtml(_mktState.quick, "_mktApplyQuickRange(this.value)")+
    '<input type="date" value="'+esc(_mktState.from)+'" onchange="_mktSetCustomDate(\'from\',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<span style="font-size:11px;color:var(--muted)">→</span>'+
    '<input type="date" value="'+esc(_mktState.to)+'" onchange="_mktSetCustomDate(\'to\',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    (rep ? '<button class="btn sm secondary" onclick="_mktOpenCfgEditor()">🎯 Sửa mục tiêu & mẫu số (tháng '+esc(rep.month)+')</button>' : '')+
  '</div>';

  if (!rep){ wrap.innerHTML = html; return; }

  if (rep.warnings && rep.warnings.length){
    html += '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px">'+
      rep.warnings.map(function(w){ return '⚠️ '+esc(w); }).join('<br>')+
    '</div>';
  }

  // Khoi "Ket qua ban hang" — noi bat, xep dau tien de chup man hinh gui sep: Tong don,
  // Doanh thu, TB don, Ty le chot deu la con so lanh dao quan tam nhat, tach rieng khoi cac
  // chi so "phau" (tuong tac/SDT) o khoi thu 2 ben duoi de khong bi loang khi nhin nhanh.
  var mktDays = _mktDaysInRange_(rep.from, rep.to);
  html += '<div style="font-size:13px;font-weight:700;margin:4px 0 8px">💰 Kết quả bán hàng ('+esc(rep.from)+' → '+esc(rep.to)+', '+mktDays+' ngày)</div>';
  html += '<div class="kpi-grid" style="margin-bottom:14px">'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmt(rep.baseOrders)+'</div><div class="kpi-label"><b>Tổng đơn</b> (Base — L5)<div style="color:var(--muted);font-weight:400">TB/ngày: '+fmt(Math.round((rep.baseOrders||0)/mktDays*10)/10)+'</div></div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmtVND(Math.round(rep.baseRevenue||0))+'</div><div class="kpi-label"><b>Tổng doanh thu</b><div style="color:var(--muted);font-weight:400">TB/ngày: '+fmtVND(Math.round((rep.baseRevenue||0)/mktDays))+'</div></div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmtVND(Math.round(rep.trungBinhDon||0))+'</div><div class="kpi-label">Trung bình đơn (Doanh thu ÷ đơn)</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+rep.tyLeChotTong+'%</div><div class="kpi-label">Tỷ lệ chốt tổng (Đơn / Tổng TT)</div></div>'+
  '</div>';
  html += '<div style="font-size:13px;font-weight:700;margin:4px 0 8px">💬 Phễu tương tác Pancake</div>';
  html += '<div class="kpi-grid" style="margin-bottom:16px">'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(rep.tongTT)+'</div><div class="kpi-label">Tổng tương tác</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(rep.khMoiTotal)+'</div><div class="kpi-label">Tổng tương tác KH mới</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(rep.khCuTotal)+'</div><div class="kpi-label">Tổng tương tác KH cũ</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(rep.sdtThuThap)+'</div><div class="kpi-label">Tổng SĐT thu thập</div></div>'+
  '</div>';

  if (rep.configSource && rep.configSource !== rep.month){
    html += '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Chưa đặt mục tiêu riêng cho tháng '+esc(rep.month)+' — đang dùng lại cấu hình '+(rep.configSource==='default'?'mặc định':'của tháng '+esc(rep.configSource))+'.</div>';
  }

  // ── Form sửa mục tiêu/mẫu số (khi mở) ──
  if (_mktState.cfgDraft){
    var denomOpts = [['donFb','T\u1ed5ng \u0111\u01a1n (k\u00eanh FB)'],['multi','Nhi\u1ec1u tag (c\u1ed9ng l\u1ea1i, vd L5 + L9)\u2026'],['tt','Tổng tương tác'],['sdt','Tổng SĐT thu thập'],['ttMoi','Tổng tương tác KH mới'],['ttCu','Tổng tương tác KH cũ']]
      .concat(rep.tags.map(function(t){ return [t.code, 'Số lượng '+t.code]; }));
    var opOpts = [['gte','≥ (lớn hơn hoặc bằng)'],['lte','≤ (nhỏ hơn hoặc bằng)'],['eq','= (bằng)']];
    html += '<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:16px;background:var(--surface2)">'+
      '<div style="font-weight:700;font-size:12px;margin-bottom:8px">🎯 Mục tiêu & mẫu số — áp dụng cho tháng '+esc(rep.month)+'</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'+
        '<th style="text-align:left;padding:4px 6px">Tag</th><th style="text-align:left;padding:4px 6px">Toán tử</th><th style="text-align:right;padding:4px 6px">Mục tiêu (%)</th><th style="text-align:left;padding:4px 6px">Mẫu số</th>'+
      '</tr></thead><tbody>'+
      rep.tags.map(function(t){
        var d = _mktState.cfgDraft[t.code];
        return '<tr><td style="padding:4px 6px">'+esc(t.code)+'. '+esc(_mktLabel(t.code))+'</td>'+
          '<td style="padding:4px 6px"><select onchange="_mktCfgSetOp(\''+t.code+'\',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
            opOpts.map(function(o){ return '<option value="'+o[0]+'"'+(d.op===o[0]?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+
          '</select></td>'+
          '<td style="text-align:right;padding:4px 6px"><input type="number" min="0" max="100" step="0.1" value="'+esc(d.target)+'" placeholder="—" onchange="_mktCfgSetTarget(\''+t.code+'\',this.value)" style="width:70px;text-align:right;font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)"></td>'+
          '<td style="padding:4px 6px"><select onchange="_mktCfgSetDenom(\''+t.code+'\',this.value)" style="font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
            [['none','— chỉ đếm số lượng —']].concat(denomOpts).map(function(o){ return '<option value="'+o[0]+'"'+((d.denom===o[0] || (o[0]==='multi' && String(d.denom).indexOf('sum:')===0))?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+
          '</select></td></tr>'+
          (String(d.denom).indexOf('sum:')===0 ? (function(){
            var picked = String(d.denom).substring(4).split('+');
            return '<tr><td colspan="4" style="padding:2px 6px 8px 24px;font-size:12px;color:var(--muted)">M\u1eabu s\u1ed1 = t\u1ed5ng s\u1ed1 l\u01b0\u1ee3ng c\u00e1c tag: '+
              rep.tags.filter(function(t2){ return t2.code!==t.code; }).map(function(t2){
                return '<label style="margin-right:10px;white-space:nowrap;color:var(--text)"><input type="checkbox" '+(picked.indexOf(t2.code)!==-1?'checked ':'')+'onchange="_mktCfgToggleSum(\''+t.code+'\',\''+t2.code+'\',this.checked)"> '+esc(t2.code)+'</label>';
              }).join('')+'</td></tr>';
          })() : '');
      }).join('')+
      '</tbody></table>'+
      '<div style="margin-top:8px;display:flex;gap:8px">'+
        '<button class="btn sm primary" onclick="_mktSaveCfg()">💾 Lưu cho tháng '+esc(rep.month)+'</button>'+
        '<button class="btn sm secondary" onclick="_mktState.cfgDraft=null;_mktRender()">Hủy</button>'+
      '</div>'+
    '</div>';
  }

  // ── Bảng chỉ số L1..Ln ──
  html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr>'+
    '<th>Tag</th><th style="text-align:right">Số lượng</th><th style="text-align:right">TB/ngày</th><th>Mẫu số</th><th style="text-align:right">Giá trị mẫu số</th>'+
    '<th style="text-align:right">Tỷ lệ</th><th style="text-align:right">Mục tiêu</th><th>Trạng thái</th>'+
  '</tr></thead><tbody>';
  rep.tags.forEach(function(t){
    var statusHtml = '<span style="color:var(--muted)">—</span>';
    if (t.passed === true) statusHtml = '<span style="color:var(--green);font-weight:700">✓ Đạt</span>';
    else if (t.passed === false) statusHtml = '<span style="color:var(--red,#d33);font-weight:700">✗ Chưa đạt</span>';
    var tbNgay = (t.count===null || t.count===undefined) ? null : Math.round((t.count/mktDays)*10)/10;
    html += '<tr>'+
      '<td><b>'+esc(t.code)+'</b>. '+esc(_mktLabel(t.code))+(t.code==='L5'?' <span style="font-size:10px;color:var(--muted)">(Base)</span>':'')+'</td>'+
      '<td style="text-align:right;font-weight:700">'+fmt(t.count)+'</td>'+
      '<td style="text-align:right;color:var(--muted)">'+(tbNgay!==null?fmt(tbNgay):'—')+'</td>'+
      '<td style="color:var(--muted);font-size:11px">'+(t.denomLabel||'—')+'</td>'+
      '<td style="text-align:right">'+(t.denomValue!==null?fmt(t.denomValue):'—')+'</td>'+
      '<td style="text-align:right;font-weight:700;color:'+_mktPctColor(t.passed)+'">'+(t.rate!==null?t.rate+'%':'—')+'</td>'+
      '<td style="text-align:right;color:var(--muted)">'+(t.target!==null?(_MKT_OP_SYMBOL[t.op]||'≥')+Math.round(t.target*1000)/10+'%':'—')+'</td>'+
      '<td>'+statusHtml+'</td>'+
    '</tr>';
  });
  html += '</tbody></table></div>';
  html += '<div style="font-size:11px;color:var(--muted);margin-top:8px">Khoảng ngày: '+esc(rep.from)+' → '+esc(rep.to)+' (tính theo ngày tạo).</div>';

  if (rep.groups){
    html += _mktGroupMatrixHtml_('📣 Theo Team MKT', rep, rep.groups.mkt || [],
      'Nhóm MKT chọn ở tab Team → "Nhóm MKT". Tương tác/SĐT/tag L tính theo Page của nhóm (Page chạy chung chia theo tỷ lệ); L5 = đơn Base theo Kênh bán của các Page đó.', function(g){ return g.name; }, function(g){ return (g.pages||[]).join(', '); });
    html += _mktGroupMatrixHtml_('👥 Theo Team Sale (Văn phòng / Online)', rep, rep.groups.sale || [],
      'Pancake chỉ lưu tag L1–L9 theo Page (không theo nhân viên) nên các tag L chỉ có ở Tổng và Team MKT; Team Sale hiển thị Tổng tương tác, SĐT, L5 (đơn Base theo Sale) và tỷ lệ chốt.', function(g){ return g.nhom+' ('+g.soSale+' sale)'; }, function(g){ return g.nhom; });
  }

  wrap.innerHTML = html;
}

function _dbFmtDateVN(ymd){ var p = String(ymd||'').split('-'); return p.length===3 ? (p[2]+'/'+p[1]+'/'+p[0]) : (ymd||''); }

function _dbSetDate(key, val){
  if (key === 'today') { _dbState.date = _ymd(new Date()); }
  else if (key === 'yesterday') { var d = new Date(); d.setDate(d.getDate()-1); _dbState.date = _ymd(d); }
  else { _dbState.date = val; }
  _dbLoad();
}

// Che do xem cua tung muc trong Bao cao ngay (state rieng, KHONG dung _srState nen bam doi
// che do chi ve lai Bao cao ngay, khong keo theo Bao cao doanh so).
function _dbViewToggleHtml(key){
  var v = (_dbState.views && _dbState.views[key]) || 'both';
  function b(val, label){
    return '<button type="button" class="btn '+(v===val?'secondary':'sm')+'" style="padding:3px 9px;font-size:11px" '+
      'onclick="_dbSetView(\''+key+'\',\''+val+'\')">'+label+'</button>';
  }
  return '<div style="display:inline-flex;gap:4px;margin-left:10px;vertical-align:middle;flex-wrap:wrap">'+
    b('both','🥧 Tròn + Bảng')+b('pie','🥧 Tròn')+b('bar','📊 Cột')+b('table','📋 Bảng')+'</div>';
}
function _dbSetView(key, val){ _dbState.views[key] = val; _dbRender(); }
// Dung lai _srChartSvg (donut co TONG o giua, dung chung voi Bao cao doanh so) — khong tu ve lai.
function _dbBody(key, rows, nameKey, valueKey, moneyFmt, tableHtml){
  var v = (_dbState.views && _dbState.views[key]) || 'both';
  if (v === 'table') return tableHtml;
  if (v === 'pie' || v === 'bar') return _srChartSvg(rows, nameKey, valueKey, v, moneyFmt);
  return _srChartSvg(rows, nameKey, valueKey, 'pie', moneyFmt) + tableHtml;
}

function _dbOpenStandalone(){
  var url = location.href.split('#')[0].split('?')[0] + '?view=dailybrief';
  var w = null;
  try { w = window.open(url, '_blank'); } catch(e){}
  if (!w) location.href = url; // trinh duyet chan popup -> mo ngay trong tab hien tai
}

async function renderDailyBriefTab(){
  var wrap = document.getElementById('dailybrief-wrap');
  if (!wrap) return;
  _pkEnforceScope(); // khoa pham vi Sale giong het tab KPI Pancake (CS chi xem cua minh, Leader xem ca team)
  if (!_dbState.loaded && !_dbState.loading) await _dbLoad();
  else _dbRender();
}

async function _dbLoad(){
  var wrap = document.getElementById('dailybrief-wrap');
  if (!gsUrl){ if (wrap) wrap.innerHTML = '<div style="padding:16px;color:var(--muted)">Chưa kết nối Google Sheets.</div>'; return; }
  _dbState.loading = true; _dbRender();
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var d = _dbState.date;
    var saleQ = (_pkState.kpiSaleScope && _pkState.kpiSaleScope.length) ? '&sale='+encodeURIComponent(_pkState.kpiSaleScope.join(',')) : '';
    var results = await Promise.all([
      fetch(gsUrl + sep + 'action=kpiReport&from='+encodeURIComponent(d)+'&to='+encodeURIComponent(d)+saleQ, { redirect:'follow' }),
      fetch(gsUrl + sep + 'action=mktChecklist&from='+encodeURIComponent(d)+'&to='+encodeURIComponent(d), { redirect:'follow' })
    ]);
    _dbState.kpi = await results[0].json();
    _dbState.mkt = await results[1].json();
    _dbState.loaded = true;
  } catch(e){ toast('❌ Tải Báo cáo ngày lỗi: ' + e.message); }
  finally { _dbState.loading = false; _dbRender(); }
}

function _dbRender(){
  var wrap = document.getElementById('dailybrief-wrap');
  if (!wrap) return;
  var stI = 'font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  var isToday = _dbState.date === _ymd(new Date());
  var y = new Date(); y.setDate(y.getDate()-1);
  var isYesterday = _dbState.date === _ymd(y);
  var html = '<div class="dash-section-title">🎯 Báo cáo ngày</div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">'+
    '<button class="btn sm'+(isToday?' primary':'')+'" onclick="_dbSetDate(\'today\')">Hôm nay</button>'+
    '<button class="btn sm'+(isYesterday?' primary':'')+'" onclick="_dbSetDate(\'yesterday\')">Hôm qua</button>'+
    '<input type="date" value="'+esc(_dbState.date)+'" onchange="_dbSetDate(\'custom\',this.value)" style="'+stI+'">'+
    '<span style="font-size:12px;color:var(--muted)">Ngày '+_dbFmtDateVN(_dbState.date)+'</span>'+
    '<button class="btn sm" onclick="_dbLoad()" title="Tải lại số liệu mới nhất">🔄 Tải lại</button>'+
  '</div>';

  if (_dbState.loading && !_dbState.loaded){ wrap.innerHTML = html + '<div style="padding:16px;color:var(--muted)">Đang tải...</div>'; return; }

  var kpi = _dbState.kpi, mkt = _dbState.mkt;
  if (!kpi || !mkt || kpi.error || mkt.error){
    wrap.innerHTML = html + '<div style="padding:16px;color:var(--muted)">Chưa tải được dữ liệu — bấm lại "Hôm nay".</div>';
    return;
  }

  var warnings = [].concat(kpi.warnings||[], mkt.warnings||[]);
  if (warnings.length){
    html += '<div style="margin-bottom:14px;padding:8px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:11px;color:#9a3412">'+
      warnings.map(function(w){ return '⚠️ '+esc(w); }).join('<br>')+'</div>';
  }

  var tbDonTong = kpi.totalDonHang ? Math.round(kpi.totalDoanhThu/kpi.totalDonHang) : 0;
  html += '<div class="kpi-grid" style="margin-bottom:20px">'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmtVND(Math.round(kpi.totalDoanhThu||0))+'</div><div class="kpi-label"><b>Tổng doanh thu</b></div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmt(kpi.totalDonHang)+'</div><div class="kpi-label"><b>Tổng đơn</b></div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+(kpi.tyLeChotChung||0)+'%</div><div class="kpi-label">Tỷ lệ chốt</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmtVND(tbDonTong)+'</div><div class="kpi-label">Trung bình đơn</div></div>'+
  '</div>';

  // ── Theo doi Sale (dung lai kpi.bySale — da xep Van phong -> Online -> ngoai danh sach,
  // trong tung nhom theo Ty le chot giam dan) ──
  html += '<div class="dash-section-title">👥 Theo đội Sale'+_dbViewToggleHtml('sale')+'</div>';
  var saleRows = kpi.bySale || [];
  if (!saleRows.length){
    html += '<div style="color:var(--muted);font-size:12px;padding:8px 0 16px">Chưa có dữ liệu Sale trong ngày này.</div>';
  } else {
    var saleTable = '';
    saleTable += '<div style="overflow-x:auto;margin-bottom:20px"><table class="dash-table"><thead><tr><th>Sale</th><th>Nhóm</th><th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Tỷ lệ chốt</th><th style="text-align:right">TB đơn</th></tr></thead><tbody>';
    saleRows.forEach(function(r){
      saleTable += '<tr><td>'+esc(r.name)+(r.mapped?'':' <span style="color:var(--hint);font-size:10px">(chưa khớp)</span>')+'</td>'+
        '<td style="color:var(--muted)">'+esc(r.nhom||'—')+'</td>'+
        '<td style="text-align:right">'+fmt(r.donHang)+'</td><td style="text-align:right">'+fmtVND(r.doanhThu)+'</td>'+
        '<td style="text-align:right">'+r.tyLeChot+'%</td><td style="text-align:right">'+fmtVND(r.trungBinhDon)+'</td></tr>';
    });
    saleTable += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td>Tổng</td><td></td>'+
      '<td style="text-align:right">'+fmt(kpi.totalDonHang)+'</td><td style="text-align:right">'+fmtVND(kpi.totalDoanhThu)+'</td>'+
      '<td style="text-align:right">'+(kpi.tyLeChotChung||0)+'%</td><td style="text-align:right">'+fmtVND(tbDonTong)+'</td></tr>';
    saleTable += '</tbody></table></div>';
    html += _dbBody('sale', saleRows, 'name', 'doanhThu', true, saleTable);
  }

  // ── Theo Page (dung lai kpi.byPage — da xep theo Tong tuong tac giam dan) ──
  html += '<div class="dash-section-title">📄 Theo Page'+_dbViewToggleHtml('page')+'</div>';
  var pageRows = kpi.byPage || [];
  if (!pageRows.length){
    html += '<div style="color:var(--muted);font-size:12px;padding:8px 0 16px">Chưa có dữ liệu Page trong ngày này.</div>';
  } else {
    var pageTable = '';
    pageTable += '<div style="overflow-x:auto;margin-bottom:20px"><table class="dash-table"><thead><tr><th>Page</th><th style="text-align:right">Tương tác</th><th style="text-align:right">SĐT</th><th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">Tỷ lệ chốt</th><th style="text-align:right">TB đơn</th></tr></thead><tbody>';
    pageRows.forEach(function(r){
      pageTable += '<tr><td>'+esc(r.pageName)+(r.mapped?'':' <span style="color:var(--hint);font-size:10px">(chưa khớp kênh)</span>')+'</td>'+
        '<td style="text-align:right">'+fmt(r.tongTT)+'</td><td style="text-align:right">'+fmt(r.sdtMangVe)+'</td>'+
        '<td style="text-align:right">'+fmt(r.donHang)+'</td><td style="text-align:right">'+fmtVND(r.doanhThu)+'</td>'+
        '<td style="text-align:right">'+r.tyLeChot+'%</td><td style="text-align:right">'+fmtVND(r.trungBinhDon)+'</td></tr>';
    });
    pageTable += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td>Tổng</td>'+
      '<td style="text-align:right">'+fmt(kpi.totalTongTT)+'</td><td style="text-align:right">'+fmt(kpi.totalSdtMangVe)+'</td>'+
      '<td style="text-align:right">'+fmt(kpi.totalDonHang)+'</td><td style="text-align:right">'+fmtVND(kpi.totalDoanhThu)+'</td>'+
      '<td style="text-align:right">'+(kpi.tyLeChotChung||0)+'%</td><td style="text-align:right">'+fmtVND(tbDonTong)+'</td></tr>';
    pageTable += '</tbody></table></div>';
    html += _dbBody('page', pageRows, 'pageName', 'doanhThu', true, pageTable);
  }

  // ── Marketing — MUC RIENG, tach nen de phan biet ro voi ket qua ban hang o tren ──
  html += '<div style="margin-top:8px;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rlg)">';
  html += '<div class="dash-section-title" style="margin-top:0">📣 Marketing'+_dbViewToggleHtml('mkt')+'</div>';
  html += '<div class="kpi-grid" style="margin-bottom:14px">'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(mkt.tongTT)+'</div><div class="kpi-label">Tổng tương tác</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(mkt.sdtThuThap)+'</div><div class="kpi-label">SĐT thu thập</div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmt(mkt.baseOrders)+'</div><div class="kpi-label"><b>Đơn (Base)</b></div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmtVND(Math.round(mkt.baseRevenue||0))+'</div><div class="kpi-label"><b>Doanh thu</b></div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmtVND(Math.round(mkt.trungBinhDon||0))+'</div><div class="kpi-label">TB đơn</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+(mkt.tyLeChotTong||0)+'%</div><div class="kpi-label">Tỷ lệ chốt</div></div>'+
  '</div>';
  var mktGroups = (mkt.groups && mkt.groups.mkt) || [];
  if (mktGroups.length){
    var mktTable = '';
    mktTable += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Nhóm MKT</th><th style="text-align:right">Đơn</th><th style="text-align:right">Doanh thu</th><th style="text-align:right">TB đơn</th><th style="text-align:right">Tỷ lệ chốt</th></tr></thead><tbody>';
    mktGroups.forEach(function(g){
      mktTable += '<tr><td>'+esc(g.name)+'</td><td style="text-align:right">'+fmt(Math.round(g.baseOrders||0))+'</td>'+
        '<td style="text-align:right">'+fmtVND(Math.round(g.baseRevenue||0))+'</td><td style="text-align:right">'+fmtVND(Math.round(g.trungBinhDon||0))+'</td>'+
        '<td style="text-align:right">'+(g.tyLeChotTong||0)+'%</td></tr>';
    });
    mktTable += '</tbody></table></div>';
    html += _dbBody('mkt', mktGroups, 'name', 'baseRevenue', true, mktTable);
  } else {
    html += '<div style="color:var(--muted);font-size:12px">Chưa có nhóm MKT nào (đặt ở tab Quản lý Team → "Nhóm MKT").</div>';
  }
  html += '<div style="font-size:11px;color:var(--muted);margin-top:8px">Xem đủ phễu L1–L9 chi tiết ở tab ✅ Checklist MKT.</div>';
  html += '</div>';

  wrap.innerHTML = html;
}

function _pkRenderReportHtml(){
  var d = _pkState.report;
  if (!d) return '';
  var totalTT = d.byPage.reduce(function(s,r){return s+r.tongTT;},0);
  var totalDH = d.byPage.reduce(function(s,r){return s+r.tongDH;},0);
  var html = '<div class="kpi-grid" style="margin-bottom:16px">'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(totalTT)+'</div><div class="kpi-label">Tổng tương tác</div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmt(totalDH)+'</div><div class="kpi-label"><b>Tổng đơn hàng đã chốt</b></div></div>'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+(totalTT?Math.round(totalDH/totalTT*1000)/10:0)+'%</div><div class="kpi-label"><b>Tỉ lệ chuyển đổi TB</b></div></div>'+
  '</div>';

  if (d.unmapped && d.unmapped.length){
    html += '<div style="margin-bottom:10px;padding:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:12px;color:#9a3412">⚠️ '+d.unmapped.length+' tên chưa khớp Sale CRM đang tính riêng theo tên Pancake gốc trong bảng "Theo CS" bên dưới: '+d.unmapped.map(esc).join(', ')+'</div>';
  }

  html += '<div class="dash-section-title">Theo Page</div>';
  html += '<table class="dash-table"><thead><tr><th>Page</th><th style="text-align:right">Tổng TT</th><th style="text-align:right">Tin nhắn</th><th style="text-align:right">Bình luận</th><th style="text-align:right">Hội thoại mới</th><th style="text-align:right">Tổng ĐH</th><th style="text-align:right">Tỉ lệ CĐ</th></tr></thead><tbody>';
  d.byPage.forEach(function(r){
    html += '<tr><td>'+esc(r.pageName)+'</td><td style="text-align:right">'+fmt(r.tongTT)+'</td><td style="text-align:right">'+fmt(r.tinNhan)+'</td><td style="text-align:right">'+fmt(r.binhLuan)+'</td><td style="text-align:right">'+fmt(r.hoiThoaiMoi)+'</td><td style="text-align:right"><b>'+fmt(r.tongDH)+'</b></td><td style="text-align:right">'+r.tyLeCD+'%</td></tr>';
  });
  if (!d.byPage.length) html += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu trong khoảng ngày này</td></tr>';
  html += '</tbody></table>';

  html += '<div class="dash-section-title" style="margin-top:16px">Theo CS (Sale)</div>';
  html += '<table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">Tổng TT</th><th style="text-align:right">Tin nhắn</th><th style="text-align:right">Bình luận</th><th style="text-align:right">Hội thoại mới</th><th style="text-align:right">Tổng ĐH</th><th style="text-align:right">Tỉ lệ CĐ</th></tr></thead><tbody>';
  d.byCS.forEach(function(r){
    html += '<tr><td>'+esc(r.name)+(r.mapped?'':' <span style="color:#9a3412;font-size:11px" title="Tên Pancake gốc, chưa khớp Sale">⚠️</span>')+(r.shared?' <span style="color:var(--muted);font-size:11px" title="Có tên Pancake dùng chung với Sale khác">🔀 dùng chung</span>':'')+'</td><td style="text-align:right">'+fmt(r.tongTT)+'</td><td style="text-align:right">'+fmt(r.tinNhan)+'</td><td style="text-align:right">'+fmt(r.binhLuan)+'</td><td style="text-align:right">'+fmt(r.hoiThoaiMoi)+'</td><td style="text-align:right"><b>'+fmt(r.tongDH)+'</b></td><td style="text-align:right">'+r.tyLeCD+'%</td></tr>';
  });
  if (!d.byCS.length) html += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu trong khoảng ngày này</td></tr>';
  html += '</tbody></table>';
  return html;
}

function _pkExportReport(){
  var d = _pkState.report; if (!d) return;
  var byPageRows = [['Page','Tổng TT','Tin nhắn','Bình luận','Hội thoại mới','Tổng ĐH','Tỉ lệ CĐ (%)']];
  d.byPage.forEach(function(r){ byPageRows.push([r.pageName, r.tongTT, r.tinNhan, r.binhLuan, r.hoiThoaiMoi, r.tongDH, r.tyLeCD]); });
  var byCSRows = [['Sale','Đã khớp?','Tổng TT','Tin nhắn','Bình luận','Hội thoại mới','Tổng ĐH','Tỉ lệ CĐ (%)']];
  d.byCS.forEach(function(r){ byCSRows.push([r.name, r.mapped?'Có':'Chưa', r.tongTT, r.tinNhan, r.binhLuan, r.hoiThoaiMoi, r.tongDH, r.tyLeCD]); });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byPageRows), 'Theo Page');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byCSRows), 'Theo CS');
  XLSX.writeFile(wb, 'BaoCaoPancake_'+_pkState.from+'_'+_pkState.to+'.xlsx');
}


// ═══════════════════════════════════════════════════════
//  AUDIT LOG VIEW
// ═══════════════════════════════════════════════════════
function _auditActClass(a){
  return ({status:'status', cs:'cs', assign:'assign', sched:'sched', del:'del', team:'team'})[a] || 'status';
}
function _auditActLabel(a){
  return ({status:'Trạng thái', cs:'Đổi CS', assign:'Chia data', sched:'Lịch CS', del:'Xoá', team:'Team'})[a] || a;
}
function renderAuditTab(){
  var wrap = document.getElementById('audit-wrap');
  if (!wrap) return;
  var rows = auditLog.slice(0, 500);
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
    '<div class="dash-section-title" style="margin:0">🧾 Nhật ký thao tác ('+fmt(auditLog.length)+')</div>'+
    '<button class="btn secondary" onclick="exportAudit()">⬇ Xuất CSV</button></div>';
  html += '<table class="audit-table"><thead><tr><th style="width:140px">Thời gian</th><th style="width:120px">Người dùng</th>'+
    '<th style="width:90px">Hành động</th><th style="width:120px">SĐT</th><th>Thay đổi</th></tr></thead><tbody>';
  if (!rows.length){ html += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:18px">Chưa có thao tác nào được ghi.</td></tr>'; }
  rows.forEach(function(r){
    var when = r.timestamp ? new Date(r.timestamp).toLocaleString('vi-VN') : '';
    var change = '';
    if (r.oldValue && r.newValue) change = '<span class="audit-old">'+esc(r.oldValue)+'</span> → <span class="audit-new">'+esc(r.newValue)+'</span>';
    else change = esc(r.newValue || r.oldValue || '');
    html += '<tr><td style="color:var(--muted);font-size:11px">'+esc(when)+'</td>'+
      '<td>'+esc(r.user||'')+'</td>'+
      '<td><span class="audit-act '+_auditActClass(r.action)+'">'+_auditActLabel(r.action)+'</span></td>'+
      '<td style="font-family:monospace;font-size:12px">'+esc(r.phone||'')+'</td>'+
      '<td>'+change+'</td></tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}
function exportAudit(){
  var head = ['timestamp','user','action','phone','oldValue','newValue'];
  var lines = [head.join(',')];
  auditLog.forEach(function(r){
    lines.push(head.map(function(k){ return '"'+String(r[k]==null?'':r[k]).replace(/"/g,'""')+'"'; }).join(','));
  });
  var blob = new Blob(["\ufeff"+lines.join('\n')], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'OME_AuditLog_'+_ymd(new Date())+'.csv'; a.click();
}

function _srMoney(n){ return fmt(Math.round(n||0)) + '₫'; }

// Dong "Tong" bold, ke tren cung, dung chung cho MOI bang breakdown (Theo Sale/Kenh/MKT/San
// pham/CS/Hoa hong...) de nhat quan 1 kieu hien thi giua cac bao cao A/B/C/D/E.
// cells: mang cac chuoi HTML da format san cho tung cot dau tien (thuong la nhan "Tổng"), cac
// cot con lai deu can-phai (text-align:right) khop voi cach cac bang breakdown dang dung.
function _srTotalRowHtml_(cells){
  return '<tr style="border-top:2px solid var(--border-strong);font-weight:700;background:var(--surface2)">'+
    cells.map(function(c,i){ return '<td'+(i>0?' style="text-align:right"':'')+'>'+c+'</td>'; }).join('')+'</tr>';
}

// ── Toggle chế độ xem Bảng / Biểu đồ tròn / Biểu đồ cột cho các bảng breakdown ──
// KHÔNG đụng tới bất kỳ state lọc/tìm kiếm nào — chỉ đổi cách hiển thị phần dữ liệu ĐÃ được
// lọc sẵn (rows truyền vào _srChartSvg luôn là mảng đã qua đúng filter/search như bảng cũ).
function _srViewToggleHtml(viewKey){
  var v = _srState[viewKey] || 'table';
  function b(val, label){
    return '<button type="button" class="btn '+(v===val?'secondary':'sm')+'" style="padding:3px 9px;font-size:11px" '+
      'onclick="_srState[\''+viewKey+'\']=\''+val+'\';renderSalesReportTab()">'+label+'</button>';
  }
  return '<div style="display:inline-flex;gap:4px;margin-left:10px;vertical-align:middle">'+
    b('table','📋 Bảng')+b('pie','🥧 Tròn')+b('bar','📊 Cột')+'</div>';
}

// rows: mảng object đã lọc sẵn (giống hệt mảng dùng để vẽ bảng); nameKey/valueKey: tên field;
// type: 'pie'|'bar'; moneyFmt: true để format tiền (_srMoney), false để format số thường (fmt).
// ═══════════════════════════════════════════════════════
//  LOC THEO TIEU DE COT (client-side, tren du lieu da tai) cho cac bang Bao cao doanh so —
//  cung UX voi bang "Theo Page/Theo Sale" o tab KPI Pancake (bam ▼ tren tieu de -> popup tick
//  chon gia tri). Rieng cho tung bang (tableKey), khong dung chung state voi KPI Pancake.
// ═══════════════════════════════════════════════════════
function _srUniqVals_(rows, getter){
  var seen={}, out=[];
  (rows||[]).forEach(function(r){
    var v=getter(r); v=(v===null||v===undefined)?'':String(v);
    if (!seen[v]){ seen[v]=true; out.push(v); }
  });
  out.sort(function(a,b){ return a.localeCompare(b,'vi'); });
  return out;
}
function _srApplyColFilters_(rows, tableKey, getters){
  var filters = _srState.colFilters[tableKey] || {};
  var activeCols = Object.keys(filters).filter(function(c){ return filters[c] && filters[c].size>0; });
  if (!activeCols.length) return rows;
  return (rows||[]).filter(function(r){
    return activeCols.every(function(c){
      var v = getters[c] ? getters[c](r) : '';
      v = (v===null||v===undefined)?'':String(v);
      return filters[c].has(v);
    });
  });
}
function _srColTh_(tableKey, colKey, label, rowsFn, getter, extraStyle){
  var filters = _srState.colFilters[tableKey] || (_srState.colFilters[tableKey]={});
  var active = filters[colKey] && filters[colKey].size>0;
  return '<th style="'+(extraStyle||'')+'cursor:pointer" onclick="_srOpenColFilter_(\''+tableKey+'\',\''+colKey+'\',event)">'+
    '<span style="white-space:nowrap">'+esc(label)+
    ' <span style="font-size:9px;opacity:'+(active?'1':'.45')+';color:'+(active?'var(--green)':'inherit')+'">▼</span></span></th>';
}
function _srOpenColFilter_(tableKey, colKey, ev){
  ev.stopPropagation();
  var old = document.getElementById('sr-colfilter-pop'); if (old) old.remove();
  var rowsFn = _SR_COLTH_ROWSFN_[tableKey], getter = (_SR_COLTH_GETTER_[tableKey]||{})[colKey];
  if (!rowsFn || !getter) return;
  var rawRows = rowsFn();
  var values = _srUniqVals_(rawRows, getter);
  var filters = _srState.colFilters[tableKey] || (_srState.colFilters[tableKey]={});
  var curSet = filters[colKey] || new Set();

  var pop = document.createElement('div');
  pop.id = 'sr-colfilter-pop';
  pop.style.cssText = 'position:fixed;z-index:5000;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.2);padding:8px;width:220px;font-size:12px';
  var rect = ev.target.closest('th').getBoundingClientRect();
  var top = rect.bottom+4, left = Math.min(rect.left, window.innerWidth-232);
  pop.style.top = top+'px'; pop.style.left = left+'px';
  pop.innerHTML = '<input type="text" placeholder="Tìm..." id="sr-colfilter-search" style="width:100%;box-sizing:border-box;padding:4px 6px;border:1px solid var(--border);border-radius:5px;margin-bottom:6px;font-size:12px">'+
    '<div id="sr-colfilter-list" style="max-height:220px;overflow-y:auto"></div>'+
    '<div style="display:flex;gap:6px;margin-top:8px">'+
    '<button onclick="_srColFilterApply_(\''+tableKey+'\',\''+colKey+'\')" style="flex:1;padding:5px;background:var(--green);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">Áp dụng</button>'+
    '<button onclick="_srColFilterClear_(\''+tableKey+'\',\''+colKey+'\')" style="flex:1;padding:5px;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px">Xoá lọc</button>'+
    '</div>';
  document.body.appendChild(pop);
  function renderList(ft){
    var list = document.getElementById('sr-colfilter-list'); if (!list) return;
    ft = (ft||'').toLowerCase();
    list.innerHTML = values.filter(function(v){ return !ft || v.toLowerCase().indexOf(ft)!==-1; }).map(function(v){
      var checked = curSet.size===0 || curSet.has(v);
      var vAttr = esc(v).replace(/"/g,'&quot;');
      return '<label style="display:flex;align-items:center;gap:6px;padding:3px 2px;cursor:pointer">'+
        '<input type="checkbox" data-srcv="'+vAttr+'" '+(checked?'checked':'')+'>'+
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(v||'<i style="color:var(--muted)">(trống)</i>')+'</span></label>';
    }).join('') || '<div style="color:var(--muted);padding:6px 2px">Không có giá trị khớp.</div>';
  }
  renderList('');
  document.getElementById('sr-colfilter-search').addEventListener('input', function(e){ renderList(e.target.value); });
  document.getElementById('sr-colfilter-search').focus();
  setTimeout(function(){
    document.addEventListener('click', function _srColFilterOutside(e){
      if (!pop.contains(e.target)){ pop.remove(); document.removeEventListener('click', _srColFilterOutside); }
    });
  }, 0);
}
function _srColFilterApply_(tableKey, colKey){
  var pop = document.getElementById('sr-colfilter-pop'); if (!pop) return;
  var checked = Array.prototype.slice.call(pop.querySelectorAll('input[data-srcv]:checked')).map(function(el){ return el.getAttribute('data-srcv'); });
  var allCbs = pop.querySelectorAll('input[data-srcv]');
  var filters = _srState.colFilters[tableKey];
  if (checked.length === allCbs.length) filters[colKey] = new Set();
  else filters[colKey] = new Set(checked);
  pop.remove();
  renderSalesReportTab();
}
function _srColFilterClear_(tableKey, colKey){
  var filters = _srState.colFilters[tableKey];
  if (filters) filters[colKey] = new Set();
  var pop = document.getElementById('sr-colfilter-pop'); if (pop) pop.remove();
  renderSalesReportTab();
}

function _srChartSvg(rows, nameKey, valueKey, type, moneyFmt, ordersKey){
  var data = (rows||[]).map(function(r){ return {name: (r[nameKey]||'(chưa gán)'), value: Math.abs(Number(r[valueKey])||0), orders: ordersKey?(Number(r[ordersKey])||0):0}; })
    .filter(function(d){ return d.value>0; });
  if (!data.length) return '<div style="color:var(--muted);text-align:center;padding:30px">Không có dữ liệu để vẽ biểu đồ</div>';
  data.sort(function(a,b){ return b.value-a.value; });
  var fmtVal = function(v){ return moneyFmt ? _srMoney(v) : fmt(v); };
  var total = data.reduce(function(s,d){ return s+d.value; }, 0);
  // Tong so don + TB don (chi tinh khi bang co cot dem don — vd cot "orders") — hien thanh 1
  // thanh KPI gon phia tren bieu do, canh nhau tren 1 hang de chup man hinh gui bao cao duoc
  // ngay, khong phai crop/ghep nhieu anh: Tong so don | Tong tien | TB don.
  var totalOrders = ordersKey ? data.reduce(function(s,d){ return s+d.orders; }, 0) : 0;
  var avgOrder = totalOrders ? total/totalOrders : 0;
  var summaryStrip = ordersKey ? (
    '<div style="display:flex;gap:28px;flex-wrap:wrap;margin-bottom:14px;padding:12px 18px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">'+
      '<div><div style="font-size:10.5px;color:var(--muted);font-weight:700;letter-spacing:.3px">📦 TỔNG SỐ ĐƠN</div><div style="font-size:19px;font-weight:800;margin-top:2px">'+fmt(totalOrders)+'</div></div>'+
      '<div><div style="font-size:10.5px;color:var(--muted);font-weight:700;letter-spacing:.3px">'+(moneyFmt?'💰 TỔNG DOANH THU':'💰 TỔNG SỐ LƯỢNG')+'</div><div style="font-size:19px;font-weight:800;margin-top:2px;color:var(--green)">'+fmtVal(total)+'</div></div>'+
      '<div><div style="font-size:10.5px;color:var(--muted);font-weight:700;letter-spacing:.3px">📊 TRUNG BÌNH / ĐƠN</div><div style="font-size:19px;font-weight:800;margin-top:2px">'+fmtVal(avgOrder)+'</div></div>'+
    '</div>'
  ) : '';
  var legend = data.map(function(d,i){
    var pct = total ? (d.value/total*100) : 0;
    // break-inside:avoid — khi tràn sang cột 2/3 (xem CSS "columns" ở khung cha) thì KHÔNG bị
    // cắt đôi 1 dòng giữa 2 cột. Bỏ ellipsis/max-width cũ (từng làm cụt tên) — để 1 dòng, tên dài
    // vẫn hiện đủ, cột tự rộng theo layout multi-column bên dưới thay vì cắt bớt chữ.
    return '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;margin-bottom:6px;break-inside:avoid;-webkit-column-break-inside:avoid;page-break-inside:avoid">'+
      '<span style="width:10px;height:10px;border-radius:2px;background:'+_SR_CHART_COLORS[i%_SR_CHART_COLORS.length]+';flex:none;display:inline-block"></span>'+
      '<span style="white-space:nowrap">'+esc(d.name)+'</span>'+
      '<span style="color:var(--muted);white-space:nowrap;margin-left:auto;padding-left:8px">'+fmtVal(d.value)+' ('+pct.toFixed(1)+'%)</span></div>';
  }).join('');

  if (type === 'pie'){
    var cx=100, cy=100, r=90, angle=-90, paths='', labels='';
    data.forEach(function(d,i){
      var frac = total ? d.value/total : 0;
      var sweep = frac*360;
      var x1 = cx + r*Math.cos(angle*Math.PI/180), y1 = cy + r*Math.sin(angle*Math.PI/180);
      var endAngle = angle+sweep;
      var x2 = cx + r*Math.cos(endAngle*Math.PI/180), y2 = cy + r*Math.sin(endAngle*Math.PI/180);
      var large = sweep>180?1:0;
      var color = _SR_CHART_COLORS[i%_SR_CHART_COLORS.length];
      if (frac>=0.9999){
        paths += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+color+'"><title>'+esc(d.name)+': '+fmtVal(d.value)+'</title></circle>';
      } else {
        paths += '<path d="M'+cx+','+cy+' L'+x1.toFixed(2)+','+y1.toFixed(2)+' A'+r+','+r+' 0 '+large+' 1 '+x2.toFixed(2)+','+y2.toFixed(2)+' Z" fill="'+color+'"><title>'+esc(d.name)+': '+fmtVal(d.value)+'</title></path>';
      }
      // Nhan % NGAY TREN mieng banh — chi hien voi mieng du to (>=5%) de khong chong chit chu voi
      // cac mieng nho; chu trang co vien mo (paint-order stroke) de doc duoc tren MOI mau nen.
      // TU DONG THU NHO co chu theo be rong day cung (chord) cua CHINH mieng banh do tai ban kinh
      // dat nhan — mieng cang hep (vd 9%, 13%) thi chu cang nho, KHONG con tran sang mieng ben
      // canh nhu truoc (bug "% bi che" — chu 1 co dinh 10px qua rong so voi mieng hep).
      if (frac >= 0.05){
        var midAngle = angle + sweep/2, lr = r*0.66;
        var lx = cx + lr*Math.cos(midAngle*Math.PI/180), ly = cy + lr*Math.sin(midAngle*Math.PI/180);
        var pctTxt = (Math.round(frac*1000)/10)+'%';
        var chordW = 2*lr*Math.sin((sweep*Math.PI/180)/2);       // be rong thuc te cua mieng banh tai ban kinh lr
        var fitFs = (chordW*0.86) / (pctTxt.length*0.62);         // co chu de vua khit be rong do (86% de chua le)
        var fs = Math.max(7, Math.min(10, fitFs));
        labels += '<text x="'+lx.toFixed(2)+'" y="'+ly.toFixed(2)+'" text-anchor="middle" dominant-baseline="central" font-size="'+fs.toFixed(1)+'" font-weight="700" fill="#fff" '+
          'style="paint-order:stroke;stroke:rgba(0,0,0,.45);stroke-width:2.2px;stroke-linejoin:round;pointer-events:none">'+pctTxt+'</text>';
      }
      angle = endAngle;
    });
    paths += labels;
    // Khoet lo giua thanh donut + hien TONG ngay giua bieu do — dat SAU cac mieng banh nen de
    // len tren, ban kinh 45 nho hon ban kinh dat nhan (0.66*90=59.4) nen khong chong chu %.
    var totalLine1 = 'Tổng';
    // Van hien so DAY DU (khong rut gon) — Duyen chap nhan tran nhe ra ngoai vong tron mien la
    // chu du nho de nhin duoc, hon la rut gon mat chi tiet. Ha them 1 nac font nho (toi thieu 10
    // thay vi 13 truoc day) cho chuoi dai.
    var totalTxt = fmtVal(total);
    var totalFs = totalTxt.length > 13 ? 10 : (totalTxt.length > 11 ? 11.5 : (totalTxt.length > 8 ? 14 : 17));
    paths += '<circle cx="'+cx+'" cy="'+cy+'" r="46" fill="var(--surface)"></circle>'+
      '<text x="'+cx+'" y="'+(cy-9)+'" text-anchor="middle" dominant-baseline="central" font-size="10" fill="var(--muted)" font-weight="600">'+totalLine1+'</text>'+
      '<text x="'+cx+'" y="'+(cy+9)+'" text-anchor="middle" dominant-baseline="central" font-size="'+totalFs+'" fill="var(--text)" font-weight="800">'+esc(totalTxt)+'</text>';
    // Bieu do to hon (240px thay vi 200px) + khung chu thich KHONG con gioi han chieu cao/thanh
    // keo nua: dung CSS "columns" de tu chay sang cot 2, cot 3... khi danh sach dai (con hon
    // scroll), so cot tu dieu chinh theo be rong man hinh va so luong ten.
    return summaryStrip+'<div style="display:flex;gap:26px;flex-wrap:wrap;align-items:center;padding:10px 0">'+
      '<svg viewBox="0 0 200 200" style="width:240px;height:240px;flex:none">'+paths+'</svg>'+
      '<div style="flex:1 1 420px;min-width:260px;max-width:1000px;columns:230px;column-gap:26px">'+legend+'</div></div>';
  }

  // bar chart ngang
  var maxV = data[0].value || 1;
  var barsHtml = data.map(function(d,i){
    var w = maxV ? (d.value/maxV*100) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
      '<div style="width:130px;font-size:11.5px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(d.name)+'">'+esc(d.name)+'</div>'+
      '<div style="flex:1;background:var(--surface2);border-radius:4px;overflow:hidden;height:16px">'+
      '<div style="width:'+w.toFixed(1)+'%;height:100%;background:'+_SR_CHART_COLORS[i%_SR_CHART_COLORS.length]+'"></div></div>'+
      '<div style="width:120px;font-size:11px;color:var(--muted)">'+fmtVal(d.value)+'</div></div>';
  }).join('');
  return '<div style="padding:10px 0;max-height:480px;overflow-y:auto">'+
    (summaryStrip || '<div style="font-weight:700;font-size:13px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">Tổng: '+fmtVal(total)+'</div>')+
    barsHtml+'</div>';
}

// ── Phan quyen bao cao doanh so: CS thuong CHI xem duoc so lieu cua chinh minh, khong xem
// duoc ca team. Admin (currentUser.role==='admin') khong bi gioi han gi. ──
function _srIsAdmin(){ return !(typeof currentUser !== 'undefined' && currentUser && currentUser.role !== 'admin' && currentUser.role !== 'demo'); }
function _srMyNames(){
  return (typeof currentUser !== 'undefined' && currentUser && currentUser.names && currentUser.names.length)
    ? currentUser.names.slice() : [];
}
// Khoa cung bo loc Sale ve dung ten cua chinh CS dang dang nhap — goi o dau moi lan render de
// khong the nao bi doi sang xem sale khac (kien ca qua thao tac client, phong khi co lo hong UI).
// RIENG bao cao E (Hoa hong): Leader duoc xem CA TEAM cua minh (giong dung quyen xem KH da co san
// o _inUserScope cho leader), khong chi rieng ten minh nhu CS thuong — vi Truong nhom can doi
// chieu hoa hong ca nhom. Neu leader tu bo bot/chon lai vai ten trong team (qua combo o dươi),
// _srState.eSaleCustomized se bat len va giu nguyen lua chon do, chi loc bo ten NGOAI team.
function _srLeaderTeamNames(){
  var my = _srMyNames();
  for (var i=0;i<(teams||[]).length;i++){
    var t = teams[i];
    if (my.indexOf(t.leader)!==-1 || t.name===currentUser.team){
      return Array.from(_teamMemberSet(t));
    }
  }
  return [];
}
function _srEnforceScope(){
  if (_srIsAdmin()) return;
  var my = _srMyNames();
  _srState.sale = my.slice();
  _srState.bSale = my.slice();
  _srState.cSale = my.slice();
  if (currentUser && currentUser.role === 'leader'){
    var teamNames = _srLeaderTeamNames();
    _srState.leaderTeamOptions = teamNames;
    if (teamNames.length){
      if (!_srState.eSaleCustomized) _srState.eSale = teamNames.slice();
      else _srState.eSale = (_srState.eSale||[]).filter(function(n){ return teamNames.indexOf(n)!==-1; });
      if (!_srState.fSaleCustomized) _srState.fSale = teamNames.slice();
      else _srState.fSale = (_srState.fSale||[]).filter(function(n){ return teamNames.indexOf(n)!==-1; });
      _srState.lSale = teamNames.slice(); // Bao cao L: Leader xem ca team (khong thu hep rieng)
      if (!_srState.gSaleCustomized) _srState.gSale = teamNames.slice();
      else _srState.gSale = (_srState.gSale||[]).filter(function(n){ return teamNames.indexOf(n)!==-1; });
      return;
    }
  }
  _srState.eSale = my.slice();
  _srState.fSale = my.slice();
  _srState.gSale = my.slice();
  _srState.lSale = my.slice();
}

// SUA (theo bao cao Duyen: "lọc tháng 7-8-9 load khá lâu nhưng không ra kết quả"): truoc day
// MOI loai loi (timeout do khoang ngay loc qua rong/nhieu don, GAS tra ve trang loi HTML thay vi
// JSON, mat mang...) deu bi nuot am tham thanh return null, khien cac man hinh bao cao hien
// y het "Chưa có dữ liệu" NHU THE la khong co don nao khop bo loc — trong khi that ra request
// bi LOI/TIMEOUT chu khong phai that su rong. Gio ghi lai LOI THAT vao _srState.lastFetchError
// de cac man hinh phan biet duoc va bao dung nguyen nhan cho CS, thay vi danh lua la "0 ket qua".
// Them timeout 55s (AbortController) de khong treo vo han khi GAS xu ly qua lau voi khoang ngay
// rong (vd loc gop nhieu thang) — qua gio bao loi ro rang kem goi y thu loc tung thang mot.
async function _srFetch(action, params){
  if (!gsUrl) return null;
  _srState.lastFetchError = '';
  var sep = gsUrl.includes('?') ? '&' : '?';
  var qs = Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]||''); }).join('&');
  var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = ac ? setTimeout(function(){ ac.abort(); }, 55000) : null;
  try{
    var r = await fetch(gsUrl + sep + 'action=' + action + '&' + qs, { redirect:'follow', signal: ac ? ac.signal : undefined });
    if (timer) clearTimeout(timer);
    if (!r.ok) {
      _srState.lastFetchError = 'Server trả về lỗi HTTP ' + r.status + ' — thử lọc lại, nếu vẫn vậy thì báo lại khoảng ngày/bộ lọc đang dùng.';
      return null;
    }
    var txt = await r.text();
    try {
      return JSON.parse(txt);
    } catch (eParse) {
      // GAS thuong tra ve 1 trang HTML loi (vd "Exceeded maximum execution time") thay vi JSON
      // khi script chay qua 6 phut hoac gap loi khong bat duoc — rat hay gap khi khoang ngay loc
      // qua rong (nhieu don) lam doc+xu ly sheet qua lau.
      var looksTimeout = /exceeded maximum execution time/i.test(txt) || /timeout/i.test(txt);
      _srState.lastFetchError = looksTimeout
        ? 'Yêu cầu chạy quá lâu và bị GAS huỷ giữa chừng (khoảng ngày lọc có thể quá rộng, quá nhiều đơn) — thử lọc từng tháng một thay vì gộp nhiều tháng.'
        : 'Server trả về dữ liệu không đọc được (không phải JSON) — có thể do lỗi tạm thời, thử lọc lại.';
      return null;
    }
  } catch(e) {
    if (timer) clearTimeout(timer);
    _srState.lastFetchError = (e && e.name === 'AbortError')
      ? 'Yêu cầu quá 55 giây chưa có phản hồi nên đã huỷ — khoảng ngày lọc có thể quá rộng (nhiều đơn), thử lọc từng tháng một.'
      : 'Không gọi được server (mất mạng hoặc URL GAS sai) — kiểm tra lại kết nối rồi lọc lại.';
    return null;
  }
}

// Dung chung cho MOI man hinh bao cao doanh so khi chua co du lieu (d rong/null): neu lan goi
// gan nhat THAT SU loi (xem _srFetch), hien ro nguyen nhan thay vi "Chưa có dữ liệu" gay hieu
// lam la khong co don nao khop bo loc.
function _srNoDataHtml_(){
  if (_srState.lastFetchError) {
    return '<div style="color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;text-align:center;padding:20px;font-size:13px">⚠️ ' + _srState.lastFetchError + '</div>';
  }
  return '<div style="color:var(--muted);text-align:center;padding:30px">Chưa có dữ liệu — bấm "Lọc" để tải.</div>';
}

async function _srLoadOptions(){
  _srState.optionsLoaded = true;
  var opts = await _srFetch('salesReportOptions', {});
  if (opts){
    _srState.saleOptions = opts.sale || [];
    _srState.kenhOptions = opts.kenh || [];
    _srState.nguonOptions = opts.nguon || [];
    _srState.marketerOptions = opts.marketer || [];
    _srState.saleBOptions = opts.saleB || [];
    renderSalesReportTab();
  }
}


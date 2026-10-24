/* ĐƠN CHIA (yêu cầu Duyên 10/2026) — đơn Pos có ≥2 sale cùng chia (thẻ sale nhiều tên / ghép Base / file kế toán / quầy 30/70).
   (1) "Danh sách đơn chia": mục mới ở lọc "nguồn dữ liệu" (Danh sách KH) → chỉ hiện khách có đơn MÀ BẠN ĐƯỢC SALE KHÁC CHIA + banner tổng kết
       nhanh (số đơn chia, doanh thu từ đơn chia). Backend: GAS splitOrderMine (gas/31_SplitOrders.gs, v13.58+).
   (2) Báo cáo M — Tổng quan đơn chia (Báo cáo doanh số): tổng đơn thực tế, doanh thu, TB/đơn + theo từng sale: số đơn chia, doanh thu từ đơn chia, TB/đơn chia.
       Backend: GAS splitOrderReport (phân quyền theo vai trò ở server). Bộ lọc ngày có đủ mốc nhanh (Hôm nay … Năm trước). */

// ── Hàm thuần ──
function splitPhoneKey_(p){ var d = String(p==null?'':p).replace(/\D/g,''); if (!d) return ''; if (d.indexOf('84')===0 && d.length>=11) d = '0'+d.slice(2); else if (d.charAt(0)!=='0' && d.length===9) d = '0'+d; return d; }
function splitEsc_(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function splitMoney_(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN')+'₫'; }
function splitNum_(n){ return (Math.round(Number(n)||0)).toLocaleString('vi-VN'); }
function splitPct_(n){ return (n===null||n===undefined) ? '—' : (Math.round(n*10)/10).toString().replace('.',',')+'%'; }
function splitTile_(cls, label, value, sub){ return '<div class="pro-kpi '+cls+'"><span class="k-l">'+splitEsc_(label)+'</span><span class="k-v" style="font-size:'+(String(value).length>11?'20':'26')+'px">'+value+'</span>'+(sub?'<span class="k-s">'+sub+'</span>':'')+'</div>'; }

// Banner "Danh sách đơn chia" (d = kết quả splitOrderMine)
function splitBannerHtml_(d, st){
  var quick = (typeof _quickRangeSelectHtml==='function') ? _quickRangeSelectHtml(st.quick, "splitSetQuick_(this.value)") : '';
  var custom = st.quick==='custom' ? ' <input type="date" id="split-from" value="'+splitEsc_(st.from)+'" onchange="_split.from=this.value"> – <input type="date" id="split-to" value="'+splitEsc_(st.to)+'" onchange="_split.to=this.value"> <button type="button" class="btn sm primary" onclick="splitMineLoad_(true)">Xem</button>' : '';
  var head = '<div class="split-h"><b>🤝 Danh sách đơn chia</b> <span class="split-sub">'+(d&&d.all?'tất cả đơn chia (Admin/CEO)':'các đơn bạn được sale khác chia')+'</span> '+quick+custom+'</div>';
  if (st.loading) return head+'<div class="split-msg">Đang tải…</div>';
  if (!d) return head+'<div class="split-msg">'+splitEsc_(st.error||'Chưa có dữ liệu.')+'</div>';
  if (d.ok===false) return head+'<div class="split-msg split-err">⚠ '+splitEsc_(d.error||'Lỗi tải đơn chia')+'</div>';
  var s = d.summary||{};
  var tiles = '<div class="pro-grid split-tiles">'
    + splitTile_('blue','Số đơn chia', splitNum_(s.orders), 'trong kỳ '+splitEsc_(d.from)+' → '+splitEsc_(d.to))
    + splitTile_('green','Doanh thu từ đơn chia', splitMoney_(s.revenue), d.all?'tổng phần các sale':'phần của bạn')
    + splitTile_('orange','Số khách', splitNum_(s.customers), '')
    + splitTile_('purple','Giá trị đơn gốc', splitMoney_(s.value), 'trước khi chia')+'</div>';
  var note = d.note ? '<div class="split-msg">'+splitEsc_(d.note)+'</div>' : '';
  var trunc = d.truncated ? '<div class="split-msg split-err">Chỉ hiện '+splitNum_((d.items||[]).length)+' đơn mới nhất — thu hẹp khoảng ngày để xem đủ.</div>' : '';
  return head + tiles + note + trunc + splitDetailHtml_(d.items||[], 200, !!d.all);
}
function splitDetailHtml_(items, max, all){
  if (!items.length) return '<div class="split-msg">Không có đơn chia nào trong kỳ này.</div>';
  var rows = items.slice(0,max).map(function(it){
    return '<tr data-split-phone="'+splitEsc_(it.phone)+'"><td>'+splitEsc_(String(it.date).split(' ')[0])+'</td><td><b>'+splitEsc_(it.name||'—')+'</b><div class="split-ph">'+splitEsc_(it.phone)+'</div></td>'
      +'<td>'+splitEsc_(it.product)+'</td><td class="r">'+splitMoney_(it.value)+'</td><td class="r"><b>'+splitMoney_(it.share)+'</b>'+(it.frac!=null&&it.frac<1?'<div class="split-ph">'+Math.round(it.frac*1000)/10+'%</div>':'')+'</td>'
      +'<td>'+splitEsc_((it.withSales||[]).join(', '))+'</td></tr>'; }).join('');
  return '<details class="split-d"><summary>Chi tiết '+splitNum_(items.length)+' đơn chia'+(items.length>max?' (hiện '+max+' đơn mới nhất)':'')+'</summary><div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Ngày</th><th>Khách</th><th>Sản phẩm</th><th class="r">Giá trị đơn</th><th class="r">'+(all?'Tổng phần sale':'Phần của bạn')+'</th><th>'+(all?'Các sale trên đơn':'Chia cùng')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
}

// Báo cáo M (d = kết quả splitOrderReport)
function splitReportHtml_(d, search, selSale){
  if (!d) return '<div style="color:var(--muted);text-align:center;padding:40px">'+splitEsc_((typeof _srState!=='undefined'&&_srState.lastFetchError)||'Chưa có dữ liệu — bấm "Lọc".')+'</div>';
  if (d.ok===false || d.error) return '<div style="color:var(--red);padding:20px">⚠ '+splitEsc_(d.error||'Lỗi tải báo cáo')+'</div>';
  var t = d.total||{}, q = String(search||'').trim().toLowerCase();
  var rows = (d.bySale||[]).filter(function(r){ return !q || String(r.name).toLowerCase().indexOf(q)!==-1; });
  var h = '<div class="pro-grid split-kpis" style="margin-bottom:10px">'
    + splitTile_('blue','Tổng số đơn (thực tế)', splitNum_(t.orders), 'mỗi đơn tính 1 lần')
    + splitTile_('green','Doanh thu', splitMoney_(t.revenue), '')
    + splitTile_('orange','Trung bình đơn', splitMoney_(t.aov), '')+'</div>';
  h += '<div class="pro-grid split-kpis" style="margin-bottom:14px">'
    + splitTile_('purple','Số đơn chia', splitNum_(t.splitOrders), splitPct_(t.splitPctOrders)+' tổng số đơn')
    + splitTile_('green','Doanh thu từ đơn chia', splitMoney_(t.splitRevenue), splitPct_(t.splitPctRevenue)+' doanh thu')
    + splitTile_('orange','TB đơn chia', splitMoney_(t.splitAov), 'phần chia / đơn chia')+'</div>';
  h += '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Đơn chia = đơn có từ 2 sale trở lên cùng chia (thẻ sale nhiều tên / ghép Base / file kế toán / quầy 30-70). Kỳ '+splitEsc_(d.from)+' → '+splitEsc_(d.to)+(d.scope==='scoped'?' · phạm vi của bạn':'')+'. Doanh thu từ đơn chia = tổng phần mỗi sale được chia.</div>';
  (d.warnings||[]).forEach(function(w){ h += '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px">⚠ '+splitEsc_(w)+'</div>'; });
  h += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Sale</th><th class="r">Tổng đơn</th><th class="r">Doanh thu</th><th class="r">TB/đơn</th><th class="r">Số đơn chia</th><th class="r">Doanh thu từ đơn chia</th><th class="r">TB/đơn chia</th><th class="r">% doanh thu từ đơn chia</th><th>Chi tiết đối soát</th></tr></thead><tbody>';
  rows.forEach(function(r){ var on = selSale && String(selSale)===String(r.name); h += '<tr data-m-sale="'+splitEsc_(r.name)+'" style="cursor:pointer'+(on?';background:var(--pro-soft,#f3e8ff)':'')+'" title="Bấm để xem chi tiết các đơn chia của sale này"><td><b>'+splitEsc_(r.name)+'</b></td><td class="r">'+splitNum_(r.orders)+'</td><td class="r">'+splitMoney_(r.revenue)+'</td><td class="r">'+splitMoney_(r.aov)+'</td><td class="r">'+splitNum_(r.splitOrders)+'</td><td class="r"><b>'+splitMoney_(r.splitRevenue)+'</b></td><td class="r">'+splitMoney_(r.splitAov)+'</td><td class="r">'+splitPct_(r.splitPct)+'</td><td style="white-space:nowrap"><button type="button" class="btn sm" data-m-view="base">Base</button> <button type="button" class="btn sm" data-m-view="pos">Pos</button></td></tr>'; });
  if (!rows.length) h += '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:16px">Không có dữ liệu trong khoảng ngày này</td></tr>';
  else { var s = rows.reduce(function(a,r){ a.o+=r.orders; a.rv+=r.revenue; a.so+=r.splitOrders; a.sr+=r.splitRevenue; return a; },{o:0,rv:0,so:0,sr:0});
    h += '<tr style="font-weight:700;background:var(--surface2)"><td>Tổng (cộng theo từng sale)</td><td class="r">'+splitNum_(s.o)+'</td><td class="r">'+splitMoney_(s.rv)+'</td><td class="r">'+splitMoney_(s.o?s.rv/s.o:0)+'</td><td class="r">'+splitNum_(s.so)+'</td><td class="r">'+splitMoney_(s.sr)+'</td><td class="r">'+splitMoney_(s.so?s.sr/s.so:0)+'</td><td class="r">'+splitPct_(s.rv?s.sr/s.rv*100:null)+'</td><td></td></tr>'; }
  h += '</tbody></table></div><div style="font-size:10.5px;color:var(--hint);margin:4px 0 12px">Tổng đơn theo từng sale cộng lại có thể lớn hơn "Tổng số đơn (thực tế)" vì đơn chia được tính cho mỗi sale tham gia (giống Báo cáo B); doanh thu thì mỗi sale chỉ tính phần mình.</div>';
  return h;
}
// ── Chi tiết đối soát của 1 sale (bấm dòng sale / nút Base, Pos ở Báo cáo M) — GAS splitOrderDetail (Duyên yêu cầu 2026-10-21) ──
// Pos = mỗi đơn Pos chia cho sale; Base = mỗi đơn gốc Base đã ghép với đơn Pos đó. Cột "doanh thu sau chia" Pos khớp cột "Doanh thu từ đơn chia" của dòng sale ở bảng M.
var SPLIT_DET_POS_HEAD = ['Ngày lên đơn','Tháng lên đơn','Tên KH','Số điện thoại','Ghi chú','Sale tham gia (thẻ Pos)','Sản phẩm (Pos)','Tổng doanh thu','Doanh thu sau chia','Giá đơn Pos gốc (nếu khác)','Đối chiếu Base','Sale trên Base','Thiếu trên Pos (có trên Base)','Thừa trên Pos (không có trên Base)','Mã bộ đếm Base','Sale phản hồi'];
var SPLIT_DET_BASE_HEAD = ['Ngày lên đơn','Tháng lên đơn','Tên KH','Số điện thoại','Mã bộ đếm','Sale tham gia (bán trên Base)','Sản phẩm (Base)','Tổng doanh thu','Doanh thu sau chia','Loại dòng'];
function splitBaseKind_(x){ return x.ref ? (x.nguon==='sdt' ? 'Tham chiếu — gợi ý theo SĐT' : 'Tham chiếu — theo mã bộ đếm') : 'Đã ghép (tính vào doanh thu)'; }
function splitCheckLabel_(c){
  if (!c || !c.status) return '';
  var g = c.nguon==='sdt' ? ' (gợi ý theo SĐT)' : '';
  return c.status==='khop' ? 'Khớp Base'+g : c.status==='lech' ? 'LỆCH Base'+g : 'Không có đơn Base để đối chiếu';
}
function splitDetRows_(det, tab){
  if (tab==='base') return (det.base||[]).map(function(x){ return [x.date,x.month,x.name,x.phone,x.code,x.sales,x.product,x.total,x.share,splitBaseKind_(x)]; });
  var onlyLech = arguments[2];
  return (det.pos||[]).filter(function(x){ return !onlyLech || (x.baseCheck && x.baseCheck.status==='lech'); }).map(function(x){
    var c = x.baseCheck||{}, J = function(a){ return (a||[]).join(', '); };
    var row = [x.date,x.month,x.name,x.phone,x.note,x.sales,x.product,x.total,x.share,(x.posValue!=null&&x.posValue!==x.total)?x.posValue:'',
      splitCheckLabel_(c),J(c.baseSales),J(c.missing),J(c.extra),J(c.baseCodes),x.feedback||''];
    row.fbKey = x.fbKey||''; return row;   // fbKey chỉ để ô nhập "Sale phản hồi" biết lưu vào dòng nào (không đưa vào Excel)
  });
}
function splitDetailPanelHtml_(m){
  if (!m) return '';
  var tabBtn = function(k,label){ var on = m.tab===k; return '<button type="button" class="btn sm'+(on?' primary':'')+'" data-m-tab="'+k+'">'+label+'</button>'; };
  var h = '<div id="sr-m-detail" style="margin-top:14px;border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--surface)">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><b style="font-size:14px">Chi tiết đơn chia — '+splitEsc_(m.sale)+'</b>'
    + tabBtn('base','📘 Chi tiết Base')+tabBtn('pos','🧾 Chi tiết Pos')
    + (m.tab==='pos' ? '<button type="button" class="btn sm'+(m.onlyLech?' primary':'')+'" data-m-lech="1" title="Chỉ hiện đơn Pos lệch thẻ sale so với Base">🔴 Chỉ đơn lệch Base</button>' : '')
    + '<button type="button" class="btn sm" data-m-xlsx="1"'+(m.data?'':' disabled')+'>📥 Xuất Excel đối soát (Base + Pos)</button>'
    + '<button type="button" class="btn sm" data-m-close="1" style="margin-left:auto">✕ Đóng</button></div>';
  if (m.loading) return h+'<div style="color:var(--muted);padding:20px;text-align:center">Đang tải chi tiết…</div></div>';
  if (m.error) return h+'<div style="color:var(--red);padding:12px">⚠ '+splitEsc_(m.error)+'</div></div>';
  var d = m.data||{}, sm = d.summary||{}, rows = splitDetRows_(d, m.tab, m.onlyLech), head = m.tab==='base'?SPLIT_DET_BASE_HEAD:SPLIT_DET_POS_HEAD;
  (d.warnings||[]).forEach(function(w){ h += '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:12px">⚠ '+splitEsc_(w)+'</div>'; });
  h += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Kỳ '+splitEsc_(d.from)+' → '+splitEsc_(d.to)+' · '
    + (m.tab==='base' ? '<b>'+splitNum_(sm.baseOrders)+'</b> đơn gốc Base · tổng '+splitMoney_(sm.baseTotal)+' · phần của sale <b>'+splitMoney_(sm.baseShare)+'</b>'
                      : '<b>'+splitNum_(sm.posOrders)+'</b> đơn Pos chia · tổng '+splitMoney_(sm.posTotal)+' · phần của sale <b>'+splitMoney_(sm.posShare)+'</b>')+'</div>';
  if (m.tab==='pos' && sm.check){ var ck = sm.check; h += '<div style="font-size:12px;margin-bottom:8px;display:flex;gap:12px;flex-wrap:wrap"><span style="color:var(--red);font-weight:700">🔴 '+splitNum_(ck.lech)+' đơn LỆCH Base</span><span style="color:var(--green,#15803d)">🟢 '+splitNum_(ck.khop)+' khớp</span><span style="color:var(--muted)">⚪ '+splitNum_(ck.khongCoBase)+' không có đơn Base để đối chiếu</span>'+(ck.goiY?'<span style="color:var(--muted)">('+splitNum_(ck.goiY)+' đơn đối chiếu theo gợi ý SĐT + ngày, cần kế toán xác nhận)</span>':'')+'</div>'; }
  if (!rows.length) h += '<div class="split-msg">'+(m.tab==='base' ? 'Không có đơn gốc Base nào trong kỳ này (đơn chia của sale này không ghép với đơn Base).' : (m.onlyLech ? 'Không có đơn nào lệch Base.' : 'Không có đơn chia nào trong kỳ này.'))+'</div>';
  else {
    var money = m.tab==='base' ? {7:1,8:1} : {7:1,8:1,9:1};
    h += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr>'+head.map(function(t,i){ return '<th'+(money[i]?' class="r"':'')+'>'+splitEsc_(t)+'</th>'; }).join('')+'</tr></thead><tbody>';
    rows.forEach(function(r){ h += '<tr>'+r.map(function(c,i){
      if (money[i]) return '<td class="r">'+(c===''||c==null?'':(i===8?'<b>'+splitMoney_(c)+'</b>':splitMoney_(c)))+'</td>';
      if (m.tab==='pos' && i===10) return '<td style="font-weight:700;color:'+(/^LỆCH/.test(c)?'var(--red)':/^Khớp/.test(c)?'var(--green,#15803d)':'var(--muted)')+'">'+splitEsc_(c)+'</td>';
      if (m.tab==='pos' && (i===12||i===13) && c) return '<td style="color:var(--red);font-weight:600">'+splitEsc_(c)+'</td>';
      if (m.tab==='pos' && i===15) return '<td>'+(r.fbKey ? '<input type="text" class="split-fb" data-fb-key="'+splitEsc_(r.fbKey)+'" value="'+splitEsc_(c)+'" maxlength="500" placeholder="Sale phản hồi…" style="min-width:220px;width:100%">' : splitEsc_(c))+'</td>';
      if (m.tab==='base' && i===9) return '<td style="color:'+(/^Tham chiếu/.test(c)?'var(--muted)':'inherit')+'">'+splitEsc_(c)+'</td>';
      return '<td>'+((i===2||i===3) && typeof _custLinkHtml_==='function' ? _custLinkHtml_(r[3], splitEsc_(c)) : splitEsc_(c))+'</td>'; }).join('')+'</tr>'; });
    h += '<tr style="font-weight:700;background:var(--surface2)"><td colspan="7">Tổng ('+splitNum_(rows.length)+' dòng'+(m.tab==='base'&&sm.baseRefOrders?' — dòng "Tham chiếu" không cộng vào tổng':'')+')</td><td class="r">'+splitMoney_(m.tab==='base'?sm.baseTotal:sm.posTotal)+'</td><td class="r">'+splitMoney_(m.tab==='base'?sm.baseShare:sm.posShare)+'</td>'+new Array(head.length-8).join('<td></td>')+'</tr></tbody></table></div>';
  }
  h += '<div style="font-size:10.5px;color:var(--hint);margin-top:6px">'
    + (m.tab==='base' ? 'Mỗi dòng = 1 đơn gốc Base đã ghép với đơn Pos (ngày/tháng = ngày lên đơn trên Base; tên KH, SĐT lấy từ đơn Pos). Doanh thu sau chia = giá trị đơn Base ÷ số sale bán đơn đó (đơn quầy 30/70 nhân 30%). '
        + (sm.baseRefOrders?'<b>'+splitNum_(sm.baseRefOrders)+'</b> dòng "Tham chiếu" = đơn Base tìm thấy cho đơn Pos không ghép (theo mã bộ đếm hoặc gợi ý theo SĐT + ngày) chỉ để đối chiếu thẻ sale, KHÔNG tính vào doanh thu chia. ':'')+(sm.noBaseOrders?'<b>'+splitNum_(sm.noBaseOrders)+'</b> đơn chia của sale này KHÔNG có đơn gốc Base (chia theo thẻ sale / file kế toán / quầy) — xem ở Chi tiết Pos.':'')
      : 'Mỗi dòng = 1 đơn Pos có ≥2 sale cùng chia. Tổng doanh thu = số được tính trong báo cáo (đơn ghép Base dùng tổng các đơn gốc Base; cột "Giá đơn Pos gốc" hiện giá Pos khi khác). Doanh thu sau chia khớp cột "Doanh thu từ đơn chia" ở bảng trên.')
    + (d.truncated?' · Danh sách quá dài nên chỉ hiện '+splitNum_(3000)+' dòng đầu — thu hẹp khoảng ngày.':'')+'</div></div>';
  return h;
}
function splitCsvRows_(d){
  var rows = [['Sale','Tổng đơn','Doanh thu','TB/đơn','Số đơn chia','Doanh thu từ đơn chia','TB/đơn chia','% doanh thu từ đơn chia']];
  (d.bySale||[]).forEach(function(r){ rows.push([r.name,r.orders,r.revenue,r.aov,r.splitOrders,r.splitRevenue,r.splitAov,r.splitPct===null?'':r.splitPct]); });
  var t = d.total||{}; rows.push(['TỔNG THỰC TẾ',t.orders,t.revenue,t.aov,t.splitOrders,t.splitRevenue,t.splitAov,t.splitPctRevenue===null?'':t.splitPctRevenue]);
  return rows;
}

// ── Danh sách đơn chia (lọc nguồn dữ liệu) ──
var _split = { quick:'thisMonth', from:'', to:'', data:null, phones:null, loading:false, loaded:false, error:'' };
function splitRangeFromQuick_(){
  if (_split.quick!=='custom' && typeof _pkQuickRange==='function'){ var r = _pkQuickRange(_split.quick); if (r){ _split.from = r.from; _split.to = r.to; } }
}
function splitCustomerPass_(c){
  if (!_split.phones) return false;
  return _split.phones.has(c.phone) || _split.phones.has(splitPhoneKey_(c.phone));
}
async function splitMineLoad_(force){
  if (_split.loading) return;
  if (_split.loaded && !force) { splitBannerRender_(); return; }
  _split.loading = true; _split.error = ''; splitBannerRender_();
  splitRangeFromQuick_();
  try {
    var sep = gsUrl.indexOf('?')>=0 ? '&' : '?';
    var r = await fetch(gsUrl+sep+'action=splitOrderMine&dateFrom='+encodeURIComponent(_split.from||'')+'&dateTo='+encodeURIComponent(_split.to||''), { redirect:'follow' });
    var d = await r.json();
    _split.data = d;
    _split.phones = new Set(); if (d && d.ok!==false) (d.items||[]).forEach(function(it){ if (it.phone) _split.phones.add(it.phone); });
    if (d && d.ok===false && d.code==='AUTH') _split.error = d.error;
  } catch(e){ _split.data = null; _split.phones = new Set(); _split.error = 'Không tải được đơn chia (mất kết nối?).'; }
  _split.loading = false; _split.loaded = true;
  splitBannerRender_();
  if (typeof applyFilters==='function') applyFilters();
}
function splitSetQuick_(key){ _split.quick = key; _split.loaded = false; if (key!=='custom') splitMineLoad_(true); else splitBannerRender_(); }
function splitBannerEl_(create){
  var el = document.getElementById('split-banner');
  if (!el && create){ var tb = document.querySelector('#tab-list .toolbar'); if (!tb) return null; el = document.createElement('div'); el.id = 'split-banner'; el.className = 'split-banner'; tb.parentNode.insertBefore(el, tb.nextSibling);
    el.onclick = function(e){ var tr = e.target.closest && e.target.closest('[data-split-phone]'); if (!tr) return; var ph = tr.getAttribute('data-split-phone'), k = splitPhoneKey_(ph);
      var c = (typeof allCustomers!=='undefined') ? allCustomers.find(function(x){ return x.phone===ph || splitPhoneKey_(x.phone)===k; }) : null;
      if (typeof _openCustomerByPhone_==='function'){ _openCustomerByPhone_(c ? c.phone : ph); return; }   // 2026-10-23: nạp được cả khách ngoài danh sách
      if (c && typeof openDp==='function'){ var ov = document.getElementById('dp-overlay'); if (ov) ov.classList.add('open'); openDp(c.phone); } }; }
  return el;
}
function splitBannerRender_(){ var el = splitBannerEl_(true); if (el) el.innerHTML = splitBannerHtml_(_split.data, _split); }
// applyFilters (js/02) gọi mỗi lần lọc: bật/tắt banner theo mục nguồn dữ liệu và tự tải lần đầu (kể cả khi khôi phục bộ lọc đã lưu)
function splitBannerSync_(srcValue){
  var el = document.getElementById('split-banner');
  if (srcValue!=='split'){ if (el) el.style.display = 'none'; return; }
  el = splitBannerEl_(true); if (!el) return; el.style.display = '';
  if (!_split.loaded && !_split.loading) splitMineLoad_(false); else if (!el.innerHTML) splitBannerRender_();
}

// ── Báo cáo M ──
if (typeof _srState!=='undefined'){ _srState.mDateQuick = _srState.mDateQuick || 'thisMonth'; _srState.mDateFrom = _srState.mDateFrom || ''; _srState.mDateTo = _srState.mDateTo || ''; _srState.mSearch = _srState.mSearch || ''; if (_srState.dataM===undefined) _srState.dataM = null; if (_srState.mSel===undefined) _srState.mSel = null; }
async function splitReportLoad_(){
  if (_srState.mDateQuick && _srState.mDateQuick!=='custom' && typeof _pkQuickRange==='function'){ var r = _pkQuickRange(_srState.mDateQuick); if (r){ _srState.mDateFrom = r.from; _srState.mDateTo = r.to; } }
  _srState.mSel = null;   // đổi kỳ/lọc lại -> chi tiết cũ không còn đúng kỳ, đóng lại
  _srState.dataM = await _srFetch('splitOrderReport', { dateFrom:_srState.mDateFrom, dateTo:_srState.mDateTo });
}
function renderSalesReportTabM_(wrap, subTabs){
  var quick = (typeof _quickRangeSelectHtml==='function') ? _quickRangeSelectHtml(_srState.mDateQuick, "_srApplyQuickRange('mDateQuick','mDateFrom','mDateTo',this.value)") : '';
  var bar = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'+subTabs+quick
    +'<input type="date" value="'+splitEsc_(_srState.mDateFrom)+'" onchange="_srState.mDateFrom=this.value;_srState.mDateQuick=\'custom\'" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px"> – '
    +'<input type="date" value="'+splitEsc_(_srState.mDateTo)+'" onchange="_srState.mDateTo=this.value;_srState.mDateQuick=\'custom\'" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px">'
    +'<button type="button" class="btn sm primary" onclick="_srLoad()">Lọc</button>'
    +'<input type="text" value="'+splitEsc_(_srState.mSearch)+'" placeholder="🔍 Tìm tên sale…" oninput="_srState.mSearch=this.value;_srMRerender_()" style="padding:5px 9px;border:1px solid var(--border);border-radius:6px;min-width:160px">'
    +'<button type="button" class="btn sm" onclick="_srMExportCsv_()">⬇ CSV</button>'
    +'<button type="button" class="btn sm" onclick="_srMExportAllXlsx_()" title="Tải chi tiết từng sale có đơn chia rồi gộp 1 file Excel: Tổng hợp · Pos · Base (có cột Sale, đối chiếu Base, Sale phản hồi)">📥 Excel đối soát TẤT CẢ sale</button></div>';
  wrap.innerHTML = bar + '<div id="sr-m-body">' + (_srState.loading ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải…</div>' : splitReportHtml_(_srState.dataM, _srState.mSearch, _srState.mSel&&_srState.mSel.sale)+splitDetailPanelHtml_(_srState.mSel)) + '</div>';
  var bd = document.getElementById('sr-m-body'); if (bd){ bd.onclick = _srMClick_; bd.onchange = _srMFbChange_; }
}
function _srMRerender_(){ var el = document.getElementById('sr-m-body'); if (el) el.innerHTML = splitReportHtml_(_srState.dataM, _srState.mSearch, _srState.mSel&&_srState.mSel.sale)+splitDetailPanelHtml_(_srState.mSel); }
function splitDetailXlsxSheets_(det){   // [{name, rows:[[header],[...]]}] — sheet 1 = Base, sheet 2 = Pos
  return [{ name:'Base', rows:[SPLIT_DET_BASE_HEAD].concat(splitDetRows_(det,'base')) }, { name:'Pos', rows:[SPLIT_DET_POS_HEAD].concat(splitDetRows_(det,'pos')) }];
}
// ── Xuất Excel đối soát cho TẤT CẢ sale 1 lần (Duyên yêu cầu 2026-10-24) ──
// list = [{sale, data}] (data = kết quả splitOrderDetail của từng sale), errors = [{sale, error}]. Sheet: Tổng hợp (mỗi sale 1 dòng) · Pos · Base (thêm cột "Sale" đầu bảng) · Lỗi (nếu có sale tải hỏng).
var SPLIT_ALL_SUM_HEAD = ['Sale','Số đơn Pos chia','Phần chia (Pos)','Số dòng Base ghép','Phần chia (Base ghép)','LỆCH Base','Khớp Base','Không có Base','Gợi ý theo SĐT','Có Sale phản hồi'];
function splitAllXlsxSheets_(list, errors){
  var sum = [SPLIT_ALL_SUM_HEAD], pos = [['Sale'].concat(SPLIT_DET_POS_HEAD)], base = [['Sale'].concat(SPLIT_DET_BASE_HEAD)];
  (list||[]).forEach(function(it){
    var d = it.data || {}, sm = d.summary || {}, ck = sm.check || {}, fb = (d.pos||[]).filter(function(x){ return x.feedback; }).length;
    sum.push([it.sale, sm.posOrders||0, sm.posShare||0, sm.baseOrders||0, sm.baseShare||0, ck.lech||0, ck.khop||0, ck.khongCoBase||0, ck.goiY||0, fb]);
    splitDetRows_(d,'pos').forEach(function(r){ pos.push([it.sale].concat(r)); });
    splitDetRows_(d,'base').forEach(function(r){ base.push([it.sale].concat(r)); });
  });
  var out = [{ name:'Tong hop', rows:sum }, { name:'Pos', rows:pos }, { name:'Base', rows:base }];
  if (errors && errors.length) out.push({ name:'Loi', rows:[['Sale','Lỗi']].concat(errors.map(function(e){ return [e.sale, e.error]; })) });
  return out;
}
var _srAllBusy = false;
async function _srMExportAllXlsx_(){
  var dm = _srState.dataM; if (!dm || !dm.bySale){ if (typeof toast==='function') toast('Chưa có dữ liệu — bấm "Lọc" trước.'); return; }
  if (typeof XLSX==='undefined'){ if (typeof toast==='function') toast('Thư viện Excel chưa tải xong — đợi vài giây rồi bấm lại.'); return; }
  if (_srAllBusy) return;
  var sales = (dm.bySale||[]).filter(function(r){ return (Number(r.splitOrders)||0) > 0; }).map(function(r){ return r.name; });
  if (!sales.length){ if (typeof toast==='function') toast('Không có sale nào có đơn chia trong kỳ này.'); return; }
  _srAllBusy = true;
  var list = [], errors = [], done = 0, next = 0, from = dm.from||_srState.mDateFrom, to = dm.to||_srState.mDateTo;
  var say = function(){ if (typeof toast==='function') toast('Đang tải đối soát '+done+'/'+sales.length+' sale…'); };
  async function worker(){
    while (next < sales.length){
      var sale = sales[next++];
      try { var d = await _srFetch('splitOrderDetail', { dateFrom:from, dateTo:to, sale:sale });
        if (!d || d.ok===false || d.error) errors.push({ sale:sale, error:(d && d.error) || _srState.lastFetchError || 'Không tải được' }); else list.push({ sale:sale, data:d });
      } catch (e) { errors.push({ sale:sale, error:String(e && e.message || e) }); }
      done++; if (done % 3 === 0 || done === sales.length) say();
    }
  }
  try {
    say(); await Promise.all([worker(), worker()]);
    list.sort(function(a,b){ return sales.indexOf(a.sale) - sales.indexOf(b.sale); });
    var wb = XLSX.utils.book_new(), widths = { 'Tong hop':[22,14,18,16,20,12,12,14,14,16], Pos:[20].concat([12,12,22,14,34,24,40,16,16,18,26,26,26,26,18,30]), Base:[20].concat([12,12,22,14,16,26,40,16,16,28]) };
    splitAllXlsxSheets_(list, errors).forEach(function(sh){ var ws = XLSX.utils.aoa_to_sheet(sh.rows); ws['!cols'] = (widths[sh.name]||[24,60]).map(function(w){ return { wch:w }; }); XLSX.utils.book_append_sheet(wb, ws, sh.name); });
    XLSX.writeFile(wb, 'DoiSoat_DonChia_TatCaSale_'+(from||'')+'_'+(to||'')+'.xlsx');
    if (typeof toast==='function') toast('Đã xuất đối soát '+list.length+' sale'+(errors.length?(' — '+errors.length+' sale lỗi (xem sheet Loi)'):'')+'.');
  } finally { _srAllBusy = false; }
}
function _srMExportXlsx_(){
  var m = _srState.mSel, d = m && m.data;
  if (!d){ if (typeof toast==='function') toast('Chưa có chi tiết — bấm vào 1 sale để tải.'); return; }
  if (typeof XLSX==='undefined'){ if (typeof toast==='function') toast('Thư viện Excel chưa tải xong — đợi vài giây rồi bấm lại.'); return; }
  var wb = XLSX.utils.book_new(), widths = { Base:[12,12,22,14,16,26,40,16,16,28], Pos:[12,12,22,14,34,24,40,16,16,18,26,26,26,26,18,30] };
  splitDetailXlsxSheets_(d).forEach(function(sh){ var ws = XLSX.utils.aoa_to_sheet(sh.rows); ws['!cols'] = (widths[sh.name]||[]).map(function(w){ return { wch:w }; }); XLSX.utils.book_append_sheet(wb, ws, sh.name); });
  var nm = String(m.sale||'sale').replace(/[\\/:*?"<>|]+/g,'_').trim();
  XLSX.writeFile(wb, 'DoiSoat_DonChia_'+nm+'_'+(d.from||'')+'_'+(d.to||'')+'.xlsx');
}
function _srMOpen_(sale, tab){
  var m = _srState.mSel;
  if (m && m.sale===sale){ if (tab) m.tab = tab; _srMRerender_(); return; }
  _srState.mSel = { sale:sale, tab:tab||'pos', data:null, loading:true, error:'', seq:((m&&m.seq)||0)+1 };
  _srMRerender_(); _srMLoadDetail_();
}
async function _srMLoadDetail_(){
  var m = _srState.mSel; if (!m) return; var seq = m.seq, dm = _srState.dataM||{};
  var d = await _srFetch('splitOrderDetail', { dateFrom:dm.from||_srState.mDateFrom, dateTo:dm.to||_srState.mDateTo, sale:m.sale });
  var cur = _srState.mSel; if (!cur || cur.seq!==seq) return;   // đã chọn sale khác / đóng trong lúc chờ
  cur.loading = false;
  if (!d) cur.error = _srState.lastFetchError || 'Không tải được chi tiết (mất kết nối?).';
  else if (d.ok===false || d.error) cur.error = d.error || 'Lỗi tải chi tiết.';
  else cur.data = d;
  _srMRerender_();
}
// Ô "Sale phản hồi" (tab Pos): lưu khi rời ô / Enter. Lỗi (không đủ quyền, mất mạng) → báo + giữ chữ để thử lại.
async function _srMFbChange_(e){
  var t = e && e.target; if (!t || !t.classList || !t.classList.contains('split-fb')) return;
  var m = _srState.mSel, d = m && m.data; if (!d) return;
  var key = t.getAttribute('data-fb-key'), text = t.value, item = (d.pos||[]).filter(function(x){ return x.fbKey===key; })[0];
  t.style.outline = '2px solid #f59e0b';
  try{
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'splitFeedbackSave', key:key, sale:m.sale, text:text }) });
    var j = await r.json();
    if (!j || j.ok===false || j.error) throw new Error((j && j.error) || 'Không lưu được.');
    if (item){ item.feedback = j.text; item.feedbackBy = j.by; item.feedbackAt = j.at; }
    t.value = j.text; t.style.outline = '2px solid #16a34a'; t.title = 'Đã lưu bởi '+(j.by||'')+' lúc '+(j.at||'');
    setTimeout(function(){ if (t.style) t.style.outline = ''; }, 1500);
  }catch(err){
    t.style.outline = '2px solid #dc2626';
    if (typeof toast==='function') toast('⚠ Chưa lưu được phản hồi: '+(err && err.message || err));
  }
}
function _srMClick_(e){
  var t = e.target; if (!t || !t.closest) return;
  var x = t.closest('[data-m-xlsx]'); if (x){ _srMExportXlsx_(); return; }
  if (t.closest('[data-m-lech]') && _srState.mSel){ _srState.mSel.onlyLech = !_srState.mSel.onlyLech; _srMRerender_(); return; }
  if (t.closest('[data-m-close]')){ _srState.mSel = null; _srMRerender_(); return; }
  var tb = t.closest('[data-m-tab]'); if (tb && _srState.mSel){ _srState.mSel.tab = tb.getAttribute('data-m-tab'); _srMRerender_(); return; }
  var tr = t.closest('[data-m-sale]'); if (!tr) return;
  var vb = t.closest('[data-m-view]');
  _srMOpen_(tr.getAttribute('data-m-sale'), vb ? vb.getAttribute('data-m-view') : 'pos');
  var el = document.getElementById('sr-m-detail'); if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch(e0){} }
}
function _srMExportCsv_(){
  var d = _srState.dataM; if (!d || !d.bySale){ if (typeof toast==='function') toast('Chưa có dữ liệu — bấm "Lọc" trước.'); return; }
  if (typeof _srGDownloadCsv_==='function') _srGDownloadCsv_('Bao-cao-don-chia_'+(d.from||'')+'_'+(d.to||'')+'.csv', splitCsvRows_(d));
}
if (typeof module!=='undefined') module.exports = { splitAllXlsxSheets_, _srMExportAllXlsx_, _srMFbChange_, splitPhoneKey_, splitBannerHtml_, splitDetailHtml_, splitReportHtml_, splitCsvRows_, splitCustomerPass_, splitDetailPanelHtml_, splitDetailXlsxSheets_, _split };

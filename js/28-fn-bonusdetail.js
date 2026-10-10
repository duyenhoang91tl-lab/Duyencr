// ════════════════════════════════════════════════════════════════════
//  TAB "CHI TIẾT THƯỞNG (ĐẾM SẢN PHẨM)" — _srState.sub === 'K' (yêu cầu Duyên 2026-10-10)
//  Liệt kê từng DÒNG sản phẩm của các đơn GỐC (STT, tên sale, ngày lên đơn Base, mã bộ đếm, mã SP, SL, doanh thu).
//  Duyên tích: gom SP 1,2,… / Không tính / Quà, và ô "Vòng chuỗi" / "Charm mix" cho từng mã.
//  LƯU: theo MÃ sản phẩm → BONUS_PRODUCT_MAP (áp cho mọi đơn sau); tinh chỉnh riêng từng đơn → BONUS_ORDER_OVR (slot SP, doanh thu dòng).
//  Cả 2 lưu local (ome_bonus_prodmap / ome_bonus_orderovr) + Settings GAS (bonusProductMap / bonusOrderOvr) qua getSetting/setSetting.
//  Lõi đếm: js/27-fn-bonuscore.js (bản sao trong gas_v13.js — khối "BONUS CORE").
// ════════════════════════════════════════════════════════════════════
var _bdState = { onlyReview:false, limit:120, search:'', rows:[] };

async function _bdSyncFromGAS(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  var pairs = [['bonusProductMap','ome_bonus_prodmap','BONUS_PRODUCT_MAP'], ['bonusOrderOvr','ome_bonus_orderovr','BONUS_ORDER_OVR']];
  for (var i=0;i<pairs.length;i++){
    try {
      var r = await fetch(gsUrl + '?action=getSetting&key=' + pairs[i][0], {redirect:'follow'});
      var d = await r.json();
      if (d && d.value){
        var obj = JSON.parse(d.value);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)){
          if (pairs[i][2] === 'BONUS_PRODUCT_MAP') BONUS_PRODUCT_MAP = obj; else BONUS_ORDER_OVR = obj;
          saveLS(pairs[i][1], obj);
        }
      }
    } catch(e){ /* giữ bản local nếu lỗi mạng/parse */ }
  }
  if (typeof _srState !== 'undefined' && (_srState.sub === 'K' || _srState.sub === 'E' || _srState.sub === 'G')) renderSalesReportTab();
}
async function _bdPersist_(which){
  var isMap = which === 'map';
  var obj = isMap ? BONUS_PRODUCT_MAP : BONUS_ORDER_OVR;
  saveLS(isMap ? 'ome_bonus_prodmap' : 'ome_bonus_orderovr', obj);
  if (typeof gsUrl !== 'undefined' && gsUrl){
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key: isMap ? 'bonusProductMap' : 'bonusOrderOvr', value: JSON.stringify(obj) }) });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
    } catch(e){ toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
  }
}
setTimeout(_bdSyncFromGAS, 1500);

// ── Thao tác tích (gọi từ onchange/onclick trong bảng) ──
function _bdEntry_(code){ var k = String(code||'').toLowerCase(); return BONUS_PRODUCT_MAP[k] || (BONUS_PRODUCT_MAP[k] = {}); }
function _bdFlag(code, flag, on){
  var e = _bdEntry_(code);
  e.vong = e.charm = e.skip = e.gift = false;
  if (on) e[flag] = true;
  _bdPersist_('map'); renderSalesReportTab();
}
function _bdConfirm(code, cls){   // "Xác nhận" = lưu loại hiện tại của mã để lần sau tự áp dụng
  var e = _bdEntry_(code);
  e.vong = (cls === 'vong'); e.charm = (cls === 'charm'); e.skip = (cls === 'skip'); e.gift = (cls === 'gift');
  _bdPersist_('map'); renderSalesReportTab();
}
function _bdSlot(counter, code, val){
  var k = counter + '|' + String(code||'').toLowerCase();
  if (val === 'skip' || val === 'gift'){   // Không tính / Quà: lưu THEO MÃ (áp mọi đơn sau)
    var e = _bdEntry_(code); e.vong = e.charm = e.skip = e.gift = false; e[val] = true;
    if (BONUS_ORDER_OVR[k]) delete BONUS_ORDER_OVR[k].slot;
    _bdPersist_('map');
  } else {
    var o = BONUS_ORDER_OVR[k] || (BONUS_ORDER_OVR[k] = {});
    if (val) o.slot = val; else delete o.slot;
    if (val){ var e2 = BONUS_PRODUCT_MAP[String(code||'').toLowerCase()]; if (e2 && (e2.skip || e2.gift)){ e2.skip = e2.gift = false; _bdPersist_('map'); } }
    if (!Object.keys(o).length) delete BONUS_ORDER_OVR[k];
  }
  _bdPersist_('ovr'); renderSalesReportTab();
}
function _bdRev(counter, code, val){
  var k = counter + '|' + String(code||'').toLowerCase(), o = BONUS_ORDER_OVR[k] || (BONUS_ORDER_OVR[k] = {});
  var n = Number(String(val||'').replace(/[^\d.-]/g,''));
  if (val === '' || !isFinite(n)) delete o.rev; else o.rev = n;
  if (!Object.keys(o).length) delete BONUS_ORDER_OVR[k];
  _bdPersist_('ovr'); renderSalesReportTab();
}

// ── Dựng danh sách đơn cho tab ──
function _bdBuild_(d){
  var orders = (d && d.orders) || [];
  var hasGoc = orders.some(function(o){ return !!o.baseNgayTao; });
  var out = [];
  orders.forEach(function(o){
    if (hasGoc && !o.donGoc) return;                 // chỉ đơn gốc có mã bộ đếm sale + có trên Pos
    var info = _bcOrderInfo_(Object.assign({}, o, { giaTriDon: o.giaTriDon != null ? o.giaTriDon : o.giaTriSauGiam }));
    if (!info.counter) return;
    out.push({ o:o, info:info, date:(o.baseNgayTao || _ddmmyyyyToYmd_(o.ngayTaoDon || o.ngayTao)), sale:String(o.saleBanValid != null ? o.saleBanValid : (o.saleBan||'')).split(',').map(function(x){return x.trim();}).filter(Boolean).join(', ') });
  });
  out.sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.info.counter < b.info.counter ? -1 : 1); });
  return out;
}
var _BD_CLS_LABEL = { vong:'Vòng chuỗi', charm:'Charm mix', prod:'Sản phẩm', skip:'Không tính', gift:'Quà' };
function _bdSelectHtml_(counter, code, l){
  var cur = l.cls === 'skip' ? 'skip' : (l.cls === 'gift' ? 'gift' : (l.slot || ''));
  var opts = [['', 'Tự động']].concat([1,2,3,4,5,6].map(function(n){ return [String(n), 'SP '+n]; })).concat([['skip','Không tính'],['gift','Quà']]);
  return '<select onchange="_bdSlot(\''+esc(counter)+'\',\''+esc(code)+'\',this.value)" style="padding:2px 4px;font-size:11.5px">'+
    opts.map(function(x){ return '<option value="'+x[0]+'"'+(String(cur)===x[0] ? ' selected' : '')+'>'+x[1]+'</option>'; }).join('')+'</select>';
}
function _bdExportRows_(list){
  var rows = [['STT','Tên sale','Ngày lên đơn (Base)','Mã bộ đếm','Mã sản phẩm','Tên sản phẩm','Số lượng','Doanh thu đơn','Phân loại','Số sản phẩm của đơn','Doanh thu phần vòng + charm mix','Cần kiểm tra']];
  var stt = 0;
  list.forEach(function(x){
    x.info.lines.forEach(function(l, i){
      stt++;
      rows.push([stt, x.sale, x.date, x.info.counter, l.code, l.name, l.qty, i === 0 ? x.info.total : '', _BD_CLS_LABEL[l.cls] + (l.slot && /^\d+$/.test(l.slot) ? ' (SP '+l.slot+')' : '') + (l.auto ? ' — tự đoán' : ''), i === 0 ? x.info.nProducts : '', i === 0 ? (x.info.vongRev === null ? '' : x.info.vongRev) : '', i === 0 ? x.info.reasons.join(' / ') : '']);
    });
  });
  return rows;
}
function _bdExportXlsx(){
  var list = _bdState.rows || [];
  if (!list.length){ toast('Chưa có dữ liệu — bấm "Lọc" trước.'); return; }
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, _srGSheet_(_bdExportRows_(list)), 'Chi tiết đếm sản phẩm');
  XLSX.writeFile(wb, 'ChiTiet_DemSanPham_' + (_srState.gDateFrom || 'tu-dau') + '_' + (_srState.gDateTo || 'den-nay') + '.xlsx');
  toast('📗 Đã xuất Excel chi tiết đếm sản phẩm');
}

function _bdRenderBody_(d){
  if (!d) return _srNoDataHtml_();
  if (d.error) return '<div style="color:#dc2626;text-align:center;padding:30px">Lỗi: '+esc(d.error)+'</div>';
  var all = _bdBuild_(d);
  var q = _bcFold_(_bdState.search);
  var list = all.filter(function(x){
    if (_bdState.onlyReview && !(x.info.needReview || x.info.unconfirmed)) return false;
    if (q && _bcFold_(x.info.counter + ' ' + x.sale + ' ' + x.info.lines.map(function(l){ return l.code + ' ' + l.name; }).join(' ')).indexOf(q) === -1) return false;
    return true;
  });
  _bdState.rows = list;
  var nReview = all.filter(function(x){ return x.info.needReview; }).length, nUnc = all.filter(function(x){ return x.info.unconfirmed; }).length;
  var html = '';
  html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'+
    '<input type="text" placeholder="🔍 Tìm mã đếm / sale / mã SP..." value="'+esc(_bdState.search)+'" oninput="_bdState.search=this.value;_bdState.limit=120;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:230px">'+
    '<label style="font-size:12px"><input type="checkbox" '+(_bdState.onlyReview?'checked':'')+' onchange="_bdState.onlyReview=this.checked;_bdState.limit=120;renderSalesReportTab()"> Chỉ đơn cần kiểm tra / chưa xác nhận</label>'+
    '<span style="font-size:12px;color:var(--muted)">'+fmt(all.length)+' đơn gốc · <b style="color:#9a3412">'+fmt(nReview)+'</b> cần nhập doanh thu/kiểm tra · '+fmt(nUnc)+' có mã chưa xác nhận</span>'+
    '<button class="btn sm" onclick="_bdExportXlsx()">📗 Xuất Excel (có ngày)</button></div>';
  html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>STT</th><th>Tên sale</th><th>Ngày lên đơn</th><th>Mã bộ đếm</th><th>Mã sản phẩm</th><th style="text-align:right">SL</th><th style="text-align:right">Doanh thu</th>'+
    '<th>Gom / loại</th><th title="Vòng chuỗi" style="text-align:center">Vòng chuỗi</th><th title="Charm mix" style="text-align:center">Charm mix</th><th style="text-align:right" title="Chỉ cần cho dòng sản phẩm của đơn vòng ≥15tr — để tính mốc phần vòng + charm mix">DT dòng</th><th></th></tr></thead><tbody>';
  var stt = 0, shown = 0;
  for (var i = 0; i < list.length && shown < _bdState.limit; i++, shown++){
    var x = list[i], c = x.info.counter;
    html += '<tr style="background:var(--surface2)"><td colspan="12"><b>'+esc(c)+'</b> · '+esc(x.date)+' · '+esc(x.sale)+' · DT đơn <b>'+_srMoney(x.info.total)+'</b> · <b>'+x.info.nProducts+' sản phẩm</b>'+
      (x.info.hasVong ? ' · phần vòng + charm mix: <b>'+(x.info.vongRev === null ? '—' : _srMoney(x.info.vongRev))+'</b>' : '')+
      (x.info.reasons.length ? ' <span style="color:#9a3412">⚠ '+esc(x.info.reasons.join(' / '))+'</span>' : '')+'</td></tr>';
    x.info.lines.forEach(function(l){
      stt++;
      var isV = l.cls === 'vong', isC = l.cls === 'charm';
      html += '<tr><td>'+stt+'</td><td>'+esc(x.sale)+'</td><td>'+esc(x.date)+'</td><td>'+esc(c)+'</td>'+
        '<td title="'+esc(l.name)+'">'+esc(l.code)+(l.name ? '<div style="font-size:10.5px;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l.name)+'</div>' : '')+(l.auto ? ' <i style="color:#9a3412;font-size:10.5px">(tự đoán: '+esc(_BD_CLS_LABEL[l.cls])+')</i>' : '')+'</td>'+
        '<td style="text-align:right">'+fmt(l.qty)+'</td><td style="text-align:right">'+(l.rev !== null ? _srMoney(l.rev) : '')+'</td>'+
        '<td>'+_bdSelectHtml_(c, l.code, l)+'</td>'+
        '<td style="text-align:center"><input type="checkbox" '+(isV?'checked':'')+' onchange="_bdFlag(\''+esc(l.code)+'\',\'vong\',this.checked)"></td>'+
        '<td style="text-align:center"><input type="checkbox" '+(isC?'checked':'')+' onchange="_bdFlag(\''+esc(l.code)+'\',\'charm\',this.checked)"></td>'+
        '<td style="text-align:right">'+(l.cls === 'prod' ? '<input type="text" value="'+(l.rev !== null ? l.rev : '')+'" placeholder="đ" onchange="_bdRev(\''+esc(c)+'\',\''+esc(l.code)+'\',this.value)" style="width:90px;text-align:right;font-size:11.5px">' : '')+'</td>'+
        '<td>'+(l.auto ? '<button class="btn sm" title="Lưu loại hiện tại của mã này, áp cho mọi đơn sau" onclick="_bdConfirm(\''+esc(l.code)+'\',\''+l.cls+'\')">✔</button>' : '<span style="color:#16a34a" title="Đã lưu theo mã">✔</span>')+'</td></tr>';
    });
  }
  if (!list.length) html += '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:14px">Không có đơn gốc nào trong khoảng lọc (hoặc backend GAS chưa deploy bản mới)</td></tr>';
  html += '</tbody></table></div>';
  if (list.length > shown) html += '<div style="margin-top:8px"><button class="btn sm" onclick="_bdState.limit+=120;renderSalesReportTab()">Xem thêm ('+fmt(list.length-shown)+' đơn)</button></div>';
  return html;
}
function renderSalesReportTabK_(wrap, subTabs){
  var body = _srState.loading ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>' : _bdRenderBody_(_srState.dataG);
  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + _srGFiltersHtml_() +
    '<div style="margin-bottom:10px"><button class="btn sm" onclick="_srSetSub(\'G\')">← Về báo cáo thưởng</button></div>' + body;
}

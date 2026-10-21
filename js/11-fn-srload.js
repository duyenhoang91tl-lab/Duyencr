async function _srLoad(){
  if (_srState.sub === 'H'){
    // H tinh hoan toan client (assignHistory + careData) — khong goi GAS; chi keo so don/doanh thu nhap tay cua cac thang trong khoang.
    if (_srState.hDateQuick && _srState.hDateQuick !== 'custom'){
      var rH2 = _pkQuickRange(_srState.hDateQuick);
      if (rH2){ _srState.hDateFrom = rH2.from; _srState.hDateTo = rH2.to; }
    }
    _srState.loading = false;
    renderSalesReportTab();
    _hLoadManual_();
    _hLoadChot_();
    return;
  }
  _srState.loading = true;
  renderSalesReportTab();
  if (_srState.sub === 'A'){
    _srState.dataA = await _srFetch('salesReportA', {
      dateFrom: _srState.dateFrom, dateTo: _srState.dateTo,
      dateField: _srState.dateField, sale: (_srState.sale||[]).join(','), kenh: (_srState.kenh||[]).join(','),
      sanPham: _srState.aSanPham || '',
      byCreator: _srState.byCreator ? '1' : ''
    });
  } else if (_srState.sub === 'B') {
    _srState.dataB = await _srFetch('salesReportB', {
      dateFrom: _srState.dateFrom, dateTo: _srState.dateTo,
      sale: (_srState.bSale||[]).join(','), nguon: (_srState.bNguon||[]).join(','), marketer: (_srState.bMarketer||[]).join(','),
      sanPham: _srState.bSanPham || '',
      careStatus: (_srState.bCareStatus||[]).join(','), khStatus: (_srState.bKhStatus||[]).join(','),
      zaloStatus: (_srState.bZaloStatus||[]).join(','), nickZalo: _srState.bNickZalo || ''
    });
  } else if (_srState.sub === 'C') {
    _srState.dataC = await _srFetch('salesReportC', {
      dateField: _srState.cDateField, periodType: _srState.cPeriodType,
      weekOffset: _srState.cWeekOffset, monthOffset: _srState.cMonthOffset, quarterOffset: _srState.cQuarterOffset, yearOffset: _srState.cYearOffset,
      customCurFrom: _srState.cCustomCurFrom, customCurTo: _srState.cCustomCurTo,
      customPrevFrom: _srState.cCustomPrevFrom, customPrevTo: _srState.cCustomPrevTo,
      sale: (_srState.cSale||[]).join(','), kenh: (_srState.cKenh||[]).join(','),
      sanPham: _srState.cSanPham || '',
      byCreator: _srState.byCreator ? '1' : ''
    });
  } else if (_srState.sub === 'D') {
    _srState.dataD = await _srFetch('careLeadReport', {
      dateFrom: _srState.dDateFrom, dateTo: _srState.dDateTo, cs: (_srState.dCs||[]).join(',')
    });
  } else if (_srState.sub === 'E') {
    // Hoa hong & Chuong trinh thuong: LUON dung action=salesReportB ("dữ liệu đơn"/POS) — khong
    // con nhanh 'base' (salesReportA/DT TONG) nua. Chuan hoa lai ten field cho khop shape
    // {saleBan, giaTriDon} ma _computeCommissionData_()/_computeBonusData_() can, de CACH TINH
    // (splitMulti_ + chia deu/theo nguong) dung chung y het, khong viet lai.
    var dPos = await _srFetch('salesReportB', {
      dateFrom: _srState.eDateFrom, dateTo: _srState.eDateTo,
      sale: (_srState.eSale||[]).join(',')
    });
    // Lọc Sale ra 0 đơn: gần như chắc chắn do tên đã chọn (từ Team) KHÔNG trùng tên trong cột "Thẻ" của Pos.
    // Thay vì để 0đ không rõ lý do, tải lại không lọc Sale, hiển thị tất cả và báo rõ tên Sale thật trong Pos.
    _srState.eMismatch = null;
    var _saleSelE = _srState.eSale || [];
    if (_saleSelE.length && dPos && !(dPos.orders && dPos.orders.length)) {
      var dAllE = await _srFetch('salesReportB', { dateFrom: _srState.eDateFrom, dateTo: _srState.eDateTo, sale: '' });
      if (dAllE && dAllE.orders && dAllE.orders.length) {
        var cntE = {};
        dAllE.orders.forEach(function(o){
          String(o.saleBanValid !== undefined ? o.saleBanValid : (o.theSale || '')).split(',').forEach(function(x){ x = x.trim(); if (x) cntE[x] = (cntE[x] || 0) + 1; });
        });
        _srState.eMismatch = {
          total: dAllE.orders.length, selected: _saleSelE.slice(),
          tokens: Object.keys(cntE).sort(function(a, b){ return cntE[b] - cntE[a]; }).slice(0, 40).map(function(k){ return k + ' (' + cntE[k] + ')'; })
        };
        dPos = dAllE;
      }
    }
    // QUAN TRONG: phai map ca ngayTaoDon -> ngayTao (don Pos KHONG co san field "ngayTao") —
    // thieu dong nay thi moi bo loc theo ngay/ngay thu viec cua _computeBonusData_ se LUON
    // rong vi o.ngayTao undefined o moi don Pos, du da map dung saleBan/giaTriDon. Dung
    // saleBanValid (ten sale da loc hop le, xem _donSaleNamesFromThe_) thay vi theSale tho de
    // tranh ghi chu/ten sai chinh ta trong cot Thẻ bi tinh nham thanh 1 "sale" ao.
    if (dPos && dPos.orders) dPos.orders = dPos.orders.map(function(o){ return Object.assign({}, o, { saleBan: (o.saleBanValid !== undefined ? o.saleBanValid : o.theSale), giaTriDon: o.giaTriSauGiam, ngayTao: o.ngayTaoDon }); });
    _srState.dataE = dPos;
  } else if (_srState.sub === 'F') {
    // Dropdown khong phai 'custom' -> khoang ngay PHAI khop dropdown (tranh dropdown 'Tháng này'
    // ma 2 o ngay rong / cu sang thang khac => bao cao tinh nham toan bo lich su don).
    if (_srState.fDateQuick && _srState.fDateQuick !== 'custom'){
      var rF = _pkQuickRange(_srState.fDateQuick);
      if (rF){ _srState.fDateFrom = rF.from; _srState.fDateTo = rF.to; }
    }
    _srState.dataF = await _srFetch('saleKpiReport', {
      dateFrom: _srState.fDateFrom, dateTo: _srState.fDateTo,
      sale: (_srState.fSale||[]).join(',')
    });
  } else if (_srState.sub === 'L') {
    // KH qua cua hang (trang tinh cua hang) — khop SDT+ngay voi don Pos, chia 30% cho Sale chua co the
    if (_srState.lDateQuick && _srState.lDateQuick !== 'custom'){
      var rLq = _pkQuickRange(_srState.lDateQuick);
      if (rLq){ _srState.lDateFrom = rLq.from; _srState.lDateTo = rLq.to; }
    }
    _srState.dataL = await _srFetch('storeCaseReport', {
      dateFrom: _srState.lDateFrom, dateTo: _srState.lDateTo,
      sale: (_srState.lSale||[]).join(',')
    });
  } else if (_srState.sub === 'G' || _srState.sub === 'K') {
    // Chuong trinh thuong Thu viec/Chinh thuc: CUNG nguon va cach map field voi Bao cao E (salesReportB/Pos)
    // de _computeBonusData_ dung chung nguyen ven. Dropdown khong phai 'custom' -> khoang ngay PHAI khop dropdown.
    if (_srState.gDateQuick && _srState.gDateQuick !== 'custom'){
      var rGq = _pkQuickRange(_srState.gDateQuick);
      if (rGq){ _srState.gDateFrom = rGq.from; _srState.gDateTo = rGq.to; }
    }
    var dPosG = await _srFetch('salesReportB', {
      dateFrom: _srState.gDateFrom, dateTo: _srState.gDateTo,
      sale: (_srState.gSale||[]).join(',')
    });
    if (dPosG && dPosG.orders) dPosG.orders = dPosG.orders.map(function(o){ return Object.assign({}, o, { saleBan: (o.saleBanValid !== undefined ? o.saleBanValid : o.theSale), giaTriDon: o.giaTriSauGiam, ngayTao: o.ngayTaoDon }); });
    _srState.dataG = dPosG;
  }
  _srState.loading = false;
  renderSalesReportTab();
}

// Gom TOÀN BỘ báo cáo con (A–L, Nhập dữ liệu) vào 1 ô chọn duy nhất cho gọn màn hình (thay dải ~11 nút).
// K (chi tiết đơn thưởng) là màn con của G nên hiển thị như đang ở G. Dùng chung cho mọi báo cáo con.
function _srSubSelectHtml_(){
  var items = [['A','Báo cáo A — Base'],['B','Báo cáo B — Pos'],['C','Báo cáo C — So sánh kỳ Base'],['D','Báo cáo D — Sale tự thêm'],
    ['E','Báo cáo E — Hoa hồng nhân viên Pos'],['F','Báo cáo F — KPI Sale'],['G','Báo cáo G — Thưởng thử việc / chính thức'],
    ['H','Báo cáo H — Tổng quan data đã chia'],['I','Báo cáo I — Chia data Renew'],['L','Báo cáo L — KH qua cửa hàng']];
  if (_srIsAdmin()) items.push(['J','📤 Nhập dữ liệu Base/Pos']);
  var cur = _srState.sub === 'K' ? 'G' : _srState.sub;
  return '<select onchange="_srSetSub(this.value)" title="Chọn báo cáo" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-weight:600;font-size:13px;max-width:100%">' +
    items.map(function(it){ return '<option value="' + it[0] + '"' + (it[0] === cur ? ' selected' : '') + '>' + it[1] + '</option>'; }).join('') + '</select>';
}
function _srSetSub(sub){ _srState.sub = sub; _srLoad(); }
function _srSetField(key, val){ _srState[key] = val; }
// Bo loc nhanh khoang ngay dung chung cho A/D/E cua Bao cao doanh so — quickKey la ten field
// luu lua chon dropdown ('dateQuick'/'dDateQuick'/'eDateQuick'), fromKey/toKey la 2 field ngay
// tuong ung cua tung tab con.
function _srApplyQuickRange(quickKey, fromKey, toKey, key){
  _srState[quickKey] = key;
  if (key !== 'custom'){
    var r = _pkQuickRange(key);
    if (r){ _srState[fromKey] = r.from; _srState[toKey] = r.to; }
  }
  _srApply();
}
// (Da thay bang combo go-tim/tick-nhieu dung chung _srbComboHTML — xem _SRB_COMBO_CFG.cs/kh/zalo)

// Xuat bao cao dang loc (dung filter hien tai tren UI) ra 1 tab moi trong Google Sheet CRM.
// Tai su dung dung filter payload nhu _srLoad() de so lieu tren Sheet khop 100% voi UI dang xem.
async function exportSalesReportToSheet(){
  if (!gsUrl){ alert('Chưa kết nối Google Apps Script (gsUrl trống).'); return; }
  var filters;
  if (_srState.sub === 'A') {
    filters = { dateFrom: _srState.dateFrom, dateTo: _srState.dateTo, dateField: _srState.dateField,
      sale: _srState.sale || [], kenh: _srState.kenh || [], byCreator: _srState.byCreator ? '1' : '' };
  } else if (_srState.sub === 'C') {
    filters = { dateField: _srState.cDateField, periodType: _srState.cPeriodType,
      weekOffset: _srState.cWeekOffset, monthOffset: _srState.cMonthOffset, quarterOffset: _srState.cQuarterOffset, yearOffset: _srState.cYearOffset,
      customCurFrom: _srState.cCustomCurFrom, customCurTo: _srState.cCustomCurTo,
      customPrevFrom: _srState.cCustomPrevFrom, customPrevTo: _srState.cCustomPrevTo,
      sale: _srState.cSale || [], kenh: _srState.cKenh || [], byCreator: _srState.byCreator ? '1' : '' };
  } else if (_srState.sub === 'D') {
    filters = { dateFrom: _srState.dDateFrom, dateTo: _srState.dDateTo, cs: _srState.dCs || [] };
  } else if (_srState.sub === 'G') {
    filters = { dateFrom: _srState.gDateFrom, dateTo: _srState.gDateTo,
      sale: _srState.gSale || [], nguon: _srState.gNguon || [], marketer: _srState.gMarketer || [], sanPham: _srState.gSanPham || '' };
  } else {
    filters = { dateFrom: _srState.dateFrom, dateTo: _srState.dateTo,
      sale: _srState.bSale || [], nguon: _srState.bNguon || [], marketer: _srState.bMarketer || [],
      careStatus: _srState.bCareStatus || [], khStatus: _srState.bKhStatus || [],
      zaloStatus: _srState.bZaloStatus || [], nickZalo: _srState.bNickZalo || '' };
  }
  var btn = document.getElementById('sr-export-sheet-btn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang xuất...'; }
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
      body: JSON.stringify({ action:'exportSalesReportSheet', reportType: _srState.sub, filters: filters }) });
    var res = await r.json();
    if (res && res.tabName){
      if (res.fixedTab) alert('Đã cập nhật báo cáo Base vào tab cố định "'+res.tabName+'" (ghi đè, không tạo tab mới).'+(res.sheetUrl?'\n'+res.sheetUrl:''));
      else alert('Đã xuất báo cáo ra tab "'+res.tabName+'" trong Google Sheet.'+(res.sheetUrl?'\n'+res.sheetUrl:''));
    } else {
      alert('Xuất thất bại: '+(res && res.error ? res.error : 'không rõ lỗi'));
    }
  } catch(e){
    alert('Lỗi khi xuất ra Sheet: '+e.message);
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '📄 Xuất ra Sheet'; }
  }
}

function _srBuildSaleComboData(){
  _srSaleComboData = (_srState.saleOptions||[]).map(function(sv){ return {value:sv, label:sv}; });
}
function srSaleComboRender(filter){
  var list = document.getElementById('sr-sale-combo-list');
  if (!list) return;
  if (!_srSaleComboData.length) _srBuildSaleComboData();
  var q = _foldVi(filter||'');
  var selArr = _srState.sale || [];
  var items = q ? _srSaleComboData.filter(function(it){ return _foldVi(it.label).indexOf(q)!==-1; }) : _srSaleComboData;
  if (!items.length){ list.innerHTML = '<div class="cs-combo-empty">Không tìm thấy Sale</div>'; _srSaleComboIdx=-1; return; }
  list.innerHTML = items.map(function(it){
    var checked = selArr.indexOf(it.value)!==-1;
    return '<div class="cs-combo-opt '+(checked?'is-sel':'')+'" data-v="'+esc(it.value)+'" onmousedown="srSaleComboToggleItem(event, this.getAttribute(\'data-v\'))">'+
      '<span>'+(checked?'☑':'☐')+' '+esc(it.label)+'</span></div>';
  }).join('');
  _srSaleComboIdx = -1;
}
function srRenderSaleChips(){
  var wrap = document.getElementById('sr-sale-chips');
  if (!wrap) return;
  var selArr = _srState.sale || [];
  if (!selArr.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = selArr.map(function(name){
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
      esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="srSaleComboRemove(this.parentNode.dataset.name)">✕</span></span>';
  }).join('');
}
function srSaleComboOpen(){
  _srBuildSaleComboData();
  var ci = document.getElementById('sr-sale-combo-input');
  srSaleComboRender(ci ? ci.value : '');
  var l = document.getElementById('sr-sale-combo-list'); if (l) l.classList.add('open');
}
function srSaleComboClose(){ var l=document.getElementById('sr-sale-combo-list'); if(l) l.classList.remove('open'); }
function srSaleComboToggle(e){
  if (e) e.stopPropagation();
  var l=document.getElementById('sr-sale-combo-list'); if(!l) return;
  if (l.classList.contains('open')) srSaleComboClose();
  else { var ci=document.getElementById('sr-sale-combo-input'); if(ci) ci.focus(); srSaleComboOpen(); }
}
function srSaleComboFilter(v){
  srSaleComboRender(v);
  var l=document.getElementById('sr-sale-combo-list'); if (l) l.classList.add('open');
}
// Click 1 ten trong dropdown: TICK/BO TICK ten do, KHONG dong dropdown (de chon tiep ten khac).
// Ap dung bo loc van can bam nut "Lọc" nhu cac o khac (khong tu dong fetch moi lan tick).
function srSaleComboToggleItem(e, value){
  if (e && e.preventDefault) e.preventDefault();
  var arr = (_srState.sale || []).slice();
  var idx = arr.indexOf(value);
  if (idx !== -1) arr.splice(idx, 1); else arr.push(value);
  _srState.sale = arr;
  var ci = document.getElementById('sr-sale-combo-input');
  srSaleComboRender(ci ? ci.value : '');
  srRenderSaleChips();
}
function srSaleComboRemove(value){
  var arr = (_srState.sale || []).filter(function(v){ return v !== value; });
  _srState.sale = arr;
  srRenderSaleChips();
  var l = document.getElementById('sr-sale-combo-list');
  if (l && l.classList.contains('open')) { var ci=document.getElementById('sr-sale-combo-input'); srSaleComboRender(ci?ci.value:''); }
}
function srSaleComboClear(e){
  if (e) e.stopPropagation();
  _srState.sale = [];
  var ci = document.getElementById('sr-sale-combo-input'); if (ci) ci.value = '';
  srRenderSaleChips();
  var l = document.getElementById('sr-sale-combo-list');
  if (l && l.classList.contains('open')) srSaleComboRender('');
}
function srSaleComboKey(e){
  var list = document.getElementById('sr-sale-combo-list');
  if (!list || !list.classList.contains('open')){ if (e.key==='ArrowDown') srSaleComboOpen(); return; }
  var opts = [...list.querySelectorAll('.cs-combo-opt')];
  if (!opts.length) return;
  if (e.key==='ArrowDown'){ e.preventDefault(); _srSaleComboIdx = Math.min(_srSaleComboIdx+1, opts.length-1); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); _srSaleComboIdx = Math.max(_srSaleComboIdx-1, 0); }
  else if (e.key==='Enter'){
    e.preventDefault();
    var pick = (_srSaleComboIdx>=0 && opts[_srSaleComboIdx]) ? opts[_srSaleComboIdx] : (opts.length===1 ? opts[0] : null);
    if (pick) srSaleComboToggleItem(e, pick.getAttribute('data-v'));
    return;
  }
  else if (e.key==='Escape'){ srSaleComboClose(); return; }
  else { return; }
  opts.forEach(function(o,i){ o.classList.toggle('active', i===_srSaleComboIdx); });
  if (_srSaleComboIdx>=0 && opts[_srSaleComboIdx]) opts[_srSaleComboIdx].scrollIntoView({block:'nearest'});
}
function _srApply(){ _srLoad(); }

// ── An/Hien Page & Sale khoi bao cao chung (yeu cau 2026-09-25) ──
function _srToggleHiddenPanel(){
  _srState.hiddenPanelOpen = !_srState.hiddenPanelOpen;
  if (_srState.hiddenPanelOpen) {
    _srState.hiddenDraftChannels = HIDDEN_CHANNELS.slice();
    _srState.hiddenDraftSales = HIDDEN_SALES.slice();
  }
  renderSalesReportTab();
}
function _srSetHiddenDraft(el){
  var kind = el.dataset.kind, name = el.dataset.name, visible = el.checked;
  var key = kind === 'channel' ? 'hiddenDraftChannels' : 'hiddenDraftSales';
  var arr = _srState[key] || [];
  if (visible) arr = arr.filter(function(n){ return n !== name; }); // tick = hien -> bo khoi danh sach an
  else if (arr.indexOf(name) === -1) arr.push(name);               // bo tick = an -> them vao danh sach an
  _srState[key] = arr;
}
function _srHiddenPageSaleCol_(title, allNames, draftArr, kind, searchKey){
  var q = (_srState[searchKey]||'').toLowerCase();
  var html = '<div style="min-width:220px;flex:1">';
  html += '<b style="font-size:12px">'+title+'</b>';
  html += '<input type="text" placeholder="🔍 Tìm..." value="'+esc(_srState[searchKey]||'')+'" oninput="_srState.'+searchKey+'=this.value;renderSalesReportTab()" style="width:100%;margin:6px 0;padding:4px 7px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:11.5px">';
  html += '<div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:2px">';
  allNames.filter(function(n){ return !q || n.toLowerCase().indexOf(q)!==-1; }).forEach(function(n){
    var visible = draftArr.indexOf(n) === -1;
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:12px;padding:2px 4px;border-radius:4px'+(visible?'':';opacity:.55;text-decoration:line-through')+'">'+
      '<input type="checkbox" '+(visible?'checked':'')+' data-kind="'+kind+'" data-name="'+esc(n)+'" onchange="_srSetHiddenDraft(this)">'+esc(n)+'</label>';
  });
  if (!allNames.length) html += '<div style="color:var(--muted);font-size:11.5px;padding:6px">Chưa có dữ liệu.</div>';
  html += '</div></div>';
  return html;
}
function _srHiddenPageSaleHtml(){
  var html = '<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;background:var(--surface2)">';
  html += '<div class="guide-text" style="font-size:12.5px;color:var(--muted);margin-bottom:8px">Bỏ tích Page/kênh hoặc Sale KHÔNG thuộc phạm vi quản lý của bạn — sẽ ẩn khỏi Dashboard, Báo cáo doanh số A–E và KPI Pancake ngay khi bấm Lưu (không xoá dữ liệu, chỉ ẩn khỏi báo cáo chung).</div>';
  html += '<div style="display:flex;gap:20px;flex-wrap:wrap">';
  html += _srHiddenPageSaleCol_('📡 Page / Kênh bán', _allChannelNames(), _srState.hiddenDraftChannels||[], 'channel', 'hiddenSearchChannel');
  html += _srHiddenPageSaleCol_('👤 Sale', _allCSNames(), _srState.hiddenDraftSales||[], 'sale', 'hiddenSearchSale');
  html += '</div>';
  html += '<div style="margin-top:10px;display:flex;gap:8px">'+
    '<button class="btn primary sm" onclick="_srSaveHiddenPanel()">💾 Lưu &amp; ẩn ngay</button>'+
    '<button class="btn sm secondary" onclick="_srToggleHiddenPanel()">Đóng</button></div>';
  html += '</div>';
  return html;
}
function _srSaveHiddenPanel(){
  HIDDEN_CHANNELS = (_srState.hiddenDraftChannels||[]).slice();
  HIDDEN_SALES = (_srState.hiddenDraftSales||[]).slice();
  _srState.hiddenPanelOpen = false;
  _saveHiddenPageSale();
  toast('✓ Đã lưu — Page/Sale bị ẩn sẽ biến mất khỏi báo cáo.');
  _srApply();
}

function _srComboInit(domId, field, optKey){ _srComboReg[domId] = { field: field, optKey: optKey }; }
// Danh sách Sale do việc chọn Team điền vào (khác danh sách người dùng tự chọn) — nhớ chữ ký để khi BỎ HẾT Team thì gỡ đúng danh sách đó,
// còn nếu người dùng đã tự sửa Sale sau khi chọn Team thì giữ nguyên. Trước đây bỏ Team không gỡ Sale -> báo cáo vẫn lọc theo Team cũ (nguyên nhân 'lọc Team sai').
function _srSaleSig_(arr){ return JSON.stringify((arr || []).slice().sort()); }
function _srClearAutoSale_(saleField){
  var sig = _srState['_autoSaleSig_' + saleField];
  if (sig && _srSaleSig_(_srState[saleField]) === sig) {
    _srState[saleField] = [];
    if (saleField === 'eSale') _srState.eSaleCustomized = true;
    if (saleField === 'gSale') _srState.gSaleCustomized = true;
  }
  _srState['_autoSaleSig_' + saleField] = '';
  if (_srState._teamSyncInfo) delete _srState._teamSyncInfo[saleField];
}
function _srSyncTeamToSale_(teamField){
  var saleField = _srTeamFieldToSaleField_[teamField];
  if (!saleField) return;
  var selTeams = _srState[teamField] || [];
  if (!selTeams.length) { _srClearAutoSale_(saleField); return; }
  var union = [];
  var notFound = [];
  var _people = [];   // MỖI thành viên Team = 1 NGƯỜI: { name: tên ghi trong Team, names: mọi tên/thẻ cùng người } — để báo thiếu theo NGƯỜI, không theo từng tên phụ
  selTeams.forEach(function(tname){
    var want = String(tname||'').trim().toLowerCase();
    var t = (teams||[]).find(function(x){ return String(x.name || '(chưa đặt tên)').trim().toLowerCase() === want; });
    if (!t) { notFound.push(tname); return; }
    [t.leader].concat(t.members||[]).filter(Boolean).forEach(function(n){
      var grp = []; (_personAliases(n) || [n]).concat([n]).forEach(function(a){ if (a && grp.indexOf(a)===-1) grp.push(a); });   // gồm mọi thẻ/tên cùng người
      _people.push({ name: n, names: grp });
      grp.forEach(function(a){ if (union.indexOf(a)===-1) union.push(a); });
    });
  });
  // KHONG ghi de bo loc Sale bang mang RONG: backend coi mang Sale rong = KHONG LOC GI (hien het
  // du lieu) -> user tuong dang loc theo Team ma thuc ra dang xem toan bo. Neu khong khop duoc Team
  // nao / Team khong co thanh vien nao -> bao ro va giu nguyen lua chon Sale hien co.
  if (!union.length) {
    toast('⚠ Không tìm thấy thành viên nào cho Team đã chọn' + (notFound.length ? ' ('+notFound.join(', ')+')' : ' (Team chưa có thành viên)') + ' — bấm "Đồng bộ" để cập nhật danh sách Team rồi thử lại');
    return;
  }
  // Mọi báo cáo đều lọc Sale theo tên CHÍNH XÁC trong dữ liệu nguồn (KPI/Pos). Tên trong Team ghi khác
  // (hoa/thường, dấu, khoảng trắng) hoặc không có trong nguồn → bộ lọc ra 0 đơn → doanh thu 0đ.
  // Nên với MỌI báo cáo: đổi tên Team sang đúng tên trong danh sách Sale của báo cáo đó, bỏ tên không có thật và báo rõ.
  var _srcOpts = (saleField === 'eSale' || saleField === 'fSale' || saleField === 'bSale') ? (_srState.saleBOptions||[]) : (_srState.saleOptions||[]);
  var _missingAll = [];
  if (_srcOpts.length){
    var _fold = function(x){ return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').replace(/\s+/g,' ').trim().toLowerCase(); };
    var _canon = {}; _srcOpts.forEach(function(n){ _canon[_fold(n)] = n; });
    // Tên gõ kiểu "S6 anhtrinh1995" / "6" (số thứ tự sale + thẻ) → bỏ tiền tố "S<số>" và số đứng riêng để khớp đúng thẻ trong dữ liệu.
    var _stripTag = function(x){ return _fold(x).replace(/^s\d+\s+/, '').replace(/(^|\s)\d+(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim(); };
    var _kept = [], _missing = [], _seenMiss = {};
    var _keepName = function(c){ if (c !== undefined && _kept.indexOf(c) === -1) _kept.push(c); };
    _people.forEach(function(pp){
      var hit = false;
      pp.names.forEach(function(n){
        var c = _canon[_fold(n)];
        if (c === undefined) { var st = _stripTag(n); if (st && st !== _fold(n)) c = _canon[st]; }
        if (c !== undefined) { hit = true; _keepName(c); }
      });
      // Chỉ báo "bị bỏ" khi KHÔNG tên/thẻ nào của người đó có trong dữ liệu báo cáo (các tên phụ không khớp nhưng người đó đã có tên khớp thì không phải lỗi).
      if (!hit && !_seenMiss[_fold(pp.name)]) { _seenMiss[_fold(pp.name)] = 1; _missing.push(pp.name); }
    });
    // Tên lẻ trong union không thuộc người nào ở trên (phòng hờ) vẫn được khớp như cũ.
    union.forEach(function(n){ _keepName(_canon[_fold(n)]); });
    _missingAll = _missing;
    if (_missing.length) toast('⚠ ' + _missing.length + ' người trong Team không có tên nào khớp dữ liệu báo cáo (bỏ qua): ' + _missing.slice(0,6).join(', ') + (_missing.length>6?'...':''));
    if (!_kept.length){
      toast('⚠ Không tên nào trong Team khớp tên Sale của báo cáo — giữ nguyên bộ lọc Sale hiện tại. Sửa tên trong "Quản lý Team" cho đúng tên trong báo cáo.');
      return;
    }
    union = _kept;
  }
  if (notFound.length) toast('⚠ Không khớp được Team: ' + notFound.join(', ') + ' — kết quả lọc chỉ gồm các Team còn lại');
  _srState[saleField] = union;
  _srState['_autoSaleSig_' + saleField] = _srSaleSig_(union);
  (_srState._teamSyncInfo = _srState._teamSyncInfo || {})[saleField] = { teams: selTeams.slice(), sales: union.slice(), missing: _missingAll.slice(), notFound: notFound.slice() };
  if (saleField === 'eSale') _srState.eSaleCustomized = true;
  if (saleField === 'gSale') _srState.gSaleCustomized = true;
}
function _srComboBuildData(domId){
  var r = _srComboReg[domId]; if (!r) return;
  _srComboData[domId] = (_srState[r.optKey] || []).map(function(v){ return { value: v, label: v }; });
}
function srComboRender(domId, filter){
  var r = _srComboReg[domId]; if (!r) return;
  var list = document.getElementById(domId+'-list'); if (!list) return;
  if (!_srComboData[domId]) _srComboBuildData(domId);
  var q = _foldVi(filter || '');
  var selArr = _srState[r.field] || [];
  var items = q ? _srComboData[domId].filter(function(it){ return _foldVi(it.label).indexOf(q)!==-1; }) : _srComboData[domId];
  if (!items.length){ list.innerHTML = '<div class="cs-combo-empty">Không tìm thấy</div>'; _srComboIdx[domId]=-1; return; }
  list.innerHTML = items.map(function(it){
    var checked = selArr.indexOf(it.value)!==-1;
    return '<div class="cs-combo-opt '+(checked?'is-sel':'')+'" data-v="'+esc(it.value)+'" onmousedown="srComboToggleItem(event,\''+domId+'\',this.getAttribute(\'data-v\'))">'+
      '<span>'+(checked?'☑':'☐')+' '+esc(it.label)+'</span></div>';
  }).join('');
  _srComboIdx[domId] = -1;
}
function srRenderComboChips(domId){
  var r = _srComboReg[domId]; if (!r) return;
  var wrap = document.getElementById(domId+'-chips'); if (!wrap) return;
  var selArr = _srState[r.field] || [];
  wrap.innerHTML = selArr.map(function(name){
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
      esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="srComboRemove(\''+domId+'\',this.parentNode.dataset.name)">✕</span></span>';
  }).join('');
}
function srComboOpen(domId){
  _srComboBuildData(domId);
  var ci = document.getElementById(domId+'-input');
  srComboRender(domId, ci ? ci.value : '');
  var l = document.getElementById(domId+'-list'); if (l) l.classList.add('open');
}
function srComboClose(domId){ var l=document.getElementById(domId+'-list'); if(l) l.classList.remove('open'); }
function srComboToggle(e, domId){
  if (e) e.stopPropagation();
  var l=document.getElementById(domId+'-list'); if(!l) return;
  if (l.classList.contains('open')) srComboClose(domId);
  else { var ci=document.getElementById(domId+'-input'); if(ci) ci.focus(); srComboOpen(domId); }
}
function srComboFilter(domId, v){ srComboRender(domId, v); var l=document.getElementById(domId+'-list'); if (l) l.classList.add('open'); }
function srComboToggleItem(e, domId, value){
  if (e && e.preventDefault) e.preventDefault();
  var r = _srComboReg[domId]; if (!r) return;
  var arr = (_srState[r.field] || []).slice();
  var idx = arr.indexOf(value);
  if (idx !== -1) arr.splice(idx, 1); else arr.push(value);
  _srState[r.field] = arr;
  if (r.field === 'eSale') _srState.eSaleCustomized = true;
  if (r.field === 'gSale') _srState.gSaleCustomized = true;
  if (_srTeamFieldToSaleField_[r.field]){ _srSyncTeamToSale_(r.field); renderSalesReportTab(); return; }
  var ci = document.getElementById(domId+'-input');
  srComboRender(domId, ci ? ci.value : '');
  srRenderComboChips(domId);
}
function srComboRemove(domId, value){
  var r = _srComboReg[domId]; if (!r) return;
  _srState[r.field] = (_srState[r.field] || []).filter(function(v){ return v !== value; });
  if (r.field === 'eSale') _srState.eSaleCustomized = true;
  if (r.field === 'gSale') _srState.gSaleCustomized = true;
  if (_srTeamFieldToSaleField_[r.field]){ _srSyncTeamToSale_(r.field); renderSalesReportTab(); return; }
  srRenderComboChips(domId);
  var l = document.getElementById(domId+'-list');
  if (l && l.classList.contains('open')) { var ci=document.getElementById(domId+'-input'); srComboRender(domId, ci?ci.value:''); }
}
function srComboClear(e, domId){
  if (e) e.stopPropagation();
  var r = _srComboReg[domId]; if (!r) return;
  _srState[r.field] = [];
  if (r.field === 'eSale') _srState.eSaleCustomized = true;
  if (r.field === 'gSale') _srState.gSaleCustomized = true;
  if (_srTeamFieldToSaleField_[r.field]){ _srSyncTeamToSale_(r.field); renderSalesReportTab(); return; }
  var ci = document.getElementById(domId+'-input'); if (ci) ci.value = '';
  srRenderComboChips(domId);
  var l = document.getElementById(domId+'-list');
  if (l && l.classList.contains('open')) srComboRender(domId, '');
}
function srComboKey(e, domId){
  var list = document.getElementById(domId+'-list');
  if (!list || !list.classList.contains('open')){ if (e.key==='ArrowDown') srComboOpen(domId); return; }
  var opts = [...list.querySelectorAll('.cs-combo-opt')];
  if (!opts.length) return;
  var idx = _srComboIdx[domId]===undefined ? -1 : _srComboIdx[domId];
  if (e.key==='ArrowDown'){ e.preventDefault(); idx = Math.min(idx+1, opts.length-1); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); idx = Math.max(idx-1, 0); }
  else if (e.key==='Enter'){
    e.preventDefault();
    var pick = (idx>=0 && opts[idx]) ? opts[idx] : (opts.length===1 ? opts[0] : null);
    if (pick) srComboToggleItem(e, domId, pick.getAttribute('data-v'));
    return;
  }
  else if (e.key==='Escape'){ srComboClose(domId); return; }
  else { return; }
  _srComboIdx[domId] = idx;
  opts.forEach(function(o,i){ o.classList.toggle('active', i===idx); });
  if (idx>=0 && opts[idx]) opts[idx].scrollIntoView({block:'nearest'});
}
// Render san 1 combo hoan chinh (nhan/o tim/chip) — goi lai trong renderSalesReportTab moi lan ve.
function _srComboHtml(domId, field, optKey, label, placeholder, widthPx, hideChips){
  if (hideChips === undefined) hideChips = true;   // chip tên đã chọn không hiện ngoài ô — chỉ tick trong danh sách thả xuống
  _srComboInit(domId, field, optKey);
  var selArr = _srState[field] || [];
  return '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">'+esc(label)+(selArr.length?' <span style="color:var(--green)">('+selArr.length+' đã chọn)</span>':'')+'</div>'+
    '<div class="cs-combo" id="'+domId+'" style="width:'+(widthPx||170)+'px">'+
    '<input type="text" id="'+domId+'-input" class="cs-combo-input" placeholder="'+esc(placeholder)+'" autocomplete="off" '+
    'oninput="srComboFilter(\''+domId+'\',this.value)" onfocus="srComboOpen(\''+domId+'\')" onkeydown="srComboKey(event,\''+domId+'\')">'+
    '<button type="button" class="cs-combo-clear" onclick="srComboClear(event,\''+domId+'\')" style="display:'+(selArr.length?'':'none')+'">✕</button>'+
    '<span class="cs-combo-caret" onclick="srComboToggle(event,\''+domId+'\')">▾</span>'+
    '<div class="cs-combo-list" id="'+domId+'-list"></div>'+
    '</div>'+
    '<div id="'+domId+'-chips" style="display:'+(hideChips?'none':'flex')+';flex-wrap:wrap;gap:4px;margin-top:4px;max-width:210px">'+
    selArr.map(function(name){
      return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
        esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="srComboRemove(\''+domId+'\',this.parentNode.dataset.name)">✕</span></span>';
    }).join('')+
    '</div></div>';
}

// ── Chọn theo Team: đổ toàn bộ thành viên của 1 team (leader + members, đã set up sẵn ở tab
//    "Quản lý Team") vào ô Sale multi-select — chỉ điền, không tự bấm Lọc, để có thể bỏ bớt/
//    thêm tay trước khi xem báo cáo. Dùng lại biến global `teams` đã có sẵn cho tab Quản lý Team.
function _srTeamOptionsHtml(){
  return (teams||[]).map(function(t){ return '<option value="'+esc(t.id)+'">'+esc(t.name||'(chưa đặt tên)')+'</option>'; }).join('');
}
function srPickTeam(teamId, saleField, domId){
  if (!teamId) return;
  var t = (teams||[]).find(function(x){ return x.id === teamId; });
  if (!t){ toast('Không tìm thấy team.'); return; }
  var members = [...(new Set([t.leader].concat(t.members||[]).filter(Boolean)))];
  if (!members.length){ toast('Team "'+(t.name||'')+'" chưa có thành viên — set up ở tab Quản lý Team.'); return; }
  _srState[saleField] = members;
  // QUAN TRỌNG: combo "sr-sale-combo" (Báo cáo A) là combo dựng tay riêng (KHÔNG đăng ký qua
  // _srComboReg như combo "sr-sale-combo-c" của Báo cáo C), nên gọi srRenderComboChips(domId)
  // ở đây bị no-op (tìm _srComboReg[domId] ra undefined) — danh sách đã chọn KHÔNG hiện lên,
  // khiến người dùng tưởng chọn Team không có tác dụng và không bấm "Lọc" để load lại doanh thu.
  // Render lại toàn bộ thanh lọc để chip + nhãn "(N đã chọn)" luôn cập nhật đúng cho cả 2 combo.
  renderSalesReportTab();
}

function renderSalesReportTab(){
  var wrap = document.getElementById('salesreport-wrap');
  if (!wrap) return;
  if (!gsUrl){
    wrap.innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px">Chưa kết nối Google Apps Script (gsUrl trống).</div>';
    return;
  }
  _srEnforceScope();
  if (!_srState.optionsLoaded) _srLoadOptions();
  // `teams` (biến global) CHỈ được đồng bộ lại từ server khi bấm "Đồng bộ" đầy đủ (xem wrap
  // syncFromGS, opts.manual/opts.pullOrders) — nếu team vừa được đổi tên/tạo mới ở máy/phiên khác,
  // `teams` trong localStorage ('ome_teams') có thể cũ, khiến _srSyncTeamToSale_ không khớp được
  // tên Team đã chọn -> am tham tra ve mang rong -> bo loc Sale coi nhu KHONG LOC GI (hien het du
  // lieu thay vi loc dung Team). Tu dong keo lai 1 lan moi phien khi vao tab Bao cao de giam rui ro.
  if (!_srState._teamsAutoSynced && gsUrl) {
    _srState._teamsAutoSynced = true;
    (async function(){
      try {
        var sep = gsUrl.includes('?') ? '&' : '?';
        var r = await fetch(gsUrl + sep + 'action=teams', { redirect:'follow' });
        var d = await r.json();
        if (d && d.teams && d.teams.length) {
          teams = d.teams;
          saveLS('ome_teams', teams);
          _srState.teamOptions = teams.map(function(t){ return t.name || '(chưa đặt tên)'; });
          if (_srState.sub) renderSalesReportTab();
        }
      } catch(e) { /* GAS cu chua ho tro action=teams -> bo qua, giu ban local */ }
    })();
  }
  // Danh sách team cho combo "Lọc theo Team" — lấy trực tiếp từ `teams` (tab Quản lý Team), không
  // cần gọi thêm action backend. Đặt tên trùng để tránh 2 team trùng tên gây nhầm khi lọc.
  _srState.teamOptions = (teams||[]).map(function(t){ return t.name || '(chưa đặt tên)'; });

  var subTabs = '<div style="margin-bottom:14px">' + _srSubSelectHtml_() + '</div>';

  if (_srState.sub === 'C') { renderSalesReportTabC_(wrap, subTabs); return; }
  if (_srState.sub === 'D') { renderSalesReportTabD_(wrap, subTabs); return; }
  if (_srState.sub === 'E') { renderSalesReportTabE_(wrap, subTabs); return; }
  if (_srState.sub === 'F') { renderSalesReportTabF_(wrap, subTabs); return; }
  if (_srState.sub === 'G') { renderSalesReportTabG_(wrap, subTabs); return; }
  if (_srState.sub === 'H') { renderSalesReportTabH_(wrap, subTabs); return; }
  if (_srState.sub === 'I') { renderSalesReportTabI_(wrap, subTabs); return; }
  if (_srState.sub === 'J') { renderSalesReportTabJ_(wrap, subTabs); return; }
  if (_srState.sub === 'L') { renderSalesReportTabL_(wrap, subTabs); return; }
  if (_srState.sub === 'K') { renderSalesReportTabK_(wrap, subTabs); return; }

  var bar = _srBarHtml_();

  var body = '';
  var hiddenPanelHtml = (_srIsAdmin() && _srState.hiddenPanelOpen) ? _srHiddenPageSaleHtml() : '';
  if (_srState.loading){
    body = '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>';
  } else if (_srState.sub === 'A'){
    body = _srRenderA(_srState.dataA);
  } else {
    body = _srRenderB(_srState.dataB);
  }
  wrap.innerHTML = bar + hiddenPanelHtml + body;
}

// ── Tỷ lệ chốt (theo Sale / theo Kênh) ─────────────────────────────────────
// Dùng CHUNG cách tính "chốt" đã có sẵn ở tab Dashboard (careStatus === 'Chốt' trên tổng số
// KH được giao/ghi nhận) — khác nguồn dữ liệu với bảng doanh thu bên trên (bảng doanh thu lấy
// từ Google Sheet qua salesReportA, còn tỷ lệ chốt lấy từ allCustomers ở client vì cần careStatus).
function _srCustKenh_(c){
  if (!c || !c.orders || !c.orders.length) return (c && c.sources && c.sources[0]) || '';
  var latest = null;
  for (var i=0;i<c.orders.length;i++){
    var o = c.orders[i]; if (!o.source) continue;
    if (!latest || (o.date instanceof Date && (!(latest.date instanceof Date) || o.date > latest.date))) latest = o;
  }
  return (latest && latest.source) || (c.sources && c.sources[0]) || '';
}
function _srCloseRateGroups_(keyFn, hiddenSet){
  var arr = (typeof allCustomers !== 'undefined' ? allCustomers : []).filter(_inUserScope);
  var map = {};
  arr.forEach(function(c){
    var k = keyFn(c);
    if (!k) return;
    if (hiddenSet && hiddenSet.length && hiddenSet.indexOf(k) !== -1) return; // an theo cai dat admin
    if (!map[k]) map[k] = {name:k, held:0, closed:0};
    map[k].held++;
    if (c.careStatus === 'Chốt') map[k].closed++;
  });
  return Object.keys(map).map(function(k){
    var g = map[k]; g.closeRate = g.held ? Math.round(g.closed/g.held*100) : 0; return g;
  });
}
function _srCloseRateBySale_(){ return _srCloseRateGroups_(function(c){ return _heldBy(c) || ''; }, HIDDEN_SALES); }
function _srCloseRateByKenh_(){ return _srCloseRateGroups_(_srCustKenh_, HIDDEN_CHANNELS); }

// Tỷ lệ chốt TRUNG BÌNH CHUNG = tổng đơn chốt ÷ tổng tương tác Pancake của các dòng có tương tác — CÙNG công thức với dòng "Trung bình" của biểu đồ
// bên dưới (không phụ thuộc ô tìm nhanh). Đưa lên cụm thẻ tổng đầu báo cáo (Duyên yêu cầu 2026-10-16). Chỉ có khi báo cáo đã nạp được tương tác Pancake (saleCloseRateFrom).
function _srCloseRateAvg_(rows){
  var held = 0, closed = 0;
  (rows||[]).forEach(function(r){ if (r && r.held > 0){ held += r.held; closed += (r.closed||0); } });
  return { held: held, closed: closed, avg: held ? Math.round(closed/held*1000)/10 : 0, has: held > 0 };
}
function _srCloseRateKpiCard_(d){
  if (!d || !d.saleCloseRateFrom) return '';
  var a = _srCloseRateAvg_(d.saleCloseRate);
  if (!a.has) return '';
  return '<div class="kpi-card" style="border:1.5px solid #0e7490"><div class="kpi-val" style="color:#0e7490">'+a.avg+'%</div>'+
    '<div class="kpi-label"><b>Tỷ lệ chốt TB</b> ('+fmt(a.closed)+' đơn ÷ '+fmt(a.held)+' tương tác Pancake)</div></div>';
}
// Vẽ cột ngang tỷ lệ chốt — xanh/vàng/đỏ theo mức %, kèm số liệu chốt/tổng bên cạnh mỗi cột,
// và dòng trung bình chung ở trên để dễ đối chiếu nhanh khi chụp màn hình gửi sếp.
function _srCloseRateBarHtml_(rows, searchTerm, unitLabel, excluded){
  unitLabel = unitLabel || 'KH';
  var filtered = (rows||[]).filter(function(r){ return r.held>0 && (!searchTerm || r.name.toLowerCase().indexOf(searchTerm.toLowerCase())!==-1); });
  if (!filtered.length) return '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Không có dữ liệu để tính tỷ lệ chốt</div>';
  filtered.sort(function(a,b){ return b.closeRate-a.closeRate; });
  var totHeld = filtered.reduce(function(s,r){return s+r.held;},0);
  var totClosed = filtered.reduce(function(s,r){return s+r.closed;},0);
  var avgRate = totHeld ? Math.round(totClosed/totHeld*1000)/10 : 0;   // 1 chữ số thập phân, cùng độ chính xác với từng dòng (333/39781 = 0.8%, không làm tròn thành 1%)
  // Dong co DON nhung 0 tuong tac Pancake (thuong la 2 ten khac nhau cua cung 1 nguoi chua duoc lien ket) khong ve duoc thanh cot
  // (khong co mau so) — truoc day bi AN im lang nen don cua ho 'bien mat' khoi bieu do. Nay liet ke ro de biet ma lien ket.
  var orphans = (rows||[]).filter(function(r){ return !(r.held>0) && r.closed>0; }).sort(function(a,b){ return b.closed-a.closed; });
  var orphanTot = orphans.reduce(function(s,r){return s+r.closed;},0);
  var orphanBox_ = orphans.length ? '<div style="font-size:11px;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:6px 8px;margin:6px 0">⚠️ <b>'+orphanTot+' đơn</b> chưa gán được vào tương tác Pancake nên KHÔNG nằm trong biểu đồ/trung bình: '+orphans.slice(0,8).map(function(r){ return esc(r.name)+' ('+r.closed+')'; }).join(', ')+(orphans.length>8?' …':'')+'. Nếu đây là tên khác của 1 Sale đã có → thêm vào "Tên khác" ở 🔑 Tài khoản (hoặc Quản lý tài khoản) để gộp.</div>' : '';
  // MẶC ĐỊNH ẨN — bấm 👁 mới hiện (Duyên yêu cầu 2026-10-12; _warnBox ở js/10-fn-pkkpipct.js)
  var orphanHtml = orphanBox_ ? _warnBox('cr-orphan', orphanBox_, orphanTot+' đơn chưa gán vào tương tác Pancake') : '';
  // Mẫu số CHỈ tính tương tác của Page đã khớp Kênh bán (cùng quy tắc bảng theo Kênh / Sale×Page). Phần ở Page chưa khớp được báo ở đây (ẩn sau 👁).
  // (18/10/2026) Duyên yêu cầu TẮT HẲN ô "👁 N tương tác ở M Page chưa khớp kênh (không tính)" — số tương tác ở Page chưa khớp Kênh vẫn KHÔNG tính vào mẫu số (không đổi cách tính),
  // chỉ không hiện cảnh báo nữa; muốn xem/sửa thì vào tab "📥 Báo cáo Pancake" → "🔗 Khớp Page Pancake ↔ Kênh bán CRM".
  var lv = CLOSE_RATE_THRESHOLDS.levels;
  function colorFor(p){ return _crColorFor_(p); }
  // Độ dài cột tính theo TỶ LỆ SO VỚI NGƯỜI CAO NHẤT (không phải so với 100%): tỷ lệ chốt thật chỉ 0–3% nên trước đây mọi cột chỉ rộng 1–3% khung → chỉ còn chấm tròn nhỏ.
  var maxRate = filtered.reduce(function(m,r){ return Math.max(m, r.closeRate||0); }, 0);
  var bars = filtered.map(function(r){
    var w = maxRate > 0 ? Math.max(r.closeRate > 0 ? 3 : 0, Math.min(100, r.closeRate/maxRate*100)) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">'+
      '<div style="width:112px;font-size:11.5px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.name)+'">'+esc(r.name)+'</div>'+
      '<div style="flex:1;background:var(--surface2);border-radius:4px;overflow:hidden;height:15px">'+
      '<div style="width:'+w+'%;height:100%;background:'+colorFor(r.closeRate)+';border-radius:4px"></div></div>'+
      '<div style="width:104px;font-size:11px;color:var(--muted);white-space:nowrap"><b style="color:var(--text)">'+r.closeRate+'%</b> ('+r.closed+'/'+r.held+')</div></div>';
  }).join('');
  var isAdmin = currentUser.role === 'admin' || currentUser.role === 'demo';
  var legend = _srCrLegendHtml_(lv);
  var editBtn = isAdmin ? ' &nbsp;<a href="javascript:void(0)" onclick="_srToggleCloseRateEdit(this)" style="font-size:10.5px;color:var(--muted);text-decoration:underline">✎ sửa mốc</a>' : '';
  return '<div style="padding:4px 0 10px">'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Trung bình: <b style="color:var(--text)">'+avgRate+'%</b> ('+totClosed+'/'+totHeld+' '+esc(unitLabel)+') &nbsp;·&nbsp; '+legend+editBtn+'</div>'+
    (isAdmin ? _srCrFormHtml_(lv) : '')+
    orphanHtml+
    bars+'</div>';
}
function _srCrLegendHtml_(lv){
  return lv.map(function(l,i){
    var nx = lv[i+1], txt;
    if (!nx) txt = '≥'+l.from+'%';
    else if (i===0) txt = '<'+nx.from+'%';
    else txt = l.from+'–'+(nx.from % 1 === 0 ? (nx.from-1) : '<'+nx.from)+'%';   // tỷ lệ hiển thị là số nguyên nên "đến mốc kế - 1"
    return '<span style="color:'+l.color+'">■</span> '+esc(txt).replace(/</g,'&lt;');
  }).join(' &nbsp;');
}
var CR_INPUT_CSS = 'width:60px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;background:var(--surface)';
function _srCrRowHtml_(from, color, first){
  return '<div class="cr-row" style="display:flex;gap:6px;align-items:center">'+
    '<input type="color" class="cr-color" value="'+esc(color)+'" style="width:34px;height:26px;padding:0;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer">'+
    '<span>Từ</span><input type="number" class="cr-from" min="0" max="100" step="0.1" value="'+from+'" '+(first?'disabled ':'')+'style="'+CR_INPUT_CSS+'">'+
    '<span>% trở lên</span>'+(first ? '<span style="color:var(--muted)">(mức thấp nhất)</span>' : '<button type="button" class="btn sm" onclick="_srCrDelRow(this)" title="Xoá mức này">✕</button>')+
  '</div>';
}
function _srCrFormHtml_(lv){
  return '<div class="close-rate-edit-form" style="display:none;flex-direction:column;gap:6px;margin:-4px 0 10px;padding:8px;background:var(--surface2);border-radius:6px;font-size:11.5px">'+
    '<div style="color:var(--muted)">Mỗi mức có 1 màu và tỷ lệ chốt bắt đầu từ bao nhiêu %. Thêm/bớt tuỳ ý (2–'+CLOSE_RATE_MAX_LEVELS+' mức).</div>'+
    '<div class="cr-rows" style="display:flex;flex-direction:column;gap:6px">'+lv.map(function(l,i){ return _srCrRowHtml_(l.from, l.color, i===0); }).join('')+'</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
      '<button type="button" class="btn sm" onclick="_srCrAddRow(this)">＋ Thêm mức</button>'+
      '<button type="button" class="btn sm" onclick="_srCrReset(this)">↺ Về mặc định (3 màu)</button>'+
      '<button type="button" class="btn sm primary" onclick="_srSaveCloseRateEdit(this)">Lưu</button>'+
    '</div></div>';
}
function _srToggleCloseRateEdit(a){
  var form = a.closest('div').nextElementSibling;
  if (form && form.classList.contains('close-rate-edit-form')) form.style.display = form.style.display==='none' ? 'flex' : 'none';
}
var CR_PALETTE = ['#dc2626','#ea580c','#d97706','#eab308','#84cc16','#16a34a','#0d9488','#2563eb'];
function _srCrAddRow(btn){
  var box = btn.closest('.close-rate-edit-form').querySelector('.cr-rows');
  var rows = box.querySelectorAll('.cr-row');
  if (rows.length >= CLOSE_RATE_MAX_LEVELS){ toast('⚠️ Tối đa '+CLOSE_RATE_MAX_LEVELS+' mức.'); return; }
  var froms = [].map.call(rows, function(r){ return parseFloat(r.querySelector('.cr-from').value) || 0; });
  var next = Math.min(100, Math.max.apply(null, froms) + 5);
  box.insertAdjacentHTML('beforeend', _srCrRowHtml_(next, CR_PALETTE[Math.min(rows.length, CR_PALETTE.length-1)], false));
}
function _srCrDelRow(btn){
  var box = btn.closest('.cr-rows');
  if (box.querySelectorAll('.cr-row').length <= CLOSE_RATE_MIN_LEVELS){ toast('⚠️ Cần ít nhất '+CLOSE_RATE_MIN_LEVELS+' mức.'); return; }
  btn.closest('.cr-row').remove();
}
function _srCrReset(btn){
  var form = btn.closest('.close-rate-edit-form');
  form.querySelector('.cr-rows').innerHTML = CLOSE_RATE_DEFAULT_LEVELS.map(function(l,i){ return _srCrRowHtml_(l.from, l.color, i===0); }).join('');
}
function _srSaveCloseRateEdit(btn){
  var form = btn.closest('.close-rate-edit-form');
  var lv = [].map.call(form.querySelectorAll('.cr-row'), function(r){ return { from: parseFloat(r.querySelector('.cr-from').value), color: r.querySelector('.cr-color').value }; });
  if (lv.length < CLOSE_RATE_MIN_LEVELS || lv.length > CLOSE_RATE_MAX_LEVELS){ toast('⚠️ Cần từ '+CLOSE_RATE_MIN_LEVELS+' đến '+CLOSE_RATE_MAX_LEVELS+' mức.'); return; }
  if (lv.some(function(x){ return isNaN(x.from) || x.from < 0 || x.from > 100; })){ toast('⚠️ Mốc % không hợp lệ (0–100).'); return; }
  lv[0].from = 0;
  var froms = lv.map(function(x){ return x.from; }).slice().sort(function(a,b){ return a-b; });
  for (var i = 1; i < froms.length; i++) if (froms[i] === froms[i-1]){ toast('⚠️ Hai mức đang trùng mốc '+froms[i]+'%. Mỗi mức cần 1 mốc % khác nhau.'); return; }
  _saveCloseRateThresholds(lv);
  form.style.display = 'none'; // ẩn form sau khi lưu
  toast('✓ Đã lưu '+lv.length+' mức màu Tỷ lệ chốt');
  if (_activeV9Tab === 'salesreport') renderSalesReportTab();
  if (_activeV9Tab === 'kpipancake') renderKpiPancakeTab();
}

function _srCocTh(){ return _srState.showCoc ? '<th style="text-align:right">Cọc</th>' : ''; }
function _srCocTd(v){ return _srState.showCoc ? '<td style="text-align:right">'+_srMoney(v)+'</td>' : ''; }
function _srCocColspan(base){ return _srState.showCoc ? base : base-1; }

// Báo cáo A ra 0 đơn: hiện bảng chẩn đoán từ backend (diag) — mất ở bước nào (dữ liệu / ngày / trạng thái / kênh / tên Sale) + tên Sale thật trong dữ liệu.
function _srZeroDiagA_(d){
  if (d && !d.totalOrders && !d.diag) {
    // Tự hỏi backend (action=count -> ver) rồi ghi vào khung: cho biết bản GAS đang chạy THẬT + web đang gọi qua Worker hay thẳng Apps Script.
    setTimeout(function(){
      var el = document.getElementById('sr-ver-probe'); if (!el) return;
      var via = (typeof GAS_URL_DIRECT !== 'undefined' && gsUrl === GAS_URL_DIRECT) ? 'gọi THẲNG Apps Script' : 'gọi qua Worker cache';
      fetch(gsUrl + (gsUrl.indexOf('?') >= 0 ? '&' : '?') + 'action=count&_=' + Date.now(), { redirect: 'follow' }).then(function(r){ return r.text(); }).then(function(t){
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        el.textContent = j && j.ver ? ('Bản backend đang chạy: ' + j.ver + ' (' + via + '). Bản mới nhất có chẩn đoán là v13.56-diag-a' + (j.ver === 'v13.56-diag-a' ? ' → ĐÃ là bản mới.' : ' → CHƯA phải bản mới.')) : ('Không đọc được phiên bản backend (' + via + '): ' + String(t).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 140));
      }).catch(function(er){ el.textContent = 'Không gọi được backend (' + via + '): ' + (er && er.message || er); });
    }, 0);
    return '<div class="fp-info" style="margin:0 0 12px"><b>⚠ 0 đơn</b> — máy chủ <b>không trả phần chẩn đoán</b> (bản backend GAS chạy thật chưa phải bản mới, hoặc Worker đang trả bản cache cũ).<br><span id="sr-ver-probe" style="font-size:12px"><i>Đang kiểm tra phiên bản backend…</i></span></div>';
  }
  var g = d && d.diag; if (!g || d.totalOrders) return '';
  var why;
  if (!g.rows) why = 'Nguồn dữ liệu đơn (DT TỔNG) đang <b>trống</b> — kiểm tra sheet DT TỔNG / đồng bộ Supabase.';
  else if (!g.inDate) why = 'Có ' + g.rows + ' đơn trong dữ liệu nhưng <b>không đơn nào nằm trong khoảng ngày đã chọn</b> (dữ liệu từ ' + e_(g.dateMin) + ' đến ' + e_(g.dateMax) + (g.badDate ? '; ' + g.badDate + ' dòng sai định dạng ngày, vd “' + e_(g.sampleDate) + '”' : '') + ').';
  else if (!g.notExcluded) why = 'Trong ngày có ' + g.inDate + ' đơn nhưng <b>tất cả bị loại do trạng thái</b> (Thất bại).';
  else if (!g.afterKenh) why = 'Còn ' + g.notExcluded + ' đơn nhưng <b>không đơn nào thuộc Kênh đã chọn</b>.';
  else if (!g.afterSale) why = 'Còn ' + g.afterKenh + ' đơn trong ngày nhưng <b>không đơn nào có Sale trùng bộ lọc Sale</b> (' + g.saleFilterN + ' tên đang lọc). Tên Sale thật trên các đơn đó bên dưới — gắn thẻ/Khớp sale cho đúng tên này.';
  else why = 'Còn ' + g.afterSale + ' đơn nhưng bị loại ở bộ lọc Sản phẩm.';
  return '<div class="fp-info" style="margin:0 0 12px"><b>⚠ 0 đơn — vì sao?</b><br>' + why +
    '<br><span style="font-size:11px;color:var(--muted)">Dòng dữ liệu: ' + g.rows + ' → trong ngày: ' + g.inDate + ' → không bị hủy/trả: ' + g.notExcluded + ' → đúng kênh: ' + g.afterKenh + ' → đúng Sale: ' + g.afterSale + '</span>' +
    ((g.missNames && g.missNames.length && g.inDate) ? '<br><span style="font-size:11.5px"><b>Tên Sale trên các đơn bị loại (nhiều nhất):</b> ' + g.missNames.map(e_).join(', ') + '</span>' : '') + '</div>';
}
function e_(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
// Khi đang lọc theo Sale/Team: đơn có nhiều sale (vd "Kd + kế toán + Mến") khiến người ĐỒNG BÁN không thuộc bộ lọc cũng hiện thành 1 dòng trong bảng "Theo Sale".
// Chỉ giữ các dòng thuộc người đã chọn (kể cả tên phụ cùng 1 người). Tổng/tiền chia đều vẫn do máy chủ tính, không đổi.
function _srKeepSelectedSales_(rows, sel){
  if (!sel || !sel.length || _srState.byCreator) return rows;   // chế độ 'người tạo đơn': dòng là người tạo, không lọc theo Sale bán
  var fold = function(x){ return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').replace(/\s+/g,' ').trim().toLowerCase(); };
  var ok = {};
  sel.forEach(function(n){ ok[fold(n)] = 1; ((typeof _personAliases === 'function' ? _personAliases(n) : []) || []).forEach(function(a){ ok[fold(a)] = 1; }); });
  return (rows || []).filter(function(r){ return ok[fold(r && r.name)]; });
}
function _srRenderA(d){
  if (!d) return _srNoDataHtml_();
  var html = _srZeroDiagA_(d) + '<div class="kpi-grid" style="margin-bottom:16px">' +
    '<div class="kpi-card"><div class="kpi-val">'+fmt(d.totalOrders)+'</div><div class="kpi-label">Số lượng đơn</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.totalCoc)+'</div><div class="kpi-label">Tổng tiền đã cọc/CK (tham khảo)</div></div>' +
    (d.totalGiaTriChenh ? '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.totalGiaTriChenh)+'</div><div class="kpi-label">Trong đó: chênh lệch đơn đổi</div></div>' : '') +
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_srMoney(d.totalGiaTri)+'</div><div class="kpi-label"><b>Tổng đơn (doanh thu, ko ship)</b></div></div>' +
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.trungBinhDon)+'</div><div class="kpi-label">Trung bình đơn (Tổng đơn ÷ số đơn)</div></div>' +
    _srCloseRateKpiCard_(d) +
    '</div>' +
    '<div style="font-size:11px;color:var(--muted);margin:-10px 0 10px">Tổng đơn = cộng dồn "Tổng giá trị đơn hàng" (không ship) của TỪNG đơn + phần "Giá trị chênh lệch" của riêng các đơn đổi hàng — đây mới là số doanh thu chuẩn để đối chiếu, không phải cột Cọc.</div>' +
    '<label style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);margin-bottom:12px;cursor:pointer">'+
      '<input type="checkbox" '+(_srState.showCoc!==false?'checked':'')+' onchange="_srState.showCoc=this.checked;renderSalesReportTab()"> Hiện cột Cọc trong các bảng bên dưới'+
    '</label>';

  _SR_COLTH_ROWSFN_['aSale'] = function(){ return (_srState.dataA && _srState.dataA.bySale) || []; };
  _SR_COLTH_GETTER_['aSale'] = { name: function(r){ return r.name; } };
  var saleRows = _srApplyColFilters_(_srKeepSelectedSales_(d.bySale||[], _srState.sale), 'aSale', _SR_COLTH_GETTER_['aSale']).filter(function(s){ return !_srState.saleSearch || s.name.toLowerCase().indexOf(_srState.saleSearch.toLowerCase())!==-1; });
  var saleHtml = '<div class="dash-section-title">Theo Sale bán <span style="font-weight:400;color:var(--muted);font-size:11px">'+
    (_srState.byCreator ? '(tính trọn vẹn cho người tạo đơn — không chia đều)' : '(số đơn giữ nguyên — tiền chia đều cho số sale/đơn)')+
    '</span>'+_srViewToggleHtml('aSaleView')+'</div>';
  saleHtml += '<input type="text" placeholder="🔍 Tìm nhanh theo tên sale..." value="'+esc(_srState.saleSearch)+'" oninput="_srState.saleSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
  if (_srState.aSaleView === 'table'){
    saleHtml += '<table class="dash-table"><thead><tr>'+_srColTh_('aSale','name','Sale',_SR_COLTH_ROWSFN_['aSale'],_SR_COLTH_GETTER_['aSale'].name)+'<th style="text-align:right">Số đơn</th>'+_srCocTh()+'<th style="text-align:right"><b>Tổng đơn</b></th><th style="text-align:right">TB đơn</th></tr></thead><tbody>';
    saleRows.forEach(function(s){
      saleHtml += '<tr><td>'+esc(s.name)+'</td><td style="text-align:right">'+fmt(s.orders)+'</td>'+_srCocTd(s.coc)+'<td style="text-align:right"><b>'+_srMoney(s.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(s.trungBinhDon)+'</td></tr>';
    });
    if (!saleRows.length) saleHtml += '<tr><td colspan="'+_srCocColspan(5)+'" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
    else {
      var saleTotOrders = saleRows.reduce(function(s,r){ return s+(r.orders||0); },0);
      var saleTotCoc = saleRows.reduce(function(s,r){ return s+(r.coc||0); },0);
      var saleTotGT = saleRows.reduce(function(s,r){ return s+(r.giaTri||0); },0);
      var saleTotCells = ['Tổng', fmt(saleTotOrders)];
      if (_srState.showCoc) saleTotCells.push(_srMoney(saleTotCoc));
      saleTotCells.push(_srMoney(saleTotGT), _srMoney(saleTotOrders?saleTotGT/saleTotOrders:0));
      saleHtml += _srTotalRowHtml_(saleTotCells);
    }
    saleHtml += '</tbody></table>';
  } else {
    saleHtml += _srChartSvg(saleRows, 'name', 'giaTri', _srState.aSaleView, true, 'orders');
  }
  // Tỷ lệ chốt theo Sale — đặt BÊN CẠNH biểu đồ doanh thu theo Sale (2 cột, tự xuống dòng trên màn hẹp)
  // Công thức: Số đơn trong kỳ / Tổng tương tác Pancake trong kỳ (byCS), tính THEO TỪNG SALE
  // riêng lẻ (không gộp nhiều sale vào 1 dòng), và chỉ tính từ ngày có dữ liệu tương tác Pancake
  // trở đi (xem saleCloseRateFrom, bo qua nếu chưa từng nạp báo cáo Pancake ngày nào).
  var saleCloseNote = d.saleCloseRateFrom ? ' — tính từ '+esc(d.saleCloseRateFrom) : '';
  var saleCloseHtml = '<div class="dash-section-title">Tỷ lệ chốt theo Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn Base ÷ Tổng tương tác Pancake'+saleCloseNote+')</span></div>'+
    (d.saleCloseRateFrom ? _srCloseRateBarHtml_(d.saleCloseRate, _srState.saleSearch, 'tương tác', d.saleCloseRateExcluded) :
      '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Chưa nạp báo cáo tương tác Pancake ngày nào — vào tab "📥 Báo cáo Pancake" để nạp trước khi xem tỷ lệ chốt theo Sale.</div>');
  html += '<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start">'+
    '<div style="flex:1 1 380px;min-width:320px">'+saleHtml+'</div>'+
    '<div style="flex:1 1 320px;min-width:280px">'+saleCloseHtml+'</div>'+
    '</div>';

  // Bang Ty le chot theo Sale x TUNG PAGE rieng + cot Tong ca nhan — theo yeu cau Duyen, de
  // moi Sale doi chieu duoc phong do tren tung Page rieng thay vi chi 1 con so gop chung.
  if (d.saleCloseByPage && d.saleCloseByPage.pages && d.saleCloseByPage.pages.length){
    var scbp = d.saleCloseByPage;
    var scbpRows = scbp.rows.filter(function(r){ return !_srState.saleSearch || r.name.toLowerCase().indexOf(_srState.saleSearch.toLowerCase())!==-1; });
    scbpRows.sort(function(a,b){ return b.total.rate - a.total.rate; });
    html += '<div class="dash-section-title" style="margin-top:18px">Tỷ lệ chốt theo Sale — từng Page<span style="font-weight:400;color:var(--muted);font-size:11px">'+saleCloseNote+'</span></div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Sale</th>'+
      scbp.pages.map(function(p){ return '<th style="text-align:right">'+esc(p.pageName)+'</th>'; }).join('')+
      '<th style="text-align:right"><b>Tổng cá nhân</b></th></tr></thead><tbody>';
    if (!scbpRows.length){
      html += '<tr><td colspan="'+(scbp.pages.length+2)+'" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
    } else {
      scbpRows.forEach(function(r){
        html += '<tr><td>'+esc(r.name)+'</td>'+
          scbp.pages.map(function(p){
            var cell = r.perPage[p.kenhBan];
            if (!cell || !cell.held) return '<td style="text-align:right;color:var(--muted)">—</td>';
            return '<td style="text-align:right">'+cell.rate+'% <span style="color:var(--muted);font-size:10.5px">('+cell.closed+'/'+cell.held+')</span></td>';
          }).join('')+
          '<td style="text-align:right"><b>'+r.total.rate+'%</b> <span style="color:var(--muted);font-size:10.5px">('+r.total.closed+'/'+r.total.held+')</span></td></tr>';
      });
    }
    html += '</tbody></table></div>';
  }

  if (_srIsAdmin()){
    _SR_COLTH_ROWSFN_['aTeam'] = function(){ return (_srState.dataA && _srState.dataA.byTeamSale) || []; };
    _SR_COLTH_GETTER_['aTeam'] = { name: function(r){ return r.name; } };
    var teamRows = _srApplyColFilters_(d.byTeamSale||[], 'aTeam', _SR_COLTH_GETTER_['aTeam']).filter(function(t){ return !_srState.teamSearch || t.name.toLowerCase().indexOf(_srState.teamSearch.toLowerCase())!==-1; });
    var teamHtml = '<div class="dash-section-title">Theo Team Sale'+_srViewToggleHtml('aTeamView')+'</div>';
    teamHtml += '<input type="text" placeholder="🔍 Tìm nhanh theo tên team..." value="'+esc(_srState.teamSearch)+'" oninput="_srState.teamSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
    if (_srState.aTeamView === 'table'){
      teamHtml += '<table class="dash-table"><thead><tr>'+_srColTh_('aTeam','name','Team Sale',_SR_COLTH_ROWSFN_['aTeam'],_SR_COLTH_GETTER_['aTeam'].name)+'<th style="text-align:right">Số đơn</th>'+_srCocTh()+'<th style="text-align:right"><b>Tổng đơn</b></th><th style="text-align:right">TB đơn</th></tr></thead><tbody>';
      teamRows.forEach(function(t){
        teamHtml += '<tr><td>'+esc(t.name)+'</td><td style="text-align:right">'+fmt(t.orders)+'</td>'+_srCocTd(t.coc)+'<td style="text-align:right"><b>'+_srMoney(t.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(t.trungBinhDon)+'</td></tr>';
      });
      if (!teamRows.length) teamHtml += '<tr><td colspan="'+_srCocColspan(5)+'" style="text-align:center;color:var(--muted);padding:14px">Chưa có Team nào — vào tab "Quản lý Team" để tạo và thêm thành viên.</td></tr>';
      else {
        var teamTotOrders = teamRows.reduce(function(s,r){ return s+(r.orders||0); },0);
        var teamTotCoc = teamRows.reduce(function(s,r){ return s+(r.coc||0); },0);
        var teamTotGT = teamRows.reduce(function(s,r){ return s+(r.giaTri||0); },0);
        var teamTotCells = ['Tổng', fmt(teamTotOrders)];
        if (_srState.showCoc) teamTotCells.push(_srMoney(teamTotCoc));
        teamTotCells.push(_srMoney(teamTotGT), _srMoney(teamTotOrders?teamTotGT/teamTotOrders:0));
        teamHtml += _srTotalRowHtml_(teamTotCells);
      }
      teamHtml += '</tbody></table>';
    } else {
      teamHtml += _srChartSvg(teamRows, 'name', 'giaTri', _srState.aTeamView, true);
    }
    html += teamHtml;

    _SR_COLTH_ROWSFN_['aKenh'] = function(){ return (_srState.dataA && _srState.dataA.byKenh) || []; };
    _SR_COLTH_GETTER_['aKenh'] = { name: function(r){ return r.name; } };
    var kenhRows = _srApplyColFilters_(d.byKenh||[], 'aKenh', _SR_COLTH_GETTER_['aKenh']).filter(function(k){ return !_srState.kenhSearch || k.name.toLowerCase().indexOf(_srState.kenhSearch.toLowerCase())!==-1; });
    var kenhHtml = '<div class="dash-section-title">Theo Kênh bán'+_srViewToggleHtml('aKenhView')+'</div>';
    kenhHtml += '<input type="text" placeholder="🔍 Tìm nhanh theo tên kênh..." value="'+esc(_srState.kenhSearch)+'" oninput="_srState.kenhSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
    if (_srState.aKenhView === 'table'){
      kenhHtml += '<table class="dash-table"><thead><tr>'+_srColTh_('aKenh','name','Kênh',_SR_COLTH_ROWSFN_['aKenh'],_SR_COLTH_GETTER_['aKenh'].name)+'<th style="text-align:right">Số đơn</th>'+_srCocTh()+'<th style="text-align:right"><b>Tổng đơn</b></th><th style="text-align:right">TB đơn</th></tr></thead><tbody>';
      kenhRows.forEach(function(k){
        kenhHtml += '<tr><td>'+esc(k.name)+'</td><td style="text-align:right">'+fmt(k.orders)+'</td>'+_srCocTd(k.coc)+'<td style="text-align:right"><b>'+_srMoney(k.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(k.trungBinhDon)+'</td></tr>';
      });
      if (!kenhRows.length) kenhHtml += '<tr><td colspan="'+_srCocColspan(5)+'" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
      else {
        var kenhTotOrders = kenhRows.reduce(function(s,r){ return s+(r.orders||0); },0);
        var kenhTotCoc = kenhRows.reduce(function(s,r){ return s+(r.coc||0); },0);
        var kenhTotGT = kenhRows.reduce(function(s,r){ return s+(r.giaTri||0); },0);
        var kenhTotCells = ['Tổng', fmt(kenhTotOrders)];
        if (_srState.showCoc) kenhTotCells.push(_srMoney(kenhTotCoc));
        kenhTotCells.push(_srMoney(kenhTotGT), _srMoney(kenhTotOrders?kenhTotGT/kenhTotOrders:0));
        kenhHtml += _srTotalRowHtml_(kenhTotCells);
      }
      kenhHtml += '</tbody></table>';
    } else {
      kenhHtml += _srChartSvg(kenhRows, 'name', 'giaTri', _srState.aKenhView, true, 'orders');
    }
    // Tỷ lệ chốt theo Kênh — cũng đặt bên cạnh biểu đồ doanh thu theo Kênh. Công thức: Số đơn
    // bán từ kênh / Tổng tương tác Pancake của (các) Page đã khớp với kênh đó — CHỈ tính được
    // từ ngày có dữ liệu tương tác Pancake trở đi (xem kenhCloseRateFrom), giống hệt cách làm
    // ở "Tỷ lệ chốt theo Sale".
    var kenhCloseNote = d.kenhCloseRateFrom ? ' — tính từ '+esc(d.kenhCloseRateFrom) : '';
    var kenhCloseHtml = '<div class="dash-section-title">Tỷ lệ chốt theo Kênh <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn Base ÷ Tổng tương tác Pancake'+kenhCloseNote+')</span></div>'+
      (d.kenhCloseRateFrom ? _srCloseRateBarHtml_(d.kenhCloseRate, _srState.kenhSearch, 'tương tác') :
        '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Chưa nạp báo cáo tương tác Pancake ngày nào — vào tab "📥 Báo cáo Pancake" để nạp trước khi xem tỷ lệ chốt theo Kênh.</div>');
    html += '<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start">'+
      '<div style="flex:1 1 380px;min-width:320px">'+kenhHtml+'</div>'+
      '<div style="flex:1 1 320px;min-width:280px">'+kenhCloseHtml+'</div>'+
      '</div>';
    html += '<div class="dash-section-title">Theo MKT'+_srViewToggleHtml('aMktView')+'</div>';
    _SR_COLTH_ROWSFN_['aMkt'] = function(){ return (_srState.dataA && _srState.dataA.byMkt) || []; };
    _SR_COLTH_GETTER_['aMkt'] = { name: function(r){ return r.name; } };
    var mktRowsF = _srApplyColFilters_(d.byMkt||[], 'aMkt', _SR_COLTH_GETTER_['aMkt']);
    if (_srState.aMktView === 'table'){
      html += '<table class="dash-table"><thead><tr>'+_srColTh_('aMkt','name','MKT',_SR_COLTH_ROWSFN_['aMkt'],_SR_COLTH_GETTER_['aMkt'].name)+'<th style="text-align:right">Số đơn</th>'+_srCocTh()+'<th style="text-align:right"><b>Tổng đơn</b></th><th style="text-align:right">TB đơn</th></tr></thead><tbody>';
      mktRowsF.forEach(function(k){
        html += '<tr><td>'+esc(k.name)+'</td><td style="text-align:right">'+fmt(k.orders)+'</td>'+_srCocTd(k.coc)+'<td style="text-align:right"><b>'+_srMoney(k.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(k.trungBinhDon)+'</td></tr>';
      });
      if (!mktRowsF.length) html += '<tr><td colspan="'+_srCocColspan(5)+'" style="text-align:center;color:var(--muted);padding:14px">Chưa có nhóm MKT — vào tab Team → "Nhóm MKT" để tạo.</td></tr>';
      else {
        var mktTotOrders = mktRowsF.reduce(function(s,r){ return s+(r.orders||0); },0);
        var mktTotCoc = mktRowsF.reduce(function(s,r){ return s+(r.coc||0); },0);
        var mktTotGT = mktRowsF.reduce(function(s,r){ return s+(r.giaTri||0); },0);
        var mktTotCells = ['Tổng', fmt(mktTotOrders)];
        if (_srState.showCoc) mktTotCells.push(_srMoney(mktTotCoc));
        mktTotCells.push(_srMoney(mktTotGT), _srMoney(mktTotOrders?mktTotGT/mktTotOrders:0));
        html += _srTotalRowHtml_(mktTotCells);
      }
      html += '</tbody></table>';
    } else {
      html += _srChartSvg(mktRowsF, 'name', 'giaTri', _srState.aMktView, true, 'orders');
    }
  }
  return html;
}

function _srRenderB(d){
  if (!d) return _srNoDataHtml_();
  var bTb = d.totalOrders ? Math.round(d.totalGiaTri/d.totalOrders) : 0;
  var html = '<div class="kpi-grid" style="margin-bottom:16px">' +
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+fmt(d.totalOrders)+'</div><div class="kpi-label"><b>Số lượng đơn</b></div></div>' +
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_srMoney(d.totalGiaTri)+'</div><div class="kpi-label"><b>Tổng giá trị đơn hàng sau giảm giá</b></div></div>' +
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(bTb)+'</div><div class="kpi-label">Trung bình đơn</div></div>' +
    _srCloseRateKpiCard_(d) +
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.totalCod)+'</div><div class="kpi-label">Tổng COD</div></div>' +
    '</div>';

  // Da bo 2 dong thong bao vang (lech so phan tu cot San pham/Ma/So luong + thong ke ghep don Pos<->Base) theo yeu cau Duyen 2026-10-05.
  // Du lieu d.mismatchRows / d.ghep van duoc backend tra ve (dung de debug), chi khong hien tren man hinh nua.

  _SR_COLTH_ROWSFN_['bSale'] = function(){ return (_srState.dataB && _srState.dataB.bySale) || []; };
  _SR_COLTH_GETTER_['bSale'] = { name: function(s){ return s.name; } };
  var saleRows = _srApplyColFilters_(_srKeepSelectedSales_(d.bySale||[], _srState.bSale), 'bSale', _SR_COLTH_GETTER_['bSale']).filter(function(s){ return !_srState.bSaleSearch || (s.name||'').toLowerCase().indexOf(_srState.bSaleSearch.toLowerCase())!==-1; });
  var saleHtmlB_ = '<div class="dash-section-title">Theo Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(tiền chia đều cho số sale/đơn, số đơn giữ nguyên)</span>'+_srViewToggleHtml('bSaleView')+'</div>';
  saleHtmlB_ += '<input type="text" placeholder="🔍 Tìm nhanh theo tên sale..." value="'+esc(_srState.bSaleSearch)+'" oninput="_srState.bSaleSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
  if (_srState.bSaleView === 'table'){
    saleHtmlB_ += '<table class="dash-table"><thead><tr>'+_srColTh_('bSale','name','Sale',_SR_COLTH_ROWSFN_['bSale'],_SR_COLTH_GETTER_['bSale'].name)+'<th style="text-align:right">Số đơn</th><th style="text-align:right">Giá trị sau giảm giá</th><th style="text-align:right">TB đơn</th><th style="text-align:right">COD</th></tr></thead><tbody>';
    saleRows.forEach(function(s){
      var tb = s.orders ? Math.round(s.giaTri/s.orders) : 0;
      saleHtmlB_ += '<tr><td>'+esc(s.name)+'</td><td style="text-align:right">'+fmt(s.orders)+'</td><td style="text-align:right">'+_srMoney(s.giaTri)+'</td><td style="text-align:right">'+_srMoney(tb)+'</td><td style="text-align:right">'+_srMoney(s.cod)+'</td></tr>';
    });
    if (!saleRows.length) saleHtmlB_ += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
    else { var bSOrd=saleRows.reduce(function(s,r){return s+(r.orders||0);},0), bSGt=saleRows.reduce(function(s,r){return s+(r.giaTri||0);},0);
      saleHtmlB_ += _srTotalRowHtml_(['Tổng', fmt(bSOrd), _srMoney(bSGt), _srMoney(bSOrd?Math.round(bSGt/bSOrd):0), _srMoney(saleRows.reduce(function(s,r){return s+(r.cod||0);},0))]); }
    saleHtmlB_ += '</tbody></table>';
  } else {
    saleHtmlB_ += _srChartSvg(saleRows, 'name', 'giaTri', _srState.bSaleView, true, 'orders');
  }
  // Tỷ lệ chốt theo Sale — đặt bên cạnh "Theo Sale", cùng công thức/hàm dùng chung với Báo cáo A.
  var bSaleCloseNote = d.saleCloseRateFrom ? ' — tính từ '+esc(d.saleCloseRateFrom) : '';
  var saleCloseHtmlB_ = '<div class="dash-section-title">Tỷ lệ chốt theo Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn Base ÷ Tổng tương tác Pancake'+bSaleCloseNote+')</span></div>'+
    (d.saleCloseRateFrom ? _srCloseRateBarHtml_(d.saleCloseRate, _srState.bSaleSearch, 'tương tác', d.saleCloseRateExcluded) :
      '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Chưa nạp báo cáo tương tác Pancake ngày nào — vào tab "📥 Báo cáo Pancake" để nạp trước khi xem tỷ lệ chốt theo Sale.</div>');
  html += '<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start">'+
    '<div style="flex:1 1 380px;min-width:320px">'+saleHtmlB_+'</div>'+
    '<div style="flex:1 1 320px;min-width:280px">'+saleCloseHtmlB_+'</div>'+
    '</div>';

  // Tỷ lệ chốt theo Sale — từng Page (chỉ gồm Page đã trích được ID từ "Nguồn đơn" và khớp PancakePageMap).
  if (d.saleCloseByPage && d.saleCloseByPage.pages && d.saleCloseByPage.pages.length){
    var scbpB_ = d.saleCloseByPage;
    var scbpRowsB_ = scbpB_.rows.filter(function(r){ return !_srState.bSaleSearch || r.name.toLowerCase().indexOf(_srState.bSaleSearch.toLowerCase())!==-1; });
    scbpRowsB_.sort(function(a,b){ return b.total.rate - a.total.rate; });
    html += '<div class="dash-section-title" style="margin-top:18px">Tỷ lệ chốt theo Sale — từng Page<span style="font-weight:400;color:var(--muted);font-size:11px"> (Số đơn Base ÷ Tổng tương tác Pancake'+bSaleCloseNote+')</span></div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Sale</th>'+
      scbpB_.pages.map(function(p){ return '<th style="text-align:right">'+esc(p.pageName)+'</th>'; }).join('')+
      '<th style="text-align:right"><b>Tổng cá nhân</b></th></tr></thead><tbody>';
    if (!scbpRowsB_.length){
      html += '<tr><td colspan="'+(scbpB_.pages.length+2)+'" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
    } else {
      scbpRowsB_.forEach(function(r){
        html += '<tr><td>'+esc(r.name)+'</td>'+
          scbpB_.pages.map(function(p){
            var cell = r.perPage[p.kenhBan];
            if (!cell || !cell.held) return '<td style="text-align:right;color:var(--muted)">—</td>';
            return '<td style="text-align:right">'+cell.rate+'% <span style="color:var(--muted);font-size:10.5px">('+cell.closed+'/'+cell.held+')</span></td>';
          }).join('')+
          '<td style="text-align:right"><b>'+r.total.rate+'%</b> <span style="color:var(--muted);font-size:10.5px">('+r.total.closed+'/'+r.total.held+')</span></td></tr>';
      });
    }
    html += '</tbody></table></div>';
  }

  if (_srIsAdmin()){
    // Theo Team Sale — cung bang/bieu do nhu Bao cao A, du lieu tu byTeamSale moi tra ve tu backend.
    _SR_COLTH_ROWSFN_['bTeam'] = function(){ return (_srState.dataB && _srState.dataB.byTeamSale) || []; };
    _SR_COLTH_GETTER_['bTeam'] = { name: function(r){ return r.name; } };
    var bTeamRows = _srApplyColFilters_(d.byTeamSale||[], 'bTeam', _SR_COLTH_GETTER_['bTeam']).filter(function(t){ return !_srState.bTeamSearch || t.name.toLowerCase().indexOf(_srState.bTeamSearch.toLowerCase())!==-1; });
    html += '<div class="dash-section-title" style="margin-top:18px">Theo Team Sale'+_srViewToggleHtml('bTeamView')+'</div>';
    html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên team..." value="'+esc(_srState.bTeamSearch)+'" oninput="_srState.bTeamSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
    if (_srState.bTeamView === 'table'){
      html += '<table class="dash-table"><thead><tr>'+_srColTh_('bTeam','name','Team Sale',_SR_COLTH_ROWSFN_['bTeam'],_SR_COLTH_GETTER_['bTeam'].name)+'<th style="text-align:right">Số đơn</th><th style="text-align:right"><b>Giá trị sau giảm giá</b></th><th style="text-align:right">TB đơn</th><th style="text-align:right">COD</th></tr></thead><tbody>';
      bTeamRows.forEach(function(t){
        html += '<tr><td>'+esc(t.name)+'</td><td style="text-align:right">'+fmt(t.orders)+'</td><td style="text-align:right"><b>'+_srMoney(t.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(t.trungBinhDon)+'</td><td style="text-align:right">'+_srMoney(t.cod)+'</td></tr>';
      });
      if (!bTeamRows.length) html += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Chưa có Team nào — vào tab "Quản lý Team" để tạo và thêm thành viên.</td></tr>';
      else { var bTOrd=bTeamRows.reduce(function(s,r){return s+(r.orders||0);},0), bTGt=bTeamRows.reduce(function(s,r){return s+(r.giaTri||0);},0);
        html += _srTotalRowHtml_(['Tổng', fmt(bTOrd), '<b>'+_srMoney(bTGt)+'</b>', _srMoney(bTOrd?Math.round(bTGt/bTOrd):0), _srMoney(bTeamRows.reduce(function(s,r){return s+(r.cod||0);},0))]); }
      html += '</tbody></table>';
    } else {
      html += _srChartSvg(bTeamRows, 'name', 'giaTri', _srState.bTeamView, true, 'orders');
    }

    // Theo Nguồn đơn — tương đương vị trí "Theo Kênh bán" của Báo cáo A, nay đã có "Tỷ lệ chốt"
    // đi kèm nhờ trích được ID Page từ cuối chuỗi "Nguồn đơn" (khớp PancakePageMap).
    _SR_COLTH_ROWSFN_['bNguon'] = function(){ return (_srState.dataB && _srState.dataB.byNguon) || []; };
    _SR_COLTH_GETTER_['bNguon'] = { name: function(r){ return r.name; } };
    var bNguonRows = _srApplyColFilters_(d.byNguon||[], 'bNguon', _SR_COLTH_GETTER_['bNguon']).filter(function(k){ return !_srState.bNguonSearch || k.name.toLowerCase().indexOf(_srState.bNguonSearch.toLowerCase())!==-1; });
    var nguonHtmlB_ = '<div class="dash-section-title">Theo Nguồn đơn'+_srViewToggleHtml('bNguonView')+'</div>';
    nguonHtmlB_ += '<input type="text" placeholder="🔍 Tìm nhanh theo nguồn đơn..." value="'+esc(_srState.bNguonSearch)+'" oninput="_srState.bNguonSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
    if (_srState.bNguonView === 'table'){
      nguonHtmlB_ += '<table class="dash-table"><thead><tr>'+_srColTh_('bNguon','name','Nguồn đơn',_SR_COLTH_ROWSFN_['bNguon'],_SR_COLTH_GETTER_['bNguon'].name)+'<th style="text-align:right">Số đơn</th><th style="text-align:right"><b>Giá trị sau giảm giá</b></th><th style="text-align:right">TB đơn</th><th style="text-align:right">COD</th></tr></thead><tbody>';
      bNguonRows.forEach(function(k){
        nguonHtmlB_ += '<tr><td>'+esc(k.name)+'</td><td style="text-align:right">'+fmt(k.orders)+'</td><td style="text-align:right"><b>'+_srMoney(k.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(k.trungBinhDon)+'</td><td style="text-align:right">'+_srMoney(k.cod)+'</td></tr>';
      });
      if (!bNguonRows.length) nguonHtmlB_ += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
      else { var bNOrd=bNguonRows.reduce(function(s,r){return s+(r.orders||0);},0), bNGt=bNguonRows.reduce(function(s,r){return s+(r.giaTri||0);},0);
        nguonHtmlB_ += _srTotalRowHtml_(['Tổng', fmt(bNOrd), '<b>'+_srMoney(bNGt)+'</b>', _srMoney(bNOrd?Math.round(bNGt/bNOrd):0), _srMoney(bNguonRows.reduce(function(s,r){return s+(r.cod||0);},0))]); }
      nguonHtmlB_ += '</tbody></table>';
    } else {
      nguonHtmlB_ += _srChartSvg(bNguonRows, 'name', 'giaTri', _srState.bNguonView, true, 'orders');
    }
    // Tỷ lệ chốt theo Nguồn đơn — ghép từ "kenhCloseRate" (tên gọi nội bộ kế thừa từ Báo cáo A;
    // với B, kenh đã được suy ra từ ID Page trong "Nguồn đơn" nên vẫn đúng khái niệm).
    var bKenhCloseNote = d.kenhCloseRateFrom ? ' — tính từ '+esc(d.kenhCloseRateFrom) : '';
    var nguonCloseHtmlB_ = '<div class="dash-section-title">Tỷ lệ chốt theo Nguồn đơn <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn Base ÷ Tổng tương tác Pancake'+bKenhCloseNote+' — chỉ tính được các dòng Nguồn đơn có kèm ID Page, vd "Facebook / Tên Page (ID)")</span></div>'+
      (d.kenhCloseRateFrom ? _srCloseRateBarHtml_(d.kenhCloseRate, _srState.bNguonSearch, 'tương tác') :
        '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Chưa nạp báo cáo tương tác Pancake ngày nào — vào tab "📥 Báo cáo Pancake" để nạp trước khi xem tỷ lệ chốt theo Nguồn.</div>');
    html += '<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start">'+
      '<div style="flex:1 1 380px;min-width:320px">'+nguonHtmlB_+'</div>'+
      '<div style="flex:1 1 320px;min-width:280px">'+nguonCloseHtmlB_+'</div>'+
      '</div>';

    // Theo MKT — lay truc tiep tu cot "Marketer" co san tren tung dong cua Bao cao B (don gian
    // va chinh xac hon cach suy ra qua Page/Kenh cua Bao cao A).
    _SR_COLTH_ROWSFN_['bMkt'] = function(){ return (_srState.dataB && _srState.dataB.byMkt) || []; };
    _SR_COLTH_GETTER_['bMkt'] = { name: function(r){ return r.name; } };
    var bMktRows = _srApplyColFilters_(d.byMkt||[], 'bMkt', _SR_COLTH_GETTER_['bMkt']).filter(function(k){ return !_srState.bMktSearch || k.name.toLowerCase().indexOf(_srState.bMktSearch.toLowerCase())!==-1; });
    html += '<div class="dash-section-title" style="margin-top:18px">Theo MKT'+_srViewToggleHtml('bMktView')+'</div>';
    html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên MKT..." value="'+esc(_srState.bMktSearch)+'" oninput="_srState.bMktSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
    if (_srState.bMktView === 'table'){
      html += '<table class="dash-table"><thead><tr>'+_srColTh_('bMkt','name','MKT',_SR_COLTH_ROWSFN_['bMkt'],_SR_COLTH_GETTER_['bMkt'].name)+'<th style="text-align:right">Số đơn</th><th style="text-align:right"><b>Giá trị sau giảm giá</b></th><th style="text-align:right">TB đơn</th><th style="text-align:right">COD</th></tr></thead><tbody>';
      bMktRows.forEach(function(k){
        html += '<tr><td>'+esc(k.name)+'</td><td style="text-align:right">'+fmt(k.orders)+'</td><td style="text-align:right"><b>'+_srMoney(k.giaTri)+'</b></td><td style="text-align:right">'+_srMoney(k.trungBinhDon)+'</td><td style="text-align:right">'+_srMoney(k.cod)+'</td></tr>';
      });
      if (!bMktRows.length) html += '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">Chưa có nhóm MKT — vào tab Team → "Nhóm MKT" để tạo.</td></tr>';
      else { var bMOrd=bMktRows.reduce(function(s,r){return s+(r.orders||0);},0), bMGt=bMktRows.reduce(function(s,r){return s+(r.giaTri||0);},0);
        html += _srTotalRowHtml_(['Tổng', fmt(bMOrd), '<b>'+_srMoney(bMGt)+'</b>', _srMoney(bMOrd?Math.round(bMGt/bMOrd):0), _srMoney(bMktRows.reduce(function(s,r){return s+(r.cod||0);},0))]); }
      html += '</tbody></table>';
    } else {
      html += _srChartSvg(bMktRows, 'name', 'giaTri', _srState.bMktView, true, 'orders');
    }

    var productRows = (d.products||[]).filter(function(p){ return !_srState.productSearch || (p.name||'').toLowerCase().indexOf(_srState.productSearch.toLowerCase())!==-1 || (p.code||'').toLowerCase().indexOf(_srState.productSearch.toLowerCase())!==-1; });
    html += '<div class="dash-section-title" style="margin-top:18px">Báo cáo sản phẩm'+_srViewToggleHtml('bProductView')+'</div>';
    html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên/mã sản phẩm..." value="'+esc(_srState.productSearch)+'" oninput="_srState.productSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:240px;margin-bottom:6px">';
    if (_srState.bProductView === 'table'){
      html += '<table class="dash-table"><thead><tr><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th style="text-align:right">Tổng số lượng</th></tr></thead><tbody>';
      productRows.forEach(function(p){
        html += '<tr><td style="font-family:monospace;font-size:12px">'+esc(p.code)+'</td><td>'+esc(p.name)+'</td><td style="text-align:right">'+fmt(p.soLuong)+'</td></tr>';
      });
      if (!productRows.length) html += '<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
      else html += _srTotalRowHtml_(['Tổng', '', fmt(productRows.reduce(function(s,r){return s+(r.soLuong||0);},0))]);
      html += '</tbody></table>';
    } else {
      html += _srChartSvg(productRows, 'name', 'soLuong', _srState.bProductView, false);
    }
  }
  html += _srPosMonthPanelHtml_();
  html += _srPurePanelHtml_(d);   // CUỐI CÙNG: báo cáo tính đơn thuần theo Thẻ + nút xuất Excel đối chiếu Base / chia quầy
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BÁO CÁO POS — TÍNH ĐƠN THUẦN (yêu cầu Duyên 20/10/2026) — nằm DƯỚI CÙNG Báo cáo B.
//  Tính ĐÚNG như bảng "Theo Sale" nhưng CHƯA áp 3 loại điều chỉnh: (1) ghép/đối chiếu đơn với Base (mã bộ đếm), (2) chia theo file kế toán,
//  (3) quầy 30/70. Mỗi đơn chỉ lấy sale ghi trên cột "Thẻ" (chia đều), giá trị = giá Pos gốc. Số đơn giữ nguyên, tiền chia đều như bảng chính.
//  Nút "Xuất Excel đối chiếu" liệt kê từng đơn đã điều chỉnh (thuần vs sau điều chỉnh) + các đơn cần kiểm tra tay để Duyên so sánh.
//  Chạy hoàn toàn ở trình duyệt từ d.orders (máy chủ trả saleThe/dieuChinh/giaTriPos/saleShares/saleRatio) — không cần action mới.
// ═══════════════════════════════════════════════════════════════════════════
var _SR_UNASSIGNED_ = '(chưa gán sale)';
function _srPureCalc_(orders){
  var map = {}, order = [];
  (orders || []).forEach(function(o){
    var names = String(o.saleThe || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    if (!names.length) names = [_SR_UNASSIGNED_];
    var v = (o.giaTriPos !== undefined && o.giaTriPos !== null) ? Number(o.giaTriPos) : Number(o.giaTriSauGiam);   // giá Pos gốc (đơn ghép Base có giaTriPos)
    var c = Number(o.cod) || 0, f = 1 / names.length;
    names.forEach(function(n){
      if (!map[n]) { map[n] = { name: n, orders: 0, giaTri: 0, cod: 0 }; order.push(n); }
      map[n].orders += 1; map[n].giaTri += (v || 0) * f; map[n].cod += c * f;
    });
  });
  var rows = order.map(function(n){ return map[n]; });
  rows.sort(function(a, b){
    if (a.name === _SR_UNASSIGNED_) return 1; if (b.name === _SR_UNASSIGNED_) return -1;
    return b.giaTri - a.giaTri;
  });
  return rows;
}
// Đơn đã bị điều chỉnh so với cách tính thuần: có saleShares (ghép Base / file kế toán) hoặc saleRatio (quầy 30/70).
function _srIsAdjusted_(o){ return !!(o && ((o.saleShares && o.saleShares.length) || (o.saleRatio && o.saleRatio !== 1))); }
function _srAdjTypeText_(o){
  var t = [];
  if (o.dieuChinh === 'acct') t.push('Chia theo file kế toán' + (o.acctStatus === 'daXacNhan' ? ' (đã xác nhận, đổi giá)' : ''));
  else if (o.saleShares && o.saleShares.length) t.push('Ghép đơn Base (mã bộ đếm)');
  if (o.saleRatio && o.saleRatio !== 1) t.push('Quầy ' + Math.round(o.saleRatio * 100) + '/' + Math.round((1 - o.saleRatio) * 100));
  return t.join(' + ');
}
function _srPurePanelHtml_(d){
  if (!d || !d.orders) return '';
  var hasField = d.orders.length === 0 || d.orders.some(function(o){ return o.saleThe !== undefined; });
  var h = '<div class="dash-section-title" style="margin-top:26px">🧮 Báo cáo tính đơn thuần <span style="font-weight:400;color:var(--muted);font-size:11px">(chỉ theo cột "Thẻ" của Pos — CHƯA đối chiếu Base, CHƯA chia theo kế toán/quầy)</span></div>';
  if (!hasField) return h + '<div class="fp-info">Máy chủ chưa trả dữ liệu cho báo cáo này (GAS chưa chạy bản mới). Đợi workflow deploy GAS xong rồi tải lại báo cáo.</div>';
  var pure = _srKeepSelectedSales_(_srPureCalc_(d.orders), _srState.bSale);
  var main = {}; (d.bySale || []).forEach(function(r){ main[r.name] = r; });
  var adjN = d.orders.filter(_srIsAdjusted_).length;
  var tOrd = 0, tGt = 0, tCod = 0, tDo = 0, tDg = 0;
  h += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Cột <b>Chênh</b> = bảng "Theo Sale" chính (đã đối chiếu Base / chia quầy) trừ bảng thuần này. Hiện có <b>' + fmt(adjN) + '</b> đơn đã bị điều chỉnh — xem chi tiết từng đơn trong file Excel.</div>' +
    '<button class="btn sm" onclick="_srPureExport_()">📥 Xuất Excel đối chiếu (Base + chia quầy)</button>' +
    '<div style="overflow-x:auto;margin-top:10px"><table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">Số đơn</th><th style="text-align:right">Giá trị sau giảm giá</th><th style="text-align:right">TB đơn</th><th style="text-align:right">COD</th><th style="text-align:right">Chênh số đơn</th><th style="text-align:right">Chênh giá trị</th></tr></thead><tbody>';
  pure.forEach(function(r){
    var m = main[r.name], dOrd = m ? (m.orders - r.orders) : null, dGt = m ? (m.giaTri - r.giaTri) : null;
    tOrd += r.orders; tGt += r.giaTri; tCod += r.cod; if (m) { tDo += dOrd; tDg += dGt; }
    var cell = function(x, money){ return x === null ? '<td style="text-align:right;color:var(--muted)">—</td>' : '<td style="text-align:right;' + (Math.round(x) ? 'color:#b45309;font-weight:600' : 'color:var(--muted)') + '">' + (x > 0 ? '+' : '') + (money ? _srMoney(x) : fmt(Math.round(x))) + '</td>'; };
    h += '<tr><td>' + e_(r.name) + '</td><td style="text-align:right">' + fmt(r.orders) + '</td><td style="text-align:right">' + _srMoney(r.giaTri) + '</td><td style="text-align:right">' + _srMoney(r.orders ? Math.round(r.giaTri / r.orders) : 0) + '</td><td style="text-align:right">' + _srMoney(r.cod) + '</td>' + cell(dOrd, false) + cell(dGt, true) + '</tr>';
  });
  if (!pure.length) h += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
  else h += _srTotalRowHtml_(['Tổng', fmt(tOrd), _srMoney(tGt), _srMoney(tOrd ? Math.round(tGt / tOrd) : 0), _srMoney(tCod), '', '']);
  h += '</tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:6px">Dòng "(chưa gán sale)" gồm đơn không có sale trên Thẻ (vd đơn Quầy Hào Nam chưa chia). Tổng số đơn ở dòng cuối cộng cả đơn nhiều sale nên có thể lớn hơn số đơn thật.</div>';
  return h;
}
function _srPureExport_(){
  var d = _srState.dataB; if (!d || !d.orders) { toast('Chưa có dữ liệu Báo cáo Pos — bấm Lọc để tải trước.'); return; }
  if (typeof XLSX === 'undefined') { toast('Chưa nạp được thư viện Excel.'); return; }
  var pureAll = _srPureCalc_(d.orders), main = {}; (d.bySale || []).forEach(function(r){ main[r.name] = r; });
  var money = function(n){ return Math.round(Number(n) || 0); };
  // Sheet 1 — từng đơn đã điều chỉnh
  var head1 = ['Loại điều chỉnh','Ngày tạo đơn','SĐT','Khách hàng','Nguồn đơn','Thẻ (gốc Pos)','Sale theo Pos thuần','Phần chia THUẦN (sale: tiền)','Giá trị Pos gốc','Giá trị tính cho sale SAU điều chỉnh','Chênh','Phần chia SAU điều chỉnh (sale: tiền)','Mã bộ đếm đã khớp','Người tạo Base','Ngày tạo Base','Ghi chú Pos'];
  var rows1 = [head1], adj = d.orders.filter(_srIsAdjusted_);
  adj.forEach(function(o){
    var names = String(o.saleThe || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    var vPos = (o.giaTriPos !== undefined && o.giaTriPos !== null) ? Number(o.giaTriPos) : Number(o.giaTriSauGiam);
    var ratio = o.saleRatio || 1, vAfter = (Number(o.giaTriSauGiam) || 0) * ratio;
    var pureTxt = names.length ? names.map(function(n){ return n + ': ' + fmt(money(vPos / names.length)); }).join('; ') : _SR_UNASSIGNED_ + ': ' + fmt(money(vPos));
    var shares = (o.saleShares && o.saleShares.length) ? o.saleShares : (names.length ? names.map(function(n){ return { name: n, frac: 1 / names.length }; }) : [{ name: _SR_UNASSIGNED_, frac: 1 }]);
    var afterTxt = shares.map(function(x){ return x.name + ' ' + Math.round(x.frac * 100) + '%: ' + fmt(money((Number(o.giaTriSauGiam) || 0) * x.frac * ratio)); }).join('; ');
    rows1.push([_srAdjTypeText_(o), o.ngayTaoDon || '', o.soDienThoai || '', o.khachHang || '', o.nguonDon || '', o.theSale || '', names.join(', '), pureTxt, money(vPos), money(vAfter), money(vAfter - vPos), afterTxt,
      (o.ghepCodes || []).join(', '), o.nguoiTaoBase || '', o.baseNgayTao || '', o.ghiChu || '']);
  });
  // Sheet 2 — Theo Sale: thuần vs sau điều chỉnh
  var rows2 = [['Sale','Số đơn (thuần)','Giá trị (thuần)','COD (thuần)','Số đơn (sau điều chỉnh)','Giá trị (sau điều chỉnh)','COD (sau điều chỉnh)','Chênh số đơn','Chênh giá trị']], seen = {};
  pureAll.forEach(function(r){ var m = main[r.name]; seen[r.name] = 1;
    rows2.push([r.name, r.orders, money(r.giaTri), money(r.cod), m ? m.orders : 0, m ? money(m.giaTri) : 0, m ? money(m.cod) : 0, (m ? m.orders : 0) - r.orders, (m ? money(m.giaTri) : 0) - money(r.giaTri)]); });
  (d.bySale || []).forEach(function(m){ if (!seen[m.name]) rows2.push([m.name, 0, 0, 0, m.orders, money(m.giaTri), money(m.cod), m.orders, money(m.giaTri)]); });
  // Sheet 3 — đơn cần kiểm tra tay (máy chủ chưa tự sửa / không khớp được)
  var rows3 = [['Nhóm','Ngày','SĐT','Thẻ / Sale','Giá trị','Mã bộ đếm','Mã không tìm thấy trên Base','Ghi chú Pos']];
  var gc = d.ghepCheck || {}, gh = d.ghep || {}, ac = d.acct || {};
  (gc.list || []).forEach(function(x){ rows3.push(['Ghi chú có "ghép" / ≥2 mã — CHƯA tự sửa, cần đối chiếu tay', x.ngay || '', x.sdt || '', x.theSale || '', money(x.gia), (x.ma || []).join(', '), '', x.ghiChu || '']); });
  (gh.khongKhop || []).forEach(function(x){ rows3.push(['Có mã bộ đếm nhưng KHÔNG khớp đơn Base nào', x.ngay || '', x.sdt || '', '', '', (x.maCoDon || []).join(', '), (x.maKhongTim || []).join(', '), x.ghiChu || '']); });
  (gh.trungDonGoc || []).forEach(function(x){ rows3.push(['Đơn gốc Base đã được đơn Pos khác dùng (trùng)', x.ngay || '', x.sdt || '', '', '', (x.maCoDon || []).join(', '), (x.maKhongTim || []).join(', '), x.ghiChu || '']); });
  (ac.needConfirm || []).forEach(function(x){ rows3.push(['File kế toán lệch giá Pos (Pos ' + fmt(money(x.giaPos)) + ' / kế toán ' + fmt(money(x.giaKeToan)) + ') — chờ xác nhận', x.ngay || '', x.sdt || '', x.theSale || '', money(x.giaPos), x.ma || '', '', '']); });
  rows3.push([]);
  rows3.push(['Ghi chú: mỗi nhóm chỉ liệt kê tối đa ~30–60 đơn mẫu. Tổng thật: ghi chú ghép/≥2 mã = ' + (gc.count || 0) + '; không khớp Base = ' + (gh.khongKhopCount || 0) + '; trùng đơn gốc = ' + (gh.trungDonGocCount || 0) + '; kế toán chờ xác nhận = ' + (ac.needConfirmCount || 0) + '.']);
  var wb = XLSX.utils.book_new();
  var ws1 = XLSX.utils.aoa_to_sheet(rows1); ws1['!cols'] = [26,12,13,22,26,24,24,34,14,16,12,48,22,18,12,40].map(function(w){ return { wch: w }; });
  XLSX.utils.book_append_sheet(wb, ws1, 'Đơn đã điều chỉnh');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows2), 'Theo Sale thuần vs đối chiếu');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows3), 'Cần kiểm tra tay');
  var fn = 'BaoCao_Pos_DoiChieu_' + String(_srState.dateFrom || '').replace(/[^0-9-]/g, '') + '_' + String(_srState.dateTo || '').replace(/[^0-9-]/g, '') + '.xlsx';
  XLSX.writeFile(wb, fn);
  toast('✓ Đã xuất ' + fn + ' — ' + fmt(adj.length) + ' đơn đã điều chỉnh.');
}

// ── CHOT THANG POS + TRU HOAN/HUY THANG TRUOC (quy tac 5, Duyen 10/2026) — chi Admin ──
// Chua chot thang truoc thi KHONG tru gi: cac bao cao giu nguyen. Xem ghi chu o closePosMonth_/posMonthAdjust_ (gas_v13.js).
function _srPosMonthPanelHtml_(){
  if (!_srIsAdmin()) return '';
  var now = new Date();
  var cur = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var pd = new Date(now.getFullYear(), now.getMonth()-1, 1);
  var prev = pd.getFullYear()+'-'+String(pd.getMonth()+1).padStart(2,'0');
  var st = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  return '<div class="dash-section-title" style="margin-top:22px">🔒 Chốt tháng Pos &amp; trừ hoàn/hủy tháng trước</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Doanh thu Pos tháng M = doanh thu trong tháng − phần hoàn/hủy phát sinh của tháng M-1 <b>sau khi đã chốt</b>. '+
    'Làm vào ngày mùng 1, sau khi cập nhật đủ dữ liệu tháng trước: bấm <b>Chốt tháng</b> để lưu mốc; những đơn tháng đó bị hoàn/hủy về sau sẽ tự được trừ vào tháng kế tiếp. Chưa chốt thì chưa trừ gì.</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'+
      '<span style="font-size:12px">Chốt tháng:</span><input type="month" id="sr-posm-close" value="'+prev+'" style="'+st+'">'+
      '<button class="btn sm" onclick="_srPosMonthClose_()">🔒 Chốt tháng này làm mốc</button>'+
      '<span style="color:var(--border-md)">|</span>'+
      '<span style="font-size:12px">Xem doanh thu tháng:</span><input type="month" id="sr-posm-view" value="'+cur+'" style="'+st+'">'+
      '<button class="btn sm secondary" onclick="_srPosMonthLoad_()">📉 Xem sau khi trừ hoàn/hủy</button>'+
    '</div><div id="sr-posm-result"></div>';
}
async function _srPosMonthClose_(force){
  var month = (document.getElementById('sr-posm-close')||{}).value;
  if (!month){ toast('Chọn tháng cần chốt'); return; }
  if (!force && !confirm('Chốt doanh thu Pos tháng '+month+' làm mốc?\n\nChỉ nên chốt khi đã cập nhật ĐỦ dữ liệu tháng này. Sau khi chốt, đơn tháng '+month+' bị hoàn/hủy về sau sẽ bị trừ vào doanh thu tháng kế tiếp.')) return;
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'closePosMonth', month: month, force: !!force }) });
    var d = await r.json();
    if (d && d.needForce){ if (confirm(d.error+'\n\nGhi đè mốc cũ?')) return _srPosMonthClose_(true); return; }
    if (!d || !d.ok){ toast('❌ '+((d&&d.error)||'Chốt thất bại')); return; }
    toast('✓ Đã chốt tháng '+d.month+' — tổng '+_srMoney(d.total)+' ('+d.saleCount+' sale)');
  } catch(e){ toast('❌ Lỗi: '+e.message); }
}
async function _srPosMonthLoad_(){
  var month = (document.getElementById('sr-posm-view')||{}).value;
  var box = document.getElementById('sr-posm-result'); if (!box) return;
  box.innerHTML = '<div style="color:var(--muted);padding:8px">Đang tính...</div>';
  var d = await _srFetch('posMonthAdjust', { month: month });
  if (!d || !d.ok){ box.innerHTML = '<div style="color:#dc2626;padding:8px">Không tải được: '+esc((d&&d.error)||_srState.lastFetchError||'lỗi không rõ')+'</div>'; return; }
  var html = '';
  if (!d.applied) html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;margin-bottom:8px;font-size:12px">⚠ '+esc(d.reason)+'</div>';
  else html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Đã trừ phần hoàn/hủy của tháng <b>'+esc(d.prevMonth)+'</b> (mốc chốt '+esc(d.closedAt)+'). Tổng doanh thu '+esc(d.month)+': <b>'+_srMoney(d.total)+'</b> − '+_srMoney(d.totalDeduction)+' = <b>'+_srMoney(d.totalNet)+'</b></div>';
  html += '<table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">Doanh thu tháng '+esc(d.month)+'</th><th style="text-align:right">Trừ hoàn/hủy '+esc(d.prevMonth)+'</th><th style="text-align:right">Sau trừ</th></tr></thead><tbody>';
  (d.rows||[]).forEach(function(r){
    html += '<tr><td>'+esc(r.name)+'</td><td style="text-align:right">'+_srMoney(r.revenue)+'</td><td style="text-align:right;color:'+(r.deduction?'#dc2626':'var(--muted)')+'">'+(r.deduction?((r.deduction>0?'−':'+')+_srMoney(Math.abs(r.deduction))):'—')+'</td><td style="text-align:right;font-weight:700">'+_srMoney(r.net)+'</td></tr>';
  });
  if (!(d.rows||[]).length) html += '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:12px">Không có dữ liệu</td></tr>';
  html += '</tbody></table>';
  box.innerHTML = html;
}

// ── BAO CAO C: SO SANH THEO KY (tuan/thang/quy/tuy chinh) ──
// Bo loc nhanh cho 2 khoang ngay cua Bao cao C che do "Tuy chinh" (ky nay / so voi)
function _srApplyQuickC(which, key){
  if (key === 'custom') return;
  var r = _pkQuickRange(key); if (!r) return;
  if (which === 'cur'){ _srState.cCustomCurFrom = r.from; _srState.cCustomCurTo = r.to; }
  else { _srState.cCustomPrevFrom = r.from; _srState.cCustomPrevTo = r.to; }
  renderSalesReportTab();
}
function renderSalesReportTabC_(wrap, subTabs){
  var pt = _srState.cPeriodType;
  var filters = '';
  filters += '<select onchange="_srState.cPeriodType=this.value;renderSalesReportTab()" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<option value="week"'+(pt==='week'?' selected':'')+'>Theo Tuần (Thứ 2 → CN)</option>'+
    '<option value="month"'+(pt==='month'?' selected':'')+'>Theo Tháng</option>'+
    '<option value="quarter"'+(pt==='quarter'?' selected':'')+'>Theo Quý</option>'+
    '<option value="year"'+(pt==='year'?' selected':'')+'>Theo Năm</option>'+
    '<option value="custom"'+(pt==='custom'?' selected':'')+'>Tùy chỉnh (2 khoảng ngày)</option>'+
    '</select>';

  if (pt !== 'custom'){
    var offKey = pt==='week' ? 'cWeekOffset' : (pt==='month' ? 'cMonthOffset' : (pt==='year' ? 'cYearOffset' : 'cQuarterOffset'));
    var unitLabel = pt==='week' ? 'tuần' : (pt==='month' ? 'tháng' : (pt==='year' ? 'năm' : 'quý'));
    filters += '<div style="display:flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:6px;padding:2px 4px;background:var(--surface)">'+
      '<button class="btn sm" onclick="_srState.'+offKey+'--;_srApply()" title="Lùi 1 '+unitLabel+'">◀</button>'+
      '<span style="font-size:12px;padding:0 4px;min-width:26px;text-align:center">'+
        (_srState[offKey]===0?'Kỳ này':(_srState[offKey]<0?(-_srState[offKey])+' '+unitLabel+' trước':_srState[offKey]+' '+unitLabel+' sau'))+
      '</span>'+
      '<button class="btn sm" onclick="_srState.'+offKey+'++;_srApply()" title="Tiến 1 '+unitLabel+'">▶</button>'+
      (_srState[offKey]!==0 ? '<button class="btn sm" onclick="_srState.'+offKey+'=0;_srApply()" title="Về kỳ hiện tại">⟲</button>' : '')+
      '</div>';
  } else {
    filters += '<span style="font-size:11px;color:var(--muted)">Kỳ này:</span>'+
      _quickRangeSelectHtml('custom', "_srApplyQuickC('cur',this.value)")+
      '<input type="date" value="'+esc(_srState.cCustomCurFrom)+'" onchange="_srState.cCustomCurFrom=this.value" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '<span style="color:var(--muted)">→</span>'+
      '<input type="date" value="'+esc(_srState.cCustomCurTo)+'" onchange="_srState.cCustomCurTo=this.value" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '<span style="font-size:11px;color:var(--muted)">so với:</span>'+
      _quickRangeSelectHtml('custom', "_srApplyQuickC('prev',this.value)")+
      '<input type="date" value="'+esc(_srState.cCustomPrevFrom)+'" onchange="_srState.cCustomPrevFrom=this.value" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '<span style="color:var(--muted)">→</span>'+
      '<input type="date" value="'+esc(_srState.cCustomPrevTo)+'" onchange="_srState.cCustomPrevTo=this.value" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  }
  filters = _srBarHtml_(filters);

  var body = _srState.loading ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>' : _srRenderC(_srState.dataC);
  wrap.innerHTML = filters + body;
}

function _impParseFile(file, kind){ // kind: 'base' | 'pos'
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(ev){
      try {
        var wb = XLSX.read(ev.target.result, {type:'array'});
        var sheetName = kind === 'base' ? (wb.SheetNames.indexOf('Tất cả') !== -1 ? 'Tất cả' : wb.SheetNames[0]) : wb.SheetNames[0];
        var ws = wb.Sheets[sheetName];
        var aoa = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:false});
        if (!aoa.length) { resolve({ rows: [], warn: 'File rỗng.' }); return; }
        var header = aoa[0];
        // Cắt bỏ các cột header RỖNG ở cuối (cột thừa do file xuất ra, không thuộc dữ liệu thật)
        var lastCol = header.length - 1;
        while (lastCol >= 0 && !String(header[lastCol]||'').trim()) lastCol--;
        var width = lastCol + 1;
        var warn = '';
        if (kind === 'base'){
          if (String(header[0]||'').trim() !== 'Ngày tạo') warn = '⚠️ Cột đầu tiên của file là "'+(header[0]||'(rỗng)')+'" — không phải "Ngày tạo" như file Base chuẩn (sheet "Tất cả"). Kiểm tra lại đúng file chưa trước khi nhập.';
        } else {
          if (String(header[1]||'').trim() !== 'Ngày tạo đơn') warn = '⚠️ Cột B của file là "'+(header[1]||'(rỗng)')+'" — không phải "Ngày tạo đơn" như file Pos chuẩn. Kiểm tra lại đúng file chưa trước khi nhập.';
        }
        var rows = [];
        for (var i = 1; i < aoa.length; i++){
          var row = aoa[i].slice(0, width);
          while (row.length < width) row.push('');
          if (row.every(function(v){ return v === '' || v === null || v === undefined; })) continue;
          rows.push(row);
        }
        resolve({ rows: rows, warn: warn });
      } catch(err){ reject(err); }
    };
    reader.onerror = function(){ reject(new Error('Không đọc được file.')); };
    reader.readAsArrayBuffer(file);
  });
}

async function _impOnFileSelected(input, kind){
  var file = input.files && input.files[0];
  if (!file) return;
  try {
    var res = await _impParseFile(file, kind);
    if (!res.rows.length){ toast('⚠️ Không đọc được dòng dữ liệu nào trong file này.'); return; }
    if (kind === 'base'){ _impState.baseRows = res.rows; _impState.baseFileName = file.name; _impState.baseWarn = res.warn; }
    else { _impState.posRows = res.rows; _impState.posFileName = file.name; _impState.posWarn = res.warn; }
    _impState.result = null;
    renderSalesReportTab();
  } catch(e){
    toast('❌ Lỗi đọc file: ' + e.message);
  }
}

async function _impUpload(kind){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  var rows = kind === 'base' ? _impState.baseRows : _impState.posRows;
  if (!rows || !rows.length) return;
  if (_impState.uploading) return; // chong bam dup -> 2 request cung luc
  _impState.uploading = true; renderSalesReportTab();
  try {
    // BƯỚC 1 — XEM TRƯỚC (không ghi gì): backend đếm dòng MỚI / đơn ĐÃ CÓ. Backend cũ chưa hỗ trợ dryRun sẽ trả kết quả ghi thật
    // (không có d0.dryRun) -> không bao giờ ghi 2 lần: dùng kết quả đó luôn như trước.
    var _lbl = kind === 'base' ? 'Base (DT TỔNG)' : 'Pos (dữ liệu đơn)';
    var _isReal = false, d = null;
    var res0 = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'importSheetRows', sheet: kind, rows: rows, dryRun: true, updateExisting: true }) });
    var d0 = await res0.json();
    if (d0.error) throw new Error(d0.error);
    if (d0.dryRun) {
      if (!d0.wouldWrite && !d0.wouldUpdateRows) {
        toast('ℹ️ Không có dòng mới: cả ' + fmt(d0.skippedExisting || 0) + ' đơn trong file đều ĐÃ CÓ trong hệ thống — không ghi gì, dữ liệu cũ giữ nguyên.');
        _impState.result = Object.assign({ kind: kind, written: 0 }, d0);
        return;
      }
      if (!confirm('NHẬP DỮ LIỆU ' + _lbl + ' — xem trước:\n\n'
        + '• Sẽ THÊM ' + fmt(d0.wouldWrite) + ' dòng MỚI (nối tiếp cuối sheet)\n'
        + '• ' + fmt(d0.skippedExisting || 0) + ' đơn ĐÃ CÓ: ' + (d0.wouldUpdateRows ? 'CẬP NHẬT ' + fmt(d0.wouldUpdateRows) + ' đơn có thông tin đổi (' + fmt(d0.wouldUpdateCells) + ' ô; chỉ ghi ô file có giá trị mới khác, KHÔNG xóa trắng ô cũ, giá trị cũ được lưu vào sheet "Nhật ký cập nhật nhập file"), còn lại giống hệt → bỏ qua' : 'giống dữ liệu cũ → bỏ qua, không ghi đè, không xóa') + '\n'
        + (d0.updateOverLimit ? '• Còn ' + fmt(d0.updateOverLimit) + ' đơn đổi nữa — vượt giới hạn 1 lần, nhập lại cùng file để cập nhật tiếp\n' : '')
        + (d0.skippedDupInFile ? '• Bỏ qua ' + fmt(d0.skippedDupInFile) + ' dòng trùng ngay trong file\n' : '')
        + '\nDữ liệu cũ trên Sheet được GIỮ NGUYÊN 100%. Tiếp tục nhập?')) { toast('Đã hủy — chưa ghi gì.'); return; }
    } else { _isReal = true; d = d0; }
    if (!_isReal) {
      var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'importSheetRows', sheet: kind, rows: rows, updateExisting: true }) });
      d = await res.json();
    }
    if (d.error) throw new Error(d.error);
    _impState.result = Object.assign({ kind: kind }, d);
    toast('✓ Đã nhập '+fmt(d.written)+' dòng mới'+(d.skippedExisting?', '+fmt(d.skippedExisting)+' đơn ĐÃ CÓ'+(d.updatedRows?' (cập nhật '+fmt(d.updatedRows)+' đơn có thông tin đổi, còn lại bỏ qua)':' (bỏ qua)'):'')+(d.dedupedAfter?' (tự loại '+fmt(d.dedupedAfter)+' dòng trùng tuyệt đối)':'')+' vào '+(kind==='base'?'DT TỔNG':'dữ liệu đơn')+'.');
    logAudit('import_'+kind, '', '', 'Nhập dữ liệu '+(kind==='base'?'Base':'Pos')+' từ file: +'+d.written+' dòng, cập nhật '+(d.updatedRows||0)+' đơn/'+(d.updatedCells||0)+' ô, loại trùng '+(d.dedupedAfter||0));
    if (kind === 'base'){ _impState.baseRows = null; _impState.baseFileName = ''; _impState.baseWarn = ''; }
    else { _impState.posRows = null; _impState.posFileName = ''; _impState.posWarn = ''; }
    var fi = document.getElementById('imp-file-'+kind); if (fi) fi.value = '';
    // Du lieu goc da doi -> cac bao cao doanh so dang cache tren client (neu co) co the sai lech,
    // xoa de buoc tai lai tu server khi nguoi dung xem lai cac tab bao cao.
    _srState.dataA = _srState.dataB = _srState.dataC = _srState.dataE = _srState.dataF = _srState.dataG = _srState.dataH = null;
  } catch(e){
    toast('❌ Nhập lỗi: ' + e.message);
  } finally {
    _impState.uploading = false; renderSalesReportTab();
  }
}

function _impPickCard_(kind, label, hint, sheetTarget){
  var rows = kind === 'base' ? _impState.baseRows : _impState.posRows;
  var fname = kind === 'base' ? _impState.baseFileName : _impState.posFileName;
  var warn = kind === 'base' ? _impState.baseWarn : _impState.posWarn;
  var html = '<div style="border:1px solid var(--border);border-radius:var(--rsm);padding:14px;flex:1;min-width:280px">';
  html += '<div style="font-weight:600;margin-bottom:4px">'+label+'</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">'+hint+' — sẽ nối tiếp vào sheet <b>"'+esc(sheetTarget)+'"</b>.</div>';
  html += '<input type="file" id="imp-file-'+kind+'" accept=".xlsx,.xls" onchange="_impOnFileSelected(this,\''+kind+'\')" style="font-size:12px">';
  if (fname){
    html += '<div style="margin-top:8px;font-size:12px">📄 '+esc(fname)+' — <b>'+fmt(rows.length)+'</b> dòng đọc được.</div>';
    if (warn) html += '<div style="margin-top:6px;padding:6px 8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:11.5px;color:#9a3412">'+esc(warn)+'</div>';
    html += '<button class="btn sm primary" style="margin-top:8px" '+(_impState.uploading?'disabled':'')+' onclick="_impUpload(\''+kind+'\')">'+(_impState.uploading?'Đang nhập...':'💾 Nhập '+fmt(rows.length)+' dòng vào CRM')+'</button>';
  }
  var res = _impState.result;
  if (res && res.kind === kind){
    html += '<div style="margin-top:8px;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;color:#166534">✓ Đã thêm <b>'+fmt(res.written)+'</b> dòng mới'+(res.skippedExisting?', bỏ qua <b>'+fmt(res.skippedExisting)+'</b> đơn ĐÃ CÓ sẵn trong hệ thống (không ghi lại → không nhân đôi doanh thu)':'')+(res.updatedRows?', <b>cập nhật '+fmt(res.updatedRows)+'</b> đơn cũ có thông tin đổi ('+fmt(res.updatedCells)+' ô — giá trị cũ lưu ở sheet "Nhật ký cập nhật nhập file")':'')+(res.skippedDupInFile?', bỏ qua '+fmt(res.skippedDupInFile)+' dòng trùng ngay trong file':'')+(res.dedupedAfter?', tự động loại '+fmt(res.dedupedAfter)+' dòng trùng tuyệt đối với dữ liệu sẵn có':'')+'.</div>';
  }
  html += '</div>';
  return html;
}

function renderSalesReportTabJ_(wrap, subTabs){
  if (!_srIsAdmin()){ wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + '<div style="color:var(--muted);padding:20px;text-align:center">🔒 Chỉ Admin được nhập dữ liệu Base/Pos.</div>'; return; }
  var html = '<div style="font-size:12.5px;color:var(--muted);margin-bottom:14px">Tải lên file export từ Base platform / Pancake POS — hệ thống tự đọc và nối tiếp vào đúng sheet nguồn trên Google Sheet (không cần copy tay), tự loại bỏ các dòng trùng tuyệt đối (giống hệt mọi cột) với dữ liệu đã có sẵn.</div>';
  html += '<div style="display:flex;gap:14px;flex-wrap:wrap">';
  html += _impPickCard_('base', '📥 Dữ liệu Base', 'File export "Danh sách công việc" (sheet "Tất cả"), .xls/.xlsx', 'DT TỔNG ');
  html += _impPickCard_('pos', '📥 Dữ liệu Pos', 'File export đơn hàng (Pancake POS), .xlsx', 'dữ liệu đơn');
  html += '</div>';
  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + html;
}

// ── "XEM THÊM" CHO BẢNG DÀI (tránh vẽ hàng nghìn <tr> một lúc làm đứng trình duyệt) ──
// Chỉ vẽ _MORE_ROWS_PAGE_ dòng đầu, bấm "Xem thêm" để vẽ tiếp. Bảng khách hàng chính ở tab Danh sách ĐÃ cuộn ảo riêng
// (renderTable/_renderVirtualWindow) nên không dùng cái này; helper này cho các bảng chi tiết khác.
var _MORE_ROWS_PAGE_ = 200, _moreRows_ = {};
function _moreRowsLimit_(key){ return _moreRows_[key] || _MORE_ROWS_PAGE_; }
function _moreRowsBtn_(key, shown, total, cols, rerenderFn){
  if (shown >= total) return '';
  return '<tr><td colspan="'+cols+'" style="text-align:center;padding:10px"><button class="btn sm secondary" onclick="_moreRowsShow_(\''+key+'\','+total+',\''+rerenderFn+'\')">Xem thêm '+Math.min(_MORE_ROWS_PAGE_, total-shown)+' dòng (đang hiện '+shown+'/'+total+')</button></td></tr>';
}
function _moreRowsShow_(key, total, rerenderFn){
  _moreRows_[key] = Math.min(total, _moreRowsLimit_(key) + _MORE_ROWS_PAGE_);
  if (typeof window[rerenderFn] === 'function') window[rerenderFn]();
}
function renderSalesReportTabD_(wrap, subTabs){
  var filters = _srBarHtml_();

  var body;
  if (_srState.loading) {
    body = '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>';
  } else {
    var d = _srState.dataD;
    if (!d) {
      body = _srNoDataHtml_();
    } else {
      var html = '<div class="kpi-grid" style="margin-bottom:16px"><div class="kpi-card"><div class="kpi-label">Số KH thêm mới (nguồn Chăm sóc)</div><div class="kpi-val">'+fmt(d.total||0)+'</div></div></div>';
      html += '<div class="dash-section-title">Theo CS thêm'+_srViewToggleHtml('dCsView')+'</div>';
      if (_srState.dCsView === 'table'){
        html += '<table class="dash-table"><thead><tr><th>CS</th><th>Số KH thêm</th></tr></thead><tbody>';
        (d.byCS||[]).forEach(function(x){ html += '<tr><td>'+esc(x.name)+'</td><td>'+fmt(x.count)+'</td></tr>'; });
        if (!(d.byCS||[]).length) html += '<tr><td colspan="2" style="text-align:center;color:var(--muted)">Không có dữ liệu</td></tr>';
        else html += _srTotalRowHtml_(['Tổng', fmt((d.byCS||[]).reduce(function(s,r){return s+(r.count||0);},0))]);
        html += '</tbody></table>';
      } else {
        html += _srChartSvg(d.byCS||[], 'name', 'count', _srState.dCsView, false);
      }
      html += '<div class="dash-section-title" style="margin-top:16px">Chi tiết khách thêm mới</div>';
      html += '<table class="dash-table"><thead><tr><th>SĐT</th><th>Tên khách</th><th>Ghi chú mới nhất</th><th>CS thêm</th><th>Ngày thêm</th></tr></thead><tbody>';
      var dKey_ = 'dRows|'+(d.total||0), dAll_ = d.rows||[], dShow_ = Math.min(dAll_.length, _moreRowsLimit_(dKey_));
      dAll_.slice(0, dShow_).forEach(function(r){
        var latestNote = r.note || '';
        try { var arr = JSON.parse(r.note||'[]'); if (Array.isArray(arr) && arr.length) latestNote = arr[0].text || ''; } catch(eN){}
        html += '<tr><td>'+esc(r.phone)+'</td><td><a href="javascript:void(0)" onclick="openDp(\''+esc(r.phone)+'\')">'+esc(r.name)+'</a></td><td>'+esc(latestNote)+'</td><td>'+esc(r.cs)+'</td><td>'+esc(String(r.createdAt||'').slice(0,16).replace('T',' '))+'</td></tr>';
      });
      if (!dAll_.length) html += '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Không có dữ liệu</td></tr>';
      else html += _moreRowsBtn_(dKey_, dShow_, dAll_.length, 5, 'renderSalesReportTab');
      html += '</tbody></table>';
      body = html;
    }
  }
  wrap.innerHTML = filters + body;
}

// ═══════════════════════════════════════════════════════
//  BAO CAO L — KHACH QUA CUA HANG (trang tinh cua hang ghi lich hen)
//  Backend: action=storeCaseReport (gas_v13.js buildStoreCaseReport_) — khop SDT + ngay qua CH voi don Pos,
//  Sale duoc 30% doanh thu don (nhieu Sale chia deu), don da co the Sale tren Pos = trung (bo qua).
// ═══════════════════════════════════════════════════════
var _SR_L_STATUS_ = {
  'tinh':      ['✅ Tính thêm cho Sale', '#166534', '#dcfce7'],
  'trung':     ['↩️ Trùng thẻ Pos — bỏ qua', '#92400e', '#fef3c7'],
  'mot-phan':  ['◐ Trùng một phần', '#1e40af', '#dbeafe'],
  'hoan':      ['⛔ Đơn hoàn', '#991b1b', '#fee2e2'],
  'khong-sale':['❔ Chưa khớp tên Sale', '#6b7280', '#f3f4f6']
};
function _srLDmy_(ymd){ var m = String(ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (m[3]+'/'+m[2]) : String(ymd||''); }
function _srLRowMatchesSearch_(r, q){
  if (!q) return true;
  var hay = [r.tenKh, r.phone, r.saleRaw, (r.sales||[]).map(function(x){return x.name;}).join(' '), r.kenh, r.tinhTrang, r.capNhat].join(' ').toLowerCase();
  return hay.indexOf(q) !== -1;
}
function _srLOrderHtml_(o){
  var st = _SR_L_STATUS_[o.status] || ['', '#6b7280', '#f3f4f6'];
  var codes = (o.codes||[]).join(', ');
  var credit = (o.credits||[]).reduce(function(s,c){ return s + (c.amount||0); }, 0);
  return '<div style="border-top:1px dashed var(--border);padding:4px 0;font-size:11px;line-height:1.45">'+
    '<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-weight:600;background:'+st[2]+';color:'+st[1]+'">'+st[0]+'</span> '+
    '<b>'+_srMoney(o.giaTri)+'</b> · '+esc(o.ngay||'')+' · '+esc(o.nguonDon||'')+
    '<br><span style="color:var(--muted)">Mã bộ đếm: <b>'+esc(codes||'—')+'</b> · Dòng Pos: <b>'+esc(o.posRow)+'</b> · Thẻ Pos: '+esc(o.theSale||'(trống)')+'</span>'+
    (o.credits && o.credits.length ? '<br>'+o.credits.map(function(c){ return esc(c.sale)+': '+(c.dup?'<span style="color:#92400e">đã có thẻ (bỏ qua '+_srMoney(c.wouldBe)+')</span>':'<b style="color:var(--green)">+'+_srMoney(c.amount)+'</b>'); }).join(' · ') : '')+
    (o.note ? '<br><span style="color:var(--hint)">'+esc(o.note)+'</span>' : '')+
  '</div>';
}
function _srRenderL_(d){
  if (!d) return '<div style="color:var(--muted);text-align:center;padding:40px">'+esc(_srState.lastFetchError || 'Chưa có dữ liệu — bấm "Lọc".')+'</div>';
  if (d.ok === false || d.error) return '<div style="color:var(--red);padding:20px">⚠️ '+esc(d.error || 'Lỗi tải báo cáo')+'</div>';
  var t = d.totals || {}, dq = d.dataQuality || {};
  var q = String(_srState.lSearch||'').trim().toLowerCase();
  var rows = (d.rows||[]).filter(function(r){ return _srLRowMatchesSearch_(r, q); });
  var h = '';
  h += '<div class="kpi-grid" style="margin-bottom:12px">'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(t.dongHen)+'</div><div class="kpi-label">Lượt KH hẹn qua cửa hàng</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(t.dongCoDon)+'</div><div class="kpi-label">KH có đơn Pos khớp</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+fmt(t.soDon)+'</div><div class="kpi-label">Số đơn Pos khớp</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(t.doanhThuDon)+'</div><div class="kpi-label">Doanh thu bán được khi khách qua</div></div>'+
    '<div class="kpi-card" style="border-color:var(--green)"><div class="kpi-val" style="color:var(--green)">'+_srMoney(t.daTinh)+'</div><div class="kpi-label">Doanh thu chia thêm cho Sale ('+esc(d.sharePct)+'%)</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="color:#92400e">'+_srMoney(t.trungBoQua)+'</div><div class="kpi-label">Đã có thẻ trên Pos (bỏ qua, tránh trùng)</div></div>'+
  '</div>';
  h += '<div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">'+esc(d.note||'')+' · Nguồn: tab "'+esc(d.sheetName||'')+'" · <a href="https://docs.google.com/spreadsheets/d/'+esc(d.sheetId)+'" target="_blank" rel="noopener">mở trang tính</a></div>';

  var warns = [];
  if (dq.thieuSdt) warns.push(dq.thieuSdt+' dòng thiếu SĐT (không khớp được đơn)');
  if (dq.thieuNgay) warns.push(dq.thieuNgay+' dòng thiếu/sai ngày hẹn');
  if (dq.thieuSale) warns.push(dq.thieuSale+' dòng chưa ghi tên Sale');
  if (d.unresolved && d.unresolved.length) warns.push('Chưa khớp được tên Sale: <b>'+d.unresolved.map(function(u){ return esc(u.raw)+' ('+u.count+')'; }).join(', ')+'</b> — vào "📥 Báo cáo Pancake → Khớp tên" hoặc bảng Danh sách Sale để khớp');
  if (warns.length) h += '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px">⚠️ '+warns.join('<br>⚠️ ')+'<div style="font-size:10.5px;color:#b45309;margin-top:3px">(thống kê trên toàn bộ trang tính, không phụ thuộc bộ lọc ngày)</div></div>';

  // Theo Sale
  h += '<div style="font-weight:700;font-size:13px;margin:6px 0">Theo Sale</div>';
  h += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Sale</th><th style="text-align:right">KH hẹn</th><th style="text-align:right">KH có đơn</th><th style="text-align:right">Số đơn</th><th style="text-align:right">Doanh thu đơn</th><th style="text-align:right">Doanh thu chia thêm ('+esc(d.sharePct)+'%)</th><th style="text-align:right">Đã trùng thẻ Pos</th></tr></thead><tbody>';
  var tot = { kh:0, co:0, don:0, dt:0, cr:0, dup:0 };
  (d.bySale||[]).forEach(function(x){
    tot.kh+=x.khHen; tot.co+=x.khCoDon; tot.don+=x.soDon; tot.dt+=x.doanhThuDon; tot.cr+=x.credited; tot.dup+=x.dupSkipped;
    h += '<tr><td><b>'+esc(x.sale)+'</b></td><td style="text-align:right">'+fmt(x.khHen)+'</td><td style="text-align:right">'+fmt(x.khCoDon)+'</td><td style="text-align:right">'+fmt(x.soDon)+'</td><td style="text-align:right">'+_srMoney(x.doanhThuDon)+'</td><td style="text-align:right;font-weight:700;color:var(--green)">'+_srMoney(x.credited)+'</td><td style="text-align:right;color:#92400e">'+_srMoney(x.dupSkipped)+'</td></tr>';
  });
  if (!(d.bySale||[]).length) h += '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">Không có dữ liệu trong khoảng ngày này</td></tr>';
  else h += _srTotalRowHtml_(['Tổng (cộng theo từng Sale)', fmt(tot.kh), fmt(tot.co), fmt(tot.don), _srMoney(tot.dt), _srMoney(tot.cr), _srMoney(tot.dup)]);
  h += '</tbody></table></div>';
  h += '<div class="guide-text" style="font-size:10.5px;color:var(--hint);margin:3px 0 12px">Cột "Doanh thu đơn" của từng Sale là doanh thu đầy đủ của các đơn khách mua khi qua cửa hàng (đơn có 2 Sale sẽ hiện ở cả 2 dòng); "Doanh thu chia thêm" mới là số tính cho Sale.</div>';

  // Chi tiet
  h += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0"><span style="font-weight:700;font-size:13px">Chi tiết khách qua cửa hàng ('+fmt(rows.length)+' dòng)</span>'+
    '<input type="text" value="'+esc(_srState.lSearch||'')+'" placeholder="🔍 Tìm tên KH / SĐT / Sale..." oninput="_srState.lSearch=this.value;_srLRerenderDetail_()" style="padding:5px 9px;border:1px solid var(--border);border-radius:6px;min-width:220px;background:var(--surface)"></div>';
  h += '<div id="sr-l-detail">'+_srLDetailTable_(rows)+'</div>';
  return h;
}
function _srLDetailTable_(rows){
  var h = '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Ngày qua CH</th><th>Khách</th><th>Sale (khớp tên)</th><th>Tình trạng ghi trên sheet</th><th style="min-width:330px">Đơn Pos khớp (SĐT + ngày)</th><th style="text-align:right">DT đơn</th><th style="text-align:right">DT chia Sale</th><th>Cảnh báo</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var valid = (r.orders||[]).filter(function(o){ return !o.excluded; });
    var dt = valid.reduce(function(s,o){ return s + (o.giaTri||0); }, 0);
    var cr = valid.reduce(function(s,o){ return s + (o.credits||[]).reduce(function(s2,c){ return s2 + (c.amount||0); }, 0); }, 0);
    h += '<tr'+(r.koDen?' style="opacity:.6"':'')+'>'+
      '<td style="white-space:nowrap">'+esc((r.visitDates||[]).map(_srLDmy_).join(', ') || esc(r.ngayHen))+'<div style="font-size:10px;color:var(--hint)">sheet dòng '+esc(r.row)+(r.stt?' · STT '+esc(r.stt):'')+'</div></td>'+
      '<td><b>'+esc(r.tenKh||'—')+'</b><div style="font-size:11px;color:var(--muted)">'+esc(r.phone||'')+(r.kenh?' · '+esc(r.kenh):'')+'</div></td>'+
      '<td>'+((r.sales||[]).map(function(x){ return '<b>'+esc(x.name)+'</b>'+(x.raw!==x.name?'<span style="font-size:10px;color:var(--hint)"> ('+esc(x.raw)+')</span>':''); }).join('<br>') || '<span style="color:var(--muted)">—</span>')+'</td>'+
      '<td style="font-size:11px;max-width:200px">'+esc([r.tinhTrang, r.capNhat].filter(Boolean).join(' · ')).substring(0,220)+'</td>'+
      '<td>'+((r.orders||[]).map(_srLOrderHtml_).join('') || '<span style="color:var(--muted);font-size:11px">— chưa có đơn Pos khớp —</span>')+'</td>'+
      '<td style="text-align:right">'+(valid.length?_srMoney(dt):'—')+'</td>'+
      '<td style="text-align:right;font-weight:700;color:var(--green)">'+(cr?_srMoney(cr):'—')+'</td>'+
      '<td style="font-size:11px;color:#9a3412">'+esc((r.flags||[]).join(' · '))+'</td></tr>';
  });
  if (!rows.length) h += '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">Không có dòng nào</td></tr>';
  return h + '</tbody></table></div>';
}
function _srLRerenderDetail_(){
  var d = _srState.dataL, el = document.getElementById('sr-l-detail');
  if (!d || !el) return;
  var q = String(_srState.lSearch||'').trim().toLowerCase();
  el.innerHTML = _srLDetailTable_((d.rows||[]).filter(function(r){ return _srLRowMatchesSearch_(r, q); }));
}
async function _srLSavePct_(){
  var el = document.getElementById('sr-l-pct');
  var v = el ? parseFloat(String(el.value).replace(',', '.')) : NaN;
  if (isNaN(v) || v <= 0 || v > 100){ toast('Nhập % trong khoảng 1–100'); return; }
  try {
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key:'storeCaseSharePct', value:String(v) }) });
    toast('✓ Đã lưu tỷ lệ chia '+v+'%'); _srLoad();
  } catch(e){ toast('❌ Lỗi lưu: '+e.message); }
}
function renderSalesReportTabL_(wrap, subTabs){
  var filters = _srBarHtml_();
  var body = _srState.loading ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>' : _srRenderL_(_srState.dataL);
  wrap.innerHTML = filters + body;
}
function _srLExportCsv_(kind){
  var d = _srState.dataL;
  if (!d || !d.rows){ toast('Chưa có dữ liệu — bấm "Lọc" trước.'); return; }
  var tag = (d.dateFrom || _srState.lDateFrom || 'tu-dau') + '_' + (d.dateTo || _srState.lDateTo || 'den-nay');
  if (kind === 'summary'){
    var rs = [['Sale','KH hẹn qua CH','KH có đơn','Số đơn','Doanh thu đơn (đầy đủ)','Doanh thu chia thêm ('+d.sharePct+'%)','Đã có thẻ trên Pos (bỏ qua)']];
    (d.bySale||[]).forEach(function(x){ rs.push([x.sale, x.khHen, x.khCoDon, x.soDon, x.doanhThuDon, x.credited, x.dupSkipped]); });
    rs.push(['Tổng đơn duy nhất', d.totals.dongHen, d.totals.dongCoDon, d.totals.soDon, d.totals.doanhThuDon, d.totals.daTinh, d.totals.trungBoQua]);
    _srGDownloadCsv_('KH-qua-cua-hang_tong-hop_'+tag+'.csv', rs);
    return;
  }
  var head = ['Dòng trang tính','STT','Ngày qua CH','Tên KH','SĐT','Kênh','Sale ghi trên sheet','Sale (đã khớp)','Tình trạng KH (sheet)','Doanh thu NV cửa hàng ghi (sheet)','NV cửa hàng lên đơn',
    'Ngày đơn Pos','Nguồn đơn','Mã bộ đếm','Dòng sheet Pos (dữ liệu đơn)','Ghi chú đơn Pos (cột Q)','Sản phẩm','Giá trị đơn (sau giảm giá)','Thẻ Pos hiện tại','Trạng thái xử lý','Sale nhận','% chia','Doanh thu chia cho Sale','Sale đã có thẻ (bỏ qua)','Ghi chú / lý do','Cảnh báo dòng sheet'];
  var out = [head];
  var statusLbl = { 'tinh':'Tính thêm cho Sale', 'trung':'Trùng thẻ Pos - bỏ qua', 'mot-phan':'Trùng một phần', 'hoan':'Đơn hoàn - không tính', 'khong-sale':'Chưa khớp tên Sale' };
  (d.rows||[]).forEach(function(r){
    var base = [r.row, r.stt, (r.visitDates||[]).join(' ; '), r.tenKh, r.phone, r.kenh, r.saleRaw, (r.sales||[]).map(function(x){return x.name;}).join(', '), [r.tinhTrang, r.capNhat].filter(Boolean).join(' · '), r.doanhThuSheet, r.nvCh];
    var flags = (r.flags||[]).join(' · ');
    if (!(r.orders||[]).length){ out.push(base.concat(['','','','','','','','','','','','','','','', flags])); return; }
    r.orders.forEach(function(o){
      var ord = [o.ngay, o.nguonDon, (o.codes||[]).join(' ; '), o.posRow, o.ghiChu, o.sanPham, o.giaTri, o.theSale];
      if (!(o.credits||[]).length){ out.push(base.concat(ord, [statusLbl[o.status]||o.status, '', '', 0, '', o.note, flags])); return; }
      o.credits.forEach(function(c){
        out.push(base.concat(ord, [statusLbl[o.status]||o.status, c.sale, d.sharePct+'%', c.amount, c.dup?'Có':'', o.note, flags]));
      });
    });
  });
  _srGDownloadCsv_('KH-qua-cua-hang_chi-tiet_'+tag+'.csv', out);
}

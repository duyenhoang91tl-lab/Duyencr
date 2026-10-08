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
  } else if (_srState.sub === 'G') {
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
  html += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:8px">Bỏ tích Page/kênh hoặc Sale KHÔNG thuộc phạm vi quản lý của bạn — sẽ ẩn khỏi Dashboard, Báo cáo doanh số A–E và KPI Pancake ngay khi bấm Lưu (không xoá dữ liệu, chỉ ẩn khỏi báo cáo chung).</div>';
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
function _srSyncTeamToSale_(teamField){
  var saleField = _srTeamFieldToSaleField_[teamField];
  if (!saleField) return;
  var selTeams = _srState[teamField] || [];
  if (!selTeams.length) return;
  var union = [];
  var notFound = [];
  selTeams.forEach(function(tname){
    var want = String(tname||'').trim().toLowerCase();
    var t = (teams||[]).find(function(x){ return String(x.name || '(chưa đặt tên)').trim().toLowerCase() === want; });
    if (!t) { notFound.push(tname); return; }
    [t.leader].concat(t.members||[]).filter(Boolean).forEach(function(n){ if (union.indexOf(n)===-1) union.push(n); });
  });
  // KHONG ghi de bo loc Sale bang mang RONG: backend coi mang Sale rong = KHONG LOC GI (hien het
  // du lieu) -> user tuong dang loc theo Team ma thuc ra dang xem toan bo. Neu khong khop duoc Team
  // nao / Team khong co thanh vien nao -> bao ro va giu nguyen lua chon Sale hien co.
  if (!union.length) {
    toast('⚠ Không tìm thấy thành viên nào cho Team đã chọn' + (notFound.length ? ' ('+notFound.join(', ')+')' : ' (Team chưa có thành viên)') + ' — bấm "Đồng bộ" để cập nhật danh sách Team rồi thử lại');
    return;
  }
  if (notFound.length) toast('⚠ Không khớp được Team: ' + notFound.join(', ') + ' — kết quả lọc chỉ gồm các Team còn lại');
  _srState[saleField] = union;
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
  if (_srTeamFieldToSaleField_[r.field]){ renderSalesReportTab(); return; }
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
function _srComboHtml(domId, field, optKey, label, placeholder, widthPx){
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
    '<div id="'+domId+'-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;max-width:210px">'+
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

  var subTabs = '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
    '<button class="btn '+(_srState.sub==='A'?'secondary':'sm')+'" onclick="_srSetSub(\'A\')">Báo cáo A — Base</button>' +
    '<button class="btn '+(_srState.sub==='B'?'secondary':'sm')+'" onclick="_srSetSub(\'B\')">Báo cáo B — Pos</button>' +
    '<button class="btn '+(_srState.sub==='C'?'secondary':'sm')+'" onclick="_srSetSub(\'C\')">Báo cáo C — So sánh kỳ Base</button>' +
    '<button class="btn '+(_srState.sub==='D'?'secondary':'sm')+'" onclick="_srSetSub(\'D\')">Báo cáo D — Sale tự thêm</button>' +
    '<button class="btn '+(_srState.sub==='E'?'secondary':'sm')+'" onclick="_srSetSub(\'E\')">Báo cáo E — Hoa hồng nhân viên Pos</button>' +
    '<button class="btn '+(_srState.sub==='F'?'secondary':'sm')+'" onclick="_srSetSub(\'F\')">Báo cáo F — KPI Sale</button>' +
    '<button class="btn '+(_srState.sub==='G'?'secondary':'sm')+'" onclick="_srSetSub(\'G\')">Báo cáo G — Thưởng thử việc / chính thức</button>' +
    '<button class="btn '+(_srState.sub==='H'?'secondary':'sm')+'" onclick="_srSetSub(\'H\')">Báo cáo H — Tổng quan data đã chia</button>' +
    '<button class="btn '+(_srState.sub==='I'?'secondary':'sm')+'" onclick="_srSetSub(\'I\')">Báo cáo I — Chia data Renew</button>' +
    (_srIsAdmin() ? '<button class="btn '+(_srState.sub==='J'?'secondary':'sm')+'" onclick="_srSetSub(\'J\')">📤 Nhập dữ liệu Base/Pos</button>' : '') +
    '</div>';

  if (_srState.sub === 'C') { renderSalesReportTabC_(wrap, subTabs); return; }
  if (_srState.sub === 'D') { renderSalesReportTabD_(wrap, subTabs); return; }
  if (_srState.sub === 'E') { renderSalesReportTabE_(wrap, subTabs); return; }
  if (_srState.sub === 'F') { renderSalesReportTabF_(wrap, subTabs); return; }
  if (_srState.sub === 'G') { renderSalesReportTabG_(wrap, subTabs); return; }
  if (_srState.sub === 'H') { renderSalesReportTabH_(wrap, subTabs); return; }
  if (_srState.sub === 'I') { renderSalesReportTabI_(wrap, subTabs); return; }
  if (_srState.sub === 'J') { renderSalesReportTabJ_(wrap, subTabs); return; }

  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  filters += _quickRangeSelectHtml(_srState.dateQuick, "_srApplyQuickRange('dateQuick','dateFrom','dateTo',this.value)");
  filters += '<input type="date" value="'+esc(_srState.dateFrom)+'" onchange="_srSetField(\'dateFrom\',this.value);_srState.dateQuick=\'custom\'" title="Từ ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  filters += '<span style="color:var(--muted)">→</span>';
  filters += '<input type="date" value="'+esc(_srState.dateTo)+'" onchange="_srSetField(\'dateTo\',this.value);_srState.dateQuick=\'custom\'" title="Đến ngày" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';

  if (_srState.sub === 'A'){
    filters += '<select onchange="_srSetField(\'dateField\',this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '<option value="ngayTao"'+(_srState.dateField==='ngayTao'?' selected':'')+'>Lọc theo Ngày tạo</option>'+
      '<option value="thoiGianHT"'+(_srState.dateField==='thoiGianHT'?' selected':'')+'>Lọc theo Thời gian hoàn thành</option>'+
      '</select>';
    if (_srIsAdmin()){
      filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Lọc theo Sale'+((_srState.sale||[]).length?' <span style="color:var(--green)">('+(_srState.sale||[]).length+' đã chọn)</span>':'')+'</div>' +
        '<div class="cs-combo" id="sr-sale-combo" style="width:190px">'+
        '<input type="text" id="sr-sale-combo-input" class="cs-combo-input" placeholder="🔍 Tìm & chọn sale..." autocomplete="off" '+
        'oninput="srSaleComboFilter(this.value)" onfocus="srSaleComboOpen()" onkeydown="srSaleComboKey(event)">'+
        '<button type="button" class="cs-combo-clear" id="sr-sale-combo-clear" title="Bỏ chọn hết Sale" onclick="srSaleComboClear(event)" style="display:'+((_srState.sale||[]).length?'':'none')+'">✕</button>'+
        '<span class="cs-combo-caret" onclick="srSaleComboToggle(event)">▾</span>'+
        '<div class="cs-combo-list" id="sr-sale-combo-list"></div>'+
        '</div>'+
        '<div id="sr-sale-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;max-width:220px">'+
        (_srState.sale||[]).map(function(name){
          return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
            esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="srSaleComboRemove(this.parentNode.dataset.name)">✕</span></span>';
        }).join('') +
        '</div></div>';
      filters += _srComboHtml('sr-team-combo-a', 'team', 'teamOptions', 'Lọc theo Team', '🔍 Tìm & chọn team...', 190);
    } else {
      filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Sale</div>'+
        '<div style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)">🔒 '+esc((_srState.sale||[]).join(', ') || currentUser.name)+' — chỉ xem được báo cáo của mình</div></div>';
    }
    filters += _srComboHtml('sr-kenh-combo-a', 'kenh', 'kenhOptions', 'Lọc theo Kênh', '🔍 Tìm & chọn kênh...', 170);
    filters += '<div><div style="font-size:10px;color:var(--hint);margin-bottom:2px">Sản phẩm (cách nhau bằng dấu phẩy)</div>'+
      '<input type="text" value="'+esc(_srState.aSanPham||'')+'" onchange="_srSetField(\'aSanPham\',this.value)" placeholder="vd: tỳ hưu, nhẫn 10k" style="min-width:170px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '</div>';
    filters += '<label style="display:flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;cursor:pointer" title="Tích: mỗi đơn tính TOÀN BỘ doanh thu + số đơn cho đúng 1 người — người được ghi trong cột \'Người tạo\' của DT TỔNG (không phải \'Sale bán\'). Bỏ tích: chia đều doanh thu cho tất cả sale đứng tên trên đơn (mặc định).">'+
      '<input type="checkbox" '+(_srState.byCreator?'checked':'')+' onchange="_srState.byCreator=this.checked;_srApply()">'+
      'Tính theo người tạo đơn</label>';
  } else {
    if (_srIsAdmin()){
      filters += _srbComboHTML('sale');
      filters += _srbComboHTML('team');
    } else {
      filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Sale</div>'+
        '<div style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)">🔒 '+esc((_srState.bSale||[]).join(', ') || currentUser.name)+' — chỉ xem được báo cáo của mình</div></div>';
    }
    filters += _srbComboHTML('nguon');
    filters += _srbComboHTML('mkt');
    filters += '<div><div style="font-size:10px;color:var(--hint);margin-bottom:2px">Sản phẩm (cách nhau bằng dấu phẩy)</div>'+
      '<input type="text" value="'+esc(_srState.bSanPham||'')+'" onchange="_srSetField(\'bSanPham\',this.value)" placeholder="vd: tỳ hưu, nhẫn 10k" style="min-width:170px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '</div>';
    filters += _srbComboHTML('cs');
    filters += _srbComboHTML('kh');
    filters += _srbComboHTML('zalo');
    filters += '<div><div style="font-size:10px;color:var(--hint);margin-bottom:2px">Nick Zalo</div>'+
      '<input type="text" value="'+esc(_srState.bNickZalo||'')+'" onchange="_srSetField(\'bNickZalo\',this.value)" placeholder="Tìm nick..." style="min-width:100px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '</div>';
  }
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  filters += '<button class="btn sm" onclick="exportSalesReport()">📊 Xuất Excel</button>';
  if (_srIsAdmin()) filters += '<button class="btn sm" id="sr-export-sheet-btn" title="'+(_srState.sub==='A' ? 'Ghi đè vào ĐÚNG 1 tab cố định (BC_A_Base) — không tạo tab mới mỗi lần xuất' : 'Tạo 1 tab mới có timestamp, giữ lại lịch sử các lần xuất trước')+'" onclick="exportSalesReportToSheet()">'+(_srState.sub==='A' ? '📌 Cập nhật Sheet Base' : '📄 Xuất ra Sheet')+'</button>';
  if (_srIsAdmin()) filters += '<button class="btn sm secondary" onclick="_srToggleHiddenPanel()" title="Chọn Page/kênh và Sale không thuộc phạm vi quản lý để ẩn khỏi mọi báo cáo chung">👁 Ẩn/Hiện Page &amp; Sale</button>';
  filters += '</div>';

  var body = '';
  var hiddenPanelHtml = (_srIsAdmin() && _srState.hiddenPanelOpen) ? _srHiddenPageSaleHtml() : '';
  if (_srState.loading){
    body = '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>';
  } else if (_srState.sub === 'A'){
    body = _srRenderA(_srState.dataA);
  } else {
    body = _srRenderB(_srState.dataB);
  }

  var titleRow = '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:0">'+
    '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>'+
    '<button class="btn sm" onclick="_srToggleSidebar()" title="Ẩn/hiện bộ lọc KH bên trái để có thêm chỗ, tiện chụp màn hình báo cáo">'+
    (_srSidebarHidden ? '📂 Hiện bộ lọc KH' : '📁 Ẩn bộ lọc KH — chụp màn hình')+'</button></div>';
  wrap.innerHTML = titleRow + subTabs + filters + hiddenPanelHtml + body;
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

// Vẽ cột ngang tỷ lệ chốt — xanh/vàng/đỏ theo mức %, kèm số liệu chốt/tổng bên cạnh mỗi cột,
// và dòng trung bình chung ở trên để dễ đối chiếu nhanh khi chụp màn hình gửi sếp.
function _srCloseRateBarHtml_(rows, searchTerm, unitLabel){
  unitLabel = unitLabel || 'KH';
  var filtered = (rows||[]).filter(function(r){ return r.held>0 && (!searchTerm || r.name.toLowerCase().indexOf(searchTerm.toLowerCase())!==-1); });
  if (!filtered.length) return '<div style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Không có dữ liệu để tính tỷ lệ chốt</div>';
  filtered.sort(function(a,b){ return b.closeRate-a.closeRate; });
  var totHeld = filtered.reduce(function(s,r){return s+r.held;},0);
  var totClosed = filtered.reduce(function(s,r){return s+r.closed;},0);
  var avgRate = totHeld ? Math.round(totClosed/totHeld*100) : 0;
  var th = CLOSE_RATE_THRESHOLDS || { red:2, green:10 };
  function colorFor(p){ return p>th.green ? '#16a34a' : (p>=th.red ? '#d97706' : '#dc2626'); }
  var bars = filtered.map(function(r){
    var w = Math.max(2, Math.min(100, r.closeRate));
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">'+
      '<div style="width:112px;font-size:11.5px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.name)+'">'+esc(r.name)+'</div>'+
      '<div style="flex:1;background:var(--surface2);border-radius:4px;overflow:hidden;height:15px">'+
      '<div style="width:'+w+'%;height:100%;background:'+colorFor(r.closeRate)+';border-radius:4px"></div></div>'+
      '<div style="width:104px;font-size:11px;color:var(--muted);white-space:nowrap"><b style="color:var(--text)">'+r.closeRate+'%</b> ('+r.closed+'/'+r.held+')</div></div>';
  }).join('');
  var isAdmin = currentUser.role === 'admin' || currentUser.role === 'demo';
  var legend = '<span style="color:#16a34a">■</span> &gt;'+th.green+'% &nbsp;<span style="color:#d97706">■</span> '+th.red+'–'+th.green+'% &nbsp;<span style="color:#dc2626">■</span> &lt;'+th.red+'%';
  var editBtn = isAdmin ? ' &nbsp;<a href="javascript:void(0)" onclick="_srToggleCloseRateEdit(this)" style="font-size:10.5px;color:var(--muted);text-decoration:underline">✎ sửa mốc</a>' : '';
  return '<div style="padding:4px 0 10px">'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Trung bình: <b style="color:var(--text)">'+avgRate+'%</b> ('+totClosed+'/'+totHeld+' '+esc(unitLabel)+') &nbsp;·&nbsp; '+legend+editBtn+'</div>'+
    (isAdmin ? '<div class="close-rate-edit-form" style="display:none;margin:-4px 0 10px;padding:8px;background:var(--surface2);border-radius:6px;font-size:11.5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<span>Đỏ dưới</span><input type="number" min="0" max="100" value="'+th.red+'" style="width:52px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;background:var(--surface)" id="cr-edit-red">%'+
      '<span>&nbsp;·&nbsp;Vàng đến</span><input type="number" min="0" max="100" value="'+th.green+'" style="width:52px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;background:var(--surface)" id="cr-edit-green">%'+
      '<span>&nbsp;·&nbsp;Xanh trên đó</span>'+
      '<button class="btn sm primary" onclick="_srSaveCloseRateEdit(this)">Lưu</button>'+
    '</div>' : '')+
    bars+'</div>';
}
function _srToggleCloseRateEdit(a){
  var form = a.closest('div').nextElementSibling;
  if (form && form.classList.contains('close-rate-edit-form')) form.style.display = form.style.display==='none' ? 'flex' : 'none';
}
function _srSaveCloseRateEdit(btn){
  var form = btn.closest('.close-rate-edit-form');
  var red = parseFloat(form.querySelector('#cr-edit-red').value);
  var green = parseFloat(form.querySelector('#cr-edit-green').value);
  if (isNaN(red) || isNaN(green) || red < 0 || green < 0 || red > 100 || green > 100){ toast('⚠️ Mốc % không hợp lệ.'); return; }
  if (red > green){ toast('⚠️ Mốc đỏ phải nhỏ hơn hoặc bằng mốc vàng.'); return; }
  _saveCloseRateThresholds(red, green);
  form.style.display = 'none'; // an ngay hang nhap mac (Do duoi/Vang den/Xanh tren) sau khi luu
  toast('✓ Đã lưu mốc màu: đỏ <'+red+'%, vàng '+red+'–'+green+'%, xanh >'+green+'%');
  if (_activeV9Tab === 'salesreport') renderSalesReportTab();
  if (_activeV9Tab === 'kpipancake') renderKpiPancakeTab();
}

function _srCocTh(){ return _srState.showCoc ? '<th style="text-align:right">Cọc</th>' : ''; }
function _srCocTd(v){ return _srState.showCoc ? '<td style="text-align:right">'+_srMoney(v)+'</td>' : ''; }
function _srCocColspan(base){ return _srState.showCoc ? base : base-1; }

function _srRenderA(d){
  if (!d) return _srNoDataHtml_();
  var html = '<div class="kpi-grid" style="margin-bottom:16px">' +
    '<div class="kpi-card"><div class="kpi-val">'+fmt(d.totalOrders)+'</div><div class="kpi-label">Số lượng đơn</div></div>' +
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.totalCoc)+'</div><div class="kpi-label">Tổng tiền đã cọc/CK (tham khảo)</div></div>' +
    (d.totalGiaTriChenh ? '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.totalGiaTriChenh)+'</div><div class="kpi-label">Trong đó: chênh lệch đơn đổi</div></div>' : '') +
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_srMoney(d.totalGiaTri)+'</div><div class="kpi-label"><b>Tổng đơn (doanh thu, ko ship)</b></div></div>' +
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.trungBinhDon)+'</div><div class="kpi-label">Trung bình đơn (Tổng đơn ÷ số đơn)</div></div>' +
    '</div>' +
    '<div style="font-size:11px;color:var(--muted);margin:-10px 0 10px">Tổng đơn = cộng dồn "Tổng giá trị đơn hàng" (không ship) của TỪNG đơn + phần "Giá trị chênh lệch" của riêng các đơn đổi hàng — đây mới là số doanh thu chuẩn để đối chiếu, không phải cột Cọc.</div>' +
    '<label style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);margin-bottom:12px;cursor:pointer">'+
      '<input type="checkbox" '+(_srState.showCoc!==false?'checked':'')+' onchange="_srState.showCoc=this.checked;renderSalesReportTab()"> Hiện cột Cọc trong các bảng bên dưới'+
    '</label>';

  _SR_COLTH_ROWSFN_['aSale'] = function(){ return (_srState.dataA && _srState.dataA.bySale) || []; };
  _SR_COLTH_GETTER_['aSale'] = { name: function(r){ return r.name; } };
  var saleRows = _srApplyColFilters_(d.bySale||[], 'aSale', _SR_COLTH_GETTER_['aSale']).filter(function(s){ return !_srState.saleSearch || s.name.toLowerCase().indexOf(_srState.saleSearch.toLowerCase())!==-1; });
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
  var saleCloseHtml = '<div class="dash-section-title">Tỷ lệ chốt theo Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn / Tổng tương tác Pancake'+saleCloseNote+')</span></div>'+
    (d.saleCloseRateFrom ? _srCloseRateBarHtml_(d.saleCloseRate, _srState.saleSearch, 'tương tác') :
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
    var kenhCloseHtml = '<div class="dash-section-title">Tỷ lệ chốt theo Kênh <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn / Tổng tương tác Pancake'+kenhCloseNote+')</span></div>'+
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
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(d.totalCod)+'</div><div class="kpi-label">Tổng COD</div></div>' +
    '</div>';

  // Da bo 2 dong thong bao vang (lech so phan tu cot San pham/Ma/So luong + thong ke ghep don Pos<->Base) theo yeu cau Duyen 2026-10-05.
  // Du lieu d.mismatchRows / d.ghep van duoc backend tra ve (dung de debug), chi khong hien tren man hinh nua.

  _SR_COLTH_ROWSFN_['bSale'] = function(){ return (_srState.dataB && _srState.dataB.bySale) || []; };
  _SR_COLTH_GETTER_['bSale'] = { name: function(s){ return s.name; } };
  var saleRows = _srApplyColFilters_(d.bySale||[], 'bSale', _SR_COLTH_GETTER_['bSale']).filter(function(s){ return !_srState.bSaleSearch || (s.name||'').toLowerCase().indexOf(_srState.bSaleSearch.toLowerCase())!==-1; });
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
  var saleCloseHtmlB_ = '<div class="dash-section-title">Tỷ lệ chốt theo Sale <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn / Tổng tương tác Pancake'+bSaleCloseNote+')</span></div>'+
    (d.saleCloseRateFrom ? _srCloseRateBarHtml_(d.saleCloseRate, _srState.bSaleSearch, 'tương tác') :
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
    html += '<div class="dash-section-title" style="margin-top:18px">Tỷ lệ chốt theo Sale — từng Page<span style="font-weight:400;color:var(--muted);font-size:11px">'+bSaleCloseNote+'</span></div>';
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
    var nguonCloseHtmlB_ = '<div class="dash-section-title">Tỷ lệ chốt theo Nguồn đơn <span style="font-weight:400;color:var(--muted);font-size:11px">(Số đơn / Tổng tương tác Pancake'+bKenhCloseNote+' — chỉ tính được các dòng Nguồn đơn có kèm ID Page, vd "Facebook / Tên Page (ID)")</span></div>'+
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
  return html;
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
  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
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
  filters += '<select onchange="_srState.cDateField=this.value" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<option value="ngayTao"'+(_srState.cDateField==='ngayTao'?' selected':'')+'>Lọc theo Ngày tạo</option>'+
    '<option value="thoiGianHT"'+(_srState.cDateField==='thoiGianHT'?' selected':'')+'>Lọc theo Thời gian hoàn thành</option>'+
    '</select>';
  if (_srIsAdmin()){
    filters += _srComboHtml('sr-sale-combo-c', 'cSale', 'saleOptions', 'Lọc theo Sale', '🔍 Tìm & chọn sale...', 170);
    filters += _srComboHtml('sr-team-combo-c', 'cTeam', 'teamOptions', 'Lọc theo Team', '🔍 Tìm & chọn team...', 190);
  } else {
    filters += '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">Sale</div>'+
      '<div style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;color:var(--muted)">🔒 '+esc((_srState.cSale||[]).join(', ') || currentUser.name)+' — chỉ xem được báo cáo của mình</div></div>';
  }
  filters += _srComboHtml('sr-kenh-combo-c', 'cKenh', 'kenhOptions', 'Lọc theo Kênh bán', '🔍 Tìm & chọn kênh bán...', 170);
  filters += '<div><div style="font-size:10px;color:var(--hint);margin-bottom:2px">Sản phẩm (cách nhau bằng dấu phẩy)</div>'+
    '<input type="text" value="'+esc(_srState.cSanPham||'')+'" onchange="_srSetField(\'cSanPham\',this.value)" placeholder="vd: tỳ hưu, nhẫn 10k" style="min-width:170px;font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '</div>';
  filters += '<label style="display:flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;cursor:pointer" title="Tích: mỗi đơn tính TOÀN BỘ kết quả cho đúng 1 người — người được ghi trong cột \'Người tạo\' của DT TỔNG (không phải \'Sale bán\'). Bỏ tích: chia đều cho tất cả sale đứng tên trên đơn (mặc định). Dùng chung 1 lựa chọn với Báo cáo A.">'+
    '<input type="checkbox" '+(_srState.byCreator?'checked':'')+' onchange="_srState.byCreator=this.checked;_srApply()">'+
    'Tính theo người tạo đơn</label>';
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  filters += '<button class="btn sm" onclick="exportSalesReportC()">📊 Xuất Excel</button>';
  if (_srIsAdmin()) filters += '<button class="btn sm" id="sr-export-sheet-btn" onclick="exportSalesReportToSheet()">📄 Xuất ra Sheet</button>';
  filters += '</div>';

  var body = _srState.loading ? '<div style="color:var(--muted);text-align:center;padding:40px">Đang tải...</div>' : _srRenderC(_srState.dataC);
  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + filters + body;
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
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'importSheetRows', sheet: kind, rows: rows }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    _impState.result = Object.assign({ kind: kind }, d);
    toast('✓ Đã nhập '+fmt(d.written)+' dòng mới'+(d.skippedExisting?', bỏ qua '+fmt(d.skippedExisting)+' đơn ĐÃ CÓ trong hệ thống':'')+(d.dedupedAfter?' (tự loại '+fmt(d.dedupedAfter)+' dòng trùng tuyệt đối)':'')+' vào '+(kind==='base'?'DT TỔNG':'dữ liệu đơn')+'.');
    logAudit('import_'+kind, '', '', 'Nhập dữ liệu '+(kind==='base'?'Base':'Pos')+' từ file: +'+d.written+' dòng, loại trùng '+(d.dedupedAfter||0));
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
    html += '<div style="margin-top:8px;padding:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;color:#166534">✓ Đã thêm <b>'+fmt(res.written)+'</b> dòng mới'+(res.skippedExisting?', bỏ qua <b>'+fmt(res.skippedExisting)+'</b> đơn ĐÃ CÓ sẵn trong hệ thống (không ghi lại → không nhân đôi doanh thu)':'')+(res.skippedDupInFile?', bỏ qua '+fmt(res.skippedDupInFile)+' dòng trùng ngay trong file':'')+(res.dedupedAfter?', tự động loại '+fmt(res.dedupedAfter)+' dòng trùng tuyệt đối với dữ liệu sẵn có':'')+'.</div>';
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

function renderSalesReportTabD_(wrap, subTabs){
  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  filters += _quickRangeSelectHtml(_srState.dDateQuick, "_srApplyQuickRange('dDateQuick','dDateFrom','dDateTo',this.value)");
  filters += '<input type="date" value="'+esc(_srState.dDateFrom)+'" onchange="_srState.dDateFrom=this.value;_srState.dDateQuick=\'custom\'" title="Từ ngày thêm" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  filters += '<span style="color:var(--muted)">→</span>';
  filters += '<input type="date" value="'+esc(_srState.dDateTo)+'" onchange="_srState.dDateTo=this.value;_srState.dDateQuick=\'custom\'" title="Đến ngày thêm" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">';
  filters += _srComboHtml('sr-cs-combo-d', 'dCs', 'saleOptions', 'Lọc theo CS', '🔍 Tìm & chọn CS...', 190);
  filters += _srComboHtml('sr-team-combo-d', 'dTeam', 'teamOptions', 'Lọc theo Team', '🔍 Tìm & chọn team...', 190);
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  filters += '<button class="btn sm" id="sr-export-sheet-btn" onclick="exportSalesReportToSheet()">📄 Xuất ra Sheet</button>';
  filters += '</div>';

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
      (d.rows||[]).forEach(function(r){
        var latestNote = r.note || '';
        try { var arr = JSON.parse(r.note||'[]'); if (Array.isArray(arr) && arr.length) latestNote = arr[0].text || ''; } catch(eN){}
        html += '<tr><td>'+esc(r.phone)+'</td><td><a href="javascript:void(0)" onclick="openDp(\''+esc(r.phone)+'\')">'+esc(r.name)+'</a></td><td>'+esc(latestNote)+'</td><td>'+esc(r.cs)+'</td><td>'+esc(String(r.createdAt||'').slice(0,16).replace('T',' '))+'</td></tr>';
      });
      if (!(d.rows||[]).length) html += '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Không có dữ liệu</td></tr>';
      html += '</tbody></table>';
      body = html;
    }
  }
  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' + subTabs + filters + body;
}


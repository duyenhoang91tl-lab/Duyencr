// Mo phong var-hoisting cua khoi script goc (da tach file): khai bao truoc cac bien var dung o cac file sau.
var _srSidebarHidden, _posOrdersCache, _posOrdersState, _cskhDetailCache, _cskhDetailState, DATA_DAO_SOURCES, NEW_LEAD_SOURCES, AUTO_HEN_TAG, HANG_KEYS, HANG_LABEL, VN_OFFSET_MS_, NAME_ADDR_KEYWORDS_RE, NAME_MERGE_LABEL_RE, NAME_ALLOWED_CHARS_RE, PTS_RATE, PTS_VALUE, _barMenuItems, _PERM_TAB_DEFS, _BAR_ITEM_DEFS, _barDragId;

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
// BUG FIX: splitMulti_ duoc dung o vai cho (careCSSet, _schedResponsibleCS) trong chinh
// script nay nhung truoc day CHUA duoc dinh nghia o phia client — ham cung ten chi ton tai
// trong ban sao code backend (khoi tham khao "Copy Apps Script Code", khong thuc thi trong
// trinh duyet) — gay loi "splitMulti_ is not defined" khi Auto-sync chay. Dinh nghia lai
// dung y het logic ben backend de dung o day.
function splitMulti_(str, delimiter) {
  if (!str && str !== 0) return [];
  var s = String(str);
  if (!s.trim()) return [];
  return s.split(delimiter).map(function(x){ return x.trim(); }).filter(function(x){ return x !== ''; });
}
// Migration: nếu localStorage lưu string[] cũ → chuyển thành tree phẳng
function _migrateCareStatusIfNeeded(raw) {
  if (!raw) return null;
  // Nếu là mảng thuần string[] → wrap mỗi item thành leaf node
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    return raw.map(function(s) { return { label: s, value: s }; });
  }
  // Đã là tree
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') return raw;
  return null;
}

// CARE_STATUS flat array — tự động derive từ CARE_STATUS_TREE (backward-compat với mọi nơi dùng CARE_STATUS)
function _flatCareStatusValues() {
  var out = [];
  CARE_STATUS_TREE.forEach(function(node) {
    if (node.children) {
      node.children.forEach(function(child) { if (child.value) out.push(child.value); });
    } else {
      if (node.value) out.push(node.value);
    }
  });
  return out;
}
function _syncCareStatusFlat() {
  CARE_STATUS.length = 0;
  _flatCareStatusValues().forEach(function(v) { CARE_STATUS.push(v); });
}

// Kéo bản mới nhất từ GSheets lúc tải trang (giống hệt cơ chế nickZaloList) — để CS khác cũng
// thấy đúng cây trạng thái mà Admin vừa sửa, không chỉ đúng trên máy người bấm Lưu.
async function _syncKhStatusTreeFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=khStatusTree', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var tree = JSON.parse(data.value);
      if (Array.isArray(tree) && tree.length) {
        CUSTOMER_STATUS_TREE.length = 0;
        tree.forEach(function(n){ CUSTOMER_STATUS_TREE.push(n); });
        saveLS('ome_kh_status_tree', CUSTOMER_STATUS_TREE);
        // Refresh dropdown nếu đang mở form khi đồng bộ xong
        var sel = document.getElementById('cs-kh-status');
        if (sel) { var cur = sel.value; sel.innerHTML = _buildCustStatusOptions(cur); }
      }
    }
  } catch(e) { /* giữ nguyên bản local nếu lỗi mạng/parse */ }
}
async function _syncCloseRateThresholdsFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=closeRateThresholds', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var t = JSON.parse(data.value);
      if (t && typeof t.red === 'number' && typeof t.green === 'number') {
        CLOSE_RATE_THRESHOLDS = t;
        saveLS('ome_close_rate_thresholds', CLOSE_RATE_THRESHOLDS);
        if (typeof renderSalesReportTab === 'function' && _activeV9Tab === 'salesreport') renderSalesReportTab();
        if (typeof renderKpiPancakeTab === 'function' && _activeV9Tab === 'kpipancake') renderKpiPancakeTab();
      }
    }
  } catch(e) { /* giữ nguyên bản local nếu lỗi mạng/parse */ }
}
async function _saveCloseRateThresholds(red, green){
  CLOSE_RATE_THRESHOLDS = { red: red, green: green };
  saveLS('ome_close_rate_thresholds', CLOSE_RATE_THRESHOLDS);
  if (!gsUrl) return;
  try {
    await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'closeRateThresholds', value: JSON.stringify(CLOSE_RATE_THRESHOLDS) }) });
    logAudit('setting','', '', 'Đổi mốc màu Tỷ lệ chốt: đỏ <'+red+'%, vàng '+red+'–'+green+'%, xanh >'+green+'%');
  } catch(e){ toast('❌ Lưu mốc màu lỗi: ' + e.message); }
}

async function _syncHiddenPageSaleFromGAS() {
  if (!gsUrl) return;
  try {
    var r1 = await fetch(gsUrl + '?action=getSetting&key=hiddenChannels', {redirect:'follow'});
    var d1 = await r1.json();
    if (d1 && d1.value) { var hc = JSON.parse(d1.value); if (Array.isArray(hc)) { HIDDEN_CHANNELS = hc; saveLS('ome_hidden_channels', HIDDEN_CHANNELS); } }
    var r2 = await fetch(gsUrl + '?action=getSetting&key=hiddenSales', {redirect:'follow'});
    var d2 = await r2.json();
    if (d2 && d2.value) { var hs = JSON.parse(d2.value); if (Array.isArray(hs)) { HIDDEN_SALES = hs; saveLS('ome_hidden_sales', HIDDEN_SALES); } }
    if (typeof renderDashboard === 'function' && _activeV9Tab === 'dashboard') renderDashboard();
    if (typeof renderSalesReportTab === 'function' && _activeV9Tab === 'salesreport') renderSalesReportTab();
  } catch(e) { /* giữ nguyên bản local nếu lỗi mạng/parse */ }
}
async function _saveHiddenPageSale(){
  saveLS('ome_hidden_channels', HIDDEN_CHANNELS);
  saveLS('ome_hidden_sales', HIDDEN_SALES);
  if (!gsUrl) return;
  try {
    await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'hiddenChannels', value: JSON.stringify(HIDDEN_CHANNELS) }) });
    await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'hiddenSales', value: JSON.stringify(HIDDEN_SALES) }) });
    logAudit('setting','', '', 'Ẩn khỏi báo cáo chung — Page: '+(HIDDEN_CHANNELS.join(', ')||'(không)')+' | Sale: '+(HIDDEN_SALES.join(', ')||'(không)'));
  } catch(e){ toast('❌ Lưu cài đặt ẩn Page/Sale lỗi: ' + e.message); }
}
async function _syncGoldUnitAmountFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=goldUnitAmount', {redirect:'follow'});
    var data = await r.json();
    var n = Number(data && data.value);
    if (n > 0) { GOLD_UNIT_AMOUNT = n; saveLS('ome_gold_unit_amount', GOLD_UNIT_AMOUNT); }
  } catch(e) { /* giữ nguyên bản local nếu lỗi mạng/parse */ }
}
async function saveGoldUnitAmount(newVal){
  var n = Number(newVal);
  if (!(n > 0)) { toast('⚠️ Đơn giá vàng không hợp lệ.'); return; }
  GOLD_UNIT_AMOUNT = n;
  saveLS('ome_gold_unit_amount', GOLD_UNIT_AMOUNT);
  if (!gsUrl) { toast('✓ Đã lưu đơn giá vàng (local)'); return; }
  try {
    await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'goldUnitAmount', value: String(n) }) });
    logAudit('setting','', '', 'Đổi đơn giá vàng (Pancake AI): ' + n.toLocaleString('vi-VN') + 'đ / đơn vị');
    toast('✓ Đã lưu và áp dụng đơn giá vàng cho cả team');
  } catch(e){ toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
}
function openGoldUnitModal(){
  var v = prompt('Đơn giá 1 đơn vị vàng (đ) — áp dụng cho ô "Thêm vàng" bên Pancake AI:', GOLD_UNIT_AMOUNT);
  if (v === null) return;
  saveGoldUnitAmount(v.replace(/[^\d]/g,''));
}

async function _syncFieldLabelsFromGAS() {
  if (!gsUrl) return;
  try {
    var r1 = await fetch(gsUrl + '?action=getSetting&key=fieldLabelCS', {redirect:'follow'});
    var d1 = await r1.json();
    if (d1 && d1.value) { FIELD_LABEL_CS = d1.value; saveLS('ome_field_label_cs', FIELD_LABEL_CS); }
    var r2 = await fetch(gsUrl + '?action=getSetting&key=fieldLabelKH', {redirect:'follow'});
    var d2 = await r2.json();
    if (d2 && d2.value) { FIELD_LABEL_KH = d2.value; saveLS('ome_field_label_kh', FIELD_LABEL_KH); }
    var r3 = await fetch(gsUrl + '?action=getSetting&key=fieldLabelZalo', {redirect:'follow'});
    var d3 = await r3.json();
    if (d3 && d3.value) { FIELD_LABEL_ZALO = d3.value; saveLS('ome_field_label_zalo', FIELD_LABEL_ZALO); }
    var r4 = await fetch(gsUrl + '?action=getSetting&key=zaloStatusOpts', {redirect:'follow'});
    var d4 = await r4.json();
    if (d4 && d4.value) { var arr = JSON.parse(d4.value); if (Array.isArray(arr) && arr.length) { _zaloApplyOpts_(arr); saveLS('ome_zalo_status_opts', ZALO_STATUS.slice()); } }
  } catch(e) {}
  _applyFieldLabels();
}
async function renameBuiltinField(which) {
  var isAdmin = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  if (!isAdmin) { toast('Chỉ admin mới đổi tên trường.'); return; }
  var cur = which === 'kh' ? FIELD_LABEL_KH : FIELD_LABEL_CS;
  var name = prompt('Đổi tên hiển thị cho trường này (áp dụng toàn bộ hệ thống sau khi tải lại trang):', cur);
  if (name === null) return;
  name = name.trim();
  if (!name) { toast('Tên không được để trống.'); return; }
  if (which === 'kh') { FIELD_LABEL_KH = name; saveLS('ome_field_label_kh', name); }
  else { FIELD_LABEL_CS = name; saveLS('ome_field_label_cs', name); }
  _applyFieldLabels();
  if (gsUrl) {
    try {
      await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'setSetting', key: which==='kh'?'fieldLabelKH':'fieldLabelCS', value: name }) });
      toast('✓ Đã đổi tên và đồng bộ. Tải lại trang để áp dụng đầy đủ ở mọi nơi.');
    } catch(e) { toast('✓ Đã lưu local — không đồng bộ được GSheets: ' + e.message); }
  } else {
    toast('✓ Đã đổi tên (local). Tải lại trang để áp dụng đầy đủ ở mọi nơi.');
  }
}
// Cập nhật các nhãn TĨNH (không nằm trong hàm render nào, chỉ set 1 lần lúc load trang) —
// những chỗ nằm trong template literal của các hàm render thì tự động đổi ở lần render sau
// (đã dùng biến FIELD_LABEL_CS/FIELD_LABEL_KH trực tiếp), không cần xử lý ở đây.
function _applyFieldLabels() {
  var map = {
    'lbl-fieldcs-adv': FIELD_LABEL_CS, 'lbl-fieldcs-coltoggle': FIELD_LABEL_CS, 'lbl-fieldcs-th': FIELD_LABEL_CS,
    'lbl-fieldcs-help': FIELD_LABEL_CS, 'lbl-fieldkh-help': FIELD_LABEL_KH
  };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = map[id];
  });
}
async function _syncCustomFieldsFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=customFields', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var arr = JSON.parse(data.value);
      if (Array.isArray(arr)) {
        CUSTOM_FIELDS.length = 0;
        arr.forEach(function(f){ CUSTOM_FIELDS.push(f); });
        saveLS('ome_custom_fields', CUSTOM_FIELDS);
        // Nếu đang mở panel chi tiết 1 khách → vẽ lại để hiện trường mới admin vừa tạo
        if (typeof currentPhone !== 'undefined' && currentPhone && typeof renderDpTab === 'function'
            && typeof currentDpTab !== 'undefined' && currentDpTab === 'care') {
          try { renderDpTab('care'); } catch(e){}
        }
      }
    }
  } catch(e) { /* giữ nguyên bản local nếu lỗi mạng/parse */ }
}
async function _syncIndividualRatesFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=individualRates', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var obj = JSON.parse(data.value);
      if (obj && typeof obj === 'object') {
        INDIVIDUAL_RATES = obj;
        saveLS('ome_individual_rates', INDIVIDUAL_RATES);
        if (typeof _srState !== 'undefined' && _srState.sub === 'E') renderSalesReportTab();
      }
    }
  } catch(e) { /* giữ bản local nếu lỗi mạng/parse */ }
}
async function saveIndividualRates() {
  saveLS('ome_individual_rates', INDIVIDUAL_RATES);
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'setSetting', key:'individualRates', value: JSON.stringify(INDIVIDUAL_RATES) }) });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
      else toast('✓ Đã lưu và đồng bộ % hoa hồng cá nhân lên Google Sheets');
    } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
  } else {
    toast('✓ Đã lưu % hoa hồng cá nhân (local)');
  }
}

function saleGroupLabel(key){ var g = SALE_GROUPS.find(function(x){return x.key===key;}); return g ? g.label : key; }
async function _syncSaleGroupsFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=saleGroups', {redirect:'follow'});
    var data = await r.json();
    if (data && data.ok && Array.isArray(data.groups) && data.groups.length) {
      SALE_GROUPS = data.groups;
      saveLS('ome_sale_groups', SALE_GROUPS);
    }
  } catch(e) { /* giu ban local/mac dinh neu loi mang */ }
}
async function saveSaleGroups(list) {
  SALE_GROUPS = list;
  saveLS('ome_sale_groups', SALE_GROUPS);
  if (!gsUrl) { toast('✓ Đã lưu danh sách đội (local)'); return; }
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
      body: JSON.stringify({ action:'saveSaleGroups', groups: list }) });
    var d = await r.json().catch(function(){ return {}; });
    if (d && d.ok) toast('✓ Đã lưu danh sách đội lên Google Sheets');
    else toast('Lưu local ✓ — GSheets: ' + (d.error||'lỗi không rõ'));
  } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
}

async function _syncSaleChannelsFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=saleChannels', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var obj = JSON.parse(data.value);
      if (obj && typeof obj === 'object') {
        SALE_CHANNELS = obj;
        saveLS('ome_sale_channels', SALE_CHANNELS);
        if (typeof _srState !== 'undefined' && _srState.sub === 'E') renderSalesReportTab();
      }
    }
  } catch(e) { /* giữ bản local nếu lỗi mạng/parse */ }
}
async function saveSaleChannels() {
  saveLS('ome_sale_channels', SALE_CHANNELS);
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'setSetting', key:'saleChannels', value: JSON.stringify(SALE_CHANNELS) }) });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
      else toast('✓ Đã lưu và đồng bộ phân loại Online/Offline lên Google Sheets');
    } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
  } else {
    toast('✓ Đã lưu phân loại Online/Offline (local)');
  }
}

async function _syncChannelCommissionRatesFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=channelCommissionRates', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var obj = JSON.parse(data.value);
      if (obj && typeof obj === 'object') {
        CHANNEL_COMMISSION_RATES = obj;
        saveLS('ome_channel_commission_rates', CHANNEL_COMMISSION_RATES);
        if (typeof _srState !== 'undefined' && _srState.sub === 'E') renderSalesReportTab();
      }
    }
  } catch(e) { /* giữ bản local nếu lỗi mạng/parse */ }
}
async function saveChannelCommissionRates() {
  saveLS('ome_channel_commission_rates', CHANNEL_COMMISSION_RATES);
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'setSetting', key:'channelCommissionRates', value: JSON.stringify(CHANNEL_COMMISSION_RATES) }) });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
      else toast('✓ Đã lưu và đồng bộ % hoa hồng theo Kênh lên Google Sheets');
    } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
  } else {
    toast('✓ Đã lưu % hoa hồng theo Kênh (local)');
  }
}

function _channelCommissionRate_(kenh){
  if (!kenh) return null;
  var k = String(kenh).trim().toLowerCase();
  // QUY TAC KE TOAN (file check_doanh_thu, Buoc 3): nguon don CHI co chu "Facebook" = don duoc/my pham ->
  // MAC DINH chi tinh 1% hoa hong. Admin cai ro % cho "facebook" trong modal thi lay theo cai do.
  if (k === 'facebook' && !Object.prototype.hasOwnProperty.call(CHANNEL_COMMISSION_RATES, k)) return 1;
  if (!k || !Object.prototype.hasOwnProperty.call(CHANNEL_COMMISSION_RATES, k)) return null;
  var v = CHANNEL_COMMISSION_RATES[k];
  return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
}

async function _syncBonusProgramsFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=bonusPrograms', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      var arr = JSON.parse(data.value);
      if (Array.isArray(arr)) {
        BONUS_PROGRAMS = arr;
        saveLS('ome_bonus_programs', BONUS_PROGRAMS);
        if (typeof _srState !== 'undefined' && _srState.sub === 'E') renderSalesReportTab();
      }
    }
  } catch(e) { /* giữ bản local nếu lỗi mạng/parse */ }
}
async function saveBonusPrograms() {
  saveLS('ome_bonus_programs', BONUS_PROGRAMS);
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'setSetting', key:'bonusPrograms', value: JSON.stringify(BONUS_PROGRAMS) }) });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
      else toast('✓ Đã lưu và đồng bộ chương trình thưởng lên Google Sheets');
    } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
  } else {
    toast('✓ Đã lưu chương trình thưởng (local)');
  }
  if (typeof _srState !== 'undefined' && _srState.sub === 'E') renderSalesReportTab();
}

// Team mà 1 sale thuộc về (leader hoặc thành viên) — dùng để fallback rate khi cá nhân chưa cài
function _teamRateForName_(name) {
  for (var i = 0; i < teams.length; i++) {
    var t = teams[i];
    if (t.leader === name || (t.members||[]).indexOf(name) !== -1) return { team: t, rate: t.ratePct || {above15:0, below15:0} };
  }
  return { team: null, rate: {above15:0, below15:0} };
}

// % hoa hồng thực áp dụng cho 1 sale — ƯU TIÊN mức cá nhân (từng ô riêng: có thể chỉ set ≥15tr
// mà để trống <15tr, khi đó <15tr vẫn lấy theo team) — hết thì lấy theo team đang thuộc về —
// không thuộc team nào và chưa cài cá nhân thì 0%.
function _resolveCommissionRate_(name) {
  var indiv = INDIVIDUAL_RATES[name] || {};
  var teamInfo = _teamRateForName_(name);
  var hasA = indiv.above15 !== undefined && indiv.above15 !== null && indiv.above15 !== '';
  var hasB = indiv.below15 !== undefined && indiv.below15 !== null && indiv.below15 !== '';
  // QUY TAC KE TOAN (file check_doanh_thu, Buoc 7): chua cai ca nhan/team thi MAC DINH theo phan loai
  // Online/Offline cua sale — Online: >=15tr 1,5% / <15tr 1%; Offline: >=15tr 1% / <15tr 0,8%.
  // Team chi tinh la "da cai" khi % > 0 (ratePct mac dinh 0/0 = chua cai).
  var tr = teamInfo.rate || {};
  var teamA = teamInfo.team && Number(tr.above15) > 0, teamB = teamInfo.team && Number(tr.below15) > 0;
  var chn = SALE_CHANNELS[name];
  var def = chn === 'online' ? { above15: 1.5, below15: 1, label: 'Mặc định Online' }
          : chn === 'offline' ? { above15: 1, below15: 0.8, label: 'Mặc định Offline' } : null;
  function _src(has, teamHas){ return has ? 'Cá nhân' : (teamHas ? 'Team ' + teamInfo.team.name : (def ? def.label : 'Chưa cài')); }
  return {
    above15: hasA ? Number(indiv.above15) : (teamA ? Number(tr.above15) : (def ? def.above15 : 0)),
    below15: hasB ? Number(indiv.below15) : (teamB ? Number(tr.below15) : (def ? def.below15 : 0)),
    sourceAbove15: _src(hasA, teamA),
    sourceBelow15: _src(hasB, teamB)
  };
}

// Tính hoa hồng từng sale từ danh sách đơn hàng đã lọc (orders trả về từ action=salesReportA,
// mỗi đơn có saleBan + giaTriDon) — CHIA ĐỀU doanh thu cho N sale/đơn giống hệt quy ước
// "chia đều" đã dùng cho Báo cáo A, rồi phân loại theo ngưỡng COMMISSION_THRESHOLD và nhân
// đúng % của TỪNG người (cá nhân/team riêng) cho phần doanh thu của họ.
function _computeCommissionData_(orders) {
  var bySale = {};
  var totalOrdersAbove15 = 0, totalOrdersBelow15 = 0, totalRevenueAbove15 = 0, totalRevenueBelow15 = 0;
  var totalOrdersChannel = 0, totalRevenueChannel = 0; // don thuoc kenh co % rieng — van la doanh thu that, phai vao TONG
  (orders||[]).forEach(function(m){
    var giaTri = Number(m.giaTriDon) || 0;
    var isAbove = giaTri >= COMMISSION_THRESHOLD;
    // Nguồn đơn đã được admin cài % riêng (vd "facebook" = 1%) -> BỎ QUA hoàn toàn ngưỡng
    // 15tr + % cá nhân/team, tính thẳng theo đúng % kênh đó cho phần doanh thu chia của sale.
    var chRate = _channelCommissionRate_(m.nguonDon);
    if (chRate === null) {
      if (isAbove) { totalOrdersAbove15++; totalRevenueAbove15 += giaTri; }
      else { totalOrdersBelow15++; totalRevenueBelow15 += giaTri; }
    } else { totalOrdersChannel++; totalRevenueChannel += giaTri; }
    // Don Pos GHEP voi Base (backend tra saleShares = [{name, frac}], tong frac = 1): chia doanh thu theo ty le
    // cua tung don goc ben Base, KHONG chia deu. Don thuong: chia deu cho N sale nhu cu.
    var shareMap = null, salesList;
    if (m.saleShares && m.saleShares.length) {
      shareMap = {};
      salesList = m.saleShares.map(function(x){ shareMap[x.name] = x.frac; return x.name; });
    } else {
      salesList = splitMulti_(m.saleBan, ',');
      if (!salesList.length) salesList = ['(chưa gán sale)'];
    }
    var n = salesList.length;
    salesList.forEach(function(sName){
      // saleRatio 0.3 = don Quay Hao Nam gan the sale + note 30/70: chi 30% doanh thu chia cho sale (70% la cua quay)
      var share = (shareMap ? giaTri * shareMap[sName] : giaTri / n) * (Number(m.saleRatio) || 1);
      if (!bySale[sName]) bySale[sName] = { ordersAbove15:0, ordersBelow15:0, revenueAbove15:0, revenueBelow15:0, channelRevenue:0, channelCommission:0, channelBreakdown:{} };
      if (chRate !== null) {
        var kenhKey = String(m.nguonDon||'').trim();
        bySale[sName].channelRevenue += share;
        bySale[sName].channelCommission += share * (chRate/100);
        if (!bySale[sName].channelBreakdown[kenhKey]) bySale[sName].channelBreakdown[kenhKey] = { revenue:0, rate:chRate };
        bySale[sName].channelBreakdown[kenhKey].revenue += share;
      } else if (isAbove) { bySale[sName].ordersAbove15++; bySale[sName].revenueAbove15 += share; }
      else { bySale[sName].ordersBelow15++; bySale[sName].revenueBelow15 += share; }
    });
  });
  // Giong Bao cao B (Theo Sale): KHONG liet ke "(chưa gán sale)" — khong co nguoi nao de tra hoa hong.
  // Doanh thu cua don do van nam trong cac the TONG o tren (khong mat).
  var rows = Object.keys(bySale).filter(function(name){ return name !== '(chưa gán sale)'; }).map(function(name){
    var s = bySale[name];
    var rate = _resolveCommissionRate_(name);
    var commission = s.revenueAbove15 * (rate.above15/100) + s.revenueBelow15 * (rate.below15/100) + s.channelCommission;
    return {
      name: name,
      ordersAbove15: s.ordersAbove15, ordersBelow15: s.ordersBelow15,
      revenueAbove15: s.revenueAbove15, revenueBelow15: s.revenueBelow15,
      rateAbove15: rate.above15, rateBelow15: rate.below15,
      sourceAbove15: rate.sourceAbove15, sourceBelow15: rate.sourceBelow15,
      channelRevenue: s.channelRevenue, channelCommission: s.channelCommission, channelBreakdown: s.channelBreakdown,
      commission: commission
    };
  });
  rows.sort(function(a,b){ return b.commission - a.commission; });
  var totalCommission = rows.reduce(function(s,r){ return s + r.commission; }, 0);
  return {
    threshold: COMMISSION_THRESHOLD,
    totalOrdersAbove15: totalOrdersAbove15, totalOrdersBelow15: totalOrdersBelow15,
    totalRevenueAbove15: totalRevenueAbove15, totalRevenueBelow15: totalRevenueBelow15,
    totalOrdersChannel: totalOrdersChannel, totalRevenueChannel: totalRevenueChannel,
    bySale: rows, totalCommission: totalCommission
  };
}

// Build <option> cho 1 trường tự tạo — cùng cách hiển thị optgroup mẹ/con như _buildCustStatusOptions
function _buildCustomFieldOptions(field, selected) {
  var html = '<option value="">— Chọn —</option>';
  (field.tree || []).forEach(function(node) {
    if (node.children && node.children.length) {
      html += '<optgroup label="' + esc(node.label) + '">';
      node.children.forEach(function(ch) {
        var v = ch.value || ch.label;
        html += '<option value="' + esc(v) + '"' + (selected === v ? ' selected' : '') + '>'
             + esc(node.label + ' → ' + ch.label) + '</option>';
      });
      html += '</optgroup>';
    } else {
      var v2 = node.value || node.label;
      html += '<option value="' + esc(v2) + '"' + (selected === v2 ? ' selected' : '') + '>' + esc(node.label) + '</option>';
    }
  });
  return html;
}

// HTML các ô select của trường tự tạo, chèn vào form "Thông tin chăm sóc"
function _renderCustomFieldInputs(care) {
  if (!CUSTOM_FIELDS.length) return '';
  var vals = (care && care.custom) || {};
  var cells = CUSTOM_FIELDS.map(function(f){
    return '<div>'
      + '<div class="form-label fld-lbl" data-fld="cf:' + esc(f.id) + '">' + esc(f.label) + _fieldEditBtn('cf:' + f.id) + '</div>'
      + '<select class="form-select" id="cf-' + esc(f.id) + '" data-cfid="' + esc(f.id) + '">'
      + _buildCustomFieldOptions(f, vals[f.id] || '')
      + '</select></div>';
  });
  // Ghép 2 ô/hàng cho khớp lưới form-row-2 hiện có
  var html = '';
  for (var i = 0; i < cells.length; i += 2) {
    html += '<div class="form-row-2">' + cells[i] + (cells[i+1] || '<div></div>') + '</div>';
  }
  return html;
}

// Đọc giá trị CS đang chọn ở các trường tự tạo (dùng khi lưu)
function _collectCustomFieldValues(existingCustom) {
  var out = Object.assign({}, existingCustom || {});
  CUSTOM_FIELDS.forEach(function(f){
    var el = document.getElementById('cf-' + f.id);
    if (el) out[f.id] = el.value || '';
  });
  return out;
}


// Flatten để dùng trong filter/badge — chỉ lấy các value thực (lá hoặc không có con)
function _flatCustStatusValues() {
  var out = [];
  CUSTOMER_STATUS_TREE.forEach(function(node) {
    if (node.children) {
      node.children.forEach(function(child) { out.push(child.value); });
    } else {
      out.push(node.value);
    }
  });
  return out;
}

// Build <option> HTML cho select Trạng thái KH
function _buildCustStatusOptions(selected) {
  // Dang optgroup: nhom me lam tieu de, option con hien "Me - Con" (de khi chon xong o select hien du me-con)
  var html = '<option value="">— Chọn —</option>';
  CUSTOMER_STATUS_TREE.forEach(function(node) {
    if (node.children) {
      html += '<optgroup label="' + esc(node.label) + '">';
      node.children.forEach(function(child) {
        if (!child.value) return;
        html += '<option value="' + esc(child.value) + '"' + (selected === child.value ? ' selected' : '') + '>' + esc(node.label + ' - ' + (child.label || child.value)) + '</option>';
      });
      html += '</optgroup>';
    } else if (node.value) {
      html += '<option value="' + esc(node.value) + '"' + (selected === node.value ? ' selected' : '') + '>' + esc(node.label || node.value) + '</option>';
    }
  });
  return html;
}

// Build <option> cho select Tinh trang CS — CUNG dang optgroup + "Me - Con" nhu Trang thai KH
function _buildCareStatusOptions(selected) {
  var html = '<option value="">— Chọn —</option>';
  CARE_STATUS_TREE.forEach(function(node) {
    if (node.children) {
      html += '<optgroup label="' + esc(node.label) + '">';
      node.children.forEach(function(child) {
        if (!child.value) return;
        html += '<option value="' + esc(child.value) + '"' + (selected === child.value ? ' selected' : '') + '>' + esc(node.label + ' - ' + (child.label || child.value)) + '</option>';
      });
      html += '</optgroup>';
    } else if (node.value) {
      html += '<option value="' + esc(node.value) + '"' + (selected === node.value ? ' selected' : '') + '>' + esc(node.label || node.value) + '</option>';
    }
  });
  return html;
}

// Tra nhan day du "Me - Con" cho 1 value la (Tinh trang CS); la o goc (khong me) -> tra label
function careStatusFullLabel(val) {
  if (!val) return '';
  for (var i = 0; i < CARE_STATUS_TREE.length; i++) {
    var node = CARE_STATUS_TREE[i];
    if (node.children) {
      for (var j = 0; j < node.children.length; j++) {
        if (node.children[j].value === val) return node.label + ' - ' + (node.children[j].label || val);
      }
    } else if ((node.value || node.label) === val) {
      return node.label || val;
    }
  }
  return val;
}

// Tra nhan day du "Me - Con" cho 1 value la (Trang thai KH)
function custStatusFullLabel(val) {
  if (!val) return '';
  for (var i = 0; i < CUSTOMER_STATUS_TREE.length; i++) {
    var node = CUSTOMER_STATUS_TREE[i];
    if (node.children) {
      for (var j = 0; j < node.children.length; j++) {
        if (node.children[j].value === val) return node.label + ' - ' + (node.children[j].label || val);
      }
    } else if ((node.value || node.label) === val) {
      return node.label || val;
    }
  }
  return val;
}
// Danh sách lựa chọn "Kết bạn Zalo" admin sửa được ngay ở ô trường. Luôn giữ 'Đã kết bạn' vì hệ thống dựa vào giá trị này
// (tỷ lệ phản hồi Zalo / KH đã kết bạn, lọc...). Sửa tại chỗ (mutate) để mọi nơi dùng ZALO_STATUS thấy ngay.
function _zaloApplyOpts_(arr) {
  var clean = (arr || []).map(function(x){ return String(x).trim(); }).filter(Boolean);
  clean = clean.filter(function(x, i){ return clean.indexOf(x) === i; });
  if (clean.indexOf('Đã kết bạn') === -1) clean.unshift('Đã kết bạn');
  ZALO_STATUS.length = 0; clean.forEach(function(x){ ZALO_STATUS.push(x); });
}
// <option> cho ô Kết bạn Zalo — giữ cả giá trị khách đang có dù đã bị xoá khỏi danh sách (không thì lưu sẽ làm mất giá trị)
function _zaloOptionsHtml_(cur) {
  var list = ZALO_STATUS.slice();
  if (cur && list.indexOf(cur) === -1) list.push(cur);
  return '<option value="">— Chọn —</option>' + list.map(function(x){ return '<option value="' + esc(x) + '"' + (cur === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
}
// Khoa quan tri (adminKey) de lay/dong bo ma nguon GAS — hoi 1 lan, nho trong may nay. Tai khoan test khong bao gio duoc hoi.
function _adminKeyGet(){
  if (document.body && document.body.classList.contains('demo-mode')) return '';
  var k = '';
  try { k = localStorage.getItem('ome_admin_key') || ''; } catch(e){}
  if (!k){
    k = (prompt('Nhập khoá quản trị (adminKey trong sheet Settings) để lấy/đồng bộ mã GAS:') || '').trim();
    if (k) { try { localStorage.setItem('ome_admin_key', k); } catch(e){} }
  }
  return k;
}

function syncToast(msg){ if (SHOW_SYNC_TOASTS && typeof toast === 'function') toast(msg); }

// ── Thời gian tác động (theo thời gian thực) ──
// Ghi mốc thời gian thực mỗi khi CS thao tác lên 1 khách (lưu local + sẽ đồng bộ GSheets).
function _touchCare(phone){
  if (!phone || typeof careData === 'undefined') return;
  if (!careData[phone]) careData[phone] = {};
  careData[phone].updated = new Date().toISOString();
  if (typeof allCustomers !== 'undefined') {
    const _c = allCustomers.find(x => x.phone === phone);
    if (_c) _c._lastActionDate = Date.now();
  }
}
function _fmtActTime(ts){
  if (!ts) return null;
  const t = (typeof ts === 'number') ? ts : new Date(ts).getTime();
  if (isNaN(t) || t <= 1) return null;
  const d = new Date(t), p = n => String(n).padStart(2,'0');
  return { t, abs: `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth()+1)}`, full: d.toLocaleString('vi-VN') };
}
// So sánh ngày theo CALENDAR (không phải 24h rolling)
function _startOfDay(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function _calendarDaysAgo(ts) {
  // Số ngày calendar giữa ts và hôm nay (0 = hôm nay, 1 = hôm qua, ...)
  const todayStart = _startOfDay(Date.now());
  const thatStart  = _startOfDay(ts);
  return Math.round((todayStart - thatStart) / 86400000);
}
function _isToday(ts) { return _calendarDaysAgo(ts) === 0; }

function _relTime(t){
  const diff = Date.now() - t;
  if (diff < 60000) return 'vừa xong';
  const m = Math.floor(diff/60000); if (m < 60) return m + ' phút trước';
  const h = Math.floor(diff/3600000); if (h < 24) return h + ' giờ trước';
  const dd = _calendarDaysAgo(t); if (dd < 30) return dd + ' ngày trước';
  return Math.floor(dd/30) + ' tháng trước';
}

function _csScope(){ const el = document.getElementById('cs-staff-filter'); return el ? (el.value || 'all') : 'all'; }
// Danh sách tên CS đang được chọn để lọc (multi) — đọc qua .selectedOptions thật của <select multiple>
// (KHÔNG dùng .value nối chuỗi bằng dấu phân cách: set .value = "A|B" trên 1 <select> thật sẽ bị
// trình duyệt reset về rỗng vì không khớp đúng 1 <option> nào — phải dùng option.selected từng cái).
// Mảng rỗng = "— Tất cả CS —" (không lọc).
function _csFilterList(){
  const sel = document.getElementById('cs-staff-filter');
  if (!sel) return [];
  return Array.from(sel.selectedOptions || []).map(o => o.value).filter(v => v && v !== 'all');
}
// Đặt lại toàn bộ lựa chọn multi cho đúng danh sách tên truyền vào (thay hết, không cộng dồn)
function _csSetFilterSelection(names){
  const sel = document.getElementById('cs-staff-filter');
  if (!sel) return;
  const set = new Set(names || []);
  Array.from(sel.options).forEach(o => { o.selected = set.has(o.value); });
}
// name có khớp với BẤT KỲ CS nào đang chọn không (case-insensitive) — [] = không lọc = luôn khớp
function _csFilterHas(name){
  const list = _csFilterList();
  if (!list.length) return true;
  const n = String(name||'').toLowerCase();
  return list.some(x => x.toLowerCase() === n);
}
// Khớp theo chế độ lọc CS đang chọn (phụ trách / chăm sóc / cả hai) — DÙNG CHUNG cho danh sách, thống kê, xuất CSV
function _csModeMatch(inSeller, inCare, inAssign){
  if (_csFilterMode === 'seller') return !!inSeller;          // chỉ CS phụ trách (người lên đơn)
  if (_csFilterMode === 'care')   return !!inCare;            // chỉ CS chăm sóc (người đang chăm)
  return !!(inSeller || inCare || inAssign);                  // 'both': phụ trách HOẶC chăm sóc HOẶC được chia
}
function _inCSScope(c){
  const list = _csFilterList();
  if (!list.length) return true;
  // Multi: khách khớp phạm vi nếu thuộc về BẤT KỲ CS nào trong danh sách đã chọn (OR)
  const allH = (typeof _assignAllIndex !== 'undefined') ? _assignAllIndex[c.phone] : null;
  return list.some(csF => {
    const inSeller = !!(c.csSet && c.csSet.has(csF));   // CS phụ trách = người lên đơn
    const inCare   = !!(c.careCSSet && c.careCSSet.has(csF));  // CS chăm sóc = người đang chăm (tách theo tên riêng lẻ)
    const inAssign = allH ? allH.has(csF) : false;      // KH được chia chiến dịch cho CS này
    return _csModeMatch(inSeller, inCare, inAssign);
  });
}
// Tập KH dùng để đếm cho sidebar/stats: theo vai trò + theo CS đang chọn ở dropdown
function scopedCustomers(){
  return (typeof allCustomers !== 'undefined' ? allCustomers : []).filter(c =>
    (typeof _inUserScope === 'function' ? _inUserScope(c) : true) && _inCSScope(c)
  );
}
// Bỏ dấu tiếng Việt để tìm theo tên gõ vào
function _foldVi(str){
  return String(str||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
}
// Gom toàn bộ nội dung "Sản phẩm order" (product + productDetail) của mọi đơn của 1 khách,
// dùng để tìm theo chuỗi con — vì 1 ô có thể chứa nhiều sản phẩm gộp chung, không chỉ 1 brand ngắn.
function _customerProductText(c){
  if (!c || !c.orders || !c.orders.length) return '';
  return _foldVi(c.orders.map(o=>(o.product||'')+' '+(o.productDetail||'')).join(' | '));
}

// ═══════════════════════════════════════════════════════
//  DATA PROCESSING
// ═══════════════════════════════════════════════════════
function mergeRows(rows) {
  for (const r of rows) {
    const ph = normPhone(r.phone);
    if (!ph) continue;
    if (!customerMap[ph]) {
      customerMap[ph] = {
        phone:ph, name:r.name||ph, orders:[],
        sources:new Set(), brands:new Set(), _keys:new Set(),
        _rawStatus:'', _rawZalo:'', _rawNote:''
      };
    }
    const c = customerMap[ph];
    if (r.name && r.name.length > c.name.length) c.name = r.name;
    if (r.source) c.sources.add(r.source);
    if (r.product) c.brands.add(r.product);
    if (r.status) c._rawStatus = r.status;
    if (r.zalo) c._rawZalo = r.zalo;
    if (r.note) c._rawNote = r.note;
    // Khoa dedup: dung ID don (cot ID cua DT TỔNG, on dinh qua cac lan dong bo) neu co. Khoa cu
    // (phone+nam+thang+so tien) XOA NHAM don thu 2 khi 1 khach co 2 don KHAC NHAU cung thang, cung
    // dung 1 so tien (hay gap voi san pham gia co dinh, vd 3.300.000) -> Dashboard thieu doanh thu
    // so voi cac Bao cao doc truc tiep tu Sheet. Khong co ID thi them ngay tao + san pham cho dac thu.
    const key = r.id ? `${ph}_id${r.id}` : `${ph}_${r.year}_${r.month}_${r.revenue}_${r.orderDate||''}_${r.product||''}`;
    if (!c._keys.has(key)) { c._keys.add(key); c.orders.push(r); }
  }
}

// ═══════════════════════════════════════════════════════
//  GS MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════
function openGsModal() {
  if (document.body.classList.contains('demo-mode')) return;
  document.getElementById('gs-url-input').value = gsUrl || '';
  document.getElementById('gs-modal').classList.add('open');
}
function closeGsModal() { document.getElementById('gs-modal').classList.remove('open'); }
function openSettingsModal() { document.getElementById('settings-modal').classList.add('open'); }
function closeSettingsModal() { document.getElementById('settings-modal').classList.remove('open'); }
function toggleSidebar(force){
  var sb = document.querySelector('.sidebar');
  var bd = document.getElementById('sidebar-backdrop');
  if (!sb) return;
  var open = (typeof force === 'boolean') ? force : !sb.classList.contains('mobile-open');
  sb.classList.toggle('mobile-open', open);
  if (bd) bd.classList.toggle('show', open);
}
function _srToggleSidebar(){
  _srSidebarHidden = !_srSidebarHidden;
  var app = document.querySelector('.app');
  if (app) app.classList.toggle('sr-sidebar-hidden', _srSidebarHidden);
  renderSalesReportTab();
}
function saveGsUrl() {
  const raw = document.getElementById('gs-url-input').value;
  const url = raw.replace(/[\s​ ﻿]+/g, '').trim();
  document.getElementById('gs-url-input').value = url;
  if (!url) { gsStatus('Vui lòng nhập URL Web App', 'err'); return; }
  if (!url.startsWith('https://script.google.com')) {
    gsStatus('URL không hợp lệ — URL bạn nhập: ' + url.substring(0,80), 'err'); return;
  }
  gsUrl = url;
  saveLS('ome_gs_url', gsUrl);
  updateGsPill(true);
  closeGsModal();
  toast('✓ Đã lưu URL Google Sheets');
  show('syncbtn'); // Hiện nút Sync ngay
  if (allCustomers.length) { show('pushbtn'); show('fullsyncbtn'); show('dupbtn'); }
}
async function testGsConnection() {
  const raw = document.getElementById('gs-url-input').value;
  const url = raw.replace(/[\s\u200b\u00a0\ufeff]+/g, '').trim();
  document.getElementById('gs-url-input').value = url;
  if (!url) { gsStatus('Nhập URL trước', 'err'); return; }
  if (!url.startsWith('https://script.google.com')) {
    gsStatus('❌ URL sai định dạng. Phải bắt đầu bằng https://script.google.com/macros/s/...', 'err'); return;
  }
  if (!url.includes('/exec')) {
    gsStatus('❌ URL thiếu /exec ở cuối. Hãy copy đúng "Web app URL" từ Apps Script.', 'err'); return;
  }
  gsStatus('⏳ Đang kiểm tra kết nối...', 'loading');
  try {
    const r = await fetch(url, { redirect: 'follow' });
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch(e) {
      gsStatus('❌ Apps Script trả về HTML thay vì JSON. Nguyên nhân phổ biến: (1) Who has access chưa chọn Anyone, (2) Chưa bấm Authorize khi deploy, (3) Cần deploy lại sau khi sửa code', 'err'); return;
    }
    if (d.rows !== undefined) {
      // Kiểm tra thêm AssignData bằng ?action=assign
      const sep = url.includes('?') ? '&' : '?';
      let assignOK = false;
      try {
        const ar = await fetch(url + sep + 'action=assign&noOrders=1', { redirect: 'follow' });
        const at = await ar.json();
        assignOK = at && typeof at.assignHistory !== 'undefined';
      } catch(e2) { assignOK = false; }

      if (assignOK) {
        _assignBackendOK = true;
        _assignWarnShown = false; // reset để không show lại
        const banner = document.getElementById('deploy-guide-banner');
        if (banner) banner.remove();
        gsStatus('✅ Kết nối OK (bản mới) — CareData: ' + d.rows.length + ' bản ghi, AssignData: ✓ đã hỗ trợ chiến dịch' + (d.orders ? ', OrderData: ' + d.orders.length + ' đơn' : ''), 'ok');
      } else {
        gsStatus('⚠️ Kết nối được NHƯNG Apps Script đang chạy bản cũ — chưa có sheet AssignData.\n\n→ Hãy copy code mới & Deploy lại (New deployment) để chiến dịch đồng bộ cho tất cả nhân viên.', 'err');
      }
    } else if (d.error) {
      gsStatus('❌ Apps Script báo lỗi: ' + d.error, 'err');
    } else {
      gsStatus('⚠ Kết nối được nhưng response không đúng cấu trúc. Kiểm tra lại code Apps Script.', 'err');
    }
  } catch(e) {
    const isCors = e.message.includes('fetch') || e.message.includes('Network') || e.message.includes('CORS') || e.message.includes('Failed');
    if (isCors) {
      gsStatus('❌ Failed to fetch — Apps Script chưa cho phép truy cập công khai.\n\nCách fix: Vào Apps Script → Deploy → Manage deployments → Edit (✏) → Who has access: Anyone → Save → Copy URL mới dán vào đây.', 'err');
    } else {
      gsStatus('❌ Lỗi: ' + e.message, 'err');
    }
  }
}
function gsStatus(msg, type) {
  const el = document.getElementById('gs-status');
  el.textContent = msg;
  el.className = 'gs-status ' + (type||'');
}
function updateGsPill(connected) {
  const pill = document.getElementById('gs-pill');
  const dot  = document.getElementById('gs-dot');
  const tx   = document.getElementById('gs-pill-txt');
  if (connected) {
    pill.className = 'gs-pill'; dot.className = 'gs-dot'; tx.textContent = 'GSheets ✓';
  } else {
    pill.className = 'gs-pill disconnected'; dot.className = 'gs-dot off'; tx.textContent = 'Google Sheets';
  }
}

// ═══════════════════════════════════════════════════════
//  GS SYNC
// ═══════════════════════════════════════════════════════
// ── BO NHO DEM CUA VONG DONG BO NEN (moi 3s) ────────────────────────────────────────────────────
// NGUYEN NHAN LAG (da sua): moi nhip 3s truoc day LUON parse lai toan bo CareData, duyet het, roi goi
// saveLS('ome_care'/'ome_sched'/'ome_schedules'). saveLS bi boc o cuoi file de goi _invalidateFilterCache()
// => MOI 3 GIAY cache bo loc bi xoa va applyFilters loc + sap xep lai ~136k KH, cong them
// rebuildCareOnCustomers + ~16 lan filter trong updateStats/updateSidebarBadges. Nay: neu text tra ve giong het
// nhip truoc (khong ai sua gi) thi KHONG parse/ghi/ve lai. Don hang / dữ liệu đơn / CSKH-Duyên cung chi xu ly lai khi
// noi dung doi; CSKH-Duyên (hang chuc MB) chi keo lai moi 10 phut hoac khi bam Sync thu cong.
function _isEmptyObj(o){ for (const k in o) return false; return true; }   // O(1) — Object.keys(customerMap) liet ke ~136k khoa moi 3s chi de kiem tra rong
function _persistCareSoon() {   // delta: khong stringify toan bo careData moi nhip; gom ghi sau 20s
  if (_careLSTimer) return;
  _careLSTimer = setTimeout(function(){ _careLSTimer = null; saveLS('ome_care', careData); }, 20000);
}
async function _pullAssignAndBroadcastThrottled(force) {
  // pullAssignHistory keo TOAN BO AssignData (kem mang SDT cua moi dot chia, co the hang MB) — khong keo moi 3s
  if (!force && (Date.now() - _assignPulledAt) < 15000) return;
  _assignPulledAt = Date.now();
  await pullAssignHistory();
  if (typeof pullBroadcastHistory === 'function') pullBroadcastHistory().catch(() => {});
}
function _idbOpen_() {
  if (_idbConn_) return _idbConn_;
  _idbConn_ = new Promise(function (res, rej) {
    try {
      const rq = indexedDB.open('ome_cache', 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { _idbConn_ = null; rej(rq.error); };
    } catch (e) { _idbConn_ = null; rej(e); }
  });
  return _idbConn_;
}
async function _idbGet_(k) {
  const db = await _idbOpen_();
  return new Promise(function (res, rej) {
    const rq = db.transaction('kv', 'readonly').objectStore('kv').get(k);
    rq.onsuccess = function () { res(rq.result); };
    rq.onerror = function () { rej(rq.error); };
  });
}
async function _idbSet_(k, v) {
  const db = await _idbOpen_();
  return new Promise(function (res, rej) {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(v, k);
    tx.oncomplete = function () { res(true); };
    tx.onerror = function () { rej(tx.error); };
  });
}
// rows = [[phone,name,tier?], ...] (đúng định dạng action=cskhDuyenLite) -> { phone: [{name,tier}] }
function _cskhMapFromRows_(rows) {
  const m = {};
  (rows || []).forEach(function (r) { // r = [phone, name, tier]
    const ph = (typeof normPhone === 'function' ? normPhone(r[0]) : null) || String(r[0] || '');
    if (!ph) return;
    (m[ph] = m[ph] || []).push({ name: r[1] || '', tier: r[2] || '' }); // MANG cac dong nhe {name,tier}: buildCustomers va _renderCskhBlock_ doc cskhData[ph] nhu MANG dong
  });
  return m;
}
async function _loadCskhFromIdb_() {
  _cskhIdbTried = true;
  try {
    const rec = await _idbGet_('cskh_lite_v1');
    if (!rec || !rec.rows || !rec.rows.length) return false;
    if (!_isEmptyObj(cskhData)) return false;   // trong lúc chờ đã có dữ liệu mới từ mạng
    cskhData = _cskhMapFromRows_(rec.rows);
    cskhMeta = rec.meta || cskhMeta;
    _cskhFromCache = true;
    console.info('CSKH-Duyên: nạp ' + rec.rows.length + ' dòng từ cache máy (IndexedDB)');
    return true;
  } catch (e) { return false; }
}
function _cskhFail_(reason){
  _cskhFailCount++;
  console.warn('cskhDuyenLite:', reason);
  if (_cskhFailCount >= 2) {
    _cskhBannerOn = true;
    const _n = Object.keys(customerMap).length.toLocaleString('vi-VN');
    showSyncErrorBanner(_cskhFromCache
      ? 'Chưa làm mới được nguồn CSKH-Duyên (' + reason + ') — CRM đang dùng dữ liệu đã lưu ở máy từ lần trước (' + _n + ' khách, có thể cũ vài phút). Đang tự thử lại; có thể bấm "Sync thủ công".'
      : 'Không tải được nguồn CSKH-Duyên (' + reason + ') — CRM đang chỉ hiện ' + _n + ' khách. Đang tự thử lại; có thể bấm "Sync thủ công".');
  }
  return false;
}

async function _pullCskhLiteOnce_(isManual){
  // Lần đầu trong phiên mà chưa có dữ liệu: nạp NGAY từ cache máy (nếu có) để có đủ khách; kéo mới từ GAS ở các nhịp sau
  if (!_cskhIdbTried && _isEmptyObj(cskhData)) { if (await _loadCskhFromIdb_()) return true; }
  const now = Date.now();
  if (!isManual) {
    if (_cskhPulledAt && (now - _cskhPulledAt) <= 600000) return false;   // đã có và còn mới (kéo lại mỗi 10 phút)
    if (now - _cskhLastTry < 20000) return false;                         // vừa thử xong: giãn cách, không dội backend mỗi 3s
  }
  _cskhLastTry = now;
  try {
    const sepChar = gsUrl.includes('?') ? '&' : '?';
    const ckR = await fetch(gsUrl + sepChar + 'action=cskhDuyenLite', { redirect: 'follow' });
    const ckText = await ckR.text();
    if (ckText === _lastCkText && !_isEmptyObj(cskhData)) { _cskhPulledAt = Date.now(); _cskhFailCount = 0; return false; }
    let ckJson;
    try { ckJson = JSON.parse(ckText); } catch (e) { return _cskhFail_('GAS trả về không phải JSON — có thể quá tải/hết thời gian'); }
    if (!ckJson || !ckJson.ok) return _cskhFail_((ckJson && ckJson.error) || 'GAS báo lỗi');
    const newCk = _cskhMapFromRows_(ckJson.rows);
    // Backend trả 0 dòng trong khi trước đó đã có dữ liệu -> coi là lỗi tạm, KHÔNG xóa danh sách đang có
    if (_isEmptyObj(newCk) && !_isEmptyObj(cskhData)) return _cskhFail_('nguồn trả về 0 dòng');
    _lastCkText = ckText; _cskhPulledAt = Date.now(); _cskhFailCount = 0; _cskhFromCache = false;
    cskhData = newCk;
    cskhMeta = { found: !!ckJson.found, total: ckJson.total || 0, noPhone: ckJson.noPhone || 0, noPhoneSample: ckJson.noPhoneSample || [] };
    // lưu bản mới nhất vào IndexedDB (nền, không chặn) để lần mở trang sau / lúc GAS lỗi vẫn có đủ khách
    _idbSet_('cskh_lite_v1', { rows: ckJson.rows || [], meta: cskhMeta, at: Date.now() }).catch(function (e) { console.warn('IndexedDB lưu CSKH lỗi:', e && e.message); });
    // Kho ~134k SDT vuot han muc localStorage (~5MB) va stringify mat hang tram ms: chi luu cache neu nho; con lai se keo lai khi mo trang
    if (Object.keys(newCk).length <= 20000) saveLS('ome_cskh_duyen', cskhData); else { try { localStorage.removeItem('ome_cskh_duyen'); } catch(e){} }
    saveLS('ome_cskh_duyen_meta', cskhMeta);
    if (_cskhBannerOn) { _cskhBannerOn = false; const b = document.getElementById('sync-err-banner'); if (b) b.remove(); }
    return true;
  } catch (ckErr) { return _cskhFail_(ckErr.message || 'lỗi mạng'); }
}
async function syncFromGS(opts) {
  opts = opts || {};
  const pullOrders = opts.pullOrders !== undefined ? opts.pullOrders : _isEmptyObj(customerMap);
  const isManual = !!opts.manual;
  if (!gsUrl) { if (isManual) toast('Chưa kết nối Google Sheets'); return; }
  if (isManual) { txt('ltext', 'Đang tải từ Google Sheets...'); show('loverlay'); }
  try {
    // ── Gọi riêng CareData (nhanh) và Orders (chậm hơn) ──
    // Luôn gọi action=customers trước để đảm bảo có rows dù orders lỗi
    const sepChar = gsUrl.includes('?') ? '&' : '?';
    const _wantCareFull = !_careSince || isManual || (Date.now() - _careFullAt) > CARE_FULL_EVERY_MS;
    const careUrl = gsUrl + sepChar + 'action=customers' + (_wantCareFull ? '' : '&since=' + encodeURIComponent(_careSince));
    const careR = await fetch(careUrl, { redirect: 'follow' });
    const careText = await careR.text();
    let _careSame = false, _isDelta = false;   // _careSame: khong ai sua CareData tu nhip truoc
    let d;
    _careMaxUpd = '';
    try {
      if (_wantCareFull) { _careSame = (careText === _lastCareText); d = _careSame ? {} : JSON.parse(careText); }
      else {
        d = JSON.parse(careText);
        if (d && d.delta) { _isDelta = true; _careSame = !(d.rows && d.rows.length); }
        else { _careSame = (careText === _lastCareText); if (_careSame) d = {}; }   // server cu tra FULL
      }
    } catch(e) {
      if (isManual) { hide('loverlay'); toast('GAS trả về không phải JSON — kiểm tra quyền triển khai: Anyone'); }
      else { console.warn('Auto-sync: GAS non-JSON'); _autoSyncFailCount = (_autoSyncFailCount||0)+1; if (_autoSyncFailCount>=3) showSyncErrorBanner(); }
      return;
    }
    if (d && d.error) {
      const errMsg = 'GAS lỗi: ' + d.error;
      if (isManual) { hide('loverlay'); toast('❌ ' + errMsg); }
      else { console.warn('Auto-sync GAS error:', d.error); _autoSyncFailCount = (_autoSyncFailCount||0)+1; if (_autoSyncFailCount>=3) showSyncErrorBanner(); }
      return;
    }
    d = d || {};
    if (!_isDelta) _careFullAt = Date.now();

    // ── Tải đơn hàng riêng nếu cần ──
    let orderCount = 0;
    // Ep buildCustomers() day du (thay vi chi rebuildCareOnCustomers() nhe) khi phat hien 1 SDT
    // MOI xuat hien o nguon "Cham soc" ma app chua tung biet toi — xem giai thich chi tiet ben
    // duoi cho tung truong hop.
    let _forceFullBuildFromCareLeads = false;
    if (pullOrders) {
      try {
        if (isManual) txt('ltext', 'Đang tải đơn hàng từ Google Sheets...');
        const ordR = await fetch(gsUrl + sepChar + 'action=orders', { redirect: 'follow' });
        const ordText = await ordR.text();
        // Chi coi la "khong doi" khi da co khach trong customerMap (sau khi bam xoa du lieu phai nap lai that su)
        const _ordSame = (ordText === _lastOrdersText) && !_isEmptyObj(customerMap);
        let ordJson, _ordFromCache = false;
        if (_ordSame) ordJson = { _same: true };
        else {
          try { ordJson = JSON.parse(ordText); }
          catch (pe) {
            // GAS trả HTML lỗi (404/quá tải) → nếu phiên này CHƯA kéo được đơn nào từ mạng thì dùng bản đã lưu ở máy,
            // để CRM không tụt về vài chục khách (xem chú thích "CACHE BỀN" ở trên)
            const rec = (!_ordersLoadedNet && !_ordersCacheUsed) ? await _idbGet_('orders_v1').catch(function () { return null; }) : null;
            if (rec && rec.json && rec.json.orders && rec.json.orders.length) { ordJson = rec.json; _ordFromCache = true; }
            else throw pe;
          }
        }
        if (ordJson && ordJson.errorCount) {
          // Backend doc duoc mot phan don (da bo qua cac dong loi de khong crash toan bo) —
          // PHAI canh bao ro, khong duoc coi so don/KH doc duoc la day du roi am tham rebuild
          // danh sach (bug da gap 20/09: 8 KH thay vi 2k2 vi ~2k dong bi loi va bi nuot am tham).
          console.warn('readAllOrders_ error rows:', ordJson.errorCount, ordJson.errorSample);
          showRowErrorBanner(ordJson.errorCount, ordJson.errorSample);
        }
        if (ordJson && ordJson.orders && ordJson.orders.length) {
          const rows = ordJson.orders.map(o => ({
            date: o.date ? parseVNDate_(o.date) : null,
            year: parseNum(o.year), month: parseNum(o.month),
            cs: o.cs||'', name: o.name||'', phone: o.phone||'',
            source: o.source||'', revenue: _normRev(o.revenue),
            product: o.product||'', productDetail: o.productDetail||'',
            status: o.status||'', zalo: o.zalo||'', note: o.note||''
          }));
          if (rows.length) {
            // Không thêm chip "Google Sheets (đồng bộ)" vào files-bar nữa — sync chạy nền
            // (mỗi 3s / mỗi lần mở app) nên trước đây chip này bị lặp lại nhiều lần trên thanh file.
            mergeRows(rows);
            orderCount = rows.length;
            if (_ordFromCache) {
              _ordersCacheUsed = true;
              console.warn('Orders: GAS lỗi — dùng ' + rows.length + ' đơn đã lưu ở máy (IndexedDB)');
              _autoSyncFailCount = (_autoSyncFailCount || 0) + 1;
              if (_autoSyncFailCount >= 3) showSyncErrorBanner('Chưa làm mới được đơn hàng từ Google Sheets — CRM đang dùng dữ liệu đã lưu ở máy từ lần trước. Đang tự thử lại; có thể bấm "Sync thủ công".');
            } else {
              _lastOrdersText = ordText; _ordersLoadedNet = true; _ordersCacheUsed = false;
              _idbSet_('orders_v1', { json: ordJson, at: Date.now() }).catch(function (e) { console.warn('IndexedDB lưu đơn lỗi:', e && e.message); });
            }
          }
        } else if (ordJson && ordJson.error) {
          console.warn('Orders sync error from GAS:', ordJson.error);
          if (isManual) {
            toast('⚠ Lỗi tải đơn hàng: ' + ordJson.error);
          } else {
            // TRUOC DAY: auto-sync loi rieng phan don hang chi console.warn, KHONG hien gi ca
            // cho nguoi dung thay — neu loi nay lap lai (vd sheet "DT TỔNG " bi doi ten/xoa,
            // xem readAllOrders_ trong gas_v13.js) thi danh sach KH se mai mai chi con vai KH
            // tu luu tay (careLeads) ma KHONG CO CANH BAO NAO, giong dung trieu chung "CRM bi
            // crash chi hien vai KH moi tu luu, khong dong bo tu Sheet ve" da gap. Dung chung
            // 1 bo dem loi voi nhanh CareData ben tren de sau 3 lan loi lien tiep thi bao ro.
            _autoSyncFailCount = (_autoSyncFailCount || 0) + 1;
            if (_autoSyncFailCount >= 3) showSyncErrorBanner('Lỗi tải đơn hàng: ' + ordJson.error);
          }
        }
      } catch(orderErr) {
        console.warn('Orders fetch error:', orderErr.message);
        if (isManual) {
          toast('⚠ Không tải được đơn hàng: ' + orderErr.message);
        } else {
          _autoSyncFailCount = (_autoSyncFailCount || 0) + 1;
          if (_autoSyncFailCount >= 3) showSyncErrorBanner('Không tải được đơn hàng: ' + orderErr.message);
        }
      }
      // ── Tập SĐT có trong "dữ liệu đơn" (chỉ để lọc nguồn, không kéo chi tiết) ──
      try {
        const dpR = await fetch(gsUrl + sepChar + 'action=donPhones', { redirect: 'follow' });
        const dpText = await dpR.text();
        // NGUYÊN NHÂN GỐC lag định kỳ: trước đây khối này JSON.parse + dựng lại Set + saveLS (JSON.stringify ghi
        // localStorage, đồng bộ trên luồng chính) 5 map lớn theo SĐT MỖI lần kéo, kể cả khi server trả y hệt lần trước.
        // Nay chỉ xử lý khi nội dung thật sự đổi (giống cách _lastCareText/_lastOrdersText đã làm).
        if (dpText !== _lastDonText) {
          const dpJson = JSON.parse(dpText);   // lỗi parse -> nhảy xuống catch, _lastDonText chưa đổi nên nhịp sau thử lại
          _lastDonText = dpText; _forceFullBuildFromCareLeads = true;   // dữ liệu đơn doi -> phai build lai (nguon/hang KH)
          if (dpJson && dpJson.phones) { donPhoneSet = new Set(dpJson.phones); saveLS('ome_don_phones', dpJson.phones); }
          if (dpJson && dpJson.saleByPhone) { donSaleByPhone = dpJson.saleByPhone; saveLS('ome_don_sale_by_phone', dpJson.saleByPhone); }
          if (dpJson && dpJson.lastDateByPhone) { donLastDateByPhone = dpJson.lastDateByPhone; saveLS('ome_don_last_date', dpJson.lastDateByPhone); }
          if (dpJson && dpJson.statsByPhone) { donStatsByPhone = dpJson.statsByPhone; _posStatsOn = Object.keys(donStatsByPhone).length > 0; saveLS('ome_don_stats', dpJson.statsByPhone); }
          if (dpJson && dpJson.orderCountByPhone) { donOrderCountByPhone = dpJson.orderCountByPhone; saveLS('ome_don_order_count', dpJson.orderCountByPhone); }
        }
      } catch(dpErr) { console.warn('donPhones fetch error:', dpErr.message); }
      // ── Nguồn "CSKH-Duyên" (sheet thứ 3, có thể tới hàng trăm nghìn dòng) — CHỈ kéo bản "nhẹ"
      // [phone,name,tier] mỗi dòng (action=cskhDuyenLite), KHÔNG kéo đủ 17 trường (địa chỉ/công
      // ty/nợ/email/ghi chú...) mỗi vòng poll nữa — kéo full từng dòng làm CRM lag nặng khi data
      // lên tới ~134k dòng (payload nhiều chục MB + localStorage + duyệt lại mỗi 30s). Chi tiết
      // đầy đủ 1 khách chỉ kéo riêng, LƯỜI (lazy) khi CS thực sự mở hồ sơ khách đó — xem
      // _loadCskhDetailForPhone_ ở renderInfoTab.
      // CSKH-Duyên gần như khong doi: chi keo lai o lan dau, moi 10 phut, hoac khi bam Sync thu cong
      if (await _pullCskhLiteOnce_(isManual)) _forceFullBuildFromCareLeads = true;
    } else if (!_cskhPulledAt) {
      // Lần kéo CSKH-Duyên trước lỗi/chưa xong -> tự thử lại (có giãn cách), KHÔNG chờ tới nhịp kéo đơn tiếp theo
      if (await _pullCskhLiteOnce_(isManual)) _forceFullBuildFromCareLeads = true;
    }

    // ── Nguồn "Chăm sóc" (sheet riêng, KH thêm nhanh qua Pancake AI/Zalo AI/nút "+Thêm KH
    // mới") — CHẠY MỖI TICK (3s), KHÔNG còn phụ thuộc nhịp kéo đơn hàng nặng (~30s, xem
    // pullOrders ở trên). Sheet này nhỏ (chỉ các KH được thêm tay), nên kéo thường xuyên không
    // tốn kém, và khách mới cần hiện NGAY để CS lọc theo "nguồn dữ liệu: Chăm sóc" thấy đúng.
    //
    // BUG (đã sửa): trước đây khối này nằm TRONG if(pullOrders) — nghĩa là ở đa số các tick 3s
    // (khi pullOrders=false), careLeads không được kéo lại; đồng thời nhánh rebuildCareOnCustomers()
    // (chạy khi orderCount=0, tức đa số các tick) CHỈ cập nhật field cho khách ĐÃ CÓ SẴN trong
    // allCustomers, KHÔNG BAO GIỜ tự thêm khách mới — nên CS thêm khách mới nguồn "Chăm sóc" phải
    // đợi tới đúng tick kéo đầy đủ tiếp theo (~30s) mới hiện, và nếu tick đó lỗi/trả về 0 đơn thì
    // không hiện luôn cho tới khi F5. Giờ kéo độc lập mỗi 3s + phát hiện SĐT mới để ép
    // buildCustomers() đầy đủ ngay khi cần, không phụ thuộc orderCount.
    try {
      const clR = await fetch(gsUrl + sepChar + 'action=careLeads', { redirect: 'follow' });
      const clText = await clR.text();
      // NGUYÊN NHÂN GỐC lag nền mỗi tick: trước đây mỗi tick đều parse + dựng lại careLeads + saveLS (ghi localStorage đồng bộ)
      // + quét _assignCustMap() dù sheet "KH Chăm sóc mới" không đổi. Nay so chuỗi trả về, y hệt lần trước thì bỏ qua.
      if (clText !== _lastCareLeadsText) {
        const clJson = JSON.parse(clText);   // lỗi parse -> catch bên dưới (như clR.json() trước đây)
        if (clJson && clJson.rows) {
          const newLeads = {};
          clJson.rows.forEach(function(r){ if (r.phone) newLeads[r.phone] = { name: r.name||'', note: r.note||'', cs: r.cs||'', createdAt: r.createdAt||'' }; });
          const knownPhones = _assignCustMap();   // Map cache, khong dung lai Set 136k phan tu moi tick
          for (const ph in newLeads) {
            if (!knownPhones.has(ph)) { _forceFullBuildFromCareLeads = true; break; }
          }
          careLeads = newLeads;
          saveLS('ome_care_leads', careLeads);
        }
        _lastCareLeadsText = clText;   // chỉ đánh dấu "đã xử lý" SAU khi xử lý xong, lỗi giữa chừng thì nhịp sau tự thử lại
      }
    } catch(clErr) { console.warn('careLeads fetch error:', clErr.message); }

    // Khong co gi moi o CareData / don hang / nguon khac -> bo qua toan bo phan parse + ghi localStorage + ve lai ben duoi
    if (_careSame && !pullOrders && !isManual && !_forceFullBuildFromCareLeads) {
      await _pullAssignAndBroadcastThrottled(false);
      return;
    }
    let count = 0;
    let _dpPhoneChanged = false; // true nếu KH đang mở trong panel chi tiết vừa có dữ liệu mới (vd: từ Zalo AI extension)
    // Lich hen: gom 1 lan roi loc/them 1 lan (truoc day schedules.filter(...) cho TUNG dong CareData => O(dong x lich))
    const _schedDrop = new Set(), _schedNew = new Map();
    for (const row of (d.rows || [])) {
      if (row.updated && String(row.updated) > _careMaxUpd) _careMaxUpd = String(row.updated);
      if (!row.phone) continue;
      // Normalize phone từ GS (tránh mất số 0 đầu do Excel/GSheets lưu kiểu số)
      const _normPh = (typeof normPhone === 'function') ? (normPhone(row.phone) || String(row.phone)) : String(row.phone);
      // Không ghi đè khách đang chỉnh sửa/đang ghi lên GS chưa xong (tránh mất dữ liệu & nhấp nháy về dữ liệu cũ)
      var _ph2 = String(row.phone);
      if ((typeof _careQueue !== 'undefined' && (_careQueue.has(_normPh) || _careQueue.has(_ph2))) ||
          (typeof _careWriting !== 'undefined' && (_careWriting.has(_normPh) || _careWriting.has(_ph2)))) { count++; continue; }
      const _oldUpdated = (careData[_normPh] || {}).updated || '';
      careData[_normPh] = {
        status: row.status||'', zalo: row.zalo||'', cs: row.cs||'', note: row.note||'',
        schedGoi: row.schedGoi||'', schedGoiNote: row.schedGoiNote||'',
        schedSP: row.schedSP||'', schedSPNote: row.schedSPNote||'',
        schedCS: row.schedCS||'', schedCSNote: row.schedCSNote||'',
        schedHen: row.schedHen||'', schedHenNote: row.schedHenNote||'',
        updated: row.updated||'',
        khStatus: row.khStatus||'', nickZalos: row.nickZalos||[], zaloPhones: row.zaloPhones||[], birthday: row.birthday||'', tag: row.tag||'',
        custom: (row.custom && typeof row.custom === 'object') ? row.custom : {}
      };
      // KH này đang được xem trong panel chi tiết (openDp) và vừa có bản ghi mới hơn (vd: CS vừa lưu từ Zalo AI extension)
      if (typeof currentPhone !== 'undefined' && currentPhone &&
          (_normPh === currentPhone || _ph2 === currentPhone) &&
          row.updated && _oldUpdated && row.updated !== _oldUpdated) {
        _dpPhoneChanged = true;
      }
      if (row.schedules !== undefined) {
        try {
          const sc = row.schedules ? JSON.parse(row.schedules) : [];
          // Thay vì chỉ cộng dồn (khiến lịch đã xoá trên Sheet không bao giờ mất khỏi app),
          // xoá hết lịch cũ của khách này rồi nạp đúng danh sách hiện có từ Sheet (dong cuoi cung cua cung SDT thang).
          _schedDrop.add(_normPh); _schedDrop.add(_ph2);
          _schedNew.set(_normPh, sc);
        } catch(e){}
      }
      count++;
    }
    if (_schedDrop.size) {
      schedules = schedules.filter(s => !_schedDrop.has(s.phone));
      _schedNew.forEach(sc => { for (const it of sc) schedules.push(it); });
    }
    if (_isDelta) { if (!_careSame) { _invalidateFilterCache(); _persistCareSoon(); } }
    else if (!_careSame) saveLS('ome_care', careData);
    if (_careMaxUpd && (!_isDelta || _careMaxUpd > _careSince)) _careSince = _careMaxUpd;
    if (_schedDrop.size) { saveLS('ome_sched', schedules); saveLS('ome_schedules', schedules); }
    // Pull cấu hình tình trạng CS (nếu admin đã đồng bộ lên GSheets)
    if (d.careStatus && Array.isArray(d.careStatus) && d.careStatus.length) {
      _applyCareStatusFromGS(d.careStatus);
    }
    if (orderCount > 0 || _forceFullBuildFromCareLeads) {
      buildCustomers();
      show('syncbtn');
      show('pushbtn'); show('fullsyncbtn'); show('dupbtn');
    } else {
      rebuildCareOnCustomers();
    }

    // Pull chiến dịch (sheet AssignData) — robust, tách riêng để luôn chạy dù order lớn
    await _pullAssignAndBroadcastThrottled(isManual || pullOrders);

    applyFilters();
    updateStats();
    updateSidebarBadges();
    updateSchedBadges();
    if (!_isDelta) _lastCareText = careText;   // da xu ly xong ban FULL nay — nhip sau neu giong het thi bo qua (xem dau ham)
    if (_dpPhoneChanged) _maybeRefreshOpenDp();
    if (isManual) {
      hide('loverlay');
      if (orderCount > 0) {
        syncToast(`✓ Xong — đã tải ${orderCount} đơn hàng + ${count} bản ghi CS`);
      } else {
        syncToast(`✓ Xong — đã đồng bộ ${count} bản ghi CS`);
      }
    }
  } catch(e) {
    if (isManual) { hide('loverlay'); toast('❌ Lỗi sync: ' + e.message + ' — Kiểm tra quyền deploy Apps Script'); }
    else {
      console.warn('Auto-sync error:', e.message);
      _autoSyncFailCount = (_autoSyncFailCount || 0) + 1;
      if (_autoSyncFailCount >= 3) { showSyncErrorBanner(); }
    }
  }
}

// ════════════════════════════════════════════════════════════════════
//  PHÂN LOẠI SALE THEO MỐC NGÀY (Duyên yêu cầu 2026-11-02)
//  Ví dụ Sale A: 10/09 → thử việc, 11/10 → chính thức (Online). Trước đây mỗi Sale chỉ có
//  1 phân loại HIỆN TẠI (SALE_CHANNELS) nên đổi từ Thử việc sang Chính thức là MỌI đơn cũ
//  cũng bị tính theo loại mới (báo cáo thưởng tháng cũ sai).
//  Dữ liệu: SALE_CHANNEL_PERIODS = { "<tên sale>": [ {from:"yyyy-MM-dd", channel:"probation"|"online"|...|""} ] }
//  Mỗi mốc có hiệu lực từ ngày `from` cho tới ngày liền trước mốc kế tiếp (mốc cuối: không hết hạn).
//  Ngày TRƯỚC mốc đầu tiên, hoặc Sale chưa có mốc nào → dùng phân loại hiện tại SALE_CHANNELS (giữ nguyên hành vi cũ).
//  Lưu: localStorage `ome_sale_channel_periods` + sheet Settings key `saleChannelPeriods`
//  (getSetting/setSetting CÓ SẴN — KHÔNG sửa gas_v13.js, KHÔNG cần deploy GAS).
// ════════════════════════════════════════════════════════════════════
let SALE_CHANNEL_PERIODS = (function(){
  try { var v = loadLS('ome_sale_channel_periods'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch(e){ return {}; }
})();

// Chuẩn hoá danh sách mốc: bỏ mốc sai định dạng ngày, sắp theo ngày, trùng ngày thì lấy mốc SAU CÙNG.
function _scpNorm_(arr){
  var byFrom = {};
  (Array.isArray(arr) ? arr : []).forEach(function(e){
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.from || ''))) return;
    byFrom[e.from] = { from: e.from, channel: String(e.channel == null ? '' : e.channel) };
  });
  return Object.keys(byFrom).sort().map(function(k){ return byFrom[k]; });
}
function _scpListOf_(name){
  var v = _cfgByAlias(SALE_CHANNEL_PERIODS, name);
  return _scpNorm_(v);
}
// Phân loại của 1 Sale TẠI ngày `ymd` (yyyy-MM-dd). Không truyền ngày → phân loại hiện tại.
function _saleChannelOn_(name, ymd){
  var cur = _saleChannelOf_(name);
  if (!ymd) return cur;
  var list = _scpListOf_(name);
  if (!list.length) return cur;
  var hit = null;
  for (var i = 0; i < list.length; i++){ if (list[i].from <= ymd) hit = list[i]; else break; }
  return hit ? hit.channel : cur;
}
// Ngày hết hiệu lực (yyyy-MM-dd, bao gồm) của mốc thứ i = ngày liền trước mốc kế tiếp; mốc cuối → ''.
function _scpEndOf_(list, i){
  if (!list || i >= list.length - 1) return '';
  var m = String(list[i+1].from).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  var d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]) - 86400000);
  return d.getUTCFullYear() + '-' + ('0'+(d.getUTCMonth()+1)).slice(-2) + '-' + ('0'+d.getUTCDate()).slice(-2);
}
// Ghi danh sách mốc của 1 Sale (xoá các khoá bí danh khác của cùng người để không có 2 danh sách mâu thuẫn).
function _scpSet_(name, arr){
  var clean = _scpNorm_(arr);
  ((typeof _cfgAliasesOf === 'function') ? _cfgAliasesOf(name) : [name]).forEach(function(n){ if (n !== name) delete SALE_CHANNEL_PERIODS[n]; });
  if (clean.length) SALE_CHANNEL_PERIODS[name] = clean; else delete SALE_CHANNEL_PERIODS[name];
}

async function _syncSaleChannelPeriodsFromGAS(){
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=saleChannelPeriods', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value){
      var obj = JSON.parse(data.value);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)){
        SALE_CHANNEL_PERIODS = obj;
        saveLS('ome_sale_channel_periods', SALE_CHANNEL_PERIODS);
        if (typeof _srState !== 'undefined' && (_srState.sub === 'E' || _srState.sub === 'G') && typeof renderSalesReportTab === 'function') renderSalesReportTab();
      }
    }
  } catch(e) { /* giữ bản local nếu lỗi mạng/parse */ }
}
async function saveSaleChannelPeriods(){
  saveLS('ome_sale_channel_periods', SALE_CHANNEL_PERIODS);
  if (!gsUrl){ toast('✓ Đã lưu local (chưa cấu hình Google Sheets)'); return; }
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
      body: JSON.stringify({ action:'setSetting', key:'saleChannelPeriods', value: JSON.stringify(SALE_CHANNEL_PERIODS) }) });
    var d = await r.json().catch(function(){ return {}; });
    if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
    else toast('✓ Đã lưu và đồng bộ mốc phân loại theo ngày lên Google Sheets');
  } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
}
setTimeout(_syncSaleChannelPeriodsFromGAS, 0);

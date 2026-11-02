// ════════════════════════════════════════════════════════════════════
//  PHÂN LOẠI SALE THEO MỐC NGÀY (Duyên yêu cầu 2026-11-02)
//  Ví dụ Sale A: 10/09 → thử việc, 11/10 → chính thức (Online). Trước đây mỗi Sale chỉ có
//  1 phân loại HIỆN TẠI (SALE_CHANNELS) nên đổi từ Thử việc sang Chính thức là MỌI đơn cũ
//  cũng bị tính theo loại mới (báo cáo thưởng tháng cũ sai).
//  Dữ liệu: SALE_CHANNEL_PERIODS = { "<tên sale>": [ {from:"yyyy-MM-dd", channel:"probation"|"online"|...|""} ] }
//  `from` có thể để TRỐNG = áp dụng từ trước đến nay (Sale vốn đã chính thức, không cần chọn ngày).
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
    if (!e || !/^(\d{4}-\d{2}-\d{2})?$/.test(String(e.from || ''))) return;   // from rỗng = "từ trước đến nay" (không cần chọn ngày)
    var bf = (String(e.channel || '') === 'probation' && /^\d{4}-\d{2}-\d{2}$/.test(String(e.bonusFrom || ''))) ? String(e.bonusFrom) : '';   // bonusFrom = ngày BẮT ĐẦU TÍNH THƯỞNG (sau học việc), khác ngày bắt đầu thử việc `from`; chỉ có ở mốc Thử việc
    var ne = { from: String(e.from || ''), channel: String(e.channel == null ? '' : e.channel) };
    if (bf) ne.bonusFrom = bf;
    byFrom[ne.from] = ne;
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
function _scpSet_(name, arr, names){
  var clean = _scpNorm_(arr);
  var targets = (names && names.length) ? names : [name];   // names = mọi tên cùng 1 người (modal gom theo người) → lưu dưới TẤT CẢ để báo cáo tra tên nào cũng ra
  ((typeof _cfgAliasesOf === 'function') ? _cfgAliasesOf(name) : [name]).forEach(function(n){ if (targets.indexOf(n) === -1) delete SALE_CHANNEL_PERIODS[n]; });
  targets.forEach(function(n){
    if (clean.length) SALE_CHANNEL_PERIODS[n] = clean.map(function(e){ var o = { from: e.from, channel: e.channel }; if (e.bonusFrom) o.bonusFrom = e.bonusFrom; return o; }); else delete SALE_CHANNEL_PERIODS[n];
  });
}
// Mọi tên cùng 1 người với `name` (cùng cách gom của modal: hoa/thường + bí danh tài khoản). Không gom được → chỉ [name].
function _scpGroupNames_(name){
  try {
    var gs = _groupNamesByPerson(_allCSNames()), k = String(name == null ? '' : name).toLowerCase();
    for (var i = 0; i < gs.length; i++) if (gs[i].names.some(function(x){ return String(x).toLowerCase() === k; })) return gs[i].names;
  } catch(e) {}
  return [name];
}
// Danh sách mốc của người (lấy từ tên đầu tiên trong nhóm có mốc).
function _scpGroupListOf_(name){
  var ns = _scpGroupNames_(name);
  for (var i = 0; i < ns.length; i++){ var l = _scpListOf_(ns[i]); if (l.length) return l; }
  return [];
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

// ── GIAO DIỆN: cột "🗓 Mốc theo ngày" trong modal "🏷️ Phân loại đội Sale" (js/12 `_renderSaleChannelsModal`) ──
let _scpOpenName = '', _scpDraft = null;
function _scpFmtDate_(ymd){ var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function _scpChanLabel_(ch){
  if (!ch) return 'Chưa phân loại';
  if (ch === 'probation') return 'Thử việc';
  var gs = (typeof SALE_GROUPS !== 'undefined' && SALE_GROUPS) || [];
  for (var i = 0; i < gs.length; i++) if (gs[i].key === ch) return 'Chính thức — ' + gs[i].label;
  return 'Chính thức — ' + ch;
}
// Giai đoạn của 1 mốc: '' (chưa phân loại) | 'tv' (Thử việc = channel 'probation') | 'ct' (Chính thức = channel là 1 đội Online/Văn phòng/…)
function _scpStageOf_(ch){ return !ch ? '' : (ch === 'probation' ? 'tv' : 'ct'); }
function _scpTeamGroups_(){ return ((typeof SALE_GROUPS !== 'undefined' && SALE_GROUPS) || []).filter(function(g){ return g.key !== 'probation'; }); }
function _scpSetStage(i, stage){
  var e = _scpDraft[i]; if (!e) return;
  if (stage === 'tv') e.channel = 'probation';
  else if (stage === 'ct'){ var tg = _scpTeamGroups_(); if (e.channel === 'probation' || !e.channel) e.channel = tg.length ? tg[0].key : 'online'; }
  else e.channel = '';
  if (e.channel !== 'probation') e.bonusFrom = '';
  _renderSaleChannelsModal();
}
function _scpCellHtml_(name){
  var list = _scpGroupListOf_(name);
  var sum = list.map(function(e, i){
    var end = _scpEndOf_(list, i);
    return '<div style="font-size:11px;color:var(--muted)">' + (e.from ? esc(_scpFmtDate_(e.from)) : 'Từ đầu') + (end ? ' → ' + esc(_scpFmtDate_(end)) : ' →') + ': <b>' + esc(_scpChanLabel_(e.channel)) + '</b></div>';
  }).join('');
  return '<button class="btn xs" data-name="' + esc(name) + '" onclick="_scpToggle(this.dataset.name)">🗓 ' + (list.length ? 'Sửa mốc (' + list.length + ')' : 'Thêm mốc') + '</button>' + sum;
}
function _scpToggle(name){
  if (_scpOpenName === name){ _scpOpenName = ''; _scpDraft = null; }
  else { _scpOpenName = name; _scpDraft = _scpGroupListOf_(name).map(function(e){ return { from: e.from, channel: e.channel, bonusFrom: e.bonusFrom || '' }; }); if (!_scpDraft.length) _scpDraft.push({ from: '', channel: '' }); }
  _renderSaleChannelsModal();
}
function _scpEditorRowHtml_(name, colspan){
  if (_scpOpenName !== name || !_scpDraft) return '';
  var gs = (typeof SALE_GROUPS !== 'undefined' && SALE_GROUPS) || [];
  var h = '<tr><td colspan="' + colspan + '" style="background:var(--surface2);padding:10px 14px">' +
    '<div style="font-size:12px;margin-bottom:8px"><b>Mốc phân loại theo ngày — ' + esc(name) + '</b><br><span style="color:var(--muted)">Mỗi mốc có hiệu lực <b>từ ngày chọn</b> đến hết ngày liền trước mốc kế tiếp. Ví dụ: <i>10/09 Thử việc</i> + <i>11/10 Online</i> → thử việc 10/09→10/10, chính thức từ 11/10. ' +
    '<b>Ngày là tuỳ chọn</b>: Sale vốn đã chính thức thì chỉ cần chọn Chính thức + đội và để trống ngày (hoặc không thêm mốc, chỉ cần cột "Đội hiện tại"). Ngày trước mốc đầu tiên có ngày dùng cột "Đội hiện tại". Chương trình thưởng (Báo cáo E, G) tự áp dụng theo loại của Sale <b>tại đúng ngày tạo đơn</b>.</span></div>';
  _scpDraft.forEach(function(e, i){
    var nxt = ''; _scpDraft.forEach(function(x){ if (/^\d{4}-\d{2}-\d{2}$/.test(x.from || '') && x.from > (e.from || '') && (!nxt || x.from < nxt)) nxt = x.from; });
    var end = nxt ? _scpEndOf_([{ from: e.from || '' }, { from: nxt }], 0) : '';
    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">' +
      '<span style="font-size:12px">Từ ngày</span><input type="date" value="' + esc(e.from || '') + '" onchange="_scpDraft[' + i + '].from=this.value;_renderSaleChannelsModal()" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">' +
      '<select onchange="_scpSetStage(' + i + ',this.value)" style="width:150px"><option value=""' + (!e.channel ? ' selected' : '') + '>— Chưa phân loại —</option>' +
      '<option value="tv"' + (e.channel === 'probation' ? ' selected' : '') + '>Thử việc</option><option value="ct"' + (e.channel && e.channel !== 'probation' ? ' selected' : '') + '>Chính thức</option></select>' +
      (e.channel && e.channel !== 'probation' ? '<select onchange="_scpDraft[' + i + '].channel=this.value;_renderSaleChannelsModal()" style="width:140px">' +
        _scpTeamGroups_().map(function(g){ return '<option value="' + esc(g.key) + '"' + (e.channel === g.key ? ' selected' : '') + '>' + esc(g.label) + '</option>'; }).join('') + '</select>' : '') +
      '<span style="font-size:11.5px;color:var(--muted)">' + (e.from ? (end ? 'đến hết ' + esc(_scpFmtDate_(end)) : 'không giới hạn (đến khi có mốc mới)') : (end ? 'không chọn ngày = từ trước đến hết ' + esc(_scpFmtDate_(end)) : 'không chọn ngày = áp dụng từ trước đến nay')) + '</span>' +
      '<button class="btn xs danger" onclick="_scpDraft.splice(' + i + ',1);_renderSaleChannelsModal()" title="Xoá mốc">🗑</button></div>';
  });
  h += '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm secondary" onclick="_scpDraft.push({from:\'\',channel:\'\'});_renderSaleChannelsModal()">+ Thêm mốc</button>' +
    '<button class="btn sm primary" onclick="_scpSaveDraft()">💾 Lưu mốc</button><button class="btn sm" onclick="_scpToggle(_scpOpenName)">Hủy</button></div></td></tr>';
  return h;
}
function _scpSaveDraft(){
  if (typeof currentUser !== 'undefined' && currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài mốc phân loại.'); return; }
  var rows = _scpDraft.filter(function(e){ return e.from || e.channel; });   // bỏ dòng trống hoàn toàn
  var seen = {};
  for (var i = 0; i < rows.length; i++){ var f = rows[i].from; if (seen[f] === 1){ toast(f ? 'Có 2 mốc trùng ngày ' + _scpFmtDate_(f) + ' — mỗi ngày chỉ 1 mốc.' : 'Chỉ được 1 mốc không chọn ngày (từ trước đến nay).'); return; } seen[f] = 1; }
  _scpSet_(_scpOpenName, rows, _scpGroupNames_(_scpOpenName));
  _scpOpenName = ''; _scpDraft = null;
  saveSaleChannelPeriods();
  _renderSaleChannelsModal();
  if (typeof _srState !== 'undefined' && (_srState.sub === 'E' || _srState.sub === 'G') && typeof renderSalesReportTab === 'function') renderSalesReportTab();
}

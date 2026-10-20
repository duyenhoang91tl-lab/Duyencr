// ════════════════════════════════════════════════════════════════════
//  B2 — TRANG "⚙ CẤU HÌNH" TẬP TRUNG (docs/ROADMAP-CRM-MAU.md). Chỉ Admin.
//  Ngưỡng nhắc việc lưu ở Settings (server) để MỌI máy dùng chung, mỗi lần đổi ghi AuditLog (giá trị cũ → mới):
//    ttStageHours (GAS: đơn Base kẹt giai đoạn, gas/23_TodayTasks.gs) · hmCycle (chu kỳ tái mua) · hmIdle (cảnh báo thiếu hoạt động) — 2 key sau dùng ở js/36
//  Hiện "lần chạy tự động gần nhất" (ttLastTrackedMs) + lối tắt tới Phòng ban, Tài khoản, Mẫu hỏi thăm, Trạng thái chăm sóc, Nhật ký.
// ════════════════════════════════════════════════════════════════════
var _CFG_FIELDS = [
  { key:'ttStageHours', label:'Đơn Base kẹt 1 giai đoạn quá', unit:'giờ', def:24, min:1, max:720, hint:'Hiện trong "Việc cần làm" (khung nhắc hẹn). Cần deploy GAS có gas/23_TodayTasks.gs.' },
  { key:'hmCycle',      label:'Chu kỳ tái mua mặc định',       unit:'ngày', def:30, min:1, max:365, hint:'Chip "Khách đến hạn tái mua" ở Tổng quan: mua gần nhất cách nay ≥ số ngày này.' },
  { key:'hmIdle',       label:'Cơ hội thiếu hoạt động sau',    unit:'ngày', def:7, min:1, max:90, hint:'Chip "Cơ hội thiếu hoạt động": có trạng thái chăm sóc nhưng chưa cập nhật ≥ số ngày này.' }
];
var _cfg = { vals:{}, last:0, loaded:false };

function _cfgEnsureTab(){
  if (!currentUser || currentUser.role !== 'admin') return;
  var bar = document.querySelector('#data-view .tabs'); if (!bar || document.querySelector('[data-bar-id="config"]')) return;
  var d = document.createElement('div'); d.className = 'tab'; d.id = 'v9tab-config'; d.setAttribute('data-bar-id', 'config'); d.setAttribute('data-bar-home', '.tabs');
  d.setAttribute('onclick', "switchTab('config',this)"); d.innerHTML = '⚙ Cấu hình'; bar.appendChild(d);
}
function _cfgEnsurePanel(){
  var dv = document.getElementById('data-view'); if (!dv) return null;
  var p = document.getElementById('tab-config');
  if (!p){ p = document.createElement('div'); p.id = 'tab-config'; p.className = 'main'; p.style.cssText = 'display:none;flex:1;overflow:auto;flex-direction:column'; p.innerHTML = '<div class="dash-wrap" id="cfg-wrap"></div>'; dv.appendChild(p); }
  return p;
}
async function _cfgLoad(){
  if (!gsUrl) return;
  try {
    var keys = _CFG_FIELDS.map(function(f){ return f.key; }).concat(['ttLastTrackedMs', 'bizRules']).join(',');
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=getSettings&keys=' + keys, { redirect:'follow' });
    var d = await r.json(), v = (d && d.values) || {};
    _CFG_FIELDS.forEach(function(f){ _cfg.vals[f.key] = (v[f.key] !== undefined && v[f.key] !== null && String(v[f.key]) !== '') ? Number(v[f.key]) : f.def; });
    _cfg.last = Number(v.ttLastTrackedMs) || 0; _cfg.loaded = true;
    try { if (v.bizRules) _bizApply_(JSON.parse(v.bizRules)); } catch(eB){}   // quy tắc tính doanh thu/hoa hồng (js/06)
  } catch(e){ _CFG_FIELDS.forEach(function(f){ if (_cfg.vals[f.key] == null) _cfg.vals[f.key] = f.def; }); }
}
function _cfgFmtTime(ms){
  if (!ms) return 'chưa có lần chạy nào';
  var d = new Date(ms), p = function(n){ return (n < 10 ? '0' : '') + n; };
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ' ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' (' + Math.max(0, Math.round((Date.now() - ms) / 60000)) + ' phút trước)';
}
function _cfgRender(){
  var w = document.getElementById('cfg-wrap'); if (!w) return;
  var rows = _CFG_FIELDS.map(function(f){
    return '<div style="padding:10px 0;border-top:1px solid var(--border)"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:200px;font-weight:600">' + esc(f.label) + '</div>' +
      '<input type="number" id="cfg-' + f.key + '" min="' + f.min + '" max="' + f.max + '" value="' + esc(_cfg.vals[f.key] != null ? _cfg.vals[f.key] : f.def) + '" style="width:80px;padding:5px 8px;border:1px solid var(--border);border-radius:6px"> <span>' + f.unit + '</span></div>' +
      '<div style="font-size:11.5px;color:var(--muted);margin-top:3px">' + esc(f.hint) + '</div></div>';
  }).join('');
  function sc(label, js){ return '<button class="btn" onclick="' + js + '">' + label + '</button>'; }
  w.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:12px">⚙ Cấu hình</div>' +
    '<div class="dash-section"><div style="font-weight:700;margin-bottom:2px">⏱ Mốc nhắc việc</div>' + rows +
    '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="cfg-save" onclick="_cfgSave()">💾 Lưu cấu hình</button><span style="font-size:11.5px;color:var(--muted)">Lưu lên server — mọi máy dùng chung; mỗi thay đổi ghi vào Nhật ký.</span></div></div>' +
    _cfgBizHtml_() +
    '<div class="dash-section" style="margin-top:14px"><div style="font-weight:700;margin-bottom:6px">🤖 Chạy tự động</div><div style="font-size:13px">Lần theo dõi giai đoạn đơn Base gần nhất: <b>' + esc(_cfgFmtTime(_cfg.last)) + '</b></div>' +
    '<div style="font-size:11.5px;color:var(--muted);margin-top:3px">Chạy mỗi giờ trên máy chủ (trong Apps Script chạy <code>ttCaiTrigger</code> một lần để bật). Quá 2 giờ chưa chạy nghĩa là trigger đang tắt.</div></div>' +
    '<div class="dash-section" style="margin-top:14px"><div style="font-weight:700;margin-bottom:8px">🔗 Lối tắt cài đặt</div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
    sc('🏢 Phòng ban', "_cfgGoDept()") + sc('🔑 Tài khoản & quyền', "openAcctModal()") + sc('📨 Mẫu hỏi thăm sau mua', "openFuTplModal()") +
    sc('⚙ Trạng thái chăm sóc', "openCareStatusModal()") + sc('🧾 Nhật ký', "_cfgGoTab('audit')") + '</div></div>';
}
// ── QUY TẮC TÍNH DOANH THU & HOA HỒNG (bizRules) — admin tự cài, không cần sửa code. Lưu Settings 'bizRules' (JSON); backend đọc ở gas_v13.js _bizRules_(). ──
function _cfgLines_(arr){ return (arr || []).join('\n'); }
function _cfgBizHtml_(){
  var B = BIZ_RULES, ta = 'width:100%;min-height:78px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;box-sizing:border-box';
  function row(label, ctl, hint){ return '<div style="padding:10px 0;border-top:1px solid var(--border)"><div style="font-weight:600;margin-bottom:5px">' + label + '</div>' + ctl + '<div style="font-size:11.5px;color:var(--muted);margin-top:4px">' + hint + '</div></div>'; }
  var inp = 'width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px';
  return '<div class="dash-section" style="margin-top:14px"><div style="font-weight:700;margin-bottom:2px">📐 Quy tắc tính doanh thu &amp; hoa hồng</div>' +
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:4px">Áp cho toàn công ty (CRM + Pancake AI). Để mặc định = cách tính hiện tại; đổi xong báo cáo tính lại theo quy tắc mới ngay lần tải sau.</div>' +
    row('Ngưỡng phân loại đơn để tính hoa hồng', '<input type="number" id="cfg-biz-thr" min="0.1" step="0.5" value="' + esc(String(B.commissionThreshold / 1e6)) + '" style="' + inp + '"> triệu đồng',
      'Đơn từ mức này trở lên dùng % "đơn ≥ ngưỡng", thấp hơn dùng % "đơn &lt; ngưỡng" (% từng người/team cài ở Báo cáo E).') +
    row('Trạng thái đơn BASE bị loại khỏi doanh số', '<textarea id="cfg-biz-base" style="' + ta + '">' + esc(_cfgLines_(B.baseExcludedStatuses)) + '</textarea>',
      'Mỗi dòng 1 trạng thái (cột Trạng thái của DT TỔNG). So khớp CẢ chuỗi, không phân biệt hoa/thường/dấu. Để trống = không loại đơn nào.') +
    row('Trạng thái đơn POS bị loại khỏi doanh số', '<textarea id="cfg-biz-pos" style="' + ta + '">' + esc(_cfgLines_(B.posExcludedStatuses)) + '</textarea>',
      'Mỗi dòng 1 trạng thái (cột Trạng thái đơn của sheet "dữ liệu đơn"). Cách so khớp như trên.') +
    row('Đơn cửa hàng/quầy có gắn thẻ sale: sale được tính', '<input type="number" id="cfg-biz-quay" min="1" max="100" step="1" value="' + esc(String(Math.round(B.quayRatio * 100))) + '" style="' + inp + '"> % doanh thu đơn',
      'Phần còn lại là của quầy (30 = chia 30/70). Cũng dùng cho đơn khách hẹn qua cửa hàng.') +
    row('Nguồn đơn được coi là cửa hàng/quầy', '<textarea id="cfg-biz-qkw" style="' + ta + '">' + esc(_cfgLines_(B.quayKeywords)) + '</textarea>',
      'Mỗi dòng 1 từ khóa; Nguồn đơn CHỨA từ khóa (không phân biệt hoa/thường/dấu) thì áp tỷ lệ trên.') +
    '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" id="cfg-biz-save" onclick="_cfgBizSave()">💾 Lưu quy tắc</button>' +
    '<button class="btn" onclick="_cfgBizSave(true)">↺ Về mặc định</button><span style="font-size:11.5px;color:var(--muted)">Chỉ Admin lưu được; ghi vào Nhật ký (giá trị cũ → mới).</span></div></div>';
}
async function _cfgBizSave(reset){
  var g = function(id){ return document.getElementById(id); }, out = {};
  if (!reset){
    var thr = Number(String((g('cfg-biz-thr') || {}).value).replace(',', '.')) * 1e6, q = Number(String((g('cfg-biz-quay') || {}).value).replace(',', '.'));
    if (!(thr >= 100000)){ toast('Ngưỡng hoa hồng: nhập số triệu đồng hợp lệ (tối thiểu 0,1)'); return; }
    if (!(q >= 1 && q <= 100)){ toast('Tỷ lệ quầy: nhập từ 1 đến 100 (%)'); return; }
    var ls = function(id){ return String((g(id) || {}).value || '').split(/\n|;/).map(function(x){ return x.trim(); }).filter(Boolean); };
    out = { commissionThreshold: Math.round(thr), baseExcludedStatuses: ls('cfg-biz-base'), posExcludedStatuses: ls('cfg-biz-pos'), quayRatio: Math.round(q) / 100, quayKeywords: ls('cfg-biz-qkw') };
    if (!out.quayKeywords.length){ toast('Cần ít nhất 1 từ khóa nguồn cửa hàng (hoặc bấm "Về mặc định")'); return; }
  }
  var oldStr = JSON.stringify(BIZ_RULES), btn = g('cfg-biz-save'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang lưu…'; }
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key:'bizRules', value: JSON.stringify(out) }) });
    var d = await r.json().catch(function(){ return {}; }); if (d && d.error) throw new Error(d.error);
    _bizApply_(out); saveLS('ome_biz_rules', out);
    var newStr = JSON.stringify(BIZ_RULES);
    if (oldStr !== newStr) fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveAudit', rows: [{ timestamp: new Date().toISOString(), user: (currentUser && currentUser.name) || '', action: 'Cấu hình: Quy tắc tính doanh thu/hoa hồng' + (reset ? ' (về mặc định)' : ''), phone: '', oldValue: oldStr, newValue: newStr }] }) }).catch(function(){});
    toast(oldStr === newStr ? 'Không có thay đổi' : '✓ Đã lưu quy tắc — báo cáo sẽ tính theo quy tắc mới');
    if (typeof _srState !== 'undefined' && _srState.sub === 'E' && typeof renderSalesReportTab === 'function') renderSalesReportTab();
  } catch(e){ toast('Lưu lỗi: ' + (e && e.message || e)); }
  _cfgRender();
}
function _cfgGoTab(id){ var el = document.querySelector('[data-bar-id="' + id + '"]') || document.createElement('div'); if (typeof switchTab === 'function') switchTab(id, el); }
function _cfgGoDept(){
  _cfgGoTab('overview');
  var tries = 0, iv = setInterval(function(){ tries++; if ((typeof _ov !== 'undefined' && _ov && _ov.data) || tries > 30){ clearInterval(iv); if (_ov && _ov.data) openDeptSettings(); else toast('Tổng quan chưa tải xong — bấm "⚙ Cài đặt phòng" ở Tổng quan.'); } }, 400);
}
async function _cfgSave(){
  var out = {}, old = Object.assign({}, _cfg.vals);
  for (var i = 0; i < _CFG_FIELDS.length; i++){
    var f = _CFG_FIELDS[i], n = Math.round(Number((document.getElementById('cfg-' + f.key) || {}).value));
    if (!(n >= f.min && n <= f.max)){ toast(f.label + ': nhập từ ' + f.min + ' đến ' + f.max); return; }
    out[f.key] = n;
  }
  var changed = _CFG_FIELDS.filter(function(f){ return old[f.key] !== out[f.key]; });
  if (!changed.length){ toast('Không có thay đổi'); return; }
  var btn = document.getElementById('cfg-save'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang lưu…'; }
  try {
    for (var k = 0; k < changed.length; k++){
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key: changed[k].key, value: String(out[changed[k].key]) }) });
      var d = await r.json().catch(function(){ return {}; }); if (d && d.error) throw new Error(d.error);
    }
    var who = (currentUser && currentUser.name) || '', ts = new Date().toISOString();
    fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveAudit', rows: changed.map(function(f){
      return { timestamp: ts, user: who, action: 'Cấu hình: ' + f.label, phone: '', oldValue: String(old[f.key]) + ' ' + f.unit, newValue: String(out[f.key]) + ' ' + f.unit }; }) }) }).catch(function(){});
    _cfg.vals = out;
    try { localStorage.setItem('ome_hm_cfg', JSON.stringify({ cycle: out.hmCycle, idle: out.hmIdle })); } catch(e){}
    if (typeof hmRenderChips === 'function') hmRenderChips();
    toast('✓ Đã lưu cấu hình');
  } catch(e){ toast('Lưu lỗi: ' + (e && e.message || e)); }
  if (btn){ btn.disabled = false; btn.textContent = '💾 Lưu cấu hình'; }
}
async function renderConfigTab(){
  _cfgEnsurePanel(); _cfgRender();
  await _cfgLoad(); _cfgRender();
}
var _cfgPrevSwitch = switchTab;
switchTab = function(tab, el){
  _cfgPrevSwitch(tab, el);
  var p = _cfgEnsurePanel(); if (p) p.style.display = (tab === 'config') ? 'flex' : 'none';
  if (tab === 'config'){
    if (!currentUser || currentUser.role !== 'admin'){ p.querySelector('#cfg-wrap').innerHTML = '<div style="padding:20px;color:var(--muted)">Chỉ Admin được vào trang Cấu hình.</div>'; return; }
    renderConfigTab();
  }
};
(function(){
  function init(){ _cfgEnsureTab(); _cfgEnsurePanel(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setInterval(_cfgEnsureTab, 4000);   // tab chỉ tạo khi đã đăng nhập admin; thử lại tới khi có
})();

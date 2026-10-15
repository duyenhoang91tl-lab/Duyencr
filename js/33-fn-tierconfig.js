// ═══════════════════════════════════════════════════════
//  P1a/1b — CẤU HÌNH HẠNG KH (tên + ngưỡng doanh thu), lưu Settings 'tierConfig'
//  4 hạng cố định (thuong < tt < vip < super) để không vỡ bộ lọc/chia data đang dùng khóa này;
//  admin đổi TÊN hiển thị và NGƯỠNG (VND). GAS đọc cùng khóa (_aaHangKey_) -> chia tự động khớp web.
//  Chưa cấu hình/sai -> mặc định cũ 0 / 15tr / 30tr / 50tr.
// ═══════════════════════════════════════════════════════
var _TIER_DEFAULT = [
  { key:'thuong', label:'Khách thường', min:0 },
  { key:'tt',     label:'Ưu tiên',      min:15000000 },
  { key:'vip',    label:'Vip',          min:30000000 },
  { key:'super',  label:'Super VVip',   min:50000000 }
];
function _tierNormalize(raw){
  var arr = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch(e) { return null; } }
  if (!Array.isArray(arr) || arr.length !== 4) return null;
  var out = [], prev = -1;
  for (var i = 0; i < 4; i++) {
    var d = _TIER_DEFAULT[i], x = arr.filter(function(t){ return t && t.key === d.key; })[0];
    if (!x) return null;
    var min = i === 0 ? 0 : Number(x.min);
    if (!isFinite(min) || min <= prev) return null;
    out.push({ key:d.key, label:(String(x.label || '').trim().slice(0,30) || d.label), min:min });
    prev = min;
  }
  return out;
}
// Áp cấu hình vào các biến toàn cục hiện có (sửa tại chỗ để mọi nơi đang tham chiếu HANG_LABEL thấy ngay)
function _tierApply(cfg){
  cfg = cfg || _TIER_DEFAULT;
  cfg.forEach(function(t){
    _TIER_MIN[t.key] = t.min;
    HANG_LABEL[t.key] = t.label;
    if (typeof _AA_HANG_LABEL !== 'undefined') _AA_HANG_LABEL[t.key] = t.label;
  });
  window._tierCfgCur = cfg;
  try {
    if (typeof allCustomers !== 'undefined' && allCustomers.length) {
      allCustomers.forEach(function(c){ c.hangKey = _hangKeyOf_(c.totalRevenue); c.hang = HANG_LABEL[c.hangKey]; });
      if (typeof customerMap !== 'undefined') Object.keys(customerMap).forEach(function(p){ var c = customerMap[p]; if (c && c.totalRevenue != null) { c.hangKey = _hangKeyOf_(c.totalRevenue); c.hang = HANG_LABEL[c.hangKey]; } });
      if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
      if (typeof applyFilters === 'function') applyFilters();
    }
  } catch(e) { console.warn('_tierApply', e); }
}
async function _tierLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSettings&keys=tierConfig', { redirect:'follow' });
    var v = (((await r.json()) || {}).values || {}).tierConfig;
    var cfg = v ? _tierNormalize(v) : null;
    if (cfg) _tierApply(cfg);
  } catch(e) { console.warn('_tierLoad', e); }
}
setTimeout(_tierLoad, 2500);

function openTierConfig(){
  var old = document.getElementById('tier-cfg-ov'); if (old) old.remove();
  var cfg = window._tierCfgCur || _TIER_DEFAULT;
  var ov = document.createElement('div');
  ov.id = 'tier-cfg-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3000;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:16px 18px;width:min(480px,94vw);box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
    '<div style="font-weight:600;margin-bottom:4px">🏅 Cấu hình hạng khách hàng</div>' +
    '<div class="guide-text" style="font-size:12px;color:var(--muted);margin-bottom:10px">Hạng tính theo tổng doanh thu Pos của khách (giữ nguyên cách tính hiện tại). Đổi tên và ngưỡng — ngưỡng phải tăng dần. Hạng đầu luôn từ 0đ.</div>' +
    '<table style="width:100%;font-size:12px"><tr style="color:var(--muted)"><td></td><td>Tên hạng</td><td>Từ doanh thu (triệu đồng)</td></tr>' +
    cfg.map(function(t,i){ return '<tr><td style="padding:4px 6px 4px 0;color:var(--muted)">' + (i+1) + '</td>' +
      '<td><input data-k="' + t.key + '" data-f="label" value="' + esc(t.label) + '" maxlength="30" style="width:100%;padding:5px;border:1px solid var(--border);border-radius:6px"></td>' +
      '<td><input data-k="' + t.key + '" data-f="min" type="number" min="0" step="0.5" value="' + (t.min / 1000000) + '"' + (i === 0 ? ' disabled' : '') + ' style="width:100%;padding:5px;border:1px solid var(--border);border-radius:6px"></td></tr>'; }).join('') +
    '</table><div id="tier-cfg-st" style="font-size:12px;margin-top:8px;color:var(--muted)"></div>' +
    '<div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px"><button class="btn sm" id="tier-cfg-reset">↺ Về mặc định</button><span><button class="btn sm" id="tier-cfg-x">Đóng</button> <button class="btn sm primary" id="tier-cfg-save">💾 Lưu</button></span></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
  ov.querySelector('#tier-cfg-x').onclick = function(){ ov.remove(); };
  ov.querySelector('#tier-cfg-reset').onclick = function(){ _tierSave(_TIER_DEFAULT, ov); };
  ov.querySelector('#tier-cfg-save').onclick = function(){
    var rows = _TIER_DEFAULT.map(function(d){
      var lab = ov.querySelector('input[data-k="' + d.key + '"][data-f="label"]').value;
      var mn = ov.querySelector('input[data-k="' + d.key + '"][data-f="min"]').value;
      return { key:d.key, label:lab, min: d.key === 'thuong' ? 0 : Math.round(parseFloat(mn) * 1000000) };
    });
    var chk = _tierNormalize(rows), st = ov.querySelector('#tier-cfg-st');
    if (!chk) { st.style.color = 'var(--red)'; st.textContent = 'Ngưỡng phải là số và tăng dần (hạng sau lớn hơn hạng trước).'; return; }
    _tierSave(chk, ov);
  };
}
async function _tierSave(cfg, ov){
  var st = ov.querySelector('#tier-cfg-st'); st.style.color = 'var(--muted)'; st.textContent = 'Đang lưu...';
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key:'tierConfig', value: JSON.stringify(cfg) }) });
    var j = await r.json(); if (j && j.error) throw new Error(j.error);
    var before = JSON.stringify((window._tierCfgCur || _TIER_DEFAULT).map(function(t){ return t.label + ':' + t.min; }));
    _tierApply(cfg);
    try { logAudit('Cấu hình hạng', '', before, JSON.stringify(cfg.map(function(t){ return t.label + ':' + t.min; }))); } catch(e){}
    ov.remove(); if (typeof toast === 'function') toast('✓ Đã lưu cấu hình hạng — chia tự động dùng ngay từ lần chạy kế tiếp');
  } catch(e) { st.style.color = 'var(--red)'; st.textContent = 'Lỗi lưu: ' + e.message; }
}

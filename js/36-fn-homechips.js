// ════════════════════════════════════════════════════════════════════
//  B1 — 4 CHIP "HÔM NAY" ở đầu màn Tổng quan (theo docs/ROADMAP-CRM-MAU.md, clip CRM mẫu 2026-10-11).
//  Tính HOÀN TOÀN ở client từ dữ liệu đã tải (không gọi thêm API, không cần deploy GAS), chỉ trong phạm vi người đang đăng nhập (_inUserScope):
//   • Việc hôm nay  = nhắc hẹn đến hạn đúng hôm nay (_dueReminders) + đơn Base kẹt giai đoạn (js/34, nếu có)
//   • Việc quá hạn  = nhắc hẹn đến hạn trước hôm nay
//   • Khách đến hạn tái mua = ngày mua gần nhất cách nay >= chu kỳ (mặc định 30) và < chu kỳ + 60 ngày
//   • Cơ hội thiếu hoạt động = khách có trạng thái chăm sóc nhưng care.updated cũ >= N ngày (mặc định 7); khách chưa có care.updated KHÔNG tính
//  Ngưỡng tạm lưu localStorage 'ome_hm_cfg' {cycle, idle}; B2 sẽ đưa vào trang Cấu hình tập trung.
// ════════════════════════════════════════════════════════════════════
function _hmCfg(){
  var c = {}; try { c = JSON.parse(localStorage.getItem('ome_hm_cfg') || '{}') || {}; } catch(e){}
  return { cycle: Math.max(1, parseInt(c.cycle, 10) || 30), idle: Math.max(1, parseInt(c.idle, 10) || 7) };
}
function hmCompute(now){
  now = now || new Date();
  var cfg = _hmCfg(), today = (typeof _remDateStr === 'function') ? _remDateStr() : '', out = { today: [], overdue: [], rebuy: [], idle: [], cfg: cfg };
  try {
    (typeof _dueReminders === 'function' ? _dueReminders() : []).forEach(function(r){
      var it = { phone: r.phone, name: r.name || r.phone, sub: (r.date || '') + (r.note ? ' · ' + r.note : '') };
      if (r.date === today) out.today.push(it); else out.overdue.push(it);
    });
  } catch(e){}
  try {
    if (typeof _ttCards === 'function') _ttCards().forEach(function(t){
      (t.items || []).forEach(function(o){ out.today.push({ phone:'', name:'Đơn ' + o.id, sub: o.stage + ' · kẹt ' + o.hours + ' giờ' }); });
    });
  } catch(e){}
  var map = (typeof customerMap !== 'undefined' && customerMap) ? customerMap : {};
  var care = (typeof careData !== 'undefined' && careData) ? careData : {};
  Object.keys(map).forEach(function(p){
    var c = map[p]; if (!c) return;
    if (typeof _inUserScope === 'function' && !_inUserScope(c)) return;
    var d = (typeof proDaysSinceLastOrder_ === 'function') ? proDaysSinceLastOrder_(c.orders, now) : null;
    if (d !== null && d >= cfg.cycle && d < cfg.cycle + 60) out.rebuy.push({ phone:p, name:c.name || p, sub:'mua gần nhất ' + d + ' ngày trước', key:d });
    var cr = care[p];
    if (cr && cr.status && cr.updated){
      var t = new Date(cr.updated).getTime();
      if (t){ var idle = Math.floor((now.getTime() - t) / 86400000); if (idle >= cfg.idle) out.idle.push({ phone:p, name:c.name || p, sub:'chưa cập nhật ' + idle + ' ngày', key:idle }); }
    }
  });
  out.rebuy.sort(function(a, b){ return b.key - a.key; });
  out.idle.sort(function(a, b){ return b.key - a.key; });
  return out;
}
// Đồng bộ ngưỡng từ Settings (admin đặt ở trang Cấu hình js/37) → localStorage 'ome_hm_cfg' → _hmCfg(); chạy lúc mở app + mỗi 15 phút
async function hmSyncCfg(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=getSettings&keys=hmCycle,hmIdle', { redirect:'follow' });
    var v = ((await r.json()) || {}).values || {}, cur = _hmCfg();
    var n = { cycle: parseInt(v.hmCycle, 10) || cur.cycle, idle: parseInt(v.hmIdle, 10) || cur.idle };
    if (n.cycle !== cur.cycle || n.idle !== cur.idle){ localStorage.setItem('ome_hm_cfg', JSON.stringify(n)); hmRenderChips(); }
  } catch(e){}
}
setTimeout(hmSyncCfg, 6000); setInterval(hmSyncCfg, 15 * 60 * 1000);
var _hmLast = null;
function hmRenderChips(){
  var el = document.getElementById('hm-chips'); if (!el) return;
  var r = _hmLast = hmCompute();
  function chip(key, icon, label, n, red){
    return '<button type="button" onclick="hmOpenList(\'' + key + '\')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;cursor:pointer;font-size:13px;' +
      'border:1px solid ' + (red && n ? '#fca5a5' : 'var(--border)') + ';background:' + (red && n ? '#fef2f2' : 'var(--surface)') + ';color:' + (red && n ? '#b91c1c' : 'var(--text)') + '">' +
      icon + ' <b>' + n + '</b> ' + label + '</button>';
  }
  if (!document.getElementById('hs-summary')) el.insertAdjacentHTML('afterend', '<div id="hs-summary" style="margin-bottom:6px"></div>');
  el.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
    chip('today', '📅', 'Việc hôm nay', r.today.length, false) + chip('overdue', '⚠️', 'Việc quá hạn', r.overdue.length, true) +
    chip('rebuy', '🔄', 'Khách đến hạn tái mua', r.rebuy.length, false) + chip('idle', '📉', 'Cơ hội thiếu hoạt động', r.idle.length, false) + '</div>';
}
var _HM_TITLES = { today:'Việc hôm nay', overdue:'Việc quá hạn', rebuy:'Khách đến hạn tái mua', idle:'Cơ hội thiếu hoạt động' };
function hmOpenList(key){
  var r = _hmLast || hmCompute(), list = r[key] || [], cfg = r.cfg;
  var hint = key === 'rebuy' ? 'Mua gần nhất cách nay ≥ ' + cfg.cycle + ' ngày' : key === 'idle' ? 'Có trạng thái chăm sóc nhưng ≥ ' + cfg.idle + ' ngày chưa cập nhật' : '';
  hmCloseList();
  var m = document.createElement('div'); m.id = 'hm-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px';
  m.onclick = function(e){ if (e.target === m) hmCloseList(); };
  m.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:520px;width:100%;max-height:84vh;overflow:auto;padding:14px 16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:15px">' + esc(_HM_TITLES[key] || '') + ' (' + list.length + ')</b><button class="btn sm" onclick="hmCloseList()">✕</button></div>' +
    (hint ? '<div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">' + esc(hint) + '</div>' : '') +
    (list.length ? list.slice(0, 100).map(function(it){
      return '<div ' + (it.phone ? 'data-phone="' + esc(it.phone) + '" onclick="hmCloseList();openDp(this.dataset.phone)" style="cursor:pointer;' : 'style="') + 'padding:7px 2px;border-top:1px solid var(--border)"><b>' + esc(it.name) + '</b>' + (it.phone ? ' · ' + esc(it.phone) : '') + '<div style="font-size:11.5px;color:var(--muted)">' + esc(it.sub || '') + '</div></div>';
    }).join('') + (list.length > 100 ? '<div style="color:var(--muted);padding-top:6px">… và ' + (list.length - 100) + ' mục nữa</div>' : '') : '<div style="padding:14px;text-align:center;color:var(--muted)">Không có mục nào 🎉</div>') + '</div>';
  document.body.appendChild(m);
}
function hmCloseList(){ var m = document.getElementById('hm-modal'); if (m) m.remove(); }
setInterval(function(){ try { hmRenderChips(); } catch(e){} }, 60000);

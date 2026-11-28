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
      (t.items || []).forEach(function(o){ out.today.push(typeof stuckRow_ === 'function' ? stuckRow_(o) : { phone:'', name:'Đơn ' + o.id, sub: o.stage + ' · kẹt ' + o.hours + ' giờ' }); });
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
// ── NÚT LỚN đầu màn Tổng quan: người chưa dùng bao giờ nhìn là biết bấm, KHÔNG cần dòng hướng dẫn (Duyên 2026-11-28).
// NGUYÊN NHÂN GỐC: mở app chỉ thấy bộ lọc ngày + số liệu, mọi việc hằng ngày nằm sau nút "☰ Menu" (hơn 20 mục). Bấm nút = bấm đúng mục menu đó (giữ nguyên phân quyền).
var _HM_START = [   // [mục menu (data-bar-id | act:khoá), icon, nhãn, chỉ vai trò ('' = ai được cấp mục đó)]
  ['tab-mydata', '📋', 'Khách được giao', 'cs,manager,leader'],
  ['act:assign', '👥', 'Chia data', 'admin'], ['act:leadassign', '👥', 'Chia cho team', 'leader'],
  ['tab-kh', '🔍', 'Tìm khách', ''], ['tab-schedule', '⏰', 'Lịch gọi khách', ''],
  ['taodon', '➕', 'Tạo đơn', ''], ['crmorders', '🧾', 'Đơn hàng', ''], ['tab-chat', '💬', 'Tin nhắn khách', ''],
  ['salesreport', '📈', 'Doanh số', 'admin'], ['act:acct', '🔑', 'Tài khoản', 'admin']
];
// find(id) trả phần tử menu hoặc null. Tab bị phân quyền ẩn bằng style.display='none' (js/05); mục "act:" chỉ dùng cho đúng vai trò ghi ở bảng.
function hmStartItems_(role, find){
  return _HM_START.filter(function(it){
    if (it[3] && it[3].split(',').indexOf(role) === -1) return false;
    var el = find(it[0]); return !!el && el.style.display !== 'none';
  });
}
function _hmMenuEl_(id){ return document.querySelector(id.indexOf('act:') === 0 ? '#data-view .tabs .sn-act[data-act="' + id.slice(4) + '"]' : '#data-view .tabs .tab[data-bar-id="' + id + '"]'); }
function hmStart(id){
  var el = _hmMenuEl_(id); if (!el) return;
  el.click();
  if (id === 'tab-kh') setTimeout(function(){ var q = document.getElementById('qs-input'); if (q) q.focus(); }, 50);
}
function hmRenderStart(){
  var chips = document.getElementById('hm-chips'); if (!chips) return;
  var box = document.getElementById('hm-start');
  if (!box) {
    box = document.createElement('div'); box.id = 'hm-start';
    box.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;margin-bottom:14px;flex-shrink:0';
    chips.parentNode.insertBefore(box, chips.parentNode.firstChild);
  }
  var role = (typeof currentUser !== 'undefined' && currentUser && currentUser.role) || '';
  box.innerHTML = hmStartItems_(role, _hmMenuEl_).map(function(it){
    var el = _hmMenuEl_(it[0]), b = el && el.querySelector('.tab-badge'), n = b ? parseInt(b.textContent, 10) || 0 : 0;
    if (it[0] === 'tab-kh') n = 0;   // so khach khong phai viec can lam
    return '<button type="button" data-go="' + it[0] + '" onclick="hmStart(this.dataset.go)" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:92px;padding:10px 6px;' +
      'border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font:600 13.5px/1.25 inherit;font-family:inherit">' +
      '<span aria-hidden="true" style="font-size:28px;line-height:1">' + it[1] + '</span><span>' + it[2] + '</span>' +
      (n ? '<span style="position:absolute;top:6px;right:8px;min-width:22px;padding:1px 6px;border-radius:11px;background:#dc2626;color:#fff;font-size:12px">' + n + '</span>' : '') + '</button>';
  }).join('');
}
[1500, 5000].forEach(function(ms){ setTimeout(function(){ try { hmRenderStart(); } catch(e){} }, ms); });   // menu duoc dung muon sau dang nhap
var _hmLast = null;
function hmRenderChips(){
  var el = document.getElementById('hm-chips'); if (!el) return;
  try { hmRenderStart(); } catch(e){}
  var r = _hmLast = hmCompute();
  function chip(key, icon, label, n, red){
    return '<button type="button" onclick="hmOpenList(\'' + key + '\')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;cursor:pointer;font-size:13px;' +
      'border:1px solid ' + (red && n ? '#fca5a5' : 'var(--border)') + ';background:' + (red && n ? '#fef2f2' : 'var(--surface)') + ';color:' + (red && n ? '#b91c1c' : 'var(--text)') + '">' +
      icon + ' <b>' + n + '</b> ' + label + '</button>';
  }
  if (!document.getElementById('hs-summary')) el.insertAdjacentHTML('afterend', '<div id="hs-summary" style="margin-bottom:6px"></div>');
  el.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
    chip('today', '📅', 'Việc hôm nay', r.today.length, false) + chip('overdue', '⚠️', 'Việc quá hạn', r.overdue.length, true) +
    chip('rebuy', '🔄', 'Khách đến hạn tái mua', r.rebuy.length, false) + chip('idle', '📉', 'Khách lâu chưa cập nhật', r.idle.length, false) + '</div>';
}
var _HM_TITLES = { today:'Việc hôm nay', overdue:'Việc quá hạn', rebuy:'Khách đến hạn tái mua', idle:'Khách lâu chưa cập nhật' };
// Chiều cao tối đa của hộp danh sách. NGUYÊN NHÂN GỐC (ảnh app Android 15/11 19:53): trước đây dùng max-height:84vh, nhưng WebView của app có lúc kẹt đơn vị vh = 0
// (xem vhFixJs trong CrmWeb.kt, js/59-fn-mobilefit.js) nên hộp bị ép còn đúng phần đệm + dòng tiêu đề → 1 dải trắng mỏng, không thấy danh sách. Dùng px theo innerHeight THẬT;
// chưa có kích thước (innerHeight < 120) thì dùng 84% (lớp phủ position:fixed;inset:0 luôn có chiều cao xác định, không phụ thuộc vh).
function hmModalMaxH_(innerH){ var h = Math.round(Number(innerH)); return h >= 120 ? Math.round(h * 0.84) + 'px' : '84%'; }
function hmOpenList(key){
  var r = _hmLast || hmCompute(), list = r[key] || [], cfg = r.cfg;
  var hint = key === 'rebuy' ? 'Mua gần nhất cách nay ≥ ' + cfg.cycle + ' ngày' : key === 'idle' ? 'Có trạng thái chăm sóc nhưng ≥ ' + cfg.idle + ' ngày chưa cập nhật' : '';
  hmCloseList();
  var m = document.createElement('div'); m.id = 'hm-modal';
  m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:14px';
  m.onclick = function(e){ if (e.target === m) hmCloseList(); };
  m.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:520px;width:100%;max-height:' + hmModalMaxH_(window.innerHeight) + ';overflow:auto;padding:14px 16px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:15px">' + esc(_HM_TITLES[key] || '') + ' (' + list.length + ')</b><button class="btn sm" onclick="hmCloseList()">✕</button></div>' +
    (hint ? '<div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">' + esc(hint) + '</div>' : '') +
    (list.length ? list.slice(0, 100).map(function(it){
      return '<div ' + (it.order ? 'data-oid="' + esc(it.oid) + '" onclick="hmCloseList();stuckOpen(this.dataset.oid)" style="cursor:pointer;' : (it.phone || it.orderId) ? 'data-phone="' + esc(it.phone || '') + '"' + (it.orderId ? ' data-order="' + esc(it.orderId) + '"' : '') + ' onclick="hmCloseList();ttOpenCustomer_(this.dataset.phone,this.dataset.order)" style="cursor:pointer;' : 'style="') + 'padding:7px 2px;border-top:1px solid var(--border)"><b>' + esc(it.name) + '</b>' + (it.phone ? ' · ' + esc(it.phone) : '') + '<div style="font-size:11.5px;color:var(--muted)">' + esc(it.sub || '') + '</div></div>';
    }).join('') + (list.length > 100 ? '<div style="color:var(--muted);padding-top:6px">… và ' + (list.length - 100) + ' mục nữa</div>' : '') : '<div style="padding:14px;text-align:center;color:var(--muted)">Không có mục nào 🎉</div>') + '</div>';
  document.body.appendChild(m);
}
function hmCloseList(){ var m = document.getElementById('hm-modal'); if (m) m.remove(); }
setInterval(function(){ try { hmRenderChips(); } catch(e){} }, 60000);

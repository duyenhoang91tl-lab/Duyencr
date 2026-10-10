// ════════════════════════════════════════════════════════════════════
//  NHẮC VIỆC HÔM NAY cho CS (yêu cầu Duyên 2026-10-11) — bước 1: đơn Base kẹt 1 giai đoạn quá N giờ (mặc định 24h).
//  Dữ liệu từ GAS action=todayTasks (gas/23_TodayTasks.gs, theo dõi giờ vào giai đoạn mỗi giờ vì "DT TỔNG " không có cột này).
//  Hiển thị chung trong khung nhắc hẹn (renderReminderPanel ở js/05): mỗi loại việc 1 thẻ, bấm để mở/ẩn danh sách đơn.
//  CS chỉ thấy đơn có tên sale của mình (currentUser.names); admin thấy tất cả.
// ════════════════════════════════════════════════════════════════════
var _ttState = { tasks: [], open: {}, hours: 24, at: 0 };

async function ttFetch(){
  if (typeof gsUrl === 'undefined' || !gsUrl || typeof currentUser === 'undefined' || !currentUser) return;
  var names = currentUser.role === 'admin' ? '' : ((currentUser.names && currentUser.names.length ? currentUser.names : [currentUser.name]).join('|'));
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=todayTasks&names=' + encodeURIComponent(names), { redirect:'follow' });
    var d = await r.json();
    if (d && d.tasks){ _ttState.tasks = d.tasks; _ttState.hours = d.hours || 24; _ttState.at = Date.now(); }
  } catch(e){ /* GAS cũ chưa có action hoặc lỗi mạng → giữ bản trước, không báo lỗi */ }
  if (typeof renderReminderPanel === 'function') renderReminderPanel();
}
function _ttCards(){ return (_ttState.tasks || []).filter(function(t){ return t && t.count > 0; }); }
function ttToggle(key){ _ttState.open[key] = !_ttState.open[key]; if (typeof renderReminderPanel === 'function') renderReminderPanel(); }
function _ttCardHtml(t){
  var open = !!_ttState.open[t.key];
  var h = '<div class="rp-card"><div class="rp-card-main" onclick="ttToggle(\'' + t.key + '\')">' +
    '<div class="rp-type" style="background:#d97706">⏱ Việc cần làm</div>' +
    '<div class="rp-cust">' + esc(t.title) + '</div>' +
    '<div class="rp-note" style="color:var(--red)">' + t.count + ' đơn · ' + (open ? 'bấm để thu gọn' : 'bấm để xem danh sách') + '</div>';
  if (open){
    h += '<div style="margin-top:6px;font-size:11.5px;line-height:1.5">' + (t.items || []).map(function(it){
      return '<div style="padding:3px 0;border-top:1px dashed var(--border)"><b>' + esc(it.id) + '</b> · ' + esc(it.stage) +
        ' · <span style="color:var(--red)">' + it.hours + ' giờ</span>' + (it.sale ? ' · ' + esc(it.sale) : '') + '</div>';
    }).join('') + (t.count > (t.items || []).length ? '<div style="color:var(--muted);padding-top:4px">… và ' + (t.count - t.items.length) + ' đơn nữa</div>' : '') + '</div>';
  }
  return h + '</div></div>';
}
setTimeout(ttFetch, 4000);
setTimeout(ttFetch, 20000);
setInterval(ttFetch, 15 * 60 * 1000);

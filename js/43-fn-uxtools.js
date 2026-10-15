// ════════════════════════════════════════════════════════════════════
//  B6 (docs/ROADMAP-CRM-MAU.md): 🌙 Chế độ tối · ❓ Hướng dẫn sử dụng · 🐞 Nhật ký lỗi (trên máy này). Mục "Thông báo" đã có ở js/39-fn-notify.js.
//  Ba mục này mở ở menu ☰ → nhóm Settings (đều hiện với MỌI vai trò, trừ nhật ký lỗi chỉ admin).
// ════════════════════════════════════════════════════════════════════
// ── Chế độ tối: lưu localStorage 'ome_theme' ('dark' | 'light'); biến màu ở css/07-dark.css ──
function _themeIsDark(){ try { return localStorage.getItem('ome_theme') === 'dark'; } catch(e){ return false; } }
function applyTheme(){ document.documentElement.setAttribute('data-theme', _themeIsDark() ? 'dark' : 'light'); }
// ── Lời hướng dẫn trong màn hình: MẶC ĐỊNH ẨN; bật lại ở ❓ Hướng dẫn sử dụng. Lưu localStorage 'ome_show_guides' ('1' = hiện). CSS: css/01-base.css ──
function _guidesOn(){ try { return localStorage.getItem('ome_show_guides') === '1'; } catch(e){ return false; } }
function applyGuides(){ if (document.body) document.body.classList.toggle('show-guides', _guidesOn()); }
function setGuides(on){ try { localStorage.setItem('ome_show_guides', on ? '1' : '0'); } catch(e){} applyGuides(); }
applyGuides();
function toggleTheme(){ try { localStorage.setItem('ome_theme', _themeIsDark() ? 'light' : 'dark'); } catch(e){} applyTheme(); }
applyTheme();

// ── Nhật ký lỗi trên máy này: lỗi JS + promise bị từ chối + gọi mạng lỗi, giữ 60 dòng mới nhất ──
var _ERRLOG_KEY = 'ome_errlog', _ERRLOG_MAX = 60;
function errLogRead(){ try { return JSON.parse(localStorage.getItem(_ERRLOG_KEY) || '[]') || []; } catch(e){ return []; } }
function errLogAdd(type, msg, src){
  try {
    var a = errLogRead(); a.push({ t: new Date().toISOString(), type: type, msg: String(msg || '').slice(0, 300), src: String(src || '').slice(0, 160) });
    if (a.length > _ERRLOG_MAX) a = a.slice(a.length - _ERRLOG_MAX);
    localStorage.setItem(_ERRLOG_KEY, JSON.stringify(a));
  } catch(e){}
}
window.addEventListener('error', function(e){ errLogAdd('js', e.message, (e.filename || '').split('/').pop() + ':' + (e.lineno || '')); });
window.addEventListener('unhandledrejection', function(e){ errLogAdd('promise', e.reason && (e.reason.message || e.reason), ''); });
(function(){
  if (!window.fetch || window.fetch._errLogged) return;
  var orig = window.fetch;
  window.fetch = function(u){
    var url = (typeof u === 'string' ? u : (u && u.url) || '');
    return orig.apply(this, arguments).catch(function(err){ errLogAdd('mạng', err && err.message || err, url.replace(/[?#].*$/, '').slice(0, 120) + ((url.match(/[?&]action=([A-Za-z]+)/) || [])[1] ? ' · ' + url.match(/[?&]action=([A-Za-z]+)/)[1] : '')); throw err; });
  };
  window.fetch._errLogged = true;
})();
function _uxModal(id, title, html){
  var old = document.getElementById(id); if (old) old.remove();
  var m = document.createElement('div'); m.id = id;
  m.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:14px';
  m.onclick = function(e){ if (e.target === m) m.remove(); };
  m.innerHTML = '<div style="background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;max-width:640px;width:100%;max-height:86vh;overflow:auto;padding:16px 18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:16px">' + title + '</b><button class="btn sm" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>' + html + '</div>';
  document.body.appendChild(m);
}
function openErrLogModal(){
  var a = errLogRead().slice().reverse();
  _uxModal('errlog-modal', '🐞 Nhật ký lỗi (trên máy này)',
    '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Chỉ ghi lỗi xảy ra trên trình duyệt này (lỗi JS, gọi mạng thất bại). Gặp lỗi lạ: bấm Sao chép rồi gửi cho người hỗ trợ.</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn sm" onclick="errLogCopy()">📋 Sao chép</button><button class="btn sm danger" onclick="localStorage.removeItem(\'' + _ERRLOG_KEY + '\');openErrLogModal()">🗑 Xóa nhật ký</button></div>' +
    (a.length ? a.map(function(x){ return '<div style="padding:6px 0;border-top:1px solid var(--border);font-size:12px;word-break:break-word"><span style="color:var(--muted)">' + esc(x.t.slice(0, 19).replace('T', ' ')) + '</span> <b>[' + esc(x.type) + ']</b> ' + esc(x.msg) + (x.src ? ' <span style="color:var(--muted)">· ' + esc(x.src) + '</span>' : '') + '</div>'; }).join('') : '<div style="padding:18px;text-align:center;color:var(--muted)">Chưa ghi nhận lỗi nào 🎉</div>'));
}
function errLogCopy(){
  var txt = errLogRead().map(function(x){ return x.t + ' [' + x.type + '] ' + x.msg + (x.src ? ' · ' + x.src : ''); }).join('\n');
  try { navigator.clipboard.writeText(txt); toast('Đã sao chép nhật ký lỗi'); } catch(e){ toast('Không sao chép được — chọn và copy thủ công'); }
}

// ── Hướng dẫn sử dụng (nội dung tĩnh, ngắn gọn theo từng màn) ──
var _HELP_ITEMS = [
  ['🏠 Tổng quan', 'Màn đầu tiên. Dòng 4 chip phía trên cho biết ngay việc hôm nay, việc quá hạn, khách đến hạn tái mua, cơ hội thiếu hoạt động (bấm chip để xem danh sách, bấm khách để mở hồ sơ). Bên dưới là 4 thẻ số, phân bổ giai đoạn đơn và nguồn khách — đổi kỳ hoặc bấm thẻ Phòng/Team thì tất cả số cùng đổi theo.'],
  ['👥 Khách hàng', 'Thanh lọc bên trái có “Loại khách” (Chưa mua / Đã mua) và Phân loại KH. Mở hồ sơ khách để xem mua gần nhất, dự kiến tái mua, kênh ưu tiên. Tích “🚫 Không nhận quảng bá” khi khách yêu cầu — hệ thống sẽ không đưa khách vào chiến dịch gửi hàng loạt hay hỏi thăm tự động.'],
  ['🔔 Chăm sóc & tái mua', 'Gộp một chỗ: hẹn gọi, đơn kẹt, khách đến hạn tái mua, khách thiếu hoạt động. Lọc theo loại, tìm kiếm, Xuất CSV.'],
  ['📋 Bảng đơn theo giai đoạn', 'Các đơn Base theo từng giai đoạn (Tiếp nhận đơn → … → Đóng hàng). Thẻ đỏ là đơn kẹt quá số giờ đã cấu hình. Chỉ để xem; muốn chuyển giai đoạn thì làm trên Base.'],
  ['⏱ Việc cần làm (đơn kẹt)', 'Đơn nằm quá lâu ở một giai đoạn hiện thành thẻ trong khung nhắc 🔔. Vào Base kiểm tra đơn đó.'],
  ['📊 Báo cáo doanh số', 'Doanh thu Pos bỏ đơn Hủy đơn / Hoàn đơn / Đã hoàn / Đang hoàn. Đơn ghép nhiều mã thì đối chiếu Base để chia cho đúng người; đơn cửa hàng có gắn thẻ sale chia 30/70. Doanh thu tháng = trong tháng − hoàn/hủy của tháng trước (sau khi bấm “Chốt tháng”). Thẻ “Chi tiết” của từng sale mở danh sách đơn của sale đó.'],
  ['⚙ Cấu hình (admin)', 'Đổi số giờ đơn kẹt, chu kỳ tái mua, ngưỡng thiếu hoạt động — áp dụng cho mọi máy. Có lối tắt tới Phòng ban, Tài khoản, Mẫu hỏi thăm.'],
  ['🏢 Phòng ban (admin)', 'Ở Tổng quan bấm “⚙ Cài đặt phòng” để tạo phòng và gán người/team. Phòng độc lập với Online/Văn phòng nên không ảnh hưởng thưởng.'],
  ['🌙 Chế độ tối · 🐞 Nhật ký lỗi', 'Menu ☰ → Settings. Chế độ tối nhớ theo từng máy. Nhật ký lỗi (admin) giúp gửi lại lỗi cho người hỗ trợ.']
];
function openHelpModal(){
  var guideToggle = '<label style="display:flex;gap:8px;align-items:center;padding:8px 10px;margin-bottom:8px;background:var(--surface2);border-radius:8px;font-size:12.5px;cursor:pointer">'+
    '<input type="checkbox" '+(_guidesOn() ? 'checked ' : '')+'onchange="setGuides(this.checked)"> Hiện lời hướng dẫn / nhắc nhở trong các màn hình <span style="color:var(--muted);font-size:11px">(mặc định ẩn)</span></label>';
  _uxModal('help-modal', '❓ Hướng dẫn sử dụng', guideToggle + _HELP_ITEMS.map(function(x, i){
    return '<details' + (i === 0 ? ' open' : '') + ' style="border-top:1px solid var(--border);padding:8px 0"><summary style="cursor:pointer;font-weight:600">' + x[0] + '</summary><div style="margin-top:6px;font-size:13px;line-height:1.6;color:var(--text)">' + esc(x[1]) + '</div></details>';
  }).join(''));
}

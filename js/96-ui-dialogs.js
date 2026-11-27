// ════════════════════════════════════════════════════════════════════
//  HỘP THOẠI THỐNG NHẤT (26/11/2026, "chuyên nghiệp hóa" bước 2): thay hộp alert() xám của trình duyệt bằng hộp cùng giao diện CRM.
//  - window.alert(...) được ghi đè → TOÀN BỘ ~98 chỗ alert( trong mã cũ (và onclick="alert(...)") tự đẹp lên, không phải sửa từng file.
//  - Khác alert gốc: KHÔNG chặn luồng chạy (mã sau alert chạy tiếp). Đã rà: không chỗ nào để alert ngay trước reload/chuyển trang.
//  - Nhiều thông báo liên tiếp xếp hàng, hiện lần lượt. Link http(s) trong nội dung bấm được. Esc / Enter / bấm nền / nút "Đóng" để đóng.
//  - uiAlert(msg) trả Promise (resolve khi đóng) nên mã mới có thể `await uiAlert(...)`.
//  - uiConfirm(msg, {ok, cancel, danger}) → Promise<boolean> (bấm Đồng ý = true; Hủy/Esc/bấm nền = false). Dùng: `if (!(await uiConfirm('Xóa …?'))) return;` (hàm phải async).
//    LÝ DO: confirm() gốc bị trình duyệt TỰ trả false khi tab ở nền hoặc người dùng đã bấm "chặn hộp thoại" (xem ghi chú _impAsk_ ở js/11) ⇒ thao tác "không xác nhận được" mà không ai biết.
//    Các chỗ confirm()/prompt() cũ được chuyển dần sang uiConfirm bằng tools/convert-confirm.js; prompt() GIỮ NGUYÊN (cần ô nhập, làm riêng).
//  - Công tắc lui về cũ KHÔNG cần deploy: gõ localStorage.setItem('ome_native_alert','1') rồi F5 → dùng lại alert gốc.
//  - Chưa có <body> (script chạy quá sớm) hoặc lỗi gì → tự rơi về alert gốc, không bao giờ làm mất thông báo.
// ════════════════════════════════════════════════════════════════════
(function(){
  if (typeof window === 'undefined' || window.__uiDialogs) return;
  window.__uiDialogs = 1;
  var nativeAlert = window.alert ? window.alert.bind(window) : function(){};
  var nativeConfirm = window.confirm ? window.confirm.bind(window) : function(){ return false; };
  window.nativeAlert = nativeAlert;
  var queue = [], showing = false, lastFocus = null;
  function off(){ try { return localStorage.getItem('ome_native_alert') === '1'; } catch(e){ return false; } }
  function tone(msg){
    var s = String(msg).trim().toLowerCase();
    if (/^(✓|✔|đã |thành công|xong)/.test(s)) return { icon: '✓', cls: 'ok' };
    if (/^(lỗi|⚠|✗|✕|thất bại|xuất thất bại|không (thể|được|tìm|lưu|tải)|chưa (kết nối|có|chọn|nhập|đăng)|sai |thiếu )/.test(s) || /lỗi|thất bại/.test(s)) return { icon: '⚠', cls: 'warn' };
    return { icon: 'ℹ', cls: 'info' };
  }
  function css(){
    if (document.getElementById('ui-dlg-css')) return;
    var st = document.createElement('style'); st.id = 'ui-dlg-css';
    st.textContent =
      '.ui-dlg-ov{position:fixed;inset:0;background:var(--ui-scrim,rgba(20,10,20,.45));display:flex;align-items:center;justify-content:center;z-index:2147483000;padding:16px;animation:uiDlgFade .12s ease-out}' +
      '.ui-dlg{background:var(--ui-bg,#fff);color:var(--ui-text,#2a2230);border:1px solid var(--ui-border,#e6dde6);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.28);width:min(440px,100%);max-height:80vh;display:flex;flex-direction:column;font-family:var(--ui-font,inherit)}' +
      '.ui-dlg-body{display:flex;gap:12px;padding:18px 18px 8px;overflow:auto}' +
      '.ui-dlg-ic{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;background:var(--ui-info,#2f6fd0)}' +
      '.ui-dlg.ok .ui-dlg-ic{background:var(--ui-success,#2e9d57)}.ui-dlg.warn .ui-dlg-ic{background:var(--ui-warning,#d98a00)}' +
      '.ui-dlg-msg{flex:1;min-width:0;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word;padding-top:3px}' +
      '.ui-dlg-msg a{color:var(--ui-link,#1a56b0);text-decoration:underline}' +
      '.ui-dlg-ft{display:flex;justify-content:flex-end;padding:8px 18px 16px}' +
      '.ui-dlg-btn{border:0;border-radius:9px;padding:8px 22px;font-size:14px;font-weight:600;cursor:pointer;color:var(--ui-on-brand,#fff);background:var(--ui-brand,#b8336a)}' +
      '.ui-dlg-btn.ghost{background:transparent;color:var(--ui-text,#2a2230);border:1px solid var(--ui-border,#cfc3cf);margin-right:8px}.ui-dlg-btn.danger{background:var(--ui-danger,#c0392b)}' +
      '.ui-dlg-btn:focus{outline:2px solid var(--ui-brand,#b8336a);outline-offset:2px}' +
      '@keyframes uiDlgFade{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.ui-dlg-ov{animation:none}}';
    (document.head || document.body).appendChild(st);
  }
  function fill(el, text){   // chữ thường + link http(s) bấm được; dựng bằng DOM (không innerHTML) nên không thể chèn HTML từ nội dung
    var re = /https?:\/\/[^\s<>"']+/g, last = 0, m;
    while ((m = re.exec(text))){
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var url = m[0].replace(/[.,;:!?)\]]+$/, ''), a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url; el.appendChild(a);
      last = m.index + url.length; re.lastIndex = last;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }
  function next(){
    if (showing || !queue.length) return;
    var item = queue.shift(); showing = true;
    var isC = item.kind === 'confirm';
    try {
      css();
      lastFocus = document.activeElement;
      var t = isC ? { icon: '?', cls: item.danger ? 'warn' : 'info' } : tone(item.msg), ov = document.createElement('div'); ov.className = 'ui-dlg-ov';
      var box = document.createElement('div'); box.className = 'ui-dlg ' + t.cls; box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-modal', 'true');
      var body = document.createElement('div'); body.className = 'ui-dlg-body';
      var ic = document.createElement('div'); ic.className = 'ui-dlg-ic'; ic.textContent = t.icon; ic.setAttribute('aria-hidden', 'true');
      var msg = document.createElement('div'); msg.className = 'ui-dlg-msg'; fill(msg, item.msg);
      body.appendChild(ic); body.appendChild(msg);
      var ft = document.createElement('div'); ft.className = 'ui-dlg-ft';
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ui-dlg-btn' + (isC && item.danger ? ' danger' : ''); btn.textContent = isC ? (item.ok || 'Đồng ý') : 'Đóng';
      var btnNo = null;
      if (isC){ btnNo = document.createElement('button'); btnNo.type = 'button'; btnNo.className = 'ui-dlg-btn ghost'; btnNo.textContent = item.cancel || 'Hủy'; ft.appendChild(btnNo); }
      ft.appendChild(btn);
      box.appendChild(body); box.appendChild(ft); ov.appendChild(box); document.body.appendChild(ov);
      var done = false;
      var close = function(result){
        if (done) return; done = true;
        document.removeEventListener('keydown', onKey, true);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch(e){}
        showing = false; item.resolve(isC ? result === true : undefined); next();
      };
      var onKey = function(ev){ if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(false); } else if (ev.key === 'Enter'){ ev.preventDefault(); ev.stopPropagation(); close(isC ? (document.activeElement === btnNo ? false : true) : undefined); } };
      document.addEventListener('keydown', onKey, true);
      btn.addEventListener('click', function(){ close(true); });
      if (btnNo) btnNo.addEventListener('click', function(){ close(false); });
      ov.addEventListener('mousedown', function(ev){ if (ev.target === ov) close(false); });
      (isC && item.danger && btnNo ? btnNo : btn).focus();   // việc nguy hiểm (xóa…): mặc định đặt tiêu điểm ở Hủy → lỡ bấm Enter cũng không xóa nhầm
    } catch(e){   // lỗi dựng hộp → không mất thông báo / không mất câu hỏi
      showing = false; var fb = false; try { if (isC) fb = nativeConfirm(item.msg); else nativeAlert(item.msg); } catch(e2){} item.resolve(isC ? !!fb : undefined); next();
    }
  }
  function uiAlert(msg){
    var text = (msg === undefined || msg === null) ? '' : String(msg);
    if (off() || typeof document === 'undefined' || !document.body){ try { nativeAlert(text); } catch(e){} return Promise.resolve(); }
    return new Promise(function(resolve){ queue.push({ msg: text, resolve: resolve }); next(); });
  }
  function uiConfirm(msg, opts){
    opts = opts || {};
    var text = (msg === undefined || msg === null) ? '' : String(msg);
    var danger = opts.danger !== undefined ? !!opts.danger : /^\s*(xóa|xoá|xóa hết|gỡ|hủy bỏ|ghi đè|ép )/i.test(text);
    if (off() || typeof document === 'undefined' || !document.body){ var r = false; try { r = !!nativeConfirm(text); } catch(e){} return Promise.resolve(r); }
    return new Promise(function(resolve){ queue.push({ kind: 'confirm', msg: text, ok: opts.ok, cancel: opts.cancel, danger: danger, resolve: resolve }); next(); });
  }
  window.uiAlert = uiAlert;
  window.uiConfirm = uiConfirm;
  window.alert = function(msg){ uiAlert(msg); };
})();

// ═══════════════════════════════════════════════════════
//  📋 NHẮC QUY TRÌNH CHAT (2026-10-25, GAS v13.60-coach) — thẻ ở Social > Chat (sc) và tab Chat trong hồ sơ khách (pkc)
//  Hỏi GAS `chatCoach?conv=<page>_<psid>` (xem docs/NHAC-QUY-TRINH-CHAT.md): backend quét 150 tin gần nhất của hội thoại, đối chiếu quy trình trong sheet "Kịch bản Chatpage"
//  (gửi ảnh + ghi âm, báo giá kèm CTKM, size tay, xác nhận đơn, theo sát…) rồi trả các việc QUÁ HẠN + câu mẫu. Thẻ chỉ hiện khi có gì đó để nhắc / đang đúng quy trình.
//  Lỗi mạng / chưa đăng nhập / GAS cũ chưa có action → thẻ ẨN im lặng (không làm phiền việc chat). Nút "Chèn câu mẫu" thêm vào ô soạn tin, KHÔNG tự gửi.
// ═══════════════════════════════════════════════════════
var _pkCoach = { res: {}, sig: {}, at: {}, busy: {}, shown: {}, collapsed: false };
try { _pkCoach.collapsed = localStorage.getItem('ome_coach_collapsed') === '1'; } catch (e) {}
var PK_COACH_REFRESH_MS = 60000;   // quá hạn phụ thuộc thời gian trôi: hỏi lại sau tối đa 60 giây dù chưa có tin mới
var PK_COACH_MIN_GAP_MS = 4000;
var _PK_COACH_INPUT = { pkc: 'pkc-input', sc: 'sc-input' };
function _pkCoachEsc(s) { return (typeof _pkcEsc === 'function') ? _pkcEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
// pre = 'pkc' | 'sc'; convId = hội thoại đang mở; msgsMap = { id: message } đang tải (để biết khi nào có tin mới)
function pkCoachSync(pre, convId, msgsMap) {
  var box = document.getElementById(pre + '-coach'); if (!box) return;
  if (!convId || (typeof gsUrl === 'undefined') || !gsUrl) { box.innerHTML = ''; return; }
  var ids = Object.keys(msgsMap || {}), last = '';
  ids.forEach(function (k) { var a = String((msgsMap[k] && msgsMap[k].at) || ''); if (a > last) last = a; });
  var sig = convId + '|' + ids.length + '|' + last, key = pre + ':' + convId;
  _pkCoach.shown[pre] = convId;
  if (_pkCoach.res[key]) pkCoachRender(pre, convId);   // có kết quả cũ: hiện ngay, lát cập nhật
  else box.innerHTML = '';
  var age = Date.now() - (_pkCoach.at[key] || 0);
  if (_pkCoach.busy[key] || age < PK_COACH_MIN_GAP_MS) return;
  if (_pkCoach.sig[key] === sig && age < PK_COACH_REFRESH_MS) return;
  _pkCoach.busy[key] = true;
  (async function () {
    try {
      var r = await fetch(_pkcUrl('action=chatCoach&conv=' + encodeURIComponent(convId)), { redirect: 'follow' });
      var j = await r.json();
      _pkCoach.at[key] = Date.now(); _pkCoach.sig[key] = sig;
      if (!j || j.ok === false || j.error || j.found === false) { delete _pkCoach.res[key]; }
      else _pkCoach.res[key] = j;
    } catch (e) { _pkCoach.at[key] = Date.now(); delete _pkCoach.res[key]; }
    finally { _pkCoach.busy[key] = false; }
    if (_pkCoach.shown[pre] === convId) pkCoachRender(pre, convId);   // bỏ qua nếu đã chuyển hội thoại khác trong lúc chờ
  })();
}
function pkCoachRender(pre, convId) {
  var box = document.getElementById(pre + '-coach'); if (!box) return;
  var j = _pkCoach.res[pre + ':' + convId];
  if (!j) { box.innerHTML = ''; return; }
  var due = j.reminders || [], doneN = j.doneCount || 0, pend = j.pendingCount || 0;
  if (!due.length && !doneN && !pend) { box.innerHTML = ''; return; }   // chưa có gì áp dụng → không hiện
  var STATE = { done: ['✓', 'đã làm'], due: ['⚠', 'cần làm'], pending: ['⏳', 'đang chờ'], na: ['', ''] };
  var chips = (j.steps || []).filter(function (s) { return s.state !== 'na'; }).map(function (s) {
    return '<span class="coach-st ' + _pkCoachEsc(s.state) + '" title="Bước ' + s.n + ' — ' + _pkCoachEsc((STATE[s.state] || [])[1] || '') + '">' + (STATE[s.state] ? STATE[s.state][0] + ' ' : '') + _pkCoachEsc(s.name) + '</span>';
  }).join('');
  var badge = due.length ? '<span class="coach-badge due">' + due.length + ' việc cần làm</span>' : '<span class="coach-badge ok">✓ Đang đi đúng quy trình</span>';
  var items = due.map(function (r, i) {
    return '<div class="coach-item"><div class="coach-t"><b>' + _pkCoachEsc(r.title) + '</b> <span class="coach-s">Bước ' + (r.step || '') + (r.ageMin ? ' · ' + r.ageMin + ' phút trước' : '') + '</span></div>' +
      '<div class="coach-say">' + _pkCoachEsc(r.say) + '</div>' +
      (r.script ? '<div class="coach-sc">“' + _pkCoachEsc(r.script) + '”</div><button class="btn sm" type="button" onclick="pkCoachInsert(\'' + pre + '\',' + i + ')">✍️ Chèn câu mẫu</button>' : '') + '</div>';
  }).join('');
  box.innerHTML = '<div class="coach-card' + (_pkCoach.collapsed ? ' collapsed' : '') + '"><div class="coach-h" onclick="pkCoachToggle(\'' + pre + '\')">📋 Nhắc quy trình ' + badge +
    '<span class="coach-chev">' + (_pkCoach.collapsed ? '▸' : '▾') + '</span></div>' +
    (_pkCoach.collapsed ? '' : '<div class="coach-steps">' + chips + '</div>' + items) + '</div>';
}
function pkCoachToggle(pre) {
  _pkCoach.collapsed = !_pkCoach.collapsed; try { localStorage.setItem('ome_coach_collapsed', _pkCoach.collapsed ? '1' : '0'); } catch (e) {}
  ['pkc', 'sc'].forEach(function (p) { if (_pkCoach.shown[p]) pkCoachRender(p, _pkCoach.shown[p]); });
}
function pkCoachInsert(pre, idx) {
  var conv = _pkCoach.shown[pre], j = _pkCoach.res[pre + ':' + conv], r = j && (j.reminders || [])[idx]; if (!r || !r.script) return;
  var ta = document.getElementById(_PK_COACH_INPUT[pre]); if (!ta) return;
  ta.value = ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' + r.script : r.script;   // thêm vào sau nội dung đang soạn (không ghi đè, không tự gửi)
  try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e2) {}
  if (typeof toast === 'function') toast('Đã chèn câu mẫu — chỉnh [Giá]/[Tên]… rồi gửi');
}

// ═══════════════════════════════════════════════════════
//  P2c — KẾT QUẢ khi bấm "✓ Xong" trên việc chăm sóc THEO MỐC (lịch CS tự động autoDao)
//  Hỏi: Đã liên hệ / Không nghe máy / Từ chối / Hẹn lại. Ghi Nhật ký (logAudit) + bản ghi
//  'ome_fu_results' (làm nền cho báo cáo đúng hạn/trễ ở 2e). Hẹn lại = tạo việc mới ở ngày chọn.
//  Lịch tự đặt tay (không autoDao) giữ nguyên cách cũ: bấm Xong là xong.
// ═══════════════════════════════════════════════════════
var _FU_RESULTS = [
  { k:'contacted', t:'✅ Đã liên hệ' },
  { k:'nopick',    t:'📵 Không nghe máy' },
  { k:'refused',   t:'❌ Từ chối' },
  { k:'resched',   t:'🔁 Hẹn lại' }
];
var _fuMarkDoneOrig = markDone;
markDone = function(id){
  var it = (typeof schedules !== 'undefined' ? schedules : []).find(function(x){ return x.id === id; });
  if (!it || !it.autoDao) return _fuMarkDoneOrig(id);
  _fuResultAsk(it);
};
function _fuResultAsk(it){
  var old = document.getElementById('fu-result-ov'); if (old) old.remove();
  var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  var ov = document.createElement('div');
  ov.id = 'fu-result-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3000;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:16px 18px;width:min(380px,92vw);box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
    '<div style="font-weight:600;margin-bottom:4px">Kết quả chăm sóc</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">' + esc(it.phone) + ' · ' + esc(it.note || '') + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    _FU_RESULTS.map(function(r){ return '<button class="btn sm" data-k="' + r.k + '" style="padding:9px">' + r.t + '</button>'; }).join('') + '</div>' +
    '<div id="fu-res-redo" style="display:none;margin-top:10px;font-size:12px">Hẹn lại ngày: <input type="date" id="fu-res-date" value="' + _ymd(tomorrow) + '" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px"> ' +
    '<button class="btn sm primary" id="fu-res-ok">Xác nhận</button></div>' +
    '<div style="text-align:right;margin-top:10px"><button class="btn sm" id="fu-res-cancel">Huỷ</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
  ov.querySelector('#fu-res-cancel').onclick = function(){ ov.remove(); };
  [].forEach.call(ov.querySelectorAll('button[data-k]'), function(b){
    b.onclick = function(){
      var k = b.getAttribute('data-k');
      if (k === 'resched') { ov.querySelector('#fu-res-redo').style.display = 'block'; return; }
      _fuResultDone(it, k, '');
    };
  });
  ov.querySelector('#fu-res-ok').onclick = function(){
    var d = ov.querySelector('#fu-res-date').value;
    if (!d || d < _ymd(new Date())) { if (typeof toast === 'function') toast('Chọn ngày hẹn lại từ hôm nay trở đi'); return; }
    _fuResultDone(it, 'resched', d);
  };
}
function _fuResultDone(it, k, newDate){
  var label = _FU_RESULTS.filter(function(r){ return r.k === k; })[0].t.replace(/^\S+\s/, '');
  try {
    var logs = loadLS('ome_fu_results') || [];
    logs.push({ id: it.id, phone: it.phone, due: it.date, doneAt: new Date().toISOString(), result: k,
                by: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '', note: it.note || '', redo: newDate || '' });
    if (logs.length > 3000) logs = logs.slice(-3000);
    saveLS('ome_fu_results', logs);
  } catch(e){}
  try { logAudit('sched', it.phone, it.note || '', 'Kết quả: ' + label + (newDate ? ' → ' + newDate : '')); } catch(e){}
  if (k === 'resched' && newDate) {
    schedules.push(Object.assign({
      id: 'redo_' + it.phone + '_' + Date.now(), phone: it.phone, type: 'cs', date: newDate,
      note: 'Hẹn lại · ' + (it.note || ''), done: false
    }, (typeof _remOwnerStamp === 'function' ? _remOwnerStamp() : {})));
    saveLS('ome_sched', schedules);
  }
  var ov = document.getElementById('fu-result-ov'); if (ov) ov.remove();
  _fuMarkDoneOrig(it.id);
  if (k === 'resched' && typeof renderScheduleTab === 'function') { renderScheduleTab(); if (typeof renderOverdueTab === 'function') renderOverdueTab(); if (typeof updateSchedBadges === 'function') updateSchedBadges(); }
}

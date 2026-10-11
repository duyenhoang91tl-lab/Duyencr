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
// ── P2d: tin gợi ý từ MẪU hỏi thăm cho SALE duyệt/sửa rồi tự gửi (KHÔNG tự gửi) ──
var _fuTplCache = null;
async function _fuLoadTpls(){
  if (_fuTplCache) return _fuTplCache;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=followUpTemplates', { redirect:'follow' });
    _fuTplCache = ((await r.json()) || {}).list || [];
  } catch(e) { _fuTplCache = []; }
  return _fuTplCache;
}
// Số ngày của mốc suy ra từ id việc: dao_<sđt>_<ngày đơn>_<7|14|0|m1|m2>
function _fuDaysOfSched(it){
  var m = String(it.id || '').match(/_(m?\d+)$/); if (!m) return null;
  return m[1] === 'm1' ? 30 : m[1] === 'm2' ? 60 : parseInt(m[1], 10);
}
// Chọn mẫu: cùng số ngày; mẫu riêng của CS phụ trách > mẫu chung; mã SP khớp > '*'. Mẫu của CS khác bị loại.
function _fuPickTpl(list, days, csOwn, productText){
  var best = null, bs = -1, pt = (typeof _foldVi === 'function' ? _foldVi(String(productText || '')) : String(productText || '')).toUpperCase();
  (list || []).forEach(function(t){
    if (parseInt(t.days, 10) !== days || !String(t.template || '').trim()) return;
    var tcs = String(t.cs || '').toLowerCase();
    if (tcs && tcs !== csOwn) return;
    var codes = String(t.productCode || '*').toUpperCase().split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    var codeHit = codes.some(function(c){ return c !== '*' && pt.indexOf(c) !== -1; });
    var star = codes.indexOf('*') !== -1 || !codes.length;
    if (!codeHit && !star) return;
    var sc = (tcs ? 2 : 0) + (codeHit ? 1 : 0);
    if (sc > bs) { bs = sc; best = t; }
  });
  return best;
}
function _fuRender(tpl, ctx){
  return String(tpl).replace(/\{name\}/g, ctx.name || 'bạn').replace(/\{phone\}/g, ctx.phone || '')
    .replace(/\{days\}/g, String(ctx.days != null ? ctx.days : '')).replace(/\{product\}/g, ctx.product || '');
}
async function _fuFillSuggest(it, ov){
  var box = ov.querySelector('#fu-sug'); if (!box || typeof gsUrl === 'undefined' || !gsUrl) return;
  var days = _fuDaysOfSched(it); if (days == null) return;
  var c = (typeof customerMap !== 'undefined' && customerMap) ? customerMap[it.phone] : null;
  var care = (typeof careData !== 'undefined' && careData && careData[it.phone]) || {};
  var last = c && c.orders && c.orders.length ? c.orders[c.orders.length - 1] : null;
  var product = last ? ((last.product || '') + ' ' + (last.productDetail || '')).trim() : '';
  var list = await _fuLoadTpls();
  if (!document.body.contains(ov)) return;
  var t = _fuPickTpl(list, days, String(care.cs || '').toLowerCase(), product);
  if (!t) { box.innerHTML = '<div style="font-size:11px;color:var(--muted)">Chưa có mẫu tin cho mốc ' + days + ' ngày (thêm ở "Mẫu tin hỏi thăm tự động").</div>'; return; }
  var msg = _fuRender(t.template, { name: c ? c.name : '', phone: it.phone, days: days, product: product });
  box.innerHTML = '<div style="font-size:12px;font-weight:600;margin-bottom:4px">💬 Tin gợi ý (sửa được, bạn tự gửi)</div>' +
    '<textarea id="fu-sug-ta" rows="4" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:inherit;resize:vertical">' + esc(msg) + '</textarea>' +
    '<div style="display:flex;gap:8px;margin-top:6px"><button class="btn sm" id="fu-sug-copy">📋 Sao chép</button>' +
    '<a class="btn sm" target="_blank" rel="noopener" href="https://zalo.me/' + encodeURIComponent(it.phone) + '" style="text-decoration:none">💬 Mở Zalo</a></div>';
  ov.querySelector('#fu-sug-copy').onclick = function(){
    var v = ov.querySelector('#fu-sug-ta').value;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function(){ if (typeof toast === 'function') toast('✓ Đã sao chép tin'); },
      function(){ var ta = ov.querySelector('#fu-sug-ta'); ta.select(); try { document.execCommand('copy'); } catch(e){} });
  };
}
function _fuResultAsk(it){
  var old = document.getElementById('fu-result-ov'); if (old) old.remove();
  var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  var ov = document.createElement('div');
  ov.id = 'fu-result-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3000;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:16px 18px;width:min(380px,92vw);box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
    '<div id="fu-sug" style="margin-bottom:12px"></div>' +
    '<div style="font-weight:600;margin-bottom:4px">Kết quả chăm sóc</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">' + esc(it.phone) + ' · ' + esc(it.note || '') + '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    _FU_RESULTS.map(function(r){ return '<button class="btn sm" data-k="' + r.k + '" style="padding:9px">' + r.t + '</button>'; }).join('') + '</div>' +
    '<div id="fu-res-redo" style="display:none;margin-top:10px;font-size:12px">Hẹn lại ngày: <input type="date" id="fu-res-date" value="' + _ymd(tomorrow) + '" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px"> ' +
    '<button class="btn sm primary" id="fu-res-ok">Xác nhận</button></div>' +
    '<div style="text-align:right;margin-top:10px"><button class="btn sm" id="fu-res-cancel">Huỷ</button></div></div>';
  document.body.appendChild(ov);
  _fuFillSuggest(it, ov);
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
    var entry = { id: it.id, phone: it.phone, due: it.date, doneAt: new Date().toISOString(), result: k,
                by: (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '', note: it.note || '', redo: newDate || '' };
    logs.push(entry);
    _fuQueueResult(entry);
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

// Nút 💬 trên dòng việc: mở cùng hộp (tin gợi ý + chọn kết quả) mà chưa đóng việc
function _fuSuggestOpen(id){
  var it = (typeof schedules !== 'undefined' ? schedules : []).find(function(x){ return x.id === id; });
  if (it) _fuResultAsk(it);
}

// ── P2e: đẩy kết quả lên server (Supabase fu_results / sheet FuResults) + báo cáo đúng hạn/trễ ──
function _fuQueueResult(entry){
  try { var q = loadLS('ome_fu_pending') || []; q.push(entry); saveLS('ome_fu_pending', q.slice(-500)); } catch(e){}
  _fuFlushResults();
}
async function _fuFlushResults(){
  if (typeof gsUrl === 'undefined' || !gsUrl || _fuFlushResults._busy) return;
  var q = loadLS('ome_fu_pending') || []; if (!q.length) return;
  _fuFlushResults._busy = true;
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'saveFuResults', results: q.slice(0, 200) }) });
    var j = await r.json();
    if (j && j.ok) { var left = (loadLS('ome_fu_pending') || []).filter(function(x){ return q.slice(0,200).every(function(y){ return y.id !== x.id; }); }); saveLS('ome_fu_pending', left); }
  } catch(e) { console.warn('_fuFlushResults', e); }
  _fuFlushResults._busy = false;
}
setTimeout(_fuFlushResults, 4000);   // thử gửi lại các kết quả còn tồn (lần trước mất mạng)

function _fuVnDay(iso){ var t = new Date(iso).getTime(); return isNaN(t) ? '' : new Date(t + 7*3600*1000).toISOString().slice(0,10); }
function _fuRange(preset){
  var n = new Date(Date.now() + 7*3600*1000), y = n.getUTCFullYear(), m = n.getUTCMonth(), d = n.getUTCDate(), dow = (n.getUTCDay() + 6) % 7;
  function iso(dt){ return dt.toISOString().slice(0,10); }
  function U(yy,mm,dd){ return new Date(Date.UTC(yy,mm,dd)); }
  var today = U(y,m,d);
  switch (preset) {
    case 'yesterday': var yd = U(y,m,d-1); return [iso(yd), iso(yd)];
    case 'week': return [iso(U(y,m,d-dow)), iso(today)];
    case 'lastweek': return [iso(U(y,m,d-dow-7)), iso(U(y,m,d-dow-1))];
    case 'month': return [iso(U(y,m,1)), iso(today)];
    case 'lastmonth': return [iso(U(y,m-1,1)), iso(U(y,m,0))];
    case 'quarter': return [iso(U(y,Math.floor(m/3)*3,1)), iso(today)];
    case 'year': return [iso(U(y,0,1)), iso(today)];
    default: return [iso(today), iso(today)];
  }
}
async function openFuReport(){
  var old = document.getElementById('fu-report-ov'); if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'fu-report-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3000;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:16px 18px;width:min(760px,95vw);max-height:88vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px"><b style="flex:1">📞 Báo cáo chăm sóc theo mốc</b>' +
    '<select id="fu-rp-preset" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px">' +
    '<option value="today">Hôm nay</option><option value="yesterday">Hôm qua</option><option value="week" selected>Tuần này</option><option value="lastweek">Tuần trước</option>' +
    '<option value="month">Tháng này</option><option value="lastmonth">Tháng trước</option><option value="quarter">Quý này</option><option value="year">Năm nay</option></select>' +
    '<button class="btn sm" id="fu-rp-close">Đóng</button></div>' +
    '<div id="fu-rp-body" style="font-size:12px">Đang tải...</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
  ov.querySelector('#fu-rp-close').onclick = function(){ ov.remove(); };
  var sel = ov.querySelector('#fu-rp-preset');
  sel.onchange = function(){ _fuReportLoad(sel.value); };
  _fuReportLoad(sel.value);
}
async function _fuReportLoad(preset){
  var body = document.getElementById('fu-rp-body'); if (!body) return;
  body.textContent = 'Đang tải...';
  var rg = _fuRange(preset), rows = [];
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var j = await (await fetch(gsUrl + sep + 'action=fuResults&from=' + rg[0] + '&to=' + rg[1], { redirect:'follow' })).json();
    if (j && j.error) { body.textContent = j.error; return; }
    rows = (j && j.results) || [];
  } catch(e) { body.textContent = 'Lỗi tải: ' + e.message; return; }
  var admin = (typeof _fuIsAdmin === 'function') ? _fuIsAdmin() : false;
  var me = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '';
  if (!admin) rows = rows.filter(function(r){ return r.byUser === me; });
  var by = {};
  rows.forEach(function(r){
    var u = r.byUser || '(không rõ)', o = by[u] || (by[u] = { n:0, ontime:0, late:0, contacted:0, nopick:0, refused:0, resched:0 });
    o.n++; o[r.result] = (o[r.result] || 0) + 1;
    var dd = _fuVnDay(r.doneAt); if (dd && r.due) { if (dd <= r.due) o.ontime++; else o.late++; }
  });
  var names = Object.keys(by).sort(function(a,b){ return by[b].n - by[a].n; });
  if (!names.length) { body.innerHTML = '<div style="color:var(--muted)">Chưa có kết quả nào trong kỳ ' + rg[0] + ' → ' + rg[1] + ' (tính theo ngày đến hạn của việc).</div>'; return; }
  var tot = { n:0, ontime:0, late:0, contacted:0, nopick:0, refused:0, resched:0 };
  var tr = names.map(function(u){ var o = by[u]; Object.keys(tot).forEach(function(k){ tot[k] += o[k] || 0; });
    return '<tr><td>' + esc(u) + '</td><td>' + o.n + '</td><td style="color:var(--green)">' + o.ontime + '</td><td style="color:var(--red)">' + o.late + '</td><td>' + (o.contacted||0) + '</td><td>' + (o.nopick||0) + '</td><td>' + (o.refused||0) + '</td><td>' + (o.resched||0) + '</td></tr>'; }).join('');
  body.innerHTML = '<div style="color:var(--muted);margin-bottom:6px">Kỳ ' + rg[0] + ' → ' + rg[1] + ' (theo ngày đến hạn) · "Đúng hạn" = bấm Xong trong ngày đến hạn hoặc sớm hơn. Việc bị bỏ qua (chưa bấm Xong) chưa tính ở đây.</div>' +
    '<table class="fu-rp" style="width:100%;border-collapse:collapse;text-align:center"><tr style="background:var(--surface2)"><th style="text-align:left;padding:5px">Người làm</th><th>Đã xong</th><th>Đúng hạn</th><th>Trễ</th><th>Đã liên hệ</th><th>Không nghe</th><th>Từ chối</th><th>Hẹn lại</th></tr>' +
    tr + '<tr style="font-weight:700;border-top:1px solid var(--border)"><td style="text-align:left;padding:5px">Tổng</td><td>' + tot.n + '</td><td>' + tot.ontime + '</td><td>' + tot.late + '</td><td>' + tot.contacted + '</td><td>' + tot.nopick + '</td><td>' + tot.refused + '</td><td>' + tot.resched + '</td></tr></table>' +
    '<style>.fu-rp td,.fu-rp th{padding:5px;border-bottom:1px solid var(--border)}.fu-rp td:first-child{text-align:left}</style>';
}

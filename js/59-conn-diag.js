// ═══════════════════════════════════════════════════════
//  CHẨN ĐOÁN KẾT NỐI (2026-10-26) — Duyên: app Android "Duyên CRM" báo lỗi + màn "Tải file Excel để bắt đầu" dù đã đăng nhập.
//  NGUYÊN NHÂN GỐC khó thấy lỗi: lỗi đồng bộ (showSyncErrorBanner) chỉ chèn vào #data-view, mà #data-view bị ẨN khi chưa có khách → người dùng chỉ thấy
//  màn trống, không thấy lý do. Nay (1) lỗi đồng bộ được phản chiếu NGAY TRÊN màn trống (#ev-neterr) kèm nút Thử lại / Chẩn đoán;
//  (2) mục menu "🩺 Chẩn đoán kết nối" (hoặc ?diag=1) đo trực tiếp từ máy đó: Worker so với Apps Script gọi thẳng, customers đầy đủ (thời gian, dung lượng,
//  JSON hợp lệ?, có báo lỗi?), trạng thái đăng nhập, số khách trong bộ nhớ, 12 request gần nhất → bấm Sao chép gửi cho mình.
// ═══════════════════════════════════════════════════════
var _gsNetLog = [];
(function () {
  var f = window.fetch; if (!f) return;
  window.fetch = function (u, o) {
    var url = typeof u === 'string' ? u : ((u && u.url) || '');
    if (typeof gsUrl === 'undefined' || !gsUrl || url.indexOf(gsUrl) !== 0) return f.apply(this, arguments);
    var t0 = Date.now(), act = (url.match(/[?&]action=([A-Za-z0-9_]+)/) || [])[1] || (((o && o.method) || 'GET') + ''), rec = { t: t0, a: act };
    _gsNetLog.push(rec); if (_gsNetLog.length > 40) _gsNetLog.shift();
    var self = this, args = arguments;
    return f.apply(self, args).then(function (r) {
      rec.ms = Date.now() - t0; rec.st = r.status; try { rec.cache = r.headers.get('x-crm-cache') || ''; } catch (e) {}
      if (_wkShouldFallback_(url, o, r.status)) return _wkRetryDirect_(f, self, url, o, rec, 'HTTP ' + r.status, r);
      return r;
    }, function (e) {
      rec.ms = Date.now() - t0; rec.err = String((e && e.message) || e);
      if (_wkShouldFallback_(url, o, 0)) return _wkRetryDirect_(f, self, url, o, rec, 'lỗi mạng', null, e);
      throw e;
    });
  };
})();

// TỰ LÙI VỀ APPS SCRIPT TRỰC TIẾP khi Worker cache lỗi (2026-10-27, bản quét app Duyên CRM trên Xiaomi/Android 16: Worker trả 502 cho orders/donPhones/cskhDuyenLite
// và 404 cho staffOverview/donPhones → danh sách khách rỗng, màn "chưa có dữ liệu"). NGUYÊN NHÂN GỐC: chỉ ĐĂNG NHẬP có đường dự phòng (js/14), còn mọi request dữ liệu
// đều đi Worker và không thử lại khi Worker lỗi. Nay: GET đọc-dữ-liệu qua Worker mà gặp 5xx/404/lỗi mạng → gọi lại đúng request đó THẲNG Apps Script; thành công thì
// các request sau trong phiên này đi thẳng luôn (KHÔNG ghi nhớ: Worker sống lại thì lần mở sau tự dùng lại). Không thử lại POST và các action ghi (tránh ghi 2 lần).
var _wkFellBack = false;
function _wkShouldFallback_(url, o, st) {
  try {
    if (typeof WORKER_URL === 'undefined' || typeof GAS_URL_DIRECT === 'undefined' || !GAS_URL_DIRECT || gsUrl !== WORKER_URL || url.indexOf(WORKER_URL) !== 0) return false;
    if (o && (o._noFb || (o.method && String(o.method).toUpperCase() !== 'GET'))) return false;
    var act = (url.match(/[?&]action=([A-Za-z0-9_]+)/) || [])[1] || '';
    if (/^(save|add|delete|set|update|replace|broadcastMark|sync|import|merge|upload|remove|create|clear)/i.test(act)) return false;
    return st === 0 || st === 404 || st >= 500;
  } catch (e) { return false; }
}
function _wkRetryDirect_(f, self, url, o, rec, why, origRes, origErr) {
  var direct = GAS_URL_DIRECT + url.slice(WORKER_URL.length);
  if (!_wkFellBack) gsUrl = GAS_URL_DIRECT;   // đổi cả phiên để request sau khỏi qua Worker lỗi; chỉ khi thử lại thành công mới giữ (xem dưới)
  var prevUrl = WORKER_URL;
  return f.call(self, direct, o).then(function (r2) {
    if (r2.status >= 500 || r2.status === 404) { gsUrl = prevUrl; if (origRes) return origRes; throw origErr || new Error('HTTP ' + r2.status); }
    rec.fb = 1;
    if (!_wkFellBack) { _wkFellBack = true; try { if (typeof toast === 'function') toast('⚠ Worker cache đang lỗi (' + why + ') — tạm gọi thẳng Apps Script.'); } catch (e) {} }
    return r2;
  }, function (e2) { gsUrl = prevUrl; if (origRes) return origRes; throw origErr || e2; });
}

function _cdFmtLog() {
  return _gsNetLog.slice(-12).map(function (r) {
    var when = new Date(r.t).toTimeString().slice(0, 8);
    return '  ' + when + ' ' + r.a + ' → ' + (r.err ? 'LỖI MẠNG: ' + r.err : ('HTTP ' + r.st + (r.cache ? ' (' + r.cache + ')' : ''))) + (r.fb ? ' [đã thử lại thẳng Apps Script]' : '') + (r.ms != null ? ' · ' + r.ms + 'ms' : ' · đang chờ…');
  }).join('\n') || '  (chưa có request)';
}
function _cdState() {
  var L = [], tok = '', exp = 0;
  try { tok = localStorage.getItem('ome_sess_token') || ''; exp = Number(localStorage.getItem('ome_sess_exp') || 0); } catch (e) {}
  var acc = (typeof _authAccount !== 'undefined' && _authAccount) ? _authAccount : null;
  L.push('Giờ: ' + new Date().toString().slice(0, 33) + ' · online=' + navigator.onLine);
  try { var c = navigator.connection; if (c) L.push('Mạng: ' + (c.effectiveType || '?') + ' · ' + (c.downlink || '?') + 'Mbps · rtt ' + (c.rtt || '?') + 'ms' + (c.saveData ? ' · tiết kiệm dữ liệu BẬT' : '')); } catch (e) {}
  L.push('Trang: ' + location.origin + ' · ' + innerWidth + 'x' + innerHeight);
  L.push('Máy chủ dữ liệu: ' + (typeof gsUrl !== 'undefined' ? gsUrl : '(chưa có)') + (typeof WORKER_URL !== 'undefined' && gsUrl === WORKER_URL ? '  [qua Worker cache]' : '  [Apps Script trực tiếp]'));
  L.push('Đăng nhập: ' + (tok ? 'có token phiên' + (exp ? ' (hết hạn ' + new Date(exp).toLocaleString('vi-VN') + (exp < Date.now() ? ' — ĐÃ HẾT HẠN' : '') + ')' : '') : 'KHÔNG có token') + ' · tài khoản=' + (acc ? ((acc.username || '?') + '/' + (acc.role || '?')) : 'chưa'));
  try { L.push('Dữ liệu trong bộ nhớ: allCustomers=' + (allCustomers || []).length + ' · customerMap=' + Object.keys(customerMap || {}).length + ' · cskhData=' + (Array.isArray(cskhData) ? cskhData.length : Object.keys(cskhData || {}).length)); } catch (e) { L.push('Dữ liệu trong bộ nhớ: (không đọc được: ' + e.message + ')'); }
  try { L.push('Đồng bộ: số lần lỗi liên tiếp=' + _autoSyncFailCount + ' · careSince=' + (_careSince || '(chưa có → sẽ kéo FULL)') + ' · cskhFail=' + _cskhFailCount); } catch (e) {}
  var b = document.getElementById('sync-err-banner'); if (b) L.push('Thanh báo lỗi đồng bộ: ' + b.innerText.replace(/\s+/g, ' ').slice(0, 220));
  L.push('Request gần nhất:\n' + _cdFmtLog());
  return L.join('\n');
}
async function _cdTest(label, url, opts) {
  opts = opts || {}; var ctl = new AbortController(), t0 = Date.now(), tm = setTimeout(function () { ctl.abort(); }, opts.timeout || 45000);
  try {
    var r = await fetch(url, { redirect: 'follow', signal: ctl.signal, _noFb: true }), ms1 = Date.now() - t0, text = await r.text(), ms = Date.now() - t0, j = null, jerr = '';
    try { j = JSON.parse(text); } catch (e) { jerr = 'KHÔNG phải JSON (' + text.slice(0, 80).replace(/\s+/g, ' ') + '…)'; }
    var extra = j ? (j.error ? ' · BÁO LỖI: ' + j.error : (j.rows ? ' · rows=' + j.rows.length : '') + (j.ver ? ' · ver=' + j.ver : '') + (j.orders ? ' · orders=' + j.orders.length : '')) : ' · ' + jerr;
    var out = { ok: r.ok && !!j && !j.error, line: label + ': HTTP ' + r.status + ' · ' + ms + 'ms (có phản hồi sau ' + ms1 + 'ms) · ' + (text.length > 1048576 ? (text.length / 1048576).toFixed(1) + 'MB' : Math.round(text.length / 1024) + 'KB') + (r.headers.get('x-crm-cache') ? ' · cache=' + r.headers.get('x-crm-cache') : '') + extra };
    out.json = j; return out;
  } catch (e) { return { ok: false, line: label + ': LỖI MẠNG sau ' + (Date.now() - t0) + 'ms — ' + ((e && e.name === 'AbortError') ? 'QUÁ HẠN ' + ((opts.timeout || 45000) / 1000) + 's (không có phản hồi)' : (e && e.message || e)) }; }
  finally { clearTimeout(tm); }
}
async function _cdRun(deep, pre) {
  var out = [_cdState(), '', '══ ĐO TRỰC TIẾP TỪ MÁY NÀY ══'], sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
  function flush() { pre.textContent = out.join('\n'); }
  flush();
  var direct = (typeof GAS_URL_DIRECT !== 'undefined') ? GAS_URL_DIRECT : '', viaWorker = (typeof WORKER_URL !== 'undefined' && gsUrl === WORKER_URL);
  var t1 = await _cdTest('1) count qua ' + (viaWorker ? 'Worker' : 'máy chủ hiện tại'), gsUrl + sep + 'action=count&_=' + Date.now(), { timeout: 20000 }); out.push(t1.line); flush();
  var t2 = null;
  if (direct && gsUrl !== direct) { t2 = await _cdTest('2) count gọi THẲNG Apps Script', direct + '?action=count&src=web&_=' + Date.now(), { timeout: 30000 }); out.push(t2.line); flush(); }
  var t3 = await _cdTest('3) customers (đầy đủ) qua ' + (viaWorker ? 'Worker' : 'máy chủ hiện tại'), gsUrl + sep + 'action=customers', { timeout: 60000 }); out.push(t3.line); flush();
  var t4, t5;
  if (deep) {
    t4 = await _cdTest('4) cskhDuyenLite (nguồn ~134k SĐT)', gsUrl + sep + 'action=cskhDuyenLite', { timeout: 90000 }); out.push(t4.line); flush();
    t5 = await _cdTest('5) orders (đơn hàng)', gsUrl + sep + 'action=orders', { timeout: 90000 }); out.push(t5.line); flush();
  }
  out.push('', '══ GỢI Ý ══');
  var tips = [];
  if (!t1.ok && t2 && t2.ok) tips.push('Worker KHÔNG gọi được nhưng Apps Script gọi thẳng được → mạng/máy này đang chặn hoặc làm đứt kết nối tới Worker. Tạm thời: mở CRM với ?worker=0 (gọi thẳng Apps Script) rồi báo mình.');
  if (!t1.ok && (!t2 || !t2.ok)) tips.push('Cả Worker lẫn Apps Script đều không phản hồi → điện thoại đang không ra Internet được (Wi-Fi/4G yếu, bật chế độ tiết kiệm dữ liệu, VPN/DNS chặn) hoặc Google bị chặn.');
  if (t1.ok && !t3.ok) tips.push('count được nhưng customers thì không: ' + (t3.json && t3.json.error ? 'máy chủ báo lỗi "' + t3.json.error + '" (kiểm tra đăng nhập/quyền).' : 'phản hồi quá chậm/quá lớn hoặc bị cắt giữa chừng (xem thời gian & dung lượng ở trên).'));
  if (/KHÔNG có token/.test(out[0])) tips.push('Chưa có token đăng nhập trên máy này → đăng nhập lại.');
  if (/ĐÃ HẾT HẠN/.test(out[0])) tips.push('Phiên đăng nhập đã hết hạn → đăng nhập lại.');
  if (t1.ok && t3.ok && /allCustomers=0/.test(out[0])) tips.push('Máy chủ trả dữ liệu bình thường nhưng bộ nhớ trang vẫn 0 khách → lỗi xử lý phía trang (gửi nguyên báo cáo này cho mình).');
  if (!tips.length) tips.push('Các phép đo đều OK.');
  tips.forEach(function (t) { out.push('• ' + t); }); flush();
  return out.join('\n');
}
function openConnDiag() {
  var ov = document.getElementById('cd-overlay'); if (ov) ov.remove();
  ov = document.createElement('div'); ov.id = 'cd-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding-top:3vh';
  ov.innerHTML = '<div style="width:min(760px,96vw);max-height:92vh;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--text,#111);border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3)">' +
    '<div style="display:flex;gap:8px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border,#ddd)"><b>🩺 Chẩn đoán kết nối</b><span style="flex:1"></span>' +
    '<button type="button" class="btn secondary sm" id="cd-deep">Kiểm tra đầy đủ</button><button type="button" class="btn secondary sm" id="cd-copy">📋 Sao chép</button><button type="button" class="btn secondary sm" id="cd-x">✕</button></div>' +
    '<pre id="cd-pre" style="margin:0;padding:12px 14px;overflow:auto;font-size:11.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word">Đang đo…</pre></div>';
  document.body.appendChild(ov);
  var pre = ov.querySelector('#cd-pre'), busy = false;
  function go(deep) { if (busy) return; busy = true; _cdRun(deep, pre).then(function () { busy = false; }, function (e) { busy = false; pre.textContent += '\n\nLỖI CHẨN ĐOÁN: ' + (e && e.message || e); }); }
  ov.querySelector('#cd-x').onclick = function () { ov.remove(); };
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  ov.querySelector('#cd-deep').onclick = function () { go(true); };
  ov.querySelector('#cd-copy').onclick = function () {
    var t = pre.textContent, ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); ok = true; } } catch (e) {}
    if (!ok) { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok = true; } catch (e) {} ta.remove(); }
    if (typeof toast === 'function') toast(ok ? 'Đã sao chép báo cáo' : 'Không sao chép được — bôi đen & copy tay');
  };
  go(false);
}
// Lỗi đồng bộ phải THẤY ĐƯỢC ngay cả khi chưa có khách (màn "Tải file Excel…"): phản chiếu showSyncErrorBanner lên #empty-view.
function _evNetErr(msg) {
  var ev = document.getElementById('empty-view'); if (!ev) return;
  var vis = ev.offsetParent !== null || getComputedStyle(ev).display !== 'none'; if (!vis) return;
  var box = document.getElementById('ev-neterr');
  if (!box) { box = document.createElement('div'); box.id = 'ev-neterr'; box.style.cssText = 'margin:0 0 14px;padding:10px 12px;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:13px;max-width:520px;text-align:left'; ev.insertBefore(box, ev.firstChild); }
  box.innerHTML = '⚠ <b>Chưa tải được dữ liệu từ máy chủ</b> — đây KHÔNG phải “chưa có file”.<br>' + (msg ? esc(String(msg)) : 'Auto-sync thất bại.') +
    '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" onclick="syncFromGS({pullOrders:true,manual:true})">↻ Thử lại</button><button type="button" class="btn secondary sm" onclick="openConnDiag()">🩺 Chẩn đoán kết nối</button></div>';
}
(function () {
  var orig = window.showSyncErrorBanner;
  if (typeof orig === 'function') window.showSyncErrorBanner = function (msg) { try { orig.apply(this, arguments); } finally { try { _evNetErr(msg); } catch (e) {} } };
  window.addEventListener('load', function () { try { if (/[?&]diag=1/.test(location.search)) setTimeout(openConnDiag, 800); } catch (e) {} });
})();

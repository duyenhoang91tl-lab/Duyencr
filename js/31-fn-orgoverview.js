// ═══ TỔNG QUAN KẾT QUẢ KINH DOANH (màn hình đầu tiên) + HỒ SƠ NHÂN SỰ (v13.24) ═══
// Backend: GAS action=orgOverview (gas_v13.js → orgOverview_). Tab 'overview' = 🏠 Tổng quan; bấm menu ☰ bên trái để vào các màn chi tiết.
// Phạm vi XEM (lọc ở client, giống các báo cáo khác): admin = toàn công ty; manager = các phòng được gán (cột team của tài khoản, key phòng cách nhau dấu phẩy)
// + leader của các team thuộc phòng đó; leader = team của mình; CS = chỉ chính mình (hiện thẳng hồ sơ).
var _ov = { data: null, key: '', busy: false, dept: '', team: '', q: '', mem: {}, landed: false };
var _OV_RATING = {
  tot:       { label: 'Làm tốt',         bg: 'var(--green-bg)', fg: 'var(--green)', bd: 'var(--green-mid)' },
  trungbinh: { label: 'Trung bình',      bg: 'var(--tn-bg)',    fg: 'var(--tn)',    bd: 'var(--tn-b)' },
  kem:       { label: 'Cần cải thiện',   bg: 'var(--red-bg)',   fg: 'var(--red)',   bd: 'var(--red-b)' },
  chuadu:    { label: 'Chưa đủ dữ liệu', bg: 'var(--surface2)', fg: 'var(--muted)', bd: 'var(--border-md)' }
};
function _ovN(s){ return (typeof _vnNorm === 'function') ? _vnNorm(s) : String(s || '').trim().toLowerCase(); }
function _ovMoney(n){
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e9) return (Math.round(n / 1e7) / 100) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (Math.round(n / 1e5) / 10) + ' tr';
  return (typeof fmt === 'function' ? fmt(Math.round(n)) : String(Math.round(n))) + '₫';
}
function _ovChip(r){ var R = _OV_RATING[r] || _OV_RATING.chuadu; return '<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-weight:600;font-size:11.5px;white-space:nowrap;background:' + R.bg + ';color:' + R.fg + ';border:1px solid ' + R.bd + '">' + R.label + '</span>'; }
function _ovIsAdmin(){ try { return (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin) || (currentUser && currentUser.role === 'admin'); } catch (e) { return false; } }
function _ovMyNames(){ var u = currentUser || {}; return ((u.names && u.names.length) ? u.names : (u.name ? [u.name] : [])).map(_ovN); }

// ── Phạm vi xem theo vai trò ──
function _ovAgg(list, days){
  var a = { n: list.length, revenue: 0, orders: 0, failed: 0, target: 0, revT: 0, tt: 0, closeW: 0, tot: 0, trungbinh: 0, kem: 0, chuadu: 0 };
  list.forEach(function(p){
    a.revenue += p.revenue || 0; a.orders += p.orders || 0; a.failed += p.failedOrders || 0;
    if (p.target > 0) { a.target += p.target; a.revT += p.revenue || 0; }
    a.tt += p.tongTT || 0; if (p.tyLeChot !== null && p.tyLeChot !== undefined) a.closeW += p.tyLeChot * (p.tongTT || 0);
    a[p.rating] = (a[p.rating] || 0) + 1;
  });
  return { soNguoi: a.n, revenue: a.revenue, orders: a.orders, aov: a.orders ? Math.round(a.revenue / a.orders) : 0, ordersPerDay: Math.round(a.orders / days * 10) / 10,
    pct: a.target > 0 ? Math.round(a.revT / a.target * 1000) / 10 : null, tyLeChot: a.tt ? Math.round(a.closeW / a.tt * 10) / 10 : null,
    failed: a.failed, tot: a.tot, trungbinh: a.trungbinh, kem: a.kem, chuadu: a.chuadu };
}
function _ovScope(d){
  var role = (currentUser && currentUser.role) || 'cs', my = _ovMyNames();
  if (_ovIsAdmin()) return { mode: 'all', label: 'Toàn công ty', people: d.people, teams: d.teams, depts: d.depts, company: d.company };
  var people, teams, depts, label, mode = role;
  if (role === 'manager') {
    var keys = String(currentUser.team || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
    depts = d.depts.filter(function(x){ return keys.indexOf(x.key) !== -1; });
    teams = d.teams.filter(function(t){ return keys.indexOf(t.deptKey) !== -1; });
    var leaders = {}; teams.forEach(function(t){ if (t.leader) leaders[_ovN(t.leader)] = 1; });
    var tn0 = teams.map(function(t){ return t.name; });   // thành viên các team của phòng được xem dù bản thân chưa được gán phòng (vd người mới)
    people = d.people.filter(function(p){ return keys.indexOf(p.deptKey) !== -1 || leaders[_ovN(p.name)] || my.indexOf(_ovN(p.name)) !== -1 || (p.teams || []).some(function(x){ return tn0.indexOf(x) !== -1; }); });
    label = 'Phòng: ' + (depts.map(function(x){ return x.label; }).join(', ') || '(chưa gán phòng)');
  } else if (role === 'leader') {
    teams = d.teams.filter(function(t){ return my.indexOf(_ovN(t.leader)) !== -1 || t.name === currentUser.team; });
    var tn = teams.map(function(t){ return t.name; });
    people = d.people.filter(function(p){ return my.indexOf(_ovN(p.name)) !== -1 || (p.teams || []).some(function(x){ return tn.indexOf(x) !== -1; }); });
    depts = []; label = 'Team: ' + (tn.join(', ') || '(chưa có team)');
  } else {
    people = d.people.filter(function(p){ return my.indexOf(_ovN(p.name)) !== -1; }); teams = []; depts = []; label = 'Cá nhân'; mode = 'self';
  }
  return { mode: mode, label: label, people: people, teams: teams, depts: depts, company: _ovAgg(people, d.days) };
}
function _ovCanSee(name){ if (!_ov.data) return false; var s = _ovScope(_ov.data), k = _ovN(name); return s.people.some(function(p){ return _ovN(p.name) === k; }); }

// ── Tab + panel + tải dữ liệu ──
function _ovRange(kind){
  var now = new Date(), y = now.getFullYear(), m = now.getMonth(), f, t;
  if (kind === 'lastmonth') { f = new Date(y, m - 1, 1); t = new Date(y, m, 0); }
  else if (kind === 'week') { f = new Date(now.getTime() - 6 * 86400000); t = now; }
  else { f = new Date(y, m, 1); t = now; }
  var a = document.getElementById('ov-from'), b = document.getElementById('ov-to');
  if (a && b) { a.value = _ymd(f); b.value = _ymd(t); }
}
// Lọc nhanh đủ mốc (Hôm nay…Năm trước) dùng chung _pkQuickRange; chọn xong tự tải số liệu
function _ovQuick(key){
  var r = _pkQuickRange(key); if (!r) return;
  var a = document.getElementById('ov-from'), b = document.getElementById('ov-to');
  if (a && b){ a.value = r.from; b.value = r.to; _ovLoad(false); }
}
function _ovEnsurePanel(){
  var dv = document.getElementById('data-view'); if (!dv) return null;
  var p = document.getElementById('tab-overview');
  if (!p) {
    p = document.createElement('div'); p.id = 'tab-overview'; p.className = 'main'; p.style.cssText = 'display:none;flex:1;overflow:auto;flex-direction:column';
    p.innerHTML = '<div class="dash-wrap" id="overview-wrap"><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">' +
      '<div style="font-size:18px;font-weight:700;flex:1;min-width:220px">🏠 Tổng quan kết quả kinh doanh <span id="ov-scope" style="font-size:12px;font-weight:500;color:var(--muted)"></span></div>' +
      '<input type="date" id="ov-from" class="ymf-date"><span style="color:var(--muted)">→</span><input type="date" id="ov-to" class="ymf-date">' +
      '<button class="btn" onclick="_ovRange(\'week\');_ovLoad(false)">7 ngày</button>' + _quickRangeSelectHtml('custom', "_ovQuick(this.value)") + '' +
      '<button class="btn primary" onclick="_ovLoad(false)">Xem</button><button class="btn" onclick="_ovLoad(true)" title="Tính lại, bỏ kết quả lưu tạm 5 phút">↻</button></div>' +
      '<div id="ov-body" style="font-size:13px;color:var(--muted)">⏳ Đang tải…</div></div>';
    dv.appendChild(p); _ovRange('month');
    if (!document.getElementById('ov-style')) { var st = document.createElement('style'); st.id = 'ov-style';
      st.textContent = 'body.ov-mode .stats-row,body.ov-mode .sidebar,body.ov-mode .sidebar-backdrop,body.ov-mode #files-bar,body.ov-mode #sync-banner{display:none!important}' +
        '.ov-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:10px 14px;min-width:150px;flex:1}.ov-card .n{font-size:20px;font-weight:700;color:var(--text)}.ov-card .l{font-size:11.5px;color:var(--muted)}' +
        '.ov-dept{cursor:pointer}.ov-dept.on{outline:2px solid var(--blue)}.ov-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.ov-tbl th{text-align:left;padding:7px 8px;border-bottom:1px solid var(--border-md);white-space:nowrap}.ov-tbl td{padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top}.ov-tbl tr.ov-row{cursor:pointer}.ov-tbl tr.ov-row:hover{background:var(--surface2)}.ov-tbl tr.on{background:var(--blue-bg)}';
      document.head.appendChild(st); }
  }
  return p;
}
function _ovEnsureTab(){
  var bar = document.querySelector('#data-view .tabs'); if (!bar || document.querySelector('[data-bar-id="overview"]')) return;
  var d = document.createElement('div'); d.className = 'tab'; d.id = 'v9tab-overview'; d.setAttribute('data-bar-id', 'overview'); d.setAttribute('data-bar-home', '.tabs');
  d.setAttribute('onclick', "switchTab('overview',this)"); d.innerHTML = '🏠 Tổng quan'; bar.insertBefore(d, bar.firstChild);
}
async function _ovLoad(refresh){
  if (_ov.busy) return;
  var body = document.getElementById('ov-body'), from = (document.getElementById('ov-from') || {}).value, to = (document.getElementById('ov-to') || {}).value;
  if (!body || !from || !to) return;
  if (from > to) { toast('Khoảng ngày bị ngược'); return; }
  var key = from + '|' + to, hit = _ov.mem[key];
  if (!refresh && hit && Date.now() - hit.t < 300000) { _ov.data = hit.d; _ov.key = key; _ovRender(); return; }
  if (typeof gsUrl === 'undefined' || !gsUrl) { body.innerHTML = '<div style="color:var(--red)">Chưa kết nối Google Sheets (chưa có link GAS).</div>'; return; }
  _ov.busy = true; body.innerHTML = '⏳ Đang gom số liệu toàn công ty (lần đầu có thể mất 20–60 giây)…';
  var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null, timer = ac ? setTimeout(function(){ ac.abort(); }, 150000) : null;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=orgOverview&from=' + from + '&to=' + to + (refresh ? '&refresh=1' : ''), { redirect: 'follow', signal: ac ? ac.signal : undefined });
    var d = await r.json();
    if (!d || d.ok === false || d.error) throw new Error((d && d.error) || 'Không có dữ liệu trả về');
    if (d.deptList && d.deptList.length && typeof DEPT_LIST !== 'undefined') DEPT_LIST = d.deptList;
    _ov.data = d; _ov.key = key; _ov.mem[key] = { t: Date.now(), d: d }; _ov.dept = ''; _ov.team = ''; _ovRender();
  } catch (e) {
    var msg = e && e.name === 'AbortError' ? 'Quá thời gian chờ — thử lại hoặc chọn khoảng ngày ngắn hơn.' : String(e && e.message || e);
    body.innerHTML = '<div style="color:var(--red)">Không tải được tổng quan: ' + esc(msg) + '<br><span style="color:var(--muted)">Nếu báo “Unknown action”: chưa deploy bản GAS mới (v13.24 trở lên).</span></div>';
  } finally { if (timer) clearTimeout(timer); _ov.busy = false; }
}
function renderOverviewTab(){ _ovEnsurePanel(); if (_ov.data && _ov.key === ((document.getElementById('ov-from') || {}).value + '|' + (document.getElementById('ov-to') || {}).value)) _ovRender(); else _ovLoad(false); }

// ── Vẽ màn hình ──
function _ovPctBar(p){ if (p === null || p === undefined) return '<span style="color:var(--muted)">—</span>'; var c = p >= 100 ? 'var(--green)' : (p >= 70 ? 'var(--tn)' : 'var(--red)');
  return '<div style="min-width:70px"><b style="color:' + c + '">' + p + '%</b><div style="height:4px;background:var(--surface2);border-radius:3px;margin-top:2px"><div style="height:4px;width:' + Math.min(100, p) + '%;background:' + c + ';border-radius:3px"></div></div></div>'; }
function _ovRatingCounts(a){ return '<span style="color:var(--green)">' + (a.tot || 0) + ' tốt</span> · <span style="color:var(--tn)">' + (a.trungbinh || 0) + ' TB</span> · <span style="color:var(--red)">' + (a.kem || 0) + ' kém</span>' + (a.chuadu ? ' · <span style="color:var(--muted)">' + a.chuadu + ' ít dữ liệu</span>' : ''); }
// Sau khi admin lưu phòng (js/35) → bỏ cache + tải lại số liệu tổng quan
function _ovAfterRoomChange(){ if (!document.getElementById('ov-body')) return; _ov.mem = {}; _ovLoad(true); }
function _ovSetDept(k){ _ov.dept = (_ov.dept === k) ? '' : k; _ov.team = ''; _ovRender(); }
function _ovSetTeam(n){ _ov.team = (_ov.team === n) ? '' : n; _ovRender(); }
function _ovSetQ(v){ _ov.q = v; _ovRenderPeople(); var i = document.getElementById('ov-q'); if (i) { i.focus(); try { i.setSelectionRange(v.length, v.length); } catch (e) {} } }
function _ovFilteredPeople(s){
  var q = _ovN(_ov.q);
  return s.people.filter(function(p){
    if (_ov.dept !== '' && (_ov.dept === '_none' ? p.deptKey : p.deptKey !== _ov.dept)) return false;
    if (_ov.team && (p.teams || []).indexOf(_ov.team) === -1) return false;
    if (q && _ovN(p.name).indexOf(q) === -1) return false;
    return true;
  });
}
function _ovRenderPeople(){
  var d = _ov.data, box = document.getElementById('ov-people'); if (!d || !box) return;
  var s = _ovScope(d), rows = _ovFilteredPeople(s), h = '';
  h += '<tr>' + ['Nhân viên', 'Team', 'Phòng', 'Đơn/ngày', 'Số đơn', 'Doanh thu', '% KPI', 'Tỷ lệ chốt', 'Xếp loại'].map(function(x){ return '<th>' + x + '</th>'; }).join('') + '</tr>';
  if (!rows.length) h += '<tr><td colspan="9" style="color:var(--muted);padding:12px">Không có nhân viên nào khớp.</td></tr>';
  rows.forEach(function(p){
    h += '<tr class="ov-row" data-n="' + esc(p.name) + '" onclick="openEmployeeProfile(this.dataset.n)"><td style="white-space:nowrap"><b>' + esc(p.name) + '</b>' + (p.isLeader ? ' <span style="font-size:10.5px;color:var(--blue)">★ Leader</span>' : '') + '</td>' +
      '<td>' + esc((p.teams || []).join(', ') || '—') + '</td><td>' + esc(p.dept || '') + '</td><td><b>' + p.ordersPerDay + '</b></td><td>' + p.orders + '</td><td style="white-space:nowrap">' + _ovMoney(p.revenue) + '</td><td>' + _ovPctBar(p.pct) + '</td>' +
      '<td>' + (p.tyLeChot === null || p.tyLeChot === undefined ? '—' : p.tyLeChot + '%') + '</td><td>' + _ovChip(p.rating) + (p.score !== null && p.score !== undefined ? ' <span style="color:var(--muted);font-size:11px">' + p.score + 'đ</span>' : '') + '</td></tr>';
  });
  box.innerHTML = '<table class="ov-tbl"><tbody>' + h + '</tbody></table>';
  var c = document.getElementById('ov-pcount'); if (c) c.textContent = rows.length + '/' + s.people.length;
}
function _ovRender(){
  var d = _ov.data, body = document.getElementById('ov-body'); if (!d || !body) return;
  var s = _ovScope(d), c = s.company || {}, h = '';
  var sc = document.getElementById('ov-scope'); if (sc) sc.textContent = '· ' + s.label + ' · ' + d.from + ' → ' + d.to + ' (' + d.days + ' ngày)' + (d.cached ? ' · lưu tạm' : '');
  if (s.mode === 'self') {
    var me = s.people[0];
    if (!me) { body.innerHTML = '<div style="color:var(--muted)">Chưa có số liệu cho tài khoản này trong kỳ (tên sale của tài khoản chưa khớp với báo cáo). Bấm ☰ Menu để vào các màn hình làm việc.</div>'; return; }
    body.innerHTML = '<div style="margin-bottom:8px;color:var(--muted)">Đây là hồ sơ kết quả làm việc của bạn. Bấm <b>☰ Menu</b> ở góc trên để vào danh sách khách và các màn hình khác.</div><div id="ov-self"></div>';
    document.getElementById('ov-self').innerHTML = _ovProfileHtml(me, d); return;
  }
  h += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">' + [
    ['Doanh thu', _ovMoney(c.revenue)], ['Số đơn', c.orders], ['Đơn TB / ngày', c.ordersPerDay], ['Giá trị đơn TB', _ovMoney(c.aov)],
    ['% KPI', c.pct === null || c.pct === undefined ? '—' : c.pct + '%'], ['Tỷ lệ chốt (giữa nhóm)', c.tyLeChot === null || c.tyLeChot === undefined ? '—' : c.tyLeChot + '%'], ['Đơn thất bại', c.failed], ['Nhân sự', c.soNguoi]
  ].map(function(x){ return '<div class="ov-card"><div class="n">' + x[1] + '</div><div class="l">' + x[0] + '</div></div>'; }).join('') +
    '<div class="ov-card" style="flex:2;min-width:240px"><div class="l">Đánh giá nhân sự</div><div style="margin-top:4px;font-size:13px">' + _ovRatingCounts(c) + '</div></div></div>';
  if (s.depts.length) {
    h += '<div style="font-weight:700;margin:4px 0 6px">🏢 Theo phòng ' + (_ovIsAdmin() ? '<button class="btn sm" style="margin-left:8px;font-weight:400" onclick="openDeptSettings()">⚙ Cài đặt phòng</button>' : '') + '</div><div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">' + s.depts.map(function(x){
      var k = x.key || '_none';
      return '<div class="ov-card ov-dept' + (_ov.dept === k ? ' on' : '') + '" data-k="' + esc(k) + '" onclick="_ovSetDept(this.dataset.k)" style="min-width:230px"><div style="font-weight:700">' + esc(x.label) + '</div>' +
        '<div style="display:flex;gap:14px;margin:6px 0;flex-wrap:wrap"><div><div class="n" style="font-size:17px">' + _ovMoney(x.revenue) + '</div><div class="l">doanh thu</div></div><div><div class="n" style="font-size:17px">' + x.ordersPerDay + '</div><div class="l">đơn/ngày</div></div><div><div class="n" style="font-size:17px">' + x.soNguoi + '</div><div class="l">nhân sự</div></div></div>' +
        _ovPctBar(x.pct) + '<div style="font-size:11.5px;margin-top:5px">' + _ovRatingCounts(x) + '</div>' +
        '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + (x.leaders && x.leaders.length ? 'Leader: ' + esc(x.leaders.join(', ')) : 'Chưa có leader') + '</div></div>'; }).join('') + '</div>';
  }
  var tms = s.teams.filter(function(t){ return _ov.dept === '' || (_ov.dept === '_none' ? !t.deptKey : t.deptKey === _ov.dept); });
  if (s.teams.length) {
    h += '<div style="font-weight:700;margin:4px 0 6px">👥 Theo team <span style="font-weight:400;color:var(--muted);font-size:11.5px">(bấm 1 dòng để lọc danh sách nhân viên bên dưới; người thuộc 2 team được tính ở cả 2)</span></div><div style="overflow-x:auto;margin-bottom:14px"><table class="ov-tbl"><tbody><tr>' +
      ['Team', 'Leader', 'Phòng', 'Nhân sự', 'Doanh thu', '% KPI', 'Số đơn', 'Đơn/ngày', 'Giá trị đơn TB', 'Tỷ lệ chốt', 'Thất bại', 'Đánh giá'].map(function(x){ return '<th>' + x + '</th>'; }).join('') + '</tr>' +
      (tms.length ? tms.map(function(t){
        return '<tr class="ov-row' + (_ov.team === t.name ? ' on' : '') + '" data-n="' + esc(t.name) + '" onclick="_ovSetTeam(this.dataset.n)"><td style="white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + esc(t.color || 'var(--muted)') + ';margin-right:6px"></span><b>' + esc(t.name) + '</b></td>' +
          '<td>' + esc(t.leader || '—') + '</td><td>' + esc(t.dept || '') + '</td><td>' + t.soNguoi + '</td><td style="white-space:nowrap"><b>' + _ovMoney(t.revenue) + '</b></td><td>' + _ovPctBar(t.pct) + '</td><td>' + t.orders + '</td><td>' + t.ordersPerDay + '</td><td>' + _ovMoney(t.aov) + '</td>' +
          '<td>' + (t.tyLeChot === null || t.tyLeChot === undefined ? '—' : t.tyLeChot + '%') + '</td><td>' + t.failed + ' (' + t.failRate + '%)</td><td style="font-size:11.5px">' + _ovRatingCounts(t) + '</td></tr>'; }).join('') : '<tr><td colspan="12" style="color:var(--muted);padding:12px">Không có team nào trong phòng này.</td></tr>') +
      '</tbody></table></div>';
  }
  h += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:4px 0 6px"><div style="font-weight:700">🧑‍💼 Nhân viên <span id="ov-pcount" style="font-weight:400;color:var(--muted);font-size:11.5px"></span> <span style="font-weight:400;color:var(--muted);font-size:11.5px">— bấm để xem hồ sơ</span></div>' +
    '<input id="ov-q" class="ymf-date" placeholder="🔍 Tìm tên…" value="' + esc(_ov.q) + '" oninput="_ovSetQ(this.value)" style="margin-left:auto;min-width:160px">' +
    ((_ov.dept !== '' || _ov.team) ? '<button class="btn" onclick="_ov.dept=\'\';_ov.team=\'\';_ovRender()">✕ Bỏ lọc</button>' : '') +
    (_ovIsAdmin() ? '<button class="btn" onclick="openTeamAnalysisModal()">🤖 AI phân tích team</button>' : '') + '</div>' +
    '<div id="ov-people" style="overflow-x:auto"></div>' +
    '<div style="margin-top:10px;font-size:11.5px;color:var(--muted);line-height:1.5">' + esc(d.note || '') + ((d.warnings || []).length ? '<br><span style="color:var(--tn)">⚠ ' + d.warnings.map(esc).join(' · ') + '</span>' : '') + '</div>';
  body.innerHTML = h; _ovRenderPeople();
}

// ── Hồ sơ nhân sự ──
function _ovDaysList(from, to, cap){ var out = [], t = Date.parse(from + 'T00:00:00Z'), e = Math.min(Date.parse(to + 'T00:00:00Z'), cap ? Date.parse(cap + 'T00:00:00Z') : 1e15); for (; t <= e && out.length < 400; t += 86400000) out.push(new Date(t).toISOString().substring(0, 10)); return out; }
function _ovChart(p, d){
  if (!p.daily) return '<div style="color:var(--muted);font-size:12px">Kỳ quá dài (&gt;93 ngày) nên không vẽ biểu đồ theo ngày — chọn kỳ ngắn hơn.</div>';
  var map = {}; p.daily.forEach(function(x){ map[x[0]] = x[1]; });
  var days = _ovDaysList(d.from, d.to, _ymd(new Date())), vals = days.map(function(k){ return map[k] || 0; }), mx = Math.max.apply(null, vals.concat([1])), W = 640, H = 120, bw = W / Math.max(days.length, 1);
  var bars = vals.map(function(v, i){ var bh = Math.round(v / mx * (H - 22)); return '<rect x="' + (i * bw + 1) + '" y="' + (H - 14 - bh) + '" width="' + Math.max(bw - 2, 1) + '" height="' + bh + '" rx="1.5" fill="' + (v ? 'var(--blue)' : 'var(--border-md)') + '"><title>' + days[i] + ': ' + v + ' đơn</title></rect>'; }).join('');
  var ay = H - 14 - Math.round(p.ordersPerDay / mx * (H - 22));
  return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:320px;height:' + H + 'px">' + bars +
    '<line x1="0" x2="' + W + '" y1="' + ay + '" y2="' + ay + '" stroke="var(--tn)" stroke-dasharray="4 3"/><text x="4" y="' + Math.max(ay - 3, 10) + '" font-size="10" fill="var(--tn)">TB ' + p.ordersPerDay + ' đơn/ngày</text>' +
    '<text x="0" y="' + (H - 2) + '" font-size="9" fill="var(--muted)">' + days[0].substring(5) + '</text><text x="' + W + '" y="' + (H - 2) + '" font-size="9" text-anchor="end" fill="var(--muted)">' + (days[days.length - 1] || '').substring(5) + '</text></svg></div>';
}
function _ovProfileHtml(p, d){
  var team = null; (d.teams || []).forEach(function(t){ if (!team && (p.teams || []).indexOf(t.name) !== -1) team = t; });
  var teamAvg = team && team.soNguoi ? Math.round(team.orders / d.days / team.soNguoi * 10) / 10 : null;
  var vs = (teamAvg !== null && teamAvg > 0) ? ' <span style="font-size:11px;color:' + (p.ordersPerDay >= teamAvg ? 'var(--green)' : 'var(--red)') + '">(' + (p.ordersPerDay >= teamAvg ? '+' : '') + Math.round((p.ordersPerDay / teamAvg - 1) * 100) + '% so với TB team ' + teamAvg + ')</span>' : '';
  var cards = [
    ['Đơn TB / ngày', '<b>' + p.ordersPerDay + '</b>' + vs, 'số đơn ÷ ' + d.days + ' ngày trong kỳ'],
    ['Đơn / ngày có phát sinh', p.ordersPerActiveDay || 0, (p.activeDays || 0) + ' ngày có đơn'],
    ['Số đơn', p.orders, ''], ['Doanh thu', _ovMoney(p.revenue), ''], ['Giá trị đơn TB', _ovMoney(p.aov), ''],
    ['% KPI', p.pct === null || p.pct === undefined ? '—' : p.pct + '%', p.target ? 'mục tiêu ' + _ovMoney(p.target) : 'chưa có mục tiêu'],
    ['Tỷ lệ chốt', p.tyLeChot === null || p.tyLeChot === undefined ? '—' : p.tyLeChot + '%', (p.tongTT || 0) + ' tin nhắn / ' + (p.sdtMangVe || 0) + ' SĐT'],
    ['Đơn thất bại', p.failedOrders || 0, ''], ['KH thêm mới (CS)', p.careLeads || 0, '']
  ].map(function(x){ return '<div class="ov-card" style="min-width:140px"><div class="n" style="font-size:17px">' + x[1] + '</div><div class="l">' + x[0] + (x[2] ? ' · ' + x[2] : '') + '</div></div>'; }).join('');
  var members = '';
  if (p.isLeader) {
    var ms = {}; (d.teams || []).forEach(function(t){ if ((p.leaderOf || []).indexOf(t.name) !== -1) (t.members || []).forEach(function(n){ if (_ovN(n) !== _ovN(p.name)) ms[n] = 1; }); });
    var list = (d.people || []).filter(function(x){ return ms[x.name]; });
    members = '<div style="font-weight:700;margin:12px 0 6px">👥 Nhân viên trong team của ' + esc(p.name) + ' (' + list.length + ')</div><div style="overflow-x:auto"><table class="ov-tbl"><tbody>' + list.map(function(x){
      var see = _ovCanSee(x.name);
      return '<tr class="' + (see ? 'ov-row' : '') + '" data-n="' + esc(x.name) + '"' + (see ? ' onclick="openEmployeeProfile(this.dataset.n)"' : '') + '><td><b>' + esc(x.name) + '</b></td><td>' + x.ordersPerDay + ' đơn/ngày</td><td>' + _ovMoney(x.revenue) + '</td><td>' + (x.pct === null || x.pct === undefined ? '—' : x.pct + '% KPI') + '</td><td>' + _ovChip(x.rating) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px"><div style="width:46px;height:46px;border-radius:50%;background:var(--blue-bg);color:var(--blue);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px">' + esc(String(p.name).trim().charAt(0).toUpperCase()) + '</div>' +
    '<div style="flex:1;min-width:200px"><div style="font-size:17px;font-weight:700">' + esc(p.name) + (p.isLeader ? ' <span style="font-size:12px;color:var(--blue)">★ Leader ' + esc((p.leaderOf || []).join(', ')) + '</span>' : '') + '</div>' +
    '<div style="font-size:12px;color:var(--muted)">Phòng: ' + esc(p.dept || '—') + ' · Team: ' + esc((p.teams || []).join(', ') || '—') + (p.leaders && p.leaders.length ? ' · Leader: ' + esc(p.leaders.join(', ')) : '') + (p.nhom ? ' · ' + esc(p.nhom) + (p.tier ? ' / bậc ' + esc(p.tier) : '') : '') + '</div></div>' +
    '<div style="text-align:right">' + _ovChip(p.rating) + '<div style="font-size:22px;font-weight:700;margin-top:2px">' + (p.score === null || p.score === undefined ? '—' : p.score) + '<span style="font-size:12px;color:var(--muted)"> /100</span></div></div></div>' +
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">Kỳ ' + esc(d.from) + ' → ' + esc(d.to) + ' (' + d.days + ' ngày)</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">' + cards + '</div>' +
    '<div style="font-weight:700;margin:6px 0">📈 Đơn hàng theo ngày</div>' + _ovChart(p, d) +
    '<div style="font-weight:700;margin:12px 0 6px">📝 Đánh giá tổng quan</div>' +
    '<div style="line-height:1.6">' + ((p.strengths || []).length ? '<div style="color:var(--green)">✔ ' + p.strengths.map(esc).join('<br>✔ ') + '</div>' : '') + ((p.issues || []).length ? '<div style="color:var(--red);margin-top:3px">✖ ' + p.issues.map(esc).join('<br>✖ ') + '</div>' : '') +
    (!(p.strengths || []).length && !(p.issues || []).length ? '<div style="color:var(--muted)">' + esc(p.comment || '') + '</div>' : '') + '</div>' +
    '<div style="margin-top:8px"><button class="btn" id="ov-ai-btn" data-n="' + esc(p.name) + '" onclick="_ovAskAI(this.dataset.n)">🤖 Nhờ AI nhận xét &amp; gợi ý việc cần làm</button> <span id="ov-ai-out" style="font-size:12.5px"></span></div>' + members;
}
function openEmployeeProfile(name){
  var d = _ov.data; if (!d) { toast('Chưa có dữ liệu tổng quan'); return; }
  if (!_ovCanSee(name)) { toast('Bạn không có quyền xem hồ sơ này.'); return; }
  var p = d.people.filter(function(x){ return _ovN(x.name) === _ovN(name); })[0]; if (!p) return;
  var el = document.getElementById('ov-prof-modal');
  if (!el) { el = document.createElement('div'); el.id = 'ov-prof-modal';
    el.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(20,20,10,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px';
    el.addEventListener('mousedown', function(e){ if (e.target === el) closeEmployeeProfile(); }); document.body.appendChild(el); }
  el.innerHTML = '<div style="background:var(--surface);border-radius:var(--rlg);box-shadow:var(--shadow-md);width:min(860px,100%);padding:18px 20px"><div style="display:flex;align-items:center;margin-bottom:10px"><div style="font-weight:700;flex:1">🪪 Hồ sơ nhân sự</div><button class="btn" onclick="closeEmployeeProfile()">✕ Đóng</button></div>' + _ovProfileHtml(p, d) + '</div>';
  el.style.display = 'flex';
}
function closeEmployeeProfile(){ var el = document.getElementById('ov-prof-modal'); if (el) el.style.display = 'none'; }
async function _ovAskAI(name){
  var d = _ov.data, out = document.getElementById('ov-ai-out'), btn = document.getElementById('ov-ai-btn'); if (!d || !out) return;
  if (btn) btn.disabled = true; out.innerHTML = '⏳ AI đang đọc số liệu…';
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=teamAnalysis&from=' + d.from + '&to=' + d.to, { redirect: 'follow' }), j = await r.json();
    if (!j || j.ok === false) throw new Error((j && j.error) || 'AI không trả kết quả');
    var me = (j.people || []).filter(function(x){ return _ovN(x.name) === _ovN(name); })[0];
    if (!me) { out.innerHTML = '<span style="color:var(--muted)">AI chưa có nhận xét riêng cho người này (ít số liệu).</span>'; return; }
    out.innerHTML = '<div style="margin-top:6px;background:var(--blue-bg);border:1px solid var(--blue-b);border-radius:var(--r);padding:8px 12px;line-height:1.55"><b>Nhận xét' + (j.aiProvider ? ' (AI · ' + esc(j.aiProvider) + ')' : ' (theo quy tắc)') + ':</b> ' + esc(me.comment || '') + (me.action ? '<br><b style="color:var(--blue)">→ ' + esc(me.action) + '</b>' : '') + (j.aiError ? '<br><span style="color:var(--tn)">⚠ ' + esc(j.aiError) + '</span>' : '') + '</div>';
  } catch (e) { out.innerHTML = '<span style="color:var(--red)">Không lấy được nhận xét AI: ' + esc(String(e && e.message || e)) + '</span>'; }
  finally { if (btn) btn.disabled = false; }
}

// ── Gắn vào hệ thống tab + tự vào Tổng quan sau đăng nhập ──
var _ovPrevSwitch = switchTab;
switchTab = function(tab, el){
  _ovPrevSwitch(tab, el);
  var p = _ovEnsurePanel(); if (p) p.style.display = (tab === 'overview') ? 'flex' : 'none';
  document.body.classList.toggle('ov-mode', tab === 'overview');
  if (tab === 'overview') renderOverviewTab();
};
function _ovAutoLand(){
  if (_ov.landed || !currentUser || currentUser.role === 'demo') return;
  if (typeof _tabAllowedForUser === 'function' && !_tabAllowedForUser('overview')) return;
  var tries = 0, iv = setInterval(function(){
    tries++;
    var dv = document.getElementById('data-view');
    if (dv && dv.style.display !== 'none') {
      clearInterval(iv); if (_ov.landed) return; _ov.landed = true;
      _ovEnsureTab();
      if (typeof _activeV9Tab === 'undefined' || _activeV9Tab === 'list') switchTab('overview', document.querySelector('[data-bar-id="overview"]') || document.createElement('div'));
    } else if (tries > 80) clearInterval(iv);
  }, 500);
}
(function(){
  function init(){ _ovEnsureTab(); _ovEnsurePanel(); setTimeout(_ovAutoLand, 800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  if (typeof _applyAuthIdentity === 'function') { var prev = _applyAuthIdentity; _applyAuthIdentity = function(){ var r = prev.apply(this, arguments); try { _ovAutoLand(); } catch (e) {} return r; }; }
})();

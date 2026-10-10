// ═══ AI PHÂN TÍCH TOÀN TEAM (v13.23) — modal xem "ai làm tốt / ai chưa tốt" ═══
// Gọi GAS action=teamAnalysis (gom KPI Sale + KPI Pancake + đơn thất bại + CS thêm KH, chấm điểm bằng quy tắc, AI viết nhận xét).
// Menu: js/29-sidenav.js (ACTS.teamai, nhóm Báo cáo, chỉ admin). Backend: gas_v13.js → teamAnalysis_ / scoreTeam_.
var _taState = { data: null, filter: 'all', busy: false };
var _TA_RATING = {
  tot:       { label: 'Làm tốt',        bg: 'var(--green-bg)', fg: 'var(--green)', bd: 'var(--green-mid)' },
  trungbinh: { label: 'Trung bình',     bg: 'var(--tn-bg)',    fg: 'var(--tn)',    bd: 'var(--tn-b)' },
  kem:       { label: 'Cần cải thiện',  bg: 'var(--red-bg)',   fg: 'var(--red)',   bd: 'var(--red-b)' },
  chuadu:    { label: 'Chưa đủ dữ liệu', bg: 'var(--surface2)', fg: 'var(--muted)', bd: 'var(--border-md)' }
};
function _taMoney(n){ return (typeof fmt === 'function' ? fmt(Math.round(n || 0)) : String(Math.round(n || 0))) + '₫'; }
function _taRange(kind){
  var now = new Date(), y = now.getFullYear(), m = now.getMonth(), f, t;
  if (kind === 'month') { f = new Date(y, m, 1); t = now; }
  else if (kind === 'lastmonth') { f = new Date(y, m - 1, 1); t = new Date(y, m, 0); }
  else { f = new Date(now.getTime() - 6 * 86400000); t = now; }   // 7 ngày gần nhất
  document.getElementById('ta-from').value = _ymd(f);
  document.getElementById('ta-to').value = _ymd(t);
}
function openTeamAnalysisModal(){
  var el = document.getElementById('ta-modal');
  if (!el) {
    el = document.createElement('div'); el.id = 'ta-modal';
    el.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(20,20,10,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px';
    el.innerHTML =
      '<div style="background:var(--surface);border-radius:var(--rlg);box-shadow:var(--shadow-md);width:min(1180px,100%);padding:18px 20px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="font-size:17px;font-weight:700;flex:1">🤖 AI phân tích toàn team</div>' +
        '<button class="btn" onclick="closeTeamAnalysisModal()" style="padding:4px 12px">✕ Đóng</button></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">' +
          '<label style="font-size:12px;color:var(--muted)">Từ</label><input type="date" id="ta-from" class="ymf-date">' +
          '<label style="font-size:12px;color:var(--muted)">Đến</label><input type="date" id="ta-to" class="ymf-date">' +
          '<button class="btn" onclick="_taRange(\'week\')">7 ngày</button><button class="btn" onclick="_taRange(\'month\')">Tháng này</button><button class="btn" onclick="_taRange(\'lastmonth\')">Tháng trước</button>' +
          '<button class="btn primary" id="ta-run" onclick="runTeamAnalysis(false)">🤖 Phân tích</button>' +
          '<button class="btn" onclick="runTeamAnalysis(true)" title="Bỏ kết quả lưu tạm 10 phút, gọi AI viết lại">↻ Làm mới</button>' +
        '</div>' +
        '<div id="ta-body" style="font-size:13px;color:var(--muted)">Chọn khoảng ngày rồi bấm “Phân tích”. Hệ thống đọc các báo cáo đã có (KPI Sale, KPI Pancake, đơn thất bại, CS thêm KH), chấm điểm từng người và nhờ AI nhận xét.</div>' +
      '</div>';
    el.addEventListener('mousedown', function(e){ if (e.target === el) closeTeamAnalysisModal(); });
    document.body.appendChild(el);
    _taRange('month');
  }
  el.style.display = 'flex';
}
function closeTeamAnalysisModal(){ var el = document.getElementById('ta-modal'); if (el) el.style.display = 'none'; }
async function runTeamAnalysis(refresh){
  if (_taState.busy) return;
  var body = document.getElementById('ta-body'), btn = document.getElementById('ta-run');
  var from = document.getElementById('ta-from').value, to = document.getElementById('ta-to').value;
  if (!from || !to) { toast('Chọn đủ khoảng ngày'); return; }
  if (from > to) { toast('Khoảng ngày bị ngược'); return; }
  if (typeof gsUrl === 'undefined' || !gsUrl) { body.innerHTML = '<div style="color:var(--red)">Chưa kết nối Google Sheets (chưa có link GAS).</div>'; return; }
  _taState.busy = true; if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang phân tích…'; }
  body.innerHTML = '<div>⏳ Đang gom số liệu và nhờ AI nhận xét (có thể mất 20–60 giây)…</div>';
  var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = ac ? setTimeout(function(){ ac.abort(); }, 150000) : null;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=teamAnalysis&from=' + from + '&to=' + to + (refresh ? '&refresh=1' : ''), { redirect: 'follow', signal: ac ? ac.signal : undefined });
    var d = await r.json();
    if (!d || d.ok === false || d.error) throw new Error((d && (d.error)) || 'Không có dữ liệu trả về');
    _taState.data = d; _taState.filter = 'all'; _taRender();
  } catch (e) {
    var msg = e && e.name === 'AbortError' ? 'Quá thời gian chờ — thử lại hoặc chọn khoảng ngày ngắn hơn.' : String(e && e.message || e);
    body.innerHTML = '<div style="color:var(--red)">Không phân tích được: ' + esc(msg) + '<br><span style="color:var(--muted)">Nếu báo “Unknown action”/không có kết quả: chưa deploy bản GAS v13.23 (xem hướng dẫn deploy).</span></div>';
  } finally { if (timer) clearTimeout(timer); _taState.busy = false; if (btn) { btn.disabled = false; btn.textContent = '🤖 Phân tích'; } }
}
function _taSetFilter(k){ _taState.filter = k; _taRender(); }
function _taRender(){
  var d = _taState.data, body = document.getElementById('ta-body'); if (!d || !body) return;
  var t = d.team || {}, f = _taState.filter, h = '';
  h += '<div style="background:var(--blue-bg);border:1px solid var(--blue-b);border-radius:var(--r);padding:10px 14px;margin-bottom:12px;color:var(--text);line-height:1.55">' +
       '<b>Tổng quan ' + esc(d.from) + ' → ' + esc(d.to) + '</b>' + (d.cached ? ' <span style="color:var(--muted);font-size:11px">(kết quả lưu tạm — bấm “Làm mới” để gọi lại AI)</span>' : '') + '<br>' + esc(d.overview || '') + '</div>';
  if ((d.highlights || []).length || (d.risks || []).length) {
    h += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px">';
    if ((d.highlights || []).length) h += '<div style="flex:1;min-width:260px;background:var(--green-bg);border-radius:var(--r);padding:10px 14px;color:var(--text)"><b style="color:var(--green)">👍 Điểm tốt</b><ul style="margin:6px 0 0 18px;padding:0">' + d.highlights.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    if ((d.risks || []).length) h += '<div style="flex:1;min-width:260px;background:var(--red-bg);border-radius:var(--r);padding:10px 14px;color:var(--text)"><b style="color:var(--red)">⚠ Cần xử lý</b><ul style="margin:6px 0 0 18px;padding:0">' + d.risks.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '</div>';
  }
  var chips = [['all', 'Tất cả', t.soNguoi || 0], ['tot', 'Làm tốt', t.tot || 0], ['trungbinh', 'Trung bình', t.trungbinh || 0], ['kem', 'Cần cải thiện', t.kem || 0], ['chuadu', 'Chưa đủ dữ liệu', t.chuadu || 0]];
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + chips.map(function(c){
    var on = f === c[0];
    return '<button class="btn" onclick="_taSetFilter(\'' + c[0] + '\')" style="' + (on ? 'background:var(--text);color:#fff;' : '') + '">' + c[1] + ' (' + c[2] + ')</button>'; }).join('') +
    '<span style="margin-left:auto;font-size:12px;color:var(--muted);align-self:center">Doanh thu team: <b>' + _taMoney(t.totalRevenue) + '</b> · ' + (t.totalOrders || 0) + ' đơn · thất bại ' + (t.tyLeThatBai || 0) + '% · tỷ lệ chốt giữa team ' + (t.tyLeChotGiuaTeam || 0) + '%</span></div>';
  var rows = (d.people || []).filter(function(p){ return f === 'all' || p.rating === f; });
  h += '<div style="overflow-x:auto"><table class="dash-table" style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>' +
       ['#', 'Nhân viên', 'Xếp loại', 'Điểm', 'Doanh thu', 'Đơn', '% KPI', 'Tỷ lệ chốt', 'Thất bại', 'Nhận xét & việc cần làm'].map(function(x){ return '<th style="text-align:left;padding:7px 8px;border-bottom:1px solid var(--border-md);white-space:nowrap">' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  if (!rows.length) h += '<tr><td colspan="10" style="padding:14px;color:var(--muted)">Không có nhân viên nào trong nhóm này.</td></tr>';
  rows.forEach(function(p, i){
    var R = _TA_RATING[p.rating] || _TA_RATING.chuadu, td = 'padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top';
    h += '<tr><td style="' + td + '">' + (i + 1) + '</td>' +
      '<td style="' + td + ';white-space:nowrap"><b>' + esc(p.name) + '</b>' + (p.nhom ? '<div style="font-size:11px;color:var(--muted)">' + esc(p.nhom) + (p.tier ? ' · ' + esc(p.tier) : '') + '</div>' : '') + '</td>' +
      '<td style="' + td + '"><span style="display:inline-block;padding:2px 9px;border-radius:99px;font-weight:600;font-size:11.5px;white-space:nowrap;background:' + R.bg + ';color:' + R.fg + ';border:1px solid ' + R.bd + '">' + R.label + '</span></td>' +
      '<td style="' + td + ';font-weight:700">' + (p.score === null || p.score === undefined ? '—' : p.score) + '</td>' +
      '<td style="' + td + ';text-align:right;white-space:nowrap">' + _taMoney(p.revenue) + '</td>' +
      '<td style="' + td + ';text-align:right">' + (p.orders || 0) + '</td>' +
      '<td style="' + td + ';text-align:right">' + (p.pct === null || p.pct === undefined ? '—' : p.pct + '%') + '</td>' +
      '<td style="' + td + ';text-align:right">' + (p.tyLeChot === null || p.tyLeChot === undefined ? '—' : p.tyLeChot + '%') + '</td>' +
      '<td style="' + td + ';text-align:right">' + (p.failedOrders || 0) + '</td>' +
      '<td style="' + td + ';min-width:260px;line-height:1.5">' + esc(p.comment || '') + (p.action ? '<div style="margin-top:3px;color:var(--blue)"><b>→ ' + esc(p.action) + '</b></div>' : '') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="margin-top:10px;font-size:11.5px;color:var(--muted);line-height:1.5">' + esc(d.note || '') +
       (d.aiProvider ? '<br>Nhận xét viết bởi AI (' + esc(d.aiProvider) + ') từ số liệu ở bảng — xếp loại do quy tắc quyết định, AI không đổi. Nên đối chiếu thêm bối cảnh thực tế trước khi đánh giá nhân sự.' : '') +
       (d.aiError ? '<br><span style="color:var(--tn)">⚠ AI: ' + esc(d.aiError) + '</span>' : '') +
       ((d.warnings || []).length ? '<br><span style="color:var(--tn)">⚠ ' + d.warnings.map(esc).join(' · ') + '</span>' : '') + '</div>';
  body.innerHTML = h;
}

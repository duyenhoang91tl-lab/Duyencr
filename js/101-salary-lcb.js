// ═══════════════════════════════════════════════════════════════════════════════════════
//  LƯƠNG CƠ BẢN (LCB) SALE OFFLINE — giao diện Báo cáo F → ⚙ → "💵 Lương cơ bản (ngày công)" (CHỈ ADMIN)
//  Quy chế lương, hoa hồng và phân ca (26/10/2026, áp dụng 01/11/2026): LCB theo % đạt KPI (<65% 3tr · 65–<85% 3,5tr · 85–<100% 4,25tr · ≥100% 5tr)
//  rồi chia theo NGÀY CÔNG: LCB thực nhận = LCB ÷ ngày công chuẩn × ngày công thực tế. Ngày công do admin NHẬP TAY cuối tháng (Duyên 27/11).
//  Dữ liệu: GAS salaryReport (GET) + salarySaveWorkdays (POST) — xem gas_v13.js "LƯƠNG CƠ BẢN". Gỡ = xoá thẻ script + mục menu trong js/13.
// ═══════════════════════════════════════════════════════════════════════════════════════
(function(){
  var S = { month: '', data: null, loading: false, err: '' };
  function e(s){ return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function money(n){ return (typeof _srMoney === 'function') ? _srMoney(n) : Math.round(n || 0).toLocaleString('en-US') + '₫'; }
  function curYm(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function say(m){ if (typeof toast === 'function') toast(m); }
  function isAdmin(){ return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin'; }
  var TIER_LABEL = { TV: 'Thử việc', CT: 'Chính thức' };

  function api(url, opt){
    return fetch(url, opt).then(function(r){ return r.json(); }).catch(function(){ return { ok: false, error: 'Không kết nối được máy chủ.' }; });
  }
  function load(){
    if (S.loading) return; S.loading = true; S.err = ''; paint();
    api(gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=salaryReport&month=' + encodeURIComponent(S.month), { redirect: 'follow' }).then(function(r){
      S.loading = false;
      if (r && r.ok) S.data = r; else { S.data = null; S.err = (r && r.error) || 'Không tải được bảng lương cơ bản.'; }
      paint();
    });
  }
  // Tính lại LCB thực nhận ngay khi gõ (cùng công thức GAS _lcbNet_): rỗng = chưa nhập = LCB nguyên.
  function net(lcb, std, wd){ if (lcb === null || lcb === undefined) return null; if (wd === '' || wd === null || wd === undefined || isNaN(Number(wd))) return lcb; return Math.round(lcb / std * Number(wd)); }
  function stdNow(){ var el = document.getElementById('slcb-std'); var v = el ? Number(el.value) : (S.data && S.data.standardDays); return (isFinite(v) && v >= 1 && v <= 31) ? v : ((S.data && S.data.standardDays) || 26); }
  function recalc(){
    var std = stdNow(), total = 0, missing = 0;
    ((S.data && S.data.rows) || []).forEach(function(r, i){
      var el = document.getElementById('slcb-wd-' + i), v = el ? el.value : '';
      var n = net(r.lcbTier, std, v), c = document.getElementById('slcb-net-' + i);
      if (c) c.textContent = n === null ? '—' : money(n);
      if (v === '') missing++;
      total += n || 0;
    });
    var t = document.getElementById('slcb-total'); if (t) t.textContent = money(total);
    var m = document.getElementById('slcb-missing'); if (m) m.innerHTML = missing ? '⚠ Còn <b>' + missing + '</b> Sale chưa nhập ngày công (đang hiện LCB theo tỷ lệ, chưa chia ngày công).' : '✓ Đã nhập ngày công cho tất cả.';
  }
  function paint(){
    var box = document.getElementById('slcb-body'); if (!box) return;
    var d = S.data, h = '';
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">' +
      '<div><label style="font-size:11px;color:var(--muted);display:block">Tháng</label><input type="month" id="slcb-month" value="' + e(S.month) + '" onchange="_slcbSetMonth(this.value)" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)"></div>' +
      '<div><label style="font-size:11px;color:var(--muted);display:block">Ngày công chuẩn của tháng</label><input type="number" id="slcb-std" min="1" max="31" step="0.5" value="' + e(d ? d.standardDays : 26) + '" oninput="_slcbRecalc()" style="width:90px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)"></div>' +
      '</div>';
    if (S.loading) h += '<div style="padding:16px;color:var(--muted)">Đang tải…</div>';
    else if (S.err) h += '<div style="padding:12px;border-radius:8px;background:rgba(220,38,38,.1)">' + e(S.err) + ' <button class="btn secondary sm" onclick="_slcbReload()">Thử lại</button></div>';
    else if (d) {
      h += '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">LCB theo % đạt KPI của tháng (Báo cáo F): ' + (d.lcbTiers || []).map(function(t){ return '≥' + t.minPct + '% → ' + money(t.amount); }).join(' · ') + '. <b>LCB thực nhận = LCB ÷ ngày công chuẩn × ngày công thực tế.</b> Chỉ Sale thuộc kênh Offline / Thử việc (Phân loại đội Sale) và đã có bậc.</div>';
      if (!d.rows.length) h += '<div style="padding:14px;color:var(--muted)">Chưa có Sale Offline / Thử việc nào có bậc trong tháng này. Kiểm tra "🏷️ Phân loại đội Sale" và "🎯 Cài đặt KPI".</div>';
      else {
        h += '<div style="overflow-x:auto"><table class="sr-table" style="width:100%"><thead><tr><th style="text-align:left">Sale</th><th style="text-align:left">Bậc</th><th style="text-align:right">Doanh số</th><th style="text-align:right">KPI</th><th style="text-align:right">% KPI</th><th style="text-align:right">LCB theo tỷ lệ</th><th style="text-align:right">Ngày công thực tế</th><th style="text-align:right">LCB thực nhận</th></tr></thead><tbody>';
        d.rows.forEach(function(r, i){
          h += '<tr><td>' + e(r.name) + '</td><td>' + e(TIER_LABEL[r.tier] || r.tier) + '</td><td style="text-align:right">' + money(r.revenue) + '</td><td style="text-align:right">' + money(r.target) + '</td><td style="text-align:right">' + (r.pct === null ? '—' : r.pct + '%') + '</td>' +
            '<td style="text-align:right">' + (r.lcbTier === null ? '—' : money(r.lcbTier)) + '</td>' +
            '<td style="text-align:right"><input type="number" id="slcb-wd-' + i + '" min="0" max="31" step="0.5" value="' + (r.workdays === null ? '' : e(r.workdays)) + '" placeholder="chưa nhập" oninput="_slcbRecalc()" style="width:90px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);text-align:right"></td>' +
            '<td style="text-align:right;font-weight:600" id="slcb-net-' + i + '">' + (r.lcbNet === null ? '—' : money(r.lcbNet)) + '</td></tr>';
        });
        h += '<tr style="font-weight:700;background:var(--surface2)"><td colspan="7">Tổng LCB thực nhận</td><td style="text-align:right" id="slcb-total">' + money(d.total) + '</td></tr></tbody></table></div>';
        h += '<div id="slcb-missing" style="font-size:12px;margin-top:8px"></div>';
        h += '<div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" onclick="_slcbSave()">💾 Lưu ngày công</button><button class="btn secondary" onclick="_slcbClose()">Đóng</button></div>';
      }
    }
    box.innerHTML = h; if (d && !S.loading) recalc();
  }
  function open(){
    if (!isAdmin()){ say('Chỉ admin dùng được mục này.'); return; }
    if (typeof gsUrl === 'undefined' || !gsUrl){ say('Chưa kết nối Google Sheets.'); return; }
    var m = document.getElementById('slcb-modal'); if (m) m.remove();
    var el = document.createElement('div'); el.id = 'slcb-modal'; el.className = 'modal-overlay open';
    el.innerHTML = '<div class="modal-box" style="max-width:980px;max-height:calc(var(--vh,1vh)*88);overflow-y:auto"><div class="modal-title">💵 Lương cơ bản Sale Offline (theo % KPI + ngày công)</div><div id="slcb-body"></div></div>';
    document.body.appendChild(el);
    S.month = S.month || curYm(); S.data = null; load();
  }
  function save(){
    var d = S.data; if (!d || S.loading) return;
    var std = stdNow(), by = {};
    d.rows.forEach(function(r, i){ var el = document.getElementById('slcb-wd-' + i); by[r.name] = el ? el.value : ''; });
    var bad = ''; Object.keys(by).forEach(function(n){ if (by[n] !== '' && (!isFinite(Number(by[n])) || Number(by[n]) < 0 || Number(by[n]) > 31)) bad = bad || ('Ngày công của ' + n + ' phải từ 0 đến 31.'); });
    if (bad){ say(bad); return; }
    S.loading = true; paint();
    api(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'salarySaveWorkdays', month: S.month, standard: std, byName: by }) }).then(function(r){
      S.loading = false;
      if (r && r.ok){ say('✓ Đã lưu ngày công tháng ' + S.month); load(); } else { say('⚠ ' + ((r && r.error) || 'Lưu không thành công')); paint(); }
    });
  }
  window.openSalaryLcbModal_ = open;
  window._slcbSetMonth = function(v){ if (/^\d{4}-\d{2}$/.test(v)){ S.month = v; load(); } };
  window._slcbReload = load;
  window._slcbRecalc = recalc;
  window._slcbSave = save;
  window._slcbClose = function(){ var m = document.getElementById('slcb-modal'); if (m) m.remove(); };
})();

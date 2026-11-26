// js/96-lead-assign.js — MAN "CHIA DATA CHO TEAM" CUA TRUONG NHOM (2026-11-26)
// Nguyen nhan goc: man Chia data (js/07) chi danh cho admin va chia duoc cho moi nguoi; Truong nhom khong chia lai duoc data admin giao,
// khong co cho xem tien do tung nhan vien. Man nay chi cho vai tro goc 'leader':
//   - Tab "Chia lai": khach admin da chia cho CHINH Truong nhom -> chia cho thanh vien team (server kiem lai: GAS leadAssign).
//   - Tab "Bao cao nhan vien": moi nguoi duoc giao bao nhieu / da xong / tinh trang cham soc (du lieu moi nhat tu GAS leadAssignInfo).
(function () {
  var G = (typeof window !== 'undefined') ? window : globalThis;
  var ST = { tab: 'split', info: null, loading: false, err: '', onlyNew: true, batch: '', qty: '', picks: {}, from: '', to: '', open: '', busy: false };

  function key_(n) { return String(n || '').trim().toLowerCase(); }
  function ph_(p) { return (typeof normPhone === 'function' ? normPhone(p) : '') || String(p); }

  // ── HAM THUAN ──
  // Khach duoc chia cho chinh Truong nhom (moi nhat truoc). distributed = da nam trong dot chia cua 1 thanh vien.
  function ldaPool_(info, batch) {
    var own = {}, mem = {}, done = {}, seen = {}, out = [];
    (info.own || []).forEach(function (n) { own[key_(n)] = 1; });
    (info.members || []).forEach(function (n) { mem[key_(n)] = 1; });
    var hist = (info.assignHistory || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    hist.forEach(function (h) { if (mem[key_(h.csName)]) (h.phones || []).forEach(function (p) { done[ph_(p)] = 1; }); });
    hist.forEach(function (h) {
      if (!own[key_(h.csName)] || (batch && h.id !== batch)) return;
      (h.phones || []).forEach(function (p) {
        var k = ph_(p); if (seen[k]) return; seen[k] = 1;
        out.push({ phone: String(p), distributed: !!done[k] });
      });
    });
    return out;
  }
  // picks: [{csName, n}] -> cat lan luot tu danh sach SDT. Tra {entries} hoac {error}.
  function ldaSplit_(phones, picks) {
    var total = 0, entries = [], cur = 0;
    picks.forEach(function (p) { total += Math.max(0, parseInt(p.n, 10) || 0); });
    if (!total) return { error: 'Nhập số khách cho ít nhất 1 nhân viên.' };
    if (total > phones.length) return { error: 'Tổng số đã nhập (' + total + ') vượt quá ' + phones.length + ' khách đang có.' };
    picks.forEach(function (p) {
      var n = Math.max(0, parseInt(p.n, 10) || 0);
      if (n) { entries.push({ csName: p.csName, phones: phones.slice(cur, cur + n) }); cur += n; }
    });
    return { entries: entries, total: total };
  }
  function ldaEven_(total, count) {
    var out = [], base = count ? Math.floor(total / count) : 0, extra = count ? total % count : 0;
    for (var i = 0; i < count; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
  }
  // groups: [{primary, names}] ; statusOf(phone) -> chuoi tinh trang cham soc.
  function ldaReport_(info, groups, from, to, statusOf) {
    return groups.map(function (g) {
      var names = {}; g.names.forEach(function (n) { names[key_(n)] = 1; });
      var map = {}, batches = 0;
      (info.assignHistory || []).forEach(function (h) {
        if (!names[key_(h.csName)]) return;
        var d = String(h.date || '').slice(0, 10);
        if ((from && d < from) || (to && d > to)) return;
        batches++;
        var dn = {}; (h.donePhones || []).forEach(function (p) { dn[ph_(p)] = 1; });
        (h.phones || []).forEach(function (p) {
          var k = ph_(p);
          if (!map[k]) map[k] = { phone: String(p), done: false, date: d };
          if (dn[k]) map[k].done = true;
          if (d > map[k].date) map[k].date = d;
        });
      });
      var rows = Object.keys(map).map(function (k) { var r = map[k]; r.status = (statusOf && statusOf(r.phone)) || 'Chưa liên hệ'; return r; });
      var done = rows.filter(function (r) { return r.done; }).length;
      var untouched = rows.filter(function (r) { return !r.done && r.status === 'Chưa liên hệ'; }).length;
      return { name: g.primary, batches: batches, total: rows.length, done: done, left: rows.length - done, untouched: untouched,
               pct: rows.length ? Math.round(done / rows.length * 100) : 0, rows: rows };
    });
  }

  // ── GIAO DIEN ──
  function isLead_() { return typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'leader'; }
  function tok_() { try { return localStorage.getItem('ome_sess_token') || ''; } catch (e) { return ''; } }
  function groups_() {
    var m = (ST.info && ST.info.members) || [];
    if (typeof _groupNamesByPerson === 'function') { try { return _groupNamesByPerson(m); } catch (e) {} }
    return m.map(function (n) { return { primary: n, names: [n] }; });
  }
  function cust_(p) {
    try { var m = _assignCustMap(); return m.get(p) || m.get(ph_(p)) || null; } catch (e) { return null; }
  }
  function $(id) { return document.getElementById(id); }

  function ensureModal_() {
    var el = $('lead-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'lead-modal'; el.className = 'assign-modal-overlay';
    el.innerHTML = '<div class="assign-modal">' +
      '<div class="assign-modal-hdr"><div class="assign-modal-title">👥 Data của team</div><button class="close-btn" onclick="closeLeadModal()">✕</button></div>' +
      '<div class="assign-tabs"><div class="assign-tab" data-t="split" onclick="ldaTab(\'split\')">📤 Chia lại cho nhân viên</div>' +
      '<div class="assign-tab" data-t="report" onclick="ldaTab(\'report\')">📊 Báo cáo nhân viên</div></div>' +
      '<div class="assign-body" id="lead-body"></div><div class="assign-footer" id="lead-footer"></div></div>';
    document.body.appendChild(el);
    return el;
  }

  async function load_() {
    ST.loading = true; ST.err = ''; render_();
    try {
      if (!gsUrl) throw new Error('Chưa kết nối máy chủ.');
      var r = await fetch(gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=leadAssignInfo&token=' + encodeURIComponent(tok_()) + '&_=' + Date.now(), { redirect: 'follow' });
      var d = await r.json();
      if (!d || !d.ok) throw new Error((d && d.error) || 'Máy chủ chưa có tính năng này (chờ vài phút cho bản mới được đưa lên).');
      ST.info = d;
      merge_(d.assignHistory || []);
    } catch (e) { ST.err = String((e && e.message) || e); }
    ST.loading = false; render_();
  }
  // Dua cac dot chia moi / tien do moi nhat vao bo nho chung (bo loc "Chia data", pham vi xem dung assignHistory).
  function merge_(list) {
    if (typeof assignHistory === 'undefined' || !list.length) return;
    var idx = {}, changed = false;
    assignHistory.forEach(function (h, i) { idx[h.id] = i; });
    list.forEach(function (h) {
      var c = Object.assign({}, h, { phones: (h.phones || []).map(ph_), donePhones: (h.donePhones || []).map(ph_) });
      if (idx[h.id] === undefined) { assignHistory.unshift(c); changed = true; }
      else if (JSON.stringify(assignHistory[idx[h.id]].donePhones || []) !== JSON.stringify(c.donePhones)) { assignHistory[idx[h.id]].donePhones = c.donePhones; changed = true; }
    });
    if (!changed) return;
    assignHistory.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    saveLS('ome_assign_hist', assignHistory);
    if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
    if (typeof _rebuildAssignIndex === 'function') _rebuildAssignIndex();
  }

  function monthsText_() {
    var m = (ST.info && ST.info.viewMonths) || [];
    return m.length ? 'Admin cấp xem data tháng: <b>' + m.map(function (x) { return x.slice(5) + '/' + x.slice(0, 4); }).join(', ') + '</b> (data được chia riêng cho bạn thì luôn xem được).' : '';
  }

  function pickList_() {
    var pool = ldaPool_(ST.info, ST.batch);
    var list = ST.onlyNew ? pool.filter(function (x) { return !x.distributed; }) : pool;
    var n = parseInt(ST.qty, 10);
    return { pool: pool, list: (n > 0 ? list.slice(0, n) : list), avail: list.length };
  }

  function renderSplit_() {
    var info = ST.info, own = {};
    (info.own || []).forEach(function (n) { own[key_(n)] = 1; });
    var batches = (info.assignHistory || []).filter(function (h) { return own[key_(h.csName)]; });
    var p = pickList_(), groups = groups_();
    if (!batches.length) return '<div style="padding:24px;text-align:center;color:var(--hint)">Admin chưa chia data nào cho bạn.<br>Tên nhận data của bạn: <b>' + esc((info.own || []).join(', ')) + '</b></div>';
    if (!groups.length) return '<div style="padding:24px;text-align:center;color:var(--hint)">Team của bạn chưa có thành viên. Nhờ admin thêm ở "Quản lý Team" và chọn Team cho tài khoản này.</div>';
    var newCount = p.pool.filter(function (x) { return !x.distributed; }).length;
    return '<div class="assign-section"><div class="assign-section-title">① Data được giao cho bạn</div>' +
      '<select class="assign-input" style="width:100%;margin-bottom:8px" onchange="ldaSet(\'batch\',this.value)"><option value="">Tất cả đợt được giao</option>' +
        batches.map(function (h) { return '<option value="' + esc(h.id) + '"' + (ST.batch === h.id ? ' selected' : '') + '>' + esc(String(h.date).slice(0, 10)) + ' — ' + esc(h.label) + ' (' + (h.phones || []).length + ' KH)</option>'; }).join('') + '</select>' +
      '<div class="assign-preview">Tổng <b>' + p.pool.length + '</b> khách &nbsp;|&nbsp; <span style="color:var(--green)">chưa giao cho nhân viên: <b>' + newCount + '</b></span> &nbsp;|&nbsp; đã giao: <b>' + (p.pool.length - newCount) + '</b></div>' +
      '<label style="display:flex;gap:6px;align-items:center;font-size:12px;margin:8px 0;cursor:pointer"><input type="checkbox" style="width:auto" ' + (ST.onlyNew ? 'checked' : '') + ' onchange="ldaSet(\'onlyNew\',this.checked)"> Chỉ lấy khách chưa giao cho ai</label>' +
      '<div class="assign-qty-row"><span style="font-size:12px;color:var(--muted)">Số khách muốn chia lần này:</span>' +
        '<input class="assign-qty-input" type="number" min="1" max="' + p.avail + '" value="' + esc(ST.qty) + '" placeholder="' + p.avail + '" onchange="ldaSet(\'qty\',this.value)"><span style="font-size:11px;color:var(--hint)">/ ' + p.avail + '</span></div></div>' +
      '<div class="assign-section"><div class="assign-section-title">② Giao cho ai</div>' +
      '<table class="assign-dist-table" style="width:100%"><thead><tr><th style="text-align:left">Nhân viên</th><th>Số khách</th></tr></thead><tbody>' +
      groups.map(function (g) { return '<tr><td><b>' + esc(g.primary) + '</b></td><td style="text-align:center"><input class="assign-dist-input lda-n" type="number" min="0" data-cs="' + esc(g.primary) + '" value="' + esc(ST.picks[g.primary] || '') + '" oninput="ldaPick(this.dataset.cs,this.value)"></td></tr>'; }).join('') +
      '</tbody></table><div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn sm" onclick="ldaEvenFill()">⚖ Chia đều ' + p.list.length + ' khách</button><span id="lda-sum" style="font-size:12px"></span></div></div>' +
      '<div class="assign-section"><div class="assign-section-title">③ Ghi chú đợt chia (tuỳ chọn)</div><input class="assign-input" id="lda-label" style="width:100%" placeholder="VD: Gọi lại khách tháng 4"></div>';
  }

  function renderReport_() {
    var rep = ldaReport_(ST.info, groups_(), ST.from, ST.to, function (p) { var c = cust_(p); return c ? c.careStatus : ''; });
    var sum = rep.reduce(function (s, r) { s.total += r.total; s.done += r.done; s.untouched += r.untouched; return s; }, { total: 0, done: 0, untouched: 0 });
    var h = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:12px">Ngày chia: <input type="date" class="assign-input" style="width:auto" value="' + esc(ST.from) + '" onchange="ldaSet(\'from\',this.value)"> → <input type="date" class="assign-input" style="width:auto" value="' + esc(ST.to) + '" onchange="ldaSet(\'to\',this.value)">' +
      '<button class="btn sm" onclick="ldaReload()">↻ Tải lại</button><button class="btn sm" onclick="ldaSales()">📈 Báo cáo doanh số team</button></div>' +
      '<div style="overflow-x:auto"><table class="assign-dist-table" style="width:100%"><thead><tr><th style="text-align:left">Nhân viên</th><th>Đợt</th><th>Được giao</th><th>Đã xong</th><th>Còn lại</th><th>Chưa liên hệ</th><th>% xong</th></tr></thead><tbody>' +
      rep.map(function (r) {
        return '<tr style="cursor:pointer" data-cs="' + esc(r.name) + '" onclick="ldaOpen(this.dataset.cs)"><td><b>' + (ST.open === r.name ? '▼ ' : '▶ ') + esc(r.name) + '</b></td><td style="text-align:center">' + r.batches + '</td><td style="text-align:center">' + r.total + '</td><td style="text-align:center;color:var(--green)">' + r.done + '</td><td style="text-align:center">' + r.left + '</td><td style="text-align:center;color:var(--red)">' + r.untouched + '</td><td style="text-align:center"><b>' + r.pct + '%</b></td></tr>';
      }).join('') +
      '<tr><td><b>Cả team</b></td><td></td><td style="text-align:center"><b>' + sum.total + '</b></td><td style="text-align:center"><b>' + sum.done + '</b></td><td style="text-align:center"><b>' + (sum.total - sum.done) + '</b></td><td style="text-align:center"><b>' + sum.untouched + '</b></td><td style="text-align:center"><b>' + (sum.total ? Math.round(sum.done / sum.total * 100) : 0) + '%</b></td></tr></tbody></table></div>';
    var cur = rep.filter(function (r) { return r.name === ST.open; })[0];
    if (cur) {
      var rows = cur.rows.slice().sort(function (a, b) { return (a.done - b.done) || String(b.date).localeCompare(String(a.date)); });
      h += '<div class="assign-section-title" style="margin-top:12px">Khách của ' + esc(cur.name) + '</div><div style="overflow-x:auto"><table class="assign-dist-table" style="width:100%"><thead><tr><th style="text-align:left">Khách</th><th style="text-align:left">SĐT</th><th style="text-align:left">Tình trạng chăm sóc</th><th>Ngày chia</th><th>Xong</th></tr></thead><tbody>' +
        rows.slice(0, 200).map(function (r) { var c = cust_(r.phone); return '<tr><td>' + esc(c ? c.name : '—') + '</td><td>' + esc(r.phone) + '</td><td>' + esc(r.status) + '</td><td style="text-align:center">' + esc(r.date) + '</td><td style="text-align:center">' + (r.done ? '✓' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + (rows.length > 200 ? '<div style="font-size:11px;color:var(--hint)">Hiện 200/' + rows.length + ' khách (khách chưa xong lên trước).</div>' : '');
    }
    return h;
  }

  function render_() {
    var el = $('lead-modal'); if (!el) return;
    el.querySelectorAll('.assign-tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-t') === ST.tab); });
    var body = $('lead-body'), foot = $('lead-footer');
    foot.innerHTML = '<button class="btn" onclick="closeLeadModal()">Đóng</button>';
    if (ST.loading) { body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--hint)">⏳ Đang tải data của team…</div>'; return; }
    if (ST.err || !ST.info) { body.innerHTML = '<div style="padding:24px;text-align:center;color:var(--red)">' + esc(ST.err || 'Chưa tải được.') + '<br><button class="btn sm" onclick="ldaReload()">↻ Thử lại</button></div>'; return; }
    var note = monthsText_();
    body.innerHTML = (note ? '<div class="assign-preview" style="margin-bottom:10px">' + note + '</div>' : '') + (ST.tab === 'report' ? renderReport_() : renderSplit_());
    if (ST.tab === 'split') {
      foot.innerHTML += '<button class="btn primary" id="lda-go" onclick="ldaSubmit()"' + (ST.busy ? ' disabled' : '') + '>' + (ST.busy ? '⏳ Đang chia…' : '✓ Xác nhận chia') + '</button>';
      sum_();
    }
  }
  function sum_() {
    var el = $('lda-sum'); if (!el || !ST.info) return;
    var n = 0; Object.keys(ST.picks).forEach(function (k) { n += Math.max(0, parseInt(ST.picks[k], 10) || 0); });
    var max = pickList_().list.length;
    el.innerHTML = 'Đã nhập <b style="color:' + (n > max ? 'var(--red)' : 'var(--green)') + '">' + n + '</b> / ' + max + ' khách';
  }

  async function submit_() {
    if (ST.busy || !ST.info) return;
    var list = pickList_().list.map(function (x) { return x.phone; });
    var picks = groups_().map(function (g) { return { csName: g.primary, n: ST.picks[g.primary] }; });
    var plan = ldaSplit_(list, picks);
    if (plan.error) { toast(plan.error); return; }
    var label = ($('lda-label') && $('lda-label').value || '').trim();
    if (!confirm('Chia ' + plan.total + ' khách: ' + plan.entries.map(function (e) { return e.csName + ' ' + e.phones.length; }).join(', ') + '?')) return;
    ST.busy = true; var btn = $('lda-go'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang chia…'; }
    try {
      var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'leadAssign', token: tok_(), label: label, entries: plan.entries }) });
      var d = await r.json();
      if (!d || !d.ok) throw new Error((d && d.error) || 'Máy chủ không nhận được yêu cầu.');
      merge_(d.entries);
      ST.info.assignHistory = d.entries.concat(ST.info.assignHistory || []);
      try { _applyCareCSToAssigned(d.entries); } catch (e1) { console.warn('lead careCS', e1); }   // dat "CS cham soc" = nguoi nhan, nhu luong chia cua admin
      try { d.entries.forEach(function (e) { logAudit('assign', '', '', 'Lead chia ' + e.phones.length + ' KH → ' + e.csName); }); } catch (e2) {}
      ST.picks = {}; ST.qty = '';
      toast('✓ Đã chia ' + d.total + ' khách cho team');
    } catch (e) { toast('Chưa chia được: ' + ((e && e.message) || e) + ' — bấm "Báo cáo nhân viên" → Tải lại để kiểm tra trước khi chia lại.'); }
    ST.busy = false; render_();
  }

  G.openLeadModal = function (tab) {
    if (!isLead_()) { toast('Mục này dành cho tài khoản Trưởng nhóm.'); return; }
    ensureModal_().classList.add('open');
    ST.tab = tab === 'report' ? 'report' : 'split'; ST.info = null; ST.picks = {}; ST.qty = ''; ST.batch = ''; ST.open = '';
    load_();
  };
  G.closeLeadModal = function () { var el = $('lead-modal'); if (el) el.classList.remove('open'); };
  G.ldaTab = function (t) { ST.tab = t; render_(); };
  G.ldaSet = function (k, v) { ST[k] = v; if (k === 'batch' || k === 'onlyNew') { ST.qty = ''; ST.picks = {}; } render_(); };
  G.ldaPick = function (cs, v) { ST.picks[cs] = v; sum_(); };
  G.ldaEvenFill = function () {
    var g = groups_(), n = ldaEven_(pickList_().list.length, g.length);
    g.forEach(function (x, i) { ST.picks[x.primary] = String(n[i]); });
    render_();
  };
  G.ldaOpen = function (cs) { ST.open = ST.open === cs ? '' : cs; render_(); };
  G.ldaReload = load_;
  G.ldaSubmit = submit_;
  G.ldaSales = function () { G.closeLeadModal(); if (typeof switchTab === 'function') switchTab('salesreport', document.querySelector('[data-bar-id="reportsgroup"]')); };
  // Menu "Data cua team" chi hien voi Truong nhom -> ve lai menu sau khi biet vai tro dang nhap.
  function relayout_() { setTimeout(function () { try { if (typeof G._snLayout === 'function') G._snLayout(); } catch (e) {} }, 0); }
  if (typeof G._applyAuthIdentity === 'function') { var prev_ = G._applyAuthIdentity; G._applyAuthIdentity = function () { var r = prev_.apply(this, arguments); relayout_(); return r; }; }
  relayout_();
  G.ldaPool_ = ldaPool_; G.ldaSplit_ = ldaSplit_; G.ldaEven_ = ldaEven_; G.ldaReport_ = ldaReport_;
})();

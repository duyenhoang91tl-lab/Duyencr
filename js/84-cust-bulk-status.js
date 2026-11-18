// R5a bước 3 — ĐỔI "TÌNH TRẠNG CS" và "TRẠNG THÁI KH" HÀNG LOẠT cho khách đã chọn (nạp SAU js/83). Duyên chốt 16/11.
// NGUYÊN NHÂN GỐC (R5a): đổi tình trạng cho nhiều khách phải mở hồ sơ từng người rồi bấm Lưu.
// Ghi ĐÚNG như saveCare (js/03): careData[ph].status / .khStatus (+ c.careStatus cho tình trạng), _touchCare, saveLS('ome_care'), queueCareSync(ph) (đồng bộ GAS saveSingle),
// _invalidateFilterCache + applyFilters. Khác saveCare: KHÔNG đụng ghi chú/CS/Zalo/lịch (giữ nguyên toàn bộ dữ liệu khác của khách).
// Tình trạng thuộc nhóm "Chốt" KHÔNG cho đặt hàng loạt (saveCare lúc đó còn lưu đơn chốt `_hSaveChotFromForm_` cần nhập tay) → ẩn khỏi danh sách, có ghi chú.
// Khách đổi tình trạng mà CHƯA có Trạng thái KH → tự điền `_hAutoKh_` (giống saveCare). Có XEM TRƯỚC + nhật ký (từng khách nếu ≤200, ngoài ra 1 dòng tổng).
// Ai dùng: mọi người xem được khách, nhưng chỉ khách trong phạm vi (`_inUserScope`); khách ngoài phạm vi / không tìm thấy / đã đúng giá trị → bỏ qua có báo.
// Hàm thuần (test: node tools/test-cust-bulk-status.js): bsPlan_, bsSummary_.
var BS_FIELDS = { status: { label: 'Tình trạng CS', icon: '🏷️', key: 'status' }, khStatus: { label: 'Trạng thái KH', icon: '👤', key: 'khStatus' } };
function bsCur_(phone, care, field) { var c = care && care[phone]; return String((c && c[field]) || '').trim(); }
// opts: { autoKh(status) → khStatus gợi ý }
function bsPlan_(phones, field, newVal, look, care, inScope, opts) {
  var to = String(newVal || '').trim(), out = { field: field, to: to, rows: [], noScope: 0, notFound: 0, same: 0, autoKh: 0, byFrom: {} };
  if (!to || !BS_FIELDS[field]) return out;   // chưa chọn giá trị → không có gì để đổi (tránh vô tình xoá trạng thái)
  var autoKh = opts && opts.autoKh;
  (phones || []).forEach(function (ph) {
    var c = look ? look(ph) : null;
    if (!c) { out.notFound++; return; }
    if (inScope && !inScope(c)) { out.noScope++; return; }
    var from = bsCur_(ph, care, field);
    if (from === to) { out.same++; return; }
    var row = { phone: ph, from: from, to: to, kh: '' };
    if (field === 'status' && autoKh && !bsCur_(ph, care, 'khStatus')) { var k = autoKh(to); if (k) { row.kh = k; out.autoKh++; } }
    out.rows.push(row);
    var key = from || '(trống)'; out.byFrom[key] = (out.byFrom[key] || 0) + 1;
  });
  return out;
}
function bsSummary_(plan) {
  return Object.keys(plan.byFrom).sort(function (a, b) { return plan.byFrom[b] - plan.byFrom[a]; }).map(function (k) { return k + ' ' + plan.byFrom[k]; }).join(', ');
}
function bsEsc_(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bsLook_(ph) { return (typeof _customerByPhone === 'function') ? _customerByPhone(ph) : null; }
function bsScope_(c) { return (typeof _inUserScope === 'function') ? _inUserScope(c) : true; }
function bsPlanNow_(phones, field, to) { return bsPlan_(phones, field, to, bsLook_, (typeof careData !== 'undefined') ? careData : {}, bsScope_, { autoKh: (typeof _hAutoKh_ === 'function') ? _hAutoKh_ : null }); }
function bsOptionsHtml_(field) {
  var holder = document.createElement('select');
  holder.innerHTML = (field === 'status') ? _buildCareStatusOptions('') : _buildCustStatusOptions('');
  if (field === 'status' && typeof _hIsChot_ === 'function') {   // bỏ nhóm "Chốt": phải đặt trong hồ sơ (cần nhập đơn)
    [].slice.call(holder.querySelectorAll('option')).forEach(function (o) { if (o.value && _hIsChot_(o.value)) o.remove(); });
    [].slice.call(holder.querySelectorAll('optgroup')).forEach(function (g) { if (!g.querySelector('option')) g.remove(); });
  }
  return holder.innerHTML;
}
function bsPreviewHtml_(plan, total) {
  if (!plan.to) return '<span class="cs-sel-hint">Chọn giá trị mới để xem trước.</span>';
  var F = BS_FIELDS[plan.field];
  var h = '<div><b>' + plan.rows.length + '</b> / ' + total + ' khách sẽ đổi ' + bsEsc_(F.label) + ' → <b>' + bsEsc_(plan.to) + '</b>' + (plan.rows.length ? ' (từ: ' + bsEsc_(bsSummary_(plan)) + ')' : '') + '.</div>';
  if (plan.autoKh) h += '<div class="cs-sel-hint">' + plan.autoKh + ' khách chưa có Trạng thái KH sẽ được tự điền theo tình trạng mới (như khi lưu hồ sơ).</div>';
  var skip = [];
  if (plan.same) skip.push(plan.same + ' khách đã đúng giá trị này');
  if (plan.noScope) skip.push(plan.noScope + ' khách ngoài phạm vi của bạn');
  if (plan.notFound) skip.push(plan.notFound + ' khách không tìm thấy trong dữ liệu');
  if (skip.length) h += '<div class="cs-sel-hint">Bỏ qua: ' + skip.join(' · ') + '.</div>';
  return h;
}
function bsOpen_(field, phones) {
  phones = phones || []; if (!phones.length) return;
  var F = BS_FIELDS[field]; if (!F) return;
  var old = document.getElementById('bs-modal'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'bs-modal'; ov.className = 'modal-overlay open';
  ov.innerHTML = '<div class="modal cl-modal"><div class="cl-head">' + F.icon + ' Đổi ' + bsEsc_(F.label) + ' cho ' + phones.length + ' khách đã chọn</div><div class="cl-body">' +
    '<label class="cl-f">' + bsEsc_(F.label) + ' mới<select id="bs-to">' + bsOptionsHtml_(field) + '</select></label>' +
    (field === 'status' ? '<div class="cs-sel-hint">Tình trạng nhóm "Chốt" không đặt hàng loạt được (cần nhập đơn trong hồ sơ khách).</div>' : '') +
    '<div id="bs-preview" class="cl-preview"></div></div>' +
    '<div class="cl-foot"><button type="button" class="btn sm" data-bs="close">Đóng</button><button type="button" class="btn sm primary" data-bs="go" disabled>Áp dụng</button></div></div>';
  document.body.appendChild(ov);
  var sel = ov.querySelector('#bs-to'), go = ov.querySelector('[data-bs="go"]'), pv = ov.querySelector('#bs-preview'), plan = null;
  function refresh() { plan = bsPlanNow_(phones, field, sel.value); pv.innerHTML = bsPreviewHtml_(plan, phones.length); go.disabled = !plan.rows.length; go.textContent = plan.rows.length ? 'Áp dụng cho ' + plan.rows.length + ' khách' : 'Áp dụng'; }
  sel.addEventListener('change', refresh); refresh();
  ov.addEventListener('click', function (e) {
    if (e.target === ov || (e.target.closest && e.target.closest('[data-bs="close"]'))) { ov.remove(); return; }
    if (!(e.target.closest && e.target.closest('[data-bs="go"]')) || !plan || !plan.rows.length || go.disabled) return;
    go.disabled = true;   // chống bấm đúp
    bsApply_(plan, phones.length); ov.remove();
  });
}
function bsApply_(plan, total) {
  var F = BS_FIELDS[plan.field], n = 0;
  try {
    plan.rows.forEach(function (r) {
      var ex = careData[r.phone] || {}, nx = Object.assign({}, ex); nx[plan.field] = r.to; if (r.kh) nx.khStatus = r.kh;
      careData[r.phone] = nx; _touchCare(r.phone);
      if (plan.field === 'status') { var c = bsLook_(r.phone); if (c) c.careStatus = r.to; }
      if (plan.rows.length <= 200 && typeof logAudit === 'function') {
        logAudit('status', r.phone, (plan.field === 'khStatus' ? 'KH: ' : '') + (r.from || '(trống)'), (plan.field === 'khStatus' ? 'KH: ' : '') + r.to);
        if (r.kh) logAudit('status', r.phone, 'KH: (trống)', 'KH: ' + r.kh);
      }
      n++;
    });
    saveLS('ome_care', careData);
    if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
    if (typeof gsUrl !== 'undefined' && gsUrl && typeof queueCareSync === 'function') plan.rows.forEach(function (r) { queueCareSync(r.phone); });
    if (typeof updateStats === 'function') updateStats();
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
    if (typeof applyFilters === 'function') applyFilters();
  } catch (e) { if (typeof toast === 'function') toast('❌ Đổi ' + F.label + ' lỗi: ' + (e && e.message || e)); return n; }
  try { if (plan.rows.length > 200 && typeof logAudit === 'function') logAudit('status', '', F.label + ': ' + bsSummary_(plan) + ' (' + n + '/' + total + ' khách)', '→ ' + plan.to); } catch (e) {}
  if (typeof toast === 'function') toast('✓ Đã đổi ' + F.label + ' cho ' + n + ' khách → ' + plan.to + (plan.same + plan.noScope + plan.notFound ? ' (bỏ qua ' + (plan.same + plan.noScope + plan.notFound) + ')' : '') + '.');
  try { csSelClear_(); csSelRepaint_(); } catch (e) {}
  return n;
}
if (typeof csSelAddAction_ === 'function') {
  csSelAddAction_({ id: 'set-status', label: '🏷️ Tình trạng CS', run: function (p) { bsOpen_('status', p); } });
  csSelAddAction_({ id: 'set-kh', label: '👤 Trạng thái KH', run: function (p) { bsOpen_('khStatus', p); } });
}
if (typeof module !== 'undefined') module.exports = { bsPlan_: bsPlan_, bsSummary_: bsSummary_, bsCur_: bsCur_ };

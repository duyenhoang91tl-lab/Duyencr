// R5a bước 2 — "GÁN CS" HÀNG LOẠT cho khách đã chọn ở Danh sách KH (nạp SAU js/82). Duyên chốt 16/11.
// NGUYÊN NHÂN GỐC (R5a): đổi CS chăm sóc cho nhiều khách phải mở hồ sơ từng người (hoặc dùng "Chia data" cho cả danh sách đang lọc, không chọn riêng được).
// KHÔNG viết lại đường ghi: giao thật bằng CHÍNH `_applyCareCSToAssigned` (js/07: careData.cs + careCS + OrderData cột N theo lô 2000 + queueCareSync + làm mới bộ lọc).
// Ai dùng được: admin (mọi CS), leader/manager (CS trong team mình — cùng `clAllowedNames_` của js/74); CS thường KHÔNG thấy nút. Khách NGOÀI phạm vi người dùng
// (`_inUserScope`) hoặc không tìm thấy trong dữ liệu → bỏ qua và báo số lượng. Khách đã đúng CS đó → bỏ qua. Có XEM TRƯỚC + nhật ký.
// Hàm thuần (test: node tools/test-cust-bulk-cs.js): bcPlan_, bcEntries_, bcSummary_.
function bcCsOf_(phone, care, cust) { var c = care && care[phone]; return String((c && c.cs) || (cust && cust.careCS) || '').trim(); }
// phones → kế hoạch. look(phone) trả khách (hoặc null); inScope(khách) → bool.
function bcPlan_(phones, newCs, look, care, inScope) {
  var to = String(newCs || '').trim(), rows = [], out = { to: to, rows: rows, noScope: 0, notFound: 0, same: 0, byFrom: {} };
  if (!to) return out;   // chưa chọn CS nhận → không có gì để giao (tránh vô tình gán CS rỗng = xoá CS chăm sóc)
  (phones || []).forEach(function (ph) {
    var c = look ? look(ph) : null;
    if (!c) { out.notFound++; return; }
    if (inScope && !inScope(c)) { out.noScope++; return; }
    var from = bcCsOf_(ph, care, c);
    if (to && from.toLowerCase() === to.toLowerCase()) { out.same++; return; }
    rows.push({ phone: ph, from: from, to: to });
    var k = from || '(chưa có CS)'; out.byFrom[k] = (out.byFrom[k] || 0) + 1;
  });
  return out;
}
function bcEntries_(plan) { return plan.rows.length ? [{ csName: plan.to, phones: plan.rows.map(function (r) { return r.phone; }) }] : []; }
function bcSummary_(plan) {
  var parts = Object.keys(plan.byFrom).sort(function (a, b) { return plan.byFrom[b] - plan.byFrom[a]; }).map(function (k) { return k + ' ' + plan.byFrom[k]; });
  return parts.join(', ');
}
function bcEsc_(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bcAllowed_() {
  var r = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
  return r === 'admin' || r === 'leader' || r === 'manager';
}
function bcNames_() { return (typeof clAllowedNames_ === 'function') ? clAllowedNames_(currentUser, teams, accounts) : []; }
function bcLook_(ph) { return (typeof _customerByPhone === 'function') ? _customerByPhone(ph) : null; }
function bcScope_(c) { return (typeof _inUserScope === 'function') ? _inUserScope(c) : true; }
function bcPlanNow_(phones, to) { return bcPlan_(phones, to, bcLook_, (typeof careData !== 'undefined') ? careData : {}, bcScope_); }
function bcPreviewHtml_(plan, total) {
  if (!plan.to) return '<span class="cs-sel-hint">Chọn CS nhận khách để xem trước.</span>';
  var h = '<div><b>' + plan.rows.length + '</b> / ' + total + ' khách sẽ chuyển sang <b>' + bcEsc_(plan.to) + '</b>' + (plan.rows.length ? ' (từ: ' + bcEsc_(bcSummary_(plan)) + ')' : '') + '.</div>';
  var skip = [];
  if (plan.same) skip.push(plan.same + ' khách đã là ' + bcEsc_(plan.to));
  if (plan.noScope) skip.push(plan.noScope + ' khách ngoài phạm vi của bạn');
  if (plan.notFound) skip.push(plan.notFound + ' khách không tìm thấy trong dữ liệu');
  if (skip.length) h += '<div class="cs-sel-hint">Bỏ qua: ' + skip.join(' · ') + '.</div>';
  return h;
}
function bcOpen_(phones) {
  if (!bcAllowed_()) { if (typeof toast === 'function') toast('Chỉ admin / leader / manager mới gán CS hàng loạt.'); return; }
  phones = phones || []; if (!phones.length) return;
  var names = bcNames_();
  if (!names.length) { if (typeof toast === 'function') toast('Chưa có nhân viên nào để gán (chưa có team/tài khoản).'); return; }
  var old = document.getElementById('bc-modal'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'bc-modal'; ov.className = 'modal-overlay open';
  ov.innerHTML = '<div class="modal cl-modal"><div class="cl-head">👥 Gán CS cho ' + phones.length + ' khách đã chọn</div><div class="cl-body">' +
    '<label class="cl-f">CS nhận khách<select id="bc-to"><option value="">— chọn —</option>' + names.map(function (n) { return '<option>' + bcEsc_(n) + '</option>'; }).join('') + '</select></label>' +
    '<div id="bc-preview" class="cl-preview"></div></div>' +
    '<div class="cl-foot"><button type="button" class="btn sm" data-bc="close">Đóng</button><button type="button" class="btn sm primary" data-bc="go" disabled>Giao khách</button></div></div>';
  document.body.appendChild(ov);
  var sel = ov.querySelector('#bc-to'), go = ov.querySelector('[data-bc="go"]'), pv = ov.querySelector('#bc-preview'), plan = null;
  function refresh() { plan = bcPlanNow_(phones, sel.value); pv.innerHTML = bcPreviewHtml_(plan, phones.length); go.disabled = !plan.rows.length; go.textContent = plan.rows.length ? 'Giao ' + plan.rows.length + ' khách' : 'Giao khách'; }
  sel.addEventListener('change', refresh); refresh();
  ov.addEventListener('click', function (e) {
    if (e.target === ov || (e.target.closest && e.target.closest('[data-bc="close"]'))) { ov.remove(); return; }
    if (!(e.target.closest && e.target.closest('[data-bc="go"]')) || !plan || !plan.rows.length || go.disabled) return;
    go.disabled = true;   // chống bấm đúp
    bcApply_(plan, phones.length); ov.remove();
  });
}
function bcApply_(plan, total) {
  var n = 0;
  try { n = _applyCareCSToAssigned(bcEntries_(plan)); } catch (e) { if (typeof toast === 'function') toast('❌ Gán CS lỗi: ' + (e && e.message || e)); return 0; }
  try { if (typeof logAudit === 'function') logAudit('bulk_assign_cs', '', bcSummary_(plan) + ' (' + plan.rows.length + '/' + total + ' khách)', '→ ' + plan.to); } catch (e) {}
  if (typeof toast === 'function') toast('✓ Đã gán ' + n + ' khách cho ' + plan.to + (plan.same + plan.noScope + plan.notFound ? ' (bỏ qua ' + (plan.same + plan.noScope + plan.notFound) + ')' : '') + '.');
  try { csSelClear_(); csSelRepaint_(); } catch (e) {}
  return n;
}
if (typeof csSelAddAction_ === 'function') csSelAddAction_({ id: 'assign-cs', label: '👥 Gán CS', run: bcOpen_, visible: bcAllowed_ });
if (typeof module !== 'undefined') module.exports = { bcPlan_: bcPlan_, bcEntries_: bcEntries_, bcSummary_: bcSummary_, bcCsOf_: bcCsOf_ };

// R5a bước 3 — "ĐỔI TRẠNG THÁI" HÀNG LOẠT cho khách đã chọn ở Danh sách KH (nạp SAU js/82). Duyên chốt 16/11 + 17/11: gán CS + đổi trạng thái.
// NGUYÊN NHÂN GỐC (R5a): đổi Tình trạng CS / Trạng thái KH cho nhiều khách phải mở hồ sơ từng người.
// Đổi được: Tình trạng CS (`careData[ph].status`) và/hoặc Trạng thái KH (`careData[ph].khStatus`). Để trống 1 ô = giữ nguyên ô đó.
// Cùng quy tắc với hồ sơ khách (`saveCare`, js/03): đổi Tình trạng CS mà không chọn KH → KH TỰ NHẢY theo `_hAutoKh_` (không có quy tắc thì giữ KH cũ).
// KHÔNG cho chọn tình trạng thuộc nhóm "Chốt" (`_hIsChot_`): chốt phải nhập doanh thu/ghi chú đơn trong hồ sơ từng khách → ẩn khỏi danh sách.
// Ghi: careData + `_touchCare` (đặt trực tiếp, KHÔNG gọi _touchCare vì nó quét 136k khách cho từng SĐT) + saveLS + queueCareSync (lô sẵn có) + 1 dòng nhật ký tổng `bulk_status`.
// Ai dùng: mọi vai trò, nhưng chỉ với khách trong phạm vi của mình (`_inUserScope`); khách ngoài phạm vi / không tìm thấy / không đổi gì → bỏ qua và báo số lượng.
// Hàm thuần (test: node tools/test-cust-bulk-status.js): bsLeaves_, bsPlan_, bsSummary_.
function bsLeaves_(tree, isChot) {
  var out = [];
  (tree || []).forEach(function (n) {
    var kids = n.children || null;
    if (kids) { kids.forEach(function (c) { if (c && c.value && !(isChot && isChot(c.value))) out.push({ value: c.value, label: (n.label ? n.label + ' - ' : '') + (c.label || c.value) }); }); }
    else if (n.value && !(isChot && isChot(n.value))) out.push({ value: n.value, label: n.label || n.value });
  });
  return out;
}
// phones → kế hoạch. look(phone) trả khách|null; inScope(khách) → bool; autoKh(status) → KH mặc định theo tình trạng CS ('' nếu không có quy tắc).
function bsPlan_(phones, newStatus, newKh, look, care, inScope, autoKh) {
  var st = String(newStatus || ''), kh = String(newKh || ''), out = { status: st, kh: kh, rows: [], noScope: 0, notFound: 0, same: 0, byStatus: {}, byKh: {} };
  if (!st && !kh) return out;   // không chọn gì → không đổi gì (tránh vô tình xoá trạng thái)
  (phones || []).forEach(function (ph) {
    var c = look ? look(ph) : null;
    if (!c) { out.notFound++; return; }
    if (inScope && !inScope(c)) { out.noScope++; return; }
    var ex = (care && care[ph]) || {}, fromSt = String(ex.status || ''), fromKh = String(ex.khStatus || '');
    var toSt = st || fromSt;
    var toKh = kh || (st ? ((autoKh && autoKh(st)) || fromKh) : fromKh);
    if (toSt === fromSt && toKh === fromKh) { out.same++; return; }
    out.rows.push({ phone: ph, fromStatus: fromSt, toStatus: toSt, fromKh: fromKh, toKh: toKh });
    if (toSt !== fromSt) { var a = fromSt || '(trống)'; out.byStatus[a] = (out.byStatus[a] || 0) + 1; }
    if (toKh !== fromKh) { var b = fromKh || '(trống)'; out.byKh[b] = (out.byKh[b] || 0) + 1; }
  });
  return out;
}
function bsTop_(m) { return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).map(function (k) { return k + ' ' + m[k]; }).join(', '); }
function bsSummary_(plan) {
  var p = [];
  if (plan.status) p.push('Tình trạng CS → ' + plan.status + (Object.keys(plan.byStatus).length ? ' (từ: ' + bsTop_(plan.byStatus) + ')' : ''));
  var khChanged = Object.keys(plan.byKh).length;
  if (khChanged) p.push('KH' + (plan.kh ? ' → ' + plan.kh : ' (tự theo tình trạng)') + ' (từ: ' + bsTop_(plan.byKh) + ')');
  return p.join('; ');
}
function bsEsc_(s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function bsLook_(ph) { return (typeof _customerByPhone === 'function') ? _customerByPhone(ph) : null; }
function bsScope_(c) { return (typeof _inUserScope === 'function') ? _inUserScope(c) : true; }
function bsAuto_(st) { try { return (typeof _hAutoKh_ === 'function') ? (_hAutoKh_(st) || '') : ''; } catch (e) { return ''; } }
function bsIsChot_(v) { try { return (typeof _hIsChot_ === 'function') && _hIsChot_(v); } catch (e) { return false; } }
function bsPlanNow_(phones, st, kh) { return bsPlan_(phones, st, kh, bsLook_, (typeof careData !== 'undefined') ? careData : {}, bsScope_, bsAuto_); }
function bsOptions_(list) { return '<option value="">— giữ nguyên —</option>' + list.map(function (o) { return '<option value="' + bsEsc_(o.value) + '">' + bsEsc_(o.label) + '</option>'; }).join(''); }
function bsPreviewHtml_(plan, total) {
  if (!plan.status && !plan.kh) return '<span class="cs-sel-hint">Chọn Tình trạng CS và/hoặc Trạng thái KH mới để xem trước.</span>';
  var h = '<div><b>' + plan.rows.length + '</b> / ' + total + ' khách sẽ được đổi.</div>';
  if (plan.rows.length) h += '<div class="cs-sel-hint">' + bsEsc_(bsSummary_(plan)) + '</div>';
  var skip = [];
  if (plan.same) skip.push(plan.same + ' khách đã đúng trạng thái đó');
  if (plan.noScope) skip.push(plan.noScope + ' khách ngoài phạm vi của bạn');
  if (plan.notFound) skip.push(plan.notFound + ' khách không tìm thấy trong dữ liệu');
  if (skip.length) h += '<div class="cs-sel-hint">Bỏ qua: ' + skip.join(' · ') + '.</div>';
  if (plan.status && !plan.kh) h += '<div class="cs-sel-hint">Trạng thái KH tự nhảy theo Tình trạng CS (giống trong hồ sơ); chọn KH ở trên nếu muốn đặt cố định.</div>';
  return h;
}
function bsOpen_(phones) {
  phones = phones || []; if (!phones.length) return;
  var care = (typeof CARE_STATUS_TREE !== 'undefined') ? bsLeaves_(CARE_STATUS_TREE, bsIsChot_) : [];
  var kh = (typeof CUSTOMER_STATUS_TREE !== 'undefined') ? bsLeaves_(CUSTOMER_STATUS_TREE, null) : [];
  if (!care.length && !kh.length) { if (typeof toast === 'function') toast('Chưa có danh sách trạng thái nào để chọn.'); return; }
  var old = document.getElementById('bs-modal'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'bs-modal'; ov.className = 'modal-overlay open';
  ov.innerHTML = '<div class="modal cl-modal"><div class="cl-head">🏷 Đổi trạng thái cho ' + phones.length + ' khách đã chọn</div><div class="cl-body">' +
    '<label class="cl-f">Tình trạng CS<select id="bs-st">' + bsOptions_(care) + '</select></label>' +
    '<label class="cl-f">Trạng thái KH<select id="bs-kh">' + bsOptions_(kh) + '</select></label>' +
    '<div class="cs-sel-hint">Tình trạng thuộc nhóm “Chốt” không có ở đây — hãy mở hồ sơ từng khách để nhập doanh thu đơn chốt.</div>' +
    '<div id="bs-preview" class="cl-preview"></div></div>' +
    '<div class="cl-foot"><button type="button" class="btn sm" data-bs="close">Đóng</button><button type="button" class="btn sm primary" data-bs="go" disabled>Đổi trạng thái</button></div></div>';
  document.body.appendChild(ov);
  var sSt = ov.querySelector('#bs-st'), sKh = ov.querySelector('#bs-kh'), go = ov.querySelector('[data-bs="go"]'), pv = ov.querySelector('#bs-preview'), plan = null;
  function refresh() { plan = bsPlanNow_(phones, sSt.value, sKh.value); pv.innerHTML = bsPreviewHtml_(plan, phones.length); go.disabled = !plan.rows.length; go.textContent = plan.rows.length ? 'Đổi ' + plan.rows.length + ' khách' : 'Đổi trạng thái'; }
  sSt.addEventListener('change', refresh); sKh.addEventListener('change', refresh); refresh();
  ov.addEventListener('click', function (e) {
    if (e.target === ov || (e.target.closest && e.target.closest('[data-bs="close"]'))) { ov.remove(); return; }
    if (!(e.target.closest && e.target.closest('[data-bs="go"]')) || !plan || !plan.rows.length || go.disabled) return;
    go.disabled = true;   // chống bấm đúp
    bsApply_(plan, phones.length); ov.remove();
  });
}
// Ghi thật. Cùng thứ tự với saveCare (js/03) nhưng theo lô: không quét allCustomers cho từng SĐT.
function bsApply_(plan, total) {
  var n = 0, cmap = null, now = new Date().toISOString(), nowMs = Date.now();
  try {
    if (typeof careData === 'undefined') throw new Error('chưa có dữ liệu chăm sóc');
    cmap = (typeof _assignCustMap === 'function' && typeof allCustomers !== 'undefined') ? _assignCustMap() : null;
    plan.rows.forEach(function (r) {
      var ex = careData[r.phone] || {};
      careData[r.phone] = Object.assign({}, ex, { status: r.toStatus, khStatus: r.toKh, updated: now });
      var c = cmap ? cmap.get(r.phone) : (typeof bsLook_ === 'function' ? bsLook_(r.phone) : null);
      if (c) { c.careStatus = r.toStatus; c._lastActionDate = nowMs; }
      n++;
    });
    if (typeof saveLS === 'function') saveLS('ome_care', careData);
    if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
    if (typeof gsUrl !== 'undefined' && gsUrl && typeof queueCareSync === 'function') plan.rows.forEach(function (r) { queueCareSync(r.phone); });
    if (typeof updateStats === 'function') updateStats();
    if (typeof updateSidebarBadges === 'function') updateSidebarBadges();
    if (typeof applyFilters === 'function') applyFilters();
  } catch (e) { if (typeof toast === 'function') toast('❌ Đổi trạng thái lỗi: ' + (e && e.message || e)); return n; }
  try { if (typeof logAudit === 'function') logAudit('bulk_status', '', bsSummary_(plan) + ' (' + plan.rows.length + '/' + total + ' khách)', plan.status || plan.kh ? ((plan.status ? 'CS: ' + plan.status : '') + (plan.status && plan.kh ? '; ' : '') + (plan.kh ? 'KH: ' + plan.kh : '')) : ''); } catch (e) {}
  if (typeof toast === 'function') toast('✓ Đã đổi trạng thái ' + n + ' khách' + (plan.same + plan.noScope + plan.notFound ? ' (bỏ qua ' + (plan.same + plan.noScope + plan.notFound) + ')' : '') + '.');
  try { csSelClear_(); csSelRepaint_(); } catch (e) {}
  return n;
}
if (typeof csSelAddAction_ === 'function') csSelAddAction_({ id: 'bulk-status', label: '🏷 Đổi trạng thái', run: bsOpen_ });
if (typeof module !== 'undefined') module.exports = { bsLeaves_: bsLeaves_, bsPlan_: bsPlan_, bsSummary_: bsSummary_ };

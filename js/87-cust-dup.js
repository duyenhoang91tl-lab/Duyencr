// R5d bước 1 — KHÁCH TRÙNG THEO SĐT (CHỈ XEM, chưa sửa dữ liệu). Duyên chốt 16/11: trùng tính theo SĐT; khi gộp sau này phải GIỮ TẤT CẢ dữ liệu.
// NGUYÊN NHÂN GỐC: CareData khoá theo SĐT nhưng 1 khách có thể nằm ở NHIỀU dòng khi SĐT gõ khác dạng (0912… / 912… / 84912… / +84912…). Màn hình đã gộp theo normPhone
// nên nhìn thấy 1 khách, còn Sheet giữ nhiều dòng → ghi chú/lịch ở dòng này, trạng thái/CS ở dòng kia, và `dedupeCare` cũ chỉ GIỮ 1 dòng (mất phần còn lại).
// File này chỉ HIỂN THỊ kết quả GAS `findDuplicateCustomers` (chỉ đọc). Chỉ quản trị viên chính. KHÔNG đụng đơn hàng: báo cáo doanh thu vẫn theo đơn của khách như cũ.
// Hàm thuần (test: node tools/test-cust-dup.js): cdEsc_, cdRowHtml_, cdGroupHtml_, cdSummaryHtml_, cdBodyHtml_, cdErrText_.
function cdEsc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function cdRowHtml_(r, keep) {
  return '<tr' + (keep ? ' class="cd-keep"' : '') + '><td>' + cdEsc_(r.row) + '</td><td>' + cdEsc_(r.raw) + '</td><td>' + cdEsc_(r.name) + '</td><td>' + cdEsc_(r.cs) +
    '</td><td>' + cdEsc_(r.status) + '</td><td>' + cdEsc_(r.khStatus) + '</td><td>' + (r.noteLen ? r.noteLen + ' ký tự' : '') + '</td><td>' + (r.hasSched ? '✓' : '') +
    '</td><td>' + cdEsc_(r.nickZalos) + '</td><td>' + cdEsc_(r.updated) + '</td><td>' + (keep ? '⭐ gợi ý giữ' : '') + '</td></tr>';
}
function cdGroupHtml_(g) {
  var rows = (g.rows || []).map(function (r) { return cdRowHtml_(r, r.row === g.keepRow); }).join('');
  return '<div class="cd-group"><div class="cd-gh"><b>' + cdEsc_(g.phone) + '</b> · ' + cdEsc_(g.count) + ' dòng · gõ kiểu: ' + (g.variants || []).map(cdEsc_).join(' | ') +
    ' <button type="button" class="btn sm" data-cd-open="' + cdEsc_(g.phone) + '">Mở hồ sơ</button></div>' +
    '<div class="cd-scroll"><table class="cd-t"><thead><tr><th>Dòng Sheet</th><th>SĐT gốc</th><th>Tên</th><th>CS</th><th>Tình trạng</th><th>Trạng thái KH</th><th>Ghi chú</th><th>Lịch</th><th>Nick Zalo</th><th>Cập nhật</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}
function cdSummaryHtml_(res) {
  if (!res.groupCount) return '<div class="cd-ok">✅ Không có khách nào trùng SĐT trong CareData (đã quét ' + cdEsc_(res.scanned || 0) + ' dòng).</div>';
  return '<div><b>' + cdEsc_(res.groupCount) + '</b> nhóm khách trùng SĐT · <b>' + cdEsc_(res.extraRows) + '</b> dòng thừa · đã quét ' + cdEsc_(res.scanned) + ' dòng' +
    (res.truncated ? ' · <b>chỉ hiện ' + cdEsc_((res.groups || []).length) + ' nhóm đầu</b>' : '') + '.</div>';
}
function cdBodyHtml_(res) {
  return '<div class="cd-note">Chỉ XEM — chưa sửa dữ liệu nào. Đơn hàng không bị đụng tới: báo cáo doanh thu vẫn tính theo đơn của từng khách như cũ. ' +
    'Khi gộp (bước sau) sẽ GIỮ TẤT CẢ ghi chú / lịch / nick Zalo, có xem trước và nhật ký.</div>' + cdSummaryHtml_(res) + (res.groups || []).map(cdGroupHtml_).join('');
}
function cdErrText_(res) {
  if (!res) return 'Không nhận được phản hồi từ máy chủ.';
  if (res.code === 'FORBIDDEN') return 'Chỉ quản trị viên chính mới xem được danh sách khách trùng.';
  var e = String(res.error || '');
  if (/unknown|khong hop le|không hợp lệ|invalid action/i.test(e)) return 'Máy chủ chưa có chức năng này (GAS chưa được deploy bản mới) — chờ workflow deploy-gas xanh rồi thử lại.';
  return e || 'Không quét được khách trùng.';
}
function cdAllowed_() { return typeof currentUser !== 'undefined' && !!currentUser && currentUser.role === 'admin'; }
async function cdOpen_() {
  if (!cdAllowed_()) { if (typeof toast === 'function') toast('Chỉ admin mới xem khách trùng.'); return; }
  if (typeof gsUrl === 'undefined' || !gsUrl) { if (typeof toast === 'function') toast('Chưa kết nối Google Sheets.'); return; }
  var old = document.getElementById('cd-modal'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'cd-modal'; ov.className = 'modal-overlay open';
  ov.innerHTML = '<div class="modal cl-modal cd-modal-in"><div class="cl-head">🔎 Khách trùng SĐT (chỉ xem)</div><div class="cl-body" id="cd-body">Đang quét CareData…</div>' +
    '<div class="cl-foot"><button type="button" class="btn sm" data-cd="close">Đóng</button><button type="button" class="btn sm" data-cd="again">Quét lại</button></div></div>';
  document.body.appendChild(ov);
  var body = ov.querySelector('#cd-body');
  ov.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t === ov || t.closest('[data-cd="close"]')) { ov.remove(); return; }
    if (t.closest('[data-cd="again"]')) { run(); return; }
    var o = t.closest('[data-cd-open]'); if (o && typeof openDp === 'function') { ov.remove(); openDp(o.getAttribute('data-cd-open')); }
  });
  async function run() {
    body.textContent = 'Đang quét CareData…';
    try {
      var r = await fetch(gsUrl + (gsUrl.indexOf('?') > -1 ? '&' : '?') + 'action=findDuplicateCustomers', { redirect: 'follow' });
      var j = await r.json();
      body.innerHTML = (j && j.ok && !j.error) ? cdBodyHtml_(j) : '<div class="cd-err">' + cdEsc_(cdErrText_(j)) + '</div>';
    } catch (e) { body.innerHTML = '<div class="cd-err">' + cdEsc_('Lỗi mạng: ' + (e && e.message || e)) + '</div>'; }
  }
  run();
}
// Nút ở thanh công cụ Danh sách KH (cạnh "Thêm khách"); chỉ admin thấy. currentUser nạp sau khi đăng nhập → dò nhẹ tới khi có.
(function () {
  if (typeof document === 'undefined' || !document.getElementById) return;
  var tries = 0, t = setInterval(function () {
    tries++;
    var anchor = document.getElementById('quick-add-btn');
    if (document.getElementById('cd-open-btn')) { clearInterval(t); return; }
    if (anchor && cdAllowed_()) {
      var b = document.createElement('button'); b.type = 'button'; b.id = 'cd-open-btn'; b.className = 'btn sm'; b.textContent = '🔎 Khách trùng';
      b.title = 'Xem các khách bị trùng SĐT trong CareData (chỉ xem, chưa sửa dữ liệu)'; b.addEventListener('click', cdOpen_);
      anchor.insertAdjacentElement('afterend', b); clearInterval(t);
    }
    if (tries > 60) clearInterval(t);
  }, 1500);
})();
if (typeof module !== 'undefined') module.exports = { cdEsc_, cdRowHtml_, cdGroupHtml_, cdSummaryHtml_, cdBodyHtml_, cdErrText_ };

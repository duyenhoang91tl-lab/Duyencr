// ĐƠN POS THEO TỪNG ĐƠN (client) — BƯỚC 2/7 của "Danh sách KH khớp đơn POS" (HANDOFF 2026-11-17).
// NGUYÊN NHÂN GỐC cần file này: `donPhones` chỉ cho client tập SĐT + sale "từng có" + 1 ngày mới nhất + DT cả đời, nên Danh sách KH không có
// NGÀY / SALE / DOANH THU của TỪNG đơn POS để lọc theo ngày + CS khớp Báo cáo B. Bước 1 (GAS) đã thêm action `donDaily`; file này NẠP nó và giữ trong RAM:
//   posOrdersByPhone = { '0912345678': [ { ds:'2026-11-16', name:'Lê Thảo', sales:['biichnguyen1993','x'], rev:3300000, shares:{ biichnguyen1993:1650000, x:1650000 } } ] }
// CHỈ GIỮ TRONG RAM (không saveLS): vài chục nghìn đơn thì localStorage đồng bộ làm lag luồng chính. Mặc định tải 90 ngày; muốn xa hơn thì gọi
// posOrdersEnsureCovers_('YYYY-MM-DD') (tải theo khoảng rộng hơn, tối đa 400 ngày — GAS giới hạn). Bước 3–6 sẽ dùng posOrdersByPhone, file này CHƯA đổi giao diện.
// Gỡ = xoá dòng <script> trong index.html + 1 dòng gọi posOrdersSync_ ở js/01 (không file nào khác phụ thuộc).
var posOrdersByPhone = {};
var posOrdersMeta = { ok: false, days: 0, from: '', to: '', n: 0, skipped: null, loadedAt: 0, ver: '' };
var posOrdersVer = 0;                 // tăng mỗi lần dữ liệu đổi → các bộ lọc/memo bước sau so sánh số này
var _posOrdersLastText = null, _posOrdersBusy = null;
var POS_ORDERS_DAYS_DEFAULT = 90, POS_ORDERS_DAYS_MAX = 400, POS_ORDERS_REFRESH_MS = 120000;   // GAS cache donDaily 600s → hỏi lại mỗi 2 phút là đủ

// rows từ GAS: [phone, 'YYYY-MM-DD', 'tên khách', [sale...], doanhThuCảĐơn, [[sale, phầnChia]...]] → map theo SĐT. Hàm thuần (test được).
function posOrdersBuild_(rows) {
  var out = {};
  (rows || []).forEach(function (r) {
    if (!r || r.length < 5) return;
    var ph = String(r[0] || ''), ds = String(r[1] || '');
    if (!ph || !/^\d{4}-\d{2}-\d{2}$/.test(ds)) return;
    var shares = {};
    (r[5] || []).forEach(function (p) { if (p && p[0] != null) shares[String(p[0])] = Number(p[1]) || 0; });
    (out[ph] = out[ph] || []).push({
      ds: ds, name: String(r[2] || ''), sales: (r[3] || []).map(String), rev: Number(r[4]) || 0, shares: shares
    });
  });
  Object.keys(out).forEach(function (ph) { out[ph].sort(function (a, b) { return a.ds < b.ds ? 1 : a.ds > b.ds ? -1 : 0; }); });   // mới nhất trước
  return out;
}
// Nhận JSON `donDaily` đã parse. Trả true nếu nhận được (kể cả 0 đơn). Sai định dạng → giữ dữ liệu cũ, trả false.
function posOrdersIngest_(j) {
  if (!j || j.ok === false || !Array.isArray(j.rows)) return false;
  posOrdersByPhone = posOrdersBuild_(j.rows);
  posOrdersMeta = { ok: true, days: Number(j.days) || 0, from: String(j.from || ''), to: String(j.to || ''), n: j.rows.length, skipped: j.skipped || null, loadedAt: Date.now(), ver: String(j.ver || '') };
  posOrdersVer++;
  return true;
}
function posOrdersOf_(phone) { return posOrdersByPhone[phone] || []; }
// Đã nạp đủ tới ngày `fromYmd` chưa? (chưa nạp gì → false)
function posOrdersCovers_(fromYmd) { return !!(posOrdersMeta.ok && posOrdersMeta.from && String(fromYmd || '') >= posOrdersMeta.from); }
function _posOrdersDaysFor_(fromYmd) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fromYmd || '')); if (!m) return POS_ORDERS_DAYS_DEFAULT;
  var t = new Date(); var today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  var d = Math.round((today - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000) + 1;
  return Math.max(1, Math.min(POS_ORDERS_DAYS_MAX, d));
}
// Tải `donDaily` (days ngày). Không chồng 2 lần cùng lúc. Nội dung y hệt lần trước → bỏ qua (không dựng lại map). Trả Promise<{ok, changed, error?}>.
function posOrdersSync_(opt) {
  opt = opt || {};
  if (typeof gsUrl === 'undefined' || !gsUrl) return Promise.resolve({ ok: false, error: 'chưa cấu hình gsUrl' });
  var days = Math.max(1, Math.min(POS_ORDERS_DAYS_MAX, Number(opt.days) || POS_ORDERS_DAYS_DEFAULT));
  // Đã nạp rộng hơn hoặc bằng yêu cầu và còn mới → khỏi hỏi lại (trừ khi ép).
  if (!opt.force && posOrdersMeta.ok && posOrdersMeta.days >= days && (Date.now() - posOrdersMeta.loadedAt) < POS_ORDERS_REFRESH_MS) return Promise.resolve({ ok: true, changed: false, cached: true });
  if (_posOrdersBusy) return _posOrdersBusy;
  var sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
  // Đang giữ khoảng rộng hơn (người dùng đã mở rộng) thì nhịp định kỳ vẫn tải đúng khoảng đó, không tụt về 90 ngày.
  if (!opt.days && posOrdersMeta.ok && posOrdersMeta.days > days) days = posOrdersMeta.days;
  var url = gsUrl + sep + 'action=donDaily&days=' + days;
  var go = (typeof _gsFetchTO_ === 'function') ? _gsFetchTO_(url, 60000) : fetch(url, { redirect: 'follow' });
  _posOrdersBusy = go.then(function (r) { return r.text(); }).then(function (txt) {
    if (txt === _posOrdersLastText && posOrdersMeta.ok) { posOrdersMeta.loadedAt = Date.now(); return { ok: true, changed: false }; }
    var j = JSON.parse(txt);                       // lỗi parse → catch, _posOrdersLastText chưa đổi nên nhịp sau thử lại
    if (j && j.error) return { ok: false, error: String(j.error) };   // vd GAS cũ chưa có action donDaily
    if (!posOrdersIngest_(j)) return { ok: false, error: 'dữ liệu donDaily sai định dạng' };
    _posOrdersLastText = txt;
    return { ok: true, changed: true };
  }).catch(function (e) { return { ok: false, error: (e && e.message) || String(e) }; })
    .then(function (res) { _posOrdersBusy = null; return res; });
  return _posOrdersBusy;
}
// Người dùng chọn khoảng ngày xa hơn đang có → tải rộng tới `fromYmd` (tối đa 400 ngày). Trả {ok, covered, limit}.
function posOrdersEnsureCovers_(fromYmd) {
  if (posOrdersCovers_(fromYmd)) return Promise.resolve({ ok: true, covered: true, limit: false });
  var days = _posOrdersDaysFor_(fromYmd);
  return posOrdersSync_({ days: days, force: true }).then(function (res) {
    var limit = days >= POS_ORDERS_DAYS_MAX && !posOrdersCovers_(fromYmd);
    return { ok: !!res.ok, covered: posOrdersCovers_(fromYmd), limit: limit, error: res.error };
  });
}

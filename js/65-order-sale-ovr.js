// ═══════════════════════════════════════════════════════
//  ÉP SALE THEO TỪNG ĐƠN (04/11/2026) — admin nhập "mã bộ đếm đơn gốc → tên sale"; đơn đó tính 100% doanh thu/số đơn/thưởng/hoa hồng cho đúng người đó,
//  bất kể Base/thẻ Pos ghi 2 người (vd 162T10 chỉ Yến, 430T10 chỉ Hà). Lưu Settings 'orderSaleOverride' = {"162T10/2026":"yenNTH2004"} — backend
//  gas_v13.js `_applyOrderSaleOvr_` đọc trong buildSalesReportB_. Menu: Cài đặt team → "📌 Ép sale theo đơn" (js/29-sidenav.js, ACTS.ordersale).
// ═══════════════════════════════════════════════════════
var _oso = { rows: [] };
// Chuẩn hoá 1 mã bộ đếm: bỏ khoảng trắng, IN HOA; trả '' nếu không đúng dạng 162T10 / 162T10/2026 / NG83T10/2026.
function _osoNormCode_(c){
  var s = String(c == null ? '' : c).replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{0,3}\d{1,6}[A-Z]{0,3}T\d{1,2}(\/\d{2,4})?$/.test(s) ? s : '';
}
// rows [{code,name}] → { obj, errors[] } (bỏ dòng trống hoàn toàn; báo lỗi dòng thiếu/sai mã, thiếu tên, trùng mã)
function _osoBuild_(rows){
  var obj = {}, errors = [], seen = {};
  (rows || []).forEach(function(r, i){
    var rawC = String((r && r.code) || '').trim(), name = String((r && r.name) || '').trim();
    if (!rawC && !name) return;
    var c = _osoNormCode_(rawC);
    if (!c) { errors.push('Dòng ' + (i + 1) + ': mã đơn "' + rawC + '" không đúng dạng (vd 162T10/2026)'); return; }
    if (!name) { errors.push('Dòng ' + (i + 1) + ': thiếu tên sale cho ' + c); return; }
    var k = c.replace(/\/\d{2,4}$/, '');
    if (seen[k]) { errors.push('Dòng ' + (i + 1) + ': mã ' + c + ' bị trùng với dòng ' + seen[k]); return; }
    seen[k] = i + 1; obj[c] = name;
  });
  return { obj: obj, errors: errors };
}
function _osoToRows_(obj){ return Object.keys(obj || {}).map(function(k){ return { code: k, name: String(obj[k] == null ? '' : obj[k]) }; }); }

function _osoEnsure_(){
  var ov = document.getElementById('oso-overlay'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'oso-overlay';
  ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3500;align-items:center;justify-content:center;padding:12px';
  ov.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:560px;width:100%;max-height:90vh;display:flex;flex-direction:column;overflow:hidden">' +
    '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eee"><b style="flex:1">📌 Ép sale theo đơn</b><button type="button" class="btn secondary sm" id="oso-close">✕</button></div>' +
    '<div style="padding:10px 14px;font-size:12px;color:#555;line-height:1.5">Đơn có <b>mã bộ đếm</b> bên dưới sẽ tính <b>100%</b> doanh thu / số đơn / thưởng / hoa hồng cho đúng người ghi, dù Base hoặc thẻ Pos ghi 2 người. Giá trị đơn giữ nguyên. Ví dụ: <code>162T10/2026</code> → <code>yenNTH2004</code>.</div>' +
    '<div id="oso-body" style="padding:0 14px;overflow:auto;flex:1"></div>' +
    '<div id="oso-err" style="padding:6px 14px;color:#b91c1c;font-size:12px"></div>' +
    '<div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid #eee"><button type="button" class="btn secondary sm" id="oso-add">+ Thêm dòng</button><span style="flex:1"></span><button type="button" class="btn" id="oso-save">💾 Lưu</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.style.display = 'none'; });
  document.getElementById('oso-close').addEventListener('click', function(){ ov.style.display = 'none'; });
  document.getElementById('oso-add').addEventListener('click', function(){ _osoRead_(); _oso.rows.push({ code: '', name: '' }); _osoRender_(); });
  document.getElementById('oso-save').addEventListener('click', osoSave);
  document.getElementById('oso-body').addEventListener('click', function(e){
    var b = e.target.closest('[data-osodel]'); if (!b) return;
    _osoRead_(); _oso.rows.splice(parseInt(b.getAttribute('data-osodel'), 10), 1); _osoRender_();
  });
  return ov;
}
function _osoRead_(){
  var body = document.getElementById('oso-body'); if (!body) return;
  var rows = [];
  body.querySelectorAll('[data-osorow]').forEach(function(tr){
    rows.push({ code: tr.querySelector('.oso-c').value, name: tr.querySelector('.oso-n').value });
  });
  _oso.rows = rows;
}
function _osoRender_(){
  var body = document.getElementById('oso-body'); if (!body) return;
  var h = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;color:#666"><th style="padding:4px">Mã đơn (bộ đếm)</th><th style="padding:4px">Tên sale</th><th></th></tr></thead><tbody>';
  if (!_oso.rows.length) h += '<tr><td colspan="3" style="padding:12px;color:#888">Chưa có đơn nào bị ép. Bấm "+ Thêm dòng".</td></tr>';
  _oso.rows.forEach(function(r, i){
    h += '<tr data-osorow="' + i + '"><td style="padding:3px"><input class="oso-c" style="width:100%;box-sizing:border-box" placeholder="162T10/2026" value="' + esc(r.code) + '"></td>' +
      '<td style="padding:3px"><input class="oso-n" style="width:100%;box-sizing:border-box" placeholder="yenNTH2004" value="' + esc(r.name) + '"></td>' +
      '<td style="padding:3px"><button type="button" class="btn secondary sm" data-osodel="' + i + '" title="Xoá dòng">🗑</button></td></tr>';
  });
  body.innerHTML = h + '</tbody></table>';
}
async function openOrderSaleOvrModal(){
  if (typeof gsUrl === 'undefined' || !gsUrl) { toast('Chưa kết nối máy chủ'); return; }
  var isAdmin = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin);
  if (!isAdmin) { toast('Chỉ admin mới dùng được mục này.'); return; }
  var ov = _osoEnsure_(); ov.style.display = 'flex';
  document.getElementById('oso-err').textContent = '';
  document.getElementById('oso-body').innerHTML = '<div style="padding:16px;color:#888">Đang tải…</div>';
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=orderSaleOverride', { redirect: 'follow' });
    var d = await r.json(), obj = {};
    if (d && d.value) { try { var p = JSON.parse(d.value); if (p && typeof p === 'object' && !Array.isArray(p)) obj = p; } catch (e) {} }
    _oso.rows = _osoToRows_(obj);
  } catch (e) { _oso.rows = []; document.getElementById('oso-err').textContent = 'Không tải được danh sách hiện có (' + e.message + ') — đóng và mở lại trước khi lưu để không ghi đè mất.'; document.getElementById('oso-save').disabled = true; return; }
  document.getElementById('oso-save').disabled = false;
  _osoRender_();
}
async function osoSave(){
  _osoRead_();
  var b = _osoBuild_(_oso.rows), err = document.getElementById('oso-err');
  if (b.errors.length) { err.textContent = b.errors.join(' · '); return; }
  err.textContent = '';
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'setSetting', key: 'orderSaleOverride', value: JSON.stringify(b.obj) }) });
    var d = await r.json().catch(function(){ return {}; });
    if (d && d.error) { err.textContent = 'Lưu lỗi: ' + d.error; return; }
    toast('✓ Đã lưu ' + Object.keys(b.obj).length + ' đơn ép sale — báo cáo cập nhật sau ~2 phút (hoặc bấm tải lại)');
    document.getElementById('oso-overlay').style.display = 'none';
  } catch (e) { err.textContent = 'Lưu lỗi: ' + e.message; }
}

// ═══════════════════════════════════════════════════════
//  CHIA ĐƠN THEO KẾ TOÁN — BẢNG BỔ SUNG (05/11/2026) — admin dán/sửa bảng chia từng đơn để Báo cáo B (Pos) khớp kế toán.
//  Lưu Settings 'acctSplitExtra' = [{code, sales:["a","b"], tong}] — mỗi phần tử là 1 DÒNG như file "THEO DÕI ĐƠN CHIA SALE" của KT
//  (sales trong 1 dòng chia đều; nhiều dòng cùng code = chia tay; tong = tiền đơn KT tính, 0 = đơn không tính doanh số).
//  code = mã bộ đếm (268T10/2026) hoặc mã đơn Pos (M44707). Backend gas_v13.js `_loadAcctExtra_` / `_acctMatchExtra_` (ưu tiên hơn file KT + ghép Base).
//  Menu: Cài đặt team → "🧮 Chia đơn theo KT (bổ sung)" (js/29-sidenav.js, ACTS.splitextra).
// ═══════════════════════════════════════════════════════
var _ase = { arr: [] };
// Chuẩn hoá mã: bỏ khoảng trắng, IN HOA; chấp nhận mã bộ đếm (162T10 / 162T10/2026 / NG83T10/2026) hoặc mã đơn Pos M12345; sai → ''.
function _aseNormCode_(c){
  var s = String(c == null ? '' : c).replace(/\s+/g, '').toUpperCase();
  return (/^[A-Z]{0,3}\d{1,6}[A-Z]{0,3}T\d{1,2}(\/\d{2,4})?$/.test(s) || /^M\d{4,6}$/.test(s)) ? s : '';
}
function _aseMoney_(v){
  if (typeof v === 'number') return isFinite(v) ? Math.round(v) : NaN;
  var t = String(v == null ? '' : v).replace(/[^\d-]/g, '');
  return t === '' || t === '-' ? NaN : parseInt(t, 10);
}
// Chuỗi JSON (mảng, hoặc {rows:[...]}) → mảng thô; lỗi cú pháp → { arr: [], error }
function _aseParse_(text){
  var t = String(text == null ? '' : text).trim();
  if (!t) return { arr: [], error: '' };
  try {
    var p = JSON.parse(t);
    if (p && !Array.isArray(p) && Array.isArray(p.rows)) p = p.rows;
    if (!Array.isArray(p)) return { arr: [], error: 'Phải là danh sách [ {...}, {...} ]' };
    return { arr: p, error: '' };
  } catch (e) { return { arr: [], error: 'JSON sai cú pháp: ' + e.message }; }
}
// mảng thô → { arr (đã chuẩn hoá), errors[] }; dòng trống bị bỏ; sai mã / thiếu sale / tong không phải số ≥ 0 → báo lỗi và KHÔNG đưa vào arr
function _aseBuild_(raw){
  var arr = [], errors = [];
  (raw || []).forEach(function(it, i){
    if (!it || (typeof it !== 'object')) { errors.push('Dòng ' + (i + 1) + ': không phải đối tượng {code, sales, tong}'); return; }
    var c = _aseNormCode_(it.code);
    if (!c) { errors.push('Dòng ' + (i + 1) + ': mã "' + (it.code || '') + '" không đúng dạng (vd 268T10/2026 hoặc M44707)'); return; }
    var sales = (Array.isArray(it.sales) ? it.sales : String(it.sales || '').split(',')).map(function(x){ return String(x == null ? '' : x).trim(); }).filter(Boolean);
    if (!sales.length) { errors.push('Dòng ' + (i + 1) + ' (' + c + '): thiếu tên sale'); return; }
    var tong = _aseMoney_(it.tong);
    if (!(tong >= 0)) { errors.push('Dòng ' + (i + 1) + ' (' + c + '): "tong" phải là số tiền ≥ 0 (0 = đơn không tính)'); return; }
    arr.push({ code: c, sales: sales, tong: tong });
  });
  return { arr: arr, errors: errors };
}
// Tóm tắt theo mã đơn: [{code, rows, tong, sales:{tên: tiền}}] — để Duyên đối chiếu nhanh với bảng KT trước khi lưu
function _aseSummary_(arr){
  var by = {}, order = [];
  (arr || []).forEach(function(r){
    var k = r.code; if (!by[k]) { by[k] = { code: k, rows: 0, tong: 0, sales: {} }; order.push(k); }
    var o = by[k]; o.rows++; o.tong += r.tong;
    r.sales.forEach(function(n){ o.sales[n] = (o.sales[n] || 0) + r.tong / r.sales.length; });
  });
  return order.map(function(k){ return by[k]; });
}
function _aseFmt_(n){ return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function _aseEnsure_(){
  var ov = document.getElementById('ase-overlay'); if (ov) return ov;
  ov = document.createElement('div'); ov.id = 'ase-overlay';
  ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3500;align-items:center;justify-content:center;padding:12px';
  ov.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:760px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden">' +
    '<div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eee"><b style="flex:1">🧮 Chia đơn theo KT (bổ sung)</b><button type="button" class="btn secondary sm" id="ase-close">✕</button></div>' +
    '<div style="padding:10px 14px;font-size:12px;color:#555;line-height:1.5">Mỗi phần tử = <b>1 dòng</b> như file KT: <code>{"code":"268T10/2026","sales":["ninhLTK1984","ninhnga99"],"tong":10780000}</code>. Sale trong 1 dòng chia đều; nhiều dòng cùng mã = chia tay; <b>tong</b> = tiền đơn KT tính (khác giá Pos vẫn dùng), <b>0</b> = đơn không tính doanh số. <b>code</b> = mã bộ đếm hoặc mã đơn Pos (M44707). Dòng ở đây <b>thay</b> dòng cùng mã của file KT và <b>ưu tiên hơn</b> ghép Base. Chỉ cần mã đơn có trong ghi chú Pos.</div>' +
    '<textarea id="ase-ta" spellcheck="false" style="margin:0 14px;min-height:170px;font-family:monospace;font-size:12px;box-sizing:border-box;width:calc(100% - 28px)"></textarea>' +
    '<div id="ase-sum" style="padding:6px 14px;overflow:auto;flex:1;font-size:12px"></div>' +
    '<div id="ase-err" style="padding:6px 14px;color:#b91c1c;font-size:12px"></div>' +
    '<div style="display:flex;gap:8px;padding:10px 14px;border-top:1px solid #eee"><button type="button" class="btn secondary sm" id="ase-check">🔍 Kiểm tra</button><span style="flex:1"></span><button type="button" class="btn" id="ase-save">💾 Lưu</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.style.display = 'none'; });
  document.getElementById('ase-close').addEventListener('click', function(){ ov.style.display = 'none'; });
  document.getElementById('ase-check').addEventListener('click', aseCheck);
  document.getElementById('ase-save').addEventListener('click', aseSave);
  return ov;
}
// Đọc textarea → { arr, errors[] } và vẽ bảng tóm tắt (không lưu)
function aseCheck(){
  var p = _aseParse_(document.getElementById('ase-ta').value), err = document.getElementById('ase-err'), sum = document.getElementById('ase-sum');
  if (p.error) { err.textContent = p.error; sum.innerHTML = ''; return null; }
  var b = _aseBuild_(p.arr);
  err.textContent = b.errors.join(' · ');
  var s = _aseSummary_(b.arr), h = '';
  if (s.length) {
    h = '<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;color:#666"><th style="padding:3px">Mã đơn</th><th style="padding:3px">Số dòng</th><th style="padding:3px;text-align:right">Tổng đơn tính</th><th style="padding:3px">Chia cho</th></tr></thead><tbody>';
    s.forEach(function(o){
      h += '<tr style="border-top:1px solid #eee"><td style="padding:3px"><b>' + esc(o.code) + '</b></td><td style="padding:3px">' + o.rows + '</td><td style="padding:3px;text-align:right">' + _aseFmt_(o.tong) + '</td><td style="padding:3px">' +
        Object.keys(o.sales).map(function(n){ return esc(n) + ' ' + _aseFmt_(o.sales[n]); }).join(' · ') + '</td></tr>';
    });
    h += '</tbody></table>';
  }
  sum.innerHTML = h || '<span style="color:#888">Chưa có dòng nào.</span>';
  return b;
}
async function openAcctExtraModal(){
  if (typeof gsUrl === 'undefined' || !gsUrl) { toast('Chưa kết nối máy chủ'); return; }
  var isAdmin = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin);
  if (!isAdmin) { toast('Chỉ admin mới dùng được mục này.'); return; }
  var ov = _aseEnsure_(); ov.style.display = 'flex';
  var ta = document.getElementById('ase-ta'), err = document.getElementById('ase-err');
  err.textContent = ''; document.getElementById('ase-sum').innerHTML = ''; ta.value = 'Đang tải…'; ta.disabled = true; document.getElementById('ase-save').disabled = true;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=acctSplitExtra', { redirect: 'follow' });
    var d = await r.json(), p = _aseParse_(d && d.value ? d.value : '');
    ta.value = p.arr.length ? '[\n' + p.arr.map(function(x){ return '  ' + JSON.stringify(x); }).join(',\n') + '\n]' : '[\n]';
    document.getElementById('ase-save').disabled = false;
    if (p.error) err.textContent = 'Giá trị đang lưu bị hỏng (' + p.error + ') — kiểm tra lại trước khi lưu.';
  } catch (e) {
    ta.value = ''; err.textContent = 'Không tải được bảng hiện có (' + e.message + ') — đóng và mở lại trước khi lưu để không ghi đè mất.';
  }
  ta.disabled = false; aseCheck();
}
async function aseSave(){
  var b = aseCheck(), err = document.getElementById('ase-err');
  if (!b) return;
  if (b.errors.length) { err.textContent = b.errors.join(' · ') + ' — sửa rồi lưu lại.'; return; }
  try {
    var r = await fetch(gsUrl, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: 'setSetting', key: 'acctSplitExtra', value: JSON.stringify(b.arr) }) });
    var d = await r.json().catch(function(){ return {}; });
    if (d && d.error) { err.textContent = 'Lưu lỗi: ' + d.error; return; }
    toast('✓ Đã lưu ' + b.arr.length + ' dòng chia (' + _aseSummary_(b.arr).length + ' đơn) — Báo cáo B cập nhật ngay khi bấm Lọc lại');
    document.getElementById('ase-overlay').style.display = 'none';
  } catch (e) { err.textContent = 'Lưu lỗi: ' + e.message; }
}

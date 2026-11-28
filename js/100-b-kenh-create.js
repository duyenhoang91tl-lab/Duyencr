// ════════════════════════════════════════════════════════════════════
//  ĐƠN CÁC KÊNH — bước B3/8: hộp "Tạo nhiệm vụ mới" (form lên đơn kiểu Base: SĐT = tên nhiệm vụ).
//  Backend: GAS POST kenhSave {refKey, order} (khối 36_CrmStage). Server kiểm lại toàn bộ; refKey giữ nguyên khi lỗi/thử lại → không tạo 2 đơn.
//  Bản nháp giữ trong _knf: lỡ bấm ra ngoài hộp thì mở lại vẫn còn; chỉ xoá khi bấm "Huỷ" hoặc tạo xong.
//  Nạp SAU js/100-a (dùng _knEsc, _knPost, _knModal, _knLoad). Test: tools/test-kenh-create-ui.js
// ════════════════════════════════════════════════════════════════════
var _knf = null;
function _knfMyName(){ try { return String((typeof currentUser !== 'undefined' && currentUser && currentUser.name) || ''); } catch(e){ return ''; } }
function _knfBlank(){
  return { phone:'', custName:'', kenh:(typeof _kn !== 'undefined' && _kn.kenh) || '', saleName:_knfMyName(), product:'', phanLoai:'', total:'', deposit:'', diffExchange:'', description:'', followers:[], refKey:'', busy:false, err:'' };
}
// Người dùng đang hoạt động (danh sách tài khoản đã tải sẵn của app) → dùng cho Sale bán / Người theo dõi / Người được giao.
function _knPeople(){
  var l = (typeof accounts !== 'undefined' && Array.isArray(accounts)) ? accounts : [];
  return l.filter(function(u){ return u && u.username && u.active !== false && u.role !== 'demo'; })
    .map(function(u){ return { username:String(u.username), name:String(u.name || u.username) }; })
    .sort(function(a, b){ return a.name.localeCompare(b.name, 'vi'); });
}
function _knPersonName(username){ var p = _knPeople().filter(function(x){ return x.username.toLowerCase() === String(username || '').toLowerCase(); })[0]; return p ? p.name : String(username || ''); }
function _knDigits(v){ return String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+(?=\d)/, ''); }
// Số tiền có dấu chấm ngăn nghìn; signed = cho phép dấu trừ ở đầu (chênh đơn đổi). Trả chuỗi hiển thị.
function _knMoneyText(v, signed){
  var s = String(v == null ? '' : v).trim(), neg = signed && s.charAt(0) === '-', d = _knDigits(s);
  return (neg ? '-' : '') + d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function _knMoneyVal(v){ var s = String(v == null ? '' : v).trim(), n = Number(_knDigits(s) || 0); return s.charAt(0) === '-' ? -n : n; }
function _knfMoney(el, key){
  var raw = String(el.value || ''), pos = el.selectionStart == null ? raw.length : el.selectionStart, before = raw.slice(0, pos).replace(/[^\d-]/g, '').length;
  var out = _knMoneyText(raw, key === 'diffExchange');
  if (out !== raw){
    el.value = out;
    var p = 0, c = 0; while (p < out.length && c < before){ if (out.charAt(p) !== '.') c++; p++; }   // giữ con trỏ sau đúng chừng ấy ký tự
    try { el.setSelectionRange(p, p); } catch(e){}
  }
  _knf[key] = out;
}
function _knfSet(key, v){ if (_knf) _knf[key] = v; }
// Kiểm trước khi gửi (cùng điều kiện với server _kenhNormalize_). Trả câu báo lỗi hoặc ''.
function _knfValidate(f){
  var ph = (typeof normPhone === 'function') ? normPhone(f.phone) : String(f.phone || '').replace(/\D/g, '');
  if (!ph || String(ph).length < 9) return 'Nhập số điện thoại khách.';
  if (!String(f.kenh).trim()) return 'Chọn Kênh bán.';
  if (!String(f.saleName).trim()) return 'Chọn Sale bán.';
  if (!String(f.product).trim()) return 'Nhập Sản phẩm order.';
  if (!String(f.phanLoai).trim()) return 'Chọn Phân loại.';
  if (_knMoneyVal(f.deposit) > _knMoneyVal(f.total) && f.phanLoai !== 'Thanh toán toàn bộ') return 'Giá trị cọc không được lớn hơn tổng giá trị đơn.';
  return '';
}
function _knfPayload(f){
  return { phone:String(f.phone).trim(), custName:String(f.custName).trim(), kenh:String(f.kenh).trim(), saleName:String(f.saleName).trim(), product:String(f.product).trim(), phanLoai:f.phanLoai,
    total:_knMoneyVal(f.total), deposit:_knMoneyVal(f.deposit), diffExchange:_knMoneyVal(f.diffExchange), description:String(f.description).trim(), followers:f.followers.slice() };
}
function _knfFollowHtml(){
  var chips = _knf.followers.map(function(u, i){ return '<span class="btn sm" style="cursor:default">' + _knEsc(_knPersonName(u)) + ' <b style="cursor:pointer" title="Bỏ" onclick="_knfUnfollow(' + i + ')">✕</b></span>'; }).join('');
  var opts = _knPeople().filter(function(p){ return _knf.followers.indexOf(p.username) < 0; }).map(function(p){ return '<option value="' + _knEsc(p.username) + '">' + _knEsc(p.name) + '</option>'; }).join('');
  return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + chips + '<select onchange="_knfFollow(this.value)" style="max-width:220px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface,#fff);color:inherit"><option value="">＋ Thêm người</option>' + opts + '</select></div>';
}
function _knfFollowRender(){ var b = document.getElementById('knf-follow'); if (b) b.innerHTML = _knfFollowHtml(); }
function _knfFollow(u){ if (u && _knf.followers.indexOf(u) < 0) _knf.followers.push(u); _knfFollowRender(); }
function _knfUnfollow(i){ _knf.followers.splice(i, 1); _knfFollowRender(); }
function _knfHtml(){
  var f = _knf, E = _knEsc, d = (typeof _kn !== 'undefined' && _kn.data) || {};
  var inp = 'width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--surface,#fff);color:inherit';
  var lab = function(t, req, body, full){ return '<label style="display:block;font-size:12px;color:var(--muted);' + (full ? 'grid-column:1/-1' : '') + '">' + t + (req ? ' <b style="color:#dc2626">*</b>' : '') + body + '</label>'; };
  var text = function(k, ph, extra){ return '<input id="knf-' + k + '" value="' + E(f[k]) + '" placeholder="' + E(ph || '') + '" ' + (extra || '') + ' oninput="_knfSet(\'' + k + '\',this.value)" style="' + inp + '">'; };
  var money = function(k){ return '<input id="knf-' + k + '" type="text" inputmode="' + (k === 'diffExchange' ? 'text' : 'numeric') + '" autocomplete="off" value="' + E(f[k]) + '" placeholder="0" oninput="_knfMoney(this,\'' + k + '\')" style="' + inp + '">'; };
  var area = function(k, rows){ return '<textarea id="knf-' + k + '" rows="' + rows + '" oninput="_knfSet(\'' + k + '\',this.value)" style="' + inp + '">' + E(f[k]) + '</textarea>'; };
  var channels = (d.channels || []).map(function(c){ return '<option value="' + E(c.name) + '">'; }).join('');
  var sales = _knPeople().map(function(p){ return '<option value="' + E(p.name) + '">'; }).join('');
  var kinds = (d.phanLoai || ['Thanh toán toàn bộ', 'Cọc trước', 'Thu COD']).map(function(k){ return '<option value="' + E(k) + '"' + (f.phanLoai === k ? ' selected' : '') + '>' + E(k) + '</option>'; }).join('');
  return '<div style="padding:16px 18px"><div style="font-weight:700;font-size:16px;margin-bottom:12px">Tạo nhiệm vụ mới</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">' +
    lab('Tên nhiệm vụ (SĐT khách)', true, text('phone', '09…', 'inputmode="tel" autocomplete="off"')) +
    lab('Tên khách', false, text('custName')) +
    lab('Kênh bán', true, text('kenh', 'Chọn hoặc gõ kênh mới', 'list="knf-kenh-list" autocomplete="off"') + '<datalist id="knf-kenh-list">' + channels + '</datalist>') +
    lab('Sale bán', true, text('saleName', '', 'list="knf-sale-list" autocomplete="off"') + '<datalist id="knf-sale-list">' + sales + '</datalist>') +
    lab('Sản phẩm order', true, area('product', 3), true) +
    lab('Phân loại', true, '<select id="knf-phanLoai" onchange="_knfSet(\'phanLoai\',this.value)" style="' + inp + '"><option value="">— Chọn —</option>' + kinds + '</select>') +
    lab('Giá trị cọc', false, money('deposit')) +
    lab('Tổng giá trị đơn (không ship)', false, money('total')) +
    lab('Giá trị chênh đơn đổi', false, money('diffExchange')) +
    lab('Mô tả', false, area('description', 2), true) +
    '<div style="grid-column:1/-1;font-size:12px;color:var(--muted)">Người theo dõi<div id="knf-follow">' + _knfFollowHtml() + '</div></div></div>' +
    '<div id="knf-err" style="color:#b91c1c;font-size:12px;min-height:18px;margin-top:8px">' + E(f.err) + '</div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="_knfCancel()">Huỷ</button><button id="knf-save" class="btn primary" onclick="_knfSave()"' + (f.busy ? ' disabled' : '') + '>' + (f.busy ? '⏳ Đang tạo…' : 'Tạo nhiệm vụ') + '</button></div></div>';
}
function _knfRender(){ _knModal(_knfHtml(), { wide: 640 }); }
function _knOpenCreate(){
  if (!_knf) _knf = _knfBlank();
  _knfRender();
  var t = document.getElementById('knf-phone'); if (t && t.focus) t.focus();
}
function _knfCancel(){ _knf = null; _knModalClose(); }
function _knfOpenNow(){ return !!document.getElementById('knf-save'); }
async function _knfSave(){
  var f = _knf; if (!f || f.busy) return;
  f.err = _knfValidate(f);
  if (f.err){ _knfRender(); return; }
  if (!f.refKey) f.refKey = 'kn-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  f.busy = true; _knfRender();
  var d = null, err = '';
  try { d = await _knPost('kenhSave', { refKey:f.refKey, order:_knfPayload(f) }); }
  catch(e){ err = 'Lỗi kết nối: ' + (e && e.message || e) + '. Bấm "Tạo nhiệm vụ" lại (không bị tạo trùng).'; }
  f.busy = false;
  if (d && d.ok && d.order){
    if (_knf === f){ _knf = null; if (_knfOpenNow()) _knModalClose(); }
    // Đơn mới phải nhìn thấy ngay: bỏ lọc kênh khác / chữ tìm, nới ngày đến hôm nay.
    if (_kn.kenh && _kn.kenh !== d.order.kenh) _kn.kenh = '';
    _kn.q = ''; if (_kn.to && _kn.to < _knToday()) _kn.to = _knToday();
    _knToast('✓ Đã tạo nhiệm vụ ' + (d.order.maBoDem || d.order.id));
    _knLoad(); return;
  }
  f.err = err || (d && (d.error || d.message)) || 'Không tạo được (GAS chưa deploy kenhSave?).';
  if (_knf === f && _knfOpenNow()) _knfRender(); else _knToast('❌ ' + f.err);
}

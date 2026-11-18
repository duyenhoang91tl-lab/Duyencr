// ════════════════════════════════════════════════════════════════════
//  COMBO CÓ SẴN — bước 3/6: tab "🎁 Combo" tra cứu trong CRM; bước 4/6: màn ADMIN thêm/sửa/xoá combo (cuối file).
//  Dữ liệu: GAS action=comboList&q=... (sheet COMBO trong file bảng giá, gas/02_PriceCatalog_CTKM.gs).
//  Tìm không dấu ở SERVER (bốn→4, khớp tên/mã/từ khóa/sản phẩm/ghi chú) nên gõ xong chờ ~0,4s mới gọi.
//  Mặc định chỉ hiện combo ĐANG ÁP DỤNG; có nút xem cả combo hết hạn/chưa bắt đầu/đã tắt.
//  Nút "Copy" = chép nội dung combo (tên, giá, từng món × SL, ghi chú, hạn) để dán vào chat khách.
//  Thêm/sửa/xoá: CHỈ admin (nút chỉ hiện với admin; server comboSave/comboDelete kiểm lại token + role). Vẫn sửa trực tiếp trên sheet COMBO được.
// ════════════════════════════════════════════════════════════════════
var _cb = { rows:[], total:0, q:'', all:false, loading:false, err:'', seq:0, timer:0, at:0, form:null };
function _cbVnd(n){ n = Math.round(Number(n) || 0); return n > 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ' : ''; }
function _cbItemLine(it){
  var parts = [it.name, it.chatLieu, it.size].filter(function(x){ return x && String(x).trim(); });
  return parts.join(' · ') + ' × ' + (it.qty || 1);
}
function _cbDateVN(ymd){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(ymd || ''); }
function _cbCopyText(c){
  var L = ['🎁 ' + c.name + (c.code ? ' (' + c.code + ')' : '')];
  var p = _cbVnd(c.priceVnd) || c.priceText; if (p) L.push('Giá combo: ' + p);
  (c.items || []).forEach(function(it){ L.push('- ' + _cbItemLine(it)); });
  if (c.note && String(c.note).trim()) L.push('Lưu ý: ' + String(c.note).trim());
  if (c.end) L.push('Áp dụng đến hết ' + _cbDateVN(c.end));
  return L.join('\n');
}
function _cbVisible(){ return _cb.all ? _cb.rows : _cb.rows.filter(function(c){ return c.usable; }); }
async function _cbLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl){ _cb.err = 'Chưa kết nối Google Sheets.'; _cbRender(); return; }
  var seq = ++_cb.seq; _cb.loading = true; _cbRender();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=comboList&q=' + encodeURIComponent(_cb.q), { redirect:'follow' });
    var d = await r.json();
    if (seq !== _cb.seq) return;   // bỏ kết quả chậm của lần gõ cũ
    if (d && d.ok){ _cb.rows = d.rows || []; _cb.total = d.total || 0; _cb.err = ''; _cb.at = Date.now(); }
    else _cb.err = (d && d.error) || 'GAS chưa có action comboList — cần deploy lại GAS (gas/02, 04, 11).';
  } catch(e){ if (seq !== _cb.seq) return; _cb.err = 'Không tải được: ' + (e && e.message || e); }
  _cb.loading = false; _cbRender();
}
function _cbSetQ(v){ _cb.q = v || ''; clearTimeout(_cb.timer); _cb.timer = setTimeout(_cbLoad, 400); }
function _cbToggleAll(){ _cb.all = !_cb.all; _cbRender(); }
function _cbCopy(i){
  var c = _cbVisible()[i]; if (!c) return;
  var txt = _cbCopyText(c), done = function(){ if (typeof toast === 'function') toast('Đã copy combo ' + c.name); };
  try { navigator.clipboard.writeText(txt).then(done, function(){ _cbCopyFallback(txt); done(); }); }
  catch(e){ _cbCopyFallback(txt); done(); }
}
function _cbCopyFallback(txt){
  var t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); } catch(e){} t.remove();
}
function _cbCard(c, i){
  var price = _cbVnd(c.priceVnd) || c.priceText || '';
  var items = (c.items || []).map(function(it){ return '<li>' + esc(_cbItemLine(it)) + '</li>'; }).join('');
  return '<div class="card" style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--card,#fff);opacity:' + (c.usable ? 1 : 0.65) + '">' +
    '<div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between">' +
      '<div><div style="font-weight:700;font-size:15px">' + esc(c.name) + '</div><div style="font-size:11px;color:var(--muted)">' + esc(c.code) + '</div></div>' +
      '<div style="font-weight:800;font-size:16px;color:#c0392b;white-space:nowrap">' + esc(price) + '</div></div>' +
    '<ul style="margin:8px 0 6px 18px;padding:0;font-size:13px">' + items + '</ul>' +
    (c.note && String(c.note).trim() ? '<div style="font-size:12px;margin-bottom:6px">📝 ' + esc(c.note) + '</div>' : '') +
    '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:var(--muted)">' + esc(c.statusLabel || '') + '</span>' +
      '<span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" onclick="_cbCopy(' + i + ')">📋 Copy</button>' +
        (_cbIsAdmin() ? '<button class="btn sm" onclick="_cbEdit(' + i + ')">✏️ Sửa</button><button class="btn sm" onclick="_cbDelete(' + i + ')">🗑 Xoá</button>' : '') + '</span></div></div>';
}
function _cbRender(){
  var w = document.getElementById('xt-wrap-combo'); if (!w) return;
  var list = _cbVisible(), hidden = _cb.rows.length - list.length;
  var focus = document.activeElement && document.activeElement.id === 'cb-q';
  w.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px">🎁 Combo có sẵn</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Tra combo đang áp dụng (gõ tên, mã, sản phẩm… không cần dấu). Dữ liệu lấy từ sheet COMBO trong file bảng giá.</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"><input id="cb-q" type="text" placeholder="🔍 Tìm combo…" value="' + esc(_cb.q) + '" oninput="_cbSetQ(this.value)" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<button class="btn sm' + (_cb.all ? ' primary' : '') + '" onclick="_cbToggleAll()">' + (_cb.all ? 'Đang xem tất cả' : 'Chỉ đang áp dụng') + '</button>' +
    '<button class="btn sm" onclick="_cbLoad()">↻ Làm mới</button>' +
    (_cbIsAdmin() && !_cb.form ? '<button class="btn sm primary" onclick="_cbNew()">＋ Thêm combo</button>' : '') + '</div>' +
    _cbFormHtml() +
    (_cb.loading ? '<div style="color:var(--muted);padding:12px">Đang tải…</div>' : '') +
    (_cb.err ? '<div style="color:#c0392b;padding:12px;background:#fdecea;border-radius:8px;margin-bottom:8px">' + esc(_cb.err) + '</div>' : '') +
    (!_cb.loading && !_cb.err ? '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">' + list.length + ' combo' + (hidden > 0 ? ' · ẩn ' + hidden + ' combo hết hạn/chưa bắt đầu/đã tắt' : '') + (_cb.q ? '' : ' · tổng ' + _cb.total + ' trong sheet') + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">' + list.map(_cbCard).join('') + '</div>' +
    (!_cb.loading && !_cb.err && !list.length ? '<div style="text-align:center;color:var(--muted);padding:20px">' + (_cb.total ? 'Không có combo khớp.' : 'Sheet COMBO chưa có combo nào — thêm dòng trên Google Sheets (cột: Mã | Tên | Sản phẩm | Giá | Ghi chú | Từ ngày | Đến ngày | Từ khóa | Hoạt động).') + '</div>' : '');
  if (focus){ var i = document.getElementById('cb-q'); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
// ════════════════ BƯỚC 4/6 — MÀN ADMIN THÊM / SỬA / XOÁ COMBO ════════════════
// Gửi POST comboSave {combo} / comboDelete {code}; token phiên do bộ bọc fetch (js/06) tự gắn vào body. Server (gas/02) mới là chốt chặn: không phải admin → FORBIDDEN.
// Giá: nhập đúng như cột Giá combo trong sheet — số < 100.000 hiểu là NGHÌN đồng (850 = 850.000đ), ≥ 100.000 là đồng đầy đủ (giống _comboVnd_ ở GAS) nên có dòng xem trước.
// Món: mỗi món 1 hàng (Tên · Chất liệu · Size · SL) → gửi mảng items (server ghép lại thành "Tên | Chất liệu | Size | SL" trong ô Sản phẩm).
var _CB_INP = 'padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit;font-size:16px;box-sizing:border-box;';   // 16px: cùng cỡ mọi ô + iPhone không tự phóng to khi bấm vào ô
function _cbIsAdmin(){ return typeof currentUser !== 'undefined' && !!currentUser && currentUser.role === 'admin'; }
function _cbPriceVnd(txt){ var d = String(txt == null ? '' : txt).replace(/[^\d]/g, ''), n = d ? parseInt(d, 10) : 0; return n > 0 && n < 100000 ? n * 1000 : n; }
function _cbBlankItem(){ return { name:'', chatLieu:'', size:'', qty:1 }; }
function _cbNew(){ if (!_cbIsAdmin()) return; _cb.form = { code:'', name:'', priceText:'', note:'', start:'', end:'', keywords:'', active:true, items:[_cbBlankItem()], saving:false, err:'' }; _cbRender(); }
function _cbEdit(i){
  var c = _cbVisible()[i]; if (!c || !_cbIsAdmin()) return;
  _cb.form = { code:c.code || '', name:c.name || '', priceText:c.priceText || (c.price ? String(c.price) : ''), note:c.note || '', start:c.start || '', end:c.end || '', keywords:c.keywords || '',
    active:c.active !== false, items:(c.items || []).map(function(it){ return { name:it.name || '', chatLieu:it.chatLieu || '', size:it.size || '', qty:it.qty || 1 }; }), saving:false, err:'' };
  if (!_cb.form.items.length) _cb.form.items.push(_cbBlankItem());
  _cbRender();
}
function _cbCancel(){ _cb.form = null; _cbRender(); }
function _cbFSet(k, v){ if (_cb.form) _cb.form[k] = v; if (k === 'priceText') { var el = document.getElementById('cb-f-pp'); if (el) el.textContent = _cbPricePreview(v); } }
function _cbFItem(idx, k, v){ var it = _cb.form && _cb.form.items[idx]; if (it) it[k] = (k === 'qty') ? (parseInt(v, 10) || '') : v; }
function _cbFAdd(){ if (_cb.form){ _cb.form.items.push(_cbBlankItem()); _cbRender(); } }
function _cbFDel(idx){ if (!_cb.form) return; _cb.form.items.splice(idx, 1); if (!_cb.form.items.length) _cb.form.items.push(_cbBlankItem()); _cbRender(); }
function _cbPricePreview(v){ var n = _cbPriceVnd(v); return n > 0 ? '= ' + _cbVnd(n) : ''; }
function _cbFormCheck(f){
  if (!String(f.name || '').trim()) return 'Nhập tên combo.';
  if (!f.items.some(function(it){ return String(it.name || '').trim(); })) return 'Combo cần ít nhất 1 sản phẩm (có tên).';
  if (!(_cbPriceVnd(f.priceText) > 0)) return 'Nhập giá combo (số lớn hơn 0).';
  if (f.start && f.end && f.end < f.start) return 'Ngày kết thúc đang trước ngày bắt đầu.';
  return '';
}
async function _cbPost(body){
  var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(body) });
  return await r.json();
}
function _cbErrText(d, fallback){
  if (d && d.code === 'AUTH') return 'Phiên đăng nhập đã hết — đăng nhập lại rồi thử lại.';
  if (d && d.code === 'FORBIDDEN') return 'Chỉ admin mới được thêm/sửa/xoá combo.';
  return (d && d.error) || fallback;
}
async function _cbSave(){
  var f = _cb.form; if (!f || f.saving) return;
  f.err = _cbFormCheck(f); if (f.err){ _cbRender(); return; }
  if (typeof gsUrl === 'undefined' || !gsUrl){ f.err = 'Chưa kết nối Google Sheets.'; _cbRender(); return; }
  f.saving = true; f.err = ''; _cbRender();
  var combo = { code:f.code, name:String(f.name).trim(), items:f.items.filter(function(it){ return String(it.name || '').trim(); }).map(function(it){ return { name:String(it.name).trim(), chatLieu:String(it.chatLieu || '').trim(), size:String(it.size || '').trim(), qty:parseInt(it.qty, 10) || 1 }; }),
    priceText:String(f.priceText).trim(), note:f.note, start:f.start, end:f.end, keywords:f.keywords, active:!!f.active };
  try {
    var d = await _cbPost({ action:'comboSave', combo:combo });
    if (d && d.ok){
      if (!f.active) _cb.all = true;   // combo vừa tắt sẽ bị ẩn ở chế độ "chỉ đang áp dụng" → mở xem tất cả để thấy kết quả
      _cb.form = null; if (typeof toast === 'function') toast((d.created ? 'Đã thêm combo ' : 'Đã lưu combo ') + (d.code || combo.name)); _cbLoad(); return;
    }
    f.err = _cbErrText(d, 'Không lưu được (GAS chưa deploy bản có comboSave?).');
  } catch(e){ f.err = 'Không lưu được: ' + (e && e.message || e); }
  f.saving = false; _cbRender();
}
async function _cbDelete(i){
  var c = _cbVisible()[i]; if (!c || !_cbIsAdmin()) return;
  if (typeof confirm === 'function' && !confirm('Xoá combo "' + c.name + '" (' + c.code + ')?\nKhông khôi phục được (trừ khi bạn tự nhập lại trên sheet).')) return;
  try {
    var d = await _cbPost({ action:'comboDelete', code:c.code });
    if (d && d.ok){ if (typeof toast === 'function') toast('Đã xoá combo ' + c.name); _cbLoad(); return; }
    _cb.err = _cbErrText(d, 'Không xoá được.');
  } catch(e){ _cb.err = 'Không xoá được: ' + (e && e.message || e); }
  _cbRender();
}
function _cbFormHtml(){
  var f = _cb.form; if (!f) return '';
  var inp = function(label, key, type, ph, extra){ return '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted);' + (extra || '') + '">' + label + '<input type="' + type + '" value="' + esc(f[key]) + '" placeholder="' + esc(ph || '') + '" oninput="_cbFSet(\'' + key + '\',this.value)" style="' + _CB_INP + '"></label>'; };
  var rows = f.items.map(function(it, idx){
    // Mỗi món 1 KHUNG riêng (điện thoại hẹp: tên + ✕ một dòng, dưới là 3 ô có nhãn Chất liệu / Size / SL) — trước đó các ô tự xuống dòng lẫn lộn giữa các món.
    var cell = function(label, k, type, extra){ return '<label style="font-size:11px;color:var(--muted);display:flex;flex-direction:column;gap:2px;min-width:0">' + label + '<input type="' + type + '" ' + (extra || '') + ' value="' + esc(it[k]) + '" oninput="_cbFItem(' + idx + ',\'' + k + '\',this.value)" style="' + _CB_INP + 'width:100%;min-width:0"></label>'; };
    return '<div style="border:1px solid var(--border);border-radius:8px;padding:8px;margin-bottom:8px">' +
      '<div style="display:flex;gap:6px;margin-bottom:6px"><input type="text" value="' + esc(it.name) + '" placeholder="Tên sản phẩm *" oninput="_cbFItem(' + idx + ',\'name\',this.value)" style="' + _CB_INP + 'flex:1;min-width:0">' +
      '<button class="btn sm" type="button" title="Bỏ món này" onclick="_cbFDel(' + idx + ')">✕</button></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 64px;gap:6px">' + cell('Chất liệu', 'chatLieu', 'text') + cell('Size', 'size', 'text') + cell('SL', 'qty', 'number', 'min="1" max="999"') + '</div></div>';
  }).join('');
  return '<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;background:var(--card,#fff)">' +
    '<div style="font-weight:700;margin-bottom:8px">' + (f.code ? '✏️ Sửa combo ' + esc(f.code) : '＋ Thêm combo mới') + '</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' + inp('Tên combo *', 'name', 'text', 'VD: Combo lắc cỏ 4 lá + nhẫn', 'flex:2 1 220px') +
      '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted);flex:1 1 140px">Giá combo * <input type="text" inputmode="numeric" value="' + esc(f.priceText) + '" placeholder="VD: 1299 hoặc 1.299.000" oninput="_cbFSet(\'priceText\',this.value)" style="' + _CB_INP + '"><span id="cb-f-pp" style="color:#c0392b;font-weight:700;min-height:14px">' + esc(_cbPricePreview(f.priceText)) + '</span></label></div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">Sản phẩm trong combo * (mỗi món 1 hàng; chỉ Tên là bắt buộc)</div>' + rows +
    '<button class="btn sm" type="button" onclick="_cbFAdd()" style="margin-bottom:10px">＋ Thêm món</button>' +
    '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted);margin-bottom:8px">Điều kiện / Ghi chú <textarea rows="2" oninput="_cbFSet(\'note\',this.value)" style="' + _CB_INP + 'resize:vertical">' + esc(f.note) + '</textarea></label>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">' + inp('Từ ngày', 'start', 'date', '', 'flex:1 1 140px') + inp('Đến ngày', 'end', 'date', '', 'flex:1 1 140px') + inp('Từ khoá (cách nhau dấu phẩy)', 'keywords', 'text', 'VD: quà tặng, 8/3', 'flex:2 1 200px') + '</div>' +
    '<label style="display:flex;gap:6px;align-items:center;font-size:13px;margin-bottom:8px"><input type="checkbox"' + (f.active ? ' checked' : '') + ' onchange="_cbFSet(\'active\',this.checked)"> Đang hoạt động (bỏ tick = tắt, không hiện ở Trợ lý AI)</label>' +
    (f.err ? '<div style="color:#c0392b;background:#fdecea;border-radius:8px;padding:8px;margin-bottom:8px;font-size:13px">' + esc(f.err) + '</div>' : '') +
    '<div style="display:flex;gap:8px"><button class="btn sm primary" type="button" onclick="_cbSave()"' + (f.saving ? ' disabled' : '') + '>' + (f.saving ? 'Đang lưu…' : '💾 Lưu combo') + '</button><button class="btn sm" type="button" onclick="_cbCancel()"' + (f.saving ? ' disabled' : '') + '>Huỷ</button></div></div>';
}
registerExtraTab('combo', '🎁 Combo', function(){ _cbLoad(); });

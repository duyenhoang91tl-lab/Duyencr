// ════════════════════════════════════════════════════════════════════
//  COMBO CÓ SẴN — bước 3/6: tab "🎁 Combo" tra cứu trong CRM (CHỈ ĐỌC).
//  Dữ liệu: GAS action=comboList&q=... (sheet COMBO trong file bảng giá, gas/02_PriceCatalog_CTKM.gs).
//  Tìm không dấu ở SERVER (bốn→4, khớp tên/mã/từ khóa/sản phẩm/ghi chú) nên gõ xong chờ ~0,4s mới gọi.
//  Mặc định chỉ hiện combo ĐANG ÁP DỤNG; có nút xem cả combo hết hạn/chưa bắt đầu/đã tắt.
//  Nút "Copy" = chép nội dung combo (tên, giá, từng món × SL, ghi chú, hạn) để dán vào chat khách.
//  Bước 4/6 (17/11/2026): ADMIN thêm/sửa/xóa combo ngay trong tab (nút ➕ Thêm combo, ✏️ Sửa, 🗑 Xóa) → GAS comboSave/comboDelete.
//  Token phiên do bộ bọc fetch (js/06) tự chèn vào body POST; SERVER kiểm admin thật (client chỉ ẩn/hiện nút). Gộp vào file này để KHÔNG tốn thêm thẻ script.
//  GIÁ: người dùng luôn nhập ĐỒNG ĐẦY ĐỦ. Server coi số <100000 là NGHÌN đồng (_comboVnd_), nên _cbPriceToSend_ đổi 85000 → gửi 85, còn ≥100000 gửi nguyên;
//  nhờ vậy sửa lại combo cũ (ô giá điền sẵn priceVnd) không bao giờ nhân 1000 lần hai. KHÔNG gửi priceText (server sẽ lưu chữ đó thay cho số).
// ════════════════════════════════════════════════════════════════════
var _cb = { rows:[], total:0, q:'', all:false, loading:false, err:'', seq:0, timer:0, at:0, edit:null, saving:false };
function _cbIsAdmin(){ try { return !!((typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin)); } catch(e){ return false; } }
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
// ───────────── ADMIN: thêm / sửa / xóa combo (bước 4/6) ─────────────
function _cbPriceToSend_(v){   // người dùng nhập đồng đầy đủ → số gửi cho GAS (xem ghi chú đầu file)
  var d = parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0;
  if (!d) return { err: 'Nhập giá combo bằng đồng, vd 250000.' };
  if (d >= 100000) return { n: d };
  if (d < 1000 || d % 1000) return { err: 'Giá dưới 100.000đ phải tròn nghìn (vd 85000).' };
  return { n: d / 1000 };
}
function _cbNew(){ _cb.edit = { isNew:true, code:'', name:'', price:'', itemsText:'', note:'', start:'', end:'', keywords:'', active:true, err:'' }; _cbRender(); }
function _cbEditAt(i){
  var c = _cbVisible()[i]; if (!c) return;
  _cb.edit = { isNew:false, code:c.code || '', name:c.name || '', price:String(c.priceVnd || ''), itemsText:c.itemsText || '', note:c.note || '', start:c.start || '', end:c.end || '', keywords:c.keywords || '', active:c.active !== false, err:'' };
  _cbRender();
}
function _cbEF(k, v){ if (_cb.edit) _cb.edit[k] = v; }
function _cbCancel(){ if (_cb.saving) return; _cb.edit = null; _cbRender(); }
async function _cbPost_(action, body){
  if (typeof gsUrl === 'undefined' || !gsUrl) return { error: 'Chưa kết nối Google Sheets.' };
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(Object.assign({ action: action }, body || {})) });
    return await r.json();
  } catch(e){ return { error: 'Mất kết nối máy chủ: ' + (e && e.message || e) }; }
}
async function _cbSave(){
  var e = _cb.edit; if (!e || _cb.saving) return;
  var name = String(e.name || '').trim(), pr = _cbPriceToSend_(e.price);
  var hasItem = String(e.itemsText || '').split(/\r?\n/).some(function(l){ return l.trim(); });
  var err = !name ? 'Nhập tên combo.' : !hasItem ? 'Combo cần ít nhất 1 sản phẩm (mỗi dòng 1 món).' : pr.err ? pr.err
    : (e.start && e.end && e.end < e.start) ? 'Ngày kết thúc trước ngày bắt đầu.' : '';
  if (err){ e.err = err; _cbRender(); return; }
  _cb.saving = true; e.err = ''; _cbRender();
  var d = await _cbPost_('comboSave', { combo: { code: e.code, name: name, price: pr.n, itemsText: e.itemsText, note: e.note, start: e.start, end: e.end, keywords: e.keywords, active: !!e.active } });
  _cb.saving = false;
  if (d && d.ok){ _cb.edit = null; if (typeof toast === 'function') toast((d.created ? 'Đã thêm combo ' : 'Đã lưu combo ') + (d.code || name)); _cbLoad(); return; }
  e.err = (d && d.error) || 'Lưu không thành công.'; _cbRender();
}
async function _cbDelete(i){
  var c = _cbVisible()[i]; if (!c || _cb.saving) return;
  if (!confirm('Xóa hẳn combo "' + c.name + '" (' + c.code + ') khỏi sheet COMBO? Không hoàn tác được.')) return;
  _cb.saving = true;
  var d = await _cbPost_('comboDelete', { code: c.code });
  _cb.saving = false;
  if (d && d.ok){ if (typeof toast === 'function') toast('Đã xóa combo ' + c.name); _cbLoad(); return; }
  _cb.err = (d && d.error) || 'Xóa không thành công.'; _cbRender();
}
function _cbForm(){
  var e = _cb.edit, st = 'width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border);border-radius:6px', lb = 'font-size:12px;font-weight:600;margin:8px 0 2px;display:block';
  function inp(k, label, type, ph){ return '<label style="' + lb + '">' + label + '</label><input type="' + type + '" value="' + esc(e[k]) + '" placeholder="' + esc(ph || '') + '" oninput="_cbEF(\'' + k + '\',this.value)" style="' + st + '">'; }
  return '<div style="font-size:18px;font-weight:700;margin-bottom:4px">' + (e.isNew ? '➕ Thêm combo mới' : '✏️ Sửa combo ' + esc(e.code)) + '</div>' +
    (e.err ? '<div style="color:#c0392b;padding:10px;background:#fdecea;border-radius:8px;margin:8px 0">' + esc(e.err) + '</div>' : '') +
    inp('name', 'Tên combo *', 'text', 'vd: Combo Tỳ Hưu + Dây') + inp('price', 'Giá combo (đồng) *', 'text', 'vd: 250000') +
    '<label style="' + lb + '">Sản phẩm * (mỗi dòng 1 món: <i>Tên | Chất liệu | Size | SL</i> hoặc <i>2 x Tên</i>)</label>' +
    '<textarea rows="5" oninput="_cbEF(\'itemsText\',this.value)" style="' + st + ';font-family:inherit">' + esc(e.itemsText) + '</textarea>' +
    '<label style="' + lb + '">Điều kiện / ghi chú</label><textarea rows="2" oninput="_cbEF(\'note\',this.value)" style="' + st + ';font-family:inherit">' + esc(e.note) + '</textarea>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:140px">' + inp('start', 'Từ ngày (để trống = ngay)', 'date') + '</div><div style="flex:1;min-width:140px">' + inp('end', 'Đến ngày (để trống = không hạn)', 'date') + '</div></div>' +
    inp('keywords', 'Từ khóa tìm kiếm (cách nhau dấu phẩy)', 'text', 'vd: tỳ hưu, dây chuyền') +
    '<label style="font-size:13px;display:flex;gap:6px;align-items:center;margin:10px 0"><input type="checkbox"' + (e.active ? ' checked' : '') + ' onchange="_cbEF(\'active\',this.checked)"> Đang hoạt động (bỏ chọn = tắt combo)</label>' +
    '<div style="display:flex;gap:8px"><button class="btn primary" onclick="_cbSave()"' + (_cb.saving ? ' disabled' : '') + '>' + (_cb.saving ? 'Đang lưu…' : '💾 Lưu') + '</button><button class="btn" onclick="_cbCancel()">Hủy</button></div>';
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
      '<span style="display:flex;gap:6px">' + (_cbIsAdmin() ? '<button class="btn sm" onclick="_cbEditAt(' + i + ')">✏️ Sửa</button><button class="btn sm" onclick="_cbDelete(' + i + ')">🗑 Xóa</button>' : '') +
      '<button class="btn sm" onclick="_cbCopy(' + i + ')">📋 Copy</button></span></div></div>';
}
function _cbRender(){
  var w = document.getElementById('xt-wrap-combo'); if (!w) return;
  if (_cb.edit){ w.innerHTML = _cbForm(); return; }   // đang thêm/sửa: chỉ hiện form (giá trị gõ giữ trong _cb.edit nên tải lại nền không làm mất)
  var list = _cbVisible(), hidden = _cb.rows.length - list.length;
  var focus = document.activeElement && document.activeElement.id === 'cb-q';
  w.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px">🎁 Combo có sẵn</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Tra combo đang áp dụng (gõ tên, mã, sản phẩm… không cần dấu). Dữ liệu lấy từ sheet COMBO trong file bảng giá.</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"><input id="cb-q" type="text" placeholder="🔍 Tìm combo…" value="' + esc(_cb.q) + '" oninput="_cbSetQ(this.value)" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<button class="btn sm' + (_cb.all ? ' primary' : '') + '" onclick="_cbToggleAll()">' + (_cb.all ? 'Đang xem tất cả' : 'Chỉ đang áp dụng') + '</button>' +
    '<button class="btn sm" onclick="_cbLoad()">↻ Làm mới</button>' + (_cbIsAdmin() ? '<button class="btn sm primary" onclick="_cbNew()">➕ Thêm combo</button>' : '') + '</div>' +
    (_cb.loading ? '<div style="color:var(--muted);padding:12px">Đang tải…</div>' : '') +
    (_cb.err ? '<div style="color:#c0392b;padding:12px;background:#fdecea;border-radius:8px;margin-bottom:8px">' + esc(_cb.err) + '</div>' : '') +
    (!_cb.loading && !_cb.err ? '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">' + list.length + ' combo' + (hidden > 0 ? ' · ẩn ' + hidden + ' combo hết hạn/chưa bắt đầu/đã tắt' : '') + (_cb.q ? '' : ' · tổng ' + _cb.total + ' trong sheet') + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">' + list.map(_cbCard).join('') + '</div>' +
    (!_cb.loading && !_cb.err && !list.length ? '<div style="text-align:center;color:var(--muted);padding:20px">' + (_cb.total ? 'Không có combo khớp.' : 'Sheet COMBO chưa có combo nào — thêm dòng trên Google Sheets (cột: Mã | Tên | Sản phẩm | Giá | Ghi chú | Từ ngày | Đến ngày | Từ khóa | Hoạt động).') + '</div>' : '');
  if (focus){ var i = document.getElementById('cb-q'); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
registerExtraTab('combo', '🎁 Combo', function(){ _cbLoad(); });

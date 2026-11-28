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
//  ẢNH COMBO (18/11/2026): admin tải 1–4 ảnh từ máy (action uploadTemplateImage có sẵn → link Drive công khai; thu nhỏ ≤1280px trước khi gửi) hoặc dán link ảnh; lưu ở cột 10 'Ảnh' của sheet COMBO (GAS comboSave nhận images:[…]).
// ════════════════════════════════════════════════════════════════════
var _cb = { rows:[], total:0, q:'', all:false, loading:false, err:'', seq:0, timer:0, at:0, edit:null, saving:false };
var _CB_MAX_IMG = 6;   // tối đa 6 ảnh combo (GAS _comboImageUrls_ cũng 6)
// Link Drive → ảnh xem trước (giống server _comboImageUrls_); link http khác giữ nguyên.
function _cbImgSrc(u){ var m = /\/file\/d\/([a-zA-Z0-9_-]{10,})/.exec(u || '') || /[?&]id=([a-zA-Z0-9_-]{10,})/.exec(u || ''); return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w600' : String(u || ''); }
function _cbImgLines(t){ return String(t || '').split(/[\r\n,;]+/).map(function(x){ return x.trim(); }).filter(Boolean).slice(0, _CB_MAX_IMG); }
function _cbImgValid(u){ return /^https?:\/\/\S+$/i.test(u) && !/\/folders\//.test(u); }
function _cbIsAdmin(){ try { return !!((typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin)); } catch(e){ return false; } }
function _cbVnd(n){ n = Math.round(Number(n) || 0); return n > 0 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ' : ''; }
function _cbItemLine(it){
  var parts = [it.name, it.chatLieu, it.size].filter(function(x){ return x && String(x).trim(); });
  return parts.join(' · ') + ' × ' + (it.qty || 1);
}
function _cbDateVN(ymd){ var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(ymd || ''); }
function _cbCopyText(c){
  var L = [_cbFormatText(c)];   // mẫu hiển thị mới (giá giảm, dòng SP vàng/giá, quà, ship) — cùng chữ với xem trước & trợ lý AI
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
function _cbNew(){ _cb.edit = { isNew:true, code:'', name:'', price:'', itemsText:'', items:[], rawMode:false, ship:'', freeship:false, ctkmCodes:[], note:'', start:'', end:'', keywords:'', active:true, images:[], imgMsg:'', err:'' }; _cbPick.q = ''; _cbRender(); _cbCatLoad(); _cbCtkmLoad(); _cbKmLoad(); }
function _cbEditAt(i){
  var c = _cbVisible()[i]; if (!c) return;
  _cb.edit = { isNew:false, code:c.code || '', name:c.name || '', price:String(c.priceVnd || ''), itemsText:c.itemsText || '', items:_cbParseItems(c.itemsText), rawMode:false, ship:c.ship ? String(c.ship) : '', freeship:!!c.freeship, ctkmCodes:(c.ctkmCodes || []).slice(), note:c.note || '', start:c.start || '', end:c.end || '', keywords:c.keywords || '', active:c.active !== false, images:_cbImgLines(c.imagesText), imgMsg:'', err:'' };
  _cbPick.q = ''; _cbRender();
  if (_cbCat.loaded) _cbAttachAll(); else _cbCatLoad();
  _cbCtkmLoad(); _cbKmLoad();
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
function _cbImgDel(i){ var e = _cb.edit; if (!e || !e.images) return; e.images.splice(i, 1); e.imgMsg = ''; _cbRender(); }
function _cbImgAddLink(){
  var e = _cb.edit; if (!e) return;
  var inp = document.getElementById('cb-img-link'), u = String(inp && inp.value || '').trim();
  if (!u) return;
  e.images = e.images || [];
  if (e.images.length >= _CB_MAX_IMG){ e.imgMsg = 'Tối đa ' + _CB_MAX_IMG + ' ảnh/combo.'; _cbRender(); return; }
  if (!_cbImgValid(u) && !/\/file\/d\/|[?&]id=/.test(u)){ e.imgMsg = 'Link ảnh không hợp lệ (cần link ảnh http/https hoặc link FILE Google Drive, không dùng link thư mục).'; _cbRender(); return; }
  e.images.push(u); e.imgMsg = ''; _cbRender();
}
// Đọc file ảnh → base64 JPEG (thu nhỏ cạnh dài ≤1280px cho nhẹ; không có canvas thì gửi nguyên bản).
function _cbReadImg_(file){
  return new Promise(function(resolve, reject){
    var fr = new FileReader();
    fr.onerror = function(){ reject(new Error('Không đọc được ảnh')); };
    fr.onload = function(){
      var raw = { b64: String(fr.result || '').split(',')[1] || '', mime: file.type || 'image/jpeg' };
      try {
        var im = new Image();
        im.onerror = function(){ resolve(raw); };
        im.onload = function(){
          try {
            var k = Math.min(1, 1280 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
            cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            resolve({ b64: cv.toDataURL('image/jpeg', 0.85).split(',')[1], mime: 'image/jpeg' });
          } catch(e){ resolve(raw); }
        };
        im.src = fr.result;
      } catch(e){ resolve(raw); }
    };
    fr.readAsDataURL(file);
  });
}
async function _cbImgPick(files){
  var e = _cb.edit; if (!e) return;
  e.images = e.images || [];
  var list = Array.prototype.slice.call(files || []), room = _CB_MAX_IMG - e.images.length;
  if (!list.length) return;
  if (room <= 0){ e.imgMsg = 'Tối đa ' + _CB_MAX_IMG + ' ảnh/combo.'; _cbRender(); return; }
  e.imgBusy = true; var fails = [];
  for (var i = 0; i < list.length && i < room; i++){
    var f = list[i];
    if (!/^image\//.test(f.type || '')){ fails.push((f.name || 'tệp') + ' không phải ảnh'); continue; }
    if (f.size > 12 * 1024 * 1024){ fails.push((f.name || 'ảnh') + ' quá 12MB'); continue; }
    e.imgMsg = 'Đang tải ảnh ' + (i + 1) + '/' + Math.min(list.length, room) + '…'; _cbRender();
    try {
      var im = await _cbReadImg_(f);
      var d = await _cbPost_('uploadTemplateImage', { imageBase64: im.b64, filename: String(f.name || 'combo.jpg').replace(/\.[^.]+$/, '') + '.jpg', mimeType: im.mime });
      if (d && d.ok && d.url) e.images.push(d.url); else fails.push((f.name || 'ảnh') + ': ' + ((d && d.error) || 'tải lên không thành công'));
    } catch(err){ fails.push((f.name || 'ảnh') + ': ' + (err && err.message || err)); }
  }
  if (list.length > room) fails.push('chỉ nhận thêm ' + room + ' ảnh');
  e.imgBusy = false; e.imgMsg = fails.length ? '⚠ ' + fails.join('; ') : ''; _cbRender();
}
function _cbImgBox(e){
  var th = (e.images || []).map(function(u, i){
    return '<span style="position:relative;display:inline-block;margin:0 6px 6px 0"><img src="' + esc(_cbImgSrc(u)) + '" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">' +
      '<button type="button" onclick="_cbImgDel(' + i + ')" title="Xóa ảnh" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#c0392b;color:#fff;cursor:pointer;line-height:18px;padding:0">×</button></span>';
  }).join('');
  var full = (e.images || []).length >= _CB_MAX_IMG;
  return '<label style="font-size:12px;font-weight:600;margin:8px 0 2px;display:block">Ảnh combo (tối đa ' + _CB_MAX_IMG + ' — hiện khi tra giá / xem combo)</label>' +
    '<div>' + th + '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
      '<label class="btn sm" style="cursor:pointer' + (full || e.imgBusy ? ';opacity:.5;pointer-events:none' : '') + '">📷 Tải ảnh từ máy<input type="file" accept="image/*" multiple style="display:none" onchange="_cbImgPick(Array.from(this.files));this.value=\'\'"></label>' +
      '<input id="cb-img-link" type="text" placeholder="…hoặc dán link ảnh / link file Drive" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:6px"' + (full ? ' disabled' : '') + '>' +
      '<button type="button" class="btn sm" onclick="_cbImgAddLink()"' + (full ? ' disabled' : '') + '>➕ Thêm link</button></div>' +
    (e.imgMsg ? '<div style="font-size:12px;margin-top:4px;color:' + (/^⚠|không hợp lệ|Tối đa/.test(e.imgMsg) ? '#c0392b' : 'var(--muted)') + '">' + esc(e.imgMsg) + '</div>' : '');
}
async function _cbSave(){
  var e = _cb.edit; if (!e || _cb.saving) return;
  if (e.imgBusy){ e.err = 'Đang tải ảnh lên — chờ xong rồi lưu.'; _cbRender(); return; }
  var name = String(e.name || '').trim(), pr = _cbPriceToSend_(e.price);
  var itemsText = _cbItemsText(e), hasItem = itemsText.split(/\r?\n/).some(function(l){ return l.trim(); });
  var err = !name ? 'Nhập tên combo.' : !hasItem ? 'Combo cần ít nhất 1 sản phẩm (mỗi dòng 1 món).' : pr.err ? pr.err
    : (e.start && e.end && e.end < e.start) ? 'Ngày kết thúc trước ngày bắt đầu.' : '';
  if (err){ e.err = err; _cbRender(); return; }
  _cb.saving = true; e.err = ''; _cbRender();
  var d = await _cbPost_('comboSave', { combo: { code: e.code, name: name, price: pr.n, itemsText: itemsText, note: e.note, start: e.start, end: e.end, keywords: e.keywords, active: !!e.active, images: (e.images || []).slice(0, _CB_MAX_IMG), ship: _cbNum(e.ship), freeship: !!e.freeship, ctkmCodes: (e.ctkmCodes || []).slice() } });
  _cb.saving = false;
  if (d && d.ok){ _cb.edit = null; if (typeof toast === 'function') toast((d.created ? 'Đã thêm combo ' : 'Đã lưu combo ') + (d.code || name)); _cbLoad(); return; }
  e.err = (d && d.error) || 'Lưu không thành công.'; _cbRender();
}
async function _cbDelete(i){
  var c = _cbVisible()[i]; if (!c || _cb.saving) return;
  if (!(await uiConfirm('Xóa hẳn combo "' + c.name + '" (' + c.code + ') khỏi sheet COMBO? Không hoàn tác được.'))) return;
  _cb.saving = true;
  var d = await _cbPost_('comboDelete', { code: c.code });
  _cb.saving = false;
  if (d && d.ok){ if (typeof toast === 'function') toast('Đã xóa combo ' + c.name); _cbLoad(); return; }
  _cb.err = (d && d.error) || 'Xóa không thành công.'; _cbRender();
}
// ───────────── CHỌN SẢN PHẨM TỪ DANH SÁCH CÓ SẴN + GIÁ NIÊM YẾT (18/11/2026, Duyên: "chọn sản phẩm từ danh sách có sẵn kèm giá niêm yết theo Pos đơn gần nhất hoặc giá theo bảng giá, giống lên đơn Pos") ───────────
//  Nguồn SP: GAS priceCatalogFlat (bảng giá DANH_MUC, giá NGHÌN đồng). Giá POS: GAS posPrice (đơn giá cột T của đơn POS gần nhất, đồng). Mỗi dòng chọn nguồn giá + sửa giá + khuyến mãi (đ hoặc %) như màn lên đơn Pos.
//  LƯU: KHÔNG đổi định dạng sheet COMBO — vẫn "Tên | Chất liệu | Size | SL" mỗi dòng (_cbItemsText) nên Pancake/Zalo "Soạn đơn", Trợ lý AI giá, comboList dùng nguyên. Giá niêm yết/khuyến mãi chỉ để admin tham khảo khi định GIÁ COMBO, không lưu.
var _cbCat = { items: [], loaded: false, loading: false, err: '' };
var _cbPick = { q: '', list: [] };
function _cbFold(s){ try { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g, '').replace(/[đĐðÐ]/g, 'd').toLowerCase(); } catch(e){ return String(s == null ? '' : s).toLowerCase(); } }   // Ð/ð (U+00D0/F0, hay lẫn trong tên SP dán từ nơi khác) trông giống Đ nhưng khác mã → phải đổi về d, không thì gõ "điếu" không ra "HẠT ĐỒNG ĐIẾU" (18/11/2026)
function _cbWords(s){ return ' ' + _cbFold(s).replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }
function _cbKToVnd(n){ n = Math.round(Number(n) || 0); return n > 0 && n < 100000 ? n * 1000 : n; }   // bảng giá ghi nghìn (1.299 = 1.299.000đ); ≥100000 coi là đồng đầy đủ (giống GAS _comboVnd_)
function _cbNum(v){ return parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0; }
function _cbMkItem(o){
  o = o || {};
  var q = parseInt(o.qty, 10); if (!(q >= 1)) q = 1;
  return { name: String(o.name || '').trim(), chatLieu: String(o.chatLieu || '').trim(), size: String(o.size || '').trim(), qty: q, mName: String(o.mName || ''), code: '',
    price: 0, src: '', bg: o.bg || { p: 0, sp: 0, r: 0 }, posPrice: 0, posDate: '', posState: '', disc: 0, discPct: false, vang: '', gift: false, saved: false };
}
// Chữ "Tên | Chất liệu | Size | SL" (mỗi dòng 1 món, hoặc "2 x Tên") → danh sách dòng (giống GAS _comboParseItems_).
function _cbParseItems(text){
  var out = [];
  String(text == null ? '' : text).split(/\r?\n/).forEach(function(line){
    line = String(line).trim(); if (!line) return;
    var qty = 1, m = line.match(/^(\d{1,3})\s*[xX×]\s*(.+)$/);
    if (m){ qty = parseInt(m[1], 10); line = m[2]; }
    var p = line.split('|').map(function(s){ return String(s).trim(); });
    if (!p[0]) return;
    if (p.length >= 4 && /^\d{1,3}$/.test(p[3])) qty = parseInt(p[3], 10);
    var it = _cbMkItem({ name: p[0], chatLieu: p[1] || '', size: p[2] || '', qty: qty });
    var vg = String(p[4] || '').match(/^(\d{1,2})\s*k$/i); it.vang = vg && [10, 14, 18, 24].indexOf(parseInt(vg[1], 10)) >= 0 ? parseInt(vg[1], 10) + 'k' : '';
    it.gift = /^(1|true|qua|quà)$/i.test(String(p[6] || '').trim());
    var gia = p[5] ? parseInt(String(p[5]).replace(/[^\d]/g, ''), 10) || 0 : 0;
    if (gia > 0){ it.price = gia; it.src = 'tay'; it.saved = true; }   // giá đã lưu trong combo: không bị giá POS/bảng giá ghi đè khi mở lại
    out.push(it);
  });
  return out;
}
function _cbItemsText(e){
  if (!e) return '';
  if (e.rawMode || !e.items) return String(e.itemsText || '');
  return e.items.filter(function(it){ return it.name; }).map(function(it){
    var base = it.name + ' | ' + it.chatLieu + ' | ' + it.size + ' | ' + (it.qty >= 1 ? it.qty : 1), vg = it.vang || '', gia = Math.round(it.price || 0);
    return (vg || gia || it.gift) ? base + ' | ' + vg + ' | ' + (gia || '') + ' | ' + (it.gift ? 'qua' : '') : base;   // dòng không vàng/giá/quà giữ 4 trường như cũ (giống GAS _comboItemsToText_)
  }).join('\n');
}
function _cbDisc(it){ var tot = (it.price || 0) * (it.qty || 1); return Math.min(tot, it.discPct ? Math.round(tot * Math.max(0, Math.min(100, Number(it.disc) || 0)) / 100) : Math.max(0, Math.round(Number(it.disc) || 0))); }
function _cbNet(it){ return Math.max(0, (it.price || 0) * (it.qty || 1) - _cbDisc(it)); }
function _cbTotals(items){
  var t = { models: 0, qty: 0, list: 0, disc: 0, net: 0 };
  (items || []).forEach(function(it){ if (!it.name || it.gift) return; t.models++; t.qty += it.qty || 1; t.list += (it.price || 0) * (it.qty || 1); t.disc += _cbDisc(it); t.net += _cbNet(it); });
  return t;
}
async function _cbCatLoad(){
  if (_cbCat.loaded || _cbCat.loading) return;
  if (typeof gsUrl === 'undefined' || !gsUrl){ _cbCat.err = 'Chưa kết nối Google Sheets.'; return; }
  _cbCat.loading = true; _cbCat.err = ''; _cbPickStatus();
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=priceCatalogFlat', { redirect:'follow' });
    var d = await r.json();
    if (d && d.ok && Array.isArray(d.items)){
      _cbCat.items = d.items.map(function(x){ x._w = _cbWords([x.t, x.m, x.n, x.c, x.s].join(' ')); return x; });
      _cbCat.loaded = true;
    } else _cbCat.err = (d && d.error) || 'GAS chưa có action priceCatalogFlat.';
  } catch(e){ _cbCat.err = 'Không tải được bảng giá: ' + (e && e.message || e); }
  _cbCat.loading = false;
  if (_cb.edit){ if (_cbCat.loaded) _cbAttachAll(); _cbPickStatus(); _cbPickRender(); _cbItemsRefresh(); }
}
// Dòng combo cũ (đọc từ chữ) → ghép với bảng giá để có giá bảng giá; rồi hỏi giá POS.
function _cbAttachCat(it){
  if (it.bg && (it.bg.p || it.bg.sp || it.bg.r)) return;
  var n = _cbFold(it.name), c = _cbFold(it.chatLieu), s = _cbFold(it.size), best = null, bs = -1;
  for (var i = 0; i < _cbCat.items.length; i++){
    var x = _cbCat.items[i];
    if (_cbFold(x.t) !== n && _cbFold(x.m) !== n) continue;
    var sc = (s && _cbFold(x.s) === s ? 2 : 0) + (c && _cbFold(x.c) === c ? 1 : 0);
    if (s && _cbFold(x.s) !== s) sc -= 1;
    if (sc > bs){ best = x; bs = sc; }
  }
  if (best){ it.bg = { p: _cbKToVnd(best.p), sp: _cbKToVnd(best.sp), r: _cbKToVnd(best.r) }; if (!it.src && it.bg.p){ it.price = it.bg.p; it.src = 'bg'; } }
}
function _cbAttachAll(){ var e = _cb.edit; if (!e || !e.items) return; e.items.forEach(_cbAttachCat); _cbFetchPos(e.items); }
// Hỏi GAS posPrice cho các dòng chưa hỏi (1 lần gộp). Có giá POS → mặc định dùng giá POS (trừ khi admin đã tự nhập giá).
async function _cbFetchPos(items){
  var todo = (items || []).filter(function(it){ return it.name && !it.posState; });
  if (!todo.length || typeof gsUrl === 'undefined' || !gsUrl) return;
  todo.forEach(function(it){ it.posState = 'loading'; });
  try {
    var q = todo.map(function(it){ return { t: it.name, m: it.mName || '', c: it.chatLieu, s: it.size }; });
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=posPrice&q=' + encodeURIComponent(JSON.stringify(q)), { redirect:'follow' });
    var d = await r.json();
    if (d && d.ok && Array.isArray(d.results)){
      todo.forEach(function(it, i){
        var x = d.results[i];
        if (x && x.found && x.price > 0){ it.posPrice = x.price; it.posDate = x.date || ''; it.code = x.code || it.code; it.posState = 'ok'; if (it.src !== 'tay'){ it.price = x.price; it.src = 'pos'; } }
        else it.posState = 'none';
      });
    } else todo.forEach(function(it){ it.posState = 'err'; });
  } catch(err){ todo.forEach(function(it){ it.posState = 'err'; }); }
  _cbItemsRefresh();
}
function _cbPickStatus(){
  var b = document.getElementById('cb-pick-st'); if (!b) return;
  b.innerHTML = _cbCat.loading ? 'Đang tải danh sách sản phẩm…' : _cbCat.err ? '<span style="color:#c0392b">⚠ ' + esc(_cbCat.err) + ' — bấm "✏️ Nhập dạng chữ" bên dưới để nhập tay.</span>' : _cbCat.loaded ? _cbCat.items.length + ' sản phẩm trong bảng giá — gõ để tìm rồi bấm chọn.' : '';
}
function _cbPickSet(v){ _cbPick.q = v || ''; _cbPickRender(); }
function _cbPickRender(){
  var box = document.getElementById('cb-pick-res'); if (!box) return;
  var toks = _cbWords(_cbPick.q).trim().split(' ').filter(Boolean), out = [];
  if (toks.length && _cbCat.loaded){
    for (var i = 0; i < _cbCat.items.length && out.length < 12; i++){
      var x = _cbCat.items[i], ok = true;
      for (var k = 0; k < toks.length; k++) if (x._w.indexOf(toks[k]) < 0){ ok = false; break; }
      if (ok) out.push(x);
    }
  }
  _cbPick.list = out;
  box.innerHTML = !toks.length ? '' : !_cbCat.loaded ? '' : !out.length ? '<div style="font-size:12px;color:var(--muted);padding:6px">Không có sản phẩm khớp.</div>' :
    out.map(function(x, i){
      var sub = [x.c, x.s].filter(function(v){ return v && String(v).trim(); }).join(' · '), pr = _cbKToVnd(x.p);
      return '<div onclick="_cbPickAdd(' + i + ')" style="cursor:pointer;display:flex;gap:8px;justify-content:space-between;align-items:center;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-top:4px;background:var(--card,#fff)">' +
        '<span><b>' + esc(x.t || x.m) + '</b>' + (sub ? ' <span style="font-size:12px;color:var(--muted)">' + esc(sub) + '</span>' : '') + '</span>' +
        '<span style="white-space:nowrap;font-size:12px;color:#1a56b0">' + (pr ? esc(_cbVnd(pr)) : 'chưa có giá') + ' ＋</span></div>';
    }).join('');
}
function _cbPickAdd(i){
  var x = _cbPick.list[i], e = _cb.edit; if (!x || !e) return;
  e.items = e.items || [];
  var name = String(x.t || x.m || '').trim(), c = String(x.c || '').trim(), s = String(x.s || '').trim();
  var ex = e.items.filter(function(it){ return _cbFold(it.name) === _cbFold(name) && _cbFold(it.chatLieu) === _cbFold(c) && _cbFold(it.size) === _cbFold(s); })[0];
  if (ex) ex.qty = Math.min(999, ex.qty + 1);
  else {
    var it = _cbMkItem({ name: name, chatLieu: c, size: s, qty: 1, mName: x.m, bg: { p: _cbKToVnd(x.p), sp: _cbKToVnd(x.sp), r: _cbKToVnd(x.r) } });
    if (it.bg.p){ it.price = it.bg.p; it.src = 'bg'; }
    e.items.push(it); _cbFetchPos([it]);
  }
  _cbPick.q = ''; var qi = document.getElementById('cb-pick-q'); if (qi){ qi.value = ''; qi.focus(); }
  _cbPickRender(); _cbItemsRefresh();
}
function _cbLineDel(i){ var e = _cb.edit; if (!e || !e.items) return; e.items.splice(i, 1); _cbItemsRefresh(); }
function _cbLineSet(i, k, v){
  var e = _cb.edit, it = e && e.items && e.items[i]; if (!it) return;
  if (k === 'price'){ it.price = _cbNum(v); it.src = 'tay'; it.saved = false; }
  else if (k === 'qty') it.qty = Math.max(1, Math.min(999, parseInt(v, 10) || 1));
  else if (k === 'disc') it.disc = it.discPct ? Math.max(0, Math.min(100, parseFloat(String(v).replace(',', '.')) || 0)) : _cbNum(v);
  _cbItemsRefresh();
}
function _cbLineDiscMode(i){ var e = _cb.edit, it = e && e.items && e.items[i]; if (!it) return; it.discPct = !it.discPct; it.disc = 0; _cbItemsRefresh(); }
function _cbLineSrc(i, src){
  var e = _cb.edit, it = e && e.items && e.items[i]; if (!it) return;
  var v = src === 'pos' ? it.posPrice : src === 'bg' ? it.bg.p : src === 'saphia' ? it.bg.sp : src === 'ruby' ? it.bg.r : 0;
  if (src !== 'tay' && v > 0){ it.price = v; it.src = src; } else if (src === 'tay') it.src = 'tay';
  _cbItemsRefresh();
}
function _cbUseTotal(){
  var e = _cb.edit; if (!e) return;
  var t = _cbTotals(e.items); if (!(t.net > 0)) return;
  e.price = String(t.net); var inp = document.getElementById('cb-price'); if (inp) inp.value = e.price; _cbItemsRefresh();
}
function _cbSrcNote(it){
  if (it.posState === 'loading') return 'đang tra giá POS…';
  if (it.src === 'pos') return 'POS đơn ' + _cbDateVN(it.posDate).slice(0, 5);
  if (it.src === 'tay' && it.saved) return 'đã lưu trong combo';
  if (it.src === 'bg') return 'Bảng giá';   // KHÔNG ghi chú "(chưa có đơn POS khớp)/(không tra được POS)" — Duyên yêu cầu bỏ cho gọn
  if (it.src === 'saphia') return 'Bảng giá SAPHIA'; if (it.src === 'ruby') return 'Bảng giá RUBY';
  return it.src === 'tay' ? 'nhập tay' : 'chưa có giá — nhập tay';
}
// ── CTKM THAM KHẢO (bước 3/4): sheet CTKM là văn bản tự do (cột mỗi lúc một khác) nên KHÔNG tự tính giảm giá — chỉ nhắc các CTKM ĐANG áp dụng có nhắc tên SP dưới dòng, admin tự nhập ô Khuyến mãi. ──
var _cbCtkm = { rows: [], loaded: false, loading: false };
async function _cbCtkmLoad(){
  if (_cbCtkm.loaded || _cbCtkm.loading || typeof gsUrl === 'undefined' || !gsUrl) return;
  _cbCtkm.loading = true;
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=ctkmCatalog', { redirect:'follow' });
    var d = await r.json();
    if (d && Array.isArray(d.rows)) _cbCtkm.rows = d.rows.filter(function(row){ return !row.__ctkmExpired && !row.__ctkmUpcoming; }).map(function(row){
      var keys = Object.keys(row).filter(function(k){ return k.indexOf('__ctkm') !== 0 && row[k] !== '' && row[k] != null && _cbFold(k).trim() !== 'stt'; });
      return { title: keys.length ? String(row[keys[0]]) : '', w: _cbWords(keys.map(function(k){ return row[k]; }).join(' ')) };
    }).filter(function(x){ return x.title; });
    _cbCtkm.loaded = true;
  } catch(e){ _cbCtkm.loaded = true; }   // GAS cũ / chưa có sheet CTKM → không hiện gì, không báo lỗi
  _cbCtkm.loading = false; _cbItemsRefresh();
}
function _cbCtkmFor(it){
  var toks = _cbWords(it.name).trim().split(' ').filter(function(t){ return t.length > 1; }), out = [];
  if (!toks.length) return out;
  for (var i = 0; i < _cbCtkm.rows.length && out.length < 2; i++){
    var ok = true; for (var k = 0; k < toks.length; k++) if (_cbCtkm.rows[i].w.indexOf(' ' + toks[k] + ' ') < 0){ ok = false; break; }
    if (ok) out.push(_cbCtkm.rows[i].title.length > 90 ? _cbCtkm.rows[i].title.slice(0, 90) + '…' : _cbCtkm.rows[i].title);
  }
  return out;
}
function _cbCtkmHtml(it){
  var m = _cbCtkmFor(it); if (!m.length) return '';
  return '<div style="font-size:12px;margin-top:6px;color:#8a5a00;background:#fff8e6;border-radius:6px;padding:4px 8px">🎁 CTKM liên quan: ' + m.map(esc).join(' · ') + ' <span style="color:var(--muted)">— tự nhập khuyến mãi ở trên nếu áp dụng</span></div>';
}
function _cbLineHtml(it, i){
  var opt = function(v, label, on){ return '<option value="' + v + '"' + (it.src === v ? ' selected' : '') + (on ? '' : ' disabled') + '>' + label + '</option>'; };
  var sub = [it.chatLieu, it.size].filter(Boolean).join(' · '), st = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;box-sizing:border-box';
  return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;background:var(--card,#fff)">' +
    '<div style="display:flex;gap:8px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap">' +
      '<div style="min-width:170px;flex:1">' + (it.code ? '<span style="font-size:11px;border:1px solid #6c3;color:#3a8a1d;border-radius:6px;padding:0 6px;margin-right:6px">' + esc(it.code) + '</span>' : '') + '<b>' + esc(String(it.name).toUpperCase()) + '</b>' + (sub ? '<div style="font-size:12px;color:var(--muted)">' + esc(sub) + '</div>' : '') + '</div>' +
      '<div style="display:flex;gap:6px;align-items:center"><input value="' + esc(it.price ? String(it.price) : '') + '" placeholder="đơn giá" onchange="_cbLineSet(' + i + ',\'price\',this.value)" style="width:112px;' + st + '"> <span>đ ×</span>' +
        '<input value="' + it.qty + '" onchange="_cbLineSet(' + i + ',\'qty\',this.value)" style="width:56px;' + st + '"></div></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;font-size:12px"><span>Vàng:</span>' +
      ['10k', '14k', '18k', '24k'].map(function(v){ return '<button type="button" class="btn sm' + (it.vang === v ? ' primary' : '') + '" onclick="_cbLineVang(' + i + ',\'' + v + '\')" title="Tích tuổi vàng (bấm lại để bỏ)">' + v + '</button>'; }).join('') +
      '<label style="margin-left:10px;display:flex;gap:4px;align-items:center"><input type="checkbox"' + (it.gift ? ' checked' : '') + ' onchange="_cbLineGift(' + i + ',this.checked)"> 🎁 Quà tặng</label></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-top:8px;font-size:12px">' +
      '<span>Giá: <select onchange="_cbLineSrc(' + i + ',this.value)" style="padding:3px 6px;border:1px solid var(--border);border-radius:6px">' +
        opt('pos', 'POS gần nhất', it.posPrice > 0) + opt('bg', 'Bảng giá', it.bg.p > 0) + opt('saphia', 'SAPHIA', it.bg.sp > 0) + opt('ruby', 'RUBY', it.bg.r > 0) + opt('tay', 'Nhập tay', true) + (it.src ? '' : '<option selected disabled>—</option>') +
        '</select> <span style="color:var(--muted)">' + esc(_cbSrcNote(it)) + '</span></span>' +
      '<span>Khuyến mãi: <input value="' + esc(it.disc ? String(it.disc) : '') + '" placeholder="0" onchange="_cbLineSet(' + i + ',\'disc\',this.value)" style="width:84px;' + st + '"> <button type="button" class="btn sm" onclick="_cbLineDiscMode(' + i + ')" title="Đổi giữa đ và %">' + (it.discPct ? '%' : 'đ') + '</button></span>' +
      '<span style="display:flex;gap:8px;align-items:center"><b style="font-size:14px;color:#1a56b0">' + esc(_cbVnd(_cbNet(it)) || '0đ') + '</b><button type="button" class="btn sm" onclick="_cbLineDel(' + i + ')" title="Bỏ khỏi combo">🗑</button></span></div>' + _cbCtkmHtml(it) + '</div>';
}
function _cbItemsInner(e){
  var items = e.items || [], t = _cbTotals(items);
  if (!items.length) return '<div style="font-size:12px;color:var(--muted);padding:8px 0">Chưa có sản phẩm — gõ tên ở ô tìm phía trên rồi bấm chọn.</div>';
  var combo = _cbNum(e.price);   // người dùng nhập ĐỒNG đầy đủ (giá nghìn/đồng chỉ đổi lúc gửi, xem _cbPriceToSend_)
  return '<div style="display:flex;gap:14px;font-size:13px;margin:8px 0;font-weight:600"><span>Số mẫu mã: ' + t.models + '</span><span>Số lượng SP: ' + t.qty + '</span></div>' +
    items.map(_cbLineHtml).join('') +
    '<div style="border-top:1px dashed var(--border);padding-top:8px;font-size:13px;display:flex;gap:6px 16px;flex-wrap:wrap;align-items:center;justify-content:space-between">' +
      '<span>Tổng niêm yết: <b>' + esc(_cbVnd(t.list) || '0đ') + '</b>' + (t.disc ? ' · Khuyến mãi: <b>−' + esc(_cbVnd(t.disc)) + '</b>' : '') + ' · Sau khuyến mãi: <b style="color:#1a56b0">' + esc(_cbVnd(t.net) || '0đ') + '</b>' +
        (combo && t.net ? ' · Giá combo ' + (combo <= t.net ? 'rẻ hơn ' + esc(_cbVnd(t.net - combo) || '0đ') + (t.net ? ' (' + Math.round((t.net - combo) * 100 / t.net) + '%)' : '') : '<span style="color:#c0392b">CAO hơn tổng ' + esc(_cbVnd(combo - t.net)) + '</span>') : '') + '</span>' +
      '<button type="button" class="btn sm" onclick="_cbUseTotal()"' + (t.net > 0 ? '' : ' disabled') + '>⬇ Dùng tổng làm giá combo</button></div>';
}
function _cbItemsRefresh(){ var b = document.getElementById('cb-items'); if (b && _cb.edit && !_cb.edit.rawMode) b.innerHTML = _cbItemsInner(_cb.edit); _cbPreviewRefresh(); }
function _cbRawToggle(){
  var e = _cb.edit; if (!e) return;
  if (e.rawMode){ e.items = _cbParseItems(e.itemsText); e.rawMode = false; _cbCatLoad(); if (_cbCat.loaded) _cbAttachAll(); }
  else { e.itemsText = _cbItemsText(e); e.rawMode = true; }
  _cbRender();
}
function _cbItemsBox(e){
  var lb = 'font-size:12px;font-weight:600;margin:8px 0 2px;display:block';
  if (e.rawMode) return '<label style="' + lb + '">Sản phẩm * (mỗi dòng 1 món: <i>Tên | Chất liệu | Size | SL</i> hoặc <i>2 x Tên</i>)</label>' +
    '<textarea rows="5" oninput="_cbEF(\'itemsText\',this.value)" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit">' + esc(e.itemsText) + '</textarea>' +
    '<a href="#" onclick="_cbRawToggle();return false" style="font-size:12px">↩ Quay lại chọn từ danh sách</a>';
  return '<label style="' + lb + '">Sản phẩm * (chọn từ danh sách có sẵn — giá niêm yết lấy theo đơn POS gần nhất hoặc bảng giá)</label>' +
    '<input id="cb-pick-q" type="text" placeholder="🔍 Gõ tên sản phẩm để thêm (vd: vòng cuốn, nhẫn túi tiền)…" value="' + esc(_cbPick.q) + '" oninput="_cbPickSet(this.value)" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<div id="cb-pick-st" style="font-size:12px;color:var(--muted);margin-top:3px"></div><div id="cb-pick-res" style="max-height:230px;overflow:auto"></div>' +
    '<div id="cb-items">' + _cbItemsInner(e) + '</div>' +
    '<a href="#" onclick="_cbRawToggle();return false" style="font-size:12px">✏️ Nhập dạng chữ (nâng cao)</a>';
}
// ───────────── COMBO v2 (18/11/2026, Duyên): TÍCH VÀNG 10k/14k/18k/24k + QUÀ mỗi dòng, SHIP / FREESHIP, TÍCH CTKM COMBO TẠO SẴN (giảm tiền / tặng quà ≤2 ảnh), XEM TRƯỚC theo mẫu hiển thị ───────────
//  Dữ liệu: dòng SP lưu 7 trường `Tên | Chất liệu | Size | SL | Vàng | Đơn giá(đồng) | qua` (dòng cũ 4 trường vẫn đọc được — xem GAS _comboParseItems_). CTKM combo = sheet CTKM_COMBO (GAS ctkmComboList/Save/Delete).
var _cbKm = { rows: [], loaded: false, loading: false, err: '', view: false, edit: null, saving: false };
function _cbMoney(n){ return _cbVnd(n) || '0đ'; }
function _cbK(n){ n = Math.round(Number(n) || 0); return n % 1000 === 0 ? (n / 1000) + 'k' : _cbMoney(n); }
function _cbNghin(n){ n = Math.round(Number(n) || 0); return n % 1000 === 0 ? String(n / 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : _cbMoney(n); }
function _cbLineName(it){   // giống GAS _comboLineName_: vàng chèn ngay sau tên, trước đuôi "SIZE n"
  var name = String(it.name || '').trim(), vang = it.vang ? String(it.vang) : '';
  if (vang){ var m = name.match(/^(.*?)(\s+size\s*\S+)$/i); name = m ? m[1] + ' ' + vang + m[2] : name + ' ' + vang; }
  var cl = String(it.chatLieu || '').trim(), sz = String(it.size || '').trim();
  if (/mặc định|mac dinh/i.test(cl)) cl = ''; if (/mặc định|mac dinh/i.test(sz)) sz = '';
  var tail = [cl, sz].filter(function(x){ return x && name.toLowerCase().indexOf(x.toLowerCase()) < 0; }).join(' · ');
  return tail ? name + ' · ' + tail : name;
}
// c: { name, code, priceVnd, items[], discount, finalPrice, ship, freeship, total, gifts[] } (dòng từ GAS comboList hoặc _cbCalc(e)) → chữ hiển thị/copy theo mẫu Duyên (giống GAS _comboFormatText_).
function _cbFormatText(c){
  var L = ['🎁 ' + c.name + (c.code ? ' (' + c.code + ')' : '')];
  L.push('Giá combo: ' + (c.priceVnd > 0 ? _cbMoney(c.priceVnd) : (c.priceText || _cbMoney(0))) + (c.discount > 0 ? ' giảm ' + _cbK(c.discount) + ' còn ' + _cbMoney(c.finalPrice) : ''));
  (c.items || []).forEach(function(it){
    var q = it.qty || 1, n = _cbLineName(it);
    if (it.gift){ L.push('- 🎁 ' + n + (q > 1 ? ' × ' + q : '') + ' (quà tặng)'); return; }
    L.push('- ' + n + (it.price > 0 ? ' ' + (q > 1 ? _cbNghin(it.price) + ' × ' + q + ' = ' + _cbNghin(it.price * q) : _cbNghin(it.price)) : (q > 1 ? ' × ' + q : '')));
  });
  (c.gifts || []).forEach(function(g){ L.push('- 🎁 Quà tặng: ' + (g.gift || g.name)); });
  if (c.freeship) L.push('- Freeship tổng: ' + _cbMoney(c.total));
  else if (c.ship > 0) L.push('- ' + _cbK(c.ship) + ' ship tổng: ' + _cbMoney(c.total));
  return L.join('\n');
}
// Tính giá từ form đang sửa (CTKM đã tích lấy từ _cbKm.rows, chỉ CTKM đang hoạt động).
function _cbCalc(e){
  var disc = 0, gifts = [];
  (e.ctkmCodes || []).forEach(function(code){
    var k = _cbKm.rows.filter(function(x){ return x.code === code && x.active; })[0]; if (!k) return;
    if (k.type === 'giam') disc += k.amount || 0; else gifts.push({ code: k.code, name: k.name, gift: k.gift, images: k.images || [] });
  });
  var price = _cbNum(e.price), fin = Math.max(0, price - disc), ship = _cbNum(e.ship);
  return { name: String(e.name || '').trim() || '(chưa đặt tên)', code: e.code || '', priceVnd: price, discount: disc, finalPrice: fin, ship: ship, freeship: !!e.freeship, total: fin + (e.freeship ? 0 : ship), gifts: gifts,
    items: (e.rawMode ? _cbParseItems(e.itemsText) : (e.items || [])).filter(function(it){ return it.name; }) };
}
async function _cbKmLoad(force){
  if ((_cbKm.loaded && !force) || _cbKm.loading || typeof gsUrl === 'undefined' || !gsUrl) return;
  _cbKm.loading = true; _cbKm.err = '';
  try {
    var r = await fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=ctkmComboList', { redirect:'follow' });
    var d = await r.json();
    if (d && d.ok && Array.isArray(d.rows)){ _cbKm.rows = d.rows; _cbKm.loaded = true; } else _cbKm.err = (d && d.error) || 'GAS chưa có action ctkmComboList (cần deploy lại).';
  } catch(err){ _cbKm.err = 'Không tải được CTKM combo: ' + (err && err.message || err); }
  _cbKm.loading = false; _cbOptRefresh();
}
function _cbKmTick(code, on){
  var e = _cb.edit; if (!e) return; e.ctkmCodes = (e.ctkmCodes || []).filter(function(c){ return c !== code; });
  if (on) e.ctkmCodes.push(code);
  _cbItemsRefresh();
}
function _cbLineVang(i, v){ var e = _cb.edit, it = e && e.items && e.items[i]; if (!it) return; it.vang = it.vang === v ? '' : v; _cbItemsRefresh(); }
function _cbLineGift(i, on){ var e = _cb.edit, it = e && e.items && e.items[i]; if (!it) return; it.gift = !!on; _cbItemsRefresh(); }
function _cbOptInner(e){
  var rows = _cbKm.rows.filter(function(k){ return k.active || (e.ctkmCodes || []).indexOf(k.code) >= 0; });
  var ticks = _cbKm.loading ? '<div style="font-size:12px;color:var(--muted)">Đang tải CTKM combo…</div>' : _cbKm.err ? '<div style="font-size:12px;color:#c0392b">⚠ ' + esc(_cbKm.err) + '</div>' :
    !rows.length ? '<div style="font-size:12px;color:var(--muted)">Chưa có CTKM combo nào' + (_cbIsAdmin() ? ' — tạo ở tab Combo › 🎁 CTKM combo (giảm tiền / tặng quà) rồi quay lại tích.' : '.') + '</div>' :
    rows.map(function(k){
      var on = (e.ctkmCodes || []).indexOf(k.code) >= 0, what = k.type === 'giam' ? 'giảm ' + _cbK(k.amount) : '🎁 ' + (k.gift || 'tặng quà');
      return '<label style="display:flex;gap:6px;align-items:center;font-size:13px;margin:3px 0"><input type="checkbox"' + (on ? ' checked' : '') + ' onchange="_cbKmTick(\'' + esc(k.code) + '\',this.checked)"> <b>' + esc(k.name) + '</b> <span style="color:var(--muted)">— ' + esc(what) + (k.active ? '' : ' (đã tắt)') + '</span></label>';
    }).join('');
  return ticks;
}
function _cbOptRefresh(){ var b = document.getElementById('cb-ctkm'); if (b && _cb.edit) b.innerHTML = _cbOptInner(_cb.edit); }
function _cbPreviewRefresh(){
  var p = document.getElementById('cb-preview'); if (!p || !_cb.edit) return;
  var c = _cbCalc(_cb.edit); p.textContent = c.items.length ? _cbFormatText(c) : 'Chọn sản phẩm để xem trước cách hiển thị combo.';
}
function _cbOptBox(e){
  var lb = 'font-size:12px;font-weight:600;margin:8px 0 2px;display:block', st = 'padding:6px 10px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box';
  return '<label style="' + lb + '">Phí ship (đồng) — để trống = không tính ship</label>' +
    '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><input type="text" value="' + esc(e.ship) + '" placeholder="vd: 40000" oninput="_cbEF(\'ship\',this.value)" onchange="_cbItemsRefresh()" style="width:160px;' + st + '">' +
    '<label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox"' + (e.freeship ? ' checked' : '') + ' onchange="_cbEF(\'freeship\',this.checked);_cbItemsRefresh()"> 🚚 Freeship</label></div>' +
    '<label style="' + lb + '">🎁 CTKM combo (tích để áp dụng: giảm tiền / tặng quà)</label><div id="cb-ctkm">' + _cbOptInner(e) + '</div>' +
    '<label style="' + lb + '">Xem trước hiển thị / copy</label><pre id="cb-preview" style="white-space:pre-wrap;font-family:inherit;font-size:13px;background:var(--card,#fff);border:1px dashed var(--border);border-radius:8px;padding:8px 10px;margin:0"></pre>';
}
// ── QUẢN LÝ CTKM COMBO (admin): tạo sẵn giảm tiền / tặng quà (+ tối đa 2 ảnh quà) ──
function _cbKmOpen(){ _cbKm.view = true; _cbKm.edit = null; _cbKmLoad(true); _cbRender(); }
function _cbKmClose(){ _cbKm.view = false; _cbKm.edit = null; _cbRender(); }
function _cbKmNew(){ _cbKm.edit = { isNew: true, code: '', name: '', type: 'giam', amount: '', gift: '', images: [], active: true, err: '', imgMsg: '' }; _cbRender(); }
function _cbKmEditAt(i){ var k = _cbKm.rows[i]; if (!k) return; _cbKm.edit = { isNew: false, code: k.code, name: k.name, type: k.type, amount: k.amount ? String(k.amount) : '', gift: k.gift || '', images: _cbImgLines(k.imagesText).slice(0, 2), active: k.active !== false, err: '', imgMsg: '' }; _cbRender(); }
function _cbKmEF(k, v){ if (_cbKm.edit) _cbKm.edit[k] = v; }
function _cbKmType(v){ if (!_cbKm.edit) return; _cbKm.edit.type = v === 'qua' ? 'qua' : 'giam'; _cbRender(); }
function _cbKmImgDel(i){ var e = _cbKm.edit; if (!e) return; e.images.splice(i, 1); e.imgMsg = ''; _cbRender(); }
function _cbKmImgAddLink(){
  var e = _cbKm.edit; if (!e) return; var inp = document.getElementById('km-img-link'), u = String(inp && inp.value || '').trim(); if (!u) return;
  if (e.images.length >= 2){ e.imgMsg = 'Tối đa 2 ảnh quà.'; _cbRender(); return; }
  if (!_cbImgValid(u) && !/\/file\/d\/|[?&]id=/.test(u)){ e.imgMsg = 'Link ảnh không hợp lệ (cần link ảnh http/https hoặc link FILE Google Drive).'; _cbRender(); return; }
  e.images.push(u); e.imgMsg = ''; _cbRender();
}
async function _cbKmImgPick(files){
  var e = _cbKm.edit; if (!e) return; var list = Array.prototype.slice.call(files || []), room = 2 - e.images.length; if (!list.length) return;
  if (room <= 0){ e.imgMsg = 'Tối đa 2 ảnh quà.'; _cbRender(); return; }
  e.imgBusy = true; var fails = [];
  for (var i = 0; i < list.length && i < room; i++){
    var f = list[i];
    if (!/^image\//.test(f.type || '')){ fails.push((f.name || 'tệp') + ' không phải ảnh'); continue; }
    if (f.size > 12 * 1024 * 1024){ fails.push((f.name || 'ảnh') + ' quá 12MB'); continue; }
    e.imgMsg = 'Đang tải ảnh ' + (i + 1) + '/' + Math.min(list.length, room) + '…'; _cbRender();
    try {
      var im = await _cbReadImg_(f);
      var d = await _cbPost_('uploadTemplateImage', { imageBase64: im.b64, filename: String(f.name || 'qua.jpg').replace(/\.[^.]+$/, '') + '.jpg', mimeType: im.mime });
      if (d && d.ok && d.url) e.images.push(d.url); else fails.push((f.name || 'ảnh') + ': ' + ((d && d.error) || 'tải lên không thành công'));
    } catch(err){ fails.push((f.name || 'ảnh') + ': ' + (err && err.message || err)); }
  }
  if (list.length > room) fails.push('chỉ nhận thêm ' + room + ' ảnh');
  e.imgBusy = false; e.imgMsg = fails.length ? '⚠ ' + fails.join('; ') : ''; _cbRender();
}
async function _cbKmSave(){
  var e = _cbKm.edit; if (!e || _cbKm.saving) return;
  if (e.imgBusy){ e.err = 'Đang tải ảnh lên — chờ xong rồi lưu.'; _cbRender(); return; }
  var name = String(e.name || '').trim(), amt = _cbNum(e.amount), gift = String(e.gift || '').trim();
  var err = !name ? 'Nhập tên CTKM.' : (e.type === 'giam' && !amt) ? 'CTKM giảm tiền cần số tiền giảm (đồng, vd 200000; gõ 200 = 200k).' : (e.type === 'qua' && !gift && !e.images.length) ? 'CTKM tặng quà cần tên quà hoặc ảnh quà.' : '';
  if (err){ e.err = err; _cbRender(); return; }
  _cbKm.saving = true; e.err = ''; _cbRender();
  var d = await _cbPost_('ctkmComboSave', { ctkm: { code: e.code, name: name, type: e.type, amount: e.type === 'giam' ? amt : 0, gift: e.type === 'qua' ? gift : '', images: e.type === 'qua' ? e.images.slice(0, 2) : [], active: !!e.active } });
  _cbKm.saving = false;
  if (d && d.ok){ _cbKm.edit = null; if (typeof toast === 'function') toast((d.created ? 'Đã thêm CTKM ' : 'Đã lưu CTKM ') + name); await _cbKmLoad(true); _cbRender(); return; }
  e.err = (d && d.error) || 'Lưu không thành công.'; _cbRender();
}
async function _cbKmDelete(i){
  var k = _cbKm.rows[i]; if (!k || _cbKm.saving) return;
  if (!(await uiConfirm('Xóa hẳn CTKM "' + k.name + '" (' + k.code + ')? Combo đang tích CTKM này sẽ không còn áp dụng nó. Không hoàn tác được.'))) return;
  _cbKm.saving = true; var d = await _cbPost_('ctkmComboDelete', { code: k.code }); _cbKm.saving = false;
  if (d && d.ok){ if (typeof toast === 'function') toast('Đã xóa CTKM ' + k.name); await _cbKmLoad(true); } else _cbKm.err = (d && d.error) || 'Xóa không thành công.';
  _cbRender();
}
function _cbKmView(){
  var e = _cbKm.edit, st = 'width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border);border-radius:6px', lb = 'font-size:12px;font-weight:600;margin:8px 0 2px;display:block';
  if (e){
    var th = e.images.map(function(u, i){ return '<span style="position:relative;display:inline-block;margin:0 6px 6px 0"><img src="' + esc(_cbImgSrc(u)) + '" alt="" style="width:84px;height:84px;object-fit:cover;border-radius:8px;border:1px solid var(--border)"><button type="button" onclick="_cbKmImgDel(' + i + ')" title="Xóa ảnh" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#c0392b;color:#fff;cursor:pointer;line-height:18px;padding:0">×</button></span>'; }).join('');
    var full = e.images.length >= 2;
    return '<div style="font-size:18px;font-weight:700;margin-bottom:4px">' + (e.isNew ? '➕ Thêm CTKM combo' : '✏️ Sửa CTKM ' + esc(e.code)) + '</div>' +
      (e.err ? '<div style="color:#c0392b;padding:10px;background:#fdecea;border-radius:8px;margin:8px 0">' + esc(e.err) + '</div>' : '') +
      '<label style="' + lb + '">Tên CTKM *</label><input type="text" value="' + esc(e.name) + '" placeholder="vd: Giảm 200k dịp 20/11" oninput="_cbKmEF(\'name\',this.value)" style="' + st + '">' +
      '<label style="' + lb + '">Loại</label><div style="display:flex;gap:14px;font-size:13px"><label><input type="radio" name="km-type"' + (e.type === 'giam' ? ' checked' : '') + ' onchange="_cbKmType(\'giam\')"> Giảm tiền</label><label><input type="radio" name="km-type"' + (e.type === 'qua' ? ' checked' : '') + ' onchange="_cbKmType(\'qua\')"> Tặng quà</label></div>' +
      (e.type === 'giam' ? '<label style="' + lb + '">Số tiền giảm (đồng) *</label><input type="text" value="' + esc(e.amount) + '" placeholder="vd: 200000 (gõ 200 = 200k)" oninput="_cbKmEF(\'amount\',this.value)" style="' + st + '">' :
        '<label style="' + lb + '">Quà tặng (tên quà) — hoặc chỉ cần ảnh quà</label><input type="text" value="' + esc(e.gift) + '" placeholder="vd: Túi tiền lam thủy" oninput="_cbKmEF(\'gift\',this.value)" style="' + st + '">' +
        '<label style="' + lb + '">Ảnh quà (tối đa 2)</label><div>' + th + '</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
        '<label class="btn sm" style="cursor:pointer' + (full || e.imgBusy ? ';opacity:.5;pointer-events:none' : '') + '">📷 Tải ảnh quà<input type="file" accept="image/*" multiple style="display:none" onchange="_cbKmImgPick(Array.from(this.files));this.value=\'\'"></label>' +
        '<input id="km-img-link" type="text" placeholder="…hoặc dán link ảnh / link file Drive" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:6px"' + (full ? ' disabled' : '') + '><button type="button" class="btn sm" onclick="_cbKmImgAddLink()"' + (full ? ' disabled' : '') + '>➕ Thêm link</button></div>' +
        (e.imgMsg ? '<div style="font-size:12px;margin-top:4px;color:' + (/^⚠|không hợp lệ|Tối đa/.test(e.imgMsg) ? '#c0392b' : 'var(--muted)') + '">' + esc(e.imgMsg) + '</div>' : '')) +
      '<label style="font-size:13px;display:flex;gap:6px;align-items:center;margin:10px 0"><input type="checkbox"' + (e.active ? ' checked' : '') + ' onchange="_cbKmEF(\'active\',this.checked)"> Đang hoạt động</label>' +
      '<div style="display:flex;gap:8px"><button class="btn primary" onclick="_cbKmSave()"' + (_cbKm.saving ? ' disabled' : '') + '>' + (_cbKm.saving ? 'Đang lưu…' : '💾 Lưu') + '</button><button class="btn" onclick="_cbKm.edit=null;_cbRender()">Hủy</button></div>';
  }
  return '<div style="font-size:18px;font-weight:700;margin-bottom:4px">🎁 CTKM combo (tạo sẵn để tích khi tạo combo)</div>' +
    '<div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap"><button class="btn sm" onclick="_cbKmClose()">← Về danh sách combo</button><button class="btn sm primary" onclick="_cbKmNew()">➕ Thêm CTKM</button></div>' +
    (_cbKm.loading ? '<div style="color:var(--muted);padding:12px">Đang tải…</div>' : '') + (_cbKm.err ? '<div style="color:#c0392b;padding:12px;background:#fdecea;border-radius:8px;margin-bottom:8px">' + esc(_cbKm.err) + '</div>' : '') +
    (!_cbKm.loading && !_cbKm.rows.length && !_cbKm.err ? '<div style="color:var(--muted);padding:16px">Chưa có CTKM combo. Bấm ➕ Thêm CTKM (giảm tiền hoặc tặng quà).</div>' : '') +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">' + _cbKm.rows.map(function(k, i){
      return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--card,#fff);opacity:' + (k.active ? 1 : .6) + '"><div style="font-weight:700">' + esc(k.name) + '</div><div style="font-size:11px;color:var(--muted)">' + esc(k.code) + (k.active ? '' : ' · đã tắt') + '</div>' +
        '<div style="margin:6px 0;font-size:13px">' + (k.type === 'giam' ? '💸 Giảm <b>' + esc(_cbK(k.amount)) + '</b>' : '🎁 Tặng: <b>' + esc(k.gift || '(xem ảnh)') + '</b>') + '</div>' +
        ((k.images || []).length ? '<div style="display:flex;gap:6px;margin-bottom:6px">' + k.images.map(function(u){ return '<img src="' + esc(u) + '" alt="" loading="lazy" style="width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">'; }).join('') + '</div>' : '') +
        '<div style="display:flex;gap:6px"><button class="btn sm" onclick="_cbKmEditAt(' + i + ')">✏️ Sửa</button><button class="btn sm" onclick="_cbKmDelete(' + i + ')">🗑 Xóa</button></div></div>'; }).join('') + '</div>';
}
function _cbForm(){
  var e = _cb.edit, st = 'width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border);border-radius:6px', lb = 'font-size:12px;font-weight:600;margin:8px 0 2px;display:block';
  function inp(k, label, type, ph){ return '<label style="' + lb + '">' + label + '</label><input type="' + type + '"' + (k === 'price' ? ' id="cb-price" onchange="_cbItemsRefresh()"' : '') + ' value="' + esc(e[k]) + '" placeholder="' + esc(ph || '') + '" oninput="_cbEF(\'' + k + '\',this.value)" style="' + st + '">'; }
  return '<div style="font-size:18px;font-weight:700;margin-bottom:4px">' + (e.isNew ? '➕ Thêm combo mới' : '✏️ Sửa combo ' + esc(e.code)) + '</div>' +
    (e.err ? '<div style="color:#c0392b;padding:10px;background:#fdecea;border-radius:8px;margin:8px 0">' + esc(e.err) + '</div>' : '') +
    inp('name', 'Tên combo *', 'text', 'vd: Combo Tỳ Hưu + Dây') + inp('price', 'Giá combo (đồng) *', 'text', 'vd: 250000') +
    _cbItemsBox(e) + _cbOptBox(e) +
    '<label style="' + lb + '">Điều kiện / ghi chú</label><textarea rows="2" oninput="_cbEF(\'note\',this.value)" style="' + st + ';font-family:inherit">' + esc(e.note) + '</textarea>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:140px">' + inp('start', 'Từ ngày (để trống = ngay)', 'date') + '</div><div style="flex:1;min-width:140px">' + inp('end', 'Đến ngày (để trống = không hạn)', 'date') + '</div></div>' +
    inp('keywords', 'Từ khóa tìm kiếm (cách nhau dấu phẩy)', 'text', 'vd: tỳ hưu, dây chuyền') +
    _cbImgBox(e) +
    '<label style="font-size:13px;display:flex;gap:6px;align-items:center;margin:10px 0"><input type="checkbox"' + (e.active ? ' checked' : '') + ' onchange="_cbEF(\'active\',this.checked)"> Đang hoạt động (bỏ chọn = tắt combo)</label>' +
    '<div style="display:flex;gap:8px"><button class="btn primary" onclick="_cbSave()"' + (_cb.saving ? ' disabled' : '') + '>' + (_cb.saving ? 'Đang lưu…' : '💾 Lưu') + '</button><button class="btn" onclick="_cbCancel()">Hủy</button></div>';
}
function _cbCardImgs(c){
  var im = (c.images || []).filter(Boolean); if (!im.length) return '';
  return '<div style="display:flex;gap:6px;margin-top:8px;overflow-x:auto">' + im.map(function(u){
    return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="' + esc(c.name) + '" loading="lazy" style="height:110px;min-width:110px;max-width:200px;object-fit:cover;border-radius:8px;border:1px solid var(--border)"></a>'; }).join('') + '</div>';
}
function _cbCard(c, i){
  var price = _cbVnd(c.discount > 0 ? c.finalPrice : c.priceVnd) || c.priceText || '';
  var body = _cbFormatText(c).split('\n').slice(1).join('\n');   // bỏ dòng tiêu đề (đã hiện ở trên)
  var gi = []; (c.gifts || []).forEach(function(g){ (g.images || []).forEach(function(u){ gi.push(u); }); });
  var giftImgs = gi.length ? '<div style="font-size:12px;margin-top:6px">🎁 Ảnh quà tặng:</div><div style="display:flex;gap:6px;margin-top:4px;overflow-x:auto">' + gi.map(function(u){ return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="quà tặng" loading="lazy" style="height:80px;min-width:80px;max-width:140px;object-fit:cover;border-radius:8px;border:1px solid var(--border)"></a>'; }).join('') + '</div>' : '';
  return '<div class="card" style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--card,#fff);opacity:' + (c.usable ? 1 : 0.65) + '">' +
    '<div style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between">' +
      '<div><div style="font-weight:700;font-size:15px">' + esc(c.name) + '</div><div style="font-size:11px;color:var(--muted)">' + esc(c.code) + '</div></div>' +
      '<div style="font-weight:800;font-size:16px;color:#c0392b;white-space:nowrap">' + esc(price) + '</div></div>' +
    _cbCardImgs(c) +
    '<div style="margin:8px 0 6px;font-size:13px;white-space:pre-wrap">' + esc(body) + '</div>' + giftImgs +
    (c.note && String(c.note).trim() ? '<div style="font-size:12px;margin-bottom:6px">📝 ' + esc(c.note) + '</div>' : '') +
    '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:var(--muted)">' + esc(c.statusLabel || '') + '</span>' +
      '<span style="display:flex;gap:6px">' + (_cbIsAdmin() ? '<button class="btn sm" onclick="_cbEditAt(' + i + ')">✏️ Sửa</button><button class="btn sm" onclick="_cbDelete(' + i + ')">🗑 Xóa</button>' : '') +
      '<button class="btn sm" onclick="_cbCopy(' + i + ')">📋 Copy</button></span></div></div>';
}
function _cbRender(){
  var w = document.getElementById('xt-wrap-combo'); if (!w) return;
  if (_cb.edit){ w.innerHTML = _cbForm(); _cbPickStatus(); _cbPickRender(); _cbPreviewRefresh(); return; }
  if (_cbKm.view){ w.innerHTML = _cbKmView(); return; }   // đang thêm/sửa: chỉ hiện form (giá trị gõ giữ trong _cb.edit nên tải lại nền không làm mất)
  var list = _cbVisible(), hidden = _cb.rows.length - list.length;
  var focus = document.activeElement && document.activeElement.id === 'cb-q';
  w.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px">🎁 Combo có sẵn</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Tra combo đang áp dụng (gõ tên, mã, sản phẩm… không cần dấu). Dữ liệu lấy từ sheet COMBO trong file bảng giá.</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"><input id="cb-q" type="text" placeholder="🔍 Tìm combo…" value="' + esc(_cb.q) + '" oninput="_cbSetQ(this.value)" style="flex:1;min-width:180px;padding:6px 10px;border:1px solid var(--border);border-radius:6px">' +
    '<button class="btn sm' + (_cb.all ? ' primary' : '') + '" onclick="_cbToggleAll()">' + (_cb.all ? 'Đang xem tất cả' : 'Chỉ đang áp dụng') + '</button>' +
    '<button class="btn sm" onclick="_cbLoad()">↻ Làm mới</button>' + (_cbIsAdmin() ? '<button class="btn sm" onclick="_cbKmOpen()">🎁 CTKM combo</button><button class="btn sm primary" onclick="_cbNew()">➕ Thêm combo</button>' : '') + '</div>' +
    (_cb.loading ? '<div style="color:var(--muted);padding:12px">Đang tải…</div>' : '') +
    (_cb.err ? '<div style="color:#c0392b;padding:12px;background:#fdecea;border-radius:8px;margin-bottom:8px">' + esc(_cb.err) + '</div>' : '') +
    (!_cb.loading && !_cb.err ? '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">' + list.length + ' combo' + (hidden > 0 ? ' · ẩn ' + hidden + ' combo hết hạn/chưa bắt đầu/đã tắt' : '') + (_cb.q ? '' : ' · tổng ' + _cb.total + ' trong sheet') + '</div>' : '') +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">' + list.map(_cbCard).join('') + '</div>' +
    (!_cb.loading && !_cb.err && !list.length ? '<div style="text-align:center;color:var(--muted);padding:20px">' + (_cb.total ? 'Không có combo khớp.' : 'Sheet COMBO chưa có combo nào — thêm dòng trên Google Sheets (cột: Mã | Tên | Sản phẩm | Giá | Ghi chú | Từ ngày | Đến ngày | Từ khóa | Hoạt động).') + '</div>' : '');
  if (focus){ var i = document.getElementById('cb-q'); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
registerExtraTab('combo', '🎁 Combo', function(){ _cbLoad(); });

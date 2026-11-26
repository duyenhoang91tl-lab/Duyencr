// ════════════════════════════════════════════════════════════════════
//  THƯ VIỆN SẢN PHẨM (18/11/2026, bước 2/4) — tab "🛍️ Thư viện sản phẩm" (menu Social). Backend: GAS plibList/plibUpload/plibDelete (gas_v13.js, test tools/test-plib.js).
//  Mỗi SẢN PHẨM trong bảng giá (priceCatalogFlat, gộp theo TÊN: các size/chất liệu cùng tên chung 1 thư mục) hoặc mỗi COMBO (comboList) = 1 thư mục ảnh, TỐI ĐA 50 ảnh (server chặn ảnh thứ 51).
//  Ô tìm tìm CẢ sản phẩm lẫn combo (không dấu, gõ dở, nhiều từ); bấm 1 kết quả = mở thẳng thư mục. Hàm dùng chung cho ô tìm nhanh toàn cục (bước 3): plibOpen(name, group).
//  KEY thư mục = tên bỏ dấu/thường/gọn — PHẢI giống server `_plibKey_` (đổi 1 bên là lệch thư mục). Combo: tên gửi lên "Combo: <tên>", group "Combo".
//  Ảnh thu nhỏ ≤1600px trước khi gửi (như Thư viện cũ js/48); tải tuần tự từng ảnh, dừng khi thư mục đầy. Xóa: người tải lên hoặc admin (server kiểm).
// ════════════════════════════════════════════════════════════════════
var _pl = { prods:[], combos:[], counts:{}, q:'', cur:null, items:[], n:0, max:50, me:'', admin:false, loading:false, loadingFolder:false, err:'', up:'', loadedCat:false, timer:0, hi:0, info:{ text:'', by:'', at:'' }, editInfo:false, draft:'', infoMsg:'', savingInfo:false };
var _PL_INFO_MAX = 4000;
var _PL_INFO_SECTIONS = ['Ý nghĩa', 'Điểm nổi bật', 'Cách tư vấn', 'Phù hợp tặng ai', 'Chất liệu & bảo quản'];
var _PL_SHOW_MAX = 120;
function _plKey(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120); }
function _plTok(){ try { return localStorage.getItem('ome_sess_token') || ''; } catch(e){ return ''; } }
function _plUrl(qs){ return gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + qs + '&token=' + encodeURIComponent(_plTok()); }
function _plThumb(fileId, sz){ return fileId ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w' + (sz || 400) : ''; }
// Danh sách thư mục = sản phẩm bảng giá (gộp theo tên) + combo. Mỗi phần tử: {key,name,group,combo,variants}
function _plBuildList(){
  var map = {}, out = [];
  _pl.prods.forEach(function(x){
    var name = String(x.t || x.m || '').trim(); if (!name) return;
    var k = _plKey(name); if (!k) return;
    if (map[k]){ map[k].variants++; return; }
    map[k] = { key:k, name:name, group:String(x.n || '').trim(), combo:false, variants:1, info:(_pl.counts[k] || {}).info || '' };
    out.push(map[k]);
  });
  _pl.combos.forEach(function(c){
    var nm = 'Combo: ' + String(c.name || '').trim(); var k = _plKey(nm);
    if (!c.name || map[k]) return;
    map[k] = { key:k, name:nm, group:'Combo', combo:true, variants:(c.items || []).length, info:(_pl.counts[k] || {}).info || '' };
    out.push(map[k]);
  });
  // Thư mục đã có ảnh nhưng SP không còn trong bảng giá (đổi tên/xóa dòng) vẫn hiện để không "mất" ảnh.
  Object.keys(_pl.counts).forEach(function(k){ if (!map[k]) out.push(map[k] = { key:k, name:_pl.counts[k].name || k, group:'', combo:/^combo /.test(k), variants:0, info:_pl.counts[k].info || '' }); });
  return out;
}
// Tìm thông minh: mọi từ gõ phải có (không dấu, thứ tự tuỳ ý). Xếp hạng: tên BẮT ĐẦU bằng cụm gõ (3) > tên/nhóm chứa đủ từ (2) > chỉ khớp trong phần THÔNG TIN sản phẩm (1). Cùng điểm giữ nguyên thứ tự gốc.
function _plSearch(list, q){
  var qk = _plKey(q), t = qk.split(' ').filter(Boolean); if (!t.length) return list;
  var out = [];
  list.forEach(function(f, i){
    var nk = _plKey(f.name), hay = ' ' + _plKey(f.name + ' ' + f.group) + ' ', sc = 0;
    if (t.every(function(w){ return hay.indexOf(w) > -1; })) sc = nk.indexOf(qk) === 0 ? 3 : 2;
    else if (f.info){ if (f._ik !== f.info){ f._ik = f.info; f._if = ' ' + _plKey(f.info) + ' '; } if (t.every(function(w){ return hay.indexOf(w) > -1 || f._if.indexOf(w) > -1; })) sc = 1; }
    if (sc) out.push({ f:f, sc:sc, i:i });
  });
  out.sort(function(a, b){ return b.sc - a.sc || a.i - b.i; });
  return out.map(function(o){ o.f._sc = o.sc; return o.f; });
}
// Kết quả cho ô tìm nhanh toàn cục (bước 3): trả mảng {name,group,combo,n} khớp q (cần đã tải danh mục — _plEnsureData).
function plibSearch(q, limit){
  return _plSearch(_plBuildList(), q).slice(0, limit || 8).map(function(f){ return { name:f.name, group:f.group, combo:f.combo, n:(_pl.counts[f.key] || {}).n || 0, hasInfo:!!f.info, viaInfo:f._sc === 1 }; });
}
// Tải ngầm danh mục (SP + combo + đếm ảnh) cho ô tìm toàn cục; xong gọi cb. An toàn khi gọi nhiều lần.
function plibPreload(cb){
  if (_pl.loadedCat || _pl.loading || typeof gsUrl === 'undefined' || !gsUrl) return;
  _plEnsureData().then(function(){ if (cb) try { cb(); } catch(e){} });
}
async function _plEnsureData(force){
  if (typeof gsUrl === 'undefined' || !gsUrl){ _pl.err = 'Chưa kết nối Google Sheets.'; return; }
  if (_pl.loading) return;
  _pl.loading = true; _pl.err = ''; _plRender();
  try {
    var jobs = [fetch(_plUrl('action=plibList'), { redirect:'follow' }).then(function(r){ return r.json(); })];
    if (force || !_pl.loadedCat){
      jobs.push(fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=priceCatalogFlat', { redirect:'follow' }).then(function(r){ return r.json(); }).catch(function(){ return null; }));
      jobs.push(fetch(gsUrl + (gsUrl.indexOf('?') < 0 ? '?' : '&') + 'action=comboList&q=', { redirect:'follow' }).then(function(r){ return r.json(); }).catch(function(){ return null; }));
    }
    var res = await Promise.all(jobs), L = res[0];
    if (!L || L.ok === false) _pl.err = (L && L.error) || 'GAS chưa có action plibList (chờ workflow deploy-gas xanh ở tab Actions rồi tải lại).';
    else { _pl.counts = L.counts || {}; _pl.max = L.max || 50; _pl.me = L.me || ''; _pl.admin = !!L.admin; }
    if (res.length > 1){
      if (res[1] && res[1].ok && Array.isArray(res[1].items)) _pl.prods = res[1].items;
      if (res[2] && res[2].ok && Array.isArray(res[2].rows)) _pl.combos = res[2].rows;
      _pl.loadedCat = true;
      if (!_pl.prods.length && !_pl.combos.length && !_pl.err) _pl.err = 'Chưa tải được bảng giá / combo.';
    }
  } catch(e){ _pl.err = 'Không tải được: ' + (e && e.message || e); }
  _pl.loading = false; _plRender();
}
async function _plLoadFolder(){
  if (!_pl.cur) return;
  _pl.loadingFolder = true; _plRender();
  try {
    var r = await fetch(_plUrl('action=plibList&key=' + encodeURIComponent(_pl.cur.name)), { redirect:'follow' }), d = await r.json();
    if (d && d.ok !== false){ _pl.items = d.items || []; _pl.n = d.n || _pl.items.length; _pl.max = d.max || 50; _pl.me = d.me || _pl.me; _pl.admin = !!d.admin; _pl.err = ''; _pl.info = d.info || { text:'', by:'', at:'' }; if (!_pl.editInfo) _pl.draft = _pl.info.text; }
    else _pl.err = (d && d.error) || 'Không tải được thư mục.';
  } catch(e){ _pl.err = 'Không tải được thư mục: ' + (e && e.message || e); }
  _pl.loadingFolder = false; _plRender();
}
function _plOpenIdx(i){ var f = _pl.shown && _pl.shown[i]; if (f) _plOpenFolder(f); }
function _plResetInfo(k){ var c = _pl.counts[k] || {}; _pl.info = { text:c.info || '', by:'', at:'' }; _pl.editInfo = false; _pl.draft = _pl.info.text; _pl.infoMsg = ''; }
function _plOpenFolder(f){ _pl.cur = { key:f.key, name:f.name, group:f.group, combo:f.combo }; _pl.items = []; _pl.n = (_pl.counts[f.key] || {}).n || 0; _pl.up = ''; _plResetInfo(f.key); _plLoadFolder(); }
function _plBack(){ _pl.cur = null; _pl.up = ''; _plEnsureData(); }
// Mở thư mục theo tên (dùng cho ô tìm nhanh toàn cục): chuyển sang tab rồi vào thẳng thư mục.
function plibOpen(name, group){
  var f = { key:_plKey(name), name:String(name || ''), group:String(group || ''), combo:/^combo:/i.test(String(name || '')) };
  _pl.cur = { key:f.key, name:f.name, group:f.group, combo:f.combo }; _pl.items = []; _pl.n = (_pl.counts[f.key] || {}).n || 0; _pl.up = ''; _plResetInfo(f.key);
  var el = document.querySelector('[data-bar-id="plib"]');
  try { if (typeof switchTab === 'function') switchTab('plib', el); } catch(e){}
  return _plLoadFolder();
}
function _plSetQ(v){ _pl.q = v || ''; _pl.hi = 0; clearTimeout(_pl.timer); _pl.timer = setTimeout(_plRender, 150); }
// Giống ô tìm khách: ↑/↓ chọn thư mục, Enter mở thẳng thư mục đang chọn (mặc định kết quả đầu tiên).
function _plKeydown(e){
  var n = (_pl.shown || []).length; if (!n) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); clearTimeout(_pl.timer); _pl.hi = (_pl.hi + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; _plRender(); }
  else if (e.key === 'Enter'){ e.preventDefault(); clearTimeout(_pl.timer); if (_pl.q) _plOpenIdx(Math.min(_pl.hi, n - 1)); }
}
// ── Tải ảnh ──
function _plShrink(file){
  return new Promise(function(ok){
    function raw(){ var r = new FileReader(); r.onload = function(){ ok({ b64:String(r.result).split(',')[1] || '', mime:file.type, name:file.name }); }; r.onerror = function(){ ok(null); }; r.readAsDataURL(file); }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024){ raw(); return; }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function(){
      var s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok({ b64:c.toDataURL('image/jpeg', 0.86).split(',')[1], mime:'image/jpeg', name:file.name.replace(/\.\w+$/, '') + '.jpg' });
    };
    img.onerror = function(){ URL.revokeObjectURL(url); raw(); };
    img.src = url;
  });
}
async function _plUpload(files){
  if (!_pl.cur || !files || !files.length) return;
  var list = Array.prototype.slice.call(files).filter(function(f){ return /^image\//.test(f.type || ''); });
  if (!list.length){ _pl.up = 'Chỉ nhận tệp ảnh.'; _plRender(); return; }
  var room = _pl.max - _pl.n;
  if (room <= 0){ _pl.up = '⚠ Thư mục đã đủ ' + _pl.max + ' ảnh — xóa bớt ảnh cũ rồi tải tiếp.'; _plRender(); return; }
  var skipped = Math.max(0, list.length - room); list = list.slice(0, room);
  var ok = 0, fail = '', full = false;
  for (var i = 0; i < list.length; i++){
    _pl.up = '⏳ Đang tải ' + (i + 1) + '/' + list.length + '…'; _plRender();
    try {
      var p = await _plShrink(list[i]); if (!p){ fail = 'Không đọc được ' + list[i].name; continue; }
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body:JSON.stringify({ action:'plibUpload', token:_plTok(), productName:_pl.cur.name, group:_pl.cur.group, mimeType:p.mime, name:p.name, base64:p.b64 }) });
      var d = await r.json();
      if (d && d.ok){ ok++; _pl.n = d.n; _pl.items.unshift(d.item); _pl.counts[_pl.cur.key] = { n:d.n, cover:d.item.fileId, name:_pl.cur.name }; }
      else { fail = (d && d.error) || 'Lỗi tải ảnh'; if (d && d.full){ full = true; break; } }
    } catch(e){ fail = 'Lỗi kết nối: ' + (e && e.message || e); }
  }
  _pl.up = (ok ? '✓ Đã tải ' + ok + ' ảnh. ' : '') + (skipped ? 'Bỏ ' + skipped + ' ảnh vì quá ' + _pl.max + ' ảnh/thư mục. ' : '') + (fail ? '⚠ ' + fail : '') + (full ? '' : '');
  _plRender();
}
async function _plDel(i){
  var it = _pl.items[i]; if (!it || !confirm('Xóa ảnh này khỏi thư mục?')) return;
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body:JSON.stringify({ action:'plibDelete', token:_plTok(), id:it.id }) }), d = await r.json();
    if (d && d.ok){ _pl.items.splice(i, 1); _pl.n = Math.max(0, _pl.n - 1); var c = _pl.counts[_pl.cur.key]; if (c){ c.n = _pl.n; if (!_pl.n) delete _pl.counts[_pl.cur.key]; } _pl.up = ''; }
    else _pl.up = '⚠ ' + ((d && d.error) || 'Không xóa được.');
  } catch(e){ _pl.up = '⚠ Lỗi kết nối.'; }
  _plRender();
}
function _plCopyLink(i){
  var it = _pl.items[i]; if (!it) return;
  var done = function(){ if (typeof toast === 'function') toast('Đã chép link ảnh'); };
  try { navigator.clipboard.writeText(it.url).then(done, done); } catch(e){ done(); }
}
// ── Thông tin sản phẩm (văn bản; chỉ admin sửa, server kiểm) ──
function _plInfoHtml(t){
  return String(t || '').split('\n').map(function(l){
    var e = esc(l); return /^[^:]{2,40}:\s*$/.test(l.trim()) ? '<b style="display:block;margin-top:8px">' + e + '</b>' : e;
  }).join('\n');
}
function _plInfoEdit(){
  _pl.editInfo = true; _pl.infoMsg = '';
  _pl.draft = _pl.info.text || _PL_INFO_SECTIONS.slice(0, 3).map(function(x){ return x + ':\n'; }).join('\n\n');   // chưa có gì → gợi ý sẵn 3 mục đầu
  _plRender();
}
function _plInfoCancel(){ _pl.editInfo = false; _pl.draft = _pl.info.text; _pl.infoMsg = ''; _plRender(); }
function _plInfoInput(v){
  _pl.draft = v; var c = document.getElementById('pl-info-cnt');
  if (c){ c.textContent = v.length + '/' + _PL_INFO_MAX; c.style.color = v.length > _PL_INFO_MAX ? '#b91c1c' : ''; }
}
function _plInfoAdd(i){   // chèn tiêu đề mục (nếu chưa có) ở cuối nội dung đang soạn
  var h = _PL_INFO_SECTIONS[i] + ':'; if (!h) return;
  var ta = document.getElementById('pl-info'); if (ta) _pl.draft = ta.value;
  if (_pl.draft.indexOf(h) < 0) _pl.draft = _pl.draft.replace(/\s+$/, '') + (_pl.draft.trim() ? '\n\n' : '') + h + '\n';
  _plRender(); var t = document.getElementById('pl-info'); if (t){ t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}
async function _plInfoSave(){
  if (_pl.savingInfo || !_pl.cur) return;
  var ta = document.getElementById('pl-info'); if (ta) _pl.draft = ta.value;
  if (_pl.draft.length > _PL_INFO_MAX){ _pl.infoMsg = '⚠ Quá dài (tối đa ' + _PL_INFO_MAX + ' ký tự).'; _plRender(); return; }
  _pl.savingInfo = true; _pl.infoMsg = '⏳ Đang lưu…'; _plRender();
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body:JSON.stringify({ action:'plibInfoSave', token:_plTok(), productName:_pl.cur.name, group:_pl.cur.group, info:_pl.draft }) }), d = await r.json();
    if (d && d.ok){
      _pl.info = d.info; _pl.editInfo = false; _pl.draft = d.info.text; _pl.infoMsg = d.info.text ? '✓ Đã lưu.' : '✓ Đã xóa thông tin.';
      var c = _pl.counts[_pl.cur.key];
      if (c) c.info = d.info.text; else if (d.info.text) _pl.counts[_pl.cur.key] = { n:0, cover:'', name:_pl.cur.name, info:d.info.text };
    } else _pl.infoMsg = '⚠ ' + ((d && d.error) || 'Không lưu được.');
  } catch(e){ _pl.infoMsg = '⚠ Lỗi kết nối.'; }
  _pl.savingInfo = false; _plRender();
}
function _plInfoCopy(){
  var t = (_pl.cur ? _pl.cur.name + '\n' : '') + (_pl.info.text || ''), done = function(){ if (typeof toast === 'function') toast('Đã chép thông tin sản phẩm'); };
  try { navigator.clipboard.writeText(t).then(done, done); } catch(e){ done(); }
}
function _plInfoBox(){
  var h = '<div class="ml-form" style="margin-bottom:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div style="font-weight:700;font-size:14px;flex:1">📝 Thông tin sản phẩm</div>';
  if (!_pl.editInfo){
    if (_pl.info.text) h += '<button class="btn sm" onclick="_plInfoCopy()">📋 Chép</button>';
    if (_pl.admin) h += '<button class="btn sm primary" onclick="_plInfoEdit()">' + (_pl.info.text ? '✏️ Sửa' : '➕ Thêm thông tin') + '</button>';
    h += '</div>';
    h += _pl.info.text ? '<div style="white-space:pre-wrap;font-size:13px;line-height:1.5;max-height:260px;overflow:auto">' + _plInfoHtml(_pl.info.text) + '</div>'
      : '<div class="ml-m">Chưa có thông tin' + (_pl.admin ? ' — bấm “➕ Thêm thông tin” để ghi ý nghĩa, điểm nổi bật, cách tư vấn…' : ' (chỉ admin cập nhật).') + '</div>';
    if (_pl.info.at) h += '<div class="ml-m">Cập nhật ' + esc(_pl.info.by) + ' · ' + esc(String(_pl.info.at).slice(0, 10).split('-').reverse().join('/')) + '</div>';
  } else {
    h += '</div><div class="ml-act">' + _PL_INFO_SECTIONS.map(function(x, i){ return '<button class="btn sm" onclick="_plInfoAdd(' + i + ')">+ ' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<textarea id="pl-info" rows="10" oninput="_plInfoInput(this.value)" placeholder="Viết kiến thức về sản phẩm (ý nghĩa, câu chuyện, điểm bán hàng…). Tiêu đề mục: một dòng kết thúc bằng dấu hai chấm.">' + esc(_pl.draft) + '</textarea>' +
      '<div class="ml-act"><button class="btn primary"' + (_pl.savingInfo ? ' disabled' : '') + ' onclick="_plInfoSave()">Lưu</button><button class="btn" onclick="_plInfoCancel()">Huỷ</button>' +
      '<span id="pl-info-cnt" class="ml-m" style="align-self:center">' + _pl.draft.length + '/' + _PL_INFO_MAX + '</span></div>';
  }
  if (_pl.infoMsg) h += '<div style="font-size:12px;color:' + (/^⚠/.test(_pl.infoMsg) ? '#b91c1c' : '#2b7a4b') + '">' + esc(_pl.infoMsg) + '</div>';
  return h + '</div>';
}
// ── Giao diện ──
function _plFolderCard(f, i){
  var c = _pl.counts[f.key] || {}, n = c.n || 0;
  var th = c.cover ? '<img loading="lazy" src="' + esc(_plThumb(c.cover, 300)) + '" alt="" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;background:#eef6f0">'
    : '<div style="width:100%;aspect-ratio:1/1;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:34px;color:#9ca3af">📁</div>';
  return '<div class="ml-card pick" onclick="_plOpenIdx(' + i + ')" title="Mở thư mục"' + (_pl.q && i === _pl.hi ? ' style="border-color:#2b7a4b;box-shadow:0 0 0 2px #cfe9d8"' : '') + '>' + th +
    '<div class="ml-n">' + (f.combo ? '🎁 ' : '') + esc(f.name) + '</div>' +
    '<div class="ml-m">' + esc(f.group || '') + (f.variants > 1 && !f.combo ? ' · ' + f.variants + ' size/chất liệu' : '') + '</div>' +
    '<div class="ml-m" style="color:' + (n ? '#2b7a4b' : '#9ca3af') + ';font-weight:600">' + n + '/' + _pl.max + ' ảnh' + (f.info ? ' · 📝' : '') + (_pl.q && f._sc === 1 ? ' · khớp trong thông tin' : '') + '</div></div>';
}
function _plRenderFolder(){
  var f = _pl.cur, full = _pl.n >= _pl.max;
  var h = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><button class="btn sm" onclick="_plBack()">← Thư viện sản phẩm</button>' +
    '<div style="font-size:17px;font-weight:700">' + (f.combo ? '🎁 ' : '📁 ') + esc(f.name) + '</div>' +
    '<span class="ml-m" style="font-weight:600">' + _pl.n + '/' + _pl.max + ' ảnh</span></div>';
  h += _plInfoBox();
  h += '<div class="ml-bar"><button class="btn primary"' + (full ? ' disabled title="Đã đủ ' + _pl.max + ' ảnh"' : '') + ' onclick="document.getElementById(\'pl-file\').click()">⬆ Tải ảnh lên</button>' +
    '<input id="pl-file" type="file" multiple accept="image/*" style="display:none" onchange="_plUpload(this.files);this.value=\'\'">' +
    '<button class="btn sm" onclick="_plLoadFolder()">↻</button>' +
    (full ? '<span style="color:#b45309;font-size:12px">Thư mục đã đủ ' + _pl.max + ' ảnh — xóa bớt để tải thêm.</span>' : '') + '</div>';
  if (_pl.up) h += '<div style="font-size:13px;margin-bottom:8px;color:' + (/^⚠/.test(_pl.up) ? '#b91c1c' : '#2b7a4b') + '">' + esc(_pl.up) + '</div>';
  if (_pl.err) h += '<div class="ml-empty" style="color:#b91c1c">' + esc(_pl.err) + '</div>';
  if (_pl.loadingFolder && !_pl.items.length) h += '<div class="ml-empty">Đang tải…</div>';
  else if (!_pl.items.length) h += '<div class="ml-empty">Thư mục trống — bấm “⬆ Tải ảnh lên” (chọn được nhiều ảnh).</div>';
  else h += '<div class="ml-grid">' + _pl.items.map(function(it, i){
    var mine = _pl.admin || it.by === _pl.me;
    return '<div class="ml-card"><a href="' + esc(it.url) + '" target="_blank" rel="noopener"><img class="ml-th" loading="lazy" src="' + esc(_plThumb(it.fileId, 400)) + '" alt=""></a>' +
      '<div class="ml-m">' + esc(it.name) + ' · ' + esc(it.by) + '</div><div class="ml-act"><button class="btn sm" onclick="_plCopyLink(' + i + ')">🔗 Chép link</button>' +
      (mine ? '<button class="btn sm" onclick="_plDel(' + i + ')">🗑</button>' : '') + '</div></div>';
  }).join('') + '</div>';
  return h;
}
function _plRender(){
  var w = document.getElementById('xt-wrap-plib'); if (!w) return;
  if (_pl.cur){ w.innerHTML = '<div style="padding:14px 18px">' + _plRenderFolder() + '</div>'; return; }
  var all = _plBuildList(), list = _plSearch(all, _pl.q), shown = list.slice(0, _PL_SHOW_MAX);
  _pl.shown = shown;
  var focus = document.activeElement && document.activeElement.id === 'pl-q';
  w.innerHTML = '<div style="padding:14px 18px"><div style="font-size:18px;font-weight:700;margin-bottom:4px">🛍️ Thư viện sản phẩm</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Mỗi sản phẩm trong bảng giá và mỗi combo có 1 thư mục ảnh (tối đa ' + _pl.max + ' ảnh). Gõ tên sản phẩm hoặc combo (không cần dấu) rồi bấm để mở thư mục. Trong thư mục có ảnh và phần Thông tin sản phẩm (ý nghĩa, điểm bán hàng…); ô tìm cũng tìm cả trong thông tin.</div>' +
    '<div class="ml-bar"><input id="pl-q" class="ml-q" type="search" style="max-width:420px" placeholder="🔍 Tìm sản phẩm / combo…" value="' + esc(_pl.q) + '" oninput="_plSetQ(this.value)" onkeydown="_plKeydown(event)">' +
    '<button class="btn sm" onclick="_plEnsureData(true)">↻ Làm mới</button></div>' +
    (_pl.loading ? '<div class="ml-empty">Đang tải…</div>' : '') +
    (_pl.err ? '<div class="ml-empty" style="color:#b91c1c">' + esc(_pl.err) + '</div>' : '') +
    (!_pl.loading ? '<div class="ml-m" style="margin-bottom:8px">' + list.length + ' thư mục' + (list.length > shown.length ? ' · hiện ' + shown.length + ' đầu, gõ thêm để lọc' : '') + '</div>' : '') +
    '<div class="ml-grid">' + shown.map(_plFolderCard).join('') + '</div>' +
    (!_pl.loading && !shown.length && !_pl.err ? '<div class="ml-empty">Không có sản phẩm / combo khớp.</div>' : '') + '</div>';
  if (focus || !_pl._focused){ var i = document.getElementById('pl-q'); if (i){ _pl._focused = true; i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
}
registerExtraTab('plib', '🛍️ Thư viện sản phẩm', function(){ _pl._focused = false; if (_pl.cur) _plRender(); else _plEnsureData(); });

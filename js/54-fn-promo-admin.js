// ═══════════════════════════════════════════════════════
//  U3c — MÀN ADMIN CẤU HÌNH KHUYẾN MÃI (engine: js/53-fn-promo-engine.js). Lưu Settings 'promoConfig'.
//  Có ô "Thử tính" (nhập giỏ mẫu + mã voucher → xem CT nào áp, CT nào bị bỏ và lý do) để admin kiểm tra trước khi dùng.
//  Không đụng sheet CTKM cũ (vẫn dùng cho tra cứu/AI trả lời).
// ═══════════════════════════════════════════════════════
window._promoCfgCur = window._promoCfgCur || null;
async function _promoLoad(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return null;
  try {
    var sep = gsUrl.indexOf('?') > -1 ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSettings&keys=promoConfig', { redirect:'follow' });
    var v = (((await r.json()) || {}).values || {}).promoConfig;
    window._promoCfgCur = promoNormalize_(v || '[]');
  } catch(e) { console.warn('_promoLoad', e); }
  return window._promoCfgCur;
}
function _promoTypeLabel(k){ var t = PROMO_TYPES_.filter(function(x){ return x.key === k; })[0]; return t ? t.label : k; }
function _promoSummary(p){
  var s = '';
  if (p.type === 'percent') s = 'giảm ' + p.value + '%';
  else if (p.type === 'amount') s = 'giảm ' + Number(p.value).toLocaleString('vi-VN') + 'đ';
  else if (p.type === 'combo') s = 'mua ' + p.comboQty + ' giá ' + Number(p.comboPrice).toLocaleString('vi-VN') + 'đ';
  else if (p.type === 'gift') s = 'tặng ' + p.giftQty + ' ' + p.gift;
  else if (p.type === 'voucher') s = 'mã ' + p.code + ': ' + (p.vkind === 'percent' ? p.value + '%' : Number(p.value).toLocaleString('vi-VN') + 'đ');
  return s;
}
function openPromoConfig(){
  var old = document.getElementById('promo-cfg-ov'); if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = 'promo-cfg-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:3000;display:flex;align-items:center;justify-content:center';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:12px;padding:16px 18px;width:min(760px,96vw);max-height:90vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
    '<div style="font-weight:600;margin-bottom:4px">🎁 Cấu hình khuyến mãi</div>' +
    '<div class="guide-text" style="font-size:12px;color:var(--muted);margin-bottom:10px">Hệ thống tự tính giá cuối theo các chương trình dưới đây. Mỗi chương trình chọn <b>áp đồng thời được</b> hoặc <b>không áp cùng CT khác</b>; có thể ghi thêm mã CT loại trừ. Khi nhiều CT cùng đủ điều kiện, hệ thống chọn tổ hợp giảm nhiều nhất cho khách.</div>' +
    '<div id="promo-list" style="font-size:12px"></div>' +
    '<div style="margin:8px 0"><button class="btn sm primary" id="promo-add">+ Thêm chương trình</button></div>' +
    '<div id="promo-form"></div>' +
    '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600;font-size:12px">🧪 Thử tính</summary>' +
    '<div style="font-size:11.5px;color:var(--muted);margin:6px 0">Mỗi dòng: <code>Tên sản phẩm | Số lượng | Đơn giá</code></div>' +
    '<textarea id="promo-t-items" rows="4" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:12px">Vòng tay Thạch anh | 2 | 1000000\nDây chuyền Bạc | 1 | 500000</textarea>' +
    '<div style="display:flex;gap:8px;margin:6px 0"><input id="promo-t-code" placeholder="Mã voucher (nếu có, cách nhau dấu phẩy)" style="flex:1;padding:5px;border:1px solid var(--border);border-radius:6px;font-size:12px"><button class="btn sm" id="promo-t-run">Tính</button></div>' +
    '<div id="promo-t-out" style="font-size:12px"></div></details>' +
    '<div id="promo-st" style="font-size:12px;margin-top:8px;color:var(--muted)"></div>' +
    '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button class="btn sm" id="promo-x">Đóng</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if (e.target === ov) ov.remove(); });
  var st = ov.querySelector('#promo-st');
  var list = window._promoCfgCur ? window._promoCfgCur.slice() : [];
  function say(msg, bad){ st.style.color = bad ? 'var(--red)' : 'var(--muted)'; st.textContent = msg; }
  function renderList(){
    var box = ov.querySelector('#promo-list');
    if (!list.length) { box.innerHTML = '<div style="color:var(--muted)">Chưa có chương trình nào.</div>'; return; }
    box.innerHTML = '<table style="width:100%;border-collapse:collapse">' + list.map(function(p, i){
      return '<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 4px"><b>' + esc(p.name) + '</b> <span style="color:var(--muted)">(' + esc(_promoTypeLabel(p.type)) + ': ' + esc(_promoSummary(p)) + ')</span><br>' +
        '<span style="color:var(--muted);font-size:11px">' + (p.active ? '🟢 bật' : '⚪ tắt') + (p.start || p.end ? ' · ' + esc(p.start || '…') + ' → ' + esc(p.end || '…') : '') +
        (p.stackable ? ' · áp đồng thời' : ' · không áp cùng CT khác') + (p.excludes.length ? ' · loại trừ ' + esc(p.excludes.join(',')) : '') + ' · mã ' + esc(p.id) + '</span></td>' +
        '<td style="white-space:nowrap;text-align:right"><button class="btn sm" data-ed="' + i + '">Sửa</button> <button class="btn sm" data-del="' + i + '">Xoá</button></td></tr>';
    }).join('') + '</table>';
    box.querySelectorAll('[data-ed]').forEach(function(b){ b.onclick = function(){ editForm(list[+b.getAttribute('data-ed')]); }; });
    box.querySelectorAll('[data-del]').forEach(function(b){ b.onclick = function(){
      var p = list[+b.getAttribute('data-del')];
      if (!confirm('Xoá chương trình "' + p.name + '"?')) return;
      list = list.filter(function(x){ return x !== p; }); persist('Đã xoá "' + p.name + '"');
    }; });
  }
  async function persist(okMsg){
    say('Đang lưu...');
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key:'promoConfig', value: JSON.stringify({ v:1, promos: list }) }) });
      var j = await r.json(); if (j && j.error) throw new Error(j.error);
      window._promoCfgCur = list.slice(); renderList(); say('✓ ' + okMsg);
      if (typeof toast === 'function') toast('✓ ' + okMsg);
    } catch(e) { say('Lỗi lưu: ' + e.message, true); }
  }
  function fld(label, html){ return '<label style="display:block;font-size:11.5px;color:var(--muted)">' + label + '<div style="color:var(--text)">' + html + '</div></label>'; }
  var IN = 'style="width:100%;padding:5px;border:1px solid var(--border);border-radius:6px;font-size:12px"';
  function editForm(p){
    p = p || { type:'percent', active:true, stackable:false, giftQty:1, vkind:'percent', excludes:[], products:[] };
    var f = ov.querySelector('#promo-form');
    f.innerHTML = '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px">' +
      fld('Tên chương trình', '<input id="pf-name" ' + IN + ' maxlength="80" value="' + esc(p.name || '') + '">') +
      fld('Loại', '<select id="pf-type" ' + IN + '>' + PROMO_TYPES_.map(function(t){ return '<option value="' + t.key + '"' + (p.type === t.key ? ' selected' : '') + '>' + t.label + '</option>'; }).join('') + '</select>') +
      '<div data-for="percent amount voucher">' + fld('Giá trị (% hoặc số tiền đ)', '<input id="pf-value" type="number" min="0" step="any" ' + IN + ' value="' + esc(p.value || '') + '">') + '</div>' +
      '<div data-for="voucher">' + fld('Mã voucher', '<input id="pf-code" ' + IN + ' maxlength="30" value="' + esc(p.code || '') + '">') + '</div>' +
      '<div data-for="voucher">' + fld('Voucher giảm theo', '<select id="pf-vkind" ' + IN + '><option value="percent"' + (p.vkind !== 'amount' ? ' selected' : '') + '>Phần trăm</option><option value="amount"' + (p.vkind === 'amount' ? ' selected' : '') + '>Số tiền (đ)</option></select>') + '</div>' +
      '<div data-for="combo">' + fld('Combo: số món', '<input id="pf-cq" type="number" min="2" ' + IN + ' value="' + esc(p.comboQty || '') + '">') + '</div>' +
      '<div data-for="combo">' + fld('Combo: giá trọn bộ (đ)', '<input id="pf-cp" type="number" min="0" ' + IN + ' value="' + esc(p.comboPrice || '') + '">') + '</div>' +
      '<div data-for="gift">' + fld('Quà tặng', '<input id="pf-gift" ' + IN + ' maxlength="80" value="' + esc(p.gift || '') + '">') + '</div>' +
      '<div data-for="gift">' + fld('Số lượng quà', '<input id="pf-gq" type="number" min="1" ' + IN + ' value="' + esc(p.giftQty || 1) + '">') + '</div>' +
      fld('Sản phẩm áp dụng (tên chứa chữ này, cách nhau dấu phẩy; để trống = mọi SP)', '<input id="pf-prod" ' + IN + ' value="' + esc((p.products || []).join(', ')) + '">') +
      fld('Số lượng tối thiểu / Giá trị tối thiểu (đ)', '<div style="display:flex;gap:6px"><input id="pf-mq" type="number" min="0" ' + IN + ' value="' + esc(p.minQty || '') + '"><input id="pf-ma" type="number" min="0" ' + IN + ' value="' + esc(p.minAmount || '') + '"></div>') +
      fld('Từ ngày / Đến ngày', '<div style="display:flex;gap:6px"><input id="pf-s" type="date" ' + IN + ' value="' + esc(p.start || '') + '"><input id="pf-e" type="date" ' + IN + ' value="' + esc(p.end || '') + '"></div>') +
      fld('Ưu tiên (số lớn xếp trước khi hoà)', '<input id="pf-pr" type="number" ' + IN + ' value="' + esc(p.priority || 0) + '">') +
      fld('Mã CT loại trừ (cách nhau dấu phẩy)', '<input id="pf-ex" ' + IN + ' value="' + esc((p.excludes || []).join(', ')) + '">') +
      '<label style="font-size:12px"><input type="checkbox" id="pf-stack"' + (p.stackable ? ' checked' : '') + '> Áp đồng thời với CT khác được <span style="color:var(--muted)">(bỏ tích = không áp cùng CT khác)</span></label>' +
      '<label style="font-size:12px"><input type="checkbox" id="pf-act"' + (p.active !== false ? ' checked' : '') + '> Đang bật</label>' +
      '<div style="grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end"><button class="btn sm" id="pf-cancel">Huỷ</button><button class="btn sm primary" id="pf-save">💾 Lưu chương trình</button></div></div>';
    var typeSel = f.querySelector('#pf-type');
    function sync(){ f.querySelectorAll('[data-for]').forEach(function(d){ d.style.display = d.getAttribute('data-for').split(' ').indexOf(typeSel.value) > -1 ? '' : 'none'; }); }
    typeSel.onchange = sync; sync();
    f.querySelector('#pf-cancel').onclick = function(){ f.innerHTML = ''; };
    f.querySelector('#pf-save').onclick = function(){
      var g = function(id){ return f.querySelector('#' + id); };
      var raw = { id: p.id, name: g('pf-name').value, type: typeSel.value, active: g('pf-act').checked, stackable: g('pf-stack').checked,
        value: g('pf-value').value, code: g('pf-code').value, vkind: g('pf-vkind').value, comboQty: g('pf-cq').value, comboPrice: g('pf-cp').value,
        gift: g('pf-gift').value, giftQty: g('pf-gq').value, products: g('pf-prod').value, minQty: g('pf-mq').value, minAmount: g('pf-ma').value,
        start: g('pf-s').value, end: g('pf-e').value, priority: g('pf-pr').value, excludes: g('pf-ex').value };
      var n = promoNormalizeOne_(raw);
      if (!n) { say('Chưa hợp lệ: cần tên; % trong (0,100]; combo ≥2 món + giá; quà cần tên; voucher cần mã + giá trị.', true); return; }
      if (list.some(function(x){ return x.id === n.id && x !== p; })) { say('Mã chương trình bị trùng.', true); return; }
      var i = list.indexOf(p);
      if (i > -1) list[i] = n; else list.push(n);
      f.innerHTML = ''; persist('Đã lưu "' + n.name + '"');
    };
  }
  ov.querySelector('#promo-add').onclick = function(){ editForm(null); };
  ov.querySelector('#promo-x').onclick = function(){ ov.remove(); };
  ov.querySelector('#promo-t-run').onclick = function(){
    var items = ov.querySelector('#promo-t-items').value.split('\n').map(function(l){
      var a = l.split('|'); return { name: (a[0] || '').trim(), qty: parseInt(a[1], 10) || 0, price: Number(String(a[2] || '').replace(/[^\d.]/g, '')) || 0 };
    }).filter(function(x){ return x.name; });
    var codes = ov.querySelector('#promo-t-code').value.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    var r = calcPromo_(items, list, { vouchers: codes }), vnd = function(n){ return Number(n).toLocaleString('vi-VN') + 'đ'; };
    ov.querySelector('#promo-t-out').innerHTML =
      '<div>Tạm tính: <b>' + vnd(r.subtotal) + '</b> · Giảm: <b style="color:var(--red)">-' + vnd(r.discount) + '</b> · Giá cuối: <b>' + vnd(r.total) + '</b></div>' +
      (r.applied.length ? '<div style="margin-top:4px">✅ Áp dụng: ' + r.applied.map(function(a){ return esc(a.name) + (a.discount ? ' (-' + vnd(a.discount) + ')' : ''); }).join('; ') + '</div>' : '') +
      (r.gifts.length ? '<div>🎁 Quà: ' + r.gifts.map(function(g){ return esc(g.name) + ' x' + g.qty; }).join('; ') + '</div>' : '') +
      (r.skipped.length ? '<div style="color:var(--muted)">Không áp: ' + r.skipped.map(function(s){ return esc(s.name) + ' — ' + esc(s.why); }).join('; ') + '</div>' : '');
  };
  renderList();
  if (!window._promoCfgCur) { say('Đang tải cấu hình...'); _promoLoad().then(function(c){ list = c ? c.slice() : []; renderList(); say(''); }); }
}
setTimeout(function(){ _promoLoad(); }, 3000);

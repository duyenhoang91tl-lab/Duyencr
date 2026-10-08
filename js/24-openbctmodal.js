
var _bctCodeMap = null;
var _bctLastPhones = [];

async function openBctModal(){
  if (!allCustomers || !allCustomers.length){ toast('Chưa có dữ liệu khách hàng'); return; }
  document.getElementById('bct-modal').classList.add('open');
  document.getElementById('bct-count').style.display = 'none';
  _bctLastPhones = [];
  // Ma san pham tu sheet "Mã Zalo" (qua GAS)
  if (!_bctCodeMap && gsUrl){
    try {
      var sep = gsUrl.includes('?') ? '&' : '?';
      var r = await fetch(gsUrl + sep + 'action=productCodeMap', {redirect:'follow'});
      var d = await r.json();
      if (Array.isArray(d.map) && d.map.length) _bctCodeMap = d.map;
    } catch(e){}
  }
  var codesBox = document.getElementById('bct-codes');
  if (_bctCodeMap){
    codesBox.innerHTML = _bctCodeMap.map(function(m){
      return '<label style="display:inline-flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:3px 10px;cursor:pointer"><input type="checkbox" class="bct-code" value="'+esc(m[0])+'"> '+esc(m[0])+' <span style="color:#9ca3af;font-size:10px">('+esc((m[1]||[]).slice(0,3).join(', '))+')</span></label>';
    }).join('');
  } else {
    codesBox.innerHTML = '<span style="color:#dc2626;font-size:11px">Không tải được bảng mã (kiểm tra kết nối GAS)</span>';
  }
  // Nguon don: liet ke tu du lieu
  var srcSet = {};
  allCustomers.forEach(function(c){ (c.orders||[]).forEach(function(o){ var v=(o.source||'').trim(); if(v) srcSet[v]=1; }); });
  document.getElementById('bct-sources').innerHTML = Object.keys(srcSet).sort().map(function(v){
    return '<label style="display:inline-flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:3px 10px;cursor:pointer"><input type="checkbox" class="bct-src" value="'+esc(v)+'"> '+esc(v)+'</label>';
  }).join('');
  // Phan loai KH
  document.getElementById('bct-tiers').innerHTML = ['VIP','Thân thiết','Tiềm năng','Chưa bán lại được'].map(function(v){
    return '<label style="display:inline-flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:3px 10px;cursor:pointer"><input type="checkbox" class="bct-tier" value="'+esc(v)+'"> '+esc(v)+'</label>';
  }).join('');
  // Nhan tu do (tag) — liet ke cac gia tri dang co trong CareData, khong co san danh sach co dinh
  var tagSet = {};
  allCustomers.forEach(function(c){ var tg = ((careData[c.phone]||{}).tag||'').trim(); if (tg) tagSet[tg] = (tagSet[tg]||0)+1; });
  var tagKeys = Object.keys(tagSet).sort();
  var tagsBox = document.getElementById('bct-tags');
  if (!tagKeys.length) {
    tagsBox.innerHTML = '<span style="color:#9ca3af;font-size:11px">Chưa có khách nào được gắn nhãn.</span>';
  } else {
    tagsBox.innerHTML = tagKeys.map(function(v){
      return '<label style="display:inline-flex;align-items:center;gap:4px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:3px 10px;cursor:pointer"><input type="checkbox" class="bct-tag" value="'+esc(v)+'"> '+esc(v)+' ('+tagSet[v]+')</label>';
    }).join('');
  }
}

function _bctOrderDate(o){
  if (o.date instanceof Date && !isNaN(o.date)) return o.date;
  var y = o.year ? (o.year < 100 ? 2000 + o.year : o.year) : 0;
  if (y && o.month) return new Date(y, o.month - 1, 1);
  return null;
}
function _bctCodeKws(codes){
  var out = [];
  (_bctCodeMap||[]).forEach(function(m){ if (codes.includes(m[0])) out = out.concat(m[1]||[]); });
  return out;
}
function _bctApplyQuickRange(key){
  if (key === 'custom') return;
  var r = (typeof _pkQuickRange === 'function') ? _pkQuickRange(key) : null;
  if (!r) return;
  var f = document.getElementById('bct-date-from'), t = document.getElementById('bct-date-to');
  if (f) f.value = r.from; if (t) t.value = r.to;
}
function _bctCollectPhones(){
  var mode = document.querySelector('input[name=bct-mode]:checked').value;
  var codes = [...document.querySelectorAll('.bct-code:checked')].map(function(x){return x.value;});
  var kws = _bctCodeKws(codes);
  var srcs = [...document.querySelectorAll('.bct-src:checked')].map(function(x){return x.value.toLowerCase();});
  var tiers = [...document.querySelectorAll('.bct-tier:checked')].map(function(x){return x.value;});
  var tags  = [...document.querySelectorAll('.bct-tag:checked')].map(function(x){return x.value;});
  var minO = parseInt(document.getElementById('bct-min-orders').value,10) || 0;
  var maxO = parseInt(document.getElementById('bct-max-orders').value,10) || 0;
  var from = document.getElementById('bct-date-from').value ? new Date(document.getElementById('bct-date-from').value) : null;
  var to   = document.getElementById('bct-date-to').value ? new Date(document.getElementById('bct-date-to').value + 'T23:59:59') : null;

  function orderOk(o){
    if (from || to){
      var od = _bctOrderDate(o);
      if (!od) return false;
      if (from && od < from) return false;
      if (to && od > to) return false;
    }
    if (srcs.length && !srcs.includes((o.source||'').trim().toLowerCase())) return false;
    if (kws.length){
      var txt = ((o.productDetail||'') + ' ' + (o.product||'')).toLowerCase();
      if (!kws.some(function(k){ return txt.indexOf(k) !== -1; })) return false;
    }
    return true;
  }

  return allCustomers.filter(function(c){
    if (tiers.length && !tiers.includes(c.tier)) return false;
    if (tags.length) {
      var cTag = ((careData[c.phone]||{}).tag||'').trim();
      if (!cTag || !tags.includes(cTag)) return false;
    }
    var tot = c.totalOrders || (c.orders||[]).length;
    if (minO && tot < minO) return false;
    if (maxO && tot > maxO) return false;
    var orders = c.orders || [];
    if (!orders.length) return false;
    if (mode === 'latest'){
      var latest = orders.reduce(function(a,b){
        var da=_bctOrderDate(a), db=_bctOrderDate(b);
        return ((db?db.getTime():0) > (da?da.getTime():0)) ? b : a;
      });
      return orderOk(latest);
    }
    return orders.some(orderOk);
  }).map(function(c){ return c.phone; }).filter(Boolean);
}

function bctPreview(){
  _bctLastPhones = [...new Set(_bctCollectPhones())];
  var el = document.getElementById('bct-count');
  el.style.display = 'block';
  el.textContent = '🎯 Khớp điều kiện: ' + _bctLastPhones.length + ' khách';
}
function bctContinue(){
  if (!_bctLastPhones.length) bctPreview();
  if (!_bctLastPhones.length){ toast('Không có khách nào khớp điều kiện — nới bớt bộ lọc'); return; }
  var phones = _bctLastPhones;
  document.getElementById('bct-modal').classList.remove('open');
  _showBroadcastComposeModal({
    id: 'targetbc_' + Date.now(),
    label: 'Chiến dịch điều kiện - ' + new Date().toLocaleDateString('vi-VN'),
    phones: phones,
    csName: ''
  }, 'Theo điều kiện đã chọn — ' + phones.length + ' khách');
}

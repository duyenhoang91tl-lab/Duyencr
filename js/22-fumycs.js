
var _fuTplList = [];
var _fuTplDays = [7,14,30,60];

function _fuMyCS(){
  if (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role !== 'admin' && _authAccount.username)
    return String(_authAccount.username).toLowerCase();
  return '';
}
function _fuIsAdmin(){
  return (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') ||
         (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin);
}

async function runFuScanNow(){
  var btn = document.getElementById('futpl-scan-btn');
  var st  = document.getElementById('futpl-scan-status');
  var old = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ Đang quét...'; st.textContent = '';
  try {
    var r = await fetch(gsUrl, {method:'POST', redirect:'follow', body: JSON.stringify({action:'runFollowUpScan'})});
    var d = await r.json();
    if (!d.ok) { st.innerHTML = '<span style="color:#dc2626">Lỗi: '+esc(d.error||'không rõ')+'</span>'; return; }
    if (!d.count) { st.textContent = d.message || 'Không có khách nào tới mốc hỏi thăm hôm nay.'; return; }
    var lines = (d.campaigns||[]).map(function(c){ return '• '+(c.cs==='(chung)'?'Chưa gán CS':c.cs)+': '+c.count+' khách'; }).join('<br>');
    st.innerHTML = '✓ Đã tạo '+d.count+' tin nhắn hỏi thăm hôm nay:<br>'+lines+'<br><b>Mở extension Zalo → tab Broadcast để xem & bấm gửi.</b>';
    if (typeof toast==='function') toast('✓ Đã quét, tạo '+d.count+' tin hỏi thăm');
  } catch(e) { st.innerHTML = '<span style="color:#dc2626">Lỗi kết nối: '+esc(e.message)+'</span>'; }
  finally { btn.disabled = false; btn.textContent = old; }
}

async function openFuTplModal(){
  var m = document.getElementById('futpl-modal');
  m.classList.add('open');
  document.getElementById('futpl-table').innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:12px">Đang tải mẫu tin...</div>';
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=followUpTemplates', {redirect:'follow'});
    var d = await r.json();
    _fuTplList = (d.list || []).map(function(t){ return {productCode:t.productCode||'*', days:String(t.days), template:t.template||'', cs:(t.cs||'').toLowerCase()}; });
  } catch(e) {
    document.getElementById('futpl-table').innerHTML = '<div style="color:#dc2626;font-size:12px">Lỗi tải: '+esc(e.message)+'</div>';
    return;
  }
  _buildFuCsFilter();
  renderFuTplTable();
}
function closeFuTplModal(){ document.getElementById('futpl-modal').classList.remove('open'); }

// BUG FIX: nut "🎂 Sinh nhật tự động" goi openBdayTplModal() nhung ham nay chua ton tai
// (khac voi openFuTplModal — da lam day du modal + sheet FollowUpTemplates rieng), khien
// bam nut la loi JS "openBdayTplModal is not defined", khong lam gi ca. Chua co du du lieu
// ve cau truc mau tin/mốc nhac sinh nhat mong muon de lam mot modal hoan chinh tuong tu
// Hoi tham tu dong, nen tam thoi bao cho nguoi dung biet tinh nang dang duoc phat trien,
// thay vi doan mo mot tinh nang moi co the sai logic nghiep vu.
function openBdayTplModal(){
  if (typeof toast === 'function') toast('🎂 Tính năng mẫu tin sinh nhật tự động đang được phát triển, chưa khả dụng.');
  else alert('Tính năng mẫu tin sinh nhật tự động đang được phát triển, chưa khả dụng.');
}

function _buildFuCsFilter(){
  var sel = document.getElementById('futpl-cs-filter');
  var csSet = {};
  _fuTplList.forEach(function(t){ if(t.cs) csSet[t.cs]=1; });
  try { (accounts||[]).forEach(function(a){ if(a.role!=='admin'&&a.username) csSet[String(a.username).toLowerCase()]=1; }); } catch(e){}
  var mine = _fuMyCS();
  var html = '<option value="__all">— Tất cả —</option><option value="">Mẫu chung</option>';
  Object.keys(csSet).sort().forEach(function(c){ html += '<option value="'+esc(c)+'">'+esc(c)+'</option>'; });
  sel.innerHTML = html;
  sel.value = mine ? mine : '__all';
}

function renderFuTplTable(){
  var filter = document.getElementById('futpl-cs-filter').value;
  var box = document.getElementById('futpl-table');
  var rows = _fuTplList.map(function(t,i){ return {t:t, i:i}; }).filter(function(x){
    if (filter === '__all') return true;
    return x.t.cs === filter;
  });
  if (!rows.length){ box.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280;font-size:12px">Chưa có mẫu nào'+(filter&&filter!=='__all'?' cho CS này':'')+'. Bấm ＋ Thêm mẫu.</div>'; return; }
  var canEditAll = _fuIsAdmin();
  var mine = _fuMyCS();
  box.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px">'+
    '<tr style="background:#f0fdf4;color:#166534;font-weight:600"><td style="padding:6px;width:80px">Mã SP</td><td style="padding:6px;width:80px">Mốc (ngày)</td><td style="padding:6px;width:90px">CS</td><td style="padding:6px">Nội dung tin</td><td style="width:34px"></td></tr>'+
    rows.map(function(x){
      var t = x.t, i = x.i;
      var locked = !canEditAll && t.cs !== mine && t.cs !== '';
      var dis = locked ? ' disabled style="opacity:.55"' : '';
      return '<tr style="border-bottom:1px solid #f3f4f6;vertical-align:top">'+
        '<td style="padding:4px"><input value="'+esc(t.productCode)+'" placeholder="* / CF,TEA" title="Mã chuẩn hóa; nhiều mã cách nhau dấu phẩy (CF,TEA); * = mọi SP" onchange="_fuTplList['+i+'].productCode=this.value.trim().toUpperCase()||\'*\'"'+dis+' style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:5px;font-size:12px;text-transform:uppercase"></td>'+
        '<td style="padding:4px"><input type="number" min="1" max="365" list="futpl-days-hint" value="'+esc(t.days)+'" onchange="_fuTplList['+i+'].days=String(parseInt(this.value,10)||7)"'+dis+' title="Số ngày sau khi mua (tùy ý: 7, 14, 30, 60, 90...)" style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:5px;font-size:12px"></td>'+
        '<td style="padding:4px"><input value="'+esc(t.cs)+'" placeholder="(chung)" onchange="_fuTplList['+i+'].cs=this.value.trim().toLowerCase()"'+(canEditAll?'':' disabled style="opacity:.55"')+' style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:5px;font-size:12px"></td>'+
        '<td style="padding:4px"><textarea rows="2" onchange="_fuTplList['+i+'].template=this.value"'+dis+' style="width:100%;padding:4px;border:1px solid #d1d5db;border-radius:5px;font-size:12px;resize:vertical;font-family:inherit">'+esc(t.template)+'</textarea></td>'+
        '<td style="padding:4px">'+(locked?'':'<button onclick="_fuTplList.splice('+i+',1);renderFuTplTable()" title="Xóa" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:14px">✕</button>')+'</td>'+
      '</tr>';
    }).join('')+'</table>';
}

function addFuTplRow(){
  var filter = document.getElementById('futpl-cs-filter').value;
  var cs = (filter && filter !== '__all') ? filter : _fuMyCS();
  _fuTplList.push({productCode:'*', days:'7', template:'', cs:cs});
  renderFuTplTable();
  var box = document.getElementById('futpl-table');
  box.scrollTop = box.scrollHeight;
}

async function saveFuTpls(){
  var btn = document.getElementById('futpl-save-btn');
  var st  = document.getElementById('futpl-status');
  var toSave = _fuTplList.filter(function(t){ return (t.template||'').trim(); });
  btn.disabled = true; btn.textContent = 'Đang lưu...';
  try {
    var r = await fetch(gsUrl, {method:'POST', redirect:'follow', body: JSON.stringify({action:'saveFollowUpTemplates', templates: toSave})});
    var d = await r.json();
    if (d.ok) { st.textContent = '✓ Đã lưu ' + d.written + ' mẫu — lần quét sáng mai sẽ dùng bản mới'; if(typeof toast==='function') toast('✓ Đã lưu mẫu tin hỏi thăm'); }
    else st.textContent = 'Lỗi: ' + (d.error||'không rõ');
  } catch(e) { st.textContent = 'Lỗi kết nối: ' + e.message; }
  finally { btn.disabled = false; btn.textContent = '💾 Lưu tất cả'; }
}

// Nút mở modal trên header
setTimeout(function(){
  if (typeof _applyBarCustomization === 'function') _applyBarCustomization();
}, 400);

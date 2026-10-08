
// ═══════════════════════════════════════════════════════════════
//  BROADCAST COMPOSE — soạn + đẩy 1 chiến dịch "gửi hàng loạt" lên GAS,
//  để extension Zalo AI Helper lấy về và tự gửi tuần tự cho từng khách.
// ═══════════════════════════════════════════════════════════════
let _bcComposeTargetBatch = null;
let _bcComposeImages = []; // [{file, dataUrl}]

function openBroadcastCompose(batchId) {
  const h = assignHistory.find(x => x.id === batchId);
  if (!h) { toast('Không tìm thấy chiến dịch chia data này'); return; }
  _showBroadcastComposeModal(h, `Chiến dịch chia data: "${h.label}" — ${h.phones.length} khách — CS: ${h.csName}`);
}

// Điền + mở modal soạn tin hàng loạt dùng chung cho cả 2 nguồn: batch "Chia data" và bộ lọc tự do
var _bcCsSelected = [];
async function _bcLoadNickList() {
  var sel = document.getElementById('bc-compose-nick');
  if (!sel || !gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSetting&key=nickZaloList', {redirect:'follow'});
    var d = await r.json();
    var list = [];
    if (d.value) { try { list = JSON.parse(d.value); } catch(e) {} }
    var cur = sel.value;
    sel.innerHTML = '<option value="">— Không chỉ định nick —</option>' +
      (Array.isArray(list) ? list : []).map(function(n){ return '<option value="'+esc(n)+'">'+esc(n)+'</option>'; }).join('');
    sel.value = cur;
  } catch(e) {}
}
function _bcCsNames() {
  var names = [];
  try { (accounts||[]).forEach(function(a){ if (a.role !== 'admin' && a.username && a.active !== false) names.push(String(a.username).toLowerCase()); }); } catch(e) {}
  return [...new Set(names)].sort();
}
function _bcRenderCsList(filter) {
  var box = document.getElementById('bc-compose-cs-list');
  if (!box) return;
  var f = (filter||'').toLowerCase();
  var names = _bcCsNames().filter(function(n){ return !f || n.includes(f); });
  box.innerHTML = names.length ? names.map(function(n){
    var on = _bcCsSelected.includes(n);
    return '<label style="display:flex;align-items:center;gap:6px;padding:4px 9px;font-size:12px;cursor:pointer;border-bottom:1px solid #f3f4f6" data-name="'+esc(n)+'">'+
      '<input type="checkbox" '+(on?'checked':'')+' onchange="_bcToggleCs(this.closest(\'label\').dataset.name, this.checked)"> '+esc(n)+'</label>';
  }).join('') : '<div style="padding:6px 9px;font-size:11px;color:#9ca3af">Không có CS khớp</div>';
}
function _bcFilterCsList(v){ _bcRenderCsList(v); }
function _bcToggleCs(name, on) {
  if (on) { if (!_bcCsSelected.includes(name)) _bcCsSelected.push(name); }
  else _bcCsSelected = _bcCsSelected.filter(function(x){ return x !== name; });
  _bcRenderCsChips();
  document.getElementById('bc-compose-cs').value = _bcCsSelected.join(',');
}
function _bcRenderCsChips() {
  var box = document.getElementById('bc-compose-cs-chips');
  if (!box) return;
  box.innerHTML = _bcCsSelected.map(function(n){
    return '<span style="background:#dcfce7;color:#166534;border-radius:12px;padding:2px 9px;font-size:11px;font-weight:600" data-name="'+esc(n)+'">'+esc(n)+
      ' <a href="#" onclick="_bcToggleCs(this.parentNode.dataset.name,false);_bcRenderCsList(document.getElementById(\'bc-compose-cs-search\').value);return false" style="color:#166534;text-decoration:none">✕</a></span>';
  }).join('') || '<span style="font-size:11px;color:#9ca3af">Chưa chọn CS nào — mọi CS đều thấy chiến dịch</span>';
}

function _showBroadcastComposeModal(h, infoText) {
  _bcComposeTargetBatch = h;
  _bcComposeImages = [];
  document.getElementById('bc-compose-label').value = h.label || '';
  document.getElementById('bc-compose-msg').value = '';
  document.getElementById('bc-compose-nick').value = '';
  _bcCsSelected = (h.csName && !h.csName.startsWith('(')) ? h.csName.split(',').map(function(x){return x.trim().toLowerCase();}).filter(Boolean) : [];
  document.getElementById('bc-compose-cs').value = _bcCsSelected.join(',');
  document.getElementById('bc-compose-cs-search').value = '';
  _bcRenderCsList('');
  _bcRenderCsChips();
  _bcLoadNickList();
  document.getElementById('bc-compose-imgs').value = '';
  document.getElementById('bc-compose-preview').innerHTML = '';
  document.getElementById('bc-compose-progress').style.display = 'none';
  document.getElementById('bc-compose-error').style.display = 'none';
  document.getElementById('bc-compose-target-info').textContent = infoText;
  document.getElementById('bc-compose-overlay').style.display = 'flex';
}

// ── Tạo chiến dịch bắn TRỰC TIẾP từ danh sách KH đang lọc ở tab "Danh sách KH"
// (CS phụ trách, sản phẩm, nguồn đơn, ngày mua, tình trạng CS/Zalo, tier...)
// KHÔNG cần đi qua bước "Chia data" cho CS.
function openBroadcastFromCurrentFilter() {
  const list = (typeof window.__omeFiltered !== 'undefined' && Array.isArray(window.__omeFiltered)) ? window.__omeFiltered : null;
  if (!list || !list.length) {
    toast('⚠ Danh sách đang lọc ra 0 KH. Hãy chỉnh bộ lọc (CS / Sản phẩm / Nguồn / Trạng thái / Ngày mua...) ở tab Danh sách KH hoặc mục "⚙ Lọc nâng cao" rồi thử lại.');
    return;
  }
  const phones = [...new Set(list.map(c => c.phone).filter(Boolean))];
  const n = countAdvFilters();
  const filterNote = n > 0 ? `${n} bộ lọc nâng cao đang bật + bộ lọc bảng` : 'bộ lọc bảng hiện tại';
  const h = {
    id: 'filterbc_' + Date.now(),
    label: `Tự chọn lọc - ${new Date().toLocaleDateString('vi-VN')}`,
    phones,
    csName: '' // để trống → mọi CS dùng extension đều thấy chiến dịch này trong hàng đợi gửi
  };
  _showBroadcastComposeModal(h, `Từ bộ lọc hiện tại (${filterNote}) — ${phones.length} khách`);
}

function closeBroadcastCompose() {
  document.getElementById('bc-compose-overlay').style.display = 'none';
  _bcComposeTargetBatch = null;
  _bcComposeImages = [];
}

document.addEventListener('change', function(e) {
  if (e.target && e.target.id === 'bc-compose-imgs') {
    const files = [...e.target.files].slice(0, 15);
    if (e.target.files.length > 15) toast('Chỉ lấy 15 ảnh đầu tiên (giới hạn tối đa)');
    _bcComposeImages = [];
    const preview = document.getElementById('bc-compose-preview');
    preview.innerHTML = '';
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(ev) {
        _bcComposeImages.push({ file, dataUrl: ev.target.result });
        const img = document.createElement('img');
        img.src = ev.target.result;
        img.style.cssText = 'width:52px;height:52px;object-fit:cover;border-radius:5px;border:1px solid #d1d5db;';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
});

async function submitBroadcastCompose() {
  const label = (document.getElementById('bc-compose-label').value || '').trim();
  const message = (document.getElementById('bc-compose-msg').value || '').trim();
  const errEl = document.getElementById('bc-compose-progress');
  const errBox = document.getElementById('bc-compose-error');
  errBox.style.display = 'none';

  if (!_bcComposeTargetBatch) { errBox.textContent = 'Thiếu danh sách khách.'; errBox.style.display = 'block'; return; }
  if (!message) { errBox.textContent = 'Vui lòng nhập nội dung tin nhắn.'; errBox.style.display = 'block'; return; }
  if (!gsUrl) { errBox.textContent = 'Chưa kết nối Google Sheets (gsUrl trống).'; errBox.style.display = 'block'; return; }

  const submitBtn = document.getElementById('bc-compose-submit');
  submitBtn.disabled = true;
  errEl.style.display = 'block';

  try {
    // 1) Upload tung anh len Drive qua GAS, lay ve URL xem truc tiep
    const imageUrls = [];
    for (let i = 0; i < _bcComposeImages.length; i++) {
      errEl.textContent = `Đang tải ảnh ${i+1}/${_bcComposeImages.length}...`;
      const base64 = _bcComposeImages[i].dataUrl.split(',')[1];
      const mimeType = _bcComposeImages[i].file.type || 'image/jpeg';
      const r = await fetch(gsUrl, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ action: 'uploadBroadcastImg', base64, filename: _bcComposeImages[i].file.name, mimeType })
      });
      const d = await r.json();
      if (d.ok && d.url) imageUrls.push(d.url);
      else console.warn('Upload ảnh lỗi:', d.error);
    }

    // 2) Luu chien dich broadcast
    errEl.textContent = 'Đang lưu chiến dịch...';
    const bcId = 'bc_' + Date.now();
    const expectedNick = (document.getElementById('bc-compose-nick').value || '').trim();
    const r2 = await fetch(gsUrl, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({
        action: 'saveBroadcast',
        broadcast: {
          id: bcId,
          label: label || _bcComposeTargetBatch.label,
          message,
          images: imageUrls,
          phones: _bcComposeTargetBatch.phones,
          csName: (document.getElementById('bc-compose-cs').value || '').trim(),
          expectedNick,
          createdAt: new Date().toISOString(),
          status: 'active'
        }
      })
    });
    const d2 = await r2.json();
    if (!d2.ok) throw new Error(d2.error || 'Lưu thất bại');

    errEl.style.display = 'none';
    toast('✅ Đã tạo chiến dịch gửi hàng loạt — mở extension Zalo AI để bắt đầu gửi');
    closeBroadcastCompose();
  } catch (e) {
    errBox.textContent = 'Lỗi: ' + e.message;
    errBox.style.display = 'block';
    errEl.style.display = 'none';
  } finally {
    submitBtn.disabled = false;
  }
}

async function _syncZaloPhoneSettingsFromGAS() {
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=zaloPhoneFieldLocked', {redirect:'follow'});
    var d = await r.json();
    _zaloPhoneFieldLocked = d && d.value === 'true';
    var r2 = await fetch(gsUrl + '?action=getSetting&key=zaloPhoneSaleCanAdd', {redirect:'follow'});
    var d2 = await r2.json();
    _zaloPhoneSaleCanAdd = !(d2 && d2.value === 'false'); // chi tat khi luu ro rang la 'false'
  } catch(e) { /* giu mac dinh neu loi mang */ }
}
// Co Sale nay duoc them SDT Zalo khong: Admin luon duoc (khong bi khoa boi 2 setting tren)
function _zaloPhoneCanAdd() {
  if (typeof _srIsAdmin === 'function' && _srIsAdmin()) return true;
  return _zaloPhoneSaleCanAdd;
}
// Truong co dang bi khoa hoan toan khong (an voi ca Sale lan Admin xem tren form khach —
// Admin van bat/tat duoc o modal Cai dat): Admin xem duoc khi ho tu mo modal quan ly, nhung
// tren FORM KHACH thi khoa la an voi tat ca de dung 1 quy tac de hieu.
function _zaloPhoneFieldVisible() { return !_zaloPhoneFieldLocked; }

function _buildZaloPhoneOptions(mainPhone, existing) {
  var opts = '<option value="">— SĐT có sẵn —</option>';
  if (mainPhone && (existing||[]).indexOf(mainPhone) === -1) {
    opts += '<option value="' + esc(mainPhone) + '">SĐT chính: ' + esc(mainPhone) + '</option>';
  }
  return opts;
}
function _renderZaloPhoneChips(arr, phone) {
  var canEdit = _zaloPhoneCanAdd();
  if (!arr || !arr.length) return '<span style="font-size:11px;color:var(--muted)">Chưa có SĐT nào</span>';
  return arr.map(function(sdt, idx) {
    return '<span class="zalophone-chip">📱 ' + esc(sdt) +
      (canEdit ? '<button class="zp-x" data-phone="' + esc(phone) + '" title="Bỏ SĐT này" onclick="removeZaloPhoneChip(this.dataset.phone,' + idx + ')">✕</button>' : '') +
      '</span>';
  }).join('');
}
// Khoi HTML day du cho 1 khach (goi tu form cham soc) — tu quyet dinh an/hien theo 2 setting
function _renderZaloPhoneField(care, c) {
  var isAdm = (typeof _srIsAdmin === 'function' && _srIsAdmin());
  if (!_zaloPhoneFieldVisible()) {
    // Khoa: an het voi Sale; Admin van thay 1 dong gon kem nut Cai dat de tu mo khoa lai duoc
    if (!isAdm) return '';
    return '<div class="zalophone-field" style="opacity:.7">' +
        '<div class="zalophone-label"><span class="zalophone-label-text">📱 SĐT Zalo (đang khoá)</span>' +
        '<button class="nickzalo-manage-btn" onclick="openZaloPhoneSettingsModal()">⚙ Cài đặt</button></div>' +
      '</div>';
  }
  var arr = care.zaloPhones || [];
  var canAdd = _zaloPhoneCanAdd();
  var addRow = canAdd
    ? ('<div class="zalophone-select-row">' +
        '<select class="zalophone-select" id="cs-zalophone-sel" data-phone="' + esc(c.phone) + '">' +
          _buildZaloPhoneOptions(c.phone, arr) +
        '</select>' +
        '<input type="text" class="zalophone-input" id="cs-zalophone-input" placeholder="...hoặc gõ SĐT khác" inputmode="tel">' +
        '<button class="zalophone-add-btn" data-phone="' + esc(c.phone) + '" onclick="addZaloPhoneChip(this.dataset.phone)">+ Thêm</button>' +
      '</div>')
    : '<div class="zalophone-locked-note">Chỉ Admin được thêm SĐT ở trường này.</div>';
  return '<div class="zalophone-field">' +
      '<div class="zalophone-label"><span class="zalophone-label-text">📱 SĐT Zalo</span>' +
      (isAdm ? '<button class="nickzalo-manage-btn" onclick="openZaloPhoneSettingsModal()">⚙ Cài đặt</button>' : '') +
      '</div>' +
      addRow +
      '<div class="zalophone-chip-row" id="cs-zalophone-chips">' + _renderZaloPhoneChips(arr, c.phone) + '</div>' +
      '<input type="hidden" id="cs-zalophone-val" value="' + esc(JSON.stringify(arr)) + '">' +
    '</div>';
}
function addZaloPhoneChip(phone) {
  if (!_zaloPhoneCanAdd()) { toast('Bạn không có quyền thêm SĐT Zalo.'); return; }
  var selEl = document.getElementById('cs-zalophone-sel');
  var inpEl = document.getElementById('cs-zalophone-input');
  var raw = (inpEl && inpEl.value.trim()) ? inpEl.value.trim() : (selEl ? selEl.value : '');
  if (!raw) { toast('Chọn hoặc gõ 1 SĐT trước đã.'); return; }
  var np = normPhone(raw);
  if (!np) { toast('SĐT "' + raw + '" không hợp lệ.'); return; }
  var hidEl = document.getElementById('cs-zalophone-val');
  var arr = []; try { arr = JSON.parse((hidEl && hidEl.value) || '[]'); } catch(e){ arr = []; }
  if (arr.indexOf(np) >= 0) { toast('SĐT này đã có trong danh sách.'); return; }
  arr.push(np);
  if (hidEl) hidEl.value = JSON.stringify(arr);
  if (inpEl) inpEl.value = '';
  if (selEl) selEl.innerHTML = _buildZaloPhoneOptions(phone, arr);
  var chipsEl = document.getElementById('cs-zalophone-chips');
  if (chipsEl) chipsEl.innerHTML = _renderZaloPhoneChips(arr, phone);
}
function removeZaloPhoneChip(phone, idx) {
  if (!_zaloPhoneCanAdd()) { toast('Bạn không có quyền sửa SĐT Zalo.'); return; }
  var hidEl = document.getElementById('cs-zalophone-val');
  var arr = []; try { arr = JSON.parse((hidEl && hidEl.value) || '[]'); } catch(e){ arr = []; }
  arr.splice(idx, 1);
  if (hidEl) hidEl.value = JSON.stringify(arr);
  var selEl = document.getElementById('cs-zalophone-sel');
  if (selEl) selEl.innerHTML = _buildZaloPhoneOptions(phone, arr);
  var chipsEl = document.getElementById('cs-zalophone-chips');
  if (chipsEl) chipsEl.innerHTML = _renderZaloPhoneChips(arr, phone);
}

// ── Modal Admin: khoa/mo truong SDT Zalo + cho phep Sale them hay khong ──
function openZaloPhoneSettingsModal() {
  if (typeof _srIsAdmin === 'function' && !_srIsAdmin()) { toast('Chỉ admin mới cấu hình được mục này.'); return; }
  var div = document.createElement('div');
  div.className = 'nz-modal-overlay open';
  div.innerHTML =
    '<div class="nz-modal" style="width:380px">' +
      '<div class="nz-modal-header"><div class="nz-modal-title">📱 Cài đặt SĐT Zalo</div>' +
      '<button class="close-btn" onclick="this.closest(\'.nz-modal-overlay\').remove()">✕</button></div>' +
      '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">' +
          '<input type="checkbox" id="zp-set-locked" ' + (_zaloPhoneFieldLocked?'checked':'') + '> Khoá hẳn trường SĐT Zalo (ẩn với mọi người trên form khách)</label>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">' +
          '<input type="checkbox" id="zp-set-saleadd" ' + (_zaloPhoneSaleCanAdd?'checked':'') + '> Cho phép Sale tự thêm SĐT mới (tắt = chỉ Admin thêm được)</label>' +
        '<button class="btn primary" style="width:100%;justify-content:center" onclick="_saveZaloPhoneSettings(this)">Lưu</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(div);
  div.addEventListener('click', function(e){ if (e.target === div) div.remove(); });
}
async function _saveZaloPhoneSettings(btn) {
  var locked = document.getElementById('zp-set-locked').checked;
  var saleAdd = document.getElementById('zp-set-saleadd').checked;
  try {
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({action:'setSetting', key:'zaloPhoneFieldLocked', value: locked?'true':'false'}) });
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({action:'setSetting', key:'zaloPhoneSaleCanAdd', value: saleAdd?'true':'false'}) });
    _zaloPhoneFieldLocked = locked; _zaloPhoneSaleCanAdd = saleAdd;
    toast('✓ Đã lưu cài đặt SĐT Zalo');
    btn.closest('.nz-modal-overlay').remove();
    if (typeof currentPhone !== 'undefined' && currentPhone && typeof renderDpTab === 'function'
        && typeof currentDpTab !== 'undefined' && currentDpTab === 'care') { try { renderDpTab('care'); } catch(e){} }
  } catch(e) { toast('❌ Lưu lỗi: ' + e.message); }
}

// ═══════════════════════════════════════════════════════
//  BIRTHDAY + CUSTOM REMINDER HELPERS
// ═══════════════════════════════════════════════════════

// ── Mệnh theo năm sinh (Ngũ hành nạp âm) + màu tương sinh / tương hợp ──
// Công thức: Can (Giáp,Ất=1; Bính,Đinh=2; Mậu,Kỷ=3; Canh,Tân=4; Nhâm,Quý=5) + Chi (Tý,Sửu,Ngọ,Mùi=0;
// Dần,Mão,Thân,Dậu=1; Thìn,Tỵ,Tuất,Hợi=2); tổng >5 thì trừ 5 → 1 Kim, 2 Thủy, 3 Hỏa, 4 Thổ, 5 Mộc.
// Đã đối chiếu đủ 1900–2100 với chuỗi nạp âm 60 năm. Tính theo năm dương lịch (sinh trước Tết thì lấy năm trước).
function menhMau_() { return {
  'Kim':  { sinh: ['Vàng','Nâu'],              hop: ['Trắng'] },
  'Mộc':  { sinh: ['Đen','Xanh dương'],        hop: ['Xanh lá cây'] },
  'Thủy': { sinh: ['Trắng'],                   hop: ['Đen','Xanh dương'] },
  'Hỏa':  { sinh: ['Xanh lá cây'],             hop: ['Đỏ','Hồng','Tím'] },
  'Thổ':  { sinh: ['Đỏ','Hồng','Tím'],         hop: ['Vàng','Nâu'] }
}; }
function menhSwatch_() { return { 'Vàng':'#f2c200','Nâu':'#8b5a2b','Trắng':'#ffffff','Đen':'#222222','Xanh dương':'#2563eb','Xanh lá cây':'#16a34a','Đỏ':'#dc2626','Hồng':'#ec4899','Tím':'#7c3aed' }; }
function menhFromYear(y) {
  y = parseInt(y, 10);
  if (!y || y < 1900 || y > 2100) return null;
  const can = Math.floor(((y - 4) % 10) / 2) + 1;
  const chi = [0,0,1,1,2,2,0,0,1,1,2,2][(y - 4) % 12];
  let s = can + chi; if (s > 5) s -= 5;
  return ['', 'Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'][s];
}
function menhYearValid(y) { y = String(y == null ? '' : y).trim(); return /^\d{4}$/.test(y) && +y >= 1900 && +y <= new Date().getFullYear(); }
function menhBoxHtml(y) {
  y = String(y == null ? '' : y).trim();
  if (!y) return '';
  if (!menhYearValid(y)) return y.length === 4 ? '<span style="color:#dc2626">Năm sinh không hợp lệ</span>' : '';
  const m = menhFromYear(y), t = menhMau_()[m], sw = menhSwatch_();
  const chips = (arr) => arr.map((c) => '<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;white-space:nowrap"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + sw[c] + ';border:1px solid rgba(0,0,0,.3)"></i>' + c + '</span>').join('');
  return '<div style="font-weight:700;color:#2563eb">Mệnh ' + m + ' <span style="font-weight:400;color:#6b7280">(sinh năm ' + y + ')</span></div>'
    + '<div><b>Tương sinh:</b> ' + chips(t.sinh) + '</div>'
    + '<div><b>Tương hợp:</b> ' + chips(t.hop) + '</div>'
    + '<div style="color:#9ca3af;font-size:10px">Ưu tiên tương sinh trước, sau đó tương hợp; tránh màu tương khắc. Ngọc &amp; Trầm hương không kén mệnh. Tính theo năm dương lịch (sinh trước Tết → lấy năm trước).</div>';
}
// Giá trị sinh nhật lưu trong cột birthday: "YYYY-MM-DD" (đủ ngày) HOẶC "YYYY" (chỉ năm sinh).
function bdayYearOnly_(v) { const s = String(v == null ? '' : v).trim(); return /^\d{4}$/.test(s) ? s : ''; }

function _bdayDaysLeft(bdayStr) {
  if (!bdayStr) return null;
  bdayStr = String(bdayStr);   // Sheets có thể trả chỉ-năm dạng SỐ (1995) — không có .split
  const today = new Date(); today.setHours(0,0,0,0);
  const parts = bdayStr.split('-');
  if (parts.length < 3) return null;
  const m = parseInt(parts[1],10)-1, d = parseInt(parts[2],10);
  let next = new Date(today.getFullYear(), m, d);
  if (next < today) next = new Date(today.getFullYear()+1, m, d);
  return Math.round((next - today)/86400000);
}

function _bdayUpcomingBadge(bdayStr) {
  const days = _bdayDaysLeft(bdayStr);
  if (days === null) return '';
  if (days === 0) return '<span class="bday-upcoming">🎂 Hôm nay!</span>';
  if (days <= 30) return '<span class="bday-upcoming">🎂 ' + days + ' ngày nữa</span>';
  return '';
}

function onTagChange(val, phone) {
  if (!phone) return;
  if (!careData[phone]) careData[phone] = {};
  careData[phone].tag = (val||'').trim();
  saveLS('ome_care', careData);
  if (typeof saveCare === 'function') saveCare(phone);
}

function onBdayChange(val, phone) {
  if (!val || !phone) return;
  if (!careData[phone]) careData[phone] = {};
  careData[phone].birthday = val;
  saveLS('ome_care', careData);
  _upsertBirthdaySchedule(phone, val);
  const hint = document.querySelector('#cs-birthday + div');
  if (!hint) {
    const bdayInput = document.getElementById('cs-birthday');
    if (bdayInput) {
      const h = document.createElement('div');
      h.style.cssText = 'font-size:10px;color:#be185d;margin-top:2px';
      h.textContent = '🔔 Sẽ nhắc mỗi năm vào ngày này';
      bdayInput.parentNode.insertBefore(h, bdayInput.nextSibling);
    }
  }
  toast('🎂 Đã lưu sinh nhật · nhắc hẹn hàng năm đã tạo');
}

// Ô năm sinh (chỉ năm, khi chưa có ngày tháng năm sinh đầy đủ): tự hiện mệnh + màu tương sinh/tương hợp.
// Chỉ lưu năm khi ô ngày sinh đang trống (có ngày đầy đủ thì ưu tiên ngày). Không tạo lịch nhắc sinh nhật (thiếu ngày/tháng).
function onBirthYearInput(val, phone) {
  const y = String(val || '').replace(/\D/g, '').slice(0, 4);
  const inp = document.getElementById('cs-birthyear'); if (inp && inp.value !== y) inp.value = y;
  const box = document.getElementById('cs-menh-box'); if (box) box.innerHTML = menhBoxHtml(y);
  const dateEl = document.getElementById('cs-birthday');
  if (!phone || !menhYearValid(y) || (dateEl && dateEl.value)) return;
  if (!careData[phone]) careData[phone] = {};
  careData[phone].birthday = y;
  saveLS('ome_care', careData);
}
// Đồng bộ ô năm theo ô ngày: có ngày đầy đủ → năm lấy từ ngày (khoá); xoá ngày → mở lại để nhập chỉ năm.
function _bdayUiSync_() {
  const d = document.getElementById('cs-birthday'), yEl = document.getElementById('cs-birthyear');
  if (!yEl) return;
  if (d && d.value) { yEl.value = d.value.slice(0, 4); yEl.readOnly = true; }
  else yEl.readOnly = false;
  const box = document.getElementById('cs-menh-box'); if (box) box.innerHTML = menhBoxHtml(yEl.value);
}

function _upsertBirthdaySchedule(phone, bdayStr) {
  if (!bdayStr || !phone) return;
  bdayStr = String(bdayStr);   // chỉ-năm (VD 1995, có thể là số) → không đủ ngày/tháng, bỏ qua dưới
  const parts = bdayStr.split('-');
  if (parts.length < 3) return;
  const m = parseInt(parts[1],10)-1, d = parseInt(parts[2],10);
  const today = new Date(); today.setHours(0,0,0,0);
  let next = new Date(today.getFullYear(), m, d);
  if (next < today) next = new Date(today.getFullYear()+1, m, d);
  const nextStr = _ymd(next);
  schedules = schedules.filter(function(x){ return !(x.phone===phone && x.type==='birthday' && !x.done); });
  schedules.push(Object.assign({
    id: Date.now()+'_bday_'+phone,
    phone: phone, type: 'birthday',
    date: nextStr, note: '🎂 Sinh nhật KH',
    done: false, recurring: true
  }, _remOwnerStamp()));
  saveLS('ome_sched', schedules);
  saveLS('ome_schedules', schedules);
  updateSchedBadges();
}

function _checkAndRenewBdaySchedules() {
  const today = _ymd(new Date());
  Object.keys(careData).forEach(function(phone) {
    const care = careData[phone] || {};
    if (!care.birthday) return;
    const existing = schedules.find(function(x){ return x.phone===phone && x.type==='birthday' && !x.done && x.date>=today; });
    if (!existing) _upsertBirthdaySchedule(phone, care.birthday);
  });
  saveLS('ome_sched', schedules);
}

function _daoSchedExcluded(phone) {
  var ex = loadLS('ome_dao_exclude') || {};
  return !!ex[phone];
}
function _toggleDaoSchedExclude(phone, exclude) {
  var ex = loadLS('ome_dao_exclude') || {};
  if (exclude) {
    ex[phone] = true;
    // Xóa lịch auto đã tạo cho khách này
    schedules = schedules.filter(function(x){ return !(x.phone===phone && x.autoDao); });
    saveLS('ome_sched', schedules);
    if (typeof updateSchedBadges==='function') updateSchedBadges();
    if (typeof renderScheduleTab==='function') renderScheduleTab();
    if (typeof renderOverdueTab==='function') renderOverdueTab();
    if (typeof renderReminderPanel==='function') renderReminderPanel();
  } else {
    delete ex[phone];
    // Tạo lại lịch auto
    if (typeof checkDataDaoRenewSchedules==='function') checkDataDaoRenewSchedules();
  }
  saveLS('ome_dao_exclude', ex);
}

function _isDataDaoRenew(src) {
  return DATA_DAO_SOURCES.some(function(k){ return (src||'').toLowerCase().includes(k); });
}

function _isNewLeadSource(src) {
  var t = (src||'').toLowerCase();
  return NEW_LEAD_SOURCES.some(function(k){ return t.indexOf(k) !== -1; });
}

// Ngày YYYY-MM-DD theo GIỜ ĐỊA PHƯƠNG (tránh lệch ngày do toISOString trả UTC)
function _ymd(d){
  if (!(d instanceof Date) || isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
// Parse ngay tu backend GAS: co the la chuoi ISO (khi o goc la kieu Date that trong Sheet,
// bi JSON.stringify tu dong chuyen thanh chuoi UTC) HOAC chuoi DD/MM/YYYY (khi o goc la text).
// KHONG dung thang new Date(chuoi) cho truong hop DD/MM/YYYY: JS hieu nham thanh MM/DD/YYYY,
// sai am tham voi cac ngay <=12 (vd '05/08/2026' bi doc thanh 8 thang 5 thay vi 5 thang 8).
function _parseFlexDate(val){
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  var s = String(val).trim();
  if (!s) return null;
  var datePart = s.split(/[T ]/)[0];
  var m = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m){
    var dd = Number(m[1]), mo = Number(m[2]), yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    var dt1 = new Date(yy, mo-1, dd);
    return isNaN(dt1) ? null : dt1;
  }
  // Khong khop DD/MM/YYYY → thu parse nhu ISO/chuan JS (cho chuoi tu Date that, vd '2026-08-20T17:00:00.000Z')
  var dt2 = new Date(s);
  return isNaN(dt2) ? null : dt2;
}
function _addDateMonths(dateStr, months) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return _ymd(d);
}
function _addDateDays(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return _ymd(d);
}

// Gọi sau khi data load xong; tạo lịch CS theo nguồn (xem chú thích quy tắc ở trên)
//
// FIX (dọn lịch hẹn/nhắc hẹn auto dùng data cũ): trước đây hàm này CHỈ THÊM mốc auto mới,
// không bao giờ xóa mốc auto cũ đã tạo từ trước — nên khi quy tắc ngày bị siết lại (vd Data Đảo
// chỉ còn áp dụng cho đơn tháng 6/2026, thay vì "tháng hiện tại" như bản cũ), các mốc auto sinh
// ra dưới quy tắc CŨ (đơn của các tháng khác/nguồn dữ liệu cũ) vẫn tồn tại mãi trong localStorage
// (khóa 'ome_sched') rồi được syncAutoHenToCareData() đẩy lên CareData dùng chung — hiển thị như
// lịch hẹn/nhắc hẹn "ma" không liên quan gì tới dữ liệu CRM mới. Giờ mỗi lần chạy, hàm sẽ tính
// lại tập ID hợp lệ THEO QUY TẮC HIỆN TẠI rồi dọn sạch mọi mốc auto (autoDao=true, chưa done)
// không còn nằm trong tập đó — không đụng tới lịch CS tự đặt tay hay các mốc đã done.
function checkDataDaoRenewSchedules() {
  var now = new Date();
  var curYear = now.getFullYear();
  var curMonth = now.getMonth() + 1;

  // Các mốc nhắc: [{offset_days, offset_months, label}]
  var MILESTONES = [
    { days: 7,  label: 'CS +7 ngày' },
    { days: 14, label: 'CS +14 ngày' },
    { months: 1, label: 'CS +1 tháng' },
    { months: 2, label: 'CS +2 tháng' },
  ];

  if (typeof allCustomers === 'undefined') return;

  var _daoDeleted = loadLS('ome_dao_deleted') || {};
  var daoExclude = loadLS('ome_dao_exclude') || {};
  var validAutoIds = {}; // tập ID hợp lệ theo quy tắc HIỆN TẠI — dùng để dọn rác bên dưới

  allCustomers.forEach(function(c) {
    if (daoExclude[c.phone]) return; // Khách đã bị bỏ lịch auto
    c.orders.forEach(function(o) {
      var isDao  = _isDataDaoRenew(o.source);
      var isLead = _isNewLeadSource(o.source);
      if (!isDao && !isLead) return;

      // Chuẩn hoá năm/tháng của đơn
      var oYear  = o.year  || (o.date instanceof Date ? o.date.getFullYear()  : 0);
      var oMonth = o.month || (o.date instanceof Date ? o.date.getMonth() + 1 : 0);
      // Normalize năm 2 chữ số (26 → 2026)
      if (oYear > 0 && oYear < 100) oYear = 2000 + +oYear;
      oYear = +oYear; oMonth = +oMonth;

      // Xác định ngày gốc của đơn — LUON uu tien orderDate (Ngay tao, on dinh, khong doi khi
      // don chuyen trang thai hoan thanh). Fallback ve o.date/oYear+oMonth chi de tuong thich
      // nguoc voi ban backend cu (truoc khi co field orderDate) — nen cap nhat GAS som de tranh
      // dung nhanh du lieu cu qua fallback nay.
      var baseDate = '';
      var _oDateObj = _parseFlexDate(o.orderDate) || _parseFlexDate(o.date);
      if (_oDateObj) {
        baseDate = _ymd(_oDateObj);
      } else if (oYear && oMonth) {
        // Không có ngày cụ thể → dùng ngày 1 của tháng làm fallback
        baseDate = oYear + '-' + String(oMonth).padStart(2,'0') + '-01';
      }
      if (!baseDate) return;

      // ── Điều kiện áp dụng theo nguồn ──
      if (isDao) {
        // Data Đảo Renew: chỉ giữ auto cho đơn tháng 6/2026 (đã bỏ quy tắc theo tháng hiện tại)
        if (!(oYear === 2026 && oMonth === 6)) return;
      } else {
        // landipage/messenger/capture/web: áp dụng từ tháng 5/2026 trở đi
        if (baseDate < '2026-05-01') return;
      }

      var srcTag = isDao ? ' (Data Đảo)' : '';

      MILESTONES.forEach(function(m) {
        var targetDate = m.months
          ? _addDateMonths(baseDate, m.months)
          : _addDateDays(baseDate, m.days);

        // ID duy nhất theo phone + ngày đơn + mốc → tránh tạo trùng
        var autoId = 'dao_' + c.phone + '_' + baseDate + '_' + (m.days||('m'+m.months));
        validAutoIds[autoId] = true; // hợp lệ theo quy tắc hiện tại — giữ lại khi dọn rác

        // Đã bị CS xóa tay → không tạo lại
        if (_daoDeleted[autoId]) return;
        var exists = schedules.find(function(x){ return x.id === autoId; });
        if (exists) return;

        schedules.push(Object.assign({
          id:       autoId,
          phone:    c.phone,
          type:     'cs',
          date:     targetDate,
          note:     m.label + srcTag + ' · Đơn ' + baseDate,
          done:     false,
          autoDao:  true
        }, _remOwnerStamp()));
      });
    });
  });

  // ── Dọn rác: mốc auto (autoDao=true, chưa done) không còn hợp lệ theo quy tắc hiện tại ──
  // (vd sinh ra từ trước khi quy tắc bị siết lại, hoặc đơn hàng gốc không còn nằm trong cửa sổ
  // ngày áp dụng) → xóa khỏi 'ome_sched'. Lịch CS tự đặt tay và các mốc đã done được giữ nguyên.
  var beforeCount = schedules.length;
  schedules = schedules.filter(function(x) {
    if (!x || !x.autoDao || x.done) return true;
    return !!validAutoIds[x.id];
  });
  var removedCount = beforeCount - schedules.length;

  saveLS('ome_sched', schedules);
  if (typeof updateSchedBadges === 'function') updateSchedBadges();
  if (removedCount > 0) {
    if (typeof renderScheduleTab === 'function') renderScheduleTab();
    if (typeof renderOverdueTab === 'function') renderOverdueTab();
  }
  try { syncAutoHenToCareData(); } catch(e){ console.warn('syncAutoHen', e); }
}

function syncAutoHenToCareData() {
  if (typeof careData === 'undefined' || !careData) return 0;
  var todayStr = _ymd(new Date());

  // Gom mốc auto sắp tới (chưa done, ngày >= hôm nay) theo phone → lấy sớm nhất
  var byPhone = {};
  (typeof schedules !== 'undefined' ? schedules : []).forEach(function(x){
    if (!x || !x.autoDao || x.done) return;
    if (!x.date || x.date < todayStr) return;
    var cur = byPhone[x.phone];
    if (!cur || x.date < cur.date) byPhone[x.phone] = x;
  });

  // Xét union: các phone có mốc auto + các phone đang mang ô Hẹn do auto ghi
  var phones = {};
  Object.keys(byPhone).forEach(function(p){ phones[p] = 1; });
  Object.keys(careData).forEach(function(p){
    var n = (careData[p] && careData[p].schedHenNote) || '';
    if (n.indexOf(AUTO_HEN_TAG) === 0) phones[p] = 1;
  });

  var changed = [];
  Object.keys(phones).forEach(function(phone){
    var care = careData[phone] || {};
    var curNote = care.schedHenNote || '';
    var isAuto  = curNote.indexOf(AUTO_HEN_TAG) === 0;
    // Tôn trọng Hẹn mua đặt tay: có ngày + không phải auto → bỏ qua
    if (care.schedHen && !isAuto) return;

    var next = byPhone[phone];
    if (next) {
      var newNote = AUTO_HEN_TAG + ' · ' + (next.note || 'Lịch CS');
      if (care.schedHen !== next.date || curNote !== newNote) {
        care.schedHen = next.date;
        care.schedHenNote = newNote;
        careData[phone] = care;
        changed.push(phone);
      }
    } else if (isAuto) {
      // Không còn mốc auto sắp tới → dọn ô Hẹn auto cũ
      care.schedHen = '';
      care.schedHenNote = '';
      careData[phone] = care;
      changed.push(phone);
    }
  });

  // Đẩy các thay đổi lên GAS (gom batch) → CareData → extension đọc được
  if (changed.length && typeof queueCareSync === 'function') {
    changed.forEach(function(p){ queueCareSync(p); });
  }
  return changed.length;
}

function syncRemindType(val) {
  const inp = document.getElementById('remind-type-text');
  if (!inp) return;
  if (val === '__custom__') { inp.value = ''; inp.focus(); }
  else { const t = SCHED_TYPES.find(function(x){ return x.key===val; }); if (t) inp.value = t.label; }
}

function toggleRemindAuto() {
  const chk = document.getElementById('remind-auto-chk');
  const chip = document.getElementById('remind-auto-chip');
  const datePick = document.getElementById('remind-date-pick');
  if (!chk || !datePick) return;
  if (chk.checked) {
    chip && chip.classList.add('active');
    const d = new Date(); d.setMonth(d.getMonth()+1);
    datePick.value = _ymd(d);
    datePick.style.opacity = '.5';
    datePick.readOnly = true;
  } else {
    chip && chip.classList.remove('active');
    datePick.value = _ymd(new Date());
    datePick.style.opacity = '';
    datePick.readOnly = false;
  }
}

function addCustomRemind(phone) {
  const typeText = (document.getElementById('remind-type-text')?.value||'').trim();
  const typeSel  = document.getElementById('remind-type-sel')?.value || 'custom';
  const date     = document.getElementById('remind-date-pick')?.value || '';
  const note     = (document.getElementById('remind-note')?.value||'').trim();
  if (!date) { toast('Vui lòng chọn ngày nhắc hẹn'); return; }
  let typeKey = (typeSel === '__custom__') ? 'custom' : typeSel;
  const labelFinal = typeText || (SCHED_TYPES.find(function(x){ return x.key===typeKey; })?.label) || 'Nhắc hẹn';
  schedules.push(Object.assign({
    id: Date.now()+'_cr'+Math.random().toString(36).slice(2),
    phone: phone, type: typeKey,
    customLabel: typeText || null,
    date: date, note: note || labelFinal,
    done: false
  }, _remOwnerStamp()));
  saveLS('ome_sched', schedules);
  saveLS('ome_schedules', schedules);
  _touchCare(phone); saveLS('ome_care', careData);
  logAudit('sched', phone, '', 'Thêm lịch nhắc "' + labelFinal + '" · ' + date);
  if (typeof gsUrl !== 'undefined' && gsUrl) queueCareSync(phone);
  updateSchedBadges();
  const ni = document.getElementById('remind-note'); if(ni) ni.value='';
  const chk = document.getElementById('remind-auto-chk');
  if (chk && chk.checked) { chk.checked=false; toggleRemindAuto(); }
  toast('✓ Đã thêm lịch "' + labelFinal + '" · ' + date);
}

function saveCareSchedules(phone) {
  const existing = careData[phone] || {};
  careData[phone] = {
    ...existing,
    schedGoi: document.getElementById('sched-goi-date')?.value || '',
    schedGoiNote: document.getElementById('sched-goi-note')?.value || '',
    schedSP: document.getElementById('sched-sp-date')?.value || '',
    schedSPNote: document.getElementById('sched-sp-note')?.value || '',
    schedCS: document.getElementById('sched-cs-date')?.value || '',
    schedCSNote: document.getElementById('sched-cs-note')?.value || '',
    schedHen: document.getElementById('sched-hen-date')?.value || '',
    schedHenNote: document.getElementById('sched-hen-note')?.value || '',
  };
  // Also auto-add to schedules list
  const schedFields = [
    {dateKey:'schedGoi', noteKey:'schedGoiNote', type:'goi'},
    {dateKey:'schedSP', noteKey:'schedSPNote', type:'sp'},
    {dateKey:'schedCS', noteKey:'schedCSNote', type:'cs'},
    {dateKey:'schedHen', noteKey:'schedHenNote', type:'hen'},
  ];
  for (const f of schedFields) {
    const d = careData[phone][f.dateKey];
    if (d) {
      // Remove existing sched of same type for this phone (avoid duplicates)
      const idx = schedules.findIndex(x=>x.phone===phone&&x.type===f.type&&!x.done);
      if (idx >= 0) schedules.splice(idx, 1);
      schedules.push(Object.assign({id:Date.now()+'_'+f.type, phone, type:f.type, date:d, note:careData[phone][f.noteKey]||'', done:false}, _remOwnerStamp()));
    }
  }
  saveLS('ome_care', careData);
  saveLS('ome_schedules', schedules);
  saveLS('ome_sched', schedules);
  _touchCare(phone);
  logAudit('sched', phone, '', 'Cập nhật lịch hẹn nhanh');
  updateSchedBadges();
  // Cập nhật ngay panel "Nhắc hẹn" (không chờ chu kỳ làm mới 60s)
  if (typeof renderReminderPanel === 'function') renderReminderPanel();
  if (gsUrl) { queueCareSync(phone); toast('✓ Đã lưu lịch hẹn'); }
  else toast('✓ Đã lưu lịch hẹn (local)');
}



function quickSched(phone) {
  const type = document.getElementById('qs-type').value;
  const date = document.getElementById('qs-date').value;
  const note = document.getElementById('qs-note').value.trim();
  if (!date) { toast('Vui lòng chọn ngày'); return; }
  schedules.push(Object.assign({id: Date.now()+'_'+Math.random().toString(36).slice(2), phone, type, date, note, done:false}, _remOwnerStamp()));
  saveLS('ome_sched', schedules);
  _touchCare(phone); saveLS('ome_care', careData);
  logAudit('sched', phone, '', `Thêm lịch "${schedTypeLabel(type)}" · ${date}`);
  if (gsUrl) queueCareSync(phone);
  updateSchedBadges();
  toast('✓ Đã thêm lịch hẹn');
}

function _toggleAddOrderForm() {
  const el = document.getElementById('add-order-form');
  if (!el) return;
  const opening = el.style.display === 'none';
  el.style.display = opening ? 'block' : 'none';
  // Khi MO form: neu KH nay den tu nguon "Chăm sóc" (da luu tai khoan qua Pancake AI/Zalo AI/
  // nut "+ Thêm KH mới") thi dien san Nguon = "Chăm sóc" cho CS khoi phai go tay.
  // CS van co the sua lai o nay neu don thuc te den tu nguon khac.
  if (opening) {
    try {
      const srcEl = document.getElementById('mo-source');
      const lead = (typeof currentPhone !== 'undefined' && currentPhone && typeof careLeads !== 'undefined' && careLeads)
        ? careLeads[currentPhone] : null;
      if (srcEl && !srcEl.value && lead && lead.cs) srcEl.value = 'Chăm sóc';
    } catch(e){}
  }
}

// ═══════════════════════════════════════════════════════
//  THÊM KH / ĐƠN MỚI NHANH (CS) — chỉ bắt buộc Tên, SĐT, Ghi chú.
//  Nếu SĐT chưa có trong hệ thống -> tự tạo khách hàng mới (giống cơ chế
//  CareData.name đã có sẵn cho "khách mới chưa có đơn hàng nào").
//  Sản phẩm/doanh thu (đơn hàng thật) điền sau trong trang chi tiết khách.
// ═══════════════════════════════════════════════════════
function openQuickAddModal(){
  const m = document.getElementById('quick-add-modal');
  if (m) m.style.display = 'flex';
  ['qa-name','qa-phone','qa-note'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  setTimeout(() => { const el = document.getElementById('qa-name'); if (el) el.focus(); }, 50);
}
function closeQuickAddModal(){
  const m = document.getElementById('quick-add-modal');
  if (m) m.style.display = 'none';
}
async function submitQuickAddCustomer(){
  const name  = (document.getElementById('qa-name').value || '').trim();
  const phoneRaw = (document.getElementById('qa-phone').value || '').trim();
  const note  = (document.getElementById('qa-note').value || '').trim();
  if (!name)  { toast('Vui lòng nhập tên khách hàng'); return; }
  if (!phoneRaw) { toast('Vui lòng nhập số điện thoại'); return; }
  if (!note)  { toast('Vui lòng nhập ghi chú'); return; }
  const phone = normPhone(phoneRaw);
  if (!phone) { toast('Số điện thoại không hợp lệ'); return; }

  const isNewCustomer = !allCustomers.find(x => x.phone === phone);
  const existingLead = careLeads[phone] || {};
  const existingCare = careData[phone] || {};
  const userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : 'CS';

  // Ghi chú lưu dạng lịch sử [{text,user,time}] — dùng CHUNG 1 lịch sử với ô "Ghi chú CS" ở
  // trang chi tiết (đọc từ careData), để không mất ghi chú cũ dù KH đã có sẵn đơn ở DT tổng.
  const noteArr = _parseNotes(existingCare.note || existingLead.note || '');
  noteArr.unshift({ text: note, user: userName, time: _fmtNoteTime(new Date()) });
  const mergedNoteStr = _notesToStr(noteArr);

  // 1) Ghi vào CareData (nguồn hiển thị chính: Ghi chú CS ở trang chi tiết, danh sách khách,
  //    đồng bộ lịch sử tin nhắn Pancake/Zalo AI...) — để KH này (dù mới hay đã có đơn ở DT
  //    tổng) đều thấy ngay ghi chú khi mở danh sách/trang chi tiết.
  careData[phone] = Object.assign({}, existingCare, {
    name: existingCare.name || name,
    note: mergedNoteStr,
    cs: existingCare.cs || userName
  });
  _touchCare(phone);
  saveLS('ome_care', careData);

  // 2) Đồng thời vẫn ghi vào sheet RIÊNG "KH Chăm sóc mới" để phục vụ Báo cáo D (tách riêng,
  //    không gộp vào báo cáo doanh số A/B/C) — không đổi so với trước.
  //    Trường `cs` ở đây CHÍNH LÀ "sale phụ trách" của số mới này: số nào sale tự thêm thì sale
  //    đó phụ trách (xem _buildCsSet_ — nó đọc careLeads[phone].cs), nên với SỐ MỚI luôn gán
  //    tài khoản đang thêm; chỉ giữ lại giá trị cũ khi số này đã từng được ai đó thêm trước đó.
  careLeads[phone] = {
    name: existingLead.name || name,
    note: mergedNoteStr,
    cs: existingLead.cs || userName,
    createdAt: existingLead.createdAt || new Date().toISOString()
  };
  saveLS('ome_care_leads', careLeads);

  buildCustomers();
  const _c = allCustomers.find(x => x.phone === phone);
  if (_c) _c._lastActionDate = Date.now();
  if (typeof applyFilters === 'function') applyFilters();
  logAudit('order_manual', phone, '', 'Thêm KH/Đơn nhanh (nguồn Chăm sóc): ' + name + (note ? (' · ' + note) : ''));
  closeQuickAddModal();
  toast(isNewCustomer ? '✓ Đã thêm khách hàng mới (nguồn: Chăm sóc)' : '✓ Đã ghi chú thêm cho khách có sẵn');
  openDp(phone);

  // Đồng bộ CareData qua hàng đợi CHUNG (gộp cùng các thay đổi khác của KH này, tránh ghi đè
  // chéo với các thao tác khác đang chờ đồng bộ) + ghi thêm vào sheet riêng cho Báo cáo D.
  if (gsUrl) {
    queueCareSync(phone);
    try {
      await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'addCareLead', phone, name: careLeads[phone].name, note: careLeads[phone].note, cs: careLeads[phone].cs }) });
    } catch(e) { console.warn('addCareLead sync error:', e.message); }
  }
}

async function addManualOrder(phone) {
  const product = (document.getElementById('mo-product').value||'').trim();
  const revenue = parseFloat(document.getElementById('mo-revenue').value||0)||0;
  const date    = document.getElementById('mo-date').value;
  const rawSource = (document.getElementById('mo-source').value||'').trim();
  const detail  = (document.getElementById('mo-detail').value||'').trim();
  if (!date) { toast('Vui lòng chọn ngày đặt'); return; }
  if (!revenue) { toast('Vui lòng nhập doanh thu'); return; }

  const c = allCustomers.find(x=>x.phone===phone);
  if (!c) { toast('Không tìm thấy khách hàng'); return; }

  const d = new Date(date);
  const yr = d.getFullYear();
  const mo = d.getMonth()+1;

  // ── KH da duoc luu qua Pancake AI / Zalo AI / nut "+ Them KH mua moi" (co trong careLeads) ──
  // Theo yeu cau: sau nay CS them don cho nhung KH nay thi don PHAI hien:
  //   - Nguon  = "Chăm sóc"
  //   - Nguoi cham soc / CS phu trach = dung ten tai khoan da luu luc them KH (careLeads[phone].cs),
  //     KHONG lay theo nguoi dang bam them don (co the la admin/CS khac dang len don ho).
  const lead = (typeof careLeads !== 'undefined' && careLeads) ? careLeads[phone] : null;
  const leadCS = lead && lead.cs ? String(lead.cs).trim() : '';

  const enteredBy = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : '';
  // Nguon: KH nguon "Chăm sóc" -> luon ghi "Chăm sóc" (tru khi CS co chu dong go nguon khac vao o).
  const source = leadCS ? (rawSource || 'Chăm sóc') : rawSource;
  // CS phu trach: uu tien nguoi da luu tai khoan tren Pancake/Zalo AI; neu khong co moi lui ve
  // quy uoc cu "CS phu trach = nguoi len don".
  const cs = leadCS || enteredBy || (careData[phone]&&careData[phone].cs) || _latestOrderCS(c.orders) || '';
  // CS cham soc: giu nguyen nguoi dang cham neu da co, chua co thi gan luon cho nguoi len don.
  const careCS = leadCS || (careData[phone]&&careData[phone].cs) || enteredBy || cs;

  const newOrder = {
    date: d, year: yr, month: mo,
    cs, source, revenue, product: guessProduct(detail||product),
    productDetail: detail||product, status: c._rawStatus||'', zalo: c._rawZalo||'', note: ''
  };

  c.orders.push(newOrder);
  c._keys = c._keys||new Set();
  c._keys.add(`${phone}_${yr}_${mo}_${revenue}`);

  // Recompute totals
  c.totalRevenue = _custRev_(c);
  c.hangKey = _hangKeyOf_(c.totalRevenue); c.hang = HANG_LABEL[c.hangKey];
  c.totalOrders  = _custOrderCount_(c);
  c.brands = new Set(c.orders.map(o=>o.product).filter(Boolean));
  c.renewOrders = c.orders.filter(o=>RENEW_SOURCES.includes(s(o.source).toLowerCase())).length;

  // KH nguon "Chăm sóc": chot luon CS cham soc = tai khoan da luu tren Pancake/Zalo AI, de
  // cot "CS chăm sóc" o danh sach + bo loc hien dung ngay, khong phai doi dong bo vong sau.
  if (leadCS) {
    careData[phone] = Object.assign({}, careData[phone]||{}, { cs: leadCS });
    try { _touchCare(phone); } catch(e){}
    saveLS('ome_care', careData);
    c.careCS = leadCS;
    c.careCSSet = new Set(splitMulti_(leadCS, ','));
  }

  logAudit('order_manual', phone, '', `Thêm đơn thủ công: ${product||detail} · ${revenue} · ${date}`);

  // Tự động thêm lịch chăm sóc nếu CS tích checkbox
  const autoSched = document.getElementById('mo-auto-sched');
  if (autoSched && autoSched.checked) {
    const MILESTONES = [
      { days: 7,  label: 'CS +7 ngày' },
      { days: 14, label: 'CS +14 ngày' },
      { months: 1, label: 'CS +1 tháng' },
      { months: 2, label: 'CS +2 tháng' },
    ];
    MILESTONES.forEach(function(m) {
      const targetDate = m.months ? _addDateMonths(date, m.months) : _addDateDays(date, m.days);
      const autoId = 'manual_' + phone + '_' + date + '_' + (m.days||('m'+m.months));
      if (!schedules.find(x => x.id === autoId)) {
        schedules.push(Object.assign({
          id: autoId, phone, type: 'cs',
          date: targetDate,
          note: m.label + ' · Đơn ' + date + (product||detail ? ' · '+(product||detail) : ''),
          done: false, autoManual: true
        }, _remOwnerStamp()));
      }
    });
    saveLS('ome_sched', schedules);
    updateSchedBadges();
  }

  if (gsUrl) {
    show('loverlay');
    try {
      const payload = [{
        phone, name: c.name,
        date: d.toISOString(), year: yr, month: mo,
        cs, source, revenue, product: newOrder.product,
        productDetail: newOrder.productDetail,
        status: newOrder.status, zalo: newOrder.zalo, note: '',
        careCS: careCS
      }];
      const r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({action:'saveOrders', orders: payload}) });
      const txt = await r.text();
      let d2; try { d2=JSON.parse(txt); } catch(e){ d2={}; }
      hide('loverlay');
      if (d2.error) toast('Lỗi GSheets: '+d2.error);
      else toast('✓ Đã thêm đơn hàng' + (d2.written?` · Synced GSheets`:''));
    } catch(e) { hide('loverlay'); toast('Lỗi kết nối GSheets'); }
  } else {
    toast('✓ Đã thêm đơn hàng (chưa cấu hình GSheets)');
  }

  // Refresh panel
  document.getElementById('mo-product').value='';
  document.getElementById('mo-revenue').value='';
  document.getElementById('mo-detail').value='';
  try { checkDataDaoRenewSchedules(); } catch(e){}
  renderTable();
  openDetail(phone, 'hist');
}

function addSched(phone) {
  const type = document.getElementById('new-stype').value;
  const date = document.getElementById('new-sdate').value;
  const note = document.getElementById('new-snote').value.trim();
  if (!date) { toast('Vui lòng chọn ngày'); return; }
  schedules.push(Object.assign({id: Date.now()+'_'+Math.random().toString(36).slice(2), phone, type, date, note, done:false}, _remOwnerStamp()));
  saveLS('ome_sched', schedules);
  _touchCare(phone); saveLS('ome_care', careData);
  logAudit('sched', phone, '', `Thêm lịch "${schedTypeLabel(type)}" · ${date}`);
  if (gsUrl) queueCareSync(phone);
  updateSchedBadges();
  if (typeof renderReminderPanel === 'function') renderReminderPanel();
  const c = allCustomers.find(x=>x.phone===phone);
  document.getElementById('dp-body').innerHTML = renderSchedTabHtml(c);
  toast('✓ Đã thêm lịch hẹn');
}

function _schedEditToggle(eid) {
  const el = document.getElementById(eid);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function _schedEditSave(id, eid, phone) {
  const it = schedules.find(x => x.id === id);
  if (!it) { toast('Không tìm thấy lịch'); return; }
  const newType = document.getElementById(eid + '_type')?.value || it.type;
  const newDate = document.getElementById(eid + '_date')?.value || it.date;
  const newNote = (document.getElementById(eid + '_note')?.value || '').trim();
  if (!newDate) { toast('Vui lòng chọn ngày'); return; }
  it.type = newType;
  it.date = newDate;
  it.note = newNote;
  saveLS('ome_sched', schedules);
  logAudit('sched', phone, '', `Sửa lịch "${schedTypeLabel(newType)}" · ${newDate}`);
  if (gsUrl) queueCareSync(phone);
  updateSchedBadges();
  if (typeof renderReminderPanel === 'function') renderReminderPanel();
  const c = allCustomers.find(x => x.phone === phone);
  if (c) document.getElementById('dp-body').innerHTML = renderSchedTabHtml(c);
  toast('✓ Đã cập nhật lịch hẹn');
}

function delSched(id) {
  const it = schedules.find(x=>x.id===id);
  // Lịch auto Data Đảo: ghi nhớ id đã xóa để checkDataDaoRenewSchedules KHÔNG tạo lại
  if (it && it.autoDao) {
    var delSet = loadLS('ome_dao_deleted') || {};
    delSet[id] = true;
    saveLS('ome_dao_deleted', delSet);
  }
  schedules = schedules.filter(x=>x.id!==id);
  saveLS('ome_sched', schedules);
  if (it) logAudit('del', it.phone, `${schedTypeLabel(it.type)} · ${it.date}`, 'Đã xóa lịch');
  if (it && gsUrl) queueCareSync(it.phone);
  updateSchedBadges();
  if (typeof renderReminderPanel === 'function') renderReminderPanel();
  const c = allCustomers.find(x=>x.phone===currentPhone);
  if (c) document.getElementById('dp-body').innerHTML = renderSchedTabHtml(c);
  toast('Đã xóa lịch');
}

function closeDp(e) {
  if (!e || e.target===document.getElementById('dp-overlay'))
    document.getElementById('dp-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════
//  STATS + SIDEBAR
// ═══════════════════════════════════════════════════════
function rebuildCareOnCustomers() {
  for (const c of allCustomers) {
    const care = careData[c.phone] || {};
    c.careStatus = care.status || c._rawStatus || '';
    c.zaloStatus = care.zalo  || c._rawZalo  || '';
    c.khStatus   = care.khStatus || '';
    c.nickZalos  = Array.isArray(care.nickZalos) ? care.nickZalos : [];
    c.zaloPhones = Array.isArray(care.zaloPhones) ? care.zaloPhones : [];
    c.careNote   = care.note  || c._rawNote  || '';
    c.custom     = (care.custom && typeof care.custom === 'object') ? care.custom : {};
    c.careCS     = care.cs    || _latestOrderCS(c.orders);
    if (!c.csSet) c.csSet = _buildCsSet_(c.orders, c.phone);
  }
}

function updateStats() {
  const base = scopedCustomers();
  const vip=base.filter(c=>c.tier==='VIP').length;
  const tt=base.filter(c=>c.tier==='Thân thiết').length;
  const tn=base.filter(c=>c.tier==='Tiềm năng').length;
  txt('s-total',fmt(base.length)); txt('s-vip',fmt(vip)); txt('s-tt',fmt(tt)); txt('s-tn',fmt(tn));
  txt('b-all',fmt(base.length)); txt('b-vip',fmt(vip)); txt('b-tt',fmt(tt)); txt('b-tn',fmt(tn));
  txt('b-other',fmt(base.filter(c=>c.tier==='Chưa bán lại được').length));
}
function updateSidebarBadges() {
  const base = scopedCustomers();
  const cnt = f => base.filter(f).length;
  // Badge "Tất cả"
  txt('bc-all', fmt(base.length));
  // Dynamic badges cho từng tình trạng trong CARE_STATUS
  CARE_STATUS.forEach(function(st, i) {
    txt('bc-cs-' + i, fmt(cnt(c => c.careStatus === st)));
  });
  // Zalo badges (cố định)
  txt('bz-kb',fmt(cnt(c=>c.zaloStatus==='Đã kết bạn')));
  txt('bz-ckb',fmt(cnt(c=>c.zaloStatus==='Chưa kết bạn')));
  txt('bz-cdy',fmt(cnt(c=>c.zaloStatus==='Chưa đồng ý')));
  txt('bz-block',fmt(cnt(c=>['Chặn','Hủy kết bạn'].includes(c.zaloStatus))));
}
function setCFFilter(fieldId, val, el) {
  if (!val || val === 'all') delete currentCF[fieldId];
  else currentCF[fieldId] = val;
  // Bỏ active các nút cùng nhóm trường này rồi active nút vừa bấm
  var wrap = el && el.closest ? el.closest('.cf-filter-group') : null;
  if (wrap) wrap.querySelectorAll('.section-btn').forEach(function(b){ b.classList.remove('active'); });
  if (el) el.classList.add('active');
  if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
  applyFilters();
}
function updateBrandList() {
  var host = document.getElementById('cf-filter-sections');
  if (!host) return;
  if (typeof CUSTOM_FIELDS === 'undefined' || !CUSTOM_FIELDS.length) { host.innerHTML = ''; return; }
  var base = scopedCustomers();
  host.innerHTML = CUSTOM_FIELDS.map(function(f){
    // Đếm số KH theo từng giá trị của trường này
    var counts = {};
    base.forEach(function(c){
      var v = (c.custom && c.custom[f.id]) || '';
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    // Liệt kê theo đúng thứ tự admin sắp trong cây (chỉ các mục chọn được), kèm nhãn mẹ → con
    var opts = [];
    (f.tree || []).forEach(function(node){
      if (node.children && node.children.length) {
        node.children.forEach(function(ch){
          var v = ch.value || ch.label;
          opts.push({ v: v, label: node.label + ' → ' + ch.label });
        });
      } else {
        var v2 = node.value || node.label;
        opts.push({ v: v2, label: node.label });
      }
    });
    var cur = currentCF[f.id] || 'all';
    var rows = '<button class="section-btn ' + (cur === 'all' ? 'active' : '') + '" data-cf="' + esc(f.id) + '" data-v="all"'
      + ' onclick="setCFFilter(this.dataset.cf,\'all\',this)"><span>Tất cả</span><span class="fbadge">' + fmt(base.length) + '</span></button>';
    rows += opts.map(function(o){
      var n = counts[o.v] || 0;
      return '<button class="section-btn ' + (cur === o.v ? 'active' : '') + '" data-cf="' + esc(f.id) + '" data-v="' + esc(o.v) + '"'
        + ' onclick="setCFFilter(this.dataset.cf,this.dataset.v,this)"><span>' + esc(o.label) + '</span><span class="fbadge">' + fmt(n) + '</span></button>';
    }).join('');
    return '<div class="sb-label">' + esc(f.label) + '</div><div class="fgroup cf-filter-group">' + rows + '</div>'
      + '<div class="divider" style="margin:7px 0"></div>';
  }).join('');
}

// ── Đổi chế độ lọc CS: phụ trách / chăm sóc / cả hai ──
function setCSFilterMode(mode, el){
  _csFilterMode = mode;
  document.querySelectorAll('#cs-mode-toggle .cs-mode-btn').forEach(b=>b.classList.toggle('active', b===el));
  if (typeof _invalidateFilterCache==='function') _invalidateFilterCache();
  updateStats();
  updateSidebarBadges();
  if (typeof updateBrandList==='function') updateBrandList();
  applyFilters();
}

// ── Khi đổi CS ở "Lọc theo CS": toàn bộ sidebar + stats + danh sách + lọc nâng cao theo CS đó ──
function onCSFilterChange(){
  // Xem trọn bộ KH của CS được chọn → reset các bộ lọc con
  currentTier='all'; currentCare='all'; currentZalo='all'; currentBrand='all'; currentCF={};
  document.querySelectorAll('.fi').forEach((b,i)=>{ b.classList.remove('active'); if(i===0)b.classList.add('active'); });
  if (typeof resetSubFilters==='function') resetSubFilters();
  if (typeof _invalidateFilterCache==='function') _invalidateFilterCache();
  updateStats();
  updateSidebarBadges();
  updateBrandList();
  if (typeof updateCampaignFilter === 'function') updateCampaignFilter();
  applyFilters();
  // Re-render lịch hẹn theo CS mới (trước đây bị bỏ sót)
  if (typeof renderScheduleTab === 'function') renderScheduleTab();
  if (typeof renderOverdueTab === 'function') renderOverdueTab();
}

function csComboRender(filter){
  const list = document.getElementById('cs-combo-list');
  if (!list) return;
  const q = _foldVi(filter||'');
  const selected = new Set(_csFilterList());
  const items = q ? csComboData.filter(it => it.value!=='all' && _foldVi(it.label).includes(q)) : csComboData;
  if (!items.length){ list.innerHTML = '<div class="cs-combo-empty">Không tìm thấy CS</div>'; _csComboIdx=-1; return; }
  list.innerHTML = items.map(it => {
    if (it.value === 'all') {
      // Dòng "Tất cả" = bỏ chọn hết, không phải 1 lựa chọn thật trong tập multi
      const noneSel = selected.size === 0;
      return `<div class="cs-combo-opt ${noneSel?'is-sel':''}" data-v="all" onmousedown="csComboPickAll(event)">`+
             `<span>${noneSel?'☑':'☐'} ${esc(it.label)}</span></div>`;
    }
    const checked = selected.has(it.value);
    return `<div class="cs-combo-opt ${checked?'is-sel':''}" data-v="${esc(it.value)}" onmousedown="csComboToggleItem(event, this.getAttribute('data-v'))">`+
           `<span>${checked?'☑':'☐'} ${esc(it.label)}</span><span class="ccnt">${fmt(it.count)}</span></div>`;
  }).join('');
  _csComboIdx = -1;
}
function csComboOpen(){
  const sel = document.getElementById('cs-staff-filter');
  if (sel && sel.disabled) return;
  const ci = document.getElementById('cs-combo-input');
  if (ci) ci.value = ''; // luôn mở với ô trống để gõ tìm mới, không dùng text tóm tắt (vd "3 CS đã chọn") để lọc
  csComboRender('');
  const l = document.getElementById('cs-combo-list'); if (l) l.classList.add('open');
}
function csComboClose(){
  const l=document.getElementById('cs-combo-list'); if(l) l.classList.remove('open');
  syncCSCombo(); // khôi phục hiển thị tóm tắt lựa chọn hiện tại sau khi đóng
}
function csComboToggle(e){
  if (e) e.stopPropagation();
  const l=document.getElementById('cs-combo-list'); if(!l) return;
  if (l.classList.contains('open')) csComboClose();
  else { const ci=document.getElementById('cs-combo-input'); if(ci) ci.focus(); csComboOpen(); }
}
function csComboFilter(v){
  csComboRender(v);
  const l=document.getElementById('cs-combo-list'); if (l) l.classList.add('open');
}
// Click 1 tên CS: TICK/BỎ TICK tên đó, KHÔNG đóng dropdown (để chọn tiếp tên khác)
function csComboToggleItem(e, value){
  if (e && e.preventDefault) e.preventDefault();   // mousedown → tránh blur sớm
  const list = _csFilterList();
  const idx = list.indexOf(value);
  if (idx !== -1) list.splice(idx, 1); else list.push(value);
  _csSetFilterSelection(list);
  const ci = document.getElementById('cs-combo-input');
  csComboRender(ci ? ci.value : '');
  onCSFilterChange();
}
// Chọn "— Tất cả CS —" = bỏ chọn hết, đóng dropdown lại
function csComboPickAll(e){
  if (e && e.preventDefault) e.preventDefault();
  _csSetFilterSelection([]);
  csComboClose();
  onCSFilterChange();
}
function csComboClear(e){ if(e) e.stopPropagation(); _csSetFilterSelection([]); csComboClose(); onCSFilterChange(); }
function csComboKey(e){
  const list = document.getElementById('cs-combo-list');
  if (!list || !list.classList.contains('open')){ if (e.key==='ArrowDown') csComboOpen(); return; }
  const opts = [...list.querySelectorAll('.cs-combo-opt')];
  if (!opts.length) return;
  if (e.key==='ArrowDown'){ e.preventDefault(); _csComboIdx = Math.min(_csComboIdx+1, opts.length-1); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); _csComboIdx = Math.max(_csComboIdx-1, 0); }
  else if (e.key==='Enter'){
    e.preventDefault();
    const pick = (_csComboIdx>=0 && opts[_csComboIdx]) ? opts[_csComboIdx] : (opts.length===1 ? opts[0] : null);
    if (pick){
      const v = pick.getAttribute('data-v');
      if (v === 'all') csComboPickAll(e); else csComboToggleItem(e, v);
    }
    return;
  }
  else if (e.key==='Escape'){ csComboClose(); return; }
  else { return; }
  opts.forEach((o,i)=>o.classList.toggle('active', i===_csComboIdx));
  if (_csComboIdx>=0 && opts[_csComboIdx]) opts[_csComboIdx].scrollIntoView({block:'nearest'});
}
function syncCSCombo(){
  const sel = document.getElementById('cs-staff-filter');
  const input = document.getElementById('cs-combo-input');
  if (!sel || !input) return;
  const names = _csFilterList();
  input.value = names.length===0 ? '' : (names.length===1 ? names[0] : names.length+' CS đã chọn');
  input.title = names.length>1 ? names.join(', ') : ''; // hover xem đủ tên khi chọn nhiều
  input.disabled = !!sel.disabled;
  const clr = document.getElementById('cs-combo-clear');
  if (clr) clr.style.display = (names.length===0 || sel.disabled) ? 'none' : '';
  const combo = document.getElementById('cs-combo');
  if (combo) combo.classList.toggle('disabled', !!sel.disabled);
}
function updateCSStaffList() {
  const csSet = [...new Set(allCustomers.flatMap(c=>[
    ..._buildCsSet_(c.orders, c.phone),
    ...(c.careCSSet||[])
  ]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  // Đếm số KH mỗi CS (theo phạm vi vai trò) để hiển thị cạnh tên trong ô tìm
  const counts = {};
  for (const c of allCustomers){
    if (typeof _inUserScope==='function' && !_inUserScope(c)) continue;
    if (c.csSet) c.csSet.forEach(n=>{ counts[n]=(counts[n]||0)+1; });
    if (c.careCSSet) c.careCSSet.forEach(n=>{ if (!(c.csSet && c.csSet.has(n))) counts[n]=(counts[n]||0)+1; });
  }
  const sel = document.getElementById('cs-staff-filter');
  const prevSelected = _csFilterList(); // giữ lại lựa chọn multi trước khi build lại <option>
  if (sel){
    sel.innerHTML = '<option value="all">— Tất cả CS —</option>' +
      csSet.map(cs=>`<option value="${esc(cs)}">${esc(cs)}</option>`).join('');
    // Chỉ giữ lại các tên vẫn còn tồn tại trong danh sách CS mới (bỏ tên đã đổi/xóa)
    _csSetFilterSelection(prevSelected.filter(n => csSet.includes(n)));
  }
  // Dữ liệu cho ô "Lọc theo CS" có tìm kiếm (gõ tên)
  csComboData = [{value:'all', label:'— Tất cả CS —', count:0}]
    .concat(csSet.map(cs=>({value:cs, label:cs, count: counts[cs]||0})));
  const ci = document.getElementById('cs-combo-input');
  csComboRender(ci ? ci.value : '');
  syncCSCombo();
  // Also update advanced filter CS chips
  if (document.getElementById('adv-cs-chips')) buildAdvChips('cs', csSet, advFilters.cs, 'adv-cs-chips');
  // Populate year filter
  updateYearFilter();
}
function updateYearFilter() {
  const years = [...new Set(allCustomers.flatMap(c=>c.orders.map(o=>{
    if (o.year) return o.year < 100 ? 2000 + o.year : o.year;
    if (o.date instanceof Date) return o.date.getFullYear();
    return null;
  })).filter(Boolean))].sort((a,b)=>b-a);
  const sel = document.getElementById('ymf-year');
  if (!sel) return;
  sel.innerHTML = '<option value="">Tất cả năm</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  // Also adv modal selects
  ['adv-year-from','adv-year-to'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">—</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
  });
}
function updateFilesBar() {
  document.getElementById('files-bar').innerHTML = loadedFiles.map(f=>
    `<div class="fchip"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${esc(f.name)} <span class="fchip-r">${fmt(f.rows)} dòng</span></div>`).join('');
}

// ═══════════════════════════════════════════════════════
//  COPY & EDIT PHONE
// ═══════════════════════════════════════════════════════
function copyPhone(phone) {
  navigator.clipboard.writeText(phone).then(() => toast('✓ Đã copy SĐT: ' + phone));
}

function openEditPhone(oldPhone) {
  const existing = document.getElementById('edit-phone-modal');
  if (existing) existing.remove();
  const curName = (careData[oldPhone] && careData[oldPhone].name) || '';
  const autoName = (customerMap[oldPhone] && customerMap[oldPhone].name) || '';
  const overlay = document.createElement('div');
  overlay.id = 'edit-phone-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:700;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--rlg);box-shadow:0 8px 32px rgba(0,0,0,0.2);width:360px;max-width:92vw;padding:0;overflow:hidden">
      <div style="padding:14px 18px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:14px;font-weight:700">✏️ Sửa SĐT / Tên KH</div>
        <button onclick="document.getElementById('edit-phone-modal').remove()" style="background:var(--surface2);border:none;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:13px;color:var(--muted)">✕</button>
      </div>
      <div style="padding:16px 18px">
        <div style="font-size:11px;color:var(--hint);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Tên khách hàng</div>
        <input id="edit-name-input" class="form-input" type="text" placeholder="${esc(autoName && autoName !== oldPhone ? 'Tên tự nhận diện: ' + autoName : 'Nhập tên khách hàng...')}" value="${esc(curName)}"
          style="width:100%;margin-bottom:14px;font-size:14px">
        <div style="font-size:11px;color:var(--hint);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">SĐT hiện tại</div>
        <div style="font-size:14px;font-weight:600;font-family:monospace;color:var(--text);margin-bottom:14px;padding:6px 10px;background:var(--surface2);border-radius:var(--rsm)">${esc(oldPhone)}</div>
        <div style="font-size:11px;color:var(--hint);margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">SĐT mới</div>
        <input id="edit-phone-input" class="form-input" type="tel" placeholder="Nhập số điện thoại mới..." value="${esc(oldPhone)}" data-old-phone="${esc(oldPhone)}"
          style="width:100%;margin-bottom:8px;font-size:14px;font-family:monospace"
          onkeydown="if(event.key==='Enter') saveEditPhone(this.dataset.oldPhone)">
        <div id="edit-phone-err" style="font-size:11px;color:var(--red);margin-bottom:8px;display:none"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button class="btn" onclick="document.getElementById('edit-phone-modal').remove()">Huỷ</button>
          <button class="btn primary" data-old-phone="${esc(oldPhone)}" onclick="saveEditPhone(this.dataset.oldPhone)">💾 Lưu${gsUrl ? ' + Sync GSheets' : ''}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => {
    const inp = document.getElementById('edit-phone-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 80);
}


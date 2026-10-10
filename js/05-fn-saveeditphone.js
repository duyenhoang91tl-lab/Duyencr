async function saveEditPhone(oldPhone) {
  const inp = document.getElementById('edit-phone-input');
  const nameInp = document.getElementById('edit-name-input');
  const errEl = document.getElementById('edit-phone-err');
  if (!inp) return;
  const rawNew = inp.value.trim();
  const newPhone = normPhone(rawNew) || rawNew.replace(/\D/g,'');
  const newName = (nameInp ? nameInp.value : '').trim();
  if (!newPhone || newPhone.length < 8) {
    errEl.textContent = '⚠ Số điện thoại không hợp lệ (cần ít nhất 8 số)';
    errEl.style.display = '';
    return;
  }
  if (newPhone === oldPhone) {
    // SĐT không đổi — chỉ lưu tên nếu có nhập/sửa, không chạy các bước migrate SĐT bên dưới
    const oldName = (careData[oldPhone] && careData[oldPhone].name) || '';
    if (newName !== oldName) {
      if (!careData[oldPhone]) careData[oldPhone] = {};
      careData[oldPhone].name = newName;
      saveLS('ome_care', careData);
      _invalidateFilterCache();
      buildCustomers();
      if (gsUrl) { syncToast('✓ Đã lưu tên → đang đồng bộ GSheets...'); await pushCareToGS(oldPhone); }
      toast('✓ Đã lưu tên khách hàng');
      openDp(oldPhone);
    }
    document.getElementById('edit-phone-modal').remove();
    return;
  }
  if (customerMap[newPhone] || careData[newPhone]) {
    errEl.textContent = '⚠ Số điện thoại ' + newPhone + ' đã tồn tại trong hệ thống';
    errEl.style.display = '';
    return;
  }

  // 1. Cập nhật customerMap
  if (customerMap[oldPhone]) {
    const entry = customerMap[oldPhone];
    entry.phone = newPhone;
    entry.orders.forEach(o => o.phone = newPhone);
    customerMap[newPhone] = entry;
    delete customerMap[oldPhone];
  }

  // 2. Cập nhật careData (kèm tên mới nếu có sửa)
  if (careData[oldPhone]) {
    careData[newPhone] = { ...careData[oldPhone] };
    delete careData[oldPhone];
  } else if (newName) {
    careData[newPhone] = {};
  }
  if (careData[newPhone]) careData[newPhone].name = newName;
  saveLS('ome_care', careData);

  // 3. Cập nhật schedules
  let schedChanged = false;
  schedules.forEach(s => { if (s.phone === oldPhone) { s.phone = newPhone; schedChanged = true; } });
  if (schedChanged) saveLS('ome_schedules', schedules);

  // 4. Cập nhật assignHistory
  assignHistory.forEach(h => {
    const idx = h.phones.indexOf(oldPhone);
    if (idx !== -1) h.phones[idx] = newPhone;
    if (h.donePhones) {
      const di = h.donePhones.indexOf(oldPhone);
      if (di !== -1) h.donePhones[di] = newPhone;
    }
  });
  saveLS('ome_assign_hist', assignHistory);

  // 5. Rebuild allCustomers
  _invalidateFilterCache();
  buildCustomers();

  // 6. Đóng modal
  document.getElementById('edit-phone-modal').remove();

  // 7. Sync lên Google Sheets
  if (gsUrl) {
    syncToast('✓ Đã đổi SĐT → đang đồng bộ GSheets...');
    // Push care với số mới (tạo dòng mới)
    await pushCareToGS(newPhone);
    // Xoá dòng cũ trên GS bằng cách push 1 dòng rỗng/marker
    try {
      await fetch(gsUrl, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ action: 'saveSingle', row: {
          phone: oldPhone, status: '_deleted_', zalo:'', cs:'', note:'SĐT đã đổi → ' + newPhone,
          schedules:'', schedGoi:'', schedGoiNote:'', schedSP:'', schedSPNote:'',
          schedCS:'', schedCSNote:'', schedHen:'', schedHenNote:''
        }})
      });
    } catch(e) {}
    logAudit('phone', newPhone, oldPhone, newPhone);
    toast('✓ Đã đổi SĐT: ' + oldPhone + ' → ' + newPhone);
  } else {
    toast('✓ Đã đổi SĐT: ' + oldPhone + ' → ' + newPhone + ' (local)');
  }

  // 8. Mở lại detail panel với số mới
  currentPhone = newPhone;
  openDp(newPhone);
}

// ═══════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════
function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-list').style.display = tab==='list'?'flex':'none';
  document.getElementById('tab-schedule').style.display = tab==='schedule'?'flex':'none';
  document.getElementById('tab-overdue').style.display = tab==='overdue'?'flex':'none';
  document.getElementById('tab-task').style.display = tab==='task'?'flex':'none';
  if (tab==='schedule') renderScheduleTab();
  if (tab==='overdue') renderOverdueTab();
  if (tab==='task') loadTasks();
}

// ═══════════════════════════════════════════════════════
//  EXPORT + CLEAR
// ═══════════════════════════════════════════════════════
function exportCSV() {
  const q=s(document.getElementById('search-input').value).toLowerCase();
  const csFList=_csFilterList();
  let list=allCustomers.filter(c=>{
    if(currentTier!=='all'&&c.tier!==currentTier) return false;
    if(currentCare!=='all'&&c.careStatus!==currentCare) return false;
    // Lọc theo TRƯỜNG TỰ TẠO (sidebar) — khớp với đúng những gì đang lọc trên màn hình
    for (var _exCfId in currentCF) {
      if (((c.custom && c.custom[_exCfId]) || '') !== currentCF[_exCfId]) return false;
    }
    if(csFList.length){const cs=_buildCsSet_(c.orders, c.phone);const _aH=(typeof _assignAllIndex!=='undefined')?_assignAllIndex[c.phone]:null;const _match=csFList.some(csF=>_csModeMatch(cs.has(csF), !!(c.careCSSet&&c.careCSSet.has(csF)), _aH?_aH.has(csF):false));if(!_match) return false;}
    if(q&&!c.name.toLowerCase().includes(q)&&!c.phone.includes(q)&&!(c.cskhNameLower&&c.cskhNameLower.includes(q))) return false;
    return true;
  });
  const BOM='\uFEFF';
  const cfCols = (typeof CUSTOM_FIELDS !== 'undefined') ? CUSTOM_FIELDS : [];
  const hdr='Tên KH,Số điện thoại,Phân loại KH,'+FIELD_LABEL_CS+',Zalo,Số đơn,Doanh thu,Sản phẩm,Nguồn,CS phụ trách,Ghi chú'
    + (cfCols.length ? ',' + cfCols.map(f=>`"${f.label.replace(/"/g,'""')}"`).join(',') : '') + '\n';
  const rows=list.map(c=>{
    const base=[`"${c.name}"`,c.phone,c.tier,c.careStatus,c.zaloStatus,c.totalOrders,c.totalRevenue,`"${c.brands.join('; ')}"`,`"${c.sources.join('; ')}"`,`"${[..._buildCsSet_(c.orders, c.phone)].join('; ')}"`,`"${_latestNoteText(c.careNote)}"`];
    const cfVals = cfCols.map(f => `"${((c.custom && c.custom[f.id]) || '').toString().replace(/"/g,'""')}"`);
    return base.concat(cfVals).join(',');
  }).join('\n');
  const blob=new Blob([BOM+hdr+rows],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`OME_KH_${_ymd(new Date())}.csv`; a.click();
}

function clearData() {
  if(!confirm('Xóa toàn bộ dữ liệu Excel đã nạp?\n(Lịch hẹn và trạng thái CS được giữ lại)')) return;
  customerMap={}; allCustomers=[]; loadedFiles=[]; currentTier='all'; currentCare='all'; currentZalo='all'; currentBrand='all'; currentCF={}; currentCS='all';
  document.getElementById('data-view').style.display='none';
  document.getElementById('empty-view').style.display='flex';
  document.getElementById('clearbtn').style.display='none';
  document.getElementById('syncbtn').style.display='none';
  document.getElementById('pushbtn').style.display='none';
  var _fsb=document.getElementById('fullsyncbtn'); if(_fsb) _fsb.style.display='none';
  var _dpb=document.getElementById('dupbtn'); if(_dpb) _dpb.style.display='none';
  hide('sync-banner');
  txt('fstatus','Chưa có dữ liệu');
}

function _hangKeyOf_(rev){ rev = Number(rev) || 0; return rev >= 50000000 ? 'super' : rev >= 30000000 ? 'vip' : rev >= 15000000 ? 'tt' : 'thuong'; }
function hangBadge(k){
  const cls = { thuong:'bo', tt:'bt', vip:'bv', super:'bv' }[k] || 'bo';
  const st = k === 'super' ? ' style="background:#7c2d12;color:#fde68a;font-weight:700"' : '';
  return `<span class="badge ${cls}"${st}>${HANG_LABEL[k] || HANG_LABEL.thuong}</span>`;
}
// Tong doanh thu / tong don cua KH: CHI TINH THEO POS (yeu cau Duyen: 'doanh thu chi tinh duy nhat tren Pos') -- bo don hoan; KH khong co don Pos = 0.
// Chi khi GAS chua tra thong ke Pos (chua deploy ban moi / sheet Pos trong) moi tam dung tong don Base de man hinh khong ve 0 het.
function _custRev_(c){ if (!_posStatsOn) return c.orders.reduce((s,o)=>s+(o.revenue||0),0); const ps = donStatsByPhone[c.phone]; return ps ? (Number(ps.rev) || 0) : 0; }
function _custOrderCount_(c){ if (!_posStatsOn) return c.orders.length; const ps = donStatsByPhone[c.phone]; return ps ? (Number(ps.n) || 0) : 0; }
function tierBadge(tier) {
  const map={'VIP':'bv','Thân thiết':'bt','Tiềm năng':'bn','Chưa bán lại được':'bo'};
  return `<span class="badge ${map[tier]||'bo'}">${tier}</span>`;
}
function careBadge(st) {
  if(!st) return '<span class="badge bo">Chưa CS</span>';
  const map={'Chốt':'cs-chot','Phân vân/Tiềm năng':'cs-pv','Hẹn gọi lại sau':'cs-hen','Đang sd':'cs-sd','Đang tạm ngưng':'cs-ngung','Knm/Máy bận':'cs-knm','Kcnc/Không hiệu quả':'cs-kcnc'};
  // Hiện "Mẹ - Con" cho tình trạng đã chọn
  var label = careStatusFullLabel(st) || st;
  return `<span class="badge ${map[st]||'bo'}">${label}</span>`;
}
function custStatusBadge(st) {
  if(!st) return '';
  var label = custStatusFullLabel(st) || st;
  return `<span class="badge bo" style="background:var(--surface2);color:#6d28d9;border-color:var(--border);font-weight:500">${label}</span>`;
}
// Badge các TRƯỜNG TỰ TẠO có giá trị — hiện cạnh tên khách trong panel chi tiết
function cfBadges(phone) {
  if (typeof CUSTOM_FIELDS === 'undefined' || !CUSTOM_FIELDS.length) return '';
  var cust = ((typeof careData !== 'undefined' && careData[phone]) || {}).custom || {};
  return CUSTOM_FIELDS.map(function(f){
    var v = cust[f.id];
    if (!v) return '';
    return '<span class="cf-dp-badge"><span class="cf-dp-k">' + esc(f.label) + ':</span> ' + esc(v) + '</span>';
  }).join('');
}
function zaloBadge(st) {
  if(!st) return '<span class="badge bo">—</span>';
  const map={'Đã kết bạn':'zl-kb','Chưa kết bạn':'zl-chua','Chưa đồng ý':'zl-huy','Không nhận tn lạ':'zl-chua','Chặn':'zl-block','Hủy kết bạn':'zl-huy'};
  return `<span class="badge ${map[st]||'zl-chua'}">${st}</span>`;
}

// ═══════════════════════════════════════════════════════
//  SCHEDULE HELPERS
// ═══════════════════════════════════════════════════════
function nextSched(phone) {
  const today=_ymd(new Date());
  return schedules.filter(x=>x.phone===phone&&!x.done&&x.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
}
function isOverdue(it) { return it.date<_ymd(new Date()); }
function schedTypeLabel(key, item) {
  if (item && item.customLabel) return item.customLabel;
  return (SCHED_TYPES.find(x=>x.key===key)||SCHED_TYPES[0]).label;
}

function _remDateStr(){ return _ymd(new Date()); }
function _remId(x){ return 'r:' + (x.id || (x.phone+'|'+x.type+'|'+x.date)); }
function _remLoadDismissed(){ try { return JSON.parse(localStorage.getItem('ome_dismissed_remind')||'{}'); } catch(e){ return {}; } }
function _remSaveDismissed(d){ try { localStorage.setItem('ome_dismissed_remind', JSON.stringify(d)); } catch(e){} }
function _dismissReminder(id){ var d=_remLoadDismissed(); d[id]=_remDateStr(); _remSaveDismissed(d); renderReminderPanel(); }
function _dismissChiaAlert(id){ var d=_remLoadDismissed(); d[id]='off'; _remSaveDismissed(d); renderReminderPanel(); }
function dismissAllReminders(){ var d=_remLoadDismissed(); _dueReminders().forEach(function(r){ d[r.id]=_remDateStr(); }); _remSaveDismissed(d); renderReminderPanel(); }
function toggleReminderPanel(){ _reminderPanelOpen = !_reminderPanelOpen; renderReminderPanel(); }

// ── Người đặt lịch hẹn (theo tài khoản đăng nhập) ─────────────────
// Định danh duy nhất của tài khoản đang đăng nhập (để lọc riêng tư)
function _remAcctId(){
  if (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username)
    return String(_authAccount.username).trim().toLowerCase();
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.name)
    return String(currentUser.name).trim().toLowerCase();
  return '';
}
// Tên hiển thị của người đặt (để in lên thẻ nhắc hẹn) — ưu tiên tên tài khoản đăng nhập
function _remAcctName(){
  if (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.name)
    return _authAccount.name;
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.name)
    return currentUser.name;
  return 'Admin';
}
// Dấu "người đặt" gắn vào mỗi lịch khi tạo
function _remOwnerStamp(){ return { owner: _remAcctName(), ownerUser: _remAcctId() }; }
// Lịch này có thông tin người đặt chưa? (dữ liệu cũ trước bản v9.7 thì chưa có)
function _remHasOwner(x){ return !!(x && (x.ownerUser || x.owner)); }
// Lịch này có phải do tài khoản hiện tại đặt không?
//   true  = đúng của mình   |   false = của người khác   |   null = lịch cũ chưa gắn người đặt
function _remOwnedByMe(x){
  if (!_remHasOwner(x)) return null;
  var me = _remAcctId();
  if (x.ownerUser) return String(x.ownerUser).trim().toLowerCase() === me;
  var myName = (typeof currentUser!=='undefined' && currentUser && currentUser.name) ? String(currentUser.name).trim().toLowerCase() : '';
  return String(x.owner).trim().toLowerCase() === myName;
}

// Lịch hẹn đến hạn / quá hạn (chưa hoàn thành), CHỈ của tài khoản đang đăng nhập, chưa tắt hôm nay
function _dueReminders(){
  if (typeof schedules === 'undefined') return [];
  var today = _remDateStr(); var dism = _remLoadDismissed(); var out = [];
  var seen = new Set(); // tránh trùng lặp phone+type+date

  // 1. Từ mảng schedules[] — chỉ hiện lịch do CHÍNH tài khoản đang đăng nhập đặt
  for (var i=0;i<schedules.length;i++){
    var x = schedules[i];
    if (!x || x.done || !x.date || x.date > today) continue;
    var id = _remId(x);
    var key = x.phone+'|'+x.type+'|'+x.date;
    seen.add(key); // luôn đánh dấu để careData không hiện lặp lại lịch này
    var mine = _remOwnedByMe(x);
    if (mine === false) continue;                 // lịch của tài khoản khác → ẩn
    if (dism[id] === today) continue;             // đã tắt hôm nay
    var c = (typeof customerMap!=='undefined' && customerMap[x.phone]) ||
            (typeof _customerByPhone==='function' ? _customerByPhone(x.phone) : null);
    // Lịch cũ chưa gắn người đặt (mine === null) → giữ logic phân quyền theo vai trò như trước
    if (mine === null && c && typeof _inUserScope==='function' && !_inUserScope(c)) continue;
    out.push({ id:id, phone:x.phone, type:x.type, date:x.date, note:x.note||'', name: c?c.name:x.phone, schedId: x.id, owner: x.owner||'', ownerUser: x.ownerUser||'', customLabel: x.customLabel||'' });
  }

  // 2. Từ careData quick-sched (schedGoi/SP/CS/Hen) — chỉ nếu có ngày và đến hạn
  var careFieldMap = [
    {field:'schedGoi',   noteField:'schedGoiNote',  type:'goi'},
    {field:'schedSP',    noteField:'schedSPNote',   type:'sp'},
    {field:'schedCS',    noteField:'schedCSNote',   type:'cs'},
    {field:'schedHen',   noteField:'schedHenNote',  type:'hen'},
  ];
  if (typeof careData !== 'undefined') {
    var phones = Object.keys(careData);
    for (var pi=0;pi<phones.length;pi++){
      var ph = phones[pi];
      var care = careData[ph];
      if (!care) continue;
      // TOI UU 2026-10-10: kiem tra NGAY DEN HAN truoc, chi khi co lich den han moi tra khach + phan quyen.
      // Truoc day moi SDT trong careData deu goi allCustomers.find (O(136k)) + _inUserScope -> renderReminderPanel (chay sau MOI applyFilters) rat nang.
      var _anyDue = false;
      for (var _fj=0;_fj<careFieldMap.length;_fj++){ var _dd = care[careFieldMap[_fj].field]; if (_dd && _dd <= today){ _anyDue = true; break; } }
      if (!_anyDue) continue;
      var cc = (typeof customerMap!=='undefined' && customerMap[ph]) ||
               (typeof _customerByPhone==='function' ? _customerByPhone(ph) : null);
      if (cc && typeof _inUserScope==='function' && !_inUserScope(cc)) continue;
      for (var fi=0;fi<careFieldMap.length;fi++){
        var fm = careFieldMap[fi];
        var d = care[fm.field];
        if (!d || d > today) continue;
        var key2 = ph+'|'+fm.type+'|'+d;
        if (seen.has(key2)) continue; // já coberto pelo schedules[]
        var cid = 'care:'+ph+'|'+fm.field+'|'+d;
        if (dism[cid] === today) continue;
        seen.add(key2);
        out.push({ id:cid, phone:ph, type:fm.type, date:d, note:care[fm.noteField]||'', name: cc?cc.name:ph, careField: fm.field, owner:'', ownerUser:'' });
      }
    }
  }
  return out.sort(function(a,b){ return a.date.localeCompare(b.date); });
}

// Xóa VĨNH VIỄN toàn bộ nhắc hẹn đang QUÁ HẠN đang hiện trong panel (cả 2 nguồn: mảng
// schedules[] cục bộ VÀ các ô hẹn nhanh trong careData dùng chung — schedGoi/SP/CS/Hen).
// Khác với "Tắt hết" (chỉ ẩn tạm trong ngày, mai lại hiện) — hành động này xóa hẳn, đồng bộ
// lên GAS luôn để các trình duyệt/tài khoản khác cũng không còn thấy lại.
function deleteAllOverdueReminders(){
  var today = _remDateStr();
  var overdue = _dueReminders().filter(function(rm){ return rm.date < today; });
  if (!overdue.length){ toast('Không có nhắc hẹn quá hạn nào.'); return; }
  if (!confirm('Xóa VĨNH VIỄN toàn bộ ' + overdue.length + ' nhắc hẹn quá hạn?\nHành động này không thể hoàn tác.')) return;

  var careChanged = {};
  var daoDelSet = loadLS('ome_dao_deleted') || {};
  var daoChanged = false;

  overdue.forEach(function(rm){
    if (rm.careField) {
      // Nguồn: careData quick-sched (schedGoi/schedSP/schedCS/schedHen)
      var care = careData[rm.phone];
      if (care && care[rm.careField] === rm.date) {
        care[rm.careField] = '';
        care[rm.careField + 'Note'] = '';
        careChanged[rm.phone] = true;
      }
    } else if (rm.schedId) {
      // Nguồn: mảng schedules[] cục bộ
      var it = schedules.find(function(x){ return x.id === rm.schedId; });
      // Nếu là mốc auto Data Đảo → ghi nhớ đã xóa tay, tránh checkDataDaoRenewSchedules() tạo lại
      if (it && it.autoDao) { daoDelSet[it.id] = true; daoChanged = true; }
      schedules = schedules.filter(function(x){ return x.id !== rm.schedId; });
    }
  });

  saveLS('ome_care', careData);
  saveLS('ome_sched', schedules);
  saveLS('ome_schedules', schedules);
  if (daoChanged) saveLS('ome_dao_deleted', daoDelSet);

  // Lịch "Hẹn" (schedHen) có thể vẫn cần dọn thêm nếu nó từng trỏ vào 1 mốc auto vừa bị xóa
  try { if (typeof syncAutoHenToCareData==='function') syncAutoHenToCareData(); } catch(e){}

  // Đẩy các khách có careData bị sửa trực tiếp ở trên lên GAS (batch)
  if (typeof queueCareSync === 'function') {
    Object.keys(careChanged).forEach(function(p){ queueCareSync(p); });
  }

  updateSchedBadges();
  renderReminderPanel();
  if (typeof renderScheduleTab === 'function') renderScheduleTab();
  if (typeof renderOverdueTab === 'function') renderOverdueTab();
  // Làm mới panel chi tiết nếu khách đang mở nằm trong số vừa bị xóa (tránh hiện ngày cũ)
  if (typeof currentPhone !== 'undefined' && currentPhone) {
    var _touchedPhones = overdue.map(function(rm){ return rm.phone; });
    if (_touchedPhones.indexOf(currentPhone) !== -1) _refreshOpenDpTab(currentPhone);
  }
  toast('✓ Đã xóa vĩnh viễn ' + overdue.length + ' nhắc hẹn quá hạn');
}
// Cảnh báo "được chia data" cho CS hiện tại (tắt là tắt luôn)
function _chiaDataAlerts(){
  if (typeof currentUser==='undefined' || !currentUser || currentUser.role==='admin') return [];
  if (typeof assignHistory==='undefined' || !assignHistory) return [];
  var dism = _remLoadDismissed(); var me = currentUser.name; var out = [];
  for (var i=0;i<assignHistory.length;i++){
    var h = assignHistory[i];
    if (!h || h.csName !== me) continue;
    var id = 'a:' + h.id;
    if (dism[id] === 'off') continue;
    out.push({ id:id, label: h.label || ('Chia '+((h.phones&&h.phones.length)||0)+' KH'), count: (h.phones&&h.phones.length)||0, date: h.date||'' });
  }
  return out.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).slice(0,3);
}
function goMyData(){ if (typeof switchTab==='function'){ var el=document.querySelector('[onclick*="mydata"]'); switchTab('mydata', el); } }

function renderReminderPanel(){
  var wrap = document.getElementById('reminder-panel');
  var bell = document.getElementById('reminder-bell');
  if (!wrap) return;
  var reminders = _dueReminders();
  var alerts = _chiaDataAlerts();
  var total = reminders.length + alerts.length;
  if (total === 0){ wrap.style.display='none'; if(bell) bell.style.display='none'; return; }
  if (!_reminderPanelOpen){
    wrap.style.display='none';
    if (bell){ bell.style.display='flex'; var bc=bell.querySelector('.rb-count'); if(bc) bc.textContent=total; }
    return;
  }
  if (bell) bell.style.display='none';
  var isAdminRP = (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin');
  var html = '<div class="rp-hdr"><span>🔔 Nhắc hẹn ('+total+')</span><div>'+
    (isAdminRP ? '<button class="rp-hbtn" style="background:#b91c1c" title="Xóa vĩnh viễn toàn bộ nhắc hẹn quá hạn (không thể hoàn tác)" onclick="deleteAllOverdueReminders()">🗑 Xóa quá hạn</button>' : '') +
    '<button class="rp-hbtn" title="Tắt hết hôm nay" onclick="dismissAllReminders()">Tắt hết</button>'+
    '<button class="rp-hbtn" title="Thu gọn" onclick="toggleReminderPanel()">▾</button></div></div><div class="rp-body">';
  for (var a=0;a<alerts.length;a++){
    var al = alerts[a];
    html += '<div class="rp-card rp-chia"><div class="rp-card-main" onclick="goMyData()">'+
      '<div class="rp-type" style="background:#0891b2">📋 Được chia data</div>'+
      '<div class="rp-cust">'+esc(al.label)+'</div>'+
      '<div class="rp-note">'+al.count+' khách · '+(al.date||'').slice(0,10)+'</div></div>'+
      '<button class="rp-dismiss" title="Tắt" onclick="event.stopPropagation();_dismissChiaAlert(\''+al.id+'\')">✕</button></div>';
  }
  for (var r=0;r<reminders.length;r++){
    var rm = reminders[r];
    var over = rm.date < _remDateStr();
    var st = (typeof SCHED_TYPES!=='undefined') ? (SCHED_TYPES.find(function(t){return t.key===rm.type;})||SCHED_TYPES[0]) : {label:rm.type,color:'#2563eb'};
    var typeLabel = (rm.customLabel) ? rm.customLabel : st.label;
    var cardClass = rm.type==='birthday' ? 'rp-card rp-bday' : (rm.type==='custom'&&rm.customLabel ? 'rp-card rp-custom' : 'rp-card');
    var doneAction = rm.careField
      ? 'event.stopPropagation();markCareSchedDone(this.dataset.phone,\''+rm.careField+'\')'
      : (rm.schedId ? 'event.stopPropagation();markDone(\''+rm.schedId+'\')' : 'event.stopPropagation();_dismissReminder(\''+rm.id+'\')');
    html += '<div class="'+cardClass+'"><div class="rp-card-main" data-phone="'+esc(rm.phone)+'" onclick="openDp(this.dataset.phone)">'+
      '<div class="rp-type" style="background:'+st.color+'">'+esc(typeLabel)+'</div>'+
      '<div class="rp-cust">'+esc(rm.name)+'</div>'+
      '<div class="rp-note" style="color:'+(over?'var(--red)':'var(--muted)')+'">'+(over?'⚠ Quá hạn · ':'📅 ')+fmtDate(rm.date)+(rm.note?(' · '+esc(rm.note)):'')+'</div>'+
      (rm.owner?('<div class="rp-owner">👤 '+esc(rm.owner)+'</div>'):'')+'</div>'+
      '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">'+
      '<button class="rp-hbtn" style="background:var(--green);color:#fff;font-size:10px;padding:2px 7px" data-phone="'+esc(rm.phone)+'" title="Đánh dấu hoàn thành" onclick="'+doneAction+'">✓ Done</button>'+
      '<button class="rp-dismiss" title="Tắt hôm nay" onclick="event.stopPropagation();_dismissReminder(\''+rm.id+'\')">✕</button>'+
      '</div></div>';
  }
  html += '</div>';
  wrap.innerHTML = html;
  wrap.style.display = 'flex';
}
function startReminderChecks(){
  renderReminderPanel();
  if (_reminderTimer) clearInterval(_reminderTimer);
  _reminderTimer = setInterval(renderReminderPanel, 60000);   // làm mới mỗi phút
}

// ── AUTO-SYNC 2 chiều: Sasum ↔ Zalo AI extension ──
// Da dung autoSyncLoop() + syncFromGS() (khai bao phia duoi) — kéo đủ birthday,
// khStatus, nickZalos moi 3 giay va tu refresh panel dang mo. Khong khai bao
// them _autoSyncTimer o day (trung ten voi khoi duoi -> SyntaxError chet toan app).

// ═══════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════
function s(v){return v===null||v===undefined?'':v.toString().trim();}
function parseNum(v){if(!v&&v!==0) return 0;const n=parseFloat(v.toString().replace(/[^\d.-]/g,''));return isNaN(n)?0:n;}
// Chuẩn hoá doanh thu: một số đơn lưu ở đơn vị NGHÌN (vd 948 = 948.000đ).
// Quy ước: doanh thu > 0 và < 1000 thì ×1000 (đơn dưới 1.000đ là không thực tế).
function _normRev(v){ var n = parseNum(v); if (n > 0 && n < 1000) n = n * 1000; return n; }
function parseYear(v){if(v===null||v===undefined) return null;const n=parseFloat(v.toString());return isNaN(n)?null:(n<100?n:n-2000);}
function parseVNDate_(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  var s = String(val).trim();
  if (!s) return null;
  var datePart = s.split(' ')[0];
  var m = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (y < 100) y += 2000;
  var dt = new Date(Date.UTC(y, mo - 1, d) - VN_OFFSET_MS_);
  return isNaN(dt.getTime()) ? null : dt;
}
function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return isNaN(v)?null:v;
  const str = v.toString();
  // try "M/D/YYYY, H:MM AM" format (Notion export)
  const d1 = new Date(str);
  if(!isNaN(d1)) return d1;
  const m=str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(m){const yr=parseInt(m[3]);return new Date(yr<100?2000+yr:yr,parseInt(m[2])-1,parseInt(m[1]));}
  return null;
}
function _stripHonorific(s){ return s.replace(/^(anh|chị|chi|ông|ong|bà|ba|em|c|a)(?=[\s:.]|$)\s*[:.]?\s*/i, '').trim(); }
function _truncateAtAddressOrDigit(s){
  var digitIdx = s.search(/\d/);
  var kwMatch = s.match(NAME_ADDR_KEYWORDS_RE);
  var kwIdx = kwMatch ? kwMatch.index : -1;
  var cut = -1;
  if (digitIdx >= 0 && kwIdx >= 0) cut = Math.min(digitIdx, kwIdx);
  else if (digitIdx >= 0) cut = digitIdx;
  else if (kwIdx >= 0) cut = kwIdx;
  if (cut >= 0) s = s.substring(0, cut);
  return s.trim();
}
function _isPlausibleName(s){
  if (!s) return false;
  s = s.trim();
  if (s.length < 2 || s.length > 40) return false;
  if (!NAME_ALLOWED_CHARS_RE.test(s)) return false;
  if (s.split(/\s+/).length > 5) return false;
  return true;
}
// Tra ve TAT CA ten "ung vien" hop le tim duoc trong 1 doan text don hang, thu 2 cach:
// (A) dau dong, cat truoc so/tu khoa dia chi dau tien (bat truong hop "Ten Sdt Dia chi...")
// (B) doan ngay SAU so dien thoai, truoc chu "Nhắn" (bat truong hop "...Sdt Ten Nhắn...")
function _guessNameCandidatesFromOrderText(text, phoneDigits){
  var out = [];
  if (!text) return out;
  var raw = String(text);
  var firstLine = raw.split('\n')[0].trim();
  if (firstLine && !NAME_MERGE_LABEL_RE.test(firstLine)) {
    var a = firstLine.replace(/(\+?84|0)\d{8,10}/g, '');
    a = _stripHonorific(a);
    a = a.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '');
    a = _truncateAtAddressOrDigit(a);
    if (_isPlausibleName(a)) out.push(a);
  }
  if (phoneDigits) {
    var idx = raw.indexOf(phoneDigits);
    if (idx >= 0) {
      var after = raw.substring(idx + phoneDigits.length);
      var nhanMatch = after.match(/nh[ắaằ]n\b/i);
      var seg = nhanMatch ? after.substring(0, nhanMatch.index) : after.substring(0, 40);
      seg = _stripHonorific(seg.trim());
      seg = seg.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '');
      seg = _truncateAtAddressOrDigit(seg);
      if (_isPlausibleName(seg)) out.push(seg);
    }
  }
  return out;
}
// Quet TAT CA don cua 1 sdt, gom ung vien ten tu tung don, lay ten xuat hien NHIEU LAN NHAT
// (thay vi chi lay don dau tien tim thay — de tranh vo tinh chon phai don khong co ten/co
// nhan gop don ma bo qua cac don khac cua cung khach da co ten ro rang).
function _guessNameForPhone(orders, phoneDigits){
  var freq = {}, bestKey = null;
  for (var i = 0; i < orders.length; i++) {
    var cands = _guessNameCandidatesFromOrderText(orders[i].product, phoneDigits);
    for (var j = 0; j < cands.length; j++) {
      var key = cands[j].toLowerCase();
      if (!freq[key]) freq[key] = { count: 0, sample: cands[j] };
      freq[key].count++;
      if (!bestKey || freq[key].count > freq[bestKey].count) bestKey = key;
    }
  }
  return bestKey ? freq[bestKey].sample : '';
}
function normPhone(v){
  if(!v) return null;
  const s=v.toString().replace(/\D/g,'');
  if(s.length<8) return null;
  if(s.startsWith('84')&&s.length===11) return '0'+s.slice(2);
  if(s.startsWith('84')&&s.length===12) return '0'+s.slice(2);
  // Số 9 chữ số bắt đầu bằng đầu số VN (3,5,7,8,9) → thêm 0 đầu (Excel/GSheets tự xóa số 0)
  if(s.length===9 && /^[35789]/.test(s)) return '0'+s;
  return s.slice(-10)||s;
}
// SĐT di động Việt Nam HỢP LỆ (dùng cho Chia data thủ công + tự động): 10 số, 0 + đầu số nhà mạng
// 03[2-9] | 05[2,6,8,9] | 07[0,6-9] | 08[1-9] | 09x. Chấp nhận dạng 84xxxxxxxxx / +84... / thiếu số 0 đầu (9 số).
// KHÔNG nhận: số bàn (02x), số nước ngoài, quá ngắn/dài, đầu số không có thật. Cùng logic với isValidVnPhone_ ở gas_v13.js.
function isValidVnPhone(p){
  var s = String(p == null ? '' : p).replace(/\D/g, '');
  if (s.length === 11 && s.indexOf('84') === 0) s = '0' + s.slice(2);
  else if (s.length === 9 && /^[35789]/.test(s)) s = '0' + s;
  return /^0(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9\d)\d{7}$/.test(s);
}
function guessProduct(detail){
  if(!detail) return '';
  const map=[
    ['W15','WELLIT'],['Dear','DEARGLAM'],['Make9','MAKE 9'],['Make9','MAKE9'],
    ['Cafe','CAFE'],['RSAB','RSAB'],['Vi kim','VI KIM'],['April','APRIL'],
    ['Trà','TRÀ'],['More','MORE'],['Lv','LV'],['W5','WEL'],
  ];
  const up=detail.toUpperCase();
  for(const[name,kw] of map){if(up.includes(kw.toUpperCase())) return name;}
  return '';
}
function formatDate(d,yr,mo){
  if(d instanceof Date&&!isNaN(d)) return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
  if(yr){const y=yr<100?2000+yr:yr;return mo?`${String(mo).padStart(2,'0')}/${y}`:`${y}`;}
  return '—';
}
function fmtDate(ds){
  if(!ds) return '—';
  // Phòng dữ liệu ngày cũ bị hỏng định dạng (vd chuỗi ISO đã có sẵn 'T...'/khoảng trắng)
  // — chỉ lấy đúng phần YYYY-MM-DD trước khi ghép thêm giờ, tránh ra "Invalid Date".
  var datePart = String(ds).split(/[T ]/)[0];
  var d = new Date(datePart+'T00:00:00');
  if (isNaN(d)) return String(ds); // vẫn không parse được → hiện nguyên văn thay vì "Invalid Date"
  return d.toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'});
}
function _ptsFold_(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase(); }
function _ptsNum_(str){
  str = String(str||'').replace(/[.,]+$/,'');
  if (/^\d{1,3}([.,]\d{3})+$/.test(str)) return parseFloat(str.replace(/[.,]/g,''));
  return parseFloat(str.replace(',', '.')) || 0;
}
// Số điểm đã tiêu ghi trong ghi chú đơn (cộng dồn nếu ghi nhiều lần). 50k / 50 điểm / 50.000đ / 50000 đều = 50 điểm.
function _ptsSpentFromNote_(note){
  var t = _ptsFold_(note), re = /tich\s*diem\s*[:\-]?\s*(?:(?:tieu|dung|tru|su dung)\s*)?(\d[\d.,]*)\s*(k|nghin|ngan|diem|dd|d|vnd)?(?![a-z])/g, m, sum = 0;
  while ((m = re.exec(t))){
    var v = _ptsNum_(m[1]), u = m[2] || '';
    if (u === 'k' || u === 'nghin' || u === 'ngan' || u === 'diem') sum += v;
    else sum += v >= 1000 ? v / PTS_VALUE : v;
  }
  return Math.round(sum * 100) / 100;
}
function _ptsOfCustomer_(c){
  var earned = 0, spent = 0, per = new Map();
  (c.orders || []).forEach(function(o){
    var e = Math.floor((Number(o.revenue) || 0) * PTS_RATE / PTS_VALUE), sp = _ptsSpentFromNote_(o.note);
    earned += e; spent += sp; per.set(o, { earn: e, spent: sp });
  });
  return { earned: earned, spent: spent, left: Math.round((earned - spent) * 100) / 100, per: per };
}
function _ptsBoxHtml_(p){
  var n = function(v){ return (Math.round(v * 100) / 100).toLocaleString('vi-VN'); };
  var neg = p.left < 0;
  return '<div style="margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--tn-bg,#fff7ed);border:1px solid var(--tn-b,#fed7aa)">' +
    '<div style="font-size:12px;font-weight:700;margin-bottom:6px">🎁 Tích điểm</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px">' +
      '<div><div style="color:var(--muted);font-size:10.5px">Đã tích</div><b style="color:var(--green)">+' + n(p.earned) + ' điểm</b></div>' +
      '<div><div style="color:var(--muted);font-size:10.5px">Đã tiêu</div><b style="color:#b91c1c">−' + n(p.spent) + ' điểm</b></div>' +
      '<div><div style="color:var(--muted);font-size:10.5px">Còn lại</div><b style="font-size:14px;color:' + (neg ? '#b91c1c' : 'var(--text)') + '">' + n(p.left) + ' điểm</b> <span style="color:var(--muted)">(≈ ' + n(p.left) + 'k)</span></div>' +
    '</div>' +
    (neg ? '<div style="margin-top:6px;font-size:11px;color:#b91c1c">⚠ Điểm đã tiêu lớn hơn điểm đã tích — kiểm tra lại ghi chú đơn.</div>' : '') +
    '<div style="margin-top:6px;font-size:10.5px;color:var(--hint);line-height:1.5">1% giá trị đơn = điểm (1 điểm = 1.000đ). Điểm tiêu lấy từ ghi chú đơn dạng <b>"Tích điểm: tiêu 50k"</b>.</div>' +
  '</div>';
}
function fmtVND(n){
  if(!n) return '0đ';
  if(n>=1e9) return (n/1e9).toFixed(2)+' tỷ';
  if(n>=1e6) return Math.round(n/1e3).toLocaleString('vi-VN')+'k';
  return n.toLocaleString('vi-VN')+'đ';
}
function fmt(n){return (n||0).toLocaleString('vi-VN');}
function esc(s){return(s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function txt(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function show(id){const el=document.getElementById(id);if(el)el.style.display='';}
function hide(id){const el=document.getElementById(id);if(el)el.style.display='none';}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}
function loadLS(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch{return null;}}
function saveLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

function toggleCol(col, cb) {
  colVisible[col] = cb.checked;
  saveLS('ome_col_visible', colVisible);
  reapplyColVisibility();
  _pushColVisibleForAccount();
}
// ── Cột hiển thị: lưu theo TÀI KHOẢN đăng nhập (không chỉ theo trình duyệt/máy) —
// mỗi sale tự bật/tắt cột muốn xem, lần đăng nhập sau (kể cả trên máy khác) vẫn
// hiện đúng như lần trước, không cần bấm lại. ──
function _colVisAcctKey(){
  var u = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) ? String(_authAccount.username).trim().toLowerCase() : '';
  return u ? ('colVisible::' + u) : '';
}
async function _pullColVisibleForAccount(){
  var key = _colVisAcctKey();
  if (!key || !gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSetting&key=' + encodeURIComponent(key), {redirect:'follow'});
    var d = await r.json();
    if (d && d.value) {
      var saved = null;
      try { saved = JSON.parse(d.value); } catch(e) { saved = null; }
      if (saved && typeof saved === 'object') {
        Object.assign(colVisible, saved);
        saveLS('ome_col_visible', colVisible);
        reapplyColVisibility();
      }
    }
  } catch(e) { console.warn('_pullColVisibleForAccount lỗi:', e.message); }
}
function _pushColVisibleForAccount(){
  var key = _colVisAcctKey();
  if (!key || !gsUrl) return;
  fetch(gsUrl, { method:'POST', redirect:'follow',
    body: JSON.stringify({ action:'setSetting', key: key, value: JSON.stringify(colVisible) }) }).catch(function(){});
}
function reapplyColVisibility() {
  for (const [col, vis] of Object.entries(colVisible)) {
    const display = vis ? '' : 'none';
    document.querySelectorAll(`.col-${col}`).forEach(el => el.style.display = display);
  }
  // Sync checkbox states với colVisible đã load từ localStorage
  document.querySelectorAll('#col-toggle-bar input[type=checkbox]').forEach(cb => {
    const col = cb.getAttribute('onchange')?.match(/toggleCol\('(\w+)'/)?.[1];
    if (col && col in colVisible) cb.checked = colVisible[col];
  });
}

function _tabVisAcctKey(){
  var u = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) ? String(_authAccount.username).trim().toLowerCase() : '';
  return u ? ('tabVisible::' + u) : '';
}
async function _pullTabVisibleForAccount(){
  var key = _tabVisAcctKey();
  if (!key || !gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSetting&key=' + encodeURIComponent(key), {redirect:'follow'});
    var d = await r.json();
    if (d && d.value) {
      var saved = null;
      try { saved = JSON.parse(d.value); } catch(e) { saved = null; }
      if (saved && typeof saved === 'object') {
        Object.assign(tabVisible, saved);
        saveLS('ome_tab_visible', tabVisible);
      }
    }
  } catch(e) { console.warn('_pullTabVisibleForAccount lỗi:', e.message); }
}
function _pushTabVisibleForAccount(){
  var key = _tabVisAcctKey();
  if (!key || !gsUrl) return;
  fetch(gsUrl, { method:'POST', redirect:'follow',
    body: JSON.stringify({ action:'setSetting', key: key, value: JSON.stringify(tabVisible) }) }).catch(function(){});
}
function openTabCustomizeModal(){
  var defs = [
    { id:'dashboard',   label:'📊 Dashboard' },
    { id:'team',        label:'👥 Quản lý Team' },
    { id:'audit',       label:'🧾 Nhật ký' },
    { id:'salesreport', label:'📈 Báo cáo doanh số' },
    { id:'pancake',     label:'📥 Báo cáo Pancake' },
    { id:'kpipancake',  label:'📈 KPI Pancake' },
    { id:'mktchecklist',label:'✅ Checklist MKT' },
    { id:'dailybrief',  label:'🎯 Báo cáo ngày' },
    { id:'uploaddata',  label:'📤 Up dữ liệu' }
  ];
  var rows = defs.map(function(d){
    return '<label style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer">'+
      '<input type="checkbox" '+(tabVisible[d.id]!==false?'checked':'')+' onchange="tabVisible[\''+d.id+'\']=this.checked">'+
      '<span>'+d.label+'</span></label>';
  }).join('');
  var box = document.createElement('div');
  box.id = 'tab-customize-overlay';
  box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:900;display:flex;align-items:center;justify-content:center';
  box.innerHTML = '<div style="background:var(--surface);border-radius:var(--rlg);padding:18px 20px;width:320px;max-width:92vw;max-height:80vh;overflow:auto">'+
    '<div style="font-weight:700;font-size:15px;margin-bottom:4px">⚙ Tuỳ chỉnh tab hiển thị</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Bỏ tích tab nào để ẩn khỏi thanh của riêng bạn — người khác không bị ảnh hưởng.</div>'+
    rows +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+
      '<button class="btn" onclick="document.getElementById(\'tab-customize-overlay\').remove()">Huỷ</button>'+
      '<button class="btn primary" onclick="_saveTabCustomize_()">Lưu & tải lại</button>'+
    '</div></div>';
  box.addEventListener('click', function(e){ if (e.target===box) box.remove(); });
  document.body.appendChild(box);
}
function _saveTabCustomize_(){
  saveLS('ome_tab_visible', tabVisible);
  _pushTabVisibleForAccount();
  location.reload();
}

// true = tài khoản đang đăng nhập được phép thấy tab id này. perms null/rỗng = KHÔNG giới
// hạn (mặc định mọi tài khoản mới/cũ đều xem đủ như trước — Admin phải CHỦ ĐỘNG bật giới
// hạn thì mới thu hẹp lại).
function _tabAllowedForUser(id){
  if (!currentUser || currentUser.role === 'admin') return true;
  if (!currentUser.perms || !currentUser.perms.length) return true;
  return currentUser.perms.indexOf(id) !== -1;
}
// Ẩn hẳn (display:none) các tab bị Admin giới hạn — chạy sau khi currentUser.perms đã có
// (đăng nhập xong / mở app xong), áp dụng cho CẢ 6 tab tĩnh lẫn các tab tạo động qua defs.
// Nếu tab đang active bị ẩn (VD Admin vừa giới hạn ngay lúc đang xem) thì tự chuyển về
// "Danh sách KH" để tránh màn hình trắng.
function _applyUserTabPermissions(){
  var hidActive = false;
  _PERM_TAB_DEFS.forEach(function(d){
    var el = document.querySelector('[data-bar-id="'+d.id+'"]');
    if (!el) return;
    if (_tabAllowedForUser(d.id)) { el.style.display = ''; }
    else { if (el.classList.contains('active')) hidActive = true; el.style.display = 'none'; }
  });
  // Nhóm "📊 Báo cáo ▾" gộp 4 tab con (salesreport/pancake/kpipancake/mktchecklist) — nếu cả 4
  // đều bị chặn thì ẩn luôn nút nhóm, tránh để lại 1 nút bấm ra menu rỗng gây khó hiểu.
  var grp = document.querySelector('[data-bar-id="reportsgroup"]');
  if (grp){
    var anyReportAllowed = ['salesreport','pancake','kpipancake','mktchecklist','dailybrief'].some(_tabAllowedForUser);
    grp.style.display = anyReportAllowed ? '' : 'none';
  }
  if (hidActive){
    var home = document.querySelector('[data-bar-id="tab-kh"]');
    if (home && typeof switchTab === 'function') switchTab('list', home);
  }
}

function _barMenuAcctKey(){
  var u = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.username) ? String(_authAccount.username).trim().toLowerCase() : '';
  return u ? ('barMenuItems::' + u) : '';
}
async function _pullBarMenuForAccount(){
  var key = _barMenuAcctKey();
  if (!key || !gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSetting&key=' + encodeURIComponent(key), {redirect:'follow'});
    var d = await r.json();
    if (d && d.value) {
      var saved = null;
      try { saved = JSON.parse(d.value); } catch(e) { saved = null; }
      if (Array.isArray(saved)) { _barMenuItems = saved; saveLS('ome_bar_menu_items', _barMenuItems); _applyBarCustomization(); }
    }
  } catch(e) { console.warn('_pullBarMenuForAccount lỗi:', e.message); }
}
function _pushBarMenuForAccount(){
  var key = _barMenuAcctKey();
  if (!key || !gsUrl) return;
  fetch(gsUrl, { method:'POST', redirect:'follow',
    body: JSON.stringify({ action:'setSetting', key: key, value: JSON.stringify(_barMenuItems) }) }).catch(function(){});
}

// Tạo (nếu chưa có) nút "☰ Menu" + khung sổ xuống dùng chung cho cả 2 thanh, trả về
// phần tử khung chứa (nơi các mục bị kéo vào sẽ được appendChild tới).
function _ensureBarMenuBtn(){
  var existing = document.getElementById('bar-menu-list');
  if (existing) return existing;
  var hdrR = document.querySelector('.hdr-r');
  if (!hdrR) return null;
  var wrap = document.createElement('div');
  wrap.id = 'bar-menu-wrap';
  wrap.style.cssText = 'position:relative;display:none'; // ẩn: thay bằng menu trái (js/29-sidenav.js)
  wrap.innerHTML = '<button class="btn sm" id="bar-menu-btn" title="Các mục bạn đã kéo vào đây" onclick="_toggleBarMenuDropdown()">☰ Menu</button>' +
    '<div id="bar-menu-list" style="display:none;position:absolute;top:110%;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--rmd);box-shadow:0 8px 24px rgba(0,0,0,.15);min-width:190px;z-index:950;padding:6px;"></div>';
  hdrR.appendChild(wrap);
  document.addEventListener('click', function(e){
    var list = document.getElementById('bar-menu-list'), btn = document.getElementById('bar-menu-btn');
    if (!list || !btn || list.style.display==='none') return;
    if (e.target===btn || btn.contains(e.target) || list.contains(e.target)) return;
    list.style.display = 'none';
  });
  return document.getElementById('bar-menu-list');
}
function _toggleBarMenuDropdown(){
  var list = document.getElementById('bar-menu-list');
  if (list) list.style.display = (list.style.display === 'none') ? 'block' : 'none';
}

// Đặt 1 phần tử [data-bar-id] về đúng "nhà" của nó: có data-bar-after thì chèn NGAY SAU phần
// tử được trỏ tới (vd luôn nằm cạnh "Lịch chăm sóc" dù kéo ra/vào ☰ Menu bao nhiêu lần); không
// có/không tìm thấy thì mới appendChild vào data-bar-home như cơ chế cũ.
function _barPlaceHome(el){
  var afterSel = el.getAttribute('data-bar-after');
  var afterEl = afterSel ? document.querySelector(afterSel) : null;
  if (afterEl && afterEl.parentNode){ afterEl.parentNode.insertBefore(el, afterEl.nextSibling); return; }
  var homeSel = el.getAttribute('data-bar-home');
  var home = homeSel ? document.querySelector(homeSel) : null;
  if (home) home.appendChild(el);
}

// Di chuyển đúng các phần tử [data-bar-id] đang nằm trong _barMenuItems vào khung "☰ Menu",
// và trả các phần tử KHÔNG còn trong danh sách về lại thanh gốc (data-bar-home). Một số nơi
// (VD header) render lại toàn bộ bằng innerHTML mỗi lần đổi trạng thái đăng nhập → có thể tạo
// ra 1 bản MỚI trùng id với bản đang nằm trong menu; hàm này dọn trùng trước khi sắp xếp.
function _applyBarCustomization(){
  var list = _ensureBarMenuBtn();
  if (!list) return;
  var byId = {};
  document.querySelectorAll('[data-bar-id]').forEach(function(el){
    var id = el.getAttribute('data-bar-id');
    (byId[id] = byId[id] || []).push(el);
  });
  Object.keys(byId).forEach(function(id){
    var els = byId[id];
    if (els.length <= 1) return;
    var keep = els.filter(function(el){ return el.parentNode !== list; })[0] || els[els.length - 1];
    els.forEach(function(el){ if (el !== keep) el.remove(); });
    byId[id] = [keep];
  });
  var btn = document.getElementById('bar-menu-btn');
  var count = 0;
  Object.keys(byId).forEach(function(id){
    var el = byId[id][0];
    // Đã có menu trái (js/29-sidenav.js) chứa MỌI mục nên bỏ cơ chế kéo vào "☰ Menu" cũ: luôn trả mục về chỗ gốc,
    // kể cả với tài khoản từng cấu hình _barMenuItems (cũ/kéo từ GAS) để không có tab nào bị giấu mất.
    var inMenu = false;
    if (inMenu) {
      if (el.parentNode !== list) list.appendChild(el);
      count++;
    } else if (el.parentNode === list) {
      _barPlaceHome(el);
      if (el.parentNode === list) list.removeChild(el); // khong tim duoc noi de ve -> danh phai bo khoi menu de khoi mat tich
    }
  });
  if (btn) btn.style.display = count ? '' : 'none';
}

function openBarCustomizeModal(){
  var shown  = _BAR_ITEM_DEFS.filter(function(d){ return _barMenuItems.indexOf(d.id) === -1; });
  var inMenu = _BAR_ITEM_DEFS.filter(function(d){ return _barMenuItems.indexOf(d.id) !== -1; });
  function rowHtml(d){
    return '<div class="bar-drag-item" draggable="true" data-id="'+d.id+'" ondragstart="_barDragStart(event)" '+
      'style="padding:7px 10px;margin:3px 0;border:1px solid var(--border);border-radius:8px;background:var(--surface2);cursor:grab;font-size:12.5px;">'+esc(d.label)+'</div>';
  }
  var box = document.createElement('div');
  box.id = 'bar-customize-overlay';
  box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:2900;display:flex;align-items:center;justify-content:center';
  box.innerHTML = '<div style="background:var(--surface);border-radius:var(--rlg);padding:18px 20px;width:560px;max-width:94vw;max-height:85vh;overflow:auto">'+
    '<div style="font-weight:700;font-size:15px;margin-bottom:4px">☰ Tuỳ chỉnh thanh menu</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:12px">Kéo mục từ bên trái sang phải để đưa vào "☰ Menu" — kéo ngược lại để đưa ra thanh gốc. Chỉ áp dụng cho tài khoản của riêng bạn.</div>'+
    '<div style="display:flex;gap:12px">'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-weight:600;font-size:12px;margin-bottom:6px;color:var(--muted)">Đang hiển thị trên thanh</div>'+
        '<div id="bar-col-shown" ondragover="event.preventDefault()" ondrop="_barDrop(event,false)" style="min-height:280px;border:1px dashed var(--border);border-radius:10px;padding:6px;">'+shown.map(rowHtml).join('')+'</div>'+
      '</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-weight:600;font-size:12px;margin-bottom:6px;color:var(--muted)">Trong "☰ Menu"</div>'+
        '<div id="bar-col-menu" ondragover="event.preventDefault()" ondrop="_barDrop(event,true)" style="min-height:280px;border:1px dashed var(--border);border-radius:10px;padding:6px;">'+inMenu.map(rowHtml).join('')+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">'+
      '<button class="btn" onclick="document.getElementById(\'bar-customize-overlay\').remove()">Huỷ</button>'+
      '<button class="btn primary" onclick="_saveBarCustomize_()">Lưu & tải lại</button>'+
    '</div></div>';
  box.addEventListener('click', function(e){ if (e.target===box) box.remove(); });
  document.body.appendChild(box);
}
function _barDragStart(e){ _barDragId = e.target.getAttribute('data-id'); e.dataTransfer.effectAllowed = 'move'; }
function _barDrop(e, toMenu){
  e.preventDefault();
  if (!_barDragId) return;
  var idx = _barMenuItems.indexOf(_barDragId);
  if (toMenu && idx === -1) _barMenuItems.push(_barDragId);
  if (!toMenu && idx !== -1) _barMenuItems.splice(idx, 1);
  _barDragId = null;
  var overlay = document.getElementById('bar-customize-overlay');
  if (overlay) overlay.remove();
  openBarCustomizeModal(); // vẽ lại 2 cột theo trạng thái mới, không cần tải lại trang
}
function _saveBarCustomize_(){
  saveLS('ome_bar_menu_items', _barMenuItems);
  _pushBarMenuForAccount();
  var overlay = document.getElementById('bar-customize-overlay');
  if (overlay) overlay.remove();
  _applyBarCustomization();
}


function toggleLastActSort() {
  _lastActSortDir = _lastActSortDir === 0 ? -1 : _lastActSortDir === -1 ? 1 : 0;
  const icon = document.getElementById('lastact-sort-icon');
  if (icon) icon.textContent = _lastActSortDir === -1 ? '↓' : _lastActSortDir === 1 ? '↑' : '↕';
  // Chỉ 1 cột dùng icon ↕ để sắp xếp tại 1 thời điểm — bật cột này thì tắt cột kia, tránh 2
  // chiều sắp xếp "ngầm" cùng tồn tại gây khó hiểu khi xem danh sách.
  if (_lastActSortDir !== 0) { _lastPosSortDir = 0; const i2 = document.getElementById('lastpos-sort-icon'); if (i2) i2.textContent = '↕'; }
  applyFilters();
}

function toggleLastPosSort() {
  _lastPosSortDir = _lastPosSortDir === 0 ? -1 : _lastPosSortDir === -1 ? 1 : 0;
  const icon = document.getElementById('lastpos-sort-icon');
  if (icon) icon.textContent = _lastPosSortDir === -1 ? '↓' : _lastPosSortDir === 1 ? '↑' : '↕';
  if (_lastPosSortDir !== 0) { _lastActSortDir = 0; const i2 = document.getElementById('lastact-sort-icon'); if (i2) i2.textContent = '↕'; }
  applyFilters();
}

// ═══════════════════════════════════════════════════════
//  COLUMN DROPDOWN FILTERS
// ═══════════════════════════════════════════════════════
function openColDropdown(col, e) {
  e.stopPropagation();
  const th = e.currentTarget;
  const rect = th.getBoundingClientRect();
  const dd = document.getElementById('col-dd-' + col);
  // Close others
  document.querySelectorAll('.col-dropdown').forEach(d=>{ if(d!==dd) d.classList.remove('open'); });
  if (dd.classList.contains('open')) { dd.classList.remove('open'); _colDdActive=null; return; }
  _colDdActive = col;
  // Position
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.classList.add('open');
  renderColDdItems(col, '');
}
function renderColDdItems(col, query) {
  const q = _foldVi(query);
  let values;
  if (col==='name') values = [...new Set(allCustomers.map(c=>c.name))].sort((a,b)=>a.localeCompare(b,'vi'));
  else if (col==='tier') values = ['VIP','Thân thiết','Tiềm năng','Chưa bán lại được'];
  else if (col==='hang') values = HANG_KEYS.map(k=>HANG_LABEL[k]);
  else if (col==='care') values = ['', ...CARE_STATUS];
  else if (col==='zalo') values = ['', ...ZALO_STATUS];
  else if (col==='product') values = ['', ...[...new Set(allCustomers.flatMap(c=>c.brands).filter(Boolean))].sort()];
  else if (col==='cs') values = [...new Set(allCustomers.flatMap(c=>[..._buildCsSet_(c.orders, c.phone),...(c.careCSSet||[])]).filter(Boolean))].sort();
  else if (col==='careCS') values = [...new Set(allCustomers.flatMap(c=>[...(c.careCSSet||[])]).filter(Boolean))].sort();
  else if (col==='source') values = [...new Set(allCustomers.flatMap(c=>c.sources).filter(Boolean))].sort();
  else if (col==='sched') values = ['Có lịch', 'Không có lịch', ...SCHED_TYPES.map(t=>t.label)];
  else if (col==='lastpos') values = ['Hôm nay', '≤ 7 ngày', '≤ 30 ngày', '≤ 90 ngày', '> 90 ngày', 'Chưa có đơn Pos', '__custom_daterange__'];
  else if (col==='lastact') values = ['Hôm nay', 'Hôm qua', '≤ 3 ngày', '≤ 7 ngày', '≤ 14 ngày', '≤ 30 ngày', '> 30 ngày', 'Chưa tác động', '__custom_range__'];
  else if (col==='tacdong') values = ['Trong 24h', 'Hôm nay', 'Hôm qua', '≤ 3 ngày', '≤ 7 ngày', '> 7 ngày', 'Chưa có'];
  else if (col==='bcstatus') values = ['Đã gửi', 'Gửi lỗi', 'Bỏ qua', 'Chưa gửi', 'Không trong chiến dịch'];
  else values = [];
  const filtered = values.filter(v=>_foldVi(v||'—').includes(q));
  const container = document.getElementById('col-dd-'+col+'-items');
  if (!container) return;
  container.innerHTML = filtered.map(v=>{
    if (v === '__custom_range__') {
      // Custom range UI for lastact
      const cur = [...(colFilters[col]||[])].find(x=>x&&x.startsWith('range:'));
      const parts = cur ? cur.replace('range:','').split('-') : ['',''];
      const from = parts[0]||'', to = parts[1]||'';
      return `<div class="col-dd-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:6px 10px;border-top:1px solid var(--border)">
        <span style="font-size:10px;font-weight:600;color:var(--hint);text-transform:uppercase;letter-spacing:.06em">Khoảng ngày tùy chỉnh</span>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--muted)">Từ</span>
          <input type="number" id="lastact-range-from" min="0" max="999" value="${from}" placeholder="0"
            style="width:54px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-size:11px;outline:none;text-align:center"
            oninput="applyLastActCustomRange()">
          <span style="font-size:11px;color:var(--muted)">đến</span>
          <input type="number" id="lastact-range-to" min="0" max="999" value="${to}" placeholder="999"
            style="width:54px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-size:11px;outline:none;text-align:center"
            oninput="applyLastActCustomRange()">
          <span style="font-size:11px;color:var(--muted)">ngày</span>
          <button onclick="clearLastActCustomRange()" style="border:none;background:var(--red-bg);color:var(--red);border-radius:4px;font-size:10px;padding:2px 6px;cursor:pointer">Xóa</button>
        </div>
        ${cur ? `<div style="font-size:10px;color:var(--green)">✓ Đang lọc: ${from||'0'} – ${to||'∞'} ngày</div>` : ''}
      </div>`;
    }
    if (v === '__custom_daterange__') {
      // Khoảng NGÀY THẬT (không phải số ngày trước) cho "Ngày mua gần nhất" — tự nhiên hơn vì
      // người dùng hay nghĩ theo mốc lịch (vd "từ 1/9 đến 20/9") khi lọc theo ngày mua.
      const cur = [...(colFilters[col]||[])].find(x=>x&&x.startsWith('daterange:'));
      const parts = cur ? cur.replace('daterange:','').split('_') : ['',''];
      const from = parts[0]||'', to = parts[1]||'';
      return `<div class="col-dd-item" style="flex-direction:column;align-items:flex-start;gap:4px;padding:6px 10px;border-top:1px solid var(--border)">
        <span style="font-size:10px;font-weight:600;color:var(--hint);text-transform:uppercase;letter-spacing:.06em">Khoảng thời gian tùy chỉnh</span>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--muted)">Từ</span>
          <input type="date" id="lastpos-range-from" value="${from}"
            style="padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-size:11px;outline:none"
            onchange="applyLastPosDateRange()">
          <span style="font-size:11px;color:var(--muted)">đến</span>
          <input type="date" id="lastpos-range-to" value="${to}"
            style="padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-size:11px;outline:none"
            onchange="applyLastPosDateRange()">
          <button onclick="clearLastPosDateRange()" style="border:none;background:var(--red-bg);color:var(--red);border-radius:4px;font-size:10px;padding:2px 6px;cursor:pointer">Xóa</button>
        </div>
        ${cur ? `<div style="font-size:10px;color:var(--green)">✓ Đang lọc: ${from||'…'} – ${to||'…'}</div>` : ''}
      </div>`;
    }
    return `<label class="col-dd-item">
      <input type="checkbox" value="${esc(v)}" data-val="${esc(v)}" ${colFilters[col].has(v)?'checked':''} onchange="toggleColFilterVal('${col}',this.dataset.val,this.checked)">
      ${v ? esc(v) : '<span style="color:var(--hint)">— (trống)</span>'}
    </label>`;
  }).join('');
}
function toggleColFilterVal(col, val, checked) {
  if (checked) colFilters[col].add(val);
  else colFilters[col].delete(val);
}
function applyLastActCustomRange() {
  var from = document.getElementById('lastact-range-from');
  var to   = document.getElementById('lastact-range-to');
  var f = from ? from.value.trim() : '';
  var t = to   ? to.value.trim()   : '';
  // Xóa range cũ nếu có
  [...colFilters.lastact].filter(x=>x&&x.startsWith('range:')).forEach(x=>colFilters.lastact.delete(x));
  if (f !== '' || t !== '') {
    colFilters.lastact.add('range:'+f+'-'+t);
  }
  applyFilters();
}
function clearLastActCustomRange() {
  [...colFilters.lastact].filter(x=>x&&x.startsWith('range:')).forEach(x=>colFilters.lastact.delete(x));
  renderColDdItems('lastact','');
  applyFilters();
}
function applyLastPosDateRange() {
  var from = document.getElementById('lastpos-range-from');
  var to   = document.getElementById('lastpos-range-to');
  var f = from ? from.value.trim() : '';
  var t = to   ? to.value.trim()   : '';
  [...colFilters.lastpos].filter(x=>x&&x.startsWith('daterange:')).forEach(x=>colFilters.lastpos.delete(x));
  if (f !== '' || t !== '') {
    colFilters.lastpos.add('daterange:'+f+'_'+t);
  }
  applyFilters();
}
function clearLastPosDateRange() {
  [...colFilters.lastpos].filter(x=>x&&x.startsWith('daterange:')).forEach(x=>colFilters.lastpos.delete(x));
  renderColDdItems('lastpos','');
  applyFilters();
}
function applyColFilter(col) {
  const dd = document.getElementById('col-dd-'+col);
  if (dd) dd.classList.remove('open');
  const th = document.getElementById('th-'+col);
  if (th) th.classList.toggle('col-filtered', colFilters[col].size > 0);
  applyFilters();
}
function clearColFilter(col) {
  colFilters[col].clear();
  const dd = document.getElementById('col-dd-'+col);
  if (dd) dd.classList.remove('open');
  const th = document.getElementById('th-'+col);
  if (th) th.classList.remove('col-filtered');
  applyFilters();
}
// ═══════════════════════════════════════════════════════
//  ADVANCED FILTER MODAL
// ═══════════════════════════════════════════════════════
// ── Menu mẹ "Tác vụ" ────────────────────────────────────────────
// Gom các nút chia data / chiến dịch / công việc vào 1 menu để thanh công cụ gọn.
function toggleTacVuMenu(e){
  if (e) e.stopPropagation();
  var m = document.getElementById('tacvu-menu');
  if (m) m.classList.toggle('open');
}
function closeTacVuMenu(){
  var m = document.getElementById('tacvu-menu');
  if (m) m.classList.remove('open');
}
// Đóng menu rồi mới mở modal — tránh menu che modal / dính lại khi quay về
function runTacVu(fn){
  closeTacVuMenu();
  try { if (typeof fn === 'function') fn(); }
  catch (err) { console.warn('Tác vụ lỗi:', err); if (typeof toast === 'function') toast('Lỗi mở tác vụ: ' + err.message); }
}
function openAdvModal() {
  // Build chips — giới hạn theo CS đang chọn ở "Lọc theo CS"
  const _base = (typeof scopedCustomers==='function') ? scopedCustomers() : allCustomers;
  const allCS = [...new Set(allCustomers.flatMap(c=>[..._buildCsSet_(c.orders, c.phone),...(c.careCSSet||[])]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  const allSources = [...new Set(_base.flatMap(c=>c.sources).filter(Boolean))].sort();
  _advChipCache.cs = allCS;
  buildAdvChips('cs', _advChipCache.cs, advFilters.cs, 'adv-cs-chips');
  buildAdvChips('sources', allSources, advFilters.sources, 'adv-source-chips');
  buildAdvChips('careStatus', CARE_STATUS, advFilters.careStatus, 'adv-care-chips');
  buildAdvChips('zaloStatus', ZALO_STATUS, advFilters.zaloStatus, 'adv-zalo-chips');
  buildAdvCfSections();
  const csSearchEl = document.getElementById('adv-cs-search'); if (csSearchEl) csSearchEl.value = '';
  const prodSearchEl = document.getElementById('adv-product-search'); if (prodSearchEl) prodSearchEl.value = [...advFilters.products].join(', ');
  // Restore date values
  ['adv-year-from','adv-month-from','adv-year-to','adv-month-to'].forEach(id=>{
    const el=document.getElementById(id);
    const key = id.replace('adv-','').replace('-','').replace('from','From').replace('to','To');
    // map id to advFilters key
    const map = {'adv-year-from':'yearFrom','adv-month-from':'monthFrom','adv-year-to':'yearTo','adv-month-to':'monthTo'};
    if(el && map[id]) el.value = advFilters[map[id]]||'';
  });
  updateAdvCount();
  document.getElementById('adv-modal').classList.add('open');
}
function buildAdvChips(key, values, selectedSet, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = values.map(v=>`<span class="adv-chip ${selectedSet.has(v)?'selected':''}" data-val="${esc(v)}" onclick="toggleAdvChip('${key}',this.dataset.val,this)">${esc(v)}</span>`).join('');
}
// Lọc danh sách chip CS hiển thị theo từ khoá gõ vào (không đổi lựa chọn đã chọn, chỉ ẩn/hiện)
function filterAdvChipList(key, term) {
  const containerId = 'adv-cs-chips';
  const src = _advChipCache[key] || [];
  const f = _foldVi(term||'').trim();
  const shown = f ? src.filter(v=>_foldVi(v).includes(f)) : src;
  buildAdvChips(key, shown, advFilters[key], containerId);
}
// Đồng bộ bộ lọc Sản phẩm trực tiếp từ ô nhập tự do — nhiều tên cách nhau bằng dấu phẩy
function syncAdvProductInput(val) {
  const terms = (val||'').split(',').map(t=>t.trim()).filter(Boolean);
  advFilters.products = new Set(terms);
  updateAdvCount();
}
function toggleAdvChip(key, val, el) {
  if (advFilters[key].has(val)) { advFilters[key].delete(val); el.classList.remove('selected'); }
  else { advFilters[key].add(val); el.classList.add('selected'); }
  updateAdvCount();
}
// ── Chip lọc nâng cao cho TRƯỜNG TỰ TẠO ──
function buildAdvCfSections() {
  var host = document.getElementById('adv-cf-sections');
  if (!host) return;
  if (typeof CUSTOM_FIELDS === 'undefined' || !CUSTOM_FIELDS.length) { host.innerHTML = ''; return; }
  host.innerHTML = CUSTOM_FIELDS.map(function(f){
    if (!advFilters.custom[f.id]) advFilters.custom[f.id] = new Set();
    var sel = advFilters.custom[f.id];
    var opts = [];
    (f.tree || []).forEach(function(node){
      if (node.children && node.children.length) {
        node.children.forEach(function(ch){ opts.push({ v: ch.value || ch.label, label: node.label + ' → ' + ch.label }); });
      } else {
        opts.push({ v: node.value || node.label, label: node.label });
      }
    });
    var chips = opts.map(function(o){
      return '<span class="adv-chip ' + (sel.has(o.v) ? 'selected' : '') + '" data-cf="' + esc(f.id) + '" data-val="' + esc(o.v) + '"'
        + ' onclick="toggleAdvCfChip(this.dataset.cf,this.dataset.val,this)">' + esc(o.label) + '</span>';
    }).join('');
    return '<div class="adv-section"><div class="adv-section-label">🏷 ' + esc(f.label) + ' (chọn nhiều)</div>'
      + '<div class="adv-chips">' + (chips || '<span style="font-size:11px;color:var(--hint)">Trường này chưa có lựa chọn nào</span>') + '</div></div>';
  }).join('');
}
function toggleAdvCfChip(fieldId, val, el) {
  if (!advFilters.custom[fieldId]) advFilters.custom[fieldId] = new Set();
  var s = advFilters.custom[fieldId];
  if (s.has(val)) { s.delete(val); el.classList.remove('selected'); }
  else { s.add(val); el.classList.add('selected'); }
  updateAdvCount();
}
function _advCfCount() {
  var n = 0;
  for (var k in (advFilters.custom || {})) n += advFilters.custom[k].size;
  return n;
}
function updateAdvCount() {
  const n = countAdvFilters();
  const el = document.getElementById('adv-count-text');
  if (el) el.textContent = n > 0 ? `${n} bộ lọc đang bật` : 'Chưa có bộ lọc';
}
function countAdvFilters() {
  return advFilters.cs.size + advFilters.products.size + advFilters.sources.size +
    advFilters.careStatus.size + advFilters.zaloStatus.size + _advCfCount() +
    (advFilters.yearFrom?1:0) + (advFilters.yearTo?1:0);
}
function applyAdvFilters() {
  // Read date fields
  const map = {'adv-year-from':'yearFrom','adv-month-from':'monthFrom','adv-year-to':'yearTo','adv-month-to':'monthTo'};
  for (const [id,key] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) advFilters[key] = el.value || '';
  }
  // Goi applyFilters() TRUOC khi dong modal — de luc closeAdvModal() lam moi lai "Chia data"
  // (neu dang mo tu do, xem _advAssignOpenAdvFilter) thi window.__omeFiltered da la ket qua MOI.
  applyFilters();
  closeAdvModal();
}
function clearAdvFilters() {
  advFilters = { cs:new Set(), products:new Set(), sources:new Set(), careStatus:new Set(), zaloStatus:new Set(), custom:{}, yearFrom:'', monthFrom:'', yearTo:'', monthTo:'' };
  ['adv-year-from','adv-month-from','adv-year-to','adv-month-to'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  openAdvModal(); // rebuild chips
  applyFilters();
}
function closeAdvModal() {
  document.getElementById('adv-modal').classList.remove('open');
  // Neu Loc nang cao duoc mo TU BEN TRONG "Chia data" (xem _advAssignOpenAdvFilter) thi quay lai
  // modal Chia data va lam moi nguon data theo bo loc vua ap dung/huy, thay vi tro ve man hinh chinh.
  if (_advAssignReopenAfterFilter) {
    _advAssignReopenAfterFilter = false;
    const am = document.getElementById('assign-modal');
    if (am) am.classList.add('open');
    if (typeof window.__omeFiltered !== 'undefined' && window.__omeFiltered) {
      _assignFilteredList = window.__omeFiltered.map(function(c){ return c && c.phone; }).filter(Boolean);
      _advAssign.customCount = _assignFilteredList.length;
    }
    if (typeof renderAssignCreate === 'function') renderAssignCreate();
  }
}
async function autoSyncLoop() {
  if (!gsUrl || _autoSyncRunning) return;
  if (document.hidden) {
    _autoSyncTimer = setTimeout(autoSyncLoop, AUTO_SYNC_MS);
    return;
  }
  _autoSyncRunning = true;
  try {
    _autoSyncTick++;
    // BUG (đã sửa): trước đây pullOrders chỉ true khi customerMap RỖNG — tức chỉ kéo đơn hàng/
    // "Chăm sóc" (KH thêm nhanh)/dữ liệu đơn ĐÚNG 1 LẦN lúc mở trang, không bao giờ kéo lại nữa dù
    // vòng lặp này vẫn chạy mỗi 3s. Hệ quả: CS A thêm đơn mới → máy CS B không tự thấy, phải bấm
    // "Sync GS" thủ công. Giờ cứ ~10 lần lặp (~30s ở AUTO_SYNC_MS=3000) thì ép kéo lại đầy đủ luôn,
    // không chỉ CareData (trạng thái/ghi chú/hẹn — vốn đã tự cập nhật nhanh mỗi 3s như trước).
    const forceFullPull = (_autoSyncTick % ORDERS_PULL_EVERY_TICKS === 0);
    await syncFromGS({ pullOrders: _isEmptyObj(customerMap) || forceFullPull });
  } catch(e) {
    // BUG (đã sửa): trước đây catch này ghi "// Silent" — MỌI lỗi JS thật xảy ra trong
    // syncFromGS() sau khi fetch đã thành công (vd throw trong buildCustomers()/mergeRows()
    // khi xử lý dữ liệu thật, khác với lỗi fetch/GAS đã có banner riêng ở syncFromGS) bị NUỐT
    // HOÀN TOÀN — không log, không banner, không gì cả. Đây rất có thể là nguyên nhân của
    // triệu chứng "CRM vẫn lỗi nhưng không thấy cảnh báo gì" dù đã sửa các lỗi sync ở
    // syncFromGS — vì lỗi này nằm NGOÀI syncFromGS, không đi qua các try/catch đã sửa ở đó.
    // Giờ log ra console (F12 xem được ngay) + tính vào cùng bộ đếm lỗi để hiện banner sau
    // 3 lần liên tiếp, kèm rõ đây là lỗi xử lý dữ liệu chứ không phải lỗi tải từ Sheet.
    console.error('autoSyncLoop lỗi (không phải lỗi tải dữ liệu — lỗi xử lý sau khi tải):', e);
    _autoSyncFailCount = (_autoSyncFailCount || 0) + 1;
    if (_autoSyncFailCount >= 3) showSyncErrorBanner('Lỗi xử lý dữ liệu sau khi tải: ' + (e?.message || e) + ' (xem chi tiết ở Console - F12)');
  }
  _autoSyncRunning = false;
  _autoSyncTimer = setTimeout(autoSyncLoop, AUTO_SYNC_MS);
}


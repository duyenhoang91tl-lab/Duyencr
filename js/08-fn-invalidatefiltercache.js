// Mo phong var-hoisting cua khoi script goc (da tach file): khai bao truoc cac bien var dung o cac file sau.
var currentUser, teams, auditLog, _assignIndex, _dataVersion, _filterCache, _lastFilteredObjs, V9_TEAM_COLORS, SYNC_BATCH_MS, _applyFiltersCore, _origSaveLS, _origBuildCustomers, _auditQueue, _auditTimer, _assignAllIndex, _careQueue, _careWriting, _careTimer, _DASH_EXCLUDED_STATUS, _dashTemplates, _dashActiveIdx, _dashDragSrc, _DASH_WIDGET_DEFS, _DEFAULT_DASH_WIDGETS, _dashFilter, mktTeams, _mktPagesCache, _mktPagesLoading, _teamPickerOpen, _teamChanPickerOpen, _pkState, _PK_SALE_DIR, _PK_STATUS_LABEL, _PK_STATUS_DESC, _PK_TAG_LS, _PK_KPI_TAG_ORDER, _PK_KPI_TAG_SHORT, _expLogState, _PK_COL_GETTERS, _PK_QUICK_RANGES, _mktState, _MKT_OP_SYMBOL, _dbState, _dbStandalone, _srState, _SR_CHART_COLORS, _SR_COLTH_ROWSFN_, _SR_COLTH_GETTER_, _srSaleComboData, _srSaleComboIdx, _srComboReg, _srComboData, _srComboIdx, _srTeamFieldToSaleField_, _impState, SALE_TIER_ORDER_CLIENT_, SALE_TIER_LABEL_CLIENT_, _irSearch, _scSearch, _scGroupsOpen, _scGroupsDraft, _crNewKey, _bpEditingId, _bpDraft, _hManual, _hManualLoaded, _hSaveTimers, _hKhMapOverride, _H_ALIAS_, _hChot, _hChotLoaded, _hChotTimers, _H_ZALO_REPLY_, _H_ZALO_ASKED_, _SRB_COMBO_CFG, _srbComboData, _srbComboIdx, _teamAssignPct, _teamAssignSel, _v9PrevSwitchAssignTab, _AA_SRC_KEYS, _AA_POS_KEYS, _AA_SRC_LABEL, _AA_PRIO_KEYS, _AA_PRIO_LABEL, _AA_TIER, _AA_HANG_KEYS, _AA_HANG_LABEL, _aaCfg, _aaBusy, _aaOpen, _aaRatioTeamOpen, _AA_DOW, _aaCkOpen, _aaPrevSwitchTab, _noActionActive, _upState, _UP_KINDS, _UP_ORDER, _v9PrevSwitchTab, _activeV9Tab, _RPT_MODE_TABS, _RPT_MODE_LABELS, _v9PrevSwitchTab2, _gasSrcCache, _v9PrevOpenGsModal, _v9PrevSync, _PW_SALT, _PW_SALT_OLD, accounts, _authAccount, _bootstrapAdmin, _dbOrigAuthGate, _dbBootTimer, _prevOpenRoleModal, _acctOpen, _acctEditing;
// ═══════════════════════════════════════════════════════
//  CACHE FILTER  (tránh tính lại khi filter không đổi)
// ═══════════════════════════════════════════════════════
function _invalidateFilterCache(){
  _dataVersion++;
  _filterCache.sig = null;
  _filterCache.list = null;
}
function _setSig(s){ try { return [...(s||[])].sort().join('|'); } catch(e){ return ''; } }
function _filterSignature(){
  function val(id){ var el = document.getElementById(id); return el ? (el.value||'') : ''; }
  function chk(id){ var el = document.getElementById(id); return el ? (el.checked?'1':'0') : '0'; }
  var parts = [
    _dataVersion,
    (currentUser.role||'') + ':' + (currentUser.name||'') + ':' + (currentUser.team||''),
    typeof currentTier  !== 'undefined' ? currentTier  : '',
    typeof currentCare  !== 'undefined' ? currentCare  : '',
    typeof currentZalo  !== 'undefined' ? currentZalo  : '',
    typeof currentBrand !== 'undefined' ? currentBrand : '',
    (typeof currentCF !== 'undefined' ? JSON.stringify(currentCF) : ''),
    val('search-input').toLowerCase(),
    _csFilterList().join('|'),
    (document.querySelector('.srt') ? document.querySelector('.srt').value : ''),
    val('ymf-year'), val('ymf-month'), val('ymf-hour-from'), val('ymf-hour-to'),
    val('ymf-date-from'), val('ymf-date-to'),
    val('campaign-filter'), chk('no-action-filter')
  ];
  if (typeof colFilters === 'object') {
    parts.push('cf', _setSig(colFilters.name), _setSig(colFilters.tier), _setSig(colFilters.hang), _setSig(colFilters.care),
      _setSig(colFilters.zalo), _setSig(colFilters.product), _setSig(colFilters.source), _setSig(colFilters.cs), _setSig(colFilters.careCS), _setSig(colFilters.lastpos));
  }
  if (typeof advFilters === 'object') {
    parts.push('af', _setSig(advFilters.cs), _setSig(advFilters.products), _setSig(advFilters.sources),
      _setSig(advFilters.careStatus), _setSig(advFilters.zaloStatus),
      advFilters.yearFrom, advFilters.monthFrom, advFilters.yearTo, advFilters.monthTo);
    // Trường tự tạo ở lọc nâng cao (sắp khoá để chữ ký ổn định giữa các lần)
    var _cfKeys = Object.keys(advFilters.custom || {}).sort();
    parts.push('afcf', _cfKeys.map(function(k){ return k + ':' + _setSig(advFilters.custom[k]); }).join(';'));
  }
  return parts.join('§');
}

// ═══════════════════════════════════════════════════════
//  AUDIT LOG
// ═══════════════════════════════════════════════════════
function logAudit(action, phone, oldV, newV){
  var entry = {
    timestamp: new Date().toISOString(),
    user: (currentUser && currentUser.name) || 'Admin',
    action: action || '',
    phone: phone || '',
    oldValue: oldV == null ? '' : String(oldV),
    newValue: newV == null ? '' : String(newV)
  };
  auditLog.unshift(entry);
  if (auditLog.length > 2000) auditLog.length = 2000;
  _origSaveLS('ome_audit', auditLog);
  if (gsUrl) queueAuditSync(entry);
  if (_activeV9Tab === 'audit') renderAuditTab();
}

function queueAuditSync(entry){
  _auditQueue.push(entry);
  if (_auditTimer) return;
  _auditTimer = setTimeout(flushAuditSync, SYNC_BATCH_MS);
}
async function flushAuditSync(){
  _auditTimer = null;
  if (!gsUrl || !_auditQueue.length) return;
  var rows = _auditQueue.splice(0, _auditQueue.length);
  try {
    await fetch(gsUrl, { method:'POST', redirect:'follow',
      body: JSON.stringify({ action:'saveAudit', rows: rows }) });
  } catch(e){ /* GAS cũ chưa hỗ trợ saveAudit → bỏ qua, audit vẫn có ở localStorage */ }
}

function _rebuildAssignIndex(){
  _assignIndex = {};
  _assignAllIndex = {};
  // duyệt từ CŨ → MỚI để bản ghi mới nhất ghi đè
  var hist = (typeof assignHistory !== 'undefined' && assignHistory) ? assignHistory.slice() : [];
  hist.sort(function(a,b){ return String(a.date||'').localeCompare(String(b.date||'')); });
  hist.forEach(function(e){
    (e.phones||[]).forEach(function(p){
      _assignIndex[p] = e.csName; // CS mới nhất (dùng cho _heldBy)
      if (!_assignAllIndex[p]) _assignAllIndex[p] = new Set();
      _assignAllIndex[p].add(e.csName); // tất cả CS (dùng cho _inUserScope + CS filter)
    });
  });
}
// ── "1 NGƯỜI = nhiều tên" ──────────────────────────────────────────────────────────────────────────
// 1 tài khoản CS có thể có nhiều tên/bí danh (Quản lý tài khoản → "N sale", xem _acctNamesOf), vd Thuydinh1995 + thuydinh95
// là CÙNG 1 người. Tên trong team vẫn giữ đủ (để tính doanh thu/đơn theo từng tên như cũ), nhưng ĐẾM THÀNH VIÊN và CHIA DATA
// phải tính theo NGƯỜI, nếu không người đó đếm 2 lần và nhận gấp đôi phần chia. Chỉ tài khoản vai trò CS mới tính là
// "1 người" (tài khoản Leader/Admin cũng có nhiều sale nhưng là nhiều người khác nhau). Tên chỉ khác hoa/thường
// (Biichnguyen1993 / biichnguyen1993) cũng coi là 1 người.
function _personAliases(name){
  var key = String(name||'').toLowerCase();
  if (key && typeof accounts !== 'undefined' && accounts){
    for (var i = 0; i < accounts.length; i++){
      var a = accounts[i]; if (!a || a.role !== 'cs') continue;
      var ns = _acctNamesOf(a);
      if (ns.length > 1 && ns.some(function(x){ return String(x).toLowerCase() === key; })) return ns;
    }
  }
  return [name];
}
// names (danh sách tên, không trùng) -> [{names:[các tên cùng 1 người có trong danh sách], primary:tên chính}], giữ thứ tự xuất hiện.
function _groupNamesByPerson(names){
  names = names || [];
  var low = names.map(function(n){ return String(n).toLowerCase(); });
  var used = {}, out = [];
  names.forEach(function(n, idx){
    if (used[idx]) return;
    var al = _personAliases(n).map(function(x){ return String(x).toLowerCase(); });
    var grp = [];
    // thứ tự theo tài khoản (tên chính của tài khoản đứng trước); tên không thuộc tài khoản thì theo thứ tự trong danh sách
    al.forEach(function(a){ names.forEach(function(nm, j){ if (!used[j] && low[j] === a){ used[j] = 1; grp.push(nm); } }); });
    if (!used[idx]){ used[idx] = 1; grp.unshift(n); }
    out.push({ names: grp, primary: grp[0] });
  });
  return out;
}
// Mỗi người chỉ giữ 1 tên (tên chính) — dùng khi CHIA DATA để 1 người không nhận 2 phần.
function _dedupePeopleNames(names){ return _groupNamesByPerson(names).map(function(g){ return g.primary; }); }

function _teamOf(csName){
  if (!csName) return null;
  for (var i=0;i<teams.length;i++){
    var t = teams[i];
    if (t.leader === csName) return t;
    if ((t.members||[]).indexOf(csName) !== -1) return t;
  }
  return null;
}
function _teamMemberSet(team){
  var s = new Set();
  if (!team) return s;
  if (team.leader) s.add(team.leader);
  (team.members||[]).forEach(function(m){ s.add(m); });
  return s;
}
// Gop toan bo ten Sale/CS xuat hien tren cac don (DT tong — 1 don co the nhieu sale, tach nhau
// boi dau phay) VA tren "dữ liệu đơn" (tra theo SDT qua donSaleByPhone) thanh 1 Set duy nhat.
// Dung lam "CS phu trach" cho csSet — _inUserScope/cac bo loc theo CS deu doc tu day, nen chi
// can sua o 1 cho nay la moi noi dung csSet deu tu dong duoc gom du 3 nguon.
function _buildCsSet_(orders, phone){
  var set = new Set();
  (orders||[]).forEach(function(o){
    String((o && o.cs) || '').split(',').forEach(function(n){ n = n.trim(); if (n) set.add(n); });
  });
  if (typeof donSaleByPhone !== 'undefined' && donSaleByPhone && phone && donSaleByPhone[phone]) {
    donSaleByPhone[phone].forEach(function(n){ if (n) set.add(n); });
  }
  // Sale TU THEM SO MOI (nut "+ Thêm KH/Đơn nhanh") cung duoc tinh la CS phu trach cua so do
  // — luc moi them chua co don nao trong DT tong/dữ liệu đơn nen neu khong lay tu careLeads
  // thi so vua them se KHONG hien ra khi chinh sale do loc theo "CS phụ trách".
  if (typeof careLeads !== 'undefined' && careLeads && phone && careLeads[phone] && careLeads[phone].cs) {
    String(careLeads[phone].cs).split(',').forEach(function(n){ n = n.trim(); if (n) set.add(n); });
  }
  return set;
}
function _heldBy(c){
  return (c && (c.careCS || _assignIndex[c.phone])) || '';
}
// Trả về Set tất cả CS từng được chia KH này (tra cứu O(1) qua _assignAllIndex)
function _allHoldersOf(c){
  var s = new Set();
  if (!c) return s;
  if (c.careCSSet) c.careCSSet.forEach(function(n){ s.add(n); });
  var idx = (typeof _assignAllIndex !== 'undefined') ? _assignAllIndex[c.phone] : null;
  if (idx) idx.forEach(function(n){ s.add(n); });
  return s;
}
function _inUserScope(c){
  if (!currentUser || currentUser.role === 'admin') return true;
  // Tài khoản có thể gắn NHIỀU tên (vd đơn "chia" cho nhiều sale, hoặc 1 tài khoản gộp nhiều bí
  // danh) — currentUser.names là mảng; currentUser.name (đơn) chỉ còn để tương thích ngược.
  var myNames = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name ? [currentUser.name] : []);
  if (!myNames.length) return false;
  if (currentUser.role === 'cs'){
    // Thuộc phạm vi nếu: là CS chăm sóc (careCS), được chia campaign, HOẶC là CS phụ trách đơn
    // (order-level seller, o.cs) — thêm chiều này để hỗ trợ đơn "chia nhiều sale": mỗi sale trong
    // đó đều xem được đơn có tên mình, dù không phải người chăm sóc chính của khách.
    var holder = _heldBy(c);
    if (myNames.indexOf(holder) !== -1) return true;
    var allH = _allHoldersOf(c);
    if (myNames.some(function(n){ return allH.has(n); })) return true;
    if (c.csSet && myNames.some(function(n){ return c.csSet.has(n); })) return true;
    return false;
  }
  if (currentUser.role === 'leader'){
    var team = null;
    for (var i=0;i<teams.length;i++){
      if (myNames.indexOf(teams[i].leader) !== -1 || teams[i].name === currentUser.team){ team = teams[i]; break; }
    }
    var holder2 = _heldBy(c);
    if (!team) return myNames.indexOf(holder2) !== -1;
    var teamSet = _teamMemberSet(team);
    if (teamSet.has(holder2)) return true;
    // Kiểm tra toàn bộ chiến dịch cho leader
    var allH2 = _allHoldersOf(c);
    for (var m of allH2) { if (teamSet.has(m)) return true; }
    // + CS phụ trách đơn (order-level seller) của bất kỳ thành viên nào trong team
    if (c.csSet) { for (var s2 of c.csSet) { if (teamSet.has(s2)) return true; } }
    return false;
  }
  return true;
}

function _careRow(phone, schedByPhone){
  var care = (typeof careData !== 'undefined' && careData[phone]) || {};
  // CHI dong bo len Sheet cac lich: (1) CS tu tao tay (khong phai auto), HOAC (2) auto nhung DA
  // duoc tac dong (bam Xong/xoa). Lich auto CHUA tac dong la SO LIEU TAM TINH LAI moi lan tai
  // trang tu don hang hien co — KHONG duoc coi la "su that" de ghi len Sheet. Neu khong loc, bat
  // ky dong bo nao khac cua khach nay (vi ly do hoan toan khong lien quan) se vo tinh ghi de/hoi
  // sinh lai dung lich auto ma Duyen vua xoa tay truc tiep tren CareData Sheet — dung cung dieu
  // kien voi _hasRealCareData() ben tren de 2 cho nhat quan voi nhau.
  var _srcScheds = schedByPhone ? (schedByPhone[phone] || []) : (typeof schedules !== 'undefined' ? schedules : []).filter(function(x){ return x.phone === phone; });
  var myScheds = _srcScheds.filter(function(x){
    return (!x.autoDao || x.done);
  });
  return {
    phone: phone,
    status: care.status||'', zalo: care.zalo||'', cs: care.cs||'', note: care.note||'',
    schedules: JSON.stringify(myScheds),
    schedGoi: care.schedGoi||'', schedGoiNote: care.schedGoiNote||'',
    schedSP: care.schedSP||'', schedSPNote: care.schedSPNote||'',
    schedCS: care.schedCS||'', schedCSNote: care.schedCSNote||'',
    schedHen: care.schedHen||'', schedHenNote: care.schedHenNote||'',
    khStatus: care.khStatus||'', nickZalos: care.nickZalos||[], zaloPhones: care.zaloPhones||[], birthday: care.birthday||'',
    name: care.name||'',
    custom: care.custom||{}
  };
}
// Chỉ đồng bộ CareData khi khách có DỮ LIỆU CS NHẬP THẬT.
// Lịch auto (Data Đảo) hay việc chỉ mở/click khách KHÔNG được tạo dòng CareData → tránh nặng dữ liệu.
function _hasRealCareData(phone){
  var care = (typeof careData !== 'undefined' && careData[phone]) || {};
  // Trường CS nhập tay
  if ((care.status||'').toString().trim())   return true;
  if ((care.zalo||'').toString().trim())     return true;
  if ((care.cs||'').toString().trim())       return true;
  if ((care.note||'').toString().trim())     return true;
  if ((care.khStatus||'').toString().trim()) return true;
  if ((care.birthday||'').toString().trim()) return true;
  if ((care.name||'').toString().trim())     return true;
  if (Array.isArray(care.nickZalos) && care.nickZalos.length) return true;
  if (Array.isArray(care.zaloPhones) && care.zaloPhones.length) return true;
  // Trường tự tạo (admin thêm) có giá trị → cũng là dữ liệu CS nhập thật, phải được đồng bộ
  // (nếu thiếu điều kiện này, khách CHỈ điền trường tự tạo sẽ không bao giờ được đẩy lên Sheet)
  if (care.custom && typeof care.custom === 'object') {
    for (var _ck in care.custom) { if ((care.custom[_ck]||'').toString().trim()) return true; }
  }
  // Lịch nhanh đặt tay
  if ((care.schedGoi||'').toString().trim()) return true;
  if ((care.schedSP||'').toString().trim())  return true;
  if ((care.schedCS||'').toString().trim())  return true;
  // Hẹn mua đặt tay (không phải auto — auto có tiền tố AUTO_HEN_TAG ở note)
  if ((care.schedHen||'').toString().trim() &&
      String(care.schedHenNote||'').indexOf(AUTO_HEN_TAG) !== 0) return true;
  // Lịch CS TỰ TẠO hoặc đã bấm "Xong" (auto nhưng CS đã tác động)
  var acted = (typeof schedules !== 'undefined' ? schedules : []).some(function(x){
    return x.phone === phone && (!x.autoDao || x.done);
  });
  if (acted) return true;
  return false;
}
function queueCareSync(phone){
  if (!phone) return;
  // Bỏ qua nếu chưa có tác động thật → không tạo dòng CareData rỗng cho khách
  if (!_hasRealCareData(phone)) return;
  _careQueue.add(phone);
  if (_careTimer) return;
  _careTimer = setTimeout(flushCareSync, SYNC_BATCH_MS);
}
async function flushCareSync(){
  _careTimer = null;
  if (!gsUrl || !_careQueue.size) return;
  var phones = [..._careQueue];
  _careQueue.clear();
  // Vẫn "bảo vệ" các SĐT này khỏi bị pull đè cho tới khi GS ghi xong (tránh webapp quay về dữ liệu cũ)
  phones.forEach(function(p){ _careWriting.add(p); });
  // Gom lich theo SDT 1 lan (truoc day _careRow quet toan bo lich cho TUNG SDT => O(SDT x lich), treo may khi chia nhieu KH)
  var schedByPhone = {};
  (typeof schedules !== 'undefined' ? schedules : []).forEach(function(x){ (schedByPhone[x.phone] = schedByPhone[x.phone] || []).push(x); });
  var rows = phones.map(function(p){ return _careRow(p, schedByPhone); });
  // Gui THEO LO 10000 dong/request (truoc day 1 request khong lo; loi 1 lan la roi vao fallback saveSingle tung SDT = hang chuc nghin request)
  var CHUNK = 10000;   // lo lon: server doc/ghi ca sheet 1 lan/request nen it request thi nhanh hon (lo <=50 dong server chi ghi dung dong can)
  for (var ci = 0; ci < rows.length; ci += CHUNK) {
    var chunkRows = rows.slice(ci, ci + CHUNK), chunkPhones = phones.slice(ci, ci + CHUNK);
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'saveBatch', rows: chunkRows }) });
      var txtResp = await r.text();
      var ok = false;
      try { ok = !!JSON.parse(txtResp).ok; } catch(e){ ok = false; }
      if (!ok) throw new Error('saveBatch not supported');
    } catch(e){
      // GAS cũ (v4) chưa có saveBatch → fallback: lưu từng phone bằng saveSingle (chỉ cho lô bị lỗi)
      for (var i=0;i<chunkPhones.length;i++){
        try { await pushCareToGS(chunkPhones[i]); } catch(_){}
      }
    }
  }
  // Giữ bảo vệ thêm 1 nhịp auto-sync để GSheets kịp ghi & đọc lại đúng (read-after-write)
  setTimeout(function(){ phones.forEach(function(p){ _careWriting.delete(p); }); }, AUTO_SYNC_MS + 1500);
}

// ═══════════════════════════════════════════════════════
//  ROLE — "TÔI LÀ AI?"
// ═══════════════════════════════════════════════════════
function _roleLabel(r){ return r==='admin'?'Admin':(r==='leader'?'Team Leader':(r==='demo'?'Tài khoản test':'CS')); }
function renderRolePill(){
  var pill = document.getElementById('role-pill');
  if (!pill) return;
  var cls = currentUser.role==='admin' ? 'admin' : (currentUser.role==='leader' ? 'leader' : 'cs');
  var namesForPill = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name?[currentUser.name]:[]);
  var extra = currentUser.role==='admin' ? '' : (' · ' + esc(namesForPill.join(', ')));
  pill.className = 'role-pill ' + cls;
  pill.innerHTML = '<span style="opacity:.7">'+_roleLabel(currentUser.role)+'</span>'+extra;
  pill.title = 'Đổi vai trò xem dữ liệu';
}
function _allCSNames(){
  var set = new Set();
  (typeof allCustomers !== 'undefined' ? allCustomers : []).forEach(function(c){
    if (c.careCSSet) c.careCSSet.forEach(function(n){ if(n) set.add(n); });
    if (c.csSet) c.csSet.forEach(function(n){ if(n) set.add(n); });
  });
  (typeof assignHistory !== 'undefined' ? assignHistory : []).forEach(function(e){ if(e.csName) set.add(e.csName); });
  teams.forEach(function(t){ if(t.leader) set.add(t.leader); (t.members||[]).forEach(function(m){ set.add(m); }); });
  return [...set].filter(Boolean).sort(function(a,b){ return a.localeCompare(b,'vi'); });
}
// Danh sach ten Kenh ban (kenhBan/source) tung xuat hien trong don hang — dung cho o chon
// kenh cua Team (Quan ly Team → chon kenh cho team NEU muon gioi han doanh thu team do chi
// tinh trong 1/vai kenh nhat dinh, vd CS thuoc team khac nhung chi chay 1 kenh FB rieng).
function _allChannelNames(){
  var set = new Set();
  (typeof allCustomers !== 'undefined' ? allCustomers : []).forEach(function(c){
    (c.orders||[]).forEach(function(o){ if (o.source) set.add(String(o.source).trim()); });
  });
  return [...set].filter(Boolean).sort(function(a,b){ return a.localeCompare(b,'vi'); });
}
function openRoleModal(){
  var ov = document.getElementById('role-modal');
  if (!ov) return;
  var names = _allCSNames();
  var teamNames = teams.map(function(t){ return t.name; });
  var nameOpts = '<option value="">-- Chọn tên --</option>' + names.map(function(n){
    return '<option value="'+esc(n)+'"'+(n===currentUser.name?' selected':'')+'>'+esc(n)+'</option>'; }).join('');
  var teamOpts = '<option value="">-- Chọn team --</option>' + teamNames.map(function(n){
    return '<option value="'+esc(n)+'"'+(n===currentUser.team?' selected':'')+'>'+esc(n)+'</option>'; }).join('');
  var body = document.getElementById('role-modal-body');
  body.innerHTML =
    '<div class="v9-field"><label>Vai trò</label>'+
      '<div style="display:flex;gap:8px">'+
        ['admin','leader','cs'].map(function(r){
          return '<div class="role-opt'+(currentUser.role===r?' active':'')+'" data-role="'+r+'" onclick="_pickRole(this,\''+r+'\')">'+_roleLabel(r)+'</div>';
        }).join('')+
      '</div></div>'+
    '<div class="v9-field" id="role-name-wrap" style="'+(currentUser.role==='admin'?'display:none':'')+'">'+
      '<label>Tên CS (lọc dữ liệu của người này)</label>'+
      '<select id="role-name-sel">'+nameOpts+'</select>'+
      '<input id="role-name-input" placeholder="…hoặc gõ tên mới" style="margin-top:6px" value=""></div>'+
    '<div class="v9-field" id="role-team-wrap" style="'+(currentUser.role==='leader'?'':'display:none')+'">'+
      '<label>Team phụ trách</label><select id="role-team-sel">'+teamOpts+'</select></div>';
  ov.classList.add('open');
}
function closeRoleModal(){ var ov=document.getElementById('role-modal'); if(ov) ov.classList.remove('open'); }
function _pickRole(el, r){
  document.querySelectorAll('#role-modal-body .role-opt').forEach(function(o){ o.classList.remove('active'); });
  el.classList.add('active');
  el.setAttribute('data-picked','1');
  var nameWrap = document.getElementById('role-name-wrap');
  var teamWrap = document.getElementById('role-team-wrap');
  if (nameWrap) nameWrap.style.display = (r==='admin') ? 'none' : '';
  if (teamWrap) teamWrap.style.display = (r==='leader') ? '' : 'none';
}
function saveRole(){
  var picked = document.querySelector('#role-modal-body .role-opt.active');
  var role = picked ? picked.getAttribute('data-role') : currentUser.role;
  var nameSel = document.getElementById('role-name-sel');
  var nameInput = document.getElementById('role-name-input');
  var teamSel = document.getElementById('role-team-sel');
  var name = (nameInput && nameInput.value.trim()) || (nameSel && nameSel.value) || '';
  var team = (teamSel && teamSel.value) || '';
  if (role !== 'admin' && !name){ toast('Vui lòng chọn hoặc nhập tên CS'); return; }
  if (role === 'admin'){ name = 'Admin'; team = ''; }
  if (role === 'cs'){
    var t = _teamOf(name); team = t ? t.name : '';
  }
  currentUser = { name: name, role: role, team: team };
  saveLS('ome_user', currentUser);
  // CS → khoá bộ lọc CS về chính mình
  var csFilter = document.getElementById('cs-staff-filter');
  if (csFilter){
    if (role === 'cs'){
      var has = Array.prototype.some.call(csFilter.options, function(o){ return o.value === name; });
      if (!has){ var op=document.createElement('option'); op.value=name; op.textContent=name; csFilter.appendChild(op); }
      csFilter.value = name; csFilter.disabled = true;
      if (typeof syncCSCombo==='function') syncCSCombo();
      if (typeof updateStats==='function'){ updateStats(); updateSidebarBadges(); updateBrandList(); }
    } else {
      csFilter.disabled = false;
    }
  }
  renderRolePill();
  _invalidateFilterCache();
  if (typeof applyFilters === 'function') applyFilters();
  if (_activeV9Tab === 'dashboard') renderDashboard();
  closeRoleModal();
  toast('✓ Đang xem với vai trò: ' + _roleLabel(role) + (role!=='admin' ? ' ('+name+')' : ''));
}

function _dashIsExcludedStatus(st){
  var s = String(st||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();
  return !!s && _DASH_EXCLUDED_STATUS.indexOf(s) !== -1;
}
function _dashOrderInRange(o, dFrom, dTo){
  if (!dFrom && !dTo) return true;
  var dt = _parseFlexDate(o.orderDate) || _parseFlexDate(o.date);
  if (!dt) return false; // đơn không xác định được ngày → loại khi đang lọc theo thời gian
  var t = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  if (dFrom && t < new Date(dFrom + 'T00:00:00').getTime()) return false;
  if (dTo   && t > new Date(dTo   + 'T23:59:59').getTime()) return false;
  return true;
}

// list/dFrom/dTo đều tùy chọn — không truyền thì giữ nguyên hành vi cũ (toàn bộ KH, mọi thời gian)
function _computeCSStats(list, dFrom, dTo){
  var map = {}; // name -> {name, held, closed, friend, cared, revenue, orders}
  function ensure(n){ if(!map[n]) map[n]={name:n,held:0,closed:0,friend:0,cared:0,revenue:0,orders:0}; return map[n]; }
  var arr = list || (typeof allCustomers !== 'undefined' ? allCustomers : []);
  arr.forEach(function(c){
    // 1 KH co the duoc chia/cham soc boi NHIEU sale (careCSSet) — cong held/closed/friend/cared
    // cho TUNG sale rieng, khong gop chung thanh 1 dong ten "saleA, saleB" nhu truoc (_heldBy
    // don le tra ve chuoi gop khi khong co careCSSet).
    var holders = c.careCSSet && c.careCSSet.size ? [...c.careCSSet] : (_heldBy(c) ? [_heldBy(c)] : []);
    holders.forEach(function(h){
      if (!h) return;
      var m = ensure(h);
      m.held++;
      if (c.careStatus === 'Chốt') m.closed++;
      if (c.zaloStatus === 'Đã kết bạn') m.friend++;
      if (c.careStatus && c.careStatus !== 'Chưa liên hệ') m.cared++;
    });
    // doanh thu/đơn theo CS thực bán (order.cs) — 1 don cung co the co NHIEU sale (o.cs dang
    // "saleA, saleB"), phai tach ra roi cong cho TUNG sale thay vi coi ca chuoi gop la 1 ten CS.
    // So don: giu nguyen (khong chia) cho moi sale tren don; doanh thu: chia deu cho N sale —
    // dong bo voi quy uoc dang dung o buildSalesReportA_/buildKpiReport_ (gas_v13.js).
    (c.orders||[]).forEach(function(o){
      if (!_dashOrderInRange(o, dFrom, dTo)) return;
      if (_dashIsExcludedStatus(o.status)) return; // dong bo voi Bao cao A/B: bo don Huy/Da hoan/Dang hoan
      if (!o.cs) return;
      var salesOnOrder = splitMulti_(o.cs, ',');
      if (!salesOnOrder.length) return;
      var n = salesOnOrder.length;
      salesOnOrder.forEach(function(sn){
        var mm = ensure(sn);
        mm.revenue += (+o.revenue||0) / n;
        mm.orders++;
      });
    });
  });
  return map;
}
// Doanh thu/so don CUA RIENG 1 tap thanh vien, GIOI HAN theo kenh neu channels khong rong —
// dung khi team co chon kenh (vd 1 so CS thuoc team khac nhung chi chay 1 kenh FB rieng, chi
// muon tinh doanh thu team theo dung kenh do, khong tinh het moi don cua CS).
function _revenueByMembersChannels(members, channels){
  var memberSet = new Set(members);
  var chanSet = channels && channels.length ? new Set(channels) : null;
  var revenue = 0, orders = 0;
  (typeof allCustomers !== 'undefined' ? allCustomers : []).forEach(function(c){
    (c.orders||[]).forEach(function(o){
      if (!o.cs) return;
      if (_dashIsExcludedStatus(o.status)) return;
      if (chanSet && !chanSet.has(String(o.source||'').trim())) return;
      // o.cs co the la "saleA, saleB" -> TACH ra, chi tinh phan cua thanh vien thuoc team nay
      // (doanh thu chia deu N sale, so don giu nguyen) — truoc day so khop ca chuoi nen don
      // nhieu sale bi bo sot hoan toan khoi doanh thu Team.
      var names = splitMulti_(o.cs, ',');
      if (!names.length) return;
      var mine = names.filter(function(n){ return memberSet.has(n); }).length;
      if (!mine) return;
      revenue += (+o.revenue||0) * mine / names.length;
      orders++;
    });
  });
  return { revenue: revenue, orders: orders };
}
function _computeTeamStats(csStats){
  return teams.map(function(t){
    var members = [...(new Set([t.leader].concat(t.members||[]).filter(Boolean)))];
    var agg = { id:t.id, name:t.name, color:t.color, leader:t.leader, members:members,
      held:0, closed:0, friend:0, cared:0, revenue:0, orders:0 };
    members.forEach(function(n){
      var s = csStats[n]; if(!s) return;
      agg.held+=s.held; agg.closed+=s.closed; agg.friend+=s.friend; agg.cared+=s.cared;
    });
    // Doanh thu/don: neu team co gioi han kenh thi tinh RIENG theo dung kenh do (khong dung
    // tong csStats cua CS, vi CS co the co don o kenh khac khong thuoc team nay). Team khong
    // gioi han kenh thi tinh nhu cu (cong don tat ca don cua thanh vien, moi kenh deu tinh).
    var rv = _revenueByMembersChannels(members, t.channels||[]);
    agg.revenue = rv.revenue; agg.orders = rv.orders;
    agg.closeRate = agg.held ? Math.round(agg.closed/agg.held*100) : 0;
    agg.friendRate = agg.held ? Math.round(agg.friend/agg.held*100) : 0;
    return agg;
  });
}
function _dashLoad() {
  try {
    var saved = localStorage.getItem('ome_dash_templates');
    if (saved) { var p = JSON.parse(saved); _dashTemplates = p.templates||[]; _dashActiveIdx = p.active||0; }
  } catch(e){}
  if (!_dashTemplates.length) {
    _dashTemplates = [{ name:'Mặc định', widgets: JSON.parse(JSON.stringify(_DEFAULT_DASH_WIDGETS)) }];
    _dashActiveIdx = 0;
  }
  if (_dashActiveIdx >= _dashTemplates.length) _dashActiveIdx = 0;
}
function _dashSave() {
  try { localStorage.setItem('ome_dash_templates', JSON.stringify({templates:_dashTemplates, active:_dashActiveIdx})); } catch(e){}
}
function _dashWidgets() { return _dashTemplates[_dashActiveIdx] ? _dashTemplates[_dashActiveIdx].widgets : []; }

// ── helpers ─────────────────────────────────────────────
function _dbar(pct, color){
  return '<div class="dash-bar"><div class="dash-bar-fill" style="width:'+Math.min(100,pct||0)+'%;background:'+(color||'var(--green)')+'"></div></div>';
}
function _drank(arr, valFn, subFn){
  if (!arr||!arr.length) return '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:14px">Chưa có dữ liệu</td></tr>';
  return arr.map(function(s,i){
    var m=i===0?'rank-1':(i===1?'rank-2':(i===2?'rank-3':''));
    return '<tr><td><span class="rank-badge '+m+'">'+(i+1)+'</span> '+esc(s.name)+'</td>'+
           '<td style="text-align:right;font-weight:700">'+valFn(s)+'</td>'+
           '<td style="color:var(--muted);font-size:11px">'+(subFn?subFn(s):'')+'</td></tr>';
  }).join('');
}
function _dkpi(label,val,sub){
  return '<div class="kpi-card"><div class="kpi-val">'+val+'</div><div class="kpi-label">'+label+'</div>'+(sub?'<div class="kpi-sub">'+sub+'</div>':'')+'</div>';
}
function _dfmtV(v){ return typeof fmtVND==='function'?fmtVND(v):fmt(v); }

// ── pivot engine ─────────────────────────────────────────
function _dashPivot(list, rowKey, colKey, metric) {
  var ROW_KEYS = {
    'month':    function(o){ return o.year&&o.month ? (o.year+'-'+String(o.month).padStart(2,'0')) : '—'; },
    'cs':       function(o){ return o.cs||'—'; },
    'product':  function(o){ return o.product||'—'; },
    'source':   function(o){ return o.source||'—'; },
    'tier':     function(o,c){ return c.tier||'—'; },
  };
  var COL_KEYS = {
    'cs':       function(o){ return o.cs||'—'; },
    'month':    function(o){ return o.year&&o.month ? (o.year+'-'+String(o.month).padStart(2,'0')) : '—'; },
    'product':  function(o){ return o.product||'—'; },
    'source':   function(o){ return o.source||'—'; },
    'tier':     function(o,c){ return c.tier||'—'; },
  };
  var MET = {
    'revenue': function(o){ return +(o.revenue)||0; },
    'orders':  function(){ return 1; },
    'kh':      function(){ return 0; }, // handled separately
  };

  var rFn = ROW_KEYS[rowKey] || ROW_KEYS['month'];
  var cFn = COL_KEYS[colKey] || COL_KEYS['cs'];
  var mFn = MET[metric] || MET['revenue'];

  var rows={}, cols={}, data={}, colTotals={}, rowTotals={};
  var khByCell={};  // for kh metric: unique phones

  list.forEach(function(c){
    c.orders.forEach(function(o){
      var r=rFn(o,c), cl=cFn(o,c);
      rows[r]=true; cols[cl]=true;
      var k=r+'|'+cl;
      if (metric==='kh'){
        if(!khByCell[k]) khByCell[k]=new Set();
        khByCell[k].add(c.phone);
      } else {
        data[k]=(data[k]||0)+mFn(o,c);
        colTotals[cl]=(colTotals[cl]||0)+mFn(o,c);
        rowTotals[r]=(rowTotals[r]||0)+mFn(o,c);
      }
    });
    if (metric==='kh'){
      // also ensure row/col from tier if needed
    }
  });

  if (metric==='kh'){
    Object.keys(khByCell).forEach(function(k){
      var v=khByCell[k].size;
      data[k]=v;
      var parts=k.split('|'); var r=parts[0],cl=parts.slice(1).join('|');
      rowTotals[r]=(rowTotals[r]||0)+v;
      colTotals[cl]=(colTotals[cl]||0)+v;
    });
  }

  var rowArr = Object.keys(rows).sort();
  var colArr = Object.keys(cols).sort();
  if (colArr.length > 12) colArr = colArr.slice(0,12); // cap columns

  var fmtCell = metric==='revenue' ? _dfmtV : fmt;

  var grand=0; Object.values(rowTotals).forEach(function(v){grand+=v;});

  var html='<div style="overflow-x:auto"><table class="dash-table" style="font-size:11px;min-width:100%">'+
    '<thead><tr><th style="white-space:nowrap">'+_dashDimLabel(rowKey)+'</th>'+
    colArr.map(function(c){ return '<th style="text-align:right;white-space:nowrap">'+esc(c)+'</th>'; }).join('')+
    '<th style="text-align:right;background:var(--surface2)">Tổng</th></tr></thead><tbody>';

  rowArr.forEach(function(r){
    html+='<tr><td style="font-weight:600;white-space:nowrap">'+esc(r)+'</td>';
    colArr.forEach(function(cl){
      var v=data[r+'|'+cl]||0;
      html+='<td style="text-align:right">'+(v?fmtCell(v):'—')+'</td>';
    });
    html+='<td style="text-align:right;font-weight:700;background:var(--surface2)">'+fmtCell(rowTotals[r]||0)+'</td></tr>';
  });

  html+='<tr style="border-top:2px solid var(--border)"><td style="font-weight:700">Tổng</td>';
  colArr.forEach(function(cl){ html+='<td style="text-align:right;font-weight:700">'+fmtCell(colTotals[cl]||0)+'</td>'; });
  html+='<td style="text-align:right;font-weight:700;background:var(--green-bg);color:var(--green)">'+fmtCell(grand)+'</td></tr>';
  html+='</tbody></table></div>';
  return html;
}
function _dashDimLabel(k){
  return {month:'Tháng',cs:'CS',product:'Sản phẩm',source:'Nguồn',tier:'Phân hạng'}[k]||k;
}
function _dashMetLabel(k){
  return {revenue:'Doanh thu',orders:'Số đơn',kh:'Số KH'}[k]||k;
}

// ── render từng widget ────────────────────────────────────
function _dashRenderWidget(w, idx, list, csArr, teamStats, totalKH) {
  var t = w.type;
  var cfg = w.cfg || {};
  var def = _DASH_WIDGET_DEFS.find(function(d){ return d.type===t; }) || {};
  var fullW = def.full ? 'grid-column:1/-1' : '';

  var inner = '';
  if (t==='kpi') {
    var totalRev=list.reduce(function(s,c){return s+(+c.totalRevenue||0);},0);
    var totalOrders=list.reduce(function(s,c){return s+(+c.totalOrders||0);},0);
    var friended=list.filter(function(c){return c.zaloStatus==='Đã kết bạn';}).length;
    var notFriended=list.filter(function(c){return c.zaloStatus&&c.zaloStatus!=='Đã kết bạn';}).length;
    var closed=list.filter(function(c){return c.careStatus==='Chốt';}).length;
    var schedAll=typeof schedules!=='undefined'?schedules:[];
    var overdue=schedAll.filter(function(it){try{return typeof isOverdue==='function'&&isOverdue(it);}catch(e){return false;}}).length;
    inner='<div class="kpi-grid">'+
      _dkpi('Khách hàng',fmt(totalKH))+
      _dkpi('Doanh thu',_dfmtV(totalRev))+
      _dkpi('Tổng đơn',fmt(totalOrders))+
      _dkpi('Đã chốt',fmt(closed),totalKH?Math.round(closed/totalKH*100)+'% KH':'')+
      _dkpi('Đã kết bạn Zalo',fmt(friended))+
      _dkpi('Chưa kết bạn',fmt(notFriended))+
      _dkpi('Lịch chăm sóc',fmt(schedAll.length))+
      _dkpi('Quá hạn',fmt(overdue))+
    '</div>';

  } else if (t==='tier') {
    var tiers={'VIP':0,'Thân thiết':0,'Tiềm năng':0,'Chưa bán lại được':0};
    list.forEach(function(c){if(tiers[c.tier]!=null)tiers[c.tier]++;else tiers[c.tier]=(tiers[c.tier]||0)+1;});
    var tierColors={'VIP':'var(--vip)','Thân thiết':'var(--tt)','Tiềm năng':'var(--tn)','Chưa bán lại được':'var(--muted)'};
    inner='<table class="dash-table">';
    Object.keys(tiers).forEach(function(t2){
      var pct=totalKH?Math.round(tiers[t2]/totalKH*100):0;
      inner+='<tr><td style="width:130px">'+esc(t2)+'</td><td>'+_dbar(pct,tierColors[t2]||'var(--green)')+'</td>'+
        '<td style="text-align:right;width:78px;font-weight:700">'+fmt(tiers[t2])+'<span style="color:var(--muted);font-weight:400;font-size:11px"> · '+pct+'%</span></td></tr>';
    });
    inner+='</table>';

  } else if (t==='top_rev') {
    var topRev=csArr.slice().sort(function(a,b){return b.revenue-a.revenue;}).slice(0,8);
    inner='<table class="dash-table">'+_drank(topRev,function(s){return _dfmtV(s.revenue);},function(s){return fmt(s.orders)+' đơn';})+'</table>';

  } else if (t==='top_close') {
    var topClose=csArr.filter(function(s){return s.held>=5;}).sort(function(a,b){return b.closeRate-a.closeRate;}).slice(0,8);
    inner='<table class="dash-table">'+_drank(topClose,function(s){return s.closeRate+'%';},function(s){return s.closed+'/'+s.held+' KH';})+'</table>';

  } else if (t==='team') {
    var topTeam=teamStats.slice().sort(function(a,b){return b.revenue-a.revenue;});
    inner='<table class="dash-table">';
    if(!topTeam.length){inner+='<tr><td style="color:var(--muted)">Chưa có team nào</td></tr>';}
    topTeam.forEach(function(tm){
      inner+='<tr><td><span class="rank-badge" style="background:'+(tm.color||'var(--green)')+';color:#fff">●</span> '+esc(tm.name)+
        '<div style="color:var(--muted);font-size:11px">'+_groupNamesByPerson(tm.members).length+' CS · chốt '+tm.closeRate+'%</div></td>'+
        '<td style="text-align:right;font-weight:700">'+_dfmtV(tm.revenue)+'</td>'+
        '<td style="text-align:right;color:var(--muted);font-size:11px">'+fmt(tm.orders)+' đơn</td></tr>';
    });
    inner+='</table>';

  } else if (t==='cs_detail') {
    var detail=csArr.slice().sort(function(a,b){return b.revenue-a.revenue;});
    inner='<div style="overflow-x:auto"><table class="dash-table"><thead><tr>'+
      '<th>CS</th><th style="text-align:right">Giữ</th><th style="text-align:right">Chốt</th>'+
      '<th style="text-align:right">Tỉ lệ</th><th style="text-align:right">Kết bạn</th>'+
      '<th style="text-align:right">Doanh thu</th><th style="text-align:right">Đơn</th></tr></thead><tbody>';
    if(!detail.length){inner+='<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:14px">Chưa có dữ liệu</td></tr>';}
    detail.forEach(function(s){
      inner+='<tr><td style="font-weight:600">'+esc(s.name)+'</td>'+
        '<td style="text-align:right">'+fmt(s.held)+'</td><td style="text-align:right">'+fmt(s.closed)+'</td>'+
        '<td style="text-align:right">'+s.closeRate+'%</td><td style="text-align:right">'+fmt(s.friend)+'</td>'+
        '<td style="text-align:right;font-weight:600">'+_dfmtV(s.revenue)+'</td>'+
        '<td style="text-align:right">'+fmt(s.orders)+'</td></tr>';
    });
    inner+='</tbody></table></div>';

  } else if (t==='pivot') {
    var row=cfg.row||'month', col=cfg.col||'cs', met=cfg.metric||'revenue';
    var dims=['month','cs','product','source','tier'];
    var mets=['revenue','orders','kh'];
    inner='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:12px">'+
      '<span style="color:var(--muted)">Hàng:</span>'+
      '<select style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface)" onchange="'+
        '_dashWidgets()['+idx+'].cfg=_dashWidgets()['+idx+'].cfg||{};_dashWidgets()['+idx+'].cfg.row=this.value;_dashSave();renderDashboard()">'+
        dims.map(function(d){return '<option value="'+d+'"'+(d===row?' selected':'')+'>'+_dashDimLabel(d)+'</option>';}).join('')+'</select>'+
      '<span style="color:var(--muted)">Cột:</span>'+
      '<select style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface)" onchange="'+
        '_dashWidgets()['+idx+'].cfg=_dashWidgets()['+idx+'].cfg||{};_dashWidgets()['+idx+'].cfg.col=this.value;_dashSave();renderDashboard()">'+
        dims.map(function(d){return '<option value="'+d+'"'+(d===col?' selected':'')+'>'+_dashDimLabel(d)+'</option>';}).join('')+'</select>'+
      '<span style="color:var(--muted)">Metric:</span>'+
      '<select style="font-size:11px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface)" onchange="'+
        '_dashWidgets()['+idx+'].cfg=_dashWidgets()['+idx+'].cfg||{};_dashWidgets()['+idx+'].cfg.metric=this.value;_dashSave();renderDashboard()">'+
        mets.map(function(m){return '<option value="'+m+'"'+(m===met?' selected':'')+'>'+_dashMetLabel(m)+'</option>';}).join('')+'</select>'+
    '</div>'+
    _dashPivot(list, row, col, met);
  }

  return '<div class="dash-widget" style="'+fullW+'" draggable="true"'+
    ' ondragstart="_dashDragSrc='+idx+';this.style.opacity=\'.4\'"'+
    ' ondragend="this.style.opacity=\'1\'"'+
    ' ondragover="event.preventDefault()"'+
    ' ondrop="_dashDrop('+idx+')"'+
    '>'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">'+
      '<span style="cursor:grab;color:var(--hint);font-size:16px;line-height:1" title="Kéo để di chuyển">⠿</span>'+
      '<span style="font-weight:700;font-size:13px;flex:1">'+(def.label||t)+'</span>'+
      '<button onclick="_dashRemoveWidget('+idx+')" style="border:none;background:none;cursor:pointer;color:var(--hint);font-size:15px;line-height:1;padding:0" title="Xóa widget">✕</button>'+
    '</div>'+
    inner+
  '</div>';
}

function _dashDrop(targetIdx) {
  if (_dashDragSrc===null||_dashDragSrc===targetIdx) return;
  var ws=_dashWidgets();
  var moved=ws.splice(_dashDragSrc,1)[0];
  ws.splice(targetIdx,0,moved);
  _dashSave();
  renderDashboard();
}
function _dashRemoveWidget(idx) {
  _dashWidgets().splice(idx,1);
  _dashSave();
  renderDashboard();
}
function _dashAddWidget(type) {
  var existing=_dashWidgets().find(function(w){return w.type===type;});
  if (existing&&type!=='pivot') { toast('Widget này đã có trên dashboard'); return; }
  var w={type:type};
  if (type==='pivot') w.cfg={row:'month',col:'cs',metric:'revenue'};
  _dashWidgets().push(w);
  _dashSave();
  renderDashboard();
}
function _dashSaveTemplate() {
  var name=prompt('Đặt tên mẫu báo cáo:');
  if (!name) return;
  var snapshot={name:name, widgets:JSON.parse(JSON.stringify(_dashWidgets()))};
  _dashTemplates.push(snapshot);
  _dashActiveIdx=_dashTemplates.length-1;
  _dashSave();
  renderDashboard();
  toast('✓ Đã lưu mẫu "'+name+'"');
}
function _dashDeleteTemplate() {
  if (_dashTemplates.length<=1){toast('Phải giữ ít nhất 1 mẫu');return;}
  if(!confirm('Xóa mẫu "'+_dashTemplates[_dashActiveIdx].name+'"?')) return;
  _dashTemplates.splice(_dashActiveIdx,1);
  _dashActiveIdx=Math.max(0,_dashActiveIdx-1);
  _dashSave();
  renderDashboard();
}
function _dashResetTemplate() {
  if(!confirm('Khôi phục mẫu về mặc định?')) return;
  _dashTemplates[_dashActiveIdx].widgets=JSON.parse(JSON.stringify(_DEFAULT_DASH_WIDGETS));
  _dashSave();
  renderDashboard();
}

function renderDashboard(){
  _dashLoad();
  _dashFilterLoad();
  var wrap = document.getElementById('dash-wrap');
  if (!wrap) return;

  var f = _dashFilter;
  // Danh sách CS được phép xem (theo quyền) — dùng để dựng dropdown Nhân viên
  var scopeList = (typeof allCustomers!=='undefined'?allCustomers:[]).filter(_inUserScope);

  // 1) Lọc theo TEAM / NHÂN VIÊN: giữ KH mà người phụ trách (hoặc CS đang giữ) nằm trong nhóm đã chọn
  var nameFilter = null;               // null = không lọc
  if (f.cs) nameFilter = new Set([f.cs]);
  else if (f.team){
    var tObj = teams.find(function(t){ return String(t.id)===String(f.team) || t.name===f.team; });
    nameFilter = _teamMemberSet(tObj);
  }
  var list = scopeList.filter(function(c){
    if (nameFilter && nameFilter.size){
      var hit = false;
      var h = _heldBy(c); if (h && nameFilter.has(h)) hit = true;
      if (!hit && c.careCSSet) c.careCSSet.forEach(function(n){ if (nameFilter.has(n)) hit = true; });
      if (!hit) (c.orders||[]).forEach(function(o){ if (o.cs && nameFilter.has(o.cs)) hit = true; });
      if (!hit) return false;
    }
    // 2) Lọc THỜI GIAN: khi có chọn khoảng ngày, chỉ tính KH có ít nhất 1 đơn trong khoảng đó
    if (f.from || f.to){
      return (c.orders||[]).some(function(o){ return _dashOrderInRange(o, f.from, f.to); });
    }
    return true;
  });

  var totalKH = list.length;
  var csStats = _computeCSStats(list, f.from, f.to);
  var csArr = Object.keys(csStats).map(function(k){return csStats[k];});
  if (currentUser.role!=='admin'){
    var myNamesDash = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name?[currentUser.name]:[]);
    csArr=csArr.filter(function(s){
      if(currentUser.role==='cs') return myNamesDash.indexOf(s.name) !== -1;
      var team=null;for(var i=0;i<teams.length;i++){if(myNamesDash.indexOf(teams[i].leader)!==-1||teams[i].name===currentUser.team){team=teams[i];break;}}
      var ms=_teamMemberSet(team);return ms.has(s.name);
    });
  }
  if (nameFilter && nameFilter.size) csArr = csArr.filter(function(s){ return nameFilter.has(s.name); });
  csArr.forEach(function(s){s.closeRate=s.held?Math.round(s.closed/s.held*100):0;s.friendRate=s.held?Math.round(s.friend/s.held*100):0;});
  var teamStats=_computeTeamStats(csStats);

  var ws=_dashWidgets();

  // toolbar
  var addMenu=_DASH_WIDGET_DEFS.map(function(d){
    return '<button onclick="_dashAddWidget(\''+d.type+'\')" style="display:block;width:100%;text-align:left;padding:6px 14px;border:none;background:none;cursor:pointer;font-size:12px;white-space:nowrap" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'none\'">'+d.label+'</button>';
  }).join('');

  var tplSelect=_dashTemplates.map(function(t,i){
    return '<option value="'+i+'"'+(i===_dashActiveIdx?' selected':'')+'>'+esc(t.name)+'</option>';
  }).join('');

  var toolbar='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">'+
    '<span style="font-weight:700;font-size:13px;flex:1">📊 Dashboard'+(currentUser.role!=='admin'?' — '+esc(((currentUser.names&&currentUser.names.length)?currentUser.names:[currentUser.name]).join(', ')):'')+'</span>'+
    '<div style="position:relative;display:inline-block">'+
      '<button class="btn sm" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'block\'?\'none\':\'block\'">+ Thêm widget ▾</button>'+
      '<div style="display:none;position:absolute;right:0;top:100%;margin-top:2px;background:var(--surface);border:1px solid var(--border);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.15);z-index:99;min-width:180px;padding:4px 0">'+addMenu+'</div>'+
    '</div>'+
    '<select style="font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)" onchange="_dashActiveIdx=+this.value;_dashSave();renderDashboard()" title="Chọn mẫu báo cáo">'+tplSelect+'</select>'+
    '<button class="btn sm" onclick="_dashSaveTemplate()" title="Lưu mẫu mới">💾 Lưu mẫu</button>'+
    '<button class="btn sm" onclick="_dashDeleteTemplate()" title="Xóa mẫu này" style="color:var(--red)">🗑</button>'+
    '<button class="btn sm" onclick="_dashResetTemplate()" title="Khôi phục mặc định">↺ Reset</button>'+
  '</div>' + _dashFilterBarHtml(scopeList);

  var grid='<div class="dash-widget-grid">';
  ws.forEach(function(w,i){
    grid+=_dashRenderWidget(w,i,list,csArr,teamStats,totalKH);
  });
  if(!ws.length) grid+='<div style="grid-column:1/-1;color:var(--hint);text-align:center;padding:40px">Chưa có widget nào — bấm "+ Thêm widget" để bắt đầu</div>';
  grid+='</div>';

  wrap.innerHTML=toolbar+grid;
}

function _dashFilterLoad(){
  var saved = loadLS('ome_dash_filter');
  if (saved && typeof saved === 'object') _dashFilter = Object.assign({ from:'', to:'', team:'', cs:'' }, saved);
}
function _dashFilterSave(){ saveLS('ome_dash_filter', _dashFilter); }
function _dashSetFilter(key, val){
  _dashFilter[key] = val || '';
  // Chọn Team mới thì bỏ chọn nhân viên cũ (nhân viên đó có thể không thuộc team vừa chọn)
  if (key === 'team') _dashFilter.cs = '';
  _dashFilterSave();
  renderDashboard();
}
function _dashSetPreset(preset){
  // Dung chung bo loc nhanh _pkQuickRange: hom nay/hom qua/tuan/thang/quy/nam (nay + truoc)
  var map = { today:'today', yesterday:'yesterday', thisweek:'thisWeek', lastweek:'lastWeek', month:'thisMonth', last:'lastMonth', q:'thisQuarter', lastq:'lastQuarter', year:'thisYear', lasty:'lastYear' };
  if (preset === 'all') { _dashFilter.from=''; _dashFilter.to=''; }
  else if (map[preset]) { var rg = _pkQuickRange(map[preset]); if (rg){ _dashFilter.from=rg.from; _dashFilter.to=rg.to; } }
  _dashFilterSave();
  renderDashboard();
}
function _dashFilterBarHtml(scopeList){
  var f = _dashFilter;
  // Team: admin xem hết, còn lại chỉ thấy team của mình
  var teamOpts = teams.filter(function(t){
    if (currentUser.role === 'admin') return true;
    var myNames = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name?[currentUser.name]:[]);
    return t.name === currentUser.team || myNames.indexOf(t.leader) !== -1;
  });
  // Nhân viên: nếu đã chọn team thì chỉ liệt kê người trong team đó
  var csNames;
  if (f.team){
    var tObj = teams.find(function(t){ return String(t.id)===String(f.team) || t.name===f.team; });
    csNames = [...(_teamMemberSet(tObj)||new Set())];
  } else {
    csNames = [...new Set(scopeList.flatMap(function(c){
      return [..._buildCsSet_(c.orders, c.phone), ...(c.careCSSet||[])];
    }).filter(Boolean))];
  }
  csNames.sort(function(a,b){ return a.localeCompare(b,'vi'); });

  var presets = [['all','Tất cả'],['today','Hôm nay'],['yesterday','Hôm qua'],['thisweek','Tuần này'],['lastweek','Tuần trước'],['month','Tháng này'],['last','Tháng trước'],['q','Quý này'],['lastq','Quý trước'],['year','Năm nay'],['lasty','Năm trước']];
  var isAll = !f.from && !f.to;
  var presetHtml = presets.map(function(p){
    var pmap = { today:'today', yesterday:'yesterday', thisweek:'thisWeek', lastweek:'lastWeek', month:'thisMonth', last:'lastMonth', q:'thisQuarter', lastq:'lastQuarter', year:'thisYear', lasty:'lastYear' };
    var prg = pmap[p[0]] ? _pkQuickRange(pmap[p[0]]) : null;
    var active = (p[0]==='all') ? isAll : !!(prg && f.from===prg.from && f.to===prg.to);
    return '<button class="btn sm'+(active?' primary':'')+'" style="padding:3px 9px;font-size:11px" onclick="_dashSetPreset(\''+p[0]+'\')">'+p[1]+'</button>';
  }).join('');

  var activeCount = (f.from||f.to?1:0) + (f.team?1:0) + (f.cs?1:0);

  return '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding:9px 11px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">'+
    '<span style="font-size:11px;font-weight:700;color:var(--muted)">🔎 Lọc</span>'+
    presetHtml+
    '<span style="color:var(--border-md)">|</span>'+
    '<span style="font-size:11px;color:var(--muted)">Từ</span>'+
    '<input type="date" value="'+esc(f.from)+'" onchange="_dashSetFilter(\'from\',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<span style="font-size:11px;color:var(--muted)">đến</span>'+
    '<input type="date" value="'+esc(f.to)+'" onchange="_dashSetFilter(\'to\',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<span style="color:var(--border-md)">|</span>'+
    '<select onchange="_dashSetFilter(\'team\',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)" title="Lọc theo Team">'+
      '<option value="">👥 Tất cả team</option>'+
      teamOpts.map(function(t){ return '<option value="'+esc(t.id)+'"'+(String(f.team)===String(t.id)?' selected':'')+'>'+esc(t.name)+'</option>'; }).join('')+
    '</select>'+
    '<select onchange="_dashSetFilter(\'cs\',this.value)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);max-width:160px" title="Lọc theo nhân viên">'+
      '<option value="">🧑 Tất cả nhân viên</option>'+
      csNames.map(function(n){ return '<option value="'+esc(n)+'"'+(f.cs===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+
    '</select>'+
    (activeCount ? '<button class="btn sm" style="padding:3px 9px;font-size:11px;color:var(--red)" onclick="_dashClearFilter()">✕ Xoá lọc ('+activeCount+')</button>' : '')+
    ((f.from||f.to) ? '<span style="font-size:10.5px;color:var(--hint);width:100%">Đang tính theo <b>ngày đặt đơn</b> — KH không có đơn nào trong khoảng này sẽ không được tính.</span>' : '')+
  '</div>';
}
function _dashClearFilter(){
  _dashFilter = { from:'', to:'', team:'', cs:'' };
  _dashFilterSave();
  renderDashboard();
}

function pushMktTeamsToGS(){
  saveLS('ome_mkt_teams', mktTeams);
  if (!gsUrl) return;
  fetch(gsUrl, { method:'POST', redirect:'follow',
    body: JSON.stringify({ action:'saveMktTeams', teams: mktTeams }) }).catch(function(){});
}
async function _mktLoadPages_(){
  if (_mktPagesCache || _mktPagesLoading || !gsUrl) return;
  _mktPagesLoading = true;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=pancakePageMap', { redirect:'follow' });
    var d = await r.json();
    _mktPagesCache = (d && d.allPages) || [];
    var map = (d && d.map) || {};
    _mktPagesCache.forEach(function(p){ p.kenh = map[p.pageId] || ''; });
  } catch(e){ _mktPagesCache = []; }
  _mktPagesLoading = false;
  if (typeof _activeV9Tab !== 'undefined' && _activeV9Tab === 'team') renderTeamTab();
}
function _mktTeamsHtml_(){
  var isAdmin = currentUser.role === 'admin';
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin:26px 0 8px">'+
    '<div class="dash-section-title" style="margin:0">📣 Nhóm MKT (chọn Page cho từng MKT)</div>'+
    (isAdmin ? '<button class="btn primary" onclick="_mktAddTeam()">+ Thêm MKT</button>' : '')+'</div>';
  h += '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Mỗi Page thường thuộc 1 MKT. Nếu 1 Page chạy chung nhiều MKT, tick Page đó ở từng MKT rồi nhập <b>tỷ lệ</b> (vd 1 và 1 = chia đôi 50/50; 2 và 1 = 67/33) — đơn/doanh thu/tương tác của Page sẽ chia theo tỷ lệ này. Page chưa tick ở MKT nào sẽ gom vào "(chưa gán MKT)". Áp dụng cho Báo cáo KPI, Báo cáo doanh số (TB đơn theo MKT) và Checklist MKT.</div>';
  if (!mktTeams.length){
    h += '<div style="color:var(--muted);padding:18px;text-align:center;border:1px dashed var(--border);border-radius:var(--rsm)">Chưa có nhóm MKT nào.'+(isAdmin?' Bấm “+ Thêm MKT”.':'')+'</div>';
    return h;
  }
  var pages = _mktPagesCache;
  if (!pages) h += '<div style="color:var(--muted);font-size:12px;margin-bottom:8px">Đang tải danh sách Page...</div>';
  pages = pages || [];
  if (_mktPagesCache && !pages.length) h += '<div style="color:#9a3412;font-size:12px;margin-bottom:8px">Chưa có Page nào — nạp báo cáo Pancake ở tab "📥 Báo cáo Pancake" trước để có danh sách Page.</div>';
  var usage = {}; // pageId -> số MKT đang chứa
  mktTeams.forEach(function(t){ (t.pages||[]).forEach(function(p){ usage[p.pageId] = (usage[p.pageId]||0)+1; }); });
  mktTeams.forEach(function(t){
    h += '<div style="border:1px solid var(--border);border-left:4px solid '+esc(t.color||'#1a6b45')+';border-radius:var(--rsm);padding:10px 12px;margin-bottom:10px">'+
      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">'+
      (isAdmin ? '<input type="text" value="'+esc(t.name)+'" onchange="_mktRename(\''+t.id+'\',this.value)" style="font-weight:700;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'
               : '<b>'+esc(t.name)+'</b>')+
      '<span style="font-size:11px;color:var(--muted)">'+(t.pages||[]).length+' page</span>'+
      (isAdmin ? '<button class="btn sm secondary" style="margin-left:auto" onclick="_mktDeleteTeam(\''+t.id+'\')">Xoá</button>' : '')+'</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    pages.forEach(function(pg){
      var mine = (t.pages||[]).find(function(x){ return x.pageId === pg.pageId; });
      var shared = mine && usage[pg.pageId] > 1;
      h += '<label class="team-cs-chk'+(mine?' on':'')+'" title="'+esc(pg.kenh ? 'Kênh bán: '+pg.kenh : 'Page chưa khớp Kênh bán')+'">'+
        '<input type="checkbox" '+(mine?'checked ':'')+(isAdmin?'':'disabled ')+'onchange="_mktTogglePage(\''+t.id+'\',\''+esc(pg.pageId)+'\',this.checked)">'+
        '<span>'+esc(pg.pageName||pg.pageId)+'</span>'+
        (shared ? ' <span style="font-size:10px;color:#b45309">chạy chung · tỷ lệ</span><input type="number" min="0.01" step="0.1" value="'+(mine.share||1)+'" '+(isAdmin?'':'disabled ')+'onchange="_mktSetShare(\''+t.id+'\',\''+esc(pg.pageId)+'\',this.value)" style="width:54px;padding:1px 4px;font-size:11px;border:1px solid var(--border);border-radius:4px">' : '')+
        '</label>';
    });
    h += '</div></div>';
  });
  return h;
}
function _mktFind_(id){ return mktTeams.find(function(x){ return x.id===id; }); }
function _mktAddTeam(){
  if (currentUser.role!=='admin'){ toast('Chỉ Admin mới tạo được nhóm MKT'); return; }
  var name = prompt('Tên MKT / nhóm MKT mới:', 'MKT ' + (mktTeams.length+1));
  if (name===null) return; name = name.trim(); if(!name) return;
  mktTeams.push({ id:'mkt'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name:name,
    color: V9_TEAM_COLORS[mktTeams.length % V9_TEAM_COLORS.length], pages:[] });
  logAudit('team','','','Tạo nhóm MKT: '+name); pushMktTeamsToGS(); renderTeamTab();
}
function _mktRename(id,name){ var t=_mktFind_(id); if(!t) return; t.name=(name||'').trim()||t.name; pushMktTeamsToGS(); }
function _mktDeleteTeam(id){
  var t=_mktFind_(id); if(!t) return;
  if (!confirm('Xoá nhóm MKT "'+t.name+'"? Các Page trong nhóm sẽ về "(chưa gán MKT)".')) return;
  mktTeams = mktTeams.filter(function(x){ return x.id!==id; });
  logAudit('team','',t.name,'Xoá nhóm MKT'); pushMktTeamsToGS(); renderTeamTab();
}
function _mktTogglePage(id,pageId,on){
  var t=_mktFind_(id); if(!t) return; t.pages = t.pages||[];
  var i = t.pages.findIndex(function(x){ return x.pageId===pageId; });
  if (on && i<0){
    var others = mktTeams.filter(function(o){ return o.id!==id && (o.pages||[]).some(function(x){ return x.pageId===pageId; }); });
    if (others.length) toast('Page này đang thuộc '+others.map(function(o){return o.name;}).join(', ')+' — nhập tỷ lệ chạy chung ở từng MKT.');
    t.pages.push({ pageId:pageId, share:1 });
  }
  if (!on && i>=0) t.pages.splice(i,1);
  pushMktTeamsToGS(); renderTeamTab();
}
function _mktSetShare(id,pageId,val){
  var t=_mktFind_(id); if(!t) return;
  var p=(t.pages||[]).find(function(x){ return x.pageId===pageId; }); if(!p) return;
  var n=Number(val); p.share=(isNaN(n)||n<=0)?1:n; pushMktTeamsToGS();
}

function pushTeamsToGS(){
  if (!gsUrl) return;
  fetch(gsUrl, { method:'POST', redirect:'follow',
    body: JSON.stringify({ action:'saveTeams', teams: teams }) }).catch(function(){});
}
function renderTeamTab(){
  var wrap = document.getElementById('team-wrap');
  if (!wrap) return;
  var isAdmin = currentUser.role === 'admin';
  var csStats = _computeCSStats();
  var allChannels = _allChannelNames();
  var html = '';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'+
    '<div class="dash-section-title" style="margin:0">👥 Quản lý Team CS</div>'+
    (isAdmin ? '<div style="display:flex;gap:8px">'+
        '<button class="btn sm" onclick="openSaleChannelsModal()">🏷️ Phân loại đội Sale</button>'+
        '<button class="btn primary" onclick="addTeam()">+ Thêm Team</button></div>'
             : '<span style="color:var(--muted);font-size:12px">Chỉ Admin mới chỉnh sửa được</span>')+
  '</div>';
  if (!teams.length){
    html += '<div style="color:var(--muted);padding:18px;text-align:center;border:1px dashed var(--border);border-radius:var(--rsm)">Chưa có team nào.'+(isAdmin?' Bấm “+ Thêm Team”.':'')+'</div>';
  }
  var allNames = _allCSNames();
  teams.forEach(function(t){
    var members = [...(new Set([t.leader].concat(t.members||[]).filter(Boolean)))];
    var channels = t.channels || [];
    var people = _groupNamesByPerson(members);   // thành viên tính theo NGƯỜI (1 người nhiều tên = 1)
    var s = _computeTeamStats(csStats).find(function(x){ return x.id===t.id; }) || {revenue:0,orders:0,held:0,closed:0,closeRate:0};
    html += '<div class="team-card" style="border-left:4px solid '+(t.color||'var(--green)')+'">';
    html += '<div class="team-card-head">'+
      '<input class="team-name-input" value="'+esc(t.name)+'" '+(isAdmin?'onchange="renameTeam(\''+t.id+'\',this.value)"':'disabled')+'>'+
      (isAdmin ? '<button class="icon-btn-sm" title="Xoá team" onclick="deleteTeam(\''+t.id+'\')">🗑</button>' : '')+
    '</div>';
    html += '<div class="team-stat-row">'+
      '<span>Leader: <b>'+(t.leader?esc(t.leader):'<span style=\'color:var(--muted)\'>chưa đặt</span>')+'</b></span>'+
      '<span>'+people.length+' thành viên'+(people.length!==members.length?' <span style="color:var(--muted);font-size:11px" title="Có người dùng nhiều tên (cùng 1 tài khoản) — đếm là 1">('+members.length+' tên)</span>':'')+'</span>'+
      '<span>Doanh thu: <b>'+(typeof fmtVND==='function'?fmtVND(s.revenue):fmt(s.revenue))+'</b>'+
        (channels.length ? ' <span style="color:var(--muted);font-size:11px">(chỉ tính '+channels.length+' kênh đã chọn)</span>' : '')+
      '</span>'+
      '<span>Chốt: <b>'+s.closeRate+'%</b></span>'+
    '</div>';
    // % hoa hồng theo team (đơn ≥15tr / <15tr) — dùng khi tính hoa hồng nhân viên (tab "💰 Hoa hồng")
    var rp = t.ratePct || {above15:0, below15:0};
    html += '<div class="team-stat-row" style="margin-top:2px">'+
      '<span>💰 % đơn ≥15tr: '+(isAdmin
        ? '<input type="number" step="0.1" min="0" max="100" value="'+(rp.above15||0)+'" style="width:60px" onchange="setTeamRate(\''+t.id+'\',\'above15\',this.value)">'
        : '<b>'+(rp.above15||0)+'</b>')+' %</span>'+
      '<span>% đơn &lt;15tr: '+(isAdmin
        ? '<input type="number" step="0.1" min="0" max="100" value="'+(rp.below15||0)+'" style="width:60px" onchange="setTeamRate(\''+t.id+'\',\'below15\',this.value)">'
        : '<b>'+(rp.below15||0)+'</b>')+' %</span>'+
    '</div>';
    // members chips
    html += '<div class="member-chips">';
    people.forEach(function(g){
      var m = g.primary;
      var isLeader = g.names.indexOf(t.leader) !== -1;
      var multi = g.names.length > 1;
      var label = esc(g.names[0]) + (multi ? ' <span style="color:var(--muted);font-size:11px">+ '+g.names.slice(1).map(esc).join(', ')+'</span>' : '');
      html += '<span class="member-chip'+(isLeader?' leader':'')+'"'+(multi?' title="Cùng 1 người (nhiều tên): '+esc(g.names.join(', '))+'"':'')+'>'+(isLeader?'★ ':'')+label+
        (isAdmin ? ' <span class="chip-x" data-name="'+esc(m)+'" title="'+(isLeader?'Bỏ làm leader sẽ vẫn còn là thành viên':(multi?'Xoá người này (cả '+g.names.length+' tên) khỏi team':'Xoá khỏi team'))+'" onclick="removeTeamMember(\''+t.id+'\',this.dataset.name)">✕</span>' : '')+
        (isAdmin && !isLeader ? ' <span class="chip-star" data-name="'+esc(m)+'" title="Đặt làm leader" onclick="setTeamLeader(\''+t.id+'\',this.dataset.name)">★</span>' : '')+
      '</span>';
    });
    html += '</div>';
    if (isAdmin){
      html += '<div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">'+
        '<div style="position:relative;flex:1;min-width:230px;max-width:430px">'+
          '<input class="team-add-input team-combo-inp" style="width:100%;box-sizing:border-box" autocomplete="off" data-team="'+t.id+'" placeholder="🔍 Gõ tên để tìm nhân viên (hoặc bấm để xổ danh sách)…" '+
            'oninput="_teamComboShow(this)" onfocus="_teamComboShow(this)" onblur="_teamComboHide(this)" onkeydown="_teamComboKey(event,this)">'+
          '<div class="team-combo-list" data-team="'+t.id+'" style="display:none"></div>'+
        '</div>'+
        '<button class="btn sm secondary" onclick="toggleTeamPicker(\''+t.id+'\')">'+(_teamPickerOpen[t.id]?'▴ Đóng chọn nhiều':'☑ Chọn nhiều CS')+'</button>'+
      '</div>';
      if (_teamPickerOpen[t.id]){
        html += '<div class="team-picker">';
        html += '<div class="team-picker-bar">'+
          '<input class="team-picker-search" placeholder="🔍 Tìm CS…" oninput="_teamPickerFilter(\''+t.id+'\',this.value)">'+
          '<button type="button" class="team-cs-all" onclick="teamPickAll(\''+t.id+'\',true)">✓ Chọn tất cả</button>'+
          '<button type="button" class="team-cs-all" onclick="teamPickAll(\''+t.id+'\',false)">✕ Bỏ tất cả</button>'+
          '<span style="font-size:11px;color:var(--muted);margin-left:auto">Đang chọn: <b>'+people.length+'</b> người/'+allNames.length+'</span>'+
        '</div>';
        html += '<div class="team-picker-grid" id="team-picker-grid-'+t.id+'">';
        allNames.forEach(function(n){
          var on = members.indexOf(n)!==-1;
          var isLeader = n===t.leader;
          html += '<label class="team-cs-chk'+(on?' on':'')+'" data-name="'+esc(n).toLowerCase()+'" title="'+(isLeader?'Leader (luôn là thành viên)':'')+'">'+
            '<input type="checkbox" '+(on?'checked':'')+' '+(isLeader?'disabled':'')+' data-name="'+esc(n)+'" onchange="setTeamMemberChecked(\''+t.id+'\',this.dataset.name,this.checked)">'+
            '<span>'+(isLeader?'★ ':'')+esc(n)+'</span></label>';
        });
        html += '</div></div>';
      }

      // Chọn kênh cho team (multi-select) — để trống = không giới hạn, tính mọi kênh như cũ.
      html += '<div style="margin-top:10px">';
      html += '<div style="font-size:11px;color:var(--muted);margin-bottom:4px">📡 Kênh bán riêng cho team (để trống = tính tất cả kênh)</div>';
      html += '<div class="member-chips">';
      channels.forEach(function(ch){
        html += '<span class="member-chip">'+esc(ch)+
          ' <span class="chip-x" data-name="'+esc(ch)+'" title="Bỏ kênh này" onclick="setTeamChannelChecked(\''+t.id+'\',this.dataset.name,false)">✕</span></span>';
      });
      if (!channels.length) html += '<span style="color:var(--muted);font-size:11.5px">(không giới hạn — tính tất cả kênh)</span>';
      html += '</div>';
      html += '<div style="display:flex;gap:8px;margin-top:6px;align-items:center;flex-wrap:wrap">'+
        '<button class="btn sm secondary" onclick="toggleTeamChanPicker(\''+t.id+'\')">'+(_teamChanPickerOpen[t.id]?'▴ Đóng chọn kênh':'☑ Chọn kênh')+'</button>'+
      '</div>';
      if (_teamChanPickerOpen[t.id]){
        html += '<div class="team-picker">';
        html += '<div class="team-picker-bar">'+
          '<input class="team-picker-search" placeholder="🔍 Tìm kênh…" oninput="_teamChanPickerFilter(\''+t.id+'\',this.value)">'+
          '<button type="button" class="team-cs-all" onclick="teamChannelPickAll(\''+t.id+'\',true)">✓ Chọn tất cả</button>'+
          '<button type="button" class="team-cs-all" onclick="teamChannelPickAll(\''+t.id+'\',false)">✕ Bỏ tất cả (= không giới hạn)</button>'+
          '<span style="font-size:11px;color:var(--muted);margin-left:auto">Đang chọn: <b>'+channels.length+'</b>/'+allChannels.length+'</span>'+
        '</div>';
        html += '<div class="team-picker-grid" id="team-chan-grid-'+t.id+'">';
        if (!allChannels.length) html += '<div style="color:var(--muted);font-size:12px;padding:8px">Chưa có kênh nào trong dữ liệu đơn hàng.</div>';
        allChannels.forEach(function(ch){
          var on = channels.indexOf(ch)!==-1;
          html += '<label class="team-cs-chk'+(on?' on':'')+'" data-name="'+esc(ch).toLowerCase()+'">'+
            '<input type="checkbox" '+(on?'checked':'')+' data-name="'+esc(ch)+'" onchange="setTeamChannelChecked(\''+t.id+'\',this.dataset.name,this.checked)">'+
            '<span>'+esc(ch)+'</span></label>';
        });
        html += '</div></div>';
      }
      html += '</div>';
    }
    html += '</div>';
  });
  wrap.innerHTML = html + _mktTeamsHtml_();
  _mktLoadPages_();
}
function _genTeamId(){ return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function addTeam(){
  if (currentUser.role!=='admin'){ toast('Chỉ Admin mới tạo được team'); return; }
  var name = prompt('Tên team mới:', 'Team ' + (teams.length+1));
  if (name===null) return;
  name = name.trim(); if(!name) return;
  teams.push({ id:_genTeamId(), name:name, leader:'', members:[], color: V9_TEAM_COLORS[teams.length % V9_TEAM_COLORS.length], channels:[], ratePct: {above15:0, below15:0} });
  saveLS('ome_teams', teams);
  logAudit('team', '', '', 'Tạo team: '+name);
  pushTeamsToGS();
  renderTeamTab();
}
function renameTeam(id, name){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  var old = t.name; t.name = (name||'').trim() || old;
  saveLS('ome_teams', teams); logAudit('team','', old, 'Đổi tên team → '+t.name); pushTeamsToGS();
}
// % hoa hồng team cho đơn ≥15tr / <15tr — dùng để tính "💰 Hoa hồng" khi nhân viên không có
// mức riêng (xem _resolveCommissionRate_). field = 'above15' | 'below15'.
function setTeamRate(id, field, val){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  if (currentUser.role!=='admin'){ toast('Chỉ Admin mới đổi được % hoa hồng team'); return; }
  var v = Math.max(0, Math.min(100, parseFloat(val)||0));
  if (!t.ratePct) t.ratePct = {above15:0, below15:0};
  var old = t.ratePct[field]||0;
  t.ratePct[field] = v;
  saveLS('ome_teams', teams);
  logAudit('team', '', field+': '+old+'%', field+': '+v+'% (team '+t.name+')');
  pushTeamsToGS();
}

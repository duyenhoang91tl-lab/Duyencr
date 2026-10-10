function _hideLogin(){ var ov = document.getElementById('login-overlay'); if (ov) ov.classList.remove('show'); }

// Cổng đăng nhập khi mở app
async function _authGate(){
  try{
    var ov = document.getElementById('login-overlay');
    var maybeNeed = (accounts && accounts.length > 0) || !!gsUrl;
    if (maybeNeed && ov){
      var ld = document.getElementById('login-loading'); if (ld) ld.style.display = '';
      var f = document.getElementById('login-form'); if (f) f.style.display = 'none';
      ov.classList.add('show');
    }

    // Tải tài khoản mới nhất từ GSheets — có timeout 7s
    var pullOk = false;
    if (gsUrl) {
      try { pullOk = await pullUsers(); } catch(e){ console.warn('pullUsers error:', e); }
    }

    if (!accounts || accounts.length === 0){
      if (gsUrl) {
        // Có cấu hình GSheets nhưng pull thất bại → hiện lỗi + nút thử lại + nút đổi URL
        if (!pullOk) {
          var ld2 = document.getElementById('login-loading');
          if (ld2){
            ld2.innerHTML = '<div style="color:#c0392b;font-weight:600;margin-bottom:8px">⚠ Không kết nối được máy chủ GAS.</div>'
              + '<div style="font-size:12px;color:#555;margin-bottom:12px">URL đang dùng:<br><code style="font-size:11px;word-break:break-all">' + gsUrl.substring(0,80) + '...</code></div>'
              + '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">'
              + '<button onclick="_authGate()" style="padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">🔄 Thử lại</button>'
              + '<button onclick="var ov=document.getElementById(\'login-overlay\');if(ov)ov.classList.remove(\'show\');openGsModal();" style="padding:6px 16px;background:#fff;color:#2563eb;border:1.5px solid #2563eb;border-radius:6px;cursor:pointer;font-size:13px">🔗 Đổi URL GAS</button>'
              + '</div>';
            ld2.style.display = '';
          }
          var f2 = document.getElementById('login-form'); if (f2) f2.style.display = 'none';
          return;
        }
        // pull thành công nhưng sheet thật sự chưa có tài khoản nào → bootstrap hợp lệ
      }
      _bootstrapAdmin = true;
      _hideLogin();
      _renderAuthHeader();
      if (typeof toast === 'function') setTimeout(function(){ toast('Chưa có tài khoản. Bấm "🔑 Tài khoản" trên thanh tiêu đề để tạo tài khoản admin & nhân viên.'); }, 900);
      return;
    }
    var sess = _authAccount && _findAccount(_authAccount.username);
    var _demoTokMissing = sess && sess.role === 'demo' && !(function(){ try { return localStorage.getItem('ome_demo_token'); } catch(e){ return ''; } })();
    if (sess && sess.active !== false && !_demoTokMissing){
      _hideLogin();
      _applyAuthIdentity(sess);
    } else {
      _authAccount = null;
      _showLogin();
    }
  }catch(e){
    // Fail-open: không khoá chết công cụ nếu có lỗi bất ngờ
    _hideLogin();
    console.error('authGate error', e);
  }
}

// ════════════════════════════════════════════════════════════════════
//  SỬA TRƯỜNG TRỰC TIẾP NGAY Ở Ô TRƯỜNG (admin) — thay cho 2 nút ✏️ cạnh "Admin" trên header
// ════════════════════════════════════════════════════════════════════
// Nút ✏ nằm cạnh nhãn của MỌI trường trong hồ sơ khách (Tình trạng CS, Kết bạn Zalo, Trạng thái KH và các trường tự tạo,
// kể cả đã tạo từ trước): đổi tên hiển thị + sửa danh sách lựa chọn. Cây lựa chọn mẹ/con của CS / KH / trường tự tạo vẫn
// sửa ở trình soạn cây có sẵn (nút "Sửa danh sách lựa chọn" mở đúng trường đó); "Kết bạn Zalo" sửa thẳng trong hộp này.
function _fieldEditBtn(key) {
  var isAdmin = (typeof _authAccount !== 'undefined' && _authAccount && _authAccount.role === 'admin') || (typeof _bootstrapAdmin !== 'undefined' && _bootstrapAdmin);
  return isAdmin ? '<button type="button" class="fld-edit-btn" title="Sửa trường này (tên, lựa chọn)" onclick="openFieldEditor(\'' + String(key).replace(/'/g, "\\'") + '\')">✏</button>' : '';
}
function _feCfIndex(key) { var id = String(key).slice(3); return CUSTOM_FIELDS.findIndex(function(f){ return f.id === id; }); }
function _feCurLabel(key) {
  if (key === 'cs') return FIELD_LABEL_CS;
  if (key === 'kh') return FIELD_LABEL_KH;
  if (key === 'zalo') return FIELD_LABEL_ZALO;
  var i = _feCfIndex(key); return i >= 0 ? CUSTOM_FIELDS[i].label : '';
}
function openFieldEditor(key) {
  var isAdmin = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  if (!isAdmin) { toast('Chỉ admin mới sửa trường.'); return; }
  if (key.indexOf('cf:') === 0 && _feCfIndex(key) < 0) { toast('Không tìm thấy trường này (có thể đã bị xoá).'); return; }
  var old = document.getElementById('fld-edit-modal'); if (old) old.remove();
  var extra = key === 'zalo'
    ? '<div class="form-label" style="margin:10px 0 4px">Các lựa chọn (mỗi dòng 1 lựa chọn)</div>' +
      '<textarea id="fe-opts" class="form-ta" rows="9" style="width:100%;box-sizing:border-box">' + esc(ZALO_STATUS.join('\n')) + '</textarea>' +
      '<div style="font-size:11px;color:var(--hint);margin-top:4px">Lựa chọn <b>"Đã kết bạn"</b> luôn được giữ (hệ thống dùng để tính tỷ lệ phản hồi Zalo) — đừng đổi tên nó. Khách đang có giá trị đã bị xoá vẫn giữ nguyên giá trị đó. Zalo AI / Pancake AI dùng danh sách riêng trong extension.</div>'
    : '<div style="margin-top:10px"><button type="button" class="btn sm" onclick="_feOpenTree(\'' + key + '\')">⚙ Sửa danh sách lựa chọn (mẹ / con)…</button></div>';
  var m = document.createElement('div');
  m.id = 'fld-edit-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding-top:60px';
  m.innerHTML = '<div style="background:var(--surface);border-radius:10px;padding:16px;width:min(440px,92vw);box-shadow:0 10px 30px rgba(0,0,0,.25)">' +
    '<div style="font-size:14px;font-weight:700;margin-bottom:10px">✏ Sửa trường</div>' +
    '<div class="form-label" style="margin-bottom:4px">Tên hiển thị</div>' +
    '<input id="fe-label" class="form-input" style="width:100%;box-sizing:border-box" value="' + esc(_feCurLabel(key)) + '">' + extra +
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
      '<button type="button" class="btn sm" onclick="document.getElementById(\'fld-edit-modal\').remove()">Hủy</button>' +
      '<button type="button" class="btn sm primary" id="fe-save" onclick="_feSave(\'' + key + '\')">💾 Lưu</button></div></div>';
  m.addEventListener('mousedown', function(e){ if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  var inp = document.getElementById('fe-label'); if (inp) { inp.focus(); inp.select(); }
}
function _feOpenTree(key) {
  var m = document.getElementById('fld-edit-modal'); if (m) m.remove();
  if (key === 'cs') openCareStatusModal();
  else if (key === 'kh') openKhStatusModal();
  else if (key.indexOf('cf:') === 0) {
    var i = _feCfIndex(key);
    openCustomFieldsModal();
    if (i >= 0) { _cfEditingIdx = i; _renderCfModal(); }
  }
}
async function _fePostSetting(key, value) {
  if (!gsUrl) return 'local';
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key: key, value: value }) });
    var d = await r.json().catch(function(){ return {}; });
    return (d && d.error) ? ('lỗi GSheets: ' + d.error) : 'ok';
  } catch(e) { return 'lỗi mạng: ' + e.message; }
}
async function _feSave(key) {
  var name = (document.getElementById('fe-label').value || '').trim();
  if (!name) { toast('Tên không được để trống.'); return; }
  var btn = document.getElementById('fe-save'); if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang lưu...'; }
  var status = 'ok', domOnly = true;
  if (key === 'cs' || key === 'kh') {
    if (key === 'kh') { FIELD_LABEL_KH = name; saveLS('ome_field_label_kh', name); } else { FIELD_LABEL_CS = name; saveLS('ome_field_label_cs', name); }
    _applyFieldLabels();
    status = await _fePostSetting(key === 'kh' ? 'fieldLabelKH' : 'fieldLabelCS', name);
  } else if (key === 'zalo') {
    var opts = (document.getElementById('fe-opts').value || '').split('\n');
    FIELD_LABEL_ZALO = name; saveLS('ome_field_label_zalo', name);
    _zaloApplyOpts_(opts); saveLS('ome_zalo_status_opts', ZALO_STATUS.slice());
    var sel = document.getElementById('cs-zalo');   // vẽ lại các lựa chọn tại chỗ, giữ giá trị đang chọn (không vẽ lại cả form để khỏi mất chữ CS đang gõ)
    if (sel) sel.innerHTML = _zaloOptionsHtml_(sel.value);
    var s1 = await _fePostSetting('fieldLabelZalo', name), s2 = await _fePostSetting('zaloStatusOpts', JSON.stringify(ZALO_STATUS));
    status = (s1 === 'ok' && s2 === 'ok') ? 'ok' : (s1 === 'local' ? 'local' : (s1 !== 'ok' ? s1 : s2));
  } else {
    var i = _feCfIndex(key);
    if (i >= 0 && CUSTOM_FIELDS[i].label !== name) {
      _cfDraft = JSON.parse(JSON.stringify(CUSTOM_FIELDS)); _cfDraft[i].label = name;
      domOnly = false;
      await saveCustomFields();   // đã tự lưu local + đồng bộ GAS + vẽ lại form chi tiết
    }
  }
  var el = document.querySelector('.fld-lbl[data-fld="' + key + '"]');
  if (el && el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = name;   // đổi chữ nhãn ngay, giữ nguyên nút ✏
  var m = document.getElementById('fld-edit-modal'); if (m) m.remove();
  if (domOnly) toast(status === 'ok' ? '✓ Đã lưu và đồng bộ' : status === 'local' ? '✓ Đã lưu (local)' : '✓ Đã lưu local — chưa đồng bộ: ' + status);
}

// Nút tài khoản / đăng xuất trên header
function _renderAuthHeader(){
  var hdrR = document.querySelector('.hdr-r'); if (!hdrR) return;
  var box = document.getElementById('auth-box');
  if (!box){
    box = document.createElement('div');
    box.id = 'auth-box';
    box.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
    var pill = document.getElementById('role-pill');
    if (pill && pill.nextSibling) hdrR.insertBefore(box, pill.nextSibling);
    else hdrR.insertBefore(box, hdrR.firstChild);
  }
  var isAdmin = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  var loggedIn = !!_authAccount;
  var html = '';
  if (loggedIn) html += '<button class="btn sm" data-bar-id="hdr-logout" data-bar-home="#auth-box" title="Đăng xuất" onclick="doLogout()">⎋ Đăng xuất</button>';
  box.innerHTML = html;
  if (typeof _applyBarCustomization === 'function') _applyBarCustomization();
}

// ── Quản lý tài khoản (admin) ──
function openAcctModal(){
  var allowed = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  if (!allowed){ if (typeof toast==='function') toast('Chỉ admin mới quản lý tài khoản.'); return; }
  _acctEditing = '';
  renderAcctModal();
  var m = document.getElementById('acct-modal'); if (m) m.classList.add('open');
}
function closeAcctModal(){ var m = document.getElementById('acct-modal'); if (m) m.classList.remove('open'); }
function _acctRoleChange(){
  var role = _aval('acct-role');
  var nameWrap = document.getElementById('acct-name-wrap'), teamWrap = document.getElementById('acct-team-wrap');
  if (nameWrap) nameWrap.style.display = (role==='admin') ? 'none' : '';
  if (teamWrap) teamWrap.style.display = (role==='leader') ? '' : 'none';
}
function _acctKey(u){ return String(u == null ? '' : u).trim().toLowerCase(); }

// Danh sách sale mà 1 tài khoản đang phụ trách (= phạm vi dữ liệu tài khoản đó nhìn thấy)
function _acctNamesOf(a){
  if (!a) return [];
  return (a.names && a.names.length) ? a.names.slice() : (a.name ? [a.name] : []);
}
// Gán lại danh sách sale cho tài khoản + tự cập nhật tên chính & team (với CS)
function _acctApplyNames(acct, arr){
  acct.names = arr.slice();
  acct.name  = arr[0] || '';
  if (acct.role === 'cs'){
    var t = null;
    for (var i = 0; i < arr.length && !t; i++){ t = (typeof _teamOf === 'function' ? _teamOf(arr[i]) : null); }
    acct.team = t ? t.name : '';
  }
}
// Lưu thay đổi phạm vi sale + làm mới giao diện (và phiên đăng nhập nếu sửa chính mình)
function _acctPersist(acct, auditText){
  pushUsers();
  if (typeof logAudit === 'function') logAudit('account', '', acct.username, auditText);
  if (_authAccount && _acctKey(_authAccount.username) === _acctKey(acct.username) && typeof _applyAuthIdentity === 'function'){
    try { _applyAuthIdentity(acct); } catch(e){}
  }
  renderAcctModal();
}

// Khối chi tiết: bấm vào 1 tài khoản sale → xem tài khoản đó đang phụ trách những sale nào
function _acctDetailHtml(a){
  var uk = esc(a.username);
  if (a.role === 'admin'){
    return '<div class="acct-detail">'+
      '<div class="ad-title">Phạm vi xem</div>'+
      '<div style="font-size:12px;color:var(--muted)">Tài khoản <b>Admin</b> nhìn thấy <b>toàn bộ</b> sale — không cần gán danh sách.</div>'+
    '</div>';
  }
  var namesArr = _acctNamesOf(a);
  var allCS = (typeof _allCSNames === 'function' ? _allCSNames() : []);
  var lowerHas = {}; namesArr.forEach(function(n){ lowerHas[String(n).toLowerCase()] = 1; });
  var addOpts = '<option value="">— Chọn sale để thêm —</option>' +
    allCS.filter(function(n){ return !lowerHas[String(n).toLowerCase()]; })
         .map(function(n){ return '<option value="'+esc(n)+'">'+esc(n)+'</option>'; }).join('');

  var chips = namesArr.length ? namesArr.map(function(n){
    var t = (typeof _teamOf === 'function' ? _teamOf(n) : null);
    return '<span class="sale-chip">'+esc(n)+
      (t ? '<span class="sc-team">· '+esc(t.name)+'</span>' : '')+
      '<span class="chip-x" title="Cắt sale này khỏi tài khoản" data-u="'+uk+'" data-name="'+esc(n)+'" '+
        'onclick="acctRemoveName(this.dataset.u,this.dataset.name)">✕</span></span>';
  }).join('') : '<span style="font-size:12px;color:var(--red)">Chưa gán sale nào — tài khoản này sẽ không thấy dữ liệu.</span>';

  var teamNote = '';
  if (a.role === 'leader'){
    var tm = (typeof teams !== 'undefined' ? teams : []).filter(function(t){ return t.name === a.team; })[0];
    var mem = tm ? [].concat(tm.leader ? [tm.leader] : [], tm.members || []).filter(Boolean) : [];
    teamNote = '<div style="margin-top:8px;font-size:11px;color:var(--muted);border-top:1px dashed var(--border);padding-top:7px">'+
      '👥 Team <b>'+esc(a.team || '—')+'</b>'+(mem.length ? ': '+esc(mem.join(', ')) : ' (chưa có thành viên)')+
      ' — Leader còn xem được dữ liệu của cả team.</div>';
  }

  // Loại Sale (online/offline) + Ngày bắt đầu — chỉ cho tài khoản CS (từng sale), dùng để
  // Báo cáo hoa hồng tự áp đúng chương trình thưởng online/offline và các mốc "ngày thứ N
  // kể từ ngày bắt đầu" (thưởng sale thử việc).
  var saleTypeHtml = '';
  if (a.role === 'cs') {
    // Nguon HIEN THI = SALE_CHANNELS (cung 1 nguon voi "🏆 Chương trình thưởng" + Báo cáo F —
    // theo yeu cau Duyen: "mỗi sale chỉ có on/off, phân loại ở đâu thì báo cáo cũng tính theo
    // đó"), khong con doc rieng a.saleType nua (van giu cot do tren Users lam du phong khi
    // TAI KHOAN nay CHUA co ten nao xuat hien trong SALE_CHANNELS, vd nhan vien moi chua ban gi).
    var stNames = _acctNamesOf(a);
    var stCur = stNames.map(function(n){ return SALE_CHANNELS[n]; }).filter(Boolean)[0] || a.saleType || '';
    var stOpts = [['','— Chưa gán —']].concat(SALE_GROUPS.map(function(g){ return [g.key, g.label]; })).map(function(o){
      return '<option value="'+o[0]+'"'+(stCur===o[0]?' selected':'')+'>'+o[1]+'</option>';
    }).join('');
    saleTypeHtml = '<div style="margin-top:10px;border-top:1px dashed var(--border);padding-top:9px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">'+
      '<div><div style="font-size:10.5px;color:var(--hint);margin-bottom:2px">Đội (áp dụng chương trình thưởng)</div>'+
        '<select onchange="acctSetSaleType(\''+uk+'\',this.value)" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+stOpts+'</select></div>'+
      '<div><div style="font-size:10.5px;color:var(--hint);margin-bottom:2px">Ngày bắt đầu (mốc tính thưởng theo ngày thử việc)</div>'+
        '<input type="date" value="'+esc(a.startDate||'')+'" onchange="acctSetStartDate(\''+uk+'\',this.value)" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)"></div>'+
    '</div>';
  }

  var isLimited = Array.isArray(a.perms);
  var permHtml = '<div style="margin-top:10px;border-top:1px dashed var(--border);padding-top:9px">'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer">'+
      '<input type="checkbox" '+(isLimited?'checked':'')+' onchange="acctTogglePermLimit(\''+uk+'\',this.checked)"> '+
      '🔒 Giới hạn menu được xem (chỉ cho xem 1 số mục nhất định)'+
    '</label>'+
    (isLimited ?
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+
        _PERM_TAB_DEFS.map(function(d){
          var checked = a.perms.indexOf(d.id) !== -1;
          return '<label style="display:flex;align-items:center;gap:4px;font-size:11.5px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;cursor:pointer">'+
            '<input type="checkbox" '+(checked?'checked':'')+' onchange="acctTogglePermTab(\''+uk+'\',\''+d.id+'\',this.checked)"> '+esc(d.label)+
          '</label>';
        }).join('')+
      '</div>'+
      '<div style="font-size:10.5px;color:var(--muted);margin-top:5px">Bỏ tick = tài khoản này sẽ KHÔNG thấy mục đó ở đâu cả (kể cả trong "☰ Menu").</div>'
    : '<div style="font-size:10.5px;color:var(--muted);margin-top:4px">Đang KHÔNG giới hạn — tài khoản xem đủ menu theo đúng vai trò hiện tại.</div>')+
  '</div>';

  return '<div class="acct-detail">'+
    '<div class="ad-title">Đang phụ trách '+namesArr.length+' sale — chỉ thấy dữ liệu của những người này</div>'+
    '<div class="ad-chips">'+chips+'</div>'+
    '<div class="ad-add">'+
      '<select class="team-add-sel ad-sel">'+addOpts+'</select>'+
      '<input class="team-add-input ad-inp" placeholder="…hoặc gõ tên sale mới, cách nhau dấu phẩy">'+
      '<button class="btn primary sm" data-u="'+uk+'" onclick="acctAddNames(this)">+ Thêm sale</button>'+
    '</div>'+
    teamNote+
    saleTypeHtml+
    permHtml+
  '</div>';
}
// Bật/tắt chế độ giới hạn menu của 1 tài khoản. Bật lần đầu -> mặc định cho phép ĐỦ mọi
// mục (Admin bỏ tick dần để thu hẹp), tránh vô tình khoá trắng tài khoản người ta.
function acctTogglePermLimit(u, on){
  var acct = _findAccount(u); if (!acct) return;
  acct.perms = on ? _PERM_TAB_DEFS.map(function(d){ return d.id; }) : null;
  _acctPersist(acct, on ? 'Bật giới hạn menu' : 'Bỏ giới hạn menu');
}
function acctTogglePermTab(u, tabId, on){
  var acct = _findAccount(u); if (!acct || !Array.isArray(acct.perms)) return;
  var idx = acct.perms.indexOf(tabId);
  if (on && idx === -1) acct.perms.push(tabId);
  if (!on && idx !== -1) acct.perms.splice(idx, 1);
  _acctPersist(acct, (on?'Cho phép xem: ':'Chặn xem: ') + tabId);
}
function acctSetSaleType(u, val){
  var acct = _findAccount(u); if (!acct) return;
  acct.saleType = val || '';
  // Ghi THẲNG vào SALE_CHANNELS cho MỌI tên bí danh của tài khoản này — đây là nguồn DUY NHẤT mà
  // "🏆 Chương trình thưởng" và "Báo cáo F — KPI Sale" đang đọc, để đặt ở đâu (Quản lý tài khoản
  // hay Quản lý Team > 🏷️ Phân loại đội Sale) thì mọi báo cáo cũng tính theo đúng 1 kết quả.
  _acctNamesOf(acct).forEach(function(n){
    if (!n) return;
    if (val) SALE_CHANNELS[n] = val; else delete SALE_CHANNELS[n];
  });
  saveSaleChannels();
  _acctPersist(acct, 'Đặt loại Sale: ' + (val || '(bỏ trống)'));
}
function acctSetStartDate(u, val){
  var acct = _findAccount(u); if (!acct) return;
  acct.startDate = val || '';
  _acctPersist(acct, 'Đặt ngày bắt đầu: ' + (val || '(bỏ trống)'));
}

// Mở / đóng khối chi tiết của 1 tài khoản
function toggleAcctDetail(u){
  var k = _acctKey(u);
  if (_acctOpen[k]) delete _acctOpen[k]; else _acctOpen[k] = true;
  renderAcctModal();
}
// Thêm sale vào phạm vi xem của tài khoản (từ khối chi tiết)
function acctAddNames(btn){
  var acct = _findAccount(btn.getAttribute('data-u')); if (!acct) return;
  if (acct.role === 'admin'){ toast('Admin đã xem được toàn bộ sale.'); return; }
  var box = btn.closest ? btn.closest('.acct-detail') : null; if (!box) return;
  var sel = box.querySelector('.ad-sel'), inp = box.querySelector('.ad-inp');
  var want = [];
  if (sel && sel.value) want.push(sel.value);
  if (inp && inp.value) String(inp.value).split(',').forEach(function(x){ x = x.trim(); if (x) want.push(x); });
  if (!want.length){ toast('Chọn hoặc gõ tên sale muốn thêm.'); return; }
  var cur = _acctNamesOf(acct), seen = {}, added = [];
  cur.forEach(function(n){ seen[String(n).toLowerCase()] = 1; });
  want.forEach(function(n){
    var k = String(n).toLowerCase();
    if (!seen[k]){ seen[k] = 1; cur.push(n); added.push(n); }
  });
  if (!added.length){ toast('Các sale này đã có sẵn trong tài khoản.'); return; }
  _acctApplyNames(acct, cur);
  _acctOpen[_acctKey(acct.username)] = true;
  _acctPersist(acct, 'Thêm sale cho ' + acct.username + ': ' + added.join(', '));
  toast('✓ Đã thêm ' + added.join(', ') + ' vào tài khoản ' + acct.username);
}
// Cắt bớt 1 sale khỏi phạm vi xem của tài khoản
function acctRemoveName(u, name){
  var acct = _findAccount(u); if (!acct) return;
  var cur = _acctNamesOf(acct);
  var next = cur.filter(function(n){ return n !== name; });
  if (next.length === cur.length) return;
  if (!next.length){ toast('Tài khoản ' + _roleLabel(acct.role) + ' phải còn ít nhất 1 sale. Thêm sale khác trước khi cắt người cuối cùng.'); return; }
  if (!confirm('Cắt sale "' + name + '" khỏi tài khoản "' + acct.username + '"?\n\nTài khoản này sẽ KHÔNG còn nhìn thấy dữ liệu của "' + name + '".')) return;
  _acctApplyNames(acct, next);
  _acctOpen[_acctKey(acct.username)] = true;
  _acctPersist(acct, 'Cắt sale khỏi ' + acct.username + ': ' + name);
  toast('✓ Đã cắt ' + name + ' khỏi tài khoản ' + acct.username);
}
// Nạp 1 tài khoản vào form bên dưới để sửa (giữ nguyên các sale đang gán)
function editAccount(u){
  var acct = _findAccount(u); if (!acct) return;
  _acctEditing = acct.username;
  _acctOpen[_acctKey(acct.username)] = true;
  renderAcctModal();
  var box = document.getElementById('acct-form-box');
  if (box && box.scrollIntoView) { try { box.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch(e){ box.scrollIntoView(); } }
}
function cancelAcctEdit(){ _acctEditing = ''; renderAcctModal(); }

function renderAcctModal(){
  var body = document.getElementById('acct-modal-body'); if (!body) return;
  var ed = _acctEditing ? _findAccount(_acctEditing) : null;
  if (_acctEditing && !ed) _acctEditing = '';
  var edRole  = ed ? (ed.role || 'cs') : '';
  var edNames = ed ? _acctNamesOf(ed) : [];

  var roleOpts = ['admin','leader','cs','demo'].map(function(r){
    return '<option value="'+r+'"'+(ed && edRole===r ? ' selected' : '')+'>'+_roleLabel(r)+'</option>';
  }).join('');

  // Universe tên CS = tên có trong dữ liệu + tên đang gán cho tài khoản đang sửa (kể cả tên gõ tay)
  var csNames = (typeof _allCSNames === 'function' ? _allCSNames() : []).slice();
  edNames.forEach(function(n){ if (csNames.indexOf(n) === -1) csNames.push(n); });
  // Danh sách sale dạng ô TÍCH (có ô gõ tìm) — thay <select multiple> cũ (phải giữ Ctrl rồi click, không gõ tìm được).
  // Sale đang được gán hiện LÊN ĐẦU cho dễ thấy; ô tích vẫn giữ trạng thái kể cả khi bị ẩn do đang lọc.
  var csSorted = csNames.filter(function(n){ return edNames.indexOf(n) !== -1; })
                 .concat(csNames.filter(function(n){ return edNames.indexOf(n) === -1; }));
  var nameOpts = csSorted.map(function(n){
    var on = edNames.indexOf(n) !== -1;
    return '<label class="team-cs-chk'+(on?' on':'')+'" data-nm="'+esc(_vnNorm(n))+'" style="display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;font-size:12px">'+
      '<input type="checkbox" class="acct-name-chk" style="width:auto;padding:0;margin:0" data-name="'+esc(n)+'"'+(on?' checked':'')+' onchange="_acctNameChanged(this)">'+
      '<span>'+esc(n)+'</span></label>';
  }).join('');

  var teamOpts = '<option value="">—</option>' + (typeof teams!=='undefined'?teams:[]).map(function(t){
    return '<option value="'+esc(t.name)+'"'+(ed && ed.team===t.name ? ' selected' : '')+'>'+esc(t.name)+'</option>';
  }).join('');

  var list = accounts.length ? accounts.map(function(a){
    var badgeCls = a.role==='admin' ? 'vip-bg' : (a.role==='leader' ? 'blue-bg' : 'green-bg');
    var badgeCol = a.role==='admin' ? 'var(--vip)' : (a.role==='leader' ? 'var(--blue)' : 'var(--green)');
    var namesArr = _acctNamesOf(a);
    var namesDisp = namesArr.join(', ');
    var uk = esc(a.username);
    var k = _acctKey(a.username);
    var open = !!_acctOpen[k];
    var isEd = _acctEditing && _acctKey(_acctEditing) === k;
    var countPill = a.role==='admin' ? '<span class="ar-count">toàn bộ</span>'
                                     : '<span class="ar-count">'+namesArr.length+' sale</span>';
    return '<div class="acct-item'+(open?' open':'')+(isEd?' editing':'')+'">'+
      '<div class="acct-row">'+
        '<div class="ar-main" title="Bấm để xem tài khoản này đang phụ trách những sale nào" '+
             'data-u="'+uk+'" onclick="toggleAcctDetail(this.dataset.u)">'+
          '<div style="font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+
            '<span class="ar-caret">'+(open?'▼':'▶')+'</span>'+esc(a.username)+
            '<span class="ar-badge" style="background:var(--'+badgeCls+');color:'+badgeCol+'">'+_roleLabel(a.role)+'</span>'+
            countPill+
            (a.active===false?'<span style="color:var(--red);font-size:10px">(đã khoá)</span>':'')+
          '</div>'+
          '<div style="color:var(--muted);font-size:11px">'+(namesDisp?esc(namesDisp):'—')+(a.team?' · '+esc(a.team):'')+'</div>'+
        '</div>'+
        '<button class="btn sm" title="Sửa vai trò / thêm hoặc cắt sale" data-u="'+uk+'" onclick="editAccount(this.dataset.u)">✏ Sửa</button>'+
        '<button class="btn sm" data-u="'+uk+'" onclick="resetPassword(this.dataset.u)">Đổi MK</button>'+
        '<button class="btn sm" data-u="'+uk+'" onclick="toggleAcctActive(this.dataset.u)">'+(a.active===false?'Mở khoá':'Khoá')+'</button>'+
        '<button class="btn danger sm" data-u="'+uk+'" onclick="deleteAccount(this.dataset.u)">Xoá</button>'+
      '</div>'+
      (open ? _acctDetailHtml(a) : '')+
    '</div>';
  }).join('') : '<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px">Chưa có tài khoản nào.</div>';

  var formHead = ed
    ? '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'+
        '<div style="font-weight:600;font-size:13px;color:var(--tn)">✏ Đang sửa tài khoản: '+esc(ed.username)+'</div>'+
        '<button class="btn sm" onclick="cancelAcctEdit()">Huỷ sửa</button></div>'
    : '<div style="font-weight:600;font-size:13px;margin-bottom:8px">➕ Thêm / cập nhật tài khoản</div>';

  body.innerHTML =
    '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Tài khoản &amp; mật khẩu do admin cấp. Mật khẩu được mã hoá trước khi lưu. '+
      'Bấm vào 1 tài khoản để xem tài khoản đó đang phụ trách những sale nào, rồi <b>thêm</b> hoặc <b>cắt</b> sale ngay tại đó. '+
      'Để cấp cho cả team, hãy bật kết nối Google Sheets.</div>'+
    '<div style="max-height:300px;overflow:auto;margin-bottom:12px">'+list+'</div>'+
    '<div id="acct-form-box" style="border-top:1px solid var(--border);padding-top:12px">'+
      formHead+
      '<div class="v9-field"><label>Tài khoản (để đăng nhập)</label><input id="acct-username" placeholder="vd: thaomt" '+
        (ed ? 'value="'+esc(ed.username)+'" readonly style="background:var(--surface2);color:var(--muted)"' : '')+'></div>'+
      '<div class="v9-field"><label>Mật khẩu</label><input id="acct-password" type="text" placeholder="'+(ed?'để trống nếu không đổi mật khẩu':'đặt mật khẩu cho tài khoản mới')+'"></div>'+
      '<div class="v9-field"><label>Vai trò</label><select id="acct-role" onchange="_acctRoleChange()">'+roleOpts+'</select></div>'+
      '<div class="v9-field" id="acct-name-wrap"><label>Sale mà tài khoản này được nhìn thấy (gõ để tìm, tích để chọn NHIỀU — bỏ tích là cắt bớt)</label>'+
        '<input id="acct-name-search" autocomplete="off" placeholder="🔍 Gõ tên sale để tìm… (Enter = tích dòng đầu tiên)" oninput="_acctNameFilter(this.value)" onkeydown="_acctNameSearchKey(event,this)" style="margin-bottom:6px">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'+
          '<span style="font-size:11px;color:var(--muted)">Đang chọn: <b id="acct-name-count">0</b>/'+csSorted.length+'</span>'+
          '<button type="button" class="team-cs-all" onclick="_acctNamePickVisible(true)">✓ Tích các dòng đang hiện</button>'+
          '<button type="button" class="team-cs-all" onclick="_acctNamePickVisible(false)">✕ Bỏ tích các dòng đang hiện</button>'+
        '</div>'+
        '<div id="acct-name-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border-md);border-radius:var(--rsm);background:var(--surface)">'+nameOpts+
          '<div id="acct-name-empty" style="display:none;padding:8px;font-size:11px;color:var(--muted)">Không có sale nào khớp — có thể gõ tên mới ở ô bên dưới.</div></div>'+
        '<input id="acct-name-input" placeholder="…hoặc gõ thêm tên mới, cách nhau bằng dấu phẩy" style="margin-top:6px"></div>'+
      '<div class="v9-field" id="acct-team-wrap" style="display:none"><label>Team (cho Leader)</label><select id="acct-team-sel">'+teamOpts+'</select></div>'+
      '<button class="btn primary" style="width:100%;justify-content:center" onclick="addAccount()">'+(ed?'💾 Lưu thay đổi':'Lưu tài khoản')+'</button>'+
    '</div>';
  _acctRoleChange();
  _acctNameCount();
}
// ── Danh sách sale dạng ô tích trong form tài khoản: lọc (không dấu/hoa thường), đếm, tích hàng loạt ──
function _acctNameCount(){
  var n = document.querySelectorAll('#acct-name-list .acct-name-chk:checked').length;
  var el = document.getElementById('acct-name-count'); if (el) el.textContent = n;
}
function _acctNameChanged(cb){
  var lb = cb.closest('label'); if (lb) lb.classList.toggle('on', cb.checked);
  _acctNameCount();
}
function _acctNameFilter(q){
  var nq = _vnNorm(q), shown = 0;
  document.querySelectorAll('#acct-name-list label[data-nm]').forEach(function(l){
    var ok = !nq || (l.getAttribute('data-nm')||'').indexOf(nq) !== -1;
    l.style.display = ok ? 'flex' : 'none'; if (ok) shown++;
  });
  var em = document.getElementById('acct-name-empty'); if (em) em.style.display = shown ? 'none' : '';
}
function _acctNamePickVisible(on){
  document.querySelectorAll('#acct-name-list label[data-nm]').forEach(function(l){
    if (l.style.display === 'none') return;
    var cb = l.querySelector('.acct-name-chk'); if (cb){ cb.checked = on; _acctNameChanged(cb); }
  });
}
function _acctNameSearchKey(ev, inp){
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  var first = Array.prototype.slice.call(document.querySelectorAll('#acct-name-list label[data-nm]')).filter(function(l){ return l.style.display !== 'none'; })[0];
  if (!first) return;
  var cb = first.querySelector('.acct-name-chk'); if (cb){ cb.checked = !cb.checked; _acctNameChanged(cb); }
  inp.select();   // giữ chữ vừa gõ (bôi đen) để gõ tiếp là thay luôn; xoá thì danh sách đầy đủ hiện lại
}
// Gộp danh sách tên CS cho tài khoản: các tên được tick trong danh sách ô tích + tên gõ tay
// (cách nhau bằng dấu phẩy) — loại trùng (không phân biệt hoa/thường), giữ thứ tự chọn trước.
function _acctCollectNames(){
  var selected = Array.prototype.slice.call(document.querySelectorAll('#acct-name-list .acct-name-chk:checked')).map(function(o){ return o.getAttribute('data-name'); });
  var typed = ((_aval('acct-name-input')||'')).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  var out = [], seen = {};
  selected.concat(typed).forEach(function(n){
    var k = n.toLowerCase();
    if (n && !seen[k]) { seen[k] = 1; out.push(n); }
  });
  return out;
}
async function addAccount(){
  var u = (_aval('acct-username')||'').trim();
  var p = _aval('acct-password');
  var role = _aval('acct-role') || 'cs';
  var namesArr = _acctCollectNames();
  var name = namesArr[0] || '';
  var team = _aval('acct-team-sel') || '';
  if (!u){ toast('Nhập tên tài khoản.'); return; }
  if (/\s/.test(u)){ toast('Tên tài khoản không nên có dấu cách.'); return; }
  if (role === 'admin'){ name = name || 'Admin'; namesArr = ['Admin']; team = ''; }
  if (role !== 'admin' && !namesArr.length){ toast('Chọn hoặc nhập ít nhất 1 Tên CS cho tài khoản này.'); return; }
  if (role === 'cs'){
    var t = null;
    for (var ni=0; ni<namesArr.length && !t; ni++){ t = (typeof _teamOf==='function' ? _teamOf(namesArr[ni]) : null); }
    team = t ? t.name : '';
  }
  var existing = _findAccount(u);
  if (!p && !existing){ toast('Đặt mật khẩu cho tài khoản mới.'); return; }
  var passHash = existing ? existing.passHash : '';
  if (p) passHash = await _hashPass(p);
  var rec = { username: u, passHash: passHash, role: role, name: name, names: namesArr, team: team, active: existing ? existing.active !== false : true };
  if (existing){ for (var i=0;i<accounts.length;i++){ if (String(accounts[i].username).toLowerCase()===String(existing.username).toLowerCase()){ accounts[i]=rec; break; } } }
  else accounts.push(rec);
  var res = await pushUsers();
  if (res && res.error){ toast('Lỗi lưu: ' + res.error); }
  if (typeof logAudit === 'function') logAudit('account','', '', (existing?'Cập nhật':'Tạo')+' tài khoản '+u+' ('+role+')');
  // Nếu sửa chính tài khoản đang đăng nhập → áp dụng lại phạm vi xem ngay, không cần đăng nhập lại
  if (_authAccount && _acctKey(_authAccount.username) === _acctKey(u) && typeof _applyAuthIdentity === 'function'){
    try { _applyAuthIdentity(rec); } catch(e){}
  }
  _acctEditing = '';
  _acctOpen[_acctKey(u)] = true;
  renderAcctModal();
  _renderAuthHeader();
  toast('✓ Đã lưu tài khoản ' + u + (gsUrl ? '' : ' (chưa kết nối GSheets — chỉ lưu trên máy này)'));
}
function deleteAccount(u){
  var acct = _findAccount(u); if (!acct) return;
  var admins = accounts.filter(function(a){ return a.role==='admin'; });
  if (acct.role==='admin' && admins.length<=1){ toast('Không thể xoá admin cuối cùng.'); return; }
  if (!confirm('Xoá tài khoản "'+u+'"?')) return;
  accounts = accounts.filter(function(a){ return String(a.username).toLowerCase()!==String(acct.username).toLowerCase(); });
  pushUsers();
  if (typeof logAudit === 'function') logAudit('account','', u, 'Xoá tài khoản');
  if (_acctKey(_acctEditing) === _acctKey(acct.username)) _acctEditing = '';
  delete _acctOpen[_acctKey(acct.username)];
  renderAcctModal();
}
async function resetPassword(u){
  var acct = _findAccount(u); if (!acct) return;
  var np = prompt('Mật khẩu mới cho tài khoản "'+u+'":');
  if (np === null) return;
  if (!String(np).trim()){ toast('Mật khẩu trống.'); return; }
  acct.passHash = await _hashPass(np);
  pushUsers();
  if (typeof logAudit === 'function') logAudit('account','', u, 'Đổi mật khẩu');
  toast('✓ Đã đổi mật khẩu cho ' + u);
}
function toggleAcctActive(u){
  var acct = _findAccount(u); if (!acct) return;
  if (acct.role==='admin' && acct.active!==false){
    var liveAdmins = accounts.filter(function(a){ return a.role==='admin' && a.active!==false; });
    if (liveAdmins.length<=1){ toast('Không thể khoá admin hoạt động cuối cùng.'); return; }
  }
  acct.active = acct.active===false ? true : false;
  pushUsers();
  renderAcctModal();
}


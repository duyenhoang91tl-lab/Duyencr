// Làm mới đúng tab đang mở của panel chi tiết khách (nếu đang mở đúng khách này) — gọi sau khi
// Done/xóa lịch hẹn từ nơi KHÁC (vd panel "Nhắc hẹn" nổi) để tránh panel đang mở vẫn hiện ngày cũ
// đã bị xóa — nếu không, CS dễ bấm "Lưu" mà không để ý, vô tình TẠO LẠI lịch hẹn vừa Done xong.
function _refreshOpenDpTab(phone){
  if (typeof currentPhone === 'undefined' || currentPhone !== phone) return;
  var c = allCustomers.find(function(x){ return x.phone === phone; });
  var body = document.getElementById('dp-body');
  if (!c || !body) return;
  if (currentDpTab === 'care') body.innerHTML = renderCareTab(c);
  else if (currentDpTab === 'schedule') body.innerHTML = renderSchedTabHtml(c);
}
function markDone(id) {
  const it = schedules.find(x=>x.id===id);
  if (it) {
    // Xóa ngày lịch nhanh tương ứng trong careData (để không còn nhắc nữa)
    const care = careData[it.phone];
    if (care) {
      const typeToField = {goi:'schedGoi',sp:'schedSP',cs:'schedCS',hen:'schedHen'};
      const field = typeToField[it.type];
      if (field && care[field] === it.date) {
        care[field] = ''; care[field+'Note'] = '';
      }
      // Lịch auto (Data Đảo) được ghi vào ô schedHen (có tiền tố AUTO_HEN_TAG) —
      // nếu ô Hẹn đang trỏ đúng mốc vừa Done thì xóa để extension ngừng nhắc.
      if (care.schedHen === it.date && String(care.schedHenNote||'').indexOf(AUTO_HEN_TAG) === 0) {
        care.schedHen = ''; care.schedHenNote = '';
      }
      saveLS('ome_care', careData);
    }
    // Lịch auto đã Done → ghi nhớ để không tái tạo lại
    if (it.autoDao) {
      var delSet = loadLS('ome_dao_deleted') || {};
      delSet[it.id] = true;
      saveLS('ome_dao_deleted', delSet);
    }
    // Bấm Xong = xoá hẳn khỏi danh sách (không giữ lại bản ghi done)
    schedules = schedules.filter(x => x.id !== id);
    saveLS('ome_sched',schedules);
    saveLS('ome_schedules',schedules);
    // Tính lại mốc auto sắp tới (bỏ mốc đã Done) → cập nhật ô Hẹn cho đúng
    try { if (typeof syncAutoHenToCareData==='function') syncAutoHenToCareData(); } catch(e){}
    saveLS('ome_care', careData);
    if (gsUrl) queueCareSync(it.phone);
    renderScheduleTab(); renderOverdueTab(); updateSchedBadges();
    renderReminderPanel();
    // Cập nhật panel chi tiết nếu đang mở đúng khách này (dù đang ở tab Chăm sóc hay Lịch hẹn)
    _refreshOpenDpTab(it.phone);
    toast('✓ Đã hoàn thành và xoá nhắc hẹn');
  }
}
// Đánh dấu done lịch nhanh careData (schedGoi/SP/CS/Hen) từ reminder panel — xoá hẳn, không giữ lại
function markCareSchedDone(phone, field) {
  const care = careData[phone] || {};
  const typeToSchedKey = {schedGoi:'goi', schedSP:'sp', schedCS:'cs', schedHen:'hen'};
  const schedKey = typeToSchedKey[field];
  const date = care[field];
  // Xóa ngày trong careData
  if (!careData[phone]) careData[phone] = {};
  careData[phone][field] = '';
  careData[phone][field+'Note'] = '';
  saveLS('ome_care', careData);
  // Xoá hẳn item tương ứng trong schedules[] nếu có (thay vì chỉ đánh dấu done)
  if (schedKey && date) {
    // FIX: neu item la lich auto Data Đảo (autoDao:true), phai ghi nho vao 'ome_dao_deleted'
    // — giong het delSched() — neu khong thi checkDataDaoRenewSchedules() (chay lai moi khi
    // mo app / nap du lieu moi) se KHONG thay id nay trong _daoDeleted, tuong nhu chua tung
    // xoa, va tu tao lai y het lich cu do -> "nhay lai" ca man thong bao lan man lich cham
    // soc du CS da bam xong/xoa roi.
    const toRemove = schedules.filter(x => x.phone===phone && x.type===schedKey && x.date===date && !x.done);
    const autoOnes = toRemove.filter(x => x.autoDao);
    if (autoOnes.length) {
      const delSet = loadLS('ome_dao_deleted') || {};
      autoOnes.forEach(x => { delSet[x.id] = true; });
      saveLS('ome_dao_deleted', delSet);
    }
    schedules = schedules.filter(x => !(x.phone===phone && x.type===schedKey && x.date===date && !x.done));
    saveLS('ome_sched',schedules);
    saveLS('ome_schedules',schedules);
  }
  if (gsUrl) queueCareSync(phone);
  updateSchedBadges();
  renderReminderPanel();
  renderScheduleTab(); renderOverdueTab();
  // Cập nhật panel chi tiết nếu đang mở đúng khách này — trước đây hàm này KHÔNG hề làm mới
  // dp-body, nên nếu CS đang mở tab "Chăm sóc" của đúng khách đó, ô ngày (Hẹn gọi/SP/CS/Hẹn mua
  // lại) vẫn hiện ngày cũ dù đã Done — dễ khiến CS bấm Lưu lại và tạo nhầm lại lịch vừa Done.
  _refreshOpenDpTab(phone);
  toast('✓ Đã hoàn thành lịch hẹn');
}
function updateSchedBadges() {
  const today = _ymd(new Date());
  // Count from both schedules array and careData dedicated fields
  const careSchedKeys = ['schedGoi','schedSP','schedCS','schedHen'];
  let careToday = 0, careOver = 0;
  for (const care of Object.values(careData)) {
    for (const k of careSchedKeys) {
      const d = care[k];
      if (d) {
        if (d === today) careToday++;
        else if (d < today) careOver++;
      }
    }
  }
  const todayCt = schedules.filter(x=>x.date===today&&!x.done).length + careToday;
  const overCt = schedules.filter(x=>x.date<today&&!x.done).length + careOver;
  txt('s-sched', fmt(todayCt));
  txt('s-over', fmt(overCt));
  txt('tb-sched', fmt(schedules.filter(x=>!x.done).length));
  txt('tb-over', fmt(overCt));
  txt('sched-over-cnt', fmt(overCt)); txt('sched-over-cnt2', fmt(overCt)); // công tắc Quá hạn trong màn Lịch chăm sóc
}

function _maybeRefreshOpenDp() {
  const ov = document.getElementById('dp-overlay');
  if (!ov || !ov.classList.contains('open') || !currentPhone) return;
  if (_dpDirty) {
    // Đang gõ dở → không ghi đè, chỉ báo nhẹ để người dùng chủ động tải lại
    const body = document.getElementById('dp-body');
    if (body && !document.getElementById('dp-refresh-hint')) {
      const hint = document.createElement('div');
      hint.id = 'dp-refresh-hint';
      hint.style.cssText = 'background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:7px;padding:7px 10px;font-size:11px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;';
      hint.innerHTML = `<span>🔄 Khách này vừa có cập nhật mới (vd: từ Zalo AI)</span><button style="background:#00b14f;color:#fff;border:none;border-radius:5px;padding:3px 9px;font-size:11px;cursor:pointer;white-space:nowrap" onclick="_dpDirty=false;renderDpTab(currentDpTab)">Tải lại</button>`;
      body.insertBefore(hint, body.firstChild);
    }
    return;
  }
  // Không có gì đang dở → tự động render lại tab hiện tại với dữ liệu mới nhất
  renderDpTab(currentDpTab);
  syncToast('🔄 Đã tự động cập nhật dữ liệu KH đang xem');
}

function openDp(phone) {
  currentPhone = phone;
  _dpDirty = false;
  const _hint = document.getElementById('dp-refresh-hint'); if (_hint) _hint.remove();
  const c = allCustomers.find(x=>x.phone===phone);
  if (!c) return;
  _syncNickZaloListFromGAS().then(function(list){ _nickZaloList = list || []; });
  const initials = c.name.split(' ').map(w=>w[0]||'').slice(-2).join('').toUpperCase();
  txt('dp-av', initials||'?');
  txt('dp-name', c.name);
  document.getElementById('dp-meta').innerHTML = `
    <span class="cphone" id="dp-phone-display">${c.phone}</span>
    <button data-phone="${esc(c.phone)}" onclick="copyPhone(this.dataset.phone)" title="Copy số điện thoại" style="background:none;border:1px solid var(--border-md);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--muted);line-height:1.4" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">📋</button>
    <button data-phone="${esc(c.phone)}" onclick="openEditPhone(this.dataset.phone)" title="Sửa SĐT / Tên KH" style="background:none;border:1px solid var(--border-md);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--muted);line-height:1.4" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">✏️</button>
    ${tierBadge(c.tier)}
    ${careBadge(c.careStatus)}
    ${zaloBadge(c.zaloStatus)}
    ${custStatusBadge((careData[c.phone]||{}).khStatus||'')}${cfBadges(c.phone)}`;
  renderDpTab('care');
  document.getElementById('dp-overlay').classList.add('open');
}

function renderDpTab(tab) {
  currentDpTab = tab;
  _dpDirty = false;
  const c = allCustomers.find(x=>x.phone===currentPhone);
  const body = document.getElementById('dp-body');
  if (!c || !body) return;
  if (tab==='care') body.innerHTML = renderCareTab(c);
  else if (tab==='schedule') body.innerHTML = renderSchedTabHtml(c);
  else if (tab==='history') { body.innerHTML = renderHistTab(c); _initHistExpand(); }
  else body.innerHTML = renderInfoTab(c);
  // Đồng bộ highlight tab (KH mới luôn render lại đúng nội dung, không còn dính dữ liệu KH trước)
  const _order = ['care','schedule','history','info'];
  document.querySelectorAll('.dp-tab').forEach((t,i)=>t.classList.toggle('active', _order[i]===tab));
}

function switchDpTab(tab, el) {
  currentDpTab = tab;
  _dpDirty = false;
  document.querySelectorAll('.dp-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const c = allCustomers.find(x=>x.phone===currentPhone);
  if (!c) return;
  const body = document.getElementById('dp-body');
  if (tab==='care') body.innerHTML = renderCareTab(c);
  else if (tab==='schedule') body.innerHTML = renderSchedTabHtml(c);
  else if (tab==='history') { body.innerHTML = renderHistTab(c); _initHistExpand(); }
  else body.innerHTML = renderInfoTab(c);
}

function renderCareTab(c) {
  const care = careData[c.phone] || {};
  const allCS = [...new Set(allCustomers.flatMap(x=>x.orders.map(o=>o.cs)).filter(Boolean))].sort();
  const today = _ymd(new Date());
  return `<div class="dp-section">
    <div class="dp-stitle">Thông tin chăm sóc</div>
    <div class="form-row-2">
      <div>
        <div class="form-label fld-lbl" data-fld="cs">${esc(FIELD_LABEL_CS)}${_fieldEditBtn('cs')}</div>
        <select class="form-select" id="cs-status" onchange="_hOnCsStatusChange_()">
          ${_buildCareStatusOptions(care.status||c.careStatus||'')}
        </select>
      </div>
      <div>
        <div class="form-label fld-lbl" data-fld="zalo">${esc(FIELD_LABEL_ZALO)}${_fieldEditBtn('zalo')}</div>
        <select class="form-select" id="cs-zalo">
          ${_zaloOptionsHtml_(care.zalo||c.zaloStatus||'')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;cursor:pointer" title="Tích khi khách đã nhắn lại / tương tác trên Zalo. Báo cáo chia data dùng để tính tỷ lệ phản hồi Zalo / KH đã kết bạn Zalo.">
          <input type="checkbox" id="cs-zalo-reply" ${((care.custom||c.custom||{}).zaloReply)?'checked':''}> 💬 Phản hồi Zalo
        </label>
      </div>
    </div>
    <div class="form-row-2">
      <div>
        <div class="form-label fld-lbl" data-fld="kh">${esc(FIELD_LABEL_KH)}${_fieldEditBtn('kh')}</div>
        <select class="form-select" id="cs-kh-status" onchange="this.dataset.manual='1'">
          ${_buildCustStatusOptions(care.khStatus||'')}
        </select>
      </div>
      <div>
        ${_renderZaloPhoneField(care, c)}
      </div>
    </div>
    <div id="cs-kh-hint" style="font-size:10.5px;color:var(--muted);margin:-4px 0 8px"></div>
    <!-- QUY TẮC (README #9): form nhập thông tin KH này đổi gì thì extension-pancake/pancake-content.js (panel pk-) PHẢI đổi theo. -->
    ${(function(){
      var isChot = (typeof _hIsChot_==='function') && _hIsChot_(care.status||c.careStatus||'');
      var ex = (typeof _hChotToday_==='function' && _hChotToday_(c.phone)) || {};
      return `<div id="cs-chot-box" style="display:${isChot?'block':'none'};margin-bottom:10px;padding:10px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:8px">
        <div class="form-label" style="color:var(--green)">🧾 Đơn chốt hôm nay</div>
        <div class="form-row-2">
          <div>
            <div class="form-label">💰 Doanh thu đơn (đ)</div>
            <input class="form-input" id="cs-chot-rev" inputmode="numeric" placeholder="VD: 3.000.000" value="${ex.rev?Number(ex.rev).toLocaleString('vi-VN'):''}" oninput="_hFmtMoneyInput_(this)">
          </div>
          <div></div>
        </div>
        <div class="form-label" style="margin-top:6px">🔖 Mã bộ đếm (mã đơn Base)</div>
        <input class="form-input" id="cs-chot-code" placeholder="VD: 1296T09/2026 (nhiều đơn: cách nhau bằng dấu +)" value="${esc(ex.code||'')}" autocomplete="off">
      </div>`;
    })()}
    ${_renderCustomFieldInputs(care)}
    <div class="form-row-2">
      <div>
        <div class="form-label" style="display:flex;align-items:center;gap:4px">
          🎂 Ngày sinh nhật
          ${_bdayUpcomingBadge(care.birthday)}
        </div>
        <input class="form-input" type="date" id="cs-birthday" value="${bdayYearOnly_(care.birthday) ? '' : (care.birthday||'')}"
               title="Nhắc hẹn sinh nhật hàng năm tự động"
               data-phone="${esc(c.phone)}" onchange="onBdayChange(this.value,this.dataset.phone);_bdayUiSync_()">
        ${(care.birthday && !bdayYearOnly_(care.birthday)) ? `<div style="font-size:10px;color:#be185d;margin-top:2px">🔔 Sẽ nhắc mỗi năm vào ngày này</div>` : ''}
        <input class="form-input" type="text" inputmode="numeric" maxlength="4" id="cs-birthyear" placeholder="Hoặc chỉ nhập năm sinh (VD 1995)"
               value="${esc((bdayYearOnly_(care.birthday) || ((String(care.birthday||'').match(/^(\d{4})-/)||[])[1]) || ''))}"
               ${(care.birthday && !bdayYearOnly_(care.birthday)) ? 'readonly title="Đã có ngày sinh đầy đủ — xoá ô ngày sinh nếu muốn nhập lại chỉ năm"' : ''}
               data-phone="${esc(c.phone)}" oninput="onBirthYearInput(this.value,this.dataset.phone)" style="margin-top:4px">
        <div id="cs-menh-box" style="font-size:11px;line-height:1.5;margin-top:4px">${menhBoxHtml((bdayYearOnly_(care.birthday) || ((String(care.birthday||'').match(/^(\d{4})-/)||[])[1]) || ''))}</div>
      </div>
      <div>
        <div class="form-label">🏷 Nhãn phân loại (tự đặt)</div>
        <input class="form-input" id="cs-tag" placeholder="VD: VIP, Khách sỉ, Combo A..."
               title="Nhãn tự do để lọc khi tạo chiến dịch — không liên quan tag của Zalo"
               value="${esc(care.tag||'')}" data-phone="${esc(c.phone)}" onchange="onTagChange(this.value,this.dataset.phone)">
      </div>
    </div>
    <div class="remind-panel">
      <div class="form-label" style="display:flex;align-items:center;justify-content:space-between">
        <span>📅 Lịch nhắc hẹn nhanh</span>
        <span style="font-size:10px;color:var(--muted);font-weight:400">CS tự đặt loại & ngày</span>
      </div>
      <div style="margin-top:6px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <input class="remind-type-input" id="remind-type-text" placeholder="Loại nhắc hẹn (vd: Tư vấn, Chốt đơn...)" value="">
          <select class="form-select" id="remind-type-sel" style="max-width:130px;font-size:11px"
                  onchange="syncRemindType(this.value)">
            ${SCHED_TYPES.filter(t=>t.key!=='birthday').map(t=>`<option value="${t.key}">${t.label}</option>`).join('')}
            <option value="__custom__">✏️ Tự nhập...</option>
          </select>
        </div>
        <div class="remind-auto-row">
          <span style="font-size:11px;color:var(--muted)">Ngày:</span>
          <label class="remind-chip" id="remind-auto-chip">
            <input type="checkbox" id="remind-auto-chk" style="display:none" onchange="toggleRemindAuto()">
            ⚡ Tự động sau 1 tháng
          </label>
          <input class="form-input" type="date" id="remind-date-pick" value="${today}"
                 style="width:140px;font-size:11px" title="Hoặc chọn ngày cụ thể">
          <input class="form-input" id="remind-note" placeholder="Nội dung nhắc..." style="flex:1;min-width:120px">
        </div>
        <button class="btn secondary" style="width:100%;font-size:12px" data-phone="${esc(c.phone)}" onclick="addCustomRemind(this.dataset.phone)">
          + Thêm lịch nhắc hẹn
        </button>
      </div>
    </div>
    <div class="form-row-2">
      <div>
        <div class="form-label">CS chăm sóc</div>
        <div class="cs-assign-combo" style="position:relative">
          <select class="form-select" id="cs-assign" style="display:none">
            <option value="">— Chọn CS —</option>
            ${allCS.map(cs=>`<option value="${esc(cs)}" ${(care.cs||c.careCS)===cs?'selected':''}>${esc(cs)}</option>`).join('')}
          </select>
          <input type="text" class="form-input" id="cs-assign-input" placeholder="Gõ tên CS để tìm..." autocomplete="off"
                 value="${esc(care.cs||c.careCS||'')}"
                 oninput="csAssignFilter()" onfocus="csAssignOpen()" onkeydown="csAssignKey(event)" onblur="setTimeout(csAssignSyncInput,150)">
          <div class="cs-assign-list" id="cs-assign-list"></div>
        </div>
      </div>
      <div>
        <div class="form-label">Số điện thoại</div>
        <div style="display:flex;gap:4px;align-items:center">
          <input class="form-input" value="${c.phone}" readonly style="background:var(--surface2);flex:1">
          <button data-phone="${esc(c.phone)}" onclick="copyPhone(this.dataset.phone)" title="Copy SĐT" class="btn sm">📋</button>
          <button data-phone="${esc(c.phone)}" onclick="openEditPhone(this.dataset.phone)" title="Sửa SĐT" class="btn sm">✏️ Sửa</button>
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-label" style="display:flex;align-items:center;justify-content:space-between">
        <span>Ghi chú</span>
        <span style="font-size:10px;color:var(--muted)">${_parseNotes(care.note||c.careNote||'').length} ghi chú</span>
      </div>
      <div style="display:flex;gap:6px;align-items:flex-start">
        <textarea class="form-ta" id="cs-note-new" placeholder="Thêm ghi chú mới — gợi ý: sản phẩm quan tâm, nhu cầu chính, gu, mua cho ai, điểm đáng nhớ…" style="min-height:64px;flex:1"></textarea>
        <button data-phone="${esc(c.phone)}" onclick="addNoteEntry(this.dataset.phone)" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;white-space:nowrap;margin-top:2px">➕ Thêm</button>
      </div>
      <div id="cs-note-history" style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
        ${_renderNoteHistory(care.note||c.careNote||'')}
      </div>
      <input type="hidden" id="cs-note" value="${esc(care.note||c.careNote||'')}">
    </div>
    <button class="save-btn" data-phone="${esc(c.phone)}" onclick="saveCare(this.dataset.phone)">💾 Lưu tình trạng ${gsUrl?'+ Sync GSheets':''}</button>
  </div>
  <div class="dp-section">
    <div class="dp-stitle">📅 Lịch chăm sóc nhanh</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="background:var(--blue-bg);border:1px solid var(--blue-b);border-radius:7px;padding:8px">
        <div class="form-label" style="color:var(--blue);margin-bottom:4px">📞 Hẹn gọi</div>
        <input class="form-input" type="date" id="sched-goi-date" value="${care.schedGoi||''}">
        <input class="form-input" style="margin-top:4px" id="sched-goi-note" placeholder="Nội dung cuộc gọi..." value="${esc(care.schedGoiNote||'')}">
      </div>
      <div style="background:var(--green-bg);border:1px solid rgba(26,107,69,0.2);border-radius:7px;padding:8px">
        <div class="form-label" style="color:var(--green);margin-bottom:4px">🔔 Nhắc SD sản phẩm</div>
        <input class="form-input" type="date" id="sched-sp-date" value="${care.schedSP||''}">
        <input class="form-input" style="margin-top:4px" id="sched-sp-note" placeholder="Sản phẩm cần nhắc..." value="${esc(care.schedSPNote||'')}">
      </div>
      <div style="background:var(--vip-bg);border:1px solid var(--vip-b);border-radius:7px;padding:8px">
        <div class="form-label" style="color:var(--vip);margin-bottom:4px">💜 Hẹn chăm sóc</div>
        <input class="form-input" type="date" id="sched-cs-date" value="${care.schedCS||''}">
        <input class="form-input" style="margin-top:4px" id="sched-cs-note" placeholder="Nội dung chăm sóc..." value="${esc(care.schedCSNote||'')}">
      </div>
      <div style="background:var(--tn-bg);border:1px solid var(--tn-b);border-radius:7px;padding:8px">
        <div class="form-label" style="color:var(--tn);margin-bottom:4px">🛒 Hẹn mua lại</div>
        <input class="form-input" type="date" id="sched-hen-date" value="${care.schedHen||''}">
        <input class="form-input" style="margin-top:4px" id="sched-hen-note" placeholder="Sản phẩm / lý do..." value="${esc(care.schedHenNote||'')}">
      </div>
    </div>
    <button class="save-btn" style="background:var(--blue);border-color:var(--blue)" data-phone="${esc(c.phone)}" onclick="saveCareSchedules(this.dataset.phone)">💾 Lưu lịch hẹn ${gsUrl?'+ Sync GSheets':''}</button>
  </div>
  ${(()=>{
    const daoOrders = c.orders.filter(o => _isDataDaoRenew(o.source));
    if (!daoOrders.length) return '';
    const excluded = _daoSchedExcluded(c.phone);
    return `<div class="dp-section" style="border:1.5px solid var(--orange,#e8a04a);border-radius:8px;padding:10px 12px">
      <div class="dp-stitle" style="color:var(--orange,#e8a04a);margin-bottom:6px">⚡ Lịch tự động Data Đảo</div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--text)">
        <input type="checkbox" id="dao-sched-exclude" data-phone="${esc(c.phone)}" style="width:15px;height:15px;cursor:pointer" ${excluded?'checked':''} onchange="_toggleDaoSchedExclude(this.dataset.phone,this.checked)">
        <span>Bỏ lịch tự động cho khách này <span style="color:var(--muted)">(tích nếu không cần chăm sóc)</span></span>
      </label>
    </div>`;
  })()}`;
}

function renderSchedTabHtml(c) {
  const myScheds = schedules.filter(x=>x.phone===c.phone).sort((a,b)=>a.date.localeCompare(b.date));
  const upcoming = myScheds.filter(x=>!x.done);
  const done = myScheds.filter(x=>x.done);
  const today = _ymd(new Date());
  return `<div class="sched-form">
    <div class="dp-stitle" style="margin-bottom:8px">Thêm lịch hẹn</div>
    <div class="form-row-2">
      <div>
        <div class="form-label" style="margin-bottom:3px">Loại lịch</div>
        <select class="form-select" id="new-stype">
          ${SCHED_TYPES.map(t=>`<option value="${t.key}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <div class="form-label" style="margin-bottom:3px">Ngày hẹn</div>
        <input class="form-input" type="date" id="new-sdate" value="${today}">
      </div>
    </div>
    <div class="form-row">
      <textarea class="form-ta" id="new-snote" placeholder="Nội dung nhắc nhở..." style="min-height:48px"></textarea>
    </div>
    <button class="save-btn" style="margin-bottom:14px" data-phone="${esc(c.phone)}" onclick="addSched(this.dataset.phone)">+ Thêm lịch hẹn</button>
    <div class="dp-stitle">Lịch đang chờ (${upcoming.length})</div>
    ${upcoming.length ? upcoming.map(it=>{
      const st=SCHED_TYPES.find(x=>x.key===it.type)||SCHED_TYPES[0];
      const od=it.date<today;
      const eid=`sedit_${it.id.replace(/[^a-z0-9]/gi,'_')}`;
      return `<div class="sched-mini ${od?'sched-overdue':''}" id="sm_${eid}">
        <div class="sm-dot" style="background:${st.color};${od?'box-shadow:0 0 0 2px var(--red-b)':''}"></div>
        <div class="sm-type">${it.customLabel ? esc(it.customLabel) : st.label}</div>
        <div class="sm-date" style="${od?'color:var(--red)':''}">${fmtDate(it.date)}</div>
        <div class="sm-note">${esc(it.note||'—')}</div>
        <button onclick="_schedEditToggle('${eid}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;color:var(--muted)" title="Chỉnh sửa lịch">✏</button>
        <button class="sm-del" onclick="delSched('${it.id}')">✕</button>
        <button onclick="markDone('${it.id}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;color:var(--muted)">✓</button>
        <div id="${eid}" style="display:none;width:100%;margin-top:6px;padding:8px;background:var(--surface2);border-radius:5px;border:1px solid var(--border)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px">
            <div>
              <div class="form-label">Loại lịch</div>
              <select class="form-select" id="${eid}_type">
                ${SCHED_TYPES.map(t=>`<option value="${t.key}"${t.key===it.type?' selected':''}>${t.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="form-label">Ngày hẹn</div>
              <input class="form-input" type="date" id="${eid}_date" value="${it.date}">
            </div>
          </div>
          <textarea class="form-ta" id="${eid}_note" style="min-height:38px;margin-bottom:6px" placeholder="Nội dung nhắc...">${esc(it.note||'')}</textarea>
          <div style="display:flex;gap:5px">
            <button class="save-btn" style="flex:1;padding:5px" data-phone="${esc(c.phone)}" onclick="_schedEditSave('${it.id}','${eid}',this.dataset.phone)">💾 Lưu</button>
            <button onclick="_schedEditToggle('${eid}')" style="border:1px solid var(--border);background:var(--surface);border-radius:5px;padding:5px 10px;cursor:pointer;font-size:11px">Hủy</button>
          </div>
        </div>
      </div>`;
    }).join('') : '<div style="color:var(--hint);font-size:12px;padding:6px 0">Không có lịch hẹn</div>'}
    ${done.length?`<div class="dp-stitle" style="margin-top:10px">Đã hoàn thành (${done.length})</div>${done.slice(0,5).map(it=>{const st=SCHED_TYPES.find(x=>x.key===it.type)||SCHED_TYPES[0];return`<div class="sched-mini" style="opacity:.5"><div class="sm-dot" style="background:${st.color}"></div><div class="sm-type">${st.label}</div><div class="sm-date">${fmtDate(it.date)}</div><div class="sm-note">${esc(it.note||'—')}</div></div>`;}).join('')}`:''}
  </div>`;
}

function _loadPosOrdersForPhone_(phone) {
  if (!phone || _posOrdersState[phone] || !gsUrl) return;
  if (!(typeof donPhoneSet !== 'undefined' && donPhoneSet && donPhoneSet.has(phone))) return;   // KH chua co don Pos -> giu lich su Base
  _posOrdersState[phone] = 'loading';
  const sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
  fetch(gsUrl + sep + 'action=donOrdersByPhone&phone=' + encodeURIComponent(phone), { redirect: 'follow' })
    .then(function(r){ return r.json(); })
    .then(function(j){
      const rows = (j && j.ok && Array.isArray(j.orders)) ? j.orders : [];
      if (rows.length) { _posOrdersCache[phone] = rows; _posOrdersState[phone] = 'done'; } else { _posOrdersState[phone] = 'fail'; }
    })
    .catch(function(err){ _posOrdersState[phone] = 'fail'; console.warn('pos orders error:', err && err.message); })
    .then(function(){
      if (currentPhone !== phone || currentDpTab !== 'history') return;
      // Khong ve lai neu CS dang mo form them/sua don (tranh mat chu dang go)
      const busy = Array.prototype.some.call(document.querySelectorAll('#add-order-form, [id^="hedit_"]'), function(el){ return el.style.display && el.style.display !== 'none'; });
      if (busy) return;
      const c = allCustomers.find(function(x){ return x.phone === phone; });
      const body = document.getElementById('dp-body');
      if (c && body) { body.innerHTML = renderHistTab(c); if (typeof _initHistExpand === 'function') _initHistExpand(); }
    });
}
function _renderPosHistoryHtml_(c, rows) {
  const total = rows.reduce(function(sum, o){ return sum + (Number(o.revenue) || 0); }, 0);
  const fmtD = function(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? (m[3] + '/' + m[2] + '/' + m[1]) : '—'; };
  return `<div class="dp-stitle">Lịch sử đặt hàng · Pos (${rows.length} đơn — ${fmtVND(total)})</div>
    <div style="font-size:11px;color:var(--hint);margin:-2px 0 8px">Khách đã có đơn trên Pos nên lịch sử lấy theo Pos (chuẩn); các đơn Base đã nằm trong Pos nên không hiển thị lại.</div>
    ${rows.slice(0,60).map(function(o){
      return `<div class="hist-item" style="border-left:3px solid var(--blue,#2563eb);padding-left:8px">
        <div class="hist-top"><span class="hist-date">${fmtD(o.date)}</span><span class="hist-price">${fmtVND(o.revenue)}</span></div>
        ${o.product ? `<div class="hist-prod" onclick="_toggleHistProd(this)" title="Bấm để xem đầy đủ sản phẩm">${esc(o.product)}</div>` : ''}
        <div class="hist-tags">
          ${o.source ? `<span class="htag">${esc(o.source)}</span>` : ''}
          ${o.sale ? `<span class="htag">👤 ${esc(o.sale)}</span>` : ''}
          ${o.status ? `<span class="htag">${esc(o.status)}</span>` : ''}
          ${o.note ? `<span class="htag">📝 ${esc(String(o.note).substring(0,35))}</span>` : ''}
        </div></div>`;
    }).join('')}
    ${rows.length > 60 ? `<div style="font-size:11px;color:var(--hint);padding:6px 0">… còn ${rows.length - 60} đơn cũ hơn</div>` : ''}`;
}

function renderHistTab(c) {
  const sorted = [...c.orders].sort((a,b)=>{
    const da=a.date instanceof Date?a.date.getTime():(a.year||0)*10000+(a.month||0)*100;
    const db=b.date instanceof Date?b.date.getTime():(b.year||0)*10000+(b.month||0)*100;
    return db-da;
  });
  const allBrands   = [...new Set(allCustomers.flatMap(cx=>cx.brands).filter(Boolean))].sort();
  const allDetails  = [...new Set(allCustomers.flatMap(cx=>cx.orders.map(o=>o.productDetail)).filter(Boolean))].sort();
  const allSources  = [...new Set(allCustomers.flatMap(cx=>cx.orders.map(o=>o.source)).filter(Boolean))].sort();
  const dlBrands    = `<datalist id="hedit-product-list">${allBrands.map(b=>`<option value="${esc(b)}">`).join('')}</datalist>`;
  const dlDetails   = `<datalist id="hedit-detail-list">${allDetails.map(d=>`<option value="${esc(d)}">`).join('')}</datalist>`;
  const dlSources   = `<datalist id="mo-source-list">${allSources.map(s2=>`<option value="${esc(s2)}">`).join('')}</datalist>`;
  const todayStr    = _ymd(new Date());
  const _pts = _ptsOfCustomer_(c);
  const _posRows = _posOrdersCache[c.phone];
  const _posOn = !!(_posRows && _posRows.length);          // da co don Pos tai xong -> thay lich su Base bang lich su Pos
  if (!_posOn && !_posOrdersState[c.phone]) setTimeout(function(){ _loadPosOrdersForPhone_(c.phone); }, 0);
  const _posLoading = !_posOn && _posOrdersState[c.phone] === 'loading';

  return `<div class="dp-section">${dlBrands}${dlDetails}${dlSources}
    <button class="save-btn" style="margin-bottom:10px" onclick="_toggleAddOrderForm()">+ Thêm đơn hàng</button>
    <div id="add-order-form" style="display:none;margin-bottom:14px;padding:10px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
        <div>
          <div class="form-label">Sản phẩm</div>
          <input class="form-input" id="mo-product" list="hedit-product-list" placeholder="Chọn hoặc gõ...">
        </div>
        <div>
          <div class="form-label">Doanh thu (VNĐ)</div>
          <input class="form-input" id="mo-revenue" type="number" min="0" placeholder="0">
        </div>
      </div>
      <div style="margin-bottom:6px">
        <div class="form-label">Sản phẩm chi tiết</div>
        <input class="form-input" id="mo-detail" list="hedit-detail-list" placeholder="Make9 x2, W15 x1...">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
        <div>
          <div class="form-label">Ngày đặt</div>
          <input class="form-input" id="mo-date" type="date" value="${todayStr}">
        </div>
        <div>
          <div class="form-label">Nguồn đơn</div>
          <input class="form-input" id="mo-source" list="mo-source-list" placeholder="KH Renew, Data mới...">
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);margin-bottom:8px">
        <input type="checkbox" id="mo-auto-sched"> Tự động thêm lịch chăm sóc (+7, +14 ngày, +1, +2 tháng)
      </label>
      <div style="display:flex;gap:6px">
        <button class="save-btn" style="flex:1;padding:6px" data-phone="${esc(c.phone)}" onclick="addManualOrder(this.dataset.phone)">💾 Lưu đơn hàng</button>
        <button onclick="_toggleAddOrderForm()" style="border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">Hủy</button>
      </div>
    </div>
    ${_ptsBoxHtml_(_pts)}
    ${_posOn ? _renderPosHistoryHtml_(c, _posRows) : `${_posLoading?'<div style="font-size:11px;color:var(--hint);margin-bottom:4px">⏳ đang kiểm tra đơn Pos…</div>':''}
    <div class="dp-stitle">Lịch sử đặt hàng (${sorted.length} đơn — ${fmtVND(c.orders.reduce((a,x)=>a+(x.revenue||0),0))} tổng · <span style="color:var(--green)">${c.renewOrders} Renew</span>)</div>
    ${sorted.slice(0,60).map((o,si)=>{
      const isRenew   = RENEW_SOURCES.includes(s(o.source).toLowerCase());
      const isMissing = !o.revenue || !o.product;
      const realIdx   = c.orders.indexOf(o);
      const eid       = `hedit_${c.phone}_${realIdx}`;
      const dateStr   = o.date instanceof Date && !isNaN(o.date)
        ? _ymd(o.date)
        : (o.year && o.month ? `${o.year}-${String(o.month).padStart(2,'0')}-01` : '');
      return `
      <div class="hist-item" id="hi_${eid}" style="${isRenew?'border-left:3px solid var(--green);padding-left:8px':''}${isMissing?'border-color:var(--orange,#e8a04a);background:rgba(232,160,74,.06)':''}">
        <div class="hist-top">
          <span class="hist-date">${formatDate(o.date,o.year,o.month)}</span>
          <span class="hist-price" style="${isMissing?'color:var(--orange,#e8a04a)':''}">${fmtVND(o.revenue)}</span>
          <button onclick="_histEditToggle('${eid}')" title="Sửa đơn này"
            style="border:none;background:${isMissing?'var(--orange,#e8a04a)':'var(--surface2)'};color:${isMissing?'#fff':'var(--muted)'};border-radius:4px;padding:1px 7px;font-size:11px;cursor:pointer;margin-left:6px;border:1px solid ${isMissing?'var(--orange,#e8a04a)':'var(--border)'}">
            ${isMissing?'⚠ Cập nhật':'✏ Sửa'}
          </button>
          ${((!currentUser || currentUser.role==='admin') || _isExactDuplicateOrder(c, realIdx)) ? `<button data-phone="${esc(c.phone)}" onclick="_histDeleteOrder(this.dataset.phone,${realIdx})" title="Xóa đơn này"
            style="border:1px solid var(--red-b,#fca5a5);background:var(--red-bg,#fff1f2);color:var(--red,#dc2626);border-radius:4px;padding:1px 7px;font-size:11px;cursor:pointer;margin-left:4px">
            🗑 Xóa
          </button>` : ''}
        </div>
        ${o.productDetail?`<div class="hist-prod" onclick="_toggleHistProd(this)" title="Bấm để xem đầy đủ sản phẩm">${esc(o.productDetail)}</div>`:''}
        <div class="hist-tags">
          <span class="htag" style="${isRenew?'background:var(--green-bg);color:var(--green);':''}">${isRenew?'✓ ':''}${esc(o.source)}</span>
          ${o.cs?`<span class="htag">👤 ${esc(o.cs)}</span>`:''}
          ${o.status?`<span class="htag">${esc(o.status)}</span>`:''}
          ${o.zalo?`<span class="htag">Zalo: ${esc(o.zalo)}</span>`:''}
          ${o.note?`<span class="htag">📝 ${esc(o.note.substring(0,35))}</span>`:''}
          ${(_pts.per.get(o)||{}).earn?`<span class="htag" style="background:var(--green-bg);color:var(--green)">🎁 +${_pts.per.get(o).earn} điểm</span>`:''}
          ${(_pts.per.get(o)||{}).spent?`<span class="htag" style="background:#fee2e2;color:#b91c1c">🎁 −${_pts.per.get(o).spent} điểm</span>`:''}
        </div>
        <div id="${eid}" style="display:none;margin-top:8px;padding:10px;background:var(--surface2);border-radius:6px;border:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--orange,#e8a04a);margin-bottom:6px">✏ Cập nhật đơn gốc</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
            <div>
              <div class="form-label">Sản phẩm</div>
              <input class="form-input" id="${eid}_product" list="hedit-product-list" value="${esc(o.product||'')}" placeholder="Chọn hoặc gõ...">
            </div>
            <div>
              <div class="form-label">Doanh thu (VNĐ)</div>
              <input class="form-input" id="${eid}_revenue" type="number" min="0" value="${o.revenue||0}">
            </div>
          </div>
          <div style="margin-bottom:6px">
            <div class="form-label">Sản phẩm chi tiết</div>
            <input class="form-input" id="${eid}_detail" list="hedit-detail-list" value="${esc(o.productDetail||'')}" placeholder="Make9 x2, W15 x1...">
          </div>
          <div style="margin-bottom:8px">
            <div class="form-label">Ngày đặt</div>
            <input class="form-input" id="${eid}_date" type="date" value="${dateStr}">
          </div>
          <div style="display:flex;gap:6px">
            <button class="save-btn" style="flex:1;background:var(--orange,#e8a04a);border-color:var(--orange,#e8a04a);padding:6px"
              data-phone="${esc(c.phone)}" onclick="_histEditSave(this.dataset.phone,${realIdx},'${eid}')">💾 Lưu cập nhật</button>
            <button onclick="_histEditToggle('${eid}')"
              style="border:1px solid var(--border);background:var(--surface);border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">Hủy</button>
          </div>
        </div>
      </div>`;
    }).join('')}`}
  </div>`;
}

// Mở rộng / thu gọn phần "sản phẩm chi tiết" của 1 đơn trong Lịch sử đơn
function _toggleHistProd(el){ if (el) el.classList.toggle('expanded'); }

function _histEditToggle(eid) {
  const el = document.getElementById(eid);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function _histEditSave(phone, orderIdx, eid) {
  const c = allCustomers.find(x => x.phone === phone);
  if (!c || !c.orders[orderIdx]) { toast('Không tìm thấy đơn hàng'); return; }

  const o          = c.orders[orderIdx];
  const oldRevenue = o.revenue || 0;
  const oldYear    = o.year;
  const oldMonth   = o.month;
  const oldDateStr = o.date instanceof Date && !isNaN(o.date) ? _ymd(o.date) : '';

  const newProduct = (document.getElementById(eid+'_product')?.value||'').trim();
  const newRevenue = parseFloat(document.getElementById(eid+'_revenue')?.value||0)||0;
  const newDetail  = (document.getElementById(eid+'_detail')?.value||'').trim();
  const newDateStr = document.getElementById(eid+'_date')?.value || '';

  // Cập nhật in-memory
  if (newProduct)  o.product       = newProduct;
  if (newDetail)   o.productDetail = newDetail;
  o.revenue = newRevenue;
  if (newDateStr) {
    const nd  = new Date(newDateStr + 'T00:00:00');
    o.date    = nd;
    o.year    = nd.getFullYear();
    o.month   = nd.getMonth() + 1;
  }

  // Recompute totals
  c.totalRevenue = _custRev_(c);
  c.hangKey = _hangKeyOf_(c.totalRevenue); c.hang = HANG_LABEL[c.hangKey];
  c.brands = new Set(c.orders.map(x=>x.product).filter(Boolean));
  c.renewOrders = c.orders.filter(x=>RENEW_SOURCES.includes(s(x.source).toLowerCase())).length;

  logAudit('order_edit', phone, '', `Sửa đơn: ${oldDateStr||oldYear+'/'+oldMonth} · ${oldRevenue}→${newRevenue} · ${newProduct}`);

  // Sync GSheets — patchOrder
  if (gsUrl) {
    show('loverlay');
    try {
      const payload = {
        action: 'patchOrder',
        phone, oldYear, oldMonth, oldRevenue,
        newRevenue, newProduct: o.product, newDetail: o.productDetail,
        newDate: newDateStr,
        newYear: o.year, newMonth: o.month
      };
      const r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(payload) });
      const txt = await r.text();
      let d2; try { d2=JSON.parse(txt); } catch(e){ d2={}; }
      hide('loverlay');
      if (d2.error) toast('Lỗi GSheets: '+d2.error);
      else toast('✓ Đã cập nhật đơn' + (d2.updated ? ' · Synced GSheets' : ' (GSheets không tìm thấy dòng, đã thêm mới)'));
    } catch(e) { hide('loverlay'); toast('Lỗi kết nối GSheets'); }
  } else {
    toast('✓ Đã cập nhật đơn (chưa cấu hình GSheets)');
  }

  renderTable();
  openDetail(phone, 'hist');
}
// CS chỉ được xoá 1 đơn qua nút thủ công này nếu nó TRÙNG Y ĐÚC với 1 đơn khác của cùng khách
// (cùng năm/tháng, doanh thu, sản phẩm, nguồn) — tức chắc chắn là bản nhân bản, không mất dữ liệu
// thật. Admin không bị giới hạn này.
function _isExactDuplicateOrder(c, idx){
  const o = c && c.orders && c.orders[idx];
  if (!o) return false;
  return c.orders.some((x, i) => {
    if (i === idx) return false;
    return x.year === o.year && x.month === o.month &&
           (x.revenue||0) === (o.revenue||0) &&
           String(x.product||'').trim().toLowerCase() === String(o.product||'').trim().toLowerCase() &&
           String(x.source||'').trim().toLowerCase() === String(o.source||'').trim().toLowerCase();
  });
}
async function _histDeleteOrder(phone, orderIdx) {
  const c = allCustomers.find(x => x.phone === phone);
  if (!c || !c.orders[orderIdx]) { toast('Không tìm thấy đơn hàng'); return; }
  const isAdminDel = !currentUser || currentUser.role === 'admin';
  if (!isAdminDel && !_isExactDuplicateOrder(c, orderIdx)) {
    toast('Bạn chỉ được xoá đơn nếu nó trùng y đúc với 1 đơn khác (nhân bản). Đơn này không trùng — liên hệ Admin nếu cần xoá.');
    return;
  }
  const o = c.orders[orderIdx];
  const label = [
    o.date instanceof Date && !isNaN(o.date) ? o.date.toLocaleDateString('vi-VN') : (o.year && o.month ? `${o.month}/${o.year}` : 'Không rõ ngày'),
    o.product || 'Không có sản phẩm',
    fmtVND(o.revenue)
  ].join(' · ');
  if (!confirm(`Xác nhận xóa đơn hàng này?\n\n${label}\n\nThao tác này không thể hoàn tác.`)) return;

  const oldYear    = o.year;
  const oldMonth   = o.month;
  const oldRevenue = o.revenue || 0;

  // Xóa trong bộ nhớ
  c.orders.splice(orderIdx, 1);
  c._keys = new Set(c.orders.map(x=>`${phone}_${x.year}_${x.month}_${x.revenue}`));
  c.totalRevenue = _custRev_(c);
  c.hangKey = _hangKeyOf_(c.totalRevenue); c.hang = HANG_LABEL[c.hangKey];
  c.brands = new Set(c.orders.map(x=>x.product).filter(Boolean));
  c.renewOrders = c.orders.filter(x=>RENEW_SOURCES.includes(s(x.source).toLowerCase())).length;

  logAudit('order_delete', phone, '', `Xóa đơn: ${label}`);

  if (gsUrl) {
    show('loverlay');
    try {
      const payload = { action: 'deleteOrder', phone, oldYear, oldMonth, oldRevenue };
      const r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify(payload) });
      const txt2 = await r.text();
      let d2; try { d2=JSON.parse(txt2); } catch(e){ d2={}; }
      hide('loverlay');
      if (d2.error) toast('⚠ Xóa local OK · Lỗi GSheets: '+d2.error);
      else toast('✓ Đã xóa đơn' + (d2.deleted ? ' · Đã xóa trên GSheets' : ' (không tìm thấy trên GSheets)'));
    } catch(e) { hide('loverlay'); toast('✓ Đã xóa local · Lỗi kết nối GSheets'); }
  } else {
    toast('✓ Đã xóa đơn (chưa cấu hình GSheets)');
  }

  renderTable();
  openDetail(phone, 'hist');
}

// Sau khi render Lịch sử đơn: chỉ gắn nút mở rộng (mũi tên) cho dòng SP bị cắt
function _initHistExpand(){
  var run = function(){
    try{
      var nodes = document.querySelectorAll('#dp-body .hist-prod');
      for (var i=0;i<nodes.length;i++){
        var el = nodes[i];
        el.classList.remove('expandable','expanded');
        if (el.scrollHeight > el.clientHeight + 1) el.classList.add('expandable');
      }
    }catch(e){}
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else run();
}

function _loadCskhDetailForPhone_(phone) {
  if (!phone || _cskhDetailState[phone] || !gsUrl) return;
  if (!(typeof cskhData !== 'undefined' && cskhData && cskhData[phone])) return; // khach khong co trong nguon CSKH-Duyen
  _cskhDetailState[phone] = 'loading';
  const sep = gsUrl.indexOf('?') >= 0 ? '&' : '?';
  const _get = function(action){ return fetch(gsUrl + sep + 'action=' + action + '&phone=' + encodeURIComponent(phone), { redirect: 'follow' }).then(function(r){ return r.json(); }); };
  // Uu tien action nhe 'cskhDetail'; GAS cu chua deploy (tra {error:'Unknown action'}) -> ha cap ve 'lookup'
  _get('cskhDetail')
    .then(function(j){ return (j && j.ok && Array.isArray(j.cskh)) ? j : _get('lookup'); })
    .then(function(j){
      const rows = (j && Array.isArray(j.cskh)) ? j.cskh : [];
      if (rows.length) { _cskhDetailCache[phone] = rows; _cskhDetailState[phone] = 'done'; }
      else { _cskhDetailState[phone] = 'fail'; }
    })
    .catch(function(err){ _cskhDetailState[phone] = 'fail'; console.warn('cskh detail error:', err && err.message); })
    .then(function(){
      // Ve lai tab Tong quan neu CS van dang xem dung khach nay (tab nay chi doc, khong co o nhap de mat)
      if (currentPhone === phone && currentDpTab === 'info' && !_dpDirty) {
        const c = allCustomers.find(function(x){ return x.phone === phone; });
        const body = document.getElementById('dp-body');
        if (c && body) body.innerHTML = renderInfoTab(c);
      }
    });
}

function _renderCskhBlock_(c) {
  const lite = c.cskh || [];
  if (!lite.length) return '';
  const full = _cskhDetailCache[c.phone];
  const rows = full && full.length ? full : lite;
  if (!full && !_cskhDetailState[c.phone]) setTimeout(function(){ _loadCskhDetailForPhone_(c.phone); }, 0);
  const _ckLoading = !full && _cskhDetailState[c.phone] === 'loading';
  const LBL = [['tier','Phân loại'],['staff','NV phụ trách'],['codeOrig','Mã KH (gốc)'],['codeOther','Mã KH khác'],['internal','Đối tượng nội bộ'],
    ['birthday','Ngày sinh'],['gender','Giới tính'],['address','Địa chỉ'],['email','Email'],['company','Công ty'],['taxCompany','MST công ty'],
    ['debt','Công nợ'],['source','Nguồn dữ liệu'],['note','Ghi chú']];
  return `<div style="margin-top:10px"><div class="dp-stitle">🗂 CSKH-Duyên${rows.length>1?` (${rows.length} dòng trùng SĐT)`:''}${_ckLoading?' <span style="font-weight:400;color:var(--hint);font-size:11px">⏳ đang tải chi tiết…</span>':''}</div>` +
    rows.map(r => `<div style="font-size:12px;margin-top:6px;background:var(--surface2);padding:8px;border-radius:6px">` +
      (r.name ? `<div style="font-weight:600;margin-bottom:4px">${esc(r.name)}${r.tier?` <span class="cs-badge">${esc(r.tier)}</span>`:''}</div>` : '') +
      LBL.filter(x => r[x[0]] && !(x[0]==='tier' && r.name)).map(x => `<div style="display:flex;gap:6px;padding:1px 0"><span style="color:var(--muted);min-width:92px">${x[1]}</span><span style="flex:1;word-break:break-word">${esc(r[x[0]])}</span></div>`).join('') +
      `</div>`).join('') + `</div>`;
}

function renderInfoTab(c) {
  const lastO = c.orders.reduce((a,b)=>{
    const da=a.date instanceof Date?a.date:new Date(0);
    const db=b.date instanceof Date?b.date:new Date(0);
    return db>da?b:a
  }, c.orders[0]);
  const csSet = [..._buildCsSet_(c.orders, c.phone)];
  const care = careData[c.phone] || {};
  const schedItems = [
    {label:'📞 Hẹn gọi', date: care.schedGoi, note: care.schedGoiNote, color:'#2563eb'},
    {label:'🔔 Nhắc SP', date: care.schedSP, note: care.schedSPNote, color:'var(--green)'},
    {label:'💜 Hẹn CS', date: care.schedCS, note: care.schedCSNote, color:'var(--vip)'},
    {label:'🛒 Hẹn mua', date: care.schedHen, note: care.schedHenNote, color:'var(--tn)'},
  ].filter(x=>x.date);
  const schedHtml = schedItems.length
    ? schedItems.map(s=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)"><span style="color:${s.color};font-weight:600;min-width:70px">${s.label}</span><span>${fmtDate(s.date)}</span>${s.note?`<span style="color:var(--muted)">· ${esc(s.note)}</span>`:''}</div>`).join('')
    : '<span style="color:var(--hint);font-size:11px">Chưa có lịch hẹn</span>';
  return `<div class="dp-section">
    <div class="dp-stitle">Tổng quan khách hàng</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-n">${c.totalOrders}</div><div class="stat-l">Tổng đơn</div></div>
      <div class="stat-box"><div class="stat-n" style="font-size:13px">${fmtVND(c.totalRevenue)}</div><div class="stat-l">Tổng doanh thu</div></div>
      <div class="stat-box"><div class="stat-n" style="font-size:12px">${lastO?formatDate(lastO.date,lastO.year,lastO.month):'—'}</div><div class="stat-l">Đơn gần nhất</div></div>
      <div class="stat-box"><div class="stat-n" style="font-size:12px">${c.renewOrders}</div><div class="stat-l">Đơn Renew</div></div>
      <div class="stat-box"><div class="stat-n" style="font-size:12px">${csSet.length ? csSet.slice(0,3).map(n=>`<span class="cs-badge">${esc(n)}</span>`).join('') : '—'}</div><div class="stat-l">CS phụ trách</div></div>
      <div class="stat-box" style="grid-column:span 2"><div class="stat-l" style="margin-bottom:4px">Nguồn đơn</div><div style="display:flex;gap:3px;flex-wrap:wrap">${c.sources.map(x=>`<span class="btag" style="font-size:10px">${esc(x)}</span>`).join('')}</div></div>
    </div>
    <div style="margin-top:10px">
      <div class="dp-stitle">Sản phẩm đã mua</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${c.brands.map(b=>`<span class="btag" style="font-size:11px;padding:3px 8px">${esc(b)}</span>`).join('')||'<span style="color:var(--hint);font-size:12px">Chưa có</span>'}</div>
    </div>
    ${_renderCskhBlock_(c)}
    ${care.note?`<div style="margin-top:10px"><div class="dp-stitle">Ghi chú CS</div><div style="font-size:12px;color:var(--muted);margin-top:4px;background:var(--surface2);padding:8px;border-radius:6px">${esc(care.note)}</div></div>`:''}
    <div style="margin-top:10px">
      <div class="dp-stitle">Lịch hẹn sắp tới</div>
      <div style="margin-top:6px">${schedHtml}</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════
//  NOTE HELPERS — lưu mảng JSON [{text,user,time}] trong care.note
// ═══════════════════════════════════════════════════════
function _parseNotes(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr; // new format
  } catch(e) {}
  // legacy plain text → wrap thành 1 entry không có user/time
  return [{ text: raw, user: '', time: '' }];
}
function _notesToStr(arr) { return JSON.stringify(arr); }
function _latestNoteText(raw) {
  const arr = _parseNotes(raw);
  return arr.length ? arr[0].text : '';
}
// CS chỉ được xoá ghi chú do CHÍNH MÌNH tạo (so khớp theo (các) tên gán cho tài khoản đăng
// nhập); Admin xoá được mọi ghi chú. Ghi chú cũ không rõ ai tạo (user rỗng — dữ liệu trước khi
// có tính năng gắn tên người tạo) chỉ Admin xoá được, vì không thể xác nhận ai là chủ.
function _canDeleteNote(n){
  if (!currentUser || currentUser.role === 'admin') return true;
  const owner = String((n && n.user) || '').trim().toLowerCase();
  if (!owner) return false;
  const myNames = (currentUser.names && currentUser.names.length) ? currentUser.names : (currentUser.name?[currentUser.name]:[]);
  return myNames.some(m => String(m).trim().toLowerCase() === owner);
}
function _renderNoteHistory(raw) {
  const arr = _parseNotes(raw);
  if (!arr.length) return '<div style="color:var(--hint);font-size:11px;text-align:center;padding:8px 0">Chưa có ghi chú nào</div>';
  return arr.map((n,i) => {
    const meta = [n.user, n.time].filter(Boolean).join(' · ');
    const canDel = _canDeleteNote(n);
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;position:relative">
      ${meta ? `<div style="font-size:10px;color:var(--muted);margin-bottom:4px;display:flex;align-items:center;gap:6px">
        ${n.user ? `<span style="font-weight:600;color:var(--accent)">${esc(n.user)}</span>` : ''}
        ${n.time ? `<span>${esc(n.time)}</span>` : ''}
        ${i===0 ? '<span style="background:#16a34a22;color:#16a34a;font-size:9px;padding:1px 5px;border-radius:20px;font-weight:600">MỚI NHẤT</span>' : ''}
      </div>` : ''}
      <div style="font-size:12px;white-space:pre-wrap;line-height:1.5">${esc(n.text)}</div>
      ${canDel ? `<button data-raw="${esc(raw)}" onclick="deleteNoteEntry(event,this,this.dataset.raw,${i})"
        style="position:absolute;top:6px;right:6px;background:none;border:none;cursor:pointer;color:var(--hint);font-size:11px;padding:2px 4px;border-radius:4px;opacity:.5"
        onmouseover="this.style.opacity='1';this.style.background='#ef444422'"
        onmouseout="this.style.opacity='.5';this.style.background='none'" title="Xóa ghi chú này">✕</button>` : ''}
    </div>`;
  }).join('');
}
function _fmtNoteTime(d) {
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${h}:${m} ${dd}/${mm}/${yy}`;
}
function addNoteEntry(phone) {
  const inp = document.getElementById('cs-note-new');
  const text = (inp ? inp.value : '').trim();
  if (!text) { if(inp) { inp.style.border='1px solid #ef4444'; setTimeout(()=>inp.style.border='',1200); } return; }
  const hiddenEl = document.getElementById('cs-note');
  const existing = hiddenEl ? hiddenEl.value : '';
  const arr = _parseNotes(existing);
  const userName = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) ? currentUser.name : 'Admin';
  arr.unshift({ text, user: userName, time: _fmtNoteTime(new Date()) });
  const newRaw = _notesToStr(arr);
  if (hiddenEl) hiddenEl.value = newRaw;
  if (inp) inp.value = '';
  const hist = document.getElementById('cs-note-history');
  if (hist) hist.innerHTML = _renderNoteHistory(newRaw);
  // update count in label
  const lbl = document.querySelector('#cs-note-history')?.closest('.form-row')?.querySelector('.form-label span:last-child');
  if (lbl) lbl.textContent = arr.length + ' ghi chú';
  // Auto-save
  saveCare(phone);
}
function deleteNoteEntry(ev, btn, raw, idx) {
  ev.stopPropagation();
  const phone = currentPhone;
  if (!phone) return;
  const hiddenEl = document.getElementById('cs-note');
  const existing = hiddenEl ? hiddenEl.value : raw;
  const arr = _parseNotes(existing);
  const target = arr[idx];
  // Chốt chặn thật (không chỉ ẩn nút): CS chỉ xoá được ghi chú do chính mình tạo, Admin xoá được hết
  if (!target || !_canDeleteNote(target)) {
    toast('Bạn chỉ có thể xoá ghi chú do chính mình tạo. Chỉ Admin mới xoá được ghi chú của người khác.');
    return;
  }
  if (!confirm('Xóa ghi chú này?')) return;
  arr.splice(idx, 1);
  const newRaw = _notesToStr(arr);
  if (hiddenEl) hiddenEl.value = newRaw;
  const hist = document.getElementById('cs-note-history');
  if (hist) hist.innerHTML = _renderNoteHistory(newRaw);
  saveCare(phone);
}

// ═══════════════════════════════════════════════════════
//  SAVE CARE + SCHEDULES
// ═══════════════════════════════════════════════════════
// Cờ "Phản hồi Zalo" (khách đã nhắn lại trên Zalo) lưu trong careData[phone].custom.zaloReply (cột 'custom' JSON có sẵn
// của CareData → KHÔNG cần thêm cột/sửa GAS; Zalo AI & Pancake AI copy nguyên object custom khi lưu nên không làm mất cờ).
// Báo cáo chia data: tỷ lệ phản hồi = KH có cờ / KH đã kết bạn Zalo ('Đã kết bạn').
function _zaloReplyOf(c){ return !!(c && c.custom && c.custom.zaloReply); }
function _zaloConnectedOf(c){ return !!c && c.zaloStatus === 'Đã kết bạn'; }
function saveCare(phone) {
  const existing = careData[phone] || {};
  const newStatus = document.getElementById('cs-status').value;
  const newZalo   = document.getElementById('cs-zalo').value;
  const newNote   = document.getElementById('cs-note') ? document.getElementById('cs-note').value : (existing.note||'');
  const newCS     = document.getElementById('cs-assign').value;
  const newKhStatus = (document.getElementById('cs-kh-status') ? document.getElementById('cs-kh-status').value : '') || existing.khStatus || (typeof _hAutoKh_==='function' ? _hAutoKh_(newStatus) : '') || '';
  const newBirthday = (document.getElementById('cs-birthday') ? document.getElementById('cs-birthday').value : '')
    || ((document.getElementById('cs-birthyear') && menhYearValid(document.getElementById('cs-birthyear').value)) ? document.getElementById('cs-birthyear').value.trim() : '')
    || existing.birthday || '';
  const newTag = (document.getElementById('cs-tag') ? document.getElementById('cs-tag').value.trim() : '') || existing.tag || '';
  const newNickZalos = (function(){ try { var el=document.getElementById('cs-nickzalo-val'); return el ? JSON.parse(el.value||'[]') : (existing.nickZalos||[]); } catch(e){ return existing.nickZalos||[]; }})();
  const newZaloPhones = (function(){ try { var el=document.getElementById('cs-zalophone-val'); return el ? JSON.parse(el.value||'[]') : (existing.zaloPhones||[]); } catch(e){ return existing.zaloPhones||[]; }})();
  // Trường tự tạo (admin thêm) — gộp chung 1 object 'custom' để không phải thêm cột mới vào Sheet
  const newCustom = _collectCustomFieldValues(existing.custom);
  const _zrEl = document.getElementById('cs-zalo-reply');
  if (_zrEl) { if (_zrEl.checked) newCustom.zaloReply = true; else delete newCustom.zaloReply; }   // bỏ tích = xoá khoá (không lưu false)
  if (!!(existing.custom||{}).zaloReply !== !!newCustom.zaloReply) logAudit('status', phone, 'Phản hồi Zalo: '+((existing.custom||{}).zaloReply?'Có':'Chưa'), 'Phản hồi Zalo: '+(newCustom.zaloReply?'Có':'Chưa'));
  // V9 audit: ghi lại thay đổi trạng thái / CS / Zalo
  if ((existing.status||'') !== newStatus) logAudit('status', phone, existing.status||'(trống)', newStatus||'(trống)');
  if ((existing.cs||'') !== newCS)         logAudit('cs', phone, existing.cs||'(trống)', newCS||'(trống)');
  if ((existing.zalo||'') !== newZalo)     logAudit('status', phone, 'Zalo: '+(existing.zalo||'(trống)'), 'Zalo: '+(newZalo||'(trống)'));
  if ((existing.khStatus||'') !== newKhStatus) logAudit('status', phone, 'KH: '+(existing.khStatus||'(trống)'), 'KH: '+(newKhStatus||'(trống)'));
  if ((existing.tag||'') !== newTag) logAudit('status', phone, 'Nhãn: '+(existing.tag||'(trống)'), 'Nhãn: '+(newTag||'(trống)'));
  // Audit cho từng trường tự tạo có thay đổi
  CUSTOM_FIELDS.forEach(function(f){
    var oldV = ((existing.custom||{})[f.id]) || '';
    var newV = (newCustom[f.id]) || '';
    if (oldV !== newV) logAudit('status', phone, f.label+': '+(oldV||'(trống)'), f.label+': '+(newV||'(trống)'));
  });
  try { if (typeof _hIsChot_==='function' && _hIsChot_(newStatus)) _hSaveChotFromForm_(phone, newCS); } catch(e){ console.warn('Lưu đơn chốt lỗi:', e); }
  careData[phone] = { ...existing, status: newStatus, zalo: newZalo, note: newNote, cs: newCS, khStatus: newKhStatus, birthday: newBirthday, tag: newTag, nickZalos: newNickZalos, zaloPhones: newZaloPhones, custom: newCustom };
  _touchCare(phone);
  saveLS('ome_care', careData);
  _invalidateFilterCache();
  const c = allCustomers.find(x=>x.phone===phone);
  if (c) {
    c.careStatus=careData[phone].status;
    c.zaloStatus=careData[phone].zalo;
    c.careNote=careData[phone].note;
    c.careCS=careData[phone].cs;
    c.custom=careData[phone].custom;   // để báo cáo chia data thấy cờ Phản hồi Zalo ngay, không cần tải lại
  }
  updateStats(); updateSidebarBadges();
  // Cập nhật _lastActionDate cho KH vừa lưu
  const _now = Date.now();
  const _cUpdated = allCustomers.find(x=>x.phone===phone);
  if (_cUpdated) _cUpdated._lastActionDate = _now;
  applyFilters();
  document.getElementById('dp-meta').innerHTML = `
    <span class="cphone" id="dp-phone-display">${phone}</span>
    <button data-phone="${esc(phone)}" onclick="copyPhone(this.dataset.phone)" title="Copy số điện thoại" style="background:none;border:1px solid var(--border-md);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--muted);line-height:1.4" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">📋</button>
    <button data-phone="${esc(phone)}" onclick="openEditPhone(this.dataset.phone)" title="Sửa SĐT / Tên KH" style="background:none;border:1px solid var(--border-md);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:11px;color:var(--muted);line-height:1.4" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">✏️</button>
    ${tierBadge(c?c.tier:'Chưa bán lại được')}
    ${careBadge(careData[phone].status)}
    ${zaloBadge(careData[phone].zalo)}
    ${custStatusBadge(careData[phone].khStatus)}${cfBadges(phone)}`;
  if (gsUrl) { queueCareSync(phone); toast('✓ Đã lưu'); }
  else toast('✓ Đã lưu tình trạng (local)');
  // Ghi tên CS chăm sóc xuống OrderData cột N (chỉ khi CS chăm sóc thay đổi)
  if (gsUrl && (existing.cs||'') !== (newCS||'')) pushOrderCareCS(phone, newCS);
}

// Ghi CS chăm sóc (careCS) vào OrderData cột N cho tất cả đơn của 1 SĐT (chạy nền, không chặn UI)
function pushOrderCareCS(phone, careCS){
  if (!gsUrl || !phone) return;
  fetch(gsUrl, { method:'POST', redirect:'follow',
    body: JSON.stringify({ action:'setOrderCareCS', phone:String(phone), careCS:careCS||'' }) })
    .catch(function(){});
}

// ── Ô "CS chăm sóc" trong panel: gõ tên để tìm rồi chọn ──
function csAssignRender(q){
  var sel = document.getElementById('cs-assign');
  var list = document.getElementById('cs-assign-list');
  if (!sel || !list) return;
  var qf = (typeof _foldVi==='function') ? _foldVi(q||'') : String(q||'').toLowerCase();
  var opts = Array.prototype.slice.call(sel.options).filter(function(o){ return o.value !== ''; });
  var items = qf ? opts.filter(function(o){ var t=(typeof _foldVi==='function')?_foldVi(o.textContent):o.textContent.toLowerCase(); return t.indexOf(qf) >= 0; }) : opts;
  var html = '<div class="cs-assign-opt cs-assign-clear" onmousedown="csAssignPick(event,\'\')">— Bỏ chọn / chưa giao —</div>';
  html += items.map(function(o){
    return '<div class="cs-assign-opt" data-v="'+esc(o.value)+'" onmousedown="csAssignPick(event, this.getAttribute(\'data-v\'))">'+esc(o.textContent)+'</div>';
  }).join('');
  if (!items.length) html += '<div class="cs-assign-empty">Không tìm thấy CS</div>';
  list.innerHTML = html;
}
function csAssignOpen(){
  var list = document.getElementById('cs-assign-list'); if(!list) return;
  var inp = document.getElementById('cs-assign-input');
  csAssignRender(inp ? inp.value : '');
  list.classList.add('open');
}
function csAssignClose(){ var l=document.getElementById('cs-assign-list'); if(l) l.classList.remove('open'); }
function csAssignFilter(){
  var inp = document.getElementById('cs-assign-input');
  csAssignRender(inp ? inp.value : '');
  var l=document.getElementById('cs-assign-list'); if(l) l.classList.add('open');
}
function csAssignPick(e, v){
  if (e && e.preventDefault) e.preventDefault();
  var sel = document.getElementById('cs-assign'); if (sel) sel.value = v;
  var inp = document.getElementById('cs-assign-input'); if (inp) inp.value = v;
  csAssignClose();
}
function csAssignSyncInput(){
  var sel = document.getElementById('cs-assign'), inp = document.getElementById('cs-assign-input');
  if (sel && inp) inp.value = sel.value;   // gõ dở mà không chọn thì trả lại giá trị thực
}
function csAssignKey(e){
  if (e.key === 'Escape'){ csAssignClose(); return; }
  if (e.key === 'ArrowDown'){ csAssignOpen(); return; }
  if (e.key === 'Enter'){
    e.preventDefault();
    var list = document.getElementById('cs-assign-list');
    var first = list && list.querySelector('.cs-assign-opt[data-v]');
    if (first) csAssignPick(e, first.getAttribute('data-v'));
  }
}
// ═══════════════════════════════════════════════════════
//  NICK ZALO — danh sách tùy chỉnh CS tự tạo
// ═══════════════════════════════════════════════════════

// Toàn bộ danh sách Nick Zalo (tên tùy chỉnh, dùng chung cho mọi KH)
function _loadNickZaloList() {
  try { return JSON.parse(localStorage.getItem('ome_nickzalo_list') || '[]'); } catch(e) { return []; }
}
function _saveNickZaloList(list) {
  try { localStorage.setItem('ome_nickzalo_list', JSON.stringify(list)); } catch(e) {}
}
async function _syncNickZaloListFromGAS() {
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=nickZaloList', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value) {
      try {
        var list = JSON.parse(data.value);
        if (Array.isArray(list)) {
          _nickZaloList = list;
          _saveNickZaloList(list);
          return list;
        }
      } catch(e) {}
    }
  } catch(e) {}
  return _loadNickZaloList();
}
function _buildNickZaloOptions(selected) {
  return _nickZaloList.map(function(name) {
    return '<option value="' + esc(name) + '"' + (selected===name?' selected':'') + '>' + esc(name) + '</option>';
  }).join('');
}

function _renderNickZaloChips(arr, phone) {
  if (!arr || !arr.length) return '';
  return arr.map(function(name, idx) {
    return '<span class="nickzalo-chip">💬 ' + esc(name) +
      '<button class="nz-x" data-phone="' + esc(phone) + '" title="Bỏ nick này" onclick="removeNickZaloChip(this.dataset.phone,' + idx + ')">✕</button>' +
      '</span>';
  }).join('');
}

function addNickZaloChip(phone, sel) {
  var val = sel ? sel.value : '';
  if (!val) return;
  // Đọc mảng hiện tại từ hidden input
  var hidEl = document.getElementById('cs-nickzalo-val');
  var arr = [];
  try { arr = JSON.parse((hidEl && hidEl.value) || '[]'); } catch(e) {}
  // Không thêm trùng
  if (arr.indexOf(val) >= 0) { sel.value=''; toast('Nick này đã được chọn rồi'); return; }
  arr.push(val);
  if (hidEl) hidEl.value = JSON.stringify(arr);
  // Refresh chip row
  var chipsEl = document.getElementById('cs-nickzalo-chips');
  if (chipsEl) chipsEl.innerHTML = _renderNickZaloChips(arr, phone);
  // Reset select
  if (sel) sel.value = '';
}

function removeNickZaloChip(phone, idx) {
  var hidEl = document.getElementById('cs-nickzalo-val');
  var arr = [];
  try { arr = JSON.parse((hidEl && hidEl.value) || '[]'); } catch(e) {}
  arr.splice(idx, 1);
  if (hidEl) hidEl.value = JSON.stringify(arr);
  var chipsEl = document.getElementById('cs-nickzalo-chips');
  if (chipsEl) chipsEl.innerHTML = _renderNickZaloChips(arr, phone);
}

// ── Modal quản lý danh sách Nick Zalo ──
function openNickZaloModal(phone) {
  // Sync danh sách từ GAS trước khi mở modal
  _syncNickZaloListFromGAS().then(function(list){
    _nickZaloList = list || [];
    // Tạo modal nếu chưa có
    if (!document.getElementById('nz-modal-overlay')) {
      var div = document.createElement('div');
      div.id = 'nz-modal-overlay';
      div.className = 'nz-modal-overlay';
      div.innerHTML =
        '<div class="nz-modal">' +
          '<div class="nz-modal-hdr">' +
            '<div class="nz-modal-title">💬 Quản lý danh sách Nick Zalo</div>' +
            '<button class="close-btn" onclick="closeNickZaloModal()">✕</button>' +
          '</div>' +
          '<div class="nz-modal-body">' +
            '<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Tạo danh sách tên Nick Zalo dùng chung. CS chọn nick phù hợp khi chăm sóc từng khách.</div>' +
            '<div class="nz-add-row">' +
              '<input class="nz-add-input" id="nz-new-input" placeholder="Nhập tên nick (vd: Zalo 1 Diệp...)" onkeydown="if(event.key===\'Enter\')addNickZaloToList()">' +
              '<button class="nz-add-confirm" onclick="addNickZaloToList()">+ Thêm</button>' +
            '</div>' +
            '<div id="nz-list-body"></div>' +
          '</div>' +
          '<div class="nz-modal-footer">' +
            '<button class="btn" onclick="closeNickZaloModal()">Đóng</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(div);
      div.addEventListener('click', function(e){ if(e.target===div) closeNickZaloModal(); });
    }
    _renderNickZaloModalList();
    document.getElementById('nz-modal-overlay').classList.add('open');
    // Store current phone for refreshing chips after close
    document.getElementById('nz-modal-overlay').dataset.phone = phone || '';
  });
}

function closeNickZaloModal() {
  var ov = document.getElementById('nz-modal-overlay');
  if (ov) ov.classList.remove('open');
  // Lam moi dropdown con dung danh sach nay (broadcast compose) — form cham soc khach khong
  // con o nay nua, da thay bang SDT Zalo (zaloPhones), xem openZaloPhoneSettingsModal/_renderZaloPhoneField.
  if (typeof _bcLoadNickList === 'function') { try { _bcLoadNickList(); } catch(e){} }
}

function _renderNickZaloModalList() {
  var body = document.getElementById('nz-list-body');
  if (!body) return;
  if (!_nickZaloList.length) {
    body.innerHTML = '<div style="color:var(--hint);font-size:12px;padding:8px 0;text-align:center">Chưa có nick nào · Thêm nick bên trên</div>';
    return;
  }
  body.innerHTML = _nickZaloList.map(function(name, idx) {
    return '<div class="nz-item-row">' +
      '<span style="font-size:16px">💬</span>' +
      '<span class="nz-item-name">' + esc(name) + '</span>' +
      '<button class="nz-del-btn" title="Xóa" onclick="deleteNickZaloFromList(' + idx + ')">🗑</button>' +
    '</div>';
  }).join('');
}

async function addNickZaloToList() {
  var inp = document.getElementById('nz-new-input');
  var val = inp ? inp.value.trim() : '';
  if (!val) { if(inp){inp.style.border='1px solid var(--red)';setTimeout(function(){inp.style.border='';},1200);} return; }
  if (_nickZaloList.indexOf(val) >= 0) { toast('Nick "' + val + '" đã có trong danh sách'); return; }
  // Hiển thị ngay (lạc quan) rồi ghi lên GAS bằng addZaloNick (GỘP phía server, không ghi đè nick người khác)
  _nickZaloList.push(val);
  _saveNickZaloList(_nickZaloList);
  if (inp) inp.value = '';
  _renderNickZaloModalList();
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({action:'addZaloNick', nick: val}) });
    var d = await r.json();
    if (d && d.error) {
      // GAS cũ chưa có addZaloNick → fallback setSetting (ghi cả danh sách)
      await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({action:'setSetting', key:'nickZaloList', value: JSON.stringify(_nickZaloList)}) });
    } else if (d && Array.isArray(d.list)) {
      _nickZaloList = d.list; _saveNickZaloList(_nickZaloList); _renderNickZaloModalList();
    }
    toast('✓ Đã thêm "' + val + '"');
  } catch(e) { toast('⚠ Đã thêm cục bộ nhưng lưu máy chủ lỗi: ' + e.message); }
}

async function deleteNickZaloFromList(idx) {
  var name = _nickZaloList[idx];
  if (!confirm('Xóa nick "' + name + '" khỏi danh sách?\n(Các khách đã chọn nick này sẽ không bị ảnh hưởng)')) return;
  // Lấy bản mới nhất từ GAS trước để không vô tình ghi đè nick người khác vừa thêm
  try { var latest = await _syncNickZaloListFromGAS(); if (Array.isArray(latest)) _nickZaloList = latest; } catch(e){}
  var pos = _nickZaloList.indexOf(name);
  if (pos >= 0) _nickZaloList.splice(pos, 1);
  _saveNickZaloList(_nickZaloList);
  _renderNickZaloModalList();
  try {
    await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({action:'setSetting', key:'nickZaloList', value: JSON.stringify(_nickZaloList)}) });
    toast('Đã xóa "' + name + '"');
  } catch(e) { toast('⚠ Xóa cục bộ nhưng lưu máy chủ lỗi: ' + e.message); }
}


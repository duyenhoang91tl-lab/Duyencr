// content.js — chạy trong trang pos.pancake.vn / pages.fm / messenger.com
// Hiện panel nổi gợi ý trả lời AI, đọc hội thoại theo selector đã cấu hình trong Options.

(function () {
  const PLATFORM = detectPlatform();
  let settings = null;
  let panelEl = null;
  let lastConversationSignature = "";

  // ── CARE (tra cuu + sua trang thai CS) — cung du lieu/hanh vi voi Zalo AI ──
  const CARE_STATUSES = [
    'Chưa liên hệ','Chưa sử dụng','Hẹn gọi lại sau','Đang sd','Đang tạm ngưng',
    'Knm/Máy bận','Cúp ngang','Thuê bao','Phân vân/Tiềm năng','Chốt',
    'Kcnc/Không hiệu quả','Đặt hộ/Sai số','Bầu'
  ];
  const ZALO_STATUSES = ['','Đã kết bạn','Chưa kết bạn','Chưa đồng ý','Không nhận tn lạ','Chặn','Hủy kết bạn','Không tìm thấy zl','ZL NHD/K có','Zalo ngừng hd'];
  const KH_STATUS_OPTS = [
    '','1. Không thể kết nối',
    '2.1 Không hiệu quả','2.2 Hiệu quả','2.3 Chưa rõ tác dụng',
    '3. Chưa dùng',
    '4.1 Không hiệu quả','4.2 Đã có kết quả','4.3 Đã đổi sang sản phẩm khác',
    '5. Đang tạm dừng','6. Nhận hộ / Sai số','7. Ngang Cúp','8. Từ chối'
  ];
  const CARE_POLL_MS = 6000;
  const REM_POLL_MS = 5 * 60 * 1000; // quet nhac hen moi 5 phut
  let CS_NAMES = [];
  let _currentPhone = '';
  let _currentCare = null;   // du lieu care dang hien thi/sua tren form
  let _lastServerCare = {};  // baseline lan tra cuu/poll gan nhat — de biet CS dang sua truong nao
  let _carePollTimer = null;
  let _remPollTimer = null;
  let _reminders = [];

  init();

  async function init() {
    settings = await getSettings();
    if (!settings.enabled || !settings.platform[PLATFORM]) return;

    injectPanel();
    observeConversationChanges();
    loadCsNames_();
    startCarePoll_();
    loadReminders_();
    startRemPoll_();
  }

  function detectPlatform() {
    const host = location.hostname;
    if (host.endsWith("pancake.vn") || host.includes("pages.fm")) return "pancake";
    if (host.includes("messenger.com")) return "messenger";
    return "unknown";
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (resp) => {
        resolve(resp?.settings || {});
      });
    });
  }

  function injectPanel() {
    if (panelEl) return;
    panelEl = document.createElement("div");
    panelEl.id = "pk-ai-panel";
    panelEl.innerHTML = `
      <div id="pk-ai-header">
        <span>🤖 Gợi ý trả lời AI</span>
        <button id="pk-ai-collapse" title="Thu gọn">—</button>
      </div>
      <div id="pk-ai-body">
        <div id="pk-ai-cs-row">
          <label>CS đang dùng</label>
          <select id="pk-cs-sel"></select>
        </div>
        <div id="pk-ai-phone-row">
          <input type="text" id="pk-ai-phone-input" placeholder="SĐT khách (nếu không tự nhận ra)" />
          <button id="pk-ai-phone-btn">Tra cứu</button>
        </div>
        <div id="pk-ai-customer"></div>

        <div id="pk-rem-section">
          <div id="pk-rem-header">
            <span>⏰ Nhắc hẹn hôm nay (<span id="pk-rem-count">0</span>)</span>
            <button id="pk-rem-refresh" title="Tải lại">🔄</button>
          </div>
          <div id="pk-rem-list"></div>
        </div>

        <div id="pk-ai-status">Chưa có hội thoại nào được chọn.</div>
        <div id="pk-ai-suggestions"></div>
        <button id="pk-ai-refresh">Lấy gợi ý mới</button>
      </div>
    `;
    document.body.appendChild(panelEl);

    const csSel = panelEl.querySelector('#pk-cs-sel');
    csSel.addEventListener('change', () => {
      chrome.storage.sync.set({ csName: csSel.value });
      loadReminders_();
    });

    panelEl.querySelector("#pk-ai-refresh").addEventListener("click", () => {
      requestSuggestion(true);
    });
    panelEl.querySelector("#pk-ai-collapse").addEventListener("click", () => {
      panelEl.classList.toggle("pk-ai-collapsed");
    });
    panelEl.querySelector("#pk-ai-phone-btn").addEventListener("click", () => {
      const raw = panelEl.querySelector("#pk-ai-phone-input").value;
      const phone = normPhone(raw);
      if (!phone) { setStatus("Số điện thoại không hợp lệ."); return; }
      lookupByPhone(phone);
    });
    panelEl.querySelector("#pk-ai-phone-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") panelEl.querySelector("#pk-ai-phone-btn").click();
    });
    panelEl.querySelector("#pk-rem-refresh").addEventListener("click", () => loadReminders_());
  }

  // ── CS đang dùng (sticky theo máy, lưu chrome.storage.sync) ──
  async function loadCsNames_() {
    chrome.runtime.sendMessage({ type: "GET_CS_NAMES" }, (resp) => {
      CS_NAMES = (resp?.ok && resp.data && resp.data.length) ? resp.data : [];
      const csSel = panelEl?.querySelector('#pk-cs-sel');
      if (!csSel) return;
      const names = CS_NAMES.length ? CS_NAMES : [settings.csName].filter(Boolean);
      csSel.innerHTML = '<option value="">— Chọn CS —</option>' +
        names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
      csSel.value = settings.csName || '';
    });
  }

  function observeConversationChanges() {
    const sel = settings.selectors?.[PLATFORM];
    if (!sel?.messageList) {
      setStatus(
        "Chưa cấu hình selector cho trang này. Mở Options của extension và điền CSS selector (xem hướng dẫn README)."
      );
      return;
    }

    const observer = new MutationObserver(() => {
      const messages = extractMessages();
      const signature = messages.map((m) => m.text).join("|").slice(0, 500);
      if (signature && signature !== lastConversationSignature) {
        lastConversationSignature = signature;
        requestSuggestion(false);
        requestCustomerLookup();
      }
    });

    // Quan sát toàn bộ body vì Pancake/Messenger render lại DOM khi đổi hội thoại (SPA)
    observer.observe(document.body, { childList: true, subtree: true });

    // Thử ngay lần đầu
    const initial = extractMessages();
    if (initial.length) {
      lastConversationSignature = initial.map((m) => m.text).join("|").slice(0, 500);
      requestSuggestion(false);
      requestCustomerLookup();
    }
  }

  // ── Tra cứu khách hàng theo SĐT (dùng chung action 'lookup' của GAS) ──

  function normPhone(p) {
    if (!p) return "";
    let s = String(p).replace(/\D/g, "");
    if (s.startsWith("84") && s.length === 11) s = "0" + s.slice(2);
    if (s.length === 9 && /^[3-9]/.test(s)) s = "0" + s;
    return s;
  }

  function extractPhone() {
    const sel = settings.selectors?.[PLATFORM];
    // Ưu tiên selector riêng cho ô hiển thị SĐT khách (nếu đã cấu hình)
    if (sel?.phoneSelector) {
      const el = document.querySelector(sel.phoneSelector);
      const m = el?.innerText?.match(/(0[3-9]\d{8})/);
      if (m) return normPhone(m[1]);
    }
    // Fallback: quét toàn bộ vùng tin nhắn tìm số điện thoại VN dạng 0xxxxxxxxx
    const container = sel?.messageList ? document.querySelector(sel.messageList) : null;
    const scope = container || document.body;
    const m2 = scope.innerText?.match(/(0[3-9]\d{8})/);
    return m2 ? normPhone(m2[1]) : "";
  }

  // ── Lấy tên khách từ khung "Sản phẩm order" (ghi chú đơn hàng CS tự nhập) ──
  // Dòng đầu của khối trên cùng thường dạng "Chị : Tên", "Anh Tên", hoặc "Tên +sđt".
  function extractOrderPanelName_() {
    const sel = settings.selectors?.[PLATFORM];
    let container = null;
    if (sel?.orderPanelSelector) {
      container = document.querySelector(sel.orderPanelSelector);
    }
    if (!container) {
      // Do tu dong: tim node la (khong con con) co chu "San pham order" lam tieu de,
      // roi lay phan tu cha lam vung chua danh sach cac khoi khach.
      const nodes = document.querySelectorAll('body *');
      for (const el of nodes) {
        if (el.children.length > 0) continue;
        const t = (el.textContent || '').trim();
        if (t.length > 0 && t.length < 40 && /sản phẩm order/i.test(t)) {
          container = el.closest('div')?.parentElement || el.parentElement;
          break;
        }
      }
    }
    if (!container) return '';
    const text = container.innerText || '';
    if (!text.trim()) return '';
    // Bo dong tieu de "Sản phẩm order" neu dinh kem trong cung container
    const cleaned = text.replace(/^.*sản phẩm order.*$/im, '').trim();
    // Tach cac khoi khach theo dong trong — khoi dau tien = khach dang xu ly (tren cung)
    const blocks = cleaned.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return '';
    const firstLine = blocks[0].split('\n')[0].trim();
    return _parseNameFromLine_(firstLine);
  }

  function _parseNameFromLine_(line) {
    if (!line) return '';
    let s = line;
    s = s.replace(/(\+?84|0)\d{8,10}/g, '').trim(); // bo sdt dinh kem tren cung dong
    s = s.replace(/^(anh|chị|chi|ông|ong|bà|ba|em)\b\s*[:.]?\s*/i, '').trim(); // bo xung ho
    s = s.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '').trim();
    return s;
  }

  function requestCustomerLookup() {
    const phone = extractPhone();
    if (!phone) {
      panelEl.querySelector("#pk-ai-customer").innerHTML = "";
      _currentPhone = ''; _currentCare = null; _lastServerCare = {}; _currentOrderPanelName = '';
      return;
    }
    lookupByPhone(phone);
  }

  function lookupByPhone(phone) {
    const box = panelEl.querySelector("#pk-ai-customer");
    box.innerHTML = `<div class="pk-ai-cust-loading">Đang tra cứu ${phone}...</div>`;
    chrome.runtime.sendMessage({ type: "LOOKUP_CUSTOMER", payload: { phone } }, (resp) => {
      if (!resp?.ok) {
        box.innerHTML = `<div class="pk-ai-cust-loading">Không tra cứu được: ${resp?.error || "lỗi không rõ"}</div>`;
        return;
      }
      _currentPhone = phone;
      _currentCare = resp.data.care || null;
      _lastServerCare = _currentCare ? Object.assign({}, _currentCare) : {};
      renderCustomerCard(phone, resp.data);
    });
  }

  // ── Ghi chú CS: cung dinh dang JSON [{text,user,time}] voi Zalo AI/Sasum ──
  function _parseNotes(raw) {
    if (!raw) return [];
    try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch (e) {}
    return [{ text: raw, user: '', time: '' }];
  }
  function _notesToStr(arr) { return JSON.stringify(arr); }
  function _fmtNoteTime(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${h}:${m} ${dd}/${mm}/${d.getFullYear()}`;
  }
  function toInputDate_(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate_(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function renderCustomerCard(phone, data) {
    const box = panelEl.querySelector("#pk-ai-customer");
    const { care, orders } = data;

    const orderPanelName = extractOrderPanelName_();
    _currentOrderPanelName = orderPanelName;
    const name = orderPanelName || (orders && orders[0] && orders[0].name) || (care && care.name) || phone;
    const totalRevenue = (orders || []).reduce((s, o) => s + (parseFloat(o.revenue) || 0), 0);
    const products = [...new Set((orders || []).map((o) => o.product).filter(Boolean))].slice(0, 4).join(", ");
    const isNew = !care && (!orders || !orders.length);

    const optHtml = (opts, val) => opts.map((o) =>
      `<option value="${escapeHtml(o)}"${o === (val || '') ? ' selected' : ''}>${o ? escapeHtml(o) : '— Chọn —'}</option>`
    ).join('');

    const chips = [];
    if (orders?.length) chips.push(`📦 ${orders.length} đơn`);
    if (totalRevenue) chips.push(`💰 ${Math.round(totalRevenue / 1000)}K`);
    if (care?.schedHen) chips.push(`📅 Hẹn ${fmtDate_(care.schedHen)}`);

    box.innerHTML = `
      <div class="pk-ai-cust-card">
        <div class="pk-ai-cust-name">${escapeHtml(name)} <span class="pk-ai-cust-phone">${phone}</span></div>
        ${isNew ? `<div class="pk-ai-new-tag">⚠️ Chưa có trong hệ thống Sasum — lưu sẽ tạo mới</div>` : ''}
        ${chips.length ? `<div class="pk-ai-cust-chips">${chips.map((c) => `<span class="pk-ai-chip">${c}</span>`).join('')}</div>` : ''}
        ${products ? `<div class="pk-ai-cust-products">🏷 ${escapeHtml(products)}</div>` : ''}

        <div class="pk-form-row">
          <div class="pk-form-col">
            <label>Trạng thái CS</label>
            <select id="pk-status-sel">${optHtml([''].concat(CARE_STATUSES), care?.status)}</select>
          </div>
          <div class="pk-form-col">
            <label>Trạng thái Zalo</label>
            <select id="pk-zalo-sel">${optHtml(ZALO_STATUSES, care?.zalo)}</select>
          </div>
        </div>
        <div class="pk-form-row">
          <div class="pk-form-col">
            <label>Tình trạng KH</label>
            <select id="pk-khstatus-sel">${optHtml(KH_STATUS_OPTS, care?.khStatus)}</select>
          </div>
          <div class="pk-form-col">
            <label>Sinh nhật</label>
            <input type="date" id="pk-birthday" value="${care?.birthday ? toInputDate_(care.birthday) : ''}" />
          </div>
        </div>

        <div class="pk-form-row">
          <div class="pk-form-col">
            <label>Ngày hẹn</label>
            <input type="date" id="pk-hen-date" value="${care?.schedHen ? toInputDate_(care.schedHen) : ''}" />
          </div>
          <div class="pk-form-col">
            <button id="pk-hen-done" class="pk-btn-outline" title="Xong lịch hẹn — xoá ngày hẹn">✓ Xong hẹn</button>
          </div>
        </div>
        <input type="text" id="pk-hen-note" class="pk-full-input" placeholder="Ghi chú lịch hẹn" value="${escapeHtml(care?.schedHenNote || '')}" />

        <label class="pk-label-top">Ghi chú CS</label>
        <div id="pk-note-history"></div>
        <div class="pk-note-add-row">
          <input type="text" id="pk-note-new" placeholder="Thêm ghi chú mới..." />
          <button id="pk-note-add-btn" class="pk-btn-outline">+</button>
        </div>
        <input type="hidden" id="pk-note-raw" value="${escapeHtml(care?.note || '')}" />

        <button id="pk-save-btn" class="pk-save-btn">💾 Lưu vào Sasum</button>
      </div>
    `;

    renderNoteHistory_(care?.note || '');

    box.querySelector('#pk-note-add-btn').addEventListener('click', addNoteEntry_);
    box.querySelector('#pk-note-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addNoteEntry_();
    });
    box.querySelector('#pk-hen-done').addEventListener('click', () => doneAppointment_(phone));
    box.querySelector('#pk-save-btn').addEventListener('click', () => saveCare_(phone));
  }

  function renderNoteHistory_(raw) {
    const hist = panelEl.querySelector('#pk-note-history');
    if (!hist) return;
    const arr = _parseNotes(raw);
    if (!arr.length) { hist.innerHTML = '<div class="pk-note-empty">Chưa có ghi chú nào</div>'; return; }
    hist.innerHTML = arr.map((n, i) => {
      const meta = [n.user, n.time].filter(Boolean).join(' · ');
      return `<div class="pk-note-entry">
        ${meta ? `<div class="pk-note-meta">${escapeHtml(meta)}${i === 0 ? ' <span class="pk-note-latest">MỚI NHẤT</span>' : ''}</div>` : ''}
        <div class="pk-note-text">${escapeHtml(n.text)}</div>
        <button class="pk-note-del" data-idx="${i}" title="Xóa ghi chú này">✕</button>
      </div>`;
    }).join('');
    hist.querySelectorAll('.pk-note-del').forEach((b) => {
      b.addEventListener('click', () => deleteNoteEntry_(parseInt(b.dataset.idx, 10)));
    });
  }

  function addNoteEntry_() {
    const inp = panelEl.querySelector('#pk-note-new');
    const text = (inp ? inp.value : '').trim();
    if (!text) return;
    const rawEl = panelEl.querySelector('#pk-note-raw');
    const arr = _parseNotes(rawEl ? rawEl.value : '');
    const userName = settings.csName || 'CS';
    arr.unshift({ text, user: userName, time: _fmtNoteTime(new Date()) });
    const newRaw = _notesToStr(arr);
    if (rawEl) rawEl.value = newRaw;
    if (inp) inp.value = '';
    renderNoteHistory_(newRaw);
  }

  function deleteNoteEntry_(idx) {
    if (!confirm('Xóa ghi chú này?')) return;
    const rawEl = panelEl.querySelector('#pk-note-raw');
    const arr = _parseNotes(rawEl ? rawEl.value : '');
    arr.splice(idx, 1);
    const newRaw = _notesToStr(arr);
    if (rawEl) rawEl.value = newRaw;
    renderNoteHistory_(newRaw);
  }

  // Gom toan bo form thanh 1 'row' de gui saveSingle. QUAN TRONG: cac truong Pancake KHONG
  // co UI de sua (schedules, schedGoi*, schedSP*, schedCS*, nickZalos...) phai lay nguyen tu
  // _currentCare hien tai, khong duoc de trong — neu khong GAS se ghi de trong mat du lieu
  // (xem careRow_ trong gas_v13.js: chi 4 truong mo rong duoc tu merge, con lai thi khong).
  let _currentOrderPanelName = ''; // ten khach vua doc duoc tu khung 'San pham order' (neu co)
  function _buildRow(phone, overrides) {
    const c = _currentCare || {};
    return Object.assign({
      phone,
      status: c.status || '', zalo: c.zalo || '', cs: settings.csName || c.cs || '',
      note: c.note || '',
      schedules: c.schedules || '',
      schedGoi: c.schedGoi || '', schedGoiNote: c.schedGoiNote || '',
      schedSP: c.schedSP || '', schedSPNote: c.schedSPNote || '',
      schedCS: c.schedCS || '', schedCSNote: c.schedCSNote || '',
      schedHen: c.schedHen || '', schedHenNote: c.schedHenNote || '',
      khStatus: c.khStatus || '', birthday: c.birthday || '',
      nickZalos: c.nickZalos || [],
      name: _currentOrderPanelName || c.name || ''
    }, overrides || {});
  }

  function saveCare_(phone) {
    const btn = panelEl.querySelector('#pk-save-btn');
    const rawEl = panelEl.querySelector('#pk-note-raw');
    const row = _buildRow(phone, {
      status: panelEl.querySelector('#pk-status-sel').value,
      zalo: panelEl.querySelector('#pk-zalo-sel').value,
      khStatus: panelEl.querySelector('#pk-khstatus-sel').value,
      birthday: panelEl.querySelector('#pk-birthday').value,
      schedHen: panelEl.querySelector('#pk-hen-date').value,
      schedHenNote: panelEl.querySelector('#pk-hen-note').value.trim(),
      note: rawEl ? rawEl.value : (_currentCare?.note || '')
    });
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    chrome.runtime.sendMessage({ type: 'SAVE_CARE', payload: row }, (resp) => {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu vào Sasum'; }
      if (!resp?.ok) { setStatus('Lưu thất bại: ' + (resp?.error || 'lỗi không rõ')); return; }
      _currentCare = row;
      _lastServerCare = Object.assign({}, row);
      setStatus('✓ Đã lưu vào Sasum.');
    });
  }

  // Danh dau xong lich hen — GUI DAY DU row (khong chi {phone,schedHen,schedHenNote}), tranh
  // ghi de trong cac truong khac (dung loi cu tung gap ben Zalo AI voi doneReminder_).
  function doneAppointment_(phone) {
    const row = _buildRow(phone, { schedHen: '', schedHenNote: '' });
    chrome.runtime.sendMessage({ type: 'SAVE_CARE', payload: row }, (resp) => {
      if (!resp?.ok) { setStatus('Không xoá được lịch hẹn: ' + (resp?.error || '')); return; }
      _currentCare = row;
      _lastServerCare = Object.assign({}, row);
      const henDateEl = panelEl.querySelector('#pk-hen-date');
      const henNoteEl = panelEl.querySelector('#pk-hen-note');
      if (henDateEl) henDateEl.value = '';
      if (henNoteEl) henNoteEl.value = '';
      setStatus('✓ Đã đánh dấu xong lịch hẹn.');
    });
  }

  // ── Poll gan-tuc-thoi: phat hien thay doi tu Sasum/Zalo AI (hoac sua tay tren Sheet) ──
  // So sanh truc tiep tung truong (khong chi dua vao cot 'updated' — sua tay tren Sheet
  // khong cap nhat cot do) — cung cach da sua ben Zalo AI.
  function startCarePoll_() {
    if (_carePollTimer) return;
    _carePollTimer = setInterval(pollCareTick_, CARE_POLL_MS);
  }

  function pollCareTick_() {
    if (!_currentPhone) return;
    if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') return;
    const phone = _currentPhone;
    chrome.runtime.sendMessage({ type: 'LOOKUP_CUSTOMER', payload: { phone } }, (resp) => {
      if (!resp?.ok || _currentPhone !== phone) return;
      const newCare = resp.data.care || {};
      const CMP = ['status','zalo','cs','note','schedHen','schedHenNote','khStatus','birthday'];
      const base = _lastServerCare || {};
      const changedFields = CMP.filter((k) => (base[k] || '') !== (newCare[k] || ''));
      if (!changedFields.length) return;
      applyPolledCare_(phone, newCare);
    });
  }

  // Chi tu dong cap nhat field nao CS CHUA sua tren form (gia tri hien tai == baseline cu)
  function applyPolledCare_(phone, newCare) {
    const box = panelEl.querySelector('#pk-ai-customer');
    if (!box.querySelector('#pk-save-btn')) return; // form chua duoc render (vd khach moi)
    const baseline = _lastServerCare || {};
    const syncSel = (id, key) => {
      const el = panelEl.querySelector(id); if (!el) return;
      if ((el.value || '') === (baseline[key] || '')) el.value = newCare[key] || '';
    };
    syncSel('#pk-status-sel', 'status');
    syncSel('#pk-zalo-sel', 'zalo');
    syncSel('#pk-khstatus-sel', 'khStatus');
    syncSel('#pk-birthday', 'birthday');
    syncSel('#pk-hen-note', 'schedHenNote');
    const henEl = panelEl.querySelector('#pk-hen-date');
    if (henEl) {
      const baseHen = baseline.schedHen ? toInputDate_(baseline.schedHen) : '';
      if ((henEl.value || '') === baseHen) henEl.value = newCare.schedHen ? toInputDate_(newCare.schedHen) : '';
    }
    const rawEl = panelEl.querySelector('#pk-note-raw');
    if (rawEl && (rawEl.value || '') === (baseline.note || '')) {
      rawEl.value = newCare.note || '';
      renderNoteHistory_(rawEl.value);
    }
    _currentCare = newCare;
    _lastServerCare = Object.assign({}, newCare);
    setStatus('🔄 Vừa đồng bộ dữ liệu mới từ Sasum.');
  }

  // ── NHẮC HẸN HÔM NAY (tất cả khách, không chỉ khách đang xem) ──
  // Dùng chung action:'reminders' với portal (index.html) — chỉ đọc, không ghi gì nên
  // không xung đột với dữ liệu Sasum/Zalo AI đang dùng.
  function startRemPoll_() {
    if (_remPollTimer) return;
    _remPollTimer = setInterval(loadReminders_, REM_POLL_MS);
  }

  function loadReminders_() {
    const cs = (panelEl?.querySelector('#pk-cs-sel')?.value) || settings?.csName || '';
    chrome.runtime.sendMessage({ type: 'GET_REMINDERS', payload: { cs } }, (resp) => {
      if (!resp?.ok) { return; } // lỗi mạng/GAS -> im lặng, không làm phiền, CS bấm 🔄 để thử lại
      _reminders = resp.data.reminders || [];
      renderReminders_();
    });
  }

  function renderReminders_() {
    const countEl = panelEl?.querySelector('#pk-rem-count');
    const listEl = panelEl?.querySelector('#pk-rem-list');
    if (!countEl || !listEl) return;
    countEl.textContent = String(_reminders.length);
    if (!_reminders.length) {
      listEl.innerHTML = '<div class="pk-rem-empty">Không có nhắc hẹn hôm nay 🎉</div>';
      return;
    }
    listEl.innerHTML = _reminders.map((r, i) => `
      <div class="pk-rem-item">
        <div class="pk-rem-phone">${escapeHtml(r.phone)}${r.schedHenNote ? ' · ' + escapeHtml(r.schedHenNote) : ''}</div>
        <div class="pk-rem-actions">
          <button class="pk-btn-outline pk-rem-lookup" data-idx="${i}">🔎 Xem</button>
          <button class="pk-btn-outline pk-rem-ai" data-idx="${i}">🤖 Soạn tin</button>
        </div>
      </div>
    `).join('');
    listEl.querySelectorAll('.pk-rem-lookup').forEach((b) => {
      b.addEventListener('click', () => {
        const r = _reminders[parseInt(b.dataset.idx, 10)];
        if (!r) return;
        panelEl.querySelector('#pk-ai-phone-input').value = r.phone;
        lookupByPhone(r.phone);
      });
    });
    listEl.querySelectorAll('.pk-rem-ai').forEach((b) => {
      b.addEventListener('click', () => soanFollowUp_(parseInt(b.dataset.idx, 10)));
    });
  }

  // Soạn tin follow-up chủ động cho 1 khách trong danh sách nhắc hẹn — hiện vào cùng khung
  // gợi ý AI (#pk-ai-suggestions) để bấm chèn/copy y hệt gợi ý trả lời thường.
  function soanFollowUp_(idx) {
    const r = _reminders[idx];
    if (!r) return;
    panelEl.querySelector('#pk-ai-phone-input').value = r.phone;
    setStatus('⏳ Đang soạn tin follow-up cho ' + r.phone + '...');
    chrome.runtime.sendMessage(
      { type: 'FETCH_FOLLOWUP_SUGGESTION', payload: { phone: r.phone, status: r.status, note: r.schedHenNote } },
      (resp) => {
        if (!resp?.ok) { setStatus('Lỗi: ' + (resp?.error || 'không rõ')); return; }
        renderSuggestions({ suggestions: [resp.data.suggestion], provider: resp.data.provider });
        setStatus('Nhớ tự mở đúng đoạn chat của ' + r.phone + ' trên Pancake trước khi bấm gợi ý để chèn.');
      }
    );
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function extractMessages() {
    const sel = settings.selectors?.[PLATFORM];
    if (!sel?.messageList || !sel?.messageItem) return [];

    const container = document.querySelector(sel.messageList);
    if (!container) return [];

    const items = container.querySelectorAll(sel.messageItem);
    const messages = [];
    items.forEach((el) => {
      const text = el.innerText?.trim();
      if (!text) return;
      messages.push({ from: detectSender_(el, sel), text });
    });
    // chỉ lấy tối đa 20 tin gần nhất để tránh payload quá lớn
    return messages.slice(-20);
  }

  // Phân biệt tin khách/nhân viên — CHỈ hoạt động khi đã cấu hình 1 trong 2 selector
  // (customerMsgSelector/agentMsgSelector) trong Options; nếu để trống, giữ nguyên hành vi
  // cũ (gửi "unknown", để AI tự suy luận theo ngữ cảnh) — không phá vỡ cấu hình đã lưu trước đó.
  function detectSender_(el, sel) {
    try {
      if (sel.customerMsgSelector && el.matches(sel.customerMsgSelector)) return "customer";
    } catch (e) { /* selector không hợp lệ — bỏ qua, coi như chưa cấu hình */ }
    try {
      if (sel.agentMsgSelector && el.matches(sel.agentMsgSelector)) return "agent";
    } catch (e) { /* selector không hợp lệ — bỏ qua */ }
    return "unknown";
  }

  async function requestSuggestion(manual) {
    const messages = extractMessages();
    if (!messages.length) {
      setStatus("Không tìm thấy tin nhắn nào. Kiểm tra lại selector trong Options.");
      return;
    }

    setStatus(manual ? "Đang lấy gợi ý..." : "Hội thoại thay đổi — đang lấy gợi ý mới...");

    chrome.runtime.sendMessage(
      {
        type: "FETCH_SUGGESTION",
        payload: {
          platform: PLATFORM,
          messages
        }
      },
      (resp) => {
        if (!resp?.ok) {
          setStatus("Lỗi: " + (resp?.error || "không rõ nguyên nhân"));
          return;
        }
        renderSuggestions(resp.data);
      }
    );
  }

  function renderSuggestions(data) {
    const list = data.suggestions?.length ? data.suggestions : data.suggestion ? [data.suggestion] : [];
    const box = panelEl.querySelector("#pk-ai-suggestions");
    box.innerHTML = "";

    if (!list.length) {
      setStatus("Backend không trả về gợi ý nào.");
      return;
    }

    setStatus(`${list.length} gợi ý${data.provider ? " (nguồn: " + data.provider + ")" : ""}:`);
    list.forEach((text) => {
      const item = document.createElement("div");
      item.className = "pk-ai-suggestion-item";
      item.innerText = text;
      item.title = "Bấm để chèn vào ô trả lời";
      item.addEventListener("click", () => insertReply(text));
      box.appendChild(item);
    });

    renderImageSuggestion(data.image);
  }

  // Nút "Copy ảnh sản phẩm" — chỉ hiện khi backend tìm thấy 1 ảnh khớp tên trong thư mục
  // kiến thức Drive. Pancake không có API gửi ảnh công khai (Facebook chặn ở tầng
  // Messenger) nên chỉ copy vào clipboard trình duyệt — CS tự bấm Ctrl+V dán vào khung
  // chat Pancake rồi kiểm tra lại trước khi bấm Gửi. Cố tình KHÔNG tự động dán/gửi.
  function renderImageSuggestion(image) {
    if (!image) return;
    const box = panelEl.querySelector("#pk-ai-suggestions");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pk-btn-outline";
    btn.innerText = `📷 Copy ảnh: ${image.name}`;
    btn.title = "Copy ảnh vào clipboard — sau đó bấm Ctrl+V vào khung chat Pancake";
    btn.addEventListener("click", () => copyProductImage_(image, btn));
    box.appendChild(btn);
  }

  async function copyProductImage_(image, btn) {
    if (btn) btn.disabled = true;
    setStatus(`Đang chuẩn bị ảnh "${image.name}"...`);
    try {
      const rawBlob = await (await fetch(`data:${image.mimeType};base64,${image.base64}`)).blob();
      const pngBlob = await toPngBlob_(rawBlob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      setStatus(`Đã copy ảnh "${image.name}" — bấm Ctrl+V vào khung chat Pancake để dán, kiểm tra rồi mới bấm Gửi.`);
    } catch (e) {
      setStatus(`Copy ảnh thất bại (${e?.message || e}) — thử bấm lại nút Copy ảnh.`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ClipboardItem chỉ hỗ trợ ổn định image/png ở hầu hết trình duyệt — chuyển mọi ảnh
  // (kể cả jpg) qua canvas rồi xuất PNG để dán được chắc chắn vào khung chat Pancake.
  function toPngBlob_(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          pngBlob ? resolve(pngBlob) : reject(new Error("Không tạo được PNG từ ảnh."));
        }, "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Không đọc được dữ liệu ảnh.")); };
      img.src = url;
    });
  }

  function insertReply(text) {
    const sel = settings.selectors?.[PLATFORM];
    if (!sel?.replyBox) {
      // Không có selector -> copy vào clipboard để người dùng tự dán
      navigator.clipboard.writeText(text).then(() => {
        setStatus("Đã copy gợi ý vào clipboard (chưa cấu hình ô trả lời tự động).");
      });
      return;
    }

    const box = document.querySelector(sel.replyBox);
    if (!box) {
      navigator.clipboard.writeText(text).then(() => {
        setStatus("Không tìm thấy ô trả lời trên trang — đã copy vào clipboard thay thế.");
      });
      return;
    }

    // Hỗ trợ cả <textarea>/<input> và contenteditable div (Messenger/Pancake dùng contenteditable)
    if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      nativeSetter?.call(box, text);
      box.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (box.isContentEditable) {
      box.focus();
      document.execCommand("insertText", false, text);
    }

    setStatus("Đã chèn gợi ý vào ô trả lời.");
  }

  function setStatus(text) {
    const el = panelEl?.querySelector("#pk-ai-status");
    if (el) el.innerText = text;
  }
})();

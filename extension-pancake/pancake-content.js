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
  // 3 huong mo dau khac nhau khi CHU DONG nhan truoc cho khach — CUNG NOI DUNG voi
  // OPENER_ANGLES ben Zalo AI, de 2 kenh tu van nhat quan.
  const OPENER_ANGLES = [
    { key: 'follow', label: '🩺 Hỏi thăm trải nghiệm', instr: 'Hỏi thăm cảm nhận/trải nghiệm khách sau khi dùng sản phẩm đã mua gần nhất, thể hiện sự quan tâm chân thành.' },
    { key: 'upsell', label: '🛍 Gợi ý sản phẩm liên quan', instr: 'Gợi ý nhẹ nhàng 1 sản phẩm liên quan hoặc dùng kèm với sản phẩm khách đã mua, mở đầu bằng câu hỏi/quan tâm chứ không chào bán trực tiếp.' },
    { key: 'connect', label: '✨ Khơi gợi trò chuyện', instr: 'Mở đầu bằng 1 câu hỏi mở hoặc chia sẻ nhỏ (ưu đãi mới, mẹo dùng sản phẩm, hỏi thăm dịp gần đây) để khơi gợi khách phản hồi, tạo cảm giác gần gũi cá nhân.' }
  ];
  let _activeTone = 'Thân thiện';
  let _useProducts = false;
  let CS_NAMES = [];
  let NICK_LIST = [];
  let CARE_STATUS_TREE = null; // cay "Tinh trang CS" load dong tu GAS (dong bo voi appweb/Zalo AI)
  let _currentNick = ''; // Nick Zalo/kenh CS dang dung, sticky (chrome.storage.sync)
  let _chatKeyPhoneMap = {}; // { chatKey: phone } — "danh ba nguoc" hoc cuc bo tren may nay
                             // (giong _chatNamePhoneMap ben Zalo AI), dung cho nut Lien ket doan chat
  let _currentPhone = '';
  let _currentCare = null;   // du lieu care dang hien thi/sua tren form
  let _currentOrders = [];   // lich su don hang cua khach dang xem (dung de build ho so cho prompt AI)
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
    loadNickList_();
    loadCareStatusTree_();
    loadChatKeyMap_();
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
      try {
        chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (resp) => {
          if (chrome.runtime.lastError) { resolve({}); return; }
          resolve(resp?.settings || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  // ── Bảo vệ khi extension bị reload/cập nhật trong lúc tab Pancake đang mở ──
  // Khi đó chrome.runtime của content script cũ mất kết nối tới service worker mới:
  // MỌI lệnh chrome.runtime.sendMessage sau đó đều ném lỗi "Extension context invalidated"
  // (hoặc chrome.runtime tự thành undefined) — khiến tra cứu KH, lưu tên/SĐT/ghi chú/trạng
  // thái Zalo, nhắc hẹn... đều im lặng không chạy, chỉ thấy lỗi đỏ trong Console (F12) chứ
  // KHÔNG phải lỗi logic code. safeSendMessage_ bắt lỗi này, dừng các vòng lặp polling đang
  // gây spam lỗi liên tục, và hiện banner rõ ràng yêu cầu tải lại trang (F5) thay vì im lặng.
  let _extInvalidated = false;
  function isExtContextValid_() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
  }
  function safeSendMessage_(message, callback) {
    if (_extInvalidated || !isExtContextValid_()) { handleExtInvalidated_(); return; }
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        if (chrome.runtime.lastError) { handleExtInvalidated_(); return; }
        callback && callback(resp);
      });
    } catch (e) {
      handleExtInvalidated_();
    }
  }
  function handleExtInvalidated_() {
    if (_extInvalidated) return;
    _extInvalidated = true;
    if (_carePollTimer) { clearInterval(_carePollTimer); _carePollTimer = null; }
    if (_remPollTimer) { clearInterval(_remPollTimer); _remPollTimer = null; }
    showExtInvalidBanner_();
  }
  function showExtInvalidBanner_() {
    if (!panelEl || panelEl.querySelector('#pk-ext-invalid-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pk-ext-invalid-banner';
    banner.style.cssText = 'background:#fff3cd;color:#856404;border:1px solid #ffe08a;border-radius:6px;padding:10px 12px;margin:0 0 8px;font-size:13px;font-weight:600;text-align:center;';
    banner.innerHTML = '⚠️ Extension vừa được cập nhật — vui lòng <a href="#" id="pk-reload-link" style="color:#0d6efd;text-decoration:underline;">tải lại trang</a> (F5) để tiếp tục dùng.';
    panelEl.prepend(banner);
    const link = banner.querySelector('#pk-reload-link');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); location.reload(); });
    setStatus('⚠️ Mất kết nối tới extension — vui lòng tải lại trang (F5).');
  }

  // ── Nhớ vị trí/kích thước/trạng thái thu gọn của panel giữa các lần tải trang
  // (chrome.storage.local — riêng theo máy, không cần đồng bộ nhiều máy) ──
  function _restorePanelState_() {
    try {
      chrome.storage.local.get(['pkPanelCollapsed', 'pkPanelPos', 'pkPanelSize'], (res) => {
        if (res.pkPanelCollapsed) panelEl.classList.add('pk-ai-collapsed');
        if (res.pkPanelPos && typeof res.pkPanelPos.right === 'number' && typeof res.pkPanelPos.bottom === 'number') {
          panelEl.style.right = res.pkPanelPos.right + 'px';
          panelEl.style.bottom = res.pkPanelPos.bottom + 'px';
        }
        if (res.pkPanelSize && res.pkPanelSize.width && res.pkPanelSize.height) {
          panelEl.style.width = res.pkPanelSize.width + 'px';
          panelEl.style.height = res.pkPanelSize.height + 'px';
        }
      });
    } catch (e) {}
  }

  // ── Kéo-thả di chuyển panel bằng thanh header (giữ nguyên click nút thu gọn) ──
  function _initPanelDrag_() {
    const header = panelEl.querySelector('#pk-ai-header');
    if (!header) return;
    let dragging = false, startX = 0, startY = 0, startRight = 0, startBottom = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return; // không kéo khi bấm nút thu gọn
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      const rectStyle = getComputedStyle(panelEl);
      startRight = parseFloat(rectStyle.right) || 0;
      startBottom = parseFloat(rectStyle.bottom) || 0;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      let newRight = startRight - dx, newBottom = startBottom - dy;
      // Giữ panel trong màn hình
      newRight = Math.max(4, Math.min(newRight, window.innerWidth - 80));
      newBottom = Math.max(4, Math.min(newBottom, window.innerHeight - 40));
      panelEl.style.right = newRight + 'px';
      panelEl.style.bottom = newBottom + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      try {
        chrome.storage.local.set({
          pkPanelPos: { right: parseFloat(panelEl.style.right) || 16, bottom: parseFloat(panelEl.style.bottom) || 16 }
        });
      } catch (e) {}
    });

    // Nhớ kích thước khi CS kéo góc để resize (resize:both trong CSS)
    try {
      new ResizeObserver(() => {
        if (panelEl.classList.contains('pk-ai-collapsed')) return;
        chrome.storage.local.set({
          pkPanelSize: { width: panelEl.offsetWidth, height: panelEl.offsetHeight }
        });
      }).observe(panelEl);
    } catch (e) {}
  }

  function injectPanel() {
    if (panelEl) return;
    panelEl = document.createElement("div");
    panelEl.id = "pk-ai-panel";
    panelEl.innerHTML = `
      <div id="pk-ai-header">
        <div style="flex:1">
          <div style="font-weight:700">🤖 Pancake AI</div>
          <div style="font-size:10px;font-weight:400;opacity:.85">Tra cứu & gợi ý phản hồi khách</div>
        </div>
        <button id="pk-ai-collapse" title="Thu gọn">—</button>
      </div>
      <div id="pk-ai-body">
        <div id="pk-ai-cs-row">
          <label>CS đang dùng</label>
          <select id="pk-cs-sel"></select>
        </div>
        <div id="pk-ai-nick-row">
          <label>💬 Nick</label>
          <select id="pk-nick-sel"></select>
          <button id="pk-nick-add" title="Thêm nick mới">＋</button>
        </div>
        <div id="pk-ai-phone-row">
          <input type="text" id="pk-ai-phone-input" placeholder="SĐT khách (nếu không tự nhận ra)" />
          <button id="pk-ai-phone-btn">Tra cứu</button>
          <button id="pk-link-chat-btn" title="Liên kết đoạn chat ĐANG MỞ với khách này — làm 1 lần để lần sau tự nhận diện dù không đọc được SĐT/khung Sản phẩm order">🔗</button>
        </div>
        <div id="pk-ai-customer"></div>

        <div id="pk-rem-section">
          <div id="pk-rem-header">
            <span>⏰ Nhắc hẹn hôm nay (<span id="pk-rem-count">0</span>)</span>
            <button id="pk-rem-refresh" title="Tải lại">🔄</button>
          </div>
          <div id="pk-rem-list"></div>
        </div>

        <div id="pk-price-section">
          <div id="pk-price-header">💰 Tra cứu bảng giá</div>
          <div id="pk-price-row">
            <input type="text" id="pk-price-q" placeholder="Tên sản phẩm, kiểu/size..." />
            <button id="pk-price-btn">Tìm</button>
          </div>
          <div id="pk-price-result"></div>
        </div>

        <div id="pk-ai-status">Chưa có hội thoại nào được chọn.</div>

        <div class="pk-tones" id="pk-tones">
          ${['Thân thiện','Chuyên nghiệp','Ngắn gọn','Nhiệt tình'].map((t,i) =>
            `<button class="pk-tone${i===0?' active':''}" data-tone="${t}">${t}</button>`).join('')}
        </div>
        <input type="text" id="pk-ctx-input" class="pk-ctx-input" placeholder="Ngữ cảnh / Sản phẩm (tuỳ chọn) — VD: khách hỏi về giá, muốn mua thêm..." />
        <label class="pk-prod-row">
          <input type="checkbox" id="pk-use-products-chk" />
          <span>🔍 <b>Tra cứu sản phẩm</b> (nạp dữ liệu Google Sheet để tư vấn kỹ thành phần/công dụng)</span>
        </label>
        <button id="pk-opener-btn" class="pk-opener-btn">💬 Tạo 3 câu mở đầu đa dạng (mua hàng + chat)</button>

        <div id="pk-ai-suggestions"></div>
        <button id="pk-ai-refresh">Lấy gợi ý mới</button>
      </div>
    `;
    document.body.appendChild(panelEl);
    _restorePanelState_();
    _initPanelDrag_();

    const csSel = panelEl.querySelector('#pk-cs-sel');
    csSel.addEventListener('change', () => {
      chrome.storage.sync.set({ csName: csSel.value });
      loadReminders_();
    });

    const nickSel = panelEl.querySelector('#pk-nick-sel');
    nickSel.addEventListener('change', () => {
      _currentNick = nickSel.value;
      chrome.storage.sync.set({ currentNick: _currentNick });
    });
    panelEl.querySelector('#pk-nick-add').addEventListener('click', () => {
      const nick = (prompt('Nhập nick Zalo/kênh mới:') || '').trim();
      if (!nick) return;
      safeSendMessage_({ type: 'ADD_NICK', payload: { nick } }, (resp) => {
        NICK_LIST = (resp?.ok && resp.data?.list) ? resp.data.list : NICK_LIST;
        if (!NICK_LIST.includes(nick)) NICK_LIST.push(nick);
        _currentNick = nick;
        chrome.storage.sync.set({ currentNick: nick });
        renderNickSelect_();
      });
    });

    panelEl.querySelector("#pk-ai-refresh").addEventListener("click", () => {
      requestSuggestion(true);
    });
    panelEl.querySelector("#pk-ai-collapse").addEventListener("click", () => {
      panelEl.classList.toggle("pk-ai-collapsed");
      try { chrome.storage.local.set({ pkPanelCollapsed: panelEl.classList.contains("pk-ai-collapsed") }); } catch (e) {}
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
    panelEl.querySelector("#pk-link-chat-btn").addEventListener("click", () => {
      if (!_currentPhone) { setStatus("Chưa tra cứu khách nào để liên kết."); return; }
      learnChatKeyForPhone_(_currentPhone);
      setStatus(`🔗 Đã liên kết đoạn chat này với ${_currentPhone} — lần sau tự nhận diện.`);
    });
    panelEl.querySelector("#pk-rem-refresh").addEventListener("click", () => loadReminders_());
    panelEl.querySelector("#pk-price-btn").addEventListener("click", doPriceSearch_);
    panelEl.querySelector("#pk-price-q").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doPriceSearch_();
    });
    panelEl.querySelector("#pk-tones").addEventListener("click", (e) => {
      const btn = e.target.closest(".pk-tone");
      if (!btn) return;
      panelEl.querySelectorAll(".pk-tone").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      _activeTone = btn.dataset.tone;
    });
    const prodChk = panelEl.querySelector("#pk-use-products-chk");
    prodChk.checked = !!settings.useProducts;
    prodChk.addEventListener("change", () => { _useProducts = prodChk.checked; });
    _useProducts = prodChk.checked;
    panelEl.querySelector("#pk-opener-btn").addEventListener("click", doGenerateOpeners_);
  }

  // ── CS đang dùng (sticky theo máy, lưu chrome.storage.sync) ──
  async function loadCsNames_() {
    safeSendMessage_({ type: "GET_CS_NAMES" }, (resp) => {
      CS_NAMES = (resp?.ok && resp.data && resp.data.length) ? resp.data : [];
      const csSel = panelEl?.querySelector('#pk-cs-sel');
      if (!csSel) return;
      const names = CS_NAMES.length ? CS_NAMES : [settings.csName].filter(Boolean);
      csSel.innerHTML = '<option value="">— Chọn CS —</option>' +
        names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
      csSel.value = settings.csName || '';
    });
  }

  // Nick Zalo/kênh — dùng chung danh sách (setting 'nickZaloList') với Zalo AI, sticky riêng
  // theo máy/extension này (chrome.storage.sync của Pancake AI, độc lập với Zalo AI).
  function loadNickList_() {
    chrome.storage.sync.get(['currentNick'], (res) => {
      _currentNick = res.currentNick || '';
      safeSendMessage_({ type: "GET_NICK_LIST" }, (resp) => {
        NICK_LIST = (resp?.ok && resp.data) ? resp.data : [];
        renderNickSelect_();
      });
    });
  }

  function renderNickSelect_() {
    const sel = panelEl?.querySelector('#pk-nick-sel');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Chọn nick —</option>' +
      NICK_LIST.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    sel.value = _currentNick || '';
  }

  // ── "Tình trạng CS": nạp cây phân nhóm động từ GAS (đồng bộ với appweb/Zalo AI) ──
  // Trước đây chỉ dùng danh sách CARE_STATUSES tĩnh; giờ ưu tiên cây động (có optgroup)
  // giống hệt Zalo AI, CARE_STATUSES chỉ còn là fallback khi chưa tải được cây.
  function careStatusOptionsHtml_(selected) {
    if (Array.isArray(CARE_STATUS_TREE) && CARE_STATUS_TREE.length) {
      let html = '<option value="">— Chọn —</option>';
      CARE_STATUS_TREE.forEach((node) => {
        if (node.children && node.children.length) {
          html += '<optgroup label="' + escapeHtml(node.label) + '">';
          node.children.forEach((child) => {
            if (!child.value) return;
            html += `<option value="${escapeHtml(child.value)}"${selected === child.value ? ' selected' : ''}>${escapeHtml(node.label + ' - ' + (child.label || child.value))}</option>`;
          });
          html += '</optgroup>';
        } else if (node.value) {
          html += `<option value="${escapeHtml(node.value)}"${selected === node.value ? ' selected' : ''}>${escapeHtml(node.label || node.value)}</option>`;
        }
      });
      return html;
    }
    return [''].concat(CARE_STATUSES).map((o) =>
      `<option value="${escapeHtml(o)}"${o === (selected || '') ? ' selected' : ''}>${o ? escapeHtml(o) : '— Chọn —'}</option>`
    ).join('');
  }

  function rebuildStatusSel_() {
    const sel = panelEl?.querySelector('#pk-status-sel');
    if (!sel || !Array.isArray(CARE_STATUS_TREE) || !CARE_STATUS_TREE.length) return;
    const cur = sel.value;
    sel.innerHTML = careStatusOptionsHtml_(cur);
    sel.value = cur;
  }

  function loadCareStatusTree_() {
    safeSendMessage_({ type: 'GET_CARE_STATUS_TREE' }, (resp) => {
      if (resp?.ok && Array.isArray(resp.data) && resp.data.length) {
        CARE_STATUS_TREE = resp.data;
        rebuildStatusSel_();
      }
    });
  }

  // "Danh bạ ngược" (khoá hội thoại → SĐT) học cục bộ trên máy này — dùng khi CS bấm 🔗
  // Liên kết đoạn chat, để lần sau tự nhận diện dù không đọc được SĐT/khung "Sản phẩm order".
  function loadChatKeyMap_() {
    chrome.storage.local.get(['pk_chat_key_map'], (res) => { _chatKeyPhoneMap = res.pk_chat_key_map || {}; });
  }
  function saveChatKeyMap_() { chrome.storage.local.set({ pk_chat_key_map: _chatKeyPhoneMap }); }

  // Khoá nhận diện hội thoại hiện tại: ưu tiên đường dẫn URL (đa số web app SPA có URL riêng
  // cho từng hội thoại — ổn định hơn text hiển thị vốn có thể đổi theo tên/biệt danh khách).
  function getCurrentChatKey_() {
    return 'url:' + location.pathname + location.search;
  }
  function learnChatKeyForPhone_(phone) {
    if (!phone) return;
    _chatKeyPhoneMap[getCurrentChatKey_()] = phone;
    saveChatKeyMap_();
  }
  function resolvePhoneForChatKey_() {
    return _chatKeyPhoneMap[getCurrentChatKey_()] || null;
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

  // Pancake/Messenger tự nhận diện SĐT trong tin nhắn rồi bọc bằng <span class="phone-tag ...">
  // (đôi khi span cha còn có id dạng "m_<hash>_<sđt>"). Đọc từ đây đáng tin hơn quét chữ tự do
  // vì nền tảng đã xác nhận đó thực sự là SĐT (khỏi nhầm mã đơn/mã vận đơn).
  function extractTaggedPhones_(scope) {
    const found = new Set();
    scope.querySelectorAll('.phone-tag').forEach((el) => {
      const p = normPhone(el.textContent);
      if (/^0[3-9]\d{8}$/.test(p)) found.add(p);
    });
    scope.querySelectorAll('[id]').forEach((el) => {
      const m = el.id.match(/_(\d{9,11})$/);
      if (!m) return;
      const p = normPhone(m[1]);
      if (/^0[3-9]\d{8}$/.test(p)) found.add(p);
    });
    return Array.from(found);
  }

  // Trả về DANH SÁCH sđt tìm được trong đoạn chat hiện tại (có thể là 1, 2, hoặc nhiều).
  function extractPhones() {
    const sel = settings.selectors?.[PLATFORM];
    // 1) Ưu tiên selector riêng cho ô hiển thị SĐT khách (nếu đã cấu hình)
    if (sel?.phoneSelector) {
      const el = document.querySelector(sel.phoneSelector);
      const m = el?.innerText?.match(/(0[3-9]\d{8})/);
      if (m) return [normPhone(m[1])];
    }
    // 2) SĐT do chính CS gõ tay vào khung "Sản phẩm order" (đáng tin — CS chủ động xác nhận cho
    // đúng đơn đang xử lý, không lẫn số điện thoại của người khác nhắc tới trong đoạn chat)
    const panelPhone = extractOrderPanelPhone_();
    if (panelPhone) return [panelPhone];
    const container = sel?.messageList ? document.querySelector(sel.messageList) : null;
    const scope = container || document.body;
    // 3) SĐT đã được nền tảng tự gắn thẻ (span.phone-tag / id="..._<sđt>") — có thể ra nhiều số
    const tagged = extractTaggedPhones_(scope);
    if (tagged.length) return tagged;
    // 4) Fallback cuối: quét chữ tự do tìm 1 SĐT VN dạng 0xxxxxxxxx (chỉ dùng khi không có thẻ)
    const m2 = scope.innerText?.match(/(0[3-9]\d{8})/);
    return m2 ? [normPhone(m2[1])] : [];
  }

  // Giữ lại tên cũ để tương thích ngược — trả về SĐT đầu tiên tìm được.
  function extractPhone() {
    return extractPhones()[0] || "";
  }

  // ── Lấy tên khách từ khung "Sản phẩm order" (ghi chú đơn hàng CS tự nhập) ──
  // Dòng đầu của khối trên cùng thường dạng "Chị : Tên", "Anh Tên", hoặc "Tên +sđt".
  function _findOrderPanelContainer_() {
    const sel = settings.selectors?.[PLATFORM];
    if (sel?.orderPanelSelector) {
      const c = document.querySelector(sel.orderPanelSelector);
      if (c) return c;
    }
    // Dò tự động: tìm node lá (không còn con) có chữ "Sản phẩm order" làm tiêu đề,
    // rồi lấy phần tử cha làm vùng chứa danh sách các khối khách.
    const nodes = document.querySelectorAll('body *');
    for (const el of nodes) {
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      if (t.length > 0 && t.length < 40 && /sản phẩm order/i.test(t)) {
        return el.closest('div')?.parentElement || el.parentElement;
      }
    }
    return null;
  }
  function _firstOrderPanelLine_() {
    const container = _findOrderPanelContainer_();
    if (!container) return '';
    const text = container.innerText || '';
    if (!text.trim()) return '';
    const cleaned = text.replace(/^.*sản phẩm order.*$/im, '').trim();
    const blocks = cleaned.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return '';
    return blocks[0].split('\n')[0].trim();
  }
  function extractOrderPanelName_() {
    return _parseNameFromLine_(_firstOrderPanelLine_());
  }
  // SĐT do CHÍNH CS gõ tay vào khung "Sản phẩm order" (vd "Chị Lan - 0912345678") — đáng tin cậy
  // hơn quét chữ tự do trong toàn bộ đoạn chat, vì đây là dữ liệu CS chủ động xác nhận cho đơn
  // đang xử lý. Trước đây dòng SĐT này chỉ bị XOÁ ĐI để tách tên, chưa từng được tận dụng.
  function extractOrderPanelPhone_() {
    const line = _firstOrderPanelLine_();
    if (!line) return '';
    const m = line.match(/(0[3-9]\d{8})/);
    return m ? normPhone(m[1]) : '';
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
    const phones = extractPhones();
    if (phones.length > 1) {
      _currentPhone = ''; _currentCare = null; _lastServerCare = {}; _currentOrderPanelName = ''; _currentOrders = [];
      renderPhonePicker_(phones);
      return;
    }
    const phone = phones[0] || resolvePhoneForChatKey_();
    if (!phone) {
      _currentPhone = ''; _currentCare = null; _lastServerCare = {}; _currentOrderPanelName = ''; _currentOrders = [];
      // TRƯỚC ĐÂY: để trống trơn im lặng khi không tự nhận ra SĐT — trông như panel bị lỗi/không
      // dùng được, dù thật ra form vẫn hoạt động đầy đủ (tên/trạng thái/ghi chú...), chỉ là nó
      // CHỈ hiện SAU KHI tra cứu được 1 khách. Giờ luôn hiện rõ hướng dẫn thay vì im lặng.
      panelEl.querySelector("#pk-ai-customer").innerHTML =
        `<div class="pk-ai-no-phone-hint">
          📵 Không tự nhận ra SĐT trong đoạn chat này.<br>
          Nhập SĐT khách vào ô phía trên rồi bấm <b>"Tra cứu"</b> để hiện đầy đủ
          form nhập tên/trạng thái/ghi chú (giống bên Zalo AI).
        </div>`;
      return;
    }
    lookupByPhone(phone);
  }

  // Doan chat co >=2 SDT (vd: khach nhan hang ho nguoi khac) -> de CS tu chon so can tra cuu
  function renderPhonePicker_(phones) {
    const box = panelEl.querySelector("#pk-ai-customer");
    box.innerHTML = `<div class="pk-ai-phone-picker">
      <div class="pk-ai-phone-picker-label">📱 Phát hiện ${phones.length} SĐT trong đoạn chat — chọn số để tra cứu:</div>
      <div class="pk-ai-phone-picker-btns">
        ${phones.map((p) => `<button type="button" class="pk-ai-phone-pick-btn" data-phone="${p}">${p}</button>`).join('')}
      </div>
    </div>`;
    box.querySelectorAll('.pk-ai-phone-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => lookupByPhone(btn.dataset.phone));
    });
  }

  function lookupByPhone(phone) {
    const box = panelEl.querySelector("#pk-ai-customer");
    box.innerHTML = `<div class="pk-ai-cust-loading">Đang tra cứu ${phone}...</div>`;
    safeSendMessage_({ type: "LOOKUP_CUSTOMER", payload: { phone } }, (resp) => {
      if (!resp?.ok) {
        box.innerHTML = `<div class="pk-ai-cust-loading">Không tra cứu được: ${resp?.error || "lỗi không rõ"}</div>`;
        return;
      }
      _currentPhone = phone;
      _currentCare = resp.data.care || null;
      _currentOrders = resp.data.orders || [];
      _lastServerCare = _currentCare ? Object.assign({}, _currentCare) : {};
      renderCustomerCard(phone, resp.data);
    });
  }

  // Ho so khach dua vao prompt AI — CUNG cau truc voi buildCustLines() ben Zalo AI, de 2 ben
  // tu van nhat quan dua tren cung 1 kieu thong tin (ten/sdt/don da mua/tinh trang CS/ghi chu).
  function buildCustLines() {
    if (!_currentPhone) return [];
    const care = _currentCare || {};
    const orders = _currentOrders || [];
    const nameEl = panelEl?.querySelector('#pk-name-input');
    const name = (nameEl && nameEl.value.trim()) || _currentOrderPanelName || (orders[0] && orders[0].name) || care.name || _currentPhone;
    const lines = [`Tên: ${name} | SĐT: ${_currentPhone}`];
    if (orders.length) {
      lines.push(`Số đơn đã mua: ${orders.length}`);
      const prods = [...new Set(orders.map((o) => o.product).filter(Boolean))].slice(0, 5).join(', ');
      if (prods) lines.push(`Sản phẩm đã mua: ${prods}`);
      const last = orders[0];
      if (last) {
        const d = fmtDate_(last.date);
        lines.push(`Đơn gần nhất: ${[d, last.product, last.revenue ? Number(last.revenue).toLocaleString('vi-VN') + 'đ' : ''].filter(Boolean).join(' - ')}`);
      }
    }
    if (care.status) lines.push(`Tình trạng CS: ${care.status}`);
    if (care.note) {
      const arr = _parseNotes(care.note);
      if (arr[0]?.text) lines.push(`Ghi chú: ${arr[0].text}`);
    }
    return lines;
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

        <label class="pk-label-top">Tên khách</label>
        <input type="text" id="pk-name-input" class="pk-full-input" placeholder="Tên khách hàng" value="${escapeHtml(name === phone ? '' : name)}" />

        <div class="pk-form-row">
          <div class="pk-form-col">
            <label>Trạng thái CS</label>
            <select id="pk-status-sel">${careStatusOptionsHtml_(care?.status || '')}</select>
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
    const nameEl = panelEl?.querySelector('#pk-name-input');
    const liveName = nameEl ? nameEl.value.trim() : '';
    // Ghi nhan nick Zalo/kenh dang dung vao danh sach nick da tung tiep xuc voi khach nay —
    // giong het cach Zalo AI lam khi luu (them vao nickZalos, khong ghi de mat nick cu).
    const existingNicks = c.nickZalos || [];
    const nickZalos = (_currentNick && !existingNicks.includes(_currentNick))
      ? [...existingNicks, _currentNick] : existingNicks;
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
      nickZalos,
      name: liveName || _currentOrderPanelName || c.name || ''
    }, overrides || {});
  }

  function saveCare_(phone) {
    const btn = panelEl.querySelector('#pk-save-btn');
    const rawEl = panelEl.querySelector('#pk-note-raw');
    const nameEl = panelEl.querySelector('#pk-name-input');
    const liveName = nameEl ? nameEl.value.trim() : '';
    // Khách MỚI (nguồn "Chăm sóc"): chưa từng có CareData lẫn đơn hàng nào — bắt buộc nhập tên
    // trước khi lưu, và sau khi lưu sẽ ghi thêm vào sheet riêng "KH Chăm sóc mới" (Báo cáo D).
    const isNewCustomer = !_currentCare && (!_currentOrders || !_currentOrders.length);
    if (isNewCustomer && !liveName) { setStatus('Khách mới — vui lòng nhập tên khách hàng trước khi lưu.'); return; }
    const row = _buildRow(phone, {
      name: liveName,
      status: panelEl.querySelector('#pk-status-sel').value,
      zalo: panelEl.querySelector('#pk-zalo-sel').value,
      khStatus: panelEl.querySelector('#pk-khstatus-sel').value,
      birthday: panelEl.querySelector('#pk-birthday').value,
      schedHen: panelEl.querySelector('#pk-hen-date').value,
      schedHenNote: panelEl.querySelector('#pk-hen-note').value.trim(),
      note: rawEl ? rawEl.value : (_currentCare?.note || '')
    });
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    safeSendMessage_({ type: 'SAVE_CARE', payload: Object.assign({}, row, { isNewCustomer }) }, (resp) => {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu vào Sasum'; }
      if (!resp?.ok) { setStatus('Lưu thất bại: ' + (resp?.error || 'lỗi không rõ')); return; }
      _currentCare = row;
      _lastServerCare = Object.assign({}, row);
      const nameSpan = panelEl.querySelector('.pk-ai-cust-name');
      if (nameSpan && row.name) nameSpan.innerHTML = `${escapeHtml(row.name)} <span class="pk-ai-cust-phone">${phone}</span>`;
      setStatus('✓ Đã lưu vào Sasum.' + (isNewCustomer ? ' (KH mới — nguồn Chăm sóc)' : ''));
    });
  }

  // Danh dau xong lich hen — GUI DAY DU row (khong chi {phone,schedHen,schedHenNote}), tranh
  // ghi de trong cac truong khac (dung loi cu tung gap ben Zalo AI voi doneReminder_).
  function doneAppointment_(phone) {
    const row = _buildRow(phone, { schedHen: '', schedHenNote: '' });
    safeSendMessage_({ type: 'SAVE_CARE', payload: row }, (resp) => {
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
    safeSendMessage_({ type: 'LOOKUP_CUSTOMER', payload: { phone } }, (resp) => {
      if (!resp?.ok || _currentPhone !== phone) return;
      const newCare = resp.data.care || {};
      const CMP = ['status','zalo','cs','note','schedHen','schedHenNote','khStatus','birthday','name'];
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
    syncSel('#pk-name-input', 'name');
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
    safeSendMessage_({ type: 'GET_REMINDERS', payload: { cs } }, (resp) => {
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
    safeSendMessage_(
      { type: 'FETCH_FOLLOWUP_SUGGESTION', payload: { phone: r.phone, status: r.status, note: r.schedHenNote } },
      (resp) => {
        if (!resp?.ok) { setStatus('Lỗi: ' + (resp?.error || 'không rõ')); return; }
        renderSuggestions({ suggestions: [resp.data.suggestion], provider: resp.data.provider });
        setStatus('Nhớ tự mở đúng đoạn chat của ' + r.phone + ' trên Pancake trước khi bấm gợi ý để chèn.');
      }
    );
  }

  // ── TRA CỨU BẢNG GIÁ (Sheet DANH_MUC) ──
  // Khong hardcode ten cot: hien thi dung cac cot ma sheet dang co, uu tien cot co
  // chua chu "gia"/"price" len dau tien cho de nhin, con lai xep sau.
  function doPriceSearch_() {
    const q = (panelEl.querySelector('#pk-price-q').value || '').trim();
    const box = panelEl.querySelector('#pk-price-result');
    box.innerHTML = '<div class="pk-price-loading">Đang tìm...</div>';
    safeSendMessage_({ type: 'GET_PRICE', payload: { q } }, (resp) => {
      if (!resp?.ok) { box.innerHTML = `<div class="pk-price-loading">Lỗi: ${escapeHtml(resp?.error || 'không rõ')}</div>`; return; }
      renderPriceRows_(resp.data.rows || [], q);
    });
  }

  function renderPriceRows_(rows, q) {
    const box = panelEl.querySelector('#pk-price-result');
    if (!rows.length) {
      box.innerHTML = `<div class="pk-price-loading">Không tìm thấy${q ? ' cho "' + escapeHtml(q) + '"' : ''}.</div>`;
      return;
    }
    box.innerHTML = rows.slice(0, 30).map((row) => {
      const keys = Object.keys(row).filter((k) => row[k] !== '' && row[k] !== null && row[k] !== undefined);
      const priceKeys = keys.filter((k) => /gia|price/i.test(k));
      const otherKeys = keys.filter((k) => !/gia|price/i.test(k));
      const line = (k) => `<span class="pk-price-field"><b>${escapeHtml(k)}:</b> ${escapeHtml(row[k])}</span>`;
      return `<div class="pk-price-item">${otherKeys.map(line).join(' ')}${priceKeys.length ? '<div class="pk-price-amount">' + priceKeys.map(line).join(' · ') + '</div>' : ''}</div>`;
    }).join('');
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

    const ctxEl = panelEl.querySelector("#pk-ctx-input");
    safeSendMessage_(
      {
        type: "FETCH_SUGGESTION",
        payload: {
          platform: PLATFORM,
          messages,
          tone: _activeTone,
          context: ctxEl ? ctxEl.value.trim() : "",
          custLines: buildCustLines(),
          withProducts: _useProducts
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

  // ── 3 câu mở đầu chủ động (dùng khi CS muốn nhắn trước cho khách) ──
  // giống hệt luồng doGenerateOpener() bên Zalo AI: gọi tuần tự 3 hướng (không Promise.all
  // vì Groq giới hạn token/phút, bắn cùng lúc dễ dính 429), mỗi hướng ra 1 ô sửa được +
  // nút "Chèn vào ô trả lời" (KHÔNG có nút tự gửi như bên Zalo — Pancake/Messenger không có
  // API gửi tin công khai, CS luôn tự kiểm tra và bấm Gửi tay, giữ đúng nguyên tắc an toàn
  // đã áp dụng cho phần gửi ảnh).
  async function doGenerateOpeners_() {
    const btn = panelEl.querySelector("#pk-opener-btn");
    const sug = panelEl.querySelector("#pk-ai-suggestions");
    btn.disabled = true; btn.textContent = "AI đang soạn...";
    sug.innerHTML = '<div class="pk-ai-cust-loading">Đang soạn 3 câu mở đầu...</div>';

    const custLines = buildCustLines();
    const results = [];
    for (let i = 0; i < OPENER_ANGLES.length; i++) {
      const angle = OPENER_ANGLES[i];
      sug.innerHTML = `<div class="pk-ai-cust-loading">Đang soạn câu ${i + 1}/${OPENER_ANGLES.length} — ${escapeHtml(angle.label)}...</div>`;
      const data = await new Promise((resolve) => {
        safeSendMessage_(
          { type: "FETCH_OPENER", payload: { custLines, tone: _activeTone, angleInstr: angle.instr, withProducts: _useProducts } },
          (resp) => resolve(resp?.ok ? resp.data : { error: resp?.error || "lỗi không rõ" })
        );
      });
      results.push({ angle, ...data });
    }

    sug.innerHTML = "";
    const label = document.createElement("div");
    label.className = "pk-opener-label";
    label.textContent = "💡 3 câu mở đầu — sửa nếu cần rồi chèn vào ô trả lời";
    sug.appendChild(label);
    results.forEach((r) => {
      const box = document.createElement("div");
      box.className = "pk-opener-box";
      if (r.error) {
        box.innerHTML = `<div class="pk-opener-label">${escapeHtml(r.angle.label)}</div><div style="color:#dc2626;font-size:12px">Lỗi: ${escapeHtml(r.error)}</div>`;
        sug.appendChild(box);
        return;
      }
      const ta = document.createElement("textarea");
      ta.rows = 3;
      ta.value = r.suggestion || "";
      const btnRow = document.createElement("div");
      btnRow.className = "pk-opener-btn-row";
      const insertBtn = document.createElement("button");
      insertBtn.className = "pk-btn-outline";
      insertBtn.textContent = "📥 Chèn vào ô trả lời";
      insertBtn.addEventListener("click", () => insertReply(ta.value));
      btnRow.appendChild(insertBtn);
      box.innerHTML = `<div class="pk-opener-label">${escapeHtml(r.angle.label)}</div>`;
      box.appendChild(ta);
      box.appendChild(btnRow);
      sug.appendChild(box);
    });

    btn.disabled = false; btn.textContent = "💬 Tạo 3 câu mở đầu đa dạng (mua hàng + chat)";
  }

  function renderSuggestions(data) {
    const list = data.suggestions?.length ? data.suggestions : data.suggestion ? [data.suggestion] : [];
    const box = panelEl.querySelector("#pk-ai-suggestions");
    box.innerHTML = "";

    if (!list.length) {
      setStatus("Backend không trả về gợi ý nào.");
      return;
    }

    let statusMsg = `${list.length} gợi ý${data.provider ? " (nguồn: " + data.provider + ")" : ""}:`;
    if (data.imageSkipped) statusMsg += ` (⚠️ ảnh "${data.imageSkipped.name}" khớp nhưng >3MB nên bị bỏ qua)`;
    setStatus(statusMsg);
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

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

  // ═══ PHONG THUY THU HIEN (chi ap dung khi PLATFORM === 'messenger') — them 2026-09 ═══
  // Cac list/du lieu duoi day KHONG dung cho Pancake (san pham suc khoe) de tranh lam sai
  // ngu canh CS dang dung — moi noi dung dung PLATFORM === 'messenger' de chon nhanh.
  const CARE_STATUSES_MESSENGER = [
    'Chờ gọi tư vấn', 'Đã gọi - đang theo dõi', 'Hẹn gọi lại',
    'Không nghe máy', 'Đã chốt', 'Từ chối', 'Đang khiếu nại', 'Tạm ngừng chăm sóc'
  ];
  const MENH_TABLE_DEFAULT = {
    'Kim': [1954,1955,1962,1963,1970,1971,1984,1985,1992,1993,2000,2001],
    'Thủy': [1956,1957,1964,1965,1972,1973,1986,1987,1994,1995,2002,2003],
    'Hỏa': [1958,1959,1966,1967,1974,1975,1988,1989,1996,1997,2004,2005],
    'Mộc': [1960,1961,1968,1969,1982,1983,1990,1991,1998,1999,2012,2013],
    'Thổ': [1976,1977,1978,1979,1980,1981,2006,2007,2008,2009,2010,2011]
  };
  const CANNED_DEFAULT_MESSENGER = [
    { id:'menhkim', nhom:'Theo mệnh', label:'Mệnh Kim', text:'Dạ với người mệnh Kim thì màu hợp là màu trắng, vàng, bạc (thuộc hành Kim và Thổ vì Thổ sinh Kim ạ), nên tránh dùng nhiều màu đỏ, hồng, tím (hành Hỏa khắc Kim).\nĐá phong thủy hợp mệnh Kim: đá thạch anh trắng, đá mắt hổ vàng, ngọc trai, đá obsidian đen (Thủy tương sinh).\nBên em hiện có $$ rất phù hợp với mệnh Kim ạ, chị/anh xem qua thử nhé.' },
    { id:'menhmoc', nhom:'Theo mệnh', label:'Mệnh Mộc', text:'Dạ với người mệnh Mộc thì màu hợp là màu xanh lá, xanh dương, đen (hành Mộc và Thủy vì Thủy sinh Mộc ạ), nên tránh dùng nhiều màu trắng, bạc (hành Kim khắc Mộc).\nĐá phong thủy hợp mệnh Mộc: đá aventurine xanh, ngọc bích, đá obsidian đen.\nBên em hiện có $$ rất phù hợp với mệnh Mộc ạ, chị/anh xem qua thử nhé.' },
    { id:'menhthuy', nhom:'Theo mệnh', label:'Mệnh Thủy', text:'Dạ với người mệnh Thủy thì màu hợp là màu đen, xanh dương, trắng (hành Thủy và Kim vì Kim sinh Thủy ạ), nên tránh dùng nhiều màu vàng nâu (hành Thổ khắc Thủy).\nĐá phong thủy hợp mệnh Thủy: đá obsidian đen, đá lapis lazuli xanh, đá thạch anh trắng.\nBên em hiện có $$ rất phù hợp với mệnh Thủy ạ, chị/anh xem qua thử nhé.' },
    { id:'menhhoa', nhom:'Theo mệnh', label:'Mệnh Hỏa', text:'Dạ với người mệnh Hỏa thì màu hợp là màu đỏ, hồng, tím, xanh lá (hành Hỏa và Mộc vì Mộc sinh Hỏa ạ), nên tránh dùng nhiều màu đen, xanh dương (hành Thủy khắc Hỏa).\nĐá phong thủy hợp mệnh Hỏa: đá thạch anh hồng, đá garnet đỏ, đá aventurine xanh.\nBên em hiện có $$ rất phù hợp với mệnh Hỏa ạ, chị/anh xem qua thử nhé.' },
    { id:'menhtho', nhom:'Theo mệnh', label:'Mệnh Thổ', text:'Dạ với người mệnh Thổ thì màu hợp là màu vàng, nâu, đỏ, hồng (hành Thổ và Hỏa vì Hỏa sinh Thổ ạ), nên tránh dùng nhiều màu xanh lá (hành Mộc khắc Thổ).\nĐá phong thủy hợp mệnh Thổ: đá mắt hổ vàng, đá citrine vàng, đá thạch anh hồng.\nBên em hiện có $$ rất phù hợp với mệnh Thổ ạ, chị/anh xem qua thử nhé.' },
    { id:'chaohoi', nhom:'Giá & chính sách', label:'Chào hỏi', text:'Dạ em chào chị/anh, em là $$ bên shop phong thủy Thu Hiền ạ. Chị/anh cho em xin năm sinh để em tư vấn sản phẩm hợp mệnh nhất mình nhé ạ 🙏' },
    { id:'giaba', nhom:'Giá & chính sách', label:'Báo giá', text:'Dạ sản phẩm $$ bên em giá là $$ ạ. Giá này đã bao gồm hộp đựng và thẻ bảo hành, chưa gồm phí ship ạ. Chị/anh có muốn em tư vấn thêm mẫu khác cùng tầm giá không ạ?' },
    { id:'csship', nhom:'Giá & chính sách', label:'Chính sách ship', text:'Dạ bên em giao hàng toàn quốc qua đơn vị vận chuyển, thời gian dự kiến 2–4 ngày với nội thành và 3–5 ngày với tỉnh xa ạ. Chị/anh có thể xem hàng trước khi thanh toán (COD) ạ.' },
    { id:'csdoitra', nhom:'Giá & chính sách', label:'Đổi trả', text:'Dạ sản phẩm bên em hỗ trợ đổi trong vòng 7 ngày nếu lỗi do nhà sản xuất hoặc không đúng mẫu đã đặt ạ, còn đổi ý cá nhân thì em xin phép hỗ trợ đổi mẫu khác tương đương giá trị trong 3 ngày ạ (khách chịu phí ship đổi). Chị/anh yên tâm mua ạ 🙏' },
    { id:'xinttin', nhom:'Giá & chính sách', label:'Xin thông tin lên đơn', text:'Dạ để lên đơn cho chị/anh, em xin thông tin: \n- Họ tên: $$\n- Số điện thoại: $$\n- Địa chỉ nhận hàng: $$\nChị/anh gửi giúp em với ạ, em lên đơn ngay ạ.' },
    { id:'follow2ngay', nhom:'Giá & chính sách', label:'Follow-up 2 ngày', text:'Dạ em là $$ bên phong thủy Thu Hiền ạ, hôm trước chị/anh có quan tâm sản phẩm $$, không biết chị/anh đã quyết định chưa ạ? Hiện bên em đang có ưu đãi $$, chị/anh xem thử nhé ạ 🙏' }
  ];
  const IS_PHONGTHUY = PLATFORM === 'messenger';
  const ACTIVE_CARE_STATUSES = IS_PHONGTHUY ? CARE_STATUSES_MESSENGER : CARE_STATUSES;
  const ACTIVE_KHSTATUS_OPTS = KH_STATUS_OPTS; // giu nguyen "Tinh trang KH" cho ca 2 nen tang, khong doi thanh Phan loai khach
  const KHSTATUS_LABEL = 'Tình trạng KH';
  const KNOWLEDGE_TTL_MS = 20 * 60 * 1000; // cache 20 phut, khong goi Sheet moi tin nhan
  let _menhTable = MENH_TABLE_DEFAULT;
  let _cannedResponses = CANNED_DEFAULT_MESSENGER;
  let _bannedWords = []; // [{tuCam, thayThe}] doc tu sheet "Luu y tu cam" (file Report Sale) qua getKnowledge
  function tinhMenh_(namSinhStr) {
    const n = parseInt(namSinhStr, 10);
    if (!n || n < 1900 || n > 2100) return null;
    for (const menh of Object.keys(_menhTable)) if (_menhTable[menh].includes(n)) return menh;
    return null;
  }
  // Tu dong sua ten san pham dinh tu cam khi Sao chep don hang, theo dung sheet "Luu y tu cam" —
  // khop cum dai truoc (vd "túi tiền" truoc "tiền") de khong cat nham chu con lai trong cum.
  // 2 truong hop rieng nguoi dung yeu cau chinh xac (uu tien hon danh sach doc tu sheet, vi cot
  // "Cách viết lại" trong sheet cho 2 dong nay thuc ra la GHI CHU huong dan cho Sale chu khong phai
  // ten thay the ngan gon can dung khi len don).
  const PRODUCT_NAME_OVERRIDES = [
    { tuCam: 'túi tiền', thayThe: 'túi' },
    { tuCam: 'Lộc phúc tình', thayThe: 'lpt' },
    { tuCam: 'thiên lộc', thayThe: 'TL' } // "lộc" là từ cấm → viết tắt TL khi lên đơn
  ];
  function sanitizeProductName_(name) {
    if (!name) return name;
    let out = name;
    const all = PRODUCT_NAME_OVERRIDES.concat(_bannedWords).sort((a, b) => b.tuCam.length - a.tuCam.length);
    all.forEach((bw) => {
      if (!bw.tuCam) return;
      const esc = bw.tuCam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(esc, 'gi'), bw.thayThe || '');
    });
    return out.replace(/\s{2,}/g, ' ').trim();
  }
  async function loadPhongThuyKnowledge_() {
    if (!IS_PHONGTHUY) return;
    chrome.storage.local.get(['pkKnowledge', 'pkKnowledgeTs'], (res) => {
      if (res.pkKnowledge) applyPhongThuyKnowledge_(res.pkKnowledge);
      const fresh = res.pkKnowledge && res.pkKnowledgeTs && (Date.now() - res.pkKnowledgeTs < KNOWLEDGE_TTL_MS);
      if (fresh) return;
      chrome.runtime.sendMessage({ type: 'GET_KNOWLEDGE' }, (resp) => {
        if (!resp?.ok || !resp.data) return; // giu ban mac dinh/cache cu neu GAS loi
        const k = {
          menhTable: resp.data.menhTable || MENH_TABLE_DEFAULT,
          canned: (resp.data.canned && resp.data.canned.length) ? resp.data.canned : CANNED_DEFAULT_MESSENGER,
          bannedWords: resp.data.bannedWords || []
        };
        chrome.storage.local.set({ pkKnowledge: k, pkKnowledgeTs: Date.now() });
        applyPhongThuyKnowledge_(k);
      });
    });
  }
  function applyPhongThuyKnowledge_(k) {
    if (k.menhTable) _menhTable = k.menhTable;
    if (k.canned && k.canned.length) _cannedResponses = k.canned;
    if (k.bannedWords) _bannedWords = k.bannedWords;
    renderCannedList_();
  }
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
  let _stonePref = ''; // '' = mac dinh (cot G) | 'SAPHIA' | 'RUBY' — luu sticky, khoi phai go lai moi lan
  let CS_NAMES = [];
  let NICK_LIST = [];
  let CARE_STATUS_TREE = null; // cay "Tinh trang CS" load dong tu GAS (dong bo voi appweb/Zalo AI)
  let CUSTOM_FIELDS = []; // "truong tu tao" (admin them ben app web chinh) — load dong tu GAS
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
    if (!IS_PHONGTHUY) { loadCareStatusTree_(); loadCustomFields_(); } // cay dung chung cho Pancake/Zalo (san pham suc khoe) — khong ap dung cho phong thuy
    loadChatKeyMap_();
    startCarePoll_();
    loadReminders_();
    loadCartForCurrentPhone_(); // khoi tao khu don hang dang tinh (SDT rong -> gio tam chung)
    loadPhongThuyKnowledge_();
    if (IS_PHONGTHUY) setInterval(loadPhongThuyKnowledge_, KNOWLEDGE_TTL_MS);
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
        <button id="pk-ai-settings" title="Cài đặt AI cá nhân (dùng key riêng thay vì AI dùng chung)" style="background:rgba(255,255,255,.2);border:none;border-radius:5px;color:#fff;padding:3px 7px;font-size:11px;cursor:pointer;margin-right:6px;white-space:nowrap">⚙ AI</button>
        <button id="pk-ai-collapse" title="Thu gọn">—</button>
      </div>
      <div id="pk-ai-body">
        <div id="pk-ai-key-banner" style="display:none;font-size:11px;padding:6px 10px;border-bottom:1px solid var(--pk-border,#e5e7eb)"></div>
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
          <button id="pk-add-new-btn" title="Mở ngay form thêm khách mới — không cần tra cứu trước, dán SĐT vào form rồi điền và lưu">＋ Thêm KH</button>
        </div>
        <div id="pk-ai-customer"></div>

        <div id="pk-menu-wrap">
          <select id="pk-menu-sel">
            <option value="">— Chọn mục —</option>
            <option value="rem">⏰ Nhắc hẹn hôm nay (0)</option>
            <option value="price">💰 Tra cứu bảng giá</option>
          </select>
          <div id="pk-menu-content">
            <div id="pk-rem-body" style="display:none">
              <div id="pk-rem-toolbar"><button id="pk-rem-refresh" title="Tải lại">🔄 Tải lại</button></div>
              <div id="pk-rem-list"></div>
            </div>
            <div id="pk-price-body" style="display:none">
              <div id="pk-price-mode-tabs" style="display:flex;gap:6px;margin-bottom:6px">
                <button type="button" class="pk-price-mode-btn active" data-mode="search">🔎 Gõ tìm</button>
                <button type="button" class="pk-price-mode-btn" data-mode="builder">🧩 Soạn đơn (chọn từng bước)</button>
              </div>
              <div id="pk-price-search-mode">
                <div id="pk-price-row">
                  <input type="text" id="pk-price-q" placeholder="Tên sản phẩm, kiểu/size..." />
                  <button id="pk-price-btn">Tìm</button>
                </div>
                <div id="pk-price-result"></div>
              </div>
              <div id="pk-price-builder-mode" style="display:none">
                <div id="pk-builder-steps"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="pk-cart-section" style="display:none">
          <div id="pk-cart-header" style="display:flex;justify-content:space-between;align-items:center">
            <span>🧾 Đơn hàng đang tính (<span id="pk-cart-count">0</span>)</span>
            <label style="font-size:10.5px;font-weight:400;color:#831843;display:flex;align-items:center;gap:3px">
              <input type="checkbox" id="pk-cart-price-k" /> Nhập giá theo nghìn (k)
            </label>
          </div>
          <div id="pk-cart-list"></div>
          <div id="pk-cart-addrow">
            <button id="pk-cart-add-manual" title="Thêm 1 dòng sản phẩm tự nhập (khi hệ thống tính sai hoặc không tra được)">＋ Thêm dòng thủ công</button>
          </div>
          <div id="pk-cart-extra">
            <div class="pk-cart-extra-row">
              <label>🎁 Quà tặng kèm</label>
              <input type="text" id="pk-cart-gift" placeholder="VD: tặng 1 vòng phong thủy nhỏ..." />
            </div>
            <div class="pk-cart-extra-row">
              <label>Giảm giá</label>
              <select id="pk-cart-discount-type">
                <option value="none">Không giảm</option>
                <option value="percent">% </option>
                <option value="amount">Số tiền</option>
              </select>
              <input type="number" id="pk-cart-discount-value" placeholder="0" min="0" style="display:none" />
            </div>
            <div class="pk-cart-extra-row">
              <label>Thêm vàng (k)</label>
              <input type="number" id="pk-cart-gold" placeholder="0" min="0" title="Tiền vàng thêm, nghìn đồng (VD 500 = 500.000đ)" />
            </div>
            <div class="pk-cart-extra-row">
              <label><input type="checkbox" id="pk-cart-freeship" /> Freeship</label>
              <span style="font-size:10px;color:#9d174d;opacity:.8">không tích → tự cộng 40k ship</span>
            </div>
          </div>
          <div id="pk-cart-total"></div>
          <div id="pk-cart-actions">
            <button id="pk-cart-copy">📋 Sao chép đơn hàng</button>
            <button id="pk-cart-clear">🗑 Xoá hết</button>
          </div>
        </div>

        ${IS_PHONGTHUY ? `
        <div id="pk-canned-section">
          <div id="pk-canned-header" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
            <span>📋 Mẫu có sẵn (phong thủy)</span><span id="pk-canned-toggle" style="font-size:11px">▼ mở</span>
          </div>
          <div id="pk-canned-body" style="display:none"></div>
        </div>` : ''}

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
        <div class="pk-stone-row" id="pk-stone-row" title="Không tick gì = báo giá mặc định (cột G). Tick 1 loại nếu khách hỏi đá SAPHIA/RUBY — nhớ luôn cho lần sau, khỏi phải gõ lại.">
          <span class="pk-stone-label">💎 Loại đá:</span>
          <label><input type="radio" name="pk-stone" id="pk-stone-none" value="" checked /> Mặc định</label>
          <label><input type="radio" name="pk-stone" id="pk-stone-saphia" value="SAPHIA" /> SAPHIA</label>
          <label><input type="radio" name="pk-stone" id="pk-stone-ruby" value="RUBY" /> RUBY</label>
        </div>
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
    var _AI_PROVIDER_LABEL = { grok: "Grok (xAI)", gemini: "Gemini (Google)", openai: "OpenAI (ChatGPT)" };
  function _refreshAiKeyBanner() {
    var box = panelEl && panelEl.querySelector("#pk-ai-key-banner");
    if (!box) return;
    chrome.storage.sync.get(["aiProvider", "aiApiKey"], (s) => {
      if (s.aiProvider && s.aiApiKey) {
        box.style.display = "block";
        box.style.background = "#f0fdf4"; box.style.color = "#166534";
        box.innerHTML = "🔑 Đang dùng AI riêng: <b>" + (_AI_PROVIDER_LABEL[s.aiProvider] || s.aiProvider) + "</b> — bấm ⚙ AI để đổi/xoá.";
      } else if (s.aiProvider && !s.aiApiKey) {
        box.style.display = "block";
        box.style.background = "#fffbeb"; box.style.color = "#92400e";
        box.innerHTML = "⚠️ Đã chọn " + (_AI_PROVIDER_LABEL[s.aiProvider] || s.aiProvider) + " nhưng chưa dán API Key — bấm ⚙ AI để hoàn tất, tạm thời vẫn dùng AI chung.";
      } else {
        box.style.display = "none";
      }
    });
  }

  panelEl.querySelector("#pk-ai-collapse").addEventListener("click", () => {
      panelEl.classList.toggle("pk-ai-collapsed");
      try { chrome.storage.local.set({ pkPanelCollapsed: panelEl.classList.contains("pk-ai-collapsed") }); } catch (e) {}
    });
    panelEl.querySelector("#pk-ai-settings").addEventListener("click", () => {
      // content script khong co quyen goi thang chrome.runtime.openOptionsPage() — nho background mo ho.
      chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
    });
    _refreshAiKeyBanner();
    // CS luu key o trang Options (tab rieng) — panel dang mo can tu cap nhat lai banner khi co
    // thay doi, khong bat CS phai bam F5 lai trang Messenger/Pancake.
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && (changes.aiProvider || changes.aiApiKey)) _refreshAiKeyBanner();
      });
    } catch (e) {}
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
    panelEl.querySelector("#pk-add-new-btn").addEventListener("click", quickAddNewCustomer_);
    panelEl.querySelector("#pk-menu-sel").addEventListener("change", (e) => {
      const v = e.target.value;
      panelEl.querySelector("#pk-rem-body").style.display = v === "rem" ? "block" : "none";
      panelEl.querySelector("#pk-price-body").style.display = v === "price" ? "block" : "none";
      if (v === "rem") loadReminders_();
    });
    panelEl.querySelector("#pk-rem-refresh").addEventListener("click", () => loadReminders_());
    panelEl.querySelector("#pk-price-btn").addEventListener("click", doPriceSearch_);
    panelEl.querySelector("#pk-price-q").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doPriceSearch_();
    });
    panelEl.querySelectorAll('.pk-price-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        panelEl.querySelectorAll('.pk-price-mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const isBuilder = btn.dataset.mode === 'builder';
        panelEl.querySelector('#pk-price-search-mode').style.display = isBuilder ? 'none' : 'block';
        panelEl.querySelector('#pk-price-builder-mode').style.display = isBuilder ? 'block' : 'none';
        if (isBuilder) initBuilder_();
      });
    });
    panelEl.querySelector('#pk-cart-add-manual').addEventListener('click', () => {
      panelEl.querySelector('#pk-cart-section').dataset.everOpened = '1';
      addToCart_({ name: '', note: '', price: 0, qty: 1 });
      // focus ngay vao o ten cua dong vua them cho de go
      setTimeout(() => {
        const rows = panelEl.querySelectorAll('#pk-cart-list .pk-cart-name');
        if (rows.length) rows[rows.length - 1].focus();
      }, 30);
    });
    panelEl.querySelector('#pk-cart-gift').addEventListener('input', (e) => { _cartExtra.gift = e.target.value; });
    panelEl.querySelector('#pk-cart-gift').addEventListener('change', () => { saveCart_(); });
    panelEl.querySelector('#pk-cart-discount-type').addEventListener('change', (e) => {
      _cartExtra.discountType = e.target.value;
      panelEl.querySelector('#pk-cart-discount-value').style.display = e.target.value === 'none' ? 'none' : '';
      saveCart_(); _renderCartTotal_();
    });
    panelEl.querySelector('#pk-cart-discount-value').addEventListener('input', (e) => {
      _cartExtra.discountValue = Number(e.target.value) || 0; _renderCartTotal_();
    });
    panelEl.querySelector('#pk-cart-discount-value').addEventListener('change', () => { saveCart_(); });
    panelEl.querySelector('#pk-cart-gold').addEventListener('input', (e) => { _cartExtra.gold = Math.max(0, Number(e.target.value) || 0); _renderCartTotal_(); });
    panelEl.querySelector('#pk-cart-gold').addEventListener('change', () => { saveCart_(); });
    panelEl.querySelector('#pk-cart-freeship').addEventListener('change', (e) => {
      _cartExtra.freeship = e.target.checked; saveCart_(); _renderCartTotal_();
    });
    panelEl.querySelector('#pk-cart-price-k').addEventListener('change', (e) => {
      _cartExtra.priceInK = e.target.checked; saveCart_(); renderCart_(); // render lai de doi hien thi cac dong gia da co
    });
    panelEl.querySelector('#pk-cart-copy').addEventListener('click', () => {
      const text = _buildCartSummaryText_();
      if (!text.trim()) { setStatus('Chưa có sản phẩm nào được tick trong đơn.'); return; }
      navigator.clipboard.writeText(text).then(() => {
        setStatus('📋 Đã sao chép đơn hàng — dán vào khung chat để gửi khách.');
      }).catch(() => { setStatus('Không sao chép được, hãy bôi đen và copy thủ công.'); });
    });
    panelEl.querySelector('#pk-cart-clear').addEventListener('click', () => {
      if (!_cartItems.length) return;
      if (!confirm('Xoá toàn bộ đơn hàng đang tính cho khách này?')) return;
      _cartItems = [];
      _cartExtra = { gift: '', discountType: 'none', discountValue: 0, freeship: false, gold: 0, priceInK: false };
      saveCart_(); renderCart_();
    });
    if (IS_PHONGTHUY) {
      panelEl.querySelector('#pk-canned-header').addEventListener('click', () => {
        const body = panelEl.querySelector('#pk-canned-body');
        const toggle = panelEl.querySelector('#pk-canned-toggle');
        const hidden = body.style.display === 'none';
        body.style.display = hidden ? 'block' : 'none';
        toggle.textContent = hidden ? '▲ thu gọn' : '▼ mở';
        if (hidden) renderCannedList_();
      });
    }
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
    // Loai da (SAPHIA/RUBY) — sticky theo may qua chrome.storage.sync, khong phai tick lai moi lan
    chrome.storage.sync.get(['stonePref'], (res) => {
      _stonePref = res.stonePref || '';
      const target = panelEl.querySelector(`input[name="pk-stone"][value="${_stonePref}"]`);
      if (target) target.checked = true;
    });
    panelEl.querySelectorAll('input[name="pk-stone"]').forEach((r) => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        _stonePref = r.value;
        chrome.storage.sync.set({ stonePref: _stonePref });
        if (_lastPriceRows.length) renderPriceRows_(_lastPriceRows, _lastPriceQ); // doi loai da -> ket qua dang hien doi gia theo
        renderBuilderDyn_(); // Soạn đơn: giá tự nhảy theo loại đá (trừ khi Sale đã tự sửa giá)
      });
    });
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
    return [''].concat(ACTIVE_CARE_STATUSES).map((o) =>
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

  function loadCustomFields_() {
    safeSendMessage_({ type: 'GET_CUSTOM_FIELDS' }, (resp) => {
      if (resp?.ok && Array.isArray(resp.data)) {
        CUSTOM_FIELDS = resp.data;
        // Vẽ lại panel đang mở (nếu có) để hiện đúng các trường tự tạo mới nhất
        if (_currentPhone) renderCustomFieldSelects_(panelEl?.querySelector('#pk-cf-wrap'), _currentCare?.custom || {});
      }
    });
  }

  // Build <option> cho 1 trường tự tạo — CÙNG cấu trúc {label,value}/{label,children} với
  // careStatusOptionsHtml_ ở trên.
  function customFieldOptionsHtml_(field, selected) {
    let html = '<option value="">— Chọn —</option>';
    (field.tree || []).forEach((node) => {
      if (node.children && node.children.length) {
        html += '<optgroup label="' + escapeHtml(node.label) + '">';
        node.children.forEach((child) => {
          const v = child.value || child.label;
          html += `<option value="${escapeHtml(v)}"${selected === v ? ' selected' : ''}>${escapeHtml(node.label + ' → ' + (child.label || v))}</option>`;
        });
        html += '</optgroup>';
      } else {
        const v2 = node.value || node.label;
        html += `<option value="${escapeHtml(v2)}"${selected === v2 ? ' selected' : ''}>${escapeHtml(node.label || v2)}</option>`;
      }
    });
    return html;
  }

  // Vẽ các <select> của trường tự tạo vào 1 vùng chứa cho sẵn trong form — ghép 2 trường/hàng
  // theo đúng cấu trúc .pk-form-row > .pk-form-col mà các trường có sẵn (Sinh nhật/Ngày hẹn) đang
  // dùng, để không bị vỡ layout (pk-form-row là flex hàng ngang, cần bọc từng ô trong pk-form-col).
  function renderCustomFieldSelects_(wrapEl, values) {
    if (!wrapEl) return;
    values = values || {};
    if (!CUSTOM_FIELDS.length) { wrapEl.innerHTML = ''; return; }
    const cols = CUSTOM_FIELDS.map((f) => `
      <div class="pk-form-col">
        <label>${escapeHtml(f.label)}</label>
        <select id="pk-cf-${escapeHtml(f.id)}" data-cfid="${escapeHtml(f.id)}">${customFieldOptionsHtml_(f, values[f.id] || '')}</select>
      </div>
    `);
    let html = '';
    for (let i = 0; i < cols.length; i += 2) {
      html += `<div class="pk-form-row">${cols[i]}${cols[i + 1] || '<div class="pk-form-col"></div>'}</div>`;
    }
    wrapEl.innerHTML = html;
  }

  // Đọc giá trị các trường tự tạo đang chọn trên form (dùng khi lưu)
  function collectCustomFieldValues_(existing) {
    const out = Object.assign({}, existing || {});
    CUSTOM_FIELDS.forEach((f) => {
      const el = panelEl?.querySelector('#pk-cf-' + f.id);
      if (el) out[f.id] = el.value || '';
    });
    return out;
  }

  // Chip hiển thị giá trị trường tự tạo có dữ liệu — cạnh các chip có sẵn của thẻ khách
  function customFieldChips_(care) {
    if (!CUSTOM_FIELDS.length || !care || !care.custom) return '';
    return CUSTOM_FIELDS.map((f) => {
      const v = care.custom[f.id];
      return v ? `<span class="pk-ai-chip">🏷 ${escapeHtml(f.label)}: ${escapeHtml(v)}</span>` : '';
    }).join('');
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

    // FIX: truoc day chi kiem tra selector co PHAI LA CHUOI RONG hay khong (config thieu),
    // ma KHONG kiem tra selector do co THUC SU KHOP phan tu nao tren trang hien tai khong.
    // Neu Pancake doi giao dien (rat hay xay ra) lam selector cu (vd '#message-col-list')
    // khong con khop nua, extractMessages() se luon tra ve mang rong -> KHONG BAO GIO goi
    // requestSuggestion/requestCustomerLookup, nhung cung KHONG co canh bao gi ca -> panel
    // hien ra binh thuong (CS/SDT...) nhung "khong co gi" xay ra tiep theo, rat kho nhan biet
    // ly do. Them canh bao ro rang ngay tai day de CS biet ngay can vao Options cap nhat lai
    // selector, thay vi tuong extension bi "treo" khong ro nguyen nhan.
    if (!document.querySelector(sel.messageList)) {
      setStatus(
        `⚠️ Không tìm thấy khung tin nhắn trên trang này (selector "${sel.messageList}" không khớp) — có thể Pancake/Messenger vừa đổi giao diện. Mở Options → cập nhật lại messageList (F12 → Elements → chuột phải khung tin nhắn → Copy selector).`
      );
      // Van tiep tuc gan observer o duoi (khong return som) — phong khi khung tin nhan xuat
      // hien MUON hon (SPA tai lai/chuyen trang) thi debounce callback van tu phat hien duoc,
      // khong can F5 lai trang.
    }

    // Debounce: React/Vue thuong ban ra NHIEU mutation record cho 1 lan doi hoi thoai/tin nhan
    // moi (nhieu frame re-render lien tiep). Neu chay extractMessages() + goi API AI ngay tren
    // MOI mutation se: (1) doc .innerText lap lai nhieu lan (moi lan force reflow, ton CPU), (2)
    // co the ban TRUNG LAP nhieu request AI cho cung 1 thay doi hoi thoai (ton quota/tien, UI
    // giat vi ket qua cu bi ghi de lien tuc). Cho DOM "yen" 500ms roi moi thuc su xu ly 1 lan.
    let _mutDebounceTimer = null;
    const handleMutation = () => {
      clearTimeout(_mutDebounceTimer);
      _mutDebounceTimer = setTimeout(() => {
        if (!document.querySelector(sel.messageList)) return; // van chua khop -> bo qua, khong spam trang thai
        const messages = extractMessages();
        const signature = messages.map((m) => m.text).join("|").slice(0, 500);
        if (signature && signature !== lastConversationSignature) {
          lastConversationSignature = signature;
          requestSuggestion(false);
          requestCustomerLookup();
        }
      }, 500);
    };
    const observer = new MutationObserver(handleMutation);

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
          • Khách <b>đã có</b> trong Sasum: nhập SĐT ở ô trên rồi bấm <b>"Tra cứu"</b>.<br>
          • Khách <b>mới</b>: bấm thẳng <b>"＋ Thêm KH"</b> — form hiện ngay, dán SĐT vào form
          rồi điền tên/trạng thái/ghi chú và bấm Lưu (không cần tra cứu trước).
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

  // "＋ Thêm KH": mở NGAY form nhập khách mới, KHÔNG cần tra cứu trước và KHÔNG bắt buộc phải
  // có sẵn SĐT — giải quyết đúng vấn đề "phải điền SĐT + bấm Tra cứu mới hiện form, mất thời
  // gian". CS bấm nút này là form hiện liền, dán SĐT vào ô SĐT ngay trong form rồi điền tên/
  // trạng thái/ghi chú và bấm Lưu. SĐT chỉ bắt buộc ở thời điểm LƯU (validate trong saveCare_).
  //
  // Để tránh rủi ro ghi đè mất dữ liệu nếu SĐT đó thật ra ĐÃ có trong Sasum, sau khi CS dán
  // SĐT hợp lệ sẽ âm thầm tra cứu ở nền: nếu tìm thấy dữ liệu cũ thì nạp vào các ô CS CHƯA kịp
  // sửa (dùng lại đúng cơ chế applyPolledCare_), không đụng vào ô nào CS đã gõ rồi.
  function quickAddNewCustomer_() {
    const phoneInput = panelEl.querySelector('#pk-ai-phone-input');
    const phone = normPhone(phoneInput ? phoneInput.value : '');
    _currentPhone = phone;           // có thể rỗng — form vẫn mở bình thường
    _currentCare = null;
    _currentOrders = [];
    _lastServerCare = {};
    renderCustomerCard(phone, { care: null, orders: [] }, { blankNew: true });
    setStatus(phone
      ? `Đã mở form thêm mới cho ${phone} — điền thông tin rồi bấm Lưu vào Sasum.`
      : 'Đã mở form thêm khách mới — dán SĐT vào ô "SĐT khách" trong form rồi điền và bấm Lưu.');
    const inCardPhone = panelEl.querySelector('#pk-newphone-input');
    if (inCardPhone) inCardPhone.focus();
    if (phone) probeExistingCustomer_(phone);
  }

  // Tra cứu ngầm khi CS vừa dán SĐT — CHỈ để báo sớm cho CS biết đây là khách đã có, và nạp
  // sẵn dữ liệu cũ lên form cho dễ nhìn. Đây KHÔNG phải cơ chế bảo vệ dữ liệu: việc chống ghi
  // đè được đảm bảo chắc chắn ở bước lưu (saveCareAddOnly_ đọc lại bản mới nhất rồi hợp nhất),
  // nên kể cả khi CS bấm Lưu trước lúc tra cứu này trả về thì dữ liệu cũ vẫn an toàn.
  function probeExistingCustomer_(phone) {
    safeSendMessage_({ type: 'LOOKUP_CUSTOMER', payload: { phone } }, (resp) => {
      if (!resp?.ok || _currentPhone !== phone) return; // CS đã đổi sang số khác -> bỏ qua
      const care = resp.data.care || null;
      const orders = resp.data.orders || [];
      if (!care && !orders.length) return; // đúng là khách mới thật -> không cần làm gì thêm
      _currentOrders = orders;
      applyPolledCare_(phone, care || {});
      const tagEl = panelEl.querySelector('#pk-ai-new-tag');
      if (tagEl) tagEl.style.display = 'none';
      setStatus(`ℹ️ Số ${phone} đã có sẵn trong hệ thống — bạn vẫn điền và lưu bình thường, phần bạn nhập sẽ được THÊM vào hồ sơ này chứ không ghi đè dữ liệu cũ.`);
    });
  }

  function renderCustomerCard(phone, data, opts) {
    const box = panelEl.querySelector("#pk-ai-customer");
    const { care, orders } = data;
    loadCartForCurrentPhone_(); // don hang dang tinh gan theo tung SDT — doi khach thi doi don

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

    const blankNew = !!(opts && opts.blankNew);

    box.innerHTML = `
      <div class="pk-ai-cust-card">
        ${blankNew
          ? `<div class="pk-ai-cust-name">＋ Thêm khách mới</div>
             <label class="pk-label-top">SĐT khách <span style="color:#dc2626">*</span></label>
             <input type="text" id="pk-newphone-input" class="pk-full-input" placeholder="Dán SĐT khách vào đây..." value="${escapeHtml(phone || '')}" />`
          : `<div class="pk-ai-cust-name">${escapeHtml(name)} <span class="pk-ai-cust-phone">${phone}</span></div>`}
        <div class="pk-ai-new-tag" id="pk-ai-new-tag" style="${isNew ? '' : 'display:none'}">⚠️ Chưa có trong hệ thống Sasum — lưu sẽ tạo mới</div>
        ${chips.length ? `<div class="pk-ai-cust-chips">${chips.map((c) => `<span class="pk-ai-chip">${c}</span>`).join('')}${customFieldChips_(care)}</div>` : (customFieldChips_(care) ? `<div class="pk-ai-cust-chips">${customFieldChips_(care)}</div>` : '')}
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
            <label>${KHSTATUS_LABEL}</label>
            <select id="pk-khstatus-sel">${optHtml(ACTIVE_KHSTATUS_OPTS, care?.khStatus)}</select>
          </div>
          <div class="pk-form-col">
            <label>Sinh nhật${IS_PHONGTHUY ? ' → Mệnh' : ''}</label>
            <div style="display:flex;gap:4px;align-items:center">
              <input type="date" id="pk-birthday" value="${care?.birthday ? toInputDate_(care.birthday) : ''}" style="flex:1" />
              ${IS_PHONGTHUY ? '<span id="pk-menh-badge" style="font-size:11px;font-weight:700;color:#2563eb;white-space:nowrap"></span>' : ''}
            </div>
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

        <div id="pk-cf-wrap"></div>

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

    renderCustomFieldSelects_(box.querySelector('#pk-cf-wrap'), care?.custom || {});
    renderNoteHistory_(care?.note || '');

    box.querySelector('#pk-note-add-btn').addEventListener('click', addNoteEntry_);
    box.querySelector('#pk-note-new').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addNoteEntry_();
    });
    box.querySelector('#pk-hen-done').addEventListener('click', () => doneAppointment_(currentFormPhone_() || phone));
    box.querySelector('#pk-save-btn').addEventListener('click', () => saveCare_(currentFormPhone_() || phone));

    // Form thêm mới: khi CS dán xong SĐT hợp lệ thì tự tra ngầm 1 lần để cảnh báo nếu số đã tồn tại
    const newPhoneEl = box.querySelector('#pk-newphone-input');
    if (newPhoneEl) {
      let probed = '';
      const onPhoneReady = () => {
        const p = normPhone(newPhoneEl.value);
        if (!/^0[3-9]\d{8}$/.test(p) || p === probed) return;
        probed = p;
        _currentPhone = p;
        probeExistingCustomer_(p);
      };
      newPhoneEl.addEventListener('blur', onPhoneReady);
      newPhoneEl.addEventListener('input', onPhoneReady);
    }
    if (IS_PHONGTHUY) {
      const bdayEl = box.querySelector('#pk-birthday');
      bdayEl.addEventListener('input', () => updateMenhBadge_());
      bdayEl.addEventListener('change', () => updateMenhBadge_()); // input type=date: chon qua lich thuong chi ban 'change', khong ban 'input' o 1 so trinh duyet
      updateMenhBadge_();
    }
  }

  // SĐT đang áp dụng cho form: ưu tiên ô SĐT trong form thêm mới (nếu đang mở), sau đó tới
  // SĐT của khách vừa tra cứu.
  function currentFormPhone_() {
    const el = panelEl?.querySelector('#pk-newphone-input');
    if (el) return normPhone(el.value);
    return _currentPhone || '';
  }

  function updateMenhBadge_() {
    const inp = panelEl?.querySelector('#pk-birthday');
    const out = panelEl?.querySelector('#pk-menh-badge');
    if (!inp || !out) return;
    const yearMatch = (inp.value || '').match(/\d{4}/);
    if (!yearMatch) { out.textContent = ''; return; }
    const menh = tinhMenh_(yearMatch[0]);
    out.textContent = menh ? ('Mệnh ' + menh) : 'Chưa có DL năm này';
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
      custom: c.custom || {},
      name: liveName || _currentOrderPanelName || c.name || ''
    }, overrides || {});
  }

  // ── LUU AN TOAN CHO LUONG "+ Them KH" (nguon Cham soc) ─────────────────────────────────
  // Nguyen tac: sale CHI DUOC THEM thong tin moi, KHONG duoc ghi de/xoa du lieu cu.
  // Truoc khi ghi, luon doc lai ban ghi MOI NHAT tren server roi hop nhat:
  //   - Ghi chu: GIU NGUYEN toan bo lich su cu, chi noi them cac ghi chu moi CS vua go len dau.
  //   - Cac truong khac (trang thai CS/Zalo/tinh trang KH/sinh nhat/lich hen/ten): neu server
  //     DA CO gia tri thi giu nguyen cua server; chi dien vao nhung o server dang de trong.
  // Nho vay du CS bam Luu truoc khi tra ngam kip tra ve, du lieu cu van an toan tuyet doi.
  function _mergeNotesKeepOld_(serverNoteRaw, localNoteRaw) {
    const serverArr = _parseNotes(serverNoteRaw);
    const localArr = _parseNotes(localNoteRaw);
    const keyOf = (n) => [n.text || '', n.user || '', n.time || ''].join('|');
    const seen = new Set(serverArr.map(keyOf));
    // Ghi chu moi = co trong local nhung chua co tren server -> dua len dau, giu het ban cu
    const added = localArr.filter((n) => n.text && !seen.has(keyOf(n)));
    return { merged: _notesToStr([...added, ...serverArr]), addedCount: added.length };
  }

  // Tra ve row da hop nhat + danh sach ten truong bi giu lai (de bao cho CS biet, minh bach)
  function _mergeRowKeepOld_(serverCare, localRow) {
    const kept = [];
    const out = Object.assign({}, localRow);
    const LABELS = {
      name: 'Tên khách', status: 'Trạng thái CS', zalo: 'Trạng thái Zalo',
      khStatus: KHSTATUS_LABEL, birthday: 'Sinh nhật',
      schedHen: 'Ngày hẹn', schedHenNote: 'Ghi chú lịch hẹn'
    };
    Object.keys(LABELS).forEach((k) => {
      const sv = serverCare[k];
      const lv = localRow[k];
      if (sv) {                       // server da co -> giu nguyen, sale khong duoc de len
        out[k] = sv;
        if (lv && String(lv) !== String(sv)) kept.push(LABELS[k]);
      } else {
        out[k] = lv || '';            // server trong -> cho phep dien moi
      }
    });
    // Cac truong lich hen/schedules khac khong co UI ben Pancake: luon lay nguyen cua server
    ['schedules','schedGoi','schedGoiNote','schedSP','schedSPNote','schedCS','schedCSNote'].forEach((k) => {
      out[k] = serverCare[k] || localRow[k] || '';
    });
    // Nick Zalo/kenh: hop nhat, khong bao gio lam mat nick cu
    const svNicks = serverCare.nickZalos || [];
    const lcNicks = localRow.nickZalos || [];
    out.nickZalos = [...new Set([...svNicks, ...lcNicks])];
    // CS phu trach: neu khach da co CS cu thi giu, khong cuop quyen phu trach
    out.cs = serverCare.cs || localRow.cs || '';
    const noteRes = _mergeNotesKeepOld_(serverCare.note, localRow.note);
    out.note = noteRes.merged;
    return { row: out, kept, addedNotes: noteRes.addedCount };
  }

  function saveCareAddOnly_(phone, localRow, btn) {
    // Doc lai ban MOI NHAT ngay truoc khi ghi — chan ca truong hop CS bam Luu qua nhanh
    safeSendMessage_({ type: 'LOOKUP_CUSTOMER', payload: { phone } }, (lookupResp) => {
      if (!lookupResp?.ok) {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu vào Sasum'; }
        setStatus('Chưa kiểm tra được dữ liệu cũ của số này nên tạm dừng để an toàn — bấm Lưu lại lần nữa.');
        return;
      }
      const serverCare = lookupResp.data.care || null;
      const serverOrders = lookupResp.data.orders || [];
      const isTrulyNew = !serverCare && !serverOrders.length;
      const { row, kept, addedNotes } = _mergeRowKeepOld_(serverCare || {}, localRow);
      safeSendMessage_({ type: 'SAVE_CARE', payload: Object.assign({}, row, { isNewCustomer: isTrulyNew }) }, (resp) => {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu vào Sasum'; }
        if (!resp?.ok) { setStatus('Lưu thất bại: ' + (resp?.error || 'lỗi không rõ')); return; }
        _currentCare = row;
        _currentPhone = phone;
        _currentOrders = serverOrders;
        _lastServerCare = Object.assign({}, row);
        _refreshCardAfterSave_(phone, row);
        renderNoteHistory_(row.note);
        const rawEl = panelEl.querySelector('#pk-note-raw');
        if (rawEl) rawEl.value = row.note;
        if (isTrulyNew) {
          setStatus('✓ Đã tạo khách mới (nguồn Chăm sóc).');
        } else {
          let msg = `✓ Đã thêm vào khách đã có sẵn${addedNotes ? ` — ${addedNotes} ghi chú mới` : ''}.`;
          if (kept.length) msg += ` Giữ nguyên dữ liệu cũ: ${kept.join(', ')} (sale không ghi đè được).`;
          setStatus(msg);
        }
      });
    });
  }

  function _refreshCardAfterSave_(phone, row) {
    const nameSpan = panelEl.querySelector('.pk-ai-cust-name');
    if (nameSpan && row.name) nameSpan.innerHTML = `${escapeHtml(row.name)} <span class="pk-ai-cust-phone">${phone}</span>`;
    const tagEl = panelEl.querySelector('#pk-ai-new-tag');
    if (tagEl) tagEl.style.display = 'none';
    const newPhoneEl = panelEl.querySelector('#pk-newphone-input');
    if (newPhoneEl) { newPhoneEl.value = phone; newPhoneEl.readOnly = true; }
    // Dong bo lai cac o tren form theo gia tri thuc te da ghi (vd truong bi giu lai cua server)
    const setVal = (id, v) => { const el = panelEl.querySelector(id); if (el) el.value = v || ''; };
    setVal('#pk-name-input', row.name);
    setVal('#pk-status-sel', row.status);
    setVal('#pk-zalo-sel', row.zalo);
    setVal('#pk-khstatus-sel', row.khStatus);
    setVal('#pk-birthday', row.birthday ? toInputDate_(row.birthday) : '');
    setVal('#pk-hen-date', row.schedHen ? toInputDate_(row.schedHen) : '');
    setVal('#pk-hen-note', row.schedHenNote);
    learnChatKeyForPhone_(phone);
  }

  function saveCare_(phone) {
    const btn = panelEl.querySelector('#pk-save-btn');
    const rawEl = panelEl.querySelector('#pk-note-raw');
    const nameEl = panelEl.querySelector('#pk-name-input');
    const liveName = nameEl ? nameEl.value.trim() : '';
    // Form "＋ Thêm KH" mở được khi chưa có SĐT, nên SĐT chỉ bắt buộc ở đúng thời điểm LƯU.
    phone = normPhone(phone);
    if (!/^0[3-9]\d{8}$/.test(phone)) {
      setStatus('SĐT chưa hợp lệ — nhập/dán SĐT khách (dạng 0xxxxxxxxx) trước khi lưu.');
      const el = panelEl.querySelector('#pk-newphone-input') || panelEl.querySelector('#pk-ai-phone-input');
      if (el) el.focus();
      return;
    }
    // Form "＋ Thêm KH" (nguồn Chăm sóc do sale tự thêm): bắt buộc có tên, và đi qua đường lưu
    // CHỈ-THÊM — đọc lại bản mới nhất rồi hợp nhất, không bao giờ ghi đè dữ liệu cũ.
    const isAddForm = !!panelEl.querySelector('#pk-newphone-input');
    if (isAddForm && !liveName) { setStatus('Vui lòng nhập tên khách hàng trước khi lưu.'); return; }

    const row = _buildRow(phone, {
      name: liveName,
      status: panelEl.querySelector('#pk-status-sel').value,
      zalo: panelEl.querySelector('#pk-zalo-sel').value,
      khStatus: panelEl.querySelector('#pk-khstatus-sel').value,
      birthday: panelEl.querySelector('#pk-birthday').value,
      schedHen: panelEl.querySelector('#pk-hen-date').value,
      schedHenNote: panelEl.querySelector('#pk-hen-note').value.trim(),
      custom: collectCustomFieldValues_(_currentCare?.custom || {}),
      note: rawEl ? rawEl.value : (_currentCare?.note || '')
    });
    if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
    if (isAddForm) { saveCareAddOnly_(phone, row, btn); return; }

    // Luồng cũ (đã tra cứu khách sẵn rồi mới sửa): giữ nguyên như trước
    const isNewCustomer = !_currentCare && (!_currentOrders || !_currentOrders.length);
    safeSendMessage_({ type: 'SAVE_CARE', payload: Object.assign({}, row, { isNewCustomer }) }, (resp) => {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu vào Sasum'; }
      if (!resp?.ok) { setStatus('Lưu thất bại: ' + (resp?.error || 'lỗi không rõ')); return; }
      _currentCare = row;
      _currentPhone = phone;
      _lastServerCare = Object.assign({}, row);
      const nameSpan = panelEl.querySelector('.pk-ai-cust-name');
      if (nameSpan && row.name) nameSpan.innerHTML = `${escapeHtml(row.name)} <span class="pk-ai-cust-phone">${phone}</span>`;
      // Lưu xong thì không còn là "khách mới" nữa: ẩn cảnh báo và khoá ô SĐT lại (tránh CS vô
      // tình sửa số rồi bấm Lưu lần nữa làm tạo nhầm bản ghi thứ hai cho cùng 1 khách).
      const tagEl = panelEl.querySelector('#pk-ai-new-tag');
      if (tagEl) tagEl.style.display = 'none';
      const newPhoneEl = panelEl.querySelector('#pk-newphone-input');
      if (newPhoneEl) { newPhoneEl.value = phone; newPhoneEl.readOnly = true; }
      // Ghi nhớ liên kết đoạn chat đang mở với SĐT này -> lần sau vào lại tự nhận diện luôn
      learnChatKeyForPhone_(phone);
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
    const listEl = panelEl?.querySelector('#pk-rem-list');
    const menuSel = panelEl?.querySelector('#pk-menu-sel');
    if (!listEl) return;
    if (menuSel) {
      const opt = [...menuSel.options].find(o => o.value === 'rem');
      if (opt) opt.textContent = '⏰ Nhắc hẹn hôm nay (' + _reminders.length + ')';
    }
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
  // Bo dau tieng Viet (ban rut gon, dung o frontend) de nhan dien cot Chat lieu/Mau/Size trong
  // DANH_MUC du ten cot the nao (co dau/khong dau, hoa/thuong) — dong bo tinh than voi _stripVN_
  // ben gas_v13.js nhung khong goi sang duoc (chay o content script rieng).
  function _stripVNlocal_(s) {
    if (!s) return '';
    s = String(s).toLowerCase();
    s = s.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a').replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i').replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u').replace(/[ỳýỵỷỹ]/g, 'y').replace(/đ/g, 'd');
    return s;
  }

  let _lastPriceRows = []; let _lastPriceQ = '';

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
    _lastPriceRows = rows; _lastPriceQ = q;
    box.innerHTML = rows.slice(0, 30).map((row, idx) => {
      const keys = Object.keys(row).filter((k) => row[k] !== '' && row[k] !== null && row[k] !== undefined);
      const isPriceKey = (k) => /gia|price/.test(_stripVNlocal_(k)); // bo dau truoc khi so: header co the la "Giá" co dau
      // Bo hẳn cot STT va cot "Khoa (an dung de tra cuu)" khoi ket qua — khong can Sale nhin thay.
      const isHiddenKey = (k) => { const s = _stripVNlocal_(k).trim(); return s === 'stt' || s.indexOf('khoa') === 0; };
      const priceKeys = keys.filter(isPriceKey);
      const otherKeys = keys.filter((k) => !isPriceKey(k) && !isHiddenKey(k));
      // Ten san pham: uu tien cot "ten san pham"/"ten thuong mai", khong co thi lay cot dau tien
      const nameKey = otherKeys.find((k) => /ten\s*san\s*pham|ten\s*thuong\s*mai/i.test(k)) || otherKeys[0] || '';
      const name = nameKey ? String(row[nameKey]) : ('Sản phẩm ' + (idx + 1));
      // Neu "Ten thuong mai" trung y het "Ten san pham" thi chi hien 1 dong cho gon
      const shownKeys = otherKeys.filter((k) => !(k !== nameKey && String(row[k]).trim() === name.trim() && /ten/i.test(_stripVNlocal_(k))));
      const line = (k) => `<span class="pk-price-field"><b>${escapeHtml(k)}:</b> ${escapeHtml(row[k])}</span>`;
      // Tu nhan dien cot Chat lieu/Mau/Size (neu DANH_MUC co) de dien san vao 3 o moi khi bam "+ Thêm"
      const chatLieuKey = otherKeys.find((k) => _stripVNlocal_(k).indexOf('chat lieu') !== -1);
      const mauKey = otherKeys.find((k) => { const s = _stripVNlocal_(k); return s === 'mau' || s === 'mau sac' || /(^|\s)mau($|\s)/.test(s); });
      const sizeKey = otherKeys.find((k) => { const s = _stripVNlocal_(k); return s.indexOf('size') !== -1 || s.indexOf('kieu') !== -1; });
      const noteKey = otherKeys.filter((k) => k !== nameKey).map((k) => `${k}: ${row[k]}`).join(', ');

      // Chon DUNG 1 cot gia theo Loai da dang tick: RUBY -> gia RUBY, SAPHIA -> gia SAPHIA,
      // khong tick -> gia thuong (cot gia khong chua chu saphia/ruby). San pham khong co gia rieng
      // cho loai da dang tick thi lui ve gia thuong va ghi chu ro de Sale biet.
      const stoneKey = (kw) => priceKeys.find((k) => _stripVNlocal_(k).indexOf(kw) !== -1);
      const defaultKey = priceKeys.find((k) => { const s = _stripVNlocal_(k); return s.indexOf('saphia') === -1 && s.indexOf('ruby') === -1; });
      let chosenKey = defaultKey || priceKeys[0] || '';
      let priceLabel = 'Giá thường';
      let fallbackNote = '';
      if (_stonePref === 'RUBY' || _stonePref === 'SAPHIA') {
        const sk = stoneKey(_stonePref.toLowerCase());
        if (sk) { chosenKey = sk; priceLabel = 'Giá ' + _stonePref; }
        else fallbackNote = ` (không có giá riêng cho ${_stonePref}, đang dùng giá thường)`;
      }
      const priceNum = chosenKey ? _parsePriceNum_(row[chosenKey]) * 1000 : 0; // cot gia ghi theo nghin d (7950 = 7.950.000d)
      const priceHtml = chosenKey
        ? `<div class="pk-price-amount"><span class="pk-price-field"><b>${escapeHtml(priceLabel)}:</b> ${escapeHtml(priceNum ? priceNum.toLocaleString('vi-VN') + 'đ' : String(row[chosenKey]))}${escapeHtml(fallbackNote)}</span></div>`
        : '';
      const noteFull = noteKey + (chosenKey ? (noteKey ? ' · ' : '') + 'Loại giá: ' + priceLabel : '');
      const addBtn = `<button class="pk-price-addbtn" data-name="${escapeHtml(name)}" data-note="${escapeHtml(noteFull)}" data-price="${priceNum}" data-chatlieu="${escapeHtml(chatLieuKey ? row[chatLieuKey] : '')}" data-mausac="${escapeHtml(mauKey ? row[mauKey] : '')}" data-size="${escapeHtml(sizeKey ? row[sizeKey] : '')}">${chosenKey ? '+ Thêm' : '+ Thêm (chưa có giá)'}</button>`;
      return `<div class="pk-price-item">${shownKeys.map(line).join(' ')}${priceHtml}<div class="pk-price-addrow">${addBtn}</div></div>`;
    }).join('');
    box.querySelectorAll('.pk-price-addbtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        addToCart_({
          name: btn.dataset.name,
          note: btn.dataset.note,
          price: Number(btn.dataset.price) || 0,
          chatLieu: btn.dataset.chatlieu || '',
          mauSac: btn.dataset.mausac || '',
          size: btn.dataset.size || '',
          qty: 1
        });
      });
    });
  }

  function _parsePriceNum_(v) {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  // Cot "Chất liệu"/"Kiểu-Size" trong DANH_MUC đôi khi nhét NHIỀU lựa chọn vào chung 1 ô theo
  // dạng "1. Aqua xanh biển 2. Citrin: vàng mỡ gà 3. Thạch anh..." thay vì tách riêng từng dòng.
  // Trước đây "+ Thêm" nhét thẳng cả chuỗi thô này vào ô Chất liệu của giỏ hàng — Sale phải tự
  // tay xoá bớt, dễ gửi nhầm nguyên cụm cho khách. Hàm này nhận diện đúng dạng đánh số 1,2,3...
  // liên tục và tách thành mảng lựa chọn riêng lẻ; trả về null nếu chuỗi KHÔNG phải danh sách
  // đánh số (ví dụ "BẠC 925 CÓ XỈ TRẮNG" — có số nhưng không phải số thứ tự liên tục từ 1).
  function _parseNumberedList_(str) {
    str = String(str || '').trim();
    if (!str) return null;
    const re = /(\d+)\.\s*/g;
    const marks = [];
    let m;
    while ((m = re.exec(str))) marks.push({ idx: m.index, num: Number(m[1]), end: re.lastIndex });
    if (marks.length < 2) return null;
    for (let i = 0; i < marks.length; i++) { if (marks[i].num !== i + 1) return null; }
    const out = [];
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].end;
      const stop = i + 1 < marks.length ? marks[i + 1].idx : str.length;
      const piece = str.slice(start, stop).trim();
      if (piece) out.push(piece);
    }
    return out.length >= 2 ? out : null;
  }

  // ══════════════════════════ SOẠN ĐƠN (gõ tên → lọc → dropdown thu hẹp dần) ══════════════════════════
  // Luồng: gõ tên (VD "tỳ hưu") → hiện TẤT CẢ tên thương mại/tên sản phẩm liên quan → chọn Tên →
  // Nhóm SP / Kiểu-Size / Chất liệu (chỉ gồm lựa chọn có thật của sản phẩm đó) → Màu, Đậm/nhạt (ghi chú
  // tự do) → Số lượng, Giá (tự nhảy theo Loại đá đang tick, sửa được), CTKM → "+ Thêm vào đơn".
  // Xong sản phẩm 1 thì form tự về trắng để soạn tiếp sản phẩm 2.
  // Dữ liệu: danh mục PHẲNG từ GAS (action priceCatalogFlat). GAS chưa cập nhật → tự lùi về "tìm trực
  // tiếp" qua priceSearch (tối đa 50 dòng/lần) để vẫn dùng được.
  const PK_COLOR_OPTS = ['Xanh rêu', 'Đen', 'Tím', 'Đỏ', 'Hồng', 'Trắng', 'Vàng', 'Xanh lá', 'Xanh da trời'];
  const PK_SHADE_OPTS = ['Đậm', 'Nhạt'];
  const PK_SHIP_FEE = 40000; // không tích Freeship thì tự cộng 40k vào tổng đơn
  const PK_FLAT_TTL_MS = 15 * 60 * 1000;
  let _flatItems = null;      // null = chưa tải; [] = tải rồi nhưng rỗng
  let _flatMode = 'full';     // 'full' = có cả danh mục | 'live' = tìm trực tiếp (GAS cũ)
  let _flatLoading = false;
  let _liveTimer = null;
  const _bldBlank_ = () => ({ q: '', nhom: '', ten: '', size: '', cl: '', cand: '', mau: '', dam: '', qty: 1,
    priceK: '', priceEdited: false, promoType: 'none', promoVal: '' });
  let _bld = _bldBlank_();

  const _fold_ = (s) => _stripVNlocal_(String(s || '').normalize('NFC')).replace(/\s+/g, ' ').trim();
  const _vnSort_ = (a, b) => String(a).localeCompare(String(b), 'vi', { numeric: true });
  const _itemNames_ = (it) => {
    const out = [];
    if (it.t) out.push(it.t);
    if (it.m && _fold_(it.m) !== _fold_(it.t)) out.push(it.m);
    return out;
  };
  // Giá theo Loại đá đang tick: RUBY → giá RUBY, SAPHIA → giá SAPHIA, không tick → giá thường.
  // Sản phẩm không có giá riêng cho loại đá đó thì lùi về giá thường.
  const _priceOfItem_ = (it) => {
    if (_stonePref === 'RUBY' && it.r) return it.r;
    if (_stonePref === 'SAPHIA' && it.sp) return it.sp;
    return it.p || 0;
  };
  const _stoneLabel_ = (it) => {
    if (_stonePref === 'RUBY') return it.r ? 'giá RUBY' : 'giá thường (SP này không có giá RUBY)';
    if (_stonePref === 'SAPHIA') return it.sp ? 'giá SAPHIA' : 'giá thường (SP này không có giá SAPHIA)';
    return 'giá thường';
  };
  // CTKM theo từng sản phẩm: amount = giảm tiền (nghìn đ) | percent = giảm % | gift = tặng quà (chữ)
  const _applyPromo_ = (base, type, val) => {
    let d = 0;
    if (type === 'amount') d = (Number(val) || 0) * 1000;
    else if (type === 'percent') d = Math.round(base * (Number(val) || 0) / 100);
    return base - Math.min(Math.max(d, 0), base);
  };

  // Chuẩn hoá 1 dòng thô của DANH_MUC (chế độ tìm trực tiếp) về cùng dạng với danh mục phẳng.
  function _normPriceRow_(row) {
    const find = (re) => Object.keys(row).find((k) => re.test(_stripVNlocal_(k)));
    const val = (k) => (k ? String(row[k]).trim() : '');
    const num = (v) => { if (v === '' || v === null || v === undefined) return 0; if (typeof v === 'number') return v; const n = Number(String(v).replace(/[^\d]/g, '')); return isNaN(n) ? 0 : n; };
    const it = { n: val(find(/nhom\s*san\s*pham/)), t: val(find(/^ten\s*san\s*pham/)), m: val(find(/ten\s*thuong\s*mai/)),
      s: val(find(/size|kieu/)), c: val(find(/chat\s*lieu/)), p: 0, sp: 0, r: 0 };
    Object.keys(row).forEach((k) => {
      const s = _stripVNlocal_(k);
      if (!/gia|price/.test(s)) return;
      const v = num(row[k]);
      if (s.indexOf('saphia') !== -1) it.sp = v; else if (s.indexOf('ruby') !== -1) it.r = v; else if (!it.p) it.p = v;
    });
    return it;
  }

  function _setBldMsg_(html) {
    const el = panelEl.querySelector('#pkb-msg');
    if (el) { el.innerHTML = html || ''; el.style.display = html ? 'block' : 'none'; }
  }

  function initBuilder_() {
    const host = panelEl.querySelector('#pk-builder-steps');
    if (!host.dataset.ready) {
      host.dataset.ready = '1';
      host.innerHTML = `
        <div class="pk-builder-row"><label>🔎 Gõ tên sản phẩm (VD: tỳ hưu, nhẫn, charm)</label>
          <input type="text" id="pkb-q" placeholder="Gõ để lọc — bỏ trống thì chọn theo Nhóm sản phẩm" autocomplete="off" /></div>
        <div id="pkb-msg" class="pk-price-loading" style="display:none"></div>
        <div id="pkb-dyn"></div>`;
      host.querySelector('#pkb-q').addEventListener('input', (e) => {
        _bld = Object.assign(_bldBlank_(), { q: e.target.value });   // đổi từ khoá → chọn lại từ đầu
        if (_flatMode === 'live') {
          clearTimeout(_liveTimer);
          _liveTimer = setTimeout(() => _liveSearch_(_bld.q), 350);
        } else {
          clearTimeout(_liveTimer);
          _liveTimer = setTimeout(renderBuilderDyn_, 120);
        }
      });
    }
    if (_flatItems === null && !_flatLoading) loadFlat_();
    renderBuilderDyn_();
  }

  function loadFlat_() {
    _flatLoading = true;
    _setBldMsg_('Đang tải danh mục sản phẩm...');
    chrome.storage.local.get(['pkPriceFlat'], (res) => {
      const c = res && res.pkPriceFlat;
      if (c && Array.isArray(c.items) && c.items.length && (Date.now() - c.ts) < PK_FLAT_TTL_MS) {
        _flatItems = c.items; _flatMode = 'full'; _flatLoading = false; _setBldMsg_(''); renderBuilderDyn_(); return;
      }
      safeSendMessage_({ type: 'GET_PRICE_FLAT' }, (resp) => {
        _flatLoading = false;
        if (resp?.ok && resp.data?.items?.length) {
          _flatItems = resp.data.items; _flatMode = 'full'; _setBldMsg_('');
          try { chrome.storage.local.set({ pkPriceFlat: { ts: Date.now(), items: _flatItems } }); } catch (e) {}
        } else if (resp?.ok) {
          _flatItems = []; _flatMode = 'full';
          _setBldMsg_('Đọc được sheet giá nhưng không nhận diện được cột "Tên sản phẩm"/"Tên thương mại" — dùng tạm tab "Gõ tìm".');
        } else if (String(resp?.error || '').indexOf('GAS_NO_FLAT') !== -1) {
          _flatMode = 'live'; _flatItems = [];
          _setBldMsg_('⚠ GAS chưa cập nhật bản mới (thiếu <b>priceCatalogFlat</b>) — đang dùng chế độ tìm trực tiếp, tối đa 50 dòng mỗi lần gõ. Deploy lại <b>gas_v13.js</b> để có đủ danh mục.');
        } else {
          _flatItems = null;   // lỗi mạng/GAS → lần mở tab sau tự thử lại
          _setBldMsg_('Lỗi tải danh mục: ' + escapeHtml(resp?.error || 'không rõ') + ' — chuyển tab rồi quay lại để thử lại.');
        }
        renderBuilderDyn_();
      });
    });
  }

  function _liveSearch_(q) {
    if (_fold_(q).length < 2) { _flatItems = []; renderBuilderDyn_(); return; }
    safeSendMessage_({ type: 'GET_PRICE', payload: { q } }, (resp) => {
      if (q !== _bld.q) return; // đã gõ tiếp, bỏ kết quả cũ
      if (!resp?.ok) { _setBldMsg_('Lỗi tìm: ' + escapeHtml(resp?.error || 'không rõ')); return; }
      _flatItems = (resp.data.rows || []).map(_normPriceRow_).filter((it) => it.t || it.m);
      renderBuilderDyn_();
    });
  }

  function renderBuilderDyn_() {
    const dyn = panelEl.querySelector('#pkb-dyn');
    if (!dyn) return;
    const items = _flatItems || [];
    if (!items.length) {
      dyn.innerHTML = (_flatMode === 'live' && _fold_(_bld.q).length >= 2) ? '<div class="pk-price-loading">Không tìm thấy sản phẩm nào khớp.</div>'
        : (_flatMode === 'live' ? '<div class="pk-price-loading">Gõ ít nhất 2 chữ để tìm.</div>' : '');
      return;
    }
    const words = _fold_(_bld.q).split(' ').filter(Boolean);
    const pool = (_flatMode === 'live' || !words.length) ? items
      : items.filter((it) => { const h = _fold_(it.n + ' ' + it.t + ' ' + it.m); return words.every((w) => h.indexOf(w) !== -1); });
    if (!pool.length) { dyn.innerHTML = '<div class="pk-price-loading">Không tìm thấy sản phẩm nào khớp.</div>'; return; }

    const opt = (v, label, sel) => `<option value="${escapeHtml(v)}"${sel ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    const row = (label, inner) => `<div class="pk-builder-row"><label>${label}</label>${inner}</div>`;
    let html = '';
    let cand = null;

    // 1) Nhóm sản phẩm
    const groups = [...new Set(pool.map((it) => it.n).filter(Boolean))].sort(_vnSort_);
    if (_bld.nhom && groups.indexOf(_bld.nhom) === -1) _bld.nhom = '';
    if (groups.length === 1 && !_bld.nhom) _bld.nhom = groups[0];
    if (groups.length) html += row(`Nhóm sản phẩm (${groups.length})`, `<select id="pkb-nhom"><option value="">— Tất cả nhóm —</option>${groups.map((g) => opt(g, g, g === _bld.nhom)).join('')}</select>`);
    const pool2 = _bld.nhom ? pool.filter((it) => it.n === _bld.nhom) : pool;

    // 2) Tên sản phẩm / tên thương mại (gộp, bỏ trùng)
    if (!words.length && _flatMode !== 'live' && !_bld.nhom) {
      dyn.innerHTML = html + '<div class="pk-price-loading">Gõ tên ở ô trên hoặc chọn Nhóm sản phẩm để hiện danh sách tên.</div>';
      _bindBuilder_(dyn, null); return;
    }
    const nameMap = {};
    pool2.forEach((it) => _itemNames_(it).forEach((nm) => { const f = _fold_(nm); if (!nameMap[f]) nameMap[f] = nm; }));
    const names = Object.keys(nameMap).map((f) => nameMap[f]).sort(_vnSort_);
    if (_bld.ten && !nameMap[_fold_(_bld.ten)]) _bld.ten = '';
    if (!_bld.ten && names.length === 1) _bld.ten = names[0];
    html += row(`Tên sản phẩm (${names.length})`, `<select id="pkb-ten"><option value="">— Chọn —</option>${names.map((n) => opt(n, n, n === _bld.ten)).join('')}</select>`);

    if (_bld.ten) {
      const tf = _fold_(_bld.ten);
      const poolT = pool2.filter((it) => _itemNames_(it).some((nm) => _fold_(nm) === tf));

      // 3) Kiểu / Size
      const sizeVal = (it) => it.s || '__def__';
      const sizes = [...new Set(poolT.map(sizeVal))].sort(_vnSort_);
      if (_bld.size && sizes.indexOf(_bld.size) === -1) _bld.size = '';
      if (!_bld.size && sizes.length === 1) _bld.size = sizes[0];
      html += row(`Kiểu / Size (${sizes.length})`, `<select id="pkb-size"><option value="">— Chọn —</option>${sizes.map((v) => opt(v, v === '__def__' ? '(mặc định)' : v, v === _bld.size)).join('')}</select>`);

      if (_bld.size) {
        const poolS = poolT.filter((it) => sizeVal(it) === _bld.size);
        // 4) Chất liệu (chỉ hiện khi sheet có ghi chất liệu)
        const clVal = (it) => it.c || '__none__';
        const cls = [...new Set(poolS.map(clVal))].sort(_vnSort_);
        if (_bld.cl && cls.indexOf(_bld.cl) === -1) _bld.cl = '';
        if (!_bld.cl && cls.length === 1) _bld.cl = cls[0];
        if (cls.length > 1 || (cls.length === 1 && cls[0] !== '__none__')) {
          html += row(`Chất liệu (${cls.length})`, `<select id="pkb-cl"><option value="">— Chọn —</option>${cls.map((v) => opt(v, v === '__none__' ? '(không ghi)' : v, v === _bld.cl)).join('')}</select>`);
        }
        if (_bld.cl) {
          const cands = poolS.filter((it) => clVal(it) === _bld.cl);
          // 5) Còn nhiều dòng khác giá → Sale tự tích đúng dòng
          const distinct = new Set(cands.map(_priceOfItem_));
          if (cands.length > 1 && distinct.size > 1) {
            html += row('Chọn đúng mức giá', `<select id="pkb-cand"><option value="">— Chọn —</option>${cands.map((it, i) => opt(String(i), (_priceOfItem_(it) ? _priceOfItem_(it).toLocaleString('vi-VN') + 'k' : 'chưa có giá') + ' — ' + (it.t || it.m), String(i) === String(_bld.cand))).join('')}</select>`);
            cand = cands[Number(_bld.cand)] || null;
          } else {
            cand = cands[0] || null;
          }
        }
      }
    }

    if (cand) {
      const autoK = _priceOfItem_(cand);
      if (!_bld.priceEdited) _bld.priceK = autoK ? String(autoK) : '';
      html += row('Màu (ghi chú, bỏ trống được)', `<select id="pkb-mau"><option value="">— Bỏ trống —</option>${PK_COLOR_OPTS.map((c) => opt(c, c, c === _bld.mau)).join('')}</select>`);
      html += row('Đậm / nhạt', `<select id="pkb-dam"><option value="">— Bỏ trống —</option>${PK_SHADE_OPTS.map((c) => opt(c, c, c === _bld.dam)).join('')}</select>`);
      html += `<div class="pk-builder-inline">
        <div><label>Số lượng</label><input type="number" id="pkb-qty" min="1" value="${escapeHtml(_bld.qty)}" /></div>
        <div><label>Giá (nghìn đ) — ${escapeHtml(_stoneLabel_(cand))}</label><input type="number" id="pkb-price" min="0" value="${escapeHtml(_bld.priceK)}" placeholder="tự nhập nếu chưa có giá" /></div>
      </div>`;
      html += `<div class="pk-builder-inline">
        <div><label>CTKM cho sản phẩm này</label><select id="pkb-promotype">
          ${opt('none', 'Không', _bld.promoType === 'none')}${opt('amount', 'Giảm tiền (k)', _bld.promoType === 'amount')}${opt('percent', 'Giảm %', _bld.promoType === 'percent')}${opt('gift', 'Tặng quà', _bld.promoType === 'gift')}
        </select></div>
        <div id="pkb-promoval-wrap" style="${_bld.promoType === 'none' ? 'display:none' : ''}"><label>&nbsp;</label><input type="text" id="pkb-promoval" value="${escapeHtml(_bld.promoVal)}" placeholder="${_bld.promoType === 'gift' ? 'Quà tặng (VD: dây đeo)' : (_bld.promoType === 'percent' ? '% giảm' : 'Số tiền giảm (k)')}" /></div>
      </div>`;
      html += `<div class="pk-builder-summary"><div id="pkb-line-total"></div><button id="pkb-add-btn" class="pk-price-addbtn">+ Thêm vào đơn</button></div>`;
    }
    dyn.innerHTML = html;
    _bindBuilder_(dyn, cand);
    if (cand) _refreshBldTotal_();
  }

  function _refreshBldTotal_() {
    const el = panelEl.querySelector('#pkb-line-total');
    if (!el) return;
    const qty = Math.max(1, Number(_bld.qty) || 1);
    const base = qty * (Number(_bld.priceK) || 0) * 1000;
    const total = _applyPromo_(base, _bld.promoType, _bld.promoVal);
    el.innerHTML = `Thành tiền: <b>${total.toLocaleString('vi-VN')}đ</b>` +
      (total !== base ? ` <span class="pk-builder-was">(trước CTKM ${base.toLocaleString('vi-VN')}đ)</span>` : '') +
      (_bld.promoType === 'gift' && _bld.promoVal ? ` · 🎁 ${escapeHtml(_bld.promoVal)}` : '');
  }

  function _bindBuilder_(dyn, cand) {
    const on = (id, fn) => { const el = dyn.querySelector('#' + id); if (el) el.addEventListener('change', fn); };
    on('pkb-nhom', (e) => { _bld.nhom = e.target.value; _bld.ten = ''; _bld.size = ''; _bld.cl = ''; _bld.cand = ''; _bld.priceEdited = false; renderBuilderDyn_(); });
    on('pkb-ten', (e) => { _bld.ten = e.target.value; _bld.size = ''; _bld.cl = ''; _bld.cand = ''; _bld.priceEdited = false; renderBuilderDyn_(); });
    on('pkb-size', (e) => { _bld.size = e.target.value; _bld.cl = ''; _bld.cand = ''; _bld.priceEdited = false; renderBuilderDyn_(); });
    on('pkb-cl', (e) => { _bld.cl = e.target.value; _bld.cand = ''; _bld.priceEdited = false; renderBuilderDyn_(); });
    on('pkb-cand', (e) => { _bld.cand = e.target.value; _bld.priceEdited = false; renderBuilderDyn_(); });
    on('pkb-mau', (e) => { _bld.mau = e.target.value; });
    on('pkb-dam', (e) => { _bld.dam = e.target.value; });
    on('pkb-promotype', (e) => { _bld.promoType = e.target.value; _bld.promoVal = ''; renderBuilderDyn_(); });
    const typing = (id, fn) => { const el = dyn.querySelector('#' + id); if (el) el.addEventListener('input', (e) => { fn(e.target.value); _refreshBldTotal_(); }); };
    typing('pkb-qty', (v) => { _bld.qty = v; });
    typing('pkb-price', (v) => { _bld.priceK = v; _bld.priceEdited = v !== ''; }); // xoá trống → quay lại giá tự động
    typing('pkb-promoval', (v) => { _bld.promoVal = v; });
    const addBtn = dyn.querySelector('#pkb-add-btn');
    if (addBtn && cand) addBtn.addEventListener('click', () => {
      const qty = Math.max(1, Number(_bld.qty) || 1);
      const type = _bld.promoType;
      addToCart_({
        name: _bld.ten,
        note: '',
        price: (Number(_bld.priceK) || 0) * 1000,
        chatLieu: cand.c || '',
        mauSac: [_bld.mau, _bld.dam].filter(Boolean).join(' '),
        size: cand.s || '',
        qty,
        promoType: type,
        promoValue: type === 'gift' ? String(_bld.promoVal || '').trim() : (type === 'none' ? '' : (Number(_bld.promoVal) || 0))
      });
      setStatus('✅ Đã thêm "' + _bld.ten + '" vào đơn — chọn tiếp sản phẩm tiếp theo.');
      _bld = _bldBlank_();
      const q = panelEl.querySelector('#pkb-q'); if (q) q.value = '';
      if (_flatMode === 'live') _flatItems = [];
      renderBuilderDyn_();
    });
  }

  // ══════════════════════════════ ĐƠN HÀNG ĐANG TÍNH (giỏ tạm) ══════════════════════════════
  // Muc dich: sale tra cuu nhieu san pham lien tuc, bam "+ Them" tung san pham vao 1 danh sach
  // tam, tick chon/sua so luong/gia, sai thi xoa hoac them dong thu cong — he thong tu cong
  // tong thanh 1 don gom nhung gi bao nhieu tien, kem qua tang/giam gia/freeship.
  // Luu theo TUNG SDT khach (chrome.storage.local, rieng may nay) de doi qua lai giua cac
  // doan chat khac nhau khong bi lan/mat don dang tinh do.
  let _cartItems = [];
  let _cartExtra = { gift: '', discountType: 'none', discountValue: 0, freeship: false, gold: 0, priceInK: false };
  let _cartLoadedFor = null;

  function _cartKey_(phone) { return 'pkCart_' + (phone || '_no_phone_'); }

  function loadCartForCurrentPhone_() {
    const key = _cartKey_(_currentPhone);
    if (_cartLoadedFor === key) { renderCart_(); return; }
    chrome.storage.local.get([key], (res) => {
      const saved = res[key] || { items: [], extra: { gift: '', discountType: 'none', discountValue: 0, freeship: false, gold: 0 } };
      _cartItems = saved.items || [];
      _cartExtra = Object.assign({ gift: '', discountType: 'none', discountValue: 0, freeship: false, gold: 0, priceInK: false }, saved.extra || {});
      _cartLoadedFor = key;
      renderCart_();
    });
  }

  function saveCart_() {
    const key = _cartKey_(_currentPhone);
    chrome.storage.local.set({ [key]: { items: _cartItems, extra: _cartExtra } });
  }

  function addToCart_(item) {
    // Neu Chat lieu la 1 o gom nhieu lua chon danh so chung (vd "1. X 2. Y 3. Z") thi tach rieng
    // thanh danh sach de Sale TICK CHON tung cai (co the chon nhieu) thay vi nhet ca cum cho khach.
    // Chua chon gi -> chatLieu de trong (khong con mac dinh nhet nguyen chuoi tho nhu truoc).
    const clOptions = _parseNumberedList_(item.chatLieu);
    _cartItems.push({
      id: 'ci_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: item.name || '(chưa đặt tên)',
      note: item.note || '',
      qty: item.qty || 1,
      price: item.price || 0,
      chatLieu: clOptions ? '' : (item.chatLieu || ''),
      chatLieuOptions: clOptions || null,
      mauSac: item.mauSac || '',
      size: item.size || '',
      promoType: item.promoType || 'none',   // CTKM riêng của dòng: none | amount (k) | percent | gift
      promoValue: item.promoValue === undefined ? '' : item.promoValue,
      checked: true
    });
    saveCart_();
    renderCart_();
  }

  function renderCart_() {
    const section = panelEl.querySelector('#pk-cart-section');
    if (!section) return;
    if (_cartItems.length) section.dataset.everOpened = '1';
    section.style.display = (_cartItems.length || section.dataset.everOpened) ? 'block' : 'none';
    panelEl.querySelector('#pk-cart-count').textContent = _cartItems.filter(i => i.checked).length;

    const list = panelEl.querySelector('#pk-cart-list');
    list.innerHTML = _cartItems.map((it) => {
      // Neu day la dong co Chat lieu duoc tach tu 1 o gom nhieu lua chon (xem _parseNumberedList_
      // trong addToCart_), hien checkbox tick tung lua chon (duoc tick nhieu) thay vi 1 o text
      // nhet nguyen chuoi. Dong nhap thu cong / chat lieu don gian (vd "VÀNG 10K") van la o text
      // nhu cu — khong ep phai co danh sach khi khong can.
      const selectedCl = new Set((it.chatLieu || '').split(',').map((s) => s.trim()).filter(Boolean));
      const chatLieuHtml = (it.chatLieuOptions && it.chatLieuOptions.length)
        ? `<div class="pk-cart-chatlieu-multi">
            <div class="pk-cl-multi-label">Chất liệu (tick 1 hoặc nhiều):</div>
            ${it.chatLieuOptions.map((opt) => `
              <label class="pk-cl-opt">
                <input type="checkbox" class="pk-cl-opt-chk" data-opt="${escapeHtml(opt)}" ${selectedCl.has(opt) ? 'checked' : ''} />
                <span>${escapeHtml(opt)}</span>
              </label>`).join('')}
          </div>`
        : `<input type="text" class="pk-cart-chatlieu" value="${escapeHtml(it.chatLieu || '')}" placeholder="Chất liệu" />`;
      return `
      <div class="pk-cart-row" data-id="${it.id}">
        <input type="checkbox" class="pk-cart-chk" ${it.checked ? 'checked' : ''} />
        <input type="text" class="pk-cart-name" value="${escapeHtml(it.name)}" placeholder="Tên sản phẩm" />
        <input type="number" class="pk-cart-qty" value="${it.qty}" min="1" title="Số lượng" />
        <input type="number" class="pk-cart-price" value="${_cartExtra.priceInK ? (it.price ? it.price / 1000 : '') : it.price}" min="0" title="${_cartExtra.priceInK ? 'Đơn giá (nghìn đ — gõ 2800 = 2.800.000đ)' : 'Đơn giá (đ)'}" />
        <button class="pk-cart-del" title="Xoá dòng này">✕</button>
        <div class="pk-cart-detail-row">
          ${chatLieuHtml}
          <input type="text" class="pk-cart-mausac" value="${escapeHtml(it.mauSac || '')}" placeholder="Màu sắc" />
          <input type="text" class="pk-cart-size" value="${escapeHtml(it.size || '')}" placeholder="Size" />
        </div>
        <div class="pk-cart-promo-row">
          <select class="pk-cart-promotype" title="CTKM riêng cho sản phẩm này">
            <option value="none"${(it.promoType || 'none') === 'none' ? ' selected' : ''}>CTKM: không</option>
            <option value="amount"${it.promoType === 'amount' ? ' selected' : ''}>Giảm tiền (k)</option>
            <option value="percent"${it.promoType === 'percent' ? ' selected' : ''}>Giảm %</option>
            <option value="gift"${it.promoType === 'gift' ? ' selected' : ''}>Tặng quà</option>
          </select>
          <input type="text" class="pk-cart-promoval" value="${escapeHtml(it.promoValue === undefined ? '' : it.promoValue)}" placeholder="${it.promoType === 'gift' ? 'Quà tặng' : (it.promoType === 'percent' ? '% giảm' : 'Số tiền (k)')}" style="${(!it.promoType || it.promoType === 'none') ? 'display:none' : ''}" />
          <span class="pk-cart-linetotal"></span>
        </div>
        ${it.note ? `<div class="pk-cart-note">${escapeHtml(it.note)}</div>` : ''}
      </div>
    `;
    }).join('') || '<div class="pk-cart-empty">Chưa có sản phẩm nào. Dùng tab "Soạn đơn" hoặc "+ Thêm" ở kết quả tra giá phía trên, hoặc "+ Thêm dòng thủ công".</div>';

    list.querySelectorAll('.pk-cl-opt-chk').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const rowEl = e.target.closest('.pk-cart-row');
        const id = rowEl.dataset.id;
        const checkedOpts = [...rowEl.querySelectorAll('.pk-cl-opt-chk:checked')].map((c) => c.dataset.opt);
        _updateCartItem_(id, 'chatLieu', checkedOpts.join(', '), true);
        saveCart_();
      });
    });

    list.querySelectorAll('.pk-cart-row').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('.pk-cart-chk').addEventListener('change', (e) => { _updateCartItem_(id, 'checked', e.target.checked); saveCart_(); });
      const nameEl = row.querySelector('.pk-cart-name');
      nameEl.addEventListener('input', (e) => { _updateCartItem_(id, 'name', e.target.value, true); });
      nameEl.addEventListener('change', () => { saveCart_(); });
      const chatLieuEl = row.querySelector('.pk-cart-chatlieu');
      if (chatLieuEl) {
        chatLieuEl.addEventListener('input', (e) => { _updateCartItem_(id, 'chatLieu', e.target.value, true); });
        chatLieuEl.addEventListener('change', () => { saveCart_(); });
      }
      const mauSacEl = row.querySelector('.pk-cart-mausac');
      mauSacEl.addEventListener('input', (e) => { _updateCartItem_(id, 'mauSac', e.target.value, true); });
      mauSacEl.addEventListener('change', () => { saveCart_(); });
      const sizeEl = row.querySelector('.pk-cart-size');
      sizeEl.addEventListener('input', (e) => { _updateCartItem_(id, 'size', e.target.value, true); });
      sizeEl.addEventListener('change', () => { saveCart_(); });
      const qtyEl = row.querySelector('.pk-cart-qty');
      qtyEl.addEventListener('input', (e) => { _updateCartItem_(id, 'qty', Math.max(1, Number(e.target.value) || 1), true); });
      qtyEl.addEventListener('change', () => { saveCart_(); });
      const priceEl = row.querySelector('.pk-cart-price');
      priceEl.addEventListener('input', (e) => {
        const raw = Math.max(0, Number(e.target.value) || 0);
        const price = _cartExtra.priceInK ? raw * 1000 : raw; // toggle "nhap gia theo nghin" — luon luu du.lieu goc bang dong day du
        _updateCartItem_(id, 'price', price, true);
      });
      priceEl.addEventListener('change', () => { saveCart_(); });
      row.querySelector('.pk-cart-promotype').addEventListener('change', (e) => {
        _updateCartItem_(id, 'promoType', e.target.value); _updateCartItem_(id, 'promoValue', '');
        saveCart_(); renderCart_();
      });
      const promoValEl = row.querySelector('.pk-cart-promoval');
      promoValEl.addEventListener('input', (e) => {
        const it2 = _cartItems.find((x) => x.id === id);
        _updateCartItem_(id, 'promoValue', it2 && it2.promoType === 'gift' ? e.target.value : (Number(e.target.value) || 0), true);
      });
      promoValEl.addEventListener('change', () => { saveCart_(); });
      row.querySelector('.pk-cart-del').addEventListener('click', () => {
        _cartItems = _cartItems.filter((x) => x.id !== id);
        saveCart_(); renderCart_();
      });
    });

    panelEl.querySelector('#pk-cart-gift').value = _cartExtra.gift || '';
    panelEl.querySelector('#pk-cart-discount-type').value = _cartExtra.discountType || 'none';
    panelEl.querySelector('#pk-cart-discount-value').value = _cartExtra.discountValue || '';
    panelEl.querySelector('#pk-cart-discount-value').style.display = _cartExtra.discountType === 'none' ? 'none' : '';
    panelEl.querySelector('#pk-cart-freeship').checked = !!_cartExtra.freeship;
    panelEl.querySelector('#pk-cart-gold').value = _cartExtra.gold || '';
    panelEl.querySelector('#pk-cart-price-k').checked = !!_cartExtra.priceInK;

    _renderCartTotal_();
  }

  // skipSave = true khi dang go (input) -> khong ghi storage lien tuc, doi blur/change moi luu de do nang
  function _updateCartItem_(id, field, value, deferSave) {
    const it = _cartItems.find((x) => x.id === id);
    if (!it) return;
    it[field] = value;
    if (!deferSave) { saveCart_(); }
    _renderCartTotal_();
    panelEl.querySelector('#pk-cart-count').textContent = _cartItems.filter(i => i.checked).length;
  }

  // Thành tiền 1 dòng = số lượng × đơn giá, rồi trừ CTKM riêng của dòng (giảm tiền k / giảm % / tặng quà không đổi tiền)
  function _lineTotal_(i) {
    const base = (Number(i.qty) || 0) * (Number(i.price) || 0);
    return _applyPromo_(base, i.promoType, i.promoValue);
  }

  // Tính tổng cả đơn: tạm tính (đã trừ CTKM từng dòng) − giảm giá chung + tiền vàng + ship (40k nếu không Freeship)
  function _cartTotals_() {
    const checked = _cartItems.filter((i) => i.checked);
    const subtotal = checked.reduce((s, i) => s + _lineTotal_(i), 0);
    let discountAmt = 0;
    if (_cartExtra.discountType === 'percent') discountAmt = Math.round(subtotal * (Number(_cartExtra.discountValue) || 0) / 100);
    else if (_cartExtra.discountType === 'amount') discountAmt = Number(_cartExtra.discountValue) || 0;
    discountAmt = Math.min(discountAmt, subtotal);
    const gold = (Number(_cartExtra.gold) || 0) * 1000;
    const ship = _cartExtra.freeship ? 0 : PK_SHIP_FEE;
    const total = subtotal - discountAmt + gold + ship;
    return { checked, subtotal, discountAmt, gold, ship, total };
  }

  function _renderCartTotal_() {
    const t = _cartTotals_();
    const fmt = (n) => n.toLocaleString('vi-VN') + 'đ';
    // cập nhật thành tiền từng dòng
    panelEl.querySelectorAll('#pk-cart-list .pk-cart-row').forEach((rowEl) => {
      const it = _cartItems.find((x) => x.id === rowEl.dataset.id);
      const el = rowEl.querySelector('.pk-cart-linetotal');
      if (it && el) el.textContent = '= ' + fmt(_lineTotal_(it)) + (it.promoType === 'gift' && it.promoValue ? ' 🎁' : '');
    });
    panelEl.querySelector('#pk-cart-total').innerHTML =
      `<div>Tạm tính (${t.checked.length} sản phẩm): <b>${fmt(t.subtotal)}</b></div>` +
      (t.discountAmt > 0 ? `<div>Giảm giá chung: <b>-${fmt(t.discountAmt)}</b></div>` : '') +
      (t.gold > 0 ? `<div>Thêm vàng: <b>+${fmt(t.gold)}</b></div>` : '') +
      `<div>Phí ship: <b>${t.ship ? '+' + fmt(t.ship) : 'Miễn phí'}</b></div>` +
      `<div class="pk-cart-total-final">Tổng đơn: <b>${fmt(t.total)}</b>${_cartExtra.freeship ? ' <span class="pk-cart-freeship-tag">Freeship</span>' : ''}</div>`;
  }

  // Đơn để copy gửi khách, theo mẫu:
  //   1. 1 nhẫn tỳ hưu TL size 1 chất liệu lam thủy màu vàng nhạt giá 6.350k
  //   2. 1 lắc tỳ hưu truyền thống ... giá 10.550k
  //   3. miễn phí ship, tổng đơn 16.900k
  // Mỗi dòng đều qua sanitizeProductName_ (sheet "Lưu ý từ cấm") để không dính từ cấm.
  function _buildCartSummaryText_() {
    const t = _cartTotals_();
    const k = (n) => (n / 1000).toLocaleString('vi-VN') + 'k';
    const clean = (str) => sanitizeProductName_(str);
    const lines = t.checked.map((i) => {
      const qty = Number(i.qty) || 1;
      const size = (i.size && i.size !== '(mặc định)') ? ' ' + String(i.size).toLowerCase() : '';
      const cl = i.chatLieu ? ' chất liệu ' + String(i.chatLieu).toLowerCase() : '';
      const mau = i.mauSac ? ' màu ' + String(i.mauSac).toLowerCase() : '';
      let promo = '';
      if (i.promoType === 'amount' && Number(i.promoValue)) promo = ` (đã giảm ${Number(i.promoValue).toLocaleString('vi-VN')}k)`;
      else if (i.promoType === 'percent' && Number(i.promoValue)) promo = ` (đã giảm ${Number(i.promoValue)}%)`;
      else if (i.promoType === 'gift' && i.promoValue) promo = ` + tặng ${i.promoValue}`;
      // tên hạ chữ thường TRƯỚC khi sanitize để các viết tắt (TL, lpt) giữ nguyên
      return clean(`${qty} ${String(i.name || '').toLowerCase().replace(/^trang sức\s+/, '')}${size}${cl}${mau} giá ${k(_lineTotal_(i))}${promo}`);
    });
    const extra = [];
    if (t.gold > 0) extra.push(`thêm vàng ${k(t.gold)}`);
    if (t.discountAmt > 0) extra.push(`giảm thêm ${k(t.discountAmt)}`);
    if (_cartExtra.gift) extra.push(`tặng kèm ${_cartExtra.gift}`);
    extra.push(t.ship ? `phí ship ${k(t.ship)}, tổng đơn ${k(t.total)}` : `miễn phí ship, tổng đơn ${k(t.total)}`);
    const all = lines.concat(extra.map(clean));
    return all.map((l, idx) => `${idx + 1}. ${l}`).join('\n');
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
          withProducts: _useProducts,
          stonePref: _stonePref
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
          { type: "FETCH_OPENER", payload: { custLines, tone: _activeTone, angleInstr: angle.instr, withProducts: _useProducts, stonePref: _stonePref } },
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

  function renderCannedList_() {
    if (!IS_PHONGTHUY || !panelEl) return;
    const box = panelEl.querySelector('#pk-canned-body');
    if (!box) return;
    const groups = {};
    _cannedResponses.forEach(c => { (groups[c.nhom] = groups[c.nhom] || []).push(c); });
    box.innerHTML = Object.keys(groups).map(nhom =>
      `<div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;margin:6px 0 3px">${escapeHtml(nhom)}</div>` +
      groups[nhom].map(c =>
        `<div class="pk-ai-suggestion-item" data-cid="${escapeHtml(c.id)}" title="Bấm để chèn vào ô trả lời — chỗ $$ cần tự điền tay">` +
        `<b>${escapeHtml(c.label)}</b><br>${escapeHtml(c.text.length > 90 ? c.text.slice(0, 90) + '…' : c.text)}</div>`
      ).join('')
    ).join('');
    box.querySelectorAll('[data-cid]').forEach(el => {
      el.addEventListener('click', () => {
        const c = _cannedResponses.find(x => x.id === el.dataset.cid);
        if (c) insertReply(c.text); // dung lai HAM CO SAN — tu dong xu ly ca contenteditable (Messenger) lan textarea
      });
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

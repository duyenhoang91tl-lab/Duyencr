// content.js — chạy trong trang pos.pancake.vn / pages.fm / messenger.com
// Hiện panel nổi gợi ý trả lời AI, đọc hội thoại theo selector đã cấu hình trong Options.

(function () {
  const PLATFORM = detectPlatform();
  let settings = null;
  let panelEl = null;
  let lastConversationSignature = "";

  init();

  async function init() {
    settings = await getSettings();
    if (!settings.enabled || !settings.platform[PLATFORM]) return;

    injectPanel();
    observeConversationChanges();
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
        <div id="pk-ai-customer"></div>
        <div id="pk-ai-phone-row">
          <input type="text" id="pk-ai-phone-input" placeholder="SĐT khách (nếu không tự nhận ra)" />
          <button id="pk-ai-phone-btn">Tra cứu</button>
        </div>
        <div id="pk-ai-status">Chưa có hội thoại nào được chọn.</div>
        <div id="pk-ai-suggestions"></div>
        <button id="pk-ai-refresh">Lấy gợi ý mới</button>
      </div>
    `;
    document.body.appendChild(panelEl);

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

  function requestCustomerLookup() {
    const phone = extractPhone();
    if (!phone) {
      panelEl.querySelector("#pk-ai-customer").innerHTML = "";
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
      renderCustomerCard(phone, resp.data);
    });
  }

  function renderCustomerCard(phone, data) {
    const box = panelEl.querySelector("#pk-ai-customer");
    const { care, orders } = data;

    if (!care && (!orders || !orders.length)) {
      box.innerHTML = `<div class="pk-ai-cust-card pk-ai-cust-empty">⚠️ ${phone} — chưa có trong hệ thống Sasum.</div>`;
      return;
    }

    const name = (orders && orders[0] && orders[0].name) || (care && care.name) || phone;
    const totalRevenue = (orders || []).reduce((s, o) => s + (parseFloat(o.revenue) || 0), 0);
    const products = [...new Set((orders || []).map((o) => o.product).filter(Boolean))].slice(0, 4).join(", ");

    const chips = [];
    if (orders?.length) chips.push(`📦 ${orders.length} đơn`);
    if (totalRevenue) chips.push(`💰 ${Math.round(totalRevenue / 1000)}K`);
    if (care?.status) chips.push(`📋 ${escapeHtml(care.status)}`);
    if (care?.cs) chips.push(`👤 ${escapeHtml(care.cs)}`);

    box.innerHTML = `
      <div class="pk-ai-cust-card">
        <div class="pk-ai-cust-name">${escapeHtml(name)} <span class="pk-ai-cust-phone">${phone}</span></div>
        <div class="pk-ai-cust-chips">${chips.map((c) => `<span class="pk-ai-chip">${c}</span>`).join("")}</div>
        ${products ? `<div class="pk-ai-cust-products">🏷 ${escapeHtml(products)}</div>` : ""}
        ${care?.note ? `<div class="pk-ai-cust-note">📝 ${escapeHtml(String(care.note).slice(-200))}</div>` : ""}
      </div>
    `;
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
      // Không thể biết chắc ai là người gửi nếu chưa cấu hình class riêng —
      // để đơn giản, gửi toàn bộ text theo thứ tự, backend/RAG có thể tự suy luận theo ngữ cảnh.
      messages.push({ from: "unknown", text });
    });
    // chỉ lấy tối đa 20 tin gần nhất để tránh payload quá lớn
    return messages.slice(-20);
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

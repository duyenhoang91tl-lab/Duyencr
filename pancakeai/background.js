// background.js — Service worker (MV3)
// Gọi thẳng backend Google Apps Script (GAS_URL) đang dùng chung với Zalo AI (Sasum) —
// KHÔNG có server Flask/RAG riêng, mọi request đi qua 1 Web App GAS, giống hệt cách
// content.js của Zalo AI đang gọi: POST { action:'ai', prompt, withProducts }.

const DEFAULT_SETTINGS = {
  gasUrl: "", // dán URL Web App GAS (giống ô "URL Web App GAS" trong extension Zalo AI)
  enabled: true,
  csName: "", // CS đang dùng máy này — ghi vào cột 'cs' khi lưu, giống ô CS sticky bên Zalo AI
  useProducts: false, // tương ứng checkbox "Tra cứu sản phẩm" bên Zalo AI
  platform: {
    pancake: true,
    messenger: true
  },
  selectors: {
    pancake: {
      messageList: "",
      messageItem: "",
      replyBox: "",
      phoneSelector: "",
      customerMsgSelector: "",
      agentMsgSelector: ""
    },
    messenger: {
      // Messenger dùng role/aria-label khá ổn định hơn Pancake (ít đổi class ngẫu nhiên) —
      // để sẵn giá trị khởi điểm hợp lý, vẫn có thể ghi đè trong Options nếu Facebook đổi UI.
      messageList: "[role='main']",
      messageItem: "[role='row']",
      replyBox: "div[contenteditable='true'][role='textbox']",
      phoneSelector: "",
      customerMsgSelector: "",
      agentMsgSelector: ""
    }
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(null);
  if (!existing || Object.keys(existing).length === 0) {
    await chrome.storage.sync.set(DEFAULT_SETTINGS);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_SETTINGS") {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse({ ok: true, settings: { ...DEFAULT_SETTINGS, ...settings } });
    });
    return true;
  }

  if (msg?.type === "FETCH_SUGGESTION") {
    handleFetchSuggestion(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "LOOKUP_CUSTOMER") {
    handleLookupCustomer(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "SAVE_CARE") {
    handleSaveCare(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "GET_CS_NAMES") {
    handleGetCsNames()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Danh sach khach can nhac hen HOM NAY (doc tu cot 'Hẹn' trong CareData) — action:'reminders',
  // dung chung endpoint voi portal (index.html). Chi doc, khong ghi -> khong dung do voi Zalo AI/portal.
  if (msg?.type === "GET_REMINDERS") {
    handleGetReminders(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Soan tin follow-up chu dong cho 1 khach trong danh sach nhac hen (khac voi FETCH_SUGGESTION
  // la tra loi tin khach nhan toi) — dung chung action:'ai' nhung prompt khac.
  if (msg?.type === "FETCH_FOLLOWUP_SUGGESTION") {
    handleFetchFollowUpSuggestion(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }
});

// Tra cứu khách theo SĐT — GET GAS_URL?action=lookup&phone=... y hệt doLookup() bên Zalo AI.
// Trả về { care: {...}|null, orders: [...] }.
async function handleLookupCustomer(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };

  if (!cfg.gasUrl) {
    throw new Error("Chưa cấu hình URL Web App GAS.");
  }
  const phone = payload?.phone;
  if (!phone) {
    throw new Error("Không có số điện thoại để tra cứu.");
  }

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=lookup&phone=" + encodeURIComponent(phone);

  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const orders = (data.orders || []).slice().sort((a, b) => parseDateSafe(b.date) - parseDateSafe(a.date));
  return { care: data.care || null, orders };
}

// Ghi 1 dong care (status/zalo/cs/note/lich hen...) — action:'saveSingle', CUNG action va
// CUNG shape 'row' voi doSaveStatus() ben Zalo AI (content.js), de ghi dung 19 cot CareData.
// QUAN TRONG: content.js phia truoc PHAI tu dien day du cac truong khong sua (schedules,
// schedGoi..., nickZalos...) lay tu care hien tai — GAS se ghi DE TRONG cac cot nao thieu
// trong payload (xem careRow_ trong gas_v13.js), khong tu merge nhu 4 truong mo rong.
async function handleSaveCare(row) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  if (!row?.phone) throw new Error("Thiếu số điện thoại.");

  const res = await fetch(cfg.gasUrl, {
    method: "POST",
    body: JSON.stringify({ action: "saveSingle", row }),
    headers: { "Content-Type": "text/plain" }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// Lay danh sach ten CS — action:'users', dung chung voi Zalo AI (loadCSNames_ trong content.js)
async function handleGetCsNames() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) return [];

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const res = await fetch(cfg.gasUrl + sep + "action=users", { redirect: "follow" });
  const data = await res.json();
  if (!data.users) return [];
  return data.users
    .filter((u) => u.active !== false)
    .map((u) => u.username || u.name)
    .filter(Boolean);
}

function parseDateSafe(d) {
  const t = Date.parse(d);
  return isNaN(t) ? 0 : t;
}

// Gọi GAS action:'ai' — CÙNG payload shape với content.js của Zalo AI (_aiCall_),
// tự retry khi gặp lỗi 429 (Groq rate limit) giống hệt logic bên Zalo AI.
async function handleFetchSuggestion(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };

  if (!cfg.gasUrl) {
    throw new Error("Chưa cấu hình URL Web App GAS. Mở Options của extension và dán URL (giống ô cấu hình bên Zalo AI).");
  }

  const prompt = buildPrompt(payload);

  for (let attempt = 0; attempt <= 2; attempt++) {
    let res, data;
    try {
      res = await fetch(cfg.gasUrl, {
        method: "POST",
        body: JSON.stringify({ action: "ai", prompt, withProducts: !!cfg.useProducts }),
        headers: { "Content-Type": "text/plain" } // giống content.js Zalo AI — tránh preflight CORS
      });
      data = await res.json();
    } catch (e) {
      throw new Error("Không gọi được GAS: " + e.message);
    }

    if (data && data.ok) {
      // GAS trả về { ok:true, text:"...", provider:"...", image?: {name, base64, mimeType},
      // imageSkipped?: {name, reason} } — image chỉ có khi bật "Tra cứu sản phẩm" và tên 1 file
      // ảnh trong thư mục kiến thức Drive khớp từ khoá; imageSkipped báo trường hợp khớp tên
      // nhưng file >3MB nên GAS không đọc được — content.js hiện nút "Copy ảnh" hoặc cảnh báo tương ứng.
      return {
        suggestion: (data.text || "").trim(),
        provider: data.provider,
        image: data.image || null,
        imageSkipped: data.imageSkipped || null
      };
    }

    const err = String((data && data.error) || "Lỗi GAS không rõ nguyên nhân");
    if (err.indexOf("429") !== -1 && attempt < 2) {
      const m = err.match(/try again in ([0-9.]+)s/i);
      const waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1500 : 16000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    throw new Error(err);
  }
  throw new Error("Quá số lần thử lại (rate limit).");
}

// Ghép tin nhắn khách + ngữ cảnh nền tảng thành 1 prompt, cùng phong cách
// với doGenerate() bên Zalo AI content.js.
function buildPrompt(payload) {
  const platformLabel = payload.platform === "messenger" ? "Messenger" : "Pancake";
  const msgs = payload.messages || [];

  // Nếu content.js đã phân biệt được khách/nhân viên (đã cấu hình customerMsgSelector/
  // agentMsgSelector trong Options), gắn nhãn từng dòng để AI hiểu đúng ai nói gì —
  // không thì giữ nguyên định dạng cũ (chỉ nối text, không nhãn) để không đổi hành vi
  // với cấu hình cũ chưa có 2 selector này.
  const known = msgs.some((m) => m.from === "customer" || m.from === "agent");
  const msgText = known
    ? msgs
        .filter((m) => m.text)
        .map((m) => `${m.from === "agent" ? "CS" : m.from === "customer" ? "Khách" : "?"}: ${m.text}`)
        .join("\n")
    : msgs.map((m) => m.text).filter(Boolean).join("\n---\n");

  return (
    `[Kênh] ${platformLabel}\n` +
    `[TN khách] ${msgText}\n` +
    `Soạn 1 tin nhắn trả lời phù hợp, ngắn gọn, tiếng Việt tự nhiên.`
  );
}

// Danh sach nhac hen hom nay cho 1 CS — action:'reminders' (GET, chi doc, khong ghi gi).
// Backend tu loc theo ngay hom nay + gop trung SDT, xem action==='reminders' trong gas_v13.js.
async function handleGetReminders(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const cs = payload?.cs || cfg.csName || "";
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=reminders" + (cs ? "&cs=" + encodeURIComponent(cs) : "");
  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { reminders: data.reminders || [] };
}

// Soan tin follow-up chu dong cho 1 khach (khac voi tra loi tin khach nhan toi) — cung action:'ai'.
async function handleFetchFollowUpSuggestion(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const prompt =
    `SĐT: ${payload?.phone || ""}\n` +
    (payload?.status ? `Tình trạng CS: ${payload.status}\n` : "") +
    (payload?.note ? `Ghi chú lịch hẹn: ${payload.note}\n` : "") +
    `Soạn 1 tin nhắn hỏi thăm/follow-up chủ động, ngắn gọn, thân thiện, tiếng Việt tự nhiên để chủ động nhắn cho khách này hôm nay.`;

  for (let attempt = 0; attempt <= 2; attempt++) {
    let res, data;
    try {
      res = await fetch(cfg.gasUrl, {
        method: "POST",
        body: JSON.stringify({ action: "ai", prompt, withProducts: !!cfg.useProducts }),
        headers: { "Content-Type": "text/plain" }
      });
      data = await res.json();
    } catch (e) {
      throw new Error("Không gọi được GAS: " + e.message);
    }
    if (data && data.ok) return { suggestion: (data.text || "").trim(), provider: data.provider };
    const err = String((data && data.error) || "Lỗi GAS không rõ nguyên nhân");
    if (err.indexOf("429") !== -1 && attempt < 2) {
      const m = err.match(/try again in ([0-9.]+)s/i);
      const waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1500 : 16000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    throw new Error(err);
  }
  throw new Error("Quá số lần thử lại (rate limit).");
}

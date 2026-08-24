// background.js — Service worker (MV3)
// Gọi thẳng backend Google Apps Script (GAS_URL) đang dùng chung với Zalo AI (Sasum) —
// KHÔNG có server Flask/RAG riêng, mọi request đi qua 1 Web App GAS, giống hệt cách
// content.js của Zalo AI đang gọi: POST { action:'ai', prompt, withProducts }.

const DEFAULT_SETTINGS = {
  gasUrl: "", // dán URL Web App GAS (giống ô "URL Web App GAS" trong extension Zalo AI)
  enabled: true,
  useProducts: false, // tương ứng checkbox "Tra cứu sản phẩm" bên Zalo AI
  platform: {
    pancake: true,
    messenger: true
  },
  selectors: {
    pancake: {
      messageList: "",
      messageItem: "",
      replyBox: ""
    },
    messenger: {
      messageList: "",
      messageItem: "",
      replyBox: ""
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
      // GAS trả về { ok:true, text: "...", provider: "Groq"|"Cerebras"|"Gemini" }
      return { suggestion: (data.text || "").trim(), provider: data.provider };
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
  const msgText = (payload.messages || [])
    .map((m) => m.text)
    .filter(Boolean)
    .join("\n---\n");

  return (
    `[Kênh] ${platformLabel}\n` +
    `[TN khách] ${msgText}\n` +
    `Soạn 1 tin nhắn trả lời phù hợp, ngắn gọn, tiếng Việt tự nhiên.`
  );
}

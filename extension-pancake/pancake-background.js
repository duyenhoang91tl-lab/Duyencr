// background.js — Service worker (MV3)
// Gọi thẳng backend Google Apps Script (GAS_URL) của CRM Duyencr — KHÔNG dùng chung
// với link Sasum cũ nữa (2 hệ thống đã tách biệt hoàn toàn). Không có server Flask/RAG
// riêng, mọi request đi qua 1 Web App GAS: POST { action:'ai', prompt, withProducts }.

const OLD_SASUM_GAS_URL = "https://script.google.com/macros/s/AKfycbwPQ4HwD8R1HQFtU0xQslqGgr4HSlgzQlWFZs-8mtVY1CK9kBvwJWsIOzVuj6WM1mg-/exec";

const DEFAULT_SETTINGS = {
  gasUrl: "https://script.google.com/macros/s/AKfycbxyqBM3v7_WdgxbXru8o3Y_GNylTtQ-eeUoJCgwWEXVjHAJxiw7-SRlHXUSjaUR7v3oSQ/exec",
  enabled: true,
  csName: "", // CS đang dùng máy này — ghi vào cột 'cs' khi lưu, giống ô CS sticky bên Zalo AI
  useProducts: false, // tương ứng checkbox "Tra cứu sản phẩm" bên Zalo AI
  platform: {
    pancake: true,
    messenger: true
  },
  selectors: {
    pancake: {
      // Xac minh qua DevTools (F12) tren giao dien Pancake thuc te + nguoi dung xac nhan
      // truc tiep (2026-09-13): .body-conver-item la 1 dong tin nhan hoan chinh va no LUON
      // mang san class client-message/page-message ngay tren chinh no (khong phai o phan tu
      // con) — nen messageItem/customerMsgSelector/agentMsgSelector deu tro thang vao no de
      // el.matches() trong detectSender_ nhan dung. #message-col-list la vung chua toan bo
      // danh sach tin nhan cua cuoc hoi thoai dang mo (thay cho .mdl-js cu qua rong, ap dung
      // len ca <html> nen extractPhone() fallback quet nham toan trang).
      messageList: "#message-col-list",
      messageItem: ".body-conver-item",
      replyBox: "#replyBoxComposer",
      phoneSelector: "",
      orderPanelSelector: "",
      customerMsgSelector: ".body-conver-item.client-message",
      agentMsgSelector: ".body-conver-item.page-message"
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
  } else if (existing.gasUrl === OLD_SASUM_GAS_URL) {
    // Migrate: may nao lo con luu link Sasum cu -> tu dong chuyen sang link Duyencr moi.
    await chrome.storage.sync.set({ gasUrl: DEFAULT_SETTINGS.gasUrl });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "GET_SETTINGS") {
    chrome.storage.sync.get(null, (settings) => {
      sendResponse({ ok: true, settings: { ...DEFAULT_SETTINGS, ...settings } });
    });
    return true;
  }

  // Dung cho nut "Đặt lại về mặc định" trong Options — ghi de toan bo settings hien tai
  // bang DEFAULT_SETTINGS (GAS URL + selector da xac minh), khong can go/cai lai extension.
  if (msg?.type === "RESET_TO_DEFAULT") {
    chrome.storage.sync.set(DEFAULT_SETTINGS, () => {
      sendResponse({ ok: true, settings: DEFAULT_SETTINGS });
    });
    return true;
  }

  if (msg?.type === "FETCH_SUGGESTION") {
    handleFetchSuggestion(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Soan 1 trong 3 "cau mo dau" chu dong (goc nhin khac nhau) — giong het OPENER_ANGLES ben
  // Zalo AI. Dung khi CS muon chu dong nhan truoc cho khach (khong phai tra loi tin khach gui).
  if (msg?.type === "FETCH_OPENER") {
    handleFetchOpener(msg.payload)
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

  // Danh sach Nick Zalo dung chung ca team — dung chung setting 'nickZaloList' voi Zalo AI
  // (action:'getSetting'/key:'nickZaloList'), de 2 extension hien cung 1 danh sach nick.
  if (msg?.type === "GET_NICK_LIST") {
    handleGetNickList()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Them 1 nick moi vao danh sach dung chung (action:'addZaloNick' — GAS tu merge, khong ghi
  // de mat nick cu; neu GAS cu chua co action nay thi fallback doc-merge-ghi qua setSetting,
  // giong het logic ben Zalo AI).
  if (msg?.type === "ADD_NICK") {
    handleAddNick(msg.payload)
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

  // Tra cuu bang gia — action:'priceSearch', dung chung file PRICE_SS_ID (Sheet DANH_MUC).
  if (msg?.type === "GET_PRICE") {
    handleGetPrice(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Cay "Tinh trang CS" dong (co optgroup) — dung chung voi Zalo AI/appweb, de dropdown
  // Trang thai CS ben Pancake AI hien dung nhom giong het cac noi khac.
  if (msg?.type === "GET_CARE_STATUS_TREE") {
    handleGetCareStatusTree()
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

  const isNewCustomer = !!row.isNewCustomer;
  const cleanRow = Object.assign({}, row);
  delete cleanRow.isNewCustomer; // co chi de bao hieu noi bo, khong phai 1 cot CareData that

  const res = await fetch(cfg.gasUrl, {
    method: "POST",
    body: JSON.stringify({ action: "saveSingle", row: cleanRow }),
    headers: { "Content-Type": "text/plain" }
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  // Khách MỚI (nguồn "Chăm sóc") — ghi thêm vào sheet riêng "KH Chăm sóc mới" để tính vào
  // Báo cáo D, KHÔNG gộp báo cáo doanh số A/B/C (giống hệt luồng tương ứng bên Zalo AI).
  // Không để lỗi bước này chặn kết quả lưu chính.
  if (isNewCustomer && cleanRow.name) {
    try {
      await fetch(cfg.gasUrl, {
        method: "POST",
        body: JSON.stringify({ action: "addCareLead", phone: cleanRow.phone, name: cleanRow.name, note: cleanRow.note || '', cs: cleanRow.cs || '' }),
        headers: { "Content-Type": "text/plain" }
      });
    } catch (eLead) { /* khong chan ket qua luu chinh neu buoc nay loi */ }
  }

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

// Lay danh sach Nick Zalo dung chung ca team — action:'getSetting'&key='nickZaloList',
// dung chung setting voi Zalo AI (nickZaloList luu duoi dang JSON string).
async function handleGetNickList() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) return [];

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const res = await fetch(cfg.gasUrl + sep + "action=getSetting&key=nickZaloList", { redirect: "follow" });
  const data = await res.json();
  let list = [];
  if (data.value) { try { list = JSON.parse(data.value); } catch (e) {} }
  return Array.isArray(list) ? list : [];
}

// Cay "Tinh trang CS" dong tu GAS (dong bo voi appweb) — uu tien action:'getSetting'&key=
// 'careStatus'; neu setting rieng chua co thi fallback doc tu action:'customers' (field
// careStatus tra ve kem trong response) — CUNG LOGIC voi loadCareStatusTree_() ben Zalo AI.
async function handleGetCareStatusTree() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) return [];

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  let tree = null;
  try {
    const res = await fetch(cfg.gasUrl + sep + "action=getSetting&key=careStatus", { redirect: "follow" });
    const data = await res.json();
    if (data && data.value) {
      try { tree = typeof data.value === "string" ? JSON.parse(data.value) : data.value; } catch (e) {}
    }
  } catch (e) { /* thu fallback ben duoi */ }

  if (!Array.isArray(tree) || !tree.length) {
    try {
      const res = await fetch(cfg.gasUrl + sep + "action=customers", { redirect: "follow" });
      const data = await res.json();
      if (data && Array.isArray(data.careStatus) && data.careStatus.length) tree = data.careStatus;
    } catch (e) { /* het cach, tra ve mang rong -> content.js tu fallback ve CARE_STATUSES tinh */ }
  }
  return Array.isArray(tree) ? tree : [];
}

// Them 1 nick moi vao danh sach dung chung — uu tien action:'addZaloNick' (GAS tu merge vao
// danh sach chung, khong ghi de mat nick da co); neu ban GAS cu chua co action nay (loi tra
// ve) thi fallback: doc list moi nhat, tu merge, roi ghi lai qua setSetting — GIONG HET logic
// ben Zalo AI content.js (nzAddBtn handler) de 2 ben khong bao gio ghi de mat du lieu cua nhau.
async function handleAddNick(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const nick = (payload?.nick || "").trim();
  if (!nick) throw new Error("Tên nick trống.");

  try {
    const res = await fetch(cfg.gasUrl, {
      method: "POST",
      body: JSON.stringify({ action: "addZaloNick", nick }),
      headers: { "Content-Type": "text/plain" }
    });
    const data = await res.json();
    if (data && !data.error) return { list: await handleGetNickList() };
  } catch (e) { /* fallback bên dưới */ }

  const list = await handleGetNickList();
  if (!list.includes(nick)) list.push(nick);
  await fetch(cfg.gasUrl, {
    method: "POST",
    body: JSON.stringify({ action: "setSetting", key: "nickZaloList", value: JSON.stringify(list) }),
    headers: { "Content-Type": "text/plain" }
  });
  return { list };
}

function parseDateSafe(d) {
  const t = Date.parse(d);
  return isNaN(t) ? 0 : t;
}

// Goi GAS action:'ai' (co retry khi Groq bao 429/rate-limit) — dung chung cho ca tra loi tin
// khach lan "3 cau mo dau" lan follow-up, tranh lap code retry 3 lan rieng le.
async function callAiWithRetry_(gasUrl, prompt, withProducts) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    let res, data;
    try {
      res = await fetch(gasUrl, {
        method: "POST",
        body: JSON.stringify({ action: "ai", prompt, withProducts: !!withProducts }),
        headers: { "Content-Type": "text/plain" }
      });
      data = await res.json();
    } catch (e) {
      throw new Error("Không gọi được GAS: " + e.message);
    }
    if (data && data.ok) return data;
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

// Gọi GAS action:'ai' — CÙNG payload shape với content.js của Zalo AI (_aiCall_),
// tự retry khi gặp lỗi 429 (Groq rate limit) giống hệt logic bên Zalo AI.
async function handleFetchSuggestion(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };

  if (!cfg.gasUrl) {
    throw new Error("Chưa cấu hình URL Web App GAS. Mở Options của extension và dán URL (giống ô cấu hình bên Zalo AI).");
  }

  const prompt = buildPrompt(payload);
  const withProducts = payload?.withProducts !== undefined ? payload.withProducts : !!cfg.useProducts;
  const data = await callAiWithRetry_(cfg.gasUrl, prompt, withProducts);
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

// Ghép tin nhắn khách + ngữ cảnh + hồ sơ khách (custLines) + giọng văn thành 1 prompt —
// cùng cấu trúc với doGenerate()/buildCustLines() bên Zalo AI content.js, để 2 bên tư vấn
// nhất quán dựa trên cùng 1 kiểu prompt.
function buildPrompt(payload) {
  const platformLabel = payload.platform === "messenger" ? "Messenger" : "Pancake";
  const msgs = payload.messages || [];
  const tone = payload.tone || "Thân thiện";
  const custLines = payload.custLines || [];
  const context = (payload.context || "").trim();

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

  const lines = custLines.slice();
  if (context) lines.push(`Ngữ cảnh: ${context}`);
  const custBlock = lines.length ? `[KH] ${lines.join(" | ")}\n` : "";

  return (
    custBlock +
    `[Kênh] ${platformLabel}\n` +
    `[TN khách] ${msgText}\n` +
    `[Giọng văn] ${tone}\n` +
    `Soạn 1 tin nhắn trả lời phù hợp, ngắn gọn, tiếng Việt tự nhiên.`
  );
}

// Soạn 1 trong 3 "câu mở đầu" chủ động (góc nhìn khác nhau) — payload: {custLines, tone,
// angleInstr}. KHÔNG có [TN khách] vì đây là chủ động nhắn trước, không phải trả lời.
async function handleFetchOpener(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const custLines = payload?.custLines || [];
  const tone = payload?.tone || "Thân thiện";
  const angleInstr = payload?.angleInstr || "";
  const custBlock = custLines.length ? `[KH] ${custLines.join(" | ")}\n` : "";
  const prompt =
    custBlock +
    `[Giọng văn] ${tone}\n` +
    `Soạn 1 tin nhắn CHỦ ĐỘNG bắt chuyện với khách, theo hướng: ${angleInstr} ` +
    `Ngắn gọn, tự nhiên, tiếng Việt, không giống mẫu quảng cáo.`;

  const withProducts = payload?.withProducts !== undefined ? payload.withProducts : !!cfg.useProducts;
  const data = await callAiWithRetry_(cfg.gasUrl, prompt, withProducts);
  return { suggestion: (data.text || "").trim(), provider: data.provider };
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

  const data = await callAiWithRetry_(cfg.gasUrl, prompt, !!cfg.useProducts);
  return { suggestion: (data.text || "").trim(), provider: data.provider };
}

// Tra cuu bang gia theo tu khoa — action:'priceSearch' (GET, chi doc). Backend tu tim
// khong dau tren tat ca cot cua sheet DANH_MUC, tra ve toi da 50 dong khop.
async function handleGetPrice(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const q = payload?.q || "";
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=priceSearch" + (q ? "&q=" + encodeURIComponent(q) : "");
  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { rows: data.rows || [], total: data.total || 0 };
}

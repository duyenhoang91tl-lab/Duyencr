// background.js — Service worker (MV3)
// Gọi thẳng backend Google Apps Script (GAS_URL) của CRM Duyencr — KHÔNG dùng chung
// với link Sasum cũ nữa (2 hệ thống đã tách biệt hoàn toàn). Không có server Flask/RAG
// riêng, mọi request (trừ khi CS cấu hình "AI cá nhân" — xem callAI_ dưới) đi qua 1 Web App
// GAS: POST { action:'ai', prompt, withProducts }.

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
      // truc tiep (2026-09-26): Pancake da doi cau truc DOM tin nhan — .body-conver-item
      // (dung truoc 2026-09-13) KHONG CON nua. Cau truc moi (xac nhan bang anh chup DevTools
      // cho ca 2 chieu tin, khach va page):
      //   div.media-body
      //     div.media-body-text.media-message-from-customer(-.has-avatar) | .media-message-from-page
      //       div.message-text-field
      //         div.message-text-ele.client-message   <- tin cua KHACH (giu nguyen ten class)
      //         div.message-text-ele.page-message      <- tin cua PAGE/shop (giu nguyen ten class)
      // #message-col-list (vung chua toan bo list) KHONG doi, van dung. messageItem tro thang
      // vao .message-text-ele (khong phai .media-body ben ngoai) vi day la cap doi la noi mang
      // class client-message/page-message truc tiep tren chinh no — de el.matches() trong
      // detectSender_ nhan dung (neu messageItem la .media-body thi client-message/page-message
      // nam o phan tu con chau, el.matches() se luon fail va sender luon ra "unknown").
      messageList: "#message-col-list",
      messageItem: ".message-text-ele",
      replyBox: "#replyBoxComposer",
      phoneSelector: "",
      orderPanelSelector: "",
      // SĐT hiển thị trong khung "Thông tin" bên phải khi mở 1 đơn/hội thoại (class ổn định
      // "info-order" — KHÔNG dùng id kiểu "#copy-xxxx..." vì Pancake sinh ngẫu nhiên id đó
      // riêng cho từng khách, đổi khác mỗi lần mở khách khác).
      infoPanelSelector: ".info-order",
      customerMsgSelector: ".message-text-ele.client-message",
      agentMsgSelector: ".message-text-ele.page-message"
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
  if (msg?.type === "OPEN_OPTIONS") {
    // Content script khong duoc phep goi truc tiep chrome.runtime.openOptionsPage() — chi
    // background/extension pages moi co quyen nay, nen panel nho background mo ho.
    chrome.runtime.openOptionsPage();
    return false;
  }
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

  // Dung rieng cho trang Options — CS dan Provider/Key/Model (CHUA luu) vao form, bam nut
  // "🔍 Kiem tra Key" o do la toi thang day, goi 1 request that toi nha cung cap (KHONG qua
  // GAS, khong luu gi ca) voi 1 prompt ngan de bao ngay key co chay duoc khong, kem NGUYEN
  // VAN loi that tu nha cung cap neu sai (het quota/sai quyen/model bi doi ten...) — tu phuc
  // vu, khong phai doi den luc tra loi khach that moi biet key hong.
  if (msg?.type === "TEST_AI_KEY") {
    handleTestAiKey(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
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

  // 2 co Admin dieu khien truong "SDT Zalo" (khoa han / cho Sale tu them) — dung chung setting
  // voi appweb (zaloPhoneFieldLocked, zaloPhoneSaleCanAdd), doc 1 lan khi mo panel.
  if (msg?.type === "GET_ZALOPHONE_SETTINGS") {
    handleGetZaloPhoneSettings()
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

  // So lieu ca nhan cua CS (tong don, doanh thu, ty le chot, hoa hong, thuong) — action:'csStats' (GET, chi doc).
  if (msg?.type === "GET_CS_STATS") {
    handleGetCsStats(msg.payload)
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

  // Tra cuu CTKM (khuyen mai/giam gia) — action:'ctkmSearch', cung file PRICE_SS_ID (Sheet
  // CTKM), TRUC TIEP theo tu khoa, KHONG qua AI (giong het co che GET_PRICE o tren). Doi ten
  // rieng GET_CTKM_SEARCH (khong dung chung GET_CTKM) de khong dam voi kenh GET_CTKM da co san
  // (load nguyen van CTKM cho "Soan don", khong loc tu khoa) — 2 tinh nang khac muc dich.
  if (msg?.type === "GET_CTKM_SEARCH") {
    handleGetCtkmSearch(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Danh sach PHANG cho "Tim anh san pham" — action:'productImageFlat', cung co che voi
  // GET_PRICE_FLAT (cascading Nhom SP -> Ten SP -> Kieu/Size -> Chat lieu), kem link anh moi
  // dong de FE goi tiep GET_DRIVE_IMAGE khi CS da thu hep dung ve 1 dong.
  if (msg?.type === "GET_PRODUCT_IMAGE_FLAT") {
    handleGetProductImageFlat()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }
  // Doc 1 anh THEO DUNG link CS da chon (sau khi thu hep dan) — action:'driveImageFromLink'.
  if (msg?.type === "GET_DRIVE_IMAGE") {
    handleGetDriveImage(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Cay Nhom SP → Ten SP → Kieu/Size cho "Soan don" (bo loc dropdown nhieu tang thay vi go tim)
  // Danh muc PHANG (action priceCatalogFlat) cho "Soan don": go ten -> loc -> dropdown thu hep dan
  if (msg?.type === "GET_PRICE_FLAT") {
    handleGetPriceFlat()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  if (msg?.type === "GET_PRICE_TREE") {
    handleGetPriceTree()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // CTKM (sheet CTKM, cung file gia, nam ben canh sheet DANH_MUC) cho "Soan don": doc toan
  // bo cac chuong trinh khuyen mai dang co de CS xem/doi chieu khi len don.
  if (msg?.type === "GET_CTKM") {
    handleGetCtkm()
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

  // Truong tu tao (admin them ben app web chinh) — dung chung setting 'customFields' voi
  // khStatusTree/nickZaloList, KHONG can them action rieng o backend GAS.
  if (msg?.type === "GET_CUSTOM_FIELDS") {
    handleGetCustomFields()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Don gia 1 don vi "vang" trong gio hang Soan don — dung chung setting 'goldUnitAmount' voi
  // CRM (2 noi admin co the cai: gear Cai dat tren CRM, hoac Options cua extension nay).
  if (msg?.type === "GET_GOLD_UNIT") {
    handleGetGoldUnit()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Admin luu don gia vang tu trang Options — ghi chung setting GAS 'goldUnitAmount' voi CRM.
  if (msg?.type === "SET_GOLD_UNIT") {
    handleSetGoldUnit(msg.payload)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Bang tra menh + mau canned response phong thuy (chi dung tren Messenger/Thu Hien) —
  // action:'getKnowledge', doc/tu tao sheet Menh + CannedResponses rieng, KHONG dung cot CareData.
  if (msg?.type === "GET_KNOWLEDGE") {
    handleGetKnowledge()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }

  // Thu vien "Mau tin nhan tu van khach" (them 2026-10, theo yeu cau Duyen "crm + pancake ai")
  // — action:'messageTemplates', dung CHUNG 1 nguon voi form them/sua tren CRM (tab Zalo AI),
  // doc moi lan mo tab de luon thay ban moi nhat tu noi khac them vao.
  if (msg?.type === "GET_MESSAGE_TEMPLATES") {
    handleGetMessageTemplates()
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

// Danh sach "truong tu tao" (admin them ben app web chinh) — action:'getSetting'&key=
// 'customFields', CUNG co che voi khStatusTree/nickZaloList. Tra ve [] neu chua co gi.
async function handleGetCustomFields() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) return [];

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  try {
    const res = await fetch(cfg.gasUrl + sep + "action=getSetting&key=customFields", { redirect: "follow" });
    const data = await res.json();
    if (data && data.value) {
      const arr = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) { /* het cach, tra ve mang rong */ }
  return [];
}

// Don gia 1 don vi "vang" (d) trong gio hang "Soan don" — setting dung chung 'goldUnitAmount'
// voi CRM (admin cai o gear "Cai dat" trong Bao cao doanh so, HOAC ngay trong Options cua
// Pancake AI — ca 2 cung ghi/doc 1 key GAS nen chi can cai 1 cho la ap dung toan team).
async function handleGetGoldUnit() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) return 350000;

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  try {
    const res = await fetch(cfg.gasUrl + sep + "action=getSetting&key=goldUnitAmount", { redirect: "follow" });
    const data = await res.json();
    const n = Number(data?.value);
    if (n > 0) return n;
  } catch (e) { /* het cach, dung mac dinh */ }
  return 350000;
}

// Admin cai don gia vang truc tiep tu Options cua Pancake AI — ghi vao setting chung GAS
// 'goldUnitAmount' (setSetting), CUNG 1 key ma CRM doc/ghi, nen ap dung cho ca team ngay.
async function handleSetGoldUnit(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const n = Number(payload?.amount);
  if (!(n > 0)) throw new Error("Đơn giá vàng không hợp lệ.");
  await fetch(cfg.gasUrl, {
    method: "POST",
    body: JSON.stringify({ action: "setSetting", key: "goldUnitAmount", value: String(n) }),
    headers: { "Content-Type": "text/plain" }
  });
  return { amount: n };
}

// 2 co Admin dieu khien truong "SDT Zalo" (xem CARE_HEADERS trong gas_v13.js) — doc gop 1 lan
// 2 action:'getSetting' (zaloPhoneFieldLocked, zaloPhoneSaleCanAdd). Mac dinh: khong khoa,
// Sale duoc them (dung yeu cau ban dau) neu GAS chua tung luu setting nay.
async function handleGetZaloPhoneSettings() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) return { locked: false, saleCanAdd: true };
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  let locked = false, saleCanAdd = true;
  try {
    const r1 = await fetch(cfg.gasUrl + sep + "action=getSetting&key=zaloPhoneFieldLocked", { redirect: "follow" });
    const d1 = await r1.json();
    locked = d1 && d1.value === "true";
  } catch (e) { /* giu mac dinh */ }
  try {
    const r2 = await fetch(cfg.gasUrl + sep + "action=getSetting&key=zaloPhoneSaleCanAdd", { redirect: "follow" });
    const d2 = await r2.json();
    saleCanAdd = !(d2 && d2.value === "false");
  } catch (e) { /* giu mac dinh */ }
  return { locked, saleCanAdd };
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

// ─── Goi truc tiep 1 provider dang OpenAI-compatible (Groq/Cerebras/OpenRouter/OpenAI deu
// cung dinh dang request/response chat completions) bang key CA NHAN cua CS — cung dinh dang
// voi _aiOpenAICompat_ trong gas_v13.js de nhat quan, nhung goi THANG tu may CS, khong qua GAS.
async function _callOpenAICompatDirect_(baseUrl, apiKey, model, defaultModel, prompt, label) {
  const m = (model || "").trim() || defaultModel;
  let res, txt;
  try {
    res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400
      })
    });
    txt = await res.text();
  } catch (e) {
    throw new Error(`Không gọi được ${label} (mạng/CORS): ` + e.message);
  }
  if (!res.ok) {
    let msg = txt;
    try { const j = JSON.parse(txt); msg = (j.error && (j.error.message || j.error)) || txt; } catch (e) {}
    throw new Error(`${label} lỗi ${res.status}: ${String(msg).substring(0, 300)}`);
  }
  let d;
  try { d = JSON.parse(txt); } catch (e) { throw new Error(`${label} trả về dữ liệu không đọc được: ` + txt.substring(0, 200)); }
  const t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
  if (!t) throw new Error(`${label} không trả về nội dung.`);
  return { text: t, provider: `${label} (key riêng)` };
}

// Dang ky tat ca provider ho tro cho "AI ca nhan" — moi provider mo rong sau nay CHI can them
// 1 dong o day, khong phai sua callAI_/handleTestAiKey (dispatcher doc du lieu tu day).
const AI_DIRECT_PROVIDERS = {
  gemini:     { label: "Gemini",     kind: "gemini",        defaultModel: "gemini-flash-latest" },
  groq:       { label: "Groq",       kind: "openai-compat", baseUrl: "https://api.groq.com/openai/v1/chat/completions",  defaultModel: "openai/gpt-oss-120b" },
  cerebras:   { label: "Cerebras",   kind: "openai-compat", baseUrl: "https://api.cerebras.ai/v1/chat/completions",      defaultModel: "gpt-oss-120b" },
  openrouter: { label: "OpenRouter", kind: "openai-compat", baseUrl: "https://openrouter.ai/api/v1/chat/completions",    defaultModel: "google/gemma-2-9b-it:free" },
  openai:     { label: "OpenAI",     kind: "openai-compat", baseUrl: "https://api.openai.com/v1/chat/completions",      defaultModel: "gpt-5.4-mini" }
};

async function _callAiDirect_(provider, apiKey, model, prompt) {
  const pv = AI_DIRECT_PROVIDERS[provider];
  if (!pv) throw new Error("Provider không hợp lệ: " + provider);
  if (pv.kind === "gemini") return await _callGeminiDirect_(apiKey, model, prompt);
  return await _callOpenAICompatDirect_(pv.baseUrl, apiKey, model, pv.defaultModel, prompt, pv.label);
}

// ─── Goi truc tiep Gemini (dinh dang rieng cua Google) bang key CA NHAN cua CS — cung
// dinh dang request/response voi _aiGemini_ trong gas_v13.js de nhat quan, nhung goi THANG
// tu may CS toi Google (khong qua GAS, khong dung key chung cua team). model mac dinh dung
// alias 'gemini-flash-latest' (luon tro toi ban Flash moi nhat con duoc ho tro) — KHONG dung
// 'gemini-2.0-flash' nhu truoc day vi model do Google da chinh thuc khai tu/shutdown.
async function _callGeminiDirect_(apiKey, model, prompt) {
  const m = (model || "").trim() || "gemini-flash-latest";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(m) + ":generateContent?key=" + encodeURIComponent(apiKey);
  let res, txt;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
      })
    });
    txt = await res.text();
  } catch (e) {
    throw new Error("Không gọi được Gemini (mạng/CORS): " + e.message);
  }
  if (!res.ok) {
    let msg = txt;
    try { const j = JSON.parse(txt); msg = (j.error && j.error.message) || txt; } catch (e) {}
    // Loi hay gap: 400 API key khong hop le (sai/thieu quyen), 404 sai ten model (vd model da
    // bi Google khai tu), 429 het quota mien phi trong ngay.
    throw new Error(`Gemini lỗi ${res.status}: ${String(msg).substring(0, 300)}`);
  }
  let d;
  try { d = JSON.parse(txt); } catch (e) { throw new Error("Gemini trả về dữ liệu không đọc được: " + txt.substring(0, 200)); }
  const t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
  if (!t) {
    // Vd bi chan boi safety filter -> candidates[0].finishReason = 'SAFETY', khong co text.
    const reason = d.candidates && d.candidates[0] && d.candidates[0].finishReason;
    throw new Error("Gemini không trả về nội dung" + (reason ? ` (finishReason: ${reason})` : "") + ".");
  }
  return { text: t, provider: "Gemini (key riêng)" };
}

// ─── Dispatcher dung chung cho MOI noi can sinh van ban AI (tra loi tin khach / 3 cau mo
// dau / follow-up nhac hen): neu CS da cau hinh "AI ca nhan" (Options → dien Provider +
// API Key, bat ky provider nao trong AI_DIRECT_PROVIDERS) thi goi THANG toi nha cung cap do tu
// chinh may CS, khong di qua GAS/key chung cua team. Neu chua cau hinh thi roi ve duong cu, goi
// GAS dung AI chung, KHONG bao loi.
//
// Luu y quan trong: goi truc tiep kieu nay se KHONG co tinh nang "Tra cuu san pham" (tu dinh
// kem anh tu Google Drive) vi tinh nang do can GAS truy cap Drive cua team — AI rieng chi
// tra ve van ban.
async function callAI_(cfg, prompt, withProducts) {
  if (cfg.aiProvider && AI_DIRECT_PROVIDERS[cfg.aiProvider] && cfg.aiApiKey) {
    return await _callAiDirect_(cfg.aiProvider, cfg.aiApiKey, cfg.aiModel, prompt);
  }
  const data = await callAiWithRetry_(cfg.gasUrl, prompt, withProducts);
  return { text: data.text, provider: data.provider, image: data.image || null, imageSkipped: data.imageSkipped || null };
}

// Dung cho nut "🔍 Kiem tra Key" trong trang Options — CHI goi truc tiep provider CS vua chon
// (khong bao gio roi ve GAS/AI chung, khac voi callAI_ o tren), vi muc dich la kiem tra DUNG cai
// key CS vua dan co tu no chay duoc khong, khong phai lay 1 cau tra loi bang moi gia. Khong luu
// gi vao storage — payload la du lieu form CHUA luu, chi dung 1 lan roi bo.
async function handleTestAiKey(payload) {
  const provider = payload?.provider;
  const apiKey = (payload?.apiKey || "").trim();
  const model = (payload?.model || "").trim();
  if (!provider || !apiKey) throw new Error("Thiếu Provider hoặc API Key.");
  const testPrompt = 'Trả lời đúng 2 chữ "Đã kết nối" để xác nhận API key hoạt động, không thêm gì khác.';
  const data = await _callAiDirect_(provider, apiKey, model, testPrompt);
  return { reply: (data.text || "").trim().slice(0, 60) };
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
  const data = await callAI_(cfg, prompt, withProducts);
  // GAS trả về { ok:true, text:"...", provider:"...", image?: {name, base64, mimeType},
  // imageSkipped?: {name, reason} } — image chỉ có khi bật "Tra cứu sản phẩm" và tên 1 file
  // ảnh trong thư mục kiến thức Drive khớp từ khoá; imageSkipped báo trường hợp khớp tên
  // nhưng file >3MB nên GAS không đọc được — content.js hiện nút "Copy ảnh" hoặc cảnh báo tương ứng.
  // (Khi dùng AI riêng qua callAI_, image/imageSkipped luôn null — xem ghi chú trên callAI_.)
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
  if (payload.stonePref) lines.push(`Loại đá khách hỏi: ${payload.stonePref}`);
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
  const custLinesFull = payload?.stonePref ? [...custLines, `Loại đá khách hỏi: ${payload.stonePref}`] : custLines;
  const custBlock = custLinesFull.length ? `[KH] ${custLinesFull.join(" | ")}\n` : "";
  const prompt =
    custBlock +
    `[Giọng văn] ${tone}\n` +
    `Soạn 1 tin nhắn CHỦ ĐỘNG bắt chuyện với khách, theo hướng: ${angleInstr} ` +
    `Ngắn gọn, tự nhiên, tiếng Việt, không giống mẫu quảng cáo.`;

  const withProducts = payload?.withProducts !== undefined ? payload.withProducts : !!cfg.useProducts;
  const data = await callAI_(cfg, prompt, withProducts);
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

// So lieu ca nhan cua 1 CS trong khoang ngay — action:'csStats' (GET). Tra ve { ok, totalOrders, revenue, closeRate,
// commission{...}, bonus{...} } — tinh o GAS (buildCsStats_) cung quy tac voi Bao cao E cua CRM.
async function handleGetCsStats(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const cs = payload?.cs || cfg.csName || "";
  if (!cs) throw new Error("Chưa chọn CS.");
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=csStats&cs=" + encodeURIComponent(cs) +
    "&dateFrom=" + encodeURIComponent(payload?.dateFrom || "") + "&dateTo=" + encodeURIComponent(payload?.dateTo || "");
  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (data.ok === false) throw new Error("Không tính được số liệu.");
  return data;
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

  const data = await callAI_(cfg, prompt, !!cfg.useProducts);
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

// Tra cuu CTKM theo tu khoa — action:'ctkmSearch' (GET, chi doc). Cung co che voi
// handleGetPrice o tren, chi doi sang sheet CTKM. Ten rieng (khac handleGetCtkm() ben duoi,
// vom load nguyen van cho "Soan don") de tranh dam ten ham (function hoisting se de 1 ham
// ghi de ham kia neu trung ten).
async function handleGetCtkmSearch(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const q = payload?.q || "";
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=ctkmSearch" + (q ? "&q=" + encodeURIComponent(q) : "");
  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { rows: data.rows || [], total: data.total || 0 };
}

// Danh sach phang san pham + link anh — action:'productImageFlat' (GET, chi doc). Tra ve
// { items: [{n,t,m,s,c,img}, ...] } — FE tu loc cascading (Nhom SP -> Ten SP -> Size -> Chat
// lieu) giong het "Soan don", roi goi handleGetDriveImage voi dung link cua dong da chon.
async function handleGetProductImageFlat() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=productImageFlat";
  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Không tải được danh sách sản phẩm.");
  return { items: data.items || [] };
}

// Doc 1 anh THEO DUNG link — action:'driveImageFromLink' (GET, chi doc). Tra ve { imageLink,
// image: {base64,mimeType,name} | null } — image=null nghia la khong doc duoc anh tu Drive
// (chua chia se/qua 3MB/link hong) nhung VAN co imageLink de CS tu mo xem.
async function handleGetDriveImage(payload) {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");

  const link = payload?.link || "";
  if (!link) throw new Error("Thiếu link ảnh.");
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const url = cfg.gasUrl + sep + "action=driveImageFromLink&link=" + encodeURIComponent(link);
  const res = await fetch(url, { redirect: "follow" });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Không đọc được ảnh.");
  return data;
}

async function handleGetPriceFlat() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const res = await fetch(cfg.gasUrl + sep + "action=priceCatalogFlat", { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  // GAS ban cu khong biet action nay se tra ve du lieu mac dinh (khong co items) -> bao de client lui ve che do tim truc tiep
  if (!Array.isArray(data.items)) throw new Error("GAS_NO_FLAT");
  return { items: data.items };
}

async function handleGetPriceTree() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const res = await fetch(cfg.gasUrl + sep + "action=priceCatalogTree", { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { groups: data.groups || [], priceKeys: data.priceKeys || [] };
}

async function handleGetCtkm() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const res = await fetch(cfg.gasUrl + sep + "action=ctkmCatalog", { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  // GAS ban cu chua co action nay se tra ve {} (khong co rows) -> bao rieng de client biet ma an panel di, khong bao loi om
  if (!Array.isArray(data.rows)) throw new Error("GAS_NO_CTKM");
  return { rows: data.rows };
}

async function handleGetKnowledge() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const res = await fetch(cfg.gasUrl, {
    method: "POST",
    body: JSON.stringify({ action: "getKnowledge" }),
    redirect: "follow"
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Lỗi không rõ");
  return { menhTable: data.menhTable || null, canned: data.canned || [] };
}

// Thu vien mau tin nhan tu van khach — action:'messageTemplates' (GET, chi doc). Form them/sua/
// xoa nam ben CRM (tab Zalo AI); extension nay chi hien thi de CS xem/chen nhanh khi chat.
async function handleGetMessageTemplates() {
  const settings = await chrome.storage.sync.get(null);
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  if (!cfg.gasUrl) throw new Error("Chưa cấu hình URL Web App GAS.");
  const sep = cfg.gasUrl.includes("?") ? "&" : "?";
  const res = await fetch(cfg.gasUrl + sep + "action=messageTemplates", { redirect: "follow" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { templates: data.templates || [] };
}

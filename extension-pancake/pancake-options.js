document.addEventListener("DOMContentLoaded", load);
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", resetToDefault);
document.getElementById("aiProvider").addEventListener("change", updateAiProviderHint);
document.getElementById("toggleAiKey").addEventListener("click", () => {
  const inp = document.getElementById("aiApiKey");
  inp.type = inp.type === "password" ? "text" : "password";
});
document.getElementById("getAiKeyBtn").addEventListener("click", () => {
  const p = document.getElementById("aiProvider").value;
  if (AI_PROVIDER_SIGNUP_URL[p]) window.open(AI_PROVIDER_SIGNUP_URL[p], "_blank");
});
document.getElementById("testAiKeyBtn").addEventListener("click", testAiKey);

// Link trang dang ky lay API Key rieng cho tung nha cung cap — nut "🔗 Lay API Key" mo thang
// trang nay o tab moi, khong bat CS phai tu tim link trong doan hint dai.
const AI_PROVIDER_SIGNUP_URL = {
  gemini: "https://aistudio.google.com/apikey",
  groq: "https://console.groq.com/keys",
  cerebras: "https://cloud.cerebras.ai/",
  openrouter: "https://openrouter.ai/keys",
  openai: "https://platform.openai.com/api-keys"
};
const AI_PROVIDER_HINTS = {
  gemini: '🔗 Lấy API Key tại <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> (đăng nhập bằng Google, miễn phí có giới hạn). Model mặc định: <code>gemini-flash-latest</code> (alias luôn trỏ tới bản Flash mới nhất — model cũ <code>gemini-2.0-flash</code> đã bị Google khai tử, không dùng được nữa).',
  groq: '🔗 Lấy API Key tại <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> (miễn phí, giới hạn theo phút/ngày). Model mặc định: <code>openai/gpt-oss-120b</code>.',
  cerebras: '🔗 Lấy API Key tại <a href="https://cloud.cerebras.ai/" target="_blank">cloud.cerebras.ai</a> (đăng ký tài khoản, có gói miễn phí). Model mặc định: <code>gpt-oss-120b</code>.',
  openrouter: '🔗 Lấy API Key tại <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a> (có model miễn phí, một số model tính phí theo dùng). Model mặc định: <code>google/gemma-2-9b-it:free</code>.',
  openai: '🔗 Lấy API Key tại <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>. Model mặc định: <code>gpt-5.4-mini</code>.'
};
function updateAiProviderHint() {
  const p = document.getElementById("aiProvider").value;
  const box = document.getElementById("aiProviderHint");
  const getBtn = document.getElementById("getAiKeyBtn");
  document.getElementById("testAiKeyResult").innerText = ""; // doi Provider -> ket qua Kiem tra cu (neu co) khong con dung nua
  if (p && AI_PROVIDER_HINTS[p]) {
    box.innerHTML = AI_PROVIDER_HINTS[p];
    box.style.display = "";
    getBtn.style.display = AI_PROVIDER_SIGNUP_URL[p] ? "" : "none";
  } else {
    box.style.display = "none";
    getBtn.style.display = "none";
  }
}

// "Kiem tra Key" — goi 1 request that (khong luu) toi dung nha cung cap dang chon voi key
// dang go trong o, de CS TU biet ngay key co chay duoc hay khong (sai key/sai quyen/het
// quota/model bi doi ten...) TRUOC khi bam Luu, thay vi phai doi den luc tra loi khach that
// moi phat hien loi. Dung message TEST_AI_KEY rieng, KHONG dung chung voi FETCH_SUGGESTION
// that de tranh gui nham du lieu hoi thoai that trong luc chi dang thu key.
function testAiKey() {
  const provider = document.getElementById("aiProvider").value;
  const apiKey = document.getElementById("aiApiKey").value.trim();
  const model = document.getElementById("aiModel").value.trim();
  const btn = document.getElementById("testAiKeyBtn");
  const result = document.getElementById("testAiKeyResult");

  if (!provider) { result.innerHTML = '⚠️ Chọn Provider trước đã.'; result.style.color = "#b45309"; return; }
  if (!apiKey) { result.innerHTML = '⚠️ Dán API Key vào ô bên trên trước đã.'; result.style.color = "#b45309"; return; }

  btn.disabled = true;
  result.style.color = "#555";
  result.innerHTML = "⏳ Đang kiểm tra...";
  chrome.runtime.sendMessage({ type: "TEST_AI_KEY", payload: { provider, apiKey, model } }, (res) => {
    btn.disabled = false;
    if (res?.ok) {
      result.style.color = "#059669";
      result.innerHTML = "✅ Key hoạt động tốt! (" + escapeHtmlLite_(res.data?.reply || "") + ")";
    } else {
      result.style.color = "#dc2626";
      result.innerHTML = "❌ " + escapeHtmlLite_(res?.error || "Lỗi không rõ");
    }
  });
}
function escapeHtmlLite_(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function load() {
  chrome.storage.sync.get(null, (s) => {
    document.getElementById("useProducts").checked = !!s.useProducts;

    chrome.runtime.sendMessage({ type: "GET_GOLD_UNIT" }, (resp) => {
      const n = Number(resp?.ok ? resp.data : NaN);
      document.getElementById("goldUnitAmount").value = (n > 0) ? n : 350000;
    });

    document.getElementById("aiProvider").value = s.aiProvider || "";
    document.getElementById("aiApiKey").value = s.aiApiKey || "";
    document.getElementById("aiModel").value = s.aiModel || "";
    updateAiProviderHint();

    document.getElementById("platformPancake").checked = s.platform?.pancake !== false;
    document.getElementById("platformMessenger").checked = s.platform?.messenger !== false;

    document.getElementById("pancake_messageList").value = s.selectors?.pancake?.messageList || "";
    document.getElementById("pancake_messageItem").value = s.selectors?.pancake?.messageItem || "";
    document.getElementById("pancake_replyBox").value = s.selectors?.pancake?.replyBox || "";
    document.getElementById("pancake_phoneSelector").value = s.selectors?.pancake?.phoneSelector || "";
    document.getElementById("pancake_orderPanelSelector").value = s.selectors?.pancake?.orderPanelSelector || "";
    document.getElementById("pancake_infoPanelSelector").value = s.selectors?.pancake?.infoPanelSelector || "";
    document.getElementById("pancake_customerMsgSelector").value = s.selectors?.pancake?.customerMsgSelector || "";
    document.getElementById("pancake_agentMsgSelector").value = s.selectors?.pancake?.agentMsgSelector || "";

    document.getElementById("messenger_messageList").value = s.selectors?.messenger?.messageList || "";
    document.getElementById("messenger_messageItem").value = s.selectors?.messenger?.messageItem || "";
    document.getElementById("messenger_replyBox").value = s.selectors?.messenger?.replyBox || "";
    document.getElementById("messenger_phoneSelector").value = s.selectors?.messenger?.phoneSelector || "";
    document.getElementById("messenger_customerMsgSelector").value = s.selectors?.messenger?.customerMsgSelector || "";
    document.getElementById("messenger_agentMsgSelector").value = s.selectors?.messenger?.agentMsgSelector || "";
  });
}

function save() {
  const settings = {
    // gasUrl KHONG con doc tu form nua — da co dinh san trong DEFAULT_SETTINGS
    // (pancake-background.js), khong ghi de o day de tranh vo tinh xoa mat URL dang dung.
    useProducts: document.getElementById("useProducts").checked,
    aiProvider: document.getElementById("aiProvider").value,
    aiApiKey: document.getElementById("aiApiKey").value.trim(),
    aiModel: document.getElementById("aiModel").value.trim(),
    enabled: true,
    platform: {
      pancake: document.getElementById("platformPancake").checked,
      messenger: document.getElementById("platformMessenger").checked
    },
    selectors: {
      pancake: {
        messageList: document.getElementById("pancake_messageList").value.trim(),
        messageItem: document.getElementById("pancake_messageItem").value.trim(),
        replyBox: document.getElementById("pancake_replyBox").value.trim(),
        phoneSelector: document.getElementById("pancake_phoneSelector").value.trim(),
        orderPanelSelector: document.getElementById("pancake_orderPanelSelector").value.trim(),
        infoPanelSelector: document.getElementById("pancake_infoPanelSelector").value.trim(),
        customerMsgSelector: document.getElementById("pancake_customerMsgSelector").value.trim(),
        agentMsgSelector: document.getElementById("pancake_agentMsgSelector").value.trim()
      },
      messenger: {
        messageList: document.getElementById("messenger_messageList").value.trim(),
        messageItem: document.getElementById("messenger_messageItem").value.trim(),
        replyBox: document.getElementById("messenger_replyBox").value.trim(),
        phoneSelector: document.getElementById("messenger_phoneSelector").value.trim(),
        customerMsgSelector: document.getElementById("messenger_customerMsgSelector").value.trim(),
        agentMsgSelector: document.getElementById("messenger_agentMsgSelector").value.trim()
      }
    }
  };

  chrome.storage.sync.set(settings, () => {
    const el = document.getElementById("saved");
    el.innerText = "Đã lưu ✓";
    setTimeout(() => (el.innerText = ""), 2000);
  });

  // Don gia vang: ghi rieng qua GAS setSetting (dung chung voi CRM), khong nam trong
  // chrome.storage.sync cua rieng may nay — de doi 1 lan la ap dung ca team.
  const goldEl = document.getElementById("goldUnitAmount");
  const goldStatusEl = document.getElementById("goldUnitStatus");
  const goldAmount = Number(goldEl.value);
  if (goldAmount > 0) {
    goldStatusEl.innerText = "Đang lưu...";
    chrome.runtime.sendMessage({ type: "SET_GOLD_UNIT", payload: { amount: goldAmount } }, (resp) => {
      goldStatusEl.innerText = resp?.ok ? "✓ Đã áp dụng cho cả team" : ("❌ " + (resp?.error || "Lỗi lưu"));
      setTimeout(() => (goldStatusEl.innerText = ""), 3000);
    });
  }
}

// Ghi de toan bo cai dat hien tai bang bo mac dinh dung (GAS URL + selector da xac minh
// qua DevTools) — dung khi extension da cai truoc do va dang giu cau hinh cu/sai, ma
// khong muon go-cai lai tu dau (go-cai moi tu dong ap dung mac dinh qua onInstalled).
function resetToDefault() {
  if (!window.confirm("Đặt lại toàn bộ cài đặt (URL GAS + tất cả selector) về mặc định? Mọi tuỳ chỉnh riêng hiện tại sẽ bị ghi đè.")) return;
  chrome.runtime.sendMessage({ type: "RESET_TO_DEFAULT" }, (res) => {
    if (res?.ok) {
      load();
      const el = document.getElementById("saved");
      el.innerText = "Đã đặt lại về mặc định ✓";
      setTimeout(() => (el.innerText = ""), 2500);
    } else {
      alert("Lỗi đặt lại: " + (res?.error || "không rõ"));
    }
  });
}

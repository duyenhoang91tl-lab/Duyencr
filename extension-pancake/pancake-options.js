document.addEventListener("DOMContentLoaded", load);
document.getElementById("save").addEventListener("click", save);
document.getElementById("reset").addEventListener("click", resetToDefault);
document.getElementById("aiProvider").addEventListener("change", updateAiProviderHint);
document.getElementById("toggleAiKey").addEventListener("click", () => {
  const inp = document.getElementById("aiApiKey");
  inp.type = inp.type === "password" ? "text" : "password";
});

const AI_PROVIDER_HINTS = {
  gemini: '🔗 Lấy API Key tại <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> (đăng nhập bằng Google, miễn phí có giới hạn). Model mặc định: <code>gemini-flash-latest</code> (alias luôn trỏ tới bản Flash mới nhất — model cũ <code>gemini-2.0-flash</code> đã bị Google khai tử, không dùng được nữa).',
  openai: '🔗 Lấy API Key tại <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>. Model mặc định: <code>gpt-5.4-mini</code>.'
};
function updateAiProviderHint() {
  const p = document.getElementById("aiProvider").value;
  const box = document.getElementById("aiProviderHint");
  if (p && AI_PROVIDER_HINTS[p]) {
    box.innerHTML = AI_PROVIDER_HINTS[p];
    box.style.display = "";
  } else {
    box.style.display = "none";
  }
}

function load() {
  chrome.storage.sync.get(null, (s) => {
    document.getElementById("useProducts").checked = !!s.useProducts;

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

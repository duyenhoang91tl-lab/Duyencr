document.addEventListener("DOMContentLoaded", load);
document.getElementById("save").addEventListener("click", save);

function load() {
  chrome.storage.sync.get(null, (s) => {
    document.getElementById("gasUrl").value = s.gasUrl || "";
    document.getElementById("useProducts").checked = !!s.useProducts;

    document.getElementById("platformPancake").checked = s.platform?.pancake !== false;
    document.getElementById("platformMessenger").checked = s.platform?.messenger !== false;

    document.getElementById("pancake_messageList").value = s.selectors?.pancake?.messageList || "";
    document.getElementById("pancake_messageItem").value = s.selectors?.pancake?.messageItem || "";
    document.getElementById("pancake_replyBox").value = s.selectors?.pancake?.replyBox || "";
    document.getElementById("pancake_phoneSelector").value = s.selectors?.pancake?.phoneSelector || "";

    document.getElementById("messenger_messageList").value = s.selectors?.messenger?.messageList || "";
    document.getElementById("messenger_messageItem").value = s.selectors?.messenger?.messageItem || "";
    document.getElementById("messenger_replyBox").value = s.selectors?.messenger?.replyBox || "";
    document.getElementById("messenger_phoneSelector").value = s.selectors?.messenger?.phoneSelector || "";
  });
}

function save() {
  const settings = {
    gasUrl: document.getElementById("gasUrl").value.trim(),
    useProducts: document.getElementById("useProducts").checked,
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
        phoneSelector: document.getElementById("pancake_phoneSelector").value.trim()
      },
      messenger: {
        messageList: document.getElementById("messenger_messageList").value.trim(),
        messageItem: document.getElementById("messenger_messageItem").value.trim(),
        replyBox: document.getElementById("messenger_replyBox").value.trim(),
        phoneSelector: document.getElementById("messenger_phoneSelector").value.trim()
      }
    }
  };

  chrome.storage.sync.set(settings, () => {
    const el = document.getElementById("saved");
    el.innerText = "Đã lưu ✓";
    setTimeout(() => (el.innerText = ""), 2000);
  });
}

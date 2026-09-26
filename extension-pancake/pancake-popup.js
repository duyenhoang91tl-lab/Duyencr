document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(null, (s) => {
    document.getElementById("enabled").checked = s.enabled !== false;
    const labelByProvider = { gemini: "Gemini — key riêng", openai: "OpenAI — key riêng" };
    document.getElementById("aiStatus").textContent =
      s.aiProvider && s.aiApiKey ? "🔑 Đang dùng: " + (labelByProvider[s.aiProvider] || s.aiProvider) : "☁️ Đang dùng: AI chung (backend công ty)";
  });
});

document.getElementById("enabled").addEventListener("change", (e) => {
  chrome.storage.sync.set({ enabled: e.target.checked });
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

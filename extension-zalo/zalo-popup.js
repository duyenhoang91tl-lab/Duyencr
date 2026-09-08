document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["ome_gas_url"], (res) => {
    const el = document.getElementById("status");
    if (res.ome_gas_url) {
      el.textContent = "✅ Đã cấu hình backend GAS.";
      el.className = "status ok";
    } else {
      el.textContent = "⚠️ Chưa cấu hình URL backend GAS.";
      el.className = "status warn";
    }
  });
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

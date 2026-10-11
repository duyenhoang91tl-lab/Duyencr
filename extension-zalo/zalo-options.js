document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["ome_gas_url", "ome_ext_key"], (res) => {
    document.getElementById("gasUrl").value = res.ome_gas_url || "";
    document.getElementById("extKey").value = res.ome_ext_key || "";
  });
});

document.getElementById("save").addEventListener("click", () => {
  const gasUrl = document.getElementById("gasUrl").value.trim();
  const extKey = document.getElementById("extKey").value.trim();
  chrome.storage.local.set({ ome_gas_url: gasUrl, ome_ext_key: extKey }, () => {
    const saved = document.getElementById("saved");
    saved.textContent = "Đã lưu ✔";
    setTimeout(() => { saved.textContent = ""; }, 2000);
  });
});

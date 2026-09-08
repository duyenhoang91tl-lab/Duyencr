document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["ome_gas_url"], (res) => {
    document.getElementById("gasUrl").value = res.ome_gas_url || "";
  });
});

document.getElementById("save").addEventListener("click", () => {
  const gasUrl = document.getElementById("gasUrl").value.trim();
  chrome.storage.local.set({ ome_gas_url: gasUrl }, () => {
    const saved = document.getElementById("saved");
    saved.textContent = "Đã lưu ✔";
    setTimeout(() => { saved.textContent = ""; }, 2000);
  });
});

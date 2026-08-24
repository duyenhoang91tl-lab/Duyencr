document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(null, (s) => {
    document.getElementById("enabled").checked = s.enabled !== false;
  });
});

document.getElementById("enabled").addEventListener("change", (e) => {
  chrome.storage.sync.set({ enabled: e.target.checked });
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

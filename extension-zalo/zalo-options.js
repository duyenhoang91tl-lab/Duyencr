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


// ── Viet tat (go tat trong o chat) — bat/tat luu NGAY (storage.local); cap nhat ngay = goi thang GAS (action vietTat), giong zalo-viettat.js. Dan xuat tu pancake-options.js ──
(function () {
  const on = document.getElementById("vtOn"), btn = document.getElementById("vtSync"), st = document.getElementById("vtStatus");
  if (!on || !btn) return;
  const say = (t, bad) => { st.textContent = t; st.style.color = bad ? "#b91c1c" : "#166534"; };
  chrome.storage.local.get({ vtOn: true, vtData: [], vtAt: 0 }, (v) => {
    on.checked = v.vtOn !== false;
    if (v.vtAt) say("Đã có " + (v.vtData || []).length + " mục (cập nhật " + new Date(v.vtAt).toLocaleString("vi-VN") + ")");
  });
  on.addEventListener("change", () => chrome.storage.local.set({ vtOn: on.checked }));
  btn.addEventListener("click", () => {
    btn.disabled = true; say("Đang cập nhật...");
    chrome.storage.local.get({ ome_gas_url: "", ome_current_cs: "", ome_ext_key: "" }, async (l) => {
      try {
        const gas = l.ome_gas_url; if (!gas) throw new Error("Chưa cấu hình URL GAS — mở panel Zalo AI trên chat.zalo.me 1 lần.");
        const url = gas + (gas.indexOf("?") >= 0 ? "&" : "?") + "action=vietTat&by=" + encodeURIComponent(l.ome_current_cs || "") + "&src=zalo" + (l.ome_ext_key ? "&ek=" + encodeURIComponent(l.ome_ext_key) : "");
        const d = await (await fetch(url, { redirect: "follow" })).json();
        if (d.error || !Array.isArray(d.snippets)) throw new Error(d.error || "phản hồi không hợp lệ");
        chrome.storage.local.set({ vtData: d.snippets, vtAt: Date.now(), vtBy: String(l.ome_current_cs || "") }, () => say("✓ Đã cập nhật " + d.snippets.length + " mục."));
      } catch (e) { say("Không cập nhật được: " + e.message, true); }
      btn.disabled = false;
    });
  });
})();

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


// ── Dang nhap ADMIN de mau tin tao tren Zalo AI duoc duyet luon (song song voi Pancake AI: pancake-options.js apprInit + pancake-background.js handleApproverLogin) ──
// Zalo AI khong co background nen dang nhap goi THANG GAS (action webLogin, cung ham voi web CRM). Mat khau KHONG luu; chi luu token phien (+ han) o storage.local
// ('ome_admin_auth', khong dong bo giua may). zalo-content.js (_zaiAdminTokenField_) doc token nay de kem vao saveMessageTemplate/deleteMessageTemplate.
(function apprInit() {
  const $ = (id) => document.getElementById(id);
  if (!$("apprLogin")) return;
  const KEY = "ome_admin_auth";
  const say = (t, ok) => { const m = $("apprMsg"); m.textContent = t || ""; m.style.color = ok ? "#15803d" : "#b91c1c"; };
  const getAuth = () => new Promise((res) => chrome.storage.local.get([KEY], (r) => {
    const a = r && r[KEY];
    if (a && a.expiresAt && Date.now() > a.expiresAt) { chrome.storage.local.remove(KEY); return res(null); }
    res(a && a.token ? a : null);
  }));
  async function refresh() {
    const a = await getAuth(), on = !!a;
    $("apprLoggedIn").style.display = on ? "" : "none"; $("apprLoggedOut").style.display = on ? "none" : "";
    if (on) { $("apprName").textContent = a.name || a.username || ""; $("apprExp").textContent = a.expiresAt ? "(hết hạn " + new Date(a.expiresAt).toLocaleDateString("vi-VN") + ")" : ""; }
  }
  async function login() {
    const username = $("apprUser").value.trim(), password = $("apprPass").value;
    if (!username || !password) throw new Error("Nhập tài khoản và mật khẩu CRM.");
    const l = await new Promise((res) => chrome.storage.local.get(["ome_gas_url"], res));
    const gas = (l && l.ome_gas_url) || ""; if (!gas) throw new Error("Chưa cấu hình URL GAS — nhập ở mục Backend phía trên rồi bấm Lưu cài đặt.");
    const r = await fetch(gas, { method: "POST", body: JSON.stringify({ action: "webLogin", username, password }), headers: { "Content-Type": "text/plain" } });
    const d = await r.json();
    if (!d || !d.ok || !d.token) throw new Error((d && d.error) || "Đăng nhập không thành công.");
    if (String((d.user && d.user.role) || "") !== "admin") throw new Error("Tài khoản này không phải admin nên mẫu tin vẫn phải chờ duyệt.");
    const rec = { token: d.token, username: String((d.user && d.user.username) || username), name: String((d.user && (d.user.name || d.user.username)) || username),
                  role: "admin", expiresAt: Date.now() + Math.max(60000, Number(d.expiresInMs || 6048e5) - 120000) };
    await new Promise((res) => chrome.storage.local.set({ [KEY]: rec }, res));
  }
  $("apprLogin").addEventListener("click", async () => {
    const btn = $("apprLogin"); btn.disabled = true; say("Đang đăng nhập...", true);
    try { await login(); say("Đăng nhập thành công. Từ giờ mẫu bạn tạo trong panel Zalo AI được duyệt luôn.", true); await refresh(); }
    catch (e) { say(String((e && e.message) || e), false); }
    btn.disabled = false; $("apprPass").value = "";   // xoá mật khẩu khỏi ô nhập ngay
  });
  $("apprPass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("apprLogin").click(); });
  $("apprLogout").addEventListener("click", async () => { await new Promise((res) => chrome.storage.local.remove(KEY, res)); say("Đã đăng xuất.", true); await refresh(); });
  refresh();
})();


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

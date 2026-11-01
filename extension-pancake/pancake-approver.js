// Duyệt MẪU TIN nhân viên đề xuất ngay trên Pancake (chỉ admin đã đăng nhập ở Cài đặt extension).
// - Hỏi background (TPL_PENDING) mỗi 90 giây khi tab đang hiện; có mẫu mới -> toast + nút nổi "📝 N mẫu tin chờ duyệt".
// - Bấm nút -> hộp thoại liệt kê mẫu chờ duyệt, ✓ Duyệt / ✗ Từ chối (kèm lý do) -> background gọi action approveMessageTemplate.
// Token đăng nhập chỉ nằm ở background (service worker); file này KHÔNG bao giờ thấy token hay mật khẩu.
(function () {
  if (window.__pkApprInit) return;
  window.__pkApprInit = true;
  const POLL_MS = 90000, SEEN_KEY = "pkApprSeen";
  let items = [], loggedIn = false, seen = null, timer = null, busy = false, pill = null, modal = null, toastEl = null, toastTimer = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const send = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (r) => { if (chrome.runtime.lastError) return resolve(null); resolve(r); }); }
    catch (e) { resolve(null); }   // extension vừa được cập nhật/reload: im lặng, trang Pancake tải lại là xong
  });
  const ago = (iso) => {
    const t = Date.parse(iso); if (!t) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    return m < 1 ? "vừa xong" : m < 60 ? m + " phút trước" : m < 1440 ? Math.round(m / 60) + " giờ trước" : Math.round(m / 1440) + " ngày trước";
  };
  async function loadSeen() {
    if (seen) return seen;
    try { const o = await chrome.storage.local.get(SEEN_KEY); seen = new Set(Array.isArray(o[SEEN_KEY]) ? o[SEEN_KEY] : []); } catch (e) { seen = new Set(); }
    return seen;
  }
  function saveSeen() { try { chrome.storage.local.set({ [SEEN_KEY]: Array.from(seen).slice(-300) }); } catch (e) {} }

  function ensurePill() {
    if (pill && pill.isConnected) return pill;
    pill = document.createElement("button");
    pill.type = "button"; pill.className = "pk-appr-pill"; pill.style.display = "none";
    pill.addEventListener("click", openModal);
    document.documentElement.appendChild(pill);
    return pill;
  }
  function renderPill() {
    const p = ensurePill();
    if (!loggedIn || !items.length) { p.style.display = "none"; return; }
    p.textContent = "📝 " + items.length + " mẫu tin chờ duyệt";
    p.style.display = "";
  }
  function toast(text) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div"); toastEl.className = "pk-appr-toast";
      toastEl.addEventListener("click", () => { hideToast(); openModal(); });
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl.style.display = "";
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 9000);
  }
  function hideToast() { if (toastEl) toastEl.style.display = "none"; }

  function cardHtml(t) {
    const chips = [t.product && ("SP: " + t.product), t.topic && ("Chủ đề: " + t.topic)].filter(Boolean).map((x) => '<span class="pk-appr-chip">' + esc(x) + "</span>").join("");
    return '<div class="pk-appr-card" data-id="' + esc(t.id) + '">' +
      '<div class="pk-appr-title">' + esc(t.title || "(không tiêu đề)") + "</div>" +
      '<div class="pk-appr-meta">' + esc(t.createdBy || "Nhân viên") + (t.createdAt ? " · " + esc(ago(t.createdAt)) : "") + "</div>" +
      (chips ? '<div class="pk-appr-chips">' + chips + "</div>" : "") +
      '<div class="pk-appr-content">' + esc(t.content || "") + "</div>" +
      '<div class="pk-appr-reason" style="display:none"><input type="text" maxlength="300" placeholder="Lý do từ chối (nhân viên sẽ thấy, có thể để trống)"></div>' +
      '<div class="pk-appr-err" style="display:none"></div>' +
      '<div class="pk-appr-acts"><button type="button" class="pk-appr-ok" data-act="approve">✓ Duyệt</button>' +
      '<button type="button" class="pk-appr-no" data-act="reject">✗ Từ chối</button></div></div>';
  }
  function renderModal() {
    if (!modal || !modal.isConnected) return;
    const list = modal.querySelector(".pk-appr-list");
    list.innerHTML = items.length ? items.map(cardHtml).join("") : '<div class="pk-appr-empty">Không còn mẫu tin nào chờ duyệt. 🎉</div>';
    modal.querySelector(".pk-appr-h b").textContent = "📝 Mẫu tin chờ duyệt" + (items.length ? " (" + items.length + ")" : "");
  }
  function openModal() {
    hideToast();
    if (!modal || !modal.isConnected) {
      modal = document.createElement("div"); modal.className = "pk-appr-modal";
      modal.innerHTML = '<div class="pk-appr-box"><div class="pk-appr-h"><b></b><button type="button" class="pk-appr-x" title="Đóng">×</button></div><div class="pk-appr-list"></div></div>';
      modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
      modal.querySelector(".pk-appr-x").addEventListener("click", closeModal);
      modal.querySelector(".pk-appr-list").addEventListener("click", onCardClick);
      document.documentElement.appendChild(modal);
    }
    modal.style.display = ""; renderModal();
    tick(true);   // làm mới ngay khi mở
  }
  function closeModal() { if (modal) modal.style.display = "none"; }

  async function onCardClick(e) {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const card = b.closest(".pk-appr-card"), id = card && card.dataset.id; if (!id) return;
    const act = b.dataset.act, reasonBox = card.querySelector(".pk-appr-reason"), err = card.querySelector(".pk-appr-err");
    if (act === "reject" && reasonBox.style.display === "none") {   // lần bấm đầu: hiện ô lý do; bấm lần nữa mới gửi
      reasonBox.style.display = ""; reasonBox.querySelector("input").focus(); b.textContent = "✗ Xác nhận từ chối"; return;
    }
    const btns = card.querySelectorAll("button"); btns.forEach((x) => (x.disabled = true)); err.style.display = "none";
    const reason = act === "reject" ? reasonBox.querySelector("input").value.trim() : "";
    const r = await send({ type: "TPL_DECIDE", payload: { id, decision: act, reason } });
    if (r && r.ok) {
      items = items.filter((x) => String(x.id) !== String(id)); seen && seen.add(String(id)); saveSeen();
      renderModal(); renderPill();
    } else {
      btns.forEach((x) => (x.disabled = false));
      err.textContent = "Không xử lý được: " + ((r && r.error) || "mất kết nối tới extension. Tải lại trang Pancake."); err.style.display = "";
      if (r && /đăng nhập/i.test(r.error || "")) { loggedIn = false; renderPill(); }
    }
  }

  async function tick(force) {
    if (busy || (!force && document.hidden)) return;
    busy = true;
    try {
      const r = await send({ type: "TPL_PENDING" });
      if (!r || !r.ok || !r.data) return;
      if (!r.data.loggedIn) { loggedIn = false; items = []; renderPill(); renderModal(); return; }
      loggedIn = true; items = r.data.items || [];
      const sn = await loadSeen(), fresh = items.filter((t) => !sn.has(String(t.id)));
      renderPill(); renderModal();
      if (fresh.length && (!modal || modal.style.display === "none")) {
        toast(fresh.length === 1 ? "📝 Mẫu tin mới chờ duyệt: " + (fresh[0].title || "") + (fresh[0].createdBy ? " — " + fresh[0].createdBy : "") + " (bấm để xem)"
                                 : "📝 " + fresh.length + " mẫu tin mới chờ duyệt (bấm để xem)");
      }
      fresh.forEach((t) => sn.add(String(t.id))); if (fresh.length) saveSeen();
    } finally { busy = false; }
  }
  function start() { if (timer) return; timer = setInterval(() => tick(false), POLL_MS); setTimeout(() => tick(false), 2500); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(false); });
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area === "local" && ch.pkApprover) tick(true); }); } catch (e) {}   // vừa đăng nhập/đăng xuất ở Cài đặt
  window.__pkAppr = { tick, openModal, state: () => ({ loggedIn, items }) };   // chỉ có trong "isolated world" của extension (trang Pancake không với tới)
  start();
})();

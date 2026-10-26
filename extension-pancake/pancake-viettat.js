// pancake-viettat.js — VIẾT TẮT trong ô chat Pancake / Messenger (2026-10-25, tích hợp từ app "Viết Tắt" của Duyên).
// Gõ viết tắt (hoặc từ khoá) → hiện gợi ý ngay dưới/trên ô chat → Tab chèn nội dung (↑↓ đổi lựa chọn, Alt+1…8 chọn nhanh, Esc đóng).
// Nguồn dữ liệu: sheet "VietTat" của CRM qua GAS (action 'vietTat' → background GET_VIETTAT); quản lý (thêm/sửa/xoá) ở CRM → tab Zalo AI → "⌨️ Viết tắt".
// Biến trong nội dung: {tên} {tên khách} (tên gọi = chữ cuối) · {tên đầy đủ} · {ngày} {ngày mai} {giờ} {thứ}.
// Kiểu gõ có tên: "ch Thanh Huyền" (viết tắt + tên khách) hoặc để tự lấy tên từ ô "Tên khách" của panel Pancake AI / bấm "✎ chọn tên" 1 lần.
// KHÔNG tự gửi tin: chỉ chèn chữ vào ô soạn, CS đọc lại rồi tự bấm Gửi.
(function () {
  'use strict';
  if (window.__pkVietTatLoaded) return; window.__pkVietTatLoaded = true;
  const STALE_MS = 5 * 60 * 1000;
  let snippets = [], enabled = true, picks = {}, state = null, host = null, box = null, tbox = null, fetching = false;

  // chrome.* ném lỗi "Extension context invalidated" sau khi reload extension → bọc để trang không bị lỗi
  const safe = (f, d) => { try { return f(); } catch (_) { return d; } };
  const sget = (area, keys) => safe(() => new Promise((res) => chrome.storage[area].get(keys, (v) => res(v || {}))), Promise.resolve({}));

  const fold = (s) => String(s || '').toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const given = (n) => n.trim().split(/\s+/).pop();
  const usesName = (s) => s.options.some((o) => o.includes('{tên'));

  // ---------- nạp dữ liệu ----------
  async function loadLocal() {
    const v = await sget('local', { vtData: [], vtOn: true, vtPicks: {} });
    snippets = Array.isArray(v.vtData) ? v.vtData : []; enabled = v.vtOn !== false; picks = v.vtPicks || {};
  }
  async function refresh(force) {
    if (fetching) return; fetching = true;
    try {
      const l = await sget('local', { vtAt: 0, vtBy: null });
      const sy = await sget('sync', { csName: '' });
      const by = String(sy.csName || '');
      if (!force && l.vtBy === by && Date.now() - (l.vtAt || 0) < STALE_MS) return;
      const resp = await new Promise((res) => { try { chrome.runtime.sendMessage({ type: 'GET_VIETTAT' }, (r) => res(r)); } catch (_) { res(null); } });   // lỗi đồng bộ (extension vừa reload) → null; KHÔNG dùng safe(...,res(null)) vì đối số mặc định chạy ngay
      if (resp && resp.ok && resp.data && Array.isArray(resp.data.snippets)) {
        safe(() => chrome.storage.local.set({ vtData: resp.data.snippets, vtAt: Date.now(), vtBy: by }));
      }
    } catch (_) { /* mất mạng / chưa cấu hình: dùng bản đã lưu */ } finally { fetching = false; }
  }
  loadLocal().then(() => refresh(false));
  safe(() => chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && (ch.vtData || ch.vtOn || ch.vtPicks)) loadLocal();
    if (area === 'sync' && ch.csName) refresh(true);   // đổi CS → mục riêng của người khác phải nạp lại
  }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(false); });

  // ---------- biến ----------
  function resolve(t, name) {
    const d = new Date(), p = (n) => String(n).padStart(2, '0'), f = (x) => p(x.getDate()) + '/' + p(x.getMonth() + 1) + '/' + x.getFullYear();
    t = t.split('{ngày mai}').join(f(new Date(Date.now() + 864e5))).split('{ngày}').join(f(d))
      .split('{giờ}').join(p(d.getHours()) + ':' + p(d.getMinutes()))
      .split('{thứ}').join(d.toLocaleDateString('vi-VN', { weekday: 'long' }));
    if (name) t = t.split('{tên đầy đủ}').join(name.trim()).split('{tên khách}').join(given(name)).split('{tên}').join(given(name));
    return t;
  }

  // ---------- khớp viết tắt / từ khoá ----------
  function match(w) {
    const lw = w.toLowerCase(), fw = fold(w);
    return snippets.filter((s) => String(s.abbr).toLowerCase() === lw ||
      (w.length >= 2 && String(s.keyword || '').split(',').some((k) => { k = fold(k.trim()); return k && k.startsWith(fw); })));
  }
  function analyze(before) {
    if (!before || /\s$/.test(before)) return null;
    const toks = [...before.matchAll(/\S+/g)];
    for (let k = 1; k <= 2; k++) {            // kiểu "viết tắt + tên": ch Thanh Huyền
      if (toks.length <= k) break;
      const a = toks[toks.length - 1 - k];
      const h = snippets.filter((s) => String(s.abbr).toLowerCase() === a[0].toLowerCase() && usesName(s));
      if (h.length) return { hits: h, span: before.slice(a.index), typed: toks.slice(-k).map((t) => t[0]).join(' ') };
    }
    const w = toks[toks.length - 1][0], h = match(w);
    return h.length ? { hits: h, span: w, typed: null } : null;
  }
  function ctx(el) {
    if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search)$/.test(el.type))) {
      if (el.selectionStart !== el.selectionEnd) return null;
      return { el, kind: 'input', caret: el.selectionStart, before: el.value.slice(0, el.selectionStart) };
    }
    if (!el.isContentEditable) return null;
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return null;
    const n = sel.anchorNode;
    if (!n || n.nodeType !== 3 || !el.contains(n)) return null;
    return { el, kind: 'ce', node: n, caret: sel.anchorOffset, before: n.data.slice(0, sel.anchorOffset) };
  }
  const inOwnUi = (el) => !!(el.closest && el.closest('#pk-ai-panel, #pk-slash-popup, .pk-panel-container')) || (host && host.contains(el));

  // ---------- tên khách ----------
  const clean = (t) => t.split('\n')[0].replace(/^Tới:\s*/i, '').trim();
  function findName() {
    const pn = document.getElementById('pk-ai-panel') && document.getElementById('pk-name-input');   // ô "Tên khách" của panel Pancake AI (đã tra từ SĐT)
    if (pn && pn.value && pn.value.trim()) return pn.value.trim();
    const q = (s) => { try { const e = document.querySelector(s), t = e && (e.innerText || e.textContent || '').trim(); return t && t.length < 80 ? clean(t) : null; } catch (_) { return null; } };
    if (picks[location.hostname]) { const t = q(picks[location.hostname]); if (t) return t; }
    for (const s of ['[role="main"] header h1', '[role="main"] h2', 'header h1', 'header h2']) { const t = q(s); if (t) return t; }
    return null;
  }
  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 30) {
      if (el.id && !/\d{3,}/.test(el.id)) { parts.unshift('#' + CSS.escape(el.id)); break; }
      let s = el.tagName.toLowerCase(); const p = el.parentElement;
      if (p) { const sib = [...p.children].filter((c) => c.tagName === el.tagName); if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(el) + 1) + ')'; }
      parts.unshift(s); el = p;
    }
    return parts.join('>');
  }
  function pick() {
    hide(); toast('Bấm vào tên khách trên trang (Esc để huỷ)');
    const off = () => { removeEventListener('click', h, true); removeEventListener('keydown', k, true); };
    const h = (e) => { e.preventDefault(); e.stopPropagation(); off(); picks[location.hostname] = cssPath(e.target); safe(() => chrome.storage.local.set({ vtPicks: picks })); toast('Đã lưu tên khách: ' + clean(e.target.innerText || '')); };
    const k = (e) => { if (e.key === 'Escape') off(); };
    addEventListener('click', h, true); addEventListener('keydown', k, true);
  }

  // ---------- giao diện (shadow DOM, không đụng CSS của trang) ----------
  function ui() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'pk-viettat-host';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;left:0;top:0';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>.b{position:fixed;display:none;width:max-content;max-width:min(420px,92vw);background:#fff;color:#111;border:1px solid #ccc;border-radius:12px;box-shadow:0 4px 20px #0004;font:14px system-ui;overflow:hidden}' +
      '.h{padding:6px 12px;font-size:12px;color:#888;display:flex;justify-content:space-between;gap:12px}.h a{color:#1a73e8;cursor:pointer}' +
      '.o{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-top:1px solid #eee;white-space:pre-wrap;max-height:3.6em;overflow:hidden}' +
      '.o.a,.o:hover{background:#e8f0fe}.o i{font-style:normal;font-size:11px;color:#1a73e8;background:#e8f0fe;border-radius:6px;padding:1px 6px;flex:none}' +
      '.t{position:fixed;display:none;left:50%;bottom:24px;transform:translateX(-50%);background:#333;color:#fff;padding:8px 14px;border-radius:20px;font:14px system-ui}' +
      '@media(prefers-color-scheme:dark){.b{background:#222;color:#eee;border-color:#444}.o{border-color:#333}.o.a,.o:hover{background:#2b3a55}}</style><div class="b"></div><div class="t"></div>';
    box = root.querySelector('.b'); tbox = root.querySelector('.t');
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const o = e.target.closest ? e.target.closest('.o') : null;
      if (o) choose(+o.dataset.i); else if (e.target.id === 'pk') pick();
    });
    document.documentElement.appendChild(host);
  }
  function toast(t) { ui(); tbox.textContent = t; tbox.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { tbox.style.display = 'none'; }, 2600); }
  function hide() { state = null; if (box) box.style.display = 'none'; }

  function show(st) {
    ui(); state = st;
    st.items = st.hits.flatMap((s) => s.options.map((o) => ({ text: o, abbr: s.abbr }))).slice(0, 8); st.idx = 0;
    const head = '<div class="h"><span>' + (st.uses ? (st.name ? 'Khách: <b>' + esc(given(st.name)) + '</b> ' : 'Chưa thấy tên khách ') + '<a id="pk">✎ chọn tên</a>' : 'Viết tắt') +
      '</span><span>Tab · ↑↓ · Esc</span></div>';
    box.innerHTML = head + st.items.map((o, i) => '<div class="o' + (i ? '' : ' a') + '" data-i="' + i + '"><i>' + (i < 8 ? 'Alt+' + (i + 1) : '') + '</i><span>' + esc(resolve(o.text, st.name)) + '</span></div>').join('');
    box.style.display = 'block';
    const r = st.el.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8)) + 'px';
    if (r.top > 220) { box.style.top = 'auto'; box.style.bottom = (innerHeight - r.top + 8) + 'px'; }
    else { box.style.bottom = 'auto'; box.style.top = (r.bottom + 8) + 'px'; }
  }
  function move(d) {
    const n = state.items.length; state.idx = (state.idx + d + n) % n;
    box.querySelectorAll('.o').forEach((e, i) => e.classList.toggle('a', i === state.idx));
  }

  // ---------- chèn nội dung ----------
  const nativeSet = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, 'value');
    if (d && d.set) d.set.call(el, v); else el.value = v;   // setter gốc để React/Vue nhận ra thay đổi
  };
  function put(st, text) {
    const L = st.span.length;
    if (st.kind === 'input') {
      const el = st.el, end = st.caret, v = el.value;
      if (v.slice(end - L, end) !== st.span) return false;
      el.focus(); nativeSet(el, v.slice(0, end - L) + text + v.slice(end));
      const pos = end - L + text.length; el.setSelectionRange(pos, pos);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); return true;
    }
    const n = st.node;
    if (!n.isConnected || n.data.slice(st.caret - L, st.caret) !== st.span) return false;
    st.el.focus();
    const r = document.createRange(); r.setStart(n, st.caret - L); r.setEnd(n, st.caret);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    if (!text) { document.execCommand('delete'); return true; }
    text.split('\n').forEach((ln, j) => { if (j) document.execCommand('insertLineBreak'); if (ln) document.execCommand('insertText', false, ln); });
    return true;
  }
  function choose(i) {
    const st = state; if (!st) return;
    const o = st.items[i]; hide();
    if (!o || !put(st, resolve(o.text, st.name))) toast('Vị trí gõ đã thay đổi, hãy thử lại');
  }

  // ---------- sự kiện ----------
  addEventListener('input', (e) => {
    const el = e.target;
    if (!enabled || !snippets.length || !(el instanceof Element) || inOwnUi(el)) return;
    const c = ctx(el); if (!c) return hide();
    const a = analyze(c.before); if (!a) return hide();
    const uses = a.hits.some(usesName);
    show({ ...c, ...a, uses, name: a.typed || (uses ? findName() : null) });
  }, true);
  addEventListener('keydown', (e) => {
    if (!state) return;
    if (e.key === 'Escape') return hide();
    if (e.key === 'Tab' || (e.altKey && /^[1-8]$/.test(e.key))) {
      e.preventDefault(); e.stopPropagation(); choose(e.key === 'Tab' ? state.idx : +e.key - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation(); move(e.key === 'ArrowDown' ? 1 : -1);
    }
  }, true);
  addEventListener('mousedown', (e) => { if (host && e.composedPath().includes(host)) return; hide(); }, true);
})();

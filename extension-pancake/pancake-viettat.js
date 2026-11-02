// pancake-viettat.js — VIẾT TẮT trong ô chat Pancake / Messenger (2026-10-25, tích hợp từ app "Viết Tắt" của Duyên).
// Gõ viết tắt (hoặc từ khoá) → hiện gợi ý ngay dưới/trên ô chat → Tab chèn nội dung (↑↓ đổi lựa chọn, Alt+1…8 chọn nhanh, Esc đóng).
// Nguồn dữ liệu: sheet "VietTat" của CRM qua GAS (action 'vietTat' → background GET_VIETTAT); quản lý (thêm/sửa/xoá) ở CRM → tab Zalo AI → "⌨️ Viết tắt".
// Biến trong nội dung: {tên} {tên khách} (tên gọi = chữ cuối) · {tên đầy đủ} · {ngày} {ngày mai} {giờ} {thứ}.
// Kiểu gõ có tên: "ch Thanh Huyền" (viết tắt + tên khách) hoặc để tự lấy tên từ ô "Tên khách" của panel Pancake AI / bấm "✎ chọn tên" 1 lần.
// ẢNH KÈM (2026-10-25): mục có `images` (ID ảnh Drive có sẵn, chọn ở CRM) → chèn chữ XONG thì lấy byte từng ảnh qua background (GET_VIETTAT_IMAGE) rồi dán TẤT CẢ vào ô chat
//   bằng 1 sự kiện paste (DataTransfer nhiều file). Nếu Pancake không nhận paste giả → hiện thanh "Ảnh chưa hiện?" để copy từng ảnh vào clipboard rồi Ctrl+V.
// Nhóm: `nhom` dạng "Túi tiền/Cổ" hiện dưới dạng "Túi tiền › Cổ" ngay trong dòng gợi ý.
// KHÔNG tự gửi tin: chỉ chèn chữ/ảnh vào ô soạn, CS đọc lại rồi tự bấm Gửi.
(function () {
  'use strict';
  if (window.__pkVietTatLoaded) return; window.__pkVietTatLoaded = true;
  const STALE_MS = 5 * 60 * 1000;
  let snippets = [], enabled = true, picks = {}, state = null, host = null, box = null, tbox = null, fbox = null, fetching = false;
  let pbox = null, pstate = null;               // màn chọn LỚN (chọn nhiều chữ + hình)
  const imgUrl = new Map();                      // id ảnh → blob URL hiển thị trong màn chọn
  const COARSE = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch (_) { return false; } })();   // màn cảm ứng (điện thoại) → mở thẳng màn chọn lớn
  const IMG_WORKERS = 4, IMG_CACHE_MAX = 60;   // 4 ảnh cùng lúc; nhớ tối đa 60 ảnh (1 mục có thể có 50)
  const imgCache = new Map();   // id → File (giữ trong phiên trang, tránh gọi GAS lại mỗi lần dùng cùng viết tắt)

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
      '.o em{font-style:normal;font-size:11px;color:#888;margin-left:auto;flex:none;padding-left:8px}.o .im{font-size:11px;color:#188038;flex:none}' +
      '.f{position:fixed;display:none;right:16px;bottom:72px;max-width:min(340px,90vw);background:#fff;color:#111;border:1px solid #ccc;border-radius:12px;box-shadow:0 4px 20px #0004;font:13px system-ui;padding:10px 12px}.f button{font:inherit;cursor:pointer;border:1px solid #1a73e8;background:#e8f0fe;color:#1a73e8;border-radius:8px;padding:4px 10px;margin:6px 6px 0 0}.f small{color:#888;display:block}' +
      '.t{position:fixed;display:none;left:50%;bottom:24px;transform:translateX(-50%);background:#333;color:#fff;padding:8px 14px;border-radius:20px;font:14px system-ui}' +
      '@media(prefers-color-scheme:dark){.b,.f{background:#222;color:#eee;border-color:#444}.o{border-color:#333}.o.a,.o:hover{background:#2b3a55}}</style><div class="b"></div><div class="f"></div><div class="t"></div>';
    box = root.querySelector('.b'); fbox = root.querySelector('.f'); tbox = root.querySelector('.t');
    pickerUi(root);
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const o = e.target.closest ? e.target.closest('.o') : null;
      if (o) choose(+o.dataset.i); else if (e.target.id === 'pk') pick(); else if (e.target.id === 'pkm' && state) openPicker(state);
    });
    fbox.addEventListener('mousedown', (e) => {
      e.preventDefault();   // giữ con trỏ trong ô chat
      const b = e.target.closest ? e.target.closest('button') : null; if (!b || !fstate) return;
      if (b.dataset.a === 'x') return hideFallback();
      if (b.dataset.a === 'copy') copyNext();
    });
    document.documentElement.appendChild(host);
  }
  function toast(t) { ui(); tbox.textContent = t; tbox.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { tbox.style.display = 'none'; }, 2600); }
  function hide() { state = null; pstate = null; if (box) box.style.display = 'none'; if (pbox) pbox.style.display = 'none'; }

  function show(st) {
    ui(); state = st;
    st.items = st.hits.flatMap((s) => s.options.map((o) => ({ text: o, abbr: s.abbr, nhom: s.nhom || '', images: Array.isArray(s.images) ? s.images : [] }))).slice(0, 8); st.idx = 0;
    const head = '<div class="h"><span>' + (st.uses ? (st.name ? 'Khách: <b>' + esc(given(st.name)) + '</b> ' : 'Chưa thấy tên khách ') + '<a id="pk">✎ chọn tên</a>' : 'Viết tắt') +
      '</span><span><a id="pkm">🗂 Chọn nhiều + ảnh</a> · Tab · ↑↓ · Esc</span></div>';
    box.innerHTML = head + st.items.map((o, i) => '<div class="o' + (i ? '' : ' a') + '" data-i="' + i + '"><i>' + (i < 8 ? 'Alt+' + (i + 1) : '') + '</i><span>' + esc(resolve(o.text, st.name)) + '</span>' + (o.nhom ? '<em>' + esc(o.nhom.split('/').join(' › ')) + '</em>' : '') + (o.images.length ? '<b class="im">🖼 ' + o.images.length + '</b>' : '') + '</div>').join('');
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

  // ---------- MÀN CHỌN LỚN (Duyên yêu cầu 2026-10-25) ----------
  // Bấm viết tắt → danh sách CUỘN mọi chữ + hình của mục; bấm 1 lần = chọn/bỏ chọn (nhiều cái 1 lúc); bấm đúp hình = phóng to xem full, đúp lần nữa = thu nhỏ;
  // hình hiện chính hình (không nhãn chữ). "Chèn (n)": chữ đã chọn nối bằng xuống dòng chèn vào ô chat (thay viết tắt), hình đã chọn dán vào ô chat (cơ chế sendImages cũ).
  function pickerUi(root) {
    const css = document.createElement('style');
    css.textContent = '.p{position:fixed;display:none;left:50%;bottom:0;transform:translateX(-50%);width:min(560px,100vw);height:min(86vh,calc(100vh - 12px));background:#f6f7f9;color:#111;border:1px solid #ccc;border-radius:16px 16px 0 0;box-shadow:0 -4px 24px #0005;font:16px/1.4 system-ui;flex-direction:column;overflow:hidden}' +
      '.p .ph{padding:12px 16px 6px;font-size:13px;color:#444;display:flex;justify-content:space-between;gap:8px}.p .pl{flex:1;overflow-y:auto;padding:4px 10px 10px;-webkit-overflow-scrolling:touch}' +
      '.p .c{position:relative;display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #d0d0d0;border-radius:12px;margin:8px 0;padding:14px 12px;user-select:none;-webkit-user-select:none;white-space:pre-wrap;word-break:break-word;cursor:pointer}' +
      '.p .c.on{border:3px solid #1e66f5;background:#e8f0fe;padding:12px 10px}.p .k{flex:none;width:28px;height:28px;border-radius:14px;border:2px solid #9e9e9e;background:#fff8;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center}.p .c.on .k{background:#1e66f5;border-color:#1e66f5}' +
      '.p .c.im{display:block;padding:0;overflow:hidden;background:#000}.p .c.im.on{padding:0}.p .c.im .k{position:absolute;top:8px;right:8px;z-index:2}' +
      '.p .c.im img,.p .c.im .w{display:block;width:100%;height:170px;object-fit:cover;background:#222;color:#bbb;font-size:13px;text-align:center;line-height:170px}.p .c.im.z img{height:auto;max-height:70vh;object-fit:contain;background:#000}' +
      '.p .pf{display:flex;gap:8px;padding:8px 10px 12px;background:#fff;border-top:1px solid #ddd}.p .pf button{flex:1;border:0;border-radius:10px;padding:13px 8px;font:inherit;background:#e0e0e0;color:#333;cursor:pointer}.p .pf button.go{background:#1e66f5;color:#fff;flex:1.4}.p .pf button:disabled{opacity:.45}';
    root.appendChild(css);
    pbox = document.createElement('div'); pbox.className = 'p'; root.appendChild(pbox);
    pbox.addEventListener('click', (e) => {
      const b = e.target.closest ? e.target.closest('button') : null;
      if (b) { if (b.dataset.a === 'x') hide(); else if (b.dataset.a === 'ins') insertPicked(); return; }
      const c = e.target.closest ? e.target.closest('.c') : null; if (!c || !pstate) return;
      const i = +c.dataset.i, P = pstate;
      if (P.items[i].type === 'txt') { toggleSel(i); return; }
      const T = P.tap;   // hình: bấm 1 lần = chọn (chờ 300ms để phân biệt bấm đúp), bấm đúp = phóng/thu (không đổi trạng thái chọn)
      if (T.i === i && Date.now() - T.t < 300) { clearTimeout(T.h); T.i = -1; c.classList.toggle('z'); return; }
      clearTimeout(T.h); T.i = i; T.t = Date.now(); T.h = setTimeout(() => { T.i = -1; toggleSel(i); }, 300);
    });
  }
  function toggleSel(i) { const P = pstate; if (!P) return; if (!P.sel.delete(i)) P.sel.add(i); updPicker(); }
  function updPicker() {
    const P = pstate; if (!P) return;
    pbox.querySelectorAll('.c').forEach((c) => { const on = P.sel.has(+c.dataset.i); c.classList.toggle('on', on); c.querySelector('.k').textContent = on ? '✓' : ''; });
    const n = P.sel.size, go = pbox.querySelector('[data-a=ins]');
    pbox.querySelector('.pt').innerHTML = (P.st.name ? 'Khách: <b>' + esc(given(P.st.name)) + '</b> · ' : '') + (n ? 'Đã chọn ' + n : 'Bấm để chọn (chọn được nhiều)');
    go.disabled = !n; go.textContent = n ? 'Chèn (' + n + ')' : 'Chèn';
  }
  function loadThumb(im, c) {
    const done = (url) => { if (!c.isConnected) return; const w = c.querySelector('.w'); if (!w) return; const g = document.createElement('img'); g.src = url; g.draggable = false; g.alt = ''; w.replaceWith(g); };
    if (imgUrl.has(im.id)) return done(imgUrl.get(im.id));
    getImageFile(im).then((f) => { const u = URL.createObjectURL(f); imgUrl.set(im.id, u); done(u); }, () => { const w = c.querySelector('.w'); if (w) w.textContent = '⚠ Không tải được hình'; });
  }
  function openPicker(st) {
    ui(); state = st; if (box) box.style.display = 'none';
    const items = [];
    st.hits.forEach((s) => {
      s.options.forEach((o) => items.push({ type: 'txt', text: o }));
      (Array.isArray(s.images) ? s.images : []).forEach((im) => items.push({ type: 'img', im }));
    });
    pstate = { st, items, sel: new Set(), tap: { i: -1, t: 0, h: 0 } };
    pbox.innerHTML = '<div class="ph"><span class="pt"></span><span>1 lần: chọn · đúp hình: phóng/thu</span></div><div class="pl"></div><div class="pf"><button data-a="x">✕ Đóng</button><button class="go" data-a="ins" disabled>Chèn</button></div>';
    const list = pbox.querySelector('.pl');
    items.forEach((it, i) => {
      const c = document.createElement('div'); c.dataset.i = i;
      if (it.type === 'txt') { c.className = 'c'; c.innerHTML = '<div class="k"></div><div></div>'; c.lastChild.textContent = resolve(it.text, st.name); }
      else { c.className = 'c im'; c.innerHTML = '<div class="k"></div><div class="w">Đang tải hình…</div>'; loadThumb(it.im, c); }
      list.appendChild(c);
    });
    pbox.style.display = 'flex'; updPicker();
  }
  function insertPicked() {
    const P = pstate; if (!P || !P.sel.size) return;
    const st = P.st, its = [...P.sel].sort((a, b) => a - b).map((i) => P.items[i]);
    const texts = its.filter((x) => x.type === 'txt').map((x) => resolve(x.text, st.name)), imgs = its.filter((x) => x.type === 'img').map((x) => x.im);
    hide();
    if (!put(st, texts.join('\n'))) { toast('Vị trí gõ đã thay đổi, hãy thử lại'); return; }
    if (imgs.length) sendImages(st.el, imgs);
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
    if (!o || !put(st, resolve(o.text, st.name))) { toast('Vị trí gõ đã thay đổi, hãy thử lại'); return; }
    if (o.images && o.images.length) sendImages(st.el, o.images);
  }

  // ---------- ảnh kèm ----------
  const extOf = (mime) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime] || 'jpg');
  function b64ToFile(b64, mime, name) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k);
    const nm = /\.[a-z0-9]{2,4}$/i.test(name || '') ? name : (name || 'anh') + '.' + extOf(mime);
    return new File([u], nm, { type: mime || 'image/jpeg' });
  }
  async function getImageFile(im) {
    if (imgCache.has(im.id)) return imgCache.get(im.id);
    const resp = await new Promise((res) => { try { chrome.runtime.sendMessage({ type: 'GET_VIETTAT_IMAGE', id: im.id }, (r) => res(r)); } catch (_) { res(null); } });
    if (!resp || !resp.ok || !resp.data) throw new Error((resp && resp.error) || 'không kết nối được extension');
    const f = b64ToFile(resp.data.base64, resp.data.mimeType, im.name);
    if (imgCache.size >= IMG_CACHE_MAX) imgCache.delete(imgCache.keys().next().value);
    imgCache.set(im.id, f); return f;
  }
  // 1 sự kiện paste chứa TẤT CẢ ảnh (nhiều file trong DataTransfer) → ô chat nhận như khi người dùng dán nhiều ảnh
  function pasteFiles(el, files) {
    try {
      const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f));
      el.focus();
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      return true;
    } catch (_) { return false; }
  }
  async function sendImages(el, imgs) {
    // Mục có thể có tới 50 ảnh: lấy tối đa 4 ảnh cùng lúc (không dội 50 request GAS một lượt), giữ đúng thứ tự ảnh khi dán.
    let fin = 0; const upd = () => toast('Đang lấy ảnh ' + fin + '/' + imgs.length + '...'); upd();
    const got = new Array(imgs.length); let nx = 0;
    const worker = async () => {
      while (nx < imgs.length) {
        const k = nx++, im = imgs[k];
        try { got[k] = { f: await getImageFile(im) }; } catch (e) { got[k] = { err: (im.name || im.id) + ': ' + String((e && e.message) || e) }; }
        fin++; upd();
      }
    };
    await Promise.all(Array.from({ length: Math.min(IMG_WORKERS, imgs.length) }, worker));
    const files = got.filter((x) => x.f).map((x) => x.f), errs = got.filter((x) => x.err).map((x) => x.err);
    if (!files.length) { toast('Không lấy được ảnh — ' + errs[0]); return; }
    const done = pasteFiles(el, files);
    toast((done ? 'Đã dán ' + files.length + ' ảnh' : 'Không dán tự động được') + (errs.length ? ' · lỗi ' + errs.length + ' ảnh (' + errs[0] + ')' : '') + ' — kiểm tra rồi bấm Gửi');
    showFallback(files);
  }
  // Dự phòng: Pancake có thể không nhận paste giả → copy từng ảnh vào clipboard, CS tự Ctrl+V
  let fstate = null;
  function showFallback(files) {
    ui(); clearTimeout(showFallback.t); fstate = { files, i: 0 }; renderFallback();
    showFallback.t = setTimeout(hideFallback, 45000);
  }
  function hideFallback() { fstate = null; clearTimeout(showFallback.t); if (fbox) fbox.style.display = 'none'; }
  function renderFallback() {
    const s = fstate; if (!s) return;
    fbox.innerHTML = '<div>🖼 <b>Ảnh chưa hiện trong ô chat?</b><small>Bấm để copy ảnh vào clipboard rồi nhấn Ctrl+V trong ô chat — lần lượt từng ảnh.</small></div>' +
      (s.i < s.files.length ? '<button data-a="copy">📋 Copy ảnh ' + (s.i + 1) + '/' + s.files.length + '</button>' : '<span>✓ Đã copy hết ' + s.files.length + ' ảnh</span> ') + '<button data-a="x">Đóng</button>';
    fbox.style.display = 'block';
  }
  function toPng(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); c.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('không tạo được PNG')); }, 'image/png'); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('không đọc được ảnh')); };
      img.src = url;
    });
  }
  async function copyNext() {
    const s = fstate; if (!s || s.i >= s.files.length) return;
    try {
      const png = await toPng(s.files[s.i]);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast('Đã copy ảnh ' + (s.i + 1) + '/' + s.files.length + ' — bấm Ctrl+V trong ô chat');
      s.i++; renderFallback();
    } catch (e) { toast('Copy ảnh thất bại: ' + String((e && e.message) || e)); }
  }

  // ---------- sự kiện ----------
  addEventListener('input', (e) => {
    const el = e.target;
    if (!enabled || !snippets.length || !(el instanceof Element) || inOwnUi(el)) return;
    const c = ctx(el); if (!c) return hide();
    const a = analyze(c.before); if (!a) return hide();
    const uses = a.hits.some(usesName);
    const st = { ...c, ...a, uses, name: a.typed || (uses ? findName() : null) };
    if (COARSE) openPicker(st); else show(st);   // điện thoại/cảm ứng: màn chọn lớn; máy tính: thanh gợi ý Tab/↑↓ (có nút "Chọn nhiều + ảnh")
  }, true);
  addEventListener('keydown', (e) => {
    if (!state) return;
    if (e.key === 'Escape') return hide();
    if (pstate) return;   // màn chọn lớn đang mở: chỉ dùng chuột/cảm ứng
    if (e.key === 'Tab' || (e.altKey && /^[1-8]$/.test(e.key))) {
      e.preventDefault(); e.stopPropagation(); choose(e.key === 'Tab' ? state.idx : +e.key - 1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation(); move(e.key === 'ArrowDown' ? 1 : -1);
    }
  }, true);
  addEventListener('mousedown', (e) => { if (host && e.composedPath().includes(host)) return; hide(); }, true);
})();

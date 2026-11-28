// ════════════════════════════════════════════════════════════════════
//  Ô CHỌN CÓ TÌM NHANH (27/11/2026, Duyên: "chỗ nào dropdown thì đều có thể search nhanh được chứ không chỉ kéo").
//  MỘT file áp cho MỌI <select> chọn-1 của CRM (kể cả ô được vẽ sau), KHÔNG phải sửa từng màn hình:
//  bấm vào ô → hiện khung có ô gõ tìm (không dấu, gõ nhiều từ, "lephuong" khớp "Lê Phương") + danh sách; ↑ ↓ Enter chọn, Esc đóng.
//  <select> gốc vẫn là nơi giữ giá trị: chọn xong đặt selectedIndex rồi bắn 'input' + 'change' như thao tác tay → code cũ chạy y nguyên.
//  Không can thiệp: <select multiple>, size > 1, ô bị khoá, ô có thuộc tính data-no-search (hoặc nằm trong phần tử có thuộc tính đó).
//  Tắt khẩn cấp không cần deploy: localStorage.setItem('ome_native_select','1') rồi F5.
// ════════════════════════════════════════════════════════════════════
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__selectSearch) return;
  window.__selectSearch = 1;

  var MAX_ROWS = 400;          // danh sách quá dài chỉ vẽ chừng này dòng, gõ thêm để thu hẹp
  var SHORT_LIST = 8;          // trên điện thoại: danh sách ngắn hơn mức này không tự bật bàn phím
  var cur = null;              // khung đang mở: {sel, root, input, list, rows, active, timer, sig, touch}
  var touchStart = null;

  function off(){ try { return localStorage.getItem('ome_native_select') === '1'; } catch(e){ return false; } }

  // ── Hàm thuần (tools/test-select-search.js) ─────────────────────────
  function fold(s){
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  }
  // items: [{text, group}] → chỉ số các mục khớp, giữ nguyên thứ tự gốc
  function filter(items, query){
    var q = fold(query), out = [], i;
    var words = q ? q.split(' ') : [], compact = q.replace(/ /g, '');
    for (i = 0; i < items.length; i++){
      if (!q){ out.push(i); continue; }
      var hay = fold(items[i].text + ' ' + (items[i].group || ''));
      var all = words.every(function(w){ return hay.indexOf(w) >= 0; });
      if (all || fold(items[i].text).replace(/ /g, '').indexOf(compact) >= 0) out.push(i);
    }
    return out;
  }
  // dòng được tô sẵn khi gõ: ưu tiên trùng khít → bắt đầu bằng chữ gõ → mục khớp đầu tiên
  function bestMatch(items, shown, query){
    var q = fold(query), usable = shown.filter(function(i){ return !items[i].disabled; });
    if (!usable.length) return -1;
    var exact = usable.filter(function(i){ return fold(items[i].text) === q; })[0];
    if (exact != null) return exact;
    var starts = usable.filter(function(i){ return fold(items[i].text).indexOf(q) === 0; })[0];
    return starts != null ? starts : usable[0];
  }

  function eligible(el){
    if (!el || el.tagName !== 'SELECT' || el.multiple || el.size > 1 || el.disabled) return false;
    if (el.closest && el.closest('[data-no-search]')) return false;
    return !off();
  }
  function readItems(sel){
    var items = [], o = sel.options, i;
    for (i = 0; i < o.length; i++){
      var op = o[i], g = op.parentNode && op.parentNode.tagName === 'OPTGROUP' ? op.parentNode : null;
      if (op.hidden || op.style.display === 'none' || (g && (g.hidden || g.style.display === 'none'))) continue;
      items.push({ index: i, value: op.value, text: op.label || op.text || '', group: g ? g.label : '', disabled: op.disabled || !!(g && g.disabled) });
    }
    return items;
  }
  function signature(items){ return items.map(function(it){ return it.value + '\u0001' + it.text + '\u0001' + (it.disabled ? 1 : 0); }).join('\u0002'); }

  // ── Giao diện ───────────────────────────────────────────────────────
  function css(){
    if (document.getElementById('ss-css')) return;
    var st = document.createElement('style'); st.id = 'ss-css';
    st.textContent =
      '.ss-pop{position:fixed;z-index:2147482000;display:flex;flex-direction:column;box-sizing:border-box;background:var(--ui-surface);color:var(--ui-text);border:1px solid var(--ui-border-strong);border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.24);font-family:var(--ui-font,inherit);font-size:13px;text-align:left;overflow:hidden}' +
      '.ss-q{flex:none;box-sizing:border-box;margin:6px;padding:7px 10px;border:1px solid var(--ui-border-md);border-radius:7px;background:var(--ui-bg);color:var(--ui-text);font:inherit;outline:none}' +
      '.ss-q:focus{border-color:var(--ui-brand)}' +
      '.ss-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 4px 4px}' +
      '.ss-opt{padding:6px 9px;border-radius:6px;cursor:pointer;line-height:1.35;word-break:break-word;min-height:18px}' +
      '.ss-opt.sel{font-weight:700;color:var(--ui-brand)}' +
      '.ss-opt.active{background:var(--ui-brand-soft)}' +
      '.ss-opt.dis{opacity:.45;cursor:default}' +
      '.ss-opt.ingroup{padding-left:18px}' +
      '.ss-grp{padding:7px 9px 3px;font-size:11px;font-weight:700;color:var(--ui-text-muted)}' +
      '.ss-note{padding:9px;color:var(--ui-text-muted);font-size:12px}' +
      '@media (pointer:coarse){.ss-q{font-size:16px}.ss-opt{padding-top:10px;padding-bottom:10px;font-size:14px}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function open(sel, opts){
    close(false);
    var body = document.body; if (!body) return false;
    css();
    var items = readItems(sel);
    var touch = !!(opts && opts.touch);
    var root = document.createElement('div'); root.className = 'ss-pop';
    var input = document.createElement('input'); input.type = 'text'; input.className = 'ss-q';
    input.placeholder = '🔍 Gõ để tìm nhanh…'; input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', 'ss-list'); input.setAttribute('aria-label', 'Tìm trong danh sách');
    var list = document.createElement('div'); list.className = 'ss-list'; list.id = 'ss-list'; list.setAttribute('role', 'listbox'); list.tabIndex = -1;
    root.appendChild(input); root.appendChild(list);
    // <dialog> mở dạng modal che mọi thứ ngoài nó → khung phải nằm trong chính dialog đó
    var host = (sel.closest && sel.closest('dialog[open]')) || body;
    host.appendChild(root);
    cur = { sel: sel, root: root, input: input, list: list, items: items, sig: signature(items), rows: [], active: -1, touch: touch, timer: 0 };

    // không để các bộ "bấm ra ngoài thì đóng" của menu/khung cũ nhận cú bấm trong danh sách
    ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'focusin', 'keyup', 'keypress', 'input', 'change'].forEach(function(t){
      root.addEventListener(t, function(e){ e.stopPropagation(); });
    });
    input.addEventListener('input', function(){ render(true); });
    list.addEventListener('mousedown', function(e){ e.preventDefault(); });
    list.addEventListener('click', function(e){ var r = rowOf(e.target); if (r) pick(+r.getAttribute('data-i')); });
    list.addEventListener('mousemove', function(e){ var r = rowOf(e.target); if (r) setActive(+r.getAttribute('data-i'), false); });

    if (opts && opts.query) input.value = opts.query;
    render(!!input.value);
    place();
    scrollActive(true);
    if (!touch || items.length > SHORT_LIST) { try { input.focus({ preventScroll: true }); } catch(e){ input.focus(); } }
    cur.timer = setInterval(watch, 400);
    return true;
  }

  function rowOf(el){
    while (el && cur && el !== cur.list){ if (el.getAttribute && el.getAttribute('data-i') != null && el.className.indexOf(' dis') < 0) return el; el = el.parentNode; }
    return null;
  }

  function render(fromTyping){
    if (!cur) return;
    var items = cur.items, q = cur.input.value, shown = filter(items, q), list = cur.list;
    var selected = cur.sel.selectedIndex, selPos = -1, i;
    for (i = 0; i < items.length; i++) if (items[i].index === selected){ selPos = i; break; }
    var active = fromTyping && fold(q) ? bestMatch(items, shown, q)
      : (shown.indexOf(selPos) >= 0 ? selPos : bestMatch(items, shown, ''));
    // danh sách quá dài: lấy cửa sổ quanh mục đang tô để không mất nó
    var from = 0, at = shown.indexOf(active);
    if (shown.length > MAX_ROWS && at >= MAX_ROWS) from = Math.min(at - 20, shown.length - MAX_ROWS);
    var part = shown.slice(from, from + MAX_ROWS), lastGroup = '';
    list.textContent = ''; cur.rows = [];
    part.forEach(function(i){
      var it = items[i];
      if (it.group && it.group !== lastGroup){ var h = document.createElement('div'); h.className = 'ss-grp'; h.textContent = it.group; list.appendChild(h); }
      lastGroup = it.group;
      var d = document.createElement('div');
      d.className = 'ss-opt' + (i === selPos ? ' sel' : '') + (it.group ? ' ingroup' : '') + (it.disabled ? ' dis' : '');
      d.id = 'ss-opt-' + i; d.setAttribute('data-i', i); d.setAttribute('role', 'option');
      d.setAttribute('aria-selected', i === selPos ? 'true' : 'false');
      d.textContent = it.text;
      list.appendChild(d); cur.rows.push(i);
    });
    if (!part.length){ var n = document.createElement('div'); n.className = 'ss-note'; n.textContent = 'Không tìm thấy mục nào khớp'; list.appendChild(n); }
    else if (shown.length > part.length){ var m = document.createElement('div'); m.className = 'ss-note'; m.textContent = 'Đang hiện ' + part.length + '/' + shown.length + ' mục — gõ thêm để thu hẹp'; list.appendChild(m); }
    cur.active = -1; setActive(active, fromTyping);
  }

  function setActive(i, scroll){
    if (!cur) return;
    var prev = cur.active >= 0 && cur.list.querySelector('#ss-opt-' + cur.active);
    if (prev) prev.classList.remove('active');
    cur.active = i;
    var el = i >= 0 && cur.list.querySelector('#ss-opt-' + i);
    if (el){ el.classList.add('active'); cur.input.setAttribute('aria-activedescendant', el.id); if (scroll) scrollActive(false); }
    else cur.input.removeAttribute('aria-activedescendant');
  }
  // cuộn trong danh sách, không dùng scrollIntoView (sẽ kéo cả trang)
  function scrollActive(center){
    if (!cur || cur.active < 0) return;
    var el = cur.list.querySelector('#ss-opt-' + cur.active); if (!el) return;
    var lr = cur.list.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (center) cur.list.scrollTop += (er.top - lr.top) - (lr.height - er.height) / 2;
    else if (er.top < lr.top) cur.list.scrollTop -= lr.top - er.top;
    else if (er.bottom > lr.bottom) cur.list.scrollTop += er.bottom - lr.bottom;
  }
  function move(step){
    if (!cur) return;
    var usable = cur.rows.filter(function(i){ return !cur.items[i].disabled; });
    if (!usable.length) return;
    var p = usable.indexOf(cur.active);
    p = p < 0 ? (step > 0 ? 0 : usable.length - 1) : Math.max(0, Math.min(usable.length - 1, p + step));
    setActive(usable[p], true);
  }

  function place(){
    if (!cur) return;
    var r = cur.sel.getBoundingClientRect(), vv = window.visualViewport;
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = vv ? vv.height : window.innerHeight, top0 = vv ? vv.offsetTop : 0;
    var st = cur.root.style;
    if (vw <= 600){   // điện thoại: khung rộng gần kín, nằm phía trên để bàn phím không che
      st.left = '8px'; st.width = (vw - 16) + 'px'; st.top = (top0 + 8) + 'px'; st.bottom = 'auto';
      st.maxHeight = Math.max(180, Math.round(vh * 0.7)) + 'px';
      return;
    }
    var w = Math.min(Math.max(r.width, 240), vw - 16);
    var left = Math.max(8, Math.min(r.left, vw - w - 8));
    var below = window.innerHeight - r.bottom - 10, above = r.top - 10;
    var up = below < 260 && above > below;
    st.left = left + 'px'; st.width = w + 'px';
    st.maxHeight = Math.max(140, Math.min(360, up ? above : below)) + 'px';
    if (up){ st.top = 'auto'; st.bottom = (window.innerHeight - r.top + 2) + 'px'; }
    else { st.bottom = 'auto'; st.top = (r.bottom + 2) + 'px'; }
  }

  // màn hình tự vẽ lại trong lúc đang mở: ô mất → bám sang ô cùng id, không có thì đóng; danh sách đổi → vẽ lại
  function watch(){
    if (!cur) return;
    var s = cur.sel;
    if (!s.isConnected){
      var again = s.id && document.getElementById(s.id);
      if (!again || !eligible(again)) return close(false);
      cur.sel = s = again;
    }
    if (s.disabled || (!s.getClientRects().length)) return close(false);
    var items = readItems(s), sig = signature(items);
    if (sig !== cur.sig){ cur.items = items; cur.sig = sig; render(!!cur.input.value); }
    place();
  }

  function close(refocus){
    if (!cur) return;
    var c = cur; cur = null;
    clearInterval(c.timer);
    if (c.root.parentNode) c.root.parentNode.removeChild(c.root);
    if (refocus && c.sel.isConnected){ try { c.sel.focus({ preventScroll: true }); } catch(e){} }
  }

  function pick(i){
    if (!cur) return;
    var it = cur.items[i]; if (!it || it.disabled) return;
    var sel = cur.sel;
    if (!sel.isConnected && sel.id) sel = document.getElementById(sel.id) || sel;
    var touch = cur.touch;
    close(false);
    if (!sel.isConnected) return;
    // tìm lại theo giá trị phòng khi danh sách vừa bị vẽ lại làm lệch vị trí
    var idx = it.index, o = sel.options;
    if (!o[idx] || o[idx].value !== it.value || (o[idx].label || o[idx].text || '') !== it.text){
      idx = -1;
      for (var k = 0; k < o.length; k++) if (o[k].value === it.value && (o[k].label || o[k].text || '') === it.text){ idx = k; break; }
      if (idx < 0) return;
    }
    if (!touch){ try { sel.focus({ preventScroll: true }); } catch(e){} }
    if (sel.selectedIndex === idx) return;          // chọn lại mục cũ: không bắn change (giống ô gốc)
    sel.selectedIndex = idx;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function selectOf(t){
    if (!t) return null;
    if (t.tagName === 'OPTION' || t.tagName === 'OPTGROUP') t = t.closest('select');
    return t && t.tagName === 'SELECT' ? t : null;
  }
  function inPop(t){ return !!(cur && t && cur.root.contains(t)); }

  // ── Sự kiện toàn trang (pha capture để chạy trước trình duyệt mở danh sách gốc) ──
  document.addEventListener('mousedown', function(e){
    if (inPop(e.target)) return;
    var s = selectOf(e.target);
    if (s && e.button === 0 && eligible(s)){
      e.preventDefault();
      if (cur && cur.sel === s) return close(true);
      try { s.focus({ preventScroll: true }); } catch(x){}
      open(s);
      return;
    }
    close(false);
  }, true);

  // cảm ứng: chặn ở touchend (iPhone không chặn được ở mousedown); vuốt để cuộn trang thì không mở
  document.addEventListener('touchstart', function(e){
    if (inPop(e.target)) return;
    var p = e.touches && e.touches[0];
    touchStart = p && e.touches.length === 1 ? { x: p.clientX, y: p.clientY, target: e.target, moved: false } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function(e){
    var p = e.touches && e.touches[0];
    if (touchStart && p && (Math.abs(p.clientX - touchStart.x) > 10 || Math.abs(p.clientY - touchStart.y) > 10)) touchStart.moved = true;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function(e){
    var t = touchStart; touchStart = null;
    if (!t || t.moved || inPop(t.target)) return;
    var s = selectOf(t.target);
    if (s && eligible(s)){
      if (e.cancelable) e.preventDefault();
      if (cur && cur.sel === s) return close(false);
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
      open(s, { touch: true });
    } else close(false);
  }, { capture: true, passive: false });

  // nghe ở window + capture: Esc chỉ đóng danh sách, không đóng luôn hộp thoại phía sau
  window.addEventListener('keydown', function(e){
    if (cur){
      var k = e.key;
      if (e.isComposing || e.keyCode === 229) { if (inPop(e.target)) e.stopImmediatePropagation(); return; }   // đang gõ tiếng Việt bằng bộ gõ
      if (k === 'Tab'){ close(true); return; }
      if (k === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); close(true); return; }
      if (k === 'Enter'){ e.preventDefault(); e.stopImmediatePropagation(); if (cur.active >= 0) pick(cur.active); return; }
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp'){
        e.preventDefault(); e.stopImmediatePropagation();
        move((k === 'ArrowDown' || k === 'PageDown' ? 1 : -1) * (k.indexOf('Page') === 0 ? 8 : 1));
        return;
      }
      if (inPop(e.target)){ e.stopImmediatePropagation(); return; }   // phím tắt của trang không ăn chữ đang gõ
    }
    var s = selectOf(e.target);
    if (!s || !eligible(s) || e.ctrlKey || e.metaKey) return;
    var typed = !e.altKey && e.key && e.key.length === 1 && e.key !== ' ';
    var opener = e.key === 'Enter' || e.key === ' ' || e.key === 'F4' || (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp'));
    if (typed || opener){ e.preventDefault(); e.stopImmediatePropagation(); open(s, typed ? { query: e.key } : null); }
  }, true);

  window.addEventListener('resize', place);
  window.addEventListener('scroll', function(e){ if (cur && !inPop(e.target)) place(); }, true);
  if (window.visualViewport){ window.visualViewport.addEventListener('resize', place); window.visualViewport.addEventListener('scroll', place); }
  window.addEventListener('hashchange', function(){ close(false); });

  window.selectSearch = { open: open, close: close, filter: filter, fold: fold, bestMatch: bestMatch, eligible: eligible, isOpen: function(){ return !!cur; } };
})();

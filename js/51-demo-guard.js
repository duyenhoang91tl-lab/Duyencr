// ═══ TÀI KHOẢN TEST: (1) che 4 số cuối SĐT khi hiển thị  (2) mã hóa mọi file tải về ═══
// Nạp CUỐI CÙNG trong index.html (sau mọi script khác). Chỉ có tác dụng khi đang đăng nhập tài khoản test
// (có 'ome_demo_token' trong localStorage — xem docs/TAI-KHOAN-TEST.md); tài khoản thường không bị ảnh hưởng.
//
// (1) Server (gas_v13.js: _demoMaskPhone_) đã đổi 4 chữ số cuối của SĐT thành '0' nên số vẫn là số hợp lệ (client không
//     làm rơi/gộp dòng). Ở đây chỉ thay đoạn '0000' cuối đó bằng '••••' trên giao diện cho người test thấy rõ là đã bị ẩn.
// (2) File tải về (a.download, XLSX.writeFile) được mã hóa AES-256-GCM, khóa PBKDF2 từ demoToken, đuôi '.enc'.
//     Giải mã (admin, có demoToken trong sheet Settings): node tools/decrypt-demo-file.js <file.enc> <demoToken> [file_ra]
//     Định dạng: 'DEMOENC1'(8 byte) | salt(16) | iv(12) | ciphertext+tag.  PBKDF2-SHA256, 100000 vòng.
(function () {
  'use strict';
  function tok() { try { return localStorage.getItem('ome_demo_token') || ''; } catch (e) { return ''; } }
  function isDemo() { return !!tok(); }

  // ── (1) Che SĐT trên giao diện ──
  var PH_RE = /(^|[^\d])((?:0|84)\d{5})0000(?!\d)/g;
  function maskText(s) { return String(s).replace(PH_RE, function (m, pre, head) { return pre + head + '••••'; }); }
  function maskTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixNode(root); return; }
    if (root.nodeType !== 1) return;
    var tag = root.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var p = n.parentNode && n.parentNode.tagName;
      if (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') continue;
      fixNode(n);
    }
  }
  function fixNode(n) {
    var v = n.nodeValue;
    if (v && v.length >= 10 && v.indexOf('0000') >= 0) { var m = maskText(v); if (m !== v) n.nodeValue = m; }
  }
  var _pending = [], _raf = 0;
  function flush() {
    _raf = 0; var list = _pending; _pending = [];
    if (!isDemo()) return;
    for (var i = 0; i < list.length; i++) maskTree(list[i]);
  }
  function queue(n) { _pending.push(n); if (!_raf) _raf = (window.requestAnimationFrame || setTimeout)(flush); }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(function (muts) {
      if (!isDemo()) return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') queue(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) queue(m.addedNodes[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  if (isDemo()) queue(document.body);

  // ── (2) Mã hóa file tải về ──
  var MAGIC = [68, 69, 77, 79, 69, 78, 67, 49]; // 'DEMOENC1'
  async function encBytes(bytes) {
    var t = tok(); if (!t) throw new Error('no demo token');
    var enc = new TextEncoder();
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    var km = await crypto.subtle.importKey('raw', enc.encode(t), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes));
    var out = new Uint8Array(36 + ct.length);
    out.set(MAGIC, 0); out.set(salt, 8); out.set(iv, 24); out.set(ct, 36);
    return out;
  }
  // Nhớ blob theo URL (một số chỗ revokeObjectURL ngay sau click nên không fetch lại được) — chỉ khi đang là tài khoản test
  var _blobs = new Map(), _origCreate = URL.createObjectURL, _origRevoke = URL.revokeObjectURL;
  URL.createObjectURL = function (b) {
    var u = _origCreate.apply(URL, arguments);
    if (isDemo() && b instanceof Blob) { _blobs.set(u, b); if (_blobs.size > 30) _blobs.delete(_blobs.keys().next().value); }
    return u;
  };
  var _origClick = HTMLAnchorElement.prototype.click;
  function saveEnc(out, name) {
    var url = _origCreate.call(URL, new Blob([out], { type: 'application/octet-stream' }));
    var a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); _origClick.call(a);
    setTimeout(function () { try { _origRevoke.call(URL, url); a.remove(); } catch (e) {} }, 4000);
  }
  function fail(e) { console.warn('demo-guard:', e); alert('Tài khoản test: không tải được file (lỗi mã hóa).'); }
  HTMLAnchorElement.prototype.click = function () {
    var a = this, href = a.href || '';
    if (isDemo() && a.hasAttribute('download') && /^(blob|data):/.test(href)) {
      var name = (a.getAttribute('download') || 'data') + '.enc';
      var blob = _blobs.get(href);
      var getBuf = blob ? blob.arrayBuffer() : fetch(href).then(function (r) { return r.arrayBuffer(); });
      getBuf.then(function (buf) { return encBytes(new Uint8Array(buf)); }).then(function (out) { saveEnc(out, name); }).catch(fail);
      return;
    }
    return _origClick.apply(this, arguments);
  };
  // XLSX.writeFile: thư viện nạp defer nên đợi có rồi mới bọc
  function patchXlsx() {
    if (!window.XLSX) return false;
    if (window.XLSX.__demoPatched) return true;
    var ow = XLSX.writeFile;
    XLSX.writeFile = function (wb, name, opts) {
      if (!isDemo()) return ow.apply(XLSX, arguments);
      var ext = String(name || '').split('.').pop().toLowerCase();
      var bt = (opts && opts.bookType) || (/^(xlsx|xls|csv|ods)$/.test(ext) ? ext : 'xlsx');
      var data = XLSX.write(wb, { bookType: bt, type: 'array' });
      encBytes(new Uint8Array(data)).then(function (out) { saveEnc(out, String(name || 'data.xlsx') + '.enc'); }).catch(fail);
    };
    XLSX.__demoPatched = true; return true;
  }
  if (!patchXlsx()) { var iv = setInterval(function () { if (patchXlsx()) clearInterval(iv); }, 300); setTimeout(function () { clearInterval(iv); }, 60000); }

  window.__demoGuard = { maskText: maskText, encBytes: encBytes, isDemo: isDemo };
})();

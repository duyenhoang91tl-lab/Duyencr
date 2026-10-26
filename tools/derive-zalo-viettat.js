#!/usr/bin/env node
// Sinh extension-zalo/zalo-viettat.js TU extension-pancake/pancake-viettat.js (quy tac song song Zalo AI <-> Pancake AI, docs/crm-kb/08-extension-parity.md).
// KHONG sua tay file zalo-viettat.js: sua pancake-viettat.js roi chay `node tools/derive-zalo-viettat.js`; `--check` bao LECH (dung o CI/truoc khi push).
// Khac biet co chu y (ban Zalo): goi THANG GAS nhu zalo-content.js (khong co background), ten CS/URL/khoa doc tu chrome.storage.local cua Zalo AI
// (ome_current_cs / ome_gas_url / ome_ext_key), id panel Zalo AI (#ome-zai-panel, #zai-name-input), id host giao dien rieng.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'extension-pancake', 'pancake-viettat.js'), DST = path.join(__dirname, '..', 'extension-zalo', 'zalo-viettat.js');
let s = fs.readFileSync(SRC, 'utf8');
function rep(a, b, n) { const c = s.split(a).length - 1; if (c !== (n || 1)) throw new Error('Khong khop ' + (n || 1) + ' lan (' + c + '): ' + a.slice(0, 70)); s = s.split(a).join(b); }
function between(startMark, endMark, replacement) { const i = s.indexOf(startMark), j = s.indexOf(endMark, i); if (i < 0 || j < 0) throw new Error('Khong thay doan ' + startMark.slice(0, 40)); s = s.slice(0, i) + replacement + s.slice(j); }

rep('window.__pkVietTatLoaded', 'window.__zaiVietTatLoaded', 2);
rep("const STALE_MS = 5 * 60 * 1000;", "const STALE_MS = 5 * 60 * 1000;\n  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbx3QT6YIzQ7SQEwQPkljVeEdmTSBQQSxtTp2hTFYOeCKB_K4BHcUTSLi54LlmB9q_E6sQ/exec';   // = DEFAULT_GAS_URL của zalo-content.js\n" +
  "  // URL GAS kèm src=zalo + khóa extension `ek` (giống wrapper fetch của zalo-content.js) + by=<CS đang dùng>\n" +
  "  async function gasUrl(q) {\n    const l = await sget('local', { ome_gas_url: '', ome_current_cs: '', ome_ext_key: '' });\n    const gas = l.ome_gas_url || DEFAULT_GAS_URL;\n    return { url: gas + (gas.indexOf('?') >= 0 ? '&' : '?') + q + '&by=' + encodeURIComponent(String(l.ome_current_cs || '')) + '&src=zalo' + (l.ome_ext_key ? '&ek=' + encodeURIComponent(l.ome_ext_key) : ''), by: String(l.ome_current_cs || '') };\n  }");
between('  async function refresh(force) {', '  loadLocal().then(() => refresh(false));',
`  async function refresh(force) {
    if (fetching) return; fetching = true;
    try {
      const l = await sget('local', { vtAt: 0, vtBy: null });
      const g = await gasUrl('action=vietTat');
      if (!force && l.vtBy === g.by && Date.now() - (l.vtAt || 0) < STALE_MS) return;
      const d = await (await fetch(g.url, { redirect: 'follow' })).json();
      if (d && Array.isArray(d.snippets)) safe(() => chrome.storage.local.set({ vtData: d.snippets, vtAt: Date.now(), vtBy: g.by }));
    } catch (_) { /* mất mạng / chưa cấu hình: dùng bản đã lưu */ } finally { fetching = false; }
  }
`);
rep("if (area === 'sync' && ch.csName) refresh(true);", "if (area === 'local' && ch.ome_current_cs) refresh(true);");
rep("'#pk-ai-panel, #pk-slash-popup, .pk-panel-container'", "'#ome-zai-panel'");
rep("document.getElementById('pk-ai-panel') && document.getElementById('pk-name-input');   // ô \"Tên khách\" của panel Pancake AI", "document.getElementById('ome-zai-panel') && document.getElementById('zai-name-input');   // ô \"Tên khách\" của panel Zalo AI");
rep("host.id = 'pk-viettat-host';", "host.id = 'zai-viettat-host';");
between("    const resp = await new Promise((res) => { try { chrome.runtime.sendMessage({ type: 'GET_VIETTAT_IMAGE'", "    if (imgCache.size >= 30)",
`    let r = null;
    try { const g = await gasUrl('action=vietTatImage&id=' + encodeURIComponent(im.id)); r = await (await fetch(g.url, { redirect: 'follow' })).json(); } catch (_) { r = null; }
    if (!r || r.error || r.ok === false || !r.base64) throw new Error((r && r.error) || 'không kết nối được máy chủ');
    const f = b64ToFile(r.base64, r.mimeType || 'image/jpeg', im.name);
`);
s = s.split('Pancake AI').join('Zalo AI').split('Pancake/Messenger').join('Zalo Web').split('Pancake').join('Zalo');
s = '// zalo-viettat.js — VIẾT TẮT trong ô chat Zalo Web (2026-10-25). *** FILE TỰ SINH — KHÔNG SỬA TAY: sửa extension-pancake/pancake-viettat.js rồi chạy `node tools/derive-zalo-viettat.js` ***\n' +
  '// Dẫn xuất cơ học từ pancake-viettat.js (quy tắc song song Zalo AI ⇄ Pancake AI). Khác: gọi THẲNG GAS như zalo-content.js (không có background), tên CS/URL/khóa đọc từ chrome.storage.local của Zalo AI, id panel Zalo AI.' + s.slice(s.indexOf('\n'));
const out = s;

// ── Bo ca kiem thu: tools/test-viettat-zalo.js DAN XUAT tu tools/test-viettat-ext.js (cung ca, doi nguon du lieu/id panel) ──
const TSRC = path.join(__dirname, 'test-viettat-ext.js'), TDST = path.join(__dirname, 'test-viettat-zalo.js');
let t = fs.readFileSync(TSRC, 'utf8');
function trep(a, b) { const c = t.split(a).length - 1; if (c < 1) throw new Error('Test: khong thay: ' + a.slice(0, 70)); t = t.split(a).join(b); }
trep("extension-pancake', 'pancake-viettat.js'", "extension-zalo', 'zalo-viettat.js'");
trep("Viet Tat trong Pancake AI (extension-pancake/pancake-viettat.js)", "Viet Tat trong Zalo AI (extension-zalo/zalo-viettat.js)");
trep("'pk-viettat-host'", "'zai-viettat-host'"); trep("pk-ai-panel", "ome-zai-panel"); trep("pk-name-input", "zai-name-input"); trep("pk-inner", "zai-inner");
trep("url: 'https://pancake.vn/x'", "url: 'https://chat.zalo.me/x'");
trep("vtBy: opts.by === undefined ? '' : opts.by }, opts.local || {}), sync: Object.assign({ csName: '' }, opts.sync || {}) };",
     "vtBy: opts.by === undefined ? '' : opts.by, ome_gas_url: 'https://gas.test/exec', ome_current_cs: opts.cs || '', ome_ext_key: 'ek_1' }, opts.local || {}), sync: {} };");
{ // thay mock runtime.sendMessage (Pancake) bang fetch gia (Zalo goi thang GAS)
  const i = t.indexOf("runtime: { sendMessage:"); const j = t.indexOf("};", t.indexOf("cb({ ok: true, data: { snippets:", i)) + 2;
  if (i < 0 || j < 2) throw new Error('Test: khong thay mock runtime');
  t = t.slice(0, i) + "runtime: {} };\n  w.fetch = async (u) => {\n    const img = /action=vietTatImage&id=([^&]+)/.exec(u);\n    if (img) { const m = { type: 'GET_VIETTAT_IMAGE', id: decodeURIComponent(img[1]), url: u }; calls.msgs.push(m); const r = opts.imgResp ? opts.imgResp(m) : { ok: true, data: { base64: 'QUJD', mimeType: 'image/png' } }; return { json: async () => (r.ok ? { ok: true, base64: r.data.base64, mimeType: r.data.mimeType } : { ok: false, error: r.error }) }; }\n    calls.msgs.push({ type: 'GET_VIETTAT', url: u }); return { json: async () => ({ ok: true, snippets: opts.server || [{ id: 'z', abbr: 'zz', keyword: '', options: ['Từ server'], scope: 'team' }] }) };\n  };" + t.slice(j);
}
trep("E = await boot({ by: 'Hoa cu' });", "E = await boot({ by: 'Hoa cu', cs: 'Hoa' });");
trep("E.listeners.forEach((l) => l({ csName: { newValue: 'Binh' } }, 'sync'));", "E.listeners.forEach((l) => l({ ome_current_cs: { newValue: 'Binh' } }, 'local'));");
trep("ALL VIETTAT-EXT TESTS PASSED", "ALL VIETTAT-ZALO TESTS PASSED");
{ const k = t.lastIndexOf("console.log(bad ?"); if (k < 0) throw new Error('Test: khong thay dong console.log cuoi');
  t = t.slice(0, k) + "  E = await boot({ stale: true, cs: 'Hoa Binh' }); ok(/^https:\\/\\/gas\\.test\\/exec\\?action=vietTat&by=Hoa%20Binh&src=zalo&ek=ek_1$/.test(E.calls.msgs[0].url), 'goi THANG GAS: action=vietTat&by=<CS>&src=zalo&ek=<khoa>: ' + E.calls.msgs[0].url);\n" + t.slice(k); }
t = t.replace(/^(#!.*\n)?/, (m) => (m || '') + '// *** FILE TU SINH tu tools/test-viettat-ext.js bang `node tools/derive-zalo-viettat.js` — KHONG sua tay ***\n');
t = t.split('Pancake AI').join('Zalo AI');

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(DST) ? fs.readFileSync(DST, 'utf8') : '', curT = fs.existsSync(TDST) ? fs.readFileSync(TDST, 'utf8') : '';
  if (cur !== out || curT !== t) { console.error('LECH: zalo-viettat.js / test-viettat-zalo.js khong khop ban Pancake — chay `node tools/derive-zalo-viettat.js`'); process.exit(1); }
  console.log('OK: zalo-viettat.js + test-viettat-zalo.js khop ban Pancake'); process.exit(0);
}
fs.writeFileSync(DST, out); fs.writeFileSync(TDST, t); console.log('Da sinh zalo-viettat.js (' + out.split('\n').length + ' dong) + test-viettat-zalo.js (' + t.split('\n').length + ' dong)');

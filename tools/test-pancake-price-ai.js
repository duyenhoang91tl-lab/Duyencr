#!/usr/bin/env node
// Test "Hoi AI ve gia" cua Pancake AI: background (handleAskPrice qua message ASK_PRICE, nap pancake-background.js THAT voi chrome/fetch gia)
// + kiem tra content.js/css da noi nut 🤖 Hoi AI (cau truc, vi content script can trinh duyet that de chay UI).
// Chay: node tools/test-pancake-price-ai.js -> "ALL PANCAKE PRICE-AI TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const root = path.join(__dirname, '..', 'extension-pancake');
const bg = fs.readFileSync(path.join(root, 'pancake-background.js'), 'utf8');

function load(settings) {
  const env = { listeners: [], fetches: [], fetchImpl: null, settings };
  const noop = () => {};
  const chrome = { runtime: { onInstalled: { addListener: noop }, onMessage: { addListener: fn => env.listeners.push(fn) }, openOptionsPage: noop, getURL: x => x },
    storage: { sync: { get: (k, cb) => { if (typeof cb === 'function') cb(env.settings); return Promise.resolve(env.settings); }, set: noop }, local: { get: (k, cb) => { if (typeof cb === 'function') cb({}); return Promise.resolve({}); }, set: noop }, onChanged: { addListener: noop } },
    alarms: { create: noop, onAlarm: { addListener: noop } }, action: { onClicked: { addListener: noop } }, tabs: {}, webRequest: {} };
  const ctx = { chrome, console, JSON, Promise, setTimeout, clearTimeout, URL, Date, Math, String, Number, Array, Object, encodeURIComponent, importScripts: noop,
    fetch: async (u, o) => { env.fetches.push({ u, o }); return env.fetchImpl(u, o); } };
  ctx.self = ctx; vm.createContext(ctx); vm.runInContext(bg, ctx, { filename: 'pancake-background.js' });
  env.send = (msg) => new Promise(res => { const ret = env.listeners[0](msg, {}, res); if (ret !== true) res({ ok: false, error: 'khong xu ly (listener tra ' + ret + ')' }); });
  return env;
}
(async () => {
  let e = load({ gasUrl: 'https://script.google.com/macros/s/ABC/exec' });
  ok(e.listeners.length >= 1, 'nap background that, co listener');
  e.fetchImpl = async () => ({ json: async () => ({ ok: true, found: true, text: 'Nhẫn Bạc Trơn size 12 giá 450.000đ ạ.', provider: 'Groq', base: 'x' }) });
  let r = await e.send({ type: 'ASK_PRICE', payload: { q: ' giá nhẫn bạc trơn ' } });
  ok(r.ok && r.data.found && r.data.text.startsWith('Nhẫn Bạc Trơn') && r.data.provider === 'Groq' && r.data.aiError === '' && Array.isArray(r.data.suggestions), 'tra loi van ngan: ' + JSON.stringify(r));
  const f = e.fetches[0]; ok(f.u === 'https://script.google.com/macros/s/ABC/exec' && f.o.method === 'POST' && JSON.parse(f.o.body).action === 'priceQa' && JSON.parse(f.o.body).q === 'giá nhẫn bạc trơn' && JSON.parse(f.o.body).src === 'pancake' && f.o.headers['Content-Type'] === 'text/plain', 'POST action=priceQa, q da trim, qua wrapper fetch (them src=pancake, body van la JSON hop le), text/plain: ' + JSON.stringify(f.o));
  ok(!JSON.stringify(f.o).includes('apiKey'), 'khong gui key nao');
  // khong thay -> goi y
  e.fetchImpl = async () => ({ json: async () => ({ ok: true, found: false, suggestions: ['A', 'B'], text: '' }) });
  r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá nhẫn' } }); ok(r.ok && !r.data.found && r.data.suggestions.join() === 'A,B', 'khong thay -> goi y');
  // AI loi nhung gia van dung
  e.fetchImpl = async () => ({ json: async () => ({ ok: true, found: true, text: 'Giá theo bảng giá: 450', aiError: '429' }) });
  r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá nhẫn bạc trơn' } }); ok(r.ok && r.data.aiError === '429' && /450/.test(r.data.text), 'aiError duoc chuyen cho UI');
  // loi
  e.fetches.length = 0; r = await e.send({ type: 'ASK_PRICE', payload: { q: '   ' } }); ok(!r.ok && /Thiếu câu hỏi/.test(r.error) && e.fetches.length === 0, 'q rong: khong goi GAS');
  e.fetchImpl = async () => ({ json: async () => ({ error: 'Unknown action priceQa' }) });
  r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá a' } }); ok(!r.ok && /chờ deploy/.test(r.error), 'GAS cu: goi y cho deploy');
  e.fetchImpl = async () => ({ json: async () => ({ ok: false, error: 'Bang gia (DANH_MUC) dang rong' }) });
  r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá a' } }); ok(!r.ok && /dang rong/.test(r.error), 'loi backend duoc chuyen nguyen van');
  e.fetchImpl = async () => { throw new Error('mat mang'); };
  r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá a' } }); ok(!r.ok && /Không gọi được GAS: mat mang/.test(r.error), 'loi mang');
  e = load({ gasUrl: '' }); r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá a' } }); ok(!r.ok && /Chưa cấu hình URL/.test(r.error), 'chua cau hinh GAS');
  // AI rieng cua CS khong duoc dung cho gia (khong co du lieu gia): van goi GAS
  e = load({ gasUrl: 'https://script.google.com/macros/s/ABC/exec', aiProvider: 'groq', aiApiKey: 'SECRET' });
  e.fetchImpl = async () => ({ json: async () => ({ ok: true, found: true, text: 'ok' }) });
  r = await e.send({ type: 'ASK_PRICE', payload: { q: 'giá a' } }); ok(r.ok && e.fetches.length === 1 && e.fetches[0].u === 'https://script.google.com/macros/s/ABC/exec' && !JSON.stringify(e.fetches[0]).includes('SECRET'), 'AI rieng cua CS KHONG duoc dung cho gia; khong lo key');
  // content.js + css da noi
  const ct = fs.readFileSync(path.join(root, 'pancake-content.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'pancake-content.css'), 'utf8');
  ok(/id="pk-price-ai-btn"/.test(ct) && /id="pk-price-ai" style="display:none"/.test(ct) && /#pk-price-ai-btn"\)\.addEventListener\("click", askPriceAi_\)/.test(ct) && /type: 'ASK_PRICE'/.test(ct), 'content.js: nut + khung ket qua + listener + gui ASK_PRICE');
  ok(/#pk-price-ai \{/.test(css) && /\.pk-price-ai-txt/.test(css) && /pre-wrap/.test(css), 'css cho khung tra loi');
  ok(/escapeHtml\(d\.text\)/.test(ct) && !/innerHTML = d\.text|innerHTML = `\$\{d\.text/.test(ct), 'cau tra loi AI duoc escapeHtml truoc khi chen vao DOM (chong chen HTML)');
  console.log('ALL PANCAKE PRICE-AI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

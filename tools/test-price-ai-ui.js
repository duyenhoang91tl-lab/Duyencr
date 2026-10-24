#!/usr/bin/env node
// Test (jsdom) UI nut "🤖 Hoi AI ve gia" cua CA HAI extension: Zalo AI (askPriceAiZai_) va Pancake AI (askPriceAi_) — QUY TAC: tinh nang co o ben nay thi ben kia cung co.
// Hai ham duoc cat NGUYEN VAN tu zalo-content.js / pancake-content.js (khong sao chep) va chay chung 1 bo ca kiem thu.
// CAN: npm i jsdom (thieu thi tu bo qua). Chay: node tools/test-price-ai-ui.js -> "ALL PRICE-AI UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function cut(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('khong thay ' + a.slice(0, 40) + ' .. ' + b.slice(0, 40)); return src.slice(i, j); }
const zchunk = cut(zsrc, '  let _zaiPriceAiSeq = 0;', '  // ── GOI Y TIN NHAN THEO SAN PHAM');
const pchunk = cut(psrc, '  let _priceAiSeq = 0;', '  function doPriceSearch_() {');

// Moi "ben" = {name, mk(gasUrl)} tra ve { run(q) -> bam nut Hoi AI, box, input, calls, setReply, w }
function zalo(gasUrl) {
  const dom = new JSDOM('<!doctype html><body><input id="zai-price-q"><div id="zai-price-ai" style="display:none"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window, env = { calls: [], reply: null, delay: 0, clip: [] };
  w.navigator.clipboard = { writeText: async t => { env.clip.push(t); } };
  const fetchFn = async (url, o) => { env.calls.push({ url, body: JSON.parse(o.body), method: o.method, ct: o.headers['Content-Type'] }); const r = env.reply; if (env.delay) await sleep(env.delay); if (r instanceof Error) throw r; return { json: async () => r }; };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');   // y het escHtml cua Zalo (KHONG escape dau nhay)
  const fn = new w.Function('escHtml', 'GAS_URL', 'fetch', 'document', 'navigator', zchunk + '\nreturn askPriceAiZai_;');
  const ask = fn(esc, gasUrl, fetchFn, w.document, w.navigator);
  return { name: 'Zalo AI', w, env, box: w.document.getElementById('zai-price-ai'), input: w.document.getElementById('zai-price-q'), click: ask, url: gasUrl };
}
function pancake(gasUrl) {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><input id="pk-price-q"><div id="pk-price-ai" style="display:none"></div></div></body>', { runScripts: 'outside-only' });
  const w = dom.window, env = { calls: [], reply: null, delay: 0, clip: [] };
  w.navigator.clipboard = { writeText: async t => { env.clip.push(t); } };
  const panelEl = w.document.getElementById('panel');
  const safeSendMessage_ = (msg, cb) => { env.calls.push({ url: gasUrl, body: { action: 'priceQa', q: msg.payload.q }, type: msg.type }); const r = env.reply; setTimeout(() => cb(r instanceof Error ? { ok: false, error: r.message } : (r && r.__bg_error ? { ok: false, error: r.__bg_error } : { ok: true, data: r })), env.delay); };
  const escapeHtml = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fn = new w.Function('panelEl', 'safeSendMessage_', 'escapeHtml', 'navigator', 'document', pchunk + '\nreturn askPriceAi_;');
  const ask = fn(panelEl, safeSendMessage_, escapeHtml, w.navigator, w.document);
  return { name: 'Pancake AI', w, env, box: w.document.getElementById('pk-price-ai'), input: w.document.getElementById('pk-price-q'), click: ask, url: gasUrl };
}
const FOUND = { ok: true, found: true, text: 'Nhẫn Bạc Trơn size 12 giá 450.000đ ạ.\nBạc 925 - 16cm - 2.310.000đ', provider: 'Groq' };

(async () => {
  for (const mk of [zalo, pancake]) {
    const T = mk('https://gas.test/exec'), N = T.name, d = T.w.document;
    const btn = sel => T.box.querySelector(sel);
    // 1. tim thay: hien van ngan (giu xuong dong), nhan nguon, goi dung action
    T.input.value = '  giá nhẫn bạc trơn  '; T.env.reply = FOUND; await T.click(); await sleep(30);
    ok(T.box.style.display !== 'none' && /Nhẫn Bạc Trơn size 12 giá 450\.000đ/.test(T.box.textContent) && /Bạc 925 - 16cm/.test(T.box.textContent), N + ': hien cau tra loi');
    ok(/Giá lấy từ bảng giá DANH_MUC · AI: Groq/.test(T.box.textContent) && !/AI đang lỗi/.test(T.box.textContent), N + ': ghi nguon (bang gia + provider), khong bao loi AI');
    ok(T.env.calls.length === 1 && T.env.calls[0].body.action === 'priceQa' && T.env.calls[0].body.q === 'giá nhẫn bạc trơn', N + ': goi priceQa voi q da trim: ' + JSON.stringify(T.env.calls[0]));
    if (N === 'Zalo AI') ok(T.env.calls[0].method === 'POST' && T.env.calls[0].ct === 'text/plain' && T.env.calls[0].url === 'https://gas.test/exec', 'Zalo: POST text/plain toi link GAS');
    else ok(T.env.calls[0].type === 'ASK_PRICE', 'Pancake: gui message ASK_PRICE cho background');
    // copy
    const cp = [...T.box.querySelectorAll('button')].find(b => /Copy/.test(b.textContent)); ok(cp, N + ': co nut Copy');
    cp.click(); await sleep(20); ok(T.env.clip[0] === FOUND.text && /Đã copy/.test(cp.textContent), N + ': Copy dung noi dung tra loi');
    // 2. AI loi nhung gia van dung
    T.env.reply = { ok: true, found: true, text: 'Giá theo bảng giá (nghìn đồng):\nBạc 925 - 450', aiError: '429' }; await T.click(); await sleep(30);
    ok((/^Zalo/.test(N) ? /AI đang lỗi nên hiện danh sách giá gốc/ : /Lỗi API — hiện danh sách giá gốc/).test(T.box.textContent) && /Bạc 925 - 450/.test(T.box.textContent), N + ': AI loi -> van hien gia + ghi chu (Pancake dung cau chuan "Lỗi API" tu commit ddaf130)');
    // 3. khong tim thay + goi y (ten co dau nhay/ky tu dac biet -> khong vo giao dien, bam duoc)
    const odd = 'Nhẫn "925" <b>x</b> \'Ý\''; T.env.reply = { ok: true, found: false, suggestions: [odd, 'Dây chuyền'] }; await T.click(); await sleep(30);
    ok(/Chưa tìm thấy/.test(T.box.textContent) && T.box.querySelectorAll('button').length === 2 && !T.box.querySelector('b'), N + ': khong thay -> 2 goi y, khong chen HTML tu ten san pham');
    T.env.reply = FOUND; const n0 = T.env.calls.length; T.box.querySelectorAll('button')[0].click(); await sleep(40);
    ok(T.input.value === odd && T.env.calls.length === n0 + 1 && T.env.calls[n0].body.q === odd && /450\.000đ/.test(T.box.textContent), N + ': bam goi y -> dien vao o tim dung nguyen ten (ke ca dau nhay) va hoi lai');
    // 4. o trong: nhac, khong goi
    T.input.value = '   '; const n1 = T.env.calls.length; await T.click(); await sleep(20);
    ok(T.env.calls.length === n1 && /Gõ câu hỏi về giá trước/.test(T.box.textContent), N + ': o trong -> nhac, khong goi');
    T.input.value = 'giá a';
    // 5. loi: backend cu, loi nghiep vu, loi mang
    T.env.reply = N === 'Zalo AI' ? { error: 'Unknown action priceQa' } : { __bg_error: 'Unknown action priceQa (GAS chưa lên bản có \'Hỏi AI về giá\' — chờ deploy xong rồi thử lại)' };
    await T.click(); await sleep(30); ok(/chờ deploy/.test(T.box.textContent) && T.box.querySelector('.' + (N === 'Zalo AI' ? 'zai-price-ai-err' : 'pk-price-ai-err')), N + ': GAS cu -> goi y cho deploy, to mau loi');
    T.env.reply = N === 'Zalo AI' ? { ok: false, error: 'Bang gia (DANH_MUC) dang rong' } : { __bg_error: 'Bang gia (DANH_MUC) dang rong' };
    await T.click(); await sleep(30); ok(/dang rong/.test(T.box.textContent), N + ': loi backend hien nguyen van');
    T.env.reply = new Error('mat mang'); await T.click(); await sleep(30); ok(/mat mang/.test(T.box.textContent) && /⚠/.test(T.box.textContent), N + ': loi mang hien ⚠');
    // 6. chen HTML trong cau tra loi AI: phai bi escape
    T.env.reply = { ok: true, found: true, text: '<img src=x onerror=alert(1)> <script>1</script> giá', provider: '<i>x</i>' }; await T.click(); await sleep(30);
    ok(!T.box.querySelector('img') && !T.box.querySelector('script') && !T.box.querySelector('i') && /<img src=x/.test(T.box.textContent), N + ': cau tra loi/provider duoc escape, khong chen duoc HTML');
    // 7. hoi 2 cau lien tiep: cau cu tra ve cham khong de len cau moi
    T.env.delay = 80; T.env.reply = { ok: true, found: true, text: 'CAU CU' }; const p1 = T.click(); T.env.delay = 5; T.env.reply = { ok: true, found: true, text: 'CAU MOI' }; const p2 = T.click(); await Promise.all([p1, p2]); await sleep(150);
    ok(/CAU MOI/.test(T.box.textContent) && !/CAU CU/.test(T.box.textContent), N + ': cau tra loi cham cua lan hoi truoc KHONG de len lan hoi sau');
    T.env.delay = 0;
  }
  // rieng Zalo: chua cai URL GAS
  const Z = zalo(''); Z.input.value = 'giá a'; await Z.click(); ok(/Chưa cài đặt URL GAS/.test(Z.box.textContent) && Z.env.calls.length === 0, 'Zalo: chua cai URL GAS -> nhac, khong goi');
  // dong bo 2 ben: cung chuoi thong bao nguoi dung thay
  for (const s of ['Gõ câu hỏi về giá trước (vd: giá nhẫn bạc trơn size 12).', '🤖 Đang hỏi AI…', 'Giá lấy từ bảng giá DANH_MUC', 'Chưa tìm thấy sản phẩm khớp rõ trong bảng giá. Gõ rõ TÊN sản phẩm (kèm chất liệu / size nếu có).', 'Có thể bạn muốn hỏi', '📋 Copy', "GAS chưa lên bản có 'Hỏi AI về giá' — chờ deploy xong rồi thử lại"])
    ok(zchunk.includes(s) && (pchunk + fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-background.js'), 'utf8')).includes(s), 'cau chu giong nhau o 2 extension: ' + s);
  // QUY TAC SONG SONG — DANG LECH CO CHU DICH: Pancake AI da chuan hoa moi loi API thanh 'Lỗi API' (ddaf130); Zalo AI van noi 'AI đang lỗi nên hiện danh sách giá gốc'.
  ok(zchunk.includes('AI đang lỗi nên hiện danh sách giá gốc') && (pchunk).includes('Lỗi API — hiện danh sách giá gốc'), 'moi ben giu dung cau loi cua minh');
  console.log('!!   CANH BAO: cau bao loi AI cua Zalo CHUA giong Pancake ("Lỗi API") — can lam Zalo song song');
  console.log('ALL PRICE-AI UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

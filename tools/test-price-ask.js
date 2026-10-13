#!/usr/bin/env node
// Test HOI GIA SAN PHAM cua tro ly noi bo: GAS priceAsk_/_crmAskPriceBlock_/callAI_(withPrices)/doGet(action=priceAsk) tren bang gia MAU
// (chay dung _priceVariantsForPrompt_ that) + client js/38-pro-dock.js (proPriceIntent_/proPriceRequest_/proPriceFormat_/proAiSend_ voi DOM gia).
// Chay: node tools/test-price-ask.js -> "ALL PRICE-ASK TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const root = path.join(__dirname, '..');

// ───────────────── GAS ─────────────────
const CATALOG = [
  { 'Nhóm': 'Vòng tay', 'Tên thương mại': 'Vòng tay Phong Thủy', 'Tên sản phẩm': 'Vòng tay Phong Thủy', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': '16cm', 'Giá bán': '2.310', 'Giá SAPHIA': '2.900', 'Giá RUBY': '3.100' },
  { 'Nhóm': 'Vòng tay', 'Tên thương mại': 'Vòng tay Phong Thủy', 'Tên sản phẩm': 'Vòng tay Phong Thủy', 'Chất liệu': 'Vàng 18K', 'Kiểu/Size': '18cm', 'Giá bán': '9.500', 'Giá SAPHIA': '10.200' },
  { 'Nhóm': 'Nhẫn', 'Tên thương mại': 'Nhẫn Bạc Trơn', 'Tên sản phẩm': 'Nhẫn Bạc Trơn', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': 'Size 12', 'Giá bán': '450' },
  { 'Nhóm': 'Dây chuyền', 'Tên thương mại': 'Dây chuyền Bạc Ý', 'Tên sản phẩm': 'Dây chuyền Bạc Ý', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': '45cm', 'Giá bán': '1.250' }
];
function makeEnv(o) {
  o = o || {};
  const env = { cat: o.cat === undefined ? CATALOG : o.cat, cachePuts: 0, throwCat: false, props: { apiGroq: 'KEY' }, sys: null };
  const store = {};
  const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, encodeURIComponent,
    Logger: { log() {} }, LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => null, setProperty() {}, deleteProperty() {}, getProperties: () => ({}) }) },
    CacheService: { getScriptCache: () => ({ get: k => store[k] || null, put: (k, v) => { store[k] = v; env.cachePuts++; }, remove() {}, removeAll() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'gas_v13.js'), 'utf8'), ctx, { filename: 'gas_v13.js' });
  ctx.readPriceCatalog_ = () => { if (env.throwCat) throw new Error('khong mo duoc sheet'); return env.cat; };
  ctx.getSetting_ = k => env.props[k] || '';
  ctx.getCrmSS_ = () => ({ getSheetByName: () => null }); ctx.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => null }), openById: () => ({ getSheetByName: () => null }) };
  ctx._aiOpenAICompat_ = (pv, sys, msg) => { env.sys = sys; env.msg = msg; return { ok: true, text: 'tra loi' }; };
  env.run = c => vm.runInContext(c, ctx); env.ctx = ctx;
  env.out = o => JSON.parse(o.getContent());
  return env;
}
let e = makeEnv();
let r = e.run("priceAsk_('giá vòng tay phong thủy bao nhiêu')");
ok(r.ok && r.found && /Bạc 925/.test(r.text) && /Vàng 18K/.test(r.text) && /2\.310/.test(r.text) && /9\.500/.test(r.text) && !/2\.900|3\.100/.test(r.text) && /nghin/.test(r.unit), 'khong noi ro chat lieu/size: liet ke DU bien the, chi gia mac dinh (khong lo SAPHIA/RUBY): ' + JSON.stringify(r).slice(0, 300));
r = e.run("priceAsk_('giá vòng tay phong thủy saphia')");
ok(r.found && /2\.900/.test(r.text) && !/2\.310/.test(r.text), 'nhac SAPHIA: chi gia loai da do');
r = e.run("priceAsk_('Giá RUBY vòng tay phong thủy')");
ok(r.found && /3\.100/.test(r.text) && /không có giá riêng cho RUBY/.test(r.text), 'RUBY: bien the khong co gia RUBY thi noi ro');
r = e.run("priceAsk_('nhẫn bạc trơn bao nhiêu tiền')"); ok(r.found && /450/.test(r.text) && !/Vòng tay/.test(r.text), 'tra dung san pham khac');
// khong khop du -> goi y ten; khong co gi -> mang rong
r = e.run("priceAsk_('giá nhẫn')"); ok(r.ok && !r.found && r.suggestions.length === 1 && r.suggestions[0] === 'Nhẫn Bạc Trơn', 'chi 1 tu khoa: khong bao gia vo doan, goi y ten: ' + JSON.stringify(r));
r = e.run("priceAsk_('giá xe máy')"); ok(r.ok && !r.found && r.suggestions.length === 0, 'khong co san pham: khong goi y bua');
r = e.run("priceAsk_('   ')"); ok(!r.ok && /Thieu/.test(r.error), 'q rong');
r = e.run("priceAsk_('" + 'x'.repeat(500) + "')"); ok(r.ok, 'q dai bi cat 200 ky tu, khong loi');
e = makeEnv({ cat: [] }); r = e.run("priceAsk_('giá nhẫn bạc trơn')"); ok(!r.ok && /rong|chua doc/.test(r.error), 'bang gia rong: bao ro');
e = makeEnv(); e.throwCat = true; r = e.run("priceAsk_('giá nhẫn bạc trơn')"); ok(!r.ok && /Khong doc duoc bang gia/.test(r.error), 'doc sheet loi: tra loi ro, khong nem');
e = makeEnv(); e.run("priceAsk_('giá nhẫn bạc trơn')"); e.run("priceAsk_('giá vòng tay phong thủy')"); ok(e.cachePuts === 1, 'bang gia chi doc sheet 1 lan (cache 10 phut): ' + e.cachePuts);
// khoi bang gia cho AI (crmAsk + withPrices)
e = makeEnv();
let b = e.run("_crmAskPriceBlock_('giá nhẫn bạc trơn')"); ok(/BANG GIA CHINH THUC/.test(b) && /450/.test(b) && /KHONG bia gia/.test(b), 'khoi bang gia co so lieu that + cam bia');
b = e.run("_crmAskPriceBlock_('giá xe máy')"); ok(/KHONG tim thay/.test(b) && /KHONG tu bia gia/.test(b) && !/450/.test(b), 'khong tim thay: bao AI noi ro, cam bia');
let o = e.out(e.run("callAI_({prompt:'NGỮ CẢNH: x CÂU HỎI: giá nhẫn bạc trơn', crmAsk:true, withPrices:true, priceQuery:'giá nhẫn bạc trơn'})"));
ok(o.ok && e.sys.includes('trợ lý nội bộ') && e.sys.includes('BANG GIA CHINH THUC') && e.sys.includes('450'), 'callAI_ crmAsk + withPrices: prompt he thong kem bang gia that');
e.sys = null; o = e.out(e.run("callAI_({prompt:'NGỮ CẢNH: x CÂU HỎI: tóm tắt', crmAsk:true})"));
ok(o.ok && e.sys.includes('trợ lý nội bộ') && !e.sys.includes('BANG GIA'), 'KHONG withPrices: prompt tro ly khong doi (khong keo bang gia)');
// doGet
let g = e.out(e.run("doGet({parameter:{action:'priceAsk', q:'giá nhẫn bạc trơn'}})"));
ok(g.ok && g.found && /450/.test(g.text), 'doGet action=priceAsk: ' + JSON.stringify(g).slice(0, 200));
g = e.out(e.run("doGet({parameter:{action:'priceAsk'}})")); ok(g.ok === false && /Thieu/.test(g.error), 'doGet thieu q');

// ── priceQa_ (Pancake AI "Hoi AI": van ngan) ──
e = makeEnv(); let aiCalls = 0, aiMode = 'ok';
e.ctx._aiOpenAICompat_ = (pv, sys, msg) => { aiCalls++; e.sys = sys; e.msg = msg; if (aiMode === 'throw') throw new Error('mat mang'); return aiMode === 'ok' ? { ok: true, text: 'Nhẫn Bạc Trơn size 12 giá 450.000đ ạ.' } : { ok: false, error: '429 rate limit' }; };
r = e.run("priceQa_('giá nhẫn bạc trơn')");
ok(r.ok && r.found && r.text === 'Nhẫn Bạc Trơn size 12 giá 450.000đ ạ.' && r.provider === 'Groq' && /450/.test(r.base) && !r.aiError && aiCalls === 1, 'tim thay -> AI tra loi van ngan: ' + JSON.stringify(r));
ok(/toi da 3 cau/.test(e.sys) && /BANG GIA CHINH THUC/.test(e.sys) && /450/.test(e.sys) && /KHONG bia gia/.test(e.sys) && !/SAN PHAM:|QUY TRINH CSKH|MAU TIN NHAN/.test(e.sys) && e.msg === 'giá nhẫn bạc trơn', 'prompt rieng: van ngan + bang gia that + cam bia; KHONG keo kien thuc/FAQ cua luong tra loi khach');
aiCalls = 0; r = e.run("priceQa_('giá xe máy')"); ok(r.ok && !r.found && r.suggestions.length === 0 && aiCalls === 0, 'khong co san pham -> KHONG goi AI (khong ton token, khong co hoi bia)');
aiCalls = 0; r = e.run("priceQa_('giá nhẫn')"); ok(r.ok && !r.found && r.suggestions[0] === 'Nhẫn Bạc Trơn' && aiCalls === 0, 'chi 1 tu khoa -> goi y ten, khong goi AI');
aiMode = 'err'; r = e.run("priceQa_('giá nhẫn bạc trơn')");
ok(r.ok && r.found && /450/.test(r.text) && /nghìn đồng/.test(r.text) && /429/.test(r.aiError), 'AI loi (429) -> tra DANH SACH GIA CHINH XAC thay vi bao loi: ' + JSON.stringify(r).slice(0, 250));
aiMode = 'throw'; r = e.run("priceQa_('giá nhẫn bạc trơn')"); ok(r.ok && r.found && /450/.test(r.text) && /mat mang/.test(r.aiError), 'AI nem loi -> van tra gia chinh xac');
r = e.run("priceQa_('  ')"); ok(!r.ok && /Thieu/.test(r.error), 'q rong');
e = makeEnv({ cat: [] }); r = e.run("priceQa_('giá nhẫn bạc trơn')"); ok(!r.ok && /rong|chua doc/.test(r.error), 'bang gia rong -> bao ro');
e = makeEnv(); e.props = { apiGroq: '' }; e.ctx.getSetting_ = k => ''; r = e.run("priceQa_('giá nhẫn bạc trơn')");
ok(r.ok && r.found && /450/.test(r.text) && /API Key/.test(r.aiError), 'chua co API key nao -> van tra bang gia, noi ro vi sao AI khong chay');
// route doPost
e = makeEnv(); e.ctx._aiOpenAICompat_ = () => ({ ok: true, text: 'ngan' });
let po = e.out(e.run("doPost({postData:{contents: JSON.stringify({action:'priceQa', q:'giá nhẫn bạc trơn'})}})"));
ok(po.ok && po.found && po.text === 'ngan', 'doPost action=priceQa: ' + JSON.stringify(po).slice(0, 200));
// luong tra loi KHACH khong doi (khong co co priceQa)
e.sys = null; e.out(e.run("callAI_({prompt:'khách hỏi giá nhẫn bạc trơn', withProducts:false})")); ok(!/toi da 3 cau/.test(e.sys || ''), 'callAI_ khach binh thuong khong dung prompt priceQa');

// ───────────────── CLIENT ─────────────────
const els = {}; const el = id => els[id] || (els[id] = { id, value: '', innerHTML: '', placeholder: '', scrollTop: 0, classList: { toggle() {}, contains: () => false, add() {}, remove() {} }, querySelectorAll: () => [] });
const fetches = []; let fetchImpl = async () => ({ json: async () => ({ ok: true, found: true, text: 'SẢN PHẨM: X\n- Chất liệu: Bạc | Giá bán: 450', unit: 'nghin' }) });
const cctx = { module: { exports: {} }, console, AbortController, setTimeout, clearTimeout, careData: {}, _posStatsOn: false, donStatsByPhone: {}, schedules: [], SCHED_TYPES: [{ key: 'goi', label: 'Hẹn gọi' }],
  document: { getElementById: el, documentElement: { classList: { contains: () => true } }, querySelectorAll: () => [] }, gsUrl: 'https://script.example/exec',
  fetch: (u, o) => { fetches.push({ u, o }); return fetchImpl(u, o); } };
vm.createContext(cctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/33-pro-profile.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8') + '\nthis.X={proPriceIntent_,proPriceRequest_,proPriceFormat_,proIntent_,proAiSend_,_proDock};', cctx);
const X = cctx.X;
for (const q of ['giá vòng tay phong thủy', 'Bảng giá nhẫn', 'nhẫn này bao nhiêu tiền', 'đơn giá dây chuyền', 'GIÁ?', 'nhiêu tiền vậy']) ok(X.proPriceIntent_(q), 'nhan ra cau hoi gia: ' + q);
for (const q of ['tóm tắt khách này', 'doanh số kỳ này', 'nên làm gì tiếp', 'ai cần hỗ trợ nhất', 'giao hàng khi nào']) ok(!X.proPriceIntent_(q), 'KHONG phai cau hoi gia: ' + q);
ok(X.proIntent_('sales', 'tóm tắt doanh số') === 'summary' && X.proIntent_('customer', 'tóm tắt khách này') === 'summary', 'y dinh cu khong doi');
(async () => {
  let p = await X.proPriceRequest_('https://script.example/exec', 'giá nhẫn bạc & 925?', cctx.fetch);
  ok(p.ok && p.found && /450/.test(p.text) && fetches[0].u === 'https://script.example/exec?action=priceAsk&q=' + encodeURIComponent('giá nhẫn bạc & 925?') && fetches[0].o.method === 'GET', 'goi GET priceAsk, q duoc ma hoa: ' + fetches[0].u);
  await X.proPriceRequest_('https://script.example/exec?x=1', 'a', cctx.fetch); ok(/exec\?x=1&action=priceAsk/.test(fetches[1].u), 'URL da co ? thi noi bang &');
  ok(!(await X.proPriceRequest_('', 'a', cctx.fetch)).ok, 'chua co link GAS: bao ro, khong goi');
  fetchImpl = async () => ({ json: async () => ({ error: 'Unknown action priceAsk' }) });
  p = await X.proPriceRequest_('u', 'a', cctx.fetch); ok(!p.ok && /chưa lên bản/.test(p.error), 'backend cu: goi y chua deploy');
  fetchImpl = async () => { const er = new Error('abort'); er.name = 'AbortError'; throw er; };
  p = await X.proPriceRequest_('u', 'a', cctx.fetch); ok(!p.ok && /Quá thời gian/.test(p.error), 'het gio');
  fetchImpl = async () => { throw new Error('mat mang'); }; p = await X.proPriceRequest_('u', 'a', cctx.fetch); ok(!p.ok && /mat mang/.test(p.error), 'loi mang khong nem');
  ok(/nghìn đồng/.test(X.proPriceFormat_({ ok: true, found: true, text: 'SẢN PHẨM: X' })) && /SẢN PHẨM: X/.test(X.proPriceFormat_({ ok: true, found: true, text: 'SẢN PHẨM: X' })), 'dinh dang co gia + don vi nghin dong');
  let f = X.proPriceFormat_({ ok: true, found: false, suggestions: ['A', 'B'] }); ok(/Chưa tìm thấy/.test(f) && /• A/.test(f) && /• B/.test(f) && /TÊN sản phẩm/.test(f), 'khong thay + goi y');
  f = X.proPriceFormat_({ ok: true, found: false, suggestions: [] }); ok(/Chưa tìm thấy/.test(f) && !/muốn hỏi/.test(f), 'khong thay, khong goi y');
  ok(/^⚠ boom/.test(X.proPriceFormat_({ ok: false, error: 'boom' })), 'loi hien ⚠');
  // luong gui cau hoi (DOM gia)
  const D = X._proDock, ask = async (mode, q) => { D.mode = mode; D.log = []; D.busy = false; fetches.length = 0; el('pro-ai-q').value = q; await X.proAiSend_(); return D.log; };
  fetchImpl = async () => ({ json: async () => ({ ok: true, found: true, text: 'SẢN PHẨM: Nhẫn Bạc Trơn\n- Giá bán: 450' }) });
  let log = await ask('price', 'giá nhẫn bạc trơn');
  ok(fetches.length === 1 && /action=priceAsk/.test(fetches[0].u) && log.length === 2 && log[0].role === 'user' && /450/.test(log[1].text) && /không dùng AI/.test(log[1].provider) && !D.busy && el('pro-ai-q').value === '', 'che do 💰: tra gia, ghi log, nhan hoi xong, xoa o nhap');
  log = await ask('customer', 'giá nhẫn bạc trơn bao nhiêu');
  ok(fetches.length === 1 && /450/.test(log[1].text) && !/Chưa mở khách/.test(JSON.stringify(log)), 'che do Khach + cau hoi gia: tra gia du CHUA mo khach nao');
  log = await ask('sales', 'giá vòng tay phong thủy');
  ok(fetches.length === 1 && /450/.test(log[1].text), 'che do Doanh so + cau hoi gia: tra gia du chua tai Tong quan');
  log = await ask('customer', 'tóm tắt khách này');
  ok(fetches.length === 0 && /Chưa mở khách/.test(log[0].text), 'cau hoi KHACH binh thuong khong bi cuop sang tra gia');
  log = await ask('sales', 'doanh số kỳ này');
  ok(fetches.length === 0, 'cau hoi doanh so khong bi cuop sang tra gia');
  log = await ask('customer', 'gia han thanh toan');   // co tu "gia" nhung la Y DINH khach? khong — proIntent_ customer ''
  ok(fetches.length === 1, 'tu "gia" ma khong y dinh khac -> tra gia (da biet: chi thay cho cau tro ly "chua hieu")');
  fetchImpl = async () => ({ json: async () => ({ ok: false, error: 'Bang gia (DANH_MUC) dang rong' }) });
  log = await ask('price', 'giá a'); ok(/^⚠ Bang gia/.test(log[1].text) && !D.busy, 'loi backend hien ⚠, khong ket busy');
  D.mode = 'price'; D.log = []; D.busy = true; fetches.length = 0; el('pro-ai-q').value = 'giá x'; await X.proAiSend_(); ok(fetches.length === 0, 'dang ban: khong gui trung');
  console.log('ALL PRICE-ASK TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

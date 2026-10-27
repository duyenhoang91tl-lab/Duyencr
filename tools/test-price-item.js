#!/usr/bin/env node
// Test (2026-10-27) CHI TIET SAN PHAM trong tro ly "Gia san pham": GAS priceItem_ + client js/38-pro-dock.js (goi y thanh nut -> chat lieu -> size -> gia).
// Chay: node tools/test-price-item.js -> "ALL PRICE-ITEM TESTS PASSED"
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok  ', m); };
const root = path.join(__dirname, '..');
const CATALOG = [
  { 'Nhóm': 'Vòng tay', 'Tên sản phẩm': 'VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN', 'Mã': 'VT01', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': '16cm', 'Giá bán': '2.310', 'Giá SAPHIA': '2.900', 'Giá RUBY': '3.100', 'Link ảnh sản phẩm': 'https://x.test/a.jpg' },
  { 'Nhóm': 'Vòng tay', 'Tên sản phẩm': 'VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN', 'Mã': 'VT01', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': '18cm', 'Giá bán': '2.450' },
  { 'Nhóm': 'Vòng tay', 'Tên sản phẩm': 'VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN', 'Mã': 'VT01', 'Chất liệu': 'Vàng 18K', 'Kiểu/Size': '16cm', 'Giá bán': '9.500' },
  { 'Nhóm': 'Charm', 'Tên sản phẩm': 'CHARM RƠI TÚI TIỀN', 'Chất liệu': 'Bạc 925', 'Giá bán': 450 },
  { 'Nhóm': 'Charm', 'Tên sản phẩm': 'CHARM RƠI TÚI TIỀN TOUR', 'Chất liệu': 'Bạc 925', 'Kiểu/Size': 'Nhỏ', 'Giá bán': '300' }
];
const store = {}; let throwCat = false;
const ctx = { console, Date, JSON, Math, Object, Array, String, Number, parseInt, isNaN, encodeURIComponent, Logger: { log() {} },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, deleteProperty() {}, getProperties: () => ({}) }) },
  CacheService: { getScriptCache: () => ({ get: k => store[k] || null, put: (k, v) => { store[k] = v; }, remove() {}, removeAll() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }) } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, 'gas_v13.js'), 'utf8'), ctx);
ctx.readPriceCatalog_ = () => { if (throwCat) throw new Error('khong mo duoc sheet'); return CATALOG; };
ctx.getSetting_ = () => ''; ctx.getCrmSS_ = () => ({ getSheetByName: () => null }); ctx.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => null }), openById: () => ({ getSheetByName: () => null }) };
const run = c => vm.runInContext(c, ctx);
let r = run("priceItem_('VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN')");
ok(r.ok && r.found && r.name === 'VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN' && r.variants.length === 3, 'priceItem: 3 bien the cua san pham');
ok(r.variants[0].mat === 'Bạc 925' && r.variants[0].size === '16cm' && r.variants[0].prices.length === 3, 'bien the 1: chat lieu, size, 3 gia (thuong/SAPHIA/RUBY)');
ok(JSON.stringify(r.variants[0].prices.map(p => [p.label, p.value, p.stone])) === JSON.stringify([['Giá bán', '2.310', ''], ['Giá SAPHIA', '2.900', 'SAPHIA'], ['Giá RUBY', '3.100', 'RUBY']]), 'gia gan dung nhan loai da');
ok(r.info.some(x => x.k === 'Nhóm' && x.v === 'Vòng tay') && r.info.some(x => x.k === 'Mã' && x.v === 'VT01') && !r.info.some(x => /link|Tên sản phẩm/i.test(x.k)), 'info chung: nhom, ma; khong lo link anh/ten');
r = run("priceItem_('vong tay ngu dieu mix tui tien')"); ok(r.found && r.variants.length === 3, 'khop KHONG dau / khong phan biet hoa thuong');
r = run("priceItem_('CHARM RƠI TÚI TIỀN')"); ok(r.found && r.variants.length === 1 && !/TOUR/.test(r.name), 'khop CHINH XAC ten (khong lan sang "...TOUR")');
r = run("priceItem_('khong co san pham nay')"); ok(r.ok && !r.found && r.variants.length === 0, 'khong co -> found=false');
r = run("priceItem_('  ')"); ok(!r.ok && /Thieu/.test(r.error), 'thieu ten');
throwCat = true; const st = Object.keys(store); st.forEach(k => delete store[k]); r = run("priceItem_('a')"); ok(!r.ok && /Khong doc duoc bang gia/.test(r.error), 'sheet loi: bao ro'); throwCat = false;
const g = JSON.parse(run("doGet({parameter:{action:'priceItem', name:'CHARM RƠI TÚI TIỀN'}})").getContent()); ok(g.ok && g.found, 'doGet action=priceItem');

// ── CLIENT ──
const els = {}; const el = id => els[id] || (els[id] = { id, value: '', innerHTML: '', placeholder: '', scrollTop: 0, classList: { toggle() {}, contains: () => false, add() {}, remove() {} }, querySelectorAll: () => [] });
const fetches = []; let fetchImpl;
const cctx = { module: { exports: {} }, console, AbortController, setTimeout, clearTimeout, careData: {}, _posStatsOn: false, donStatsByPhone: {}, schedules: [], SCHED_TYPES: [{ key: 'goi', label: 'Hẹn gọi' }],
  document: { getElementById: el, documentElement: { classList: { contains: () => true } }, querySelectorAll: () => [] }, gsUrl: 'https://script.example/exec', fetch: (u, o) => { fetches.push({ u, o }); return fetchImpl(u, o); } };
vm.createContext(cctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/33-pro-profile.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'js/38-pro-dock.js'), 'utf8') + '\nthis.X={proAiSend_,proPriceChip_,proPriceNext_,proPriceMoney_,proPriceItemRequest_,_proDock,proAiLogRender_};', cctx);
const X = cctx.X, D = X._proDock;
ok(X.proPriceMoney_('2.310') === '2.310.000đ' && X.proPriceMoney_(450) === '450.000đ' && X.proPriceMoney_('450') === '450.000đ' && X.proPriceMoney_('1.250') === '1.250.000đ', 'doi nghin dong -> dong: 2.310->2.310.000đ, 450->450.000đ');
ok(X.proPriceMoney_('liên hệ') === 'liên hệ (nghìn đồng)', 'gia la chu: giu nguyen chu goc');
const item = run("priceItem_('VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN')");
let n = X.proPriceNext_(item, { mat: null, size: null }); ok(n.step === 'mat' && n.options.length === 2, 'buoc 1: hoi chat lieu (2 loai)');
n = X.proPriceNext_(item, { mat: 'Bạc 925', size: null }); ok(n.step === 'size' && JSON.stringify(n.options) === '["16cm","18cm"]', 'buoc 2: hoi size sau khi chon Bac 925');
n = X.proPriceNext_(item, { mat: 'Vàng 18K', size: null }); ok(n.step === 'price' && n.variants.length === 1, 'Vang 18K chi co 1 size -> bo qua buoc size, ra gia luon');
n = X.proPriceNext_(run("priceItem_('CHARM RƠI TÚI TIỀN')"), { mat: null, size: null }); ok(n.step === 'price', 'san pham co 1 bien the -> ra gia ngay');
const send = async (q) => { fetches.length = 0; el('pro-ai-q').value = q; await X.proAiSend_(); };
const last = () => D.log[D.log.length - 1];
const click = async (label) => { const mi = D.log.length - 1, ci = last().chips.findIndex(c => c.label === label); ok(ci >= 0, 'co nut "' + label + '"'); await X.proPriceChip_(mi, ci); };
(async () => {
  fetchImpl = async (u) => ({ json: async () => /action=priceAsk/.test(u) ? ({ ok: true, found: false, suggestions: ['VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN', 'CHARM RƠI TÚI TIỀN'] }) : ({ ok: true, ...run("priceItem_(decodeURIComponent('" + encodeURIComponent((u.match(/name=([^&]*)/) || [])[1] ? decodeURIComponent(u.match(/name=([^&]*)/)[1]) : '') + "'))") }) });
  D.mode = 'price'; D.log = []; D.busy = false;
  await send('Túi tiền');
  ok(last().chips && last().chips.length === 2 && last().chips.every(c => c.kind === 'name') && /Bấm vào sản phẩm/.test(last().text), 'goi y thanh NUT bam (khong con la dong chu)');
  await click('VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN');
  ok(/action=priceItem&name=/.test(fetches[fetches.length - 1].u) && !D.busy, 'bam ten -> goi priceItem, nhan hoi xong');
  ok(/📦 VÒNG TAY/.test(last().text) && /Nhóm: Vòng tay/.test(last().text) && /Chọn chất liệu/.test(last().text) && last().chips.length === 2, 'hien thong tin san pham + nut chon chat lieu');
  await click('Bạc 925'); ok(/Chọn kiểu \/ size/.test(last().text) && last().chips.map(c => c.label).join() === '16cm,18cm', 'bam chat lieu -> nut size');
  await click('16cm');
  ok(/✅ VÒNG TAY NGŨ ĐIỀU MIX TÚI TIỀN › Bạc 925 › 16cm/.test(last().text) && /Giá bán: 2\.310\.000đ/.test(last().text) && /Giá SAPHIA: 2\.900\.000đ/.test(last().text) && /Giá RUBY: 3\.100\.000đ/.test(last().text), 'bam size -> ra GIA theo muc da bam (quy ra dong, co SAPHIA/RUBY)');
  ok(last().chips.length === 1 && last().chips[0].kind === 'reset' && /không dùng AI/.test(last().provider), 'co nut "Chon lai", gia lay thang bang gia');
  await click('↩ Chọn lại'); ok(/Chọn chất liệu/.test(last().text), 'Chon lai -> quay ve buoc chat lieu');
  await click('Vàng 18K'); ok(/Vàng 18K/.test(last().text) && /9\.500\.000đ/.test(last().text) && !/Chọn/.test(last().text), 'Vang 18K chi 1 size -> ra gia luon');
  // nut cu van dung dung (khong bi lech khi log dai ra)
  const mi = D.log.findIndex(m => m.chips && m.chips[0] && m.chips[0].label === 'Bạc 925'), ci = 0;
  await X.proPriceChip_(mi, ci); ok(/Chọn kiểu/.test(last().text), 'bam lai nut cu o tin truoc van ra dung buoc');
  // san pham 1 bien the
  D.log = []; await send('Túi tiền'); await click('CHARM RƠI TÚI TIỀN'); ok(/450\.000đ/.test(last().text) && /📦 CHARM RƠI TÚI TIỀN/.test(last().text), 'san pham 1 bien the: thong tin + gia trong 1 tin');
  // loi / khong co
  fetchImpl = async () => ({ json: async () => ({ ok: true, found: false, variants: [] }) }); D.log = [{ role: 'bot', text: 'x', chips: [{ kind: 'name', label: 'ABC' }] }]; await X.proPriceChip_(0, 0);
  ok(/Không có dòng chi tiết/.test(last().text) && !D.busy, 'khong co chi tiet: bao ro');
  fetchImpl = async () => ({ json: async () => ({ error: 'Unknown action priceItem' }) }); D.log = [{ role: 'bot', text: 'x', chips: [{ kind: 'name', label: 'ABC' }] }]; await X.proPriceChip_(0, 0);
  ok(/^⚠/.test(last().text) && /chưa lên bản/.test(last().text) && !D.busy, 'backend cu: bao chua deploy, khong ket busy');
  D.busy = true; const nlog = D.log.length; await X.proPriceChip_(0, 0); ok(D.log.length === nlog, 'dang ban: bam nut khong gui trung');
  // render nut: du lieu trong data-pc, nhan duoc escape
  D.busy = false; D.mode = 'price'; D.log = [{ role: 'bot', text: 'a', chips: [{ kind: 'name', label: 'X"><img onerror=1>' }] }]; X.proAiLogRender_();
  ok(/data-pc="0:0"/.test(el('pro-ai-log').innerHTML) && !/<img onerror/.test(el('pro-ai-log').innerHTML), 'render nut: data-pc + nhan duoc ESCAPE HTML');
  console.log('ALL PRICE-ITEM TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

#!/usr/bin/env node
// Test (jsdom) muc "📊 Doanh so & hoa hong cua toi" (GAS csStats): Zalo AI (initStatsZai_/renderStatsZai_) SONG SONG voi Pancake AI (initStats_/renderStats_).
// Cat NGUYEN VAN khoi ma tu 2 content.js, chay CUNG ngay gia (2026-10-14, thu Tu) + CUNG du lieu + CUNG kich ban thao tac, so khop HTML (sau khi doi tien to class) -> hien thi GIONG HET.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-stats-ui.js -> "ALL STATS UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function fnEnd(src, name) { const i = src.indexOf('function ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return m + 1; } } throw new Error('khong thay ham ' + name); }
const zchunk = zsrc.slice(zsrc.indexOf('  async function _zaiFetchCsStats_'), fnEnd(zsrc, 'renderStatsZai_'));
const pchunk = psrc.slice(psrc.indexOf('const _STATS_RANGES_'), fnEnd(psrc, 'renderStats_'));
const esc1 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const esc2 = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 14, 10, 0, 0); } }   // thu Tu 14/10/2026

const DATA = { ok: true, dateFrom: '2026-10-01', dateTo: '2026-10-31', cs: 'Hoa',
  revenue: 52300000, orders: 14, closeRate: { held: 20, closed: 7, pct: 35 },
  commission: { total: 3150000, threshold: 15000000, ordersAbove15: 2, revenueAbove15: 38000000, rateAbove15: 5, commissionAbove15: 1900000, ordersBelow15: 12, revenueBelow15: 14300000, rateBelow15: 4, commissionBelow15: 572000,
    ordersChannel: 1, revenueChannel: 6000000, commissionChannel: 678000, channelBreakdown: { 'Zalo <ads>': { rate: 6 } }, sourceAbove15: 'Cấu hình CRM', sourceBelow15: 'Mặc định' },
  bonus: { total: 500000, items: [{ date: '2026-10-05', program: 'Thưởng <b>SP</b> mới', scope: 'Cá nhân', detail: 'Đạt 10 đơn', amount: 500000 }], activePrograms: [{ name: 'Chương trình "Q4"', dateFrom: '2026-10-01', dateTo: '', summary: '' }] },
  ghepLoi: 'Base <timeout>' };
const norm = h => h.replace(/pk-stats/g, 'X').replace(/zai-stats/g, 'X').replace(/\s+/g, ' ');
const GASMAP = reply => reply;   // reply = object GAS tra ve

function zalo(cs, gas) {
  const dom = new JSDOM('<!doctype html><body><div id="zai-stats-body"></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], gas };
  const fetchFn = async (url, o) => { env.calls.push(url); await sleep(env.delay || 0); const r = typeof env.gas === 'function' ? env.gas(url) : env.gas; if (r instanceof Error) throw r; return { json: async () => r }; };
  const f = new w.Function('escHtml', 'GAS_URL', '_currentCS', 'fetch', 'document', 'Date', zchunk + '\nreturn { init: initStatsZai_, load: loadStatsZai_, render: renderStatsZai_, range: _zaiStatsQuickRange_, state: _zaiStatsState };');
  const api = f(esc1, 'https://gas.test/exec', cs, fetchFn, w.document, FakeDate);
  return Object.assign(api, { env, w, body: w.document.getElementById('zai-stats-body'), res: () => w.document.getElementById('zai-stats-result') });
}
function pancake(cs, gas) {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><select id="pk-cs-sel"></select><div id="pk-stats-body"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], gas };
  const panelEl = w.document.getElementById('panel'), sel = w.document.getElementById('pk-cs-sel');
  if (cs) { const o = w.document.createElement('option'); o.value = cs; sel.appendChild(o); sel.value = cs; }
  const safeSendMessage_ = (msg, cb) => { env.calls.push(msg); (async () => { await sleep(env.delay || 0); const r = typeof env.gas === 'function' ? env.gas(msg) : env.gas;
    if (r instanceof Error) cb({ ok: false, error: r.message }); else if (r.error) cb({ ok: false, error: String(r.error) }); else if (r.ok === false) cb({ ok: false, error: 'Không tính được số liệu.' }); else cb({ ok: true, data: r }); })(); };
  const f = new w.Function('panelEl', 'settings', 'safeSendMessage_', 'escapeHtml', 'Date', pchunk + '\nreturn { init: initStats_, load: loadStats_, render: renderStats_, range: _statsQuickRange_, state: _statsState };');
  const api = f(panelEl, {}, safeSendMessage_, esc2, FakeDate);
  return Object.assign(api, { env, w, body: w.document.getElementById('pk-stats-body'), res: () => w.document.getElementById('pk-stats-result') });
}
(async () => {
  // 1. bo loc ngay nhanh: giong nhau + dung gia tri (thu Tu 14/10/2026, tuan thu 2 -> CN)
  const Z0 = zalo('Hoa', DATA), P0 = pancake('Hoa', DATA);
  const expect = { today: ['2026-10-14', '2026-10-14'], yesterday: ['2026-10-13', '2026-10-13'], thisWeek: ['2026-10-12', '2026-10-18'], lastWeek: ['2026-10-05', '2026-10-11'], thisMonth: ['2026-10-01', '2026-10-31'], lastMonth: ['2026-09-01', '2026-09-30'], thisQuarter: ['2026-10-01', '2026-12-31'], lastQuarter: ['2026-07-01', '2026-09-30'], thisYear: ['2026-01-01', '2026-12-31'], lastYear: ['2025-01-01', '2025-12-31'] };
  for (const [k, [f, t]] of Object.entries(expect)) { const a = Z0.range(k), b = P0.range(k); ok(a.from === f && a.to === t && b.from === f && b.to === t, 'khoang ngay ' + k + ': zalo ' + JSON.stringify(a) + ' pancake ' + JSON.stringify(b) + ' mong ' + f + '..' + t); }
  ok(Z0.range('custom') === null && P0.range('custom') === null, 'custom -> null');
  // 2. render cung du lieu -> cung HTML
  Z0.state.data = DATA; P0.state.data = DATA;
  Z0.body.innerHTML = '<div id="zai-stats-result"></div>'; P0.body.innerHTML = '<div id="pk-stats-result"></div>';
  Z0.render(); P0.render();
  // Thong bao loi doi chieu Base: Pancake da chuan hoa 'Lỗi API' (ddaf130), Zalo van hien chi tiet -> so sanh HTML KHONG tinh khoi thong bao loi, kiem tra rieng tung ben.
  const noErr = h => norm(h).replace(/<div class="X-note X-err">[\s\S]*?<\/div>/g, '<ERR/>');
  ok(noErr(Z0.res().innerHTML) === noErr(P0.res().innerHTML), 'HTML render GIONG HET (tru thong bao loi):\nZALO    ' + noErr(Z0.res().innerHTML).slice(0, 900) + '\nPANCAKE ' + noErr(P0.res().innerHTML).slice(0, 900));
  ok(/Lỗi khi đối chiếu Base \(đã chia theo Pos\): Base &lt;timeout&gt;/.test(Z0.res().innerHTML) && /Lỗi API \(đã chia theo Pos\)/.test(P0.res().innerHTML), 'thong bao loi doi chieu Base: moi ben dung cau cua minh');
  if (norm(Z0.res().innerHTML) !== norm(P0.res().innerHTML)) console.log('!!   CANH BAO: thong bao loi doi chieu Base cua Zalo CHUA giong Pancake ("Lỗi API") — can lam Zalo song song');
  const t = Z0.res().textContent;
  ok(/52\.300\.000đ/.test(t) && /3\.150\.000đ/.test(t) && /Đơn ≥ 15tr/.test(t) && /Đơn < 15tr/.test(t) && /Zalo <ads> 6%/.test(t) && /05\/10\/2026/.test(t) && /\(01\/10\/2026 → …\)/.test(t) && /Xem chi tiết ở CRM/.test(t) && /Base <timeout>/.test(t), 'noi dung: tien dinh dang cham, nguong 15tr, kenh %, ngay dd/mm/yyyy, ghep loi');
  ok(!Z0.res().querySelector('b b') && !Z0.res().querySelector('script') && !Z0.res().querySelector('ads, timeout') && /Thưởng <b>SP<\/b> mới/.test(t), 'HTML trong du lieu bi escape');
  // 3. kich ban thao tac: chay y het tren 2 ben, so HTML cuoi
  const scenarios = [
    ['mo lan dau (thang nay)', async S => { S.init(); await sleep(60); }],
    ['doi ky -> thang truoc', async S => { S.init(); await sleep(60); const q = S.body.querySelector('select'); q.value = 'lastMonth'; q.dispatchEvent(new S.w.Event('change')); await sleep(60); }],
    ['chon ngay tay -> chuyen custom, bam Xem', async S => { S.init(); await sleep(60); const [f, to] = S.body.querySelectorAll('input[type=date]'); f.value = '2026-09-10'; f.dispatchEvent(new S.w.Event('change')); to.value = '2026-09-20'; to.dispatchEvent(new S.w.Event('change')); S.body.querySelector('button').click(); await sleep(60); }],
    ['ngay bat dau sau ngay ket thuc', async S => { S.init(); await sleep(60); const [f, to] = S.body.querySelectorAll('input[type=date]'); f.value = '2026-10-20'; f.dispatchEvent(new S.w.Event('change')); to.value = '2026-10-10'; to.dispatchEvent(new S.w.Event('change')); S.body.querySelector('button').click(); await sleep(30); }]
  ];
  for (const [name, run] of scenarios) {
    const Z = zalo('Hoa', DATA), P = pancake('Hoa', DATA); await run(Z); await run(P);
    ok(noErr(Z.body.innerHTML) === noErr(P.body.innerHTML), 'kich ban "' + name + '": HTML 2 ben GIONG HET (tru thong bao loi)\nZALO    ' + noErr(Z.body.innerHTML).slice(-500) + '\nPANCAKE ' + noErr(P.body.innerHTML).slice(-500));
    if (name !== 'ngay bat dau sau ngay ket thuc') { ok(Z.env.calls.length >= 1, name + ': co goi API'); }
  }
  let Z = zalo('Hoa', DATA); Z.init(); await sleep(60);
  ok(Z.env.calls[0] === 'https://gas.test/exec?action=csStats&cs=Hoa&dateFrom=2026-10-01&dateTo=2026-10-31', 'URL csStats dung: ' + Z.env.calls[0]);
  let q = Z.body.querySelector('select'); q.value = 'lastMonth'; q.dispatchEvent(new Z.w.Event('change')); await sleep(60);
  ok(/dateFrom=2026-09-01&dateTo=2026-09-30/.test(Z.env.calls[1]), 'doi ky goi lai voi khoang moi: ' + Z.env.calls[1]);
  // 4. chua chon CS: nhac, khong goi (ca 2 ben)
  Z = zalo('', DATA); const P = pancake('', DATA); Z.init(); P.init(); await sleep(40);
  ok(Z.env.calls.length === 0 && P.env.calls.length === 0 && /Chọn "CS đang dùng" ở đầu panel để xem số liệu/.test(Z.res().textContent) && norm(Z.body.innerHTML) === norm(P.body.innerHTML), 'chua chon CS: nhac giong het, khong goi API');
  // 5. loi (backend / mang) hien ⚠ giong het
  for (const err of [{ error: 'Khong co quyen xem CS nay' }, { ok: false }, new Error('mat mang')]) {
    const a = zalo('Hoa', err), b = pancake('Hoa', err); a.init(); b.init(); await sleep(60);
    ok(/⚠️/.test(a.res().textContent) && norm(a.body.innerHTML) === norm(b.body.innerHTML), 'loi ' + (err.error || err.message || 'ok:false') + ': ⚠ giong het: ' + a.res().textContent.slice(0, 80));
  }
  // 6. phan hoi CU den tre khong de len phan hoi MOI (ca 2 ben)
  for (const mk of [zalo, pancake]) {
    const S = mk('Hoa', url => /dateFrom=2026-10-01/.test(typeof url === 'string' ? url : JSON.stringify(url)) ? { ...DATA, revenue: 111 } : { ...DATA, revenue: 222 });
    S.env.delay = 80; S.init(); await sleep(5); S.env.delay = 5;
    const qq = S.body.querySelector('select'); qq.value = 'lastMonth'; qq.dispatchEvent(new S.w.Event('change')); await sleep(200);
    ok(/222đ/.test(S.res().textContent) && !/111đ/.test(S.res().textContent), 'phan hoi cu (thang nay, cham) KHONG de len ket qua moi (thang truoc)');
  }
  // 7. noi vao menu + cau chu
  ok(/\{ v: 'stats', label: '📊 Doanh số & hoa hồng của tôi' \}/.test(zsrc) && /statsBody\.style\.display = v === 'stats'/.test(zsrc) && /if \(v === 'stats'\) initStatsZai_\(\)/.test(zsrc), 'Zalo: muc menu + goi initStatsZai_');
  ok(/<option value="stats">📊 Doanh số & hoa hồng của tôi<\/option>/.test(psrc), 'ten muc giong het Pancake');
  console.log('ALL STATS UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

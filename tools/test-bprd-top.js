#!/usr/bin/env node
// Test "Top SP trong Bao cao B" (js/11 khoi BPRD-CFG: loc rieng ngay/team + loai tru). Chay: node tools/test-bprd-top.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
const a = src.indexOf('// ═══ BPRD-CFG BEGIN'), b = src.indexOf('// ═══ BPRD-CFG END');
const els = {}; const calls = []; let apiRes = null; const store = {};
const ctx = { _srState: { dataB: { products: [{ code: 'VB03', name: 'Vòng bạc', soLuong: 50 }, { code: 'QT99', name: 'Quà tặng', soLuong: 40 }, { code: 'NV01', name: 'Nhẫn vàng', soLuong: 30 }] }, bProductView: 'table' },
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, gsUrl: 'https://gas.test/exec', console,
  fmt: n => String(n), esc: s => String(s).replace(/</g, '&lt;'), _srTotalRowHtml_: r => '<tr class="tot">' + r.join('|') + '</tr>', _srChartSvg: () => '<svg/>',
  document: { getElementById: id => els[id] || (els[id] = { innerHTML: '' }) },
  fetch: async url => { calls.push(url); return { json: async () => apiRes }; },
  // gia lap API js/95
  _ts: { cfg: { loaded: true, teams: ['Team A', 'Team B'], exclude: [{ key: 'c:QT99', name: 'Quà tặng' }] } }, _canEdit: true, _excluded: [],
  tspCanEdit: () => ctx._canEdit, tspExclude: () => ctx._ts.cfg.exclude, tspLoadConfig: cb => cb && cb(),
  tspIsExcluded: p => ctx._ts.cfg.exclude.some(x => x.key === 'c:' + String(p.code || '').toUpperCase()), tspExcludeSp: (c, n) => { ctx._excluded.push([c, n]); },
  tspExcludePanelHtml: () => '<div id="panel-b">PANEL</div>', _bprdRefreshPanel_: () => {} };
vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
const run = c => vm.runInContext(c, ctx); const wait = () => new Promise(r => setTimeout(r, 15));
(async () => {
  let all = run('_bprdAll_(_srState.dataB)');
  ok(all.length === 2 && !all.some(p => p.code === 'QT99'), 'theo ky B: SP loai tru (QT99) bi bo');
  let h = run('_bprdBodyHtml_(_srState.dataB)');
  ok(h.includes('Vòng bạc') && !h.includes('Quà tặng') && h.includes('🚫 Loại') && h.includes('Nhẫn vàng'), 'bang B an Qua tang, admin thay nut Loai');
  ok(/Đang hiện 2\/2/.test(h), 'dem 2/2 (khong tinh SP bi loai)');
  ctx._canEdit = false; h = run('_bprdBodyHtml_(_srState.dataB)'); ok(!h.includes('🚫 Loại'), 'CS thuong khong thay nut Loai'); ctx._canEdit = true;
  run('_bprdExclude_(0)'); ok(ctx._excluded.length === 1 && ctx._excluded[0][0] === 'VB03', 'nut Loai dong 1 -> tspExcludeSp(VB03)');
  // loc rieng
  apiRes = { ok: true, dateFrom: '2026-11-21', dateTo: '2026-11-21', totalOrders: 7, excludedQty: 3, rows: [{ code: 'DC02', name: 'Dây chuyền', soLuong: 9, orders: 3 }] };
  run('_bprdOwnSet_("today")'); await wait();
  ok(calls[0].includes('action=topProducts') && /dateFrom=(\d{4}-\d{2}-\d{2})&dateTo=\1/.test(calls[0]) && calls[0].includes('limit=500'), 'Hom nay -> goi topProducts tu=den, limit 500');
  all = run('_bprdAll_(_srState.dataB)'); ok(all.length === 1 && all[0].code === 'DC02', 'dang loc rieng: nguon SP = du lieu server (khong phai d.products)');
  ok(els['bprd-bar'].innerHTML.includes('7 đơn') && els['bprd-bar'].innerHTML.includes('Team A'), 'thanh loc hien so don + chip team');
  run('_bprdOwnTeam_("Team A")'); await wait(); run('_bprdOwnTeam_("Team B")'); await wait();
  ok(calls[calls.length - 1].includes('team=Team%20A%2CTeam%20B'), 'chon 2 team -> team=A,B');
  run('_bprdOwnTeam_("Team A")'); await wait(); ok(calls[calls.length - 1].includes('team=Team%20B') && !calls[calls.length - 1].includes('Team%20A'), 'bam lai Team A -> bo chon');
  run('_bprdOwnTeam_("")'); await wait(); ok(/team=&/.test(calls[calls.length - 1]), 'Tat ca -> bo loc team');
  run('_bprdOwnDate_("bpTo","2026-11-25")'); await wait();
  ok(calls[calls.length - 1].includes('dateTo=2026-11-25'), 'doi ngay den -> goi lai');
  // bam lien tiep: ket qua cu bi bo
  let n = calls.length; apiRes = { ok: true, dateFrom: 'x', dateTo: 'x', totalOrders: 1, rows: [{ code: 'OLD', name: 'Cu', soLuong: 1 }] };
  const p1 = run('_bprdOwnLoad_()'); apiRes = { ok: true, dateFrom: 'y', dateTo: 'y', totalOrders: 2, rows: [{ code: 'NEW', name: 'Moi', soLuong: 2 }] }; const p2 = run('_bprdOwnLoad_()'); await Promise.all([p1, p2]);
  ok(run('_bprdAll_(_srState.dataB)')[0].code === 'NEW', 'bam lien tiep: ket qua cu bi bo, giu ket qua moi nhat');
  // hook
  n = calls.length; run('_bprdOnExcludeChange_(true)'); await wait(); ok(calls.length === n + 1, 'doi loai tru khi dang loc rieng -> tai lai tu server');
  run('_bprdOwnSet_("b")'); await wait(); n = calls.length; run('_bprdOnExcludeChange_(true)'); await wait();
  ok(calls.length === n && run('_bprdAll_(_srState.dataB)').length === 2, 've "Ky cua B": doi loai tru chi ve lai, khong goi server');
  ok(run('_bprdOwnBarHtml_()').includes('SP loại trừ (1)'), 'nut hien so SP loai tru');
  run('_bprdToggleEx_()'); ok(els['bprd-ex'].innerHTML.includes('panel-b'), 'mo khung loai tru trong B');
  ok(run('_bprdAddDays_("2026-12-01",-1)') === '2026-11-30', 'cong tru ngay qua ranh thang');
  console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);
})();

#!/usr/bin/env node
// Test giao dien Cai dat KPI 2 bac (js/12 + js/16) bang jsdom: 2 o KPI, chon TV hien o "Thang bat dau", luu dung payload. Chay: NODE_PATH=<jsdom> node tools/test-sale-tier-2-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path'); const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const posts = [];
const fakeFetch = (url, o) => { if (o && o.body) posts.push(JSON.parse(o.body)); return Promise.resolve({ json: () => Promise.resolve({ ok: true }), ok: true }); };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.fetch = fakeFetch; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    w.eval(`gsUrl='https://script.google.com/macros/s/T/exec'; currentUser={role:'admin',name:'Admin',names:[]};
      _srState.dataF = { rows: [ {name:'thuongBT'}, {name:'Lan'} ], config: { tierTargets:{TV:1e8, CT:5e8}, trackingStartMonth:'2026-09', startTier:{thuongBT:'TV', Lan:'CT'}, startMonth:{thuongBT:'2026-11'}, overrides:{} } };
      openSaleKpiConfigModal_();`);
    const m = D.getElementById('sr-kpi-modal'); ok(m, 'mo modal');
    const nums = [...m.querySelectorAll('input[type=number]')].map(i => i.value).filter(v => v !== '');
    ok(nums[0] === '100' && nums[1] === '500', 'hien 2 o KPI: 100 va 500 trieu: ' + nums.slice(0, 3));
    ok(!/TVF|F1|O1|Online/.test(m.textContent.replace(/\s+/g, ' ')) , 'khong con nhan bac cu (TVF/F1/O1/Online): ' + (m.textContent.match(/TVF\d|F[123]|O[123]/) || ''));
    const sels = [...m.querySelectorAll('select')]; ok(sels.length === 2 && [...sels[0].options].map(o => o.value).join() === ',TV,CT', 'o chon bac chi co TV/CT');
    const months = [...m.querySelectorAll('#sr-kpi-modal-rows input[type=month]')]; ok(months.length === 1 && months[0].value === '2026-11', 'chi dong Thu viec co o Thang bat dau = 2026-11');
    // doi Lan sang TV -> hien them o thang
    sels[1].value = 'TV'; sels[1].dispatchEvent(new w.Event('change')); await wait(50);
    ok(D.querySelectorAll('#sr-kpi-modal-rows input[type=month]').length === 2, 'chon Thu viec -> hien o Thang bat dau');
    D.querySelectorAll('#sr-kpi-modal-rows input[type=month]')[1].value = '2026-12'; D.querySelectorAll('#sr-kpi-modal-rows input[type=month]')[1].dispatchEvent(new w.Event('change'));
    [...D.querySelectorAll('#sr-kpi-modal button')].filter(b => /Lưu/.test(b.textContent))[0].click(); await wait(100);
    const p = posts.filter(x => x.action === 'setSetting')[0]; const c = JSON.parse(p.value);
    ok(c.tierModel === 2 && c.tierTargets.TV === 1e8 && c.tierTargets.CT === 5e8 && Object.keys(c.tierTargets).length === 2, 'luu: tierModel 2 + 2 muc KPI: ' + JSON.stringify(c.tierTargets));
    ok(c.startTier.thuongBT === 'TV' && c.startTier.Lan === 'TV' && c.startMonth.thuongBT === '2026-11' && c.startMonth.Lan === '2026-12', 'luu bac + thang bat dau: ' + JSON.stringify([c.startTier, c.startMonth]));
    console.log('ALL SALE TIER 2 UI TESTS PASSED'); w.close();
  }, 3500);
});

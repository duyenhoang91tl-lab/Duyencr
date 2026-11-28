#!/usr/bin/env node
// Test giao dien "Luong co ban" (js/101-salary-lcb.js) bang jsdom: chi admin, tinh lai khi go ngay cong, luu dung payload. Chay: NODE_PATH=<jsdom> node tools/test-salary-lcb-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path'); const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const posts = [], gets = [];
const REP = { ok: true, month: '2026-11', standardDays: 26, lcbTiers: [{ minPct: 0, amount: 3e6 }, { minPct: 65, amount: 3.5e6 }, { minPct: 85, amount: 4.25e6 }, { minPct: 100, amount: 5e6 }], total: 8.5e6, missingCount: 2,
  rows: [ { name: 'Nam', tier: 'CT', channel: 'offline', revenue: 350e6, target: 500e6, pct: 70, lcbTier: 3.5e6, workdays: null, lcbNet: 3.5e6, missingWorkdays: true },
          { name: 'Tan', tier: 'TV', channel: 'probation', revenue: 100e6, target: 100e6, pct: 100, lcbTier: 5e6, workdays: null, lcbNet: 5e6, missingWorkdays: true } ] };
const fakeFetch = (url, o) => { if (o && o.body) { posts.push(JSON.parse(o.body)); return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }); }
  gets.push(String(url)); return Promise.resolve({ ok: true, json: () => Promise.resolve(/action=salaryReport/.test(url) ? REP : { ok: false }) }); };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.fetch = fakeFetch; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    w.eval(`gsUrl='https://script.google.com/macros/s/T/exec'; currentUser={role:'cs',name:'x',names:[]};`);
    w.openSalaryLcbModal_(); ok(!D.getElementById('slcb-modal'), 'khong phai admin -> khong mo');
    w.eval(`currentUser={role:'admin',name:'Admin',names:[]};`); w.openSalaryLcbModal_(); await wait(200);
    ok(D.getElementById('slcb-modal') && gets.some(g => /action=salaryReport&month=\d{4}-\d{2}/.test(g)), 'admin mo duoc, goi salaryReport theo thang');
    ok(D.querySelectorAll('#slcb-body tbody tr').length === 3 && /Thử việc/.test(D.getElementById('slcb-body').textContent) && /Chính thức/.test(D.getElementById('slcb-body').textContent), 'bang 2 Sale + dong tong, nhan bac tieng Viet');
    ok(/Còn\s*2\s*Sale chưa nhập ngày công/.test(D.getElementById('slcb-missing').textContent), 'bao con 2 Sale chua nhap ngay cong');
    const wd0 = D.getElementById('slcb-wd-0'); wd0.value = '13'; wd0.dispatchEvent(new w.Event('input'));
    ok(/1,750,000/.test(D.getElementById('slcb-net-0').textContent) || /1\.750\.000/.test(D.getElementById('slcb-net-0').textContent), 'go 13/26 ngay -> LCB thuc nhan Nam = 3,5tr/26x13 = 1.750.000: ' + D.getElementById('slcb-net-0').textContent);
    const std = D.getElementById('slcb-std'); std.value = '25'; std.dispatchEvent(new w.Event('input'));
    ok(/1,820,000|1\.820\.000/.test(D.getElementById('slcb-net-0').textContent), 'doi cong chuan 25 -> 3,5tr/25x13 = 1.820.000: ' + D.getElementById('slcb-net-0').textContent);
    ok(/Còn\s*1\s*Sale/.test(D.getElementById('slcb-missing').textContent), 'con 1 Sale chua nhap sau khi go 1 nguoi');
    D.getElementById('slcb-wd-1').value = '25'; D.getElementById('slcb-wd-1').dispatchEvent(new w.Event('input'));
    ok(/Đã nhập ngày công cho tất cả/.test(D.getElementById('slcb-missing').textContent), 'nhap du -> bao da nhap het');
    [...D.querySelectorAll('#slcb-body button')].filter(b => /Lưu ngày công/.test(b.textContent))[0].click(); await wait(200);
    const p = posts.filter(x => x.action === 'salarySaveWorkdays')[0];
    ok(p && /^\d{4}-\d{2}$/.test(p.month) && p.standard === 25 && p.byName.Nam === '13' && p.byName.Tan === '25', 'luu: thang + cong chuan 25 + ngay cong tung nguoi: ' + JSON.stringify(p));
    console.log('ALL SALARY LCB UI TESTS PASSED'); w.close();
  }, 3500);
});

#!/usr/bin/env node
// Test MAU LOC NHANH Bao cao doanh so (js/48-filter-presets.js) bang jsdom. Thieu jsdom thi tu bo qua.
// Chay: node tools/test-filter-presets.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    const st = {}; try { Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; }, clear() {} }, configurable: true }); } catch (e) {}
    w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ ok: true }), ok: true, text: () => Promise.resolve('') });
  } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec';
      _authAccount = { username:'admin1', role:'admin' }; currentUser = { name:'Admin', names:[], role:'admin', team:'' };
      var __calls = []; _srFetch = async function(action, params){ __calls.push({ action: action, params: params }); return null; };
      _srState.optionsLoaded = true; _srState._teamsAutoSynced = true;
      _srState.saleOptions = ['anhNP1999','dungnguyen1995','thuNH1986','yenNTH2004']; _srState.saleBOptions = _srState.saleOptions.slice();
      _srState.kenhOptions = ['K1','K2']; _srState.dateFrom = '2026-10-01'; _srState.dateTo = '2026-10-12';
      window.__prompt = 'Văn phòng'; window.prompt = function(){ return window.__prompt; }; window.confirm = function(){ return true; };
      _srState.sub = 'A'; renderSalesReportTab();`);
    const bar = () => D.getElementById('fp-bar'), chips = () => [...D.querySelectorAll('#fp-bar .fp-chip')];
    ok(bar(), 'co thanh Mau loc nhanh o Bao cao A'); ok(chips().length === 0 && /Chưa có mẫu/.test(bar().textContent), 'ban dau chua co mau');
    ok(bar().previousElementSibling && /select/i.test(bar().previousElementSibling.innerHTML), 'thanh chen ngay sau dong chon bao cao');

    // 1) Luu bo loc hien tai thanh mau
    w.eval("_srState.sale = ['anhNP1999','dungnguyen1995']; _srState.kenh = ['K1'];");
    D.querySelector('#fp-bar [data-fp=save]').click(); await wait(30);
    ok(chips().length === 1 && /Văn phòng/.test(chips()[0].textContent) && /2 sale/.test(chips()[0].textContent), 'luu mau "Van phong" 2 sale');
    ok(chips()[0].classList.contains('on'), 'bo loc hien tai trung mau -> chip sang');
    D.querySelector('#fp-bar [data-fp=save]').click(); await wait(30);
    ok(chips().length === 1, 'trung ten mau bi tu choi (khong tao them)');

    // 2) Bam mau -> loc dung + tai lai bao cao, KHONG dong vao ngay
    w.eval("_srState.sale = []; _srState.kenh = []; _srState.team = ['Team X']; __calls.length = 0;");
    chips()[0].querySelector('[data-fp=apply]').click(); await wait(80);
    ok(JSON.stringify(w.eval('_srState.sale')) === '["anhNP1999","dungnguyen1995"]', 'ap dung -> o Sale = danh sach cua mau');
    ok(JSON.stringify(w.eval('_srState.kenh')) === '["K1"]', 'ap dung -> Kenh cua mau');
    ok(w.eval('_srState.team').length === 0, 'o Loc theo Team duoc xoa (khong dung thanh team nua)');
    ok(w.eval('_srState.dateFrom') === '2026-10-01' && w.eval('_srState.dateTo') === '2026-10-12', 'KHONG doi khoang ngay');
    const c = w.eval('__calls').filter(x => x.action === 'salesReportA').pop(); ok(c, 'tai lai bao cao A');
    ok(c.params.sale === 'anhNP1999,dungnguyen1995' && c.params.kenh === 'K1' && c.params.dateFrom === '2026-10-01', 'gui dung bo loc Sale/Kenh + ngay giu nguyen — ' + JSON.stringify(c.params));
    ok(chips()[0].classList.contains('on'), 'sau khi ap dung chip sang');

    // 3) Tao mau bang hop chon Sale
    D.querySelector('#fp-bar [data-fp=new]').click(); await wait(30);
    ok(D.getElementById('fp-overlay').classList.contains('open'), 'mo hop Tao mau');
    ok(D.querySelectorAll('#fp-list input[type=checkbox]').length === 4, 'liet ke 4 Sale de tick');
    const q = D.getElementById('fp-q'); q.value = 'thu'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(20);
    ok(D.querySelectorAll('#fp-list input[type=checkbox]').length === 1, 'o tim loc danh sach Sale');
    q.value = ''; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(20);
    const cb = n => D.querySelector('#fp-list input[data-fp-sale="' + n + '"]');
    cb('thuNH1986').checked = true; cb('thuNH1986').dispatchEvent(new w.Event('change', { bubbles: true }));
    cb('yenNTH2004').checked = true; cb('yenNTH2004').dispatchEvent(new w.Event('change', { bubbles: true }));
    ok(/Đã chọn 2 Sale/.test(D.getElementById('fp-count').textContent), 'dem so Sale da chon');
    const nm = D.getElementById('fp-name'); nm.value = '<img src=x onerror=window.__xss=1>'; nm.dispatchEvent(new w.Event('input', { bubbles: true }));
    D.querySelector('[data-fp-act=save]').click(); await wait(30);
    ok(!D.getElementById('fp-overlay').classList.contains('open'), 'luu xong dong hop');
    ok(chips().length === 2 && w.__xss !== 1 && !D.querySelector('#fp-bar img'), 'ten mau co HTML bi escape (khong XSS)');
    const lst = JSON.parse(w.eval("JSON.stringify(_fpList())")); const p2 = lst.find(p => /img/.test(p.name));
    ok(p2 && JSON.stringify(p2.filters.sale.sort()) === '["thuNH1986","yenNTH2004"]' && p2.filters.kenh.length === 0, 'mau tao bang hop chi chua Sale da tick, khong kem Kenh');

    // 4) Sua mau: bo 1 Sale, doi ten
    chips()[1].querySelector('[data-fp=edit]').click(); await wait(30);
    ok(cb('thuNH1986').checked && cb('yenNTH2004').checked && !cb('anhNP1999').checked, 'hop sua hien dung cac Sale cua mau');
    cb('yenNTH2004').checked = false; cb('yenNTH2004').dispatchEvent(new w.Event('change', { bubbles: true }));
    const nm2 = D.getElementById('fp-name'); nm2.value = 'Online'; nm2.dispatchEvent(new w.Event('input', { bubbles: true }));
    D.querySelector('[data-fp-act=save]').click(); await wait(30);
    ok(/Online/.test(chips()[1].textContent) && /1 sale/.test(chips()[1].textContent), 'sua ten + danh sach Sale');

    // 5) Ghi de bang bo loc hien tai
    w.eval("_srState.sale = ['thuNH1986','yenNTH2004','anhNP1999']; _srState.kenh = [];");
    chips()[1].querySelector('[data-fp=overwrite]').click(); await wait(30);
    ok(/3 sale/.test(chips()[1].textContent), 'ghi de mau bang bo loc hien tai');

    // 6) Mau theo tung bao cao: sang B thi khong thay mau cua A; mau theo tai khoan
    w.eval("_srState.sub = 'B'; renderSalesReportTab();"); await wait(30);
    ok(bar() && chips().length === 0, 'Bao cao B khong co mau cua Bao cao A');
    w.eval("_srState.sub = 'A'; renderSalesReportTab();"); await wait(30);
    ok(chips().length === 2, 'quay lai A thay 2 mau');
    w.eval("_authAccount = { username:'saleX', role:'cs' }; renderSalesReportTab();"); await wait(30);
    ok(chips().length === 0, 'tai khoan khac khong thay mau cua admin1');
    w.eval("_authAccount = { username:'admin1', role:'admin' }; renderSalesReportTab();"); await wait(30);

    // 7) Xoa mau
    chips()[0].querySelector('[data-fp=del]').click(); await wait(30);
    ok(chips().length === 1 && /Online/.test(chips()[0].textContent), 'xoa mau');
    console.log('ALL FILTER PRESETS TESTS PASSED'); w.close();
  }, 3500);
});

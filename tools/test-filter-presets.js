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
    const ctl = () => D.getElementById('fp-ctl'), rows = () => [...D.querySelectorAll('#fp-gear .fp-mrow')];
    const one = () => D.querySelector('#fp-ctl .fp-one'), sel = () => D.querySelector('#fp-ctl .fp-sel'), off = () => D.querySelector('#fp-ctl .fp-off');
    const menu = a => D.querySelector('#fp-gear [data-fp=' + a + ']');
    const state = k => JSON.stringify(w.eval('_srState.' + k));
    // 0) Vi tri: ngay TRONG thanh cong cu, lien truoc nut Tac vu (cung hang)
    ok(ctl(), 'co o Mau loc nhanh o Bao cao A'); ok(!D.getElementById('fp-bar'), 'khong con thanh mau rieng ben duoi');
    ok(ctl().parentNode.classList.contains('srb-bar'), 'o mau nam TRONG thanh cong cu (.srb-bar)');
    ok(ctl().nextElementSibling && ctl().nextElementSibling.classList.contains('gear-menu') && /Tác vụ/.test(ctl().nextElementSibling.textContent), 'o mau nam ngay truoc nut Tac vu (cung hang)');
    ok(!one() && !sel() && !off() && /Mẫu lọc nhanh/.test(ctl().textContent), 'ban dau chua co mau: chi co menu "Mau loc nhanh"');
    ok(menu('new') && menu('save'), 'menu co Tao mau + Luu bo loc hien tai');

    // 1) Luu bo loc hien tai thanh mau -> 1 mau = 1 nut bam
    w.eval("_srState.sale = ['anhNP1999','dungnguyen1995']; _srState.kenh = ['K1'];");
    menu('save').click(); await wait(30);
    ok(one() && /Văn phòng/.test(one().textContent) && /2 sale/.test(one().textContent) && !sel(), '1 mau -> hien thanh 1 NUT (khong dropdown), 2 sale');
    ok(one().classList.contains('on') && off(), 'bo loc hien tai trung mau -> nut sang + co nut Tat loc nhanh');
    menu('save').click(); await wait(30);
    ok(rows().length === 1, 'trung ten mau bi tu choi (khong tao them)');

    // 2) Bam mau -> loc dung + tai lai bao cao, KHONG dong vao ngay
    w.eval("_srState.sale = []; _srState.kenh = []; _srState.team = ['Team X']; __calls.length = 0; _fpRefresh();");
    ok(!off() && !one().classList.contains('on'), 'bo loc doi khac mau -> het sang, het nut Tat');
    one().click(); await wait(80);
    ok(state('sale') === '["anhNP1999","dungnguyen1995"]', 'ap dung -> o Sale = danh sach cua mau');
    ok(state('kenh') === '["K1"]', 'ap dung -> Kenh cua mau');
    ok(w.eval('_srState.team').length === 0, 'o Loc theo Team duoc xoa (khong dung thanh team nua)');
    ok(w.eval('_srState.dateFrom') === '2026-10-01' && w.eval('_srState.dateTo') === '2026-10-12', 'KHONG doi khoang ngay');
    const c = w.eval('__calls').filter(x => x.action === 'salesReportA').pop(); ok(c, 'tai lai bao cao A');
    ok(c.params.sale === 'anhNP1999,dungnguyen1995' && c.params.kenh === 'K1' && c.params.dateFrom === '2026-10-01', 'gui dung bo loc Sale/Kenh + ngay giu nguyen — ' + JSON.stringify(c.params));
    ok(one().classList.contains('on') && off(), 'sau khi ap dung nut sang + hien Tat loc nhanh');

    // 2b) Tat loc nhanh: bo loc ve rong, tai lai, ngay giu nguyen
    __calls_reset = w.eval('__calls.length = 0');
    off().click(); await wait(80);
    ok(state('sale') === '[]' && state('kenh') === '[]' && state('aSanPham') === '""', 'Tat loc nhanh -> Sale/Kenh/San pham ve rong');
    ok(w.eval('_srState.dateFrom') === '2026-10-01', 'Tat loc nhanh KHONG doi ngay');
    const c2 = w.eval('__calls').filter(x => x.action === 'salesReportA').pop(); ok(c2 && c2.params.sale === '' && c2.params.kenh === '', 'Tat loc nhanh -> tai lai bao cao khong loc Sale/Kenh');
    ok(!off() && !one().classList.contains('on'), 'sau khi tat: het nut Tat, nut mau het sang (van dung lai duoc)');
    one().click(); await wait(80); ok(state('sale') === '["anhNP1999","dungnguyen1995"]', 'lan sau bam lai mau la loc ngay');

    // 3) Tao mau bang hop chon Sale
    menu('new').click(); await wait(30);
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
    ok(rows().length === 2 && w.__xss !== 1 && !D.querySelector('#fp-ctl img') && !D.querySelector('#fp-ctl option img'), 'ten mau co HTML bi escape (khong XSS)');
    const lst = JSON.parse(w.eval("JSON.stringify(_fpList())")); const p2 = lst.find(p => /img/.test(p.name));
    ok(p2 && JSON.stringify(p2.filters.sale.sort()) === '["thuNH1986","yenNTH2004"]' && p2.filters.kenh.length === 0, 'mau tao bang hop chi chua Sale da tick, khong kem Kenh');

    // 3b) Tu 2 mau tro len -> DROPDOWN chon mau
    ok(sel() && !one() && sel().options.length === 3 && /Mẫu lọc nhanh/.test(sel().options[0].textContent), '2 mau -> hien DROPDOWN (cau nhac + 2 mau)');
    ok(sel().value === lst.find(p => /Văn phòng/.test(p.name)).id, 'dropdown chon san mau dang dung (Van phong)');
    __c = w.eval('__calls.length = 0');
    sel().value = p2.id; sel().dispatchEvent(new w.Event('change', { bubbles: true })); await wait(80);
    ok(state('sale') === '["thuNH1986","yenNTH2004"]' && state('kenh') === '[]', 'chon mau trong dropdown -> loc ngay theo mau do');
    ok(sel().value === p2.id && sel().classList.contains('on') && off(), 'dropdown hien mau dang dung + nut Tat loc nhanh');
    sel().value = ''; sel().dispatchEvent(new w.Event('change', { bubbles: true })); await wait(80);
    ok(state('sale') === '[]' && !off(), 'chon dong cau nhac "Mau loc nhanh…" khi dang dung mau = tat loc nhanh');
    sel().value = p2.id; sel().dispatchEvent(new w.Event('change', { bubbles: true })); await wait(80);

    // 3c) Sua bo loc bang menu 🔎 (khac mau) -> het ghi nhan dang dung mau
    w.eval("_srState.sale = ['anhNP1999']; _fpRefresh();");
    ok(!off() && !sel().classList.contains('on'), 'chinh bo loc khac mau -> khong con coi la dang dung mau');

    // 4) Sua mau: bo 1 Sale, doi ten (menu Quan ly mau)
    ok(rows().length === 2 && /Quản lý mẫu/.test(D.getElementById('fp-gear').textContent), 'menu co muc Quan ly mau, moi mau 1 dong');
    rows()[1].querySelector('[data-fp=edit]').click(); await wait(30);
    ok(cb('thuNH1986').checked && cb('yenNTH2004').checked && !cb('anhNP1999').checked, 'hop sua hien dung cac Sale cua mau');
    cb('yenNTH2004').checked = false; cb('yenNTH2004').dispatchEvent(new w.Event('change', { bubbles: true }));
    const nm2 = D.getElementById('fp-name'); nm2.value = 'Online'; nm2.dispatchEvent(new w.Event('input', { bubbles: true }));
    D.querySelector('[data-fp-act=save]').click(); await wait(30);
    ok(/Online/.test(rows()[1].textContent) && [...sel().options].some(o => /Online \(1 sale\)/.test(o.textContent)), 'sua ten + danh sach Sale');

    // 5) Ghi de bang bo loc hien tai
    w.eval("_srState.sale = ['thuNH1986','yenNTH2004','anhNP1999']; _srState.kenh = [];");
    rows()[1].querySelector('[data-fp=overwrite]').click(); await wait(30);
    ok([...sel().options].some(o => /Online \(3 sale\)/.test(o.textContent)), 'ghi de mau bang bo loc hien tai');

    // 6) Mau theo tung bao cao: sang B thi khong thay mau cua A; mau theo tai khoan
    w.eval("_srState.sub = 'B'; renderSalesReportTab();"); await wait(30);
    ok(ctl() && ctl().parentNode.classList.contains('srb-bar') && !sel() && !one(), 'Bao cao B cung co o mau trong thanh cong cu, khong co mau cua Bao cao A');
    w.eval("_srState.sub = 'A'; renderSalesReportTab();"); await wait(30);
    ok(sel() && rows().length === 2, 'quay lai A thay 2 mau');
    w.eval("_authAccount = { username:'saleX', role:'cs' }; renderSalesReportTab();"); await wait(30);
    ok(!sel() && !one(), 'tai khoan khac khong thay mau cua admin1');
    w.eval("_authAccount = { username:'admin1', role:'admin' }; renderSalesReportTab();"); await wait(30);

    // 7) Xoa mau -> con 1 mau thi tro lai thanh nut
    rows()[0].querySelector('[data-fp=del]').click(); await wait(30);
    ok(rows().length === 1 && one() && !sel() && /Online/.test(one().textContent), 'xoa mau -> con 1 mau thi lai la 1 nut');
    console.log('ALL FILTER PRESETS TESTS PASSED'); w.close();
  }, 3500);
});

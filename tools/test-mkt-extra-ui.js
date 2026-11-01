#!/usr/bin/env node
// Test giao dien 3 CHI SO BO SUNG o Checklist MKT (js/10-fn-pkkpipct.js) bang jsdom. Thieu jsdom thi tu bo qua.
// Chay: node tools/test-mkt-extra-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const posts = [];
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) { const st = {}; try { Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; }, clear() {} }, configurable: true }); } catch (e) {}
    w.fetch = (u, o) => { if (/action=mktChecklist/.test(String(u))) return Promise.resolve({ ok: true, json: () => Promise.resolve(w.__lastReport) });   // ok:true nhu Response that (js/06 ghi log khi !r.ok va goi r.clone())
      if (o && o.body) posts.push(JSON.parse(o.body)); return Promise.resolve({ json: () => Promise.resolve({ ok: true }), ok: true }); }; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const row = (code, count, rate, denom, den, v) => ({ code, count, rate, denom, denomLabel: denom, denomValue: den, target: null, op: 'gte', passed: null });
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec';
      _mktState.loaded = true; _mktState.loading = false; _mktState.cfgDraft = null; _mktState.showExtra = false;
      var __tags = [ { code:'L1', count:50, rate:50, denom:'tt', denomLabel:'Tổng tương tác', denomValue:100, target:0.8, op:'gte', passed:false },
                     { code:'L5', count:5, rate:5, denom:'tt', denomLabel:'Tổng tương tác', denomValue:100, target:null, op:'gte', passed:null } ];
      var __ex = [ { code:'XCT', count:3, rate:3, denom:'tt', denomLabel:'Tổng tương tác', denomValue:100, target:null, op:'gte', passed:null },
                   { code:'XL5', count:10, rate:16.7, denom:'ttMoi', denomLabel:'Tổng tương tác KH mới', denomValue:60, target:null, op:'gte', passed:null },
                   { code:'XL9', count:5, rate:12.5, denom:'ttCu', denomLabel:'Tổng tương tác KH cũ', denomValue:40, target:null, op:'gte', passed:null } ];
      _mktState.report = { ok:true, from:'2026-10-01', to:'2026-10-12', month:'2026-10', configSource:'2026-10', warnings:[],
        tongTT:100, khMoiTotal:60, khCuTotal:40, sdtThuThap:30, baseOrders:5, baseRevenue:5000000, trungBinhDon:1000000, tyLeChotTong:5,
        tags:__tags, extra:__ex,
        groups:{ mkt:[ { id:'m1', name:'MKT A', pages:['Page 1'], tongTT:100, khMoiTotal:60, khCuTotal:40, sdtThuThap:30, baseOrders:5, tyLeChotTong:5, baseRevenue:5000000, trungBinhDon:1000000,
                        tags:__tags, extra:[ __ex[0], __ex[1], __ex[2] ] } ],
                 sale:[ { nhom:'Văn phòng', soSale:1, tongTT:70, khMoiTotal:40, khCuTotal:30, sdtThuThap:20, baseOrders:3, tyLeChotTong:4, baseRevenue:3000000, trungBinhDon:1000000,
                          tags:__tags.map(function(t){return Object.assign({},t,{count:null,rate:null})}),
                          extra:[ Object.assign({},__ex[0],{count:2,rate:2.9}), Object.assign({},__ex[1],{count:null,rate:null}), Object.assign({},__ex[2],{count:null,rate:null}) ] } ] },
        config:{}, dataAvail:{} };
      _mktRender();`);
    w.__lastReport = w.eval('_mktState.report');   // luu lai cho lan tai lai sau khi luu cau hinh
    const wrap = D.getElementById('mktchecklist-wrap'), txt = () => wrap.textContent;
    ok(D.querySelector('#mktchecklist-wrap input[type=checkbox]'), 'co o tuy chon "Xem them chi so bo sung"');
    ok(txt().indexOf('Chốt trong ngày') < 0 && txt().indexOf('Tỷ lệ chốt Pancake') < 0, 'mac dinh KHONG hien chi so bo sung');
    ok(txt().indexOf('L1') >= 0 && txt().indexOf('Tổng đơn') >= 0, 'bao cao goc van day du');
    // bat tuy chon
    const cb = D.querySelector('#mktchecklist-wrap input[type=checkbox]'); cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(50);
    ok(txt().indexOf('Chỉ số bổ sung') >= 0, 'bat -> co dong tieu de "Chi so bo sung"');
    ok(txt().indexOf('Tỷ lệ chốt Pancake — đơn có người tạo là sale') >= 0, 'bang chinh co dong ty le chot Pancake (nguoi tao la sale)');
    ok(txt().indexOf('Chốt trong ngày (L5 + L5.1 + L5.2)') >= 0 && txt().indexOf('Chốt đơn hôm trước (L9 + L9.1 + L9.2)') >= 0, 'co L5 gop va L9 gop');
    ok(/16\.7%/.test(txt()) && /12\.5%/.test(txt()) && /3%/.test(txt()), 'hien dung ty le 16.7% / 12.5% / 3%');
    ok(txt().indexOf('Tương tác KH mới') >= 0, 'mau so KH moi hien ra');
    ok(wrap.querySelectorAll('table').length === 3, '3 bang: chinh + Team MKT + Team Sale');
    ok(w.localStorage.getItem('mkt_show_extra') === '1', 'nho lua chon bat');
    ok(/\((?:2\.9)%\)/.test(wrap.querySelectorAll('table')[2].textContent), 'Team Sale: XCT co ty le');
    ok(wrap.querySelectorAll('table')[2].textContent.indexOf('—') >= 0, 'Team Sale: L5/L9 gop khong chia duoc theo sale -> hien —');
    // sua muc tieu / mau so co ca 3 chi so
    w.eval('_mktOpenCfgEditor()'); await wait(50);
    ok(D.querySelectorAll('#mktchecklist-wrap select').length >= 3, 'form sua co o chon cho cac dong');
    ok(txt().indexOf('Chốt trong ngày (L5 + L5.1 + L5.2)') >= 0, 'form sua co dong XL5');
    w.eval("_mktCfgSetTarget('XL5', '20'); _mktCfgSetDenom('XL5', 'ttMoi')");
    await w.eval('_mktSaveCfg()'); await wait(50);
    const sv = posts.find(p => p.action === 'saveMktChecklistConfig'); ok(sv, 'goi luu cau hinh');
    ok(sv.config.XL5 && sv.config.XL5.target === 0.2 && sv.config.XL5.denom === 'ttMoi', 'luu muc tieu 20% cho XL5');
    ok(sv.config.XCT && sv.config.XL9, 'luu cau hinh kem XCT va XL9');
    // tat tuy chon -> mat
    w.eval('_mktState.cfgDraft = null'); w.eval('_mktToggleExtra(false)'); await wait(50);
    ok(txt().indexOf('Chốt trong ngày') < 0, 'tat -> an chi so bo sung');
    console.log('ALL MKT EXTRA UI TESTS PASSED'); w.close();
  }, 3500);
});

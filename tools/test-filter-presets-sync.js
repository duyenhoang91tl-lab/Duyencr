#!/usr/bin/env node
// Test DONG BO mau loc nhanh len server (js/48-filter-presets.js: key Settings filterPresets_<user>). Thieu jsdom thi bo qua.
// Chay: node tools/test-filter-presets-sync.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('ok   ' + m); };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    const st = {}; Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; }, clear() {} }, configurable: true });
    w.__f = []; w.__srv = null; w.__fail = false;
    w.fetch = (u, o) => { u = String(u); w.__f.push({ u, b: o && o.body });
      if (/action=getSetting/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve({ value: w.__srv }) });
      if (o && o.body && /"setSetting"/.test(o.body)) { if (w.__fail) return Promise.reject(new Error('net')); const b = JSON.parse(o.body); w.__srv = b.value; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }); }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve('') }); };
  } }).then(dom => {
  const w = dom.window, D = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
  setTimeout(async () => {
    const P = (id, name, sales) => ({ id, name, sales, extras: {}, created: 1 });
    w.__srv = JSON.stringify([P('s1', 'MauServer', ['anhNP1999'])]);
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec'; _authAccount = { username:'admin1', role:'admin' }; currentUser = { name:'Admin', names:[], role:'admin', team:'' };
      _srFetch = async function(){ return null; }; _srState.optionsLoaded = true; _srState._teamsAutoSynced = true;
      _srState.saleOptions = ['anhNP1999','dungnguyen1995']; _srState.saleBOptions = _srState.saleOptions.slice();
      window.prompt = function(){ return 'MauMay'; }; window.confirm = function(){ return true; };
      _srState.sub = 'A'; renderSalesReportTab();`);
    await wait(150);
    const names = () => JSON.parse(w.eval('JSON.stringify(_fpList())')).map(p => p.name);
    ok(JSON.stringify(names()) === '["MauServer"]', 'may moi (local rong) lay mau tu server ve');
    ok(w.__f.some(x => /key=filterPresets_admin1/.test(x.u)), 'doc dung key filterPresets_admin1');
    ok(D.querySelector('#fp-ctl .fp-one') && /MauServer/.test(D.querySelector('#fp-ctl .fp-one').textContent), 'thanh mau hien mau lay ve');
    // luu mau moi -> day len server
    w.eval("_srState.sale = ['dungnguyen1995']"); D.querySelector('#fp-gear [data-fp=save]').click(); await wait(700);
    const srv = JSON.parse(w.__srv); ok(srv.length === 2 && srv.some(p => p.name === 'MauMay'), 'luu mau -> server co 2 mau (gom MauMay)');
    ok(w.localStorage.getItem('ome_sr_filter_presets_dirty:admin1') === null, 'ghi server xong -> het co dirty');
    // mat mang luc luu -> giu dirty, phien sau day len thay vi lay ban cu ve de
    w.__fail = true; w.eval("_srState.sale = ['anhNP1999']; _srState.sub='A'"); w.prompt = () => 'MauOffline'; D.querySelector('#fp-gear [data-fp=save]').click(); await wait(700);
    ok(w.localStorage.getItem('ome_sr_filter_presets_dirty:admin1') === '1', 'loi mang -> con co dirty');
    w.__fail = false; w.eval('_fpSync.reset(); renderSalesReportTab();'); await wait(700);
    ok(JSON.parse(w.__srv).some(p => p.name === 'MauOffline') && names().includes('MauOffline'), 'phien sau: day ban may len server, KHONG bi ban cu de');
    // xoa 1 mau -> server cung xoa
    const id = JSON.parse(w.eval('JSON.stringify(_fpList())')).find(p => p.name === 'MauMay').id;
    D.querySelector('#fp-gear [data-fp=del][data-id="' + id + '"]').click(); await wait(700);
    ok(!JSON.parse(w.__srv).some(p => p.name === 'MauMay'), 'xoa mau -> server cung xoa');
    // may khac: server doi, local sach -> cap nhat theo server
    w.__srv = JSON.stringify([P('z9', 'TuMayKhac', [])]); w.eval('_fpSync.reset(); renderSalesReportTab();'); await wait(300);
    ok(JSON.stringify(names()) === '["TuMayKhac"]', 'server doi tu may khac -> may nay lay ve');
    console.log('ALL FILTER PRESETS SYNC TESTS PASSED'); w.close();
  }, 3500);
});

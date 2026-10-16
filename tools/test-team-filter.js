#!/usr/bin/env node
// Test LOC THEO TEAM / DOI o Bao cao doanh so: bo Team phai go danh sach Sale do Team dien (loi cu: Sale giu nguyen -> van loc theo Team da bo),
// bang doi chieu hien ten khop/khong khop, va nut loc nhanh theo DOI (Van phong/Online) tu SALE_CHANNELS. Can jsdom (thieu thi bo qua).
// Chay: node tools/test-team-filter.js
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
      _authAccount = { username:'admin1', role:'admin' }; currentUser = { name:'Admin', names:[], role:'admin', team:'' }; accounts = [];
      var __calls = []; _srFetch = async function(a, p){ __calls.push({ action:a, params:p }); return null; };
      var __toasts = []; var __t0 = toast; toast = function(m){ __toasts.push(m); };
      _srState.optionsLoaded = true; _srState._teamsAutoSynced = true;
      _srState.saleOptions = ['yenNTH2004','anhNP1999','thuNH1986','dungnguyen1995','Ninh Le'];
      _srState.saleBOptions = _srState.saleOptions.slice();
      teams = [ { id:'t1', name:'Văn phòng', leader:'yenNTH2004', members:['anhNP1999','thuNH1986'] },
                { id:'t2', name:'Online', leader:'dungnguyen1995', members:['Ninh Le','GhostName'] } ];
      SALE_GROUPS = [{ key:'online', label:'Online' }, { key:'offline', label:'Văn phòng' }];
      SALE_CHANNELS = { yenNTH2004:'offline', ANHNP1999:'offline', thuNH1986:'offline', dungnguyen1995:'online', ghost:'online' };
      _srState.sub = 'A'; renderSalesReportTab();`);
    const S = () => w.eval('_srState.sale'), T = () => w.eval('_srState.team'), txt = () => (D.getElementById('fp-bar') || { textContent: '' }).textContent;
    const pick = (team) => w.eval(`srbMenuPick({ getAttribute: function(a){ return a === 'data-k' ? 'team' : '${team}'; } })`);
    // 1) chon Van phong
    pick('Văn phòng'); await wait(20);
    ok(JSON.stringify(S()) === '["yenNTH2004","anhNP1999","thuNH1986"]', 'chon Van phong -> 3 Sale cua team');
    ok(/Team Văn phòng/.test(txt()) && /đang lọc 3 Sale/.test(txt()), 'bang doi chieu hien Team + so Sale dang loc');
    // 2) chon them Online (co 1 ten khong ton tai trong du lieu bao cao)
    pick('Online'); await wait(20);
    ok(S().length === 5 && S().indexOf('GhostName') === -1, 'hop Van phong + Online, bo ten khong co that');
    ok(/1 tên trong Team không có trong dữ liệu báo cáo/.test(txt()) && /GhostName/.test(txt()), 'bang doi chieu bao ro ten bi bo (GhostName)');
    // 3) bo Van phong -> chi con Online; bo not Online -> PHAI GO SALE (loi cu: giu nguyen)
    pick('Văn phòng'); await wait(20); ok(JSON.stringify(S()) === '["dungnguyen1995","Ninh Le"]', 'bo Van phong -> con Online');
    pick('Online'); await wait(20);
    ok(T().length === 0 && S().length === 0, 'BO HET TEAM -> go luon danh sach Sale do Team dien (khong con loc theo Team cu) — sale=' + JSON.stringify(S()));
    ok(!/đang lọc/.test(txt()), 'bo het Team -> bang doi chieu bien mat');
    // 4) nguoi dung TU sua Sale sau khi chon Team -> bo Team khong xoa lua chon tu tay
    pick('Văn phòng'); await wait(20);
    w.eval(`srbMenuPick({ getAttribute: function(a){ return a === 'data-k' ? 'sale' : 'Ninh Le'; } })`); await wait(20);
    ok(S().indexOf('Ninh Le') !== -1 && S().length === 4, 'tu them 1 Sale sau khi chon Team');
    pick('Văn phòng'); await wait(20);
    ok(T().length === 0 && S().length === 4, 'bo Team nhung nguoi dung da tu sua Sale -> GIU NGUYEN lua chon tu tay');
    // 5) nut "xoa" cua muc Team (menu loc) cung go Sale do Team dien
    w.eval("_srState.sale = []; _srState.team = [];"); pick('Online'); await wait(20);
    ok(S().length === 2, 'chon lai Online');
    w.eval("srbMenuClearCat('team')"); await wait(20);
    ok(T().length === 0 && S().length === 0, 'xoa muc Team trong menu loc -> go luon Sale do Team dien');

    // 6) Loc nhanh theo DOI (Van phong / Online) tu SALE_CHANNELS
    w.eval("_srState.sale = []; _srState.team = []; __calls.length = 0; renderSalesReportTab();"); await wait(20);
    const g = JSON.parse(w.eval("JSON.stringify(_fpGroups('A'))"));
    const vp = g.find(x => x.key === 'offline'), ol = g.find(x => x.key === 'online');
    ok(JSON.stringify(vp.sales) === '["yenNTH2004","anhNP1999","thuNH1986"]' && vp.missing.length === 0, 'doi Van phong: khop ten khong phan biet hoa/thuong (ANHNP1999 -> anhNP1999)');
    ok(JSON.stringify(ol.sales) === '["dungnguyen1995"]' && JSON.stringify(ol.missing) === '["ghost"]', 'doi Online: 1 ten khop, 1 ten khong co trong du lieu bao cao');
    const chip = k => D.querySelector('#fp-bar .fp-grp[data-key="' + k + '"]');
    ok(chip('offline') && /Văn phòng/.test(chip('offline').textContent) && /3 sale/.test(chip('offline').textContent), 'co nut doi Van phong (3 sale)');
    ok(/ghost/.test(chip('online').getAttribute('title')), 'tooltip doi Online bao ten bi bo');
    chip('offline').click(); await wait(80);
    ok(JSON.stringify(S()) === '["yenNTH2004","anhNP1999","thuNH1986"]' && T().length === 0, 'bam doi Van phong -> loc dung 3 Sale');
    const c = w.eval('__calls').filter(x => x.action === 'salesReportA').pop();
    ok(c && c.params.sale === 'yenNTH2004,anhNP1999,thuNH1986' && c.params.dateFrom === w.eval('_srState.dateFrom'), 'tai lai bao cao voi dung Sale, khong doi ngay');
    ok(chip('offline').classList.contains('on') && !chip('online').classList.contains('on'), 'nut doi dang chon sang len');
    chip('online').click(); await wait(80);
    ok(JSON.stringify(S()) === '["dungnguyen1995"]', 'bam doi Online -> chi con 1 Sale (ten ghost khong co trong du lieu)');
    // doi khong co ten nao khop -> khong tai lai, bao ro
    w.eval("SALE_CHANNELS = { zzz:'online' }; renderSalesReportTab(); __calls.length = 0; __toasts.length = 0;"); await wait(20);
    ok(chip('online').classList.contains('off'), 'doi khong khop ten nao -> nut mo');
    chip('online').click(); await wait(40);
    ok(w.eval('__calls').length === 0 && /không tên Sale nào khớp/.test(w.eval('__toasts').join('|')), 'bam doi rong -> bao ro, khong tai lai bao cao');
    console.log('ALL TEAM FILTER TESTS PASSED'); w.close();
  }, 3500);
});

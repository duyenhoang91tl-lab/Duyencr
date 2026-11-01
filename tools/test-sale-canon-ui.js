#!/usr/bin/env node
// Test client: cau hinh theo TEN (% hoa hong ca nhan, kenh, ngay bat dau, team) tra theo MOI ten cung nguoi sau khi bao cao quy ten ve TEN CHINH.
// Can jsdom (thieu thi bo qua). Chay: node tools/test-sale-canon-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    const st = {}; try { Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; }, clear() {} }, configurable: true }); } catch (e) {}
    w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ ok: true }), ok: true, text: () => Promise.resolve('') });
  } }).then(dom => {
  const w = dom.window;
  setTimeout(() => {
    w.eval(`accounts = [ { username:'saleA', role:'cs', name:'Anh', names:['anhNP1999','anhnp99'], startDate:'2026-09-01' } ];
      SALE_PERSON_TAGS = {}; teams = []; INDIVIDUAL_RATES = {}; SALE_CHANNELS = {};
      _SALE_ALIAS_MAP = {}; _srRegisterIdentity_({ saleIdentity: { anhNP1999: ['anhNP1999', 'anhnp99', 'Anh'] } });`);
    const rate = n => JSON.parse(w.eval(`JSON.stringify(_resolveCommissionRate_(${JSON.stringify(n)}))`));
    // 1) Ten chinh duoc dung tren bao cao, nhung cau hinh dat duoi TEN KHAC cua cung nguoi van duoc ap dung
    w.eval("INDIVIDUAL_RATES = { anhnp99: { above15: 2, below15: 1.2 } };");
    let r = rate('anhNP1999'); ok(r.above15 === 2 && r.below15 === 1.2 && r.sourceAbove15 === 'Cá nhân', '% hoa hong ca nhan dat duoi ten phu "anhnp99" van ap cho ten chinh — ' + JSON.stringify(r));
    ok(rate('Nguoi La').above15 === 0, 'nguoi khac khong bi lay nham');
    // 2) Khong co ca nhan -> team (thanh vien ghi bang ten khac)
    w.eval("INDIVIDUAL_RATES = {}; teams = [{ id:'t1', name:'Team 1', leader:'leadX', members:['anhnp99'], ratePct:{ above15: 1.7, below15: 1.1 } }];");
    r = rate('anhNP1999'); ok(r.above15 === 1.7 && /Team 1/.test(r.sourceAbove15), 'team ghi thanh vien bang ten khac van ap — ' + JSON.stringify(r));
    // 3) Khong co team -> mac dinh theo kenh dat duoi ten khac
    w.eval("teams = []; SALE_CHANNELS = { anhnp99: 'online' };");
    ok(w.eval("_saleChannelOf_('anhNP1999')") === 'online', 'kenh Online dat duoi ten phu van tra duoc cho ten chinh');
    r = rate('anhNP1999'); ok(r.above15 === 1.5 && r.below15 === 1 && /Online/.test(r.sourceAbove15), 'mac dinh Online (1.5/1) theo kenh cua nguoi — ' + JSON.stringify(r));
    // 4) Ngay bat dau thu viec luu o tai khoan (theo ten dang nhap/phu) -> tra duoc tu ten chinh
    ok(w.eval("_saleStartDate_('anhNP1999')") === '2026-09-01' && w.eval("_saleStartDate_('anhnp99')") === '2026-09-01', 'ngay bat dau tra duoc tu ten chinh va tu ten phu');
    ok(w.eval("_saleStartDate_('Nguoi La')") === '', 'nguoi la khong co ngay bat dau');
    // 5) Hoa hong 1 nguoi = 1 dong (2 ten da quy ve ten chinh) + dung % ca nhan
    w.eval("INDIVIDUAL_RATES = { anhnp99: { above15: 2, below15: 1.2 } };");
    const out = JSON.parse(w.eval(`JSON.stringify(_computeCommissionData_([ { saleBan:'anhNP1999', giaTriDon: 20000000, nguonDon:'' }, { saleBan:'anhNP1999', giaTriDon: 10000000, nguonDon:'' } ]))`));
    const rows = out.rows || out.bySale || out.sales || Object.keys(out).map(k => out[k]).find(Array.isArray) || [];
    const row = rows.find(x => x.name === 'anhNP1999');
    ok(rows.length === 1 && row, 'chi 1 dong cho nguoi (ten chinh) — rows=' + JSON.stringify(rows).slice(0, 160));
    ok(Math.round(row.totalCommission || row.commission || row.total || 0) === 520000, 'hoa hong = 20tr x 2% + 10tr x 1.2% = 520.000 — ' + JSON.stringify(row).slice(0, 200));
    console.log('ALL SALE CANON UI TESTS PASSED'); w.close();
  }, 3500);
});

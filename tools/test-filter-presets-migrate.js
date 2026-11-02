#!/usr/bin/env node
// Test chuyen mau loc nhanh CU (v1: theo tung bao cao) sang MO HINH MOI (v2: dung chung moi bao cao). Can jsdom. Chay: node tools/test-filter-presets-migrate.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const V1 = [
  { id: 'a1', sub: 'A', name: 'Văn phòng', created: 1, filters: { sale: ['anhNP1999', 'dungnguyen1995'], kenh: ['K1'], aSanPham: '' } },
  { id: 'b1', sub: 'B', name: 'văn phòng', created: 2, filters: { bSale: ['dungnguyen1995', 'thuNH1986'], bNguon: ['Facebook'], bMarketer: [], bSanPham: '', bCareStatus: [], bKhStatus: [], bZaloStatus: [], bNickZalo: '' } },
  { id: 'e1', sub: 'E', name: 'Online', created: 3, filters: { eSale: ['yenNTH2004'], eKenh: [] } }
];
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    const st = { 'ome_sr_filter_presets_v1:admin1': JSON.stringify(V1) };
    try { Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; }, clear() {} }, configurable: true }); } catch (e) {}
    w.__st = st; w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ ok: true }), ok: true, text: () => Promise.resolve('') });
  } }).then(dom => {
  const w = dom.window;
  setTimeout(() => {
    w.eval("_authAccount = { username:'admin1', role:'admin' };");
    const list = JSON.parse(w.eval('JSON.stringify(_fpList())'));
    ok(list.length === 2, 'mau cung ten (khong phan biet hoa/thuong) o 2 bao cao gop thanh 1 — con ' + list.length + ' mau');
    const vp = list.find(p => /văn phòng/i.test(p.name)), ol = list.find(p => p.name === 'Online');
    ok(JSON.stringify(vp.sales.slice().sort()) === '["anhNP1999","dungnguyen1995","thuNH1986"]', 'Sale cua 2 mau hop lai (khong trung) — ' + JSON.stringify(vp.sales));
    ok(JSON.stringify(vp.extras.A) === '{"kenh":["K1"]}' && JSON.stringify(vp.extras.B) === '{"bNguon":["Facebook"]}', 'bo loc rieng giu theo TUNG bao cao, bo khoa rong — ' + JSON.stringify(vp.extras));
    ok(JSON.stringify(ol.sales) === '["yenNTH2004"]' && Object.keys(ol.extras).length === 0, 'mau chi co Sale -> khong co extras');
    ok('ome_sr_filter_presets_v2:admin1' in w.__st && 'ome_sr_filter_presets_v1:admin1' in w.__st, 'ghi khoa v2, GIU NGUYEN du lieu v1 (de lui lai neu can)');
    // lan sau doc v2, khong migrate lai (sua mau khong bi ghi de)
    w.eval("var _l = _fpList(); _l[0].name = 'Doi ten'; localStorage.setItem('ome_sr_filter_presets_v2:admin1', JSON.stringify(_l));");
    ok(JSON.parse(w.eval('JSON.stringify(_fpList())'))[0].name === 'Doi ten', 'da co v2 thi dung v2, khong chuyen lai tu v1');
    // tai khoan khac khong co mau
    w.eval("_authAccount = { username:'saleX', role:'cs' };"); ok(JSON.parse(w.eval('JSON.stringify(_fpList())')).length === 0, 'tai khoan khac khong co mau');
    console.log('ALL FILTER PRESETS MIGRATE TESTS PASSED'); w.close();
  }, 3500);
});

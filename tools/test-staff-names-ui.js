#!/usr/bin/env node
// Test giao dien "Ten theo he thong" trong Ho so nhan vien (js/47-staff-profile.js) bang jsdom + fetch gia. Thieu jsdom thi tu bo qua.
// Chay: NODE_PATH=<noi co jsdom> node tools/test-staff-names-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom (npm i --no-save jsdom@24)'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [];
let ADMIN = true, NAMES = { pancake: ['Ngà Ninh'], crm: [], base: ['Ninh Nga', 'ninhnga.base'], pos: [] };
const profile = () => ({ ok: true, username: 'ninhnga99', accountName: 'ninhnga99', role: 'cs', team: 'VP', names: ['ninhnga99'], canEdit: true, canEditNames: ADMIN,
  profile: { fullName: 'Ninh Thị Ngà', phone: '', email: '', facebook: '', updatedAt: '', names: NAMES } });
function fakeFetch(url, o) {
  calls.push({ url: String(url), body: o && o.body });
  let out = { ok: false, error: 'khong biet' };
  if (/action=profileGet/.test(url)) out = profile();
  else if (/action=staffOverview/.test(url)) out = { ok: true, names: [], totalOrders: 0, revenue: 0, commission: 0, bonus: 0, warnings: [] };
  else if (o && o.body && /profileSave/.test(o.body)) { const b = JSON.parse(o.body); out = ADMIN && b.names && b.names.base.indexOf('Trung') > -1 ? { ok: false, error: 'Tên đang thuộc người khác: "Trung" (nhóm thẻ "x")' } : { ok: true, profile: Object.assign({}, b.profile, { names: b.names || NAMES, updatedAt: '2026-11-26T02:00:00.000Z' }) }; }
  return Promise.resolve({ json: () => Promise.resolve(out), ok: true });
}
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.fetch = fakeFetch; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec'; _authAccount = { username:'admin1', role:'admin', name:'Admin' };
      currentUser = { name:'Admin', names:[], role:'admin', team:'' }; accounts = [{ username:'ninhnga99', name:'ninhnga99', role:'cs', team:'VP' }];`);
    // 1) admin: 4 o nhap, CRM tu dien username khi rong
    w.openProfileModal('ninhnga99'); await wait(300);
    ['pancake', 'crm', 'base', 'pos'].forEach(k => ok(D.getElementById('sp-nm-' + k) && !D.getElementById('sp-nm-' + k).disabled, 'admin co o ten ' + k));
    ok(D.getElementById('sp-nm-pancake').value === 'Ngà Ninh', 'hien ten Pancake da luu');
    ok(D.getElementById('sp-nm-base').value === 'Ninh Nga, ninhnga.base', 'nhieu ten ngan cach bang dau phay');
    ok(D.getElementById('sp-nm-crm').value === 'ninhnga99', 'o CRM rong -> goi y san username');
    // 2) luu: gui names da tach mang + bo trung
    D.getElementById('sp-nm-pos').value = 'ninhnga99 pos,  NINHNGA99 POS ; Nga POS';
    D.getElementById('sp-save').click(); await wait(100);
    const sv = calls.filter(c => c.body && /profileSave/.test(c.body)); ok(sv.length === 1, 'goi profileSave 1 lan');
    const b = JSON.parse(sv[0].body);
    ok(JSON.stringify(b.names.pos) === JSON.stringify(['ninhnga99 pos', 'Nga POS']), 'tach theo dau phay/;, bo trung hoa-thuong: ' + JSON.stringify(b.names.pos));
    ok(JSON.stringify(b.names.base) === JSON.stringify(['Ninh Nga', 'ninhnga.base']) && b.names.crm[0] === 'ninhnga99', 'gui du 4 he thong');
    // 3) loi xung dot tu server -> hien toast, khong crash, o van con
    D.getElementById('sp-nm-base').value = 'Trung'; D.getElementById('sp-save').click(); await wait(100);
    ok(D.getElementById('sp-nm-base') && D.getElementById('sp-save'), 'sau loi van con form');
    // 4) khong phai admin: chi xem, khong gui names
    ADMIN = false; calls.length = 0; w.eval(`_authAccount = { username:'ninhnga99', role:'cs', name:'Ninh' }; currentUser = { name:'ninhnga99', names:[], role:'cs', team:'VP' };`);
    w.openProfileModal('ninhnga99'); await wait(300);
    ok(!D.getElementById('sp-nm-base'), 'nhan vien thuong KHONG co o sua ten theo he thong');
    ok(/Ninh Nga, ninhnga\.base/.test(D.querySelector('.sp-names').textContent) && /Chỉ admin sửa được/.test(D.querySelector('.sp-names').textContent), 'nhan vien thay ten (chi doc) + ghi chu chi admin sua');
    D.getElementById('sp-save').click(); await wait(100);
    const sv2 = calls.filter(c => c.body && /profileSave/.test(c.body)); ok(sv2.length === 1 && JSON.parse(sv2[0].body).names === undefined, 'nhan vien luu ho so thi KHONG gui names (server giu nguyen)');
    console.log('ALL STAFF NAMES UI TESTS PASSED'); w.close();
  }, 3500);
});

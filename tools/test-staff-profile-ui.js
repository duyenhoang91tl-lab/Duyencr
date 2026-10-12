#!/usr/bin/env node
// Test giao dien Hồ sơ nhân viên (js/47-staff-profile.js) bang jsdom + fetch gia. Thieu jsdom thi tu bo qua.
// Chay: node tools/test-staff-profile-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom (npm i --no-save jsdom@24)'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const calls = [];
const PROFILE = { ok: true, username: 'saleA', accountName: 'Anh', role: 'cs', team: 'Team 1', names: ['anhNP1999', 'saleA'], canEdit: true,
  profile: { fullName: '<img src=x onerror=window.__xss=1>', phone: '0911222333', email: 'a@x.vn', facebook: 'https://facebook.com/anh', updatedAt: '2026-10-12T01:00:00.000Z' } };
const OV = { ok: true, username: 'saleA', names: ['anhNP1999'], totalOrders: 12, revenue: 5000000, commission: 150000, bonus: 40000, closeRatePancake: 10, phoneConnectRate: 30,
  pancakeConversations: 200, phoneCollected: 60, rankTeam: { name: 'Team 1', rank: 2, of: 3 }, rankDept: null, warnings: [] };
function fakeFetch(url, o) {
  calls.push({ url: String(url), body: o && o.body });
  let out = { ok: false, error: 'khong biet' };
  if (/action=profileGet/.test(url)) out = /username=saleB/.test(url) ? { ok: false, error: 'Bạn không có quyền xem hồ sơ này.', code: 'FORBIDDEN' } : PROFILE;
  else if (/action=staffOverview/.test(url)) out = OV;
  else if (o && o.body && /profileSave/.test(o.body)) { const b = JSON.parse(o.body); out = { ok: true, profile: Object.assign({}, b.profile, { updatedAt: '2026-10-12T02:00:00.000Z' }) }; }
  return Promise.resolve({ json: () => Promise.resolve(out), ok: true });
}
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) { w.fetch = fakeFetch; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec';
      _authAccount = { username:'saleA', role:'cs', name:'Anh' };
      currentUser = { name:'anhNP1999', names:['anhNP1999'], role:'cs', team:'Team 1' };
      accounts = [{ username:'saleA', name:'Anh', role:'cs', team:'Team 1' }, { username:'saleB', name:'Dung', role:'cs', team:'Team 1' }, { username:'demo1', role:'demo' }];
      allCustomers = [ { phone:'1', careCSSet:new Set(['anhNP1999']), zaloStatus:'Đã kết bạn' }, { phone:'2', careCSSet:new Set(['anhNP1999']), zaloStatus:'Chưa kết bạn' },
                       { phone:'3', careCSSet:new Set(['dungnguyen1995']), zaloStatus:'Đã kết bạn' }, { phone:'4', careCS:'ANHNP1999', zaloStatus:'Đã kết bạn' } ];`);
    ok(typeof w.openProfileModal === 'function', 'co openProfileModal');
    ok(D.querySelector('.sn-act[data-act="profile"]'), 'menu co muc Ho so nhan vien');
    w.openProfileModal(); await wait(300);
    const ov = D.getElementById('sp-overlay'); ok(ov && ov.classList.contains('open'), 'hop thoai mo');
    ok(D.querySelector('#sp-overlay > .sp-box.sp-box') && D.querySelector('.sp-layout > .sp-colL #sp-fullName') && D.querySelector('.sp-layout > .sp-colR .sp-card'), 'bo cuc man day du: ho so o cot trai, ket qua o cot phai');
    ok(/Quay lại/.test(D.getElementById('sp-close').textContent), 'nut ← Quay lai');
    ok(D.documentElement.classList.contains('sp-lock'), 'khoa cuon trang nen khi man day du mo');
    ok(!D.querySelector('.sp-overlay .sp-box').style.maxWidth && /position:fixed;inset:0/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', '09-profile.css'), 'utf8')) && !/width:min\(620px/.test(require('fs').readFileSync(path.join(__dirname, '..', 'css', '09-profile.css'), 'utf8')), 'CSS: phu kin cua so, khong con hop 620px');
    ok(!D.getElementById('sp-pick'), 'nhan vien thuong khong co o chon nhan vien');
    ok(w.__xss !== 1 && !D.querySelector('#sp-body img'), 'ho ten co HTML bi escape (khong XSS)');
    ok(D.getElementById('sp-fullName').value.indexOf('<img') === 0, 'o ho ten giu nguyen chuoi text');
    ok(!D.getElementById('sp-phone').disabled, 'nhan vien sua duoc ho so minh');
    const cards = [...D.querySelectorAll('.sp-card')].map(c => c.textContent);
    ok(cards.length === 11, 'du 11 the so lieu, co ' + cards.length);
    const has = (lbl, val) => ok(cards.some(t => t.indexOf(lbl) >= 0 && t.indexOf(val) >= 0), 'the "' + lbl + '" phai chua "' + val + '" — ' + JSON.stringify(cards.filter(t => t.indexOf(lbl) >= 0)));
    has('Tổng số đơn', '12'); has('Tổng doanh thu', '5.000.000đ'); has('Hoa hồng', '150.000đ'); has('Thưởng', '40.000đ');
    has('Khách đang giữ', '3');                       // 2 khach (careCSSet) + 1 khach (careCS khong phan biet hoa/thuong); khach cua nguoi khac khong tinh
    has('Đã kết bạn Zalo', '2');                      // khach 1 va 4
    has('Tỷ lệ chốt (Pancake)', '10%'); has('Chốt / khách đang giữ', '400%'); has('Kết nối điện thoại', '30%');
    has('Xếp hạng team', '2'); has('Xếp hạng phòng KD', '—');   // chua thuoc phong -> hien — (khong hien 0)
    // luu
    D.getElementById('sp-fullName').value = 'Nguyễn Anh'; D.getElementById('sp-facebook').value = 'facebook.com/anh';
    D.getElementById('sp-save').click(); await wait(100);
    const sv = calls.filter(c => c.body && /profileSave/.test(c.body)); ok(sv.length === 1, 'goi profileSave 1 lan');
    const sb = JSON.parse(sv[0].body); ok(sb.profile.fullName === 'Nguyễn Anh' && sb.username === 'saleA', 'gui dung noi dung + username');
    ok(D.getElementById('sp-fullName').value === 'Nguyễn Anh', 'giao dien hien noi dung vua luu');
    // admin chon nhan vien
    w.eval(`_authAccount = { username:'admin1', role:'admin' }; currentUser = { name:'Admin', names:[], role:'admin', team:'' };`);
    w.openProfileModal('saleA'); await wait(300);
    const pick = D.getElementById('sp-pick'); ok(pick, 'admin co o chon nhan vien');
    ok([...pick.options].map(o => o.value).join() === 'saleA,saleB', 'o chon chi liet ke tai khoan that (bo demo)');
    pick.value = 'saleB'; pick.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(300);
    ok(/không có quyền/.test(D.getElementById('sp-body').textContent), 'bi tu choi quyen -> hien thong bao, khong crash');
    // doi ky
    const pick2 = D.getElementById('sp-pick');   // giao dien da ve lai -> lay lai o chon moi
    pick2.value = 'saleA'; pick2.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(300);
    const n0 = calls.filter(c => /staffOverview/.test(c.url)).length;
    const q = D.getElementById('sp-quick'); q.value = 'lastMonth'; q.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(300);
    ok(calls.filter(c => /staffOverview/.test(c.url)).length === n0 + 1, 'doi ky -> goi lai staffOverview');
    ok(/from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}/.test(calls[calls.length - 1].url), 'tham so ngay dung dinh dang');
    D.getElementById('sp-close').click();
    ok(!D.getElementById('sp-overlay').classList.contains('open') && !D.documentElement.classList.contains('sp-lock'), '← Quay lai dong man hinh va mo khoa cuon trang');
    w.openProfileModal(); await wait(100);
    ok(D.getElementById('sp-overlay').classList.contains('open') && D.documentElement.classList.contains('sp-lock'), 'mo lai duoc');
    console.log('ALL STAFF PROFILE UI TESTS PASSED'); w.close();
  }, 3500);
});

#!/usr/bin/env node
// Test nut "← Quay lai" o thanh tren (js/29-sidenav.js): mo mot muc tu menu xong phai co nut quay ve man truoc. Chay: node tools/test-nav-back.js
const fs = require('fs'), vm = require('vm'), { JSDOM } = require('jsdom');
const dom = new JSDOM(`<header></header><div id="data-view"><div class="tabs">
  <button class="tab active" data-bar-id="tab-kh">Danh sách KH</button>
  <button class="tab" data-bar-id="crmorders">Đơn CRM</button>
  <button class="tab" data-bar-id="tab-schedule">Lịch chăm sóc</button>
  <button class="tab" id="noid" onclick="1">Mục không mã</button></div></div>`, { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window, ctx = dom.getInternalVMContext(), d = w.document;
vm.runInContext('var currentUser={role:"admin"},_authAccount=null,_bootstrapAdmin=true;', ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../js/29-sidenav.js', 'utf8'), ctx);
let ok = 0, fail = 0; const t = (c, n) => { c ? ok++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n); };
const tabs = [...d.querySelectorAll('.tab')];
tabs.forEach(el => el.addEventListener('click', () => { tabs.forEach(x => x.classList.remove('active')); el.classList.add('active'); }));
const nb = () => d.getElementById('sn-back'), vis = () => nb().classList.contains('sn-on'), tick = () => new Promise(r => setTimeout(r, 30));
const cur = () => d.querySelector('.tab.active').textContent;
const pick = i => { tabs[i].click(); return tick(); };
(async () => {
  await tick();
  t(!!nb() && !vis(), 'co nut Quay lai trong header; luc dau chua co man truoc → an');
  await pick(1);
  t(vis() && /Danh sách KH/.test(nb().textContent) && /Danh sách KH/.test(nb().title), 'mo Don CRM → hien nut, ghi ro quay ve "Danh sach KH"');
  nb().click(); await tick();
  t(cur() === 'Danh sách KH' && !vis(), 'bam Quay lai → ve Danh sach KH, het man truoc → an nut');
  await pick(1); await pick(2); await pick(3);
  t(/Lịch chăm sóc/.test(nb().textContent), 'di tiep nhieu man: nut chi ra man NGAY TRUOC');
  nb().click(); await tick(); t(cur() === 'Lịch chăm sóc' && vis(), 'Quay lai 1 → Lich cham soc, van con man truoc nua');
  nb().click(); await tick(); t(cur() === 'Đơn CRM', 'Quay lai 2 → Don CRM (dung thu tu da di)');
  nb().click(); await tick(); t(cur() === 'Danh sách KH' && !vis(), 'Quay lai 3 → Danh sach KH, het lich su');
  await pick(1); await pick(1);
  t(d.querySelectorAll('.tab.active').length === 1 && /Danh sách KH/.test(nb().title), 'bam lai dung man dang xem → khong ghi trung vao lich su');
  await pick(2); tabs[1].style.display = 'none'; nb().click(); await tick();
  t(cur() === 'Danh sách KH', 'man truoc (Don CRM) bi an do het quyen → bo qua, ve man gan nhat con vao duoc');
  d.getElementById('data-view').style.display = 'none'; await tick();
  t(!vis(), 'roi man du lieu (dang xuat) → an nut');
  d.getElementById('data-view').style.display = ''; await tick(); t(!vis(), 'vao lai: lich su da xoa, khong co man truoc ma → khong hien');
  console.log(ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

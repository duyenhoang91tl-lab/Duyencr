#!/usr/bin/env node
// Test: bao cao K (js/28) — o "Ma bo dem" bam duoc (mo chi tiet don) + nut copy + nut "Mo ho so khach" (Duyen yeu cau 2026-10-23, vi du don 1011T09/2026).
// Chay: NODE_PATH=<noi cai jsdom>/node_modules node tools/test-bd-code-click.js -> "BD CODE CLICK TESTS PASSED". Nap NGUYEN js/27 + js/28 that.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dom = new JSDOM('<body><div id="wrap"></div></body>', { runScripts: 'dangerously' });
  const w = dom.window; const log = { toast: [], open: [], pull: [], clip: [] };
  w.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  w.fmt = n => String(n); w._srMoney = n => String(n) + 'd'; w.toast = m => log.toast.push(m);
  w.loadLS = () => null; w.saveLS = () => {}; w._origSaveLS = () => {};
  w._srNoDataHtml_ = () => 'nodata'; w._ddmmyyyyToYmd_ = s => s; w.renderSalesReportTab = () => {};
  w._srState = {}; w.normPhone = s => String(s || '').replace(/\D/g, '');
  w.customerMap = { '0901111222': { phone: '0901111222' } };
  w.openDp = p => log.open.push(p);
  w._pullSearchCustomer_ = async p => { log.pull.push(p); w.customerMap[p] = { phone: p }; return p; };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { log.clip.push(t); return Promise.resolve(); } }, configurable: true });
  w.eval(rd('27-fn-bonuscore.js')); w.eval(rd('28-fn-bonusdetail.js'));
  // du lieu theo anh cua Duyen: don 1011T09/2026 cua ninhnga99, 4 dong san pham
  const d = { orders: [{ baseNgayTao: '2026-10-01', donGoc: true, ghiChu: '1011T09/2026', soDienThoai: '0901111222', khachHang: 'Bich', saleBan: 'ninhnga99, Nguyễn Thị Bích',
    maSanPham: 'HN-LT-Tr-4.5li;CRTT-LT;HDD-LT;CV10K-BV-SIZE 3', sanPham: 'HAT NG LAM THUY,CHARM ROI,HAT DONG DIEU,CHARM BI', soLuong: '1,1,5,4', giaTriDon: 9016000 }] };
  w._srState.dataG = d;
  const html = w._bdRenderBody_(d);
  const box = w.document.getElementById('wrap'); box.innerHTML = html;
  const spans = [...box.querySelectorAll('span[data-counter]')];
  ok(spans.length === 4 && spans.every(s => s.textContent === '1011T09/2026'), 'moi dong san pham co ma bo dem bam duoc (4 dong): ' + spans.length);
  const copyBtns = [...box.querySelectorAll('button[title="Copy mã"]')]; ok(copyBtns.length === 4, 'co 4 nut copy');
  // bam nut copy -> clipboard nhan dung ma, khong kich hoat mo don
  copyBtns[0].click(); await sleep(10);
  ok(log.clip[0] === '1011T09/2026' && log.toast.some(t => /Đã copy mã 1011T09\/2026/.test(t)), 'copy dung ma + bao toast');
  ok(!w.document.getElementById('bd-order-modal'), 'bam copy khong mo popup');
  // bam ma -> popup chi tiet don
  spans[1].click();
  const m = w.document.getElementById('bd-order-modal'); ok(!!m, 'bam ma mo popup chi tiet don');
  ok(/1011T09\/2026/.test(m.textContent) && /0901111222/.test(m.textContent) && /9016000/.test(m.textContent), 'popup co ma + SDT + doanh thu');
  const cp = m.querySelector('button[data-counter]'); ok(!!cp, 'popup co nut copy ma'); cp.click(); await sleep(10); ok(log.clip.length === 2, 'popup copy duoc');
  // mo ho so khach: khach co san -> openDp ngay
  m.querySelector('button[data-phone]').click(); await sleep(10);
  ok(log.open[0] === '0901111222' && !w.document.getElementById('bd-order-modal'), 'Mo ho so khach: dong popup + openDp');
  // khach ngoai danh sach -> nap rieng roi mo; tai khoan test thi khong
  await w._bdOpenCustomer_('0909999999'); ok(log.pull[0] === '0909999999' && log.open[1] === '0909999999', 'khach ngoai pham vi nap roi mo');
  w.document.body.classList.add('demo-mode'); await w._bdOpenCustomer_('0908888888');
  ok(log.pull.length === 1 && log.open.length === 2, 'demo-mode khong nap khach ngoai');
  // copy fallback khi khong co clipboard API
  Object.defineProperty(w.navigator, 'clipboard', { value: undefined, configurable: true }); w.document.execCommand = () => true;
  w._bdCopyCode('ABC1T10/2026'); ok(log.toast.some(t => /ABC1T10\/2026/.test(t)), 'fallback execCommand van bao da copy');
  console.log('BD CODE CLICK TESTS PASSED'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

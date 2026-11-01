#!/usr/bin/env node
// Test bang don theo giai doan: hien MA BO DEM (cot U) thay cho id so, bam chip la sao chep. CAN jsdom (thieu thi tu bo qua).
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: thieu jsdom (npm i jsdom)'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '41-fn-stageboard.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const dom = new JSDOM('<!doctype html><body><div id="xt-wrap-stageboard"></div></body>', { runScripts: 'dangerously', url: 'https://crm.test/' });
  const w = dom.window, copied = [], toasts = [];
  w.esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = (m) => toasts.push(m); w.registerExtraTab = () => {}; w.currentUser = { role: 'admin' };
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } });
  w.eval(code);
  w.eval(`_sb.hours = 24; _sb.stages = [{ name: 'Phân loại đơn', count: 3, stuck: 1, items: [
    { id: '3415154', maBoDem: '196T10/2026', hours: 100, stuck: true, sale: 'ninhnga99', giaoCho: 'Hapham1987', sanPham: 'Cuốn 5 ngọc lam thuỷ', value: 8040000, ngayTao: '10/10/2026' },
    { id: '3481144', maBoDem: '', hours: 5, stuck: false, sale: 'huyenmai1990', giaoCho: '', sanPham: '', value: 12578000, ngayTao: '' },
    { id: '3500001', maBoDem: 'BH7T10/2026<img src=x onerror=alert(1)>', hours: null, stuck: false, sale: 'a', giaoCho: '', sanPham: 'SP', value: 0, ngayTao: '' } ] }]; _sbRender();`);
  const wrap = w.document.getElementById('xt-wrap-stageboard');
  const chips = [...wrap.querySelectorAll('.sb-code')];
  ok(chips.length === 3, 'moi the co 1 chip ma don');
  ok(chips[0].getAttribute('data-code') === '196T10/2026' && /196T10\/2026/.test(chips[0].textContent), 'the co ma bo dem -> hien MA BO DEM (khong phai #id)');
  ok(!/3415154/.test(chips[0].textContent), 'khong con hien id so 3415154 tren the');
  ok(chips[1].getAttribute('data-code') === '#3481144', 'don chua co ma bo dem -> lui ve #id cua Base');
  ok(/Đơn #3481144/.test(wrap.innerHTML) , 'don khong co ten san pham: tieu de the dung ma hien thi');
  ok(wrap.querySelector('img') === null && /&lt;img/.test(wrap.innerHTML), 'ma bo dem chua HTML bi escape: khong tao the <img> that (chong XSS)');

  // bam chip -> copy dung ma, KHONG mo modal
  chips[0].click(); await sleep(30);
  ok(copied[0] === '196T10/2026', 'bam chip -> clipboard nhan dung ma bo dem');
  ok(!w.document.getElementById('sb-modal'), 'bam chip KHONG mo modal chi tiet (stopPropagation)');
  ok(toasts.some((t) => /196T10\/2026/.test(t)), 'co thong bao da sao chep');
  ok(/Đã chép/.test(chips[0].textContent), 'chip doi thanh "Da chep" lam phan hoi');
  await sleep(1200); ok(/196T10\/2026/.test(chips[0].textContent), 'chip tu tra ve ma sau 1 giay');

  // bam vao than the -> mo modal; tieu de la ma bo dem, copy duoc, con hang "Ma don Base"
  const card = chips[0].closest('div[onclick*="_sbOpen"]'); card.click();
  const modal = w.document.getElementById('sb-modal');
  ok(modal, 'bam the -> mo modal');
  const mchip = modal.querySelector('.sb-code');
  ok(/Đơn/.test(modal.querySelector('b').textContent) && mchip.getAttribute('data-code') === '196T10/2026', 'modal: tieu de "Don <ma bo dem>" (khong phai 3415154)');
  mchip.click(); await sleep(30);
  ok(copied[1] === '196T10/2026' && w.document.getElementById('sb-modal'), 'modal: bam ma -> copy, modal van mo');
  ok(/Mã đơn Base/.test(modal.textContent) && /#3415154/.test(modal.textContent), 'modal van con hang "Ma don Base #3415154" de tra cuu tren Base');
  modal.remove();
  // modal don khong co ma bo dem: khong them hang "Ma don Base" thua
  w.eval('_sbOpen(0,1)'); ok(!/Mã đơn Base/.test(w.document.getElementById('sb-modal').textContent), 'don khong co ma bo dem: khong co hang Ma don Base thua');
  w.document.getElementById('sb-modal').remove();

  // tim kiem theo ma bo dem va theo id
  w.eval("_sb.q = '196t10'; _sbRender();");
  ok(wrap.querySelectorAll('.sb-code').length === 1, 'tim "196t10" ra dung 1 don (theo ma bo dem)');
  w.eval("_sb.q = '3481144'; _sbRender();");
  ok(wrap.querySelectorAll('.sb-code').length === 1, 'van tim duoc theo id so cu');

  // clipboard bi chan -> fallback execCommand, khong nem loi
  Object.defineProperty(w.navigator, 'clipboard', { value: undefined, configurable: true });
  let exec = 0; w.document.execCommand = (c) => { exec++; return true; };
  w.eval("_sb.q = ''; _sbRender();"); w.document.querySelector('.sb-code').click(); await sleep(20);
  ok(exec === 1, 'khong co navigator.clipboard -> dung execCommand du phong');
  console.log('\nALL STAGEBOARD BODEM TESTS PASSED');
})().catch((e) => { console.error('ERR', e); process.exit(1); });

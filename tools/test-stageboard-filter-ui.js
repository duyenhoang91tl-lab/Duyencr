#!/usr/bin/env node
// Test giao dien Bang don theo giai doan: bo loc ngay/phong/team/sale/nguon goi dung tham so, the co chip khach (bam = mo ho so khach, khong mo modal don). CAN jsdom.
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: thieu jsdom (npm i jsdom)'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '41-fn-stageboard.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const dom = new JSDOM('<!doctype html><body><div id="xt-wrap-stageboard"></div></body>', { runScripts: 'dangerously', url: 'https://crm.test/' });
  const w = dom.window, urls = [], opened = [];
  w.esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = () => {}; w.registerExtraTab = () => {}; w.currentUser = { role: 'admin' }; w.gsUrl = 'https://gas.test/exec';
  w._bdOpenCustomer_ = (ph) => { opened.push(ph); };
  w.customerMap = { '0837923113': { name: 'Phạm Phương Nga' } };
  const stages = [{ name: 'Phân loại đơn', count: 2, stuck: 0, items: [
    { id: '1', maBoDem: '1032T10/2026', hours: 4, stuck: false, sale: 'Thuydinh1995', giaoCho: 'Hapham1987', sanPham: 'Nhẫn NG mẫu A', value: 7950000, ngayTao: '21/10/2026', phone: '0837923113', kenh: 'Quầy Hào Nam' },
    { id: '2', maBoDem: '', hours: 2, stuck: false, sale: 'a', giaoCho: '', sanPham: 'SP', value: 0, ngayTao: '', phone: '', kenh: '' } ] }];
  const opt = { depts: [{ key: 'sale', label: 'Sale' }, { key: 'sanxuat', label: 'Sản xuất' }, { key: '__none', label: '(chưa phân phòng)' }], teams: ['Team Nga', 'Team Thùy'], sales: ['Thuydinh1995', 'ninhnga99', 'a<b>'], kenh: ['Quầy Hào Nam', 'Zalo OA'] };
  w.fetch = (u) => { urls.push(u); return Promise.resolve({ json: () => Promise.resolve({ ok: true, hours: 24, stages, options: opt, filterActive: /dateFrom|depts|teams|sales|kenh/.test(u) }) }); };
  w.eval(code);
  await w.eval('_sbLoad()'); await sleep(20);
  const wrap = w.document.getElementById('xt-wrap-stageboard'), $ = (s) => wrap.querySelector(s), $$ = (s) => [...wrap.querySelectorAll(s)];
  ok(urls.length === 1 && /action=stageBoard&names=/.test(urls[0]) && !/dateFrom|depts=|teams=|sales=|kenh=/.test(urls[0]), 'tai lan dau: khong co tham so loc');
  ok($$('input[type=date]').length === 2, 'co 2 o chon ngay (tu / den)');
  const btnTxt = $$('.sb-ms > button').map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  ok(btnTxt.length === 4 && /Phòng ban/.test(btnTxt[0]) && /Team/.test(btnTxt[1]) && /Sale/.test(btnTxt[2]) && /Nguồn/.test(btnTxt[3]), 'co du 4 o chon: Phong ban / Team / Sale / Nguon');
  ok(!$('.sb-ms-panel'), 'panel dong khi chua bam');

  // --- chip khach tren the ---
  const chips = $$('.sb-cust');
  ok(chips.length === 1 && /Phạm Phương Nga/.test(chips[0].textContent) && /0837923113/.test(chips[0].textContent), 'the co SDT -> chip "ten khach · SDT" (ten lay tu danh sach khach); the khong SDT khong co chip');
  chips[0].click(); await sleep(10);
  ok(opened.length === 1 && opened[0] === '0837923113', 'bam chip khach -> mo ho so khach dung SDT');
  ok(!w.document.getElementById('sb-modal'), 'bam chip khach KHONG mo modal chi tiet don');
  ok(/Quầy Hào Nam/.test(wrap.textContent), 'the hien nguon / kenh ban');
  // bam the (ngoai chip) -> modal don co dong Khach hang
  $('div[onclick^="_sbOpen("]').click(); await sleep(10);
  const modal = w.document.getElementById('sb-modal');
  ok(modal && /Khách hàng/.test(modal.textContent) && /Mở hồ sơ khách/.test(modal.textContent) && /Nguồn \/ kênh bán/.test(modal.textContent), 'modal don co dong Khach hang (mo ho so) + Nguon');
  modal.querySelector('.sb-cust').click(); await sleep(10);
  ok(opened.length === 2 && opened[1] === '0837923113' && !w.document.getElementById('sb-modal'), 'bam o khach trong modal -> mo ho so khach va dong modal');

  // --- tim kiem theo SDT ---
  w.eval("_sb.q = '837923113'; _sbRender()");
  ok($$('.sb-cust').length === 1 && !/SP</.test(wrap.innerHTML.replace(/Nhẫn[^<]*/, '')), 'tim theo SDT tim ra dung the');
  w.eval("_sb.q = ''; _sbRender()");

  // --- mo o chon, tick nhieu muc -> tai lai MOT lan (debounce) voi dung tham so ---
  $('.sb-ms > button').click(); await sleep(5);
  ok(!!$('.sb-ms-panel') && $$('.sb-ms-panel input[type=checkbox]').length === 3, 'bam Phong ban -> mo panel 3 lua chon (Sale, San xuat, chua phan phong)');
  const before = urls.length;
  $$('.sb-ms-panel input[type=checkbox]')[1].click(); await sleep(5);
  ok(!!$('.sb-ms-panel'), 'tick 1 muc -> panel van mo');
  $$('.sb-ms-panel input[type=checkbox]')[0].click(); await sleep(5);
  ok($$('.sb-ms-panel input[type=checkbox]').filter((c) => c.checked).length === 2, 'da tick 2 muc (tick luu qua lan ve lai)');
  ok(urls.length === before, 'chua tai lai trong luc dang tick (debounce)');
  await sleep(450);
  ok(urls.length === before + 1, 'tick 2 muc -> chi tai lai 1 lan');
  ok(/depts=sanxuat%7Csale/.test(urls[urls.length - 1]), 'tham so depts = sanxuat|sale (cach nhau |)');
  ok(/Phòng ban \(2\)/.test($('.sb-ms > button').textContent.replace(/\s+/g, ' ')), 'nut hien so da chon (2)');

  // --- go tim trong o chon: chi an/hien dong, khong ve lai ---
  w.eval("_sbMsToggle('sales')"); await sleep(5);
  const sInp = $('.sb-ms-panel input[type=search]'); sInp.value = 'ninh'; sInp.dispatchEvent(new w.Event('input', { bubbles: true }));
  const vis = $$('.sb-ms-row').filter((r) => r.style.display !== 'none').map((r) => r.textContent.trim());
  ok(vis.length === 1 && vis[0] === 'ninhnga99', 'go "ninh" trong o Sale -> chi con ninhnga99');
  w.eval("_sbRender()");
  ok($('.sb-ms-panel input[type=search]').value === 'ninh' && $$('.sb-ms-row').filter((r) => r.style.display !== 'none').length === 1, 've lai bang giu nguyen chu dang go tim + ket qua loc cua o chon');
  $$('.sb-ms-row').filter((r) => r.style.display !== 'none')[0].querySelector('input').click(); await sleep(450);
  ok(/sales=ninhnga99/.test(urls[urls.length - 1]) && /depts=sanxuat%7Csale/.test(urls[urls.length - 1]), 'chon them Sale -> tham so gom ca depts + sales');
  ok(!/a%3Cb%3E/.test(urls[urls.length - 1]), '(gia tri khac khong bi lan vao)');
  ok(/&lt;b&gt;/.test($$('.sb-ms-row').map((r) => r.innerHTML).join('')) && !$('.sb-ms-panel b'), 'ten sale chua HTML bi escape trong danh sach lua chon (chong XSS)');

  // --- click ra ngoai dong panel ---
  w.document.body.click(); await sleep(5);
  ok(!$('.sb-ms-panel'), 'bam ra ngoai -> dong panel');

  // --- ngay + preset + xoa loc ---
  const dates = $$('input[type=date]'); dates[0].value = '2026-10-20'; dates[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(450);
  ok(/dateFrom=2026-10-20/.test(urls[urls.length - 1]) && !/dateTo=/.test(urls[urls.length - 1]), 'chon tu ngay -> dateFrom');
  ok(/bỏ giới hạn mặc định/.test(wrap.textContent), 'co chon ngay -> hien chu thich bo gioi han mac dinh 60 ngay / Dong hang 7 ngay');
  const preset = $$('button').filter((b) => b.textContent === 'Hôm nay')[0]; preset.click(); await sleep(450);
  const m = /dateFrom=(\d{4}-\d{2}-\d{2})&dateTo=(\d{4}-\d{2}-\d{2})/.exec(urls[urls.length - 1]);
  ok(m && m[1] === m[2], 'preset "Hom nay" -> dateFrom = dateTo');
  const clr = $$('button').filter((b) => /Xoá lọc/.test(b.textContent))[0]; ok(!!clr, 'dang loc -> co nut Xoa loc'); clr.click(); await sleep(450);
  ok(!/dateFrom|depts=|teams=|sales=|kenh=/.test(urls[urls.length - 1]) && !$$('button').some((b) => /Xoá lọc/.test(b.textContent)), 'Xoa loc -> tai lai khong tham so, nut bien mat');

  // --- ket qua tra ve cham cua lan tai cu bi bo ---
  let resolveOld; const slow = new Promise((r) => { resolveOld = r; });
  w.fetch = (u) => /sales=old/.test(u) ? slow : Promise.resolve({ json: () => Promise.resolve({ ok: true, hours: 24, stages: [{ name: 'Tiếp nhận đơn', count: 0, stuck: 0, items: [] }], options: opt }) });
  w.eval("_sb.f.sales = ['old']"); const pOld = w.eval('_sbLoad()');
  w.eval("_sb.f.sales = []"); await w.eval('_sbLoad()');
  resolveOld({ json: () => Promise.resolve({ ok: true, hours: 24, stages: [{ name: 'CU-KHONG-DUOC-HIEN', count: 0, stuck: 0, items: [] }], options: opt }) });
  await pOld; await sleep(10);
  ok(!/CU-KHONG-DUOC-HIEN/.test(wrap.textContent), 'ket qua cu ve cham khong de len ket qua moi (chong lech khi doi loc nhanh)');
  console.log('\nTAT CA PASS');
})().catch((e) => { console.error('LOI', e); process.exit(1); });

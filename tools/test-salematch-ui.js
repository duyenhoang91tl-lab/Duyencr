#!/usr/bin/env node
// Test giao dien "Khop sale" (js/52-fn-salematch.js) bang jsdom + fetch gia. CAN: npm i jsdom (thieu thi tu bo qua).  node tools/test-salematch-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '52-fn-salematch.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + '\n  co :' + JSON.stringify(a) + '\n  can:' + JSON.stringify(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = [
  { name: 'Nguyễn Thúy', srcs: { crm_name: 1 }, person: 'p1' }, { name: 'ninhnga99', srcs: { pancake: 2, pos: 5, base: 3 }, person: 'p1' }, { name: 'thuy_base', srcs: { dir_base: 1, base: 4 }, person: 'p1' },
  { name: 'Ninh Nga', srcs: { facebook: 1 }, person: 'p9' }, { name: 'hoa88', srcs: { pancake: 1, pos: 2 }, person: 'p3' }, { name: 'Hoa', srcs: { base: 2 }, person: 'p4' },
  { name: 'Lan 01', srcs: { dir_ma: 1 }, person: 'p5' }, { name: '<img src=x onerror=alert(1)>', srcs: { pos: 1 }, person: 'p6' }];
function boot(tags) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window, saved = [], toasts = [], reqs = [];
  w.gsUrl = 'https://gas.test/exec'; w.toast = (m) => toasts.push(m); w.confirm = () => true; w.prompt = () => 'Thúy mới';
  w.esc = (s) => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.eval('var SALE_PERSON_TAGS = {};'); w._ptSave = async () => { saved.push(JSON.parse(JSON.stringify(w.SALE_PERSON_TAGS))); };
  let serverTags = tags || { 'Nguyễn Thúy': ['ninhnga99'] };
  w.fetch = async (url) => { reqs.push(url); return { json: async () => ({ ok: true, names: NAMES, tags: serverTags, errors: [] }) }; };
  w.eval(code);
  return { w, d: w.document, saved, toasts, reqs, setServerTags: (t) => { serverTags = t; } };
}
const q = (d, s) => d.querySelector(s), qa = (d, s) => [...d.querySelectorAll(s)];
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const tab = (w, d, t) => click(w, q(d, '[data-smtab="' + t + '"]'));
const tick = (w, el, v) => { el.checked = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); };

(async () => {
  let t = boot(); let { w, d } = t; await w.openSaleMatchModal(); await sleep(10);
  ok(/saleMatchCandidates/.test(t.reqs[0]), 'goi action saleMatchCandidates');
  // 1) tab Đã khớp: nhóm có sẵn + badge nguồn + nhóm hệ thống tự gộp
  let html = q(d, '#sm-body').innerHTML;
  ok(/Nguyễn Thúy/.test(html) && /ninhnga99/.test(html) && /Pos ×5/.test(html) && /Pancake ×2/.test(html), 'hien nhom da khop + badge nguon + so lan');
  ok(/thuy_base/.test(html) && /tự gộp/.test(html) && /Cố định thành nhóm/.test(html), 'thuy_base cung nguoi (p1) nhung chua khop tay -> hien o muc he thong tu gop');
  ok(!q(d, '#sm-body img'), 'XSS: ten co the <img> duoc escape');
  // 2) Cố định nhóm tự gộp -> thành nhóm khớp tay
  click(w, q(d, '[data-smfix]')); ok(w._sm.tags['Nguyễn Thúy'].includes('thuy_base'), 'co dinh: thuy_base duoc them vao nhom Nguyen Thuy co san: ' + JSON.stringify(w._sm.tags));
  ok(q(d, '#sm-save').style.display !== 'none', 'hien nut Luu khi co thay doi');

  // 3) Tab Chưa khớp: chọn 2 tên -> Gộp thành người mới, chọn tên chính
  t = boot(); ({ w, d } = t); await w.openSaleMatchModal(); await sleep(10); tab(w, d, 'free');
  let rows = qa(d, '.sm-row'); ok(!rows.some((r) => /ninhnga99/.test(r.textContent)), 'ten da khop khong nam o "Chua khop"'); ok(rows.some((r) => /hoa88/.test(r.textContent)), 'hoa88 chua khop');
  tick(w, q(d, 'input[data-smsel="hoa88"]'), true); tick(w, q(d, 'input[data-smsel="Hoa"]'), true);
  ok(/Đã chọn.*2/.test(q(d, '#sm-foot').textContent), 'footer dem so ten da chon'); click(w, q(d, '#sm-merge'));
  const main = q(d, '#sm-d-main'); main.value = 'hoa88'; click(w, q(d, '#sm-d-ok'));
  eq(w._sm.tags['hoa88'], ['Hoa'], 'nguoi moi: ten chinh hoa88 + the Hoa'); ok(w._sm.dirty, 'danh dau chua luu');
  // 4) gộp vào nhóm có sẵn + một tên chỉ ở 1 nhóm
  tab(w, d, 'free'); tick(w, q(d, 'input[data-smsel="Lan 01"]'), true); click(w, q(d, '#sm-merge')); q(d, '#sm-d-to').value = 'Nguyễn Thúy'; click(w, q(d, '#sm-d-ok'));
  ok(w._sm.tags['Nguyễn Thúy'].includes('Lan 01'), 'gop vao nhom co san');
  w._smAddTo('hoa88', ['ninhnga99']); ok(!w._sm.tags['Nguyễn Thúy'] || !w._sm.tags['Nguyễn Thúy'].includes('ninhnga99'), 'ten chuyen nhom thi roi nhom cu (moi ten chi o 1 nhom)');
  // 5) bỏ tên chính -> tên đầu tiên còn lại lên làm chính; nhóm chỉ còn 1 tên thì xoá
  w._sm.tags = { A: ['B', 'C'] }; w._smRemoveFromGroups('A'); eq(w._sm.tags, { B: ['C'] }, 'bo ten chinh -> B len lam chinh');
  w._smRemoveFromGroups('C'); eq(w._sm.tags, {}, 'nhom con 1 ten bi xoa');
  // 6) đổi tên chính giữ thành viên + giữ tên cũ như thẻ
  t = boot(); ({ w, d } = t); await w.openSaleMatchModal(); await sleep(10); click(w, q(d, '[data-smren]'));
  ok(w._sm.tags['Thúy mới'] && w._sm.tags['Thúy mới'].includes('ninhnga99') && w._sm.tags['Thúy mới'].includes('Nguyễn Thúy') && !w._sm.tags['Nguyễn Thúy'], 'doi ten chinh: giu thanh vien + ten cu thanh the');
  // 7) Gợi ý: tên giống nhau nhưng khác người
  tab(w, d, 'sug'); html = q(d, '#sm-body').innerHTML; ok(!/Ninh Nga/.test(html), 'ninhnga99 da khop tay nen khong goi y lai (Ninh Nga chi 1 ten con lai)');
  t = boot({}); ({ w, d } = t); await w.openSaleMatchModal(); await sleep(10); tab(w, d, 'sug'); html = q(d, '#sm-body').innerHTML; ok(/Ninh Nga/.test(html) && /ninhnga99/.test(html) && /Gộp/.test(html), 'chua khop tay: goi y gop ninhnga99 + Ninh Nga'); click(w, q(d, '[data-smsug]')); ok(Object.keys(w._sm.tags).length === 1 && Object.values(w._sm.tags)[0].length === 1, 'bam Gop tren goi y tao nhom 2 ten: ' + JSON.stringify(w._sm.tags));
  // 8) Lưu: ghi vào SALE_PERSON_TAGS + gọi _ptSave + tải lại
  t = boot(); ({ w, d } = t); await w.openSaleMatchModal(); await sleep(10); tab(w, d, 'free'); tick(w, q(d, 'input[data-smsel="hoa88"]'), true); tick(w, q(d, 'input[data-smsel="Hoa"]'), true); click(w, q(d, '#sm-merge')); q(d, '#sm-d-main').value = 'hoa88'; click(w, q(d, '#sm-d-ok'));
  t.setServerTags({ 'Nguyễn Thúy': ['ninhnga99'], hoa88: ['Hoa'] }); click(w, q(d, '#sm-save')); await sleep(30);
  eq(t.saved[0], { 'Nguyễn Thúy': ['ninhnga99'], hoa88: ['Hoa'] }, 'luu dung du lieu qua _ptSave'); ok(!w._sm.dirty && t.reqs.length === 2, 'sau luu tai lai danh sach');
  // 9) Đóng khi chưa lưu: hỏi xác nhận
  tab(w, d, 'free'); tick(w, q(d, 'input[data-smsel="Lan 01"]'), true); click(w, q(d, '#sm-merge')); click(w, q(d, '#sm-d-ok')); let asked = 0; w.confirm = () => { asked++; return false; }; click(w, q(d, '#sm-close'));
  ok(asked === 1 && q(d, '#sm-overlay.open'), 'dong khi chua luu: hoi va giu nguyen khi huy');
  console.log('ALL SALE MATCH UI TESTS PASSED');
})().catch((e) => { console.error('FAIL (exception):', e); process.exit(1); });

#!/usr/bin/env node
// Test (jsdom) CRM — form soan mau tin co dropdown NHOM SAN PHAM (de trong = tu phan loai), chip nhom, bo loc nhom. Nap THAT js/20-loadaiexamples.js + khoi HTML trong index.html.
// CAN jsdom (thieu thi bo qua). Chay: node tools/test-msgtpl-crm-group.js -> "ALL CRM MSGTPL GROUP TESTS PASSED"
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: thieu jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'js', '20-loadaiexamples.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const a = html.indexOf('<div id="mt-suggest"'), b = html.indexOf('<div id="mt-list"'), bEnd = html.indexOf('</div>', b) + 6;
const frag = html.slice(a, bEnd);
const foldVi = fs.readFileSync(path.join(root, 'js', '01-fn-splitmulti.js'), 'utf8');
const fi = foldVi.indexOf('function _foldVi('); let d0 = 0, fe = foldVi.indexOf('{', fi); for (let k = fe; k < foldVi.length; k++) { if (foldVi[k] === '{') d0++; else if (foldVi[k] === '}' && --d0 === 0) { fe = k + 1; break; } }
const foldSrc = foldVi.slice(fi, fe);
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TPLS = [
  { id: 'a', title: 'Bao gia nhan', content: 'Nhẫn vàng 10K giá 2tr', product: 'Nhẫn vàng', topic: 'Hỏi giá', tags: '', status: 'approved', createdBy: 'Admin', nhom: 'Nhẫn', nhomAuto: true },
  { id: 'b', title: 'Bao hanh lac', content: 'Lắc tay bảo hành 12 tháng', product: '', topic: '', tags: '', status: 'approved', createdBy: 'Admin', nhom: 'Lắc tay', nhomAuto: false },
  { id: 'c', title: 'Chao khach', content: 'Dạ em chào anh/chị', product: '', topic: '', tags: '', status: 'approved', createdBy: 'Admin', nhom: '', nhomAuto: false }];
let CAN_APPROVE = true;   // admin = true; kich ban CS thuong dat false
(async () => {
  const dom = new JSDOM('<!doctype html><body><div id="tc">' + frag + '</div></body>', { runScripts: 'dangerously', url: 'https://crm.test/' });
  const w = dom.window, posts = [];
  w.esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.switchTab = () => {}; w.toast = () => {}; w.gsUrl = 'https://gas.test/exec'; w.currentUser = { name: 'Admin', username: 'admin' }; w.alert = m => posts.push({ alert: m });
  w.fetch = async (url, o) => { if (o && o.method === 'POST') { const body = JSON.parse(o.body); posts.push(body); return { json: async () => ({ ok: true, status: 'approved' }) }; }
    return { json: async () => ({ templates: TPLS, groups: ['Nhẫn', 'Lắc tay', 'Vòng'], canApprove: CAN_APPROVE, pendingCount: 0 }) }; };
  w.eval(foldSrc + '\n' + js);
  const $ = id => w.document.getElementById(id);
  await w.loadMsgTemplates(); await sleep(10);

  const opts = [...$('mt-f-group').options].map(o => o.value);
  ok(opts[0] === '' && /tự phân loại/.test($('mt-f-group').options[0].textContent) && opts.slice(1).join() === 'Nhẫn,Lắc tay,Vòng', 'form co dropdown nhom: "tu phan loai" + cac nhom DANH_MUC: ' + opts.join('|'));
  const fopts = [...$('mt-group-filter').options].map(o => o.value);
  ok(fopts.join() === ',Nhẫn,Lắc tay,Vòng,__none__', 'bo loc nhom: Tat ca + cac nhom + Chung: ' + fopts.join('|'));
  const list = $('mt-list').textContent;
  ok(/🗂 Nhẫn · tự phân loại/.test(list) && /🗂 Lắc tay/.test(list) && !/🗂 Lắc tay · tự phân loại/.test(list), 'chip nhom: tu phan loai co ghi chu, chon tay thi khong');
  // loc nhom
  $('mt-group-filter').value = 'Lắc tay'; w.renderMsgTemplateList();
  ok($('mt-list').textContent.indexOf('Bao hanh lac') >= 0 && $('mt-list').textContent.indexOf('Bao gia nhan') < 0, 'loc nhom "Lắc tay" chi con mau cua nhom do');
  $('mt-group-filter').value = '__none__'; w.renderMsgTemplateList();
  ok($('mt-list').textContent.indexOf('Chao khach') >= 0 && $('mt-list').textContent.indexOf('Bao hanh lac') < 0, 'loc "Chung" chi con mau chua phan nhom');
  $('mt-group-filter').value = ''; w.renderMsgTemplateList();
  ok($('mt-list').querySelectorAll('.zi-chip').length > 0 && ['Bao gia nhan', 'Bao hanh lac', 'Chao khach'].every(x => $('mt-list').textContent.indexOf(x) >= 0), 'bo loc ve "Tat ca nhom" -> thay het');
  // sua mau chon tay -> dien san nhom; mau tu phan loai -> de "tu phan loai"
  w.openMsgTemplateForm('b'); ok($('mt-f-group').value === 'Lắc tay', 'sua mau co nhom chon tay -> dropdown dien san "Lắc tay"');
  w.openMsgTemplateForm('a'); ok($('mt-f-group').value === '', 'sua mau chi duoc tu phan loai -> dropdown de "tu phan loai" (khong ghim nham nhom tu dong)');
  // luu: de trong -> gui group:'' ; chon tay -> gui nhom
  $('mt-f-title').value = 'Mau moi'; $('mt-f-content').value = 'Noi dung'; posts.length = 0;
  await w.saveMsgTemplateUI(); await sleep(5);
  const p1 = posts.find(x => x.action === 'saveMessageTemplate'); ok(p1 && p1.template.nhom === '' && p1.template.id === 'a', 'luu voi dropdown "tu phan loai" -> payload nhom="" (server tu phan loai): ' + JSON.stringify(p1 && p1.template.nhom));
  w.openMsgTemplateForm(); $('mt-f-title').value = 'Mau vong'; $('mt-f-content').value = 'c'; $('mt-f-group').value = 'Vòng'; posts.length = 0;
  await w.saveMsgTemplateUI(); await sleep(5);
  const p2 = posts.find(x => x.action === 'saveMessageTemplate'); ok(p2 && p2.template.nhom === 'Vòng' && !p2.template.id, 'chon nhom "Vòng" -> payload nhom="Vòng"');
  // XSS: ten nhom chua HTML
  TPLS.push({ id: 'x', title: 't', content: 'c', product: '', topic: '', tags: '', status: 'approved', createdBy: 'A', nhom: '<img src=x onerror=1>', nhomAuto: false });
  await w.loadMsgTemplates(); await sleep(10);
  ok(!$('mt-list').querySelector('img') && !$('mt-f-group').querySelector('img') && !$('mt-group-filter').querySelector('img'), 'ten nhom chua HTML bi escape o chip/dropdown/bo loc');
  ok([...$('mt-f-group').options].some(o => o.value === '<img src=x onerror=1>'), 'nhom da chon tay ma danh muc khong con van co mat trong dropdown');

  // ===== BUOC 4 (mau luu san) — CS THUONG (khong phai admin): thay mau CHO DUYET cua nguoi khac, copy duoc, khong duyet/sua/xoa duoc =====
  CAN_APPROVE = false; w.currentUser = { name: 'Mai', username: 'mai' };
  const copied = []; Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: t => { copied.push(t); return Promise.resolve(); } } });
  TPLS.length = 0;
  TPLS.push({ id: 'p1', title: 'Mau cua Lan', content: 'Dong 1\nDong 2\nDong 3', product: '', topic: '', tags: '', status: 'pending', createdBy: 'Lan', nhom: 'Nhẫn', nhomAuto: false },
            { id: 'p2', title: 'Mau cua Mai', content: 'Noi dung Mai', product: '', topic: '', tags: '', status: 'pending', createdBy: 'Mai', nhom: '', nhomAuto: false },
            { id: 'p3', title: 'Da duyet cua Admin', content: 'Chao anh chi', product: '', topic: '', tags: '', status: 'approved', createdBy: 'Admin', approvedBy: 'Admin', nhom: '', nhomAuto: false });
  await w.loadMsgTemplates(); await sleep(10);
  const card = id => [...$('mt-list').children].find(c => c.innerHTML.indexOf("'" + id + "'") >= 0 || c.textContent.indexOf({ p1: 'Mau cua Lan', p2: 'Mau cua Mai', p3: 'Da duyet cua Admin' }[id]) >= 0);
  const c1 = card('p1');
  ok(c1 && /⏳ Chờ duyệt/.test(c1.textContent) && /Người tạo: Lan/.test(c1.textContent), 'CS thuong thay mau CHO DUYET cua nguoi khac, co huy hieu "Cho duyet" + "Nguoi tao: Lan"');
  ok(/Copy cả câu/.test(c1.textContent) && /Từng đoạn \(3\)/.test(c1.textContent), 'mau nguoi khac co "Copy ca cau" + "Tung doan (3)"');
  ok(!/✅ Duyệt|❌ Từ chối/.test(c1.textContent) && !c1.querySelector('[onclick*="openMsgTemplateForm"],[onclick*="deleteMsgTemplateUI"]'), 'CS thuong KHONG duyet / sua / xoa duoc mau cua nguoi khac');
  const c2 = card('p2'); ok(c2 && c2.querySelector('[onclick*="openMsgTemplateForm"]') && c2.querySelector('[onclick*="deleteMsgTemplateUI"]'), 'mau cua CHINH minh (cho duyet) van sua / xoa duoc');
  c1.querySelector('[onclick*="copyMsgTemplate"]').click(); await sleep(5);
  ok(copied[0] === 'Dong 1\nDong 2\nDong 3', 'Copy ca cau lay dung toan bo noi dung (nhieu dong)');
  c1.querySelector('[onclick*="mtToggleLines"]').click();
  const lineBtns = [...c1.querySelectorAll('.mt-lines button')]; ok(lineBtns.length === 3 && c1.querySelector('.mt-lines').style.display !== 'none', 'Tung doan: mo ra 3 nut Copy doan');
  lineBtns[1].click(); await sleep(5); ok(copied[1] === 'Dong 2', 'Copy doan chi lay dung 1 dong ("Dong 2")');
  console.log('\nALL CRM MSGTPL GROUP TESTS PASSED');
})().catch(e => { console.error('ERR', e); process.exit(1); });

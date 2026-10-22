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
(async () => {
  const dom = new JSDOM('<!doctype html><body><div id="tc">' + frag + '</div></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window, posts = [];
  w.esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.switchTab = () => {}; w.toast = () => {}; w.gsUrl = 'https://gas.test/exec'; w.currentUser = { name: 'Admin', username: 'admin' }; w.alert = m => posts.push({ alert: m });
  w.fetch = async (url, o) => { if (o && o.method === 'POST') { const body = JSON.parse(o.body); posts.push(body); return { json: async () => ({ ok: true, status: 'approved' }) }; }
    return { json: async () => ({ templates: TPLS, groups: ['Nhẫn', 'Lắc tay', 'Vòng'], canApprove: true, pendingCount: 0 }) }; };
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
  console.log('\nALL CRM MSGTPL GROUP TESTS PASSED');
})().catch(e => { console.error('ERR', e); process.exit(1); });

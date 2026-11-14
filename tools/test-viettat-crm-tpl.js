#!/usr/bin/env node
// Test (2026-11-14): CRM tab Viet tat — muc lay tu MAU TIN cua admin (fromTpl) chi XEM: co nhan "Tu Mau tin", an nut Sua/Xoa, khong goi server khi co mo form/xoa.
// Nap NGUYEN js/57-viettat.js trong jsdom. Chay: NODE_PATH=<noi co jsdom> node tools/test-viettat-crm-tpl.js
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can `npm i jsdom` (NODE_PATH)'); process.exit(0); }
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js', '57-viettat.js'), 'utf8'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const m = html.match(/<div id="vt-section"[\s\S]*?<div id="vt-list"[^>]*><\/div>\s*<\/div>/); ok(!!m, 'index.html co khoi #vt-section');
const SN = [
  { id: 'vt_1', abbr: 'ch', keyword: 'chao', options: ['Chào {tên} ạ'], scope: 'team', nhom: 'Chào hỏi' },
  { id: 'tpl_mt_1', abbr: 'chaokhachmoi', keyword: 'Chào khách mới,ckm', options: ['Dạ em chào chị <b>ạ</b>'], scope: 'team', nhom: 'Mẫu tin/Trang sức', fromTpl: true, tplId: 'mt_1', images: [] }
];
(async () => {
  for (const admin of [true, false]) {
    const dom = new JSDOM('<!doctype html><body>' + m[0] + '</body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
    const w = dom.window, calls = [], alerts = [];
    w.gsUrl = 'https://gas.test/exec'; w.toast = () => {}; w.alert = (t) => alerts.push(t); w.confirm = () => true;
    w.fetch = async (u, init) => { calls.push({ u, body: init && init.body }); return { json: async () => ({ ok: true, snippets: SN, canTeam: admin, me: 'Hoa' }) }; };
    w.switchTab = () => {};
    w.eval('var currentPhone="";var allCustomers=[];'); w.eval(code); await sleep(10);
    w.switchTab('zaloai'); await sleep(20);
    const list = w.document.getElementById('vt-list'), tag = admin ? 'admin' : 'nhan vien';
    ok(list.querySelectorAll('code').length === 2, '[' + tag + '] hien ca muc thuong va muc tu mau tin');
    ok(/Từ Mẫu tin/.test(list.textContent) && /Mẫu tin/.test(list.textContent), '[' + tag + '] muc tu mau co nhan "Từ Mẫu tin" va thu muc "Mẫu tin"');
    ok(!/<b>ạ<\/b>/.test(list.innerHTML) && /&lt;b&gt;ạ&lt;\/b&gt;/.test(list.innerHTML), '[' + tag + '] noi dung mau van duoc ESCAPE HTML');
    const edits = list.querySelectorAll('button[title="Sửa"]');
    ok(admin ? edits.length === 1 && edits[0].dataset.vtId === 'vt_1' : edits.length === 0, '[' + tag + '] nut Sua chi o muc thuong (khong o muc tu mau)');
    ok(admin ? list.querySelectorAll('button[title="Xoá"]').length === 1 : true, '[' + tag + '] nut Xoa chi o muc thuong');
    // Goi thang ham (vd DOM cu / console) cung khong sua/xoa duoc, khong gui server
    calls.length = 0; alerts.length = 0;
    w.vtOpenForm('tpl_mt_1'); await w.vtDelete('tpl_mt_1'); await sleep(10);
    ok(alerts.length === 2 && alerts.every((a) => /Quản lý mẫu/.test(a)), '[' + tag + '] mo form / xoa muc tu mau: bao "sua o Quan ly mau"');
    ok(!calls.some((c) => c.body && /VietTat/.test(c.body)), '[' + tag + '] KHONG goi saveVietTat/deleteVietTat cho muc tu mau');
    ok(w.document.getElementById('vt-form-wrap').style.display !== 'block', '[' + tag + '] form sua khong mo');
  }
  console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

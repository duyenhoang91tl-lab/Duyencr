#!/usr/bin/env node
// Test cong cu gom ten cu -> ho so chuan (js/98, ham thuan) + giao dien luu (buoc 5b/5). Chay: NODE_PATH=<jsdom> node tools/test-staff-names-migrate.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const saves = [];
const fakeFetch = (url, o) => { let out = { ok: false };
  if (/action=staffNamesList/.test(url)) out = { ok: true, list: [ { username: 'ninhnga99', role: 'cs', fullName: '', names: {}, all: [] }, { username: 'daxong', role: 'cs', fullName: 'Đã Xong', names: { base: ['x'] }, all: ['x'] } ] };
  else if (o && o.body && /profileSave/.test(o.body)) { const b = JSON.parse(o.body); saves.push(b); out = b.username === 'loi01' ? { ok: false, error: 'Tên đang thuộc người khác: "z"' } : { ok: true, profile: {} }; }
  return Promise.resolve({ json: () => Promise.resolve(out), ok: true }); };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.fetch = fakeFetch; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    // 1) ham thuan
    const accounts = [
      { username: 'thuydinh95', name: 'thuydinh95', names: ['thuydinh95'], role: 'cs' },
      { username: 'dungntk1987', name: 'dungNTK1987', names: ['dungNTK1987', 'S5 dungNTK1987'], role: 'cs' },
      { username: 'ninhnga99', name: 'ninhnga99', names: [], role: 'cs' },
      { username: 'daxong', name: 'daxong', names: ['daxong', 'x'], role: 'cs' },
      { username: 'lead1', name: 'Lan', names: ['a', 'b'], role: 'leader' },
      { username: 'cu01', name: 'cu01', names: [], role: 'cs', active: false } ];
    const tags = { Thuydinh1995: ['thuydinh95'], dungNTK1987: ['Nguyễn Viên Sa'], khongTK: ['q'] };
    const dir = [{ username: 'daxong', all: ['x'] }];
    const P = w._snmBuildProposals(accounts, tags, dir);
    const by = {}; P.forEach(p => by[p.username] = p);
    ok(by.thuydinh95 && by.thuydinh95.items.map(i => i.name).join() === 'thuydinh95,Thuydinh1995', 'thuydinh95 + nhom the Thuydinh1995: ' + JSON.stringify(by.thuydinh95));
    ok(by.thuydinh95.adoptTags.join() === 'Thuydinh1995' && by.thuydinh95.items[1].sys === 'base' && by.thuydinh95.items[0].sys === 'crm', 'adopt nhom the cu; ten TK = CRM, ten tu the = Base');
    ok(by.dungntk1987.items.length === 3 && by.dungntk1987.adoptTags.length === 0 && by.dungntk1987.items[2].name === 'Nguyễn Viên Sa', 'dungNTK1987: key the trung ten TK (khong phan biet hoa/thuong) -> khong can adopt, van lay Nguyen Vien Sa: ' + JSON.stringify(by.dungntk1987));
    ok(!by.ninhnga99, 'chi co 1 ten -> khong de xuat'); ok(!by.daxong, 'da co ten he thong -> bo qua'); ok(!by.lead1 && !by.cu01, 'leader / tai khoan ngung khong de xuat');
    ok(!P.some(p => p.adoptTags.indexOf('khongTK') > -1), 'nhom the khong gan tai khoan nao -> khong dong toi');
    const dup = w._snmBuildProposals([{ username: 'a1', name: 'a1', names: ['chung'], role: 'cs' }, { username: 'a2', name: 'a2', names: ['chung'], role: 'cs' }], {}, []);
    ok(dup.length === 2 && dup[0].dupes.length === 1, 'ten trung giua 2 tai khoan -> canh bao');
    ok(JSON.stringify(w._snmNamesOf([{ name: 'A', sys: 'crm' }, { name: 'B', sys: 'base' }, { name: 'C', sys: 'pos' }])) === JSON.stringify({ pancake: [], crm: ['A'], base: ['B'], pos: ['C'] }), 'items -> 4 he thong');
    // 2) giao dien: chi admin; luu merge+adopt; loi hien tung dong
    w.eval(`gsUrl='https://script.google.com/macros/s/T/exec'; _authAccount={username:'a',role:'admin'}; currentUser={role:'cs',name:'x',names:[]};`);
    w.openStaffNamesMigrate(); ok(!D.getElementById('snm-overlay') || !D.getElementById('snm-overlay').classList.contains('open'), 'khong phai admin -> khong mo');
    w.eval(`currentUser={role:'admin',name:'Admin',names:[]}; accounts=${JSON.stringify([accounts[0], { username: 'loi01', name: 'loi01', names: ['z'], role: 'cs' }])}; SALE_PERSON_TAGS=${JSON.stringify(tags)};`);
    w.openStaffNamesMigrate(); await wait(400);
    ok(D.querySelectorAll('.snm-row').length === 2, 'hien 2 dong de xuat');
    D.querySelector('.snm-fn[data-p="0"]').value = 'Thùy Dinh'; D.querySelector('.snm-fn[data-p="0"]').dispatchEvent(new w.Event('change', { bubbles: true }));
    const sel = D.querySelector('.snm-sys[data-p="0"][data-i="1"]'); sel.value = 'pos'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    D.getElementById('snm-save').click(); await wait(300);
    ok(saves.length === 2, 'luu 2 ho so da tick');
    const s0 = saves.filter(s => s.username === 'thuydinh95')[0];
    ok(s0.merge === true && s0.profile.fullName === 'Thùy Dinh' && s0.names.pos.join() === 'Thuydinh1995' && s0.names.crm.join() === 'thuydinh95' && s0.adoptTags.join() === 'Thuydinh1995', 'payload: merge, ho ten, he thong da doi, adoptTags: ' + JSON.stringify(s0));
    ok(saves.filter(s => s.username === 'loi01')[0].profile.fullName === undefined, 'ho ten de trong -> khong gui (giu ho ten cu)');
    ok(/Đã lưu hồ sơ/.test(D.querySelector('.snm-row.done').textContent) && /thuộc người khác/.test(D.getElementById('snm-body').textContent), 'dong thanh cong + dong loi hien rieng');
    console.log('ALL STAFF NAMES MIGRATE TESTS PASSED'); w.close();
  }, 3500);
});

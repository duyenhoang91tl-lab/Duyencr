#!/usr/bin/env node
// Test Cai dat Team theo HO SO CHUAN (js/97-staff-directory.js + chip/o chon trong js/08, js/09) bang jsdom. Thieu jsdom thi tu bo qua.
// Yeu cau Duyen 26/11/2026: ho so Ninh Thi Nga (Pancake/CRM/Base/POS) -> vao cai Team thi ra "Ninh Thi Nga".
// Chay: NODE_PATH=<noi co jsdom> node tools/test-staff-directory-team.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom (npm i --no-save jsdom@24)'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const LIST = [
  { username: 'ninhnga99', accountName: 'ninhnga99', role: 'cs', team: 'VP', fullName: 'Ninh Thị Ngà', display: 'Ninh Thị Ngà', names: { pancake: ['Ngà Ninh'], crm: ['ninhnga99'], base: ['Ninh Nga'], pos: ['ninhnga99 pos'] }, all: ['Ngà Ninh', 'ninhnga99', 'Ninh Nga', 'ninhnga99 pos'] },
  { username: 'moi01', accountName: 'moi01', role: 'cs', team: 'VP', fullName: 'Bạn Mới', display: 'Bạn Mới', names: { pancake: [], crm: [], base: [], pos: [] }, all: [] },
  { username: 'thuydinh95', accountName: 'thuydinh95', role: 'cs', team: 'VP', fullName: '', display: 'thuydinh95', names: { pancake: [], crm: [], base: [], pos: [] }, all: [] }
];
let calls = 0, FORBID = false;
function fakeFetch(url) { calls++; const out = /action=staffNamesList/.test(url) ? (FORBID ? { ok: false, error: 'x', code: 'FORBIDDEN' } : { ok: true, list: LIST }) : { ok: false };
  return Promise.resolve({ json: () => Promise.resolve(out), ok: true }); }
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) { w.fetch = fakeFetch; } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec'; _authAccount = { username:'admin1', role:'admin', name:'Admin' }; currentUser = { name:'Admin', names:[], role:'admin', team:'' };
      accounts = []; teams = [{ id:'t1', name:'Team Văn Phòng', leader:'', members:['ninhnga99','Ninh Nga','thuydinh95','Thuydinh1995'], channels:[], ratePct:{above15:1.5,below15:1} }];
      if (!document.getElementById('team-wrap')) { var d = document.createElement('div'); d.id = 'team-wrap'; document.body.appendChild(d); }`);
    // 1) chua co thu muc -> hien nhu cu (ten CRM + "+ ten phu"), va tu dong tai thu muc
    w.eval('renderTeamTab()'); await wait(300);
    // 2) sau khi thu muc ve -> tu ve lai: chip hien ho ten chuan
    const chips = [...D.querySelectorAll('#team-wrap .member-chip')];
    const txt = chips.map(c => c.textContent);
    ok(calls >= 1, 'goi staffNamesList');
    ok(txt.some(t => t.indexOf('Ninh Thị Ngà') > -1), 'chip hien ho ten chuan: ' + JSON.stringify(txt));
    ok(!txt.some(t => /\+ Ninh Nga/.test(t)), 'khong con "+ ten phu" cho nguoi co ho so');
    const nn = chips.filter(c => c.textContent.indexOf('Ninh Thị Ngà') > -1)[0];
    ok(/Pancake: Ngà Ninh/.test(nn.title) && /Base: Ninh Nga/.test(nn.title) && /POS: ninhnga99 pos/.test(nn.title) && /CRM: ninhnga99/.test(nn.title), 'tooltip hien ten tung he thong: ' + nn.title);
    ok(chips.length === 3 && txt.filter(t => t.indexOf('Ninh Thị Ngà') > -1).length === 1, 'ninhnga99 + Ninh Nga (cung ho so) gop 1 chip; thuydinh95 / Thuydinh1995 chua noi nen van 2 chip: ' + JSON.stringify(txt));
    // 3) nguoi chua co ho ten chuan -> giu cach hien cu
    ok(txt.some(t => /thuydinh95/.test(t)), 'chua co ho so chuan -> hien ten cu');
    // 4) o chon: tim theo ho ten / ten Base, 1 nguoi 1 dong, ban moi (chua co don) van chon duoc
    const m = (q) => w.eval('_teamComboMatches("t1", ' + JSON.stringify(q) + ').matches');
    ok(m('moi').indexOf('moi01') > -1, 'tai khoan co ho so nhung chua co don/khach van chon duoc vao Team');
    w.eval(`teams[0].members = ['thuydinh95'];`);
    ok(m('ngà ninh').indexOf('ninhnga99') > -1 || m('ngà ninh').indexOf('Ninh Nga') > -1, 'tim theo ten Pancake ra dung nguoi');
    ok(m('nga ninh').length >= 1, 'tim khong dau theo ten Pancake');
    ok(m('ninh thi nga').length === 1, 'tim theo ho ten chuan, 1 nguoi chi 1 dong (khong 2 dong ninhnga99 + Ninh Nga): ' + JSON.stringify(m('ninh thi nga')));
    // 5) khong du quyen (leader/CS bi tu choi) -> khong loi, Team hien nhu cu
    FORBID = true; w.eval('_staffNamesReload()'); await wait(200);
    w.eval('renderTeamTab()'); ok(D.querySelectorAll('#team-wrap .member-chip').length >= 1, 'bi tu choi van ve duoc Team (khong crash)');
    console.log('ALL STAFF DIRECTORY TEAM TESTS PASSED'); w.close();
  }, 3500);
});

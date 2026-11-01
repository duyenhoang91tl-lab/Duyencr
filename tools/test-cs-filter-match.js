#!/usr/bin/env node
// Test LOC CS o danh sach khach hang theo DANH TINH CHUAN: chon ten A ra ca khach ghi duoi ten B cua cung 1 nguoi (tai khoan Sale nhieu ten / The), hai chieu;
// khong lan sang nguoi khac; _csFilterList() van la lua chon tho (giao dien). Can jsdom (thieu thi bo qua). Chay: node tools/test-cs-filter-match.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom'); process.exit(0); }
const path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  beforeParse(w) {
    const st = {}; try { Object.defineProperty(w, 'localStorage', { value: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; }, clear() {} }, configurable: true }); } catch (e) {}
    w.fetch = () => Promise.resolve({ json: () => Promise.resolve({ ok: true }), ok: true, text: () => Promise.resolve('') });
  } }).then(dom => {
  const w = dom.window, D = w.document;
  setTimeout(() => {
    w.eval(`gsUrl = 'https://script.google.com/macros/s/TEST/exec';
      _authAccount = { username:'admin1', role:'admin' }; currentUser = { name:'Admin', names:[], role:'admin', team:'' };
      accounts = [ { username:'saleA', role:'cs', name:'Anh', names:['anhNP1999','Anh'] }, { username:'lead1', role:'leader', name:'Lan', names:['anhNP1999','dungnguyen1995','thuNH1986'] } ];
      SALE_PERSON_TAGS = { thuthuy95: ['thuydinh1995'] };
      var sel = document.getElementById('cs-staff-filter'); sel.innerHTML = '';
      ['anhNP1999','Anh','thuthuy95','Thuydinh1995','dungnguyen1995','thuNH1986'].forEach(function(n){ var o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
      window.__sel = function(names){ Array.from(sel.options).forEach(function(o){ o.selected = names.indexOf(o.value) !== -1; }); };
      var C = function(p, seller, care){ return { phone:p, csSet: seller ? new Set([seller]) : new Set(), careCSSet: care ? new Set([care]) : new Set() }; };
      window.__c = { a1: C('1','Anh',''), a2: C('2','','anhNP1999'), d: C('3','dungnguyen1995',''), t1: C('4','thuthuy95',''), t2: C('5','','Thuydinh1995'), n: C('6','thuNH1986','') };`);
    const inS = k => w.eval('_inCSScope(__c.' + k + ')');
    const list = () => JSON.stringify(w.eval('_csFilterListMatch()').slice().sort());
    // 1) tai khoan Sale nhieu ten
    w.eval("__sel(['anhNP1999'])");
    ok(JSON.stringify(w.eval('_csFilterList()')) === '["anhNP1999"]', '_csFilterList() van la lua chon THO cua giao dien');
    ok(list() === '["Anh","anhNP1999"]', 'chon anhNP1999 -> danh sach so khop gom ca "Anh" (cung 1 nguoi) — ' + list());
    ok(inS('a1') && inS('a2'), 'chon anhNP1999 -> ra khach ghi "Anh" (CS phu trach) va khach CS cham soc anhNP1999');
    ok(!inS('d') && !inS('n') && !inS('t1'), 'khong lan sang nguoi khac (leader liet ke anhNP1999+dungnguyen1995+thuNH1986 KHONG tinh la 1 nguoi)');
    w.eval("__sel(['Anh'])"); ok(inS('a1') && inS('a2') && !inS('d'), 'chon "Anh" -> cung ket qua (hai chieu)');
    // 2) The (khop thu cong trong "Khop sale"), khac hoa/thuong voi du lieu
    w.eval("__sel(['thuthuy95'])");
    ok(inS('t1') && inS('t2') && !inS('a1'), 'chon thuthuy95 -> ra khach cua The Thuydinh1995 (khac hoa/thuong) — ' + list());
    w.eval("__sel(['Thuydinh1995'])"); ok(inS('t1') && inS('t2'), 'chon Thuydinh1995 -> ra khach cua ten chinh thuthuy95 (hai chieu)');
    // 3) Nhieu nguoi + khong chon
    w.eval("__sel(['anhNP1999','dungnguyen1995'])"); ok(inS('a1') && inS('a2') && inS('d') && !inS('t1') && !inS('n'), 'chon 2 nguoi -> ra khach cua ca 2, khong ra nguoi thu 3');
    w.eval("__sel([])"); ok(list() === '[]' && inS('n') && inS('a1'), 'khong chon CS -> khong loc (luon khop)');
    // 4) Doi bo khop -> nho tam duoc cap nhat
    w.eval("__sel(['dungnguyen1995'])"); ok(!inS('n'), 'truoc khi khop: dungnguyen1995 khong ra thuNH1986');
    w.eval("SALE_PERSON_TAGS = { thuthuy95: ['thuydinh1995'], dungnguyen1995: ['thuNH1986'] }");
    ok(inS('n') && inS('d'), 'them khop dungnguyen1995 = thuNH1986 -> nho tam cap nhat, ra ca 2');
    // 5) scopedCustomers (danh sach/thong ke chinh) dung chung bo loc nay
    w.eval("allCustomers = [__c.a1, __c.a2, __c.d, __c.t1]; __sel(['anhNP1999']); _scopedMemo = { list: null, key: '', arr: null, idx: null };");
    const n = w.eval('scopedCustomers().length'); ok(n === 2, 'scopedCustomers loc theo danh tinh khop: ' + n + ' (muon 2)');
    console.log('ALL CS FILTER MATCH TESTS PASSED'); w.close();
  }, 3500);
});

// Test: chia data cho TÊN THẺ (Khớp sale) của 1 tài khoản CS -> khách PHẢI hiện ở Danh sách KH.
// Chạy: node tools/test-assign-person-tags.js
const fs = require('fs'), vm = require('vm');
function fn(f, name){ const s = fs.readFileSync(f, 'utf8'); const i = s.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('thiếu ' + name);
  let j = s.indexOf('{', i), d = 0; for (let k = j; k < s.length; k++){ if (s[k] == '{') d++; else if (s[k] == '}'){ d--; if (!d) return s.slice(i, k + 1); } } }
const SRC = ['_heldBy','_assignFoldName_','_assignCompactKey_','_assignKnownNames_','_assignNamesOfPerson_','_rebuildAssignIndex','_inUserScope'].map(n => fn('js/08-fn-invalidatefiltercache.js', n)).join('\n');
function run(assignName, acct, tags){
  const ctx = { console, document: { getElementById: () => null },
    currentUser: { role: 'cs', name: acct.name, names: acct.names, username: acct.username }, accounts: [acct],
    assignHistory: [{ id: 'b1', date: '2026-11-26', csName: assignName, phones: ['0901'] }],
    _assignIndex: {}, _assignAllIndex: {}, teams: [], SALE_PERSON_TAGS: tags };
  vm.createContext(ctx); vm.runInContext(SRC, ctx); vm.runInContext('_rebuildAssignIndex()', ctx);
  ctx.c = { phone: '0901', careCS: '', csSet: new Set(), careCSSet: new Set() };
  return vm.runInContext('_inUserScope(c)', ctx);
}
const acct = { role: 'cs', name: 'thuydinh1995', names: ['thuydinh1995'], username: 'thuydinh1995' };
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
ok(run('thuydinh95', acct, {}) === false, 'TRƯỚC khi nối thẻ: đợt chia ghi tên thẻ \'thuydinh95\' không khớp tài khoản (tái hiện lỗi)');
ok(run('thuydinh95', acct, { thuydinh1995: ['thuydinh95'] }) === true, 'thẻ nối với tên chính của tài khoản -> khách hiện');
ok(run('thuydinh95', acct, { 'Thuy Dinh': ['thuydinh95', 'thuydinh1995'] }) === true, 'tên chính khác, cả 2 là thẻ của cùng 1 người -> hiện');
ok(run('Thuy Hang', acct, { thuydinh1995: ['thuydinh95'] }) === false, 'tên không nằm trong nhóm thẻ -> KHÔNG hiện');
ok(run('thuydinh95', { role: 'cs', name: 'tuoipham1993', names: ['tuoipham1993'], username: 'tuoipham1993' }, { thuydinh1995: ['thuydinh95'] }) === false, 'tài khoản KHÁC không thấy khách (không lộ data)');
console.log(fail ? ('\n' + fail + ' lỗi') : '\nTẤT CẢ OK'); process.exit(fail ? 1 : 0);

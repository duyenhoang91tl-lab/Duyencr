// Test: CS được chia data thì khách PHẢI hiện trong Danh sách KH (không chỉ ở tab "Data của tôi").
// Chạy: node tools/test-cs-assigned-visible.js
const fs = require('fs'), vm = require('vm');
function fn(f, name){ const s = fs.readFileSync(f, 'utf8'); const i = s.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('thiếu ' + name);
  let j = s.indexOf('{', i), d = 0; for (let k = j; k < s.length; k++){ if (s[k] == '{') d++; else if (s[k] == '}'){ d--; if (!d) return s.slice(i, k + 1); } } }
const SRC = [['js/08-fn-invalidatefiltercache.js','_heldBy'],['js/08-fn-invalidatefiltercache.js','_assignFoldName_'],['js/08-fn-invalidatefiltercache.js','_assignKnownNames_'],
  ['js/08-fn-invalidatefiltercache.js','_rebuildAssignIndex'],['js/08-fn-invalidatefiltercache.js','_inUserScope'],['js/01-fn-splitmulti.js','_csModeMatch'],
  ['js/01-fn-splitmulti.js','_inCSScope'],['js/01-fn-splitmulti.js','_csFilterList'],['js/01-fn-splitmulti.js','_csFilterListMatch'],['js/01-fn-splitmulti.js','_hashStr_']]
  .map(([f, n]) => fn(f, n)).join('\n');
function run(mode, assignName, userNames){
  const opts = userNames.map(v => ({ value: v }));
  const ctx = { console, document: { getElementById: () => ({ selectedOptions: opts, options: opts }) },
    currentUser: { role: 'cs', name: userNames[0], names: userNames }, accounts: [{ role: 'cs', name: userNames[0], names: userNames, username: userNames[0] }],
    assignHistory: [{ id: 'b1', date: '2026-11-26', csName: assignName, phones: ['0901'] }],
    _assignIndex: {}, _assignAllIndex: {}, _csFilterMode: mode, _csMatchMemo: { key: '', list: null }, teams: [], SALE_PERSON_TAGS: null, _personAliases: n => [n] };
  vm.createContext(ctx); vm.runInContext(SRC, ctx); vm.runInContext('_rebuildAssignIndex()', ctx);
  ctx.c = { phone: '0901', careCS: '', csSet: new Set(), careCSSet: new Set() };
  return vm.runInContext('[_inUserScope(c), _inCSScope(c, _csFilterListMatch())]', ctx);
}
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
for (const mode of ['both', 'care']) {
  let r = run(mode, 'ngocnm', ['ngocnm']);               ok(r[0] && r[1], 'đợt chia đúng tên, chế độ ' + mode + ' -> hiện');
  r = run(mode, 'Ngocnm', ['ngocnm']);                    ok(r[0] && r[1], 'đợt chia ghi "Ngocnm", tài khoản "ngocnm", chế độ ' + mode + ' -> hiện');
  r = run(mode, ' NGOCNM ', ['ngocnm']);                  ok(r[0] && r[1], 'đợt chia viết hoa + dư khoảng trắng, chế độ ' + mode + ' -> hiện');
}
let r = run('seller', 'ngocnm', ['ngocnm']);              ok(r[0] === true && r[1] === false, 'chế độ Phụ trách vẫn CHỈ tính người lên đơn (không đổi)');
r = run('both', 'someoneelse', ['ngocnm']);               ok(r[0] === false, 'đợt chia cho NGƯỜI KHÁC -> không hiện (không lộ khách)');
console.log(fail ? ('\n' + fail + ' lỗi') : '\nTẤT CẢ OK'); process.exit(fail ? 1 : 0);

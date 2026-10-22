#!/usr/bin/env node
// Test "Khop sale": (1) mo rong bo loc Sale/Team THEO CHUOI + 2 CHIEU (A~B the, B~C SaleDirectory, D~C PancakeMap) khong phu thuoc thu tu;
// (2) liet ke ten o moi nguon cho admin (phan quyen, gom theo nguoi, 1 nguon loi khong lam hong ca danh sach).  node tools/test-salematch.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + '\n  co :' + JSON.stringify(a) + '\n  can:' + JSON.stringify(b));
const sorted = (a) => a.slice().sort();

function mk(o) {
  const ctx = Object.assign({ Logger: { log() {} }, readPancakeMap_: () => ({}), readSaleDirectory_: () => ({ list: [] }), _userAliasGroups_: () => ({}) }, o || {});
  vm.createContext(ctx);
  ['_normTxt_', '_stripVN_', '_expandSaleFilterWithPancakeAliases_', '_foldSaleKey_', '_salePersonKeyFn_', '_salePersonIdentity_', '_psheetNoAccent_', 'saleMatchCandidates_'].forEach((n) => { try { vm.runInContext(grab(n), ctx); } catch (e) { if (!/khong thay ham/.test(e.message)) throw e; } });
  return ctx;
}
const grp = (arrs) => { const m = {}; arrs.forEach((a) => a.forEach((n) => { m[n.toLowerCase()] = a.slice(); })); return m; };   // dang _userAliasGroups_: key chuan hoa -> cac ten
const norm = (s) => String(s).trim().toLowerCase();

// 1) CHUOI A~B (the) , B~C (SaleDirectory), D~C (PancakeMap 1-1): chon ten NAO cung ra du 4 ten
const dir = [{ maSale: 'S9', code: 'S9', tenFacebook: 'Hà Nguyễn', userBase: 'banhang', tenTagPancake: 'C' }];
const base = { _userAliasGroups_: () => grp([['A', 'banhang']]), readSaleDirectory_: () => ({ list: dir }), readPancakeMap_: () => ({ D: 'C' }) };
['A', 'banhang', 'C', 'D', 'Hà Nguyễn'].forEach((pick) => {
  const r = mk(base).__r = vm.runInContext('_expandSaleFilterWithPancakeAliases_', mk(base))([pick]);
  ok(['A', 'banhang', 'C', 'D', 'Hà Nguyễn'].every((x) => r.map(norm).includes(norm(x))), 'chon "' + pick + '" phai ra du chuoi, co: ' + JSON.stringify(r));
});
// thu tu: ten nguoi dung chon luon dung dau, sau do ten them
let C = mk(base); let r = vm.runInContext('_expandSaleFilterWithPancakeAliases_', C)(['A']); eq(r[0], 'A', 'ten da chon dung dau');
// 2) PancakeMap chia 2 nguoi "saleA|saleB": chon saleA ra ten Pancake, nhung chon ten Pancake KHONG gop saleA va saleB
C = mk({ readPancakeMap_: () => ({ chung: 'saleA|saleB' }) });
r = vm.runInContext('_expandSaleFilterWithPancakeAliases_', C)(['saleA']); eq(sorted(r), ['chung', 'saleA'], 'saleA -> them ten Pancake');
r = vm.runInContext('_expandSaleFilterWithPancakeAliases_', C)(['chung']); eq(r, ['chung'], 'chon ten Pancake chia 2 nguoi KHONG keo ca 2 sale vao');
// 3) Team: thanh vien la ten CRM co dau -> ra the Pos + ten Base (khop khong phan biet hoa thuong/dau)
C = mk({ _userAliasGroups_: () => grp([['Nguyễn Thúy', 'ninhnga99', 'thuynguyen95']]) });
r = vm.runInContext('_expandSaleFilterWithPancakeAliases_', C)(['nguyễn thúy']); ok(r.includes('ninhnga99') && r.includes('thuynguyen95'), 'team member ra du the Pos/Base: ' + r);
// 4) khong co nguon nao / rong
eq(vm.runInContext('_expandSaleFilterWithPancakeAliases_', mk({}))(['X']), ['X'], 'khong co nguon: giu nguyen'); eq(vm.runInContext('_expandSaleFilterWithPancakeAliases_', mk({}))([]), [], 'rong');
// 5) khong lap vo han khi nguon co vong (A~B, B~A)
C = mk({ _userAliasGroups_: () => grp([['A', 'B']]), readPancakeMap_: () => ({ A: 'B', B: 'A' }) }); r = vm.runInContext('_expandSaleFilterWithPancakeAliases_', C)(['A']); eq(sorted(r), ['A', 'B'], 'vong khong lap');

// 6) saleMatchCandidates_: phan quyen + gom nguon + 1 nguon loi khong lam hong
const settings = { salePersonTags: JSON.stringify({ 'Nguyễn Thúy': ['ninhnga99'] }) };
const env = (role, extra) => Object.assign({
  _sessUser_: (t) => (t === 'tokA' ? { role: 'admin', username: 'a' } : t === 'tokM' ? { role: 'manager', username: 'm' } : t === 'tokC' ? { role: 'cs', username: 'c' } : null),
  _userAliasGroups_: () => grp([['Nguyễn Thúy', 'ninhnga99']]), getSetting_: (k) => settings[k] || '', getCrmSS_: () => ({ getSheetByName: () => null }), SH_USER: 'Users',
  readUsers_: () => [{ username: 'thuy01', name: 'Nguyễn Thúy', names: ['Thúy Nguyễn', 'ninhnga99'] }],
  readSaleDirectory_: () => ({ list: [{ maSale: 'S1', tenFacebook: 'Thúy Fb', userBase: 'thuy_base', tenTagPancake: 'ninhnga99' }] }),
  pancakeAllNames_: () => ['ninhnga99', 'hoa88'], readPancakeMap_: () => ({ 'hoa88': 'Hoa' }),
  readDTTong_: () => [{ saleBan: 'thuy_base, Hoa', nguoiTao: 'thuy01' }, { saleBan: 'thuy_base', nguoiTao: '' }],
  readDonChiTiet_: () => [{ theSale: 'ninhnga99' }, { theSale: 'ninhnga99, hoa88' }],
  _donSaleNamesFromThe_: (t) => String(t).split(',').map((x) => x.trim()).filter(Boolean), splitMulti_: (t) => String(t || '').split(',').map((x) => x.trim()).filter(Boolean),
}, extra || {});
C = mk(env());
eq(vm.runInContext('saleMatchCandidates_', C)({ token: 'x' }).code, 'AUTH', 'chua dang nhap -> AUTH');
eq(vm.runInContext('saleMatchCandidates_', C)({ token: 'tokC' }).code, 'FORBIDDEN', 'nhan vien thuong khong dung duoc');
let out = vm.runInContext('saleMatchCandidates_', C)({ token: 'tokA' });
ok(out.ok && vm.runInContext('saleMatchCandidates_', C)({ token: 'tokM' }).ok, 'admin va quan ly duoc dung');
const by = (n) => out.names.find((x) => x.name === n);
eq(by('ninhnga99').srcs, { crm_name: 1, pancake: 2, pos: 2 }, 'ninhnga99: ten CRM 1 + Pancake 2 (the Directory + danh sach Pancake) + Pos 2 don');
eq(by('thuy_base').srcs, { dir_base: 1, base: 2 }, 'user Base: 1 o thu muc + 2 don Base');
eq(by('thuy01').srcs, { crm_user: 1, base_creator: 1 }, 'tai khoan CRM + nguoi tao Base');
eq(by('Thúy Fb').srcs, { facebook: 1 }, 'tai khoan Facebook');
eq(out.names.filter((x) => x.name === 'Hoa' || x.name === 'hoa88').length, 2, 'Hoa va hoa88 la 2 ten rieng (chua khop)');
ok(by('ninhnga99').person === by('Nguyễn Thúy').person, 'goi y theo nguoi: ninhnga99 cung nguoi voi Nguyễn Thúy (da khop o the)');
ok(out.tags['Nguyễn Thúy'][0] === 'ninhnga99', 'tra ve nhom da khop hien tai');
C = mk(env('admin', { readDTTong_: () => { throw new Error('sheet loi'); } })); out = vm.runInContext('saleMatchCandidates_', C)({ token: 'tokA' });
ok(out.ok && out.errors.some((e) => /base/.test(e)) && out.names.length > 3, '1 nguon loi van tra cac nguon con lai + bao loi');
console.log('ALL SALE MATCH TESTS PASSED');

#!/usr/bin/env node
// Test (2026-10-25): Viet Tat (go tat -> chen noi dung) — backend GAS that (readVietTat_/saveVietTat_/deleteVietTat_) voi sheet gia.
// Quy tac: muc CHUNG chi admin tao/sua/xoa; muc RIENG chi chu so huu thay/sua/xoa; khong lo muc rieng nguoi khac; du lieu hong khong lam hong danh sach.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const code = 'var SH_VIETTAT="VietTat",VIETTAT_HEADERS=["id","nhom","abbr","keyword","options","owner","createdBy","updatedAt"];\n' + ['_vtSame_', '_vtRowToObj_', 'readVietTat_', 'saveVietTat_', 'deleteVietTat_'].map(fn).join('\n');
const rows = [];   // khong gom header
const sheet = {
  getLastRow: () => rows.length + 1,
  getRange(r, c, n, w) { return { getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)),
    setValues: v => { v.forEach((x, i) => x.forEach((y, q) => { rows[r - 2 + i][c - 1 + q] = y; })); }, setValue: v => { rows[r - 2][c - 1] = v; } }; },
  getDataRange: () => ({ getValues: () => [['id'], ...rows.map(x => x.slice())] }),
  appendRow: r => rows.push(r), deleteRow: n => rows.splice(n - 2, 1) };
const ctx = { JSON, Object, Array, String, Number, Date, Math, jsonOut_: o => o, getSheet_: () => sheet };
vm.createContext(ctx); vm.runInContext(code, ctx);
const admin = { priv: true, name: 'Duyen' }, hoa = { priv: false, name: 'Hoa' }, binh = { priv: false, name: 'Binh' }, anon = { priv: false, name: '' };
const save = (d, c) => ctx.saveVietTat_(d, c), list = c => ctx.readVietTat_(c);

let r = save({ abbr: 'ch', keyword: 'chao', options: ['Chào {tên} ạ', 'Dạ em chào chị'], scope: 'team', nhom: 'Chào hỏi' }, admin);
ok(r.ok && r.id, 'admin tao muc CHUNG'); const teamId = r.id;
ok(save({ abbr: 'xx', options: ['a'], scope: 'team' }, hoa).code === 'FORBIDDEN', 'nhan vien KHONG tao duoc muc chung');
r = save({ abbr: 'ship', options: ['Freeship đơn từ 500k'], scope: 'me' }, hoa); ok(r.ok, 'nhan vien tao muc RIENG'); const hoaId = r.id;
ok(save({ abbr: 'x', options: ['a'], scope: 'me' }, anon).code === 'FORBIDDEN', 'chua biet ten -> khong luu duoc muc rieng');
ok(save({ abbr: 'co khoang', options: ['a'] }, hoa).error, 'viet tat co khoang trang bi tu choi');
ok(save({ abbr: 'a', options: ['  ', ''] }, hoa).error, 'khong co noi dung bi tu choi');
ok(save({ abbr: 'a'.repeat(31), options: ['a'] }, hoa).error, 'viet tat qua 30 ky tu bi tu choi');

ok(list(hoa).length === 2 && list(hoa).some(x => x.id === hoaId && x.scope === 'me') && list(hoa).some(x => x.id === teamId && x.scope === 'team'), 'Hoa thay: muc chung + muc rieng cua Hoa');
ok(list(binh).length === 1 && list(binh)[0].id === teamId, 'Binh chi thay muc chung (KHONG thay muc rieng cua Hoa)');
ok(list({ priv: false, name: 'HOA ' }).length === 2, 'so khop ten khong phan biet hoa/thuong va khoang trang');
ok(list(anon).length === 1, 'khach/chua biet ten chi thay muc chung');
ok(list(admin).length === 1, 'admin cung KHONG thay muc rieng cua nhan vien');
const t = list(hoa).find(x => x.id === teamId); ok(t.options.length === 2 && t.keyword === 'chao' && t.nhom === 'Chào hỏi' && t.updatedAt > 0, 'doc lai du truong: options/keyword/nhom/updatedAt');

ok(save({ id: teamId, abbr: 'ch', options: ['x'], scope: 'team' }, hoa).code === 'FORBIDDEN', 'nhan vien khong sua duoc muc chung');
ok(save({ id: hoaId, abbr: 'ship', options: ['x'], scope: 'me' }, binh).code === 'FORBIDDEN', 'Binh khong sua duoc muc rieng cua Hoa');
ok(save({ id: hoaId, abbr: 'ship', options: ['Freeship 300k'], scope: 'me' }, hoa).ok && list(hoa).find(x => x.id === hoaId).options[0] === 'Freeship 300k', 'Hoa sua muc rieng cua minh');
ok(save({ id: hoaId, abbr: 'ship', options: ['x'], scope: 'team' }, admin).code === 'FORBIDDEN' || save({ id: hoaId, abbr: 'ship', options: ['x'], scope: 'team' }, admin).error, 'admin khong sua duoc muc rieng cua nguoi khac');
ok(save({ id: teamId, abbr: 'ch', options: ['Chào anh/chị'], scope: 'team' }, admin).ok && list(hoa).find(x => x.id === teamId).options[0] === 'Chào anh/chị', 'admin sua muc chung');
ok(save({ id: 'khong-co', abbr: 'a', options: ['a'], scope: 'me' }, hoa).error, 'sua id khong ton tai -> bao loi, khong tao muc moi');
ok(rows.length === 2, 'khong sinh dong thua sau cac lan sua');

ok(ctx.deleteVietTat_(teamId, hoa).code === 'FORBIDDEN' && rows.length === 2, 'nhan vien khong xoa duoc muc chung');
ok(ctx.deleteVietTat_(hoaId, binh).code === 'FORBIDDEN' && rows.length === 2, 'Binh khong xoa duoc muc rieng cua Hoa');
ok(ctx.deleteVietTat_(hoaId, hoa).ok && rows.length === 1, 'Hoa xoa muc rieng cua minh');
ok(ctx.deleteVietTat_(teamId, admin).ok && rows.length === 0, 'admin xoa muc chung');
ok(ctx.deleteVietTat_('vt_khong_co', admin).ok, 'xoa id khong con: khong loi');
rows.push(['bad1', '', 'zz', '', '{khong phai json', '', '', 0], ['bad2', '', '', '', '["a"]', '', '', 0], ['bad3', '', 'yy', '', '[]', '', '', 0], ['ok1', '', 'oo', '', '["hi"]', '', '', new Date(5)]);
const L = list(hoa); ok(L.length === 1 && L[0].abbr === 'oo' && L[0].updatedAt === 5, 'dong hong (JSON loi / thieu viet tat / khong noi dung) bi bo qua, khong lam hong danh sach');
console.log(bad ? ('\n' + bad + ' LOI') : '\nALL VIETTAT-GAS TESTS PASSED'); process.exit(bad ? 1 : 0);

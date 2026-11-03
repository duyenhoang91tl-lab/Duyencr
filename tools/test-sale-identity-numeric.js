// Test (2026-10-25): _salePersonIdentity_ KHONG gop token so ("8", "13", "#8"...) vao ten/the cua 1 nguoi va KHONG chon so lam ten chinh. Ham THAT trong gas_v13.js.
const fs = require('fs'); let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const line = n => { const i = src.indexOf(n); return src.slice(i, src.indexOf('\n', i)); };
function mk(cfg) {
  const code = [line('function _isNumericTag_('), fn('_salePersonIdentity_')].join('\n') + '\nreturn _salePersonIdentity_;';
  const env = { _normTxt_: s => String(s == null ? '' : s).trim().toLowerCase(), _userAliasGroups_: () => cfg.groups || {}, readSaleDirectory_: () => ({ list: cfg.dir || [] }), readPancakeMap_: () => cfg.pk || {},
    getSetting_: () => '{}', readUsers_: () => cfg.users || [], getCrmSS_: () => ({ getSheetByName: () => ({}) }), SH_USER: 'U', JSON, String, Object };
  return new Function(...Object.keys(env), code)(...Object.values(env));
}
// profile cua huyenmaii1990 co lan token so 8, 13 (STT Pancake)
const I = mk({ groups: { huyen: ['8', 'huyenmaii1990', 'Nguyễn Huyền', '13'] }, dir: [{ maSale: '13', userBase: 'huyenmaii1990' }], pk: { '8': 'huyenmaii1990' }, users: [{ role: 'cs', names: ['8', 'huyenmaii1990'], name: 'Huyền' }] })(['ninhnga99', '8', 'huyenmaii1990']);
ok(I.primary('huyenmaii1990') === 'huyenmaii1990', 'ten chinh cua huyenmaii1990 la huyenmaii1990, KHONG phai "8": ' + I.primary('huyenmaii1990'));
ok(I.primary('Nguyễn Huyền') === 'huyenmaii1990', 'ten hien thi Nguyen Huyen van gop ve huyenmaii1990');
ok(I.key('8') !== I.key('huyenmaii1990') && I.key('13') !== I.key('huyenmaii1990'), 'token so 8 / 13 KHONG cung nguoi voi bat ky sale nao');
ok(I.members('huyenmaii1990').every(n => !/^\d+$/.test(n)), 'danh sach ten cua 1 nguoi khong chua so: ' + I.members('huyenmaii1990').join('|'));
ok(I.primary('8') === '8' && I.key('8') === '8', 'bản thân token "8" vẫn là "8" (không biến thành sale)');
// khong co profile: ten nho nhat theo chu cai van hoat dong cho ten chu
const J = mk({ groups: { x: ['b_sale', 'a_sale'] } })(['b_sale']);
ok(J.primary('b_sale') === 'a_sale', 'quy tac cu (ten nho nhat theo chu cai) cho ten chu van dung');
// user.names[0] la so thi lay ten chu dau tien lam ten chinh
const K = mk({ groups: { y: ['huyenmaii1990', 'zz'] }, users: [{ role: 'cs', names: ['8', 'zz'], name: 'Y' }] })([]);
ok(K.primary('huyenmaii1990') === 'zz', 'user.names[0]="8" bi bo qua, lay ten chu dau tien lam ten chinh');
console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);

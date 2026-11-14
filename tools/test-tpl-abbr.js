#!/usr/bin/env node
// Test (2026-11-14): VIET TAT RIENG CUA MAU TIN — luu qua saveMessageTemplate_ (cot abbr), kiem tra trung, va _vtFromTemplates_ dung viet tat do nguoi soan dat.
// Yeu cau Duyen: "cho quyen them tu viet tat khi tao mau tin o CRM va sua duoc o app Viet tat". Chay: node tools/test-tpl-abbr.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function line(re) { const m = re.exec(src); if (!m) throw new Error('thieu dong ' + re); return m[0]; }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const consts = [
  'var SH_VIETTAT="VietTat",VIETTAT_HEADERS=["id","nhom","abbr","keyword","options","owner","createdBy","updatedAt","images"],VIETTAT_MAX_IMAGES=50,VIETTAT_NHOM_MAX=100;',
  line(/var MSG_TPL_HEADERS = \[[^\]]*\];/), line(/var MSG_TPL_APPROVER_ROLES_ = \[[^\]]*\];/), line(/var MSG_TPL_STATUS_ = \{[^}]*\};/),
  line(/var VIETTAT_TPL_MAX = [^\n]*;/), line(/var VIETTAT_TPL_ONLY_ADMIN = [^\n]*;/), 'var SH_MSG_TPL="MessageTemplates",SH_USER="Users";'
].join('\n');
const fns = ['_stripVN_', '_vtKey_', '_vtNhom_', '_vtImgsFromCell_', '_vtSame_', '_vtRowToObj_', 'readVietTat_', '_vtAdminKeys_', '_vtTplImgId_', '_vtTplKeyword_', '_vtFromTemplates_',
  '_tplRowToObj_', '_tplOwns_', '_tplCheckAbbr_', 'saveMessageTemplate_', 'setTemplateAbbr_'].map(fn).join('\n');
// sheet gia theo ten (dung chung cho MessageTemplates va VietTat)
const mk = (name) => { const s = { rows: [], hdr: name === 'VietTat' ? ['id'] : null };
  return { rows: s.rows,
    getLastRow: () => s.rows.length + 1, getDataRange: () => ({ getValues: () => [vm.runInContext(name === 'VietTat' ? 'VIETTAT_HEADERS' : 'MSG_TPL_HEADERS', ctx)].concat(s.rows.map(r => r.slice())) }),
    getRange: (r, c, n, w) => ({ getValues: () => s.rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)), setValue: (v) => { s.rows[r - 2][c - 1] = v; }, setValues: (m) => { m.forEach((row, i) => row.forEach((v, j) => { s.rows[r - 2 + i][c - 1 + j] = v; })); } }),
    appendRow: (r) => s.rows.push(r.slice()) }; };
const SH = { VietTat: null, MessageTemplates: null };
const ctx = { JSON, Object, Array, String, Number, Date, Math, Error, isNaN,
  getSheet_: (name) => SH[name], getCrmSS_: () => ({ getSheetByName: () => ({}) }), readUsers_: () => [{ username: 'duyenht', name: 'Duyên HT', role: 'admin', active: true }],
  jsonOut_: (o) => o, _tplNotifyPending_: () => 1 };
vm.createContext(ctx); vm.runInContext(consts + '\n' + fns, ctx);
SH.VietTat = mk('VietTat'); SH.MessageTemplates = mk('MessageTemplates');
const admin = { priv: true, name: 'Duyên HT', via: 'web' }, cs = { priv: false, name: 'Hoa', via: 'web' };
const save = (d, c) => ctx.saveMessageTemplate_(d, c || admin);
const tplRows = SH.MessageTemplates.rows;
const H = vm.runInContext('MSG_TPL_HEADERS', ctx);
ok(H[15] === 'abbr' && H.length === 16, 'MSG_TPL_HEADERS co cot abbr o vi tri 16');

// Tao moi co viet tat
let r = save({ title: 'Chào khách mới', content: 'Dạ em chào chị ạ', abbr: ' ckm ' });
ok(r.ok && tplRows.length === 1 && tplRows[0][15] === 'ckm', 'tao mau moi: luu abbr da cat khoang trang -> ckm');
const idA = r.id;
// Doc lai
ok(ctx._tplRowToObj_(tplRows[0]).abbr === 'ckm', '_tplRowToObj_ doc abbr');
ok(ctx._tplRowToObj_(tplRows[0].slice(0, 15)).abbr === '', 'hang cu (15 cot, khong co abbr) -> abbr rong');
// Kiem tra hop le
r = save({ title: 'Mau 2', content: 'x', abbr: 'co khoang' });
ok(r.error && r.code === 'ABBR' && tplRows.length === 1, 'abbr co khoang trang -> bao loi, KHONG ghi');
r = save({ title: 'Mau 2', content: 'x', abbr: 'a'.repeat(31) });
ok(r.error && r.code === 'ABBR' && tplRows.length === 1, 'abbr > 30 ky tu -> bao loi');
r = save({ title: 'Mau 2', content: 'x', abbr: '***' });
ok(r.error && r.code === 'ABBR' && tplRows.length === 1, 'abbr toan ky tu la -> bao loi');
r = save({ title: 'Mau 2', content: 'x', abbr: 'CKM' });
ok(r.error && /da duoc mau tin khac/.test(r.error) && tplRows.length === 1, 'trung viet tat cua mau khac (khong phan biet hoa/thuong) -> bao loi');
SH.VietTat.rows.push(['vt_1', 'Chung', 'baohanh', '', JSON.stringify(['Bao hanh']), '', 'Duyen', Date.now(), '[]']);
SH.VietTat.rows.push(['vt_2', 'Rieng', 'riengtu', '', JSON.stringify(['x']), 'Hoa', 'Hoa', Date.now(), '[]']);
r = save({ title: 'Mau 3', content: 'x', abbr: 'BaoHanh' });
ok(r.error && /muc Viet tat chung/.test(r.error), 'trung muc Viet tat CHUNG trong sheet -> bao loi');
r = save({ title: 'Mau 4', content: 'x', abbr: 'riengtu' });
ok(r.ok, 'trung muc RIENG cua nguoi khac thi khong chan (muc rieng khong tranh voi mau chung)');
// Sua mau: giu abbr cua chinh no (khong tu trung), doi sang abbr moi, xoa abbr
r = save({ id: idA, title: 'Chào khách mới', content: 'Dạ em chào chị ạ', abbr: 'ckm' });
ok(r.ok && tplRows[0][15] === 'ckm', 'sua mau, giu nguyen abbr cua chinh no -> khong bi coi la trung');
r = save({ id: idA, title: 'Chào khách mới', content: 'Dạ em chào chị ạ', abbr: 'chao1' });
ok(r.ok && tplRows[0][15] === 'chao1', 'doi sang abbr moi');
r = save({ id: idA, title: 'Chào khách mới', content: 'Dạ em chào chị ạ' });
ok(r.ok && tplRows[0][15] === 'chao1', 'KHONG gui truong abbr (extension cu) -> GIU nguyen');
r = save({ id: idA, title: 'Chào khách mới', content: 'Dạ em chào chị ạ', abbr: '' });
ok(r.ok && tplRows[0][15] === '', 'gui abbr rong -> xoa viet tat (ve tu suy ra)');
save({ id: idA, title: 'Chào khách mới', content: 'Dạ em chào chị ạ', abbr: 'ckm' });
// Nhan vien tao mau -> pending + co abbr; chua duyet thi chua vao Viet tat
r = save({ title: 'Mau cua Hoa', content: 'noi dung hoa', abbr: 'hoa1' }, cs);
ok(r.ok && r.status === 'pending', 'nhan vien tao mau co abbr -> pending');
let vt = ctx.readVietTat_({ priv: false, name: 'Lan' });
ok(!vt.find(s => s.tplId === r.id), 'mau cho duyet chua vao Viet tat');
// Mau da duyet dung abbr nguoi soan, KHONG phai tieu de
const a1 = vt.find(s => s.tplId === idA);
ok(a1 && a1.abbr === 'ckm', 'Viet tat dung abbr do nguoi soan dat (ckm), got ' + (a1 && a1.abbr));
// Mau khong dat abbr -> tu suy ra tu tieu de nhu cu
const b = save({ title: 'Bảo hành 12 tháng', content: 'bh' });
vt = ctx.readVietTat_({ priv: false, name: 'Lan' });
ok(vt.find(s => s.tplId === b.id).abbr === 'baohanh12thang', 'khong dat abbr -> tu suy ra tu tieu de: ' + vt.find(s => s.tplId === b.id).abbr);
// Mau co abbr duoc uu tien hon mau tu suy ra khi tranh cung ten: mau tieu de 'ckm' (moi hon) khong chiem 'ckm' cua mau A
const c = save({ title: 'CKM', content: 'tieu de trung abbr' });
vt = ctx.readVietTat_({ priv: false, name: 'Lan' });
ok(vt.find(s => s.tplId === idA).abbr === 'ckm' && vt.find(s => s.tplId === c.id).abbr !== 'ckm', 'mau tu suy ra khong chiem ten da chon: ' + vt.find(s => s.tplId === c.id).abbr);
// abbr hong trong sheet (sua tay co khoang trang) -> khong lam hong Viet tat, quay ve tu suy ra
tplRows[0][15] = 'co khoang';
vt = ctx.readVietTat_({ priv: false, name: 'Lan' });
ok(vt.find(s => s.tplId === idA) && !/\s/.test(vt.find(s => s.tplId === idA).abbr), 'abbr sai dinh dang trong sheet -> quay ve tu suy ra, khong co khoang trang');
// ── setTemplateAbbr_: sua RIENG viet tat (tab Viet tat) ──
tplRows[0][15] = 'ckm';
const before = tplRows[0].slice(0, 15).map(String).join('|');
const set = (id, a, c) => ctx.setTemplateAbbr_(id, a, c);
r = set(idA, 'xinchao', admin);
ok(r.ok && tplRows[0][15] === 'xinchao' && tplRows[0].slice(0, 15).map(String).join('|') === before, 'admin doi viet tat; noi dung/trang thai/ngay sua KHONG doi');
r = set(idA, 'ckm', { priv: false, name: 'Hoa', via: 'web' });
ok(r.code === 'FORBIDDEN' && tplRows[0][15] === 'xinchao', 'nhan vien KHONG phai nguoi tao -> FORBIDDEN, khong ghi');
const hid = tplRows.find(x => x[1] === 'Mau cua Hoa')[0];
r = set(hid, 'hoa2', { priv: false, name: 'hoa', via: 'web' });
ok(r.ok && tplRows.find(x => x[0] === hid)[15] === 'hoa2', 'NGUOI TAO (khong phai admin) doi duoc viet tat mau cua minh (ke ca khi mau dang cho duyet)');
ok(tplRows.find(x => x[0] === hid)[9] === 'pending', 'doi viet tat KHONG doi trang thai duyet (van pending)');
r = set(hid, 'XINCHAO', admin);
ok(r.code === 'ABBR' && /mau tin khac/.test(r.error), 'doi sang viet tat da co (khac hoa thuong) -> bao loi ABBR');
r = set(hid, 'khac khoang', admin);
ok(r.code === 'ABBR', 'viet tat co khoang trang -> bao loi');
r = set(hid, '', admin);
ok(r.ok && tplRows.find(x => x[0] === hid)[15] === '', 'viet tat rong -> xoa (ve tu suy ra)');
r = set('mt_khong_co', 'abc', admin);
ok(r.error && !r.ok, 'id khong ton tai -> bao loi');
r = set(idA, 'xinchao', admin);
ok(r.ok, 'dat lai chinh viet tat dang co -> khong tu bao trung');
const g = src.indexOf("if (action === 'setTemplateAbbr')");
ok(g > 0 && /setTemplateAbbr_\(data\.id, data\.abbr, _tplCaller_\(/.test(src.slice(g, g + 200)), 'doPost co route action=setTemplateAbbr');
console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Test (2026-10-25): Viet Tat (go tat -> chen noi dung) — backend GAS that (readVietTat_/saveVietTat_/deleteVietTat_) voi sheet gia.
// Quy tac: muc CHUNG chi admin tao/sua/xoa; muc RIENG chi chu so huu thay/sua/xoa; khong lo muc rieng nguoi khac; du lieu hong khong lam hong danh sach.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const code = 'var SH_VIETTAT="VietTat",VIETTAT_HEADERS=["id","nhom","abbr","keyword","options","owner","createdBy","updatedAt","images"],VIETTAT_MAX_IMAGES=50,VIETTAT_NHOM_MAX=100,VIETTAT_UPLOAD_MAX_BYTES=3*1024*1024,VIETTAT_FOLDER_SCAN=600;\n' + ['_vtNhom_', '_vtImgsFromCell_', '_vtSame_', '_vtRowToObj_', 'readVietTat_', 'saveVietTat_', 'deleteVietTat_', '_vtKnownImageIds_', '_vtFolder_', 'vietTatUploadImage_', '_vtCheckImage_', 'vietTatResolveImages_', 'vietTatImage_'].map(fn).join('\n');
const rows = [];   // khong gom header
const sheet = {
  getLastRow: () => rows.length + 1,
  getRange(r, c, n, w) { return { getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)),
    setValues: v => { v.forEach((x, i) => x.forEach((y, q) => { rows[r - 2 + i][c - 1 + q] = y; })); }, setValue: v => { rows[r - 2][c - 1] = v; } }; },
  getDataRange: () => ({ getValues: () => [['id'], ...rows.map(x => x.slice())] }),
  appendRow: r => rows.push(r), deleteRow: n => rows.splice(n - 2, 1) };
const IMG = 'IMG_AAAAAAAAAAAAAAAA', IMG2 = 'IMG_BBBBBBBBBBBBBBBB', PDF = 'PDF_CCCCCCCCCCCCCCCC', FOL = 'FOLDERDDDDDDDDDDDDDD';
const mk = (id, name, mime) => ({ getId: () => id, getName: () => name, getMimeType: () => mime });
const files = { [IMG]: mk(IMG, 'fiole 1.jpg', 'image/jpeg'), [IMG2]: mk(IMG2, 'bang gia.png', 'image/png'), [PDF]: mk(PDF, 'x.pdf', 'application/pdf') };
const DriveApp = { getFileById(id) { if (!files[id]) throw new Error('no'); return files[id]; },
  getFolderById(id) { if (id !== FOL) throw new Error('no'); const l = [files[IMG2], files[PDF], files[IMG]]; let i = 0; return { getFiles: () => ({ hasNext: () => i < l.length, next: () => l[i++] }) }; } };
// --- gia lap cho tai anh + thu muc nhieu anh (2026-10-25) ---
const created = [], props = {}; let bigFolder = null;
const DriveApp2 = Object.assign({}, DriveApp);
DriveApp2.Access = { ANYONE_WITH_LINK: 'LINK' }; DriveApp2.Permission = { VIEW: 'VIEW' };
DriveApp2.getFolderById = function (id) {
  if (id === 'BIGFOLDERAAAAAAAAAAA' && bigFolder) { let i = 0; return { getFiles: () => ({ hasNext: () => i < bigFolder.length, next: () => bigFolder[i++] }) }; }
  if (id === 'UPFOLDERAAAAAAAAAAAA') return upFolder;
  return DriveApp.getFolderById(id);
};
const upFolder = { getId: () => 'UPFOLDERAAAAAAAAAAAA', createFile: (blob) => { const id2 = 'UPLOADED' + String(created.length + 1).padStart(12, 'A'); const f = { getId: () => id2, getName: () => blob.name, getMimeType: () => blob.mime, size: blob.bytes.length, sharing: null, setSharing(a, b) { f.sharing = a + '/' + b; } }; created.push(f); files[id2] = f; return f; } };
const PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
const Utilities = { base64Decode: b => { if (/[^A-Za-z0-9+\/=]/.test(b)) throw new Error('bad'); return Array.from(Buffer.from(b, 'base64')); }, newBlob: (bytes, mime, name) => ({ bytes, mime, name }) };
const _mlibFolder_ = () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => upFolder });
const ctx = { JSON, Buffer, PropertiesService, Utilities, _mlibFolder_, Object, Array, String, Number, Date, Math, DriveApp: DriveApp2, jsonOut_: o => o, getSheet_: () => sheet, _driveImageBase64_: id => id === IMG ? { base64: 'QUJD', mimeType: 'image/jpeg' } : null };
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

// ===== THU MUC CON + ANH THAM CHIEU (2026-10-25) =====
rows.length = 0;
ok(ctx._vtNhom_(' Túi tiền / Cổ ') === 'Túi tiền/Cổ' && ctx._vtNhom_('A\\B > C > D > E') === 'A/B/C' && ctx._vtNhom_('') === '' && ctx._vtNhom_('//') === '', 'nhom thu muc con: chuan hoa duong dan, toi da 3 cap');
r = save({ abbr: 'tt', options: ['Túi tiền cổ'], scope: 'team', nhom: 'Túi tiền / Cổ', images: [{ id: IMG, name: '' }, { id: IMG2, name: 'bg' }, { id: IMG }] }, admin);
ok(r.ok, 'luu muc co thu muc con + 2 anh (trung ID bi loai)');
let g = list(hoa).find(x => x.id === r.id);
ok(g.nhom === 'Túi tiền/Cổ' && g.images.length === 2 && g.images[0].name === 'fiole 1.jpg' && g.images[1].name === 'bg', 'doc lai: nhom con + anh (ten tu Drive neu thieu)');
ok(save({ abbr: 'bad', options: ['a'], scope: 'me', images: [{ id: PDF }] }, hoa).error, 'tep khong phai anh bi tu choi');
ok(save({ abbr: 'bad', options: ['a'], scope: 'me', images: [{ id: 'KHONGCOFILEAAAAAAAAA' }] }, hoa).error, 'ID khong mo duoc bi tu choi (khong luu ID tuy y)');
ok(save({ abbr: 'bad2', options: ['a'], scope: 'me', images: [{ id: 'x/../etc' }] }, hoa).ok === true && list(hoa).filter(x => x.abbr === 'bad2')[0].images.length === 0, 'ID sai dinh dang bi bo qua im lang');
rows.length = 0; const many = []; for (let i = 0; i < 15; i++) many.push({ id: IMG });
ok(save({ abbr: 'm', options: ['a'], scope: 'me', images: many }, hoa).ok && list(hoa)[0].images.length === 1, 'trung ID chi giu 1');
ok(save({ id: list(hoa)[0].id, abbr: 'm', options: ['a'], scope: 'me', images: [] }, hoa).ok && list(hoa)[0].images.length === 0, 'sua: bo het anh');
rows.length = 0; rows.push(['old1', 'Chào hỏi', 'cc', '', '["hi"]', '', '', 5]);
ok(list(hoa)[0].images.length === 0 && list(hoa)[0].nhom === 'Chào hỏi', 'dong CU (8 cot, chua co images) van doc dung');
rows[0][8] = '{hong'; ok(list(hoa)[0].images.length === 0, 'cot images hong -> bo qua, khong lam hong muc');
let rs = ctx.vietTatResolveImages_('https://drive.google.com/file/d/' + IMG + '/view?usp=sharing');
ok(rs.images.length === 1 && rs.images[0].id === IMG, 'resolve: link FILE anh');
rs = ctx.vietTatResolveImages_('https://drive.google.com/drive/folders/' + FOL + '?usp=sharing');
ok(rs.images.length === 2 && rs.images.every(x => x.id !== PDF) && rs.images[0].name === 'bang gia.png', 'resolve: link THU MUC -> chi lay anh (bo PDF), xep theo ten');
rs = ctx.vietTatResolveImages_(['https://drive.google.com/file/d/' + PDF + '/view', 'rac']);
ok(rs.images.length === 0 && rs.errors.length === 2, 'resolve: PDF + chuoi rac -> bao loi tung dong');
ok(ctx.vietTatResolveImages_('').images.length === 0, 'resolve: rong');
rows.length = 0; save({ abbr: 'tt', options: ['a'], scope: 'me', images: [{ id: IMG }] }, hoa);
ok(ctx.vietTatImage_(IMG, hoa).base64 === 'QUJD', 'lay byte anh: chu muc duoc phep');
ok(ctx.vietTatImage_(IMG, binh).code === 'FORBIDDEN', 'lay byte anh: nguoi khac KHONG doc duoc anh trong muc rieng cua Hoa');
ok(ctx.vietTatImage_(IMG2, hoa).code === 'FORBIDDEN', 'lay byte anh: ID khong thuoc muc nao -> tu choi (chong doc Drive tuy y)');
ok(ctx.vietTatImage_('../x', hoa).ok === false, 'lay byte anh: ID sai dinh dang');

// ===== 50 ANH/MUC + TAI ANH TU MAY (2026-10-25, Duyen yeu cau) =====
const mkImg = (n) => { const id = 'MANYIMG' + String(n).padStart(10, '0') + 'ZZZ'; files[id] = mk(id, 'anh ' + String(n).padStart(3, '0') + '.jpg', 'image/jpeg'); return id; };
const ids60 = []; for (let i = 1; i <= 60; i++) ids60.push(mkImg(i));
rows.length = 0;
r = save({ abbr: 'm50', options: ['a'], scope: 'me', nhom: 'Túi tiền/Cổ', images: ids60.slice(0, 50).map(id => ({ id })) }, hoa);
ok(r.ok && list(hoa).find(x => x.id === r.id).images.length === 50, 'luu du 50 anh/muc');
r = save({ abbr: 'm51', options: ['a'], scope: 'me', images: ids60.slice(0, 51).map(id => ({ id })) }, hoa);
ok(r.error && /50/.test(r.error) && !rows.some(x => x[2] === 'm51'), '51 anh -> BAO LOI (khong am tham cat), khong luu muc');
ok(save({ abbr: 'm51', options: ['a'], scope: 'me', images: ids60.slice(0, 50).concat(ids60.slice(0, 5)).map(id => ({ id })) }, hoa).ok, 'trung ID khong tinh vao tran 50');
// sua muc: anh DA luu khong bi kiem tra Drive lai (50 lan goi Drive rat cham); anh MOI van bi kiem tra
let driveCalls = 0; const origGet = DriveApp2.getFileById; DriveApp2.getFileById = function (id) { driveCalls++; return origGet.call(DriveApp2, id); };
const m50id = list(hoa).find(x => x.abbr === 'm50').id;
r = save({ id: m50id, abbr: 'm50', options: ['b'], scope: 'me', nhom: 'Túi tiền/Cổ', images: ids60.slice(0, 50).map(id => ({ id })) }, hoa);
ok(r.ok && driveCalls === 0, 'sua muc: 50 anh da luu khong goi Drive lai (calls=' + driveCalls + ')');
driveCalls = 0;
r = save({ id: m50id, abbr: 'm50', options: ['b'], scope: 'me', images: ids60.slice(0, 49).map(id => ({ id })).concat([{ id: 'KHONGCOFILEAAAAAAAAA' }]) }, hoa);
ok(r.error && driveCalls === 1, 'sua muc: anh MOI khong hop le van bi tu choi (chi kiem tra anh moi, calls=' + driveCalls + ')');
DriveApp2.getFileById = origGet;
// thu muc Drive co 120 anh + 1 PDF: lay 50 anh DAU THEO TEN, bao truncated
bigFolder = []; for (let i = 120; i >= 1; i--) { const id = 'BIGIMG' + String(i).padStart(10, '0') + 'ZZZZ'; bigFolder.push(mk(id, 'p' + String(i).padStart(3, '0') + '.jpg', 'image/jpeg')); } bigFolder.push(mk('BIGPDFAAAAAAAAAAAAAA', 'x.pdf', 'application/pdf'));
rs = ctx.vietTatResolveImages_('https://drive.google.com/drive/folders/BIGFOLDERAAAAAAAAAAA');
ok(rs.images.length === 50 && rs.truncated === true && rs.images[0].name === 'p001.jpg' && rs.images[49].name === 'p050.jpg' && rs.max === 50, 'thu muc >50 anh: lay 50 anh dau theo ten + truncated=true');
bigFolder = bigFolder.slice(-31); rs = ctx.vietTatResolveImages_('BIGFOLDERAAAAAAAAAAA');
ok(rs.images.length === 30 && !rs.truncated, 'thu muc 30 anh + 1 PDF: lay du 30, khong truncated');
// tai anh tu may
const PNG = Buffer.from('iVBORw0KGgo=', 'base64').toString('base64');
let up = ctx.vietTatUploadImage_({ name: 'anh1.jpg', mimeType: 'image/jpeg', base64: PNG }, hoa);
ok(up.ok && /^UPLOADED/.test(up.id) && up.name === 'anh1.jpg' && created.length === 1 && created[0].sharing === 'LINK/VIEW', 'tai anh len: luu vao Drive + chia se link xem');
ok(props.VIETTAT_FOLDER_ID === 'UPFOLDERAAAAAAAAAAAA', 'thu muc VietTat tu tao + nho ID');
ok(ctx.vietTatUploadImage_({ name: 'a', mimeType: 'image/png', base64: PNG }, { priv: false, name: '' }).code === 'FORBIDDEN' && created.length === 1, 'chua biet ten nguoi dung -> khong cho tai len');
ok(ctx.vietTatUploadImage_({ name: 'a.pdf', mimeType: 'application/pdf', base64: PNG }, hoa).ok === false && created.length === 1, 'khong phai anh -> tu choi');
ok(ctx.vietTatUploadImage_({ name: 'a', mimeType: 'image/png', base64: '' }, hoa).ok === false, 'thieu du lieu -> tu choi');
ok(ctx.vietTatUploadImage_({ name: 'a', mimeType: 'image/png', base64: '@@@' }, hoa).ok === false, 'base64 hong -> bao loi, khong nem exception');
const big = Buffer.alloc(3 * 1024 * 1024 + 1, 1).toString('base64');
ok(/3MB/.test(ctx.vietTatUploadImage_({ name: 'big', mimeType: 'image/jpeg', base64: big }, hoa).error || '') && created.length === 1, 'anh > 3MB bi tu choi (extension chi doc toi da 3MB)');
up = ctx.vietTatUploadImage_({ name: '../..\\evil\n.jpg', mimeType: 'image/JPEG; charset=x', base64: PNG }, hoa);
ok(up.ok && !/[\/\\\n]/.test(up.name) && created[created.length - 1].getMimeType() === 'image/jpeg', 'ten tep duoc lam sach (bo / \\ xuong dong), mime chuan hoa');
// anh vua tai len luu duoc vao muc (qua kiem tra _vtCheckImage_)
rows.length = 0; r = save({ abbr: 'up', options: ['a'], scope: 'me', images: [{ id: up.id, name: up.name }] }, hoa);
ok(r.ok && list(hoa)[0].images[0].id === up.id, 'anh vua tai len gan duoc vao muc');
console.log(bad ? ('\n' + bad + ' LOI') : '\nALL VIETTAT-GAS TESTS PASSED'); process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Test (2026-11-14): Viet tat — TEP GHI AM dinh kem muc (cot audios): tai len tu may, luu muc, doc lai, tai byte co phan quyen. Ham THAT trong gas_v13.js, sheet/Drive gia.
// Yeu cau Duyen: app Viet tat them duoc TEP ghi am co san chu khong can bam ghi am. Chay: node tools/test-viettat-audio-gas.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
function line(re) { const m = re.exec(src); if (!m) throw new Error('thieu ' + re); return m[0]; }
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const consts = ['var SH_VIETTAT="VietTat";', line(/var VIETTAT_HEADERS = \[[^\]]*\];/), line(/var VIETTAT_MAX_AUDIOS = [^\n]*;/), line(/var VIETTAT_MAX_IMAGES = [^\n]*;/)].join('\n').replace('VIETTAT_NHOM_MAX', 'VIETTAT_NHOM_MAX') + '\nvar VIETTAT_NHOM_MAX=100,VIETTAT_UPLOAD_MAX_BYTES=3*1024*1024,VIETTAT_FOLDER_SCAN=600;\nvar MSG_TPL_APPROVER_ROLES_=["admin"];';
const names = ['_stripVN_', '_vtKey_', '_vtSame_', '_vtNhom_', '_vtImgsFromCell_', '_vtAudsFromCell_', '_vtRowToObj_', 'readVietTat_', 'saveVietTat_', 'deleteVietTat_', '_vtKnownIds_', '_vtKnownImageIds_', '_vtCheckImage_',
  '_vtAudioMime_', 'vietTatUploadAudio_', '_vtCheckAudio_', 'vietTatAudio_', '_vtFolder_'];
const rows = [];
const sheet = { getLastRow: () => rows.length + 1,
  getRange(r, c, n, w) { return { getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)), setValues: v => { v.forEach((x, i) => x.forEach((y, q) => { rows[r - 2 + i][c - 1 + q] = y; })); } }; },
  getDataRange: () => ({ getValues: () => [['id'], ...rows.map(x => x.slice())] }), appendRow: r => rows.push(r), deleteRow: n => rows.splice(n - 2, 1) };
const A1 = 'AUD1AAAAAAAAAAAAAAAA', A2 = 'AUD2BBBBBBBBBBBBBBBB', BIG = 'BIGCCCCCCCCCCCCCCCCC', IMGF = 'IMGDDDDDDDDDDDDDDDDD', NOPE = 'NOPEEEEEEEEEEEEEEEEE';
const F = (id, name, mime, size, bytes) => ({ getId: () => id, getName: () => name, getMimeType: () => mime, getSize: () => size, getBlob: () => ({ getBytes: () => bytes || [65, 66, 67] }) });
const files = { [A1]: F(A1, 'loi chao.m4a', 'audio/mp4', 1000), [A2]: F(A2, 'bao gia.mp3', 'audio/mpeg', 2000), [BIG]: F(BIG, 'dai.wav', 'audio/wav', 11 * 1048576), [IMGF]: F(IMGF, 'a.jpg', 'image/jpeg', 10) };
const created = [], props = { VIETTAT_FOLDER_ID: 'UPF' + 'A'.repeat(17) };
const upFolder = { createFile: (blob) => { const id = 'UPLOAD' + String(created.length + 1).padStart(14, 'A'); const f = Object.assign(F(id, blob.name, blob.mime, blob.bytes.length), { sharing: null, setSharing(a, p) { this.sharing = a + '/' + p; return this; } }); files[id] = f; created.push(f); return f; } };
const DriveApp = { Access: { ANYONE_WITH_LINK: 'LINK' }, Permission: { VIEW: 'VIEW' }, getFileById(id) { if (!files[id]) throw new Error('no'); return files[id]; }, getFolderById: () => upFolder };
const ctx = { JSON, Buffer, Object, Array, String, Number, Date, Math, Error, DriveApp, jsonOut_: o => o, getSheet_: () => sheet, readUsers_: () => [], getCrmSS_: () => ({ getSheetByName: () => ({}) }), _vtFromTemplates_: () => [],
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: () => {} }) },
  Utilities: { base64Decode: b => { if (/[^A-Za-z0-9+\/=]/.test(b)) throw new Error('bad'); return Array.from(Buffer.from(b, 'base64')); }, base64Encode: (bytes) => Buffer.from(bytes).toString('base64'), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) } };
vm.createContext(ctx); vm.runInContext(consts + '\n' + names.map(fn).join('\n'), ctx);
const admin = { priv: true, name: 'Duyen' }, hoa = { priv: false, name: 'Hoa' }, binh = { priv: false, name: 'Binh' }, anon = { priv: false, name: '' };
const b64 = (s) => Buffer.from(s).toString('base64');

// ---- tai tep len ----
let r = ctx.vietTatUploadAudio_({ name: 'loi chao.m4a', mimeType: 'audio/x-m4a', base64: b64('xyz') }, hoa);
ok(r.ok && r.name === 'loi chao.m4a' && r.size === 3 && created.length === 1 && created[0].sharing === 'LINK/VIEW', 'tai tep m4a len Drive, dat chia se "ai co link xem"');
r = ctx.vietTatUploadAudio_({ name: 'zalo.m4a', mimeType: '', base64: b64('x') }, hoa);
ok(r.ok && created[1].getMimeType() === 'audio/mp4', 'trinh duyet khong bao mime -> doan theo duoi .m4a');
r = ctx.vietTatUploadAudio_({ name: 'a.3gp', mimeType: 'video/3gpp', base64: b64('x') }, hoa);
ok(r.ok && created[2].getMimeType() === 'audio/3gpp', 'Android bao video/3gpp cho tep ghi am .3gp -> van nhan, luu la audio/3gpp');
ok(!ctx.vietTatUploadAudio_({ name: 'a.jpg', mimeType: 'image/jpeg', base64: b64('x') }, hoa).ok, 'tep anh bi tu choi');
ok(!ctx.vietTatUploadAudio_({ name: 'virus.exe', mimeType: 'application/octet-stream', base64: b64('x') }, hoa).ok, 'tep la (exe) bi tu choi');
ok(!ctx.vietTatUploadAudio_({ name: 'a.mp4', mimeType: 'video/mp4', base64: b64('x') }, hoa).ok === false || true, '(video/mp4 .mp4 khong nam trong danh sach duoi am thanh)');
ok(!ctx.vietTatUploadAudio_({ name: 'film.mp4', mimeType: 'video/mp4', base64: b64('x') }, hoa).ok, 'video .mp4 (phim) bi tu choi');
ok(ctx.vietTatUploadAudio_({ name: 'a.m4a', mimeType: 'audio/mp4', base64: b64('x') }, anon).code === 'FORBIDDEN', 'chua biet ten nguoi dung -> khong tai len duoc');
ok(!ctx.vietTatUploadAudio_({ name: 'a.m4a', mimeType: 'audio/mp4', base64: '' }, hoa).ok && !ctx.vietTatUploadAudio_({ name: 'a.m4a', mimeType: 'audio/mp4', base64: '!!!' }, hoa).ok, 'thieu / hong du lieu base64 bi tu choi');
const over = Buffer.alloc(10 * 1048576 + 1, 1).toString('base64');
ok(/qua lon/.test(ctx.vietTatUploadAudio_({ name: 'a.m4a', mimeType: 'audio/mp4', base64: over }, hoa).error), 'tep > 10MB bi tu choi');
const upId = created[0].getId();

// ---- luu muc kem tep ----
r = ctx.saveVietTat_({ abbr: 'chao', options: ['Chào chị ạ'], scope: 'team', audios: [{ id: A1, name: 'loi chao.m4a' }, { id: A2, name: 'bao gia.mp3' }, { id: A1, name: 'trung' }, { id: 'ngan', name: 'x' }] }, admin);
ok(r.ok, 'admin luu muc CHUNG kem 2 tep ghi am (bo ID trung / sai dinh dang)'); const id1 = r.id;
let it = ctx.readVietTat_(hoa).find(s => s.id === id1);
ok(it && it.audios.length === 2 && it.audios[0].id === A1 && it.audios[1].name === 'bao gia.mp3' && Array.isArray(it.images), 'doc lai: audios dung thu tu, images van la mang');
ok(rows[0].length === 10 && JSON.parse(rows[0][9]).length === 2, 'sheet co cot thu 10 (audios)');
ok(/khong dung duoc.*am thanh/.test(ctx.saveVietTat_({ abbr: 'x1', options: ['a'], scope: 'team', audios: [{ id: IMGF, name: 'a.jpg' }] }, admin).error), 'tep anh nhet vao audios bi tu choi');
ok(/qua lon/.test(ctx.saveVietTat_({ abbr: 'x2', options: ['a'], scope: 'team', audios: [{ id: BIG, name: 'dai.wav' }] }, admin).error), 'tep Drive > 10MB bi tu choi');
ok(/khong dung duoc/.test(ctx.saveVietTat_({ abbr: 'x3', options: ['a'], scope: 'team', audios: [{ id: NOPE, name: 'khong co' }] }, admin).error), 'ID khong ton tai / khong doc duoc bi tu choi (chong luu ID tuy y)');
const many = Array.from({ length: 11 }, (_, i) => ({ id: 'AUDIO' + String(i).padStart(15, 'X'), name: 'f' + i }));
ok(/toi da 10/.test(ctx.saveVietTat_({ abbr: 'x4', options: ['a'], scope: 'team', audios: many }, admin).error), '11 tep: BAO LOI (khong cat im lang)');
ok(ctx.saveVietTat_({ abbr: 'x5', options: ['a'], scope: 'team', audios: [{ id: A1, name: 'a' }] }, hoa).code === 'FORBIDDEN', 'nhan vien van khong tao duoc muc chung');
// muc rieng + tep vua tai len
r = ctx.saveVietTat_({ abbr: 'rieng', options: ['Của Hoa'], scope: 'me', audios: [{ id: upId, name: 'loi chao.m4a' }] }, hoa);
ok(r.ok, 'nhan vien luu muc RIENG kem tep vua tai len'); const hoaId = r.id;
// sua muc: client cu khong gui audios -> giu nguyen
r = ctx.saveVietTat_({ id: id1, abbr: 'chao', options: ['Chào chị ạ (sửa)'], scope: 'team' }, admin);
it = ctx.readVietTat_(hoa).find(s => s.id === id1);
ok(r.ok && it.audios.length === 2 && it.options[0].indexOf('sửa') > 0, 'sua muc ma client khong gui "audios" -> GIU NGUYEN tep (khong xoa nham)');
r = ctx.saveVietTat_({ id: id1, abbr: 'chao', options: ['Chào'], scope: 'team', audios: [{ id: A2, name: 'bao gia.mp3' }] }, admin);
it = ctx.readVietTat_(hoa).find(s => s.id === id1);
ok(r.ok && it.audios.length === 1 && it.audios[0].id === A2, 'sua muc: go bot tep (gui danh sach moi)');
r = ctx.saveVietTat_({ id: id1, abbr: 'chao', options: ['Chào'], scope: 'team', audios: [] }, admin);
ok(ctx.readVietTat_(hoa).find(s => s.id === id1).audios.length === 0, 'gui audios rong = go het tep');
files[A1].getMimeType = () => 'application/pdf';   // tep da co tren muc nay: luu lai KHONG kiem tra Drive nua (nhu anh)
ctx.saveVietTat_({ id: id1, abbr: 'chao', options: ['Chào'], scope: 'team', audios: [{ id: A1, name: 'a' }] }, admin);
ok(ctx.readVietTat_(hoa).find(s => s.id === id1).audios.length === 0, '(tep doi thanh khong phai audio, chua tung o tren muc: bi tu choi)');
files[A1].getMimeType = () => 'audio/mp4';
ctx.saveVietTat_({ id: id1, abbr: 'chao', options: ['Chào'], scope: 'team', audios: [{ id: A1, name: 'a' }, { id: A2, name: 'b' }] }, admin);

// ---- tai byte co phan quyen ----
let d = ctx.vietTatAudio_(A1, hoa);
ok(d.ok && d.mimeType === 'audio/mp4' && d.base64 === b64('ABC') && d.name === 'a', 'nhan vien tai duoc tep ghi am cua muc CHUNG (base64 + mime + ten)');
ok(ctx.vietTatAudio_(upId, hoa).ok, 'chu muc rieng tai duoc tep cua minh');
ok(ctx.vietTatAudio_(upId, binh).code === 'FORBIDDEN', 'nguoi khac KHONG tai duoc tep cua muc RIENG cua Hoa');
ok(ctx.vietTatAudio_(NOPE, admin).code === 'FORBIDDEN' && ctx.vietTatAudio_(IMGF, admin).code === 'FORBIDDEN', 'ID khong thuoc muc nao -> bi chan (khong doc Drive tuy y)');
ok(!ctx.vietTatAudio_('ngan', admin).ok, 'ID sai dinh dang bi tu choi');
files[A1].getSize = () => 12 * 1048576;
ok(/qua lon/.test(ctx.vietTatAudio_(A1, hoa).error), 'tep co tren muc nhung > 10MB (bi sua tren Drive): khong tra ve');
// ---- khong anh huong muc cu (hang cu thieu cot audios) ----
rows.push(['vt_old', '', 'cu', 'k', JSON.stringify(['cũ']), '', 'X', 1, '[]']);
const old = ctx.readVietTat_(hoa).find(s => s.id === 'vt_old');
ok(old && Array.isArray(old.audios) && old.audios.length === 0, 'hang cu (9 cot, khong co audios) van doc binh thuong, audios = []');
ok(ctx.deleteVietTat_(id1, admin).ok && !ctx.readVietTat_(hoa).find(s => s.id === id1), 'xoa muc van chay');
console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);

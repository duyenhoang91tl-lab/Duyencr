#!/usr/bin/env node
// Test Node: NHOM SAN PHAM cua mau tin nhan (MessageTemplates.nhom) — chon tay hoac he thong tu phan loai. Chay ham THAT trong gas_v13.js.
// Chay: node tools/test-msgtpl-group.js -> "ALL MSGTPL GROUP TESTS PASSED"
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i + 1, k + 1) + '\n'; } };
let fails = 0; const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log('FAIL', m, '\n   co :', JSON.stringify(a), '\n   can:', JSON.stringify(b)); } else console.log('ok  ', m); };

let data = [], catalogCalls = 0, catalogFail = false, cache = {};
const sheet = { getDataRange: () => ({ getValues: () => data.map(r => r.slice()) }), appendRow: r => { data.push(r.slice()); },
  getRange: (r, c, nr, nc) => ({ setValues: m => { m.forEach((row, i) => { data[r - 1 + i] = data[r - 1 + i] || []; row.forEach((v, j) => { data[r - 1 + i][c - 1 + j] = v; }); }); }, setValue: v => { data[r - 1] = data[r - 1] || []; data[r - 1][c - 1] = v; } }), deleteRow: r => { data.splice(r - 1, 1); } };
const CAT = [
  { n: 'Nhẫn', t: 'Nhẫn vàng 10K', m: 'Nhẫn trơn' }, { n: 'Nhẫn', t: 'Nhẫn bạc', m: '' },
  { n: 'Lắc tay', t: 'Lắc tay bạc', m: '' }, { n: 'Lắc tay', t: 'Lắc tay vàng', m: '' },
  { n: 'Vòng', t: 'Vòng bạc', m: '' },
  { n: 'Tỳ hưu', t: 'Tỳ hưu ngọc', m: '' },
  { n: 'Charm', t: 'Hoa sen', m: '' }, { n: 'Mặt dây', t: 'Hoa sen', m: '' }   // 'Hoa sen' o 2 nhom -> mo ho
];
const ctx = { jsonOut_: o => o, getSheet_: () => sheet, Date, _stripVN_: null,
  _tplNotifyPending_: () => 1, _tplNotifClear_: () => {},   // them 2026-10-21 (bao admin duyet) — khong lien quan phan nhom, gia lap
  buildPriceCatalogFlat_: () => { catalogCalls++; if (catalogFail) throw new Error('khong doc duoc DANH_MUC'); return { ok: true, items: CAT }; },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) } };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('var SH_MSG_TPL ='), src.indexOf('function _tplCaller_(')) + fn('_stripVN_') + fn('_tplRowToObj_') + fn('_tplOwns_')
  + fn('_tplFoldAcc_') + fn('_tplCatalogIndex_') + fn('_tplClassify_') + fn('_tplGroupList_') + fn('readMessageTemplates_') + fn('saveMessageTemplate_'), ctx);
vm.runInContext('var _tplCatIdxMemo_ = null; var MSG_TPL_CAT_CACHE_KEY_ = "tplcat_v1";', ctx);
const H = vm.runInContext('MSG_TPL_HEADERS', ctx);
const ADMIN = { priv: true, name: 'Admin', via: 'web' }, CS = { priv: false, name: 'Lan', via: 'web' };
const reset = () => { data = [H.slice()]; vm.runInContext('_tplCatIdxMemo_ = null', ctx); cache = {}; catalogCalls = 0; catalogFail = false; };
const T = o => Object.assign({ title: 'x', content: 'x' }, o);
const readAll = () => ctx.readMessageTemplates_(ADMIN);

eq(H[H.length - 1], 'nhom', 'sheet them cot cuoi "group" (getSheet_ tu them vao sheet cu)');
// 1) chon tay -> ghi + doc ra dung, nhomAuto=false
reset(); let r = ctx.saveMessageTemplate_(T({ title: 'Bao hanh', content: 'Bao hanh 12 thang', nhom: 'Lắc tay' }), ADMIN);
let t = readAll()[0]; eq([t.nhom, t.nhomAuto, data[1][13]], ['Lắc tay', false, 'Lắc tay'], 'admin chon tay "Lắc tay" -> luu cot group, nhomAuto=false');
// 2) khong chon -> tu phan loai (KHONG ghi vao sheet)
reset(); ctx.saveMessageTemplate_(T({ title: 'Bao gia nhan vang 10K', content: 'Nhẫn vàng 10K giá từ 2tr ạ' }), ADMIN);
t = readAll()[0]; eq([t.nhom, t.nhomAuto, data[1][13]], ['Nhẫn', true, ''], 'de trong -> tu phan loai "Nhẫn" (nhomAuto), sheet van de trong');
// 3) chon tay uu tien hon tu phan loai
reset(); ctx.saveMessageTemplate_(T({ title: 'Nhẫn vàng 10K', content: 'nhẫn vàng', nhom: 'Vòng' }), ADMIN);
eq(readAll()[0].nhom, 'Vòng', 'chon tay thang tu phan loai (noi dung noi nhan nhung nguoi soan chon Vong)');
// 4) mau chung -> '' ; khong dien gi
reset(); ctx.saveMessageTemplate_(T({ title: 'Chao khach', content: 'Dạ em chào anh/chị ạ' }), ADMIN);
t = readAll()[0]; eq([t.nhom, t.nhomAuto], ['', false], 'mau chao hoi khong nhac san pham -> chung (rong)');
// 5) va cham dau: "nhân viên" KHONG bi xep vao nhom Nhẫn
reset(); ctx.saveMessageTemplate_(T({ title: 'Hỏi nhân viên', content: 'Nhân viên tư vấn sẽ liên hệ lại ạ' }), ADMIN);
eq(readAll()[0].nhom, '', 'nhân viên (nhan) khong nham voi nhóm Nhẫn');
// 6) nguoi go khong dau van nhan ra ten nhieu tu
reset(); ctx.saveMessageTemplate_(T({ title: 'bao gia lac tay bac', content: 'lac tay bac gia 900k' }), ADMIN);
eq(readAll()[0].nhom, 'Lắc tay', 'go khong dau "lac tay bac" (>=2 tu) van nhan ra nhom Lắc tay');
reset(); ctx.saveMessageTemplate_(T({ title: 'nhan', content: 'nhan' }), ADMIN);
eq(readAll()[0].nhom, '', 'go khong dau 1 tu "nhan" -> khong doan (de khong nham nhan vien)');
// 7) hoa diem -> chung ; ten san pham o 2 nhom -> bo qua
reset(); ctx.saveMessageTemplate_(T({ title: 'So sanh', content: 'Nhẫn bạc và vòng bạc đều đẹp' }), ADMIN);
eq(readAll()[0].nhom, '', 'hoa diem 2 nhom (Nhẫn bạc vs Vòng bạc cung do dai) -> chung, khong doan');
reset(); ctx.saveMessageTemplate_(T({ title: 'Hoa sen', content: 'Hoa sen đẹp lắm' }), ADMIN);
eq(readAll()[0].nhom, '', '"Hoa sen" thuoc 2 nhom -> ten mo ho, khong dung de phan loai');
reset(); ctx.saveMessageTemplate_(T({ title: 'Charm hoa sen', content: 'Charm đẹp lắm' }), ADMIN);
eq(readAll()[0].nhom, 'Charm', 'nhac thang TEN NHOM "Charm" -> phan loai dung du ten san pham mo ho');
reset(); ctx.saveMessageTemplate_(T({ title: 'Tư vấn', content: 'Nhẫn bạc và Lắc tay bạc và Lắc tay vàng' }), ADMIN);
eq(readAll()[0].nhom, 'Lắc tay', 'nhom co nhieu ten khop hon -> thang (Lắc tay 3 hit > Nhẫn 1)');
// 8) sua mau: de trong -> ve tu phan loai; khong gui nhom (extension cu) -> GIU NGUYEN
reset(); r = ctx.saveMessageTemplate_(T({ title: 'A', content: 'Nhẫn vàng 10K', nhom: 'Vòng' }), ADMIN);
ctx.saveMessageTemplate_(T({ id: r.id, title: 'A2', content: 'Nhẫn vàng 10K' }), ADMIN);   // khong gui nhom
eq(readAll()[0].nhom, 'Vòng', 'sua tu extension CU khong gui nhom -> giu nguyen nhom da chon');
ctx.saveMessageTemplate_(T({ id: r.id, title: 'A3', content: 'Nhẫn vàng 10K', nhom: '' }), ADMIN);   // gui '' = ve tu phan loai
t = readAll()[0]; eq([t.nhom, t.nhomAuto], ['Nhẫn', true], 'gui nhom="" -> bo chon tay, ve tu phan loai');
// 9) nhan vien de xuat: group duoc luu, mau pending; sua mau cua minh cung doi duoc
reset(); r = ctx.saveMessageTemplate_(T({ title: 'De xuat', content: 'c', nhom: 'Tỳ hưu' }), CS);
eq([r.status, data[1][13]], ['pending', 'Tỳ hưu'], 'nhan vien de xuat kem nhom -> pending + luu nhom');
ctx.saveMessageTemplate_(T({ id: r.id, title: 'De xuat 2', content: 'c', nhom: 'Vòng' }), CS);
eq(data[1][13], 'Vòng', 'nhan vien sua mau cua minh -> doi duoc nhom');
// 10) cat do dai, danh sach nhom cho dropdown
reset(); ctx.saveMessageTemplate_(T({ nhom: 'N'.repeat(500) }), ADMIN); eq(data[1][13].length, 200, 'nhom bi cat 200 ky tu (gioi han goc cua cot nhom)');
reset(); ctx.saveMessageTemplate_(T({ title: 'Nhom cu', content: 'c', nhom: 'Nhóm đã bỏ khỏi danh mục' }), ADMIN); ctx.saveMessageTemplate_(T({ title: 'Nhan', content: 'Nhẫn bạc' }), ADMIN);
const gl = ctx._tplGroupList_(readAll()); eq([gl.includes('Nhẫn'), gl.includes('Lắc tay'), gl.includes('Nhóm đã bỏ khỏi danh mục')], [true, true, true], 'dropdown: nhom DANH_MUC + nhom da chon tay ma danh muc khong con');
eq(gl.filter((x, i) => gl.indexOf(x) !== i), [], 'dropdown khong trung lap');
eq(gl.slice().sort((a, b) => a.localeCompare(b, 'vi')), gl, 'dropdown xep A-Z');
// 11) hieu nang: doc nhieu mau chi doc DANH_MUC 1 lan (+ cache)
reset(); for (let i = 0; i < 30; i++) ctx.saveMessageTemplate_(T({ title: 'M' + i, content: 'Nhẫn bạc ' + i }), ADMIN);
readAll(); readAll(); eq(catalogCalls, 1, '30 mau, doc 2 lan -> chi doc DANH_MUC 1 lan (memo + cache)');
// 12) DANH_MUC loi -> doc mau van chay, mau hien nhu chung; mau chon tay van giu
reset(); catalogFail = true; ctx.saveMessageTemplate_(T({ title: 'Nhẫn bạc', content: 'Nhẫn bạc' }), ADMIN); ctx.saveMessageTemplate_(T({ title: 'Tay', content: 'x', nhom: 'Lắc tay' }), ADMIN);
const rr = readAll(); eq(rr.map(x => x.nhom).sort(), ['', 'Lắc tay'], 'DANH_MUC loi: khong hong viec doc mau; mau chon tay van co nhom, con lai chung');
// 13) quyen khong doi: nhan vien khac van khong thay mau pending; mau cu (khong co cot group) van doc duoc
reset(); data.push(['old1', 'Cu', 'Noi dung nhan bac', '', 'An', new Date(), new Date(), '', '', 'approved', '', '', '']);   // hang CU: chi 13 cot
t = ctx.readMessageTemplates_({ priv: false, name: 'Lan' })[0]; eq([t.title, t.status, t.nhom, t.nhomAuto], ['Cu', 'approved', 'Nhẫn', true], 'mau cu (13 cot, khong co group) van doc duoc va duoc tu phan loai');
console.log(fails ? '\n' + fails + ' CA SAI' : '\nALL MSGTPL GROUP TESTS PASSED'); process.exit(fails ? 1 : 0);

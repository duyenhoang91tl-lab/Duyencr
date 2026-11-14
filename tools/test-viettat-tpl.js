#!/usr/bin/env node
// Test (2026-11-14): MAU TIN cua ADMIN (da duyet) hien thanh muc VIET TAT chung — chay readVietTat_/_vtFromTemplates_ THAT trong gas_v13.js voi sheet gia.
// Yeu cau Duyen: "mau tin nhan duyenht tao dung luon khong can duyet, va dung duoc trong ung dung viet tat". Chay: node tools/test-viettat-tpl.js
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
const fns = ['_stripVN_', '_vtKey_', '_vtNhom_', '_vtImgsFromCell_', '_vtSame_', '_vtRowToObj_', 'readVietTat_', '_vtAdminKeys_', '_vtTplImgId_', '_vtTplKeyword_', '_vtFromTemplates_', '_tplRowToObj_', 'vietTatImage_'].map(fn).join('\n');

const sheets = { VietTat: [], MessageTemplates: [] };
const mkSheet = (rows) => ({ getLastRow: () => rows.length + 1, getRange: (r, c, n, w) => ({ getValues: () => rows.slice(r - 2, r - 2 + n).map(x => x.slice(c - 1, c - 1 + w)) }) });
let users = [], usersThrow = false;
const IMGA = 'TPLIMGAAAAAAAAAAAAAA', IMGB = 'TPLIMGBBBBBBBBBBBBBB';
const ctx = { JSON, Object, Array, String, Number, Date, Math, Error,
  getSheet_: (name) => mkSheet(sheets[name]), getCrmSS_: () => ({ getSheetByName: () => ({}) }),
  readUsers_: () => { if (usersThrow) throw new Error('Users loi'); return users; },
  _driveImageBase64_: (id) => (id === IMGA ? { base64: 'QUJD', mimeType: 'image/jpeg' } : null) };
vm.createContext(ctx); vm.runInContext(consts + '\n' + fns, ctx);

// [id,title,content,tags,createdBy,createdAt,updatedAt,product,topic,status,approvedBy,approvedAt,rejectReason,nhom,images]
const T = (o) => [o.id, o.title, o.content === undefined ? 'Noi dung ' + o.id : o.content, o.tags || '', o.by, new Date(2026, 10, 1), o.upd || new Date(2026, 10, 1), o.product || '', o.topic || '', o.status === undefined ? 'approved' : o.status, '', '', '', o.nhom || '', JSON.stringify(o.images || [])];
users = [
  { username: 'duyenht', name: 'Duyên HT', names: ['Duyên HT'], role: 'admin', active: true },
  { username: 'admin2', name: 'Quản Trị 2', names: [], role: 'admin', active: false },    // admin da khoa
  { username: 'hoa', name: 'Hoa', names: ['Hoa'], role: 'cs', active: true },
  { username: 'lan', name: 'Lan', role: 'manager', active: true }
];
sheets.MessageTemplates = [
  T({ id: 'mt_1', title: 'Chào khách mới', by: 'Duyên HT', product: 'Vòng tay, Nhẫn vàng', topic: 'Khách hỏi giá', tags: 'chào hỏi', nhom: 'Trang sức', upd: new Date(2026, 10, 5),
      images: ['https://drive.google.com/uc?export=view&id=' + IMGA, 'https://drive.google.com/uc?export=view&id=' + IMGB, 'https://khac.example/x.png'] }),
  T({ id: 'mt_2', title: 'Bảo hành', by: 'duyenht', content: 'Dạ bên em bảo hành 12 tháng ạ', upd: new Date(2026, 10, 9) }),
  T({ id: 'mt_3', title: 'Mẫu của Hoa đã duyệt', by: 'Hoa' }),                         // nhan vien, da duyet -> KHONG
  T({ id: 'mt_4', title: 'Admin nhưng chờ duyệt', by: 'Duyên HT', status: 'pending' }),    // chua duyet -> KHONG
  T({ id: 'mt_5', title: 'Admin bị từ chối', by: 'Duyên HT', status: 'rejected' }),         // -> KHONG
  T({ id: 'mt_6', title: 'Mẫu rỗng', by: 'Duyên HT', content: '   ' }),                      // khong co noi dung -> KHONG
  T({ id: 'mt_7', title: 'Của admin đã khoá', by: 'Quản Trị 2' }),                           // admin khong hoat dong -> KHONG
  T({ id: 'mt_8', title: 'Bảo hành', by: 'Duyên HT', content: 'Bản 2 cùng tên' }),          // trung tieu de -> abbr dem them
  T({ id: 'mt_9', title: 'Cũ chưa có status', by: 'Duyên HT', status: '' })                  // hang cu (status trong) coi la da duyet -> CO
];
sheets.VietTat = [['vt_1', 'Chào hỏi', 'chao', 'chao', JSON.stringify(['Chào chị ạ']), '', 'Duyen', Date.now(), '[]'],
                  ['vt_2', 'Riêng', 'baohanh', 'bh', JSON.stringify(['Của Hoa']), 'Hoa', 'Hoa', Date.now(), '[]']];

// ── CHE DO MAC DINH (2026-11-14): MOI mau DA DUYET vao Viet tat, ke ca nhan vien ──
const list = ctx.readVietTat_({ priv: false, name: 'Lan' });
const tpl = list.filter(s => s.fromTpl), bytitle = (t) => tpl.find(s => s.tplId === t);
ok(list.filter(s => !s.fromTpl).length === 1 && list.find(s => s.id === 'vt_1'), 'muc tu sheet VietTat van con nguyen (+ muc rieng cua nguoi khac van bi an)');
ok(tpl.map(s => s.tplId).sort().join(',') === 'mt_1,mt_2,mt_3,mt_7,mt_8,mt_9', 'mac dinh lay MOI mau da duyet (ke ca nhan vien mt_3, admin khoa mt_7), got ' + tpl.map(s => s.tplId).sort().join(','));
ok(!bytitle('mt_4') && !bytitle('mt_5') && !bytitle('mt_6'), 'KHONG lay: cho duyet / tu choi / rong');
ok(bytitle('mt_9'), 'hang cu (status trong) coi la da duyet');
// ── CHE DO CU (cong tac ONLY_ADMIN=true): chi mau admin dang hoat dong ──
ctx.VIETTAT_TPL_ONLY_ADMIN = true;
const tplA = ctx.readVietTat_({ priv: false, name: 'Lan' }).filter(s => s.fromTpl);
ok(tplA.map(s => s.tplId).sort().join(',') === 'mt_1,mt_2,mt_8,mt_9', 'cong tac ONLY_ADMIN=true: chi mau DA DUYET cua ADMIN dang hoat dong, got ' + tplA.map(s => s.tplId).sort().join(','));
ctx.VIETTAT_TPL_ONLY_ADMIN = false;
const m1 = bytitle('mt_1');
ok(m1.id === 'tpl_mt_1' && m1.scope === 'team' && m1.owner === '' && m1.options.length === 1 && m1.options[0] === 'Noi dung mt_1', 'mau -> muc CHUNG, 1 lua chon = noi dung mau');
ok(m1.abbr === 'chaokhachmoi' && !/\s/.test(m1.abbr), 'viet tat = tieu de bo dau + bo khoang trang: ' + m1.abbr);
ok(m1.nhom === 'Mẫu tin/Trang sức', 'thu muc "Mẫu tin/<Nhom SP>": ' + m1.nhom);
ok(bytitle('mt_2').nhom === 'Mẫu tin', 'mau khong co nhom -> thu muc "Mẫu tin"');
const kw = m1.keyword.split(',');
ok(kw.indexOf('Chào khách mới') >= 0 && kw.indexOf('ckm') >= 0 && kw.indexOf('Vòng tay') >= 0 && kw.indexOf('Nhẫn vàng') >= 0 && kw.indexOf('Khách hỏi giá') >= 0 && kw.indexOf('chào hỏi') >= 0 && kw.indexOf('khách') >= 0, 'tu khoa: tieu de, chu cai dau, tung san pham, chu de, tag, tung tu: ' + m1.keyword);
ok(m1.keyword.length <= 200, 'tu khoa <= 200 ky tu');
ok(m1.images.length === 2 && m1.images[0].id === IMGA && m1.images[1].id === IMGB, 'anh: chi lay URL Drive co id (bo link ngoai), dung thu tu');
// Trung viet tat
const bh = tpl.filter(s => s.tplId === 'mt_2' || s.tplId === 'mt_8').map(s => s.abbr).sort();
ok(bh[0] !== bh[1] && bh.every(a => /^baohanh/.test(a)), 'hai mau trung tieu de: viet tat khong trung nhau: ' + bh.join(','));
ok(tpl.every(s => s.abbr !== 'chao' && s.abbr !== 'baohanh' || s.tplId), 'khong ghi de len viet tat tu sheet');
// Muc tu sheet THANG khi trung: tao viet tat 'baohanh' CHUNG trong sheet -> mau khong lay 'baohanh'
sheets.VietTat.push(['vt_3', 'Chung', 'baohanh', '', JSON.stringify(['Bao hanh chung']), '', 'Duyen', Date.now(), '[]']);
const list2 = ctx.readVietTat_({ priv: false, name: 'Lan' });
ok(list2.filter(s => s.abbr === 'baohanh').length === 1 && list2.find(s => s.abbr === 'baohanh').id === 'vt_3', 'viet tat trong sheet THANG khi trung tieu de mau (mau doi sang baohanh2...)');
ok(list2.filter(s => s.fromTpl).every(s => !(s.abbr === 'baohanh')), 'mau khong chiem viet tat da co');
// Phan quyen anh qua vietTatImage_ (mau da duyet => ai dung viet tat cung lay duoc anh dinh kem cua mau)
const okImg = ctx.vietTatImage_(IMGA, { priv: false, name: 'Hoa' });
ok(okImg.ok && okImg.base64 === 'QUJD', 'nhan vien lay duoc anh dinh kem cua mau admin qua vietTatImage_');
ok(ctx.vietTatImage_('NOTINTEMPLATEAAAAAAA', { priv: false, name: 'Hoa' }).code === 'FORBIDDEN', 'anh khong thuoc muc nao: van bi chan');
// Admin khoa / khong co admin / loi doc Users: Viet tat KHONG hong
users = [{ username: 'hoa', name: 'Hoa', role: 'cs', active: true }];
ok(ctx.readVietTat_({ priv: false, name: 'Lan' }).filter(s => s.fromTpl).length > 0, 'mac dinh: mau van vao Viet tat du khong co admin nao hoat dong');
ctx.VIETTAT_TPL_ONLY_ADMIN = true;
ok(ctx.readVietTat_({ priv: false, name: 'Lan' }).filter(s => s.fromTpl).length === 0, 'ONLY_ADMIN=true + khong co admin hoat dong -> khong co muc tu mau');
ctx.VIETTAT_TPL_ONLY_ADMIN = false;
users = []; usersThrow = true;
ctx.VIETTAT_TPL_ONLY_ADMIN = true;
const l3 = ctx.readVietTat_({ priv: false, name: 'Lan' });
ok(l3.length >= 2 && l3.every(s => !s.fromTpl), 'ONLY_ADMIN=true + doc Users loi -> Viet tat tu sheet van tra binh thuong');
ctx.VIETTAT_TPL_ONLY_ADMIN = false;
ok(ctx.readVietTat_({ priv: false, name: 'Lan' }).filter(s => s.fromTpl).length > 0, 'mac dinh: doc Users loi cung khong anh huong (khong doc Users)');
usersThrow = false;
// Gioi han 300 mau + bo trong sheet mau
users = [{ username: 'duyenht', name: 'Duyên HT', role: 'admin', active: true }];
sheets.MessageTemplates = []; for (let i = 0; i < 320; i++) sheets.MessageTemplates.push(T({ id: 'x' + i, title: 'Mau so ' + i, by: 'duyenht', upd: new Date(2026, 0, 1 + (i % 28), i % 24, i) }));
ok(ctx.readVietTat_({ name: 'a' }).filter(s => s.fromTpl).length === 300, 'toi da 300 muc tu mau (moi nhat truoc)');
sheets.MessageTemplates = [];
ok(ctx.readVietTat_({ name: 'a' }).filter(s => s.fromTpl).length === 0, 'sheet mau rong -> khong loi');
// Tieu de toan ky tu la -> van co viet tat
sheets.MessageTemplates = [T({ id: 'mt_77', title: '***', by: 'duyenht' })];
const z = ctx.readVietTat_({ name: 'a' }).find(s => s.tplId === 'mt_77');
ok(z && z.abbr === 'mau77' , 'tieu de khong co chu/so -> viet tat du phong mau<so cuoi id>: ' + (z && z.abbr));
console.log(bad ? '\n' + bad + ' FAIL' : '\nALL OK'); process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Test Node (Supabase gia) cho mục KHO / TỒN KHO: phân quyền ở server, xung đột, nhập hàng loạt, tìm kiếm an toàn.
// Phần SQL (ton_kho_set/adjust/import) đã thử trên Postgres thật khi viết; file này thử lớp GAS. Chạy: node tools/test-kho.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const code = src.slice(src.indexOf('var SB_BATCH_ ='));
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const props = { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY' };
const R = (c, b, h) => ({ getResponseCode: () => c, getContentText: () => typeof b === 'string' ? b : JSON.stringify(b), getAllHeaders: () => h || {} });
const users = { adm: { username: 'Admin', role: 'admin' }, trang: { username: 'Trang', role: 'cs' }, lan: { username: 'Lan', role: 'cs' }, bao: { username: 'Bao', role: 'cs' } };
const kho = new Map(), ton = new Map(); let lastGet = '', rpcCalls = [];
const ctx = {
  Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null }) },
  _sessUser_: tok => users[tok] || null,
  UrlFetchApp: { fetch(url, o) {
    if (o.headers.apikey !== 'SECRETKEY') throw new Error('thieu key');
    const u = new URL(url), rest = u.pathname.replace('/rest/v1/', ''), sp = u.searchParams, body = o.payload ? JSON.parse(o.payload) : null;
    if (rest.startsWith('rpc/')) {
      rpcCalls.push({ fn: rest.slice(4), body });
      if (rest === 'rpc/ton_kho_set') {
        const key = body.p_kho + '|' + body.p_ma, cur = ton.get(key);
        if (!cur) { if (body.p_ver) return R(200, { ok: false, conflict: true }); const row = { kho_id: body.p_kho, ma_hang: body.p_ma, ten_hang: body.p_ten, ton: body.p_ton, ver: 1 }; ton.set(key, row); return R(200, { ok: true, row }); }
        if (cur.ver !== body.p_ver) return R(200, { ok: false, conflict: true, row: cur });
        cur.ton = body.p_ton; cur.ver++; return R(200, { ok: true, row: cur });
      }
      if (rest === 'rpc/ton_kho_import') return R(200, { ok: true, created: body.p_rows.length, updated: 0, skipped: 0 });
      if (rest === 'rpc/ton_kho_adjust') return R(200, { ok: true, row: { ton: body.p_delta } });
    }
    if (rest === 'kho' || rest.startsWith('kho')) {
      if (o.method === 'POST') { kho.set(body.id, body); return R(201, ''); }
      if (o.method === 'PATCH') { const id = sp.get('id').slice(3); Object.assign(kho.get(id), body); return R(204, ''); }
      const id = sp.get('id'); if (id) { const k = kho.get(id.slice(3)); return R(200, k ? [k] : []); }
      return R(200, [...kho.values()]);
    }
    if (rest === 'ton_kho' && o.method === 'PATCH') {
      const row = ton.get(sp.get('kho_id').slice(3) + '|' + sp.get('ma_hang').slice(3)); if (!row) return R(200, []); Object.assign(row, body); return R(200, [row]);
    }
    if (rest === 'ton_kho') { lastGet = url; const rows = [...ton.values()].filter(r => r.kho_id === sp.get('kho_id').slice(3)); return R(200, rows, { 'Content-Range': '0-' + (rows.length - 1) + '/' + (rows.length + 40) }); }
    if (rest === 'ton_kho_log') return R(200, [{ ma_hang: 'A', truoc: 1, sau: 2 }]);
    return R(404, 'khong co ' + rest);
  } }
};
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = (fn, arg) => { ctx.__a = arg; return vm.runInContext(fn + '(__a)', ctx); };

// 1) Chưa đăng nhập
ok(run('khoList_', 'sai').code === 'AUTH' && run('khoList_', undefined).code === 'AUTH', 'khoList can dang nhap');
ok(run('khoSave_', { token: 'sai', kho: { ten: 'X' } }).code === 'AUTH', 'khoSave can dang nhap');
ok(run('tonKhoList_', { token: 'sai', kho: 'k' }).code === 'AUTH', 'tonKho can dang nhap');

// 2) Chỉ admin tạo/sửa kho
ok(!run('khoSave_', { token: 'trang', kho: { ten: 'Kho SX' } }).ok, 'non-admin KHONG tao kho');
ok(!run('khoSave_', { token: 'adm', kho: { ten: '  ' } }).ok, 'ten rong bi tu choi');
let r = run('khoSave_', { token: 'adm', kho: { ten: 'Kho San xuat', leader: 'Trang', members: ['Lan', 'lan', ' Lan ', '', 'Bao'] } });
ok(r.ok && /^kho_/.test(r.kho.id) && r.kho.members.length === 2 && r.kho.canEdit, 'admin tao kho, thanh vien khu trung: ' + JSON.stringify(r));
const K = r.kho.id;
r = run('khoSave_', { token: 'adm', kho: { id: K, ten: 'Kho SX (moi)', leader: 'Trang', members: ['Lan'] } });
ok(r.ok && kho.get(K).ten === 'Kho SX (moi)' && kho.get(K).members.length === 1, 'admin sua kho');
ok(!run('khoSave_', { token: 'adm', kho: { id: 'khong_co', ten: 'X' } }).ok, 'sua kho khong ton tai bi tu choi');
const K2 = run('khoSave_', { token: 'adm', kho: { ten: 'Kho cu', active: false } }).kho.id;

// 3) Danh sách kho + canEdit theo từng người
const can = tok => { const l = run('khoList_', tok); return l.kho.find(x => x.id === K).canEdit; };
ok(can('adm') && can('trang') && can('lan') && !can('bao'), 'canEdit: admin, leader, thanh vien = true; nguoi khac = false');
ok(run('khoList_', 'bao').kho.every(x => x.active) && !run('khoList_', 'bao').kho.some(x => x.id === K2) && run('khoList_', 'adm').kho.some(x => x.id === K2), 'kho da tat chi admin thay');

// 4) Sửa tồn: quyền + xung đột + dữ liệu xấu
ok(run('tonKhoSet_', { token: 'bao', kho: K, ma: 'A1', ton: 5, ver: 0 }).code === 'FORBIDDEN', 'nguoi ngoai kho KHONG sua duoc');
ok(run('tonKhoSet_', { token: 'lan', kho: K, ma: 'A1', ten: 'Ten A1', ton: 5, ver: 0 }).ok, 'thanh vien tao dong moi');
ok(run('tonKhoSet_', { token: 'trang', kho: K, ma: 'A1', ton: 7, ver: 1 }).row.ton === 7, 'leader sua dung ver');
r = run('tonKhoSet_', { token: 'lan', kho: K, ma: 'A1', ton: 9, ver: 1 });
ok(r.conflict && r.row.ton === 7, 'ver cu -> conflict kem dong hien tai: ' + JSON.stringify(r));
ok(!run('tonKhoSet_', { token: 'adm', kho: K, ma: 'A1', ton: 'abc', ver: 2 }).ok && !run('tonKhoSet_', { token: 'adm', kho: K, ma: 'A1', ton: '', ver: 2 }).ok, 'so luong khong hop le bi tu choi');
ok(!run('tonKhoSet_', { token: 'adm', kho: K2, ma: 'A1', ton: 1 }).ok && !run('tonKhoSet_', { token: 'adm', kho: 'khong_co', ma: 'A1', ton: 1 }).ok, 'kho tat / khong co bi tu choi');
const call = rpcCalls[rpcCalls.length - 1]; ok(call.body.p_by !== undefined, 'co p_by');
ok(rpcCalls.filter(c => c.fn === 'ton_kho_set').every(c => c.body.p_by === 'Lan' || c.body.p_by === 'Trang'), 'p_by lay tu TOKEN (khong tin client): ' + JSON.stringify(rpcCalls.map(c => c.body.p_by)));
r = run('tonKhoSet_', { token: 'trang', kho: K, ma: 'A1', ton: 1, ver: 2, by: 'Admin' }); ok(rpcCalls[rpcCalls.length - 1].body.p_by === 'Trang', 'client gui by gia khong anh huong');

// 5) Ngưỡng
ok(run('tonKhoNguong_', { token: 'bao', kho: K, ma: 'A1', nguong: 3 }).code === 'FORBIDDEN', 'nguong: nguoi ngoai bi chan');
ok(run('tonKhoNguong_', { token: 'lan', kho: K, ma: 'A1', nguong: 3 }).row.nguong === 3 && !run('tonKhoNguong_', { token: 'lan', kho: K, ma: 'A1', nguong: -1 }).ok && !run('tonKhoNguong_', { token: 'lan', kho: K, ma: 'KHONGCO', nguong: 1 }).ok, 'nguong hop le / sai');

// 6) Nhập hàng loạt
ok(run('tonKhoImport_', { token: 'bao', kho: K, rows: [{ ma: 'A', ton: 1 }] }).code === 'FORBIDDEN', 'import: nguoi ngoai bi chan');
ok(!run('tonKhoImport_', { token: 'lan', kho: K, rows: [] }).ok, 'import rong bi tu choi');
ok(!run('tonKhoImport_', { token: 'lan', kho: K, rows: Array.from({ length: 2001 }, (_, i) => ({ ma: 'M' + i, ton: 1 })) }).ok, 'import > 2000 dong bi tu choi');
r = run('tonKhoImport_', { token: 'lan', kho: K, rows: [{ ma: 'M1', ten: 'T', ton: 3 }, null, { ma: 'M2', ton: 4 }], lyDo: 'Nhap dau' });
ok(r.ok && r.created === 3, 'import hop le'); const ic = rpcCalls[rpcCalls.length - 1].body; ok(ic.p_by === 'Lan' && ic.p_rows.length === 3 && ic.p_rows[1].ma === '', 'import: by tu token, dong null duoc lam sach');

// 7) Danh sách: tìm kiếm an toàn, tổng, ngưỡng
r = run('tonKhoList_', { token: 'bao', kho: K, q: 'a),(b*%', limit: 5000 });
ok(r.ok && r.total === r.rows.length + 40 && r.limit === 1000, 'tong dem tu Content-Range, limit bi chan o 1000: ' + r.total + ' ' + r.limit);
const orPart = lastGet.split('or=')[1].split('&')[0]; ok(/^\(ma_hang\.ilike\.\*[^,]*\*,ten_hang\.ilike\.\*[^,]*\*\)$/.test(decodeURIComponent(orPart).replace(/\s+/g, '_')), 'q co ky tu dac biet khong lam hong bo loc or: ' + decodeURIComponent(orPart));
ok(run('tonKhoList_', { token: 'bao', kho: K2 }).ok === false && run('tonKhoList_', { token: 'adm', kho: K2 }).ok, 'kho tat: moi nguoi khong xem, admin xem');
ton.get(K + '|A1').nguong = 5; ton.get(K + '|A1').ton = 2;
r = run('tonKhoList_', { token: 'bao', kho: K, low: '1' }); ok(r.rows.length === 1 && r.rows[0].ma_hang === 'A1', 'loc hang sap het (ton <= nguong, nguong > 0)');

// 8) Nhật ký + khoAdjust_ nội bộ (không có action)
ok(run('tonKhoLog_', { token: 'bao', kho: K }).log.length === 1, 'moi nguoi xem nhat ky');
vm.runInContext("khoAdjust_('k','MA',-2,'trang','don','DH9','ban')", ctx); const ac = rpcCalls[rpcCalls.length - 1];
ok(ac.fn === 'ton_kho_adjust' && ac.body.p_delta === -2 && ac.body.p_ref === 'DH9' && ac.body.p_allow_negative === true, 'khoAdjust_ truyen dung tham so');
ok(!/'tonKhoAdjust'/.test(src), 'KHONG co action cong khai tonKhoAdjust');
ok(/action === 'khoSave'/.test(src) && /action === 'tonKho'/.test(src) && /action === 'khoList'/.test(src), 'da noi route');
console.log('ALL KHO TESTS PASSED');

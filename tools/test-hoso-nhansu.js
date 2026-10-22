// Test nhapHoSoNhanSu (2026-10-21) bang du lieu GIA — khong dua du lieu ca nhan that vao repo (repo cong khai).
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const code = src.slice(src.indexOf("var SH_HOSO_NS"), src.indexOf('function orgOverview_(p)'));
function fakeSheet(vals) { const s = { vals, fmt: null, getLastRow: () => s.vals.length, getDataRange: () => ({ getValues: () => s.vals }),
  getRange: (r, c, n, m) => ({ getValues: () => s.vals.slice(r - 1, r - 1 + n).map(x => x.slice(c - 1, c - 1 + m)), setNumberFormat: f => { s.fmt = f; return this; },
    setValues: v => { v.forEach((row, i) => { s.vals[r - 1 + i] = row; }); } }) }; return s; }
function run(srcVals, hoso) {
  const sheets = { NhanSuImport: fakeSheet(srcVals), HoSoNhanSu: fakeSheet(hoso || [['name', 'dept', 'position', 'birthday', 'phone', 'address', 'updatedAt']]) };
  const logs = [];
  const ctx = { getCrmSS_: () => ({ getSheetByName: n => sheets[n] || null }), getSheet_: n => sheets[n], Logger: { log: m => logs.push(m) },
    Utilities: { formatDate: (d, tz, f) => ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() }, Date, String, Object, Array, JSON, Error };
  vm.createContext(ctx); vm.runInContext(code, ctx); ctx.sheets = sheets; ctx.logs = logs; return ctx;
}
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const H = ['STT', 'BỘ PHẬN', 'TÊN NHÂN VIÊN', 'VỊ TRÍ', 'GIỚI TÍNH', 'NGÀY SINH', 'CCCD', 'SỐ ĐIỆN THOẠI', 'ĐỊA CHỈ HIỆN TẠI'];
const data = [H,
  [1, 'KẾ TOÁN', 'Nguyễn Văn A', 'KT', 'Nam', '01/02/1990', '000000000001', '912345678', 'Số 1 Phố X'],
  [2, 'KHO', 'Nguyễn Văn B', 'NV', 'Nữ', new Date(1995, 4, 6), '000000000002', '0987654321', '=cong thuc'],
  [3, 'KẾ TOÁN', 'Trùng Tên', 'KT', 'Nữ', '03/03/1991', '000000000003', '0900000001', 'A'],
  [4, 'KHO', 'Trùng Tên', 'NV', 'Nữ', '04/04/1992', '000000000004', '0900000002', 'B'], [5, '', '', '', '', '', '', '', '']];
let c = run(data);
c.nhapHoSoNhanSu();
ok(c.sheets.HoSoNhanSu.vals.length === 1, 'xem truoc: khong ghi gi');
c.nhapHoSoNhanSu(true);
const v = c.sheets.HoSoNhanSu.vals;
ok(v.length === 5, '4 nguoi duoc ghi (2 nguoi trung ten o 2 bo phan = 2 dong), dong trong bi bo');
ok(v[1][4] === '0912345678', 'SDT bi mat so 0 dau duoc bu lai');
ok(v[2][3] === '06/05/1995', 'ngay sinh dang Date -> dd/MM/yyyy');
ok(c.sheets.HoSoNhanSu.fmt === '@', 'dinh dang cot la chu (khong thanh cong thuc / khong doi so)');
ok(JSON.stringify(v).indexOf('00000000000') < 0, 'KHONG ghi CCCD');
c.nhapHoSoNhanSu(true);
ok(c.sheets.HoSoNhanSu.vals.length === 5, 'chay lai khong nhan doi');
const d2 = data.map(r => r.slice()); d2[1][8] = 'Dia chi moi';
const c2 = run(d2, c.sheets.HoSoNhanSu.vals); const r2 = c2.nhapHoSoNhanSu(true);
ok(r2.upd === 1 && r2.same === 3 && c2.sheets.HoSoNhanSu.vals[1][5] === 'Dia chi moi', 'sua 1 nguoi -> cap nhat dung dong do');
let thr = false; try { const c3 = run(data); c3.getCrmSS_ = null; } catch (e) { thr = true; }
process.exit(fail ? 1 : 0);

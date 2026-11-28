// Test GAS savePancakeSdtStats_ (SDT gop thang, buoc 2/3): cot dateTo + sheet PancakeSdtDaily. Mo phong Sheets bang bo nho.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); if (i < 0) throw new Error('khong thay ' + name); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
function varDecl(name){ const m = src.match(new RegExp('var ' + name + ' *= *(\\[[^\\]]*\\]|\'[^\']*\');')); if (!m) throw new Error('khong thay var ' + name); return 'var ' + name + ' = ' + m[1] + ';'; }
function makeSheet(){ const sh = { data: [], getLastRow(){ return this.data.length; }, clearContents(){ this.data = []; },
  getRange(r, c, nr, nc){ const self = this; return { getValues(){ return self.data.slice(r - 1, r - 1 + nr).map(x => { const o = x.slice(c - 1, c - 1 + nc); while (o.length < nc) o.push(''); return o; }); },
    setValues(m){ m.forEach((row, i) => { if (row.length !== nc) throw new Error('do rong ' + row.length + ' != ' + nc); self.data[r - 1 + i] = row.slice(); }); }, setNumberFormat(){} }; } }; return sh; }
const sheets = {};
const ctx = { console, normOrderDate_: v => String(v || '').slice(0, 10), jsonOut_: o => o, getSheet_: (n) => sheets[n] || (sheets[n] = makeSheet()) };
vm.createContext(ctx);
vm.runInContext(['SH_PK_SDT', 'SH_PK_SDT_DAILY'].map(varDecl).concat(['PK_SDT_STATS_HEADERS', 'PK_SDT_DAILY_HEADERS'].map(varDecl)).join('\n') + '\n' + fn('savePancakeSdtStats_') + '\n' + fn('_savePancakeSdtDaily_'), ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
const row = (o) => Object.assign({ date: '2026-08-01', pageId: 'p1', pageName: 'P1', nhanVien: 'An', tinNhanTuBinhLuan: 1, binhLuan: 2, phienTLBinhLuan: 3, tinNhan: 4, phienTLTinNhan: 5, sdtMangVe: 6, soDonChot: 7 }, o);
const dly = (d, p, sdt, don) => ({ date: d, pageId: p, pageName: 'P' + p, tinNhan: 10, sdtMangVe: sdt, soDonChot: don });
let r = ctx.savePancakeSdtStats_([row({ dateTo: '2026-08-31' })], [dly('2026-08-01', 'p1', 2, 1), dly('2026-08-02', 'p1', 4, 2)]);
const st = sheets['PancakeSdtStats'].data, dl = sheets['PancakeSdtDaily'].data;
ok(r.ok && r.written === 1 && r.dailyWritten === 2, 'luu 1 dong gop + 2 ngay: ' + JSON.stringify(r));
ok(st[0].length === 12 && st[0][11] === 'dateTo', 'header PancakeSdtStats co cot dateTo o CUOI (12 cot)');
ok(st[1][11] === '2026-08-31' && st[1][0] === '2026-08-01' && st[1][9] === 6 && st[1][10] === 7, 'dong gop: date = ngay dau, dateTo = ngay cuoi, cot cu giu nguyen vi tri (sdt idx 9, don idx 10)');
ok(dl[0].join() === 'date,pageId,pageName,tinNhanTuBinhLuan,binhLuan,phienTLBinhLuan,tinNhan,phienTLTinNhan,sdtMangVe,soDonChot' && dl[2][8] === 4 && dl[2][9] === 2, 'daily: header + dong ngay dung cot (sdt idx 8, don idx 9)');
r = ctx.savePancakeSdtStats_([row({ date: '2026-09-05', dateTo: '' })], []);
ok(sheets['PancakeSdtStats'].data[2][11] === '', 'file 1 ngay: dateTo rong (nhu cu)');
r = ctx.savePancakeSdtStats_([row({ dateTo: '2026-08-01' })], []);
ok(sheets['PancakeSdtStats'].data.find(x => x[0] === '2026-08-01')[11] === '', 'dateTo = date (khong lon hon) -> rong');
r = ctx.savePancakeSdtStats_([row({ dateTo: '2026-08-31', sdtMangVe: 99 })], [dly('2026-08-02', 'p1', 21, 3)]);
const d2 = sheets['PancakeSdtDaily'].data.filter(x => x[0] === '2026-08-02');
ok(d2.length === 1 && d2[0][8] === 21, 'nap lai cung (ngay, Page) -> GHI DE, khong nhan doi');
ok(sheets['PancakeSdtDaily'].data.length === 3, 'daily: header + 2 ngay (08-01 giu, 08-02 ghi de)');
ok(sheets['PancakeSdtStats'].data.filter(x => x[0] === '2026-08-01' && x[1] === 'p1').length === 1 && sheets['PancakeSdtStats'].data.find(x => x[0] === '2026-08-01')[9] === 99, 'dong nhan vien nap lai cung (ngay dau, Page) ghi de');
r = ctx.savePancakeSdtStats_([], [dly('2026-08-03', 'p2', 5, 0)]);
ok(r.ok && r.written === 0 && r.dailyWritten === 1, 'chi co daily (khong co dong nhan vien) van luu');
r = ctx.savePancakeSdtStats_([row({ pageId: 'p9' })], undefined);
ok(r.ok && r.dailyWritten === 0, 'khong gui daily (client cu) -> chay nhu cu');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);

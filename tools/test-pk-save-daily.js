// Test GAS savePancakeStats_ (buoc 2/4 Pancake gop thang): cot dateTo + sheet PancakeStatsDaily. Mo phong Sheets bang bo nho.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('gas_v13.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
function varDecl(name){ const m = src.match(new RegExp('var ' + name + ' *= *(\\[[^\\]]*\\]|\'[^\']*\');')); return 'var ' + name + ' = ' + m[1] + ';'; }
function makeSheet(){ const sh = { data: [], getLastRow(){ return this.data.length; }, clearContents(){ this.data = []; },
  getRange(r, c, nr, nc){ const self = this; return { getValues(){ return self.data.slice(r - 1, r - 1 + nr).map(x => { const o = x.slice(c - 1, c - 1 + nc); while (o.length < nc) o.push(''); return o; }); },
    setValues(m){ m.forEach((row, i) => { if (row.length !== nc) throw new Error('do rong ' + row.length + ' != ' + nc); self.data[r - 1 + i] = row.slice(); }); }, setNumberFormat(){} }; } }; return sh; }
const sheets = {};
const ctx = { console, normOrderDate_: v => String(v || '').slice(0, 10), jsonOut_: o => o, getSheet_: (n) => sheets[n] || (sheets[n] = makeSheet()) };
vm.createContext(ctx);
vm.runInContext(['SH_PK_STATS', 'SH_PK_DAILY'].map(varDecl).concat(['PK_STATS_HEADERS', 'PK_DAILY_HEADERS'].map(varDecl)).join('\n') + '\n' + fn('savePancakeStats_') + '\n' + fn('_savePancakeDaily_'), ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
const row = (o) => Object.assign({ date: '2026-08-01', pageId: 'p1', pageName: 'P1', nhanVien: 'An', khCu: 1, khMoi: 2, tongTT: 3, tinNhan: 4, binhLuan: 5, hoiThoaiMoi: 6, dhKhMoi: 7, dhKhCu: 8, tongDH: 9 }, o);
let r = ctx.savePancakeStats_([row({ dateTo: '2026-08-31' })], [{ date: '2026-08-01', pageId: 'p1', pageName: 'P1', tongTT: 10, tongDH: 1 }, { date: '2026-08-02', pageId: 'p1', pageName: 'P1', tongTT: 20, tongDH: 2 }]);
const st = sheets['PancakeStats'].data, dl = sheets['PancakeStatsDaily'].data;
ok(r.ok && r.written === 1 && r.dailyWritten === 2, 'luu 1 dong gop + 2 ngay: ' + JSON.stringify(r));
ok(st[0].length === 14 && st[0][13] === 'dateTo', 'header PancakeStats co cot dateTo o CUOI (14 cot)');
ok(st[1][13] === '2026-08-31' && st[1][0] === '2026-08-01' && st[1][12] === 9, 'dong gop: date=ngay dau, dateTo=ngay cuoi, cot cu giu nguyen vi tri');
r = ctx.savePancakeStats_([row({ date: '2026-09-05', dateTo: '' })], []);
ok(sheets['PancakeStats'].data[2][13] === '', 'file 1 ngay: dateTo rong (nhu cu)');
r = ctx.savePancakeStats_([row({ dateTo: '2026-08-01' })], []);
ok(sheets['PancakeStats'].data.find(x => x[0] === '2026-08-01')[13] === '', 'dateTo = date (khong lon hon) -> rong');
r = ctx.savePancakeStats_([row({ dateTo: '2026-08-31', tongTT: 99 })], [{ date: '2026-08-02', pageId: 'p1', pageName: 'P1', tongTT: 21, tongDH: 3 }]);
const d2 = sheets['PancakeStatsDaily'].data.filter(x => x[0] === '2026-08-02');
ok(d2.length === 1 && d2[0][5] === 21, 'nap lai cung (ngay, Page) -> GHI DE, khong nhan doi');
ok(sheets['PancakeStatsDaily'].data.length === 3, 'daily: header + 2 ngay (08-01 giu, 08-02 ghi de)');
r = ctx.savePancakeStats_([], [{ date: '2026-08-03', pageId: 'p2', pageName: 'P2', tongTT: 5 }]);
ok(r.ok && r.written === 0 && r.dailyWritten === 1, 'chi co daily (khong co dong nhan vien) van luu');
r = ctx.savePancakeStats_([row({ pageId: 'p9' })], undefined);
ok(r.ok && r.dailyWritten === 0, 'khong gui daily (client cu) -> chay nhu cu');
console.log(fail ? fail + ' loi' : 'TAT CA OK'); process.exit(fail ? 1 : 0);

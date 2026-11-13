// Test thuong ngay co dieu kien DOANH THU (Duyen 2026-11-13). Chay: node tools/test-team-daily-revenue.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const D = src.slice(src.indexOf('var TEAM_BONUS_DEFAULT_'), src.indexOf('function teamBonusCfg_'));
const ctx = { JSON, Date, Math, Number, isFinite, Object, RegExp, String, Array,
  _normTxt_: s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(), _csJsonSetting_: () => null,
  _isExcludedOrderStatus_: () => false, _dtIsExchangeOrder_: () => false, _stripVN_: s => s,
  _dtOrderRevenue_: r => r.rev, parseVNDate_: s => { const m = String(s).split('/'); return new Date(Date.UTC(+m[2], +m[1] - 1, +m[0])); },
  _vnYmd_: d => d.toISOString().slice(0, 10), readDTTong_: () => ROWS,
  _tbTeam_: () => ({ list: [{ name: 'Hoa', group: 'online' }, { name: 'Nam', group: 'offline' }], memberOf: { hoa: 'Hoa', nam: 'Nam' } }),
  _tbCloseFor_: () => ({ avgHeld: 0, rows: [], winners: [], noData: true }) };
let ROWS = [];
vm.createContext(ctx); vm.runInContext(D, ctx);
['teamBonusCfg_', '_tbPad_', '_tbYmdAdd_', '_tbDow_', '_tbMonthEnd_', '_tbFmtDm_', '_tbOrderCounts_', '_tbDailyCounts_', '_tbComputeRewards_'].forEach(n => vm.runInContext(grab(n), ctx));
// ngay "hom nay" cua ham = ngay that; dung thang qua khu de khong bi "partial"
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const mk = (who, n, each) => Array.from({ length: n }, () => ({ ngayTao: '12/10/2026', nguoiTao: who, rev: each }));
const run = rows => { ROWS = rows; const cfg = ctx.teamBonusCfg_(); return { cfg, rw: ctx._tbComputeRewards_('2026-10', cfg) }; };
const day = r => r.rw.daily.find(x => x.date === '2026-10-12');
let r = run(mk('Hoa', 6, 2000000));   // 6 don, 12tr < 50tr
ok(r.cfg.dailyMinRevenue === 50000000, 'mac dinh dailyMinRevenue = 50tr');
ok(!day(r).qualified && day(r).winners.length === 0, '6 don nhung 12tr -> KHONG dat');
r = run(mk('Hoa', 6, 9000000));   // 54tr
ok(day(r).qualified && day(r).winners[0].name === 'Hoa' && day(r).winners[0].revenue === 54000000, '6 don 54tr -> dat');
r = run(mk('Hoa', 8, 1000000).concat(mk('Nam', 6, 9000000)));   // Hoa nhieu don hon nhung 8tr; Nam du dieu kien
ok(day(r).winners.length === 1 && day(r).winners[0].name === 'Nam', 'nguoi nhieu don nhat nhung thieu doanh thu bi loai, nguoi du dieu kien thang');
r = run(mk('Hoa', 7, 8000000).concat(mk('Nam', 7, 8000000)));
ok(day(r).winners.length === 2, 'dong hang cung dat dieu kien -> cung nhan');
r = run(mk('Hoa', 5, 20000000));
ok(!day(r).qualified, '5 don 100tr van thieu so don -> khong dat');
process.exit(fail ? 1 : 0);

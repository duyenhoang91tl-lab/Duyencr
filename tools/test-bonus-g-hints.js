const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
const pick = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const ctx = { esc: s => String(s), SALE_CHANNELS: { Ngoc: 'offline', Lan: 'probation' }, SALE_CHANNEL_PERIODS: { Ngoc: [{ from: '2026-10-01', channel: 'probation' }] },
  _cfgAliasesOf: n => [n], _scpGroupNames_: n => [n], _bonusNamesOfOrder_: o => { const s = {}; String(o.saleBan).split(',').forEach(x => { x = x.trim(); if (x) s[x] = true; }); return s; },
  _saleStartDate_: n => ({ Lan: '2026-10-05' })[n] || '' };
vm.createContext(ctx); vm.runInContext(pick('_srGProbationHints_'), ctx);
let bad = 0; const ok = (c, m) => { if (!c){ bad++; console.log('FAIL', m); } };
ctx.g = { tv: { rows: [] } };
let h = vm.runInContext('_srGProbationHints_(g, [{saleBan:"Ngoc"}])', ctx);
ok(h.length === 2, '2 Sale thử việc không có dòng: ' + h.length);
ok(/chưa đặt <b>Ngày bắt đầu tính thưởng/.test(h.find(x => x.name === 'Ngoc').reason), 'Ngọc: thiếu ngày bắt đầu (có mốc Thử việc, loại hiện tại offline)');
ok(/không thấy đơn Pos/.test(h.find(x => x.name === 'Lan').reason), 'Lan: có ngày nhưng không có đơn');
h = vm.runInContext('_srGProbationHints_(g, [{saleBan:"lan, X"},{saleBan:"Lan"}])', ctx);
ok(/có 2 đơn Pos nhưng chưa phát sinh thưởng/.test(h.find(x => x.name === 'Lan').reason), 'Lan: có đơn (không phân biệt hoa/thường) nhưng chưa thưởng');
ctx.g = { tv: { rows: [{ name: 'Lan' }] } };
h = vm.runInContext('_srGProbationHints_(g, [])', ctx); ok(h.length === 1 && h[0].name === 'Ngoc', 'Sale đã có dòng ở mục Thử việc thì không cảnh báo');
console.log(bad ? 'FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);

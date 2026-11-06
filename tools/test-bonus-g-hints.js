const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
const pick = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const ctx = { esc: s => String(s), _srState: { gDateFrom: '2026-11-01', gDateTo: '2026-11-02' }, _ddmmyyyyToYmd_: s => { const m = String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2) : ''; }, SALE_CHANNELS: { Ngoc: 'offline', Lan: 'probation' }, SALE_CHANNEL_PERIODS: { Ngoc: [{ from: '2026-10-01', channel: 'probation' }] },
  _cfgAliasesOf: n => [n], _scpGroupNames_: n => [n], _bonusNamesOfOrder_: o => { const s = {}; String(o.saleBan).split(',').forEach(x => { x = x.trim(); if (x) s[x] = true; }); return s; },
  _saleStartDate_: n => ({ Lan: '2026-10-05' })[n] || '' };
vm.createContext(ctx); vm.runInContext(pick('_srGProbationHints_'), ctx);
let bad = 0; const ok = (c, m) => { if (!c){ bad++; console.log('FAIL', m); } };
ctx.g = { tv: { rows: [] } };
let h = vm.runInContext('_srGProbationHints_(g, [{saleBan:"Ngoc"}])', ctx);
ok(h.length === 2, '2 Sale thử việc không có dòng: ' + h.length);
ok(/chưa đặt <b>Ngày bắt đầu tính thưởng/.test(h.find(x => x.name === 'Ngoc').reason), 'Ngọc: thiếu ngày bắt đầu (có mốc Thử việc, loại hiện tại offline)');
ok(/không thấy đơn gốc nào \(lên Base trong kỳ và đã có đơn Pos\)/.test(h.find(x => x.name === 'Lan').reason), 'Lan: có ngày nhưng không có đơn gốc (lên Base trong kỳ và đã có đơn Pos)');
h = vm.runInContext('_srGProbationHints_(g, [{saleBan:"lan, X"},{saleBan:"Lan"}])', ctx);
ok(/có 2 đơn Pos: 0 đơn đã ghép Base.*0 đơn có ngày lên Base từ ngày bắt đầu/.test(h.find(x => x.name === 'Lan').reason), 'Lan: có đơn nhưng chưa ghép Base');
h = vm.runInContext('_srGProbationHints_(g, [{saleBan:"Lan",baseNgayTao:"2026-10-06",donGoc:true,ngayTao:"06/10/2026 10:00"},{saleBan:"Lan",baseNgayTao:"2026-10-01",ngayTao:"06/10/2026"}])', ctx);
ok(/2 đơn đã ghép Base.*1 đơn gốc.*1 đơn có ngày lên Base từ ngày bắt đầu/.test(h.find(x => x.name === 'Lan').reason), 'Lan: đếm đơn ghép Base/đơn gốc/sau ngày bắt đầu: ' + h.find(x => x.name === 'Lan').reason);
ctx._srState.gDateFrom = '2026-09-01'; ctx._srState.gDateTo = '2026-10-04';
h = vm.runInContext('_srGProbationHints_(g, [{saleBan:"Lan"}])', ctx);
ok(/kết thúc <b>trước Ngày bắt đầu 2026-10-05/.test(h.find(x => x.name === 'Lan').reason), 'kỳ xem kết thúc trước ngày bắt đầu');
ctx._srState.gDateFrom = '2026-11-01'; ctx._srState.gDateTo = '2026-11-02';
ctx.g = { tv: { rows: [{ name: 'Lan' }] } };
h = vm.runInContext('_srGProbationHints_(g, [])', ctx); ok(h.length === 1 && h[0].name === 'Ngoc', 'Sale đã có dòng ở mục Thử việc thì không cảnh báo');
console.log(bad ? 'FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);

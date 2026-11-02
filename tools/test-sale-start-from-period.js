var src = require('fs').readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
var fn = src.match(/function _saleStartDate_[\s\S]*?\n}\n/)[0];
var accounts = [], PER = {};
var _cfgAliasesOf = function(n){ return [n]; }, _acctNamesOf = function(a){ return a.names || []; };
var _scpListOf_ = function(n){ return PER[n] || []; };
eval(fn);
var bad = 0; function eq(a, b, m){ if (a !== b){ console.log('FAIL ' + m + ': ' + a); bad++; } }
PER = { Ngoc: [{ from: '2026-10-14', channel: 'probation' }] };
eq(_saleStartDate_('Ngoc'), '2026-10-14', 'mốc thử việc làm ngày bắt đầu');
accounts = [{ names: ['Ngoc'], startDate: '' }];
eq(_saleStartDate_('Ngoc'), '2026-10-14', 'tài khoản trống ngày -> dùng mốc');
accounts = [{ names: ['Ngoc'], startDate: '2026-10-01' }];
eq(_saleStartDate_('Ngoc'), '2026-10-01', 'tài khoản có ngày -> ưu tiên tài khoản');
PER = { A: [{ from: '', channel: 'probation' }], B: [{ from: '2026-09-01', channel: 'online' }], C: [{ from: '2026-09-10', channel: 'probation' }, { from: '2026-10-11', channel: 'online' }] };
eq(_saleStartDate_('A'), '', 'mốc không ngày -> không có');
eq(_saleStartDate_('B'), '', 'mốc chính thức -> không có');
eq(_saleStartDate_('C'), '2026-09-10', 'thử việc rồi chính thức -> ngày thử việc đầu');
console.log(bad ? 'FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);

var src = require('fs').readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
var fn = src.match(/function _saleStartDate_[\s\S]*?\n}\n/)[0];
var accounts = [], PER = {};
var _cfgAliasesOf = function(n){ return [n]; }, _acctNamesOf = function(a){ return a.names || []; };
var _scpGroupListOf_ = function(n){ return PER[n] || []; };
eval(fn);
var bad = 0; function eq(a, b, m){ if (a !== b){ console.log('FAIL ' + m + ': ' + a); bad++; } }
// ngày mốc thử việc (from) KHÔNG phải ngày bắt đầu tính thưởng
PER = { Ngoc: [{ from: '2026-10-01', channel: 'probation' }] };
eq(_saleStartDate_('Ngoc'), '', 'chỉ có ngày thử việc, chưa có bonusFrom -> không có ngày bắt đầu');
PER = { Ngoc: [{ from: '2026-10-01', channel: 'probation', bonusFrom: '2026-10-14' }] };
eq(_saleStartDate_('Ngoc'), '2026-10-14', 'bonusFrom làm ngày bắt đầu tính thưởng');
accounts = [{ names: ['Ngoc'], startDate: '' }];
eq(_saleStartDate_('Ngoc'), '2026-10-14', 'tài khoản trống ngày -> dùng bonusFrom');
accounts = [{ names: ['Ngoc'], startDate: '2026-10-20' }];
eq(_saleStartDate_('Ngoc'), '2026-10-20', 'tài khoản có ngày -> ưu tiên tài khoản');
PER = { B: [{ from: '2026-09-01', channel: 'online' }] };
eq(_saleStartDate_('B'), '', 'mốc chính thức -> không có');

// _scpNorm_ / _scpSet_ giữ bonusFrom chỉ cho mốc Thử việc
var s62 = require('fs').readFileSync(__dirname + '/../js/62-sale-channel-periods.js', 'utf8');
var norm = s62.match(/function _scpNorm_[\s\S]*?\n}\n/)[0];
eval(norm);
var r = _scpNorm_([{ from: '2026-10-01', channel: 'probation', bonusFrom: '2026-10-14' }, { from: '2026-11-01', channel: 'online', bonusFrom: '2026-11-05' }, { from: '2026-09-01', channel: 'probation', bonusFrom: 'abc' }]);
eq(JSON.stringify(r), JSON.stringify([{ from: '2026-09-01', channel: 'probation' }, { from: '2026-10-01', channel: 'probation', bonusFrom: '2026-10-14' }, { from: '2026-11-01', channel: 'online' }]), '_scpNorm_ giữ bonusFrom hợp lệ của mốc thử việc');
console.log(bad ? 'FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);

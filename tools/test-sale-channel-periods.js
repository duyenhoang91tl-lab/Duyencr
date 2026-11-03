// Test lớp dữ liệu "phân loại Sale theo mốc ngày" (js/62-sale-channel-periods.js) — chạy: node tools/test-sale-channel-periods.js
var src = require('fs').readFileSync(__dirname + '/../js/62-sale-channel-periods.js', 'utf8');
function grab(n){ return src.match(new RegExp('function ' + n + '[\\s\\S]*?\\n}\\n'))[0]; }
var SALE_CHANNELS = { A: 'online', B: 'offline' };
var SALE_CHANNEL_PERIODS = {};
var _cfgAliasesOf = function(n){ return n === 'A' || n === 'a.alias' ? ['A', 'a.alias'] : [n]; };
var _cfgByAlias = function(map, n){ var al = _cfgAliasesOf(n); for (var i = 0; i < al.length; i++){ var v = map[al[i]]; if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
var _saleChannelOf_ = function(n){ return _cfgByAlias(SALE_CHANNELS, n) || ''; };
var _allCSNames = function(){ return ['Biichnguyen1993', 'biichnguyen1993', 'Zed']; };
var _groupNamesByPerson = function(ns){ var m = {}, out = []; ns.forEach(function(n){ var k = n.toLowerCase(); if (!m[k]){ m[k] = { names: [], primary: n }; out.push(m[k]); } m[k].names.push(n); }); return out; };
eval(['_scpNorm_', '_scpListOf_', '_saleChannelOn_', '_scpEndOf_', '_scpSet_', '_scpGroupNames_', '_scpGroupListOf_'].map(grab).join('\n'));
var fails = 0; function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)){ fails++; console.log('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } }

// Ví dụ của Duyên: Sale A thử việc từ 10/09, chính thức (online) từ 11/10 (dd/MM) → 2026-09-10 / 2026-10-11
_scpSet_('A', [{ from: '2026-10-11', channel: 'online' }, { from: '2026-09-10', channel: 'probation' }]);   // nhập lộn thứ tự vẫn đúng
eq(SALE_CHANNEL_PERIODS.A.map(function(e){ return e.from; }), ['2026-09-10', '2026-10-11'], 'sắp theo ngày');
eq(_saleChannelOn_('A', '2026-09-10'), 'probation', 'đúng ngày bắt đầu TV');
eq(_saleChannelOn_('A', '2026-10-10'), 'probation', 'ngày cuối TV');
eq(_saleChannelOn_('A', '2026-10-11'), 'online', 'ngày đầu chính thức');
eq(_saleChannelOn_('A', '2026-12-31'), 'online', 'mốc cuối không hết hạn');
eq(_saleChannelOn_('A', '2026-09-09'), 'online', 'trước mốc đầu → phân loại hiện tại');
eq(_saleChannelOn_('A'), 'online', 'không ngày → phân loại hiện tại');
eq(_saleChannelOn_('a.alias', '2026-09-20'), 'probation', 'tra theo bí danh');
eq(_saleChannelOn_('B', '2026-09-20'), 'offline', 'sale không mốc → như cũ');
eq(_saleChannelOn_('Z', '2026-09-20'), '', 'sale chưa phân loại');
// Mốc channel '' = chủ động bỏ phân loại từ ngày đó
_scpSet_('B', [{ from: '2026-10-01', channel: '' }]);
eq(_saleChannelOn_('B', '2026-10-02'), '', 'mốc rỗng = chưa phân loại');
// Ngày hết hiệu lực hiển thị
var l = _scpListOf_('A');
eq(_scpEndOf_(l, 0), '2026-10-10', 'hết hiệu lực = trước mốc kế 1 ngày');
eq(_scpEndOf_(l, 1), '', 'mốc cuối không có ngày hết');
eq(_scpEndOf_([{ from: '2026-03-01' }, { from: '2026-03-01' }].slice(0, 1).concat([{ from: '2026-03-01' }]), 0), '2026-02-28', 'qua tháng 2');
// Dữ liệu rác / trùng ngày
eq(_scpNorm_([{ from: 'abc', channel: 'x' }, null, { from: '2026-01-01', channel: 'a' }, { from: '2026-01-01', channel: 'b' }]), [{ from: '2026-01-01', channel: 'b' }], 'lọc rác, trùng ngày lấy sau cùng');
// Xoá hết mốc → xoá khoá, ghi bằng tên khác của cùng người không để lại 2 danh sách
_scpSet_('a.alias', [{ from: '2026-05-01', channel: 'offline' }]);
eq(Object.keys(SALE_CHANNEL_PERIODS).filter(function(k){ return k === 'A' || k === 'a.alias'; }), ['a.alias'], 'dọn khoá bí danh');
_scpSet_('a.alias', []);
eq(SALE_CHANNEL_PERIODS['a.alias'], undefined, 'xoá hết mốc');
// Mốc không ngày (from rỗng) = từ trước đến nay, đứng đầu danh sách
_scpSet_('B', [{ from: '2026-11-01', channel: 'online' }, { from: '', channel: 'probation' }]);
eq(_scpListOf_('B').map(function(e){ return e.from; }), ['', '2026-11-01'], 'mốc không ngày đứng đầu');
eq(_saleChannelOn_('B', '2019-01-01'), 'probation', 'mốc không ngày áp dụng mọi ngày trước mốc kế');
eq(_saleChannelOn_('B', '2026-11-01'), 'online', 'đến mốc có ngày thì đổi');
eq(_scpEndOf_(_scpListOf_('B'), 0), '2026-10-31', 'mốc không ngày hết hiệu lực trước mốc kế');
// GOM THEO NGƯỜI: Biichnguyen1993 / biichnguyen1993 = 1 người → cài 1 lần, lưu dưới cả 2 tên, báo cáo tra tên nào cũng ra
eq(_scpGroupNames_('biichnguyen1993'), ['Biichnguyen1993', 'biichnguyen1993'], 'gom 2 tên hoa/thường');
eq(_scpGroupNames_('Zed'), ['Zed'], 'tên đơn');
eq(_scpGroupNames_('Khong co'), ['Khong co'], 'tên không có trong danh sách');
_scpSet_('Biichnguyen1993', [{ from: '2026-09-01', channel: 'online' }], _scpGroupNames_('Biichnguyen1993'));
eq(_saleChannelOn_('biichnguyen1993', '2026-09-05'), 'online', 'tra bằng tên thường');
eq(_saleChannelOn_('Biichnguyen1993', '2026-09-05'), 'online', 'tra bằng tên hoa');
eq(_scpGroupListOf_('biichnguyen1993').length, 1, 'đọc mốc theo nhóm');
_scpSet_('Biichnguyen1993', [], _scpGroupNames_('Biichnguyen1993'));
eq([SALE_CHANNEL_PERIODS['Biichnguyen1993'], SALE_CHANNEL_PERIODS['biichnguyen1993']], [undefined, undefined], 'xoá mốc xoá ở cả 2 tên');
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);

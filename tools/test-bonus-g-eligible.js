var src = require('fs').readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
var fn = src.match(/function _srGEligible_[\s\S]*?\n}\n/)[0];
var gb = src.match(/function _srGBuildGroups_[\s\S]*?\n}\n/)[0];
var CH = { a:'online', b:'offline', c:'probation', d:'cskh' };
var _saleChannelOf_ = function(n){ return CH[n] || ''; };
var PER = {};   // mốc ngày: { tên: [{from, channel}] }
var _saleChannelOn_ = function(n, d){ var l = PER[n]; if (!d || !l) return _saleChannelOf_(n); var h = null; l.forEach(function(e){ if (e.from <= d) h = e; }); return h ? h.channel : _saleChannelOf_(n); };
var _computeBonusData_ = function(){ return { total: 100, bySale: ['a','b','c','d','x'].map(function(n){ return { name:n, total:20, items:[{program:'P',amount:20}] }; }) }; };
eval(fn + gb);
var g = _srGBuildGroups_([]);
var ok = g.total === 60 && g.tv.rows.length === 1 && g.ct.rows.length === 2 && g.skipped.join() === 'd,x';
// --- Sale đổi loại GIỮA KỲ (mốc ngày): Thử việc đến 2026-10-10, Online từ 2026-10-11 ---
PER = { p: [{ from: '2026-09-10', channel: 'probation' }, { from: '2026-10-11', channel: 'online' }] };
CH.p = 'online'; CH.q = 'online';
_computeBonusData_ = function(){ return { total: 90, bySale: [
  { name: 'p', total: 90, items: [{ program: 'A', amount: 10, date: '2026-10-05' }, { program: 'A', amount: 30, date: '2026-10-10' }, { program: 'B', amount: 50, date: '2026-10-11' }] },
  { name: 'q', total: 20, items: [{ program: 'A', amount: 20, date: '2026-10-05' }] }   // q chưa có mốc, đang online
] }; };
var g2 = _srGBuildGroups_([]);
var p2 = g2.tv.rows.concat(g2.ct.rows).filter(function(r){ return r.name === 'p'; });
var ok2 = g2.tv.rows.length === 1 && g2.tv.rows[0].name === 'p' && g2.tv.rows[0].total === 40 && g2.tv.rows[0].items.length === 2 && g2.tv.rows[0].chan === 'probation' &&
  g2.ct.rows.length === 2 && p2.length === 2 && g2.ct.rows.filter(function(r){ return r.name === 'p'; })[0].total === 50 && g2.ct.rows.filter(function(r){ return r.name === 'p'; })[0].chan === 'online' &&
  g2.total === 110 && g2.tv.total === 40 && g2.ct.total === 70 && g2.programs.A.tvAmount === 40 && g2.programs.A.ctAmount === 20 && g2.programs.B.ctAmount === 50 && g2.skipped.length === 0;
if (!ok2){ console.log('FAIL period split ' + JSON.stringify(g2)); process.exit(1); }
console.log(ok ? 'ALL PASS' : 'FAIL ' + JSON.stringify(g)); process.exit(ok ? 0 : 1);

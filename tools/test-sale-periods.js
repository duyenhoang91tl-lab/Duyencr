// Test lịch sử phân loại/thưởng theo ngày từng sale (js/61-sale-periods.js)
var fs = require('fs'), vm = require('vm');
var ctx = { console: console, setTimeout: function(){}, toast: function(){}, esc: function(s){ return s; }, loadLS: function(){ return null; }, saveLS: function(){},
  SALE_GROUPS: [{key:'online',label:'Online'},{key:'offline',label:'Văn phòng'}], BONUS_PROGRAMS: [], SALE_CHANNELS: {},
  _cfgByAlias: function(map, n){ return map[n]; } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/../js/61-sale-periods.js', 'utf8') + '\nthis.SP = {at:_salePeriodAt_, grp:_salePeriodGroupOf_, pl:_salePeriodProgramList_, tv:_salePeriodTvStart_, val:_spValidate_, sum:_spSummary_, set:function(o){ SALE_PERIODS = o; }};', ctx);
var SP = ctx.SP, fails = [];
function eq(a, b, m){ if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(m + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }
SP.set({ A: [ {from:'2026-09-10', to:'2026-10-10', group:'probation', programs:['tv1']}, {from:'2026-10-11', to:'', group:'online', programs:[]} ] });
eq(SP.grp('A','2026-09-09',''), '', 'truoc TV -> dung phan loai cu');
eq(SP.grp('A','2026-09-10',''), 'probation', 'ngay dau TV');
eq(SP.grp('A','2026-10-10',''), 'probation', 'ngay cuoi TV');
eq(SP.grp('A','2026-10-11',''), 'online', 'ngay dau chinh thuc');
eq(SP.grp('A','2026-12-31',''), 'online', 'chinh thuc mo');
eq(SP.pl('A','2026-09-15'), ['tv1'], 'CT gan rieng trong TV');
eq(SP.pl('A','2026-10-20'), null, 'chinh thuc khong gan CT -> theo doi tuong');
eq(SP.pl('B','2026-10-20'), null, 'sale khong co giai doan');
eq(SP.tv('A'), '2026-09-10', 'ngay bat dau TV du phong');
eq(SP.grp('A','',''), 'online', 'khong ngay -> giai doan hom nay (sau 2026-10-11)');
eq(SP.val([{from:'2026-09-10',to:'2026-10-10',group:'x'},{from:'2026-10-10',to:'',group:'y'}]) !== '', true, 'chong ngay bi chan');
eq(SP.val([{from:'2026-09-10',to:'2026-10-10',group:'x'},{from:'2026-10-11',to:'',group:'y'}]), '', 'lien ke hop le');
eq(SP.val([{from:'2026-09-10',to:'',group:''}]) !== '', true, 'thieu doi bi chan');
eq(SP.sum('A'), 'Thử việc 10/09/2026→10/10/2026 | Online 11/10/2026 → nay', 'tom tat');
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'ALL PASS'); process.exit(fails.length ? 1 : 0);

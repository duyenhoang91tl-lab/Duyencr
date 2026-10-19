// Dòng "Theo Sale" chỉ giữ người đã chọn (đồng bán không thuộc bộ lọc bị ẩn)
var src = require('fs').readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
var m = src.match(/function _srKeepSelectedSales_[\s\S]*?\n}\n/);
var _srState = { byCreator: false };
var _personAliases = function(n){ return n === 'anh' ? ['anh', 'anh2'] : [n]; };
eval(m[0].replace('function _srKeepSelectedSales_', 'var K = function'));
var rows = [{name:'anh'},{name:'Mến'},{name:'Kế toán 1'},{name:'ANH2'},{name:'dũng'}];
var out = K(rows, ['anh','Dung']).map(function(r){return r.name;});
var ok = JSON.stringify(out) === JSON.stringify(['anh','ANH2','dũng']);
_srState.byCreator = true; ok = ok && K(rows, ['anh']).length === 5;
_srState.byCreator = false; ok = ok && K(rows, []).length === 5;
console.log(ok ? 'ALL PASS' : 'FAIL ' + JSON.stringify(out)); process.exit(ok ? 0 : 1);

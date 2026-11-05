// Test: nâng cấp CT Tỳ hưu cũ (từ khoá không khớp Pos, chưa loại chất liệu) -> bản mới; đếm đúng SL; idempotent.
var fs=require('fs'), vm=require('vm');
var src=fs.readFileSync(__dirname+'/../js/12-fn-rendersalesreporttabe.js','utf8');
function grab(name){ var i=src.indexOf('function '+name+'('); var d=0,j=src.indexOf('{',i); for(var k=j;k<src.length;k++){ if(src[k]=='{')d++; else if(src[k]=='}'){d--; if(!d){ return src.slice(i,k+1);} } } }
var code='var _BP_TYHUU_EXCLUDE_='+JSON.stringify(src.match(/var _BP_TYHUU_EXCLUDE_ = '([^']+)'/)[1])+';'+grab('_bpUpgradeTyHuu_')+grab('_bonusProductQty_');
var ctx={}; vm.createContext(ctx); vm.runInContext(code,ctx);
var arr=[{name:'Tỳ Hưu Thiên Lộc Moon',product:'Tỳ hưu thiên lộc Moon, Thiên Lộc Moon, THMoon',bonusAmount:10000},
 {name:'Tỳ Hưu Thiên Lộc Tourmaline (Hồng/Xanh)',product:'Tourmaline Hồng, Tourmaline Xanh',bonusAmount:8000},
 {name:'Tỳ Hưu Thiên Lộc Aquamarine',product:'Aquamarine',bonusAmount:8000},
 {name:'Đơn từ 20tr',product:''}];
var n=ctx._bpUpgradeTyHuu_(arr); var bad=0; function ok(c,m){ if(!c){bad++;console.log('FAIL',m);} }
ok(n===3,'nâng cấp 3 CT, got '+n); ok(ctx._bpUpgradeTyHuu_(arr)===0,'idempotent'); ok(arr[3].product==='','CT khác không đổi'); ok(arr[0].bonusAmount===10000,'giữ tiền');
var q=function(p,sp,sl){ return ctx._bonusProductQty_(sp,p.product,sl,p.excludeProduct).qty; };
ok(q(arr[0],'TỲ HƯU THIÊN LỘC MOON NHẪN','1')===1,'Moon 1 dòng (không đếm đôi)');
ok(q(arr[1],'NHẪN TỲ HƯU THIÊN LỘC TOUR, VÒNG X','2,1')===2,'Tour theo SL');
ok(q(arr[2],'TỲ HƯU THIÊN LỘC AQUA','1')===1,'Aqua');
ok(q(arr[1],'TỲ HƯU THIÊN LỘC TOUR RUBY','1')===0,'loại Ruby');
ok(q(arr[2],'TỲ HƯU THIÊN LỘC AQUA NGỌC LAM','1')===0,'loại Ngọc Lam');
console.log(bad?('FAILED '+bad):'PASS test-bp-upgrade-tyhuu'); process.exit(bad?1:0);

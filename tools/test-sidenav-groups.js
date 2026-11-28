// Test: nhóm menu (js/29-sidenav.js GROUPS) — tách "🎨 Giao diện & trợ giúp" khỏi Settings mà KHÔNG mất/trùng mục nào.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('js/29-sidenav.js', 'utf8');
const i = src.indexOf('var GROUPS = ['), j = src.indexOf('];', i) + 2;
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
const G = vm.runInContext('GROUPS', ctx);
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
// toàn bộ id có ở bản cũ (trước khi tách) — không được mất mục nào
const BEFORE = ['act:notif','overview','tab-kh','taodon','crmorders','ticket','kenhboard','care2','stageboard','combo','tab-schedule','tab-overdue','tab-mydata','tab-task','act:profile','tab-chat','tab-teamchat','tab-media','plib','act:kho','tab-zaloai','act:bc','act:bct','act:bcstat','act:futpl','act:bday','act:conndiag','salesreport','topsp','pancake','kpipancake','mktchecklist','dailybrief','dashboard','act:fureport','act:teamai','act:assign','act:autoassign','act:assignhist','act:leadassign','act:leadreport','team','act:salematch','act:pancakemap','act:ordersale','act:splitextra','act:acct','uploaddata','act:upload','act:sync','act:fullsync','act:dup','act:roles','act:dept','act:help','act:theme','act:sakura','act:mascot','act:garden','act:errlog','config','act:cstatus','act:khstatus','act:cfield','act:tier','act:promo','audit','act:clear','act:taskflow'];
const all = [].concat(...G.map(g => g.ids));
ok(BEFORE.every(id => all.includes(id)), 'không mất mục nào so với bản cũ');
ok(new Set(all).size === all.length, 'không mục nào nằm trong 2 nhóm');
ok(all.length === BEFORE.length, 'không thêm mục lạ (' + all.length + ' = ' + BEFORE.length + ')');
const ui = G.find(g => g.k === 'ui'), st = G.find(g => g.k === 'st');
ok(ui && ['act:theme', 'act:help', 'act:sakura', 'act:mascot', 'act:garden'].every(id => ui.ids.includes(id)), 'nhóm Giao diện & trợ giúp có chế độ tối, hướng dẫn, cánh đào, linh vật, vườn');
ok(st && !['act:theme', 'act:help', 'act:sakura', 'act:mascot', 'act:garden'].some(id => st.ids.includes(id)), 'Settings không còn mục giao diện');
ok(G[G.length - 1].k === 'st', 'Settings vẫn là nhóm CUỐI (mục chưa khai báo dồn vào đây)');
ok(G.findIndex(g => g.k === 'ui') < G.findIndex(g => g.k === 'st'), 'Giao diện đứng trước Settings');
// các mục này mọi vai trò dùng được (open:true) — không bị lọc theo admin
const am = src.match(/var ACTS = \{[\s\S]*?\n  \};/)[0];
['theme', 'help', 'sakura', 'mascot', 'garden'].forEach(k => ok(new RegExp(k + ':\\s*\\{[^\\n]*open:true').test(am), 'act:' + k + ' mọi vai trò dùng được (open:true)'));
console.log(fail ? fail + ' lỗi' : 'TẤT CẢ OK'); process.exit(fail ? 1 : 0);

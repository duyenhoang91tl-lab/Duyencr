// Test 2 mốc sale thử việc: Ngày vào (joinDate) + Ngày nhận tin (startDate) + mốc thưởng sau 1 tháng. Chạy: node tools/test-acct-dates.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const js=fs.readFileSync(path.join(__dirname,'..','js/15-fn-hidelogin.js'),'utf8');
const m=js.match(/function _acctAddMonthsYmd[\s\S]*?\n}\nfunction _acctYmdToDmy[\s\S]*?\n}/);
const c={};vm.createContext(c);vm.runInContext(m[0],c);
let f=0;const ok=(a,b,t)=>{if(a!==b){console.log('FAIL',t,a,b);f++}else console.log('ok',t)};
ok(c._acctAddMonthsYmd('2026-10-09',1),'2026-11-09','9/10 -> 9/11');
ok(c._acctAddMonthsYmd('2026-01-31',1),'2026-02-28','31/01 -> 28/02');
ok(c._acctAddMonthsYmd('2026-12-16',1),'2027-01-16','qua nam');
ok(c._acctYmdToDmy('2026-11-09'),'09/11/2026','dmy');
ok(c._acctAddMonthsYmd('',1),'','rong');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
ok(/USER_HEADERS\s*=\s*\[[^\]]*'startDate','joinDate'\]/.test(src),true,'header joinDate');
ok(/joinDate: v\[i\]\[10\]/.test(src)&&/o\.joinDate = u\.joinDate/.test(src)&&/u\.joinDate\|\|''\]\)/.test(src),true,'doc/ghi/tra client');
process.exit(f?1:0);

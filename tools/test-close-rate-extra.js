// Test (2026-10-26): bieu do "Ty le chot theo Sale" co them % khach moi / % khach cu / khach TB moi ngay + dong "TB TOAN TEAM" tren cung.
// Chay: NODE_PATH=<noi cai jsdom> node tools/test-close-rate-extra.js
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');
const rd=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const j1=rd('js/01-fn-splitmulti.js'),j11=rd('js/11-fn-srload.js');
const a1=j1.indexOf('// ── Mốc màu "Tỷ lệ chốt" nhiều mức'),b1=j1.indexOf('async function _syncCloseRateThresholdsFromGAS');
const a3=j11.indexOf('function _srCloseRateBarHtml_'),b3=j11.indexOf('function _srCocTh()');
const w=new JSDOM('<body></body>',{runScripts:'dangerously'}).window;
Object.assign(w,{esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),currentUser:{role:'nv'},CLOSE_RATE_THRESHOLDS:null,_warnBox:()=>''});
w.eval(j1.slice(a1,b1)+j11.slice(a3,b3)+';CLOSE_RATE_THRESHOLDS=_crNormalize_(null);');
let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const rows=[
  {name:'An',held:100,closed:4,closeRate:4,khMoi:30,khCu:70,days:10,pctMoi:30,pctCu:70,perDay:12.5},
  {name:'Binh',held:300,closed:3,closeRate:1,khMoi:60,khCu:240,days:20,pctMoi:20,pctCu:80,perDay:16.5},
  {name:'Chi',held:50,closed:0,closeRate:0,khMoi:0,khCu:0,days:0,pctMoi:0,pctCu:0,perDay:0}];
w.__r=rows; const host=w.document.createElement('div'); w.document.body.appendChild(host);
host.innerHTML=w.eval('_srCloseRateBarHtml_(__r,"","tương tác")');
const txt=host.textContent, order=[...host.querySelectorAll('div')].map(d=>d.textContent);
ok(/TB TOÀN TEAM/.test(txt),'co dong TB TOAN TEAM');
ok(txt.indexOf('TB TOÀN TEAM')<txt.indexOf('An')&&txt.indexOf('TB TOÀN TEAM')<txt.indexOf('Binh'),'dong TB toan team nam TREN CUNG (truoc moi sale)');
ok(/% khách mới/.test(txt)&&/% khách cũ/.test(txt)&&/Khách\/ ngày/.test(txt),'co tieu de cot % khach moi / % khach cu / Khach/ngay');
const team=[...host.querySelectorAll('div')].find(d=>/^TB TOÀN TEAM/.test(d.textContent)&&d.children.length>=6);
const cells=[...team.children].map(c=>c.textContent);
ok(/^1\.6% \(7\/450\)$/.test(cells[2]),'team: ty le chot = tong don / tong tuong tac (ke ca sale 0 don) = 7/450 = 1.6% : '+cells[2]);
ok(cells[3]==='22.5%'&&cells[4]==='77.5%','team: % khach moi = 90/400 = 22.5%, % khach cu = 77.5% (gop so khach, khong lay TB cua %) : '+cells[3]+' '+cells[4]);
ok(cells[5]==='14.5','team: khach/ngay = TB cua cac sale co ngay (12.5 va 16.5) = 14.5 : '+cells[5]);
const an=[...host.querySelectorAll('div')].find(d=>d.children.length===6&&d.children[0].textContent==='An');
ok(an&&an.children[3].textContent==='30%'&&an.children[4].textContent==='70%'&&an.children[5].textContent==='12.5','dong An: 30% moi / 70% cu / 12.5 khach/ngay');
const chi=[...host.querySelectorAll('div')].find(d=>d.children.length===6&&d.children[0].textContent==='Chi');
ok(chi&&chi.children[3].textContent==='–'&&chi.children[5].textContent==='–','sale khong co ngay tuong tac -> hien "–" (khong bia so 0%)');
ok(!!host.querySelector('[style*="overflow-x:auto"]'),'bang co the cuon ngang tren dien thoai');
// bieu do theo Kenh/Page (khong co days) giu giao dien cu, khong co cot phu
host.innerHTML=w.eval('_srCloseRateBarHtml_([{name:"FB",held:100,closed:2,closeRate:2}],"","tương tác")');
ok(!/TB TOÀN TEAM/.test(host.textContent)&&!/% khách mới/.test(host.textContent)&&/FB/.test(host.textContent),'bieu do khong co du lieu khach moi/cu (Kenh/Page): giu nguyen kieu cu');
// tim nhanh van dung
host.innerHTML=w.eval('_srCloseRateBarHtml_(__r,"binh","tương tác")');
ok(/TB TOÀN TEAM/.test(host.textContent)&&!/An/.test(host.textContent.replace('TB TOÀN TEAM','')),'loc theo ten: team tinh tren cac dong dang hien');
console.log(bad?'\n'+bad+' LOI':'\nALL CLOSE-RATE-EXTRA TESTS PASSED');process.exit(bad?1:0);

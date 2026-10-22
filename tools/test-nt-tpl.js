// Test CRM: thong bao 'mau tin cho duyet' (kind tplpending) hien nhu su kien + bam mo Quan ly mau loc Cho duyet. Chay: node tools/test-nt-tpl.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','39-fn-notify.js'),'utf8');
const fn=n=>{const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}};
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const log=[];let hasFilter=false;const timers=[];
const btn={scrollIntoView:o=>log.push('scroll:'+o.block)};
const ctx={document:{querySelector:q=>{if(/data-bar-id="tab-zaloai"/.test(q))return{click:()=>log.push('tab')};if(/approveMsgTemplateUI/.test(q)){log.push('find:'+q);return btn}return null},getElementById:id=>id==='mt-status-filter'&&hasFilter?{}:null},
 mtShowPending:()=>log.push('pending'),loadMsgTemplates:()=>log.push('load'),_msgTemplates:[],setTimeout:(f,ms)=>timers.push(f),toast:()=>{}};
vm.createContext(ctx);vm.runInContext(fn('_ntIsTaskEvt')+'\n'+fn('_ntTaskIcon')+'\n'+fn('_ntOpenTpl_')+';this.a={evt:_ntIsTaskEvt,icon:_ntTaskIcon,open:_ntOpenTpl_};',ctx);
t('tplpending hien nhu su kien (text day du, khong "da nhac ban")',ctx.a.evt({kind:'tplpending'})===true&&ctx.a.evt({kind:'note'})===false&&ctx.a.evt({kind:'chatviolation'})===true);
t('co bieu tuong rieng',ctx.a.icon({kind:'tplpending'})!=='\u2022'&&ctx.a.icon({kind:'tplpending'}).length>0&&ctx.a.icon({kind:'tplpending'})!==ctx.a.icon({kind:'zzz'}));
hasFilter=false;ctx.a.open('mt_1_2');
t('chuyen sang tab Zalo AI, cho khung quan ly mau chua co -> doi (thu lai)',log[0]==='tab'&&timers.length===1&&!log.includes('pending'));
hasFilter=true;timers.shift()();   // lan thu lai: da co khung
t('khung da co: tai mau (neu chua co) roi loc Cho duyet',log.includes('load')&&timers.length===1);
timers.shift()();
t('loc Cho duyet + cuon toi dung mau (id da lam sach ky tu la)',log.includes('pending')&&log.some(x=>x==='scroll:center')&&log.some(x=>x.indexOf("approveMsgTemplateUI('mt_1_2'")>0));
log.length=0;timers.length=0;ctx.a.open("x'\"y");for(let i=0;i<5&&timers.length;i++)timers.shift()();
t('id co ky tu nguy hiem khong pha selector',!log.some(x=>/x'"y/.test(x)));
console.log(fail?('FAILED '+fail):'ALL NT TPL TESTS PASSED');process.exit(fail?1:0);

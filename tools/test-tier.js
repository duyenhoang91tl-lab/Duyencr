// Test P1b: _aaHangKey_ (GAS) doc tierConfig; mac dinh = hanh vi cu; cau hinh sai -> mac dinh. Doi chieu voi client _tierNormalize.
const fs=require('fs'),vm=require('vm'),path=require('path');
const g=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const a=g.indexOf('var _TIER_DEFAULT_'),b=g.indexOf('function _aaHangKey_')+g.slice(g.indexOf('function _aaHangKey_')).indexOf('\n}\n')+3;
function run(setting){const ctx={JSON,Array,Number,String,isFinite,getSetting_:()=>setting};vm.createContext(ctx);vm.runInContext(g.slice(a,b),ctx);return r=>ctx._aaHangKey_(r);}
const old=r=>r>=5e7?'super':r>=3e7?'vip':r>=15e6?'tt':'thuong';
let bad=0;const def=run('');
[0,1,14999999,15e6,29e6,3e7,49e6,5e7,9e9,'x',null].forEach(r=>{if(def(r)!==old(Number(r)||0)){bad++;console.log('LECH',r);}});
const cfg=JSON.stringify([{key:'thuong',label:'A',min:0},{key:'tt',label:'B',min:1e7},{key:'vip',label:'C',min:2e7},{key:'super',label:'D',min:4e7}]);
const c=run(cfg);console.log('cfg',[9e6,1e7,25e6,4e7].map(c).join(','));
['[]','not json',JSON.stringify([{key:'thuong',min:0},{key:'tt',min:5},{key:'vip',min:3},{key:'super',min:9}])].forEach(s=>{const f=run(s);if(f(16e6)!=='tt'||f(1e6)!=='thuong'){bad++;console.log('sai khong ve mac dinh',s);}});
console.log(bad?'FAIL':'OK');process.exit(bad?1:0);

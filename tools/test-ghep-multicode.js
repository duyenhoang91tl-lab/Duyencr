// Test (2026-10-24, buoc 4): ghi chu Pos "681T10 + 937T10/2026" = 2 don Base; 2 sale khac nhau => chia theo TUNG don Base (A don 1, B don 2) du the Pos gan ca 2. Ham THAT trong gas_v13.js.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync(__dirname+'/../gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thieu '+name);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'&&--d===0)return src.slice(i,k+1)}}
const line=n=>{const i=src.indexOf(n);return src.slice(i,src.indexOf('\n',i))};
const code=[line('var COUNTER_CODE_INNER_ ='),line('var COUNTER_CODE_RE_SRC_ ='),line('function _normCounterCode_('),line('function _counterCodeNoYear_('),line('function _isNumericTag_(')].join('\n')+'\n'+
 ['_counterCodeHasYear_','_extractCounterCodes_','_splitBhCodes_','_pickBaseRowsForCode_','_resolveGhepDon_'].map(fn).join('\n');
const ctx={RegExp,String,Object,Number,Math,Date,_isExcludedOrderStatus_:t=>/huy|hoan/i.test(String(t||'')),parseVNDate_:()=>null,_vnYmd_:()=>'',_normTxt_:s=>String(s||'').toLowerCase().trim()};
vm.createContext(ctx);vm.runInContext(code,ctx);
const note='681T10 + 937T10/2026';
const codes=ctx._splitBhCodes_(ctx._extractCounterCodes_(note)).normal;
ok(JSON.stringify(codes)==='["681T10","937T10/2026"]','ghi chu "681T10 + 937T10/2026" tach dung 2 ma (ma 1 khong ghi nam)');
const r1={rowIndex:10,trangThai:'Thành công',saleBan:'saleA',creator:'x',ngayTao:'',giaTriDon:1000000,code:'681T10/2026'},r2={rowIndex:11,trangThai:'Thành công',saleBan:'saleB',creator:'x',ngayTao:'',giaTriDon:2000000,code:'937T10/2026'};
const idx={exact:{'937T10/2026':[r2]},fuzzy:{'681T10':[r1]}};
let g=ctx._resolveGhepDon_(codes,idx,{},3000000,['saleA','saleB']);
ok(g.status==='ok'&&g.baseRows===2&&g.shares.length===2,'2 don Base khac sale => ghep OK, 2 nguoi chia');
const fr=n=>g.shares.find(x=>x.name===n).frac;
ok(Math.abs(fr('saleA')-1/3)<1e-9&&Math.abs(fr('saleB')-2/3)<1e-9,'saleA chi nhan don 1 (1/3), saleB chi nhan don 2 (2/3) — KHONG chia deu theo the Pos');
// the Pos gan them nguoi thu 3 khong co tren Base va gia Pos = tong Base => khong nhan tien
g=ctx._resolveGhepDon_(codes,idx,{},3000000,['saleA','saleB','saleC']);
ok(g.shares.length===2&&!g.shares.some(x=>x.name==='saleC'),'the Pos gan thua saleC (khong co tren Base): khong nhan tien khi gia Pos = tong don Base');
// gia Pos > tong Base (>1000d): phan du chia deu cho the Pos (quy tac 2026-10-21) — ghi nhan hanh vi hien tai
g=ctx._resolveGhepDon_(codes,idx,{},3500000,['saleA','saleB']);
ok(g.remainder===500000,'phan du 500.000 chia deu theo the Pos (hanh vi cu, khong doi)');
ok(Math.abs(g.shares.reduce((a,x)=>a+x.frac,0)-1)<1e-9,'tong ty le chia = 1 ke ca khi co phan du');
// 1 ma khong ra don Base => khongKhop (roi ve chia theo the Pos) — khong ghep 1 phan
g=ctx._resolveGhepDon_(codes,{exact:{'937T10/2026':[r2]},fuzzy:{}},{},3000000,['saleA','saleB']);
ok(g.status==='khongKhop'&&g.missing.join()==='681T10','thieu 1 ma tren Base => khongKhop, bao ma thieu (681T10)');
// 1 ma Base da dung cho don Pos khac => trungDonGoc
const used={};ctx._resolveGhepDon_(codes,idx,used,3000000,['saleA','saleB']);
ok(ctx._resolveGhepDon_(codes,idx,used,3000000,['saleA','saleB']).status==='trungDonGoc','don Base da gan cho don Pos khac => trungDonGoc (khong cong doi doanh thu)');
// 2 don Base CUNG sale => 1 nguoi => khong phai don chia (dung quy tac)
const r3=Object.assign({},r2,{saleBan:'saleA'});
g=ctx._resolveGhepDon_(codes,{exact:{'937T10/2026':[r3]},fuzzy:{'681T10':[r1]}},{},3000000,['saleA','saleB']);
ok(g.shares.length===1&&g.shares[0].name==='saleA'&&g.shares[0].frac===1,'2 don Base cung 1 sale => 1 nguoi nhan 100%');
// STT so (8, 13) tren Base khong thanh sale
const r4=Object.assign({},r1,{saleBan:'saleA, 8, 13'});
g=ctx._resolveGhepDon_(codes,{exact:{'937T10/2026':[r2]},fuzzy:{'681T10':[r4]}},{},3000000,['saleA','saleB']);
ok(g.shares.map(x=>x.name).sort().join()==='saleA,saleB','sale ban tren Base "saleA, 8, 13": 8 va 13 la STT, khong thanh sale');
// Cong tac don 1 ma (Settings POS_GHEP_MIN_CODES): mac dinh 2; chi '1' moi bat
let setv=null;const mk=()=>new Function('getSetting_','POS_GHEP_MIN_CODES_','let _posGhepMinMemo_ = null;\n'+fn('_posGhepMinCodes_')+'\nreturn _posGhepMinCodes_;')(()=>{if(setv==='THROW')throw new Error('x');return setv},2);
const mc=()=>mk()();
ok(mc()===2,'khong cai Settings -> 2 (quy tac cu, so lieu khong doi)');
setv='1';ok(mc()===1,'Settings POS_GHEP_MIN_CODES=1 -> don 1 ma cung ghep Base');
setv=' 1 ';ok(mc()===1,'chiu khoang trang');
setv='0';ok(mc()===2,'gia tri la (0) -> van 2 (khong cho ghep ca don 0 ma)');setv='abc';ok(mc()===2,'gia tri sai -> 2');
setv='THROW';ok(mc()===2,'loi doc Settings -> 2, khong lam hong bao cao');
// Cache khoa + memo + quyen ghi (giao dien bat/tat, 2026-10-24)
{ let calls=0,val=null; const mk2=()=>new Function('getSetting_','POS_GHEP_MIN_CODES_','Utilities','JSON','let _posGhepMinMemo_ = null;\n'+fn('_posGhepMinCodes_')+'\n'+fn('_reportCacheKey_')+'\nreturn {k:_reportCacheKey_,m:_posGhepMinCodes_};')(()=>{calls++;return val},2,{computeDigest:()=>[],DigestAlgorithm:{MD5:1},Charset:{UTF_8:1}},JSON);
  val=null;let A=mk2();ok(A.k('splitdet2_',{a:1})==='splitdet2_{"a":1}','cong tac TAT: khoa cache giu nguyen (khong lam mat cache cu)');
  val='1';calls=0;A=mk2();ok(A.k('splitdet2_',{a:1})==='splitdet2_g1_{"a":1}','cong tac BAT: khoa cache doi (g1_) => bat/tat co hieu luc NGAY');
  A.k('x',{});A.k('y',{});A.m();ok(calls===1,'doc Settings 1 lan / lan chay (memo): '+calls);
  ok(/'POS_GHEP_MIN_CODES'\)\) \{ var _bizDen/.test(src),'setSetting POS_GHEP_MIN_CODES chi Admin (di qua _bizRulesWriteDenied_)'); }
console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0);

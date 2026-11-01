#!/usr/bin/env node
// Test TY LE CHOT THEO SALE: tu so = don Base cua NGUOI TAO (cot B) o kenh co Page Pancake; MAU SO = tuong tac CHI o Page da khop Kenh ban.
// Chay HAM THAT _srCloseRateSections_ (gas_v13.js), chi gia lop doc Google Sheet. Du lieu: 66 don Base NGAY 15/10/2026 (cot B + Kenh ban) do Duyen gui;
// tuong tac Pancake la DU LIEU GIA LAP (co Page 'NGUON' chua khop kenh de kiem tra mau so). Chay: node tools/test-close-rate-mapped.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const PAIRS=[["Thuydinh1995","Page HT3"],["Thuydinh1995","Page HT3"],["ninhnga99","HienPham tourmaline"],["trangNH2005","Page HT3"],["thuyha88","HienPham tourmaline"],["yenNTH2004","Page HT3"],["yenNTH2004","Page HT3"],["yenNTH2004","Page HT3"],["ninhnga99","Page HT3"],["anhTP1995","Page HT3"],["ninhnga99","Fb Phạm Thu Hiền"],["ninhnga99","Page HT3"],["Dungnguyen1995","Tiktok"],["thuyha88","Page HT3"],["ninhnga99","Fb Phạm Thu Hiền"],["anhTP1995","Page HT3"],["ninhnga99","Fb Phạm Thu Hiền"],["huyenmaii1990","Fb Phạm Thu Hiền"],["Trangnguyen1995","Zalo cá nhân"],["menbui2002","Zalo CSKH up cũ"],["anhNP1999","Page HT3"],["anhNP1999","Page HT3"],["anhNP1999","Page HT3"],["anhNP1999","Page HT3"],["huyenmaii1990","Fb Phạm Thu Hiền"],["ngocNB2003SALEOFF","Page HT3"],["lanVH1995","Bảo hành"],["Thuydinh1995","Page HT3"],["menbui2002","Zalo CSKH up"],["ngaTH1994","Zalo CSKH up"],["Myle1998","Zalo cá nhân"],["ninhnga99","Page HT3"],["huyenmaii1990","Fb Phạm Thu Hiền"],["ninhnga99","Page HT3"],["Thuydinh1995","Page HT3"],["phuongthao2000","Page HT3"],["phuongthao2000","Page HT3"],["huyenmaii1990","Page HT3"],["phuongthao2000","HienPham tourmaline"],["Myle1998","BH tại quầy"],["ninhnga99","Page HT3"],["Thuydinh1995","Page HT3"],["Thuydinh1995","Page HT3"],["Thuydinh1995","Page HT3"],["Thuydinh1995","HienPham tourmaline"],["Thuydinh1995","Page HT3"],["Thuydinh1995","Page HT3"],["huyenmaii1990","Page HT3"],["ninhLTK","Page HT3"],["trangNH2005","Page HT3"],["Trangnguyen1995","Zalo cá nhân"],["ninhnga99","Page HT3"],["Thuydinh1995","Page HT3"],["ngocNB2003SALEOFF","Page HT3"],["yenNTH2004","Page HT3"],["phuongthao2000","Page HT3"],["tuhoang88","Bảo hành"],["yenNTH2004","Page HT3"],["trangNH2005","Page HT3"],["tuhoang88","Bảo hành"],["trangNH2005","Page HT3"],["huyenmaii1990","Zalo cá nhân"],["tuhoang88","Bảo hành"],["trangNH2005","Page HT3"],["trangNH2005","Page HT3"],["anhTP1995","Page HT3"]];   // [nguoiTao, kenhBan] cua 66 don Base ngay 15/10/2026
let fail=0; const ok=(c,m)=>{ if(!c){console.log('FAIL:',m);fail++;} else console.log('ok  :',m); };
const SALES=['ninhnga99','huyenmaii1990','Thuydinh1995','trangNH2005','yenNTH2004','anhNP1999','phuongthao2000','thuyha88','ngocNB2003saleoff','ninhLTK1984','anhtrinh1995'];
function load(opts){
  const ctx={console,Date,JSON,Math,parseInt,parseFloat,isNaN,String,Object,Array,RegExp,Number,Logger:{log(){}}};
  vm.createContext(ctx); vm.runInContext(src,ctx);
  const D='2026-10-15';
  // sale -> [HT3, TM, NGUON]  (NGUON = Page chua khop Kenh ban)
  const I={ninhnga99:[120,30,53],huyenmaii1990:[150,40,23],Thuydinh1995:[200,30,9],trangNH2005:[100,40,28],yenNTH2004:[120,50,6],anhNP1999:[90,40,3],phuongthao2000:[150,60,9],
    thuyha88:[120,60,6],ngocNB2003saleoff:[30,14,0],ninhLTK1984:[40,20,0],anhtrinh1995:[100,60,8]};
  const rows=[]; Object.keys(I).forEach(n=>{ [['P_HT3','Phạm Thu Hiền - Hiền Tour'],['P_TM','Hiền Phạm Tourmaline'],['P_NGUON','NGUỒN']].forEach((p,i)=>{ if(I[n][i]) rows.push([D,p[0],p[1],n,0,0,I[n][i],0,0,0,0,0,0]); }); });
  ctx.__rows=rows; ctx.__pm=opts.pageMap; ctx.__hid=opts.hiddenSales||[];
  vm.runInContext(`
    _pkStatsRowsMemo_=function(){return __rows;};
    readPancakePageMap_=function(){return __pm;};
    readPancakeMap_=function(){return {};};
    _hiddenPageSaleSets_=function(){return {channels:[],sales:__hid};};
    _userAliasGroups_=function(){return {};};
    readSaleDirectory_=function(){return {list:[],byName:{}};};
    _pkReportMemoCache_=null; _pkStatsRowsMemoCache_=null;`,ctx);
  return ctx;
}
// Nguoi tao nao la sale da biet (co trong Pancake) -> giu ten; con lai -> '' (don vao "(chua gan sale)") — giong _srCloseRateSectionsFromBase_
const alias={'ninhltk':'ninhLTK1984','ngocnb2003saleoff':'ngocNB2003saleoff'};
const knownL=new Set(SALES.map(s=>s.toLowerCase()));
function run(opts){
  const ctx=load(opts);
  const norm=PAIRS.map(([c,k])=>{ const l=c.toLowerCase(); const n=alias[l]||c; return {kenhBan:k,dateStr:'15/10/2026',saleBanRaw:knownL.has(n.toLowerCase())?n:''}; });
  ctx.__norm=norm; ctx.__f={dateFrom:'2026-10-15',dateTo:'2026-10-15'};
  return vm.runInContext('_srCloseRateSections_(__norm,__f)',ctx);
}
const PM={P_HT3:'Page HT3',P_TM:'HienPham tourmaline'};   // P_NGUON KHONG khop kenh
const r=run({pageMap:PM}); const by={}; r.saleCloseRate.forEach(x=>by[x.name.toLowerCase()]=x);
// ── tu so: NGUOI TAO (cot B), chi kenh co Page Pancake ──
ok(by.ninhnga99.closed===7&&by.huyenmaii1990.closed===2,'tu so = don NGUOI TAO o kenh co Page: ninhnga99 = 6 Page HT3 + 1 tourmaline = 7; huyenmaii1990 = 2 (khop so tren bieu do Duyen gui)');
const pk=new Set(['Page HT3','HienPham tourmaline']); const exp={};
PAIRS.forEach(([c,k])=>{ if(!pk.has(k)) return; const l=c.toLowerCase(); const n=(alias[l]||c).toLowerCase(); if(knownL.has(n)) exp[n]=(exp[n]||0)+1; });
ok(Object.keys(exp).every(k=>by[k]&&by[k].closed===exp[k]),'moi Sale: tu so khop dung so don Base cot B cua kenh co Page: '+JSON.stringify(exp));
// ── mau so: CHI Page da khop kenh ──
ok(by.ninhnga99.held===150&&by.huyenmaii1990.held===190,'mau so CHI tinh Page da khop kenh: ninhnga99 = 120+30 = 150 (khong cong 53 o Page NGUON); huyenmaii1990 = 190');
ok(by.ninhnga99.closeRate===4.7&&by.huyenmaii1990.closeRate===1.1,'ty le: ninhnga99 7/150 = 4.7% (truoc day 7/203 = 3.4%), huyenmaii1990 2/190 = 1.1% (truoc 2/213 = 0.9%)');
const exclExpected=53+23+9+28+6+3+9+6+8;
ok(r.closeExcluded&&r.closeExcluded.tongTT===exclExpected&&r.closeExcluded.pages.length===1&&r.closeExcluded.pages[0].pageName==='NGUỒN','closeExcluded bao dung phan tuong tac o Page chua khop: '+(r.closeExcluded&&r.closeExcluded.tongTT)+' (Page NGUON)');
// ── nhat quan voi bang Sale x Page va bang theo Kenh ──
const sp={}; r.saleCloseByPage.rows.forEach(x=>sp[x.name.toLowerCase()]=x.total);
ok(['ninhnga99','huyenmaii1990','thuydinh1995','trangnh2005'].every(k=>sp[k]&&sp[k].held===by[k].held&&sp[k].closed===by[k].closed),'bang theo Sale = bang Sale x Page (cung mau so + tu so) cho cung 1 Sale');
const kenh={}; r.kenhCloseRate.forEach(x=>kenh[x.name]=x);
const sumHeldSale=r.saleCloseRate.reduce((a,x)=>a+x.held,0);
ok(Math.abs(sumHeldSale-(kenh['Page HT3'].held+kenh['HienPham tourmaline'].held))<0.5,'tong mau so theo Sale = tong mau so theo Kenh (Page HT3 + tourmaline) = '+sumHeldSale);
ok(by['(chưa gán sale)']&&by['(chưa gán sale)'].closed>=3,'don cua nguoi tao khong phai sale (anhTP1995...) van vao "(chua gan sale)", khong tinh cho sale nao');
// ── khong khop Page nao -> giu cach cu (tat ca Page), khong ra toan 0 ──
const r0=run({pageMap:{}}); const b0={}; r0.saleCloseRate.forEach(x=>b0[x.name.toLowerCase()]=x);
ok(b0.ninhnga99.held===203&&r0.closeExcluded===null,'chua khop Page nao -> mau so = tat ca Page (203) nhu cu, khong bao loai (tranh ra 0)');
// ── Sale bi an ──
const rh=run({pageMap:PM,hiddenSales:['huyenmaii1990']}); const hh=rh.saleCloseRate.find(x=>x.name.toLowerCase()==='huyenmaii1990'); ok(!hh||hh.held===0,'Sale bi an (hiddenSales): tuong tac KHONG bi tinh vao mau so (dong con lai tu phia don hang giu nhu cu, held=0)');
ok(by.anhtrinh1995&&by.anhtrinh1995.held===160&&by.anhtrinh1995.closed===0,'anhtrinh1995: mau so 160, tu so 0 (don dang ghi ten nguoi tao anhTP1995 chua duoc gop ten)');
console.log(fail?('\n'+fail+' FAIL'):'\nALL PASS'); process.exit(fail?1:0);

#!/usr/bin/env node
// Test: cac dong canh bao trong bao cao MAC DINH AN, bam 👁 moi hien (js/10 _warnBox/_warnToggle). Chay: node tools/test-warn-eye.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const rd=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const j10=rd('js/10-fn-pkkpipct.js'), j11=rd('js/11-fn-srload.js');
let fail=0; const ok=(c,m)=>{ if(!c){console.log('FAIL:',m);fail++;} else console.log('ok  :',m); };
const a=j10.indexOf('var _warnOpen'), b=j10.indexOf('function _pkKpiPct')>=0? j10.indexOf('// ═══ CẢNH BÁO'):0;
const src=j10.slice(j10.indexOf('var _warnOpen'), j10.indexOf('\n}\n', j10.indexOf('function _warnToggle'))+3);
const ctx={}; vm.createContext(ctx); vm.runInContext(src,ctx);
const box='<div class="x">⚠️ 262 đơn chưa gán</div>';
let h=ctx._warnBox('k1',box,'262 đơn chưa gán');
ok(/class="warn-body" style="display:none/.test(h),'mac dinh AN (display:none)');
ok(/👁 262 đơn chưa gán/.test(h)&&!/🙈/.test(h),'hien nut con mat + nhan ngan, khong hien noi dung canh bao');
ok(h.indexOf(box)>h.indexOf('warn-body'),'noi dung canh bao cu nam trong khung an (giu nguyen)');
ok(ctx._warnBox('k','', 'x')==='','khong co canh bao -> khong ve gi (khong nut thua)');
// mo phong bam
const body={style:{display:'none'}}, a1={parentNode:{querySelector:()=>body},getAttribute:k=>({'data-warn':'k1','data-label':'262 đơn chưa gán'})[k],textContent:''};
ctx._warnToggle(a1); ok(body.style.display==='block'&&/🙈 Ẩn/.test(a1.textContent),'bam 1 lan -> hien, nut doi thanh "An canh bao"');
h=ctx._warnBox('k1',box,'262 đơn chưa gán'); ok(/class="warn-body" style="display:block/.test(h),'ve lai bao cao: nho trang thai da mo (khong bi dong lai bat ngo)');
ctx._warnToggle(a1); ok(body.style.display==='none'&&/👁 262/.test(a1.textContent),'bam lan 2 -> an lai');
ok(/display:none/.test(ctx._warnBox('k2',box,'y')),'canh bao khac key van mac dinh an');
// moi noi tao canh bao deu da boc
const raw=[/html \+= '<div style="margin:0 0 14px;padding:8px 10px;background:#f/, /html \+= '<div style="margin-bottom:10px;padding:8px;background:#fff7ed/];
ok(!raw.some(r=>r.test(j10)),'js/10: khong con khung canh bao nao chen thang vao bao cao (khong qua _warnBox)');
ok(['kpi-warnings','kpi-unmapped-sales','kpi-unmapped-pages','kpi-dash-unmapped'].every(k=>j10.includes("_warnBox('"+k+"'")),'js/10: 4 canh bao deu qua _warnBox');
ok(/var orphanHtml = orphanBox_ \? _warnBox\('cr-orphan'/.test(j11)&&!/var orphanHtml = orphans\.length/.test(j11),'js/11: canh bao "don chua gan" (dong trong anh) qua _warnBox');
// Chay HAM THAT ve bieu do ty le chot voi du lieu giong anh (262 don chua gan: Chua doi soat 227, Giao khong thanh 16, ...)
(function(){
  const st=j11.indexOf('function _srCloseRateBarHtml_'); let depth=0,i=j11.indexOf('{',st),e=i;
  for(;e<j11.length;e++){ if(j11[e]==='{')depth++; else if(j11[e]==='}'){depth--; if(!depth)break;} }
  const fn=j11.slice(st,e+1);
  const c2={esc:s=>String(s),currentUser:{role:'staff'},CLOSE_RATE_THRESHOLDS:{levels:[]},_crColorFor_:()=>'#000',_srCrLegendHtml_:()=>'',_srCrFormHtml_:()=>''};
  vm.createContext(c2); vm.runInContext(src,c2); vm.runInContext(fn,c2);
  const rows=[{name:'Sale A',held:100,closed:30,closeRate:30},{name:'(Chưa đối soát)',held:0,closed:227,closeRate:0},{name:'(Giao không thành)',held:0,closed:16,closeRate:0},{name:'(chưa gán sale)',held:0,closed:7,closeRate:0},{name:'Đang giao hàng',held:0,closed:7,closeRate:0},{name:'nguyenngo1988',held:0,closed:2,closeRate:0},{name:'Anhnguyen1996',held:0,closed:1,closeRate:0},{name:'Hoàn một phần',held:0,closed:1,closeRate:0},{name:'Thuynguyen1987',held:0,closed:1,closeRate:0}];
  const out=c2._srCloseRateBarHtml_(rows,'','đơn');
  ok(/👁 262 đơn chưa gán vào tương tác Pancake/.test(out),'ham that: nut con mat ghi "262 don chua gan..." (tong dung nhu anh)');
  ok(/class="warn-body" style="display:none[^"]*"[^>]*>\s*<div[^>]*>⚠️ <b>262 đơn<\/b>/.test(out),'ham that: khung canh bao day du van co nhung dang AN');
  ok(/Sale A/.test(out)&&/Trung bình:/.test(out),'bieu do + trung binh van ve binh thuong');
  ok(!/warn-wrap/.test(c2._srCloseRateBarHtml_([{name:'Sale A',held:100,closed:30,closeRate:30}],'','đơn')),'khong co don mo coi -> khong ve nut');
})();
console.log(fail?('\n'+fail+' FAIL'):'\nALL PASS'); process.exit(fail?1:0);

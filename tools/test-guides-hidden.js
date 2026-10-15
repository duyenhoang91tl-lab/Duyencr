#!/usr/bin/env node
// Test: loi huong dan/nhac nho cach dung MAC DINH AN (class guide-text + cong tac o ❓ Huong dan su dung). Chay: node tools/test-guides-hidden.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const rd=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
let fail=0; const ok=(c,m)=>{ if(!c){console.log('FAIL:',m);fail++;} else console.log('ok  :',m); };
const files=['index.html',...fs.readdirSync(path.join(__dirname,'..','js')).filter(f=>f.endsWith('.js')).map(f=>'js/'+f)];
// 1) moi phan tu guide-text: the hop le + noi dung KHONG phai canh bao/trang thai trong
let total=0,badText=[],badTag=[];
for(const f of files){
  const t=rd(f), re=/<(div|span|p|small|label)\b[^>]*\bclass=\\?"[^"\\]*\bguide-text\b[^"\\]*\\?"[^>]*>/g; let m;
  while((m=re.exec(t))){
    total++;
    const rest=t.slice(m.index+m[0].length, m.index+m[0].length+400).replace(/^[\s'+\\n]*/,'');
    const txt=rest.replace(/<[^>]*>/g,'').trim();
    if(/^(⚠|Chưa |Không có|Đang )/.test(txt) && !/^Chưa chọn nguồn = /.test(txt)) badText   /* 'Chua chon nguon = ...' la loi GIAI THICH y nghia o chon, khong phai trang thai trong */.push(f+': '+txt.slice(0,50));
    if(!/<\/(div|span|p|small|label)>/.test(t.slice(m.index,m.index+900))) badTag.push(f+': '+m[0].slice(0,50));
  }
}
ok(total>=40,'da gan guide-text cho '+total+' loi huong dan (>=40)');
ok(badText.length===0,'khong gan nham vao canh bao ⚠ / cau trang thai "Chua co...": '+JSON.stringify(badText));
ok(badTag.length===0,'moi phan tu guide-text deu co the dong (HTML khong vo): '+JSON.stringify(badTag));
// 2) CSS
const css=rd('css/01-base.css');
ok(/body:not\(\.show-guides\) \.guide-text[\s\S]{0,200}display:none !important/.test(css),'CSS an .guide-text khi body khong co show-guides');
ok(['task-form-hint','tf-hint','srb-m-hint','pro-ai-hint'].every(c=>new RegExp('body:not\\(\\.show-guides\\) \\.'+c).test(css)),'CSS an them cac class hint co san');
// 3) cong tac
const store={}; const cls=new Set();
const ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=v;}},document:{body:{classList:{toggle:(c,on)=>{on?cls.add(c):cls.delete(c);}}},getElementById:()=>null,documentElement:{setAttribute(){}}}};
vm.createContext(ctx);
const u=rd('js/43-fn-uxtools.js');
const src=u.slice(u.indexOf('function _guidesOn'),u.indexOf('applyGuides();\n')+'applyGuides();\n'.length);
vm.runInContext(src,ctx);
ok(!cls.has('show-guides')&&ctx._guidesOn()===false,'mac dinh: AN (chua co show-guides)');
ctx.setGuides(true); ok(cls.has('show-guides')&&store.ome_show_guides==='1','bat -> body.show-guides + luu localStorage');
ctx.applyGuides(); ok(cls.has('show-guides'),'nap lai trang van nho trang thai bat');
ctx.setGuides(false); ok(!cls.has('show-guides')&&store.ome_show_guides==='0','tat -> an lai');
// 4) man Huong dan co o cong tac
let captured=''; const c2={esc:x=>String(x),localStorage:ctx.localStorage,document:ctx.document,_HELP_ITEMS:[['A','b']],_uxModal:(id,t,h)=>{captured=h;}};
vm.createContext(c2); vm.runInContext(src+u.slice(u.indexOf('function openHelpModal'),u.indexOf('\n}\n',u.indexOf('function openHelpModal'))+3),c2);
c2.openHelpModal(); ok(/setGuides\(this\.checked\)/.test(captured)&&/Hiện lời hướng dẫn/.test(captured)&&!/ checked /.test(captured),'man Huong dan co o "Hien loi huong dan" (mac dinh chua tich)');
// 5) cac cau trang thai/canh bao van con nguyen (khong bi an)
ok(/Chưa nạp báo cáo tương tác Pancake ngày nào — vào tab/.test(rd('js/11-fn-srload.js'))&&!/guide-text[^>]*>[^<]{0,5}Chưa nạp báo cáo/.test(rd('js/11-fn-srload.js')),'cau trang thai "Chua nap bao cao..." van hien');
console.log(fail?('\n'+fail+' FAIL'):'\nALL PASS'); process.exit(fail?1:0);

#!/usr/bin/env node
// Test client thong bao @tag (js/39-fn-notify.js) bang DOM gia: goi y @ten, chon bang phim, bam thong bao -> mo dung man hinh.
const fs=require('fs'),vm=require('vm');
const mkEl=()=>{const e={style:{},children:[],classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
  attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},removeAttribute(k){delete this.attrs[k]},
  addEventListener(){},appendChild(c){this.children.push(c)},getBoundingClientRect:()=>({left:10,bottom:20,width:300}),
  set innerHTML(v){this._h=v;this.children=[]},get innerHTML(){return this._h||''}};return e;};
const els={};const listeners={};const calls=[];
const document={hidden:false,readyState:'complete',body:mkEl(),
  getElementById:id=>els[id]||null,querySelector:()=>null,
  createElement:()=>mkEl(),addEventListener:(t,f,c)=>{(listeners[t]=listeners[t]||[]).push({f,c})}};
document.body.appendChild=el=>{if(el.id!==undefined)els[el.id]=el;};
const ctx={console,document,setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},JSON,Math,Date,String,Array,Object,parseInt,RegExp,
  localStorage:{getItem:k=>k==='ome_sess_token'?'tok':null},
  gsUrl:'https://gas/exec',toast:m=>calls.push(['toast',m]),esc:s=>String(s),
  accounts:[{username:'ha',name:'Hà',active:true},{username:'hamy',name:'Hà My',active:true},{username:'duyen',name:'Duyên',active:true},{username:'off',name:'Nghỉ',active:false},{username:'dung',name:'Đức Dũng',active:true}],
  openDp:p=>calls.push(['openDp',p]),customerMap:{'0912':{}},allTasks:[{id:'tk1'}],
  openTaskDetailModal:i=>calls.push(['openTask',i]),switchTaskDetailTab:t=>calls.push(['tab',t]),
  fetch:async(u,o)=>{calls.push(['fetch',u,o&&o.body]);return{json:async()=>({ok:true,items:[],unread:0})};}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/39-fn-notify.js','utf8')+'\nthis.X={_ntUpdateSug,_ntSug:()=>_ntSug,_ntPick,ntOpenItem,ntNoteMention,_ntNames,_ntOpenTask,setItems:a=>{_ntItems=a;},_ntSetUnread};',ctx);
const X=ctx.X;let fail=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);fail++;}else console.log('ok  :',m);};
const input=(v,pos)=>({id:'cs-note-new',value:v,selectionStart:pos===undefined?v.length:pos,focus(){},setSelectionRange(a){this.sel=a;},getBoundingClientRect:()=>({left:10,bottom:20,width:300})});

let el=input('nhờ @ha');X._ntUpdateSug(el);
ok(X._ntSug().list.join('|')==='Hà|Hà My','go "@ha": goi y Ha, Ha My (khong dau, khong goi tai khoan khoa)');
el=input('@duy');X._ntUpdateSug(el);ok(X._ntSug().list[0]==='Duyên','@duy -> Duyên (khong phan biet dau)');
el=input('@dung');X._ntUpdateSug(el);ok(X._ntSug().list[0]==='Đức Dũng','@dung khop "Đức Dũng" (đ/ũ bo dau)');
X._ntUpdateSug(input('xin chao'));el=input('gui email a@ha');X._ntUpdateSug(el);ok(els['nt-sug'].style.display==='none','email a@ha (@ dinh lien chu) khong bat goi y');
el=input('nhờ @Hà My xem');X._ntUpdateSug(el);ok(els['nt-sug'].style.display==='none','ngoai pham vi 2 tu sau @ + con tro sau khoang trang thu 3 -> an goi y');
el=input('nhờ @Hà My');X._ntUpdateSug(el);ok(X._ntSug().list[0]==='Hà My'||X._ntSug().list.includes('Hà My'),'ten 2 tu "@Hà My" van goi y');
// pick
el=input('nhờ @du');X._ntUpdateSug(el);X._ntPick(0);
ok(el.value==='nhờ @Duyên ','chon -> chen "@Duyên " thay doan dang go');
el=input('@ha va viec khac',3);X._ntUpdateSug(el);X._ntPick(0);
ok(el.value==='@Hà va viec khac','chen giua cau giu phan sau con tro, khong du dau cach: '+JSON.stringify(el.value));
// phim Enter khi dang goi y: chan handler khac
el=input('@ha');X._ntUpdateSug(el);
const kd=listeners.keydown.filter(l=>l.c)[0].f;let stopped=0,prevented=0;
kd({key:'Enter',target:el,preventDefault(){prevented++},stopImmediatePropagation(){stopped++}});
ok(stopped===1&&prevented===1&&el.value==='@Hà ','Enter khi dang goi y -> chon ten, chan "them ghi chu"');
kd({key:'Enter',target:el,preventDefault(){prevented++},stopImmediatePropagation(){stopped++}});
ok(stopped===1,'goi y da dong -> Enter di tiep binh thuong (them ghi chu)');
// mo thong bao
X.setItems([{id:'n1',kind:'note',refType:'customer',refId:'0912',read:false},{id:'n2',kind:'comment',refType:'task',refId:'tk1',read:false},{id:'n3',kind:'task',refType:'task',refId:'tk1',read:true}]);
calls.length=0;X.ntOpenItem('n1');
ok(calls.some(c=>c[0]==='openDp'&&c[1]==='0912'),'thong bao ghi chu -> mo khach 0912');
ok(calls.some(c=>c[0]==='fetch'&&/notifRead/.test(c[2]||'')&&/n1/.test(c[2])),'danh dau da doc qua notifRead');
calls.length=0;X.ntOpenItem('n2');
ok(calls.some(c=>c[0]==='openTask'&&c[1]==='tk1')&&calls.some(c=>c[0]==='tab'&&c[1]==='discuss'),'thong bao binh luan -> mo cong viec + tab Thao luan');
calls.length=0;X.ntOpenItem('n3');
ok(calls.some(c=>c[0]==='openTask')&&!calls.some(c=>c[0]==='tab')&&!calls.some(c=>c[0]==='fetch'),'thong bao cong viec da doc -> mo cong viec, khong goi notifRead, khong chuyen tab');
// ghi chu khach goi notifMention chi khi co @
calls.length=0;X.ntNoteMention('0912','khong tag');ok(!calls.length,'ghi chu khong co @ -> khong goi server');
X.ntNoteMention('0912','nhờ @Hà');ok(calls.some(c=>c[0]==='fetch'&&/notifMention/.test(c[2])&&/0912/.test(c[2])),'ghi chu co @ -> notifMention kem SDT');
els['sn-toggle']=mkEl();X._ntSetUnread(120);ok(els['sn-toggle'].attrs['data-nt']==='99+','nut menu hien 99+ khi >99');X._ntSetUnread(0);ok(els['sn-toggle'].attrs['data-nt']===undefined,'het chua doc -> go chu so');
console.log(fail?'\nFAILED '+fail:'\nALL NOTIFY UI TESTS PASSED');process.exit(fail?1:0);

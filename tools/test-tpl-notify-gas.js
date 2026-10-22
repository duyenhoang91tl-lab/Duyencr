// Test thong bao mau tin cho duyet (gas_v13.js): de xuat -> bao admin; sua lai khong spam; duyet/tu choi/xoa -> don thong bao; tplPending chi cho admin.
// Chay: node tools/test-tpl-notify-gas.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const fn=n=>{const i=src.indexOf('function '+n+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}};
const part=['saveMessageTemplate_','deleteMessageTemplate_','approveMessageTemplate_','_tplNotifyPending_','_tplNotifClear_','tplPendingList_'].map(fn).join('\n');
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
class Sheet{constructor(h){this.rows=[h.slice()]}getLastRow(){return this.rows.length}getDataRange(){return{getValues:()=>this.rows.map(r=>r.slice())}}
 appendRow(r){this.rows.push(r.slice())}deleteRow(n){this.rows.splice(n-1,1)}
 getRange(r,c,nr,nc){const S=this;return{setValues:v=>{v.forEach((row,i)=>{while(S.rows.length<r+i)S.rows.push([]);row.forEach((x,j)=>S.rows[r+i-1][c-1+j]=x)})},setValue:x=>{while(S.rows.length<r)S.rows.push([]);S.rows[r-1][c-1]=x}}}}
const MSG_H=['id','title','content','tags','createdBy','createdAt','updatedAt','product','topic','status','approvedBy','approvedAt','rejectReason','nhom'];
const NOT_H=['id','toUser','fromUser','kind','refType','refId','refId2','text','createdAt','readAt'];
const sheets={Msg:new Sheet(MSG_H),Notif:new Sheet(NOT_H)};
const users=[{username:'duyenht',name:'Duyen HT',role:'admin',active:true},{username:'boss2',name:'Boss Hai',role:'admin',active:true},{username:'off',name:'Admin Nghi',role:'admin',active:false},{username:'lan',name:'Lan Sale',role:'cs',active:true}];
const ctx={SH_MSG_TPL:'Msg',SH_NOTIF:'Notif',SH_USER:'Users',MSG_TPL_HEADERS:MSG_H,NOTIF_HEADERS:NOT_H,MSG_TPL_APPROVER_ROLES_:['admin'],
 getSheet_:(n)=>sheets[n],getCrmSS_:()=>({getSheetByName:n=>sheets[n]||{}}),readUsers_:()=>users,jsonOut_:x=>x,
 _tplRowToObj_:r=>({id:r[0],title:r[1],content:r[2],tags:r[3],createdBy:r[4],createdAt:r[5],product:r[7],topic:r[8],status:r[9]||'approved'}),
 _tplOwns_:(c,caller)=>String(c.createdBy||'').toLowerCase()===String(caller.name||'').toLowerCase(),
 readMessageTemplates_:()=>sheets.Msg.rows.slice(1).map(r=>ctx._tplRowToObj_(r)),Date,JSON,Math,String,Object,Array,Number};
vm.createContext(ctx);vm.runInContext(part+';this.api={save:saveMessageTemplate_,del:deleteMessageTemplate_,notify:_tplNotifyPending_,clear:_tplNotifClear_,pending:tplPendingList_,approve:approveMessageTemplate_};',ctx);
const cs={priv:false,name:'Lan Sale',via:'web'},adm={priv:true,name:'Duyen HT',via:'web'},unread=u=>sheets.Notif.rows.slice(1).filter(r=>r[1]===u&&!r[9]);
// 1) nhan vien de xuat mau moi -> bao moi admin DANG HOAT DONG (khong bao nguoi nghi, khong bao chinh minh)
let r=ctx.api.save({title:'Mau vong tay Kim',content:'Noi dung'},cs);const id=r.id;
t('de xuat mau -> trang thai cho duyet',r.ok&&r.status==='pending');
t('bao 2 admin dang hoat dong (khong bao admin da khoa / nhan vien)',unread('duyenht').length===1&&unread('boss2').length===1&&unread('off').length===0&&unread('lan').length===0);
const n=unread('duyenht')[0];
t('thong bao dung dinh dang (kind tplpending, refType tpl, refId = id mau, co tieu de)',n[3]==='tplpending'&&n[4]==='tpl'&&n[5]===id&&/Mau tin cho duyet: Mau vong tay Kim/.test(n[7])&&n[2]==='Lan Sale');
// 2) sua lai khi con cho duyet -> KHONG nhan doi thong bao
r=ctx.api.save({id:id,title:'Mau vong tay Kim v2',content:'Noi dung moi'},cs);
t('sua mau cho duyet: van 1 thong bao chua doc / admin (khong spam)',r.status==='pending'&&unread('duyenht').length===1&&sheets.Notif.rows.length===3);
// 3) admin tu de xuat -> da duyet luon, khong thong bao
sheets.Notif.rows.length=1;r=ctx.api.save({title:'Mau admin',content:'x'},adm);
t('admin tao mau: da duyet ngay, khong thong bao',r.status==='approved'&&sheets.Notif.rows.length===1);
// 4) admin tu sua mau cua minh cho duyet (vi du admin dong vai nhan vien) -> khong tu bao minh
const adm2={priv:false,name:'Duyen HT',via:'ext'};sheets.Notif.rows.length=1;ctx.api.save({title:'Mau tu bao',content:'x'},adm2);
t('nguoi de xuat la admin: khong tu bao minh, nhung bao admin khac',unread('duyenht').length===0&&unread('boss2').length===1);
// 5) duyet -> don het thong bao cua mau do (cho MOI admin)
sheets.Notif.rows.length=1;r=ctx.api.save({title:'Mau B',content:'B'},cs);const idB=r.id;
t('truoc khi duyet: 2 admin deu co thong bao',unread('duyenht').length===1&&unread('boss2').length===1);
r=ctx.api.approve(idB,'approve','',adm);
t('duyet: thanh cong + thong bao cua CA 2 admin chuyen da doc',r.ok&&r.status==='approved'&&unread('duyenht').length===0&&unread('boss2').length===0);
// 6) tu choi, xoa
sheets.Notif.rows.length=1;r=ctx.api.save({title:'Mau C',content:'C'},cs);const idC=r.id;ctx.api.approve(idC,'reject','Sai thong tin',adm);
t('tu choi: don thong bao',unread('duyenht').length===0&&sheets.Msg.rows.find(x=>x[0]===idC)[9]==='rejected');
sheets.Notif.rows.length=1;r=ctx.api.save({title:'Mau D',content:'D'},cs);ctx.api.del(r.id,cs);
t('nhan vien xoa mau cho duyet cua minh: don thong bao',unread('boss2').length===0);
t('khong duoc duyet neu khong phai admin',ctx.api.approve(id,'approve','',cs).code==='FORBIDDEN'&&sheets.Msg.rows.find(x=>x[0]===id)[9]==='pending');
// 7) tplPending: chi admin; gioi han + cat noi dung; chi mau cho duyet
sheets.Msg.rows.length=1;sheets.Notif.rows.length=1;for(let i=0;i<35;i++){ctx.api.save({title:'M'+i,content:'c'.repeat(2000)},cs);}ctx.api.save({title:'Admin',content:'z'},adm);
let p=ctx.api.pending(adm);
t('tplPending (admin): dem du 35, tra toi da 30 muc, noi dung cat 1200, khong lan mau da duyet',p.ok&&p.count===35&&p.items.length===30&&p.items[0].content.length===1200&&p.items.every(x=>x.id&&x.title));
t('tplPending: nhan vien/khong token bi tu choi, KHONG lo noi dung',ctx.api.pending(cs).code==='FORBIDDEN'&&ctx.api.pending(null).code==='FORBIDDEN'&&!JSON.stringify(ctx.api.pending(cs)).includes('ccc'));
// 8) loi ghi thong bao KHONG lam hong viec luu mau
ctx.readUsers_=()=>{throw new Error('boom')};sheets.Msg.rows.length=1;r=ctx.api.save({title:'Van luu',content:'x'},cs);
t('thong bao loi -> van luu mau thanh cong',r.ok&&sheets.Msg.rows.length===2);
console.log(fail?('FAILED '+fail):'ALL TPL NOTIFY TESTS PASSED');process.exit(fail?1:0);

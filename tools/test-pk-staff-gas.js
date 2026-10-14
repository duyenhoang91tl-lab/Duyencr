// Test ten nhan vien Pancake (gas_v13.js): pkStaffSync_ + _pkConvOut_ / _pkStaffNames_. Chay: node tools/test-pk-staff-gas.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const pk=src.slice(src.indexOf('var PK_CHAT_SECTION_'));
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const props={PANCAKE_PAGE_TOKENS:'{"P1":"T1","P2":"T2"}'},posts=[],urls=[];let staffTable='ok',users;
const store={};let cacheOn=false;let sbCalls=0;
const ctx={Logger:{log(){}},CacheService:{getScriptCache:()=>{if(!cacheOn)throw new Error('no cache');return{get:k=>store[k]??null,put:(k,v)=>{store[k]=v}}}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,getProperties:()=>props})},
 UrlFetchApp:{fetch:(u)=>{urls.push(u);const pg=/pages\/([^/]+)\/users/.exec(u)[1];const b=users[pg];if(b==null)return{getResponseCode:()=>401,getContentText:()=>'{"success":false}'};return{getResponseCode:()=>200,getContentText:()=>JSON.stringify(b)}}},
 sb_:(m,p,b)=>{sbCalls++;if(m==='POST'){posts.push({p,b});return{json:null}}if(p.startsWith('pk_conversations'))return{json:[{id:'C1',page_id:'P1',customer_name:'K',assignee_ids:['u-1']}]};if(p.startsWith('pk_staff')){if(staffTable==='missing')throw new Error('relation pk_staff does not exist');return{json:[{id:'u-1',name:'Lan Sale'},{id:'u-2',name:'Minh CS'}]}}return{json:[]}},
 jsonOut_:x=>x,_sessUser_:()=>({user:'u1',role:'admin'}),_pkMemo_:{},_pkTagMap_:()=>({}),_pkUserMap_:()=>({}),_pkTagsOut_:()=>[],_pkEnc_:encodeURIComponent,
 encodeURIComponent,Date,JSON,RegExp,Array,String,Object,Number,Math,isNaN,parseInt};
vm.createContext(ctx);vm.runInContext(pk+';this.api={inbox:pkChatInbox_,sync:pkStaffSync_,out:_pkConvOut_,names:_pkStaffNames_,cols:PK_CONV_COLS_};',ctx);
// dang tra ve khac nhau o 2 page (chua xac nhan dang that -> doc khoan dung)
users={P1:{success:true,users:[{id:'u-1',name:'Lan Sale',fb_id:'1'},{id:'u-2',full_name:'Minh CS'}]},P2:{success:true,data:[{id:'u-2',name:''},{user:{id:'u-3',name:'Hoa'}},{name:'khong co id'}]}};
let r=ctx.api.sync({dryRun:true});
t('dryRun: khong ghi, co mau de doi chieu',posts.length===0&&r.sample.length===2&&r.staff===3&&r.sample[0].keys.includes('users'));
r=ctx.api.sync({});
t('ghi pk_staff: gop 2 page, bo ban ghi khong co id, giu ten khong rong',posts.length===1&&posts[0].p==='pk_staff?on_conflict=id'&&posts[0].b.map(x=>x.id+':'+x.name).sort().join()==='u-1:Lan Sale,u-2:Minh CS,u-3:Hoa');
t('goi dung API users + dung token tung page',urls[0].includes('/v1/pages/P1/users?page_access_token=T1')&&urls.some(u=>u.includes('/pages/P2/users?page_access_token=T2')));
users.P2=null;posts.length=0;r=ctx.api.sync({});
t('1 page loi (401) -> bao loi nhung van ghi page con lai',r.errors.length===1&&/P2/.test(r.errors[0])&&posts.length===1&&r.staff===2);
// ten hien thi trong khung chat
const names=ctx.api.names();
t('doc map id->ten tu pk_staff',names['u-1']==='Lan Sale'&&names['u-2']==='Minh CS');
const o=ctx.api.out({id:'C1',page_id:'P1',customer_name:'Khach',assignee_ids:['u-1','khong-ro','u-2']},names);
t('hoi thoai: tra ten nhan vien, bo qua id chua biet (khong lo uuid ra UI)',o.assignees.join()==='Lan Sale,Minh CS'&&o.assigneeIds.length===3);
t('hoi thoai khong co assignee_ids / khong co ten -> khong loi',ctx.api.out({id:'C2'}).assignees.length===0&&ctx.api.out({id:'C3',assignee_ids:null},{}).assigneeIds.length===0);
staffTable='missing';
t('chua tao bang pk_staff -> tra {} (khung chat KHONG hong)',JSON.stringify(ctx.api.names())==='{}');
t('cot select co assignee_ids',ctx.api.cols.includes('assignee_ids'));
// --- HAN MUC UrlFetch: moi lan poll hop thu khong duoc ton luot goi khi da co cache ---
staffTable='ok';cacheOn=true;Object.keys(store).forEach(k=>delete store[k]);
sbCalls=0;ctx.api.names();ctx.api.names();ctx.api.names();
t('ten NV: goi nhieu lan chi 1 luot Supabase (cache 6 gio)',sbCalls===1);
sbCalls=0;let r1=ctx.api.inbox({parameter:{}});let r2=ctx.api.inbox({parameter:{}});let r3=ctx.api.inbox({parameter:{}});
t('danh sach hop thu: 3 lan poll lien tiep chi ton 1 luot (cache 15s dung chung)',sbCalls===1&&r1.ok&&r2.conversations.length===1&&r3.conversations[0].assignees.join()==='Lan Sale');
sbCalls=0;ctx.api.inbox({parameter:{q:'Nguyen'}});ctx.api.inbox({parameter:{q:'Nguyen'}});
t('tim kiem: cache theo tu khoa (khong lan voi danh sach chinh)',sbCalls===1);
cacheOn=false;sbCalls=0;ctx.api.inbox({parameter:{}});ctx.api.inbox({parameter:{}});
t('khong co CacheService (loi) -> van chay, chi mat loi ich cache',sbCalls>=2);
console.log(fail?('FAILED '+fail):'ALL PK STAFF TESTS PASSED');process.exit(fail?1:0);

// Test backend Thu vien san pham (plib*) voi Sheet/Drive gia. Chay: node tools/test-plib.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../gas_v13.js','utf8');
const i0=src.indexOf("var SH_PLIB_ ="),i1=src.indexOf("function plibDoGet_");
const sv=src.indexOf("function _stripVN_"),sv1=src.indexOf("\n}\n",sv)+3;
const ml=src.indexOf("function _mlibUser_"),ml1=src.indexOf("function _mlibSheet_");
const mc=src.indexOf("function _mlibClean_"),mc1=src.indexOf("\n",mc);
const code=src.slice(sv,sv1)+src.slice(ml,ml1)+src.slice(mc,mc1)+src.slice(i0,i1);
const rows=[['id']];
const sh={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+(nc||1))),setValue:v=>{rows[r-1][c-1]=v}})};
const users={ta:{username:'a',role:'cs'},tb:{username:'b',role:'cs'},tad:{username:'ad',role:'admin'},td:{username:'d',role:'demo'}};
const folders={};let n=0;
const ctx={getSheet_:()=>sh,_sessUser_:t=>users[t]||null,
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>'R',setProperty(){}})},
 DriveApp:{Access:{ANYONE_WITH_LINK:1},Permission:{VIEW:1},getFolderById:()=>({getFoldersByName:l=>({hasNext:()=>!!folders[l],next:()=>folders[l]}),createFolder:l=>(folders[l]={l,createFile:()=>({getId:()=>'f'+(++n),setSharing(){}})})})},
 Utilities:{base64Decode:s=>Buffer.from(s,'base64'),newBlob:(b,m,nm)=>({b,m,nm})},Date,Math,Number,String,JSON};
vm.createContext(ctx);vm.runInContext(code,ctx);
const b64=Buffer.from('hello').toString('base64');
const up=(t,name,extra)=>ctx.plibUpload_(Object.assign({token:t,productName:name,mimeType:'image/png',name:'a.png',base64:b64},extra));
assert.strictEqual(ctx.plibList_({}).ok,false);
assert.strictEqual(ctx.plibList_({token:'td'}).ok,false);
assert.strictEqual(ctx._plibKey_('  Vòng  Cuốn - Nam Bích! '),'vong cuon nam bich');
let r=up('ta','Nhẫn Kim Tiền'); assert(r.ok&&r.n===1&&r.item.key==='nhan kim tien');
assert.strictEqual(up('ta','nhan  kim TIEN').item.key,'nhan kim tien');           // cung thu muc du khac hoa/thuong/dau
assert(Object.keys(folders).length===1,'1 thu muc Drive cho cung SP');
assert.strictEqual(up('ta','').ok,false);
assert.strictEqual(up('ta','X',{mimeType:'audio/webm'}).ok,false);
assert.strictEqual(up('ta','X',{base64:Buffer.alloc(6*1024*1024+1).toString('base64')}).ok,false);
for(let i=0;i<48;i++) assert(up('ta','Nhẫn Kim Tiền').ok);                         // du 50
r=up('tb','Nhẫn Kim Tiền'); assert(!r.ok&&r.full,'anh thu 51 bi chan');
assert(up('ta','Combo: Tet',{group:'Combo'}).ok);                                  // thu muc khac van nhan
let l=ctx.plibList_({token:'tb'}); assert.strictEqual(l.counts['nhan kim tien'].n,50); assert.strictEqual(l.counts['combo tet'].n,1);
l=ctx.plibList_({token:'tb',key:'Nhẫn Kim Tiền'}); assert.strictEqual(l.items.length,50);
const id=l.items[0].id;
assert.strictEqual(ctx.plibDelete_({token:'tb',id}).ok,false);                     // nguoi khac khong xoa
assert(ctx.plibDelete_({token:'ta',id}).ok);
assert.strictEqual(ctx.plibList_({token:'tb',key:'nhan kim tien'}).items.length,49);
assert(up('tb','Nhẫn Kim Tiền').ok,'xoa xong co cho trong');
assert(ctx.plibDelete_({token:'tad',id:ctx.plibList_({token:'tb',key:'nhan kim tien'}).items[1].id}).ok);   // admin xoa duoc
console.log('OK test-plib');

// Test backend Thu vien (gas/29_MediaLib.gs) voi Sheet/Drive gia. Chay: node tools/test-mlib.js
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../gas_v13.js','utf8');
const code=src.slice(src.indexOf("var SH_MLIB_ ="));
const rows=[['id','type','name','tags','fileId','url','mime','size','text','createdBy','createdAt','deleted']];
const sh={getLastRow:()=>rows.length,appendRow:r=>rows.push(r),getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+(nc||1))),setValue:v=>{rows[r-1][c-1]=v}})};
const users={ta:{username:'a',name:'A',role:'cs'},tb:{username:'b',name:'B',role:'cs'},tad:{username:'ad',name:'Ad',role:'admin'},td:{username:'d',role:'demo'}};
let created=[];
const file=id=>({getId:()=>id,setSharing(){},getSize:()=>10,getMimeType:()=>'image/png',getName:()=>'x.png',makeCopy:()=>file('copy'+id)});
const ctx={getSheet_:()=>sh,jsonOut_:o=>o,_sessUser_:t=>users[t]||null,Logger:{log(){}},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>'F1',setProperty(){}})},
 DriveApp:{Access:{ANYONE_WITH_LINK:1},Permission:{VIEW:1},getFolderById:()=>({createFile:b=>{created.push(b);return file('f'+created.length)}}),getFileById:id=>{if(id==='bad')throw new Error('x');return file(id)}},
 Utilities:{base64Decode:s=>Buffer.from(s,'base64'),newBlob:(b,m,n)=>({b,m,n})},Date,Math,Number,String,JSON};
vm.createContext(ctx);vm.runInContext(code,ctx);
const run=s=>vm.runInContext(s,ctx);
ctx.T=(f,...a)=>ctx[f](...a);
const png=Buffer.from('hello').toString('base64');
assert.strictEqual(ctx.mlibList_({}).ok,false);                                   // can token
assert.strictEqual(ctx.mlibList_({token:'td'}).ok,false);                         // demo bi chan
let r=ctx.mlibUpload_({token:'ta',type:'image',mimeType:'image/png',name:'=evil.png',base64:png});
assert(r.ok&&r.item.name==="'=evil.png"&&/export=view/.test(r.item.url),'upload anh + chong cong thuc');
assert.strictEqual(ctx.mlibUpload_({token:'ta',type:'image',mimeType:'audio/webm',base64:png}).ok,false);   // sai loai
r=ctx.mlibUpload_({token:'ta',type:'audio',mimeType:'audio/webm;codecs=opus',name:'ghi am',base64:png}); assert(r.ok&&/export=download/.test(r.item.url));
r=ctx.mlibSaveTpl_({token:'ta',name:'Chao',text:'Xin chao {ten}'}); assert(r.ok); const tid=r.item.id;
assert.strictEqual(ctx.mlibSaveTpl_({token:'ta',name:'x',text:''}).ok,false);
assert.strictEqual(ctx.mlibSaveTpl_({token:'ta',name:'x',text:'a'.repeat(2001)}).ok,false);
assert.strictEqual(ctx.mlibSaveTpl_({token:'tb',id:tid,name:'hack',text:'z'}).ok,false);  // nguoi khac khong sua duoc
assert(ctx.mlibSaveTpl_({token:'tad',id:tid,name:'Chao moi',text:'Hi'}).ok);               // admin sua duoc
assert.strictEqual(ctx.mlibList_({token:'tb',type:'template'}).items[0].name,'Chao moi');
assert.strictEqual(ctx.mlibList_({token:'tb'}).items.length,3);
r=ctx.mlibAddDrive_({token:'ta',type:'image',link:'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view'}); assert(r.ok&&r.item.fileId==='copy1AbCdEfGhIjKlMnOpQ','them tu Drive');
assert.strictEqual(ctx.mlibAddDrive_({token:'ta',type:'image',link:'abc'}).ok,false);
assert.strictEqual(ctx.mlibAddDrive_({token:'ta',type:'audio',link:'1AbCdEfGhIjKlMnOpQ'}).ok,false);   // mime anh != audio
assert.strictEqual(ctx.mlibDelete_({token:'tb',id:tid}).ok,false);
assert(ctx.mlibDelete_({token:'ta',id:tid}).ok);
assert.strictEqual(ctx.mlibList_({token:'tb'}).items.length,3);   // 4 - 1 da xoa
console.log('OK test-mlib');

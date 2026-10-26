// Test GAS: "Sale phan hoi" (saveSplitFeedback_ / _splitAttachFeedback_) — ham THAT trong gas_v13.js, sheet gia.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync(__dirname+'/../gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thieu '+name);let d=0;for(let k=src.indexOf('{',i);k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'&&--d===0)return src.slice(i,k+1)}}
const consts=src.slice(src.indexOf('var SH_SPLIT_FB_ ='),src.indexOf('function _splitFbKey_('));
const code=consts+['_splitFbKey_','_splitFbRead_','_splitAttachFeedback_','saveSplitFeedback_','_splitScope_','_splitRound_','_splitDmy_','_dateStrToVnYmd_'].map(fn).join('\n');
const rows=[['key','sale','text','by','at']];
const sheet={getLastRow:()=>rows.length,getRange:(r,c,nr,nc)=>({getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc)),setValues:v=>{v.forEach((x,i)=>{rows[r-1+i]=x.slice()})}}),appendRow:a=>rows.push(a)};
const sess={tAn:{username:'an',name:'An',role:'cs',names:['An']},tBoss:{username:'boss',name:'Sếp',role:'admin'}};
const ctx={Math,JSON,String,Number,Object,Array,RegExp,Date,getSheet_:()=>sheet,LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{formatDate:()=>'24/10/2026 10:00'},
 _sessUser_:t=>sess[t]||null,_roleBase_:r=>r==='admin'?'admin':'cs',_profFold_:ns=>{const f={};(ns||[]).forEach(n=>f[String(n).trim().toLowerCase()]=true);return f},
 _normTxt_:s=>String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim(),normPhone_:p=>String(p||'').replace(/\D/g,''),
 _vnYmd_:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),parseVNDate_:s=>{const m=/^(\d+)\/(\d+)\/(\d+)/.exec(s||'');return m?new Date(+m[3],+m[2]-1,+m[1]):null},
 _profNames_:u=>[u.name].concat(u.names||[]),readTeams_:()=>[],readSaleDepts_:()=>({byNorm:{}}),getCrmSS_:()=>({getSheetByName:()=>null}),SH_TEAM:'T',_userDeptKeys_:()=>[]};
vm.createContext(ctx);vm.runInContext(code,ctx);
const o={posRow:12,soDienThoai:'0911000001',ngayTaoDon:'02/10/2026',giaTriSauGiam:3000000};
const key=ctx._splitFbKey_(o,'An');
ok(key==='12|0911000001|2026-10-02|3000000#an','khoa dong = dong Pos|SDT|ngay|gia tri#sale chuan hoa');
ok(ctx._splitFbKey_(o,'Bình')!==key&&ctx._splitFbKey_(o,'Bình').endsWith('#binh'),'moi sale co khoa rieng cho cung 1 don');
let r=ctx.saveSplitFeedback_({key,sale:'An',text:'Da xac nhan',token:'tAn'});ok(r.ok&&r.by==='An'&&rows.length===2&&rows[1][2]==='Da xac nhan','sale ghi phan hoi cua chinh minh -> them dong moi');
r=ctx.saveSplitFeedback_({key,sale:'An',text:'Sua lai',token:'tAn'});ok(r.ok&&rows.length===2&&rows[1][2]==='Sua lai','ghi lai cung khoa -> CAP NHAT, khong nhan doi');
ok(ctx.saveSplitFeedback_({key,sale:'An',text:'x',token:'bad'}).code==='AUTH','khong token hop le -> AUTH');
const kB=ctx._splitFbKey_(o,'Bình');
ok(ctx.saveSplitFeedback_({key:kB,sale:'Bình',text:'x',token:'tAn'}).ok===false&&rows.length===2,'sale An KHONG ghi ho sale Binh (ngoai pham vi)');
ok(ctx.saveSplitFeedback_({key:kB,sale:'An',text:'x',token:'tAn'}).ok===false,'khoa khong khop ten sale -> tu choi (chong ghi de khoa nguoi khac)');
ok(ctx.saveSplitFeedback_({key:'rac',sale:'An',text:'x',token:'tAn'}).ok===false,'khoa sai dinh dang -> tu choi');
ok(ctx.saveSplitFeedback_({key,sale:'An',text:'a'.repeat(501),token:'tAn'}).ok===false,'qua 500 ky tu -> tu choi');
r=ctx.saveSplitFeedback_({key:kB,sale:'Bình',text:'Admin ghi ho',token:'tBoss'});ok(r.ok&&rows.length===3,'Admin ghi duoc cho moi sale');
const out=ctx._splitAttachFeedback_({pos:[{fbKey:key},{fbKey:kB},{fbKey:'khac#an'}]});
ok(out.pos[0].feedback==='Sua lai'&&out.pos[0].feedbackBy==='An'&&out.pos[1].feedback==='Admin ghi ho'&&out.pos[2].feedback==='','gan phan hoi vao tung dong chi tiet theo khoa (dong chua co -> rong)');
r=ctx.saveSplitFeedback_({key,sale:'An',text:'',token:'tAn'});ok(r.ok&&rows[1][2]==='','xoa phan hoi (text rong) -> xoa noi dung o dong da co');
console.log(bad?'FAILED '+bad:'ALL PASS');process.exit(bad?1:0);

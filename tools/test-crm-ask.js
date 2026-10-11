// Test GAS v13.32: callAI_ có nhánh crmAsk (prompt hệ thống riêng, không tìm sản phẩm, giới hạn 9000 ký tự); nhánh CS cũ không đổi.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('gas_v13.js','utf8');
function fn(name){const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('thiếu '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;else if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1)}}}
function run(data){const cap={};const ctx={jsonOut_:x=>x,getSetting_:k=>k==='apiGroq'?'KEY':'',_buildAISystemPrompt_:(m,w)=>{cap.csArgs=[m,w];return 'CS-PROMPT'},_aiOpenAICompat_:(pv,sys,msg)=>{cap.sys=sys;cap.msg=msg;return {ok:true,text:'trả lời'}},_aiGemini_:()=>({ok:false}),Logger:{log(){}},findProductImages_:()=>[],_findProductImage_:()=>null};
 vm.createContext(ctx);vm.runInContext(fn('_crmAskSystemPrompt_')+'\n'+fn('callAI_')+';this.callAI_=callAI_;',ctx);let out;try{out=ctx.callAI_(data)}catch(e){out={threw:e.message}};return {out,cap}}
let r=run({prompt:'NGỮ CẢNH: ... CÂU HỎI: x',crmAsk:true,withProducts:true});
ok(r.out.ok&&r.out.text==='trả lời','crmAsk: trả kết quả từ provider ('+JSON.stringify(r.out).slice(0,80)+')');
ok(r.cap.sys&&r.cap.sys.includes('trợ lý nội bộ')&&r.cap.sys.includes('không bịa')&&!r.cap.sys.includes('CS-PROMPT'),'crmAsk: dùng prompt hệ thống riêng, không dùng prompt CS');
ok(!r.cap.csArgs,'crmAsk: không gọi _buildAISystemPrompt_ (không kéo kiến thức Drive/Sheet sản phẩm)');
r=run({prompt:'x'.repeat(9001),crmAsk:true});ok(r.out.error&&/9000/.test(r.out.error)&&!r.cap.sys,'crmAsk: >9000 ký tự bị từ chối, không gọi AI');
r=run({prompt:'x'.repeat(9000),crmAsk:true});ok(r.out.ok,'crmAsk: đúng 9000 ký tự vẫn được');
r=run({prompt:'khách hỏi giá'});ok(r.cap.sys==='CS-PROMPT'&&r.cap.csArgs[0]==='khách hỏi giá'&&r.cap.csArgs[1]===false,'KHÔNG crmAsk: luồng CS cũ giữ nguyên (dùng _buildAISystemPrompt_)');
r=run({prompt:'a',withProducts:true});ok(r.cap.csArgs[1]===true,'KHÔNG crmAsk: withProducts vẫn truyền như cũ');
r=run({});ok(r.out.error==='Thieu noi dung','thiếu prompt vẫn báo như cũ');
ok(/ver: 'v13\.\d+-[a-z-]+'/.test(src),'action=count trả ver v13.xx (để đối chiếu bản đang chạy)');
process.exit(bad?1:0);

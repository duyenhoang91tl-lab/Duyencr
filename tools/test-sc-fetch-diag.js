// Test: Social > Chat báo ĐÚNG nguyên nhân khi không tải được (trước đây mọi lỗi đều là "Không kết nối được máy chủ"), timeout, tự thử lại 1 lần.
// Chạy: node tools/test-sc-fetch-diag.js (cần jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('OK  ',t)};
const src=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const dom=new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-overlay"></div><div id="tab-chat" style="display:block"><div id="chat-wrap"></div></div></body></html>',{runScripts:'dangerously',pretendToBeVisual:true});
const w=dom.window;let mode='html',calls=0;const okBody=JSON.stringify({ok:true,conversations:[{id:'C1',name:'Mến Hoàng',phone:'0934230669',last_message_at:new Date().toISOString()}]});
w.eval('var gsUrl="https://gs.example/exec"; var _activeV9Tab="chat"; var careData={}; var currentPhone=""; var schedules=[]; var CARE_STATUS_TREE=[]; function _ymd(d){return d.toISOString().slice(0,10);}');
w.allCustomers=[];w.toast=()=>{};w.console.warn=()=>{};
const resp=(status,body)=>({ok:status<400,status,text:async()=>body});
w.fetch=async()=>{calls++;
  if(mode==='net') throw new Error('Failed to fetch');
  if(mode==='html') return resp(200,'<!DOCTYPE html><html><head><title>Lỗi</title></head><body>Exceeded maximum execution time</body></html>');
  if(mode==='login') return resp(200,'<html><body><a href="https://accounts.google.com/ServiceLogin">Sign in</a></body></html>');
  if(mode==='quota') return resp(200,'<html><body>Service invoked too many times for one day: urlfetch</body></html>');
  if(mode==='500') return resp(500,'Internal');
  if(mode==='hang') return new Promise((_,rej)=>{});
  if(mode==='flaky'){ if(calls===1) return resp(200,'<html>Loi tam</html>'); return resp(200,okBody); }
  return resp(200,okBody);};
w.eval(src('33-pro-profile.js'));w.eval(src('41-fn-pkchat.js'));w.eval(src('42-fn-socialchat.js'));w.eval(src('48-pro-chatinfo.js'));
w.eval('_pkcRetryMs=5');
const $=id=>w.document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const run=async m=>{mode=m;calls=0;w.eval('_sc.loading=false;_sc.err=""');await w.scLoadList();return ($('sc-lerr')||{}).textContent||'';};
(async()=>{
 w.renderSocialChatTab();await sleep(80);
 let t=await run('html');ok(/quá thời gian cho phép/.test(t)&&/Executions/.test(t),'GAS trả HTML "Exceeded maximum execution time" → báo quá thời gian + gợi ý xem Executions (không còn "Không kết nối")');
 ok(calls===2,'lỗi → tự thử lại đúng 1 lần (2 lượt gọi)');
 t=await run('login');ok(/yêu cầu đăng nhập Google/.test(t)&&/Anyone|Bất kỳ ai/.test(t),'trang đăng nhập Google → báo deployment chưa mở quyền "Bất kỳ ai"');
 t=await run('quota');ok(/hết hạn mức/.test(t)&&/14h/.test(t),'HTML quota → báo hết hạn mức + 14h');
 t=await run('500');ok(/HTTP 500/.test(t),'HTTP 500 → báo mã lỗi');
 t=await run('net');ok(/Không kết nối được máy chủ/.test(t)&&/Kiểm tra mạng/.test(t),'mất mạng thật vẫn báo "Không kết nối…" + kiểm tra mạng');
 t=await run('flaky');ok(t===''&&$('sc-convs').textContent.includes('Mến Hoàng')&&calls===2,'lần 1 GAS trả HTML tạm thời → TỰ thử lại lần 2 thành công, người dùng không thấy lỗi');
 // timeout
 const e=await w.eval('(async function(){ try { await _pkcFetchJson_("https://x", { timeout: 40, retry: 0 }); return null; } catch(e){ return e; } })()');
 mode='hang';const e2=await w.eval('(async function(){ try { await _pkcFetchJson_("https://x", { timeout: 40, retry: 0 }); return "no"; } catch(e){ return e.kind+"|"+e.message; } })()');
 ok(/^timeout\|Máy chủ phản hồi quá chậm/.test(String(e2))||/^net\|/.test(String(e2)),'treo không phản hồi → có timeout, không quay mãi ('+e2+')');
 mode='ok';$('sc-lerr')&&$('sc-lerr').querySelector('button').click();await sleep(80);
 ok(!$('sc-lerr')&&$('sc-convs').querySelectorAll('.sc-conv').length===1,'sau khi ổn: danh sách hiện, khung lỗi biến mất');
 console.log(bad?('\n'+bad+' FAIL'):'\nALL PASS');process.exit(bad?1:0);
})();

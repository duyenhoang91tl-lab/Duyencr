// Test: Social > Chat — lỗi tải danh sách phải HIỆN TRÊN DANH SÁCH (màn hẹp ẩn khung chat nên không thấy dòng trạng thái). Chạy: node tools/test-sc-list-error.js (cần jsdom)
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('OK  ',t)};
const src=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const dom=new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-overlay"></div><div id="tab-chat" style="display:block"><div id="chat-wrap"></div></div></body></html>',{runScripts:'dangerously',pretendToBeVisual:true});
const w=dom.window;let mode='quota';const iso=new Date().toISOString();
w.eval('var gsUrl="https://gs.example/exec"; var _activeV9Tab="chat"; var careData={}; var currentPhone=""; var schedules=[]; var CARE_STATUS_TREE=[]; function _ymd(d){return d.toISOString().slice(0,10);}');
w.allCustomers=[];
w.fetch=async()=>{ if(mode==='net') throw new Error('Failed to fetch'); if(mode==='quota') return {json:async()=>({error:'Doc hop thu loi: urlfetch qua nhieu lan/ngay'})}; return {json:async()=>({conversations:[{id:'C1',name:'Mến Hoàng',phone:'0934230669',lastText:'hi',lastAt:iso,seen:true,type:'INBOX'}]})}; };
w.toast=()=>{};
w.eval(src('33-pro-profile.js'));w.eval(src('41-fn-pkchat.js'));w.eval(src('42-fn-socialchat.js'));w.eval(src('48-pro-chatinfo.js'));
const $=id=>w.document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 w.renderSocialChatTab();await sleep(60);
 let b=$('sc-lerr');
 ok(b&&b.closest('.sc-list')&&b.textContent.includes('urlfetch')&&b.textContent.includes('14h')&&b.querySelector('button'),'hết hạn mức UrlFetch → lỗi hiện TRONG danh sách (.sc-list) + giải thích 14h + nút Thử lại');
 ok(!$('sc-convs').querySelector('.sc-conv'),'lỗi → không có dòng hội thoại giả');
 mode='net';w.eval('_sc.loading=false');await w.scLoadList();
 ok($('sc-lerr').textContent.includes('Không kết nối')&&$('sc-lerr').textContent.includes('Kiểm tra mạng'),'mất mạng → báo "Không kết nối được máy chủ" + gợi ý kiểm tra mạng');
 ok(w.document.querySelectorAll('#sc-lerr').length===1,'chỉ 1 khung lỗi (không chồng nhiều khung khi tải lại)');
 mode='ok';$('sc-lerr').querySelector('button').click();await sleep(60);
 ok(!$('sc-lerr')&&$('sc-convs').querySelectorAll('.sc-conv').length===1&&$('sc-convs').textContent.includes('Mến Hoàng'),'bấm Thử lại khi máy chủ ổn → khung lỗi biến mất, danh sách hiện');
 console.log(bad?('\n'+bad+' FAIL'):'\nALL PASS');process.exit(bad?1:0);
})();

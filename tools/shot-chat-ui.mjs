// CONG CU TUY CHON (khong chay trong CI): chup anh Social > Chat bang Chrome THAT (headless) de kiem tra loi hien thi — jsdom khong co bo may layout
// nen KHONG thay duoc loi kieu "danh sach xep ngang / chu bi ep hep" (bug 16/10: thieu </div> o dong hoi thoai). Dung du lieu gia lap giong that,
// khong goi mang va khong can dang nhap GAS.
//   cai dat 1 lan (ngoai repo):  mkdir /tmp/br && cd /tmp/br && npm i puppeteer-core @sparticuz/chromium   (Chromium nam san trong goi npm, khong can tai them)
//   chay:  cp tools/shot-chat-ui.mjs /tmp/br/ && cd /tmp/br && node shot-chat-ui.mjs <thu-muc-repo> <anh-ra.png> [rong=1900] [cao=900] [pick] [palette]
//     pick    = chon 1 hoi thoai (mo khung chat + thanh the + cot Thong tin)
//     palette = dao trang thai luoi the (mac dinh dang MO; them tham so nay se THU GON)
//   in ra toa do [x,y,rong,cao] cua cac khung chinh; cao dong hoi thoai dau ~99px la dung (305px = bi long nhau).
import chromium from '@sparticuz/chromium'; import puppeteer from 'puppeteer-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = process.argv[2] || '/home/claude/repo'; const OUT = process.argv[3] || '/tmp/br/s1.png'; const W = +(process.argv[4]||1900), H = +(process.argv[5]||900);
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; const f = path.join(ROOT, u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': (mime[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' }); r.end(d); } }); }).listen(0);
const port = srv.address().port;
const b = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell', defaultViewport: { width: W, height: H } });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
await p.setRequestInterception(true);
p.on('request', rq => { const u = rq.url(); if (u.startsWith('http://localhost:' + port)) rq.continue(); else if (/script\.google|gs\.test/.test(u)) rq.continue(); else rq.abort(); });
const names = ['Hạnh Dungg','Quynh Maj Vu','Mindy Q Nguyen','Hồ Na','Thu Phương','Ngọc Thảo','Thùy Linh','Nguyễn Tuyết','Phạm Huệ','Dung Lê'];
const texts = ['Trước khi ship bên chị sẽ liên hệ em nha','Đang có ưu đãi giảm 200k/mặt túi và mặt tỷ hưu','Chào bạn','Chị cho em xin SĐT + năm sinh và mong cầu ạ','Có địa chỉ nào gần hưng yên ko ạ','Em đặt hàng báo chị nhé','Ban cho minh xin năm sinh mình tư vấn thêm','Chào Nguyễn! Mình cho em xin năm sinh và','Chị cho em xin SĐT + năm sinh và mong cầu','em thích hai chiếc nào nhỉ?'];
const tagsets = [[{id:'26',t:'L1. Chuẩn',c:'#0a7a3a'},{id:'7',t:'S7 ninhLTK',c:'#1fa463'}],[{id:'26',t:'L1. Chuẩn',c:'#0a7a3a'}],[],[{id:'5',t:'L2 SĐT kết nối',c:'#e64b3c'}],[],[],[{id:'7',t:'S7 ninhLTK',c:'#1fa463'}],[],[],[{id:'26',t:'L1. Chuẩn',c:'#0a7a3a'},{id:'7',t:'S7 ninhLTK',c:'#1fa463'}]];
const convs = names.map((n,i)=>({ id:'C'+i, pageId:'P1', name:n, phone: i%3===0?'0867321'+(200+i):'', lastAt:'2026-10-16T03:'+(10+i)+':00+00:00', lastText:texts[i], seen:i>2, replied:i%2===0, type:'INBOX', tags:tagsets[i], assignees: i%2?['Le Ninh']:[], lastStaff:'' }));
const msgs = [{id:'m1',c:'C9',dir:'in',text:'Cho mình hỏi bên mình có vật phẩm phong thủy để bàn văn phòng cho nữ mệnh Kim ko?',at:'2026-10-16T01:48:00+00:00',from:'Dung Lê',att:[]},
 {id:'m2',c:'C9',dir:'out',text:'Giá đang là : 1700K - 1850K - 2150K - 2500K',at:'2026-10-16T02:45:00+00:00',from:'Page',staff:'Le Ninh',att:[]},
 {id:'m3',c:'C9',dir:'out',text:'em thích hai chiếc nào nhỉ?',at:'2026-10-16T03:02:00+00:00',from:'Page',staff:'Le Ninh',att:[]},
 {id:'m4',c:'C9',dir:'in',text:'Mặt mệnh mộc b ak',at:'2026-10-16T03:10:00+00:00',from:'Dung Lê',att:[]}];
const TAGS=[['26','L1. Chuẩn','#0a7a3a'],['5','L2 SĐT kết nối','#e64b3c'],['3','L3. Tiềm Năng','#f4a62a'],['4','L4. Kcnc/ Khảo','#6b7280'],['8','L5 Chốt','#e8863a'],['9','L5.1 Chờ','#d8d84a'],['10','L5.2 chờ lên','#18a05e'],['11','L6 Hủy','#3b82c4'],['7','S7 ninhLTK','#1fa463'],['12','S1 yenNTH2004','#4a6bd8'],['13','S2 anhNP1999','#d86ab0'],['14','S3 trangNH2005','#444'],['15','S6 anhtrinh1995','#2eb872'],['16','O16 Thuydinh199','#e88ac8'],['17','O8 huyenmai199','#c8a43a'],['18','O9 biichnguyen1','#7a6a4a'],['19','O10 Dungnguyen1','#3a5fc8'],['20','O11 thuyha88','#e86a6a'],['21','O12 minhquach19','#4a8ae8'],['22','O13 phuongthao2','#b8a0d8'],['23','O14 ninhnga99','#e84a4a'],['24','O15 nonghong198','#e8483c'],['25','L7 HN','#2ea86a'],['27','L8 Upsale','#2eaad8'],['28','L9 Chốt kéo','#e88a3a'],['29','L9.1 Kéo ck','#d8c84a'],['30','L9.2 Kéo lên','#f0c030'],['31','HT3','#e86a6a'],['32','Hiền tour shop','#18a05e'],['33','HT - Trang sức','#c8b83a'],['34','Hiền Phạm Tour','#2eb872'],['35','S8 haPTN','#2e9a6a'],['36','S9 thanhNP','#e84a3c'],['37','S10 Mainguyen97','#2e5aa8'],['38','O17 tuoipham199','#2eaab8'],['39','S17 NgocNB','#3a6ad8']].map(a=>({id:a[0],t:a[1],c:a[2]}));
await p.evaluateOnNewDocument((convs, msgs, TAGS) => {
  localStorage.setItem('ome_sess_token','TOK.abc'); localStorage.setItem('ome_sess_exp',String(Date.now()+1e9));
  localStorage.setItem('ome_auth', JSON.stringify({username:'admin',role:'admin',name:'Admin'}));
  const J = (o) => ({ ok:true, status:200, json: async()=>o, text: async()=>JSON.stringify(o), headers:{get:()=>null}, clone(){return this;} });
  window.fetch = async (u, o) => { u = String(u);
    if (/action=users/.test(u)) return J({users:[{username:'admin',name:'Admin',role:'admin',active:true,names:['Admin'],perms:[],team:''}]});
    if (/pkChatInbox/.test(u)) return J({ok:true,conversations:convs,gv:'x'});
    if (/pkChatConv/.test(u)) { const id=(u.match(/conv=([^&]+)/)||[])[1]||'C9'; return J({ok:true,messages:msgs.map(m=>({...m,c:id})),gv:'x'}); }
    if (/pkChatTags/.test(u)) return J({ok:true,tags:TAGS});
    return J({}); };
}, convs, msgs, TAGS);
await p.goto('http://localhost:' + port + '/index.html', { waitUntil: 'load', timeout: 60000 }).catch(e=>errs.push('goto '+e.message));
await new Promise(r => setTimeout(r, 4000));
await p.evaluate(() => { try { const dv=document.getElementById('login-overlay'); if (dv) dv.style.display='none'; } catch(e){} });
const info = await p.evaluate(() => { const o={}; o.tabchat=!!document.getElementById('tab-chat'); o.fn=typeof renderSocialChatTab; return o; });
console.log('page:', JSON.stringify(info), 'errors:', JSON.stringify(errs.slice(0,3)));
// mo Social > Chat nhu menu that
await p.evaluate(() => { try { window._splashOff && window._splashOff(); const b=document.getElementById('boot-splash'); if(b) b.remove(); ['empty-view','upload-zone'].forEach(i=>{const e=document.getElementById(i); if(e) e.style.display='none';}); const mp=document.getElementById('modal-gas-warn'); document.querySelectorAll('[id*="gas"][class*="modal"], .gas-banner, #assign-warn').forEach(e=>e.style.display='none'); const dv=document.getElementById('data-view'); if(dv) dv.style.display='flex'; const ap=document.querySelector('.app-header, header'); } catch(e){} });
await new Promise(r => setTimeout(r, 400));
await p.evaluate(() => { document.querySelectorAll('[id^="tab-"]').forEach(e=>{ if(e.id!=='tab-chat' && e.classList.contains('main')) e.style.display='none'; }); window._activeV9Tab='chat'; const t=document.getElementById('tab-chat'); t.style.display='flex'; document.getElementById('empty-state') && (document.getElementById('empty-state').style.display='none'); renderSocialChatTab(); });
await new Promise(r => setTimeout(r, 1500));
if (process.argv[6] === 'pick') { await p.evaluate(() => { scPick('C9'); }); await new Promise(r => setTimeout(r, 1500)); }
if (process.argv[7] === 'palette') { await p.evaluate(() => { pkTagOpen('sc-tags'); }); await new Promise(r => setTimeout(r, 800)); }
await p.evaluate(() => { document.querySelectorAll('div').forEach(d=>{ if (/Chiến dịch chưa lưu được lên Google Sheets/.test(d.textContent||'') && d.children.length<4 && d.getBoundingClientRect().width<500) { let x=d; while(x.parentElement && x.parentElement.getBoundingClientRect().width<520 && x.parentElement!==document.body) x=x.parentElement; x.style.display='none'; } }); const ev=document.getElementById('empty-view'); if(ev) ev.style.display='none'; });
await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: OUT });
const lay = await p.evaluate(() => { const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height), getComputedStyle(e).display+'/'+getComputedStyle(e).flexDirection]; }; return { wrap:r('#chat-wrap'), list:r('.sc-list'), convs:r('#sc-convs'), conv1:r('.sc-conv'), main:r('#sc-main'), msgs:r('#sc-msgs'), tags:r('#sc-tags'), compose:r('#sc-compose') }; });
console.log('layout [x,y,w,h,display]:', JSON.stringify(lay));
await b.close(); srv.close();

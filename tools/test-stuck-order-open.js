// Test: o DON KET bam vao mo duoc ho so khach (GAS tra them SDT + 3 cho giao dien: the Viec can lam js/34, danh sach Viec hom nay js/36, trang Cham soc js/40).
// Chay: node tools/test-stuck-order-open.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
let f=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);f++}else console.log('ok  :',m)};
// ── GAS ──
const gctx={console,Date,JSON,Math,parseInt,isNaN,String,Object,Array,
  LockService:{getScriptLock:()=>({tryLock:()=>true,waitLock(){},releaseLock(){}})},
  ContentService:{createTextOutput:s=>({setMimeType:()=>JSON.parse(s)}),MimeType:{JSON:1}},
  Utilities:{},SpreadsheetApp:{},CacheService:{},PropertiesService:{},Logger:{log(){}}};
vm.createContext(gctx); vm.runInContext(R('gas_v13.js'),gctx);
const run=(fn,...a)=>vm.runInContext(fn+'(...__a)',Object.assign(gctx,{__a:a}));
const now=Date.UTC(2026,9,25,5,0,0);
ok(vm.runInContext('TT_TRACK_HEADERS_',gctx).join()==='id,giaiDoan,giaiDoanTu,lanCuoiThay,saleBan,ngayTao,soDienThoai','sheet theo doi co cot soDienThoai');
const rows=run('_ttBuildRows_',[{id:'D1',giaiDoan:'Tiếp nhận đơn',trangThai:'Đang xử lý',saleBan:'anhNP1999',ngayTao:'24/10/2026 08:00',soDienThoai:'0912345678'}],[],now,{});
ok(rows.length===1&&rows[0].length===7&&rows[0][6]==='0912345678','dong theo doi ghi SDT khach o cot 7');
const items=run('_ttStuckFromRows_',[['D1','Tiếp nhận đơn',new Date(now-30*3600000),new Date(now),'anhNP1999','24/10/2026',912345678],['D2','Tạo đơn POS',new Date(now-30*3600000),new Date(now),'anhNP1999','24/10/2026']],'',24,now);
ok(items.length===2&&items.find(x=>x.id==='D1').phone==='0912345678','don ket tra phone (SDT bi Sheets doi thanh so van duoc bu so 0 dau)');
ok(items.find(x=>x.id==='D2').phone==='','dong cu 6 cot (chua chup lai): phone rong, khong loi');
// ── Client js/34 ──
const calls={phone:[],order:[],toast:[]};
const c={console,esc:s=>String(s==null?'':s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])),
  setTimeout(){},setInterval(){},gsUrl:'',toast:m=>calls.toast.push(m),
  _openCustomerByPhone_:p=>calls.phone.push(p),_alkOpenOrder_:o=>calls.order.push(o)};
vm.createContext(c); vm.runInContext(R('js/34-fn-todaytasks.js'),c);
const html=vm.runInContext('(function(){_ttState.open.stuckStage=true;return _ttCardHtml({key:"stuckStage",title:"t",count:1,items:[{id:"D1",stage:"Tiếp nhận đơn",hours:30,sale:"a",phone:"0912345678"}]})})()',c);
ok(/data-phone="0912345678" data-order="D1"[^>]*onclick="event\.stopPropagation\(\);ttOpenCustomer_\(this\.dataset\.phone,this\.dataset\.order\)"/.test(html),'the Viec can lam: dong don ket bam duoc, khong lam dong/mo the cha');
c.ttOpenCustomer_('0912345678','D1'); ok(calls.phone[0]==='0912345678'&&!calls.order.length,'co SDT -> mo thang khach');
c.ttOpenCustomer_('','D2'); ok(calls.order[0]==='D2','chua co SDT -> tra theo ID don roi mo khach');
c.ttOpenCustomer_('',''); ok(calls.toast.length===1,'khong co ca SDT lan ID -> bao ro, khong im lang');
// ── js/36 + js/40 ──
const h36=R('js/36-fn-homechips.js'), h40=R('js/40-fn-carepage.js');
ok(/out\.today\.push\(\{ phone: o\.phone \|\| '', orderId: o\.id, kind: 'order'/.test(h36),'js/36: don ket mang phone + orderId + kind');
ok(/data-order="' \+ esc\(it\.orderId\)[\s\S]*ttOpenCustomer_\(this\.dataset\.phone,this\.dataset\.order\)/.test(h36),'js/36: dong danh sach Viec hom nay bam duoc ca khi chua co SDT');
const fn=h40.match(/function _c2Rows\(\)\{[\s\S]*?\n}\n/)[0];
const c2={hmCompute:()=>({overdue:[{phone:'0900000001',name:'Khach A',sub:'hen'}],today:[{phone:'0912345678',orderId:'D1',kind:'order',name:'Đơn D1',sub:'kẹt'},{phone:'',orderId:'D2',kind:'order',name:'Đơn D2',sub:'kẹt'}],rebuy:[],idle:[]}),customerMap:{},careData:{}};
vm.createContext(c2); vm.runInContext(fn,c2);
const rr=vm.runInContext('_c2Rows()',c2);
ok(rr.find(x=>x.orderId==='D1').type==='order'&&rr.find(x=>x.phone==='0900000001').type==='call','js/40: don ket co SDT van xep loai "Don ket" (khong bi nham thanh "Hen goi")');
ok(rr.find(x=>x.orderId==='D2').type==='order','js/40: don ket khong SDT van la "Don ket"');
ok(/data-order="' \+ esc\(x\.orderId\)[\s\S]*ttOpenCustomer_\(this\.dataset\.phone,this\.dataset\.order\)/.test(h40),'js/40: dong bang bam duoc (co SDT hoac chi co ID don)');
process.exit(f?1:0);

// R5d bước 1 — giao diện xem khách trùng (js/87-cust-dup.js). Chạy: node tools/test-cust-dup.js (phần DOM cần jsdom qua NODE_PATH; thiếu thì bỏ qua)
const fs=require('fs'),path=require('path');const m=require('../js/87-cust-dup.js');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const row=(o)=>Object.assign({row:2,raw:'0912345678',name:'Lan',cs:'Hà',status:'Chốt',khStatus:'',noteLen:0,hasSched:false,nickZalos:'',updated:''},o);
const g={phone:'0912345678',count:2,keepRow:5,variants:['0912345678','+84912345678'],rows:[row({row:2}),row({row:5,raw:'+84912345678',noteLen:12,hasSched:true,nickZalos:'a;b'})]};
let h=m.cdGroupHtml_(g);
ok((h.match(/<tr class="cd-keep">/g)||[]).length===1&&h.includes('⭐ gợi ý giữ'),'đúng 1 dòng được đánh dấu gợi ý giữ (dòng Sheet 5)');
ok(h.includes('data-cd-open="0912345678"')&&h.includes('0912345678 | +84912345678')&&h.includes('2 dòng'),'có nút Mở hồ sơ, liệt kê các kiểu SĐT, số dòng');
ok(h.includes('12 ký tự')&&h.includes('✓')&&h.includes('a;b'),'hiện độ dài ghi chú, có lịch, nick Zalo');
h=m.cdGroupHtml_({phone:'<img onerror=1>',count:2,keepRow:2,variants:['"x'],rows:[row({name:'<script>alert(1)</script>',nickZalos:'"><u id=pwn>'})]});
ok(!h.includes('<script')&&!h.includes('<img')&&!h.includes('<u id=pwn>')&&h.includes('&lt;u id=pwn&gt;'),'escape HTML (SĐT/tên/nick) chống chèn mã');
ok(m.cdSummaryHtml_({groupCount:0,scanned:1234}).includes('Không có khách nào trùng')&&m.cdSummaryHtml_({groupCount:0,scanned:1234}).includes('1234'),'không trùng → báo ✅ + số dòng đã quét');
let s=m.cdSummaryHtml_({groupCount:600,extraRows:900,scanned:50000,truncated:true,groups:new Array(500)});ok(s.includes('600')&&s.includes('900')&&s.includes('chỉ hiện 500 nhóm đầu'),'quá nhiều nhóm → báo tổng + "chỉ hiện 500 nhóm đầu"');
const body=m.cdBodyHtml_({groupCount:1,extraRows:1,scanned:10,groups:[g]});
ok(body.includes('Chỉ XEM')&&body.includes('GIỮ TẤT CẢ')&&body.includes('theo đơn của từng khách'),'ghi chú rõ: chỉ xem, đơn/báo cáo không bị đụng, gộp sau sẽ giữ tất cả');
ok(m.cdErrText_({code:'FORBIDDEN'}).includes('quản trị viên chính')&&m.cdErrText_({error:'Unknown action'}).includes('chưa có chức năng')&&m.cdErrText_(null).length>0&&m.cdErrText_({error:'Lỗi X'})==='Lỗi X','thông báo lỗi: không quyền / GAS chưa deploy / không phản hồi / lỗi khác');
const ix=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
ok(ix.includes('js/87-cust-dup.js')&&ix.includes('css/30-cust-dup.css'),'index.html nạp js/87 + css/30');
const css=fs.readFileSync(path.join(__dirname,'../css/30-cust-dup.css'),'utf8');ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g,'')),'css/30 không dùng màu cứng (chỉ var(--ui-*))');
const src=fs.readFileSync(path.join(__dirname,'../js/87-cust-dup.js'),'utf8');ok(!/action=(saveSingle|saveBatch|dedupeCare|deleteOrder|patchOrder|save)\b/.test(src)&&/action=findDuplicateCustomers/.test(src),'JS chỉ gọi findDuplicateCustomers — không gọi action ghi/xoá nào');
let JSDOM;try{JSDOM=require('jsdom').JSDOM}catch(e){console.log('SKIP giao diện: cần jsdom (NODE_PATH)')}
if(JSDOM){
 const dom=new JSDOM('<body><button id="quick-add-btn">+</button></body>',{runScripts:'outside-only'});const w=dom.window;const calls=[];const opened=[];
 w.currentUser={role:'admin'};w.gsUrl='https://x/exec';w.openDp=p=>opened.push(p);w.toast=()=>{};
 w.fetch=(u)=>{calls.push(u);return Promise.resolve({json:()=>Promise.resolve({ok:true,scanned:5,groupCount:1,extraRows:1,groups:[g]})})};
 w.eval(src.replace(/if \(typeof module[\s\S]*$/,'')+'\nwindow.__open=cdOpen_;');
 (async()=>{
  await new Promise(r=>setTimeout(r,1700));
  const b=w.document.getElementById('cd-open-btn');ok(!!b&&b.previousElementSibling.id==='quick-add-btn','admin: nút "🔎 Khách trùng" xuất hiện cạnh "Thêm khách"');
  await w.__open();await new Promise(r=>setTimeout(r,50));
  ok(calls.length===1&&/action=findDuplicateCustomers$/.test(calls[0]),'mở bảng → gọi đúng 1 lần action chỉ-đọc');
  ok(!!w.document.querySelector('#cd-modal .cd-group'),'bảng hiện nhóm trùng');
  w.document.querySelector('[data-cd-open]').click();ok(opened[0]==='0912345678'&&!w.document.getElementById('cd-modal'),'"Mở hồ sơ" → openDp đúng SĐT, đóng bảng');
  w.currentUser={role:'cs'};calls.length=0;await w.__open();ok(calls.length===0,'không phải admin → KHÔNG gọi máy chủ');
  const d2=new JSDOM('<body><button id="quick-add-btn">+</button></body>',{runScripts:'outside-only'}).window;d2.currentUser={role:'cs'};d2.eval(src.replace(/if \(typeof module[\s\S]*$/,''));
  await new Promise(r=>setTimeout(r,1700));ok(!d2.document.getElementById('cd-open-btn'),'CS thường: KHÔNG thấy nút');
  console.log(bad?'CÓ LỖI':'TẤT CẢ ĐẠT');process.exit(bad?1:0);
 })();
}else{console.log(bad?'CÓ LỖI':'TẤT CẢ ĐẠT');process.exit(bad?1:0);}

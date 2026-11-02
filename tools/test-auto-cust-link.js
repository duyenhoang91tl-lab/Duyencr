// Test js/58-auto-cust-link.js bằng jsdom (cần: npm i jsdom, NODE_PATH trỏ tới node_modules). Chạy: node tools/test-auto-cust-link.js
const fs=require('fs'),path=require('path');
let JSDOM; try{ ({JSDOM}=require('jsdom')); }catch(e){ console.log('SKIP: can jsdom'); process.exit(0); }
const code=fs.readFileSync(path.join(__dirname,'..','js/58-auto-cust-link.js'),'utf8');
let f=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);f++}else console.log('ok  :',m)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const dom=new JSDOM(`<body>
   <table><tbody><tr id="r1" onclick="window.rowClicked=1"><td id="c1">Nguyễn A 0912345678</td><td id="c2">568T10/2026</td></tr>
   <tr id="r2" data-counter="777T10/2026"><td id="c3">777T10/2026 · 0987654321</td></tr></tbody></table>
   <input id="in" value="0911111111"><textarea id="ta">0922222222</textarea><button id="bt">0933333333</button>
   <span class="cust-link" data-cust-phone="0944444444" id="old">0944444444</span>
   <div id="dp-overlay"><span id="inprof">0955555555</span></div>
   <div id="amt">Doanh thu 1.500.000.000đ · 20912345678 · ID 12345678</div>
   <div id="plus">+84912345678 và 84912345678</div></body>`,{runScripts:'outside-only',pretendToBeVisual:true,url:'http://localhost/'});
  const w=dom.window;
  const calls={phone:[],fetch:[],toast:[]};
  w._openCustomerByPhone_=async p=>{calls.phone.push(p)};
  w.toast=m=>calls.toast.push(m);
  w.gsUrl='https://gas.example/exec';
  w.fetch=async u=>{calls.fetch.push(u);return {json:async()=>({results:[{code:'568T10/2026',phone:'0911223344'},{code:'X',phone:'0999'}]})}};
  w.eval(code);
  await sleep(450);
  const d=w.document, q=s=>d.querySelector(s);
  ok(q('#c1 [data-alk-phone="0912345678"]'),'SDT trong o bang duoc boc');
  ok(q('#c1').textContent==='Nguyễn A 0912345678','van ban goc khong doi (copy/xuat Excel an toan)');
  ok(q('#c2 [data-alk-order="568T10/2026"]'),'ma bo dem duoc boc');
  ok(!q('#c3 [data-alk-order]')&&q('#c3 [data-alk-phone="0987654321"]'),'dong co data-counter: giu nguyen ma don (bam mo popup don), van boc SDT');
  ok(!q('#in .alk')&&!q('#ta .alk')&&!q('#bt .alk'),'khong boc trong input/textarea/button');
  ok(q('#old').children.length===0,'chu da bam duoc (cust-link cu) khong boc lai');
  ok(!q('#inprof .alk'),'khong boc trong ngan ho so khach (#dp-overlay)');
  ok(!q('#amt .alk'),'so tien / so 11 chu so bat dau khac 0 / ID 8 so khong bi nham la SDT');
  ok(q('#plus [data-alk-phone="+84912345678"]')&&q('#plus [data-alk-phone="84912345678"]'),'+84 / 84 duoc nhan');
  // nội dung thêm sau (render lại)
  const el=d.createElement('div'); el.id='late'; el.textContent='Khach moi 0965432100'; d.body.appendChild(el);
  await sleep(450);
  ok(q('#late [data-alk-phone="0965432100"]'),'noi dung them sau (render lai) cung duoc boc');
  const n1=d.querySelectorAll('.alk').length; await sleep(450);
  ok(d.querySelectorAll('.alk').length===n1&&!q('.alk .alk'),'khong boc long / khong lap vo han');
  // bấm SĐT: mở hồ sơ, không kích hoạt onclick dòng cha
  q('#c1 .alk').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  ok(calls.phone[0]==='0912345678'&&!w.rowClicked,'bam SDT -> mo ho so khach, khong kich hoat onclick dong cha');
  // bấm khi đang bôi đen -> không mở
  const rg=d.createRange(); rg.selectNodeContents(q('#c1 .alk')); w.getSelection().removeAllRanges(); w.getSelection().addRange(rg);
  q('#c1 .alk').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  ok(calls.phone.length===1,'dang boi den chu de copy -> khong mo');
  w.getSelection().removeAllRanges();
  // bấm mã đơn -> hỏi searchOrder -> mở đúng khách (khớp chính xác mã)
  q('#c2 .alk').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
  await sleep(50);
  ok(/action=searchOrder&q=568T10%2F2026/.test(calls.fetch[0]||''),'bam ma don -> goi searchOrder');
  ok(calls.phone[1]==='0911223344','mo dung khach cua ma don (khop chinh xac ma)');
  q('#c2 .alk').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); await sleep(30);
  ok(calls.fetch.length===1&&calls.phone[2]==='0911223344','bam lai: dung cache, khong goi server lan nua');
  // mã đơn không có kết quả
  w.fetch=async()=>({json:async()=>({results:[]})});
  const e2=d.createElement('div'); e2.textContent='999T01/2026'; d.body.appendChild(e2); await sleep(450);
  e2.querySelector('.alk').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true})); await sleep(30);
  ok(calls.toast.some(x=>/Không tìm thấy khách của mã đơn 999T01\/2026/.test(x)),'ma don khong co khach -> bao ro, khong im lang');
  // hiệu năng: 3000 dòng
  const big=d.createElement('div'); let h=''; for(let i=0;i<3000;i++) h+='<p>Khach '+i+' 09'+String(10000000+i)+'</p>'; big.innerHTML=h; d.body.appendChild(big);
  const t0=Date.now(); for(let i=0;i<40;i++){ await sleep(100); if(big.querySelectorAll('.alk').length>=3000) break; }
  ok(big.querySelectorAll('.alk').length===3000,'3000 dong: boc het ('+big.querySelectorAll('.alk').length+') trong '+(Date.now()-t0)+'ms, chia lo khong treo');
  // tách chữ
  const sp=w._alkSplit_;
  ok(sp('abc')===null&&sp('x 0123456789012 y')===null,'split: khong co / chuoi so qua dai -> null');
  ok(JSON.stringify(sp('SĐT 0912345678, đơn 12T3/2026.').map(x=>x.k))==='["t","p","t","o","t"]','split: tach dung SDT va ma don trong 1 cau');
  // index.html có nạp file
  ok(/<script src="js\/58-auto-cust-link\.js"><\/script>/.test(fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8')),'index.html nap js/58');
  process.exit(f?1:0);
})();

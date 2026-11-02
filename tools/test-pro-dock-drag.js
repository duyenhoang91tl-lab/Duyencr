// Test (2026-10-27): icon 🤖 (js/38-pro-dock.js) kéo thả tới góc bất kỳ, nhớ vị trí, bấm thường vẫn mở panel, bấm đúp về chỗ cũ.
// Chạy: NODE_PATH=<nơi cài jsdom> node tools/test-pro-dock-drag.js
const {JSDOM}=require('jsdom');const fs=require('fs');
let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const src=fs.readFileSync('js/38-pro-dock.js','utf8');
const a=src.indexOf('function proDockClamp_'),b=src.indexOf('// Dock phải + panel trợ lý');
const dom=new JSDOM('<body></body>',{runScripts:'dangerously',url:'https://crm.test/'});const w=dom.window;
Object.defineProperty(w,'innerWidth',{value:1000,configurable:true});Object.defineProperty(w,'innerHeight',{value:700,configurable:true});
w.eval(src.slice(a,b));
const C=(...x)=>JSON.stringify(w.proDockClamp_(...x));
ok(C(100,200,48,48,1000,700)==='{"x":100,"y":200}','trong khung: giữ nguyên');
ok(C(-50,-9,48,48,1000,700)==='{"x":4,"y":4}','kéo ra ngoài góc trên-trái: kẹp lại, chừa lề 4px');
ok(C(5000,5000,48,48,1000,700)==='{"x":948,"y":648}','kéo ra ngoài góc dưới-phải: kẹp lại, vẫn thấy icon');
ok(C(NaN,undefined,48,48,1000,700)==='{"x":936,"y":564}','vị trí lưu hỏng/NaN: về góc dưới-phải mặc định');
// dựng dock giả với getBoundingClientRect theo style
const dock=w.document.createElement('div');dock.id='pro-dock';dock.innerHTML='<button id="pro-dock-ai"></button>';w.document.body.appendChild(dock);
dock.getBoundingClientRect=()=>({left:parseFloat(dock.style.left)||936,top:parseFloat(dock.style.top)||564,width:48,height:48});
let opened=0;dock.querySelector('button').onclick=function(){ if(dock._proMovedAt&&Date.now()-dock._proMovedAt<350) return; opened++; };
w.proDockDragInit_(dock);
const ev=(type,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});e.clientX=x;e.clientY=y;e.pointerId=1;e.button=0;return e;};
const fire=(t,x,y)=>dock.dispatchEvent(ev(t,x,y));
// bấm thường (không dịch chuyển) → mở panel, không đổi vị trí
fire('pointerdown',960,580);fire('pointerup',960,580);dock.querySelector('button').onclick();
ok(opened===1&&!dock.style.left,'bấm thường: mở panel, KHÔNG đổi vị trí');
// kéo lên giữa màn hình
fire('pointerdown',960,580);fire('pointermove',900,400);fire('pointermove',500,300);fire('pointerup',500,300);
ok(dock.style.left==='476px'&&dock.style.top==='284px','kéo tới giữa màn hình: left/top = '+dock.style.left+'/'+dock.style.top);
ok(dock.style.getPropertyValue('right')==='auto'&&dock.style.getPropertyValue('transform')==='none','bỏ right/bottom/transform mặc định để vị trí tự do');
const saved=JSON.parse(w.localStorage.getItem('pro_dock_pos'));ok(saved.x===476&&saved.y===284,'nhớ vị trí trên máy');
dock.querySelector('button').onclick();ok(opened===1,'vừa kéo xong: KHÔNG mở panel nhầm');
// kéo ra ngoài → kẹp
fire('pointerdown',500,300);fire('pointermove',-400,-400);fire('pointerup',-400,-400);
ok(dock.style.left==='4px'&&dock.style.top==='4px','kéo ra ngoài: kẹp trong khung');
// rung tay < 6px = bấm
const before=dock.style.left;fire('pointerdown',100,100);fire('pointermove',102,103);fire('pointerup',102,103);
ok(dock.style.left===before,'dịch < 6px coi là bấm, không kéo');
// tải lại trang: khôi phục vị trí
const dock2=w.document.createElement('div');w.document.body.appendChild(dock2);dock2.getBoundingClientRect=dock.getBoundingClientRect;w.proDockDragInit_(dock2);
ok(dock2.style.left==='4px'&&dock2.style.top==='4px','mở lại: khôi phục vị trí đã lưu');
// vị trí lưu nằm ngoài màn hình nhỏ hơn → kẹp
w.localStorage.setItem('pro_dock_pos',JSON.stringify({x:9000,y:9000}));const dock3=w.document.createElement('div');w.document.body.appendChild(dock3);dock3.getBoundingClientRect=()=>({left:parseFloat(dock3.style.left)||0,top:parseFloat(dock3.style.top)||0,width:48,height:48});w.proDockDragInit_(dock3);
ok(dock3.style.left==='948px'&&dock3.style.top==='648px','vị trí đã lưu ngoài màn hình (đổi máy/xoay): kẹp lại, không mất icon');
// bấm đúp = về mặc định
dock.dispatchEvent(new w.Event('dblclick',{bubbles:true}));
ok(!dock.style.left&&!dock.style.top&&w.localStorage.getItem('pro_dock_pos')===null,'bấm đúp: về chỗ mặc định + xoá vị trí đã lưu');
console.log(bad?'\n'+bad+' LỖI':'\nALL PRO-DOCK-DRAG TESTS PASSED');process.exit(bad?1:0);

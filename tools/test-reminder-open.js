// Test: bấm thẻ nhắc hẹn mở được hồ sơ cả khi khách chưa có trong danh sách đang tải. Chạy: node tools/test-reminder-open.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const j5=fs.readFileSync(path.join(root,'js/05-fn-saveeditphone.js'),'utf8');
const j29=fs.readFileSync(path.join(root,'js/29-sidenav.js'),'utf8');
let f=0;const ok=(c,m)=>{if(!c){console.log('FAIL:',m);f++}else console.log('ok  :',m)};
// 1) thẻ nhắc hẹn không còn gọi thẳng openDp
const card=j5.match(/class="rp-card-main" data-phone[^\n]*/)[0];
ok(/_remOpenCustomer_\(this\.dataset\.phone\)/.test(card)&&!/onclick="openDp\(/.test(card),'the nhac hen goi _remOpenCustomer_, khong goi thang openDp');
// 2) hành vi: dựng _remOpenCustomer_ + _openCustomerByPhone_ thật với stub
const fn=(src,name)=>{const m=src.match(new RegExp('(async )?function '+name+'\\([\\s\\S]*?\\n}\\n'));return m[0]};
function mk(inMap){
  const calls={opened:[],pulled:[],toast:[]};
  const ctx={customerMap:inMap?{'0912345678':{}}:{},normPhone:p=>{p=String(p).replace(/\D/g,'');return p.length===9?'0'+p:p},
    document:{body:{classList:{contains:()=>false}}},
    toast:m=>calls.toast.push(m),openDp:p=>calls.opened.push(p),
    _pullSearchCustomer_:async p=>{calls.pulled.push(p);ctx.customerMap[p]={};return p}};
  vm.createContext(ctx);
  vm.runInContext(fn(j29,'_openCustomerByPhone_')+fn(j5,'_remOpenCustomer_'),ctx);
  return {ctx,calls};
}
(async()=>{
  let t=mk(true);await t.ctx._remOpenCustomer_('0912345678');
  ok(t.calls.opened[0]==='0912345678'&&!t.calls.pulled.length,'khach da co trong danh sach: mo ngay, khong nap them');
  t=mk(false);await t.ctx._remOpenCustomer_('0912345678');
  ok(t.calls.pulled[0]==='0912345678'&&t.calls.opened[0]==='0912345678','khach ngoai danh sach: nap rieng roi mo ho so');
  ok(t.calls.toast.some(x=>/Đang tải/.test(x)),'co bao "Dang tai ho so khach" khi phai nap');
  t=mk(false);await t.ctx._remOpenCustomer_('912345678');
  ok(t.calls.pulled[0]==='0912345678'&&t.calls.opened[0]==='0912345678','SDT thieu so 0 duoc chuan hoa roi mo');
  process.exit(f?1:0);
})();

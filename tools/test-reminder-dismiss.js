// Test "Tắt hết" trong khung 🔔 Nhắc hẹn: phải tắt MỌI loại thẻ đang hiện (lịch hẹn, Được chia data, Việc cần làm/đơn Base kẹt).
// Lỗi gốc: dismissAllReminders chỉ tắt lịch hẹn → còn thẻ "Được chia data"/"Việc cần làm" nên khung không đóng. Chạy các hàm THẬT trong js/05 + js/34.
const fs=require('fs'),vm=require('vm');let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const grab=(src,name)=>{const i=src.indexOf('function '+name+'(');if(i<0)return '';let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]=='{')d++;if(src[k]=='}'){d--;if(!d)return src.slice(i,k+1);}}return '';};
const s05=fs.readFileSync('js/05-fn-saveeditphone.js','utf8'),s34=fs.readFileSync('js/34-fn-todaytasks.js','utf8');
function boot(day){
  const store={};
  const ctx={localStorage:{getItem:k=>store[k]===undefined?null:store[k],setItem:(k,v)=>{store[k]=String(v)}},
    _ymd:()=>ctx.DAY,DAY:day,renderReminderPanel(){},
    currentUser:{role:'cs',name:'Hằng'},_authAccount:{username:'hang',name:'Hằng'},
    schedules:[{id:'s1',phone:'0901',type:'goi',date:'2026-10-10',note:'goi',done:false,ownerUser:'hang',owner:'Hằng'}],
    careData:{'0902':{schedHen:'2026-10-11',schedHenNote:'hen'}},customerMap:{},_customerByPhone:()=>null,
    assignHistory:[{id:'h1',csName:'Hằng',label:'Chia 5 KH',phones:['1','2','3','4','5'],date:'2026-10-09'}],
    _ttState:{tasks:[{key:'base24',title:'Đơn Base kẹt >24h',count:4,items:[]},{key:'rong',title:'x',count:0,items:[]}],open:{}}};
  vm.createContext(ctx);
  ['_remDateStr','_remId','_remLoadDismissed','_remSaveDismissed','dismissAllReminders','_dueReminders','_remHasOwner','_remAcctId','_remOwnedByMe','_chiaDataAlerts','_remVisibleTts','_dismissChiaAlert'].forEach(n=>vm.runInContext(grab(s05,n),ctx));
  vm.runInContext(grab(s34,'_ttCards'),ctx);
  ctx.total=()=>vm.runInContext('_dueReminders().length + _chiaDataAlerts().length + (typeof _remVisibleTts==="function" ? _remVisibleTts() : _ttCards()).length',ctx);
  ctx.parts=()=>vm.runInContext('[_dueReminders().length,_chiaDataAlerts().length,(typeof _remVisibleTts==="function"?_remVisibleTts():_ttCards()).length].join()',ctx);
  return ctx;
}
let c=boot('2026-10-11');
ok(c.parts()==='2,1,1','trước khi tắt: 2 lịch hẹn (schedules + careData) + 1 Được chia data + 1 Việc cần làm (thẻ count=0 bị bỏ)');
vm.runInContext('dismissAllReminders()',c);
ok(c.total()===0,'bấm "Tắt hết" → KHÔNG còn thẻ nào (khung phải đóng); còn lại: '+c.parts());
c.DAY='2026-10-12';
// Sang ngày mới: việc "tắt hôm nay" phải hiện lại (lịch hẹn quá hạn vẫn chưa done; chia data + việc cần làm)
ok(c.parts().split(',')[1]==='1'&&c.parts().split(',')[2]==='1','sang ngày mới: "Được chia data" + "Việc cần làm" hiện lại (tắt hết chỉ là tạm trong ngày)');
// ✕ từng thẻ "Được chia data" vẫn là tắt vĩnh viễn như cũ
c=boot('2026-10-11');vm.runInContext("_dismissChiaAlert('a:h1')",c);c.DAY='2026-10-20';
ok(c.parts().split(',')[1]==='0','✕ riêng thẻ Được chia data vẫn tắt LUÔN (hành vi cũ giữ nguyên)');
// Lịch mới tạo sau khi Tắt hết vẫn hiện
c=boot('2026-10-11');vm.runInContext('dismissAllReminders()',c);
vm.runInContext("schedules.push({id:'s2',phone:'0903',type:'cs',date:'2026-10-11',note:'moi',done:false,ownerUser:'hang',owner:'Hằng'})",c);
ok(c.parts().split(',')[0]==='1','lịch hẹn MỚI tạo sau "Tắt hết" vẫn hiện bình thường');
// Dữ liệu tắt hôm nay được nhớ qua lần tải lại (localStorage)
c=boot('2026-10-11');vm.runInContext('dismissAllReminders()',c);
const saved=JSON.parse(c.localStorage.getItem('ome_dismissed_remind'));
ok(saved['tt:base24']==='2026-10-11'&&saved['a:h1']==='2026-10-11'&&saved['r:s1']==='2026-10-11','lưu đủ 3 loại vào ome_dismissed_remind (nhớ khi F5/15 phút tải lại việc cần làm)');
process.exit(bad?1:0);

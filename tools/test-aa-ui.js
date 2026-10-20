// Test UI chia data: o trang thai chia tu dong + danh sach CS (admin thay ca thanh vien Team). Chay: node tools/test-aa-ui.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const rd=f=>fs.readFileSync(path.join(__dirname,'..','js',f),'utf8');
const ex=(src,name)=>{const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}};
let ok=0,fail=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:fail++;};
const ctx={esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))};vm.createContext(ctx);
vm.runInContext(ex(rd('14-fn-aasplit.js'),'_aaStatusHtml')+'\n'+ex(rd('03-fn-refreshopendptab.js'),'_csPickList_')+';this.st=_aaStatusHtml;this.pick=_csPickList_;',ctx);
// --- trang thai ---
t('chua tung chay: bao ro',/Chưa có lần chạy/.test(ctx.st({})));
let h=ctx.st({lastRun:'2026-10-14',lastBy:'server',lastResult:{date:'2026-10-14',total:0,people:0,short:[{name:'A'}],warn:['Khong chia duoc ca nao: khong KH nao co ngay don trong khoang <x>']}});
t('khong chia duoc: hien LY DO (da escape HTML) + tu dong (server)',/Không chia được KH nào/.test(h)&&/khong KH nao co ngay don/.test(h)&&/&lt;x&gt;/.test(h)&&/tự động \(server\)/.test(h)&&!/Thiếu KH/.test(h));
h=ctx.st({lastRun:'2026-10-14',lastBy:'server',lastResult:{total:12,people:3,short:[{name:'A'}],warn:[]}});
t('chia duoc: so KH, so nguoi, canh bao thieu',/Đã chia 12 KH cho 3 người/.test(h)&&/Thiếu KH cho 1 người/.test(h));
h=ctx.st({lastRun:'2026-10-13',lastError:{at:'2026-10-14T03:00:00.000Z',msg:'urlfetch qua nhieu',partial:false}});
t('loi chua chia ca nao: noi se tu thu lai',/Lỗi lần chạy 2026-10-14 03:00: urlfetch qua nhieu/.test(h)&&/tự thử lại/.test(h));
h=ctx.st({lastRun:'2026-10-14',lastError:{at:'2026-10-14T03:00:00.000Z',msg:'x',partial:true}});
t('loi sau khi da chia mot phan: noi khong chay lai de tranh trung',/đã chia một phần/.test(h)&&/tránh chia trùng/.test(h));
// --- danh sach CS ---
const cust=[{orders:[{cs:'Lan'},{cs:' Hoa '},{cs:''}]},{orders:[{cs:'Lan'}]},{orders:[]}];
const teams=[{leader:'Minh',members:['Minh','Tuan','']},{leader:'',members:['Lan','Zed']}];
t('admin: CS trong don + moi thanh vien/truong nhom Team (khong trung, bo rong, sap xep)',JSON.stringify(ctx.pick(cust,teams,true))===JSON.stringify(['Hoa','Lan','Minh','Tuan','Zed']));
t('khong phai admin: giu hanh vi cu (chi CS trong don)',JSON.stringify(ctx.pick(cust,teams,false))===JSON.stringify(['Hoa','Lan']));
t('khong co du lieu -> mang rong, khong loi',ctx.pick(null,null,true).length===0&&ctx.pick([{}],[{}],true).length===0);
console.log(fail?('FAILED '+fail):'ALL AA UI TESTS PASSED');process.exit(fail?1:0);

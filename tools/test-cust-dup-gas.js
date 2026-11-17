// R5d bước 1 — custDupGroups_ (GAS, hàm thuần): nhóm các dòng CareData cùng SĐT chuẩn hoá. Chạy: node tools/test-cust-dup-gas.js
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','gas_v13.js'),'utf8');
const grab=(name)=>{const i=src.indexOf('function '+name+'(');if(i<0)throw new Error('khong thay ham '+name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(d===0)return src.slice(i,k+1)}}throw new Error('khong dong ham '+name)};
const grabVar=(name)=>{const m=src.match(new RegExp('^var '+name+'\\s*=[\\s\\S]*?;','m'));if(!m)throw new Error('khong thay bien '+name);return m[0]};
const ctx={};vm.createContext(ctx);vm.runInContext(grabVar('CARE_HEADERS'),ctx);['normPhone_','custDupGroups_'].forEach(n=>vm.runInContext(grab(n),ctx));
let bad=0;const ok=(c,t)=>{if(!c){bad++;console.log('FAIL',t)}else console.log('ok  ',t)};
const H=ctx.CARE_HEADERS;ok(H.length===22&&H[0]==='phone'&&H[19]==='name'&&H[20]==='custom'&&H[21]==='zaloPhones','CARE_HEADERS hiện 22 cột (20 cột trong tài liệu kỹ thuật + custom + zaloPhones)');
const row=(o)=>H.map(h=>o[h]==null?'':o[h]);
const D=(rows)=>[H].concat(rows.map(row));
// Ca thật: cùng 1 khách gõ 4 kiểu + 1 khách đơn + 1 nhóm 2 dòng
const data=D([
 {phone:'0912345678',name:'Nguyễn Lan',cs:'Hà',status:'Chốt',note:'Khách mua 2 hộp',updated:'2026-11-01'},
 {phone:'912345678',name:'Lan',note:'',updated:'2026-11-10'},
 {phone:'+84912345678',name:'Nguyễn Lan',cs:'Hà',status:'Chốt',khStatus:'VIP',note:'Hẹn gọi T7',schedules:'x',nickZalos:'a;b',updated:'2026-11-05'},
 {phone:'84912345678'},
 {phone:'0987000111',name:'Đạt'},
 {phone:'0911222333',name:'A',updated:'2026-10-01'},{phone:'0911222333',name:'A',updated:'2026-10-05'},
 {phone:''},{phone:'abc'},{phone:'12'}
]);
const r=ctx.custDupGroups_(data);
ok(r.groupCount===2&&r.extraRows===4,'2 nhóm trùng, 4 dòng thừa (3 dòng của 0912345678 + 1 dòng của 0911222333)');
ok(r.scanned===7,'scanned = 7 dòng có SĐT hợp lệ (bỏ dòng rỗng, "abc", "12" ngắn hơn 8 số)');
const g1=r.groups[0];ok(g1.phone==='0912345678'&&g1.count===4&&g1.variants.length===4,'nhóm lớn nhất xếp đầu, gom đủ 4 kiểu SĐT (0912…, 912…, +84…, 84…)');
ok(g1.keepRow===4,'gợi ý GIỮ dòng nhiều dữ liệu nhất (dòng sheet số 4 = bản +84 đủ khoá/lịch/nick)');
const g2=r.groups[1];ok(g2.phone==='0911222333'&&g2.keepRow===8,'hoà số ô → giữ dòng cập nhật mới nhất');
ok(g1.rows[0].row===2&&g1.rows[1].raw==='912345678'&&g1.rows[2].hasSched===true&&g1.rows[2].noteLen===10&&g1.rows[2].nickZalos==='a;b','số dòng Sheet thật (từ 2), SĐT gốc, có lịch, độ dài ghi chú, nick Zalo');
ok(!r.groups.some(g=>g.phone==='0987000111'),'khách chỉ có 1 dòng KHÔNG vào danh sách');
ok(!r.truncated,'không cắt');
// Không sửa dữ liệu đầu vào
const snap=JSON.stringify(data);ctx.custDupGroups_(data);ok(JSON.stringify(data)===snap,'CHỈ ĐỌC: không đụng mảng dữ liệu vào');
// Tiêu đề cột bị xáo thứ tự → vẫn nhận đúng theo TÊN
const H2=H.slice().reverse();const d2=[H2,H2.map(h=>({phone:'0900111222',name:'Z',cs:'Hà'}[h]||'')),H2.map(h=>({phone:'900111222',name:'Z',cs:''}[h]||''))];
const r2=ctx.custDupGroups_(d2);ok(r2.groupCount===1&&r2.groups[0].rows[0].cs==='Hà'&&r2.groups[0].rows[0].name==='Z','đọc cột theo TÊN tiêu đề (không phụ thuộc thứ tự cột)');
// Trống / chỉ có tiêu đề
ok(ctx.custDupGroups_([H]).groupCount===0&&ctx.custDupGroups_([]).groupCount===0&&ctx.custDupGroups_(null).groupCount===0,'sheet trống/chỉ tiêu đề → 0 nhóm, không lỗi');
// Cắt khi quá nhiều nhóm
const many=[H];for(let i=0;i<30;i++){many.push(row({phone:'09'+String(10000000+i)}));many.push(row({phone:'9'+String(10000000+i)}))}
const r3=ctx.custDupGroups_(many,10);ok(r3.groupCount===30&&r3.groups.length===10&&r3.truncated===true,'quá 10 nhóm → cắt còn 10 nhưng vẫn báo tổng 30 + truncated');
// Hiệu năng: 60.000 dòng
const big=[H];for(let i=0;i<60000;i++)big.push(row({phone:'09'+String(10000000+i),name:'K'+i}));for(let i=0;i<300;i++)big.push(row({phone:String(910000000+i)}));
let t0=Date.now();const r4=ctx.custDupGroups_(big);ok(r4.groupCount===300&&Date.now()-t0<1500,'60.000 khách + 300 trùng: '+(Date.now()-t0)+'ms');
// Nối vào doGet + quyền
ok(/if \(action === 'findDuplicateCustomers'\) return jsonOut_\(findDuplicateCustomers_\(\)\);/.test(src),'doGet có route findDuplicateCustomers');
ok(/OWNER_ONLY_ACTIONS_ = \{[^}]*findDuplicateCustomers: 1/.test(src),'chỉ quản trị viên chính gọi được (OWNER_ONLY_ACTIONS_)');
const fnBody=grab('findDuplicateCustomers_');ok(!/setValues|clearContents|deleteRow|appendRow|setValue\(/.test(fnBody)&&!/setValues|clearContents|deleteRow|appendRow/.test(grab('custDupGroups_')),'KHÔNG có lệnh ghi Sheet trong 2 hàm (chỉ đọc)');
console.log(bad?'\nCÓ LỖI':'\nTẤT CẢ ĐẠT');process.exit(bad?1:0);

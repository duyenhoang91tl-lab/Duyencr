// Test trang riêng "Phòng ban" (js/35-fn-deptsettings.js). Chạy: NODE_PATH=<nơi cài jsdom> node tools/test-dept-settings.js
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','js','35-fn-deptsettings.js'),'utf8');
let ok=0,bad=0;const t=(n,v)=>{console.log((v?'OK  ':'FAIL')+' '+n);v?ok++:bad++;};
const mk=()=>{
  const dom=new JSDOM('<body></body>',{runScripts:'dangerously',pretendToBeVisual:true}),w=dom.window;
  const S={store:{deptList:JSON.stringify([{key:'sale',label:'Sale'},{key:'hr',label:'HR'}]),saleDepts:JSON.stringify({An:'sale'})},mode:'',posts:[],gets:[],toasts:[],ovCalls:0,confirmAns:true};
  w.fetch=async(u,o)=>{
    const isPost=o&&o.method==='POST',res=(body,status=200)=>({status,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
    if(S.mode==='down') throw new Error('Failed to fetch');
    if(!isPost){S.gets.push(u);const key=decodeURIComponent((/key=([^&]+)/.exec(u)||[])[1]||'');return res({value:S.store[key]??null});}
    const b=JSON.parse(o.body);S.posts.push(b);
    if(S.mode==='html') return res('<html><body>Google Drive: sorry, unable to open the file</body></html>');
    if(S.mode==='fail2'&&b.key==='saleDepts') return res({error:'Service invoked too many times'});
    if(S.mode!=='mismatch') S.store[b.key]=b.value;
    return res({ok:true});
  };
  Object.assign(w,{gsUrl:'https://gs.example/exec',currentUser:{role:'admin'},esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    toast:m=>S.toasts.push(m),confirm:()=>S.confirmAns, get uiConfirm() { return async (...a) => this.confirm(...a); },_ov:{data:null},teams:[{name:'Team A',members:['An','Binh']},{name:'Team B',members:['Chi']}],accounts:[{name:'Dung',names:'dung1,dung2'}],
    _ovAfterRoomChange:()=>{S.ovCalls++;if(S.ovThrow)throw new Error('ov fail')}});
  w.eval(code);return {w,S,$:id=>w.document.getElementById(id)};
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let c=mk();c.w.currentUser.role='cs';await c.w.openDeptSettings();
 t('không phải admin → chặn, không mở trang',!c.$('dp-page')&&c.S.toasts.slice(-1)[0].includes('Chỉ Admin'));
 // mở: đọc thẳng từ máy chủ, KHÔNG cần Tổng quan
 c=mk();await c.w.openDeptSettings();
 t('mở được khi Tổng quan CHƯA tải (_ov.data=null) — đọc từ máy chủ',!!c.$('dp-page').classList.contains('open')&&c.S.gets.length===2);
 t('hiện 2 phòng đúng từ máy chủ + có 3 mục nav',c.$('dp-page').querySelectorAll('.dpg-row').length===2&&c.$('dp-page').querySelectorAll('.rs-navbtn').length===3);
 t('nút Lưu ở thanh trên, ban đầu tắt (chưa sửa gì)',c.$('dp-save').disabled===true&&c.$('dp-dirty').style.display==='none');
 t('lần đọc có tham số chống cache _t=',c.S.gets.every(u=>/[?&]_t=\d+/.test(u)));
 // sửa → bật nút Lưu
 c.w.eval("_dpRoomLabel(1,'Nhân sự')");
 t('sửa tên phòng → hiện "Chưa lưu" + bật nút Lưu',c.$('dp-dirty').style.display===''&&c.$('dp-save').disabled===false);
 await c.w.eval('_dpSave()');
 t('lưu OK: ghi đúng 2 key (deptList rồi saleDepts)',c.S.posts.map(p=>p.key).join()==='deptList,saleDepts');
 t('lưu OK: đã ĐỌC LẠI xác nhận (có GET sau POST) và báo xanh',c.S.gets.length===4&&/Đã lưu và xác nhận/.test(c.$('dp-okbar').textContent)&&c.$('dp-okbar').style.display!=='none');
 t('lưu OK: biến DEPT_LIST cập nhật + làm mới Tổng quan 1 lần + hết "chưa lưu"',c.w.eval('DEPT_LIST.map(g=>g.label).join()')==='Sale,Nhân sự'&&c.S.ovCalls===1&&c.$('dp-save').disabled===true);
 t('nội dung lưu đúng trên máy chủ',JSON.parse(c.S.store.deptList)[1].label==='Nhân sự');
 // lỗi: máy chủ trả HTML (trước đây bị nuốt thành "lưu OK")
 c=mk();await c.w.openDeptSettings();c.w.eval("_dpRoomLabel(0,'Bán hàng')");c.S.mode='html';await c.w.eval('_dpSave()');
 t('máy chủ trả HTML → báo LỖI rõ ràng (không báo đã lưu)',/Máy chủ trả về trang không phải dữ liệu/.test(c.$('dp-errbar').textContent)&&c.$('dp-okbar').style.display==='none');
 t('lỗi: vẫn "chưa lưu", nút Lưu bật lại để thử lại, không làm mới Tổng quan',c.$('dp-save').disabled===false&&c.S.ovCalls===0);
 t('lỗi: hiện gợi ý kiểm tra action=count',/action=count/.test(c.$('dp-errbar').textContent));
 // lỗi bước 2
 c=mk();await c.w.openDeptSettings();c.w.eval("_dpRoomLabel(0,'X')");c.S.mode='fail2';await c.w.eval('_dpSave()');
 t('key thứ 2 lỗi → nói rõ danh sách phòng ĐÃ lưu, gán người CHƯA lưu',/ghi người thuộc từng phòng/.test(c.$('dp-errbar').textContent)&&/CHƯA lưu/.test(c.$('dp-errbar').textContent)&&/too many times/.test(c.$('dp-errbar').textContent));
 // báo đã lưu nhưng không thật
 c=mk();await c.w.openDeptSettings();c.w.eval("_dpRoomLabel(0,'Y')");c.S.mode='mismatch';await c.w.eval('_dpSave()');
 t('máy chủ nói OK nhưng đọc lại khác → báo lỗi xác nhận',/đọc lại thấy khác/.test(c.$('dp-errbar').textContent)&&c.S.ovCalls===0);
 // mất mạng lúc mở
 c=mk();c.S.mode='down';await c.w.openDeptSettings();
 t('mất mạng lúc mở → màn lỗi có nút Thử lại + gợi ý, không treo "Đang tải"',/Không tải được cấu hình phòng/.test(c.$('dp-page').textContent)&&/Thử lại/.test(c.$('dp-page').textContent)&&/Không kết nối được máy chủ/.test(c.$('dp-page').textContent));
 c.S.mode='';await c.w.openDeptSettings();t('bấm Thử lại khi mạng có lại → vào được trang',c.$('dp-page').querySelectorAll('.dpg-row').length===2);
 // kiểm tra đầu vào
 c=mk();await c.w.openDeptSettings();c.w.eval("_dp.list.forEach(g=>g.label='')");c.w.eval("_dpMarkDirty()");await c.w.eval('_dpSave()');
 t('không còn phòng nào có tên → báo lỗi, KHÔNG gửi lên máy chủ',/ít nhất 1 phòng/.test(c.$('dp-errbar').textContent)&&c.S.posts.length===0);
 c.w.eval("_dp.list=[{key:'a',label:'Sale'},{key:'b',label:'sale '}]");await c.w.eval('_dpSave()');
 t('2 phòng trùng tên (khác hoa/thường) → báo lỗi, KHÔNG gửi',/trùng tên/.test(c.$('dp-errbar').textContent)&&c.S.posts.length===0);
 // xoá phòng có người
 c=mk();await c.w.openDeptSettings();c.S.confirmAns=false;await c.w.eval('_dpDelRoom(0)');
 t('xoá phòng đang có người, chọn Hủy → giữ nguyên phòng và người',c.w.eval('_dp.list.length')===2&&c.w.eval("_dp.map.An")==='sale');
 c.S.confirmAns=true;await c.w.eval('_dpDelRoom(0)');
 t('xoá phòng đang có người, chọn Đồng ý → bỏ phòng + người thành chưa phân phòng + đánh dấu chưa lưu',c.w.eval('_dp.list.length')===1&&c.w.eval("_dp.map.An")===undefined&&c.$('dp-dirty').style.display==='');
 // team + từng người
 c=mk();await c.w.openDeptSettings();c.w.eval("_dpSetSec('teams')");
 t('mục Gán theo team liệt kê 2 team',c.$('dp-page').querySelectorAll('tbody tr').length===2);
 c.w.eval("_dpAssignTeam(0,'hr')");t('gán Team A → An, Binh vào HR',c.w.eval("_dp.map.An==='hr'&&_dp.map.Binh==='hr'")&&c.$('dp-save').disabled===false);
 c.w.eval("_dpSetSec('people')");
 const names=[...c.$('dp-page').querySelectorAll('#dp-people-list tbody tr td:first-child')].map(x=>x.textContent);
 t('mục Từng người liệt kê tên từ team + tài khoản (không cần Tổng quan)',['An','Binh','Chi','Dung','dung1','dung2'].every(n=>names.includes(n)));
 c.w.eval("_dp.q='bi';_dpPeopleList()");t('ô tìm lọc đúng',[...c.$('dp-page').querySelectorAll('#dp-people-list tbody td:first-child')].map(x=>x.textContent).join()==='Binh');
 c.w.eval("_dp.q=''");c.w.eval("document.getElementById('dp-new-name').value='Ketoan1'");c.w.eval("document.getElementById('dp-new-room').value='sale'");c.w.eval('_dpAddPerson()');
 t('thêm người ngoài danh sách (kế toán…) vào phòng',c.w.eval("_dp.map.Ketoan1")==='sale');
 // đóng trang
 c.S.confirmAns=false;c.w.eval('closeDeptSettings()');
 t('đóng khi còn thay đổi, chọn Hủy → trang vẫn mở',c.$('dp-page').classList.contains('open'));
 c.S.confirmAns=true;c.w.eval('closeDeptSettings()');
 t('đóng khi còn thay đổi, chọn Đồng ý → đóng + bỏ khoá cuộn',!c.$('dp-page').classList.contains('open')&&!c.w.document.body.classList.contains('rs-open'));
 // lỗi làm mới Tổng quan không thành lỗi lưu
 c=mk();c.S.ovThrow=true;await c.w.openDeptSettings();c.w.eval("_dpRoomLabel(0,'Z')");await c.w.eval('_dpSave()');
 t('làm mới Tổng quan nền lỗi → KHÔNG báo thành lỗi lưu (vẫn xanh)',c.$('dp-errbar')===null&&c.$('dp-okbar').style.display!=='none');
 // menu Settings
 const sn=fs.readFileSync(path.join(__dirname,'..','js','29-sidenav.js'),'utf8');
 t('có mục "🏢 Phòng ban" trong menu Settings (admin) gọi openDeptSettings',/ids:\['act:roles','act:dept'/.test(sn)&&/dept:\s*\{ t:'🏢 Phòng ban', f:'openDeptSettings', admin:true \}/.test(sn));
 
 // LỖI THẬT 19/11 (nguyetTTA1995): sale MỚI chỉ có trong ĐƠN Base/POS (chưa có tài khoản, chưa vào team) → phải TÌM ĐƯỢC ở "Từng người" để xếp phòng
 {
  c=mk(); let calls=0;
  c.w._allCSNames=()=>{calls++;return ['nguyetTTA1995','Thuydinh1995','thuydinh95','An','dung1'];};   // nguồn: csSet đơn Base+POS (js/08)
  await c.w.openDeptSettings(); c.w.eval("_dp.sec='people'; _dp.q=''");
  const names=c.w.eval('_dpNames()');
  t('tên Sale chỉ có trong đơn (nguyetTTA1995) có trong danh sách Từng người',names.includes('nguyetTTA1995'));
  t('không nhân đôi tên đã có sẵn (An / dung1 chỉ 1 dòng, không phân biệt hoa/thường)',names.filter(n=>n.toLowerCase()==='an').length===1&&names.filter(n=>n.toLowerCase()==='dung1').length===1);
  c.w.eval("_dp.q='nguyettta'"); const html=c.w.eval('_dpPeopleListHtml()');
  t('gõ "nguyettta" (không phân biệt hoa/thường) → ra đúng dòng nguyetTTA1995 để chọn phòng',/nguyetTTA1995/.test(html)&&!/Không có tên nào khớp/.test(html));
  c.w.eval("_dpPeopleListHtml(); _dpNames(); _dpNames()");
  t('quét toàn bộ khách chỉ 1 lần mỗi lần mở trang (gõ tìm không bị chậm)',calls===1);
  c.w.eval("_dpSetPerson('nguyetTTA1995','sale')"); await c.w.eval('_dpSave()');
  t('gán phòng cho sale mới rồi lưu → saleDepts chứa nguyetTTA1995',JSON.parse(c.S.store.saleDepts).nguyetTTA1995==='sale');
  t('mở lại trang → quét lại (thấy sale mới thêm sau đó)',(await c.w.openDeptSettings(),c.w.eval('_dp.csNames===null')||calls===2));   // 26/11: số người ở mỗi phòng tính theo NGƯỜI nên quét ngay lúc mở (1 lần/lần mở, thẻ số vốn đã quét sẵn)
  const c2=mk(); delete c2.w._allCSNames; await c2.w.openDeptSettings();
  t('thiếu _allCSNames (js/08 chưa nạp) → không lỗi, vẫn ra danh sách cũ',c2.w.eval('_dpNames()').includes('Binh'));
 // Bộ lọc "Chưa phân phòng" ở mục Từng người (Duyên 26/11: lọc người chưa có phòng để phân lại cho dễ)
 {
  const c=mk(); await c.w.openDeptSettings(); c.w.eval("_dp.sec='people'; _dp.q=''; _dp.f=''; _dpRender()");
  // An→sale; Binh, Chi, dung1, dung2... chưa gán. Thêm 1 người trỏ vào phòng đã bị xóa → phải tính là chưa phân phòng.
  c.w.eval("_dp.map['Ma']='phong-da-xoa'");
  const all=c.w.eval('_dpNames()'), none=all.filter(n=>!c.w.eval('_dpIsAssigned_('+JSON.stringify(n)+')'));
  t('_dpIsAssigned_: An (phòng sale) = đã gán; Binh = chưa; Ma (phòng đã xóa) = chưa',c.w.eval("_dpIsAssigned_('An')")===true&&c.w.eval("_dpIsAssigned_('Binh')")===false&&c.w.eval("_dpIsAssigned_('Ma')")===false);
  c.w.eval("_dpSetFilter('_none')");
  const rows=()=>Array.from(c.$('dp-people-list').querySelectorAll('select[data-n]')).map(x=>x.dataset.n);
  t('lọc "Chưa phân phòng": chỉ ra người chưa có phòng (không có An)',rows().length===none.length&&!rows().includes('An')&&rows().includes('Binh')&&rows().includes('Ma'));
  c.w.eval('_dpRender()');
  t('số trong ô lọc "Chưa phân phòng (N)" = số dòng khi lọc',c.$('dp-filter').options[1].textContent.includes('('+none.length+')')&&c.$('dp-filter').value==='_none');
  c.w.eval("_dp.q='bin'; _dpPeopleList()");
  t('lọc chưa phân phòng + gõ tìm tên cùng lúc → chỉ Binh',rows().join()==='Binh');
  c.w.eval("_dp.q=''; _dpSetFilter('sale')");
  t('lọc theo 1 phòng cụ thể → chỉ người của phòng đó',rows().join()==='An');
  c.w.eval("_dpSetFilter('')");
  t('bỏ lọc (Tất cả) → đủ mọi người',rows().length===all.length);
  c.w.eval("_dpSetFilter('_none')"); c.w.eval("_dpSetPerson('Binh','hr')");
  t('gán phòng khi đang lọc: dòng vẫn còn (không nhảy), bộ lọc chỉ cập nhật khi đổi lọc',rows().includes('Binh'));
  c.w.eval("_dpSetFilter('_none')");
  t('lọc lại sau khi gán → Binh biến khỏi danh sách chưa phân phòng',!rows().includes('Binh'));
  const c3=mk(); await c3.w.openDeptSettings(); c3.w.eval("_dp.f='_none'"); await c3.w.openDeptSettings();
  t('mở lại trang → bộ lọc về "Tất cả"',c3.w.eval('_dp.f')==='');
 }
 // MỖI NGƯỜI 1 DÒNG: yennth + yenNTH2004 là 1 người (Duyên 26/11)
 {
  const c=mk(); await c.w.openDeptSettings();
  // dùng đúng hàm gom thật của js/08 + js/50 (tài khoản nhiều tên + Khớp sale) bằng bản thu nhỏ tương đương
  c.w.eval(`
    var _ALIAS=[['yennth','yenNTH2004']];
    function _personAliases(n){var k=String(n).toLowerCase();for(var i=0;i<_ALIAS.length;i++)if(_ALIAS[i].some(function(x){return x.toLowerCase()===k}))return _ALIAS[i];return [n];}
    function _groupNamesByPerson(names){var low=names.map(function(n){return n.toLowerCase()}),used={},out=[];names.forEach(function(n,i){if(used[i])return;var al=_personAliases(n).map(function(x){return x.toLowerCase()}),g=[];al.forEach(function(a){names.forEach(function(nm,j){if(!used[j]&&low[j]===a){used[j]=1;g.push(nm)}})});if(!used[i]){used[i]=1;g.unshift(n)}out.push({names:g,primary:g[0]})});return out;}
    _dp.csNames=['yennth','yenNTH2004','Zed']; _dp.sec='people'; _dp.q=''; _dp.f=''; _dpRender();`);
  const rows=()=>Array.from(c.$('dp-people-list').querySelectorAll('select[data-n]')).map(x=>x.dataset.n);
  t('yennth + yenNTH2004 (cùng 1 người) chỉ ra 1 dòng, tên gốc = tên chính',rows().filter(n=>/^yen/i.test(n)).length===1&&rows().includes('yennth'));
  t('dòng đó ghi chú tên phụ yenNTH2004 (biết là cùng 1 người)',/yenNTH2004/.test(c.$('dp-people-list').textContent));
  t('gõ tên phụ "2004" vẫn ra đúng người đó',(c.w.eval("_dp.q='2004'"),c.w.eval('_dpPeopleList()'),rows().join()==='yennth'));
  c.w.eval("_dp.q=''; _dpSetPerson('yennth','hr')");
  t('gán phòng cho người → ghi cho MỌI tên (yennth + yenNTH2004) để báo cáo tra tên nào cũng ra',c.w.eval("_dp.map.yennth==='hr'&&_dp.map.yenNTH2004==='hr'"));
  t('số người ở phòng = 1 (không đếm 2 tên thành 2 người)',c.w.eval("_dpCount('hr')")===1);
  c.w.eval("_dpSetPerson('yennth','')");
  t('bỏ phòng → xóa ở mọi tên',c.w.eval("!_dp.map.yennth&&!_dp.map.yenNTH2004"));
  c.w.eval("_dp.map.yenNTH2004='sale'");
  t('chỉ tên phụ có phòng → cả người tính là đã có phòng đó (hiện đúng phòng ở dòng tên chính)',c.w.eval("_dpRoomOfGroup_({names:['yennth','yenNTH2004'],primary:'yennth'})")==='sale');
 }
 // TÊN GỐC = TÊN PANCAKE (Duyên 26/11)
 {
  const c=mk(); await c.w.openDeptSettings();
  c.w.eval(`
    var _ALIAS=[['yennth','yenNTH2004']];
    function _personAliases(n){var k=String(n).toLowerCase();for(var i=0;i<_ALIAS.length;i++)if(_ALIAS[i].some(function(x){return x.toLowerCase()===k}))return _ALIAS[i];return [n];}
    function _groupNamesByPerson(names){var low=names.map(function(n){return n.toLowerCase()}),used={},out=[];names.forEach(function(n,i){if(used[i])return;var al=_personAliases(n).map(function(x){return x.toLowerCase()}),g=[];al.forEach(function(a){names.forEach(function(nm,j){if(!used[j]&&low[j]===a){used[j]=1;g.push(nm)}})});if(!used[i]){used[i]=1;g.unshift(n)}out.push({names:g,primary:g[0]})});return out;}
    _dp.csNames=['yennth','yenNTH2004','Zed']; _dp.sec='people'; _dp.q=''; _dp.f=''; _dpRender();`);
  const rows=()=>Array.from(c.$('dp-people-list').querySelectorAll('select[data-n]')).map(x=>x.dataset.n);
  // 1) tên Pancake từ hồ sơ chuẩn
  c.w.eval("window._staffPancakeOf=function(ns){return ns.some(function(n){return n.toLowerCase()==='yennth'})?'Yến NTH':''}; _dpRender()");
  t('hồ sơ có tên Pancake → dòng hiện tên Pancake làm tên gốc, tên CRM thành tên phụ',rows().includes('Yến NTH')&&!rows().includes('yennth')&&/yennth/.test(c.$('dp-people-list').textContent)&&/yenNTH2004/.test(c.$('dp-people-list').textContent));
  c.w.eval("_dpSetPerson('Yến NTH','hr')");
  t('gán phòng → ghi cho tên Pancake + mọi tên CRM của người đó',c.w.eval("_dp.map['Yến NTH']==='hr'&&_dp.map.yennth==='hr'&&_dp.map.yenNTH2004==='hr'"));
  t('vẫn đếm 1 người (không tính tên Pancake thành người thứ 2)',c.w.eval("_dpCount('hr')")===1&&c.w.eval("_dpGroups_().filter(function(g){return /yen/i.test(g.names.join())}).length")===1);
  c.w.eval("_dp.q='yennth'; _dpPeopleList()");
  t('gõ tên CRM vẫn ra đúng người (hiện tên Pancake)',rows().join()==='Yến NTH');
  // 2) không có hồ sơ → lấy Khớp tên Pancake (js/15)
  c.w.eval("window._staffPancakeOf=function(){return ''}; window._pkOrigNameOf_=function(ns){return ns.some(function(n){return n.toLowerCase()==='yenNTH2004'.toLowerCase()})?'Yến Pancake':''}; _dp.q=''; _dpRender()");
  t('không có hồ sơ → dùng Khớp tên Pancake làm tên gốc',rows().includes('Yến Pancake'));
  // 3) không có tên Pancake nào → như cũ
  c.w.eval("window._pkOrigNameOf_=function(){return ''}; _dpRender()");
  t('không có tên Pancake → giữ tên chính cũ (yennth)',rows().includes('yennth')&&!rows().includes('Yến Pancake'));
 }
 }
console.log('\n'+ok+' OK, '+bad+' FAIL');process.exit(bad?1:0);
})();

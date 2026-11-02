// Test giao diện: Bao cao M — bam sale -> Chi tiet Base/Pos + Xuat Excel 2 sheet (js/50-split-orders.js, code that bang jsdom). Chay: node tools/test-split-detail-ui.js (can jsdom)
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '50-split-orders.js'), 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div id="wrap"></div></body></html>', { runScripts: 'outside-only' }), w = dom.window, $ = id => w.document.getElementById(id), sleep = ms => new Promise(r => setTimeout(r, ms));
const M = { ok: true, from: '2026-10-01', to: '2026-10-31', scope: 'all', total: { orders: 10, revenue: 9e6, aov: 9e5, splitOrders: 3, splitRevenue: 3e6, splitAov: 1e6, splitPctOrders: 30, splitPctRevenue: 33.3 },
  bySale: [{ name: 'An', orders: 5, revenue: 4e6, aov: 8e5, splitOrders: 3, splitRevenue: 3e6, splitAov: 1e6, splitPct: 75 }, { name: 'Bình <b>x</b>', orders: 2, revenue: 1e6, aov: 5e5, splitOrders: 1, splitRevenue: 5e5, splitAov: 5e5, splitPct: 50 }], warnings: [] };
const DET = { ok: true, from: '2026-10-01', to: '2026-10-31', sale: 'An', truncated: false,
  pos: [{ date: '02/10/2026', month: '10/2026', name: 'Khách 1', phone: '0911000001', note: '17T10/2026 + 18T10/2026', sales: 'An', product: 'Combo A', total: 3000000, posValue: 2800000, share: 2000000, kind: 'base', baseCheck: { status: 'lech', nguon: 'ma', posSales: ['An'], baseSales: ['An', 'Bình'], missing: ['Bình'], extra: [], baseCodes: ['17T10/2026', '18T10/2026'] }, feedback: 'An làm đúng, Bình quên gắn thẻ', fbKey: '12|0911000001|2026-10-02|3000000#an' },
        { date: '03/10/2026', month: '10/2026', name: 'Khách <i>2</i>', phone: '0911000002', note: 'chia đều', sales: 'An,Bình', product: 'SP B', total: 2000000, posValue: null, share: 1000000, kind: 'the', baseCheck: { status: 'khongCoBase', nguon: '', posSales: ['An', 'Bình'], baseSales: [], missing: [], extra: [], baseCodes: [] } }],
  base: [{ date: '30/09/2026', month: '09/2026', name: 'Khách 1', phone: '0911000001', code: '17T10/2026', sales: 'An, Bình', product: 'Nhẫn vàng', total: 2000000, share: 1000000 },
         { date: '01/10/2026', month: '10/2026', name: 'Khách 1', phone: '0911000001', code: '18T10/2026', sales: 'An', product: 'Lắc tay', total: 1000000, share: 1000000 }],
  summary: { posOrders: 2, posTotal: 5000000, posShare: 3000000, baseOrders: 2, baseTotal: 3000000, baseShare: 2000000, noBaseOrders: 1, check: { khop: 0, lech: 1, khongCoBase: 1, goiY: 0 } }, warnings: [] };
const reqs = [], toasts = [], saved = []; let respFn = () => DET;
w.eval('var gsUrl="https://gs.example/exec"; var _srState={loading:false,lastFetchError:"",mDateQuick:"custom",mDateFrom:"2026-10-01",mDateTo:"2026-10-31",mSearch:"",dataM:null,sub:"M"};');
w._srFetch = async (action, p) => { reqs.push({ action, p }); await sleep(5); return respFn(p); };
w.toast = m => toasts.push(m);
w.XLSX = { utils: { book_new: () => ({ sheets: [] }), aoa_to_sheet: rows => ({ rows }), book_append_sheet: (wb, ws, name) => wb.sheets.push({ name, rows: ws.rows, cols: ws['!cols'] }) }, writeFile: (wb, fn) => saved.push({ wb, fn }) };
w.eval(src); w.eval('_srState.dataM=' + JSON.stringify(M) + ';');
const wrap = $('wrap'); w.renderSalesReportTabM_(wrap, '<span>tabs</span>');
(async () => {
  let h = wrap.innerHTML;
  ok(h.includes('data-m-sale="An"') && h.includes('Chi tiết đối soát') && (h.match(/data-m-view="base"/g) || []).length === 2 && (h.match(/data-m-view="pos"/g) || []).length === 2, 'bang M: moi sale co nut Base + Pos, dong bam duoc');
  const rowB = wrap.querySelectorAll('tr[data-m-sale]')[1];
  ok(rowB.getAttribute('data-m-sale') === 'Bình <b>x</b>' && rowB.querySelector('td:first-child b').textContent === 'Bình <b>x</b>' && rowB.querySelector('td:first-child b b') === null && rowB.querySelector('td:first-child').children.length === 1, 'ten sale co ky tu HTML duoc escape (thanh chu, khong sinh the <b> that, thuoc tinh dung gia tri goc)');
  ok(!$('sr-m-detail'), 'chua bam gi -> chua co panel chi tiet');
  // bam dong sale (khong bam nut) -> mac dinh Pos
  wrap.querySelector('tr[data-m-sale="An"] td').click(); await sleep(30);
  ok(reqs.length === 1 && reqs[0].action === 'splitOrderDetail' && reqs[0].p.sale === 'An' && reqs[0].p.dateFrom === '2026-10-01' && reqs[0].p.dateTo === '2026-10-31', 'bam dong sale -> goi splitOrderDetail dung sale + dung ky cua bang M');
  let det = $('sr-m-detail'); ok(det && det.textContent.includes('Chi tiết đơn chia — An'), 'hien panel chi tiet ben duoi bang');
  ok(det.textContent.includes('Sale tham gia (thẻ Pos)') && det.textContent.includes('Sản phẩm (Pos)') && det.textContent.includes('Ghi chú') && !det.textContent.includes('Sale tham gia (bán trên Base)'), 'mac dinh tab POS: cot ghi chu / sale the / san pham Pos');
  ok(det.textContent.includes('Combo A') && det.textContent.includes('3.000.000₫') && det.textContent.includes('2.000.000₫') && det.textContent.includes('2.800.000₫'), 'Pos: tong doanh thu, doanh thu sau chia, gia Pos goc khi khac');
  ok(det.textContent.includes('Tổng (2 dòng)') && det.textContent.includes('5.000.000₫') && det.textContent.includes('3.000.000₫'), 'Pos: dong tong cong dung (5.000.000 / 3.000.000)');
  ok(det.innerHTML.includes('Khách &lt;i&gt;2&lt;/i&gt;') && !det.innerHTML.includes('<i>2</i>'), 'ten KH duoc escape');
  ok($('sr-m-detail').previousElementSibling && $('sr-m-detail').parentNode.id === 'sr-m-body', 'panel nam trong #sr-m-body, duoi bang');
  // doi sang Base (khong goi lai server)
  det.querySelector('[data-m-tab="base"]').click(); await sleep(5);
  det = $('sr-m-detail'); ok(reqs.length === 1, 'doi tab Base/Pos KHONG goi lai server');
  ok(det.textContent.includes('Mã bộ đếm') && det.textContent.includes('Sale tham gia (bán trên Base)') && det.textContent.includes('Sản phẩm (Base)') && !det.textContent.includes('Ghi chú'), 'tab BASE: cot ma bo dem / sale ban Base / san pham Base');
  ok(det.textContent.includes('17T10/2026') && det.textContent.includes('30/09/2026') && det.textContent.includes('Nhẫn vàng') && det.textContent.includes('Tổng (2 dòng)') && det.textContent.includes('2.000.000₫'), 'Base: ngay len don Base, ma bo dem, san pham, tong');
  ok(det.textContent.includes('1 đơn chia của sale này KHÔNG có đơn gốc Base'), 'Base: giai thich so don chia khong co don goc Base');
  // xuat excel
  det.querySelector('[data-m-xlsx]').click();
  ok(saved.length === 1 && /^DoiSoat_DonChia_An_2026-10-01_2026-10-31\.xlsx$/.test(saved[0].fn), 'xuat Excel: ten file co ten sale + ky');
  const sh = saved[0].wb.sheets; ok(sh.length === 2 && sh[0].name === 'Base' && sh[1].name === 'Pos', 'Excel co dung 2 sheet: Base roi Pos');
  ok(sh[0].rows[0].slice(0, 9).join('|') === 'Ngày lên đơn|Tháng lên đơn|Tên KH|Số điện thoại|Mã bộ đếm|Sale tham gia (bán trên Base)|Sản phẩm (Base)|Tổng doanh thu|Doanh thu sau chia', 'sheet Base: tieu de cot dung yeu cau');
  ok(sh[1].rows[0].slice(0, 9).join('|') === 'Ngày lên đơn|Tháng lên đơn|Tên KH|Số điện thoại|Ghi chú|Sale tham gia (thẻ Pos)|Sản phẩm (Pos)|Tổng doanh thu|Doanh thu sau chia', 'sheet Pos: tieu de cot dung yeu cau');
  ok(sh[0].rows.length === 3 && sh[1].rows.length === 3 && sh[0].rows[1][3] === '0911000001' && sh[0].rows[1][7] === 2000000 && sh[1].rows[1][8] === 2000000 && sh[1].rows[1][9] === 2800000 && sh[1].rows[2][9] === '', 'Excel: so tien la SO (cong duoc), SDT giu so 0 dau, gia Pos goc chi khi khac');
  // ---- CHECK NGUOC BASE (UI, 2026-10-24) ----
  ok(sh[1].rows[0].slice(10).join('|') === 'Đối chiếu Base|Sale trên Base|Thiếu trên Pos (có trên Base)|Thừa trên Pos (không có trên Base)|Mã bộ đếm Base|Sale phản hồi', 'sheet Pos: them 6 cot doi chieu Base + Sale phan hoi');
  ok(sh[1].rows[1].slice(10).join('|') === 'LỆCH Base|An, Bình|Bình||17T10/2026, 18T10/2026|An làm đúng, Bình quên gắn thẻ' && sh[1].rows[2][10] === 'Không có đơn Base để đối chiếu', 'Excel Pos: dong lech co sale tren Base, thieu tren Pos, ma bo dem, sale phan hoi; dong khong co Base ghi ro');
  ok(sh[0].rows[0][9] === 'Loại dòng' && sh[0].rows[1][9] === 'Đã ghép (tính vào doanh thu)', 'sheet Base: cot Loai dong');
  det.querySelector('[data-m-tab="pos"]').click(); await sleep(5); det = $('sr-m-detail');
  ok(det.textContent.includes('1 đơn LỆCH Base') && det.textContent.includes('LỆCH Base') && det.textContent.includes('Thiếu trên Pos'), 'tab Pos: banner dem lech + cot doi chieu');
  ok(det.querySelectorAll('tbody tr').length === 3, 'tab Pos: 2 don + dong tong');
  det.querySelector('[data-m-lech]').click(); await sleep(5); det = $('sr-m-detail');
  ok(det.querySelectorAll('tbody tr').length === 2 && det.textContent.includes('Khách 1') && !det.textContent.includes('Khách <i>2</i>'), 'loc "Chi don lech Base": chi con don lech (+ dong tong)');
  det.querySelector('[data-m-lech]').click(); await sleep(5); det = $('sr-m-detail');
  ok(det.querySelectorAll('tbody tr').length === 3, 'bo loc lech -> hien lai tat ca');
  // ---- SALE PHAN HOI (buoc 3) ----
  const fbIn = det.querySelectorAll('input.split-fb'); ok(fbIn.length === 1 && fbIn[0].value === 'An làm đúng, Bình quên gắn thẻ' && fbIn[0].getAttribute('data-fb-key') === '12|0911000001|2026-10-02|3000000#an', 'tab Pos: o nhap Sale phan hoi (chi dong co khoa) co gia tri da luu');
  const posts = []; w.fetch = async (u, o) => { posts.push(JSON.parse(o.body)); return { json: async () => ({ ok: true, text: 'Đã xác nhận', by: 'An', at: '24/10/2026 10:00' }) }; };
  fbIn[0].value = 'Đã xác nhận'; fbIn[0].dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(20);
  ok(posts.length === 1 && posts[0].action === 'splitFeedbackSave' && posts[0].sale === 'An' && posts[0].text === 'Đã xác nhận' && posts[0].key === '12|0911000001|2026-10-02|3000000#an', 'doi o phan hoi -> POST splitFeedbackSave dung khoa/sale/noi dung');
  ok(w.eval('_srState.mSel.data.pos[0].feedback') === 'Đã xác nhận', 'cap nhat lai du lieu cuc bo -> Excel xuat dung phan hoi moi');
  saved.length = 0; det.querySelector('[data-m-xlsx]').click(); ok(saved[0].wb.sheets[1].rows[1][15] === 'Đã xác nhận', 'Excel Pos cot Sale phan hoi = noi dung vua nhap');
  w.fetch = async () => ({ json: async () => ({ ok: false, error: 'Ban khong co quyen' }) }); toasts.length = 0; fbIn[0].value = 'x'; fbIn[0].dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(20);
  ok(toasts.length === 1 && toasts[0].includes('Ban khong co quyen') && fbIn[0].value === 'x', 'loi luu -> bao loi, giu chu de thu lai');
  // ---- XUAT EXCEL TAT CA SALE (2026-10-24) ----
  const origSrFetch = w._srFetch; w.eval("window.__dm0 = _srState.dataM; window.__le0 = _srState.lastFetchError");
  w.eval("_srState.dataM = { from:'2026-10-01', to:'2026-10-31', bySale:[{name:'An',splitOrders:2},{name:'Bình',splitOrders:1},{name:'Chi',splitOrders:0},{name:'Hỏng',splitOrders:3}] }");
  const asked = []; w._srFetch = async (act, body) => { asked.push(body.sale); if (body.sale === 'Hỏng') { w.eval("_srState.lastFetchError='timeout'"); return null; } return Object.assign({}, DET, { sale: body.sale }); };
  saved.length = 0; await w._srMExportAllXlsx_(); await sleep(20);
  ok(asked.length === 3 && !asked.includes('Chi'), 'tat ca sale: chi tai sale co don chia (bo Chi 0 don) — 3 sale');
  const ash = saved[0].wb.sheets; ok(saved[0].fn === 'DoiSoat_DonChia_TatCaSale_2026-10-01_2026-10-31.xlsx' && ash.map(x => x.name).join() === 'Tong hop,Pos,Base,Loi', 'file gop: Tong hop, Pos, Base, Loi (sale tai hong)');
  ok(ash[0].rows[0][0] === 'Sale' && ash[0].rows.length === 3 && ash[0].rows[1][0] === 'An' && ash[0].rows[2][0] === 'Bình' && ash[0].rows[1][5] === 1, 'Tong hop: moi sale 1 dong, dem don LECH Base');
  ok(ash[1].rows[0][0] === 'Sale' && ash[1].rows[0][11] === 'Đối chiếu Base' && ash[1].rows.length === 5 && ash[1].rows[1][0] === 'An' && ash[1].rows[3][0] === 'Bình', 'Pos: them cot Sale dau bang, du dong cua 2 sale (2 + 2)');
  ok(ash[2].rows[0][0] === 'Sale' && ash[2].rows[1][0] === 'An', 'Base: them cot Sale dau bang');
  ok(ash[3].rows[1][0] === 'Hỏng' && ash[3].rows[1][1] === 'timeout', 'sheet Loi ghi ro sale tai hong va ly do');
  const asked2 = asked.length; await w._srMExportAllXlsx_(); await sleep(20); ok(asked.length === asked2 + 3 && saved.length === 2, 'bam lai chay lai binh thuong (khong ket co busy)');
  w._srFetch = origSrFetch; w.eval("_srState.dataM = window.__dm0; _srState.lastFetchError = window.__le0"); saved.length = 0;
  // ---- CONG TAC DON 1 MA CHIA THEO BASE (2026-10-24) ----
  ok(w.splitGhepBtnHtml_(false, true) === '', 'khong phai Admin: KHONG hien nut cong tac');
  ok(/TẮT/.test(w.splitGhepBtnHtml_(true, false)) && !/primary/.test(w.splitGhepBtnHtml_(true, false)) && /BẬT/.test(w.splitGhepBtnHtml_(true, true)) && /primary/.test(w.splitGhepBtnHtml_(true, true)), 'Admin: nut hien dung trang thai TAT/BAT');
  const sets = []; let loads = 0, conf = true, confMsg = '';
  w.confirm = m => { confMsg = m; return conf; }; w._srLoad = () => { loads++; };
  w.fetch = async (u, o) => { sets.push(JSON.parse(o.body)); return { json: async () => ({ ok: true }) }; };
  w.eval("_srState.ghepMin1 = false"); conf = false; await w._srMToggleGhep_(); ok(sets.length === 0 && loads === 0, 'huy hop xac nhan -> khong ghi gi');
  conf = true; await w._srMToggleGhep_(); await sleep(5);
  ok(sets.length === 1 && sets[0].action === 'setSetting' && sets[0].key === 'POS_GHEP_MIN_CODES' && sets[0].value === '1' && /18\.986\.000/.test(confMsg) && w.eval('_srState.ghepMin1') === true && loads === 1, 'BAT: canh bao 18.986.000d + ghi POS_GHEP_MIN_CODES=1 + tinh lai bao cao');
  await w._srMToggleGhep_(); await sleep(5);
  ok(sets[1].value === '2' && w.eval('_srState.ghepMin1') === false && loads === 2, 'TAT: ghi gia tri 2 (quy tac cu) + tinh lai bao cao');
  w.fetch = async () => ({ json: async () => ({ error: 'Chi admin', code: 'FORBIDDEN' }) }); toasts.length = 0; await w._srMToggleGhep_(); await sleep(5);
  ok(toasts.length === 1 && /Chi admin/.test(toasts[0]) && w.eval('_srState.ghepMin1') === false && loads === 2, 'server tu choi (khong phai admin) -> bao loi, giu nguyen trang thai, khong tinh lai');
  w.eval("_srState.ghepMin1 = false");
  // doi sale / dong / loc lai
  respFn = p => Object.assign({}, DET, { sale: p.sale, pos: [], base: [], summary: { posOrders: 0, posTotal: 0, posShare: 0, baseOrders: 0, baseTotal: 0, baseShare: 0, noBaseOrders: 0 } });
  wrap.querySelector('tr[data-m-sale^="Bình"] [data-m-view="base"]').click(); await sleep(30);
  det = $('sr-m-detail'); ok(reqs.length === 2 && det.textContent.includes('Bình') && det.textContent.includes('Không có đơn gốc Base nào'), 'bam nut Base cua sale khac -> tai sale do, mo thang tab Base, rong thi bao ro');
  ok(wrap.querySelector('tr[data-m-sale="An"]').getAttribute('style').indexOf('cursor:pointer') >= 0 && wrap.querySelector('tr[data-m-sale^="Bình"]').getAttribute('style').indexOf('background') >= 0, 'dong dang chon duoc to mau');
  // loi server
  respFn = () => ({ ok: false, error: 'Ban khong co quyen' }); wrap.querySelector('tr[data-m-sale="An"] [data-m-view="pos"]').click(); await sleep(30);
  ok($('sr-m-detail').textContent.includes('⚠ Ban khong co quyen') && $('sr-m-detail').querySelector('[data-m-xlsx]').disabled, 'loi tu server -> bao loi, nut Excel bi khoa');
  // dong bang X
  $('sr-m-detail').querySelector('[data-m-close]').click(); ok(!$('sr-m-detail'), 'bam Dong -> dong panel');
  // race: bam An roi bam Binh nhanh -> chi hien ket qua cua sale bam sau
  let slow = true; w._srFetch = async (a, p) => { reqs.push({ action: a, p }); await sleep(p.sale === 'An' ? 60 : 5); return Object.assign({}, DET, { sale: p.sale }); };
  wrap.querySelector('tr[data-m-sale="An"] [data-m-view="pos"]').click(); wrap.querySelector('tr[data-m-sale^="Bình"] [data-m-view="pos"]').click(); await sleep(120);
  ok($('sr-m-detail').textContent.includes('Chi tiết đơn chia — Bình') && !$('sr-m-detail').textContent.includes('— An'), 'bam 2 sale lien tiep: ket qua tra ve cham cua sale cu KHONG de len sale moi');
  // loc lai (splitReportLoad_) -> dong chi tiet
  w.eval('_srState.mSel && 1'); await w.splitReportLoad_(); ok(w._srState.mSel === null, 'loc lai / doi ky -> dong chi tiet cu');
  // chua co thu vien Excel
  w.XLSX = undefined; w.eval('_srState.mSel={sale:"An",tab:"pos",data:' + JSON.stringify(DET) + ',loading:false,error:"",seq:9}'); toasts.length = 0; w._srMExportXlsx_(); ok(toasts.length === 1 && /Excel/.test(toasts[0]), 'chua tai xong thu vien Excel -> bao, khong loi');
  process.exit(bad ? 1 : 0);
})();

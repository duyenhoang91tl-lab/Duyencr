#!/usr/bin/env node
// Test R5a bước 1: chọn nhiều khách (js/82-cust-select.js). Chạy: NODE_PATH=<jsdom> node tools/test-cust-select.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const src = fs.readFileSync(path.join(ROOT, 'js', '82-cust-select.js'), 'utf8');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// 1) logic thuần
const S = require(path.join(ROOT, 'js', '82-cust-select.js'));
const L = [{ phone: '0901' }, { phone: '0902' }, { phone: '0903' }];
ok(S.csSelCount_() === 0 && S.csSelState_(L) === 'none', 'ban dau 0 khach');
S.csSelToggle_('0901'); ok(S.csSelCount_() === 1 && S.csSelHas_('0901') && S.csSelState_(L) === 'some', 'tich 1 khach -> some');
S.csSelToggle_('0901', true); ok(S.csSelCount_() === 1, 'tich lai cung khach khong dem doi');
S.csSelSetAll_(L, true); ok(S.csSelCount_() === 3 && S.csSelState_(L) === 'all', 'chon tat ca dang loc');
S.csSelSetAll_([L[1]], false); ok(S.csSelCount_() === 2 && S.csSelList_().sort().join() === '0901,0903', 'bo 1 khach');
S.csSelToggle_('', true); S.csSelToggle_(null); ok(S.csSelCount_() === 2, 'SDT rong bi bo qua');
S.csSelClear_(); ok(S.csSelCount_() === 0 && S.csSelState_(L) === 'none', 'bo chon het');
// hieu nang: 136k khach
const big = Array.from({ length: 136000 }, (_, i) => ({ phone: '09' + String(i).padStart(8, '0') }));
let t0 = Date.now(); S.csSelSetAll_(big, true); const dt = Date.now() - t0;
ok(S.csSelCount_() === 136000 && S.csSelState_(big) === 'all' && dt < 1500, 'chon 136k khach nhanh (' + dt + 'ms)');
S.csSelClear_();
const row = '<tr data-phone="0901" onclick="openDp(this.dataset.phone)">\n<td class="col-lastpos"></td><td class="col-name"><div>A</div></td></tr>';
S.csSelToggle_('0901', true);
const inj = S.csSelInject_(row, '0901');
ok(/<td class="col-name"><input type="checkbox" class="cs-sel-box"[^>]* checked>/.test(inj) && /<tr class="cs-sel-on" data-phone/.test(inj), 'dong da chon: o tich checked + class cs-sel-on');
const inj2 = S.csSelInject_(row, '0902'); ok(!/checked/.test(inj2) && !/cs-sel-on/.test(inj2) && /cs-sel-box/.test(inj2), 'dong chua chon: co o tich, khong checked');
S.csSelClear_();
// 2) tich hop jsdom: boc _rowHtml that + bang ao gia lap
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bo qua phan jsdom: thieu jsdom)'); }
if (JSDOM) {
  const dom = new JSDOM('<table><thead><tr><th id="th-name"><div class="th-inner">Khách hàng</div></th></tr></thead><tbody id="table-body"></tbody></table>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; const opened = [];
  w.openDp = (p) => opened.push(p);
  w._vt = { list: [{ phone: '0901' }, { phone: '0902' }, { phone: '0903' }] };
  w._rowHtml = (c) => '<tr data-phone="' + c.phone + '" onclick="openDp(this.dataset.phone)"><td class="col-name"><div>' + c.phone + '</div></td></tr>';
  w._renderVirtualWindow = () => { w.document.getElementById('table-body').innerHTML = w._vt.list.map((c) => w._rowHtml(c)).join(''); };
  w.renderTable = (list) => { w._vt.list = list; w._renderVirtualWindow(); };
  w.eval(src);
  w.renderTable(w._vt.list);
  const D = w.document, boxes = () => [...D.querySelectorAll('.cs-sel-box')];
  ok(boxes().length === 3 && !!D.getElementById('cs-sel-all'), 'moi dong co o tich + o chon tat ca o tieu de');
  ok(!D.getElementById('cs-selbar').classList.contains('is-open'), 'chua chon -> thanh an');
  boxes()[0].click();
  ok(opened.length === 0, 'bam o tich KHONG mo ho so khach');
  const bar = D.getElementById('cs-selbar');
  ok(bar.classList.contains('is-open') && /1 khách đã chọn/.test(bar.textContent) && /Chọn tất cả 3 đang lọc/.test(bar.textContent), 'thanh hien "1 khach da chon" + nut chon tat ca 3');
  ok(D.getElementById('cs-sel-all').indeterminate === true, 'o tieu de o trang thai giua (some)');
  bar.querySelector('[data-cs-act="all"]').click();
  ok(/3 khách đã chọn/.test(bar.textContent) && boxes().every((b) => b.checked) && D.getElementById('cs-sel-all').checked, 'Chon tat ca dang loc -> 3, moi o duoc tich, o tieu de checked');
  w.renderTable([{ phone: '0902' }, { phone: '0903' }]);   // doi bo loc: ve lai, chon van giu
  ok(boxes().length === 2 && boxes().every((b) => b.checked), 'sau ve lai 2 dong (loc con 2 khach) van duoc tich');
  ok(/3 khách đã chọn/.test(bar.textContent) && !/Chọn tất cả/.test(bar.textContent), 'dem van 3 (chon giu qua doi bo loc); khong hien nut chon tat ca vi 3 da >= 2 dang loc');
  D.getElementById('cs-sel-all').click();   // 2 khach dang loc dang tich het -> o tieu de checked -> click = bo tich 2 khach nay
  ok(/1 khách đã chọn/.test(bar.textContent) && boxes().every((b) => !b.checked), 'bam o tieu de khi da tich het: bo chon dung 2 khach dang loc, con 1 khach ngoai loc');
  let ran = null; w.csSelAddAction_({ id: 'x', label: 'Lam thu', run: (p) => { ran = p; } });
  ok(!!bar.querySelector('[data-cs-act="run:x"]'), 'dang ky thao tac -> hien nut tren thanh');
  bar.querySelector('[data-cs-act="run:x"]').click(); ok(Array.isArray(ran), 'bam nut thao tac -> goi run voi mang SDT da chon');
  bar.querySelector('[data-cs-act="clear"]').click();
  ok(!bar.classList.contains('is-open') && boxes().every((b) => !b.checked), 'Bo chon -> thanh an, het tich');
}
// 3) dang ky trong index.html + khong sua js/02
// 3) LỖI "danh sách chỉ thấy 1 khách": ô tích đặt thẳng sau <td> thành 1 dòng riêng → dòng cao 78px thay vì 58px (VT_ROW_H) → bảng ảo tính sai.
//    Ô tích PHẢI nằm trong div.cname (cùng dòng với tên), không đứng trước nó.
{
  const realRow = '<tr data-phone=\"0901\" onclick=\"openDp(this.dataset.phone)\">\n<td class=\"col-name\"><div class=\"cname\">A</div><div class=\"cphone\">0901</div></td></tr>';
  const o = S.csSelInject_(realRow, '0901');
  ok(/<div class=\"cname\"><input type=\"checkbox\" class=\"cs-sel-box\"/.test(o), 'o tich nam TRONG div.cname (cung dong voi ten)');
  ok(!/<td class=\"col-name\"><input/.test(o), 'o tich KHONG dung truoc div.cname (se thanh dong rieng, dong cao 78px)');
  ok((o.match(/cs-sel-box/g) || []).length === 1, 'chi 1 o tich moi dong');
  const rh = fs.readFileSync(path.join(ROOT, 'js', '02-fn-showrowerrorbanner.js'), 'utf8');
  ok(/<td class=\"col-name\"><div class=\"cname\">/.test(rh), 'js/02 _rowHtml van co <div class=\"cname\"> ngay sau <td col-name> (neu doi, sua csSelInject_)');
  ok(/\.cname:has\(>\.cs-sel-box\)\{display:flex/.test(fs.readFileSync(path.join(ROOT, 'css', '28-cust-select.css'), 'utf8')), 'css/28: cname co o tich dung flex cung dong');
}
ok(/js\/82-cust-select\.js/.test(idx) && /css\/28-cust-select\.css/.test(idx), 'index.html nap js/82 + css/28');
ok(idx.indexOf('js/82-cust-select.js') > idx.indexOf('js/06-main-renew-sources.js') && idx.indexOf('js/82-cust-select.js') > idx.indexOf('js/02'), 'js/82 nap SAU js/02 va js/06 (can _rowHtml, _vt)');
console.log(fail ? '\nFAILED ' + fail : '\nALL CUST-SELECT TESTS PASSED'); process.exit(fail ? 1 : 0);

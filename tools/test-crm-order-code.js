// Test ô "Mã SP" ở màn Tạo đơn (js/99-d-crm-order.js, bước 4c-2). Chạy: node tools/test-crm-order-code.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } console.log('OK   ' + m); };
const g = { normPhone_: p => String(p).replace(/\D/g, '').replace(/^84/, '0') }; vm.createContext(g); vm.runInContext(fs.readFileSync(path.join(root, 'gas/35_CrmOrder.gs'), 'utf8'), g);
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '', value: '' });
['co-code-0', 'co-code-1', 'co-code-hint-0', 'co-code-hint-1', 'co-code-warn'].forEach(fakeEl);
let asked = [], reply = () => ({ ok: true, results: [] });
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => id === 'xt-wrap-taodon' ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async u => { const q = /posPrice/.test(u) ? JSON.parse(decodeURIComponent(u.split('q=')[1])) : null; if (q) asked.push(q); return { json: async () => q ? reply(q) : {} }; },
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, clearTimeout, console, encodeURIComponent, Array, RegExp };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'js/99-d-crm-order.js'), 'utf8'), w);
const found = (code, name) => ({ found: true, code, name, price: 1000000, date: '2026-11-20' });
(async () => {
  // 1) thêm từ bảng giá: khớp chất liệu → tự điền
  w._co = w._coBlank(); w._co.phone = '0912345678'; w._coRender();
  reply = () => ({ ok: true, results: [found('VT01', 'Vòng tay Cẩm Thạch ni 54')] });
  w._coPick.list = [{ t: 'Vòng tay', m: '', c: 'Cẩm thạch', s: '54', p: 1000 }];
  await w._coPickAdd(0);
  ok(asked.length === 1 && asked[0][0].t === 'Vòng tay' && asked[0][0].c === 'Cẩm thạch' && asked[0][0].s === '54', 'hỏi posPrice đủ tên/chất liệu/size');
  ok(w._co.items[0].code === 'VT01' && w._co.items[0].codeSrc === 'pos' && els['co-code-0'].value === 'VT01', 'khớp chất liệu → tự điền mã VT01');
  ok(/Tự điền từ đơn POS 20\/11\/2026/.test(els['co-code-hint-0'].innerHTML) && els['co-code-warn'].innerHTML === '', 'ghi rõ mã lấy từ đơn nào, hết cảnh báo');
  ok(w._coPayload(w._co).items[0].code === 'VT01' && g._crmOrderNormalize_(w._coPayload(w._co)).order.items[0].code === 'VT01', 'mã gửi lên server và server giữ nguyên');
  ok(!('posQ' in w._coPayload(w._co).items[0]) && !('codeHint' in w._coPayload(w._co).items[0]), 'không gửi trường phụ');
  // 2) đổi mô tả → bỏ mã tự điền
  w._coItemSet(0, 'note', 'Ruby · 54'); ok(w._co.items[0].code === '' && /1 dòng chưa có mã/.test(els['co-code-warn'].innerHTML), 'sửa mô tả → xoá mã tự điền + cảnh báo kho giữ đơn');
  // 3) khác chất liệu → chỉ gợi ý
  w._co = w._coBlank(); asked = []; reply = () => ({ ok: true, results: [found('NH-RUBY', 'Nhẫn Ruby')] });
  w._coPick.list = [{ t: 'Nhẫn', c: 'Sapphire', s: '', p: 500 }]; await w._coPickAdd(0);
  ok(w._co.items[0].code === '' && /Gợi ý <b>NH-RUBY<\/b>/.test(els['co-code-hint-0'].innerHTML) && /Dùng mã/.test(els['co-code-hint-0'].innerHTML), 'tên POS thiếu chất liệu → không tự điền, chỉ gợi ý');
  w._coCodeUse(0); ok(w._co.items[0].code === 'NH-RUBY', 'bấm Dùng mã → điền');
  // 4) dòng tay: chỉ gợi ý; mã gõ tay không bị đụng
  w._co = w._coBlank(); asked = []; reply = () => ({ ok: true, results: [found('X1', 'Dây chuyền')] });
  w._coAddItem(); w._coItemSet(0, 'name', 'Dây chuyền'); await w._coCodeAsk([w._co.items[0]]);
  ok(w._co.items[0].code === '' && w._co.items[0].codeHint.code === 'X1', 'dòng gõ tay → chỉ gợi ý');
  w._coItemSet(0, 'code', ' TAY-9 '); asked = []; await w._coCodeAsk([w._co.items[0]]);
  ok(w._co.items[0].code === 'TAY-9' && w._co.items[0].codeSrc === 'tay' && asked.length === 0, 'mã gõ tay giữ nguyên, không hỏi lại');
  w._coItemSet(0, 'name', 'Dây chuyền vàng'); ok(w._co.items[0].code === 'TAY-9', 'đổi tên không xoá mã gõ tay');
  // 5) đang chờ mà người dùng gõ mã / sửa tên → bỏ kết quả cũ
  w._co = w._coBlank(); let release; reply = () => new Promise(r => { release = r; });
  w._coPick.list = [{ t: 'Lắc', c: '', s: '', p: 1 }]; let p = w._coPickAdd(0); await new Promise(r => setTimeout(r, 10));
  ok(/Đang tìm mã/.test(els['co-code-hint-0'].innerHTML), 'đang chờ hiện "Đang tìm mã"');
  w._coItemSet(0, 'code', 'MINE'); release({ ok: true, results: [found('OLD', 'Lắc')] }); await p;
  ok(w._co.items[0].code === 'MINE', 'kết quả đến sau không đè mã vừa gõ');
  // 6) không tìm thấy / lỗi mạng → có nút Tìm mã
  w._co = w._coBlank(); reply = () => ({ ok: true, results: [{ found: false }] }); w._coPick.list = [{ t: 'Z', c: '', s: '', p: 1 }]; await w._coPickAdd(0);
  ok(/Không tìm thấy mã/.test(els['co-code-hint-0'].innerHTML) && /Tìm mã/.test(els['co-code-hint-0'].innerHTML), 'không có trên POS → báo + nút Tìm mã');
  reply = () => { throw new Error('net'); }; await w._coCodeRetry(0); ok(/Không tra được mã/.test(els['co-code-hint-0'].innerHTML), 'lỗi mạng → báo, không vỡ');
  ok(/aria-label="Mã SP"/.test(fakeEl('xt-wrap-taodon').innerHTML) && /id="co-code-warn"/.test(fakeEl('xt-wrap-taodon').innerHTML), 'form có ô Mã SP + chỗ cảnh báo');
  // 7) combo: hỏi mã gộp 1 lần cho các món
  w._co = w._coBlank(); asked = []; reply = q => ({ ok: true, results: q.map((o, i) => found('C' + i, o.t + ' ' + o.c)) });
  w._coCmb.rows = [{ code: 'CB', name: 'Bộ', usable: true, priceVnd: 300000, finalPrice: 300000, items: [{ name: 'A', chatLieu: 'Bạc', qty: 1, price: 100000 }, { name: 'B', qty: 1, price: 200000 }] }];
  await w._coCmbAdd(0);
  ok(asked.length === 1 && asked[0].length === 2 && w._co.items[0].code === 'C0' && w._co.items[1].code === 'C1', 'thêm combo → 1 lần hỏi, điền mã từng món');
  console.log('ALL PASS');
})().catch(e => { console.error('ERR', e); process.exit(1); });

#!/usr/bin/env node
// Test giao diện Tồn kho (js/46-fn-kho.js) bằng jsdom + fetch giả. CẦN: npm i jsdom (không nằm trong repo; thiếu thì tự bỏ qua).
// Chạy: node tools/test-kho-ui.js -> "ALL KHO UI TESTS PASSED"
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom (npm i jsdom)'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'js', '46-fn-kho.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(user, role) {
  const dom = new JSDOM('<!doctype html><body><div id="toast"></div></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
  const w = dom.window, calls = [], toasts = [];
  w.localStorage.setItem('ome_sess_token', 'TOK');
  w.gsUrl = 'https://gas.test/exec';
  w.esc = s => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = m => toasts.push(m); w.confirm = () => true;
  w._authAccount = { username: user, role };
  w.accounts = [{ username: 'Trang', name: 'Trang' }, { username: 'Lan', name: 'Lan' }, { username: 'Bao', name: 'Bao' }];
  const items = [
    { khoId: 'K1', maHang: 'A1', tenHang: 'Áo thun <img src=x onerror=alert(1)>', ton: 10, minTon: 3, ver: 1, updatedBy: 'trang' },
    { khoId: 'K1', maHang: 'B2', tenHang: 'Quần', ton: 2, minTon: 5, ver: 4, updatedBy: '' },
    { khoId: 'K1', maHang: 'C3', tenHang: 'Mũ', ton: 0, minTon: null, ver: 1, updatedBy: '' }];
  const kho = [{ id: 'K1', name: 'Kho Sản xuất', leaders: ['trang'], staff: ['lan'], active: true, note: '' }, { id: 'K2', name: 'Kho cũ', leaders: [], staff: [], active: false, note: '' }];
  w.__respond = null;
  w.fetch = async (url, o) => {
    const isPost = o && o.method === 'POST', body = isPost ? JSON.parse(o.body) : null, u = new URL(url), action = isPost ? body.action : u.searchParams.get('action');
    calls.push({ action, body, qs: u.search });
    if (w.__respond) { const r = w.__respond(action, body); if (r) return { json: async () => r }; }
    const J = j => ({ json: async () => j });
    if (action === 'khoList') return J({ ok: true, kho });
    if (action === 'tonKho') return J({ ok: true, items: items.slice() });
    if (action === 'tonKhoSet') return J({ ok: true, item: Object.assign({}, items[0], { ton: body.newQty, ver: body.expectedVer + 1 }) });
    if (action === 'tonKhoAdjust') return J({ ok: true, item: Object.assign({}, items[0], { ton: items[0].ton + body.delta, ver: 2 }) });
    if (action === 'tonKhoItemSave') return J({ ok: true, created: true, item: { khoId: 'K1', maHang: body.maHang, tenHang: body.tenHang, ton: Number(body.ton), minTon: null, ver: 1 } });
    if (action === 'tonKhoLog') return J({ ok: true, log: [{ maHang: 'A1', loai: 'kiem_ke', before: 10, after: 8, delta: -2, lyDo: 'Kiểm kê', user: 'lan', ts: '2026-10-12T01:00:00Z' }] });
    if (action === 'khoSave') return J({ ok: true, kho: { id: 'K9', name: body.kho.name } });
    return J({ error: 'khong ho tro ' + action });
  };
  w.eval(code);
  return { w, d: w.document, calls, toasts, items };
}
const q = (d, s) => d.querySelector(s), qa = (d, s) => [...d.querySelectorAll(s)];
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const setv = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };

(async () => {
  // 1) Nhân viên kho
  let t = boot('lan', 'cs'); await t.w.openKhoModal(); await sleep(20);
  let { w, d } = t;
  ok(qa(d, '#tk-kho option').length === 1 && !qa(d, '#tk-kho option')[0].textContent.includes('cũ'), 'chi thay kho dang hoat dong');
  ok(qa(d, '.tk-row').length === 3, 'render 3 mat hang');
  ok(!d.querySelector('.tk-name img'), 'XSS: ten hang khong tao the img');
  ok(qa(d, '[data-tk-edit]').length === 3, 'nhan vien thay nut Sua');
  ok(q(d, '#tk-new').style.display === 'none' && q(d, '#tk-imp').style.display === 'none' && q(d, '#tk-manage').style.display === 'none', 'nhan vien khong thay Them/Nhap Excel/Quan ly kho');
  ok(qa(d, '.tk-row.low').length === 1 && /sắp hết/.test(q(d, '.tk-row.low').textContent), 'canh bao sap het (B2: 2 <= 5)');
  // tìm kiếm không dấu + lọc sắp hết
  setv(w, q(d, '#tk-q'), 'quan'); ok(qa(d, '.tk-row').length === 1 && /B2/.test(q(d, '.tk-row').textContent), 'tim "quan" khong dau ra Quan');
  setv(w, q(d, '#tk-q'), ''); q(d, '#tk-low').checked = true; q(d, '#tk-low').dispatchEvent(new w.Event('change', { bubbles: true })); ok(qa(d, '.tk-row').length === 1, 'loc Sap het');
  q(d, '#tk-low').checked = false; q(d, '#tk-low').dispatchEvent(new w.Event('change', { bubbles: true }));

  // 2) Sửa tồn: thiếu lý do không gửi; đủ thì gửi kèm expectedVer
  click(w, q(d, '[data-tk-edit="A1"]')); ok(q(d, '#tk-dlg.open'), 'mo hop thoai sua');
  setv(w, q(d, '#tk-m'), 'set'); setv(w, q(d, '#tk-n'), '8'); const before = t.calls.length;
  click(w, q(d, '#tk-d-ok')); await sleep(10); ok(t.calls.length === before && t.toasts.slice(-1)[0] === 'Nhập lý do', 'thieu ly do -> khong gui');
  setv(w, q(d, '#tk-w'), 'Kiểm kê'); click(w, q(d, '#tk-d-ok')); await sleep(20);
  let c = t.calls.filter(x => x.action === 'tonKhoSet').pop();
  ok(c && c.body.newQty === 8 && c.body.expectedVer === 1 && c.body.khoId === 'K1' && c.body.maHang === 'A1', 'tonKhoSet dung tham so: ' + JSON.stringify(c && c.body));
  ok(!q(d, '#tk-dlg.open') && /<b>8<\/b>/.test(qa(d, '.tk-row')[0].innerHTML), 'dong cap nhat = 8 va dong hop thoai');
  // xuất bớt -> delta âm
  click(w, q(d, '[data-tk-edit="A1"]')); setv(w, q(d, '#tk-m'), 'out'); setv(w, q(d, '#tk-n'), '3'); setv(w, q(d, '#tk-w'), 'Xuất bán'); click(w, q(d, '#tk-d-ok')); await sleep(20);
  c = t.calls.filter(x => x.action === 'tonKhoAdjust').pop(); ok(c && c.body.delta === -3, 'xuat bot -> delta -3');
  // số âm bị chặn phía client
  click(w, q(d, '[data-tk-edit="A1"]')); setv(w, q(d, '#tk-n'), '-1'); setv(w, q(d, '#tk-w'), 'x y'); const n0 = t.calls.length; click(w, q(d, '#tk-d-ok')); await sleep(10); ok(t.calls.length === n0, 'so luong am khong gui');
  // CONFLICT: thay dòng bằng số mới của server, đóng hộp thoại
  w.__respond = (a) => a === 'tonKhoSet' ? { error: 'x', code: 'CONFLICT', current: { khoId: 'K1', maHang: 'A1', tenHang: 'Áo', ton: 99, minTon: 3, ver: 7 } } : null;
  setv(w, q(d, '#tk-n'), '5'); click(w, q(d, '#tk-d-ok')); await sleep(20);
  ok(/<b>99<\/b>/.test(qa(d, '.tk-row')[0].innerHTML) && !q(d, '#tk-dlg.open'), 'CONFLICT -> hien so moi cua server (99)'); w.__respond = null;
  // lịch sử
  click(w, q(d, '[data-tk-hist="A1"]')); await sleep(20); ok(/Kiểm kê/.test(q(d, '#tk-h').textContent) && /-2/.test(q(d, '#tk-h').textContent), 'lich su hien'); ok(t.calls.pop().qs.includes('maHang=A1'), 'lich su loc theo ma hang');

  // 3) Người ngoài kho: chỉ xem
  t = boot('bao', 'cs'); await t.w.openKhoModal(); await sleep(20);
  ok(qa(t.d, '[data-tk-edit]').length === 0 && qa(t.d, '.tk-row').length === 3, 'nguoi ngoai kho chi xem, khong co nut Sua');

  // 4) Leader: thêm mặt hàng + trùng mã + import
  t = boot('trang', 'cs'); await t.w.openKhoModal(); await sleep(20); ({ w, d } = t);
  ok(q(d, '#tk-new').style.display !== 'none' && q(d, '#tk-imp').style.display !== 'none' && q(d, '#tk-manage').style.display === 'none', 'leader thay Them + Nhap Excel, khong thay Quan ly kho');
  click(w, q(d, '#tk-new')); setv(w, q(d, '#tk-c'), 'a1'); click(w, q(d, '#tk-d-ok')); await sleep(10); ok(/đã có/.test(t.toasts.slice(-1)[0]), 'ma trung (khong phan biet hoa thuong) bi chan');
  setv(w, q(d, '#tk-c'), 'D4'); setv(w, q(d, '#tk-nm'), 'Áo mới'); setv(w, q(d, '#tk-n'), '12'); click(w, q(d, '#tk-d-ok')); await sleep(20);
  ok(qa(d, '.tk-row').length === 4 && t.calls.filter(x => x.action === 'tonKhoItemSave').pop().body.ton === '12', 'them mat hang moi');
  // đọc file Pos: dòng tiêu đề nằm sau vài dòng đầu, có dòng Tổng
  const pos = [['BÁO CÁO TỔNG HỢP TỒN KHO'], ['Từ 01/10 đến 12/10'], [], ['Tên kho', 'Mã hàng', 'Tên hàng', 'Cuối kỳ'], ['Kho Sản xuất', 'M-1', 'Vòng', 1308], ['Kho Sản xuất', 'M-2', 'Nhẫn', '1.250'], ['Kho Sản xuất', '', 'Dòng trống', 5], ['Tổng', '', '', 2558]];
  const p = w._tkParseSheet(pos); ok(!p.error && p.items.length === 2 && p.items[0].maHang === 'M-1' && p.items[1].ton === '1.250' && p.khos.join() === 'Kho Sản xuất', 'doc dung file Pos: ' + JSON.stringify(p));
  ok(/Mã hàng/.test(w._tkParseSheet([['a', 'b'], [1, 2]]).error), 'file sai dinh dang -> bao loi ro');
  // import qua giao diện (XLSX giả), tên kho khác -> cảnh báo
  w.XLSX = { read: () => ({ SheetNames: ['S'], Sheets: { S: 1 } }), utils: { sheet_to_json: () => pos.map((r, i) => i >= 4 ? [r[0] === 'Kho Sản xuất' ? 'Kho khác' : r[0], r[1], r[2], r[3]] : r) } };
  click(w, q(d, '#tk-imp')); const fi = q(d, '#tk-f'); Object.defineProperty(fi, 'files', { value: [{ arrayBuffer: async () => new ArrayBuffer(1) }] }); fi.dispatchEvent(new w.Event('change')); await sleep(20);
  ok(/khác kho đang chọn/.test(q(d, '#tk-prev').innerHTML) && !q(d, '#tk-d-ok').disabled, 'canh bao ten kho trong file khac kho dang chon');
  click(w, q(d, '#tk-d-ok')); await sleep(30); const ic = t.calls.filter(x => x.action === 'tonKhoImport').pop();
  ok(ic && ic.body.khoId === 'K1' && ic.body.mode === 'set' && ic.body.items.length === 2, 'gui import dung kho/che do/so dong');

  // 5) Admin: quản lý kho — staff không trùng leader
  t = boot('admin', 'admin'); await t.w.openKhoModal(); await sleep(20); ({ w, d } = t);
  ok(q(d, '#tk-manage').style.display !== 'none' && qa(d, '#tk-kho option').length === 2, 'admin thay Quan ly kho va ca kho ngung');
  click(w, q(d, '#tk-manage')); click(w, q(d, '#tk-newkho')); setv(w, q(d, '#tk-kn'), 'Kho Hà Nội');
  const L = u => q(d, 'input[data-lead="' + u + '"]'), S = u => q(d, 'input[data-staff="' + u + '"]');
  L('trang').checked = true; S('trang').checked = true; S('lan').checked = true; click(w, q(d, '#tk-ksave')); await sleep(30);
  const ks = t.calls.filter(x => x.action === 'khoSave').pop().body.kho; ok(ks.name === 'Kho Hà Nội' && ks.leaders.join() === 'trang' && ks.staff.join() === 'lan' && ks.id === undefined, 'khoSave: leader khong bi lap trong staff: ' + JSON.stringify(ks));
  // 6) Chưa đăng nhập thật
  t = boot('lan', 'cs'); t.w.localStorage.removeItem('ome_sess_token'); await t.w.openKhoModal(); ok(/đăng nhập/.test(t.toasts.slice(-1)[0]) && !t.d.getElementById('tk-overlay'), 'chua dang nhap -> nhac, khong mo');
  console.log('ALL KHO UI TESTS PASSED');
})().catch(e => { console.error('FAIL (exception):', e); process.exit(1); });

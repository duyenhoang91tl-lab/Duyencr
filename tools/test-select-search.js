#!/usr/bin/env node
// Ô chọn có tìm nhanh (js/99-e-select-search.js). Cần jsdom: npm i --no-save jsdom@24
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '99-e-select-search.js'), 'utf8');
const dom = new JSDOM(`<!doctype html><body>
  <select id="s"><option value="">— Chọn sale để thêm —</option><option value="a">Admin</option><option value="g">giangNTH1991</option>
    <option value="h">Lê Phương Anh</option><option value="d">Diệu Tâm DMP</option><option value="x" disabled>Khoá</option>
    <optgroup label="Online"><option value="o1">hanguyen2003</option></optgroup></select>
  <select id="m" multiple><option>a</option></select>
  <div data-no-search><select id="n"><option>a</option></select></div>
</body>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = w.document;
w.eval(src);
const ss = w.selectSearch, $ = (q) => d.querySelector(q), all = (q) => [...d.querySelectorAll(q)];
const s = $('#s');
s.getClientRects = () => [1];   // jsdom không dựng khung hình
const events = []; s.addEventListener('input', () => events.push('input')); s.addEventListener('change', () => events.push('change:' + s.value));
let ok = 0; const t = (name, fn) => { fn(); ok++; console.log('ok   ' + name); };
const key = (k, target, extra) => { const e = new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra)); (target || $('.ss-q') || d.body).dispatchEvent(e); return e; };
const down = (el, extra) => { const e = new w.MouseEvent('mousedown', Object.assign({ bubbles: true, cancelable: true, button: 0 }, extra)); el.dispatchEvent(e); return e; };
const type = (v) => { const q = $('.ss-q'); q.value = v; q.dispatchEvent(new w.Event('input', { bubbles: true })); };
const rows = () => all('.ss-opt').map((e) => e.textContent);

t('tìm không dấu, nhiều từ, viết liền', () => {
  const it = ['Lê Phương Anh', 'Diệu Tâm DMP', 'Đỗ Hà', 'giangNTH1991'].map((text) => ({ text }));
  assert.deepStrictEqual([...ss.filter(it, 'phuong le')], [0]);
  assert.deepStrictEqual([...ss.filter(it, 'lephuong')], [0]);
  assert.deepStrictEqual([...ss.filter(it, 'dieu tam')], [1]);
  assert.deepStrictEqual([...ss.filter(it, 'do ha')], [2]);
  assert.deepStrictEqual([...ss.filter(it, 'NTH19')], [3]);
  assert.deepStrictEqual([...ss.filter(it, '  ')], [0, 1, 2, 3]);
  assert.deepStrictEqual([...ss.filter(it, 'zzz')], []);
});
t('không can thiệp multiple / data-no-search / ô khoá', () => {
  assert.strictEqual(ss.eligible($('#m')), false);
  assert.strictEqual(ss.eligible($('#n')), false);
  assert.strictEqual(down($('#n')).defaultPrevented, false);
  assert.strictEqual(ss.isOpen(), false);
  s.disabled = true; assert.strictEqual(ss.eligible(s), false); s.disabled = false;
});
t('bấm ô → chặn danh sách gốc, hiện ô tìm + đủ mục + nhóm', () => {
  assert.strictEqual(down(s).defaultPrevented, true);
  assert.ok(ss.isOpen()); assert.strictEqual(d.activeElement, $('.ss-q'));
  assert.strictEqual(rows().length, 7); assert.strictEqual($('.ss-grp').textContent, 'Online');
});
t('gõ → lọc → Enter chọn, bắn input + change 1 lần', () => {
  type('phuong'); assert.deepStrictEqual(rows(), ['Lê Phương Anh']);
  key('Enter'); assert.strictEqual(s.value, 'h'); assert.deepStrictEqual(events, ['input', 'change:h']);
  assert.strictEqual(ss.isOpen(), false); assert.strictEqual(d.activeElement, s);
});
t('chọn lại mục đang chọn → không bắn change', () => {
  down(s); events.length = 0; key('Enter'); assert.deepStrictEqual(events, []); assert.strictEqual(ss.isOpen(), false);
});
t('bấm chuột vào dòng; dòng khoá không chọn được', () => {
  down(s); all('.ss-opt').find((e) => e.textContent === 'Khoá').click(); assert.strictEqual(s.value, 'h'); assert.ok(ss.isOpen());
  type('giang'); $('.ss-opt').click(); assert.strictEqual(s.value, 'g');
});
t('↑ ↓ bỏ qua mục khoá; tên nhóm cũng tìm được', () => {
  down(s); type('online'); assert.deepStrictEqual(rows(), ['hanguyen2003']);
  type(''); const act = () => $('.ss-opt.active').textContent;
  assert.strictEqual(act(), 'giangNTH1991'); key('ArrowDown'); key('ArrowDown'); assert.strictEqual(act(), 'Diệu Tâm DMP'); key('ArrowDown'); assert.strictEqual(act(), 'hanguyen2003');
  key('ArrowUp'); assert.strictEqual(act(), 'Diệu Tâm DMP'); key('Escape');
});
t('Esc chỉ đóng danh sách, không lọt tới hộp thoại phía sau', () => {
  let leaked = 0; const h = () => leaked++; d.addEventListener('keydown', h);
  down(s); key('Escape'); assert.strictEqual(ss.isOpen(), false); assert.strictEqual(leaked, 0); d.removeEventListener('keydown', h);
});
t('bấm trong khung không kích hoạt "bấm ra ngoài thì đóng"; bấm ngoài thì đóng', () => {
  let outside = 0; const h = () => outside++; d.addEventListener('click', h);
  down(s); type('admin'); $('.ss-opt').click(); assert.strictEqual(outside, 0); d.removeEventListener('click', h);
  down(s); down(d.body); assert.strictEqual(ss.isOpen(), false);
});
t('gõ chữ khi đang đứng ở ô → mở kèm chữ đó', () => {
  const e = key('g', s); assert.ok(e.defaultPrevented); assert.strictEqual($('.ss-q').value, 'g'); key('Escape');
});
t('không tìm thấy → báo rõ, Enter không đổi giá trị', () => {
  const before = s.value; down(s); type('qqqq'); assert.ok(/Không tìm thấy/.test($('.ss-note').textContent)); key('Enter'); assert.strictEqual(s.value, before); key('Escape');
});
t('tên có ký tự HTML hiện nguyên văn', () => {
  const o = d.createElement('option'); o.value = 'z'; o.text = '<img src=x onerror=1>'; s.appendChild(o);
  down(s); type('<img'); assert.strictEqual($('.ss-opt').textContent, '<img src=x onerror=1>'); assert.strictEqual($('.ss-list img'), null); key('Escape'); o.remove();
});
t('màn hình vẽ lại ô cùng id trong lúc mở → chọn vẫn vào ô mới', () => {
  down(s); type('admin');
  const n = s.cloneNode(true); n.getClientRects = () => [1]; s.replaceWith(n);
  let got = ''; n.addEventListener('change', () => { got = n.value; });
  key('Enter'); assert.strictEqual(got, 'a'); n.replaceWith(s);
});
t('danh sách rất dài: giới hạn số dòng, mục đang chọn vẫn hiện', () => {
  const big = d.createElement('select'); for (let i = 0; i < 1000; i++) big.add(new w.Option('Mục ' + i, String(i)));
  big.selectedIndex = 900; d.body.appendChild(big); big.getClientRects = () => [1];
  down(big); assert.strictEqual(all('.ss-opt').length, 400); assert.strictEqual($('.ss-opt.active').textContent, 'Mục 900');
  type('mục 999'); assert.deepStrictEqual(rows(), ['Mục 999']); key('Escape'); big.remove();
});
t('công tắc tắt khẩn cấp', () => {
  w.localStorage.setItem('ome_native_select', '1'); assert.strictEqual(down(s).defaultPrevented, false); assert.strictEqual(ss.isOpen(), false); w.localStorage.removeItem('ome_native_select');
});
console.log('\n' + ok + ' ca — TẤT CẢ ĐẠT'); w.close(); process.exit(0);

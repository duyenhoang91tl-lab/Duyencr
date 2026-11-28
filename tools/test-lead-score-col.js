#!/usr/bin/env node
// Test R8e — cột "Mức" nóng/ấm/nguội trong Danh sách KH (js/77-lead-score.js + điểm nối ở js/02, 05, 06, 08, index.html).
// Chạy: node tools/test-lead-score-col.js. File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };

const NOW = new Date(2026, 10, 15, 14, 30).getTime();
const ago = (d) => new Date(2026, 10, 15 - d, 9, 0).getTime();
const C = (o) => Object.assign({ phone: '0901', _lastActionDate: null, lastPosDate: null, totalOrders: 0, totalRevenue: 0, tier: 'Chưa bán lại được' }, o || {});

// Giả lập các biến toàn cục của trang (js/77 đọc `schedules`, `document`, `applyFilters` nếu có)
global.schedules = [];
const icons = { 'level-sort-icon': { textContent: '↕' }, 'lastpos-sort-icon': { textContent: '↓' }, 'lastact-sort-icon': { textContent: '↑' } };
global.document = { getElementById: (id) => icons[id] || null };
let applied = 0; global.applyFilters = () => { applied++; };
global._lastPosSortDir = -1; global._lastActSortDir = 1;
const m = require('../js/77-lead-score.js');

// ── ô Mức ──
const hot = m.lsScore_(C({ _lastActionDate: ago(3), lastPosDate: ago(10), totalOrders: 3, tier: 'Tiềm năng' }), [], NOW);
const cold = m.lsScore_(C({ _lastActionDate: ago(90), lastPosDate: ago(200), totalOrders: 2, tier: 'Tiềm năng' }), [], NOW);
let h = m.lsLevelCellHtml_(hot);
ok(/Nóng/.test(h) && />.*7/.test(h) && /title="/.test(h) && !/Sắp mất/.test(h), 'ô Mức NÓNG: có chữ Nóng + điểm 7 + tooltip lý do, KHÔNG có "Sắp mất"');
h = m.lsLevelCellHtml_(cold);
ok(cold.risk && /Nguội/.test(h) && /Sắp mất/.test(h), 'khách nguội + từng mua + hạng Tiềm năng → ô có thêm chip "Sắp mất"');
ok(/mới chăm 3 ngày trước/.test(m.lsLevelCellHtml_(hot)), 'tooltip chứa LÝ DO (không hộp đen)');
ok(/—/.test(m.lsLevelCellHtml_(null)) && /—/.test(m.lsLevelCellHtml_({})), 'thiếu dữ liệu → hiện "—", không lỗi');
const evil = m.lsLevelCellHtml_({ level: 'hot', label: 'Nóng', score: 9, reasons: ['<img src=x onerror=alert(1)>', 'a"b'], risk: false });
ok(!/<img/.test(evil) && /&lt;img/.test(evil) && /a&quot;b/.test(evil), 'lý do được ESCAPE (không chèn được HTML vào tooltip)');
global.uiChip_ = (t, o) => '<chip tone=' + o.tone + '>' + t + '</chip>';
h = m.lsLevelCellHtml_(hot);
ok(/<chip tone=success>🔥 Nóng · 7<\/chip>/.test(h), 'có ui-kit: Nóng → tone success (cùng màu hồ sơ 360°)');
ok(/tone=warning/.test(m.lsLevelCellHtml_(m.lsScore_(C({ _lastActionDate: ago(20), lastPosDate: ago(60) }), [], NOW))), 'Ấm → warning');
ok(/tone=danger>🧊 Nguội/.test(h = m.lsLevelCellHtml_(cold)) && /tone=danger>Sắp mất/.test(h), 'Nguội → danger; "Sắp mất" cũng danger');
delete global.uiChip_;

// ── điểm của 1 dòng dùng lịch toàn cục + cache gom lịch ──
global.schedules = [];
const base = m.lsRowScore_(C({ _lastActionDate: ago(20), lastPosDate: ago(100) }), NOW);
global.schedules = [{ phone: '0901', date: '2026-11-17', done: false }, { phone: '0999', date: '2026-11-17', done: false }];
const withSch = m.lsRowScore_(C({ _lastActionDate: ago(20), lastPosDate: ago(100) }), NOW + 6000);   // +6s → qua cửa sổ cache 5s
ok(withSch.soon === 1 && withSch.score === base.score + 2, 'lịch hẹn sắp tới của ĐÚNG SĐT cộng +2 điểm (lịch của SĐT khác không tính)');
global.schedules = [{ phone: '0901', date: '2026-11-17', done: true }, { phone: '0999', date: '2026-11-17', done: false }];   // mảng lịch được THAY (cùng số lượng) → khoá đếm không đổi, chỉ cửa sổ 5s mới làm mới
ok(m.lsRowScore_(C({ _lastActionDate: ago(20), lastPosDate: ago(100) }), NOW + 6000).soon === 1, 'trong cùng cửa sổ 5s dùng cache gom lịch (nhanh)');
ok(m.lsRowScore_(C({ _lastActionDate: ago(20), lastPosDate: ago(100) }), NOW + 12000).soon === 0, 'sang cửa sổ 5s kế tiếp: lịch đã xong KHÔNG còn tính');
global.schedules = [];

// ── xếp theo mức ──
const L = [
  C({ phone: 'a', _lastActionDate: ago(90), lastPosDate: ago(200), totalRevenue: 5 }),                                 // nguội, điểm 0
  C({ phone: 'b', _lastActionDate: ago(3), lastPosDate: ago(10), totalOrders: 3, tier: 'Tiềm năng', totalRevenue: 1 }), // nóng 7
  C({ phone: 'c', _lastActionDate: ago(20), lastPosDate: ago(60), totalRevenue: 9 }),                                  // ấm 4
  C({ phone: 'd', _lastActionDate: ago(3), lastPosDate: ago(10), totalOrders: 3, tier: 'VIP', totalRevenue: 1 }),       // nóng 8 (hạng VIP +1 nên cao hơn b)
  C({ phone: 'e', _lastActionDate: ago(90), lastPosDate: ago(200), totalRevenue: 50 })                                  // nguội, điểm 0, doanh thu cao hơn a
];
let arr = L.slice(), ret = m.lsLevelSortList_(arr, -1, NOW);
ok(ret === arr, 'xếp TẠI CHỖ (trả về chính mảng truyền vào)');
ok(arr.map(c => c.phone).join('') === 'dbcea', 'nóng→ấm→nguội; trong nóng điểm cao trước (d=8 > b=7); trong nguội cùng điểm thì doanh thu cao trước (e > a)');
arr = L.slice(); m.lsLevelSortList_(arr, 1, NOW);
ok(arr[0].phone === 'a' && arr[arr.length - 1].phone === 'b' || arr[arr.length - 1].phone === 'd', 'chiều ngược: nguội trước, nóng sau cùng');
ok(m.lsLevelSortList_([], -1, NOW).length === 0 && m.lsLevelSortList_(null, -1, NOW).length === 0, 'danh sách rỗng/null không lỗi');
// hiệu năng 136k khách
const BIG = []; for (let i = 0; i < 136000; i++) BIG.push(C({ phone: String(i), _lastActionDate: ago(i % 120), lastPosDate: ago((i * 7) % 300), totalOrders: i % 4, totalRevenue: i % 1000 }));
let t0 = Date.now(); m.lsLevelSortList_(BIG, -1, NOW); const dt = Date.now() - t0;
ok(dt < 3000, 'xếp theo mức 136.000 khách < 3 giây (đo ' + dt + ' ms)');

// ── vòng bật/tắt xếp ──
icons['level-sort-icon'].textContent = '↕'; applied = 0;
m.lsToggleLevelSort_(); ok(icons['level-sort-icon'].textContent === '↓' && applied === 1, 'bấm lần 1: ↓ (nóng trước) + vẽ lại danh sách');
ok(global._lastPosSortDir === 0 && global._lastActSortDir === 0 && icons['lastpos-sort-icon'].textContent === '↕' && icons['lastact-sort-icon'].textContent === '↕', 'bật xếp theo Mức thì TẮT 2 kiểu xếp kia (chỉ 1 cột xếp 1 lúc) + trả icon ↕');
m.lsToggleLevelSort_(); ok(icons['level-sort-icon'].textContent === '↑', 'bấm lần 2: ↑ (nguội trước)');
m.lsToggleLevelSort_(); ok(icons['level-sort-icon'].textContent === '↕', 'bấm lần 3: tắt ↕');
m.lsToggleLevelSort_(); m.lsResetLevelSort_(); ok(icons['level-sort-icon'].textContent === '↕', 'lsResetLevelSort_ (do cột khác bật xếp) → tắt + icon ↕');

// ── điểm nối ở file nguồn (grep) ──
const idx = read('index.html'), j02 = read('js/02-fn-showrowerrorbanner.js'), j05 = read('js/05-fn-saveeditphone.js'), j06 = read('js/06-main-renew-sources.js'), j08 = read('js/08-fn-invalidatefiltercache.js');
ok(/id="th-level"/.test(idx) && /lsToggleLevelSort_\(\)/.test(idx) && /id="level-sort-icon"/.test(idx), 'index.html: có <th> Mức + icon xếp ↕');
ok(idx.indexOf('id="th-hang"') < idx.indexOf('id="th-level"') && idx.indexOf('id="th-level"') < idx.indexOf('id="th-care"'), 'index.html: cột Mức nằm giữa Phân hạng KH và Tình trạng CS');
ok(/toggleCol\('level',this\)/.test(idx), 'index.html: có chip bật/tắt cột Mức');
ok(/<td class="col-hang">[^\n]*\n\s*<td class="col-level"/.test(j02), 'js/02: <td class="col-level"> ngay sau col-hang (cùng thứ tự với <th>)');
ok(/lsLevelSortList_\(list, _lsLevelSortDir\)/.test(j02) && /else if \(_lastPosSortDir !== 0\)/.test(j02), 'js/02: nhánh xếp theo Mức đứng TRƯỚC, 2 kiểu xếp cũ thành else-if (loại trừ nhau)');
ok(/lsResetLevelSort_/.test(j05), 'js/05: xếp theo Ngày mua/Lần tác động tắt xếp theo Mức');
ok(/level:false/.test(j06) && /toggleCol\('level'/.test(idx), 'js/06: cột Mức mặc định ẨN (bảng gọn 7 cột), bật được ở Cột hiển thị');
ok(/_lsLevelSortDir/.test(j08), 'js/08: _filterSignature có chiều xếp theo Mức (không trả danh sách cũ)');
ok(/\.col-level\{width:/.test(read('css/26-lead-score.css')), 'css/26: có độ rộng cột Mức (token-only)');
ok(/js\/77-lead-score\.js\?v=\d{8}[a-z]/.test(idx), 'index.html: js/77 có mã ?v= chống cache');

console.log(bad ? ('\n' + bad + ' FAIL') : '\nTẤT CẢ ĐẠT');
process.exit(bad ? 1 : 0);

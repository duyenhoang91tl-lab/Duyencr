#!/usr/bin/env node
// R7a — kiểm khuôn báo cáo (js/76-report-frame.js + css/25-report-frame.css). Chạy: node tools/test-report-frame.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const F = require(path.join(ROOT, 'js/76-report-frame.js'));
const css = fs.readFileSync(path.join(ROOT, 'css/25-report-frame.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const jsSrc = fs.readFileSync(path.join(ROOT, 'js/76-report-frame.js'), 'utf8');
let fail = 0;
const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const at = (h, s) => h.indexOf(s);

// (1) mọi class rf-* trong JS có CSS
const used = new Set(); for (const m of jsSrc.matchAll(/['" ](rf(?:-[a-z]+)*)(?=[ '"])/g)) used.add(m[1]);
const defined = new Set(); for (const m of css.matchAll(/\.(rf(?:-[a-z]+)*)/g)) defined.add(m[1]);
const missing = [...used].filter(c => !defined.has(c) && !/-$/.test(c));
t(!missing.length, 'mọi class rf-* trong JS đều có CSS' + (missing.length ? ' — THIẾU: ' + missing.join(', ') : ' (' + used.size + ' class)'));

// (2) thứ tự khuôn: thanh lọc → thẻ số → biểu đồ → bảng → Xuất
const full = F.uiReportFrame_({ id: 'K', title: 'Chốt tháng', desc: 'mô tả', barHtml: '<i id="BAR"></i>', noticeHtml: '<i id="NOTE"></i>',
  stats: [{ label: 'Doanh thu', value: '1' }], chartTitle: 'Biểu đồ', chartHtml: '<svg id="CH"></svg>', tableTitle: 'Bảng', tableHtml: '<table id="TB"></table>',
  exports: [{ label: 'Excel', onclick: '_srKCsv_()', kind: 'excel', icon: '📥' }, { label: 'Ảnh', onclick: 'x()', kind: 'image' }] });
const order = ['id="BAR"', 'id="NOTE"', 'ui-stat-grid', 'id="CH"', 'id="TB"', 'rf-export'].map(s => at(full, s));
t(order.every(i => i >= 0) && order.every((v, i) => !i || v > order[i - 1]), 'thứ tự: thanh lọc → cảnh báo → thẻ số → biểu đồ → bảng → Xuất');
t(/data-rf="K"/.test(full) && /data-rf-export="excel"/.test(full) && /onclick="_srKCsv_\(\)"/.test(full), 'gắn data-rf, nút Xuất có onclick do code gọi truyền');

// (3) trạng thái
const ld = F.uiReportFrame_({ barHtml: '<i id="BAR"></i>', loading: true, stats: [{ label: 'a', value: '1' }], tableHtml: '<table></table>' });
t(/rf-loading/.test(ld) && /id="BAR"/.test(ld) && !/<table/.test(ld) && !/ui-stat/.test(ld), 'đang tải: giữ thanh lọc, không vẽ thẻ số/bảng');
const er = F.uiReportFrame_({ error: 'Lỗi mạng', retry: '_srLoad()' });
t(/rf-error/.test(er) && /Lỗi mạng/.test(er) && /onclick="_srLoad\(\)"/.test(er), 'lỗi: hiện chữ + nút Thử lại');
t(!/Thử lại/.test(F.uiReportFrame_({ error: 'x' })), 'lỗi không có retry → không vẽ nút');
const em = F.uiReportFrame_({ barHtml: '<i id="BAR"></i>' });
t(/rf-empty/.test(em) && /Chưa có dữ liệu/.test(em) && /id="BAR"/.test(em), 'rỗng: chữ mặc định + vẫn có thanh lọc để đổi lọc');
t(/Không có đơn/.test(F.uiReportFrame_({ empty: 'Không có đơn' })), 'rỗng: chữ tuỳ chỉnh');
const part = F.uiReportFrame_({ tableHtml: '<table></table>' });
t(!/rf-chart/.test(part) && !/ui-stat/.test(part) && !/rf-export/.test(part) && /<table/.test(part), 'thiếu khối nào thì bỏ cả khối đó (không khung trống)');
t(!/Xuất|rf-export-btn/.test(F.uiReportFrame_({ tableHtml: '<table></table>', exports: [{ label: 'a' }, null] })), 'nút Xuất thiếu onclick/null bị bỏ');

// (4) escape
const xss = '<img src=x onerror=alert(1)>';
const h = F.uiReportFrame_({ id: xss, title: xss, desc: xss, error: xss, chartTitle: xss, chartHtml: 'c', tableTitle: xss, tableHtml: 't', empty: xss, exports: [{ label: xss, onclick: 'a"b', icon: xss }] });
t(!/<img/i.test(h), 'escape title/desc/error/tiêu đề khối/nhãn nút/onclick');
t(!/<img/i.test(F.uiReportFrame_({ empty: xss })), 'escape chữ rỗng');
t(F.uiReportFrame_() !== undefined && /class="rf"/.test(F.uiReportFrame_()), 'gọi không tham số không lỗi');

// (5) CSS token-only (không màu cứng)
t(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), 'css/25 không có màu cứng (chỉ var(--…))');
if (fail) { console.log('\n' + fail + ' lỗi'); process.exit(1); } console.log('\nĐẠT');

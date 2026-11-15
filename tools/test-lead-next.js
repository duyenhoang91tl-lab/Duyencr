#!/usr/bin/env node
// Test R8c — gợi ý "việc tiếp theo" (js/77 lsNextStep_) + khối "Mức quan tâm" trong hồ sơ (js/33 proLeadHtml_). Chạy: node tools/test-lead-next.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), m = require('../js/77-lead-score.js'), p = require('../js/33-pro-profile.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const NOW = new Date(2026, 10, 15, 14, 30).getTime(), ago = (d) => new Date(2026, 10, 15 - d, 9, 0).getTime();
const C = (o) => Object.assign({ phone: '0901', _lastActionDate: null, lastPosDate: null, totalOrders: 0, tier: 'Chưa bán lại được' }, o);
const step = (c, sch) => { const s = m.lsScore_(c, sch || [], NOW); return { s, n: m.lsNextStep_(s, c) }; };

let r = step(C({ _lastActionDate: ago(2), lastPosDate: ago(3), totalOrders: 3, tier: 'Tiềm năng' }), [{ phone: '0901', date: '2026-11-10', done: false }]);
ok(r.n.go === 'sched' && /quá hạn/.test(r.n.text), 'ưu tiên 1: có lịch quá hạn → xử lý lịch (kể cả khách nóng)');
r = step(C({ _lastActionDate: ago(90), lastPosDate: ago(120), totalOrders: 2, tier: 'Tiềm năng' }));
ok(r.s.risk && r.n.go === 'note' && /Liên hệ lại ngay/.test(r.n.text) && /90 ngày/.test(r.n.why) && /2 đơn/.test(r.n.why) && /Tiềm năng/.test(r.n.why), 'sắp mất → liên hệ lại ngay, lý do nêu số ngày + số đơn + hạng');
r = step(C());
ok(r.n.go === 'note' && /làm quen/.test(r.n.text), 'chưa chăm lần nào + chưa mua → gọi làm quen');
r = step(C({ _lastActionDate: ago(80), totalOrders: 1 }));
ok(r.s.level === 'cold' && !r.s.risk && r.n.go === 'sched' && /80 ngày/.test(r.n.why), 'nguội nhưng chưa phải sắp mất → đặt lịch gọi lại');
r = step(C({ _lastActionDate: ago(5), lastPosDate: ago(40), totalOrders: 1 }), [{ phone: '0901', date: '2026-11-17', done: false }]);
ok(r.n.go === 'sched' && /1 lịch hẹn sắp tới/.test(r.n.text), 'có lịch sắp tới (không quá hạn) → chuẩn bị lịch');
r = step(C({ _lastActionDate: ago(1), lastPosDate: ago(2), totalOrders: 3, tier: 'Tiềm năng' }));
ok(r.s.level === 'hot' && r.n.go === 'order', 'khách nóng không có lịch → đề xuất chốt đơn');
r = step(C({ _lastActionDate: ago(20), lastPosDate: ago(60) }));
ok(r.s.level === 'warm' && r.n.go === 'sched' && /giữ nhịp/.test(r.n.text), 'khách ấm không có lịch → đặt lịch giữ nhịp');
ok(m.lsNextStep_(null, null).go && m.lsNextStep_({}, {}).text, 'null/rỗng → không văng lỗi, vẫn trả gợi ý');

// proLeadHtml_
let h = p.proLeadHtml_(m.lsScore_(C({ _lastActionDate: ago(90), lastPosDate: ago(120), totalOrders: 2, tier: 'Tiềm năng' }), [], NOW), r0 = m.lsNextStep_(m.lsScore_(C({ _lastActionDate: ago(90), lastPosDate: ago(120), totalOrders: 2, tier: 'Tiềm năng' }), [], NOW), C({ _lastActionDate: ago(90), totalOrders: 2, tier: 'Tiềm năng' })));
ok(/pro-chip bad/.test(h) && /🧊 Nguội/.test(h) && /Sắp mất/.test(h) && /Gợi ý:/.test(h) && /data-pro-qa="note"/.test(h), 'proLeadHtml_: chip nguội đỏ + Sắp mất + gợi ý + nút dùng data-pro-qa có sẵn');
h = p.proLeadHtml_({ level: 'hot', label: 'Nóng', score: 7, reasons: ['<script>x</script>'] }, { text: '<b>', why: '"', go: 'order', act: 'A&B' });
ok(!/<script>/.test(h) && /&lt;b&gt;/.test(h) && /&lt;script&gt;/.test(h) && /A&amp;B/.test(h) && /🔥/.test(h) && /pro-chip ok/.test(h), 'proLeadHtml_: escape lý do/gợi ý/nhãn nút');
ok(p.proLeadHtml_(null, null) === '' && p.proLeadHtml_({}, null) === '', 'thiếu dữ liệu → rỗng');
h = p.proLeadHtml_({ level: 'warm', label: 'Ấm', score: 4, reasons: [] }, null);
ok(/pro-chip warn/.test(h) && !/Gợi ý/.test(h) && !/pro-lead-why/.test(h), 'không có gợi ý/lý do → chỉ chip');
// nối vào hồ sơ: sau thanh nhanh, trước thanh giai đoạn; có try/catch
const src = fs.readFileSync(__dirname + '/../js/33-pro-profile.js', 'utf8'), i = src.indexOf('host.innerHTML = proQuickActionsHtml_');
ok(i > 0 && src.slice(i, i + 200).indexOf('leadHtml') > 0 && src.slice(i, i + 300).indexOf('leadHtml') < src.slice(i, i + 400).indexOf('proStageHtml_'), 'proRenderProfile_: khối mức quan tâm nằm giữa thanh hành động nhanh và thanh giai đoạn');
ok(/try \{ if \(typeof lsScore_==='function'\)/.test(src), 'thiếu js/77 hoặc lỗi tính điểm → hồ sơ vẫn vẽ bình thường (không có khối)');

console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);

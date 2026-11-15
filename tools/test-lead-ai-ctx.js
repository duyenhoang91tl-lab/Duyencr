#!/usr/bin/env node
// Test R8f — khối "Mức quan tâm" trong NGỮ CẢNH AI thật (js/77 lsAiBlock_ + js/38 proCustomerContext_/proAiContext_). Chạy: node tools/test-lead-ai-ctx.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), vm = require('vm'), m = require('../js/77-lead-score.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const NOW = new Date(2026, 10, 15, 14, 30).getTime(), ago = (d) => new Date(2026, 10, 15 - d, 9, 0).getTime();
const C = (o) => Object.assign({ phone: '0901234567', _lastActionDate: null, lastPosDate: null, totalOrders: 0, tier: 'Chưa bán lại được' }, o);

// — lsAiBlock_ (hàm thuần) —
const cHot = C({ _lastActionDate: ago(2), lastPosDate: ago(3), totalOrders: 3, tier: 'Tiềm năng' });
const sHot = m.lsScore_(cHot, [], NOW), stHot = m.lsNextStep_(sHot, cHot);
let b = m.lsAiBlock_(sHot, stHot);
ok(/NÓNG/.test(b) && new RegExp(sHot.score + ' điểm').test(b), 'khối có mức NÓNG + điểm đúng với lsScore_');
ok(/KHÔNG phải AI đoán/.test(b), 'ghi rõ điểm do quy tắc chấm, không phải AI đoán (để AI không tự chấm lại)');
ok(sHot.reasons.slice(0, 6).every(r => b.indexOf(r) >= 0), 'có đủ lý do (tối đa 6) lấy từ lsScore_');
ok(b.indexOf('NÓNG ≥' + 6) >= 0 && /quá 60 ngày/.test(b), 'ghi ngưỡng đang dùng (6/3 điểm, 60 ngày) lấy từ hằng của js/77');
ok(b.indexOf(stHot.text) >= 0 && b.indexOf('vì ' + stHot.why) >= 0, 'có "Việc nên làm tiếp" kèm lý do');
const cRisk = C({ _lastActionDate: ago(90), lastPosDate: ago(120), totalOrders: 2, tier: 'Tiềm năng' });
const sRisk = m.lsScore_(cRisk, [], NOW);
b = m.lsAiBlock_(sRisk, m.lsNextStep_(sRisk, cRisk));
ok(/NGUỘI/.test(b) && /SẮP MẤT/.test(b) && /Liên hệ lại ngay/.test(b), 'khách sắp mất: NGUỘI + SẮP MẤT + việc liên hệ lại ngay');
ok(!/0901234567/.test(b), 'khối KHÔNG chứa SĐT');
ok(m.lsAiBlock_(null, null) === '' && m.lsAiBlock_({}, null) === '', 'không có điểm → chuỗi rỗng, không văng lỗi');
b = m.lsAiBlock_({ level: 'warm', score: 4, reasons: [] }, null);
ok(/ẤM/.test(b) && !/Lý do:/.test(b) && !/Việc nên làm/.test(b), 'thiếu lý do/việc tiếp → bỏ dòng đó, vẫn hợp lệ');

// — js/38: proCustomerContext_ nhận khối + proAiContext_ tự tính —
const sandbox = { console, AbortController, setTimeout, clearTimeout, careData: {}, _posStatsOn: false, donStatsByPhone: {}, schedules: [], SCHED_TYPES: [{ key: 'goi', label: 'Hẹn gọi' }] };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('js/33-pro-profile.js', 'utf8') + '\n' + fs.readFileSync('js/38-pro-dock.js', 'utf8') + '\nthis.X={proCustomerContext_,proAiContext_,proAskPrompt_,proProfileData_,_proDock};', sandbox);
const X = sandbox.X, now = new Date(2026, 10, 15);
const cus = { phone: '0901234567', name: 'Chị Lan', tier: 'Tiềm năng', careStatus: 'Chốt', orders: [{ date: new Date(2026, 10, 12), revenue: 3000000, product: 'Combo A' }] };
const D = { care: { status: 'Chốt' }, nOrd: 1, types: sandbox.SCHED_TYPES, orders: cus.orders, notes: [{ text: 'Khách hỏi giá', user: 'Hà', time: '09:00 08/11/2026' }], mine: [] };
const base = X.proCustomerContext_(cus, D, 3, 3000000, now);
const withLead = X.proCustomerContext_(cus, D, 3, 3000000, now, 'Mức quan tâm (test): NÓNG · 7 điểm\nLý do: mới chăm 2 ngày trước');
ok(base === X.proCustomerContext_(cus, D, 3, 3000000, now, ''), 'không truyền/để rỗng khối điểm → ngữ cảnh GIỐNG HỆT bản cũ (tương thích ngược)');
ok(!/Mức quan tâm/.test(base), 'bản cũ không có dòng Mức quan tâm');
ok(/Mức quan tâm \(test\): NÓNG/.test(withLead) && /Lý do: mới chăm 2 ngày/.test(withLead), 'truyền khối → ngữ cảnh có khối (nhiều dòng giữ nguyên)');
ok(withLead.indexOf('Mức quan tâm') > withLead.indexOf('Số đơn:') && withLead.indexOf('Mức quan tâm') < withLead.indexOf('Lịch hẹn chưa xong:'), 'khối nằm SAU "Số đơn", TRƯỚC lịch/ghi chú/đơn gần nhất (bị cắt đuôi thì mất ghi chú cũ trước)');
ok(!/0901234567/.test(X.proCustomerContext_(cus, D, 3, 3000000, now, 'gọi 0987654321 nhé')) && /\[SĐT\]/.test(X.proCustomerContext_(cus, D, 3, 3000000, now, 'gọi 0987654321 nhé')), 'khối được ẩn SĐT lần nữa trước khi gửi (phòng thủ)');
// prompt dài: khối điểm khách còn sau khi cắt tới giới hạn 8500
const longNotes = Object.assign({}, D, { notes: Array.from({ length: 60 }, (_, i) => ({ text: 'ghi chú dài '.repeat(60) + i, user: 'Hà', time: '09:00 0' + (1 + i % 9) + '/11/2026' })) });
const pr = X.proAskPrompt_(X.proCustomerContext_(cus, longNotes, 3, 3000000, now, 'Mức quan tâm (test): NÓNG · 7 điểm'), 'khách này nên làm gì?', []);
ok(pr.length <= 8600 && /Mức quan tâm \(test\)/.test(pr), 'prompt dài vẫn ≤ giới hạn và còn khối Mức quan tâm');

// proAiContext_ (chế độ khách): tự gọi lsRowScore_/lsAiBlock_/lsNextStep_ khi có js/77; thiếu hoặc lỗi → như cũ
function mk(extra) {
  const sb = Object.assign({}, sandbox, { allCustomers: [Object.assign({}, cus, { _lastActionDate: ago(2), lastPosDate: ago(3), totalOrders: 3 })], currentPhone: '0901234567', _custRev_: () => 3000000, proDaysSinceLastOrder_: undefined }, extra || {});
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync('js/33-pro-profile.js', 'utf8') + '\n' + fs.readFileSync('js/38-pro-dock.js', 'utf8') + (extra && extra.__noLs ? '' : '\n' + fs.readFileSync('js/77-lead-score.js', 'utf8')) + '\n_proDock.mode="customer"; this.R = proAiContext_();', sb);
  return sb.R;
}
let r = mk();
ok(r && r.text && /Mức quan tâm \(hệ thống chấm theo quy tắc/.test(r.text) && /NÓNG/.test(r.text), 'proAiContext_: có js/77 → ngữ cảnh khách có khối Mức quan tâm (NÓNG)');
ok(!/0901234567/.test(r.text), 'proAiContext_: ngữ cảnh KHÔNG chứa SĐT');
r = mk({ __noLs: true });
ok(r && r.text && !/Mức quan tâm/.test(r.text) && /Tên: Chị Lan/.test(r.text), 'proAiContext_: thiếu js/77 → ngữ cảnh như cũ, không lỗi');
r = mk({ lsRowScore_: () => { throw new Error('boom'); }, lsAiBlock_: () => 'x', __noLs: true });
ok(r && r.text && !/Mức quan tâm/.test(r.text) && /Tên: Chị Lan/.test(r.text), 'proAiContext_: tính điểm lỗi → bắt lỗi, ngữ cảnh như cũ (AI vẫn hỏi được)');

console.log(bad ? '\nFAIL ' + bad : '\nPASS tất cả');
process.exit(bad ? 1 : 0);

#!/usr/bin/env node
// Test HẠN TICKET + HẠN TRẢ LỜI TIN (gas/34b_Ticket.gs, mục 11 bước 11a). Chạy: node tools/test-ticket-sla.js -> "ALL TICKET SLA TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { console, Math, Number, isFinite, JSON, String, Object, Array, Date };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas', '34b_Ticket.gs'), 'utf8'), ctx, { filename: '34b_Ticket.gs' });
const run = s => vm.runInContext(s, ctx), J = x => JSON.stringify(x);
const vn = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 7, mi);       // giờ VN → ms
const hm = ms => { const d = new Date(ms + 7 * 3600000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1); };
const reply = (ms, cfg) => run('_ticketReplyDueMs_(' + J(ms) + ',' + J(cfg || null) + ')');
// ── ví dụ ĐÚNG như docx: thứ Sáu 27/11/2026
ok(hm(reply(vn(2026, 11, 27, 16, 50))) === '17:20 27/11', '16:50 thứ Sáu → hạn 17:20: ' + hm(reply(vn(2026, 11, 27, 16, 50))));
ok(hm(reply(vn(2026, 11, 27, 20, 0))) === '22:00 27/11', '20:00 → hạn 22:00 (ngoài giờ 2 giờ thực)');
// ── ranh giới giờ làm việc
ok(hm(reply(vn(2026, 11, 27, 8, 0))) === '08:30 27/11', '08:00 đúng giờ mở cửa = trong giờ');
ok(hm(reply(vn(2026, 11, 27, 7, 59))) === '09:59 27/11', '07:59 = ngoài giờ (+2h)');
ok(hm(reply(vn(2026, 11, 27, 16, 59))) === '17:29 27/11', '16:59 = trong giờ (+30p)');
ok(hm(reply(vn(2026, 11, 27, 17, 0))) === '19:00 27/11', '17:00 đúng = ngoài giờ (+2h)');
ok(hm(reply(vn(2026, 11, 27, 23, 30))) === '01:30 28/11', '23:30 qua ngày: 2 giờ thực → 01:30 hôm sau');
// ── cả tuần T2–CN: Chủ nhật 29/11 10:00 vẫn trong giờ
ok(hm(reply(vn(2026, 11, 29, 10, 0))) === '10:30 29/11', 'Chủ nhật 10:00 vẫn trong giờ (T2–CN)');
ok(hm(reply(vn(2026, 11, 29, 10, 0), { officeDays: [1, 2, 3, 4, 5] })) === '12:00 29/11', 'cấu hình bỏ Chủ nhật → ngoài giờ');
ok(run('_ticketInOfficeHours_(' + vn(2026, 11, 27, 12, 0) + ')') === true && run('_ticketInOfficeHours_(' + vn(2026, 11, 27, 18, 0) + ')') === false, 'trong/ngoài giờ');
ok(reply('abc') === null && reply(0) === null, 'ngày lỗi → null');
// ── hạn xử lý ticket: lúc tạo + thời hạn theo loại (giờ thực)
const t0 = vn(2026, 11, 27, 10, 0), due = (t, c) => run('_ticketDueMs_(' + t0 + ',"' + t + '",' + J(c || null) + ')');
ok(hm(due('khieu_nai')) === '10:00 28/11' && hm(due('ho_tro')) === '10:00 28/11', 'khiếu nại/hỗ trợ 24 giờ');
ok(hm(due('doi_tra')) === '10:00 30/11' && hm(due('danh_bong')) === '10:00 30/11', 'đổi trả/đánh bóng 72 giờ');
ok(hm(due('bao_hanh')) === '10:00 4/12' && hm(due('kiem_dinh')) === '10:00 4/12', 'bảo hành/kiểm định 7 ngày');
ok(due('khong_co') === null && run('_ticketDueMs_(0,"khieu_nai")') === null, 'loại lạ / ngày lỗi → null');
ok(hm(due('khieu_nai', { dueHours: { khieu_nai: 12 } })) === '22:00 27/11', 'cấu hình đổi hạn một loại, loại khác giữ mặc định');
// ── trạng thái so với hạn + báo trưởng phòng khi trễ
const dueMs = vn(2026, 11, 27, 17, 20), st = (now, done) => run('_ticketStatus_(' + dueMs + ',' + now + ',' + (done || 0) + ')');
let r = st(vn(2026, 11, 27, 17, 0)); ok(r.state === 'open' && r.remainingMinutes === 20 && !r.needEscalate, 'còn 20 phút: ' + J(r));
r = st(vn(2026, 11, 27, 17, 50)); ok(r.state === 'overdue' && r.overdueMinutes === 30 && r.needEscalate, 'trễ 30 phút → cần báo trưởng phòng: ' + J(r));
r = st(vn(2026, 11, 27, 19, 0), vn(2026, 11, 27, 17, 10)); ok(r.state === 'done_ontime' && !r.needEscalate, 'xong đúng hạn');
r = st(vn(2026, 11, 27, 19, 0), vn(2026, 11, 27, 18, 0)); ok(r.state === 'done_late' && r.overdueMinutes === 40 && !r.needEscalate, 'xong nhưng trễ 40 phút (ghi nhận, không báo nữa)');
ok(run('_ticketStatus_(null, 1, 0)').state === 'unknown', 'không có hạn → unknown');
// ── cấu hình sai không làm hỏng; người được giao chưa chốt → []
const c = run('_ticketCfgNormalize_("{xấu")'); ok(c.inHoursMinutes === 30 && c.offHoursMinutes === 120 && c.officeStart === '08:00' && c.officeEnd === '17:00' && c.officeDays.length === 7, 'JSON hỏng → mặc định');
const c2 = run('_ticketCfgNormalize_({officeStart:"18:00",officeEnd:"09:00",inHoursMinutes:-5,dueHours:{khieu_nai:0}})'); ok(c2.officeStart === '08:00' && c2.officeEnd === '17:00' && c2.inHoursMinutes === 30 && c2.dueHours.khieu_nai === 24, 'giá trị vô lý → mặc định');
ok(J(run('_ticketOwners_("khieu_nai")')) === '[]' && J(run('_ticketOwners_("khieu_nai",{owners:{khieu_nai:["truongphong_cskh","hoa"]}})')) === '["truongphong_cskh","hoa"]', 'người được giao: mặc định rỗng, cấu hình được');
console.log('ALL TICKET SLA TESTS PASSED');

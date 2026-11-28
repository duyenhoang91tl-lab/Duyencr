#!/usr/bin/env node
// Test KPI TỰ CAM KẾT (gas/34d_KpiCommit.gs, mục 8 bước 8b-1): sale tự cam kết theo tháng, quản lý duyệt (cấu hình được), nhật ký cũ→mới,
// ưu tiên cam kết đã duyệt hơn commit riêng cố định. Chạy: node tools/test-kpi-commit.js -> "ALL KPI COMMIT TESTS PASSED".
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const ctx = { console, Math, Number, isFinite, JSON, String, Object, Array };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'gas', '34d_KpiCommit.gs'), 'utf8'), ctx, { filename: '34d_KpiCommit.gs' });
const J = x => JSON.stringify(x), run = s => vm.runInContext(s, ctx);
const TODAY = '2026-11-28', NOW = 1000;
const sub = (rec, a, cfg) => run('_kpiCommitSubmit_(' + J(rec) + ',' + J(Object.assign({ period: '2026-11', sale: 'Hoa Nguyễn', amount: 300000000, by: 'Hoa Nguyễn', role: 'sale', nowMs: NOW, todayYmd: TODAY }, a)) + ',' + J(cfg || null) + ')');
const dec = (rec, a, cfg) => run('_kpiCommitDecide_(' + J(rec) + ',' + J(Object.assign({ decision: 'approve', by: 'Duyên', role: 'admin', nowMs: 2000 }, a)) + ',' + J(cfg || null) + ')');
// ── gửi cam kết: mặc định cần duyệt
let r = sub(null, {}); ok(r.ok && r.rec.status === 'pending' && r.rec.amount === 300000000 && r.rec.approvedAmount === null, 'gửi → pending, chưa có giá trị hiệu lực: ' + J(r));
ok(r.rec.key === '2026-11|hoa nguyen' && r.rec.history.length === 1 && r.rec.history[0].action === 'submit' && r.rec.history[0].old.amount === 0 && r.rec.history[0].new.amount === 300000000 && r.rec.history[0].by === 'Hoa Nguyễn', 'nhật ký: ai, hành động, cũ → mới');
const pending = r.rec;
// ── kiểm tra đầu vào
['abc', 0, -5].forEach(v => ok(sub(null, { amount: v }).error, 'số tiền sai: ' + v));
ok(sub(null, { amount: 99e12 }).error, 'vượt giới hạn');
ok(sub(null, { period: '2026-13' }).error && sub(null, { period: 'xxxx' }).error, 'kỳ sai');
ok(sub(null, { by: '' }).error, 'thiếu người gửi');
// ── quyền gửi
ok(sub(null, { by: 'Lan', role: 'sale' }).code === 'FORBIDDEN', 'sale không gửi hộ người khác');
ok(sub(null, { period: '2026-09' }).code === 'PERIOD' && sub(null, { period: '2027-01' }).code === 'PERIOD', 'sale chỉ gửi tháng này hoặc tháng sau');
ok(sub(null, { period: '2026-12' }).ok && sub(null, { period: '2026-11' }).ok, 'tháng này / tháng sau được');
ok(sub(null, { period: '2027-01', todayYmd: '2026-12-20' }).ok, 'qua năm: tháng 12 gửi cho tháng 1');
// ── quản lý nhập hộ → có hiệu lực ngay (action set); sửa tháng cũ chỉ quản lý
r = sub(null, { by: 'Duyên', role: 'admin', amount: 400000000 }); ok(r.ok && r.rec.status === 'approved' && r.rec.approvedAmount === 400000000 && r.rec.history[0].action === 'set', 'admin nhập hộ → approved ngay: ' + J(r));
ok(sub(null, { by: 'Trưởng nhóm', role: 'leader', period: '2026-09' }).ok, 'leader sửa tháng cũ cho sale');
// ── không đổi thì báo, đổi thì ghi cũ → mới
ok(sub(pending, {}).code === 'NOCHANGE', 'gửi lại đúng số cũ (đang pending) → không đổi');
r = sub(pending, { amount: 350000000 }); ok(r.ok && r.rec.amount === 350000000 && r.rec.history.length === 2 && r.rec.history[1].old.amount === 300000000 && r.rec.history[1].new.amount === 350000000, 'sửa lúc chờ: ghi cũ 300tr → mới 350tr: ' + J(r.rec.history));
// ── duyệt
r = dec(pending, {}); ok(r.ok && r.rec.status === 'approved' && r.rec.approvedAmount === 300000000 && r.rec.decidedBy === 'Duyên' && r.rec.history[1].action === 'approve', 'duyệt → approvedAmount = số đã gửi');
const approved = r.rec;
ok(dec(pending, { role: 'sale' }).code === 'FORBIDDEN', 'sale không được duyệt');
ok(dec(pending, { by: 'Hoa Nguyễn', role: 'leader' }).code === 'SELF', 'không tự duyệt cam kết của chính mình (dù là leader)');
ok(dec(pending, { by: 'Hoa Nguyễn', role: 'leader' }, { allowSelfApprove: true }).ok, 'cấu hình cho phép tự duyệt → được');
ok(dec(approved, {}).code === 'NOTPENDING' && dec(null, {}).code === 'NOTPENDING', 'chỉ duyệt được bản đang chờ');
ok(dec(pending, { decision: 'maybe' }).error, 'quyết định lạ');
// ── sale sửa SAU khi đã duyệt: bản cũ đã duyệt VẪN hiệu lực tới khi duyệt bản mới
r = sub(approved, { amount: 500000000 }); ok(r.ok && r.rec.status === 'pending' && r.rec.amount === 500000000 && r.rec.approvedAmount === 300000000, 'sửa sau duyệt → pending, giá trị đã duyệt giữ nguyên 300tr');
const re = r.rec; ok(run('_kpiCommitEffective_(' + J(re) + ',0)').commit === 300000000 && run('_kpiCommitEffective_(' + J(re) + ',0)').pendingAmount === 500000000, 'hiệu lực vẫn 300tr, báo có 500tr chờ duyệt');
r = dec(re, { decision: 'reject', note: 'Cao quá' }); ok(r.ok && r.rec.status === 'rejected' && r.rec.approvedAmount === 300000000 && r.rec.history.slice(-1)[0].note === 'Cao quá', 'từ chối: giữ bản đã duyệt cũ, ghi lý do');
ok(run('_kpiCommitEffective_(' + J(r.rec) + ',0)').commit === 300000000, 'sau từ chối vẫn 300tr');
// ── tắt duyệt: hiệu lực ngay
r = sub(null, {}, { requireApproval: false }); ok(r.ok && r.rec.status === 'approved' && r.rec.approvedAmount === 300000000, 'tắt duyệt → hiệu lực ngay');
// ── hiệu lực: cam kết đã duyệt vs commit riêng cố định
const E = (rec, ov, cfg) => run('_kpiCommitEffective_(' + J(rec) + ',' + J(ov) + ',' + J(cfg || null) + ')');
ok(J(E(null, 0)) === J({ commit: null, source: null, pendingAmount: 0 }), 'không có gì → null');
ok(E(null, 200000000).source === 'override' && E(null, 200000000).commit === 200000000, 'chỉ có commit riêng → dùng commit riêng');
ok(E(approved, 200000000).source === 'commitment' && E(approved, 200000000).commit === 300000000, 'có cả hai → cam kết đã duyệt thắng (mặc định)');
ok(E(approved, 200000000, { commitPriority: 'override' }).source === 'override', 'cấu hình ưu tiên commit riêng');
ok(E(pending, 200000000).source === 'override', 'cam kết CHƯA duyệt không có hiệu lực → vẫn dùng commit riêng');
ok(E(pending, 0).commit === null && E(pending, 0).pendingAmount === 300000000, 'chỉ có bản chờ duyệt → chưa có commit hiệu lực');
// ── cấu hình sai
const c = run('_kpiCommitCfgNormalize_("{xấu")'); ok(c.requireApproval === true && c.allowSelfApprove === false && c.approverRoles.join() === 'admin,leader' && c.commitPriority === 'commitment', 'JSON hỏng → mặc định');
ok(run('_kpiCommitCfgNormalize_({approverRoles:[" Admin ","TRUONGPHONG"]})').approverRoles.join() === 'admin,truongphong', 'vai trò được chuẩn hoá');
ok(sub(null, { by: 'Phòng', role: 'truongphong', amount: 1 }, { approverRoles: ['truongphong'] }).ok, 'vai trò duyệt cấu hình được');
// ── không làm hỏng bản ghi gốc (hàm thuần)
const frozen = J(pending); sub(pending, { amount: 1 }); dec(pending, {}); ok(J(pending) === frozen, 'không sửa đối tượng truyền vào');
console.log('ALL KPI COMMIT TESTS PASSED');

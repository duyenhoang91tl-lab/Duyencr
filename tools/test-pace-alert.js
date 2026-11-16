#!/usr/bin/env node
// R4c (Duyên chốt 16/11) — cảnh báo tiến độ doanh số tháng (500tr chính thức / 100tr thử việc, 4 mức) + tỷ lệ chốt thấp hơn TB team.
// Chạy: node tools/test-pace-alert.js
const path = require('path');
const P = require(path.join(__dirname, '..', 'js/81-pace-alert.js'));
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
const plain = h => h.replace(/<[^>]+>/g, '');

// ── 1) tỷ lệ tháng đã qua ──
let f = P.paceFraction_('2026-11-01', '2026-11-10', '2026-11-10');
t(f && f.days === 10 && near(f.frac, 10 / 30), 'tháng 11 (30 ngày), 10 ngày đầu → 10/30');
f = P.paceFraction_('2026-10-01', '2026-10-10', '2026-11-16');
t(f && f.days === 10 && near(f.frac, 10 / 31), 'tháng 10 (31 ngày), 10 ngày đầu → 10/31');
f = P.paceFraction_('2026-11-01', '2026-11-30', '2026-11-10');
t(f && f.days === 10 && near(f.frac, 10 / 30), 'kỳ cả tháng nhưng hôm nay mới 10/11 → cắt ở hôm nay (10 ngày)');
f = P.paceFraction_('2026-10-31', '2026-11-02', '2026-11-16');
t(f && f.days === 3 && near(f.frac, 1 / 31 + 2 / 30), 'kỳ vắt qua 2 tháng → cộng từng ngày theo số ngày của tháng đó');
t(near(P.paceFraction_('2026-11-01', '2026-11-30', '2026-12-31').frac, 1), 'cả tháng đã qua → đúng 1,0 (không lệch do làm tròn)');
t(P.paceFraction_('2026-12-01', '2026-12-31', '2026-11-16') === null, 'kỳ còn ở tương lai → null');
t(P.paceFraction_('abc', '2026-11-10', '2026-11-10') === null && P.paceFraction_('2026-11-10', '2026-11-01', '2026-11-10') === null, 'ngày sai / from > to → null');

// ── 2) % tiến độ + mức (ví dụ Duyên) ──
const exp500 = P.PACE_TARGET_OFFICIAL * 10 / 30;
t(near(exp500, 166666666.67, 0.01), 'ví dụ Duyên: 500tr, 10/30 ngày → cần 166,7tr');
t(P.pacePct_(150e6, 500e6, 10 / 30) === 90 && P.paceLevel_(90) === 1, 'ví dụ Duyên: chạy 150tr = 90% → MỨC 1 (85–<100) → cảnh báo');
[[100, 0], [99.9, 1], [85, 1], [84.9, 2], [65, 2], [64.9, 3], [50, 3], [49.9, 4], [0, 4], [250, 0]].forEach(([p, lv]) => t(P.paceLevel_(p) === lv, 'mốc ' + p + '% → mức ' + lv));
t(P.paceLevel_(null) === 0 && P.paceLevel_(undefined) === 0 && P.paceLevel_('x') === 0, 'pct null/lạ → mức 0 (không báo)');
t(P.pacePct_(1, 0, 1) === null && P.pacePct_(1, 500e6, 0) === null, 'mục tiêu/tiến độ bằng 0 → null (không chia 0)');
const b = P.pacePct_(212.4e6, 500e6, 0.5);   // 212,4 / 250 = 84,96% → hiển thị 85 → phải là mức 1 (không phải mức 2)
t(b === 85 && P.paceLevel_(b) === 1, 'làm tròn 1 chữ số trước khi xếp mức: 84,96% hiện 85 thì thuộc mức 1, khớp số hiển thị');

// ── 3) paceAlertItems_ ──
const R = { from: '2026-11-01', to: '2026-11-30' }, TD = '2026-11-10';
const mk = (name, revenue, extra) => Object.assign({ name, revenue, orders: 1, tongTT: 0, tyLeChot: null }, extra || {});
const prob = n => /^TV/.test(n);
let it = P.paceAlertItems_([mk('A', 150e6)], R, { today: TD });
t(it.length === 1 && it[0].n === 1 && /85% – dưới 100%/.test(it[0].text) && /A 90% \(150tr\/166,7tr\)/.test(plain(it[0].text)), 'A 150tr/500tr (10/30 ngày) → 1 mục mức 1 "A 90% (150tr/166,7tr)"');
t(it[0].tone === '' && it[0].go === '' && it[0].act === '', 'mức 1: tone trung tính, không có nút');
it = P.paceAlertItems_([mk('A', 170e6)], R, { today: TD }); t(it.length === 0, 'A 170tr ≥ 166,7tr → KHÔNG cảnh báo');
// thử việc 100tr: cần 33,3tr
it = P.paceAlertItems_([mk('TVx', 20e6)], R, { today: TD, isProbation: prob });
t(it.length === 1 && /50% – dưới 65%/.test(it[0].text) && it[0].tone === 'bad' && /TVx 60% \(20tr\/33,3tr\)/.test(plain(it[0].text)), 'thử việc: 20tr / (100tr×10/30=33,3tr) = 60% → mức 3, tone bad');
it = P.paceAlertItems_([mk('TVx', 20e6)], R, { today: TD }); t(/dưới 50%/.test(it[0].text), 'cùng 20tr nhưng KHÔNG phải thử việc → so với 500tr → mức 4');
t(P.paceAlertItems_([mk('TVx', 40e6)], R, { today: TD, isProbation: prob }).length === 0, 'thử việc 40tr ≥ 33,3tr → không báo');
t(P.paceAlertItems_([mk('TVx', 20e6)], R, { today: TD, isProbation() { throw new Error('x'); } })[0].n === 1, 'isProbation ném lỗi → coi là chính thức, không văng');
// 4 mức cùng lúc, sắp từ nặng → nhẹ, trong mức sắp thấp nhất trước, tối đa 3 tên
const many = [mk('M1', 10e6), mk('M1b', 20e6), mk('M1c', 30e6), mk('M1d', 40e6), mk('L3', 100e6), mk('L2', 130e6), mk('L1', 160e6), mk('OK', 200e6)];
it = P.paceAlertItems_(many, R, { today: TD });
t(it.length === 4 && /dưới 50%/.test(it[0].text) && /50% – dưới 65%/.test(it[1].text) && /65% – dưới 85%/.test(it[2].text) && /85% – dưới 100%/.test(it[3].text), '4 mức hiện đủ, nặng nhất đứng đầu');
t(it[0].n === 4 && /M1 6% /.test(plain(it[0].text)) && /…$/.test(plain(it[0].text)) && (plain(it[0].text).match(/\d+% \(/g) || []).length === 3, 'mức 4: n=4, chỉ liệt kê 3 tên thấp nhất + "…"');
t(it[0].tone === 'bad' && it[1].tone === 'bad' && it[2].tone === '' && it[3].tone === '', 'tone: mức 3–4 = bad, mức 1–2 = trung tính');
t(!it.some(x => /OK/.test(x.text)), 'sale đạt tiến độ không bị nêu');
// chưa đủ ngày / kỳ lạ
t(P.paceAlertItems_([mk('A', 0, { tongTT: 5 })], R, { today: '2026-11-02' }).length === 0, 'mới 2 ngày (< PACE_MIN_DAYS=3) → chưa báo tiến độ');
t(P.paceAlertItems_([mk('A', 0, { tongTT: 5 })], R, { today: '2026-11-03' }).length === 1, 'đủ 3 ngày → bắt đầu báo');
t(P.paceAlertItems_([mk('A', 1)], { from: '2026-12-01', to: '2026-12-31' }, { today: TD }).length === 0, 'kỳ tương lai → không báo');
t(P.paceAlertItems_([mk('A', 1)], null, { today: TD }).length === 0 && P.paceAlertItems_(null, R, {}).length === 0 && P.paceAlertItems_([], R, {}).length === 0, 'range/people null hoặc rỗng → [] không lỗi');
// sale không hoạt động bị bỏ qua
t(P.paceAlertItems_([{ name: 'Z', revenue: 0, orders: 0, tongTT: 0, tyLeChot: null }], R, { today: TD }).length === 0, 'tài khoản không có đơn/doanh thu/tin nhắn → bỏ qua (không báo oan)');
t(P.paceAlertItems_([{ name: 'Z', revenue: 0, orders: 0, tongTT: 12, tyLeChot: 0 }], R, { today: TD }).length === 1, 'có tin nhắn nhưng doanh số 0 → vẫn báo (mức 4)');
// escape
it = P.paceAlertItems_([mk('<img src=x onerror=1>', 1e6)], R, { today: TD });
t(!/<img/.test(it[0].text) && /&lt;img/.test(it[0].text), 'tên sale được ESCAPE');

// ── 4) tỷ lệ chốt ──
const ppl = [mk('A', 300e6, { tongTT: 100, tyLeChot: 10 }), mk('B', 300e6, { tongTT: 100, tyLeChot: 6 }), mk('C', 300e6, { tongTT: 200, tyLeChot: 9 })];
t(near(P.paceTeamClose_(ppl), (10 * 100 + 6 * 100 + 9 * 200) / 400), 'TB team gia quyền theo số khách: (10·100+6·100+9·200)/400 = 8,5');
it = P.paceAlertItems_(ppl, R, { today: TD });
t(it.length === 1 && /8,5%/.test(it[0].text) && /B 6% \(−2,5 điểm\)/.test(plain(it[0].text)) && it[0].tone === 'bad', 'chỉ B (6% < 8,5% − 1) bị báo: "B 6% (−2,5 điểm)"');
t(!/A 10%|C 9%/.test(plain(it[0].text)), 'A (trên TB) và C (thấp hơn 0,5 < 1 điểm) KHÔNG bị báo');
const edge = [mk('A', 300e6, { tongTT: 100, tyLeChot: 10 }), mk('B', 300e6, { tongTT: 100, tyLeChot: 9 })];   // TB 9,5; B thấp hơn đúng 0,5
t(P.paceAlertItems_(edge, R, { today: TD }).length === 0, 'thấp hơn 0,5 điểm (< 1) → không báo');
const edge2 = [mk('A', 300e6, { tongTT: 100, tyLeChot: 10 }), mk('B', 300e6, { tongTT: 100, tyLeChot: 8 })];   // TB 9; B thấp hơn đúng 1
t(P.paceAlertItems_(edge2, R, { today: TD }).length === 1, 'thấp hơn đúng 1 điểm → báo (≥ ngưỡng)');
const small = [mk('A', 300e6, { tongTT: 100, tyLeChot: 10 }), mk('B', 300e6, { tongTT: 10, tyLeChot: 0 })];
t(P.paceAlertItems_(small, R, { today: TD }).length === 0, 'sale < 30 khách tương tác (mẫu nhỏ) → không xét tỷ lệ chốt');
t(P.paceAlertItems_([mk('A', 300e6, { tongTT: 100, tyLeChot: null })], R, { today: TD }).length === 0 && P.paceTeamClose_([mk('A', 1)]) === null, 'tyLeChot null / không ai có số → không báo, TB = null');
// tỷ lệ chốt vẫn báo khi chưa đủ ngày tiến độ
it = P.paceAlertItems_([mk('A', 0, { tongTT: 100, tyLeChot: 10 }), mk('B', 0, { tongTT: 100, tyLeChot: 5 })], R, { today: '2026-11-02' });
t(it.length === 1 && /Tỷ lệ chốt/.test(it[0].text), 'mới 2 ngày: bỏ báo tiến độ nhưng vẫn báo tỷ lệ chốt');

console.log(fail ? '\n' + fail + ' LỖI' : '\nĐẠT HẾT'); process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// Test R8a — chấm điểm khách nóng/ấm/nguội (js/77-lead-score.js). Chạy: node tools/test-lead-score.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const m = require('../js/77-lead-score.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const NOW = new Date(2026, 10, 15, 14, 30).getTime();               // 15/11/2026 14:30 (giờ máy)
const ago = (d) => new Date(2026, 10, 15 - d, 9, 0).getTime();       // d ngày trước, giờ khác → kiểm tra tính theo ngày lịch
const C = (o) => Object.assign({ phone: '0901', _lastActionDate: null, lastPosDate: null, totalOrders: 0, totalRevenue: 0, tier: 'Chưa bán lại được' }, o);

ok(m.lsDaysBetween_(ago(10), NOW) === 10 && m.lsDaysBetween_(ago(0), NOW) === 0, 'số ngày tính theo NGÀY LỊCH (bỏ giờ)');
ok(m.lsDaysBetween_(null, NOW) === null && m.lsDaysBetween_(NOW, 0) === null, 'thiếu mốc → null');

// lịch
const sch = [{ phone: '0901', date: '2026-11-14', done: false }, { phone: '0901', date: '2026-11-15', done: false }, { phone: '0901', date: '2026-11-22', done: false }, { phone: '0901', date: '2026-11-23', done: false }, { phone: '0901', date: '2026-11-20', done: true }, { phone: '0999', date: '2026-11-16', done: false }];
const u = m.lsUpcoming_(sch, '0901', '2026-11-15');
ok(u.over === 1 && u.soon === 2, 'lịch: 1 quá hạn; hôm nay + đúng +7 ngày = 2 sắp tới; +8 ngày, đã xong, của người khác → không tính');

// mức
let s = m.lsScore_(C({ _lastActionDate: ago(3), lastPosDate: ago(10), totalOrders: 3, tier: 'Tiềm năng' }), [], NOW);
ok(s.score === 7 && s.level === 'hot' && s.label === 'Nóng', 'mới chăm 3 + mới mua 10 + 3 đơn → 3+3+1 = 7 NÓNG');
s = m.lsScore_(C({ _lastActionDate: ago(20), lastPosDate: ago(60) }), [], NOW);
ok(s.score === 4 && s.level === 'warm', 'chăm 20 ngày (+2) + mua 60 ngày (+2) = 4 ẤM');
s = m.lsScore_(C({ _lastActionDate: ago(60), lastPosDate: ago(200) }), [], NOW);
ok(s.level === 'cold' && s.days === 60 && s.score === 1, 'đúng 60 ngày chưa chăm chưa bị ÉP nguội (mốc là >60), điểm thấp nên vẫn nguội');
s = m.lsScore_(C({ _lastActionDate: ago(61), lastPosDate: ago(5), totalOrders: 5, tier: 'Thân thiết' }), [], NOW);
ok(s.level === 'cold' && s.score === 5, 'ÉP NGUỘI: 61 ngày chưa chăm (0đ) + mới mua (+3) + hạng (+1) + ≥2 đơn (+1) = 5 — vẫn nguội dù điểm ở mức ẤM');
s = m.lsScore_(C({ _lastActionDate: ago(61), lastPosDate: ago(5), totalOrders: 5, tier: 'Thân thiết' }), [{ phone: '0901', date: '2026-11-17', done: false }], NOW);
ok(s.level !== 'cold' && s.soon === 1, 'có lịch hẹn sắp tới → KHÔNG ép nguội');
s = m.lsScore_(C({ lastPosDate: ago(5), totalOrders: 1 }), [], NOW);
ok(s.days === 5 && s.level === 'warm' && s.reasons[0] === 'chưa từng được chăm sóc', 'chưa chăm lần nào nhưng mới mua 5 ngày → ẤM, không nguội; có lý do');
s = m.lsScore_(C({ lastPosDate: ago(100), totalOrders: 1 }), [], NOW);
ok(s.level === 'cold' && s.days === 100, 'chưa chăm + lần mua cuối >60 ngày → nguội');
s = m.lsScore_(C(), [], NOW);
ok(s.level === 'cold' && s.days === null && s.score === 0, 'khách trống dữ liệu → nguội, không lỗi');
s = m.lsScore_(null, null, NOW); ok(s.level === 'cold', 'null → không văng lỗi');
s = m.lsScore_(C({ _lastActionDate: ago(2) }), [{ phone: '0901', date: '2026-11-10', done: false }], NOW);
ok(s.over === 1 && s.reasons.some(r => /QUÁ HẠN/.test(r)), 'lịch quá hạn hiện trong lý do');

// sắp mất
s = m.lsScore_(C({ _lastActionDate: ago(90), lastPosDate: ago(120), totalOrders: 2, tier: 'Tiềm năng' }), [], NOW);
ok(s.risk === true, 'nguội + từng mua + Tiềm năng → sắp mất');
s = m.lsScore_(C({ _lastActionDate: ago(90), lastPosDate: ago(120), totalOrders: 1, tier: 'Chưa bán lại được' }), [], NOW);
ok(s.risk === false, 'nguội nhưng chỉ 1 đơn (Chưa bán lại được) → chưa tính sắp mất');
s = m.lsScore_(C({ _lastActionDate: ago(5), lastPosDate: ago(120), totalOrders: 2, tier: 'Tiềm năng' }), [], NOW);
ok(s.risk === false, 'mới chăm → không sắp mất');

// xếp hạng
const list = [
  C({ phone: 'A', _lastActionDate: ago(90), lastPosDate: ago(100), totalOrders: 6, tier: 'Thân thiết', totalRevenue: 50e6 }),
  C({ phone: 'B', _lastActionDate: ago(1), lastPosDate: ago(2), totalOrders: 3, tier: 'Tiềm năng', totalRevenue: 5e6 }),
  C({ phone: 'C', _lastActionDate: ago(1), lastPosDate: ago(2), totalOrders: 3, tier: 'Tiềm năng', totalRevenue: 9e6 }),
  C({ phone: 'D', _lastActionDate: ago(70), lastPosDate: ago(80), totalOrders: 2, tier: 'Tiềm năng', totalRevenue: 20e6 }),
  C({ phone: 'E', _lastActionDate: ago(40), lastPosDate: ago(50), totalOrders: 1, totalRevenue: 1e6 }),
];
const r = m.lsRank_(list, [], NOW);
ok(r.map(x => x.c.phone).join('') === 'CBEAD' || r.map(x => x.c.phone).join('') === 'CBEDA', 'xếp: nóng (cùng điểm → doanh thu cao C trước B) → ấm E → nguội (doanh thu cao trước)');
ok(r.map(x => x.c.phone).join('') === 'CBEAD', 'nguội: A (50tr) trước D (20tr)');
ok(m.lsRank_(list, [], NOW, 2).length === 2 && m.lsRank_(list, [], NOW, 0, c => c.phone !== 'C').length === 4, 'limit + filter hoạt động');
const risk = m.lsAtRisk_(list, [], NOW);
ok(risk.n === 2 && risk.items.map(x => x.c.phone).join('') === 'AD', 'sắp mất: A, D; xếp doanh thu cao trước; n đếm đủ');
ok(m.lsAtRisk_(list, [], NOW, 1).items.length === 1 && m.lsAtRisk_(list, [], NOW, 1).n === 2, 'limit cắt danh sách nhưng n vẫn là tổng');
ok(m.lsAtRisk_(null, null, NOW).n === 0, 'không có khách → 0, không lỗi');

// hiệu năng 136k khách
const big = []; for (let i = 0; i < 136000; i++) big.push(C({ phone: 'p' + i, _lastActionDate: ago(i % 200), lastPosDate: ago((i * 7) % 400), totalOrders: i % 6, tier: i % 3 ? 'Tiềm năng' : 'Chưa bán lại được', totalRevenue: i }));
const t0 = Date.now(); const rk = m.lsAtRisk_(big, [], NOW, 50); const ms = Date.now() - t0;
ok(rk.n > 0 && rk.items.length === 50 && ms < 3000, '136.000 khách quét lần sắp mất trong ' + ms + 'ms (<3s)');

// ── R8b: byPhone + cảnh báo Tổng quan + bộ lọc danh sách ──
const byP = { A: [{ phone: 'A', date: '2026-11-16', done: false }] };
ok(m.lsAtRisk_(list, null, NOW, 0, null, byP).items.map(x => x.c.phone).join('') === 'D', 'byPhone: A có lịch hẹn ngày mai → không còn sắp mất (chỉ D)');
ok(m.lsRank_(list, null, NOW, 0, null, byP).find(x => x.c.phone === 'A').s.level !== 'cold', 'byPhone: lsRank_ cũng dùng lịch theo SĐT');
const h = require('vm'), fs = require('fs');
const src36 = fs.readFileSync(__dirname + '/../js/36-pro-home.js', 'utf8');
const sb = {}; h.createContext(sb); h.runInContext('function proEsc_(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}', sb);
const pick = (n) => { const i = src36.indexOf('function ' + n + '('); let d = 0, j = src36.indexOf('{', i); for (let k = j; k < src36.length; k++) { if (src36[k] === '{') d++; else if (src36[k] === '}') { d--; if (!d) return src36.slice(i, k + 1); } } };
h.runInContext(pick('proRiskAlert_') + '\n' + pick('proRecoItems_') + '\nvar PRO_UNREPLIED_CAP=100;', sb);
const al = sb.proRiskAlert_({ n: 5, items: [{ c: { name: 'Lan <b>' } }, { c: { name: 'Mai' } }, { c: { name: 'Hà' } }] }, 60);
ok(al && al.n === 5 && al.go === 'atrisk' && al.tone === 'bad' && /SẮP MẤT/.test(al.text) && /hơn 60 ngày/.test(al.text), 'proRiskAlert_: n, go=atrisk, đỏ, nêu 60 ngày');
ok(/Lan &lt;b&gt;, Mai, Hà…/.test(al.text), 'proRiskAlert_: tên escape, 3 tên + … khi còn nhiều hơn');
ok(!/…/.test(sb.proRiskAlert_({ n: 2, items: [{ c: { name: 'A' } }, { c: { name: 'B' } }] }).text), 'proRiskAlert_: đủ tên thì không có …');
ok(sb.proRiskAlert_({ n: 0, items: [] }) === null && sb.proRiskAlert_(null) === null, 'proRiskAlert_: 0/null → không hiện');
ok(sb.proRecoItems_([], '2026-11-15', [], null, [al]).some(x => x.go === 'atrisk'), 'proRecoItems_ nhận mục sắp mất qua alerts (không đổi hàm)');

// bộ lọc danh sách (chạy NGUYÊN js/77 trong sandbox có allCustomers/schedules)
const sb2 = { Date, Set, console }; h.createContext(sb2);
h.runInContext(fs.readFileSync(__dirname + '/../js/77-lead-score.js', 'utf8').replace(/if \(typeof module[\s\S]*$/, ''), sb2);
h.runInContext('var _dataVersion=1; var allCustomers=[]; var schedules=[];', sb2);
sb2.allCustomers = list; sb2.schedules = [];
h.runInContext('_lsListFilter="risk"', sb2);
const got = list.filter(c => sb2.lsFilterPass_(c)).map(c => c.phone).join('');
ok(got === 'AD', 'lsFilterPass_(risk) trong sandbox: giữ A, D (cache theo mức)');
h.runInContext('_lsListFilter=""', sb2); ok(list.every(c => sb2.lsFilterPass_(c)), 'tắt lọc → mọi khách đều qua');
h.runInContext('_lsListFilter="hot"', sb2); ok(list.filter(c => sb2.lsFilterPass_(c)).map(c => c.phone).join('') === 'BC', 'lọc "nóng" → B, C');
const src02 = fs.readFileSync(__dirname + '/../js/02-fn-showrowerrorbanner.js', 'utf8'), src08 = fs.readFileSync(__dirname + '/../js/08-fn-invalidatefiltercache.js', 'utf8');
ok(/_lsListFilter[\s\S]{0,120}lsFilterPass_\(c\)\) return false/.test(src02), 'applyFilters (js/02) có dòng lọc R8b');
ok(/_lsListFilter/.test(src08.slice(src08.indexOf('function _filterSignature'), src08.indexOf('function _filterSignature') + 1800)), 'chữ ký cache lọc (js/08) có _lsListFilter — nếu thiếu, đổi mức lọc sẽ trả danh sách cũ');

console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);

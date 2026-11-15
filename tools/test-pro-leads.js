#!/usr/bin/env node
// Test R8d — trợ lý: trả lời kèm bảng/biểu đồ + chế độ "Khách cần chăm" (js/38 + js/77 + js/33, chạy trong vm không DOM). Chạy: node tools/test-pro-leads.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), vm = require('vm'), m = require('../js/77-lead-score.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const ctx = { console, AbortController, setTimeout, clearTimeout, careData: {}, _posStatsOn: false, donStatsByPhone: {}, schedules: [], SCHED_TYPES: [] };
vm.createContext(ctx);
vm.runInContext(['33-pro-profile', '77-lead-score', '38-pro-dock'].map(f => fs.readFileSync(__dirname + '/../js/' + f + '.js', 'utf8').replace(/if \(typeof module\s*!==?\s*'undefined'[^\n]*\n?/g, '')).join('\n'), ctx);
const X = ctx;
const NOW = new Date(2026, 10, 15, 14, 30).getTime(), ago = (d) => new Date(2026, 10, 15 - d, 9, 0).getTime();
const C = (o) => Object.assign({ phone: '0901', name: 'K', _lastActionDate: null, lastPosDate: null, totalOrders: 0, totalRevenue: 0, tier: 'Chưa bán lại được' }, o);

// proRichHtml_
ok(X.proRichHtml_(null) === '' && X.proRichHtml_({}) === '', 'rich rỗng → không vẽ gì');
let h = X.proRichHtml_({ bars: { items: [{ label: 'A', value: 10, text: '10' }, { label: 'B', value: 5, text: '5' }, { label: 'C', value: 0, text: '0' }] } });
ok(/width:100%/.test(h) && /width:50%/.test(h) && /width:2%/.test(h), 'biểu đồ: thanh dài nhất 100%, nửa = 50%, 0 vẫn thấy được (2%)');
h = X.proRichHtml_({ table: { head: ['Khách', 'X'], rows: [{ phone: '09"><x', cells: ['<img src=x>', 5] }, { cells: ['Không phone', 'a&b'] }] } });
ok(!/<img/.test(h) && /&lt;img src=x&gt;/.test(h) && /a&amp;b/.test(h), 'bảng: escape chữ trong ô');
ok(/data-pro-cust="09&quot;&gt;&lt;x"/.test(h) && (h.match(/pro-rich-link/g) || []).length === 1, 'bảng: phone escape trong thuộc tính; chỉ dòng có phone mới có nút bấm tên');
ok(X.proRichHtml_({ table: { head: ['a'], rows: [] } }) === '', 'bảng không có dòng → bỏ');

// proRichSalesB_ — chữ trả lời cũ KHÔNG đổi, chỉ thêm phần trực quan
const B = { from: '2026-11-01', to: '2026-11-15', rev: 30e6, orders: 6, aov: 5e6, cod: 0, storeTotal: 0, storeOrders: 0, rows: [{ name: 'An', giaTri: 20e6, orders: 4 }, { name: 'Bình', giaTri: 10e6, orders: 2 }] };
let r = X.proRichSalesB_('top', B);
ok(r.bars.items.length === 2 && r.table.rows.length === 2 && r.table.rows[0].cells[0] === 'An' && r.table.rows[0].cells[3] === '5.000.000đ', 'sales top: có biểu đồ + bảng (Sale/Doanh thu/Đơn/TB đơn)');
ok(X.proRichSalesB_('summary', B).bars.items.length === 2 && !X.proRichSalesB_('summary', B).table, 'sales summary: chỉ biểu đồ');
ok(X.proRichSalesB_('support', B) === null && X.proRichSalesB_('top', { rows: [] }) === null && X.proRichSalesB_('top', null) === null, 'intent khác / không có dòng / null → không có phần trực quan');
ok(/Báo cáo B/.test(X.proRuleSalesBAnswer_('top sale', B)), 'chữ trả lời Báo cáo B (hàm cũ) không đổi');

// proLeadsIntent_
const I = X.proLeadsIntent_;
ok(I('Ai sắp mất?') === 'risk' && I('khách bị bỏ quên') === 'risk' && I('cứu khách nào') === 'risk', 'ý định: sắp mất / bỏ quên / cứu → risk');
ok(I('Nên gọi ai trước?') === 'hot' && I('khách nóng') === 'hot' && I('ưu tiên hôm nay') === 'hot', 'ý định: gọi trước / nóng / ưu tiên → hot');
ok(I('Tóm tắt khách nóng/ấm/nguội') === 'summary' && I('Ai sắp mất?') === 'risk' && I('Nên gọi ai trước?') === 'hot', 'cả 3 câu gợi ý của chế độ ra đúng ý định (Tóm tắt → summary, không bị "nóng" kéo sang danh sách nóng)');
ok(I('thống kê tình hình') === 'summary' && I('abc xyz') === '', 'ý định: thống kê → summary; câu lạ → rỗng');

// lsSummary_ + proLeadsAnswer_
const list = [
  C({ phone: 'A', name: 'Anh', _lastActionDate: ago(90), lastPosDate: ago(100), totalOrders: 6, tier: 'Thân thiết', totalRevenue: 50e6 }),
  C({ phone: 'B', name: 'Bích', _lastActionDate: ago(1), lastPosDate: ago(2), totalOrders: 3, tier: 'Tiềm năng', totalRevenue: 5e6 }),
  C({ phone: 'C', name: 'Chi', _lastActionDate: ago(1), lastPosDate: ago(2), totalOrders: 3, tier: 'Tiềm năng', totalRevenue: 9e6 }),
  C({ phone: 'D', name: 'Dung', _lastActionDate: ago(70), lastPosDate: ago(80), totalOrders: 2, tier: 'Tiềm năng', totalRevenue: 20e6 }),
  C({ phone: 'E', name: 'Em', _lastActionDate: ago(40), lastPosDate: ago(50), totalOrders: 1, totalRevenue: 1e6 }),
];
const by = m.lsSchedByPhone_([{ phone: 'B', date: '2026-11-10', done: false }, { phone: 'C', date: '2026-11-10', done: true }, { phone: 'E', date: '2026-11-20', done: false }]);
ok(by.B.length === 1 && !by.C && by.E.length === 1, 'lsSchedByPhone_: chỉ gom lịch CHƯA xong, theo SĐT');
const sm = m.lsSummary_(list, by, NOW, 10);
ok(sm.total === 5 && sm.hot === 2 && sm.warm === 1 && sm.cold === 2 && sm.risk === 2 && sm.over === 1, 'lsSummary_: 2 nóng · 1 ấm · 2 nguội · 2 sắp mất · 1 khách có lịch quá hạn');
ok(sm.riskTop.map(x => x.c.phone).join('') === 'AD' && sm.hotTop.map(x => x.c.phone).join('') === 'CB', 'lsSummary_: sắp mất xếp doanh thu (A trước D); nóng xếp điểm rồi doanh thu (C trước B)');
ok(m.lsSummary_(list, by, NOW, 1).riskTop.length === 1 && m.lsSummary_(null, null, NOW).total === 0, 'lsSummary_: giới hạn top; không có khách → 0');
ok(m.lsSummary_(list, by, NOW, 10).risk === m.lsSummary_(list, null, NOW, 10).risk, 'byPhone không làm đổi số sắp mất khi lịch không liên quan');

let a = X.proLeadsAnswer_('risk', sm, 60);
ok(/2 khách SẮP MẤT/.test(a.text) && a.rich.table.rows.length === 2 && a.rich.table.rows[0].phone === 'A' && a.rich.table.rows[0].cells[0] === 'Anh' && a.rich.table.rows[0].cells[2] === '90 ngày' && a.rich.table.rows[0].cells[3] === '50.000.000đ', 'trả lời "sắp mất": đếm đúng + bảng có Khách/Hạng/Chưa chăm/Doanh thu, dòng đầu là A');
a = X.proLeadsAnswer_('hot', sm, 60);
ok(/2 khách đang NÓNG/.test(a.text) && /QUÁ HẠN/.test(a.text) && a.rich.table.rows[0].phone === 'C' && a.rich.table.rows[0].cells[2].length > 3, 'trả lời "nóng": có cảnh báo lịch quá hạn + gợi ý việc tiếp theo từng khách');
a = X.proLeadsAnswer_('summary', sm, 60);
ok(/5 khách/.test(a.text) && /nóng 2 \(40%\)/.test(a.text) && /SẮP MẤT 2/.test(a.text) && a.rich.bars.items.length === 4 && a.rich.bars.items[0].value === 2, 'trả lời "tóm tắt": số liệu + biểu đồ 4 thanh');
ok(/Chưa có khách/.test(X.proLeadsAnswer_('summary', { total: 0 }, 60).text) && /Chưa có khách/.test(X.proLeadsAnswer_('risk', null, 60).text), 'không có khách → báo rõ, không lỗi');
ok(/Không có khách nào sắp mất/.test(X.proLeadsAnswer_('risk', { total: 3, risk: 0, hot: 0, warm: 3, cold: 0, over: 0, riskTop: [], hotTop: [] }, 60).text), 'không ai sắp mất → nói rõ');

// nối vào dock (kiểm mã nguồn vì không có DOM)
const src = fs.readFileSync(__dirname + '/../js/38-pro-dock.js', 'utf8');
ok(/data-mode="leads"/.test(src) && /PRO_AI_SUGGEST|leads:\s*\[/.test(src) && /m==='leads'/.test(src), 'dock: có nút chế độ Khách cần chăm + gợi ý + placeholder');
ok(/proRichHtml_\(m\.rich\)/.test(src) && /data-pro-cust\]/.test(src) && /function proOpenCustomer_/.test(src), 'dock: vẽ rich trong log + bấm tên mở hồ sơ');
ok(/_proDock\.mode==='leads'[\s\S]{0,900}provider:'Quy tắc · điểm khách \(không dùng AI\)'/.test(src), 'chế độ leads luôn tính tại chỗ (không gọi AI)');
ok(/rich:proRichSalesB_\(proSalesBIntent_\(question\), ctx\.raw\.B\)/.test(src), 'trả lời Doanh số (quy tắc) kèm rich');

console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0);

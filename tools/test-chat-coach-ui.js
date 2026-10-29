#!/usr/bin/env node
// Test giao dien the "Nhac quy trinh" (js/58-fn-chatcoach.js) o Social>Chat (sc) va tab Chat ho so khach (pkc) bang jsdom.
// Chay: NODE_PATH=<noi co jsdom> node tools/test-chat-coach-ui.js
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
let oks = 0, fails = 0; const t = (n, v) => { console.log((v ? 'OK   ' : 'FAIL ') + n); v ? oks++ : fails++; };
const dom = new JSDOM('<body><div id="pkc-coach"></div><textarea id="pkc-input"></textarea><div id="sc-coach"></div><textarea id="sc-input"></textarea></body>', { runScripts: 'outside-only', url: 'https://crm.test/' });
const w = dom.window; const $ = id => w.document.getElementById(id); const sleep = ms => new Promise(r => setTimeout(r, ms));
let reply = null; const calls = [];
w.eval('var gsUrl = "https://gs.test/exec"; function _pkcUrl(q) { return gsUrl + "?" + q; } function _pkcEsc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); } var __toast = ""; function toast(m) { __toast = m; }');
w.fetch = async (u) => { calls.push(u); const r = typeof reply === 'function' ? reply(u) : reply; return { json: async () => r }; };
w.eval(rd('58-fn-chatcoach.js'));
const RES = { ok: true, found: true, doneCount: 2, pendingCount: 1, dueCount: 2,
  steps: [{ n: 1, name: 'Đón khách', state: 'done' }, { n: 3, name: 'Tư vấn', state: 'due' }, { n: 5, name: 'Báo giá', state: 'pending' }, { n: 7, name: 'Chốt đơn', state: 'due' }, { n: 9, name: 'Theo sát', state: 'na' }],
  reminders: [{ id: 'consult_image', step: 3, title: 'Gửi ẢNH mẫu hợp mệnh', ageMin: 40, say: 'Khách đã cho năm sinh nhưng bạn chưa gửi HÌNH ẢNH mẫu.', script: 'Chị gửi em 2 tông màu hợp với mệnh của em.' },
              { id: 'wrist_size', step: 7, title: 'Hướng dẫn khách gửi SIZE TAY', ageMin: 12, say: 'Khách sắp lên đơn nhưng chưa có size tay.', script: 'Em đo giúp chị chu vi cổ tay nhé.' }] };
const msgs = n => { const o = {}; for (let i = 0; i < n; i++) o['m' + i] = { id: 'm' + i, at: '2026-10-25T0' + (i % 9) + ':00:00Z', dir: 'in' }; return o; };
(async () => {
  reply = RES; w.pkCoachSync('pkc', 'P1_U1', msgs(3)); await sleep(30);
  const html = $('pkc-coach').innerHTML;
  t('hiện thẻ với số việc cần làm ("2 việc cần làm")', /2 việc cần làm/.test(html));
  t('hiện đúng các bước đã áp dụng (4 bước; bước "Theo sát" na bị ẩn)', (html.match(/coach-st /g) || []).length === 4 && !/Theo sát/.test(html));
  t('mỗi việc có tiêu đề + lý do + câu mẫu + thời gian ("40 phút trước")', /Gửi ẢNH mẫu hợp mệnh/.test(html) && /chưa gửi HÌNH ẢNH/.test(html) && /2 tông màu/.test(html) && /40 phút trước/.test(html));
  t('gọi đúng action chatCoach với mã hội thoại', calls.length === 1 && /action=chatCoach&conv=P1_U1/.test(calls[0]));
  // chèn câu mẫu
  w.pkCoachInsert('pkc', 1); t('"Chèn câu mẫu" đưa đúng câu vào ô soạn tin (không tự gửi)', $('pkc-input').value === 'Em đo giúp chị chu vi cổ tay nhé.' && /Đã chèn/.test(w.__toast));
  w.pkCoachInsert('pkc', 0); t('chèn lần 2: thêm sau nội dung đang soạn, KHÔNG ghi đè', $('pkc-input').value === 'Em đo giúp chị chu vi cổ tay nhé.\nChị gửi em 2 tông màu hợp với mệnh của em.');
  w.pkCoachInsert('pkc', 9); t('chỉ số sai -> không làm gì, không lỗi', $('pkc-input').value.split('\n').length === 2);
  // không gọi lại khi chưa có tin mới
  await sleep(5); w.pkCoachSync('pkc', 'P1_U1', msgs(3)); await sleep(20); t('không có tin mới và chưa quá 60 giây -> KHÔNG gọi lại server', calls.length === 1);
  // có tin mới -> gọi lại (sau khoảng nghỉ tối thiểu)
  w.eval('PK_COACH_MIN_GAP_MS = 0;'); w.pkCoachSync('pkc', 'P1_U1', msgs(4)); await sleep(30); t('có tin mới -> hỏi lại server', calls.length === 2);
  // thu gọn / mở
  w.pkCoachToggle('pkc'); t('bấm tiêu đề -> thu gọn (ẩn danh sách việc, còn badge)', /collapsed/.test($('pkc-coach').innerHTML) && !/coach-item/.test($('pkc-coach').innerHTML) && /2 việc cần làm/.test($('pkc-coach').innerHTML));
  t('trạng thái thu gọn được nhớ (localStorage)', w.localStorage.getItem('ome_coach_collapsed') === '1');
  w.pkCoachToggle('pkc'); t('bấm lần nữa -> mở lại', /coach-item/.test($('pkc-coach').innerHTML));
  // Social chat có ô riêng
  w.pkCoachSync('sc', 'P1_U1', msgs(4)); await sleep(30); t('Social>Chat: thẻ hiện ở #sc-coach, chèn vào #sc-input', /2 việc cần làm/.test($('sc-coach').innerHTML) && (w.pkCoachInsert('sc', 0), $('sc-input').value === 'Chị gửi em 2 tông màu hợp với mệnh của em.'));
  // đúng quy trình
  reply = { ok: true, found: true, doneCount: 3, pendingCount: 0, dueCount: 0, steps: [{ n: 1, name: 'Đón khách', state: 'done' }], reminders: [] };
  w.eval('PK_COACH_REFRESH_MS = 0;'); w.pkCoachSync('pkc', 'P1_U1', msgs(4)); await sleep(30);
  t('không còn việc quá hạn -> "✓ Đang đi đúng quy trình"', /Đang đi đúng quy trình/.test($('pkc-coach').innerHTML) && !/coach-item/.test($('pkc-coach').innerHTML));
  // không áp dụng gì -> ẩn
  reply = { ok: true, found: true, doneCount: 0, pendingCount: 0, dueCount: 0, steps: [], reminders: [] }; w.pkCoachSync('pkc', 'P1_U1', msgs(5)); await sleep(30);
  t('chưa quy tắc nào áp dụng -> ẨN thẻ (không hiện khung trống)', $('pkc-coach').innerHTML === '');
  // lỗi -> ẩn im lặng
  for (const bad of [{ ok: false, error: 'Lỗi nhắc quy trình: x' }, { ok: false, code: 'AUTH', error: 'Cần đăng nhập' }, { ok: true, found: false }, { error: 'Unknown action' }]) {
    reply = bad; w.pkCoachSync('pkc', 'P1_U1', msgs(Math.floor(Math.random() * 90) + 10)); await sleep(30);
    t('phản hồi lỗi/không có (' + (bad.error || 'found:false').slice(0, 22) + ') -> thẻ ẨN, không báo lỗi gây phiền', $('pkc-coach').innerHTML === '');
  }
  w.fetch = async () => { throw new TypeError('Failed to fetch'); }; w.pkCoachSync('pkc', 'P1_U1', msgs(120)); await sleep(30);
  t('mất mạng -> thẻ ẨN, không văng lỗi', $('pkc-coach').innerHTML === '');
  // chuyển hội thoại trong lúc chờ -> bỏ kết quả cũ
  w.fetch = async (u) => { calls.push(u); await sleep(40); return { json: async () => RES }; };
  w.pkCoachSync('pkc', 'P1_OLD', msgs(2)); await sleep(5); w.pkCoachSync('pkc', 'P1_NEW', msgs(2)); await sleep(120);
  t('chuyển sang hội thoại khác khi đang chờ -> không hiện nhầm kết quả của hội thoại cũ', _shown() === 'P1_NEW');
  function _shown() { return w.eval('_pkCoach.shown.pkc'); }
  // chống chèn HTML
  w.fetch = async () => ({ json: async () => ({ ok: true, found: true, doneCount: 0, pendingCount: 0, dueCount: 1, steps: [{ n: 3, name: '<img src=x onerror=1>', state: 'due' }],
    reminders: [{ id: 'x', step: 3, title: '<b onmouseover=1>T</b>', say: '<script>alert(1)</script>', script: '"><img src=x>', ageMin: 1 }] }) });
  w.eval('PK_COACH_REFRESH_MS = 0; PK_COACH_MIN_GAP_MS = 0;'); w.pkCoachSync('pkc', 'P1_XSS', msgs(77)); await sleep(30);
  const x = $('pkc-coach'); t('nội dung server được escape (không chèn được thẻ/script)', !x.querySelector('img') && !x.querySelector('script') && !x.querySelector('b[onmouseover]') && /&lt;script&gt;/.test(x.innerHTML));
  w.fetch = async () => ({ json: async () => RES }); w.pkCoachSync('pkc', '', {}); t('không có mã hội thoại -> thẻ rỗng', $('pkc-coach').innerHTML === '');
  w.eval('gsUrl = ""'); w.pkCoachSync('pkc', 'P1_U1', msgs(5)); t('chưa nối Google Sheets (gsUrl rỗng) -> thẻ rỗng, không gọi mạng', $('pkc-coach').innerHTML === '');
  // hook trong js/41 và js/42
  const s41 = rd('41-fn-pkchat.js'), s42 = rd('42-fn-socialchat.js');
  t('js/41 có khung #pkc-coach và gọi pkCoachSync khi vẽ', /id="pkc-coach"/.test(s41) && /pkCoachSync\('pkc', P\.active/.test(s41));
  t('js/42 có khung #sc-coach, gọi pkCoachSync khi vẽ và xoá khi chưa chọn hội thoại', /id="sc-coach"/.test(s42) && /pkCoachSync\('sc', _sc\.active/.test(s42) && /sc-coach'\); if \(ch0\)/.test(s42));
  const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  t('index.html nạp js/58 SAU js/42 và có ?v= chống cache cho 41/42/58', idx.indexOf('js/58-fn-chatcoach.js') > idx.indexOf('js/42-fn-socialchat.js') && /js\/41-fn-pkchat\.js\?v=/.test(idx) && /js\/42-fn-socialchat\.js\?v=/.test(idx) && /js\/58-fn-chatcoach\.js\?v=/.test(idx));
  console.log('\n' + oks + ' OK, ' + fails + ' FAIL'); process.exit(fails ? 1 : 0);
})();

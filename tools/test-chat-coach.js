#!/usr/bin/env node
// Test NHAC QUY TRINH CHAT (chatCoach_ trong gas_v13.js): moi quy tac lay tu sheet "Kich ban Chatpage" + 3 vi du cua Duyen
// (gui hinh anh kem ghi am, bao gia kem CTKM neu co, len don thi huong dan khach gui size tay). Chay ham THAT voi du lieu gia.
// Chay: node tools/test-chat-coach.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fails = 0, oks = 0; const ok = (c, m) => { if (c) { oks++; console.log('OK   ' + m); } else { fails++; console.log('FAIL ' + m); } };
const handler = { get: (t, p) => (p in t ? t[p] : (p === 'then' ? undefined : new Proxy(function () {}, handler))), apply: () => new Proxy(function () {}, handler) };
const svc = () => new Proxy(function () {}, handler);
const cacheStore = {};
const ctx = { SpreadsheetApp: svc(), PropertiesService: svc(), LockService: svc(), UrlFetchApp: svc(), Utilities: svc(), Session: svc(), DriveApp: svc(), DocumentApp: svc(),
  ContentService: svc(), HtmlService: svc(), MailApp: svc(), ScriptApp: svc(), Logger: { log() {} }, console,
  CacheService: { getScriptCache: () => ({ get: k => (k in cacheStore ? cacheStore[k] : null), put: (k, v) => { cacheStore[k] = v; }, remove: k => { delete cacheStore[k]; } }) } };
vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'gas_v13.js' });
const NOW = Date.parse('2026-10-18T12:00:00Z');
const at = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const m = (dir, text, minAgo, att) => ({ dir, text, at: at(minAgo), att: (att || []).map(t => ({ type: t })) });
let CTKM = ['Tặng quà nhỏ 10/10'];
ctx.__CTKM = CTKM;
const R = (rows, o) => { ctx.__rows = rows; ctx.__o = Object.assign({ now: NOW, ctkm: [], phone: false }, o || {}); return JSON.parse(JSON.stringify(vm.runInContext('coachBuildResult_(coachRules_(), __rows, __o)', ctx))); };
const st = (res, id) => (res.rules.find(r => r.id === id) || {}).state;
const rule = (res, id) => res.rules.find(r => r.id === id) || {};
vm.runInContext("getSetting_ = function(k) { return k === 'chatCoachCfg' ? (globalThis.__cfg || null) : null; };", ctx);

// ── 1. reply_fast ──
ok(st(R([m('in', 'chị ơi tư vấn giúp em', 10)]), 'reply_fast') === 'due', 'reply_fast: khách nhắn 10 phút chưa trả lời -> NHẮC');
ok(st(R([m('in', 'chị ơi', 3)]), 'reply_fast') === 'pending', 'reply_fast: mới 3 phút -> chờ (chưa nhắc)');
ok(st(R([m('in', 'chị ơi', 10), m('out', 'dạ chào em', 8)]), 'reply_fast') === 'done', 'reply_fast: đã trả lời -> xong');
ok(st(R([m('in', 'chị ơi', 4000)]), 'reply_fast') === 'na', 'reply_fast: tin khách quá 48h -> không nhắc nữa (tránh làm ồn)');
ok(rule(R([m('in', 'chị ơi', 25)]), 'reply_fast').say.includes('25 phút'), 'reply_fast: lời nhắc ghi rõ khách chờ bao lâu ("25 phút")');

// ── 2. ask_birth / ask_phone ──
ok(st(R([m('in', 'chị ơi em muốn xem vòng ngọc', 30), m('out', 'dạ chào em', 28)]), 'ask_birth') === 'due', 'ask_birth: chưa xin năm sinh -> NHẮC (kèm câu mẫu của sheet)');
ok(rule(R([m('in', 'em muốn xem vòng', 30), m('out', 'dạ', 28)]), 'ask_birth').script.includes('năm sinh cụ thể'), 'ask_birth: câu mẫu lấy từ sheet Bước 2');
ok(st(R([m('in', 'em muốn xem vòng', 30), m('out', 'Em cho chị xin ngày - tháng - năm sinh nha', 25)]), 'ask_birth') === 'done', 'ask_birth: đã xin ngày tháng năm sinh -> xong');
ok(st(R([m('in', 'em sinh năm 1992 muốn xem vòng', 30), m('out', 'dạ', 28)]), 'ask_birth') === 'done', 'ask_birth: khách tự cho năm sinh (có dấu) -> xong');
ok(st(R([m('in', 'em muốn xem', 5)]), 'ask_birth') === 'pending', 'ask_birth: mới 5 phút (< 10 phút ân hạn) -> chờ');
const four = [m('in', 'a', 50), m('out', 'x', 49), m('in', 'b', 40), m('in', 'c', 30), m('in', 'd', 20), m('out', 'y', 19)];
ok(st(R(four), 'ask_phone') === 'due', 'ask_phone: khách nhắn >= 4 tin mà chưa có SĐT -> NHẮC');
ok(st(R(four, { phone: true }), 'ask_phone') === 'done', 'ask_phone: hội thoại đã gắn SĐT -> xong');
ok(st(R(four.concat([m('in', 'sdt em 0912345678', 15)])), 'ask_phone') === 'done', 'ask_phone: khách gửi SĐT -> xong');
ok(st(R([m('in', 'a', 50), m('in', 'b', 40)]), 'ask_phone') === 'na', 'ask_phone: mới 2 tin khách -> chưa áp dụng');

// ── 3. VÍ DỤ 1 CỦA DUYÊN: hình ảnh kèm ghi âm ──
const born = m('in', 'em sinh năm 1992 mệnh Thủy', 40);
let r = R([born]);
ok(st(r, 'consult_image') === 'due' && st(r, 'consult_voice') === 'due', 'VÍ DỤ 1: khách cho năm sinh, sale chưa gửi ẢNH và chưa gửi GHI ÂM -> nhắc cả hai');
r = R([born, m('out', '', 30, ['image'])]);
ok(st(r, 'consult_image') === 'done' && st(r, 'consult_voice') === 'due', 'VÍ DỤ 1: đã gửi ảnh -> ảnh xong, còn nhắc ghi âm');
r = R([born, m('out', '', 30, ['image']), m('out', '', 29, ['audio'])]);
ok(st(r, 'consult_image') === 'done' && st(r, 'consult_voice') === 'done', 'VÍ DỤ 1: gửi cả ảnh và ghi âm -> hết nhắc');
r = R([born, m('out', '', 30, ['photo/jpeg']), m('out', '', 29, ['voice_message'])]);
ok(st(r, 'consult_image') === 'done' && st(r, 'consult_voice') === 'done', 'VÍ DỤ 1: nhận diện nhiều kiểu tên loại đính kèm (photo/jpeg, voice_message)');
ok(rule(R([born]), 'consult_image').script.includes('2 tông màu'), 'VÍ DỤ 1: câu mẫu ảnh lấy từ sheet Bước 3 ("Chị gửi em 2 tông màu...")');

// ── 4. trust_proof ──
ok(st(R([m('in', 'đá có thật không chị', 20)]), 'trust_proof') === 'due', 'trust_proof: khách hỏi "đá có thật không" chưa được trấn an -> NHẮC');
ok(st(R([m('in', 'đá có thật không chị', 20), m('out', 'Chị quay video cận cảnh vân đá cho em nhé', 15)]), 'trust_proof') === 'done', 'trust_proof: đã hứa video cận cảnh -> xong');

// ── 5. VÍ DỤ 2: báo giá kèm CTKM nếu có ──
const quote = m('out', 'Vòng chuỗi ngọc lam: 3.300k, nhẫn kim túi 4.950k', 10);
ok(st(R([quote], { ctkm: CTKM }), 'quote_ctkm') === 'due', 'VÍ DỤ 2: báo giá, đang có CTKM, chưa nhắc ưu đãi -> NHẮC');
ok(rule(R([quote], { ctkm: CTKM }), 'quote_ctkm').say.includes('Tặng quà nhỏ 10/10'), 'VÍ DỤ 2: lời nhắc nêu đúng tên CTKM đang chạy');
ok(rule(R([quote], { ctkm: CTKM }), 'quote_ctkm').script.includes('Tặng quà nhỏ 10/10'), 'VÍ DỤ 2: câu mẫu có kèm tên CTKM');
ok(st(R([quote], { ctkm: [] }), 'quote_ctkm') === 'na', 'VÍ DỤ 2: KHÔNG có CTKM nào đang chạy -> không nhắc ("nếu có")');
ok(st(R([m('out', 'Mức phí 3.300k, hôm nay còn tặng quà nhỏ cho em', 10)], { ctkm: CTKM }), 'quote_ctkm') === 'done', 'VÍ DỤ 2: nhắc ưu đãi ngay trong tin báo giá -> xong');
ok(st(R([quote, m('out', 'Em thỉnh hôm nay chị có ưu đãi giảm giá nữa nhé', 8)], { ctkm: CTKM }), 'quote_ctkm') === 'done', 'VÍ DỤ 2: nhắc ưu đãi ở tin sau -> xong');
ok(st(R([quote, m('out', 'ưu đãi tặng quà', 8), m('out', 'Còn món này 2.000k nữa', 5)], { ctkm: CTKM }), 'quote_ctkm') === 'done', 'VÍ DỤ 2: đã nhắc ưu đãi rồi báo thêm món khác -> không nhắc lại');
ok(st(R([m('in', 'giá bao nhiêu 3.300k vậy chị', 10)], { ctkm: CTKM }), 'quote_ctkm') === 'na', 'VÍ DỤ 2: số tiền do KHÁCH nhắn không phải sale báo giá -> không tính');
ok(st(R([m('out', 'em cho chị xin số điện thoại nhé 0912345678', 10)], { ctkm: CTKM }), 'quote_ctkm') === 'na', 'VÍ DỤ 2: SĐT không bị nhận nhầm là giá tiền');

// ── 6. VÍ DỤ 3: lên đơn thì hướng dẫn khách gửi size tay ──
const buy = m('in', 'ok chị chốt cho em mẫu này nhé', 20);
r = R([buy]);
ok(st(r, 'wrist_size') === 'due', 'VÍ DỤ 3: khách chốt, chưa có size tay -> NHẮC hướng dẫn khách gửi size');
ok(rule(r, 'wrist_size').script.includes('size tay') && rule(r, 'wrist_size').script.includes('chu vi cổ tay'), 'VÍ DỤ 3: câu mẫu hướng dẫn đo cổ tay (có câu "size tay" của sheet)');
ok(st(R([buy, m('out', 'Em gửi chị size cổ tay của em nhé', 15)]), 'wrist_size') === 'done', 'VÍ DỤ 3: sale đã hỏi size cổ tay -> xong');
ok(st(R([buy, m('out', 'cho chị xin số đo cổ tay em bao nhiêu cm', 15)]), 'wrist_size') === 'done', 'VÍ DỤ 3: sale xin số đo cổ tay -> xong');
ok(st(R([buy, m('in', 'cổ tay em 15cm', 12)]), 'wrist_size') === 'done', 'VÍ DỤ 3: khách đã tự gửi số đo (15cm) -> xong');
ok(st(R([m('in', 'cổ tay em 15cm', 40), buy]), 'wrist_size') === 'done', 'VÍ DỤ 3: số đo gửi TRƯỚC khi chốt vẫn tính');
ok(st(R([m('in', 'ok chị chốt em lấy mẫu này', 3)]), 'wrist_size') === 'pending', 'VÍ DỤ 3: mới 3 phút (< 5 phút ân hạn) -> chờ');
ok(st(R([m('in', 'chị ơi vòng này đẹp quá', 30)]), 'wrist_size') === 'na', 'VÍ DỤ 3: khách mới khen đẹp, chưa chốt -> chưa áp dụng');
ok(st(R([m('out', 'Em chuyển khoản vào STK 123 giúp chị nhé', 20)]), 'wrist_size') === 'due', 'VÍ DỤ 3: sale đã gửi STK (sắp lên đơn) mà chưa hỏi size -> NHẮC');

ok(st(R([buy, quote]), 'wrist_size') === 'due', 'VÍ DỤ 3 (hồi quy): câu báo giá "Vòng ... 3.300k" KHÔNG bị nhận nhầm là khách đã gửi size tay');

// ── 7. order_confirm ──
const addr = m('in', 'địa chỉ em 12 đường Lê Lợi phường 3', 20);
ok(st(R([addr]), 'order_confirm') === 'due', 'order_confirm: khách gửi địa chỉ, chưa xác nhận đơn -> NHẮC');
ok(st(R([addr, m('out', 'Chị xin xác nhận lại thông tin đơn hàng nha', 15)]), 'order_confirm') === 'done', 'order_confirm: đã xác nhận lại thông tin -> xong');
ok(st(R([m('out', 'chị xin xác nhận lại thông tin đơn', 30), addr]), 'order_confirm') === 'due', 'order_confirm: xác nhận TRƯỚC khi có địa chỉ không tính -> vẫn nhắc');

// ── 8. follow_silent ──
const talk = [m('in', 'em xem mẫu', 2000), m('out', 'dạ chị gửi em mẫu', 1900)];
ok(st(R(talk.concat([m('out', 'em xem thử nhé', 1800)])), 'follow_silent') === 'due', 'follow_silent: sale nhắn cuối, khách im >24h -> NHẮC theo sát');
ok(st(R([m('in', 'em xem mẫu', 600), m('out', 'dạ chị gửi mẫu', 590)]), 'follow_silent') === 'pending', 'follow_silent: mới ~10 giờ -> chờ');
ok(st(R([m('out', 'chào em', 2000)]), 'follow_silent') === 'na', 'follow_silent: khách chưa từng nhắn -> không áp dụng');
ok(st(R([m('in', 'em xem mẫu', 2000), m('out', 'dạ', 1900), m('in', 'ok chị', 1000)]), 'follow_silent') === 'na', 'follow_silent: khách đã trả lời -> không áp dụng');
ok(st(R([m('in', 'em xem', 9000), m('out', 'dạ', 8900)]), 'follow_silent') === 'na', 'follow_silent: im lặng quá 3 ngày -> thôi không nhắc (hội thoại đã nguội)');

// ── 9. Tổng hợp theo bước ──
r = R([born, quote, buy], { ctkm: CTKM });
const stepOf = n => r.steps.find(s => s.n === n).state;
ok(stepOf(3) === 'due' && stepOf(5) === 'due' && stepOf(7) === 'due', 'Tổng hợp: bước 3, 5, 7 đều QUÁ HẠN');
ok(r.dueCount === r.reminders.length && r.reminders.every((x, i, a) => i === 0 || a[i - 1].step <= x.step), 'Tổng hợp: danh sách nhắc sắp xếp theo thứ tự bước quy trình');
ok(R([]).reminders.length === 0 && R([]).msgCount === 0, 'Hội thoại trống -> không nhắc gì, không lỗi');

// ── 10. Cấu hình ghi đè (Settings chatCoachCfg) ──
ctx.__cfg = JSON.stringify({ rules: [{ id: 'consult_voice', enabled: false }, { id: 'wrist_size', grace: 0, say: 'TUY CHINH' },
  { id: 'my_rule', step: 6, title: 'Xin đánh giá', when: { who: 'out', re: 'da nhan hang' }, needs: { who: 'out', re: 'danh gia' }, grace: 0, say: 'Nhắc xin đánh giá', script: 'Em đánh giá giúp chị nhé' }] });
r = R([born, buy]);
ok(!r.rules.some(x => x.id === 'consult_voice'), 'Cấu hình: tắt quy tắc ghi âm (enabled:false) -> biến mất');
ok(rule(r, 'wrist_size').say === 'TUY CHINH' && st(r, 'wrist_size') === 'due', 'Cấu hình: ghi đè từng trường của quy tắc có sẵn (lời nhắc + ân hạn)');
ok(st(R([m('out', 'Em đã nhận hàng chưa nhé', 5)]), 'my_rule') === 'due' && st(R([m('out', 'da nhan hang', 5), m('out', 'em danh gia giup chi', 4)]), 'my_rule') === 'done', 'Cấu hình: thêm quy tắc MỚI (id mới) chạy đúng');
ctx.__cfg = '{hong json'; ok(R([born]).rules.length === COACH_COUNT(), 'Cấu hình JSON hỏng -> dùng quy tắc mặc định, không lỗi');
function COACH_COUNT() { return vm.runInContext('COACH_RULES_.length', ctx); }
ctx.__cfg = JSON.stringify({ rules: [{ id: 'bad', step: 1, when: { who: 'in', re: '([' }, grace: 0 }] });
r = R([m('in', 'xin chào', 10)]); ok(r.warnings.length > 0 && r.rules.length > 0, 'Cấu hình: regex hỏng -> có cảnh báo, các quy tắc khác vẫn chạy');
ctx.__cfg = null;

// ── 11. Endpoint: quyền truy cập + luồng đầy đủ ──
const sbCalls = [];
vm.runInContext(`
  var __user = null, __ek = '', __conv = [{ id: 'P1_U1', page_id: 'P1', customer_name: 'Khách A', customer_phone: '' }];
  var __msgs = [];
  _sessUser_ = function(t) { return t === 'tok-web' ? { username: 'lan', role: 'cs' } : (t === 'tok-demo' ? { username: 'demo', role: 'demo' } : null); };
  _extKeyWho_ = function(k) { return k === 'KEY-PK' ? 'pancake' : (k === 'KEY-ZL' ? 'zalo' : (k ? 'sai' : '')); };
  sb_ = function(m, p) { __calls.push(p); if (p.indexOf('pk_conversations') === 0) return { json: __conv }; return { json: [] }; };
  _pkMsgs_ = function(tail) { __calls.push('MSGS' + tail); return __msgs.slice(); };
  readCTKMCatalog_ = function() { return { rows: [{ 'Tên CTKM': 'Tặng quà nhỏ 10/10', 'Ghi chú': 'x' }, { 'Tên CTKM': 'Hết hạn', __ctkmExpired: true }] }; };
`, Object.assign(ctx, { __calls: sbCalls }));
vm.runInContext('jsonOut_ = function(o) { return o; };', ctx);   // tra thang doi tuong (khong qua ContentService)
const call = (p) => { ctx.__p = p; return JSON.parse(JSON.stringify(vm.runInContext('chatCoach_({ parameter: __p })', ctx))); };
let res = call({ conv: 'P1_U1' }); ok(res.ok === false && res.code === 'AUTH', 'Endpoint: không token, không khóa -> từ chối');
res = call({ conv: 'P1_U1', ek: 'sai-key' }); ok(res.ok === false && res.code === 'AUTH', 'Endpoint: khóa extension sai -> từ chối');
res = call({ conv: 'P1_U1', token: 'tok-demo' }); ok(res.ok === false, 'Endpoint: tài khoản test bị từ chối');
res = call({ token: 'tok-web' }); ok(res.ok === false && /conv/.test(res.error), 'Endpoint: thiếu conv -> báo lỗi rõ');
ctx.__conv = []; res = call({ conv: 'P1_NONE', token: 'tok-web' }); ok(res.ok === true && res.found === false && res.reminders.length === 0, 'Endpoint: không thấy hội thoại -> found:false, không lỗi');
ctx.__conv = [{ id: 'P1_U1', page_id: 'P1', customer_name: 'Khách A', customer_phone: '' }];
const nowIso = (min) => new Date(Date.now() - min * 60000).toISOString();
// _pkMsgs_ tra DONG THO tu Supabase (direction/sent_at/...), endpoint moi map sang dang chuan qua _pkMsgOut_
ctx.__msgs = [{ id: 'm1', conversation_id: 'P1_U1', direction: 'out', text: 'Vòng ngọc 3.300k nhé em', sent_at: nowIso(25), sender_name: 'Page', attachments: null },
  { id: 'm0', conversation_id: 'P1_U1', direction: 'in', text: 'ok chị chốt em lấy mẫu này', sent_at: nowIso(30), sender_name: 'Khách A', attachments: null }];   // DESC (moi nhat truoc) nhu truy van that
res = call({ conv: 'P1_U1', token: 'tok-web' });
ok(res.ok && res.found && res.customer === 'Khách A' && res.gv, 'Endpoint (web): trả kết quả + tên khách + nhãn phiên bản GAS');
ok(res.reminders.some(x => x.id === 'quote_ctkm') && res.reminders.some(x => x.id === 'wrist_size'), 'Endpoint: có nhắc báo giá kèm CTKM + nhắc size tay (CTKM đọc từ danh mục)');
ok(JSON.stringify(res.ctkm) === JSON.stringify(['Tặng quà nhỏ 10/10']), 'Endpoint: chỉ lấy CTKM còn hiệu lực (bỏ "Hết hạn")');
res = call({ conv: 'P1_U1', ek: 'KEY-PK' }); ok(res.ok && res.found, 'Endpoint (extension Pancake): khóa hợp lệ -> chạy được');
res = call({ conv: 'P1_U1', ek: 'KEY-ZL' }); ok(res.ok === true, 'Endpoint (extension Zalo): khóa hợp lệ -> chạy được');
ok(sbCalls.some(c => /conversation_id=eq\.P1_U1/.test(c) && /limit=150/.test(c)), 'Endpoint: đọc 150 tin gần nhất của đúng hội thoại');
ok(!sbCalls.some(c => /^(POST|PATCH|DELETE)/.test(c)), 'Endpoint: chỉ ĐỌC, không ghi gì');
vm.runInContext("sb_ = function() { throw new Error('Supabase HTTP 500'); };", ctx);
res = call({ conv: 'P1_U1', token: 'tok-web' }); ok(res.ok === false && /Lỗi nhắc quy trình/.test(res.error), 'Endpoint: Supabase lỗi -> báo lỗi gọn, không sập');
console.log('\n' + oks + ' OK, ' + fails + ' FAIL'); process.exit(fails ? 1 : 0);

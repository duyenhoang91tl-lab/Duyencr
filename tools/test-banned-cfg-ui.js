#!/usr/bin/env node
// Test Node cho giao diện "🚫 Từ cấm" ở ⚙ Cấu hình (js/37). Chạy: node tools/test-banned-cfg-ui.js -> "BANNED CFG UI TESTS PASSED".
// Nạp NGUYÊN khối code thật giữa 2 mốc trong js/37, dùng document/fetch giả để kiểm: phân tích dòng, vẽ HTML, payload lưu, kiểm tra giới hạn.
const fs = require('fs'), vm = require('vm'), path = require('path');
const j37 = fs.readFileSync(path.join(__dirname, '..', 'js', '37-fn-configpage.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const a = j37.indexOf('// ── TỪ CẤM (Settings'), b = j37.indexOf('// ── DANH SÁCH BÁO CÁO (reportsConfig)');
ok(a > 0 && b > a, 'tim thay khoi code that');
ok(j37.includes("'bannedWordsCfg'") && j37.includes('_cfgBannedHtml_() +'), 'da noi vao _cfgLoad (getSettings) va _cfgRender');
const els = {}, calls = [], toasts = [];
const ctx = { esc: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'), gsUrl: 'http://gas', currentUser: { name: 'Duyên' }, _cfgRender() {}, toast: m => toasts.push(m),
  confirm: () => true, document: { getElementById: id => els[id] || null },
  fetch: async (u, o) => { calls.push(JSON.parse(o.body)); return { json: async () => ({ ok: true }) }; } };
vm.createContext(ctx); vm.runInContext(j37.slice(a, b), ctx);
const run = e => vm.runInContext(e, ctx);

// (1) phân tích dòng: 1 từ / có → / các dấu phân cách khác / trùng không phân biệt hoa-thường-dấu / dòng trống
const P = run(`_cfgBannedParse_('cam kết\\n  Tài lộc → thuận lợi công việc \\n\\nchắc chắn -> nên cân nhắc\\nTAI LOC\\nmang lại | tạo ra\\nx => a → b')`);
ok(P.items.length === 5 && P.dup === 1, 'parse 5 muc, 1 trung: ' + JSON.stringify(P));
ok(P.items[0].tuCam === 'cam kết' && P.items[0].thayThe === '', 'dong khong co mui ten => khong co chu thay the');
ok(P.items[1].tuCam === 'Tài lộc' && P.items[1].thayThe === 'thuận lợi công việc', 'dau → tach tu cam / thay the');
ok(P.items[2].thayThe === 'nên cân nhắc' && P.items[3].thayThe === 'tạo ra' && P.items[4].tuCam === 'x' && P.items[4].thayThe === 'a → b', 'nhan -> | =>; chu thay the co them → thi giu');
// hiển thị lại đúng dạng nhập
ok(run(`_cfgBannedLines_([{tuCam:'a',thayThe:''},{tuCam:'b',thayThe:'c d'}])`) === 'a\nb → c d', 'lines: ghep lai dung dinh dang');

// (2) áp cấu hình server về state: mặc định / sai kiểu
run('_cfgBannedApply_({})'); ok(run('_cfgBanned.useSheet') === true && run('_cfgBanned.items.length') === 0, 'mac dinh: bat sheet, khong co tu');
run('_cfgBannedApply_("rac")'); ok(run('_cfgBanned.items.length') === 0, 'chuoi rac => mac dinh');
run('_cfgBannedApply_({ useSheet:false, items:[{tuCam:" a  b ",thayThe:" x "},{tuCam:""},null,5] })');
ok(run('_cfgBanned.useSheet') === false && run('JSON.stringify(_cfgBanned.items)') === '[{"tuCam":"a b","thayThe":"x"}]', 'ap cau hinh: loc rong/sai kieu, gon khoang trang');

// (3) HTML
const h = run('_cfgBannedHtml_()');
ok(h.includes('🚫 Từ cấm') && h.includes('id="cfg-ban-list"') && h.includes('a b → x') && h.includes('(1 từ)'), 'html: co o nhap, hien tu dang co + dem');
ok(!/id="cfg-ban-sheet" checked/.test(h) && /id="cfg-ban-sheet"/.test(h), 'html: useSheet=false => checkbox bo tick');
run('_cfgBannedApply_({ items:[{tuCam:"<b>",thayThe:""}] })'); const inTa = /<textarea id="cfg-ban-list"[^>]*>([\s\S]*?)<\/textarea>/.exec(run('_cfgBannedHtml_()'))[1];
ok(inTa === '&lt;b>', 'html: ky tu dac biet trong o nhap duoc thoat: ' + inTa);
run('_cfgBannedApply_({})');

// (4) LƯU: payload đúng, ghi Nhật ký, cập nhật state
(async () => {
  els['cfg-ban-list'] = { value: 'cam kết\nTài lộc → thuận lợi\ncam KẾT' }; els['cfg-ban-sheet'] = { checked: true }; els['cfg-ban-save'] = {};
  await run('_cfgBannedSave()');
  const set = calls.find(c => c.action === 'setSetting');
  ok(set && set.key === 'bannedWordsCfg', 'gui setSetting dung key');
  const v = JSON.parse(set.value);
  ok(v.useSheet === true && v.items.length === 2 && v.items[1].thayThe === 'thuận lợi', 'payload: 2 tu (da bo trung), useSheet=true: ' + set.value);
  ok(toasts.some(t => /Đã bỏ 1 dòng trùng/.test(t)) && toasts.some(t => /Đã lưu từ cấm/.test(t)), 'bao da bo trung + da luu');
  ok(calls.some(c => c.action === 'saveAudit' && /Từ cấm/.test(c.rows[0].action) && c.rows[0].oldValue !== c.rows[0].newValue), 'ghi Nhat ky voi gia tri cu -> moi');
  ok(run('_cfgBanned.items.length') === 2, 'state cap nhat sau khi luu');
  // không đổi gì => không ghi Nhật ký
  calls.length = 0; toasts.length = 0; await run('_cfgBannedSave()');
  ok(!calls.some(c => c.action === 'saveAudit') && toasts.some(t => /Không có thay đổi/.test(t)), 'khong doi => khong ghi Nhat ky');
  // quá dài / quá nhiều => chặn, KHÔNG gửi server
  calls.length = 0; toasts.length = 0;
  els['cfg-ban-list'] = { value: 'x'.repeat(101) }; await run('_cfgBannedSave()');
  ok(calls.length === 0 && toasts.some(t => /quá dài/.test(t)), 'tu >100 ky tu bi chan');
  els['cfg-ban-list'] = { value: Array.from({ length: 501 }, (_, i) => 'w' + i).join('\n') }; toasts.length = 0; await run('_cfgBannedSave()');
  ok(calls.length === 0 && toasts.some(t => /Tối đa 500/.test(t)), '>500 tu bi chan');
  // tắt sheet + rỗng: hỏi xác nhận; từ chối => không gửi
  els['cfg-ban-list'] = { value: '' }; els['cfg-ban-sheet'] = { checked: false }; ctx.confirm = () => false; await run('_cfgBannedSave()');
  ok(calls.length === 0, 'tat sheet + rong, khong xac nhan => khong gui');
  ctx.confirm = () => true; await run('_cfgBannedSave()');
  ok(JSON.parse(calls.find(c => c.action === 'setSetting').value).useSheet === false, 'xac nhan => gui useSheet=false');
  // về mặc định => gửi {} (server hiểu = bật sheet, không từ thêm)
  calls.length = 0; await run('_cfgBannedSave(true)');
  ok(calls.find(c => c.action === 'setSetting').value === '{}' && run('_cfgBanned.useSheet') === true && run('_cfgBanned.items.length') === 0, 've mac dinh => {} + state ve mac dinh');
  // server từ chối (không phải admin) => báo lỗi, không đổi state
  run('_cfgBannedApply_({ items:[{tuCam:"giu",thayThe:""}] })'); toasts.length = 0;
  ctx.fetch = async () => ({ json: async () => ({ error: 'Chi admin', code: 'FORBIDDEN' }) });
  els['cfg-ban-list'] = { value: 'moi' }; els['cfg-ban-sheet'] = { checked: true }; await run('_cfgBannedSave()');
  ok(toasts.some(t => /Lưu lỗi: Chi admin/.test(t)) && run('_cfgBanned.items[0].tuCam') === 'giu', 'server tu choi => bao loi, giu nguyen state');
  console.log('BANNED CFG UI TESTS PASSED');
})().catch(e => { console.error('FAIL: ngoai le', e); process.exit(1); });

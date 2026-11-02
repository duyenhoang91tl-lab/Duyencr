// Test giao diện cột "🗓 Mốc theo ngày" (js/62) + việc nối vào modal "Phân loại đội Sale" (js/12) — node tools/test-sale-channel-periods-ui.js
const fs = require('fs'), vm = require('vm');
const R = p => fs.readFileSync(__dirname + '/../' + p, 'utf8');
const j62 = R('js/62-sale-channel-periods.js'), j12 = R('js/12-fn-rendersalesreporttabe.js');
let fails = 0; const ok = (c, m) => { if (!c){ fails++; console.log('FAIL', m); } };
const toasts = [], saved = [];
const ctx = { loadLS: () => null, saveLS: (k, v) => saved.push([k, JSON.stringify(v)]), gsUrl: '', toast: m => toasts.push(m), esc: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
  SALE_CHANNELS: { 'Chi': 'online' }, SALE_GROUPS: [{ key: 'online', label: 'Online' }, { key: 'offline', label: 'Văn phòng' }, { key: 'probation', label: 'Thử việc' }],
  currentUser: { role: 'admin' }, _renderSaleChannelsModal: () => {}, setTimeout: () => {}, console };
vm.createContext(ctx);
vm.runInContext('function _cfgAliasesOf(n){ return [n]; }\nfunction _cfgByAlias(m, n){ return m[n]; }\nfunction _saleChannelOf_(n){ return SALE_CHANNELS[n] || ""; }\n' + j62, ctx);
const run = c => vm.runInContext(c, ctx);
// nối vào modal
ok(/_scpCellHtml_\(name\)/.test(j12) && /_scpEditorRowHtml_\(name, 3\)/.test(j12), 'js/12 gọi _scpCellHtml_/_scpEditorRowHtml_');
// chưa có mốc
ok(/Thêm mốc/.test(run('_scpCellHtml_("Chi")')), 'nút Thêm mốc khi chưa có mốc');
// mở editor → 1 dòng trống; nhập ví dụ của Duyên
run('_scpToggle("Chi")'); ok(run('_scpDraft.length') === 1 && run('_scpOpenName') === 'Chi', 'mở editor có sẵn 1 dòng');
ok(/Từ ngày/.test(run('_scpEditorRowHtml_("Chi", 3)')) && run('_scpEditorRowHtml_("Khac", 3)') === '', 'editor chỉ hiện cho Sale đang mở');
run('_scpDraft[0] = {from:"2026-09-10", channel:"probation"}; _scpDraft.push({from:"2026-10-11", channel:"online"})');
const html = run('_scpEditorRowHtml_("Chi", 3)');
ok(html.indexOf('đến hết 10/10/2026') !== -1, 'mốc 1 hiện "đến hết 10/10/2026": ' + html.slice(0, 0)); ok(html.indexOf('không giới hạn') !== -1, 'mốc cuối không giới hạn');
// lưu: ngày trùng bị chặn, thiếu ngày bị chặn
run('_scpDraft.push({from:"2026-10-11", channel:"offline"})'); run('_scpSaveDraft()');
ok(toasts.some(m => /trùng ngày 11\/10\/2026/.test(m)) && run('_scpOpenName') === 'Chi', 'chặn mốc trùng ngày');
run('_scpDraft.pop(); _scpDraft.push({from:"", channel:"offline"})'); run('_scpDraft.push({from:"", channel:"online"})'); run('_scpSaveDraft()');
ok(toasts.some(m => /1 mốc không chọn ngày/.test(m)) && run('_scpOpenName') === 'Chi', 'chặn 2 mốc cùng không chọn ngày');
run('_scpDraft.pop()');
run('_scpDraft.pop(); _scpDraft.push({from:"", channel:""})'); run('_scpSaveDraft()');   // dòng trống hoàn toàn → bỏ qua
ok(run('_scpOpenName') === '' && run('_saleChannelOn_("Chi","2026-09-20")') === 'probation' && run('_saleChannelOn_("Chi","2026-10-11")') === 'online', 'lưu thành công, tra theo ngày đúng');
ok(saved.some(s => s[0] === 'ome_sale_channel_periods' && /2026-09-10/.test(s[1])), 'ghi localStorage');
ok(/Sửa mốc \(2\)/.test(run('_scpCellHtml_("Chi")')) && /10\/09\/2026 → 10\/10\/2026: <b>Thử việc/.test(run('_scpCellHtml_("Chi")')) && /<b>Chính thức — Online/.test(run('_scpCellHtml_("Chi")')), 'tóm tắt trong ô');
// chọn giai đoạn Thử việc / Chính thức (+ đội) trong editor
run('_scpToggle("Chi")'); run('_scpDraft.length=0; _scpDraft.push({from:"2026-11-01",channel:""})');
run('_scpSetStage(0,"tv")'); ok(run('_scpDraft[0].channel') === 'probation' && !/Văn phòng/.test(run('_scpEditorRowHtml_("Chi",3)')), 'Thử việc → channel probation, không hiện ô chọn đội');
run('_scpSetStage(0,"ct")'); ok(run('_scpDraft[0].channel') === 'online' && /Chính thức<\/option>/.test(run('_scpEditorRowHtml_("Chi",3)')) && /Văn phòng/.test(run('_scpEditorRowHtml_("Chi",3)')), 'Chính thức → mặc định Online, hiện ô chọn đội (không có Thử việc trong ô đội)');
ok(!/value="probation"/.test(run('_scpEditorRowHtml_("Chi",3)')), 'ô đội không chứa probation');
run('_scpDraft[0].channel="offline"'); run('_scpSetStage(0,"ct")'); ok(run('_scpDraft[0].channel') === 'offline', 'đổi lại Chính thức giữ đội đã chọn');
run('_scpSetStage(0,"")'); ok(run('_scpDraft[0].channel') === '', 'Chưa phân loại');
run('_scpToggle("Chi")');
// xoá hết mốc → quay lại phân loại hiện tại
run('_scpToggle("Chi")'); run('_scpDraft.length = 0'); run('_scpSaveDraft()');
ok(run('_saleChannelOn_("Chi","2026-09-20")') === 'online', 'xoá hết mốc → loại hiện tại');
// MỐC KHÔNG NGÀY: Sale vốn đã chính thức → chỉ chọn Chính thức + đội, để trống ngày, vẫn lưu được và áp dụng mọi ngày
ctx.currentUser.role = 'admin'; run('_scpToggle("Chi")'); run('_scpDraft.length=0; _scpDraft.push({from:"", channel:"offline"})');
ok(/không chọn ngày = áp dụng từ trước đến nay/.test(run('_scpEditorRowHtml_("Chi",3)')), 'editor ghi rõ mốc không ngày');
run('_scpSaveDraft()');
ok(run('_scpOpenName') === '' && run('_saleChannelOn_("Chi","2020-01-01")') === 'offline' && run('_saleChannelOn_("Chi","2030-01-01")') === 'offline' && /Từ đầu →: <b>Chính thức — Văn phòng/.test(run('_scpCellHtml_("Chi")')), 'mốc không ngày lưu được, áp dụng mọi ngày');
// mốc không ngày + mốc có ngày: không ngày = giai đoạn đầu
run('_scpToggle("Chi")'); run('_scpDraft.push({from:"2026-10-11", channel:"online"})'); run('_scpSaveDraft()');
ok(run('_saleChannelOn_("Chi","2026-10-10")') === 'offline' && run('_saleChannelOn_("Chi","2026-10-11")') === 'online' && /Từ đầu → 10\/10\/2026/.test(run('_scpCellHtml_("Chi")')), 'không ngày + có ngày');
// không phải admin
ctx.currentUser.role = 'cs'; run('_scpToggle("Chi")'); run('_scpSaveDraft()'); ok(toasts.some(m => /Chỉ Admin/.test(m)), 'chỉ admin lưu');
// _setSaleChannel (js/12): đặt đội cho 1 dòng = ghi cho MỌI tên cùng 1 người
{
  const src12 = j12.slice(j12.indexOf('function _setSaleChannel('), j12.indexOf('\n}\n', j12.indexOf('function _setSaleChannel(')) + 3);
  const c2 = { SALE_CHANNELS: { Bi: 'offline', bi: '' }, _scpGroupNames_: () => ['Bi', 'bi'], saveSaleChannels: () => {}, _renderSaleChannelsModal: () => { c2.rendered = 1; } };
  vm.createContext(c2); vm.runInContext(src12 + '\n_setSaleChannel("Bi","online");', c2);
  ok(c2.SALE_CHANNELS.Bi === 'online' && c2.SALE_CHANNELS.bi === 'online' && c2.rendered === 1, '_setSaleChannel ghi cả 2 tên');
  vm.runInContext('_setSaleChannel("Bi","");', c2);
  ok(!('Bi' in c2.SALE_CHANNELS) && !('bi' in c2.SALE_CHANNELS), '_setSaleChannel xoá cả 2 tên');
}
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);

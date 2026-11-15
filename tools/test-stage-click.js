// R14: CS bấm ô giai đoạn (thanh mũi tên hồ sơ khách / panel Chat) → đổi Tình trạng CS. Cần jsdom (npm i --no-save jsdom@24).
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bỏ qua: chưa cài jsdom)'); process.exit(0); }
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = fs.readFileSync(path.join(__dirname, '../js/33-pro-profile.js'), 'utf8');
const tree = [{ label: 'Chốt', value: 'Chốt' }, { label: 'Phân vân', value: 'Phân vân/Tiềm năng' },
  { label: 'Đang liên hệ', children: [{ label: 'Hẹn gọi lại sau', value: 'Hẹn gọi lại sau' }, { label: 'Đang sd', value: 'Đang sd' }] },
  { label: 'Nhóm rỗng', children: [] }, { label: 'Có "ngoặc" <b>', value: 'Có "ngoặc" <b>' }];

function mk(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html class="ui-pro"><body><div id="dp-pro"></div></body></html>', { runScripts: 'outside-only' });
  const w = dom.window, log = { save: [], audit: [], sync: [], toast: [], filt: 0 };
  w.careData = { '0901': { status: opts.status || '', cs: 'A' } };
  w.currentPhone = '0901'; w.allCustomers = [{ phone: '0901', orders: [], careStatus: opts.status || '' }];
  w.CARE_STATUS_TREE = tree; w._posStatsOn = false; w.donStatsByPhone = {}; w._custRev_ = () => 0; w._ymd = () => '2026-11-15';
  w.gsUrl = 'http://x'; w.queueCareSync = p => log.sync.push(p); w.logAudit = (...a) => log.audit.push(a);
  w._touchCare = () => {}; w.saveLS = () => {}; w._invalidateFilterCache = () => {}; w.updateStats = () => {}; w.updateSidebarBadges = () => {};
  w.applyFilters = () => { log.filt++; }; w.toast = m => log.toast.push(m); w._hAutoKh_ = v => (v === 'Chốt' ? 'Đã chốt' : '');
  w.careStatusFullLabel = v => 'FULL:' + v; w._hIsChot_ = v => v === 'Chốt';
  w.saveCare = ph => { log.save.push([ph, w.document.getElementById('cs-status').value]); w.careData[ph] = Object.assign({}, w.careData[ph], { status: w.document.getElementById('cs-status').value }); };
  if (opts.form) {
    const sel = w.document.createElement('select'); sel.id = 'cs-status';
    ['', 'Chốt', 'Phân vân/Tiềm năng', 'Hẹn gọi lại sau', 'Đang sd'].forEach(v => { const o = w.document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); });
    sel.value = opts.status || ''; w.document.body.appendChild(sel);
    w._hOnCsStatusChange_ = () => { log.changeCalled = true; };
  }
  w.eval(src);
  return { w, log, host: () => w.document.getElementById('dp-pro') };
}
const render = (t, status) => { t.host().innerHTML = t.w.proStageHtml_(t.w.proStageModel_(tree, status), { phone: '0901' }); };

// 1) model
{ const t = mk(); const m = t.w.proStageModel_(tree, 'Đang sd');
  ok(m[0].value === 'Chốt' && !m[0].children, 'ô lá có value');
  ok(m[2].children.length === 2 && m[2].cur && m[2].children[1].cur && !m[2].children[0].cur, 'ô nhóm có children, đúng mục con hiện tại');
  ok(m.filter(x => x.cur).length === 1, 'chỉ 1 ô hiện tại (như cũ)');
  ok(m[3].value === undefined && !m[3].children, 'nhóm rỗng: không value, không con');
}
// 2) HTML: không phone = y hệt bản cũ; có phone = bấm được + escape
{ const t = mk(); const old = t.w.proStageHtml_(t.w.proStageModel_(tree, 'Chốt'));
  ok(!/data-pro-stage|role=/.test(old) && old.startsWith('<ul class="pro-stage">'), 'không truyền phone → chỉ xem, HTML bản cũ');
  render(t, 'Chốt'); const h = t.host().innerHTML;
  ok(t.host().querySelectorAll('li[data-pro-stage-val]').length === 3, '3 ô lá bấm được');
  ok(t.host().querySelectorAll('li[data-pro-stage-grp]').length === 1, 'chỉ nhóm có con mới bấm được (nhóm rỗng thì không)');
  ok(t.host().querySelectorAll('.pro-stage-sub button').length === 2 && t.host().querySelector('.pro-stage-sub').hidden, 'hàng mục con có 2 nút, mặc định ẩn');
  ok(t.host().querySelector('li[data-pro-stage-val="Có &quot;ngoặc&quot; <b>"]') === null && t.host().querySelector('li[data-pro-stage-val][title*="ngoặc"]').getAttribute('data-pro-stage-val') === 'Có "ngoặc" <b>', 'value có " và < được escape, đọc lại đúng nguyên văn');
}
// 3) bấm ô lá, hồ sơ đang mở tab Chăm sóc → đặt #cs-status + saveCare
{ const t = mk({ form: true, status: '' }); render(t, '');
  t.host().querySelector('li[data-pro-stage-val="Chốt"]').click();
  ok(t.log.save.length === 1 && t.log.save[0][0] === '0901' && t.log.save[0][1] === 'Chốt', 'gọi saveCare đúng SĐT + giá trị');
  ok(t.log.changeCalled === true, 'gọi _hOnCsStatusChange_ (hiện khung đơn chốt, KH tự nhảy)');
  ok(t.log.audit.length === 0 && t.log.sync.length === 0, 'không ghi trùng (saveCare lo nhật ký/đồng bộ)');
  ok(/class="cur"[^>]*data-pro-stage-val="Chốt"/.test(t.host().innerHTML), 'thanh vẽ lại: Chốt đang sáng');
}
// 4) không có form (tab khác / panel Chat) → ghi thẳng, đủ các bước
{ const t = mk({ status: 'Hẹn gọi lại sau' }); render(t, 'Hẹn gọi lại sau');
  t.host().querySelector('li[data-pro-stage-val="Chốt"]').click();
  ok(t.log.save.length === 0, 'không gọi saveCare khi không có form');
  ok(t.w.careData['0901'].status === 'Chốt' && t.w.careData['0901'].cs === 'A', 'đổi status, giữ nguyên các trường khác');
  ok(t.w.careData['0901'].khStatus === 'Đã chốt', 'Trạng thái KH tự nhảy theo (đúng saveCare)');
  ok(t.w.allCustomers[0].careStatus === 'Chốt', 'cập nhật cả danh sách khách');
  ok(t.log.audit.length === 1 && t.log.audit[0][0] === 'status' && t.log.audit[0][2] === 'Hẹn gọi lại sau' && t.log.audit[0][3] === 'Chốt', 'ghi nhật ký thay đổi cũ → mới');
  ok(t.log.sync.join() === '0901' && t.log.filt === 1, 'đưa vào hàng đợi đồng bộ GAS + lọc lại danh sách');
  ok(/FULL:Chốt/.test(t.log.toast[0]) && /doanh thu/.test(t.log.toast[0]), 'toast báo đã chuyển + nhắc nhập doanh thu khi là Chốt');
}
// 5) bấm đúng mục đang chọn → không làm gì
{ const t = mk({ status: 'Chốt' }); render(t, 'Chốt'); t.host().querySelector('li[data-pro-stage-val="Chốt"]').click();
  ok(t.log.audit.length === 0 && t.log.sync.length === 0 && t.log.toast.length === 0, 'bấm mục đang chọn: không nhật ký/đồng bộ/toast'); }
// 6) ô nhóm → mở hàng con → chọn con
{ const t = mk({ status: '' }); render(t, '');
  const g = t.host().querySelector('li[data-pro-stage-grp]'), sub = t.host().querySelector('.pro-stage-sub');
  g.click(); ok(!sub.hidden && g.getAttribute('aria-expanded') === 'true', 'bấm nhóm → mở hàng mục con');
  g.click(); ok(sub.hidden && g.getAttribute('aria-expanded') === 'false', 'bấm lần nữa → đóng');
  g.click(); t.host().querySelector('.pro-stage-sub button[data-pro-stage-val="Đang sd"]').click();
  ok(t.w.careData['0901'].status === 'Đang sd' && t.log.audit.length === 1, 'chọn mục con → đổi tình trạng');
}
// 7) bàn phím Enter trên ô
{ const t = mk({ status: '' }); render(t, '');
  const li = t.host().querySelector('li[data-pro-stage-val="Phân vân/Tiềm năng"]');
  li.dispatchEvent(new t.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  ok(t.w.careData['0901'].status === 'Phân vân/Tiềm năng', 'Enter trên ô → đổi tình trạng'); }
// 8) panel Chat vẽ lại đúng hội thoại
{ const t = mk({ status: '' }); let rer = 0; t.w._proChatConv_ = { phone: '+84 901' }; t.w.proChatFindCustomer_ = () => ({ phone: '0901' }); t.w.proChatInfoRender_ = c => { rer++; };
  render(t, ''); t.host().querySelector('li[data-pro-stage-val="Chốt"]').click(); ok(rer === 1, 'đang xem panel Chat của khách này → vẽ lại panel'); }
console.log('PASS', pass, 'FAIL', fail); process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// Test tab Ticket (js/99-g, khoi 11b web): ve danh sach/SLA, tao, dong, loi GAS cu. Chay: node tools/test-ticket-ui.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '99-g-order-from-profile.js'), 'utf8');
const wrap = { innerHTML: '' }, calls = []; let resp;
const vals = { 'tk-type': 'doi_tra', 'tk-title': ' Đổi size ', 'tk-phone': '0966238929', 'tk-note': 'n', 'tk-assignee': '' };
const ctx = { console, Date, JSON, Math, Object, Number, String, Array, encodeURIComponent, localStorage: { getItem: () => 'TK' }, gsUrl: 'https://gas/x', toast: m => calls.push('toast:' + m), prompt: () => 'xong',
  registerExtraTab: (id, l, f) => calls.push('reg:' + id), document: { getElementById: id => (id === 'xt-wrap-ticket' ? wrap : (id in vals ? { value: vals[id] } : null)) },
  fetch: async (url, o) => { calls.push(o && o.body ? 'POST ' + o.body : 'GET ' + url); return { json: async () => (o && o.body ? { ok: true } : resp) }; } };
vm.createContext(ctx); vm.runInContext(src, ctx);
ok(calls.includes('reg:ticket'), 'dang ky tab ticket');
resp = { ok: true, canManage: true, overdue: 1, types: { doi_tra: 'Đổi trả' }, rows: [
  { id: 'TK1', type: 'doi_tra', typeLabel: 'Đổi trả', status: 'open', title: 'Đổi <b>nhẫn</b>', createdBy: 'Hoa', assignee: 'Kho', dueAt: Date.now(), phone: '0966238929', custName: 'Duyên', note: '', sla: { state: 'overdue', overdueMinutes: 190 }, escalateTo: ['TP CSKH'] },
  { id: 'TK2', type: 'doi_tra', typeLabel: 'Đổi trả', status: 'done', title: 'Xong rồi', createdBy: 'Hoa', assignee: 'Kho', dueAt: Date.now(), doneAt: Date.now(), doneBy: 'Kho', sla: { state: 'done_ontime' }, escalateTo: [] }] };
(async () => {
  await ctx._tktLoad();
  ok(/1 trễ hạn/.test(wrap.innerHTML) && /Trễ 3 giờ 10 phút/.test(wrap.innerHTML) && /báo: TP CSKH/.test(wrap.innerHTML), 'hien tre + bao truong phong: ' + wrap.innerHTML.slice(0, 300));
  ok(/Đổi &lt;b&gt;nhẫn/.test(wrap.innerHTML) && !/<b>nhẫn/.test(wrap.innerHTML), 'escape HTML tieu de');
  ok((wrap.innerHTML.match(/_tktDone\(/g) || []).length === 1 && !/Xong rồi/.test(wrap.innerHTML), 'mac dinh chi ticket mo, nut Dong chi o ticket mo');
  ctx._tktSetStatus('done'); ok(/Xong rồi/.test(wrap.innerHTML) && /Xong đúng hạn/.test(wrap.innerHTML) && !/_tktDone\(/.test(wrap.innerHTML), 'tab Da dong');
  ok(/tk-assignee/.test(wrap.innerHTML), 'quan ly thay o Giao cho');
  calls.length = 0; await ctx._tktCreate();
  ok(calls.some(c => /POST/.test(c) && /"action":"ticketSave"/.test(c) && /"type":"doi_tra"/.test(c) && /"token":"TK"/.test(c)), 'tao gui dung action: ' + calls.join('|'));
  calls.length = 0; await ctx._tktDone('TK1');
  ok(calls.some(c => /"action":"ticketDone"/.test(c) && /"id":"TK1"/.test(c) && /"note":"xong"/.test(c)), 'dong gui dung id/ghi chu');
  vals['tk-title'] = '  '; calls.length = 0; await ctx._tktCreate(); ok(!calls.some(c => /POST/.test(c)) && calls.some(c => /tiêu đề/.test(c)), 'thieu tieu de khong gui');
  resp = { ok: false, error: 'unknown action ticketList' }; ctx._tkt.data = null; await ctx._tktLoad(); ok(/unknown action/.test(wrap.innerHTML), 'GAS cu bao loi trong tab');
  console.log('ALL TICKET-UI TESTS PASSED');
})().catch(e => { console.error('FAIL', e); process.exit(1); });

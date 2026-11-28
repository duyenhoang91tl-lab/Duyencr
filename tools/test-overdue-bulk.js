#!/usr/bin/env node
// Test R6c-1 — màn Quá hạn chọn nhiều + dời hàng loạt (js/72-overdue-bulk.js, dùng luật dời của js/71). Chạy: node tools/test-overdue-bulk.js
// File có process.exit ở CUỐI — thêm ca mới chèn TRƯỚC.
const fs = require('fs'), path = require('path');
const sc = require('../js/71-sched-calendar.js');
global.scMoveCheck_ = sc.scMoveCheck_;
const m = require('../js/72-overdue-bulk.js');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const S = (o) => Object.assign({ id: 'a', phone: '0900000001', type: 'goi', date: '2026-11-10', note: '', done: false }, o);
const T0 = '2026-11-15';
const items = [S({ id: '1' }), S({ id: '2', type: 'cs' }), S({ id: '3', autoDao: true }), S({ id: '4', type: 'birthday' })];

let p = m.obPlan_(items, ['1', '2', '3', '4'], T0, T0);
ok(p.movable.join() === '1,2' && p.skippedCount === 2, 'dời hôm nay: bỏ qua lịch tự động + sinh nhật');
ok(Object.keys(p.skipped).length === 2, 'lý do bỏ qua được gộp theo loại');
p = m.obPlan_(items, ['1', 'khong-co'], T0, T0);
ok(p.movable.join() === '1' && p.skippedCount === 1, 'id không tồn tại → bỏ qua, không văng lỗi');
p = m.obPlan_(items, ['1'], '2026-11-14', T0);
ok(p.movable.length === 0 && p.skippedCount === 1, 'ngày đích trong quá khứ → không dời');
p = m.obPlan_(items, [], T0, T0); ok(p.movable.length === 0 && p.skippedCount === 0, 'chưa chọn gì → rỗng');
p = m.obPlan_(items, ['1'], '2026-11-10', T0); ok(p.movable.length === 0 && p.skippedCount === 0, 'cùng ngày cũ → không làm gì, không báo lỗi');

const cs = m.obByCs_([S({ id: 'a' }), S({ id: 'b' }), S({ id: 'c' }), S({ id: 'd' })], it => ({ a: 'Oanh', b: 'Oanh', c: 'Thúy, Oanh', d: '' }[it.id]));
ok(cs[0].name === 'Oanh' && cs[0].ids.join() === 'a,b,c', 'CS ghi gộp "Thúy, Oanh" tính cho từng người; sắp nhiều → ít');
ok(cs.some(x => x.name === '(chưa gán)' && x.ids.join() === 'd') && cs.some(x => x.name === 'Thúy'), 'không có CS → "(chưa gán)"');

let JSDOM = null; try { JSDOM = require('jsdom').JSDOM; } catch (e) { console.log('(bỏ qua phần DOM: chưa có jsdom)'); }
const finish = () => { console.log(bad ? `\n${bad} LỖI` : '\nTẤT CẢ ĐẠT'); process.exit(bad ? 1 : 0); };
if (!JSDOM) finish();
else (async () => {   // 26/11: obMoveSelected đổi sang async (uiConfirm) nên phải đợi sau khi bấm
  const strip = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/if \(typeof module[^\n]*\n?[\s\S]*$/, '');
  const dom = new JSDOM('<div id="overdue-grid"></div>', { runScripts: 'outside-only' }); const w = dom.window;
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dd = n => { const x = new Date(); x.setDate(x.getDate() + n); return ymd(x); };
  w.eval('var schedules = ' + JSON.stringify([S({ id: 'p1', phone: '0911', date: dd(-3) }), S({ id: 'p2', phone: '0922', date: dd(-2), type: 'cs' }), S({ id: 'p3', phone: '0933', date: dd(-2), autoDao: true }), S({ id: 'f1', phone: '0944', date: dd(2) })]) +
         ', careData = { "0911": { schedGoi: "' + dd(-3) + '", cs: "Oanh" }, "0922": { cs: "Oanh" }, "0933": { cs: "Thúy" } };');
  const log = { saved: [], sync: [], audit: 0 };
  w._csFilterListMatch = () => []; w._schedCsFilter = () => true; w.esc = s => String(s); w.confirm = () => true; w.uiConfirm = async () => true; w.toast = x => { w._toast = x; };
  w._schedResponsibleCS = it => (w.eval('careData') [it.phone] || {}).cs || '';
  w.saveLS = k => log.saved.push(k); w._touchCare = () => {}; w.logAudit = () => { log.audit++; }; w.gsUrl = 'http://x'; w.queueCareSync = p => log.sync.push(p);
  w.updateSchedBadges = () => {}; w.renderReminderPanel = () => {}; w.renderScheduleTab = () => { w._schedRendered = true; };
  w.eval(strip('js/71-sched-calendar.js'));
  // renderOverdueTab giả: vẽ các dòng quá hạn như js/02 (có data-id)
  w.eval(`window.renderOverdueTab = function(){ var t = scYmd_(new Date()); var its = schedules.filter(function(x){ return x.date < t && !x.done; });
    document.getElementById('overdue-grid').innerHTML = its.map(function(it){ return '<div class="sched-item sched-overdue" data-id="' + it.id + '" data-phone="' + it.phone + '">' + it.phone + '</div>'; }).join(''); };`);
  w.eval(strip('js/72-overdue-bulk.js'));
  w.renderOverdueTab();
  const g = w.document.getElementById('overdue-grid');
  ok(g.querySelectorAll('.ob-ck').length === 3 && g.querySelector('#ob-bar'), 'mỗi dòng quá hạn có ô tích + có thanh công cụ');
  ok(/Tồn theo CS/.test(g.querySelector('.ob-cs').textContent) && g.querySelector('[data-cs="Oanh"] b').textContent === '2', 'tóm tắt tồn theo CS (Oanh 2)');
  ok(g.querySelector('[data-ob="today"]').disabled === true, 'chưa chọn → nút dời bị khoá');
  g.querySelector('[data-ob="cs"][data-cs="Oanh"]').click();
  ok(w.eval('_ob.sel.join()') === 'p1,p2' && g.querySelector('[data-ob="today"]').disabled === false, 'bấm tên CS → chọn hết lịch của CS đó, mở khoá nút');
  g.querySelector('.ob-ck[data-id="p2"]').click();
  ok(w.eval('_ob.sel.join()') === 'p1', 'bỏ tích 1 dòng');
  g.querySelector('#ob-all').click(); ok(w.eval('_ob.sel.length') === 3, 'Chọn tất cả');
  g.querySelector('[data-ob="today"]').click(); await new Promise(r => setTimeout(r, 15));
  const sch = w.eval('schedules');
  const t0 = w.eval('scYmd_(new Date())');
  ok(sch.find(x => x.id === 'p1').date === t0 && sch.find(x => x.id === 'p2').date === t0, 'dời 2 lịch sang hôm nay');
  ok(sch.find(x => x.id === 'p3').date === dd(-2), 'lịch tự động p3 giữ nguyên (bị bỏ qua)');
  ok(w.eval('careData["0911"].schedGoi') === t0, 'ô schedGoi của khách đi theo');
  ok(log.sync.sort().join() === '0911,0922' && log.audit === 2, 'đồng bộ đúng 2 khách, ghi nhật ký 2 lần');
  ok(log.saved.indexOf('ome_sched') !== -1 && log.saved.indexOf('ome_schedules') !== -1 && log.saved.indexOf('ome_care') !== -1, 'lưu đủ 2 khoá lịch + care');
  ok(g.querySelectorAll('.ob-ck').length === 1 && w._schedRendered === true, 'vẽ lại: chỉ còn 1 dòng quá hạn; màn Tuần/Ngày được vẽ lại');
  ok(w.eval('_ob.sel.length') === 0, 'xoá lựa chọn sau khi dời');
  finish();
})();

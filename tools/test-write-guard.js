#!/usr/bin/env node
// Test báo lỗi ghi dữ liệu (js/97) + chốt chặn: không còn fetch POST ghi dữ liệu nào nuốt lỗi bằng .catch rỗng. Chạy: node tools/test-write-guard.js
const fs = require('fs'), vm = require('vm'), path = require('path');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const alerts = [], toasts = []; let now = 1000000;
const ctx = { console: { warn() {} }, uiAlert: m => alerts.push(m), toast: m => toasts.push(m), Date: { now: () => now } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/97-write-guard.js'), 'utf8'), ctx);
const resp = (body, over) => Object.assign({ ok: true, status: 200, clone() { return { json: async () => body }; } }, over || {});
const tick = () => new Promise(r => setTimeout(r, 5));
(async () => {
  const r1 = resp({ ok: true }); ok(vm.runInContext('_writeCheck_("x")', ctx)(r1) === r1 && !alerts.length, 'ghi thành công: không báo, trả lại Response nguyên vẹn');
  await tick(); ctx.__r = resp({ ok: false, error: 'FORBIDDEN' }); vm.runInContext('_writeCheck_("danh sách Team")(__r)', ctx); await tick();
  ok(alerts.length === 1 && alerts[0].includes('danh sách Team') && alerts[0].includes('FORBIDDEN'), 'máy chủ trả ok:false → báo kèm lý do');
  ctx.__r = resp({ error: 'lỗi gì đó' }); vm.runInContext('_writeCheck_("việc khác")(__r)', ctx); await tick(); ok(alerts.length === 2, 'chỉ có trường error cũng bị báo');
  vm.runInContext('_writeCheck_("HTTP")(__h)', Object.assign(ctx, { __h: { ok: false, status: 500 } })); ok(alerts.length === 3 && alerts[2].includes('HTTP 500'), 'HTTP lỗi → báo mã');
  vm.runInContext('_writeCatch_("mạng")(new Error("Failed to fetch"))', ctx); ok(alerts.length === 4 && alerts[3].includes('Failed to fetch'), '.catch mạng → báo');
  vm.runInContext('_writeCatch_("mạng")(new Error("again"))', ctx); ok(alerts.length === 4, 'cùng việc trong 20 giây → không báo lại (không dồn dập khi mất mạng)');
  now += 21000; vm.runInContext('_writeCatch_("mạng")(new Error("again"))', ctx); ok(alerts.length === 5, 'sau 20 giây báo lại');
  ctx.uiAlert = undefined; vm.runInContext('_writeFail_("không có hộp thoại")', ctx); ok(toasts.length === 1 && toasts[0].startsWith('⚠'), 'không có uiAlert → rơi về toast');
  ok(vm.runInContext('_writeCheck_("x")(null)', ctx) === null && vm.runInContext('_writeCheck_("x")({})', ctx) !== undefined, 'đầu vào lạ (null/{}) không ném lỗi');
  // chốt chặn tĩnh
  const root = path.join(__dirname, '..', 'js'); const guarded = [];
  fs.readdirSync(root).filter(f => f.endsWith('.js')).forEach(f => {
    const t = fs.readFileSync(path.join(root, f), 'utf8'); let m; const re = /fetch\(/g;
    while ((m = re.exec(t))) {
      const seg = t.slice(m.index, m.index + 700);
      if (!/method\s*:\s*['"]POST/.test(seg)) continue;
      const act = (seg.match(/action\s*:\s*['"](\w+)/) || [])[1] || '';
      if (/^(saveAudit|notifRead|notifMention|setSetting)$/.test(act)) continue;   // nhật ký/đánh dấu đã đọc/cấu hình có toast riêng: được phép bỏ qua
      if (/\.catch\(\s*(function\s*\(\s*\w*\s*\)\s*\{\s*\}|\(\s*\w*\s*\)\s*=>\s*\{\s*\}|\w+\s*=>\s*\{\s*\})\s*\)/.test(seg.slice(0, seg.indexOf(')\n') > 0 ? 700 : 700))) guarded.push(f + ' ' + act);
    }
  });
  ok(guarded.length === 0, 'không còn fetch POST ghi dữ liệu nào nuốt lỗi bằng .catch rỗng' + (guarded.length ? ': ' + guarded.join('; ') : ''));
  const t07 = fs.readFileSync(path.join(root, '07-openassignmodal.js'), 'utf8'), t05 = fs.readFileSync(path.join(root, '05-fn-saveeditphone.js'), 'utf8'), t26 = fs.readFileSync(path.join(root, '26-loadtasks.js'), 'utf8');
  ok(!/setOrderCareCSBatch[^\n]*catch\(e\) \{\}/.test(t07) && !/deleteTask'[^\n]*\n\s*\}catch\(e\)\{\}/.test(t26) && !/_deleted_[\s\S]{0,400}\} catch\(e\) \{\}/.test(t05), 'chia data / xoá công việc / đổi SĐT không còn catch rỗng');
  console.log(bad ? bad + ' LỖI' : 'ĐẠT'); process.exit(bad ? 1 : 0);
})();

#!/usr/bin/env node
// Test xemChenhLechSoDon: liet ke don thuoc Bao cao A nhung KHONG vao ty le chot (BH khong doanh thu / kenh chua khop Page Pancake / chua co du lieu Pancake ngay do).
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const grab = (name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + '\n  co :' + JSON.stringify(a) + '\n  can:' + JSON.stringify(b));
const row = (ngay, kenh, tt, gia, extra) => Object.assign({ ngayTao: ngay, kenhBan: kenh, trangThai: tt || 'Da giao', saleBan: 'a', nguoiTao: 'a', giaTriDon: gia, giaTriCoc: 0, giaTriChenh: 0, phanLoai: '', id: 'x' }, extra || {});
const ctx = { Logger: { log() {} },
  readDTTong_: () => [row('05/10/2026', 'FB', 'Da giao', 1000000), row('05/10/2026', 'FB', 'Da giao', 0, { bhZero: true }), row('06/10/2026', 'Quay', 'Da giao', 2000000), row('07/10/2026', 'FB', 'Da giao', 500000),
    row('05/10/2026', 'FB', 'Huy', 700000), row('05/10/2026', 'FB', 'Da giao', 900000, { saleBan: 'b' }), row('09/11/2026', 'FB', 'Da giao', 1)],
  readPancakePageMap_: () => ({ P1: 'FB' }), _pkTrackedDatesByPageAndSale_: () => ({ datesByPage: { P1: { '2026-10-05': true, '2026-10-06': true } } }),   // khong co du lieu Pancake ngay 07/10
  _dateStrToVnYmd_: (x) => x, _vnYmd_: (d) => d.toISOString().slice(0, 10),
  parseVNDate_: (s) => { const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null; },
  dateInRange_: (dt, f, t) => { if (!dt) return false; const y = dt.toISOString().slice(0, 10); return (!f || y >= f) && (!t || y <= t); },
  _isExcludedOrderStatus_: (t) => /^huy/i.test(String(t || '')), splitMulti_: (x) => String(x || '').split(',').map((s) => s.trim()).filter(Boolean),
  _expandSaleFilterWithPancakeAliases_: (n) => n, _normTxt_: (s) => String(s || '').toLowerCase().trim(), _dtOrderRevenue_: (r) => r.giaTriDon };
vm.createContext(ctx); vm.runInContext(grab('_isNumericTag_') + '\n' + grab('_diagSoDonAvsChot_'), ctx);   // _isNumericTag_: loai STT Pancake (token toan so) khoi ten sale
let d = ctx._diagSoDonAvsChot_({ dateFrom: '2026-10-01', dateTo: '2026-10-31', sale: [] });
eq([d.matched, d.counted, d.notCounted], [5, 2, 3], 'don huy va ngoai ky bi loai khoi A (5 don); chi 2 don vao ty le chot');
eq(d.byReason, { 'Đơn bảo hành BH không doanh thu': 1, 'Kênh "Quay" chưa khớp Page Pancake nào': 1, 'Chưa có dữ liệu Pancake ngày 2026-10-07 của kênh "FB"': 1 }, 'ly do tung don');
ok(d.list.length === 3 && d.list.every((x) => x.lyDo), 'liet ke 3 don kem ly do');
// BH + kenh khong khop cung luc -> ghi ca 2 ly do, dem vao ca 2 nhom ly do, nhung chi 1 don
ctx.readDTTong_ = () => [row('05/10/2026', 'Quay', 'Da giao', 0, { bhZero: true })]; d = ctx._diagSoDonAvsChot_({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
eq([d.matched, d.notCounted, Object.keys(d.byReason).length, d.list[0].lyDo.includes(' + ')], [1, 1, 2, true], 'don vua BH 0d vua kenh khong khop: 1 don, 2 ly do');
// loc Sale
ctx.readDTTong_ = () => [row('05/10/2026', 'FB', 'Da giao', 1, { saleBan: 'a' }), row('05/10/2026', 'FB', 'Da giao', 1, { saleBan: 'b, c' })];
d = ctx._diagSoDonAvsChot_({ dateFrom: '2026-10-01', dateTo: '2026-10-31', sale: ['b'] }); eq([d.matched, d.counted], [1, 1], 'loc sale: chi don co sale b');
console.log('ALL DIAG SO DON TESTS PASSED');

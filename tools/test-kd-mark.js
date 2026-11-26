#!/usr/bin/env node
// Test GAS gan co kd (phong kinh doanh) cho muc 1-2 Bao cao A/B: _posKMembers_(month,true) + _srKdMark_. Chay: node tools/test-kd-mark.js
const fs = require('fs'), vm = require('vm');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
const grab = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('missing ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const settings = {
  saleChannels: JSON.stringify({ 'Ninh Nga': 'online', 'Anh Trinh': 'offline', 'Thương BT': 'probation', 'Nguyệt TTA': 'probation', 'Tuoi Pham': 'something-else' }),
  saleChannelPeriods: JSON.stringify({ 'Moi Online': [{ from: '2026-12-01', channel: 'online' }] }) };
// khoa "cung 1 nguoi": ten Pancake thuongBT <-> Thương BT ; ngocNM thuoc phong ban Sale (file nhan su)
const alias = { 'thuongbt': 'p1', 'thương bt': 'p1', 'nguyettta1995': 'p2', 'nguyệt tta': 'p2', 'ninhnga99': 'p3', 'ninh nga': 'p3', 'anhtrinh1995': 'p4', 'anh trinh': 'p4', 'ngocnm': 'p5', 'ngoc nm': 'p5', 'tuoipham1993': 'p6', 'tuoi pham': 'p6', 'moi online': 'p7' };
const ctx = vm.createContext({ Logger: { log() {} }, getSetting_: k => settings[k] || '', readSaleGroups_: () => [], readDeptList_: () => [{ key: 'sale', label: 'Sale' }],
  readSaleDepts_: () => ({ byNorm: { 'ngoc nm': { key: 'sale', name: 'Ngoc NM' }, 'ke toan': { key: 'ketoan', name: 'Ke Toan' } } }),
  _salePersonKeyFn_: () => n => alias[String(n).toLowerCase()] || '', _ymLastDay_: m => m + '-30', _normTxt_: x => String(x || '').trim().toLowerCase(),
  _dateStrToVnYmd_: x => x, _vnYmd_: () => '2026-11-21' });
vm.runInContext(['_posKMembers_', '_srKdMarkRows_', '_srKdMark_'].map(grab).join('\n'), ctx);
const M0 = vm.runInContext('_posKMembers_("2026-11")', ctx), M1 = vm.runInContext('_posKMembers_("2026-11", true)', ctx);
ok(Object.keys(M0).sort().join() === 'p3,p4,p5', 'Bao cao K (khong co tham so): chi Online + Van phong + phong Sale, KHONG co Thu viec (giu nguyen hanh vi cu)');
ok(Object.keys(M1).sort().join() === 'p1,p2,p3,p4,p5', 'A/B (withProbation): them Thu viec p1 (thuongBT), p2 (nguyetTTA1995)');
ok(M1.p1 === 'Thử việc' && M1.p5 === 'Phòng Sale', 'nhan nhom: Thu viec / Phong Sale');
const rows = ['ninhnga99', 'thuongBT', 'nguyetTTA1995', 'ngocNM', 'tuoipham1993', 'Duyen Hoang', 'Public API', 'Kieu Ngoc', 'thuyNTT1991'].map(n => ({ name: n }));
ctx.rows = rows;
const out = vm.runInContext('_srKdMark_(rows, {dateTo:"2026-11-20"})', ctx);
const kd = n => out.find(r => r.name === n).kd;
ok(kd('ninhnga99') && kd('thuongBT') && kd('nguyetTTA1995') && kd('ngocNM'), 'cac ban moi thuongBT / nguyetTTA1995 / ngocNM duoc gan kd:true (khop ten Pancake <-> Sale qua khoa nguoi)');
ok(!kd('tuoipham1993') && !kd('Duyen Hoang') && !kd('Public API') && !kd('Kieu Ngoc'), 'phan loai khac / khong thuoc phong -> kd:false');
ok(!kd('thuyNTT1991'), 'chua khop ten (thuyNTT1991 khong co trong khoa nguoi) -> kd:false (de Duyen thay vi sao: chua khop)');
settings.saleChannels = '{}'; ctx.rows2 = [{ name: 'a' }]; vm.runInContext('globalThis.__o = _srKdMark_(rows2, {dateTo:"2026-11-20"})', ctx);
ok(ctx.__o[0].kd === false, 'channels rong nhung con phong Sale: van co thanh vien -> ten la khong khop bi danh dau kd:false');
// khong ai trong pham vi (khong channel, khong dept) -> KHONG gan kd
ctx.getSetting_ = () => ''; ctx.readSaleDepts_ = () => ({ byNorm: {} }); ctx.rows3 = [{ name: 'a' }, { name: 'b' }]; vm.runInContext('globalThis.__o3 = _srKdMark_(rows3, {dateTo:"2026-11-20"})', ctx);
ok(ctx.__o3.every(r => r.kd === undefined), 'khong co thanh vien nao -> khong gan kd (client giu het, khong ra bao cao trong)');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

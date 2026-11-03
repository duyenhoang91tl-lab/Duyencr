#!/usr/bin/env node
// Hoa hong % tung sale tu orders.json — chay DUNG ham CRM (js/01 _computeCommissionData_ + _resolveCommissionRate_ + luat vang 10k/14k kenh Nguon).
// Dung: node tools/bonus-t10/calc_commission.js <thu_muc_work>   (can orders.json + channels.json tu extract_orders.py)
// Luat (Duyen 2026-11-03): Online >=15tr 1,5% / <15tr 1%; Offline >=15tr 1% / <15tr 0,8% (mac dinh CRM); nguon "NGUON" vang 10k 1,5% / 14k 1%;
// my pham (sheet DON MP, nguon "Facebook") 1%. Xuat commission-result.json: moi sale co doanh thu + hoa hong theo TUNG nhom.
const fs = require('fs'), vm = require('vm'), path = require('path');
const W = process.argv[2] || '.';
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
const fn = (src, n) => { const i = src.indexOf('\nfunction ' + n + '('); if (i < 0) throw new Error('khong thay ' + n); return src.slice(i + 1, src.indexOf('\n}\n', i) + 3); };
const j01 = R('js/01-fn-splitmulti.js');
const line = (re) => { const m = j01.match(re); if (!m) throw new Error('khong thay ' + re); return m[0]; };
// Don MP (my pham) luon la nguon "Facebook" (1%); don NGUON: them ma san pham vao ten SP de bat "10K"/"14K" (ma LMVM -10K, CV10K-...)
const orders = JSON.parse(fs.readFileSync(W + '/orders.json', 'utf8')).map(o => Object.assign({}, o, {
  nguonDon: o.sheet === 'ĐƠN MP' ? 'Facebook' : (/\/\s*NGUỒN\s*\(/i.test(o.nguonDon || '') ? 'Nguồn' : o.nguonDon),
  sanPham: (o.sanPham || '') + ' ' + (o.maSanPham || '') }));
const chRaw = JSON.parse(fs.readFileSync(W + '/channels.json', 'utf8'));
chRaw['ngocNB2003saleoff'] = 'offline';   // Sale thu viec Ngoc (tu 14/10): dung muc Offline (Duyen/KT xac nhan neu khac)
const ctx = { loadLS: () => null, SALE_CHANNELS: chRaw, teams: [], INDIVIDUAL_RATES: {}, CHANNEL_COMMISSION_RATES: {}, COMMISSION_THRESHOLD: 15000000 };
vm.createContext(ctx);
vm.runInContext([line(/var GOLD_RULE_CHANNELS = [^\n]*/), line(/var GOLD_RULE_MATERIALS = [^\n]*/), 'var _SALE_ALIAS_MAP = {};',
  line(/function isNumTagSale_\(x\)\{[^\n]*\}/)].concat(['splitMulti_', '_cfgAliasesOf', '_cfgByAlias', '_saleChannelOf_', '_teamRateForName_', '_resolveCommissionRate_', '_goldFold_', '_goldChannelRule_', '_channelCommissionRate_', '_computeCommissionData_'].map(n => fn(j01, n))).join('\n'), ctx);
ctx.O = orders.filter(o => !/hủy|huỷ/i.test(o.ghiChu || '') || true);
const c = JSON.parse(vm.runInContext('JSON.stringify(_computeCommissionData_(O))', ctx));
const out = c.bySale.map(s => {
  const kb = s.channelBreakdown || {}, g10 = { revenue: 0, commission: 0 }, g14 = { revenue: 0, commission: 0 }, mp = { revenue: 0, commission: 0 }, other = { revenue: 0, commission: 0 };
  Object.keys(kb).forEach(k => { const t = /10k/i.test(k) ? g10 : /14k/i.test(k) ? g14 : /^facebook$/i.test(k.trim()) ? mp : other; t.revenue += kb[k].revenue; t.commission += kb[k].revenue * kb[k].rate / 100; });
  return { name: s.name, channel: chRaw[s.name] || '', rateAbove15: s.rateAbove15, rateBelow15: s.rateBelow15, revAbove: s.revenueAbove15, revBelow: s.revenueBelow15, nAbove: s.ordersAbove15, nBelow: s.ordersBelow15,
    commAbove: s.revenueAbove15 * s.rateAbove15 / 100, commBelow: s.revenueBelow15 * s.rateBelow15 / 100, gold10: g10, gold14: g14, mp: mp, otherChannel: other, total: s.commission };
});
fs.writeFileSync(W + '/commission-result.json', JSON.stringify({ rows: out, orders: orders.length }));
console.log('don:', orders.length, '| sale:', out.length, '| tong hoa hong CRM:', Math.round(out.reduce((a, r) => a + r.total, 0)));
out.filter(r => r.channel).sort((a, b) => b.total - a.total).forEach(r => console.log(r.name.padEnd(20), r.channel.padEnd(9), String(Math.round(r.commAbove)).padStart(10), String(Math.round(r.commBelow)).padStart(10), String(Math.round(r.gold10.commission + r.gold14.commission)).padStart(8), String(Math.round(r.mp.commission)).padStart(8), String(Math.round(r.total)).padStart(10)));

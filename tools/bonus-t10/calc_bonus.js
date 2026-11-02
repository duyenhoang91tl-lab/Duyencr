#!/usr/bin/env node
// Buoc 2: chay DUNG ham _computeBonusData_ cua CRM (js/12) tren orders.json -> bonus-result.json
// Dung: node tools/bonus-t10/calc_bonus.js <thu_muc_work>   (can orders.json + channels.json tu extract_orders.py)
// 11 chuong trinh = mau "Thuong online" chinh thuc trong js/13 (_bpSeedOfficialOnlineTemplate_). CT thuc te Duyen dang bat trong CRM
// (Settings) co the khac -> so lieu la UOC TINH doi chieu voi Bao cao G, khong thay the.
const fs = require('fs'), vm = require('vm'), path = require('path');
const W = process.argv[2] || '.';
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
const fn = (src, n) => { const i = src.indexOf('\nfunction ' + n + '('); if (i < 0) throw new Error('khong thay ' + n); return src.slice(i + 1, src.indexOf('\n}\n', i) + 3); };
const j12 = R('js/12-fn-rendersalesreporttabe.js'), j01 = R('js/01-fn-splitmulti.js'), j05 = R('js/05-fn-saveeditphone.js'), j27 = R('js/27-fn-bonuscore.js'), j62 = R('js/62-sale-channel-periods.js');
const orders = JSON.parse(fs.readFileSync(W + '/orders.json', 'utf8')).filter(o => !o.baoHanh);   // don bao hanh khong tinh thuong (quy tac Duyen)
const chRaw = JSON.parse(fs.readFileSync(W + '/channels.json', 'utf8'));
const base = () => ({ id: '', name: '', dateFrom: '', dateTo: '', audience: { online: true, offline: true }, product: '', requireProduct: '', extraNote: '', exclusionNote: '',
  tier: { enabled: false, rows: [] }, revenue: { enabled: false, scope: 'order', min: '', max: '' }, firstOrder: { enabled: false, amount: '' }, probationDay: { enabled: false, from: '', to: '' }, sources: [], prodRules: { enabled: false, items: [] }, bonusAmount: '' });
const mk = o => Object.assign(base(), o);
const rev = (scope, min, amt, o) => mk(Object.assign({ revenue: { enabled: true, scope, min, max: '' }, bonusAmount: amt }, o));
const PROGRAMS = [
  rev('order', 10e6, 20000, { name: 'Đơn từ 10tr (combo 2 sản phẩm)' }),
  rev('order', 15e6, 30000, { name: 'Đơn từ 15tr (combo 3 sản phẩm)' }),
  rev('order', 20e6, 40000, { name: 'Đơn từ 20tr (combo 4 sản phẩm)' }),
  rev('order', 20e6, 30000, { name: 'Bill vòng mix charm — DT từ 20tr', requireProduct: 'vòng' }),
  rev('order', 15e6, 20000, { name: 'Bill vòng mix charm — đơn từ 15tr', requireProduct: 'vòng' }),
  rev('day', 60e6, 50000, { name: 'Thưởng doanh số/ngày — đạt từ 60tr' }),
  rev('day', 100e6, 100000, { name: 'Thưởng doanh số/ngày — đạt từ 100tr' }),
  mk({ name: 'Tỳ Hưu Thiên Lộc Moon', product: 'Tỳ hưu thiên lộc Moon, Thiên Lộc Moon, THMoon', bonusAmount: 10000 }),
  mk({ name: 'Tỳ Hưu Thiên Lộc Tourmaline (Hồng/Xanh)', product: 'Tourmaline Hồng, Tourmaline Xanh', bonusAmount: 8000 }),
  mk({ name: 'Tỳ Hưu Thiên Lộc Aquamarine', product: 'Aquamarine', bonusAmount: 8000 }),
  rev('order', 21.5e6, 100000, { name: 'Tourmaline cao cấp — đơn từ 21tr500', dateFrom: '2026-09-21' }),
  rev('order', 31.5e6, 200000, { name: 'Tourmaline cao cấp — đơn từ 31tr500', dateFrom: '2026-09-21' })
];
// kenh theo ten: khop khong phan biet hoa/thuong voi the Pos
const SC = {}; Object.keys(chRaw).forEach(k => { SC[k] = chRaw[k]; });
const ctx = { loadLS: () => null, SALE_CHANNELS: SC, SALE_CHANNEL_PERIODS: {}, BONUS_PROGRAMS: PROGRAMS, _srMoney: n => String(Math.round(n)), accounts: [], _acctNamesOf: () => [] };
vm.createContext(ctx);
vm.runInContext(j27 + '\n' + fn(j05, 'esc') + fn(j01, 'splitMulti_') + j01.match(/function isNumTagSale_\(x\)\{[^\n]*\}/)[0] + '\nvar _SALE_ALIAS_MAP = {};\n' + fn(j01, '_cfgAliasesOf') + fn(j01, '_cfgByAlias') + fn(j01, '_saleChannelOf_') +
  ['_scpNorm_', '_scpListOf_', '_saleChannelOn_'].map(n => fn(j62, n)).join('\n') +
  ['_bonusProgramApplies_', '_ddmmyyyyToYmd_', '_daysSinceStart_', '_saleStartDate_', '_bonusProductQty_', '_bonusNamesOfOrder_', '_orderRevenueShares_', '_bonusNormSrc_', '_bonusSourceOk_', '_bonusOrderProductQtys_', '_bonusAggSources_', '_bonusRequireKw_', '_bonusRequireProductOk_', '_computeBonusData_'].map(n => fn(j12, n)).join('\n'), ctx);
ctx.O = orders;
const res = JSON.parse(vm.runInContext('JSON.stringify(_computeBonusData_(O))', ctx));
res.channels = chRaw; res.nOrders = orders.length; res.programs = PROGRAMS.map(p => p.name);
fs.writeFileSync(W + '/bonus-result.json', JSON.stringify(res));
console.log('don tinh:', orders.length, '| tong thuong:', res.total, '| sale co thuong:', res.bySale.length, '| don can kiem tay:', res.review.length);
res.bySale.slice(0, 40).forEach(s => console.log(s.name.padEnd(22), String(s.total).padStart(9), (chRaw[s.name] || '(chua phan loai)')));

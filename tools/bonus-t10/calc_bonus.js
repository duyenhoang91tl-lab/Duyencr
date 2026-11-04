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
const rawOrders0 = JSON.parse(fs.readFileSync(W + '/orders.json', 'utf8')).filter(o => !o.baoHanh && o.sheet !== 'ĐƠN MP' && !/\/\s*NGUỒN\s*\(/i.test(o.nguonDon || ''));   // bao hanh + don MP (my pham) + nguon don 'Facebook / NGUON (...)' van bi LOAI nhu cu (Duyen xac nhan 2026-11-03)
const rawOrders = rawOrders0;
// GOP DON POS TACH (Duyen 2026-11-04): don Base "254T10/2026" len Pos tach 2 don, ghi chu "254T10/2026/1 TACH..", "254T10/2026/2 TACH.." -> la MOT don,
// doanh thu = tong cac phan (9.000.000 + 8.500.000 = 17.500.000 -> moc 15tr). NGUYEN NHAN GOC truoc day: script nay doc tung dong Pos nhu 1 don rieng nen moi phan <10tr -> thuong 0.
// Dung DUNG ham/regex cua CRM (gas_v13.js _tachDonParse_ / TACH_DON_RE_SRC_ / _mergeTachDon_): dong Huy/Hoan khong tham gia gop; trung ca dong (cung /so, SDT-gia-sp) chi giu 1.
const gasSrc = R('gas_v13.js');
const tachRe = new RegExp(eval(gasSrc.match(/var TACH_DON_RE_SRC_ = (\'.*\');/)[1]), 'i');
const tachParse = note => { const str = String(note || ''); if (str.indexOf('/') < 0) return null; const m = tachRe.exec(str); if (!m) return null; let yr = m[3]; if (yr.length === 2) yr = '20' + yr; return { key: (m[2] + '/' + yr).replace(/\s+/g, '').toUpperCase(), n: parseInt(m[4], 10) }; };
const excludedSt = v => /^(huy|hoan|da huy|da hoan|dang hoan|chuyen hoan)/.test(String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim());
function mergeTach(list) {
  const out = [], groups = {}, groupList = [];
  list.forEach(o => {
    const tp = excludedSt(o.trangThai) ? null : tachParse(o.ghiChu);
    if (!tp) { out.push(o); return; }
    let g = groups[tp.key]; if (!g) { g = groups[tp.key] = { pos: out.length, parts: [], seen: {} }; out.push(null); groupList.push(tp.key); }
    const sig = [tp.n, o.maDon, o.giaTriDon].join('|'); if (g.seen[sig]) return; g.seen[sig] = 1; g.parts.push(o);
  });
  const info = [];
  groupList.forEach(k => {
    const g = groups[k], ps = g.parts;
    if (ps.length === 1) { out[g.pos] = ps[0]; return; }
    const m = Object.assign({}, ps[0]), sales = [], seen = {};
    ps.forEach(p => String(p.saleBan || '').split(',').forEach(x => { x = x.trim(); if (x && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = 1; sales.push(x); } }));
    m.giaTriDon = ps.reduce((a, p) => a + (Number(p.giaTriDon) || 0), 0); m.saleBan = sales.join(', ');
    m.sanPham = ps.map(p => p.sanPham).filter(Boolean).join(', '); m.maSanPham = ps.map(p => p.maSanPham).filter(Boolean).join(';'); m.soLuong = ps.map(p => p.soLuong).filter(Boolean).join(', ');
    m.ghiChu = ps.map(p => p.ghiChu).filter(Boolean).join(' | '); m.tachKey = k; m.tachSoDon = ps.length; m.tachGiaTri = ps.map(p => p.giaTriDon);
    out[g.pos] = m; info.push({ key: k, firstId: ps[0].id, ids: ps.map(p => p.id), maDon: ps.map(p => p.maDon), tong: m.giaTriDon });
  });
  mergeTach.info = info; return out;
}
// GOP DON "GHEP / SHIP CUNG DON" (Duyen 2026-11-04): don B co ghi chu "NG139T10/2026 GHEP CUNG DON 1326T10/2026" (hoac "SHIP CUNG DON ...") + don A mang ma 1326T10 CUNG MOT SALE
// = MOT bill -> cong gia tri xet moc (11.300.000 -> combo 2 SP 20.000 trong bang thuong chinh thuc "1326t10+ ng139t10"). Chi gop khi cung bo sale va 1 ben la don them "NG" (khop bang thuong chinh thuc: 1326t10+ng139t10, 1292T10+ng132t10, 693t10+NG75; con 702t10 / 807T10 tinh rieng), khong phai don Bao hanh/DMP/Huy-Hoan, doi tac co trong du lieu thang.
const sKey = o => String(o.saleBan || '').toLowerCase().split(/[,;\s]+/).filter(Boolean).sort().join(',');
const codeTok = note => { const t = new Set(); String(note || '').normalize('NFC').toUpperCase().replace(/(?<![A-Z0-9])((?:NG)?\d{1,5}T\d{1,2})(?:\/\d{2,4})?(?![A-Z0-9])/g, (m, c) => { t.add(c); return m; }); return t; };
function mergeGhep(list) {
  const GR = /(?:GH[EÉ]P|SHIP)\s+C[UÙ]NG\s+[ĐD][OƠ]N\s+((?:NG)?\d{1,5}T\d{1,2})(?![A-Z0-9])/;
  const par = list.map((_, i) => i), find = i => par[i] === i ? i : (par[i] = find(par[i])), uni = (a, b) => { par[find(a)] = find(b); };
  list.forEach((a, i) => {
    if (excludedSt(a.trangThai)) return; const m = GR.exec(String(a.ghiChu || '').normalize('NFC').toUpperCase()); if (!m) return;
    list.forEach((b, j) => { if (j === i || excludedSt(b.trangThai) || sKey(b) !== sKey(a) || b.maDon === a.maDon) return; if (codeTok(b.ghiChu).has(m[1]) && (/^NG/.test(m[1]) || [...codeTok(a.ghiChu)].some(c => /^NG/.test(c)) || [...codeTok(b.ghiChu)].some(c => /^NG/.test(c)))) uni(i, j); });   // CHI gop khi 1 trong 2 la don them "NG..." (NG139T10 + 1326T10); 2 don goc Base rieng (807T10 + 702T10) la 2 bill khac nhau
  });
  const grp = {}; list.forEach((o, i) => { const r = find(i); (grp[r] = grp[r] || []).push(i); });
  const out = [], info = [];
  list.forEach((o, i) => {
    const r = find(i), g = grp[r]; if (g.length < 2) { out.push(o); return; } if (g[0] !== i) return;
    const ps = g.map(k => list[k]), m = Object.assign({}, ps[0]);
    m.giaTriDon = ps.reduce((a, p) => a + (Number(p.giaTriDon) || 0), 0); m.sanPham = ps.map(p => p.sanPham).filter(Boolean).join(', '); m.maSanPham = ps.map(p => p.maSanPham).filter(Boolean).join(';');
    m.soLuong = ps.map(p => p.soLuong).filter(Boolean).join(', '); m.ghiChu = ps.map(p => p.ghiChu).filter(Boolean).join(' | '); m.ghepSoDon = ps.length;
    out.push(m); info.push({ key: 'GHEP ' + ps.map(p => [...codeTok(p.ghiChu)].join('+')).join(' / '), firstId: ps[0].id, ids: ps.map(p => p.id), maDon: ps.map(p => p.maDon), tong: m.giaTriDon, loai: 'ghep' });
  });
  mergeGhep.info = info; return out;
}
const afterTach = mergeTach(rawOrders), allOrders = mergeGhep(afterTach);
const mergedInfo = (mergeTach.info || []).concat(mergeGhep.info || []);
console.log('gop don tach/ghep:', mergedInfo.map(x => x.key + ' (' + x.maDon.join('+') + ' = ' + x.tong + ')').join(' | ') || 'khong co');

const orders = allOrders;
// CSKH menbui2002 (chua phan loai On/Off) duoc tinh THEM thuong theo CT Online chinh thuc CHI cho don co nguon don ten 'Facebook Pham Thu Hien'; sale khac tinh binh thuong nhu cu.
const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const EXTRA_CSKH = 'menbui2002', isFbSrc = o => ['facebook pham thu hien', 'fb pham thu hien'].indexOf(fold(o.nguonDon)) >= 0, hasName = (o, n) => String(o.saleBan || '').toLowerCase().split(/[,;\s]+/).indexOf(n) >= 0;
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
  rev('order', 21.5e6, 100000, { name: 'Tourmaline cao cấp — đơn từ 21tr500', dateFrom: '2026-09-21', requireProduct: 'TRANG SỨC NHẪN TOUR TRƠN CAO CẤP' }),
  rev('order', 31.5e6, 200000, { name: 'Tourmaline cao cấp — đơn từ 31tr500', dateFrom: '2026-09-21', requireProduct: 'TRANG SỨC NHẪN TOUR TRƠN CAO CẤP' })
];
// 5 CT mau "Co che thuong kich hoat Sale moi" (js/12 _bpSeedProbationTemplate_): GD1 don dau trong ngay (ngay 1-3), GD2 bac so don + doanh so ngay (tu ngay 4)
const PM = (o) => mk(Object.assign({ dateFrom: '2026-08-11', dateTo: '2026-12-31', audience: { online: false, offline: false } }, o));
PROGRAMS.push(
  PM({ name: 'GĐ1 — Đơn đầu tiên trong ngày (ngày 1-3 thử việc)', probationDay: { enabled: true, from: 1, to: 3 }, firstOrder: { enabled: true, amount: 50000 } }),
  PM({ name: 'GĐ2 — Bậc số đơn/ngày (từ ngày 4 thử việc)', probationDay: { enabled: true, from: 4, to: '' }, tier: { enabled: true, rows: [{ count: 2, bonus: 30000 }, { count: 3, bonus: 50000 }, { count: 5, bonus: 100000 }] } }),
  PM({ name: 'GĐ2 — Doanh số ≥25 triệu/ngày (từ ngày 4 thử việc)', probationDay: { enabled: true, from: 4, to: '' }, revenue: { enabled: true, scope: 'day', min: 25e6, max: '' }, bonusAmount: 30000 }),
  PM({ name: 'GĐ2 — Doanh số ≥50 triệu/ngày (từ ngày 4 thử việc)', probationDay: { enabled: true, from: 4, to: '' }, revenue: { enabled: true, scope: 'day', min: 50e6, max: '' }, bonusAmount: 50000 }),
  PM({ name: 'GĐ2 — Doanh số ≥80 triệu/ngày (từ ngày 4 thử việc)', probationDay: { enabled: true, from: 4, to: '' }, revenue: { enabled: true, scope: 'day', min: 80e6, max: '' }, bonusAmount: 100000 }));
// Sale THU VIEC (Duyen 2026-11-02): Ngoc bat dau tinh thuong 14/10/2026 (don dau 14/10) -> ngay 1-3 = 14,15,16/10 (don dau trong ngay van duoc thuong), tu 17/10 = ngay 4.
const PROBATION = { 'ngocNB2003saleoff': '2026-10-14' };
// kenh theo ten: khop khong phan biet hoa/thuong voi the Pos
const SC = {}; Object.keys(chRaw).forEach(k => { SC[k] = chRaw[k]; });
const SCP = {}; Object.keys(PROBATION).forEach(k => { SC[k] = 'probation'; chRaw[k] = 'probation'; SCP[k] = [{ from: PROBATION[k], channel: 'probation', bonusFrom: PROBATION[k] }]; });
const ctx = { loadLS: () => null, SALE_CHANNELS: SC, SALE_CHANNEL_PERIODS: SCP, BONUS_PROGRAMS: PROGRAMS, _srMoney: n => String(Math.round(n)), accounts: [], _acctNamesOf: () => [] };
vm.createContext(ctx);
vm.runInContext(j27 + '\n' + fn(j05, 'esc') + fn(j01, 'splitMulti_') + j01.match(/function isNumTagSale_\(x\)\{[^\n]*\}/)[0] + '\nvar _SALE_ALIAS_MAP = {};\n' + fn(j01, '_cfgAliasesOf') + fn(j01, '_cfgByAlias') + fn(j01, '_saleChannelOf_') +
  ['_scpNorm_', '_scpListOf_', '_saleChannelOn_'].map(n => fn(j62, n)).join('\n') +
  ['_bonusProgramApplies_', '_ddmmyyyyToYmd_', '_daysSinceStart_', '_saleStartDate_', '_bonusProductQty_', '_bonusNamesOfOrder_', '_bonusParticipants_', '_bonusCodeTokens_', '_bonusMergeGhep_', '_orderRevenueShares_', '_bonusNormSrc_', '_bonusSourceOk_', '_bonusOrderProductQtys_', '_bonusAggSources_', '_bonusRequireKw_', '_bonusRequireProductOk_', '_computeBonusData_'].map(n => fn(j12, n)).join('\n'), ctx);
ctx.O = orders;
const res = JSON.parse(vm.runInContext('JSON.stringify(_computeBonusData_(O))', ctx));
// Pass "Tourmaline cao cap" (CT "Don tu 21tr500" / "31tr500"): KT xet moc theo GIA NIEM YET truoc giam (don 1301T10: nhan tour 31.500.000, giam 5% con 29.925.000 van duoc T31 200.000 — bang thuong chinh thuc STT 105).
// NGUYEN NHAN GOC truoc day: engine do tren "Gia tri sau giam" nen 29.925.000 < 31.500.000 chi duoc T21 100.000. CHI chay lai 2 CT T21/T31 cho don co SP cao cap bi giam; cac CT khac (10tr/15tr/20tr, doanh so ngay) van tinh theo gia sau giam nhu cu.
const caoCap = orders.filter(o => /NH[AẪ]N TOUR TR[OƠ]N CAO C[AẤ]P/i.test(o.sanPham || '') && (o.giaTriTruocGiam || 0) > (o.giaTriDon || 0));
res.caoCapAdjusted = [];
if (caoCap.length) {
  const allProg = ctx.BONUS_PROGRAMS; ctx.BONUS_PROGRAMS = allProg.filter(p => /^Tourmaline cao cấp/.test(p.name)); ctx.O = caoCap.map(o => Object.assign({}, o, { giaTriDon: o.giaTriTruocGiam }));
  const rc = JSON.parse(vm.runInContext('JSON.stringify(_computeBonusData_(O))', ctx)); ctx.BONUS_PROGRAMS = allProg;
  rc.bySale.forEach(sc => sc.items.forEach(it => {
    if (!it.orderId || it.scope !== 'Theo đơn') return;
    let s1 = res.bySale.find(x => x.name === sc.name); if (!s1) { s1 = { name: sc.name, total: 0, items: [] }; res.bySale.push(s1); }
    const cur = s1.items.find(x => x.orderId === it.orderId && x.scope === 'Theo đơn');
    if (cur && cur.amount >= it.amount) return;
    if (cur) { s1.total += it.amount - cur.amount; res.total += it.amount - cur.amount; res.caoCapAdjusted.push({ sale: sc.name, orderId: it.orderId, tu: cur.program + ' ' + cur.amount, den: it.program + ' ' + it.amount }); Object.assign(cur, it, { detail: it.detail + ' (xét theo giá niêm yết trước giảm)' }); }
    else { s1.items.push(Object.assign({}, it, { detail: it.detail + ' (xét theo giá niêm yết trước giảm)' })); s1.total += it.amount; res.total += it.amount; res.caoCapAdjusted.push({ sale: sc.name, orderId: it.orderId, tu: '(khong co)', den: it.program + ' ' + it.amount }); }
  }));
  res.bySale.sort((a, b) => b.total - a.total); console.log('cao cap xet theo gia niem yet:', JSON.stringify(res.caoCapAdjusted));
}
// Pass 2: chi don nguon 'Facebook Pham Thu Hien' co the cua menbui2002, coi la Online -> thuong "them" cho Men (khong dung vao thuong cua sale o pass 1)
ctx.O = allOrders.filter(o => isFbSrc(o) && hasName(o, EXTRA_CSKH)); const hadCh = Object.prototype.hasOwnProperty.call(ctx.SALE_CHANNELS, EXTRA_CSKH);
ctx.SALE_CHANNELS[EXTRA_CSKH] = 'online';
const res2 = JSON.parse(vm.runInContext('JSON.stringify(_computeBonusData_(O))', ctx));
if (!hadCh) delete ctx.SALE_CHANNELS[EXTRA_CSKH];
const men = res2.bySale.find(x => x.name === EXTRA_CSKH);
res.extraCskh = { name: EXTRA_CSKH, nOrders: ctx.O.length, total: men ? men.total : 0, items: men ? men.items : [] };
if (men && !res.bySale.some(x => x.name === EXTRA_CSKH)) { res.bySale.push(men); res.total += men.total; }
res.nOrders = orders.length;
console.log('them CSKH', EXTRA_CSKH, '| don Facebook Pham Thu Hien:', ctx.O.length, '| thuong them:', res.extraCskh.total);
res.tachGroups = mergedInfo; res.channels = chRaw; res.nOrders = orders.length; res.programs = PROGRAMS.map(p => p.name);
fs.writeFileSync(W + '/bonus-result.json', JSON.stringify(res));
console.log('don tinh:', orders.length, '| tong thuong:', res.total, '| sale co thuong:', res.bySale.length, '| don can kiem tay:', res.review.length);
res.bySale.slice(0, 40).forEach(s => console.log(s.name.padEnd(22), String(s.total).padStart(9), (chRaw[s.name] || '(chua phan loai)')));

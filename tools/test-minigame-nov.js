#!/usr/bin/env node
// Test CHUONG TRINH MINI GAME THANG 11/2026 (Phu luc 02/QC-HTT) muc C + D trong Team Bonus (gas_v13.js). Chay: node tools/test-minigame-nov.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const strip = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const VN = 7 * 3600 * 1000, RealDate = Date;
const settings = { saleChannels: { 'Hoa': 'online', 'Nam': 'offline', 'Mai': 'online', 'Tan': 'probation' } };
let dtRows = [];
const ctx = { Logger: { log() {} }, VN_OFFSET_MS: VN,
  _csJsonSetting_: (k, f) => (settings[k] === undefined ? f : settings[k]),
  _salePersonIdentity_: () => ({ key: n => String(n).trim().toLowerCase(), members: n => [String(n).trim()] }), _expandSaleFilterWithPancakeAliases_: a => a,
  _stripVN_: strip, _dtOrderRevenue_: r => Number(r.rev) || 0, _normTxt_: s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(), _isNumericTag_: s => /^\d+$/.test(String(s).trim()),
  splitMulti_: (s, sep) => String(s || '').split(sep).map(x => x.trim()).filter(Boolean), _isExcludedOrderStatus_: t => /huy|hoan|that bai/.test(strip(t).toLowerCase()),
  _dtIsExchangeOrder_: p => strip(p).toLowerCase().indexOf('doi') !== -1, readDTTong_: () => dtRows,
  parseVNDate_: s => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]) - VN) : null; },
  _vnYmd_: dt => { const x = new Date(dt.getTime() + VN); return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0'); },
  _cacheGetBig_: () => null, _cachePutBig_: () => {}, _srCloseRateSectionsFromBase_: () => ({ saleCloseRate: [] }),
  _tbReadPenalties_: () => [], _profNames_: () => [] };
vm.createContext(ctx);
const defStart = src.indexOf('var TEAM_BONUS_DEFAULT_ = ');
vm.runInContext(src.slice(defStart, src.indexOf('\n};', defStart) + 3), ctx);
['_tbPad_', '_tbYmdAdd_', '_tbDow_', '_tbMonthEnd_', '_tbFmtDm_', 'teamBonusCfg_', '_tbTeam_', '_tbOrderCounts_', '_tbDailyCounts_', '_tbPickClose_', '_tbCloseFor_', '_tbTierFor_', '_tbComputeRewards_', 'teamBonusReport_'].forEach(n => vm.runInContext(grab(n), ctx));
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const J = JSON.stringify;
const o = (d, sale, rev, extra) => Object.assign({ ngayTao: d, nguoiTao: sale, saleBan: sale, trangThai: 'Thành công', phanLoai: 'Bán mới', kenhBan: 'Fb Shop', giaiDoan: '', bhZero: false, rev }, extra || {});
const cfg = vm.runInContext('teamBonusCfg_()', ctx);
ok(cfg.dailyTiers.length === 2 && cfg.monthTiers.length === 10 && cfg.monthTiers[9].min === 3e9 && cfg.monthTiers[9].reward === 5e6 && cfg.topRevenue.minRevenue === 1e9 && cfg.onlineAllowance.minRevenue === 7e8 && cfg.monthlyReward === 1e6, 'mac dinh dung Phu luc 02: 2 moc ngay, 10 moc thang, top DT >=1 ty, phu cap Online 700tr, top ty le chot 1tr');
const T = (v) => (vm.runInContext('_tbTierFor_', ctx)(cfg.monthTiers, v) || {}).reward || 0;
ok(T(499e6) === 0 && T(500e6) === 5e5 && T(599e6) === 5e5 && T(600e6) === 7e5 && T(1e9) === 1.5e6 && T(2.49e9) === 3.5e6 && T(2.5e9) === 4.5e6 && T(9e9) === 5e6, 'moc thang: 500tr=500k, 600tr=700k, 1 ty=1,5tr, 2,5 ty=4,5tr, 3 ty+=5tr, <500tr khong thuong');
// Du lieu T11/2026: today = 05/12/2026 (thang da ket thuc)
dtRows = [
  o('03/11/2026', 'Hoa', 60e6), o('03/11/2026', 'Hoa', 5e6),               // Hoa 03/11 = 65tr -> 50k
  o('04/11/2026', 'Hoa', 100e6),                                            // Hoa 04/11 = 100tr -> 100k (khong cong don 50k)
  o('05/11/2026', 'Nam', 59e6),                                             // 59tr -> khong du
  o('06/11/2026', 'Mai', 120e6, { trangThai: 'Hủy' }),                      // don huy -> khong tinh
  o('07/11/2026', 'Nam', 30e6, { phanLoai: 'Đổi trả' }),                    // doi tra -> khong tinh
  o('08/11/2026', 'Tan', 200e6),                                            // Thu viec (khong thuoc doi) -> khong tinh
  o('10/11/2026', 'Nam', 700e6), o('11/11/2026', 'Nam', 350e6),            // Nam thang: 59+700+350 = 1,109 ty
  o('12/11/2026', 'Hoa', 500e6), o('13/11/2026', 'Hoa', 200e6),            // Hoa: 65+100+500+200 = 865tr
  o('14/11/2026', 'Mai', 710e6) ];                                          // Mai (online): 710tr
ctx.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(RealDate.UTC(2026, 11, 5, 5, 0, 0)); else super(...a); } static UTC(...a) { return RealDate.UTC(...a); } static now() { return RealDate.UTC(2026, 11, 5, 5, 0, 0); } };
const rep = vm.runInContext('teamBonusReport_', ctx)({ month: '2026-11' }, { admin: true, seeAll: true, u: {} });
ok(rep.ok, 'bao cao chay duoc');
const dt = rep.rewards.filter(r => r.kind === 'dayTarget').map(r => r.name + '@' + r.period + '=' + r.amount).sort();
ok(J(dt) === J(['Hoa@2026-11-03=50000', 'Hoa@2026-11-04=100000', 'Hoa@2026-11-12=100000', 'Hoa@2026-11-13=100000', 'Nam@2026-11-10=100000', 'Nam@2026-11-11=100000', 'Mai@2026-11-14=100000'].sort()), 'thuong DS ngay: 65tr=50k, 100tr+=100k (khong cong don), 59tr khong du; don huy/doi tra/Thu viec khong tinh: ' + J(dt));
const mt = {}; rep.rewards.filter(r => r.kind === 'monthTarget').forEach(r => mt[r.name] = r.amount);
ok(mt.Nam === 1.5e6 && mt.Hoa === 1e6 && mt.Mai === 7e5 && !mt.Tan, 'thuong moc thang: Nam 1,109 ty=1,5tr; Hoa 865tr=1tr; Mai 710tr=700k (moc 600tr); Tan (khong thuoc doi) khong: ' + J(mt));
const tr = rep.rewards.filter(r => r.kind === 'topRevenue');
ok(tr.length === 1 && tr[0].name === 'Nam' && tr[0].amount === Math.round(1109e6 * 0.001), 'Top 1 doanh thu (>=1 ty): Nam, 0,1% x DS cua Nam = ' + Math.round(1109e6 * 0.001) + ' (mac dinh base=self): ' + J(tr));
const al = rep.rewards.filter(r => r.kind === 'allowance');
ok(al.length === 2 && al.every(a => a.amount === 1e6) && al.map(a => a.name).sort().join() === 'Hoa,Mai', 'phu cap Online >=700tr: Hoa(865tr) + Mai(710tr) moi nguoi 1tr; Nam (offline) khong: ' + J(al.map(a => a.name)));
const totals = {}; rep.totals.forEach(t => totals[t.name] = t.reward);
const namExpect = 100000 * 2 + 1.5e6 + Math.round(1109e6 * 0.001);
ok(totals.Nam === namExpect, 'tong thuong Nam = 2 ngay + moc thang + top DT = ' + namExpect + ' (got ' + totals.Nam + ')');
// thang CHUA ket thuc: thuong thang/top DT/phu cap chi tam tinh, khong cong tien
ctx.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(RealDate.UTC(2026, 10, 20, 5, 0, 0)); else super(...a); } static UTC(...a) { return RealDate.UTC(...a); } static now() { return RealDate.UTC(2026, 10, 20, 5, 0, 0); } };
const rep2 = vm.runInContext('teamBonusReport_', ctx)({ month: '2026-11', nocache: '1' }, { admin: true, seeAll: true, u: {} });
ok(!rep2.rewards.some(r => r.kind === 'monthTarget' || r.kind === 'topRevenue' || r.kind === 'allowance') && rep2.rewards.some(r => r.kind === 'dayTarget') && rep2.monthTargets.length > 0 && rep2.monthTargets[0].partial, 'giua thang: thuong NGAY da cong, thuong THANG/top DT/phu cap chi tam tinh (partial)');
// base = team
settings.teamBonusCfg = { topRevenue: { base: 'team' } };
ctx.Date = class extends RealDate { constructor(...a) { if (a.length === 0) super(RealDate.UTC(2026, 11, 5, 5, 0, 0)); else super(...a); } static UTC(...a) { return RealDate.UTC(...a); } static now() { return RealDate.UTC(2026, 11, 5, 5, 0, 0); } };
const rep3 = vm.runInContext('teamBonusReport_', ctx)({ month: '2026-11', nocache: '1' }, { admin: true, seeAll: true, u: {} });
const tr3 = rep3.rewards.filter(r => r.kind === 'topRevenue')[0];
ok(tr3 && tr3.amount === Math.round((1109e6 + 865e6 + 710e6) * 0.001), 'base=team: 0,1% x tong DS doi (' + Math.round((1109e6 + 865e6 + 710e6) * 0.001) + ')');
process.exit(fail ? 1 : 0);

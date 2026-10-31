// Test thuong phat doi Sale Online/Van phong (Bao cao B) — 2026-10-29. Chay: node tools/test-team-bonus.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const VN = 7 * 3600 * 1000;
const settings = { saleChannels: { 'Hoa': 'online', 'Nam': 'offline', 'Lan Quay': 'quay', 'Tan': 'probation', 'Mai': 'online' } };
let dtRows = [];
const sheetRows = [];
const ctx = {
  Logger: { log() {} }, VN_OFFSET_MS: VN,
  _csJsonSetting_: (k, f) => (settings[k] === undefined ? f : settings[k]),
  _salePersonIdentity_: () => ({ key: n => String(n).trim().toLowerCase(), members: n => [String(n).trim()] }),
  _expandSaleFilterWithPancakeAliases_: a => a,
  _stripVN_: strip, _normTxt_: s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(),
  _isNumericTag_: s => /^\d+$/.test(String(s).trim()),
  splitMulti_: (s, sep) => String(s || '').split(sep).map(x => x.trim()).filter(Boolean),
  _isExcludedOrderStatus_: t => /huy|hoan|that bai/.test(strip(t).toLowerCase()),
  _dtIsExchangeOrder_: p => strip(p).toLowerCase().indexOf('doi') !== -1,
  readDTTong_: () => dtRows,
  parseVNDate_: s => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]) - VN) : null; },
  _vnYmd_: dt => { const x = new Date(dt.getTime() + VN); return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0'); },
  _cacheGetBig_: () => null, _cachePutBig_: () => {},
  _srCloseRateSectionsFromBase_: (f, rows, by) => { ctx.__by = by; return ctx.__close(f, rows); },
};
vm.createContext(ctx);
['_tbPad_', '_tbYmdAdd_', '_tbDow_', '_tbMonthEnd_', '_tbFmtDm_', 'teamBonusCfg_', '_tbTeam_', '_tbOrderCounts_', '_tbDailyCounts_', '_tbPickClose_', '_tbCloseFor_', '_tbComputeRewards_'].forEach(n => vm.runInContext(grab(n), ctx));
vm.runInContext("var TEAM_BONUS_DEFAULT_ = " + src.slice(src.indexOf('var TEAM_BONUS_DEFAULT_ = ') + 26, src.indexOf('};', src.indexOf('var TEAM_BONUS_DEFAULT_ = ')) + 2) + ";", ctx);
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const J = JSON.stringify;
const o = (d, sale, extra) => Object.assign({ ngayTao: d, nguoiTao: sale, saleBan: sale, trangThai: 'Thành công', phanLoai: 'Bán mới', kenhBan: 'Fb Shop', giaiDoan: '', bhZero: false }, extra || {});
const many = (n, d, sale, extra) => Array.from({ length: n }, () => o(d, sale, extra));
const cfg = vm.runInContext('teamBonusCfg_()', ctx);
ok(cfg.dailyMinOrders === 6 && cfg.dailyReward === 50000 && cfg.weeklyReward === 50000 && cfg.monthlyReward === 100000, 'mac dinh: min 6 don, 50k ngay, 50k tuan, 100k thang');
ok(cfg.penalties.length === 5 && J(cfg.penalties.map(p => p.amount)) === '[50000,50000,50000,200000,50000]', '5 loai phat: 50k/50k/50k/200k/50k');

// Doi sale = chi online + offline (Quay, Thu viec khong thuoc doi)
const team = vm.runInContext('_tbTeam_()', ctx);
ok(J(team.list.map(m => m.name)) === '["Hoa","Mai","Nam"]', 'doi = Online + Van phong, khong gom Quay/Thu viec');

// ---- THUONG NGAY ----
// 01/10: Hoa 7 don hop le + 3 don doi tra + 2 bao hanh + 1 huy + 1 BH khong doanh thu => chi 7 don. Nam 5 don.
dtRows = [].concat(many(7, '01/10/2026', 'Hoa'), many(3, '01/10/2026', 'Hoa', { phanLoai: 'Đổi hàng' }), many(2, '01/10/2026', 'Hoa', { kenhBan: 'Bảo hành' }),
  many(1, '01/10/2026', 'Hoa', { trangThai: 'Hủy đơn' }), many(1, '01/10/2026', 'Hoa', { bhZero: true }), many(5, '01/10/2026', 'Nam'),
  // 02/10: Nam 5 don (< 6) => khong ai duoc thuong. Hoa 3.
  many(5, '02/10/2026', 'Nam'), many(3, '02/10/2026', 'Hoa'),
  // 03/10: hoa hang — Hoa 6, Nam 6 (cung nhan), Mai 4; don cua nguoi ngoai doi (Lan Quay) 9 don khong tinh; don 2 sale (Hoa, Mai) tinh cho tung nguoi
  many(6, '03/10/2026', 'Hoa'), many(6, '03/10/2026', 'Nam'), many(2, '03/10/2026', 'Mai'), many(2, '03/10/2026', 'Hoa', { saleBan: 'Hoa, Mai' }), many(9, '03/10/2026', 'Lan Quay'), many(4, '03/10/2026', 'Lan Quay', { saleBan: 'Mai' }),
  // 04/10: don STT Pancake (so) bo qua; don khong sale => khong tinh
  many(6, '04/10/2026', 'Mai', { saleBan: 'Mai, 12' }), many(3, '04/10/2026', ''), many(2, '04/10/2026', 'Hoa', { saleBan: '' }));
const dc = vm.runInContext('_tbDailyCounts_', ctx)(dtRows, '2026-10-01', '2026-10-31', team.memberOf, cfg);
ok(dc['2026-10-01'].counts.Hoa === 7 && dc['2026-10-01'].counts.Nam === 5, '01/10: Hoa 7 (loai doi tra/bao hanh/huy/BH0), Nam 5');
ok(dc['2026-10-01'].excluded === 7, '01/10: 7 don bi loai duoc dem rieng (3 doi + 2 BH + 1 huy + 1 BH0)');
ok(dc['2026-10-03'].counts.Hoa === 8 && dc['2026-10-03'].counts.Nam === 6 && dc['2026-10-03'].counts.Mai === 2 && !dc['2026-10-03'].counts['Lan Quay'], '03/10: DEM THEO NGUOI TAO: don Hoa+Mai (Hoa tao) chi +1 cho Hoa (khong +1 Mai); Mai chi 2 don minh tao; don Lan Quay tao ghi Sale ban Mai KHONG cong cho Mai');
ok(dc['2026-10-04'].counts.Mai === 6 && dc['2026-10-04'].counts.Hoa === 2 && !dc['2026-10-04'].counts['12'] && dc['2026-10-04'].total === 8, '04/10: tinh theo nguoi tao (Hoa 2 don du Sale ban trong; don khong co nguoi tao bi bo); so "12" khong thanh nguoi');

// compute rewards (T10/2026) voi "hom nay" co dinh = 20/10 -> mo phong bang cach ghi de _vnYmd_ cho new Date()
vm.runInContext("var __today = '2026-10-20'; var __origYmd = _vnYmd_; _vnYmd_ = function(dt){ return (dt && dt.__now) ? __today : __origYmd(dt); }; var Date0 = Date;", ctx);
// don gian: _tbComputeRewards_ goi _vnYmd_(new Date()) => khong the gan co. Dung Date gia.
const RealDate = Date;
ctx.Date = class extends RealDate { constructor(...a) { if (a.length === 0) { super(Date.UTC(2026, 9, 20, 5, 0, 0)); } else { super(...a); } } static UTC(...a) { return RealDate.UTC(...a); } static now() { return RealDate.UTC(2026, 9, 20, 5, 0, 0); } };
vm.runInContext("_vnYmd_ = __origYmd;", ctx);
// ty le chot gia lap: rows = [{name, held, closed, closeRate}] theo ky; luu lai ky duoc hoi
const asked = [];
ctx.__close = (f, rows) => {
  asked.push(f.dateFrom + '..' + f.dateTo);
  const w = f.dateFrom === '2026-10-01' ? 'month' : (f.dateFrom === '2026-10-05' ? 'w2' : 'w1');
  const data = {
    w1: [['Hoa', 200, 30], ['Nam', 100, 25], ['Mai', 40, 20], ['Lan Quay', 300, 90]],   // TB doi = (200+100+40)/3=113.3 => Mai (40) khong du tuong tac du ty le cao 50%; Nam 25% < Hoa 15%? -> Hoa 15%, Nam 25%
    w2: [['Hoa', 100, 20], ['Nam', 100, 20], ['Mai', 100, 10]],                       // hoa hang Hoa = Nam 20%
    month: [['Hoa', 600, 90], ['Nam', 500, 100], ['Mai', 90, 50]],
  }[w];
  return { saleCloseRate: data.map(x => ({ name: x[0], held: x[1], closed: x[2], closeRate: Math.round(x[2] / x[1] * 1000) / 10 })) };
};
const rw = vm.runInContext('_tbComputeRewards_', ctx)('2026-10', cfg);
ok(rw.daily.length === 20 && rw.daily[0].date === '2026-10-01' && rw.daily[19].date === '2026-10-20', 'ngay: tu 01/10 den hom nay 20/10');
const d1 = rw.daily[0], d2 = rw.daily[1], d3 = rw.daily[2], d4 = rw.daily[3];
ok(d1.qualified && J(d1.winners.map(w => w.name)) === '["Hoa"]' && d1.top === 7, '01/10: Hoa 7 don => thuong 50k');
ok(!d2.qualified && d2.winners.length === 0, '02/10: cao nhat 5 don < 6 => khong ai duoc thuong');
ok(d3.qualified && J(d3.winners.map(w => w.name)) === '["Hoa"]' && d3.top === 8, '03/10: Hoa 8 (6 + 2 don Hoa tao co Mai chung) thang Nam 6');
ok(d4.qualified && d4.winners[0].name === 'Mai', '04/10: Mai 6 don => thuong');
ok(rw.daily[19].partial === true && rw.daily[18].partial === false, 'hom nay danh dau tam tinh');
// Tuan: T10/2026 — 01/10 la Thu Nam => tuan Thu 2 28/09-04/10 (CN 04/10 trong thang), tuan 05-11, 12-18, 19-25 (CN 25/10 > hom nay => tam tinh)
ok(rw.weekly.map(w => w.label).join('|') === '28/09 – 04/10|05/10 – 11/10|12/10 – 18/10|19/10 – 25/10', 'tuan Thu 2-CN: ' + rw.weekly.map(w => w.label).join('|'));
ok(rw.weekly[3].partial === true && rw.weekly[0].partial === false, 'tuan chua ket thuc (19-25/10) la tam tinh');
const wk1 = rw.weekly[0];
ok(J(wk1.winners.map(w => w.name)) === '["Hoa"]', 'tuan 1: TB tuong tac doi = 113: Nam 25% bi loai (100 < 113), Mai 50% bi loai (40 < 113) => Hoa 15% (200 >= 113) thang; sale Quay khong thuoc doi. winners=' + J(wk1.winners.map(w => w.name)));
ok(wk1.rows.find(r => r.name === 'Mai').eligible === false && !wk1.rows.find(r => r.name === 'Lan Quay'), 'Mai khong du dieu kien; Lan Quay khong co trong bang');
ok(ctx.__by === 'nguoitao', 'ty le chot tuan/thang goi _srCloseRateSectionsFromBase_ voi forceBy=nguoitao (khong phu thuoc Settings closeRateBy)');
ok(J(rw.weekly[1].winners.map(w => w.name).sort()) === '["Hoa","Nam"]', 'tuan 2: Hoa va Nam cung 20% (cung so don) => ca 2 cung nhan (dong hang)');
ok(rw.monthly.partial === true, 'thang chua het => tam tinh (' + rw.monthly.effTo + ')');
ok(J(rw.monthly.winners.map(w => w.name)) === '["Nam"]', 'thang: Nam 20% > Hoa 15%; Mai 55% khong du tuong tac (90 < TB 396)');
ok(asked.indexOf('2026-10-01..2026-10-20') >= 0 || asked.indexOf('2026-10-01..2026-10-31') >= 0, 'thang hoi ty le chot theo ky tu dau thang den hom nay (khong vuot hom nay): ' + asked.filter(a => /10-01\.\./.test(a)).join(','));

// ---- ky khong co du lieu / mau so 0 ----
ctx.__close = () => ({ saleCloseRate: [] });
const pk0 = vm.runInContext('_tbCloseFor_', ctx)(dtRows, '2026-10-01', '2026-10-07', team.memberOf);
ok(pk0.noData === true && pk0.winners.length === 0, 'chua co du lieu Pancake => khong ai duoc thuong, danh dau noData');
ctx.__close = () => ({ saleCloseRate: [{ name: 'Hoa', held: 100, closed: 0, closeRate: 0 }, { name: 'Nam', held: 100, closed: 0, closeRate: 0 }] });
ok(vm.runInContext('_tbCloseFor_', ctx)(dtRows, '2026-10-01', '2026-10-07', team.memberOf).winners.length === 0, 'ty le chot 0% => khong thuong');

// ---- ma nguon: tuyen duong + phan quyen ----
ok(/if \(TEAMBONUS_GET_ACTIONS_\[action\] === 1\) return teamBonusDoGet_\(action, p\)/.test(src), 'doGet noi teamBonusReport');
ok(/if \(TEAMBONUS_POST_ACTIONS_\[action\] === 1\) return teamBonusDoPost_\(action, data\)/.test(src), 'doPost noi teamPenaltySave/Delete');
ok(/ACTION_FEATURE_ = \{ teamBonusReport:'salesreport'/.test(src), 'teamBonusReport gan hang muc salesreport (Admin bat/tat theo vai tro)');
ok(/if \(!acc\.admin\) return jsonOut_\(\{ ok: false, code: 'FORBIDDEN'/.test(src), 'ghi/xoa phat chi admin');
process.exit(fail ? 1 : 0);

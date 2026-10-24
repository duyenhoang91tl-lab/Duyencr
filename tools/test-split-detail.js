// Test GAS: splitOrderDetail (bam 1 sale o Bao cao M -> chi tiet Base/Pos de doi soat) — chay ham THAT trong gas_v13.js voi don gia.
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('thieu ' + name); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const consts = src.slice(src.indexOf('var SPLIT_ORDER_MAX_ROWS_ ='), src.indexOf('// [{name, frac}] cac sale THAT'));
const names = ['_posSaleFractions_', '_splitSales_', '_splitIdentityFor_', '_splitRowFinder_', '_splitScope_', '_splitCSV_', '_splitRange_', '_splitFilters_', '_splitRound_', '_splitDmy_', 'splitOrderDetail_', 'splitDoGet_', '_dateStrToVnYmd_', '_splitSaleSet_', '_splitCompareSales_', '_splitDayDiff_', '_splitPhoneCandidates_', '_isNumericTag_'];
const code = consts + names.map(fn).join('\n');
// Don 1: ghep Base 2 don goc (An+Binh ban don goc 1; An ban don goc 2) ; Don 2: the chia deu An,Binh (khong co Base) ; Don 3: An+Chi 70/30 file ke toan ; Don 4: don Base thu 2 da Huy
const O = [
  { ngayTaoDon: '02/10/2026', khachHang: 'Khách 1', soDienThoai: '0911000001', ghiChu: '17T10/2026 + 18T10/2026', theSale: 'An', saleThe: 'An', sanPham: 'Combo A', giaTriSauGiam: 3000000, giaTriPos: 2800000, dieuChinh: 'base',
    saleShares: [{ name: 'An', frac: 2 / 3 }, { name: 'Bình', frac: 1 / 3 }],   // = (2.000.000/2 + 1.000.000) / 3.000.000 — dung cach _resolveGhepDon_ tinh tu 2 don goc con hieu luc
    ghepBase: [{ ma: '17T10/2026', ngay: '2026-09-30', saleBan: 'An, Bình', trangThai: 'Thành công', giaTri: 2000000, tinh: true, sanPham: 'Nhẫn vàng' },
               { ma: '18T10/2026', ngay: '2026-10-01', saleBan: 'An', trangThai: 'Thành công', giaTri: 1000000, tinh: true, sanPham: 'Lắc tay' },
               { ma: '19T10/2026', ngay: '2026-10-01', saleBan: 'An', trangThai: 'Huỷ', giaTri: 999999, tinh: false, sanPham: 'Đã huỷ' }] },
  { ngayTaoDon: '03/10/2026', khachHang: 'Khách 2', soDienThoai: '0911000002', ghiChu: 'chia đều', theSale: 'An,Bình', saleThe: 'An,Bình', sanPham: 'SP B', giaTriSauGiam: 2000000, saleBanValid: 'An,Bình' },
  { ngayTaoDon: '05/10/2026', khachHang: 'Khách 3', soDienThoai: '0911000003', ghiChu: 'KT', theSale: 'An', saleThe: 'An', sanPham: 'Combo C', giaTriSauGiam: 3000000, dieuChinh: 'acct', saleShares: [{ name: 'An', frac: 0.7 }, { name: 'Chi', frac: 0.3 }] },
  { ngayTaoDon: '09/10/2026', khachHang: 'Khách 6', soDienThoai: '0911000006', ghiChu: '', theSale: 'Dung', saleThe: 'Dung', sanPham: 'SP D', giaTriSauGiam: 800000, saleBanValid: 'Dung' },
  { ngayTaoDon: '10/10/2026', khachHang: 'Khách 7', soDienThoai: '0911000007', ghiChu: '30/70 700T10/2026', theSale: 'An,Chi', saleThe: 'An,Chi', sanPham: 'Quầy', giaTriSauGiam: 1000000, saleBanValid: 'An,Chi', saleRatio: 0.3 }];
const sess = { tBoss: { username: 'boss', role: 'admin' }, tAn: { username: 'an', name: 'An', role: 'cs', names: ['An'] }, tDung: { username: 'dung', name: 'Dung', role: 'cs', names: ['Dung'] } };
const cache = {}, calls = [];
const ctx = { Math, JSON, String, Number, Object, Array, RegExp, Date, parseInt, jsonOut_: x => x, CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  Utilities: { DigestAlgorithm: { MD5: 1 }, Charset: { UTF_8: 1 }, computeDigest: () => [1, 2, 3, 4] }, SH_TEAM: 'Teams', getCrmSS_: () => ({ getSheetByName: () => null }),
  _sessUser_: t => sess[t] || null, _roleBase_: r => (r === 'admin' ? 'admin' : 'cs'), _vnYmd_: d => { if (!d) return '2026-10-15'; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  parseVNDate_: s => { const m = /^(\d+)\/(\d+)\/(\d+)/.exec(s || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null },
  _profFold_: ns => { const f = {}; (ns || []).forEach(n => f[String(n).trim().toLowerCase()] = true); return f; }, readTeams_: () => [], readSaleDepts_: () => ({ byNorm: {} }),
  _normTxt_: s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim(),
  _profNames_: u => [u.name].concat(u.names || []).filter(Boolean), normPhone_: p => String(p || '').replace(/\D/g, ''), _userDeptKeys_: null,
  _reportCacheKey_: (p, f) => p + JSON.stringify(f),
  _extractCounterCodes_: t => (String(t || '').match(/\d+T\d+\/\d+/g) || []), _splitBhCodes_: c => ({ normal: c, bh: [] }), _isExcludedOrderStatus_: t => /huy|hoan/i.test(String(t || '')),
  _donSaleNamesFromThe_: t => String(t || '').split(',').map(x => x.trim()).filter(Boolean), _pickBaseRowsForCode_: (c, idx) => idx.exact[c] || null,
  _readBaseRowsByCounterCodes_: w => ({ exact: { '700T10/2026': [{ rowIndex: 9, trangThai: 'Thành công', saleBan: 'An,Chi,Dung', code: '700T10/2026', ngayTao: new Date(2026, 9, 9), giaTriDon: 1000000, sanPham: 'Quầy SP' }] }, fuzzy: {} }),
  readDTTong_: () => [{ soDienThoai: '0911000002', ngayTao: '04/10/2026', saleBan: 'An', giaTriDon: 2000000, trangThai: 'Thành công', maBoDem: '9T10/2026', sanPham: 'Dây chuyền' },
                      { soDienThoai: '0911000002', ngayTao: '20/09/2026', saleBan: 'Dung', giaTriDon: 1, trangThai: 'Thành công', maBoDem: 'xa', sanPham: 'quá xa ngày' }],
  _salePersonIdentity_: obs => ({ key: n => String(n).trim().toLowerCase(), primary: n => String(n).trim(), members: n => [n] }),
  buildSalesReportB_: f => { calls.push(f); const want = (f.sale || []).map(n => ctx._normTxt_(n)); return { totalOrders: O.length, totalGiaTri: 0, bySale: [], orders: O.filter(o => { const ss = ctx._posSaleFractions_(o); return ss.some(x => want.indexOf(ctx._normTxt_(x.name)) >= 0); }) }; } };
vm.createContext(ctx); vm.runInContext(code, ctx);
const get = (tok, p) => ctx.splitDoGet_('splitOrderDetail', Object.assign({ token: tok }, p || {}));
const q = { dateFrom: '2026-10-01', dateTo: '2026-10-31', sale: 'An' };
const r = get('tBoss', q);
ok(r.ok && r.sale === 'An', 'Admin xem được chi tiết của sale An');
ok(calls[0].withBaseProduct === true && calls[0].sale[0] === 'An' && calls[0].dateFrom === '2026-10-01', 'builder duoc goi voi withBaseProduct=true + dung ky + dung sale');
ok(r.pos.length === 4 && r.pos.map(x => x.name).join('|') === 'Khách 1|Khách 2|Khách 3|Khách 7', 'Pos: 4 don chia cua An (don chi 1 sale — Khach 6 — bi loai), xep theo ngay tang dan');
const p1 = r.pos[0];
ok(p1.date === '02/10/2026' && p1.month === '10/2026' && p1.phone === '0911000001' && p1.note === '17T10/2026 + 18T10/2026' && p1.sales === 'An' && p1.product === 'Combo A', 'Pos dong 1: ngay/thang len don, SDT, ghi chu, sale tren the, san pham Pos');
ok(p1.total === 3000000 && p1.posValue === 2800000 && p1.share === 2000000 && p1.kind === 'base', 'Pos dong 1: tong DT tinh bao cao 3.000.000 (gia Pos goc 2.800.000), phan An = 2/3 = 2.000.000');
ok(r.pos[1].share === 1000000 && r.pos[1].kind === 'the' && r.pos[1].posValue === null, 'Pos the chia deu: An 50% = 1.000.000, khong co gia Pos goc khac');
ok(r.pos[2].share === 2100000 && r.pos[2].kind === 'acct', 'Pos file ke toan: An 70% = 2.100.000');
ok(r.pos[3].share === 150000 && r.pos[3].kind === 'quay', 'Pos quay 30/70 co 2 sale: moi nguoi 15% = 150.000');
ok(r.base.filter(x => !x.ref).length === 2, 'Base: 2 don goc co An (don goc da Huy bi bo)');
const rb2 = r.base.filter(x => !x.ref), b1 = rb2[0], b2 = rb2[1];
ok(b1.code === '17T10/2026' && b1.date === '30/09/2026' && b1.month === '09/2026' && b1.sales === 'An, Bình' && b1.product === 'Nhẫn vàng' && b1.total === 2000000 && b1.share === 1000000, 'Base dong 1: ngay len don BASE (30/09, khac ngay Pos), ma bo dem, sale ban, san pham Base, phan An = 1/2');
ok(b2.code === '18T10/2026' && b2.share === 1000000 && b2.product === 'Lắc tay' && b1.name === 'Khách 1' && b1.phone === '0911000001', 'Base dong 2: An ban 1 minh = 100%; ten KH + SDT lay tu don Pos');
ok(r.summary.posOrders === 4 && r.summary.posShare === 2000000 + 1000000 + 2100000 + 150000 && r.summary.posTotal === 3000000 + 2000000 + 3000000 + 1000000, 'summary Pos = cong cac dong');
ok(r.summary.baseOrders === 2 && r.summary.baseShare === 2000000 && r.summary.baseTotal === 3000000, 'summary Base = cong cac dong');
ok(r.summary.noBaseOrders === 3, '3 don chia khong co don goc Base (the chia deu, ke toan, quay) duoc dem rieng de giai thich');
ok(rb2.reduce((a, x) => a + x.share, 0) === r.pos[0].share, 'DOI SOAT: tong phan An cac dong Base (1.000.000 + 1.000.000) = phan An tren don Pos ghep (2.000.000) — khop tung dong tien');
// phan quyen
const own = get('tAn', q); ok(own.ok && own.pos.length === 4, 'Sale An xem chi tiet cua chinh minh');
const other = get('tDung', q); ok(other.ok && other.pos.length === 0 && other.warnings.length === 1, 'Sale Dung KHONG xem duoc An (rong + canh bao)');
const noTok = get('x', q); ok(noTok.ok === false && noTok.code === 'AUTH', 'khong token hop le -> AUTH');
const noSale = get('tBoss', { dateFrom: '2026-10-01' }); ok(noSale.ok === false, 'thieu ten sale -> loi');
const before = calls.length; get('tBoss', q); ok(calls.length === before, 'goi lai trong 120s dung cache (khong tinh lai)');
// ---- CHECK NGUOC BASE (2026-10-24) ----
const bc = k => r.pos.find(x => x.name === k).baseCheck;
ok(bc('Khách 1').nguon === 'ma', 'don ghep Base co baseCheck (nguon = ma)');
ok(bc('Khách 1').posSales.join() === 'An' && bc('Khách 1').baseSales.join() === 'An,Bình' && bc('Khách 1').missing.join() === 'Bình' && bc('Khách 1').status === 'lech', 'Khach 1: Pos chi gan An, Base co An+Binh => LECH, thieu tren Pos: Binh');
ok(bc('Khách 2').nguon === 'sdt' && bc('Khách 2').status === 'lech' && bc('Khách 2').extra.join() === 'Bình' && bc('Khách 2').baseSales.join() === 'An', 'Khach 2: khong co ma -> goi y Base theo SDT (+-3 ngay, bo don 20/09 qua xa): Base chi An, Pos gan them Binh => LECH, thua tren Pos: Binh');
ok(bc('Khách 3').status === 'khongCoBase' && bc('Khách 3').nguon === '', 'Khach 3: khong co Base nao de doi chieu -> khongCoBase');
ok(bc('Khách 7').nguon === 'ma' && bc('Khách 7').status === 'lech' && bc('Khách 7').missing.join() === 'Dung' && bc('Khách 7').baseCodes.join() === '700T10/2026', 'Khach 7: don 1 ma 700T10/2026 (khong ghep) van check nguoc Base theo ma: Base co them Dung => LECH');
ok(r.summary.check.lech === 3 && r.summary.check.khongCoBase === 1 && r.summary.check.goiY === 1 && r.summary.check.khop === 0, 'summary.check dem dung lech/khop/khongCoBase/goiY');
const refs = r.base.filter(x => x.ref);
ok(refs.length === 2 && refs.every(x => x.share === 0) && r.summary.baseRefOrders === 2 && r.summary.baseOrders === 2 && r.summary.baseShare === 2000000, 'don khong ghep: dua don Base THAM CHIEU (ref, share 0) vao tab Base, KHONG doi tong phan chia / so don Base ghep');
ok(r.base.length === 4 && r.base.filter(x => !x.ref).length === 2, 'tab Base: 2 don ghep that + 2 don tham chieu');
// helper thuan
const id0 = ctx._salePersonIdentity_([]);
const c1 = ctx._splitCompareSales_(['An', 'Chi'], ['chi', 'AN'], id0, true); ok(c1.status === 'khop', 'so sanh khong phan biet hoa thuong/thu tu');
ok(ctx._splitCompareSales_(['An', '8', '(chưa gán sale)'], ['An'], id0, true).status === 'khop', 'bo the toan so / chua gan sale khi so sanh');
ok(ctx._splitCompareSales_(['An'], [], id0, false).status === 'khongCoBase', 'khong co Base -> khongCoBase');
ok(ctx._splitDayDiff_('2026-10-01', '2026-10-04') === 3 && ctx._splitDayDiff_('x', '2026-10-04') === null, 'chenh lech ngay');
process.exit(bad ? 1 : 0);

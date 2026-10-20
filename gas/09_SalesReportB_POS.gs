// Ma bo dem: [chu 0-3 ky tu, vd "Bh"] + so + [chu 0-3 ky tu, vd "Q"] + "T" + thang(1-2 so) + ["/" + nam 2-4 so].
// VD khop: 980T09 | 16QT09/2026 | Bh395T09/2026 | 835T09/2026. Phai dung RIENG (khong dinh chu/so lien truoc/sau).
// SUA 2026-10-05 theo yeu cau Duyen ("cu tinh sao de khop voi ke toan nhat"): TAT ghep don Pos<->Base. File ke toan (don_check.xlsx)
// tinh doanh thu Pos THUAN: gia tri = cot "Giá trị đơn hàng sau giảm giá" cua Pos, chia deu cho cac sale tren cot The, KHONG thay
// bang gia tri/sale cua don goc Base. Do tren file that thang 9: bat ghep lam Sasum lech 18.986.000d (9 don doi gia theo Base,
// 2 don bi loai vi goc Base da Huy/Hoan) va chia lai sale theo Base lam nhieu sale lech hang tram trieu. Dat true de BAT LAI
// co che ghep (code ghep van nguyen ven ben duoi). Tat ghep cung khong con doc "DT TỔNG" trong Bao cao B -> nhanh hon.
// SUA 2026-10 theo QUY TAC CHOT CUA DUYEN (5 diem): BAT LAI ghep Pos<->Base nhung CHI cho don Pos co TU 2 MA DON TRO LEN
// (don ghep). Don Pos co 0-1 ma van tinh THUAN theo Pos nhu file ke toan (khong con thay gia tri/sale bang don goc Base) —
// day chinh la nguyen nhan lech 18.986.000d truoc kia (ghep ca don 1 ma). Don goc Base chi bi loai khi 'Thất bại' (cot H).
var POS_GHEP_BASE_ENABLED_ = true;
var POS_GHEP_MIN_CODES_ = 2;
var COUNTER_CODE_INNER_ = '[A-Za-z]{0,3}\\d{1,6}[A-Za-z]{0,3}T\\d{1,2}(?:\\/\\d{2,4})?';
var COUNTER_CODE_RE_SRC_ = '(^|[^A-Za-z0-9])(' + COUNTER_CODE_INNER_ + ')(?![A-Za-z0-9])';
function _normCounterCode_(c) { return String(c || '').replace(/\s+/g, '').toUpperCase(); }
function _counterCodeNoYear_(c) { return String(c).replace(/\/\d{2,4}$/, ''); }
function _counterCodeHasYear_(c) { return /\/\d{2,4}$/.test(String(c)); }
// Tach TAT CA ma bo dem hop le trong 1 doan van ban (ghi chu), da chuan hoa + bo trung, giu thu tu.
function _extractCounterCodes_(text) {
  var out = [], seen = {};
  if (text === null || text === undefined || text === '') return out;
  var re = new RegExp(COUNTER_CODE_RE_SRC_, 'g'), m;
  var str = String(text);
  while ((m = re.exec(str)) !== null) {
    var c = _normCounterCode_(m[2]);
    if (c && !seen[c]) { seen[c] = true; out.push(c); }
    re.lastIndex = m.index + m[1].length + m[2].length; // tiep tuc sau ma vua khop (khong an lui)
  }
  return out;
}

// Tim CAT chua "ma bo dem" trong "DT TỔNG " (khong co tai lieu ghi ro cot nao). Lay mau ~400 dong CUOI, dem so o
// khop NGUYEN o la 1 ma (uu tien) hoac co chua 1 ma trong o ngan (<=60 ky tu); chon cot nhieu nhat (>=3). Ket qua
// luu cache 6 gio (khong tim ra: 10 phut). Tra ve chi so cot (0-based) hoac -1.
// SUA 2026-10-05: ban dau quet MOI O cua MOI dong bang RegExp moi -> bao cao B qua 55 giay roi bi huy.
function _detectBaseCounterCol_(sh, last) {
  var cache = CacheService.getScriptCache();
  var ck = 'dtCounterCol_v1';
  try { var c = cache.get(ck); if (c !== null) { var v = parseInt(c, 10); if (!isNaN(v)) return v; } } catch (e0) {}
  var from = Math.max(2, last - 399);
  var vals = sh.getRange(from, 1, last - from + 1, DT_TONG_WIDTH).getValues();
  var full = new RegExp('^' + COUNTER_CODE_INNER_ + '$', 'i');
  var part = new RegExp(COUNTER_CODE_RE_SRC_, 'i');
  var fullHits = [], partHits = [];
  for (var ci = 0; ci < DT_TONG_WIDTH; ci++) { fullHits[ci] = 0; partHits[ci] = 0; }
  for (var i = 0; i < vals.length; i++) {
    for (var cj = 0; cj < DT_TONG_WIDTH; cj++) {
      var cell = vals[i][cj];
      if (cell === '' || cell === null || cell === undefined || typeof cell === 'number' || cell instanceof Date) continue;
      var str = String(cell).trim();
      if (!str || str.length > 60) continue;
      if (full.test(str)) fullHits[cj]++;
      else if (part.test(str)) partHits[cj]++;
    }
  }
  var best = -1, bestN = 2;
  for (var f = 0; f < DT_TONG_WIDTH; f++) if (fullHits[f] > bestN) { bestN = fullHits[f]; best = f; }
  if (best < 0) { bestN = 2; for (var g = 0; g < DT_TONG_WIDTH; g++) if (fullHits[g] + partHits[g] > bestN) { bestN = fullHits[g] + partHits[g]; best = g; } }
  try { cache.put(ck, String(best), best >= 0 ? 21600 : 600); } catch (e1) {}
  return best;
}

// Doc "DT TỔNG " (Base) va CHI giu cac dong co ma bo dem nam trong wantedCodes (set chuan hoa).
// Chi doc 5 CAT can dung (ma bo dem, trang thai, sale, gia tri) thay vi ca 20 cot, va chi chay regex tren o
// NGAN co dang "..T<so>" (bo qua o dai/so/ngay) -> nhanh hon rat nhieu. Khong xac dinh duoc cot -> colIdx = -1.
// Tra ve { exact: {code: [row]}, fuzzy: {code: [row]}, colIdx } — fuzzy = lech dung phan "/nam" (1 ben co, 1 ben khong).
function _readBaseRowsByCounterCodes_(wantedCodes) {
  var res = { exact: {}, fuzzy: {}, colIdx: -1 };
  var wantedList = Object.keys(wantedCodes);
  if (!wantedList.length) return res;
  var wantedNoYear = {}; // ma khong nam -> [ma day du trong wanted]
  wantedList.forEach(function(c) { var n = _counterCodeNoYear_(c); (wantedNoYear[n] = wantedNoYear[n] || []).push(c); });

  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) return res;
  var last = sh.getLastRow();
  if (last < 2) return res;
  var colIdx = _detectBaseCounterCol_(sh, last);
  res.colIdx = colIdx;
  if (colIdx < 0) return res;
  var n = last - 1;
  function col_(ci) { return sh.getRange(2, ci + 1, n, 1).getValues(); }
  var cCode = col_(colIdx), cTT = col_(DT_COL_TRANGTHAI), cSale = col_(DT_COL_SALEBAN), cGT = col_(DT_COL_GIATRIDON), cCreator = col_(1), cNgay = col_(DT_COL_NGAYTAO); // cot B "Người tạo" cua DT TONG = NGUOI LEN DON (dung de tinh THUONG, xem _resolveGhepDon_)
  var re = new RegExp(COUNTER_CODE_RE_SRC_, 'g'), quick = /[Tt]\d/;
  function addHit_(bucket, key, rowObj) {
    var arr = bucket[key] || (bucket[key] = []);
    for (var q = 0; q < arr.length; q++) if (arr[q].rowIndex === rowObj.rowIndex) return; // 1 dong chi tinh 1 lan / ma
    arr.push(rowObj);
  }
  for (var i = 0; i < n; i++) {
    var cell = cCode[i][0];
    if (cell === '' || cell === null || cell === undefined || typeof cell === 'number' || cell instanceof Date) continue;
    var str = String(cell);
    if (str.length > 60 || !quick.test(str)) continue;
    re.lastIndex = 0;
    var rowObj = null, m;
    while ((m = re.exec(str)) !== null) {
      var bc = _normCounterCode_(m[2]);
      re.lastIndex = m.index + m[1].length + m[2].length;
      var isWanted = !!wantedCodes[bc];
      var fuzzyTargets = [];
      var bNo = _counterCodeNoYear_(bc);
      if (wantedNoYear[bNo]) {
        wantedNoYear[bNo].forEach(function(wc) {
          if (wc !== bc && (_counterCodeHasYear_(wc) !== _counterCodeHasYear_(bc))) fuzzyTargets.push(wc);
        });
      }
      if (!isWanted && !fuzzyTargets.length) continue;
      if (!rowObj) {
        rowObj = {
          rowIndex: i + 2,
          trangThai: cTT[i][0],
          saleBan: cSale[i][0] ? String(cSale[i][0]) : '',
          creator: cCreator[i][0] ? String(cCreator[i][0]).trim() : '',
          ngayTao: cNgay[i][0], // NGAY TAO DON tren Base (doanh thu NGAY / thuong tinh theo ngay nay, khong theo ngay Pos)
          giaTriDon: _normMoney_(cGT[i][0]),
          code: bc
        };
      }
      if (isWanted) addHit_(res.exact, bc, rowObj);
      fuzzyTargets.forEach(function(wc) { addHit_(res.fuzzy, wc, rowObj); });
    }
  }
  return res;
}

// Quyet dinh cac dong Base khop cho 1 ma ghi chu: uu tien khop CHINH XAC (tang 1) -> khop lech "/nam" CHI KHI
// duy nhat 1 ma day du (tranh nham nam 2025/2026) -> du phong tang 2 (cot O). Tra ve mang dong, hoac null.
function _pickBaseRowsForCode_(code, idx) {
  if (idx.exact[code] && idx.exact[code].length) return idx.exact[code];
  var fz = idx.fuzzy[code] || [];
  if (fz.length) {
    var distinct = {}; fz.forEach(function(rw) { distinct[rw.code] = true; });
    if (Object.keys(distinct).length === 1) return fz;
    return null; // mo ho (nhieu nam khac nhau) -> khong doan, de rơi ve cach chia Pos + canh bao
  }
  return null;
}

// Tinh GHEP cho 1 don Pos. usedBaseRows: set (cap request) cac dong Base da duoc 1 don Pos khac nhan —
// chong cong trung doanh thu khi 2 don Pos cung tro toi 1 don goc. Tra ve:
//   null                      — don khong co ma bo dem trong ghi chu (chia Pos binh thuong)
//   { status:'ok', total, shares:[{name,frac}], codes, baseRows:n }  — da ghep xong
//   { status:'gocBiLoai', codes }                                    — moi don goc Base deu Huy/Hoan -> bo don Pos
//   { status:'khongKhop'|'trungDonGoc', codes, missing:[...] }       — co ma nhung KHONG ghep duoc (fallback Pos)
function _resolveGhepDon_(codes, idx, usedBaseRows) {
  if (!codes || !codes.length) return null;
  var picked = [], missing = [], seenRow = {};
  for (var i = 0; i < codes.length; i++) {
    var rows = _pickBaseRowsForCode_(codes[i], idx);
    if (!rows || !rows.length) { missing.push(codes[i]); continue; }
    for (var j = 0; j < rows.length; j++) {
      if (seenRow[rows[j].rowIndex]) continue; // cung 1 dong Base duoc nhieu ma tro toi (vd co/khong "/nam") -> 1 lan
      seenRow[rows[j].rowIndex] = true; picked.push(rows[j]);
    }
  }
  // Co ma khong tim thay don goc: KHONG ghep 1 phan (se thieu doanh thu) — chia theo Pos va canh bao de kiem tra tay.
  if (missing.length) return { status: 'khongKhop', codes: codes, missing: missing };
  for (var u = 0; u < picked.length; u++) {
    if (usedBaseRows[picked[u].rowIndex]) return { status: 'trungDonGoc', codes: codes, missing: [] };
  }
  var total = 0, shareAmt = {}, names = [], liveRows = 0, creators = [], seenCreator = {}, baseYmd = '';
  for (var b = 0; b < picked.length; b++) {
    var br = picked[b];
    usedBaseRows[br.rowIndex] = true;
    if (_isExcludedOrderStatus_(br.trangThai)) continue; // don goc da Huy/Hoan (theo dinh nghia Base) -> khong tinh
    liveRows++;
    var bDt = parseVNDate_(br.ngayTao), bYmd = bDt ? _vnYmd_(bDt) : '';
    if (bYmd && (!baseYmd || bYmd < baseYmd)) baseYmd = bYmd;
    if (br.creator && !seenCreator[_normTxt_(br.creator)]) { seenCreator[_normTxt_(br.creator)] = true; creators.push(br.creator); }
    var rv = Number(br.giaTriDon) || 0;
    var sales = String(br.saleBan || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
    if (!sales.length) sales = ['(chưa gán sale)'];
    total += rv;
    sales.forEach(function(sn) {
      if (shareAmt[sn] === undefined) { shareAmt[sn] = 0; names.push(sn); }
      shareAmt[sn] += rv / sales.length; // trong 1 don goc: chia deu cho cac sale cua don do (giong Bao cao A)
    });
  }
  // TAT CA don goc deu da Huy/Hoan (Base) -> don Pos ghep nay coi nhu bi loai (khong tinh doanh thu, khong dem don).
  if (!liveRows) return { status: 'gocBiLoai', codes: codes, missing: [] };
  var shares = [];
  names.forEach(function(sn) { shares.push({ name: sn, frac: total > 0 ? shareAmt[sn] / total : 1 / names.length }); });
  return { status: 'ok', total: total, shares: shares, codes: codes, baseRows: picked.length, creators: creators, baseNgayTao: baseYmd };
}


// Don GOC cua sale (yeu cau Duyen 2026-10-10): dong dau cua ghi chu Pos CHI la ma bo dem sach (vd "17T10/2026", "NG5T10/2026") — khong co
// hau to "/1 TACH", "(THEM)", "(hd)", "BH...", "+ ma khac". Ma do phai nam trong ghepCodes (da khop dong Base) thi moi la don goc co tren Base + Pos.
function _isOriginalCounterNote_(ghiChu, ghepCodes) {
  var first = String(ghiChu || '').split(/[\r\n]/)[0].trim();
  if (!first) return false;
  var m = /^([A-Za-z]{0,3}\d{1,6}[A-Za-z]{0,3}T\d{1,2}\/\d{2,4})$/.exec(first);
  if (!m) return false;
  var c = _normCounterCode_(m[1]);
  return (ghepCodes || []).some(function(x) { return _counterCodeNoYear_(x) === _counterCodeNoYear_(c); });
}

// ── DON POS TACH (yeu cau Duyen 2026-10-09) ──
// Don goc tren Base co ma bo dem dang "254T10/2026". Khi len Pos ma phai TACH thanh nhieu don (vd 2 don giao 2 dia chi), ghi chu noi bo
// (cot Q) cua tung don Pos co dang "254T10/2026/1 TACH ..." , "254T10/2026/2 TACH ..." (ma goc + "/" + so thu tu phan tach).
// QUY TAC: cac don Pos cung ma goc la MOT don duy nhat — doanh thu = tong cac phan (vd 9.000.000 + 8.540.000 = 17.540.000), dem 1 don,
// nen CS van la 1 don >=15tr de tinh hoa hong (truoc day tach thanh 2 don <15tr -> tinh sai muc hoa hong va dem 2 don).
// NGUYEN NHAN GOC cua loi: buildSalesReportB_ coi moi dong "dữ liệu đơn" la 1 don doc lap.
// Chi nhan dang khi sau ma co "/<nam>/<so>" (nam 2-4 so, so thu tu 1-2 so); ma khong co "/so" o cuoi (vd "254T10/2026") khong bi gop.
var TACH_DON_RE_SRC_ = '(^|[^A-Za-z0-9])([A-Za-z]{0,3}\\d{1,6}[A-Za-z]{0,3}T\\d{1,2})\\/(\\d{2,4})\\/(\\d{1,2})(?![A-Za-z0-9])';
// Tra ve { key: ma goc chuan hoa (vd "254T10/2026"), n: so thu tu phan tach } neu ghi chu co dang tach, nguoc lai null. Chi lay ma dau tien.
function _tachDonParse_(ghiChu) {
  if (ghiChu === null || ghiChu === undefined || ghiChu === '') return null;
  var str = String(ghiChu);
  if (str.indexOf('/') === -1) return null; // loc nhanh: khong co dau "/" thi chac chan khong phai ma tach
  var m = new RegExp(TACH_DON_RE_SRC_, 'i').exec(str);
  if (!m) return null;
  var yr = m[3]; if (yr.length === 2) yr = '20' + yr; // "254T10/26/1" == "254T10/2026/1"
  return { key: (m[2] + '/' + yr).replace(/\s+/g, '').toUpperCase(), n: parseInt(m[4], 10) };
}
function _tachDonKey_(ghiChu) { var t = _tachDonParse_(ghiChu); return t ? t.key : ''; }
// Gop cac dong Pos cung ma goc thanh 1 dong. Dong da Huy/Hoan (_donHasExcludedStatus_) KHONG tham gia gop va giu nguyen de bo loc
// o buildSalesReportB_ loai nhu cu (-> phan tach da hoan khong duoc cong vao doanh thu). Dong gop: ngay = ngay som nhat cac phan,
// giaTriSauGiam/cod = tong, the sale = hop (bo trung), san pham/ma/so luong noi theo thu tu (giu dung dau phan cach moi cot),
// them tachKey / tachSoDon / tachGiaTri[] de doi chieu. Nhom chi co 1 dong giu nguyen dong goc (khong them truong nao).
function _mergeTachDon_(rows) {
  var out = [], groups = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tp = _donHasExcludedStatus_(r.trangThai) ? null : _tachDonParse_(r.ghiChu);
    if (!tp) { out.push(r); continue; }
    var key = tp.key;
    if (!groups[key]) { groups[key] = { pos: out.length, parts: [], seen: {} }; out.push(null); }
    // LOAI TRUNG do import lap (yeu cau Duyen 2026-10-09): cung ma goc + cung so thu tu + cung SDT/ngay/gia tri/san pham = dong lap -> chi giu 1.
    // Khac noi dung (cung "/1" nhung gia tri/SDT khac) thi KHONG coi la lap (giu ca hai, tranh mat doanh thu).
    var sig = [tp.n, normPhone_(r.soDienThoai), r.ngayTaoDon, Number(r.giaTriSauGiam) || 0, r.maSanPham || r.sanPham || ''].join('|');
    if (groups[key].seen[sig]) continue;
    groups[key].seen[sig] = true;
    groups[key].parts.push(r);
  }
  Object.keys(groups).forEach(function(k) {
    var g = groups[k], parts = g.parts;
    if (parts.length === 1) { out[g.pos] = parts[0]; return; }
    var m = Object.assign({}, parts[0]);
    var total = 0, cod = 0, vals = [], sales = [], seenSale = {}, sp = [], ma = [], sl = [], notes = [], seenNote = {};
    var best = null, bestT = null;
    parts.forEach(function(p) {
      total += Number(p.giaTriSauGiam) || 0; cod += Number(p.cod) || 0; vals.push(Number(p.giaTriSauGiam) || 0);
      String(p.theSale || '').split(',').forEach(function(x) { x = x.trim(); var f = _normTxt_(x); if (x && !seenSale[f]) { seenSale[f] = true; sales.push(x); } });
      if (p.sanPham) sp.push(String(p.sanPham)); if (p.maSanPham) ma.push(String(p.maSanPham)); if (p.soLuong) sl.push(String(p.soLuong));
      var nt = String(p.ghiChu || '').trim(); if (nt && !seenNote[nt]) { seenNote[nt] = true; notes.push(nt); }
      if (!m.nguonDon && p.nguonDon) m.nguonDon = p.nguonDon;
      if (!m.marketer && p.marketer) m.marketer = p.marketer;
      var d = parseVNDate_(p.ngayTaoDon), t = d ? d.getTime() : NaN;
      if (!isNaN(t) && (bestT === null || t < bestT)) { bestT = t; best = p.ngayTaoDon; }
    });
    m.giaTriSauGiam = total; m.cod = cod; m.theSale = sales.join(', ');
    m.sanPham = sp.join(', '); m.maSanPham = ma.join(';'); m.soLuong = sl.join(', ');
    m.ghiChu = notes.join(' | ');
    if (best !== null) m.ngayTaoDon = best;
    m.tachKey = k; m.tachSoDon = parts.length; m.tachGiaTri = vals;
    out[g.pos] = m;
  });
  return out;
}

// ── DON QUAY HAO NAM CO GAN THE SALE + QUAY NOTE "30/70" (yeu cau Duyen 2026-10-04) ──
// Don chia quay co 2 dang: (1) DON GHEP — don A cua sale di cung don B cua quay: moi don chi tinh cho ben cua no (don
// quay khong co the sale nen sale khong duoc tinh; xu ly boi ghep don theo ma bo dem + don khong sale); (2) DON QUAY
// CO GAN THE SALE (khach do sale mang den, chi 1 don) — quay note "30/70": CHI 30% doanh thu chia cho cac sale tren the
// (chia deu tiep, vd 3 sale moi nguoi 10%), 70% la cua quay. Don Quay Hao Nam khong gan the sale -> khong co phan sale.
// Tra ve 0.3 neu dung dang (2), nguoc lai 1.
var QUAY_SALE_RATIO_ = 0.3;
function _quaySaleRatio_(nguonDon, ghiChu, hasSale) {
  if (!hasSale) return 1;
  // QUY TAC CHOT 2026-10 (Duyen): don Pos NGUON CUA HANG (Quay Hao Nam / Cua hang) co gan the sale => chia 30/70,
  // 30% la phan cua sale (chia deu tiep cho cac sale tham gia), 70% la cua quay. KHONG con bat buoc ghi chu
  // phai ghi '30/70' nhu ban truoc. Bo dau truoc khi so de khop bat ke hoa/thuong/dau.
  var nguonFold = String(nguonDon || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  if (nguonFold.indexOf('quay hao nam') !== -1 || nguonFold.indexOf('cua hang') !== -1) return QUAY_SALE_RATIO_;
  return 1;
}

// ── THUONG CHI TINH CHO NGUOI TAO DON (yeu cau Duyen 2026-10-07) ──
// Quy tac: chi tinh don len o Pos; doc ghi chu Pos lay ma bo dem -> tra don do o Base -> lay "Nguoi tao" (cot B).
// Nguoi tao PHAI la sale thi moi duoc tinh THUONG, va CHI nguoi tao nhan thuong. Sale ban cung chi duoc tinh DOANH THU
// (phan chia nhu cu) vi thuong da tinh cho sale tao. VD don 131T10/2026: Pos co 2 sale minh quach + ninhltk nhung nguoi
// tao tren Base la minh quach -> thuong CHI cho minh quach (TRUOC DAY thuong tinh cho ca 2 sale tren don, nen ninhltk1984
// nhan thuong sai). Tra ve ten sale CHUAN (theo danh sach sale cua don) hoac '' neu nguoi tao khong phai sale.
// candidateNames: ten sale tren don (ghepShares + the Pos) de doi chieu; so khop theo alias Pancake (usernames <-> ten chuan)
// va theo dang bo dau/bo khoang trang/bo so cuoi ("Minh Quách" ~ "minhquach1995").
function _foldSaleKey_(s) { return _stripVN_(String(s || '')).replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''); }
function _resolveBonusSale_(creators, candidateNames, aliasMemo) {
  var out = [];
  (creators || []).forEach(function(cr) {
    if (!cr) return;
    var crFold = _normTxt_(cr), crKey = _foldSaleKey_(cr), crKeyNoDigit = crKey.replace(/[0-9]+$/, '');
    var hit = '';
    for (var i = 0; i < candidateNames.length && !hit; i++) {
      var cand = candidateNames[i];
      if (!cand || cand === '(chưa gán sale)') continue;
      var aliases = aliasMemo[cand];
      if (!aliases) aliases = aliasMemo[cand] = _expandSaleFilterWithPancakeAliases_([cand]).map(_normTxt_);
      if (aliases.indexOf(crFold) !== -1) { hit = cand; break; }
      var cKey = _foldSaleKey_(cand), cKeyNoDigit = cKey.replace(/[0-9]+$/, '');
      if (cKey === crKey || (cKeyNoDigit && cKeyNoDigit === crKeyNoDigit && cKeyNoDigit.length >= 4)) hit = cand;
    }
    // Nguoi tao khong nam tren the sale cua don nhung la sale da biet (Pancake) -> van la sale, tinh thuong cho chinh ho.
    if (!hit && _pancakeKnownSaleNameSet_()[crFold]) hit = cr;
    if (hit && out.indexOf(hit) === -1) out.push(hit);
  });
  return out;
}

// ── FILE KE TOAN "THEO DÕI ĐƠN CHIA SALE" (yeu cau Duyen 2026-10) ──
// Ke toan ghi tay cac don CHIA SALE KHONG DEU. Cot: Kenh ban | Sale ban | Gia tri coc | Tong gia tri don (ko ship) |
// Gia tri chenh | Ma bo dem | (tuy chon, them o cot cuoi) "Xac nhan". Cung quy uoc voi DT TONG: 1 don co the nam tren NHIEU dong
// cung Ma bo dem; moi dong co the co nhieu sale (chia deu trong dong do). Tien cua 1 sale = tong (gia tri dong / so sale dong).
// Quy tac cho don Pos co ma bo dem trong ghi chu KHOP 1 ma trong file ke toan:
//  - Tong gia tri ke toan = gia tri Pos (lech <= 1d)  -> dung TY LE CHIA cua ke toan (tong tien van la gia tri Pos)
//  - Tong LECH gia tri Pos                            -> GIU gia tri + cach chia cua Pos, dua vao danh sach "can xac nhan";
//    khi Duyen dien dau "x"/"co"/"ok"/"1" vao cot "Xac nhan" cua dong do thi moi dung so cua ke toan.
// Dong khong co Ma bo dem, hoac ma khong khop don Pos nao trong ky -> liet ke "chua khop" de kiem tra tay, KHONG tu doan.
var ACCT_SPLIT_SS_ID_ = '1gJtyOfdyKjO4XMmsC3KLNSU_Z5mOGTI1edmCT1sF1q4';
function _acctCodeNoYear_(c) { return String(c || '').replace(/\/\d{2,4}$/, ''); }
function _loadAcctSplit_() {
  var out = { rows: [], byCode: {}, byCodeNoYear: {}, err: '' };
  try {
    var cache = CacheService.getScriptCache(), cached = cache.get('acct_split_v1');
    var rowsRaw;
    if (cached) { rowsRaw = JSON.parse(cached); }
    else {
      var sh = SpreadsheetApp.openById(ACCT_SPLIT_SS_ID_).getSheets()[0];
      var vals = sh.getDataRange().getValues();
      var hi = -1, col = {};
      for (var i = 0; i < Math.min(vals.length, 8) && hi < 0; i++) {
        if (vals[i].some(function(c) { return _stripVN_(String(c || '')).indexOf('ma bo dem') !== -1; })) hi = i;
      }
      if (hi < 0) hi = 0;
      vals[hi].forEach(function(c, ci) {
        var k = _stripVN_(String(c || '')).trim();
        if (!k) return;
        if (k.indexOf('kenh') !== -1 && col.kenh === undefined) col.kenh = ci;
        else if (k.indexOf('sale') !== -1 && col.sale === undefined) col.sale = ci;
        else if (k.indexOf('coc') !== -1 && col.coc === undefined) col.coc = ci;
        else if (k.indexOf('chenh') !== -1 && col.chenh === undefined) col.chenh = ci;
        else if (k.indexOf('tong') !== -1 && col.tong === undefined) col.tong = ci;
        else if (k.indexOf('ma bo dem') !== -1 && col.code === undefined) col.code = ci;
        else if (k.indexOf('xac nhan') !== -1 && col.xn === undefined) col.xn = ci;
      });
      if (col.sale === undefined) { col = { kenh: 1, sale: 2, coc: 3, tong: 4, chenh: 5, code: 6, xn: 7 }; } // vi tri co dinh nhu file mau (A trong)
      rowsRaw = [];
      for (var r = hi + 1; r < vals.length; r++) {
        var v = vals[r];
        var sales = String(v[col.sale] || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
        var tong = _normMoney_(v[col.tong]);
        var code = col.code !== undefined ? _normCounterCode_(v[col.code]) : '';
        if (!sales.length && !tong && !code) continue; // dong trong
        var xnRaw = col.xn !== undefined ? _stripVN_(String(v[col.xn] || '')).trim() : '';
        rowsRaw.push({ line: r + 1, kenh: String(v[col.kenh] || '').trim(), sales: sales, coc: _normMoney_(v[col.coc]),
          tong: tong, chenh: _normMoney_(v[col.chenh]), code: code,
          confirmed: !!xnRaw && ['0', 'khong', 'no', 'chua', 'false'].indexOf(xnRaw) === -1 });
      }
      try { cache.put('acct_split_v1', JSON.stringify(rowsRaw), 60); } catch (ec) {}
    }
    out.rows = rowsRaw;
    rowsRaw.forEach(function(rw) {
      if (!rw.code) return;
      (out.byCode[rw.code] = out.byCode[rw.code] || []).push(rw);
      var ny = _acctCodeNoYear_(rw.code);
      (out.byCodeNoYear[ny] = out.byCodeNoYear[ny] || []).push(rw);
    });
  } catch (e) { out.err = String(e && e.message || e); }
  return out;
}
// Khop CHINH XAC truoc; neu khong co thi khop bo nam (vd ghi chu "17T10" ~ ke toan "17T10/2026"). Tra { code, rows } hoac null.
function _acctMatchCodes_(acct, codes) {
  for (var i = 0; i < codes.length; i++) {
    var c = _normCounterCode_(codes[i]);
    if (acct.byCode[c]) return { code: c, rows: acct.byCode[c] };
  }
  for (var j = 0; j < codes.length; j++) {
    var ny = _acctCodeNoYear_(_normCounterCode_(codes[j]));
    if (acct.byCodeNoYear[ny]) return { code: ny, rows: acct.byCodeNoYear[ny] };
  }
  return null;
}
// Tong + ty le chia tung sale tu cac dong ke toan cua 1 don: [{name, frac}], tong frac = 1.
function _acctSharesOf_(rows) {
  var total = 0, amt = {}, order = [];
  rows.forEach(function(rw) {
    total += rw.tong;
    var n = rw.sales.length;
    if (!n) return;
    rw.sales.forEach(function(nm) { if (!(nm in amt)) { amt[nm] = 0; order.push(nm); } amt[nm] += rw.tong / n; });
  });
  var shares = [];
  if (total > 0) order.forEach(function(nm) { shares.push({ name: nm, frac: amt[nm] / total }); });
  return { total: total, shares: shares };
}

function buildSalesReportB_(filters) {
  filters = filters || {};
  // Ho tro CA mang (multi-select) LAN chuoi don (tuong thich nguoc) cho ca 3 bo loc.
  function toArr(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v).trim()] : []); }
  var saleFilterArr = _expandSaleFilterWithPancakeAliases_(toArr(filters.sale));
  var saleFilterFold = saleFilterArr.map(_normTxt_);
  var wantSaleB_ = _saleWantedFn_(saleFilterFold);
  var nguonFilterArr = toArr(filters.nguon);
  var marketerFilterArr = toArr(filters.marketer);
  var careStatusArr = toArr(filters.careStatus);
  var khStatusArr = toArr(filters.khStatus);
  var zaloStatusArr = toArr(filters.zaloStatus);
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);
  var nickZaloTerm = filters.nickZalo ? _psheetNoAccent_(String(filters.nickZalo).trim()) : '';
  var UNASSIGNED = '(chưa gán sale)';

  // THEM 2026-09: Theo Team / Theo Nguon / Theo MKT — de Bao cao B (Pos) co cau truc giong
  // Bao cao A (Base), giu nguyen phan "Bao cao san pham" rieng cua B.
  // Luu y: Bao cao B KHONG co truong tuong duong "kenhBan" (Page FB/Zalo) nhu Bao cao A — chi
  // co "nguonDon" (nguon don, vd Pancake/Website...), nen KHONG the tinh "Ty le chot theo
  // Kenh/Page" (can khop PancakePageMap) cho Bao cao B — phan nay co chu dinh BO QUA, xem ghi
  // chu o cuoi ham.
  var UNASSIGNED_TEAM = '(chưa có Team)';
  var _resolveTeamForSaleB_ = _makeTeamResolver_(UNASSIGNED_TEAM);   // theo NGƯỜI (nhiều tên) + bảng khớp tên Pancake
  var byTeamSale = {}; // ten team -> { orders, giaTri, cod }
  var bySaleDay = {};  // CHI khi filters.withDaily (v13.24, ho so nhan su): ten sale -> { 'YYYY-MM-DD': [soDon, giaTri] } — cung quy uoc chia fr nhu bySale
  var byNguon = {};    // nguon don -> { orders, giaTri, cod } — tuong duong "Theo Kenh ban" cua Bao cao A
  var byMktObj = {};   // ten Marketer (co san tren tung dong, khong can suy ra qua Page) -> { orders, giaTri, cod }
  var UNASSIGNED_MKT = '(chưa gán MKT)';

  // Chi doc CareData khi thuc su co loc theo CRM — tranh doc them 1 sheet khi khong can.
  var needCare = careStatusArr.length || khStatusArr.length || zaloStatusArr.length || nickZaloTerm;
  var careMap = needCare ? _careMapByPhone_() : null;

  var rows = _mergeTachDon_(readDonChiTiet_()); // gop don Pos TACH (ghi chu "<ma>/2026/1", "/2") thanh 1 don truoc khi loc — xem _mergeTachDon_
  // VONG 1: loc theo ngay/trang thai/nguon/marketer/san pham/CRM (KHONG loc Sale o day — Sale phai xet SAU khi
  // ghep don Base, vi don ghep chia theo sale cua don goc Base chu khong theo cot "Thẻ" cua Pos).
  var pre = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var dt = parseVNDate_(row.ngayTaoDon);
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) continue;
    if (_donHasExcludedStatus_(row.trangThai)) continue; // bo don Da hoan/Dang hoan (Pos) — CHI xet theo cot "Trạng thái" rieng (cot O), khong xet cot "Thẻ" nua
    if (nguonFilterArr.length && nguonFilterArr.indexOf(row.nguonDon) === -1) continue;
    if (marketerFilterArr.length && marketerFilterArr.indexOf(row.marketer) === -1) continue;
    if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
    if (needCare) {
      var care = careMap[normPhone_(row.soDienThoai)] || null;
      if (careStatusArr.length && !(care && careStatusArr.indexOf(care.status) !== -1)) continue;
      if (khStatusArr.length && !(care && khStatusArr.indexOf(care.khStatus) !== -1)) continue;
      if (zaloStatusArr.length && !(care && zaloStatusArr.indexOf(care.zalo) !== -1)) continue;
      if (nickZaloTerm) {
        var nicks = (care && care.nickZalos) || [];
        var nickHit = nicks.some(function(n){ return _psheetNoAccent_(n).indexOf(nickZaloTerm) !== -1; });
        if (!nickHit) continue;
      }
    }
    pre.push(row);
  }

  // GHEP DON POS <-> BASE (cot Q ghi chu): tach ma bo dem tu ghi chu, chi doc "DT TỔNG " khi THUC SU co ma.
  var codesByRow = [], wantedCodes = {}, anyCodes = false;
  for (var pi = 0; pi < pre.length; pi++) {
    var cds = POS_GHEP_BASE_ENABLED_ ? _extractCounterCodes_(pre[pi].ghiChu) : [];
    if (cds.length < POS_GHEP_MIN_CODES_) cds = []; // chi don ghep (>=2 ma) moi check nguoc Base; 1 ma -> tinh thuan Pos
    codesByRow.push(cds);
    if (cds.length) { anyCodes = true; cds.forEach(function(c) { wantedCodes[c] = true; }); }
  }
  var baseIdx = null;
  var ghepErr = '', ghepMs = 0;
  if (anyCodes) {
    // Loi/khong doc duoc Base -> KHONG lam hong ca bao cao: roi ve cach chia Pos nhu cu va bao trong ghep.loi.
    var tG0 = Date.now();
    try { baseIdx = _readBaseRowsByCounterCodes_(wantedCodes); ghepMs = Date.now() - tG0; }
    catch (eG) { ghepErr = String(eG && eG.message || eG); baseIdx = { exact: {}, fuzzy: {}, colIdx: -2 }; }
  }
  var acctInfo = _loadAcctSplit_();
  var acctUsedCodes = {};
  var acctStats = { applied: 0, confirmed: 0, needConfirm: [], needConfirmCount: 0, unmatched: [], err: acctInfo.err, rowCount: acctInfo.rows.length };
  var ghepCheck = [];   // don CHI GAN CO (khong tu sua tien): ghi chu co "ghep" hoac >=2 ma khong phai bao hanh -> doi chieu tay
  var ghepCheckCount = 0;
  var usedBaseRows = {};
  var aliasMemoB_ = {};
  // SUA 2026-10-06: khongKhop[]/trungDonGoc[] CHI giu toi da 30 vi du de tra ve (tranh phinh to
  // response) — nhung truoc day lay dung .length cua 2 mang nay lam "so don khong ghep duoc" hien
  // canh bao, nen thang nao co that >30 don loai nay se BI HIEN SAI THANH DUNG 30 (chan tran am
  // tham). Them 2 bo dem rieng (count) KHONG bi gioi han, tang moi lan bat ke mang vi du co con
  // cho hay khong — dung 2 bo dem nay moi la so that de hien thi/canh bao, 2 mang [] chi de liet
  // ke VI DU (toi da 30 dong) phia sau.
  var ghepStats = { donCoMa: 0, daGhep: 0, gocBiLoai: 0, khongKhop: [], khongKhopCount: 0, trungDonGoc: [], trungDonGocCount: 0 };
  var hiddenB_ = _donHiddenChecker_();
  var matched = [];
  for (var pj = 0; pj < pre.length; pj++) {
    var rowP = pre[pj];
    var gh = codesByRow[pj].length ? _resolveGhepDon_(codesByRow[pj], baseIdx, usedBaseRows) : null;
    var effRow = rowP;
    if (gh) {
      ghepStats.donCoMa++;
      if (gh.status === 'ok') {
        ghepStats.daGhep++;
        var candSales = gh.shares.map(function(x) { return x.name; });
        _donSaleNamesFromThe_(rowP.theSale).forEach(function(nm) { if (candSales.indexOf(nm) === -1) candSales.push(nm); });
        var bonusList = _resolveBonusSale_(gh.creators, candSales, aliasMemoB_);
        effRow = Object.assign({}, rowP, { giaTriPos: rowP.giaTriSauGiam, giaTriSauGiam: gh.total, ghepShares: gh.shares, ghepCodes: gh.codes,
          ghepCreators: gh.creators || [], baseNgayTao: gh.baseNgayTao || '', bonusSale: bonusList.join(',') }); // bonusSale = '' -> nguoi tao khong phai sale -> khong ai nhan thuong
      } else if (gh.status === 'gocBiLoai') {
        ghepStats.gocBiLoai++;
        continue; // moi don goc Base deu Huy/Hoan -> bo don Pos nay khoi bao cao (giong don Pos "Đã hoàn")
      } else {
        var wInfo = { ngay: rowP.ngayTaoDon, sdt: rowP.soDienThoai, ghiChu: String(rowP.ghiChu || '').substring(0, 120), maCoDon: gh.codes, maKhongTim: gh.missing };
        if (gh.status === 'khongKhop') { ghepStats.khongKhopCount++; if (ghepStats.khongKhop.length < 30) ghepStats.khongKhop.push(wInfo); }
        else { ghepStats.trungDonGocCount++; if (ghepStats.trungDonGoc.length < 30) ghepStats.trungDonGoc.push(wInfo); }
      }
    }
    // ── FILE KE TOAN: ma bo dem khop dong trong "THEO DOI DON CHIA SALE" -> dung ty le chia cua ke toan (xem chu thich o _loadAcctSplit_) ──
    if (!effRow.ghepShares && acctInfo.rows.length) {
      var cdsA = _extractCounterCodes_(rowP.ghiChu);
      var am = cdsA.length ? _acctMatchCodes_(acctInfo, cdsA) : null;
      if (am) {
        var calc = _acctSharesOf_(am.rows);
        var posVal = Number(rowP.giaTriSauGiam) || 0;
        var confirmedAll = am.rows.every(function(rw) { return rw.confirmed; });
        acctUsedCodes[am.code] = true;
        if (calc.total > 0 && calc.shares.length) {
          if (Math.abs(calc.total - posVal) <= 1) {
            acctStats.applied++;
            effRow = Object.assign({}, rowP, { ghepShares: calc.shares, ghepCodes: [am.code], acctStatus: 'ok' });
          } else if (confirmedAll) {
            acctStats.confirmed++;
            effRow = Object.assign({}, rowP, { giaTriPos: posVal, giaTriSauGiam: calc.total, ghepShares: calc.shares, ghepCodes: [am.code], acctStatus: 'daXacNhan' });
          } else {
            acctStats.needConfirmCount++;
            if (acctStats.needConfirm.length < 50) acctStats.needConfirm.push({ ngay: rowP.ngayTaoDon, sdt: rowP.soDienThoai, theSale: rowP.theSale,
              ma: am.code, giaPos: posVal, giaKeToan: calc.total, chenh: posVal - calc.total, dongKeToan: am.rows.map(function(rw) { return rw.line; }) });
          }
        }
      }
    }
    // Loc Sale: don ghep -> theo sale cua don goc Base; don thuong -> theo cot "Thẻ" nhu cu.
    if (saleFilterArr.length) {
      var salesOnRow = [];
      if (effRow.ghepShares) {
        // Ten sale tren Base la ten CHUAN, con bo loc co the dang chon ten Pancake (alias) — mo rong moi ten
        // chuan thanh {ten chuan + cac alias Pancake} (memo theo ten, tranh doc lai PancakeMap cho moi don).
        effRow.ghepShares.forEach(function(x) {
          if (!aliasMemoB_[x.name]) aliasMemoB_[x.name] = _expandSaleFilterWithPancakeAliases_([x.name]).map(_normTxt_);
          aliasMemoB_[x.name].forEach(function(a) { salesOnRow.push(a); });
        });
      } else {
        salesOnRow = _donSaleNamesFromThe_(effRow.theSale).map(_normTxt_);
      }
      var hit = false;
      for (var si = 0; si < saleFilterFold.length; si++) { if (salesOnRow.indexOf(saleFilterFold[si]) !== -1) { hit = true; break; } }
      if (!hit) continue;
    }
    // AN theo cai dat admin (hiddenSales/hiddenChannels) — giong Bao cao A: don chi bi an khi MOI sale tren don deu bi an; hoac kenh bi an.
    if (hiddenB_) {
      var namesH = effRow.ghepShares ? effRow.ghepShares.map(function(x) { return x.name; }) : _donSaleNamesFromThe_(effRow.theSale);
      namesH = namesH.filter(function(n) { return n && n !== '(chưa gán sale)'; });
      if (namesH.length && namesH.every(hiddenB_.saleHidden)) continue;
      if (hiddenB_.channelHidden(effRow.nguonDon)) continue;
    }
    // Don Quay Hao Nam gan the sale + note 30/70 -> chi 30% doanh thu la cua sale (xem _quaySaleRatio_)
    var hasSaleRow = effRow.ghepShares
      ? effRow.ghepShares.some(function(x) { return x.name !== '(chưa gán sale)'; })
      : _donSaleNamesFromThe_(effRow.theSale).length > 0;
    var qRatio = _quaySaleRatio_(effRow.nguonDon, effRow.ghiChu, hasSaleRow);
    if (qRatio !== 1) effRow = Object.assign({}, effRow, { saleRatio: qRatio });
    // Gan co don can doi chieu ghep (KHONG doi tien): chua duoc ke toan xu ly + (ghi chu co chu "ghep" HOAC >=2 ma bo dem khong phai
    // ma bao hanh BH...). Thang 9: da so don co 2 ma la don bao hanh (tien rat nho) nen KHONG tu ghep Base — de Duyen/ke toan quyet.
    if (!effRow.ghepShares) {
      var cdsC = _extractCounterCodes_(effRow.ghiChu);
      var nonBH = cdsC.filter(function(c) { return _normCounterCode_(c).indexOf('BH') !== 0; });
      var hasGhepWord = _stripVN_(String(effRow.ghiChu || '')).indexOf('ghep') !== -1;
      if (nonBH.length >= 2 || (hasGhepWord && cdsC.length)) {
        ghepCheckCount++;
        if (ghepCheck.length < 60) ghepCheck.push({ ngay: effRow.ngayTaoDon, sdt: effRow.soDienThoai, theSale: effRow.theSale,
          gia: effRow.giaTriSauGiam, ghiChu: String(effRow.ghiChu || '').substring(0, 120), ma: cdsC });
      }
    }
    matched.push(effRow);
  }
  // Dong ke toan CHUA khop don Pos nao trong ky (khong co ma / ma khong xuat hien) -> liet ke de kiem tra tay.
  acctInfo.rows.forEach(function(rw) {
    var used = rw.code && (acctUsedCodes[rw.code] || acctUsedCodes[_acctCodeNoYear_(rw.code)]);
    if (!used && acctStats.unmatched.length < 50) acctStats.unmatched.push({ dong: rw.line, kenh: rw.kenh, sale: rw.sales.join(', '), tong: rw.tong, ma: rw.code || '(trống)' });
  });

  var totalGiaTri = 0, totalCod = 0;
  var products = {}; // maSanPham -> { name, soLuong }
  var bySale = {};   // ten sale -> { orders, giaTri, cod } — tien CHIA DEU cho so sale/don, so don GIU NGUYEN

  for (var j = 0; j < matched.length; j++) {
    var m = matched[j];
    totalGiaTri += m.giaTriSauGiam;
    totalCod += m.cod;

    // Breakdown theo Sale (cot "Thẻ") — dung dung quy uoc da chot o Bao cao A: so don giu
    // nguyen (khong chia), tien (Gia tri sau giam + COD) chia deu cho so sale/don de tranh cong
    // trung khi tong theo team. Don khong co sale nao gom vao "(chưa gán sale)".
    // Don GHEP voi Base (m.ghepShares): tien chia theo ty le doanh thu cua tung don goc ben Base (da tinh san
    // trong ghepShares[].frac, tong = 1) — KHONG chia deu theo cot "Thẻ" nua. Don thuong: chia deu nhu cu.
    var salesOnOrder, fracOf;
    if (m.ghepShares && m.ghepShares.length) {
      var fracMap = {};
      salesOnOrder = m.ghepShares.map(function(x) { fracMap[x.name] = x.frac; return x.name; });
      fracOf = function(nm) { return fracMap[nm]; };
    } else {
      salesOnOrder = _donSaleNamesFromThe_(m.theSale);
      if (salesOnOrder.length === 0) salesOnOrder = [UNASSIGNED];
      var evenFrac = 1 / salesOnOrder.length;
      fracOf = function() { return evenFrac; };
    }
    var teamsOnOrderB = {};
    for (var si2 = 0; si2 < salesOnOrder.length; si2++) {
      var sName = salesOnOrder[si2];
      if (!wantSaleB_(sName)) continue;   // dang loc Sale: khong liet ke nguoi dong ban nam ngoai bo loc (frac van theo ca don nen tien cua tung nguoi khong doi)
      var fr = fracOf(sName) * (m.saleRatio || 1); // saleRatio 0.3 = don Quay 30/70 (phan con lai 70% la cua quay)
      if (!bySale[sName]) bySale[sName] = { orders: 0, giaTri: 0, cod: 0 };
      bySale[sName].orders += 1;
      bySale[sName].giaTri += m.giaTriSauGiam * fr;
      bySale[sName].cod += m.cod * fr;
      if (filters.withDaily) { var ddB = _vnYmd_(parseVNDate_(m.ngayTaoDon)); if (ddB) { var sdB = bySaleDay[sName] || (bySaleDay[sName] = {}); var cB = sdB[ddB] || (sdB[ddB] = [0, 0]); cB[0] += 1; cB[1] += m.giaTriSauGiam * fr; } }

      // Theo Team Sale — cung quy uoc chia nhu bySale; so don theo Team dem 1 lan cho moi
      // TEAM KHAC NHAU xuat hien tren don (tranh cong trung khi 2 sale cung team dung 1 don).
      var tNameB = _resolveTeamForSaleB_(sName);
      if (!byTeamSale[tNameB]) byTeamSale[tNameB] = { orders: 0, giaTri: 0, cod: 0 };
      byTeamSale[tNameB].giaTri += m.giaTriSauGiam * fr;
      byTeamSale[tNameB].cod += m.cod * fr;
      teamsOnOrderB[tNameB] = true;
    }
    Object.keys(teamsOnOrderB).forEach(function(tNameB2) { byTeamSale[tNameB2].orders += 1; });

    // Theo Nguồn đơn — tương đương "Theo Kênh bán" của Báo cáo A nhưng dùng đúng cột "Nguồn
    // đơn" sẵn có của Báo cáo B (nguonDon là single-value/đơn, không chia như sale).
    var nguonNameB = m.nguonDon || '(chưa có nguồn)';
    if (!byNguon[nguonNameB]) byNguon[nguonNameB] = { orders: 0, giaTri: 0, cod: 0 };
    byNguon[nguonNameB].orders += 1;
    byNguon[nguonNameB].giaTri += m.giaTriSauGiam;
    byNguon[nguonNameB].cod += m.cod;

    // Theo MKT — Báo cáo B có sẵn cột "Marketer" trên từng đơn (không cần suy ra qua Page/Kênh
    // như Báo cáo A), nên lấy trực tiếp, đơn giản và chính xác hơn.
    var mktNameB = m.marketer || UNASSIGNED_MKT;
    if (!byMktObj[mktNameB]) byMktObj[mktNameB] = { orders: 0, giaTri: 0, cod: 0 };
    byMktObj[mktNameB].orders += 1;
    byMktObj[mktNameB].giaTri += m.giaTriSauGiam;
    byMktObj[mktNameB].cod += m.cod;

    // Quan trong: 3 cot dung 3 dau phan cach KHAC NHAU trong cung 1 don:

    //  - San pham (ten):     phan cach bang ','
    //  - Ma san pham (khoa):  phan cach bang ';'
    //  - So luong:            phan cach bang ','
    // Tach rieng tung cot theo dung dau cua no, sau do ghep theo VI TRI (index).
    var names = splitMulti_(m.sanPham, ',');
    var codes = splitMulti_(m.maSanPham, ';');
    var qtys  = splitMulti_(m.soLuong, ',');

    var len = Math.max(names.length, codes.length, qtys.length);
    if (len === 0) continue;
    if (names.length !== codes.length || names.length !== qtys.length) {
      // canh bao lech cot: van xu ly toi da co the, ghep theo index, thieu thi bo trong
    }
    for (var p = 0; p < len; p++) {
      var code = codes[p] || ('(không rõ mã #' + (p+1) + ')');
      var name = names[p] || code;
      var qty  = Number((qtys[p] || '0').replace(',', '.')) || 0;
      if (!products[code]) products[code] = { name: name, code: code, soLuong: 0, mismatchRows: 0 };
      products[code].soLuong += qty;
    }
    if (names.length !== codes.length || names.length !== qtys.length) {
      // dong sai lech: dung mot key rieng de dem canh bao tong the
      if (!products['__MISMATCH__']) products['__MISMATCH__'] = { name: '(dòng lệch cột — kiểm tra tay)', code: '__MISMATCH__', soLuong: 0, mismatchRows: 0 };
      products['__MISMATCH__'].mismatchRows += 1;
    }
  }

  var productArr = [];
  for (var key in products) {
    if (key === '__MISMATCH__') continue;
    productArr.push(products[key]);
  }
  productArr.sort(function(a, b){ return b.soLuong - a.soLuong; });

  // THEO YEU CAU DUYEN 2026-10: bang "Theo Sale" cua rieng Bao cao B (Pos) BO HAN dong
  // "(chưa gán sale)" khoi hien thi (don khong co ai tren cot "Thẻ" khong con gom thanh 1
  // dong rieng trong bang nay nua). CHI anh huong bang bySaleArr nay (Theo Sale cua B) — KHONG
  // dong voi "Ty le chot theo Sale" (saleCloseRate, tinh qua _srCloseRateSections_ dung chung
  // voi Bao cao A, khong duoc yeu cau doi) va KHONG dong voi "(chưa có Team)" cua bang Theo Team
  // (khai niem khac, khong lien quan yeu cau nay).
  var bySaleArr = [];
  for (var skey in bySale) { if (skey === UNASSIGNED) continue; bySaleArr.push({ name: skey, orders: bySale[skey].orders, giaTri: bySale[skey].giaTri, cod: bySale[skey].cod }); }
  bySaleArr.sort(function(a, b){ return b.giaTri - a.giaTri; });

  // Format chung cho 3 bang moi (Theo Team/Theo Nguon/Theo MKT) — cung hinh dang {name, orders,
  // giaTri, cod, trungBinhDon} nhu cac bang tuong ung cua Bao cao A de frontend dung chung UI.
  function toArrB_(obj) {
    var arr = [];
    for (var k in obj) {
      arr.push({ name: k, orders: obj[k].orders, giaTri: obj[k].giaTri, cod: obj[k].cod,
                 trungBinhDon: obj[k].orders ? Math.round(obj[k].giaTri / obj[k].orders) : 0 });
    }
    arr.sort(function(a, b){ return b.giaTri - a.giaTri; });
    return arr;
  }
  var byTeamSaleArr = toArrB_(byTeamSale);
  var byNguonArr = toArrB_(byNguon);
  var byMktArrB = toArrB_(byMktObj);

  // Ty le chot theo Sale/Kenh/Page — dung LAI CHINH XAC cong thuc cua Bao cao A qua ham dung
  // chung _srCloseRateSections_. Khac biet duy nhat voi A: "kenhBan" cua moi don B khong co san
  // (B chi co "Nguon don") nen phai tu suy ra "kenhBan" chuan tu chuoi Nguon don, THU 2 CACH
  // theo dung yeu cau Duyen 2026-10 ("khớp theo tên Page HOẶC Id Page"):
  //   1) Trich ID Page o cuoi chuoi (vd "Facebook / Hiền Phạm Tourmaline (862972056891669)" ->
  //      "862972056891669") roi tra qua PancakePageMap (readPancakePageMap_, khoa=pageId).
  //   2) Neu (1) khong ra ket qua (khong co ID, vd "Bảo hành", "Quầy Hào Nam", "Fb Phạm Thu
  //      Hiền" go tay khong theo chuan) — thu tiep trich TEN Page (bo tien to "Nen tang / " +
  //      hau to "(ID)" neu co) va tra qua readPancakePageMapByName_ (khoa=pageName chuan hoa).
  // Don khong khop duoc o CA 2 cach (chua tung duoc admin khop Page nao trong PancakePageMap)
  // moi thuc su bi bo qua o buoc tinh ty le chot, giong cach A bo qua kenh chua khop Page.
  var closeSectionsB_ = _srFilterCloseBySale_(_srCloseRateSectionsFromBase_(filters), filters.sale);   // cùng nguồn với Báo cáo A: TLC luôn tính theo Base; bộ lọc Sale áp cả lên biểu đồ này

  var mismatchCount = products['__MISMATCH__'] ? products['__MISMATCH__'].mismatchRows : 0;

  return {
    totalOrders: matched.length,
    totalGiaTri: totalGiaTri,
    totalCod: totalCod,
    products: productArr,
    bySale: bySaleArr,
    bySaleDay: filters.withDaily ? bySaleDay : undefined,
    byTeamSale: byTeamSaleArr,
    byNguon: byNguonArr,
    byMkt: byMktArrB,
    saleCloseRate: closeSectionsB_.saleCloseRate,
    saleCloseRateFrom: closeSectionsB_.closeFrom,
    saleCloseRateExcluded: closeSectionsB_.closeExcluded || null,
    kenhCloseRate: closeSectionsB_.kenhCloseRate,
    kenhCloseRateFrom: closeSectionsB_.closeFrom,
    saleCloseByPage: closeSectionsB_.saleCloseByPage,
    trungBinhDon: matched.length ? Math.round(totalGiaTri / matched.length) : 0,
    mismatchRows: mismatchCount, // so dong bi lech so cot giua san pham/ma/so luong — nen kiem tra tay
    acct: acctStats,
    ghepCheck: { count: ghepCheckCount, list: ghepCheck },
    ghep: (function(){ ghepStats.cotBase = baseIdx ? baseIdx.colIdx : null; ghepStats.loi = ghepErr; ghepStats.msDocBase = ghepMs; return ghepStats; })(), // thong ke ghep don Pos<->Base: donCoMa, daGhep, khongKhopCount/trungDonGocCount (SO THAT, khong gioi han) + khongKhop[]/trungDonGoc[] (toi da 30 VI DU dau tien, dung .xxxCount de hien so luong, KHONG dung .length cua 2 mang nay — da tung bi chan tran am tham o 30)
    orders: matched.map(function(m){
      return {
        ngayTaoDon: m.ngayTaoDon, khachHang: m.khachHang, soDienThoai: m.soDienThoai,
        posRow: m.posRow || undefined,   // dong that trong sheet "dữ liệu đơn" (de doi chieu tung don voi file Pancake goc — xem sheet chi tiet cua nut Xuat Excel doi chieu Bao cao B)
        nguonDon: m.nguonDon, theSale: m.theSale, trangThai: m.trangThai, sanPham: m.sanPham, maSanPham: m.maSanPham, soLuong: m.soLuong,
        giaTriSauGiam: m.giaTriSauGiam, cod: m.cod, marketer: m.marketer,
        // Ghi chu don Pos (cot Q) — CHUA ma don Pos de ke toan doi chieu (xuat Excel Bao cao G dung field nay). Cat 300 ky tu de payload khong phinh.
        ghiChu: String(m.ghiChu || '').substring(0, 300),
        // Don GHEP voi Base: giaTriSauGiam o tren = tong doanh thu cac don goc Base (da thay gia tri Pos); giaTriPos = gia tri Pos
        // goc (de doi chieu); saleShares = ty le chia cho tung sale cua don goc (tong = 1); ghepCodes = ma bo dem da khop.
        giaTriPos: m.ghepShares ? m.giaTriPos : undefined,
        saleShares: m.ghepShares || undefined,
        saleRatio: m.saleRatio || undefined, // 0.3 = don Quay Hao Nam gan the sale + note 30/70
        ghepCodes: m.ghepCodes || undefined,
        // BAO CAO TINH DON THUAN (20/10/2026, Duyen): saleThe = sale theo DUNG cot "Thẻ" (chia deu) — KHONG ghep Base / KHONG file ke toan / KHONG quay 30/70.
        // dieuChinh = 'acct' (chia theo file ke toan) | 'base' (ghep don Base); don co saleRatio cung la don da dieu chinh (client xuat Excel doi chieu).
        saleThe: _donSaleNamesFromThe_(m.theSale).join(','),
        dieuChinh: m.acctStatus ? 'acct' : (m.ghepShares ? 'base' : undefined),
        // Don Pos TACH da gop (xem _mergeTachDon_): tachKey = ma goc, tachSoDon = so phan, tachGiaTri = gia tri tung phan; giaTriSauGiam o tren = TONG cac phan.
        tachKey: m.tachKey || undefined, tachSoDon: m.tachSoDon || undefined, tachGiaTri: m.tachGiaTri || undefined,
        // saleBanValid: danh sach ten sale đã qua _donSaleNamesFromThe_ (loc theo danh sach ten
        // sale THAT, giong het cach bySale o tren tinh) — khac voi theSale (chuoi THO nguyen van
        // cot "Thẻ", co the dinh ghi chu/ten sai chinh ta). Bao cao E (Hoa hong + Chuong trinh
        // thuong) phai dung field nay (khong dung theSale truc tiep) de khop CHINH XAC voi cach
        // ke toan tinh — xem _computeCommissionData_/_computeBonusData_ o index.html.
        saleBanValid: m.ghepShares ? m.ghepShares.map(function(x){ return x.name; }).join(',') : _donSaleNamesFromThe_(m.theSale).join(','),
        // (thuong nay chia deu cho moi sale tren don — bonusSale/nguoi tao khong con dung de tinh thuong)
        bonusSale: undefined,
        nguoiTaoBase: m.ghepCreators ? m.ghepCreators.join(',') : undefined,
        // THUONG (yeu cau Duyen 2026-10-10): baseNgayTao = ngay tao don tren BASE (YYYY-MM-DD) — doanh thu NGAY tinh theo ngay nay;
        // donGoc = true CHI KHI ghi chu Pos co ma bo dem GOC cua sale (dang 17T10/2026, khong hau to tach/them/hd/BH) VA don da ghep duoc voi Base.
        baseNgayTao: m.baseNgayTao || undefined,
        donGoc: (m.ghepShares && _isOriginalCounterNote_(m.ghiChu, m.ghepCodes)) ? true : undefined
      };
    })
  };
}


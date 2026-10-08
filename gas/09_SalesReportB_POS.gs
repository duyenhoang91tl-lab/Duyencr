// Ma bo dem: [chu 0-3 ky tu, vd "Bh"] + so + [chu 0-3 ky tu, vd "Q"] + "T" + thang(1-2 so) + ["/" + nam 2-4 so].
// VD khop: 980T09 | 16QT09/2026 | Bh395T09/2026 | 835T09/2026. Phai dung RIENG (khong dinh chu/so lien truoc/sau).
// SUA 2026-10-05 theo yeu cau Duyen ("cu tinh sao de khop voi ke toan nhat"): TAT ghep don Pos<->Base. File ke toan (don_check.xlsx)
// tinh doanh thu Pos THUAN: gia tri = cot "Giá trị đơn hàng sau giảm giá" cua Pos, chia deu cho cac sale tren cot The, KHONG thay
// bang gia tri/sale cua don goc Base. Do tren file that thang 9: bat ghep lam Sasum lech 18.986.000d (9 don doi gia theo Base,
// 2 don bi loai vi goc Base da Huy/Hoan) va chia lai sale theo Base lam nhieu sale lech hang tram trieu. Dat true de BAT LAI
// co che ghep (code ghep van nguyen ven ben duoi). Tat ghep cung khong con doc "DT TỔNG" trong Bao cao B -> nhanh hon.
var POS_GHEP_BASE_ENABLED_ = false;
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
  var cCode = col_(colIdx), cTT = col_(DT_COL_TRANGTHAI), cSale = col_(DT_COL_SALEBAN), cGT = col_(DT_COL_GIATRIDON), cCreator = col_(1); // cot B "Người tạo" cua DT TONG = NGUOI LEN DON (dung de tinh THUONG, xem _resolveGhepDon_)
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
  var total = 0, shareAmt = {}, names = [], liveRows = 0, creators = [], seenCreator = {};
  for (var b = 0; b < picked.length; b++) {
    var br = picked[b];
    usedBaseRows[br.rowIndex] = true;
    if (_isExcludedOrderStatus_(br.trangThai)) continue; // don goc da Huy/Hoan (theo dinh nghia Base) -> khong tinh
    liveRows++;
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
  return { status: 'ok', total: total, shares: shares, codes: codes, baseRows: picked.length, creators: creators };
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
  // Bo dau truoc khi so (_normTxt_ chi ha chu thuong, khong bo dau) — khop "Quầy Hào Nam" bat ke hoa/thuong/dau.
  var nguonFold = String(nguonDon || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  if (nguonFold.indexOf('quay hao nam') === -1) return 1;
  var s = String(ghiChu || '');
  if (/(^|[^0-9])30\s*[\/\-:]\s*70(?![0-9])/.test(s) || /(^|[^0-9])70\s*[\/\-:]\s*30(?![0-9])/.test(s)) return QUAY_SALE_RATIO_;
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

function buildSalesReportB_(filters) {
  filters = filters || {};
  // Ho tro CA mang (multi-select) LAN chuoi don (tuong thich nguoc) cho ca 3 bo loc.
  function toArr(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v).trim()] : []); }
  var saleFilterArr = _expandSaleFilterWithPancakeAliases_(toArr(filters.sale));
  var saleFilterFold = saleFilterArr.map(_normTxt_);
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
  var saleTeamMap = {}; // ten sale (username) -> ten team — dung chung voi tab "Quan ly Team"
  readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
    (t.members || []).forEach(function(u) { saleTeamMap[u] = t.name; });
  });
  // Khop fold-insensitive (giong _expandSaleFilterWithPancakeAliases_/_normTxt_ da dung o bo
  // loc Team phia tren) + tra qua readPancakeMap_ khi ten tren "Thẻ" la username Pancake (vd
  // "ninhnga99") khac voi ten chuan trong Team (vd "Ngà") — neu khong se rot het vao "(chưa có
  // Team)" oan du ho da duoc gan Team day du, dung HET nguyen nhan ma commit fix loc Team vua nêu.
  var saleTeamMapFold_ = {};
  Object.keys(saleTeamMap).forEach(function(u) { saleTeamMapFold_[_normTxt_(u)] = saleTeamMap[u]; });
  var pancakeMapB_ = readPancakeMap_(); // pancakeName -> "saleA|saleB"
  var pancakeMapFoldB_ = {};
  Object.keys(pancakeMapB_).forEach(function(pn) { pancakeMapFoldB_[_normTxt_(pn)] = pancakeMapB_[pn]; });
  function _resolveTeamForSaleB_(rawName) {
    var fold = _normTxt_(rawName);
    if (saleTeamMapFold_[fold]) return saleTeamMapFold_[fold];
    var mapped = pancakeMapFoldB_[fold];
    if (mapped) {
      var cands = String(mapped).split('|').map(function(s){ return s.trim(); }).filter(Boolean);
      for (var ci = 0; ci < cands.length; ci++) {
        var t = saleTeamMapFold_[_normTxt_(cands[ci])];
        if (t) return t;
      }
    }
    return UNASSIGNED_TEAM;
  }
  var byTeamSale = {}; // ten team -> { orders, giaTri, cod }
  var byNguon = {};    // nguon don -> { orders, giaTri, cod } — tuong duong "Theo Kenh ban" cua Bao cao A
  var byMktObj = {};   // ten Marketer (co san tren tung dong, khong can suy ra qua Page) -> { orders, giaTri, cod }
  var UNASSIGNED_MKT = '(chưa gán MKT)';

  // Chi doc CareData khi thuc su co loc theo CRM — tranh doc them 1 sheet khi khong can.
  var needCare = careStatusArr.length || khStatusArr.length || zaloStatusArr.length || nickZaloTerm;
  var careMap = needCare ? _careMapByPhone_() : null;

  var rows = readDonChiTiet_();
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
  var usedBaseRows = {};
  var aliasMemoB_ = {};
  // SUA 2026-10-06: khongKhop[]/trungDonGoc[] CHI giu toi da 30 vi du de tra ve (tranh phinh to
  // response) — nhung truoc day lay dung .length cua 2 mang nay lam "so don khong ghep duoc" hien
  // canh bao, nen thang nao co that >30 don loai nay se BI HIEN SAI THANH DUNG 30 (chan tran am
  // tham). Them 2 bo dem rieng (count) KHONG bi gioi han, tang moi lan bat ke mang vi du co con
  // cho hay khong — dung 2 bo dem nay moi la so that de hien thi/canh bao, 2 mang [] chi de liet
  // ke VI DU (toi da 30 dong) phia sau.
  var ghepStats = { donCoMa: 0, daGhep: 0, gocBiLoai: 0, khongKhop: [], khongKhopCount: 0, trungDonGoc: [], trungDonGocCount: 0 };
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
          ghepCreators: gh.creators || [], bonusSale: bonusList.join(',') }); // bonusSale = '' -> nguoi tao khong phai sale -> khong ai nhan thuong
      } else if (gh.status === 'gocBiLoai') {
        ghepStats.gocBiLoai++;
        continue; // moi don goc Base deu Huy/Hoan -> bo don Pos nay khoi bao cao (giong don Pos "Đã hoàn")
      } else {
        var wInfo = { ngay: rowP.ngayTaoDon, sdt: rowP.soDienThoai, ghiChu: String(rowP.ghiChu || '').substring(0, 120), maCoDon: gh.codes, maKhongTim: gh.missing };
        if (gh.status === 'khongKhop') { ghepStats.khongKhopCount++; if (ghepStats.khongKhop.length < 30) ghepStats.khongKhop.push(wInfo); }
        else { ghepStats.trungDonGocCount++; if (ghepStats.trungDonGoc.length < 30) ghepStats.trungDonGoc.push(wInfo); }
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
    // Don Quay Hao Nam gan the sale + note 30/70 -> chi 30% doanh thu la cua sale (xem _quaySaleRatio_)
    var hasSaleRow = effRow.ghepShares
      ? effRow.ghepShares.some(function(x) { return x.name !== '(chưa gán sale)'; })
      : _donSaleNamesFromThe_(effRow.theSale).length > 0;
    var qRatio = _quaySaleRatio_(effRow.nguonDon, effRow.ghiChu, hasSaleRow);
    if (qRatio !== 1) effRow = Object.assign({}, effRow, { saleRatio: qRatio });
    matched.push(effRow);
  }

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
      var fr = fracOf(sName) * (m.saleRatio || 1); // saleRatio 0.3 = don Quay 30/70 (phan con lai 70% la cua quay)
      if (!bySale[sName]) bySale[sName] = { orders: 0, giaTri: 0, cod: 0 };
      bySale[sName].orders += 1;
      bySale[sName].giaTri += m.giaTriSauGiam * fr;
      bySale[sName].cod += m.cod * fr;

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
  var pkPageMapB_ = readPancakePageMap_();
  var pkPageMapByNameB_ = readPancakePageMapByName_();
  var normRowsB_ = matched.map(function(m) {
    var pid = _extractPageIdFromNguonDon_(m.nguonDon);
    var kenhB_ = pid ? (pkPageMapB_[pid] || '') : '';
    if (!kenhB_) {
      var pname_ = _extractPageNameFromNguonDon_(m.nguonDon);
      if (pname_) kenhB_ = pkPageMapByNameB_[_normTxt_(pname_)] || '';
    }
    return { kenhBan: kenhB_, dateStr: m.ngayTaoDon, saleBanRaw: m.theSale };
  });
  var closeSectionsB_ = _srCloseRateSections_(normRowsB_, filters);

  var mismatchCount = products['__MISMATCH__'] ? products['__MISMATCH__'].mismatchRows : 0;

  return {
    totalOrders: matched.length,
    totalGiaTri: totalGiaTri,
    totalCod: totalCod,
    products: productArr,
    bySale: bySaleArr,
    byTeamSale: byTeamSaleArr,
    byNguon: byNguonArr,
    byMkt: byMktArrB,
    saleCloseRate: closeSectionsB_.saleCloseRate,
    saleCloseRateFrom: closeSectionsB_.closeFrom,
    kenhCloseRate: closeSectionsB_.kenhCloseRate,
    kenhCloseRateFrom: closeSectionsB_.closeFrom,
    saleCloseByPage: closeSectionsB_.saleCloseByPage,
    trungBinhDon: matched.length ? Math.round(totalGiaTri / matched.length) : 0,
    mismatchRows: mismatchCount, // so dong bi lech so cot giua san pham/ma/so luong — nen kiem tra tay
    ghep: (function(){ ghepStats.cotBase = baseIdx ? baseIdx.colIdx : null; ghepStats.loi = ghepErr; ghepStats.msDocBase = ghepMs; return ghepStats; })(), // thong ke ghep don Pos<->Base: donCoMa, daGhep, khongKhopCount/trungDonGocCount (SO THAT, khong gioi han) + khongKhop[]/trungDonGoc[] (toi da 30 VI DU dau tien, dung .xxxCount de hien so luong, KHONG dung .length cua 2 mang nay — da tung bi chan tran am tham o 30)
    orders: matched.map(function(m){
      return {
        ngayTaoDon: m.ngayTaoDon, khachHang: m.khachHang, soDienThoai: m.soDienThoai,
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
        // saleBanValid: danh sach ten sale đã qua _donSaleNamesFromThe_ (loc theo danh sach ten
        // sale THAT, giong het cach bySale o tren tinh) — khac voi theSale (chuoi THO nguyen van
        // cot "Thẻ", co the dinh ghi chu/ten sai chinh ta). Bao cao E (Hoa hong + Chuong trinh
        // thuong) phai dung field nay (khong dung theSale truc tiep) de khop CHINH XAC voi cach
        // ke toan tinh — xem _computeCommissionData_/_computeBonusData_ o index.html.
        saleBanValid: m.ghepShares ? m.ghepShares.map(function(x){ return x.name; }).join(',') : _donSaleNamesFromThe_(m.theSale).join(','),
        // (thuong nay chia deu cho moi sale tren don — bonusSale/nguoi tao khong con dung de tinh thuong)
        bonusSale: undefined,
        nguoiTaoBase: m.ghepCreators ? m.ghepCreators.join(',') : undefined
      };
    })
  };
}


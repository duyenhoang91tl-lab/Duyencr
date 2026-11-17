// Doc toan bo sheet DANH_MUC thanh mang object {tenCot: giaTri...}, dua theo dong tieu de
// (tu do, xem _detectHeaderRow_) — khong hardcode ten cot lan vi tri dong tieu de, sheet
// doi/them cot hay chen them dong trang o tren van chay binh thuong.
// Doc sheet DANH_MUC CO DINH cot A -> M (khong doc cot ben phai M). Trong pham vi do, CHI 3 cot
// G, H, I moi duoc coi la cot GIA (xem GIA_COL_MIN_/GIA_COL_LIMIT_ o duoi) — yeu cau Duyen.
var PRICE_LAST_COL_ = 13; // cot M
function readPriceCatalog_() {
  var sh = SpreadsheetApp.openById(PRICE_SS_ID).getSheetByName(PRICE_SHEET_NAME);
  // Ap dung dung nguyen tac da sua o readAllOrders_ (xem chu thich o do): sheet KHONG ton tai la
  // LOI THAT (doi ten/xoa nham, hoac PRICE_SS_ID sai/mat quyen) - phai throw de doGet tra ve loi
  // ro rang cho client, khong duoc am tham thanh "khong co gia nao" giong het truong hop rong.
  if (!sh) throw new Error('Khong tim thay sheet "' + PRICE_SHEET_NAME + '" trong spreadsheet bang gia (PRICE_SS_ID) — kiem tra sheet co bi doi ten/xoa khong, hoac PRICE_SS_ID co con dung khong.');
  if (sh.getLastRow() < 2) return [];
  var lastRow = sh.getLastRow(), lastCol = Math.min(sh.getLastColumn(), PRICE_LAST_COL_);
  var vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var hIdx = _detectHeaderRow_(vals, 10);
  var headers = vals[hIdx].map(function(h){ return String(h || '').trim(); });
  // Cot khong co tieu de (vd o gop) van giu lai duoi ten tam "Cot <chu cai>" de noi dung
  // trong do KHONG bi mat khoi phan tim kiem.
  for (var hc = 0; hc < headers.length; hc++) {
    if (!headers[hc]) headers[hc] = 'Cot ' + _colLetter_(hc + 1);
  }
  var rows = [];
  for (var i = hIdx + 1; i < vals.length; i++) {
    var row = vals[i];
    var isEmpty = row.every(function(c){ return c === '' || c === null; });
    if (isEmpty) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = row[c];
      if (v === '' || v === null) continue; // bo o rong cho gon, khong anh huong tim kiem
      obj[headers[c]] = (v instanceof Date) ? v.toISOString() : v;
    }
    if (Object.keys(obj).length) rows.push(obj);
  }
  // Giu lai THU TU COT THAT (trai->phai) cua sheet duoi 1 thuoc tinh an tren mang tra ve —
  // KHONG dua vao Object.keys(row) cua tung dong de suy ra thu tu cot nhu truoc (xem
  // _priceCols_): vi readPriceCatalog_ bo qua o rong, cac dong khac nhau co the co o gia nao
  // rong khac nhau, khien thu tu "gap thay cot dau tien" tinh theo tung dong RIENG LE bi lech
  // khoi thu tu cot THAT cua sheet — day chinh la nguyen nhan bug chon nham cot gia (VD sheet
  // co nhieu cot cung chua chu "gia" cho nhieu chuong trinh/dot gia khac nhau, cot "Gia thuong"
  // hien thi dung nhung lai KHONG phai cot duoc chon do tinh co dung dau tien theo kieu cu).
  rows.__headers = headers;
  return rows;
}

// Doi so thu tu cot (1-based) sang chu cai cot kieu Excel: 1->A, 7->G, 27->AA
function _colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// ─── CACHE LON: chia manh de vuot gioi han ~100KB/1 key cua CacheService ─────────────
// (danh muc gia day du co the vuot 100KB nen cache.put 1 key se bi bo qua am tham)
// TTL (giay) cua cache TOAN BO sheet don Pos: 'donChiTiet_v4' (readDonChiTiet_) va 'don_phones_v6' (action donPhones) — PHAI dung chung 1 hang so vi hai key xoa cung luc.
// 2026-11-16 (Duyen: "an load bao cao hoi lau du chi xem thang"): 90s -> 600s. NGUYEN NHAN GOC cham: moi khi cache het han, buildSalesReportB_/E/F/G doc + doi + JSON.stringify TOAN BO lich su sheet Pos
// (khong phu thuoc "chi xem 1 thang"). Nhap file / xoa trung / sua o qua he thong da removeAll(['donChiTiet_v4_n','don_phones_v6_n', 'don_daily_v1_n']) nen so khong cu; CHI sua tay truc tiep tren sheet Pos moi phai cho toi 10 phut.
var DON_CACHE_TTL_ = 600;
function _cachePutBig_(key, str, ttl) {
  try {
    var cache = CacheService.getScriptCache();
    var CH = 30000, n = Math.ceil(str.length / CH), obj = {};
    for (var i = 0; i < n; i++) obj[key + '_' + i] = str.substr(i * CH, CH);
    obj[key + '_n'] = String(n);
    cache.putAll(obj, ttl);
  } catch (e) {}
}
function _cacheGetBig_(key) {
  try {
    var cache = CacheService.getScriptCache();
    var n = parseInt(cache.get(key + '_n') || '0', 10);
    if (!n) return null;
    var keys = [];
    for (var i = 0; i < n; i++) keys.push(key + '_' + i);
    var got = cache.getAll(keys), out = '';
    for (var j = 0; j < n; j++) {
      var part = got[key + '_' + j];
      if (part === undefined || part === null) return null;
      out += part;
    }
    return out;
  } catch (e) { return null; }
}

// Xoa cache action 'orders' (key 'orders_v1', chi can xoa '_n' — xem _cacheGetBig_). Goi sau MOI thao tac CRM ghi vao DT TONG.
function _ordersCacheClear_() {
  try { CacheService.getScriptCache().remove('orders_v1_n'); } catch (e) {}
}

// ─── NHAN DIEN COT DANH_MUC (KHONG dau, KHONG hardcode vi tri) ──────────────────────
// readPriceCatalog_ bo o rong cho gon nen dong dau tien co the thieu key -> gop key cua TAT CA
// cac dong. Nhan dien bang _stripVN_ (bo dau) vi tieu de that co dau ("Giá", "Tên sản phẩm"):
// so thang /gia/ tren "Giá" co dau se KHONG khop -> mat het cot gia (loi da gap).
//
// QUAN TRONG (fix bug chon nham cot gia): thu tu cot.gia PHAI theo dung thu tu cot THAT cua
// sheet (rows.__headers, trai->phai) — KHONG duoc suy tu Object.keys(rows[i]) nhu truoc, vi
// sheet co the co NHIEU cot cung chua chu "gia" (VD nhieu dot/chuong trinh gia khac nhau nam o
// cot an, duoc 1 cot hien thi vd "Gia thuong" rut ra bang cong thuc) va cac dong khac nhau co
// the trong o o nhung cot gia khac nhau -> thu tu "gap thay dau tien" tinh rieng tung dong se
// LECH khoi thu tu cot that, khien buildPriceCatalogFlat_ vo tinh lay gia tu 1 cot KHAC (vd
// dot khuyen mai cu) thay vi dung cot "Gia thuong" hien dang hien thi cho khach.
//
// GIOI HAN VUNG COT GIA (theo yeu cau Duyen 26/09/2026): sheet BANG GIA hien tai dung 3 cot
// CHINH THUC bôi do la G (Gia thuong), H (Gia SAPHIA), I (Gia RUBY) — cac cot ben phai tu do
// tro di (vd X->AF) CHI la vung cong thuc/mau nguon de "do" gia ra 3 cot G/H/I (qua 1 cong thuc
// dieu khien boi o G7), KHONG PHAI du lieu gia chinh thuc, nhung van co chu "gia" trong tieu de
// nen truoc day bi quet nham vao giaCandidates. Vi vay CHI nhan dien cot gia trong pham vi cot
// A->I (idx+1 <= GIA_COL_LIMIT) — cac cot ten/nhom/size/chat lieu van duoc do toan bo be rong
// sheet nhu cu vi khong lien quan toi vung cong thuc nay.
var GIA_COL_MIN_ = 7;   // cot G
var GIA_COL_LIMIT_ = 9; // cot I — cot gia chi la G, H, I
// Neu co NHIEU cot gia THUONG (khong tinh Saphia/Ruby), UU TIEN cot nao co chu "thuong" (Gia
// thuong) truoc — chi khi KHONG cot nao ghi ro "thuong" moi lui ve thu tu trai->phai nhu cu.
// FIX (26/09/2026): cot Saphia/Ruby PHAI luon duoc giu lai bat ke co cot "thuong" hay khong —
// truoc day gop chung Saphia/Ruby vao cung danh sach roi loc theo "thuong" khien 2 cot nay bi
// LOAI BO hoan toan moi khi co san 1 cot "Gia thuong" (vi ten Saphia/Ruby khong chua chu
// "thuong"), lam bang gia flat luon tra ve sp=0, r=0 du sheet co du lieu.
function _priceCols_(rows) {
  var headerOrder = rows.__headers || (function() {
    // Du phong khi khong co __headers (vd goi truc tiep tu test): lay lai theo cach cu.
    var seen = {}, keys = [];
    for (var i = 0; i < rows.length; i++) { for (var k in rows[i]) { if (!seen[k]) { seen[k] = true; keys.push(k); } } }
    return keys;
  })();
  var cols = { nhom: '', ten: '', tm: '', size: '', cl: '', gia: [] };
  var giaCandidates = []; // { key, isThuong, isSpecial } theo DUNG thu tu cot that cua sheet
  headerOrder.forEach(function(k, idx) {
    if (!k) return;
    var st = _stripVN_(k);
    if (!cols.nhom && /nhom\s*san\s*pham/.test(st)) cols.nhom = k;
    else if (!cols.ten && /^ten\s*san\s*pham/.test(st)) cols.ten = k;
    else if (!cols.tm && /ten\s*thuong\s*mai/.test(st)) cols.tm = k;
    else if (!cols.size && (st.indexOf('size') !== -1 || st.indexOf('kieu') !== -1)) cols.size = k;
    else if (!cols.cl && st.indexOf('chat lieu') !== -1) cols.cl = k;
    else if (/gia|price/.test(st) && (idx + 1) >= GIA_COL_MIN_ && (idx + 1) <= GIA_COL_LIMIT_) {
      var isSpecial = st.indexOf('saphia') !== -1 || st.indexOf('ruby') !== -1;
      giaCandidates.push({ key: k, isThuong: st.indexOf('thuong') !== -1, isSpecial: isSpecial });
    }
  });
  var specialKeys = giaCandidates.filter(function(g) { return g.isSpecial; }).map(function(g) { return g.key; });
  var normalOnes = giaCandidates.filter(function(g) { return !g.isSpecial; });
  var thuongKeys = normalOnes.filter(function(g) { return g.isThuong; }).map(function(g) { return g.key; });
  var pickedNormal = thuongKeys.length ? thuongKeys : normalOnes.map(function(g) { return g.key; });
  var pickedSet = {};
  pickedNormal.concat(specialKeys).forEach(function(k) { pickedSet[k] = true; });
  // Giu dung thu tu cot that (trai->phai) trong danh sach cuoi cung.
  cols.gia = headerOrder.filter(function(k) { return pickedSet[k]; });
  return cols;
}
// ── ANH SAN PHAM trong DANH_MUC (cot "Link ảnh sản phẩm" CS tu dien san, chua link Google
// Drive) — code RIENG, KHONG dung chung readPriceCatalog_/_priceCols_ (2 ham do GIOI HAN chi doc
// toi cot PRICE_LAST_COL_ de "Tra cuu bang gia" khong bi nhiem noi dung cac cot cong thuc/mau
// phia xa ben phai — xem giai thich o _priceCols_/GIA_COL_LIMIT_). Cot "Link ảnh sản phẩm" co
// the nam o BAT KY vi tri nao (ke ca ngoai vung PRICE_LAST_COL_), nen cac ham duoi day TU QUET
// TOAN BO be rong tieu de de tim dung cac cot can, roi CHI doc rieng cac cot do — khong doc het
// be rong sheet, khong anh huong gi toi _priceCols_/tinh nang Tra cuu bang gia dang dung.
//
// SUA (30/09/2026, theo yeu cau Duyen): truoc day chi co 1 o go-ten-tu-do roi tu doan dong KHOP
// NHAT — de chon NHAM dong (sai Size/Chat lieu) khi 1 san pham co nhieu bien the, moi bien the
// co the co anh khac nhau. Nay doi sang cung co che "thu hep dan" (Nhom SP -> Ten SP -> Kieu/
// Size -> Chat lieu, deu CO THE BO TRONG) giong het "Soan don" — buildProductImageFlat_ tra ve
// danh sach PHANG du du lieu de FE tu dung lai UI cascading da co, roi goi driveImageFromLink_
// rieng cho DUNG dong CS chon, thay vi doan.
function _productImgCols_(headers) {
  var nhomIdx = -1, tenIdx = -1, tmIdx = -1, sizeIdx = -1, clIdx = -1, mauIdx = -1, imgIdx = -1;
  for (var c = 0; c < headers.length; c++) {
    var st = _stripVN_(headers[c]);
    if (nhomIdx < 0 && /nhom\s*san\s*pham/.test(st)) { nhomIdx = c; continue; }
    if (tenIdx < 0 && /^ten\s*san\s*pham/.test(st)) { tenIdx = c; continue; }
    if (tmIdx < 0 && /ten\s*thuong\s*mai/.test(st)) { tmIdx = c; continue; }
    if (sizeIdx < 0 && (st.indexOf('size') !== -1 || st.indexOf('kieu') !== -1)) { sizeIdx = c; continue; }
    if (clIdx < 0 && st.indexOf('chat lieu') !== -1) { clIdx = c; continue; }
    // Cot MAU SAC (neu sheet co) — vd "Màu sắc"/"Màu" — de phan biet bien the cung ten/size/chat
    // lieu nhung khac mau (va co the khac anh). KHONG phai nhan dien mau TU PIXEL anh — he thong
    // chi doc du lieu CHU trong sheet, khong phan tich noi dung anh (xem giai thich trong tra loi
    // cho Duyen 01/10/2026).
    if (mauIdx < 0 && (st.indexOf('mau sac') !== -1 || /\bmau\b/.test(st))) { mauIdx = c; continue; }
    if (imgIdx < 0 && (st.indexOf('hinh anh') !== -1 || st.indexOf('link anh') !== -1 ||
        st.indexOf('anh san pham') !== -1 || /\bhinh\b/.test(st) || /\banh\b/.test(st) || /\bimage\b/.test(st))) imgIdx = c;
  }
  return { nhomIdx: nhomIdx, tenIdx: tenIdx, tmIdx: tmIdx, sizeIdx: sizeIdx, clIdx: clIdx, mauIdx: mauIdx, imgIdx: imgIdx };
}

// Danh sach PHANG cho tinh nang "Tim ảnh sản phẩm" — cung hinh dang voi buildPriceCatalogFlat_
// (n=nhom, t=ten, m=ten thuong mai, s=size, c=chat lieu) de FE dung LAI y het logic cascading
// cua "Soan don" (xem renderBuilderDyn_), kem them mau=mau sac (neu sheet co cot nay) va
// img=link anh de lay anh SAU KHI da thu hep dung ve 1 (hoac vai) dong, thay vi khop mo ho theo
// ten roi doan dai nhat.
function buildProductImageFlat_() {
  var sh = SpreadsheetApp.openById(PRICE_SS_ID).getSheetByName(PRICE_SHEET_NAME);
  if (!sh) return { ok: false, error: 'Không tìm thấy sheet "' + PRICE_SHEET_NAME + '".' };
  var lastRow = sh.getLastRow(), lastColFull = sh.getLastColumn();
  if (lastRow < 2) return { ok: true, items: [] };

  var headerScanRows = Math.min(lastRow, 12);
  var headerVals = sh.getRange(1, 1, headerScanRows, lastColFull).getValues();
  var hIdx = _detectHeaderRow_(headerVals, 12);
  var headers = headerVals[hIdx].map(function(h) { return String(h || '').trim(); });
  var ci = _productImgCols_(headers);

  if (ci.imgIdx < 0) return { ok: false, error: 'Không tìm thấy cột link ảnh sản phẩm trong DANH_MUC (tên cột cần chứa "hình ảnh"/"link ảnh"/"image").' };
  if (ci.tenIdx < 0 && ci.tmIdx < 0) return { ok: false, error: 'Không nhận diện được cột Tên sản phẩm/Tên thương mại trong DANH_MUC.' };

  var dataStartRow = hIdx + 2;
  var numDataRows = lastRow - dataStartRow + 1;
  if (numDataRows < 1) return { ok: true, items: [] };

  var neededCols = [ci.nhomIdx, ci.tenIdx, ci.tmIdx, ci.sizeIdx, ci.clIdx, ci.mauIdx, ci.imgIdx].filter(function(x) { return x >= 0; });
  var minCol = Math.min.apply(null, neededCols), maxCol = Math.max.apply(null, neededCols);
  var block = sh.getRange(dataStartRow, minCol + 1, numDataRows, maxCol - minCol + 1).getValues();

  var items = [];
  for (var i = 0; i < block.length; i++) {
    var r = block[i];
    var get = (function(row) { return function(idx) { return idx >= 0 ? String(row[idx - minCol] || '').trim() : ''; }; })(r);
    var t = get(ci.tenIdx), m = get(ci.tmIdx);
    if (!t && !m) continue;
    items.push({ n: get(ci.nhomIdx), t: t, m: m, s: get(ci.sizeIdx), c: get(ci.clIdx), mau: get(ci.mauIdx), img: get(ci.imgIdx) });
  }
  return { ok: true, items: items };
}

// Doc 1 anh THEO DUNG link CS/FE da chon (sau khi thu hep dan ve dung 1 dong bang
// buildProductImageFlat_) — khong can tim kiem lai, chi doc va tra anh. Ten co "Action" de
// tranh nham lan voi _driveImageFromLink_ (ham noi bo, chi tra {fileId,name}).
function driveImageFromLinkAction_(link) {
  var s = String(link || '').trim();
  if (!s) return { ok: false, error: 'Thiếu link ảnh.' };
  var drv = _driveImageFromLink_(s);
  var imgData = drv ? _driveImageBase64_(drv.fileId) : null;
  return {
    ok: true,
    imageLink: s,
    image: imgData ? { base64: imgData.base64, mimeType: imgData.mimeType, name: drv.name } : null
  };
}

// So tien trong bang gia tinh bang NGHIN VND (7950 = 7.950.000d). Chap nhan ca chuoi "7.950"/"7,950".
function _priceNumK_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  var n = Number(String(v).replace(/[^\d]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Danh muc PHANG, gon (cho o "Soan don" cua Pancake AI): moi dong DANH_MUC -> 1 item
//   n=nhom SP | t=ten san pham | m=ten thuong mai | s=kieu/size | c=chat lieu
//   p=gia thuong | sp=gia SAPHIA | r=gia RUBY  (deu tinh bang nghin VND, 0 = khong co)
// Client tu loc theo tu khoa (khong dau), roi thu hep dan bang cac dropdown.
function buildPriceCatalogFlat_() {
  var rows = readPriceCatalog_();
  var cols = _priceCols_(rows);
  var items = [];
  rows.forEach(function(row) {
    var t = cols.ten ? String(row[cols.ten] || '').trim() : '';
    var m = cols.tm ? String(row[cols.tm] || '').trim() : '';
    if (!t && !m) return;
    var it = {
      n: cols.nhom ? String(row[cols.nhom] || '').trim() : '',
      t: t, m: m,
      s: cols.size ? String(row[cols.size] || '').trim() : '',
      c: cols.cl ? String(row[cols.cl] || '').trim() : '',
      p: 0, sp: 0, r: 0
    };
    cols.gia.forEach(function(k) {
      var st = _stripVN_(k), v = _priceNumK_(row[k]);
      if (st.indexOf('saphia') !== -1) it.sp = v;
      else if (st.indexOf('ruby') !== -1) it.r = v;
      else if (!it.p) it.p = v;
    });
    items.push(it);
  });
  return { ok: true, count: items.length, items: items };
}

// Cay Nhom SP → Ten SP → Kieu/Size (giu de tuong thich ban cu — o "Soan don" moi dung
// buildPriceCatalogFlat_ o tren). Neu 1 cap (Ten SP, Kieu/Size) co NHIEU dong (khac Chat lieu)
// thi tra ve ca mang variants.
function buildPriceCatalogTree_() {
  var rows = readPriceCatalog_();
  var cols = _priceCols_(rows);
  var nhomKey = cols.nhom, tenKey = cols.ten || cols.tm, sizeKey = cols.size, chatLieuKey = cols.cl;
  if (!nhomKey || !tenKey) return { groups: [] }; // khong nhan dien duoc cau truc sheet
  var priceKeys = cols.gia;
  var groupMap = {};
  rows.forEach(function(row) {
    var nhom = String(row[nhomKey] || '').trim();
    var ten = String(row[tenKey] || '').trim();
    if (!nhom || !ten) return;
    var size = (sizeKey ? String(row[sizeKey] || '').trim() : '') || '(mặc định)';
    if (!groupMap[nhom]) groupMap[nhom] = {};
    if (!groupMap[nhom][ten]) groupMap[nhom][ten] = {};
    if (!groupMap[nhom][ten][size]) groupMap[nhom][ten][size] = [];
    var priceObj = {};
    priceKeys.forEach(function(pk) { if (row[pk] !== undefined) priceObj[pk] = row[pk]; });
    groupMap[nhom][ten][size].push({ chatLieu: chatLieuKey ? String(row[chatLieuKey] || '') : '', prices: priceObj });
  });
  var groups = Object.keys(groupMap).sort().map(function(nhom) {
    var products = Object.keys(groupMap[nhom]).sort().map(function(ten) {
      var sizes = Object.keys(groupMap[nhom][ten]).sort().map(function(size) {
        return { size: size, variants: groupMap[nhom][ten][size] };
      });
      return { name: ten, sizes: sizes };
    });
    return { name: nhom, products: products };
  });
  return { groups: groups, priceKeys: priceKeys };
}

// Tim theo tu khoa q — khop khi MOI tu trong q (tach theo khoang trang) xuat hien trong
// it nhat 1 cot bat ky cua dong do (khong dau, khong phan biet hoa/thuong).
// Neu khop chat (AND) khong ra dong nao -> lui ve khop GAN DUNG: cham diem theo so tu
// khop duoc, tra ve cac dong diem cao nhat (>= 60% so tu). Muc dich: CS go thua/thieu 1-2
// tu (vd "khong boc vang", "mau bac") van thay duoc san pham gan nhat kem gia, thay vi
// nhan "Khong tim thay" roi phai tu mo Sheet tra tay.
function searchPriceCatalog_(rows, q) {
  var terms = _stripVN_(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return rows.slice(0, 50);
  var out = [];
  var scored = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var haystack = _stripVN_(Object.keys(row).map(function(k){ return row[k]; }).join(' | '));
    var hit = 0;
    for (var t = 0; t < terms.length; t++) {
      if (haystack.indexOf(terms[t]) !== -1) hit++;
    }
    if (hit === terms.length) {
      if (out.length < 50) out.push(row);
    } else if (hit > 0) {
      scored.push({ row: row, hit: hit });
    }
  }
  if (out.length) return out;
  // Fallback gan dung
  var minHit = Math.max(1, Math.ceil(terms.length * 0.6));
  scored = scored.filter(function(x){ return x.hit >= minHit; });
  scored.sort(function(a, b){ return b.hit - a.hit; });
  return scored.slice(0, 20).map(function(x){ return x.row; });
}

// ─── BANG GIA CHO PROMPT AI ───────────────────────────────────────────────
// Khac voi searchPriceCatalog_ (dung cho o "Tra cuu bang gia", khop chat theo tu khoa CS go),
// ham nay nhan NGUYEN doan yeu cau/cau hoi cua sale (dai, nhieu tu thua) nen phai cham diem
// thay vi bat buoc khop het tu.
// Muc dich chinh (yeu cau Duyen): khi sale KHONG ghi ro chat lieu/size, AI phai liet ke DU
// TAT CA cac bien the tim thay kem chat lieu + size + gia tuong ung — vi 1 ten san pham
// (vd "VONG TAY DONG DIEU DONG LOC") co nhieu dong khac nhau ve chat lieu/mau/gia.
var _PRICE_STOPWORDS_ = ['khach','hoi','gia','bao','nhieu','tien','san','pham','cho','minh',
  'ban','em','anh','chi','oi','the','nao','duoc','khong','voi','nay','mua','can','tu','van',
  'tra','loi','giup','xin','vui','long','mot','cac','va','la','co','hang','shop'];

function _priceFieldPick_(row, kws) {
  for (var k in row) {
    var nk = _stripVN_(k);
    for (var i = 0; i < kws.length; i++) {
      if (nk.indexOf(kws[i]) !== -1) return { key: k, val: row[k] };
    }
  }
  return null;
}

// Gom cot gia cua 1 dong, LOC theo loai da khach hoi (stoneFilter: '' | 'SAPHIA' | 'RUBY'):
// - stoneFilter rong (khach/sale KHONG nhac SAPHIA/RUBY) -> CHI lay cot gia MAC DINH (cot
//   khong co chu "saphia"/"ruby" trong ten, tuc cot G "Gia thuong") — day la quy tac Duyen
//   yeu cau 22/8/2026: khong ghi ro loai da thi luon bao gia mac dinh, KHONG liet ke ca
//   SAPHIA/RUBY gay roi.
// - stoneFilter = 'SAPHIA'/'RUBY' -> chi lay dung cot do; neu dong nay khong co gia rieng
//   cho loai da đo (vd san pham chi co gia thuong) thi lui ve gia mac dinh kem chu thich.
function _priceAllPrices_(row, stoneFilter) {
  var defaultPrices = [], saphiaPrice = null, rubyPrice = null;
  for (var k in row) {
    var nk = _stripVN_(k);
    if (nk.indexOf('gia') === -1 && nk.indexOf('price') === -1) continue;
    var v = row[k];
    if (v === '' || v === null || v === undefined) continue;
    var label = String(k).replace(/\s*\(.*?\)\s*/g, '').trim() + ': ' + v;
    if (nk.indexOf('saphia') !== -1) saphiaPrice = label;
    else if (nk.indexOf('ruby') !== -1) rubyPrice = label;
    else defaultPrices.push(label);
  }
  if (stoneFilter === 'SAPHIA') {
    if (saphiaPrice) return [saphiaPrice];
    return defaultPrices.length ? [defaultPrices[0] + ' (sản phẩm này không có giá riêng cho SAPHIA)'] : [];
  }
  if (stoneFilter === 'RUBY') {
    if (rubyPrice) return [rubyPrice];
    return defaultPrices.length ? [defaultPrices[0] + ' (sản phẩm này không có giá riêng cho RUBY)'] : [];
  }
  // Khong ro loai da -> CHI gia mac dinh, khong dua SAPHIA/RUBY vao de tranh AI bao nham
  return defaultPrices;
}

// Doi SO VIET CHU CO DAU -> chu so ("cỏ bốn lá" -> "cỏ 4 lá", "tám bi" -> "8 bi") TRUOC khi bo dau, vi bang gia ghi so ("CÓ 4 LÁ", "8 BI VÀNG").
// Chi doi dang CO DAU (bốn/năm/sáu/bảy/tám/chín/mười/một): dang khong dau de nham ("tam" = Tam Hy, "ba", "hai", "nam") nen giu nguyen.
function _priceNumWords_(s) {
  var map = { 'một': '1', 'bốn': '4', 'năm': '5', 'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10' };
  return String(s == null ? '' : s).normalize('NFC').toLowerCase().replace(/(^|[^\p{L}])(một|bốn|năm|sáu|bảy|tám|chín|mười)(?=[^\p{L}]|$)/gu, function (m, pre, w) { return pre + map[w]; });
}
// NGUYEN NHAN GOC (Duyen 17/11: hoi "Lắc cỏ 4 lá" / "Lắc cỏ bốn lá tám bi vàng" khong ra SP du bang gia co "TRANG SỨC LẮC CÓ 4 LÁ"): bo loc cu bo MOI tu < 3 ky tu ("cỏ","lá","4","bi") va
// coi "co","la" la tu dung → chi con "lac" → khong du 2 tu khop → khong tim ra; con "tám" khop nham "TAM HỶ". Nay: doi so chu → so, giu tu ngan/so (khop NGUYEN TU), cong diem cum tu lien tiep (bigram/trigram).
var _PRICE_NOISE_ = ['khach','hoi','gia','bao','nhieu','tien','san','pham','cho','minh','ban','em','anh','chi','oi','the','nao','duoc','khong','voi','nay','mua','can','van','tra','loi','giup','xin','vui','long','cac','hang','shop'];
function _priceWordHit_(blob, w) { return w.length >= 3 && !/^\d+$/.test(w) ? blob.indexOf(w) !== -1 : (' ' + blob + ' ').indexOf(' ' + w + ' ') !== -1; }

function _priceVariantsForPrompt_(userMsg) {
  var rows;
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('price_catalog_v4');
    if (cached) { try { rows = JSON.parse(cached); } catch (e) {} }
    if (!rows) {
      rows = readPriceCatalog_();
      try { cache.put('price_catalog_v4', JSON.stringify(rows), 600); } catch (e) {}
    }
  } catch (e) { return ''; }
  if (!rows || !rows.length) return '';

  // Loai da khach/sale nhac toi (tu tin nhan, ngu canh, hoac o tick "Loai da" ben Pancake AI
  // extension gui kem duoi dang "Loại đá khách hỏi: SAPHIA/RUBY" trong [KH]) — QUYET DINH
  // cot gia nao duoc dua vao bang duoi day (xem _priceAllPrices_).
  var stripped = _stripVN_(_priceNumWords_(userMsg));
  var stoneFilter = '';
  if (stripped.indexOf('saphia') !== -1) stoneFilter = 'SAPHIA';
  else if (stripped.indexOf('ruby') !== -1) stoneFilter = 'RUBY';

  var allToks = stripped.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  var toks = allToks.filter(function (w) { return _PRICE_NOISE_.indexOf(w) === -1; });   // giu ca tu ngan (co, la, bi) va so (4, 8) — khop NGUYEN TU, xem _priceWordHit_
  if (!toks.length) return '';

  // Cham diem CHI tren cac cot ten (nhom/thuong mai/ten san pham) de tranh nhieu tu cot khac
  var scored = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var nameBlob = '';
    for (var k in r) {
      var nk = _stripVN_(k);
      if (nk.indexOf('ten') !== -1 || nk.indexOf('nhom') !== -1) nameBlob += ' ' + r[k];
    }
    nameBlob = _stripVN_(nameBlob).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
    if (!nameBlob.trim()) continue;
    var hit = 0;
    for (var t = 0; t < toks.length; t++) if (_priceWordHit_(nameBlob, toks[t])) hit++;
    if (hit >= 2) {
      // cong diem CUM TU LIEN TIEP trong cau hoi (2..4 tu) xuat hien nguyen cum trong ten SP: "lac co 4 la" khop "LAC CO 4 LA" hon "LAC ... 8 BI VANG"
      var bonus = 0, padded = ' ' + nameBlob + ' ';
      for (var n = 2; n <= 4; n++) for (var s0 = 0; s0 + n <= allToks.length; s0++) {
        var ph = allToks.slice(s0, s0 + n);
        if (ph.some(function (w) { return _PRICE_NOISE_.indexOf(w) !== -1; })) continue;
        if (padded.indexOf(' ' + ph.join(' ') + ' ') !== -1) bonus += n;
      }
      scored.push({ row: r, hit: hit + bonus, name: nameBlob });
    }
  }
  if (!scored.length) return '';
  scored.sort(function (a, b) { return b.hit - a.hit; });
  var bestHit = scored[0].hit;

  // Lay cac dong diem cao nhat, roi gom theo TEN SAN PHAM chuan hoa de keo ve DU cac bien the
  var topNames = {};
  for (var s = 0; s < scored.length && Object.keys(topNames).length < 3; s++) {
    if (scored[s].hit < bestHit) break;
    var f = _priceFieldPick_(scored[s].row, ['ten san pham', 'ten thuong mai']);
    if (f && f.val) topNames[_stripVN_(f.val)] = String(f.val).trim();
  }
  if (!Object.keys(topNames).length) return '';

  var blocks = [];
  for (var nk2 in topNames) {
    var variants = [];
    for (var j = 0; j < rows.length && variants.length < 15; j++) {
      var rr = rows[j];
      var fn = _priceFieldPick_(rr, ['ten san pham', 'ten thuong mai']);
      if (!fn || !fn.val) continue;
      if (_stripVN_(fn.val) !== nk2) continue;
      var mat = _priceFieldPick_(rr, ['chat lieu']);
      var sz = _priceFieldPick_(rr, ['kieu', 'size']);
      var prices = _priceAllPrices_(rr, stoneFilter);
      if (!prices.length) continue;
      variants.push('- Chất liệu: ' + ((mat && mat.val) ? mat.val : '(không ghi)') +
                    ' | Kiểu/Size: ' + ((sz && sz.val) ? sz.val : '(mặc định)') +
                    ' | ' + prices.join(' · '));
    }
    if (variants.length) blocks.push('SẢN PHẨM: ' + topNames[nk2] + '\n' + variants.join('\n'));
  }
  if (!blocks.length) return '';
  return blocks.join('\n\n');
}

// ─── CTKM (Sheet CTKM, cung file PRICE_SS_ID) — chi nap khi khach hoi ve khuyen mai/giam gia ──// Doc toan bo sheet CTKM thanh mang object, giong cach doc DANH_MUC (khong hardcode ten cot).
//
// NHAN DIEN HAN SU DUNG + DIEU KIEN LOAI TRU (yeu cau Duyen 27/09/2026): sheet CTKM thuong co
// 1 cot ghi NGAY KET THUC chuong trinh va 1 cot ghi DIEU KIEN KHONG AP DUNG/ngoai le. Neu chi
// hien nguyen van cho Sale tu doc, de bi bo sot (van tu van CTKM da het han, hoac quen dieu kien
// loai tru). Ham nay TU DONG do (khong hardcode ten cot, giong tinh than _priceCols_ o tren):
// so ngay HOM NAY (gio VN) voi cot ngay ket thuc de gan nhan trang thai ro rang, va tach rieng
// noi dung cot dieu kien loai tru de FE lam noi bat len — VAN GIU nguyen dong du lieu goc (khong
// an di dong nao) de Sale con xem lai neu can, chi gan them nhan trang thai.
var _CTKM_END_KW_   = ['ket thuc', 'den ngay', 'han su dung', 'het han', 'ap dung den', 'han ap dung', 'ngay het han', 'han dung'];
var _CTKM_START_KW_ = ['bat dau', 'tu ngay', 'ap dung tu'];
var _CTKM_EXCL_KW_  = ['khong ap dung', 'ngoai le', 'loai tru', 'dieu kien loai tru', 'khong dung'];

function _ctkmDetectCols_(headers) {
  var endKey = '', startKey = '', exclKey = '';
  for (var i = 0; i < headers.length; i++) {
    var st = _stripVN_(headers[i]);
    if (!endKey && _CTKM_END_KW_.some(function(kw) { return st.indexOf(kw) !== -1; })) { endKey = headers[i]; continue; }
    if (!startKey && _CTKM_START_KW_.some(function(kw) { return st.indexOf(kw) !== -1; })) { startKey = headers[i]; continue; }
    if (!exclKey && _CTKM_EXCL_KW_.some(function(kw) { return st.indexOf(kw) !== -1; })) exclKey = headers[i];
  }
  return { endKey: endKey, startKey: startKey, exclKey: exclKey };
}

// Parse 1 gia tri ngay tu sheet CTKM: co the la Date object (Sheets date cell, con nguyen luc
// nay vi ham nay duoc goi TRUOC khi readCTKMCatalog_ chuyen Date -> chuoi ISO), chuoi ISO (neu
// da bi chuyen roi), hoac chuoi "DD/MM/YYYY" go tay — thu ca 3 dang, khong bao gio throw.
function _ctkmParseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { var d1 = new Date(s); return isNaN(d1.getTime()) ? null : d1; }
  return parseVNDate_(s);
}

// Dinh dang ngay hien thi kieu VN (dd/MM/yyyy) — dung _vnYmdParts_ (offset +7 co dinh) thay vi
// Utilities.formatDate, dong bo voi ly do da giai thich o _vnYmd_ o tren (tranh phu thuoc Time
// Zone cua du an Apps Script).
function _ctkmFmtDateVN_(dt) {
  var p = _vnYmdParts_(dt);
  if (!p) return '';
  return String(p.d).padStart(2, '0') + '/' + String(p.mo).padStart(2, '0') + '/' + p.y;
}

function readCTKMCatalog_() {
  var sh = SpreadsheetApp.openById(PRICE_SS_ID).getSheetByName(CTKM_SHEET_NAME);
  // Cung nguyen tac voi readAllOrders_/readPriceCatalog_: sheet KHONG ton tai la LOI THAT, phai
  // throw thay vi am tham tra ve rong (xem chu thich chi tiet o readAllOrders_).
  if (!sh) throw new Error('Khong tim thay sheet "' + CTKM_SHEET_NAME + '" trong spreadsheet bang gia (PRICE_SS_ID) — kiem tra sheet co bi doi ten/xoa khong.');
  if (sh.getLastRow() < 2) return [];
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var hIdx = _detectHeaderRow_(vals, 10);
  var headers = vals[hIdx].map(function(h){ return String(h || '').trim(); });
  for (var hc = 0; hc < headers.length; hc++) {
    if (!headers[hc]) headers[hc] = 'Cot ' + _colLetter_(hc + 1);
  }
  var specialCols = _ctkmDetectCols_(headers);
  var todayYmd = _vnYmd_(new Date());
  var rows = [];
  for (var i = hIdx + 1; i < vals.length; i++) {
    var row = vals[i];
    var isEmpty = row.every(function(c){ return c === '' || c === null; });
    if (isEmpty) continue;
    var obj = {};
    var endRawCell = null, startRawCell = null;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = row[c];
      if (headers[c] === specialCols.endKey) endRawCell = v;     // giu RAW (co the la Date) truoc khi chuyen ISO
      if (headers[c] === specialCols.startKey) startRawCell = v;
      obj[headers[c]] = (v instanceof Date) ? v.toISOString() : v;
    }
    var endDt = specialCols.endKey ? _ctkmParseDate_(endRawCell) : null;
    var startDt = specialCols.startKey ? _ctkmParseDate_(startRawCell) : null;
    var expired = endDt ? (_vnYmd_(endDt) < todayYmd) : false;
    var upcoming = (!expired && startDt) ? (_vnYmd_(startDt) > todayYmd) : false;
    var statusLabel = '';
    if (expired) statusLabel = '❌ Đã hết hạn (kết thúc ' + _ctkmFmtDateVN_(endDt) + ')';
    else if (upcoming) statusLabel = '⏳ Chưa bắt đầu (từ ' + _ctkmFmtDateVN_(startDt) + ')';
    else if (endDt) statusLabel = '✅ Còn áp dụng (đến ' + _ctkmFmtDateVN_(endDt) + ')';
    obj.__ctkmExpired = expired;
    obj.__ctkmUpcoming = upcoming;
    obj.__ctkmStatusLabel = statusLabel;
    obj.__ctkmExclusionNote = specialCols.exclKey ? (obj[specialCols.exclKey] || '') : '';
    obj.__ctkmExclusionKey = specialCols.exclKey || '';
    rows.push(obj);
  }
  // Con dang ap dung len truoc, het han/chua toi xep xuong cuoi — Sale luon thay CTKM dung
  // duoc TRUOC TIEN, khong phai luot qua ca dong het han moi den dong con dung.
  rows.sort(function(a, b) { return (a.__ctkmExpired ? 1 : 0) - (b.__ctkmExpired ? 1 : 0); });
  return rows;
}

// ─── COMBO CO SAN (sheet "COMBO" cung file PRICE_SS_ID) ─────────────────────────────────────
// Yeu cau Duyen 17/11/2026: tao combo co san de tra cuu trong CRM (Tro ly AI "Gia san pham",
// tab Combo, Pancake AI "Soan don"). KHAC "khoCombo" (tru ton kho) va AIContext 'combo_template' (mau tin nhan).
// CS sua thang tren Google Sheets HOAC admin sua trong CRM (comboSave/comboDelete) — cung 1 sheet.
// Cot "San pham": MOI DONG 1 mon, dang "Ten | Chat lieu | Size | SL" (chi Ten bat buoc; SL mac dinh 1;
// cung nhan "2 x Ten" o dau dong).
var COMBO_SHEET_NAME = 'COMBO';
var COMBO_HEADERS = ['Mã combo', 'Tên combo', 'Sản phẩm', 'Giá combo', 'Điều kiện / Ghi chú', 'Từ ngày', 'Đến ngày', 'Từ khóa', 'Hoạt động'];
var _COMBO_STOP_ = ['combo', 'bo', 'gia', 'bao', 'nhieu', 'cho', 'toi', 'minh', 'hoi', 'xin', 'la', 'cua', 'nao', 'co', 'khong', 'the', 'nhe', 'a', 'va'];

function _comboParseItems_(text) {
  var out = [];
  String(text == null ? '' : text).split(/\r?\n/).forEach(function (line) {
    line = String(line).trim();
    if (!line) return;
    var qty = 1;
    var m = line.match(/^(\d{1,3})\s*[xX×]\s*(.+)$/);
    if (m) { qty = parseInt(m[1], 10); line = m[2]; }
    var p = line.split('|').map(function (s) { return String(s).trim(); });
    if (!p[0]) return;
    if (p.length >= 4 && /^\d{1,3}$/.test(p[3])) qty = parseInt(p[3], 10);
    if (qty < 1) qty = 1;
    out.push({ name: p[0], chatLieu: p[1] || '', size: p[2] || '', qty: qty });
  });
  return out;
}
function _comboItemsToText_(items) {
  return (items || []).map(function (it) {
    var n = String(it && it.name || '').trim();
    if (!n) return '';
    var q = parseInt(it.qty, 10); if (!(q >= 1)) q = 1;
    return n + ' | ' + String(it.chatLieu || '').trim() + ' | ' + String(it.size || '').trim() + ' | ' + q;
  }).filter(function (s) { return s; }).join('\n');
}
function _comboPriceNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var d = String(v == null ? '' : v).replace(/[^\d]/g, '');
  return d ? parseInt(d, 10) : 0;
}
function _comboRow_(r, todayYmd) {
  var sd = _ctkmParseDate_(r[5]), ed = _ctkmParseDate_(r[6]);
  var active = !(r[8] === false || String(r[8]).trim().toLowerCase() === 'false' || String(r[8]).trim() === '0' || _stripVN_(r[8]) === 'khong' || _stripVN_(r[8]) === 'tat');
  var expired = ed ? (_vnYmd_(ed) < todayYmd) : false;
  var upcoming = (!expired && sd) ? (_vnYmd_(sd) > todayYmd) : false;
  var label = '';
  if (!active) label = '⛔ Đã tắt';
  else if (expired) label = '❌ Đã hết hạn (kết thúc ' + _ctkmFmtDateVN_(ed) + ')';
  else if (upcoming) label = '⏳ Chưa bắt đầu (từ ' + _ctkmFmtDateVN_(sd) + ')';
  else if (ed) label = '✅ Còn áp dụng (đến ' + _ctkmFmtDateVN_(ed) + ')';
  else label = '✅ Đang áp dụng';
  var itemsText = String(r[2] == null ? '' : r[2]);
  return {
    code: String(r[0] == null ? '' : r[0]).trim(), name: String(r[1] == null ? '' : r[1]).trim(),
    items: _comboParseItems_(itemsText), itemsText: itemsText,
    price: _comboPriceNum_(r[3]), priceText: String(r[3] == null ? '' : r[3]).trim(),
    note: String(r[4] == null ? '' : r[4]), start: sd ? _vnYmd_(sd) : '', end: ed ? _vnYmd_(ed) : '',
    keywords: String(r[7] == null ? '' : r[7]), active: active, expired: expired, upcoming: upcoming,
    usable: active && !expired && !upcoming, statusLabel: label
  };
}
function _comboSheet_(create) {
  var ss = SpreadsheetApp.openById(PRICE_SS_ID), sh = ss.getSheetByName(COMBO_SHEET_NAME);
  if (!sh && create) {
    sh = ss.insertSheet(COMBO_SHEET_NAME);
    sh.getRange(1, 1, 1, COMBO_HEADERS.length).setValues([COMBO_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
// Doc toan bo combo (cot theo VI TRI co dinh = COMBO_HEADERS). Sheet chua co -> tu tao (CS thay ngay de dien).
function readComboCatalog_() {
  var sh = _comboSheet_(true);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, COMBO_HEADERS.length).getValues();
  var today = _vnYmd_(new Date()), rows = [];
  vals.forEach(function (r, i) {
    if (!String(r[0] || '').trim() && !String(r[1] || '').trim()) return;
    var o = _comboRow_(r, today); o.row = i + 2;
    rows.push(o);
  });
  rows.sort(function (a, b) { return (a.usable ? 0 : 1) - (b.usable ? 0 : 1); });
  return rows;
}
function _comboTokens_(q) {
  var s = _stripVN_(_priceNumWords_(q)).replace(/[^a-z0-9\s]/g, ' ');
  return s.split(/\s+/).filter(function (t) { return t && _COMBO_STOP_.indexOf(t) === -1; });
}
// Khop khong dau + doi chu so (bon->4). Moi tu khoa phai trung (ten/ma/tu khoa/san pham/ghi chu); diem cao len truoc.
function searchCombos_(rows, q) {
  var toks = _comboTokens_(q);
  if (!toks.length) return rows.slice();
  var out = [];
  rows.forEach(function (r) {
    var head = ' ' + _stripVN_(_priceNumWords_(r.name + ' ' + r.code + ' ' + r.keywords)) + ' ';
    var body = ' ' + _stripVN_(_priceNumWords_(r.itemsText + ' ' + r.note)) + ' ';
    var score = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (head.indexOf(t) !== -1) score += 3; else if (body.indexOf(t) !== -1) score += 1; else return;
    }
    out.push({ r: r, s: score + (r.usable ? 0.5 : 0) });
  });
  out.sort(function (a, b) { return b.s - a.s; });
  return out.map(function (x) { return x.r; });
}
function comboList_(q) {
  try {
    var rows = readComboCatalog_();
    var m = q ? searchCombos_(rows, q) : rows;
    return { ok: true, total: rows.length, count: m.length, rows: m.slice(0, 50) };
  } catch (err) { return { ok: false, error: 'Khong doc duoc sheet COMBO: ' + (err && err.message || err) }; }
}
function _comboNormSave_(c) {
  c = c || {};
  var name = String(c.name || '').trim();
  if (!name) return { error: 'Thieu ten combo.' };
  var items = Array.isArray(c.items) ? c.items : _comboParseItems_(c.itemsText);
  var text = _comboItemsToText_(items);
  if (!text) return { error: 'Combo can it nhat 1 san pham.' };
  var price = _comboPriceNum_(c.price != null ? c.price : c.priceText);
  if (!(price > 0)) return { error: 'Thieu gia combo (so > 0).' };
  var sd = c.start ? _ctkmParseDate_(c.start) : null, ed = c.end ? _ctkmParseDate_(c.end) : null;
  if (c.start && !sd) return { error: 'Ngay bat dau khong hop le.' };
  if (c.end && !ed) return { error: 'Ngay ket thuc khong hop le.' };
  if (sd && ed && _vnYmd_(ed) < _vnYmd_(sd)) return { error: 'Ngay ket thuc truoc ngay bat dau.' };
  return { rec: [String(c.code || '').trim(), name, text, c.priceText ? String(c.priceText).trim() : price, String(c.note || ''),
    sd ? _vnYmd_(sd) : '', ed ? _vnYmd_(ed) : '', String(c.keywords || ''), c.active === false ? false : true] };
}
function comboSave_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi duoc them/sua combo.', code: 'FORBIDDEN' });
  var n = _comboNormSave_(data && data.combo); if (n.error) return jsonOut_({ error: n.error });
  return _khoWithLock_(function () {
    var sh = _comboSheet_(true), last = sh.getLastRow(), row = 0, rec = n.rec, code = rec[0];
    if (!code) { code = 'CB' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyMMddHHmmss'); rec[0] = code; }
    if (last >= 2) {
      var codes = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var j = 0; j < codes.length; j++) if (String(codes[j][0]).trim().toUpperCase() === code.toUpperCase()) { row = j + 2; break; }
    }
    var tgt = row || (last + 1);
    sh.getRange(tgt, 1, 1, COMBO_HEADERS.length).setValues([rec]);
    return jsonOut_({ ok: true, code: code, created: !row });
  });
}
function comboDelete_(data) {
  var a = _khoAuth_(data); if (a.err) return a.err;
  if (a.user.role !== 'admin') return jsonOut_({ error: 'Chi admin moi duoc xoa combo.', code: 'FORBIDDEN' });
  var code = String(data && data.code || '').trim();
  if (!code) return jsonOut_({ error: 'Thieu ma combo.' });
  return _khoWithLock_(function () {
    var sh = _comboSheet_(false), last = sh ? sh.getLastRow() : 0;
    if (last < 2) return jsonOut_({ error: 'Khong tim thay combo.' });
    var codes = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var j = 0; j < codes.length; j++) if (String(codes[j][0]).trim().toUpperCase() === code.toUpperCase()) { sh.deleteRow(j + 2); return jsonOut_({ ok: true }); }
    return jsonOut_({ error: 'Khong tim thay combo.' });
  });
}

// Tu khoa nhan biet khach dang hoi ve khuyen mai/giam gia (khong dau, chu thuong)
var _CTKM_KEYWORDS_ = ['khuyen mai','khuyenmai','giam gia','giamgia','uu dai','uudai',
  'sale','freeship','free ship','qua tang','tang qua','ma giam','magiam','voucher',
  'flash sale','combo uu dai','ctkm',' km ','km thang','khuyen mai gi'];

// Chi tra ve noi dung CTKM khi cau hoi cua khach co tu khoa lien quan — de AI KHONG
// tu dong nhet thong tin khuyen mai vao moi cau tra loi (dung yeu cau: chi khi khach hoi).
function readCTKMPromotions_(query) {
  var q = ' ' + _stripVN_(query) + ' ';
  var matched = false;
  for (var i = 0; i < _CTKM_KEYWORDS_.length; i++) {
    if (q.indexOf(_CTKM_KEYWORDS_[i]) !== -1) { matched = true; break; }
  }
  if (!matched) return '';
  var rows = readCTKMCatalog_();
  if (!rows.length) return '';
  var blocks = [];
  for (var r = 0; r < rows.length && blocks.length < 8; r++) {
    var row = rows[r];
    if (row.__ctkmExpired) continue; // KHONG dua CTKM da het han vao goi y cho AI — tranh AI tu van nham chuong trinh khong con ap dung
    var parts = [];
    for (var k in row) {
      if (!row.hasOwnProperty(k)) continue;
      if (k.indexOf('__ctkm') === 0) continue; // cac field noi bo (trang thai/ngoai le) khong dua nguyen vao day, xu ly rieng ben duoi
      var v = row[k];
      if (v === '' || v === null || v === undefined) continue;
      parts.push(k + ': ' + v);
    }
    if (row.__ctkmStatusLabel) parts.push('Trạng thái: ' + row.__ctkmStatusLabel);
    if (parts.length) blocks.push(parts.join(' | '));
  }
  return blocks.join('\n');
}


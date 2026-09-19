// ═══════════════════════════════════════════════════════════════
//  CRM THU HIEN Portal — Google Apps Script — PHIEN BAN 22.08.2026 v13.2 (chuyen don hang sang DT TONG, bo OrderData cu)
//  v12.0: Hop nhat appweb v10.0 + ZaloAI v11.2
//         Them birthday vao CareData (col 18)
//         saveAllCare / saveSingleCare bao toan truong mo rong (khStatus, nickZalos, birthday)
//         action=lookup, reminders, getSetting (cho Zalo AI extension)
//         Groq AI thay Gemini, AIContext day du
//         getSetting_ nhat quan 1 signature: getSetting_(key)
//  Type: Web app | Execute as: Me | Who has access: Anyone
//  LUU Y: moi lan sua phai Deploy lai (New deployment hoac version moi)
// ═══════════════════════════════════════════════════════════════

var SH_CARE    = 'CareData';
var SH_TEAM    = 'Teams';
var SH_AUDIT   = 'AuditLog';
var SH_SET     = 'Settings';
var SH_ASSIGN  = 'AssignData';
var SH_USER    = 'Users';
var SH_CONTEXT = 'AIContext';
var SH_PK_STATS = 'PancakeStats';   // thong ke tuong tac/chot don hang ngay, nhap tu file Excel Pancake xuat ("Thong ke tuong tac")
var SH_PK_MAP   = 'PancakeNameMap'; // khop ten "Nhan vien" hien thi tren Pancake <-> ten Sale chuan trong CRM

var ORDER_SS_ID = '1fiWXPMZcHuEh0zYqD6pgQjZDM0PhWzpiSK7Igj6Cug8'; // File chua OrderData2x (doanh thu/don hang)
var CRM_SS_ID   = '18XBtbjP7gtlvYpChikF3B62cxHkR4426s5poZj9Mj8I'; // File chua CareData/Users/Teams/Settings/AuditLog/AssignData/AIContext (CRM).
var PRICE_SS_ID    = '1I4wr226_QUJuCZSKASsxXxOjloCW9UtpYz87TSy-Ldk'; // File "Bang gia" moi (Danh_muc/Tinh_tien/Ghi_chu_chinh_sach) - cap nhat 2026-09
var PRICE_SHEET_NAME = 'DANH_MUC'; // Sheet dang bang phang, de tra cuu/loc
var CTKM_SHEET_NAME  = 'CTKM'; // Sheet CTKM (cung file PRICE_SS_ID) — doi ten hang duoi neu ten tab thuc te khac
                        // De trong = dung file dang gan Apps Script nay (mac dinh, hanh vi cu).
                        // Dan Spreadsheet ID moi vao day de doi nguon CRM MA KHONG can gan lai script vao file khac.
// >>> Muon doi nguon du lieu sau nay: chi can sua 2 dong ID o tren (ORDER_SS_ID va/hoac CRM_SS_ID) roi Deploy lai. <<<

// ─── LINK KIEN THUC CO DINH (fallback khi chua/khong set qua Settings) ───────────
// Dan link moi vao day roi Deploy lai neu can doi — KHONG bat CS phai bam Luu trong
// extension nua. Neu Settings sheet co gia tri (key tuong ung) thi UU TIEN dung gia
// tri trong Settings truoc, hardcode duoi day chi la fallback dam bao luon co san.
var DEFAULT_PRODUCT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1YJMJs8GI7dBfDl5TNZM44n7N8lhJoeSD0KOWflU2fmM/edit?gid=1833367723#gid=1833367723';
var DEFAULT_DRIVE_KNOWLEDGE_FOLDER_URL = 'https://drive.google.com/drive/folders/1Koz4IdENS5QgdvvYMaQO1MlVEFMFAciN?hl=vi';
var DEFAULT_DRIVE_PRODUCT_IMAGES_FOLDER_URL = 'https://drive.google.com/drive/folders/1PES3V_bsYLcmIynMjRHPVjT6rJGTc6EO?hl=vi';
// ── API key AI: CHI doc tu sheet Settings, KHONG hardcode trong code ──────────────────────
// TRUOC DAY (commit f6fed69) co 3 bien DEFAULT_API_GROQ_KEY / DEFAULT_API_GEMINI_KEY /
// DEFAULT_API_OPENROUTER_KEY chua key that, de CS khoi phai tu nhap. Da BO vi 2 ly do:
//  1) BAO MAT: file nay nam trong repo GitHub, nen key bi lo cong khai. Groq va OpenRouter
//     deu co quet secret tu dong va THU HOI ngay key nao bi day len repo cong khai — dung
//     la ly do bao "Invalid API Key" (Groq) va "User not found" (OpenRouter).
//  2) CHE GIAU LOI: viet kieu `getSetting_('apiGemini') || DEFAULT_...` khien khi Settings
//     CHUA co key (vd doi sang spreadsheet/deployment moi) he thong AM THAM dung key cu
//     hardcode thay vi bao thieu key — nguoi dung nhap key moi ma khong hieu sao van loi.
// Tu gio thieu key thi bao ro thieu, khong tu y thay bang key khac.

function getOrderSS_() {
  return ORDER_SS_ID
    ? SpreadsheetApp.openById(ORDER_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getCrmSS_() {
  return CRM_SS_ID
    ? SpreadsheetApp.openById(CRM_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

var ORDER_SHEETS = [
  { name: 'OrderData21_22', years: [21, 22, 2021, 2022] },
  { name: 'OrderData23',    years: [23, 2023] },
  { name: 'OrderData24',    years: [24, 2024] },
  { name: 'OrderData25',    years: [25, 2025] },
  { name: 'OrderData26',    years: [26, 2026] }
];
var SH_ORDER_DEFAULT = 'OrderData26';

// CARE_HEADERS: 20 cols (v10.0 co 15, v11.2 co 17, v12.0 them birthday, v13.1 them zaloSetBy,
// v13.2 them name — luu ten khach truc tiep trong CareData, dung cho khach MOI chua co don
// hang nao trong OrderData nen khong co ten de lay).
var CARE_HEADERS = ['phone','status','zalo','cs','note','schedules',
  'schedGoi','schedGoiNote','schedSP','schedSPNote',
  'schedCS','schedCSNote','schedHen','schedHenNote','updated',
  'khStatus','nickZalos','birthday','zaloSetBy','name','custom'];

var ORDER_HEADERS  = ['phone','name','date','year','month','cs','source','revenue',
  'product','productDetail','status','zalo','note','careCS'];
var TEAM_HEADERS   = ['id','name','leader','members','color','channels'];
var AUDIT_HEADERS  = ['timestamp','user','action','phone','oldValue','newValue'];
var SET_HEADERS    = ['key','value'];
var ASSIGN_HEADERS = ['id','date','csName','label','phones','donePhones'];
var USER_HEADERS   = ['username','passHash','role','name','team','active','names'];
// PK_STATS_HEADERS: 1 dong = 1 "Nhan vien" (ten hien thi tren Pancake) trong 1 Page, 1 ngay —
// nhap tu file Excel "Thong ke tuong tac" (pages_statistics_engagements) Pancake xuat ra.
// Khoa duy nhat = date+pageId+nhanVien -> nap lai file CUNG 1 ngay se GHI DE (khong nhan doi).
var PK_STATS_HEADERS = ['date','pageId','pageName','nhanVien','khCu','khMoi','tongTT',
  'tinNhan','binhLuan','hoiThoaiMoi','dhKhMoi','dhKhCu','tongDH'];
// PK_MAP_HEADERS: khop 1-1 ten hien thi Pancake -> ten Sale chuan trong CRM (dung chung moi
// Page, vi thuong 1 nguoi dung 1 ten Facebook ca nhan cho ca nhieu Page).
var PK_MAP_HEADERS = ['pancakeName','saleName'];
// ── KH "Chăm sóc" thêm nhanh (nút "+ Thêm KH/Đơn mới") — SHEET RIÊNG, không gộp
// CareData/DT TỔNG/dữ liệu đơn, không gộp vào báo cáo doanh số A/B/C. ──
var SH_CARE_LEAD      = 'KH Chăm sóc mới';
var CARE_LEAD_HEADERS = ['phone','name','note','cs','createdAt'];

// ─── HELPERS ───────────────────────────────────────────────────
function getSheet_(name, headers) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headers) sh.appendRow(headers);
  else if (headers && sh.getLastRow() > 0) {
    // Neu sheet da co san (tao tu ban cu, it cot hon) -> bo sung cac cot header con thieu
    // o cuoi, KHONG dung lai/xoa du lieu hien co. Vi du: them cot 'zaloSetBy' o ban v13.1.
    var curLastCol = sh.getLastColumn();
    if (curLastCol < headers.length) {
      var curHeaders = curLastCol > 0 ? sh.getRange(1, 1, 1, curLastCol).getValues()[0] : [];
      var missing = headers.slice(curHeaders.length);
      if (missing.length) sh.getRange(1, curHeaders.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  return sh;
}
function getOrderSheet_(name) {
  var ss = getOrderSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(ORDER_HEADERS); }
  return sh;
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function getOrderSheetName_(year) {
  var y = Number(year);
  for (var i = 0; i < ORDER_SHEETS.length; i++) {
    if (ORDER_SHEETS[i].years.indexOf(y) !== -1) return ORDER_SHEETS[i].name;
  }
  return SH_ORDER_DEFAULT;
}
function normPhone_(p) {
  if (!p) return '';
  var s = String(p).replace(/[^0-9]/g, '');
  if (s.length === 11 && s.indexOf('84') === 0) s = '0' + s.substring(2);
  if (s.length === 9 && /^[3-9]/.test(s)) s = '0' + s;
  return s;
}

// ─── BANG GIA (Sheet DANH_MUC, file PRICE_SS_ID) ──────────────────────────
// Bo dau tieng Viet de tim kiem khong phan biet co dau/khong dau, hoa/thuong.
function _stripVN_(s) {
  if (!s) return '';
  s = String(s).toLowerCase();
  s = s.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a');
  s = s.replace(/[èéẹẻẽêềếệểễ]/g, 'e');
  s = s.replace(/[ìíịỉĩ]/g, 'i');
  s = s.replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o');
  s = s.replace(/[ùúụủũưừứựửữ]/g, 'u');
  s = s.replace(/[ỳýỵỷỹ]/g, 'y');
  s = s.replace(/đ/g, 'd');
  return s;
}

// Tu do dong tieu de trong vals (mang 2 chieu). KHONG hardcode dong 1 nua:
// file "Bang gia Hien Tour" co dong 1 gan nhu trong (chi co o gop "G7" phia tren cot
// Gia SAPHIA/RUBY), tieu de that nam o DONG 2 -> truoc day doc dong 1 lam header khien
// gan het cot bi bo qua (headers rong) => moi dong doc ra chi con vai truong, haystack
// tim kiem gan nhu rong => tra cuu ten san pham dung van bao "Khong tim thay".
// Cach do: quet toi da 10 dong dau, chon dong co NHIEU O TEXT nhat va co chua tu khoa
// tieu de quen thuoc (ten/gia/nhom/chat lieu/size...).
function _detectHeaderRow_(vals, maxScan) {
  var limit = Math.min(vals.length, maxScan || 10);
  var bestIdx = 0, bestScore = -1;
  var KEYS = ['ten', 'gia', 'nhom', 'chat lieu', 'size', 'stt', 'san pham', 'thuong mai', 'link'];
  for (var r = 0; r < limit; r++) {
    var row = vals[r] || [];
    var filled = 0, kw = 0;
    for (var c = 0; c < row.length; c++) {
      var t = String(row[c] == null ? '' : row[c]).trim();
      if (!t) continue;
      filled++;
      var st = _stripVN_(t);
      for (var k = 0; k < KEYS.length; k++) {
        if (st.indexOf(KEYS[k]) !== -1) { kw++; break; }
      }
    }
    // uu tien dong co tu khoa tieu de, sau do den so o co noi dung
    var score = kw * 10 + filled;
    if (score > bestScore) { bestScore = score; bestIdx = r; }
  }
  return bestIdx;
}

// Doc toan bo sheet DANH_MUC thanh mang object {tenCot: giaTri...}, dua theo dong tieu de
// (tu do, xem _detectHeaderRow_) — khong hardcode ten cot lan vi tri dong tieu de, sheet
// doi/them cot hay chen them dong trang o tren van chay binh thuong.
function readPriceCatalog_() {
  var sh = SpreadsheetApp.openById(PRICE_SS_ID).getSheetByName(PRICE_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
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
  return rows;
}

// Doi so thu tu cot (1-based) sang chu cai cot kieu Excel: 1->A, 7->G, 27->AA
function _colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
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

function _priceVariantsForPrompt_(userMsg) {
  var rows;
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('price_catalog_v2');
    if (cached) { try { rows = JSON.parse(cached); } catch (e) {} }
    if (!rows) {
      rows = readPriceCatalog_();
      try { cache.put('price_catalog_v2', JSON.stringify(rows), 600); } catch (e) {}
    }
  } catch (e) { return ''; }
  if (!rows || !rows.length) return '';

  // Loai da khach/sale nhac toi (tu tin nhan, ngu canh, hoac o tick "Loai da" ben Pancake AI
  // extension gui kem duoi dang "Loại đá khách hỏi: SAPHIA/RUBY" trong [KH]) — QUYET DINH
  // cot gia nao duoc dua vao bang duoi day (xem _priceAllPrices_).
  var stripped = _stripVN_(userMsg);
  var stoneFilter = '';
  if (stripped.indexOf('saphia') !== -1) stoneFilter = 'SAPHIA';
  else if (stripped.indexOf('ruby') !== -1) stoneFilter = 'RUBY';

  var toks = stripped.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function (w) { return w.length >= 3 && _PRICE_STOPWORDS_.indexOf(w) === -1; });
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
    nameBlob = _stripVN_(nameBlob);
    if (!nameBlob.trim()) continue;
    var hit = 0;
    for (var t = 0; t < toks.length; t++) if (nameBlob.indexOf(toks[t]) !== -1) hit++;
    if (hit >= 2) scored.push({ row: r, hit: hit, name: nameBlob });
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
function readCTKMCatalog_() {
  var sh = SpreadsheetApp.openById(PRICE_SS_ID).getSheetByName(CTKM_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  var vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var hIdx = _detectHeaderRow_(vals, 10);
  var headers = vals[hIdx].map(function(h){ return String(h || '').trim(); });
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
      obj[headers[c]] = (v instanceof Date) ? v.toISOString() : v;
    }
    rows.push(obj);
  }
  return rows;
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
  for (var r = 0; r < rows.length && r < 8; r++) {
    var row = rows[r], parts = [];
    for (var k in row) {
      if (!row.hasOwnProperty(k)) continue;
      var v = row[k];
      if (v === '' || v === null || v === undefined) continue;
      parts.push(k + ': ' + v);
    }
    if (parts.length) blocks.push(parts.join(' | '));
  }
  return blocks.join('\n');
}

// ─── SETTINGS (1 signature duy nhat) ──────────────────────────
function getSetting_(key) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    // .trim() o CA 2 ve: copy-paste API key rat hay dinh khoang trang/xuong dong o cuoi,
    // ma ky tu do lot vao header Authorization se lam request hong -> bao "Invalid API Key"
    // du key go dung. Truoc day khong trim nen loi nay rat kho doan ra.
    if (String(vals[i][0]).trim() === key) {
      var v = vals[i][1];
      if (v === '' || v === null || v === undefined) return null;
      return String(v).trim() || null;
    }
  }
  return null;
}
function setSetting_(key, value) {
  var sh = getSheet_(SH_SET, SET_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last-1, 1).createTextFinder(String(key)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  if (rowIdx > 0) sh.getRange(rowIdx, 2).setValue(value);
  else sh.appendRow([key, value]);
  return jsonOut_({ ok: true });
}
function addZaloNick_(nick) {
  nick = String(nick || '').trim();
  if (!nick) return jsonOut_({ error: 'Thieu nick' });
  var raw = getSetting_('nickZaloList');
  var list = [];
  try { list = JSON.parse(raw || '[]'); } catch (e) {}
  if (!Array.isArray(list)) list = [];
  if (list.indexOf(nick) === -1) list.push(nick);
  setSetting_('nickZaloList', JSON.stringify(list));
  return jsonOut_({ ok: true, list: list });
}

function readCareStatus_(ss) {
  var sh = ss.getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (vals[i][0] === 'careStatus') { try { return JSON.parse(vals[i][1]); } catch(e) { return null; } }
  }
  return null;
}

// ─── CARE READ / WRITE ─────────────────────────────────────────
// Chuyen 1 hang sheet thanh object care (xu ly graceful neu sheet co it cot hon)
function careObjFromRow_(row) {
  var parseNZ = function(v) { try { return JSON.parse(v||'[]'); } catch(e) { return []; } };
  var parseSetBy = function(v) { try { return JSON.parse(v||'null'); } catch(e) { return null; } };
  return {
    phone:        String(row[0]||''),
    status:       row[1]||'',
    zalo:         row[2]||'',
    cs:           row[3]||'',
    note:         row[4]||'',
    schedules:    row[5]||'',
    schedGoi:     row[6]||'',
    schedGoiNote: row[7]||'',
    schedSP:      row[8]||'',
    schedSPNote:  row[9]||'',
    schedCS:      row[10]||'',
    schedCSNote:  row[11]||'',
    schedHen:     row[12]||'',
    schedHenNote: row[13]||'',
    updated:      row[14]||'',
    khStatus:     row[15]||'',
    nickZalos:    parseNZ(row[16]),
    birthday:     row[17]||'',
    zaloSetBy:    parseSetBy(row[18]), // { cs, nick, at } - ai/nick nao vua ghi trang thai 'zalo' gan nhat
    name:         row[19]||'',
    // Gia tri cac "truong tu tao" admin them (xem CUSTOM_FIELDS ben index.html) — luu gop 1 cot
    // JSON de khong phai them cot moi moi lan admin tao them truong.
    custom:       (function(v){ try { var o = JSON.parse(v||'{}'); return (o && typeof o === 'object') ? o : {}; } catch(e) { return {}; } })(row[20])
  };
}

function readCare_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    out.push(careObjFromRow_(vals[i]));
  }
  return out;
}

function findCareByPhone_(phone) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CARE);
  if (!sh || sh.getLastRow() < 2) return null;
  var ph = normPhone_(phone);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    if (normPhone_(vals[i][0]) === ph) return careObjFromRow_(vals[i]);
  }
  return null;
}

// careRow_: 21 cols. Neu truong khong co thi de trong.
function careRow_(r) {
  var nz = r.nickZalos;
  if (!Array.isArray(nz)) { try { nz = JSON.parse(nz||'[]'); } catch(e) { nz = []; } }
  var setBy = r.zaloSetBy;
  if (setBy && typeof setBy !== 'string') { try { setBy = JSON.stringify(setBy); } catch(e) { setBy = ''; } }
  var cust = r.custom;
  if (typeof cust === 'string') { try { cust = JSON.parse(cust||'{}'); } catch(e) { cust = {}; } }
  if (!cust || typeof cust !== 'object') cust = {};
  return [
    r.phone||'', r.status||'', r.zalo||'', r.cs||'', r.note||'', r.schedules||'',
    r.schedGoi||'', r.schedGoiNote||'', r.schedSP||'', r.schedSPNote||'',
    r.schedCS||'', r.schedCSNote||'', r.schedHen||'', r.schedHenNote||'',
    new Date().toISOString(),
    r.khStatus||'', JSON.stringify(nz), r.birthday||'', setBy||'', r.name||'',
    JSON.stringify(cust)
  ];
}

// Doc du lieu existing de bao toan truong mo rong (khStatus, nickZalos, birthday, zaloSetBy, name)
// khi appweb gui len khong co cac truong nay
function readExistingExtFields_(sh) {
  var map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    map[String(vals[i][0])] = {
      khStatus:  vals[i][15]||'',
      nickZalos: vals[i][16]||'[]',
      birthday:  vals[i][17]||'',
      zaloSetBy: vals[i][18]||'',
      name:      vals[i][19]||''
    };
  }
  return map;
}

// Merge incoming row voi existing ext fields neu incoming khong co
function mergeExtFields_(r, ex) {
  if (!ex) return r;
  if (r.khStatus  === undefined || r.khStatus  === null || r.khStatus  === '') r.khStatus  = ex.khStatus  || '';
  if (r.birthday  === undefined || r.birthday  === null || r.birthday  === '') r.birthday  = ex.birthday  || '';
  if (r.zaloSetBy === undefined || r.zaloSetBy === null || r.zaloSetBy === '') r.zaloSetBy = ex.zaloSetBy || '';
  if (r.name      === undefined || r.name      === null || r.name      === '') r.name      = ex.name      || '';
  if (r.nickZalos === undefined || r.nickZalos === null ||
      (Array.isArray(r.nickZalos) && r.nickZalos.length === 0)) {
    try { r.nickZalos = JSON.parse(ex.nickZalos||'[]'); } catch(e) { r.nickZalos = []; }
  }
  return r;
}

// ─── ORDER READ ────────────────────────────────────────────────
// (readOrdersByPhone_/readAllOrders_ nay doc tu DT TONG — dinh nghia o gan DT_SS_ID ben duoi)
function _legacyReadOrdersUnused_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var ov = sh.getDataRange().getValues();
  for (var j = 1; j < ov.length; j++) {
    if (!ov[j][0]) continue;
    out.push({
      phone: ov[j][0], name: ov[j][1]||'', date: ov[j][2]||'', year: ov[j][3]||'',
      month: ov[j][4]||'', cs: ov[j][5]||'', source: ov[j][6]||'', revenue: ov[j][7]||0,
      product: ov[j][8]||'', productDetail: ov[j][9]||'', status: ov[j][10]||'',
      zalo: ov[j][11]||'', note: ov[j][12]||'', careCS: ov[j][13]||''
    });
  }
  return out;
}

function readTeams_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0] && !v[i][1]) continue;
    var members = [];
    try { members = v[i][3] ? JSON.parse(v[i][3]) : []; } catch(e) { members = (''+v[i][3]).split(',').filter(String); }
    // channels: danh sach ten Kenh ban (kenhBan) ma team NAY chi tinh doanh thu trong do — de
    // trong (mang rong) = khong gioi han kenh, tinh het nhu truoc gio. Dung khi 1 so CS thuoc
    // team khac nhung chi chay tren 1 kenh nhat dinh, can tach doanh thu rieng theo kenh do.
    var channels = [];
    try { channels = v[i][5] ? JSON.parse(v[i][5]) : []; } catch(e2) { channels = (''+v[i][5]).split(',').map(function(s){return s.trim();}).filter(String); }
    out.push({ id: v[i][0], name: v[i][1]||'', leader: v[i][2]||'', members: members, color: v[i][4]||'', channels: channels });
  }
  return out;
}

function readUsers_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    // Tài khoản CS có thể gắn NHIỀU tên (vd 1 tài khoản dùng chung, hoặc gộp nhiều bí danh của
    // cùng 1 sale) — luu o cot 'names' (JSON array), moi rieng bien tuong thich nguoc: tai khoan
    // tao truoc khi co tinh nang nay chi co cot 'name' don (chuoi thuong), luc do fallback ve
    // mang 1 phan tu tu chinh cot do.
    var namesArr = [];
    try { namesArr = v[i][6] ? JSON.parse(v[i][6]) : []; } catch (e) { namesArr = []; }
    if (!namesArr.length && v[i][3]) namesArr = [String(v[i][3])];
    out.push({
      username: String(v[i][0]), passHash: String(v[i][1]||''), role: v[i][2]||'cs',
      name: v[i][3]||'', team: v[i][4]||'',
      active: (v[i][5]===''||v[i][5]===undefined) ? true :
              (v[i][5]===true||v[i][5]==='TRUE'||v[i][5]==='true'||v[i][5]===1),
      names: namesArr
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  doGet
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    var ss = getCrmSS_();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    // ── lookup theo phone (ZaloAI extension) ──
    if (action === 'lookup') {
      var phone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phone) return jsonOut_({ error: 'Thieu phone' });
      var cache = CacheService.getScriptCache();
      var cKey = 'lk_' + normPhone_(phone);
      var cached = cache.get(cKey);
      if (cached) { try { return jsonOut_(JSON.parse(cached)); } catch(ec) {} }
      var res = { ok: true, care: findCareByPhone_(phone), orders: readOrdersByPhone_(phone) };
      try { cache.put(cKey, JSON.stringify(res), 15); } catch(ec) {}
      return jsonOut_(res);
    }

    // ── danh sach KH + trang thai CS (appweb + extension) ──
    if (action === 'customers') {
      var cache2 = CacheService.getScriptCache();
      var cKey2  = 'customers_v12';
      var cached2 = cache2.get(cKey2);
      if (cached2) { try { return jsonOut_(JSON.parse(cached2)); } catch(ec) {} }
      var res2 = { rows: readCare_(ss.getSheetByName(SH_CARE)), careStatus: readCareStatus_(ss) };
      try { cache2.put(cKey2, JSON.stringify(res2), 300); } catch(ec) {}
      return jsonOut_(res2);
    }

    if (action === 'orders')    return jsonOut_({ orders: readAllOrders_() });
    if (action === 'teams')     return jsonOut_({ teams: readTeams_(ss.getSheetByName(SH_TEAM)) });
    if (action === 'users')     return jsonOut_({ users: readUsers_(ss.getSheetByName(SH_USER)) });
    // ── Bao cao Pancake (nhap tu file Excel "Thong ke tuong tac") ──
    if (action === 'pancakeNameMap') return jsonOut_({ map: readPancakeMap_() });
    if (action === 'pancakeReport')  return jsonOut_(buildPancakeReport_(e.parameter.from, e.parameter.to, e.parameter.split));
    // ── Nguon "Cham soc" (KH them nhanh, sheet rieng) — khong gop CareData/bao cao A-B-C ──
    if (action === 'careLeads') return jsonOut_({ rows: readCareLeads_() });
    // ── Tap SDT co trong "dữ liệu đơn" — chi de loc nguon o man hinh chinh (cache 10') ──
    if (action === 'donPhones') {
      var cacheDP = CacheService.getScriptCache();
      var cKeyDP = 'don_phones_v3';
      var cachedDP = cacheDP.get(cKeyDP);
      if (cachedDP) { try { return jsonOut_(JSON.parse(cachedDP)); } catch(ec) {} }
      var resDP = { phones: readDonPhones_(), saleByPhone: getDonSaleByPhone_(), orderCountByPhone: getDonOrderCountByPhone_() };
      try { cacheDP.put(cKeyDP, JSON.stringify(resDP), 600); } catch(ec) {}
      return jsonOut_(resDP);
    }

    // ── Tra cuu bang gia (Sheet DANH_MUC, file rieng PRICE_SS_ID) — dung chung cho
    // portal/Sasum/Pancake. Tim khong dau, khop tren MOI cot dang text cua sheet, khong
    // can biet truoc ten cot (tu doc dong tieu de dong 1). ──
    if (action === 'priceSearch') {
      var q = (e && e.parameter && e.parameter.q) ? String(e.parameter.q) : '';
      var cachePS = CacheService.getScriptCache();
      var cKeyPS = 'price_catalog_v2';
      var cachedPS = cachePS.get(cKeyPS);
      var rowsPS;
      if (cachedPS) { try { rowsPS = JSON.parse(cachedPS); } catch(ec) {} }
      if (!rowsPS) {
        rowsPS = readPriceCatalog_();
        try { cachePS.put(cKeyPS, JSON.stringify(rowsPS), 600); } catch(ec) {} // cache 10 phut, sheet gia it doi
      }
      var matched = q ? searchPriceCatalog_(rowsPS, q) : rowsPS.slice(0, 50);
      return jsonOut_({ ok: true, total: rowsPS.length, count: matched.length, rows: matched });
    }

    if (action === 'audit') {
      var shA = ss.getSheetByName(SH_AUDIT); var auditRows = [];
      if (shA && shA.getLastRow() > 1) {
        var lastA = shA.getLastRow();
        var nA = Math.min(200, lastA - 1);
        var vA = shA.getRange(lastA - nA + 1, 1, nA, 6).getValues();
        for (var ai = vA.length - 1; ai >= 0; ai--) {
          auditRows.push({ timestamp: vA[ai][0], user: vA[ai][1], action: vA[ai][2],
            phone: vA[ai][3], oldValue: vA[ai][4], newValue: vA[ai][5] });
        }
      }
      return jsonOut_({ audit: auditRows });
    }

    if (action === 'dashboard') return jsonOut_(buildDashboard_());

    // ── Bao cao doanh so CRM moi (nguon: Google Sheet "DT tong" goc) ──
    if (action === 'salesReportA') {
      var pA = e.parameter || {};
      var fA = { dateFrom: pA.dateFrom || '', dateTo: pA.dateTo || '',
                 dateField: pA.dateField || 'ngayTao',
                 sale: pA.sale ? pA.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pA.kenh ? pA.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pA.sanPham || '',
                 byCreator: pA.byCreator === '1' || pA.byCreator === 'true' };
      var cacheA = CacheService.getScriptCache();
      var cKeyA = 'salesA_' + JSON.stringify(fA);
      var cachedA = cacheA.get(cKeyA);
      if (cachedA) { try { return jsonOut_(JSON.parse(cachedA)); } catch(ec) {} }
      var resA = buildSalesReportA_(fA);
      try { cacheA.put(cKeyA, JSON.stringify(resA), 120); } catch(ec) {}
      return jsonOut_(resA);
    }
    if (action === 'salesReportB') {
      var pB = e.parameter || {};
      var splitCSV_ = function(s){ return s ? s.split(',').map(function(x){return x.trim();}).filter(function(x){return x;}) : []; };
      var fB = { dateFrom: pB.dateFrom || '', dateTo: pB.dateTo || '',
                 sale: splitCSV_(pB.sale), nguon: splitCSV_(pB.nguon), marketer: splitCSV_(pB.marketer),
                 sanPham: pB.sanPham || '',
                 careStatus: splitCSV_(pB.careStatus), khStatus: splitCSV_(pB.khStatus),
                 zaloStatus: splitCSV_(pB.zaloStatus), nickZalo: pB.nickZalo || '' };
      var cacheB = CacheService.getScriptCache();
      var cKeyB = 'salesB_' + JSON.stringify(fB);
      var cachedB = cacheB.get(cKeyB);
      if (cachedB) { try { return jsonOut_(JSON.parse(cachedB)); } catch(ec) {} }
      var resB = buildSalesReportB_(fB);
      try { cacheB.put(cKeyB, JSON.stringify(resB), 120); } catch(ec) {}
      return jsonOut_(resB);
    }
    if (action === 'salesReportOptions') return jsonOut_(getSalesReportOptions_());
    // ── TACH TEN KH: xem truoc danh sach ten doan duoc tu don hang (chua ghi gi) ──
    if (action === 'previewCustomerNameGuesses') return jsonOut_(previewCustomerNameGuesses_());
    if (action === 'salesReportC') {
      var pC = e.parameter || {};
      var fC = { dateField: pC.dateField || 'ngayTao', periodType: pC.periodType || 'week',
                 weekOffset: pC.weekOffset || 0, monthOffset: pC.monthOffset || 0, quarterOffset: pC.quarterOffset || 0,
                 customCurFrom: pC.customCurFrom || '', customCurTo: pC.customCurTo || '',
                 customPrevFrom: pC.customPrevFrom || '', customPrevTo: pC.customPrevTo || '',
                 sale: pC.sale ? pC.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pC.kenh ? pC.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pC.sanPham || '' };
      var cacheC = CacheService.getScriptCache();
      var cKeyC = 'salesC_' + JSON.stringify(fC);
      var cachedC = cacheC.get(cKeyC);
      if (cachedC) { try { return jsonOut_(JSON.parse(cachedC)); } catch(ec) {} }
      var resC = buildSalesReportC_(fC);
      try { cacheC.put(cKeyC, JSON.stringify(resC), 120); } catch(ec) {}
      return jsonOut_(resC);
    }

    // ── BAO CAO D: KH "Chăm sóc" thêm nhanh (sheet riêng, KHÔNG gộp báo cáo A/B/C) ──
    if (action === 'careLeadReport') {
      var pD = e.parameter || {};
      var fD = { dateFrom: pD.dateFrom || '', dateTo: pD.dateTo || '', cs: pD.cs || '' };
      return jsonOut_(buildCareLeadReport_(fD));
    }

    if (action === 'assign')    return jsonOut_({ assignHistory: readAssign_(ss.getSheetByName(SH_ASSIGN)) });
    if (action === 'tasks')     return jsonOut_({ tasks: readTasks_(ss.getSheetByName(SH_TASK)) });

    // ── Danh sach binh luan cua 1 cong viec (tab "Thao luan") ──
    if (action === 'taskComments') {
      var taskIdQ = (e && e.parameter && e.parameter.taskId) ? String(e.parameter.taskId) : '';
      if (!taskIdQ) return jsonOut_({ error: 'Thieu taskId' });
      return jsonOut_({ comments: readTaskComments_(ss.getSheetByName(SH_TASK_COMMENT), taskIdQ) });
    }

    if (action === 'count') {
      var shC = ss.getSheetByName(SH_CARE);
      var shDT = getDTSS_().getSheetByName(DT_TONG_SHEET);
      var totalOrders = shDT ? Math.max(0, shDT.getLastRow() - 1) : 0;
      return jsonOut_({ orderRows: totalOrders, careRows: shC ? Math.max(0, shC.getLastRow()-1) : 0, ver: 'v13.2-dttong' });
    }

    // ── lich hen hom nay / qua han (ZaloAI extension) ──
    if (action === 'reminders') {
      var csFilter = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      var shR = ss.getSheetByName(SH_CARE);
      if (!shR || shR.getLastRow() < 2) return jsonOut_({ reminders: [] });
      var valsR = shR.getDataRange().getValues();
      var today = new Date(); today.setHours(0,0,0,0);
      var reminders = [], seenR = {};
      for (var ri = 1; ri < valsR.length; ri++) {
        if (!valsR[ri][0]) continue;
        var rcs = String(valsR[ri][3]||'').trim();
        if (csFilter && rcs !== csFilter) continue;
        var rhen = valsR[ri][12];
        if (!rhen) continue;
        var rdate = new Date(rhen); rdate.setHours(0,0,0,0);
        // CHỈ hẹn TRONG NGÀY hôm nay (không lấy quá hạn) — extension chỉ nhắc lịch của ngày
        if (rdate.getTime() !== today.getTime()) continue;
        // Gộp trùng: mỗi SĐT chỉ 1 nhắc (tránh nhân bản do CareData có dòng trùng)
        var npR = normPhone_(String(valsR[ri][0]));
        if (seenR[npR]) continue;
        seenR[npR] = true;
        reminders.push({
          phone: String(valsR[ri][0]), schedHen: String(rhen),
          schedHenNote: String(valsR[ri][13]||''), cs: rcs,
          status: String(valsR[ri][1]||''), zalo: String(valsR[ri][2]||''), overdue: false
        });
      }
      return jsonOut_({ reminders: reminders });
    }

    // ── lay 1 setting (ZaloAI extension: careStatus, nickZaloList) ──
    if (action === 'getSetting') {
      var skey = (e && e.parameter && e.parameter.key) ? String(e.parameter.key) : '';
      return jsonOut_({ value: getSetting_(skey) });
    }

    // ── BROADCAST: hang doi tin gui hang loat cho 1 CS (ZaloAI extension) ──
    if (action === 'broadcastQueue') {
      var bcCs = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      return jsonOut_({ broadcasts: broadcastQueueForCS_(bcCs) });
    }
    // ── BROADCAST: danh sach toan bo chien dich (Sasum quan ly) ──
    if (action === 'broadcastList') {
      return jsonOut_({ broadcasts: readBroadcasts_() });
    }

    // ── HOI THAM TU DONG: xem mau tin hien co (de kiem tra da cau hinh chua) ──
    if (action === 'followUpTemplates') {
      var fuTpls = readFollowUpTemplates_();
      var fuDays = {};
      Object.keys(fuTpls).forEach(function (k) { var dd = parseInt(k.split('|')[1], 10); if (dd > 0) fuDays[dd] = true; });
      var fuDayList = Object.keys(fuDays).map(Number).sort(function(a,b){return a-b;});
      return jsonOut_({ templates: fuTpls, list: listFollowUpTemplates_(), checkpoints: fuDayList.length ? fuDayList : FU_CHECKPOINTS });
    }
    // ── HOI THAM TU DONG: bang ma san pham (doc dong tu sheet "Mã Zalo", ZaloAI extension dung de doc ten Zalo) ──
    if (action === 'productCodeMap') {
      return jsonOut_({ map: getProductCodeMap_() });
    }
    // ── HOI THAM TU DONG: kich hoat thu cong ngay (thay vi cho Time-driven trigger) ──
    if (action === 'runFollowUpScan') {
      return jsonOut_(runFollowUpScan_());
    }
    // ── XOA DON TRUNG: quet don trung (cung SDT+nam+thang+doanh thu). Truyen &phone= de chi quet 1 khach (ZaloAI extension) ──
    if (action === 'findDuplicateOrders') {
      var fdoPhone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      return jsonOut_(findDuplicateOrders_(fdoPhone));
    }
    if (action === 'dedupeCare') return dedupeCare_();

    // default — backward compat voi appweb v10
    var resD = { rows: readCare_(ss.getSheetByName(SH_CARE)), orders: [] };
    if (!(e && e.parameter && e.parameter.noOrders)) resD.orders = readAllOrders_();
    resD.careStatus = readCareStatus_(ss);
    return jsonOut_(resD);

  } catch(err) {
    return jsonOut_({ error: err.message });
  }
}

function buildDashboard_() {
  var care = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  var orders = readAllOrders_();
  var phones = {}, revenue = 0, friend = 0;
  for (var i = 0; i < care.length; i++) {
    if (care[i].zalo === 'Da ket ban' || care[i].zalo === 'Đã kết bạn') friend++;
  }
  for (var j = 0; j < orders.length; j++) {
    phones[orders[j].phone] = true;
    revenue += Number(orders[j].revenue) || 0;
  }
  return { totalCustomers: Object.keys(phones).length, totalOrders: orders.length,
           totalRevenue: revenue, careRows: care.length, zaloFriends: friend };
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO DOANH SO CRM MOI (nguon: Google Sheet "DT tong" goc)
//  KHONG dung ORDER_SS_ID/ORDER_SHEETS cu — day la nguon doc lap moi.
//  Bao cao A = sheet "DT TỔNG " (cap don hang)
//  Bao cao B = sheet "dữ liệu đơn" (cap san pham, da gui khach)
// ═══════════════════════════════════════════════════════════════

var DT_SS_ID = '1fiWXPMZcHuEh0zYqD6pgQjZDM0PhWzpiSK7Igj6Cug8'; // Google Sheet "DT tong" goc

var DT_TONG_SHEET     = 'DT TỔNG ';    // luu y: co dau cach o cuoi ten sheet, giu nguyen
var DON_CHITIET_SHEET = 'dữ liệu đơn';

// ─── DT TỔNG = nguon "don hang" CHUAN MOI (thay the hoan toan OrderData21_22..26 cu) ───
// Cot (0-indexed, A=0): A=ngayTao | C=giaoCho | D=SDT khach (dat ten cot la "Ten nhiem vu"
// nhung thuc chat luu SDT theo quy uoc noi bo) | G=giaiDoan | H=trangThai | K=thoiGianHT
// (dung lam "ngay mua" chinh, theo yeu cau Duyen 22/8/2026) | M=kenhBan | N=saleBan |
// O=sanPham (LUU Y: cot nay la text tu do nhan vien go tay ten KH+dia chi, KHONG phai
// ten san pham sach — khong dung de so khop san pham cho hoi tham tu dong/bao cao SP) |
// P=phanLoai | Q=giaTriCoc | R=giaTriDon (dung lam revenue) | S=giaTriChenh | T=id (duy
// nhat, dung de sua/xoa dong chinh xac thay vi do theo phone+nam+thang+doanh thu nhu truoc)
var DT_COL_NGAYTAO    = 0;
var DT_COL_GIAOCHO    = 2;
var DT_COL_PHONE      = 3;
var DT_COL_GIAIDOAN   = 6;
var DT_COL_TRANGTHAI  = 7;
var DT_COL_THOIGIANHT = 10;
var DT_COL_KENHBAN    = 12;
var DT_COL_SALEBAN    = 13;
var DT_COL_SANPHAM    = 14;
var DT_COL_PHANLOAI   = 15;
var DT_COL_GIATRICOC  = 16;
var DT_COL_GIATRIDON  = 17;
var DT_COL_GIATRICHENH= 18;
var DT_COL_ID         = 19;
var DT_TONG_WIDTH     = 20; // A:T

// Chuyen 1 hang tho cua DT TONG thanh object "don hang" (giu ten truong nhu ORDER_HEADERS
// cu de cac cho khac trong code/frontend it phai sua nhat co the)
function dtRowToOrder_(row, rowIndex) {
  var dtVal = row[DT_COL_THOIGIANHT];
  var d = parseVNDate_(dtVal);
  return {
    id: row[DT_COL_ID] != null ? String(row[DT_COL_ID]) : '',
    rowIndex: rowIndex,
    phone: normPhone_(String(row[DT_COL_PHONE] || '')),
    name: '', // KHONG co san ten khach rieng trong DT TONG (chi co SDT), de trong
    date: dtVal || row[DT_COL_NGAYTAO] || '',
    // orderDate: LUON la Ngay tao, KHONG bao gio doi theo trang thai don (khac voi 'date' o
    // tren, von chuyen sang Thoi gian hoan thanh ngay khi don duoc danh dau xong). Dung field
    // nay lam moc goc cho cac tinh toan can ON DINH qua thoi gian (vd: lich nhac auto Data Dao
    // +7/+14 ngay) — neu dung 'date' cu, moc goc se nhay sang ngay khac ngay khi don hoan thanh,
    // lam ID lich nhac doi theo va khien lich da xoa/da lam bi tao lai y het (bug da gap).
    orderDate: row[DT_COL_NGAYTAO] || '',
    year: d ? d.getFullYear() : '',
    month: d ? (d.getMonth() + 1) : '',
    cs: String(row[DT_COL_SALEBAN] || ''),
    source: String(row[DT_COL_KENHBAN] || ''),
    revenue: _normMoney_(row[DT_COL_GIATRIDON]),
    product: String(row[DT_COL_SANPHAM] || ''),       // text tu do, xem luu y o tren
    productDetail: String(row[DT_COL_PHANLOAI] || ''),
    status: String(row[DT_COL_TRANGTHAI] || ''),
    zalo: '',
    note: String(row[DT_COL_GIAIDOAN] || ''),
    careCS: '' // DT TONG khong co cot rieng cho careCS — xem setOrderCareCS_ ben duoi
  };
}

function readAllOrders_() {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[DT_COL_PHONE] && !r[DT_COL_ID]) continue; // dong rong
    out.push(dtRowToOrder_(r, i + 2));
  }
  return out;
}

function readOrdersByPhone_(phone) {
  var ph = normPhone_(phone);
  var all = readAllOrders_();
  var out = all.filter(function (o) { return o.phone === ph; });
  // Khu trung dong GIONG HET (cung ngay+doanh thu+san pham) — giu logic cu, KHONG tu dong
  // xoa o day, chi de UI/extension tu phat hien va hoi xac nhan (xem findDuplicateOrders_)
  var seen = {}, deduped = [];
  for (var k = 0; k < out.length; k++) {
    var key = String(out[k].date) + '|' + String(out[k].revenue) + '|' + String(out[k].product);
    if (!seen[key]) { seen[key] = true; deduped.push(out[k]); }
  }
  return deduped;
}

// ═══════════════════════════════════════════════════════════════
//  TACH TEN KHACH TU DON HANG (backfill hang loat)
//  Cot "San pham" trong DT TONG la text tu do NV go tay, KHONG theo khuon co dinh: co don ghi
//  "Ten Sdt Dia chi...", co don ghi "Dia chi Sdt ... Ten Nhắn...", co don chi toan dia chi/ghi
//  chu gop don khong he co ten. Doan ten tu dong, CHI de xuat cho SDT hien CHUA co ten trong
//  CareData — nguoi dung phai xem/duyet tren UI truoc khi ghi that (giong het co che
//  findDuplicateOrders_ + confirm truoc khi xoa), tranh doan sai lam hong du lieu ten dang co.
// ═══════════════════════════════════════════════════════════════
var NAME_ADDR_KEYWORDS_RE_ = /\b(đường|phố|phường|xã|quận|huyện|thành phố|tỉnh|ngõ|ngách|khu|tổ|ấp|thôn|xóm|số nhà|tòa|chung cư|đc|địa chỉ)\b/i;
var NAME_MERGE_LABEL_RE_ = /^(gộp\s*(đơn|cùng)|ghép\s*đơn|địa chỉ)/i;
var NAME_ALLOWED_CHARS_RE_ = /^[a-zA-ZÀ-ỹ\s.'-]+$/;

function _stripHonorific_(s) {
  return s.replace(/^(anh|chị|chi|ông|ong|bà|ba|em|c|a)(?=[\s:.]|$)\s*[:.]?\s*/i, '').trim();
}
function _truncateAtAddressOrDigit_(s) {
  var digitIdx = s.search(/\d/);
  var kwMatch = s.match(NAME_ADDR_KEYWORDS_RE_);
  var kwIdx = kwMatch ? kwMatch.index : -1;
  var cut = -1;
  if (digitIdx >= 0 && kwIdx >= 0) cut = Math.min(digitIdx, kwIdx);
  else if (digitIdx >= 0) cut = digitIdx;
  else if (kwIdx >= 0) cut = kwIdx;
  if (cut >= 0) s = s.substring(0, cut);
  return s.trim();
}
function _isPlausibleName_(s) {
  if (!s) return false;
  s = s.trim();
  if (s.length < 2 || s.length > 40) return false;
  if (!NAME_ALLOWED_CHARS_RE_.test(s)) return false;
  if (s.split(/\s+/).length > 5) return false;
  return true;
}
// Tra ve TAT CA ten "ung vien" hop le tim duoc trong 1 doan text don hang, thu 2 cach:
// (A) dau dong, cat truoc so/tu khoa dia chi dau tien (bat truong hop "Ten Sdt Dia chi...")
// (B) doan ngay SAU so dien thoai, truoc chu "Nhắn" (bat truong hop "...Sdt Ten Nhắn...")
function _guessNameCandidatesFromOrderText_(text, phoneDigits) {
  var out = [];
  if (!text) return out;
  var raw = String(text);
  var firstLine = raw.split('\n')[0].trim();
  if (firstLine && !NAME_MERGE_LABEL_RE_.test(firstLine)) {
    var a = firstLine.replace(/(\+?84|0)\d{8,10}/g, '');
    a = _stripHonorific_(a);
    a = a.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '');
    a = _truncateAtAddressOrDigit_(a);
    if (_isPlausibleName_(a)) out.push(a);
  }
  if (phoneDigits) {
    var idx = raw.indexOf(phoneDigits);
    if (idx >= 0) {
      var after = raw.substring(idx + phoneDigits.length);
      var nhanMatch = after.match(/nh[ắaằ]n\b/i);
      var seg = nhanMatch ? after.substring(0, nhanMatch.index) : after.substring(0, 40);
      seg = _stripHonorific_(seg.trim());
      seg = seg.replace(/^[:.\-–]\s*/, '').replace(/[:.\-–]\s*$/, '');
      seg = _truncateAtAddressOrDigit_(seg);
      if (_isPlausibleName_(seg)) out.push(seg);
    }
  }
  return out;
}
// Giu lai ten cu de tuong thich cac cho khac co the dang goi (tra ve ung vien dau tien theo
// cach (A) - hanh vi gan giong ham cu, chi them buoc cat tai dia chi/so cho chinh xac hon).
function _parseNameFromOrderText_(text) {
  var cands = _guessNameCandidatesFromOrderText_(text, '');
  return cands.length ? cands[0] : '';
}
// Quet TAT CA don cua 1 sdt, gom ung vien ten tu tung don, lay ten xuat hien NHIEU LAN NHAT
// (thay vi chi lay don dau tien tim thay — tranh vo tinh chon phai don khong co ten/co nhan
// gop don ma bo qua cac don khac cua cung khach da co ten ro rang).
function _guessNameForPhone_(orders, phoneDigits) {
  var freq = {}, bestKey = null;
  for (var i = 0; i < orders.length; i++) {
    var cands = _guessNameCandidatesFromOrderText_(orders[i].product, phoneDigits);
    for (var j = 0; j < cands.length; j++) {
      var key = cands[j].toLowerCase();
      if (!freq[key]) freq[key] = { count: 0, sample: cands[j] };
      freq[key].count++;
      if (!bestKey || freq[key].count > freq[bestKey].count) bestKey = key;
    }
  }
  return bestKey ? freq[bestKey].sample : '';
}

// Quet toan bo DT TONG, doan ten cho tung SDT (gom TAT CA don cua sdt do, lay ten xuat hien
// nhieu lan nhat) — CHI tra ve de UI hien danh sach cho nguoi dung duyet, KHONG ghi gi vao Sheet.
function previewCustomerNameGuesses_() {
  var orders = readAllOrders_();
  var careRows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  var existingNames = {};
  for (var c = 0; c < careRows.length; c++) {
    if (careRows[c].name) existingNames[normPhone_(String(careRows[c].phone))] = true;
  }
  var byPhone = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (!o.phone || existingNames[o.phone]) continue;
    if (!byPhone[o.phone]) byPhone[o.phone] = [];
    byPhone[o.phone].push(o);
  }
  var out = [];
  Object.keys(byPhone).forEach(function (phone) {
    var phoneOrders = byPhone[phone];
    var guess = _guessNameForPhone_(phoneOrders, phone);
    if (!guess) return;
    out.push({ phone: phone, guessedName: guess, sample: String(phoneOrders[0].product || '').split('\n')[0].trim().substring(0, 120) });
  });
  return { ok: true, count: out.length, items: out };
}


// Ghi that danh sach ten DA DUOC NGUOI DUNG XAC NHAN tren UI (items: [{phone, name}]).
// Kiem tra lai lan nua tren server: chi ghi cho SDT VAN CHUA co ten tai thoi diem ghi
// (tranh ghi de neu vua co ai do — vd Pancake AI — cap nhat ten trong luc dang duyet danh sach).
function applyCustomerNameGuesses_(items) {
  if (!items || !items.length) return jsonOut_({ ok: false, error: 'Danh sach rong' });
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow();
  var index = {};
  if (last >= 2) {
    var vals = sh.getRange(2, 1, last - 1, CARE_HEADERS.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (vals[i][0]) index[normPhone_(String(vals[i][0]))] = { rowNum: i + 2, name: vals[i][19] || '' };
    }
  }
  var updated = 0, appended = 0, skipped = 0;
  var newRows = [];
  for (var k = 0; k < items.length; k++) {
    var it = items[k];
    var phone = normPhone_(String(it.phone || ''));
    var name = String(it.name || '').trim();
    if (!phone || !name) { skipped++; continue; }
    var ex = index[phone];
    if (ex) {
      if (ex.name) { skipped++; continue; }
      sh.getRange(ex.rowNum, 20).setValue(name);
      updated++;
    } else {
      newRows.push(careRow_({ phone: phone, name: name }));
      appended++;
    }
  }
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, CARE_HEADERS.length).setValues(newRows);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch (ec) {}
  return jsonOut_({ ok: true, updated: updated, appended: appended, skipped: skipped });
}

function getDTSS_() {
  return DT_SS_ID
    ? SpreadsheetApp.openById(DT_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// ── Parse ngay dang DD/MM/YYYY (chuoi) hoac Date that (doc truc tiep tu Google Sheet) ──
// KHONG dung new Date(chuoi) truc tiep: JS hieu chuoi kieu MM/DD/YYYY, se sai am tham
// voi cac ngay <=12 (vd 01/07/2026 se bi hieu la 1 thang 7 thay vi 7 thang 1).
function parseVNDate_(val) {
  if (!val && val !== 0) return null;
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return isNaN(val.getTime()) ? null : val;
  }
  var s = String(val).trim();
  if (!s) return null;
  // tach phan ngay khoi phan gio neu co (vd "21/08/2026 10:30")
  var datePart = s.split(' ')[0];
  var m = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (y < 100) y += 2000;
  var dt = new Date(y, mo - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function dateInRange_(dt, fromStr, toStr) {
  if (!dt) return !fromStr && !toStr; // khong parse duoc: chi loai neu co bo loc ngay
  if (fromStr) {
    var from = parseVNDate_(fromStr) || new Date(fromStr);
    if (dt < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
  }
  if (toStr) {
    var to = parseVNDate_(toStr) || new Date(toStr);
    if (dt > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)) return false;
  }
  return true;
}

// Tach chuoi multi-value theo 1 dau phan cach, trim tung phan tu, bo phan tu rong
// Chuan hoa gia tri tien: khong co don nao thuc te duoi 1 nghin dong. Neu Sheet nhap thieu 3 so 0
// (vd go "900" thay vi "900000" — pho bien khi go tat theo don vi nghin), gia tri doc len se < 1000
// va SAI mot cach am tham (thieu dung 1000 lan) neu khong xu ly. Voi moi so > 0 va < 1000, hieu la
// dang nhap theo don vi nghin dong va nhan lai 1000 cho dung don vi dong that.
function _normMoney_(n) {
  // Neu o tien la CHUOI TEXT (thuong gap khi copy/paste tu Excel/file khac, hoac o duoc dinh
  // dang dang Text trong Sheet) co dau phay/cham phan cach hang nghin va/hoac ky hieu tien te
  // (vd "1,000,000", "1.000.000đ", "1,000,000 ₫") thi Number(...) se ra NaN, va "NaN || 0" se
  // AM THAM tra ve 0 — lam mat doanh thu ma khong bao loi gi. Don vi VND khong dung phan thap
  // phan (khong co le), nen an toan de bo HET dau cham/phay/khoang trang/ky hieu tien te truoc
  // khi parse so.
  if (typeof n === 'string') {
    n = n.replace(/[.,\s₫đĐ]/g, '');
  }
  n = Number(n) || 0;
  if (n > 0 && n < 1000) return n * 1000;
  return n;
}

function splitMulti_(str, delimiter) {
  if (!str && str !== 0) return [];
  var s = String(str);
  if (!s.trim()) return [];
  return s.split(delimiter).map(function(x){ return x.trim(); }).filter(function(x){ return x !== ''; });
}

// ── Doc toan bo sheet "DT TỔNG " thanh mang object ──
function readDTTong_() {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  // cot A..T (0..19) du dung cho bao cao, tranh doc thua cot rac phia sau
  var vals = sh.getRange(2, 1, last - 1, 20).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    // Dong rong that su: khong SDT, khong ID, VA khong co gia tri don hang (r[17]) — truoc day
    // chi check thieu SDT+ID la bo qua ca dong, nhung neu dong do LAI CO gia tri doanh thu that
    // (vd don nhap tay/import cu chua kip gan SDT/ID) thi se bi am tham mat doanh thu khoi
    // Bao cao A (thap hon thuc te ma khong bao loi gi). Them dieu kien r[17] de an toan hon.
    if (!r[3] && !r[19] && !r[17]) continue;
    out.push({
      ngayTao:        r[0],
      nguoiTao:       r[1] ? String(r[1]).trim() : '',
      giaoCho:        r[2],
      giaiDoan:       r[6],
      trangThai:      r[7],
      thoiGianHT:     r[10],
      kenhBan:        r[12] ? String(r[12]).trim() : '',
      saleBan:        r[13] ? String(r[13]) : '',
      sanPham:        r[14],
      phanLoai:       r[15],
      giaTriCoc:      _normMoney_(r[16]),
      giaTriDon:      _normMoney_(r[17]),
      giaTriChenh:    _normMoney_(r[18]),
      id:             r[19]
    });
  }
  return out;
}

// ── KH "Chăm sóc" thêm nhanh — sheet RIÊNG, độc lập CareData/DT TỔNG/dữ liệu đơn ──
function readCareLeads_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CARE_LEAD);
  if (!sh || sh.getLastRow() < 2) return [];
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, CARE_LEAD_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[0]) continue;
    out.push({
      phone: normPhone_(String(r[0])), name: String(r[1]||''), note: String(r[2]||''),
      cs: String(r[3]||''), createdAt: r[4] || ''
    });
  }
  return out;
}

function addCareLead_(data) {
  var sh = getSheet_(SH_CARE_LEAD, CARE_LEAD_HEADERS);
  var phone = normPhone_(String(data.phone||''));
  if (!phone) return jsonOut_({ ok: false, error: 'Thieu SDT' });
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var colP = sh.getRange(2, 1, last-1, 1).getValues();
    for (var i = 0; i < colP.length; i++) {
      if (normPhone_(String(colP[i][0])) === phone) { rowIdx = i + 2; break; }
    }
  }
  var row = [phone, data.name||'', data.note||'', data.cs||'', new Date().toISOString()];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, CARE_LEAD_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  try { CacheService.getScriptCache().remove('care_leads_v1'); } catch(ec) {}
  return jsonOut_({ ok: true, found: rowIdx > 0 });
}

// ── Chỉ tra cứu tập SDT co trong "dữ liệu đơn" (Bao cao B) — dung de LOC nguon o
// man hinh chinh, KHONG keo chi tiet san pham vao danh sach khach ──
function readDonPhones_() {
  var rows = readDonChiTiet_();
  var set = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (ph) set[ph] = true;
  }
  return Object.keys(set);
}
// Map SDT -> mang ten sale tham gia don (cot "Thẻ", tach theo dau phay — 1 don co the nhieu
// sale). Dung o client de gop vao csSet, dam bao CS dung ten o BAT KY don nao trong
// "dữ liệu đơn" (du don co nhieu sale) van xem duoc KH do.
function getDonSaleByPhone_() {
  var rows = readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    var names = splitMulti_(rows[i].theSale, ',');
    if (!names.length) continue;
    if (!map[ph]) map[ph] = [];
    for (var j = 0; j < names.length; j++) {
      if (map[ph].indexOf(names[j]) === -1) map[ph].push(names[j]);
    }
  }
  return map;
}

// Map SDT -> so dong (so don) trong "dữ liệu đơn" — dung de PHAN LOAI HANG KH (VIP/Than
// thiet/Tiem nang/Chua ban lai duoc) theo tieu chi moi: dem theo SO DONG trong sheet nay,
// KHONG con dua theo nguon Renew trong DT TONG nhu truoc.
function getDonOrderCountByPhone_() {
  var rows = readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    map[ph] = (map[ph] || 0) + 1;
  }
  return map;
}

// ── Doc toan bo sheet "dữ liệu đơn" thanh mang object ──
function readDonChiTiet_() {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DON_CHITIET_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, 14).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[1] && !r[3]) continue; // dong rong: khong co ngay va khong co khach
    var nguonDon = r[7] ? String(r[7]).trim() : '';
    if (nguonDon.toLowerCase().indexOf('bảo hành') !== -1 || nguonDon.toLowerCase().indexOf('bao hanh') !== -1) continue; // loai don nguon bao hanh khoi bao cao doanh so B/C
    out.push({
      ngayTaoDon:    r[1],
      khachHang:     r[3],
      soDienThoai:   r[4],
      nguonDon:      nguonDon,
      theSale:       r[2] ? String(r[2]) : '',   // cot "Thẻ" (C) — danh sach sale tham gia don, tach bang dau phay ','
      sanPham:       r[8] ? String(r[8]) : '',   // tach bang dau phay ','
      maSanPham:     r[9] ? String(r[9]) : '',   // tach bang dau cham phay ';' — KHAC voi sanPham/soLuong
      soLuong:       r[10] ? String(r[10]) : '', // tach bang dau phay ','
      giaTriSauGiam: _normMoney_(r[11]),
      cod:           _normMoney_(r[12]),
      marketer:      r[13] ? String(r[13]).trim() : ''
    });
  }
  return out;
}

// ── BAO CAO A: theo "DT TỔNG " ──
// filters: { dateFrom, dateTo, dateField ('ngayTao'|'thoiGianHT'), sale (mang ten hoac ''), kenh ('' = tat ca) }
// ── Lay danh sach Sale ban / Kenh ban distinct (cho UI chon, thay vi go dung ten) ──
function getSalesReportOptions_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('srptOptions_v3');
  if (cached) { try { return JSON.parse(cached); } catch(ec) {} }
  var rows0 = readDTTong_();
  var saleSet = {}, kenhSet = {};
  for (var i0 = 0; i0 < rows0.length; i0++) {
    var salesList0 = splitMulti_(rows0[i0].saleBan, ',');
    for (var j0 = 0; j0 < salesList0.length; j0++) saleSet[salesList0[j0]] = true;
    if (rows0[i0].kenhBan) kenhSet[rows0[i0].kenhBan] = true;
  }
  var rowsB0 = readDonChiTiet_();
  var nguonSet = {}, marketerSet = {}, saleBSet = {};
  for (var iB0 = 0; iB0 < rowsB0.length; iB0++) {
    if (rowsB0[iB0].nguonDon) nguonSet[rowsB0[iB0].nguonDon] = true;
    if (rowsB0[iB0].marketer) marketerSet[rowsB0[iB0].marketer] = true;
    var saleBList0 = splitMulti_(rowsB0[iB0].theSale, ',');
    for (var jB0 = 0; jB0 < saleBList0.length; jB0++) saleBSet[saleBList0[jB0]] = true;
  }
  var srptOpt = {
    sale: Object.keys(saleSet).sort(), kenh: Object.keys(kenhSet).sort(),
    nguon: Object.keys(nguonSet).sort(), marketer: Object.keys(marketerSet).sort(),
    saleB: Object.keys(saleBSet).sort() // Sale rieng cua Bao cao B (cot "Thẻ" trong dữ liệu đơn)
  };
  try { cache.put('srptOptions_v3', JSON.stringify(srptOpt), 1800); } catch(ec) {}
  return srptOpt;
}

function buildSalesReportA_(filters) {
  filters = filters || {};
  var dateField = filters.dateField === 'thoiGianHT' ? 'thoiGianHT' : 'ngayTao';
  var saleFilterArr = Array.isArray(filters.sale) ? filters.sale.filter(function(s){return s;})
    : (filters.sale ? [String(filters.sale).trim()] : []);
  var kenhFilterArr = Array.isArray(filters.kenh) ? filters.kenh.filter(function(s){return s;})
    : (filters.kenh ? [String(filters.kenh).trim()] : []);
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);
  // Tich UI "Tinh theo nguoi tao don": KHONG chia deu doanh thu/so don cho tung sale tren don
  // nua, ma tinh TRON VEN cho DUNG 1 nguoi — lay tu cot "Người tạo" that su cua DT TONG (khac
  // voi "Sale bán", co the co nhieu ten). Bo tich (mac dinh): giu nguyen cach chia deu cu.
  var byCreator = !!filters.byCreator;

  var rows = readDTTong_();
  var matched = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var dt = parseVNDate_(row[dateField]);
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) continue;
    if (kenhFilterArr.length && kenhFilterArr.indexOf(row.kenhBan) === -1) continue;
    var salesOnOrder = splitMulti_(row.saleBan, ',');
    if (saleFilterArr.length && !salesOnOrder.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
    if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
    matched.push(row);
  }

  // Tong chung: tinh du gia tri 1 lan, KHONG chia theo sale
  var totalCoc = 0, totalGiaTri = 0;
  var bySale = {}; // ten sale -> { orders, coc, giaTri }
  var byKenh = {}; // ten kenh -> { orders, coc, giaTri }
  var UNASSIGNED = '(chưa gán sale)';

  for (var j = 0; j < matched.length; j++) {
    var m = matched[j];
    totalCoc += m.giaTriCoc;
    totalGiaTri += m.giaTriDon;

    // breakdown theo kenh: kenh la single-value, khong chia
    var kName = m.kenhBan || '(chưa có kênh)';
    if (!byKenh[kName]) byKenh[kName] = { orders: 0, coc: 0, giaTri: 0 };
    byKenh[kName].orders += 1;
    byKenh[kName].coc += m.giaTriCoc;
    byKenh[kName].giaTri += m.giaTriDon;

    // breakdown theo sale:
    // - Mac dinh: so don GIU NGUYEN (khong chia), phan tien CHIA DEU cho N sale tren don.
    // - byCreator: ca so don LAN tien tinh TRON VEN cho DUNG 1 nguoi — nguoi duoc ghi trong cot
    //   "Người tạo" that su cua DT TONG (KHONG phai ten dau tien trong "Sale bán").
    if (byCreator) {
      var creatorName = m.nguoiTao || UNASSIGNED;
      if (!bySale[creatorName]) bySale[creatorName] = { orders: 0, coc: 0, giaTri: 0 };
      bySale[creatorName].orders += 1;
      bySale[creatorName].coc += m.giaTriCoc;
      bySale[creatorName].giaTri += m.giaTriDon;
    } else {
      var salesList = splitMulti_(m.saleBan, ',');
      if (salesList.length === 0) salesList = [UNASSIGNED];
      var n = salesList.length;
      for (var k = 0; k < salesList.length; k++) {
        var sName = salesList[k];
        if (!bySale[sName]) bySale[sName] = { orders: 0, coc: 0, giaTri: 0 };
        bySale[sName].orders += 1;                 // so don: khong chia
        bySale[sName].coc += m.giaTriCoc / n;       // tien: chia deu cho N sale
        bySale[sName].giaTri += m.giaTriDon / n;
      }
    }
  }

  function toArr(obj) {
    var arr = [];
    for (var key in obj) {
      arr.push({ name: key, orders: obj[key].orders, coc: obj[key].coc, giaTri: obj[key].giaTri });
    }
    arr.sort(function(a, b){ return b.giaTri - a.giaTri; });
    return arr;
  }

  return {
    totalOrders: matched.length,
    totalCoc: totalCoc,
    totalGiaTri: totalGiaTri,
    bySale: toArr(bySale),
    byKenh: toArr(byKenh),
    orders: matched.map(function(m){
      return {
        ngayTao: m.ngayTao, thoiGianHT: m.thoiGianHT, kenhBan: m.kenhBan,
        saleBan: m.saleBan, sanPham: m.sanPham, phanLoai: m.phanLoai,
        giaTriCoc: m.giaTriCoc, giaTriDon: m.giaTriDon,
        giaiDoan: m.giaiDoan, trangThai: m.trangThai, id: m.id
      };
    })
  };
}

// ── BAO CAO B: theo "dữ liệu đơn" (bao gom bao cao san pham) ──
// filters: { dateFrom, dateTo, nguon, marketer }
function buildSalesReportB_(filters) {
  filters = filters || {};
  // Ho tro CA mang (multi-select) LAN chuoi don (tuong thich nguoc) cho ca 3 bo loc.
  function toArr(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v).trim()] : []); }
  var saleFilterArr = toArr(filters.sale);
  var nguonFilterArr = toArr(filters.nguon);
  var marketerFilterArr = toArr(filters.marketer);
  var careStatusArr = toArr(filters.careStatus);
  var khStatusArr = toArr(filters.khStatus);
  var zaloStatusArr = toArr(filters.zaloStatus);
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);
  var nickZaloTerm = filters.nickZalo ? _psheetNoAccent_(String(filters.nickZalo).trim()) : '';
  var UNASSIGNED = '(chưa gán sale)';

  // Chi doc CareData khi thuc su co loc theo CRM — tranh doc them 1 sheet khi khong can.
  var needCare = careStatusArr.length || khStatusArr.length || zaloStatusArr.length || nickZaloTerm;
  var careMap = needCare ? _careMapByPhone_() : null;

  var rows = readDonChiTiet_();
  var matched = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var dt = parseVNDate_(row.ngayTaoDon);
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) continue;
    if (nguonFilterArr.length && nguonFilterArr.indexOf(row.nguonDon) === -1) continue;
    if (marketerFilterArr.length && marketerFilterArr.indexOf(row.marketer) === -1) continue;
    if (saleFilterArr.length) {
      var salesOnRow = splitMulti_(row.theSale, ',');
      var hit = false;
      for (var si = 0; si < saleFilterArr.length; si++) { if (salesOnRow.indexOf(saleFilterArr[si]) !== -1) { hit = true; break; } }
      if (!hit) continue;
    }
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
    matched.push(row);
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
    var salesOnOrder = splitMulti_(m.theSale, ',');
    if (salesOnOrder.length === 0) salesOnOrder = [UNASSIGNED];
    var nSale = salesOnOrder.length;
    for (var si2 = 0; si2 < salesOnOrder.length; si2++) {
      var sName = salesOnOrder[si2];
      if (!bySale[sName]) bySale[sName] = { orders: 0, giaTri: 0, cod: 0 };
      bySale[sName].orders += 1;
      bySale[sName].giaTri += m.giaTriSauGiam / nSale;
      bySale[sName].cod += m.cod / nSale;
    }

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

  var bySaleArr = [];
  for (var skey in bySale) bySaleArr.push({ name: skey, orders: bySale[skey].orders, giaTri: bySale[skey].giaTri, cod: bySale[skey].cod });
  bySaleArr.sort(function(a, b){ return b.giaTri - a.giaTri; });

  var mismatchCount = products['__MISMATCH__'] ? products['__MISMATCH__'].mismatchRows : 0;

  return {
    totalOrders: matched.length,
    totalGiaTri: totalGiaTri,
    totalCod: totalCod,
    products: productArr,
    bySale: bySaleArr,
    mismatchRows: mismatchCount, // so dong bi lech so cot giua san pham/ma/so luong — nen kiem tra tay
    orders: matched.map(function(m){
      return {
        ngayTaoDon: m.ngayTaoDon, khachHang: m.khachHang, soDienThoai: m.soDienThoai,
        nguonDon: m.nguonDon, theSale: m.theSale, sanPham: m.sanPham, maSanPham: m.maSanPham, soLuong: m.soLuong,
        giaTriSauGiam: m.giaTriSauGiam, cod: m.cod, marketer: m.marketer
      };
    })
  };
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO C: SO SANH THEO KY (tuan/thang/quy/tuy chinh) — theo Nhan vien (Sale ban) & Kenh ban
//  Co doi chieu KPI/chi tieu (doc tu tab rieng KPI_ChiTieu, Duyen tu dien tay).
// ═══════════════════════════════════════════════════════════════

var KPI_SHEET = 'KPI_ChiTieu';

// Tao san tab KPI_ChiTieu (co huong dan + vi du) neu chua co — de Duyen tu dien chi tieu.
function ensureKPISheet_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(KPI_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(KPI_SHEET);
  var rows = [
    ['PeriodKey', 'LoaiDoiTuong', 'TenDoiTuong', 'KPI_ChiTieu', 'GhiChu'],
    ['2026-W35', 'sale', 'ngoctuoi2k3', 50000000, 'VÍ DỤ — tuần ISO: YYYY-Wnn (Thứ 2 → Chủ nhật). Xóa dòng ví dụ này.'],
    ['2026-08', 'sale', 'ngoctuoi2k3', 200000000, 'VÍ DỤ — tháng: YYYY-MM. Xóa dòng ví dụ này.'],
    ['2026-Q3', 'kenh', 'Tiktok', 500000000, 'VÍ DỤ — quý: YYYY-Qn (Q1..Q4). Xóa dòng ví dụ này.'],
    ['', '', '', '', 'LoaiDoiTuong chỉ nhận "sale" hoặc "kenh". TenDoiTuong phải gõ ĐÚNG y nguyên tên Sale bán / Kênh bán đang dùng trong DT TỔNG (phân biệt hoa/thường, khoảng trắng). Với kỳ "Tùy chỉnh" (2 khoảng ngày tự chọn) sẽ không tra được KPI vì không có PeriodKey cố định — chỉ áp dụng cho Tuần/Tháng/Quý.']
  ];
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  try { sh.autoResizeColumns(1, 5); } catch (ecw) {}
  return sh;
}

function readKPITargets_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(KPI_SHEET);
  if (!sh) { ensureKPISheet_(); sh = ss.getSheetByName(KPI_SHEET); }
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, 4).getValues();
  for (var i = 0; i < vals.length; i++) {
    var periodKey = String(vals[i][0] || '').trim();
    var entType = String(vals[i][1] || '').trim().toLowerCase();
    var entName = String(vals[i][2] || '').trim();
    var kpi = Number(vals[i][3]) || 0;
    if (!periodKey || !entType || !entName) continue;
    map[periodKey + '|' + entType + '|' + entName] = kpi;
  }
  return map;
}

function getKPI_(kpiMap, periodKey, entType, entName) {
  if (!periodKey) return 0;
  return kpiMap[periodKey + '|' + entType + '|' + entName] || 0;
}

// Thu 2 cua tuan chua ngay d (khong doi d truyen vao)
function _getMonday_(d) {
  var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var day = dt.getDay();
  var diff = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diff);
  return dt;
}
function _isoWeekRange_(baseDate, weekOffset) {
  var mon = _getMonday_(baseDate);
  mon.setDate(mon.getDate() + weekOffset * 7);
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: mon, to: sun };
}
function _isoWeekKey_(d) {
  var dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return dt.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}
function _monthRange_(baseDate, monthOffset) {
  var y = baseDate.getFullYear(), m = baseDate.getMonth() + monthOffset;
  return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
}
function _monthKey_(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function _quarterRange_(baseDate, quarterOffset) {
  var y = baseDate.getFullYear(), q = Math.floor(baseDate.getMonth() / 3) + quarterOffset;
  var yy = y + Math.floor(q / 4), qq = ((q % 4) + 4) % 4;
  var startMonth = qq * 3;
  return { from: new Date(yy, startMonth, 1), to: new Date(yy, startMonth + 3, 0) };
}
function _quarterKey_(d) { return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1); }
function _ymdLocal_(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _labelVN_(d) {
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

// Tinh khoang ngay + PeriodKey cua ky nay & ky truoc, tuy periodType.
function _resolvePeriods_(filters) {
  var today = new Date();
  var periodType = filters.periodType || 'week';
  var cur, prev, curKey = '', prevKey = '';

  if (periodType === 'week') {
    var wOff = Number(filters.weekOffset) || 0;
    cur = _isoWeekRange_(today, wOff);
    prev = _isoWeekRange_(today, wOff - 1);
    curKey = _isoWeekKey_(cur.from); prevKey = _isoWeekKey_(prev.from);
  } else if (periodType === 'month') {
    var mOff = Number(filters.monthOffset) || 0;
    cur = _monthRange_(today, mOff);
    prev = _monthRange_(today, mOff - 1);
    curKey = _monthKey_(cur.from); prevKey = _monthKey_(prev.from);
  } else if (periodType === 'quarter') {
    var qOff = Number(filters.quarterOffset) || 0;
    cur = _quarterRange_(today, qOff);
    prev = _quarterRange_(today, qOff - 1);
    curKey = _quarterKey_(cur.from); prevKey = _quarterKey_(prev.from);
  } else { // custom — 2 khoang ngay hoan toan tu chon, khong lien quan nhau, KHONG co PeriodKey KPI
    cur = { from: parseVNDate_(filters.customCurFrom) || today, to: parseVNDate_(filters.customCurTo) || today };
    prev = { from: parseVNDate_(filters.customPrevFrom) || today, to: parseVNDate_(filters.customPrevTo) || today };
    curKey = ''; prevKey = '';
  }
  return {
    curFrom: _ymdLocal_(cur.from), curTo: _ymdLocal_(cur.to), curKey: curKey, curLabel: _labelVN_(cur.from) + ' - ' + _labelVN_(cur.to),
    prevFrom: _ymdLocal_(prev.from), prevTo: _ymdLocal_(prev.to), prevKey: prevKey, prevLabel: _labelVN_(prev.from) + ' - ' + _labelVN_(prev.to)
  };
}

function buildSalesReportC_(filters) {
  filters = filters || {};
  var dateField = filters.dateField === 'thoiGianHT' ? 'thoiGianHT' : 'ngayTao';
  var per = _resolvePeriods_(filters);
  var kpiMap = readKPITargets_();
  var UNASSIGNED = '(chưa gán sale)';
  var saleFilterArr = Array.isArray(filters.sale) ? filters.sale.filter(function(s){return s;}) : [];
  var kenhFilterArr = Array.isArray(filters.kenh) ? filters.kenh.filter(function(s){return s;}) : [];
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);

  var rows = readDTTong_();
  // Gom theo entity rieng cho tung ky (cur/prev), dung dung logic chia tien theo N sale/don
  // nhu buildSalesReportA_ (so don khong chia — o day khong can so don nen bo qua, chi lay tien).
  function aggregate(fromStr, toStr) {
    var bySale = {}, byKenh = {};
    var matchedOrders = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var dt = parseVNDate_(row[dateField]);
      if (!dateInRange_(dt, fromStr, toStr)) continue;
      if (kenhFilterArr.length && kenhFilterArr.indexOf(row.kenhBan) === -1) continue;
      var salesOnRow = splitMulti_(row.saleBan, ',');
      if (saleFilterArr.length && !salesOnRow.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
      if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
      matchedOrders.push(row);
      var kName = row.kenhBan || '(chưa có kênh)';
      byKenh[kName] = (byKenh[kName] || 0) + row.giaTriDon;
      var salesList = splitMulti_(row.saleBan, ',');
      if (salesList.length === 0) salesList = [UNASSIGNED];
      var n = salesList.length;
      for (var k = 0; k < salesList.length; k++) {
        bySale[salesList[k]] = (bySale[salesList[k]] || 0) + row.giaTriDon / n;
      }
    }
    return { bySale: bySale, byKenh: byKenh, orders: matchedOrders };
  }

  var curAgg = aggregate(per.curFrom, per.curTo);
  var prevAgg = aggregate(per.prevFrom, per.prevTo);

  function buildTable(curMap, prevMap, entType) {
    var names = Object.keys(Object.assign({}, curMap, prevMap));
    var out = names.map(function(name) {
      var resultCur = curMap[name] || 0;
      var resultPrev = prevMap[name] || 0;
      var kpiCur = getKPI_(kpiMap, per.curKey, entType, name);
      var kpiPrev = getKPI_(kpiMap, per.prevKey, entType, name);
      var pctKpiCur = kpiCur > 0 ? (resultCur / kpiCur * 100) : null;
      var pctKpiPrev = kpiPrev > 0 ? (resultPrev / kpiPrev * 100) : null;
      var growthPct = resultPrev > 0 ? ((resultCur - resultPrev) / resultPrev * 100) : (resultCur > 0 ? null : 0);
      return {
        name: name, kpiPrev: kpiPrev, resultPrev: resultPrev, pctKpiPrev: pctKpiPrev,
        kpiCur: kpiCur, resultCur: resultCur, pctKpiCur: pctKpiCur, growthPct: growthPct
      };
    });
    out.sort(function(a, b) { return b.resultCur - a.resultCur; });
    return out;
  }

  var mapOrder = function(o) {
    return { ngayTao: o.ngayTao, thoiGianHT: o.thoiGianHT, kenhBan: o.kenhBan, saleBan: o.saleBan,
             sanPham: o.sanPham, giaTriCoc: o.giaTriCoc, giaTriDon: o.giaTriDon, giaiDoan: o.giaiDoan,
             trangThai: o.trangThai, id: o.id };
  };

  return {
    period: per,
    byEmployee: buildTable(curAgg.bySale, prevAgg.bySale, 'sale'),
    byKenh: buildTable(curAgg.byKenh, prevAgg.byKenh, 'kenh'),
    ordersCur: curAgg.orders.map(mapOrder),
    ordersPrev: prevAgg.orders.map(mapOrder)
  };
}

// ── BAO CAO D: KH "Chăm sóc" thêm nhanh (sheet rieng, KHONG gop bao cao A/B/C) ──
function buildCareLeadReport_(filters) {
  filters = filters || {};
  var rows = readCareLeads_();
  var matched = rows.filter(function(r) {
    var dt = r.createdAt ? new Date(r.createdAt) : null;
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) return false;
    if (filters.cs && String(r.cs||'') !== String(filters.cs)) return false;
    return true;
  });
  var byCS = {};
  matched.forEach(function(r) {
    var name = r.cs || '(chưa gán)';
    byCS[name] = (byCS[name] || 0) + 1;
  });
  var byCSArr = Object.keys(byCS).map(function(k) { return { name: k, count: byCS[k] }; });
  byCSArr.sort(function(a, b) { return b.count - a.count; });
  return { total: matched.length, byCS: byCSArr, rows: matched };
}

// ═══════════════════════════════════════════════════════════════
//  XUAT BAO CAO DOANH SO RA 1 TAB MOI TRONG GOOGLE SHEET (CRM)
//  Dung lai dung buildSalesReportA_/B_ nen so lieu luon khop UI dang loc.
//  Moi lan xuat tao 1 tab moi (co timestamp) — khong ghi de, giu lich su cac lan xuat.
// ═══════════════════════════════════════════════════════════════
function exportSalesReportToSheet_(reportType, filters) {
  reportType = (reportType === 'B' || reportType === 'C' || reportType === 'D') ? reportType : 'A';
  var data = reportType === 'B' ? buildSalesReportB_(filters || {})
    : (reportType === 'C' ? buildSalesReportC_(filters || {})
    : (reportType === 'D' ? buildCareLeadReport_(filters || {})
    : buildSalesReportA_(filters || {})));
  var ss = getCrmSS_();
  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT-7', 'yyyyMMdd_HHmmss');
  var tabName = 'BC_' + reportType + '_' + ts;
  var sh = ss.insertSheet(tabName);

  var titleSuffix = reportType === 'A' ? ' — Theo DT tổng' : (reportType === 'B' ? ' — Theo dữ liệu đơn' : (reportType === 'D' ? ' — KH Chăm sóc mới (data riêng, KHÔNG gộp báo cáo doanh số A/B/C)' : ' — So sánh theo kỳ'));
  var rows = [];
  rows.push([(reportType === 'D' ? 'BÁO CÁO KH CHĂM SÓC MỚI' : ('BÁO CÁO DOANH SỐ ' + reportType)) + titleSuffix]);
  rows.push(['Xuất lúc', Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT-7', 'dd/MM/yyyy HH:mm:ss')]);

  var f = filters || {};
  var filterDesc = [];
  if (reportType === 'A') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày: ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    filterDesc.push('Lọc theo: ' + (f.dateField === 'thoiGianHT' ? 'Thời gian hoàn thành' : 'Ngày tạo'));
    var saleArrA = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrA.length) filterDesc.push('Sale: ' + saleArrA.join(', '));
    var kenhArrA = Array.isArray(f.kenh) ? f.kenh : (f.kenh ? [f.kenh] : []);
    if (kenhArrA.length) filterDesc.push('Kênh: ' + kenhArrA.join(', '));
    if (f.byCreator) filterDesc.push('Tính theo người tạo đơn (không chia đều theo sale)');
  } else if (reportType === 'B') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày: ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    filterDesc.push('Sale: ' + (Array.isArray(f.sale) ? (f.sale.join(', ') || '(tất cả)') : (f.sale || '(tất cả)')));
    filterDesc.push('Nguồn đơn: ' + (Array.isArray(f.nguon) ? (f.nguon.join(', ') || '(tất cả)') : (f.nguon || '(tất cả)')));
    filterDesc.push('Marketer: ' + (Array.isArray(f.marketer) ? (f.marketer.join(', ') || '(tất cả)') : (f.marketer || '(tất cả)')));
  } else if (reportType === 'D') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày thêm: ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    if (f.cs) filterDesc.push('CS: ' + f.cs);
  } else {
    if (data.period) filterDesc.push('Kỳ này: ' + data.period.curLabel + ' | Kỳ trước: ' + data.period.prevLabel);
    filterDesc.push('Lọc theo: ' + (f.dateField === 'thoiGianHT' ? 'Thời gian hoàn thành' : 'Ngày tạo'));
    var saleArrC = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrC.length) filterDesc.push('Sale: ' + saleArrC.join(', '));
    var kenhArrC = Array.isArray(f.kenh) ? f.kenh : (f.kenh ? [f.kenh] : []);
    if (kenhArrC.length) filterDesc.push('Kênh bán: ' + kenhArrC.join(', '));
  }
  rows.push(['Bộ lọc', filterDesc.join(' | ') || '(không lọc)']);
  rows.push([]);

  if (reportType === 'A') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số lượng đơn', data.totalOrders]);
    rows.push(['Tổng tiền đã cọc/CK (tham khảo)', data.totalCoc]);
    rows.push(['Tổng đơn (doanh thu, ko ship)', data.totalGiaTri]);
    rows.push([]);
    rows.push(['THEO SALE BÁN', f.byCreator ? '(tính trọn vẹn cho người tạo đơn — không chia đều)' : '(số đơn giữ nguyên — tiền chia đều cho số sale/đơn)']);
    rows.push(['Sale', 'Số đơn', 'Cọc', 'Tổng đơn']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.coc, s.giaTri]); });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN']);
    rows.push(['Kênh', 'Số đơn', 'Cọc', 'Tổng đơn']);
    (data.byKenh || []).forEach(function(k) { rows.push([k.name, k.orders, k.coc, k.giaTri]); });
    rows.push([]);
    rows.push(['CHI TIẾT ĐƠN']);
    rows.push(['Ngày tạo', 'Thời gian HT', 'Kênh bán', 'Sale bán', 'Sản phẩm', 'Phân loại', 'Giá trị cọc', 'Giá trị đơn', 'Giai đoạn', 'Trạng thái', 'ID']);
    (data.orders || []).forEach(function(o) {
      rows.push([o.ngayTao, o.thoiGianHT, o.kenhBan, o.saleBan, o.sanPham, o.phanLoai, o.giaTriCoc, o.giaTriDon, o.giaiDoan, o.trangThai, o.id]);
    });
  } else if (reportType === 'B') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số lượng đơn', data.totalOrders]);
    rows.push(['Tổng giá trị sau giảm giá', data.totalGiaTri]);
    rows.push(['Tổng COD', data.totalCod]);
    if (data.mismatchRows) rows.push(['⚠ Số dòng lệch cột (cần kiểm tra tay)', data.mismatchRows]);
    rows.push([]);
    rows.push(['THEO SALE', '(số đơn giữ nguyên — tiền chia đều cho số sale/đơn)']);
    rows.push(['Sale', 'Số đơn', 'Giá trị sau giảm giá', 'COD']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.giaTri, s.cod]); });
    rows.push([]);
    rows.push(['BÁO CÁO SẢN PHẨM']);
    rows.push(['Mã sản phẩm', 'Tên sản phẩm', 'Tổng số lượng']);
    (data.products || []).forEach(function(p) { rows.push([p.code, p.name, p.soLuong]); });
    rows.push([]);
    rows.push(['CHI TIẾT ĐƠN']);
    rows.push(['Ngày tạo đơn', 'Khách hàng', 'SĐT', 'Nguồn đơn', 'Sale', 'Sản phẩm', 'Mã sản phẩm', 'Số lượng', 'Giá trị sau giảm giá', 'COD', 'Marketer']);
    (data.orders || []).forEach(function(o) {
      rows.push([o.ngayTaoDon, o.khachHang, o.soDienThoai, o.nguonDon, o.theSale, o.sanPham, o.maSanPham, o.soLuong, o.giaTriSauGiam, o.cod, o.marketer]);
    });
  } else if (reportType === 'D') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số KH thêm mới (nguồn Chăm sóc)', data.total]);
    rows.push([]);
    rows.push(['THEO CS THÊM']);
    rows.push(['CS', 'Số KH thêm']);
    (data.byCS || []).forEach(function(x) { rows.push([x.name, x.count]); });
    rows.push([]);
    rows.push(['CHI TIẾT']);
    rows.push(['SĐT', 'Tên khách', 'Ghi chú mới nhất', 'CS thêm', 'Ngày thêm']);
    (data.rows || []).forEach(function(r) {
      var latestNote = r.note || '';
      try {
        var arr = JSON.parse(r.note || '[]');
        if (Array.isArray(arr) && arr.length) latestNote = arr[0].text || '';
      } catch (eN) {}
      rows.push([r.phone, r.name, latestNote, r.cs, r.createdAt]);
    });
  } else {
    var hdrC = ['Tên', 'KPI kỳ trước', 'Kết quả kỳ trước', '%HT KPI kỳ trước', 'KPI kỳ này', 'Kết quả kỳ này', '%HT KPI kỳ này', '% Tăng trưởng'];
    rows.push(['THEO NHÂN VIÊN (SALE)']);
    rows.push(hdrC);
    (data.byEmployee || []).forEach(function(r) {
      rows.push([r.name, r.kpiPrev, r.resultPrev, r.pctKpiPrev, r.kpiCur, r.resultCur, r.pctKpiCur, r.growthPct]);
    });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN']);
    rows.push(hdrC.slice().map(function(h,i){ return i===0 ? 'Kênh bán' : h; }));
    (data.byKenh || []).forEach(function(r) {
      rows.push([r.name, r.kpiPrev, r.resultPrev, r.pctKpiPrev, r.kpiCur, r.resultCur, r.pctKpiCur, r.growthPct]);
    });
  }

  var maxCols = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 1);
  var padded = rows.map(function(r) {
    var rr = r.slice();
    while (rr.length < maxCols) rr.push('');
    return rr;
  });
  if (padded.length > 0) sh.getRange(1, 1, padded.length, maxCols).setValues(padded);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  try { sh.autoResizeColumns(1, maxCols); } catch (ecw) {}

  return { tabName: tabName, sheetId: ss.getId(), gid: sh.getSheetId(),
           sheetUrl: ss.getUrl() + '#gid=' + sh.getSheetId() };
}

// ═══════════════════════════════════════════════════════════════
//  doPost
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  if (!e || !e.postData) return jsonOut_({ error: 'No postData' });
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    if (action === 'save')                return saveAllCare_(data.rows);
    if (action === 'saveSingle')          return saveSingleCare_(data.row);
    if (action === 'saveBatch')           return saveBatchCare_(data.rows);
    if (action === 'saveOrders')          return saveOrders_(data.orders);
    if (action === 'addCareLead')         return addCareLead_(data);
    // ── TACH TEN KH: ghi that danh sach ten da duoc nguoi dung xac nhan tren UI ──
    if (action === 'applyCustomerNameGuesses') return applyCustomerNameGuesses_(data.items);    if (action === 'patchOrder')          return patchOrder_(data);
    if (action === 'deleteOrder')         return deleteOrder_(data);
    // ── Xuat bao cao doanh so (dang loc tren UI) ra 1 tab moi trong Google Sheet CRM ──
    if (action === 'exportSalesReportSheet') return jsonOut_(exportSalesReportToSheet_(data.reportType, data.filters));
    // ── XOA DON TRUNG: xoa cac dong trung da duoc CS/admin xac nhan (danh sach items tra ve tu findDuplicateOrders) ──
    if (action === 'deleteDuplicateOrders') return deleteDuplicateOrders_(data.items);
    if (action === 'replaceOrders')       return replaceOrders_(data.orders, data);
    if (action === 'setOrderCareCS')      return setOrderCareCS_(data.phone, data.careCS);
    if (action === 'setOrderCareCSBatch') return setOrderCareCSBatch_(data.updates);
    if (action === 'saveTeams')           return saveTeams_(data.teams);
    if (action === 'saveUsers')           return saveUsers_(data.users);
    if (action === 'saveAudit')           return saveAudit_(data.rows);
    // ── Bao cao Pancake ──
    if (action === 'savePancakeStats')    return savePancakeStats_(data.rows);
    if (action === 'savePancakeNameMap')  return savePancakeNameMap_(data.pancakeName, data.saleName);
    if (action === 'setSetting')          return setSetting_(data.key, data.value);
    // Them 1 nick Zalo vao danh sach chung (MERGE tren server -> khong ghi de mat nick cu)
    if (action === 'addZaloNick')         return addZaloNick_(data.nick);
    if (action === 'saveAssign')          return saveAssignEntry_(data.entry);
    if (action === 'saveAssignHistory')   return saveAssignHistory_(data.history);
    if (action === 'saveTask')  return saveTaskEntry_(data.task);
    if (action === 'deleteTask') return deleteTask_(data.id);
    // ── Binh luan/thao luan trong 1 cong viec (Task) — tab "Thao luan" tren UI ──
    if (action === 'saveTaskComment') return saveTaskComment_(data.comment);
    if (action === 'saveCareStatus')      return saveCareStatus_(data.careStatus);
    if (action === 'saveAIContext')        return saveAIContext_(data.type, data.content, data.context);
    if (action === 'ai')                  return callGroqAI_(data);
    // ── BROADCAST: tao/cap nhat 1 chien dich gui tin hang loat ──
    if (action === 'saveBroadcast')        return saveBroadcast_(data.broadcast || data);
    // ── BROADCAST: danh dau 1 SDT da gui/loi/bo qua trong 1 chien dich ──
    if (action === 'broadcastMark')        return broadcastMark_(data.id, data.phone, data.status);
    // ── BROADCAST: upload 1 anh (base64) len Drive, tra ve link xem truc tiep ──
    if (action === 'uploadBroadcastImg')   return uploadBroadcastImage_(data.base64, data.filename, data.mimeType);
    // ── BROADCAST: huy 1 chien dich (dung gui tiep) ──
    if (action === 'broadcastCancel')      return broadcastCancel_(data.id);
    // ── BROADCAST: bat/tat (kich hoat/tam tat) 1 chien dich ──
    if (action === 'broadcastSetStatus')   return broadcastSetStatus_(data.id, data.status);
    // ── HOI THAM TU DONG: nhan ket qua quet ten Zalo tu extension (du phong khi thieu OrderData) ──
    if (action === 'saveZaloScan')         return saveZaloScan_(data.rows);
    // ── ZALO AI: dong bo trang thai ket ban (Da ket ban/Chan/...) tu nut "Quet man hinh" trong extension.
    //     dryRun=true -> CHI kiem tra xung dot (SDT nao dang duoc CS/Nick khac ghi nhan khac trang thai),
    //     khong ghi gi ca; extension se hoi CS xac nhan roi moi goi lai voi dryRun=false (that su ghi). ──
    if (action === 'syncZaloFriendStatus') return syncZaloFriendStatus_(data.rows, !!data.dryRun);
    // Dọn dòng CareData bị nhân bản (giữ dòng đầy đủ nhất cho mỗi SĐT)
    if (action === 'dedupeCare')           return dedupeCare_();
    // ── HOI THAM TU DONG: luu bang mau tin (UI Sasum) ──
    if (action === 'saveFollowUpTemplates') return saveFollowUpTemplates_(data.templates);
    // ── MESSENGER/PHONG THUY AI: doc bang tra menh + mau canned response (Sheet Menh/CannedResponses,
    //    tu tao voi du lieu mac dinh neu chua co). Them 2026-09, KHONG dung chung sheet/cot voi CareData. ──
    if (action === 'getKnowledge') return jsonOut_(getMessengerKnowledge_());
    return jsonOut_({ error: 'Unknown action: ' + action });
  } catch(err) {
    return jsonOut_({ error: err.message });
  }
}

// ─── SAVE CARE ─────────────────────────────────────────────────
// BUG FIX: doc existing ext fields truoc khi xoa, de bao toan du lieu
// khi appweb sync khong gui khStatus/nickZalos/birthday
// Xoa cache 'lookup' theo tung SDT (goi sau moi lan ghi de dong bo GAY tuc thoi voi Zalo AI extension)
function invalidateLookupCache_(phones) {
  try {
    var cache = CacheService.getScriptCache();
    var keys = [];
    for (var i = 0; i < phones.length; i++) { if (phones[i]) keys.push('lk_' + normPhone_(String(phones[i]))); }
    for (var j = 0; j < keys.length; j += 100) { cache.removeAll(keys.slice(j, j + 100)); }
  } catch(ec) {}
}

function saveAllCare_(rows) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var extMap = readExistingExtFields_(sh);
  sh.clearContents();
  var matrix = [CARE_HEADERS];
  var phones = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    mergeExtFields_(r, extMap[String(r.phone)]);
    matrix.push(careRow_(r));
    phones.push(r.phone);
  }
  sh.getRange(1, 1, matrix.length, CARE_HEADERS.length).setValues(matrix);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
  invalidateLookupCache_(phones);
  return jsonOut_({ ok: true, written: rows.length });
}

function saveSingleCare_(r) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  var npR = normPhone_(String(r.phone));
  if (last >= 2) {
    var colP = sh.getRange(2, 1, last-1, 1).getValues();
    for (var pi = 0; pi < colP.length; pi++) {
      if (normPhone_(String(colP[pi][0])) === npR) { rowIdx = pi + 2; break; }
    }
  }
  if (rowIdx > 0) {
    // Doc du lieu hien tai de bao toan truong mo rong neu incoming khong co
    var existRow = sh.getRange(rowIdx, 1, 1, CARE_HEADERS.length).getValues()[0];
    mergeExtFields_(r, { khStatus: existRow[15]||'', nickZalos: existRow[16]||'[]', birthday: existRow[17]||'', zaloSetBy: existRow[18]||'', name: existRow[19]||'' });
    sh.getRange(rowIdx, 1, 1, CARE_HEADERS.length).setValues([careRow_(r)]);
  } else {
    sh.appendRow(careRow_(r));
  }
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('customers_v12');
    cache.remove('lk_' + normPhone_(String(r.phone)));
  } catch(ec) {}
  return jsonOut_({ ok: true, found: rowIdx > 0 });
}

function saveBatchCare_(rows) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var data = sh.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < data.length; i++) { if (data[i][0]) index[normPhone_(String(data[i][0]))] = i; }
  var appended = 0, updated = 0;
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k]; var key = normPhone_(String(r.phone));
    if (index[key] !== undefined) {
      mergeExtFields_(r, { khStatus: data[index[key]][15]||'', nickZalos: data[index[key]][16]||'[]', birthday: data[index[key]][17]||'', zaloSetBy: data[index[key]][18]||'', name: data[index[key]][19]||'' });
      data[index[key]] = careRow_(r); updated++;
    } else {
      data.push(careRow_(r)); index[key] = data.length - 1; appended++;
    }
  }
  var Wb = CARE_HEADERS.length;
  for (var bi = 1; bi < data.length; bi++) {
    var brow = data[bi] || [];
    if (brow.length > Wb) brow = brow.slice(0, Wb);
    while (brow.length < Wb) brow.push('');
    data[bi] = brow;
  }
  sh.getRange(1, 1, data.length, Wb).setValues(data);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
  invalidateLookupCache_(rows.map(function(r){ return r.phone; }));
  return jsonOut_({ ok: true, updated: updated, appended: appended });
}

// ── ZALO AI: dong bo trang thai ket ban tu nut "Quet man hinh hien tai" trong extension ──
// rows: [{phone, zalo, scannedBy, nick}]
// CHI cap nhat cot 'zalo' (trang thai ket ban) + nickZalos + zaloSetBy, KHONG dung careRow_/saveBatchCare_
// vi careRow_ se ghi de rong cac cot status/cs/note/schedules neu incoming row thieu cac truong do.
//
// dryRun = true: CHI kiem tra xem SDT nao dang doi trang thai ma truoc do da duoc 1 CS/Nick KHAC ghi nhan
//          (zaloSetBy.cs khac scannedBy hien tai) VA gia tri zalo thuc su khac nhau -> tra ve danh sach
//          conflicts de extension hoi CS "co muon ghi de khong", KHONG ghi gi vao sheet ca.
// dryRun = false (mac dinh): ghi that su. Cac dong CS da xac nhan de-o het thi gui nguyen rows nhu binh thuong.
// TOI UU (v13.1): KHONG doc/ghi toan bo sheet CareData (co the toi 40.000+ dong).
// Truoc day ham nay lam sh.getDataRange().getValues() + setValues() lai TOAN BO sheet
// chi de cap nhat vai chuc dong -> voi sheet lon thao tac nay co the mat rat lau,
// khien ket noi bi ngat truoc khi Apps Script tra ve ket qua -> loi "Failed to fetch"
// phia extension (dung xem la loi mang; ban chat la request bi timeout do qua cham).
// Cach moi: chi doc cot A (phone) de dung index, roi CHI ghi dung cac o can doi cho
// tung dong duoc chon (thay vi ghi de ca sheet), va CHI them dong moi bang appendRow
// theo khoi (khong dung lai toan bo data array).
function syncZaloFriendStatus_(rows, dryRun) {
  if (!rows || !rows.length) return jsonOut_({ ok: false, error: 'Khong co du lieu de dong bo' });
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var W = CARE_HEADERS.length;
  var lastRow = sh.getLastRow();

  // Chi doc cot A (phone) cho toan bo sheet -> nhe hon nhieu so voi doc ca 19 cot
  var index = {}; // phone -> so dong tren sheet (1-based, >=2)
  if (lastRow >= 2) {
    var phoneCol = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < phoneCol.length; i++) {
      if (phoneCol[i][0]) index[normPhone_(String(phoneCol[i][0]))] = i + 2;
    }
  }

  if (dryRun) {
    var conflicts = [];
    for (var c = 0; c < rows.length; c++) {
      var rc = rows[c];
      var phoneC = normPhone_(String(rc.phone || ''));
      var rn = phoneC ? index[phoneC] : undefined;
      if (!phoneC || rn === undefined) continue;
      // Chi doc 2 o can thiet (zalo + zaloSetBy) cho dong nay, khong doc ca dong/ca sheet
      var oldZalo = sh.getRange(rn, 3).getValue() || '';
      if (!oldZalo || oldZalo === (rc.zalo || '')) continue; // chua tung ghi, hoac gia tri khong doi -> khong tinh la xung dot
      var oldSetByRaw = sh.getRange(rn, 19).getValue();
      var oldSetBy = null;
      try { oldSetBy = JSON.parse(oldSetByRaw || 'null'); } catch (e) { oldSetBy = null; }
      var oldCs = oldSetBy ? (oldSetBy.cs || '') : '';
      var oldNick = oldSetBy ? (oldSetBy.nick || '') : '';
      if (oldCs && oldCs !== (rc.scannedBy || '')) {
        conflicts.push({ phone: rc.phone, oldZalo: oldZalo, oldCs: oldCs, oldNick: oldNick, newZalo: rc.zalo || '' });
      }
    }
    return jsonOut_({ ok: true, dryRun: true, conflicts: conflicts });
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (eLock) { /* tiep tuc, chap nhan rui ro hiem gap trung dong moi */ }

  var updated = 0, appended = 0;
  var now = new Date().toISOString();
  var newRows = [];
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var phone = normPhone_(String(r.phone || ''));
    if (!phone) continue;
    var zaloStatus = r.zalo || '';
    var nick = String(r.nick || '').trim();
    var setBy = JSON.stringify({ cs: r.scannedBy || '', nick: nick, at: now });

    var rowNum = index[phone];
    if (rowNum !== undefined) {
      // FIX: chi ghi neu THUC SU co gi thay doi (zalo status khac, hoac nick moi chua co).
      // Truoc day ham nay luon ghi lai cot 'updated' (O) cho MOI dong duoc quet, ke ca khi
      // trang thai zalo khong doi gi ca -> Sasum tuong lam la "khach vua co cap nhat moi"
      // moi lan CS chi don gian mo lai doan chat / bam quet man hinh, gay bao dong gia.
      var curZalo = sh.getRange(rowNum, 3).getValue() || '';
      var nickAlreadyThere = true;
      var curNzRaw = '';
      if (nick) {
        curNzRaw = sh.getRange(rowNum, 17).getValue();
        var nzChk = [];
        try { nzChk = JSON.parse(curNzRaw || '[]'); } catch (e) { nzChk = []; }
        if (!Array.isArray(nzChk)) nzChk = [];
        nickAlreadyThere = nzChk.indexOf(nick) !== -1;
      }
      if (curZalo === zaloStatus && nickAlreadyThere) {
        // Khong co gi thay doi -> bo qua hoan toan, KHONG dung vao cot 'updated'
        continue;
      }
      // Chi ghi dung 3 vung o thay doi cua dong nay: zalo(C), updated(O), zaloSetBy(S) [+ nickZalos(Q) neu co nick moi]
      if (curZalo !== zaloStatus) sh.getRange(rowNum, 3).setValue(zaloStatus);
      sh.getRange(rowNum, 15).setValue(now);
      if (nick && !nickAlreadyThere) {
        var nz = [];
        try { nz = JSON.parse(curNzRaw || '[]'); } catch (e) { nz = []; }
        if (!Array.isArray(nz)) nz = [];
        nz.push(nick);
        sh.getRange(rowNum, 17).setValue(JSON.stringify(nz));
      }
      sh.getRange(rowNum, 19).setValue(setBy);
      updated++;
    } else {
      var newRow = careRow_({ phone: phone, zalo: zaloStatus, nickZalos: nick ? [nick] : [], zaloSetBy: setBy });
      if (newRow.length > W) newRow = newRow.slice(0, W);
      while (newRow.length < W) newRow.push('');
      newRows.push(newRow);
      index[phone] = lastRow + newRows.length; // du phong neu co SDT trung lap trong cung 1 lan sync
      appended++;
    }
  }

  if (newRows.length) {
    sh.getRange(lastRow + 1, 1, newRows.length, W).setValues(newRows);
  }

  try { lock.releaseLock(); } catch (eu) {}
  try { CacheService.getScriptCache().remove('customers_v12'); } catch (ec) {}
  invalidateLookupCache_(rows.map(function (r) { return r.phone; }));
  return jsonOut_({ ok: true, updated: updated, appended: appended });
}

// ─── SAVE ORDERS ───────────────────────────────────────────────
// Import hang loat khong con duoc dung nua tu khi bo Sasum (DT TONG do nhan vien
// tu quan ly truc tiep tren Sheet) — tra loi ro de tranh ghi nham cot vao sheet
// dang duoc quan ly thu cong.
function saveOrders_(orders) {
  return jsonOut_({ ok: false, error: 'Da ngung ho tro import hang loat don hang (saveOrders). DT TONG gio duoc quan ly truc tiep tren Google Sheet, khong con dong bo tu Sasum nua.' });
}

// Sua 1 don hang trong DT TONG. Uu tien khop theo data.id (cot T, chinh xac tuyet doi).
// Neu khong co id (client cu chua gui), du phong khop theo phone + oldYear/oldMonth (tu
// Thoi gian hoan thanh) + oldRevenue nhu co che cu.
function patchOrder_(data) {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh || sh.getLastRow() < 2) return jsonOut_({ ok: false, error: 'Khong tim thay sheet DT TONG' });
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  var rowIdx = -1;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (data.id) {
      if (String(r[DT_COL_ID]) === String(data.id)) { rowIdx = i + 2; break; }
      continue;
    }
    var ph = normPhone_(String(r[DT_COL_PHONE] || ''));
    if (ph !== normPhone_(String(data.phone || ''))) continue;
    var d = parseVNDate_(r[DT_COL_THOIGIANHT]);
    var yy = d ? d.getFullYear() : '', mm = d ? (d.getMonth() + 1) : '';
    if (String(yy) !== String(data.oldYear)) continue;
    if (String(mm) !== String(data.oldMonth)) continue;
    if (_normMoney_(r[DT_COL_GIATRIDON]) !== _normMoney_(data.oldRevenue)) continue;
    rowIdx = i + 2; break;
  }
  if (rowIdx === -1) return jsonOut_({ ok: false, updated: false, error: 'Khong tim thay dong don hang phu hop trong DT TONG' });

  if (data.newDate !== undefined) {
    var dnew = parseVNDate_(data.newDate) || new Date(data.newDate);
    if (dnew && !isNaN(dnew.getTime())) sh.getRange(rowIdx, DT_COL_THOIGIANHT + 1).setValue(dnew);
  }
  if (data.newRevenue !== undefined) sh.getRange(rowIdx, DT_COL_GIATRIDON + 1).setValue(data.newRevenue);
  if (data.newProduct)               sh.getRange(rowIdx, DT_COL_SANPHAM + 1).setValue(data.newProduct);
  if (data.newDetail)                sh.getRange(rowIdx, DT_COL_PHANLOAI + 1).setValue(data.newDetail);
  try { CacheService.getScriptCache().remove('lk_' + normPhone_(String(data.phone))); } catch (ec) {}
  return jsonOut_({ ok: true, updated: true });
}

// Xoa 1 don hang trong DT TONG. Uu tien khop theo data.id; du phong theo phone+year/month/revenue.
function deleteOrder_(data) {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh || sh.getLastRow() < 2) return jsonOut_({ ok: false, deleted: false, error: 'Khong tim thay sheet DT TONG' });
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (data.id) {
      if (String(r[DT_COL_ID]) !== String(data.id)) continue;
    } else {
      var ph = normPhone_(String(r[DT_COL_PHONE] || ''));
      if (ph !== normPhone_(String(data.phone || ''))) continue;
      var d = parseVNDate_(r[DT_COL_THOIGIANHT]);
      var yy = d ? d.getFullYear() : '', mm = d ? (d.getMonth() + 1) : '';
      if (String(yy) !== String(data.oldYear)) continue;
      if (String(mm) !== String(data.oldMonth)) continue;
      if (_normMoney_(r[DT_COL_GIATRIDON]) !== _normMoney_(data.oldRevenue)) continue;
    }
    sh.deleteRow(i + 2);
    try { CacheService.getScriptCache().remove('lk_' + normPhone_(String(data.phone))); } catch (ec) {}
    return jsonOut_({ ok: true, deleted: true });
  }
  return jsonOut_({ ok: true, deleted: false });
}

// ─── XOA DON TRUNG ────────────────────────────────────────────────
// Truoc day so trung theo SDT+nam+thang+DOANH THU — nhung co truong hop
// 1 don bi nhan bản do loi sheet/import lam MAT 3 SO 0 o doanh thu (VD:
// 689 thay vi 689.000), khien 2 dong thuc chat la 1 don nhung KHONG
// trung theo doanh thu -> khong phat hien duoc. Nen doi key so trung
// sang SDT + NGAY MUA CU THE + san pham (BO doanh thu ra khoi key).
// - Neu ca nhom co doanh thu GIONG HET nhau -> "trung chinh xac", tu
//   dong de xuat giu dong dau, xoa cac dong con lai (extras da tick san).
// - Neu doanh thu KHAC NHAU trong nhom (nhu ca "mat so 0" o tren) ->
//   danh dau needsReview=true, KHONG tu chon dong nao de xoa — giao
//   dien phai hien ro doanh thu tung dong de CS/admin tu chon dong SAI
//   can xoa, tranh xoa nham dong co doanh thu DUNG.
function normOrderDate_(v) {
  if (!v) return '';
  var d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d)) return String(v).trim();
  return Utilities.formatDate(d, Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd');
}
function _normTxt_(s) { return String(s || '').trim().toLowerCase(); }

function findDuplicateOrders_(phoneFilter) {
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  var normP = phoneFilter ? normPhone_(phoneFilter) : '';
  var groupsByKey = {};
  if (sh && sh.getLastRow() >= 2) {
    var last = sh.getLastRow();
    var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      if (!r[DT_COL_PHONE]) continue;
      var np = normPhone_(String(r[DT_COL_PHONE]));
      if (normP && np !== normP) continue;
      var nDate = normOrderDate_(r[DT_COL_THOIGIANHT]);
      var key = np + '|' + nDate + '|' + _normTxt_(r[DT_COL_SANPHAM]);
      if (!groupsByKey[key]) groupsByKey[key] = [];
      groupsByKey[key].push({
        sheet: DT_TONG_SHEET, rowIndex: i + 2, id: r[DT_COL_ID] != null ? String(r[DT_COL_ID]) : '',
        phone: r[DT_COL_PHONE], name: '', date: r[DT_COL_THOIGIANHT] || '',
        year: '', month: '', cs: r[DT_COL_SALEBAN] || '', source: r[DT_COL_KENHBAN] || '',
        revenue: _normMoney_(r[DT_COL_GIATRIDON]), product: r[DT_COL_SANPHAM] || '',
        productDetail: r[DT_COL_PHANLOAI] || '', status: r[DT_COL_TRANGTHAI] || ''
      });
    }
  }
  var dupGroups = [];
  Object.keys(groupsByKey).forEach(function (k) {
    var g = groupsByKey[k];
    if (g.length < 2) return;
    g.sort(function (a, b) { return a.rowIndex - b.rowIndex; });
    var firstRev = Number(g[0].revenue) || 0;
    var allSameRevenue = g.every(function (row) { return (Number(row.revenue) || 0) === firstRev; });
    var note = '';
    var maxRev = firstRev;
    var zeroLossPattern = false;
    if (!allSameRevenue) {
      for (var a = 0; a < g.length; a++) { var ra0 = Number(g[a].revenue) || 0; if (ra0 > maxRev) maxRev = ra0; }
      for (var a = 0; a < g.length && !note; a++) {
        for (var b = 0; b < g.length && !note; b++) {
          if (a === b) continue;
          var ra = Number(g[a].revenue) || 0, rb = Number(g[b].revenue) || 0;
          if (ra > 0 && rb > 0 && ra !== rb && (ra === rb * 1000 || rb === ra * 1000)) {
            zeroLossPattern = true;
            note = 'Doanh thu lệch nhau đúng 1000 lần (VD ' + rb + ' vs ' + ra + ') — nghi ngờ lỗi MẤT 3 SỐ 0 khi nhập liệu, không phải 2 đơn thật. Đề xuất giữ dòng doanh thu LỚN HƠN (' + maxRev.toLocaleString('vi-VN') + 'đ), xóa (các) dòng nhỏ hơn — vui lòng xác nhận lại trước khi xóa.';
          }
        }
      }
      if (!note) note = 'Các dòng trùng ngày mua + sản phẩm nhưng DOANH THU KHÁC NHAU — kiểm tra kỹ trước khi xóa, có thể là 2 đơn thật khác nhau, hệ thống KHÔNG tự đề xuất dòng để xóa.';
    }
    // Đề xuất dòng để xóa (tick sẵn ở UI) — CHỈ đề xuất, người dùng vẫn phải xác nhận trước khi xóa thật:
    // - Nhóm giống hệt: giữ dòng đầu, đề xuất xóa các dòng còn lại.
    // - Nhóm nghi mất số 0 (lệch đúng 1000 lần): giữ dòng doanh thu LỚN hơn, đề xuất xóa (các) dòng NHỎ hơn.
    // - Nhóm lệch doanh thu kiểu khác: KHÔNG đề xuất dòng nào, để người dùng tự chọn.
    var autoDeleteRows;
    if (allSameRevenue) autoDeleteRows = g.slice(1);
    else if (zeroLossPattern) autoDeleteRows = g.filter(function (row) { return (Number(row.revenue) || 0) < maxRev; });
    else autoDeleteRows = [];
    dupGroups.push({
      key: k, phone: g[0].phone, name: g[0].name, year: g[0].year, month: g[0].month,
      date: g[0].date, product: g[0].product, productDetail: g[0].productDetail,
      count: g.length, exact: allSameRevenue, zeroLossPattern: zeroLossPattern, note: note,
      rows: g,
      keep: allSameRevenue ? g[0] : null,
      extras: autoDeleteRows
    });
  });
  var totalExtra = 0;
  dupGroups.forEach(function (g) { totalExtra += g.extras.length; });
  return { ok: true, groups: dupGroups, groupCount: dupGroups.length, totalExtra: totalExtra };
}

// items: [{sheet, rowIndex, phone?, date?, revenue?, product?}, ...] — lay tu extras (nhom exact)
// hoac do CS/admin tu chon (nhom needsReview) trong findDuplicateOrders_, hoac 1 dong le CS tu bam xoa.
// Neu co gui kem phone/date/revenue/product, se XAC MINH LAI dung dong do truoc khi xoa — tranh
// truong hop rowIndex bi lech (co CS khac vua them/xoa dong khac trong luc do) dan den xoa NHAM dong.
function deleteDuplicateOrders_(items) {
  if (!items || !items.length) return jsonOut_({ ok: true, deleted: 0, skipped: 0 });
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) return jsonOut_({ ok: false, deleted: 0, skipped: items.length, error: 'Khong tim thay sheet DT TONG' });
  // Xoa tu duoi len tren de khong lam lech chi so cac dong con lai
  var arr = items.slice().sort(function (a, b) { return (b.rowIndex||0) - (a.rowIndex||0); });
  var deleted = 0, skipped = 0, affectedPhones = {};
  arr.forEach(function (it) {
    if (!it || !it.rowIndex) { skipped++; return; }
    try {
      var rowVals = sh.getRange(it.rowIndex, 1, 1, DT_TONG_WIDTH).getValues()[0];
      var match = true;
      // Uu tien xac minh theo id (chinh xac tuyet doi); neu khong co id, du phong theo phone/date/revenue/product
      if (it.id) {
        if (String(rowVals[DT_COL_ID]) !== String(it.id)) match = false;
      } else {
        if (it.phone   != null && it.phone   !== '' && normPhone_(String(rowVals[DT_COL_PHONE])) !== normPhone_(String(it.phone))) match = false;
        if (match && it.date    != null && it.date    !== '' && normOrderDate_(rowVals[DT_COL_THOIGIANHT]) !== normOrderDate_(it.date)) match = false;
        if (match && it.revenue != null && it.revenue !== '' && _normMoney_(rowVals[DT_COL_GIATRIDON]) !== _normMoney_(it.revenue)) match = false;
        if (match && it.product != null && it.product !== '' && _normTxt_(rowVals[DT_COL_SANPHAM]) !== _normTxt_(it.product)) match = false;
      }
      if (!match) { skipped++; return; } // dong da bi dich/doi khac voi luc CS bam xoa -> KHONG xoa, tranh xoa nham
      if (rowVals[DT_COL_PHONE]) affectedPhones[normPhone_(String(rowVals[DT_COL_PHONE]))] = true;
      sh.deleteRow(it.rowIndex);
      deleted++;
    } catch (e) { skipped++; }
  });
  try {
    var cache = CacheService.getScriptCache();
    Object.keys(affectedPhones).forEach(function (p) { cache.remove('lk_' + p); });
  } catch (ec) {}
  return jsonOut_({ ok: true, deleted: deleted, skipped: skipped });
}

// Da ngung ho tro thay toan bo du lieu don hang tu client (truoc day dung khi dong bo
// hang loat tu Sasum). DT TONG gio la sheet duoc nhan vien quan ly truc tiep — ghi de
// toan bo se rat nguy hiem (mat cot Giao cho/Giai doan... ma noi bo dang dung hang ngay).
function replaceOrders_(orders, data) {
  return jsonOut_({ ok: false, error: 'Da ngung ho tro thay toan bo don hang (replaceOrders). DT TONG gio duoc quan ly truc tiep tren Google Sheet — dung sua/xoa tung dong qua patchOrder/deleteOrder thay vi ghi de ca sheet.' });
}

// DT TONG khong co cot rieng danh cho "careCS" (CS phu trach cham soc sau ban hang cho
// tung don) — khac voi CareData.cs (CS phu trach chung 1 khach) van hoat dong binh thuong.
// Tam thoi bao loi ro rang thay vi im lang khong lam gi, de tranh CS tuong nham la da luu.
function setOrderCareCS_(phone, careCS) {
  return jsonOut_({ ok: false, updated: 0, error: 'Tinh nang gan careCS rieng cho tung don khong con duoc ho tro sau khi chuyen sang DT TONG (khong co cot luu). CS phu trach chung 1 khach van dung binh thuong o CareData.' });
}

function setOrderCareCSBatch_(updates) {
  return jsonOut_({ ok: false, updated: 0, error: 'Tinh nang gan careCS rieng cho tung don khong con duoc ho tro sau khi chuyen sang DT TONG (khong co cot luu). CS phu trach chung 1 khach van dung binh thuong o CareData.' });
}

// ─── TEAMS / USERS / AUDIT ─────────────────────────────────────
function saveTeams_(teams) {
  var sh = getSheet_(SH_TEAM, TEAM_HEADERS);
  sh.clearContents();
  var matrix = [TEAM_HEADERS];
  for (var i = 0; i < teams.length; i++) {
    var t = teams[i];
    matrix.push([t.id||'', t.name||'', t.leader||'', JSON.stringify(t.members||[]), t.color||'', JSON.stringify(t.channels||[])]);
  }
  sh.getRange(1, 1, matrix.length, TEAM_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: teams.length });
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO PANCAKE (nhap tu file Excel "Thong ke tuong tac" — pages_statistics_engagements)
// ═══════════════════════════════════════════════════════════════

// Ghi cac dong thong ke ngay tu file Excel upload. Idempotent theo date+pageId+nhanVien: xoa
// het cac dong TRUNG NGAY+PAGE co trong payload roi ghi lai — nap lai file cung 1 ngay (vd
// sua so lieu, hoac nap lai cho chac) se khong bi nhan doi du lieu.
function savePancakeStats_(rows) {
  rows = rows || [];
  if (!rows.length) return jsonOut_({ ok: true, written: 0 });
  var sh = getSheet_(SH_PK_STATS, PK_STATS_HEADERS);
  var lastRow = sh.getLastRow();

  // Tap hop (date, pageId) co trong lan nap nay -> can xoa sach du lieu cu cung khoa truoc khi ghi lai
  var touchedKeys = {};
  rows.forEach(function(r) { touchedKeys[r.date + '|' + r.pageId] = true; });

  var keep = [];
  if (lastRow > 1) {
    var existing = sh.getRange(2, 1, lastRow - 1, PK_STATS_HEADERS.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      var k = existing[i][0] + '|' + existing[i][1];
      if (!touchedKeys[k]) keep.push(existing[i]);
    }
  }

  var newRows = rows.map(function(r) {
    return [r.date||'', r.pageId||'', r.pageName||'', r.nhanVien||'',
      +r.khCu||0, +r.khMoi||0, +r.tongTT||0, +r.tinNhan||0, +r.binhLuan||0,
      +r.hoiThoaiMoi||0, +r.dhKhMoi||0, +r.dhKhCu||0, +r.tongDH||0];
  });

  sh.clearContents();
  var matrix = [PK_STATS_HEADERS].concat(keep).concat(newRows);
  sh.getRange(1, 1, matrix.length, PK_STATS_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: newRows.length, replaced: keep.length !== (lastRow > 1 ? lastRow - 1 : 0) });
}

function readPancakeMap_() {
  var sh = getSheet_(SH_PK_MAP, PK_MAP_HEADERS);
  var out = {};
  if (sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PK_MAP_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (!v[i][0]) continue;
    out[String(v[i][0])] = String(v[i][1] || '');
  }
  return out;
}

// Ghi/cap nhat 1 dong khop ten (upsert theo pancakeName) — khong xoa cac dong khop khac.
function savePancakeNameMap_(pancakeName, saleName) {
  if (!pancakeName) return jsonOut_({ error: 'Thiếu tên Nhân viên Pancake.' });
  var sh = getSheet_(SH_PK_MAP, PK_MAP_HEADERS);
  var lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    var v = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) === String(pancakeName)) {
        sh.getRange(i + 2, 2).setValue(saleName || '');
        return jsonOut_({ ok: true, updated: true });
      }
    }
  }
  sh.appendRow([pancakeName, saleName || '']);
  return jsonOut_({ ok: true, updated: false });
}

// Tong hop bao cao theo Page va theo CS (da khop ten qua PancakeNameMap; ten chua khop giu
// nguyen ten Pancake va danh dau unmapped:true de UI nhac nguoi dung di khop ten).
function buildPancakeReport_(from, to, split) {
  split = (split === 'full') ? 'full' : 'equal';
  var sh = getSheet_(SH_PK_STATS, PK_STATS_HEADERS);
  var map = readPancakeMap_();
  var byPage = {}, byCS = {};
  var unmappedSet = {};

  if (sh.getLastRow() >= 2) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, PK_STATS_HEADERS.length).getValues();
    for (var i = 0; i < v.length; i++) {
      var d = String(v[i][0]);
      if (from && d < from) continue;
      if (to && d > to) continue;
      var pageId = String(v[i][1]), pageName = String(v[i][2]), nhanVien = String(v[i][3]);
      var khCu=+v[i][4]||0, khMoi=+v[i][5]||0, tongTT=+v[i][6]||0, tinNhan=+v[i][7]||0,
          binhLuan=+v[i][8]||0, hoiThoaiMoi=+v[i][9]||0, dhKhMoi=+v[i][10]||0, dhKhCu=+v[i][11]||0, tongDH=+v[i][12]||0;

      if (!byPage[pageId]) byPage[pageId] = { pageId: pageId, pageName: pageName, khCu:0, khMoi:0, tongTT:0, tinNhan:0, binhLuan:0, hoiThoaiMoi:0, dhKhMoi:0, dhKhCu:0, tongDH:0 };
      var bp = byPage[pageId];
      bp.khCu+=khCu; bp.khMoi+=khMoi; bp.tongTT+=tongTT; bp.tinNhan+=tinNhan; bp.binhLuan+=binhLuan;
      bp.hoiThoaiMoi+=hoiThoaiMoi; bp.dhKhMoi+=dhKhMoi; bp.dhKhCu+=dhKhCu; bp.tongDH+=tongDH;

      // 1 ten Pancake co the gan cho nhieu Sale (luu dang "saleA|saleB").
      var sales = String(map[nhanVien] || '').split('|').map(function(x) { return x.trim(); }).filter(function(x) { return x; });
      var mapped = sales.length > 0;
      if (!mapped) { sales = [nhanVien]; unmappedSet[nhanVien] = true; }
      // split='equal': chia deu cho cac Sale (tong theo CS = tong theo Page); split='full': moi Sale tinh du.
      var w = (split === 'full') ? 1 : 1 / sales.length;
      for (var si = 0; si < sales.length; si++) {
        var saleName = sales[si];
        var csKey = saleName;
        if (!byCS[csKey]) byCS[csKey] = { name: saleName, pancakeNames: {}, mapped: mapped, shared: false, khCu:0, khMoi:0, tongTT:0, tinNhan:0, binhLuan:0, hoiThoaiMoi:0, dhKhMoi:0, dhKhCu:0, tongDH:0 };
        var bc = byCS[csKey];
        bc.pancakeNames[nhanVien] = true;
        if (mapped) bc.mapped = true; // neu >=1 nguon da khop thi coi la mapped (hiem khi trung ten CS voi ten chua khop)
        if (sales.length > 1) bc.shared = true;
        bc.khCu+=khCu*w; bc.khMoi+=khMoi*w; bc.tongTT+=tongTT*w; bc.tinNhan+=tinNhan*w; bc.binhLuan+=binhLuan*w;
        bc.hoiThoaiMoi+=hoiThoaiMoi*w; bc.dhKhMoi+=dhKhMoi*w; bc.dhKhCu+=dhKhCu*w; bc.tongDH+=tongDH*w;
      }
    }
  }

  function finalize(obj) {
    var arr = Object.keys(obj).map(function(k) {
      var r = obj[k];
      r.tyLeCD = r.tongTT ? Math.round(r.tongDH / r.tongTT * 1000) / 10 : 0;
      ['khCu','khMoi','tongTT','tinNhan','binhLuan','hoiThoaiMoi','dhKhMoi','dhKhCu','tongDH'].forEach(function(f) { r[f] = Math.round(r[f] * 100) / 100; });
      if (r.pancakeNames) r.pancakeNames = Object.keys(r.pancakeNames);
      return r;
    });
    arr.sort(function(a,b) { return b.tongTT - a.tongTT; });
    return arr;
  }

  return { byPage: finalize(byPage), byCS: finalize(byCS), unmapped: Object.keys(unmappedSet).sort(), split: split };
}

function saveUsers_(users) {
  users = users || [];
  var adminCount = 0;
  for (var a = 0; a < users.length; a++) { if (users[a] && users[a].role === 'admin') adminCount++; }
  if (users.length > 0 && adminCount === 0) return jsonOut_({ error: 'TU_CHOI: Phai con it nhat 1 tai khoan Admin.' });
  var sh = getSheet_(SH_USER, USER_HEADERS);
  sh.clearContents();
  var matrix = [USER_HEADERS];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var namesArr = (u.names && u.names.length) ? u.names : (u.name ? [u.name] : []);
    matrix.push([String(u.username||''), String(u.passHash||''), u.role||'cs',
                 namesArr[0]||u.name||'', u.team||'', (u.active===false?false:true),
                 JSON.stringify(namesArr)]);
  }
  sh.getRange(1, 1, matrix.length, USER_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: users.length });
}

function saveAudit_(rows) {
  var sh = getSheet_(SH_AUDIT, AUDIT_HEADERS);
  if (!rows || !rows.length) return jsonOut_({ ok: true, written: 0 });
  var matrix = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    matrix.push([r.timestamp||new Date().toISOString(), r.user||'', r.action||'', r.phone||'', r.oldValue||'', r.newValue||'']);
  }
  sh.getRange(sh.getLastRow()+1, 1, matrix.length, AUDIT_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: matrix.length });
}

// ─── CARE STATUS / ASSIGN ──────────────────────────────────────
function saveCareStatus_(list) {
  if (!Array.isArray(list)) return jsonOut_({ error: 'careStatus phai la mang.' });
  return setSetting_('careStatus', JSON.stringify(list));
}

function readAssign_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    var phones = [], donePhones = [];
    try { phones = JSON.parse(vals[i][4]||'[]'); } catch(e) { phones = []; }
    try { donePhones = JSON.parse(vals[i][5]||'[]'); } catch(e) { donePhones = []; }
    out.push({ id: String(vals[i][0]), date: String(vals[i][1]||''), csName: String(vals[i][2]||''),
               label: String(vals[i][3]||''), phones: phones, donePhones: donePhones });
  }
  return out;
}

function saveAssignEntry_(entry) {
  if (!entry || !entry.id) return jsonOut_({ error: 'no entry.id' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1;
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last-1, 1).createTextFinder(String(entry.id)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  var row = [entry.id||'', entry.date||'', entry.csName||'', entry.label||'',
             JSON.stringify(entry.phones||[]), JSON.stringify(entry.donePhones||[])];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, ASSIGN_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true });
}

function saveAssignHistory_(history) {
  if (!history) return jsonOut_({ error: 'no history' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  sh.clearContents();
  var matrix = [ASSIGN_HEADERS];
  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    matrix.push([h.id||'', h.date||'', h.csName||'', h.label||'',
                 JSON.stringify(h.phones||[]), JSON.stringify(h.donePhones||[])]);
  }
  sh.getRange(1, 1, matrix.length, ASSIGN_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: history.length });
}

// ═══════════════════════════════════════════════════════════════
//  AI — Groq + AIContext
// ═══════════════════════════════════════════════════════════════
function readAIContext_() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CONTEXT);
  var result = {
    systemPrompt: '', careProcess: '', callbackScript: '',
    salesScriptCu: '', salesScriptMoi: '',
    products: [], faqs: [], combos: []
  };
  if (!sh || sh.getLastRow() < 2) return result;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    var type    = String(vals[i][0]||'').trim();
    var content = String(vals[i][1]||'').trim();
    if (!content) continue;
    if      (type === 'system_prompt')         result.systemPrompt   = content;
    else if (type === 'care_process')          result.careProcess    = content;
    else if (type === 'callback_script')       result.callbackScript = content;
    else if (type === 'sales_script_cu')       result.salesScriptCu  = content;
    else if (type === 'sales_script_moi')      result.salesScriptMoi = content;
    else if (type === 'product')               result.products.push(content);
    else if (type === 'faq')                   result.faqs.push(content);
    else if (type === 'combo_template')        result.combos.push(content);
  }
  return result;
}

function saveAIContext_(type, content, context) {
  if (!type || !content) return jsonOut_({ error: 'Thieu type hoac content' });
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CONTEXT);
  if (!sh) { sh = ss.insertSheet(SH_CONTEXT); sh.appendRow(['type','content','context','created']); }
  sh.appendRow([type, content, context||'', new Date().toISOString()]);
  return jsonOut_({ ok: true });
}

// ─── SAN PHAM CHI TIET TU GOOGLE SHEET RIENG, NHIEU TAB (moi tab = 1 hang) ─────────
// Cau hinh: setSetting_('productSheetUrl', <link Google Sheet>) — file phai duoc chia
// se cho tai khoan dang chay Apps Script nay (hoac "Bat ky ai co lien ket" > Xem).
// Dong 1 moi tab = tieu de cot (ten tuy y). Cot dau = ten san pham. Cac o mo ta co the
// RAT DAI (nhu anh Duyen gui — mo ta chi tiet thanh phan/cong dung tung dong nhieu tram
// tu) VA co nhieu tab (nhieu hang) => KHONG duoc nhet toan bo sheet vao 1 prompt (qua
// nang, cham, ton phi AI). Cach lam:
//   1) Cache 1 "muc luc" NHE cho tung tab (ten SP + vi tri dong + doan trich ngan) —
//      cache rieng tung tab de khong vuot gioi han 100KB/1 cache key.
//   2) Khi co cau hoi (query = noi dung prompt dang gui cho AI, gom ca "Ngu canh" CS
//      nhap tay vd go "AHA"), tim trong muc luc cac dong co TU KHOA khop, xep hang theo
//      so tu khop.
//   3) CHI luc do moi doc lai NGUYEN VAN vai dong diem cao nhat (toi da 4 dong) tu dung
//      sheet — vua chinh xac vua khong lam prompt qua tai.
var _PSHEET_STOPWORDS_ = ['khach','san','pham','hang','chao','nhan','tin','giong','van',
  'yeu','cau','tra','loi','cham','soc','mua','goi','ngan','gon','tieng','viet','duoc',
  'nay','cho','voi','theo','mot','cac','trong','nguoi','minh','ban','the','nao','khong'];

function _psheetNoAccent_(s) {
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

// Map SDT (da normPhone_) -> care object day du (status, khStatus, zalo, nickZalos...) —
// dung de loc Bao cao B theo tieu chi CRM (chi B co cot SDT trong "dữ liệu đơn").
function _careMapByPhone_() {
  var rows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(rows[i].phone);
    if (ph) map[ph] = rows[i];
  }
  return map;
}
// Khop 1 chuoi voi bat ky tu khoa nao trong danh sach (khong dau, khong phan biet hoa/thuong).
// terms rong -> coi nhu KHONG loc (tra ve true).
function _pMatchAny_(text, foldedTerms) {
  if (!foldedTerms || !foldedTerms.length) return true;
  var t = _psheetNoAccent_(text || '');
  for (var i = 0; i < foldedTerms.length; i++) {
    if (foldedTerms[i] && t.indexOf(foldedTerms[i]) !== -1) return true;
  }
  return false;
}
function _foldTermsCSV_(s) {
  return s ? String(s).split(',').map(function(x){ return _psheetNoAccent_(x.trim()); }).filter(function(x){ return x; }) : [];
}

function _productSheetIndexForTab_(ss, tabName) {
  var cacheKey = 'ext_idx_v2_' + tabName;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}
  var idx = [];
  try {
    var sh = ss.getSheetByName(tabName);
    if (sh && sh.getLastRow() >= 2 && sh.getLastColumn() >= 1) {
      var vals = sh.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        var row = vals[i];
        if (!row[0]) continue;
        var snippet = row.map(function(v){ return String(v||'').trim(); }).filter(Boolean).join(' ').substring(0, 250);
        idx.push({ row: i + 1, name: String(row[0]).trim(), snippet: snippet });
      }
    }
  } catch (e) { /* tab loi/khong doc duoc -> bo qua tab nay */ }
  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(idx), 900); } catch (ec2) {} // 15 phut
  return idx;
}

// ─── Q&A / FAQ: doc sheet "FAQ" trong CareData, khop tu khoa cau hoi khach -> lay top Q&A ───
// Cot: A=STT | B=Ten SP | C=Trang thai | D=CAU HOI | E=CAU TRA LOI (dong 1 la tieu de)
function readFaqSheet_(query) {
  var ss = getCrmSS_();
  var sh = null;
  var names = ['FAQ', 'Q&A', 'QA', 'FAQs', 'Hỏi đáp', 'Hoi dap', 'HoiDap'];
  for (var n = 0; n < names.length; n++) { sh = ss.getSheetByName(names[n]); if (sh) break; }
  if (!sh || sh.getLastRow() < 2) return '';
  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var vals = sh.getDataRange().getValues();
  // Tu do cot: tim cot tieu de chua "cau hoi" / "cau tra loi" / "ten sp"
  var header = vals[0].map(function(h){ return _psheetNoAccent_(h); });
  var findCol = function(kw, def){ for (var c=0;c<header.length;c++){ if (header[c].indexOf(kw)!==-1) return c; } return def; };
  var cQ  = findCol('cau hoi', 3);
  var cA  = findCol('tra loi', 4);
  var cSP = findCol('ten sp', 1);
  var cands = [];
  for (var i = 1; i < vals.length; i++) {
    var sp   = String(vals[i][cSP] || '').trim();
    var ques = String(vals[i][cQ] || '').trim();
    var ans  = String(vals[i][cA] || '').trim();
    if (!ques || !ans) continue;
    var hay = _psheetNoAccent_(sp + ' ' + ques + ' ' + ans);
    var score = 0;
    for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
    if (score > 0) cands.push({ sp: sp, q: ques, a: ans, score: score });
  }
  if (!cands.length) return '';
  cands.sort(function(a, b) { return b.score - a.score; });
  var top = cands.slice(0, 4);
  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    var a = top[k].a; if (a.length > 700) a = a.substring(0, 700) + '...';
    blocks.push((top[k].sp ? '[' + top[k].sp + '] ' : '') + 'HOI: ' + top[k].q + '\nTRA LOI MAU: ' + a);
  }
  return blocks.join('\n\n');
}

function readExternalProductSheet_(query) {
  var url = getSetting_('productSheetUrl') || DEFAULT_PRODUCT_SHEET_URL;
  if (!url) return '';
  var ss;
  try { ss = SpreadsheetApp.openByUrl(url); } catch (e) { return ''; } // chua chia se quyen / URL sai

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var tabNames = ss.getSheets().map(function(s) { return s.getName(); });
  var candidates = [];
  for (var t = 0; t < tabNames.length; t++) {
    var idx = _productSheetIndexForTab_(ss, tabNames[t]);
    for (var i = 0; i < idx.length; i++) {
      var hay = _psheetNoAccent_(idx[i].name + ' ' + idx[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > 0) candidates.push({ brand: tabNames[t], row: idx[i].row, score: score });
    }
  }
  if (!candidates.length) return '';
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 4);

  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    try {
      var sh2 = ss.getSheetByName(top[k].brand);
      var lastCol = sh2.getLastColumn();
      var headerVals = sh2.getRange(1, 1, 1, lastCol).getValues()[0];
      var rowVals = sh2.getRange(top[k].row, 1, 1, lastCol).getValues()[0];
      var parts = [];
      for (var c = 0; c < headerVals.length; c++) {
        var h = String(headerVals[c] || '').trim();
        var v = String(rowVals[c] || '').trim();
        if (h && v && !/hinh|image|ảnh/i.test(h)) parts.push(h + ': ' + v);
      }
      var block = '[Hãng: ' + top[k].brand + ']\n' + parts.join('\n');
      if (block.length > 1800) block = block.substring(0, 1800) + '...';
      blocks.push(block);
    } catch (e) { /* bo qua dong loi, khong chan cac dong khac */ }
  }
  return blocks.join('\n\n---\n\n');
}

function callGroqAI_(data) { return callAI_(data); } // alias tuong thich cu

// ═══════════════════════════════════════════════════════════════
//  KIEN THUC TU THU MUC DRIVE (PDF / Google Doc / Google Sheet)
// ═══════════════════════════════════════════════════════════════
// Cau hinh: setSetting_('driveKnowledgeFolderUrl', <link thu muc Drive>) — thu muc phai
// duoc chia se cho tai khoan chay Apps Script nay (hoac "Bat ky ai co lien ket" > Xem).
// File anh trong thu muc bi bo qua o day (chi dung cho "kien thuc" van ban) — gui anh cho
// khach la tinh nang rieng, xem findDriveProductImage_() + _driveImageBase64_() ben duoi
// (da lam, dung chung thu muc nay lam nguon fallback anh khi chua co productSheetUrl/anh rieng).
//
// Cach hoat dong (giong het trieet ly readExternalProductSheet_ o tren — KHONG nhet ca
// thu muc vao 1 prompt vi qua nang/cham/ton phi AI):
//   1) Danh muc luc NHE cho tung file (ten file + tung "doan" van ban ~900 ky tu, kem
//      snippet 300 ky tu de tim kiem) — cache rieng tung file 15 phut.
//   2) Khi co cau hoi, tim cac doan co TU KHOA khop cau hoi khach, xep hang theo so tu khop.
//   3) CHI luc do moi lay lai NGUYEN VAN toi da 4 doan diem cao nhat de dua vao prompt.
//
// PDF: Apps Script co ban KHONG doc duoc chu trong PDF. Ham _extractPdfText_ thu OCR qua
// Drive Advanced Service (Drive.Files.copy voi ocr:true) — CAN BAT truoc trong Apps Script:
// Extensions > Apps Script > Services (dau +) > chon "Drive API" > Add. Neu chua bat, file
// PDF se tu dong bi bo qua (khong loi, khong chan cac file Doc/Sheet khac trong thu muc).
// Cach thay the KHONG can bat gi ca: trong Drive, chuot phai file PDF > Mo bang > Google
// Tai lieu — Drive tu OCR va tao ra 1 Google Doc cung thu muc, ham nay doc duoc Doc do binh
// thuong (khong can Advanced Service).

function _driveFolderIdFromUrl_(url) {
  if (!url) return '';
  var s = String(url).trim();
  var m = s.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s; // CS dan thang ID thay vi URL day du
  return '';
}

// Chia van ban dai thanh cac doan ~chunkLen ky tu, cat theo ranh gioi doan van (xuong dong)
// de khong cat ngang giua cau — dung cho Doc/PDF (khong co cau truc hang/cot nhu Sheet).
function _chunkText_(text, chunkLen) {
  var out = [];
  var paras = String(text || '').split(/\n{1,}/).map(function(p) { return p.trim(); }).filter(Boolean);
  var buf = '';
  for (var i = 0; i < paras.length; i++) {
    if (buf && (buf + '\n' + paras[i]).length > chunkLen) { out.push(buf); buf = paras[i]; }
    else buf = buf ? (buf + '\n' + paras[i]) : paras[i];
  }
  if (buf) out.push(buf);
  return out;
}

function _driveKnowFullTextCacheKey_(fileId) { return 'dkf_full_v1_' + fileId; }

// Cache tam noi dung day du cua 1 file (Doc/PDF) sau khi da doc/OCR 1 lan, de lan sau tra
// lai dung doan (chunk) khop khong phai doc/OCR lai (OCR PDF kha cham va ton quota).
function _cacheDriveKnowFullText_(fileId, text) {
  try {
    if (text && text.length <= 95000) CacheService.getScriptCache().put(_driveKnowFullTextCacheKey_(fileId), text, 900);
  } catch (e) {}
}

// PDF khong co API doc van ban truc tiep trong Apps Script co ban — thu OCR bang Drive
// Advanced Service. Neu chua bat service nay, ham nay se loi va tra ve '' (file bi bo qua,
// khong chan cac file khac).
function _extractPdfText_(fileId) {
  try {
    var tmp = Drive.Files.copy({ title: 'tmp_ocr_' + fileId }, fileId, { ocr: true, ocrLanguage: 'vi' });
    var text = DocumentApp.openById(tmp.id).getBody().getText();
    try { DriveApp.getFileById(tmp.id).setTrashed(true); } catch (ecTrash) {} // dep file OCR tam
    return text || '';
  } catch (e) { return ''; }
}

// Lay dung 1 doan (chunk) da tung duoc index cho 1 file Doc/PDF — uu tien doc tu cache
// full-text, chi doc/OCR lai truc tiep khi cache da het han (hiem, vi cung TTL voi muc luc).
function _driveKnowChunkText_(fileId, kind, chunkIdx, fallbackSnippet) {
  try {
    var full = CacheService.getScriptCache().get(_driveKnowFullTextCacheKey_(fileId));
    if (full !== null) {
      var chunks = _chunkText_(full, 900);
      if (chunks[chunkIdx]) return chunks[chunkIdx];
    }
  } catch (e) {}
  try {
    if (kind === 'doc') {
      var t = DocumentApp.openById(fileId).getBody().getText();
      var cs = _chunkText_(t, 900);
      return cs[chunkIdx] || fallbackSnippet;
    }
    if (kind === 'pdf') {
      var t2 = _extractPdfText_(fileId);
      var cs2 = _chunkText_(t2, 900);
      return cs2[chunkIdx] || fallbackSnippet;
    }
  } catch (e2) {}
  return fallbackSnippet;
}

// Muc luc 1 file trong thu muc kien thuc Drive (cache rieng tung file, 15 phut).
function _driveKnowledgeFileIndex_(file) {
  var fileId = file.getId();
  var idxKey = 'dkf_idx_v1_' + fileId;
  try {
    var cached = CacheService.getScriptCache().get(idxKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}

  var mime = file.getMimeType();
  var name = file.getName();
  var items = []; // {kind, name, tab?, row?, chunkIdx?, snippet}

  try {
    if (mime === MimeType.GOOGLE_DOCS) {
      var text = DocumentApp.openById(fileId).getBody().getText();
      _cacheDriveKnowFullText_(fileId, text);
      var chunks = _chunkText_(text, 900);
      for (var i = 0; i < chunks.length; i++) {
        items.push({ kind: 'doc', name: name, chunkIdx: i, snippet: chunks[i].substring(0, 300) });
      }
    } else if (mime === MimeType.GOOGLE_SHEETS) {
      var ss2 = SpreadsheetApp.openById(fileId);
      var tabs = ss2.getSheets();
      for (var t = 0; t < tabs.length; t++) {
        var tabName = tabs[t].getName();
        var idx = _productSheetIndexForTab_(ss2, tabName);
        for (var r = 0; r < idx.length; r++) {
          items.push({ kind: 'sheet', name: name, tab: tabName, row: idx[r].row, snippet: idx[r].name + ' ' + idx[r].snippet });
        }
      }
    } else if (mime === MimeType.PDF) {
      var pdfText = _extractPdfText_(fileId);
      if (pdfText) {
        _cacheDriveKnowFullText_(fileId, pdfText);
        var chunksP = _chunkText_(pdfText, 900);
        for (var p = 0; p < chunksP.length; p++) {
          items.push({ kind: 'pdf', name: name, chunkIdx: p, snippet: chunksP[p].substring(0, 300) });
        }
      }
    }
    // Anh (jpg/png...) va cac dinh dang khac: bo qua o day — dung cho "kien thuc" van ban.
  } catch (e) { /* file loi/khong doc duoc (chua chia se, dinh dang la...) -> bo qua file nay */ }

  try { CacheService.getScriptCache().put(idxKey, JSON.stringify(items), 900); } catch (ec2) {}
  return items;
}

// Doc toan bo thu muc kien thuc Drive (PDF/Doc/Sheet), khop tu khoa cau hoi khach, tra ve
// toi da 4 doan lien quan nhat de dua vao prompt AI.
function readDriveKnowledgeFolder_(query) {
  var url = getSetting_('driveKnowledgeFolderUrl') || DEFAULT_DRIVE_KNOWLEDGE_FOLDER_URL;
  var folderId = _driveFolderIdFromUrl_(url);
  if (!folderId) return '';

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return '';

  var folder;
  try { folder = DriveApp.getFolderById(folderId); } catch (e) { return ''; } // chua chia se / ID sai

  var files = folder.getFiles();
  var candidates = [];
  var count = 0;
  while (files.hasNext() && count < 40) { // gioi han so file quet 1 lan, tranh cham qua
    var f = files.next(); count++;
    var items = _driveKnowledgeFileIndex_(f);
    for (var i = 0; i < items.length; i++) {
      var hay = _psheetNoAccent_(items[i].name + ' ' + items[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > 0) candidates.push({ fileId: f.getId(), item: items[i], score: score });
    }
  }
  if (!candidates.length) return '';
  candidates.sort(function(a, b) { return b.score - a.score; });
  var top = candidates.slice(0, 4);

  var blocks = [];
  for (var k = 0; k < top.length; k++) {
    var c = top[k];
    var block = '';
    try {
      if (c.item.kind === 'sheet') {
        var ss3 = SpreadsheetApp.openById(c.fileId);
        var sh3 = ss3.getSheetByName(c.item.tab);
        var lastCol = sh3.getLastColumn();
        var headerVals = sh3.getRange(1, 1, 1, lastCol).getValues()[0];
        var rowVals = sh3.getRange(c.item.row, 1, 1, lastCol).getValues()[0];
        var parts = [];
        for (var cc = 0; cc < headerVals.length; cc++) {
          var h = String(headerVals[cc] || '').trim();
          var v = String(rowVals[cc] || '').trim();
          if (h && v && !/hinh|image|ảnh/i.test(h)) parts.push(h + ': ' + v);
        }
        block = '[' + c.item.name + ' — ' + c.item.tab + ']\n' + parts.join('\n');
      } else {
        var seg = _driveKnowChunkText_(c.fileId, c.item.kind, c.item.chunkIdx, c.item.snippet);
        block = '[' + c.item.name + ']\n' + seg;
      }
    } catch (e) { continue; }
    if (block.length > 1500) block = block.substring(0, 1500) + '...';
    blocks.push(block);
  }
  return blocks.join('\n\n---\n\n');
}

// ═══════════════════════════════════════════════════════════════
//  ANH SAN PHAM — doc tu thu muc RIENG driveProductImagesFolderUrl (khac voi
//  driveKnowledgeFolderUrl o tren) vi day thuong la thu muc CHUA CAC THU MUC
//  CON theo tung san pham, vd "Serum AHA 30ml/anh1.jpg". Neu chua cau hinh
//  thu muc rieng nay thi fallback dung tam driveKnowledgeFolderUrl.
//  Quet ca file anh nam THANG trong thu muc goc LAN anh nam trong 1 cap
//  thu muc con (khong quet sau hon 1 cap). So khop dung TEN THU MUC CON (neu
//  co) + TEN FILE voi tu khoa cau hoi khach — khong doc noi dung anh, nen dat
//  ten thu muc con / ten file ro rang (vd thu muc "Serum AHA 30ml") thi AI
//  moi tim dung.
// ═══════════════════════════════════════════════════════════════

// Muc luc NHE cac file anh trong thu muc + 1 cap thu muc con (cache rieng 15
// phut, tach voi muc luc van ban _driveKnowledgeFileIndex_ de khong dam cache).
function _driveImageIndex_(folderId) {
  var cacheKey = 'dkf_img_v2_' + folderId;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached !== null) return JSON.parse(cached);
  } catch (ec) {}

  var out = [];
  try {
    var folder = DriveApp.getFolderById(folderId);

    // 1) Anh nam thang trong thu muc goc (truong hop khong chia theo thu muc con)
    var files = folder.getFiles();
    var count = 0;
    while (files.hasNext() && count < 200) {
      var f = files.next(); count++;
      if (f.getMimeType().indexOf('image/') === 0) {
        out.push({ fileId: f.getId(), tag: f.getName(), name: f.getName() });
      }
    }

    // 2) 1 cap thu muc con — vd moi san pham 1 thu muc rieng chua nhieu anh.
    // Ten thu muc con duoc gop vao 'tag' de so khop (anh ben trong co the dat
    // ten chung chung nhu 1.jpg, IMG_001.jpg...); 'name' hien cho CS lay theo
    // TEN THU MUC (de doc/co nghia hon ten file), lay toi da 3 anh dai dien
    // moi thu muc con la du, khong can liet ke het.
    var subfolders = folder.getFolders();
    var fCount = 0;
    while (subfolders.hasNext() && fCount < 150) {
      var sf = subfolders.next(); fCount++;
      var sfFiles = sf.getFiles();
      var picked = 0;
      while (sfFiles.hasNext() && picked < 3) {
        var sf_f = sfFiles.next();
        if (sf_f.getMimeType().indexOf('image/') === 0) {
          out.push({ fileId: sf_f.getId(), tag: sf.getName() + ' ' + sf_f.getName(), name: sf.getName() });
          picked++;
        }
      }
    }
  } catch (e) { /* chua chia se / ID sai -> danh sach rong, khong chan cac tinh nang khac */ }

  try { CacheService.getScriptCache().put(cacheKey, JSON.stringify(out), 900); } catch (ec2) {}
  return out;
}

// Nhan 1 link Drive (FILE hoac FOLDER, nhieu dinh dang khac nhau tuy cach copy-share
// cua Drive) va tra ve 1 anh dai dien {fileId, name}. La FILE anh -> dung luon. La
// FOLDER -> lay anh dau tien tim thay ben trong. Tra ve null neu khong doc duoc/khong
// phai anh.
function _driveImageFromLink_(link) {
  var s = String(link || '').trim();
  if (!s) return null;

  var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) || s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  var fileId = m ? m[1] : null;
  if (fileId) {
    try {
      var f = DriveApp.getFileById(fileId);
      if (f.getMimeType().indexOf('image/') === 0) return { fileId: f.getId(), name: f.getName() };
    } catch (e) {}
  }

  var folderId = _driveFolderIdFromUrl_(s);
  if (folderId) {
    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      while (files.hasNext()) {
        var ff = files.next();
        if (ff.getMimeType().indexOf('image/') === 0) return { fileId: ff.getId(), name: ff.getName() };
      }
    } catch (e2) {}
    if (!fileId) { // la bare ID nhung khong phai folder -> co the la fileId, thu lai truoc khi bo cuoc
      try {
        var f2 = DriveApp.getFileById(folderId);
        if (f2.getMimeType().indexOf('image/') === 0) return { fileId: f2.getId(), name: f2.getName() };
      } catch (e3) {}
    }
  }
  return null;
}

// Tim anh gan DUNG voi dong san pham dang khop nhat trong Sheet ngoai
// (productSheetUrl) — chinh xac hon so ten thu muc vi bam theo DUNG dong/
// variant (vd dung Kieu/Size) dang tra loi khach. Doc lai cot co tieu de chua
// "hinh/image/ảnh" (dung chinh quy tac da dung de LOAI cot nay khoi prompt
// van ban o readExternalProductSheet_) — CS dan link Drive (file hoac folder)
// vao do la dung duoc ngay, khong can sua code khi dien them dong moi.
function findProductSheetImage_(query) {
  var url = getSetting_('productSheetUrl') || DEFAULT_PRODUCT_SHEET_URL;
  if (!url) return null;
  var ss;
  try { ss = SpreadsheetApp.openByUrl(url); } catch (e) { return null; }

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return null;

  var tabNames = ss.getSheets().map(function(s) { return s.getName(); });
  var bestTab = null, bestRow = 0, bestScore = 0;
  for (var t = 0; t < tabNames.length; t++) {
    var idx = _productSheetIndexForTab_(ss, tabNames[t]);
    for (var i = 0; i < idx.length; i++) {
      var hay = _psheetNoAccent_(idx[i].name + ' ' + idx[i].snippet);
      var score = 0;
      for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
      if (score > bestScore) { bestScore = score; bestTab = tabNames[t]; bestRow = idx[i].row; }
    }
  }
  if (!bestTab) return null;

  try {
    var sh = ss.getSheetByName(bestTab);
    var lastCol = sh.getLastColumn();
    var headerVals = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowVals = sh.getRange(bestRow, 1, 1, lastCol).getValues()[0];
    var imgCol = -1;
    for (var c = 0; c < headerVals.length; c++) {
      if (/hinh|image|ảnh/i.test(String(headerVals[c] || ''))) { imgCol = c; break; }
    }
    if (imgCol === -1) return null;
    return _driveImageFromLink_(rowVals[imgCol]);
  } catch (e2) { return null; }
}

// Tim 1 anh san pham phu hop voi cau hoi khach — 2 nguon, thu lan luot:
// 1) Link anh dien truc tiep trong dong Sheet san pham dang khop (chinh xac
//    nhat — xem findProductSheetImage_).
// 2) Fallback: thu muc anh rieng (driveProductImagesFolderUrl), so ten thu
//    muc con + ten file — dung cho san pham CHUA kip dien link vao Sheet.
// Tra ve {fileId, name} hoac null neu ca 2 nguon deu khong khop.
function findDriveProductImage_(query) {
  var fromSheet = findProductSheetImage_(query);
  if (fromSheet) return fromSheet;

  var url = getSetting_('driveProductImagesFolderUrl') || DEFAULT_DRIVE_PRODUCT_IMAGES_FOLDER_URL
    || getSetting_('driveKnowledgeFolderUrl') || DEFAULT_DRIVE_KNOWLEDGE_FOLDER_URL;
  var folderId = _driveFolderIdFromUrl_(url);
  if (!folderId) return null;

  var qWords = _psheetNoAccent_(query).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(function(w) { return w.length >= 3 && _PSHEET_STOPWORDS_.indexOf(w) === -1; });
  if (!qWords.length) return null;

  var images = _driveImageIndex_(folderId);
  if (!images.length) return null;

  var best = null, bestScore = 0;
  for (var i = 0; i < images.length; i++) {
    var hay = _psheetNoAccent_(images[i].tag);
    var score = 0;
    for (var w = 0; w < qWords.length; w++) { if (hay.indexOf(qWords[w]) !== -1) score++; }
    if (score > bestScore) { bestScore = score; best = images[i]; }
  }
  return best;
}

// Doc noi dung anh ra base64 de gui thang trong cung response voi cau tra loi AI —
// KHONG doi quyen chia se cua file, chi doc byte qua tai khoan dang chay Apps Script.
// Gioi han ~3MB de tranh payload qua nang lam cham/loi ca response; anh qua lon se
// tra ve null (van tra loi text binh thuong, chi thieu anh) thay vi lam hong tat ca.
var _DRIVE_IMG_MAX_BYTES_ = 3 * 1024 * 1024;
function _driveImageBase64_(fileId) {
  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    var bytes = blob.getBytes();
    if (bytes.length > _DRIVE_IMG_MAX_BYTES_) return null;
    return { base64: Utilities.base64Encode(bytes), mimeType: blob.getContentType() };
  } catch (e) { return null; }
}

// ─── Prompt he thong: kien thuc san pham CHI nap khi CS bat "Tra cuu san pham" ───
function _buildAISystemPrompt_(userMsg, withProducts) {
  var ctx = readAIContext_();
  var trunc_ = function(str, n) { return str && str.length > n ? str.substring(0, n) + '...' : str; };
  var parts = [];
  parts.push(ctx.systemPrompt || 'Ban la chuyen vien cham soc khach hang. Tra loi bang tieng Viet, than thien, ngan gon.');
  if (ctx.careProcess)    parts.push('\n\nQUY TRINH CSKH:\n'    + trunc_(ctx.careProcess, 600));
  if (ctx.callbackScript) parts.push('\n\nKICH BAN GOI LAI:\n'  + trunc_(ctx.callbackScript, 500));
  if (ctx.salesScriptCu)  parts.push('\n\nKICH BAN KHACH CU:\n' + trunc_(ctx.salesScriptCu, 500));
  if (ctx.salesScriptMoi) parts.push('\n\nKICH BAN KHACH MOI:\n'+ trunc_(ctx.salesScriptMoi, 500));
  // Chi nap kien thuc san pham (nang) khi CS chu dong bat "Tra cuu san pham" -> giu prompt nhe, tranh 429
  if (withProducts) {
    if (ctx.products.length > 0) parts.push('\n\nSAN PHAM:\n' + ctx.products.slice(0, 12).join('\n'));
    if (ctx.faqs.length > 0)     parts.push('\n\nFAQ:\n'          + ctx.faqs.slice(0, 4).join('\n'));
    if (ctx.combos.length > 0)   parts.push('\n\nMAU TIN NHAN:\n' + ctx.combos.slice(0, 5).join('\n'));
    var ext = readExternalProductSheet_(userMsg);
    if (ext) parts.push('\n\nTHONG TIN CHI TIET SAN PHAM / THANH PHAN (nguon: Google Sheet rieng cua team, khop tu khoa trong yeu cau — uu tien dung khi tra loi ve thanh phan/cong dung cu the):\n' + ext);
    var driveKnow = readDriveKnowledgeFolder_(userMsg);
    if (driveKnow) parts.push('\n\nKIEN THUC TU THU MUC DRIVE (PDF/Doc/Sheet cua team, khop tu khoa cau hoi — uu tien dung cho cau hoi ve tai lieu/kien thuc san pham chi tiet):\n' + driveKnow);
  }
  // Q&A tu sheet FAQ (khop tu khoa cau hoi khach) — de AI hoc cach xu ly cau hoi kho theo team
  var faq = readFaqSheet_(userMsg);
  if (faq) parts.push('\n\nCAC CAU HOI KHO & CACH TRA LOI MAU CUA TEAM (uu tien bam sat cach xu ly / giong dieu nay khi tra loi cau tuong tu; dieu chinh cho hop ngu canh khach, KHONG copy nguyen van neu khong khop hoan toan):\n' + faq);
  // CTKM: chi nap khi cau hoi cua khach co tu khoa khuyen mai/giam gia (xem readCTKMPromotions_)
  var ctkm = readCTKMPromotions_(userMsg);
  if (ctkm) parts.push('\n\nCHUONG TRINH KHUYEN MAI (CTKM) DANG AP DUNG (chi dung khi khach hoi ve khuyen mai/giam gia, KHONG tu bia them neu khong co trong danh sach nay):\n' + ctkm);
  // ── BANG GIA: cac bien the (chat lieu/size/gia) cua san pham duoc nhac toi ──
  var priceInfo = _priceVariantsForPrompt_(userMsg);
  var hasMultiVariant = false;
  if (priceInfo) {
    hasMultiVariant = priceInfo.split('\n').filter(function (l) { return l.indexOf('- Chất liệu:') === 0; }).length > 1;
    parts.push('\n\nBANG GIA CHINH THUC (nguon: Sheet DANH_MUC cua team — CHI dung so lieu trong day, TUYET DOI KHONG tu bia gia hay tu suy ra gia khac):\n' + priceInfo);
    parts.push('\n\nQUY TAC BAO GIA:\n' +
      '- Neu sale/khach DA noi ro chat lieu va size: chi bao dung 1 muc gia khop nhat.\n' +
      '- Neu KHONG ghi ro chat lieu hoac size: PHAI liet ke DAY DU TAT CA cac truong hop tim thay o tren, moi dong ghi ro chat lieu + kieu/size + gia tuong ung, roi hoi lai khach muon loai nao. KHONG duoc tu chon 1 muc gia roi bo qua cac muc con lai.\n' +
      '- Gia trong bang tinh bang NGHIN VND (vd 2.310 = 2.310.000d). Khi bao gia cho khach hay quy ra dong cho de hieu.\n' +
      '- Ve loai da (SAPHIA/RUBY): bang gia o tren DA duoc loc san dung theo yeu cau — neu khach/sale KHONG nhac SAPHIA hay RUBY thi bang chi con gia MAC DINH (cot G), cu the vay ma bao, KHONG tu suy dien hay hoi lai ve loai da. Neu co nhac SAPHIA/RUBY thi bang chi con dung gia loai da do, neu ro do la gia loai da tuong ung.');
  }
  if (hasMultiVariant) {
    parts.push('\n\nYEU CAU: Tra loi bang tieng Viet, than thien. Vi co NHIEU lua chon chat lieu/size, hay liet ke DU cac lua chon (moi lua chon 1 dong ngan: chat lieu - size - gia), sau do hoi khach chon loai nao. Khong dai dong ngoai phan bao gia.');
  } else {
    parts.push('\n\nYEU CAU: Chi dua ra DUY NHAT 1 cau tra loi ngan gon (toi da 150 tu). Khong danh so, khong giai thich them.');
  }
  return parts.join('');
}

// ─── Goi provider dang OpenAI-compatible (Groq, Cerebras) ───
function _aiOpenAICompat_(prov, sys, userMsg) {
  try {
    var res = UrlFetchApp.fetch(prov.url, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + prov.key },
      contentType: 'application/json',
      payload: JSON.stringify({
        model: prov.model,
        messages: [ { role: 'system', content: sys }, { role: 'user', content: userMsg } ],
        temperature: 0.7, max_tokens: 400
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode(), txt = res.getContentText();
    if (code !== 200) return { ok: false, error: code + ' ' + txt.substring(0, 200) };
    var d = JSON.parse(txt);
    var t = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return { ok: true, text: t || '' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─── Goi Gemini (dinh dang rieng cua Google) ───
function _aiGemini_(prov, sys, userMsg) {
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + prov.model + ':generateContent?key=' + encodeURIComponent(prov.key);
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({
        systemInstruction: { parts: [ { text: sys } ] },
        contents: [ { role: 'user', parts: [ { text: userMsg } ] } ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode(), txt = res.getContentText();
    if (code !== 200) return { ok: false, error: code + ' ' + txt.substring(0, 200) };
    var d = JSON.parse(txt);
    var t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
    return { ok: true, text: t || '' };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ─── AI da nha cung cap: Groq -> Cerebras -> Gemini (dung cai nao co key & tra loi duoc) ───
function callAI_(data) {
  var userMsg = data.prompt || '';
  if (!userMsg) return jsonOut_({ error: 'Thieu noi dung' });
  var withProducts = !!data.withProducts;
  var sys = _buildAISystemPrompt_(userMsg, withProducts);

  // LUU Y (2026-09-13): llama-3.3-70b-versatile bi Groq NGUNG HO TRO tu 16/8/2026
  // (model_decommissioned) va gemini-2.0-flash bi Google NGUNG HO TRO tu 1/6/2026
  // (404) — day la ly do CA 2 provider cung loi dong loat, khong phai do sai key.
  // Doi sang model con duoc ho tro: openai/gpt-oss-120b (Groq, model san xuat hien
  // tai) va gemini-flash-latest (alias Google tu dong tro ve ban Flash on dinh moi
  // nhat, tranh phai sua code moi khi Google lai ngung ho tro 1 phien ban cu the).
  var providers = [
    { name: 'Groq',       setting: 'apiGroq',       key: getSetting_('apiGroq') || getSetting_('geminiKey'), fn: _aiOpenAICompat_, url: 'https://api.groq.com/openai/v1/chat/completions',        model: 'openai/gpt-oss-120b' },
    { name: 'Cerebras',   setting: 'apiCerebras',   key: getSetting_('apiCerebras'),                         fn: _aiOpenAICompat_, url: 'https://api.cerebras.ai/v1/chat/completions',           model: 'gpt-oss-120b' },
    { name: 'Gemini',     setting: 'apiGemini',     key: getSetting_('apiGemini'),                           fn: _aiGemini_,       model: 'gemini-flash-latest' },
    { name: 'OpenRouter', setting: 'apiOpenRouter', key: getSetting_('apiOpenRouter'),                       fn: _aiOpenAICompat_, url: 'https://openrouter.ai/api/v1/chat/completions',         model: 'google/gemma-2-9b-it:free' }
  ];

  var errors = [], missing = [], anyKey = false;
  for (var i = 0; i < providers.length; i++) {
    var pv = providers[i];
    if (!pv.key) { missing.push(pv.name + ' (thieu o Settings: ' + pv.setting + ')'); continue; }
    anyKey = true;
    var r = pv.fn(pv, sys, userMsg);
    if (r.ok && r.text) {
      var out = { ok: true, text: r.text, provider: pv.name };
      // Chi tim anh khi CS bat "Tra cuu san pham" (cung dieu kien voi kien thuc Drive/Sheet
      // o tren) — loi o buoc tim/doc anh se bi nuot, khong lam hong cau tra loi text.
      if (withProducts) {
        try {
          var img = findDriveProductImage_(userMsg);
          if (img) {
            var imgData = _driveImageBase64_(img.fileId);
            if (imgData) out.image = { name: img.name, base64: imgData.base64, mimeType: imgData.mimeType };
            else out.imageSkipped = { name: img.name, reason: 'too_large' }; // khop ten nhung qua 3MB — bao client thay vi im lang bo qua
          }
        } catch (eImg) {}
      }
      return jsonOut_(out);
    }
    // Kem theo dau key dang dung (da che) de phan biet ngay 2 truong hop rat de nham:
    // key SAI vs key DUNG nhung het quota/het han — truoc day chi thay "401" nen kho doan.
    errors.push(pv.name + ' [' + _maskKey_(pv.key) + ']: ' + (r.error || 'rong'));
  }
  if (!anyKey) {
    return jsonOut_({ error: 'Chua co API Key nao trong sheet Settings. Mo extension → banh rang ⚙ → nhap it nhat 1 key (Groq/Cerebras/Gemini/OpenRouter) roi bam Luu. Thieu: ' + missing.join(', ') });
  }
  var msg = 'Tat ca API deu loi: ' + errors.join(' | ');
  if (missing.length) msg += ' || Chua cau hinh: ' + missing.join(', ');
  return jsonOut_({ error: msg });
}

// Che API key khi dua vao thong bao loi/chan doan: chi giu dau va duoi de doi chieu voi key
// tren trang nha cung cap, khong bao gio lo nguyen key ra man hinh/log.
function _maskKey_(k) {
  k = String(k || '');
  if (!k) return 'trong';
  if (k.length <= 12) return k.substring(0, 3) + '***';
  return k.substring(0, 6) + '***' + k.substring(k.length - 4) + ' (' + k.length + ' ky tu)';
}

// ═══════════════════════════════════════════════════════════════
//  CHAN DOAN API KEY — chay truc tiep trong Apps Script Editor
//  (Chon ham diagApiKeys > bam Run > xem tab Execution log)
//  Bao cho biet: sheet Settings dang giu key nao, dai bao nhieu, co dinh khoang trang
//  khong, va goi thu tung nha cung cap de biet chinh xac cai nao song cai nao chet.
// ═══════════════════════════════════════════════════════════════
function diagApiKeys() {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_SET);
  Logger.log('Spreadsheet dang dung: ' + ss.getName() + ' (' + ss.getId() + ')');
  if (!sh) { Logger.log('!! KHONG TIM THAY sheet "' + SH_SET + '" -> moi key deu rong.'); return; }

  var names = ['apiGroq', 'apiCerebras', 'apiGemini', 'apiOpenRouter'];
  var raw = sh.getDataRange().getValues();
  Logger.log('--- Gia tri THO trong sheet Settings ---');
  names.forEach(function (n) {
    var found = null;
    for (var i = 1; i < raw.length; i++) if (String(raw[i][0]).trim() === n) { found = raw[i][1]; break; }
    if (found === null) { Logger.log(n + ': (KHONG CO DONG NAY trong sheet)'); return; }
    var s = String(found);
    Logger.log(n + ': ' + _maskKey_(s.trim()) +
      (s !== s.trim() ? '  <-- CO KHOANG TRANG/XUONG DONG THUA (da tu cat khi dung)' : ''));
  });

  Logger.log('--- Goi thu tung nha cung cap ---');
  var tests = [
    { name: 'Groq',       key: getSetting_('apiGroq') || getSetting_('geminiKey'), fn: _aiOpenAICompat_, url: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b' },
    { name: 'Cerebras',   key: getSetting_('apiCerebras'),   fn: _aiOpenAICompat_, url: 'https://api.cerebras.ai/v1/chat/completions', model: 'gpt-oss-120b' },
    { name: 'Gemini',     key: getSetting_('apiGemini'),     fn: _aiGemini_,       model: 'gemini-flash-latest' },
    { name: 'OpenRouter', key: getSetting_('apiOpenRouter'), fn: _aiOpenAICompat_, url: 'https://openrouter.ai/api/v1/chat/completions', model: 'google/gemma-2-9b-it:free' }
  ];
  tests.forEach(function (t) {
    if (!t.key) { Logger.log(t.name + ': CHUA CO KEY -> bo qua'); return; }
    var r = t.fn(t, 'Ban la tro ly. Tra loi that ngan.', 'Noi "ok"');
    Logger.log(t.name + ' [' + _maskKey_(t.key) + ']: ' + (r.ok ? 'OK — ' + String(r.text).substring(0, 40) : 'LOI — ' + r.error));
  });
}


// ═══════════════════════════════════════════════════════════════
//  testScript — chay 1 lan de tao sheet + kiem tra
// ═══════════════════════════════════════════════════════════════
function testScript() {
  getSheet_(SH_CARE, CARE_HEADERS);
  getSheet_(SH_TEAM, TEAM_HEADERS);
  getSheet_(SH_AUDIT, AUDIT_HEADERS);
  getSheet_(SH_SET, SET_HEADERS);
  getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  getSheet_(SH_USER, USER_HEADERS);
  getSheet_(SH_PK_STATS, PK_STATS_HEADERS);
  getSheet_(SH_PK_MAP, PK_MAP_HEADERS);
  var oss = getOrderSS_();
  for (var i = 0; i < ORDER_SHEETS.length; i++) {
    var _s = oss.getSheetByName(ORDER_SHEETS[i].name) || oss.insertSheet(ORDER_SHEETS[i].name);
    if (_s.getLastRow() === 0) _s.appendRow(ORDER_HEADERS);
  }
  var ss   = getCrmSS_();
  var oss2 = getOrderSS_();
  var log  = 'OK v12.0 - CareData:' + ss.getSheetByName(SH_CARE).getLastRow();
  for (var j = 0; j < ORDER_SHEETS.length; j++) {
    var sh = oss2.getSheetByName(ORDER_SHEETS[j].name);
    log += ' | ' + ORDER_SHEETS[j].name + ':' + (sh ? sh.getLastRow() : 'missing');
  }
  Logger.log(log);
  var testLookup = findCareByPhone_('0978000000');
  Logger.log('Test lookup: ' + JSON.stringify(testLookup));
}

// ═══════════════════════════════════════════════════════════════
//  BROADCAST — Gui tin hang loat qua Zalo (ZaloAI extension) — v13.1
//  Luu 1 sheet "Broadcasts": moi hang la 1 chien dich
//  Anh dinh kem duoc upload len 1 folder Google Drive rieng (xem BROADCAST_FOLDER_ID)
// ═══════════════════════════════════════════════════════════════
var SH_BROADCAST = 'Broadcasts';
var BROADCAST_HEADERS = ['id','label','message','imagesJson','phonesJson','sentJson','csName','createdAt','status','expectedNick','perPhoneMsgJson','perPhoneNickJson'];

// ⚠️ BAT BUOC: tao 1 folder rieng trong Google Drive de luu anh chien dich,
//    mo folder -> copy ID trong URL (phan sau /folders/) -> dan vao day.
//    Nho: folder do se duoc set quyen "Anyone with link" cho tung anh khi upload.
var BROADCAST_FOLDER_ID = '1q4uoHhjmf1yfUjHoYLPAjcNWkr4Ue2J8';

function getBroadcastSheet_() {
  return getSheet_(SH_BROADCAST, BROADCAST_HEADERS);
}

function readBroadcasts_() {
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, BROADCAST_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[0]) continue;
    var images = [], phones = [], sent = {}, perPhoneMsg = {}, perPhoneNick = {};
    try { images = JSON.parse(r[3] || '[]'); } catch (e) {}
    try { phones = JSON.parse(r[4] || '[]'); } catch (e) {}
    try { sent = JSON.parse(r[5] || '{}'); } catch (e) {}
    try { perPhoneMsg = JSON.parse(r[10] || '{}'); } catch (e) {}
    try { perPhoneNick = JSON.parse(r[11] || '{}'); } catch (e) {}
    out.push({
      id: r[0], label: r[1], message: r[2],
      images: images, phones: phones, sent: sent,
      csName: r[6], createdAt: r[7], status: r[8] || 'active',
      expectedNick: r[9] || '', perPhoneMsg: perPhoneMsg, perPhoneNick: perPhoneNick
    });
  }
  return out;
}

// Tao moi hoac cap nhat 1 chien dich (giu nguyen sentJson neu da co, tru khi truyen kem)
function saveBroadcast_(b) {
  if (!b || !b.phones || !b.phones.length) return jsonOut_({ ok: false, error: 'Thieu danh sach SDT' });
  var sh = getBroadcastSheet_();
  var id = b.id || ('bc_' + Date.now());
  var last = sh.getLastRow();
  var foundRow = -1, existingSent = {};
  if (last >= 2) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {
        foundRow = i + 2;
        try { existingSent = JSON.parse(sh.getRange(foundRow, 6).getValue() || '{}'); } catch (e) {}
        break;
      }
    }
  }
  var sentMap = b.sent || existingSent || {};
  var row = [
    id, b.label || '', b.message || '',
    JSON.stringify(b.images || []),
    JSON.stringify(b.phones || []),
    JSON.stringify(sentMap),
    b.csName || '',
    b.createdAt || new Date().toISOString(),
    b.status || 'active',
    b.expectedNick || '',
    JSON.stringify(b.perPhoneMsg || {}),
    JSON.stringify(b.perPhoneNick || {})
  ];
  if (foundRow > 0) sh.getRange(foundRow, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true, id: id });
}

// Danh dau 1 SDT la da gui / loi / bo qua trong 1 chien dich cu the
function broadcastMark_(id, phone, status) {
  if (!id || !phone) return jsonOut_({ ok: false, error: 'Thieu id/phone' });
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonOut_({ ok: false, error: 'Chua co chien dich nao' });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      var rowIdx = i + 2;
      var sent = {};
      try { sent = JSON.parse(sh.getRange(rowIdx, 6).getValue() || '{}'); } catch (e) {}
      sent[normPhone_(phone)] = { status: status || 'sent', ts: new Date().toISOString() };
      sh.getRange(rowIdx, 6).setValue(JSON.stringify(sent));
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ ok: false, error: 'Khong tim thay chien dich' });
}

// Danh sach chien dich dang active + cac SDT CHUA gui, loc theo CS dang dung extension
// (neu chien dich khong gan csName cu the thi hien cho tat ca CS)
function broadcastQueueForCS_(csName) {
  var all = readBroadcasts_().filter(function (b) {
    var st = b.status || 'active';
    return st === 'active' || st === 'paused';
  });
  // CS cham soc tung khach (CareData) -> extension chi gui khach cua CS dang chon
  var csMap = {};
  try {
    var careRowsQ = readCare_(getCrmSS_().getSheetByName(SH_CARE));
    for (var cqi = 0; cqi < careRowsQ.length; cqi++) {
      csMap[normPhone_(careRowsQ[cqi].phone)] = String(careRowsQ[cqi].cs || '').trim().toLowerCase();
    }
  } catch (e) {}
  var out = [];
  all.forEach(function (b) {
    if (csName && b.csName) {
      var csList = String(b.csName).toLowerCase().split(',').map(function(x){ return x.trim(); }).filter(String);
      if (csList.length && csList.indexOf(String(csName).toLowerCase().trim()) === -1) return;
    }
    var pending = (b.phones || []).filter(function (p) {
      var np = normPhone_(p);
      return !b.sent || !b.sent[np];
    });
    if (pending.length) {
      out.push({
        id: b.id, label: b.label, message: b.message, images: b.images,
        pendingPhones: pending,
        total: b.phones.length,
        doneCount: b.phones.length - pending.length,
        status: b.status || 'active',
        createdAt: b.createdAt || '',
        expectedNick: b.expectedNick || '',
        perPhoneMsg: b.perPhoneMsg || {},
        perPhoneNick: b.perPhoneNick || {},
        perPhoneCS: (function () {
          var m = {};
          for (var pqi = 0; pqi < pending.length; pqi++) m[pending[pqi]] = csMap[pending[pqi]] || '';
          return m;
        })()
      });
    }
  });
  return out;
}

// Upload 1 anh (base64) len Drive folder rieng, set quyen xem cong khai qua link, tra ve URL
function uploadBroadcastImage_(base64, filename, mimeType) {
  if (!base64) return jsonOut_({ ok: false, error: 'Thieu du lieu anh' });
  var folder;
  try { folder = DriveApp.getFolderById(BROADCAST_FOLDER_ID); }
  catch (e) { return jsonOut_({ ok: false, error: 'Chua cau hinh dung BROADCAST_FOLDER_ID (xem comment dau ham)' }); }
  try {
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', filename || ('img_' + Date.now() + '.jpg'));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var directUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
    return jsonOut_({ ok: true, url: directUrl, fileId: file.getId() });
  } catch (e) {
    return jsonOut_({ ok: false, error: e.message });
  }
}

// Huy 1 chien dich (khong xoa du lieu, chi doi status de extension ngung lay ve)
function broadcastSetStatus_(id, status) {
  if (!id) return jsonOut_({ ok: false, error: 'Thieu id' });
  status = (status === 'paused') ? 'paused' : 'active';
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonOut_({ ok: false, error: 'Chua co chien dich' });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) { sh.getRange(i + 2, 9).setValue(status); return jsonOut_({ ok: true, status: status }); }
  }
  return jsonOut_({ ok: false, error: 'Khong tim thay chien dich' });
}

function broadcastCancel_(id) {
  var sh = getBroadcastSheet_();
  var last = sh.getLastRow();
  if (last < 2) return jsonOut_({ ok: false });
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) { sh.getRange(i + 2, 9).setValue('cancelled'); return jsonOut_({ ok: true }); }
  }
  return jsonOut_({ ok: false, error: 'Khong tim thay chien dich' });
}

// ═══════════════════════════════════════════════════════════════
//  HOI THAM TU DONG THEO NGAY MUA (Follow-up scheduler)
//  - Doi chieu OrderData (uu tien) + ZaloContactScan (du phong, doc tu
//    ten hien thi Zalo do CS dat theo cu phap: "6+7 HH Ten khach, SDT")
//  - Cac moc ngay + noi dung tin theo tung san pham duoc cau hinh trong
//    sheet "FollowUpTemplates" (tu quan ly, khong can sua code):
//      cot A productCode | cot B days | cot C template
//      VD: HH | 7 | "Chao {name}, {name} dung Healthouse duoc 7 ngay roi..."
//    Placeholder ho tro trong template: {name} {phone} {days} {product}
//  - Chay 1 lan/ngay qua Time-driven Trigger goi runFollowUpScan (xem
//    huong dan setup trigger o cuoi file)
// ═══════════════════════════════════════════════════════════════
var SH_FU_TEMPLATE = 'FollowUpTemplates';
var FU_TEMPLATE_HEADERS = ['productCode', 'days', 'template', 'cs'];
var SH_FU_LOG = 'FollowUpLog';
var FU_LOG_HEADERS = ['phone', 'orderKey', 'days', 'sentAt', 'source'];
var SH_ZALO_SCAN = 'ZaloContactScan';
var ZALO_SCAN_HEADERS = ['phone', 'rawName', 'nameGuess', 'orderDateGuess', 'productCodeGuess', 'scannedAt', 'scannedBy'];
var FU_CHECKPOINTS = [7, 14, 30, 60]; // ngay: 7, 14, 1 thang, 2 thang
// Chi hoi tham khach mua tu 5/2026 tro di (don cu hon bo qua hoan toan)
var FU_START = new Date(2026, 4, 1); // thang 5/2026 (thang tinh tu 0)
// Chi hoi tham khach den tu cac nguon nay (so khop chua-chuoi, khong phan biet hoa thuong).
// Don hang nguon khac (KH Renew, Data Dao...) KHONG gui hoi tham tu dong.
var FU_SOURCES = ['landipage', 'landing', 'messenger', 'mess', 'web'];
function fuSourceAllowed_(source) {
  var sl = String(source || '').toLowerCase();
  if (!sl) return false;
  for (var i = 0; i < FU_SOURCES.length; i++) {
    if (sl.indexOf(FU_SOURCES[i]) !== -1) return true;
  }
  return false;
}

// Bang quy doi ten/viet tat san pham -> ma san pham chuan (dung chung cho
// OrderData.product/productDetail VA ten hien thi Zalo do CS dat).
// DAY LA BANG DU PHONG (dung khi sheet "Mã Zalo" chua co/chua doc duoc).
// Nguon chinh la sheet "Mã Zalo" (muc 2 - Bảng mã sản phẩm) trong file CareData —
// sua/them ma san pham moi thi sua truc tiep trong Sheet, KHONG can sua code.
var PRODUCT_CODE_MAP_ = [
  ['HH',  ['hh', 'healthouse']],
  ['CF',  ['cf', 'cafe', 'ca phe', 'càphê', 'cà phê']],
  ['M9',  ['m9', 'make9', 'make 9']],
  ['LV',  ['lv', 'louisviel']],
  ['TEA', ['tea', 'tb', 'trà', 'tra']],
  ['VIK', ['vik', 'vi kim', 'vikim', 'fractional', 'fractional cc']],
  ['EVE', ['eve', 'every', 'every routine']],
  ['RS',  ['rs', 'reason']],
  ['DA',  ['da', 'dear', 'dearglam']]
];

// Doc bang mo rong tu sheet "Mã Zalo" (muc 2 - "Bảng mã sản phẩm"):
// tim dong tieu de co chua "Mã chuẩn hoá", doc cac dong ngay sau do
// (cot A = Mã viết tắt, cot B = Tên đầy đủ, cot C = Mã chuẩn hoá) cho den
// khi het du lieu. Tra ve null neu khong tim thay sheet/bang (de goi noi
// dung fallback ve PRODUCT_CODE_MAP_).
function readProductCodeMapFromSheet_() {
  try {
    var ss = getCrmSS_();
    var sh = ss.getSheetByName('Mã Zalo');
    if (!sh || sh.getLastRow() < 2) return null;
    var vals = sh.getDataRange().getValues();
    var headerRow = -1;
    for (var i = 0; i < vals.length; i++) {
      for (var j = 0; j < vals[i].length; j++) {
        if (String(vals[i][j]).indexOf('Mã chuẩn hoá') !== -1) { headerRow = i; break; }
      }
      if (headerRow !== -1) break;
    }
    if (headerRow === -1) return null;
    var map = [];
    for (var r = headerRow + 1; r < vals.length; r++) {
      var abbrevRaw = String(vals[r][0] || '').trim();
      var fullName = String(vals[r][1] || '').trim();
      var code = String(vals[r][2] || '').trim().toUpperCase();
      if (!abbrevRaw || !code) break; // het du lieu bang nay / gap section khac
      var kws = abbrevRaw.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      if (fullName && kws.indexOf(fullName.toLowerCase()) === -1) kws.push(fullName.toLowerCase());
      map.push([code, kws]);
    }
    return map.length ? map : null;
  } catch (e) { return null; }
}

// Cache trong 1 lan chay (tranh doc lai Sheet nhieu lan khi loop hang ngan don hang)
var _productCodeMapCache_ = null;
function getProductCodeMap_() {
  if (_productCodeMapCache_) return _productCodeMapCache_;
  var dyn = readProductCodeMapFromSheet_();
  _productCodeMapCache_ = (dyn && dyn.length) ? dyn : PRODUCT_CODE_MAP_;
  return _productCodeMapCache_;
}

function productCodeFromText_(text, map) {
  if (!text) return '';
  var m = map || getProductCodeMap_();
  var up = String(text).toLowerCase();
  for (var i = 0; i < m.length; i++) {
    var code = m[i][0], kws = m[i][1];
    for (var j = 0; j < kws.length; j++) {
      if (up.indexOf(kws[j]) !== -1) return code;
    }
  }
  return '';
}

// Doc bang mau tin: { 'HH|7': 'template...', 'CF|14': '...', ... }
// Ma san pham '*' dung lam mau mac dinh cho moi san pham o moc ngay do.
function readFollowUpTemplates_() {
  var sh = getSheet_(SH_FU_TEMPLATE, FU_TEMPLATE_HEADERS);
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, FU_TEMPLATE_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    var code = String(vals[i][0] || '').trim().toUpperCase();
    var days = String(vals[i][1] || '').trim();
    var tpl = String(vals[i][2] || '').trim();
    var cs = String(vals[i][3] || '').trim().toLowerCase();
    if (!days || !tpl) continue;
    // Ma SP ho tro NHIEU ma cach nhau dau phay: "CF,TEA" -> ap dung cung mau cho ca CF va TEA
    var codeList = code.split(',').map(function (c) { return c.trim(); }).filter(String);
    if (!codeList.length) codeList = ['*'];
    for (var ci2 = 0; ci2 < codeList.length; ci2++) {
      // key co CS: "HH|7|duyenht"; mau chung: "HH|7"
      map[codeList[ci2] + '|' + days + (cs ? '|' + cs : '')] = tpl;
    }
  }
  return map;
}

// Danh sach dang mang (cho UI Sasum sua truc tiep)
function listFollowUpTemplates_() {
  var sh = getSheet_(SH_FU_TEMPLATE, FU_TEMPLATE_HEADERS);
  var last = sh.getLastRow();
  var out = [];
  if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, FU_TEMPLATE_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (!String(vals[i][1] || '').trim()) continue;
    out.push({
      productCode: String(vals[i][0] || '').trim().toUpperCase(),
      days: String(vals[i][1] || '').trim(),
      template: String(vals[i][2] || ''),
      cs: String(vals[i][3] || '').trim().toLowerCase()
    });
  }
  return out;
}

// Ghi de toan bo bang mau tin (UI Sasum gui len danh sach day du sau khi sua)
function saveFollowUpTemplates_(list) {
  if (!Array.isArray(list)) return jsonOut_({ error: 'templates phai la mang' });
  var sh = getSheet_(SH_FU_TEMPLATE, FU_TEMPLATE_HEADERS);
  sh.clearContents();
  var matrix = [FU_TEMPLATE_HEADERS];
  for (var i = 0; i < list.length; i++) {
    var t = list[i] || {};
    if (!String(t.days || '').trim() || !String(t.template || '').trim()) continue;
    matrix.push([
      String(t.productCode || '*').trim().toUpperCase(),
      String(t.days).trim(),
      String(t.template),
      String(t.cs || '').trim().toLowerCase()
    ]);
  }
  sh.getRange(1, 1, matrix.length, FU_TEMPLATE_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: matrix.length - 1 });
}

function renderFollowUpTemplate_(tpl, ctx) {
  return String(tpl)
    .replace(/\{name\}/g, ctx.name || 'bạn')
    .replace(/\{phone\}/g, ctx.phone || '')
    .replace(/\{days\}/g, String(ctx.days || ''))
    .replace(/\{product\}/g, ctx.product || '');
}

function readFollowUpLogKeys_() {
  var sh = getSheet_(SH_FU_LOG, FU_LOG_HEADERS);
  var last = sh.getLastRow();
  var set = {};
  if (last < 2) return set;
  var vals = sh.getRange(2, 1, last - 1, 3).getValues();
  for (var i = 0; i < vals.length; i++) {
    set[String(vals[i][0]) + '|' + String(vals[i][1]) + '|' + String(vals[i][2])] = true;
  }
  return set;
}

function appendFollowUpLogRows_(rows) {
  if (!rows.length) return;
  var sh = getSheet_(SH_FU_LOG, FU_LOG_HEADERS);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, FU_LOG_HEADERS.length).setValues(rows);
}

// Doc du phong tu ban CS quet danh ba Zalo (chi dung cho SDT KHONG co don hang nao trong OrderData)
function readZaloScanByPhone_() {
  var sh = getSheet_(SH_ZALO_SCAN, ZALO_SCAN_HEADERS);
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var vals = sh.getRange(2, 1, last - 1, ZALO_SCAN_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    var phone = normPhone_(vals[i][0]);
    if (!phone) continue;
    // giu ban quet moi nhat cho moi SDT
    map[phone] = {
      phone: phone, rawName: vals[i][1] || '', nameGuess: vals[i][2] || '',
      orderDateGuess: vals[i][3] || '', productCodeGuess: String(vals[i][4] || '').toUpperCase(),
      scannedAt: vals[i][5] || ''
    };
  }
  return map;
}

// Nhan mang cac ban ghi quet tu extension: [{phone, rawName, nameGuess, orderDateGuess, productCodeGuess, scannedBy}]
function dedupeCare_() {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow();
  if (last < 3) return jsonOut_({ ok: true, removed: 0 });
  var data = sh.getDataRange().getValues();
  var best = {}; // np -> {rowVals, score}
  function score(row){ var n=0; for (var j=1;j<row.length;j++){ if (String(row[j]||'').trim()) n++; } return n; }
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var np = normPhone_(String(data[i][0]));
    if (!np) continue;
    var sc = score(data[i]);
    if (!best[np] || sc > best[np].score) best[np] = { row: data[i], score: sc };
  }
  var W = CARE_HEADERS.length;
  // Chuẩn hoá mỗi dòng đúng W cột (dòng cũ có thể thiếu cột birthday → pad; thừa → cắt)
  function fit(row){
    var r = (row || []).slice(0, W);
    while (r.length < W) r.push('');
    return r;
  }
  var out = [CARE_HEADERS.slice()];
  Object.keys(best).forEach(function(np){ out.push(fit(best[np].row)); });
  var removed = (data.length - 1) - (out.length - 1);
  sh.clearContents();
  sh.getRange(1, 1, out.length, W).setValues(out);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
  return jsonOut_({ ok: true, removed: removed, kept: out.length - 1 });
}

// ─── CHAY TAY TU APPS SCRIPT EDITOR (chon ham roi bam Run, xem ket qua o Executions) ───
function runDedupeCare() {
  var res = dedupeCare_();
  Logger.log('DEDUPE CARE: ' + res.getContent());
}
function saveZaloScan_(rows) {
  if (!rows || !rows.length) return jsonOut_({ ok: false, error: 'Khong co du lieu quet' });
  var sh = getSheet_(SH_ZALO_SCAN, ZALO_SCAN_HEADERS);
  var now = new Date().toISOString();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var phone = normPhone_(r.phone);
    if (!phone) continue;
    out.push([phone, r.rawName || '', r.nameGuess || '', r.orderDateGuess || '', String(r.productCodeGuess || '').toUpperCase(), now, r.scannedBy || '']);
  }
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, ZALO_SCAN_HEADERS.length).setValues(out);
  return jsonOut_({ ok: true, count: out.length });
}

// Ham chinh: quet OrderData (uu tien) + ZaloContactScan (du phong), gom cac
// KH toi dung moc ngay (7/14/30/60) thanh 1 chien dich broadcast tu dong,
// noi dung rieng cho tung khach (perPhoneMsg) de extension da co san tu
// dong gui (startBroadcast_ trong content.js).
function runFollowUpScan_() {
  var templates = readFollowUpTemplates_();
  var doneKeys = readFollowUpLogKeys_();
  var today = new Date(); today.setHours(0, 0, 0, 0);

  // Moc ngay lay DONG tu bang mau tin (CS dat tuy y: 7, 14, 30, 60, 90...).
  // Neu bang mau trong -> dung bo moc mac dinh FU_CHECKPOINTS.
  var fuDaysSet = {};
  Object.keys(templates).forEach(function (k) {
    var d = parseInt(k.split('|')[1], 10);
    if (d > 0) fuDaysSet[d] = true;
  });
  if (!Object.keys(fuDaysSet).length) {
    for (var fci = 0; fci < FU_CHECKPOINTS.length; fci++) fuDaysSet[FU_CHECKPOINTS[fci]] = true;
  }

  // Doc CareData 1 lan: phone -> { cs phu trach, cac nick Zalo da ket ban }
  var careMap = {};
  var careRows = readCare_(getCrmSS_().getSheetByName(SH_CARE));
  for (var ci = 0; ci < careRows.length; ci++) {
    var cr = careRows[ci];
    careMap[normPhone_(cr.phone)] = {
      cs: String(cr.cs || '').trim(),
      nicks: Array.isArray(cr.nickZalos) ? cr.nickZalos : []
    };
  }

  var perPhoneMsg = {}, phones = [], logRows = [];
  var matchedPhones = {}; // tranh trung SDT trong cung 1 lan chay neu khop nhieu moc

  function tryAdd(phone, orderDate, productText, name, source) {
    if (!phone || !orderDate) return;
    var d = (orderDate instanceof Date) ? orderDate : new Date(orderDate);
    if (isNaN(d)) return;
    d.setHours(0, 0, 0, 0);
    if (d < FU_START) return; // chi hoi tham khach mua tu 5/2026 tro di
    var daysSince = Math.round((today - d) / 86400000);
    if (!fuDaysSet[daysSince]) return;
    var np = normPhone_(phone);
    if (!np || matchedPhones[np]) return; // 1 KH chi nhan 1 tin moi lan chay, tranh spam neu khop nhieu don

    var orderKey = (orderDate instanceof Date ? orderDate.toISOString().slice(0, 10) : String(orderDate));
    var logKey = np + '|' + orderKey + '|' + daysSince;
    if (doneKeys[logKey]) return;

    var code = productCodeFromText_(productText) || '*';
    var csOwn = ((careMap[np] && careMap[np].cs) || '').toLowerCase();
    // Uu tien: mau rieng cua CS (theo ma SP -> mac dinh) -> mau chung (theo ma SP -> mac dinh)
    var tpl = (csOwn && (templates[code + '|' + daysSince + '|' + csOwn] || templates['*|' + daysSince + '|' + csOwn]))
      || templates[code + '|' + daysSince] || templates['*|' + daysSince];
    if (!tpl) return; // chua co mau cho san pham/moc ngay nay -> khong gui (tranh gui tin rong/chung chung)

    var msg = renderFollowUpTemplate_(tpl, { name: name || '', phone: np, days: daysSince, product: productText || '' });
    perPhoneMsg[np] = msg;
    phones.push(np);
    matchedPhones[np] = true;
    logRows.push([np, orderKey, daysSince, new Date().toISOString(), source]);
  }

  // 1) Uu tien du lieu don hang that trong DT TONG (thay the OrderData cu)
  var orders = readAllOrders_();
  var phonesWithOrders = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.phone) phonesWithOrders[normPhone_(o.phone)] = true;
    if (!fuSourceAllowed_(o.source)) continue; // chi nguon landipage / messenger / web
    tryAdd(o.phone, o.date, o.product || o.productDetail, o.name, 'order');
  }

  // 2) Ban quet ten Zalo (ZaloContactScan) KHONG dung lam nguon ngay/san pham nua.
  // Ngay mua + san pham CHI tinh theo don hang that trong Sasum (OrderData).
  // Ban quet chi de doi chieu SDT nao dang co tren Zalo (phuc vu gui tin dung nick).

  if (!phones.length) return { ok: true, count: 0, message: 'Khong co KH nao toi moc hoi tham hom nay (hoac chua co mau tin cho san pham/moc ngay tuong ung).' };

  // ── TACH CHIEN DICH THEO CS PHU TRACH (tu CareData.cs) ──
  // Moi CS 1 chien dich rieng -> CS nao mo extension chi thay khach cua minh.
  // Khach chua gan CS -> vao chien dich chung (csName rong, moi CS deu thay).
  var groups = {}; // csName -> [phones]
  for (var gi = 0; gi < phones.length; gi++) {
    var gp = phones[gi];
    var gcs = (careMap[gp] && careMap[gp].cs) || '';
    if (!groups[gcs]) groups[gcs] = [];
    groups[gcs].push(gp);
  }

  var todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'yyyy-MM-dd_HHmm');
  var dateLabel = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT+7', 'dd/MM/yyyy');
  var created = [];
  Object.keys(groups).forEach(function (csName) {
    var grpPhones = groups[csName];
    var grpMsg = {}, grpNick = {};
    for (var pi = 0; pi < grpPhones.length; pi++) {
      var pp = grpPhones[pi];
      grpMsg[pp] = perPhoneMsg[pp];
      grpNick[pp] = (careMap[pp] && careMap[pp].nicks) || [];
    }
    var broadcast = {
      id: 'fu_' + todayStr + (csName ? '_' + csName : '_chung'),
      label: 'Tự động hỏi thăm ' + dateLabel + (csName ? ' — ' + csName : ' — chưa gán CS'),
      message: '(Nội dung cá nhân hoá riêng theo từng khách — xem chi tiết trong extension)',
      images: [],
      phones: grpPhones,
      csName: csName,
      expectedNick: '',
      createdAt: new Date().toISOString(),
      status: 'active',
      perPhoneMsg: grpMsg,
      perPhoneNick: grpNick
    };
    saveBroadcast_(broadcast);
    created.push({ id: broadcast.id, cs: csName || '(chung)', count: grpPhones.length });
  });

  appendFollowUpLogRows_(logRows);
  return { ok: true, count: phones.length, campaigns: created };
}

// ─── HUONG DAN DAT LICH CHAY TU DONG (setup 1 lan) ───────────────
// Trong Apps Script editor: Trigger (bieu tuong dong ho o thanh ben trai)
// → + Add Trigger → Chon ham "runFollowUpScanTrigger" → Chon nguon su kien
// "Time-driven" → "Day timer" → chon khung gio (VD 8-9 sang) → Save.
// Ham nay chi la wrapper khong tra ve gi (trigger yeu cau void), log lai
// ket qua vao Logger de kiem tra trong "Executions" cua Apps Script.
function runFollowUpScanTrigger() {
  var res = runFollowUpScan_();
  Logger.log(JSON.stringify(res));
}

// ═══════════════════════════════════════════════════════════════
//  TASKS ADDON — Quản lý công việc (Công việc + CS tham gia)
//  Dán TOÀN BỘ khối này vào CUỐI file gas_v13.js (trước dòng cuối cùng)
// ═══════════════════════════════════════════════════════════════

var SH_TASK = 'Tasks';
var TASK_HEADERS = ['id','title','description','csAssigned','deadline','status','createdBy','createdAt','updatedAt','teamsAssigned','result','images'];

function readTasks_(sh) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    var cs = [];
    try { cs = v[i][3] ? JSON.parse(v[i][3]) : []; } catch (e) { cs = String(v[i][3] || '').split(',').filter(Boolean); }
    var tm = [];
    try { tm = v[i][9] ? JSON.parse(v[i][9]) : []; } catch (e) { tm = String(v[i][9] || '').split(',').filter(Boolean); }
    var imgs = [];
    try { imgs = v[i][11] ? JSON.parse(v[i][11]) : []; } catch (e) { imgs = []; }
    out.push({
      id: String(v[i][0]),
      title: String(v[i][1] || ''),
      description: String(v[i][2] || ''),
      csAssigned: cs,
      deadline: v[i][4] ? String(v[i][4]) : '',
      status: String(v[i][5] || 'Chưa làm'),
      createdBy: String(v[i][6] || ''),
      createdAt: String(v[i][7] || ''),
      updatedAt: String(v[i][8] || ''),
      teamsAssigned: tm,
      result: String(v[i][10] || ''),
      images: imgs
    });
  }
  return out;
}

// Tạo mới (khi t.id rỗng) hoặc cập nhật (khi t.id đã tồn tại) — cùng 1 hàm, giống pattern saveAssignEntry_
function saveTaskEntry_(t) {
  if (!t || !String(t.title || '').trim()) return jsonOut_({ error: 'Thieu title' });
  var sh = getSheet_(SH_TASK, TASK_HEADERS);
  var now = new Date().toISOString();
  var id = t.id || ('tk_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
  var last = sh.getLastRow(); var rowIdx = -1;
  if (t.id && last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(t.id)).matchEntireCell(true).findNext();
    if (cell) rowIdx = cell.getRow();
  }
  var createdAt = t.createdAt || now;
  var row = [id, t.title || '', t.description || '', JSON.stringify(t.csAssigned || []),
             t.deadline || '', t.status || 'Chưa làm', t.createdBy || '', createdAt, now,
             JSON.stringify(t.teamsAssigned || []), t.result || '', JSON.stringify(t.images || [])];
  if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, TASK_HEADERS.length).setValues([row]);
  else sh.appendRow(row);
  return jsonOut_({ ok: true, id: id });
}

function deleteTask_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id' });
  var sh = getSheet_(SH_TASK, TASK_HEADERS);
  var last = sh.getLastRow();
  if (last >= 2) {
    var cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (cell) sh.deleteRow(cell.getRow());
  }
  return jsonOut_({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
//  BINH LUAN / THAO LUAN TRONG 1 CONG VIEC (tab "Thao luan" cua Task)
//  Moi dong la 1 comment, khong sua/xoa - chi doc theo taskId + them moi.
// ═══════════════════════════════════════════════════════════════
var SH_TASK_COMMENT = 'TaskComments';
var TASK_COMMENT_HEADERS = ['id','taskId','author','content','images','createdAt'];

function readTaskComments_(sh, taskId) {
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    if (String(v[i][1]) !== String(taskId)) continue;
    var imgs = [];
    try { imgs = v[i][4] ? JSON.parse(v[i][4]) : []; } catch (e) { imgs = []; }
    out.push({
      id: String(v[i][0]),
      taskId: String(v[i][1]),
      author: String(v[i][2] || ''),
      content: String(v[i][3] || ''),
      images: imgs,
      createdAt: String(v[i][5] || '')
    });
  }
  // Cu -> moi, giong thu tu chat, de UI scroll xuong duoi cung la binh luan moi nhat
  out.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  return out;
}

function saveTaskComment_(c) {
  if (!c || !c.taskId) return jsonOut_({ error: 'Thieu taskId' });
  if (!String(c.content || '').trim() && !(c.images || []).length) {
    return jsonOut_({ error: 'Binh luan rong' });
  }
  var sh = getSheet_(SH_TASK_COMMENT, TASK_COMMENT_HEADERS);
  var id = 'tc_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var now = new Date().toISOString();
  sh.appendRow([id, String(c.taskId), c.author || 'Ẩn danh', c.content || '',
                JSON.stringify(c.images || []), now]);
  return jsonOut_({ ok: true, id: id });
}

// ═══════════════════════════════════════════════════════════════
//  MESSENGER / PHONG THUY AI — them 2026-09, phuc vu extension-messenger.
//  CHI THEM MOI, khong sua ham/sheet nao o tren. Dung 2 sheet rieng (Menh, CannedResponses),
//  KHONG dung chung cot voi CareData — tranh dung do schema dang chay that cho Zalo/Pancake.
// ═══════════════════════════════════════════════════════════════
var SH_MENH = 'Menh';
var SH_CANNED = 'CannedResponses';

// Bang tra menh Ngu hanh nap am (chep tu bang CS da doi chieu — chi khop nam 1954-2013,
// can chuyen gia phong thuy trong cong ty ra soat/bo sung truoc khi dung chinh thuc rong rai hon).
var MENH_DEFAULT_ROWS = [
  ['Kim', '1954,1955,1962,1963,1970,1971,1984,1985,1992,1993,2000,2001'],
  ['Thủy', '1956,1957,1964,1965,1972,1973,1986,1987,1994,1995,2002,2003'],
  ['Hỏa', '1958,1959,1966,1967,1974,1975,1988,1989,1996,1997,2004,2005'],
  ['Mộc', '1960,1961,1968,1969,1982,1983,1990,1991,1998,1999,2012,2013'],
  ['Thổ', '1976,1977,1978,1979,1980,1981,2006,2007,2008,2009,2010,2011']
];

// 11 mau canned response (Phan A/B/C file mau Beeftext CS gui) — Nhom | ID | Ten | NoiDung
var CANNED_DEFAULT_ROWS = [
  ['Theo mệnh', 'menhkim', 'Mệnh Kim', 'Dạ với người mệnh Kim thì màu hợp là màu trắng, vàng, bạc (thuộc hành Kim và Thổ vì Thổ sinh Kim ạ), nên tránh dùng nhiều màu đỏ, hồng, tím (hành Hỏa khắc Kim).\nĐá phong thủy hợp mệnh Kim: đá thạch anh trắng, đá mắt hổ vàng, ngọc trai, đá obsidian đen (Thủy tương sinh).\nBên em hiện có $$ rất phù hợp với mệnh Kim ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhmoc', 'Mệnh Mộc', 'Dạ với người mệnh Mộc thì màu hợp là màu xanh lá, xanh dương, đen (hành Mộc và Thủy vì Thủy sinh Mộc ạ), nên tránh dùng nhiều màu trắng, bạc (hành Kim khắc Mộc).\nĐá phong thủy hợp mệnh Mộc: đá aventurine xanh, ngọc bích, đá obsidian đen.\nBên em hiện có $$ rất phù hợp với mệnh Mộc ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhthuy', 'Mệnh Thủy', 'Dạ với người mệnh Thủy thì màu hợp là màu đen, xanh dương, trắng (hành Thủy và Kim vì Kim sinh Thủy ạ), nên tránh dùng nhiều màu vàng nâu (hành Thổ khắc Thủy).\nĐá phong thủy hợp mệnh Thủy: đá obsidian đen, đá lapis lazuli xanh, đá thạch anh trắng.\nBên em hiện có $$ rất phù hợp với mệnh Thủy ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhhoa', 'Mệnh Hỏa', 'Dạ với người mệnh Hỏa thì màu hợp là màu đỏ, hồng, tím, xanh lá (hành Hỏa và Mộc vì Mộc sinh Hỏa ạ), nên tránh dùng nhiều màu đen, xanh dương (hành Thủy khắc Hỏa).\nĐá phong thủy hợp mệnh Hỏa: đá thạch anh hồng, đá garnet đỏ, đá aventurine xanh.\nBên em hiện có $$ rất phù hợp với mệnh Hỏa ạ, chị/anh xem qua thử nhé.'],
  ['Theo mệnh', 'menhtho', 'Mệnh Thổ', 'Dạ với người mệnh Thổ thì màu hợp là màu vàng, nâu, đỏ, hồng (hành Thổ và Hỏa vì Hỏa sinh Thổ ạ), nên tránh dùng nhiều màu xanh lá (hành Mộc khắc Thổ).\nĐá phong thủy hợp mệnh Thổ: đá mắt hổ vàng, đá citrine vàng, đá thạch anh hồng.\nBên em hiện có $$ rất phù hợp với mệnh Thổ ạ, chị/anh xem qua thử nhé.'],
  ['Giá & chính sách', 'chaohoi', 'Chào hỏi', 'Dạ em chào chị/anh, em là $$ bên shop phong thủy Thu Hiền ạ. Chị/anh cho em xin năm sinh để em tư vấn sản phẩm hợp mệnh nhất mình nhé ạ 🙏'],
  ['Giá & chính sách', 'giaba', 'Báo giá', 'Dạ sản phẩm $$ bên em giá là $$ ạ. Giá này đã bao gồm hộp đựng và thẻ bảo hành, chưa gồm phí ship ạ. Chị/anh có muốn em tư vấn thêm mẫu khác cùng tầm giá không ạ?'],
  ['Giá & chính sách', 'csship', 'Chính sách ship', 'Dạ bên em giao hàng toàn quốc qua đơn vị vận chuyển, thời gian dự kiến 2–4 ngày với nội thành và 3–5 ngày với tỉnh xa ạ. Chị/anh có thể xem hàng trước khi thanh toán (COD) ạ.'],
  ['Giá & chính sách', 'csdoitra', 'Đổi trả', 'Dạ sản phẩm bên em hỗ trợ đổi trong vòng 7 ngày nếu lỗi do nhà sản xuất hoặc không đúng mẫu đã đặt ạ, còn đổi ý cá nhân thì em xin phép hỗ trợ đổi mẫu khác tương đương giá trị trong 3 ngày ạ (khách chịu phí ship đổi). Chị/anh yên tâm mua ạ 🙏'],
  ['Giá & chính sách', 'xinttin', 'Xin thông tin lên đơn', 'Dạ để lên đơn cho chị/anh, em xin thông tin: \n- Họ tên: $$\n- Số điện thoại: $$\n- Địa chỉ nhận hàng: $$\nChị/anh gửi giúp em với ạ, em lên đơn ngay ạ.'],
  ['Giá & chính sách', 'follow2ngay', 'Follow-up 2 ngày', 'Dạ em là $$ bên phong thủy Thu Hiền ạ, hôm trước chị/anh có quan tâm sản phẩm $$, không biết chị/anh đã quyết định chưa ạ? Hiện bên em đang có ưu đãi $$, chị/anh xem thử nhé ạ 🙏']
];

function ensureMenhSheedSeeded_(sh) {
  if (sh.getLastRow() < 2) { for (var i = 0; i < MENH_DEFAULT_ROWS.length; i++) sh.appendRow(MENH_DEFAULT_ROWS[i]); }
  return sh;
}
function ensureCannedSheetSeeded_(sh) {
  if (sh.getLastRow() < 2) { for (var i = 0; i < CANNED_DEFAULT_ROWS.length; i++) sh.appendRow(CANNED_DEFAULT_ROWS[i]); }
  return sh;
}

function getMessengerKnowledge_() {
  var shMenh = ensureMenhSheedSeeded_(getSheet_(SH_MENH, ['Menh', 'NamSinh (cách nhau bởi dấu phẩy)']));
  var menhData = shMenh.getDataRange().getValues();
  var menhTable = {};
  for (var r = 1; r < menhData.length; r++) {
    var menh = String(menhData[r][0] || '').trim();
    if (!menh) continue;
    menhTable[menh] = String(menhData[r][1] || '').split(',').map(function (s) { return parseInt(s.trim(), 10); }).filter(function (n) { return !isNaN(n); });
  }

  var shCanned = ensureCannedSheetSeeded_(getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']));
  var cannedData = shCanned.getDataRange().getValues();
  var canned = [];
  for (var c = 1; c < cannedData.length; c++) {
    if (!cannedData[c][1]) continue;
    canned.push({ nhom: cannedData[c][0], id: cannedData[c][1], label: cannedData[c][2], text: cannedData[c][3] });
  }
  return { ok: true, menhTable: menhTable, canned: canned, bannedWords: readBannedWords_() };
}

// ─── TU CAM (ban tu ngu khi len don/nhan tin) — doc TRUC TIEP tu file "Report Sale" (tab
// "Luu y tu cam") de team chinh sua tren do la tu dong cap nhat, khong can sua code. File nay
// KHAC voi CRM_SS_ID (chi la file van hanh/bao cao Sale) nen phai mo rieng bang openById; neu tai
// khoan chay GAS chua duoc chia se file do (loi quyen), fallback ve BANNED_WORDS_FALLBACK ben duoi
// (chep tu dung noi dung sheet tai thoi diem 2026-09) de tinh nang khong bi gian doan.
var REPORT_SALE_SS_ID = '1qyyG2Pj8QOVNTb4B9JX8VQsrjFlZX-WhpovX1qDkvzM';
var BANNED_WORDS_SHEET_NAME = 'Lưu ý từ cấm';
var BANNED_WORDS_FALLBACK = [
  { tuCam: 'Tài lộc', thayThe: 'Thuận lợi trong công việc, thắng tiến về đường sự nghiệp' },
  { tuCam: 'Tiền tài', thayThe: 'Thuận lợi trong công việc, thắng tiến về đường sự nghiệp' },
  { tuCam: 'chiêu tài', thayThe: 'Làm được giữ được' },
  { tuCam: 'Thần tài', thayThe: 'Thuận lợi trong công việc, thắng tiến về đường sự nghiệp' },
  { tuCam: 'Sức khỏe', thayThe: 'Tốt cho cơ thể' },
  { tuCam: 'Trộm vía', thayThe: 'Tốt cho cơ thể' },
  { tuCam: 'Vận hạn', thayThe: '' },
  { tuCam: 'Tam tai', thayThe: '' },
  { tuCam: 'Thái Tuế', thayThe: '' },
  { tuCam: 'Tình duyên', thayThe: 'tình cảm' },
  { tuCam: 'Linh phù', thayThe: '' },
  { tuCam: 'Mua bán', thayThe: 'kinh doanh thuận lợi' },
  { tuCam: 'buôn bán', thayThe: 'kinh doanh thuận lợi' },
  { tuCam: 'May mắn', thayThe: '' },
  { tuCam: 'Bình an', thayThe: 'an yên' },
  { tuCam: 'Bứt phá', thayThe: '' },
  { tuCam: 'thiên lộc', thayThe: '' },
  { tuCam: 'Thịnh vượng', thayThe: '' },
  { tuCam: 'cam kết', thayThe: '' },
  { tuCam: 'chắc chắn', thayThe: '' },
  { tuCam: 'mang lại', thayThe: '' },
  { tuCam: 'Hanh thông', thayThe: 'Mang ý nghĩa, bổ trợ, tương trợ' },
  { tuCam: 'thất thoát', thayThe: '' },
  { tuCam: 'Thu hút tài lộc', thayThe: 'Tặng chị 3 sản phẩm sau' },
  { tuCam: 'combo tam lộc', thayThe: 'Tặng chị 3 sản phẩm sau' },
  { tuCam: 'Vận may', thayThe: '' },
  { tuCam: 'Cầu tài', thayThe: '' },
  { tuCam: 'cầu lộc', thayThe: '' },
  { tuCam: 'Trừ tà', thayThe: '' },
  { tuCam: 'Charm túi tiền', thayThe: 'Charm túi' },
  { tuCam: 'Kim Tiền', thayThe: 'Kim túi' },
  { tuCam: 'túi tiền', thayThe: 'túi' },
  { tuCam: 'Lộc phúc tình', thayThe: 'lpt' },
  { tuCam: 'Lộc', thayThe: '' },
  { tuCam: 'Tiền', thayThe: '' }
];

function readBannedWords_() {
  try {
    var ss = SpreadsheetApp.openById(REPORT_SALE_SS_ID);
    var sh = ss.getSheetByName(BANNED_WORDS_SHEET_NAME);
    if (!sh) return BANNED_WORDS_FALLBACK;
    var vals = sh.getDataRange().getValues();
    // Tim dong tieu de co o "Tu cam" (sheet nay co nhieu bang xep chong, khong co dong tieu de co dinh)
    var headerRow = -1, colTuCam = -1, colDuocDung = -1, colVietLai = -1;
    for (var r = 0; r < vals.length; r++) {
      for (var c = 0; c < vals[r].length; c++) {
        if (String(vals[r][c]).trim() === 'Từ cấm') { headerRow = r; colTuCam = c; break; }
      }
      if (headerRow !== -1) break;
    }
    if (headerRow === -1) return BANNED_WORDS_FALLBACK;
    var hdr = vals[headerRow];
    for (var c2 = 0; c2 < hdr.length; c2++) {
      var h = String(hdr[c2]).trim();
      if (h === 'Từ được dùng') colDuocDung = c2;
      if (h === 'Cách viết lại') colVietLai = c2;
    }
    var out = [];
    for (var r2 = headerRow + 1; r2 < vals.length; r2++) {
      var raw = String(vals[r2][colTuCam] || '').trim();
      if (!raw) continue;
      if (raw.length > 300) continue; // bo qua cell ghi chu dai (khong phai danh sach tu cam thuc su)
      var thayThe = (colVietLai !== -1 ? String(vals[r2][colVietLai] || '').trim() : '') ||
                    (colDuocDung !== -1 ? String(vals[r2][colDuocDung] || '').trim() : '');
      raw.split(',').forEach(function (phrase) {
        phrase = phrase.trim();
        if (phrase) out.push({ tuCam: phrase, thayThe: thayThe });
      });
    }
    return out.length ? out : BANNED_WORDS_FALLBACK;
  } catch (e) {
    return BANNED_WORDS_FALLBACK; // vd: tai khoan chay GAS chua duoc chia se file Report Sale
  }
}

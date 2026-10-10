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
var SH_MKT_TEAM = 'MktTeams'; // nhom MKT do nguoi dung tu chon page (moi page 1 MKT, co ho tro chay chung theo ty le 'share')
var MKT_TEAM_HEADERS = ['id','name','color','pages'];
var SH_AUDIT   = 'AuditLog';
var SH_SET     = 'Settings';
var SH_ASSIGN  = 'AssignData';
var SH_USER    = 'Users';
var SH_CONTEXT = 'AIContext';
var SH_PK_STATS = 'PancakeStats';   // thong ke tuong tac/chot don hang ngay, nhap tu file Excel Pancake xuat ("Thong ke tuong tac")
var SH_PK_MAP   = 'PancakeNameMap'; // khop ten "Nhan vien" hien thi tren Pancake <-> ten Sale chuan trong CRM
var SH_PK_SDT   = 'PancakeSdtStats'; // thong ke SDT mang ve/don chot theo nhan vien+page, nhap tu file Excel Pancake xuat ("Thong ke nhan vien" - sheet "By staff")
var SH_SALE_DIR = 'SaleDirectory'; // danh sach Sale chuan: ma sale, ten Facebook, user base, ten tag Pancake (S=van phong, O=online)
var SH_PK_PAGEMAP = 'PancakePageMap'; // khop pageId Pancake <-> gia tri "Kenh ban" chuan dung trong DT TONG
var SH_PK_TAG   = 'PancakeTagStats'; // thong ke tag (L1-L7 trang thai, S/O sale) theo Page+ngay, nhap tu file Excel "Thong ke tag" Pancake xuat

var ORDER_SS_ID = '1fiWXPMZcHuEh0zYqD6pgQjZDM0PhWzpiSK7Igj6Cug8'; // File chua OrderData2x (doanh thu/don hang)
var CRM_SS_ID   = '18XBtbjP7gtlvYpChikF3B62cxHkR4426s5poZj9Mj8I'; // File chua CareData/Users/Teams/Settings/AuditLog/AssignData/AIContext (CRM).
var PRICE_SS_ID    = '1I4wr226_QUJuCZSKASsxXxOjloCW9UtpYz87TSy-Ldk'; // File "Bang gia" moi (Danh_muc/Tinh_tien/Ghi_chu_chinh_sach) - cap nhat 2026-09
var EXPORT_BASE_SS_ID  = '1s1UlRMquiryI7A2lJ8gJlPMsIGBLGum1RdLJga3ldlI'; // File Google Sheet RIENG de xuat Bao cao Base (nut "📌 Cập nhật Sheet Base") — theo yeu cau Duyen 2026-09.
var EXPORT_BASE_GID    = 0; // Tab dich trong file tren (lay tu URL "#gid=..."). Doi tab/doi file: sua 2 dong nay roi Deploy lai, KHONG can sua gi khac.
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
// v13.3 (2026-09): them zaloPhones — SDT khach dang dung de ket ban Zalo, CS tu ghi (chon tu
// SDT co san cua khach hoac go moi), THAY THE hoan toan phan "Nick Zalo" rieng cua Pancake
// (khach tren Pancake ket ban Zalo bang cac SDT/tai khoan khac nhau, khong co dinh theo 1
// Page nen tracking theo "nick" khong con dung nua). zaloPhones KHAC nickZalos: nickZalos van
// giu nguyen, van do Zalo AI ghi (nick/kenh CUA DOI NGU dang dung de nhan tin, phuc vu dinh
// tuyen gui hang loat) — khong dung chung cot, tranh 2 tinh nang dam vao nhau.
var CARE_HEADERS = ['phone','status','zalo','cs','note','schedules',
  'schedGoi','schedGoiNote','schedSP','schedSPNote',
  'schedCS','schedCSNote','schedHen','schedHenNote','updated',
  'khStatus','nickZalos','birthday','zaloSetBy','name','custom','zaloPhones'];

var ORDER_HEADERS  = ['phone','name','date','year','month','cs','source','revenue',
  'product','productDetail','status','zalo','note','careCS'];
var TEAM_HEADERS   = ['id','name','leader','members','color','channels','ratePct'];
var AUDIT_HEADERS  = ['timestamp','user','action','phone','oldValue','newValue'];
var SET_HEADERS    = ['key','value'];
var ASSIGN_HEADERS = ['id','date','csName','label','phones','donePhones','part'];
// 1 o Google Sheet toi da 50.000 ky tu; JSON 1 SDT ~13 ky tu => 3000 SDT ~39k. Dot chia lon hon se duoc tach nhieu dong (cot 'part').
var ASSIGN_CHUNK = 3000;
var USER_HEADERS   = ['username','passHash','role','name','team','active','names','perms','saleType','startDate'];
// PK_STATS_HEADERS: 1 dong = 1 "Nhan vien" (ten hien thi tren Pancake) trong 1 Page, 1 ngay —
// nhap tu file Excel "Thong ke tuong tac" (pages_statistics_engagements) Pancake xuat ra.
// Khoa duy nhat = date+pageId+nhanVien -> nap lai file CUNG 1 ngay se GHI DE (khong nhan doi).
var PK_STATS_HEADERS = ['date','pageId','pageName','nhanVien','khCu','khMoi','tongTT',
  'tinNhan','binhLuan','hoiThoaiMoi','dhKhMoi','dhKhCu','tongDH'];
// PK_MAP_HEADERS: khop 1-1 ten hien thi Pancake -> ten Sale chuan trong CRM (dung chung moi
// Page, vi thuong 1 nguoi dung 1 ten Facebook ca nhan cho ca nhieu Page).
var PK_MAP_HEADERS = ['pancakeName','saleName'];
// PK_SDT_STATS_HEADERS: 1 dong = 1 "Nhan vien" trong 1 Page, 1 ngay — nhap tu file Excel
// "Thong ke nhan vien" (user_statistics_multi_pages, sheet "<pageId> By staff") Pancake xuat.
// Khoa duy nhat = date+pageId (nap lai file CUNG 1 ngay se GHI DE toan bo nhan vien cua page
// do trong ngay do — giong het co che PK_STATS_HEADERS o tren).
var PK_SDT_STATS_HEADERS = ['date','pageId','pageName','nhanVien',
  'tinNhanTuBinhLuan','binhLuan','phienTLBinhLuan','tinNhan','phienTLTinNhan',
  'sdtMangVe','soDonChot'];
// PK_PAGEMAP_HEADERS: khop 1-1 pageId Pancake -> gia tri "Kenh ban" chuan dang dung trong
// DT TONG (cot M "kenhBan"), de ghep doanh thu/so don theo dung Page.
var PK_PAGEMAP_HEADERS = ['pageId','pageName','kenhBan'];
// PK_TAG_STATS_HEADERS: 1 dong = 1 tag trong 1 Page, 1 ngay — nhap tu file Excel "Thong ke tag"
// (pages_statistics_tag) Pancake xuat. Khoa duy nhat = date+pageId+(tagId||tagName) -> nap lai
// file CUNG 1 ngay se GHI DE (khong nhan doi), giong het co che PK_STATS_HEADERS. Phan loai
// (sale/status/L1-L7) tinh LAI tu tagName moi lan tong hop bao cao (xem classifyPancakeTag_),
// KHONG luu type/code tinh san, de quy chuan tay (setting 'pancakeTagOverride') ap dung duoc
// ca cho du lieu cu da luu, giong het co che ben client (_pkTagAggregate trong index.html).
var PK_TAG_STATS_HEADERS = ['date','pageId','pageName','tagId','tagName','count'];
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
// SDT di dong Viet Nam HOP LE (Chia data tu dong phia server): 10 so, 0 + dau so 03[2-9]|05[2689]|07[06-9]|08[1-9]|09x.
// Chap nhan 84xxxxxxxxx / thieu so 0 dau (9 so). KHONG nhan so ban, so nuoc ngoai, dau so khong co that. Cung logic isValidVnPhone o index.html.
function isValidVnPhone_(p) {
  var s = String(p == null ? '' : p).replace(/[^0-9]/g, '');
  if (s.length === 11 && s.indexOf('84') === 0) s = '0' + s.substring(2);
  else if (s.length === 9 && /^[35789]/.test(s)) s = '0' + s;
  return /^0(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9\d)\d{7}$/.test(s);
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

// ─── SETTINGS (1 signature duy nhat) ──────────────────────────
// TOI UU (2026-10-10, Duyen bao luu cau hinh chia data cham): NGUYEN NHAN GOC — ban cu getDataRange().getValues() doc CA sheet Settings
// (gom cac manh ma GAS gasSourceChunk_* moi o toi 45.000 ky tu, tong ~330KB) cho MOI lan getSetting_ — ma ham nay duoc goi o moi
// getSetting/adminKey/demoToken/autoAssign... Nay chi doc COT A (ten key) roi doc dung 1 o gia tri cua key can lay.
// Khop key giu nguyen: .trim() o CA 2 ve (copy-paste API key hay dinh khoang trang/xuong dong; thieu trim se bao "Invalid API Key"), lay dong DAU khop.
function getSetting_(key) {
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_SET);
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      var v = sh.getRange(i + 2, 2).getValue();
      if (v === '' || v === null || v === undefined) return null;
      return String(v).trim() || null;
    }
  }
  return null;
}
// Lay NHIEU key trong 1 lan goi (doc cot A 1 lan) — dung cho FE can nhieu key cung luc (vd cau hinh + trang thai chia tu dong). Bo key nhay cam.
function getSettingsMulti_(keyList) {
  var out = {}, want = {}, any = false;
  (keyList || []).forEach(function (k) { k = String(k || '').trim(); if (k && !_isSensitiveSettingKey_(k)) { want[k] = true; any = true; out[k] = null; } });
  if (!any) return out;
  var sh = getCrmSS_().getSheetByName(SH_SET);
  if (!sh || sh.getLastRow() < 2) return out;
  var last = sh.getLastRow(), keys = sh.getRange(2, 1, last - 1, 1).getValues(), seen = {};
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i][0]).trim();
    if (want[k] && !seen[k]) {
      seen[k] = true;
      var v = sh.getRange(i + 2, 2).getValue();
      out[k] = (v === '' || v === null || v === undefined) ? null : (String(v).trim() || null);
    }
  }
  return out;
}
// Chia gas_v13.js thanh nhieu manh <=45.000 ky tu, ghi qua setSetting_ (gasSourceChunk_0, _1,...).
// Neu ban moi it manh hon ban truoc, xoa het cac key manh du (gasSourceChunk_N tro len) de khong
// bi lan sang du lieu manh cu khi getGasSource_ doc.
function setGasSource_(code) {
  code = String(code || '');
  var CHUNK = 45000;
  var oldCount = parseInt(getSetting_('gasSourceChunkCount') || '0', 10) || 0;
  var chunks = [];
  for (var i = 0; i < code.length; i += CHUNK) chunks.push(code.slice(i, i + CHUNK));
  for (var c = 0; c < chunks.length; c++) setSetting_('gasSourceChunk_' + c, chunks[c]);
  for (var d = chunks.length; d < oldCount; d++) setSetting_('gasSourceChunk_' + d, '');
  setSetting_('gasSourceChunkCount', String(chunks.length));
  setSetting_('gasSourceUpdatedAt', new Date().toISOString());
  return jsonOut_({ ok: true, chunks: chunks.length, length: code.length });
}
// ─── NHOM SALE (truoc chi co 2 nhom co dinh Online/Van phong, gio Admin tu dinh nghia them nhom
// moi vd CSKH/Quay...) — luu trong setting 'saleGroups' = [{key,label}]. 'online'/'offline' la 2
// key MAC DINH giu nguyen de KHONG vo du lieu cu (saleChannels/saleType dang dung dung 2 key nay).
var SALE_GROUPS_DEFAULT_ = [
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Văn phòng' },
  { key: 'probation', label: 'Thử việc' }
];
function readSaleGroups_() {
  try {
    var raw = getSetting_('saleGroups');
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.filter(function(g) { return g && g.key; }).map(function(g) { return { key: String(g.key), label: String(g.label || g.key) }; });
      }
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(SALE_GROUPS_DEFAULT_));
}
function saveSaleGroups_(list) {
  if (!Array.isArray(list)) return jsonOut_({ ok: false, error: 'Danh sách nhóm không hợp lệ' });
  var clean = [], seen = {};
  for (var i = 0; i < list.length; i++) {
    var key = String((list[i] && list[i].key) || '').trim();
    var label = String((list[i] && list[i].label) || '').trim();
    if (!key || !label || seen[key]) continue;
    seen[key] = true;
    clean.push({ key: key, label: label });
  }
  if (!clean.length) return jsonOut_({ ok: false, error: 'Cần ít nhất 1 nhóm' });
  return setSetting_('saleGroups', JSON.stringify(clean));
}
function _saleGroupLabel_(key, groups) {
  groups = groups || readSaleGroups_();
  var g = groups.filter(function(x) { return x.key === key; })[0];
  return g ? g.label : '';
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
  // "🏷️ Phân loại Online/Offline" (Quan ly Team) ghi vao day — dong bo luon sang truong saleType
  // cua tai khoan dang nhap trung ten, de PHAN LOAI NAY AP DUNG CA CHO DANG NHAP (theo yeu cau
  // Duyen 2026-09: 1 nguon phan loai Online/Offline dung chung MOI NOI, ke ca tai khoan dang nhap),
  // khong chi rieng cac bao cao doanh so.
  if (key === 'saleChannels') { try { _syncSaleChannelsToUsers_(value); } catch (eSync) {} }
  return jsonOut_({ ok: true });
}
function _syncSaleChannelsToUsers_(rawValue) {
  var channels; try { channels = JSON.parse(rawValue); } catch (e) { return; }
  if (!channels || typeof channels !== 'object') return;
  var validKeys = {}; readSaleGroups_().forEach(function(g) { validKeys[g.key] = true; }); // chap nhan BAT KY nhom nao Admin da dinh nghia, khong con chi 2 gia tri co dinh
  var shU = getSheet_(SH_USER, USER_HEADERS);
  if (shU.getLastRow() < 2) return;
  var v = shU.getRange(2, 1, shU.getLastRow() - 1, USER_HEADERS.length).getValues();
  var saleTypeCol = USER_HEADERS.indexOf('saleType'); // cot 'saleType' (index 8)
  if (saleTypeCol === -1) return;
  for (var i = 0; i < v.length; i++) {
    // Dung DUNG cach doc 'names' nhu readUsers_: JSON array o cot 'names' (index 6), fallback ve
    // 1 phan tu tu cot 'name' don (index 3) neu tai khoan cu chua co cot 'names'.
    var namesArr = []; try { namesArr = v[i][6] ? JSON.parse(v[i][6]) : []; } catch (e2) { namesArr = []; }
    if (!namesArr.length && v[i][3]) namesArr = [String(v[i][3])];
    var matchCh = null;
    for (var j = 0; j < namesArr.length; j++) {
      if (channels[namesArr[j]] !== undefined) { matchCh = channels[namesArr[j]]; break; }
    }
    if (matchCh && validKeys[matchCh] && String(v[i][saleTypeCol] || '') !== matchCh) {
      shU.getRange(i + 2, saleTypeCol + 1).setValue(matchCh);
    }
  }
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
    custom:       (function(v){ try { var o = JSON.parse(v||'{}'); return (o && typeof o === 'object') ? o : {}; } catch(e) { return {}; } })(row[20]),
    // SDT khach dung de ket ban Zalo (mang chuoi, CS tu them) — xem chu thich tai CARE_HEADERS
    zaloPhones:   (function(v){ try { var a = JSON.parse(v||'[]'); return Array.isArray(a) ? a : []; } catch(e) { return []; } })(row[21])
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

// ── DELTA SYNC CareData (action=customers&since=<ISO>) ─────────────────────────────────────────────
// NGUYEN NHAN (da sua): moi nhip 3s moi may deu goi action=customers => readCare_ doc FULL CareData (hang chuc/tram nghin dong
// x 22 cot) roi JSON hoa; cache 'customers_v12' khong bao gio put duoc vi CacheService chi nhan <=100KB/gia tri. Nay chi doc
// cot 'updated' (1 cot), lay cac dong co updated > since roi doc dung cac dong do. Moi ham ghi CareData deu dong dau 'updated'
// (careRow_ / syncZaloFriendStatus_). Dong bi XOA (dedupeCare_) hoac sua tay tren Sheet khong co 'updated' se do lan keo FULL
// dinh ky cua client (5 phut) dong bo. Tra null neu qua nhieu dong/doan roi rac => caller tra FULL nhu cu.
function readCareDelta_(sh, since) {
  if (!sh || sh.getLastRow() < 2) return { delta: true, rows: [] };
  var last = sh.getLastRow();
  var upd = sh.getRange(2, 15, last - 1, 1).getValues();
  var idx = [];
  for (var i = 0; i < upd.length; i++) {
    var u = upd[i][0];
    var us = (u instanceof Date) ? u.toISOString() : String(u || '');
    if (us && us > since) idx.push(i + 2);
  }
  if (!idx.length) return { delta: true, rows: [] };
  var runs = [], a = idx[0], b = idx[0];
  for (var k = 1; k < idx.length; k++) {
    if (idx[k] === b + 1) { b = idx[k]; } else { runs.push([a, b]); a = idx[k]; b = idx[k]; }
  }
  runs.push([a, b]);
  if (runs.length > 25 || idx.length > 3000) return null;   // qua nhieu thay doi (may ngung lau) -> keo FULL
  var rows = [];
  for (var r = 0; r < runs.length; r++) {
    var vals = sh.getRange(runs[r][0], 1, runs[r][1] - runs[r][0] + 1, CARE_HEADERS.length).getValues();
    for (var v = 0; v < vals.length; v++) { if (vals[v][0]) rows.push(careObjFromRow_(vals[v])); }
  }
  return { delta: true, rows: rows };
}

// Lich hen CHAM SOC cua HOM NAY (khong lay qua han) tu CareData. Tach tu action 'reminders' (4c) de doc duoc Supabase hoac Sheets.
// Cung 1 ham chuyen doi (_remindersFromRows_) cho ca 2 nguon. Khac nhau duy nhat: thu tu ket qua tu Supabase = theo SDT (Sheets: theo thu tu dong).
function readRemindersToday_(csFilter) {
  var sbRows = sbReadRemindersRows_();   // undefined = doc Sheets nhu cu
  if (sbRows !== undefined) return _remindersFromRows_(sbRows, csFilter);
  var ss = getCrmSS_();
  var shR = ss.getSheetByName(SH_CARE);
  if (!shR || shR.getLastRow() < 2) return [];
  return _remindersFromRows_(shR.getDataRange().getValues().slice(1), csFilter);
}
// rows: mang dong CareData (cot 0 SDT, 1 status, 2 zalo, 3 cs, 12 schedHen, 13 schedHenNote) — KHONG gom dong tieu de.
function _remindersFromRows_(rows, csFilter) {
  var today = new Date(); today.setHours(0,0,0,0);
  var reminders = [], seenR = {};
  for (var ri = 0; ri < rows.length; ri++) {
    var rw = rows[ri];
    if (!rw[0]) continue;
    var rcs = String(rw[3]||'').trim();
    if (csFilter && rcs !== csFilter) continue;
    var rhen = rw[12];
    if (!rhen) continue;
    var rdate = new Date(rhen); rdate.setHours(0,0,0,0);
    // CHỈ hẹn TRONG NGÀY hôm nay (không lấy quá hạn) — extension chỉ nhắc lịch của ngày
    if (rdate.getTime() !== today.getTime()) continue;
    // Gộp trùng: mỗi SĐT chỉ 1 nhắc (tránh nhân bản do CareData có dòng trùng)
    var npR = normPhone_(String(rw[0]));
    if (seenR[npR]) continue;
    seenR[npR] = true;
    reminders.push({
      phone: String(rw[0]), schedHen: String(rhen),
      schedHenNote: String(rw[13]||''), cs: rcs,
      status: String(rw[1]||''), zalo: String(rw[2]||''), overdue: false
    });
  }
  return reminders;
}

function findCareByPhone_(phone) {
  var sbc = sbReadCare_(phone);   // che do 'read': doc Supabase; undefined = phai doc Sheets nhu cu (xem khoi SUPABASE cuoi file)
  if (sbc !== undefined) return sbc;
  var ss = getCrmSS_();
  var sh = ss.getSheetByName(SH_CARE);
  if (!sh || sh.getLastRow() < 2) return null;
  var ph = normPhone_(phone);
  // TOI UU TOC DO (06/10/2026): truoc day doc TOAN BO sheet CareData (getDataRange, moi cot) moi
  // lan tra cuu 1 SDT. Gio chi doc 1 COT SDT de tim dong dau tien khop, roi doc dung 1 dong do.
  var last = sh.getLastRow();
  var phoneCol = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < phoneCol.length; i++) {
    if (!phoneCol[i][0]) continue;
    if (normPhone_(phoneCol[i][0]) === ph) {
      var width = Math.max(sh.getLastColumn(), 1);
      var rowVals = sh.getRange(i + 2, 1, 1, width).getValues()[0];
      return careObjFromRow_(rowVals);
    }
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
  var zp = r.zaloPhones;
  if (!Array.isArray(zp)) { try { zp = JSON.parse(zp||'[]'); } catch(e) { zp = []; } }
  return [
    r.phone||'', r.status||'', r.zalo||'', r.cs||'', r.note||'', r.schedules||'',
    r.schedGoi||'', r.schedGoiNote||'', r.schedSP||'', r.schedSPNote||'',
    r.schedCS||'', r.schedCSNote||'', r.schedHen||'', r.schedHenNote||'',
    new Date().toISOString(),
    r.khStatus||'', JSON.stringify(nz), r.birthday||'', setBy||'', r.name||'',
    JSON.stringify(cust), JSON.stringify(zp)
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
      name:      vals[i][19]||'',
      zaloPhones: vals[i][21]||'[]'
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
  // zaloPhones: CHỈ bảo tồn khi client không hề biết đến trường này (undefined/null — gửi
  // thiếu hẳn key, như mọi lời gọi saveSingle/saveBatch có TỪ TRƯỚC khi trường này ra đời).
  // KHÔNG áp dụng "mảng rỗng cũng bảo tồn" như nickZalos ở trên: CRM/Pancake là 2 nơi DUY NHẤT
  // quản lý trường này, và mảng rỗng [] do 2 nơi đó gửi lên nghĩa là Sale CHỦ ĐỘNG xoá hết SĐT
  // (vd bỏ nốt SĐT cuối cùng) — nếu coi rỗng là "chưa gửi" thì sẽ không bao giờ xoá về 0 được.
  if (r.zaloPhones === undefined || r.zaloPhones === null) {
    try { r.zaloPhones = JSON.parse(ex.zaloPhones||'[]'); } catch(e) { r.zaloPhones = []; }
  } else if (!Array.isArray(r.zaloPhones)) {
    try { r.zaloPhones = JSON.parse(r.zaloPhones||'[]'); } catch(e) { r.zaloPhones = []; }
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
    // % hoa hong theo team cho don >=15tr / <15tr (xem COMMISSION_THRESHOLD) - admin cai o
    // "Quan ly Team". Sheet tao truoc khi co tinh nang nay chua co cot nay -> mac dinh {0,0}.
    var ratePct = { above15: 0, below15: 0 };
    try { var rp = v[i][6] ? JSON.parse(v[i][6]) : null; if (rp && typeof rp === 'object') ratePct = { above15: Number(rp.above15)||0, below15: Number(rp.below15)||0 }; } catch(e) {}
    out.push({ id: v[i][0], name: v[i][1]||'', leader: v[i][2]||'', members: members, color: v[i][4]||'', channels: channels, ratePct: ratePct });
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
    // perms: danh sach ID cac tab/menu tai khoan nay DUOC PHEP xem (Admin gan qua modal
    // "Tai khoan"). null/rong = KHONG gioi han (thay theo mac dinh phan quyen vai tro cu),
    // chi khi Admin CHU DONG gioi han moi thu hep lai — tranh tai khoan cu tu dung bi khoa
    // het menu khi nang cap len ban co tinh nang nay.
    var permsArr = null;
    try { var pRaw = v[i][7]; if (pRaw) { var pParsed = JSON.parse(pRaw); if (Array.isArray(pParsed)) permsArr = pParsed; } } catch (e) { permsArr = null; }
    out.push({
      username: String(v[i][0]), passHash: String(v[i][1]||''), role: v[i][2]||'cs',
      name: v[i][3]||'', team: v[i][4]||'',
      active: (v[i][5]===''||v[i][5]===undefined) ? true :
              (v[i][5]===true||v[i][5]==='TRUE'||v[i][5]==='true'||v[i][5]===1),
      names: namesArr,
      perms: permsArr,
      saleType: v[i][8] || '',   // 'online' | 'offline' | '' — dung de tinh Bao cao hoa hong dung chuong trinh thuong
      startDate: v[i][9] || ''   // YYYY-MM-DD — moc "ngay bat dau" de tinh cac muc thuong theo "ngay thu N" (sale thu viec)
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  KHOA BAO MAT + TAI KHOAN TEST (them 2026-10-08)
//  - getGasSource/setGasSource (lay/ghi ma nguon GAS): BAT BUOC co khoa quan tri = gia tri key "adminKey"
//    trong sheet Settings (them 1 dong: key=adminKey, value=chuoi bi mat). Chua dat khoa -> tu choi het.
//  - getSetting khong tra cac key nhay cam: api* (key AI), geminiKey, gasSource*, adminKey, demoToken.
//  - setSetting khong cho ghi adminKey/demoToken/gasSource* neu thieu adminKey.
//  - Tai khoan role "demo": dang nhap qua POST demoLogin -> nhan demoToken. Moi request co token chi duoc goi
//    cac action xem bao cao trong DEMO_ALLOWED_GET_, cac mang dong chi tiet bi cat con DEMO_MAX_ROWS_ dong,
//    moi thao tac ghi (POST) bi tu choi.
//  LUU Y: cac request KHONG co token van chay nhu cu (extension Zalo/Pancake, CS dang dung) — xem docs/TAI-KHOAN-TEST.md.
// ═══════════════════════════════════════════════════════════════
var DEMO_MAX_ROWS_ = 5;
var DEMO_ALLOWED_GET_ = {
  salesReportA: 1, salesReportB: 1, salesReportC: 1, careLeadReport: 1, saleKpiReport: 1, failedOrderReport: 1,
  salesReportOptions: 1, kpiReport: 1, mktChecklist: 1, pancakeReport: 1, pancakeSdtReport: 1,
  pancakePageMap: 1, pancakeNameMap: 1, saleDirectory: 1, saleGroups: 1, teams: 1, mktTeams: 1, getSetting: 1, count: 1,
  orders: 1, careLeads: 1, cskhDuyenLite: 1
};
// Mang dong CHI TIET (don/khach) bi cat con DEMO_MAX_ROWS_. "rows" chi cat o cac action tra danh sach khach/lead
// (o saleKpiReport "rows" la bang KPI tung sale — khong cat).
var DEMO_CLIP_KEYS_ = ['orders', 'ordersCur', 'ordersPrev', 'ordersDetail'];
var DEMO_CLIP_ROWS_ACTIONS_ = { careLeads: 1, careLeadReport: 1, cskhDuyenLite: 1 };
function _secEq_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function _adminKeyOk_(k) { return _secEq_(k, getSetting_('adminKey')); }
function _isSensitiveSettingKey_(key) {
  var k = String(key || '').trim();
  return /^api/i.test(k) || /^geminiKey$/i.test(k) || /^gasSource/i.test(k) || k === 'adminKey' || k === 'demoToken';
}
function _isSensitiveWriteKey_(key) {
  var k = String(key || '').trim();
  return k === 'adminKey' || k === 'demoToken' || /^gasSource/i.test(k);
}
function _demoToken_() {
  var t = getSetting_('demoToken');
  if (!t) {
    t = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    setSetting_('demoToken', t);
  }
  return t;
}
function _demoTokenOk_(tok) { return _secEq_(tok, getSetting_('demoToken')); }
// Cat mang dong chi tiet cho tai khoan test: toi da DEMO_MAX_ROWS_ dong CHO MOI NGUON (cot 'source' cua don, hoac 'kenhBan' o cac
// bao cao). NGUYEN NHAN GOC: truoc day slice(0,5) cat 5 dong DAU CHUNG -> toan bo 5 dong thuong cung 1 nguon (dong dau sheet),
// nguoi test khong thay duoc cac nguon con lai. Dong khong co nguon (mang dong dang mang [phone,name,tier], lead...) -> 5 dong dau.
function _demoSrcOf_(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  var v = it.source != null ? it.source : (it.kenhBan != null ? it.kenhBan : it.nguon);
  return v == null ? null : String(v).trim();
}
function _demoClipPerSource_(arr) {
  var hasSrc = false;
  for (var i = 0; i < arr.length && !hasSrc; i++) { if (_demoSrcOf_(arr[i]) !== null) hasSrc = true; }
  if (!hasSrc) return arr.slice(0, DEMO_MAX_ROWS_);
  var cnt = {}, out = [];
  for (var j = 0; j < arr.length; j++) {
    var sv = _demoSrcOf_(arr[j]); if (sv === null) sv = '';
    cnt[sv] = (cnt[sv] || 0) + 1;
    if (cnt[sv] <= DEMO_MAX_ROWS_) out.push(arr[j]);
  }
  return out;
}
// CHE SDT cho tai khoan test (v13.22). NGUYEN NHAN GOC: truoc day tai khoan test chi bi cat so dong, SDT khach van hien DAY DU
// (ca tren man hinh lan trong file tai ve CSV/XLSX vi client dung chinh du lieu API de xuat file) -> lo so dien thoai that cho nguoi ngoai.
// Nay che 4 SO CUOI ngay tai may chu (sau khi cat dong, truoc khi tra ve) nen moi noi hien/tai deu da bi che, khong the lay lai tu client.
// Che theo GIA TRI (9-12 chu so) chu khong theo ten key, vi key nhu sdtMangVe/soDonChot la SO DEM, khong phai SDT.
// Giu nguyen dang chu so (4 so cuoi -> 0000) de client van parse/loc duoc; so dang number van la number.
var DEMO_PHONE_KEY_RE_ = /phone|sdt|sodienthoai|dienthoai/i;
var DEMO_NOTE_KEY_RE_ = /note|ghichu|noidung|message|content/i;   // truong van ban tu do: che SDT nam trong cau chu
function _demoMaskPhone_(v) {
  var s = String(v), d = s.replace(/\D/g, '');
  if (d.length < 9 || d.length > 12) return v;
  var left = 4, a = s.split('');
  for (var i = a.length - 1; i >= 0 && left > 0; i--) { if (/\d/.test(a[i])) { a[i] = '0'; left--; } }
  var r = a.join('');
  return typeof v === 'number' ? Number(r) : r;
}
function _demoMaskText_(t) {
  return String(t).replace(/(^|[^\d])(0\d{9}|84\d{9})(?!\d)/g, function(m, pre, ph) { return pre + _demoMaskPhone_(ph); });
}
var DEMO_PHONE_STR_RE_ = /^\+?\d[\d .\-]{7,14}\d$/;
function _demoMaskDeep_(node) {
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var it = node[i];
      if (it && typeof it === 'object') _demoMaskDeep_(it);
      else if (typeof it === 'string' && DEMO_PHONE_STR_RE_.test(it.trim())) node[i] = _demoMaskPhone_(it);   // dong dang mang [sdt, ten]
    }
    return node;
  }
  if (!node || typeof node !== 'object') return node;
  Object.keys(node).forEach(function(k) {
    var v = node[k];
    if (v && typeof v === 'object') { _demoMaskDeep_(v); return; }
    if (typeof v !== 'string' && typeof v !== 'number') return;
    if (DEMO_PHONE_KEY_RE_.test(k)) node[k] = _demoMaskPhone_(v);
    else if (typeof v === 'string' && DEMO_NOTE_KEY_RE_.test(k)) node[k] = _demoMaskText_(v);
  });
  return node;
}
function _demoClip_(out, action) {
  var o;
  try { o = JSON.parse(out.getContent()); } catch (e) { return out; }
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    var keys = DEMO_CLIP_KEYS_.slice();
    if (DEMO_CLIP_ROWS_ACTIONS_[action]) keys.push('rows');
    keys.forEach(function(k) {
      if (Array.isArray(o[k]) && o[k].length > DEMO_MAX_ROWS_) {
        o['_demoTotal_' + k] = o[k].length;
        o[k] = _demoClipPerSource_(o[k]);
      }
    });
    // NGUYEN NHAN GOC (nguon CSKH-Duyen): cskhDuyenLite tra kem total/noPhone (so that ~134k) va noPhoneSample (toi da 20 TEN khach that,
    // khong che) — cat 5 dong 'rows' nhung cac truong nay van lo du lieu that cho tai khoan test. Nay chi con dung 5 dong da cat.
    if (action === 'cskhDuyenLite' || action === 'cskhDuyen') {
      var _nCk = Array.isArray(o.rows) ? o.rows.length : 0;
      delete o._demoTotal_rows;
      o.total = _nCk; o.noPhone = 0; o.noPhoneSample = [];
    }
    o._demo = true;
  }
  _demoMaskDeep_(o);
  return jsonOut_(o);
}
// Dang nhap tai khoan test: kiem tra user role "demo" trong sheet Users (passHash do client gui len).
function demoLogin_(data) {
  var uname = String((data && data.username) || '').trim().toLowerCase();
  var ph = String((data && data.passHash) || '');
  if (!uname || !ph) return jsonOut_({ ok: false, error: 'Thieu tai khoan/mat khau' });
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (String(u.username).trim().toLowerCase() !== uname) continue;
    if (u.role !== 'demo' || u.active === false) break;
    if (_secEq_(u.passHash, ph)) return jsonOut_({ ok: true, token: _demoToken_(), name: u.name || u.username });
    break;
  }
  return jsonOut_({ ok: false, error: 'Sai tai khoan hoac mat khau' });
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = p.action || '';
  if (action === 'getSetting' && _isSensitiveSettingKey_(p.key)) return jsonOut_({ value: null });
  if (action === 'getGasSource' && !_adminKeyOk_(p.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de lay ma nguon GAS.' });
  if (p.demo) {
    if (!_demoTokenOk_(p.demo)) return jsonOut_({ error: 'Phien tai khoan test khong hop le — dang nhap lai.' });
    if (DEMO_ALLOWED_GET_[action] !== 1) return jsonOut_({ error: 'Tai khoan test khong duoc phep thao tac nay.' });
    return _demoClip_(doGetCore_(e), action);
  }
  return doGetCore_(e);
}

// ═══════════════════════════════════════════════════════════════
//  doGet
// ═══════════════════════════════════════════════════════════════
function doGetCore_(e) {
  try {
    var ss = getCrmSS_();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    // ── lookup theo phone (ZaloAI extension) ──
    // donOrdersByPhone: cac don POS (sheet 'du lieu don') cua 1 SDT -- Sasum dung cho muc "Lich su dat hang": KH da co don Pos thi
    // chi hien don Pos (Pos la chuan; don len Base cung da co tren Pos), BO QUA don Base. Moi don: ngay ISO, san pham, doanh thu sau giam, nguon...
    if (action === 'donOrdersByPhone') {
      var phDo = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phDo) return jsonOut_({ ok: false, error: 'Thieu phone' });
      return jsonOut_({ ok: true, orders: getDonOrdersByPhone_(phDo) });
    }
    // cskhDetail: CHI chi tiet CSKH-Duyen cua 1 SDT (Sasum tab Tong quan, lazy khi CS mo ho so).
    // Nhe hon 'lookup' rat nhieu: KHONG doc CareData/Orders, chi findCskhRowsByPhone_ (index SDT + vai dong). Cache 60s theo SDT.
    if (action === 'cskhDetail') {
      var phCk = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phCk) return jsonOut_({ ok: false, error: 'Thieu phone' });
      var cacheCk = CacheService.getScriptCache();
      var cKeyCk = 'ckd_' + normPhone_(phCk);
      var hitCk = cacheCk.get(cKeyCk);
      if (hitCk) { try { return jsonOut_(JSON.parse(hitCk)); } catch (eh) {} }
      var resCk = { ok: true, cskh: findCskhRowsByPhone_(phCk) };
      try { cacheCk.put(cKeyCk, JSON.stringify(resCk), 60); } catch (ep) {}
      return jsonOut_(resCk);
    }
    if (action === 'lookup') {
      var phone = (e && e.parameter && e.parameter.phone) ? String(e.parameter.phone) : '';
      if (!phone) return jsonOut_({ error: 'Thieu phone' });
      var cache = CacheService.getScriptCache();
      var cKey = 'lk_' + normPhone_(phone);
      var cached = cache.get(cKey);
      if (cached) { try { return jsonOut_(JSON.parse(cached)); } catch(ec) {} }
      var res = { ok: true, care: findCareByPhone_(phone), orders: readOrdersByPhone_(phone), cskh: findCskhRowsCached_(phone), don: findDonRowsByPhone_(phone) };
      try { cache.put(cKey, JSON.stringify(res), 15); } catch(ec) {}
      return jsonOut_(res);
    }

    // ── danh sach KH + trang thai CS (appweb + extension) ──
    if (action === 'customers') {
      var sinceC = (e && e.parameter && e.parameter.since) ? String(e.parameter.since) : '';
      if (sinceC) {
        var sbDlt = sbReadCareDelta_(sinceC);   // Supabase buoc 4e-1; undefined = doc Sheets nhu cu, null = qua nhieu thay doi -> keo FULL
        var dlt = sbDlt !== undefined ? sbDlt : readCareDelta_(ss.getSheetByName(SH_CARE), sinceC);
        if (dlt) return jsonOut_(dlt);   // chi cac dong doi (khong kem careStatus — client lay o lan keo FULL)
      }
      var cache2 = CacheService.getScriptCache();
      var cKey2  = 'customers_v12';
      var cached2 = cache2.get(cKey2);
      if (cached2) { try { return jsonOut_(JSON.parse(cached2)); } catch(ec) {} }
      var sbAllRows = sbReadCareAll_();   // Supabase buoc 4e-2; undefined = doc Sheets nhu cu
      var res2 = { rows: sbAllRows !== undefined ? sbAllRows : readCare_(ss.getSheetByName(SH_CARE)), careStatus: readCareStatus_(ss) };
      try { cache2.put(cKey2, JSON.stringify(res2), 300); } catch(ec) {}
      return jsonOut_(res2);
    }

    if (action === 'orders') {
      // TOI UU (v13.20): NGUYEN NHAN GOC cham — action nay doc NGUYEN sheet DT TONG moi lan, khong cache, ma moi tab CRM dang mo
      // keo no dinh ky -> N CS = N lan doc toan sheet moi chu ky. Nay cache 45s (_cachePutBig_ chia manh, vuot gioi han 100KB/key);
      // xoa ngay khi CRM ghi DT TONG (patchOrder_/deleteOrder_/deleteDuplicateOrders_/dedup/import). Sua tay tren Sheet: toi da 45s.
      // KHONG cache khi co dong loi doc (de lan sau thu lai + app tiep tuc canh bao).
      var _ordCached = _cacheGetBig_('orders_v1');
      if (_ordCached) { try { return jsonOut_(JSON.parse(_ordCached)); } catch (ecOrd) {} }
      var _ordersOut = readAllOrders_();
      var _ordersResp = { orders: _ordersOut };
      // Neu co dong bi loi khi doc, bao ve ngoai response (khong chi nam trong Logger.log noi
      // bo) de app hien canh bao ro rang thay vi am tham coi so dong doc duoc la toan bo su that.
      if (readAllOrders_.lastErrorCount) {
        _ordersResp.errorCount = readAllOrders_.lastErrorCount;
        _ordersResp.errorSample = readAllOrders_.lastErrorSample;
      } else {
        try { _cachePutBig_('orders_v1', JSON.stringify(_ordersResp), 45); } catch (ecOrd2) {}
      }
      return jsonOut_(_ordersResp);
    }
    if (action === 'teams')     return jsonOut_({ teams: readTeams_(ss.getSheetByName(SH_TEAM)) });
    if (action === 'mktTeams')  return jsonOut_({ teams: readMktTeams_() });
    if (action === 'users')     return jsonOut_({ users: readUsers_(ss.getSheetByName(SH_USER)) });
    // ── Bao cao Pancake (nhap tu file Excel "Thong ke tuong tac") ──
    if (action === 'pancakeNameMap') return jsonOut_({ map: readPancakeMap_(), allNames: pancakeAllNames_() });
    if (action === 'pancakeReport')  return jsonOut_(buildPancakeReport_(e.parameter.from, e.parameter.to, e.parameter.split));
    // ── Bao cao SDT mang ve/don chot Pancake (nhap tu file "Thong ke nhan vien") ──
    if (action === 'pancakeSdtReport') return jsonOut_(buildPancakeSdtReport_(e.parameter.from, e.parameter.to, e.parameter.split));
    // ── Khop Page Pancake (pageId) <-> Kenh ban chuan trong DT TONG ──
    if (action === 'pancakePageMap') return jsonOut_({ map: readPancakePageMap_(), allPages: pancakeAllPages_() });
    // ── Bao cao KPI tong hop (DT TONG + Pancake tuong tac + SDT) ──
    if (action === 'kpiReport') {
      var pKpiSale = (e.parameter.sale || '').split(',').map(function(s){return s.trim();}).filter(function(s){return s;});
      return jsonOut_(buildKpiReport_(e.parameter.from, e.parameter.to, pKpiSale));
    }
    if (action === 'saleDirectory') return jsonOut_(readSaleDirectory_());
    if (action === 'saleGroups') return jsonOut_({ ok: true, groups: readSaleGroups_() });
    // ── Nguon "Cham soc" (KH them nhanh, sheet rieng) — khong gop CareData/bao cao A-B-C ──
    if (action === 'careLeads') return jsonOut_({ rows: readCareLeads_() });
    // ── Nguon "CSKH-Duyên" (sheet thu 3, cung file DT TONG) — CRM gop vao khach theo SDT, xem readCskhDuyen_ ──
    if (action === 'cskhDuyen') { var rowsCk = readCskhDuyen_(); return jsonOut_({ ok: true, found: rowsCk.found, rows: rowsCk.rows, total: rowsCk.total, noPhone: rowsCk.noPhone, noPhoneSample: rowsCk.noPhoneSample, cols: rowsCk.cols }); }
    // Ban NHE cho FE keo hang loat (xem readCskhDuyenLite_) — FE da goi action nay tu truoc
    // nhung backend truoc day CHUA CO handler, khien danh sach CSKH-Duyên khong len duoc tren CRM.
    if (action === 'cskhDuyenLite') {
      var liteCk = readCskhDuyenLite_();
      return jsonOut_({ ok: true, found: liteCk.found, rows: liteCk.rows, total: liteCk.total, noPhone: liteCk.noPhone, noPhoneSample: liteCk.noPhoneSample });
    }
    // ── Tap SDT co trong "dữ liệu đơn" — chi de loc nguon o man hinh chinh (cache 10') ──
    // Danh sach san pham (ma + ten) trong "du lieu don" cho o tim/tick san pham cua Chuong trinh thuong (cache 10').
    if (action === 'donProducts') {
      var cachedDPr = _cacheGetBig_('don_products_v1');
      if (cachedDPr) { try { return jsonOut_(JSON.parse(cachedDPr)); } catch (ecP) {} }
      var resDPr = { ok: true, products: buildDonProducts_() };
      try { _cachePutBig_('don_products_v1', JSON.stringify(resDPr), 600); } catch (ecP2) {}
      return jsonOut_(resDPr);
    }
    if (action === 'donPhones') {
      // TOI UU (v13.20): NGUYEN NHAN GOC cham — (1) goi readDonChiTiet_() NAM LAN (moi ham getDon*_ tu doc lai, tuc 5 lan
      // JSON.parse mang don lon, hoac 5 lan doc sheet khi cache 'donChiTiet_v4' het han); (2) cache.put 1 key duy nhat bi gioi han
      // 100KB nen payload nay (5 map theo SDT) gan nhu chac chan THAT BAI AM THAM -> khong bao gio duoc cache. Nay doc 1 LAN roi
      // truyen rows vao 5 ham, va cache qua _cachePutBig_ (chia manh) TTL 90s bang dung TTL cua 'donChiTiet_v4' (xoa cung luc, xem 'don_phones_v6_n').
      var cachedDP = _cacheGetBig_('don_phones_v6');
      if (cachedDP) { try { return jsonOut_(JSON.parse(cachedDP)); } catch(ec) {} }
      var rowsDP = readDonChiTiet_();
      var resDP = { phones: readDonPhones_(rowsDP), saleByPhone: getDonSaleByPhone_(rowsDP), orderCountByPhone: getDonOrderCountByPhone_(rowsDP), lastDateByPhone: getDonLastDateByPhone_(rowsDP), statsByPhone: getDonStatsByPhone_(rowsDP) };
      try { _cachePutBig_('don_phones_v6', JSON.stringify(resDP), 90); } catch(ec) {}
      return jsonOut_(resDP);
    }

    // ── Tra cuu bang gia (Sheet DANH_MUC, file rieng PRICE_SS_ID) — dung chung cho
    // portal/Sasum/Pancake. Tim khong dau, khop tren MOI cot dang text cua sheet, khong
    // can biet truoc ten cot (tu doc dong tieu de dong 1). ──
    if (action === 'priceSearch') {
      var q = (e && e.parameter && e.parameter.q) ? String(e.parameter.q) : '';
      var cachePS = CacheService.getScriptCache();
      var cKeyPS = 'price_catalog_v4';
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

    // ── Tra cuu CHUONG TRINH KHUYEN MAI (Sheet CTKM, cung file PRICE_SS_ID voi DANH_MUC) —
    // tra cuu TRUC TIEP theo tu khoa (giong het co che priceSearch o tren, dung lai
    // searchPriceCatalog_ vi ham do khong hardcode ten cot/sheet), KHONG qua AI — de dung duoc
    // ngay ca khi cac API AI (Groq/Cerebras/Gemini/OpenRouter) dang loi (yeu cau Duyen 26/09/2026).
    if (action === 'ctkmSearch') {
      var qCT = (e && e.parameter && e.parameter.q) ? String(e.parameter.q) : '';
      var cacheCT = CacheService.getScriptCache();
      var cKeyCT = 'ctkm_search_catalog_v1'; // key rieng, KHONG trung voi 'ctkm_catalog_v1' cua action ctkmCatalog (dung _cacheGetBig_/_cachePutBig_ khac co che)
      var cachedCT = cacheCT.get(cKeyCT);
      var rowsCT;
      if (cachedCT) { try { rowsCT = JSON.parse(cachedCT); } catch(ec) {} }
      if (!rowsCT) {
        rowsCT = readCTKMCatalog_();
        try { cacheCT.put(cKeyCT, JSON.stringify(rowsCT), 600); } catch(ec) {} // cache 10 phut, CTKM it doi
      }
      var matchedCT = qCT ? searchPriceCatalog_(rowsCT, qCT) : rowsCT.slice(0, 50);
      return jsonOut_({ ok: true, total: rowsCT.length, count: matchedCT.length, rows: matchedCT });
    }

    // ── TIM ANH SAN PHAM (cot "Link ảnh sản phẩm" CS da dien san trong DANH_MUC, chua link
    // Google Drive) — theo yeu cau Duyen 30/09/2026: thu hep dan giong "Soan don" (Nhom SP ->
    // Ten SP -> Kieu/Size -> Chat lieu, deu co the bo trong) de tim dung bien the, thay vi chi
    // go ten tu do roi doan dai nhat (de nham khi 1 ten co nhieu Size/Chat lieu khac anh nhau).
    if (action === 'productImageFlat') {
      var cacheKeyPIF = 'product_img_flat_v1';
      var cachePIF = CacheService.getScriptCache();
      var cachedPIF = cachePIF.get(cacheKeyPIF);
      if (cachedPIF) { try { return jsonOut_(JSON.parse(cachedPIF)); } catch (ecPIF) {} }
      var resultPIF = buildProductImageFlat_();
      try { if (resultPIF.ok) cachePIF.put(cacheKeyPIF, JSON.stringify(resultPIF), 600); } catch (ecPIF2) {} // cache 10 phut
      return jsonOut_(resultPIF);
    }
    if (action === 'driveImageFromLink') {
      var linkParam = (e && e.parameter && e.parameter.link) ? String(e.parameter.link) : '';
      return jsonOut_(driveImageFromLinkAction_(linkParam));
    }

    // ── CHECKLIST CHAT LUONG TIN NHAN MKT (tab "Checklist MKT" tren index.html) ──
    if (action === 'mktChecklist') return jsonOut_(buildMktChecklistReport_(e.parameter.from, e.parameter.to));

    // ─── Danh muc PHANG cho "Soan don" (Pancake AI): tra cuu theo ten -> dropdown thu hep dan ───
    if (action === 'priceCatalogFlat') {
      var flatJson = _cacheGetBig_('price_flat_v3');
      if (!flatJson) {
        flatJson = JSON.stringify(buildPriceCatalogFlat_());
        _cachePutBig_('price_flat_v3', flatJson, 600); // cache 10 phut, sheet gia it doi
      }
      return ContentService.createTextOutput(flatJson).setMimeType(ContentService.MimeType.JSON);
    }
    // ─── CTKM (Sheet CTKM, cung file PRICE_SS_ID, nam canh sheet DANH_MUC) cho "Soan don" cua
    // Pancake AI: tra ve NGUYEN VAN toan bo dong (khong loc theo tu khoa nhu readCTKMPromotions_,
    // vi o day CS can XEM DUOC het cac CTKM dang co de tu doi chieu, khong phai dang hoi AI).
    // Cache 10 phut, giong het cach lam voi bang gia — CTKM cung it doi trong ngay. ──
    if (action === 'ctkmCatalog') {
      var ctkmJson = _cacheGetBig_('ctkm_catalog_v1');
      if (!ctkmJson) {
        ctkmJson = JSON.stringify({ ok: true, rows: readCTKMCatalog_() });
        _cachePutBig_('ctkm_catalog_v1', ctkmJson, 600);
      }
      return ContentService.createTextOutput(ctkmJson).setMimeType(ContentService.MimeType.JSON);
    }
    // ─── Cay Nhom SP → Ten SP → Kieu/Size (ban cu, giu tuong thich) ───
    if (action === 'priceCatalogTree') {
      var treeJson = _cacheGetBig_('price_tree_v4');
      if (!treeJson) {
        treeJson = JSON.stringify(buildPriceCatalogTree_());
        _cachePutBig_('price_tree_v4', treeJson, 600);
      }
      return ContentService.createTextOutput(treeJson).setMimeType(ContentService.MimeType.JSON);
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
    if (action === 'teamAnalysis') return teamAnalysis_(e.parameter || {});
    if (action === 'orgOverview') return orgOverview_(e.parameter || {});
    if (action === 'saleKpiReport') {
      var pF = e.parameter || {};
      var fF = { dateFrom: pF.dateFrom || '', dateTo: pF.dateTo || '',
                 dateField: pF.dateField || 'ngayTao',
                 sale: pF.sale ? pF.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pF.kenh ? pF.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pF.sanPham || '', byCreator: false };
      return jsonOut_(buildSaleKpiReport_(fF));
    }
    // ── BAO CAO G: Don bi loai (Huy/Da hoan/Dang hoan/Hoan tien...) — NGUON POS ("dữ liệu đơn"), cung bo loc voi B ──
    // SUA 2026-10-03 theo yeu cau Duyen: G truoc doc "DT TỔNG " (Base) nen so don bi loai lech voi E/F (da Pos).
    if (action === 'failedOrderReport') {
      var pG = e.parameter || {};
      var splitG_ = function(s){ return s ? s.split(',').map(function(x){return x.trim();}).filter(function(x){return x;}) : []; };
      var fG = { dateFrom: pG.dateFrom || '', dateTo: pG.dateTo || '',
                 sale: splitG_(pG.sale), nguon: splitG_(pG.nguon), marketer: splitG_(pG.marketer),
                 sanPham: pG.sanPham || '' };
      var cacheG = CacheService.getScriptCache();
      var cKeyG = 'salesG_pos3_' + JSON.stringify(fG);
      var cachedG = cacheG.get(cKeyG);
      if (cachedG) { try { return jsonOut_(JSON.parse(cachedG)); } catch(ec) {} }
      var resG = buildFailedOrderReport_(fG);
      try { cacheG.put(cKeyG, JSON.stringify(resG), 120); } catch(ec) {}
      return jsonOut_(resG);
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
      var cKeyB = 'salesB4_' + JSON.stringify(fB);
      var cachedB = cacheB.get(cKeyB);
      if (cachedB) { try { return jsonOut_(JSON.parse(cachedB)); } catch(ec) {} }
      var resB = buildSalesReportB_(fB);
      try { cacheB.put(cKeyB, JSON.stringify(resB), 120); } catch(ec) {}
      return jsonOut_(resB);
    }
    // So lieu ca nhan cua 1 CS cho extension Pancake AI (chi doc) — xem buildCsStats_.
    if (action === 'csStats') {
      var pCs = e.parameter || {};
      var cacheCs = CacheService.getScriptCache();
      var cKeyCs = 'csStats1_' + (pCs.cs || '') + '|' + (pCs.dateFrom || '') + '|' + (pCs.dateTo || '');
      try { var cachedCs = cacheCs.get(cKeyCs); if (cachedCs) return jsonOut_(JSON.parse(cachedCs)); } catch(ecs) {}
      var resCs = buildCsStats_(pCs.cs, pCs.dateFrom, pCs.dateTo);
      if (resCs && resCs.ok) { try { cacheCs.put(cKeyCs, JSON.stringify(resCs), 90); } catch(ecs2) {} }
      return jsonOut_(resCs);
    }
    if (action === 'salesReportOptions') return jsonOut_(getSalesReportOptions_());
    // ── TACH TEN KH: xem truoc danh sach ten doan duoc tu don hang (chua ghi gi) ──
    if (action === 'previewCustomerNameGuesses') return jsonOut_(previewCustomerNameGuesses_());
    if (action === 'salesReportC') {
      var pC = e.parameter || {};
      var fC = { dateField: pC.dateField || 'ngayTao', periodType: pC.periodType || 'week',
                 weekOffset: pC.weekOffset || 0, monthOffset: pC.monthOffset || 0, quarterOffset: pC.quarterOffset || 0, yearOffset: pC.yearOffset || 0,
                 customCurFrom: pC.customCurFrom || '', customCurTo: pC.customCurTo || '',
                 customPrevFrom: pC.customPrevFrom || '', customPrevTo: pC.customPrevTo || '',
                 sale: pC.sale ? pC.sale.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 kenh: pC.kenh ? pC.kenh.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [],
                 sanPham: pC.sanPham || '',
                 byCreator: pC.byCreator === '1' || pC.byCreator === 'true' };
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
      var fD = { dateFrom: pD.dateFrom || '', dateTo: pD.dateTo || '',
                 cs: pD.cs ? pD.cs.split(',').map(function(s){return s.trim();}).filter(function(s){return s;}) : [] };
      return jsonOut_(buildCareLeadReport_(fD));
    }

    // SUA 2026-10-08: them loc tuy chon theo ?csName= — dung cho Pancake AI (muc "Data duoc chia",
    // xem renderAssignTab_ trong pancake-content.js) de CHI tai ve cac dot chia CUA DUNG 1 CS thay
    // vi toan bo assignHistory (co the rat nang khi nhieu CS/nhieu dot chia cong lai). Khong truyen
    // csName (CRM van goi nhu cu) -> tra ve DAY DU nhu truoc, khong doi hanh vi cu.
    if (action === 'assign') {
      var allAssignH_ = readAssign_(ss.getSheetByName(SH_ASSIGN));
      var csFilterA_ = (e.parameter && e.parameter.csName) ? String(e.parameter.csName).trim() : '';
      if (csFilterA_) allAssignH_ = allAssignH_.filter(function(h) { return h.csName === csFilterA_; });
      return jsonOut_({ assignHistory: allAssignH_ });
    }
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
      return jsonOut_({ orderRows: totalOrders, careRows: shC ? Math.max(0, shC.getLastRow()-1) : 0, ver: 'v13.23-supabase-dualwrite' });
    }

    // ── lich hen hom nay / qua han (ZaloAI extension) ──
    if (action === 'reminders') {
      var csFilter = (e && e.parameter && e.parameter.cs) ? String(e.parameter.cs) : '';
      return jsonOut_({ reminders: readRemindersToday_(csFilter) });
    }

    // ── lay 1 setting (ZaloAI extension: careStatus, nickZaloList) ──
    if (action === 'getSettings') {   // nhieu key 1 lan: ?keys=a,b,c  -> { values: {a:..., b:...} }
      var skeys = (e && e.parameter && e.parameter.keys) ? String(e.parameter.keys).split(',') : [];
      return jsonOut_({ values: getSettingsMulti_(skeys.slice(0, 30)) });
    }
    if (action === 'getSetting') {
      var skey = (e && e.parameter && e.parameter.key) ? String(e.parameter.key) : '';
      return jsonOut_({ value: getSetting_(skey) });
    }

    // ── lay ma nguon gas_v13.js (nut "Copy Apps Script Code" trong index.html) — luu cac
    // manh (chunk) qua getSetting_/setSetting_ (key gasSourceChunk_0, _1, ...) vi 1 o tinh Sheet
    // gioi han 50.000 ky tu, code hien ~330k ky tu nen phai chia manh. Xem setGasSource (doPost)
    // — moi lan Duyen sua xong gas_v13.js VA da Deploy lai thu cong, phai vao CRM > nut Google
    // Sheets > dan lai code moi + bam "Dong bo" 1 lan de nut Copy luon dua dung ban moi nhat.
    if (action === 'getGasSource') {
      var gsChunks = parseInt(getSetting_('gasSourceChunkCount') || '0', 10) || 0;
      var gsCode = '';
      for (var gci = 0; gci < gsChunks; gci++) gsCode += (getSetting_('gasSourceChunk_' + gci) || '');
      return jsonOut_({ code: gsCode, chunks: gsChunks, updatedAt: getSetting_('gasSourceUpdatedAt') || null });
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
    // ── LUU TRU DON CU: xem truoc (dry-run) so dong se chuyen. Can adminKey. &months=6..12 &which=base|pos|both ──
    if (action === 'archivePreview') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de xem truoc luu tru don cu.' });
      return jsonOut_(archiveOldOrders_({ months: e.parameter.months, which: e.parameter.which, dryRun: true }));
    }
    // ── SUPABASE (buoc 2b): kiem tra ket noi. Can adminKey ──
    if (action === 'sbPing') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbPing_());
    }
    // ── SUPABASE (buoc 3a): xem che do / STALE / danh sach dirty. Can adminKey ──
    if (action === 'sbStatus') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbStatus_());
    }
    // ── SUPABASE (buoc 2d): doi chieu CareData Sheet vs Supabase (&sample=1..300). Can adminKey ──
    if (action === 'sbCompareCare') {
      if (!_adminKeyOk_(e && e.parameter ? e.parameter.adminKey : '')) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbCompareCare_({ sample: e.parameter.sample }));
    }

    // ── MAU TIN NHAN TU VAN KHACH: danh sach mau (CRM tab ZALO AI va extension Pancake AI dung chung) ──
    if (action === 'messageTemplates') {
      return jsonOut_({ templates: readMessageTemplates_() });
    }

    // ── MAU AI DA HOC (sheet AIContext, type combo_template): CRM xem/sua/xoa ──
    if (action === 'aiExamples') {
      return jsonOut_({ examples: readAIExamples_() });
    }

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
// SUA 2026-10-04: 15 -> 17 (them cot P + Q). Cot Q (index 16) = GHI CHU don ("Ghép cùng đơn" + ma bo dem
// don goc ben Base) — readDonChiTiet_ doc them cot nay. Dung chung cho _autoDedupExactRowsInSheet_: nang
// len 17 de 2 dong giong het A:O nhung KHAC ghi chu Q (vd 2 don ghep khac nhau) KHONG bi xoa nham la trung.
var DON_CHITIET_WIDTH = 17; // A:Q
var DON_COL_GHICHU = 16;    // cot Q (thu 17) trong "dữ liệu đơn"


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
// Sentinel dung thay cho "instanceof Date" khi gia tri tho cua "DT TỔNG " di qua cache (xem
// _readDTTongRawValuesCached_) — JSON.stringify bien Date thanh chuoi ISO, mat instanceof Date.
var DT_DATE_SENTINEL_ = '\u0000__DATE__\u0000';

// Chuyen 1 hang tho cua DT TONG thanh object "don hang" (giu ten truong nhu ORDER_HEADERS
// cu de cac cho khac trong code/frontend it phai sua nhat co the)
function dtRowToOrder_(row, rowIndex) {
  var dtVal = _dtCellToVnStr_(row[DT_COL_THOIGIANHT]);
  var ngayTaoStr = _dtCellToVnStr_(row[DT_COL_NGAYTAO]);
  var d = parseVNDate_(dtVal);
  return {
    id: row[DT_COL_ID] != null ? String(row[DT_COL_ID]) : '',
    rowIndex: rowIndex,
    phone: normPhone_(String(row[DT_COL_PHONE] || '')),
    name: '', // KHONG co san ten khach rieng trong DT TONG (chi co SDT), de trong
    date: dtVal || ngayTaoStr || '',
    // orderDate: LUON la Ngay tao, KHONG bao gio doi theo trang thai don (khac voi 'date' o
    // tren, von chuyen sang Thoi gian hoan thanh ngay khi don duoc danh dau xong). Dung field
    // nay lam moc goc cho cac tinh toan can ON DINH qua thoi gian (vd: lich nhac auto Data Dao
    // +7/+14 ngay) — neu dung 'date' cu, moc goc se nhay sang ngay khac ngay khi don hoan thanh,
    // lam ID lich nhac doi theo va khien lich da xoa/da lam bi tao lai y het (bug da gap).
    orderDate: ngayTaoStr || '',
    year: d ? _vnYmdParts_(d).y : '',
    month: d ? _vnYmdParts_(d).mo : '',
    cs: String(row[DT_COL_SALEBAN] || ''),   // cot "Sale bán" — sale tham gia ban (co the nhieu ten, tach bang dau phay)
    creator: row[1] ? String(row[1]).trim() : '',   // cot B "Người tạo" cua DT TONG = NGUOI LEN DON (xem readDTTong_ nguoiTao)
    source: row[DT_COL_KENHBAN] ? String(row[DT_COL_KENHBAN]).trim() : '',
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
  // Reset thong ke loi cua lan goi truoc (doc qua readAllOrders_.lastErrorCount/lastErrorSample
  // NGAY SAU khi goi ham nay trong cung 1 request — dung de tra ve kem theo response cho action
  // 'orders', tranh tinh trang loi hang loat bi NUOT AM THAM chi con thay trong Logger.log rieng
  // ma khong ai de y — xem bug ngay 20/09: 1 dong loi -> ca readAllOrders_ throw -> 'orders'
  // tra error -> app KHONG rebuild allCustomers (giu nguyen ban cu, van con du 2k2 KH, khong ai
  // phat hien). Sau khi them try/catch (giao dien am tham hon), N dong loi bi bo qua -> chi con
  // vai dong song sot -> app REBUILD allCustomers day du nhung chi voi vai KH — mat du lieu am
  // tham con nguy hiem hon ban dau. Phai bao loi ro ra ngoai thay vi chi Logger.log noi bo.
  readAllOrders_.lastErrorCount = 0;
  readAllOrders_.lastErrorSample = '';
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  // QUAN TRONG: truoc day dong nay la `if (!sh || sh.getLastRow() < 2) return [];` — gop chung
  // 2 truong hop rat khac nhau vao 1 nhanh IM LANG (khong loi, khong log): (a) sheet CO ton tai
  // nhung chua co don nao (hop le, dung tra ve rong) va (b) sheet KHONG con ton tai/bi doi ten
  // (vd DT_TONG_SHEET = 'DT TỔNG ' co dau cach cuoi rat de bi xoa nham khi co ai sua sheet, hoac
  // DT_SS_ID tro sang spreadsheet khac/mat quyen truy cap) — day la LOI THAT nhung truoc day bi
  // nuot am tham thanh "0 don", khien app chi con hien vai KH tu luu tay (careLeads) ma khong ai
  // biet ly do vi khong co canh bao nao ca. Tach rieng: sheet KHONG ton tai -> throw ro rang
  // (doGet se bat va tra { error: ... } cho client hien canh bao that su); sheet CO ton tai nhung
  // rong -> van tra ve [] nhu cu (hop le, khong phai loi).
  if (!sh) {
    throw new Error('Khong tim thay sheet "' + DT_TONG_SHEET + '" trong spreadsheet don hang (DT_SS_ID) — kiem tra sheet co bi doi ten/xoa khong, hoac DT_SS_ID co con dung khong.');
  }
  if (sh.getLastRow() < 2) return [];
  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last - 1, DT_TONG_WIDTH).getValues();
  var out = [];
  var errCount = 0, firstErr = '';
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!r[DT_COL_PHONE] && !r[DT_COL_ID]) continue; // dong rong
    try {
      out.push(dtRowToOrder_(r, i + 2));
    } catch (eRow) {
      // 1 dong loi (vd gia tri ngay bat thuong) KHONG duoc lam hong ca danh sach — bo qua
      // rieng dong do, ghi log de con dieu tra, cac dong khac van doc binh thuong.
      errCount++;
      var msg = 'dong ' + (i + 2) + ': ' + (eRow && eRow.message ? eRow.message : eRow);
      if (!firstErr) firstErr = msg;
      Logger.log('readAllOrders_: loi doc dong ' + (i + 2) + ': ' + eRow);
    }
  }
  readAllOrders_.lastErrorCount = errCount;
  readAllOrders_.lastErrorSample = firstErr;
  return out;
}

// Cac don cua 1 SDT trong sheet "dữ liệu đơn" (Base/Pos): ngay, danh sach SALE THAM GIA DON (cot "Thẻ" da loc tag/trang thai bang
// _donSaleNamesFromThe_), kenh, san pham (cat ngan), gia tri. Dung cho extension (action=lookup -> don). Loi doc sheet khong lam hong lookup.
function findDonRowsByPhone_(phone) {
  var ph = normPhone_(phone), out = [];
  try {
    var sbRows = ph ? sbReadDonByPhone_(ph) : undefined;   // Supabase buoc 4c; undefined = doc Sheets nhu cu
    var rows = sbRows !== undefined ? sbRows : readDonChiTiet_();
    for (var i = 0; i < rows.length; i++) {
      if (normPhone_(String(rows[i].soDienThoai || '')) !== ph) continue;
      out.push({
        date: String(rows[i].ngayTaoDon || ''),
        sales: _donSaleNamesFromThe_(rows[i].theSale),
        source: String(rows[i].nguonDon || ''),
        product: String(rows[i].sanPham || '').slice(0, 80),
        value: rows[i].giaTriSauGiam || 0,
        marketer: String(rows[i].marketer || '')
      });
    }
  } catch (e) { Logger.log('findDonRowsByPhone_: ' + e); }
  return out.length > 30 ? out.slice(out.length - 30) : out;
}

function readOrdersByPhone_(phone) {
  var ph0 = normPhone_(phone);
  if (ph0) {
    var sbo = sbReadOrdersByPhone_(ph0);   // Supabase buoc 4c; undefined = doc Sheets nhu cu
    if (sbo !== undefined) return _dedupeSameOrders_(sbo);
  }
  return _readOrdersByPhoneSheets_(phone);
}

// Khu trung dong GIONG HET (cung ngay+doanh thu+san pham) — dung chung cho duong doc Sheets va Supabase.
function _dedupeSameOrders_(out) {
  var seen = {}, deduped = [];
  for (var k = 0; k < out.length; k++) {
    var key = String(out[k].date) + '|' + String(out[k].revenue) + '|' + String(out[k].product);
    if (!seen[key]) { seen[key] = true; deduped.push(out[k]); }
  }
  return deduped;
}

function _readOrdersByPhoneSheets_(phone) {
  var ph = normPhone_(phone);
  // TOI UU TOC DO (06/10/2026): truoc day goi readAllOrders_() = doc A:T TOAN BO DT TONG roi dung
  // object cho TUNG dong chi de loc 1 SDT. Gio chi doc cot SDT (cot D) de tim so dong khop, roi
  // chi doc A:T cua dung cac dong do va dung dtRowToOrder_ y het nhu cu (ket qua giong het).
  var out = [];
  if (!ph) return out;
  var ss = getDTSS_();
  var sh = ss.getSheetByName(DT_TONG_SHEET);
  if (!sh) {
    throw new Error('Khong tim thay sheet "' + DT_TONG_SHEET + '" trong spreadsheet don hang (DT_SS_ID) — kiem tra sheet co bi doi ten/xoa khong, hoac DT_SS_ID co con dung khong.');
  }
  var last = sh.getLastRow();
  if (last < 2) return out;
  var phoneCol = sh.getRange(2, DT_COL_PHONE + 1, last - 1, 1).getValues();
  var hits = [];
  for (var h = 0; h < phoneCol.length; h++) {
    if (normPhone_(String(phoneCol[h][0] || '')) === ph) hits.push(h + 2);
  }
  if (hits.length) {
    var rowsData = [];
    if (hits.length <= 12) {
      for (var q = 0; q < hits.length; q++) rowsData.push(sh.getRange(hits[q], 1, 1, DT_TONG_WIDTH).getValues()[0]);
    } else {
      var blk = sh.getRange(hits[0], 1, hits[hits.length - 1] - hits[0] + 1, DT_TONG_WIDTH).getValues();
      for (var q2 = 0; q2 < hits.length; q2++) rowsData.push(blk[hits[q2] - hits[0]]);
    }
    for (var z = 0; z < rowsData.length; z++) {
      try { out.push(dtRowToOrder_(rowsData[z], hits[z])); } catch (eRow) { Logger.log('readOrdersByPhone_: loi doc dong ' + hits[z] + ': ' + eRow); }
    }
  }
  // Khu trung dong GIONG HET (cung ngay+doanh thu+san pham) — giu logic cu, KHONG tu dong
  // xoa o day, chi de UI/extension tu phat hien va hoi xac nhan (xem findDuplicateOrders_)
  return _dedupeSameOrders_(out);
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
  var updated = 0, appended = 0, skipped = 0, touchedRows = [];
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
      updated++; touchedRows.push(ex.rowNum);
    } else {
      newRows.push(careRow_({ phone: phone, name: name }));
      appended++;
    }
  }
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, CARE_HEADERS.length).setValues(newRows);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch (ec) {}
  sbMirrorSheetRows_(sh, touchedRows, newRows, 'applyCustomerNameGuesses_');
  return jsonOut_({ ok: true, updated: updated, appended: appended, skipped: skipped });
}

function getDTSS_() {
  return DT_SS_ID
    ? SpreadsheetApp.openById(DT_SS_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// Chuyen 1 gia tri o "Ngay tao"/"Thoi gian hoan thanh" cua sheet DT TONG thanh chuoi
// 'dd/MM/yyyy HH:mm'.
//
// QUAN TRONG — DA DOI CHIEU TUNG DON VOI BAO CAO CHUAN CUA BASE (19/09/2026) DE XAC NHAN:
// Date object doc duoc tu cot nay co GIO/PHUT DUNG Y HET so dang hien tren man hinh Sheet
// (vd o hien "18/09/2026 23:14" thi val.getUTCHours()=23, val.getUTCMinutes()=14) — TUC LA
// KHONG CAN CONG/TRU GI THEM, chi can doc thang cac thanh phan UTC cua Date la ra dung.
//
// Vi vay ham nay KHONG dung Utilities.formatDate(val, tz, ...) voi bat ky ma mui gio nao
// (khong ss.getSpreadsheetTimeZone(), cang khong hardcode 'Asia/Ho_Chi_Minh') — ca 2 cach
// do DEU SAI cho rieng cot nay:
//   - 'Asia/Ho_Chi_Minh' (GMT+7): CONG THEM +7 tieng vao so da dung san -> don tao khung
//     18h-24h bi day nham sang NGAY HOM SAU (bug goc, da fix 20/09 sang nhung bi 1 ban vá
//     sau do vo tinh dua "Asia/Ho_Chi_Minh" vao lam fallback nen tai dien: Page HT3 nhay
//     tu dung 106tr len sai 180tr — chinh la trieu chung Duyen bao lai).
//   - ss.getSpreadsheetTimeZone(): co the tra ve gia tri khien Utilities.formatDate throw
//     "Đối số không hợp lệ: timeZone" hang loat (2.432 dong), lam rong ca danh sach don.
// Doc thang tu cac ham getUTC*() cua JS Date (khong qua Utilities/mui gio nao ca) vua tranh
// duoc crash (thuan JS, khong goi API nao co the loi "timeZone khong hop le") vua khong bao
// gio cong/tru sai gio, bat ke Date object do lay tu Sheet dang cau hinh mui gio gi.
function _dtCellToVnStr_(val) {
  if (val === '' || val === null || val === undefined) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    if (isNaN(val.getTime())) return '';
    var pad2 = function(n) { return (n < 10 ? '0' : '') + n; };
    return pad2(val.getUTCDate()) + '/' + pad2(val.getUTCMonth() + 1) + '/' + val.getUTCFullYear() +
      ' ' + pad2(val.getUTCHours()) + ':' + pad2(val.getUTCMinutes());
  }
  return val;
}

// ── Parse ngay dang DD/MM/YYYY (chuoi) hoac Date that (doc truc tiep tu Google Sheet) ──
// KHONG dung new Date(chuoi) truc tiep: JS hieu chuoi kieu MM/DD/YYYY, se sai am tham
// voi cac ngay <=12 (vd 01/07/2026 se bi hieu la 1 thang 7 thay vi 7 thang 1).
// Chuan hoa gio VN: dung Date.UTC() (LUON tuyet doi, khong phu thuoc cau hinh Time Zone cua du
// an Apps Script) roi tru/cong 7 tieng — TRANH HOAN TOAN phu thuoc vao "Time Zone" cua du an
// (Project Settings > Time zone / appsscript.json). Neu cau hinh do vo tinh KHONG phai gio VN
// (vd bi de mac dinh khac, hoac chua ai chinh), moi cho dung new Date(chuoi)/new
// Date(y,mo-1,d)/.getFullYear() kieu cu se BI LECH GIO AM THAM — day chinh la nguyen nhan bug
// "ngay hom truoc lan sang ngay hom sau" da gap (Duyen xac nhan ngay 19/09/2026).
var VN_OFFSET_MS = 7 * 3600 * 1000;
function _vnMidnight_(y, mo, d) { return new Date(Date.UTC(y, mo - 1, d) - VN_OFFSET_MS); }
// Tra ve chuoi 'yyyy-MM-dd' CUA DUNG NGAY DUONG LICH VIET NAM cho 1 thoi diem (Date) bat ky —
// khong dung Utilities.formatDate/Session.getScriptTimeZone() vi ban than 2 cai do cung phu
// thuoc cau hinh du an; tu tinh tay bang offset co dinh +7 (Viet Nam khong co DST) la chac chan
// dung 100% du du an cau hinh Time Zone la gi.
function _vnYmd_(dt) {
  if (!dt || isNaN(dt.getTime())) return '';
  var shifted = new Date(dt.getTime() + VN_OFFSET_MS);
  return shifted.getUTCFullYear() + '-' + String(shifted.getUTCMonth() + 1).padStart(2, '0') + '-' + String(shifted.getUTCDate()).padStart(2, '0');
}
// Tra ve {y, mo (1-12), d} la NGAY DUONG LICH VN dung cua 1 thoi diem (Date) bat ky — dung
// cho MOI noi can tach nam/thang/ngay (tuan/thang/quy Bao cao C, year/month cua don hang...).
// Cung 1 co che UTC + offset co dinh voi _vnMidnight_/_vnYmd_ o tren, khong bao gio dung
// .getFullYear()/.getMonth()/.getDate() truc tiep (phu thuoc cau hinh Time Zone du an).
function _vnYmdParts_(dt) {
  if (!dt || isNaN(dt.getTime())) return null;
  var shifted = new Date(dt.getTime() + VN_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

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
  var dt = _vnMidnight_(y, mo, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// Chuyen 1 chuoi ngay bat ky (co the la 'yyyy-MM-dd' tu <input type=date>, hoac 'DD/MM/YYYY')
// thanh chuoi 'yyyy-MM-dd' CHUAN GIO VN. Voi 'yyyy-MM-dd' thi dung thang khong qua Date object
// nao ca — an toan tuyet doi, khong co co hoi lech gio.
function _dateStrToVnYmd_(s) {
  if (!s) return '';
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = parseVNDate_(s);
  return d ? _vnYmd_(d) : '';
}

function dateInRange_(dt, fromStr, toStr) {
  if (!dt) return !fromStr && !toStr; // khong parse duoc: chi loai neu co bo loc ngay
  // So sanh bang CHUOI 'yyyy-MM-dd' (gio VN, tinh tay bang offset co dinh +7) thay vi tru Date
  // object — tranh hoan toan cac bug lech gio do Date instant + ambient timezone gay ra (da gap
  // bug "ngay hom truoc lan sang ngay hom sau" khi so sanh kieu cu).
  var dKey = _vnYmd_(dt);
  if (fromStr) {
    var fKey = _dateStrToVnYmd_(fromStr);
    if (fKey && dKey < fKey) return false;
  }
  if (toStr) {
    var tKey = _dateStrToVnYmd_(toStr);
    if (tKey && dKey > tKey) return false;
  }
  return true;
}

// Loai don khoi doanh so/so don theo dung 1 nguon DUY NHAT: cot "Trang thai don" (DT TONG:
// cot H; Bao cao B/POS: token khong-khoang-trang... KHONG, token CO khoang trang trong cot
// "Thẻ" — xem _donHasExcludedStatus_). KHONG suy dien them tu "Giai doan"/nguon khac.
// Theo xac nhan cua Duyen (24/09/2026): cot nay CHI TUNG xuat hien dung 6 gia tri can loai —
// Da hoan, Dang hoan, Dang hoan hang, Da hoan hang, Hoan hang, Hoan tien — so sanh KHOP TOAN
// BO chuoi (khong phai substring) de tuyet doi khong dung nham cac trang thai khac (vd "Hoan
// thanh" la don TOT, khong duoc loai). Neu sau nay Pancake/Base sinh them trang thai moi cung
// nghia "hoan/huy" thi them dung vao mang duoi day, khong doan mo rong bang regex.
var EXCLUDED_ORDER_STATUSES_ = ['huy', 'da huy', 'da hoan', 'dang hoan', 'dang hoan hang', 'da hoan hang', 'hoan hang', 'hoan tien']; // 'huy'/'da huy' them 2026-09-30 theo xac nhan cua Duyen (rieng cot Trạng thái cua Bao cao B/POS co gia tri nay)
function _isExcludedOrderStatus_(trangThai) {
  var s = _stripVN_(trangThai).trim();
  if (!s) return false;
  return EXCLUDED_ORDER_STATUSES_.indexOf(s) !== -1;
}


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

// Toan bo ten that da tung duoc ghi nhan la Nhan vien/Sale (gop ca ten hien thi tren Pancake
// VA ten Sale CRM da khop trong bang "Khớp tên Nhân viên Pancake ↔ Sale CRM"), chuan hoa qua
// _normTxt_ (bo khoang trang thua + chu thuong, GIU dau) de so khop khong phan biet hoa/thuong.
// Cache trong pham vi 1 lan chay (doGet/doPost) — khong can doc lai sheet nhieu lan trong cung
// 1 request du goi _donSaleNamesFromThe_ hang chuc/hang tram lan (vd duyet het dong "dữ liệu đơn").
var __pancakeKnownSaleSet_ = null;
function _pancakeKnownSaleNameSet_() {
  if (__pancakeKnownSaleSet_) return __pancakeKnownSaleSet_;
  var set = {};
  try { pancakeAllNames_().forEach(function(n){ set[_normTxt_(n)] = true; }); } catch (e) {}
  try {
    var map = readPancakeMap_();
    Object.keys(map).forEach(function(k){
      set[_normTxt_(k)] = true;
      if (map[k]) set[_normTxt_(map[k])] = true;
    });
  } catch (e) {}
  __pancakeKnownSaleSet_ = set;
  return set;
}

// Cot "Thẻ" trong sheet "dữ liệu đơn" (Pancake POS) chua CA ten sale LAN cac tag KHONG PHAI
// sale (trang thai don nhu "Đang giao hàng"/"Chưa đối soát"/"Giao không thành", hoac cac nhan
// khac nhu "VIP"/"Freeship"...), vd "anhNP1999, Đang đối soát, VIP" hoac "dungnguyen1995,
// bichnguyen1993, Giao không thành" (nhieu sale + nhieu tag khac). Ban chat: don vAn chia cho
// DUNG NHUNG SALE THAT SU co mat, bat ke con lai bao nhieu hang muc the khac khong phai sale.
// Uu tien doi chieu tung token voi danh sach Nhan vien/Sale THAT SU da tung ghi nhan (xem
// _pancakeKnownSaleNameSet_) — cach nay dung duoc ca voi tag 1-tu khong phai sale (vd "VIP",
// "Freeship") ma heuristic khoang-trang truoc day khong loai duoc. Chi khi KHONG token nao
// khop duoc danh sach da biet (vd sale qua moi, chua tung xuat hien o dau) moi lui ve heuristic
// cu: giu token khong co khoang trang (ten dang nhap Pancake khong co dau cach; tag/trang thai
// tieng Viet nhieu chu luon co) — de khong lam mat hoan toan 1 sale that nhung chua kip ghi nhan.
// Loc "Theo Team" o Bao cao B (POS) bi ra 0 doanh thu du Team da co du thanh vien — nguyen nhan:
// cot "Thẻ" trong sheet "dữ liệu đơn" ghi USERNAME dang nhap Pancake (vd "ninhnga99"), trong khi
// Team/CareData.cs dung TEN SALE CHUAN (vd "Ngà") — 2 dang ten KHAC NHAU, so sanh truc tiep
// khong bao gio khop. PancakeNameMap da co san anh xa 2 chieu nay (dung cho Bao cao tuong tac/SDT
// Pancake) — tai su dung de MO RONG moi ten trong bo loc thanh ca chinh no LAN cac username
// Pancake da tung khop voi ten do, truoc khi dem so sanh voi "Thẻ".
function _expandSaleFilterWithPancakeAliases_(names) {
  if (!names || !names.length) return names;
  var map = readPancakeMap_(); // pancakeName -> saleName (co the "saleA|saleB")
  var foldIn = {};
  names.forEach(function(n) { if (n) foldIn[_normTxt_(n)] = true; });
  var out = names.slice();
  Object.keys(map).forEach(function(pancakeName) {
    var saleNames = String(map[pancakeName] || '').split('|').map(function(s){ return s.trim(); }).filter(Boolean);
    if (saleNames.some(function(sn) { return foldIn[_normTxt_(sn)]; })) out.push(pancakeName);
  });
  return out;
}

// Ten "sale" dac biet co khoang trang tren cot The (khong phai username Pancake) nhung ke toan van tinh la 1 sale rieng — vd
// "Diệu Tâm DMP" (don Kenh Duoc, thang 9: 2 don / 32.250.000d). Khong them thi bi coi la tag va don roi vao "(chưa gán sale)".
// Gia tri phai o dang chuan hoa _normTxt_ (chu thuong, giu dau).
var POS_EXTRA_SALE_NAMES_ = ['diệu tâm dmp'];
function _donSaleNamesFromThe_(theStr) {
  var tokens = splitMulti_(theStr, ',');
  if (!tokens.length) return [];
  var known = _pancakeKnownSaleNameSet_();
  // SUA 2026-10-05 (loi lech doanh thu Pos vs ke toan, vd ninhnga99 906.411.333 vs 816.953.667): TRUOC DAY chi giu token
  // nam trong danh sach "known" (PancakeStats + PancakeNameMap). Sale THAT chua tung duoc nhap vao 2 sheet do (vd
  // biichnguyen1993, dungnguyen1995, giangnguyen1990, nguyenngo1988, thuydinh95, nonghong88, mainguyen97...) bi BO RA ngay khi
  // don co >=1 sale khac da biet — don chia 2 nguoi chi con 1 nguoi nhan CA tien (nguoi kia mat phan), nen sale nay bi thieu
  // (bichnguyen1993 86 don -> 39) va sale di cung bi thua (ninhnga99 +89tr). Fix: ngoai danh sach known, van nhan token
  // KHONG khoang trang va co CHU SO (ten dang nhap Pancake luon dang "ninhnga99"), con tag/trang thai thuong co khoang trang
  // ("Chưa đối soát", "Giao không thành") hoac khong co so ("VIP", "Freeship") van bi loai nhu cu.
  var matched = tokens.filter(function(tok) {
    if (known[_normTxt_(tok)]) return true;
    if (POS_EXTRA_SALE_NAMES_.indexOf(_normTxt_(tok)) !== -1) return true;
    return !/\s/.test(tok) && /\d/.test(tok);
  });
  if (matched.length) return matched;
  return tokens.filter(function(tok) { return tok && !/\s/.test(tok); });
}
// SUA 2026-09-30 theo xac nhan CUOI CUNG cua Duyen: viec loai don khoi doanh so Bao cao B
// CHI dua vao MOT nguon DUY NHAT — cot rieng "Trạng thái" (cot O trong sheet "dữ liệu đơn"):
// loai neu la Huỷ / Đã hoàn / Đang hoàn. Cot "Thẻ" (C) TUYET DOI KHONG con dung de xet trang
// thai nua — chi dung de tach ten sale chia doanh thu (xem _donSaleNamesFromThe_ o tren).
// (Ban than sheet cung da duoc Duyen xoa het cac dong Huy/Hoan/Dang hoan thu cong; ham nay
// van giu de an toan cho du lieu phat sinh sau nay.)
// SUA 2026-10-03 theo xac nhan cua Duyen: POS (sheet "dữ liệu đơn") CHI loai 2 trang thai "Đã hoàn"
// va "Đang hoàn" (khop TOAN BO chuoi, khong dau/khong phan biet hoa-thuong). TRUOC DAY Pos dung chung
// EXCLUDED_ORDER_STATUSES_ voi Base (con loai them Huy/Hoan hang/Hoan tien...) nen khac dinh nghia
// thuc te cua Pos. Danh sach Base (EXCLUDED_ORDER_STATUSES_) GIU NGUYEN, chi anh huong DT TONG.
// Ham nay CHI duoc goi boi Bao cao B (+E/F doc qua B) va G — khong dung cho Base.
var POS_EXCLUDED_ORDER_STATUSES_ = ['da hoan', 'dang hoan'];
function _donHasExcludedStatus_(trangThaiCol) {
  var s = _stripVN_(trangThaiCol).trim();
  if (!s) return false;
  return POS_EXCLUDED_ORDER_STATUSES_.indexOf(s) !== -1;
}

// ── Doc toan bo sheet "DT TỔNG " thanh mang object ──
// Cai dat "An/Hien Page & Sale khoi bao cao chung" (yeu cau 2026-09-25): admin tu chon
// nhung Page/kenh va Sale khong thuoc pham vi quan ly cua minh de AN khoi moi bao cao
// dung chung (Dashboard, Bao cao doanh so A-E, KPI Pancake...). Luu 2 setting JSON array
// dung chung pattern voi cac setting khac (getSetting_/setSetting_).
function _hiddenPageSaleSets_() {
  var hc = [], hs = [];
  try { var v = getSetting_('hiddenChannels'); if (v) hc = JSON.parse(v); } catch (e) {}
  try { var v2 = getSetting_('hiddenSales'); if (v2) hs = JSON.parse(v2); } catch (e2) {}
  return { channels: hc, sales: hs };
}
// 1 dong DT TONG bi AN neu: kenh ban nam trong danh sach an, HOAC tat ca sale tren dong do
// (co the nhieu ten, cach nhau dau phay) deu nam trong danh sach an sale (con >=1 sale
// KHONG bi an thi van hien binh thuong, tranh an nham don co ca sale minh quan ly dung chung).
function _isDTRowHidden_(kenhBan, saleBan, sets) {
  if (sets.channels.length && kenhBan && sets.channels.indexOf(kenhBan) !== -1) return true;
  if (sets.sales.length && saleBan) {
    var names = String(saleBan).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    if (names.length && names.every(function(n){ return sets.sales.indexOf(n) !== -1; })) return true;
  }
  return false;
}

function readDTTong_() {
  var _t0 = Date.now();
  var vals, rowNums = null;
  // Supabase buoc 4c: khi cho phep (SB_ORD_READ=on, ban sao dong bo moi, khong dirty) doc dt_tong thay vi quet ca sheet.
  // undefined = phai doc Sheets nhu cu. Ca 2 nguon di qua CUNG 1 vong lap chuyen doi ben duoi (khong co ban logic thu hai).
  var sbd = sbReadDTTongVals_();
  if (sbd !== undefined) { vals = sbd.vals; rowNums = sbd.rowNums; }
  else {
    var ss = getDTSS_();
    var sh = ss.getSheetByName(DT_TONG_SHEET);
    if (!sh) return [];
    var last = sh.getLastRow();
    if (last < 2) return [];
    vals = sh.getRange(2, 1, last - 1, 20).getValues();
  }
  var _tRead = Date.now() - _t0;
  var hiddenSets = _hiddenPageSaleSets_();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    // Dong rong that su: khong SDT, khong ID, VA khong co gia tri don hang (r[17]) — truoc day
    // chi check thieu SDT+ID la bo qua ca dong, nhung neu dong do LAI CO gia tri doanh thu that
    // (vd don nhap tay/import cu chua kip gan SDT/ID) thi se bi am tham mat doanh thu khoi
    // Bao cao A (thap hon thuc te ma khong bao loi gi). Them dieu kien r[17] de an toan hon.
    if (!r[3] && !r[19] && !r[17]) continue;
    var kenhBan = r[12] ? String(r[12]).trim() : '';
    var saleBan = r[13] ? String(r[13]) : '';
    if (_isDTRowHidden_(kenhBan, saleBan, hiddenSets)) continue;
    try {
      out.push({
        ngayTao:        _dtCellToVnStr_(r[0]),
        nguoiTao:       r[1] ? String(r[1]).trim() : '',
        giaoCho:        r[2],
        giaiDoan:       r[6],
        trangThai:      r[7],
        thoiGianHT:     _dtCellToVnStr_(r[10]),
        kenhBan:        kenhBan,
        saleBan:        saleBan,
        sanPham:        r[14],
        phanLoai:       r[15],
        giaTriCoc:      _normMoney_(r[16]),
        giaTriDon:      _normMoney_(r[17]),
        giaTriChenh:    _normMoney_(r[18]),
        id:             r[19]
      });
    } catch (eRow) {
      Logger.log('readDTTong_: loi doc dong ' + (rowNums ? rowNums[i] : i + 2) + ': ' + eRow);
    }
  }
  // DO HIEU NANG (xem Apps Script -> Executions): so dong, ms doc sheet (getValues) vs ms xu ly lai.
  // Neu _tRead chiem phan lon -> nghen o Google Sheets (can snapshot/luu tru); neu _tConvert lon -> nghen o code.
  Logger.log('PERF readDTTong_ src=' + (sbd !== undefined ? 'supabase' : 'sheets') + ' rows=' + vals.length + ' kept=' + out.length + ' readMs=' + _tRead + ' convertMs=' + (Date.now() - _t0 - _tRead));
  return out;
}

// ── KH "Chăm sóc" thêm nhanh — sheet RIÊNG, độc lập CareData/DT TỔNG/dữ liệu đơn ──
// ═══════════════════════════════════════════════════════════════
//  NGUON "CSKH-Duyên" — sheet thu 3 (cung file voi DT TONG / "dữ liệu đơn"), yeu cau Duyen 2026-10-06:
//  dua du lieu khach VIP/SPV (CSKH-Duyên) len CRM de CHIA DATA cho CS va CS cham soc; khach co cung SDT o DT TONG,
//  "dữ liệu đơn" va CSKH-Duyên thi CRM gop thanh 1 khach (gop theo SDT o index.html) co du thong tin tu 3 nguon.
//  Doc theo TEN TIEU DE cot (khong theo vi tri) nen them/doi thu tu cot khong lam hong. KHONG doc cot
//  "Mã số thuế/CCCD (theo dữ liệu gốc)" — CCCD la dinh danh ca nhan nhay cam, CS khong can de cham soc.
//  Dong KHONG co SDT khong the gop theo SDT -> khong dua vao danh sach khach, chi dem trong noPhone de bao.
// ═══════════════════════════════════════════════════════════════
var CSKH_DUYEN_SHEET_KEY_ = 'cskh-duyen'; // so khop ten sheet da bo dau/hoa-thuong: "CSKH-Duyên" / "cskh-duyen"
// Moi truong: [ten truong, [cac cum tu PHAI co mat (nguyen tu) trong tieu de da bo dau]] — xet theo thu tu, cum cu the truoc
var CSKH_DUYEN_FIELDS_ = [
  ['taxCompany', ['ma so thue', 'cong ty']],
  ['company',    ['ten', 'cong ty']],
  ['codeOrig',   ['ma khach hang', 'goc']],
  ['codeOther',  ['ma khach hang', 'khac']],
  ['dupCount',   ['so lan trung']],
  ['phone',      ['sdt']],
  ['name',       ['ten khach hang']],
  ['tier',       ['phan loai']],
  ['internal',   ['doi tuong noi bo']],
  ['address',    ['dia chi']],
  ['birthday',   ['ngay sinh']],
  ['gender',     ['gioi tinh']],
  ['debt',       ['cong no']],
  ['email',      ['email']],
  ['staff',      ['nhan vien phu trach']],
  ['source',     ['nguon du lieu']],
  ['note',       ['ghi chu']]
];
function _findCskhDuyenSheet_() {
  var sheets = getDTSS_().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (_stripVN_(sheets[i].getName()).replace(/\s+/g, '') === CSKH_DUYEN_SHEET_KEY_) return sheets[i];
  }
  return null;
}
function _cskhHeaderMap_(headerRow) {
  var map = {}, used = {};
  CSKH_DUYEN_FIELDS_.forEach(function(f) {
    for (var c = 0; c < headerRow.length; c++) {
      if (used[c]) continue;
      var h = ' ' + _stripVN_(headerRow[c]).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
      if (h.trim() === '') continue;
      var ok = f[1].every(function(kw) { return h.indexOf(' ' + kw + ' ') !== -1; });
      if (ok) { map[f[0]] = c; used[c] = true; break; }
    }
  });
  return map;
}
function _cskhCell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Etc/GMT-7', 'dd/MM/yyyy');
  return String(v).replace(/\s+/g, ' ').trim();
}
// Tra ve { found, rows:[{phone,name,tier,...}], total, noPhone, noPhoneSample:[ten], cols:{truong:chi so cot} }
//
// CANH BAO HIEU NANG (van GIU lai ham nay vi action 'cskhDuyen' du khong con FE nao goi, nhung
// de phong can cho debug/export sau nay): doc+parse FULL moi truong x TOAN BO dong sheet, voi
// sheet toi ~134k dong ham nay RAT NANG (hang chuc MB) va cache _cacheGetBig_ gan nhu chac chan
// THAT BAI AM THAM voi payload lon co nay (CacheService khong du suc chua), nghia la MOI LAN goi
// deu doc+xu ly lai TU DAU. KHONG duoc goi ham nay cho cac thao tac THUONG XUYEN (vd tra cuu 1
// khach) — xem findCskhRowsByPhone_ (dung index nhe hon nhieu) va readCskhDuyenLite_ (ban rut
// gon 3 truong cho FE keo hang loat) ngay duoi day, day moi la 2 duong CHINH dang duoc dung.
function readCskhDuyen_() {
  var cached = _cacheGetBig_('cskhDuyen_v1');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  var out = { found: false, rows: [], total: 0, noPhone: 0, noPhoneSample: [], cols: {} };
  var sh = _findCskhDuyenSheet_();
  if (!sh) return out;
  out.found = true;
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) return out;
  var vals = sh.getRange(1, 1, last, width).getValues();
  var map = _cskhHeaderMap_(vals[0]);
  out.cols = map;
  if (map.phone === undefined && map.name === undefined) return out; // khong nhan ra tieu de nao -> khong doan
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i], o = {};
    Object.keys(map).forEach(function(k) { o[k] = _cskhCell_(r[map[k]]); });
    var raw = map.phone !== undefined ? r[map.phone] : '';
    o.phone = normPhone_(raw);
    if (!o.phone && !o.name) continue; // dong trong
    out.total++;
    if (!o.phone || o.phone.length < 8) {
      out.noPhone++;
      if (out.noPhoneSample.length < 20 && o.name) out.noPhoneSample.push(o.name);
      continue;
    }
    out.rows.push(o);
  }
  try { _cachePutBig_('cskhDuyen_v1', JSON.stringify(out), 300); } catch (e2) {}
  return out;
}

// ═══ FIX HIEU NANG (01/10/2026, Duyen bao CRM lag sau khi them sheet CSKH-Duyên len ~134k dong) ═══
// Nguyen nhan chinh: findCskhRowsByPhone_ (ban CU) goi THANG readCskhDuyen_() — doc+parse FULL
// 17 truong x TOAN BO ~134k dong MOI LAN tra cuu 1 SDT. Ham nay duoc goi tu action 'lookup',
// von duoc goi RAT THUONG XUYEN (moi lan CS/extension xem 1 ho so khach) — nen moi lan xem ho so
// la CRM phai doc lai toan bo sheet khong lo nay, rat cham. Cache _cacheGetBig_ cho ban FULL
// cung gan nhu chac chan that bai am tham voi payload hang chuc MB nay nen khong co tac dung.
//
// Fix: tach rieng 1 INDEX NHE — chi SDT -> so dong (khong keo du lieu 17 truong) — bang cach chi
// doc 1 COT SDT (thay vi 17 cot) cho TOAN BO sheet 1 lan, cache index nay (nho hon nhieu, de
// cache thanh cong hon). Tra cuu 1 SDT: tra index de biet SDT nam o (nhung) dong nao, roi CHI
// doc FULL BE RONG cho DUNG (vai) dong do — khong dong nao khac.
function _cskhPhoneIndex_() {
  var cached = _cacheGetBig_('cskhDuyen_idx_v1');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  var idx = { phoneCol: -1, map: {} }; // map: SDT -> [so dong 1-based tren sheet, co the >1 neu trung SDT]
  var sh = _findCskhDuyenSheet_();
  if (!sh) { try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e2) {} return idx; }
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) { try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e2) {} return idx; }
  var headerRow = sh.getRange(1, 1, 1, width).getValues()[0];
  var map0 = _cskhHeaderMap_(headerRow);
  if (map0.phone === undefined) { try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e2) {} return idx; }
  idx.phoneCol = map0.phone;
  var phoneVals = sh.getRange(2, map0.phone + 1, last - 1, 1).getValues(); // CHI 1 cot, khong phai 17
  for (var i = 0; i < phoneVals.length; i++) {
    var p = normPhone_(phoneVals[i][0]);
    if (!p || p.length < 8) continue;
    if (!idx.map[p]) idx.map[p] = [];
    idx.map[p].push(i + 2); // +2: hang 1 la tieu de, i bat dau tu 0
  }
  try { _cachePutBig_('cskhDuyen_idx_v1', JSON.stringify(idx), 300); } catch (e3) {} // co the van qua lon voi sheet SIEU to, nhung du khong cache duoc thi viec doc 1 cot van NHE HON NHIEU so voi doc 17 cot nhu truoc
  return idx;
}

function findCskhRowsByPhone_(phone) {
  var p = normPhone_(phone);
  if (!p) return [];
  try {
    var idx = _cskhPhoneIndex_();
    var rowNums = idx.map[p];
    if (!rowNums || !rowNums.length) return [];
    var sh = _findCskhDuyenSheet_();
    if (!sh) return [];
    var width = sh.getLastColumn();
    var headerRow = sh.getRange(1, 1, 1, width).getValues()[0];
    var map = _cskhHeaderMap_(headerRow);
    var out = [];
    rowNums.forEach(function(rn) {
      var r = sh.getRange(rn, 1, 1, width).getValues()[0];
      var o = {};
      Object.keys(map).forEach(function(k) { o[k] = _cskhCell_(r[map[k]]); });
      o.phone = p;
      out.push(o);
    });
    return out;
  } catch (e) { return []; }
}

// TOI UU TOC DO (06/10/2026): 'lookup' duoc extension goi moi lan chuyen chat + poll 6 giay, cache
// ket qua tong cua lookup chi 15s -> cu het han la findCskhRowsByPhone_ lai doc CA COT SDT cua sheet
// CSKH-Duyen (~134k dong; index qua lon nen _cachePutBig_ that bai am tham). Sheet nay gan nhu
// tinh (danh sach khach VIP), nen cache RIENG theo tung SDT 5 phut — ke ca ket qua RONG (da so
// khach khong co trong CSKH-Duyen, neu khong cache [] thi van doc lai index moi lan).
function findCskhRowsCached_(phone) {
  var p = normPhone_(phone);
  if (!p) return [];
  var cache = CacheService.getScriptCache();
  var key = 'ckr_' + p;
  try {
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);
  } catch (e) {}
  var rows = findCskhRowsByPhone_(phone);
  try { cache.put(key, JSON.stringify(rows), 300); } catch (e2) {}
  return rows;
}

// Ban "NHE" cua CSKH-Duyên — CHI 3 truong (phone,name,tier) thay vi du 17 truong, dung cho FE
// keo HANG LOAT khi tai trang/poll dinh ky (action=cskhDuyenLite — FE da san sang goi action nay
// nhung TRUOC DAY CHUA CO handler o backend nen luon loi am tham, khien danh sach CSKH-Duyên
// khong len duoc tren CRM). Chi tiet day du 1 khach (dia chi/cong ty/no/ghi chu...) CHI lay rieng
// qua findCskhRowsByPhone_ khi CS thuc su mo ho so khach do (lazy), KHONG keo full 17 truong x
// toan bo ~134k dong moi lan tai trang/poll nua.
function readCskhDuyenLite_() {
  var cached = _cacheGetBig_('cskhDuyen_lite_v2');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  // NGUYÊN NHÂN GỐC (đã sửa) lỗi thỉnh thoảng trả HTML 404/quá tải: khi cache hết hạn, MỌI request đang chờ (nhiều CS mở CRM
  // cùng lúc + vòng poll) đều tự đọc lại ~134k dòng của sheet CSKH-Duyên song song -> vượt giới hạn thực thi đồng thời của
  // Apps Script -> lỗi cho cả các action khác (customers, users, assignHistory...). Nay chỉ 1 request dựng lại; các request
  // còn lại thấy cờ "đang dựng" thì chờ tối đa ~18s rồi lấy kết quả từ cache (không dùng LockService để khỏi chặn các thao tác ghi).
  var _cacheB = null;
  try { _cacheB = CacheService.getScriptCache(); } catch (eCb) {}
  if (_cacheB && _cacheB.get('cskhDuyen_lite_building')) {
    for (var w = 0; w < 12; w++) {
      Utilities.sleep(1500);
      var c2 = _cacheGetBig_('cskhDuyen_lite_v2');
      if (c2) { try { return JSON.parse(c2); } catch (e3) {} }
      if (!_cacheB.get('cskhDuyen_lite_building')) break;
    }
  }
  try { if (_cacheB) _cacheB.put('cskhDuyen_lite_building', '1', 60); } catch (eFl) {}
  try {
    return _readCskhDuyenLiteBuild_();
  } finally {
    try { if (_cacheB) _cacheB.remove('cskhDuyen_lite_building'); } catch (eRm) {}
  }
}
function _readCskhDuyenLiteBuild_() {
  var out = { found: false, rows: [], total: 0, noPhone: 0, noPhoneSample: [] };
  var sh = _findCskhDuyenSheet_();
  if (!sh) return out;
  out.found = true;
  var last = sh.getLastRow(), width = sh.getLastColumn();
  if (last < 2 || width < 1) return out;
  var headerRow = sh.getRange(1, 1, 1, width).getValues()[0];
  var map = _cskhHeaderMap_(headerRow);
  if (map.phone === undefined && map.name === undefined) return out;
  // CHI lay SDT + TEN (de tim kiem/hien thi danh sach). Phan loai/dia chi/... lay luon khi mo ho so (action=cskhDetail).
  var wantedCols = [map.phone, map.name].filter(function(x) { return x !== undefined; });
  if (!wantedCols.length) return out;
  var minC = Math.min.apply(null, wantedCols), maxC = Math.max.apply(null, wantedCols);
  var block = sh.getRange(2, minC + 1, last - 1, maxC - minC + 1).getValues();
  for (var i = 0; i < block.length; i++) {
    var r = block[i];
    var nameV = map.name !== undefined ? _cskhCell_(r[map.name - minC]) : '';
    var rawPhone = map.phone !== undefined ? r[map.phone - minC] : '';
    var p = normPhone_(rawPhone);
    if (!p && !nameV) continue;
    out.total++;
    if (!p || p.length < 8) {
      out.noPhone++;
      if (out.noPhoneSample.length < 20 && nameV) out.noPhoneSample.push(nameV);
      continue;
    }
    out.rows.push([p, nameV]);
  }
  try { _cachePutBig_('cskhDuyen_lite_v2', JSON.stringify(out), 600); } catch (e2) {}
  return out;
}

// ═══ XOA HAN SDT KHONG PHAI DI DONG VIET NAM (them 2026-10-10 theo yeu cau Duyen: "xoa luon") ═══
// Pham vi = 3 sheet DANH SACH KHACH: CareData, "KH Cham soc moi", CSKH-Duyen. KHONG dong vao DT TONG / "du lieu don" (xoa don = mat doanh thu bao cao);
// dry-run se chi DEM so don co SDT la de Duyen tu quyet. Chi xoa dong co SDT khong hop le (isValidVnPhone_) VA co it nhat 1 chu so; o SDT trong/chu thuan
// (khong co so) giu nguyen. MOI dong bi xoa duoc luu truoc vao sheet "XoaSDT_Backup" (thoi gian | sheet | SDT | JSON ca dong) de khoi phuc duoc.
// Xoa tung KHOI dong lien tiep tu duoi len; het ngan sach thoi gian thi tra done:false -> chay lai (tinh lai tu dau, khong trung lap vi dong da xoa khong con).
var XOA_SDT_BUDGET_MS_ = 240000;
function _xoaSdtScan_(vals, phoneCol) {   // vals: mang 2 chieu tu dong 2; tra mang chi so (0-based theo vals) can xoa
  var bad = [];
  for (var i = 0; i < vals.length; i++) {
    var raw = vals[i][phoneCol];
    if (raw === '' || raw === null || raw === undefined) continue;
    if (!/\d/.test(String(raw))) continue;
    if (!isValidVnPhone_(raw)) bad.push(i);
  }
  return bad;
}
function _xoaSdtRuns_(bad) {   // [[start,end],...] cac khoi lien tiep (chi so 0-based)
  var runs = [];
  for (var i = 0; i < bad.length; i++) {
    if (runs.length && bad[i] === runs[runs.length - 1][1] + 1) runs[runs.length - 1][1] = bad[i];
    else runs.push([bad[i], bad[i]]);
  }
  return runs;
}
function xoaSdtKhongPhaiVN_(opts) {
  opts = opts || {};
  var dry = !(opts.dryRun === false || opts.dryRun === 'false');
  var which = opts.sheets || ['care', 'leads', 'cskh'];
  var t0 = new Date().getTime(), res = { ok: true, dryRun: dry, done: true, sheets: {}, orders: {} };
  var lock = null;
  try {
    if (!dry) { lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return { ok: false, error: 'Dang co thao tac luu khac, thu lai sau it phut.' }; }
    var targets = [];
    if (which.indexOf('care') >= 0) { var shC = getSheet_(SH_CARE, CARE_HEADERS); targets.push({ key: 'CareData', sh: shC, col: 0 }); }
    if (which.indexOf('leads') >= 0) { var shL = getSheet_(SH_CARE_LEAD, CARE_LEAD_HEADERS); targets.push({ key: SH_CARE_LEAD, sh: shL, col: 0 }); }
    if (which.indexOf('cskh') >= 0) {
      var shK = _findCskhDuyenSheet_();
      if (shK && shK.getLastRow() >= 2) {
        var mapK = _cskhHeaderMap_(shK.getRange(1, 1, 1, shK.getLastColumn()).getValues()[0]);
        if (mapK.phone !== undefined) targets.push({ key: 'CSKH-Duyen', sh: shK, col: mapK.phone });
        else res.sheets['CSKH-Duyen'] = { skipped: 'khong nhan ra cot SDT' };
      }
    }
    var bk = null, backupRows = 0;
    targets.forEach(function (tg) {
      var last = tg.sh.getLastRow(), info = { total: Math.max(0, last - 1), invalid: 0, deleted: 0, sample: [] };
      res.sheets[tg.key] = info;
      if (last < 2) return;
      var width = tg.sh.getLastColumn();
      var vals = tg.sh.getRange(2, 1, last - 1, width).getValues();
      var bad = _xoaSdtScan_(vals, tg.col);
      info.invalid = bad.length;
      if (tg.key === 'CSKH-Duyen') {   // chi DEM so SDT hop le bi lap nhieu dong (khong xoa — dong lap co the khac ten/phan loai); de Duyen tu quyet dinh
        var seenP = {}, dupRows = 0;
        for (var d = 0; d < vals.length; d++) { var np = normPhone_(String(vals[d][tg.col] || '')); if (!np || !isValidVnPhone_(np)) continue; if (seenP[np]) dupRows++; else seenP[np] = 1; }
        info.duplicateRowsKeptNotDeleted = dupRows;
      }
      for (var s = 0; s < bad.length && s < 10; s++) info.sample.push(String(vals[bad[s]][tg.col]));
      if (dry || !bad.length) return;
      if (!bk) { bk = getCrmSS_().getSheetByName('XoaSDT_Backup') || getCrmSS_().insertSheet('XoaSDT_Backup'); if (bk.getLastRow() === 0) bk.appendRow(['Thoi gian', 'Sheet', 'SDT', 'Du lieu dong (JSON)']); }
      var runs = _xoaSdtRuns_(bad), stamp = new Date().toISOString();
      for (var r = runs.length - 1; r >= 0; r--) {
        if (new Date().getTime() - t0 > XOA_SDT_BUDGET_MS_) { res.done = false; break; }
        var a = runs[r][0], b = runs[r][1], rowsOut = [];
        for (var k = a; k <= b; k++) {
          var jr = JSON.stringify(vals[k].map(function (v) { return v instanceof Date ? v.toISOString() : v; }));
          rowsOut.push([stamp, tg.key, String(vals[k][tg.col]), jr.length > 49000 ? jr.slice(0, 49000) : jr]);
        }
        bk.getRange(bk.getLastRow() + 1, 1, rowsOut.length, 4).setValues(rowsOut);   // LUU TRUOC khi xoa
        tg.sh.deleteRows(a + 2, b - a + 1);
        info.deleted += b - a + 1;
      }
    });
    if (!dry) {
      var cache = CacheService.getScriptCache();
      ['customers_v12', 'cskhDuyen_v1_n', 'cskhDuyen_idx_v1_n', 'cskhDuyen_lite_v2_n'].forEach(function (k) { try { cache.remove(k); } catch (e) {} });
      if (res.sheets.CareData && res.sheets.CareData.deleted) sbMarkStale_('xoaSdtKhongPhaiVN');   // Supabase care_data con dong cu -> khong doc Supabase cho toi khi backfill lai
    }
    // DT TONG / du lieu don: CHI DEM (khong xoa)
    try {
      var bo = 0; readAllOrders_().forEach(function (o) { if (o.phone && !isValidVnPhone_(o.phone)) bo++; });
      res.orders = { dtTongDonSdtKhongHopLe: bo, ghiChu: 'KHONG xoa don (mat doanh thu). Neu muon xoa, bao Claude de lam rieng kem sao luu.' };
    } catch (eo) { res.orders = { error: String(eo && eo.message || eo) }; }
    res.ms = new Date().getTime() - t0;
    if (!dry && !res.done) res.hint = 'Chua het (het ngan sach thoi gian) — chay lai xoaSdtLoiThat.';
    return res;
  } catch (e) { return { ok: false, error: String(e && e.message || e), partial: res }; }
  finally { try { if (lock) lock.releaseLock(); } catch (e2) {} }
}
// Chay tay tu Editor (chon ten ham o o Run, xem Execution log): xoaSdtLoiThu (CHI DEM, khong xoa) -> xoaSdtLoiThat (xoa that, lap den khi XONG).
// Rieng sheet CSKH-Duyen (~134k dong): xoaSdtLoiCskhThu (CHI DEM) -> xoaSdtLoiCskhThat (xoa that, bam lai den khi XONG; moi lan toi da ~4 phut).
function xoaSdtLoiCskhThu() { Logger.log(JSON.stringify(xoaSdtKhongPhaiVN_({ dryRun: true, sheets: ['cskh'] }), null, 2)); }
function xoaSdtLoiCskhThat() {
  var r = xoaSdtKhongPhaiVN_({ dryRun: false, sheets: ['cskh'] });
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error".' : (r.done ? 'XONG. Dong da xoa luu o sheet XoaSDT_Backup (CRM).' : 'CHUA HET — bam Run lai xoaSdtLoiCskhThat.'));
}
function xoaSdtLoiThu() { Logger.log(JSON.stringify(xoaSdtKhongPhaiVN_({ dryRun: true }), null, 2)); }
function xoaSdtLoiThat() {
  var r = xoaSdtKhongPhaiVN_({ dryRun: false });
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error".' : (r.done ? 'XONG. Dong da xoa luu o sheet XoaSDT_Backup (CRM) — can thi khoi phuc tu do.' : 'CHUA HET — bam Run lai xoaSdtLoiThat.'));
}

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
function readDonPhones_(rows) {
  rows = rows || readDonChiTiet_();   // tham so tuy chon: truyen san rows de khong doc lai (xem action donPhones)
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
function getDonSaleByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    var names = _donSaleNamesFromThe_(rows[i].theSale);
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
// Thong ke POS theo SDT: { phone: { n: so don, rev: tong doanh thu sau giam } } -- BO don 'Da hoan'/'Dang hoan' (cung quy tac Bao cao B).
// Dung cho tong don/tong doanh thu + PHAN HANG KH cua KH da co don Pos (Pos la chuan, bo qua Base). KHONG dung cho Phan loai (van dem n tu getDonOrderCountByPhone_).
function getDonStatsByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (_donHasExcludedStatus_(r.trangThai)) continue;
    var ph = normPhone_(String(r.soDienThoai || ''));
    if (!ph) continue;
    var m = map[ph] || (map[ph] = { n: 0, rev: 0 });
    m.n += 1;
    m.rev += Number(r.giaTriSauGiam) || 0;
  }
  return map;
}

function getDonOrderCountByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    map[ph] = (map[ph] || 0) + 1;
  }
  return map;
}

// Ngay mua GAN NHAT (nguon Pos = sheet "dữ liệu đơn") theo SDT -> { phone: 'yyyy-mm-dd' }. Dung cho cot "Ngày mua gần nhất"
// o Danh sach KH (index.html). Bo qua dong khong parse duoc ngay.
// Don POS cua 1 SDT (moi nhat truoc). Doc tu readDonChiTiet_ (cache 90s) nen goi lien tiep nhieu KH khong doc lai sheet.
function getDonOrdersByPhone_(phone) {
  var ph = normPhone_(String(phone || ''));
  var out = [];
  if (!ph) return out;
  var rows = readDonChiTiet_();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (normPhone_(String(r.soDienThoai || '')) !== ph) continue;
    if (_donHasExcludedStatus_(r.trangThai)) continue;   // bo don hoan -- khop getDonStatsByPhone_ (tong tren ho so = tong lich su Pos)
    var dt = parseVNDate_(r.ngayTaoDon);
    out.push({
      date: dt ? _vnYmd_(dt) : '',
      product: r.sanPham || '',
      productCode: r.maSanPham || '',
      qty: r.soLuong || '',
      revenue: Number(r.giaTriSauGiam) || 0,
      cod: Number(r.cod) || 0,
      source: r.nguonDon || '',
      status: r.trangThai || '',
      sale: r.theSale || '',
      marketer: r.marketer || '',
      note: r.ghiChu || ''
    });
  }
  out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return out;
}

// Danh sach SAN PHAM (ma + ten) co trong "du lieu don" — nguon cho o tim/tick san pham cua Chuong trinh thuong (js/12 modal "Chuong trinh thuong").
// 3 cot dung 3 dau phan cach KHAC NHAU (xem buildSalesReportB_): ten ',' | ma ';' | so luong ','; ghep theo VI TRI. Ten chi lay khi dong khop so luong
// ten = so luong ma (dong lech cot thi ten khong chac khop ma -> bo qua ten, van ghi nhan ma). Tra [{code,name,n(so dong don),qty}] sap theo qty giam dan.
function buildDonProducts_(rows) {
  rows = rows || readDonChiTiet_();
  var by = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (_donHasExcludedStatus_(r.trangThai)) continue;
    var codes = splitMulti_(r.maSanPham, ';'), names = splitMulti_(r.sanPham, ','), qtys = splitMulti_(r.soLuong, ',');
    if (!codes.length) continue;
    var aligned = names.length === codes.length;
    for (var k = 0; k < codes.length; k++) {
      var code = String(codes[k] || '').trim(); if (!code) continue;
      var key = code.toLowerCase(), o = by[key] || (by[key] = { code: code, name: '', n: 0, qty: 0, nameVotes: {} });
      o.n++; o.qty += Number(String(qtys[k] || '0').replace(',', '.')) || 0;
      if (aligned && names[k]) { var nm = String(names[k]).trim(); o.nameVotes[nm] = (o.nameVotes[nm] || 0) + 1; }
    }
  }
  var out = Object.keys(by).map(function (key) {
    var o = by[key], best = '', bc = 0;
    Object.keys(o.nameVotes).forEach(function (nm) { if (o.nameVotes[nm] > bc) { bc = o.nameVotes[nm]; best = nm; } });
    return { code: o.code, name: best, n: o.n, qty: o.qty };
  });
  out.sort(function (a, b) { return b.qty - a.qty; });
  return out;
}

function getDonLastDateByPhone_(rows) {
  rows = rows || readDonChiTiet_();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var ph = normPhone_(String(rows[i].soDienThoai || ''));
    if (!ph) continue;
    var dt = parseVNDate_(rows[i].ngayTaoDon);
    if (!dt) continue;
    var iso = _vnYmd_(dt); // ngay duong lich VN (parseVNDate_ tra ve 00:00 gio VN = 17:00Z hom truoc, KHONG dung getDate() theo mui gio du an)
    if (!iso) continue;
    if (!map[ph] || iso > map[ph]) map[ph] = iso;
  }
  return map;
}

// Chuyen cac dong tho cua "dữ liệu đơn" thanh object don (TACH TU readDonChiTiet_ 2026-10-09 de Supabase backfill/doc dung CHUNG 1 logic —
// khong duoc co 2 ban logic lech nhau). vals = mang dong (getValues, bat dau tu so dong firstRow, 1-based); lastNgay = ngay ke thua tu dong
// co ngay gan nhat TRUOC lo nay ('' o lo dau). Tra { items:[{srcRow, obj}], lastNgay } — dong bi bo (rong/dong Tong) khong co trong items.
function _donConvertRows_(vals, firstRow, lastNgay) {
  var items = [];
  var lastNgayTaoDon = (lastNgay === undefined || lastNgay === null) ? '' : lastNgay; // ngay cua dong co ngay gan nhat phia tren — de dong thieu ngay van loc duoc theo ky
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    // SUA 2026-10-04 theo yeu cau Duyen: dong KHONG co ngay va KHONG co ten khach van la don THAT neu cot Q
    // "Ghi chú đơn" co ma bo dem (= ma bo dem cot U cua don goc o DT TONG: don len DT TONG truoc, khong bi
    // huy moi len Pos kem ghi chu; don Pos huy thi Base huy theo) -> PHAI tinh. Dong khong ngay, khong khach,
    // khong ma o Q (dong rong, dong "Tong" cuoi sheet, dong noi tiep khong phai don) thi bo.
    if (!r[1] && !r[3] && !(r[DON_COL_GHICHU] && String(r[DON_COL_GHICHU]).trim())) continue;
    var nguonDon = r[7] ? String(r[7]).trim() : '';
    // SUA 2026-09-30: TRUOC DAY loai don nguon "Bảo hành" khoi Bao cao B/C — nhung doi chieu
    // voi bang ke toan (Duyen xac nhan), doanh thu don bao hanh CO duoc tinh (vd nguyenngo1988
    // ky 1-10/9: 18.505.000 chi khop tuyet doi neu TINH ca 28 don nguon "Bảo hành" trong ky).
    // Bo han dieu kien loai nay — khong con exclude theo nguonDon nua.
    // Chuan hoa ve chuoi "dd/MM/yyyy" NGAY TAI DAY (khong giu nguyen Date object) — de:
    //  (1) parseVNDate_ luon nhan dung 1 dinh dang bat ke o goc la Date hay text,
    //  (2) ket qua serialize/deserialize duoc qua JSON.stringify khi cache (Date bi doi
    //      thanh chuoi ISO "T..." se KHONG khop dinh dang parseVNDate_ dang cho, gay sai lech
    //      ngay am tham neu khong chuan hoa truoc).
    // FIX: KHONG dung Utilities.formatDate/Session.getScriptTimeZone() (code truoc do dung) —
    // ca 2 deu phu thuoc cau hinh Time Zone cua du an Apps Script, chinh la nguyen nhan da gay
    // bug "ngay hom truoc lan sang ngay hom sau" tung gap (xem giai thich day du o _vnYmd_ phia
    // tren). Dung _vnYmdParts_ (offset VN +7 co dinh, khong phu thuoc cau hinh du an) de chuyen
    // Date -> "dd/MM/yyyy" AN TOAN TUYET DOI, dung voi moi du an bat ke Time Zone dang de la gi.
    var ngayRaw = r[1];
    var ngayTaoDon = ngayRaw;
    if (Object.prototype.toString.call(ngayRaw) === '[object Date]' && !isNaN(ngayRaw)) {
      var pDon = _vnYmdParts_(ngayRaw);
      if (pDon) ngayTaoDon = String(pDon.d).padStart(2, '0') + '/' + String(pDon.mo).padStart(2, '0') + '/' + pDon.y;
    }
    // Dong thieu ngay -> ke thua ngay cua dong co ngay gan nhat phia tren (neu khong, dateInRange_ se loai no
    // ngay khi co bo loc ngay va doanh thu bi mat am tham).
    if (ngayTaoDon === '' || ngayTaoDon === null || ngayTaoDon === undefined) ngayTaoDon = lastNgayTaoDon;
    else lastNgayTaoDon = ngayTaoDon;
    items.push({ srcRow: firstRow + i, obj: {
      ngayTaoDon:    ngayTaoDon,
      khachHang:     r[3],
      soDienThoai:   r[4],
      nguonDon:      nguonDon,
      theSale:       r[2] ? String(r[2]) : '',   // cot "Thẻ" (C) — danh sach sale tham gia don, tach bang dau phay ','
      trangThai:     r[14] ? String(r[14]).trim() : '', // cot "Trạng thái" (O) — nguon RIENG, doc lap voi trang thai co the lap trong cot "Thẻ"
      sanPham:       r[8] ? String(r[8]) : '',   // tach bang dau phay ','
      maSanPham:     r[9] ? String(r[9]) : '',   // tach bang dau cham phay ';' — KHAC voi sanPham/soLuong
      soLuong:       r[10] ? String(r[10]) : '', // tach bang dau phay ','
      giaTriSauGiam: _normMoney_(r[11]),
      cod:           _normMoney_(r[12]),
      marketer:      r[13] ? String(r[13]).trim() : '',
      ghiChu:        r[DON_COL_GHICHU] ? String(r[DON_COL_GHICHU]) : '' // cot Q — ghi chu don ("Ghép cùng đơn" + ma bo dem)
    } });
  }
  return { items: items, lastNgay: lastNgayTaoDon };
}

// ── Doc toan bo sheet "dữ liệu đơn" thanh mang object ──
// Doc sheet "dữ liệu đơn" (nguon Bao cao B — Pos), co CACHE ngan (90s) vi day la sheet lon
// (hang nghin dong) chi de DOC (CRM khong bao gio ghi vao sheet nay — du lieu vao tu Base/Pos
// dong bo rieng), nen cache ngan giup Bao cao B/thay doi bo loc khong phai doc lai toan bo
// sheet moi lan bam Loc — tang toc ro ret ma van cap nhat du lieu moi trong vong <=90s.
function readDonChiTiet_() {
  var cached = _cacheGetBig_('donChiTiet_v4'); // v4: giu dong thieu ngay/khach co ma bo dem o cot Q + ke thua ngay
  if (cached) { try { return JSON.parse(cached); } catch (eParse) {} }

  var ss = getDTSS_();
  var sh = ss.getSheetByName(DON_CHITIET_SHEET);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, Math.min(DON_CHITIET_WIDTH, sh.getMaxColumns())).getValues();
  var conv = _donConvertRows_(vals, 2, '');
  var out = conv.items.map(function (it) { return it.obj; });
  try { _cachePutBig_('donChiTiet_v4', JSON.stringify(out), 90); } catch (eCache) {}
  return out;
}

// ── BAO CAO A: theo "DT TỔNG " ──
// filters: { dateFrom, dateTo, dateField ('ngayTao'|'thoiGianHT'), sale (mang ten hoac ''), kenh ('' = tat ca) }
// ── Lay danh sach Sale ban / Kenh ban distinct (cho UI chon, thay vi go dung ten) ──
// Tim 1 tab trong spreadsheet theo gid (lay tu URL "#gid=..."). Khong thay thi lui ve tab DAU
// TIEN cua file (gid=0 hau het la tab mac dinh nay) de khong bao giolam ho ghi that bai vi le
// nguoi dung xoa/doi ten tab do.
function _sheetByGid_(ss, gid) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) { if (sheets[i].getSheetId() === gid) return sheets[i]; }
  return sheets[0] || null;
}

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
    var saleBList0 = _donSaleNamesFromThe_(rowsB0[iB0].theSale);
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

// "Đơn đổi" (doi hang) — giaTriDon van tinh doanh thu nhu binh thuong ("khong ship" — dung
// y voi nhan san co tren UI Bao cao A). Rieng cot "Gia tri chenh lech" (giaTriChenh, cot S)
// truoc gio CHUA duoc cong vao doanh thu o dau ca — sua: CONG THEM (khong thay the giaTriDon)
// phan chenh lech nay cho cac dong duoc phan loai la "doi hang", dung yeu cau "doanh thu =
// tong gia tri don khong ship + gia tri chenh lech cua don doi". Nhan dien don doi theo cot
// "Phan loai" chua tu "doi" (khong dau, khong phan biet hoa/thuong) — vd "Đơn đổi", "Đổi
// hàng"... deu khop; neu sheet dung 1 cum tu khac (khong chua "doi") thi dong do se khong
// duoc cong THEM phan chenh lech (van an toan, khong bi tru nham doanh thu that).
function _dtIsExchangeOrder_(phanLoai) {
  return _psheetNoAccent_(phanLoai).indexOf('doi') !== -1;
}
function _dtOrderRevenue_(m) {
  var extra = _dtIsExchangeOrder_(m.phanLoai) ? (m.giaTriChenh || 0) : 0;
  return m.giaTriDon + extra;
}

// ── Tỷ lệ chốt theo Sale / theo Kênh / theo Page — TACH DUNG CHUNG cho Bao cao A va B (2026-09).
// normRows: mang cac don DA CHUAN HOA ve 1 hinh dang chung {kenhBan, dateStr, saleBanRaw}, bat
// ke du lieu goc tu DT TONG (A) hay "du lieu don" (B). Noi dung ham nay la COPY NGUYEN VAN logic
// cu cua buildSalesReportA_ (chi doi ten bien mc[dateField]/mc.saleBan -> mc.dateStr/mc.saleBanRaw
// cho tong quat), KHONG duoc doi cong thuc khi sua — neu can doi cong thuc tinh ty le chot thi
// sua o day se anh huong CA Bao cao A lan B.
function _srCloseRateSections_(normRows, filters) {
  var UNASSIGNED = '(chưa gán sale)';
  var fFromYmd = _dateStrToVnYmd_(filters.dateFrom), fToYmd = _dateStrToVnYmd_(filters.dateTo);
  var pageCoveredDates = _pkTrackedDatesByPageAndSale_(fFromYmd, fToYmd).datesByPage;
  var hasAnyPkData = Object.keys(pageCoveredDates).length > 0;
  var pkPageMap = readPancakePageMap_(); // pageId -> kenhBan
  var kenhToPageIds = {};
  Object.keys(pkPageMap).forEach(function(pid) {
    var kn = pkPageMap[pid]; if (!kn) return;
    if (!kenhToPageIds[kn]) kenhToPageIds[kn] = [];
    kenhToPageIds[kn].push(pid);
  });
  function _srOrderCovered_(kenhBan, ymd){
    var pids = kenhToPageIds[kenhBan] || [];
    return pids.some(function(pid){ return pageCoveredDates[pid] && pageCoveredDates[pid][ymd]; });
  }

  var saleCloseRate = [];
  var closeFrom = '';
  if (hasAnyPkData) {
    var closeOrdersBySale = {};
    for (var ci = 0; ci < normRows.length; ci++) {
      var mc = normRows[ci];
      var mcDt = parseVNDate_(mc.dateStr);
      if (!mcDt) continue;
      var mcYmd = _vnYmd_(mcDt);
      if (!_srOrderCovered_(mc.kenhBan, mcYmd)) continue;
      if (!closeFrom || mcYmd < closeFrom) closeFrom = mcYmd;
      var salesOnOrderC = splitMulti_(mc.saleBanRaw, ',');
      if (!salesOnOrderC.length) salesOnOrderC = [UNASSIGNED];
      salesOnOrderC.forEach(function(sn) { closeOrdersBySale[sn] = (closeOrdersBySale[sn] || 0) + 1; });
    }
    var pInt2 = buildPancakeReport_(filters.dateFrom, filters.dateTo, 'equal');
    var closeCanon = {};
    var closeKey = function(n) { var ck = _normTxt_(n); if (!closeCanon[ck]) closeCanon[ck] = n; return ck; };
    var closeAgg = {};
    pInt2.byCS.forEach(function(r) { var k = closeKey(r.name); closeAgg[k] = { name: closeCanon[k], tongTT: r.tongTT || 0, orders: 0 }; });
    Object.keys(closeOrdersBySale).forEach(function(sn) {
      var k = closeKey(sn);
      if (!closeAgg[k]) closeAgg[k] = { name: closeCanon[k], tongTT: 0, orders: 0 };
      closeAgg[k].orders += closeOrdersBySale[sn];
    });
    saleCloseRate = Object.keys(closeAgg).map(function(k) {
      var r = closeAgg[k];
      return { name: r.name, held: Math.round(r.tongTT * 100) / 100, closed: r.orders,
               closeRate: r.tongTT ? Math.round(r.orders / r.tongTT * 1000) / 10 : 0 };
    });
  }

  var kenhCloseRate = [];
  if (hasAnyPkData) {
    var closeOrdersByKenh = {};
    for (var cki = 0; cki < normRows.length; cki++) {
      var mck = normRows[cki];
      var mckDt = parseVNDate_(mck.dateStr);
      if (!mckDt) continue;
      var mckYmd = _vnYmd_(mckDt);
      var kn = mck.kenhBan || '(chưa có kênh)';
      if (!_srOrderCovered_(kn, mckYmd)) continue;
      closeOrdersByKenh[kn] = (closeOrdersByKenh[kn] || 0) + 1;
    }
    var pInt3 = buildPancakeReport_(filters.dateFrom, filters.dateTo, 'equal');
    var tongTTByKenh = {};
    pInt3.byPage.forEach(function(p) {
      var kn2 = pkPageMap[p.pageId] || '';
      if (!kn2) return;
      tongTTByKenh[kn2] = (tongTTByKenh[kn2] || 0) + (p.tongTT || 0);
    });
    var allKenhKeys = {};
    Object.keys(closeOrdersByKenh).forEach(function(k){ allKenhKeys[k]=1; });
    Object.keys(tongTTByKenh).forEach(function(k){ allKenhKeys[k]=1; });
    kenhCloseRate = Object.keys(allKenhKeys).map(function(kn3) {
      var tongTTk = tongTTByKenh[kn3] || 0;
      var closedK = closeOrdersByKenh[kn3] || 0;
      return { name: kn3, held: Math.round(tongTTk * 100) / 100, closed: closedK,
               closeRate: tongTTk ? Math.round(closedK / tongTTk * 1000) / 10 : 0 };
    });
  }

  var saleCloseByPage = { pages: [], rows: [] };
  if (hasAnyPkData) {
    var mapSaleK = readPancakeMap_();
    var pageInfoByKenh = {};
    var ttBySaleKenh = {};
    var vPk = _pkStatsRowsMemo_();
    if (vPk.length) {
      for (var pki = 0; pki < vPk.length; pki++) {
        var dPk = normOrderDate_(vPk[pki][0]);
        if (fFromYmd && dPk < fFromYmd) continue;
        if (fToYmd && dPk > fToYmd) continue;
        var pageIdPk = String(vPk[pki][1]), pageNamePk = String(vPk[pki][2]), nhanVienPk = String(vPk[pki][3]), ttPk = +vPk[pki][6] || 0;
        if (!ttPk) continue;
        var kenhPk = pkPageMap[pageIdPk] || '';
        if (!kenhPk) continue;
        if (!pageInfoByKenh[kenhPk]) pageInfoByKenh[kenhPk] = { pageId: pageIdPk, pageName: pageNamePk, kenhBan: kenhPk };
        var salesPk = String(mapSaleK[nhanVienPk] || '').split('|').map(function(x){return x.trim();}).filter(function(x){return x;});
        if (!salesPk.length) salesPk = [nhanVienPk];
        salesPk.forEach(function(spn) {
          var key = spn + '|||' + kenhPk;
          ttBySaleKenh[key] = (ttBySaleKenh[key] || 0) + ttPk;
        });
      }
    }
    var closedBySaleKenh = {};
    for (var cpi = 0; cpi < normRows.length; cpi++) {
      var mcp = normRows[cpi];
      var mcpDt = parseVNDate_(mcp.dateStr);
      if (!mcpDt) continue;
      var mcpYmd = _vnYmd_(mcpDt);
      var kenhP = mcp.kenhBan || '(chưa có kênh)';
      if (!_srOrderCovered_(kenhP, mcpYmd)) continue;
      var salesOnP = splitMulti_(mcp.saleBanRaw, ',');
      if (!salesOnP.length) salesOnP = [UNASSIGNED];
      salesOnP.forEach(function(spn2) {
        var key2 = spn2 + '|||' + kenhP;
        closedBySaleKenh[key2] = (closedBySaleKenh[key2] || 0) + 1;
      });
    }
    var pagesList = Object.keys(pageInfoByKenh).map(function(k){ return pageInfoByKenh[k]; })
      .sort(function(a,b){ return a.pageName.localeCompare(b.pageName,'vi'); });
    var byPageSaleCanon = {}, byPageSaleKey = function(n){ var ck=_normTxt_(n); if(!byPageSaleCanon[ck]) byPageSaleCanon[ck]=n; return ck; };
    var rowsMap = {};
    function ensureRow(sn) {
      var k = byPageSaleKey(sn);
      if (!rowsMap[k]) rowsMap[k] = { name: byPageSaleCanon[k], perPage: {}, totalHeld: 0, totalClosed: 0 };
      return rowsMap[k];
    }
    Object.keys(ttBySaleKenh).forEach(function(key) {
      var parts = key.split('|||'), sn = parts[0], kn = parts[1];
      var r = ensureRow(sn);
      var held = ttBySaleKenh[key] || 0, closed = closedBySaleKenh[key] || 0;
      r.perPage[kn] = { held: Math.round(held*100)/100, closed: closed, rate: held ? Math.round(closed/held*1000)/10 : 0 };
      r.totalHeld += held; r.totalClosed += closed;
    });
    Object.keys(closedBySaleKenh).forEach(function(key) {
      var parts = key.split('|||'), sn = parts[0], kn = parts[1];
      var r = ensureRow(sn);
      if (!r.perPage[kn]) { r.perPage[kn] = { held: 0, closed: closedBySaleKenh[key], rate: 0 }; r.totalClosed += closedBySaleKenh[key]; }
    });
    saleCloseByPage.pages = pagesList;
    saleCloseByPage.rows = Object.keys(rowsMap).map(function(k) {
      var r = rowsMap[k];
      return { name: r.name, perPage: r.perPage,
        total: { held: Math.round(r.totalHeld*100)/100, closed: r.totalClosed,
                 rate: r.totalHeld ? Math.round(r.totalClosed/r.totalHeld*1000)/10 : 0 } };
    });
  }

  return { saleCloseRate: saleCloseRate, kenhCloseRate: kenhCloseRate, saleCloseByPage: saleCloseByPage, closeFrom: closeFrom || null };
}

// Trich pageId (so cuoi trong ngoac don o cuoi chuoi) tu cot "Nguồn đơn" cua Bao cao B, vd
// "Facebook / Hiền Phạm Tourmaline (862972056891669)" -> "862972056891669". Dong khong co ID
// dang nay (vd "Bảo hành", "Quầy Hào Nam", "Fb Phạm Thu Hiền" go tay khong theo chuan) tra ve
// chuoi rong — cac don nay se duoc thu khop tiep theo TEN Page qua _extractPageNameFromNguonDon_
// (xem buildSalesReportB_), chi thuc su bi bo qua neu CA 2 cach deu khong khop duoc Page nao.
function _extractPageIdFromNguonDon_(nguonDon) {
  var m = String(nguonDon || '').match(/\((\d+)\)\s*$/);
  return m ? m[1] : '';
}

// Trich TEN Page tu cot "Nguồn đơn" (du phong khi khong co ID kem theo, theo yeu cau Duyen
// 2026-10: khop "theo ten Page HOAC Id Page"). Bo tien to "Nen tang / " (neu co dau "/") va hau
// to "(ID)" o cuoi (neu co) — vd "Facebook / Hiền Tour Shop (678324468689325)" -> "Hiền Tour
// Shop"; "Quầy Hào Nam" (khong co "/" , khong co ID) -> giu nguyen "Quầy Hào Nam"; "Fb Phạm Thu
// Hiền" (khong co "/") -> giu nguyen ca chuoi. Dung ket hop voi readPancakePageMapByName_ de
// khop cac Page KHONG co ID Pancake thuc (vd quay ban truc tiep/kenh thu cong) MA admin da tu
// dien ten + "Kênh bán" tuong ung thang vao sheet PancakePageMap (pageId co the la gia tri tu
// dat, khong can trung voi ID Pancake thuc vi cot nay chi dung lam khoa duy nhat cua dong).
function _extractPageNameFromNguonDon_(nguonDon) {
  var t = String(nguonDon || '').trim();
  if (!t) return '';
  var nameOnly = t.replace(/\(\d+\)\s*$/, '').trim();
  var slashIdx = nameOnly.indexOf('/');
  if (slashIdx !== -1) nameOnly = nameOnly.slice(slashIdx + 1).trim();
  return nameOnly;
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
    if (_isExcludedOrderStatus_(row.trangThai)) continue; // bo don Huy/Tra lai/Hoan tien/Thai bai/Khieu nai (Quy che thu lao Sale)
    if (kenhFilterArr.length && kenhFilterArr.indexOf(row.kenhBan) === -1) continue;
    var salesOnOrder = splitMulti_(row.saleBan, ',');
    if (saleFilterArr.length && !salesOnOrder.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
    if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
    matched.push(row);
  }

  // Tong chung: tinh du gia tri 1 lan, KHONG chia theo sale
  var totalCoc = 0, totalGiaTri = 0, totalGiaTriChenh = 0;
  var bySale = {}; // ten sale -> { orders, coc, giaTri }
  var byKenh = {}; // ten kenh -> { orders, coc, giaTri }
  var UNASSIGNED = '(chưa gán sale)';

  // Team Sale: sale -> ten team (readTeams_ dung chung voi tab "Quan ly Team")
  var saleTeamMap = {}; // ten sale (username) -> ten team
  readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
    (t.members || []).forEach(function(u) { saleTeamMap[u] = t.name; });
  });
  var UNASSIGNED_TEAM = '(chưa có Team)';
  var byTeamSale = {};

  for (var j = 0; j < matched.length; j++) {
    var m = matched[j];
    var revenue = _dtOrderRevenue_(m);
    if (_dtIsExchangeOrder_(m.phanLoai)) totalGiaTriChenh += (m.giaTriChenh || 0);
    totalCoc += m.giaTriCoc;
    totalGiaTri += revenue;

    // breakdown theo kenh: kenh la single-value, khong chia
    var kName = m.kenhBan || '(chưa có kênh)';
    if (!byKenh[kName]) byKenh[kName] = { orders: 0, coc: 0, giaTri: 0 };
    byKenh[kName].orders += 1;
    byKenh[kName].coc += m.giaTriCoc;
    byKenh[kName].giaTri += revenue;

    // breakdown theo sale:
    // - Mac dinh: so don GIU NGUYEN (khong chia), phan tien CHIA DEU cho N sale tren don.
    // - byCreator: ca so don LAN tien tinh TRON VEN cho DUNG 1 nguoi — nguoi duoc ghi trong cot
    //   "Người tạo" that su cua DT TONG (KHONG phai ten dau tien trong "Sale bán").
    if (byCreator) {
      var creatorName = m.nguoiTao || UNASSIGNED;
      if (!bySale[creatorName]) bySale[creatorName] = { orders: 0, coc: 0, giaTri: 0 };
      bySale[creatorName].orders += 1;
      bySale[creatorName].coc += m.giaTriCoc;
      bySale[creatorName].giaTri += revenue;

      var creatorTeam = saleTeamMap[creatorName] || UNASSIGNED_TEAM;
      if (!byTeamSale[creatorTeam]) byTeamSale[creatorTeam] = { orders: 0, coc: 0, giaTri: 0 };
      byTeamSale[creatorTeam].orders += 1;
      byTeamSale[creatorTeam].coc += m.giaTriCoc;
      byTeamSale[creatorTeam].giaTri += revenue;
    } else {
      var salesList = splitMulti_(m.saleBan, ',');
      if (salesList.length === 0) salesList = [UNASSIGNED];
      var n = salesList.length;
      // So don theo Team: dem 1 lan cho moi TEAM KHAC NHAU xuat hien tren don (tranh 1 don co
      // 2 sale CUNG team bi dem 2 lan); tien van chia deu theo tung sale nhu bySale.
      var teamsOnOrder = {};
      for (var k = 0; k < salesList.length; k++) {
        var sName = salesList[k];
        if (!bySale[sName]) bySale[sName] = { orders: 0, coc: 0, giaTri: 0 };
        bySale[sName].orders += 1;                 // so don: khong chia
        bySale[sName].coc += m.giaTriCoc / n;       // tien: chia deu cho N sale
        bySale[sName].giaTri += revenue / n;

        var tName = saleTeamMap[sName] || UNASSIGNED_TEAM;
        if (!byTeamSale[tName]) byTeamSale[tName] = { orders: 0, coc: 0, giaTri: 0 };
        byTeamSale[tName].coc += m.giaTriCoc / n;
        byTeamSale[tName].giaTri += revenue / n;
        teamsOnOrder[tName] = true;
      }
      Object.keys(teamsOnOrder).forEach(function(tName2) { byTeamSale[tName2].orders += 1; });
    }
  }

  function toArr(obj) {
    var arr = [];
    for (var key in obj) {
      arr.push({ name: key, orders: obj[key].orders, coc: obj[key].coc, giaTri: obj[key].giaTri,
                 trungBinhDon: obj[key].orders ? Math.round(obj[key].giaTri / obj[key].orders) : 0 });
    }
    arr.sort(function(a, b){ return b.giaTri - a.giaTri; });
    return arr;
  }

  // Theo MKT: kenh ban -> Page (PancakePageMap) -> nhom MKT (MktTeams). Kenh chua gan MKT -> "(chưa gán MKT)".
  // Page chay chung nhieu MKT: so don/tien chia theo ty le 'share' da chuan hoa.
  var kenhW = _mktKenhWeights_(readMktTeams_(), readPancakePageMap_());
  var byMktObj = {};
  Object.keys(byKenh).forEach(function(kn) {
    var ws = kenhW[kn] || [{ id: '_none', name: '(chưa gán MKT)', w: 1 }];
    ws.forEach(function(x) {
      if (!byMktObj[x.name]) byMktObj[x.name] = { orders: 0, coc: 0, giaTri: 0 };
      byMktObj[x.name].orders += byKenh[kn].orders * x.w;
      byMktObj[x.name].coc += byKenh[kn].coc * x.w;
      byMktObj[x.name].giaTri += byKenh[kn].giaTri * x.w;
    });
  });
  var byMktArr = Object.keys(byMktObj).map(function(k) {
    var o = byMktObj[k];
    return { name: k, orders: Math.round(o.orders * 100) / 100, coc: Math.round(o.coc), giaTri: Math.round(o.giaTri),
             trungBinhDon: o.orders ? Math.round(o.giaTri / o.orders) : 0 };
  }).sort(function(a, b){ return b.giaTri - a.giaTri; });

  // ── Tỷ lệ chốt theo Sale / theo Kênh / theo Page — dùng hàm chung _srCloseRateSections_
  // (tách 2026-09 để Báo cáo B dùng lại cùng công thức). Chuẩn hoá "matched" (DT TỔNG) về hình
  // dạng chung {kenhBan, dateStr, saleBanRaw} rồi gọi — nội dung/công thức giữ NGUYÊN VẸN như cũ.
  var normRowsA_ = matched.map(function(mc) {
    return { kenhBan: mc.kenhBan, dateStr: mc[dateField], saleBanRaw: mc.saleBan };
  });
  var closeSectionsA_ = _srCloseRateSections_(normRowsA_, filters);
  var saleCloseRate = closeSectionsA_.saleCloseRate;
  var kenhCloseRate = closeSectionsA_.kenhCloseRate;
  var saleCloseByPage = closeSectionsA_.saleCloseByPage;
  var closeFrom = closeSectionsA_.closeFrom;

  return {
    totalOrders: matched.length,
    totalCoc: totalCoc,
    totalGiaTri: totalGiaTri,
    totalGiaTriChenh: totalGiaTriChenh,
    bySale: toArr(bySale),
    byKenh: toArr(byKenh),
    byTeamSale: toArr(byTeamSale),
    byMkt: byMktArr,
    saleCloseRate: saleCloseRate,
    saleCloseRateFrom: closeFrom || null,
    kenhCloseRate: kenhCloseRate,
    kenhCloseRateFrom: closeFrom || null,
    saleCloseByPage: saleCloseByPage,
    trungBinhDon: matched.length ? Math.round(totalGiaTri / matched.length) : 0,
    orders: matched.map(function(m){
      return {
        ngayTao: m.ngayTao, thoiGianHT: m.thoiGianHT, kenhBan: m.kenhBan,
        saleBan: m.saleBan, sanPham: m.sanPham, phanLoai: m.phanLoai,
        giaTriCoc: m.giaTriCoc, giaTriDon: m.giaTriDon, giaTriChenh: m.giaTriChenh,
        giaiDoan: m.giaiDoan, trangThai: m.trangThai, id: m.id
      };
    })
  };
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO F: TY LE HOAN THANH KPI THEO SALE — theo yeu cau Duyen 2026-09.
//  - Sale van phong (Nhom = "Văn phòng" trong SaleDirectory) duoc gan 1 trong 3 BAC, moi bac 1
//    muc KPI rieng (mac dinh Bac 1 = 400tr, Bac 2 = 500tr, Bac 3 = 500tr — Duyen tu sua duoc).
//  - Sale online (Nhom = "Online") KHONG chia bac, dung CHUNG 1 muc KPI (mac dinh 500tr).
//  - Moi Sale (bat ke van phong/online) co the dat 1 muc KPI COMMIT RIENG. SUA 2026-10-04 (Duyen
//    yeu cau giong file Excel "Theo doi doanh thu"): Commit rieng nay la MUC TIEU SONG SONG voi
//    KPI theo bac — co %HT rieng (pctCommit) — KHONG con GHI DE/thay the KPI theo bac nhu truoc
//    (truoc do 'overrides' lam target = so Commit va bo qua het bac). Ten field luu tru 'overrides'
//    va cac bien/ham noi bo '_srKpiEditSetOverride'/'override' o index.html GIU NGUYEN de khong
//    phai migrate du lieu Settings da luu (tuong thich nguoc), nhung tu nay KHONG con nghia la
//    "ghi de" nua — xem buildSaleKpiReport_ ben duoi va _srRenderF_ o index.html.
//  Cau hinh luu O 1 SETTING DUY NHAT 'saleKpiConfig' — KHONG chia theo thang, sua la ap dung
//  ngay (giong het co che "% hoa hong ca nhan" / individualRates da co san, client tu doc/ghi
//  qua action getSetting/setSetting chung, KHONG can route rieng cho phan luu cau hinh).
// ═══════════════════════════════════════════════════════════════
// 9 bac: TVF1/TVF2 (thu viec, F track) -> F1/F2/F3 (Van phong chinh thuc) VA O1/O2/O3 (Online
// co nhay bac) VA O (Online KHONG nhay bac, giu nguyen KPI mai mai). Theo dung sheet "Bậc" Duyen
// gui 2026-10-01. track dung de +-1 cap (F1<->F2<->F3, O1<->O2<->O3); probation=true: luon CHI
// giu dung 1 thang roi tu dong chuyen F1 (bat ke ket qua thang do), khong xet 3 thang nhu binh
// thuong; track 'OFLAT': khong bao gio doi bac, bo qua toan bo cong thuc tang/giam.
var SALE_TIER_ORDER_ = ['TVF1', 'TVF2', 'F1', 'F2', 'F3', 'O1', 'O2', 'O3', 'O'];
var SALE_TIER_DEFAULT_TARGETS_ = {
  TVF1: 240000000, TVF2: 300000000,
  F1: 400000000, F2: 500000000, F3: 600000000,
  O1: 700000000, O2: 800000000, O3: 900000000,
  O: 500000000
};
var SALE_TIER_META_ = {
  TVF1: { track: 'F', level: 0, probation: true },
  TVF2: { track: 'F', level: 0, probation: true },
  F1: { track: 'F', level: 1 },
  F2: { track: 'F', level: 2 },
  F3: { track: 'F', level: 3 },
  O1: { track: 'O', level: 1 },
  O2: { track: 'O', level: 2 },
  O3: { track: 'O', level: 3 },
  O: { track: 'OFLAT', level: 0 }
};
var SALE_KPI_DEFAULT_CFG_ = {
  tierTargets: JSON.parse(JSON.stringify(SALE_TIER_DEFAULT_TARGETS_)),
  startTier: {},                   // ten Sale (dung y het chuoi "Sale bán"/"Thẻ") -> 1 trong SALE_TIER_ORDER_
  trackingStartMonth: '2026-09',   // 'YYYY-MM' - thang bat dau tu dong tinh bac theo quy che
  overrides: {}                    // ten Sale -> so tien KPI rieng (uu tien tuyet doi, bo qua bac tu dong)
};

function readSaleKpiConfig_() {
  var out = JSON.parse(JSON.stringify(SALE_KPI_DEFAULT_CFG_));
  try {
    var raw = getSetting_('saleKpiConfig');
    if (raw) {
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        if (o.tierTargets && typeof o.tierTargets === 'object') {
          SALE_TIER_ORDER_.forEach(function(k) { var n = Number(o.tierTargets[k]); if (!isNaN(n) && n >= 0) out.tierTargets[k] = n; });
        }
        if (o.trackingStartMonth) out.trackingStartMonth = String(o.trackingStartMonth);
        if (o.startTier && typeof o.startTier === 'object') {
          Object.keys(o.startTier).forEach(function(name) { if (SALE_TIER_META_[o.startTier[name]]) out.startTier[name] = o.startTier[name]; });
        }
        if (o.overrides && typeof o.overrides === 'object') out.overrides = o.overrides;
        // Migration tu cau hinh CU (truoc 2026-10, 3 bac chung "1"/"2"/"3" + 1 muc Online phang):
        // neu CHUA co startTier moi ma con du lieu cu (o.tiers), tu suy startTier 1 lan de khong
        // mat trang toan bo cau hinh da cham truoc do. "1"/"2"/"3" (Van phong) -> F1/F2/F3; Sale
        // tung duoc gan saleChannels='online' nhung chua co trong o.tiers -> mac dinh 'O' (phang,
        // an toan nhat vi khong biet ho dang o muc nao trong O1-O3) — Duyen sua lai tung nguoi sau.
        if ((!o.startTier || !Object.keys(o.startTier).length)) {
          var oldMap = { '1': 'F1', '2': 'F2', '3': 'F3' };
          if (o.tiers && typeof o.tiers === 'object') {
            Object.keys(o.tiers).forEach(function(name) { var mapped = oldMap[o.tiers[name]]; if (mapped) out.startTier[name] = mapped; });
          }
          try {
            var rawCh = getSetting_('saleChannels');
            if (rawCh) {
              var oCh = JSON.parse(rawCh);
              Object.keys(oCh || {}).forEach(function(name) { if (oCh[name] === 'online' && !out.startTier[name]) out.startTier[name] = 'O'; });
            }
          } catch (eCh) {}
        }
      }
    }
  } catch (e) {}
  // Config cu chi co onlineTarget, chua tung luu targets.online rieng -> lay onlineTarget lam gia tri khoi diem.
  if (out.targets.online === SALE_KPI_DEFAULT_CFG_.targets.online && out.onlineTarget !== SALE_KPI_DEFAULT_CFG_.onlineTarget) {
    out.targets.online = out.onlineTarget;
  }
  return out;
}

// ── Thang (YYYY-MM) helpers cho state machine tinh bac tu dong ──
function _ymAdd_(ym, delta) {
  var parts = String(ym).split('-');
  var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1;
  m += delta; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1);
}
function _ymMonthsBetween_(fromYm, toYm) {
  var out = [], cur = fromYm, guard = 0;
  while (true) {
    out.push(cur);
    if (cur === toYm || guard++ > 240) break; // guard 20 nam, tranh vong lap vo han neu cau hinh loi
    cur = _ymAdd_(cur, 1);
  }
  return out;
}
function _ymFirstDay_(ym) { return ym + '-01'; }
function _ymLastDay_(ym) {
  var parts = ym.split('-'), y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  var last = new Date(y, m, 0).getDate();
  return ym + '-' + (last < 10 ? '0' : '') + last;
}
function _todayYm_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM');
}

// Doanh thu THEO TUNG THANG cho moi Sale, tu buildSalesReportB_ (POS/"dữ liệu đơn", dung nguon
// voi Bao cao B/E) — can de chay state machine tang/giam bac (xem _computeSaleTierTimeline_).
// Cache 5 phut qua _cachePutBig_/_cacheGetBig_ (ho tro payload lon, khac CacheService.put thuong
// bi am tham bo qua khi vuot ~100KB) — danh sach thang it doi trong ngay nen cache ngan la du,
// tranh phai quet lai sheet don cho moi lan bam Loc/doi bo loc trong Bao cao F.
function _computeSaleMonthlyRevenue_(months) {
  var cKey = 'saleMonthlyRev_v2_' + months[0] + '_' + months[months.length - 1];
  try { var cached = _cacheGetBig_(cKey); if (cached) return JSON.parse(cached); } catch (e) {}
  var out = {};
  months.forEach(function(ym) {
    var res = buildSalesReportB_({ dateFrom: _ymFirstDay_(ym), dateTo: _ymLastDay_(ym) });
    (res.bySale || []).forEach(function(s) {
      if (!out[s.name]) out[s.name] = {};
      out[s.name][ym] = s.giaTri;
    });
  });
  try { _cachePutBig_(cKey, JSON.stringify(out), 300); } catch (e) {}
  return out;
}

// State machine tinh bac tung thang cho 1 Sale, bat dau tu startTier o thang dau tien cua mang
// months (= trackingStartMonth). Quy tac (theo sheet "Bậc" + xac nhan Duyen 2026-10-01, va xac
// nhan rieng ve "Riêng Bậc 2" ngay 2026-10-04):
//  - Bac thu viec (probation): CHI giu dung 1 thang. Thang ke tiep tu dong ky chinh thuc:
//      + TVF1 -> F1 (binh thuong, khong co dieu kien gi them).
//      + TVF2 -> F2 (vao thang chinh thuc DAU TIEN), NHUNG rieng truong hop nay phai qua them
//        1 lan kiem tra rieng ("Riêng Bậc 2"): DUNG 2 THANG DAU TIEN lam F2 phai MOI THANG rieng
//        deu dat >=100% KPI cua F2 — khong dat (du chi 1 trong 2 thang) thi HA NGAY xuong F1 o
//        thang thu 3 de "chay lai" tu dau theo quy tac thuong (khong cho o lai F2 cho het 3 thang
//        nhu quy tac tang/giam binh thuong). Neu qua duoc 2 thang nay, tu thang thu 3 tro di xet
//        theo dung quy tac 3-thang binh thuong nhu moi bac khac.
//  - Bac 'O' (track OFLAT): khong bao gio doi, giu nguyen KPI mai mai.
//  - Bac chinh thuc (F1-F3, O1-O3) O NGOAI giai doan kiem tra rieng 2 thang dau cua F2 noi tren:
//    moi thang, neu 3 thang LIEN TIEP NGAY TRUOC do CUNG o dung 1 bac nay (tranh xet nua voi
//    trong luc dang doi bac):
//      + TB doanh thu 3 thang do >= 125% KPI bac hien tai VA KHONG thang nao < 70% KPI bac hien
//        tai => TANG 1 bac (toi da bac 3 trong track, F3/O3 khong tang them).
//      + TB doanh thu 3 thang do < 80% KPI bac hien tai => GIAM 1 bac (toi thieu bac 1, F1/O1
//        khong giam them).
//      + Nguoc lai: giu nguyen bac.
function _computeSaleTierTimeline_(startTier, months, monthlyRevenue, tierTargets) {
  var timeline = {};
  for (var i = 0; i < months.length; i++) {
    var ym = months[i];
    if (i === 0) { timeline[ym] = startTier; continue; }
    var prevYm = months[i - 1], prevTier = timeline[prevYm], meta = SALE_TIER_META_[prevTier];
    if (!meta) { timeline[ym] = prevTier; continue; }
    if (meta.probation) { timeline[ym] = (prevTier === 'TVF2') ? 'F2' : 'F1'; continue; }
    if (meta.track === 'OFLAT') { timeline[ym] = prevTier; continue; }
    // "Riêng Bậc 2": dung luc dang o thang thu 3 lam F2 ke tu khi ky chinh thuc tu TVF2 (2 thang
    // truoc la TVF2 -> F2, van con F2 den gio) — kiem tra RIENG 2 thang do thay vi quy tac 3-thang
    // thuong. Dat dieu kien nay TRUOC quy tac 3-thang chung de khong bi dung nham (thang i-3 la
    // TVF2 chu khong phai F2 nen quy tac 3-thang thuong cung khong khop o day, nhung ghi ro cho de doc).
    if (prevTier === 'F2' && i >= 3 && timeline[months[i - 3]] === 'TVF2' && timeline[months[i - 2]] === 'F2') {
      var kpiF2 = tierTargets['F2'] || 0;
      var rm2 = monthlyRevenue[months[i - 2]] || 0, rm1 = monthlyRevenue[prevYm] || 0;
      var passed2mo = kpiF2 > 0 && rm2 >= kpiF2 && rm1 >= kpiF2; // CA 2 thang deu phai rieng >=100%
      timeline[ym] = passed2mo ? 'F2' : 'F1';
      continue;
    }
    if (i >= 3 && timeline[months[i - 3]] === prevTier && timeline[months[i - 2]] === prevTier) {
      var kpi = tierTargets[prevTier] || 0;
      var r1 = monthlyRevenue[months[i - 3]] || 0, r2 = monthlyRevenue[months[i - 2]] || 0, r3 = monthlyRevenue[prevYm] || 0;
      var avg3 = (r1 + r2 + r3) / 3, min3 = Math.min(r1, r2, r3);
      if (kpi > 0 && avg3 >= kpi * 1.25 && min3 >= kpi * 0.70 && meta.level < 3) { timeline[ym] = meta.track + (meta.level + 1); continue; }
      if (kpi > 0 && avg3 < kpi * 0.80 && meta.level > 1) { timeline[ym] = meta.track + (meta.level - 1); continue; }
    }
    timeline[ym] = prevTier;
  }
  return timeline;
}

function buildSaleKpiReport_(filters) {
  var a = buildSalesReportB_(filters);
  var cfg = readSaleKpiConfig_();

  var todayYm = _todayYm_();
  var startYm = cfg.trackingStartMonth || '2026-09';
  var months = (startYm <= todayYm) ? _ymMonthsBetween_(startYm, todayYm) : [startYm];
  var monthlyRevByName = _computeSaleMonthlyRevenue_(months);

  // Nhom chung (Online/Van phong/CSKH/Quay...) — CHI dung de LOC/hien thi trong bao cao nay, khac
  // hoan toan voi F-track/O-track cua he thong bac tu dong (van la nguon tinh KPI DUY NHAT, khong
  // dong vao nhau). Doc tu cung 1 nguon voi "🏷️ Phân loại đội Sale" o Quan ly Team.
  var channels = {};
  try { var rawCh = getSetting_('saleChannels'); if (rawCh) { var oCh = JSON.parse(rawCh); if (oCh && typeof oCh === 'object') channels = oCh; } } catch (eCh) {}
  var groupDefs = readSaleGroups_();

  var rowsMap = {};
  function ensureRow(name) {
    if (!rowsMap[name]) {
      var nhomKey = channels[name] || '';
      rowsMap[name] = { name: name, nhomKey: nhomKey, revenue: 0, orders: 0 };
    }
    return rowsMap[name];
  }
  (a.bySale || []).forEach(function(s) {
    var r = ensureRow(s.name);
    r.revenue += s.giaTri; r.orders += s.orders;
  });
  // Them ca Sale DA duoc gan Bac bat dau / dat KPI rieng / da phan loai doi nhung CHUA co doanh
  // thu trong ky dang xem (0d) — de van thay duoc muc tieu/0% thay vi bien mat khoi bao cao.
  Object.keys(cfg.startTier).forEach(function(name) { ensureRow(name); });
  Object.keys(cfg.overrides).forEach(function(name) { ensureRow(name); });
  Object.keys(channels).forEach(function(name) { if (channels[name]) ensureRow(name); });

  // Thang nao trong "months" thuc su nam trong ky dang xem (filters.dateFrom/dateTo) — de cong
  // dung KPI muc tieu cua DUNG CAC THANG duoc xem, ke ca khi ky xem trai dai nhieu thang.
  var rangeFrom = filters.dateFrom || _ymFirstDay_(months[0]);
  var rangeTo = filters.dateTo || _ymLastDay_(months[months.length - 1]);
  var monthsInRange = months.filter(function(ym) { return _ymLastDay_(ym) >= rangeFrom && _ymFirstDay_(ym) <= rangeTo; });
  if (!monthsInRange.length) monthsInRange = [months[months.length - 1]]; // ky loc nam ngoai pham vi theo doi -> tam lay thang gan nhat de van co so hien thi

  var rows = Object.keys(rowsMap).map(function(name) {
    var r = rowsMap[name];
    var target = null, source = 'no-tier', tierNow = '', timeline = null;
    if (cfg.startTier[name]) {
      timeline = _computeSaleTierTimeline_(cfg.startTier[name], months, monthlyRevByName[name] || {}, cfg.tierTargets);
      tierNow = timeline[monthsInRange[monthsInRange.length - 1]] || cfg.startTier[name];
      target = monthsInRange.reduce(function(sum, ym) { return sum + (cfg.tierTargets[timeline[ym] || cfg.startTier[name]] || 0); }, 0);
      source = 'tier-auto';
    }
    // "Commit rieng" (cfg.overrides) tu 2026-10-04 la MUC TIEU SONG SONG voi KPI theo bac (xem
    // ghi chu dau ham buildSaleKpiReport_) — KHONG con gan vao 'target'/'source' nhu truoc, ma
    // tra ve rieng o 'commit'/'pctCommit' de client ve them 2 cot canh KPI theo bac, giong het
    // cap "Commit/%HT Commit" trong file Excel "Theo doi doanh thu".
    var commit = null;
    if (cfg.overrides[name] !== undefined && cfg.overrides[name] !== null && cfg.overrides[name] !== '') {
      commit = Number(cfg.overrides[name]) || 0;
    }
    var meta = tierNow ? SALE_TIER_META_[tierNow] : null;
    var nhom = meta ? (meta.track === 'F' ? 'Văn phòng' : 'Online') : '(chưa gán bậc)';
    var pct = (target && target > 0) ? Math.round(r.revenue / target * 1000) / 10 : null;
    var pctCommit = (commit && commit > 0) ? Math.round(r.revenue / commit * 1000) / 10 : null;
    return { name: name, nhom: nhom, tier: tierNow, revenue: r.revenue, orders: r.orders,
      target: target, source: source, pct: pct, passed: (pct !== null) ? pct >= 100 : null,
      commit: commit, pctCommit: pctCommit, passedCommit: (pctCommit !== null) ? pctCommit >= 100 : null,
      timeline: timeline,
      // Doi chung (Online/Van phong/CSKH/Quay...) — rieng cho LOC/hien thi, khong dinh gi den
      // target/tier/commit phia tren. nhomChung = '' neu chua phan loai o "🏷️ Phân loại đội Sale".
      nhomChungKey: r.nhomKey, nhomChung: r.nhomKey ? (_saleGroupLabel_(r.nhomKey, groupDefs) || r.nhomKey) : '' };
  });
  // Xep theo % THUC DAT tren KPI, TU TREN XUONG DUOI (cao nhat len dau) — theo yeu cau Duyen
  // 2026-10 ("tinh ty le thuc dat tren KPI... xep tu tren xuong duoi"), thay cho kieu xep theo
  // nhom/bac truoc day. Ai chua co bac/muc tieu (pct = null) xep xuong cuoi (theo doanh thu),
  // khong lam xao tron thu hang nhung nguoi da co % that su.
  rows.sort(function(x, y) {
    if (x.pct === null && y.pct === null) return y.revenue - x.revenue;
    if (x.pct === null) return 1;
    if (y.pct === null) return -1;
    return y.pct - x.pct;
  });

  var totalRevenue = rows.reduce(function(s, r) { return s + r.revenue; }, 0);
  var totalTarget = rows.reduce(function(s, r) { return s + (r.target || 0); }, 0);
  var totalCommit = rows.reduce(function(s, r) { return s + (r.commit || 0); }, 0);
  return { ok: true, rows: rows, config: cfg, trackedMonths: months, saleGroups: groupDefs,
    totalRevenue: totalRevenue, totalTarget: totalTarget,
    totalCommit: totalCommit, totalPctCommit: totalCommit > 0 ? Math.round(totalRevenue / totalCommit * 1000) / 10 : null,
    totalPct: totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 1000) / 10 : null,
    totalOrders: a.totalOrders, totalGiaTri: a.totalGiaTri };
}

// ── BAO CAO G: DON BI LOAI — NGUON POS (sheet "dữ liệu đơn", cung nguon voi Bao cao B/E/F) ──
// SUA 2026-10-03 (Duyen yeu cau E, F, G deu tinh theo Pos): TRUOC DAY G doc "DT TỔNG " (Base)
// qua readDTTong_ nen so don bi loai KHONG khop voi E/F/B (da la Pos) — cung 1 don co the
// bi loai o Base nhung van tinh doanh thu o Pos hoac nguoc lai. Nay dung readDonChiTiet_ +
// cung dinh nghia trang thai bi loai (_donHasExcludedStatus_ -> cot "Trạng thái") nhung DAO
// NGUOC dieu kien cua Bao cao B: CHI lay cac dong DA BI LOAI. Bo loc giong B: Sale (cot "Thẻ",
// qua _expandSaleFilterWithPancakeAliases_), Nguon don, Marketer, San pham. "Kenh ban" cua Pos chinh la cot "Nguon don" (Duyen xac nhan 2026-10-03) nen loc/nhom theo nguonDon;
// Pos khong co "thoiGianHT" nen bo loc do (ngay luon theo "ngayTaoDon"). So don/sale: moi sale tren don
// deu tinh 1 don (khong chia deu) — muc dich xem "don bi loai thuoc ve ai", khong phai doanh thu.
function buildFailedOrderReport_(filters) {
  filters = filters || {};
  function toArr(v){ return Array.isArray(v) ? v.filter(Boolean) : (v ? [String(v).trim()] : []); }
  var saleFilterArr = _expandSaleFilterWithPancakeAliases_(toArr(filters.sale));
  var saleFilterFold = saleFilterArr.map(_normTxt_);
  var nguonFilterArr = toArr(filters.nguon);
  var marketerFilterArr = toArr(filters.marketer);
  var sanPhamTerms = _foldTermsCSV_(filters.sanPham);

  var rows = readDonChiTiet_();
  var matched = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!_donHasExcludedStatus_(row.trangThai)) continue; // CHI lay don bi loai (nguoc voi Bao cao B)
    var dt = parseVNDate_(row.ngayTaoDon);
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) continue;
    if (nguonFilterArr.length && nguonFilterArr.indexOf(row.nguonDon) === -1) continue;
    if (marketerFilterArr.length && marketerFilterArr.indexOf(row.marketer) === -1) continue;
    if (saleFilterFold.length) {
      var salesOnRow = _donSaleNamesFromThe_(row.theSale).map(_normTxt_);
      var hit = false;
      for (var si = 0; si < saleFilterFold.length; si++) { if (salesOnRow.indexOf(saleFilterFold[si]) !== -1) { hit = true; break; } }
      if (!hit) continue;
    }
    if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
    matched.push(row);
  }

  var totalCod = 0, totalGiaTri = 0;
  var bySale = {}, byNguon = {}, byMkt = {}, byLyDo = {};
  var UNASSIGNED = '(chưa gán sale)', UNASSIGNED_MKT = '(chưa gán MKT)';
  function add_(obj, key, m) {
    if (!obj[key]) obj[key] = { orders: 0, cod: 0, giaTri: 0 };
    obj[key].orders += 1; obj[key].cod += m.cod; obj[key].giaTri += m.giaTriSauGiam;
  }
  for (var j = 0; j < matched.length; j++) {
    var m = matched[j];
    totalCod += m.cod; totalGiaTri += m.giaTriSauGiam;
    add_(byNguon, m.nguonDon || '(chưa có nguồn)', m);
    add_(byMkt, m.marketer || UNASSIGNED_MKT, m);
    add_(byLyDo, String(m.trangThai || '(không ghi rõ)').trim() || '(không ghi rõ)', m);
    var salesList = _donSaleNamesFromThe_(m.theSale);
    if (salesList.length === 0) salesList = [UNASSIGNED];
    for (var k = 0; k < salesList.length; k++) add_(bySale, salesList[k], m);
  }
  function toArrG(obj) {
    var arr = [];
    for (var key in obj) arr.push({ name: key, orders: obj[key].orders, cod: obj[key].cod, giaTri: obj[key].giaTri });
    arr.sort(function(a, b){ return b.orders - a.orders; });
    return arr;
  }
  return {
    totalOrders: matched.length, totalCod: totalCod, totalGiaTri: totalGiaTri,
    bySale: toArrG(bySale).filter(function(x){ return x.name !== UNASSIGNED; }), byNguon: toArrG(byNguon), byMkt: toArrG(byMkt), byLyDo: toArrG(byLyDo),
    orders: matched.map(function(m){
      return { ngayTao: m.ngayTaoDon, nguonDon: m.nguonDon, marketer: m.marketer,
        saleBan: _donSaleNamesFromThe_(m.theSale).join(', '), sanPham: m.sanPham,
        giaTriDon: m.giaTriSauGiam, cod: m.cod, trangThai: m.trangThai };
    })
  };
}

// ── BAO CAO B: theo "dữ liệu đơn" (bao gom bao cao san pham) ──
// filters: { dateFrom, dateTo, nguon, marketer }
// ═══════════════════════════════════════════════════════════════
//  GHEP DON POS <-> BASE THEO "MA BO DEM" (yeu cau Duyen 2026-10-04)
//  Don Pos co ghi chu (cot Q "dữ liệu đơn") dang "980T09 + 16QT09/2026", "Ghép cùng đơn / Bh395T09/2026 /
//  835T09/2026"... = don Pos nay GOP nhieu don goc ben Base. Khi do KHONG chia doanh thu theo Pos
//  (chia deu cot "Thẻ") nua, ma tinh theo DON GOC ben Base: tong doanh thu don Pos = tong doanh thu
//  cac don goc khop tren "DT TỔNG ", va nguoi tham gia/sale chia theo dung sale cua tung don goc.
// ═══════════════════════════════════════════════════════════════

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
    bySaleDay: filters.withDaily ? bySaleDay : undefined,
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

// ═══════════════════════════════════════════════════════════════
//  SO LIEU CA NHAN CUA 1 CS cho Pancake AI (action 'csStats') — yeu cau Duyen 2026-10-05:
//  tong so don, doanh thu, ty le chot, hoa hong (don >=15tr / <15tr + kenh co % rieng), tong hoa hong, chuong
//  trinh thuong. DUNG CHUNG nguon so lieu voi CRM: don + chia sale lay tu buildSalesReportB_ (Pos, da ghep Base,
//  da tinh 30/70), ty le chot tu saleCloseRate cua B; hoa hong/thuong la BAN PORT CUA _computeCommissionData_ /
//  _computeBonusData_ trong index.html (CRM) — NEU SUA QUY TAC HOA HONG/THUONG O CRM THI PHAI SUA CA O DAY.
// ═══════════════════════════════════════════════════════════════
var CS_COMMISSION_THRESHOLD_ = 15000000; // phai khop COMMISSION_THRESHOLD o index.html

function _csJsonSetting_(key, fallback) {
  try { var raw = getSetting_(key); if (!raw) return fallback; var v = JSON.parse(raw); return (v === null || v === undefined) ? fallback : v; }
  catch (e) { return fallback; }
}
function _csYmdFromDmy_(s) {
  var m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}
function _csDaysSinceStart_(startYmd, dateYmd) {
  var s = String(startYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/), d = String(dateYmd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!s || !d) return null;
  return Math.round((Date.UTC(+d[1], +d[2] - 1, +d[3]) - Date.UTC(+s[1], +s[2] - 1, +s[3])) / 86400000) + 1;
}
function _csBonusProductQty_(sanPham, keywordsStr) {
  var text = String(sanPham || '').toLowerCase();
  var kws = String(keywordsStr || '').split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
  if (!kws.length || !text) return { matched: false, qty: 0 };
  var totalQty = 0, matched = false;
  kws.forEach(function(kw) {
    var idx = 0;
    while (true) {
      var pos = text.indexOf(kw, idx);
      if (pos === -1) break;
      matched = true;
      var tail = text.substr(pos + kw.length, 10);
      var m = tail.match(/^[\s]*[x×][\s]*([0-9]+)/) || tail.match(/^[\s]*\(([0-9]+)\)/);
      totalQty += m ? (parseInt(m[1], 10) || 1) : 1;
      idx = pos + kw.length;
    }
  });
  return { matched: matched, qty: totalQty };
}
function _csBonusApplies_(p, dateStr, channel, startYmd) {
  if (p.dateFrom && dateStr && dateStr < p.dateFrom) return false;
  if (p.dateTo && dateStr && dateStr > p.dateTo) return false;
  var aud = p.audience || {};
  if (aud.online || aud.offline) {
    if (!channel) return false;
    if (channel === 'online' && !aud.online) return false;
    if (channel === 'offline' && !aud.offline) return false;
    if (channel === 'probation') return false;
  }
  if (p.probationDay && p.probationDay.enabled) {
    if (!startYmd) return false;
    var dayNum = _csDaysSinceStart_(startYmd, dateStr);
    if (dayNum === null || dayNum < 1) return false;
    var from = (p.probationDay.from !== '' && p.probationDay.from != null) ? Number(p.probationDay.from) : 1;
    var to = (p.probationDay.to !== '' && p.probationDay.to != null) ? Number(p.probationDay.to) : Infinity;
    if (dayNum < from || dayNum > to) return false;
  }
  return true;
}
// Tu khoa san pham BAT BUOC cua 1 CT thuong (port _bonusRequireKw_/_bonusRequireProductOk_ o index.html — sua 1 noi phai sua ca 2).
// CT "Bill vong mix charm" luu truoc khi co field requireProduct van chi tinh don co san pham "vòng" (yeu cau Duyen 2026-10-07).
function _csRequireProductOk_(p, sanPham) {
  var kw = (p.requireProduct !== undefined && p.requireProduct !== null) ? String(p.requireProduct).trim()
    : (/vòng/i.test(String(p.name || '').normalize('NFC')) ? 'vòng' : '');
  var kws = kw.split(',').map(function(x) { return x.trim().toLowerCase(); }).filter(Boolean);
  if (!kws.length) return true;
  var text = String(sanPham || '').normalize('NFC').toLowerCase();
  return kws.some(function(k) { return text.indexOf(k.normalize('NFC')) !== -1; });
}
function _csMoney_(n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
// Mo ta ngan 1 chuong trinh thuong de hien cho CS (khong tu cham — chi doc cac dieu kien co cau truc)
function _csBonusSummary_(p) {
  var parts = [];
  if (p.tier && p.tier.enabled && (p.tier.rows || []).length) {
    parts.push('Số đơn/ngày: ' + p.tier.rows.slice().sort(function(a, b) { return Number(a.count) - Number(b.count); })
      .map(function(t) { return '≥' + t.count + ' đơn = ' + _csMoney_(t.bonus); }).join('; '));
  }
  if (p.revenue && p.revenue.enabled) {
    var lo = (p.revenue.min !== '' && p.revenue.min != null) ? 'từ ' + _csMoney_(p.revenue.min) : '';
    var hi = (p.revenue.max !== '' && p.revenue.max != null) ? ' đến ' + _csMoney_(p.revenue.max) : '';
    parts.push((p.revenue.scope === 'day' ? 'Doanh số ngày ' : 'Giá trị 1 đơn ') + (lo + hi).trim() + ' = ' + _csMoney_(p.bonusAmount));
  }
  if (p.product && String(p.product).trim()) parts.push('SP "' + String(p.product).trim() + '" = ' + _csMoney_(p.bonusAmount) + '/SP');
  if (p.firstOrder && p.firstOrder.enabled) parts.push('Đơn đầu tiên trong ngày = ' + _csMoney_(p.firstOrder.amount));
  return parts.join(' · ');
}

// ═══════════ BONUS CORE (BẢN SAO NGUYÊN VĂN của js/27-fn-bonuscore.js — sửa 1 nơi PHẢI sửa cả 2 nơi) ═══════════
// GAS: map/ovr KHÔNG lấy từ localStorage — buildCsStats_ đọc Settings 'bonusProductMap' / 'bonusOrderOvr' rồi truyền vào _bcOrderInfo_(o, map, ovr).
var BONUS_PRODUCT_MAP = {}, BONUS_ORDER_OVR = {};
function _bcFold_(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase().replace(/\s+/g,' ').trim(); }
// Mã bộ đếm sạch từ dòng đầu ghi chú Pos (vd "17T10/2026") — rỗng nếu không phải dạng đơn gốc.
function _bcCounterOf_(ghiChu){
  var first = String(ghiChu == null ? '' : ghiChu).split(/[\r\n]/)[0].trim();
  var m = /^([A-Za-z]{0,3}\d{1,6}[A-Za-z]{0,3}T\d{1,2}\/\d{2,4})$/.exec(first);
  return m ? m[1].replace(/\s+/g,'').toUpperCase() : '';
}
// Đoán loại dòng khi CHƯA có trong map. Trả {cls:'vong'|'charm'|'skip'|'gift'|'prod'}.
function _bcGuess_(code, name){
  var c = _bcFold_(code), n = _bcFold_(name), t = n + ' ' + c;
  if (/bi vang|(^|[-\s])bv($|[-\s])|cv10k-bv/.test(t)) return 'skip';
  if (/^qua |^qhts|^la bo de|^la-bd|^cb-|combo|qua tang|hop qua|bao hanh|chi phi/.test(t)) return 'gift';
  if (/^(vong tay|vong ngoc|hat( |$))|^hd-|^hdd|^vt|vtnl/.test(n || c) || (!n && /^(hd|vt)/.test(c))) return 'vong';
  if (/^day thep|^dich vu|^nguyen vat lieu|^ttv |^them tien|^ship|^phi |^pkd/.test(n || c) || (!n && /^(dtcd|ttv|nvl-|pkd)/.test(c))) return 'skip';
  if (/cuon |ngu dieu/.test(t)) return 'vong';
  if (/^charm|^c[a-z]{1,4}-/.test(n === '' ? c : n)) return 'charm';
  return 'prod';
}
function _bcLineCls_(code, name, map){
  var e = map && map[String(code||'').toLowerCase()];
  if (e){
    if (e.skip) return {cls:'skip', auto:false};
    if (e.gift) return {cls:'gift', auto:false};
    if (e.vong) return {cls:'vong', auto:false};
    if (e.charm) return {cls:'charm', auto:false};
    return {cls:'prod', auto:false};
  }
  return {cls:_bcGuess_(code, name), auto:true};
}
// Tách dòng sản phẩm của 1 đơn Pos: mã ';' ghép vị trí với SL ',' (tên ',' chỉ dùng khi số tên = số mã).
function _bcOrderLines_(o){
  var codes = String(o.maSanPham||'').split(';').map(function(x){ return x.trim(); });
  var qtys = String(o.soLuong||'').split(',').map(function(x){ return x.trim(); });
  var names = String(o.sanPham||'').split(',').map(function(x){ return x.trim(); });
  var aligned = names.length === codes.length;
  var out = [];
  codes.forEach(function(c, i){
    if (!c) return;
    var q = Number(String(qtys[i]||'1').replace(',', '.'));
    if (!isFinite(q) || q <= 0) q = 1;
    if (q > 50) q = 1;   // dữ liệu lệch cột (vd "2001") → coi là 1, đơn nằm trong danh sách "cần kiểm tra"
    out.push({ code:c, name: aligned ? names[i] : '', qty:q, qtyOdd: Number(String(qtys[i]||'1').replace(',', '.')) > 50 });
  });
  return out;
}
// Thông tin đếm của 1 đơn. map/ovr mặc định lấy từ biến toàn cục.
function _bcOrderInfo_(o, map, ovr){
  map = map || BONUS_PRODUCT_MAP; ovr = ovr || BONUS_ORDER_OVR;
  var counter = _bcCounterOf_(o.ghiChu);
  var total = Number(o.giaTriDon != null ? o.giaTriDon : o.giaTriSauGiam) || 0;
  var lines = _bcOrderLines_(o), reasons = [];
  lines.forEach(function(l){
    var k = (counter ? counter + '|' : '') + l.code.toLowerCase();
    var ov = (counter && ovr && ovr[k]) || {};
    var cl = _bcLineCls_(l.code, l.name, map);
    l.cls = cl.cls; l.auto = cl.auto; l.slot = ov.slot || '';
    if (l.slot === 'skip') l.cls = 'skip'; else if (l.slot === 'gift') l.cls = 'gift';
    l.rev = (ov.rev !== undefined && ov.rev !== '' && ov.rev !== null) ? Number(ov.rev) : null;
  });
  var hasVong = lines.some(function(l){ return l.cls === 'vong'; });
  lines.forEach(function(l){ if (l.cls === 'charm' && !hasVong) l.cls = 'prod'; });   // charm đứng riêng = sản phẩm riêng
  var vongLines = lines.filter(function(l){ return l.cls === 'vong' || l.cls === 'charm'; });
  var prodLines = lines.filter(function(l){ return l.cls === 'prod'; });
  var slots = {}, nProd = 0;
  prodLines.forEach(function(l){
    if (/^[0-9]+$/.test(String(l.slot||''))){ if (!slots[l.slot]){ slots[l.slot] = true; nProd += 1; } }
    else nProd += l.qty;
  });
  var nProducts = (hasVong ? 1 : 0) + nProd;
  var vongRev = null;
  if (hasVong){
    if (!prodLines.length) vongRev = total;
    else if (prodLines.every(function(l){ return l.rev !== null; })) vongRev = total - prodLines.reduce(function(s,l){ return s + l.rev; }, 0);
    else if (total >= 15000000) reasons.push('Đơn vòng ≥15tr có sản phẩm khác — nhập doanh thu từng dòng ở tab "Chi tiết thưởng" để tính mốc 15tr phần vòng + charm mix.');
  }
  var unconfirmed = lines.filter(function(l){ return l.auto; }).length;   // số dòng còn ĐOÁN TỰ ĐỘNG (chưa lưu trong BONUS_PRODUCT_MAP) — chỉ để hiển thị ở tab, không chặn tính thưởng
  if (lines.some(function(l){ return l.qtyOdd; })) reasons.push('Số lượng bất thường (lệch cột) — kiểm tra lại.');
  if (!lines.length) reasons.push('Đơn không có mã sản phẩm.');
  return { counter:counter, total:total, lines:lines, hasVong:hasVong, nProducts:nProducts, vongRev:vongRev, needReview:reasons.length>0, reasons:reasons, unconfirmed:unconfirmed };
}
// Số sản phẩm tối thiểu của CT "Đơn từ Xtr (combo N sản phẩm)" — field p.minProducts, thiếu thì đọc từ TÊN CT.
function _bcMinProducts_(p){
  if (p.minProducts !== undefined && p.minProducts !== null && p.minProducts !== '') return Number(p.minProducts) || 0;
  var m = /combo\s*(\d+)\s*s[aả]n\s*ph[aẩ]m/i.exec(String(p.name||'').normalize('NFC'));
  return m ? Number(m[1]) : 0;
}
// CT "Bill vòng mix charm": tính trên PHẦN VÒNG + CHARM MIX (không phải cả đơn).
function _bcIsVongProgram_(p){
  if (p.vongScope !== undefined && p.vongScope !== null) return !!p.vongScope;
  return /v[oò]ng\s*mix\s*charm/i.test(String(p.name||'').normalize('NFC'));
}
// CT "Tourmaline cao cấp": đơn phải CÓ nhẫn Tourmaline (Duyên 2026-10-10). Field p.requireProduct (nếu đã đặt) thắng.
function _bcRequireKw_(p){
  if (p.requireProduct !== undefined && p.requireProduct !== null) return String(p.requireProduct).trim();
  var nm = String(p.name||'').normalize('NFC');
  if (/tourmaline cao cấp/i.test(nm)) return 'nhẫn tour';
  return /vòng/i.test(nm) ? 'vòng' : '';
}
// ═══════════ HẾT BONUS CORE ═══════════

function buildCsStats_(cs, dateFrom, dateTo) {
  cs = String(cs || '').trim();
  if (!cs) return { ok: false, error: 'Thiếu tên CS.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom || '') || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo || '')) return { ok: false, error: 'Khoảng ngày không hợp lệ (cần dạng YYYY-MM-DD).' };
  if (dateFrom > dateTo) return { ok: false, error: 'Ngày bắt đầu phải trước ngày kết thúc.' };

  // 1) Tên của CS này: tên đang chọn + các tên/bí danh khai báo ở tài khoản (Users.names)
  // NGUYÊN NHÂN GỐC (đã sửa): ô "CS đang dùng" của Pancake AI lấy USERNAME đăng nhập (vd 'yennth' — xem
  // handleGetCsNames: u.username || u.name), còn đơn/Base ghi theo TÊN SALE (vd 'yenNTH2004' trong Users.names).
  // Trước đây chỉ so cs với names + name, KHÔNG so với username → không tìm ra tài khoản → names chỉ còn ['yennth']
  // → 0 đơn và không đọc được % hoa hồng/kênh/team ("Nguồn %: Chưa cài"). Nay so cả username.
  var names = [cs], user = null;
  try {
    readUsers_(getCrmSS_().getSheetByName(SH_USER)).forEach(function(u) {
      var all = (u.names || []).concat([u.name, u.username]);
      if (all.some(function(x) { return x && _normTxt_(x) === _normTxt_(cs); })) {
        user = user || u;
        all.forEach(function(x) { if (x && names.indexOf(x) === -1) names.push(x); });
      }
    });
  } catch (eU) {}
  var myFold = {};
  _expandSaleFilterWithPancakeAliases_(names).forEach(function(n) { myFold[_normTxt_(n)] = true; });
  function pick(map) { // lay gia tri cua ten dau tien co trong map (INDIVIDUAL_RATES/SALE_CHANNELS khoa theo ten Sale)
    if (!map || typeof map !== 'object') return undefined;
    for (var i = 0; i < names.length; i++) if (Object.prototype.hasOwnProperty.call(map, names[i])) return map[names[i]];
    return undefined;
  }

  // 2) Don cua CS trong ky (Pos da ghep Base, da chia sale/30-70) — cung bo loc voi Bao cao B/E
  var rep = buildSalesReportB_({ dateFrom: dateFrom, dateTo: dateTo, sale: names });

  // 3) Cau hinh hoa hong / thuong (admin cai o CRM)
  var indiv = pick(_csJsonSetting_('individualRates', {})) || {};
  var channel = pick(_csJsonSetting_('saleChannels', {})) || '';
  var chRates = _csJsonSetting_('channelCommissionRates', {});
  var programs = _csJsonSetting_('bonusPrograms', []); if (!Array.isArray(programs)) programs = [];
  var prodMap = _csJsonSetting_('bonusProductMap', {}), orderOvr = _csJsonSetting_('bonusOrderOvr', {}); // dem san pham / vong chuoi / charm mix (tab "Chi tiet thuong")
  var hasGocField = (rep.orders || []).some(function(x) { return !!x.baseNgayTao; }); // backend cu/khong ghep Base -> giu cach cu
  var teamRate = null, teamName = '';
  try {
    readTeams_(getCrmSS_().getSheetByName(SH_TEAM)).forEach(function(t) {
      if (teamRate) return;
      var inTeam = names.some(function(n) { return t.leader === n || (t.members || []).indexOf(n) !== -1; });
      if (inTeam) { teamRate = t.ratePct || { above15: 0, below15: 0 }; teamName = t.name; }
    });
  } catch (eT) {}
  var hasA = indiv.above15 !== undefined && indiv.above15 !== null && indiv.above15 !== '';
  var hasB = indiv.below15 !== undefined && indiv.below15 !== null && indiv.below15 !== '';
  var teamA = teamRate && Number(teamRate.above15) > 0, teamB = teamRate && Number(teamRate.below15) > 0;
  var def = channel === 'online' ? { a: 1.5, b: 1, label: 'Mặc định Online' } : channel === 'offline' ? { a: 1, b: 0.8, label: 'Mặc định Offline' } : null;
  function src(has, teamHas) { return has ? 'Cá nhân' : (teamHas ? 'Team ' + teamName : (def ? def.label : 'Chưa cài')); }
  var rateA = hasA ? Number(indiv.above15) : (teamA ? Number(teamRate.above15) : (def ? def.a : 0));
  var rateB = hasB ? Number(indiv.below15) : (teamB ? Number(teamRate.below15) : (def ? def.b : 0));
  function channelRate(kenh) { // % rieng cua nguon don (vd facebook = 1%) — bo qua nguong 15tr
    var k = String(kenh || '').trim().toLowerCase();
    if (!k) return null;
    if (k === 'facebook' && !Object.prototype.hasOwnProperty.call(chRates, k)) return 1;
    if (!Object.prototype.hasOwnProperty.call(chRates, k)) return null;
    var v = chRates[k];
    return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
  }

  // 4) Duyet don: so don, doanh thu (phan cua toi), hoa hong
  var T = CS_COMMISSION_THRESHOLD_;
  var totalOrders = 0, revenue = 0;
  var ordA = 0, ordB = 0, revA = 0, revB = 0, ordCh = 0, revCh = 0, commCh = 0, chBreak = {};
  var mine = []; // don cua toi (de cham thuong)
  (rep.orders || []).forEach(function(o) {
    var giaTri = Number(o.giaTriSauGiam) || 0, frac = 0;
    if (o.saleShares && o.saleShares.length) {
      o.saleShares.forEach(function(x) { if (myFold[_normTxt_(x.name)]) frac += Number(x.frac) || 0; });
    } else {
      var ns = String(o.saleBanValid || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean);
      if (ns.length) { var c = 0; ns.forEach(function(x) { if (myFold[_normTxt_(x)]) c++; }); frac = c / ns.length; }
    }
    if (!(frac > 0)) return;
    var share = giaTri * frac * (Number(o.saleRatio) || 1);
    totalOrders++; revenue += share;
    // THUONG THEO DON: don dat quy tac thi TIEN THUONG CHIA DEU cho cac sale tham gia (yeu cau Duyen 2026-10-08; thay cho
    // quy tac "chi nguoi tao" 2026-10-07). nSales = so sale tren don; moi nguoi nhan best.amount / nSales.
    var nSales = (o.saleShares && o.saleShares.length) ? o.saleShares.length
      : (String(o.saleBanValid || '').split(',').map(function(x) { return x.trim(); }).filter(Boolean).length || 1);
    var bInfo = _bcOrderInfo_(Object.assign({}, o, { giaTriDon: giaTri }), prodMap, orderOvr);
    mine.push({ date: o.baseNgayTao || _csYmdFromDmy_(o.ngayTaoDon), time: (String(o.ngayTaoDon || '').match(/(\d{1,2}):(\d{2})/) || [''])[0], giaTri: giaTri, share: share, nSales: nSales, sanPham: o.sanPham,
      goc: !hasGocField || !!o.donGoc, info: bInfo });
    var chR = channelRate(o.nguonDon);
    if (chR !== null) {
      ordCh++; revCh += share; commCh += share * chR / 100;
      var kk = String(o.nguonDon || '').trim();
      if (!chBreak[kk]) chBreak[kk] = { revenue: 0, rate: chR };
      chBreak[kk].revenue += share;
    } else if (giaTri >= T) { ordA++; revA += share; }
    else { ordB++; revB += share; }
  });
  var commA = revA * rateA / 100, commB = revB * rateB / 100;

  // 5) Thuong (port _computeBonusData_ cho 1 sale)
  var startYmd = (user && user.startDate) ? String(user.startDate) : '';
  var bonusItems = [], bonusTotal = 0;
  var byDay = {};
  mine.forEach(function(o) {
    if (!byDay[o.date]) byDay[o.date] = { date: o.date, revenue: 0, count: 0, first: null };
    var g = byDay[o.date];
    if (o.goc) g.revenue += o.share; // doanh so ngay = phan DOANH THU da chia cua sale, CHI don goc (ma bo dem sach, co tren Base+Pos), theo ngay tao Base
    g.count++;
    if (o.time && (g.first === null || o.time < g.first)) g.first = o.time;
  });
  Object.keys(byDay).forEach(function(k) {
    var g = byDay[k], bestTier = null, bestRev = null, bestFirst = null;
    programs.forEach(function(p) {
      if (!_csBonusApplies_(p, g.date, channel, startYmd)) return;
      if (p.revenue && p.revenue.enabled && p.revenue.scope === 'day') {
        var mn = (p.revenue.min !== '' && p.revenue.min != null) ? Number(p.revenue.min) : null;
        var mx = (p.revenue.max !== '' && p.revenue.max != null) ? Number(p.revenue.max) : null;
        if ((mn === null || g.revenue >= mn) && (mx === null || g.revenue <= mx)) {
          var amt = Number(p.bonusAmount) || 0;
          if (amt > 0 && (!bestRev || amt > bestRev.amount)) bestRev = { amount: amt, program: p, detail: 'Doanh số ngày ' + _csMoney_(g.revenue) };
        }
      }
      if (p.tier && p.tier.enabled && (p.tier.rows || []).length && g.count > 0) {
        var hit = null;
        p.tier.rows.slice().sort(function(a, b) { return Number(a.count) - Number(b.count); }).forEach(function(t) { if (g.count >= Number(t.count)) hit = t; });
        if (hit) {
          var amt2 = Number(hit.bonus) || 0;
          if (amt2 > 0 && (!bestTier || amt2 > bestTier.amount)) bestTier = { amount: amt2, program: p, detail: 'Đạt ' + g.count + ' đơn/ngày (bậc từ ' + hit.count + ' đơn)' };
        }
      }
      if (p.firstOrder && p.firstOrder.enabled && g.count > 0) {
        var amt3 = Number(p.firstOrder.amount) || 0;
        if (amt3 > 0 && (!bestFirst || amt3 > bestFirst.amount)) bestFirst = { amount: amt3, program: p, detail: 'Đơn đầu tiên trong ngày' + (g.first ? ' (lúc ' + g.first + ')' : '') };
      }
    });
    [[bestTier, 'Theo ngày (số đơn)'], [bestRev, 'Theo ngày (doanh số)'], [bestFirst, 'Theo ngày (đơn đầu tiên)']].forEach(function(pr) {
      if (!pr[0]) return;
      bonusTotal += pr[0].amount;
      bonusItems.push({ date: g.date, scope: pr[1], program: pr[0].program.name, amount: pr[0].amount, detail: pr[0].detail });
    });
  });
  mine.forEach(function(o) {
    var best = null;
    programs.forEach(function(p) {
      if (!_csBonusApplies_(p, o.date, channel, startYmd)) return;
      if (p.product && String(p.product).trim()) {
        var pq = _csBonusProductQty_(o.sanPham, p.product);
        if (pq.matched && pq.qty > 0) {
          var amt = (Number(p.bonusAmount) || 0) * pq.qty;
          if (amt > 0 && (!best || amt > best.amount)) best = { amount: amt, program: p, detail: 'SL ước tính: ' + pq.qty + ' — SP: "' + String(o.sanPham || '') + '"' };
        }
      }
      if (p.revenue && p.revenue.enabled && p.revenue.scope === 'order') {
        var mn = (p.revenue.min !== '' && p.revenue.min != null) ? Number(p.revenue.min) : null;
        var mx = (p.revenue.max !== '' && p.revenue.max != null) ? Number(p.revenue.max) : null;
        var isVongP = _bcIsVongProgram_(p), minSP = _bcMinProducts_(p), measured = o.giaTri, dtl = 'Giá trị đơn ' + _csMoney_(o.giaTri), okP = true;
        if (isVongP) { // Bill vong mix charm: moc tinh tren PHAN VONG + CHARM MIX (port y het js/12 _computeBonusData_)
          okP = o.info.hasVong && o.info.vongRev !== null;
          measured = o.info.vongRev; dtl = 'Phần vòng + charm mix ' + _csMoney_(o.info.vongRev || 0) + ' (đơn ' + _csMoney_(o.giaTri) + ')';
        } else {
          okP = _csRequireProductOk_(p, o.sanPham);
          var rk = _bcRequireKw_(p);
          if (rk && p.requireProduct === undefined) okP = _csRequireProductOk_({ requireProduct: rk }, o.sanPham);
          if (minSP > 0) { okP = okP && o.info.nProducts >= minSP; dtl += ' — ' + o.info.nProducts + ' sản phẩm'; }
        }
        if (okP && (mn === null || measured >= mn) && (mx === null || measured <= mx)) {
          var amt2 = Number(p.bonusAmount) || 0;
          if (amt2 > 0 && (!best || amt2 > best.amount)) best = { amount: amt2, program: p, detail: dtl };
        }
      }
    });
    if (best) {
      var n = o.nSales > 1 ? o.nSales : 1, part = Math.round(best.amount / n); // chia deu cho sale tham gia
      bonusTotal += part;
      bonusItems.push({ date: o.date, scope: 'Theo đơn', program: best.program.name, amount: part, detail: best.detail + (n > 1 ? ' — thưởng ' + _csMoney_(best.amount) + ' chia đều ' + n + ' sale' : '') });
    }
  });
  bonusItems.sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });

  // Chuong trinh thuong dang ap dung cho CS trong ky (de CS biet minh dang co chuong trinh nao)
  var activePrograms = programs.filter(function(p) {
    if (p.dateFrom && p.dateFrom > dateTo) return false;
    if (p.dateTo && p.dateTo < dateFrom) return false;
    return _csBonusApplies_(p, dateFrom, channel, '') || _csBonusApplies_(p, dateTo, channel, '') || !!(p.probationDay && p.probationDay.enabled);
  }).map(function(p) { return { name: p.name || '', dateFrom: p.dateFrom || '', dateTo: p.dateTo || '', summary: _csBonusSummary_(p) }; });

  // 6) Ty le chot (tu ty le chot theo Sale cua Bao cao B: so don chot / so khach tuong tac)
  var closeRate = null;
  (rep.saleCloseRate || []).forEach(function(r) {
    if (myFold[_normTxt_(r.name)]) {
      if (!closeRate) closeRate = { held: 0, closed: 0, rate: 0 };
      closeRate.held += Number(r.held) || 0; closeRate.closed += Number(r.closed) || 0;
    }
  });
  if (closeRate) closeRate.rate = closeRate.held ? Math.round(closeRate.closed / closeRate.held * 1000) / 10 : 0;

  return {
    ok: true, cs: cs, names: names, from: dateFrom, to: dateTo,
    totalOrders: totalOrders, revenue: Math.round(revenue),
    closeRate: closeRate,
    commission: {
      threshold: T, rateAbove15: rateA, rateBelow15: rateB, sourceAbove15: src(hasA, teamA), sourceBelow15: src(hasB, teamB),
      ordersAbove15: ordA, revenueAbove15: Math.round(revA), commissionAbove15: Math.round(commA),
      ordersBelow15: ordB, revenueBelow15: Math.round(revB), commissionBelow15: Math.round(commB),
      ordersChannel: ordCh, revenueChannel: Math.round(revCh), commissionChannel: Math.round(commCh), channelBreakdown: chBreak,
      total: Math.round(commA + commB + commCh)
    },
    bonus: { total: Math.round(bonusTotal), items: bonusItems, activePrograms: activePrograms },
    ghepLoi: (rep.ghep && rep.ghep.loi) ? rep.ghep.loi : ''
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
  // Tim dung Thu Hai cua tuan chua ngay duong lich VN cua d — tinh toan hoan toan bang UTC +
  // offset co dinh (qua _vnYmdParts_), KHONG dung .getDay()/.getDate() truc tiep cua d (phu
  // thuoc cau hinh Time Zone du an, cung nguyen nhan gay bug "nhay ngay" da gap).
  var p = _vnYmdParts_(d);
  var utcRep = new Date(Date.UTC(p.y, p.mo - 1, p.d)); // chi dung de doc thu trong tuan (getUTCDay doc dung, khong phu thuoc offset)
  var dow = utcRep.getUTCDay();
  var diff = (dow === 0 ? -6 : 1) - dow;
  var mp = new Date(Date.UTC(p.y, p.mo - 1, p.d + diff));
  return _vnMidnight_(mp.getUTCFullYear(), mp.getUTCMonth() + 1, mp.getUTCDate());
}
function _isoWeekRange_(baseDate, weekOffset) {
  var mon = _getMonday_(baseDate);
  // .setDate()/.getDate() o day CHI dung de CONG/TRU so ngay (khong doc ngay duong lich) —
  // an toan du may chu cau hinh Time Zone gi, vi Viet Nam khong co gio mua he nen +7 ngay luon
  // dung dung 7*24h bat ke mui gio nen la gi.
  mon.setDate(mon.getDate() + weekOffset * 7);
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: mon, to: sun };
}
function _isoWeekKey_(d) {
  var p = _vnYmdParts_(d);
  var dt = new Date(Date.UTC(p.y, p.mo - 1, p.d));
  var dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return dt.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}
function _monthRange_(baseDate, monthOffset) {
  var p = _vnYmdParts_(baseDate);
  var y = p.y, m = (p.mo - 1) + monthOffset; // m la thang muc tieu, 0-index, truoc khi normalize nam
  var from = _vnMidnight_(y, m + 1, 1);
  var lastDayUtc = new Date(Date.UTC(y, m + 1, 0)); // ngay 0 cua thang ke tiep = ngay cuoi thang muc tieu
  var to = _vnMidnight_(lastDayUtc.getUTCFullYear(), lastDayUtc.getUTCMonth() + 1, lastDayUtc.getUTCDate());
  return { from: from, to: to };
}
function _monthKey_(d) { var p = _vnYmdParts_(d); return p.y + '-' + String(p.mo).padStart(2, '0'); }
function _quarterRange_(baseDate, quarterOffset) {
  var p = _vnYmdParts_(baseDate);
  var y = p.y, q = Math.floor((p.mo - 1) / 3) + quarterOffset;
  var yy = y + Math.floor(q / 4), qq = ((q % 4) + 4) % 4;
  var startMonth = qq * 3; // 0-index
  var from = _vnMidnight_(yy, startMonth + 1, 1);
  var lastDayUtc = new Date(Date.UTC(yy, startMonth + 3, 0));
  var to = _vnMidnight_(lastDayUtc.getUTCFullYear(), lastDayUtc.getUTCMonth() + 1, lastDayUtc.getUTCDate());
  return { from: from, to: to };
}
function _yearRange_(baseDate, yearOffset) {
  var p = _vnYmdParts_(baseDate);
  var y = p.y + yearOffset;
  return { from: _vnMidnight_(y, 1, 1), to: _vnMidnight_(y, 12, 31) };
}
function _yearKey_(d) { return String(_vnYmdParts_(d).y); }
function _quarterKey_(d) { var p = _vnYmdParts_(d); return p.y + '-Q' + (Math.floor((p.mo - 1) / 3) + 1); }
function _ymdLocal_(d) { return _vnYmd_(d); } // giu ten cu de khoi phai sua noi goi, tro thang ve ham VN chuan
function _labelVN_(d) {
  var p = _vnYmdParts_(d);
  return String(p.d).padStart(2, '0') + '/' + String(p.mo).padStart(2, '0') + '/' + p.y;
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
  } else if (periodType === 'year') {
    var yOff = Number(filters.yearOffset) || 0;
    cur = _yearRange_(today, yOff);
    prev = _yearRange_(today, yOff - 1);
    curKey = _yearKey_(cur.from); prevKey = _yearKey_(prev.from);
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
  // Giong het quy uoc "Tinh theo nguoi tao don" cua buildSalesReportA_: tich thi tinh TRON VEN
  // ket qua cho DUNG 1 nguoi (cot "Người tạo" that su cua DT TONG), bo tich thi chia deu cho
  // tat ca sale dung ten tren don (mac dinh, giu nguyen hanh vi cu).
  var byCreator = !!filters.byCreator;

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
      if (_isExcludedOrderStatus_(row.trangThai)) continue; // bo don Huy/Tra lai/Hoan tien/Thai bai/Khieu nai (Quy che thu lao Sale)
      if (kenhFilterArr.length && kenhFilterArr.indexOf(row.kenhBan) === -1) continue;
      var salesOnRow = splitMulti_(row.saleBan, ',');
      if (saleFilterArr.length && !salesOnRow.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
      if (!_pMatchAny_(row.sanPham, sanPhamTerms)) continue;
      matchedOrders.push(row);
      var kName = row.kenhBan || '(chưa có kênh)';
      byKenh[kName] = (byKenh[kName] || 0) + row.giaTriDon;
      if (byCreator) {
        var creatorName = row.nguoiTao || UNASSIGNED;
        bySale[creatorName] = (bySale[creatorName] || 0) + row.giaTriDon;
      } else {
        var salesList = splitMulti_(row.saleBan, ',');
        if (salesList.length === 0) salesList = [UNASSIGNED];
        var n = salesList.length;
        for (var k = 0; k < salesList.length; k++) {
          bySale[salesList[k]] = (bySale[salesList[k]] || 0) + row.giaTriDon / n;
        }
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
  var csFilterArr = Array.isArray(filters.cs) ? filters.cs.filter(function(s){return s;})
    : (filters.cs ? [String(filters.cs).trim()] : []);
  var rows = readCareLeads_();
  var matched = rows.filter(function(r) {
    var dt = r.createdAt ? new Date(r.createdAt) : null;
    if (!dateInRange_(dt, filters.dateFrom, filters.dateTo)) return false;
    if (csFilterArr.length && csFilterArr.indexOf(String(r.cs||'')) === -1) return false;
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
  reportType = (reportType === 'B' || reportType === 'C' || reportType === 'D' || reportType === 'G') ? reportType : 'A';
  var data = reportType === 'B' ? buildSalesReportB_(filters || {})
    : (reportType === 'C' ? buildSalesReportC_(filters || {})
    : (reportType === 'D' ? buildCareLeadReport_(filters || {})
    : (reportType === 'G' ? buildFailedOrderReport_(filters || {})
    : buildSalesReportA_(filters || {}))));
  // Bao cao Base (A): ghi vao FILE GOOGLE SHEET RIENG (EXPORT_BASE_SS_ID, dung tab theo
  // EXPORT_BASE_GID) — file nay PHAI duoc chia se (Editor) cho tai khoan dang chay Apps Script.
  // CHI 1 tab CO DINH, moi lan xuat GHI DE lai noi dung cu, KHONG tao tab moi — theo yeu cau
  // Duyen 2026-09 ("chi ra 1 trang tinh thoi, khong bi moi lan xuat lai 1 trang moi", va sau do
  // "xuat cho minh vao link nay" — doi sang file rieng thay vi file CRM).
  // Cac loai bao cao khac (B/C/D) VAN giu nguyen: ghi vao file CRM, moi lan xuat tao 1 tab moi
  // co timestamp, de giu lai lich su cac lan xuat truoc do.
  var ss, tabName, sh, fixedTab = (reportType === 'A');
  if (fixedTab) {
    try {
      ss = SpreadsheetApp.openById(EXPORT_BASE_SS_ID);
    } catch (eExt) {
      return jsonOut_({ error: 'Không mở được file Google Sheet đích (EXPORT_BASE_SS_ID) — kiểm tra lại ID/quyền chia sẻ (Editor) cho tài khoản đang chạy Apps Script. Chi tiết: ' + eExt.message });
    }
    sh = _sheetByGid_(ss, EXPORT_BASE_GID);
    if (!sh) return jsonOut_({ error: 'File đích chưa có tab nào (rỗng) — mở file, tạo ít nhất 1 tab rồi thử lại.' });
    sh.clear(); // ghi de: xoa sach noi dung/dinh dang cu truoc khi ghi lai
    tabName = sh.getName();
  } else {
    ss = getCrmSS_();
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Etc/GMT-7', 'yyyyMMdd_HHmmss');
    tabName = 'BC_' + reportType + '_' + ts;
    sh = ss.insertSheet(tabName);
  }

  // Ten bao cao (quy uoc moi): A = Base (DT tong), B = Pos (du lieu don), C = So sanh ky Base,
  // D = Sale tu them (KH Cham soc moi, data rieng khong gop A/B/C).
  var reportTitles = {
    A: 'BÁO CÁO BASE — Theo DT tổng',
    B: 'BÁO CÁO POS — Theo dữ liệu đơn',
    C: 'BÁO CÁO SO SÁNH KỲ BASE',
    D: 'BÁO CÁO SALE TỰ THÊM — KH Chăm sóc mới (data riêng, KHÔNG gộp Base/Pos)',
    E: 'BÁO CÁO HOA HỒNG NHÂN VIÊN POS',
    G: 'BÁO CÁO ĐƠN BỊ LOẠI — POS (Hủy/Đã hoàn/Đang hoàn/Hoàn tiền... đã trừ khỏi doanh số Pos)'
  };
  var rows = [];
  rows.push([reportTitles[reportType] || ('BÁO CÁO ' + reportType)]);
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
  } else if (reportType === 'G') {
    if (f.dateFrom || f.dateTo) filterDesc.push('Khoảng ngày (Ngày tạo đơn Pos): ' + (f.dateFrom || '...') + ' → ' + (f.dateTo || '...'));
    var saleArrG = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrG.length) filterDesc.push('Sale: ' + saleArrG.join(', '));
    var nguonArrG = Array.isArray(f.nguon) ? f.nguon : (f.nguon ? [f.nguon] : []);
    if (nguonArrG.length) filterDesc.push('Kênh bán (Nguồn đơn): ' + nguonArrG.join(', '));
    var mktArrG = Array.isArray(f.marketer) ? f.marketer : (f.marketer ? [f.marketer] : []);
    if (mktArrG.length) filterDesc.push('Marketer: ' + mktArrG.join(', '));
  } else {
    if (data.period) filterDesc.push('Kỳ này: ' + data.period.curLabel + ' | Kỳ trước: ' + data.period.prevLabel);
    filterDesc.push('Lọc theo: ' + (f.dateField === 'thoiGianHT' ? 'Thời gian hoàn thành' : 'Ngày tạo'));
    var saleArrC = Array.isArray(f.sale) ? f.sale : (f.sale ? [f.sale] : []);
    if (saleArrC.length) filterDesc.push('Sale: ' + saleArrC.join(', '));
    var kenhArrC = Array.isArray(f.kenh) ? f.kenh : (f.kenh ? [f.kenh] : []);
    if (kenhArrC.length) filterDesc.push('Kênh bán: ' + kenhArrC.join(', '));
    if (f.byCreator) filterDesc.push('Tính theo người tạo đơn (không chia đều theo sale)');
  }
  rows.push(['Bộ lọc', filterDesc.join(' | ') || '(không lọc)']);
  rows.push([]);

  if (reportType === 'A') {
    rows.push(['TỔNG QUAN']);
    rows.push(['Số lượng đơn', data.totalOrders]);
    rows.push(['Tổng tiền đã cọc/CK (tham khảo)', data.totalCoc]);
    rows.push(['Tổng đơn (doanh thu, ko ship)', data.totalGiaTri]);
    rows.push(['Trung bình đơn', data.trungBinhDon]);
    rows.push([]);
    rows.push(['THEO SALE BÁN', f.byCreator ? '(tính trọn vẹn cho người tạo đơn — không chia đều)' : '(số đơn giữ nguyên — tiền chia đều cho số sale/đơn)']);
    rows.push(['Sale', 'Số đơn', 'Cọc', 'Tổng đơn', 'TB đơn']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.coc, s.giaTri, s.trungBinhDon]); });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN (PAGE)']);
    rows.push(['Kênh', 'Số đơn', 'Cọc', 'Tổng đơn', 'TB đơn']);
    (data.byKenh || []).forEach(function(k) { rows.push([k.name, k.orders, k.coc, k.giaTri, k.trungBinhDon]); });
    rows.push([]);
    rows.push(['THEO MKT']);
    rows.push(['MKT', 'Số đơn', 'Cọc', 'Tổng đơn', 'TB đơn']);
    (data.byMkt || []).forEach(function(k) { rows.push([k.name, k.orders, k.coc, k.giaTri, k.trungBinhDon]); });
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
    rows.push(['THEO TEAM SALE']);
    rows.push(['Team Sale', 'Số đơn', 'Giá trị sau giảm giá', 'TB đơn', 'COD']);
    (data.byTeamSale || []).forEach(function(t) { rows.push([t.name, t.orders, t.giaTri, t.trungBinhDon, t.cod]); });
    rows.push([]);
    rows.push(['THEO NGUỒN ĐƠN']);
    rows.push(['Nguồn đơn', 'Số đơn', 'Giá trị sau giảm giá', 'TB đơn', 'COD']);
    (data.byNguon || []).forEach(function(k) { rows.push([k.name, k.orders, k.giaTri, k.trungBinhDon, k.cod]); });
    rows.push([]);
    rows.push(['THEO MKT']);
    rows.push(['MKT', 'Số đơn', 'Giá trị sau giảm giá', 'TB đơn', 'COD']);
    (data.byMkt || []).forEach(function(k) { rows.push([k.name, k.orders, k.giaTri, k.trungBinhDon, k.cod]); });
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
  } else if (reportType === 'G') {
    rows.push(['TỔNG QUAN (nguồn Pos — "dữ liệu đơn")']);
    rows.push(['Số đơn bị loại', data.totalOrders]);
    rows.push(['Tổng COD (tham khảo)', data.totalCod]);
    rows.push(['Tổng giá trị sau giảm (tham khảo — KHÔNG tính vào doanh thu)', data.totalGiaTri]);
    rows.push([]);
    rows.push(['THEO LÝ DO (trạng thái đơn)']);
    rows.push(['Trạng thái', 'Số đơn', 'COD', 'Giá trị']);
    (data.byLyDo || []).forEach(function(x) { rows.push([x.name, x.orders, x.cod, x.giaTri]); });
    rows.push([]);
    rows.push(['THEO SALE (mỗi sale trên đơn đều tính 1 đơn, không chia đều)']);
    rows.push(['Sale', 'Số đơn', 'COD', 'Giá trị']);
    (data.bySale || []).forEach(function(s) { rows.push([s.name, s.orders, s.cod, s.giaTri]); });
    rows.push([]);
    rows.push(['THEO KÊNH BÁN (Nguồn đơn)']);
    rows.push(['Kênh bán', 'Số đơn', 'COD', 'Giá trị']);
    (data.byNguon || []).forEach(function(k) { rows.push([k.name, k.orders, k.cod, k.giaTri]); });
    rows.push([]);
    rows.push(['THEO MKT (Marketer trên đơn)']);
    rows.push(['MKT', 'Số đơn', 'COD', 'Giá trị']);
    (data.byMkt || []).forEach(function(k) { rows.push([k.name, k.orders, k.cod, k.giaTri]); });
    rows.push([]);
    rows.push(['CHI TIẾT']);
    rows.push(['Ngày tạo', 'Kênh bán', 'Marketer', 'Sale', 'Sản phẩm', 'Giá trị sau giảm', 'COD', 'Trạng thái']);
    (data.orders || []).forEach(function(o) {
      rows.push([o.ngayTao, o.nguonDon, o.marketer, o.saleBan, o.sanPham, o.giaTriDon, o.cod, o.trangThai]);
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

  return { tabName: tabName, fixedTab: fixedTab, sheetId: ss.getId(), gid: sh.getSheetId(),
           sheetUrl: ss.getUrl() + '#gid=' + sh.getSheetId() };
}

function doPost(e) {
  if (!e || !e.postData) return jsonOut_({ error: 'No postData' });
  var d0 = null;
  try { d0 = JSON.parse(e.postData.contents); } catch (e0) { d0 = null; }
  if (d0 && typeof d0 === 'object') {
    if (d0.action === 'demoLogin') return demoLogin_(d0);
    if (d0.demo) return jsonOut_({ error: 'Tai khoan test chi duoc xem, khong duoc ghi du lieu.' });
    if (d0.action === 'setGasSource' && !_adminKeyOk_(d0.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de dong bo ma nguon GAS.' });
    if (d0.action === 'setSetting' && _isSensitiveWriteKey_(d0.key) && !_adminKeyOk_(d0.adminKey)) return jsonOut_({ error: 'Khong duoc ghi key nay.' });
  }
  return doPostCore_(e);
}

// ═══════════════════════════════════════════════════════════════
//  doPost
// ═══════════════════════════════════════════════════════════════
function doPostCore_(e) {
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
    // ── LUU TRU DON CU: chuyen don cu sang sheet *_LƯU TRỮ. Can adminKey; dryRun mac dinh true (xem archiveOldOrders_) ──
    if (action === 'archiveOrders') {
      if (!_adminKeyOk_(data.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) de luu tru don cu.' });
      return jsonOut_(archiveOldOrders_({ months: data.months, which: data.which, dryRun: data.dryRun !== false }));
    }
    // ── SUPABASE (buoc 2c): day CareData len Supabase theo lo (dryRun mac dinh true, resume bang con tro). Can adminKey ──
    if (action === 'sbBackfillCare') {
      if (!_adminKeyOk_(data.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(sbBackfillCare_({ dryRun: data.dryRun, reset: data.reset }));
    }
    // ── SUPABASE (buoc 3a): doi che do off/write/read; sua cac SDT dirty. Can adminKey ──
    if (action === 'sbSetMode' || action === 'sbResyncCare') {
      if (!_adminKeyOk_(data.adminKey)) return jsonOut_({ error: 'Can khoa quan tri (adminKey) cho thao tac Supabase.' });
      return jsonOut_(action === 'sbSetMode' ? sbSetMode_(data.mode, data.clearStale) : sbResyncCare_());
    }
    if (action === 'replaceOrders')       return replaceOrders_(data.orders, data);
    if (action === 'setOrderCareCS')      return setOrderCareCS_(data.phone, data.careCS);
    if (action === 'setOrderCareCSBatch') return setOrderCareCSBatch_(data.updates);
    if (action === 'saveTeams')           return saveTeams_(data.teams);
    if (action === 'saveMktTeams')        return saveMktTeams_(data.teams);
    if (action === 'saveUsers')           return saveUsers_(data.users);
    if (action === 'saveAudit')           return saveAudit_(data.rows);
    // ── Nhap du lieu Base/Pos tu file export (thay copy tay vao Google Sheet) ──
    if (action === 'importSheetRows')     return doImportSheetRows_(data.sheet, data.rows);
    // ── Bao cao Pancake ──
    if (action === 'savePancakeStats')    return savePancakeStats_(data.rows);
    if (action === 'savePancakeNameMap')  return savePancakeNameMap_(data.pancakeName, data.saleName);
    if (action === 'savePancakeSdtStats') return savePancakeSdtStats_(data.rows);
    if (action === 'savePancakeTagStats') return savePancakeTagStats_(data.rows);
    if (action === 'saveSaleDirectory')   return saveSaleDirectory_(data.rows);
    if (action === 'savePancakePageMap')  return savePancakePageMap_(data.pageId, data.pageName, data.kenhBan);
    if (action === 'setSetting')          return setSetting_(data.key, data.value);
    if (action === 'saveSaleGroups')      return saveSaleGroups_(data.groups);
    // ── Dong bo lai ma nguon gas_v13.js cho nut "Copy Apps Script Code" (xem getGasSource, doGet)
    // — chia thanh cac manh <=45.000 ky tu (o tinh Sheet gioi han 50.000), xoa manh cu thua neu
    // ban moi it manh hon ban truoc, roi ghi "gasSourceUpdatedAt" de UI hien luc dong bo gan nhat.
    if (action === 'setGasSource')        return setGasSource_(data.code);
    // Them 1 nick Zalo vao danh sach chung (MERGE tren server -> khong ghi de mat nick cu)
    if (action === 'addZaloNick')         return addZaloNick_(data.nick);
    if (action === 'saveAssign')          return saveAssignEntry_(data.entry);
    if (action === 'saveAssignHistory')   return saveAssignHistory_(data.history);
    // Pancake AI tich "Da goi xong" cho 1 SDT trong muc "Data duoc chia" — xem toggleAssignDone_.
    if (action === 'toggleAssignDone')    return toggleAssignDone_(data.csName, data.phone, !!data.done);
    if (action === 'saveTask')  return saveTaskEntry_(data.task);
    if (action === 'deleteTask') return deleteTask_(data.id);
    // ── Binh luan/thao luan trong 1 cong viec (Task) — tab "Thao luan" tren UI ──
    if (action === 'saveTaskComment') return saveTaskComment_(data.comment);
    if (action === 'saveCareStatus')      return saveCareStatus_(data.careStatus);
    if (action === 'saveAIContext')        return saveAIContext_(data.type, data.content, data.context);
    // Xac thuc tai khoan (Pancake AI doi CS) — kiem tra mat khau PHIA SERVER, khong tra passHash ve client
    if (action === 'verifyLogin')          return verifyLogin_(data.username, data.password);
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
    // ── MAU TIN NHAN TU VAN KHACH: them/sua (form tren CRM tab ZALO AI) / xoa 1 mau ──
    if (action === 'saveMessageTemplate')   return saveMessageTemplate_(data.template || data);
    if (action === 'deleteMessageTemplate') return deleteMessageTemplate_(data.id);
    if (action === 'saveCannedResponse')    return saveCannedResponse_(data.canned || data);
    if (action === 'saveAIExample')         return saveAIExample_(data.id, data.content);
    if (action === 'deleteAIExample')       return deleteAIExample_(data.id);
    if (action === 'deleteCannedResponse')  return deleteCannedResponse_(data.id);
    // ── CHECKLIST MKT: nhap tay theo ngay + muc tieu L1-L4 ──
    if (action === 'saveMktChecklistConfig')  return saveMktChecklistConfig_(data.month, data.config);
    // ── NHAT KY BAO CAO HANG NGAY (Sale/Kenh/MKT/Tag) -> Google Sheet rieng ──
    if (action === 'exportDailyReportLogs') return exportDailyReportLogs_(data.from, data.to);
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
  if (sbMode_() !== 'off') sbMarkStale_('saveAllCare_ ghi de ca sheet CareData');   // Supabase se lech dien rong -> khong doc Supabase cho den khi backfill lai
  return jsonOut_({ ok: true, written: rows.length });
}

function saveSingleCare_(r) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  var last = sh.getLastRow(); var rowIdx = -1; var rowW;
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
    mergeExtFields_(r, { khStatus: existRow[15]||'', nickZalos: existRow[16]||'[]', birthday: existRow[17]||'', zaloSetBy: existRow[18]||'', name: existRow[19]||'', zaloPhones: existRow[21]||'[]' });
    rowW = careRow_(r);
    sh.getRange(rowIdx, 1, 1, CARE_HEADERS.length).setValues([rowW]);
  } else {
    rowW = careRow_(r);
    sh.appendRow(rowW);
  }
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('customers_v12');
    cache.remove('lk_' + normPhone_(String(r.phone)));
  } catch(ec) {}
  sbMirrorCare_(sbRowsToRecs_([rowW]), 'saveSingleCare_');   // Sheets da ghi xong; mirror loi KHONG lam hong thao tac luu
  return jsonOut_({ ok: true, found: rowIdx > 0 });
}

function saveBatchCare_(rows) {
  var sh = getSheet_(SH_CARE, CARE_HEADERS);
  // LO NHO (da so voi moi lan CS sua 1-vai KH): truoc day LUON doc ca sheet roi ghi de ca sheet (hang trieu o) chi de luu vai dong.
  // Nay chi doc cot SDT, doc/ghi dung cac dong can doi, them dong moi bang 1 lan setValues. Lo lon (chia data) giu cach cu: 1 doc + 1 ghi.
  if (rows.length <= 50) {
    var Ws = CARE_HEADERS.length, lastS = sh.getLastRow(), idxS = {};
    if (lastS >= 2) {
      var colA = sh.getRange(2, 1, lastS - 1, 1).getValues();
      for (var ci = 0; ci < colA.length; ci++) { if (colA[ci][0]) idxS[normPhone_(String(colA[ci][0]))] = ci + 2; }
    }
    var exOf = function(row) { return { khStatus: row[15]||'', nickZalos: row[16]||'[]', birthday: row[17]||'', zaloSetBy: row[18]||'', name: row[19]||'', zaloPhones: row[21]||'[]' }; };
    var updS = 0, appS = 0, newRowsS = [], newIdxS = {}, mirS = [];
    for (var ks = 0; ks < rows.length; ks++) {
      var rs = rows[ks]; var keyS = normPhone_(String(rs.phone));
      if (idxS[keyS] !== undefined) {
        var exRow = sh.getRange(idxS[keyS], 1, 1, Ws).getValues()[0];
        mergeExtFields_(rs, exOf(exRow));
        var rowU = careRow_(rs); sh.getRange(idxS[keyS], 1, 1, Ws).setValues([rowU]); updS++; mirS.push(rowU);
      } else if (newIdxS[keyS] !== undefined) {
        mergeExtFields_(rs, exOf(newRowsS[newIdxS[keyS]]));
        newRowsS[newIdxS[keyS]] = careRow_(rs); updS++;
      } else {
        newRowsS.push(careRow_(rs)); newIdxS[keyS] = newRowsS.length - 1; appS++;
      }
    }
    if (newRowsS.length) sh.getRange(lastS + 1, 1, newRowsS.length, Ws).setValues(newRowsS);
    try { CacheService.getScriptCache().remove('customers_v12'); } catch(ec) {}
    invalidateLookupCache_(rows.map(function(r){ return r.phone; }));
    sbMirrorCare_(sbRowsToRecs_(mirS.concat(newRowsS)), 'saveBatchCare_');
    return jsonOut_({ ok: true, updated: updS, appended: appS });
  }
  var data = sh.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < data.length; i++) { if (data[i][0]) index[normPhone_(String(data[i][0]))] = i; }
  var appended = 0, updated = 0;
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k]; var key = normPhone_(String(r.phone));
    if (index[key] !== undefined) {
      mergeExtFields_(r, { khStatus: data[index[key]][15]||'', nickZalos: data[index[key]][16]||'[]', birthday: data[index[key]][17]||'', zaloSetBy: data[index[key]][18]||'', name: data[index[key]][19]||'', zaloPhones: data[index[key]][21]||'[]' });
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
  if (sbWriteOn_()) {
    var mirB = [];
    for (var mk = 0; mk < rows.length; mk++) { var ixm = index[normPhone_(String(rows[mk].phone))]; if (ixm !== undefined) mirB.push(data[ixm]); }
    sbMirrorCare_(sbRowsToRecs_(mirB), 'saveBatchCare_(lo lon)');
  }
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

  var updated = 0, appended = 0, touchedRows = [];
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
      updated++; touchedRows.push(rowNum);
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
  sbMirrorSheetRows_(sh, touchedRows, newRows, 'syncZaloFriendStatus_');
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
    var _p = d ? _vnYmdParts_(d) : null; var yy = _p ? _p.y : '', mm = _p ? _p.mo : '';
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
  _ordersCacheClear_();
  sbMarkOrdersDirty_('dt', 'patchOrder');   // Supabase buoc 4b: ban sao dt_tong dang cu cho toi lan dong bo ke tiep
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
      var _p = d ? _vnYmdParts_(d) : null; var yy = _p ? _p.y : '', mm = _p ? _p.mo : '';
      if (String(yy) !== String(data.oldYear)) continue;
      if (String(mm) !== String(data.oldMonth)) continue;
      if (_normMoney_(r[DT_COL_GIATRIDON]) !== _normMoney_(data.oldRevenue)) continue;
    }
    sh.deleteRow(i + 2);
    _ordersCacheClear_();
    sbMarkOrdersDirty_('dt', 'deleteOrder');   // xoa dong lam lech src_row cac dong sau
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
  // KHONG dung Session.getScriptTimeZone() nua (co the sai neu cau hinh Time Zone cua du an
  // khong phai gio VN) — dung parseVNDate_ (da chuan hoa gio VN tuyet doi qua Date.UTC+offset)
  // roi format bang _vnYmd_ (cung offset co dinh, khong qua ambient timezone nao ca).
  var d = parseVNDate_(v);
  if (d) return _vnYmd_(d);
  var d2 = (v instanceof Date) ? v : new Date(v);
  if (!isNaN(d2)) return _vnYmd_(d2);
  return String(v).trim();
}
// Chuan hoa ten de SO SANH (khong dung de hien thi): bo khoang trang dau/cuoi + cac ky tu
// khoang trang/vo hinh Unicode hay dinh kem khi copy-paste (NBSP, zero-width space...), gop
// nhieu khoang trang lien tiep thanh 1, roi ha chu thuong. Dung o MOI cho gop ten Sale/Nhan
// vien theo key (Pancake report, KPI report...) de tranh 1 nguoi bi tach thanh 2 dong chi vi
// khac hoa/thuong hoac dinh khoang trang an khi go/copy tu Pancake.
function _normTxt_(s) {
  return String(s || '')
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, '') // NBSP + cac ky tu vo hinh thuong gap
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

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
  if (deleted) { _ordersCacheClear_(); sbMarkOrdersDirty_('dt', 'deleteDuplicateOrders'); }
  try {
    var cache = CacheService.getScriptCache();
    Object.keys(affectedPhones).forEach(function (p) { cache.remove('lk_' + p); });
  } catch (ec) {}
  return jsonOut_({ ok: true, deleted: deleted, skipped: skipped });
}

// ═══ TỰ ĐỘNG XOÁ DÒNG TRÙNG TUYỆT ĐỐI (Base + Pos) — thêm 2026-10-04 theo yêu cầu Duyên ═══
// Khác với findDuplicateOrders_/deleteDuplicateOrders_ ở trên (chỉ ĐỀ XUẤT, bắt buộc người
// dùng xác nhận trước khi xoá — vì nhóm trùng theo SĐT+ngày+SP có thể là 2 đơn THẬT lệch
// doanh thu): hàm dưới đây CHỈ xử lý trường hợp an toàn tuyệt đối — 1 dòng GIỐNG Y HỆT từng
// cột với 1 dòng khác (gần như chắc chắn là lỡ tay dán/nạp trùng 2 lần, không phải 2 đơn khác
// nhau) — nên mới được phép tự xoá mà KHÔNG cần ai xác nhận, chạy ngay khi sheet "DT TỔNG "
// (Base) hoặc "dữ liệu đơn" (Pos) có thay đổi (xem onChangeDedupTrigger_ + installAutoDedupTrigger_).
function _rowKeyExact_(row) {
  return JSON.stringify(row.map(function (v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return 'D:' + v.getTime();
    return v;
  }));
}
function _rowIsBlank_(row) {
  return row.every(function (v) { return v === '' || v === null || v === undefined; });
}
// Xoá các dòng trùng TUYỆT ĐỐI (mọi cột giống y hệt) trong 1 sheet, giữ lại dòng ĐẦU TIÊN
// của mỗi nhóm trùng, xoá (các) dòng còn lại. Bỏ qua dòng rỗng hoàn toàn (không tính là trùng).
function _autoDedupExactRowsInSheet_(sh, width) {
  if (!sh) return { deleted: 0, groupCount: 0 };
  var last = sh.getLastRow();
  if (last < 3) return { deleted: 0, groupCount: 0 }; // can >=2 dong du lieu moi co the trung
  width = Math.min(width, sh.getMaxColumns()); // sheet co the it cot hon width (tranh getRange vuot cot)
  var vals = sh.getRange(2, 1, last - 1, width).getValues();
  var seen = {}, toDelete = [], groupCount = 0;
  for (var i = 0; i < vals.length; i++) {
    var row = vals[i];
    if (_rowIsBlank_(row)) continue;
    var key = _rowKeyExact_(row);
    if (!seen[key]) { seen[key] = true; }
    else { toDelete.push(i + 2); groupCount++; }
  }
  if (!toDelete.length) return { deleted: 0, groupCount: 0 };
  toDelete.sort(function (a, b) { return b - a; }); // xoa tu duoi len tren, tranh lech chi so
  var deleted = 0;
  toDelete.forEach(function (rowIdx) {
    try { sh.deleteRow(rowIdx); deleted++; } catch (e) {}
  });
  return { deleted: deleted, groupCount: groupCount };
}
var SH_AUTO_DEDUP_LOG = 'Nhật ký xoá trùng tự động';
var AUTO_DEDUP_LOG_HEADERS = ['thoiGian', 'sheet', 'soDongDaXoa', 'ghiChu'];
function _autoDedupLog_(sheetName, deleted) {
  if (!deleted) return;
  try {
    var sh = getSheet_(SH_AUTO_DEDUP_LOG, AUTO_DEDUP_LOG_HEADERS);
    sh.appendRow([new Date(), sheetName, deleted, 'Tự động xoá dòng trùng tuyệt đối (trigger onChange) — xem lại sheet "' + sheetName + '" nếu thấy nghi ngờ.']);
  } catch (e) {}
}
// Ham duoc Google Sheets TU GOI khi spreadsheet DT_SS_ID (chua ca Base + Pos) co bat ky thay
// doi nao (dan/nhap/xoa dong, sua 1 o...) — xem installAutoDedupTrigger_ o duoi de cai dat
// trigger nay 1 LAN. Dung LockService de tranh 2 lan chay cung luc dam vao nhau khi co nhieu
// thay doi lien tiep gan nhau (vd dan nhieu lo du lieu gan sat nhau).
function onChangeDedupTrigger_(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // dang co lan chay khac xu ly, bo qua lan nay (se duoc don o lan thay doi tiep theo)
  try {
    var ss = getDTSS_();
    var resBase = _autoDedupExactRowsInSheet_(ss.getSheetByName(DT_TONG_SHEET), DT_TONG_WIDTH);
    _autoDedupLog_(DT_TONG_SHEET, resBase.deleted);
    var resPos = _autoDedupExactRowsInSheet_(ss.getSheetByName(DON_CHITIET_SHEET), DON_CHITIET_WIDTH);
    _autoDedupLog_(DON_CHITIET_SHEET, resPos.deleted);
    if (resBase.deleted) sbMarkOrdersDirty_('dt', 'autoDedup');   // Supabase buoc 4b
    if (resPos.deleted) sbMarkOrdersDirty_('don', 'autoDedup');
    try {
      var cache = CacheService.getScriptCache();
      // SUA 2026-10-07: key cache dung truoc day la 'donChiTiet_v3_n' nhung readDonChiTiet_ da doi
      // sang luu duoi key 'donChiTiet_v4' tu lau (xem _cachePutBig_('donChiTiet_v4',...) o tren) —
      // xoa nham key cu 'v3_n' khong con ton tai KHONG lam gi ca, nen cache 'v4' van song toi het
      // 90s TTL du sheet Pos vua bi xoa dong trung, khien bao cao B/E/F/G co the tam thoi van hien
      // dong da bi xoa. _cacheGetBig_ chi can mat key "<key>_n" la coi nhu cache rong (xem ham do),
      // nen chi can xoa dung '_n' cua key HIEN TAI 'donChiTiet_v4' la du, khong can xoa tung manh.
      if (resPos.deleted) cache.removeAll(['donChiTiet_v4_n', 'don_phones_v6_n']); // force doc lai sheet Pos ngay, khong doi het 90s cache
      if (resBase.deleted) cache.removeAll(['srptOptions_v3', 'orders_v1_n']);
    } catch (ecCache) {}
  } finally {
    lock.releaseLock();
  }
}
// CHAY 1 LAN DUY NHAT tu Apps Script Editor (chon ham "installAutoDedupTrigger_" trong dropdown
// -> bam Run, lan dau se hoi cap quyen thi Allow) de cai dat trigger "On change" cho spreadsheet
// DT_SS_ID. Trigger nay la installable trigger, TON TAI DOC LAP voi cac lan deploy Web App ve
// sau (khong bi mat khi dan de code moi + Deploy New version) — nen KHONG can chay lai ham nay
// moi lan sua code, chi can chay 1 LAN duy nhat. Ham tu kiem tra truoc, chay lai nhieu lan van
// an toan (khong tao trigger trung).
function installAutoDedupTrigger_() {
  var ss = getDTSS_();
  var existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'onChangeDedupTrigger_' && t.getTriggerSourceId() === ss.getId();
  });
  if (existing.length) return 'Trigger "onChangeDedupTrigger_" da ton tai (' + existing.length + '), khong tao them.';
  ScriptApp.newTrigger('onChangeDedupTrigger_').forSpreadsheet(ss).onChange().create();
  return 'Da tao trigger "On change" cho spreadsheet DT_SS_ID (' + ss.getId() + ') thanh cong.';
}

// ═══ NHAP DU LIEU BASE/POS TU FILE EXPORT (thay copy tay vao Google Sheet) — them 2026-10-07 theo
// yeu cau Duyen: "tạo 1 mục up data base pos lên CRM, nối tiếp vào 2 sheet [...] base là DT tổng
// và pos là dữ liệu đơn". Client (index.html, renderSalesReportTabI_/_impUpload) doc file Excel
// bang SheetJS, GUI NGUYEN mang 2 chieu (header + cot rong thua da bi cat o client) len day qua
// action 'importSheetRows'. Ham nay CHI ghi noi tiep (append) — khong bao gio ghi de/xoa du lieu
// cu, an toan voi sheet dang duoc nhan vien thao tac truc tiep hang ngay.
// SUA 2026-10-08 — KHOA KHU TRUNG THEO DON (khong con chi so khop "giong het moi cot").
// NGUYEN NHAN GOC cua loi "nhap lai file Excel van them don trung -> doanh thu x2": truoc day chi khu
// trung TUYET DOI (moi cot giong y het, xem _rowKeyExact_). Nhung nhan vien sua tay cac cot ben phai
// (Giao cho / Giai doan / Trang thai / Ghi chu) tren Sheet, va file export moi cung co the doi gia tri
// (trang thai don, dinh dang so "1,200,000" vs 1200000, ngay dang chuoi vs Date...) -> cung 1 don
// nhung KHAC o 1 cot la hoi tiet -> khong bi coi la trung -> ghi them dong thu 2 -> doanh thu x2.
// Cach moi: tinh KHOA DON da chuan hoa cho dong trong file VA dong da co san trong Sheet, bo qua dong
// nao khoa da ton tai (khong ghi de/khong xoa dong cu).
//  - Base (DT TONG): ID don (cot T) neu co; thieu ID thi SDT + ngay tao + thoi gian HT + gia tri don + san pham.
//  - Pos (du lieu don): khong co cot ID, cot A (STT) doi moi lan export nen BO QUA; dung ngay+gio tao,
//    SDT, ten khach, san pham, ma SP, so luong, gia tri sau giam, COD.
function _impHm_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    var sh = new Date(v.getTime() + VN_OFFSET_MS);
    return String(sh.getUTCHours()).padStart(2, '0') + ':' + String(sh.getUTCMinutes()).padStart(2, '0');
  }
  var m = String(v == null ? '' : v).trim().match(/\s(\d{1,2}):(\d{2})/);
  return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : '';
}
function _impOrderKey_(sheetKey, row) {
  if (sheetKey === 'base') {
    var id = String(row[DT_COL_ID] == null ? '' : row[DT_COL_ID]).trim();
    if (id) return 'id|' + id;
    var ph = normPhone_(String(row[DT_COL_PHONE] || ''));
    if (!ph) return 'x|' + _rowKeyExact_(row);
    return 'f|' + ph + '|' + normOrderDate_(row[DT_COL_NGAYTAO]) + '|' + normOrderDate_(row[DT_COL_THOIGIANHT]) + '|' +
      _normMoney_(row[DT_COL_GIATRIDON]) + '|' + _normTxt_(row[DT_COL_SANPHAM]);
  }
  var phP = normPhone_(String(row[4] || ''));
  var nameP = _normTxt_(row[3]), spP = _normTxt_(row[8]);
  if (!phP && !nameP && !spP) return 'x|' + _rowKeyExact_(row);
  return 'p|' + normOrderDate_(row[1]) + '|' + _impHm_(row[1]) + '|' + phP + '|' + nameP + '|' + spP + '|' +
    _normTxt_(row[9]) + '|' + _normTxt_(row[10]) + '|' + _normMoney_(row[11]) + '|' + _normMoney_(row[12]);
}

function doImportSheetRows_(sheetKey, rows) {
  if (!Array.isArray(rows) || !rows.length) return jsonOut_({ error: 'Không có dòng nào để nhập.' });
  var sheetName = sheetKey === 'pos' ? DON_CHITIET_SHEET : (sheetKey === 'base' ? DT_TONG_SHEET : '');
  if (!sheetName) return jsonOut_({ error: 'Tham số sheet không hợp lệ (chỉ nhận "base" hoặc "pos").' });
  var ss = getDTSS_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return jsonOut_({ error: 'Không tìm thấy sheet "' + sheetName + '" trong Google Sheet.' });

  // Khoa: bam "Nhap" 2 lan / 2 admin nhap cung luc khong duoc cung doc-roi-ghi (se cung thay "chua co" -> ghi 2 lan).
  var impLock = LockService.getScriptLock();
  if (!impLock.tryLock(25000)) return jsonOut_({ error: 'Hệ thống đang xử lý 1 lần nhập khác — đợi vài giây rồi bấm lại (KHÔNG bấm liên tục).' });
  try {
    return doImportSheetRowsLocked_(sheetKey, sheetName, sh, rows);
  } finally {
    try { impLock.releaseLock(); } catch (eRel) {}
  }
}
function doImportSheetRowsLocked_(sheetKey, sheetName, sh, rows) {
  var width = 0;
  for (var i = 0; i < rows.length; i++) {
    if (!Array.isArray(rows[i])) return jsonOut_({ error: 'Dữ liệu dòng ' + (i + 1) + ' không đúng định dạng (không phải mảng).' });
    width = Math.max(width, rows[i].length);
  }
  if (width < 1 || width > 40) return jsonOut_({ error: 'Số cột dữ liệu không hợp lệ (' + width + ') — kiểm tra lại file.' });

  // Khu trung NGAY TRONG CHINH FILE dang nhap (vd lo xuat 2 lan trung 1 doan ngay) — chi so sanh
  // gia tri THO (chuoi/so) nhan tu JSON cua client, CHUA lien quan Date object cua Google Sheet
  // (xem giai thich ky hon o duoi, truoc khi goi _autoDedupExactRowsInSheet_).
  var toWrite = [], seenInFile = {}, skippedDupInFile = 0;
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r].slice(0, width);
    while (row.length < width) row.push('');
    if (_rowIsBlank_(row)) continue;
    var key = JSON.stringify(row);
    if (seenInFile[key]) { skippedDupInFile++; continue; }
    seenInFile[key] = true;
    toWrite.push(row);
  }
  // Bo cac dong DON DA CO SAN trong Sheet (theo khoa don chuan hoa — xem _impOrderKey_). Doc lai chinh
  // Sheet (khong tin cache) trong luc dang giu khoa.
  var keyW = (sheetKey === 'pos') ? DON_CHITIET_WIDTH : DT_TONG_WIDTH;
  var existKeys = {};
  var lastNow = sh.getLastRow();
  if (lastNow >= 2) {
    var exVals = sh.getRange(2, 1, lastNow - 1, Math.min(keyW, sh.getMaxColumns())).getValues();
    for (var e = 0; e < exVals.length; e++) {
      var er = exVals[e];
      if (_rowIsBlank_(er)) continue;
      while (er.length < keyW) er.push('');
      existKeys[_impOrderKey_(sheetKey, er)] = true;
    }
  }
  var fresh = [], skippedExisting = 0, seenKey = {};
  for (var w = 0; w < toWrite.length; w++) {
    var kr = toWrite[w].slice(0);
    while (kr.length < keyW) kr.push('');
    var k2 = _impOrderKey_(sheetKey, kr);
    if (existKeys[k2]) { skippedExisting++; continue; }
    if (seenKey[k2]) { skippedDupInFile++; continue; }
    seenKey[k2] = true;
    fresh.push(toWrite[w]);
  }
  toWrite = fresh;
  if (!toWrite.length) return jsonOut_({ ok: true, written: 0, skippedDupInFile: skippedDupInFile, skippedExisting: skippedExisting, dedupedAfter: 0 });

  sh.getRange(sh.getLastRow() + 1, 1, toWrite.length, width).setValues(toWrite);

  // Khu trung TUYET DOI voi du lieu DA CO SAN trong sheet: CO Y khong tu so sanh truoc khi ghi —
  // cac dong moi gui len tu client la gia tri THO tu JSON (vd ngay la chuoi "06/10/2026 23:46"),
  // trong khi cac dong co san doc qua getValues() co the da la Date object (Google Sheet tu nhan
  // dang dinh dang ngay) — 2 kieu nay so sanh truc tiep se KHONG BAO GIO khop, lam dedup vo tac
  // dung voi moi dong co cot ngay. Giai phap: ghi xong RỒI doc lai CA 2 phia tu chinh Sheet qua
  // _autoDedupExactRowsInSheet_ (dung CHUNG ham + do rong voi trigger onChange co san, xem
  // onChangeDedupTrigger_ o tren) — luc nay Sheets da tu chuan hoa kieu du lieu cho CA dong cu LAN
  // dong vua ghi giong het nhau, so sanh moi dung. Dong moi trung voi dong cu se bi xoa, GIU LAI
  // dong cu (dung dung thu tu uu tien "dong dau tien" cua ham dung chung).
  var dedupWidth = (sheetName === DON_CHITIET_SHEET) ? DON_CHITIET_WIDTH : DT_TONG_WIDTH;
  var dedupRes = _autoDedupExactRowsInSheet_(sh, dedupWidth);
  _autoDedupLog_(sheetName, dedupRes.deleted);
  sbMarkOrdersDirty_(sheetName === DON_CHITIET_SHEET ? 'don' : 'dt', 'import');   // Supabase buoc 4b

  try {
    var cache = CacheService.getScriptCache();
    if (sheetName === DON_CHITIET_SHEET) cache.removeAll(['donChiTiet_v4_n', 'don_phones_v6_n']);
    else cache.removeAll(['srptOptions_v3', 'orders_v1_n']);
  } catch (ec) {}

  return jsonOut_({ ok: true, written: toWrite.length, skippedDupInFile: skippedDupInFile, skippedExisting: skippedExisting, dedupedAfter: dedupRes.deleted });
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
    var ratePct = (t.ratePct && typeof t.ratePct === 'object') ? { above15: Number(t.ratePct.above15)||0, below15: Number(t.ratePct.below15)||0 } : { above15: 0, below15: 0 };
    matrix.push([t.id||'', t.name||'', t.leader||'', JSON.stringify(t.members||[]), t.color||'', JSON.stringify(t.channels||[]), JSON.stringify(ratePct)]);
  }
  sh.getRange(1, 1, matrix.length, TEAM_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: teams.length });
}


// ═══════════════════════════════════════════════════════════════
//  NHOM MKT — moi MKT gom 1 hoac nhieu Page (pageId Pancake). Hien tai moi page thuoc 1 MKT
//  (share mac dinh = 1). Neu ve sau 1 page chay chung nhieu MKT: dat 'share' (ty le tuong doi) cho
//  page do o tung MKT, he thong tu chuan hoa de tong = 100% (vd 2 MKT cung share 1 -> moi MKT 50%).
//  Page chua gan MKT nao gom vao nhom "(chưa gán MKT)".
// ═══════════════════════════════════════════════════════════════
function readMktTeams_() {
  var sh = getSheet_(SH_MKT_TEAM, MKT_TEAM_HEADERS);
  var out = [];
  if (sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, MKT_TEAM_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (!v[i][0] && !v[i][1]) continue;
    var pages = [];
    try { pages = v[i][3] ? JSON.parse(v[i][3]) : []; } catch (e) { pages = []; }
    if (!Array.isArray(pages)) pages = [];
    pages = pages.map(function(p) {
      if (typeof p === 'string') return { pageId: p, share: 1 };
      var sh2 = Number(p && p.share);
      return { pageId: String((p && p.pageId) || ''), share: (isNaN(sh2) || sh2 <= 0) ? 1 : sh2 };
    }).filter(function(p) { return p.pageId; });
    out.push({ id: String(v[i][0] || v[i][1]), name: String(v[i][1] || ''), color: String(v[i][2] || ''), pages: pages });
  }
  return out;
}

function saveMktTeams_(teams) {
  teams = teams || [];
  var sh = getSheet_(SH_MKT_TEAM, MKT_TEAM_HEADERS);
  sh.clearContents();
  var matrix = [MKT_TEAM_HEADERS];
  for (var i = 0; i < teams.length; i++) {
    var t = teams[i];
    var pages = (t.pages || []).map(function(p) {
      if (typeof p === 'string') return { pageId: p, share: 1 };
      var s2 = Number(p && p.share);
      return { pageId: String((p && p.pageId) || ''), share: (isNaN(s2) || s2 <= 0) ? 1 : s2 };
    }).filter(function(p) { return p.pageId; });
    matrix.push([t.id || ('mkt_' + Date.now() + '_' + i), t.name || '', t.color || '', JSON.stringify(pages)]);
  }
  sh.getRange(1, 1, matrix.length, MKT_TEAM_HEADERS.length).setValues(matrix);
  try { CacheService.getScriptCache().removeAll(['srptOptions_v3']); } catch (ec) {}
  return jsonOut_({ ok: true, written: teams.length });
}

// pageId -> [{id, name, w}] voi w da chuan hoa (tong cac MKT cung 1 page = 1).
function _mktPageWeights_(teams) {
  var raw = {}; // pageId -> [{id,name,share}]
  (teams || []).forEach(function(t) {
    (t.pages || []).forEach(function(p) {
      if (!raw[p.pageId]) raw[p.pageId] = [];
      raw[p.pageId].push({ id: t.id, name: t.name, share: p.share || 1 });
    });
  });
  var out = {};
  Object.keys(raw).forEach(function(pid) {
    var tot = raw[pid].reduce(function(s, x) { return s + x.share; }, 0) || 1;
    out[pid] = raw[pid].map(function(x) { return { id: x.id, name: x.name, w: x.share / tot }; });
  });
  return out;
}

// Ten Kenh ban (kenhBan trong DT TONG) -> [{id, name, w}] — di qua PancakePageMap (pageId -> kenhBan).
// Neu nhieu Page cung tro ve 1 Kenh, trong so cua cac Page duoc cong roi chuan hoa lai.
function _mktKenhWeights_(teams, pageMap) {
  var pw = _mktPageWeights_(teams);
  var acc = {}; // kenh -> {teamId -> {name, w}}
  Object.keys(pageMap || {}).forEach(function(pid) {
    var kenh = pageMap[pid];
    var ws = pw[pid];
    if (!kenh || !ws) return;
    if (!acc[kenh]) acc[kenh] = {};
    ws.forEach(function(x) {
      if (!acc[kenh][x.id]) acc[kenh][x.id] = { name: x.name, w: 0 };
      acc[kenh][x.id].w += x.w;
    });
  });
  var out = {};
  Object.keys(acc).forEach(function(kenh) {
    var ids = Object.keys(acc[kenh]);
    var tot = ids.reduce(function(s, id) { return s + acc[kenh][id].w; }, 0) || 1;
    out[kenh] = ids.map(function(id) { return { id: id, name: acc[kenh][id].name, w: acc[kenh][id].w / tot }; });
  });
  return out;
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
  rows.forEach(function(r) { touchedKeys[normOrderDate_(r.date) + '|' + r.pageId] = true; });

  var keep = [];
  if (lastRow > 1) {
    var existing = sh.getRange(2, 1, lastRow - 1, PK_STATS_HEADERS.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      // Chuan hoa lai cot ngay TRUOC khi so khop/ghi lai: cot A dinh dang "Tu dong" nen Sheets
      // hay tu y doi chuoi "2026-09-18" thanh kieu Date ngay khi ghi lan dau; so sanh chuoi
      // voi mot gia tri Date se luon sai lech, lam mat han dong do khoi moi bao cao/KPI ve sau
      // (trieu chung: nap du lieu moi xong nhung so lieu khong nhay). Chuan hoa o day vua sua
      // dung key de so khop, vua "chua" luon gia tri se ghi lai xuong sheet (tu heal du lieu cu).
      existing[i][0] = normOrderDate_(existing[i][0]);
      var k = existing[i][0] + '|' + existing[i][1];
      if (!touchedKeys[k]) keep.push(existing[i]);
    }
  }

  var newRows = rows.map(function(r) {
    return [normOrderDate_(r.date), r.pageId||'', r.pageName||'', r.nhanVien||'',
      +r.khCu||0, +r.khMoi||0, +r.tongTT||0, +r.tinNhan||0, +r.binhLuan||0,
      +r.hoiThoaiMoi||0, +r.dhKhMoi||0, +r.dhKhCu||0, +r.tongDH||0];
  });

  sh.clearContents();
  var matrix = [PK_STATS_HEADERS].concat(keep).concat(newRows);
  // Ep cot A (ngay) ve dinh dang van ban TRUOC khi ghi gia tri, de Sheets khong tu dong doi
  // chuoi "yyyy-MM-dd" thanh kieu Date nua (chan loi tai phat sinh cho lan luu ke tiep).
  sh.getRange(1, 1, matrix.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, matrix.length, PK_STATS_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: newRows.length, replaced: keep.length !== (lastRow > 1 ? lastRow - 1 : 0) });
}

// Tra ve {map, mapCI} — mapCI la ban khong phan biet hoa/thuong cua map (dung khi ten Pancake
// bi go sai hoa/thuong giua cac lan xuat file, vd "biichnguyen1993" va "Biichnguyen1993" phai
// duoc coi la CUNG 1 nguoi thay vi tach thanh 2 dong rieng trong bao cao).
function readPancakeMapCI_() {
  var map = readPancakeMap_();
  var mapCI = {};
  Object.keys(map).forEach(function(k) { mapCI[_normTxt_(k)] = map[k]; });
  return { map: map, mapCI: mapCI };
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

// Toan bo ten "Nhan vien" tung xuat hien trong bao cao Pancake da luu (khong loc theo ngay) —
// dung de bang "Khop ten" luon hien du danh sach can khop, KE CA sau khi da nap/luu bao cao
// va reload lai trang (khac voi _pkState.parsedUnmapped ben client chi ton tai tam thoi tu
// file vua doc, se mat neu bam Luu len CRM hoac F5 truoc khi khop het).
function pancakeAllNames_() {
  var sh = getSheet_(SH_PK_STATS, PK_STATS_HEADERS);
  var seen = {}, out = []; // key = ten viet thuong, khong dau khoang trang thua -> gop cac bien the hoa/thuong
  if (sh.getLastRow() >= 2) {
    var v = sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues(); // cot D = nhanVien
    for (var i = 0; i < v.length; i++) {
      var nm = String(v[i][0] || '').trim(); if (!nm) continue;
      var k = _normTxt_(nm);
      if (!seen[k]) { seen[k] = nm; out.push(nm); } // giu dung bien the DAU TIEN gap
    }
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

// FIX 2026-10 (Bao cao B/Pos bi timeout "qua 55 giay" o khoang ngay rong): trong 1 request tai
// Bao cao A/B, sheet SH_PK_STATS (lich su tuong tac Pancake, co the da tich luy rat nhieu dong
// theo thoi gian) bi doc TOAN BO (sh.getRange(...).getValues() — khong gioi han ngay o tang doc
// sheet, loc ngay chi lam sau khi da keo het du lieu ve) nhieu lan GIONG HET NHAU:
//   1) buildPancakeReport_ — goi 2 LAN voi CUNG from/to/split trong _srCloseRateSections_ (1
//      lan tinh saleCloseRate, 1 lan tinh kenhCloseRate)
//   2) _pkTrackedDatesByPageAndSale_ — goi 1 lan rieng, cung sheet
//   3) khoi "saleCloseByPage" (Ty le chot theo Sale x Page) trong _srCloseRateSections_ — tu
//      doc rieng 1 lan nua, khong qua ham dung chung nao ca
// Tong cong 1 request co the keo ca sheet nay ve 4 LAN — day la chi phi lon nhat (goi API doc
// Sheets, khong phai vong lap JS) gay vuot 55s. Dung CHUNG 1 lan doc qua _pkStatsRowsMemo_() cho
// ca 3 noi tren (memo ngan han 5s, du dung trong 1 request, tu lam moi o request sau de khong
// giu du lieu cu qua lau) — giam tu toi da 4 lan doc sheet xuong CON 1 LAN, khong doi logic/ket
// qua tra ve cua tung noi.
var _pkStatsRowsMemoCache_ = null; // { time, rows }
function _pkStatsRowsMemo_() {
  var now = Date.now();
  if (_pkStatsRowsMemoCache_ && (now - _pkStatsRowsMemoCache_.time) < 5000) return _pkStatsRowsMemoCache_.rows;
  var sh = getSheet_(SH_PK_STATS, PK_STATS_HEADERS);
  var rows = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, PK_STATS_HEADERS.length).getValues() : [];
  _pkStatsRowsMemoCache_ = { time: now, rows: rows };
  return rows;
}

// Tong hop bao cao theo Page va theo CS (da khop ten qua PancakeNameMap; ten chua khop giu
// nguyen ten Pancake va danh dau unmapped:true de UI nhac nguoi dung di khop ten).
// Memo hoa KET QUA theo key (from|to|split) — xem giai thich day du o _pkStatsRowsMemo_() phia
// tren; ham nay bi goi 2 lan voi cung tham so trong cung 1 request tu _srCloseRateSections_.
var _pkReportMemoCache_ = null; // { key, time, data }
function buildPancakeReport_(from, to, split) {
  split = (split === 'full') ? 'full' : 'equal';
  var _pkMemoKey_ = from + '|' + to + '|' + split;
  var _pkMemoNow_ = Date.now();
  if (_pkReportMemoCache_ && _pkReportMemoCache_.key === _pkMemoKey_ && (_pkMemoNow_ - _pkReportMemoCache_.time) < 5000) {
    return _pkReportMemoCache_.data;
  }
  var mapPair = readPancakeMapCI_(), map = mapPair.map, mapCI = mapPair.mapCI;
  var byPage = {}, byCS = {};
  var unmappedSet = {}, unmappedCanon = {}; // ci-key -> ten hien thi (giu ban DAU TIEN gap)
  var salesCanon = {}; // ci-key -> ten hien thi DAU TIEN gap, danh cho ten Sale DA khop qua PancakeNameMap
                        // (phong truong hop chinh gia tri mapping bi go khac hoa/thuong/dinh khoang
                        // trang giua 2 dong khop khac nhau, vi du "biichnguyen1993" va "Biichnguyen1993 ")

  var v = _pkStatsRowsMemo_();
  if (v.length) {
    for (var i = 0; i < v.length; i++) {
      var d = normOrderDate_(v[i][0]); // chuan hoa: cot co the con vai dong Date-object cu, xem savePancakeStats_
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
      var rawMap = map[nhanVien]; if (rawMap === undefined) rawMap = mapCI[_normTxt_(nhanVien)];
      var sales = String(rawMap || '').split('|').map(function(x) { return x.trim(); }).filter(function(x) { return x; });
      var mapped = sales.length > 0;
      if (!mapped) {
        var ck1 = _normTxt_(nhanVien);
        if (!unmappedCanon[ck1]) unmappedCanon[ck1] = nhanVien;
        sales = [unmappedCanon[ck1]]; unmappedSet[unmappedCanon[ck1]] = true;
      }
      // split='equal': chia deu cho cac Sale (tong theo CS = tong theo Page); split='full': moi Sale tinh du.
      var w = (split === 'full') ? 1 : 1 / sales.length;
      for (var si = 0; si < sales.length; si++) {
        var saleName = sales[si];
        // Chuan hoa key theo ten DA KHOP tu PancakeNameMap — phong truong hop chinh gia tri
        // mapping bi go khac hoa/thuong/dinh khoang trang giua 2 dong khop khac nhau (khien
        // CUNG 1 Sale bi tach thanh 2 dong rieng trong bang "Theo Sale", vi du da gap thuc te:
        // "biichnguyen1993" va "Biichnguyen1993 "). Ten hien thi = ban DAU TIEN gap.
        var csKey = _normTxt_(saleName);
        if (!salesCanon[csKey]) salesCanon[csKey] = saleName;
        if (!byCS[csKey]) byCS[csKey] = { name: salesCanon[csKey], pancakeNames: {}, mapped: mapped, shared: false, khCu:0, khMoi:0, tongTT:0, tinNhan:0, binhLuan:0, hoiThoaiMoi:0, dhKhMoi:0, dhKhCu:0, tongDH:0 };
        var bc = byCS[csKey];
        bc.pancakeNames[nhanVien] = true;
        if (mapped) bc.mapped = true; // neu >=1 nguon da khop thi coi la mapped (hiem khi trung ten CS voi ten chua khop)
        if (sales.length > 1) bc.shared = true;
        bc.khCu+=khCu*w; bc.khMoi+=khMoi*w; bc.tongTT+=tongTT*w; bc.tinNhan+=tinNhan*w; bc.binhLuan+=binhLuan*w;
        bc.hoiThoaiMoi+=hoiThoaiMoi*w; bc.dhKhMoi+=dhKhMoi*w; bc.dhKhCu+=dhKhCu*w; bc.tongDH+=tongDH*w;
      }
    }
  }

  function finalize(obj, hiddenSet, keyProp) {
    var arr = Object.keys(obj).map(function(k) {
      var r = obj[k];
      r.tyLeCD = r.tongTT ? Math.round(r.tongDH / r.tongTT * 1000) / 10 : 0;
      ['khCu','khMoi','tongTT','tinNhan','binhLuan','hoiThoaiMoi','dhKhMoi','dhKhCu','tongDH'].forEach(function(f) { r[f] = Math.round(r[f] * 100) / 100; });
      if (r.pancakeNames) r.pancakeNames = Object.keys(r.pancakeNames);
      return r;
    });
    // An Page/Sale theo cai dat admin (setSetting hiddenChannels/hiddenSales) — cung 1 danh
    // sach dung chung voi readDTTong_, de moi bao cao (Sales report A-E, KPI Pancake, widget
    // Ty le chot theo Sale) deu nhat quan an cung 1 tap Page/Sale.
    if (hiddenSet && hiddenSet.length) arr = arr.filter(function(r) { return hiddenSet.indexOf(r[keyProp]) === -1; });
    arr.sort(function(a,b) { return b.tongTT - a.tongTT; });
    return arr;
  }

  var hiddenSets2 = _hiddenPageSaleSets_();
  var _pkReportResult_ = { byPage: finalize(byPage, hiddenSets2.channels, 'pageName'), byCS: finalize(byCS, hiddenSets2.sales, 'name'), unmapped: Object.keys(unmappedSet).sort(), split: split };
  _pkReportMemoCache_ = { key: _pkMemoKey_, time: _pkMemoNow_, data: _pkReportResult_ };
  return _pkReportResult_;
}

// ═══════════════════════════════════════════════════════════════
//  PANCAKE — THONG KE SDT MANG VE / DON CHOT (file "Thong ke nhan vien",
//  sheet "<pageId> By staff") — luu tren CRM (KHONG chi luu trinh duyet nhu Tag),
//  dung lam mau so cho ty le tag L2 va cho Bao cao KPI tong hop.
// ═══════════════════════════════════════════════════════════════
function savePancakeSdtStats_(rows) {
  rows = rows || [];
  if (!rows.length) return jsonOut_({ ok: true, written: 0 });
  var sh = getSheet_(SH_PK_SDT, PK_SDT_STATS_HEADERS);
  var lastRow = sh.getLastRow();

  var touchedKeys = {};
  rows.forEach(function(r) { touchedKeys[normOrderDate_(r.date) + '|' + r.pageId] = true; });

  var keep = [];
  if (lastRow > 1) {
    var existing = sh.getRange(2, 1, lastRow - 1, PK_SDT_STATS_HEADERS.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      // Xem chu thich chi tiet o savePancakeStats_ — cung 1 loi coi Sheets tu doi chuoi ngay
      // thanh kieu Date, chuan hoa lai o day vua sua key vua tu heal du lieu cu.
      existing[i][0] = normOrderDate_(existing[i][0]);
      var k = existing[i][0] + '|' + existing[i][1];
      if (!touchedKeys[k]) keep.push(existing[i]);
    }
  }

  var newRows = rows.map(function(r) {
    return [normOrderDate_(r.date), r.pageId||'', r.pageName||'', r.nhanVien||'',
      +r.tinNhanTuBinhLuan||0, +r.binhLuan||0, +r.phienTLBinhLuan||0,
      +r.tinNhan||0, +r.phienTLTinNhan||0, +r.sdtMangVe||0, +r.soDonChot||0];
  });

  sh.clearContents();
  var matrix = [PK_SDT_STATS_HEADERS].concat(keep).concat(newRows);
  sh.getRange(1, 1, matrix.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, matrix.length, PK_SDT_STATS_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: newRows.length, replaced: keep.length !== (lastRow > 1 ? lastRow - 1 : 0) });
}

// Tong hop bao cao SDT theo Page va theo CS — cung co che khop ten qua PancakeNameMap
// nhu buildPancakeReport_ (dung chung 1 bang khop, khong can khop rieng lan 2).
function buildPancakeSdtReport_(from, to, split) {
  split = (split === 'full') ? 'full' : 'equal';
  var sh = getSheet_(SH_PK_SDT, PK_SDT_STATS_HEADERS);
  var mapPair = readPancakeMapCI_(), map = mapPair.map, mapCI = mapPair.mapCI;
  var byPage = {}, byCS = {};
  var unmappedSet = {}, unmappedCanon = {};
  var salesCanon = {}; // xem chu thich o buildPancakeReport_

  if (sh.getLastRow() >= 2) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, PK_SDT_STATS_HEADERS.length).getValues();
    for (var i = 0; i < v.length; i++) {
      var d = normOrderDate_(v[i][0]); // xem chu thich o savePancakeStats_
      if (from && d < from) continue;
      if (to && d > to) continue;
      var pageId = String(v[i][1]), pageName = String(v[i][2]), nhanVien = String(v[i][3]);
      var tinNhanTuBinhLuan=+v[i][4]||0, binhLuan=+v[i][5]||0, phienTLBinhLuan=+v[i][6]||0,
          tinNhan=+v[i][7]||0, phienTLTinNhan=+v[i][8]||0, sdtMangVe=+v[i][9]||0, soDonChot=+v[i][10]||0;

      if (!byPage[pageId]) byPage[pageId] = { pageId: pageId, pageName: pageName, sdtMangVe:0, soDonChot:0, tinNhan:0, binhLuan:0 };
      var bp = byPage[pageId];
      bp.sdtMangVe+=sdtMangVe; bp.soDonChot+=soDonChot; bp.tinNhan+=tinNhan; bp.binhLuan+=binhLuan;

      var rawMap = map[nhanVien]; if (rawMap === undefined) rawMap = mapCI[_normTxt_(nhanVien)];
      var sales = String(rawMap || '').split('|').map(function(x) { return x.trim(); }).filter(function(x) { return x; });
      var mapped = sales.length > 0;
      if (!mapped) {
        var ck2 = _normTxt_(nhanVien);
        if (!unmappedCanon[ck2]) unmappedCanon[ck2] = nhanVien;
        sales = [unmappedCanon[ck2]]; unmappedSet[unmappedCanon[ck2]] = true;
      }
      var w = (split === 'full') ? 1 : 1 / sales.length;
      for (var si = 0; si < sales.length; si++) {
        var saleName = sales[si];
        var csKey = _normTxt_(saleName); // xem chu thich o buildPancakeReport_
        if (!salesCanon[csKey]) salesCanon[csKey] = saleName;
        if (!byCS[csKey]) byCS[csKey] = { name: salesCanon[csKey], mapped: mapped, sdtMangVe:0, soDonChot:0, tinNhan:0, binhLuan:0 };
        var bc = byCS[csKey];
        if (mapped) bc.mapped = true;
        bc.sdtMangVe+=sdtMangVe*w; bc.soDonChot+=soDonChot*w; bc.tinNhan+=tinNhan*w; bc.binhLuan+=binhLuan*w;
      }
    }
  }

  function finalize(obj) {
    var arr = Object.keys(obj).map(function(k) {
      var r = obj[k];
      ['sdtMangVe','soDonChot','tinNhan','binhLuan'].forEach(function(f) { r[f] = Math.round(r[f] * 100) / 100; });
      return r;
    });
    arr.sort(function(a,b) { return b.sdtMangVe - a.sdtMangVe; });
    return arr;
  }

  return { byPage: finalize(byPage), byCS: finalize(byCS), unmapped: Object.keys(unmappedSet).sort(), split: split };
}

// ═══════════════════════════════════════════════════════════════
//  PANCAKE — KHOP TEN PAGE (pageId) <-> "Kenh ban" chuan trong DT TONG
//  Cung co che voi PancakeNameMap (khop Nhan vien <-> Sale) o tren.
// ═══════════════════════════════════════════════════════════════
function readPancakePageMap_() {
  var sh = getSheet_(SH_PK_PAGEMAP, PK_PAGEMAP_HEADERS);
  var out = {};
  if (sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PK_PAGEMAP_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    if (!v[i][0]) continue;
    out[String(v[i][0])] = String(v[i][2] || ''); // key = pageId -> kenhBan
  }
  return out;
}

// Ban do du phong theo TEN Page (chuan hoa qua _normTxt_) -> "Kênh bán", doc CUNG 1 sheet
// PancakePageMap nhu readPancakePageMap_ (chi doi khoa tu pageId sang pageName). Dung khi mot
// don "dữ liệu đơn" khong trich duoc pageId tu cot "Nguồn đơn" (xem _extractPageNameFromNguonDon_)
// — cho phep khop ca nhung "Page" khong co ID Pancake thuc (quay ban truc tiep, kenh thu cong)
// ma admin da tu tay ghi 1 dong vao PancakePageMap (pageId o day chi can la khoa duy nhat, khong
// bat buoc la ID Pancake thuc). Nhieu pageName trung nhau (khac pageId) se lay dong doc sau cung.
function readPancakePageMapByName_() {
  var sh = getSheet_(SH_PK_PAGEMAP, PK_PAGEMAP_HEADERS);
  var out = {};
  if (sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, PK_PAGEMAP_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    var pname = String(v[i][1] || '').trim();
    if (!pname) continue;
    out[_normTxt_(pname)] = String(v[i][2] || '');
  }
  return out;
}

// Toan bo (pageId,pageName) tung xuat hien trong PancakeStats/PancakeSdtStats da luu — dung
// de bang "Khop ten Page" luon hien du danh sach can khop.
function pancakeAllPages_() {
  var out = {}; // pageId -> pageName
  [SH_PK_STATS, SH_PK_SDT].forEach(function(shName) {
    var sh = getSheet_(shName, shName === SH_PK_STATS ? PK_STATS_HEADERS : PK_SDT_STATS_HEADERS);
    if (sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues(); // cot B=pageId, C=pageName
    for (var i = 0; i < v.length; i++) { if (v[i][0]) out[String(v[i][0])] = String(v[i][1] || ''); }
  });
  return Object.keys(out).map(function(pid) { return { pageId: pid, pageName: out[pid] }; });
}

function savePancakePageMap_(pageId, pageName, kenhBan) {
  if (!pageId) return jsonOut_({ error: 'Thieu Page ID.' });
  var sh = getSheet_(SH_PK_PAGEMAP, PK_PAGEMAP_HEADERS);
  var lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    var v = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) === String(pageId)) {
        sh.getRange(i + 2, 2, 1, 2).setValues([[pageName || '', kenhBan || '']]);
        return jsonOut_({ ok: true, updated: true });
      }
    }
  }
  sh.appendRow([pageId, pageName || '', kenhBan || '']);
  return jsonOut_({ ok: true, updated: false });
}

// ═══════════════════════════════════════════════════════════════
//  PANCAKE — THONG KE TAG (L1-L7 trang thai, S/O sale) theo Page+ngay — luu tren CRM
//  (truoc day chi luu trinh duyet, lam Bao cao KPI tong hop khong doc duoc). Phan loai tag
//  tinh LAI moi lan tong hop (khong tin type/code luc luu), CUNG LOGIC voi _pkClassifyTag
//  ben client, de quy chuan tay (pancakeTagOverride) ap dung duoc ngay ca voi du lieu cu.
// ═══════════════════════════════════════════════════════════════
var PK_STATUS_CODES_ = ['L1','L2','L3','L4','L5','L5.1','L5.2','L6','L7','L8','L9']; // L8 = Upsale, L9 = Chot keo (KH cu) — chi dem so luong tru khi da co cau hinh muc tieu

function classifyPancakeTag_(name, overrideMap) {
  var n = String(name || '').trim();
  var ov = overrideMap && overrideMap[n];
  if (ov) {
    if (PK_STATUS_CODES_.indexOf(ov) !== -1 || /^L\d+(\.\d+)?$/i.test(ov)) return { type: 'status', code: String(ov).toUpperCase() }; // L9, L10... quy chuan tay
    if (/^([SO])\d+$/i.test(ov)) return { type: 'sale', code: ov.toUpperCase() }; // quy chuan tay tro thang ve 1 Sale
  }
  var m = n.match(/^([SO])\s*(\d+)(?!\d)/i);
  if (m) return { type: 'sale', code: m[1].toUpperCase() + parseInt(m[2], 10) };
  if (/^L\s*\d?\.?\s*ch[oờ]\s*ck/i.test(n) || /^L5\.1/i.test(n)) return { type: 'status', code: 'L5.1' };
  if (/^L5\.2/i.test(n) || /^L\s*\d?\.?\s*ch[oờ]\s*l[eê]n/i.test(n)) return { type: 'status', code: 'L5.2' };
  // \d+ (nhieu chu so) de tag L9, L10, L11... cung duoc nhan la trang thai (truoc day chi bat
  // dung 1 chu so nen "L10" bi roi vao "other" khong phan loai duoc).
  m = n.match(/^L\s*(\d+)(?!\d)/i);
  if (m) return { type: 'status', code: 'L' + parseInt(m[1], 10) };
  return { type: 'other', code: '' };
}

function savePancakeTagStats_(rows) {
  rows = rows || [];
  if (!rows.length) return jsonOut_({ ok: true, written: 0 });
  var sh = getSheet_(SH_PK_TAG, PK_TAG_STATS_HEADERS);
  var lastRow = sh.getLastRow();

  var touchedKeys = {};
  rows.forEach(function(r) { touchedKeys[normOrderDate_(r.date) + '|' + r.pageId + '|' + (r.tagId || r.tagName)] = true; });

  var keep = [];
  if (lastRow > 1) {
    var existing = sh.getRange(2, 1, lastRow - 1, PK_TAG_STATS_HEADERS.length).getValues();
    for (var i = 0; i < existing.length; i++) {
      // Xem chu thich chi tiet o savePancakeStats_ — cung 1 loi coi Sheets tu doi chuoi ngay
      // thanh kieu Date, chuan hoa lai o day vua sua key vua tu heal du lieu cu.
      existing[i][0] = normOrderDate_(existing[i][0]);
      var k = existing[i][0] + '|' + existing[i][1] + '|' + (existing[i][3] || existing[i][4]);
      if (!touchedKeys[k]) keep.push(existing[i]);
    }
  }

  var newRows = rows.map(function(r) {
    return [normOrderDate_(r.date), r.pageId || '', r.pageName || '', r.tagId || '', r.tagName || '', +r.count || 0];
  });

  sh.clearContents();
  var matrix = [PK_TAG_STATS_HEADERS].concat(keep).concat(newRows);
  sh.getRange(1, 1, matrix.length, 1).setNumberFormat('@');
  sh.getRange(1, 1, matrix.length, PK_TAG_STATS_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: newRows.length });
}

// Tong hop bao cao tag theo Page (khong theo Sale, vi tag Pancake chi gan o muc hoi thoai/Page,
// khong co truong "Nhan vien" nhu 2 loai bao cao Pancake kia) — dung lam nguyen lieu cho
// buildKpiReport_ (ty le L7/tongTT theo Page, va phe do L1->L6 tong the toan he thong).
function buildPancakeTagReport_(from, to) {
  var sh = getSheet_(SH_PK_TAG, PK_TAG_STATS_HEADERS);
  var overrideMap = {};
  try { var raw = getSetting_('pancakeTagOverride'); if (raw) overrideMap = JSON.parse(raw) || {}; } catch (e) {}

  var byPage = {}; // pageId -> { pageName, L1..L7:0, ... }
  var totals = {}; // L1..L7 tong toan he thong
  PK_STATUS_CODES_.forEach(function(c) { totals[c] = 0; });

  if (sh.getLastRow() >= 2) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, PK_TAG_STATS_HEADERS.length).getValues();
    for (var i = 0; i < v.length; i++) {
      var d = normOrderDate_(v[i][0]); // xem chu thich o savePancakeStats_
      if (from && d < from) continue;
      if (to && d > to) continue;
      var pageId = String(v[i][1]), pageName = String(v[i][2]), tagName = String(v[i][4]), count = +v[i][5] || 0;
      if (!count) continue;
      var cls = classifyPancakeTag_(tagName, overrideMap);
      if (cls.type !== 'status') continue; // chi quan tam nhom trang thai L1-L7... o day (nhom Sale da co bao cao rieng)
      // Ma moi (L9, L10...) tu dong duoc them cot khi gap — khong can sua PK_STATUS_CODES_/code moi lan co tag moi
      if (!byPage[pageId]) { byPage[pageId] = { pageId: pageId, pageName: pageName }; PK_STATUS_CODES_.forEach(function(c) { byPage[pageId][c] = 0; }); }
      if (byPage[pageId][cls.code] === undefined) byPage[pageId][cls.code] = 0;
      if (totals[cls.code] === undefined) totals[cls.code] = 0;
      byPage[pageId][cls.code] += count;
      totals[cls.code] += count;
    }
  }
  return { byPage: byPage, totals: totals };
}

// ═══════════════════════════════════════════════════════════════
//  BAO CAO KPI TONG HOP — ghep DT TONG (don hang/doanh thu that) + Bao cao Pancake
//  (tuong tac + SDT mang ve) + Bao cao Tag (L1-L7, tu sheet PancakeTagStats). Tra ve theo
//  Page va theo Sale; phe do tag L1-L7 (ca tung Page lan toan he thong) xem cong thuc o
//  ham _tagFunnelRates_ ngay phia tren.
// Tinh phe do chuyen doi L1->L7 tu 1 bo dem {L1,L2,...,L7} + mau so rieng.
// Cong thuc — DUNG THEO BANG CHUAN "Tag Pancake" (Duyen gui 20/09/2026, cot "Công thức đo lường"):
//   L1 = L1 / tongTT          (Chuan, dat 3 lan phan hoi — tren TONG so HT tuong tac)
//   L2 = L2 / sdtThuThap      (SDT Ket noi — tren TONG so SDT thu thap duoc)
//   L3 = L3 / tongTT          (KH Tiem nang — tren TONG so HT tuong tac, KHONG phai chia
//                               theo L2 nhu ban cu — da doi chieu lai voi bang chuan 20/09/2026)
//   L4 = L4 / tongTT          (Khao gia/KNC — tren TONG so HT tuong tac, cung ly do nhu L3)
//   L5 = realOrders / tongTT  (CHOT — theo yeu cau Duyen: KHONG lay theo tag L5/L4 nua, vi tag
//                               "Khảo giá"/"Chốt" nhieu khi CS gan tag khong day du/khong dung
//                               het lam ty le sai lech (vd L4=0 tag -> L5 luon ra 0% du co don
//                               that). Doi sang DUNG SO DON THAT tren DT TONG (dt.orders/
//                               totalDonHang, da co san o cho goi ham nay) chia cho Tong TT —
//                               giong het cong thuc "Tỷ lệ chốt" da dung o bang "Theo Page".
//   L6 = L6 / L5(tag)         (Huy — bang chuan khong ghi cong thuc, giu nguyen tu truoc: ty le
//                               huy trong so da chot-theo-tag, van dung tag vi khong co "so don
//                               huy that" doc lap de doi chieu)
//   L7 = L7 / tongTT          (rieng KV Ha Noi — tren TONG so HT tuong tac)
//   L8 = Upsale — bang chuan khong dinh nghia mau so ty le -> chi hien SO LUONG, khong tinh %.
function _tagFunnelRates_(counts, tongTT, sdtThuThap, realOrders) {
  var pct = function(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }; // 1 so le, %
  var c = counts || {};
  var l5Count = (realOrders !== undefined && realOrders !== null) ? realOrders : (c.L5 || 0);
  return {
    counts: { L1: c.L1||0, L2: c.L2||0, L3: c.L3||0, L4: c.L4||0, L5: l5Count, L6: c.L6||0, L7: c.L7||0, L8: c.L8||0 },
    rates: {
      L1: pct(c.L1, tongTT),
      L2: pct(c.L2, sdtThuThap),
      L3: pct(c.L3, tongTT),
      L4: pct(c.L4, tongTT),
      L5: pct(l5Count, tongTT),
      L6: pct(c.L6, c.L5), // van so voi L5 THEO TAG (c.L5, khong phai l5Count) — L6 la ty le huy trong so da chot-theo-tag
      L7: pct(c.L7, tongTT),
      L8: 0 // Upsale: chua co mau so ty le chuan -> chi hien so luong (counts.L8), client hien dau "—"
    }
  };
}

// Quet cot ngay (cot A) cua 1 sheet Pancake: dem so dong NAM TRONG khoang [from,to] va lay
// khoang ngay TOI DA dang co trong sheet. Dung de bao cho nguoi dung biet chinh xac vi sao
// bao cao ra 0: "chua nap du lieu bao gio" hay "co du lieu nhung khong thuoc khoang ngay dang chon".
function _pkSheetDateSpan_(shName, headers, from, to) {
  var out = { rows: 0, rowsInRange: 0, minDate: '', maxDate: '' };
  var sh = getSheet_(shName, headers);
  if (sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) {
    var d = normOrderDate_(v[i][0]);
    if (!d) continue;
    out.rows++;
    if (!out.minDate || d < out.minDate) out.minDate = d;
    if (!out.maxDate || d > out.maxDate) out.maxDate = d;
    if (from && d < from) continue;
    if (to && d > to) continue;
    out.rowsInRange++;
  }
  return out;
}

var SALE_DIR_HEADERS = ['maSale','tenFacebook','userBase','tenTagPancake'];

// Danh sach Sale chuan (sheet SaleDirectory). Nhom lay tu chu cai dau cua "Ten tag Pancake":
// S = Sale van phong (offline), O = Sale online. Tra ve map tra cuu theo CA 3 kieu ten hay gap
// (ten Facebook, user base, ten tag) de khop duoc du bao cao Pancake ghi ten kieu nao.
// Ghi de toan bo danh sach Sale chuan (dan tu file Excel "Danh sach Sale").
function saveSaleDirectory_(rows) {
  rows = rows || [];
  var sh = getSheet_(SH_SALE_DIR, SALE_DIR_HEADERS);
  sh.clearContents();
  var matrix = [SALE_DIR_HEADERS].concat(rows.map(function(r) {
    return [r.maSale || '', r.tenFacebook || '', r.userBase || '', r.tenTagPancake || ''];
  }));
  sh.getRange(1, 1, matrix.length, SALE_DIR_HEADERS.length).setValues(matrix);
  return jsonOut_({ ok: true, written: rows.length });
}

function readSaleDirectory_() {
  var sh = getSheet_(SH_SALE_DIR, SALE_DIR_HEADERS);
  var list = [], byName = {};
  if (sh.getLastRow() < 2) return { list: list, byName: byName };
  // Doc chung 1 nguon Van phong/Online voi Bao cao E/F ("🏷️ Phân loại Online/Offline", setting
  // 'saleChannels') THEO YEU CAU DUYEN 2026-09 (ap dung dong bo cho MOI bao cao, ke ca tai khoan
  // dang nhap qua _syncSaleChannelsToUsers_ trong setSetting_) — chi fallback ve tag Pancake S#/O#
  // cho Sale nao CHUA duoc phan loai qua modal do, tranh mat du lieu Nhom cua nhung Sale cu.
  var channels = {};
  try { var rawCh = getSetting_('saleChannels'); if (rawCh) { var oCh = JSON.parse(rawCh); if (oCh && typeof oCh === 'object') channels = oCh; } } catch (eCh) {}
  var groupDefs = readSaleGroups_();
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, SALE_DIR_HEADERS.length).getValues();
  for (var i = 0; i < v.length; i++) {
    var tag = String(v[i][3] || '').trim();
    // TV# = Sale thu viec (rieng, KHAC S#/O# chinh thuc) — nhan dien TRUOC S/O vi "TV" cung bat
    // dau bang chu T, tranh vo tinh khop nham voi mot bang chu cai khac sau nay.
    var mTV = tag.match(/^TV\s*(\d+)/i);
    var m = !mTV ? tag.match(/^([SO])\s*(\d+)/i) : null;
    if (!mTV && !m) continue; // dong khong co ma tag TV#/S#/O# -> khong phai Sale trong danh sach
    var tenFacebook = String(v[i][1] || '').trim(), userBase = String(v[i][2] || '').trim();
    var chVal = channels[tenFacebook] || channels[userBase] || channels[tag] || '';
    // Uu tien phan loai tu SALE_CHANNELS (nguon thong nhat moi bao cao, qua "🏷️ Phân loại đội
    // Sale"); neu Sale CHUA duoc phan loai thi fallback theo DUNG tien to ma tag: TV -> probation
    // (Thu viec), S -> offline (Van phong), O -> online.
    var groupKey = chVal || (mTV ? 'probation' : (m[1].toUpperCase() === 'S' ? 'offline' : 'online'));
    var rec = {
      maSale: String(v[i][0] || '').trim(),
      tenFacebook: tenFacebook,
      userBase: userBase,
      tenTagPancake: tag,
      code: mTV ? ('TV' + parseInt(mTV[1], 10)) : (m[1].toUpperCase() + parseInt(m[2], 10)),
      nhomKey: groupKey,
      nhom: _saleGroupLabel_(groupKey, groupDefs) || groupKey
    };
    list.push(rec);
    [rec.tenFacebook, rec.userBase, rec.tenTagPancake, rec.code].forEach(function(k) {
      if (k) byName[_normTxt_(k)] = rec;
    });
  }
  return { list: list, byName: byName };
}

// Xac dinh cac NGAY (trong khoang from-to) THUC SU co du lieu tuong tac Pancake (sheet
// PancakeStats) cho tung Page va tung Sale — dung de GIOI HAN dem don hang khi tinh
// "Ty le chot" (Don/Tong TT), tranh so sanh lech ngay (vd thang 30 ngay nhung Pancake moi
// nhap 10 ngay thi ty le phai tinh tren dung 10 ngay do, khong phai ca thang).
// Yeu cau Duyen 24/09/2026: "tỷ lệ chốt base sẽ chỉ tính trên những ngày có dữ liệu pancake...
// tương tự với sale, tỷ lệ chốt của sale cũng chỉ tính những ngày sale có báo cáo pancake".
function _pkTrackedDatesByPageAndSale_(from, to) {
  var datesByPage = {}, datesBySale = {};
  var v = _pkStatsRowsMemo_();
  if (!v.length) return { datesByPage: datesByPage, datesBySale: datesBySale };
  var mapPair = readPancakeMapCI_(), map = mapPair.map, mapCI = mapPair.mapCI;
  for (var i = 0; i < v.length; i++) {
    var d = normOrderDate_(v[i][0]);
    if (from && d < from) continue;
    if (to && d > to) continue;
    var pageId = String(v[i][1]);
    var nhanVien = String(v[i][3]);
    if (!datesByPage[pageId]) datesByPage[pageId] = {};
    datesByPage[pageId][d] = true;
    var rawMap = map[nhanVien]; if (rawMap === undefined) rawMap = mapCI[_normTxt_(nhanVien)];
    var sales = String(rawMap || '').split('|').map(function(x){ return x.trim(); }).filter(function(x){ return x; });
    if (!sales.length) sales = [nhanVien]; // chua khop ten -> giu ten Pancake nhu cac cho khac
    for (var si = 0; si < sales.length; si++) {
      var sN = sales[si];
      if (!datesBySale[sN]) datesBySale[sN] = {};
      datesBySale[sN][d] = true;
    }
  }
  return { datesByPage: datesByPage, datesBySale: datesBySale };
}
// Cong so don/doanh thu cua 1 kenh/sale, CHI trong dung tap ngay duoc chi dinh (datesSet).
function _sumOrdersOnDates_(byKeyDateMap, key, datesSet) {
  var o = 0, rev = 0;
  var byDate = byKeyDateMap[key] || {};
  Object.keys(datesSet || {}).forEach(function(d) {
    if (byDate[d]) { o += byDate[d].orders; rev += byDate[d].revenue; }
  });
  return { orders: o, revenue: rev };
}

function buildKpiReport_(from, to, saleFilter) {
  var saleFilterArr = Array.isArray(saleFilter) ? saleFilter.filter(function(s){return s;}) : [];
  // Thieu khoang ngay -> KHONG im lang tinh toan bo lich su (so don/doanh thu ca nam ghep voi
  // tuong tac ca nam cho ra ty le vo nghia). Mac dinh 7 ngay gan nhat va bao ro cho giao dien.
  var warnings = [];
  // KHONG dung Session.getScriptTimeZone() de tinh "hom nay" — neu cau hinh Time Zone cua du an
  // Apps Script khong phai gio VN (vd bi de mac dinh khac), "hom nay" se tinh sai ngay. Dung
  // thang offset co dinh +7 (_vnYmd_) — chac chan dung du du an cau hinh Time Zone la gi.
  if (!from || !to) {
    var now = new Date();
    if (!to)   to   = _vnYmd_(now);
    if (!from) from = _vnYmd_(new Date(now.getTime() - 6 * 86400000));
    warnings.push('Chưa chọn đủ khoảng ngày — đang tạm tính cho 7 ngày gần nhất (' + from + ' → ' + to + ').');
  }
  if (from && to && from > to) {
    warnings.push('Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ') nên không có dữ liệu nào lọt vào. Hãy đổi lại 2 ô ngày.');
  }

  // 1) DT TONG: gom doanh thu/so don theo Page (kenhBan) va theo Sale (saleBan, co the nhieu
  // Sale/don, cach lam giong het buildSalesReportA_: so don KHONG chia, tien CHIA DEU cho N Sale)
  //
  // LUU Y quan trong ve moc ngay dung de loc: bao cao nay PHAI khop voi "Report Page" cua
  // chinh Base (widget bao cao co san tren workflow "ĐƠN CÁC KÊNH") va voi file Base xuat ra
  // (Export -> "Ngày tạo"), vi CS doi chieu 2 ben voi nhau. Ca 2 cho do deu gom don theo
  // NGAY TAO don (Ngay tao), KHONG theo ngay hoan thanh. Truoc day cho nay dung o.date, ma
  // o.date lai UU TIEN "Thoi gian hoan thanh" (xem dtRowToOrder_) — nen 1 don duoc TAO tu
  // hom truoc nhung moi duoc CHUYEN GIAI DOAN/hoan thanh vao dung ngay dang xem se bi tinh
  // GOP THEM vao ngay do, lam doanh thu bao cao nay CAO HON han so voi Base that (da gap:
  // vi du ngay 19/09/2026 Base tinh 222.327.000d nhung bao cao nay ra toi 244.572.000d).
  // Sua: dung dung o.orderDate (= cot "Ngày tạo" that su, khong doi theo trang thai) cho
  // rieng bao cao KPI nay. Cac bao cao doanh so A/B/C khac VAN giu nguyen o.date nhu cu,
  // khong dong cham toi (do la quyet dinh rieng, xem chu thich o dtRowToOrder_ dong ~994).
  var orders = readAllOrders_();
  var byPageOrders = {}, bySaleOrders = {};
  // MOI: gom them theo (kenh|sale) x NGAY — dung rieng cho tu so "Ty le chot", de chi cong don
  // trong dung nhung ngay Page/Sale do THUC SU co du lieu tuong tac Pancake (xem
  // _pkTrackedDatesByPageAndSale_). "donHang"/"doanhThu"/"trungBinhDon" hien thi tren bang
  // VAN giu nguyen tinh tren CA khoang ngay nhu truoc (khong doi theo yeu cau Duyen).
  var ordersByKenhDate = {}, ordersBySaleDate = {};
  var ordersDetail = []; // danh sach tung don khop khoang ngay -> xuat Excel de doi chieu tay voi Base
  // Kenh nay KHONG co du lieu tren Pancake (khong xuat hien trong file "Thong ke tuong tac" /
  // "Thong ke nhan vien" ma Duyen nap vao) nen mau so "tongTT" cua Sale phu trach kenh nay
  // KHONG he tang len du don van ve. Neu van cong don cua kenh nay vao tu so (donHang) thi
  // "Ty le chot" bi thoi phong ao (tu so tang, mau so dung yen). Quy uoc: loai don cua kenh
  // nay khoi CA so don LAN doanh thu dung de tinh bySale/tyLeChot (khong dung lam mau so ty
  // le chua co du lieu doi chieu). Bang theo Page (byPage) khong bi anh huong gi vi von di
  // da chi liet ke cac Page CO trong Pancake (xem pageInfo o duoi), khong lien quan kenh nay.
  var KPI_TYLECHOT_EXCLUDED_KENH_ = 'Fb Phạm Thu Hiền';
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var d = parseVNDate_(o.orderDate);
    if (!d) continue;
    if (!dateInRange_(d, from, to)) continue;
    // SUA 2026-10-03: thieu dieu kien loai don Huy/Da hoan/Dang hoan (_isExcludedOrderStatus_)
    // nhu buildSalesReportA_/C da lam — khien "Báo cáo ngày" (tab Daily brief) cong CA doanh
    // thu cua don da huy/hoan vao kpi.totalDoanhThu va bySale/byPage, cao hon han so voi Bao
    // cao A that (Duyen bao "doanh thu Base dang bi gap doi" — don Huy/Hoan o cua hang nay rat
    // nhieu nen doanh thu gop gan gap doi doanh thu that da tru hoan/huy).
    if (_isExcludedOrderStatus_(o.status)) continue;
    // Loc theo pham vi Sale (CS thuong: chi don cua chinh minh; Leader: don cua ca team) —
    // ap dung TU PHIA SERVER, khong chi an bot o giao dien, de khong the xem duoc doanh thu
    // cua nguoi khac du co sua duoc request phia client.
    if (saleFilterArr.length) {
      var salesOnOrderKpi = splitMulti_(o.cs, ',');
      if (!salesOnOrderKpi.some(function(s){ return saleFilterArr.indexOf(s) !== -1; })) continue;
    }
    var page = o.source || '(chưa có kênh)';
    var dKeyOrder = normOrderDate_(o.orderDate);
    if (!byPageOrders[page]) byPageOrders[page] = { orders: 0, revenue: 0 };
    byPageOrders[page].orders += 1;
    byPageOrders[page].revenue += Number(o.revenue) || 0;
    if (!ordersByKenhDate[page]) ordersByKenhDate[page] = {};
    if (!ordersByKenhDate[page][dKeyOrder]) ordersByKenhDate[page][dKeyOrder] = { orders: 0, revenue: 0 };
    ordersByKenhDate[page][dKeyOrder].orders += 1;
    ordersByKenhDate[page][dKeyOrder].revenue += Number(o.revenue) || 0;
    ordersDetail.push({
      id: o.id || '', ngayTao: normOrderDate_(o.orderDate), kenhBan: page,
      sale: o.cs || '', giaTriDon: Number(o.revenue) || 0, sanPham: o.product || '', phone: o.phone || ''
    });

    if (_normTxt_(page) === _normTxt_(KPI_TYLECHOT_EXCLUDED_KENH_)) continue; // bo qua kenh khong co tren Pancake — khong tinh vao bySale/tyLeChot

    var salesList = splitMulti_(o.cs, ',');
    if (!salesList.length) salesList = ['(chưa gán sale)'];
    var w = 1 / salesList.length;
    for (var si = 0; si < salesList.length; si++) {
      var sName = salesList[si];
      if (!bySaleOrders[sName]) bySaleOrders[sName] = { orders: 0, revenue: 0 };
      bySaleOrders[sName].orders += 1; // so don: khong chia
      bySaleOrders[sName].revenue += (Number(o.revenue) || 0) * w; // tien: chia deu
      if (!ordersBySaleDate[sName]) ordersBySaleDate[sName] = {};
      if (!ordersBySaleDate[sName][dKeyOrder]) ordersBySaleDate[sName][dKeyOrder] = { orders: 0, revenue: 0 };
      ordersBySaleDate[sName][dKeyOrder].orders += 1;
      ordersBySaleDate[sName][dKeyOrder].revenue += (Number(o.revenue) || 0) * w;
    }
  }
  var _trackedDates = _pkTrackedDatesByPageAndSale_(from, to);
  var datesByPage = _trackedDates.datesByPage, datesBySale = _trackedDates.datesBySale;

  // 2) Bao cao Pancake (tuong tac + SDT) — dung lai 2 ham da co, split='equal'
  var pInt = buildPancakeReport_(from, to, 'equal');
  var pSdt = buildPancakeSdtReport_(from, to, 'equal');
  var pageMap = readPancakePageMap_(); // pageId -> kenhBan
  var pTag = buildPancakeTagReport_(from, to); // tong hop tag L1-L7 theo Page (tu sheet PancakeTagStats)

  // 3) Ghep theo Page: hop cac pageId tung xuat hien o ca 2 bao cao Pancake
  var pageInfo = {}; // pageId -> {pageName}
  pInt.byPage.forEach(function(r) { pageInfo[r.pageId] = { pageName: r.pageName, tongTT: r.tongTT, tongDH_pancake: r.tongDH }; });
  pSdt.byPage.forEach(function(r) {
    if (!pageInfo[r.pageId]) pageInfo[r.pageId] = { pageName: r.pageName, tongTT: 0, tongDH_pancake: 0 };
    pageInfo[r.pageId].sdtMangVe = r.sdtMangVe;
  });
  var byPage = Object.keys(pageInfo).map(function(pid) {
    var info = pageInfo[pid];
    var kenhBan = pageMap[pid] || '';
    var dt = kenhBan && byPageOrders[kenhBan] ? byPageOrders[kenhBan] : { orders: 0, revenue: 0 };
    // Ty le chot: CHI dem don trong dung nhung ngay Page nay THUC SU co du lieu tuong tac
    // Pancake (datesByPage[pid]) — khong dung ca khoang ngay nhu donHang/doanhThu hien thi.
    var trackedDatesPage = datesByPage[pid] || {};
    var dtRate = kenhBan ? _sumOrdersOnDates_(ordersByKenhDate, kenhBan, trackedDatesPage) : { orders: 0, revenue: 0 };
    var tongTT = info.tongTT || 0;
    var sdtMangVe = info.sdtMangVe || 0;
    var tagInfo = pTag.byPage[pid];
    var tagFunnel = _tagFunnelRates_(tagInfo || {}, tongTT, sdtMangVe, dt.orders);
    return {
      pageId: pid, pageName: info.pageName || pid, kenhBan: kenhBan,
      mapped: !!kenhBan,
      tongTT: tongTT, sdtMangVe: sdtMangVe,
      donHang: dt.orders, doanhThu: dt.revenue, // giu nguyen tren CA khoang ngay (khong doi)
      donHangForRate: dtRate.orders, // chi dung noi bo cho tu so Ty le chot (cascade sang MKT/tong)
      tyLeChot: tongTT ? Math.round(dtRate.orders / tongTT * 1000) / 10 : 0, // % — CHI tinh tren ngay co Pancake
      trungBinhDon: dt.orders ? Math.round(dt.revenue / dt.orders) : 0,
      tag: tagFunnel // { counts:{L1..L7}, rates:{L1..L7} } — xem cong thuc o _tagFunnelRates_
    };
  });
  byPage.sort(function(a, b) { return b.tongTT - a.tongTT; });

  // 4) Ghep theo Sale: pInt.byCS da o dang ten Sale chuan (qua PancakeNameMap) -> khop thang
  // voi bySaleOrders (cung la ten Sale chuan tu cot saleBan DT TONG).
  // Gop tu CA 2 bao cao: mot Sale chi co trong file "Thong ke nhan vien" (SDT) ma khong co
  // trong file "Thong ke tuong tac" truoc day bi mat hut khoi bang nay.
  var saleAgg = {}, saleCanon = {}; // ci-key -> ten hien thi dau tien gap (gop bien the hoa/thuong giua 2 file)
  function _saleKey(name) {
    var ck = _normTxt_(name);
    if (!saleCanon[ck]) saleCanon[ck] = name;
    return ck;
  }
  pInt.byCS.forEach(function(r) {
    var k = _saleKey(r.name);
    saleAgg[k] = { name: saleCanon[k], mapped: r.mapped, tongTT: r.tongTT || 0, sdtMangVe: 0 };
  });
  pSdt.byCS.forEach(function(r) {
    var k = _saleKey(r.name);
    if (!saleAgg[k]) saleAgg[k] = { name: saleCanon[k], mapped: r.mapped, tongTT: 0, sdtMangVe: 0 };
    saleAgg[k].sdtMangVe = r.sdtMangVe || 0;
    if (r.mapped) saleAgg[k].mapped = true;
  });
  var bySale = Object.keys(saleAgg).map(function(k) {
    var r = saleAgg[k];
    var dt = bySaleOrders[r.name] || { orders: 0, revenue: 0 };
    var trackedDatesSale = datesBySale[r.name] || {};
    var dtRateSale = _sumOrdersOnDates_(ordersBySaleDate, r.name, trackedDatesSale);
    return {
      name: r.name, mapped: r.mapped,
      tongTT: r.tongTT, sdtMangVe: r.sdtMangVe,
      donHang: dt.orders, doanhThu: Math.round(dt.revenue), // giu nguyen tren ca khoang ngay
      donHangForRate: dtRateSale.orders, // chi dung noi bo cho tu so Ty le chot (cascade sang saleGroups)
      trungBinhDon: dt.orders ? Math.round(dt.revenue / dt.orders) : 0,
      tyLeChot: r.tongTT ? Math.round(dtRateSale.orders / r.tongTT * 1000) / 10 : 0 // CHI tinh tren ngay Sale co Pancake
    };
  });
  // Gan nhom Van phong (S) / Online (O) theo danh sach Sale chuan o sheet SaleDirectory.
  var saleDir = readSaleDirectory_();
  bySale.forEach(function(r) {
    var rec = saleDir.byName[_normTxt_(r.name)];
    r.nhom = rec ? rec.nhom : '';
    r.maSale = rec ? rec.code : '';
    r.inDirectory = !!rec;
  });
  bySale.sort(function(a, b) {
    // Thu tu nhom: Van phong (S) -> Online (O) -> ngoai danh sach, dung theo yeu cau; trong
    // tung nhom sap theo Ty le chot (tyLeChot) giam dan — Sale chot tot nhat len dau.
    var rank = { 'Văn phòng': 0, 'Online': 1, 'Thử việc': 2 };
    var ra = rank.hasOwnProperty(a.nhom) ? rank[a.nhom] : 3;
    var rb = rank.hasOwnProperty(b.nhom) ? rank[b.nhom] : 3;
    if (ra !== rb) return ra - rb;
    return b.tyLeChot - a.tyLeChot;
  });

  // Tong theo nhom: don KHONG chia (1 don co the co nhieu Sale) nen chi cong doanh thu da chia
  // deu o tren -> cong lai theo nhom van dung tong the.
  var byGroup = {};
  ['Văn phòng', 'Online', 'Thử việc', ''].forEach(function(g) {
    byGroup[g || '(ngoài danh sách)'] = { nhom: g || '(ngoài danh sách)', soSale: 0, tongTT: 0, sdtMangVe: 0, donHang: 0, doanhThu: 0, donHangForRate: 0 };
  });
  bySale.forEach(function(r) {
    var g = byGroup[r.nhom || '(ngoài danh sách)'];
    g.soSale++; g.tongTT += r.tongTT; g.sdtMangVe += r.sdtMangVe;
    g.donHang += r.donHang; g.doanhThu += r.doanhThu; g.donHangForRate += r.donHangForRate;
  });
  var saleGroups = Object.keys(byGroup).map(function(k) { return byGroup[k]; })
    .filter(function(g) { return g.soSale > 0; });
  saleGroups.forEach(function(g) {
    g.tyLeChot = g.tongTT ? Math.round(g.donHangForRate / g.tongTT * 1000) / 10 : 0;
    g.trungBinhDon = g.donHang ? Math.round(g.doanhThu / g.donHang) : 0;
  });

  var totalTongTT = byPage.reduce(function(s, r) { return s + r.tongTT; }, 0);
  var totalSdtMangVe = byPage.reduce(function(s, r) { return s + r.sdtMangVe; }, 0);

  // Theo MKT: gom cac dong Page theo MktTeams (page chay chung -> chia theo ty le 'share').
  // Don/doanh thu cua 1 Kenh chi tinh 1 lan (cho dong Page dau tien tro ve kenh do) de khong nhan doi.
  var mktTeamsK = readMktTeams_();
  var pwK = _mktPageWeights_(mktTeamsK);
  var mktAgg = {};
  mktTeamsK.forEach(function(t) { mktAgg[t.id] = { id: t.id, name: t.name, color: t.color, pages: [], tongTT: 0, sdtMangVe: 0, donHang: 0, doanhThu: 0, donHangForRate: 0 }; });
  var seenKenhM = {};
  byPage.forEach(function(r) {
    var ws = pwK[r.pageId] || [{ id: '_none', name: '(chưa gán MKT)', w: 1 }];
    var countKenh = r.mapped && !seenKenhM[r.kenhBan];
    if (r.mapped) seenKenhM[r.kenhBan] = true;
    ws.forEach(function(x) {
      if (!mktAgg[x.id]) mktAgg[x.id] = { id: x.id, name: x.name, color: '', pages: [], tongTT: 0, sdtMangVe: 0, donHang: 0, doanhThu: 0, donHangForRate: 0 };
      var g = mktAgg[x.id];
      g.pages.push(r.pageName + (x.w < 1 ? ' (' + Math.round(x.w * 100) + '%)' : ''));
      g.tongTT += r.tongTT * x.w; g.sdtMangVe += r.sdtMangVe * x.w;
      if (countKenh) { g.donHang += r.donHang * x.w; g.doanhThu += r.doanhThu * x.w; g.donHangForRate += r.donHangForRate * x.w; }
    });
  });
  var byMkt = Object.keys(mktAgg).map(function(k) {
    var g = mktAgg[k];
    g.tongTT = Math.round(g.tongTT * 100) / 100; g.sdtMangVe = Math.round(g.sdtMangVe * 100) / 100;
    g.tyLeChot = g.tongTT ? Math.round(g.donHangForRate / g.tongTT * 1000) / 10 : 0; // CHI tinh tren ngay co Pancake (theo tung page cong lai)
    g.trungBinhDon = g.donHang ? Math.round(g.doanhThu / g.donHang) : 0;
    g.donHang = Math.round(g.donHang * 100) / 100; g.doanhThu = Math.round(g.doanhThu);
    delete g.donHangForRate;
    return g;
  }).filter(function(g) { return g.id !== '_none' || g.pages.length; })
    .sort(function(a, b) { return b.doanhThu - a.doanhThu; });

  // Don/doanh thu: cong theo KENH BAN DUY NHAT, khong cong theo dong Page. Neu 2 Page cung tro
  // ve 1 Kenh ban thi moi dong Page deu hien tron so cua kenh do (dung khi xem tung dong),
  // nhung cong lai se bi nhan doi -> tong phai gom theo kenh.
  var seenKenh = {}, dupKenh = {};
  var totalDonHang = 0, totalDoanhThu = 0, totalDonHangForRate = 0;
  byPage.forEach(function(r) {
    if (!r.mapped) return;
    if (seenKenh[r.kenhBan]) { dupKenh[r.kenhBan] = true; return; }
    seenKenh[r.kenhBan] = true;
    totalDonHang += r.donHang; totalDoanhThu += r.doanhThu; totalDonHangForRate += r.donHangForRate;
  });
  var duplicateChannels = Object.keys(dupKenh);
  if (duplicateChannels.length) {
    warnings.push('Có nhiều Page cùng khớp về 1 Kênh bán (' + duplicateChannels.join(', ') +
      '). Mỗi dòng Page bên dưới hiển thị trọn số đơn/doanh thu của kênh đó, nên cộng các dòng lại sẽ ra nhiều hơn tổng thật — tổng phía trên đã gom theo kênh nên không bị nhân đôi.');
  }
  var unmappedPages = byPage.filter(function(r) { return !r.mapped; }).map(function(r) { return { pageId: r.pageId, pageName: r.pageName }; });
  var unmappedSales = bySale.filter(function(r) { return !r.mapped; }).map(function(r) { return r.name; });

  // Chan doan nguon du lieu: bao ro "chua nap bao gio" vs "co du lieu nhung ngoai khoang ngay".
  var dataAvail = {
    tuongTac: _pkSheetDateSpan_(SH_PK_STATS, PK_STATS_HEADERS, from, to),
    sdt:      _pkSheetDateSpan_(SH_PK_SDT,   PK_SDT_STATS_HEADERS, from, to),
    tag:      _pkSheetDateSpan_(SH_PK_TAG,   PK_TAG_STATS_HEADERS, from, to)
  };
  var LBL_ = { tuongTac: 'Thống kê tương tác', sdt: 'Thống kê nhân viên (SĐT)', tag: 'Thống kê tag' };
  Object.keys(dataAvail).forEach(function(k) {
    var a = dataAvail[k];
    if (a.rows === 0) {
      warnings.push('Chưa có dữ liệu "' + LBL_[k] + '" nào trên CRM — vào tab "📥 Báo cáo Pancake", nạp file rồi bấm "💾 Lưu lên CRM".');
    } else if (a.rowsInRange === 0) {
      warnings.push('Không có dòng "' + LBL_[k] + '" nào trong khoảng ngày đang chọn (dữ liệu hiện có từ ' + a.minDate + ' đến ' + a.maxDate + ').');
    }
  });
  // Phe do L1-L7 toan he thong: dung tong tag da gom san o buildPancakeTagReport_ (pTag.totals),
  // mau so tongTT/sdtMangVe la tong cong tat ca Page trong ky (khong phai cong ty le tung Page).
  var tagFunnelTotal = _tagFunnelRates_(pTag.totals, totalTongTT, totalSdtMangVe, totalDonHang);

  return {
    byPage: byPage, bySale: bySale, byMkt: byMkt,
    totalTongTT: totalTongTT, totalDonHang: totalDonHang, totalDoanhThu: totalDoanhThu, totalSdtMangVe: totalSdtMangVe,
    tyLeChotChung: totalTongTT ? Math.round(totalDonHangForRate / totalTongTT * 1000) / 10 : 0, // CHI tinh tren ngay co Pancake (xem donHangForRate)
    tagFunnelTotal: tagFunnelTotal,
    unmappedPages: unmappedPages,
    unmappedSales: unmappedSales,
    saleGroups: saleGroups,
    saleDirectoryCount: saleDir.list.length,
    duplicateChannels: duplicateChannels,
    dataAvail: dataAvail,
    ordersDetail: ordersDetail, // danh sach tung don DT TONG khop khoang ngay -> doi chieu voi Base
    from: from, to: to,
    warnings: warnings
  };
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
                 JSON.stringify(namesArr),
                 (Array.isArray(u.perms) ? JSON.stringify(u.perms) : ''),
                 u.saleType||'', u.startDate||'']);
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
  // Gop cac dong cung id (dot chia lon bi tach nhieu dong theo cot 'part' — xem assignRowsOf_)
  var byId = {}, order = [];
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    var id = String(vals[i][0]);
    var phones = [], donePhones = [];
    try { phones = JSON.parse(vals[i][4]||'[]'); } catch(e) { phones = []; }
    try { donePhones = JSON.parse(vals[i][5]||'[]'); } catch(e) { donePhones = []; }
    if (!byId[id]) {
      byId[id] = { id: id, date: String(vals[i][1]||''), csName: String(vals[i][2]||''),
                   label: String(vals[i][3]||''), parts: [] };
      order.push(id);
    }
    byId[id].parts.push({ part: Number(vals[i][6]) || 0, phones: phones, donePhones: donePhones });
  }
  for (var k = 0; k < order.length; k++) {
    var e = byId[order[k]];
    e.parts.sort(function(a, b) { return a.part - b.part; });
    var ph = [], dn = [];
    for (var p = 0; p < e.parts.length; p++) { ph = ph.concat(e.parts[p].phones); dn = dn.concat(e.parts[p].donePhones); }
    out.push({ id: e.id, date: e.date, csName: e.csName, label: e.label, phones: ph, donePhones: dn });
  }
  return out;
}

// 1 dot chia -> 1..n dong (moi dong <= ASSIGN_CHUNK SDT) de khong vuot 50.000 ky tu/o cua Google Sheets.
function assignRowsOf_(h) {
  var phones = h.phones || [], done = h.donePhones || [];
  var n = Math.max(1, Math.ceil(phones.length / ASSIGN_CHUNK), Math.ceil(done.length / ASSIGN_CHUNK));
  var rows = [];
  for (var k = 0; k < n; k++) {
    rows.push([h.id||'', h.date||'', h.csName||'', h.label||'',
               JSON.stringify(phones.slice(k * ASSIGN_CHUNK, (k + 1) * ASSIGN_CHUNK)),
               JSON.stringify(done.slice(k * ASSIGN_CHUNK, (k + 1) * ASSIGN_CHUNK)), k]);
  }
  return rows;
}

function saveAssignEntry_(entry) {
  if (!entry || !entry.id) return jsonOut_({ error: 'no entry.id' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  var last = sh.getLastRow(); var found = [];
  if (last >= 2) {
    var cells = sh.getRange(2, 1, last-1, 1).createTextFinder(String(entry.id)).matchEntireCell(true).findAll();
    for (var c = 0; c < cells.length; c++) found.push(cells[c].getRow());
    found.sort(function(a, b) { return a - b; });
  }
  var rows = assignRowsOf_(entry);
  if (found.length === rows.length) {
    // cung so dong (vd chi cap nhat donePhones): ghi de tai cho, giu nguyen vi tri
    for (var k = 0; k < rows.length; k++) sh.getRange(found[k], 1, 1, ASSIGN_HEADERS.length).setValues([rows[k]]);
  } else {
    for (var d = found.length - 1; d >= 0; d--) sh.deleteRow(found[d]);   // xoa tu duoi len de khong lech chi so
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, ASSIGN_HEADERS.length).setValues(rows);
  }
  return jsonOut_({ ok: true, rows: rows.length });
}

// Danh dau 1 SDT la "da goi xong"/"chua goi" trong TAT CA cac dot chia cua dung 1 CS — dung cho
// Pancake AI (muc "Data duoc chia", xem renderAssignTab_/toggleAssignPhoneDone_ trong
// pancake-content.js) de CS tich xong ngay tai Pancake, khong can mo CRM. CHI ghi de dung (cac)
// dong cua (cac) dot chia bi doi qua saveAssignEntry_ (an toan hon saveAssignHistory_ — khong xoa
// trang roi ghi lai CA sheet, tranh dam vao CS khac dang luu cung luc). Dung LockService vi 1 CS co
// the tich lien tuc nhieu SDT gan nhau (2 request ghi cung 1 dot chia de dam vao nhau neu khong khoa).
function toggleAssignDone_(csName, phone, done) {
  csName = String(csName || '').trim();
  phone = String(phone || '').trim();
  if (!csName || !phone) return jsonOut_({ error: 'Thiếu csName hoặc phone.' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonOut_({ error: 'Đang có thao tác khác ghi dữ liệu chia, thử lại sau vài giây.' });
  try {
    var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
    var history = readAssign_(sh);
    var touched = [];
    for (var i = 0; i < history.length; i++) {
      var h = history[i];
      if (h.csName !== csName || (h.phones || []).indexOf(phone) === -1) continue;
      h.donePhones = h.donePhones || [];
      var idx = h.donePhones.indexOf(phone);
      if (done && idx === -1) { h.donePhones.push(phone); touched.push(h); }
      else if (!done && idx !== -1) { h.donePhones.splice(idx, 1); touched.push(h); }
    }
    for (var k = 0; k < touched.length; k++) saveAssignEntry_(touched[k]); // ghi tung dot bi doi, giu nguyen cac dot khac
    return jsonOut_({ ok: true, changed: touched.length });
  } finally {
    lock.releaseLock();
  }
}

function saveAssignHistory_(history) {
  if (!history) return jsonOut_({ error: 'no history' });
  var sh = getSheet_(SH_ASSIGN, ASSIGN_HEADERS);
  // DUNG MA TRAN TRUOC, chi clearContents() khi da san sang ghi — truoc day clear xong moi stringify, neu setValues loi
  // (o > 50.000 ky tu) thi sheet bi xoa trang va MAT lich su chia tren server.
  var matrix = [ASSIGN_HEADERS];
  for (var i = 0; i < history.length; i++) {
    var rs = assignRowsOf_(history[i]);
    for (var r = 0; r < rs.length; r++) matrix.push(rs[r]);
  }
  sh.clearContents();
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

// ─── XAC THUC TAI KHOAN (dung cho Pancake AI khi CS doi sang ten nguoi khac) ───────────
// Cung thuat toan voi _hashPass trong index.html: SHA-256(salt + matkhau) dang hex, salt moi
// 'CRM-CS-Portal::v9::salt' (co salt cu 'OME-...' de khong khoa tai khoan chua nang cap).
// Kiem tra o SERVER de extension khong can tai passHash ve may. Chong do mat khau: sai 5 lan
// trong 10 phut thi khoa tam tai khoan do (CacheService).
var _PW_SALT_ = 'CRM-CS-Portal::v9::salt';
var _PW_SALT_OLD_ = 'OME-CS-Portal::v9::salt';
function _pwHash_(pw, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + String(pw == null ? '' : pw), Utilities.Charset.UTF_8);
  return bytes.map(function(b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}
function verifyLogin_(username, password) {
  var uname = String(username || '').trim().toLowerCase();
  if (!uname || !password) return jsonOut_({ ok: false, error: 'Nhập đủ tài khoản và mật khẩu.' });
  var cache = CacheService.getScriptCache();
  var failKey = 'vlfail_' + uname.replace(/[^a-z0-9]/g, '_').slice(0, 80);
  var fails = parseInt(cache.get(failKey) || '0', 10) || 0;
  if (fails >= 5) return jsonOut_({ ok: false, error: 'Sai quá nhiều lần — thử lại sau 10 phút.' });
  var users = readUsers_(getCrmSS_().getSheetByName(SH_USER));
  var acct = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username || '').trim().toLowerCase() === uname) { acct = users[i]; break; }
  }
  var okPw = false;
  if (acct && acct.passHash) {
    okPw = (_pwHash_(password, _PW_SALT_) === acct.passHash) || (_pwHash_(password, _PW_SALT_OLD_) === acct.passHash);
  }
  if (!acct || !okPw) {
    cache.put(failKey, String(fails + 1), 600);
    return jsonOut_({ ok: false, error: 'Sai tài khoản hoặc mật khẩu.' });
  }
  if (acct.active === false) return jsonOut_({ ok: false, error: 'Tài khoản đã bị khoá. Liên hệ quản trị viên.' });
  cache.remove(failKey);
  return jsonOut_({ ok: true, username: acct.username, role: acct.role || 'cs', name: acct.name || '' });
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
//  AI PHAN TICH TOAN TEAM (v13.23) — action GET teamAnalysis
//  Gom so lieu tung nguoi tu CAC BAO CAO DA CO (KPI Sale / Pancake KPI / don that bai / CS them KH moi),
//  CHAM DIEM + XEP LOAI bang quy tac CO DINH (on dinh, giai thich duoc) roi nho AI viet nhan xet. AI loi/thieu key van ra bang
//  day du (nhan xet dung quy tac). Khong gui SDT khach cho AI — chi gui ten nhan vien + chi so tong hop.
//  Chi admin/leader dung duoc (client an menu; tai khoan test khong nam trong DEMO_ALLOWED_GET_).
// ═══════════════════════════════════════════════════════════════
function _taNum_(v) { v = Number(v); return isFinite(v) ? v : 0; }
function _taClamp_(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function _taMedian_(arr) {
  var a = arr.slice().sort(function(x, y) { return x - y; });
  if (!a.length) return 0;
  var m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function buildTeamMetrics_(from, to) {
  var warnings = [], people = {};
  function P(name) {
    var k = _normTxt_(name); if (!k) return null;
    if (!people[k]) people[k] = { name: String(name).trim(), nhom: '', tier: '', revenue: 0, orders: 0, target: 0, pct: null, commit: 0, pctCommit: null,
      tongTT: 0, sdtMangVe: 0, tyLeChot: null, failedOrders: 0, careLeads: 0, deptKey: '', dept: '' };
    return people[k];
  }
  try {
    var k1 = buildSaleKpiReport_({ dateFrom: from, dateTo: to, dateField: 'ngayTao', sale: [], kenh: [], sanPham: '', byCreator: false });
    (k1.rows || []).forEach(function(r) {
      var p = P(r.name); if (!p) return;
      p.nhom = r.nhomChung || r.nhom || ''; p.tier = r.tier || '';
      p.deptKey = r.nhomChungKey || ''; p.dept = r.nhomChung || '';
      p.revenue = _taNum_(r.revenue); p.orders = _taNum_(r.orders);
      p.target = _taNum_(r.target); p.pct = (r.pct === null || r.pct === undefined) ? null : _taNum_(r.pct);
      p.commit = _taNum_(r.commit); p.pctCommit = (r.pctCommit === null || r.pctCommit === undefined) ? null : _taNum_(r.pctCommit);
    });
  } catch (e1) { warnings.push('Không đọc được KPI Sale: ' + e1.message); }
  try {
    var k2 = buildKpiReport_(from, to, []);
    (k2.bySale || []).forEach(function(r) {
      var p = P(r.name); if (!p) return;
      p.tongTT = _taNum_(r.tongTT); p.sdtMangVe = _taNum_(r.sdtMangVe);
      p.tyLeChot = p.tongTT ? _taNum_(r.tyLeChot) : null;
      if (!p.orders && r.donHang) { p.orders = _taNum_(r.donHang); p.revenue = _taNum_(r.doanhThu); }
    });
  } catch (e2) { warnings.push('Không đọc được KPI Pancake: ' + e2.message); }
  try {
    var k3 = buildFailedOrderReport_({ dateFrom: from, dateTo: to, sale: [], nguon: [], marketer: [], sanPham: '' });
    (k3.bySale || []).forEach(function(r) { var p = P(r.name); if (p) p.failedOrders = _taNum_(r.orders); });
  } catch (e3) { warnings.push('Không đọc được báo cáo đơn thất bại: ' + e3.message); }
  try {
    var k4 = buildCareLeadReport_({ dateFrom: from, dateTo: to, cs: [] });
    (k4.byCS || []).forEach(function(r) { var p = P(r.name); if (p) p.careLeads = _taNum_(r.count); });
  } catch (e4) { warnings.push('Không đọc được báo cáo CS thêm KH: ' + e4.message); }
  return { list: Object.keys(people).map(function(k) { return people[k]; }), warnings: warnings };
}
// Cham diem 0-100 + xep loai. Diem = trung binh co trong so cua cac thanh phan CO DU LIEU (khong phat nguoi thieu 1 nguon so lieu).
function scoreTeam_(list) {
  var act = list.filter(function(p) { return p.orders > 0 || p.tongTT > 0 || p.failedOrders > 0 || p.careLeads > 0 || p.revenue > 0; });
  var closeVals = act.filter(function(p) { return p.tongTT >= 10 && p.tyLeChot !== null; }).map(function(p) { return p.tyLeChot; });
  var medClose = _taMedian_(closeVals);
  var totOrders = 0, totFailed = 0, totRev = 0;
  act.forEach(function(p) { totOrders += p.orders; totFailed += p.failedOrders; totRev += p.revenue; });
  var teamFail = (totOrders + totFailed) ? totFailed / (totOrders + totFailed) : 0;
  var byRev = act.slice().sort(function(a, b) { return b.revenue - a.revenue; });
  byRev.forEach(function(p, i) { p._revPct = byRev.length > 1 ? (byRev.length - 1 - i) / (byRev.length - 1) * 100 : 100; });
  act.forEach(function(p) {
    var comps = [], strengths = [], issues = [];
    p.failRate = (p.orders + p.failedOrders) ? p.failedOrders / (p.orders + p.failedOrders) : null;
    if (p.pct !== null) {
      comps.push({ w: 45, v: _taClamp_(p.pct, 0, 120) / 120 * 100 });
      if (p.pct >= 100) strengths.push('Đạt ' + p.pct + '% KPI');
      else if (p.pct < 70) issues.push('Mới đạt ' + p.pct + '% KPI');
    }
    if (p.revenue > 0 || p.orders > 0) {
      comps.push({ w: 20, v: p._revPct });
      if (p._revPct >= 75 && byRev.length >= 4) strengths.push('Doanh thu thuộc nhóm đứng đầu team');
      else if (p._revPct <= 25 && byRev.length >= 4) issues.push('Doanh thu thuộc nhóm thấp nhất team');
    }
    if (p.tongTT >= 10 && p.tyLeChot !== null && medClose > 0) {
      comps.push({ w: 20, v: _taClamp_(p.tyLeChot / (medClose * 1.5) * 100, 0, 100) });
      if (p.tyLeChot >= medClose * 1.2) strengths.push('Tỷ lệ chốt ' + p.tyLeChot + '% cao hơn mức giữa team (' + Math.round(medClose * 10) / 10 + '%)');
      else if (p.tyLeChot < medClose * 0.7) issues.push('Tỷ lệ chốt ' + p.tyLeChot + '% thấp hơn mức giữa team (' + Math.round(medClose * 10) / 10 + '%)');
    }
    if (p.failRate !== null && (p.orders + p.failedOrders) >= 5) {
      comps.push({ w: 15, v: _taClamp_(100 - p.failRate * 100 * 2.5, 0, 100) });
      if (p.failedOrders >= 3 && p.failRate > Math.max(teamFail * 1.5, 0.1)) issues.push(p.failedOrders + ' đơn thất bại (' + Math.round(p.failRate * 1000) / 10 + '% so với mức chung ' + Math.round(teamFail * 1000) / 10 + '%)');
      else if (p.failRate <= teamFail * 0.5 && p.orders >= 5) strengths.push('Ít đơn thất bại');
    }
    var wSum = comps.reduce(function(s, c) { return s + c.w; }, 0);
    p.score = wSum ? Math.round(comps.reduce(function(s, c) { return s + c.w * c.v; }, 0) / wSum) : null;
    p.enough = comps.length >= 2 || (p.pct !== null);
    p.rating = !p.enough || p.score === null ? 'chuadu' : (p.score >= 70 ? 'tot' : (p.score >= 45 ? 'trungbinh' : 'kem'));
    if (p.rating === 'chuadu') { p.score = null; strengths = []; issues = []; }   // it so lieu -> khong ket luan hay/do, tranh nhan xet gay hieu nham
    p.strengths = strengths; p.issues = issues;
    p.comment = p.rating === 'chuadu' ? 'Chưa đủ số liệu trong kỳ này để đánh giá (ít đơn / chưa có KPI hoặc dữ liệu Pancake).' : ((strengths.concat(issues)).join('; ') || 'Chưa có điểm nổi bật hay điểm yếu rõ ràng trong kỳ này.');
    delete p._revPct;
  });
  var order = { tot: 0, trungbinh: 1, kem: 2, chuadu: 3 };
  act.sort(function(a, b) { return (order[a.rating] - order[b.rating]) || ((b.score || 0) - (a.score || 0)) || (b.revenue - a.revenue); });
  return { people: act, team: { soNguoi: act.length, totalRevenue: Math.round(totRev), totalOrders: totOrders, totalFailed: totFailed, tyLeThatBai: Math.round(teamFail * 1000) / 10, tyLeChotGiuaTeam: Math.round(medClose * 10) / 10,
    tot: act.filter(function(p) { return p.rating === 'tot'; }).length, trungbinh: act.filter(function(p) { return p.rating === 'trungbinh'; }).length,
    kem: act.filter(function(p) { return p.rating === 'kem'; }).length, chuadu: act.filter(function(p) { return p.rating === 'chuadu'; }).length } };
}
// Goi AI da nha cung cap, tra ve chuoi JSON (parse tai _taParseJson_). Gioi han token cao hon callAI_ (400) vi bang nhieu nguoi.
function _taCallAI_(sys, userMsg) {
  var providers = [
    { name: 'Groq',       key: getSetting_('apiGroq') || getSetting_('geminiKey'), fn: _aiOpenAICompat_, url: 'https://api.groq.com/openai/v1/chat/completions', model: 'openai/gpt-oss-120b' },
    { name: 'Cerebras',   key: getSetting_('apiCerebras'),                         fn: _aiOpenAICompat_, url: 'https://api.cerebras.ai/v1/chat/completions',    model: 'gpt-oss-120b' },
    { name: 'Gemini',     key: getSetting_('apiGemini'),                           fn: _aiGemini_,       model: 'gemini-flash-latest' }
  ];
  var errors = [], any = false;
  for (var i = 0; i < providers.length; i++) {
    var pv = providers[i]; if (!pv.key) continue; any = true;
    pv.maxTokens = 6000; pv.temperature = 0.3;
    var r = pv.fn(pv, sys, userMsg);
    if (r.ok && r.text) return { ok: true, text: r.text, provider: pv.name };
    errors.push(pv.name + ': ' + (r.error || 'tra loi rong'));
  }
  return { ok: false, error: any ? errors.join(' | ') : 'Chưa cấu hình key AI (Settings: apiGroq / apiCerebras / apiGemini).' };
}
function _taParseJson_(t) {
  var s = String(t || '').replace(/```json|```/gi, '').trim();
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.substring(a, b + 1)); } catch (e) { return null; }
}
function teamAnalysis_(p) {
  var today = _vnYmd_(new Date());
  var from = p.from || p.dateFrom || (today.substring(0, 8) + '01'), to = p.to || p.dateTo || today;
  if (from > to) return jsonOut_({ ok: false, error: 'Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ').' });
  var wantAI = p.ai !== '0', cacheKey = 'teamAI_v1_' + from + '_' + to, cache = CacheService.getScriptCache();
  if (wantAI && p.refresh !== '1') {
    var hit = cache.get(cacheKey);
    if (hit) { try { var o = JSON.parse(hit); o.cached = true; return jsonOut_(o); } catch (eh) {} }
  }
  var m = buildTeamMetrics_(from, to), sc = scoreTeam_(m.list);
  var out = { ok: true, from: from, to: to, generatedAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'), team: sc.team, people: sc.people,
    overview: '', highlights: [], risks: [], aiProvider: '', aiError: '', warnings: m.warnings,
    note: 'Điểm = trung bình có trọng số: %KPI (45) + doanh thu so với team (20) + tỷ lệ chốt so với mức giữa team (20) + chất lượng đơn (15; tỷ lệ thất bại = đơn thất bại ÷ (đơn + đơn thất bại)). Thành phần thiếu số liệu thì bỏ qua, không trừ điểm. Từ 70 là "Làm tốt", 45–69 "Trung bình", dưới 45 "Cần cải thiện".' };
  if (!sc.people.length) { out.overview = 'Không có số liệu của nhân viên nào trong khoảng ngày này.'; return jsonOut_(out); }
  if (wantAI) {
    var slim = sc.people.slice(0, 40).map(function(x) { return { ten: x.name, nhom: x.nhom, doanhThu: Math.round(x.revenue), soDon: x.orders, kpiPct: x.pct, tyLeChotPct: x.tyLeChot, soTinNhan: x.tongTT,
      donThatBai: x.failedOrders, khThemMoi: x.careLeads, diem: x.score, xepLoai: x.rating, diemManh: x.strengths, diemYeu: x.issues }; });
    var sys = 'Bạn là chuyên viên phân tích vận hành bán hàng cho một doanh nghiệp bán trang sức phong thủy. Trả lời bằng TIẾNG VIỆT, chỉ dùng số liệu được cung cấp, không bịa số, không đổi xếp loại đã tính. ' +
      'Giọng điệu thẳng thắn nhưng công bằng, nêu việc cụ thể cần làm. Chỉ trả về MỘT đối tượng JSON, không kèm văn bản hay markdown khác.';
    var user = 'Kỳ phân tích: ' + from + ' → ' + to + '. Tổng quan team: ' + JSON.stringify(sc.team) + '.\nDữ liệu từng người (xepLoai: tot=làm tốt, trungbinh, kem=cần cải thiện, chuadu=chưa đủ dữ liệu):\n' + JSON.stringify(slim) +
      '\nTrả về JSON đúng dạng: {"overview":"3-5 câu tổng quan hiệu quả team","highlights":["2-4 điểm tốt của team"],"risks":["2-4 rủi ro/điểm cần xử lý"],"people":[{"name":"đúng tên như dữ liệu","comment":"1-2 câu nhận xét vì sao làm tốt/chưa tốt","action":"1 việc cụ thể nên làm tiếp"}]}';
    var ai = _taCallAI_(sys, user);
    if (ai.ok) {
      var j = _taParseJson_(ai.text);
      if (j) {
        out.overview = String(j.overview || ''); out.highlights = Array.isArray(j.highlights) ? j.highlights.slice(0, 6).map(String) : []; out.risks = Array.isArray(j.risks) ? j.risks.slice(0, 6).map(String) : [];
        var byName = {}; (Array.isArray(j.people) ? j.people : []).forEach(function(x) { if (x && x.name) byName[_normTxt_(x.name)] = x; });
        out.people.forEach(function(x) { var a = byName[_normTxt_(x.name)]; if (a) { if (a.comment) x.comment = String(a.comment); x.action = a.action ? String(a.action) : ''; } });
        out.aiProvider = ai.provider;
        try { cache.put(cacheKey, JSON.stringify(out), 600); } catch (ec) {}
      } else { out.aiError = 'AI trả về không đúng định dạng JSON — đang hiển thị nhận xét theo quy tắc.'; }
    } else { out.aiError = ai.error; }
  }
  if (!out.overview) {
    var t = sc.team;
    out.overview = 'Kỳ ' + from + ' → ' + to + ': ' + t.soNguoi + ' nhân viên có số liệu, ' + t.tot + ' làm tốt, ' + t.trungbinh + ' trung bình, ' + t.kem + ' cần cải thiện, ' + t.chuadu + ' chưa đủ dữ liệu. (Nhận xét tự động theo quy tắc, chưa có phần AI viết.)';
  }
  return jsonOut_(out);
}

// ═══════════════════════════════════════════════════════════════
//  TONG QUAN TO CHUC (v13.24) — action GET orgOverview
//  Man hinh dau tien cua CRM + ho so nhan su: tong hop theo CONG TY -> PHONG -> TEAM -> NHAN VIEN.
//  - Phong = nhom Sale da phan loai o "Phan loai doi Sale" (saleChannels/saleGroups: Online, Van phong, ...), CHUA phan loai = "(chua phan phong)".
//  - Team = sheet Teams (leader + members). 1 nguoi o nhieu team thi tinh vao CA 2 team (tong team co the lech tong phong/cong ty).
//  - Moi nguoi: doanh thu, so don, don/ngay, don trung binh, %KPI, ty le chot, don that bai, diem + xep loai (dung scoreTeam_), don theo ngay.
//  Phan quyen XEM (admin: tat ca; quan ly: phong cua minh; leader: team cua minh; nhan vien: chinh minh) do CLIENT loc (giong cac bao cao khac).
// ═══════════════════════════════════════════════════════════════
function _orgAgg_(plist, days) {
  var a = { soNguoi: plist.length, revenue: 0, orders: 0, failed: 0, careLeads: 0, target: 0, revTarget: 0, tongTT: 0, closeW: 0, tot: 0, trungbinh: 0, kem: 0, chuadu: 0, scoreSum: 0, scoreN: 0 };
  plist.forEach(function(p) {
    a.revenue += p.revenue; a.orders += p.orders; a.failed += p.failedOrders; a.careLeads += p.careLeads;
    if (p.target > 0) { a.target += p.target; a.revTarget += p.revenue; }
    a.tongTT += p.tongTT; if (p.tyLeChot !== null && p.tyLeChot !== undefined) a.closeW += p.tyLeChot * p.tongTT;
    a[p.rating] = (a[p.rating] || 0) + 1;
    if (p.score !== null && p.score !== undefined) { a.scoreSum += p.score; a.scoreN++; }
  });
  return { soNguoi: a.soNguoi, revenue: Math.round(a.revenue), orders: a.orders,
    aov: a.orders ? Math.round(a.revenue / a.orders) : 0,
    ordersPerDay: Math.round(a.orders / days * 10) / 10,
    pct: a.target > 0 ? Math.round(a.revTarget / a.target * 1000) / 10 : null,
    tyLeChot: a.tongTT ? Math.round(a.closeW / a.tongTT * 10) / 10 : null,
    failed: a.failed, careLeads: a.careLeads,
    failRate: (a.orders + a.failed) ? Math.round(a.failed / (a.orders + a.failed) * 1000) / 10 : 0,
    tot: a.tot, trungbinh: a.trungbinh, kem: a.kem, chuadu: a.chuadu, avgScore: a.scoreN ? Math.round(a.scoreSum / a.scoreN) : null };
}
function orgOverview_(p) {
  var today = _vnYmd_(new Date());
  var from = p.from || p.dateFrom || (today.substring(0, 8) + '01'), to = p.to || p.dateTo || today;
  if (from > to) return jsonOut_({ ok: false, error: 'Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ').' });
  var cacheKey = 'orgOv_v1_' + from + '_' + to;
  if (p.refresh !== '1') {
    var hit = _cacheGetBig_(cacheKey);
    if (hit) { try { var o = JSON.parse(hit); o.cached = true; return jsonOut_(o); } catch (eh) {} }
  }
  var effTo = to > today ? today : to;
  var days = Math.max(1, Math.round((Date.parse(effTo + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1);
  var m = buildTeamMetrics_(from, to), sc = scoreTeam_(m.list), warnings = m.warnings.slice();
  var people = sc.people, byKey = {};
  people.forEach(function(x) { byKey[_normTxt_(x.name)] = x; });
  // Don theo ngay tung nguoi (chi khi ky <= 93 ngay de payload gon)
  var dailySkipped = days > 93, daily = {};
  if (!dailySkipped) {
    try {
      var rb = buildSalesReportB_({ dateFrom: from, dateTo: to, sale: [], nguon: [], marketer: [], sanPham: '', careStatus: [], khStatus: [], zaloStatus: [], nickZalo: '', withDaily: true });
      Object.keys(rb.bySaleDay || {}).forEach(function(nm) { daily[_normTxt_(nm)] = rb.bySaleDay[nm]; });
    } catch (eD) { warnings.push('Không đọc được đơn theo ngày: ' + eD.message); dailySkipped = true; }
  }
  // Team + thanh vien (ke ca nguoi chua co so lieu -> hien o "Chua du du lieu" de quan ly thay)
  var teams = [];
  try { teams = readTeams_(getCrmSS_().getSheetByName(SH_TEAM)); } catch (eT) { warnings.push('Không đọc được danh sách team: ' + eT.message); }
  var teamsOf = {}, leaderOf = {};
  teams.forEach(function(t) {
    var names = [], seen = {};
    function add(n) { var k = _normTxt_(n); if (!k || seen[k]) return; seen[k] = true; names.push(String(n).trim());
      if (!byKey[k]) { byKey[k] = { name: String(n).trim(), nhom: '', tier: '', deptKey: '', dept: '', revenue: 0, orders: 0, target: 0, pct: null, tongTT: 0, sdtMangVe: 0, tyLeChot: null, failedOrders: 0, careLeads: 0, score: null, rating: 'chuadu', strengths: [], issues: [], comment: 'Chưa có số liệu trong kỳ này.' }; people.push(byKey[k]); }
      (teamsOf[k] = teamsOf[k] || []).push(t.name); }
    add(t.leader); (t.members || []).forEach(add);
    t._names = names;
    if (_normTxt_(t.leader)) (leaderOf[_normTxt_(t.leader)] = leaderOf[_normTxt_(t.leader)] || []).push(t.name);
  });
  var UNK = '(chưa phân phòng)';
  people.forEach(function(x) {
    var k = _normTxt_(x.name);
    x.dept = x.dept || ''; x.deptKey = x.deptKey || ''; if (!x.deptKey) x.dept = UNK;
    x.ordersPerDay = Math.round(x.orders / days * 10) / 10;
    x.aov = x.orders ? Math.round(x.revenue / x.orders) : 0;
    x.teams = teamsOf[k] || []; x.leaderOf = leaderOf[k] || []; x.isLeader = x.leaderOf.length > 0;
    var ls = {}; teams.forEach(function(t) { if ((teamsOf[k] || []).indexOf(t.name) !== -1 && t.leader && _normTxt_(t.leader) !== k) ls[String(t.leader).trim()] = true; });
    x.leaders = Object.keys(ls);
    var d = daily[k] || {}, ds = Object.keys(d).sort();
    x.activeDays = ds.length;
    x.ordersPerActiveDay = ds.length ? Math.round(x.orders / ds.length * 10) / 10 : 0;
    x.daily = dailySkipped ? null : ds.map(function(dd) { return [dd, d[dd][0], Math.round(d[dd][1])]; });
  });
  var teamOut = teams.map(function(t) {
    var pl = t._names.map(function(n) { return byKey[_normTxt_(n)]; }).filter(Boolean), cnt = {};
    pl.forEach(function(x) { if (x.deptKey) { cnt[x.deptKey] = cnt[x.deptKey] || { n: 0, rev: 0, label: x.dept }; cnt[x.deptKey].n++; cnt[x.deptKey].rev += x.revenue; } });
    var best = Object.keys(cnt).sort(function(a, b) { return (cnt[b].n - cnt[a].n) || (cnt[b].rev - cnt[a].rev); })[0];
    var o = _orgAgg_(pl, days);
    o.id = t.id; o.name = t.name; o.color = t.color || ''; o.leader = t.leader || ''; o.members = t._names; o.deptKey = best || ''; o.dept = best ? cnt[best].label : UNK;
    return o;
  });
  var dmap = {};
  people.forEach(function(x) { var k = x.deptKey || '_none'; (dmap[k] = dmap[k] || { key: x.deptKey || '', label: x.dept, list: [] }).list.push(x); });
  var deptOut = Object.keys(dmap).map(function(k) {
    var g = dmap[k], o = _orgAgg_(g.list, days);
    o.key = g.key; o.label = g.label;
    o.teams = teamOut.filter(function(t) { return t.deptKey === g.key; }).map(function(t) { return t.name; });
    var ls = {}; teamOut.forEach(function(t) { if (t.deptKey === g.key && t.leader) ls[t.leader] = true; }); o.leaders = Object.keys(ls);
    return o;
  }).sort(function(a, b) { return b.revenue - a.revenue; });
  teamOut.sort(function(a, b) { return b.revenue - a.revenue; });
  var order = { tot: 0, trungbinh: 1, kem: 2, chuadu: 3 };
  people.sort(function(a, b) { return (order[a.rating] - order[b.rating]) || ((b.score || 0) - (a.score || 0)) || (b.revenue - a.revenue); });
  var out = { ok: true, from: from, to: to, days: days, generatedAt: Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm'),
    company: _orgAgg_(people, days), depts: deptOut, teams: teamOut, people: people, dailySkipped: dailySkipped, warnings: warnings,
    note: 'Phòng = nhóm Sale đã phân loại ở "Phân loại đội Sale". Một người thuộc nhiều team thì được tính ở cả các team đó (tổng các team có thể lớn hơn tổng phòng/công ty). Đơn/ngày = số đơn ÷ số ngày trong kỳ (tính đến hôm nay). Điểm & xếp loại: xem quy tắc ở "AI phân tích team".' };
  try { _cachePutBig_(cacheKey, JSON.stringify(out), 300); } catch (ec) {}
  return jsonOut_(out);
}

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

// ─── TU CAM (Sheet "Lưu ý từ cấm", file rieng "Report Sale" — theo yeu cau Duyen 27/09/2026):
// AI TUYET DOI KHONG duoc dung cac tu/cum tu trong cot "Từ cấm" khi soan cau tra loi (vi du:
// ngon ngu thien ve tam linh/mac dinh nhu "tai loc", "van may", tu mang tinh cam ket chac chan
// nhu "cam kết"/"mang lai", dieu huong sang nen tang khac...). Kem theo goi y "Từ được dùng"
// (cach dien dat thay the duoc phep) khi cot do co du lieu. Doc dong (khong hardcode ten cot cu
// the, chi do theo tu khoa header "tu cam"/"duoc dung" — cung tinh than voi _priceCols_/CTKM o
// tren) tu 1 file Google Sheet KHAC voi PRICE_SS_ID (file "Report Sale" rieng cua team Sale).
var BANNED_WORDS_SS_ID = '1qyyG2Pj8QOVNTb4B9JX8VQsrjFlZX-WhpovX1qDkvzM';
var BANNED_WORDS_GID = 1343060455; // tab "Lưu ý từ cấm"

function readBannedWordsList_() {
  try {
    var ss = SpreadsheetApp.openById(BANNED_WORDS_SS_ID);
    var sh = ss.getSheetById(BANNED_WORDS_GID);
    if (!sh || sh.getLastRow() < 2) return [];
    var lastRow = sh.getLastRow(), lastCol = Math.max(sh.getLastColumn(), 3);
    var vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var hIdx = _detectHeaderRow_(vals, 12);
    var headers = vals[hIdx].map(function(h) { return String(h || '').trim(); });
    var bannedIdx = -1, allowedIdx = -1;
    for (var c = 0; c < headers.length; c++) {
      var st = _stripVN_(headers[c]);
      if (bannedIdx < 0 && st.indexOf('tu cam') !== -1) { bannedIdx = c; continue; }
      if (allowedIdx < 0 && st.indexOf('duoc dung') !== -1) allowedIdx = c;
    }
    if (bannedIdx < 0) return []; // khong tim thay cot "Tu cam" -> khong co gi de ap, bo qua an toan
    var out = [];
    for (var i = hIdx + 1; i < vals.length; i++) {
      var cell = vals[i][bannedIdx];
      if (!cell) continue;
      var words = String(cell).split(/[,;\/\n]/).map(function(w) { return w.trim(); }).filter(Boolean);
      if (!words.length) continue;
      var allowed = allowedIdx >= 0 ? String(vals[i][allowedIdx] || '').trim() : '';
      out.push({ words: words, allowed: allowed });
    }
    return out;
  } catch (e) { return []; } // loi doc sheet (vd mat quyen truy cap) -> bo qua danh sach tu cam, KHONG lam hong ca cau tra loi AI
}

// Cache 30 phut — danh sach tu cam it thay doi, tranh mo them 1 spreadsheet MOI LAN goi AI.
function _bannedWordsPromptBlock_() {
  var cache = CacheService.getScriptCache();
  var cKey = 'banned_words_v1';
  var cached = cache.get(cKey);
  var list;
  if (cached) { try { list = JSON.parse(cached); } catch (e) {} }
  if (!list) {
    list = readBannedWordsList_();
    try { cache.put(cKey, JSON.stringify(list), 1800); } catch (e) {}
  }
  if (!list || !list.length) return '';
  var lines = list.map(function(item) {
    var s = '- KHONG duoc dung: ' + item.words.join(', ');
    if (item.allowed) s += ' → thay bằng: "' + item.allowed + '"';
    return s;
  });
  return '\n\n⚠️ DANH SÁCH TỪ CẤM (BẮT BUỘC — TUYỆT ĐỐI KHÔNG được dùng trong câu trả lời, kể cả viết tắt/biến thể gần giống, kể cả khi khách hỏi trực tiếp bằng từ đó):\n' +
    lines.join('\n') +
    '\n\nNếu cần diễn đạt ý liên quan, dùng từ ngữ thay thế phù hợp (xem gợi ý "→" ở trên nếu có), KHÔNG dùng nguyên văn từ cấm dưới bất kỳ hình thức nào.';
}

// ─── Prompt he thong: kien thuc san pham CHI nap khi CS bat "Tra cuu san pham" ───
function _buildAISystemPrompt_(userMsg, withProducts) {
  var ctx = readAIContext_();
  var trunc_ = function(str, n) { return str && str.length > n ? str.substring(0, n) + '...' : str; };
  var parts = [];
  parts.push(ctx.systemPrompt || 'Ban la chuyen vien cham soc khach hang. Tra loi bang tieng Viet, than thien, ngan gon.');
  var bannedBlock = _bannedWordsPromptBlock_();
  if (bannedBlock) parts.push(bannedBlock);
  if (ctx.careProcess)    parts.push('\n\nQUY TRINH CSKH:\n'    + trunc_(ctx.careProcess, 600));
  if (ctx.callbackScript) parts.push('\n\nKICH BAN GOI LAI:\n'  + trunc_(ctx.callbackScript, 500));
  if (ctx.salesScriptCu)  parts.push('\n\nKICH BAN KHACH CU:\n' + trunc_(ctx.salesScriptCu, 500));
  if (ctx.salesScriptMoi) parts.push('\n\nKICH BAN KHACH MOI:\n'+ trunc_(ctx.salesScriptMoi, 500));
  // Chi nap kien thuc san pham (nang) khi CS chu dong bat "Tra cuu san pham" -> giu prompt nhe, tranh 429
  if (withProducts) {
    if (ctx.products.length > 0) parts.push('\n\nSAN PHAM:\n' + ctx.products.slice(0, 12).join('\n'));
    if (ctx.faqs.length > 0)     parts.push('\n\nFAQ:\n'          + ctx.faqs.slice(0, 4).join('\n'));
    // slice(-5) = 5 mau MOI NHAT (sheet AIContext them dong moi o cuoi). Truoc day slice(0,5) lay 5 mau CU NHAT
    // nen mau CS vua sua/luu de AI hoc khong bao gio duoc dung khi da co >5 mau.
    if (ctx.combos.length > 0)   parts.push('\n\nMAU TIN NHAN:\n' + ctx.combos.slice(-5).join('\n'));
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
  if (bannedBlock) parts.push('\n\nNHAC LAI: kiem tra cau tra loi TRUOC KHI gui — neu co dung tu nao trong DANH SACH TU CAM o tren, PHAI viet lai bang tu thay the, KHONG duoc gui cau co chua tu cam.');
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
        temperature: (prov.temperature != null ? prov.temperature : 0.7), max_tokens: (prov.maxTokens || 400)
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
        generationConfig: { temperature: (prov.temperature != null ? prov.temperature : 0.7), maxOutputTokens: (prov.maxTokens || 400) }
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
  if (sbMode_() !== 'off') sbMarkStale_('dedupeCare_ xoa/sap xep lai dong CareData');   // dong GIU LAI co the khac dong da backfill
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
    var d = parseVNDate_(orderDate); // ho tro ca Date that lan chuoi 'dd/MM/yyyy...' (readAllOrders_ tra ve chuoi)
    if (!d || isNaN(d)) return;
    d.setHours(0, 0, 0, 0);
    if (d < FU_START) return; // chi hoi tham khach mua tu 5/2026 tro di
    var daysSince = Math.round((today - d) / 86400000);
    if (!fuDaysSet[daysSince]) return;
    var np = normPhone_(phone);
    if (!np || matchedPhones[np]) return; // 1 KH chi nhan 1 tin moi lan chay, tranh spam neu khop nhieu don

    var orderKey = _vnYmd_(d) || String(orderDate);
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

// Bang tra menh Ngu hanh nap am — TINH BANG CONG THUC cho 1900-2100 (da doi chieu voi chuoi nap am 60 nam).
// NGUYEN NHAN GOC da sua: bang cu "chep tu bang CS" chi phu 1954-2013 va SAI 44/60 nam (vd 1995 ghi Thuy, dung la Hoa;
// 1990 ghi Moc, dung la Tho). Cong thuc: Can (Giap,At=1; Binh,Dinh=2; Mau,Ky=3; Canh,Tan=4; Nham,Quy=5)
// + Chi (Ty,Suu,Ngo,Mui=0; Dan,Mao,Than,Dau=1; Thin,Ty,Tuat,Hoi=2); tong >5 thi tru 5 -> 1 Kim,2 Thuy,3 Hoa,4 Tho,5 Moc.
// Tinh theo nam duong lich (sinh truoc Tet thi lay nam truoc).
function menhFromYear_(y) {
  y = parseInt(y, 10);
  if (!y || y < 1900 || y > 2100) return null;
  var can = Math.floor(((y - 4) % 10) / 2) + 1;
  var chi = [0,0,1,1,2,2,0,0,1,1,2,2][(y - 4) % 12];
  var s = can + chi; if (s > 5) s -= 5;
  return ['', 'Kim', 'Thủy', 'Hỏa', 'Thổ', 'Mộc'][s];
}
function buildMenhRows_() {
  var order = ['Kim', 'Thủy', 'Hỏa', 'Mộc', 'Thổ'], by = {};
  order.forEach(function (m) { by[m] = []; });
  for (var y = 1900; y <= 2100; y++) by[menhFromYear_(y)].push(y);
  return order.map(function (m) { return [m, by[m].join(',')]; });
}
var MENH_DEFAULT_ROWS = buildMenhRows_();
var MENH_SHEET_MARK = 'napam-v2';

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
  // Sheet "Menh" cu (bang sai) da duoc seed tu truoc -> ghi de 1 lan, danh dau o C1 = 'napam-v2'.
  if (sh.getLastRow() < 2 || String(sh.getRange(1, 3).getValue()) !== MENH_SHEET_MARK) {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(2, sh.getLastColumn())).clearContent();
    sh.getRange(2, 1, MENH_DEFAULT_ROWS.length, 2).setValues(MENH_DEFAULT_ROWS);
    sh.getRange(1, 3).setValue(MENH_SHEET_MARK);
  }
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
  // Luon dung bang tinh bang cong thuc (khong tin du lieu sheet co the bi sua tay sai) — extension chi can bang day du 1900-2100.
  MENH_DEFAULT_ROWS.forEach(function (row) { menhTable[row[0]] = row[1].split(',').map(Number); });

  var shCanned = ensureCannedSheetSeeded_(getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']));
  var cannedData = shCanned.getDataRange().getValues();
  var canned = [];
  for (var c = 1; c < cannedData.length; c++) {
    if (!cannedData[c][1]) continue;
    canned.push({ nhom: cannedData[c][0], id: cannedData[c][1], label: cannedData[c][2], text: cannedData[c][3] });
  }
  return { ok: true, menhTable: menhTable, canned: canned, bannedWords: readBannedWords_() };
}

// ─── MAU AI DA HOC (AIContext, type = combo_template) — do CS bam "Luu de AI hoc" tren Pancake/Zalo ───
// Dinh danh 1 mau = cot 'created' (ISO, ghi luc luu) — khong dung so dong vi dong co the lech khi co nguoi xoa/chen.
// Neu Google Sheets tu doi chuoi ISO thanh Date thi chuan hoa lai ve ISO truoc khi so sanh.
function _aiExId_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v || '').trim();
}
function readAIExamples_() {
  var sh = getCrmSS_().getSheetByName(SH_CONTEXT);
  var out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() !== 'combo_template') continue;
    var id = _aiExId_(vals[i][3]);
    if (!id || !String(vals[i][1] || '').trim()) continue;
    out.push({ id: id, content: String(vals[i][1]), context: String(vals[i][2] || ''), created: id });
  }
  out.reverse(); // moi nhat len dau — cung la thu tu backend dua vao prompt (5 mau cuoi)
  return out;
}
function saveAIExample_(id, content) {
  id = String(id || '').trim(); content = String(content || '').trim();
  if (!id || !content) return jsonOut_({ error: 'Thieu id hoac noi dung mau' });
  var sh = getCrmSS_().getSheetByName(SH_CONTEXT);
  if (!sh) return jsonOut_({ error: 'Chua co du lieu AI da hoc' });
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === 'combo_template' && _aiExId_(vals[i][3]) === id) {
      sh.getRange(i + 1, 2).setValue(content);
      return jsonOut_({ ok: true, id: id });
    }
  }
  return jsonOut_({ error: 'Khong tim thay mau (co the da bi xoa)' });
}
function deleteAIExample_(id) {
  id = String(id || '').trim();
  if (!id) return jsonOut_({ error: 'Thieu id mau can xoa' });
  var sh = getCrmSS_().getSheetByName(SH_CONTEXT);
  if (!sh) return jsonOut_({ ok: true });
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim() === 'combo_template' && _aiExId_(vals[i][3]) === id) {
      sh.deleteRow(i + 1);
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ ok: true, note: 'Khong tim thay (co the da bi xoa truoc do)' });
}

// ─── SUA / THEM / XOA "MAU CO SAN (PHONG THUY)" (sheet CannedResponses: Nhom | ID | Ten | NoiDung) ───
// Truoc day chi doc (getMessengerKnowledge_), CS khong sua duoc tren Pancake. Nay Pancake AI goi 2 action nay,
// ai cung sua duoc. data: {id (co + tim thay = sua; co + khong thay = tao voi id do; khong co = tao id moi), nhom, label, text}.
// Luu y: neu xoa HET mau thi ensureCannedSheetSeeded_ se nap lai 11 mau mac dinh o lan doc ke tiep.
function saveCannedResponse_(data) {
  if (!data || !String(data.label || '').trim() || !String(data.text || '').trim()) {
    return jsonOut_({ error: 'Thieu ten hoac noi dung mau' });
  }
  var sh = getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']);
  var nhom = String(data.nhom || '').trim() || 'Khac';
  var label = String(data.label).trim();
  var text = String(data.text).trim();
  var id = String(data.id || '').trim();
  var vals = sh.getDataRange().getValues();
  if (id) {
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][1]) === id) {
        sh.getRange(i + 1, 1, 1, 4).setValues([[nhom, id, label, text]]);
        return jsonOut_({ ok: true, id: id });
      }
    }
  } else {
    id = 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }
  sh.appendRow([nhom, id, label, text]);
  return jsonOut_({ ok: true, id: id });
}

function deleteCannedResponse_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id mau can xoa' });
  var sh = getSheet_(SH_CANNED, ['Nhom', 'ID', 'Ten', 'NoiDung']);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][1]) === String(id)) { sh.deleteRow(i + 1); return jsonOut_({ ok: true }); }
  }
  return jsonOut_({ ok: true, note: 'Khong tim thay id (co the da bi xoa truoc do)' });
}

// ═══════════════════════════════════════════════════════════════
//  MAU TIN NHAN TU VAN KHACH (MessageTemplates) — them 2026-10. KHAC voi SH_CANNED (canned
//  response co dinh cho extension-messenger/phong thuy, KHONG co form sua): day la thu vien mau
//  do chinh team tu them/sua qua form tren CRM (tab ZALO AI), hien thi goi y khi tra cuu khach
//  tai CRM VA tai extension Pancake AI (action 'messageTemplates' dung chung cho ca 2 noi).
//  Sheet rieng, KHONG dung chung cot voi CareData/AIContext/CannedResponses.
// ═══════════════════════════════════════════════════════════════
var SH_MSG_TPL = 'MessageTemplates';
var MSG_TPL_HEADERS = ['id', 'title', 'content', 'tags', 'createdBy', 'createdAt', 'updatedAt'];

function readMessageTemplates_() {
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (!row[0]) continue; // bo dong trong (id rong)
    out.push({
      id: String(row[0]),
      title: String(row[1] || ''),
      content: String(row[2] || ''),
      tags: String(row[3] || ''),
      createdBy: String(row[4] || ''),
      createdAt: row[5] || '',
      updatedAt: row[6] || ''
    });
  }
  // Moi nhat len dau cho de tim trong form. Dung getTime() (khong dung String(Date)) vi
  // Date.toString() chi chinh xac den giay va thu tu "Thu, Thang..." khong sap xep dung theo
  // thoi gian thuc -> 2 mau luu cung giay se bi sap xep SAI thu tu neu so sanh chuoi.
  function tplTime_(t) { var d = t.updatedAt || t.createdAt; var ms = d ? new Date(d).getTime() : 0; return isNaN(ms) ? 0 : ms; }
  out.sort(function (a, b) { return tplTime_(b) - tplTime_(a); });
  return out;
}

// data: {id (co thi la sua, khong co/khong tim thay thi tao moi), title, content, tags, createdBy}
function saveMessageTemplate_(data) {
  if (!data || !String(data.title || '').trim() || !String(data.content || '').trim()) {
    return jsonOut_({ error: 'Thieu tieu de hoac noi dung mau tin' });
  }
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  var now = new Date();
  var title = String(data.title).trim();
  var content = String(data.content).trim();
  var tags = String(data.tags || '').trim();
  var createdBy = String(data.createdBy || '').trim();

  if (data.id) {
    for (var i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.id)) {
        sh.getRange(i + 1, 2, 1, 6).setValues([[title, content, tags, vals[i][4] || createdBy, vals[i][5] || now, now]]);
        return jsonOut_({ ok: true, id: String(data.id) });
      }
    }
    // co id truyen len nhung khong tim thay dong -> coi nhu tao moi voi id do (vd dong bo tu client)
    sh.appendRow([String(data.id), title, content, tags, createdBy, now, now]);
    return jsonOut_({ ok: true, id: String(data.id) });
  }

  var newId = 'mt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  sh.appendRow([newId, title, content, tags, createdBy, now, now]);
  return jsonOut_({ ok: true, id: newId });
}

function deleteMessageTemplate_(id) {
  if (!id) return jsonOut_({ error: 'Thieu id mau tin can xoa' });
  var sh = getSheet_(SH_MSG_TPL, MSG_TPL_HEADERS);
  var vals = sh.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      sh.deleteRow(i + 1);
      return jsonOut_({ ok: true });
    }
  }
  return jsonOut_({ ok: true, note: 'Khong tim thay id (co the da bi xoa truoc do)' });
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


// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  CHECKLIST CHAT LUONG TIN NHAN MKT — tab "✅ Checklist MKT" (index.html)
//  KHONG nhap tay theo ngay nua: TU TINH tu
//    • Bao cao Pancake: Tong tuong tac (PancakeStats), Tong SDT thu thap (PancakeSdtStats),
//      so luong tung tag L1..Ln (PancakeTagStats, qua buildPancakeTagReport_ — L9, L10... tu
//      xuat hien khi co tag tuong ung, khong can sua code)
//    • DT TONG (Base): L5 (Chot) = TONG SO DON trong khoang ngay, loc theo NGAY TAO — dung
//      quy uoc "tinh theo ngay tao" ap dung cho moi bao cao trong he thong.
//  Chi con phai DIEN 1 LAN CHO CA THANG: muc tieu (%) + mau so cua tung tag, luu trong
//  Settings key 'mktChecklistConfig' = { "YYYY-MM": { L1:{target:0.8,denom:'tt'}, ... } }.
//  Thang chua duoc cai se KE THUA cau hinh cua thang gan nhat truoc do (hoac mac dinh).
//  Mau so ('denom'): 'tt' = Tong tuong tac | 'sdt' = Tong SDT thu thap | 'L<n>' = so luong 1
//  tag khac (vd L1 lam mau so cho tag con) | 'none' = chi dem so luong, khong tinh ty le.
// ═══════════════════════════════════════════════════════════════
// Mac dinh theo dung 4 muc tieu Duyen da dat truoc day (L1 dat lan 3 >=80%/Tong tuong tac,
// L2 ket noi SDT >=60%/Tong SDT thu thap, L3 dung chan dung >=90%/Tong tuong tac, L4 khao gia
// >=90%/Tong tuong tac). L5 (Chot - KH MOI) va L9 (Chot keo - KH CU) moi bo sung: chua co muc
// tieu chuan (target=null), chi tinh ty le tren dung mau so tuong ung (KH moi / KH cu) de tham
// khao, khong ket luan Dat/Chua dat cho toi khi Duyen dien muc tieu cho thang do. L5 tro len
// khac chua co muc tieu chuan — chi tinh ty le tren Tong tuong tac de tham khao.
// 'op': toan tu so sanh voi muc tieu — 'gte' (>=, mac dinh), 'lte' (<=), 'eq' (=). Vi du L4
// (Khao gia/KNC) neu Duyen muon ty le nay CANG THAP CANG TOT thi doi op sang 'lte'.
var MKT_DEFAULT_CFG_ = {
  L1: { target: 0.8, denom: 'tt',    op: 'gte' },
  L2: { target: 0.6, denom: 'sdt',   op: 'gte' },
  L3: { target: 0.9, denom: 'tt',    op: 'gte' },
  L4: { target: 0.9, denom: 'tt',    op: 'gte' },
  L5: { target: null, denom: 'ttMoi', op: 'gte' }, // Chot — mau so = Tong tuong tac KH MOI
  L9: { target: null, denom: 'ttCu',  op: 'gte' }  // Chot keo — mau so = Tong tuong tac KH CU
};
var MKT_MIN_TAGS_ = 9; // luon hien toi thieu L1..L9 tren bang, du chua co du lieu/cau hinh

function _mktMonthOf_(ymd) { return String(ymd || '').substring(0, 7); }

function readMktConfigAll_() {
  try { var raw = getSetting_('mktChecklistConfig'); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') return o; } } catch (e) {}
  return {};
}

// Cau hinh hieu luc cho 1 thang: dung dung thang neu co, khong thi lay thang GAN NHAT TRUOC
// do (ke thua), khong thi dung mac dinh.
function mktConfigForMonth_(all, ym) {
  if (all[ym]) return { cfg: all[ym], source: ym };
  var earlier = Object.keys(all).filter(function(k) { return /^\d{4}-\d{2}$/.test(k) && k < ym; }).sort();
  if (earlier.length) { var best = earlier[earlier.length - 1]; return { cfg: all[best], source: best }; }
  return { cfg: MKT_DEFAULT_CFG_, source: 'default' };
}

function _mktCleanCfgEntry_(e) {
  var t = (e && e.target !== null && e.target !== undefined && e.target !== '') ? Number(e.target) : null;
  if (t !== null && (isNaN(t) || t < 0)) t = null;
  if (t !== null && t > 1) t = 1;
  var d = String((e && e.denom) || 'tt');
  if (!(d === 'tt' || d === 'sdt' || d === 'ttMoi' || d === 'ttCu' || d === 'none' || d === 'donFb' || /^L\d+(\.\d+)?$/.test(d) || /^sum:L\d+(\.\d+)?(\+L\d+(\.\d+)?)*$/.test(d))) d = 'tt';
  var op = String((e && e.op) || 'gte');
  if (op !== 'gte' && op !== 'lte' && op !== 'eq') op = 'gte';
  return { target: t, denom: d, op: op };
}

// So sanh 1 ty le (%) voi muc tieu (0..1) theo dung toan tu da cau hinh — dung o ca cho tinh
// 'passed' server-side (ket luan Dat/Chua dat) lan cho UI to mau (index.html doc lai t.passed).
function _mktCheckPass_(rate, target, op) {
  var t = (target || 0) * 100;
  if (op === 'lte') return rate <= t;
  if (op === 'eq') return Math.abs(rate - t) < 0.05;
  return rate >= t; // 'gte' mac dinh
}

// Luu cau hinh CHO 1 THANG (config = { L1:{target,denom}, ..., L9:{...} }) — ghi de ca thang do,
// cac thang khac (truoc/sau) khong doi. Dung khi Duyen "dien 1 lan ap dung ca thang".
function saveMktChecklistConfig_(month, config) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return jsonOut_({ ok: false, error: 'Thang khong hop le (can dang YYYY-MM)' });
  if (!config || typeof config !== 'object') return jsonOut_({ ok: false, error: 'Thieu cau hinh' });
  var clean = {};
  Object.keys(config).forEach(function(k) { if (/^L\d+$/.test(k)) clean[k] = _mktCleanCfgEntry_(config[k]); });
  var all = readMktConfigAll_();
  all[month] = clean;
  return setSetting_('mktChecklistConfig', JSON.stringify(all));
}

function _mktTagNum_(code) { return parseInt(String(code).substring(1), 10) || 0; }

// Tinh danh sach dong tag (count/ty le/dat-chua dat) cho 1 nhom (tong / 1 team MKT / 1 team sale).
// counts[code] = null nghia la KHONG co du lieu chia theo nhom nay (vd tag L theo sale) -> rate/passed = null.
function _mktTagRows_(codes, counts, base, cfg) {
  var denomLabel = function(d) {
    if (d === 'tt') return 'Tổng tương tác';
    if (d === 'sdt') return 'Tổng SĐT thu thập';
    if (d === 'ttMoi') return 'Tổng tương tác KH mới';
    if (d === 'ttCu') return 'Tổng tương tác KH cũ';
    if (d === 'none') return '';
    if (d === 'donFb') return 'Tổng đơn (kênh FB)';
    if (d.indexOf('sum:') === 0) return 'Tổng ' + d.substring(4).split('+').join(' + ');
    return 'Số lượng ' + d;
  };
  return codes.map(function(code) {
    var e = _mktCleanCfgEntry_((cfg && cfg[code]) || { target: null, denom: 'tt' });
    var cnt = counts[code];
    var noData = (cnt === null || cnt === undefined);
    var denomVal = null;
    if (e.denom === 'tt') denomVal = base.tt;
    else if (e.denom === 'sdt') denomVal = base.sdt;
    else if (e.denom === 'ttMoi') denomVal = base.ttMoi;
    else if (e.denom === 'ttCu') denomVal = base.ttCu;
    else if (e.denom === 'donFb') denomVal = (base.donFb === undefined) ? null : base.donFb;
    else if (e.denom.indexOf('sum:') === 0) {
      var sumTot = 0, sumMiss = false;
      e.denom.substring(4).split('+').forEach(function(pc) {
        var cv = counts[pc];
        if (cv === null || cv === undefined) sumMiss = true; else sumTot += cv;
      });
      denomVal = sumMiss ? null : sumTot;
    }
    else if (/^L\d+(\.\d+)?$/.test(e.denom)) denomVal = (counts[e.denom] === null || counts[e.denom] === undefined) ? null : counts[e.denom];
    var rate = null;
    if (!noData && e.denom !== 'none' && denomVal !== null) rate = denomVal > 0 ? Math.round(cnt / denomVal * 1000) / 10 : 0;
    var passed = null;
    if (e.target !== null && rate !== null) passed = denomVal > 0 && _mktCheckPass_(rate, e.target, e.op);
    return { code: code, count: noData ? null : cnt, source: code === 'L5' ? 'base' : 'pancakeTag',
      denom: e.denom, denomLabel: denomLabel(e.denom), denomValue: denomVal,
      rate: rate, target: e.target, op: e.op, passed: passed };
  });
}

function buildMktChecklistReport_(from, to) {
  var warnings = [];
  var todayVn = _vnYmd_(new Date());
  if (!from || !to) {
    var mo = todayVn.substring(0, 7);
    if (!from) from = mo + '-01';
    if (!to) to = todayVn;
    warnings.push('Chưa chọn đủ khoảng ngày — đang tạm tính từ ' + from + ' đến ' + to + '.');
  }
  from = normOrderDate_(from) || from; to = normOrderDate_(to) || to;
  if (from > to) warnings.push('Khoảng ngày bị ngược (từ ' + from + ' sau đến ' + to + ') nên không có dữ liệu.');

  // 1) Pancake: tuong tac + SDT + tag (dung lai ham co san, cung nguon voi tab KPI Pancake)
  var pInt = buildPancakeReport_(from, to, 'equal');
  var pSdt = buildPancakeSdtReport_(from, to, 'equal');
  var pTag = buildPancakeTagReport_(from, to);
  var tongTT = pInt.byPage.reduce(function(s, r) { return s + r.tongTT; }, 0);
  var khMoiTotal = pInt.byPage.reduce(function(s, r) { return s + (r.khMoi || 0); }, 0);
  var khCuTotal = pInt.byPage.reduce(function(s, r) { return s + (r.khCu || 0); }, 0);
  var sdtThuThap = pSdt.byPage.reduce(function(s, r) { return s + r.sdtMangVe; }, 0);

  // 2) DT TONG (Base): L5 = tong so don trong khoang ngay, loc theo NGAY TAO (giong moi bao cao khac)
  // Doanh thu (giaTriDon) cong don SONG SONG voi dem don, CUNG mot quy uoc: don co nhieu Sale
  // dung ',' thi MOI Sale duoc tinh DU (khong chia deu) — giu nhat quan voi cach saleOrders/
  // kenhOrders da dem tu truoc, de "Trung binh don" = doanh thu/don cua tung cot van dung y
  // nghia cho rieng cot do (TONG co the vuot tong that neu co don nhieu Sale, giong Tong don).
  var baseOrders = 0, baseRevenue = 0, kenhOrders = {}, kenhRevenue = {}, saleOrders = {}, saleRevenue = {}, saleOrdersFb = {}, donFbTotal = 0;
  // MOI: gom them theo (kenh|sale) x NGAY — dung rieng cho tu so "Ty le chot tong", de chi
  // cong don trong dung nhung ngay Kenh/Sale do THUC SU co du lieu tuong tac Pancake. Cac bien
  // baseOrders/kenhOrders/saleOrders/baseRevenue... hien thi tren bang VAN giu nguyen tinh tren
  // CA khoang ngay nhu truoc (khong doi, theo yeu cau Duyen 24/09/2026).
  var kenhOrdersByDate = {}, saleOrdersByDate = {};
  // "Kenh FB" = cac Kenh ban da khop voi 1 Page Pancake (PancakePageMap)
  var fbKenh = {}, pmK = readPancakePageMap_();
  Object.keys(pmK).forEach(function(pid) { if (pmK[pid]) fbKenh[pmK[pid]] = true; });
  // Cac ngay CO du lieu tuong tac Pancake theo tung Page/Sale, quy doi Page -> Kenh (hop cac
  // ngay cua MOI Page tro ve cung 1 Kenh ban) de dung lam mau so han che cho kenhOrders.
  var _trackedM = _pkTrackedDatesByPageAndSale_(from, to);
  var datesByPageM = _trackedM.datesByPage, datesBySaleM = _trackedM.datesBySale;
  var datesByKenhM = {};
  Object.keys(pmK).forEach(function(pid) {
    var kn = pmK[pid]; if (!kn) return;
    var ds = datesByPageM[pid] || {};
    if (!datesByKenhM[kn]) datesByKenhM[kn] = {};
    Object.keys(ds).forEach(function(d) { datesByKenhM[kn][d] = true; });
  });
  var rowsDt = readDTTong_();
  for (var i = 0; i < rowsDt.length; i++) {
    var dt = parseVNDate_(rowsDt[i].ngayTao);
    // SUA 2026-10-03: thieu dieu kien loai don Huy/Da hoan/Dang hoan (_isExcludedOrderStatus_)
    // nhu buildSalesReportA_/C da lam cho cung nguon DT TONG — khien "Doanh thu Base" (mkt.
    // baseRevenue, the KPI mau xanh trong khoi Marketing cua tab "Báo cáo ngày") cong CA doanh
    // thu don da huy/hoan, cao hon han Bao cao A that (Duyen bao "doanh thu Base dang bi gap
    // doi"). Them dung 1 dieu kien vao if ben duoi, KHONG doi gi khac trong vong lap.
    if (dt && dateInRange_(dt, from, to) && !_isExcludedOrderStatus_(rowsDt[i].trangThai)) {
      var dKeyM = normOrderDate_(rowsDt[i].ngayTao);
      baseOrders++;
      var rev = Number(rowsDt[i].giaTriDon) || 0;
      baseRevenue += rev;
      var kk = rowsDt[i].kenhBan || '(chưa có kênh)';
      kenhOrders[kk] = (kenhOrders[kk] || 0) + 1;
      kenhRevenue[kk] = (kenhRevenue[kk] || 0) + rev;
      if (!kenhOrdersByDate[kk]) kenhOrdersByDate[kk] = {};
      kenhOrdersByDate[kk][dKeyM] = (kenhOrdersByDate[kk][dKeyM] || 0) + 1;
      splitMulti_(rowsDt[i].saleBan, ',').forEach(function(sn) {
        saleOrders[sn] = (saleOrders[sn] || 0) + 1;
        saleRevenue[sn] = (saleRevenue[sn] || 0) + rev;
        if (!saleOrdersByDate[sn]) saleOrdersByDate[sn] = {};
        saleOrdersByDate[sn][dKeyM] = (saleOrdersByDate[sn][dKeyM] || 0) + 1;
      });
      if (fbKenh[kk]) {
        donFbTotal++;
        splitMulti_(rowsDt[i].saleBan, ',').forEach(function(sn) { saleOrdersFb[sn] = (saleOrdersFb[sn] || 0) + 1; });
      }
    }
  }
  // Cong so don CHI trong dung nhung ngay co du lieu tuong tac Pancake (va CHI voi kenh/sale
  // co bao cao tren Pancake) — dung rieng cho tu so cac "Ty le chot tong" ben duoi.
  function _mktSumOnDates_(byKeyDateMap, key, datesSet) {
    var byDate = byKeyDateMap[key] || {};
    var s = 0;
    Object.keys(datesSet || {}).forEach(function(d) { if (byDate[d]) s += byDate[d]; });
    return s;
  }
  var baseOrdersForRate = 0;
  Object.keys(kenhOrdersByDate).forEach(function(kn) {
    if (!fbKenh[kn]) return; // kenh khong co bao cao tren Pancake -> khong tinh vao ty le chot
    baseOrdersForRate += _mktSumOnDates_(kenhOrdersByDate, kn, datesByKenhM[kn] || {});
  });

  // 3) Cau hinh muc tieu/mau so cua thang cuoi khoang dang xem (KPI dien 1 lan cho ca thang)
  var month = _mktMonthOf_(to);
  var cf = mktConfigForMonth_(readMktConfigAll_(), month);

  // 4) Danh sach tag: L1..L8 luon hien; L9, L10... tu them khi co trong bao cao tag hoac trong cau hinh
  var codeSet = {};
  for (var n = 1; n <= MKT_MIN_TAGS_; n++) codeSet['L' + n] = true;
  Object.keys(pTag.totals || {}).forEach(function(k) { if (/^L\d+$/.test(k)) codeSet[k] = true; });
  Object.keys(cf.cfg || {}).forEach(function(k) { if (/^L\d+$/.test(k)) codeSet[k] = true; });
  var codes = Object.keys(codeSet).sort(function(a, b) { return _mktTagNum_(a) - _mktTagNum_(b); });

  var counts = {};
  codes.forEach(function(c) { counts[c] = (c === 'L5') ? baseOrders : (pTag.totals[c] || 0); });

  var base = { tt: tongTT, sdt: sdtThuThap, ttMoi: khMoiTotal, ttCu: khCuTotal, donFb: donFbTotal };
  var tags = _mktTagRows_(codes, counts, base, cf.cfg);

  // 4b) Chia theo TEAM MKT (nhom page do nguoi dung chon, xem MktTeams) va theo TEAM SALE (S van phong / O online).
  // - Team MKT: tuong tac/SDT/tag L1..Ln lay theo tung Page (nhan trong so 'share' neu page chay chung), L5 = don DT TONG theo kenh cua page.
  // - Team Sale: Pancake CHI luu tag theo Page (khong theo nhan vien) nen tag L1..Ln (tru L5) KHONG chia duoc theo sale -> count = null.
  //   Tong tuong tac / SDT / L5 (don DT TONG theo sale) van chia duoc.
  var mktTeams = readMktTeams_();
  var pwM = _mktPageWeights_(mktTeams);
  var kwM = _mktKenhWeights_(mktTeams, readPancakePageMap_());
  var mktG = {};
  var newG = function(id, name, color) { return { id: id, name: name, color: color || '', pages: [], tt: 0, sdt: 0, ttMoi: 0, ttCu: 0, counts: {}, orders: 0, ordersForRate: 0, donFb: 0, revenue: 0 }; };
  mktTeams.forEach(function(t) { mktG[t.id] = newG(t.id, t.name, t.color); });
  var getG = function(x) { return mktG[x.id] || (mktG[x.id] = newG(x.id, x.name, '')); };
  var NOMKT = [{ id: '_none', name: '(chưa gán MKT)', w: 1 }];
  pInt.byPage.forEach(function(r) {
    (pwM[r.pageId] || NOMKT).forEach(function(x) {
      var g = getG(x);
      g.pages.push(r.pageName + (x.w < 1 ? ' (' + Math.round(x.w * 100) + '%)' : ''));
      g.tt += r.tongTT * x.w; g.ttMoi += (r.khMoi || 0) * x.w; g.ttCu += (r.khCu || 0) * x.w;
      var tg = pTag.byPage[r.pageId];
      if (tg) codes.forEach(function(c) { if (c !== 'L5' && tg[c]) g.counts[c] = (g.counts[c] || 0) + tg[c] * x.w; });
    });
  });
  pSdt.byPage.forEach(function(r) {
    (pwM[r.pageId] || NOMKT).forEach(function(x) { getG(x).sdt += r.sdtMangVe * x.w; });
  });
  Object.keys(kenhOrders).forEach(function(kn) {
    (kwM[kn] || NOMKT).forEach(function(x) {
      var g = getG(x); g.orders += kenhOrders[kn] * x.w; g.revenue += (kenhRevenue[kn] || 0) * x.w; if (fbKenh[kn]) g.donFb += kenhOrders[kn] * x.w;
      if (fbKenh[kn]) g.ordersForRate += _mktSumOnDates_(kenhOrdersByDate, kn, datesByKenhM[kn] || {}) * x.w;
    });
  });
  var r2 = function(n) { return Math.round(n * 100) / 100; };
  var mktGroups = Object.keys(mktG).map(function(k) { return mktG[k]; })
    .filter(function(g) { return g.id !== '_none' || g.pages.length || g.orders; })
    .map(function(g) {
      var cnt = {};
      codes.forEach(function(c) { cnt[c] = (c === 'L5') ? r2(g.orders) : r2(g.counts[c] || 0); });
      var tr = g.tt > 0 ? Math.round(g.ordersForRate / g.tt * 1000) / 10 : 0; // CHI tinh tren ngay co Pancake
      var gOrdersR = Math.round(g.orders); // don co the le do nhan trong so 'share' page chay chung
      return { id: g.id, name: g.name, color: g.color, pages: g.pages, tongTT: r2(g.tt), khMoiTotal: r2(g.ttMoi), khCuTotal: r2(g.ttCu),
        sdtThuThap: r2(g.sdt), baseOrders: r2(g.orders), donFb: r2(g.donFb), tyLeChotTong: tr,
        baseRevenue: Math.round(g.revenue), trungBinhDon: gOrdersR ? Math.round(g.revenue / gOrdersR) : 0,
        tags: _mktTagRows_(codes, cnt, { tt: g.tt, sdt: g.sdt, ttMoi: g.ttMoi, ttCu: g.ttCu, donFb: g.donFb }, cf.cfg) };
    });

  var saleDirM = readSaleDirectory_();
  var nhomOf = function(name) { var rec = saleDirM.byName[_normTxt_(name)]; return rec ? rec.nhom : '(ngoài danh sách)'; };
  var saleG = {};
  var getSG = function(nh) { return saleG[nh] || (saleG[nh] = { nhom: nh, soSale: 0, tt: 0, sdt: 0, ttMoi: 0, ttCu: 0, orders: 0, ordersForRate: 0, donFb: 0, revenue: 0 }); };
  pInt.byCS.forEach(function(r) { var g = getSG(nhomOf(r.name)); g.soSale++; g.tt += r.tongTT; g.ttMoi += r.khMoi || 0; g.ttCu += r.khCu || 0; });
  pSdt.byCS.forEach(function(r) { getSG(nhomOf(r.name)).sdt += r.sdtMangVe; });
  Object.keys(saleOrders).forEach(function(nm) {
    var sg = getSG(nhomOf(nm)); sg.orders += saleOrders[nm]; sg.revenue += (saleRevenue[nm] || 0);
    sg.ordersForRate += _mktSumOnDates_(saleOrdersByDate, nm, datesBySaleM[nm] || {});
  });
  Object.keys(saleOrdersFb).forEach(function(nm) { getSG(nhomOf(nm)).donFb += saleOrdersFb[nm]; });
  var saleGroupsOut = ['Văn phòng', 'Online', 'Thử việc', '(ngoài danh sách)'].filter(function(nh) { return saleG[nh]; }).map(function(nh) {
    var g = saleG[nh], cnt = {};
    codes.forEach(function(c) { cnt[c] = (c === 'L5') ? g.orders : null; });
    return { nhom: nh, soSale: g.soSale, tongTT: r2(g.tt), khMoiTotal: r2(g.ttMoi), khCuTotal: r2(g.ttCu), sdtThuThap: r2(g.sdt),
      baseOrders: g.orders, donFb: g.donFb, tyLeChotTong: g.tt > 0 ? Math.round(g.ordersForRate / g.tt * 1000) / 10 : 0, // CHI tinh tren ngay Sale co Pancake
      baseRevenue: Math.round(g.revenue), trungBinhDon: g.orders ? Math.round(g.revenue / g.orders) : 0,
      tags: _mktTagRows_(codes, cnt, { tt: g.tt, sdt: g.sdt, ttMoi: g.ttMoi, ttCu: g.ttCu, donFb: g.donFb }, cf.cfg) };
  });

  // 5) Chan doan nguon du lieu: bao ro "chua nap bao gio" vs "co nhung ngoai khoang ngay dang xem"
  var dataAvail = {
    tuongTac: _pkSheetDateSpan_(SH_PK_STATS, PK_STATS_HEADERS, from, to),
    sdt:      _pkSheetDateSpan_(SH_PK_SDT,   PK_SDT_STATS_HEADERS, from, to),
    tag:      _pkSheetDateSpan_(SH_PK_TAG,   PK_TAG_STATS_HEADERS, from, to)
  };
  var LBL = { tuongTac: 'Thống kê tương tác', sdt: 'Thống kê nhân viên (SĐT)', tag: 'Thống kê tag' };
  Object.keys(dataAvail).forEach(function(k) {
    var a = dataAvail[k];
    if (a.rows === 0) warnings.push('Chưa có dữ liệu "' + LBL[k] + '" nào trên CRM — vào tab "📥 Báo cáo Pancake", nạp file rồi bấm "💾 Lưu lên CRM".');
    else if (a.rowsInRange === 0) warnings.push('Không có dòng "' + LBL[k] + '" nào trong khoảng ngày đang chọn (dữ liệu hiện có từ ' + a.minDate + ' đến ' + a.maxDate + ').');
  });

  // cau hinh day du (moi tag dang hien) de form sua muc tieu tren UI dien dung ngay
  var configOut = {};
  codes.forEach(function(c) { configOut[c] = _mktCleanCfgEntry_((cf.cfg && cf.cfg[c]) || { target: null, denom: 'tt' }); });

  // Ty le chot TONG (khong phan biet KH moi/cu, khong gan voi tag nao) = Tong so don (Base,
  // CHI tinh tren nhung ngay + kenh THUC SU co du lieu tuong tac Pancake — xem baseOrdersForRate)
  // / Tong tuong tac — chi so tong quan rieng, hien canh cac the KPI khac.
  var tyLeChotTong = tongTT > 0 ? Math.round(baseOrdersForRate / tongTT * 1000) / 10 : 0;

  return { ok: true, from: from, to: to, month: month, configSource: cf.source,
    tongTT: tongTT, khMoiTotal: khMoiTotal, khCuTotal: khCuTotal, sdtThuThap: sdtThuThap,
    baseOrders: baseOrders, donFb: donFbTotal, baseRevenue: baseRevenue, trungBinhDon: baseOrders ? Math.round(baseRevenue / baseOrders) : 0,
    tyLeChotTong: tyLeChotTong,
    tags: tags, groups: { mkt: mktGroups, sale: saleGroupsOut },
    config: configOut, dataAvail: dataAvail, warnings: warnings };
}

// ═══════════════════════════════════════════════════════════════
//  NHAT KY BAO CAO HANG NGAY — xuat rieng ra 1 Google Sheet CO DINH (khac voi CRM_SS_ID/
//  ORDER_SS_ID), moi loai (Sale ban / Kenh ban / MKT / Tag) 1 SHEET DUY NHAT, GOP DAN theo
//  tung lan xuat — KHONG tao tab moi moi lan nhu exportSalesReportToSheet_. Du lieu tach
//  theo TUNG NGAY (khong gop ca khoang ngay), xuat lai trung ngay se THAY THE (xoa dong cu
//  cua dung ngay do, ghi lai dong moi). Cot STT la so dong lien tiep 1..N cua CA SHEET, tu
//  dong renumber lai moi lan ghi de khong bi hut so.
//  Yeu cau ngay 23/09/2026 (Duyen): "xuat bao cao tu Base (bao cao A) va bao cao tong hop tu
//  Pancake" — dung lai buildSalesReportA_ (Sale/Kenh) va buildMktChecklistReport_/
//  buildPancakeTagReport_ (MKT/Tag) GOI RIENG CHO TUNG NGAY trong khoang duoc chon, de ra
//  dung 1 dong/ngay/doi tuong giong anh mau Duyen gui.
// ═══════════════════════════════════════════════════════════════
var EXPORT_LOG_SS_ID = '1s1UlRMquiryI7A2lJ8gJlPMsIGBLGum1RdLJga3ldlI';
function getExportLogSS_() { return SpreadsheetApp.openById(EXPORT_LOG_SS_ID); }

var EXPORT_LOG_SHEETS_ = {
  sale: { name: 'Sale bán', headers: ['STT','Ngày','Tháng','Sale','Số đơn','Cọc','Tổng đơn','TB đơn'] },
  kenh: { name: 'Kênh bán', headers: ['STT','Ngày','Tháng','Kênh','Số đơn','Cọc','Tổng đơn','TB đơn'] },
  mkt:  { name: 'MKT',      headers: ['STT','Ngày','Tháng','MKT','Tương tác','SĐT thu thập','Số đơn','Tỷ lệ chốt (%)'] },
  tag:  { name: 'Tag',      headers: ['STT','Ngày','Tháng','Kênh (Page)','L1','L2','L3','L4','L5','L6','L7','L8','L9'] }
};

function _exportLogGetSheet_(kind) {
  var def = EXPORT_LOG_SHEETS_[kind];
  var ss = getExportLogSS_();
  var sh = ss.getSheetByName(def.name);
  if (!sh) sh = ss.insertSheet(def.name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    sh.getRange(1, 1, 1, def.headers.length).setFontWeight('bold');
  }
  return sh;
}

// Ghi/thay the du lieu cho 1 nhom NGAY vao 1 sheet loai (kind). rowsByDate: { 'yyyy-MM-dd':
// [ [ngay,thang,...cot con lai theo dung thu tu headers (BO cot STT)], ... ] } — PHAI co du
// 1 key cho MOI ngay trong khoang dang xuat, KE CA khi ngay do khong con dong nao (mang rong)
// — de dong cu cua ngay do van bi xoa dung theo yeu cau "xuat lai trung ngay se thay the".
function _exportLogWriteDays_(kind, rowsByDate) {
  var def = EXPORT_LOG_SHEETS_[kind];
  var sh = _exportLogGetSheet_(kind);
  var last = sh.getLastRow();
  var nCols = def.headers.length;
  var existing = last >= 2 ? sh.getRange(2, 1, last - 1, nCols).getValues() : [];

  // Key doi chieu = "Ngay/Thang" (dung dinh dang hien co, KHONG co nam — xem gioi han o
  // comment cuoi ham exportDailyReportLogs_ ben duoi).
  var touchedKeys = {};
  Object.keys(rowsByDate).forEach(function(dKey) {
    var p = dKey.split('-'); // yyyy-mm-dd
    touchedKeys[String(+p[2]) + '/' + String(+p[1])] = true;
  });
  var keep = existing.filter(function(r) { return !touchedKeys[String(r[1]) + '/' + String(r[2])]; });

  var added = [];
  Object.keys(rowsByDate).forEach(function(dKey) {
    (rowsByDate[dKey] || []).forEach(function(row) { added.push([null].concat(row)); }); // cho STT (dien lai o duoi)
  });

  var all = keep.concat(added);
  // Sap theo Thang -> Ngay tang dan cho de doc (giu nguyen thu tu trong cung 1 ngay)
  all.sort(function(a, b) {
    if (+a[2] !== +b[2]) return +a[2] - +b[2];
    return +a[1] - +b[1];
  });
  var out = all.map(function(r, i) { var rr = r.slice(); rr[0] = i + 1; return rr; });

  sh.clearContents();
  sh.getRange(1, 1, 1, nCols).setValues([def.headers]);
  sh.getRange(1, 1, 1, nCols).setFontWeight('bold');
  if (out.length) sh.getRange(2, 1, out.length, nCols).setValues(out);
  return { total: out.length, added: added.length, removed: existing.length - keep.length };
}

// Danh sach chuoi 'yyyy-MM-dd' lien tiep tu 'from' den 'to' (bao gom ca 2 dau).
function _dateRangeList_(from, to) {
  var out = [];
  var d = parseVNDate_(from), dEnd = parseVNDate_(to);
  if (!d || !dEnd) return out;
  while (d.getTime() <= dEnd.getTime()) {
    out.push(_vnYmd_(d));
    d = new Date(d.getTime() + 86400000);
  }
  return out;
}

// Ham chinh — goi tu UI: xuat nhat ky Sale ban / Kenh ban / MKT / Tag cho tung ngay trong
// khoang [from,to] vao Google Sheet EXPORT_LOG_SS_ID. Gioi han 31 ngay/lan de tranh vuot thoi
// gian chay toi da cua Apps Script (moi ngay phai goi lai buildSalesReportA_/
// buildMktChecklistReport_/buildPancakeTagReport_ rieng, kha ton thoi gian voi khoang dai).
function exportDailyReportLogs_(from, to) {
  from = normOrderDate_(from); to = normOrderDate_(to);
  if (!from || !to) return jsonOut_({ ok: false, error: 'Thiếu khoảng ngày' });
  if (from > to) return jsonOut_({ ok: false, error: 'Khoảng ngày bị ngược (từ ngày sau đến ngày trước)' });
  var days = _dateRangeList_(from, to);
  if (!days.length) return jsonOut_({ ok: false, error: 'Không đọc được khoảng ngày' });
  if (days.length > 31) return jsonOut_({ ok: false, error: 'Khoảng ngày quá dài (' + days.length + ' ngày) — tối đa 31 ngày/lần xuất để tránh vượt thời gian chạy của Apps Script. Xuất theo từng tháng nhé.' });

  var bySale = {}, byKenh = {}, byMkt = {}, byTag = {};

  days.forEach(function(dayStr) {
    var p = dayStr.split('-'); var dd = String(+p[2]), mm = String(+p[1]);

    var repA = buildSalesReportA_({ dateFrom: dayStr, dateTo: dayStr, dateField: 'ngayTao' });
    bySale[dayStr] = (repA.bySale || []).map(function(s) {
      return [dd, mm, s.name, s.orders, Math.round(s.coc), Math.round(s.giaTri), s.orders ? Math.round(s.giaTri / s.orders) : 0];
    });
    byKenh[dayStr] = (repA.byKenh || []).map(function(k) {
      return [dd, mm, k.name, k.orders, Math.round(k.coc), Math.round(k.giaTri), k.orders ? Math.round(k.giaTri / k.orders) : 0];
    });

    var repMkt = buildMktChecklistReport_(dayStr, dayStr);
    byMkt[dayStr] = ((repMkt.groups && repMkt.groups.mkt) || []).map(function(g) {
      return [dd, mm, g.name, Math.round(g.tongTT), Math.round(g.sdtThuThap), Math.round(g.baseOrders), g.tyLeChotTong];
    });

    var repTag = buildPancakeTagReport_(dayStr, dayStr);
    var pageIds = Object.keys(repTag.byPage || {});
    byTag[dayStr] = pageIds.map(function(pid) {
      var pg = repTag.byPage[pid];
      return [dd, mm, pg.pageName || pid, pg.L1||0, pg.L2||0, pg.L3||0, pg.L4||0, pg.L5||0, pg.L6||0, pg.L7||0, pg.L8||0, pg.L9||0];
    });
  });

  var rSale = _exportLogWriteDays_('sale', bySale);
  var rKenh = _exportLogWriteDays_('kenh', byKenh);
  var rMkt  = _exportLogWriteDays_('mkt', byMkt);
  var rTag  = _exportLogWriteDays_('tag', byTag);

  return jsonOut_({
    ok: true, from: from, to: to, days: days.length,
    sheetUrl: getExportLogSS_().getUrl(),
    result: { sale: rSale, kenh: rKenh, mkt: rMkt, tag: rTag }
    // GIOI HAN: khop trung ngay de "thay the" dang dung khoa "Ngày/Tháng" (khong co Nam) —
    // dung theo dung 4 cot hien trong anh mau Duyen gui (khong co cot Nam). Neu du lieu keo
    // dai qua nhieu nam va co trung Ngay+Thang o 2 nam khac nhau, ghi de co the nham sang
    // dong cua nam khac. Bao Duyen biet neu can them cot Nam de tranh truong hop nay.
  });
}

// Ham goi TAT (ten de nho, tieng Viet) cho installAutoDedupTrigger_ — chay ham nay 1 LAN DUY
// NHAT tu Apps Script Editor (chon "chayCaiDatTrigger" trong dropdown -> bam Run, lan dau se
// hoi cap quyen thi bam Allow) de cai dat trigger "On change" tu dong xoa dong trung tuyet doi
// cho Base + Pos (xem _autoDedupExactRowsInSheet_/onChangeDedupTrigger_ o tren). Khong can chay
// lai moi lan Deploy sau — trigger installable ton tai doc lap voi cac lan deploy Web App.
function chayCaiDatTrigger() {
  installAutoDedupTrigger_();
}


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  CHIA DATA TU DONG — CHAY TREN SERVER (time-driven trigger), them 2026-10-07 theo yeu cau Duyen
//  NHU CAU GOC: ban chay trong trinh duyet (index.html) chi chia khi co admin mo CRM; ngay khong ai mo thi khong chia.
//  Ban nay chay bang trigger moi gio, khong can mo CRM. THUAT TOAN _aaSplit/_aaRatioFor/_aaWeights/_aaRecipients/
//  _aaBuckets/_aaPlan PHAI GIONG HET ban trong index.html (khoi "CHIA DATA TU DONG (engine)") — sua 1 ben nho sua ben kia.
//  Cau hinh: Settings 'autoAssignCfg' (UI luu). Trang thai chay: Settings 'autoAssignState' {lastRun,lastResult,by} CHI do
//  nguoi chay (server/trinh duyet) ghi — tach rieng de UI luu cau hinh khong bao gio ghi de lastRun (tranh chia 2 lan/ngay).
//  CACH CAI: Apps Script Editor -> chon ham installAutoAssignTrigger_ -> Run (1 lan, cap quyen). Go: removeAutoAssignTrigger_.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var AA_TZ = 'Asia/Ho_Chi_Minh';
var _AA_SRC_KEYS = ['dt','don','cs','cskh'];
var _AA_POS_KEYS = ['dt','don','cs'];   // nguon POS (chia theo ty le nguon chung). CSKH-Duyen KHONG nam trong ty le nay: chia RIENG (cskhTeams/cskhMembers...)
var _AA_SRC_LABEL = { dt:'DT tổng', don:'Dữ liệu đơn', cs:'Chăm sóc', cskh:'CSKH-Duyên' };
var _AA_PRIO_KEYS = ['vip','tt','tn','other'];
var _AA_PRIO_LABEL = { vip:'VIP', tt:'Thân thiết', tn:'Tiềm năng', other:'Khác (chưa phân hạng)' };
var _AA_TIER = { vip:'VIP', tt:'Thân thiết', tn:'Tiềm năng' };
var _AA_HANG_KEYS = ['thuong','tt','vip','super'];
var _AA_HANG_LABEL = { thuong:'Khách thường', tt:'Ưu tiên', vip:'Vip', super:'Super VVip' };   // PHAN HANG KH theo doanh thu (xem _hangKeyOf_ trong index.html)

function _aaDefaultCfg(){
  return {
    enabled:false,
    days:[1,2,3,4,5,6],        // 0=CN,1=T2..6=T7 ; ngày không tích → KHÔNG chia
    onlyUnassigned:true,       // chỉ lấy KH chưa từng chia (tránh chia lại đúng KH cũ mỗi ngày)
    dailyTotal:0,              // tổng KH/ngày (dùng khi Team chia theo %)
    teams:{},                  // teamId -> {on, mode:'count'|'pct', val}
    memberMode:{},             // teamId -> 'pct'|'count'
    members:{},                // teamId -> {tenNV: {on, val}}
    src:{ mode:'pct', vals:{} },   // chung; vals rỗng/0 hết = lấy mọi nguồn theo tỷ lệ bằng nhau
    prio:{ mode:'pct', vals:{} },
    hang:{ mode:'pct', vals:{} },   // Phan hang KH: thuong/tt/vip/super (chua cai = khong loc theo hang)
    teamSrc:{}, teamPrio:{}, teamHang:{},   // teamId -> {mode, vals} (ghi đè)
    memberSrc:{}, memberPrio:{}, memberHang:{}, // teamId -> {tenNV: {mode, vals}} (ghi đè)
    cskhEnabled:false,         // MUC RIENG: chia data CSKH-Duyen (khong dinh ty le nguon/uu tien/hang cua POS)
    cskhDays:[1,2,3,4,5,6],
    cskhTotal:0,               // tong KH CSKH/ngay (dung khi Team chia theo %)
    cskhTeams:{}, cskhMemberMode:{}, cskhMembers:{},   // cung dang teams/memberMode/members cua POS
    lastRun:'',                // YYYY-MM-DD ngày đã chạy gần nhất
    lastResult:null
  };
}
// Largest remainder: chia nguyên `total` theo weights (mảng số ≥0); tổng weights = 0 → chia bằng nhau
function _aaSplit(total, weights){
  var n = weights.length, out = new Array(n).fill(0);
  total = Math.max(0, Math.floor(total) || 0);
  if (!n || !total) return out;
  var w = weights.map(function(x){ return Math.max(0, Number(x) || 0); });
  var sum = w.reduce(function(a,b){ return a+b; }, 0);
  if (sum <= 0) { w = w.map(function(){ return 1; }); sum = n; }
  var raw = w.map(function(x){ return total * x / sum; });
  var fl = raw.map(Math.floor), used = fl.reduce(function(a,b){ return a+b; }, 0);
  var order = raw.map(function(_,i){ return i; }).sort(function(a,b){ return (raw[b]-fl[b]) - (raw[a]-fl[a]) || a-b; });
  for (var k = 0; k < total - used; k++) fl[order[k % n]]++;
  return fl;
}
// Lấy tỷ lệ áp dụng cho 1 người: ghi đè người → ghi đè Team → chung
function _aaRatioFor(cfg, kind, tid, name){
  var mk = { src:'memberSrc', prio:'memberPrio', hang:'memberHang' }[kind], tk = { src:'teamSrc', prio:'teamPrio', hang:'teamHang' }[kind];
  var m = cfg[mk] && cfg[mk][tid] && cfg[mk][tid][name]; if (m) return m;
  var t = cfg[tk] && cfg[tk][tid]; if (t) return t;
  return cfg[kind];
}
function _aaWeights(ratio, keys){   // chỉ lấy khoá được cài > 0; nếu chưa cài gì → tất cả khoá bằng nhau
  var vals = (ratio && ratio.vals) || {};
  var w = keys.map(function(k){ return Math.max(0, Number(vals[k]) || 0); });
  if (w.every(function(x){ return x === 0; })) w = keys.map(function(){ return 1; });
  return w;
}
// Danh sách người nhận + hạn mức/ngày. teamsArr = mảng team {id,name,members[],leader}; membersOf(team) → danh sách tên
function _aaRecipients(cfg, teamsArr, membersOf){
  var list = [], warn = [];
  (teamsArr || []).forEach(function(t){
    var tc = cfg.teams[t.id]; if (!tc || !tc.on) return;
    var members = membersOf(t); if (!members.length) { warn.push('Team "'+t.name+'" chưa có thành viên'); return; }
    var mc = (cfg.members && cfg.members[t.id]) || {};
    var mm = (cfg.memberMode && cfg.memberMode[t.id]) || 'pct';
    var active = members.filter(function(m){ return !mc[m] || mc[m].on !== false; });   // mặc định tích (chưa cài = có chia)
    if (!active.length) return;
    var teamQuota = tc.mode === 'pct' ? Math.round((cfg.dailyTotal || 0) * (Number(tc.val) || 0) / 100) : Math.floor(Number(tc.val) || 0);
    var q;
    if (mm === 'count') q = active.map(function(m){ return Math.max(0, Math.floor(Number((mc[m]||{}).val) || 0)); });
    else q = _aaSplit(teamQuota, active.map(function(m){ return Number((mc[m]||{}).val) || 0; }));
    active.forEach(function(m, i){ if (q[i] > 0) list.push({ team:t.id, teamName:t.name, name:m, quota:q[i] }); });
  });
  return { list:list, warn:warn };
}
// Dựng nhóm ứng viên theo (nguồn, ưu tiên). custs: [{phone,dataSrc,tier}] ; everSet: Set SĐT đã chia từng
function _aaBuckets(cfg, custs, everSet){
  var b = {}, bh = {};   // b[s][p] = [phone] (nhu cu) ; bh['s|p|h'] = [phone] -- them chieu PHAN HANG KH (doanh thu): thuong|tt|vip|super
  _AA_SRC_KEYS.forEach(function(s){ b[s] = {}; _AA_PRIO_KEYS.forEach(function(p){ b[s][p] = []; _AA_HANG_KEYS.forEach(function(h){ bh[s+'|'+p+'|'+h] = []; }); }); });
  for (var i = 0; i < custs.length; i++){
    var c = custs[i]; if (!c || !c.phone) continue;
    if (cfg.onlyUnassigned && everSet && everSet.has(c.phone)) continue;
    var p = c.tier === 'VIP' ? 'vip' : c.tier === 'Thân thiết' ? 'tt' : c.tier === 'Tiềm năng' ? 'tn' : 'other';
    var hg = (c.hangKey && _AA_HANG_KEYS.indexOf(c.hangKey) >= 0) ? c.hangKey : 'thuong';
    var d = c.dataSrc || {};
    for (var j = 0; j < _AA_SRC_KEYS.length; j++){ var s = _AA_SRC_KEYS[j]; if (d[s]) { b[s][p].push(c.phone); bh[s+'|'+p+'|'+hg].push(c.phone); } }
  }
  b._h = bh;
  return b;
}
// Lập kế hoạch 1 ngày. Trả {entries:[{team,teamName,name,phones[]}], short:[{name,missing}], warn:[]}
function _aaPlan(cfg, teamsArr, membersOf, custs, everSet, taken0){
  var rc = _aaRecipients(cfg, teamsArr, membersOf), buckets = _aaBuckets(cfg, custs, everSet);
  var taken = taken0 || new Set(), ptr = {}, entries = [], short = [];
  function take(s, p, n, out, h){         // lay toi da n SDT chua dung tu nhom (s,p) [va hang h neu co]
    var arr = h ? buckets._h[s + '|' + p + '|' + h] : buckets[s][p], k = s + '|' + p + (h ? '|' + h : ''), got = 0, i = ptr[k] || 0;
    while (got < n && i < arr.length){ var ph = arr[i++]; if (!taken.has(ph)) { taken.add(ph); out.push(ph); got++; } }
    ptr[k] = i; return got;
  }
  rc.list.forEach(function(r){
    var sw = _aaWeights(_aaRatioFor(cfg, 'src', r.team, r.name), _AA_POS_KEYS);
    var sq = _aaSplit(r.quota, sw), phones = [], miss = 0;
    var pw = _aaWeights(_aaRatioFor(cfg, 'prio', r.team, r.name), _AA_PRIO_KEYS);
    var srcOrder = _AA_POS_KEYS.map(function(s,i){ return { s:s, w:sw[i] }; }).filter(function(x){ return x.w > 0; })
      .sort(function(a,b){ return b.w - a.w; }).map(function(x){ return x.s; });
    var prOrder = _AA_PRIO_KEYS.map(function(p,i){ return { p:p, w:pw[i] }; }).filter(function(x){ return x.w > 0; })
      .sort(function(a,b){ return b.w - a.w; }).map(function(x){ return x.p; });
    // Phan hang KH (doanh thu): CHI kich hoat khi co it nhat 1 hang duoc cai > 0 (chua cai = giu nguyen cach chia cu, khong doi hanh vi)
    var hr = _aaRatioFor(cfg, 'hang', r.team, r.name), hv = (hr && hr.vals) || {};
    var hangOn = _AA_HANG_KEYS.some(function(k){ return (Number(hv[k]) || 0) > 0; });
    if (hangOn){
      // Chia han muc theo HANG truoc (tong moi hang dung ty le), ben trong moi hang van chia theo ty le NGUON roi UU TIEN nhu cu.
      var hq = _aaSplit(r.quota, _aaWeights(hr, _AA_HANG_KEYS));
      _AA_HANG_KEYS.forEach(function(h, hi){
        if (!hq[hi]) return;
        var m = 0, sqh = _aaSplit(hq[hi], sw);
        _AA_POS_KEYS.forEach(function(s, si){
          if (!sqh[si]) return;
          var pqh = _aaSplit(sqh[si], pw);
          _AA_PRIO_KEYS.forEach(function(p, pi){
            if (!pqh[pi]) return;
            var g = take(s, p, pqh[pi], phones, h);
            if (g < pqh[pi]) m += pqh[pi] - g;
          });
        });
        // o (nguon,uu tien) nao thieu dung hang nay -> lay hang do o cac o khac (nguon/uu tien trong so cao truoc)
        for (var a = 0; a < srcOrder.length && m > 0; a++)
          for (var c2 = 0; c2 < prOrder.length && m > 0; c2++) m -= take(srcOrder[a], prOrder[c2], m, phones, h);
        miss += Math.max(0, m);
      });
    } else {
      _AA_POS_KEYS.forEach(function(s, si){
        if (!sq[si]) return;
        var pq = _aaSplit(sq[si], pw);
        _AA_PRIO_KEYS.forEach(function(p, pi){
          if (!pq[pi]) return;
          var got = take(s, p, pq[pi], phones);
          if (got < pq[pi]) miss += pq[pi] - got;
        });
      });
    }
    if (miss > 0){   // bu: cung nguon da chon truoc (theo uu tien co trong so cao), roi cac nguon con lai co trong so > 0 (bu KHONG phan biet hang)
      for (var a = 0; a < srcOrder.length && miss > 0; a++)
        for (var c2 = 0; c2 < prOrder.length && miss > 0; c2++) miss -= take(srcOrder[a], prOrder[c2], miss, phones);
    }
    if (miss > 0) short.push({ name:r.name, team:r.teamName, missing:miss, quota:r.quota });
    if (phones.length) entries.push({ team:r.teamName, teamId:r.team, name:r.name, phones:phones, quota:r.quota });
  });
  return { entries:entries, short:short, warn:rc.warn };
}
// CSKH-Duyen chia RIENG: moi nguoi 1 han muc CSKH/ngay (cung kieu Team/thanh vien nhu POS), lay lan luot tu danh sach KH nguon CSKH-Duyen
// (khong chia theo nguon/uu tien/hang). `taken` dung chung voi POS de 1 SDT khong bi chia 2 lan trong cung 1 ngay.
function _aaPlanCskh(cfg, teamsArr, membersOf, custs, everSet, taken){
  var c2 = { teams: cfg.cskhTeams || {}, dailyTotal: cfg.cskhTotal || 0, memberMode: cfg.cskhMemberMode || {}, members: cfg.cskhMembers || {} };
  var rc = _aaRecipients(c2, teamsArr, membersOf), pool = [], entries = [], short = [], ptr = 0;
  for (var i = 0; i < custs.length; i++){
    var c = custs[i]; if (!c || !c.phone || !(c.dataSrc && c.dataSrc.cskh)) continue;
    if (cfg.onlyUnassigned && everSet && everSet.has(c.phone)) continue;
    pool.push(c.phone);
  }
  rc.list.forEach(function(r){
    var phones = [];
    while (phones.length < r.quota && ptr < pool.length){ var ph = pool[ptr++]; if (!taken.has(ph)) { taken.add(ph); phones.push(ph); } }
    if (phones.length < r.quota) short.push({ name:r.name, team:r.teamName, missing:r.quota - phones.length, quota:r.quota, src:'cskh' });
    if (phones.length) entries.push({ team:r.teamName, teamId:r.team, name:r.name, phones:phones, quota:r.quota, src:'cskh' });
  });
  return { entries:entries, short:short, warn:rc.warn.map(function(w){ return '[CSKH] ' + w; }) };
}
// Khoang NGAY DON cho chia tu dong (cfg.dateFrom/dateTo 'YYYY-MM-DD'). CHI ap cho POS/Base; CSKH-Duyen chia rieng, khong loc ngay. GIONG _aaDateOk o index/js.
function _aaDateOk_(cfg, c) {
  if (!cfg.dateFrom && !cfg.dateTo) return true;
  return (c.ds || []).some(function (d) { return d && (!cfg.dateFrom || d >= cfg.dateFrom) && (!cfg.dateTo || d <= cfg.dateTo); });
}
// Ke hoach ca ngay = CSKH (rieng) + POS (tu dt/don/cs). opts: {pos:bool, cskh:bool} (mac dinh ca hai). CHIEN DICH 1 = POS/Base chay TRUOC (theo yeu cau Duyen 2026-10-10), roi toi CSKH-Duyen (rieng): KH co ca 2 nguon thuoc ve POS/Base.
function _aaPlanAll(cfg, teamsArr, membersOf, custs, everSet, opts){
  custs = (custs || []).filter(function (c) { return c && isValidVnPhone_(c.phone); });   // chi chia SDT di dong VN hop le
  opts = opts || {}; var taken = new Set(), out = { entries:[], short:[], warn:[] };
  if (opts.pos !== false){
    var p = _aaPlan(cfg, teamsArr, membersOf, (cfg.dateFrom || cfg.dateTo) ? custs.filter(function (c) { return _aaDateOk_(cfg, c); }) : custs, everSet, taken);
    p.entries.forEach(function(e){ e.src = 'pos'; }); p.short.forEach(function(x){ x.src = 'pos'; });
    out.entries = out.entries.concat(p.entries); out.short = out.short.concat(p.short); out.warn = out.warn.concat(p.warn);
  }
  if (opts.cskh !== false){
    var k = _aaPlanCskh(cfg, teamsArr, membersOf, custs, everSet, taken);
    out.entries = out.entries.concat(k.entries); out.short = out.short.concat(k.short); out.warn = out.warn.concat(k.warn);
  }
  return out;
}

function _aaReadJson_(key) { var raw = getSetting_(key); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }
function _aaWriteJson_(key, obj) { setSetting_(key, JSON.stringify(obj)); }

// Dung lai DUNG nguon/hang nhu buildCustomers (index.html): dt = co don o DT TONG; don = co trong "du lieu don";
// cs = KH o sheet Cham soc (phai co ten hoac thuoc nguon khac moi tinh la khach); cskh = CSKH-Duyen.
// Hang: dem so dong "du lieu don": >=10 VIP, >=5 Than thiet, >=2 Tiem nang, con lai Chua ban lai duoc (nhom 'other').
// Phan hang KH theo doanh thu luy ke: <15tr Khach thuong | 15-<30tr Than thiet | 30-<50tr Vip | >=50tr Super VVip (GIONG _hangKeyOf_ o index.html)
function _aaHangKey_(rev) { rev = Number(rev) || 0; return rev >= 50000000 ? 'super' : rev >= 30000000 ? 'vip' : rev >= 15000000 ? 'tt' : 'thuong'; }
function _aaLoadCustomers_() {
  var src = {}, leadName = {};
  function mark(p, k) { if (!p) return; (src[p] = src[p] || {})[k] = true; }
  var revBy = {};   // PHAN HANG KH: doanh thu theo SDT CHI TINH THEO POS (bo hoan; KH khong co don Pos = 0) -- cung quy tac c.totalRevenue o index.html
  var posStats = getDonStatsByPhone_(), posOn = Object.keys(posStats).length > 0;   // CHI TINH THEO POS; sheet Pos trong thi tam dung Base
  var dsBy = {};   // ngay don (YYYY-MM-DD) theo SDT tu DT TONG — dung loc khoang ngay (cfg.dateFrom/dateTo), cung nguon ymList[].ds o client
  readAllOrders_().forEach(function (o) {
    mark(o.phone, 'dt'); if (o.phone) revBy[o.phone] = (revBy[o.phone] || 0) + (Number(o.revenue) || 0);
    if (o.phone && o.date) { var _dd = parseVNDate_(o.date), _iso = _dd ? _vnYmd_(_dd) : ''; if (_iso) { var _a = dsBy[o.phone] = dsBy[o.phone] || []; if (_a.indexOf(_iso) < 0) _a.push(_iso); } }
  });
  readCareLeads_().forEach(function (r) { mark(r.phone, 'cs'); if (r.name) leadName[r.phone] = true; });
  readCskhDuyenLite_().rows.forEach(function (r) { mark(r[0], 'cskh'); });
  readDonPhones_().forEach(function (p) { mark(p, 'don'); });
  var cnt = getDonOrderCountByPhone_(), custs = [];
  Object.keys(src).forEach(function (p) {
    var d = src[p];
    if (!(d.dt || d.don || d.cskh || (d.cs && leadName[p]))) return;
    var n = cnt[p] || 0;
    custs.push({ phone: p, dataSrc: { dt: !!d.dt, don: !!d.don, cs: !!d.cs, cskh: !!d.cskh }, tier: n >= 10 ? 'VIP' : n >= 5 ? 'Thân thiết' : n >= 2 ? 'Tiềm năng' : 'Chưa bán lại được', hangKey: _aaHangKey_(posOn ? (posStats[p] ? posStats[p].rev : 0) : (revBy[p] || 0)), ds: dsBy[p] || [] });
  });
  var ever = {};
  readAssign_(getCrmSS_().getSheetByName(SH_ASSIGN)).forEach(function (h) { (h.phones || []).forEach(function (p) { ever[p] = true; }); });
  return { custs: custs, ever: ever };
}
// Ghi CS cham soc vao CareData (cot cs + updated) cho cac SDT vua chia — giong _applyCareCSToAssigned o client (CS chia sau cung thang)
function _aaSetCareCS_(map) {
  var phones = Object.keys(map); if (!phones.length) return 0;
  var sh = getSheet_(SH_CARE, CARE_HEADERS), W = CARE_HEADERS.length, last = sh.getLastRow(), idx = {}, iso = new Date().toISOString();
  var csV = [], upV = [];
  if (last >= 2) {
    var colA = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < colA.length; i++) { if (colA[i][0]) idx[normPhone_(String(colA[i][0]))] = i; }
    csV = sh.getRange(2, 4, last - 1, 1).getValues(); upV = sh.getRange(2, 15, last - 1, 1).getValues();
  }
  var dirty = false, newRows = [];
  phones.forEach(function (p) {
    if (idx[p] !== undefined) { csV[idx[p]][0] = map[p]; upV[idx[p]][0] = iso; dirty = true; }
    else newRows.push(careRow_({ phone: p, cs: map[p] }));
  });
  if (dirty) { sh.getRange(2, 4, csV.length, 1).setValues(csV); sh.getRange(2, 15, upV.length, 1).setValues(upV); }
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, W).setValues(newRows);
  try { CacheService.getScriptCache().remove('customers_v12'); } catch (e) {}
  try { invalidateLookupCache_(phones); } catch (e2) {}
  if (sbWriteOn_()) {   // dong da co: chi doi cs + updated -> PATCH theo nhom CS; dong moi: upsert ca dong
    var byCs = {};
    phones.forEach(function (p) { if (idx[p] !== undefined) (byCs[map[p]] = byCs[map[p]] || []).push(p); });
    Object.keys(byCs).forEach(function (csName) { sbPatchCare_(byCs[csName], { cs: csName, updated: iso, updated_at: iso }, '_aaSetCareCS_'); });
    sbMirrorCare_(sbRowsToRecs_(newRows), '_aaSetCareCS_');
  }
  return phones.length;
}
// force=true: chay ngay bat ke lich (dung de thu tu Editor). Trigger goi autoAssignTick_ (force=false).
function autoAssignRun_(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { skipped: 'busy' };
  try {
    var cfg = _aaReadJson_('autoAssignCfg'); if (!cfg) return { skipped: 'chua co cau hinh' };
    cfg.teams = cfg.teams || {}; cfg.days = cfg.days || []; cfg.members = cfg.members || {}; cfg.memberMode = cfg.memberMode || {};
    cfg.cskhTeams = cfg.cskhTeams || {}; cfg.cskhMembers = cfg.cskhMembers || {}; cfg.cskhMemberMode = cfg.cskhMemberMode || {}; cfg.cskhDays = cfg.cskhDays || [1, 2, 3, 4, 5, 6];
    cfg.src = cfg.src || { mode: 'pct', vals: {} }; cfg.prio = cfg.prio || { mode: 'pct', vals: {} }; cfg.hang = cfg.hang || { mode: 'pct', vals: {} };
    var st = _aaReadJson_('autoAssignState') || {};
    var now = new Date(), today = Utilities.formatDate(now, AA_TZ, 'yyyy-MM-dd');
    var opts = { pos: true, cskh: true };   // force: chay ca 2 muc (muc nao chua tich Team/han muc thi tu khong chia gi)
    if (!force) {
      var hour = parseInt(Utilities.formatDate(now, AA_TZ, 'H'), 10), dow = parseInt(Utilities.formatDate(now, AA_TZ, 'u'), 10) % 7;   // 'u': 1=T2..7=CN -> 0=CN
      var runHour = (cfg.runHour === undefined || cfg.runHour === null || cfg.runHour === '') ? 7 : (parseInt(cfg.runHour, 10) || 0);
      var posOk = !!cfg.enabled && cfg.days.indexOf(dow) >= 0, cskhOk = !!cfg.cskhEnabled && cfg.cskhDays.indexOf(dow) >= 0;   // POS va CSKH-Duyen co cong tac + ngay RIENG
      if (!cfg.enabled && !cfg.cskhEnabled) return { skipped: 'dang tat' };
      if (!posOk && !cskhOk) return { skipped: 'hom nay khong tich chia' };
      opts = { pos: posOk, cskh: cskhOk };
      if (hour < runHour) return { skipped: 'chua den gio (' + runHour + 'h)' };
      if (st.lastRun === today) return { skipped: 'hom nay da chia' };
      st.lastRun = today; st.by = 'server'; st.startedAt = now.toISOString();
      _aaWriteJson_('autoAssignState', st);   // danh dau TRUOC khi chia: loi giua chung thi khong tu chia lai gay trung
    }
    var teams = readTeams_(getCrmSS_().getSheetByName(SH_TEAM));
    var membersOf = function (t) {
      var m = cfg.teamMembers && cfg.teamMembers[t.id];   // UI luu san danh sach da gop 1-nguoi-nhieu-ten
      if (m && m.length) return m;
      var seen = {}, out = [];
      [t.leader].concat(t.members || []).forEach(function (n) { if (n && !seen[n]) { seen[n] = true; out.push(n); } });
      return out;
    };
    var u = _aaLoadCustomers_();
    var everSet = { has: function (p) { return !!u.ever[p]; } };
    var plan = _aaPlanAll(cfg, teams, membersOf, u.custs, everSet, opts);
    var dm = today.slice(8) + '/' + today.slice(5, 7), nowStr = now.toISOString().slice(0, 16).replace('T', ' '), careMap = {}, total = 0;
    plan.entries.forEach(function (e) {
      var en = { id: now.getTime() + '_' + Math.random().toString(36).slice(2, 6), date: nowStr, csName: e.name, phones: e.phones, donePhones: [],
        label: (force ? 'Chạy thử' : 'Tự động ' + dm) + (e.src === 'cskh' ? ' CSKH-Duyên' : '') + ' — ' + e.team + ' → ' + e.name + ' (' + e.phones.length + ' KH)', team: e.team, auto: true };
      saveAssignEntry_(en);
      e.phones.forEach(function (p) { careMap[p] = e.name; });
      total += e.phones.length;
    });
    _aaSetCareCS_(careMap);
    st.lastResult = { date: today, total: total, people: plan.entries.length, short: plan.short, warn: plan.warn, forced: !!force, by: 'server' };
    st.finishedAt = new Date().toISOString();
    if (force && !st.lastRun) st.lastRun = '';
    _aaWriteJson_('autoAssignState', st);
    try { CacheService.getScriptCache().remove('customers_v12'); } catch (e3) {}
    return st.lastResult;
  } finally { lock.releaseLock(); }
}
function autoAssignTick_() { return autoAssignRun_(false); }
function autoAssignRunNow_() { return autoAssignRun_(true); }   // chay thu tu Editor (chia THAT)
function installAutoAssignTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'autoAssignTick_'; });
  if (ex.length) return 'Trigger "autoAssignTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('autoAssignTick_').timeBased().everyHours(1).create();
  return 'Da tao trigger chay moi gio. Chi chia khi: dang bat + hom nay duoc tich + da qua gio cai + chua chia hom nay.';
}
function removeAutoAssignTrigger_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'autoAssignTick_') { ScriptApp.deleteTrigger(t); n++; } });
  return 'Da go ' + n + ' trigger autoAssignTick_.';
}
function caiTriggerChiaTuDong() {
  Logger.log(installAutoAssignTrigger_());
}
function chayThuChiaTuDong() {   // CHIA THẬT ngay, không phải chạy thử
  Logger.log(JSON.stringify(autoAssignRun_(true)));
}
function goTriggerChiaTuDong() {
  Logger.log(removeAutoAssignTrigger_());
}

// ═══════════════════════════════════════════════════════════════
//  LUU TRU DON CU (yeu cau Duyen 2026-10-08): chuyen don cu hon 6–12 thang tu "DT TỔNG " va "dữ liệu đơn"
//  sang 2 sheet luu tru CUNG spreadsheet (DT_SS_ID) de bao cao hang ngay doc it dong hon.
//  An toan: (1) mac dinh DRY-RUN, chi dem; (2) COPY sang sheet luu tru -> DOI CHIEU lai tung o -> moi XOA
//  khoi sheet goc (sai 1 o la huy, xoa ban copy, KHONG xoa goc); (3) chi chay khi co adminKey + khoa script;
//  (4) moi lan chay gioi han so dong/so khoi xoa de khong vuot 6 phut giua chung (copy xong ma chua xoa het
//  se gay trung khi chay lai).
//  TIEN DO (xem docs/ARCHIVE-PLAN.md): buoc 1 = ham luu tru + dry-run (xong). Buoc 2 = cac ham doc lich su khach
//  (lookup/allCustomers/donStats) + bao cao co khoang ngay cu phai doc them sheet luu tru; CHUA xong thi
//  ARCHIVE_APPLY_ENABLED_ = false nen chay that bi tu choi — tranh mat lich su khach.
// ═══════════════════════════════════════════════════════════════
var ARCHIVE_SUFFIX_ = '_LƯU TRỮ';
var ARCHIVE_LOG_SHEET_ = '_ARCHIVE_LOG';
var ARCHIVE_DEFAULT_MONTHS_ = 12;
var ARCHIVE_MIN_MONTHS_ = 6;
var ARCHIVE_MAX_ROWS_PER_RUN_ = 20000;
var ARCHIVE_MAX_DELETE_RUNS_ = 300;
var ARCHIVE_APPLY_ENABLED_ = false; // bat len true CHI KHI buoc 2 (doc lich su ca sheet luu tru) da xong

// Ngay -> so yyyymmdd (0 neu khong doc duoc). Date: theo gio VN co dinh (_vnYmdParts_); chuoi: dd/MM/yyyy[ ...].
function _arcYmd_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var p = _vnYmdParts_(v);
    return p ? p.y * 10000 + p.mo * 100 + p.d : 0;
  }
  var m = String(v == null ? '' : v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 0;
  var d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return 0;
  return y * 10000 + mo * 100 + d;
}

// Moc cat: hom nay (gio VN) lui `months` thang -> yyyymmdd. Don co ngay < moc cat moi bi luu tru.
function _arcCutoffYmd_(months) {
  var p = _vnYmdParts_(new Date());
  var mo = p.mo - months, y = p.y;
  while (mo < 1) { mo += 12; y--; }
  var dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return y * 10000 + mo * 100 + Math.min(p.d, dim);
}

function _arcMonths_(months) {
  var m = parseInt(months, 10);
  if (!m || isNaN(m)) m = parseInt(getSetting_('archiveMonths'), 10) || ARCHIVE_DEFAULT_MONTHS_;
  return Math.max(ARCHIVE_MIN_MONTHS_, m);
}

// Chon cac dong (index 0-based trong vals) can luu tru. kind: 'base' (DT TONG) | 'pos' (du lieu don).
// base: dong du lieu that (co SDT/ID/gia tri don) va MOI ngay doc duoc (cot A ngayTao, cot K thoiGianHT) deu < moc cat;
//       khong doc duoc ngay nao -> GIU.
// pos : ngay = cot B, dong thieu ngay ke thua ngay dong co ngay gan nhat phia tren (y het readDonChiTiet_), nen dong
//       noi tiep luon di cung dong cha; dong khong phai don (rong/"Tong") -> GIU.
function _arcPickRows_(vals, kind, cutoff) {
  var picked = [], runs = 0, prev = -2, lastYmd = 0, oldest = 0, newest = 0;
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i], ymd = 0, real = false;
    if (kind === 'base') {
      real = !!(r[DT_COL_PHONE] || r[DT_COL_ID] || r[DT_COL_GIATRIDON]);
      if (real) {
        var a = _arcYmd_(r[DT_COL_NGAYTAO]), k = _arcYmd_(r[DT_COL_THOIGIANHT]);
        ymd = Math.max(a, k);
      }
    } else {
      real = !!(r[1] || r[3] || (r[DON_COL_GHICHU] && String(r[DON_COL_GHICHU]).trim()));
      if (real) {
        var b = _arcYmd_(r[1]);
        if (b) lastYmd = b; else b = lastYmd;
        ymd = b;
      }
    }
    if (!real || !ymd || ymd >= cutoff) continue;
    if (picked.length >= ARCHIVE_MAX_ROWS_PER_RUN_) break;
    var newRun = (i !== prev + 1);
    if (newRun && runs >= ARCHIVE_MAX_DELETE_RUNS_) break;
    if (newRun) runs++;
    picked.push(i); prev = i;
    if (!oldest || ymd < oldest) oldest = ymd;
    if (ymd > newest) newest = ymd;
  }
  return { idx: picked, runs: runs, oldest: oldest, newest: newest };
}

function _arcSig_(row) { return row.map(function(v) { return String(v); }).join('\u0001'); }

// Chong Sheets tu doi chuoi giong so/ngay/cong thuc khi setValues (vd "0912..." mat so 0, "08/10/2026" thanh ngay).
function _arcSafeCell_(v) {
  return (typeof v === 'string' && v !== '' && /^['0-9=+\-]/.test(v)) ? "'" + v : v;
}

function _arcLogRow_(ss, arr) {
  try {
    var lg = ss.getSheetByName(ARCHIVE_LOG_SHEET_);
    if (!lg) { lg = ss.insertSheet(ARCHIVE_LOG_SHEET_); lg.appendRow(['Thoi gian', 'Sheet goc', 'So thang', 'Moc cat (yyyymmdd)', 'So dong chuyen', 'Dong dau trong luu tru', 'Ghi chu']); }
    lg.appendRow(arr);
  } catch (e) { Logger.log('_arcLogRow_: ' + e); }
}

// 1 sheet: kind 'base'|'pos'. apply=false -> chi dem. Tra ve object ket qua (khong jsonOut).
function _arcOneSheet_(ss, sheetName, kind, cutoff, months, apply) {
  var res = { sheet: sheetName, archiveSheet: sheetName.replace(/\s+$/, '') + ARCHIVE_SUFFIX_, kind: kind };
  var sh = ss.getSheetByName(sheetName);
  if (!sh) { res.error = 'Khong thay sheet ' + sheetName; return res; }
  var last = sh.getLastRow(), lastCol = sh.getLastColumn();
  res.totalRows = Math.max(0, last - 1);
  if (last < 2) { res.toArchive = 0; return res; }
  var vals = sh.getRange(2, 1, last - 1, lastCol).getValues();
  var pick = _arcPickRows_(vals, kind, cutoff);
  res.toArchive = pick.idx.length; res.deleteRuns = pick.runs;
  res.oldestYmd = pick.oldest; res.newestYmd = pick.newest;
  res.capped = pick.idx.length >= ARCHIVE_MAX_ROWS_PER_RUN_ || pick.runs >= ARCHIVE_MAX_DELETE_RUNS_;
  if (!apply || !pick.idx.length) return res;

  var n = pick.idx.length;
  var block = pick.idx.map(function(i) { return vals[i]; });
  var sigs = block.map(_arcSig_);
  var arch = ss.getSheetByName(res.archiveSheet);
  if (!arch) {
    arch = ss.insertSheet(res.archiveSheet);
    sh.getRange(1, 1, 1, lastCol).copyTo(arch.getRange(1, 1, 1, lastCol)); // tieu de + dinh dang tieu de
  }
  var startRow = arch.getLastRow() + 1;
  if (startRow < 2) startRow = 2;
  if (arch.getMaxRows() < startRow + n - 1) arch.insertRowsAfter(arch.getMaxRows(), startRow + n - 1 - arch.getMaxRows());
  if (arch.getMaxColumns() < lastCol) arch.insertColumnsAfter(arch.getMaxColumns(), lastCol - arch.getMaxColumns());
  for (var s = 0; s < n; s += 5000) {
    var chunk = block.slice(s, s + 5000).map(function(row) { return row.map(_arcSafeCell_); });
    arch.getRange(startRow + s, 1, chunk.length, lastCol).setValues(chunk);
  }
  SpreadsheetApp.flush();
  // DOI CHIEU tung o ban copy voi goc truoc khi xoa
  var back = arch.getRange(startRow, 1, n, lastCol).getValues(), bad = 0;
  for (var q = 0; q < n; q++) { if (_arcSig_(back[q]) !== sigs[q]) bad++; }
  if (bad) {
    arch.getRange(startRow, 1, n, lastCol).clearContent();
    res.error = 'Doi chieu loi ' + bad + '/' + n + ' dong -> HUY, da xoa ban copy, KHONG xoa du lieu goc.';
    return res;
  }
  // Goc co the vua bi sua/chen dong trong luc ta xu ly -> doc lai & so sanh dung vi tri truoc khi xoa
  var cur = sh.getRange(2, 1, Math.min(sh.getLastRow() - 1, last - 1), lastCol).getValues();
  for (var c = 0; c < n; c++) {
    var cr = cur[pick.idx[c]];
    if (!cr || _arcSig_(cr) !== sigs[c]) {
      arch.getRange(startRow, 1, n, lastCol).clearContent();
      res.error = 'Sheet goc vua bi thay doi trong luc luu tru (dong ' + (pick.idx[c] + 2) + ') -> HUY, da xoa ban copy, KHONG xoa du lieu goc. Chay lai.';
      return res;
    }
  }
  // Xoa tu duoi len theo tung khoi lien tiep
  var runsArr = [], st = pick.idx[0], pv = st;
  for (var k = 1; k < n; k++) { if (pick.idx[k] === pv + 1) { pv = pick.idx[k]; } else { runsArr.push([st, pv]); st = pick.idx[k]; pv = st; } }
  runsArr.push([st, pv]);
  for (var z = runsArr.length - 1; z >= 0; z--) sh.deleteRows(runsArr[z][0] + 2, runsArr[z][1] - runsArr[z][0] + 1);
  res.archived = n; res.archiveStartRow = startRow;
  _arcLogRow_(ss, [new Date(), sheetName, months, cutoff, n, startRow, 'OK']);
  return res;
}

// opts: { months, dryRun (mac dinh true), which: 'base'|'pos'|'both' (mac dinh both) }
function archiveOldOrders_(opts) {
  opts = opts || {};
  var months = _arcMonths_(opts.months);
  var cutoff = _arcCutoffYmd_(months);
  var apply = opts.dryRun === false || opts.dryRun === 'false' || opts.dryRun === 0 || opts.dryRun === '0';
  var out = { ok: true, months: months, cutoffYmd: cutoff, dryRun: !apply, sheets: [] };
  if (apply && !ARCHIVE_APPLY_ENABLED_) {
    out.ok = false; out.dryRun = true;
    out.error = 'Chua cho phep chay that: cac ham doc lich su khach/bao cao chua doc sheet luu tru (xem docs/ARCHIVE-PLAN.md). Chi dung dryRun.';
    apply = false;
  }
  var which = opts.which || 'both';
  var lock = null;
  if (apply) { lock = LockService.getScriptLock(); lock.waitLock(30000); }
  try {
    var ss = getDTSS_();
    if (which === 'both' || which === 'base') out.sheets.push(_arcOneSheet_(ss, DT_TONG_SHEET, 'base', cutoff, months, apply));
    if (which === 'both' || which === 'pos')  out.sheets.push(_arcOneSheet_(ss, DON_CHITIET_SHEET, 'pos', cutoff, months, apply));
    if (apply) {
      setSetting_('archiveBoundaryYmd', String(cutoff));
      sbMarkOrdersDirty_('dt', 'archive'); sbMarkOrdersDirty_('don', 'archive');   // Supabase buoc 4b: archive xoa dong khoi Sheet
      try {
        var cache = CacheService.getScriptCache();
        cache.removeAll(['srptOptions_v3', 'orders_v1_n', 'donChiTiet_v4_n', 'don_phones_v6_n']);
      } catch (ec) {}
    }
  } finally { if (lock) lock.releaseLock(); }
  out.sheets.forEach(function(s) { if (s.error) out.ok = false; });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE (Postgres) — BUOC 2/5 cua docs/SUPABASE-PLAN.md. CHUA doi lookup/saveSingle (khong anh huong extension).
//  Cau hinh: Apps Script -> Project Settings -> Script Properties: SUPABASE_URL (https://xxxx.supabase.co) va
//  SUPABASE_KEY (service_role). KHONG luu key trong Settings sheet / code / chat (Settings sheet de CRM doc duoc).
//  Cac action Supabase deu can adminKey. Backfill chay lap lai den khi done=true (moi lan toi da ~4 phut, con tro o Script Properties).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_BATCH_ = 500;
var SB_TIME_BUDGET_MS_ = 240000;   // Apps Script cat o 6 phut — dung 4 phut roi tra ve de goi lai
var SB_CARE_COLS_ = ['phone','status','zalo','cs','note','schedules','sched_goi','sched_goi_note','sched_sp','sched_sp_note',
  'sched_cs','sched_cs_note','sched_hen','sched_hen_note','updated','kh_status','nick_zalos','birthday','zalo_set_by','name','custom','zalo_phones'];
// Thu tu PHAI giong CARE_HEADERS (22 cot) va supabase/schema.sql — sbCareRowToRec_ map theo vi tri.

function sbCfg_() {
  var pr = PropertiesService.getScriptProperties();
  var url = String(pr.getProperty('SUPABASE_URL') || '').replace(/\/+$/, '');
  var key = String(pr.getProperty('SUPABASE_KEY') || '');
  return { url: url, key: key, ok: !!(url && key) };
}

// Goi REST Supabase. Tra { code, text, json, headers }. Nem loi (KHONG kem key) neu HTTP >= 300.
function sb_(method, path, body, extraHeaders) {
  var cfg = sbCfg_();
  if (!cfg.ok) throw new Error('Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.');
  var headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  var k;
  if (extraHeaders) for (k in extraHeaders) headers[k] = extraHeaders[k];
  var opt = { method: method, headers: headers, muteHttpExceptions: true, contentType: 'application/json' };
  if (body !== undefined && body !== null) opt.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/' + path, opt);
  var code = res.getResponseCode(), text = res.getContentText() || '';
  if (code >= 300) throw new Error('Supabase HTTP ' + code + ' (' + method + ' ' + String(path).split('?')[0] + '): ' + text.slice(0, 300));
  var json = null;
  if (text) { try { json = JSON.parse(text); } catch (eJ) {} }
  return { code: code, text: text, json: json, headers: res.getAllHeaders ? res.getAllHeaders() : {} };
}

function _sbCell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v);
}

// 1 dong sheet CareData (mang 22 o) -> object cot Supabase. null neu khong co SDT hop le.
function sbCareRowToRec_(row) {
  var phone = normPhone_(_sbCell_(row[0]));
  if (!phone) return null;
  var rec = {};
  for (var i = 0; i < SB_CARE_COLS_.length; i++) rec[SB_CARE_COLS_[i]] = _sbCell_(row[i]);
  rec.phone = phone;
  if (!rec.nick_zalos) rec.nick_zalos = '[]';
  if (!rec.zalo_phones) rec.zalo_phones = '[]';
  var d = rec.updated ? new Date(rec.updated) : null;
  rec.updated_at = (d && !isNaN(d.getTime())) ? d.toISOString() : new Date().toISOString();
  return rec;
}

// Kiem tra ket noi Supabase (doc 1 dong care_data). KHONG tra key. Dung cho action sbPing va trigger hang ngay.
function sbPing_() {
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, configured: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var t0 = Date.now();
  try {
    sb_('GET', 'care_data?select=phone&limit=1');
    return { ok: true, configured: true, ms: Date.now() - t0 };
  } catch (e) { return { ok: false, configured: true, error: String(e && e.message || e) }; }
}

// Trigger hang ngay: Supabase free tu pause sau 7 ngay khong hoat dong -> goi nhe moi ngay de giu hoat dong.
// Chay 1 lan thu cong: chon ham caiTriggerSbPing trong Apps Script Editor -> Run (xem log).
function sbPingTick_() { Logger.log('sbPing ' + JSON.stringify(sbPing_())); }
function installSbPingTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sbPingTick_'; });
  if (ex.length) return 'Trigger "sbPingTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('sbPingTick_').timeBased().everyDays(1).create();
  return 'Da tao trigger sbPingTick_ chay moi ngay (giu Supabase free khong bi pause).';
}
function caiTriggerSbPing() { Logger.log(installSbPingTrigger_()); }

// Day CareData len Supabase theo lo SB_BATCH_ dong, upsert theo phone, co con tro resume (Script Properties SB_CARE_CURSOR = so dong ke tiep).
// opts: { dryRun (mac dinh TRUE = chi dem, khong ghi, khong dich con tro), reset (ve dong 2) }. Goi lai den khi done=true.
// SDT trung nhieu dong: CHI day dong DAU TIEN cua moi SDT (giong saveSingleCare_ va sbCompareCare_), dong sau tinh vao dupSkipped.
// Luu y: neu co dong bi chen/xoa phia tren con tro giua 2 lan goi thi con tro lech -> chay lai voi reset:true roi sbCompareCare.
function sbBackfillCare_(opts) {
  opts = opts || {};
  var dryRun = opts.dryRun !== false && opts.dryRun !== 'false';
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'Dang co lan backfill/ghi khac chay — thu lai sau.' };
  var t0 = Date.now();
  try {
    var pr = PropertiesService.getScriptProperties();
    if (opts.reset === true || opts.reset === 'true') pr.deleteProperty('SB_CARE_CURSOR');
    var cursor = parseInt(pr.getProperty('SB_CARE_CURSOR') || '2', 10);
    if (!(cursor >= 2)) cursor = 2;
    var sh = getSheet_(SH_CARE, CARE_HEADERS);
    var last = sh.getLastRow();
    // Dong dau tien cua moi SDT (1 lan doc cot A) de bo cac dong trung xuyen suot cac lo.
    var firstRow = {};
    if (last >= 2) {
      var colA = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var ci = 0; ci < colA.length; ci++) {
        var pc = normPhone_(_sbCell_(colA[ci][0]));
        if (pc && firstRow[pc] === undefined) firstRow[pc] = ci + 2;
      }
    }
    var st = { pushed: 0, dupSkipped: 0, skippedNoPhone: 0, batches: 0 };
    // Luon chay it nhat 1 lo moi lan goi (st.batches===0) de chac chan co tien trien du doc cot A da ton het ngan sach.
    while (cursor <= last && (st.batches === 0 || (Date.now() - t0) < SB_TIME_BUDGET_MS_)) {
      var n = Math.min(SB_BATCH_, last - cursor + 1);
      var vals = sh.getRange(cursor, 1, n, CARE_HEADERS.length).getValues();
      var recs = [];
      for (var i = 0; i < vals.length; i++) {
        var rec = sbCareRowToRec_(vals[i]);
        if (!rec) { st.skippedNoPhone++; continue; }
        if (firstRow[rec.phone] !== cursor + i) { st.dupSkipped++; continue; }
        recs.push(rec);
      }
      if (recs.length && !dryRun) {
        sb_('POST', 'care_data?on_conflict=phone', recs, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      }
      st.pushed += recs.length; st.batches++;
      cursor += n;
      if (!dryRun) pr.setProperty('SB_CARE_CURSOR', String(cursor));   // dryRun KHONG dich con tro; lo loi thi nhay vao catch, con tro giu nguyen
    }
    var done = cursor > last;
    return { ok: true, dryRun: dryRun, done: done, nextRow: cursor, lastRow: last, pushed: st.pushed, batches: st.batches,
      dupSkipped: st.dupSkipped, skippedNoPhone: st.skippedNoPhone, ms: Date.now() - t0,
      hint: dryRun ? 'Day la chay thu (chua ghi). Gui dryRun:false de ghi that.' : (done ? 'Xong. Chay sbCompareCare de doi chieu.' : 'Chua het — goi lai action nay (dryRun:false) de tiep tuc.') };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { try { lock.releaseLock(); } catch (eL) {} }
}

function _sbHeader_(headers, name) {
  var low = String(name).toLowerCase();
  for (var k in headers) if (String(k).toLowerCase() === low) return headers[k];
  return '';
}

// Doi chieu CareData (Sheet) vs care_data (Supabase): (1) so SDT khac nhau tren Sheet == so dong Supabase, (2) so sanh TUNG TRUONG tren
// mau rai deu cac dong dau tien cua moi SDT. opts.sample (mac dinh 100, toi da 300). ok=true chi khi (1) khop va khong co lech o (2).
// Day la doi chieu theo mau (khong phai checksum toan bang): muon chac hon thi tang sample hoac chay nhieu lan sau khi backfill xong.
function sbCompareCare_(opts) {
  opts = opts || {};
  var sample = Math.max(1, Math.min(300, parseInt(opts.sample, 10) || 100));
  try {
    var sh = getSheet_(SH_CARE, CARE_HEADERS);
    var last = sh.getLastRow();
    var rows = Math.max(0, last - 1), distinct = {}, nDistinct = 0, noPhone = 0, picks = [];
    if (rows) {
      var col = sh.getRange(2, 1, rows, 1).getValues();
      for (var i = 0; i < col.length; i++) {
        var p = normPhone_(_sbCell_(col[i][0]));
        if (!p) { noPhone++; continue; }
        if (!distinct[p]) { distinct[p] = i + 2; nDistinct++; }   // dong DAU tien cua moi SDT
      }
      var firstRows = []; for (var ph in distinct) firstRows.push(distinct[ph]);
      firstRows.sort(function (a, b) { return a - b; });
      var step = Math.max(1, Math.floor(firstRows.length / sample));
      for (var s = 0; s < firstRows.length && picks.length < sample; s += step) picks.push(firstRows[s]);
    }
    // limit=1 + count=exact -> Content-Range "0-0/N" (hoac "*/0" khi bang rong); khong dung header Range de tranh 416 tren bang rong.
    var res = sb_('GET', 'care_data?select=phone&limit=1', null, { Prefer: 'count=exact' });
    var cr = String(_sbHeader_(res.headers, 'content-range') || ''), m = cr.match(/\/(\d+)$/);
    var sbCount = m ? parseInt(m[1], 10) : -1;
    var checked = 0, mismatches = [];
    for (var b = 0; b < picks.length; b += 50) {
      var chunk = picks.slice(b, b + 50), recs = {}, inList = [];
      for (var c = 0; c < chunk.length; c++) {
        var rec = sbCareRowToRec_(sh.getRange(chunk[c], 1, 1, CARE_HEADERS.length).getValues()[0]);
        if (rec) { recs[rec.phone] = rec; inList.push('"' + rec.phone + '"'); }
      }
      if (!inList.length) continue;
      var got = sb_('GET', 'care_data?select=*&phone=in.(' + encodeURIComponent(inList.join(',')) + ')').json || [];
      var byPhone = {}; got.forEach(function (g) { byPhone[g.phone] = g; });
      for (var ph2 in recs) {
        checked++;
        var g2 = byPhone[ph2];
        if (!g2) { mismatches.push({ phone: ph2, problem: 'thieu tren Supabase' }); continue; }
        var diff = [];
        SB_CARE_COLS_.forEach(function (colName) { if (String(g2[colName] == null ? '' : g2[colName]) !== recs[ph2][colName]) diff.push(colName); });
        if (diff.length) mismatches.push({ phone: ph2, problem: 'khac cot', cols: diff });
      }
    }
    return { ok: (sbCount === nDistinct && mismatches.length === 0), sheetRows: rows, sheetDistinctPhones: nDistinct, sheetNoPhone: noPhone,
      supabaseRows: sbCount, sampleChecked: checked, mismatches: mismatches.slice(0, 20), mismatchCount: mismatches.length };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 3/5: GHI SONG SONG (dual-write) CareData + DOC lookup tu Supabase (3a: ha tang; 3b: noi vao cac ham ghi; 3c: lookup)
//  Che do luu o Script Property SB_MODE (KHONG dung Settings sheet: getSetting_ doc ca sheet Settings, co ca cac manh ma GAS rat lon,
//  qua nang cho duong luu cua CS):  'off' (mac dinh, khong lam gi) | 'write' (ghi Sheets roi mirror sang Supabase, van DOC Sheets) |
//  'read' (nhu 'write' + lookup doc Supabase). Doi bang action POST sbSetMode (adminKey). Rollback = sbSetMode mode:'off'.
//  NGUYEN TAC: Sheets van la nguon that. Mirror loi KHONG BAO GIO lam hong thao tac luu — chi ghi log + danh dau:
//    - SB_DIRTY_CARE: danh sach SDT mirror loi (toi da SB_DIRTY_MAX_). lookup cac SDT nay van doc Sheets. Sua bang action sbResyncCare.
//    - SB_STALE: Supabase co the LECH dien rong (ghi de ca sheet, dedupe, qua nhieu dong, khong khoa duoc...). Dang STALE thi lookup KHONG
//      doc Supabase. Go bang: backfill lai (reset:true) + sbCompareCare ok:true roi sbSetMode mode:'read' clearStale:true.
//  Thu tu bat an toan: sbSetMode 'write' -> sbBackfillCare (dryRun:false, lap den done) -> sbCompareCare ok:true -> sbSetMode 'read' clearStale:true.
//  Biet truoc: SDT trung nhieu dong tren Sheet (chay dedupeCare TRUOC khi backfill) va sua tay truc tiep tren Sheet KHONG duoc mirror
//  (khong co onEdit) -> sbCompareCare se lo ra.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_MIRROR_MAX_ = 2000;          // toi da so dong cho 1 lan mirror (= 4 lo SB_BATCH_); vuot -> danh dau STALE thay vi ghi
var SB_DIRTY_MAX_ = 300;            // toi da so SDT trong danh sach dirty (Script Property gioi han ~9KB); vuot -> STALE
var SB_READ_FALLBACK_ON_MISS_ = true; // lookup o che do 'read': Supabase khong co SDT -> doc them Sheets cho chac (dat false khi da tin Supabase)

function sbMode_() {
  var m = '';
  try { m = String(PropertiesService.getScriptProperties().getProperty('SB_MODE') || '').toLowerCase(); } catch (e) {}
  return (m === 'write' || m === 'read') ? m : 'off';
}
// Co can mirror ghi sang Supabase khong (che do != off VA da cau hinh URL/key).
function sbWriteOn_() { return sbMode_() !== 'off' && sbCfg_().ok; }

function sbStaleInfo_() { try { return PropertiesService.getScriptProperties().getProperty('SB_STALE') || ''; } catch (e) { return ''; } }
function sbMarkStale_(why) {
  try { PropertiesService.getScriptProperties().setProperty('SB_STALE', new Date().toISOString() + ' ' + String(why || '').slice(0, 200)); } catch (e) {}
}
function sbDirtyList_() {
  var a = [];
  try { a = JSON.parse(PropertiesService.getScriptProperties().getProperty('SB_DIRTY_CARE') || '[]'); } catch (e) { a = []; }
  return Array.isArray(a) ? a : [];
}
// Them SDT vao danh sach dirty (can khoa de tranh 2 luot ghi de nhau). Khong khoa duoc -> danh dau STALE (an toan hon la mat dau).
function sbMarkDirty_(phones, why) {
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(3000); } catch (e) { got = false; }
  try {
    if (!got) { sbMarkStale_('khong khoa duoc de ghi dirty: ' + why); return; }
    var set = {};
    sbDirtyList_().forEach(function (p) { set[p] = 1; });
    (phones || []).forEach(function (p) { if (p) set[p] = 1; });
    var list = Object.keys(set);
    if (list.length > SB_DIRTY_MAX_) { sbMarkStale_('qua nhieu dong dirty (' + list.length + '): ' + why); return; }
    PropertiesService.getScriptProperties().setProperty('SB_DIRTY_CARE', JSON.stringify(list));
  } finally { if (got) { try { lock.releaseLock(); } catch (e2) {} } }
}

function _sbInList_(phones) {
  return encodeURIComponent(phones.map(function (p) { return '"' + p + '"'; }).join(','));
}
// Moi SDT 1 rec: rec SAU CUNG thang (dung noi dung vua ghi), giu thu tu xuat hien dau tien.
function _sbUniqByPhone_(recs) {
  var m = {}, order = [];
  (recs || []).forEach(function (r) { if (!r || !r.phone) return; if (m[r.phone] === undefined) order.push(r.phone); m[r.phone] = r; });
  return order.map(function (p) { return m[p]; });
}
// Cac dong sheet (mang 22 o) -> mang rec Supabase (bo dong khong co SDT).
function sbRowsToRecs_(rows) {
  var out = [];
  (rows || []).forEach(function (r) { var rec = sbCareRowToRec_(r); if (rec) out.push(rec); });
  return out;
}

// Mirror cac rec DAY DU (22 cot) sang care_data. KHONG BAO GIO nem loi ra ngoai. Tra true neu da ghi / khong can ghi.
// Phai goi SAU KHI da ghi Sheets xong (va sau khi nha khoa script neu ham ghi dang giu khoa).
function sbMirrorCare_(recs, why) {
  try {
    if (!recs || !recs.length || !sbWriteOn_()) return true;
    recs = _sbUniqByPhone_(recs);
    if (recs.length > SB_MIRROR_MAX_) { sbMarkStale_('mirror ' + recs.length + ' dong > ' + SB_MIRROR_MAX_ + ' (' + why + ')'); return false; }
    for (var i = 0; i < recs.length; i += SB_BATCH_) {
      var chunk = recs.slice(i, i + SB_BATCH_);
      try {
        sb_('POST', 'care_data?on_conflict=phone', chunk, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      } catch (e) {
        sbMarkDirty_(recs.slice(i).map(function (r) { return r.phone; }), why);
        try { Logger.log('sbMirrorCare_ (' + why + ') loi: ' + String(e && e.message || e)); } catch (el) {}
        return false;
      }
    }
    return true;
  } catch (e0) {
    try { sbMarkStale_('sbMirrorCare_ ngoai le (' + why + '): ' + String(e0 && e0.message || e0)); } catch (e1) {}
    return false;
  }
}

// Cap nhat 1 so TRUONG cho cac dong DA CO tren Supabase (PATCH; dong chua co thi bi bo qua, KHONG tao dong thieu cot nhu upsert mot phan).
// Dung cho ham chi doi vai cot tren nhieu dong (vd _aaSetCareCS_: cs + updated). Khong nem loi ra ngoai.
function sbPatchCare_(phones, fields, why) {
  try {
    if (!phones || !phones.length || !sbWriteOn_()) return true;
    for (var i = 0; i < phones.length; i += 100) {
      var chunk = phones.slice(i, i + 100);
      try {
        sb_('PATCH', 'care_data?phone=in.(' + _sbInList_(chunk) + ')', fields, { Prefer: 'return=minimal' });
      } catch (e) {
        sbMarkDirty_(phones.slice(i), why);
        try { Logger.log('sbPatchCare_ (' + why + ') loi: ' + String(e && e.message || e)); } catch (el) {}
        return false;
      }
    }
    return true;
  } catch (e0) {
    try { sbMarkStale_('sbPatchCare_ ngoai le (' + why + '): ' + String(e0 && e0.message || e0)); } catch (e1) {}
    return false;
  }
}

// Sua cac SDT dirty: doc lai DONG DAU cua tung SDT tu Sheets va upsert len Supabase; SDT khong con tren Sheets -> xoa khoi Supabase.
function sbResyncCare_() {
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'Dang co lan backfill/ghi khac chay — thu lai sau.' };
  try {
    var dirty = sbDirtyList_();
    var out = { ok: true, dirtyBefore: dirty.length, resynced: 0, removed: 0, stale: sbStaleInfo_() || null };
    if (!dirty.length) return out;
    var want = {}; dirty.forEach(function (p) { want[p] = 1; });
    var sh = getSheet_(SH_CARE, CARE_HEADERS), last = sh.getLastRow(), rowOf = {};
    if (last >= 2) {
      var colA = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < colA.length; i++) {
        var p = normPhone_(_sbCell_(colA[i][0]));
        if (p && want[p] && rowOf[p] === undefined) rowOf[p] = i + 2;
      }
    }
    var recs = [], gone = [];
    dirty.forEach(function (ph) {
      if (rowOf[ph] === undefined) { gone.push(ph); return; }
      var rec = sbCareRowToRec_(sh.getRange(rowOf[ph], 1, 1, CARE_HEADERS.length).getValues()[0]);
      if (rec) recs.push(rec); else gone.push(ph);
    });
    for (var b = 0; b < recs.length; b += SB_BATCH_) {
      sb_('POST', 'care_data?on_conflict=phone', recs.slice(b, b + SB_BATCH_), { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    for (var g = 0; g < gone.length; g += 100) {
      sb_('DELETE', 'care_data?phone=in.(' + _sbInList_(gone.slice(g, g + 100)) + ')', null, { Prefer: 'return=minimal' });
    }
    PropertiesService.getScriptProperties().deleteProperty('SB_DIRTY_CARE');   // dang giu khoa nen khong co ai them dirty xen vao
    out.resynced = recs.length; out.removed = gone.length;
    return out;
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally { try { lock.releaseLock(); } catch (eL) {} }
}

function sbStatus_() {
  var dirty = sbDirtyList_();
  return { ok: true, mode: sbMode_(), configured: sbCfg_().ok, stale: sbStaleInfo_() || null, dirtyCount: dirty.length, dirtySample: dirty.slice(0, 10) };
}

// Doi che do. mode: 'off' | 'write' | 'read'. 'read' khi dang STALE bi tu choi tru khi clearStale:true (nguoi dung xac nhan da backfill + compare ok).
function sbSetMode_(mode, clearStale) {
  mode = String(mode || '').toLowerCase();
  if (mode !== 'off' && mode !== 'write' && mode !== 'read') return { ok: false, error: "mode phai la 'off', 'write' hoac 'read'." };
  if (mode !== 'off' && !sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var pr = PropertiesService.getScriptProperties();
  var clear = (clearStale === true || clearStale === 'true');
  if (mode === 'read' && sbStaleInfo_() && !clear) {
    return { ok: false, error: 'Supabase dang STALE (' + sbStaleInfo_() + '). Backfill lai (reset:true) + sbCompareCare ok:true roi goi lai voi clearStale:true.' };
  }
  if (clear) pr.deleteProperty('SB_STALE');
  if (mode === 'off') { _sbSetReadOff_(pr, 'SB_ORD_READ'); _sbSetReadOff_(pr, 'SB_CARE_DELTA_READ'); _sbSetReadOff_(pr, 'SB_CARE_FULL_READ'); }   // 4c: rollback = ve Sheets hoan toan (ca doc don hang)
  pr.setProperty('SB_MODE', mode);
  return sbStatus_();
}

// Doc cac dong sheet CareData theo SO DONG (1-based) -> mang dong 22 o. Gom cac dong lien nhau thanh 1 lan doc; qua phan tan thi doc 1 doan
// bao ca (toi da 20000 dong). Tra null neu khong doc duoc gon (caller danh dau STALE).
function sbReadSheetRows_(sh, rowNums) {
  var W = CARE_HEADERS.length, nums = rowNums.slice().sort(function (a, b) { return a - b; }), runs = [], i = 0;
  while (i < nums.length) {
    var j = i;
    while (j + 1 < nums.length && nums[j + 1] <= nums[j] + 1) j++;
    runs.push([nums[i], nums[j]]); i = j + 1;
  }
  var out = [], k;
  if (runs.length > 40) {
    var lo = nums[0], hi = nums[nums.length - 1];
    if (hi - lo + 1 > 20000) return null;
    var span = sh.getRange(lo, 1, hi - lo + 1, W).getValues(), seen = {};
    for (k = 0; k < nums.length; k++) { if (!seen[nums[k]]) { seen[nums[k]] = 1; out.push(span[nums[k] - lo]); } }
    return out;
  }
  for (k = 0; k < runs.length; k++) {
    var vals = sh.getRange(runs[k][0], 1, runs[k][1] - runs[k][0] + 1, W).getValues();
    for (var v = 0; v < vals.length; v++) out.push(vals[v]);
  }
  return out;
}

// Mirror cac dong VUA GHI tren Sheet: rowNums = dong da sua (doc lai tu Sheet de lay dung noi dung), newRows = dong moi (mang 22 o).
function sbMirrorSheetRows_(sh, rowNums, newRows, why) {
  try {
    if (!sbWriteOn_()) return true;
    var rows = [];
    if (rowNums && rowNums.length) {
      rows = sbReadSheetRows_(sh, rowNums);
      if (rows === null) { sbMarkStale_('khong doc gon duoc ' + rowNums.length + ' dong de mirror (' + why + ')'); return false; }
    }
    return sbMirrorCare_(sbRowsToRecs_(rows.concat(newRows || [])), why);
  } catch (e) {
    try { sbMarkStale_('sbMirrorSheetRows_ ngoai le (' + why + '): ' + String(e && e.message || e)); } catch (e2) {}
    return false;
  }
}

// Object cot Supabase -> object care (cung dinh dang findCareByPhone_ cu, de KHONG phai sua 2 extension / index.html).
function sbRecToCareObj_(g) {
  var row = [];
  for (var i = 0; i < SB_CARE_COLS_.length; i++) row.push(g[SB_CARE_COLS_[i]] == null ? '' : g[SB_CARE_COLS_[i]]);
  return careObjFromRow_(row);
}

// 3c: tra cuu 1 SDT tu Supabase. Tra UNDEFINED = "hay doc Sheets nhu cu" khi: khong o che do 'read', dang STALE, SDT dang dirty,
// Supabase loi, hoac Supabase khong co SDT do (SB_READ_FALLBACK_ON_MISS_). Tra object care khi tim thay.
function sbReadCare_(phone) {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_MODE || '').toLowerCase() !== 'read' || pr.SB_STALE || !sbCfg_().ok) return undefined;
    var ph = normPhone_(phone);
    if (!ph) return undefined;
    var dirty = [];
    try { dirty = JSON.parse(pr.SB_DIRTY_CARE || '[]'); } catch (e0) { dirty = []; }
    if (dirty.indexOf(ph) !== -1) return undefined;
    var res = sb_('GET', 'care_data?select=*&phone=eq.' + encodeURIComponent(ph) + '&limit=1');
    var g = res.json && res.json[0];
    if (!g) return SB_READ_FALLBACK_ON_MISS_ ? undefined : null;
    return sbRecToCareObj_(g);
  } catch (e) {
    try { Logger.log('sbReadCare_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  CHAY TAY TU APPS SCRIPT EDITOR — khong can adminKey / URL. Chon ten ham o o "Run" phia tren, bam Run, xem ket qua o "Execution log".
//  (Cac action sbSetMode / sbBackfillCare... la action cua web app, KHONG hien trong o Run vi ten ham ket thuc bang dau gach duoi.)
//  Thu tu bat: 1) runDedupeCare  2) sbKiemTraKetNoi  3) sbBatGhiSongSong  4) sbBackfillThat (bam lai den khi log bao XONG)
//              5) sbDoiChieu (phai ok:true)  6) sbBatDocSupabase.   Ve nhu cu bat cu luc nao: sbTatSupabase.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function sbXemTrangThai() { Logger.log(JSON.stringify(Object.assign(sbStatus_(), { careListRead: sbCareListStatus_() }), null, 2)); }
function sbKiemTraKetNoi() { Logger.log(JSON.stringify(sbPing_(), null, 2)); }
function sbBatGhiSongSong() { Logger.log(JSON.stringify(sbSetMode_('write', false), null, 2)); }
function sbBackfillThu() { Logger.log(JSON.stringify(sbBackfillCare_({ dryRun: true }), null, 2)); }
function sbBackfillThat() {
  var r = sbBackfillCare_({ dryRun: false });
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error" o tren.' : (r.done ? 'XONG. Chay tiep sbDoiChieu.' : 'CHUA HET — bam Run lai sbBackfillThat de chay tiep (con tro duoc nho).'));
}
function sbBackfillTuDau() { Logger.log(JSON.stringify(sbBackfillCare_({ dryRun: false, reset: true }), null, 2)); }
function sbDoiChieu() { Logger.log(JSON.stringify(sbCompareCare_({ sample: 300 }), null, 2)); }
function sbSuaSDTLoi() { Logger.log(JSON.stringify(sbResyncCare_(), null, 2)); }
function sbTatSupabase() { Logger.log(JSON.stringify(sbSetMode_('off', false), null, 2)); }
// Chi bat doc tu Supabase khi doi chieu ok:true (tu dong xoa co STALE). Khong ok -> KHONG bat, log ly do.
function sbBatDocSupabase() {
  var c = sbCompareCare_({ sample: 300 });
  if (!c.ok) { Logger.log('KHONG BAT: doi chieu chua khop. ' + JSON.stringify(c, null, 2)); return; }
  Logger.log(JSON.stringify(sbSetMode_('read', true), null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4a/5: BACKFILL don hang "DT TỔNG " -> dt_tong va "dữ liệu đơn" -> don_chi_tiet (Sheets van la nguon that).
//  Cung khuon voi sbBackfillCare_: lo SB_BATCH_ dong, upsert, con tro resume (Script Properties), dryRun mac dinh TRUE, chay lap den done.
//  - dt_tong: khoa (id, src_row), upsert on_conflict=id,src_row. Moi dong luu 20 o goc trong cot raw (Date -> {"__d": epochMs}) de buoc 4c
//    dung lai NGUYEN dtRowToOrder_/readDTTong_ (khong viet lai logic chuyen doi -> khong lech ket qua bao cao).
//  - don_chi_tiet: khoa src_row. Dung CHUNG _donConvertRows_ voi readDonChiTiet_ (quy tac bo dong + ke thua ngay cua dong tren), nen con tro
//    luu them lastNgay (ngay ke thua) de lo sau tiep noi dung lo truoc.
//  - reset:true (khi dryRun:false) XOA SACH bang Supabase tuong ung roi chay lai tu dong 2. Bat buoc khi Sheet da xoa/chen dong ke tu lan backfill
//    truoc (src_row lech -> dong cu nam sai cho). Lo loi giua chung: con tro dung o dau lo loi, goi lai se chay tiep.
//  - KHONG loc theo bo loc "an trang/kenh" (_isDTRowHidden_) o day: day la loc luc DOC (phu thuoc Settings), Supabase luu day du.
//  CHUA noi vao duong ghi/doc nao: bang Supabase chi la ban sao cho den khi lam 4b (dong bo gia tang) va 4c (doc).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_DT_COLS_ = ['id','src_row','ngay_tao','ngay_tao_d','nguoi_tao','giao_cho','phone','giai_doan','trang_thai','thoi_gian_ht','thoi_gian_ht_d',
  'kenh_ban','sale_ban','san_pham','phan_loai','gia_tri_coc','gia_tri_don','gia_tri_chenh','raw','archived'];
var SB_DON_COLS_ = ['src_row','ngay_tao_don','ngay_tao_d','phone','nguon_don','the_sale','san_pham','marketer','gia_tri_sau_giam','ghi_chu','raw','archived'];
var SB_DT_NUM_ = { gia_tri_coc: 1, gia_tri_don: 1, gia_tri_chenh: 1, gia_tri_sau_giam: 1 };

// O sheet (Date/chuoi dd/MM/yyyy[ HH:mm]/chuoi ISO) -> 'yyyy-MM-dd' hoac null. Date doc theo getUTC* y het _dtCellToVnStr_ (de cot *_d luon
// khop chuoi hien thi ngay_tao/thoi_gian_ht tren cung 1 dong). Ngay khong hop le -> null (cot date cho phep null).
function _sbDateIso_(v) {
  if (v === null || v === undefined || v === '') return null;
  var y, mo, d, m;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    y = v.getUTCFullYear(); mo = v.getUTCMonth() + 1; d = v.getUTCDate();
  } else {
    var s = String(v).trim();
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?!\d)/))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else return null;
  }
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100)) return null;
  var dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();   // so ngay trong thang
  if (d > dim) return null;
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// O goc -> gia tri JSON an toan de luu trong raw (jsonb): Date -> {"__d": epochMs}; so/boolean/chuoi giu nguyen; null/undefined -> ''.
function _sbRawCell_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : { __d: v.getTime() };
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (typeof v === 'boolean') return v;
  return String(v);
}
// Nguoc lai: raw (mang) -> mang dong nhu getValues() tra ve (Date that), de dua lai cho dtRowToOrder_/_donConvertRows_. width = so o can du.
function sbRawToRow_(raw, width) {
  var row = [], a = Array.isArray(raw) ? raw : [];
  for (var i = 0; i < width; i++) {
    var v = a[i];
    row.push((v && typeof v === 'object' && typeof v.__d === 'number') ? new Date(v.__d) : (v === undefined || v === null ? '' : v));
  }
  return row;
}

// 1 dong "DT TỔNG " (mang 20 o) -> rec dt_tong. null neu la dong rong theo DUNG quy tac readDTTong_ (khong SDT, khong id, khong gia tri don).
function sbDtRowToRec_(r, srcRow) {
  if (!r[DT_COL_PHONE] && !r[DT_COL_ID] && !r[DT_COL_GIATRIDON]) return null;
  var raw = [];
  for (var i = 0; i < DT_TONG_WIDTH; i++) raw.push(_sbRawCell_(r[i]));
  return {
    id: (r[DT_COL_ID] === null || r[DT_COL_ID] === undefined) ? '' : String(r[DT_COL_ID]),
    src_row: srcRow,
    ngay_tao: _sbCell_(_dtCellToVnStr_(r[DT_COL_NGAYTAO])),
    ngay_tao_d: _sbDateIso_(r[DT_COL_NGAYTAO]),
    nguoi_tao: r[1] ? String(r[1]).trim() : '',
    giao_cho: _sbCell_(r[DT_COL_GIAOCHO]),
    phone: normPhone_(_sbCell_(r[DT_COL_PHONE])),
    giai_doan: _sbCell_(r[DT_COL_GIAIDOAN]),
    trang_thai: _sbCell_(r[DT_COL_TRANGTHAI]),
    thoi_gian_ht: _sbCell_(_dtCellToVnStr_(r[DT_COL_THOIGIANHT])),
    thoi_gian_ht_d: _sbDateIso_(r[DT_COL_THOIGIANHT]),
    kenh_ban: r[DT_COL_KENHBAN] ? String(r[DT_COL_KENHBAN]).trim() : '',
    sale_ban: r[DT_COL_SALEBAN] ? String(r[DT_COL_SALEBAN]) : '',
    san_pham: _sbCell_(r[DT_COL_SANPHAM]),
    phan_loai: _sbCell_(r[DT_COL_PHANLOAI]),
    gia_tri_coc: _normMoney_(r[DT_COL_GIATRICOC]),
    gia_tri_don: _normMoney_(r[DT_COL_GIATRIDON]),
    gia_tri_chenh: _normMoney_(r[DT_COL_GIATRICHENH]),
    raw: raw,
    archived: false
  };
}

// Cac dong "dữ liệu đơn" -> recs don_chi_tiet, dung _donConvertRows_ (cung quy tac bo dong / ke thua ngay voi readDonChiTiet_).
// st = { lastNgay } tiep noi giua cac lo. Tra { recs, skipped, st }.
function sbDonRowsToRecs_(vals, firstRow, st) {
  var conv = _donConvertRows_(vals, firstRow, st ? st.lastNgay : '');
  var recs = conv.items.map(function (it) {
    var raw = [], r = vals[it.srcRow - firstRow];
    for (var i = 0; i < DON_CHITIET_WIDTH; i++) raw.push(_sbRawCell_(r[i]));
    var o = it.obj;
    return {
      src_row: it.srcRow,
      ngay_tao_don: _sbCell_(o.ngayTaoDon),
      ngay_tao_d: _sbDateIso_(o.ngayTaoDon),
      phone: normPhone_(_sbCell_(o.soDienThoai)),
      nguon_don: o.nguonDon || '',
      the_sale: o.theSale || '',
      san_pham: o.sanPham || '',
      marketer: o.marketer || '',
      gia_tri_sau_giam: o.giaTriSauGiam || 0,
      ghi_chu: o.ghiChu || '',
      raw: raw,
      archived: false
    };
  });
  return { recs: recs, skipped: vals.length - recs.length, st: { lastNgay: conv.lastNgay } };
}

// Dinh nghia 2 bang: ten sheet, bang Supabase, khoa upsert, cot, do rong doc, ham chuyen lo dong -> recs, key de doi chieu.
function _sbOrderDef_(which) {
  if (which === 'dt') return { which: 'dt', sheetName: DT_TONG_SHEET, table: 'dt_tong', conflict: 'id,src_row', cursorKey: 'SB_DT_CURSOR', cols: SB_DT_COLS_,
    width: function () { return DT_TONG_WIDTH; },
    convert: function (vals, firstRow, st) {
      var recs = [];
      for (var i = 0; i < vals.length; i++) { var rec = sbDtRowToRec_(vals[i], firstRow + i); if (rec) recs.push(rec); }
      return { recs: recs, skipped: vals.length - recs.length, st: null };
    } };
  return { which: 'don', sheetName: DON_CHITIET_SHEET, table: 'don_chi_tiet', conflict: 'src_row', cursorKey: 'SB_DON_CURSOR', cols: SB_DON_COLS_,
    width: function (sh) { return Math.min(DON_CHITIET_WIDTH, sh.getMaxColumns()); },
    convert: sbDonRowsToRecs_ };
}

function _sbOpenOrderSheet_(def) {
  var sh = getDTSS_().getSheetByName(def.sheetName);
  if (!sh) throw new Error('Khong tim thay sheet "' + def.sheetName + '" trong spreadsheet don hang (DT_SS_ID).');
  return sh;
}

// Con tro luu dang JSON {row, st}; gia tri cu kieu so thuan van doc duoc.
function _sbGetCursor_(pr, key) {
  var raw = pr.getProperty(key), c = { row: 2, st: null };
  if (raw) { try { var j = JSON.parse(raw); if (j && j.row >= 2) c = { row: j.row, st: j.st || null }; } catch (e) {} }
  return c;
}

// Backfill 1 bang don hang. opts: { dryRun (mac dinh TRUE), reset (xoa bang Supabase + ve dong 2; chi co tac dung khi dryRun:false) }.
function sbBackfillOrders_(which, opts) {
  opts = opts || {};
  var def = _sbOrderDef_(which), dryRun = opts.dryRun !== false && opts.dryRun !== 'false';
  var cfg = sbCfg_();
  if (!cfg.ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, error: 'Dang co lan backfill/ghi khac chay — thu lai sau.' };
  var t0 = Date.now();
  try {
    var pr = PropertiesService.getScriptProperties();
    var wantReset = opts.reset === true || opts.reset === 'true';
    if (wantReset && !dryRun) {
      sb_('DELETE', def.table + '?src_row=gte.0', null, { Prefer: 'return=minimal' });   // xoa sach — dong cu o vi tri cu se khong con ton tai sai cho
      pr.deleteProperty(def.cursorKey);
      pr.deleteProperty(def.which === 'dt' ? 'SB_DT_DIGESTS' : 'SB_DON_DIGESTS');   // bang vua xoa sach: dau van tay dong bo (4b) cu khong con dung
    }
    var cur = (wantReset && dryRun) ? { row: 2, st: null } : _sbGetCursor_(pr, def.cursorKey);
    var cursor = cur.row, st = cur.st;
    var sh = _sbOpenOrderSheet_(def), last = sh.getLastRow(), width = def.width(sh);
    var tot = { pushed: 0, skipped: 0, batches: 0 };
    while (cursor <= last && (tot.batches === 0 || (Date.now() - t0) < SB_TIME_BUDGET_MS_)) {
      var n = Math.min(SB_BATCH_, last - cursor + 1);
      var vals = sh.getRange(cursor, 1, n, width).getValues();
      var res = def.convert(vals, cursor, st);
      if (res.recs.length && !dryRun) {
        sb_('POST', def.table + '?on_conflict=' + def.conflict, res.recs, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      }
      st = res.st;
      tot.pushed += res.recs.length; tot.skipped += res.skipped; tot.batches++;
      cursor += n;
      if (!dryRun) pr.setProperty(def.cursorKey, JSON.stringify({ row: cursor, st: st }));   // lo loi nhay vao catch, con tro giu nguyen
    }
    var done = cursor > last;
    return { ok: true, table: def.table, dryRun: dryRun, done: done, nextRow: cursor, lastRow: last, pushed: tot.pushed, batches: tot.batches,
      skippedBlank: tot.skipped, ms: Date.now() - t0,
      hint: dryRun ? 'Day la chay thu (chua ghi). Chay ban That de ghi.' : (done ? 'Xong. Chay ham Doi chieu tuong ung.' : 'Chua het — chay lai de tiep tuc (con tro duoc nho).') };
  } catch (e) {
    return { ok: false, table: def.table, error: String(e && e.message || e) };
  } finally { try { lock.releaseLock(); } catch (eL) {} }
}
function sbBackfillDT_(opts) { return sbBackfillOrders_('dt', opts); }
function sbBackfillDon_(opts) { return sbBackfillOrders_('don', opts); }

// So dong cua 1 bang Supabase (Content-Range), chi tinh dong chua archived.
function _sbCountTable_(table) {
  var res = sb_('GET', table + '?select=src_row&archived=eq.false&limit=1', null, { Prefer: 'count=exact' });
  var cr = String(_sbHeader_(res.headers, 'content-range') || ''), m = cr.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

// So khop 1 truong giua rec (tu Sheet) va dong Supabase. Tra true neu khop.
function _sbFieldEq_(col, want, got) {
  if (col === 'raw') return JSON.stringify(got === undefined ? null : got) === JSON.stringify(want);
  if (SB_DT_NUM_[col]) return Number(got) === Number(want);
  if (col === 'ngay_tao_d' || col === 'thoi_gian_ht_d') return (got || null) === (want || null);
  if (col === 'archived') return !!got === !!want;
  return String(got === null || got === undefined ? '' : got) === String(want === null || want === undefined ? '' : want);
}

// Doi chieu 1 bang: (1) so dong ky vong tu Sheet (chay lai DUNG logic chuyen doi) == so dong Supabase (archived=false);
// (2) so TUNG TRUONG (ke ca raw) tren mau rai deu opts.sample (mac dinh 100, toi da 300). ok:true chi khi (1) khop va (2) khong lech.
// Doi chieu theo mau — khong phai checksum toan bang.
function sbCompareOrders_(which, opts) {
  opts = opts || {};
  var def = _sbOrderDef_(which), sample = Math.max(1, Math.min(300, parseInt(opts.sample, 10) || 100));
  try {
    var sh = _sbOpenOrderSheet_(def), last = sh.getLastRow(), width = def.width(sh);
    var expected = [], skipped = 0, st = null;
    for (var row = 2; row <= last; row += SB_BATCH_) {
      var n = Math.min(SB_BATCH_, last - row + 1);
      var res = def.convert(sh.getRange(row, 1, n, width).getValues(), row, st);
      st = res.st; skipped += res.skipped;
      for (var q = 0; q < res.recs.length; q++) expected.push(res.recs[q]);
    }
    var sbCount = _sbCountTable_(def.table);
    var step = Math.max(1, Math.floor(expected.length / sample)), picks = [];
    for (var s = 0; s < expected.length && picks.length < sample; s += step) picks.push(expected[s]);
    var checked = 0, mismatches = [];
    for (var b = 0; b < picks.length; b += 100) {
      var chunk = picks.slice(b, b + 100), nums = chunk.map(function (r) { return r.src_row; });
      var got = sb_('GET', def.table + '?select=*&src_row=in.(' + nums.join(',') + ')').json || [];
      var bySrc = {};
      got.forEach(function (g) { (bySrc[g.src_row] = bySrc[g.src_row] || []).push(g); });
      chunk.forEach(function (rec) {
        checked++;
        var cands = bySrc[rec.src_row] || [];
        var g = null;
        for (var c = 0; c < cands.length; c++) if (def.which !== 'dt' || String(cands[c].id) === rec.id) g = cands[c];
        if (!g) { mismatches.push({ srcRow: rec.src_row, problem: 'thieu tren Supabase' }); return; }
        var diff = [];
        def.cols.forEach(function (col) { if (!_sbFieldEq_(col, rec[col], g[col])) diff.push(col); });
        if (diff.length) mismatches.push({ srcRow: rec.src_row, problem: 'khac cot', cols: diff });
      });
    }
    return { ok: (sbCount === expected.length && mismatches.length === 0), table: def.table, sheetRows: Math.max(0, last - 1), expectedRows: expected.length,
      skippedBlank: skipped, supabaseRows: sbCount, sampleChecked: checked, mismatches: mismatches.slice(0, 20), mismatchCount: mismatches.length };
  } catch (e) { return { ok: false, table: def.table, error: String(e && e.message || e) }; }
}
function sbCompareDT_(opts) { return sbCompareOrders_('dt', opts); }
function sbCompareDon_(opts) { return sbCompareOrders_('don', opts); }

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4a) — chon ten ham o o "Run", bam Run, xem "Execution log". Khong can adminKey / URL. ──
//  Thu tu: sbDonHangThuDT -> sbDonHangDayDT (bam lai den khi log bao XONG) -> sbDonHangDoiChieuDT (phai ok:true); lam tiep giong het cho Don.
function _sbLogBackfill_(r) {
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error" o tren.' : (r.dryRun ? 'CHAY THU xong (chua ghi gi).' : (r.done ? 'XONG. Chay tiep ham Doi chieu.' : 'CHUA HET — bam Run lai de chay tiep (con tro duoc nho).')));
}
function sbDonHangThuDT() { _sbLogBackfill_(sbBackfillDT_({ dryRun: true })); }
function sbDonHangDayDT() { _sbLogBackfill_(sbBackfillDT_({ dryRun: false })); }
function sbDonHangDayLaiTuDauDT() { _sbLogBackfill_(sbBackfillDT_({ dryRun: false, reset: true })); }
function sbDonHangDoiChieuDT() { Logger.log(JSON.stringify(sbCompareDT_({ sample: 300 }), null, 2)); }
function sbDonHangThuDon() { _sbLogBackfill_(sbBackfillDon_({ dryRun: true })); }
function sbDonHangDayDon() { _sbLogBackfill_(sbBackfillDon_({ dryRun: false })); }
function sbDonHangDayLaiTuDauDon() { _sbLogBackfill_(sbBackfillDon_({ dryRun: false, reset: true })); }
function sbDonHangDoiChieuDon() { Logger.log(JSON.stringify(sbCompareDon_({ sample: 300 }), null, 2)); }

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4b/5 (muc 1): DANH DAU "ban sao don hang tren Supabase dang cu".
//  Ai ghi vao 2 sheet (kiem tra bang grep, 2026-10-09):
//   - "DT TỔNG ": CRM ghi qua patchOrder_ (sua o), deleteOrder_ / deleteDuplicateOrders_ (xoa dong), doImportSheetRows_ (them dong), tu dong xoa
//     dong trung (_autoDedupExactRowsInSheet_ qua onChangeDedupTrigger_) va luu tru (archiveOldOrders_, dang khoa). Ngoai CRM: nhan vien sua tay,
//     tool Base day don vao -> CRM KHONG biet => chi tick dong bo dinh ky (sbOrdersTick_) moi bat duoc.
//   - "dữ liệu đơn": CRM chi them (doImportSheetRows_) / xoa dong trung tu dong / luu tru; du lieu chinh vao tu Base/Pos ben ngoai.
//  Moi duong ghi cua CRM goi sbMarkOrdersDirty_ SAU KHI ghi Sheet xong: luu moc thoi gian vao Script Property SB_DT_DIRTY / SB_DON_DIRTY.
//  Nguoi doc Supabase (4c) thay moc nay => doc Sheets nhu cu cho toi khi 1 lan dong bo BAT DAU SAU moc do chay xong (sbSyncOrders_ xoa moc).
// ═══════════════════════════════════════════════════════════════════════════════════════════════
function sbMarkOrdersDirty_(which, why) {
  try {
    PropertiesService.getScriptProperties().setProperty(which === 'don' ? 'SB_DON_DIRTY' : 'SB_DT_DIRTY', String(Date.now()));
  } catch (e) { try { Logger.log('sbMarkOrdersDirty_ (' + why + ') loi: ' + String(e && e.message || e)); } catch (el) {} }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4b/5 (muc 2): DONG BO DINH KY (trigger) "DT TỔNG " -> dt_tong, "dữ liệu đơn" -> don_chi_tiet.
//  Vi sao khong chi dong bo "dong moi": nhan vien sua o trong dong cu (doi trang thai, gia tri...) va xoa/chen dong ngoai CRM — chi so sanh
//  dong moi se bo sot. Cach lam: moi lan chay doc TOAN BO sheet 1 lan (trigger chay nen, khong anh huong nguoi dung), dung CHINH logic backfill
//  chuyen ra recs, chia thanh khoi SB_ORD_BLOCK_ dong theo src_row, tinh "dau van tay" (hash 32-bit cua JSON recs) tung khoi, so voi
//  dau van tay luu o Script Property (SB_DT_DIGESTS / SB_DON_DIGESTS). Khoi nao khac -> XOA khoang src_row cua khoi tren Supabase roi POST lai
//  (xoa-roi-ghi de dong thoi xu ly ca truong hop id doi o cung src_row). Chen/xoa dong lam doi khoi phia sau -> tu day lai phan do.
//  Dau van tay chi luu SAU khi khoi ghi thanh cong => loi giua chung thi lan sau tu chay tiep. Het thoi gian (SB_TIME_BUDGET_MS_ chia doi cho 2 bang)
//  thi dung, lan sau chay tiep (complete:false).
//  Moc "da dong bo xong lan cuoi" luu o SB_ORD_STATE (syncedAt = luc BAT DAU lan chay hoan chinh, de buoc 4c biet do cu toi da bao lau). Moc dirty
//  (4b-1) chi duoc xoa khi syncedAt > moc dirty. Khong dung khoa Script Lock lau (se chan CS luu du lieu) — dung co SB_ORD_RUNNING (het han sau 6 phut).
//  Nang luc: dau van tay luu trong 1 Script Property (gioi han ~9KB) -> toi da ~1000 khoi = ~200.000 dong/sheet; vuot thi bao loi ro rang.
//  Chay 1 lan trong Editor: sbDonHangCaiTrigger (moi 10 phut), go: sbDonHangGoTrigger. Xem tinh trang: sbDonHangTrangThai.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_ORD_BLOCK_ = 200;
var SB_ORD_MAX_BLOCKS_ = 1000;
var SB_ORD_RUN_TTL_MS_ = 6 * 60 * 1000;
var SB_ORD_TICK_MINUTES_ = 10;

function _sbHash32_(str) {   // FNV-1a 32 bit -> base36
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}

// Dat co "dang chay" (het han SB_ORD_RUN_TTL_MS_). Tra true neu lay duoc. Chi giu Script Lock vai ms de kiem-roi-dat.
function _sbOrdRunAcquire_(pr) {
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(3000); } catch (e) { got = false; }
  if (!got) return false;
  try {
    var t = parseInt(pr.getProperty('SB_ORD_RUNNING') || '0', 10);
    if (t && Date.now() - t < SB_ORD_RUN_TTL_MS_) return false;
    pr.setProperty('SB_ORD_RUNNING', String(Date.now()));
    return true;
  } finally { try { lock.releaseLock(); } catch (e2) {} }
}
function _sbOrdState_(pr) { var s = {}; try { s = JSON.parse(pr.getProperty('SB_ORD_STATE') || '{}') || {}; } catch (e) { s = {}; } return s; }

// Dong bo 1 bang. opts: { budgetMs, fresh (xoa sach bang Supabase + dau van tay roi day lai tat ca) }. KHONG nem loi ra ngoai.
function sbSyncOrders_(which, opts) {
  opts = opts || {};
  var def = _sbOrderDef_(which), digestKey = which === 'dt' ? 'SB_DT_DIGESTS' : 'SB_DON_DIGESTS', dirtyKey = which === 'dt' ? 'SB_DT_DIRTY' : 'SB_DON_DIRTY';
  if (!sbCfg_().ok) return { ok: false, table: def.table, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var pr = PropertiesService.getScriptProperties();
  var own = !opts.noAcquire;
  if (own && !_sbOrdRunAcquire_(pr)) return { ok: true, skipped: true, table: def.table, note: 'Dang co lan dong bo khac chay — bo qua.' };
  var t0 = Date.now(), budget = opts.budgetMs || SB_TIME_BUDGET_MS_, B = SB_ORD_BLOCK_, st = null, err = '';
  var out = { ok: false, table: def.table, complete: false, changedBlocks: 0, pushedRows: 0 };
  try {
    var sh = _sbOpenOrderSheet_(def), last = sh.getLastRow(), width = def.width(sh);
    if (opts.fresh) { sb_('DELETE', def.table + '?src_row=gte.0', null, { Prefer: 'return=minimal' }); pr.deleteProperty(digestKey); }
    var recs = [];
    for (var row = 2; row <= last; row += SB_BATCH_) {
      var n = Math.min(SB_BATCH_, last - row + 1);
      var res = def.convert(sh.getRange(row, 1, n, width).getValues(), row, st);
      st = res.st;
      for (var q = 0; q < res.recs.length; q++) recs.push(res.recs[q]);
    }
    var nBlocks = last >= 2 ? Math.ceil((last - 1) / B) : 0;
    if (nBlocks > SB_ORD_MAX_BLOCKS_) throw new Error('Sheet qua lon (' + nBlocks + ' khoi > ' + SB_ORD_MAX_BLOCKS_ + ') cho Script Property dau van tay — can doi cach luu.');
    var byBlock = [], i;
    for (i = 0; i < nBlocks; i++) byBlock.push([]);
    recs.forEach(function (r) { byBlock[Math.floor((r.src_row - 2) / B)].push(r); });
    var fresh = byBlock.map(function (b) { return _sbHash32_(JSON.stringify(b)); });
    var raw = pr.getProperty(digestKey), stored = raw ? raw.split(',') : [];
    var shrank = stored.length > nBlocks;
    stored.length = Math.min(stored.length, nBlocks);
    for (i = 0; i < nBlocks; i++) {
      if (stored[i] === fresh[i]) continue;
      if (out.changedBlocks > 0 && Date.now() - t0 >= budget) { out.timeUp = true; break; }
      var lo = 2 + i * B, hi = lo + B - 1;
      sb_('DELETE', def.table + '?src_row=gte.' + lo + '&src_row=lte.' + hi, null, { Prefer: 'return=minimal' });
      if (byBlock[i].length) sb_('POST', def.table + '?on_conflict=' + def.conflict, byBlock[i], { Prefer: 'resolution=merge-duplicates,return=minimal' });
      while (stored.length < i) stored.push('');   // khoi truoc chua co dau van tay (khong xay ra khi chay tuan tu) — de trong
      stored[i] = fresh[i];
      pr.setProperty(digestKey, stored.join(','));
      out.changedBlocks++; out.pushedRows += byBlock[i].length;
    }
    var complete = !out.timeUp;
    if (complete) {
      if (shrank || !raw) sb_('DELETE', def.table + '?src_row=gt.' + (last >= 2 ? last : 1), null, { Prefer: 'return=minimal' });   // sheet ngan di (hoac lan dau, chua co dau van tay): bo dong thua phia duoi
      pr.setProperty(digestKey, stored.join(','));
      var state = _sbOrdState_(pr);
      state[which] = { syncedAt: t0, last: last, blocks: nBlocks, rows: recs.length };
      pr.setProperty('SB_ORD_STATE', JSON.stringify(state));
      var dirty = parseInt(pr.getProperty(dirtyKey) || '0', 10);
      if (dirty && dirty <= t0) pr.deleteProperty(dirtyKey);   // lan doc nay BAT DAU sau moc dirty nen da co moi thay doi cua CRM
    }
    out.ok = true; out.complete = complete; out.blocks = nBlocks; out.lastRow = last; out.rows = recs.length; out.ms = Date.now() - t0;
    return out;
  } catch (e) {
    err = String(e && e.message || e);
    try { var s2 = _sbOrdState_(pr); s2[which] = Object.assign({}, s2[which] || {}, { err: err, errAt: Date.now() }); pr.setProperty('SB_ORD_STATE', JSON.stringify(s2)); } catch (e2) {}
    out.error = err; out.ms = Date.now() - t0;
    return out;
  } finally { if (own) { try { pr.deleteProperty('SB_ORD_RUNNING'); } catch (e3) {} } }
}

// Dong bo CA 2 bang trong 1 lan (dung chung co chay, ngan sach thoi gian chia doi). Ham cua trigger.
function sbOrdersSync_(opts) {
  opts = opts || {};
  var pr = PropertiesService.getScriptProperties();
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  if (!_sbOrdRunAcquire_(pr)) return { ok: true, skipped: true, note: 'Dang co lan dong bo khac chay — bo qua.' };
  try {
    var half = Math.floor(SB_TIME_BUDGET_MS_ / 2);
    var dt = sbSyncOrders_('dt', { budgetMs: half, noAcquire: true, fresh: opts.fresh });
    var don = sbSyncOrders_('don', { budgetMs: half, noAcquire: true, fresh: opts.fresh });
    return { ok: !!(dt.ok && don.ok), complete: !!(dt.complete && don.complete), dt: dt, don: don };
  } finally { try { pr.deleteProperty('SB_ORD_RUNNING'); } catch (e) {} }
}
function sbOrdersTick_() { try { Logger.log('sbOrdersTick ' + JSON.stringify(sbOrdersSync_())); } catch (e) { Logger.log('sbOrdersTick loi: ' + e); } }
function installSbOrdersTrigger_() {
  var ex = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; });
  if (ex.length) return 'Trigger "sbOrdersTick_" da ton tai (' + ex.length + '), khong tao them.';
  ScriptApp.newTrigger('sbOrdersTick_').timeBased().everyMinutes(SB_ORD_TICK_MINUTES_).create();
  return 'Da tao trigger sbOrdersTick_ chay moi ' + SB_ORD_TICK_MINUTES_ + ' phut.';
}
function removeSbOrdersTrigger_() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sbOrdersTick_') { ScriptApp.deleteTrigger(t); n++; } });
  return 'Da go ' + n + ' trigger sbOrdersTick_.';
}
function sbOrdersStatus_() {
  var pr = PropertiesService.getScriptProperties(), s = _sbOrdState_(pr), now = Date.now();
  var info = function (w, dk) {
    var x = s[w] || {}, d = parseInt(pr.getProperty(dk) || '0', 10);
    return { syncedAt: x.syncedAt ? new Date(x.syncedAt).toISOString() : null, ageMin: x.syncedAt ? Math.round((now - x.syncedAt) / 60000) : null,
      rows: x.rows == null ? null : x.rows, lastRow: x.last == null ? null : x.last, dirtySinceSync: !!(d && (!x.syncedAt || d > x.syncedAt)), lastError: x.err || null };
  };
  return { ok: true, orderRead: sbOrdReadStatus_(), dt: info('dt', 'SB_DT_DIRTY'), don: info('don', 'SB_DON_DIRTY') };
}

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4b) ──
function _sbLogSync_(r) {
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(!r.ok ? 'LOI — xem "error" o tren.' : (r.skipped ? 'DANG CO LAN KHAC CHAY — thu lai sau it phut.' : (r.complete ? 'XONG — Supabase khop Sheet tai thoi diem doc.' : 'CHUA HET — bam Run lai.')));
}
function sbDonHangDongBo() { _sbLogSync_(sbOrdersSync_()); }
function sbDonHangDongBoLai() { _sbLogSync_(sbOrdersSync_({ fresh: true })); }   // xoa sach 2 bang Supabase roi day lai tat ca (dung khi nghi Supabase bi sua tay / lech)
function sbDonHangCaiTrigger() { Logger.log(installSbOrdersTrigger_()); }
function sbDonHangGoTrigger() { Logger.log(removeSbOrdersTrigger_()); }
function sbDonHangTrangThai() { Logger.log(JSON.stringify(sbOrdersStatus_(), null, 2)); }


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4c/5: DOC don hang / lich hen tu Supabase (MAC DINH TAT; moi ham tu fallback ve Sheets).
//  Cac ham doc: readOrdersByPhone_ (dt_tong theo SDT), findDonRowsByPhone_ (don_chi_tiet theo SDT), readDTTong_ (ca bang dt_tong),
//  reminders (care_data). JSON tra ve GIU NGUYEN: don hang di qua dung dtRowToOrder_ / vong lap readDTTong_ / vong lap findDonRowsByPhone_
//  voi mang dong dung lai tu cot raw (sbRawToRow_) — khong co ban logic chuyen doi thu hai.
//  Cong tac RIENG cho don hang: Script Property SB_ORD_READ = 'on' (bat bang sbDonHangBatDoc, tat bang sbDonHangTatDoc; sbTatSupabase
//  cung tat luon). Lich hen (reminders) dung cong tac cu SB_MODE='read' cua CareData.
//  Doc Supabase chi khi TAT CA dieu kien dung (sai 1 cai -> undefined = doc Sheets nhu cu), xem _sbOrdReadGate_:
//   - SB_ORD_READ = on va da cau hinh URL/key;  - lan dong bo HOAN CHINH gan nhat cua bang do (SB_ORD_STATE.<dt|don>.syncedAt) khong qua
//     SB_ORD_MAX_AGE_MS_ (trigger 10 phut/lan => qua 30 phut = trigger chet => tu ve Sheets);
//   - khong co co dirty (SB_DT_DIRTY / SB_DON_DIRTY: CRM da ghi Sheet ma chua dong bo lai);  - khong co lan dong bo dang chay (SB_ORD_RUNNING
//     con han: dang xoa-roi-ghi lai tung khoi nen Supabase tam thieu dong);  - Supabase khong loi.
//  readDTTong_ doc CA bang nen con doi chieu SO DONG voi SB_ORD_STATE.dt.rows (so dong lan dong bo cuoi); lech => doc Sheets.
//  Luu y: doc theo SDT KHONG co fallback "khong tim thay thi doc Sheets" (khach chua co don la chuyen thuong, fallback se mat het loi ich toc do);
//  an toan dua vao cac dieu kien tren. Sua TAY ngoai CRM tren Sheet chi len Supabase o tick ke tiep (toi da ~10 phut) — doc nhu da ghi o 4b.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_ORD_MAX_AGE_MS_ = 30 * 60 * 1000;   // du lieu Supabase cu toi da (tinh tu luc BAT DAU lan dong bo hoan chinh cuoi) moi duoc doc don hang
var SB_PAGE_ = 1000;                        // PostgREST tra toi da 1000 dong/lan mac dinh
var SB_PAR_ = 10;                           // so trang tai song song trong 1 lan UrlFetchApp.fetchAll

function sbOrdReadOn_() {
  try { return String(PropertiesService.getScriptProperties().getProperty('SB_ORD_READ') || '').toLowerCase() === 'on'; } catch (e) { return false; }
}

// Tra object { syncedAt, rows, ... } cua bang ('dt'|'don') neu DUOC PHEP doc Supabase luc nay, nguoc lai null. Khong bao gio nem loi.
function _sbOrdReadGate_(which) {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_ORD_READ || '').toLowerCase() !== 'on' || !sbCfg_().ok) return null;
    var st = {};
    try { st = JSON.parse(pr.SB_ORD_STATE || '{}') || {}; } catch (e0) { st = {}; }
    var x = st[which === 'don' ? 'don' : 'dt'];
    if (!x || !x.syncedAt || Date.now() - x.syncedAt > SB_ORD_MAX_AGE_MS_) return null;
    if (pr[which === 'don' ? 'SB_DON_DIRTY' : 'SB_DT_DIRTY']) return null;
    var run = parseInt(pr.SB_ORD_RUNNING || '0', 10);
    if (run && Date.now() - run < SB_ORD_RUN_TTL_MS_) return null;
    return x;
  } catch (e) { return null; }
}

// Tai nhieu trang song song (biet truoc so dong ky vong). basePath da co dau '?' va cac tham so loc/order. Tra mang dong; nem loi neu HTTP loi.
function _sbGetAllRows_(basePath, expected) {
  var cfg = sbCfg_(), headers = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
  var pages = Math.ceil(expected / SB_PAGE_) + 1;   // +1 trang du de bat truong hop Supabase co NHIEU dong hon ky vong (se lech so dong -> ve Sheets)
  var out = [];
  for (var p0 = 0; p0 < pages; p0 += SB_PAR_) {
    var reqs = [];
    for (var p = p0; p < Math.min(pages, p0 + SB_PAR_); p++) {
      reqs.push({ url: cfg.url + '/rest/v1/' + basePath + '&limit=' + SB_PAGE_ + '&offset=' + (p * SB_PAGE_), method: 'get', headers: headers, muteHttpExceptions: true });
    }
    var rs = UrlFetchApp.fetchAll(reqs);
    for (var i = 0; i < rs.length; i++) {
      var code = rs[i].getResponseCode(), text = rs[i].getContentText() || '';
      if (code >= 300) throw new Error('Supabase HTTP ' + code + ' (GET ' + String(basePath).split('?')[0] + '): ' + text.slice(0, 300));
      var a = JSON.parse(text || '[]');
      if (!Array.isArray(a)) throw new Error('Supabase tra du lieu khong phai mang (' + String(basePath).split('?')[0] + ')');
      for (var j = 0; j < a.length; j++) out.push(a[j]);
    }
  }
  return out;
}

// Tai lan luot tung trang cho den khi het (khi KHONG biet truoc so dong, vd care_data).
function _sbGetPagesSeq_(basePath) {
  var out = [], off = 0;
  for (var guard = 0; guard < 500; guard++) {
    var a = sb_('GET', basePath + '&limit=' + SB_PAGE_ + '&offset=' + off).json;
    if (!Array.isArray(a)) throw new Error('Supabase tra du lieu khong phai mang (' + String(basePath).split('?')[0] + ')');
    for (var j = 0; j < a.length; j++) out.push(a[j]);
    if (a.length < SB_PAGE_) return out;
    off += SB_PAGE_;
  }
  throw new Error('Qua nhieu trang (' + String(basePath).split('?')[0] + ')');
}

// readDTTong_: tra { vals (mang dong 20 o nhu getValues), rowNums (src_row cua tung dong) } hoac UNDEFINED = doc Sheets nhu cu.
function sbReadDTTongVals_() {
  try {
    var g = _sbOrdReadGate_('dt');
    if (!g || g.rows == null) return undefined;
    var rows = _sbGetAllRows_('dt_tong?select=src_row,raw&archived=eq.false&order=src_row.asc', g.rows);
    if (rows.length !== g.rows) { Logger.log('sbReadDTTongVals_: lech so dong (Supabase ' + rows.length + ' vs dong bo cuoi ' + g.rows + ') — doc Sheets thay the'); return undefined; }
    if (!_sbOrdReadGate_('dt')) return undefined;   // trong luc tai co dong bo/ghi xen vao -> bo, doc Sheets
    var vals = [], nums = [];
    for (var i = 0; i < rows.length; i++) { vals.push(sbRawToRow_(rows[i].raw, DT_TONG_WIDTH)); nums.push(rows[i].src_row); }
    return { vals: vals, rowNums: nums };
  } catch (e) {
    try { Logger.log('sbReadDTTongVals_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// readOrdersByPhone_: tra mang order (dtRowToOrder_) theo thu tu dong, hoac UNDEFINED = doc Sheets nhu cu. ph da qua normPhone_.
function sbReadOrdersByPhone_(ph) {
  try {
    if (!_sbOrdReadGate_('dt')) return undefined;
    var rows = sb_('GET', 'dt_tong?select=src_row,raw&archived=eq.false&phone=eq.' + encodeURIComponent(ph) + '&order=src_row.asc&limit=' + SB_PAGE_).json;
    if (!Array.isArray(rows)) return undefined;
    if (!_sbOrdReadGate_('dt')) return undefined;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      try { out.push(dtRowToOrder_(sbRawToRow_(rows[i].raw, DT_TONG_WIDTH), rows[i].src_row)); }
      catch (eRow) { Logger.log('sbReadOrdersByPhone_: loi doc dong ' + rows[i].src_row + ': ' + eRow); }
    }
    return out;
  } catch (e) {
    try { Logger.log('sbReadOrdersByPhone_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// findDonRowsByPhone_: tra mang object cung HINH voi readDonChiTiet_ (chi cac truong findDonRowsByPhone_ dung), hoac UNDEFINED = doc Sheets.
// Dung cot da chuyen doi san luc dong bo (ngay_tao_don da ke thua ngay dong tren — khong the dung lai tu raw cua rieng dong nay).
function sbReadDonByPhone_(ph) {
  try {
    if (!_sbOrdReadGate_('don')) return undefined;
    var rows = sb_('GET', 'don_chi_tiet?select=src_row,ngay_tao_don,phone,nguon_don,the_sale,san_pham,marketer,gia_tri_sau_giam&archived=eq.false&phone=eq.' +
      encodeURIComponent(ph) + '&order=src_row.asc&limit=' + SB_PAGE_).json;
    if (!Array.isArray(rows)) return undefined;
    if (!_sbOrdReadGate_('don')) return undefined;
    return rows.map(function (g) {
      return { ngayTaoDon: g.ngay_tao_don == null ? '' : g.ngay_tao_don, soDienThoai: g.phone, nguonDon: g.nguon_don || '', theSale: g.the_sale || '',
        sanPham: g.san_pham || '', marketer: g.marketer || '', giaTriSauGiam: Number(g.gia_tri_sau_giam) || 0 };
    });
  } catch (e) {
    try { Logger.log('sbReadDonByPhone_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// O ngay trong care_data duoc luu bang _sbCell_ (Date -> ISO 'Z'). Dua nguoc ve Date de String(rhen) cua action reminders ra DUNG dinh dang
// nhu doc tu Sheets; chuoi khac (nguoi go tay) giu nguyen.
function _sbCareTextToCell_(t) {
  var s = String(t == null ? '' : t);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s)) { var d = new Date(s); if (!isNaN(d.getTime())) return d; }
  return s;
}

// reminders: tra mang dong kieu CareData (chi cac cot 0-3, 12, 13 co nghia) hoac UNDEFINED = doc Sheets. Can SB_MODE='read', khong STALE, KHONG co
// SDT dirty nao (dirty = Sheets moi hon Supabase cho SDT do; lich hen cua no co the sai -> doc Sheets cho chac, het dirty bang sbSuaSDTLoi).
// KHONG loc cs o phia server vi Sheets so sanh sau khi trim(); _remindersFromRows_ loc y nhu cu. SDT tra ve la SDT chuan hoa (Sheets: o goc).
function sbReadRemindersRows_() {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_MODE || '').toLowerCase() !== 'read' || pr.SB_STALE || !sbCfg_().ok) return undefined;
    var dirty = [];
    try { dirty = JSON.parse(pr.SB_DIRTY_CARE || '[]'); } catch (e0) { dirty = []; }
    if (dirty.length) return undefined;
    var recs = _sbGetPagesSeq_('care_data?select=phone,status,zalo,cs,sched_hen,sched_hen_note&sched_hen=neq.&order=phone.asc');
    var again = PropertiesService.getScriptProperties().getProperties();
    if (again.SB_STALE || String(again.SB_MODE || '').toLowerCase() !== 'read' || (again.SB_DIRTY_CARE && again.SB_DIRTY_CARE !== '[]')) return undefined;
    return recs.map(function (g) {
      var row = [g.phone, g.status || '', g.zalo || '', g.cs || '', '', '', '', '', '', '', '', '', _sbCareTextToCell_(g.sched_hen), g.sched_hen_note || ''];
      return row;
    });
  } catch (e) {
    try { Logger.log('sbReadRemindersRows_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

function sbOrdReadStatus_() {
  var on = sbOrdReadOn_(), now = Date.now(), pr = PropertiesService.getScriptProperties(), s = _sbOrdState_(pr);
  var one = function (w) { var g = _sbOrdReadGate_(w), x = s[w] || {}; return { readsSupabaseNow: !!g, ageMin: x.syncedAt ? Math.round((now - x.syncedAt) / 60000) : null }; };
  return { on: on, maxAgeMin: Math.round(SB_ORD_MAX_AGE_MS_ / 60000), dt: one('dt'), don: one('don') };
}

// Bat doc don hang tu Supabase. Chi bat khi: da cau hinh, ca 2 bang da dong bo hoan chinh it nhat 1 lan va con moi, doi chieu 2 bang ok:true.
function sbOrdReadEnable_() {
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  var st = sbOrdersStatus_(), why = [];
  ['dt', 'don'].forEach(function (w) {
    var x = st[w];
    if (x.syncedAt == null) why.push(w + ': chua tung dong bo xong (chay sbDonHangDongBo)');
    else if (x.ageMin > SB_ORD_MAX_AGE_MS_ / 60000) why.push(w + ': du lieu dong bo da ' + x.ageMin + ' phut (> ' + (SB_ORD_MAX_AGE_MS_ / 60000) + ') — chay lai sbDonHangDongBo / cai trigger');
    if (x.dirtySinceSync) why.push(w + ': CRM da ghi Sheet sau lan dong bo cuoi — chay sbDonHangDongBo roi thu lai');
  });
  if (why.length) return { ok: false, error: why.join('; ') };
  var cdt = sbCompareDT_({ sample: 300 }), cdon = sbCompareDon_({ sample: 300 });
  if (!cdt.ok || !cdon.ok) return { ok: false, error: 'Doi chieu chua khop', dt: cdt, don: cdon };
  _sbSetReadOn_(PropertiesService.getScriptProperties(), 'SB_ORD_READ');
  var hasTrigger = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; });
  return { ok: true, orderRead: sbOrdReadStatus_(), warning: hasTrigger ? null : 'Chua co trigger dong bo (sbDonHangCaiTrigger) — sau ' + (SB_ORD_MAX_AGE_MS_ / 60000) + ' phut se tu quay ve doc Sheets.' };
}
function sbOrdReadDisable_() {
  _sbSetReadOff_(PropertiesService.getScriptProperties(), 'SB_ORD_READ');
  return { ok: true, orderRead: sbOrdReadStatus_() };
}

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4c) — chon ten ham o o "Run", bam Run, xem "Execution log". Khong can adminKey / URL. ──
//  Dieu kien truoc: 4b xong (sbDonHangDongBo XONG + sbDonHangCaiTrigger). Bat: sbDonHangBatDoc (tu tu choi neu chua dong bo/doi chieu khong khop).
//  Theo doi: sbDonHangTrangThai (muc orderRead). Ve nhu cu: sbDonHangTatDoc (hoac sbTatSupabase). Lich hen: dung cong tac cu sbBatDocSupabase.
function sbDonHangBatDoc() { Logger.log(JSON.stringify(sbOrdReadEnable_(), null, 2)); }
function sbDonHangTatDoc() { Logger.log(JSON.stringify(sbOrdReadDisable_(), null, 2)); }


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 4e/5: DOC DANH SACH KHACH (CareData) cua action 'customers' tu Supabase (MAC DINH TAT; fallback Sheets).
//   4e-1  delta (action=customers&since=...): client goi moi ~3 giay/may  -> sbReadCareDelta_   (cong tac SB_CARE_DELTA_READ=on)
//   4e-2  FULL  (action=customers khong since): client keo moi ~5 phut    -> sbReadCareAll_     (cong tac SB_CARE_FULL_READ=on)
//  Dieu kien chung (sai 1 cai -> undefined = doc Sheets nhu cu): SB_MODE=read (cong tac CareData cu, da doi chieu sbDoiChieu ok) + khong STALE +
//  KHONG co SDT dirty nao (dirty = Sheet moi hon Supabase) + cong tac rieng cua muc do = on + da cau hinh URL/key + Supabase khong loi.
//  Delta: truy van Supabase theo updated_at >= since-1h (cot timestamptz) roi LOC LAI bang dung quy tac Sheets (chuoi updated > since) nen ket qua
//  giong het; > 3000 dong -> null (client keo FULL, y nhu readCareDelta_). Chi doi action 'customers'; readCare_ cho bao cao/dashboard noi bo van doc Sheets.
//  Gioi han da biet: (1) dong bi mirror tre vai tram ms sau khi ghi Sheet co the lo mot nhip delta — lan keo FULL (5 phut) tu sua; (2) sua TAY tren Sheet
//  khong co updated => khong vao delta (giong Sheets) va chi vao Supabase khi backfill lai; (3) SDT trung nhieu dong chi con 1 ban (xu ly truoc bang
//  runDedupeCare); (4) SDT tra ve la SDT chuan hoa (Sheets: o goc, vd so thieu 0) — client gop theo SDT chuan hoa nen khong anh huong.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_CARE_DELTA_MAX_ = 3000;   // = nguong idx.length cua readCareDelta_

function _sbCareListGate_(flagKey) {
  try {
    var pr = PropertiesService.getScriptProperties().getProperties();
    if (String(pr.SB_MODE || '').toLowerCase() !== 'read' || pr.SB_STALE || !sbCfg_().ok) return false;
    if (String(pr[flagKey] || '').toLowerCase() !== 'on') return false;
    var dirty = [];
    try { dirty = JSON.parse(pr.SB_DIRTY_CARE || '[]'); } catch (e0) { dirty = []; }
    return dirty.length === 0;
  } catch (e) { return false; }
}

// 4e-2. Tra mang careObj (tat ca SDT) | undefined (doc Sheets). Dem truoc (count=exact) roi tai song song; lech so dong -> Sheets.
function sbReadCareAll_() {
  try {
    if (!_sbCareListGate_('SB_CARE_FULL_READ')) return undefined;
    var res = sb_('GET', 'care_data?select=phone&limit=1', null, { Prefer: 'count=exact' });
    var m = String(_sbHeader_(res.headers, 'content-range') || '').match(/\/(\d+)$/);
    if (!m) return undefined;
    var total = parseInt(m[1], 10);
    var recs = _sbGetAllRows_('care_data?select=*&order=phone.asc', total);
    if (recs.length !== total) { Logger.log('sbReadCareAll_: lech so dong (tai ' + recs.length + ' vs dem ' + total + ') — doc Sheets thay the'); return undefined; }
    if (!_sbCareListGate_('SB_CARE_FULL_READ')) return undefined;   // trong luc tai co dirty/STALE/tat -> bo, doc Sheets
    var out = [];
    for (var i = 0; i < recs.length; i++) if (recs[i].phone) out.push(sbRecToCareObj_(recs[i]));
    return out;
  } catch (e) {
    try { Logger.log('sbReadCareAll_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

// 4e-1. Tra { delta:true, rows } | null (qua nhieu -> keo FULL) | undefined (doc Sheets).
function sbReadCareDelta_(since) {
  try {
    if (!_sbCareListGate_('SB_CARE_DELTA_READ')) return undefined;
    var t = new Date(since);
    if (isNaN(t.getTime())) return undefined;
    var lo = new Date(t.getTime() - 3600000).toISOString();
    var recs = _sbGetPagesSeq_('care_data?select=*&updated_at=gte.' + encodeURIComponent(lo) + '&order=phone.asc');
    if (!_sbCareListGate_('SB_CARE_DELTA_READ')) return undefined;   // trong luc tai co dirty/STALE/tat -> bo, doc Sheets
    var rows = [];
    for (var i = 0; i < recs.length; i++) {
      var us = String(recs[i].updated || '');
      if (us && us > since && recs[i].phone) rows.push(recs[i]);   // CUNG quy tac voi readCareDelta_
    }
    if (rows.length > SB_CARE_DELTA_MAX_) return null;
    return { delta: true, rows: rows.map(sbRecToCareObj_) };
  } catch (e) {
    try { Logger.log('sbReadCareDelta_ loi (doc Sheets thay the): ' + String(e && e.message || e)); } catch (el) {}
    return undefined;
  }
}

function sbCareListStatus_() {
  var pr = PropertiesService.getScriptProperties();
  return { deltaOn: String(pr.getProperty('SB_CARE_DELTA_READ') || '') === 'on', fullOn: String(pr.getProperty('SB_CARE_FULL_READ') || '') === 'on',
    deltaReadsSupabaseNow: _sbCareListGate_('SB_CARE_DELTA_READ'), fullReadsSupabaseNow: _sbCareListGate_('SB_CARE_FULL_READ') };
}
// Bat 1 muc (flagKey = 'SB_CARE_DELTA_READ' | 'SB_CARE_FULL_READ'). Chi bat khi SB_MODE=read, khong STALE, khong dirty, doi chieu CareData ok:true.
function sbCareListEnable_(flagKey) {
  if (!sbCfg_().ok) return { ok: false, error: 'Chua cau hinh SUPABASE_URL / SUPABASE_KEY trong Script Properties.' };
  if (sbMode_() !== 'read') return { ok: false, error: "Phai bat doc CareData truoc (sbBatDocSupabase -> SB_MODE=read), hien dang '" + sbMode_() + "'." };
  if (sbStaleInfo_()) return { ok: false, error: 'Supabase dang STALE (' + sbStaleInfo_() + ').' };
  if (sbDirtyList_().length) return { ok: false, error: 'Con ' + sbDirtyList_().length + ' SDT dirty — chay sbSuaSDTLoi roi thu lai.' };
  var c = sbCompareCare_({ sample: 300 });
  if (!c.ok) return { ok: false, error: 'Doi chieu CareData chua khop', compare: c };
  _sbSetReadOn_(PropertiesService.getScriptProperties(), flagKey);
  return { ok: true, careListRead: sbCareListStatus_() };
}
function sbCareListDisable_(flagKey) { _sbSetReadOff_(PropertiesService.getScriptProperties(), flagKey); return { ok: true, careListRead: sbCareListStatus_() }; }

// ── CHAY TAY TU APPS SCRIPT EDITOR (buoc 4e) — chon ten ham o o "Run", bam Run, xem "Execution log". ──
//  Dieu kien truoc: sbBatDocSupabase da chay (SB_MODE=read) va sbXemTrangThai khong STALE/dirty. Nen bat DELTA truoc, theo doi, roi moi bat FULL.
//  Ve nhu cu: sbKHDeltaTat / sbKHFullTat (hoac sbTatSupabase tat het).
function sbKHDeltaBat() { Logger.log(JSON.stringify(sbCareListEnable_('SB_CARE_DELTA_READ'), null, 2)); }
function sbKHDeltaTat() { Logger.log(JSON.stringify(sbCareListDisable_('SB_CARE_DELTA_READ'), null, 2)); }
function sbKHFullBat()  { Logger.log(JSON.stringify(sbCareListEnable_('SB_CARE_FULL_READ'), null, 2)); }
function sbKHFullTat()  { Logger.log(JSON.stringify(sbCareListDisable_('SB_CARE_FULL_READ'), null, 2)); }


// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  SUPABASE — BUOC 5a/5: KIEM TRA SAN SANG truoc khi bo dual-write. CHI DOC: khong doi cong tac, khong ghi du lieu, khong tu bo dual-write.
//  Chay tay: sbSanSangBuoc5 (Apps Script Editor > Run > xem Execution log). Ket qua: autoOk=true chi nghia la CAC DIEU KIEN TU DONG DAT;
//  danh sach "manual" (viec phai lam / quyet dinh cua nguoi) luon di kem — bo dual-write chi khi ca 2 deu xong. Thiet ke: docs/SUPABASE-PLAN.md muc "Buoc 5".
//  Moc thoi gian bat doc: moi cong tac doc (SB_ORD_READ, SB_CARE_DELTA_READ, SB_CARE_FULL_READ) co them Script Property <ten>_AT (ms) ghi LUC BAT
//  (_sbSetReadOn_) va xoa khi tat — de tinh "da bat du lau" (SB_SOAK_DAYS_). Cong tac bat truoc ban nay chua co moc -> phai tat roi bat lai.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
var SB_SOAK_DAYS_ = 7;   // phai bat doc lien tuc it nhat chung nay ngay moi coi la "da chay thu du lau"

function _sbSetReadOn_(pr, key) {
  pr.setProperty(key, 'on');
  if (!pr.getProperty(key + '_AT')) pr.setProperty(key + '_AT', String(Date.now()));   // giu moc dau tien neu bat lai khi dang bat
}
function _sbSetReadOff_(pr, key) { pr.deleteProperty(key); pr.deleteProperty(key + '_AT'); }

var SB_STEP5_MANUAL_ = [
  'CareData CHUA co dong bo dinh ky Sheet -> Supabase (don hang co: 4b). Neu bo ghi song song, moi lan ghi CareData (CS luu, import, sua tay) khong len Supabase nua; cong an toan (dirty) cung dua vao dual-write. Can thiet ke duong ghi chinh vao Supabase truoc.',
  'Duong ghi NGOAI CRM: tool Base/Pos day don vao Sheet va nhan vien sua TAY tren Sheet — chi len Supabase o tick 4b (don hang), CareData khong co.',
  'Bao cao/dashboard noi bo van doc readCare_/readAllOrders_ tu Sheets (4e-3 chua lam): neu Sheets ngung cap nhat thi bao cao cu dan.',
  'Quy tac nghiep vu: DT Tong duoc quan ly truc tiep tren Google Sheets (saveOrders co y tat). Chuyen nguon that cua don hang sang Supabase la quyet dinh cua Duyen, khong phai ky thuat.',
  'Chua co quy trinh sao luu/khoi phuc Supabase (xuat dinh ky + thu khoi phuc that) va chua quyet huong archive (docs/ARCHIVE-PLAN.md) chong cheo voi Supabase.',
  'Chua thu ROLLBACK that tren du lieu that: tat het cong tac doc bang sbTatSupabase roi kiem tra CRM van chay dung tu Sheets.'
];

function sbSanSangBuoc5_(opts) {
  opts = opts || {};
  var sample = Math.max(1, Math.min(300, parseInt(opts.sample, 10) || 200));
  var checks = [];
  var add = function (name, ok, detail) { checks.push({ name: name, ok: !!ok, detail: detail || '' }); };
  var safe = function (fn) { try { return fn(); } catch (e) { return { ok: false, error: String(e && e.message || e) }; } };
  var cfg = sbCfg_().ok;
  add('Da cau hinh SUPABASE_URL / SUPABASE_KEY', cfg, cfg ? '' : 'Thieu trong Script Properties');
  if (cfg) {
    var pr = PropertiesService.getScriptProperties(), now = Date.now();
    add("CareData dang o che do 'read'", sbMode_() === 'read', "hien dang '" + sbMode_() + "'");
    var stale = sbStaleInfo_(); add('Supabase khong STALE', !stale, stale || '');
    var dirty = sbDirtyList_(); add('Khong co SDT dirty (CareData)', dirty.length === 0, dirty.length ? dirty.length + ' SDT dirty (chay sbSuaSDTLoi)' : '');
    var cc = safe(function () { return sbCompareCare_({ sample: sample }); });
    add('Doi chieu CareData khop (mau ' + sample + ')', cc.ok === true, cc.ok === true ? '' : JSON.stringify(cc).slice(0, 300));
    var os = safe(function () { return sbOrdersStatus_(); });
    ['dt', 'don'].forEach(function (w) {
      var x = (os && os[w]) || {}, bad = [];
      if (x.syncedAt == null) bad.push('chua dong bo xong lan nao');
      else if (x.ageMin > SB_ORD_MAX_AGE_MS_ / 60000) bad.push('du lieu dong bo da ' + x.ageMin + ' phut');
      if (x.dirtySinceSync) bad.push('CRM da ghi sau lan dong bo cuoi');
      if (x.lastError) bad.push('loi gan nhat: ' + String(x.lastError).slice(0, 120));
      add('Don hang (' + w + '): dong bo moi, khong dirty, khong loi', bad.length === 0, bad.join('; '));
      var cmp = safe(function () { return sbCompareOrders_(w, { sample: sample }); });
      add('Doi chieu don hang (' + w + ') khop (mau ' + sample + ')', cmp.ok === true, cmp.ok === true ? '' : JSON.stringify(cmp).slice(0, 300));
    });
    var hasTick = false; try { hasTick = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sbOrdersTick_'; }); } catch (eT) {}
    add('Trigger dong bo don hang (sbOrdersTick_) dang chay', hasTick, hasTick ? '' : 'Chay sbDonHangCaiTrigger');
    [['SB_ORD_READ', 'Doc don hang tu Supabase'], ['SB_CARE_DELTA_READ', 'Doc khach (delta) tu Supabase'], ['SB_CARE_FULL_READ', 'Doc khach (FULL) tu Supabase']].forEach(function (c) {
      var on = String(pr.getProperty(c[0]) || '').toLowerCase() === 'on', at = parseInt(pr.getProperty(c[0] + '_AT') || '0', 10);
      var days = at ? Math.floor((now - at) / 86400000) : null, ok = on && at > 0 && days >= SB_SOAK_DAYS_, d = '';
      if (!on) d = 'dang TAT';
      else if (!at) d = 'chua co moc thoi gian bat (bat truoc ban nay) — tat roi bat lai de tinh';
      else if (days < SB_SOAK_DAYS_) d = 'moi bat ' + days + ' ngay, can >= ' + SB_SOAK_DAYS_;
      add(c[1] + ' da bat >= ' + SB_SOAK_DAYS_ + ' ngay', ok, d);
    });
  }
  var failing = checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.name; });
  var autoOk = failing.length === 0;
  return { ok: true, autoOk: autoOk, failing: failing, checks: checks, manual: SB_STEP5_MANUAL_.slice(),
    verdict: autoOk ? 'Cac dieu kien TU DONG da dat. Van con ' + SB_STEP5_MANUAL_.length + ' muc thu cong (manual) — CHI bo dual-write khi tat ca da xong va Duyen dong y.'
      : 'CHUA nen bo dual-write: ' + failing.length + ' dieu kien tu dong chua dat. Khong co gi bi doi.' };
}

// CHAY TAY (buoc 5a): chi doc/ghi log, khong doi gi. Muc "manual" luon phai doc.
function sbSanSangBuoc5() {
  var r = sbSanSangBuoc5_();
  Logger.log(JSON.stringify(r, null, 2));
  Logger.log(r.verdict);
}

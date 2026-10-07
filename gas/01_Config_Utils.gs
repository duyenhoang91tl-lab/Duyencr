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


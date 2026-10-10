
// ═══════════════════════════════════════════════════════
//  CRM THU HIEN — V9 FEATURE LAYER
//  Phân quyền (Team CS), Dashboard, Audit Log, Batch Sync
//  (Additive — không đổi workflow CS hiện tại)
// ═══════════════════════════════════════════════════════
// ── V9 STATE (var → hoisted, ghi/đọc an toàn từ các block trước) ──
var currentUser = loadLS('ome_user') || { name: 'Admin', role: 'admin', team: '' };
var teams       = loadLS('ome_teams') || [];   // [{id,name,leader,members[],color}]
var auditLog    = loadLS('ome_audit') || [];   // [{timestamp,user,action,phone,oldValue,newValue}]
var _assignIndex = {};                          // phone -> csName (theo lịch sử chia, mới nhất thắng)
var _dataVersion = 0;
var _filterCache = { sig: null, list: null };
var _lastFilteredObjs = _lastFilteredObjs || [];

var V9_TEAM_COLORS = ['#1a6b45','#1558a8','#6d28d9','#b45309','#b91c1c','#0891b2','#be185d','#4338ca','#047857','#7c3aed'];
var SYNC_BATCH_MS = 5000;

// Wrap applyFilters: dùng cache nếu chữ ký trùng
var _applyFiltersCore = applyFilters;
applyFilters = function(){
  try {
    var sig = _filterSignature();
    if (_filterCache.sig !== null && _filterCache.sig === sig && _filterCache.list) {
      var list = _filterCache.list;
      _lastFilteredObjs = list;
      _lastFilteredList = list.map(function(c){ return c.phone; });
      try { window.__omeFiltered = list; } catch(e){}   // mirror ra window
      renderTable(list);
      if (typeof txt === 'function') { txt('result-count', fmt(list.length)); txt('tb-list', fmt(list.length)); }
      return;
    }
  } catch(e){ /* fall through to full recompute */ }
  _applyFiltersCore();   // tự set lại _filterCache + _lastFilteredObjs ở cuối hàm
};

// Wrap saveLS: tự xoá cache khi dữ liệu liên quan thay đổi
var _origSaveLS = saveLS;
saveLS = function(k, v){
  _origSaveLS(k, v);
  if (/ome_(care|sched|schedules|assign_hist|teams|user)/.test(k)) _invalidateFilterCache();
};

// Wrap buildCustomers: dữ liệu KH vừa dựng lại → xoá cache + dựng lại assign index
if (typeof buildCustomers === 'function'){
  var _origBuildCustomers = buildCustomers;
  buildCustomers = function(){
    var r = _origBuildCustomers.apply(this, arguments);
    _invalidateFilterCache();
    try { _rebuildAssignIndex(); } catch(e){}
    try { checkDataDaoRenewSchedules(); } catch(e){}
    return r;
  };
}

var _auditQueue = [];
var _auditTimer = null;
// ═══════════════════════════════════════════════════════
//  PHÂN QUYỀN — SCOPE
// ═══════════════════════════════════════════════════════
var _assignAllIndex = {}; // phone -> Set<csName> (tất cả CS từng được chia KH này)
// ═══════════════════════════════════════════════════════
//  BATCH SYNC CHĂM SÓC (gom 5 giây, 1 request)
// ═══════════════════════════════════════════════════════
var _careQueue = new Set();
var _careWriting = new Set();
var _careTimer = null;
// ═══════════════════════════════════════════════════════
//  THỐNG KÊ CHO DASHBOARD
// ═══════════════════════════════════════════════════════
// Đơn có nằm trong khoảng ngày lọc của Dashboard không (bỏ trống 2 đầu = không lọc).
// Đơn cũ chỉ có year/month (không có ngày cụ thể) → quy ước lấy ngày 01 của tháng đó.
// Đơn có nằm trong khoảng ngày lọc của Dashboard không (bỏ trống 2 đầu = không lọc).
// Tính theo NGÀY TẠO đơn (o.orderDate), giống mọi báo cáo khác trong hệ thống (A/B/C/KPI
// Pancake) — không theo ngày hoàn thành, để khớp với Base và giữa các báo cáo với nhau.
// Giong _isExcludedOrderStatus_ (gas_v13.js): khop TOAN BO chuoi sau khi bo dau, KHONG khop 'Hoan thanh'.
var _DASH_EXCLUDED_STATUS = ['huy','da huy','da hoan','dang hoan','dang hoan hang','da hoan hang','hoan hang','hoan tien'];
// ═══════════════════════════════════════════════════════
//  DASHBOARD PIVOT — drag-drop widgets + saved templates
// ═══════════════════════════════════════════════════════

var _dashTemplates = [];   // [{name, widgets:[{type,cfg}]}]
var _dashActiveIdx = 0;    // index vào _dashTemplates
var _dashDragSrc   = null; // widget index đang kéo

var _DASH_WIDGET_DEFS = [
  { type:'kpi',        label:'📊 KPI Tổng quan',        full:true  },
  { type:'tier',       label:'🏷 Phân hạng khách',      full:false },
  { type:'top_rev',    label:'🏆 Top CS doanh thu',     full:false },
  { type:'top_close',  label:'🎯 Top tỉ lệ chốt',      full:false },
  { type:'team',       label:'🏢 Theo Team',            full:false },
  { type:'cs_detail',  label:'👤 Chi tiết CS',          full:true  },
  { type:'pivot',      label:'📐 Pivot tùy chỉnh',      full:true  },
];

var _DEFAULT_DASH_WIDGETS = [
  {type:'kpi'}, {type:'tier'}, {type:'top_rev'},
  {type:'top_close'}, {type:'team'}, {type:'cs_detail'},
  {type:'pivot', cfg:{row:'month', col:'cs', metric:'revenue'}}
];

// ── BỘ LỌC DASHBOARD: thời gian / team / nhân viên ─────────────
var _dashFilter = { from:'', to:'', team:'', cs:'' };
// ═══════════════════════════════════════════════════════
//  QUẢN LÝ TEAM
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
//  NHÓM MKT — tự chọn MKT nào gồm Page nào (mỗi Page hiện 1 MKT; hỗ trợ Page chạy chung nhiều MKT theo tỷ lệ)
//  mktTeams = [{id,name,color,pages:[{pageId, share}]}] — đồng bộ lên sheet MktTeams (action saveMktTeams)
// ═══════════════════════════════════════════════════════
var mktTeams = loadLS('ome_mkt_teams') || [];
var _mktPagesCache = null, _mktPagesLoading = false;
// ── Chọn nhiều thành viên (tích / bỏ tích, chọn tất cả / bỏ tất cả) ──
var _teamPickerOpen = {};
// ── Chọn kênh cho team (multi-select) — để giới hạn doanh thu team chỉ tính trong (các) kênh
// đã chọn, dùng khi 1 số CS thuộc team khác nhưng chỉ chạy 1 kênh FB riêng cho team này. Để
// trống (không chọn kênh nào) = không giới hạn, tính doanh thu như bình thường (mọi kênh). ──
var _teamChanPickerOpen = {};
// ═══════════════════════════════════════════════════════
//  BÁO CÁO PANCAKE — nhập file Excel "Thống kê tương tác" (pages_statistics_engagements
//  Pancake xuất ra), khớp tên Nhân viên Pancake ↔ Sale CRM, báo cáo theo Page + theo CS
// ═══════════════════════════════════════════════════════
var _pkState = {
  nameMapLoaded: false, nameMap: {},      // { 'Le Ninh': 'ninhnga99', ... }
  serverNames: [],                         // TOAN BO ten Nhan vien tung xuat hien trong bao cao da luu tren server (ben vung, khong mat khi F5/luu bao cao)
  parsedRows: [], parsedUnmapped: [],      // ket qua lan parse file gan nhat, chua luu len CRM
  uploading: false,
  from: _ymd(new Date(Date.now()-6*86400000)), to: _ymd(new Date()), fromQuick: 'custom',
  report: null, reportLoading: false,
  pkSplit: 'equal', mapOpen: '', nameMapSectionOpen: false,
  // Bo loc kieu Excel tren cac bang "Theo Page"/"Theo Sale" cua tab Bao cao KPI Pancake:
  // { page: {colKey: Set(gia tri duoc chon)}, sale: {colKey: Set(...)} } — Set rong/khong co
  // nghia la KHONG loc cot do (hien tat ca). Chi loc tren du lieu da tai (frontend), khong goi
  // lai server, nen doi bo loc phan hoi tuc thi.
  kpiColFilters: { page: {}, sale: {} },
  tagRows: [], tagLoaded: false, tagFrom: '', tagTo: '',   // dữ liệu file 'Thống kê tag' (gộp nhiều ngày, lưu trên trình duyệt)
  tagOverrideMap: {}, tagOverrideLoaded: false,   // { 'tên tag lạ': 'L1'...'L7' } — quy chuẩn tay, lưu chung server (dùng chung cho cả team)
  tagSaving: false, tagSavedAt: '',   // trạng thái lưu dữ liệu tag lên CRM (sheet PancakeTagStats) — BẮT BUỘC phải lưu thì tab "Báo cáo KPI Pancake" mới tính được tỷ lệ tag L1-L7 (server đọc từ sheet, không đọc localStorage trình duyệt)
  // ── SĐT mang về / đơn chốt (file "Thống kê nhân viên", sheet "<pageId> By staff") ──
  sdtParsedRows: [], sdtUploading: false,
  sdtReport: null, sdtReportLoading: false,
  // ── Khớp Page Pancake (pageId) ↔ Kênh bán chuẩn trong DT TỔNG ──
  pageMapLoaded: false, pageMap: {}, serverPages: [], kenhOptions: [],
  // ── Báo cáo KPI Pancake tổng hợp (tab riêng) ──
  kpiFrom: _ymd(new Date(Date.now()-6*86400000)), kpiTo: _ymd(new Date()),
  kpiReport: null, kpiReportLoading: false, kpiPageFilter: '', kpiSaleFilter: ''
};

// ═══════════════════════════════════════════════════════
//  BÁO CÁO TAG PANCAKE (file "Thống kê tag") — xử lý ngay trên trình duyệt
//  Tag Sale: S<số>/O<số> <username> (Pancake có thể cắt bớt tên -> khớp theo MÃ S1, O8...)
//  Tag trạng thái: L1, L2, L3, L4, L5, L5.1, L5.2, L6
// ═══════════════════════════════════════════════════════
var _PK_SALE_DIR = [
  {code:'S1',  fb:'Hai Yen Nguyen',    base:'yenNTH2004'},
  {code:'S2',  fb:'Anh NgPhuong',      base:'anhNP1999'},
  {code:'S3',  fb:'Trang Ng',          base:'trangNH2005'},
  {code:'S4',  fb:'Thu Nguyen',        base:'thuNH1986'},
  {code:'S5',  fb:'Nguyễn Viên Sa',    base:'dungNTK1987'},
  {code:'S6',  fb:'Trịnh Phuong Anh',  base:'anhtrinh1995'},
  {code:'S7',  fb:'Le Ninh',           base:'ninhLTK'},
  {code:'O8',  fb:'Mai Huyền',         base:'huyenmaii1990'},
  {code:'O9',  fb:'Xynk Tũn',          base:'biichnguyen1993'},
  {code:'O10', fb:'Dung Nguyen',       base:'Dungnguyen1995'},
  {code:'O11', fb:'Nguyên Khôi',       base:'thuyha88'},
  {code:'O12', fb:'Minh Quách',        base:'minhquach1995'},
  {code:'O13', fb:'Tối Hậu Thư',       base:'phuongthao2000'},
  {code:'O14', fb:'Mai Ninh',          base:'ninhnga99'},
  {code:'O15', fb:'Nông Hồng',         base:'nonghong1988'},
  {code:'O16', fb:'Thu Thủy',          base:'Thuydinh1995'},
  {code:'O17', fb:'Nguyễn Văn Hoàn',   base:''},
  {code:'O18', fb:'Tuyet Maii Ng',     base:''},
  {code:'O19', fb:'',                  base:''},
  {code:'O20', fb:'',                  base:''},
  {code:'O21', fb:'',                  base:''}
];
var _PK_STATUS_LABEL = {
  'L1':'L1. Chuẩn (đạt 3 lần phản hồi)', 'L2':'L2. SĐT kết nối', 'L3':'L3. KH tiềm năng',
  'L4':'L4. Khảo giá / KNC', 'L5':'L5. Chốt', 'L5.1':'L5.1 Chờ CK', 'L5.2':'L5.2 Chờ lên đơn',
  'L6':'L6. Hủy', 'L7':'L7. Khu vực Hà Nội', 'L8':'L8. Upsale', 'L9':'L9. Chốt kéo (KH cũ)'
};
// Tiêu chí / điều kiện đạt chuẩn đầy đủ cho từng tag — hiện ở tooltip (title) trên bảng phễu
// KPI Pancake, theo đúng bảng "DANH SÁCH TAG PANCAKE CẦN TẠO" (Duyên cung cấp).
var _PK_STATUS_DESC = {
  'L1':'Điều kiện đạt chuẩn: ≥80% hội thoại đẩy Sale phải đạt mốc lần 3: (1) KH hỏi SP → (2) NV khai thác năm sinh + mong cầu, KH phản hồi → (3) NV tư vấn cụ thể, KH phản hồi tiếp.',
  'L2':'Điều kiện đạt chuẩn: >60% SĐT thu thập được phải kết nối thành công qua gọi điện / nhắn tin / kết bạn Zalo (KH có phản hồi thật).',
  'L3':'Điều kiện đạt chuẩn: KH không im lặng sau khi được báo giá, độ tuổi từ 27 trở lên, có mục đích mua rõ ràng — có phản hồi cụ thể về mức giá (đồng ý / cân nhắc / hỏi thêm chi tiết).',
  'L4':'Điều kiện đạt chuẩn: không phải nick ảo, seeding, đối thủ dò giá hoặc KH hỏi nhiều page cùng lúc không có dấu hiệu mua thật — theo dõi để LOẠI khỏi mẫu số các KPI trên.',
  'L5':'Khách đồng ý mua hàng (chốt đơn).',
  'L6':'Khách đổi ý / hủy đơn.',
  'L7':'Gắn tag ở khu vực Hà Nội.',
  'L8':'Gắn những đơn khách chọn 1 sản phẩm mà Sale mời thêm bán được (Upsale). Bảng tag chuẩn chưa định nghĩa mẫu số tỷ lệ nên chỉ đếm số lượng.'
};

// ── Lưu dữ liệu tag trên trình duyệt để xem theo khoảng ngày (mỗi ngày nạp 1 file, gộp lại) ──
var _PK_TAG_LS = 'pk_tag_rows_v1';
// ═══════════════════════════════════════════════════════
//  TAB "📈 KPI Pancake" — ghép DT TỔNG (đơn/doanh thu thật) + Báo cáo tương tác/SĐT/Tag
//  Pancake, hiển thị tỷ lệ chốt & phễu chuyển đổi L1-L7 theo Page và theo Sale.
//  Nguồn dữ liệu: action=kpiReport (buildKpiReport_ trong gas_v13.js).
// ═══════════════════════════════════════════════════════
var _PK_KPI_TAG_ORDER = ['L1','L2','L3','L4','L5','L6','L7','L8'];
var _PK_KPI_TAG_SHORT = {
  L1:'L1 (Chuẩn)', L2:'L2 (SĐT k.nối)', L3:'L3 (Tiềm năng)', L4:'L4 (Khảo giá)',
  L5:'L5 (Chốt)', L6:'L6 (Hủy)', L7:'L7 (Hà Nội)', L8:'L8 (Upsale)'
};

// ── Xuất nhật ký báo cáo hàng ngày (Sale/Kênh/MKT/Tag) -> Google Sheet riêng, mỗi loại 1 sheet ──
var _expLogState = { from: '', to: '', loading: false, result: null };

// Dang ky nguon du lieu de popup lay danh sach gia tri duy nhat theo dung cot dang bam — goi lai
// _pkRenderKpiPancake() sau khi Ap dung/Xoa loc de ve lai bang voi du lieu da loc.
var _PK_COL_GETTERS = {
  page: {
    page: function(p) { return p.pageName; },
    kenh: function(p) { return p.mapped ? p.kenhBan : '(chưa khớp)'; }
  },
  sale: {
    ma: function(s) { return s.maSale || '—'; },
    ten: function(s) { return s.name; },
    nhom: function(s) { return s.nhom || '(ngoài danh sách)'; }
  }
};

// Bo loc nhanh khoang ngay — DUNG CHUNG cho moi tab co bao cao + 2 o chon ngay (KPI Pancake,
// Bao cao Pancake, Bao cao doanh so A/D/E, Bao cao phan cong, Dashboard...). Ten con giu tien
// to "_pk" vi lam dau tien cho tab KPI Pancake, nhung logic hoan toan trung lap, khong phu
// thuoc gi Pancake ca nen tai su dung thang cho cac tab khac.
var _PK_QUICK_RANGES = [
  { v:'today',      l:'Hôm nay' },
  { v:'yesterday',  l:'Hôm qua' },
  { v:'thisWeek',   l:'Tuần này' },
  { v:'lastWeek',   l:'Tuần trước' },
  { v:'thisMonth',  l:'Tháng này' },
  { v:'lastMonth',  l:'Tháng trước' },
  { v:'thisQuarter',l:'Quý này' },
  { v:'lastQuarter',l:'Quý trước' },
  { v:'thisYear',   l:'Năm này' },
  { v:'lastYear',   l:'Năm trước' },
  { v:'custom',     l:'Tuỳ chỉnh…' }
];
// ═══════════════════════════════════════════════════════
//  CHECKLIST CHẤT LƯỢNG TIN NHẮN MKT
//  TỰ TÍNH từ Báo cáo Pancake (Tổng tương tác/SĐT thu thập/số lượng tag L1..Ln) + DT TỔNG
//  (L5 = tổng số đơn Base). KHÔNG nhập tay theo ngày nữa — chỉ còn phải điền 1 LẦN mục tiêu
//  (%) + mẫu số cho từng tag, áp dụng cho CẢ THÁNG (kế thừa sang tháng sau nếu không đổi).
//  Nguồn dữ liệu: action=mktChecklist (GET) / saveMktChecklistConfig (POST) — gas_v13.js.
// ═══════════════════════════════════════════════════════
var _mktState = (function(){
  var r = (typeof _pkQuickRange === 'function') ? _pkQuickRange('thisMonth') : null;
  return {
    loaded: false, loading: false,
    quick: 'thisMonth', from: r ? r.from : '', to: r ? r.to : '',
    report: null,
    cfgDraft: null // khi != null: đang sửa mục tiêu/mẫu số, giữ bản nháp { L1:{target,denom}, ... } (target dạng %)
  };
})();

var _MKT_OP_SYMBOL = { gte:'≥', lte:'≤', eq:'=' };
// ═══════════════════════════════════════════════════════
//  BÁO CÁO NGÀY (gộp gửi sếp) — hợp nhất Doanh thu/Sale/Page từ action "kpiReport" (đã có ở
//  tab KPI Pancake) và khối Marketing từ action "mktChecklist" (đã có ở tab Checklist MKT)
//  thành 1 màn hình duy nhất cho 1 ngày, tối ưu để chụp ảnh gửi sếp — không thêm phép tính
//  doanh thu/tỷ lệ chốt/TB đơn nào mới, chỉ trình bày lại đúng số đã có sẵn ở 2 báo cáo kia.
// ═══════════════════════════════════════════════════════
var _dbState = { date: _ymd(new Date()), loading: false, loaded: false, kpi: null, mkt: null,
  views: { sale: 'both', page: 'both', mkt: 'both' } }; // both = bieu do tron + bang | table | pie | bar

// ── Trang RIENG chi co Bao cao ngay: mo tab moi cung file nay voi ?view=dailybrief ──
var _dbStandalone = /(?:^|[?&])view=dailybrief(?:&|$)/.test(location.search);
// ═══════════════════════════════════════════════════════
//  BÁO CÁO DOANH SỐ (CRM mới — nguồn: Google Sheet "DT tổng" gốc)
//  Báo cáo A = sheet "DT TỔNG " (đơn đã lên hệ thống)
//  Báo cáo B = sheet "dữ liệu đơn" (đơn đã gửi khách) + báo cáo sản phẩm
// ═══════════════════════════════════════════════════════
var _srState = {
  sub: 'A',
  colFilters: {}, // loc theo tieu de cot (client-side) cho cac bang bao cao doanh so, xem _srColTh_
  dateField: 'ngayTao',   // A: 'ngayTao' | 'thoiGianHT'
  dateFrom: '', dateTo: '', dateQuick: 'custom',
  sale: [], kenh: [], team: [],      // A — ca 2 deu multi-select dang checkbox (mang nhieu gia tri); team = loc theo Team (rong = khong loc)
  aSanPham: '',            // A — loc san pham, cach nhau dau phay
  byCreator: false,        // A — tich thi doanh thu KHONG chia deu theo sale tren don, chi tinh het cho "Người tạo" (cot rieng trong DT TONG, khac "Sale bán")
  bSale: [], bNguon: [], bMarketer: [], bTeam: [], // B — ca 3 deu multi-select (mang nhieu ten)
  bSanPham: '', bCareStatus: [], bKhStatus: [], bZaloStatus: [], bNickZalo: '', // B — them loc CRM (co SDT de noi)
  dataA: null, dataB: null,
  loading: false,
  lastFetchError: '', // thong bao loi THAT cua lan _srFetch gan nhat (timeout/mang/GAS loi) — de phan biet voi "that su khong co don nao khop bo loc"
  saleOptions: [], kenhOptions: [], nguonOptions: [], marketerOptions: [], saleBOptions: [], teamOptions: [], optionsLoaded: false,
  saleSearch: '', kenhSearch: '', teamSearch: '', productSearch: '', bSaleSearch: '', bTeamSearch: '', bNguonSearch: '', bMktSearch: '', // lọc nhanh client-side trên bảng breakdown
  showCoc: true, // A — hiện/ẩn cột Cọc trên các bảng breakdown (chỉ tham khảo, không tính vào doanh thu)
  // Che do xem (bang/tron/cot) cho tung bang breakdown — KHONG anh huong gi den bo loc/tim kiem o tren,
  // chi doi cach hien thi PHAN DU LIEU DA LOC. Mac dinh 'table' de giu nguyen giao dien cu.
  aSaleView: 'table', aKenhView: 'table', aMktView: 'table', aTeamView: 'table',
  bSaleView: 'table', bProductView: 'table', bTeamView: 'table', bNguonView: 'table', bMktView: 'table',
  cEmpView: 'table', cKenhView: 'table',
  dCsView: 'table',
  eBucketView: 'table', eSaleView: 'table',
  bonusExpandedRow: '', // hàng "Chương trình thưởng" (mục c ở Báo cáo E) đang mở chi tiết
  // C — So sanh theo ky
  cPeriodType: 'week', cDateField: 'ngayTao',
  cWeekOffset: 0, cMonthOffset: 0, cQuarterOffset: 0, cYearOffset: 0,
  cCustomCurFrom: '', cCustomCurTo: '', cCustomPrevFrom: '', cCustomPrevTo: '',
  cSale: [], cKenh: [], cTeam: [],     // C — multi-select giong A, tach rieng de doi tab A/C khong dam vao nhau
  cSanPham: '',             // C — loc san pham, cach nhau dau phay
  dataC: null, cEmpSearch: '', cKenhSearch: '', cExpandedRow: '',
  // D — KH Cham soc moi (data rieng, KHONG gop A/B/C)
  dDateFrom: '', dDateTo: '', dDateQuick: 'custom', dCs: [], dTeam: [], dataD: null,
  // E — Hoa hong nhan vien + Chuong trinh thuong (dung lai action=salesReportB — "dữ liệu đơn"/POS;
  // KHONG con dung salesReportA/"base" nua — theo yeu cau Duyen 2026-09-30, co dinh 1 nguon duy
  // nhat de khop voi KPI va Bao cao B, tranh lech so lieu giua cac bao cao).
  eSource: 'pos',
  eDateFrom: '', eDateTo: '', eDateQuick: 'custom', eDateField: 'ngayTao', eSale: [], eKenh: [], eTeam: [], dataE: null, eSaleSearch: '',
  eSaleCustomized: false, leaderTeamOptions: [],
  // F — Ty le hoan thanh KPI theo Sale (Bac Van phong / KPI co dinh Online / KPI commit rieng)
  fDateFrom: '', fDateTo: '', fDateQuick: 'thisMonth', fDateField: 'ngayTao', fSale: [], fTeam: [], dataF: null,
  fSaleSearch: '', fSaleCustomized: false, fKpiView: 'table', fEditing: null,
  // G — Chuong trinh thuong Thu viec / Chinh thuc (truoc day la "Don bi loai"; action failedOrderReport con trong backend nhung khong con tab nao goi)
  gDateFrom: '', gDateTo: '', gDateQuick: 'thisMonth', gSale: [], gNguon: [], gMarketer: [], gSanPham: '',
  dataG: null, gSaleSearch: '',
  gSaleView: 'table', gNguonView: 'table', gMktView: 'table', gLyDoView: 'table',
  // G da doi thanh "Chuong trinh thuong Thu viec / Chinh thuc" (2026-10-04): dung nguon don Pos nhu E
  gSaleCustomized: false, gBonusExpanded: '',
  // H — Tong quan data da chia (client-only: assignHistory + careData; so don/doanh thu nhap tay)
  hDateFrom: '', hDateTo: '', hDateQuick: 'today', hTeam: '', hCs: '', hGroup: 'dayCs',
  // I — Bao cao chia data Renew (CSKH-Duyen)
  iDateFrom: '', iDateTo: '', iDateQuick: 'custom', iCs: '', iTeam: ''
};
// Bao cao F/H mac dinh 'Tháng này' nhung fDateFrom/fDateTo (hay hDateFrom/hDateTo) truoc day de
// rong -> dropdown hien 'Tháng này' trong khi request khong co ngay nao => backend cong DON CA
// TU TRUOC DEN NAY. Dien san khoang ngay theo dropdown ngay khi tai trang.
(function(){
  var r = (typeof _pkQuickRange === 'function') ? _pkQuickRange(_srState.fDateQuick) : null;
  if (r){ _srState.fDateFrom = r.from; _srState.fDateTo = r.to; }
  var rG = (typeof _pkQuickRange === 'function') ? _pkQuickRange(_srState.gDateQuick) : null;
  if (rG){ _srState.gDateFrom = rG.from; _srState.gDateTo = rG.to; }
  var rH = (typeof _pkQuickRange === 'function') ? _pkQuickRange(_srState.hDateQuick) : null;
  if (rH){ _srState.hDateFrom = rH.from; _srState.hDateTo = rH.to; }
})();

var _SR_CHART_COLORS = ['#2563eb','#16a34a','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#0d9488','#9333ea','#ca8a04','#e11d48','#4f46e5','#059669','#0284c7'];

var _SR_COLTH_ROWSFN_ = {}, _SR_COLTH_GETTER_ = {};
// ── Combo chon NHIEU Sale (giao dien giong "Lọc theo CS" o sidebar — go tim, moi ten 1 dong
//    rieng — nhung la kieu checkbox multi-select: click 1 ten thi TICK/BO TICK, dropdown KHONG
//    dong lai de con chon tiep ten khac. Cac ten da chon hien thanh chip nho ben duoi o tim.
//    Loc backend van la "khop don co BAT KY ten nao trong danh sach da chon" (contains, OR) —
//    da co san o buildSalesReportA_, khong doi gi ben backend. ──
var _srSaleComboData = [], _srSaleComboIdx = -1;
document.addEventListener('click', function(e){
  var combo = document.getElementById('sr-sale-combo');
  if (combo && !combo.contains(e.target)) srSaleComboClose();
});

// ── Combo chon NHIEU gia tri DUNG CHUNG (kenh Bao cao A, sale+kenh Bao cao C) — cung kieu
//    giao dien/hanh vi voi combo Sale rieng cua Bao cao A o tren (khong doi combo do, de
//    tranh dam vao tinh nang dang chay tot), nhung viet lai kieu tong quat (domId/field/optKey
//    lam tham so) de dung duoc cho nhieu o loc khac nhau ma khong phai chep lai 8 ham/o.
var _srComboReg = {}, _srComboData = {}, _srComboIdx = {};
// ── Lọc theo TEAM (multi-select) — chọn nhiều team thì ô Sale tương ứng TỰ ĐỘNG được set lại
//    đúng bằng hợp các thành viên của những team đã chọn (loại hết những sale không thuộc team
//    nào trong số đó). Bỏ chọn hết team (rỗng) thì KHÔNG đụng vào ô Sale, để còn tự chọn tay.
var _srTeamFieldToSaleField_ = { team: 'sale', cTeam: 'cSale', eTeam: 'eSale', bTeam: 'bSale', dTeam: 'dCs', fTeam: 'fSale' };
document.addEventListener('click', function(e){
  Object.keys(_srComboReg).forEach(function(domId){
    var combo = document.getElementById(domId);
    if (combo && !combo.contains(e.target)) srComboClose(domId);
  });
});
// ── Báo cáo D: KH "Chăm sóc" thêm nhanh — data RIÊNG (sheet "KH Chăm sóc mới"),
// không gộp chung báo cáo doanh số A/B/C. Nguồn dữ liệu độc lập, chỉ liên quan tới
// việc CS ghi nhận khách mới qua nút "+ Thêm KH/Đơn mới".
// ═══════════════════════════════════════════════════════
//  BÁO CÁO I: NHẬP DỮ LIỆU BASE/POS TỪ FILE EXPORT (thay vì copy tay vào Google Sheet) — thêm
//  2026-10-07 theo yêu cầu Duyên. File Base (.xls/.xlsx, export "Tất cả" từ Base platform) khớp
//  THẲNG HÀNG với cột của sheet "DT TỔNG " (A=Ngày tạo...V=Chi tiết lý do thất bại — xem DT_COL_*
//  ở gas_v13.js). File Pos (.xlsx, export đơn Pancake) khớp THẲNG HÀNG với "dữ liệu đơn" (A=STT
//  ...Q=Ghi chú nội bộ). Đọc file bằng SheetJS có sẵn trong trang (client), GỬI NGUYÊN các dòng
//  (đã bỏ header + cột rỗng cuối) lên backend action 'importSheetRows' — backend ghi nối tiếp vào
//  đúng sheet rồi tự khử trùng TUYỆT ĐỐI (dùng chung hàm với trigger onChange có sẵn, xem
//  _autoDedupExactRowsInSheet_ trong gas_v13.js) — không cần copy tay, không lo dán trùng 2 lần.
// ═══════════════════════════════════════════════════════
var _impState = { baseRows: null, baseFileName: '', baseWarn: '', posRows: null, posFileName: '', posWarn: '', uploading: false, result: null };

// ── Modal: Cài đặt KPI (Bậc 1/2/3, KPI Online, gán bậc từng người, KPI commit riêng) ──
// Dùng lại chính dataF.rows đang có (đã gồm ĐỦ mọi Sale trong SaleDirectory, kể cả 0 doanh thu
// kỳ này) — không cần gọi thêm action nào để mở modal.
var SALE_TIER_ORDER_CLIENT_ = ['TVF1','TVF2','F1','F2','F3','O1','O2','O3','O'];
var SALE_TIER_LABEL_CLIENT_ = {
  TVF1:'TVF1 — Thử việc 1', TVF2:'TVF2 — Thử việc 2',
  F1:'F1 — Văn phòng', F2:'F2 — Văn phòng', F3:'F3 — Văn phòng',
  O1:'O1 — Online (nhảy bậc)', O2:'O2 — Online (nhảy bậc)', O3:'O3 — Online (nhảy bậc)',
  O:'O — Online (không nhảy bậc)'
};
document.addEventListener('click', closeGearMenus);

var _irSearch = '';
var _scSearch = '';
var _scGroupsOpen = false;     // dong/mo khoi "Quan ly danh sach doi"
var _scGroupsDraft = null;     // ban nhap dang sua, null = chua mo
// ── Modal: % hoa hồng theo KÊNH (Nguồn đơn) — vd "facebook" = 1% cố định, bỏ qua ngưỡng 15tr
// và % cá nhân/team cho đơn thuộc kênh đó. Admin tự gõ tên Nguồn đơn (so khớp không phân biệt
// hoa/thường, tự trim) + % muốn áp — để trống % hoặc xoá dòng = bỏ cài, tính như cũ. ──
var _crNewKey = '';
// ── Modal: CHƯƠNG TRÌNH THƯỞNG (CRUD) ──
var _bpEditingId = null; // null = đang xem danh sách; id (hoặc 'new') = đang sửa/thêm 1 chương trình
var _bpDraft = null;
// ═══════════════════════════════════════════════════════════════════════════
//  BÁO CÁO H — TỔNG QUAN DATA ĐÃ CHIA (theo Ngày × CS, gom theo Team)
//  Nguồn: assignHistory (sheet AssignData — mỗi lượt chia: ngày, CS, danh sách SĐT) ghép với
//  careData (tình trạng CS / trạng thái Zalo / trạng thái KH HIỆN TẠI của từng SĐT). Chạy hoàn toàn
//  phía client — KHÔNG cần action GAS mới (nên không cần deploy lại GAS).
//  Số đơn chốt + Doanh thu = nhập TAY, lưu theo từng tháng vào Settings (assignReportManual_YYYY-MM)
//  để cả team cùng thấy, cache thêm ở localStorage.
// ═══════════════════════════════════════════════════════════════════════════
var _hManual = {};          // { 'YYYY-MM': { 'YYYY-MM-DD|csName': {o:soDon, r:doanhThu, t:timestamp} } }
var _hManualLoaded = {};    // { 'YYYY-MM': true } — tháng đã kéo từ Settings
var _hSaveTimers = {};
var _hKhMapOverride = loadLS('ome_cs_kh_map') || {};   // { nhómCS(label): giá trị Trạng thái KH } — admin chỉnh tay, ưu tiên hơn tự khớp theo tên

// Tên gọi khác giữa Tình trạng CS và Trạng thái KH (2 danh sách đặt tên không trùng nhau)
var _H_ALIAS_ = (function(){
  var raw = {
    'Knm/Máy bận':'Không thể kết nối', 'Thuê bao':'Không thể kết nối', 'Không liên lạc được':'Không thể kết nối',
    'Đặt hộ/Sai số':'Nhận hộ / Sai số', 'Cúp ngang':'Ngang Cúp', 'Ngang Cúp':'Cúp ngang',
    'Kcnc':'Từ chối', 'Kcnc/Không hiệu quả':'Từ chối', 'Chất lượng sản phẩm':'Từ chối'
  };
  var out = {};
  Object.keys(raw).forEach(function(k){ out[_hFold_(k)] = raw[k]; });
  return out;
})();
// ── Đơn chốt do CS nhập ở form (Doanh thu + Ghi chú đơn) ──
// Lưu theo tháng vào Settings (chotOrders_YYYY-MM) + cache localStorage; id = SĐT|ngày nên lưu lại cùng ngày là CẬP NHẬT chứ không nhân đôi đơn.
var _hChot = {};          // { 'YYYY-MM': { id: {id,phone,cs,date,rev,note,t} } }
var _hChotLoaded = {};
var _hChotTimers = {};
// ── Chỉ số + tỷ lệ Báo cáo H ──
// Kết nối = Chốt + Phân vân + Đang liên hệ + Từ chối + Khiếu nại (mọi nhóm TRỪ nhóm "Không liên lạc được").
// Đã tương tác/đã liên hệ = SĐT đã có Tình trạng CS (không tính "Chưa CS").
// Zalo phản hồi = "Đã kết bạn"; Zalo đã xin kết bạn/nhắn tin = các trạng thái dưới đây (không tính Chưa kết bạn / không có Zalo).
var _H_ZALO_REPLY_ = ['Đã kết bạn'];
var _H_ZALO_ASKED_ = ['Đã kết bạn','Chưa đồng ý','Không nhận tn lạ','Chặn','Hủy kết bạn'];
setTimeout(_hSyncKhMap_, 1500);

// ── Combo multi-select DUNG CHUNG cho 3 bo loc moi cua Bao cao B (Sale/Nguon don/Marketer) —
//    cung phong cach (go tim, tick nhieu, dropdown khong dong sau moi lan chon, chip xoa rieng)
//    nhu combo Sale cua Bao cao A, nhung viet 1 lan dung chung cho ca 3 de khong lap code 3 lan. ──
var _SRB_COMBO_CFG = {
  sale: { id: 'srb-sale-combo', stateKey: 'bSale', optKey: 'saleBOptions', label: 'Sale', placeholder: '🔍 Tìm & chọn sale...' },
  team: { id: 'srb-team-combo', stateKey: 'bTeam', optKey: 'teamOptions', label: 'Lọc theo Team', placeholder: '🔍 Tìm & chọn team...' },
  nguon: { id: 'srb-nguon-combo', stateKey: 'bNguon', optKey: 'nguonOptions', label: 'Nguồn đơn', placeholder: '🔍 Tìm & chọn nguồn...' },
  mkt: { id: 'srb-mkt-combo', stateKey: 'bMarketer', optKey: 'marketerOptions', label: 'Marketer', placeholder: '🔍 Tìm & chọn marketer...' },
  // 3 bo loc CRM — truoc day la <select multiple> hien san nhieu dong (choan cho), gio dung
  // chung 1 kieu combo go-tim/tick-nhieu/chip nhu Sale/Nguon/Marketer o tren. Dung getOptions/
  // getLabel (ham, khong phai gia tri tinh) vi danh sach Tinh trang CS/Trang thai KH co the
  // duoc admin sua qua modal Quan ly, va nhan FIELD_LABEL_CS/KH co the duoc doi ten rieng —
  // phai doc lai moi lan mo dropdown/ve lai filter bar, khong duoc ghim gia tri cu luc khai bao.
  cs: { id: 'srb-cs-combo', stateKey: 'bCareStatus', label: 'Tình trạng CS',
    getLabel: function(){ return (typeof FIELD_LABEL_CS!=='undefined' && FIELD_LABEL_CS) || 'Tình trạng CS'; },
    getOptions: function(){ return (typeof CARE_STATUS!=='undefined' ? CARE_STATUS : []) || []; },
    placeholder: '🔍 Tìm & chọn tình trạng CS...' },
  kh: { id: 'srb-kh-combo', stateKey: 'bKhStatus', label: 'Trạng thái KH',
    getLabel: function(){ return (typeof FIELD_LABEL_KH!=='undefined' && FIELD_LABEL_KH) || 'Trạng thái KH'; },
    getOptions: function(){ return (typeof _flatCustStatusValues==='function' ? _flatCustStatusValues() : []).filter(Boolean); },
    placeholder: '🔍 Tìm & chọn trạng thái KH...' },
  zalo: { id: 'srb-zalo-combo', stateKey: 'bZaloStatus', label: 'Kết bạn Zalo',
    getOptions: function(){ return (typeof ZALO_STATUS!=='undefined' ? ZALO_STATUS : []).filter(Boolean); },
    placeholder: '🔍 Tìm & chọn kết bạn Zalo...' }
};
var _srbComboData = {}, _srbComboIdx = {};
document.addEventListener('click', function(e){
  Object.keys(_SRB_COMBO_CFG).forEach(function(key){
    var cfg = _SRB_COMBO_CFG[key];
    var combo = document.getElementById(cfg.id);
    if (combo && !combo.contains(e.target)) srbComboClose(key);
  });
});
// ═══════════════════════════════════════════════════════
//  CHIA DATA THEO TEAM  (tab thứ 4 trong modal chia data)
// ═══════════════════════════════════════════════════════
var _teamAssignPct = {}; // teamId -> percent
var _teamAssignSel = {}; // teamId -> Set tên CS được tích (mặc định: tất cả thành viên)
// Wrap switchAssignTab → thêm case 'team'
var _v9PrevSwitchAssignTab = switchAssignTab;
switchAssignTab = function(tab, el){
  if (tab === 'team'){
    currentAssignTab = 'team';
    document.querySelectorAll('.assign-tab').forEach(function(t){ t.classList.remove('active'); });
    if (el) el.classList.add('active');
    var footer = document.getElementById('assign-footer');
    if (footer) footer.innerHTML = '<button class="btn" onclick="closeAssignModal()">Đóng</button>'+
      '<button class="btn primary" onclick="doAssignByTeam()">✓ Chia theo Team</button>';
    renderAssignTeam();
    return;
  }
  _v9PrevSwitchAssignTab(tab, el);
};

// ═══════════════════════════════════════════════════════
//  CHIA DATA TỰ ĐỘNG THEO NGÀY (engine) — phần 1/3
//  Cấu hình _aaCfg lưu localStorage 'ome_auto_assign_cfg' + Settings 'autoAssignCfg' (dùng chung getSetting/setSetting
//  sẵn có → KHÔNG cần sửa/deploy lại GAS). Mô hình chia:
//   1) Mỗi người nhận có HẠN MỨC/ngày: từ số cụ thể của người đó, hoặc % của hạn mức Team (Team = số cụ thể hoặc % của tổng/ngày)
//   2) Hạn mức người → tách theo tỷ lệ NGUỒN → rồi từng nguồn tách theo tỷ lệ ƯU TIÊN (VIP/Thân thiết/Tiềm năng/Khác)
//   3) Tỷ lệ nguồn/ưu tiên: cài chung, ghi đè theo Team, ghi đè theo từng người. Mỗi tỷ lệ là {mode:'pct'|'count', vals:{}}
//   4) Thiếu KH ở 1 nhóm → bù từ nhóm còn lại (cùng nguồn trước, rồi nguồn khác); vẫn thiếu thì báo thiếu.
// ═══════════════════════════════════════════════════════
var _AA_SRC_KEYS = ['dt','don','cs','cskh'];
var _AA_POS_KEYS = ['dt','don','cs'];   // nguon POS (chia theo ty le nguon chung). CSKH-Duyen KHONG nam trong ty le nay: chia RIENG (cskhTeams/cskhMembers...)
var _AA_SRC_LABEL = { dt:'DT tổng', don:'Dữ liệu đơn', cs:'Chăm sóc', cskh:'CSKH-Duyên' };
var _AA_PRIO_KEYS = ['vip','tt','tn','other'];
var _AA_PRIO_LABEL = { vip:'VIP', tt:'Thân thiết', tn:'Tiềm năng', other:'Khác (chưa phân hạng)' };
var _AA_TIER = { vip:'VIP', tt:'Thân thiết', tn:'Tiềm năng' };
var _AA_HANG_KEYS = ['thuong','tt','vip','super'];
var _AA_HANG_LABEL = { thuong:'Khách thường', tt:'Ưu tiên', vip:'Vip', super:'Super VVip' };   // PHAN HANG KH theo doanh thu (xem _hangKeyOf_ trong index.html)

// ── Lưu / nạp cấu hình (Settings sheet là nguồn chung cho mọi máy; localStorage là bản đệm) ──
var _aaCfg = Object.assign(_aaDefaultCfg(), loadLS('ome_auto_assign_cfg') || {});
var _aaBusy = false;
// Kiểm tra định kỳ: mở CRM là chạy nếu đến hạn; để tab mở qua nửa đêm vẫn tự chạy sang ngày mới
setTimeout(function(){ _aaRunIfDue(false); }, 25000);
setInterval(function(){ _aaRunIfDue(false); }, 5 * 60 * 1000);


// ═══════════════════════════════════════════════════════
//  CHIA DATA TỰ ĐỘNG — giao diện tab "⏰ Chia tự động" (phần 2/3)
// ═══════════════════════════════════════════════════════
var _aaOpen = {};   // teamId -> đang mở chi tiết thành viên
var _aaRatioTeamOpen = {};   // teamId -> đang mở khối tỷ lệ riêng của Team ở mục ② (chỉ UI)
var _AA_DOW = [['1','T2'],['2','T3'],['3','T4'],['4','T5'],['5','T6'],['6','T7'],['0','CN']];
// ── MỤC RIÊNG: CSKH-Duyên chia riêng theo ngày (không dính tỷ lệ nguồn/ưu tiên/hạng của POS) ──
var _aaCkOpen = {};   // teamId -> đang mở chi tiết người nhận CSKH (chỉ UI)
var _aaPrevSwitchTab = switchAssignTab;
switchAssignTab = function(tab, el){
  if (tab === 'auto'){
    currentAssignTab = 'auto';
    document.querySelectorAll('.assign-tab').forEach(function(t){ t.classList.remove('active'); });
    if (el) el.classList.add('active');
    var f = document.getElementById('assign-footer');
    if (f) f.innerHTML = '<button class="btn" onclick="closeAssignModal()">Đóng</button><button class="btn" onclick="_aaShowPreview()">👁 Xem trước</button>'+
      '<button class="btn" id="aa-run-btn" onclick="_aaRunNow()">▶ Chạy ngay</button><button class="btn primary" id="aa-save-btn" onclick="_aaSaveNow()">💾 Lưu cấu hình</button>';
    _aaPullCfg().then(renderAssignAuto); renderAssignAuto();
    return;
  }
  _aaPrevSwitchTab(tab, el);
};

// ═══════════════════════════════════════════════════════
//  NO-ACTION CHIP trong col-toggle-bar
// ═══════════════════════════════════════════════════════
// Hidden checkbox để các hàm cũ (applyFilters đọc #no-action-filter) vẫn dùng được
(function(){
  var hid = document.createElement('input');
  hid.type = 'checkbox';
  hid.id = 'no-action-filter';
  hid.style.display = 'none';
  document.body.appendChild(hid);
})();

var _noActionActive = false;

// Sau mỗi applyFilters → cập nhật badge đếm KH chưa tác động
window.addEventListener('load', function(){
  setTimeout(function(){
    if (typeof applyFilters === 'function' && !applyFilters._noActionWrapped){
      var _orig = applyFilters;
      applyFilters = function(){
        _orig.apply(this, arguments);
        _updateNoActionBadge();
      };
      applyFilters._noActionWrapped = true;
    }
    _updateNoActionBadge();
  }, 200);
});

// ═══════════════════════════════════════════════════════
//  📤 UP DỮ LIỆU — gom 5 loại file up hằng ngày vào 1 chỗ: Base, Pos, Pancake (Thống kê tương tác /
//  Thống kê nhân viên / Thống kê tag). Chọn hoặc kéo thả NHIỀU file cùng lúc → tự nhận dạng loại theo
//  nội dung file (tên sheet/tiêu đề cột, không phụ thuộc tên file) → kiểm tra → "Lưu tất cả".
//  KHÔNG viết lại logic lưu: dùng đúng các hàm sẵn có của từng mục (_impUpload, _pkUploadToCRM,
//  _pkUploadSdtToCRM, _pkTagSaveToServer) nên nhật ký, xoá cache báo cáo, ghi nhớ tên NV... y như up
//  ở mục cũ. Các mục up riêng lẻ (Báo cáo doanh số → Nhập dữ liệu, Báo cáo Pancake) vẫn dùng được.
// ═══════════════════════════════════════════════════════
var _upState = { items: [], busy: false, seq: 0, nmLoading: false };
var _UP_KINDS = {
  pk_eng:   { label: 'Pancake — Thống kê tương tác',                 short: 'Tương tác', admin: false },
  pk_staff: { label: 'Pancake — Thống kê nhân viên (SĐT / đơn chốt)', short: 'Nhân viên', admin: false },
  pk_tag:   { label: 'Pancake — Thống kê tag',                        short: 'Tag',       admin: false },
  base:     { label: 'Base — Danh sách công việc (→ DT TỔNG)',        short: 'Base',      admin: true },
  pos:      { label: 'Pos — Đơn hàng Pancake POS (→ dữ liệu đơn)',    short: 'Pos',       admin: true }
};
var _UP_ORDER = ['pk_eng', 'pk_staff', 'pk_tag', 'base', 'pos'];

// ═══════════════════════════════════════════════════════
var _v9PrevSwitchTab = switchTab;
var _activeV9Tab = 'list';
switchTab = function(tab, el){
  if (tab === 'dailybrief' && !_dbStandalone){ _dbOpenStandalone(); return; } // Bao cao ngay = trang rieng
  _v9PrevSwitchTab(tab, el);
  _activeV9Tab = tab;
  ['dashboard','team','audit','uploaddata','salesreport','pancake','kpipancake','mktchecklist','dailybrief'].forEach(function(name){
    var panel = document.getElementById('tab-'+name);
    if (panel) panel.style.display = (tab===name) ? 'flex' : 'none';
  });
  if (tab === 'dashboard') renderDashboard();
  else if (tab === 'team') renderTeamTab();
  else if (tab === 'audit') renderAuditTab();
  else if (tab === 'uploaddata') renderUploadDataTab();
  else if (tab === 'salesreport') renderSalesReportTab();
  else if (tab === 'pancake') renderPancakeTab();
  else if (tab === 'kpipancake') renderKpiPancakeTab();
  else if (tab === 'mktchecklist') renderMktChecklistTab();
  else if (tab === 'dailybrief') renderDailyBriefTab();
};

// ═══════════════════════════════════════════════════════
//  CHẾ ĐỘ BÁO CÁO (chụp màn hình gửi sếp): vào tab báo cáo nào thì ẩn header, sidebar lọc KH, thanh
//  tab và dải số KH; chỉ còn 1 thanh gọn = menu chọn báo cáo + nút "Về màn hình chính".
//  Chỉ bật/tắt class "rpt-mode" trên <body> (CSS ở khối <style> dưới) nên không đụng gì tới logic
//  render của từng báo cáo. "Báo cáo ngày" tự mở trang riêng nên không nằm trong chế độ này.
// ═══════════════════════════════════════════════════════
var _RPT_MODE_TABS = ['salesreport','pancake','kpipancake','mktchecklist'];
var _RPT_MODE_LABELS = {
  salesreport:'📈 Báo cáo doanh số', pancake:'📥 Báo cáo Pancake', kpipancake:'📈 KPI Pancake',
  mktchecklist:'✅ Checklist MKT', dailybrief:'🎯 Báo cáo ngày'
};
var _v9PrevSwitchTab2 = switchTab;
switchTab = function(tab, el){
  if (tab === 'dailybrief' && !_dbStandalone){ _v9PrevSwitchTab2(tab, el); return; } // mo trang rieng, giu nguyen man hinh hien tai
  _v9PrevSwitchTab2(tab, el);
  var on = !_dbStandalone && _RPT_MODE_TABS.indexOf(tab) !== -1;
  document.body.classList.toggle('rpt-mode', on);
  if (on) _rptModeBuildBar_(tab);
};

// ═══════════════════════════════════════════════════════
//  GIAO MÃ GAS (nút copy trong modal Google Sheets) — tải qua mạng (action=getGasSource) thay vì
//  nhúng sẵn ~330KB text trong trang (giảm dung lượng tải mỗi lần mở CRM). Cache trong phiên để
//  không tải lại nhiều lần; xem "🔄 Đồng bộ mã GAS" trong modal để cập nhật bản trên server.
var _gasSrcCache = null; // { code, updatedAt } | null
copyGsCode = async function(){
  toast('Đang tải mã GAS...');
  var src = await _fetchGasSource(false);
  if (!src || !src.code) { toast('⚠ Chưa có mã GAS trên server — mở mục "🔄 Đồng bộ mã GAS" bên dưới để nạp (Admin).'); return; }
  navigator.clipboard.writeText(src.code).then(function(){ toast('✓ Đã copy Apps Script — dán vào Apps Script & Triển khai MỚI'); });
};
var _v9PrevOpenGsModal = openGsModal;
openGsModal = function(){
  if (document.body.classList.contains('demo-mode')) return;
  _v9PrevOpenGsModal();
  var prev = document.getElementById('gs-code-preview');
  if (prev && !prev.dataset.v9){
    prev.textContent = 'Đang tải mã GAS...';
    prev.dataset.v9 = '1';
    _fetchGasSource(false).then(function(src){
      var metaEl = document.getElementById('gs-code-updated-at');
      if (src && src.code) {
        prev.textContent = src.code.length > 4000
          ? src.code.slice(0,4000) + '\n\n… (đã cắt bớt để xem nhanh — bấm "Copy Apps Script Code" để lấy đầy đủ)'
          : src.code;
        if (metaEl) metaEl.textContent = src.updatedAt ? ('Đồng bộ lần cuối: ' + new Date(src.updatedAt).toLocaleString('vi-VN')) : '';
      } else {
        prev.textContent = 'Chưa có mã GAS trên server — mở mục "🔄 Đồng bộ mã GAS" bên dưới để nạp (Admin).';
        prev.dataset.v9 = '';
      }
    });
  }
};
// Wrap syncFromGS → đồng bộ Teams (chỉ khi tải đầy đủ/thủ công, không phải nhịp 3s nhẹ)
if (typeof syncFromGS === 'function'){
  var _v9PrevSync = syncFromGS;
  syncFromGS = async function(opts){
    await _v9PrevSync(opts);
    opts = opts || {};
    var heavy = opts.manual || opts.pullOrders;
    if (gsUrl && heavy){
      try {
        var sep = gsUrl.includes('?') ? '&' : '?';
        var r = await fetch(gsUrl + sep + 'action=teams', { redirect:'follow' });
        var d = await r.json();
        if (d && d.teams && d.teams.length){
          teams = d.teams;
          _origSaveLS('ome_teams', teams);
          if (_activeV9Tab === 'team') renderTeamTab();
        }
      } catch(e){ /* GAS cũ chưa hỗ trợ → bỏ qua */ }
      try {
        var sepM = gsUrl.includes('?') ? '&' : '?';
        var rM = await fetch(gsUrl + sepM + 'action=mktTeams', { redirect:'follow' });
        var dM = await rM.json();
        if (dM && dM.teams && dM.teams.length){
          mktTeams = dM.teams; _origSaveLS('ome_mkt_teams', mktTeams);
          if (_activeV9Tab === 'team') renderTeamTab();
        }
      } catch(e){ /* GAS cũ chưa có MktTeams → bỏ qua */ }
      // Đồng bộ chiến dịch chia data (để Danh sách KH không bị mất khi vào tab)
      try { if (typeof pullAssignHistory === 'function') await pullAssignHistory(); } catch(e){}
      // Đồng bộ danh sách tài khoản đăng nhập (cho admin thấy bản mới nhất)
      try { if (typeof pullUsers === 'function'){ await pullUsers(); if (typeof _renderAuthHeader==='function') _renderAuthHeader(); } } catch(e){}
    }
  };
}

window.addEventListener('load', function(){
  // chạy sau cùng để chắc chắn mọi DOM/biến đã sẵn sàng
  setTimeout(function(){ _injectV9UI(); _renderAuthHeader(); _authGate(); if (typeof startReminderChecks==='function') startReminderChecks(); if (typeof startAutoSync==='function') startAutoSync(); if (typeof _checkAndRenewBdaySchedules==='function') _checkAndRenewBdaySchedules(); if (typeof checkDataDaoRenewSchedules==='function') checkDataDaoRenewSchedules(); if (typeof reapplyColVisibility==='function') reapplyColVisibility(); if (typeof _applyBarCustomization==='function') _applyBarCustomization(); if (typeof _pullBarMenuForAccount==='function') _pullBarMenuForAccount(); if (typeof _applyUserTabPermissions==='function') _applyUserTabPermissions(); }, 0);
});

// ═══════════════════════════════════════════════════════
//  V9.2 — ĐĂNG NHẬP / TÀI KHOẢN (admin cấp tài khoản cho nhân viên)
//  Lưu ý: đây là lớp đăng nhập gọn nhẹ cho nội bộ — mật khẩu được hash
//  (SHA-256 + salt) trước khi lưu lên Google Sheet (sheet "Users").
// ═══════════════════════════════════════════════════════
var _PW_SALT = 'CRM-CS-Portal::v9::salt';
var _PW_SALT_OLD = 'OME-CS-Portal::v9::salt'; // salt cu (truoc khi doi OME -> CRM) — giu tam de khong khoa tai khoan dang co, tu nang cap sang salt moi ngay lan dang nhap ke tiep
var accounts = (typeof loadLS === 'function' ? (loadLS('ome_accounts') || []) : []);
var _authAccount = (typeof loadLS === 'function' ? (loadLS('ome_auth') || null) : null);
var _bootstrapAdmin = false;
// ── Trang riêng Báo cáo ngày (?view=dailybrief) ──
// Chờ cổng đăng nhập chạy xong (cần biết đúng tài khoản/phạm vi Sale) rồi mới vẽ báo cáo; nếu
// chưa đăng nhập thì form đăng nhập vẫn hiện như thường, đăng nhập xong báo cáo tự hiện ra.
if (typeof _dbStandalone !== 'undefined' && _dbStandalone){
  document.documentElement.classList.add('db-standalone');
  document.title = 'Báo cáo ngày — Sasum';
  var _dbOrigAuthGate = _authGate;
  _authGate = async function(){
    try { return await _dbOrigAuthGate.apply(this, arguments); }
    finally { window._dbGateDone = true; }
  };
  var _dbBootTimer = setInterval(function(){
    var wrap = document.getElementById('dailybrief-wrap');
    var ov = document.getElementById('login-overlay');
    if (!window._dbGateDone || !wrap || (ov && ov.classList.contains('show'))) return;
    clearInterval(_dbBootTimer);
    var panel = document.getElementById('tab-dailybrief');
    if (panel && panel.parentNode !== document.body) document.body.appendChild(panel); // tach khoi #data-view (dang display:none)
    if (typeof _tabAllowedForUser === 'function' && !_tabAllowedForUser('dailybrief')){
      wrap.innerHTML = '<div style="padding:24px;color:var(--muted)">Tài khoản này chưa được cấp quyền xem Báo cáo ngày.</div>';
      return;
    }
    renderDailyBriefTab();
  }, 250);
}

// Khoá đổi vai trò xem cho người không phải admin
if (typeof openRoleModal === 'function'){
  var _prevOpenRoleModal = openRoleModal;
  openRoleModal = function(){
    if (_authAccount && _authAccount.role !== 'admin'){ if (typeof toast==='function') toast('Chỉ admin mới đổi vai trò xem.'); return; }
    return _prevOpenRoleModal.apply(this, arguments);
  };
}

// ── Trạng thái UI của bảng quản lý tài khoản ──
// _acctOpen: các dòng đang mở rộng (giữ nguyên khi vẽ lại bảng)
// _acctEditing: username đang được SỬA (rỗng = form đang ở chế độ thêm mới)
var _acctOpen = {};
var _acctEditing = '';

// Nguồn được tính là "mua lại" — dùng để phân loại VIP/Thân thiết/Tiềm năng
const RENEW_SOURCES = ['kh renew','kh renew mkt','kh giới thiệu','data đảo renew'];
// Thu thập TẤT CẢ các nguồn (không lọc bỏ nguồn nào)
const VALID_SOURCES = null; // null = lấy tất cả
// CARE_STATUS_TREE — cấu trúc cây (nhóm mẹ/con), tương đồng CUSTOMER_STATUS_TREE
// backward-compat: nếu localStorage còn lưu string[] cũ → tự migrate sang tree phẳng
const CARE_STATUS_TREE_DEFAULT = [
  { label: 'Đã chốt', children: [
    { label: 'Chốt', value: 'Chốt' },
    { label: 'Phân vân/Tiềm năng', value: 'Phân vân/Tiềm năng' },
  ]},
  { label: 'Đang liên hệ', children: [
    { label: 'Hẹn gọi lại sau', value: 'Hẹn gọi lại sau' },
    { label: 'Đang sd', value: 'Đang sd' },
    { label: 'Đang tạm ngưng', value: 'Đang tạm ngưng' },
  ]},
  { label: 'Không liên lạc được', children: [
    { label: 'Knm/Máy bận', value: 'Knm/Máy bận' },
    { label: 'Cúp ngang', value: 'Cúp ngang' },
    { label: 'Thuê bao', value: 'Thuê bao' },
  ]},
  { label: 'Không hợp lệ', children: [
    { label: 'Kcnc/Không hiệu quả', value: 'Kcnc/Không hiệu quả' },
    { label: 'Đặt hộ/Sai số', value: 'Đặt hộ/Sai số' },
    { label: 'Bầu', value: 'Bầu' },
  ]},
  { label: 'Chưa sử dụng', value: 'Chưa sử dụng' },
  { label: 'Chưa liên hệ', value: 'Chưa liên hệ' },
];

let CARE_STATUS_TREE = (function() {
  var raw = loadLS('ome_care_status');
  var migrated = _migrateCareStatusIfNeeded(raw);
  return migrated ? migrated : JSON.parse(JSON.stringify(CARE_STATUS_TREE_DEFAULT));
})();

// CARE_STATUS_DEFAULT kept for reference (reset button)
const CARE_STATUS_DEFAULT = [
  'Chốt','Phân vân/Tiềm năng','Hẹn gọi lại sau','Đang sd','Đang tạm ngưng',
  'Knm/Máy bận','Kcnc/Không hiệu quả','Đặt hộ/Sai số','Cúp ngang',
  'Bầu','Thuê bao','Chưa sử dụng','Chưa liên hệ'
];

// Proxy object: mọi nơi đọc CARE_STATUS[i] hoặc CARE_STATUS.map(...) vẫn hoạt động
let CARE_STATUS = _flatCareStatusValues();
// ── TRẠNG THÁI KHÁCH HÀNG (phân cấp, động) ──
// Cấu trúc: { label, value?, children? }
// Trạng thái mẹ có children → chỉ hiển thị làm nhóm, không chọn được
const CUSTOMER_STATUS_TREE_DEFAULT = [
  { label: '1. Không thể kết nối', value: '1. Không thể kết nối' },
  { label: '2. Đang sử dụng', children: [
    { label: '2.1 Không hiệu quả', value: '2.1 Không hiệu quả' },
    { label: '2.2 Hiệu quả', value: '2.2 Hiệu quả' },
    { label: '2.3 Chưa rõ tác dụng', value: '2.3 Chưa rõ tác dụng' },
  ]},
  { label: '3. Chưa dùng', value: '3. Chưa dùng' },
  { label: '4. Không còn sử dụng', children: [
    { label: '4.1 Không hiệu quả', value: '4.1 Không hiệu quả' },
    { label: '4.2 Đã có kết quả', value: '4.2 Đã có kết quả' },
    { label: '4.3 Đã đổi sang sản phẩm khác', value: '4.3 Đã đổi sang sản phẩm khác' },
  ]},
  { label: '5. Đang tạm dừng', value: '5. Đang tạm dừng' },
  { label: '6. Nhận hộ / Sai số', value: '6. Nhận hộ / Sai số' },
  { label: '7. Ngang Cúp', value: '7. Ngang Cúp' },
  { label: '8. Từ chối', value: '8. Từ chối' },
];
let CUSTOMER_STATUS_TREE = JSON.parse(JSON.stringify(loadLS('ome_kh_status_tree') || CUSTOMER_STATUS_TREE_DEFAULT));
// Hoãn gọi bằng setTimeout: gsUrl được khai báo (let) ở PHÍA SAU trong cùng script này — gọi
// ngay tại đây sẽ chạm biến trước khi khởi tạo (temporal dead zone) và ném ReferenceError.
setTimeout(_syncKhStatusTreeFromGAS, 0);

// Mốc màu xanh/vàng/đỏ cho widget "Tỷ lệ chốt theo Sale" — admin tự chỉnh được (yêu cầu
// 2026-09-24): mặc định đỏ <2%, vàng 2–10%, xanh >10% (khác mặc định cũ cứng 30/50 chỉ hợp
// khi mẫu số là số ĐƠN, không hợp khi mẫu số đổi thành TỔNG TƯƠNG TÁC Pancake — tỷ lệ tự
// nhiên thấp hơn nhiều). Luu chung 1 setting ('closeRateThresholds') cho ca CRM, dung GIONG
// pattern khStatusTree/fieldLabelCS o tren (cache local + dong bo GAS).
let CLOSE_RATE_THRESHOLDS = loadLS('ome_close_rate_thresholds') || { red: 2, green: 10 };
setTimeout(_syncCloseRateThresholdsFromGAS, 0);
// Ẩn/hiện Page & Sale khỏi báo cáo chung (yêu cầu 2026-09-25): admin tự chọn những
// Page/kênh và Sale KHÔNG thuộc phạm vi mình quản lý để ẩn khỏi Dashboard/Báo cáo doanh
// số/KPI Pancake — khác _inUserScope (đó là ẩn theo VAI TRÒ đăng nhập, cái này là danh
// sách admin TỰ CHỌN, áp dụng chung cho MỌI người xem báo cáo, kể cả admin khác).
let HIDDEN_CHANNELS = loadLS('ome_hidden_channels') || [];
let HIDDEN_SALES = loadLS('ome_hidden_sales') || [];
setTimeout(_syncHiddenPageSaleFromGAS, 0);
// Don gia 1 don vi "vang" (mục "Thêm vàng" trong giỏ hàng Soạn đơn của Pancake AI) — admin cài
// ở đây (gear Cài đặt > 💰 Đơn giá vàng, trong Báo cáo doanh số) HOẶC ngay ở trang Options của
// Pancake AI; cả 2 nơi cùng đọc/ghi 1 setting GAS 'goldUnitAmount' nên chỉ cần cài 1 chỗ là áp
// dụng cho cả team ngay. Mặc định 350.000đ nếu GAS chưa có setting này.
let GOLD_UNIT_AMOUNT = loadLS('ome_gold_unit_amount') || 350000;
setTimeout(_syncGoldUnitAmountFromGAS, 0);
// Tên hiển thị của 2 trường lớn CỐ ĐỊNH — cho phép admin đổi tên (khác với XÓA/tạo trường,
// 2 trường này luôn tồn tại vì có cột riêng trong CareData, chỉ đổi được CÁCH GỌI/hiển thị).
let FIELD_LABEL_CS = loadLS('ome_field_label_cs') || 'Tình trạng CS';
let FIELD_LABEL_KH = loadLS('ome_field_label_kh') || 'Trạng thái KH';
let FIELD_LABEL_ZALO = loadLS('ome_field_label_zalo') || 'Kết bạn Zalo';   // sửa trực tiếp ở ô trường (✏ cạnh nhãn) — xem openFieldEditor
setTimeout(_syncFieldLabelsFromGAS, 0);
setTimeout(_applyFieldLabels, 0);

// ════════════════════════════════════════════════════════════════════
//  TRƯỜNG TỰ TẠO (admin tự thêm "trường lớn" ngoài 2 trường có sẵn)
// ════════════════════════════════════════════════════════════════════
// "Tình trạng CS" và "Trạng thái KH" là 2 trường lớn CỐ ĐỊNH (có cột riêng trong CareData trên
// Google Sheet). Khối này cho phép admin TỰ TẠO THÊM trường lớn mới — mỗi trường có cây lựa chọn
// mẹ/con riêng, dùng đúng cấu trúc { label, value } / { label, children:[...] } như 2 trường kia.
// Giá trị CS chọn được lưu gộp trong careData[phone].custom = { "<id trường>": "giá trị" } nên
// KHÔNG cần thêm cột mới vào Google Sheet mỗi lần admin tạo trường (tránh phải sửa backend GAS).
// Cấu trúc: [{ id: 'cf_...', label: 'Tên trường', tree: [...] }]
let CUSTOM_FIELDS = (function(){
  try { var v = loadLS('ome_custom_fields'); return Array.isArray(v) ? v : []; } catch(e){ return []; }
})();

setTimeout(_syncCustomFieldsFromGAS, 0);

// ════════════════════════════════════════════════════════════════════
//  HOA HỒNG THEO CÁ NHÂN (override) — dùng cùng cơ chế setting chung với
//  CUSTOM_FIELDS/khStatusTree, KHÔNG cần thêm action/cột mới ở backend.
//  { "<tên sale>": { above15: number|'', below15: number|'' } }
//  Ô nào để trống ('' / undefined) thì dùng % của TEAM mà người đó thuộc về
//  (xem _resolveCommissionRate_).
// ════════════════════════════════════════════════════════════════════
const COMMISSION_THRESHOLD = 15000000; // 15 triệu — ngưỡng phân loại đơn "≥15tr" / "<15tr"
let INDIVIDUAL_RATES = (function(){
  try { var v = loadLS('ome_individual_rates'); return (v && typeof v === 'object') ? v : {}; } catch(e){ return {}; }
})();

setTimeout(_syncIndividualRatesFromGAS, 0);

// ════════════════════════════════════════════════════════════════════
//  PHÂN LOẠI SALE ONLINE / OFFLINE — admin cài ở "Quản lý Team", dùng để
//  xác định "Đối tượng áp dụng" của từng CHƯƠNG TRÌNH THƯỞNG bên dưới.
//  { "<tên sale>": "online" | "offline" }  — chưa cài = '' (không thuộc nhóm nào,
//  các chương trình có giới hạn đối tượng sẽ KHÔNG áp dụng cho tới khi được cài).
// ════════════════════════════════════════════════════════════════════
let SALE_CHANNELS = (function(){
  try { var v = loadLS('ome_sale_channels'); return (v && typeof v === 'object') ? v : {}; } catch(e){ return {}; }
})();

// Danh sach "doi Sale" — truoc chi co 2 nhom co dinh Online/Van phong, gio Admin tu dinh nghia
// them nhom moi (vd CSKH/Quay...) o modal "🏷️ Phân loại đội Sale". 2 muc mac dinh nay GIU
// NGUYEN key 'online'/'offline' de khong vo du lieu SALE_CHANNELS/saleType da luu tu truoc.
let SALE_GROUPS = (function(){
  try { var v = loadLS('ome_sale_groups'); return (Array.isArray(v) && v.length) ? v : [{key:'online',label:'Online'},{key:'offline',label:'Văn phòng'}]; }
  catch(e){ return [{key:'online',label:'Online'},{key:'offline',label:'Văn phòng'}]; }
})();
setTimeout(_syncSaleGroupsFromGAS, 0);
setTimeout(_syncSaleChannelsFromGAS, 0);

// ════════════════════════════════════════════════════════════════════
//  % HOA HỒNG THEO KÊNH (Nguồn đơn) — admin cài ở modal "📡 % hoa hồng theo Kênh"
//  (mở từ gear-menu Báo cáo E). Đơn thuộc 1 Nguồn đơn (nguonDon) đã được cài ở đây sẽ
//  tính hoa hồng THEO ĐÚNG % cố định đó, BỎ QUA hoàn toàn % cá nhân/team và ngưỡng 15tr.
//  CHANNEL_COMMISSION_RATES = { "<nguonDon viết thường, đã trim>": <số %, vd 1 = 1%> }
//  Key luôn lưu viết thường + trim để so khớp không phân biệt hoa/thường.
// ════════════════════════════════════════════════════════════════════
let CHANNEL_COMMISSION_RATES = (function(){
  try { var v = loadLS('ome_channel_commission_rates'); return (v && typeof v === 'object') ? v : {}; } catch(e){ return {}; }
})();

setTimeout(_syncChannelCommissionRatesFromGAS, 0);

// ════════════════════════════════════════════════════════════════════
//  CHƯƠNG TRÌNH THƯỞNG — admin cài ở modal "🏆 Chương trình thưởng" (mở từ Báo cáo
//  hoa hồng). Mỗi chương trình gồm các điều kiện CÓ CẤU TRÚC (để tự tính được) và 2 ô
//  ghi chú tự do (chỉ để nhắc kế toán, KHÔNG được tự động chấm — vì là văn bản tự do).
//  BONUS_PROGRAMS = [{
//    id, name,                      // nhãn ngắn để nhận diện chương trình
//    dateFrom, dateTo,               // 'YYYY-MM-DD', dateTo rỗng = không giới hạn
//    audience: {online, offline},    // rỗng cả 2 = áp dụng mọi sale (kể cả sale chưa phân loại)
//    product,                        // từ khoá sản phẩm (phân tách bởi dấu phẩy), rỗng = mọi sản phẩm
//                                     // CÓ điền -> thưởng NHÂN theo số lượng sản phẩm khớp bán được
//    requireProduct,                 // từ khoá BẮT BUỘC có trong ô Sản phẩm của đơn (vd "vòng") thì điều kiện doanh thu THEO ĐƠN mới được tính;
//                                     // khác "product" ở chỗ KHÔNG nhân số lượng — chỉ là cổng lọc. Rỗng = không lọc.
//    extraNote, exclusionNote,       // ghi chú tự do — chỉ hiển thị, không tự tính
//    tier: {enabled, rows:[{count,bonus}]},   // thưởng theo SỐ ĐƠN CHỐT TRONG NGÀY của 1 sale (bậc thang)
//    revenue: {enabled, scope:'order'|'day', min, max},  // thưởng theo giá trị 1 đơn HOẶC doanh số/ngày
//    bonusAmount                     // mức thưởng dùng cho product/revenue (tier dùng bonus riêng từng bậc)
//  }]
// ════════════════════════════════════════════════════════════════════
let BONUS_PROGRAMS = (function(){
  try { var v = loadLS('ome_bonus_programs'); return Array.isArray(v) ? v : []; } catch(e){ return []; }
})();

setTimeout(_syncBonusProgramsFromGAS, 0);

const ZALO_STATUS = [
  'Đã kết bạn','Chưa kết bạn','Chưa đồng ý','Không nhận tn lạ',
  'Chặn','Hủy kết bạn','Không tìm thấy zl','ZL NHD/K có','Zalo ngừng hd'
];
(function(){ var o = loadLS('ome_zalo_status_opts'); if (Array.isArray(o) && o.length) _zaloApplyOpts_(o); })();
const SCHED_TYPES = [
  {key:'goi',     label:'Hẹn gọi',       color:'#2563eb'},
  {key:'sp',      label:'Nhắc SP',        color:'#059669'},
  {key:'cs',      label:'Chăm sóc',       color:'#7c3aed'},
  {key:'hen',     label:'Hẹn mua lại',   color:'#b45309'},
  {key:'notify',  label:'Thông báo',      color:'#0891b2'},
  {key:'birthday',label:'🎂 Sinh nhật',   color:'#e11d48'},
  {key:'custom',  label:'Tùy chỉnh',      color:'#64748b'},
];

// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let allCustomers = [];
let loadedFiles = [];
let customerMap = {};
let careData = loadLS('ome_care') || {};
// Nguồn "Chăm sóc": KH thêm nhanh (Tên/SĐT/Ghi chú) từ nút "+ Thêm KH/Đơn mới" — lưu ở
// sheet RIÊNG (không chung CareData, không gộp vào báo cáo A/B/C). Key = phone.
let careLeads = loadLS('ome_care_leads') || {};
// Nguồn thứ 3 "CSKH-Duyên" (sheet cùng file DT tổng / dữ liệu đơn): { SĐT: [ {name, tier(VIP/SPV), address, ...} ] }.
// Khách có cùng SĐT ở DT tổng / dữ liệu đơn / CSKH-Duyên được GỘP thành 1 khách (customerMap theo SĐT) — xem buildCustomers.
let cskhData = (function(){ // chuan hoa cache localStorage cu: ban 'lite' tung luu {name,tier} (object) -> phai la MANG dong, neu khong .find()/.forEach nem loi va CRM khong dung duoc danh sach KH
  const raw = loadLS('ome_cskh_duyen') || {}, out = {};
  Object.keys(raw).forEach(function(ph){ const v = raw[ph]; out[ph] = Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : []); });
  return out;
})();
let cskhMeta = loadLS('ome_cskh_duyen_meta') || { found: null, total: 0, noPhone: 0 };
// Tập SĐT có trong sheet "dữ liệu đơn" (nguồn của Báo cáo B) — chỉ dùng để LỌC nguồn ở
// màn hình chính, không kéo chi tiết sản phẩm vào danh sách khách.
let donPhoneSet = new Set(loadLS('ome_don_phones') || []);
let donSaleByPhone = loadLS('ome_don_sale_by_phone') || {}; // { phone: [ten sale,...] } lay tu "dữ liệu đơn", gop vao csSet de phan quyen CS
let donLastDateByPhone = loadLS('ome_don_last_date') || {}; // { phone: 'yyyy-mm-dd' } ngay mua gan nhat tu Pos (cot "Ngày mua gần nhất")
let donStatsByPhone = loadLS('ome_don_stats') || {};
let _posStatsOn = Object.keys(donStatsByPhone).length > 0;   // true = da co thong ke Pos -> DOANH THU/TONG DON CHI TINH THEO POS (KH khong co don Pos = 0); false (GAS cu chua deploy) -> tam dung Base   // { phone: {n, rev} } tong don + doanh thu POS (bo hoan) -- KH co don Pos thi tinh tong theo Pos, bo qua Base
let donOrderCountByPhone = loadLS('ome_don_order_count') || {}; // { phone: so don } lay tu "dữ liệu đơn" — dung de phan loai hang KH (VIP/Than thiet/...)
let schedules = loadLS('ome_sched') || [];
let currentPhone = null;
let currentTier = 'all', currentCare = 'all', currentZalo = 'all', currentBrand = 'all', currentCS = 'all';
let schedOffset = 0;
let currentDpTab = 'care';
// ── NHÚNG SẴN GS URL Ở ĐÂY — admin điền 1 lần, nhân viên không cần làm gì ──
// Backend CRM web đi qua Cloudflare Worker (cache các action đọc, chuyển tiếp mọi thứ còn lại tới Apps Script; xem cloudflare/README-vi.md).
// LÙI LẠI khi Worker lỗi/quá hạn mức: đổi dòng dưới về URL Apps Script cũ ngay phía dưới (GAS_URL_DIRECT) rồi push.
const GAS_URL_DIRECT = 'https://script.google.com/macros/s/AKfycbx3QT6YIzQ7SQEwQPkljVeEdmTSBQQSxtTp2hTFYOeCKB_K4BHcUTSLi54LlmB9q_E6sQ/exec';
// TAM LUI 2026-10-10: Worker tra loi 520 (CRM khong tai duoc du lieu) -> goi thang Apps Script. Bat lai Worker: dat FIXED_GS_URL = WORKER_URL sau khi kiem tra Cloudflare (Metrics / han muc 100.000 request/ngay).
const WORKER_URL = 'https://royal-brook-6cec.duyenhoang91-tl.workers.dev'; // Worker cache (cloudflare/worker.mjs)
// Mac dinh goi THANG Apps Script. Thu Worker tren 1 may (khong anh huong may khac): mo CRM voi ?worker=1 (nho trong may do); ?worker=0 de tat.
let FIXED_GS_URL = WORKER_URL; // BAT LAI Worker mac dinh (2026-10-10) de kiem tra lai sau khi Cloudflare da them bien GAS_URL; ?worker=0 -> goi thang Apps Script tren may do
try {
  const _wp = new URLSearchParams(location.search).get('worker');
  if (_wp === '0') localStorage.setItem('ome_use_worker', '0');
  else if (_wp === '1') localStorage.removeItem('ome_use_worker');
  if (localStorage.getItem('ome_use_worker') === '0') FIXED_GS_URL = GAS_URL_DIRECT;
} catch (e) { /* localStorage bi chan -> giu goi thang */ }
let gsUrl = FIXED_GS_URL || loadLS('ome_gs_url') || '';
// ── Moi request toi GAS (buoc 3b bao mat, 2026-10-11): kem src=web + token phien (neu da dang nhap) de GAS ghi log "request khong token"
// (xem docs/SECURITY-PLAN.md). Chua chan gi: GAS van chay nhu cu neu thieu token.
// ── Tai khoan TEST: moi request kem demoToken (server chi cho xem bao cao, cat 5 dong, chan ghi).
// Khong gan demoToken cho action=users (man hinh dang nhap can doc danh sach tai khoan truoc khi co token).
(function(){
  var _origFetch = window.fetch.bind(window);
  // Chen khoa vao dau JSON bang noi chuoi (khong JSON.parse/stringify lai: body co the vai MB, vd replaceOrders). Hop le vi body luon bat dau bang "{".
  function _injectBody(body, extra) {
    if (typeof body !== 'string' || body.charAt(0) !== '{') return body;
    var rest = body.slice(1);
    return '{' + extra + (/^\s*\}/.test(rest) ? '' : ',') + rest;
  }
  window.fetch = function(u, o){
    try {
      if (typeof u === 'string' && gsUrl && u.indexOf(gsUrl) === 0) {
        var tok = localStorage.getItem('ome_demo_token');
        var st = localStorage.getItem('ome_sess_token');
        if (o && o.method && String(o.method).toUpperCase() === 'POST') {
          if (tok) {
            try { var b = JSON.parse(o.body); b.demo = tok; o = Object.assign({}, o, { body: JSON.stringify(b) }); } catch(e1){}
          }
          var ex = '"src":"web"' + (st ? ',"token":' + JSON.stringify(st) : '');
          o = Object.assign({}, o, { body: _injectBody(o.body, ex) });   // khoa da co trong body (vd saveUsers.token) se thang vi nam sau
        } else {
          var add = [];
          if (tok && u.indexOf('action=users') === -1) add.push('demo=' + encodeURIComponent(tok));
          if (!/[?&]src=/.test(u)) add.push('src=web');
          if (st && !/[?&]token=/.test(u)) add.push('token=' + encodeURIComponent(st));
          if (add.length) u += (u.indexOf('?') > -1 ? '&' : '?') + add.join('&');
        }
      }
    } catch(e0){}
    return _origFetch(u, o);
  };
})();
// ── Tắt thông báo (toast) liên quan đồng bộ Google Sheets ──
// Đặt = true nếu muốn bật lại các thông báo "đang đồng bộ / đã đồng bộ".
let SHOW_SYNC_TOASTS = false;
// ── Phạm vi theo CS đang chọn ở "Lọc theo CS" ──
let _csFilterMode = 'both';   // 'both' | 'seller' (CS phụ trách) | 'care' (CS chăm sóc)
// Column filters
let colFilters = { name: new Set(), tier: new Set(), hang: new Set(), care: new Set(), zalo: new Set(), product: new Set(), cs: new Set(), careCS: new Set(), source: new Set(), sched: new Set(), lastact: new Set(), tacdong: new Set(), bcstatus: new Set(), lastpos: new Set() };
let _colDdActive = null;

// Advanced filters state
let advFilters = {
  cs: new Set(), products: new Set(), sources: new Set(),
  careStatus: new Set(), zaloStatus: new Set(),
  // Trường tự tạo: { '<id trường>': Set(giá trị đã chọn) } — khách khớp nếu giá trị nằm trong Set
  custom: {},
  yearFrom: '', monthFrom: '', yearTo: '', monthTo: ''
};

// Ẩn/hiện HẲN sidebar bộ lọc KH bên trái (khác toggleSidebar ở trên — cái đó chỉ dành cho
// off-canvas mobile). Dùng ở màn "Báo cáo doanh số" để nhường chỗ cho biểu đồ khi cần chụp màn
// hình gửi báo cáo — bấm lại để hiện lại bình thường.
var _srSidebarHidden = false;
let _lastCareText = null, _lastOrdersText = null, _lastDonText = null, _lastCkText = null, _lastCareLeadsText = null;
let _cskhPulledAt = 0, _assignPulledAt = 0;
// DELTA SYNC CareData: nhip 3s chi xin cac dong co updated > _careSince (server doc 1 cot thay vi ca sheet); keo FULL moi 5 phut
// (bat dong bo dong bi xoa/sua tay tren Sheet khong co 'updated') va khi bam Sync thu cong / lan dau. Server cu khong biet 'since'
// se tra FULL -> client tu nhan ra (khong co d.delta) va xu ly nhu truoc.
let _careSince = '', _careFullAt = 0, _careMaxUpd = '', _careLSTimer = null;
const CARE_FULL_EVERY_MS = 300000;
// Kéo nguồn CSKH-Duyên (bản nhẹ [phone,name]) — tách riêng để dùng được cả ở nhịp kéo đơn lẫn nhịp thường.
// Trả true nếu danh sách vừa được thay mới (cần dựng lại danh sách KH). Lỗi thì GIỮ NGUYÊN dữ liệu cũ và
// báo rõ trên banner (trước đây chỉ console.warn nên CRM âm thầm chỉ còn vài nghìn khách từ DT TỔNG).
let _cskhLastTry = 0, _cskhFailCount = 0, _cskhBannerOn = false;
// ── CACHE BỀN (IndexedDB) CHO DỮ LIỆU LỚN: nguồn CSKH-Duyên (~134k SĐT) + đơn hàng DT TỔNG ───────────────────────
// NGUYÊN NHÂN GỐC lỗi "CRM chỉ hiện vài nghìn / vài chục khách dù data đã ~134k": 2 nguồn này KHÔNG được lưu ở máy
// (CSKH-Duyên vượt hạn mức localStorage ~5MB; đơn hàng chỉ nằm trong bộ nhớ trang) → mỗi lần mở/F5 trang, CRM chỉ có khách từ
// "Chăm sóc" (vài chục) cho tới khi GAS trả được action=orders / cskhDuyenLite. Khi GAS trả HTML lỗi (404 / quá tải / hết
// thời gian — thỉnh thoảng xảy ra lúc nhiều CS cùng mở) thì danh sách kẹt ở số rất nhỏ cho tới lần thử lại thành công.
// Nay lưu bản kéo gần nhất vào IndexedDB (không giới hạn 5MB): mở trang là có đủ khách ngay, GAS lỗi vẫn giữ nguyên danh
// sách đầy đủ (có thể cũ vài phút) thay vì tụt về vài chục khách; bản mới từ GAS luôn ghi đè khi kéo được.
let _cskhIdbTried = false, _cskhFromCache = false, _ordersLoadedNet = false, _ordersCacheUsed = false;
let _idbConn_ = null;   // dùng chung 1 kết nối cho cả phiên (không mở lại ở mỗi lần đọc/ghi)
let _autoSyncFailCount = 0;
let _filterDebounceTimer = null;
// ═══════════════════════════════════════════════════════
//  VIRTUAL TABLE — chỉ render ~50-100 dòng đang nhìn thấy.
//  Xử lý mượt 39.000+ KH vì DOM luôn nhỏ bất kể cuộn sâu.
// ═══════════════════════════════════════════════════════
const VT_ROW_H = 58;       // chiều cao 1 dòng (px) — phải khớp CSS
const VT_BUFFER = 12;      // số dòng đệm trên/dưới khung nhìn
let _vt = { list: [], raf: null, bound: false, lastStart: -1, lastEnd: -1 };

let _schedOpenDay = null; // ngày đang mở trong accordion

// ═══════════════════════════════════════════════════════
//  DETAIL PANEL
// ═══════════════════════════════════════════════════════
// ── Tự làm mới panel chi tiết KH khi có dữ liệu mới từ nguồn khác (vd: Zalo AI extension) ──
let _dpDirty = false; // true nếu người dùng đang gõ dở trong panel (tránh ghi đè mất dữ liệu chưa lưu)
(function _initDpDirtyWatcher(){
  const dpBody = document.getElementById('dp-body');
  if (dpBody) {
    dpBody.addEventListener('input', () => { _dpDirty = true; });
    dpBody.addEventListener('change', () => { _dpDirty = true; });
  }
})();
// ---- Lich su dat hang: KH da co don POS -> chi hien don Pos, bo qua don Base (yeu cau Duyen 2026-10-06) ----
// Pos la chuan (don len Base da co tren Pos). Don Pos lay LUOI theo SDT qua action=donOrdersByPhone khi CS mo tab Lich su.
var _posOrdersCache = {};    // phone -> mang don Pos
var _posOrdersState = {};    // phone -> 'loading' | 'done' | 'fail'
// Khối "CSKH-Duyên" ở tab Tổng quan: thông tin khách từ sheet thứ 3 (mỗi dòng 1 khối nếu trùng SĐT).
// Chỉ hiện trường CÓ giá trị. (Không có CCCD/MST cá nhân — backend không đọc cột đó.)
// ---- Chi tiet CSKH-Duyen tai LUOI (lazy) -- chi tai khi CS mo ho so 1 khach co trong sheet CSKH-Duyen ----
// syncFromGS chi keo ban 'lite' {name,tier} (action=cskhDuyenLite) de CRM khong lag voi ~134k dong. Day du 17 truong (dia chi,
// cong ty, email, ghi chu...) chi lay cho DUNG 1 SDT qua action=lookup (backend findCskhRowsByPhone_ doc index nhe + vai dong).
var _cskhDetailCache = {};   // phone -> MANG dong day du
var _cskhDetailState = {};   // phone -> 'loading' | 'done' | 'fail'  (moi SDT chi tai 1 lan/phien, tranh vong lap khi loi)
document.addEventListener('click', function(e){
  var combo = (e.target && e.target.closest) ? e.target.closest('.cs-assign-combo') : null;
  if (!combo) csAssignClose();
});

let _nickZaloList = _loadNickZaloList();
_syncNickZaloListFromGAS().then(function(list){ _nickZaloList = list || []; });

// ═══════════════════════════════════════════════════════
//  SDT ZALO — SDT khach dang dung de ket ban Zalo (2026-09, thay the "Nick Zalo" rieng cua
//  Pancake, vi khach tren Pancake ket ban Zalo bang nhieu SDT/tai khoan khac nhau, khong co
//  dinh 1 Page nen theo doi theo "nick" khong con dung). Moi khach co 1 MANG cac SDT (co the
//  doi/them theo thoi gian), CS tu go SDT moi hoac chon nhanh SDT chinh cua khach.
//  Cot luu: zaloPhones trong CareData — KHAC HOAN TOAN nickZalos (van giu nguyen rieng cho
//  Zalo AI dinh tuyen gui hang loat theo tai khoan doi ngu, khong dong vao o day).
//  Admin dieu khien qua 2 setting chung (giong nickZaloList): zaloPhoneFieldLocked (khoa han
//  ca truong) va zaloPhoneSaleCanAdd (Sale co duoc tu them SDT khong, mac dinh CO).
// ═══════════════════════════════════════════════════════
let _zaloPhoneFieldLocked = false;
let _zaloPhoneSaleCanAdd = true; // mac dinh: Sale duoc phep them (dung yeu cau ban dau)
_syncZaloPhoneSettingsFromGAS();

// ── Auto lịch chăm sóc (+7/+14/+1t/+2t từ ngày đặt) ──
//   • landipage/messenger/capture/web: áp dụng từ tháng 5/2026 trở đi
//   • data đảo renew: chỉ giữ auto cho đơn tháng 6/2026 (đã bỏ quy tắc theo tháng hiện tại)
var DATA_DAO_SOURCES = ['data đảo renew','data dao renew'];

// Nguồn khách mới cần auto lịch CS (+7/+14/+1t/+2t) — áp dụng từ tháng 5/2026 trở đi
var NEW_LEAD_SOURCES = ['landipage','landing','messenger','capture','web'];
// ── Đưa mốc auto GẦN NHẤT sắp tới của mỗi khách vào ô Hẹn (schedHen) ──
//   → để extension Zalo AI (chỉ đọc schedHen) nhìn thấy lịch auto.
//   KHÔNG đè lịch "Hẹn mua" khách tự đặt tay: chỉ ghi khi ô trống hoặc
//   do chính auto ghi trước đó (nhận diện qua tiền tố AUTO_HEN_TAG).
var AUTO_HEN_TAG = '⟳ auto';
// Bộ lọc theo TRƯỜNG TỰ TẠO ở sidebar (thay cho khối "Thương hiệu" cũ).
// GIỮ NGUYÊN TÊN HÀM updateBrandList để mọi chỗ đang gọi sẵn (setCSFilterMode, onCSFilterChange,
// đăng nhập, sync...) vẫn hoạt động, không phải sửa rải rác.
let currentCF = {};   // { '<id trường>': 'giá trị đang lọc' } — không có khoá = không lọc trường đó
// ── Ô "Lọc theo CS" có tìm kiếm (gõ tên) — MULTI-SELECT: click 1 tên = TICK/BỎ TICK, dropdown
//    KHÔNG đóng lại để chọn tiếp tên khác (giống hệt combo chọn nhiều Sale ở Báo cáo doanh số).
let csComboData = [{value:'all', label:'— Tất cả CS —', count:0}];
let _csComboIdx = -1;
// Đóng danh sách khi bấm ra ngoài
document.addEventListener('click', function(e){
  const combo = document.getElementById('cs-combo');
  if (combo && !combo.contains(e.target)) csComboClose();
});
// ═══════════════════════════════════════════════════════
//  BADGE HELPERS
// ═══════════════════════════════════════════════════════
// ---- PHAN HANG KH theo DOANH THU luy ke (yeu cau Duyen 2026-10-06) ----
// < 15tr: Khach thuong | 15 -> <30tr: Than thiet | 30 -> <50tr: Vip | >= 50tr: Super VVip
// (khac cot 'Phan loai' = theo SO DON Pos). Doanh thu = c.totalRevenue = CHI THEO POS (bo don hoan; KH khong co don Pos = 0) -- xem _custRev_.
// GAS auto-assign (_aaLoadCustomers_) dung CUNG nguong -- doi o day thi doi ca _aaHangKey_ trong gas_v13.js.
var HANG_KEYS = ['thuong','tt','vip','super'];
var HANG_LABEL = { thuong:'Khách thường', tt:'Ưu tiên', vip:'Vip', super:'Super VVip' };
// ═══════════════════════════════════════════════════════
//  NHẮC HẸN — thông báo góc dưới phải màn hình
// ═══════════════════════════════════════════════════════
let _reminderPanelOpen = true;
let _reminderTimer = null;
// parseVNDate_: đọc chuỗi ngày dạng "dd/MM/yyyy" hoặc "dd/MM/yyyy HH:mm" mà backend
// (readAllOrders_/readDTTong_ trong gas_v13.js) trả về cho các trường ngày của đơn hàng.
// KHÔNG dùng new Date(chuỗi) trực tiếp như parseDate() bên dưới — JS sẽ hiểu nhầm chuỗi kiểu
// MM/DD/YYYY, sai âm thầm với các ngày ≤12 (vd "01/07/2026" bị hiểu nhầm thành 7 tháng 1 thay
// vì đúng là 1 tháng 7). Dùng offset VN cố định +7 (không phụ thuộc múi giờ trình duyệt của
// từng người dùng), khớp đúng cách backend đã tính ở _vnMidnight_/parseVNDate_ (gas_v13.js).
// (Fix 20/09/2026: hàm này trước đây bị GỌI Ở FRONTEND nhưng CHƯA TỪNG ĐƯỢC ĐỊNH NGHĨA ở đây —
// chỉ tồn tại bên backend — khiến mọi lần tải đơn hàng báo lỗi "parseVNDate_ is not defined"
// và toàn bộ danh sách KH/đơn bị rớt xuống chỉ còn vài KH tự thêm tay.)
var VN_OFFSET_MS_ = 7 * 3600 * 1000;
// ── Đoán tên khách từ nội dung cột "Sản phẩm" (DT TỔNG) — NV gõ tay tự do, không theo
// khuôn cố định: có đơn ghi "Tên Sđt Địa chỉ...", có đơn ghi "Địa chỉ Sđt ... Tên Nhắn...",
// có đơn chỉ toàn địa chỉ/ghi chú gộp đơn không hề có tên. Dùng CHỈ để HIỂN THỊ tự động
// trong danh sách khi khách chưa có tên thật ở đâu cả — KHÔNG ghi lại vào CareData/DT TỔNG
// (tránh đoán sai làm hỏng dữ liệu gốc). Giống hệt logic phía backend (gas_v13.js) để khớp
// kết quả nếu sau này có đối chiếu.
var NAME_ADDR_KEYWORDS_RE = /\b(đường|phố|phường|xã|quận|huyện|thành phố|tỉnh|ngõ|ngách|khu|tổ|ấp|thôn|xóm|số nhà|tòa|chung cư|đc|địa chỉ)\b/i;
var NAME_MERGE_LABEL_RE = /^(gộp\s*(đơn|cùng)|ghép\s*đơn|địa chỉ)/i;
var NAME_ALLOWED_CHARS_RE = /^[a-zA-ZÀ-ỹ\s.'-]+$/;
// ═══════════════════════════════════════════════════════
//  TÍCH ĐIỂM KH: 1% giá trị đơn (1 điểm = 1.000đ). VD đơn 5.900.000đ -> 59 điểm = 59k.
//  Điểm TIÊU lấy từ GHI CHÚ ĐƠN: "Tích điểm: tiêu 50k" -> trừ 50 điểm (50k). Còn lại = đã tích - đã tiêu.
// ═══════════════════════════════════════════════════════
var PTS_RATE = 0.01, PTS_VALUE = 1000;
// Column visibility state
const _colVisDefault = { lastpos:true, name:true, tier:true, hang:true, care:true, zalo:true, order:true, product:true, cs:true, source:false, note:true, sched:true, lastact:true, tacdong:true, carecs:true, bcstatus:true };
const colVisible = Object.assign({}, _colVisDefault, loadLS('ome_col_visible') || {});

// ── Tab chính (Dashboard/Quản lý Team/Nhật ký/Báo cáo doanh số/Báo cáo Pancake/KPI
// Pancake) ẩn/hiện được theo Ý THÍCH TỪNG NGƯỜI, lưu theo TÀI KHOẢN đăng nhập — cùng
// cơ chế với "cột hiển thị" (colVisible/_pullColVisibleForAccount) ở trên, chỉ đổi
// đối tượng áp dụng từ cột bảng sang tab. Mặc định TẤT CẢ đang hiện (giữ hành vi cũ
// cho ai chưa từng đụng vào cài đặt này); tab nào bị Cline thêm mới sau này cũng tự
// hiện luôn (chỉ ẩn khi người dùng CHỦ ĐỘNG bỏ tích).
const _tabVisDefault = { dashboard:true, team:true, audit:true, salesreport:true, pancake:true, kpipancake:true };
const tabVisible = Object.assign({}, _tabVisDefault, loadLS('ome_tab_visible') || {});
// ═══════════════════════════════════════════════════════
//  TUỲ CHỈNH THANH MENU (kéo-thả mục vào/ra "☰ Menu") — thay cho cơ chế tick ẩn/hiện
//  cũ ở trên (chỉ có Bật/Tắt, không có "menu"). Giờ MỌI mục ở cả 2 thanh (header phải +
//  thanh tab) đều kéo được vào 1 nút "☰ Menu" dùng chung — kéo ra thì mục về lại đúng
//  thanh gốc của nó (data-bar-home), không mất chức năng gì cả. Lưu riêng theo từng
//  tài khoản đăng nhập, giống hệt cơ chế tabVisible ở trên.
var _barMenuItems = []; // mảng id (không cần giữ thứ tự) đang nằm TRONG "☰ Menu"
(function _barMenuMigrate(){
  var saved = loadLS('ome_bar_menu_items');
  if (Array.isArray(saved)) { _barMenuItems = saved; return; }
  // Chưa từng dùng tính năng mới → chuyển tiếp 1 lần từ tabVisible cũ: tab nào đang
  // TẮT thì coi như đang nằm trong menu, để không mất cấu hình cũ của người dùng.
  var legacy = loadLS('ome_tab_visible') || {};
  _barMenuItems = Object.keys(legacy).filter(function(k){ return legacy[k] === false; });
  saveLS('ome_bar_menu_items', _barMenuItems);
})();

// ═══════════════════════════════════════════════════════
//  PHÂN QUYỀN XEM MENU (Admin gán qua modal "🔑 Tài khoản") — khác với "☰ Menu" ở trên
//  (đó là NGƯỜI DÙNG tự sắp xếp thẩm mỹ cho mình). Đây là ADMIN khoá cứng: nhân viên
//  KHÔNG tự bật lại được các mục bị giới hạn, kể cả qua thao tác client.
// ═══════════════════════════════════════════════════════
var _PERM_TAB_DEFS = [
  { id:'tab-kh',       label:'Danh sách KH' },
  { id:'tab-schedule', label:'Lịch chăm sóc' },
  { id:'tab-overdue',  label:'Quá hạn' },
  { id:'tab-mydata',   label:'Data của tôi' },
  { id:'tab-zaloai',   label:'Zalo AI' },
  { id:'tab-task',     label:'Công việc' },
  { id:'dashboard',    label:'Dashboard' },
  { id:'team',         label:'Quản lý Team' },
  { id:'audit',        label:'Nhật ký' },
  { id:'salesreport',  label:'Báo cáo doanh số' },
  { id:'pancake',      label:'Báo cáo Pancake' },
  { id:'kpipancake',   label:'KPI Pancake' },
  { id:'mktchecklist', label:'Checklist MKT' },
  { id:'dailybrief',   label:'Báo cáo ngày' },
  { id:'uploaddata',   label:'Up dữ liệu' }
];
var _BAR_ITEM_DEFS = [
  { id:'tab-kh',          label:'Danh sách KH' },
  { id:'tab-schedule',    label:'Lịch chăm sóc' },
  { id:'reportsgroup',    label:'📊 Báo cáo (gộp Doanh số/Pancake/KPI/Checklist)' },
  { id:'tab-overdue',     label:'Quá hạn' },
  { id:'tab-mydata',      label:'Data của tôi' },
  { id:'tab-zaloai',      label:'Zalo AI' },
  { id:'tab-task',        label:'Công việc' },
  { id:'dashboard',       label:'Dashboard' },
  { id:'team',            label:'Quản lý Team' },
  { id:'audit',           label:'Nhật ký' },
  { id:'salesreport',     label:'Báo cáo doanh số' },
  { id:'pancake',         label:'Báo cáo Pancake' },
  { id:'kpipancake',      label:'KPI Pancake' },
  { id:'mktchecklist',    label:'Checklist MKT' },
  { id:'dailybrief',      label:'Báo cáo ngày' },
  { id:'uploaddata',      label:'Up dữ liệu' },
  { id:'hdr-hoitham',     label:'Mẫu hỏi thăm' },
  { id:'hdr-tacvu',       label:'Tác vụ' },
  { id:'hdr-carestatus',  label:'Tình trạng CS' },
  { id:'hdr-khstatus',    label:'Trạng thái KH' },
  { id:'hdr-customfield', label:'Trường tự tạo' },
  { id:'hdr-account',     label:'Tài khoản' },
  { id:'hdr-logout',      label:'Đăng xuất' }
];

var _barDragId = null;
let _lastActSortDir = 0; // 0=off, 1=asc(oldest first), -1=desc(newest first)
let _lastPosSortDir = 0; // 0=off, 1=asc(mua lâu nhất trước), -1=desc(mua gần nhất trước)
document.addEventListener('click', e=>{
  if (!e.target.closest('.col-dropdown') && !e.target.closest('th.filterable')) {
    document.querySelectorAll('.col-dropdown').forEach(d=>d.classList.remove('open'));
    _colDdActive = null;
  }
});

document.addEventListener('click', function(e){
  var w = document.getElementById('tacvu-wrap');
  if (w && !w.contains(e.target)) closeTacVuMenu();
});
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeTacVuMenu(); });

// Danh sách gốc (chưa lọc theo search) của nhóm chip CS, dùng để filterAdvChipList tìm lại
const _advChipCache = { cs: [] };
let _advAssignReopenAfterFilter = false; // true = Loc nang cao dang duoc mo tu ben trong modal Chia data

// ── INIT ──
if (gsUrl) {
  updateGsPill(true);
  show('syncbtn');
  // Sync ngay khi mở app (kéo cả đơn hàng + CS)
  syncFromGS({ pullOrders: true }).catch(() => {});
  // Kéo riêng chiến dịch (không phụ thuộc order lớn) — đảm bảo không mất khi mở lại
  if (typeof pullAssignHistory === 'function') pullAssignHistory().catch(() => {});
  if (typeof pullBroadcastHistory === 'function') pullBroadcastHistory().catch(() => {});
}

// ── AUTO SYNC MỖI 5 GIÂY (chỉ khi tab visible, không spam khi lỗi) ──
// Tăng 3s -> 5s theo yêu cầu: mỗi tick/tab gọi GAS 2 request (customers + careLeads); giảm ~40% tải khi nhiều CS cùng mở.
const AUTO_SYNC_MS = 5000;
const ORDERS_PULL_EVERY_TICKS = 9;   // 9 tick x 5s = 45s kéo lại đơn hàng đầy đủ (khớp TTL cache action=orders ở GAS)
let _autoSyncTimer = null;
let _autoSyncRunning = false;
let _autoSyncTick = 0;

window.addEventListener('load', () => {
  if (gsUrl) {
    _autoSyncTimer = setTimeout(autoSyncLoop, AUTO_SYNC_MS);
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && gsUrl && !_autoSyncTimer) {
    _autoSyncTimer = setTimeout(autoSyncLoop, 500);
  }
});

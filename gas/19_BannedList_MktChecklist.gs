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


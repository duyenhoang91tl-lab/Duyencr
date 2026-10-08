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
// Ke hoach ca ngay = CSKH (rieng) + POS (tu dt/don/cs). opts: {pos:bool, cskh:bool} (mac dinh ca hai). CSKH lap truoc de han muc CSKH khong bi POS lay mat KH.
function _aaPlanAll(cfg, teamsArr, membersOf, custs, everSet, opts){
  custs = (custs || []).filter(function (c) { return c && isValidVnPhone_(c.phone); });   // chi chia SDT di dong VN hop le
  opts = opts || {}; var taken = new Set(), out = { entries:[], short:[], warn:[] };
  if (opts.cskh !== false){
    var k = _aaPlanCskh(cfg, teamsArr, membersOf, custs, everSet, taken);
    out.entries = out.entries.concat(k.entries); out.short = out.short.concat(k.short); out.warn = out.warn.concat(k.warn);
  }
  if (opts.pos !== false){
    var p = _aaPlan(cfg, teamsArr, membersOf, custs, everSet, taken);
    p.entries.forEach(function(e){ e.src = 'pos'; }); p.short.forEach(function(x){ x.src = 'pos'; });
    out.entries = out.entries.concat(p.entries); out.short = out.short.concat(p.short); out.warn = out.warn.concat(p.warn);
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
  readAllOrders_().forEach(function (o) { mark(o.phone, 'dt'); if (o.phone) revBy[o.phone] = (revBy[o.phone] || 0) + (Number(o.revenue) || 0); });
  readCareLeads_().forEach(function (r) { mark(r.phone, 'cs'); if (r.name) leadName[r.phone] = true; });
  readCskhDuyenLite_().rows.forEach(function (r) { mark(r[0], 'cskh'); });
  readDonPhones_().forEach(function (p) { mark(p, 'don'); });
  var cnt = getDonOrderCountByPhone_(), custs = [];
  Object.keys(src).forEach(function (p) {
    var d = src[p];
    if (!(d.dt || d.don || d.cskh || (d.cs && leadName[p]))) return;
    var n = cnt[p] || 0;
    custs.push({ phone: p, dataSrc: { dt: !!d.dt, don: !!d.don, cs: !!d.cs, cskh: !!d.cskh }, tier: n >= 10 ? 'VIP' : n >= 5 ? 'Thân thiết' : n >= 2 ? 'Tiềm năng' : 'Chưa bán lại được', hangKey: _aaHangKey_(posOn ? (posStats[p] ? posStats[p].rev : 0) : (revBy[p] || 0)) });
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


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


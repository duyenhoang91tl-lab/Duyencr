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


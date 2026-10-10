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


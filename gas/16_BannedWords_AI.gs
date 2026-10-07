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


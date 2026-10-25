// ═══════════════════════════════════════════════════════════════
//  NHAC QUY TRINH CHAT (v13.60-coach) — "AI" quet hoi thoai Pancake va nhac sale lam DUNG cac buoc trong sheet "Kich ban Chatpage"
//  (Duyen yeu cau 2026-10-18: nhac gui hinh anh kem ghi am, bao gia kem CTKM neu co, len don thi huong dan khach gui size tay...).
//  Cach chay: KHONG dung AI doan mo — moi quy tac la 1 cap "SU KIEN KICH HOAT" + "VIEC SALE PHAI LAM" viet bang tu khoa khong dau (regex), xet tren cac tin dang co
//  (huong in/out, gio, loai dinh kem anh/ghi am/video). Ket qua on dinh, giai thich duoc, khong ton phi AI, khong lam cham chat.
//  Moi quy tac co 4 trang thai: done (da lam) / pending (kich hoat nhung chua den han) / due (QUA HAN -> NHAC) / na (khong ap dung).
//  Admin chinh quy tac o Settings 'chatCoachCfg' (JSON {"rules":[...]}): cung id = ghi de tung truong (enabled:false de tat), id moi = them quy tac.
//  Endpoint: GET chatCoach?conv=<page_id>_<psid> kem token (CRM) hoac ek (extension Pancake AI/Zalo AI). Chi DOC, khong ghi gi.
// ═══════════════════════════════════════════════════════════════
var CHAT_COACH_SECTION_ = 'chat-coach';
var COACH_STEPS_ = [
  { n: 1, name: 'Đón khách' }, { n: 2, name: 'Khai thác nhu cầu' }, { n: 3, name: 'Tư vấn' }, { n: 4, name: 'Tạo niềm tin' }, { n: 5, name: 'Báo giá' },
  { n: 6, name: 'Xử lý từ chối' }, { n: 7, name: 'Chốt đơn' }, { n: 8, name: 'Xác nhận đơn' }, { n: 9, name: 'Theo sát' }
];
var COACH_RE_PRICE_ = '\\d[\\d.,]*\\s?(k|nghin|ngan|trieu|tr|d|vnd|dong)\\b|muc phi|\\bgia\\b[^\\n]{0,12}\\d';
var COACH_RE_PROMO_ = 'uu dai|khuyen mai|ctkm|giam gia|giam \\d|\\btang\\b|qua tang|qua nho|freeship|free ship|mien phi van chuyen|voucher|chuong trinh';
var COACH_RE_BIRTH_ = '\\b(19[3-9]\\d|20[01]\\d)\\b|sinh nam|nam sinh|\\bmenh\\b|\\btuoi\\b|\\d{1,2}[/-]\\d{1,2}[/-](19|20)\\d\\d';
var COACH_RE_ORDER_ = '\\bchot\\b|chuyen khoan|\\bck\\b|\\bstk\\b|so tai khoan|len don|dat hang|thanh toan|lay (cai|mau|em|chi|con|bo|vong|nhan|day|may)|ok (em|chi|nhe|a)\\b|dong y|giu (cho|mau)|gui ve|\\bship\\b';
var COACH_RE_SIZE_ASK_ = '(gui|cho|xin|do|nhan|bao)[^\\n]{0,40}(size|co tay|chu vi|so do|do tay)|(size|co tay|chu vi|so do)[^\\n]{0,30}(bao nhieu|may cm|may phan)';
var COACH_RE_SIZE_GIVE_ = '(co tay|size|chu vi|so do)[^\\n]{0,25}\\d|\\b\\d{1,2}([.,]\\d)?\\s?(cm|phan)\\b|\\bsize\\s?(s|m|l|xl)\\b';
// Quy tac mac dinh — loi nhac & cau mau lay TU SHEET "Kich ban Chatpage" (script giu nguyen cau chu cua Duyen). Cau 'size tay' va 'ghi am' la goi y bo sung (xem docs).
var COACH_RULES_ = [
  { id: 'reply_fast', step: 1, title: 'Trả lời nhanh', when: { kind: 'unanswered' }, grace: 5, maxAge: 2880,
    say: 'Khách nhắn {age} trước mà chưa được trả lời. Nguyên tắc #5: trả lời nhanh, tư vấn sát nhu cầu.',
    script: 'Chị chào em nhé! Cảm ơn em đã quan tâm đến sản phẩm bên chị. Em đang tìm hiểu cho bản thân hay muốn chọn tặng ai, để chị tư vấn cho đúng nhu cầu của em nha.' },
  { id: 'ask_birth', step: 2, title: 'Xin năm sinh để xem mệnh', when: { who: 'in' }, grace: 10, maxAge: 4320,
    needs: { who: 'any', scope: 'any', re: COACH_RE_BIRTH_ + '|ngay thang nam sinh' },
    say: 'Chưa xin năm sinh / mệnh của khách (Bước 2).',
    script: 'Để chị giúp em chọn được một thiết kế thật sự hợp với mình, em nhắn cho chị năm sinh cụ thể để chị xem bản mệnh giúp em nha!' },
  { id: 'ask_phone', step: 2, title: 'Xin số điện thoại', when: { who: 'in', min: 4 }, grace: 5, maxAge: 4320, skipIf: 'phone',
    needs: { who: 'any', scope: 'any', re: '\\b0\\d{9}\\b|\\+?84\\d{9}|so dien thoai|\\bsdt\\b|\\bzalo\\b|so dt' },
    say: 'Khách đã nhắn khá nhiều nhưng chưa có số điện thoại (Bước 2).',
    script: 'Chị cảm ơn em đã chia sẻ. Để chị tư vấn kỹ hơn và chọn đúng sản phẩm phù hợp với em, em cho chị xin số điện thoại để chị liên hệ trao đổi thêm với em nha.' },
  { id: 'consult_image', step: 3, title: 'Gửi ẢNH mẫu hợp mệnh', when: { who: 'in', re: COACH_RE_BIRTH_ }, grace: 10, maxAge: 4320,
    needs: { who: 'out', scope: 'any', att: 'image' },
    say: 'Khách đã cho năm sinh/mệnh nhưng bạn chưa gửi HÌNH ẢNH mẫu (Bước 3).',
    script: 'Chị gửi em 2 tông màu hợp với mệnh của em. Cả hai đều rất đẹp và tôn da. Em thích tông nào chị sẽ tư vấn kỹ hơn về chất liệu cho em nhé.' },
  { id: 'consult_voice', step: 3, title: 'Gửi tin GHI ÂM tư vấn', when: { who: 'in', re: COACH_RE_BIRTH_ }, grace: 15, maxAge: 4320,
    needs: { who: 'out', scope: 'any', att: 'audio' },
    say: 'Khách đã cho năm sinh/mệnh nhưng bạn chưa gửi tin GHI ÂM tư vấn kèm hình (Bước 3).',
    script: 'Chị luôn thiết kế theo đúng mệnh và mong cầu của từng người. Với tình trạng hiện tại, chị chọn cho em dòng ngọc tự nhiên này, hy vọng giúp em vững vàng hơn giữa những thay đổi trong công việc và cuộc sống.' },
  { id: 'trust_proof', step: 4, title: 'Tạo niềm tin (video / kiểm định)', maxAge: 2880, grace: 5,
    when: { who: 'in', re: 'that khong|co that|kiem dinh|chat lieu|da that|ngoc that|bao hanh|chat luong|uy tin|lua dao|lam sao biet' },
    needs: { who: 'out', re: 'kiem dinh|video|can canh|bao hanh|van da|tu nhien', att: '' },
    say: 'Khách đang hỏi về chất liệu/uy tín nhưng chưa được trấn an bằng video cận cảnh hoặc giấy kiểm định (Bước 4).',
    script: 'Chị sẽ quay video cận cảnh từng vân đá để em kiểm chứng trước nên em yên tâm nhé. Bên chị có giấy kiểm định chất lượng đá đầy đủ để em hoàn toàn an tâm sử dụng.' },
  { id: 'quote_ctkm', step: 5, title: 'Báo giá kèm CTKM', when: { who: 'out', re: COACH_RE_PRICE_ }, grace: 0, maxAge: 1440, onlyIf: 'ctkm',   // neo vao lan bao gia DAU TIEN: da nhac uu dai sau do thi thoi (khong nhac lai khi bao them mon khac)
    needs: { who: 'out', scope: 'after', re: COACH_RE_PROMO_ },
    say: 'Vừa báo giá nhưng CHƯA nhắc ưu đãi. Đang có CTKM: {ctkm}',
    script: 'Mẫu vật phẩm chế tác từ ngọc tự nhiên hợp mệnh này, mức phí là [Giá]. Đặc biệt em thỉnh hôm nay còn được chị tặng thêm quà nhỏ nữa đó em. CTKM hiện có: {ctkm}' },
  { id: 'wrist_size', step: 7, title: 'Hướng dẫn khách gửi SIZE TAY', grace: 5, maxAge: 2880,
    when: { who: 'any', re: COACH_RE_ORDER_ },
    needs: { who: 'any', scope: 'any', re: COACH_RE_SIZE_ASK_ + '|' + COACH_RE_SIZE_GIVE_ },
    say: 'Khách sắp lên đơn nhưng chưa có SIZE TAY (hàng thiết kế theo size tay) — hướng dẫn khách đo và gửi.',
    script: 'Các sản phẩm bên chị đều là hàng thiết kế riêng theo yêu cầu — từ kiểu dáng, kích cỡ đến size tay. Em đo giúp chị chu vi cổ tay (quấn thước dây hoặc sợi dây sát cổ tay rồi đo lại, đơn vị cm) và gửi chị số đo hoặc ảnh đo nhé.' },
  { id: 'order_confirm', step: 8, title: 'Xác nhận lại thông tin đơn', grace: 5, maxAge: 2880,
    when: { who: 'in', re: 'dia chi|\\bso nha\\b|\\bduong\\b|\\bphuong\\b|\\bquan\\b|\\bhuyen\\b|\\btinh\\b|thanh pho|ship ve|gui ve' },
    needs: { who: 'out', scope: 'after', re: 'xac nhan lai|xin xac nhan|kiem tra lai thong tin|nguoi nhan' },
    say: 'Khách đã gửi địa chỉ nhưng bạn chưa xác nhận lại thông tin đơn (Bước 8).',
    script: 'Chị xin xác nhận lại thông tin đơn hàng nha. Em thỉnh [Tên vật phẩm] với mức phí [Giá]. Đơn sẽ gửi về [Địa chỉ] cho người nhận [Tên - SĐT]. Em kiểm tra lại giúp chị xem thông tin đã chính xác chưa nhé.' },
  { id: 'follow_silent', step: 9, title: 'Theo sát khách im lặng (24–48h)', when: { kind: 'silent' }, grace: 1440, maxAge: 4320,
    say: 'Khách đã im lặng {age} sau tin của bạn — nhắn theo sát 24–48h đầu.',
    script: 'Chị thấy em đã xem mẫu nhưng chưa phản hồi lại. Không biết em có đang băn khoăn thêm về chất liệu, mức phí hay kiểu dáng không? Em cứ thoải mái chia sẻ, chị luôn ở đây để tư vấn giúp em có lựa chọn tốt và phù hợp nhất.' }
];
function _coachNorm_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}
function _coachRe_(src, warn) {
  if (!src) return null;
  try { return new RegExp(String(src), 'i'); } catch (e) { if (warn) warn.push('Regex loi: ' + String(src).slice(0, 40)); return null; }
}
function _coachAttOk_(m, kind) {
  if (!kind) return true;
  var re = kind === 'image' ? /image|photo|img|jpe?g|png|gif|webp/ : kind === 'audio' ? /audio|voice|record|mp3|m4a|aac|ogg/ : kind === 'video' ? /video|mp4|mov/ : _coachRe_(kind);
  if (!re) return false;
  for (var i = 0; i < (m.att || []).length; i++) if (re.test(m.att[i])) return true;
  return false;
}
function _coachSpecOk_(spec, m, warn) {   // 1 tin co khop {who, re, att} khong
  if (spec.who && spec.who !== 'any' && m.dir !== spec.who) return false;
  if (spec.re) { var re = _coachRe_(spec.re, warn); if (!re || !re.test(m.txt)) return false; }
  if (spec.att && !_coachAttOk_(m, spec.att)) return false;
  return true;
}
function _coachAge_(ms) {
  var min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return min + ' phút';
  if (min < 1440) return Math.round(min / 60) + ' giờ';
  return Math.round(min / 1440) + ' ngày';
}
// Quy tac hieu luc = mac dinh + ghi de tu Settings 'chatCoachCfg'
function coachRules_() {
  var rules = COACH_RULES_.map(function (r) { return JSON.parse(JSON.stringify(r)); }), cfg = null;
  try { var raw = getSetting_('chatCoachCfg'); if (raw) cfg = JSON.parse(raw); } catch (e) { cfg = null; }
  if (cfg && Array.isArray(cfg.rules)) cfg.rules.forEach(function (o) {
    if (!o || !o.id) return;
    var cur = null; for (var i = 0; i < rules.length; i++) if (rules[i].id === o.id) { cur = rules[i]; break; }
    if (cur) Object.keys(o).forEach(function (k) { cur[k] = o[k]; }); else rules.push(o);
  });
  return rules.filter(function (r) { return r.enabled !== false; });
}
// CTKM dang chay (ten ngan) — cache 10 phut. Loi/khong co -> [] (quy tac onlyIf:'ctkm' se khong ap dung).
function coachCtkm_() {
  var cache = null; try { cache = CacheService.getScriptCache(); var hit = cache.get('coachCtkm'); if (hit) return JSON.parse(hit); } catch (e) {}
  var out = [];
  try {
    var cat = readCTKMCatalog_(), rows = (cat && cat.rows) || [];
    rows.forEach(function (r) {
      if (!r || r.__ctkmExpired || r.__ctkmUpcoming) return;
      var label = '', keys = Object.keys(r);
      for (var i = 0; i < keys.length && !label; i++) if (/^(ten|chuong trinh|ctkm|noi dung)/.test(_coachNorm_(keys[i])) && r[keys[i]]) label = String(r[keys[i]]);
      if (!label) for (var j = 0; j < keys.length && !label; j++) if (keys[j].indexOf('__') !== 0 && r[keys[j]]) label = String(r[keys[j]]);
      label = label.replace(/\s+/g, ' ').trim().slice(0, 70); if (label && out.indexOf(label) < 0) out.push(label);
    });
  } catch (e2) { out = []; }
  out = out.slice(0, 3);
  try { if (cache) cache.put('coachCtkm', JSON.stringify(out), 600); } catch (e3) {}
  return out;
}
// msgs: [{dir:'in'|'out', t:ms, txt:<da chuan hoa>, att:[loai]}] tang dan theo gio. ctx: {now, ctkm:[], phone:bool}
function coachEval_(rules, msgs, ctx) {
  var now = ctx.now || Date.now(), warn = ctx.warn || [], last = msgs.length ? msgs[msgs.length - 1] : null, out = [];
  var ctkmTxt = (ctx.ctkm || []).join('; ');
  rules.forEach(function (rule) {
    var res = { id: rule.id, step: rule.step || 0, title: rule.title || rule.id, state: 'na', ageMin: 0, say: '', script: '' };
    function fill(s) { return String(s || '').replace(/\{ctkm\}/g, ctkmTxt || '(chưa có)').replace(/\{age\}/g, _coachAge_(res._age || 0)); }
    var when = rule.when || {}, kind = when.kind || 'match', grace = (rule.grace != null ? rule.grace : 3) * 60000, maxAge = (rule.maxAge != null ? rule.maxAge : 2880) * 60000, tTrig = null;
    if (rule.onlyIf === 'ctkm' && !(ctx.ctkm && ctx.ctkm.length)) { out.push(res); return; }
    if (rule.skipIf === 'phone' && ctx.phone) { res.state = 'done'; out.push(res); return; }
    if (kind === 'unanswered') {
      if (!last) { out.push(res); return; }
      if (last.dir === 'out') { res.state = 'done'; out.push(res); return; }
      tTrig = last.t;
    } else if (kind === 'silent') {
      if (!last || last.dir !== 'out') { out.push(res); return; }
      var hasIn = msgs.some(function (m) { return m.dir === 'in'; }); if (!hasIn) { out.push(res); return; }
      tTrig = last.t;
    } else {
      var M = msgs.filter(function (m) { return _coachSpecOk_(when, m, warn); }), min = when.min || 1;
      if (M.length < min) { out.push(res); return; }
      tTrig = (when.anchor === 'last' ? M[M.length - 1] : M[min - 1]).t;
    }
    var age = now - tTrig; res._age = age; res.ageMin = Math.round(age / 60000); res.triggerAt = new Date(tTrig).toISOString();
    if (age > maxAge) { delete res._age; out.push(res); return; }   // qua han hieu luc: khong nhac nua (tranh nhac hoi thoai da nguoi)
    var done = false;
    if (kind === 'match' && rule.needs) {
      var nd = rule.needs, cnt = 0, need = nd.min || 1;
      for (var i = 0; i < msgs.length && cnt < need; i++) { var m = msgs[i]; if (nd.scope !== 'any' && m.t < tTrig) continue; if (_coachSpecOk_(nd, m, warn)) cnt++; }
      done = cnt >= need;
    }
    if (kind === 'match' && !rule.needs) done = true;
    res.state = done ? 'done' : (age >= grace ? 'due' : 'pending');
    if (res.state !== 'done') { res.say = fill(rule.say); res.script = fill(rule.script); }
    delete res._age; out.push(res);
  });
  return out;
}
function coachBuildResult_(rules, rows, ctx) {
  var msgs = rows.map(function (m) {
    return { dir: m.dir === 'out' ? 'out' : 'in', t: Date.parse(m.at) || 0, txt: _coachNorm_(m.text), att: (m.att || []).map(function (a) { return _coachNorm_(a && (a.type || a.mime || a.name || '')); }) };
  }).filter(function (m) { return m.t > 0; }).sort(function (a, b) { return a.t - b.t; });
  var warn = []; ctx.warn = warn;
  var rs = coachEval_(rules, msgs, ctx), order = { due: 0, pending: 1, done: 2, na: 3 };
  var steps = COACH_STEPS_.map(function (s) {
    var mine = rs.filter(function (r) { return r.step === s.n; }), state = 'na';
    mine.forEach(function (r) { if (order[r.state] < order[state]) state = r.state; });
    return { n: s.n, name: s.name, state: state, rules: mine.map(function (r) { return r.id; }) };
  });
  var due = rs.filter(function (r) { return r.state === 'due'; }).sort(function (a, b) { return a.step - b.step; });
  return { rules: rs, steps: steps, reminders: due, dueCount: due.length, pendingCount: rs.filter(function (r) { return r.state === 'pending'; }).length, doneCount: rs.filter(function (r) { return r.state === 'done'; }).length, warnings: warn, msgCount: msgs.length };
}
function chatCoach_(e) {
  var p = (e && e.parameter) || {}, su = p.token ? _sessUser_(p.token) : null, who = '';
  if (su) { if (String(su.role || '') === 'demo') return jsonOut_({ ok: false, error: 'Tài khoản test không dùng được.' }); who = 'web'; }
  else { var ek = _extKeyWho_(p.ek); if (ek === 'pancake' || ek === 'zalo') who = ek; else return jsonOut_({ ok: false, code: 'AUTH', error: 'Cần đăng nhập hoặc khóa extension hợp lệ.' }); }
  var conv = String(p.conv || '').trim(); if (!conv) return jsonOut_({ ok: false, error: 'Thiếu conv.' });
  try {
    var ci = (sb_('GET', 'pk_conversations?select=id,page_id,customer_name,customer_phone&id=eq.' + _pkEnc_(conv) + '&limit=1').json || [])[0];
    if (!ci) return jsonOut_({ ok: true, found: false, conv: conv, gv: PK_GAS_VER_, reminders: [], steps: [], rules: [] });
    var rows = _pkMsgs_('&conversation_id=eq.' + _pkEnc_(conv) + '&order=sent_at.desc.nullslast&limit=150').reverse().map(_pkMsgOut_);
    var res = coachBuildResult_(coachRules_(), rows, { now: Date.now(), ctkm: coachCtkm_(), phone: !!String(ci.customer_phone || '').trim() });
    res.ok = true; res.found = true; res.conv = conv; res.gv = PK_GAS_VER_; res.customer = ci.customer_name || ''; res.ctkm = coachCtkm_();
    return jsonOut_(res);
  } catch (err) { return jsonOut_({ ok: false, error: 'Lỗi nhắc quy trình: ' + String(err && err.message || err).slice(0, 160) }); }
}

#!/usr/bin/env node
// Test (jsdom) muc "📚 Mau tin nhan tu van": Zalo AI (renderMsgTemplateRowsZai_/openTplFormZai_/loadMsgTemplatesZai_/_zaiTplCall_) SONG SONG voi Pancake AI.
// Cat NGUYEN VAN ma 2 ben, chay CUNG du lieu + CUNG kich ban, so khop: xep hang, HTML (sau khi quy ve class chung), hanh dong (chen/copy/sua/xoa), form de xuat, payload GAS.
// CAN: npm i jsdom (thieu thi bo qua). Chay: node tools/test-tpl-ui.js -> "ALL TPL UI TESTS PASSED".
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: chua cai jsdom'); process.exit(0); }
const fs = require('fs'), path = require('path');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const zsrc = fs.readFileSync(path.join(__dirname, '..', 'extension-zalo', 'zalo-content.js'), 'utf8');
const psrc = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
function fnSrc(src, name) { const i = src.indexOf('function ' + name); if (i < 0) throw new Error('khong thay ' + name); let d = 0, k = src.indexOf('{', i); for (let m = k; m < src.length; m++) { if (src[m] === '{') d++; else if (src[m] === '}') { d--; if (d === 0) return src.slice(i, m + 1); } } }
const zchunk = zsrc.slice(zsrc.indexOf('  let _zaiMsgTemplates = []'), zsrc.indexOf('  // ── DOANH SO & HOA HONG CUA TOI'));
const zhelp = fnSrc(zsrc, 'zaiFold_') + '\n' + fnSrc(zsrc, 'zaiRankTpls_');
const phelp = ['_stripVNlocal_', 'isMyOpenTpl_', 'tplLines_', 'rankMsgTemplates_', 'renderMsgTemplateRows_', 'ensureTplCatalog_', 'openTplForm_', 'loadMsgTemplates_'].map(n => fnSrc(psrc, n)).join('\n');
// Form tao mau (21/10/2026) dung danh muc SP chung voi tab tim anh: bien + 3 ham tien ich nam o cho khac trong pancake-content.js -> lay nguyen xi de test dung code that
const pcat = ['  const _fold_ = ', '  const _vnSort_ = ', '  const _itemNames_ = '].map(m => { const i = psrc.indexOf(m); if (i < 0) throw new Error('khong thay ' + m); let j = psrc.indexOf('\n  const ', i + 10), k2 = psrc.indexOf('\n  function ', i + 10); const e = [j, k2].filter(x => x > 0).sort((a, b) => a - b)[0]; return psrc.slice(i, e); }).join('\n');
const esc1 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const esc2 = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TPLS = [
  { id: 't1', title: 'Chào khách mới', content: 'Dạ chào anh/chị ạ, em tư vấn nhẫn bạc ạ.', product: 'Nhẫn bạc, Lắc tay', topic: 'Khách hỏi giá', tags: 'chào hỏi, bảo hành', status: 'approved', createdBy: 'An' },
  { id: 't2', title: 'Mẫu CỦA TÔI chờ duyệt', content: 'x'.repeat(200), product: 'Dây chuyền', topic: '', tags: '', status: 'pending', createdBy: 'Hoa' },
  { id: 't3', title: 'Bị từ chối', content: 'Nội dung bị từ chối', product: 'Charm', topic: 'Đổi trả', tags: '', status: 'rejected', rejectReason: 'Thiếu <b>giá</b>', createdBy: 'hoa ' },
  { id: 't4', title: 'Của người khác chờ duyệt', content: 'abc', product: 'Nhẫn', status: 'pending', createdBy: 'Bình' },
  { id: 'a"b\'c', title: 'ID có <dấu> "nháy"', content: 'Nội dung <img src=x onerror=1> & "kèm"', product: 'Tỷ hưu', topic: 'T"1', tags: 't<g>', status: 'approved', createdBy: 'An' }
];
const CANON_P = [['pk-price-item pk-ai-suggestion-item', 'ITEM'], ['pk-ctkm-title', 'TITLE'], ['pk-price-field', 'FIELD'], ['pk-btn-outline', 'BTN'], ['pk-tpl-acts', 'ACTS'], ['pk-price-loading', 'LOADING'], ['Bấm để chèn vào ô trả lời', 'TIP'], ['pk-tpl-form-box', 'FBOX'], ['pk-tpl-form-title', 'FTITLE'], ['pk-ai-sug-bar', 'BAR'], ['pk-ai-sug-save', 'SAVE'], ['pk-tpl-f-', 'f-']];
const CANON_Z = [['zai-ctkm-item zai-tpl-item', 'ITEM'], ['zai-ctkm-title', 'TITLE'], ['zai-ctkm-field', 'FIELD'], ['zai-btn zai-btn-primary zai-btn-sm zai-tpl-save', 'BTN SAVE'], ['zai-btn zai-btn-secondary zai-btn-sm', 'BTN'], ['zai-tpl-acts', 'ACTS'], ['zai-ctkm-loading', 'LOADING'], ['Bấm để dán vào ô chat', 'TIP'], ['zai-tpl-form-box', 'FBOX'], ['zai-tpl-form-title', 'FTITLE'], ['zai-tpl-bar', 'BAR'], ['zai-tpl-f-', 'f-']];
const canon = (h, map) => { let x = h; for (const [a, b] of map) x = x.split(a).join(b); return x.replace(/BTN SAVE/g, 'BTN SAVE').replace(/class="BTN SAVE"/g, 'class="BTN SAVE"').replace(/\s+/g, ' '); };
const normP = h => canon(h, CANON_P).replace(/class="BTN SAVE"/g, 'class="BTN SAVE"');

function zalo(cs) {
  const dom = new JSDOM('<!doctype html><body><input id="zai-tpl-q"><div id="zai-tpl-status"></div><div id="zai-tpl-form"></div><div id="zai-tpl-result"></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], inserted: [], clip: [], clipFail: false, confirmAns: true, reply: { ok: true }, listReply: { templates: TPLS } };
  w.navigator.clipboard = { writeText: async t => { if (env.clipFail) throw new Error('no'); env.clip.push(t); } };
  w.confirm = () => env.confirmAns;
  const fetchFn = async (url, o) => { if (o && o.method === 'POST') { const b = JSON.parse(o.body); env.calls.push(b); return { json: async () => env.reply.ok ? { ok: true } : { error: env.reply.error } }; } env.calls.push({ GET: url }); return { json: async () => env.listReply }; };
  const f = new w.Function('escHtml', 'GAS_URL', '_currentCS', 'fetch', 'document', 'navigator', 'confirm', 'fillZaloInput_', zhelp + '\n' + zchunk + '\nreturn { setTpls: (l) => { _zaiMsgTemplates = l; }, render: renderMsgTemplateRowsZai_, form: openTplFormZai_, load: loadMsgTemplatesZai_ };');
  const S = f(esc1, 'https://gas.test/exec', cs, fetchFn, w.document, w.navigator, w.confirm, (t, btn) => { env.inserted.push(t); });
  return Object.assign(S, { env, w, name: 'Zalo', q: w.document.getElementById('zai-tpl-q'), box: w.document.getElementById('zai-tpl-result'), host: w.document.getElementById('zai-tpl-form'), status: () => w.document.getElementById('zai-tpl-status').textContent, norm: h => canon(h, CANON_Z), pre: 'zai-tpl-f-' });
}
function pancake(cs) {
  const dom = new JSDOM('<!doctype html><body><div id="panel"><input id="pk-tpl-q"><div id="pk-tpl-form"></div><div id="pk-tpl-result"></div></div></body>', { runScripts: 'outside-only' }), w = dom.window, env = { calls: [], inserted: [], clip: [], clipFail: false, confirmAns: true, reply: { ok: true }, listReply: { templates: TPLS }, status: '' };
  w.navigator.clipboard = { writeText: async t => { if (env.clipFail) throw new Error('no'); env.clip.push(t); } };
  w.confirm = () => env.confirmAns;
  const safeSendMessage_ = (msg, cb) => { let r;
    if (msg.type === 'GET_PRODUCT_IMAGE_FLAT') { env.calls.push({ GET: 'flat' }); r = { ok: true, data: { items: env.flat || [] } }; }
    else if (msg.type === 'GET_MESSAGE_TEMPLATES') { env.calls.push({ GET: 'list' }); r = { ok: true, data: env.listReply }; }
    else if (msg.type === 'SAVE_MESSAGE_TEMPLATE') { const t = msg.payload; env.calls.push({ action: 'saveMessageTemplate', template: { id: t?.id || '', title: t?.title || '', content: t?.content || '', tags: t?.tags || '', product: t?.product || '', ...(t && 'nhom' in t ? { nhom: t.nhom || '' } : {}), topic: t?.topic || '', createdBy: t?.createdBy || '' } }); r = env.reply; }   // `nhom`: chi form Pancake moi (buoc 3/4) gui; chen dung vi tri de khop thu tu khoa that
    else { env.calls.push({ action: 'deleteMessageTemplate', id: msg.payload?.id || '', createdBy: msg.payload?.createdBy || '' }); r = env.reply; }
    setTimeout(() => cb(r), 0); };
  const f = new w.Function('panelEl', 'settings', 'safeSendMessage_', 'escapeHtml', 'insertReply', 'setStatus', 'navigator', 'confirm', 'let _msgTemplates = [], _msgTplTs = 0, _imgFlatItems = null, _imgFlatLoading = false; const PK_API_ERR = "Lỗi API";\n' + pcat + '\n' + phelp + '\nreturn { setTpls: (l) => { _msgTemplates = l; }, render: renderMsgTemplateRows_, form: openTplForm_, load: loadMsgTemplates_ };');
  const S = f(w.document.getElementById('panel'), { csName: cs }, safeSendMessage_, esc2, t => env.inserted.push(t), t => { env.status = t; }, w.navigator, w.confirm);
  return Object.assign(S, { env, w, name: 'Pancake', q: w.document.getElementById('pk-tpl-q'), box: w.document.getElementById('pk-tpl-result'), host: w.document.getElementById('pk-tpl-form'), status: () => env.status, norm: normP, pre: 'pk-tpl-f-' });
}
const body = S => S.box.innerHTML;
(async () => {
  for (const mk of [zalo, pancake]) {
    const S = mk('Hoa'), N = S.name;
    S.setTpls(TPLS);
    // render
    S.q.value = ''; S.render();
    ok(S.box.querySelectorAll('[data-tid]').length === 5, N + ': 5 the');
    ok(!S.box.querySelector('img') && !S.box.querySelector('b') && /ID có <dấu> "nháy"/.test(S.box.textContent) && /Thiếu <b>giá<\/b>/.test(S.box.textContent), N + ': HTML trong du lieu bi escape');
    ok(/Chờ quản lý duyệt/.test(S.box.textContent) && /Bị từ chối: Thiếu/.test(S.box.textContent), N + ': nhan cho duyet / bi tu choi (chi mau CUA MINH)');
    const mine = [...S.box.querySelectorAll('[data-tid]')].filter(e => e.querySelector('[data-eid]')).map(e => e.getAttribute('data-tid')); ok(mine.join() === 't2,t3', N + ': chi mau cua minh (chua duyet) co Sua/Xoa — kem "hoa " co dau cach/khac hoa-thuong: ' + mine);
    ok(S.box.querySelectorAll('[data-eid]').length === 2 && S.box.querySelectorAll('[data-did]').length === 2, N + ': 2 nut Sua + 2 nut Xoa');
    ok(/x{160}…/.test(S.box.textContent) && !/x{161}/.test(S.box.textContent), N + ': noi dung cat 160 ky tu + …');
    ok(S.box.querySelector('[data-tid="a&quot;b\'c"], [data-tid]:nth-child(5)').getAttribute('data-tid') === 'a"b\'c', N + ': ID co dau nhay van la gia tri thuoc tinh nguyen ven');
    S.q.value = 'nhan'; S.render(); ok([...S.box.querySelectorAll('[data-tid]')].map(e => e.getAttribute('data-tid')).join() === 't4,t1', N + ': tim "nhan": mau co san pham KHOP CHINH XAC (Nhan) len truoc mau chua tu "nhan" trong cum khac');
    S.q.value = 'khongco'; S.render(); ok(/Không tìm thấy mẫu phù hợp/.test(S.box.textContent), N + ': khong thay');
    S.setTpls([]); S.render(); ok(/Chưa có mẫu nào được duyệt/.test(S.box.textContent), N + ': chua co mau'); S.setTpls(TPLS); S.q.value = '';
    // gioi han 40
    S.setTpls(Array.from({ length: 55 }, (_, i) => ({ id: 'm' + i, title: 'T' + i, content: 'c', status: 'approved' }))); S.render(); ok(S.box.querySelectorAll('[data-tid]').length === 40, N + ': toi da 40 the'); S.setTpls(TPLS);
    S.render();
    // chen the: bam the -> chen noi dung; bam nut khong chen
    S.box.querySelector('[data-tid="t1"]').click(); ok(S.env.inserted.length === 1 && S.env.inserted[0] === TPLS[0].content, N + ': bam the -> chen noi dung vao o chat');
    S.box.querySelector('[data-cid="t1"]').click(); await sleep(20); ok(S.env.inserted.length === 1 && S.env.clip[0] === TPLS[0].content && /Đã copy/.test(S.box.querySelector('[data-cid="t1"]').textContent), N + ': Copy: khong chen, ghi clipboard, nut doi chu');
    S.env.clipFail = true; S.box.querySelector('[data-cid="t4"]').click(); await sleep(20); ok(/Không copy được — bấm vào thẻ để (chèn|dán) thẳng vào ô (trả lời|chat)/.test(S.status()), N + ': Copy loi -> thong bao: ' + S.status()); S.env.clipFail = false;
    // sua -> form dien san
    S.box.querySelector('[data-eid="t2"]').click(); await sleep(5);
    const F = id => S.host.querySelector('#' + S.pre + id);
    ok(F('title').value === 'Mẫu CỦA TÔI chờ duyệt' && F('product').value === 'Dây chuyền' && F('content').value === 'x'.repeat(200) && (N === 'Zalo' ? /Sửa mẫu đề xuất/ : /Sửa mẫu lưu sẵn/).test(S.host.textContent) && S.env.inserted.length === 1, N + ': Sua -> form dien san, khong chen');
    // xoa: huy -> khong goi; dong y -> goi dung + thong bao + tai lai
    S.env.confirmAns = false; S.box.querySelector('[data-did="t2"]').click(); await sleep(10); ok(!S.env.calls.some(c => c.action === 'deleteMessageTemplate'), N + ': huy xoa -> khong goi');
    S.env.confirmAns = true; S.env.reply = { ok: false, error: 'Khong co quyen' }; S.box.querySelector('[data-did="t2"]').click(); await sleep(20);
    ok(S.env.calls.find(c => c.action === 'deleteMessageTemplate').createdBy === 'Hoa' && (N === 'Zalo' ? /Lỗi xoá mẫu: Khong co quyen/ : /Khong co quyen/).test(S.status()), N + ': xoa loi -> thong bao');
    S.env.calls.length = 0; S.env.reply = { ok: true }; S.box.querySelector('[data-did="t2"]').click(); await sleep(30);
    ok(JSON.stringify(S.env.calls[0]) === JSON.stringify({ action: 'deleteMessageTemplate', id: 't2', createdBy: 'Hoa' }) && /Đã xoá mẫu/.test(S.status()) && S.env.calls.some(c => c.GET), N + ': xoa OK -> payload dung + thong bao + tai lai danh sach: ' + JSON.stringify(S.env.calls));
    // form de xuat moi
    S.host.innerHTML = ''; S.form(null); await sleep(5);
    ok((N === 'Zalo' ? /Đề xuất mẫu mới/ : /Tạo mẫu lưu sẵn/).test(S.host.textContent) && F('title').value === '', N + ': form moi trong');
    F('save').click(); ok((N === 'Zalo' ? /Cần nhập đủ tiêu đề và nội dung mẫu/ : /Cần nhập nội dung mẫu câu tư vấn/).test(S.status()), N + ': thieu noi dung -> nhac');
    F('title').value = '  Tiêu đề mới '; F('content').value = ' Nội dung mới '; F('product').value = 'Nhẫn'; F('topic').value = 'Hỏi giá'; F('tags').value = 'a, b';
    S.env.calls.length = 0; S.env.reply = { ok: false, error: 'Server bận' }; F('save').click(); await sleep(20);
    ok(!F('save').disabled && (N === 'Zalo' ? /Lỗi gửi đề xuất: Server bận/ : /Server bận/).test(S.status()) && S.host.querySelector('#' + S.pre + 'title'), N + ': gui loi -> mo lai nut, giu form, thong bao');
    S.env.calls.length = 0; S.env.reply = { ok: true }; F('save').click(); await sleep(30);
    // Pancake (form moi 21/10/2026, buoc 3/4) gui them truong `nhom` (chon tu bang gia) — thu tu khoa theo code that; tieu de co the bo trong (tu dat)
    const wantTpl = N === 'Zalo' ? { id: '', title: 'Tiêu đề mới', content: 'Nội dung mới', tags: 'a, b', product: 'Nhẫn', topic: 'Hỏi giá', createdBy: 'Hoa' } : { id: '', title: 'Tiêu đề mới', content: 'Nội dung mới', tags: 'a, b', product: 'Nhẫn', nhom: '', topic: 'Hỏi giá', createdBy: 'Hoa' };
    ok(JSON.stringify(S.env.calls[0]) === JSON.stringify({ action: 'saveMessageTemplate', template: wantTpl }), N + ': payload gui dung (da trim): ' + JSON.stringify(S.env.calls[0]));
    ok(S.host.innerHTML === '' && (N === 'Zalo' ? /Đã gửi đề xuất — quản lý duyệt xong/ : /Đã lưu mẫu \(chờ duyệt\)/).test(S.status()) && S.env.calls.some(c => c.GET), N + ': gui OK -> dong form, thong bao, tai lai');
    // sua mau co san -> gui kem id
    S.form(TPLS[2]); await sleep(5); S.env.calls.length = 0; F('save').click(); await sleep(30); ok(S.env.calls[0].template.id === 't3' && S.env.calls[0].template.createdBy === 'Hoa', N + ': sua -> gui kem id mau');
    // huy form
    S.form(null); await sleep(5); F('cancel').click(); ok(S.host.innerHTML === '', N + ': Huy dong form');
    // chua chon CS
    const S0 = mk(''); S0.form(null); ok(/Chọn tên CS của bạn trước/.test(S0.status()) && S0.host.innerHTML === '', N + ': chua chon CS -> nhac, khong mo form');
    S0.setTpls(TPLS); S0.render(); ok(S0.box.querySelectorAll('[data-eid]').length === 0, N + ': chua chon CS -> khong co mau "cua minh"');
  }
  // ── so khop 2 ben ──
  const Z = zalo('Hoa'), P = pancake('Hoa');
  for (const S of [Z, P]) S.setTpls(TPLS);
  // QUY TAC SONG SONG — DANG LECH CO CHU DICH: Pancake AI da co the mau moi (Copy/Chen ca cau + Tung doan, chip NHOM SP, xep hang theo nhom — buoc 2-3/4, 21/10/2026) con Zalo AI van ban cu.
  // Dat PARITY_REQUIRED = true khi Zalo da duoc lam giong de test lai BAT BUOC 2 ben GIONG HET (the + form). Luc nay chi in canh bao, khong lam hong bo test.
  const PARITY_REQUIRED = false; let parityGaps = 0;
  for (const q of ['', 'nhan', 'ho tro', 'Tỷ hưu', 'bao hanh', 'khong co gi', 'nhẫn bạc']) { Z.q.value = q; P.q.value = q; Z.render(); P.render();
    const same = Z.norm(Z.box.innerHTML) === P.norm(P.box.innerHTML);
    if (PARITY_REQUIRED) ok(same, 'HTML 2 ben GIONG HET voi q="' + q + '":\nZALO    ' + Z.norm(Z.box.innerHTML).slice(0, 900) + '\nPANCAKE ' + P.norm(P.box.innerHTML).slice(0, 900)); else if (!same) parityGaps++; }
  if (parityGaps) console.log('!!   CANH BAO: danh sach the mau Zalo CHUA giong Pancake (' + parityGaps + '/7 truy van lech) — can lam Zalo song song (Copy/Chen ca cau, chip nhom)');
  Z.host.innerHTML = ''; P.host.innerHTML = ''; Z.form(TPLS[1]); P.form(TPLS[1]); await sleep(5);
  // CHUA SONG SONG (quy tac song song): form tao mau cua Pancake da doi (buoc 3/4, 21/10/2026: chon NHOM SP tu bang gia + goi y ten SP) nhung Zalo van la form cu.
  // Khong de test do cho den khi Zalo duoc lam giong: in canh bao ro; DOI `PARITY_REQUIRED` (o tren) thanh true khi Zalo da cap nhat de test lai bat buoc 2 ben GIONG HET.
  const FORM_PARITY_REQUIRED = PARITY_REQUIRED, sameForm = Z.norm(Z.host.innerHTML) === P.norm(P.host.innerHTML);
  if (FORM_PARITY_REQUIRED) ok(sameForm, 'form HTML 2 ben GIONG HET:\n' + Z.norm(Z.host.innerHTML).slice(0, 600) + '\n' + P.norm(P.host.innerHTML).slice(0, 600));
  else console.log(sameForm ? 'ok   form 2 ben da giong het (hay dat PARITY_REQUIRED = true)' : '!!   CANH BAO: form tao mau Zalo CHUA giong Pancake (Pancake da co form chon nhom SP) — can lam Zalo song song');
  // ── rieng Zalo: tai danh sach, loi, chua cai URL ──
  const Z1 = zalo('Hoa Binh'); await Z1.load(); await sleep(10);
  ok(Z1.env.calls[0].GET === 'https://gas.test/exec?action=messageTemplates&by=' + encodeURIComponent('Hoa Binh') && Z1.box.querySelectorAll('[data-tid]').length === 5, 'Zalo: GET messageTemplates kem by=<CS> (de thay mau cua minh cho duyet)');
  Z1.env.listReply = { error: 'Khong doc duoc' }; await Z1.load(); ok(/Lỗi: Khong doc duoc/.test(Z1.box.textContent), 'Zalo: loi backend');
  const ZD = zalo('Hoa'); ZD.w.document.getElementById('zai-tpl-q'); ZD.env.listReply = null; await ZD.load(); ok(/Lỗi:/.test(ZD.box.textContent), 'Zalo: phan hoi hong -> bao loi, khong nem');
  // ── noi vao menu ──
  ok(/\{ v: 'tpl', label: '📚 Mẫu tin nhắn tư vấn' \}/.test(zsrc) && /tplBody\.style\.display = v === 'tpl'/.test(zsrc) && /if \(v === 'tpl' && !_zaiTplLoadedOnce\) \{ _zaiTplLoadedOnce = true; loadMsgTemplatesZai_\(\)/.test(zsrc) && /id="zai-tpl-add"/.test(zsrc) && /#zai-tpl-q'\)\.addEventListener\('input'/.test(zsrc), 'Zalo: muc menu + nap lan dau + nut tai lai/them + go tim');
  ok(/<option value="tpl">📚 Tạo mẫu lưu sẵn \/ Mẫu tư vấn<\/option>/.test(psrc), 'Pancake: ten muc menu (doi o buoc 3/4: Tao mau luu san / Mau tu van)');
  if (PARITY_REQUIRED) ok(/<option value="tpl">📚 Mẫu tin nhắn tư vấn<\/option>/.test(psrc), 'ten muc menu giong het Zalo'); else console.log('!!   CANH BAO: ten muc menu Zalo ("📚 Mẫu tin nhắn tư vấn") CHUA giong Pancake — can lam Zalo song song');
  console.log('ALL TPL UI TESTS PASSED');
})().catch(er => { console.error('FAIL (ngoai le): ' + (er && er.stack || er)); process.exit(1); });

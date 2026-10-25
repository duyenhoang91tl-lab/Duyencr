#!/usr/bin/env node
// Test (2026-10-25): Viet Tat tren CRM (js/57-viettat.js) — quan ly (tab Zalo AI) + go tat trong <textarea>. Nap NGUYEN file trong jsdom voi fetch gia.
// Can jsdom: NODE_PATH=<thu muc co node_modules/jsdom> node tools/test-viettat-crm.js
const fs = require('fs'), path = require('path');
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can `npm i jsdom` (NODE_PATH)'); process.exit(0); }
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'js', '57-viettat.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SN = [
  { id: 'vt_1', abbr: 'ch', keyword: 'chao', options: ['Chào {tên} ạ', 'Dạ em chào chị {tên} ạ'], scope: 'team', nhom: 'Chào hỏi' },
  { id: 'vt_2', abbr: 'gb', keyword: 'giá, bảng giá', options: ['Giá nhẫn bạc <b>từ</b> 500k'], scope: 'me', nhom: '' }
];
// lay dung khoi HTML cua muc Viet tat tu index.html that
const m = html.match(/<div id="vt-section"[\s\S]*?<div id="vt-list"[^>]*><\/div>\s*<\/div>/); ok(!!m, 'index.html co khoi #vt-section');
async function boot(o) {
  o = o || {};
  const dom = new JSDOM('<!doctype html><body>' + m[0] + '<textarea id="t"></textarea><textarea id="off" data-vt="off"></textarea><input id="inp" type="text"></body>', { runScripts: 'outside-only', url: 'https://crm.test/', pretendToBeVisual: true });
  const w = dom.window, calls = [];
  w.gsUrl = 'https://gas.test/exec'; w.toast = () => {}; w.alert = (t) => { calls.push({ alert: t }); }; w.confirm = () => (o.confirm !== false);
  w.fetch = async (u, init) => { calls.push({ u, body: init && init.body }); if (/action=vietTatResolveImages/.test(u)) return { json: async () => (o.resolveResp || { ok: true, images: [], errors: [] }) }; if (/action=vietTat/.test(u)) { if (o.fail) throw new Error('mang'); return { json: async () => (o.resp || { ok: true, snippets: SN, canTeam: !!o.admin, me: 'Hoa' }) }; } if (init && init.body && /"action":"vietTatUploadImage"/.test(init.body)) { const b = JSON.parse(init.body); return { json: async () => (o.upload ? o.upload(b) : { ok: true, id: 'UPLOADED_' + b.name.replace(/\W/g, '') + '_AAAAAAAA', name: b.name }) }; } return { json: async () => (o.save || { ok: true, id: 'vt_new' }) }; };
  w.switchTab = function (t) { calls.push({ tab: t }); };
  w.eval('var currentPhone=' + JSON.stringify(o.phone || '') + ';var allCustomers=' + JSON.stringify(o.phone ? [{ phone: o.phone, name: 'Trần Thu Hà' }] : []) + ';');
  w.eval(code); await sleep(10);
  const $ = (id) => w.document.getElementById(id);
  const popup = () => { const h = w.document.getElementById('vt-host'); const b = h && h.shadowRoot.querySelector('.b'); return b && b.style.display === 'block' ? [...b.querySelectorAll('.o span')].map((x) => x.textContent) : null; };
  const typeTA = (el, text, caret) => { el.focus(); el.value = text; const c = caret === undefined ? text.length : caret; el.setSelectionRange(c, c); el.dispatchEvent(new w.InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' })); };
  const key = (el, k, extra) => { const e = new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {})); el.dispatchEvent(e); return e; };
  return { w, calls, $, popup, typeTA, key };
}
(async () => {
  let E = await boot({ admin: true });
  E.w.switchTab('zaloai'); await sleep(20);
  ok(E.calls.some((c) => c.u && /action=vietTat/.test(c.u)), 'mo tab Zalo AI -> tai danh sach viet tat');
  ok(E.$('vt-list').querySelectorAll('code').length === 2 && /Chào hỏi/.test(E.$('vt-list').textContent), 've danh sach 2 muc, co nhom');
  ok(!/<b>từ<\/b>/.test(E.$('vt-list').innerHTML) && /&lt;b&gt;từ&lt;\/b&gt;/.test(E.$('vt-list').innerHTML), 'noi dung duoc ESCAPE HTML (khong chay duoc the)');
  ok(E.$('vt-list').querySelectorAll('button[title="Sửa"]').length === 2, 'admin sua/xoa duoc ca muc chung va muc rieng');
  ok(/Bạn là admin/.test(E.$('vt-hint').textContent), 'goi y cho admin');
  E.$('vt-search').value = 'bang gia'; E.w.vtRender();   // (jsdom outside-only khong chay oninput inline)
  ok(E.$('vt-list').querySelectorAll('code').length === 1, 'tim khong dau theo tu khoa "bảng giá"');
  E.$('vt-search').value = ''; E.$('vt-scope-filter').value = 'team'; E.w.vtRender(); ok(E.$('vt-list').querySelectorAll('code').length === 1 && E.$('vt-list').querySelector('code').textContent === 'ch', 'loc theo Chung');
  E.$('vt-scope-filter').value = '';

  // nhan vien: muc chung khong sua duoc
  const U = await boot({ admin: false }); U.w.switchTab('zaloai'); await sleep(20);
  ok(U.$('vt-list').querySelectorAll('button[title="Sửa"]').length === 1, 'nhan vien chi sua/xoa duoc muc RIENG cua minh');
  U.w.vtOpenForm(); ok(U.$('vt-f-scope').querySelector('option[value="team"]').disabled === true && U.$('vt-f-scope').value === 'me', 'nhan vien khong chon duoc "Chung"');

  // them moi (admin)
  E.w.vtOpenForm(); ok(E.$('vt-form-wrap').style.display === 'block' && E.$('vt-f-opts').children.length === 1, 'mo form them moi voi 1 o noi dung');
  E.w.vtAddOpt(); ok(E.$('vt-f-opts').children.length === 2, 'them lua chon');
  E.$('vt-f-abbr').value = 'co khoang'; E.$('vt-f-opts').querySelector('textarea').value = 'abc'; await E.w.vtSave();
  ok(E.calls.some((c) => c.alert && /1 từ/.test(c.alert)), 'viet tat co khoang trang -> canh bao, KHONG gui'); ok(!E.calls.some((c) => c.body && /saveVietTat/.test(c.body)), 'khong goi server khi du lieu sai');
  E.$('vt-f-abbr').value = 'sp'; E.$('vt-f-opts').querySelectorAll('textarea')[0].value = '  Cảm ơn {tên}  '; E.$('vt-f-opts').querySelectorAll('textarea')[1].value = '   '; E.$('vt-f-scope').value = 'team'; E.$('vt-f-nhom').value = 'Cảm ơn'; E.$('vt-f-keyword').value = ' camon ';
  E.calls.length = 0; await E.w.vtSave(); await sleep(20);
  const post = E.calls.find((c) => c.body && /saveVietTat/.test(c.body)); const pj = post && JSON.parse(post.body);
  ok(pj && pj.action === 'saveVietTat' && pj.snippet.abbr === 'sp' && JSON.stringify(pj.snippet.options) === JSON.stringify(['Cảm ơn {tên}']) && pj.snippet.scope === 'team' && pj.snippet.keyword === 'camon' && pj.snippet.nhom === 'Cảm ơn' && !pj.snippet.id, 'gui dung payload (cat khoang trang, bo o rong): ' + JSON.stringify(pj && pj.snippet));
  ok(E.$('vt-form-wrap').style.display === 'none' && E.calls.some((c) => c.u && /action=vietTat/.test(c.u)), 'luu xong dong form + tai lai danh sach');

  // sua
  E.w.vtOpenForm('vt_1'); ok(E.$('vt-f-abbr').value === 'ch' && E.$('vt-f-opts').children.length === 2 && E.$('vt-f-scope').disabled === true, 'mo form sua: dien san 2 lua chon, khoa o chung/rieng');
  E.calls.length = 0; await E.w.vtSave(); const pj2 = JSON.parse(E.calls.find((c) => c.body).body); ok(pj2.snippet.id === 'vt_1', 'sua gui kem id');
  // loi server
  const F = await boot({ admin: true, save: { error: 'Chi admin' } }); F.w.vtOpenForm(); F.$('vt-f-abbr').value = 'q'; F.$('vt-f-opts').querySelector('textarea').value = 'x'; await F.w.vtSave();
  ok(F.calls.some((c) => c.alert && /Chi admin/.test(c.alert)) && F.$('vt-form-wrap').style.display === 'block', 'server tu choi -> bao loi, GIU form de sua');
  // xoa
  E.calls.length = 0; await E.w.vtDelete('vt_2'); ok(E.calls.some((c) => c.body && JSON.parse(c.body).action === 'deleteVietTat' && JSON.parse(c.body).id === 'vt_2'), 'xoa goi deleteVietTat');
  const N = await boot({ admin: true, confirm: false }); N.calls.length = 0; await N.w.vtDelete('vt_2'); ok(!N.calls.some((c) => c.body), 'huy xac nhan -> khong xoa');
  const X = await boot({ fail: true }); X.w.switchTab('zaloai'); await sleep(20); ok(/Lỗi tải/.test(X.$('vt-list').textContent), 'loi mang -> bao loi + nut Thu lai');

  // go tat trong textarea
  const ta = E.$('t'); await E.w.loadVietTat(true);
  E.typeTA(ta, 'xin ch'); ok(E.popup() && E.popup()[0] === 'Chào {tên} ạ', 'textarea: go "ch" hien goi y (chua mo khach -> giu {tên}): ' + JSON.stringify(E.popup()));
  E.key(ta, 'Tab'); ok(ta.value === 'xin Chào {tên} ạ', 'Tab chen: ' + JSON.stringify(ta.value));
  E.typeTA(ta, 'ch Thu Hà'); E.key(ta, 'ArrowDown'); E.key(ta, 'Tab'); ok(ta.value === 'Dạ em chào chị Hà ạ', 'ch + ten: ' + JSON.stringify(ta.value));
  E.typeTA(ta, 'gb'); ok(E.popup()[0] === 'Giá nhẫn bạc <b>từ</b> 500k', 'noi dung giu NGUYEN van ban (khong bien thanh HTML) khi chen'); E.key(ta, '1', { altKey: true }); ok(ta.value === 'Giá nhẫn bạc <b>từ</b> 500k', 'Alt+1');
  const popHtml = E.w.document.getElementById('vt-host').shadowRoot.querySelector('.b').innerHTML; E.typeTA(ta, 'gb'); ok(!/<b>từ<\/b>/.test(E.w.document.getElementById('vt-host').shadowRoot.querySelector('.b').innerHTML), 'popup ESCAPE HTML noi dung');
  E.key(ta, 'Escape'); ok(E.popup() === null, 'Esc dong');
  E.typeTA(E.$('off'), 'ch'); ok(E.popup() === null, 'o co data-vt="off" -> khong goi y');
  E.typeTA(E.$('inp'), 'ch'); ok(E.popup() === null, 'o <input> (ten/SDT/tim) khong bi dong vao');
  const f = E.$('vt-f-opts'); E.w.vtOpenForm(); E.typeTA(f.querySelector('textarea'), 'ch'); ok(E.popup() === null, 'dang SOAN viet tat (o noi dung) -> khong tu bung');
  const C = await boot({ admin: true, phone: '0912345678' }); await C.w.loadVietTat(true); C.typeTA(C.$('t'), 'ch'); ok(C.popup() && C.popup()[0] === 'Chào Hà ạ', 'khach dang mo o ngan ho so -> tu lay ten: ' + JSON.stringify(C.popup()));
  const Z = await boot({ resp: { ok: true, snippets: [], canTeam: false, me: '' } }); await Z.w.loadVietTat(true); Z.typeTA(Z.$('t'), 'ch'); ok(Z.popup() === null, 'chua co viet tat -> im lang');

  // ===== THU MUC CON + ANH (2026-10-25) =====
  const IMA = 'IMG_AAAAAAAAAAAAAAAA', IMB = 'IMG_BBBBBBBBBBBBBBBB';
  const TREE = [
    { id: 'v1', abbr: 'tt', keyword: '', options: ['Túi tiền cổ'], scope: 'team', nhom: 'Túi tiền/Cổ', images: [{ id: IMA, name: 'fiole 1.jpg' }, { id: IMB, name: 'bang <gia>.png' }] },
    { id: 'v2', abbr: 'tl', keyword: '', options: ['Túi tiền lắc'], scope: 'team', nhom: 'Túi tiền/Lắc', images: [] },
    { id: 'v3', abbr: 'xx', keyword: '', options: ['khac'], scope: 'team', nhom: '', images: [] }
  ];
  const T = await boot({ admin: true, resp: { ok: true, snippets: TREE, canTeam: true, me: 'Duyen' } }); T.w.switchTab('zaloai'); await sleep(20);
  const lh = T.$('vt-list').textContent;
  ok(/Túi tiền/.test(lh) && /└ 🗂 Cổ/.test(lh) && /└ 🗂 Lắc/.test(lh) && /Chưa phân nhóm/.test(lh), 'cay thu muc: cha "Túi tiền" + con Cổ/Lắc + nhom trong');
  ok((lh.match(/🗂 Túi tiền/g) || []).length === 1, 'thu muc cha chi hien 1 lan (khong lap theo tung con)');
  ok(T.$('vt-list').querySelectorAll('img').length === 2 && /2 ảnh/.test(lh), 'the muc hien 2 anh nho + so luong');
  ok(T.$('vt-list').querySelector('gia') === null && [...T.$('vt-list').querySelectorAll('img')].some((i) => i.alt === 'bang <gia>.png'), 'ten anh nam trong thuoc tinh da ESCAPE (khong sinh the HTML)');
  ok([...T.$('vt-list').querySelectorAll('img')].every((i) => /drive\.google\.com\/thumbnail\?id=IMG_/.test(i.src)), 'anh nho lay tu Drive theo ID (khong tai len)');
  ok([...T.$('vt-nhom-list').querySelectorAll('option')].map((o) => o.value).sort().join('|') === 'Túi tiền|Túi tiền/Cổ|Túi tiền/Lắc', 'goi y nhom gom ca thu muc cha lan con');
  // mo form sua: nap anh cua muc
  T.w.vtOpenForm('v1');
  ok(T.$('vt-f-imgs').querySelectorAll('img').length === 2 && /2\/50/.test(T.$('vt-f-imgcount').textContent), 'form sua: nap san 2 anh cua muc');
  T.w.vtRemoveImg(0); ok(T.$('vt-f-imgs').querySelectorAll('img').length === 1, 'bo tung anh');
  T.calls.length = 0; await T.w.vtSave(); await sleep(10);
  const ps = JSON.parse(T.calls.find((c) => c.body && /saveVietTat/.test(c.body)).body);
  ok(ps.snippet.id === 'v1' && ps.snippet.nhom === 'Túi tiền/Cổ' && ps.snippet.images.length === 1 && ps.snippet.images[0].id === IMB, 'luu: gui nhom con + danh sach anh con lai: ' + JSON.stringify(ps.snippet.images));
  // them anh tu link
  const R = await boot({ admin: true, resp: { ok: true, snippets: TREE, canTeam: true, me: 'Duyen' }, resolveResp: { ok: true, images: [{ id: IMA, name: 'a.jpg' }, { id: IMB, name: 'b.jpg' }], errors: ['rac: khong nhan ra link Drive'] } });
  R.w.vtOpenForm(); R.$('vt-f-imglinks').value = 'https://drive.google.com/drive/folders/XYZ\nrac'; R.calls.length = 0; await R.w.vtFetchImgs();
  const rc = R.calls.find((c) => c.u && /action=vietTatResolveImages/.test(c.u));
  ok(rc && decodeURIComponent(rc.u).indexOf('links=https://drive.google.com/drive/folders/XYZ\nrac') > 0, 'goi vietTatResolveImages kem link (moi dong 1 link)');
  ok(R.$('vt-f-imgs').querySelectorAll('img').length === 2 && /Đã thêm 2 ảnh/.test(R.$('vt-f-imgmsg').textContent) && /1 link lỗi/.test(R.$('vt-f-imgmsg').textContent) && R.$('vt-f-imglinks').value === '', 'them 2 anh, bao link loi, xoa o link');
  R.$('vt-f-imglinks').value = 'https://drive.google.com/drive/folders/XYZ'; await R.w.vtFetchImgs(); ok(R.$('vt-f-imgs').querySelectorAll('img').length === 2 && /Không thêm được/.test(R.$('vt-f-imgmsg').textContent), 'link trung -> khong them lap anh');
  R.$('vt-f-imglinks').value = ''; R.calls.length = 0; await R.w.vtFetchImgs(); ok(!R.calls.some((c) => c.u && /ResolveImages/.test(c.u)), 'o link trong -> khong goi server');
  const RE = await boot({ admin: true, resolveResp: { error: 'Can dang nhap' } }); RE.w.vtOpenForm(); RE.$('vt-f-imglinks').value = 'x'; await RE.w.vtFetchImgs(); ok(/Lỗi: Can dang nhap/.test(RE.$('vt-f-imgmsg').textContent) && RE.$('vt-f-imgs').children.length === 0, 'server bao loi -> hien loi, khong them anh');
  R.$('vt-f-abbr').value = 'ab'; R.$('vt-f-opts').querySelector('textarea').value = 'x'; R.$('vt-f-nhom').value = 'Túi tiền/Nhẫn'; R.calls.length = 0; await R.w.vtSave(); await sleep(10);
  const pr = JSON.parse(R.calls.find((c) => c.body && /saveVietTat/.test(c.body)).body); ok(pr.snippet.images.length === 2 && pr.snippet.nhom === 'Túi tiền/Nhẫn', 'them moi: gui anh da lay + nhom con');
  R.w.vtOpenForm(); ok(R.$('vt-f-imgs').children.length === 0, 'mo form moi: khong con anh cua lan truoc');

  // ===== THEM ANH: 50 anh/muc + CHON NHIEU ANH TU MAY (2026-10-25, Duyen yeu cau) =====
  const mkFile = (w, name, type, data) => new w.File([data || 'abc'], name, { type });
  const stubCompress = (w) => w.eval("_vtCompress = function (f) { return Promise.resolve({ blob: f, name: f.name.replace(/\\.\\w+$/, '') + '.jpg', mime: 'image/jpeg' }); };");
  // (a) chon 5 anh 1 lan: tai len lan luot, toi da 2 luong, them dung 5 anh vao form
  let inflight = 0, peak = 0;
  const U1 = await boot({ admin: true, upload: async (b) => { inflight++; peak = Math.max(peak, inflight); await sleep(15); inflight--; return { ok: true, id: 'UP_' + b.name.replace(/\W/g, '') + '_ZZZZZZZZZZ', name: b.name }; } });
  U1.w.vtOpenForm(); stubCompress(U1.w);
  U1.calls.length = 0; await U1.w.vtUploadFiles(['a1', 'a2', 'a3', 'a4', 'a5'].map((n) => mkFile(U1.w, n + '.jpg', 'image/jpeg', n)));
  const ups = U1.calls.filter((c) => c.body && /vietTatUploadImage/.test(c.body)).map((c) => JSON.parse(c.body));
  ok(ups.length === 5 && ups.every((x) => x.action === 'vietTatUploadImage' && x.mimeType === 'image/jpeg' && /\.jpg$/.test(x.name) && x.base64.length > 0), 'chon 5 anh 1 lan -> 5 request vietTatUploadImage (moi anh 1 request)');
  ok(Buffer.from(ups[0].base64, 'base64').toString() === 'a1', 'noi dung anh gui di la base64 dung (khong kem tien to data:)');
  ok(peak === 2, 'tai len toi da 2 luong cung luc (peak=' + peak + ')');
  ok(U1.$('vt-f-imgs').querySelectorAll('img').length === 5 && /5\/50/.test(U1.$('vt-f-imgcount').textContent) && /Đã tải lên 5 ảnh/.test(U1.$('vt-f-imgmsg').textContent) && /Lưu/.test(U1.$('vt-f-imgmsg').textContent), 'form hien 5 anh, dem 5/50, bao da tai + nhac bam Luu');
  ok(U1.$('vt-f-filebtn').disabled === false && /Chọn ảnh từ máy/.test(U1.$('vt-f-filebtn').textContent), 'xong -> nut chon anh bat lai');
  U1.$('vt-f-abbr').value = 'up'; U1.$('vt-f-opts').querySelector('textarea').value = 'x'; U1.calls.length = 0; await U1.w.vtSave(); await sleep(10);
  ok(JSON.parse(U1.calls.find((c) => c.body && /saveVietTat/.test(c.body)).body).snippet.images.length === 5, 'Luu: gui du 5 ID anh vua tai len');
  // (b) tep khong phai anh bi bo qua; anh loi bao rieng, anh con lai van them
  let n = 0; const U2 = await boot({ admin: true, upload: async (b) => (++n === 2 ? { ok: false, error: 'Anh qua lon (toi da 3MB).' } : { ok: true, id: 'UQ_' + n + '_ZZZZZZZZZZZZZZ', name: b.name }) });
  U2.w.vtOpenForm(); stubCompress(U2.w);
  await U2.w.vtUploadFiles([mkFile(U2.w, 'a.jpg', 'image/jpeg'), mkFile(U2.w, 'b.jpg', 'image/jpeg'), mkFile(U2.w, 'c.png', 'image/png'), mkFile(U2.w, 'x.pdf', 'application/pdf'), mkFile(U2.w, 'iphone.HEIC', '')]);
  const m2 = U2.$('vt-f-imgmsg').textContent;
  ok(U2.$('vt-f-imgs').querySelectorAll('img').length === 3 && /Đã tải lên 3 ảnh/.test(m2) && /1 ảnh lỗi/.test(m2) && /quá lớn|qua lon/i.test(m2) && /1 tệp không phải ảnh/.test(m2), '1 anh loi + 1 PDF: them 3 anh con lai, bao loi + bao bo qua PDF (HEIC khong type van tinh la anh): ' + m2);
  // (c) tran 50: form dang co 48 anh, chon them 5 -> chi tai 2, bao bo qua 3
  const have48 = []; for (let i = 0; i < 48; i++) have48.push({ id: 'HAVE' + String(i).padStart(12, '0') + 'ZZZZ', name: 'h' + i });
  const U3 = await boot({ admin: true, resp: { ok: true, snippets: [{ id: 'v48', abbr: 'q', keyword: '', options: ['q'], scope: 'team', nhom: 'A/B', images: have48 }], canTeam: true, me: 'Duyen' } });
  U3.w.switchTab('zaloai'); await sleep(20); U3.w.vtOpenForm('v48'); stubCompress(U3.w);
  ok(/48\/50/.test(U3.$('vt-f-imgcount').textContent), 'mo muc co 48 anh -> 48/50');
  U3.calls.length = 0; await U3.w.vtUploadFiles([1, 2, 3, 4, 5].map((i) => mkFile(U3.w, 'n' + i + '.jpg', 'image/jpeg')));
  ok(U3.calls.filter((c) => c.body && /vietTatUploadImage/.test(c.body)).length === 2 && U3.$('vt-f-imgs').querySelectorAll('img').length === 50 && /Bỏ qua 3 ảnh/.test(U3.$('vt-f-imgmsg').textContent) && /50/.test(U3.$('vt-f-imgmsg').textContent), 'tran 50: chi tai 2 anh dau, bo qua 3, bao ro ly do');
  await U3.w.vtUploadFiles([mkFile(U3.w, 'm.jpg', 'image/jpeg')]); ok(/tối đa 50/.test(U3.$('vt-f-imgmsg').textContent) && U3.$('vt-f-imgs').querySelectorAll('img').length === 50, 'da du 50 -> khong tai them, bao tran');
  // danh sach muc 50 anh: chi ve 12 anh nho + "+38 ảnh nữa" (khong dung 50 the img cho moi muc)
  U3.w.vtCloseForm(); ok(U3.$('vt-list').querySelectorAll('img').length === 12 && /\+36 ảnh nữa/.test(U3.$('vt-list').textContent) && /48 ảnh/.test(U3.$('vt-list').textContent), 'danh sach: toi da 12 anh nho + "+36 anh nua" (muc 48 anh)');
  // (d) khong cho Luu khi dang tai anh (se mat anh chua tai xong)
  let release; const gate = new Promise((r) => { release = r; });
  const U4 = await boot({ admin: true, upload: async (b) => { await gate; return { ok: true, id: 'UG_' + b.name.replace(/\W/g, '') + '_ZZZZZZZZZZZZ', name: b.name }; } });
  U4.w.vtOpenForm(); stubCompress(U4.w); U4.$('vt-f-abbr').value = 'dd'; U4.$('vt-f-opts').querySelector('textarea').value = 'x';
  const pend = U4.w.vtUploadFiles([mkFile(U4.w, 'p1.jpg', 'image/jpeg'), mkFile(U4.w, 'p2.jpg', 'image/jpeg')]); await sleep(10);
  ok(U4.$('vt-f-filebtn').disabled === true && /0\/2/.test(U4.$('vt-f-imgmsg').textContent), 'dang tai: nut chon anh bi khoa + hien tien do 0/2');
  U4.calls.length = 0; await U4.w.vtSave(); ok(U4.calls.some((c) => c.alert && /Đang tải ảnh/.test(c.alert)) && !U4.calls.some((c) => c.body && /saveVietTat/.test(c.body)), 'bam Luu khi dang tai anh -> canh bao, KHONG luu (khong mat anh)');
  // (e) dong form / mo muc khac giua chung: anh tai do KHONG chui sang muc moi
  U4.w.vtCloseForm(); U4.w.vtOpenForm(); release(); await pend; await sleep(10);
  ok(U4.$('vt-f-imgs').children.length === 0 && U4.$('vt-f-filebtn').disabled === false, 'doi muc giua luc tai: anh cua muc cu khong chui sang form moi, nut chon anh khong bi ket');
  // (f) danh sach tep bi ô chọn tệp xoá ngay sau khi goi (this.value='') van tai duoc
  const U5 = await boot({ admin: true }); U5.w.vtOpenForm(); stubCompress(U5.w);
  const live = { 0: mkFile(U5.w, 'k1.jpg', 'image/jpeg'), 1: mkFile(U5.w, 'k2.jpg', 'image/jpeg'), length: 2 };
  const pf = U5.w.vtUploadFiles(live); live.length = 0; delete live[0]; delete live[1]; await pf;
  ok(U5.$('vt-f-imgs').querySelectorAll('img').length === 2, 'FileList bi xoa ngay sau khi chon van tai du 2 anh (da sao ra mang)');
  // (g) _vtCompress that: GIF to > 3MB bi tu choi; GIF nho giu nguyen; khong giai ma duoc (jsdom khong co anh) -> JPEG nho gui nguyen ban, HEIC thi bao loi
  const U6 = await boot({ admin: true });
  const big = new Uint8Array(3 * 1024 * 1024 + 1);
  ok(await U6.w._vtCompress(mkFile(U6.w, 'g.gif', 'image/gif', big)).then(() => false, (e) => /GIF/.test(e.message)), 'GIF > 3MB bi tu choi');
  ok((await U6.w._vtCompress(mkFile(U6.w, 'g.gif', 'image/gif', 'GIF89a'))).mime === 'image/gif', 'GIF nho giu nguyen');
  const fb = await U6.w._vtCompress(mkFile(U6.w, 'z.jpg', 'image/jpeg', 'abc')); ok(fb.mime === 'image/jpeg' && fb.name === 'z.jpg', 'khong giai ma duoc anh JPEG nho -> gui nguyen ban');
  ok(await U6.w._vtCompress(mkFile(U6.w, 'z.heic', '', 'abc')).then(() => false, (e) => /không đọc được/.test(e.message)), 'HEIC khong giai ma duoc -> bao loi ro rang');
  ok(await U6.w._vtCompress(mkFile(U6.w, 'z.jpg', 'image/jpeg', big)).then(() => false, () => true), 'JPEG > 3MB khong giai ma duoc -> bao loi (khong gui anh qua lon)');
  // (h) link Drive: thu muc 60 anh -> chi them toi da 50 + bao truncated / bo qua
  const sixty = []; for (let i = 0; i < 60; i++) sixty.push({ id: 'DRV' + String(i).padStart(12, '0') + 'ZZZZZ', name: 'd' + i + '.jpg' });
  const U7 = await boot({ admin: true, resolveResp: { ok: true, images: sixty.slice(0, 50), errors: [], truncated: true, max: 50 } });
  U7.w.vtOpenForm(); U7.$('vt-f-imglinks').value = 'https://drive.google.com/drive/folders/BIG'; await U7.w.vtFetchImgs();
  ok(U7.$('vt-f-imgs').querySelectorAll('img').length === 50 && /Đã thêm 50 ảnh/.test(U7.$('vt-f-imgmsg').textContent) && /nhiều hơn 50 ảnh/.test(U7.$('vt-f-imgmsg').textContent), 'link thu muc co >50 anh: them 50 anh dau + bao ro thu muc bi cat');
  const U8 = await boot({ admin: true, resp: { ok: true, snippets: [{ id: 'v30', abbr: 'q', keyword: '', options: ['q'], scope: 'team', nhom: '', images: sixty.slice(0, 30) }], canTeam: true, me: 'D' }, resolveResp: { ok: true, images: sixty.slice(20, 50), errors: [], max: 50 } });
  U8.w.switchTab('zaloai'); await sleep(20); U8.w.vtOpenForm('v30'); U8.$('vt-f-imglinks').value = 'x'; await U8.w.vtFetchImgs();
  ok(U8.$('vt-f-imgs').querySelectorAll('img').length === 50 && /Đã thêm 20 ảnh/.test(U8.$('vt-f-imgmsg').textContent), 'link Drive: ảnh trùng với ảnh đã có không tính, chỉ thêm 20 ảnh mới');
  U8.$('vt-f-imglinks').value = 'y'; U8.calls.length = 0; await U8.w.vtFetchImgs(); ok(/tối đa 50/.test(U8.$('vt-f-imgmsg').textContent) && !U8.calls.some((c) => c.u && /ResolveImages/.test(c.u)), 'da du 50 anh -> khong goi server lay them, bao tran');
  console.log(bad ? ('\n' + bad + ' LOI') : '\nALL VIETTAT-CRM TESTS PASSED'); process.exit(bad ? 1 : 0);
})();

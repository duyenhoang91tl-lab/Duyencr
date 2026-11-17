#!/usr/bin/env node
// Test (jsdom) trang viettat.html — "Viết tắt" cho iPhone (Safari) + Android, GIAO DIỆN BÁM APP ANDROID (viết lại 2026-11-17).
// Chạy: NODE_PATH=<nơi có jsdom> node tools/test-viettat-web.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'viettat.html'), 'utf8');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SNAPS = [
  { id: 'a1', nhom: 'Túi tiền/Cổ', abbr: 'ch', keyword: 'chào, hello', options: ['Dạ em chào {tên} ạ', 'Chào anh chị'], images: [], scope: 'team' },
  { id: 'a2', nhom: 'Túi tiền/Lắc', abbr: 'bh', keyword: 'bảo hành', options: ['Bảo hành 12 tháng.\nMiễn phí đổi size.'], images: [], scope: 'me' },
  { id: 'a3', nhom: '', abbr: 'gia', keyword: '', options: ['Giá từ 2tr ạ'], images: [], scope: 'team' },
  { id: 'a4', nhom: 'Ảnh', abbr: 'hinh', keyword: 'anh', options: ['Dạ em gửi hình ạ'], images: [{ id: 'IMGabcdefghijklmnopqrs', name: 'nhan.jpg' }], scope: 'team' },
  { id: 'a5', nhom: '', abbr: 'ghiam', keyword: '', options: ['Nghe ghi âm ạ'], images: [], audios: [{ id: 'AUDabcdefghijklmnopqrs', name: 'loi-chao.m4a' }], scope: 'team' },
  { id: 'a6', nhom: 'Túi tiền/Cổ', abbr: 'chao2', keyword: '', options: ['Chào buổi sáng'], images: [], scope: 'team' }];
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function mk(opts) {
  opts = opts || {};
  const urls = [], copied = [], shared = [], clip = [], downloads = [], plays = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/viettat.html', pretendToBeVisual: true, beforeParse(w) {
    if (opts.name) w.localStorage.setItem('vt_name', opts.name);
    if (opts.cache) w.localStorage.setItem('vt_cache', opts.cache);
    let nb = 0; w.URL.createObjectURL = () => 'blob:test' + (++nb);
    w.fetch = async (u) => { urls.push(u); if (opts.fail) throw new Error('mat mang');
      if (/action=vietTatImage/.test(u)) { if (opts.slowImg) await sleep(opts.slowImg); return { json: async () => (opts.imgFail ? { ok: false, error: 'Anh qua 3MB' } : { ok: true, base64: PNG, mimeType: 'image/png' }) }; }
      if (/action=vietTatAudio/.test(u)) return { json: async () => ({ ok: true, base64: PNG, mimeType: 'audio/mp4' }) };
      return { json: async () => ({ ok: true, snippets: SNAPS }) }; };
    w.ClipboardItem = function (o) { this.o = o; };
    if (opts.share !== false) { Object.defineProperty(w.navigator, 'share', { value: async (dt) => { shared.push(dt); }, configurable: true }); Object.defineProperty(w.navigator, 'canShare', { value: () => true, configurable: true }); }
    if (opts.noClip) { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('NotAllowedError'); } }, configurable: true }); w.document.execCommand = (c) => { copied.push('legacy'); return true; }; }
    else Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); }, write: async (items) => { clip.push(items); } }, configurable: true });
    w.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
    w.HTMLMediaElement.prototype.play = function () { plays.push(this.src); return Promise.resolve(); };
    w.HTMLMediaElement.prototype.pause = function () {}; w.scrollTo = function () {};
  } });
  return { w: dom.window, d: dom.window.document, urls, copied, shared, clip, downloads, plays };
}
(async () => {
  let { w, d, urls, copied } = mk();
  const $ = id => d.getElementById(id);
  ok($('setup').style.display === 'block' && $('top').style.display === 'none', 'chua co ten CS -> man nhap Ten CS');
  $('nm').value = 'Mai'; $('save').click(); await sleep(20);
  ok(urls.length === 1 && /action=vietTat&by=Mai$/.test(urls[0]) && w.localStorage.getItem('vt_name') === 'Mai', 'luu ten -> goi GAS action=vietTat&by=Mai, nho ten tren may');
  const sn = () => [...d.querySelectorAll('.sn')];
  ok(sn().length === 6 && /6 mục/.test($('cnt').textContent), 'mac dinh hien TAT CA muc (giong app Android): ' + sn().length);
  ok(/Sẵn sàng · 6 mục/.test($('stat-t').textContent) && /Mai/.test($('stat-s').textContent), 'the trang thai tren cung: san sang + so muc + ten CS');
  ok(sn()[0].querySelector('.ab') && sn()[0].querySelector('.tag') && /☁ CRM|👤/.test(sn()[0].querySelector('.tag').textContent) && /nội dung/.test(sn()[0].querySelector('.ft').textContent), 'the muc: viet tat dam + nhan CRM + "N noi dung"');
  ok(/👤 Của tôi/.test(sn().find(c => /bh/.test(c.textContent)).textContent), 'muc rieng hien nhan "Cua toi"');
  ok(/🖼 1/.test(sn().find(c => c.querySelector('.ab').textContent === 'hinh').textContent) && /🎤 1/.test(sn().find(c => c.querySelector('.ab').textContent === 'ghiam').textContent), 'the hien so hinh va so ghi am');
  const q = $('q'); const type = v => { q.value = v; q.dispatchEvent(new w.Event('input')); };
  type('ch'); ok(sn().map(c => c.querySelector('.ab').textContent).join() === 'ch,chao2', 'go "ch" -> dung viet tat "ch" len dau, roi chao2: ' + sn().map(c => c.querySelector('.ab').textContent));
  type('chao'); ok(sn().length === 3 && sn()[0].querySelector('.ab').textContent === 'chao2', 'tu khoa khong dau "chao" khop "chào" + ten tep ghi am loi-chao.m4a; viet tat bat dau bang chao len dau: ' + sn().map(c => c.querySelector('.ab').textContent));
  type('bao hanh'); ok(sn().length === 1 && /bh/.test(sn()[0].textContent), 'tim "bao hanh" khop tu khoa');
  type('mien phi'); ok(sn().length === 1, 'tim trong noi dung (>=3 ky tu, khong dau)');
  type('zzzz'); ok(/Không tìm thấy/.test($('list').textContent) && sn().length === 0, 'khong khop -> bao khong tim thay');
  ok($('qwrap').className === 'has', 'co chu -> hien nut xoa ✕ trong o tim'); $('qx').click(); ok(q.value === '' && sn().length === 6, 'bam ✕ xoa o tim');
  // bang chon noi dung
  type('ch'); $('cust').value = 'Nguyễn Thanh Huyền'; $('cust').dispatchEvent(new w.Event('input'));
  ok(/chào Huyền ạ/.test(sn()[0].textContent), 'xem truoc tren the da thay {tên} bang ten khach (chu cuoi: Huyền)');
  sn()[0].click();
  ok(!$('sheet').hidden && $('sh-ab').textContent === 'ch' && d.body.classList.contains('lock'), 'bam the -> mo bang chon, khoa cuon nen');
  const opts = () => [...d.querySelectorAll('#sh-body .opt')];
  ok(opts().length === 2 && /chào Huyền ạ/.test(opts()[0].textContent) && /Khách: Huyền/.test($('sh-sub').textContent), 'bang chon: 2 noi dung, thay bien, ghi ten khach');
  ok($('copy').disabled && /Chưa chọn/.test($('seln').textContent), 'chua chon gi -> nut Sao chep tat');
  opts()[0].click(); opts()[1].click();
  ok(opts().every(c => c.classList.contains('on')) && /Đã chọn 2/.test($('seln').textContent) && !$('copy').disabled, 'bam 1 lan = chon, chon nhieu (2), hien so luong');
  opts()[1].click(); ok(!opts()[1].classList.contains('on') && /Đã chọn 1/.test($('seln').textContent), 'bam lai = bo chon');
  opts()[1].click(); $('copy').click(); await sleep(10);
  ok(copied.length === 1 && copied[0] === 'Dạ em chào Huyền ạ\nChào anh chị', 'Sao chep: noi cac noi dung bang xuong dong, da thay bien: ' + JSON.stringify(copied[0]));
  ok(/Đã sao chép 2/.test($('toast').textContent), 'bao da sao chep 2 noi dung');
  ok(/Bỏ chọn/.test($('sh-all').textContent), 'da chon het -> nut doi thanh "Bo chon"');
  $('sh-all').click(); ok($('copy').disabled && /Chọn hết/.test($('sh-all').textContent), 'bam Bo chon -> Sao chep tat');
  $('sh-all').click(); ok(/Đã chọn 2/.test($('seln').textContent), 'bam Chon het -> chon du 2');
  $('clear').click(); ok($('sheet').hidden && !d.body.classList.contains('lock'), 'bam ✕ dong bang chon, mo khoa cuon');
  // chep nhanh
  type(''); const one = sn().find(c => c.querySelector('.ab').textContent === 'gia'); ok(one.querySelector('.qc'), 'muc chi co 1 noi dung chu -> co nut Chep nhanh');
  ok(!sn().find(c => c.querySelector('.ab').textContent === 'ch').querySelector('.qc'), 'muc nhieu noi dung -> khong co Chep nhanh');
  copied.length = 0; one.querySelector('.qc').click(); await sleep(10);
  ok(copied[0] === 'Giá từ 2tr ạ' && $('sheet').hidden, 'Chep nhanh: chep ngay, khong mo bang chon');
  // thu muc
  $('nhomBtn').click(); ok(!$('nhomPanel').hidden && !$('nback').hidden, 'dropdown thu muc mo ra + co lop nen de bam ra ngoai dong (iOS)');
  $('nback').click(); ok($('nhomPanel').hidden && $('nback').hidden, 'bam nen ngoai -> dong dropdown');
  $('nhomBtn').click();
  d.querySelector('#nhomPanel [data-pick="Túi tiền"]').click();
  ok(sn().length === 3 && /Túi tiền/.test($('nhomBtn').textContent), 'chon thu muc me "Tui tien" -> gom ca Co + Lac (3 muc): ' + sn().length);
  $('nhomBtn').click(); ok(d.querySelector('#nhomPanel [data-pick="Túi tiền/Lắc"]'), 'thu muc me dang chon -> con Lac hien trong cay');
  d.querySelector('#nhomPanel [data-pick="Túi tiền/Lắc"]').click();
  ok(sn().length === 1 && $('nhomBtn').textContent.indexOf('Lắc') >= 0, 'chon thu muc con -> loc dung 1 muc + nut hien ten');
  $('nhomBtn').click(); d.querySelector('#nhomPanel [data-pick="*chung"]').click(); ok(sn().length === 2, 'thu muc Chung: 2 muc (gia, ghiam)');
  // menu ⋮
  $('dots').click(); ok(!$('menu').hidden && !$('mback').hidden, 'bam ⋮ -> mo menu + lop nen'); $('mback').click(); ok($('menu').hidden, 'bam nen -> dong menu');
  $('dots').click(); const before = urls.length; $('reload').click(); await sleep(20); ok(urls.length === before + 1 && $('menu').hidden && /Đã cập nhật 6 mục/.test($('toast').textContent), 'menu ☁ Cap nhat tu CRM -> tai lai + bao so muc');
  $('dots').click(); $('chg').click(); ok($('setup').style.display === 'block', 'menu Doi ten CS -> ve man nhap ten');
  // mat mang: dung ban da luu tren may
  ({ w, d } = mk({ name: 'Mai' })); await sleep(20);
  const cache = w.localStorage.getItem('vt_cache'); ok(cache && JSON.parse(cache).length === 6, 'tai xong -> luu ban sao tren may');
  const M = mk({ name: 'Mai', fail: true, cache }); await sleep(20);
  const mq = M.d.getElementById('q'); mq.value = 'ch'; mq.dispatchEvent(new M.w.Event('input'));
  ok(M.d.querySelectorAll('.sn').length === 2, 'mat mang -> van dung ban da luu tren may (van tim duoc "ch")');
  // sao chep du phong (Safari chan clipboard.writeText) -> execCommand
  { const T = mk({ name: 'Mai', noClip: true }); await sleep(20); const D = T.d;
    D.querySelector('.sn .qc').click(); await sleep(20); ok(T.copied[0] === 'legacy', 'writeText bi chan (Safari) -> dung du phong textarea + execCommand'); }
  // ---- HINH ----
  {
    const T = mk({ name: 'Mai' }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input'));
    D.querySelector('.sn').click(); await sleep(30);
    const tile = () => D.querySelector('.tile');
    ok(tile() && tile().querySelector('img.pic') && /^blob:/.test(tile().querySelector('img.pic').src), 'o hinh: tai hinh tu GAS (vietTatImage) va hien chinh hinh');
    ok(T.urls.some(u => /action=vietTatImage&id=IMGabcdefghijklmnopqrs&by=Mai/.test(u)), 'goi vietTatImage dung id + ten CS');
    tile().click(); ok(tile().classList.contains('on'), 'bam 1 lan vao hinh = chon NGAY (khong cho 300ms nhu ban cu)');
    D.querySelector('[data-zoom]').click(); ok(D.getElementById('pv').style.display === 'flex' && /^blob:/.test(D.querySelector('#pv img').src), 'nut 🔍 phong to hinh'); D.getElementById('pv').click(); ok(D.getElementById('pv').style.display === 'none', 'bam de dong xem to');
    D.getElementById('copy').click(); await sleep(30);
    ok(T.clip.length === 1 && T.clip[0][0].o['image/png'], 'chi chon 1 hinh -> Sao chep dua hinh PNG vao bo nho tam');
    D.querySelector('#sh-body .opt').click();
    D.getElementById('share').click(); await sleep(20);
    ok(T.shared.length === 1 && T.shared[0].files.length === 1 && T.shared[0].files[0].name === 'nhan.png' && /Dạ em gửi hình/.test(T.shared[0].text), 'Chia se: gui kem chu + 1 file hinh qua Web Share (' + (T.shared[0] && T.shared[0].files[0].name) + ')');
    D.getElementById('copy').click(); await sleep(30);
    ok(T.copied.length === 1 && /Dạ em gửi hình/.test(T.copied[0]) && /Chia sẻ/.test(D.getElementById('toast').textContent), 'chu + hinh: Sao chep chi chep chu va nhac bam Chia se cho hinh');
  }
  { // SAFARI: bam Chia se khi hinh CHUA tai xong -> khong goi share sau await (Safari se tu choi); tai xong roi bao bam lai, lan sau mo ngay
    const T = mk({ name: 'Mai', slowImg: 60 }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input')); D.querySelector('.sn').click();
    D.querySelector('.tile').click(); D.getElementById('share').click();
    ok(T.shared.length === 0 && /Đang tải/.test(D.getElementById('toast').textContent), 'hinh chua tai xong -> bao dang tai, chua goi share');
    await sleep(120); ok(/bấm Chia sẻ lần nữa/.test(D.getElementById('toast').textContent), 'tai xong -> bao bam Chia se lan nua');
    D.getElementById('share').click(); ok(T.shared.length === 1, 'bam lai -> share chay NGAY trong cu cham (khong await)');
  }
  { // may khong ho tro chia se file -> chep chu + tai hinh ve
    const T = mk({ name: 'Mai', share: false }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input')); D.querySelector('.sn').click(); await sleep(30);
    D.querySelector('.tile').click(); D.querySelector('#sh-body .opt').click();
    D.getElementById('share').click(); await sleep(30);
    ok(T.copied.length === 1 && T.downloads.length === 1 && /nhan\.png/.test(T.downloads[0]), 'khong co Web Share: chep chu + tai hinh ve may');
  }
  { // loi tai hinh
    const T = mk({ name: 'Mai', imgFail: true }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input')); D.querySelector('.sn').click(); await sleep(30);
    ok(/Không tải được hình/.test(D.querySelector('.pic-wait').textContent), 'loi tai hinh -> bao ro tren o hinh');
  }
  { // GHI AM
    const T = mk({ name: 'Mai' }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'ghiam'; tq.dispatchEvent(new W.Event('input')); D.querySelector('.sn').click();
    const au = D.querySelector('#sh-body [data-play]'); ok(au && /loi-chao\.m4a/.test(au.parentNode.textContent), 'muc co ghi am -> hien dong 🎤 + nut Nghe');
    au.click(); await sleep(30);
    ok(T.urls.some(u => /action=vietTatAudio&id=AUDabcdefghijklmnopqrs&by=Mai/.test(u)) && T.plays.length === 1, 'bam Nghe -> tai vietTatAudio roi phat');
    au.parentNode.click(); D.getElementById('share').click(); await sleep(20);
    ok(T.shared.length === 1 && /^loi-chao\.m4a$/.test(T.shared[0].files[0].name), 'Chia se ghi am: gui file ghi am (' + (T.shared[0] && T.shared[0].files[0].name) + ')');
    D.getElementById('copy').click(); ok(/Chia sẻ/.test(D.getElementById('toast').textContent), 'chi chon ghi am -> Sao chep nhac bam Chia se');
  }
  console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
})();

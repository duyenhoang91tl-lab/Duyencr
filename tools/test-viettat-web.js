#!/usr/bin/env node
// Test (jsdom) trang viettat.html — "Viết tắt" cho iPhone + Android (trình duyệt). Chạy: NODE_PATH=<jsdom> node tools/test-viettat-web.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/node_modules/jsdom')); } catch (e2) { console.log('SKIP: chua cai jsdom'); process.exit(0); } }
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'viettat.html'), 'utf8');
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.error('FAIL: ' + m); } else console.log('ok  ', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SNAPS = [
  { id: 'a1', nhom: 'Túi tiền/Cổ', abbr: 'ch', keyword: 'chào, hello', options: ['Dạ em chào {tên} ạ', 'Chào anh chị'], images: [], scope: 'team' },
  { id: 'a2', nhom: 'Túi tiền/Lắc', abbr: 'bh', keyword: 'bảo hành', options: ['Bảo hành 12 tháng.\nMiễn phí đổi size.'], images: [], scope: 'me' },
  { id: 'a3', nhom: '', abbr: 'gia', keyword: '', options: ['Giá từ 2tr ạ'], images: [], scope: 'team' },
  { id: 'a4', nhom: 'Ảnh', abbr: 'hinh', keyword: 'anh', options: ['Dạ em gửi hình ạ'], images: [{ id: 'IMGabcdefghijklmnopqrs', name: 'nhan.jpg' }], scope: 'team' }];
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
function mk(opts) {
  opts = opts || {};
  const urls = [], copied = [], shared = [], clip = [], downloads = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/viettat.html', pretendToBeVisual: true, beforeParse(w) {
    if (opts.name) w.localStorage.setItem('vt_name', opts.name);
    if (opts.cache) w.localStorage.setItem('vt_cache', opts.cache);
    let nb = 0; w.URL.createObjectURL = () => 'blob:test' + (++nb);
    w.fetch = async (u) => { urls.push(u); if (opts.fail) throw new Error('mat mang');
      if (/action=vietTatImage/.test(u)) return { json: async () => (opts.imgFail ? { ok: false, error: 'Anh qua 3MB' } : { ok: true, base64: PNG, mimeType: 'image/png' }) };
      return { json: async () => ({ ok: true, snippets: SNAPS }) }; };
    w.ClipboardItem = function (o) { this.o = o; };
    if (opts.share !== false) { Object.defineProperty(w.navigator, 'share', { value: async (dt) => { shared.push(dt); }, configurable: true }); Object.defineProperty(w.navigator, 'canShare', { value: () => true, configurable: true }); }
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); }, write: async (items) => { clip.push(items); } }, configurable: true });
    w.HTMLAnchorElement.prototype.click = function () { downloads.push(this.download); };
  } });
  return { w: dom.window, d: dom.window.document, urls, copied, shared, clip, downloads };
}
(async () => {
  let { w, d, urls, copied } = mk();
  ok(d.getElementById('setup').style.display === 'block' && d.getElementById('top').style.display === 'none', 'chua co ten CS -> man nhap Ten CS');
  d.getElementById('nm').value = 'Mai'; d.getElementById('save').click(); await sleep(20);
  ok(urls.length === 1 && /action=vietTat&by=Mai$/.test(urls[0]) && w.localStorage.getItem('vt_name') === 'Mai', 'luu ten -> goi GAS action=vietTat&by=Mai, nho ten tren may');
  ok(d.querySelectorAll('.chip').length === 4, 'chua go gi -> hien chip thu muc (4 thu muc)');
  const q = d.getElementById('q'); const type = v => { q.value = v; q.dispatchEvent(new w.Event('input')); };
  type('ch'); ok(d.querySelectorAll('.card').length === 2 && /ch/.test(d.querySelector('.grp').textContent), 'go "ch" -> 2 lua chon cua muc ch');
  type('chao'); ok(d.querySelectorAll('.card').length === 2, 'tu khoa khong dau "chao" khop "chào"');
  type('bao hanh'); ok(d.querySelectorAll('.card').length === 1 && /của tôi/.test(d.querySelector('.grp').textContent), 'tim "bao hanh" khop tu khoa + hien muc cua toi');
  type('mien phi'); ok(d.querySelectorAll('.card').length === 1, 'tim trong noi dung (>=3 ky tu, khong dau)');
  type('zzzz'); ok(/Không có kết quả/.test(d.getElementById('list').textContent), 'khong khop -> bao khong co ket qua');
  type('ch');
  const cards = () => [...d.querySelectorAll('.card')];
  d.getElementById('cust').value = 'Nguyễn Thanh Huyền'; d.getElementById('cust').dispatchEvent(new w.Event('input'));
  ok(/chào Huyền ạ/.test(cards()[0].textContent), 'bien {tên} thay bang ten khach (chữ cuối: Huyền)');
  cards()[0].click(); cards()[1].click();
  ok(cards().every(c => c.classList.contains('on')) && /Sao chép \(2\)/.test(d.getElementById('copy').textContent) && !d.getElementById('copy').disabled, 'bam 1 lan = chon, chon duoc nhieu (2), nut hien so luong');
  cards()[1].click(); ok(!cards()[1].classList.contains('on') && /\(1\)/.test(d.getElementById('copy').textContent), 'bam lai = bo chon');
  cards()[1].click(); d.getElementById('copy').click(); await sleep(10);
  ok(copied.length === 1 && copied[0] === 'Dạ em chào Huyền ạ\nChào anh chị', 'Sao chep: noi cac noi dung da chon bang xuong dong, da thay bien: ' + JSON.stringify(copied[0]));
  ok(/Đã sao chép 2/.test(d.getElementById('toast').textContent), 'bao da sao chep 2 noi dung');
  d.getElementById('clear').click(); ok(d.getElementById('copy').disabled, 'Bo chon -> nut Sao chep tat');
  // chon thu muc bang chip
  type(''); d.querySelector('.chip[data-nhom="Túi tiền/Lắc"]').click(); ok(d.querySelectorAll('.card').length === 1 && d.getElementById('nhom').value === 'Túi tiền/Lắc', 'bam chip thu muc -> loc theo thu muc');
  // mat mang: dung ban da luu tren may
  ({ w, d } = mk({ name: 'Mai' })); await sleep(20);
  const cache = w.localStorage.getItem('vt_cache'); ok(cache && JSON.parse(cache).length === 4, 'tai xong -> luu ban sao tren may');
  const M = mk({ name: 'Mai', fail: true, cache }); await sleep(20);
  const mq = M.d.getElementById('q'); mq.value = 'ch'; mq.dispatchEvent(new M.w.Event('input'));
  ok(M.d.querySelectorAll('.card').length === 2, 'mat mang -> van dung ban da luu tren may (van tim duoc "ch")');
  // ---- HINH (buoc B) ----
  {
    const T = mk({ name: 'Mai' }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input')); await sleep(30);
    const ic = () => D.querySelector('.card.img');
    ok(ic() && ic().querySelector('img.pic') && /^blob:/.test(ic().querySelector('img.pic').src), 'the hinh: tai hinh tu GAS (vietTatImage) va hien chinh hinh');
    ok(T.urls.some(u => /action=vietTatImage&id=IMGabcdefghijklmnopqrs&by=Mai/.test(u)), 'goi vietTatImage dung id + ten CS');
    ok(!/Hình ảnh/.test(ic().textContent) && !/Hình ảnh/.test(D.getElementById('list').textContent), 'KHONG co chu "Hinh anh" tren the hinh');
    ic().click(); await sleep(80); ok(!ic().classList.contains('on'), 'bam 1 lan vao hinh: cho 300ms de biet co phai bam dup khong (chua chon ngay)');
    await sleep(300); ok(ic().classList.contains('on') && !ic().classList.contains('zoom'), 'bam 1 lan = chon, khong phong');
    ic().click(); ic().click(); await sleep(20);
    ok(ic().classList.contains('zoom') && ic().classList.contains('on'), 'bam dup = phong full, KHONG doi trang thai chon');
    await sleep(350); ok(ic().classList.contains('on'), 'sau bam dup van con chon (khong bi bam don xen vao)');
    ic().click(); ic().click(); await sleep(20); ok(!ic().classList.contains('zoom'), 'bam dup lan nua = thu nho');
    // sao chep 1 hinh
    D.getElementById('copy').click(); await sleep(30);
    ok(T.clip.length === 1 && T.clip[0][0].o['image/png'], 'chi chon 1 hinh -> Sao chep dua hinh PNG vao bo nho tam');
    // chia se chu + hinh
    const rows = [...D.querySelectorAll('.card:not(.img)')]; rows[0].click(); await sleep(10);
    D.getElementById('share').click(); await sleep(50);
    ok(T.shared.length === 1 && T.shared[0].files.length === 1 && T.shared[0].files[0].name === 'nhan.png' && /Dạ em gửi hình/.test(T.shared[0].text), 'Chia se: gui kem chu + 1 file hinh qua Web Share (' + (T.shared[0] && T.shared[0].files[0].name) + ')');
    D.getElementById('copy').click(); await sleep(30);
    ok(T.copied.length === 1 && /Dạ em gửi hình/.test(T.copied[0]) && /Chia sẻ/.test(D.getElementById('toast').textContent), 'chu + hinh: Sao chep chi chep chu va nhac bam Chia se cho hinh');
  }
  { // may khong ho tro chia se file -> chep chu + tai hinh ve
    const T = mk({ name: 'Mai', share: false }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input')); await sleep(30);
    D.querySelector('.card.img').click(); await sleep(350); D.querySelector('.card:not(.img)').click();
    D.getElementById('share').click(); await sleep(50);
    ok(T.copied.length === 1 && T.downloads.length === 1 && /nhan\.png/.test(T.downloads[0]), 'khong co Web Share: chep chu + tai hinh ve may');
  }
  { // loi tai hinh
    const T = mk({ name: 'Mai', imgFail: true }); await sleep(20); const D = T.d, W = T.w;
    const tq = D.getElementById('q'); tq.value = 'hinh'; tq.dispatchEvent(new W.Event('input')); await sleep(30);
    ok(/Không tải được hình/.test(D.querySelector('.pic-wait').textContent), 'loi tai hinh -> bao ro tren the hinh');
  }
  console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
})();

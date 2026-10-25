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
  { id: 'a3', nhom: '', abbr: 'gia', keyword: '', options: ['Giá từ 2tr ạ'], images: [], scope: 'team' }];
function mk(opts) {
  opts = opts || {};
  const urls = [], copied = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/viettat.html', pretendToBeVisual: true, beforeParse(w) {
    if (opts.name) w.localStorage.setItem('vt_name', opts.name);
    if (opts.cache) w.localStorage.setItem('vt_cache', opts.cache);
    w.fetch = async (u) => { urls.push(u); if (opts.fail) throw new Error('mat mang'); return { json: async () => ({ ok: true, snippets: SNAPS }) }; };
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
  } });
  return { w: dom.window, d: dom.window.document, urls, copied };
}
(async () => {
  let { w, d, urls, copied } = mk();
  ok(d.getElementById('setup').style.display === 'block' && d.getElementById('top').style.display === 'none', 'chua co ten CS -> man nhap Ten CS');
  d.getElementById('nm').value = 'Mai'; d.getElementById('save').click(); await sleep(20);
  ok(urls.length === 1 && /action=vietTat&by=Mai$/.test(urls[0]) && w.localStorage.getItem('vt_name') === 'Mai', 'luu ten -> goi GAS action=vietTat&by=Mai, nho ten tren may');
  ok(d.querySelectorAll('.chip').length === 3, 'chua go gi -> hien chip thu muc (3 thu muc)');
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
  const cache = w.localStorage.getItem('vt_cache'); ok(cache && JSON.parse(cache).length === 3, 'tai xong -> luu ban sao tren may');
  const M = mk({ name: 'Mai', fail: true, cache }); await sleep(20);
  const mq = M.d.getElementById('q'); mq.value = 'ch'; mq.dispatchEvent(new M.w.Event('input'));
  ok(M.d.querySelectorAll('.card').length === 2, 'mat mang -> van dung ban da luu tren may (van tim duoc "ch")');
  console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);
})();

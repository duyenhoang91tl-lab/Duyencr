// Test: hộp chọn Thư viện trong chat (MLIB.pick) có nút ⬆ Tải lên / 🔴 Ghi âm và tải lên xong thì mục mới hiện ngay trong hộp.
// Cần jsdom (không có thì tự bỏ qua). Chạy: node tools/test-medialib-pick-upload.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('bỏ qua: không có jsdom'); process.exit(0); }
const fs = require('fs');
const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window; let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const posts = [];
w.gsUrl = 'https://gas.test/exec'; w.toast = () => {}; w.confirm = () => true;
w.fetch = async (u, o) => {
  if (o && o.body) { const d = JSON.parse(o.body); posts.push(d); return { json: async () => ({ ok: true, item: { id: 'n' + posts.length, type: d.type, name: d.name, tags: '', text: '', fileId: 'F' + posts.length, url: 'https://drive/' + posts.length, size: 10, by: 'me' } }) }; }
  return { json: async () => ({ ok: true, items: [], me: 'me', admin: false }) };
};
w.eval(fs.readFileSync(__dirname + '/../js/48-fn-medialib.js', 'utf8'));
(async () => {
  let picked = null;
  await w.MLIB.pick('image', it => { picked = it; });
  let box = w.document.getElementById('ml-pick');
  ok(box && /Tải lên/.test(box.innerHTML) && box.querySelector('#ml-pfile'), 'Tab Ảnh trong hộp chọn có nút ⬆ Tải lên + ô chọn tệp');
  ok(box.querySelector('#ml-pfile').accept === 'image/*', 'Ô chọn tệp chỉ nhận ảnh');
  ok(/bấm ⬆ Tải lên để thêm ảnh/.test(box.innerHTML), 'Thư viện trống: gợi ý bấm Tải lên (không còn chỉ chỉ sang menu Social)');
  ok(!/Ghi âm<\/button><button class="btn sm">/.test(box.innerHTML) && !/MLIB.recStart/.test(box.innerHTML), 'Tab Ảnh KHÔNG có nút ghi âm');
  await w.MLIB.upload([{ name: 'a.png', type: 'image/png', size: 100, __b: 1 }].map(f => Object.assign(new w.File(['x'], 'a.png', { type: 'image/png' }), {})));
  ok(posts.length === 1 && posts[0].action === 'mlibUpload' && posts[0].type === 'image', 'Tải lên trong hộp chọn gửi mlibUpload type=image');
  box = w.document.getElementById('ml-pick');
  ok(box && /a\.png/.test(box.innerHTML) && !w.document.getElementById('mlib-wrap'), 'Ảnh vừa tải hiện ngay trong hộp chọn (hộp không bị đóng)');
  w.MLIB.pickTab('audio');
  box = w.document.getElementById('ml-pick');
  ok(/MLIB.recStart/.test(box.innerHTML) && box.querySelector('#ml-pfile').accept === 'audio/*', 'Tab Ghi âm: có 🔴 Ghi âm + ô chọn tệp chỉ nhận audio');
  await w.MLIB.upload([new w.File(['y'], 'giong.mp3', { type: 'audio/mpeg' })]);
  ok(posts[1] && posts[1].type === 'audio', 'Tải file ghi âm gửi type=audio (theo tab đang mở, không theo tab Social)');
  w.MLIB.pickTab('template');
  box = w.document.getElementById('ml-pick');
  ok(!box.querySelector('#ml-pfile'), 'Tab Mẫu tin: không có nút Tải lên');
  w.MLIB.pickTab('audio'); box = w.document.getElementById('ml-pick');
  w.MLIB._pickId(box.querySelector('.ml-card').getAttribute('data-id'));
  ok(picked && picked.name === 'giong.mp3' && !w.document.getElementById('ml-pick'), 'Bấm một mục vẫn chọn + đóng hộp như cũ');
  // Bước 2026-11-13b: Từ Google Drive + Mẫu tin mới ngay trong hộp chọn
  w.prompt = () => 'https://drive.google.com/file/d/ABC123/view';
  await w.MLIB.pick('image', () => {}); box = w.document.getElementById('ml-pick');
  ok(/MLIB.fromDrive/.test(box.innerHTML), 'Tab Ảnh/Ghi âm trong hộp chọn có 📁 Từ Google Drive');
  await w.MLIB.fromDrive();
  ok(posts[2] && posts[2].action === 'mlibAddDrive' && posts[2].type === 'image' && !!w.document.getElementById('ml-pick'), 'Từ Drive gửi mlibAddDrive đúng loại theo tab đang mở, hộp vẫn mở');
  w.MLIB.pickTab('template'); box = w.document.getElementById('ml-pick');
  ok(/MLIB.editTpl/.test(box.innerHTML) && !/MLIB.fromDrive/.test(box.innerHTML), 'Tab Mẫu tin có + Mẫu tin mới (không có Từ Drive)');
  w.MLIB.editTpl(''); box = w.document.getElementById('ml-pick');
  ok(box.querySelector('#mt-name') && box.querySelector('#mt-text') && !w.document.getElementById('mlib-wrap'), 'Bấm + Mẫu tin mới: form hiện NGAY trong hộp chọn');
  box.querySelector('#mt-name').value = 'Chào khách'; box.querySelector('#mt-text').value = 'Dạ chào anh/chị';
  await w.MLIB.saveTpl();
  box = w.document.getElementById('ml-pick');
  ok(posts[3] && posts[3].action === 'mlibSaveTpl' && posts[3].name === 'Chào khách' && !box.querySelector('#mt-name'), 'Lưu mẫu tin: gửi mlibSaveTpl, đóng form, hộp vẫn mở');
  console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
})();

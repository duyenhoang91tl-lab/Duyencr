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
  // Bước 2: dán ảnh Ctrl+V vào khung chat
  const mk = id => { const t = w.document.createElement('textarea'); t.id = id; w.document.body.appendChild(t); return t; };
  const paste = (t, items) => { const ev = new w.Event('paste', { bubbles: true, cancelable: true }); ev.clipboardData = { items }; t.dispatchEvent(ev); return ev; };
  const tc = mk('tc-input'), pk = mk('pkc-input'), other = mk('some-other');
  const before = posts.length;
  let ev = paste(tc, [{ kind: 'file', type: 'image/png', getAsFile: () => new w.File(['img'], 'shot.png', { type: 'image/png' }) }]);
  ok(ev.defaultPrevented, 'Dán ảnh vào chat nội bộ: chặn dán mặc định');
  await new Promise(r => setTimeout(r, 100));
  ok(posts.length === before + 1 && posts[before].action === 'mlibUpload' && posts[before].type === 'image', 'Ảnh dán được tải lên Thư viện (mlibUpload image)');
  ok(/^\[\[ml:image\|https:\/\/drive\/\d+\|shot\.png\]\]$/.test(tc.value), 'Chat nội bộ: chèn dấu hiệu [[ml:image|URL|tên]] — ' + tc.value);
  ev = paste(pk, [{ kind: 'file', type: 'image/png', getAsFile: () => new w.File(['img'], 'b.png', { type: 'image/png' }) }]);
  await new Promise(r => setTimeout(r, 100));
  ok(/^b\.png: https:\/\/drive\/\d+$/.test(pk.value), 'Pancake: chèn dạng "tên: link" — ' + pk.value);
  ev = paste(tc, [{ kind: 'string', type: 'text/plain', getAsFile: () => null }]);
  ok(!ev.defaultPrevented, 'Dán CHỮ: không bị chặn, dán bình thường');
  const n2 = posts.length;
  ev = paste(other, [{ kind: 'file', type: 'image/png', getAsFile: () => new w.File(['i'], 'c.png', { type: 'image/png' }) }]);
  await new Promise(r => setTimeout(r, 50));
  ok(!ev.defaultPrevented && posts.length === n2, 'Ô nhập khác (không phải khung chat): không can thiệp');
  // Bước A: dán NHIỀU ảnh một lúc
  const tc2 = mk('sc-input'); const nb = posts.length;
  const im = n => ({ kind: 'file', type: 'image/png', getAsFile: () => new w.File(['i' + n], 'm' + n + '.png', { type: 'image/png' }) });
  paste(tc2, [im(1), im(2), im(3)]);
  await new Promise(r => setTimeout(r, 300));
  ok(posts.length === nb + 3, 'Dán 3 ảnh: tải lên đủ 3 lần (có ' + (posts.length - nb) + ')');
  const lines = tc2.value.split('\n');
  ok(lines.length === 3 && /^m1\.png: /.test(lines[0]) && /^m2\.png: /.test(lines[1]) && /^m3\.png: /.test(lines[2]), 'Chèn 3 dòng đúng thứ tự dán — ' + JSON.stringify(lines));
  const many = []; for (let k = 0; k < 15; k++) many.push(im(100 + k));
  const nb2 = posts.length; paste(mk('tc-input2'), []); paste(tc2, many);
  await new Promise(r => setTimeout(r, 600));
  ok(posts.length - nb2 === 10, 'Dán 15 ảnh: chỉ nhận tối đa 10 (có ' + (posts.length - nb2) + ')');
  // Bước B: kéo-thả tệp ảnh / ghi âm vào khung chat
  const drop = (t, files, type) => { const ev = new w.Event(type || 'drop', { bubbles: true, cancelable: true }); ev.dataTransfer = { files, items: files.map(f => ({ kind: 'file', type: f.type })) }; t.dispatchEvent(ev); return ev; };
  w.document.querySelectorAll('#tc-input').forEach(e => e.remove()); const tcx = mk('tc-input');
  const nb3 = posts.length;
  ok(drop(tcx, [new w.File(['a'], 'x.png', { type: 'image/png' })], 'dragover').defaultPrevented, 'Kéo ảnh qua khung chat: cho phép thả (dragover bị chặn mặc định)');
  ok(!drop(tcx, [new w.File(['a'], 'x.pdf', { type: 'application/pdf' })], 'dragover').defaultPrevented, 'Kéo file PDF: không can thiệp');
  const ev3 = drop(tcx, [new w.File(['a'], 'x.png', { type: 'image/png' }), new w.File(['b'], 'giong.mp3', { type: 'audio/mpeg' }), new w.File(['c'], 'a.pdf', { type: 'application/pdf' })]);
  await new Promise(r => setTimeout(r, 300));
  ok(ev3.defaultPrevented && posts.length === nb3 + 2 && posts[nb3].type === 'image' && posts[nb3 + 1].type === 'audio', 'Thả ảnh + mp3 + pdf: tải 2 (ảnh, ghi âm), bỏ qua pdf');
  const ls = tcx.value.split('\n');
  ok(ls.length === 2 && /^\[\[ml:image\|/.test(ls[0]) && /^\[\[ml:audio\|/.test(ls[1]), 'Chat nội bộ: chèn [[ml:image|..]] rồi [[ml:audio|..]] — ' + JSON.stringify(ls));
  const nb4 = posts.length; const ev4 = drop(tcx, [new w.File(['p'], 'a.pdf', { type: 'application/pdf' })]);
  await new Promise(r => setTimeout(r, 50));
  ok(!ev4.defaultPrevented && posts.length === nb4, 'Thả chỉ file không hỗ trợ: không chặn, không tải');
  const ev5 = drop(other, [new w.File(['a'], 'x.png', { type: 'image/png' })]);
  ok(!ev5.defaultPrevented, 'Thả vào ô khác (không phải khung chat): không can thiệp');
  console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);
})();

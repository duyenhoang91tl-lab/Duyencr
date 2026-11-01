// So sánh bản gốc (index.html + js/ + css/) với bản nén (dist/) khi nạp trong jsdom:
// cùng tập biến/hàm toàn cục (kèm số tham số), cùng danh sách lỗi chạy. Chạy: node tools/build-dist.js && node tools/test-dist-equivalence.js
// Cần: npm i --no-save jsdom@24 terser@5 clean-css@5
const { JSDOM, VirtualConsole } = require('jsdom'), path = require('path');
const root = path.join(__dirname, '..');
function boot(dir) {
  return new Promise(res => {
    const errs = [], vc = new VirtualConsole();
    vc.on('jsdomError', e => errs.push(String((e.detail && e.detail.message) || e.message).slice(0, 160)));
    JSDOM.fromFile(path.join(dir, 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) { try { w.localStorage.clear(); } catch (e) {} } }).then(dom => {
      setTimeout(() => {
        const w = dom.window, g = {};
        for (const k of Object.getOwnPropertyNames(w)) { try { const v = w[k]; g[k] = typeof v === 'function' ? 'f' + v.length : typeof v; } catch (e) { g[k] = 'x'; } }
        const splash = !!w.document.getElementById('boot-splash');
        w.close(); res({ g, errs: errs.filter(m => !/Could not load script|xlsx|ENOTFOUND|EAI_AGAIN|fetch/i.test(m)).sort(), splash });
      }, 4000);
    });
  });
}
(async () => {
  const a = await boot(root), b = await boot(path.join(root, 'dist'));
  const ka = Object.keys(a.g), kb = Object.keys(b.g);
  const miss = ka.filter(k => !(k in b.g)), extra = kb.filter(k => !(k in a.g)), diff = ka.filter(k => k in b.g && a.g[k] !== b.g[k]);
  console.log('toàn cục gốc/dist:', ka.length, kb.length, '| thiếu:', miss.length, '| thừa:', extra.length, '| khác kiểu/số tham số:', diff.length);
  // Lỗi cú pháp toàn cục (vd 'Identifier ... has already been declared' do 2 file js khai báo trùng tên let/function) làm CẢ FILE js không chạy được —
  // các lỗi khác (jsdom thiếu API) là bình thường nên chỉ chặn đúng loại này.
  const syn = a.errs.concat(b.errs).filter(m => /SyntaxError|has already been declared/i.test(m));
  if (syn.length) { console.error('LỖI CÚ PHÁP khi nạp trang:', syn.join(' | ')); process.exit(1); }
  console.log('lỗi chạy gốc:', a.errs.length, '| dist:', b.errs.length, '| splash còn:', a.splash, b.splash);
  if (miss.length) console.log('THIẾU', miss.slice(0, 20)); if (diff.length) console.log('KHÁC', diff.slice(0, 20).map(k => k + ' ' + a.g[k] + '->' + b.g[k]));
  if (JSON.stringify(a.errs) !== JSON.stringify(b.errs)) { console.log('LỖI KHÁC\n gốc:', a.errs, '\n dist:', b.errs); process.exit(1); }
  if (miss.length || extra.length || diff.length) process.exit(1);
  console.log('OK: dist tương đương bản gốc');
})();

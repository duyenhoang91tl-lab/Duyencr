// Build bản phát hành NÉN của web CRM -> thư mục dist/ (dùng cho Cloudflare, xem cloudflare-web/README-vi.md).
// Nguồn (index.html, js/, css/) KHÔNG bị sửa. Chỉ: (1) nén từng file js/*.js bằng terser, (2) nén từng file css/*.css,
// (3) chép index.html nguyên văn. Giữ nguyên TÊN file và THỨ TỰ thẻ <script> => hành vi y hệt bản gốc.
// KHÔNG gộp nhiều file thành 1: các file đang là <script> riêng, 1 lỗi chạy ở file trước không được làm mất file sau
// (gộp sẽ đổi hành vi này); Cloudflare dùng HTTP/2 nên nhiều file nhỏ vẫn tải song song, và tự nén Brotli/gzip khi gửi.
// Dùng: npm i --no-save terser@5 clean-css@5 && node tools/build-dist.js
const fs = require('fs'), path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['js', 'css']) fs.mkdirSync(path.join(out, d), { recursive: true });
(async () => {
  let before = 0, after = 0;
  for (const f of fs.readdirSync(path.join(root, 'js')).filter(n => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    // toplevel=false (mặc định): KHÔNG đổi tên/xoá biến-hàm cấp cao vì index.html (onclick="...") và các file khác gọi theo tên toàn cục.
    // keep_fnames: giữ fn.name (vài chỗ so sánh/ghi log theo tên).
    const r = await minify(src, { compress: { passes: 1 }, mangle: { keep_fnames: true }, keep_fnames: true, format: { comments: false, ascii_only: false } });
    if (r.error || !r.code) throw new Error('terser lỗi ở js/' + f);
    fs.writeFileSync(path.join(out, 'js', f), r.code);
    before += Buffer.byteLength(src); after += Buffer.byteLength(r.code);
  }
  for (const f of fs.readdirSync(path.join(root, 'css')).filter(n => n.endsWith('.css'))) {
    const src = fs.readFileSync(path.join(root, 'css', f), 'utf8');
    const r = new CleanCSS({ level: 1 }).minify(src);
    if (r.errors.length) throw new Error('clean-css lỗi ở css/' + f + ': ' + r.errors.join('; '));
    fs.writeFileSync(path.join(out, 'css', f), r.styles);
    before += Buffer.byteLength(src); after += Buffer.byteLength(r.styles);
  }
  fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
  fs.writeFileSync(path.join(out, '.assetsignore'), '');
  console.log('dist OK: js+css ' + (before / 1024 | 0) + ' KB -> ' + (after / 1024 | 0) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });

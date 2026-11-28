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
// Lớp CHẾ ĐỘ TỐI tự sinh (css/99-dark-auto.css): luôn sinh lại trước khi nén để bản phát hành không bao giờ dùng bản lỗi thời nếu ai đó quên chạy tools/gen-dark-theme.js.
require('./gen-dark-theme.js').write();
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
  // ?v= TỰ SINH THEO NỘI DUNG (28/11/2026): mỗi thẻ <script src="js/…">/<link href="css/…"> trong dist/index.html nhận ?v=<10 ký tự đầu sha256 của file NÉN trong dist>.
  // Nguyên nhân gốc cần làm: ?v= trong nguồn bump TAY nên có file sửa mà quên bump → không dám bật cache dài (docs/crm-kb/15). Nay mã băm đổi khi và chỉ khi nội dung đổi
  // → an toàn đặt Cache-Control immutable cho /js/* và /css/* (dist/_headers): lần mở sau trình duyệt lấy thẳng từ đĩa, KHÔNG hỏi lại máy chủ (trước: ~160 yêu cầu kiểm tra lại mỗi lần).
  // index.html, sw.js, manifest KHÔNG immutable (giữ mặc định max-age=0, must-revalidate) để bản mới luôn được nhận. Nguồn index.html không bị sửa.
  const crypto = require('crypto');
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), stamped = 0, missing = [];
  html = html.replace(/\b(src|href)="((?:js|css)\/[^"?#]+)(?:\?[^"#]*)?"/g, (m, attr, rel) => {
    const fp = path.join(out, rel);
    if (!fs.existsSync(fp)) { missing.push(rel); return m; }
    stamped++;
    return attr + '="' + rel + '?v=' + crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex').slice(0, 10) + '"';
  });
  if (missing.length) console.warn('CANH BAO: thẻ trỏ tới file không có trong dist (giữ nguyên ?v= cũ): ' + missing.join(', '));
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, '_headers'), '/js/*\n  Cache-Control: public, max-age=31536000, immutable\n/css/*\n  Cache-Control: public, max-age=31536000, immutable\n');
  console.log('dist: đóng dấu ?v= theo nội dung cho ' + stamped + ' thẻ, ghi dist/_headers (immutable cho /js/* và /css/*)');
// PWA (cai nhu ung dung tren dien thoai): manifest + service worker + icon nam o goc, copy nguyen vao dist
for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
}
// data/*.json (danh mục Tỉnh/Quận/Phường-Xã cũ + mới cho màn Tạo đơn, tải lười bằng fetch khi cần — KHÔNG nằm trong js/ nên không tính vào ngân sách trang): copy nguyên
if (fs.existsSync(path.join(root, 'data'))) {
  fs.mkdirSync(path.join(out, 'data'), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'data'))) if (/\.json$/.test(f)) fs.copyFileSync(path.join(root, 'data', f), path.join(out, 'data', f));
}
  fs.writeFileSync(path.join(out, '.assetsignore'), '');
  console.log('dist OK: js+css ' + (before / 1024 | 0) + ' KB -> ' + (after / 1024 | 0) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });

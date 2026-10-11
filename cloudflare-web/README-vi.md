# Web CRM bản nén trên Cloudflare

**Mục đích:** mở trang nhanh hơn. Mỗi lần push `main` đổi `index.html`/`js/`/`css/`, GitHub Actions (`deploy-web.yml`) tự:
1. Nén từng file `js/*.js` (terser, KHÔNG đổi tên hàm/biến toàn cục) và `css/*.css` → thư mục `dist/` (~1,6 MB → ~1,1 MB; sau gzip ~474 KB → ~324 KB).
2. Kiểm tra: cú pháp từng file nén + `tools/test-dist-equivalence.js` (nạp bản gốc và bản nén trong jsdom, so tập biến/hàm toàn cục và danh sách lỗi — phải y hệt).
3. Deploy `dist/` lên Cloudflare Worker `duyen-crm-web` (Static Assets: tự nén Brotli, CDN, HTTP/2-3, trình duyệt hỏi lại ETag nên không bị kẹt bản cũ ~10 phút như GitHub Pages).

**Không gộp nhiều file thành 1** (có chủ đích): mỗi file đang là `<script>` riêng; gộp thì 1 lỗi chạy ở file trước làm mất toàn bộ file sau. Thứ tự thẻ `<script>` giữ nguyên.

## Cài 1 lần
- Dùng chung 2 secret đã có cho Worker cache: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (token cần quyền sửa Workers). Chưa có secret → workflow vẫn nén + kiểm thử nhưng bỏ qua deploy (không báo đỏ).
- Chạy lần đầu: GitHub → Actions → "Deploy web nén lên Cloudflare" → Run workflow. URL web mới in ở bước deploy: `https://duyen-crm-web.<tài-khoản>.workers.dev`.
- Đổi tên Worker: Variable `CF_WEB_NAME` trong repo.

## Lưu ý khi chuyển sang URL mới
- Khác tên miền với GitHub Pages ⇒ `localStorage` không dùng chung: **mọi người phải đăng nhập lại 1 lần** trên URL mới (địa chỉ GAS đã cố định trong code nên không phải nhập lại).
- GitHub Pages cũ vẫn chạy song song, dùng làm đường lùi. Khi ổn định mới báo mọi người đổi bookmark.
- Muốn tên miền riêng: gắn Custom Domain cho Worker trên Cloudflare Dashboard.
- Build thủ công: `npm i --no-save terser@5 clean-css@5 jsdom@24 && node tools/build-dist.js && node tools/test-dist-equivalence.js` (`dist/` không commit).

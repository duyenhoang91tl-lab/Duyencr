# 15 — Tốc độ tải & ổn định web CRM (đo 26/11/2026, "chuyên nghiệp hóa" bước 3)

## Số đo (sau `tools/build-dist.js`)
JS 119 file · **691 KB gzip** (2144 KB sau nén) · CSS 34 file · 55 KB gzip. Nặng nhất (gzip): js/11 44 KB, js/12 25, js/13 25, js/07 22, js/14 22. 117+ thẻ script đồng bộ. Đã có sẵn: nén (terser/clean-css) + test tương đương `test-dist-equivalence`, Cloudflare Static Assets, `sw.js` ưu tiên mạng (4 giây rồi dùng bản lưu), preconnect fonts/cdnjs.
Công cụ: `node tools/measure-load.js [--check]` (cần build trước). CI chạy `--check` với NGÂN SÁCH js ≤ 780 KB, css ≤ 70 KB, 1 file ≤ 60 KB gzip (đặt ~13% trên số đo); vượt thì KHÔNG deploy. Muốn nới → sửa `BUDGET` + ghi lý do vào HANDOFF.

## Hai ngân sách (đều chạy trong CI deploy-web)
- `tools/test-budget.js` (có từ 15/11): đo NGUỒN — tổng js/css, số `<script src>`, số `!important`. 26/11 phát hiện nó **đã đỏ 3 chỗ từ lâu và không nằm trong CI** → đặt lại trần ≈ +6% trên số đo (js 3,3 MB, gzip 1,05 MB, 119 thẻ → trần 3,5 MB / 1,11 MB / 126 thẻ) và đưa vào CI.
- `tools/measure-load.js --check` (mới): đo BẢN NÉN thật người dùng tải (js 691 KB gz…). Muốn nới trần phải sửa số ở file + ghi lý do vào HANDOFF.

## Đã cân nhắc và CHỦ Ý KHÔNG làm (đừng thử lại nếu chưa có số đo trình duyệt thật)
- **Gộp (bundle) nhiều file thành 1**: test jsdom cho thấy lúc nạp đã có **8 lỗi chạy ở cấp file** (bản gốc và bản nén đều 8). Mỗi `<script>` riêng nên lỗi 1 file chỉ dừng file đó; gộp lại thì lỗi sẽ cắt luôn các file phía sau ⇒ hỏng dây chuyền.
- **`defer`/`async` hàng loạt**: 6 khối `<script>` viết thẳng trong index.html phụ thuộc thứ tự nạp với các file js.
- **Tải trễ js/13 (và js/11, js/12, js/14)**: js/13 có 110 hàm được **14 file khác** tham chiếu (`_srPctStr`, `_hFold_`…), không tách riêng được; lazy-load cần dựng hàm giả cho từng hàm → rủi ro cao, lợi ích thấp (tổng đã ~691 KB gzip, trình duyệt giữ cache + 304).
- ~~Cache-Control immutable cho js/css~~ → **ĐÃ LÀM 28/11/2026** theo cách an toàn: `tools/build-dist.js` TỰ đóng dấu `?v=<10 ký tự sha256 nội dung file nén>` cho mọi thẻ js/css trong `dist/index.html` (nguồn index.html KHÔNG sửa, `?v=` thủ công trong nguồn giờ chỉ còn tác dụng khi chạy bản gốc), và ghi `dist/_headers`: `/js/*` + `/css/*` = `public, max-age=31536000, immutable`. index.html, sw.js, manifest KHÔNG immutable (luôn kiểm tra lại). Test `tools/test-dist-hash.js` (chạy trong CI deploy-web). Nguồn cảm hứng: CRM Frappe cùng mẫu tải 139 kB/4,2 MB nhờ cache đĩa. Nếu thêm CHỖ NẠP js/css mới ngoài thẻ trong index.html (vd tạo `<script>` bằng JS) thì PHẢI tự gắn hash, nếu không file đó sẽ kẹt cache một năm.
- **Bỏ/ngừng `setInterval`**: có 22 hẹn giờ lặp nhưng chủ yếu là kiểm tra DOM/cấu hình cục bộ rất nhẹ (4 s, 3 s, 2 s trong js/37, js/40, js/43-teamchat). Các nhịp gọi MẠNG (thông báo 60 s, thảo luận 6 s, nhiệm vụ 15 phút…) đã có xét ẩn tab (33 chỗ `document.hidden`/`visibilitychange`).

## Việc có thể làm tiếp (cần số đo trình duyệt thật — Chrome DevTools › Performance / Lighthouse trên bản Cloudflare)
Thời gian từ mở trang đến bấm được; thời gian phân tích JS; kích thước dữ liệu khách tải mỗi lần (137.558 KH — xem `loadData`/phân trang ở js/05, js/16); render bảng khách dài (ảo hóa danh sách).

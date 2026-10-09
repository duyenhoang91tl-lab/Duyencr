# Cloudflare Worker cache cho Duyên AI CRM (gói FREE)

Worker đứng **trước** Google Apps Script, chỉ cache các action **đọc** mà nhiều máy cùng xem (FULL khách, đơn hàng, báo cáo, danh mục giá…). Không sửa GAS / index.html / extension — chỉ **đổi địa chỉ backend** sang URL của Worker. Lùi lại = đổi về URL Apps Script.

## Cache cái gì, không cache cái gì
- **Có cache** (xem bảng `TTL_SEC` trong `worker.mjs`): `customers` FULL (15 giây), `orders` (15 giây), báo cáo/nhóm/team (60 giây), danh mục giá/khuyến mãi (120 giây).
- **Không bao giờ cache:** mọi POST và action ghi; `lookup`, `reminders`, `users`, `getSetting`, `assign`…; `customers&since=…` (delta); mọi request có `demo` hoặc `adminKey`; phản hồi lỗi / không phải JSON / > 8 MB.
- **Hệ quả:** sau khi CS lưu, người khác có thể thấy bản cũ tối đa bằng thời hạn cache của action đó (delta không cache nên thay đổi khách vẫn tới nhanh).
- **GAS sập:** nếu còn bản cache ≤ 10 phút thì Worker trả bản cũ (`x-crm-cache: STALE`) thay vì báo lỗi.

## Cài đặt (làm tay, ~10 phút, không cần dòng lệnh)
1. Đăng ký tài khoản Cloudflare (miễn phí) → **Workers & Pages** → **Create** → **Create Worker** → đặt tên (vd `duyen-crm-cache`) → **Deploy** (bản mẫu).
2. Vào Worker vừa tạo → **Edit code** → xoá hết → dán toàn bộ nội dung `cloudflare/worker.mjs` → **Deploy**.
3. **Settings → Variables and Secrets → Add** → loại *Text*: tên `GAS_URL`, giá trị = URL `/exec` của Web App (Apps Script → Deploy → Manage deployments → *Web app URL*) → **Deploy**.
4. **Thử:** mở `https://<tên-worker>.<tài-khoản>.workers.dev/?action=teams` trên trình duyệt → phải ra JSON như khi mở URL Apps Script. Mở **DevTools → Network → bấm request → Headers**: lần 1 `x-crm-cache: MISS`, tải lại trong 60 giây → `HIT`.
5. **Đổi địa chỉ ở 1–2 máy thử trước:** cùng chỗ đang dán URL Apps Script (cài đặt kết nối của CRM web; `ome_gas_url` của Zalo AI; ô URL trong Pancake AI) → dán URL Worker. Dùng vài ngày rồi mới đổi cả team.

## Lùi lại / tắt nhanh
- Đổi địa chỉ ở máy về URL Apps Script cũ (cách chắc nhất).
- Hoặc thêm biến `DISABLED` = `1` trong Worker → Worker chỉ chuyển tiếp, không cache.

## Theo dõi
- Cloudflare → Workers & Pages → Worker → **Metrics**: số request/ngày. **Gói free giới hạn 100.000 request/ngày, tính cả request trúng cache.** Vượt thì Worker báo lỗi và CRM đứng — lên gói Paid (5 USD/tháng, 10 triệu request) hoặc đổi địa chỉ về Apps Script. Ước lượng thô: mỗi máy CRM mở 8 giờ gọi delta mỗi 3 giây ≈ 9.600 request/ngày → ~10 máy là sát trần.
- Muốn biết nhanh hơn bao nhiêu: DevTools → Network, so thời gian của `action=customers` / `action=orders` giữa URL Apps Script và URL Worker (lần `HIT`).

## Giới hạn đã biết
- Nhiều request cùng lúc khi cache vừa hết hạn đều gọi GAS (chưa gộp).
- `customers&since=…` (delta ~3 giây/lần) không cache được nên phần tải nặng nhất vẫn đi vào GAS; muốn giảm nữa cần tăng chu kỳ poll ở client hoặc đọc Supabase trực tiếp (bước sau).
- Test: `node tools/test-cloudflare-worker.js`.

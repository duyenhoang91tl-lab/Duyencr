# Kết nối CRM với Base (Base.vn) bằng API

> Trạng thái: **hướng dẫn + kế hoạch**. Repo hiện CHƯA có code gọi API Base — dữ liệu Base vào CRM bằng tay (tab "Nhập dữ liệu Base/Pos" → action `importSheetRows` → sheet `DT TỔNG `).
> Mục này ghi rõ phần đã kiểm chứng với tài liệu Base và phần còn phải xác nhận.

## 1. Base có API gì (đã đối chiếu tài liệu chính thức)
- Danh sách API công khai của các app Base: https://help.base.vn/support/solutions/articles/63000258324-base-public-api (Account, Wework, **Workflow**, Request, HRM, Checkin…).
- Workflow (app đang chứa luồng "ĐƠN CÁC KÊNH"): tài liệu https://documenter.getpostman.com/view/1345096/SWE84Hd1
  - Địa chỉ dạng `https://workflow.<domain-công-ty>/extapi/v1/...` (ví dụ đã xác nhận: `job/next`, `job/backward`, `workflow/get`, `workflows/get`).
  - Gọi bằng **POST**, body `application/x-www-form-urlencoded`, bắt buộc có `access_token` (token của app Workflow).
  - Giá trị trường tuỳ biến gửi dạng `custom_<tên-trường>` (ví dụ `custom_gia_tri_don_hang`).
- **Chưa xác nhận được** (trang Postman nạp bằng JavaScript, mình không đọc được nội dung): endpoint **liệt kê/lấy chi tiết job** và danh sách trường trả về. Bạn mở link Workflow ở trên, tìm request lấy danh sách job (hoặc job theo luồng/giai đoạn), chụp ảnh hoặc dán URL + tham số cho mình trước khi viết code.

## 2. Lấy access token
Trong Base: vào cài đặt của app Workflow (hoặc Base Account → ứng dụng/API) và tạo token cho app Workflow (tên mục có thể khác theo gói). Token này **cho quyền đọc/sửa job** → coi như mật khẩu:
- KHÔNG dán vào chat, không commit vào GitHub, không ghi vào sheet `Settings` (action `getSetting` đọc được qua link Web App).
- Lưu ở **Apps Script → Project Settings → Script properties**, ví dụ `BASE_WORKFLOW_TOKEN` và `BASE_DOMAIN` (cách Pancake token đang lưu, xem `docs/PANCAKE-INBOX.md`).

## 3. Kiến trúc đề xuất (chiều Base → CRM)
1. Trigger GAS chạy mỗi 10–15 phút: gọi API Base lấy các job đơn mới/đổi trạng thái kể từ lần chạy trước.
2. Đổi mỗi job thành 1 dòng đúng thứ tự cột sheet `DT TỔNG ` (A ngày tạo, B người tạo, C giao cho, D SĐT, G giai đoạn, H trạng thái, K thời gian HT, M kênh bán, N sale bán, O sản phẩm, P phân loại, Q cọc, R giá trị đơn, S chênh lệch, T id, **U mã bộ đếm**).
3. Ghi theo **id job** (cột T): có rồi thì cập nhật dòng, chưa có thì thêm dòng mới → chạy lại không sinh đơn trùng.
4. Ghi nhật ký (số job đọc/ghi/lỗi) vào 1 sheet log để theo dõi; lỗi API thì báo, không ghi nửa chừng.
5. Giữ nút nhập Excel làm phương án dự phòng.

## 4. Chiều CRM → Base (nếu cần)
Base cho chuyển giai đoạn job bằng `job/next` / `job/backward` (cần id job, `mover_username`). Chỉ làm khi có nhu cầu rõ (ví dụ CRM đánh dấu đơn đã giao thì đẩy sang giai đoạn tiếp theo) và phải có xác nhận người dùng trước khi gọi, vì thao tác này sửa dữ liệu thật bên Base.

## 5. API của chính CRM (GAS Web App)
CRM đã có API qua link Web App (GET `?action=...`, POST JSON `{action:...}`): xem bảng action trong `gas/INDEX.md` và `docs/GAS-AUTO-DEPLOY.md`. Muốn hệ thống ngoài đọc báo cáo CRM thì dùng cùng link đó; phần xác thực tài khoản test/demo xem `docs/TAI-KHOAN-TEST.md` và `docs/SECURITY-PLAN.md`.

## Việc cần làm tiếp
- [ ] Bạn gửi: URL + tham số của request "lấy danh sách job" trong Postman Workflow, và 1 ví dụ phản hồi (che SĐT/tên khách).
- [ ] Bạn tạo access token Workflow và lưu vào Script properties (`BASE_WORKFLOW_TOKEN`, `BASE_DOMAIN`).
- [ ] Mình viết `gas/NN_BaseSync.gs` (đọc job → upsert `DT TỔNG ` theo id + trigger + log), test bằng dữ liệu giả rồi bạn chạy thử 1 ngày.

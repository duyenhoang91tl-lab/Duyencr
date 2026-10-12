# Gợi ý tin nhắn (thư viện mẫu có duyệt) — hướng dẫn & kiến trúc (2026-10-12)

Yêu cầu của Duyên: admin cài mẫu tin theo **sản phẩm** hoặc theo **nội dung hội thoại**; nhân viên được **đề xuất** mẫu mới nhưng chỉ dùng được sau khi **quản lý duyệt**; nhân viên gõ tên sản phẩm → thấy các mẫu liên quan → bấm **Copy** dán vào chat; dùng cả trên **CRM** và **Pancake AI**.

## Quyền (server quyết định, `gas_v13.js` — mục MessageTemplates)
| Ai | Xem | Tạo | Sửa / Xoá | Duyệt |
|---|---|---|---|---|
| admin, manager (`MSG_TPL_APPROVER_ROLES_`) | tất cả | luôn ở trạng thái **Đã duyệt** | mọi mẫu | ✅ |
| Nhân viên đăng nhập CRM (cs, leader…) | mẫu đã duyệt + mẫu CỦA MÌNH chưa duyệt | → **Chờ duyệt** | chỉ mẫu CỦA MÌNH chưa duyệt (sửa xong quay lại Chờ duyệt) | ❌ |
| Extension Pancake AI (khoá extension, tên CS tự khai) | mẫu đã duyệt + mẫu của tên CS đã chọn | → **Chờ duyệt** | chỉ mẫu chưa duyệt của tên đó | ❌ |
| Không token/khoá (client cũ) | chỉ mẫu đã duyệt | → **Chờ duyệt** | ❌ | ❌ |
- Vai trò lấy từ sheet Users qua **token phiên** (không tin vai trò client gửi). Người tạo của tài khoản web = tên thật trong token.
- Mẫu cũ (trước khi có duyệt, cột `status` trống) coi là **Đã duyệt** → không mất mẫu đang dùng. Muốn leader cũng được duyệt: thêm `'leader'` vào `MSG_TPL_APPROVER_ROLES_`.
- Từ chối kèm lý do; nhân viên thấy lý do, sửa lại và lưu → tự gửi duyệt lại.

## Dữ liệu
Sheet `MessageTemplates` (tự bổ sung cột): `id, title, content, tags, createdBy, createdAt, updatedAt, product, topic, status, approvedBy, approvedAt, rejectReason`. `product` = nhiều sản phẩm cách nhau `,` `;` hoặc xuống dòng. Actions: `messageTemplates` (GET, trả thêm `canApprove`, `pendingCount`), `saveMessageTemplate`, `deleteMessageTemplate`, `approveMessageTemplate` (POST `{id, decision:'approve'|'reject', reason}`).

## Tìm gợi ý
Bỏ dấu, không phân biệt hoa thường; mỗi từ phải khớp ít nhất 1 trường; điểm: sản phẩm 5 (khớp nguyên 1 sản phẩm +3) > chủ đề 3 = tag 3 > tiêu đề 2 > nội dung 1. Cùng thuật toán ở CRM (`tplSearch`, `js/20-loadaiexamples.js`) và extension (`rankMsgTemplates_`, `pancake-content.js`). CRM chỉ gợi ý mẫu **đã duyệt**; extension nhận từ server đúng những mẫu được phép thấy.

## Dùng ở đâu
- **CRM → tab Zalo AI:** mục "💬 Gợi ý tin nhắn" (tìm + chip chủ đề + nút Copy) và "📚 Quản lý mẫu" (lọc trạng thái, nút ✅ Duyệt / ❌ Từ chối cho admin/quản lý, huy hiệu "n mẫu chờ duyệt").
- **Pancake AI (panel mẫu tin):** ô tìm theo sản phẩm/hội thoại, bấm thẻ để **chèn thẳng** vào ô trả lời, hoặc 📋 Copy; ➕ để đề xuất mẫu (cần chọn tên CS trước); không duyệt/sửa mẫu đã duyệt tại extension (duyệt chỉ ở CRM).
- **Khung chat Pancake trong CRM (hộp thư Pancake, `docs/PANCAKE-INBOX.md` bước 4 — CHƯA có):** gắn bằng 1 dòng, không viết lại:
  `tplSuggestMount(document.getElementById('khung-goi-y'), { onPick: function (t) { chenVaoOTraLoi(t.content); } });`
  rồi gọi `loadMsgTemplates()` một lần khi mở khung chat. Có thể điền sẵn từ khoá theo sản phẩm khách đang hỏi bằng cách đặt giá trị cho ô `.tpl-sg-q` rồi bắn sự kiện `input`.

## Việc thủ công sau khi cập nhật
1. Deploy lại GAS (v13.29-msgtpl-approval). Sheet tự thêm cột mới, mẫu cũ giữ nguyên và coi như đã duyệt.
2. Ctrl+F5 CRM (mỗi người đã đăng nhập sau bản bảo mật mới thì giữ phiên; ai chưa có token sẽ chỉ thấy mẫu đã duyệt và đề xuất ở trạng thái chờ duyệt).
3. Reload extension Pancake AI trong `chrome://extensions`.
4. Admin/quản lý đăng nhập CRM → tab Zalo AI → thêm mẫu theo sản phẩm; hoặc duyệt các mẫu nhân viên gửi.

## Test
`node tools/test-msgtpl.js` (ma trận quyền, chuyển trạng thái, mẫu cũ, chiếm id, cắt độ dài), thuật toán tìm được kiểm riêng cho CRM và extension. Chưa kiểm trên GAS/Chrome thật.

## Chưa làm / lưu ý
- `saveMessageTemplate`, `deleteMessageTemplate`, `approveMessageTemplate`, `messageTemplates` chưa nằm trong `NTL_ACTIONS_` (không bị công tắc chặn xác thực) nhưng đã tự kiểm quyền bên trong.
- Extension không có tài khoản đăng nhập nên "tên CS" tự khai: có thể khai tên người khác để xem/sửa mẫu CHỜ DUYỆT của người đó (không thấy được mẫu đã duyệt nào ngoài quyền). Muốn chặt hơn → cho extension đăng nhập CRM (bước sau của kế hoạch bảo mật).
- Chưa đếm lượt dùng mẫu / xếp mẫu hay dùng lên đầu; chưa gợi ý tự động theo sản phẩm khách đang hỏi trong khung chat (cần hộp thư Pancake bước 2–4).

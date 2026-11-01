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
- **Khung chat Pancake trong CRM (đã có nút 💡):** cả **Social > Chat** (`js/42-fn-socialchat.js`) và chat trong **hồ sơ khách** (`js/41-fn-pkchat.js`) có nút 💡 cạnh ô soạn tin. Bấm → ô gợi ý hiện ngay trên ô soạn (gõ sản phẩm / bấm chip chủ đề) → bấm "↳ Chèn" để đưa mẫu vào ô trả lời. **Không tự gửi**: nhân viên đọc lại rồi bấm Gửi. Chèn tiếp lần nữa thì cách một dòng trống. Cơ chế dùng chung: `tplChatToggle(composeId, textareaId)` trong `js/20-loadaiexamples.js` — thêm khung chat mới chỉ cần 1 nút `onclick="tplChatToggle('id-khung-soan','id-textarea')"`. Dữ liệu mẫu tự tải khi mở lần đầu (và tải lại nếu cũ hơn 60 giây).

## Việc thủ công sau khi cập nhật
1. Deploy lại GAS (v13.29-msgtpl-approval). Sheet tự thêm cột mới, mẫu cũ giữ nguyên và coi như đã duyệt.
2. Ctrl+F5 CRM (mỗi người đã đăng nhập sau bản bảo mật mới thì giữ phiên; ai chưa có token sẽ chỉ thấy mẫu đã duyệt và đề xuất ở trạng thái chờ duyệt).
3. Reload extension Pancake AI trong `chrome://extensions`.
4. Admin/quản lý đăng nhập CRM → tab Zalo AI → thêm mẫu theo sản phẩm; hoặc duyệt các mẫu nhân viên gửi.

## Test
`node tools/test-msgtpl.js` (ma trận quyền, chuyển trạng thái, mẫu cũ, chiếm id, cắt độ dài), thuật toán tìm được kiểm riêng cho CRM và extension, luồng "bấm 💡 → gõ sản phẩm → chèn vào ô trả lời" kiểm trên DOM giả lập (jsdom, gồm cả chống chèn mã HTML trong nội dung mẫu). Chưa kiểm trên GAS/Chrome thật.

## Chưa làm / lưu ý
- `saveMessageTemplate`, `deleteMessageTemplate`, `approveMessageTemplate`, `messageTemplates` chưa nằm trong `NTL_ACTIONS_` (không bị công tắc chặn xác thực) nhưng đã tự kiểm quyền bên trong.
- Extension không có tài khoản đăng nhập nên "tên CS" tự khai: có thể khai tên người khác để xem/sửa mẫu CHỜ DUYỆT của người đó (không thấy được mẫu đã duyệt nào ngoài quyền). Muốn chặt hơn → cho extension đăng nhập CRM (bước sau của kế hoạch bảo mật).
- Chưa đếm lượt dùng mẫu / xếp mẫu hay dùng lên đầu; chưa tự điền sẵn sản phẩm khách đang hỏi vào ô tìm (hiện nhân viên tự gõ tên sản phẩm).


## Thông báo + duyệt ngay trên Pancake AI (2026-10-15)
Yêu cầu của Duyên: nhân viên đề xuất **mẫu tin mới** thì admin (duyenht…) nhận **thông báo** và bấm **Duyệt/Từ chối ngay trên Pancake AI**, đồng thời có thông báo trên **CRM**.
- **GAS** (`v13.51-tplnotify`): `saveMessageTemplate_` (mẫu mới/sửa lại ở trạng thái Chờ duyệt) → `_tplNotifyPending_` ghi thông báo `kind=tplpending, refType=tpl, refId=id mẫu` cho MỌI admin đang hoạt động (`MSG_TPL_APPROVER_ROLES_`), trừ chính người đề xuất; 1 thông báo chưa đọc / admin / mẫu (sửa nhiều lần không spam). Duyệt / từ chối / xoá (ở CRM hay extension) → `_tplNotifClear_` đánh dấu đã đọc cho mọi admin. `GET action=tplPending&token=…` (chỉ admin) trả danh sách nhẹ (tối đa 30, nội dung cắt 1200 ký tự). Lỗi ghi thông báo KHÔNG làm hỏng việc lưu mẫu.
- **CRM**: chuông 🔔 hiện thông báo như sự kiện; bấm → mở **Zalo AI > Quản lý mẫu**, lọc **Chờ duyệt**, cuộn tới mẫu (`_ntOpenTpl_`, `js/39-fn-notify.js`).
- **Pancake AI** (extension `2026.10.15.1`): Cài đặt extension → mục **📝 Duyệt mẫu tin** → đăng nhập bằng tài khoản + mật khẩu CRM của admin (action `webLogin`). Mật khẩu KHÔNG lưu; token phiên (~7 ngày) chỉ nằm ở background (`chrome.storage.local`, không đồng bộ giữa máy, không đưa ra trang Pancake). `pancake-approver.js` hỏi background mỗi 90 giây (chỉ khi tab đang hiện): có mẫu mới → thông báo + nút nổi **📝 N mẫu tin chờ duyệt** → hộp thoại ✓ Duyệt / ✗ Từ chối (từ chối: bấm lần 1 hiện ô lý do, lần 2 mới gửi). Phiên hết hạn → nút tự biến mất, đăng nhập lại ở Cài đặt.
- **Việc thủ công**: deploy lại GAS (kiểm `?action=count` = `v13.51-tplnotify`); Ctrl+F5 CRM; reload extension ở `chrome://extensions` (hoặc cài bản mới) rồi đăng nhập ở Cài đặt; tải lại tab Pancake.
- Zalo AI chưa có phần duyệt này (ghi `gap` trong `tools/ext-parity-allow.json`, chờ Duyên chốt).
- Test: `node tools/test-tpl-notify-gas.js`, `node tools/test-nt-tpl.js`, `node tools/test-pk-approver-ext.js`.

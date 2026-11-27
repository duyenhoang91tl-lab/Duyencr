# 16 — Tài khoản Trưởng nhóm (Lead): nhận data, chia lại cho team, báo cáo nhân viên, giới hạn tháng

Làm 2026-11-26/27. Vai trò: base `leader` (nhãn "Trưởng nhóm"; vai trò tự tạo có base `leader` cũng áp dụng).

## Cách dùng (Duyên)
1. Menu › Cài đặt team › **Quản lý Team**: tạo team, chọn Lead làm trưởng, thêm thành viên.
2. Menu › Cài đặt team › **Tài khoản đăng nhập**: Vai trò "Trưởng nhóm" → chọn Team → tick tháng được xem (vd 4, 5, 6; không tick = mọi tháng). Lưu.
3. Menu › **Chia data**: chia cho chính Lead (nguồn người nhận "Tài khoản đăng nhập CRM").
4. Lead đăng xuất/đăng nhập lại → Menu › Cài đặt chia số: **Data của team (chia lại)** và **Báo cáo nhân viên**.

## Quy tắc (cách hiểu, CHỜ DUYÊN XÁC NHẬN)
- Tháng = tháng của **ngày đơn hàng** (DT TỔNG, dữ liệu đơn, đơn POS).
- Lead xem = data chia thẳng cho Lead (mọi tháng) + data team có đơn trong tháng được tick.
- Báo cáo doanh số và bảng "Báo cáo nhân viên" **không** giới hạn theo tháng.
- Lead chỉ chia lại SĐT đã được chia cho chính mình, chỉ cho thành viên team mình; 1 lần chia thì 1 SĐT cho 1 người.
- Phương án khác (chưa làm): tick tháng = cấp data toàn công ty của tháng đó.

## Code
| Phần | Chỗ |
|---|---|
| Cột `viewMonths` (cột 12 sheet Users, JSON `["2026-04"]`) | `USER_HEADERS`, `readUsers_`, `saveUsers_` (client không gửi thì giữ giá trị cũ) |
| GET `leadAssignInfo`, POST `leadAssign` (khoá, chỉ ghi nối thêm) | `gas_v13.js`: `leadAssignInfo_`, `leadAssign_`, `_leadTeam_`, `_leadUser_` |
| So tên đợt chia (tên đăng nhập, có/không dấu, thẻ Khớp sale) | `_leadNameResolver_`, `_leadOwnKeys_` (cùng tiêu chí `_scopeSameNameKeys_`) |
| Giới hạn tháng ở server (luôn chặn, không phụ thuộc `scopeMode`) | `_leadMonths_`, `_leadMonthFilterSet_`, `_scopeVerdict_`, `_scopePhoneSet_` |
| Non-admin có token gọi `saveAssignHistory` chỉ cập nhật "đã xong" đợt của mình | `saveAssignHistoryGuarded_` |
| Giới hạn tháng ở web | `js/08` `_inUserScope` + `_leadMonthOk_`; `js/14` `_applyAuthIdentity` (tải thêm đơn POS về tới tháng cũ nhất) |
| Form tài khoản | `js/15` `_acctMonthsHtml_`, `_acctCollectMonths_` |
| Màn "Data của team" | `js/96-lead-assign.js`; menu `js/29` (`lead:true`); trang Phân quyền không liệt kê 2 mục này |

## Test
`node tools/test-lead-assign.js` · `test-lead-ui` · `test-lead-scope` · `test-lead-identity` · `test-lead-account` · `test-lead-menu` · `test-assign-done`

## Hạn chế đã biết (chưa sửa)
- Sửa tài khoản (`addAccount`, js/15) dựng lại bản ghi không kèm `perms/saleType/startDate/joinDate` → có thể mất các trường này.
- Admin xoá đợt chia / chia theo Team vẫn ghi đè cả sheet AssignData bằng bản trên máy admin (`pushAssignHistToGS`) → có thể làm mất đợt Lead vừa chia hoặc tiến độ "đã xong". Admin nên tải lại (F5) trước khi xoá/chia theo Team.

# 01 — Quy tắc bắt buộc & Deploy

## Deploy — quan trọng nhất
`gas_v13.js` chạy như Google Apps Script Web App. `git push` lên GitHub KHÔNG tự deploy bản đang chạy thật (nguyên nhân phổ biến nhất của "code đúng nhưng chưa chạy thật").

**Sau khi sửa `gas_v13.js`, LUÔN nhắc người dùng:**
1. Mở Apps Script Editor → dán đè toàn bộ `gas_v13.js` mới.
2. Deploy → Manage deployments → chọn ĐÚNG deployment có URL extension đang gọi → ✏️ Edit → "New version" → Deploy.
3. Đồng bộ mã cho nút "📋 Copy Apps Script Code" bằng "🔄 Đồng bộ mã GAS mới nhất" (xem mục dưới).

**Sau khi sửa JS/CSS của extension:** nhắc reload extension trong `chrome://extensions` (không cần deploy riêng).

Cả 2 extension gọi chung 1 URL GAS.
- Zalo AI: `DEFAULT_GAS_URL` hardcode làm dự phòng — cài lần đầu (storage rỗng) tự điền + lưu.
- Pancake AI: `DEFAULT_SETTINGS` trong `pancake-background.js` ghi vào storage qua `chrome.runtime.onInstalled` (chỉ chạy 1 lần lúc cài mới); có nút "↺ Đặt lại về mặc định" trong Options để áp lại.

## Đồng bộ mã GAS cho nút "Copy mã GAS" ✅ (đã xác minh 2026-10-08: CHỈ còn 1 cơ chế)
- `grep -c 'gas-code-v9' index.html` = **0** → khối inline đó ĐÃ XOÁ. KHÔNG còn quy tắc "khối gas-code-v9 phải khớp 100% gas_v13.js" — đừng dò lại, đừng thêm khối đó vào lại.
- Nút "📋 Copy Apps Script Code" gọi `action=getGasSource` (đọc các chunk trong Settings: `gasSourceChunk_N`, `gasSourceChunkCount`, `gasSourceUpdatedAt`; ghi bởi `action=setGasSource` → `setGasSource_`). Client cache `_gasSrcCache` theo phiên, tự xoá sau khi sync.
- Từ v13.19: `getGasSource`/`setGasSource` BẮT BUỘC có `adminKey` (= giá trị dòng `adminKey` trong sheet Settings; app hỏi 1 lần/máy, lưu `ome_admin_key`). Chưa đặt dòng đó = không ai lấy/đồng bộ được mã. Tài khoản test (role `demo`): xem `docs/TAI-KHOAN-TEST.md`.
- Vì vậy sau khi sửa `gas_v13.js` và người dùng đã deploy, BẮT BUỘC nhắc thêm bước (Admin): mở modal Google Sheets trong CRM → "🔄 Đồng bộ mã GAS mới nhất" → dán toàn bộ `gas_v13.js` → "🔄 Đồng bộ". Không làm bước này thì nút Copy vẫn trả mã cũ.

## 13 quy tắc bắt buộc khi sửa code
1. Luôn clone repo MỚI NHẤT bằng token người dùng gửi trong tin nhắn đó (không dùng lại token cũ). Đọc kỹ file liên quan (view/grep) trước khi sửa.
2. Sửa `gas_v13.js` → nhắc deploy thủ công (mục trên).
3. Sửa JS/CSS extension → nhắc reload extension.
4. Trước khi commit luôn syntax-check: `node -c` cho file `.js`; với client Sasum: `for f in js/*.js; do node -c $f; done` (code client đã tách khỏi `index.html` ra `js/`); khối `<script>` inline còn lại trong `index.html` (nhỏ, <40 dòng) check bằng Function constructor trong Node, bỏ qua `type="text/plain"`. Không commit code chưa kiểm tra.
5. Push bị "rejected" (nhiều phiên cùng sửa): `git fetch` → `git rebase origin/main` → kiểm tra thay đổi của mình còn nguyên → push lại. KHÔNG force-push.
6. Commit message phải nêu RÕ NGUYÊN NHÂN GỐC của lỗi, không chỉ liệt kê đã đổi gì.
7. Sửa hàm dùng chung (vd `_srChartSvg`, `_donSaleNamesFromThe_`, `mergeExtFields_`, `_SRB_COMBO_CFG`...) → grep TOÀN BỘ nơi gọi trước.
8. Trước khi kết luận "không có lỗi": test bằng ví dụ thực tế người dùng đưa (mô phỏng logic bằng Node), không chỉ đọc code.
9. Không sửa thư mục `extension/`.
10. Token GitHub người dùng dán: chỉ dùng cho đúng thao tác, KHÔNG lưu đâu cả. Thấy dán nhiều lần → nhắc nhẹ nên revoke/tạo token mới.
11. Phát hiện quy ước/lỗi mới đáng nhớ → đề xuất cập nhật đúng file KB.
12. Làm xong phần nào push ngay phần đó (từng mục nhỏ) kèm việc cần làm tiếp, để phiên khác tiếp tục được.
13. Sửa `gas_v13.js` → nhắc 2 việc: (a) deploy lại GAS; (b) bước "🔄 Đồng bộ mã GAS mới nhất" trong modal Google Sheets (mục trên). Không còn khối `gas-code-v9` để đồng bộ trong `index.html`.

## Checklist trước khi báo "đã xong"
1. Đã grep hết mọi nơi gọi hàm vừa sửa chưa?
2. Đã test bằng ví dụ thật (không chỉ đọc code suy luận) chưa?
3. Cần nhắc deploy lại GAS không?
4. Cần nhắc reload extension không?
5. Thay đổi ảnh hưởng cả 2 extension hay chỉ 1 (nhiều hàm dùng chung backend)?
6. Đã push + ghi "việc cần làm tiếp" chưa?

## Quy ước UI chung (index.html)
- Design token ở `:root` đầu `<style>` (màu, shadow, radius) — dùng lại, đừng hardcode màu.
- Bảng rộng (`.dash-table`/`.audit-table`) tự có wrapper cuộn ngang trên màn nhỏ qua MutationObserver cuối trang.
- Nút cài đặt admin của tab báo cáo gom vào 1 dropdown "⚙ Cài đặt" (`.gear-menu`/`.gear-menu-list` + `_srToggleGearMenu()`/`closeGearMenus()`), đã áp cho Báo cáo E — theo mẫu này nếu thêm chỗ khác.

## Instruction của Project (rule 13)
Rule 13 trong Instruction của Project nên ghi đúng như trên: "Sau khi sửa gas_v13.js: nhắc deploy lại GAS VÀ nhắc bước 'Đồng bộ mã GAS mới nhất' trong modal Google Sheets." (Không còn nhánh 'khối gas-code-v9'.)

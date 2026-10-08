# Tự động đưa GAS lên Apps Script (GitHub Actions + clasp)

Sau khi cài xong (làm 1 lần), mỗi lần push `main` có đổi `gas_v13.js` hoặc `gas/**`, GitHub tự:
sinh lại `gas/*.gs` → kiểm tra cú pháp → sao lưu bản đang chạy → đẩy code lên Apps Script → cập nhật đúng deployment (URL không đổi).
Xem kết quả ở tab **Actions** của repo. Chạy tay: Actions → "Deploy GAS to Apps Script" → Run workflow.

## Cài 1 lần (làm được trên điện thoại)

### Bước 1 — Bật Apps Script API
Mở https://script.google.com/home/usersettings → bật **Google Apps Script API**.

### Bước 2 — Lấy file đăng nhập clasp (dùng Google Cloud Shell, chạy trong trình duyệt)
1. Mở https://shell.cloud.google.com (đăng nhập đúng tài khoản Google đang sở hữu dự án Apps Script).
2. Gõ lần lượt:
   ```
   npm i -g @google/clasp@2.4.2
   clasp login --no-localhost
   ```
3. Mở link nó hiện ra → chọn tài khoản → Cho phép → copy mã (hoặc URL) trang cuối → dán lại vào Cloud Shell, Enter.
4. Gõ `cat ~/.clasprc.json` → copy TOÀN BỘ nội dung (từ `{` đến `}`).

### Bước 3 — Thêm Secret vào GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `CLASPRC_JSON` = nội dung vừa copy ở bước 2.
- `GAS_SCRIPT_ID` = Script ID của dự án Apps Script (Apps Script → Project Settings ⚙ → IDs → Script ID).

(Tuỳ chọn) Variable `GAS_DEPLOYMENT_ID` nếu muốn deploy sang deployment khác; mặc định là deployment Web App hiện tại.

### Bước 4 — Chạy thử
Actions → Deploy GAS to Apps Script → Run workflow. Job xanh là xong; bước cuối in ra kết quả `action=count` (có trường `ver`) để đối chiếu.

## Lưu ý quan trọng
- **Dự án Apps Script sẽ bị thay toàn bộ** bằng 20 file `gas/*.gs` + `appsscript.json` lấy từ chính dự án (giữ nguyên cấu hình Web App). File cũ trong Editor (vd `Code.gs`, `gas_v13`) sẽ bị xoá để khỏi trùng hàm. Bản trước khi deploy được lưu ở Artifact `gas-backup-truoc-khi-deploy` (giữ 7 ngày) trong lần chạy đó.
- Lần đầu chạy, `clasp` có thể xin quyền (scope) mới nếu manifest thay đổi — nếu job báo lỗi quyền thì mở Apps Script chạy tay 1 hàm bất kỳ để cấp quyền, rồi chạy lại.
- Trigger hẹn giờ (`installAutoAssignTrigger_`, `chayCaiDatTrigger`) tạo trong Apps Script vẫn giữ nguyên, không bị xoá khi đẩy code.
- Hết hạn đăng nhập (hiếm, khi đổi mật khẩu Google/thu hồi quyền): làm lại Bước 2–3.
- Chỉ sửa `gas_v13.js` (nguồn chính). `gas/*.gs` do `node tools/split-gas.js` sinh ra, CI cũng tự sinh lại.

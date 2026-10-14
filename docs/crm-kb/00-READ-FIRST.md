# 00 — ĐỌC FILE NÀY TRƯỚC (BẮT BUỘC)

Dự án: Duyên AI CRM (Sasum) — repo `duyenhoang91tl-lab/Duyencr` (nhánh main).
Gồm: 1 backend Google Apps Script (`gas_v13.js`) + web app (`index.html`) + 2 Chrome extension (Zalo AI, Pancake AI).

## Cách dùng bộ tài liệu này (để nhanh, không lag)
1. Đọc file này xong → CHỈ mở thêm đúng 1–2 file theo bảng định tuyến bên dưới. KHÔNG đọc hết mọi file.
2. Chỉ đọc đúng phần code liên quan trong repo (grep/view theo hàm), không đọc nguyên file lớn.
3. Đừng hỏi lại người dùng những gì đã có trong các file KB này.
4. Luôn đọc `01-rules-and-deploy.md` trước khi commit/push hoặc khi sửa `gas_v13.js`.

## Bảng định tuyến: sửa gì → đọc file KB nào → sửa file nào trong repo
| Việc cần làm | Đọc file KB | Sửa trong repo |
|---|---|---|
| Backend: action GAS, sheet, cột CareData, AI (`callAI_`), Settings, gửi hàng loạt phía server | `02-backend-gas.md` (+ `07-reference-tables.md`) | `gas_v13.js` (root) |
| Báo cáo doanh số A–F, biểu đồ, bộ lọc, giao diện Sasum | `05-sasum-reports-ui.md` | `js/*.js` + `css/*.css` (client, tra hàm ở `js/INDEX.md`; `index.html` chỉ còn khung HTML) + `gas_v13.js` (các hàm `buildSalesReport*_`) |
| Extension Zalo AI (panel, tra cứu, kết bạn, gửi hàng loạt, quét trạng thái) | `03-extension-zalo.md` | `extension-zalo/zalo-content.js`, `zalo-content.css`, `zalo-options.*`, `zalo-popup.*`, `manifest.json` |
| Extension Pancake AI (panel, selector DOM, giỏ hàng, Soạn đơn, bảng giá) | `04-extension-pancake.md` | `extension-pancake/pancake-content.js`, `pancake-background.js`, `pancake-content.css`, `pancake-options.*`, `pancake-popup.*`, `manifest.json` |
| Deploy, commit, push, rebase, quy tắc bắt buộc, checklist | `01-rules-and-deploy.md` | — |
| Thêm/sửa tính năng cho Zalo AI hoặc Pancake AI (QUY TẮC SONG SONG: bên này có thì bên kia cũng có) | `08-extension-parity.md` | cả `extension-zalo/*` VÀ `extension-pancake/*` + `tools/ext-parity-allow.json` |
| Tra bảng nhanh: action GAS, 20 cột CareData, storage key, tiền tố CSS, quyền manifest | `07-reference-tables.md` | — |
| Báo lỗi lặp lại / dò lịch sử lỗi đã sửa | `06-bug-history.md` | — |
| Bảo mật backend: đăng nhập server/token, việc còn lại (bước 3-4) | `docs/SECURITY-PLAN.md` | — |
| Chuyển HẲN sang Supabase (kế hoạch 6 giai đoạn, đã được Duyên đồng ý 2026-10-11) | `docs/MIGRATE-SUPABASE-FULL.md` (+ `docs/SUPABASE-PLAN.md`) | `gas_v13.js` (khối Supabase), `cloudflare/worker.mjs`, `supabase/schema.sql` |
| Lộ trình thực hiện file yêu cầu CRM (8 mục: mốc sau mua, resale, hạng, AI tóm tắt, hồ sơ sale, hộp thư chung, quy trình đơn) | `docs/ROADMAP-YEU-CAU.md` | — |

## Web app Sasum đã TÁCH FILE (2026-10-08, chống lag)
`index.html` (~112KB) chỉ còn khung HTML; CSS ở `css/01..04`, JS ở `js/NN-*.js` (nạp bằng `<script src>` đúng thứ tự cũ). Tra hàm → file: `js/INDEX.md` hoặc `grep -n "function tenHam" js/*.js`. KHÔNG đổi thứ tự thẻ `<script>` trong `index.html`. Chi tiết quy ước (file `fn-*` / `main-*`) ở đầu `js/INDEX.md`.

## Tuyệt đối không
- Không sửa thư mục `extension/` (bản gộp cũ, chỉ để tham khảo).
- Không lưu Personal Access Token vào file/memory/tài liệu nào. Token mỗi tin nhắn chỉ dùng cho đúng thao tác đó.
- Không force-push.
- Không commit khi chưa syntax-check.
- Không dò lại chuyện `gas-code-v9` / "2 cơ chế đồng bộ mã GAS": đã xác minh 2026-10-08 chỉ còn cơ chế `getGasSource`/`setGasSource` (chi tiết ở `01-rules-and-deploy.md`).

## Thứ tự làm việc chuẩn
1. Clone repo MỚI NHẤT bằng token trong tin nhắn hiện tại → đọc đúng phần code liên quan.
2. Sửa nhỏ, từng mục → syntax-check → commit (nêu NGUYÊN NHÂN GỐC) → push ngay từng mục nhỏ.
3. Mỗi lần push: ghi rõ "đã làm gì / việc cần làm tiếp" trong commit message (và/hoặc file `HANDOFF.md` ở root repo) để phiên khác tiếp tục được ngay.
4. Báo người dùng chỉ những bước thủ công THỰC SỰ còn lại: reload extension, Ctrl+F5 web, hàm cần chạy tay trong Apps Script. KHÔNG nhắc deploy GAS / Worker / Supabase / đồng bộ mã (đã tự động bằng GitHub Actions từ 2026-10-11) — xem `01-rules-and-deploy.md`.
5. Phát hiện quy ước/lỗi mới đáng nhớ → đề xuất cập nhật đúng file KB tương ứng (không nhét vào file nào cũng được).

## Quy tắc giữ KB gọn
- Mỗi file KB giữ dưới ~150 dòng. Quá dài → tách thêm file mới và thêm 1 dòng vào bảng định tuyến ở trên.
- Mỗi thông tin chỉ nằm ở 1 file (tránh lệch nhau).

- Kế hoạch đưa các mục của CRM mẫu (clip 2026-10-11) vào CRM: `docs/ROADMAP-CRM-MAU.md` (B1–B6, việc cần Duyên chốt ở mục 4).

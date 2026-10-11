# Tự động deploy Cloudflare Worker + Supabase từ GitHub

Cùng kiểu với GAS (`docs/GAS-AUTO-DEPLOY.md`): sau khi cài 1 lần, mỗi lần push `main` có đổi file liên quan thì GitHub tự deploy, không cần dán tay.
Xem kết quả ở tab **Actions** của repo. Chạy tay: Actions → chọn workflow → Run workflow.

| Thành phần | Workflow | Chạy khi push main đổi | Secret cần |
|---|---|---|---|
| Cloudflare Worker | `deploy-worker.yml` | `cloudflare/**` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| Supabase (schema) | `deploy-supabase.yml` | `supabase/**` | `SUPABASE_DB_URL` |
| GAS | `deploy-gas.yml` | `gas_v13.js`, `gas/**` | `CLASPRC_JSON`, `GAS_SCRIPT_ID` |

## 1. Cloudflare Worker

### Cài 1 lần
1. Cloudflare Dashboard → avatar góc phải → **My Profile → API Tokens → Create Token** → mẫu **Edit Cloudflare Workers** → Account Resources chọn đúng tài khoản → **Continue → Create Token** → copy token (chỉ hiện 1 lần).
2. **Account ID**: Dashboard → **Workers & Pages** → cột phải có "Account ID" → copy.
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = token bước 1
   - `CLOUDFLARE_ACCOUNT_ID` = ID bước 2
4. Chạy thử: Actions → **Deploy Cloudflare Worker** → Run workflow. Job xanh là xong; bước cuối in ra kết quả `?action=count` (có trường `ver`).

### Điểm cần biết
- **Tên Worker** phải trùng Worker đang chạy (mặc định `duyen-crm-cache`). Nếu Worker của bạn tên khác: repo → Settings → Secrets and variables → Actions → tab **Variables** → tạo `CF_WORKER_NAME` = tên thật. Workflow dừng với lỗi rõ ràng nếu không thấy Worker, để không tạo nhầm Worker mới.
- **`GAS_URL` không bị đụng tới.** Workflow deploy bằng `--keep-vars` nên biến `GAS_URL` (và `DISABLED`) đã đặt trên Cloudflare Dashboard được giữ nguyên. Muốn GitHub quản lý luôn: tạo Variable `GAS_URL` trong repo, workflow sẽ truyền vào.
- **Code sửa trực tiếp trên Dashboard (Edit code) sẽ bị ghi đè** ở lần deploy sau. Từ giờ chỉ sửa `cloudflare/worker.mjs` trong repo.
- Trước khi deploy workflow chạy `node tools/test-cloudflare-worker.js`; test hỏng thì không deploy.
- **Lùi bản:** Cloudflare Dashboard → Worker → **Deployments** → chọn bản cũ → Rollback. Hoặc revert commit trong GitHub rồi để workflow chạy lại.
- Gói free Cloudflare giới hạn 100.000 request/ngày (xem `cloudflare/README-vi.md`) — không liên quan tới deploy, chỉ để nhớ.

## 2. Supabase (schema)

Workflow áp file `supabase/schema.sql` lên database mỗi khi file (hoặc workflow) đổi. Hiện repo chỉ có file này — chưa có migrations hay Edge Functions; khi cần thì thêm bước sau.

### Cài 1 lần
1. Supabase → mở project → nút **Connect** ở đầu trang → chọn **Session pooler** → copy chuỗi dạng
   `postgresql://postgres.<mã-project>:[YOUR-PASSWORD]@aws-0-<vùng>.pooler.supabase.com:5432/postgres`.
   Phải là **Session pooler**, không dùng "Direct connection": kết nối trực tiếp chỉ có IPv6, máy chạy GitHub Actions thường không nối được.
2. Thay `[YOUR-PASSWORD]` bằng **mật khẩu database** (không phải `service_role` key). Quên mật khẩu: Project Settings → Database → Reset database password (việc này không ảnh hưởng `SUPABASE_KEY` trong Script Properties của GAS). Mật khẩu có ký tự đặc biệt (`@ : / # ? %`) phải mã hoá dạng `%40`… — dễ nhất là đặt mật khẩu chỉ gồm chữ và số.
3. GitHub repo → Settings → Secrets and variables → Actions → New repository secret: `SUPABASE_DB_URL` = chuỗi đã thay mật khẩu.
4. Chạy thử: Actions → **Deploy Supabase schema** → Run workflow. Job xanh là xong.

### Điểm cần biết
- **`schema.sql` phải idempotent** (`create table if not exists`, `add column if not exists`…) vì được chạy lại mỗi lần push. Muốn thêm cột: `alter table care_data add column if not exists ten_cot text default '';`.
- **3 lớp an toàn** (đây là dữ liệu thật): (1) từ chối nếu file có `drop table/column/schema/database`, `truncate`, `delete from` — chủ ý thì sao lưu trước rồi Actions → Run workflow → tick `allow_destructive`; (2) chạy thử 2 lần trên Postgres tạm trước khi đụng Supabase thật; (3) áp trong 1 transaction nên lỗi giữa chừng không đổi gì, và cuối cùng kiểm tra 3 bảng `care_data`, `dt_tong`, `don_chi_tiet` còn bật RLS.
- **Workflow không sao lưu dữ liệu.** Sao lưu/khôi phục Supabase là việc riêng (xem mục "Quyết định cần Duyên (c)" trong `docs/SUPABASE-PLAN.md`).
- Workflow dùng mật khẩu database, còn GAS vẫn dùng `service_role` key trong Script Properties — hai thứ độc lập, đừng đưa key nào vào repo.
- Sửa schema trực tiếp trong SQL Editor của Supabase sẽ lệch với repo — từ giờ sửa trong `supabase/schema.sql`.

# 01 — Quy tắc bắt buộc & Deploy

## ⛔ QUY TẮC GIT — BẮT BUỘC MERGE, CẤM RESET / FORCE-PUSH (chốt 2026-10-12, Duyên yêu cầu)
**Lý do (sự cố có thật):** nhiều phiên cùng sửa repo; ngày 2026-10-12 có phiên ghi đè lịch sử `main` ≥2 lần làm BIẾN MẤT 7 commit đã push (c2f12d5, 55b7acd, 19acd75, 65c702a, a1f7a2b, 9702f21, 329b261) — GitHub báo "không tìm thấy" SHA, tức mất hẳn. Công sức nhiều phiên phải làm lại.

**CẤM TUYỆT ĐỐI — ai chỉnh sửa (người hay AI) đều không được:**
- `git push --force`, `--force-with-lease`, `-f`, hoặc refspec bắt đầu bằng `+` (vd `git push origin +main`).
- `git reset --hard` (hoặc `--soft/--mixed`) về một commit cũ / về `origin/main` rồi push; xoá nhánh `main` hoặc tạo lại nhánh rồi push đè.
- `git rebase` rồi push (kể cả rebase commit chưa push), `git commit --amend`, `git filter-branch`/`filter-repo`, `git checkout --orphan`, squash-đè commit ĐÃ push.
- "Clone mới rồi chép file đè lên" thay cho merge (làm mất thay đổi của phiên khác).
- Xoá `.git` hoặc `rm -rf` repo cục bộ khi còn commit chưa push (đã từng làm mất việc).

**BẮT BUỘC làm đúng quy trình này mỗi lần push:**
1. Commit xong → chạy `TK=<token của tin nhắn này> bash tools/safe-push.sh` (script làm đúng các bước dưới, khuyến nghị dùng).
2. Làm tay (nếu không dùng script): `git fetch origin` → nếu `origin/main` có commit mới thì **`git merge origin/main`** (hoặc `git pull --no-rebase`) → gặp xung đột thì mở file, **GIỮ thay đổi của CẢ HAI bên**, `git add`, `git commit` → chạy lại syntax-check/test → `git push` THƯỜNG (không cờ force).
3. Push bị "rejected" ⇒ nghĩa là có người push xen vào ⇒ quay lại bước 2 (merge tiếp). Không bao giờ "giải quyết" bằng force.
4. SAU khi push phải xác minh commit thật sự nằm trên remote: `git fetch origin && git merge-base --is-ancestor HEAD origin/main && echo OK` (script tự làm). Nếu không OK ⇒ DỪNG, báo người dùng, không force-push.
5. Thấy commit của mình/người khác biến mất khỏi `main`: DỪNG, không "sửa" bằng force. Lấy lại từ `git reflog` / nhánh sao lưu (`backup/*`) / bản clone còn trong máy, rồi **merge** hoặc `cherry-pick` lên `main` như commit mới; ghi sự cố vào `HANDOFF.md`.
6. Muốn thử nghiệm nguy hiểm → làm trên NHÁNH RIÊNG (`git checkout -b thu-nghiem`), không đụng `main`.

**Khoá cứng ở phía GitHub (Duyên làm 1 lần, cần quyền admin repo — AI không tự đổi cài đặt):** GitHub → repo → Settings → Branches → Add branch ruleset/protection cho `main` → bật **"Block force pushes"** (không cho push đè) và **"Restrict deletions"**. Khi bật, force-push sẽ bị GitHub từ chối dù ai làm, kể cả quên quy tắc này.

## Deploy — ĐÃ TỰ ĐỘNG (chốt 2026-10-11, Duyên xác nhận): KHÔNG nhắc deploy nữa
Push `main` là GitHub Actions tự đưa lên chỗ chạy thật (xem tab Actions; chi tiết: `docs/GAS-AUTO-DEPLOY.md`, `docs/CLOUDFLARE-SUPABASE-AUTO-DEPLOY.md`):
- `gas_v13.js` / `gas/**` → workflow `deploy-gas.yml` (clasp, đúng deployment, URL không đổi).
- `cloudflare/**` → `deploy-worker.yml` (Cloudflare Worker).
- `supabase/**` → `deploy-supabase.yml` (áp `supabase/schema.sql`; file PHẢI idempotent).
**Vì vậy KHÔNG nhắc Duyên:** dán code vào Apps Script, Manage deployments → New version, dán `worker.mjs`, chạy SQL trong Supabase, hay bấm "🔄 Đồng bộ mã GAS mới nhất" (nút Copy mã GAS chỉ là đường dự phòng thủ công; không ai còn dán tay). Chỉ cần: push → nói "đã đẩy, workflow tự deploy" + nếu đổi web thì "Ctrl+F5". Chỉ nhắc khi workflow ĐỎ/không chạy (xem Actions) — khi đó mới hướng dẫn xử lý.
Vẫn phải nhắc những việc workflow KHÔNG làm được: chạy hàm cần bấm tay trong Apps Script Editor (vd `xemKhoaExtension`, backfill/đối chiếu Supabase, `xoaSdtLoiThat`), đổi Script Properties, **reload extension** trong `chrome://extensions` khi sửa extension.
Sau khi sửa `gas_v13.js` vẫn PHẢI chạy `node tools/split-gas.js` rồi `--check` (workflow cũng tự sinh lại, nhưng commit phải khớp).
`gas/NN_*.gs` + `gas/INDEX.md` là file TỰ SINH từ `gas_v13.js` (nguồn chính): KHÔNG sửa tay (bị ghi đè, `--check` báo lệch). Tra hàm nằm file nào: `node tools/split-gas.js --where <tên_hàm>` hoặc mở `gas/INDEX.md`.

**Sau khi sửa JS/CSS của extension:** nhắc reload extension trong `chrome://extensions` (không cần deploy riêng).

Cả 2 extension gọi chung 1 URL GAS.
- Zalo AI: `DEFAULT_GAS_URL` hardcode làm dự phòng — cài lần đầu (storage rỗng) tự điền + lưu.
- Pancake AI: `DEFAULT_SETTINGS` trong `pancake-background.js` ghi vào storage qua `chrome.runtime.onInstalled` (chỉ chạy 1 lần lúc cài mới); có nút "↺ Đặt lại về mặc định" trong Options để áp lại.

## Đồng bộ mã GAS cho nút "Copy mã GAS" ✅ (đã xác minh 2026-10-08: CHỈ còn 1 cơ chế)
- `grep -c 'gas-code-v9' index.html` = **0** → khối inline đó ĐÃ XOÁ. KHÔNG còn quy tắc "khối gas-code-v9 phải khớp 100% gas_v13.js" — đừng dò lại, đừng thêm khối đó vào lại.
- Nút "📋 Copy Apps Script Code" gọi `action=getGasSource` (đọc các chunk trong Settings: `gasSourceChunk_N`, `gasSourceChunkCount`, `gasSourceUpdatedAt`; ghi bởi `action=setGasSource` → `setGasSource_`). Client cache `_gasSrcCache` theo phiên, tự xoá sau khi sync.
- Từ v13.19: `getGasSource`/`setGasSource` BẮT BUỘC có `adminKey` (= giá trị dòng `adminKey` trong sheet Settings; app hỏi 1 lần/máy, lưu `ome_admin_key`). Chưa đặt dòng đó = không ai lấy/đồng bộ được mã. Tài khoản test (role `demo`): xem `docs/TAI-KHOAN-TEST.md`.
- (Từ 2026-10-11 deploy tự động nên KHÔNG còn bắt buộc nhắc bước này; chỉ cần khi Duyên chủ động muốn nút Copy trả mã mới.)

## 15 quy tắc bắt buộc khi sửa code (quy tắc 5 = merge-only, xem mục QUY TẮC GIT ở đầu file; quy tắc 14 = chỉ sửa theo yêu cầu mới nhất; quy tắc 15 = song song Zalo AI ⇄ Pancake AI, xem `08-extension-parity.md`)
1. Luôn clone repo MỚI NHẤT bằng token người dùng gửi trong tin nhắn đó (không dùng lại token cũ). Đọc kỹ file liên quan (view/grep) trước khi sửa.
2. Sửa `gas_v13.js` → chạy `split-gas` + `--check`, push; deploy TỰ ĐỘNG, KHÔNG nhắc deploy/đồng bộ mã (mục trên).
3. Sửa JS/CSS extension → nhắc reload extension.
4. Trước khi commit luôn syntax-check: `node -c` cho file `.js`; với client Sasum: `for f in js/*.js; do node -c $f; done` (code client đã tách khỏi `index.html` ra `js/`); khối `<script>` inline còn lại trong `index.html` (nhỏ, <40 dòng) check bằng Function constructor trong Node, bỏ qua `type="text/plain"`. Không commit code chưa kiểm tra.
5. Push bị "rejected" (nhiều phiên cùng sửa): `git fetch` → **`git merge origin/main`** (BẮT BUỘC merge — CẤM rebase / reset / force-push, xem mục "QUY TẮC GIT" ở đầu file) → kiểm tra thay đổi của mình còn nguyên → push lại. Dùng `tools/safe-push.sh` để làm đúng quy trình.
6. Commit message phải nêu RÕ NGUYÊN NHÂN GỐC của lỗi, không chỉ liệt kê đã đổi gì.
7. Sửa hàm dùng chung (vd `_srChartSvg`, `_donSaleNamesFromThe_`, `mergeExtFields_`, `_SRB_COMBO_CFG`...) → grep TOÀN BỘ nơi gọi trước.
8. Trước khi kết luận "không có lỗi": test bằng ví dụ thực tế người dùng đưa (mô phỏng logic bằng Node), không chỉ đọc code.
9. Không sửa thư mục `extension/`.
10. Token GitHub người dùng dán: chỉ dùng cho đúng thao tác, KHÔNG lưu đâu cả. Thấy dán nhiều lần → nhắc nhẹ nên revoke/tạo token mới.
11. Phát hiện quy ước/lỗi mới đáng nhớ → đề xuất cập nhật đúng file KB.
12. Làm xong phần nào push ngay phần đó (từng mục nhỏ) kèm việc cần làm tiếp, để phiên khác tiếp tục được.
13. (Đã thay 2026-10-11) Sửa `gas_v13.js`/`cloudflare/`/`supabase/` → KHÔNG nhắc deploy GAS / Worker / Supabase / đồng bộ mã: đã tự động qua GitHub Actions. Chỉ báo "workflow tự deploy" + Ctrl+F5 nếu đổi web; chỉ nhắc khi workflow đỏ hoặc cần chạy hàm tay. Không còn khối `gas-code-v9`.
14. **CHỈ SỬA THEO YÊU CẦU MỚI NHẤT của Duyên (chốt 2026-10-14, Duyên yêu cầu).** Làm đúng và đủ việc Duyên vừa nhờ; KHÔNG tự sửa / dọn / đổi tên / refactor / đổi hành vi / xoá các mục cũ (tính năng, màn hình, hàm, cấu hình đã có) dù thấy chưa đẹp. Chỉ chỉnh mục cũ khi Duyên báo xoá hoặc chỉnh và việc đó liên quan trực tiếp tới mục cũ đó; khi đó chỉ đụng đúng phần được nêu. Nếu cần sửa nhỏ ở mục cũ để yêu cầu mới chạy được (vd thêm 1 dòng gọi hàm) thì giữ tối thiểu và nói rõ trong tin trả lời. Phát hiện lỗi hoặc việc đáng sửa ở mục cũ ngoài phạm vi: chỉ BÁO ngắn gọn cho Duyên quyết định, KHÔNG tự sửa. Thay đổi lớn ngoài yêu cầu (vd đổi cấu trúc, đổi tên file) phải hỏi trước.
15. **QUY TẮC SONG SONG (2026-10-13):** tính năng có ở Pancake AI thì Zalo AI cũng phải có và ngược lại — làm cho CẢ 2 extension trong cùng lần làm, cùng backend GAS, cùng câu chữ; đặc thù nền tảng thì ghi lý do vào `tools/ext-parity-allow.json`. Chạy `node tools/check-ext-parity.js` trước khi báo xong. Chi tiết + danh sách còn lệch: `08-extension-parity.md`.

## Checklist trước khi báo "đã xong"
1. Đã grep hết mọi nơi gọi hàm vừa sửa chưa?
2. Đã test bằng ví dụ thật (không chỉ đọc code suy luận) chưa?
3. (Deploy GAS/Worker/Supabase tự động — KHÔNG nhắc.) Workflow có đỏ không (tab Actions)?
4. Cần nhắc reload extension không?
5. Thay đổi ảnh hưởng cả 2 extension hay chỉ 1 (nhiều hàm dùng chung backend)? Nếu là tính năng của 1 extension: đã làm cho extension còn lại chưa (quy tắc 15) và `node tools/check-ext-parity.js` đã OK chưa?
6. Đã push + ghi "việc cần làm tiếp" chưa?

## Quy ước UI chung (index.html)
- Design token ở `:root` đầu `<style>` (màu, shadow, radius) — dùng lại, đừng hardcode màu.
- Bảng rộng (`.dash-table`/`.audit-table`) tự có wrapper cuộn ngang trên màn nhỏ qua MutationObserver cuối trang.
- Nút cài đặt admin của tab báo cáo gom vào 1 dropdown "⚙ Cài đặt" (`.gear-menu`/`.gear-menu-list` + `_srToggleGearMenu()`/`closeGearMenus()`), đã áp cho Báo cáo E — theo mẫu này nếu thêm chỗ khác.

## Instruction của Project (rule 13 + 14 + 15)
Instruction của Project (rule 2 và 13) cần SỬA cho khớp: "Deploy GAS/Worker/Supabase đã tự động qua GitHub Actions — không nhắc deploy/đồng bộ mã nữa; chỉ nhắc reload extension, Ctrl+F5 web, hoặc hàm cần chạy tay." (Claude không sửa được Instruction — Duyên cập nhật ở Project settings.) Nên thêm vào Instruction của Project quy tắc 14: "Chỉ sửa theo yêu cầu mới nhất; chỉ chỉnh mục cũ khi Duyên báo xoá/chỉnh liên quan."

**Thêm vào Instruction của Project (quy tắc 15, Duyên dán vào Project settings):** "15. QUY TẮC SONG SONG: tính năng nào có ở Pancake AI thì Zalo AI cũng phải có và ngược lại — khi thêm/sửa tính năng cho 1 extension phải làm luôn cho extension còn lại trong cùng lần làm (cùng backend GAS, cùng câu chữ). Tính năng đặc thù nền tảng thì ghi lý do vào tools/ext-parity-allow.json. Trước khi báo xong chạy `node tools/check-ext-parity.js`. Chi tiết: docs/crm-kb/08-extension-parity.md."

## Quy ước: hàm admin CHẠY TAY trong Apps Script Editor phải là hàm CÔNG KHAI (không có `_` ở cuối tên)
**Nguyên nhân gốc (14/10/2026, Duyên không chạy được `dedupePosNow_` / `installAutoDedupTrigger_`):** trong Google Apps Script, hàm có dấu `_` ở cuối tên là **hàm riêng tư** — bị **ẩn khỏi danh sách chọn hàm** ở thanh công cụ nên không chọn để bấm "Chạy" được. Code cũ vẫn hướng dẫn người dùng chạy thẳng bằng tên có `_` (sai) cho `dedupePosNow_` và `installAutoDedupTrigger_`.
- Hàm cần chạy tay: viết **hàm công khai không có `_`** gọi hàm riêng tư và `Logger.log(kết quả)` (giá trị `return` không hiện ở Editor). Ví dụ: `dedupePosNow()` → `dedupePosNow_()`, `installAutoDedupTrigger()` / `removeAutoDedupTrigger()`, `caiTriggerChiaTuDong` / `goTriggerChiaTuDong` / `chayThuChiaTuDong` / `kiemTraChiaTuDong`, `sbDonHangCaiTrigger`…
- Hàm riêng tư vẫn dùng bình thường cho code và làm handler của trigger (`onChangeDedupTrigger_`, `*Tick_`); chỉ cấm **hướng dẫn người dùng chọn** chúng.
- Khi viết hướng dẫn trong code/giao diện/tài liệu: ghi tên hàm CÔNG KHAI. Test chặn tái diễn: `node tools/test-gas-run-entrypoints.js` (không còn câu hướng dẫn người dùng chọn tên hàm riêng tư; mọi hàm `install*/remove*/…Now_` riêng tư phải có hàm công khai gọi nó).

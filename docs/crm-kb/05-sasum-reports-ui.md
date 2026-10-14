# 05 — Web app Sasum: Báo cáo doanh số A–F (client ở `js/*.js` + `css/*.css`, tra hàm: `js/INDEX.md`)

Phần server của báo cáo nằm ở `gas_v13.js` (xem `02-backend-gas.md`). Sửa client: tìm hàm bằng `grep -n "function tenHam" js/*.js` (hoặc `js/INDEX.md`), syntax-check `node -c` từng file `js/*.js`. (Trước 2026-10-08 code này nằm inline trong `index.html`; các chỗ KB cũ nhắc "index.html" cho code client nay hiểu là `js/`.)

## Quy ước bảng
Mọi bảng breakdown (Theo Sale/Kênh/MKT/Sản phẩm/CS thêm/Nhân viên...) kết thúc bằng 1 dòng "Tổng" in đậm, kẻ trên, dùng chung `_srTotalRowHtml_(cells)`. Cột % (VD %HT KPI báo cáo C) cho dòng tổng tính tỷ lệ có trọng số (Σkết quả ÷ ΣKPI) — KHÔNG cộng dồn % từng dòng.

## Biểu đồ — hàm chung `_srChartSvg(rows, nameKey, valueKey, type, moneyFmt, ordersKey)`
- Chế độ tròn vẽ donut (khoét vòng tròn màu nền đè giữa hình tròn đặc), hiện tổng ở giữa.
- Tham số thứ 6 `ordersKey` (field đếm đơn theo dòng) → thêm dải KPI phía trên: 📦 Tổng số đơn | 💰 Tổng doanh thu | 📊 Trung bình/đơn. Đang gắn cho: Theo Sale/Kênh/MKT (A), Theo Sale (B), doanh thu theo mức đơn hàng (E). Các mục khác (SP theo số lượng, CS thêm KH mới, Hoa hồng theo cột hoa hồng, C theo %HT KPI) cố tình không gắn vì không có khái niệm "1 đơn" rõ ràng.
- Sửa hàm này → grep TOÀN BỘ nơi gọi.

## Báo cáo B — bộ lọc
- 3 bộ lọc CRM (Tình trạng CS, Trạng thái KH, Kết bạn Zalo) dùng combo gõ-tìm/tick-nhiều/chip như Sale/Nguồn đơn/Marketer (đã bỏ `<select multiple>`). Config dùng chung `_SRB_COMBO_CFG`: mỗi mục khai `label`/`optKey` tĩnh (đọc từ `_srState`, như 3 filter gốc) hoặc `getLabel()`/`getOptions()` dạng hàm (cs/kh/zalo — vì danh sách Tình trạng CS và tên trường có thể bị admin đổi, phải đọc lại mỗi lần vẽ).
- Bộ lọc multi-select mới cho báo cáo B → mở rộng `_SRB_COMBO_CFG`, KHÔNG dựng listbox/widget riêng.
- `exportSalesReportToSheet()` PHẢI gửi đúng y hệt bộ filter như lúc xem (dateFrom/dateTo/sale/nguon/marketer/careStatus/khStatus/zaloStatus/nickZalo). Từng lệch ở B (thiếu 3 filter CRM khi xuất, đã fix). Số liệu "Xuất ra Sheet" không khớp màn hình → soi chỗ này đầu tiên.

## Báo cáo C
Dùng chung `_srRenderCTable` (client). Xem thêm quy ước dòng Tổng ở trên.

## UI chung
Design token `:root`, wrapper cuộn ngang bảng rộng, dropdown "⚙ Cài đặt" admin: xem cuối `01-rules-and-deploy.md`.

## AI phân tích team (v13.23) — `js/30-fn-teamanalysis.js` + `teamAnalysis_` (gas_v13.js)
- Menu trái → 📊 Báo cáo → "🤖 AI phân tích team" (chỉ admin). Chọn khoảng ngày → bảng xếp loại từng người + tổng quan/điểm tốt/rủi ro.
- Server gom 4 báo cáo có sẵn theo tên chuẩn hoá (`_normTxt_`): `buildSaleKpiReport_` (doanh thu, đơn, %KPI), `buildKpiReport_` (tin nhắn, tỷ lệ chốt Pancake), `buildFailedOrderReport_` (đơn thất bại), `buildCareLeadReport_` (CS thêm KH).
- Điểm 0–100 do QUY TẮC (`scoreTeam_`): %KPI 45 + doanh thu so với team 20 + tỷ lệ chốt so với mức giữa team 20 + chất lượng đơn 15; thành phần thiếu số liệu bị bỏ qua (không trừ điểm). ≥70 Làm tốt, 45–69 Trung bình, <45 Cần cải thiện, <2 thành phần = Chưa đủ dữ liệu. AI (`_taCallAI_`: Groq→Cerebras→Gemini) CHỈ viết nhận xét/việc cần làm, KHÔNG đổi xếp loại; AI lỗi/thiếu key vẫn ra bảng đầy đủ (nhận xét theo quy tắc). Không gửi SĐT khách cho AI.
- Kết quả có AI cache 10 phút theo khoảng ngày (`teamAI_v1_*`); nút "↻ Làm mới" = `&refresh=1`. Đổi trọng số/ngưỡng → sửa `scoreTeam_` rồi đổi key cache (`v1`→`v2`).
- Chưa rõ: "đơn thất bại" có nằm trong "số đơn" của KPI Sale không — hiện tính tỷ lệ thất bại = thất bại ÷ (đơn + thất bại).

## Tổng quan + Hồ sơ nhân sự + vai trò Quản lý (v13.24) — `js/31-fn-orgoverview.js` + `orgOverview_` (gas_v13.js)
- Sau đăng nhập, khi `#data-view` hiện, web tự vào tab **🏠 Tổng quan** (nếu đang ở tab mặc định 'list'; tài khoản test thì vào Báo cáo như cũ). Các mục khác vào qua ☰ Menu → nhóm tương ứng (nhóm "🏠 Tổng quan" nằm đầu menu; id quyền xem = `overview`).
- Phân cấp: Công ty → **Phòng** (= nhóm Sale ở "Phân loại đội Sale": `SALE_GROUPS`/`saleChannels`; chưa phân loại = "(chưa phân phòng)") → **Team** (sheet Teams) → Nhân viên. Người ở 2 team được tính ở cả 2 team.
- **Vai trò & phạm vi xem** (lọc ở CLIENT trong `_ovScope`, chưa có kiểm soát phía server — đợi bước 4 của docs/SECURITY-PLAN.md): admin = toàn công ty; **manager (Quản lý)** = các phòng được tích ở form Tài khoản (lưu ở cột `team` của sheet Users, key phòng cách nhau dấu phẩy) + thành viên các team thuộc phòng + leader của các team đó; leader = team của mình; CS = chỉ mình (hiện thẳng hồ sơ). Hồ sơ chỉ mở được nếu người đó nằm trong phạm vi (`_ovCanSee`).
- Role `manager` ở các màn CŨ (khách, dashboard, bộ lọc CS) bị coi như CS = chỉ theo danh sách tên sale Admin gán cho tài khoản (cố ý, tránh rơi vào nhánh "else = thấy hết"). Muốn Quản lý xem rộng hơn ở màn cũ: tích thêm sale vào tài khoản.
- Hồ sơ nhân sự: đơn TB/ngày (= số đơn ÷ số ngày trong kỳ tới hôm nay; kèm đơn/ngày có phát sinh, so với TB team), doanh thu, giá trị đơn TB, %KPI, tỷ lệ chốt, đơn thất bại, KH thêm mới, biểu đồ đơn theo ngày (ẩn nếu kỳ > 93 ngày), xếp loại + điểm (quy tắc `scoreTeam_`), nút AI nhận xét (gọi `teamAnalysis`, cache 10 phút). Leader có thêm danh sách nhân viên trong team.
- Server: `orgOverview_` gom `buildTeamMetrics_`+`scoreTeam_` + `buildSalesReportB_({withDaily:true})` (đơn theo ngày từng sale, mặc định TẮT ở mọi nơi gọi khác), cache 5 phút `orgOv_v1_*` (refresh=1 bỏ cache).

## Tab Danh sách KH — thanh "Tổng quan & tác vụ" (2026-10-11)
Thanh `#lov-bar` (index.html, ngay trên `.stats-row`) bấm để mở/đóng 6 ô thống kê (`.stats-row`) + thanh tác vụ (`#tab-list > .toolbar`: đếm KH, sắp xếp, chiến dịch, Thêm KH/Đơn mới, Xuất CSV). Trạng thái nhớ ở localStorage `ome_list_ov_open` ('1' mở / '0' đóng); chưa chọn thì màn hẹp (≤900px) thu gọn, màn rộng mở sẵn. Logic `_lovIsOpen_`/`_lovSync_`/`toggleListOverview` ở js/05-fn-saveeditphone.js (gọi lại cuối `switchTab`), CSS khối `.lov-bar` cuối css/01-base.css (class body `lov-on-list` = đang ở tab Danh sách, `lov-open` = đang mở; ẩn khi `ov-mode`/`rpt-mode`). Nút "⚙ Lọc nâng cao" (`#adv-filter-btn`, id/onclick giữ nguyên) nay nằm trong thanh lọc `#ymf-bar` cạnh ô "Từ giờ – Đến giờ", luôn thấy kể cả khi thu gọn.

## Panel chi tiết KH — menu gập + tự động lưu (2026-10-11)
Tab "Chăm sóc" của panel (`renderCareTab`, js/03-fn-refreshopendptab.js) có 2 mục gập của 1 menu: "Thông tin chăm sóc" (`.dp-acc[data-acc=care]`) và "Lịch chăm sóc nhanh" (`data-acc=sched`, badge số lịch đã đặt); `dpAccToggle` chỉ mở 1 mục một lúc, mục đang mở nhớ ở `_dpAccOpen`. Đã BỎ 2 nút "Lưu tình trạng / Lưu lịch hẹn + Sync GSheets" (nút chỉ lưu local rồi `queueCareSync` gửi GAS — nhãn Sync gây hiểu nhầm). Thay bằng tự lưu: listener `input`/`change` trên `#dp-body` → `_dpAutoSaveSoon_` (debounce 0,5–1,2s) → `_dpAutoFlush_` gọi lại đúng `saveCare(phone,{quiet:true})` / `saveCareSchedules(phone,{quiet:true})` (cùng đường ghi cũ, không toast, không vẽ lại danh sách ngay — `applyFilters` dồn lại khi đóng panel/mở KH khác). Lưu nốt khi: `openDp`, `closeDp`, đổi tab panel, ẩn trang/`pagehide`. Ô KHÔNG tự lưu: `cs-note-new` (có nút Thêm), `cs-assign-input` (chọn CS mới tính — `csAssignPick` phát sự kiện change), `cs-tag` (`onTagChange` tự lưu), `remind-*`, `cs-zalophone-*`. Chip nick Zalo / SĐT Zalo (hidden input) gọi `_dpAutoSaveSoon_` trực tiếp. RIÊNG đổi sang trạng thái "chốt" (`_hIsChot_`, tạo đơn chốt) KHÔNG tự lưu: hiện nút `#cs-save-btn` "Xác nhận lưu trạng thái chốt" (`_dpConfirmChotSave_`); KH đã ở trạng thái chốt thì các ô khác vẫn tự lưu. `saveCareSchedules` quiet bỏ qua nếu 8 trường lịch không đổi (tránh ghi nhật ký thừa).

## F5 không mất chỗ (2026-10-11)
`js/40-main-restorenav.js` + khung `#boot-splash` đầu `<body>` (index.html, tự gỡ sau 20s phòng script lỗi). Vị trí lưu ở hash `#v=<data-bar-id mục menu>&c=<SĐT>` + sessionStorage `ome_nav_v1`; đăng xuất (`doLogout`) xoá cả hai. Khôi phục bằng cách `.click()` đúng tab (nên tôn trọng quyền: tab bị ẩn thì bỏ qua) rồi `openDp(SĐT)` khi `allCustomers` đã có khách đó; chờ tối đa 60s. CHƯA nhớ: bộ lọc Danh sách KH, vị trí cuộn, báo cáo con (A–F) đang xem, mục đang mở trong hồ sơ khách.

## Chat Pancake trong hồ sơ khách (2026-10-12)
Tab "💬 Chat" (tab thứ 5 của `.dp-tabs`, `data-tab="chat"`; `_order` trong `renderDpTab` có thêm `'chat'` — highlight tab theo THỨ TỰ nên tab mới phải ở cuối). Logic `js/41-fn-pkchat.js`, backend GAS `gas/25_PancakeChat.gs`, bảng Supabase `pk_conversations`/`pk_messages` (webhook ghi). Chi tiết + việc cần làm tay (deploy GAS, Script properties `PANCAKE_PAGE_TOKENS`): `docs/PANCAKE-INBOX.md`.

## Chat nội bộ nhỏ (#tc-mini) và Trợ lý AI (#pro-ai) không đè nhau (2026-10-14)
Cả hai nằm góc dưới phải, cùng `z-index:320`. Khi AI mở, `proAiToggle_` (js/38-pro-dock.js) bật class `html.pro-ai-open`; css/07-teamchat.css dịch `#tc-mini` sang trái đúng bằng bề rộng AI qua biến dùng chung `--pro-ai-w` (khai báo ở css/06-pro.css, `#pro-ai{width:var(--pro-ai-w)}`), cắt phần thừa từ bên trái (danh sách kênh ở cạnh phải luôn còn); màn <1100px chỉ giữ danh sách kênh, các cửa sổ hội thoại tạm ẩn rồi hiện lại khi đóng AI. Muốn đổi bề rộng AI thì chỉ sửa `--pro-ai-w`. Thêm panel nổi mới ở góc dưới phải thì làm tương tự (class trên `html` + dịch `#tc-mini`), đừng đặt thêm `z-index` ngang nhau.


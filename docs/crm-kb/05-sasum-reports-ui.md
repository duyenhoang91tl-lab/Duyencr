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

## Mốc màu "Tỷ lệ chốt" nhiều mức (2026-10-14)
Setting `closeRateThresholds` (GAS Settings + cache local `ome_close_rate_thresholds`) nay có dạng `{ "levels": [ {"from":0,"color":"#dc2626"}, {"from":2,"color":"#d97706"}, {"from":11,"color":"#16a34a"} ] }`: mức i áp dụng cho tỷ lệ `>= from` (và `<` from của mức kế); mức đầu luôn từ 0; 2–8 mức; admin thêm/bớt/đổi màu/đổi mốc ở "✎ sửa mốc" (form mặc định ẨN). Chuẩn hoá + đổi dạng cũ `{red,green}` ở `_crNormalize_` (js/01-fn-splitmulti.js; tỷ lệ hiển thị là số nguyên nên "> green" = "≥ floor(green)+1", màu giữ y hệt cũ), tô màu `_crColorFor_`, vẽ + form ở `_srCloseRateBarHtml_`/`_srCrFormHtml_` (js/11-fn-srload.js). Dùng chung cho Báo cáo A/B (theo Sale, Kênh, Page) và tab KPI Pancake. Test: `NODE_PATH=<nơi cài jsdom> node tools/test-close-rate-levels.js` (23 ca).

## Tỷ lệ chốt: gộp "cùng 1 người" (tên base ≠ tên pos) — 2026-10-15
- `_srCloseRateSections_` (gas_v13.js, dùng chung Báo cáo A/B/KPI) đếm ĐƠN theo tên Sale trên POS (`saleBanRaw`) và lấy TƯƠNG TÁC theo tên Sale sau khi khớp `PancakeNameMap` (`byCS`). Trước đây chỉ gộp bằng `_normTxt_(tên)` nên `thuydinh1995` (Pancake) và `thuydinh95` (POS) thành 2 dòng, dù đã link.
- Nay gộp bằng `_salePersonKeyFn_()` (union-find) từ 4 nguồn liên kết: Users `names` + `salePersonTags` (`_userAliasGroups_`), `SaleDirectory` (maSale/tenFacebook/userBase/tenTagPancake), `PancakeNameMap` loại 1-1. Dòng `saleA|saleB` BỎ QUA (nối qua tên Pancake sẽ gộp nhầm 2 người). Áp dụng cho cả bảng theo Sale lẫn theo Page; cộng dồn, không ghi đè.
- Tên hiển thị = tên phía Pancake (nếu có tương tác), không thì tên POS. Người dùng `csStats` khớp theo `myFold` nên tên hiển thị phải nằm trong các tên của CS đó.
- Chưa link ở đâu cả → vẫn tách 2 dòng (không tự đoán). Test: `node tools/test-closerate-person-fold.js` (12 ca, chạy hàm thật).
- BỔ SUNG (cùng ngày): màn "Báo cáo Pancake → Khớp tên" chỉ nối tên NHÂN VIÊN PANCAKE → Sale CRM; KHÔNG có chỗ nối tên thẻ POS (vd `thuydinh95`). Nên ngoài 4 nguồn trên còn gộp tên "mồ côi" (có đơn, 0 tương tác) theo quy ước sẵn có của `_resolveBonusSale_` (`_foldSaleKey_` bỏ số đuôi, tiền tố ≥ 4 ký tự) — CHỈ khi khớp ĐÚNG 1 tên có tương tác (`_salePersonKeyWithOrphanFold_`); nhập nhằng thì không gộp.
- Biểu đồ tỷ lệ chốt lọc `held>0` nên dòng mồ côi từng bị ẨN im lặng (đơn "biến mất", trung bình lệch). Nay hiện khung cảnh báo cam liệt kê đơn chưa gán được + hướng dẫn thêm "Tên khác" ở 🔑 Tài khoản (`_srCloseRateBarHtml_`, js/11).

## Cảnh báo ⚠️ trong báo cáo: MẶC ĐỊNH ẨN, bấm 👁 mới hiện (Duyên yêu cầu 2026-10-12)
Mọi khung cảnh báo trong báo cáo (đơn chưa gán, tên/Page chưa khớp, cảnh báo dữ liệu...) PHẢI bọc bằng `_warnBox(key, boxHtml, label)` (định nghĩa đầu `js/10-fn-pkkpipct.js`, dùng chung js/10 + js/11) — KHÔNG chèn thẳng `<div ...⚠️...>` vào báo cáo. Nút 👁 hiện nhãn ngắn (vd "262 đơn chưa gán…"), bấm mới mở khung đầy đủ; trạng thái đã mở được nhớ theo `key` (`_warnOpen`) nên báo cáo vẽ lại không tự đóng. Đã bọc: `cr-orphan` (tỷ lệ chốt, js/11), `kpi-warnings`, `kpi-unmapped-sales`, `kpi-unmapped-pages`, `kpi-dash-unmapped` (js/10). Thêm cảnh báo mới → đặt `key` mới. Test: `node tools/test-warn-eye.js`.

## Trang riêng "🏢 Phòng ban" (cài đặt phòng) — 2026-10-14
Trước là hộp thoại (`#dept-modal`), nay là trang toàn màn hình `#dp-page` (dùng khung `.rs-page` của trang Phân quyền, CSS `.dpg-*` cuối css/05-sidenav.css). Mở từ **Settings → 🏢 Phòng ban** (act `dept`, admin) hoặc nút "⚙ Cài đặt phòng" ở Tổng quan (cùng gọi `openDeptSettings`). 3 mục: Danh sách phòng / Gán theo team / Từng người; nút 💾 Lưu phòng luôn ở thanh trên. Tự đọc `deptList` + `saleDepts` từ máy chủ (`action=getSetting`, kèm `_t=` chống cache) nên KHÔNG cần đợi Tổng quan tải. Lưu = `setSetting` deptList → `setSetting` saleDepts → ĐỌC LẠI cả hai so khớp rồi mới báo xanh; mọi lỗi hiện nguyên văn ngay trên trang (máy chủ trả HTML, key 2 lỗi, đọc lại khác, mất mạng, quá 25 giây) kèm gợi ý mở `?action=count`. Làm mới Tổng quan chạy nền, lỗi ở đó không bị báo thành lỗi lưu. Lưu ý: backend không đổi (vẫn `setSetting`, không cần deploy GAS để trang này chạy).

## Lời hướng dẫn / nhắc nhở cách dùng: MẶC ĐỊNH ẨN (Duyên yêu cầu 2026-10-12)
Mọi câu **hướng dẫn cách dùng / giải thích cách tính / "bấm… để…"** trong màn hình PHẢI có class `guide-text` (hoặc là một trong `task-form-hint`, `tf-hint`, `srb-m-hint`, `pro-ai-hint`) — CSS `body:not(.show-guides) .guide-text{display:none}` (css/01-base.css) sẽ ẩn. Người dùng bật lại ở menu ☰ → ❓ Hướng dẫn sử dụng → ô "Hiện lời hướng dẫn / nhắc nhở trong các màn hình" (`setGuides`, localStorage `ome_show_guides`, js/43-fn-uxtools.js). Ví dụ: `<div class="guide-text" style="font-size:11px;color:var(--muted)">Bấm tên Team để cài tỷ lệ…</div>`.
- **KHÔNG gắn `guide-text`** cho: câu trạng thái trống ("Chưa có…", "Chưa nạp báo cáo… vào tab … để nạp" — ẩn đi màn hình trông như hỏng), cảnh báo ⚠️ (dùng `_warnBox` ở mục trên), dữ liệu/ghi chú nghiệp vụ.
- Màn "❓ Hướng dẫn sử dụng" (js/43) là nội dung xem theo yêu cầu nên giữ nguyên. Placeholder ô nhập giữ nguyên.
- Test: `node tools/test-guides-hidden.js` (kiểm không gắn nhầm vào cảnh báo/trạng thái trống, công tắc, HTML không vỡ).

## Báo cáo B (Pos) ẩn Sale/Kênh theo cài đặt admin (2026-10-14)
- **Lỗi gốc:** cài đặt admin "Ẩn Page/Sale" (`hiddenSales` / `hiddenChannels`) chỉ được kiểm ở `readDTTong_` (Báo cáo A) và `buildPancakeReport_`; `buildSalesReportB_` đọc "dữ liệu đơn" Pos nhưng KHÔNG hề kiểm → sale đã nghỉ/ẩn (vd Dung1987) vẫn hiện ở báo cáo Pos (và các báo cáo dùng lại B: E hoa hồng, F, G...).
- **Sửa:** `_donHiddenChecker_` (cạnh `_hiddenPageSaleSets_`) so khớp theo NGƯỜI (mọi tên cùng 1 người qua `_salePersonKeyFn_`, không so chuỗi y nguyên); đơn chỉ bị ẩn khi MỌI sale trên đơn đều bị ẩn (còn ≥1 sale không ẩn thì giữ, như `_isDTRowHidden_`) hoặc kênh (suy từ Nguồn đơn qua `_donKenhFromNguon_`) bị ẩn. Áp ở vòng lọc của B, sau bước lọc Sale/ghép đơn Base.
- **Muốn sale nghỉ biến mất khỏi mọi báo cáo → thêm tên vào "Ẩn Sale" ở Cài đặt** (hệ thống KHÔNG có trạng thái "đã nghỉ" riêng).
- Tỷ lệ chốt A = B do hàm dùng chung `_srCloseRateSectionsFromBase_` (đơn Base, bỏ đơn BH không doanh thu) — xem mục "TỶ LỆ CHỐT" phía trên/dưới. Chạy tay `xemTyLeChotAB` để so kênh + sale của A và B tháng này (log KHOP/LECH).
- Test: `node tools/test-closerate-ab.js` (hàm thật + chạy `buildSalesReportB_` thật với dữ liệu giả).

## Bảng đơn theo giai đoạn: hiện MÃ BỘ ĐẾM, bấm để sao chép — 2026-10-16
- Thẻ và tiêu đề modal hiện **mã bộ đếm** (cột U của DT TỔNG, vd `196T10/2026`, `BH196T10/2026`) thay cho id số của Base; đơn chưa có mã bộ đếm lùi về `#id`. Modal còn hàng "Mã đơn Base #id" để tra trên Base. Tìm kiếm khớp cả mã bộ đếm lẫn id.
- GAS: `ttStageBoard_` gọi `readDTTong_(true)` (đọc thêm cột U) và `_ttBoardBuild_` thêm `maBoDem` vào từng thẻ. Danh sách "Đơn kẹt" ở trang chủ (`ttTodayTasks_`/`_ttStuckFromRows_`) vẫn hiện id số vì không đọc DT TỔNG — nếu cần đổi theo thì phải map id→maBoDem ở đó (tốn thêm 1 lần đọc DT TỔNG).
- Chip mã (`.sb-code`, js/41) bấm = sao chép (`navigator.clipboard`, dự phòng `execCommand`), `stopPropagation` nên không mở modal. Test: `tools/test-stageboard-bodem.js` (jsdom), `tools/test-stageboard-gas.js`.

## 🔗 Khớp sale (2026-10-15) — 1 chỗ khớp mọi tên của cùng 1 người
Menu **Cài đặt team → 🔗 Khớp sale** (admin; `js/52-fn-salematch.js`, ACTS.salematch). Quét tên ở: tài khoản + tên CRM (Users), Quản lý tài khoản (mã Sale / TK Facebook / user Base / thẻ Pancake), Pancake (`pancakeAllNames_` + PancakeNameMap), Base (Sale bán + Người tạo của DT TỔNG), Pos (cột Thẻ) — kèm số lần xuất hiện (GET `saleMatchCandidates`, chỉ admin/manager theo token phiên). 3 tab: **Đã khớp** (nhóm, đổi tên chính, thêm/bỏ tên, tách nhóm; mục "Hệ thống tự gộp" cho tên đã tự hiểu cùng người qua Users/Quản lý tài khoản/PancakeMap → bấm "Cố định thành nhóm"), **Chưa khớp** (tick nhiều tên → Gộp vào nhóm có sẵn hoặc người mới), **Gợi ý** (tên giống nhau sau khi bỏ dấu/khoảng trắng/số đuôi nhưng chưa cùng người).
- **Lưu ở `salePersonTags`** = `{ "<tên chính>": ["tên khác", ...] }` — CÙNG kho với "Thẻ nhân viên" cũ (`js/50-person-tags.js`), nên backend `_userAliasGroups_` → `_salePersonKeyFn_` (union-find) và `_expandSaleFilterWithPancakeAliases_` đọc sẵn: lọc Sale/Team, bảng "Theo Team", báo cáo A/B/E/F/G, Ẩn Sale đều dùng chung, 2 chiều. Mỗi tên chỉ ở 1 nhóm.
- **Sửa lỗi "lọc Team vẫn sai":** `_expandSaleFilterWithPancakeAliases_` trước đây mở rộng 1 LẦN theo thứ tự cố định (PancakeMap → Users/thẻ → SaleDirectory) nên chuỗi A~B (thẻ) rồi B~C (SaleDirectory) hoặc chọn tên Pancake chỉ ra đủ tuỳ thứ tự. Nay nạp 3 nguồn 1 lần rồi LẶP đến khi hết tên mới (≤10 vòng); PancakeMap chiều ngược chỉ khi 1-1 (dòng `saleA|saleB` không gộp 2 người).
- Test: `node tools/test-salematch.js` (backend) + `node tools/test-salematch-ui.js` (giao diện, cần jsdom).


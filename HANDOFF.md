# ⛔ ĐỌC TRƯỚC KHI PUSH — GIT MERGE-ONLY (2026-10-12)
Bắt buộc `git merge origin/main` khi push bị từ chối; CẤM force-push / reset / rebase / amend commit đã push / clone-mới-chép-đè. Dùng `TK=<token> bash tools/safe-push.sh`. Lý do: 7 commit đã push biến mất khỏi `main` vì ghi đè lịch sử. Quy tắc đầy đủ + cách khoá cứng trên GitHub: `docs/crm-kb/01-rules-and-deploy.md` mục "QUY TẮC GIT".

# HANDOFF — Giao diện PRO (kiểu Creatio)

Giao diện pro là MẶC ĐỊNH — `<html class="ui-pro">` gắn cứng trong index.html; ĐÃ BỎ công tắc `?ui=pro`/`?ui=classic` và localStorage `ui_mode` (không còn bản cũ để quay lại).
Mọi CSS mới nằm trong `css/06-pro.css`, mọi selector bắt đầu `html.ui-pro` (làm không gian tên; test: `node tools/test-ui-pro.js`).

## Tiến độ
- [x] **P0 — Nền thiết kế**: `css/06-pro.css` (pro-card, pro-kpi, pro-chip, pro-stage, pro-tl, pro-next, pro-gauge) + **P0b**: da header gradient tím + ngăn kéo menu ☰ tím (chỉ đổi màu, không đổi bố cục). Công tắc `?ui=pro` đã gỡ — pro luôn bật.
- [x] **P1 — Trang chủ** (phiên khác làm: `js/36-pro-home.js`, commit da9392a, test `tools/test-ui-pro-home.js`; kiểm tra lại phần ô cài mục tiêu doanh số nếu cần): đồng hồ doanh số/tỷ lệ chốt (dùng csStats), phễu theo tình trạng CS, thẻ Khuyến nghị (luật gợi ý từ Pancake). Chỉ vẽ SỐ TỔNG HỢP (~136k khách, không vẽ danh sách). Cần thêm ô cài mục tiêu doanh số (chưa có nơi lưu → dùng setSetting/getSetting).
- [x] **P2 — Hồ sơ khách 360°** (file `js/33-pro-profile.js`, test `node tools/test-ui-pro-profile.js`):
  - [x] 2a: thanh giai đoạn (cây Tình trạng CS, CHỈ tô giai đoạn hiện tại, không tô "đã qua" vì cây CS không phải phễu tuyến tính) + 3 ô số (ngày từ đơn cuối / số đơn / doanh thu). Chèn khối `#dp-pro` giữa `.dp-hdr` và `.dp-tabs` bằng cách bọc `openDp` + `renderDpTab` (không sửa hàm gốc).
  - [x] 2b: khung "Việc tiếp theo" = tối đa 3 lịch CHƯA xong của khách (quá hạn → hôm nay → sắp tới), nút "Xem/+ Đặt lịch" chuyển sang tab Lịch hẹn. Nguồn: biến toàn cục `schedules` (không dùng cột schedGoi/SP/CS/Hen của careData).
  - [x] 2c: timeline (thẻ `<details>` thu gọn) gộp ghi chú (`_parseNotes`, giờ dạng `HH:MM dd/mm/yyyy`) + lịch hẹn + đơn (ưu tiên `_posOrdersCache` nếu đã tải, không thì `c.orders`), tối đa 30 mục.
  - [ ] Còn lại (tuỳ chọn): gợi ý hành động từ luật Pancake (vd "khách quá hạn hẹn → lên lịch") chưa đưa vào khung Việc tiếp theo; cần xem extension-pancake/pancake-content.js phần gợi ý. Chưa test trên trình duyệt thật.
  Lưu ý: `o.month` là 1–12, `o.year` có thể 2 chữ số (<100 → +2000).
- [x] **P3 — Báo cáo A–L**: đồng bộ thanh lọc (nhớ đủ preset Hôm nay/Hôm qua/Tuần này/Tuần trước/Tháng này/Tháng trước/quý/năm), ô số, biểu đồ SVG (không thêm thư viện).
  - [x] 3a: kiểm kê lọc ngày. Báo cáo A–L, KPI Pancake, Dashboard ĐÃ đủ preset (dùng `_quickRangeSelectHtml` + `_PK_QUICK_RANGES` ở js/16, hàm tính `_pkQuickRange` ở js/10). THIẾU 2 chỗ → đã bổ sung: "AI phân tích team" (`_taQuick`) và "Tổng quan" (`_ovQuick`, tự tải lại). Giữ nút "7 ngày". Test: `node tools/test-quick-range-presets.js` (trích hàm thật, giả ngày CN 11/10/2026 và 15/01/2026). Không đụng được `_dbRender` (xem 1 ngày) và `_fuResultAsk` (chọn ngày hẹn, không phải bộ lọc).
  - [x] 3b+3c: `_srChartSvg` (js/10) có nhánh `html.ui-pro`: 3 ô số màu (Tổng số đơn / Tổng DT / TB đơn) thay dải KPI cũ khi có `ordersKey`; không có `ordersKey` (bar) → 1 ô "Tổng"; pie không `ordersKey` giữ TỔNG ở giữa donut; bảng màu pro + thanh cột bo tròn. Hàm phụ nằm ở `js/34-pro-charts.js` (`_PRO_CHART_COLORS`, `_proKpiStrip_`, `_proTotalTile_`). KHÔNG đổi chữ ký hàm → 19 nơi gọi (js/10, 11, 12, 13) không phải sửa. Tắt ui-pro → đầu ra giống hệt bản cũ. Test: `BASE_REF=<commit trước P3b> node tools/test-ui-pro-charts.js` (so sánh với bản gốc).
  - Chưa làm (tuỳ chọn): đưa kiểu pro vào các bảng/thanh lọc khác của báo cáo A–L (hiện chỉ biểu đồ + ô số); chưa xem thử trên trình duyệt thật.
- [x] **P4 — Dock phải + trợ lý AI + thanh tab hồ sơ** (`js/38-pro-dock.js`, CSS cuối `css/06-pro.css`; test `tools/test-ui-pro-dock.js` + `tools/test-crm-ask.js`):
  - Thanh tab dưới cùng: bọc `openDp`/`closeDp`, nhớ tối đa 8 khách trong `sessionStorage['pro_tabs']`, bấm tên = mở lại, × = đóng (đóng tab đang mở thì đóng luôn hồ sơ). Chừa 84px bên phải cho chuông nhắc hẹn (`.reminder-bell`).
  - Dock phải (`#pro-dock`, nút 🤖; màn ≤900px thành nút tròn góc phải dưới, trên chuông) mở panel `#pro-ai`: 2 chế độ "Khách đang mở" / "Doanh số".
  - Backend: `callAI_` (gas_v13.js, **v13.32-crm-ask**) có nhánh `data.crmAsk` → prompt hệ thống riêng `_crmAskSystemPrompt_` (chỉ dùng NGỮ CẢNH, không bịa số), KHÔNG kéo kiến thức sản phẩm/ảnh, giới hạn 9000 ký tự; luồng CS cũ giữ nguyên. Web gọi `POST {action:'ai', crmAsk:true, prompt}` (không header lạ, tránh preflight CORS).
  - Quyền riêng tư: ngữ cảnh dựng ở web từ số liệu người dùng ĐƯỢC xem (khách đã mở; doanh số qua `_ovScope` theo vai trò) và ẨN SĐT (`proScrub_`: cả trong tên/ghi chú/lịch/câu hỏi). AI chỉ gợi ý, không ghi dữ liệu.
  - Doanh số cần đã tải màn 🏠 Tổng quan (dùng `_ov.data`); chưa tải thì panel hướng dẫn, không gọi AI.
  - `proProfileData_(c)` (js/33) là hàm gom dữ liệu 1 khách dùng chung cho hồ sơ 360° và trợ lý.
  - **P4b — Engine "trả lời thô" (MẶC ĐỊNH, không cần key AI)**: `PRO_AI_ENGINE = 'rule'` (js/38). `proIntent_` nhận ý định từ câu hỏi (bỏ dấu + regex), `proRuleCustomer_` (tóm tắt / việc tiếp theo / tin nhắn mẫu) và `proRuleSales_` (tóm tắt / ai cần hỗ trợ / điểm đáng chú ý) tự viết câu từ số liệu — số luôn đúng, không gọi mạng, không gửi dữ liệu đi. Câu ngoài mẫu → báo chưa hiểu, mời bấm gợi ý. Đặt `PRO_AI_ENGINE = 'ai'` để dùng lại nhánh AI (cần key trong Settings, gas v13.32).
  - **Việc tiếp theo (đã chốt với Duyên)**: làm chế độ DỰ PHÒNG — dùng AI khi có key, tự rơi về engine quy tắc khi chưa có key/AI lỗi (hiện chưa nối; chỉ cần gọi `proRuleAnswer_` khi `proAskRequest_` trả `ok:false`).
  - Chưa làm (tuỳ chọn): lưu lịch sử chat, hỏi đáp có quyền ghi (đặt lịch/ghi chú bằng AI), cache câu trả lời. Chưa xem thử trên trình duyệt thật (đã smoke test bằng jsdom, không commit vì cần cài jsdom).

## Ràng buộc
Phân quyền (admin/quản lý/leader/CS) quyết định tab hiển thị. Chưa lưu: mục tiêu doanh số, số cuộc gọi (chờ phần kết quả cuộc gọi của phiên khác). Không sửa `extension/`. Không đổi thứ tự thẻ `<script>`.


---

# HANDOFF — Công việc kiểu Base (quy trình + giai đoạn + thảo luận)  [bắt đầu 2026-10-11]

Yêu cầu của Duyên: tab Công việc có nhiều LOẠI quy trình, mỗi loại có các GIAI ĐOẠN riêng; mỗi giai đoạn có người phụ trách; thảo luận dưới công việc (tag @người, gửi tệp); giai đoạn đánh dấu "cần duyệt" thì chuyển tiếp phải gửi request → người duyệt Chấp nhận/Từ chối; ai nhận bước nào thì xong bấm "Chuyển tiếp". Tham chiếu: ảnh chụp Base (Tổng quan: thanh giai đoạn, tiến độ từng giai đoạn + người thực hiện; Thảo luận; Tài liệu đính kèm).

## Mô hình dữ liệu (GAS, sheet tự tạo)
- `TaskFlows` (id,name,stages JSON `[{id,name,approval}]`) — tự seed 2 mẫu (Hoàn tiền/chi tiền, Xử lý đơn hàng) khi rỗng. `approval=true` = rời giai đoạn này phải được người duyệt chấp nhận.
- `Tasks` thêm cột cuối: flowId, stageIdx (== số giai đoạn nghĩa là đã xong), stageAssignees {stageId:[tên]}, stageApprovers {stageId:[tên]}, stageLog [{stageId,startedAt,doneAt,by,approvedBy}], mentions. Server tự giữ flowId/stageIdx/stageLog khi sửa task (client không ghi đè được).
- `TaskComments` thêm cột: files [{name,url,mime,size}], mentions [tên], kind (comment|system|request), refId (id request).
- `TaskRequests` (id,taskId,fromStageId,toStageId,requestedBy,approvers,status pending|approved|rejected,decidedBy,decidedAt,note,createdAt).
- Action: GET `taskFlows`, `taskRequests?taskId=`, `tasks` (kèm `pendingReq` từng task); POST `saveTaskFlow`, `deleteTaskFlow`, `taskAdvance {taskId,by,note}`, `taskRequestDecide {requestId,by,decision:'approve'|'reject',note}`. Test: `node tools/test-task-flow.js`.
- Quyền hiện tại kiểm theo TÊN client gửi (cùng mức bảo mật các action task cũ). Admin chưa có đường "ép chuyển". Nếu cần chặt hơn → gắn session token (xem `_sessUser_`).

## Tiến độ (cập nhật 2026-10-12)
- [x] M1 — Backend GAS: quy trình/giai đoạn, chuyển tiếp, request/duyệt, comment có files/mentions/system.
- [x] M2 — `js/44-fn-taskflow.js`: chọn Loại công việc khi tạo/sửa (`#task-f-flow`), gán người thực hiện/người duyệt từng giai đoạn, `_tfValidate`, `_tfCollect` (ghép vào `saveTaskFromModal` js/26). Chọn quy trình → ẩn Team/user cũ + ô Trạng thái; sửa việc đã có quy trình → khoá đổi quy trình.
- [x] M3 — Modal chi tiết (`#task-detail-flow`): thanh giai đoạn, thẻ giai đoạn hiện tại + nút Chuyển tiếp/Gửi yêu cầu duyệt, hộp yêu cầu chờ duyệt (Chấp nhận/Từ chối), timeline giờ thực tế, nhãn giai đoạn trong danh sách (`_tfListBadge`). Mô hình thuần `_tfStageModel`.
- [x] M4 — Thảo luận: dòng hệ thống/yêu cầu, gửi TỆP BẤT KỲ ≤10MB (qua `uploadBroadcastImg`, lưu cùng thư mục Drive `BROADCAST_FOLDER_ID`; tệp không phải ảnh mở bằng link `drive.google.com/file/d/ID/view`), tab "Tài liệu đính kèm". Gõ `@` gợi ý + thông báo @tag do `js/39-fn-notify.js` (phiên khác) lo — KHÔNG làm gợi ý riêng.
- [x] M5 — Backend: `saveTaskFlow_` CHẶN chèn/xoá/đổi thứ tự giai đoạn khi quy trình đang có việc dùng (việc lưu `stageIdx` theo thứ tự; thêm bước sẽ mở lại việc đã hoàn thành) — chỉ đổi tên + cờ "cần duyệt", muốn đổi cấu trúc phải NHÂN BẢN. Client `js/45-fn-taskflow-admin.js`: màn quản lý (menu trái nhóm Settings ➜ 🧩 Quy trình công việc, admin), tab lọc `⏳ Chờ tôi xử lý / ✔ Chờ tôi duyệt / @ Tôi được tag` + số đếm (`_tfScopeMatch`, hook trong `renderTaskTables` js/26).
- [x] M6 — Thông báo sự kiện quy trình qua kênh CÓ SẴN (sheet `Notifications`, client `js/39-fn-notify.js`): GAS `_notifyTaskEvent_` ghi kind `task_assign` (giao việc/giai đoạn đầu), `task_turn` (đến lượt bạn), `task_request` (xin duyệt), `task_decision` (kết quả duyệt), `task_done` (hoàn thành → người tạo). Người nhận đổi từ tên hiển thị → username qua sheet Users; không tự báo mình; lỗi thông báo bị nuốt. Bấm thông báo mở đúng việc (`_ntOpenTask`). `Tasks.mentions` do server tính từ `@tên` (cùng bộ phân tích thông báo @tag).
- [x] Bảo mật: `taskAdvance_`/`taskRequestDecide_` lấy người thao tác từ token phiên (`_taskActor_` → `_sessUser_`), không tin trường `by` khi có token; không token (client cũ) tạm dùng `by`. Khi SECURITY-PLAN bước 4 bắt buộc token thì bỏ nhánh `by`.

## Việc còn lại / lưu ý
- CHƯA thử trên trình duyệt thật: upload tệp lên Drive, chuỗi tạo việc → chuyển tiếp → duyệt, hiển thị thông báo quy trình, ép chuyển, đổi người.
- Admin ÉP CHUYỂN: nút "⚡ Ép chuyển tiếp (admin)" trong thẻ giai đoạn hiện tại (`_tfIsAdmin`, chỉ để hiện). Server `taskAdvance_` với `force:true` CHỈ chấp nhận khi có token phiên của admin thật (`actor.verified && role==='admin'`; không tin `by`/`force` từ client): bỏ qua quyền phụ trách + bước duyệt, HỦY yêu cầu duyệt đang chờ (status `cancelled`), ghi "ADMIN ÉP CHUYỂN" vào thảo luận.
- ĐỔI NGƯỜI giữa chừng: link "✏️ đổi người" cạnh giai đoạn CHƯA XONG trong timeline (hộp `#tf-re-overlay`; giai đoạn cần duyệt có thêm danh sách người duyệt). Server `taskReassign_`: admin (token thật) | người tạo | người đang phụ trách giai đoạn hiện tại; giai đoạn đã xong KHÔNG đổi; ≥1 người thực hiện; cập nhật `stageAssignees`+`csAssigned`; nếu đang có yêu cầu duyệt chờ ở giai đoạn đó thì cập nhật luôn người duyệt của yêu cầu (người duyệt cũ hết quyền duyệt; không cho chỉ còn chính người gửi); ghi "ai → ai" vào thảo luận; thông báo người MỚI.
- SỰ CỐ LẶP LẠI 2026-10-12: commit 9702f21 (ép chuyển) + 329b261 (đổi người) cũng biến mất khỏi main sau khi push (như 5 commit trước) — có phiên khác ghi đè lịch sử main. Mỗi lần push, phiên làm việc này đẩy THÊM bản sao lên nhánh `backup/taskflow` (không force). Nếu mất lần nữa: `git log origin/backup/taskflow` để lấy lại. Phiên nào đang force-push main cần được tìm ra và dừng.
- Thông báo chỉ hiện khi người nhận mở CRM (poll 60 giây, chấm số trên nút ☰) — chưa có push/Zalo.
- SỰ CỐ 2026-10-12: 5 commit client M2–M5b đã push lần đầu (c2f12d5, 55b7acd, 19acd75, 65c702a, a1f7a2b) biến mất khỏi main (ghi đè lịch sử bởi phiên khác) → đã dựng lại trong commit này. Nếu thấy mất lần nữa: kiểm `git log --oneline | grep "kieu Base"`; tuyệt đối không force-push.
- Test: `node tools/test-task-flow.js` (backend, 47 ca) · `node tools/test-task-flow-client.js` (client + hiển thị thông báo). `tools/test-ui-pro.js` đang FAIL sẵn từ trước (selector `body.no-kh-sidebar` trong css/06-pro.css của phiên khác) — không liên quan.
> Lưu ý trùng tên: `proEsc_` được định nghĩa ở CẢ `js/33-pro-profile.js` lẫn `js/36-pro-home.js` (hàm toàn cục, file nạp sau thắng — bản 36 escape thêm dấu `'`, tương thích bản 33). Nếu sửa, gom về 1 chỗ.


## Hồ sơ nhân viên (yêu cầu Duyên 12/10/2026) — đang làm
- [x] B1 backend (gas_v13.js, file gas/27_StaffProfile.gs): sheet `StaffProfiles` (tự tạo), action `profileGet` (GET), `profileSave` (POST), `staffOverview` (GET); đều đối chiếu token phiên. Nhân viên tự sửa hồ sơ mình, admin sửa hộ; admin xem tất cả, leader xem thành viên team mình, quản lý xem người thuộc phòng (nhóm KPI Sale) mình phụ trách. Test: `node tools/test-staff-profile.js`.
- `staffOverview` trả: totalOrders, revenue, commission, bonus (buildCsStats_), closeRatePancake + phoneConnectRate = SĐT mang về ÷ tổng hội thoại Pancake (buildTeamMetrics_), rankTeam/rankDept xếp theo doanh thu (posMetrics_). Số khách đang giữ / đã kết bạn / tỷ lệ chốt trên khách giữ do CLIENT tính từ `allCustomers`.
- [x] B2 client (js/47-staff-profile.js + css/09-profile.css): hộp thoại "Hồ sơ nhân viên" mở từ menu nhóm Hồ sơ + nút 🪪 ở header; form 4 trường, 11 thẻ kết quả theo kỳ (có lọc nhanh), ô chọn nhân viên cho admin/quản lý/leader. Test: `node tools/test-staff-profile-ui.js` (cần jsdom).
- Lưu ý: commit menu 121b980 của phiên này từng làm `tools/test-ui-pro.js` đỏ (@keyframes trong 06-pro.css) — đã sửa (keyframes chuyển sang 05-sidenav.css; thêm tiền tố html.ui-pro cho rule `body.no-kh-sidebar` của commit d6761c5).
- [ ] B3 xác nhận với Duyên: định nghĩa "tỷ lệ chốt trên khách đang giữ" (đang dùng: số đơn trong kỳ ÷ số khách đang giữ) và "tỷ lệ kết nối điện thoại" (SĐT mang về ÷ hội thoại Pancake).

## P5 — Social > Chat kiểu Pancake (yêu cầu của Duyên, ảnh chụp Pancake 3 cột)
- [x] **5a**: `js/48-pro-chatinfo.js` + sửa nhẹ `js/42-fn-socialchat.js`: màn Social > Chat thành **3 cột** (danh sách | hội thoại | cột "Thông tin khách" 340px, ẩn khi màn <1100px). Cột phải tìm khách CRM theo SĐT hội thoại (`proPhoneNorm_`: +84/84/có cách → 0xxxxxxxxx) rồi hiện: avatar+tên+SĐT+chip hạng/tình trạng, nút "👤 Mở hồ sơ đầy đủ" (mở thẳng `openDp`), thanh giai đoạn CS, 3 ô số, Việc tiếp theo, bảng Thông tin chăm sóc (tình trạng, kết bạn Zalo, trạng thái KH, CS phụ trách, sinh nhật, nhãn), dòng thời gian. CHỈ ĐỌC. Nút "👤 Mở hồ sơ" trên đầu hội thoại giờ mở thẳng panel hồ sơ (trước đây nhảy sang tab Danh sách + gõ tìm) khi có khách; không có khách thì giữ cách cũ.
- [x] Danh sách hội thoại có avatar chữ cái + chấm cam khi chưa đọc; bong bóng chat kiểu Pancake (nền be, tin khách trắng bên trái, tin mình xanh nhạt bên phải, nhãn ngày dạng viên thuốc) — CSS `html.ui-pro` nên áp cả cho tab 💬 Chat trong hồ sơ khách.
- Test: `tools/test-ui-pro-chatinfo.js` (15 ca, jsdom: cần `npm i jsdom` hoặc NODE_PATH). `tools/test-dist-equivalence.js` lỗi từ trước vì thiếu `dist/index.html`.
- [x] **5b**: ô "Nhập ghi chú (Enter để lưu, @ để tag)" đầu cột Thông tin. `proNoteAdd_` (js/49) lưu KHÔNG cần panel hồ sơ mở: `careData[phone]={...existing,note}` → `_touchCare` → `saveLS('ome_care')` → `queueCareSync` + `ntNoteMention` (cùng đường với `saveCare`, giữ nguyên các trường khác). Chưa có: thẻ tag Pancake (L1…, S7…) và ảnh đại diện thật trong danh sách (backend `pkChatInbox` chưa trả); thanh lọc "Lọc theo" kiểu Pancake.


## Báo cáo B — MỘT menu lọc nhiều cấp (yêu cầu Duyên 12/10/2026)
- [x] Thay 9 ô lọc rời của Báo cáo B (Sale, Team, Nguồn đơn, Marketer, Sản phẩm, Tình trạng CS, Trạng thái KH, Kết bạn Zalo, Nick Zalo) bằng nút **🔎 Bộ lọc**. Bấm ra → chọn MỤC → tick MỤC CON; riêng Tình trạng CS / Trạng thái KH (dạng cây) → chọn NHÓM (ô ☑/◪/☐ chọn cả nhóm, bấm tên để mở) → mục con. Dòng tóm tắt cạnh nút ("Nguồn đơn (2) · Tình trạng CS (3)") + "✕ Xoá lọc".
- Code: khối `_srbMenu*` trong `js/13` (ngay sau `_srbComboHTML`), gọi từ `renderSalesReportTab` (js/11, nhánh Báo cáo B); CSS `.srb-m-*` cuối `css/01-base.css`. KHÔNG đổi state key (bSale, bTeam, bNguon, bMarketer, bCareStatus, bKhStatus, bZaloStatus, bSanPham, bNickZalo) nên `_srLoad`/xuất Excel/phân quyền giữ nguyên; non-admin vẫn không thấy Sale/Team (khung 🔒 giữ nguyên). Chọn Team vẫn tự điền Sale (`_srSyncTeamToSale_`) và vẽ lại, menu giữ mở. Nút "Lọc" vẫn là nơi áp dụng.
- Bộ combo cũ (`_srbComboHTML`, `srbCombo*`) giữ lại trong js/13 nhưng không còn được gọi. Báo cáo A/C/D/E/F/L... CHƯA đổi (vẫn các ô combo riêng) — làm tiếp nếu Duyên muốn gộp cho các báo cáo đó.
- Test: `node tools/test-srb-filter-menu.js` (jsdom, 23 ca). Chưa xem thử trên trình duyệt thật.

### Cập nhật (12/10/2026, đợt 2) — thanh công cụ gọn Báo cáo A/B + sửa lỗi menu "Tác vụ"
- LỖI GỐC: `.gear-menu-list` (css/01-base.css) thiếu `display:none` mặc định nên menu Tác vụ/Xuất Excel luôn bung sẵn ở mọi báo cáo (JS chỉ bật `style.display='block'`). Đã thêm `display:none`.
- Báo cáo A và B nay dùng MỘT thanh `.srb-bar`: chọn báo cáo · khoảng ngày · 🔎 Bộ lọc · Lọc · 🧰 Tác vụ (trong menu có "Ẩn/Hiện bộ lọc KH"); bỏ hàng tiêu đề thừa. Dòng tóm tắt bộ lọc xuống hàng dưới thanh. Non-admin có chip 🔒 tên.
- Menu lọc có chế độ theo báo cáo (`_srbMenuCats_`): A = Sale, Team, Kênh, Sản phẩm, Tính theo ngày (chọn 1: Ngày tạo / Thời gian hoàn thành), Tính theo người tạo đơn (công tắc, tải lại ngay như checkbox cũ). Thêm kiểu mục `radio` và `toggle`. Đổi báo cáo → menu tự đóng.
- Báo cáo C–L chưa đổi thanh lọc (vẫn ô riêng); gear-menu của chúng đã hết lỗi bung sẵn nhờ sửa CSS.

---

# HANDOFF — Cua so chat nho (mini chat dock)  [2026-10-12]

Yeu cau cua Duyen: Chat noi bo hien thi duoc o cua so chat nho o goc duoi phai (giong Zalo/Pancake) de vua lam viec o tab khac vua nhan tin.
- [x] `js/43-teamchat.js` (khoi "cua so chat nho") + `css/07-teamchat.css` (cuoi file, tien to `tcm-`/`#tc-mini`): thanh "💬 Chat nội bộ" (huy hieu chua doc) bam mo danh sach kenh (tim kiem, xem truoc tin cuoi, ✉ Nhan rieng, ＋ Tao nhom), bam kenh mo cua so hoi thoai nho (toi da 3 cua so, it hon tren man hep): tieu de bam de thu gon, ⤢ mo trong tab Chat day du, × dong, Enter gui / Shift+Enter xuong dong. Thu gon + tin moi -> huy hieu do tren tieu de.
- Dung CHUNG du lieu `S.msgs`, vong poll `chatPoll`, trang thai da doc `ome_chat_lr_<user>` voi tab Chat day du => KHONG them API/GAS moi (khong can deploy GAS). Trang thai mo/thu gon nho theo may: localStorage `ome_chat_mini_<user>`.
- Chi hien khi dang o tab khac (o tab Chat da co khung day du); an tren dien thoai (<=720px). Dat `right:76px;bottom:38px` de khong de len chuong nhac hen (css/01-base) / dock AI / thanh tab ho so (css/06-pro).
- Test: `node tools/test-chat-mini.js` (can jsdom, mat ~20s vi cho poll 12s; thieu jsdom thi tu bo qua).
- Chua lam / chua thu tren trinh duyet that: tra loi (↩) va xoa tin trong cua so nho (van dung duoc o tab Chat day du); keo tha vi tri cua so; am thanh/nhay tieu de khi co tin moi (hien chi co toast san co + huy hieu).

### Cập nhật (13/10/2026, đợt 3) — MỌI báo cáo A–L dùng thanh gọn + menu lọc
- `_srBarHtml_()` (js/13) dựng thanh dùng chung: ô chọn báo cáo · ngày (nhanh + từ/đến) · 🔎 Bộ lọc · Lọc · 🧰 Tác vụ. Cấu hình từng báo cáo nằm ở `_srbMenuCats_()` (mục lọc, theo `_srState.sub`) và `_srbSubCfg_()` (khoá ngày, tác vụ, phần phụ như "🔄 Cả team", ô "Tỷ lệ chia" của L).
- Đã chuyển: A, B, C (giữ khối Tuần/Tháng/Quý/Năm/Tuỳ chỉnh 2 khoảng ngày), D, E, F, G (+K dùng chung `_srGFiltersHtml_`), H, I, L. Bỏ hàng tiêu đề + dải chọn báo cáo cũ (J = nhập dữ liệu chưa đổi).
- Kiểu mục menu: `flat` (tick nhiều), `tree` (nhóm→con), `text`, `radio` (chọn 1; `render:true` = vẽ lại ngay, dùng cho Team/CS/Cách nhóm của H và I vì lọc phía client), `toggle` (công tắc; `apply:true` = tải lại).
- Tác vụ gom các nút cũ: xuất Excel/CSV/Sheet, cài đặt (hoa hồng cá nhân, chương trình thưởng, phân loại đội, KPI, đơn giá vàng…), Ẩn/Hiện bộ lọc KH. Item "Xuất ra Sheet" giữ id `sr-export-sheet-btn`.
- Phân quyền giữ nguyên: CS thường chỉ có chip 🔒 + Tác vụ tối thiểu; leader ở E/F/G có mục "Tên (team của bạn)" + nút Cả team.
- Test: `node tools/test-srb-filter-menu.js` (~70 ca). Chưa xem thử trên trình duyệt thật.

## Thảo luận khách (nội bộ) — yêu cầu của Duyên: "ô thảo luận để mọi người nhắn cho nhau, tag tên, ở hồ sơ khách lẫn Social > Chat"
- [x] **Backend** (gas v13.43-kh-discuss, `gas/30_KhDiscuss.gs`, mốc mới trong `tools/split-gas.js`): sheet `KhThaoLuan` (id|phone|author|authorUser|text|mentions|ts|deleted); GET `khDiscuss` (150 tin mới nhất của khách, `after=` để poll nhẹ), POST `khDiscussSend`, `khDiscussDelete`. Người gửi lấy từ PHIÊN (bỏ qua author client gửi), tài khoản demo không dùng được, 1500 ký tự + 600ms/người, chống chèn công thức Sheet, xoá mềm: chỉ tin của mình (Admin xoá hết) kiểm ở server. @tag → `_notifyMentions_` (kind `khthread`, refType `customer`, refId = SĐT chuẩn hoá). Test: `tools/test-kh-discuss.js` (21 ca, hàm GAS thật).
- [x] **Giao diện** (`js/49-pro-discuss.js`): (1) hồ sơ khách: tab "💬 Chat Pancake" (đổi tên từ "💬 Chat", dùng để gắn hội thoại Pancake) + tab "🗨 Thảo luận" ngay cạnh; (2) Social > Chat: cột phải có 2 tab Thông tin | Thảo luận (thảo luận theo SĐT của hội thoại, kể cả khi khách chưa có trong CRM). Poll 6s (dừng khi hộp bị gỡ khỏi DOM / tab ẩn; mỗi lần thứ 5 tải lại đủ để thấy tin bị xoá). Gợi ý @ dùng lại js/39 (thêm id `khd-input`, `khd-input-sc`, `sc-note-new` vào `_NT_FIELDS`; dropdown tự mở lên trên khi ô nhập sát đáy màn hình). Bấm thông báo kind `khthread` → mở hồ sơ rồi chuyển thẳng sang tab Thảo luận. Test: `tools/test-ui-pro-discuss.js` (39 ca jsdom).
- [ ] Chưa làm (tuỳ chọn): số tin chưa đọc trên tab/biểu tượng, đính kèm ảnh/file trong thảo luận, tìm kiếm, ghim tin; giới hạn chỉ người phụ trách + quản lý thấy thảo luận của khách (hiện: mọi tài khoản thật biết SĐT khách đều đọc được, giống chat nội bộ).
- **Cần làm sau deploy**: sheet `KhThaoLuan` tự tạo lần đầu có người gửi tin. Kiểm tra `?action=count` → `ver` = `v13.43-kh-discuss`. Deploy tự động tạo file mới `30_KhDiscuss.gs` (clasp); nếu dùng deploy tay phải tạo thêm file này trong Editor.

- [x] B3 (12/10/2026, Duyên chốt công thức): tỷ lệ chốt Pancake = số đơn có NGƯỜI TẠO là sale trên Base (DT TỔNG cột B, trừ "Thất bại", chỉ ngày sale có dữ liệu Pancake) ÷ tổng tương tác Pancake (`_profCreatorOrders_`). KHÁC công thức của báo cáo KPI Pancake (đơn theo sale bán ÷ tongTT) — hỏi Duyên có muốn thống nhất không.
- Chốt trong ngày (khách mới) = dhKhMoi ÷ khMoi; chốt khách cũ = dhKhCu ÷ khCu (cột "đơn hàng KH mới/cũ" của file Pancake theo từng nhân viên). Duyên muốn đếm theo TAG L5/L5.1/L5.2 và L9/L9.1/L9.2 nhưng PancakeTagStats chỉ có theo Page (không theo sale) nên chưa làm được đúng tag — đang dùng số đơn Pancake ghi nhận, giao diện có ghi chú. Cần hỏi Duyên: chấp nhận hay muốn đếm theo Page/team.

## Phan quyen du lieu o backend - bao mat 4c (2026-10-13)
- [x] 4c-1 gas v13.46-owner-gate: chi chu so huu (`ownerUsers`, mac dinh = role admin) moi sua/xoa don o backend. Chi tiet + viec tiep: docs/SECURITY-PLAN.md muc "Buoc 4c-1".
- [ ] Can nguoi dung: cho biet username admin "Duyent" de chay `datChuSoHuu`; xac nhan co bo `deleteDuplicateOrders` khoi extension Zalo khong.
- [ ] Tiep theo: 4c-2 (loc khach theo CS o server) roi 4c-3 (action dang mo).

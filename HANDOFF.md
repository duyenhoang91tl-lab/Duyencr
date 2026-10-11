# HANDOFF — Giao diện PRO (kiểu Creatio)

Giao diện pro là MẶC ĐỊNH — `<html class="ui-pro">` gắn cứng trong index.html; ĐÃ BỎ công tắc `?ui=pro`/`?ui=classic` và localStorage `ui_mode` (không còn bản cũ để quay lại).
Mọi CSS mới nằm trong `css/06-pro.css`, mọi selector bắt đầu `html.ui-pro` (làm không gian tên; test: `node tools/test-ui-pro.js`).

## Tiến độ
- [x] **P0 — Nền thiết kế**: `css/06-pro.css` (pro-card, pro-kpi, pro-chip, pro-stage, pro-tl, pro-next, pro-gauge) + **P0b**: da header gradient tím + ngăn kéo menu ☰ tím (chỉ đổi màu, không đổi bố cục). Công tắc `?ui=pro` đã gỡ — pro luôn bật.
- [ ] **P1 — Trang chủ**: đồng hồ doanh số/tỷ lệ chốt (dùng csStats), phễu theo tình trạng CS, thẻ Khuyến nghị (luật gợi ý từ Pancake). Chỉ vẽ SỐ TỔNG HỢP (~136k khách, không vẽ danh sách). Cần thêm ô cài mục tiêu doanh số (chưa có nơi lưu → dùng setSetting/getSetting).
- [x] **P2 — Hồ sơ khách 360°** (file `js/33-pro-profile.js`, test `node tools/test-ui-pro-profile.js`):
  - [x] 2a: thanh giai đoạn (cây Tình trạng CS, CHỈ tô giai đoạn hiện tại, không tô "đã qua" vì cây CS không phải phễu tuyến tính) + 3 ô số (ngày từ đơn cuối / số đơn / doanh thu). Chèn khối `#dp-pro` giữa `.dp-hdr` và `.dp-tabs` bằng cách bọc `openDp` + `renderDpTab` (không sửa hàm gốc).
  - [x] 2b: khung "Việc tiếp theo" = tối đa 3 lịch CHƯA xong của khách (quá hạn → hôm nay → sắp tới), nút "Xem/+ Đặt lịch" chuyển sang tab Lịch hẹn. Nguồn: biến toàn cục `schedules` (không dùng cột schedGoi/SP/CS/Hen của careData).
  - [x] 2c: timeline (thẻ `<details>` thu gọn) gộp ghi chú (`_parseNotes`, giờ dạng `HH:MM dd/mm/yyyy`) + lịch hẹn + đơn (ưu tiên `_posOrdersCache` nếu đã tải, không thì `c.orders`), tối đa 30 mục.
  - [ ] Còn lại (tuỳ chọn): gợi ý hành động từ luật Pancake (vd "khách quá hạn hẹn → lên lịch") chưa đưa vào khung Việc tiếp theo; cần xem extension-pancake/pancake-content.js phần gợi ý. Chưa test trên trình duyệt thật.
  Lưu ý: `o.month` là 1–12, `o.year` có thể 2 chữ số (<100 → +2000).
- [~] **P3 — Báo cáo A–L**: đồng bộ thanh lọc (nhớ đủ preset Hôm nay/Hôm qua/Tuần này/Tuần trước/Tháng này/Tháng trước/quý/năm), ô số, biểu đồ SVG (không thêm thư viện).
  - [x] 3a: kiểm kê lọc ngày. Báo cáo A–L, KPI Pancake, Dashboard ĐÃ đủ preset (dùng `_quickRangeSelectHtml` + `_PK_QUICK_RANGES` ở js/16, hàm tính `_pkQuickRange` ở js/10). THIẾU 2 chỗ → đã bổ sung: "AI phân tích team" (`_taQuick`) và "Tổng quan" (`_ovQuick`, tự tải lại). Giữ nút "7 ngày". Test: `node tools/test-quick-range-presets.js` (trích hàm thật, giả ngày CN 11/10/2026 và 15/01/2026). Không đụng được `_dbRender` (xem 1 ngày) và `_fuResultAsk` (chọn ngày hẹn, không phải bộ lọc).
  - [ ] 3b: ô số màu (`pro-kpi`) cho các báo cáo A–L — thay dải KPI trong `_srChartSvg` (tham số ordersKey) khi `html.ui-pro`; nhớ grep TOÀN BỘ nơi gọi `_srChartSvg` trước khi sửa.
  - [ ] 3c: biểu đồ SVG đồng bộ phong cách pro (donut/cột), không thêm thư viện.
- [ ] **P4 — Dock phải + trợ lý AI**: hỏi đáp về khách/doanh số; thanh tab hồ sơ đang mở.

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

## Tiến độ
- [x] M1 — Backend GAS: quy trình/giai đoạn, chuyển tiếp, request/duyệt, comment có files/mentions/system (đã test Node).
- [ ] M2 — Client: gọi `taskFlows`; modal Tạo công việc chọn Loại quy trình + gán người phụ trách (và người duyệt) từng giai đoạn. File: `js/26-loadtasks.js`, HTML modal `task-modal-overlay` trong `index.html`.
- [ ] M3 — Client: modal chi tiết hiện thanh giai đoạn (giai đoạn hiện tại, thời gian từng bước từ stageLog, người thực hiện) + nút "Chuyển tiếp ➜" (chỉ người phụ trách bước hiện tại thấy) + khung "Yêu cầu chờ duyệt" có nút Chấp nhận/Từ chối.
- [ ] M4 — Thảo luận: render dòng hệ thống/request, đính kèm TỆP bất kỳ (PDF/Word/Excel… không chỉ ảnh; upload qua `uploadBroadcastImg` đã nhận mọi mime, kiểm tra giới hạn kích thước), tag @tên (gợi ý khi gõ @), tab "Tài liệu đính kèm" gom ảnh/tệp từ mô tả + thảo luận.
- [ ] M5 — Quản lý loại quy trình (thêm/sửa/xóa giai đoạn, bật "cần duyệt") qua menu ⚙; bộ lọc "Chờ tôi xử lý / Chờ tôi duyệt / Tôi được tag"; huy hiệu số việc chờ tôi ở tab.
- [ ] M6 — Thông báo khi được tag/giao bước/có yêu cầu duyệt (hiện chưa có hạ tầng thông báo; tối thiểu: badge + danh sách "Được tag" lấy từ cột mentions).

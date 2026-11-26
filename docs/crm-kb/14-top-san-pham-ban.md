# 14 — Top sản phẩm bán (xếp hạng SP theo ngày + team, có danh sách loại trừ)

> Có **2 chỗ xem**: tab menu 📊 Báo cáo → 🏆 Top sản phẩm bán (`js/95`) VÀ ngay trong **Báo cáo B → "Báo cáo sản phẩm"** (`js/11`, khối BPRD-CFG, thêm 21/11/2026). Hai nơi dùng CHUNG 1 danh sách loại trừ (Settings `topSpExclude`) và API `tsp*` của js/95.

Menu **📊 Báo cáo → 🏆 Top sản phẩm bán** (21/11/2026, Duyên yêu cầu: xem top SP bán trong ngày, lọc riêng theo team/ngày, cài SP không đưa vào thống kê).

## Mô hình
- Nguồn = sheet **"dữ liệu đơn" (Pos)** qua `readDonChiTiet_()` + `_mergeTachDon_()` — cùng nguồn Báo cáo B. Bỏ đơn Huỷ/Đã hoàn/Đang hoàn bằng `_donHasExcludedStatus_` (cấu hình `bizRules.posExcludedStatuses`).
- Tách SP đúng quy ước 3 cột: tên `,` · mã `;` · số lượng `,`, ghép theo VỊ TRÍ (như Báo cáo B).
- **Xếp hạng theo SỐ LƯỢNG** (rồi số đơn có SP đó). KHÔNG có doanh thu theo SP: dữ liệu đơn chỉ có tổng tiền cả đơn. (Cột T "Đơn giá" có giá niêm yết từng SP nhưng chưa dùng — việc có thể làm thêm.)
- **Team**: theo `_makeTeamResolver_` (theo NGƯỜI: nhiều tên/tài khoản + bảng khớp Pancake) trên từng sale ở cột "Thẻ". Đơn có sale thuộc nhiều team → tính ĐỦ cho từng team được chọn (không chia). Đơn không ai/không team → `(chưa có Team)`. Chọn nhiều team = hợp (OR).
- **Khoá SP** `_topSpKey_`: có mã → `c:<MÃ IN HOA bỏ khoảng trắng>`; không mã → `n:<tên bỏ dấu/thường/gọn>`. Lưu ý `_normTxt_` KHÔNG bỏ dấu → dùng `_topSpFold_` (= `_stripVN_` + gọn khoảng trắng) để so tên.
- **Loại trừ**: Settings `topSpExclude` = JSON `[{key,name}]` (tối đa 500). SP bị loại nếu khoá khớp HOẶC tên bỏ dấu/hoa thường khớp tên đã lưu (nên thêm "Quà tặng" bằng tên cũng chặn mọi mã tên đó). Dùng chung mọi máy.

## Backend (gas_v13.js, cuối file, khối "TOP SAN PHAM BAN"; test `tools/test-top-products.js`)
| Action | Method | Việc |
|---|---|---|
| topProducts | GET | `dateFrom,dateTo` (yyyy-MM-dd, mặc định hôm nay), `team` (cách `,`, rỗng = tất cả), `limit` (≤500, mặc định 100). Trả `rows[{key,name,code,soLuong,orders}], totalProducts,totalOrders,totalQty,excludedQty,excludedHit,skippedStatus,teams,exclude` |
| saveTopSpExclude | POST | `list:[{key,name}]` → Settings `topSpExclude`. Nằm trong `CFG_ACTIONS_` ⇒ CHỈ admin/leader/manager (`_cfgGate_`) |
Phần tính toán thuần `_topSpAggregate_(rows,opt)` tách riêng để test bằng Node (không đọc sheet). `buildTopProducts_` chỉ gom dữ liệu + gọi nó. Không cache (đã có cache `donChiTiet_v4` 90s).

## Client (`js/95-top-sp-tab.js`, test `tools/test-top-sp-tab.js`)
`registerExtraTab('topsp')` + id `'topsp'` trong nhóm `rp` của `js/29`. Nút Loại / Bỏ loại / Thêm tên chỉ hiện với admin/leader/manager (server vẫn kiểm). `_ts.seq` bỏ kết quả cũ khi bấm lọc liên tiếp. Khoá thêm bằng tay: `x:<tên bỏ dấu>` (server khớp qua tên nên vẫn chặn đúng).

## Trong Báo cáo B › "Báo cáo sản phẩm" (js/11, test `tools/test-bprd-top.js`)
- Thanh **"Top theo:"**: `Kỳ của Báo cáo B` (mặc định = `d.products` của B) · `Hôm nay` · `Hôm qua` · `7 ngày` + ô Từ/Đến + chip Team. Bấm ngày/team = **lọc RIÊNG** (`_srState.bpOwn`): gọi GET `topProducts` (limit 500) — KHÔNG phụ thuộc bộ lọc ngày/sale của cả Báo cáo B.
- Nguồn SP duy nhất của khối này là `_bprdAll_(d)`: lọc riêng → `_srState.bpData.rows`; không thì `d.products` bỏ SP `tspIsExcluded`. Mọi chỗ trong BPRD-CFG (bảng, đếm, bảng tick chọn, "chọn top N") đều đi qua nó → top N / chọn SP / tìm / cột Mã / biểu đồ vẫn dùng như cũ.
- Cột **🚫 Loại** (chỉ admin/leader/manager) + nút **🚫 SP loại trừ (N)** mở `tspExcludePanelHtml('b')`. Sau mỗi lần lưu js/95 gọi hook `_bprdOnExcludeChange_(changed)`: đang lọc riêng → tải lại (server áp loại trừ), không thì vẽ lại (client lọc).
- Chip Team + danh sách loại trừ nạp nhẹ bằng `topProducts&onlyConfig=1` (không quét đơn), 1 lần/phiên (`tspLoadConfig`).
- **Chưa áp loại trừ:** nút "Xuất Excel" của B (`js/13`, dùng `dB.products`) và drill-down — vẫn xuất đủ mọi SP.
- Lưu ý: `_srState.bprdShown` = dòng đang hiện, nút Loại dùng chỉ số trong mảng này; số liệu "Kỳ của B" phụ thuộc bộ lọc B (đã có sale/ngày/…), khác "lọc riêng".

## Việc có thể làm thêm
Cột doanh thu ước tính theo SP (từ cột T); xuất Excel; so với kỳ trước; lọc theo Nguồn/Page; hiển thị top ngày trên Dashboard.

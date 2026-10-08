# 02 — Backend GAS (`gas_v13.js`, ~5700+ dòng)

Sửa file này → nhớ deploy lại + đồng bộ mã GAS (xem `01-rules-and-deploy.md`). Bảng action & 20 cột: `07-reference-tables.md`.

## Các sheet dữ liệu
- **"CareData"** = bảng CRM chính (1 dòng/SĐT), cột theo `CARE_HEADERS` (20 cột, xem file 07). `careRow_(r)` dựng mảng từ request lưu. `mergeExtFields_(r, ex)` coi khStatus/nickZalos/birthday/zaloSetBy/name rỗng/thiếu là "không gửi" → lấy lại giá trị cũ trên sheet thay vì ghi đè rỗng (quan trọng: lưu 1 phần từ extension này không xoá dữ liệu extension kia vừa ghi).
- **"KH Chăm sóc mới"** (`SH_CARE_LEAD`) = log khách mới nhẹ, nuôi Báo cáo D. Cột `CARE_LEAD_HEADERS`: phone, name, note, cs, createdAt. `addCareLead_(data)` chống trùng theo SĐT (có → update, chưa → append), xoá cache `care_leads_v1`.
- **"DT TỔNG "** (CÓ khoảng trắng cuối, đúng tên thật) = sổ doanh thu/đơn cho Báo cáo A/C/E/F. `readDTTong_()` đọc thành mảng object.
- **"dữ liệu đơn"** = export thô đơn Pancake POS, chỉ cho Báo cáo B (`buildSalesReportB_`). Cột C "Thẻ" gộp CHUNG tên sale VÀ trạng thái đơn, cách nhau dấu phẩy (VD "anhNP1999, Đang giao hàng"; "dungnguyen1995, bichnguyen1993, Giao không thành"). CHỈ lấy tên sale qua `_donSaleNamesFromThe_(theStr)` (tách theo phẩy, chỉ giữ token KHÔNG có khoảng trắng — username Pancake không có dấu cách; cụm trạng thái tiếng Việt luôn có). Dùng ở đúng 4 chỗ trong `buildSalesReportB_` + hàm map SĐT→sale. Code mới đụng cột này phải dùng lại hàm, KHÔNG `splitMulti_` thô (kẻo trạng thái thành "sale ảo", chia doanh thu sai).
- **File Bảng giá riêng**, `PRICE_SS_ID` = `1Tfn2jOH20kv0Z-cb0BULqPuxZTap9FA3z8bXeeRl5l4` (tách khỏi file CRM). Sheet **DANH_MUC** (`PRICE_SHEET_NAME`) = bảng giá (`readPriceCatalog_()`/`searchPriceCatalog_`). Sheet **CTKM** = khuyến mãi; `readCTKMPromotions_(query)` chỉ nạp vào prompt AI khi khách hỏi đúng từ khoá khuyến mãi.
- **"Settings"** = kho key/value chung, `getSetting_(key)` / action `setSetting`. Key đã biết: apiGroq/apiCerebras/apiGemini (key AI dùng chung team, nhập 1 lần qua ⚙, không hiện lại), nickZaloList (JSON array), careStatus (JSON tree, sửa qua modal trong Sasum), productSheetUrl/driveKnowledgeFolderUrl/driveProductImagesFolderUrl (đã hardcode mặc định trong code, Settings rỗng vẫn chạy), gasSourceChunk_N/gasSourceChunkCount/gasSourceUpdatedAt (mã GAS cho nút Copy).

## AI
- `callAI_(data)` thử lần lượt: Groq (`openai/gpt-oss-120b`, api.groq.com) → Cerebras (`gpt-oss-120b`, api.cerebras.ai) → Gemini (`gemini-flash-latest`, generativelanguage.googleapis.com).
- Các model cũ (Groq `llama-3.3-70b-versatile`, Cerebras `llama-3.3-70b`, Google `gemini-2.0-flash`) đã bị hãng khai tử 2026. Nếu TẤT CẢ provider cùng lỗi mà không đổi code → kiểm tra hãng có ngừng model không, không phải sai key. `gemini-flash-latest` chọn cố ý vì là alias tự trôi.
- `_buildAISystemPrompt_` gộp ngữ cảnh từ: `readAIContext_()` (mẫu Q&A đã lưu), `readExternalProductSheet_(userMsg)`, `readDriveKnowledgeFolder_(userMsg)` (đều lọc từ khoá), và có điều kiện `readCTKMPromotions_(userMsg)`. Không nguồn nào nhét nguyên vào prompt.

## Báo cáo (phía server)
`buildSalesReportA_` (A — Base, đọc DT TỔNG), `buildSalesReportB_` (B — Pos, đọc dữ liệu đơn/Thẻ), C (so sánh kỳ, dùng chung `_srRenderCTable` phía client), D (KH tự thêm — đọc KH Chăm sóc mới), E (Hoa hồng nhân viên), F (KPI theo bậc — tái dùng `buildSalesReportA_` với cấu hình khác). Phần giao diện: xem `05-sasum-reports-ui.md`.

## Gửi hàng loạt (phía server)
Action `broadcastQueue` / `broadcastMark`. Phía client: `03-extension-zalo.md`.

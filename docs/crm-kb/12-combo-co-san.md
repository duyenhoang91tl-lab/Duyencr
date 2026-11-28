# 12 — COMBO CÓ SẴN (sheet COMBO) — tra cứu, admin sửa, Trợ lý AI, Pancake Soạn đơn

Làm xong 6/6 bước (2026-11-17..18) + Zalo AI (2026-11-18). KHÁC `khoCombo` (trừ tồn kho) và AIContext `combo_template` (mẫu tin nhắn) — đừng nhầm.

## Dữ liệu
- Sheet **COMBO** trong file bảng giá (`PRICE_SS_ID`, cạnh DANH_MUC/CTKM). Chưa có thì GAS TỰ TẠO. Cột theo VỊ TRÍ: Mã combo | Tên combo | Sản phẩm | Giá combo | Điều kiện/Ghi chú | Từ ngày | Đến ngày | Từ khóa | Hoạt động | Ảnh.
- Ô "Sản phẩm": mỗi dòng 1 món `Tên | Chất liệu | Size | SL` hoặc `2 x Tên`.
- ⚠ **BẪY GIÁ:** server coi số < 100000 là NGHÌN đồng (`_comboVnd_`), ≥ 100000 là đồng đầy đủ. Mọi client dùng `priceVnd` (đồng) để HIỂN THỊ/TÍNH; khi GỬI LƯU lại phải đổi đồng → số lưu (85000 → 85; xem `_cbPriceToSend_` ở js/93) và KHÔNG gửi `priceText` (server sẽ lưu chữ đó thay cho số).

## Backend (gas_v13.js, nằm trong gas/02_PriceCatalog_CTKM.gs)
| Action | Method | Ghi chú |
|---|---|---|
| comboList / comboSearch | GET | `q=` lọc; trả `rows[]` (code, name, items[{name,chatLieu,size,qty}], itemsText, price, priceVnd, priceText, note, start, end, keywords, active, usable/expired/upcoming, statusLabel) |
| comboSave | POST {token, combo} | CHỈ admin, LockService, upsert theo mã (mã trống → CB+yyMMddHHmmss) |
| comboDelete | POST {token, code} | CHỈ admin |
| priceAsk (có sẵn) | GET | thêm trường `combos` (≤5 combo ĐANG ÁP DỤNG khớp câu hỏi) — lỗi/không có sheet → [] |

## Nơi dùng (client)
1. Trợ lý AI "Giá sản phẩm" — `js/38-pro-dock.js` (`proComboText_`, `proPriceFormat_`): khối "🎁 COMBO CÓ SẴN".
2. Tab "🎁 Combo" (menu Hồ sơ) — `js/93-combo-tab.js`: tra cứu + copy; admin thấy ➕/✏️/🗑 (server vẫn kiểm admin thật).
3. Pancake AI "Soạn đơn" — `extension-pancake/pancake-content.js` (`loadCombos_`, `renderBuilderCombos_`, `addComboToCart_`) + `pancake-background.js` (`GET_COMBOS` → `comboList`). Khối `#pkb-combo` đặt NGOÀI `#pkb-dyn`. Vào giỏ = 1 dòng tiêu đề mang GIÁ COMBO × số bộ + mỗi món 1 dòng giá 0đ (SL món × số bộ) → tổng giỏ đúng giá combo. GAS cũ/không có sheet → ẩn khối, không báo lỗi.
4. Zalo AI "Soạn đơn" — `extension-zalo/zalo-content.js` (`loadCombosZai_`, `renderBuilderCombosZai_`, `addComboToCartZai_`; GAS gọi thẳng từ content script qua `_zaiBldCall_('GET_COMBOS')` vì Zalo KHÔNG có service worker). Làm Y HỆT Pancake (quy tắc song song `08-extension-parity.md`): khối `#zaib-combo` NGOÀI `#zaib-dyn`, cache `chrome.storage.local.zaiCombos` 5 phút, 1 dòng tiêu đề mang giá combo + mỗi món 1 dòng 0đ. GAS cũ → `GAS_NO_COMBO` (giữ nguyên mã, không bị đổi thành "Lỗi API") → ẩn khối. (Ghi chú cũ "Zalo chưa có giỏ hàng" là SAI: Zalo có giỏ từ 14/10/2026, xem 08.)

## Test
`node tools/test-combo.js` (GAS), `tools/test-combo-tab.js` (tab CRM), `tools/test-pk-combo.js` (Pancake) và `tools/test-zalo-combo.js` (Zalo) — cả hai cần jsdom. Deploy: sửa GAS phải deploy lại thủ công; sửa extension phải reload trong chrome://extensions; sửa js/ chỉ cần Ctrl+F5.

## Bản dán sẵn cho Project knowledge "Crm" (đề xuất — Duyên tự dán nếu muốn)
- Bảng action thêm: `comboList/comboSearch (GET)`, `comboSave/comboDelete (POST, admin)` — combo có sẵn trong sheet COMBO.
- Quy ước: giá combo < 100000 trên server = nghìn đồng; client luôn nhập/hiển thị đồng đầy đủ, dùng `priceVnd`.
- Tiền tố/ID: Pancake Soạn đơn dùng `pkb-combo`, `pkb-combo-add`, `pkb-combo-qty`; cache `pkCombos` (storage.local, 5 phút). Zalo dùng `zaib-combo`, `zaib-combo-add`, `zaib-combo-qty`; cache `zaiCombos`.

## 5. Ảnh combo (18/11/2026)
- Cột 10 **Ảnh** của sheet COMBO: 1–4 link, mỗi link 1 dòng (hoặc cách nhau dấu phẩy/chấm phẩy). Nhận link FILE Drive (`/file/d/ID`, `?id=ID`, `uc?export=view&id=ID`) hoặc link ảnh http(s); link THƯ MỤC Drive không dùng được. Sheet cũ 9 cột tự thêm cột + tiêu đề (`_comboSheet_`).
- GAS `_comboRow_` trả `images` (link Drive → `drive.google.com/thumbnail?id=ID&sz=w600`) + `imagesText` (nguyên văn); `comboSave` nhận `images:[…]`, bỏ link rác, tối đa 4, tự bật chia sẻ "ai có link" cho file Drive.
- Admin: tab 🎁 Combo → Thêm/Sửa → "📷 Tải ảnh từ máy" (thu nhỏ ≤1280px, action `uploadTemplateImage`) hoặc dán link. Thẻ combo (js/93) + câu trả lời giá của Trợ lý AI (js/38 `proComboImages_`) hiện ảnh kèm tên combo. Pancake/Zalo "Soạn đơn" chưa hiện ảnh.

## 6. Form chọn sản phẩm có giá niêm yết (18/11/2026)
- Form Thêm/Sửa combo (tab 🎁 Combo, `js/93`) KHÔNG còn bắt gõ tay ô "Sản phẩm": ô tìm 🔍 trong bảng giá (`priceCatalogFlat`, giá NGHÌN đồng → `_cbKToVnd`) → bấm chọn → dòng kiểu màn lên đơn POS (mã SP, tên, đơn giá × SL, nguồn giá, Khuyến mãi đ/%, thành tiền; đầu danh sách "Số mẫu mã / Số lượng SP"; cuối: tổng niêm yết − KM so với giá combo + nút "Dùng tổng làm giá combo").
- **Định dạng LƯU không đổi** (`Tên | Chất liệu | Size | SL` mỗi dòng, `_cbItemsText`) → Pancake/Zalo "Soạn đơn", Trợ lý AI giá, `comboList` không phải sửa. Giá niêm yết/khuyến mãi từng dòng CHỈ để tham khảo, KHÔNG lưu. Sửa combo cũ: `_cbParseItems` đọc lại chữ, ghi lại không đổi (có test round-trip). Nút "✏️ Nhập dạng chữ (nâng cao)" = ô textarea cũ (dự phòng, cũng là lối thoát khi GAS chưa có `priceCatalogFlat`).
- **Giá POS gần nhất** — GAS `posPrice` (GET `q=<JSON [{t,m,c,s}]>`, ≤40; `posPrice_` trong gas/02): đơn giá TỪNG SP lấy từ cột T "Đơn giá" của sheet "dữ liệu đơn" (`_donListPriceParts_`: lệch số lượng → bỏ, không đoán), đơn MỚI NHẤT thắng, bỏ Hủy/Hoàn, chỉ quét 8000 dòng cuối, cache 600s `pos_last_price_v1`. Khớp: tên (t HOẶC m) và size (nếu có) phải khớp HẾT từ nguyên (không trả giá size khác); chất liệu chỉ cộng điểm vì đơn hay viết tắt "NG BÍCH". Không có đơn khớp → dùng Bảng giá, ghi chú rõ. Nguồn giá mỗi dòng chọn được: POS gần nhất / Bảng giá / SAPHIA / RUBY / Nhập tay (có giá POS thì mặc định POS).
- **CTKM tham khảo**: sheet CTKM là văn bản tự do → KHÔNG tự tính giảm giá; dưới dòng chỉ nhắc ≤2 CTKM ĐANG áp dụng có nhắc tên SP (`ctkmCatalog`); admin tự nhập Khuyến mãi. Muốn tự điền % cần Duyên chốt quy ước cột trong sheet CTKM.
- Test: `node tools/test-pos-price.js` (GAS), `tools/test-combo-tab.js` (form; cần không treo: mock fetch phải trả lời NGAY `priceCatalogFlat`/`posPrice`/`ctkmCatalog`, nếu để vào hàng đợi `resolvers` test treo im lặng, thoát mã 0 không in PASSED). Test nhập chữ phải bật `rawMode` trước.
- Chưa làm: Pancake/Zalo "Soạn đơn" KHÔNG đổi (chỉ là cách NHẬP combo ở CRM web nên không vướng quy tắc song song).

# 12 — COMBO CÓ SẴN (sheet COMBO) — tra cứu, admin sửa, Trợ lý AI, Pancake Soạn đơn

Làm xong 6/6 bước (2026-11-17..18) + Zalo AI (2026-11-18). KHÁC `khoCombo` (trừ tồn kho) và AIContext `combo_template` (mẫu tin nhắn) — đừng nhầm.

## Dữ liệu
- Sheet **COMBO** trong file bảng giá (`PRICE_SS_ID`, cạnh DANH_MUC/CTKM). Chưa có thì GAS TỰ TẠO. Cột theo VỊ TRÍ: Mã combo | Tên combo | Sản phẩm | Giá combo | Điều kiện/Ghi chú | Từ ngày | Đến ngày | Từ khóa | Hoạt động.
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

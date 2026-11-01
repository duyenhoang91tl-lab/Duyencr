# Nhắc quy trình chat (AI quét hội thoại, nhắc sale làm đúng kịch bản) — GAS v13.60-coach

Yêu cầu (Duyên, 18/10/2026): từ sheet **"Kịch bản Chatpage"** (tab Kịch bản, FAQ), để Pancake AI và CRM **quét hội thoại và nhắc sale theo các bước quy trình**. Ví dụ Duyên nêu: gửi hình ảnh kèm ghi âm; báo giá phải kèm CTKM nếu có; lên được đơn thì hướng dẫn khách gửi size tay.

## Cách hoạt động (KHÔNG dùng AI đoán mò)
Mỗi quy tắc = **sự kiện kích hoạt** (khách/sale nói gì, hoặc im lặng bao lâu) + **việc sale phải làm** (tin chứa từ khoá, hoặc có ẢNH/GHI ÂM/VIDEO). Xét trên tối đa 150 tin gần nhất của hội thoại (Supabase `pk_messages`, đã có ảnh/ghi âm). Từ khoá viết **không dấu** (tin được bỏ dấu trước khi so khớp, nên "Sinh năm"/"sinh nam" đều khớp). Kết quả ổn định, giải thích được, không tốn phí AI.
Trạng thái mỗi quy tắc: `done` (đã làm) · `pending` (đã kích hoạt, còn trong thời gian ân hạn) · `due` (**quá hạn → NHẮC**) · `na` (không áp dụng / đã quá hạn hiệu lực `maxAge`, tránh nhắc hội thoại đã nguội).

## Quy tắc mặc định (lời nhắc + câu mẫu lấy từ chính sheet)
| id | Bước | Kích hoạt | Sale cần làm | Ân hạn |
|---|---|---|---|---|
| `reply_fast` | 1 | Tin cuối là của khách, chưa ai trả lời | Trả lời (nguyên tắc #5: trả lời nhanh) | 5 phút |
| `ask_birth` | 2 | Khách nhắn tin đầu | Xin năm sinh/mệnh (hoặc khách đã tự cho) | 10 phút |
| `ask_phone` | 2 | Khách nhắn ≥ 4 tin | Xin SĐT (bỏ qua nếu hội thoại đã gắn SĐT) | 5 phút |
| `consult_image` | 3 | Khách cho năm sinh/mệnh | Gửi **ẢNH** mẫu hợp mệnh | 10 phút |
| `consult_voice` | 3 | (như trên) | Gửi tin **GHI ÂM** tư vấn | 15 phút |
| `trust_proof` | 4 | Khách hỏi "có thật không / kiểm định / uy tín…" | Hứa video cận cảnh / giấy kiểm định / bảo hành | 5 phút |
| `quote_ctkm` | 5 | Sale báo giá (lần đầu) **và đang có CTKM** | Nhắc ưu đãi/tặng quà (tin sau đó hoặc ngay trong tin báo giá) | 0 |
| `wrist_size` | 7 | Khách chốt / sale gửi STK/xác nhận đơn | Hỏi hoặc nhận **size tay** | 5 phút |
| `order_confirm` | 8 | Khách gửi địa chỉ | **Xác nhận lại thông tin đơn** | 5 phút |
| `follow_silent` | 9 | Sale nhắn cuối, khách im | Nhắn theo sát (data nóng 24–48h) | 24 giờ (thôi sau 3 ngày) |

**Điểm cần Duyên xác nhận:** (1) "gửi hình ảnh kèm ghi âm" đang hiểu là **sale gửi ảnh + tin ghi âm cho khách** (sheet chỉ có "gửi ảnh 2 tông màu", không có ghi âm) — nếu muốn hiểu khác, tắt `consult_voice` hoặc sửa. (2) Câu "Em đo giúp chị chu vi cổ tay…" trong `wrist_size` là gợi ý bổ sung (sheet chỉ nói hàng thiết kế theo size tay).
`quote_ctkm` lấy CTKM đang chạy từ danh mục CTKM (bỏ CTKM hết hạn/chưa bắt đầu; cache 10 phút).

## Tuỳ chỉnh (không cần sửa code)
Settings key **`chatCoachCfg`** (JSON): `{"rules":[ ... ]}`. Cùng `id` với quy tắc có sẵn = ghi đè từng trường (`enabled:false` để tắt, `grace` phút, `say`, `script`, `maxAge` phút…); `id` mới = thêm quy tắc mới:
```json
{"rules":[
  {"id":"consult_voice","enabled":false},
  {"id":"wrist_size","grace":0},
  {"id":"xin_danh_gia","step":9,"title":"Xin đánh giá","when":{"who":"out","re":"da nhan hang"},
   "needs":{"who":"out","re":"danh gia"},"grace":60,"say":"Nhắc khách đánh giá","script":"Em đánh giá giúp chị nhé"}
]}
```
Trường `when`/`needs`: `who` = `in`|`out`|`any`; `re` = regex **không dấu**; `att` = `image`|`audio`|`video`; `min` = số tin tối thiểu; `anchor` = `first`|`last`; `needs.scope` = `after` (sau lúc kích hoạt) hoặc `any`; `when.kind` = `unanswered`|`silent`; `onlyIf:'ctkm'`; `skipIf:'phone'`. Placeholder `{ctkm}` `{age}` trong `say`/`script`. JSON hỏng → dùng mặc định; regex hỏng → có `warnings`, quy tắc khác vẫn chạy.

## API
`GET chatCoach?conv=<page_id>_<psid>` + `token` (CRM) **hoặc** `ek` (khoá extension Pancake/Zalo). Chỉ ĐỌC. Trả `reminders[]` (các việc quá hạn, theo thứ tự bước), `steps[]` (trạng thái 9 bước), `rules[]`, `ctkm[]`, `gv`. Tài khoản test bị từ chối.

## Lộ trình
1. ✅ Bộ máy + endpoint + test (`tools/test-chat-coach.js`, 69 ca).
2. ✅ CRM (`js/58-fn-chatcoach.js`, test `tools/test-chat-coach-ui.js` 27 ca): thẻ **"📋 Nhắc quy trình"** ở Social > Chat (`#sc-coach`) và tab Chat trong hồ sơ khách (`#pkc-coach`), nằm dưới dòng "Đã chat". Hiện badge "N việc cần làm" (hoặc "✓ Đang đi đúng quy trình"), các bước đã áp dụng (✓ đã làm / ⚠ cần làm / ⏳ đang chờ), và từng việc quá hạn kèm lý do + câu mẫu của sheet; nút **✍️ Chèn câu mẫu** thêm vào ô soạn tin (KHÔNG tự gửi, không ghi đè nội dung đang soạn). Bấm tiêu đề để thu gọn (nhớ ở localStorage `ome_coach_collapsed`). Chỉ hỏi server khi có tin mới hoặc quá 60 giây (`PK_COACH_REFRESH_MS`); lỗi mạng/chưa đăng nhập/GAS cũ chưa có action → thẻ ẩn im lặng. Cần deploy GAS v13.60-coach thì thẻ mới có dữ liệu.
3. Extension Pancake AI: đọc `c_id` từ URL Pancake → hiện cùng thẻ ngay trong panel.
4. Quét định kỳ + báo chuông 🔔 cho đúng sale (dùng hạ tầng giám sát chat `docs/GIAM-SAT-CHAT.md`), màn cấu hình quy tắc.

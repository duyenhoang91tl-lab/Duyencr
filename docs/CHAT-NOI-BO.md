# Chat nội bộ (CS nhắn tin cho nhau) — thêm 2026-10-11

Tab **💬 Chat nội bộ** trong menu trái (nhóm "Social", cạnh "Chat (Social)" — đó là hộp thư Pancake, là tính năng KHÁC). Dùng được khi đăng nhập bằng **tài khoản thật** (tài khoản test/demo không dùng được vì không có token phiên).

## Các loại kênh
| Loại | Ai thấy / gửi được | Ghi chú |
|---|---|---|
| 📢 Chung (`general`) | Mọi tài khoản đang hoạt động | Có sẵn, không lưu sheet |
| 👥 Team (`team:<tên team>`) | Thành viên đúng team đó; **admin thấy mọi team** | Suy ra từ cột team của tài khoản, không lưu sheet |
| `#` Kênh chung do admin tạo (`public`) | Mọi người | Chỉ admin tạo; người tạo/admin đổi tên, lưu trữ |
| 🔒 Nhóm riêng (`private`) | Chỉ thành viên (**admin cũng KHÔNG đọc được** — riêng tư) | Ai cũng tạo được; người tạo/admin thêm bớt người; thành viên tự rời được |
| ✉ Nhắn riêng (`dm:a\|b`) | Đúng 2 người | Tạo ở tin đầu tiên; id luôn sắp `a<b` để 1 cặp chỉ có 1 kênh |

## Backend (`gas/26_Chat.gs`, cuối `gas_v13.js`)
- Sheet `Chat_Kenh` (id, name, type, members, createdBy, createdAt, archived, desc) và `Chat_TinNhan` (id, channel, from, fromName, text, ts, replyTo, deleted). **Chỉ thêm dòng**; xoá = đánh dấu `deleted=1` (giữ nội dung để admin đối chiếu khi có tranh chấp).
- GET: `chatPoll` (tin mới, nhẹ), `chatChannels` (danh sách kênh + người dùng), `chatHistory` (lịch sử/phân trang). POST: `chatSend`, `chatDelete`, `chatCreateChannel`, `chatUpdateChannel`.
- **Mọi action đòi `token` phiên.** Người gửi lấy từ token ở server — client gửi `from`/tên nào cũng bị bỏ qua. Quyền vào kênh kiểm ở server.
- Chống công thức Google Sheets: tin bắt đầu bằng `= + - @` bị chèn `'` trước khi ghi (tránh `=IMPORTXML(...)` rò rỉ dữ liệu). Giới hạn 2000 ký tự, 500 ms/người/tin.
- Hiệu năng: `chatPoll` khi không có tin mới chỉ đọc 1 giá trị cache `chat_last` (không chạm sheet). Tin mới đọc từ vòng đệm CacheService (200 tin gần nhất) rồi mới tới đuôi sheet. Cache hết hạn vẫn đúng (rơi về Script Properties / sheet).
- Cloudflare Worker: `chat*` không nằm trong `TTL_SEC` nên **không bị cache**, đi thẳng GAS.

## Client (`js/43-teamchat.js`, `css/07-teamchat.css`)
- Poll 4 s khi đang mở tab Chat, 12 s ở tab khác, 45 s khi tab trình duyệt ẩn. Huy hiệu chưa đọc ở tab Chat nội bộ + chấm đỏ trên nút ☰ Menu + `(n)` ở tiêu đề trình duyệt.
- "Đã đọc" lưu **theo máy** (`localStorage ome_chat_lr_<user>`), không đồng bộ giữa các máy. Lần đầu trên 1 máy, tin có sẵn coi như đã đọc.
- Mọi chuỗi từ người dùng đi qua `esc()`; link chỉ nhận `http(s)://`; id kênh không bao giờ vào chuỗi JS (dùng `data-ch`).
- Khi ở tab Chat, banner "deploy GAS" (cố định góc dưới phải) bị ẩn bằng `body.tc-on` vì che nút Gửi.
- Phân quyền: id tab `tab-teamchat` ("Chat nội bộ") nằm trong `_PERM_TAB_DEFS`. Tài khoản **đã bị admin giới hạn tab** sẽ không thấy tab này cho tới khi admin tick; tài khoản không giới hạn thấy ngay.

## Test
- `node tools/test-chat.js` — 54 kiểm tra backend (xác thực, truy cập kênh, DM, chống công thức, xoá, phân trang, cache).
- `python3 tools/test-chat-e2e.py` — giao diện thật ↔ code GAS thật, 20 kiểm tra (cần Playwright, ~2 phút).

## Deploy
1. Đẩy lên `main` → CI deploy GAS (hoặc dán `gas_v13.js` vào Apps Script → Deploy → New version). Kiểm tra `?action=count` ra `ver: v13.38-chat`.
2. Ctrl+F5 trên web (GitHub Pages cache). Sheet `Chat_Kenh`/`Chat_TinNhan` tự tạo khi có tin đầu tiên.
3. Không cần reload extension (chat chỉ có trên web Sasum).

## Dock chat nhỏ: kéo-thả + thu nhỏ hẳn (2026-10-16)
- Kéo cả dock bằng thanh tiêu đề (danh sách hoặc cửa sổ hội thoại); nút `–` ở thanh tiêu đề danh sách thu nhỏ HẲN thành bong bóng 💬 (có huy hiệu chưa đọc, cũng kéo được; bấm để mở lại).
- Lưu theo máy + tài khoản: `ome_chat_pos_<user>` = `{d:{r,b}, b:{r,b}}` (khoảng cách tới mép PHẢI/DƯỚI — giữ cách neo cũ nên cửa sổ mới vẫn mở rộng sang trái/lên trên), cờ thu nhỏ `h` trong `ome_chat_mini_<user>`. Chưa kéo = vị trí mặc định theo CSS và vẫn tự nhường Trợ lý AI; đã kéo = dùng đúng chỗ người dùng chọn (không tự dịch).
- Kéo < 5px = coi là click; sau 1 lần kéo thật chặn đúng 1 click kế tiếp (tránh bấm nhầm thu/mở). Vị trí bị chặn trong màn hình (dock luôn còn thanh tiêu đề rộng 280px để kéo lại). Khi thu nhỏ hẳn, tin mới vẫn tính chưa đọc (`miniViewing` = false).
- Test: `node tools/test-chat-drag.js` (jsdom).

## Giới hạn đã biết / việc có thể làm tiếp
- Chưa có gửi ảnh/file, sửa tin, tìm kiếm tin, thông báo đẩy khi đóng trình duyệt.
- Poll là mô hình kéo (GAS không đẩy được): độ trễ tối đa ≈ 4 s khi mở tab Chat, ≈ 12 s ở tab khác.
- Sheet `Chat_TinNhan` tăng mãi; cần lưu trữ định kỳ nếu vượt vài chục nghìn dòng (`chatHistory` quét tối đa 20.000 dòng cuối).
- Admin không đọc được nhóm riêng/DM; nếu công ty cần kiểm soát nội dung thì phải đọc trực tiếp sheet `Chat_TinNhan`.

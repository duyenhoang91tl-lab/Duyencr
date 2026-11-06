# 09 — Thưởng Sale T10/2026: CÁCH TÍNH CHUẨN (Duyên chốt, cập nhật 2026-11-05)

> Đọc file này trước khi tính/đối chiếu thưởng Sale. Công cụ: `tools/bonus-t10/` (xem `HANDOFF.md` các mục "THƯỞNG T10"). Web (Báo cáo E/G, `js/12`, `gas_v13.js`) và tool offline PHẢI cho cùng kết quả.

## 1. Ai thuộc bảng nào (Duyên chốt 04/11 18:21)
- **Đội Sale = 22 tài khoản.** Chính thức (19): huyenmaii1990, minhquach1995, dungnguyen1995, thuyha88, biichnguyen1993, nonghong88, giangnguyen1990, mainguyen97, tuoipham1993, thuydinh95, ninhnga99, phuongthao2000, anhtrinh1995, thuNH1986, dungNTK1987, anhNP1999, trangNH2005, yenNTH2004, ninhLTK1984 → **bảng "Sale online / chính thức"** (sale offline đã chính thức cũng theo bảng này).
- **Thử việc (3):** ngocNB2003saleoff (bắt đầu 14/10), haPTN + thanhNP (bắt đầu 10/10 — theo lời Duyên phiên trước, cần xác nhận lại nếu đổi) → **bảng "Sale thử việc"**. Ngày thứ 1 = ngày bắt đầu; ngày thứ 4 trở đi mới có thưởng số đơn/doanh số ngày.
- menbui2002 (CSKH, không thuộc 22 TK): giữ quy tắc cũ — chỉ đơn nguồn Facebook Phạm Thu Hiền, tính theo CT Online. **Duyên xác nhận 05/11/2026: GIỮ — Mến được tính, nhưng CHỈ đơn nguồn "Fb Phạm Thu Hiền"** (các nguồn Facebook khác như "Hiền Phạm Tourmaline…" và đơn Zalo CSKH không tính).

## 2. Hai bảng chương trình (nguồn: ảnh Duyên gửi 04/11)
**Chính thức:** combo 2 SP 20.000 (đơn từ 10tr) · combo 3 SP 30.000 (từ 15tr) · combo 4 SP 40.000 (từ 20tr) · bill vòng mix charm 20.000 (phần vòng+charm từ 15tr) / 30.000 (từ 20tr) · doanh số ngày 50.000 (từ 60tr) / 100.000 (từ 100tr) · Tỳ hưu Moon 10.000, Tourmaline Hồng/Xanh 8.000, Aquamarine 8.000 (mỗi sản phẩm) · Tourmaline cao cấp T21 100.000 (đơn từ 21tr500), T31 200.000 (từ 31tr500; từ 21/9).
**Thử việc:** đơn đầu trong ngày 50.000 (3 ngày đầu) · 2 đơn/ngày 30.000, 3 đơn 50.000, 5 đơn 100.000 · doanh số ngày 25tr 30.000, 50tr 50.000, 80tr 100.000 (từ ngày 4) · cộng thêm dòng 8–13 giống chính thức (Tỳ hưu, T21/T31) — KHÔNG có combo 10/15/20tr và bill vòng mix.

## 3. Quy tắc tính
1. **MỐC "TỪ" = LỚN HƠN HOẶC BẰNG (≥)** (Duyên chốt 05/11: chữ "đơn trên 10tr" trong bảng cũng hiểu là *từ*). Đơn đúng 10.000.000 được combo 2 SP. Web (`gs.revenue>=min`, `measured>=min` trong js/12) và tool đã dùng ≥ → không sửa code.
2. **Combo SP** (10/15/20tr) và **bill vòng mix charm**: lấy bậc CAO NHẤT trong nhóm; bậc cần đủ cả số sản phẩm lẫn giá trị (4 SP + 13,6tr → chỉ 20.000). **Thưởng ngày** là CT riêng (không tranh với combo). **Thưởng sản phẩm Tỳ hưu CỘNG DỒN**, không giới hạn, không tranh mức cao nhất.
3. **Tỳ hưu:** "TOUR" trên Pos = Tourmaline, "AQUA" = Aquamarine; đếm SL theo từng dòng sản phẩm; **loại trừ chất liệu Ngọc Lam / Lam Thủy / Ngọc Bích / Cẩm Thạch B / Ruby / Saphire**.
4. **Đơn nhiều sale:** thưởng chia đều theo số sale trên thẻ Pos (chế độ "đơn gốc Base": theo `base_split.json` nếu có file "Check ngược Base"). Doanh thu ngày cũng chia đều.
5. **Ngày tính = ngày lên đơn trên Base** của mã đầu trong ghi chú Pos (không phải ngày Pos).
6. **Đơn NG ghép/ship cùng đơn** (cùng bộ sale, 1 trong 2 là đơn thêm `NG…`) = **1 bill** khi xét mốc (VD 1326T10+NG139T10 = 11,3tr → 20.000). Đơn gốc Base riêng (807+702, 802+89, 1149+967) KHÔNG gộp. **Đơn tách** `mã/2026/1, /2` gộp 1 bill (VD 254T10 = 17,5tr → 30.000).
7. **Tourmaline cao cấp xét theo GIÁ NIÊM YẾT trước giảm** (1301T10: 31.500.000, giảm 5% còn 29.925.000 → T31 200.000). File Pos không có giá niêm yết → tool tự khôi phục từ mô tả Base ("Giảm X% còn Y") hoặc khai trong `order_overrides.json` (`giaTriTruocGiam`).
8. **Gán đơn cho người đúng** (`order_overrides.json`): 162T10 chỉ Yến, 430T10 chỉ Hà; M45869 tách 681T10 → ngocNB2003saleoff (phần còn lại của Pos) + 937T10 → huyenmaii1990 3.550.000.
9. **Đơn loại khỏi thưởng:** Base Thất bại/Hủy (quy tắc phiên 21; danh sách ở sheet CHECK TAY). Đơn "Pos có, Base export T10 không có" và mọi đơn có **mã đầu tiên thuộc tháng khác** (T09/T11…): **KHÔNG tính thưởng T10** — Duyên chốt 05/11/2026 ("1008T09 bản chất là đơn tháng 9 nên không tính là đúng"); áp cho TẤT CẢ sale, kể cả khi file KT vẫn tính. `kt_include.py` nay bỏ qua đơn mã tháng khác (v9 = 4.304.671 có +8.000 của 1008T09 là SAI, bỏ; bản chuẩn 4.266.671).
10. Bảo hành / mỹ phẩm / nguồn NGUỒN không tính thưởng; menbui2002 chỉ đơn Facebook.

## 4. Quy trình chạy (trên `Check_DT_t10.xlsx`) và kiểm
```
python3 tools/bonus-t10/extract_orders_pos.py <Check_DT.xlsx> <work>
python3 tools/bonus-t10/add_base_date.py       <Check_DT.xlsx> <work>
python3 tools/bonus-t10/kt_include.py "<C DUYÊN-lương sale.xlsx>" <work> thuydinh95   # tuỳ chọn, theo quyết định Duyên
node    tools/bonus-t10/calc_bonus.js <work>
python3 tools/bonus-t10/build_delivery_xlsx.py <Check_DT.xlsx> <work> <ra.xlsx>
python3 tools/bonus-t10/add_sale_orders_sheet.py <work> <ra.xlsx> <sale>              # đối chiếu từng đơn của 1 sale
python3 tools/bonus-t10/audit_bonus_file.py <ra.xlsx> <work>                          # kiểm độc lập, phải ra 0 lỗi
```
File xuất có tiền từng người → giao qua chat, KHÔNG commit. Bản đã kiểm: `Thuong_T10_chuan_v9.xlsx` (tổng 4.304.671, 0 lỗi tính).

## 5. Còn chờ Duyên chốt
(1) ~~đơn T09~~ ĐÃ CHỐT 05/11: không tính cho ai · (2) 826T10 của Thủy (Base Thất bại, 3,94tr, không ảnh hưởng thưởng) · (3) ~~menbui2002~~ ĐÃ CHỐT 05/11: giữ, chỉ nguồn Fb Phạm Thu Hiền · (4) ngày bắt đầu tính thưởng của haPTN/thanhNP (10/10?).

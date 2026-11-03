#!/usr/bin/env python3
"""Buoc 3: bonus-result.json (tu calc_bonus.js) + file doi soat -> Excel bang thuong T10 (Online/Offline; theo san pham / theo don / theo doanh so ngay).
Dung: python3 build_xlsx.py <DOI_SOAT.xlsx> <thu_muc_work> <file_ra.xlsx>   roi chay recalc.py cua skill xlsx."""
import sys, json, pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, W, out = sys.argv[1:4]
res = json.load(open(W + '/bonus-result.json')); ch = res['channels']
F = 'Arial'; HDR = PatternFill('solid', fgColor='1F3A5F'); ON = PatternFill('solid', fgColor='E8F1FB'); OFF = PatternFill('solid', fgColor='FDF1E3'); WARN = PatternFill('solid', fgColor='FFF3CD')
thin = Side(style='thin', color='BFBFBF'); BOX = Border(left=thin, right=thin, top=thin, bottom=thin); MONEY = '#,##0;[Red]-#,##0;-'
def f(**k): return Font(name=F, size=k.pop('size', 10), **k)
def head(ws, row, cols, widths):
    for i, (c, w) in enumerate(zip(cols, widths), 1):
        x = ws.cell(row=row, column=i, value=c); x.font = f(bold=True, color='FFFFFF'); x.fill = HDR; x.border = BOX
        x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); ws.column_dimensions[x.column_letter].width = w
    ws.row_dimensions[row].height = 32
def title(ws, t, s):
    ws['A1'] = t; ws['A1'].font = f(bold=True, size=14, color='1F3A5F'); ws['A2'] = s; ws['A2'].font = f(italic=True, color='666666')
# --- phan loai chuong trinh: Theo don (gia tri) / Theo san pham / Theo doanh so ngay ---
PROG = [  # (ten, loai, dieu kien, muc thuong, ghi chu)
 ('Đơn từ 10tr (combo 2 sản phẩm)', 'Theo đơn (giá trị đơn)', 'Giá trị 1 đơn ≥ 10.000.000', 20000, 'Máy chấm theo GIÁ TRỊ đơn, chưa đếm số sản phẩm của combo; trong nhóm "theo đơn" chỉ lấy mức CAO NHẤT đạt được'),
 ('Đơn từ 15tr (combo 3 sản phẩm)', 'Theo đơn (giá trị đơn)', 'Giá trị 1 đơn ≥ 15.000.000', 30000, 'Như trên'),
 ('Đơn từ 20tr (combo 4 sản phẩm)', 'Theo đơn (giá trị đơn)', 'Giá trị 1 đơn ≥ 20.000.000', 40000, 'Như trên'),
 ('Bill vòng mix charm — DT từ 20tr', 'Theo đơn (giá trị đơn)', 'Đơn có "vòng", phần vòng + charm mix ≥ 20.000.000', 30000, 'Nhãn gốc ghi 25tr nhưng điều kiện ghi 20tr — đã theo điều kiện'),
 ('Bill vòng mix charm — đơn từ 15tr', 'Theo đơn (giá trị đơn)', 'Đơn có "vòng", phần vòng + charm mix ≥ 15.000.000', 20000, 'Nhãn gốc ghi 50tr nhưng điều kiện ghi 15tr — đã theo điều kiện'),
 ('Tourmaline cao cấp — đơn từ 21tr500', 'Theo đơn (giá trị đơn)', 'Giá trị 1 đơn ≥ 21.500.000 (từ 21/09/2026)', 100000, 'Chưa tách được đúng dòng Tourmaline cao cấp, chỉ chấm theo giá trị đơn → kế toán đối chiếu SP; không tính nếu đơn huỷ'),
 ('Tourmaline cao cấp — đơn từ 31tr500', 'Theo đơn (giá trị đơn)', 'Giá trị 1 đơn ≥ 31.500.000 (từ 21/09/2026)', 200000, 'Như trên'),
 ('Thưởng doanh số/ngày — đạt từ 60tr', 'Theo doanh số ngày', 'Doanh thu CHIA của sale trong 1 ngày ≥ 60.000.000', 50000, 'Trong nhóm doanh số ngày chỉ lấy mức cao nhất'),
 ('Thưởng doanh số/ngày — đạt từ 100tr', 'Theo doanh số ngày', 'Doanh thu CHIA của sale trong 1 ngày ≥ 100.000.000', 100000, 'Như trên'),
 ('Tỳ Hưu Thiên Lộc Moon', 'Theo sản phẩm', 'Tên SP chứa "Tỳ hưu thiên lộc Moon / Thiên Lộc Moon / THMoon" — × số lượng', 10000, 'Loại trừ Tỳ Hưu chất liệu Ngọc, Ruby, Saphire — máy KHÔNG tự loại, kế toán đối chiếu'),
 ('Tỳ Hưu Thiên Lộc Tourmaline (Hồng/Xanh)', 'Theo sản phẩm', 'Tên SP chứa "Tourmaline Hồng / Tourmaline Xanh" — × số lượng', 8000, ''),
 ('Tỳ Hưu Thiên Lộc Aquamarine', 'Theo sản phẩm', 'Tên SP chứa "Aquamarine" — × số lượng', 8000, '')]
TYPE = {p[0]: p[1] for p in PROG}
def kind(it):
    return TYPE.get(it['program'], it['scope'])
wb = Workbook()
# ===== Chi tiet =====
d = wb.active; d.title = 'Chi_tiet'
title(d, 'CHI TIẾT THƯỞNG TỪNG DÒNG — T10/2026', 'Mỗi dòng = 1 khoản thưởng máy chấm cho 1 sale (đơn chia nhiều sale: tiền thưởng đã chia đều). Cột "Loại thưởng" dùng cho sheet Tổng theo Sale.')
head(d, 4, ['Ngày', 'Sale', 'Kênh', 'Loại thưởng', 'Chương trình', 'Tiền thưởng (đ)', 'Chi tiết / căn cứ', 'Mã đơn Pos (ghi chú)'], [12, 22, 10, 24, 44, 16, 60, 22])
rows = []
for s in res['bySale']:
    for it in s['items']: rows.append((it['date'], s['name'], ch.get(s['name'], ''), kind(it), it['program'], it['amount'], it.get('detail', ''), it.get('maDonPos', '')))
rows.sort(key=lambda r: (r[1].lower(), r[0]))
for i, r in enumerate(rows, 5):
    for j, v in enumerate(r, 1):
        c = d.cell(row=i, column=j, value=v); c.font = f(); c.border = BOX
        if j == 6: c.number_format = MONEY
        if j == 3: c.value = {'online': 'Online', 'offline': 'Offline'}.get(v, '')
D0, D1 = 5, 4 + len(rows)
d.freeze_panes = 'A5'; d.auto_filter.ref = f'A4:H{D1}'
# ===== Tong theo Sale =====
s1 = pd.read_excel(src, sheet_name='1_Theo sale (final)', header=2)
s1 = s1[s1['Sale'].astype(str) != 'TỔNG'] if 'Sale' in s1.columns else s1
t = wb.create_sheet('Tong theo Sale', 0)
title(t, 'BẢNG THƯỞNG ONLINE / OFFLINE — THÁNG 10/2026 (01–31/10)', 'Ước tính bằng đúng hàm tính thưởng của CRM trên 1.283 đơn Pos (đã bỏ 169 đơn bảo hành), theo mẫu CT "Thưởng online chính thức". Số tiền tự cộng từ sheet Chi_tiet.')
cols = ['Sale', 'Kênh', 'Doanh thu CRM T10 (đ)', 'Thưởng THEO ĐƠN (giá trị đơn)', 'Thưởng THEO DOANH SỐ NGÀY', 'Thưởng THEO SẢN PHẨM', 'TỔNG THƯỞNG', 'Ghi chú']
head(t, 4, cols, [24, 12, 22, 20, 20, 20, 18, 58])
info = []
for _, r in s1.iterrows():
    nm = r['Sale']
    if not isinstance(nm, str): continue
    info.append((nm, ch.get(nm, ''), float(r.iloc[3] or 0)))
info = [x for x in info if x[2] > 0]
rank = {'online': 0, 'offline': 1, '': 2}
info.sort(key=lambda x: (rank[x[1]], -x[2]))
row = 5; first = {}
for nm, k, dt in info:
    t.cell(row=row, column=1, value=nm); t.cell(row=row, column=2, value={'online': 'Online', 'offline': 'Offline'}.get(k, 'Chưa phân loại'))
    t.cell(row=row, column=3, value=dt)
    for j, lab in zip((4, 5, 6), ('Theo đơn (giá trị đơn)', 'Theo doanh số ngày', 'Theo sản phẩm')):
        t.cell(row=row, column=j, value=f"=SUMIFS(Chi_tiet!$F${D0}:$F${D1},Chi_tiet!$B${D0}:$B${D1},$A{row},Chi_tiet!$D${D0}:$D${D1},\"{lab}\")")
    t.cell(row=row, column=7, value=f'=SUM(D{row}:F{row})')
    if k == '': t.cell(row=row, column=8, value='CHƯA phân loại Online/Offline → CRM không tính CT thưởng (cài ở "Phân loại đội Sale")')
    for j in range(1, 9):
        c = t.cell(row=row, column=j); c.font = f(bold=(j == 7)); c.border = BOX
        c.fill = ON if k == 'online' else OFF if k == 'offline' else WARN
        if 3 <= j <= 7: c.number_format = MONEY
    row += 1
last = row - 1
for lab, crit in (('TỔNG ONLINE', 'Online'), ('TỔNG OFFLINE', 'Offline'), ('CHƯA PHÂN LOẠI', 'Chưa phân loại')):
    t.cell(row=row, column=1, value=lab)
    for j in range(3, 8):
        L = t.cell(row=row, column=j).column_letter
        t.cell(row=row, column=j, value=f'=SUMIFS({L}$5:{L}${last},$B$5:$B${last},"{crit}")')
    row += 1
t.cell(row=row, column=1, value='TỔNG CỘNG')
for j in range(3, 8):
    L = t.cell(row=row, column=j).column_letter; t.cell(row=row, column=j, value=f'=SUM({L}5:{L}{last})')
for r in range(last + 1, row + 1):
    for j in range(1, 9):
        c = t.cell(row=r, column=j); c.font = f(bold=True); c.border = BOX
        if 3 <= j <= 7: c.number_format = MONEY
t.freeze_panes = 'A5'
n = row + 2
notes = ['LƯU Ý ĐỌC TRƯỚC KHI CHI:',
 '1) Đây là ƯỚC TÍNH theo mẫu chương trình trong code CRM; các CT bạn đang bật thật trong CRM (Settings) có thể khác → đối chiếu với Báo cáo G.',
 '2) Sale "Chưa phân loại" = 0đ vì CRM chỉ tính CT Online/Offline cho sale đã được phân loại; sale Thử việc dùng mẫu "Thưởng Sale thử việc" riêng (chưa tính ở đây).',
 '3) Máy không tự loại Tỳ Hưu chất liệu Ngọc/Ruby/Saphire và đơn huỷ (file đối soát không có tình trạng huỷ theo đơn) → kế toán đối chiếu tay.',
 '4) Đơn chia tay theo tỷ lệ riêng (416, 525, 765, 681+937, 1222T10) tính chia đều theo thẻ như CRM chưa có tỷ lệ; nhập tỷ lệ trong CRM thì số sẽ đổi.',
 '5) Thưởng ngày ở đây lấy ngày tạo đơn Pos; CRM thật lấy ngày tạo đơn trên Base (có thể lệch vài đơn sát nửa đêm).']
for i, s in enumerate(notes):
    c = t.cell(row=n + i, column=1, value=s); c.font = f(bold=(i == 0), italic=(i > 0), color='444444')
# ===== Quy tac =====
q = wb.create_sheet('Quy tac thuong', 1)
title(q, 'QUY TẮC THƯỞNG ĐÃ DÙNG — PHÂN LOẠI THEO SẢN PHẨM / THEO ĐƠN / THEO DOANH SỐ NGÀY', 'Áp dụng cho MỌI sale CHÍNH THỨC (Online + Offline); sale Thử việc không dùng bảng này. Cột phải: số lần & tiền phát sinh tháng 10 (tự đếm từ Chi_tiet).')
head(q, 4, ['Chương trình', 'Loại', 'Điều kiện', 'Mức thưởng (đ)', 'Số lần phát sinh T10', 'Tiền phát sinh T10 (đ)', 'Ghi chú'], [40, 24, 58, 16, 16, 20, 70])
for i, p in enumerate(PROG, 5):
    for j, v in enumerate((p[0], p[1], p[2], p[3]), 1): q.cell(row=i, column=j, value=v)
    q.cell(row=i, column=5, value=f'=COUNTIFS(Chi_tiet!$E${D0}:$E${D1},$A{i})')
    q.cell(row=i, column=6, value=f'=SUMIFS(Chi_tiet!$F${D0}:$F${D1},Chi_tiet!$E${D0}:$E${D1},$A{i})')
    q.cell(row=i, column=7, value=p[4])
    for j in range(1, 8):
        c = q.cell(row=i, column=j); c.font = f(); c.border = BOX; c.alignment = Alignment(wrap_text=True, vertical='top')
        if j in (4, 6): c.number_format = MONEY
qe = 4 + len(PROG)
q.cell(row=qe + 1, column=1, value='TỔNG'); q.cell(row=qe + 1, column=5, value=f'=SUM(E5:E{qe})'); q.cell(row=qe + 1, column=6, value=f'=SUM(F5:F{qe})')
for j in range(1, 8): q.cell(row=qe + 1, column=j).font = f(bold=True)
q.cell(row=qe + 1, column=6).number_format = MONEY
q.cell(row=qe + 3, column=1, value='Cách cộng: nhóm THEO ĐƠN chỉ lấy mức cao nhất mỗi đơn; nhóm DOANH SỐ NGÀY lấy mức cao nhất mỗi ngày; nhóm THEO SẢN PHẨM cộng dồn. Giữa các nhóm CỘNG DỒN. Đơn nhiều sale: tiền thưởng chia đều.').font = f(italic=True, color='666666')
# ===== Can kiem tra =====
rv = wb.create_sheet('Don can kiem tra tay')
title(rv, 'ĐƠN MÁY CHƯA CHẤM CHẮC (đơn vòng/charm mix, mã SP chưa xác nhận…)', 'Lấy từ danh sách "review" của chính hàm tính thưởng CRM — kế toán đối chiếu tay trước khi chốt.')
head(rv, 4, ['Ngày', 'Mã đơn Pos', 'Sale', 'Lý do'], [12, 24, 36, 90])
for i, r in enumerate(res['review'], 5):
    for j, v in enumerate((r.get('date', ''), r.get('ghiChu', ''), r.get('sale', ''), '; '.join(r.get('reasons', [])) if isinstance(r.get('reasons'), list) else str(r.get('reasons', ''))), 1):
        c = rv.cell(row=i, column=j, value=v); c.font = f(); c.border = BOX
wb.save(out); print('saved', out, len(rows), 'dong chi tiet')

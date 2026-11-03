#!/usr/bin/env python3
"""Doi chieu doanh thu tung sale: CRM Bao cao B (Pos, anh chup man hinh 01-31/10/2026) vs file KT Huyen.
Dung: python3 recon_crm_vs_kt.py <DOI_SOAT_huyen.xlsx> <ra.xlsx>
NGUYEN NHAN lech: (1) 24 hang cuoi sheet ĐƠN PT la 'Phan SALE cua don quay' (30% don quay, KT them) - KHONG co trong Pos nen Bao cao B khong co
(thuoc Bao cao L/E); (2) don Pos chua vao CRM (bang THEO DOI DON CHIA SALE). So 'CRM hien thi' go tay tu anh -> doi anh thi sua dict SCREEN."""
import sys, pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, out = sys.argv[1:3]
V = 'Giá trị đơn hàng sau giảm giá'; EXP = 'GIẢI THÍCH ĐỐI SOÁT (chỉ ghi đơn thay đổi/lệch)'
SCREEN = {'huyenmaii1990': 973566167, 'ninhnga99': 947635917, 'thuydinh95': 859603750, 'anhtrinh1995': 640341250, 'thuyha88': 454242500, 'biichnguyen1993': 441945333,
 'phuongthao2000': 427128250, 'trangNH2005': 417218000, 'yenNTH2004': 362280000, 'anhNP1999': 284332833, 'dungnguyen1995': 176408667, 'minhquach1995': 164435500,
 'ninhLTK1984': 149172500, 'ngocNB2003saleoff': 62232000, 'haPTN': 31444333, 'tuoipham1993': 16300000, 'mainguyen97': 14319000, 'thanhNP': 10340667}
ONOFF = {'ninhnga99': 'Online', 'huyenmaii1990': 'Online', 'thuydinh95': 'Online', 'anhtrinh1995': 'Online', 'thuyha88': 'Online', 'biichnguyen1993': 'Online', 'phuongthao2000': 'Online', 'dungnguyen1995': 'Online', 'minhquach1995': 'Online', 'tuoipham1993': 'Online', 'mainguyen97': 'Online',
 'trangNH2005': 'Offline', 'yenNTH2004': 'Offline', 'anhNP1999': 'Offline', 'ninhLTK1984': 'Offline', 'haPTN': 'Offline', 'thanhNP': 'Offline', 'ngocNB2003saleoff': 'Thử việc'}
# KT ghi 5 don 'CHUA vao CRM', nhung doi chieu ANH CRM chi con M46575 thuc su thieu (4 don con lai CRM da co -> khop so, khong tru). Doi anh/CRM thi sua tap nay.
MISSING_IN_CRM = {'M46575'}
lc = {s.lower(): s for s in SCREEN}
pt = pd.read_excel(src, sheet_name='ĐƠN PT')
pt['n'] = pt['Thẻ'].map(lambda t: [x.strip() for x in str(t).split(',') if x.strip()])
def kind(r):
    e = str(r[EXP])
    if pd.isna(r['Ngày tạo đơn']) and 'đơn quầy' in e: return 'A. Phần SALE 30% của đơn quầy (KT thêm, không có trong Pos)'
    if 'CHƯA vào CRM' in e:
        if str(r['Mã đơn hàng']) in MISSING_IN_CRM: return 'B. Đơn chia có ở Pos nhưng CHƯA vào CRM (bảng THEO DÕI ĐƠN CHIA SALE)'
        return 'C. KT ghi "chưa vào CRM" nhưng CRM đã có (không lệch, chỉ để tham khảo)'
    return ''
tot = {s: 0.0 for s in SCREEN}; det = []
for _, r in pt.iterrows():
    k = kind(r)
    for x in r['n']:
        s = lc.get(x.lower())
        if not s: continue
        share = r[V] / len(r['n']); tot[s] += share
        if k: det.append((str(r['Mã đơn hàng']), '' if pd.isna(r['Ngày tạo đơn']) else str(r['Ngày tạo đơn']), k, s, share, float(r[V]), str(r['Ghi chú nội bộ'])[:40], str(r[EXP])[:120]))
F = 'Arial'; HDR = PatternFill('solid', fgColor='1F3A5F'); YEL = PatternFill('solid', fgColor='FFF2CC'); thin = Side(style='thin', color='BFBFBF'); BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
M = '#,##0;[Red]-#,##0;-'
wb = Workbook(); ws = wb.active; ws.title = 'Doi_chieu_theo_sale'; d = wb.create_sheet('Chi_tiet_don_lech')
d['A1'] = 'CÁC ĐƠN LÀM KT ≠ CRM BÁO CÁO B (chỉ phần của 18 sale Online/Offline)'; d['A1'].font = Font(name=F, bold=True, size=13, color='1F3A5F')
for j, (h, w) in enumerate(zip(['Mã đơn', 'Ngày tạo', 'Nhóm nguyên nhân', 'Sale', 'Phần chia của sale (đ)', 'Giá trị đơn (đ)', 'Ghi chú nội bộ', 'Giải thích KT'], [12, 12, 62, 20, 18, 16, 22, 80]), 1):
    c = d.cell(row=3, column=j, value=h); c.font = Font(name=F, bold=True, color='FFFFFF'); c.fill = HDR; c.border = BOX; c.alignment = Alignment(wrap_text=True, horizontal='center'); d.column_dimensions[c.column_letter].width = w
det.sort(key=lambda x: (x[2], x[3]))
for i, r in enumerate(det, 4):
    for j, v in enumerate(r, 1):
        c = d.cell(row=i, column=j, value=v); c.font = Font(name=F, size=10); c.border = BOX
        if j in (5, 6): c.number_format = M
E = 3 + len(det)
ws['A1'] = 'ĐỐI CHIẾU DOANH THU TỪNG SALE — KT (file Huyền) vs CRM Báo cáo B (Pos) — 01–31/10/2026'; ws['A1'].font = Font(name=F, bold=True, size=14, color='1F3A5F')
ws['A2'] = 'KT = Pos + phần SALE 30% đơn quầy. CRM Báo cáo B chỉ có đơn Pos nên thiếu 2 nhóm (xem Chi_tiet_don_lech). Cột G = số CRM hiển thị trên màn hình (nhập tay từ ảnh, ô vàng). Cột H phải = 0.'; ws['A2'].font = Font(name=F, italic=True, color='666666')
heads = ['Sale', 'Kênh', 'KT: Pos + đơn quầy 30% (đ)', '− A. Đơn quầy 30% (đ)', '− B. Đơn Pos chưa vào CRM (đ)', 'CRM dự kiến = C−D−E (đ)', 'CRM hiển thị (ảnh) (đ)', 'Chênh (F−G)']
for j, (h, w) in enumerate(zip(heads, [22, 11, 22, 20, 22, 22, 22, 14]), 1):
    c = ws.cell(row=4, column=j, value=h); c.font = Font(name=F, bold=True, color='FFFFFF'); c.fill = HDR; c.border = BOX; c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center'); ws.column_dimensions[c.column_letter].width = w
ws.row_dimensions[4].height = 34
order = sorted(SCREEN, key=lambda s: ({'Online': 0, 'Offline': 1, 'Thử việc': 2}[ONOFF[s]], -tot[s]))
for i, s in enumerate(order, 5):
    ws.cell(row=i, column=1, value=s); ws.cell(row=i, column=2, value=ONOFF[s]); ws.cell(row=i, column=3, value=round(tot[s]))
    for col, key in ((4, 'A.'), (5, 'B.')):
        ws.cell(row=i, column=col, value=f'=SUMIFS(Chi_tiet_don_lech!$E$4:$E${E},Chi_tiet_don_lech!$D$4:$D${E},$A{i},Chi_tiet_don_lech!$C$4:$C${E},"{key}*")')
    ws.cell(row=i, column=6, value=f'=C{i}-D{i}-E{i}'); ws.cell(row=i, column=7, value=SCREEN[s]); ws.cell(row=i, column=8, value=f'=ROUND(F{i}-G{i},0)')
    for j in range(1, 9):
        c = ws.cell(row=i, column=j); c.font = Font(name=F, size=10); c.border = BOX
        if j >= 3: c.number_format = M
        if j == 7: c.fill = YEL
L = 4 + len(order); T = L + 1
ws.cell(row=T, column=1, value='TỔNG 18 SALE')
for j in range(3, 9):
    Lc = ws.cell(row=T, column=j).column_letter; ws.cell(row=T, column=j, value=f'=SUM({Lc}5:{Lc}{L})')
for j in range(1, 9):
    c = ws.cell(row=T, column=j); c.font = Font(name=F, bold=True); c.border = BOX
    if j >= 3: c.number_format = M
notes = ['KẾT LUẬN:', '• CRM Báo cáo B không sai: nó chỉ cộng đơn Pos. KT cộng thêm phần SALE 30% của đơn quầy (cửa hàng) — phần này thuộc Báo cáo L / Báo cáo E "Thu nhập từng sale", không nằm trong Báo cáo B.',
 '• Có 1 đơn Pos thật (M46575, 9.002.000đ, huyenmaii1990 + ninhnga99) CHƯA vào CRM → cần nhập vào bảng THEO DÕI ĐƠN CHIA SALE thì Báo cáo B mới đủ.', '• Cột H = 0 ở mọi sale nghĩa là hai bên khớp từng đồng sau khi tách 2 nhóm trên.']
for i, s in enumerate(notes): ws.cell(row=T + 2 + i, column=1, value=s).font = Font(name=F, bold=(i == 0), color='444444')
ws.freeze_panes = 'A5'; d.freeze_panes = 'A4'
wb.save(out); print('saved', out, len(det), 'dong chi tiet')

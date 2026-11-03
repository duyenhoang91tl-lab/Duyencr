#!/usr/bin/env python3
# Dung: python3 tools/bonus-t10/build_payroll.py <DOI_SOAT_da_co_thuong.xlsx> <ra.xlsx>
# Tao BANG THUONG FINAL tung sale (1 sheet) tu sheet THUONG_Tong_theo_sale cua file doi soat. Tong cot = cong thuc.
import sys, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, out = sys.argv[1], sys.argv[2]
ws = openpyxl.load_workbook(src, data_only=True)['THUONG_Tong_theo_sale']
rows = [r for r in ws.iter_rows(min_row=3, values_only=True) if r[0] and not str(r[0]).startswith('TỔNG')]
wb = openpyxl.Workbook(); s = wb.active; s.title = 'BANG_THUONG_FINAL_T10'
s['A1'] = 'BẢNG THƯỞNG FINAL TỪNG SALE — T10/2026 (Online / Offline / Thử việc)'; s['A1'].font = Font(bold=True, size=13)
s['A2'] = 'Đã loại: đơn bảo hành, đơn MP, nguồn Facebook / NGUỒN. CT Tourmaline cao cấp chỉ tính đơn có TRANG SỨC NHẪN TOUR TRƠN CAO CẤP. Khớp bảng "total thưởng sale" của KT.'
H = ['Sale', 'Kênh', 'Doanh thu đơn PT T10 (đ, không MP)', 'Thưởng THEO ĐƠN', 'Thưởng THEO DOANH SỐ NGÀY', 'Thưởng THEO SẢN PHẨM', 'Thưởng THỬ VIỆC', 'TỔNG THƯỞNG (đ)']
for i, h in enumerate(H, 1):
    c = s.cell(4, i, h); c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='305496'); c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center')
r0 = 5
for k, r in enumerate(rows):
    n = r0 + k
    for j in range(7): s.cell(n, j + 1, r[j])
    s.cell(n, 8, f'=SUM(D{n}:G{n})')
last = r0 + len(rows) - 1
for kenh, lab in (('Online', 'TỔNG ONLINE'), ('Offline', 'TỔNG OFFLINE'), ('Thử việc', 'TỔNG THỬ VIỆC')):
    last += 1; s.cell(last, 1, lab)
    for j in range(3, 9):
        L = openpyxl.utils.get_column_letter(j); s.cell(last, j, f'=SUMIF($B${r0}:$B${r0+len(rows)-1},"{kenh}",{L}${r0}:{L}${r0+len(rows)-1})')
last += 1; s.cell(last, 1, 'TỔNG CỘNG')
for j in range(3, 9):
    L = openpyxl.utils.get_column_letter(j); s.cell(last, j, f'=SUM({L}{r0}:{L}{r0+len(rows)-1})')
for n in range(last - 3, last + 1):
    for j in range(1, 9): s.cell(n, j).font = Font(bold=True)
for row in s.iter_rows(min_row=r0, max_row=last, min_col=3, max_col=8):
    for c in row: c.number_format = '#,##0'
for L, w in zip('ABCDEFGH', (20, 11, 22, 16, 18, 16, 14, 18)): s.column_dimensions[L].width = w
s.row_dimensions[4].height = 45; s.freeze_panes = 'C5'
wb.save(out); print('saved', out, len(rows), 'sale')

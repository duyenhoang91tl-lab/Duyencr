#!/usr/bin/env python3
"""Buoc cuoi (truoc recalc): them sheet LECH_* (don ghep CRM vs KT, tu diff_ghep_vs_pos.py) + dung lai sheet KT 'total thưởng sale' bang cong thuc SUMIFS tu THUONG_Chi_tiet
(pivot cu cua KT mat khi openpyxl/LibreOffice luu lai). Dung: python3 finalize_combined.py <S2.xlsx> <LECH.xlsx> <ra.xlsx>"""
import sys, pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
src, lech, out = sys.argv[1:4]
wb = load_workbook(src); x = pd.read_excel(lech, sheet_name=None)
for s, name, note in (('Tong_lech_theo_sale', 'LECH_Tong_theo_sale', 'Đơn ghép Base: CRM chia theo đơn gốc Base vs KT chia đều Thẻ Pos (T10). Tên Base→tài khoản đã được Duyên xác nhận.'), ('Lech_tung_don', 'LECH_tung_don', 'Từng đơn ghép lệch (CRM − KT); chờ Duyên/KT chốt bên nào đúng.')):
    if name in wb.sheetnames: del wb[name]
    ws = wb.create_sheet(name); df = x[s]; ws['A1'] = note; ws['A1'].font = Font(italic=True, color='666666')
    for j, h in enumerate(df.columns, 1):
        c = ws.cell(3, j, h); c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='1F3A5F'); c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center'); ws.column_dimensions[c.column_letter].width = 22 if j == 1 else 18
    for i, row in enumerate(df.itertuples(index=False), 4):
        for j, v in enumerate(row, 1):
            c = ws.cell(i, j, None if pd.isna(v) else v)
            if isinstance(v, (int, float)) and j > 3: c.number_format = '#,##0;[Red]-#,##0;-'
    ws.freeze_panes = 'A4'
# total thuong sale: dung lai bang SUMIFS (giu vi tri + tieu de nhu pivot KT)
pos = wb.sheetnames.index('total thưởng sale') if 'total thưởng sale' in wb.sheetnames else len(wb.sheetnames)
if 'total thưởng sale' in wb.sheetnames: del wb['total thưởng sale']
t = wb.create_sheet('total thưởng sale', pos); tq = wb['THUONG_Tong_theo_sale']
t['A1'] = 'Sale'; t['B1'] = 'Sum of Tiền thưởng (đ)'; t['A1'].font = t['B1'].font = Font(bold=True)
names = [r[0].value for r in tq.iter_rows(min_row=5, max_col=2) if r[0].value and r[1].value in ('Online', 'Offline', 'Thử việc')]
last = 1
for i, n in enumerate(sorted(names, key=str.lower), 2):
    t.cell(i, 1, n); t.cell(i, 2, f'=SUMIFS(THUONG_Chi_tiet!$F:$F,THUONG_Chi_tiet!$B:$B,A{i})'); t.cell(i, 2).number_format = '#,##0'; last = i
t.cell(last + 1, 1, 'Total Result'); t.cell(last + 1, 2, f'=SUM(B2:B{last})'); t.cell(last + 1, 1).font = t.cell(last + 1, 2).font = Font(bold=True); t.cell(last + 1, 2).number_format = '#,##0'
t.column_dimensions['A'].width = 24; t.column_dimensions['B'].width = 24
wb.save(out); print('saved', out, '| total thuong sale:', len(names), 'sale')

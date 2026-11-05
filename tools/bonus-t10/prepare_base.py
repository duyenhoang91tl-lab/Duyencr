#!/usr/bin/env python3
"""Buoc 0 (chay lai tren file KT da co thuong cu): bo 5 cot thuong cu cuoi sheet ĐƠN PT + cac sheet THUONG_*/TONG_THUONG_HOA_HONG_SALE de pipeline dung lai tu dau.
Dung: python3 prepare_base.py <file_KT.xlsx> <ra_base.xlsx>"""
import sys
from openpyxl import load_workbook
src, out = sys.argv[1:3]
wb = load_workbook(src); ws = wb['ĐƠN PT']
n = 0
while ws.max_column > 30 and str(ws.cell(1, ws.max_column).value or '').startswith(('Kênh sale', 'Thưởng', 'Tổng thưởng', 'Chi tiết thưởng')): ws.delete_cols(ws.max_column); n += 1
for s in ('THUONG_Tong_theo_sale', 'THUONG_Chi_tiet', 'TONG_THUONG_HOA_HONG_SALE', 'LECH_Tong_theo_sale', 'LECH_tung_don'):
    if s in wb.sheetnames: del wb[s]
wb.save(out); print('da bo', n, 'cot thuong cu; sheet con lai:', wb.sheetnames)

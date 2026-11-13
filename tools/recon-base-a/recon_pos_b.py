#!/usr/bin/env python3
"""Doi chieu so lieu Bao cao B (Pos) tren man hinh voi file export Pos 'orders_N.xlsx' (moi dong = 1 don Pos).
Dung: python3 recon_pos_b.py <orders.xlsx> <screen_b.json> <ra.xlsx>
Mo phong MUC Pos-thuan: bo Da hoan/Dang hoan; sale = token trong cot The khong co khoang trang; tien chia deu theo so sale.
KHONG mo phong ghep Base / bang chia ke toan / gop tach don => cac sale co don ghep se lech nhe la binh thuong.
Don khong co sale trong The = Quay Hao Nam + Bao hanh (khong vao bao cao sale)."""
import sys, json, collections, warnings
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
warnings.filterwarnings('ignore')
src, scr, out = sys.argv[1:4]; S = json.load(open(scr, encoding='utf8'))
d = pd.read_excel(src); d['v'] = pd.to_numeric(d['Giá trị đơn hàng sau giảm giá'], errors='coerce').fillna(0)
d = d[~d['Trạng thái'].isin(['Đã hoàn', 'Đang hoàn'])]
sales = lambda t: [] if pd.isna(t) else [x.strip() for x in str(t).split(',') if x.strip() and ' ' not in x.strip()]
d['s'] = d['Thẻ'].map(sales)
fold = lambda x: x.lower()
r = collections.Counter(); c = collections.Counter()
for _, x in d.iterrows():
    for s in x.s: r[fold(s)] += x.v / len(x.s); c[fold(s)] += 1
crm = collections.Counter()
for k, v in S['bySale'].items(): crm[fold(k)] += v
H = PatternFill('solid', fgColor='1F3A5F')
wb = Workbook(); ws = wb.active; ws.title = 'Theo sale'
for j, h in enumerate(['Sale', 'CRM màn hình', 'Pos thuần (file)', 'CRM − Pos', 'Số đơn Pos'], 1):
    c_ = ws.cell(row=1, column=j, value=h); c_.font = Font(bold=True, color='FFFFFF'); c_.fill = H
for i, k in enumerate(sorted(crm, key=lambda z: -crm[z]), 2):
    for j, v in enumerate([k, crm[k], round(r[k]), round(crm[k] - r[k]), c[k]], 1):
        c_ = ws.cell(row=i, column=j, value=v); c_.number_format = '#,##0' if j in (2, 3, 4) else 'General'
for col, w in zip('ABCDE', (24, 18, 18, 16, 12)): ws.column_dimensions[col].width = w
ws2 = wb.create_sheet('Ngoài báo cáo sale'); ws2.append(['Nguồn đơn', 'Số đơn', 'Giá trị'])
u = d[d.s.str.len() == 0]
for k, g in u.groupby(u['Nguồn đơn'].astype(str).str[:30]): ws2.append([k, len(g), float(g.v.sum())])
wb.save(out)
print('crm tong', sum(crm.values()), '| pos thuan cho cac sale tren man hinh', round(sum(r[k] for k in crm)), '| don khong sale', len(u), round(u.v.sum()))

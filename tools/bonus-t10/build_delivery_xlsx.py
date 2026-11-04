#!/usr/bin/env python3
"""Xuat file bang thuong giao Duyen tu bonus-result.json + checktay.json (+ sheet Base de tinh doanh thu ngay).
Dung: python3 build_delivery_xlsx.py <Check_DT.xlsx> <thu_muc_work> <ra.xlsx> [sale_theo_doi=trangNH2005]
Chay sau: extract_orders_pos.py -> add_base_date.py -> calc_bonus.js. KHONG commit file ra (co tien tung nguoi)."""
import sys, json, collections, warnings, openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
warnings.filterwarnings('ignore')
SRC, W, OUT = sys.argv[1:4]; WATCH = (sys.argv[4] if len(sys.argv) > 4 else 'trangNH2005').lower()
r = json.load(open(W + '/bonus-result.json')); chk = json.load(open(W + '/checktay.json')); ch = r['channels']
H = PatternFill('solid', fgColor='1F3A5F'); Y = PatternFill('solid', fgColor='FFF3CD'); R_ = PatternFill('solid', fgColor='F8D7DA')
def hdr(ws, cols, w):
    for i, (c, x) in enumerate(zip(cols, w), 1):
        c_ = ws.cell(row=1, column=i, value=c); c_.font = Font(bold=True, color='FFFFFF'); c_.fill = H; c_.alignment = Alignment(wrap_text=True, vertical='center'); ws.column_dimensions[c_.column_letter].width = x
wb = Workbook(); ws = wb.active; ws.title = '2_Tổng thưởng sale'
hdr(ws, ['Sale', 'Kênh', 'Theo đơn / sản phẩm', 'Theo doanh số ngày', 'Theo số đơn ngày (thử việc)', 'TỔNG'], [22, 16, 20, 18, 24, 14])
rows = []
for s in r['bySale']:
    a = collections.Counter()
    for it in s['items']: a[{'Theo đơn': 'd', 'Theo sản phẩm': 'd', 'Theo ngày (doanh số)': 'n'}.get(it['scope'], 't')] += it['amount']
    rows.append([s['name'], ch.get(s['name'], ''), a['d'], a['n'], a['t'], s['total']])
for i, x in enumerate(rows, 2):
    for j, v in enumerate(x, 1): ws.cell(row=i, column=j, value=v)
n = len(rows) + 2; ws.cell(row=n, column=1, value='TỔNG').font = Font(bold=True)
for j in range(3, 7):
    L = ws.cell(row=1, column=j).column_letter; ws.cell(row=n, column=j, value='=SUM(%s2:%s%d)' % (L, L, n - 1)).font = Font(bold=True)
for row in ws.iter_rows(min_row=2, min_col=3, max_col=6):
    for c in row: c.number_format = '#,##0'
ws = wb.create_sheet('4_Chi tiết thưởng'); hdr(ws, ['Ngày (Base)', 'Sale', 'Kênh', 'Loại thưởng', 'Chương trình', 'Tiền thưởng (đ)', 'Căn cứ', 'Mã đơn (ghi chú Pos)'], [12, 22, 14, 22, 42, 14, 70, 30])
k = 2
for s in r['bySale']:
    for it in sorted(s['items'], key=lambda x: x['date']):
        for j, v in enumerate([it['date'], s['name'], ch.get(s['name'], ''), it['scope'], it['program'], it['amount'], it['detail'], (it.get('maDonPos') or '').replace('\n', ' ')], 1): ws.cell(row=k, column=j, value=v)
        ws.cell(row=k, column=6).number_format = '#,##0'; k += 1
ws.auto_filter.ref = 'A1:H%d' % (k - 1)
ws = wb.create_sheet('CHECK TAY Pos-Base'); hdr(ws, ['Mã đơn (ghi chú Pos)', 'Sale', 'SĐT', 'Giá trị Pos', 'Ngày Pos', 'Trạng thái Pos', 'Lý do', 'Xử lý thưởng'], [38, 30, 14, 14, 12, 14, 52, 34])
order = {'base-that-bai': 0, 'khong-co-base': 1, '': 2}
for i, x in enumerate(sorted(chk, key=lambda x: (order.get(x['loaiThuong'], 3), str(x['ma']))), 2):
    xl = 'ĐÃ LOẠI khỏi thưởng' if x['loaiThuong'] else 'Vẫn tính như cũ — cần check tay'
    for j, v in enumerate([x['ma'], x['sale'], x['sdt'], x['giaTri'], x['ngayPos'], x['trangThaiPos'], x['lyDo'], xl], 1):
        c = ws.cell(row=i, column=j, value=v)
        if x['loaiThuong']: c.fill = R_
    ws.cell(row=i, column=4).number_format = '#,##0'
ws.auto_filter.ref = 'A1:H%d' % (len(chk) + 1)
def f(x):
    try: return float(str(x).replace(',', ''))
    except Exception: return 0.0
b = openpyxl.load_workbook(SRC, read_only=True, data_only=True)['Base']
day = collections.defaultdict(float); cnt = collections.defaultdict(list)
for x in b.iter_rows(min_row=2, values_only=True):
    if not x[0] or not x[13] or str(x[7]) == 'Thất bại': continue
    sales = [s.strip() for s in str(x[13]).split(',') if s.strip()]
    if WATCH not in [s.lower() for s in sales]: continue
    d = str(x[0])[:10]; v = (f(x[17]) + f(x[18])) / len(sales); day[d] += v; cnt[d].append('%s (%s)' % (x[20], format(round(v), ',')))
ws = wb.create_sheet('Doanh thu ngày ' + WATCH); hdr(ws, ['Ngày tạo đơn Base', 'Doanh thu ngày (đ)', 'Đạt mốc 60tr?', 'Đơn gốc trong ngày'], [18, 22, 14, 110])
for i, d in enumerate(sorted(day), 2):
    for j, v in enumerate([d, round(day[d]), 'ĐẠT' if day[d] >= 60e6 else 'không', ', '.join(cnt[d])], 1): ws.cell(row=i, column=j, value=v)
    ws.cell(row=i, column=2).number_format = '#,##0'
wb.save(OUT); print('tong thuong', sum(x[5] for x in rows), '-> ', OUT)

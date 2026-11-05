#!/usr/bin/env python3
"""Them sheet 'Don <sale>' vao file thuong da xuat: LIET KE MOI DON Pos cua 1 sale + don do duoc TINH hay bi LOAI (ly do) + thuong theo don.
Dung: python3 add_sale_orders_sheet.py <work> <file.xlsx> <sale>      (chay SAU build_delivery_xlsx.py; <sale> = ten tren Pos, vd thuydinh95)
Muc dich: de Duyen tu soi 'don nay co duoc tinh khong, vi sao' (vd Thuy bao thieu 1326T10+NG139T10, 254T10, don T09) ma khong phai doan."""
import sys, re, json, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
W, XL, SALE = sys.argv[1:4]
orders = json.load(open(W + '/orders.json')); res = json.load(open(W + '/bonus-result.json'))
TOK = re.compile(r'(?<![A-Za-z0-9])((?:BH|NG)?\d+T\d{2})(?![0-9])', re.I)
items = [i for s in res['bySale'] if s['name'].lower() == SALE.lower() for i in s['items'] if i.get('scope') != 'day' and 'doanh số' not in i['program'].lower()]
mine = [o for o in orders if SALE.lower() in [x.strip().lower() for x in str(o['saleBan']).split(',')]]
mine.sort(key=lambda o: (o.get('baseNgayTao') or '', o['maDon']))
def toks(t): return set(x.upper() for x in TOK.findall(str(t or '')))   # TOAN BO ghi chu (don gop ghi 'GHEP/SHIP CUNG DON <ma>' o dong 2)
used = set(); rows = []
for o in mine:
    tk = toks(o.get('ghiChu')); got = []; gop = ''
    for k, it in enumerate(items):
        if tk & toks(it.get('maDonPos')) or it.get('orderId') == o['id']:
            if k in used: gop = 'cùng bill gộp với đơn khác (thưởng đã tính ở dòng kia)'
            else: used.add(k); got.append(it)
    sales = [x for x in str(o['saleBan']).split(',') if x.strip()]
    if o.get('loaiThuong') == 'base-that-bai': tt = 'LOẠI — Base Thất bại/Hủy (quy tắc phiên 21)'
    elif o.get('loaiThuong') == 'khong-co-base': tt = 'LOẠI — Pos có, Base export T10 không có'
    elif o.get('ktInclude'): tt = 'TÍNH LẠI theo KT (dòng %s) — ngày = ngày Pos' % o['ktInclude']
    else: tt = 'TÍNH'
    ma = str(o.get('ghiChu') or '').split('\n')[0].strip()
    rows.append([o['maDon'], ma, o.get('baseNgayTao') or '', o['giaTriDon'], len(sales), o.get('trangThai'), tt, sum(i['amount'] for i in got), '; '.join('%s %s' % (i['program'][:40], i['amount']) for i in got) or gop, str(o.get('sanPham') or '')[:120]])
wb = openpyxl.load_workbook(XL); name = ('Đơn ' + SALE)[:31]
if name in wb.sheetnames: del wb[name]
ws = wb.create_sheet(name)
H = ['Mã đơn Pos', 'Mã (ghi chú Pos)', 'Ngày tính', 'Giá trị đơn (Pos)', 'Số sale trên thẻ', 'Trạng thái Pos', 'Tình trạng', 'Thưởng theo đơn (đ)', 'Chương trình đạt', 'Sản phẩm (Pos)']
for j, (h, w) in enumerate(zip(H, [11, 34, 11, 15, 9, 13, 44, 14, 46, 60]), 1):
    c = ws.cell(row=1, column=j, value=h); c.font = Font(name='Arial', bold=True, color='FFFFFF', size=10); c.fill = PatternFill('solid', fgColor='1F3A5F'); c.alignment = Alignment(wrap_text=True, vertical='center'); ws.column_dimensions[c.column_letter].width = w
Y = PatternFill('solid', fgColor='FFF3CD'); G = PatternFill('solid', fgColor='E2F0D9')
for i, r in enumerate(rows, 2):
    for j, v in enumerate(r, 1):
        c = ws.cell(row=i, column=j, value=v); c.font = Font(name='Arial', size=10)
        if r[6].startswith('LOẠI'): c.fill = Y
        elif r[6].startswith('TÍNH LẠI'): c.fill = G
    ws.cell(row=i, column=4).number_format = '#,##0'; ws.cell(row=i, column=8).number_format = '#,##0'
n = len(rows) + 2
ws.cell(row=n, column=1, value='TỔNG').font = Font(name='Arial', bold=True, size=10)
ws.cell(row=n, column=4, value='=SUMIF(G2:G%d,"TÍNH*",D2:D%d)' % (n - 1, n - 1)).number_format = '#,##0'; ws.cell(row=n, column=8, value='=SUM(H2:H%d)' % (n - 1)).number_format = '#,##0'
ws.cell(row=n + 1, column=1, value='Thưởng THEO NGÀY (doanh số/ngày) không gắn 1 đơn nên không nằm ở đây — xem sheet 4_Chi tiết thưởng. Giá trị đơn chia đều theo số sale trên thẻ khi tính doanh thu ngày.')
ws.freeze_panes = 'C2'; ws.auto_filter.ref = 'A1:J%d' % (n - 1)
wb.save(XL); print(name, len(rows), 'don;', sum(1 for r in rows if r[6].startswith('LOẠI')), 'bi loai;', sum(1 for r in rows if r[6].startswith('TÍNH LẠI')), 'tinh lai;', 'thuong theo don', sum(r[7] for r in rows))

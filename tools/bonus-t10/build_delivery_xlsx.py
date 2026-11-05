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
# Cot "San pham" (Duyen yeu cau 2026-11-04): de doi chieu thuong tinh chuan hay khong. Lay tu orders.json (cung work dir) theo orderId cua dong thuong.
# Don GOP (ghep/tach): lay san pham cua moi don cung SDT co ma don nam trong ghi chu Pos cua dong thuong. Thuong THEO NGAY khong gan 1 don -> de trong.
import re
_ords = json.load(open(W + '/orders.json')); _idx = {str(o.get('id')): o for o in _ords}
def _codes(t): return set(re.findall(r'[A-Za-z]*\d+T\d+/\d{4}', str(t or '')))
def _fmt_sp(o):
    sp = [x.strip() for x in str(o.get('sanPham') or '').split(',') if x.strip()]; sl = [x.strip() for x in str(o.get('soLuong') or '').split(',') if x.strip()]
    if sp and len(sp) == len(sl): return '; '.join('%s x%s' % (a, b) for a, b in zip(sp, sl))
    return '; '.join(sp)
def prod_text(it):
    o = _idx.get(str(it.get('orderId') or ''))
    if not o: return ''
    if 'GỘP' in str(it.get('detail') or ''):
        cs = _codes(it.get('maDonPos')); grp = [x for x in _ords if x.get('sdt') == o.get('sdt') and _codes(x.get('ghiChu')) & cs] or [o]
        return ' || '.join(_fmt_sp(x) for x in grp)
    return _fmt_sp(o)
ws = wb.create_sheet('4_Chi tiết thưởng'); hdr(ws, ['Ngày (Base)', 'Sale', 'Kênh', 'Loại thưởng', 'Chương trình', 'Tiền thưởng (đ)', 'Căn cứ', 'Mã đơn (ghi chú Pos)', 'Sản phẩm trên đơn (Pos) x SL'], [12, 22, 14, 22, 42, 14, 70, 30, 80])
k = 2
for s in r['bySale']:
    for it in sorted(s['items'], key=lambda x: x['date']):
        for j, v in enumerate([it['date'], s['name'], ch.get(s['name'], ''), it['scope'], it['program'], it['amount'], it['detail'], (it.get('maDonPos') or '').replace('\n', ' '), prod_text(it)], 1): ws.cell(row=k, column=j, value=v)
        ws.cell(row=k, column=6).number_format = '#,##0'; k += 1
ws.auto_filter.ref = 'A1:I%d' % (k - 1)
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
# Ten sale tren BASE khac ten tren Pos (Thuy: Pos 'thuydinh95' = Base 'Thuydinh1995') -> neu khong gop alias, sheet doanh thu ngay rong.
WALIAS = {'thuydinh95': {'thuydinh1995'}}
b = openpyxl.load_workbook(SRC, read_only=True, data_only=True)['Base']
day = collections.defaultdict(float); cnt = collections.defaultdict(list)
for x in b.iter_rows(min_row=2, values_only=True):
    if not x[0] or not x[13] or str(x[7]) == 'Thất bại': continue
    sales = [s.strip() for s in str(x[13]).split(',') if s.strip()]
    if not ({WATCH} | WALIAS.get(WATCH, set())) & {s.lower() for s in sales}: continue
    d = str(x[0])[:10]; v = (f(x[17]) + f(x[18])) / len(sales); day[d] += v; cnt[d].append('%s (%s)' % (x[20], format(round(v), ',')))
ws = wb.create_sheet('Doanh thu ngày ' + WATCH); hdr(ws, ['Ngày tạo đơn Base', 'Doanh thu ngày (đ)', 'Đạt mốc 60tr?', 'Đơn gốc trong ngày'], [18, 22, 14, 110])
for i, d in enumerate(sorted(day), 2):
    for j, v in enumerate([d, round(day[d]), 'ĐẠT' if day[d] >= 60e6 else 'không', ', '.join(cnt[d])], 1): ws.cell(row=i, column=j, value=v)
    ws.cell(row=i, column=2).number_format = '#,##0'
# Sheet CT ap dung: 2 bang chuong trinh Duyen gui 2026-11-04 (anh "Ap dung cho Sale thu viec" + "Sale online/chinh thuc") + sale nao theo bang nao
ws = wb.create_sheet('CT áp dụng'); hdr(ws, ['Bảng', 'STT', 'Viết tắt', 'Nội dung thưởng', 'Điều kiện áp dụng', 'Thời gian', 'Mức thưởng (đ)'], [22, 6, 10, 38, 44, 34, 16])
TV = [('Đơn đầu', 'Thưởng đơn đầu tiên trong ngày', 'Mỗi đơn đầu tiên chốt thành công trong ngày', '3 ngày đầu kể từ ngày bắt đầu chat khách', 50000), ('2 đơn', 'Thưởng số đơn/ngày', 'Chốt từ 02 đơn/ngày', 'Từ ngày thứ 4 đến hết thử việc', 30000),
      ('3 đơn', 'Thưởng số đơn/ngày', 'Chốt từ 03 đơn/ngày', 'Từ ngày thứ 4 đến hết thử việc', 50000), ('5 đơn', 'Thưởng số đơn/ngày', 'Chốt từ 05 đơn/ngày', 'Từ ngày thứ 4 đến hết thử việc', 100000),
      ('25tr', 'Thưởng doanh số ngày', 'Doanh thu từ 25tr', 'Từ ngày thứ 4 đến hết thử việc', 30000), ('50tr', 'Thưởng doanh số ngày', 'Doanh thu từ 50tr', 'Từ ngày thứ 4 đến hết thử việc', 50000),
      ('80tr', 'Thưởng doanh số ngày', 'Doanh thu từ 80tr', 'Từ ngày thứ 4 đến hết thử việc', 100000), ('THM', 'Tỳ hưu thiên lộc Moon', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Từ 20/8', 10000),
      ('THT', 'Tỳ hưu thiên lộc Tourmaline Hồng', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Từ 20/8', 8000), ('THT', 'Tỳ hưu thiên lộc Tourmaline Xanh', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Từ 20/8', 8000),
      ('THA', 'Tỳ hưu thiên lộc Aquamarine', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Từ 20/8', 8000), ('T21', 'Tourmaline cao cấp', 'Đơn từ 21tr500 (đơn không phát sinh huỷ)', 'Từ 21/9', 100000), ('T31', 'Tourmaline cao cấp', 'Đơn từ 31tr500 (đơn không phát sinh huỷ)', 'Từ 21/9', 200000)]
CT = [('10tr', 'Bill combo 2 sản phẩm', 'Đơn trên 10tr', 'Nguồn All', 20000), ('15tr', 'Bill combo 3 sản phẩm', 'Đơn trên 15tr', 'Nguồn All', 30000), ('20tr', 'Bill combo 4 sản phẩm', 'Đơn trên 20tr', 'Nguồn All', 40000),
      ('V15tr', 'Bill vòng mix charm', 'Đơn từ 15tr', 'Nguồn All', 20000), ('V20tr', 'Bill vòng mix charm', 'Doanh thu từ 20tr', 'Nguồn All', 30000), ('60tr', 'Thưởng doanh số ngày', 'Đạt từ 60tr/1 ngày', 'Nguồn All', 50000),
      ('100tr', 'Thưởng doanh số ngày', 'Đạt từ 100tr/1 ngày', 'Nguồn All', 100000), ('THMoon', 'Tỳ hưu thiên lộc Moon', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Nguồn All', 10000),
      ('THT', 'Tỳ hưu thiên lộc Tourmaline Hồng', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Nguồn All', 8000), ('THT', 'Tỳ hưu thiên lộc Tourmaline Xanh', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Nguồn All', 8000),
      ('THA', 'Tỳ hưu thiên lộc Aquamarine', 'Cộng thưởng theo số lượng sản phẩm bán ra', 'Nguồn All', 8000), ('T21', 'Tourmaline cao cấp', 'Đơn từ 21tr500 (đơn không phát sinh huỷ)', 'Từ 21/9', 100000), ('T31', 'Tourmaline cao cấp', 'Đơn từ 31tr500 (đơn không phát sinh huỷ)', 'Từ 21/9', 200000)]
tv_sales = ', '.join(k for k, v in ch.items() if v == 'probation'); cc_sales = ', '.join(x['name'] for x in r['bySale'] if ch.get(x['name']) != 'probation')
k = 2
for title, tbl, who in (('Sale thử việc', TV, tv_sales), ('Sale online / chính thức (gồm cả sale offline đã chính thức)', CT, cc_sales)):
    for n, x in enumerate(tbl, 1):
        for j, v in enumerate([title, n, x[0], x[1], x[2], x[3], x[4]], 1): ws.cell(row=k, column=j, value=v)
        ws.cell(row=k, column=7).number_format = '#,##0'; k += 1
    ws.cell(row=k, column=1, value='Áp dụng cho: ' + who).font = Font(bold=True); k += 2
ws.cell(row=k, column=1, value='Loại trừ Tỳ hưu: không áp dụng mẫu chế tác từ chất liệu Ngọc (Ngọc Lam, Ngọc Bích, Ngọc Cẩm Thạch B, Ruby, Saphire) — engine KHÔNG tự chấm, đã soát tay các dòng Tỳ hưu trong bảng.')
wb.save(OUT); print('tong thuong', sum(x[5] for x in rows), '-> ', OUT)

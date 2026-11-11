#!/usr/bin/env python3
"""Doi chieu Bao cao A - Base (CRM) voi file export Base 'don cac kenh' (sheet 'Tat ca').
Dung: python3 recon_base_a.py <export.xls> <crm_screen.json> <ra.xlsx>
Quy tac CRM duoc mo phong dung buildSalesReportA_: loai trang thai 'That bai'; doanh thu = Tong gia tri don (ko ship) (+ chenh neu don DOI); tien chia DEU cho moi sale tren don; so don dem nguyen don.
Phat hien 10/11/2026: CRM THIEU 31 don 01/11 tu 12:03 (9T11..39T11) + 348T11 -> du lieu nguon (DT TONG / ban sao Supabase), khong phai cong thuc."""
import sys, json, re, warnings, collections
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
warnings.filterwarnings('ignore')
src, scr, out = sys.argv[1:4]; S = json.load(open(scr, encoding='utf8'))
d = pd.read_excel(src, sheet_name='Tất cả')
num = lambda x: float(re.sub(r'[^\d.\-]', '', str(x)) or 0) if str(x) not in ('nan', '') else 0.0
d['gtr'] = d['Tổng giá trị đơn hàng (ko ship)'].map(num); d['coc'] = d['Giá trị cọc đơn hàng (số tiền ck)'].map(num)
d['t'] = pd.to_datetime(d['Ngày tạo'], format='%d/%m/%Y %H:%M'); d['ma'] = d['Mã bộ đếm'].astype(str)
d['n'] = d['ma'].str.extract(r'^(\d+)T\d+')[0].astype(float)
SALES = set(S['bySale'])
names = lambda x: [s.strip() for s in str(x).split(',') if s.strip() and s.strip().lower() != 'nan']
d['k'] = d['Sale bán'].map(lambda x: any(s.lower() in SALES for s in names(x)))
ok = d[d.k & (d['Trạng thái'] != 'Thất bại')].copy()
def share(df):
    r = collections.Counter(); c = collections.Counter()
    for _, x in df.iterrows():
        ss = names(x['Sale bán']); [r.__setitem__(s.lower(), r[s.lower()] + x.gtr / len(ss)) or c.__setitem__(s.lower(), c[s.lower()] + 1) for s in ss]
    return r, c
miss = ok[(ok.t >= pd.Timestamp('2026-11-01 12:00')) & (ok.t < pd.Timestamp('2026-11-02'))]
lag = ok[ok.ma.str.upper() == '348T11/2026']
model = ok.drop(miss.index).drop(lag.index)
r_all, c_all = share(ok); r_mod, c_mod = share(model)
H = PatternFill('solid', fgColor='1F3A5F'); Rd = PatternFill('solid', fgColor='F8D7DA'); Gn = PatternFill('solid', fgColor='D4EDDA'); Yl = PatternFill('solid', fgColor='FFF3CD')
def hdr(ws, cols, w):
    for i, (c, x) in enumerate(zip(cols, w), 1):
        h = ws.cell(row=1, column=i, value=c); h.font = Font(bold=True, color='FFFFFF'); h.fill = H; h.alignment = Alignment(wrap_text=True, vertical='center'); ws.column_dimensions[h.column_letter].width = x
wb = Workbook(); ws = wb.active; ws.title = 'Tổng hợp'; ws.column_dimensions['A'].width = 52
for c in 'BCD': ws.column_dimensions[c].width = 20
rows = [('Chỉ tiêu (kỳ 01/11 → 10/11, Phòng kinh doanh)', 'CRM (màn hình)', 'Export Base (đúng)', 'Chênh CRM − Export'),
        ('Số đơn', S['orders'], len(ok), S['orders'] - len(ok)),
        ('Doanh thu (không ship)', S['revenue'], round(ok.gtr.sum()), S['revenue'] - round(ok.gtr.sum())),
        ('Tiền cọc / CK', S['coc'], round(ok.coc.sum()), S['coc'] - round(ok.coc.sum())),
        ('Trung bình / đơn', round(S['revenue'] / S['orders']), round(ok.gtr.sum() / len(ok)), '')]
for i, r in enumerate(rows, 1):
    for j, v in enumerate(r, 1):
        c = ws.cell(row=i, column=j, value=v)
        if i > 1 and j > 1 and v != '': c.number_format = '#,##0'
        if i == 1: c.font = Font(bold=True, color='FFFFFF'); c.fill = H
notes = ['', 'KẾT LUẬN', '1) CÔNG THỨC CRM ĐÚNG: loại "Thất bại" (đơn ninhnga99 195T11 22,7tr đã bị loại), chia đều tiền theo số sale, đếm nguyên đơn, TB/đơn = 1.405.628.000 ÷ 217 = 6.477.548. 6/14 sale khớp tuyệt đối từng đồng.',
         '2) SỐ LIỆU NGUỒN THIẾU: CRM không có 31 đơn tạo ngày 01/11 từ 12:03 đến 23:03 (mã 9T11 → 39T11, liên tục) = %s đ, và thiếu 348T11 (10/11 08:57) = %s đ.' % (format(round(miss.gtr.sum()), ','), format(round(lag.gtr.sum()), ',')),
         '3) CRM có DƯ 2 đơn không thấy trong file export: huyenmaii1990 +4.650.000 (trùng giá trị đơn 110T11 đã "Thất bại" trong Base → có thể CRM chưa cập nhật trạng thái) và thuydinh1995 +16.136.000 (đơn không có trong export, có thể mã 200T11/202T11/291T11 bị thiếu khỏi file export).',
         '4) Cần kiểm tra: sheet "DT TỔNG" có đủ các dòng 9T11–39T11 không? Nếu THIẾU ở sheet → lỗi đồng bộ Base→sheet (nạp lại từ file export). Nếu CÓ ở sheet mà báo cáo không thấy → bản sao Supabase (dt_tong) bị thiếu/cũ → làm mới đồng bộ hoặc tắt SB_ORD_READ rồi tải lại.']
for i, t in enumerate(notes, 7): ws.cell(row=i, column=1, value=t).alignment = Alignment(wrap_text=True, vertical='top'); ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=4); ws.row_dimensions[i].height = 48 if t[:1].isdigit() else 18
ws.cell(row=8, column=1).font = Font(bold=True)
ws = wb.create_sheet('Theo sale'); hdr(ws, ['Sale', 'Doanh thu CRM', 'Doanh thu export (đủ)', 'Chênh CRM − đủ', 'Export sau khi bỏ 31 đơn 1/11 + 348T11', 'Còn lệch', 'Đơn export', 'Kết luận'], [20, 16, 18, 16, 22, 14, 11, 60])
tot = [0, 0, 0, 0]
for i, (s, v) in enumerate(sorted(S['bySale'].items(), key=lambda x: -x[1]), 2):
    a, m = r_all[s], r_mod[s]; dm = v - m
    kl = 'KHỚP TUYỆT ĐỐI' if abs(v - a) < 1 else ('Thiếu đơn 01/11 12h→23h' + (' / 348T11' if abs(dm) > 1 and dm < 0 else '') if abs(dm) < 1 or dm < 0 else 'CRM dư đơn không có trong export (xem sheet Tổng hợp mục 3)')
    if abs(dm) < 1 and abs(v - a) >= 1: kl = 'Khớp sau khi bỏ các đơn CRM thiếu (01/11 từ 12:03)'
    vals = [s, v, round(a), round(v - a), round(m), round(dm), c_all[s], kl]
    for j, x in enumerate(vals, 1):
        c = ws.cell(row=i, column=j, value=x)
        if j in (2, 3, 4, 5, 6): c.number_format = '#,##0'
    ws.cell(row=i, column=8).fill = Gn if abs(v - a) < 1 else (Yl if abs(dm) < 1 else Rd)
    for t, x in enumerate([v, a, v - a, dm]): tot[t] += x
n = len(S['bySale']) + 2; ws.cell(row=n, column=1, value='TỔNG').font = Font(bold=True)
for j, x in zip((2, 3, 4, 6), tot): c = ws.cell(row=n, column=j, value=round(x)); c.number_format = '#,##0'; c.font = Font(bold=True)
ws.freeze_panes = 'B2'
ws = wb.create_sheet('Đơn CRM đang thiếu'); hdr(ws, ['Ngày tạo', 'Mã bộ đếm', 'Sale bán', 'Kênh bán', 'Trạng thái', 'Giai đoạn', 'Giá trị đơn (ko ship)', 'Cọc / CK', 'Ghi chú'], [18, 14, 34, 24, 14, 16, 18, 14, 40])
for i, (_, x) in enumerate(pd.concat([miss, lag]).sort_values('t').iterrows(), 2):
    for j, v in enumerate([x['Ngày tạo'], x['ma'], x['Sale bán'], x['Kênh bán'], x['Trạng thái'], x['Giai đoạn'], x.gtr, x.coc, 'Đơn mới 08:57 10/11 (có thể chỉ chậm đồng bộ)' if x['ma'].upper() == '348T11/2026' else 'Nằm trong dải 9T11–39T11 bị thiếu'], 1):
        c = ws.cell(row=i, column=j, value=v)
        if j in (7, 8): c.number_format = '#,##0'
ws.auto_filter.ref = 'A1:I%d' % (len(miss) + len(lag) + 1)
wb.save(out); print('đơn export (14 sale, không Thất bại):', len(ok), '| doanh thu', round(ok.gtr.sum()), '| thiếu trong CRM:', len(miss), round(miss.gtr.sum()), '+ 348T11', round(lag.gtr.sum()), '->', out)

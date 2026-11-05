#!/usr/bin/env python3
"""Bang THUONG T10 "chuan theo file KT" (C DUYEN-luong sale.xlsx, FINAL).
Dung: python3 build_thuong_chuan_kt.py <Thuong_T10_chuan_v2.xlsx> <C_DUYEN_luong_sale.xlsx> <ra.xlsx>
KHONG commit file ra (co tien tung nguoi).

Vi sao can: file KT chi co HOA HONG (cot AO), KHONG co thuong, va khong co ngay/san pham -> khong tinh lai thuong truc tiep tu file KT duoc.
Cach lam: lay bang thuong engine (Thuong_T10_chuan_v2.xlsx, sheet 2_ + 4_) roi
  (1) gan NHOM KT (SALE ONL / SALE OFF / CSKH) cho tung sale theo cot Q file KT -> bang goi theo nhom KT thay vi kenh CRM;
  (2) doi chieu TUNG dong thuong 'Theo don' voi cac dong don cua KT (ma don trong ghi chu + the sale): don nao khong co tren KT / sale khong co the
      tren KT -> liet ke sheet 'Doi chieu KT' (KHONG tu y sua tien).
Thuong khong doi theo kenh On/Off (CT online + offline cung audience), chi % hoa hong doi -> doi nhom KT khong lam doi tien thuong."""
import sys, re, collections, warnings, openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
warnings.filterwarnings('ignore')
V2, KT, OUT = sys.argv[1:4]

# ---- doc file KT
ws = openpyxl.load_workbook(KT, data_only=True).active
grp_of, dt_kt = {}, {}
g = ''
for r in range(3, 120):                        # khoi tom tat ben phai: Q = nhom ('X' = giu nhom tren), S = ten sale, AL = TONG
    q = ws.cell(r, 17).value
    if q and str(q).strip() != 'X': g = str(q).strip()
    n = ws.cell(r, 19).value
    if n and ws.cell(r, 38).value is not None: grp_of[str(n).strip().lower()] = g; dt_kt[str(n).strip().lower()] = ws.cell(r, 38).value or 0
CODE = re.compile(r'(?<![A-Za-z0-9])(?:NG)?(\d+T\d{2})(?![0-9])', re.I)   # 1350T10 ; NG141T10 ; khong bat BH442T10
kt_rows = collections.defaultdict(list)
for r in ws.iter_rows(min_row=3, max_col=12, values_only=True):
    sales = [str(x).strip().lower() for x in r[:8] if x]
    if not sales or not isinstance(r[10], (int, float)): continue
    for c in set(m.upper() for m in CODE.findall(str(r[8] or ''))): kt_rows[c].append(sales)

# ---- doc bang thuong v2
wb = openpyxl.load_workbook(V2, data_only=True)
tot = [r for r in wb['2_Tổng thưởng sale'].iter_rows(min_row=2, values_only=True) if r[0] and r[0] != 'TỔNG']
det = [r for r in wb['4_Chi tiết thưởng'].iter_rows(min_row=2, values_only=True) if r[0]]
assert abs(sum(r[6] for r in tot) - sum(r[5] for r in det)) < 1, 'tong sheet 2 != tong sheet 4 cua file v2'
NOTE = {'ngocnb2003saleoff': 'Thử việc: chỉ nhận CT thử việc (theo số đơn/ngày), không nhận thưởng theo đơn.',
        'menbui2002': 'CSKH (KT) — thưởng chỉ từ đơn nguồn Facebook Phạm Thu Hiền, tính theo CT Online.'}

H = PatternFill('solid', fgColor='1F3A5F'); Y = PatternFill('solid', fgColor='FFF3CD')
F = Font(name='Arial', size=10); FB = Font(name='Arial', size=10, bold=True); FH = Font(name='Arial', size=10, bold=True, color='FFFFFF')
def hdr(s, cols, w):
    for i, (c, x) in enumerate(zip(cols, w), 1):
        h = s.cell(row=1, column=i, value=c); h.font = FH; h.fill = H; h.alignment = Alignment(wrap_text=True, vertical='center'); s.column_dimensions[h.column_letter].width = x
    s.row_dimensions[1].height = 36
def body(s, first=2):
    for row in s.iter_rows(min_row=first):
        for c in row:
            if c.font != FB: c.font = F

out = Workbook(); s = out.active; s.title = 'Thưởng T10 chuẩn KT'
hdr(s, ['Sale', 'Nhóm KT', 'Kênh CRM (engine)', 'Theo đơn', 'Theo doanh số ngày', 'Theo số đơn ngày (thử việc)', 'Thưởng thêm khác', 'TỔNG THƯỞNG', 'Ghi chú'], [22, 12, 16, 14, 16, 18, 14, 16, 70])
for i, r in enumerate(sorted(tot, key=lambda x: -x[6]), 2):
    k = r[0].lower()
    for j, v in enumerate([r[0], grp_of.get(k, '(không có trong KT)'), r[1] or '(chưa phân loại)', r[2], r[3], r[4], r[5]], 1): s.cell(row=i, column=j, value=v)
    s.cell(row=i, column=8, value='=SUM(D%d:G%d)' % (i, i)); s.cell(row=i, column=9, value=NOTE.get(k, ''))
n = len(tot) + 2
s.cell(row=n, column=1, value='TỔNG').font = FB
for j in range(4, 9):
    L = s.cell(row=1, column=j).column_letter; s.cell(row=n, column=j, value='=SUM(%s2:%s%d)' % (L, L, n - 1)).font = FB
for row in s.iter_rows(min_row=2, min_col=4, max_col=8):
    for c in row: c.number_format = '#,##0'
s.freeze_panes = 'B2'; body(s)

d = out.create_sheet('Chi tiết thưởng')
hdr(d, ['Ngày (Base)', 'Sale', 'Nhóm KT', 'Kênh CRM', 'Loại thưởng', 'Chương trình', 'Tiền thưởng (đ)', 'Căn cứ', 'Mã đơn (ghi chú Pos)'], [12, 22, 12, 14, 22, 42, 14, 70, 34])
for i, r in enumerate(sorted(det, key=lambda x: (x[1].lower(), x[0])), 2):
    for j, v in enumerate([r[0], r[1], grp_of.get(r[1].lower(), ''), r[2], r[3], r[4], r[5], r[6], r[7]], 1): d.cell(row=i, column=j, value=v)
    d.cell(row=i, column=7).number_format = '#,##0'
d.auto_filter.ref = 'A1:I%d' % (len(det) + 1); d.freeze_panes = 'A2'; body(d)

# ---- doi chieu tung dong 'Theo don' voi KT
c = out.create_sheet('Đối chiếu KT')
hdr(c, ['Sale', 'Ngày (Base)', 'Mã đơn (ghi chú Pos)', 'Tiền thưởng (đ)', 'Kết quả', 'Chi tiết'], [22, 12, 40, 14, 26, 80])
ok = 0; bad = []
for r in det:
    if r[3] not in ('Theo đơn', 'Theo sản phẩm'): continue
    codes = list(dict.fromkeys(m.upper() for m in CODE.findall(str(r[7] or ''))))
    rows = [x for cd in codes for x in kt_rows.get(cd, [])]
    if not codes: bad.append((r, 'KHÔNG ĐỌC ĐƯỢC MÃ', 'Ghi chú Pos không có mã đơn để so với KT')); continue
    if not rows: bad.append((r, 'KHÔNG CÓ TRÊN KT', 'Mã %s không có dòng nào trong ghi chú file KT (có thể KT ghi đơn theo mã khác / chưa nhập)' % ', '.join(codes))); continue
    if not any(r[1].lower() in x for x in rows): bad.append((r, 'SALE KHÁC TRÊN KT', 'KT gán đơn cho: ' + ' | '.join(', '.join(x) for x in rows))); continue
    ok += 1
c.append([]); c.delete_rows(1)
hdr(c, ['Sale', 'Ngày (Base)', 'Mã đơn (ghi chú Pos)', 'Tiền thưởng (đ)', 'Kết quả', 'Chi tiết'], [22, 12, 40, 14, 26, 80])
for i, (r, kq, ct) in enumerate(bad, 2):
    for j, v in enumerate([r[1], r[0], str(r[7] or '').replace('\n', ' '), r[5], kq, ct], 1): c.cell(row=i, column=j, value=v)
    c.cell(row=i, column=4).number_format = '#,##0'
    for j in range(1, 7): c.cell(row=i, column=j).fill = Y
k = len(bad) + 3
c.cell(row=k, column=1, value='Tổng kết').font = FB
c.cell(row=k + 1, column=1, value='Dòng thưởng theo đơn khớp KT (mã đơn + sale):'); c.cell(row=k + 1, column=4, value=ok)
c.cell(row=k + 2, column=1, value='Dòng cần check tay (vàng ở trên):'); c.cell(row=k + 2, column=4, value=len(bad))
c.cell(row=k + 3, column=1, value='Thưởng theo NGÀY (doanh số/ngày, thử việc) không đối chiếu được với KT vì file KT không có cột ngày.')
body(c)
out.save(OUT)
print('sale:', len(tot), '| dong chi tiet:', len(det), '| theo don khop KT:', ok, '| can check tay:', len(bad), '| tong thuong:', sum(r[6] for r in tot))
for r, kq, ct in bad: print('  -', r[1], r[7][:40] if r[7] else '', r[5], kq, ct[:90])

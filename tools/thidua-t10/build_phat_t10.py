#!/usr/bin/env python3
"""Dựng lại file PHẠT THI ĐUA T10 theo sheet HUYỀN (KT Huyền) của Check_DT_t10.xlsx.
Dùng:  python3 tools/thidua-t10/build_phat_t10.py <Check_DT_t10.xlsx> <Phat_thi_dua_T10_2026_vX.xlsx cũ> <ra.xlsx>
Quy tắc: DT từng sale = cột TỔNG (R:S) của sheet HUYỀN (số KT chốt). Sheet Du_lieu = từng dòng thẻ HUYỀN (chia đều theo số sale trên thẻ,
tên sale khớp không phân biệt hoa/thường) + 1 dòng 'Điều chỉnh theo KT Huyền' cho mỗi sale để tổng khớp ĐÚNG cột TỔNG (phần chênh coi là NGOÀI kênh FB chính,
vì sheet HUYỀN không cho biết kênh của phần KT sửa tay). Công thức/cấu hình các sheet Cau_hinh, Phat_theo_kenh, Phat_tung_nguoi giữ nguyên.
Chạy xong phải recalc bằng LibreOffice. KHÔNG commit file xlsx ra repo (có tiền từng người)."""
import sys, copy, collections, openpyxl
from openpyxl.styles import PatternFill, Font
src, old, out = sys.argv[1:4]
_wb = openpyxl.load_workbook(src, data_only=True)
h = _wb['HUYỀN'] if 'HUYỀN' in _wb.sheetnames else _wb.worksheets[0]   # file Check_DT: sheet HUYỀN; file "LƯƠNG SALE" (Sheet1): bố cục khác
hdr = {str(h.cell(2, c).value).strip(): c for c in range(1, 60) if h.cell(2, c).value is not None}
cNote, cSrc, cVal = hdr['Ghi chú nội bộ'], hdr['Nguồn đơn'], hdr['Giá trị đơn hàng sau giảm giá']
cName, cTot = hdr['Tên sale'], hdr['TỔNG']          # cột tên sale + cột TỔNG (số chốt từng sale)
S = {}
for i in range(3, 200):
    n, v = h.cell(i, cName).value, h.cell(i, cTot).value
    if n and isinstance(v, (int, float)): S[str(n).strip()] = float(v)
canon = {k.lower(): k for k in S}
rows = []  # (hrow, ma, sale, nguon, value, cnt)
for i in range(3, 3000):
    tags = [h.cell(i, c).value for c in range(1, cNote)]
    tags = [t.strip() for t in tags if t and str(t).strip()]
    val = h.cell(i, cVal).value
    if not tags or not isinstance(val, (int, float)): continue
    nguon = h.cell(i, cSrc).value
    ma = h.cell(i, cNote).value
    cnt = len(tags)
    for t in tags: rows.append((i, ma, canon.get(t.lower(), t), nguon, float(val), cnt))
tot = collections.defaultdict(float)
for r in rows: tot[r[2]] += r[4] / r[5]
adj = {k: S[k] - tot.get(k, 0) for k in S if abs(S[k] - tot.get(k, 0)) > 0.5}
wb = openpyxl.load_workbook(old)
ws = wb['Du_lieu']
sty = [copy.copy(ws.cell(2, c)._style) for c in range(1, 11)]
ws.delete_rows(2, ws.max_row)
r0 = 2
data = [(f'H{r[0]}', r[1], '', r[2], r[3], r[4], r[5]) for r in rows]
data += [('DC', 'Điều chỉnh theo KT Huyền (cột TỔNG)', '', k, 'Điều chỉnh theo KT Huyền', round(v, 2), 1) for k, v in adj.items()]
last = r0 + len(data) - 1
for j, (a, b, c, d, e, f, g) in enumerate(data):
    r = r0 + j
    vals = [a, b, c, d, e, f, g, f'=F{r}/G{r}',
            f'=IF(OR(LOWER(TRIM(E{r}))=Cau_hinh!$B$5,LOWER(TRIM(E{r}))=Cau_hinh!$B$6),1,0)',
            f'=IF(AND(D{r}=Cau_hinh!$B$9,I{r}=0),1,0)']
    for c, v in enumerate(vals, 1):
        cell = ws.cell(r, c, v); cell._style = copy.copy(sty[c - 1])
    if a == 'DC':
        for c in range(1, 11): ws.cell(r, c).fill = PatternFill('solid', fgColor='FFF2CC')
# đổi vùng công thức 1454 -> last
for s in ('Phat_theo_kenh', 'Phat_tung_nguoi'):
    for row in wb[s].iter_rows():
        for c in row:
            if isinstance(c.value, str) and '1454' in c.value: c.value = c.value.replace('1454', str(last))
wb['Cau_hinh']['A18'] = ('Dữ liệu T10 theo file FINAL "LƯƠNG SALE" (Duyên chốt 04/11): DT từng sale = cột TỔNG; Du_lieu = từng dòng thẻ chia đều theo số sale. '
                         'Nếu có dòng vàng "Điều chỉnh theo KT Huyền" = phần số chốt lệch cộng dòng (không rõ kênh → tính NGOÀI kênh FB chính).')
# ── Duyên 04/11 (18:06): phần 8 tỷ chỉ TRỪ nguồn mỹ phẩm/Dược (nguồn NGUỒN vẫn tính); MKT (Huy, Hưng) tính theo kênh nguồn riêng ──
ws['K1'] = 'Loại khỏi phần 8 tỷ (nguồn Facebook=mỹ phẩm / Kênh Dược) (1/0)'; ws['K1']._style = copy.copy(ws['J1']._style)
for r in range(r0, last + 1):
    ws.cell(r, 11, f'=IF(OR(LOWER(TRIM(E{r}))="facebook",LOWER(TRIM(E{r}))="kênh dược"),1,0)')
ws.column_dimensions['K'].width = 24
pk = wb['Phat_theo_kenh']
pk['B17'] = f'=SUMIFS(Du_lieu!H2:H{last},Du_lieu!I2:I{last},0,Du_lieu!J2:J{last},0,Du_lieu!K2:K{last},0)'
pk['A17'] = 'Doanh thu còn lại (đ) — đã trừ kênh FB chính, đơn ngoài FB của Mến, nguồn Facebook (mỹ phẩm) / Kênh Dược'
pk['A23'] = 'DT nguồn bị loại khỏi phần 8 tỷ (Facebook mỹ phẩm + Kênh Dược; vẫn TÍNH nguồn NGUỒN) (đ)'
pk['B23'] = f'=SUMIFS(Du_lieu!H2:H{last},Du_lieu!I2:I{last},0,Du_lieu!J2:J{last},0,Du_lieu!K2:K{last},1)'
pk['B23'].number_format = '#,##0'
pk['A30'] = 'Kiểm tra: DT kênh FB chính + DT còn lại + DT nguồn loại = tổng DT sau khi chia sale (đ)'
pk['B30'] = '=B6+B17+B23'
# Sheet MKT
mk = wb.create_sheet('Phat_MKT')
mk.append(['PHẠT MARKETING (Huy, Hưng) — theo KÊNH NGUỒN riêng. Nhập KPI tháng vào cột B (ô vàng); chưa có KPI thì chưa tính phạt.'])
mk.append(['Marketer', 'KPI kênh (đ)', 'Mã kênh 1 (ID trong tên nguồn)', 'DT kênh 1 (đ)', 'Mã kênh 2', 'DT kênh 2 (đ)', 'Tổng DT (đ)', '% hoàn thành', 'Tỷ lệ phạt (× KPI)', 'Tiền phạt (đ)'])
mkt = [('Ngô Việt Huy', '595079630356410', '108184481052869'), ('Nguyễn Văn Hưng', '503073659823687', '862972056891669')]
for i, (n, a, b) in enumerate(mkt):
    r = 3 + i
    dsum = lambda c: f'=SUMIFS(Du_lieu!$H$2:$H${last},Du_lieu!$E$2:$E${last},"*"&{c}{r}&"*")'
    mk.append([n, None, a, dsum('C'), b, dsum('E'), f'=D{r}+F{r}', f'=IF(B{r}>0,G{r}/B{r},"Chưa nhập KPI")',
               f'=IF(B{r}>0,IF(H{r}>=1,0,IF(H{r}>Cau_hinh!$C$11,Cau_hinh!$B$11,IF(H{r}>Cau_hinh!$C$12,Cau_hinh!$B$12,IF(H{r}>Cau_hinh!$C$13,Cau_hinh!$B$13,Cau_hinh!$B$14)))),"")',
               f'=IF(B{r}>0,B{r}*I{r},"")'])
    mk.cell(r, 2).fill = PatternFill('solid', fgColor='FFF2CC')
    for c in (2, 4, 6, 7, 10): mk.cell(r, c).number_format = '#,##0'
    mk.cell(r, 8).number_format = '0.00%'; mk.cell(r, 9).number_format = '0.000%'
mk.append([]); mk.append(['Ghi chú: DT kênh = tổng giá trị đơn (mỗi đơn 1 lần) theo nguồn đơn chứa mã kênh; MKT tự chịu phạt, KHÔNG cộng vào bảng phạt Sale.'])
for c in mk[2]: c.font = Font(bold=True)
mk['A1'].font = Font(bold=True)
mk.column_dimensions['A'].width = 22
for col in 'BCDEFGHIJ': mk.column_dimensions[col].width = 24
# Sheet đối chiếu
dc = wb.create_sheet('Doi_chieu_Huyen')
dc.append(['Sale (CRM)', 'KT Huyền (cột TỔNG)', 'Tổng Du_lieu', 'Chênh (phải = 0)', 'Trong đó dòng điều chỉnh', 'DT kênh FB chính'])
for k in S:
    n = dc.max_row + 1
    dc.append([k, S[k], f'=SUMIFS(Du_lieu!$H$2:$H${last},Du_lieu!$D$2:$D${last},A{n})', f'=ROUND(C{n}-B{n},0)',
               f'=SUMIFS(Du_lieu!$H$2:$H${last},Du_lieu!$D$2:$D${last},A{n},Du_lieu!$A$2:$A${last},"DC")',
               f'=SUMIFS(Du_lieu!$H$2:$H${last},Du_lieu!$D$2:$D${last},A{n},Du_lieu!$I$2:$I${last},1)'])
n = dc.max_row + 1
dc.append(['TỔNG', f'=SUM(B2:B{n-1})', f'=SUM(C2:C{n-1})', f'=SUM(D2:D{n-1})', f'=SUM(E2:E{n-1})', f'=SUM(F2:F{n-1})'])
for c in dc[1]: c.font = Font(bold=True)
for c in dc[n]: c.font = Font(bold=True)
dc.column_dimensions['A'].width = 24
for col in 'BCDEF': dc.column_dimensions[col].width = 22
for row in dc.iter_rows(min_row=2, min_col=2):
    for c in row: c.number_format = '#,##0'
wb.save(out)
print('rows', len(rows), 'adj', len(adj), 'last', last, 'sumS', sum(S.values()))

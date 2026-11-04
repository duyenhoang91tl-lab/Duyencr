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
h = openpyxl.load_workbook(src, data_only=True)['HUYỀN']
S = {}
for i in range(3, 60):
    n, v = h.cell(i, 18).value, h.cell(i, 19).value
    if n and isinstance(v, (int, float)): S[n.strip()] = float(v)
canon = {k.lower(): k for k in S}
rows = []  # (hrow, ma, sale, nguon, value, cnt)
for i in range(3, 2000):
    tags = [h.cell(i, c).value for c in range(1, 6)]
    tags = [t.strip() for t in tags if t and str(t).strip()]
    val = h.cell(i, 8).value
    if not tags or not isinstance(val, (int, float)): continue
    nguon = h.cell(i, 7).value
    ma = h.cell(i, 6).value
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
wb['Cau_hinh']['A18'] = ('Dữ liệu T10 cập nhật theo sheet HUYỀN (KT Huyền chốt, file Check_DT_t10.xlsx): DT từng sale = cột TỔNG; '
                         'dòng vàng "Điều chỉnh theo KT Huyền" ở Du_lieu = phần KT sửa tay (không rõ kênh → tính NGOÀI kênh FB chính).')
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

#!/usr/bin/env python3
# Dung: python3 tools/bonus-t10/build_b_vs_kt.py <file_KT_co_sheet_HUYEN.xlsx> <ra.xlsx>
# Doi chieu Bao cao B (Pos, cot CRM sheet "1_Theo sale (final)") voi bang KT sheet "HUYỀN" (cot R:S). Ap cac case Huyen & Ninh theo cach chia cua KT
# (Duyen xac nhan 2026-11-03: KT chia chuan) -> "B sau dieu chinh"; phan con lech liet ke ro nguyen nhan. Tao them dong dan vao file THEO DOI DON CHIA SALE.
import sys, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True)
D = {r[1]: r[3] for r in wb['1_Theo sale (final)'].iter_rows(min_row=3, values_only=True) if r[1] and r[1] != 'TỔNG' and isinstance(r[3], (int, float))}
S = {}
for r in wb['HUYỀN'].iter_rows(min_row=3, values_only=True):
    if r[17] and isinstance(r[18], (int, float)): S[str(r[17]).strip()] = r[18]
low = lambda d: {k.lower(): (k, v) for k, v in d.items()}
Dl, Sl = low(D), low(S)
# (ma, don Pos, sale, CRM dang chia, KT chia, ghi chu, can dan vao file KT?)
CASES = [
 ('17T10/2026', 17332000, 'ninhnga99', 8666000, 14058000, 'KT: dòng 6.700.000 (ninhnga99+huyenmaii1990) + dòng 10.708.000 (ninhnga99). KT cộng 17.408.000 lệch Pos +76.000 → cần dấu x', True),
 ('17T10/2026', 17332000, 'huyenmaii1990', 8666000, 3350000, '', True),
 ('268T10/2026', 14960000, 'ninhnga99', 7480000, 9360000, 'KT: 10.500.000 (ninhnga99+ninhLTK1984) + 4.110.000 (ninhnga99). KT cộng 14.610.000 lệch Pos −350.000 → cần dấu x', True),
 ('268T10/2026', 14960000, 'ninhLTK1984', 7480000, 5250000, '', True),
 ('BH386T10/2026', 6150000, 'huyenmaii1990', 6150000, 1550000, 'Đơn bảo hành Pos 6.150.000, KT ghi 1.550.000 (KT HUYỀN dòng 300) → cần dòng KT + dấu x', True),
 ('M44707 (đơn quầy)', 690000, 'ninhnga99', 690000, 1335000, 'Quầy 30% của 4.450.000 = 1.335.000 (KT HUYỀN chuẩn). Pos đang ghi 690.000 và đơn quầy KHÔNG có mã bộ đếm → không dán được vào file KT: sửa giá trị đơn trên Pos 690.000 → 1.335.000', False),
 ('416T10/2026', 11030000, 'ninhnga99', 8905000, 8905000, 'Đã khớp: tổng KT = Pos nên CRM đang dùng cách chia của KT (2.125.000 + 6.780.000)', False),
 ('416T10/2026', 11030000, 'minhquach1995', 2125000, 2125000, '', False),
 ('525T10/2026', 18119000, 'ninhnga99', 7768667, 7768667, 'Đã khớp: tổng KT = Pos (7.742.000 + 10.377.000)', False),
 ('525T10/2026', 18119000, 'biichnguyen1993', 7768667, 7768667, '', False),
 ('525T10/2026', 18119000, 'menbui2002', 2580667, 2580667, '', False),
 ('M45869 (681T10+937T10)', 14523000, 'huyenmaii1990', 3550000, 3550000, 'Đã khớp: Huyền 3.550.000 / Ngọc 14.523.000 (CRM D đã theo KT)', False),
 ('M45869 (681T10+937T10)', 14523000, 'ngocNB2003saleoff', 14523000, 14523000, '', False),
]
QUAY = {'ninhnga99': (9300000, 'Đơn quầy M44756: phần sale 30% của 31.000.000 (KT sheet 4b khớp 9.300.000). KT HUYỀN không liệt kê đơn quầy (KT tính ở file quầy) → GIỮ trong B, không phải lỗi.')}
CAUSE = {
 'anhnp1999': 'BH341T10/2026/4310: Pos 4.310.000, KT HUYỀN 2.310.000',
 'linhnm1995': '914T10/2026 (5.850.000): KT thêm thẻ trangbeCSKH1995 → mỗi người 2.925.000; CRM theo thẻ Pos (linhNM1995 một mình)',
 'trangbecskh1995': 'như linhNM1995 (914T10/2026)',
 'thuyha88': '1162T10 thu COD: KT HUYỀN 5.664.000, Pos/CRM 3.300.000',
 'nguyenngo1988': '113T10/2026 + BH435T09: Pos 4.085.000, KT HUYỀN 1.060.000',
 'minhanh99': 'Đơn bảo hành ghép "X + BH…": KT thêm thẻ lanVH1995 và hạ giá trị nhiều đơn (vd 461T10, 445T10, 441T10) so với Pos',
 'lanvh1995': 'KT thêm lanVH1995 vào thẻ đơn bảo hành (CRM theo thẻ Pos: không có lanVH1995)',
}
BLUE = PatternFill('solid', fgColor='305496'); YEL = PatternFill('solid', fgColor='FFF2CC'); GRN = PatternFill('solid', fgColor='E2EFDA'); GREY = PatternFill('solid', fgColor='D9D9D9')
thin = Side(style='thin', color='BFBFBF'); BD = Border(left=thin, right=thin, top=thin, bottom=thin)
def hdr(ws, r, vals):
    for i, v in enumerate(vals, 1):
        c = ws.cell(r, i, v); c.font = Font(bold=True, color='FFFFFF'); c.fill = BLUE; c.border = BD; c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center')
w = openpyxl.Workbook()
# --- sheet case ---
c = w.active; c.title = 'Case_Huyen_Ninh'
c['A1'] = 'CASE HUYỀN & NINH — KT chia chuẩn (Duyên xác nhận), tính theo sheet HUYỀN'; c['A1'].font = Font(bold=True, size=13)
hdr(c, 3, ['Mã bộ đếm / đơn', 'Giá trị đơn Pos', 'Sale', 'CRM B đang chia', 'KT chia (sheet HUYỀN)', 'ĐIỀU CHỈNH (KT − CRM)', 'Ghi chú', 'Dán vào file KT?'])
for i, (ma, pos, sale, cr, kt, note, paste) in enumerate(CASES):
    r = 4 + i
    for j, v in enumerate([ma, pos, sale, cr, kt, f'=E{r}-D{r}', note, 'CÓ' if paste else 'không']): c.cell(r, j + 1, v)
    for j in range(1, 9):
        c.cell(r, j).border = BD
        if j in (2, 4, 5, 6): c.cell(r, j).number_format = '#,##0'
    c.cell(r, 6).fill = GRN
cl = 4 + len(CASES) - 1
for L, wd in zip('ABCDEFGH', (26, 16, 20, 16, 18, 18, 90, 14)): c.column_dimensions[L].width = wd
# --- sheet theo sale ---
t = w.create_sheet('B_theo_sale', 0)
t['A1'] = 'BÁO CÁO B (POS) vs BÁO CÁO KẾ TOÁN (sheet HUYỀN) — T10/2026'; t['A1'].font = Font(bold=True, size=13)
t['A2'] = 'B sau điều chỉnh = B hiện tại + điều chỉnh các case Huyền & Ninh (sheet Case_Huyen_Ninh). Phần lệch còn lại ghi rõ nguyên nhân, chưa sửa vì chưa được xác nhận.'
hdr(t, 4, ['Sale', 'B hiện tại (CRM)', 'KT (sheet HUYỀN)', 'Lệch hiện tại', 'Điều chỉnh case Huyền & Ninh', 'B sau điều chỉnh', 'Đơn quầy ngoài HUYỀN (giữ trong B)', 'LỆCH CÒN LẠI so với KT', 'Nguyên nhân lệch còn lại'])
names = sorted({k for k in set(Dl) | set(Sl) if abs(Dl.get(k, (0, 0))[1] - Sl.get(k, (0, 0))[1]) > 1} | {s.lower() for _, _, s, *_ in CASES if _[0:0] == ''}, key=lambda k: -abs(Dl.get(k, (0, 0))[1] - Sl.get(k, (0, 0))[1]))
r0 = 5
for i, k in enumerate(names):
    r = r0 + i; nm = (Dl.get(k) or Sl.get(k))[0]
    t.cell(r, 1, nm); t.cell(r, 2, Dl.get(k, (0, 0))[1]); t.cell(r, 3, Sl.get(k, (0, 0))[1])
    t.cell(r, 4, f'=B{r}-C{r}'); t.cell(r, 5, f'=SUMIF(Case_Huyen_Ninh!$C$4:$C${cl},A{r},Case_Huyen_Ninh!$F$4:$F${cl})')
    t.cell(r, 6, f'=B{r}+E{r}'); q = QUAY.get(nm, (0, ''))
    t.cell(r, 7, q[0]); t.cell(r, 8, f'=F{r}-C{r}-G{r}'); t.cell(r, 9, (q[1] + ' ' if q[1] else '') + CAUSE.get(k, ''))
    for j in range(1, 10):
        t.cell(r, j).border = BD
        if 2 <= j <= 8: t.cell(r, j).number_format = '#,##0'
    t.cell(r, 8).fill = GRN
last = r0 + len(names) - 1; tr = last + 1; t.cell(tr, 1, 'TỔNG CÁC SALE LỆCH')
for j in range(2, 9):
    L = openpyxl.utils.get_column_letter(j); t.cell(tr, j, f'=SUM({L}{r0}:{L}{last})'); t.cell(tr, j).number_format = '#,##0'
for j in range(1, 10): t.cell(tr, j).font = Font(bold=True); t.cell(tr, j).fill = GREY
tr2 = tr + 1; t.cell(tr2, 1, 'TỔNG TOÀN BỘ (mọi sale)'); t.cell(tr2, 2, sum(D.values())); t.cell(tr2, 3, sum(S.values())); t.cell(tr2, 4, f'=B{tr2}-C{tr2}')
for j in (2, 3, 4): t.cell(tr2, j).number_format = '#,##0'
for L, wd in zip('ABCDEFGHI', (20, 17, 17, 15, 18, 17, 18, 17, 110)): t.column_dimensions[L].width = wd
t.row_dimensions[4].height = 45; t.freeze_panes = 'B5'
# --- sheet dong dan vao file KT ---
p = w.create_sheet('Dong_dan_file_KT')
p['A1'] = 'DÒNG DÁN VÀO FILE "THEO DÕI ĐƠN CHIA SALE" (cột như file KT) — CRM không ghi được vào file Google của KT'; p['A1'].font = Font(bold=True, size=13)
p['A2'] = 'Mỗi Mã bộ đếm: các dòng cùng mã; Sale nhiều người trong 1 dòng = chia đều trong dòng đó. Điền "x" ở cột Xác nhận khi tổng KT khác giá Pos, rồi bấm Lọc lại Báo cáo B.'
hdr(p, 4, ['Kênh bán', 'Sale bán', 'Giá trị cọc', 'Tổng giá trị đơn (ko ship)', 'Giá trị chênh', 'Mã bộ đếm', 'Xác nhận'])
ROWS = [('Fb Phạm Thu Hiền', 'ninhnga99, huyenmaii1990', 6700000, '17T10/2026'), ('Fb Phạm Thu Hiền', 'ninhnga99', 10708000, '17T10/2026'),
        ('Facebook / Phạm Thu Hiền - Hiền Tour', 'ninhnga99, ninhLTK1984', 10500000, '268T10/2026'), ('Facebook / Phạm Thu Hiền - Hiền Tour', 'ninhnga99', 4110000, '268T10/2026'),
        ('Bảo hành', 'huyenmaii1990', 1550000, 'BH386T10/2026')]
for i, (k, s_, tg, ma) in enumerate(ROWS):
    r = 5 + i
    for j, v in enumerate([k, s_, 0, tg, 0, ma, 'x']): p.cell(r, j + 1, v)
    for j in range(1, 8):
        p.cell(r, j).border = BD
        if j in (3, 4, 5): p.cell(r, j).number_format = '#,##0'
    p.cell(r, 7).fill = YEL
for L, wd in zip('ABCDEFG', (38, 28, 12, 22, 14, 18, 12)): p.column_dimensions[L].width = wd
w.save(out); print('saved', out, len(names), 'sale lech')

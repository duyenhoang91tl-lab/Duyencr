#!/usr/bin/env python3
# Dung: python3 tools/bonus-t10/build_commission_sheet.py <file_doi_soat.xlsx> <work_dir> <ra.xlsx>
# Them 1 sheet "TONG_THUONG_HOA_HONG_SALE" len dau file (cac sheet khac GIU NGUYEN): hoa hong % theo nhom + thuong - hoan/huy thang truoc = thuc nhan.
# Can commission-result.json (calc_commission.js) + sheet THUONG_Tong_theo_sale va 3_Đơn huỷ trong file. Moi so tien la CONG THUC, ty le o o vang sua duoc.
import sys, json, re, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, work, out = sys.argv[1], sys.argv[2], sys.argv[3]
SN = 'TONG_THUONG_HOA_HONG_SALE'
rows = json.load(open(work + '/commission-result.json'))['rows']
wb = openpyxl.load_workbook(src)
if SN in wb.sheetnames: del wb[SN]
s = wb.create_sheet(SN, 0)
CL = {'online': 'Online', 'offline': 'Offline', 'probation': 'Offline'}
cls = [r for r in rows if r['channel'] in CL]
unc = [r for r in rows if r['channel'] not in CL and (r['gold10']['revenue'] + r['gold14']['revenue'] + r['mp']['revenue']) > 0]
key = lambda r: -(r['total'])
cls.sort(key=lambda r: (CL[r['channel']] != 'Online', key(r))); unc.sort(key=key)
BLUE = PatternFill('solid', fgColor='305496'); YEL = PatternFill('solid', fgColor='FFF2CC'); GREY = PatternFill('solid', fgColor='D9D9D9'); GRN = PatternFill('solid', fgColor='E2EFDA')
thin = Side(style='thin', color='BFBFBF'); BD = Border(left=thin, right=thin, top=thin, bottom=thin)
def hdr(r, vals):
    for i, v in enumerate(vals, 1):
        c = s.cell(r, i, v); c.font = Font(bold=True, color='FFFFFF'); c.fill = BLUE; c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center'); c.border = BD
s['A1'] = 'TỔNG THƯỞNG + HOA HỒNG TỪNG SALE — T10/2026 (FINAL)'; s['A1'].font = Font(bold=True, size=14)
s['A2'] = 'Thực nhận = Hoa hồng % theo nhóm + Thưởng chương trình − Hoa hồng bị trừ do hoàn/huỷ tháng trước. Ô VÀNG là tỷ lệ/giá trị sửa được, mọi số tiền khác là công thức.'
s['A3'] = 'Chưa gồm: hoa hồng đơn chia cửa hàng (sheet 4b) — thiếu giá trị đơn gốc để xếp ≥/<15tr; Ngọc (thử việc từ 14/10) tạm dùng mức Offline.'
hdr(5, ['BẢNG TỶ LỆ HOA HỒNG (sửa được)', 'Online', 'Offline'])
rates = [('Đơn ≥ 15tr', 0.015, 0.01), ('Đơn < 15tr', 0.01, 0.008), ('Nguồn vàng 10k (mọi kênh)', 0.015, None), ('Nguồn vàng 14k (mọi kênh)', 0.01, None), ('Mỹ phẩm (mọi kênh)', 0.01, None)]
for i, (lab, a, b) in enumerate(rates):
    r = 6 + i; s.cell(r, 1, lab).border = BD
    for col, v in ((2, a), (3, b)):
        c = s.cell(r, col, v); c.number_format = '0.0%'; c.border = BD
        if v is not None: c.fill = YEL
H = ['Sale', 'Kênh', 'DT đơn ≥15tr', 'DT đơn <15tr', 'DT nguồn vàng 10k', 'DT nguồn vàng 14k', 'DT mỹ phẩm', 'HH đơn ≥15tr', 'HH đơn <15tr', 'HH vàng 10k', 'HH vàng 14k', 'HH mỹ phẩm',
     'TỔNG HOA HỒNG', 'THƯỞNG chương trình', 'DT hoàn/huỷ T09 (phần sale)', 'TRỪ hoàn/huỷ tháng trước', 'THỰC NHẬN', 'Ghi chú']
HR = 13; hdr(HR, H); s.row_dimensions[HR].height = 48
n_c, n_u = len(cls), len(unc)
first = HR + 1; last_c = first + n_c - 1
unc_title = last_c + 3; unc_first = unc_title + 1; last_u = unc_first + n_u - 1
det_title = last_u + 3; det_hdr = det_title + 1; det_first = det_hdr + 1
# --- chi tiet hoan/huy T09 (doc sheet 3_Đơn huỷ) ---
det = []
for r in wb['3_Đơn huỷ'].iter_rows(min_row=3, values_only=True):
    if r[0] and r[3] and 'Tháng 09' in str(r[4] or ''):
        names = [x.strip() for x in str(r[1]).split(',') if x.strip()]
        for nm in names: det.append((r[0], nm, float(r[3]), len(names)))
det_last = det_first + len(det) - 1
allA = f'$A${first}:$A${last_u}'; allB = f'$B${first}:$B${last_u}'
dB = f'$B${det_first}:$B${det_last}'; dD = f'$D${det_first}:$D${det_last}'; dH = f'$H${det_first}:$H${det_last}'
def rate(col, r_hi, r_lo):   # cot rate tuong ung kenh
    return f'IF($B{{r}}="Online",$B${r_hi},IF($B{{r}}="Offline",$C${r_hi},0))'
def put(r, d, ch, note=''):
    s.cell(r, 1, d['name']); s.cell(r, 2, ch)
    vals = [d['revAbove'], d['revBelow'], d['gold10']['revenue'], d['gold14']['revenue'], d['mp']['revenue']]
    for j, v in enumerate(vals): s.cell(r, 3 + j, round(v))
    s.cell(r, 8, f'=C{r}*IF($B{r}="Online",$B$6,IF($B{r}="Offline",$C$6,0))')
    s.cell(r, 9, f'=D{r}*IF($B{r}="Online",$B$7,IF($B{r}="Offline",$C$7,0))')
    s.cell(r, 10, f'=E{r}*$B$8'); s.cell(r, 11, f'=F{r}*$B$9'); s.cell(r, 12, f'=G{r}*$B$10')
    s.cell(r, 13, f'=SUM(H{r}:L{r})')
    s.cell(r, 14, f'=IFERROR(INDEX(THUONG_Tong_theo_sale!$H:$H,MATCH($A{r},THUONG_Tong_theo_sale!$A:$A,0)),0)')
    s.cell(r, 15, f'=SUMIF({dB},$A{r},{dD})'); s.cell(r, 16, f'=SUMIF({dB},$A{r},{dH})')
    s.cell(r, 17, f'=M{r}+N{r}-P{r}'); s.cell(r, 18, note)
    for j in range(1, 19):
        c = s.cell(r, j); c.border = BD
        if 3 <= j <= 17: c.number_format = '#,##0'
    s.cell(r, 16).fill = YEL; s.cell(r, 17).font = Font(bold=True); s.cell(r, 17).fill = GRN
for i, d in enumerate(cls):
    put(first + i, d, CL[d['channel']], 'Thử việc từ 14/10 — tạm dùng mức Offline' if d['channel'] == 'probation' else '')
def total(r, label, a, b):
    s.cell(r, 1, label)
    for j in range(3, 18):
        L = openpyxl.utils.get_column_letter(j); s.cell(r, j, f'=SUM({L}{a}:{L}{b})'); s.cell(r, j).number_format = '#,##0'
    for j in range(1, 19): s.cell(r, j).font = Font(bold=True); s.cell(r, j).fill = GREY; s.cell(r, j).border = BD
total(last_c + 1, 'TỔNG CỘNG (sale đã phân loại)', first, last_c)
s.cell(unc_title, 1, 'SALE CHƯA PHÂN LOẠI Online/Offline — theo CRM hoa hồng đơn ≥/<15tr = 0% (chưa cài), chỉ tính nguồn vàng 10k/14k + mỹ phẩm').font = Font(bold=True, color='C00000')
for i, d in enumerate(unc): put(unc_first + i, d, 'Chưa phân loại', 'Cài Online/Offline ở CRM rồi chạy lại để tính hoa hồng ≥/<15tr')
if n_u: total(last_u + 1, 'TỔNG (sale chưa phân loại)', unc_first, last_u)
s.cell(det_title, 1, 'CHI TIẾT TRỪ HOÀN/HUỶ THÁNG 09 (sheet 3_Đơn huỷ, "Tháng 09 → CRM trừ"): trừ lại hoa hồng theo % của mức đơn gốc; đơn nhiều sale chia đều').font = Font(bold=True)
hdr(det_hdr, ['Mã bộ đếm', 'Sale', 'DT huỷ cả đơn', 'Phần của sale', 'Mức đơn', 'Kênh sale', '% hoa hồng', 'Tiền trừ'])
for i, (ma, nm, v, n) in enumerate(det):
    r = det_first + i
    s.cell(r, 1, ma); s.cell(r, 2, nm); s.cell(r, 3, v); s.cell(r, 4, f'=C{r}/{n}')
    s.cell(r, 5, f'=IF(C{r}>=15000000,"≥15tr","<15tr")')
    s.cell(r, 6, f'=IFERROR(INDEX({allB},MATCH(B{r},{allA},0)),"Chưa phân loại")')
    s.cell(r, 7, f'=IF(F{r}="Online",IF(E{r}="≥15tr",$B$6,$B$7),IF(F{r}="Offline",IF(E{r}="≥15tr",$C$6,$C$7),0))')
    s.cell(r, 8, f'=D{r}*G{r}')
    for j in range(1, 9):
        s.cell(r, j).border = BD
        if j in (3, 4, 8): s.cell(r, j).number_format = '#,##0'
        if j == 7: s.cell(r, j).number_format = '0.0%'
tr = det_last + 1; s.cell(tr, 1, 'TỔNG TRỪ')
for j in (3, 4, 8):
    L = openpyxl.utils.get_column_letter(j); s.cell(tr, j, f'=SUM({L}{det_first}:{L}{det_last})'); s.cell(tr, j).number_format = '#,##0'
for j in range(1, 9): s.cell(tr, j).font = Font(bold=True); s.cell(tr, j).fill = GREY
for L, w in zip('ABCDEFGHIJKLMNOPQR', (30, 15, 16, 16, 16, 16, 15, 14, 14, 13, 13, 13, 16, 16, 18, 18, 17, 42)): s.column_dimensions[L].width = w
s.freeze_panes = s.cell(HR + 1, 3)
wb.save(out); print('saved', out, '| classified', n_c, '| unclassified', n_u, '| huy T09 rows', len(det))

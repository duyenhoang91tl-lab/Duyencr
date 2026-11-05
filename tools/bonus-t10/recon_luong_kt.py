#!/usr/bin/env python3
"""Doi chieu LUONG SALE (hoa hong) file ke toan 'C DUYEN-luong sale.xlsx' (Sheet1: cot AL TONG, AM dt>15tr, AN dt<15tr, AO LUONG SALE, AP LUONG HUY) voi CRM.
Dung: python3 recon_luong_kt.py <C_DUYEN_luong_sale.xlsx> <thu_muc_work co commission-result.json> <ra.xlsx>   (chay SAU calc_commission.js)
Quy tac KT suy ra tu file: nhom Q 'SALE ONL' 1,5%/1%; 'SALE OFF' 1%/0,8%; CSKH menbui2002 them phan CSKH FB; linhNM1995 0,8% phang. Luong = AO, KHONG gom thuong."""
import sys, json, warnings, openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
warnings.filterwarnings('ignore')
src, W, out = sys.argv[1:4]
ws = openpyxl.load_workbook(src, data_only=True).active
kt = {}; grp = ''
for r in range(3, 120):
    q = ws.cell(r, 17).value
    if q and str(q).strip() != 'X': grp = str(q).strip()
    n = ws.cell(r, 19).value
    if n and ws.cell(r, 38).value is not None: kt[str(n).strip().lower()] = dict(name=str(n).strip(), grp=grp, al=ws.cell(r, 38).value or 0, am=ws.cell(r, 39).value or 0, an=ws.cell(r, 40).value or 0, ao=ws.cell(r, 41).value or 0, ap=ws.cell(r, 42).value or 0)
crm = {x['name'].lower(): x for x in json.load(open(W + '/commission-result.json'))['rows']}
RT = {'SALE ONL': (1.5, 1.0), 'SALE OFF': (1.0, 0.8), 'CSKH': (1.5, 1.0)}
H = PatternFill('solid', fgColor='1F3A5F'); Y = PatternFill('solid', fgColor='FFF3CD'); G = PatternFill('solid', fgColor='D4EDDA'); R_ = PatternFill('solid', fgColor='F8D7DA')
wb = Workbook(); s = wb.active; s.title = 'Đối chiếu từng sale'
cols = ['Sale', 'Nhóm KT', 'Kênh CRM', 'DT KT (AL)', 'DT CRM', 'Chênh DT', 'Lương KT (AO)', 'Lương CRM', 'Chênh lương', 'Lương CRM nếu dùng kênh/% của KT (ước tính)', 'Chênh còn lại', 'Kết luận / nguyên nhân', 'Lương HỦY KT (AP)']
w = [20, 11, 10, 15, 15, 14, 13, 13, 13, 22, 13, 70, 14]
for i, (c, x) in enumerate(zip(cols, w), 1):
    h = s.cell(row=1, column=i, value=c); h.font = Font(bold=True, color='FFFFFF'); h.fill = H; h.alignment = Alignment(wrap_text=True, vertical='center'); s.column_dimensions[h.column_letter].width = x
s.row_dimensions[1].height = 48
tot = [0] * 6; i = 2
for n in sorted(set(kt) | set(crm)):
    k = kt.get(n); m = crm.get(n)
    if k and k['al'] == 0 and k['ao'] == 0 and k['ap'] == 0 and not m: continue
    dtK = k['al'] if k else 0
    dtC = (m['revAbove'] + m['revBelow'] + sum(m[g]['revenue'] for g in ('gold10', 'gold14', 'mp', 'otherChannel'))) if m else 0
    luK = k['ao'] if k else 0; luC = m['total'] if m else 0
    est = ''
    if m and k:
        a, b = RT.get(k['grp'], (1.5, 1.0))
        if n == 'linhnm1995': a = b = 0.8
        extra = sum(m[g]['commission'] for g in ('gold10', 'gold14', 'mp', 'otherChannel'))
        est = round(m['revAbove'] * a / 100 + m['revBelow'] * b / 100 + extra)
    why = []
    if not k: why.append('CRM có đơn nhưng KT không có dòng sale này')
    elif not m: why.append('KT có doanh thu/lương nhưng CRM không có đơn Pos của sale này (KT thêm tay / đơn quầy / đơn PT ngoài Pos) — cần check tay')
    else:
        kenhK = 'offline' if k['grp'] == 'SALE OFF' or n == 'linhnm1995' else 'online'
        if m['channel'] != kenhK: why.append('KÊNH LỆCH: KT tính %s (nhóm %s), CRM %s → lệch %% hoa hồng' % (kenhK, k['grp'], ('đang để ' + m['channel']) if m['channel'] else 'CHƯA phân loại kênh cho sale này'))
        if abs(dtC - dtK) > 1: why.append('DT lệch %+d (dữ liệu đơn Pos CRM khác sổ KT)' % round(dtC - dtK))
        if n == 'menbui2002': why.append('KT có thêm khoản CSKH FB Phạm Thu Hiền +432.345 (CRM chưa phân loại kênh nên lương = 0)')
        if not why: why.append('KHỚP')
    vals = [k['name'] if k else (m['name'] if m else n), k['grp'] if k else '', m['channel'] if m else '', dtK, dtC, dtC - dtK, luK, luC, luC - luK, est, (est - luK) if est != '' else '', '; '.join(why), k['ap'] if k else 0]
    for j, v in enumerate(vals, 1):
        c = s.cell(row=i, column=j, value=v)
        if j in (4, 5, 6, 7, 8, 9, 10, 11, 13): c.number_format = '#,##0'
    s.cell(row=i, column=12).alignment = Alignment(wrap_text=True)
    s.cell(row=i, column=12).fill = G if why == ['KHỚP'] else (R_ if 'KÊNH' in ' '.join(why) or 'check tay' in ' '.join(why) else Y)
    for t, v in enumerate([dtK, dtC, dtC - dtK, luK, luC, luC - luK]): tot[t] += v
    i += 1
s.cell(row=i, column=1, value='TỔNG').font = Font(bold=True)
for t, j in enumerate((4, 5, 6, 7, 8, 9)): c = s.cell(row=i, column=j, value=tot[t]); c.font = Font(bold=True); c.number_format = '#,##0'
s.freeze_panes = 'B2'
n2 = wb.create_sheet('Ghi chú')
n2.column_dimensions['A'].width = 140
for r_, t in enumerate(['KẾT LUẬN ĐỐI CHIẾU LƯƠNG SALE (file KT "C DUYÊN-lương sale")', '• File KT chỉ có HOA HỒNG ("LƯƠNG SALE" = cột AO) — KHÔNG có thưởng nên thưởng T10 (3.833.340) không đối chiếu được với file này.', '• Công thức KT khớp công thức CRM: SALE ONL 1,5% (≥15tr) / 1% (<15tr); SALE OFF 1% / 0,8%. KT đúng trên chính doanh thu của KT (35/37 sale lệch 0đ).', '• Ngoại lệ trong KT: menbui2002 (CSKH) có thêm +432.345; linhNM1995 tính 0,8% phẳng.', '• Lệch giữa KT và CRM đến từ 3 nguồn: (1) KÊNH sale — KT xếp thuydinh95, ninhnga99, phuongthao2000, anhtrinh1995 vào SALE OFF, CRM đang để online; (2) doanh thu: KT có sale/đơn mà CRM không có Pos (dieutam, lanVH1995, tuanhTVBH96, nguyenxoan, trangbeCSKH...) và ngược lại; (3) CRM chưa phân loại kênh cho menbui2002/linhNM1995 nên lương = 0.', '• Cột "Lương CRM nếu dùng kênh/% của KT" cho thấy sau khi chỉnh kênh thì chênh còn lại chỉ do doanh thu.'], 1): n2.cell(row=r_, column=1, value=t)
wb.save(out); print('ok', out, 'tong KT', tot[3], 'CRM', tot[4])

#!/usr/bin/env python3
"""Buoc 4: GHI THUONG THANG VAO FILE DOI SOAT: them cot thuong vao tung hang sheet ĐƠN PT / ĐƠN MP + them sheet THUONG_*.
Chi tinh sale da phan loai Online/Offline (cac sale con lai bo qua). Dung: python3 build_into_source.py <DOI_SOAT.xlsx> <work> <ra.xlsx>  roi recalc.py"""
import sys, json, re
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src, W, out = sys.argv[1:4]
res = json.load(open(W + '/bonus-result.json')); ch = res['channels']
wb = load_workbook(src)
import os
OV = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'order_overrides.json'), encoding='utf8')).items() if not k.startswith('_')}
# ap sua nguoi huong thuong (order_overrides.json) len cot The cua sheet DON PT truoc khi tinh doanh thu/kenh -> file chuan nhat quan voi calc_bonus
wsPT = wb['ĐƠN PT']; hdrPT = [c.value for c in wsPT[1]]; cMa = hdrPT.index('Mã đơn hàng') + 1; cEx = hdrPT.index('GIẢI THÍCH ĐỐI SOÁT (chỉ ghi đơn thay đổi/lệch)') + 1
for rr in range(2, wsPT.max_row + 1):
    ma = wsPT.cell(row=rr, column=cMa).value
    if ma in OV:
        old = wsPT.cell(row=rr, column=2).value; wsPT.cell(row=rr, column=2, value=OV[ma]['saleBan'] + ', ')
        wsPT.cell(row=rr, column=cEx, value=(str(wsPT.cell(row=rr, column=cEx).value or '') + ' | ' if wsPT.cell(row=rr, column=cEx).value else '') + f"Duyên chốt 04/11: thẻ Pos '{str(old).strip(', ')}' → chỉ {OV[ma]['saleBan']} ({OV[ma]['lyDo']})")
F = 'Arial'; HDR = PatternFill('solid', fgColor='1F3A5F'); NEW = PatternFill('solid', fgColor='E2F0D9')
thin = Side(style='thin', color='BFBFBF'); BOX = Border(left=thin, right=thin, top=thin, bottom=thin); MONEY = '#,##0;[Red]-#,##0;-'
f = lambda **k: Font(name=F, size=k.pop('size', 10), **k)
PT_ORDER = {'Theo đơn', 'Theo sản phẩm'}
# Don Pos TACH (calc_bonus.js gop "<ma>/2026/1", "/2" thanh 1 don): thuong nam o dong dau; cac dong con lai ghi chu "tinh gop" cho de doi chieu
tach_sub = {}
for g in res.get('tachGroups', []):
    for i in g['ids'][1:]: tach_sub[i] = f"Đơn tách {g['key']}: thưởng tính GỘP ({' + '.join(g['maDon'])} = {g['tong']:,.0f}đ) — hiện ở dòng {g['maDon'][0]}".replace(',', '.')
per = {}
for s in res['bySale']:
    if s['name'] not in ch: continue
    for it in s['items']:
        if it.get('orderId'):
            e = per.setdefault(it['orderId'], {'don': 0, 'sp': 0, 'ct': []})
            e['sp' if it['scope'] == 'Theo sản phẩm' else 'don'] += it['amount']
            e['ct'].append(f"{s['name']}: {it['program']} +{it['amount']:,}".replace(',', '.'))
KIND = {'Theo sản phẩm': 'Theo sản phẩm', 'Theo ngày (doanh số)': 'Theo doanh số ngày', 'Theo đơn': 'Theo đơn (giá trị đơn)', 'Theo ngày (đơn đầu tiên)': 'Thưởng thử việc (đơn đầu/số đơn)', 'Theo ngày (số đơn)': 'Thưởng thử việc (đơn đầu/số đơn)'}
TYPE = {}
for n in ('Tỳ Hưu Thiên Lộc Moon', 'Tỳ Hưu Thiên Lộc Tourmaline (Hồng/Xanh)', 'Tỳ Hưu Thiên Lộc Aquamarine'): TYPE[n] = 'Theo sản phẩm'
def kind(it): return TYPE.get(it['program'], KIND.get(it['scope'], it['scope']))
# ---- cot thuong tung hang ----
for sh, pre in (('ĐƠN PT', 'PT'),):   # ĐƠN MP (my pham) KHONG tinh thuong
    ws = wb[sh]; c0 = ws.max_column + 1
    _h = [c.value for c in ws[1]]
    if 'Kênh sale (On/Off)' in _h: c0 = _h.index('Kênh sale (On/Off)') + 1   # file da co cot thuong tu lan chay truoc -> GHI DE, khong them cot trung
    heads = ['Kênh sale (On/Off)', 'Thưởng THEO ĐƠN (đ)', 'Thưởng THEO SẢN PHẨM (đ)', 'Tổng thưởng đơn (đ)', 'Chi tiết thưởng (sale: chương trình +đ)']
    for j, h in enumerate(heads):
        c = ws.cell(row=1, column=c0 + j, value=h); c.font = f(bold=True, color='FFFFFF'); c.fill = HDR; c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center'); c.border = BOX
    ws.column_dimensions[ws.cell(row=1, column=c0).column_letter].width = 16
    for j in (1, 2, 3): ws.column_dimensions[ws.cell(row=1, column=c0 + j).column_letter].width = 18
    ws.column_dimensions[ws.cell(row=1, column=c0 + 4).column_letter].width = 70
    L = lambda j: ws.cell(row=1, column=c0 + j).column_letter
    for r in range(2, ws.max_row + 1):
        the = ws.cell(row=r, column=2).value
        if the is None: continue
        names = [x.strip() for x in str(the).split(',') if x.strip()]
        kenh = sorted({ {'online': 'On', 'offline': 'Off', 'probation': 'Thử việc'}[ch[n]] for n in names if n in ch })
        e = per.get(f'{pre}{r-2}')
        ws.cell(row=r, column=c0, value='/'.join(kenh))
        ws.cell(row=r, column=c0 + 1, value=e['don'] if e else 0); ws.cell(row=r, column=c0 + 2, value=e['sp'] if e else 0)
        ws.cell(row=r, column=c0 + 3, value=f'={L(1)}{r}+{L(2)}{r}')
        ws.cell(row=r, column=c0 + 4, value='; '.join(e['ct']) if e else tach_sub.get(f'{pre}{r-2}', ''))
        for j in range(5):
            c = ws.cell(row=r, column=c0 + j); c.font = f(); c.fill = NEW
            if 1 <= j <= 3: c.number_format = MONEY
    OI = res.get('orderInfo') or {}
    if OI:   # CHE DO DON GOC BASE: 2 cot thong tin (header bat dau bang 'Thưởng' de prepare_base.py go lai duoc)
        for j, h in enumerate(['Thưởng — mã đơn gốc Base', 'Thưởng — giá tính (Base + phần dư) | chia']):
            c = ws.cell(row=1, column=c0 + 5 + j, value=h); c.font = f(bold=True, color='FFFFFF'); c.fill = HDR; c.alignment = Alignment(wrap_text=True, horizontal='center', vertical='center'); c.border = BOX
        ws.column_dimensions[ws.cell(row=1, column=c0 + 5).column_letter].width = 18; ws.column_dimensions[ws.cell(row=1, column=c0 + 6).column_letter].width = 60
        for r in range(2, ws.max_row + 1):
            e = OI.get(f'{pre}{r-2}')
            if not e: continue
            ws.cell(row=r, column=c0 + 5, value=e['maBase']).font = f()
            ws.cell(row=r, column=c0 + 6, value=f"{round(e['giaTinh']):,} (Pos {round(e['giaPos']):,}) | {e['chia']}".replace(',', '.') + ('' if e['donGoc'] else ' | KHÔNG phải đơn gốc')).font = f()
            for j in (5, 6): ws.cell(row=r, column=c0 + j).fill = NEW
    ws.freeze_panes = ws.freeze_panes or 'C2'
    print(sh, 'cot thuong tu cot', c0)
# ---- sheet THUONG_Chi_tiet (don + SP + doanh so ngay) ----
rows = []
for s in res['bySale']:
    if s['name'] not in ch: continue
    for it in s['items']: rows.append((it['date'], s['name'], {'online': 'Online', 'offline': 'Offline', 'probation': 'Thử việc'}[ch[s['name']]], kind(it), it['program'], it['amount'], it.get('detail', ''), it.get('maDonPos', '')))
rows.sort(key=lambda r: (r[1].lower(), r[0]))
def sheet(name, idx=None):
    if name in wb.sheetnames: del wb[name]
    return wb.create_sheet(name, idx)
def head(ws, row, cols, widths):
    for i, (c, w) in enumerate(zip(cols, widths), 1):
        x = ws.cell(row=row, column=i, value=c); x.font = f(bold=True, color='FFFFFF'); x.fill = HDR; x.border = BOX; x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); ws.column_dimensions[x.column_letter].width = w
    ws.row_dimensions[row].height = 32
d = sheet('THUONG_Chi_tiet')
d['A1'] = 'CHI TIẾT THƯỞNG ONLINE/OFFLINE T10/2026 (chỉ 18 sale đã phân loại; sale khác bỏ qua)'; d['A1'].font = f(bold=True, size=13, color='1F3A5F')
head(d, 3, ['Ngày', 'Sale', 'Kênh', 'Loại thưởng', 'Chương trình', 'Tiền thưởng (đ)', 'Căn cứ', 'Mã đơn Pos'], [12, 22, 10, 24, 44, 16, 60, 22])
for i, r in enumerate(rows, 4):
    for j, v in enumerate(r, 1):
        c = d.cell(row=i, column=j, value=v); c.font = f(); c.border = BOX
        if j == 6: c.number_format = MONEY
D0, D1 = 4, 3 + len(rows); d.freeze_panes = 'A4'; d.auto_filter.ref = f'A3:H{D1}'
# ---- THUONG_Tong_theo_sale ----
rev = {}   # doanh thu don PT (khong MP), chia deu theo the, tinh ca don bao hanh
lc = {k.lower(): k for k in ch}
for r in wb['ĐƠN PT'].iter_rows(min_row=2, values_only=True):
    if not r[1] or not r[23]: continue
    names = [x.strip() for x in str(r[1]).split(',') if x.strip()]
    for n in names:
        k = lc.get(n.lower())
        if k: rev[k] = rev.get(k, 0) + float(r[23]) / len(names)
BASEMODE = bool(res.get('orderInfo'))
if BASEMODE: rev = res.get('revBySale', {})   # doanh thu theo DON GOC BASE (Base + phan du theo The Pos) cua cac don trong T10 (ngay len Base), khong MP/bao hanh/NGUON
t = sheet('THUONG_Tong_theo_sale', 0)
t['A1'] = 'BẢNG THƯỞNG ONLINE / OFFLINE — T10/2026'; t['A1'].font = f(bold=True, size=14, color='1F3A5F')
t['A2'] = 'Chỉ đội Online + Offline (18 sale đã phân loại). ' + ('CHIA THEO ĐƠN GỐC BASE (Base + phần Pos tăng thêm chia theo thẻ Pos); ngày tính = ngày lên đơn trên Base; chỉ đơn gốc đã ghép Base được tính thưởng.' if BASEMODE else 'Doanh thu = đơn PT chia đều theo thẻ (không gồm đơn MP mỹ phẩm).') + ' Thưởng tính bằng hàm _computeBonusData_ của CRM trên sheet ĐƠN PT (đã trừ bảo hành, KHÔNG tính đơn MP mỹ phẩm); cộng bằng SUMIFS từ THUONG_Chi_tiet.'; t['A2'].font = f(italic=True, color='666666')
head(t, 4, ['Sale', 'Kênh', ('Doanh thu theo đơn gốc Base T10 (đ)' if BASEMODE else 'Doanh thu đơn PT T10 (đ, không MP)'), 'Thưởng THEO ĐƠN (giá trị đơn)', 'Thưởng THEO DOANH SỐ NGÀY', 'Thưởng THEO SẢN PHẨM', 'Thưởng THỬ VIỆC (đơn đầu / số đơn)', 'TỔNG THƯỞNG'], [24, 10, 22, 20, 20, 20, 22, 18])
order = sorted(ch, key=lambda n: ({'online': 0, 'offline': 1, 'probation': 2}[ch[n]], -rev.get(n, 0)))
row = 5
for n in order:
    t.cell(row=row, column=1, value=n); t.cell(row=row, column=2, value={'online': 'Online', 'offline': 'Offline', 'probation': 'Thử việc'}[ch[n]]); t.cell(row=row, column=3, value=rev.get(n, 0))
    for j, lab in zip((4, 5, 6, 7), ('Theo đơn (giá trị đơn)', 'Theo doanh số ngày', 'Theo sản phẩm', 'Thưởng thử việc (đơn đầu/số đơn)')):
        t.cell(row=row, column=j, value=f'=SUMIFS(THUONG_Chi_tiet!$F${D0}:$F${D1},THUONG_Chi_tiet!$B${D0}:$B${D1},$A{row},THUONG_Chi_tiet!$D${D0}:$D${D1},"{lab}")')
    t.cell(row=row, column=8, value=f'=SUM(D{row}:G{row})')
    for j in range(1, 9):
        c = t.cell(row=row, column=j); c.font = f(bold=(j == 8)); c.border = BOX
        if j >= 3: c.number_format = MONEY
    row += 1
last = row - 1
for lab in ('Online', 'Offline', 'Thử việc'):
    t.cell(row=row, column=1, value='TỔNG ' + lab.upper())
    for j in range(3, 9):
        Lc = t.cell(row=row, column=j).column_letter; t.cell(row=row, column=j, value=f'=SUMIFS({Lc}$5:{Lc}${last},$B$5:$B${last},"{lab}")')
    row += 1
t.cell(row=row, column=1, value='TỔNG CỘNG')
for j in range(3, 9):
    Lc = t.cell(row=row, column=j).column_letter; t.cell(row=row, column=j, value=f'=SUM({Lc}5:{Lc}{last})')
for r in range(last + 1, row + 1):
    for j in range(1, 9):
        c = t.cell(row=r, column=j); c.font = f(bold=True); c.border = BOX
        if j >= 3: c.number_format = MONEY
for i, s in enumerate(['LƯU Ý:', '1) Ước tính theo 12 CT mẫu "Thưởng online chính thức" trong CRM — đối chiếu Báo cáo G (CT bật thật có thể khác).', '2) Không tự loại Tỳ Hưu Ngọc/Ruby/Saphire và đơn huỷ; đơn chia tay chưa có tỷ lệ tính chia đều theo thẻ.', '3) Ngọc (ngocNB2003saleoff) là Sale THỬ VIỆC, bắt đầu tính thưởng 14/10/2026: ngày 1-3 (14,15,16/10) thưởng ĐƠN ĐẦU TIÊN TRONG NGÀY 50.000đ; từ ngày 4 (17/10) thưởng bậc số đơn/ngày và doanh số ngày (mẫu "Cơ chế thưởng kích hoạt Sale mới"). Không dùng bảng thưởng chính thức.', '4) Thưởng THEO ĐƠN/SẢN PHẨM nằm ở 5 cột cuối từng hàng sheet ĐƠN PT; thưởng DOANH SỐ NGÀY tính theo sale-ngày nên chỉ có ở THUONG_Chi_tiet.']):
    t.cell(row=row + 2 + i, column=1, value=s).font = f(bold=(i == 0), italic=(i > 0), color='444444')
EX = res.get('excludedBase') or []
if EX:   # don cua 18 sale KHONG duoc tinh thuong trong che do don goc Base (chua ghep Base / khong phai don goc) — KT doi chieu tay
    x = sheet('THUONG_Don_khong_tinh')
    x['A1'] = 'ĐƠN CỦA 18 SALE KHÔNG ĐƯỢC TÍNH THƯỞNG (chế độ đơn gốc Base: chỉ đơn gốc đã ghép Base được tính)'; x['A1'].font = f(bold=True, size=13, color='1F3A5F')
    head(x, 3, ['Mã đơn Pos', 'Ghi chú Pos (dòng 1)', 'Ngày Pos', 'Giá trị (đ)', 'Sale', 'Lý do'], [14, 34, 12, 16, 34, 70])
    for i, e in enumerate(sorted(EX, key=lambda e: (e['lyDo'], e['ngay'])), 4):
        for j, v in enumerate((e['maDon'], e['ghiChu'], e['ngay'], e['giaTri'], e['sale'], e['lyDo']), 1):
            c = x.cell(row=i, column=j, value=v); c.font = f(); c.border = BOX
            if j == 4: c.number_format = MONEY
    x.freeze_panes = 'A4'
wb.save(out); print('saved', out, len(rows), 'dong chi tiet')

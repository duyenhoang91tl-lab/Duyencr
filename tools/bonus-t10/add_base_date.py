#!/usr/bin/env python3
"""Gan baseNgayTao (ngay tao don tren BASE) + donGoc vao orders.json de doanh thu NGAY / don dau tien tinh theo NGAY LEN DON TREN BASE nhu CRM (js/12 _bonusYmd_).
Dung: python3 add_base_date.py <Check_DT.xlsx co sheet Base> <thu_muc_work>   (chay SAU extract_orders_pos.py, TRUOC calc_bonus.js)
NGUYEN NHAN GOC: calc_bonus.js truoc day tinh ngay theo ngay POS -> don len Base 20/10 nhung len Pos 23/10 bi tinh vao 23/10 (trangNH2005 23/10 = 62,12tr nhan nham thuong ngay 60tr; theo Base 23/10 chi 17,4tr).
Don khong khop Base (NG..., don them) giu ngay Pos; donGoc=true cho moi don (khong loai don them nhu web) de giu hanh vi cu."""
import sys, json, re, warnings, openpyxl
warnings.filterwarnings('ignore')
x, W = sys.argv[1:3]
ws = openpyxl.load_workbook(x, read_only=True, data_only=True)['Base']
base = {}; status = {}; btxt = {}
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[20] and r[0]:
        k = str(r[20]).strip().upper(); base.setdefault(k, str(r[0])[:10]); status.setdefault(k, str(r[7] or '')); btxt.setdefault(k, str(r[14] or ''))

# QUY TAC DUYEN: don Tourmaline cao cap xet moc T21/T31 theo GIA NIEM YET truoc giam (1301T10: niem yet 31.500k, giam 5% con 29.925k van duoc T31 200k).
# NGUYEN NHAN GOC: extract_orders_pos.py (file Check_DT = Pos) khong co gia niem yet -> giaTriTruocGiam=0 -> pass "cao cap" trong calc_bonus.js bi bo qua -> don giam gia chi duoc T21.
# Khoi phuc gia niem yet tu mo ta don tren Base: "Giam X% con Y" voi Y ~ gia tri Pos -> niem yet = Pos/(1-X%). Khong khop mau -> giu 0 (khong doan).
def list_price(txt, gia):
    m = re.search(r'gi[aả]m\s*(\d+(?:[.,]\d+)?)\s*%', txt or '', re.I); c = re.search(r'c[oò]n\s*(\d[\d.,]*)\s*k', txt or '', re.I)
    if not m or not c or not gia: return 0
    pct = float(m.group(1).replace(',', '.')); con = float(re.sub(r'[.,]', '', c.group(1))) * 1000
    if not (0 < pct < 50) or abs(con - gia) > 0.01 * gia: return 0
    return round(gia / (1 - pct / 100))
CC = re.compile(r'NH[AẪ]N TOUR TR[OƠ]N CAO C[AẤ]P', re.I); ccFix = []
orders = json.load(open(W + '/orders.json')); hit = 0; check = []
TOK = re.compile(r'^\s*(NG|BH)?(\d{1,5}T\d{1,2})(?:/(\d{4}))?', re.I)
for o in orders:
    first = str(o.get('ghiChu') or '').split('\n')[0].strip().upper()
    d = base.get(first)
    m = TOK.match(first); key = ''
    if m and not m.group(1):   # don goc cua sale (khong NG/BH): doi chieu Base theo ma dau tien (thieu nam -> 2026)
        key = (m.group(2) + '/' + (m.group(3) or '2026')).upper(); d = d or base.get(key)
    if d: o['baseNgayTao'] = d; hit += 1
    else:
        mm = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', str(o.get('ngayTao') or ''))
        o['baseNgayTao'] = '%s-%02d-%02d' % (mm.group(3), int(mm.group(2)), int(mm.group(1))) if mm else ''
    o['donGoc'] = True
    if CC.search(o.get('sanPham') or '') and not o.get('giaTriTruocGiam'):
        lp = list_price(btxt.get(first) or btxt.get(key) or '', o.get('giaTriDon') or 0)
        if lp > (o.get('giaTriDon') or 0): o['giaTriTruocGiam'] = lp; ccFix.append((first[:20], o.get('saleBan'), o['giaTriDon'], lp))
    # QUY TAC DUYEN 2026-11-04: don co tren Pos nhung Base That bai/Huy hoac KHONG co tren Base -> KHONG tinh thuong, dua vao danh sach CHECK TAY.
    # Don them NG... / BH... la don di kem (khong co dong rieng tren Base) -> van tinh nhu cu nhung van liet ke de check tay.
    ck = key or first; st = status.get(key) or status.get(first)
    lyDo = ''
    # QUY TAC DUYEN 2026-11-05: ma T09 la don cua THANG 9 -> KHONG tinh thuong/doanh thu T10 (du Pos T10 co, du Base co). BH... la bao hanh di kem nen bo qua khi xet thang.
    mths = [mm for pre, num, mm in re.findall(r'(?<![A-Za-z0-9])(BH|NG)?(\d+)T(\d{2})(?![0-9])', first, re.I) if (pre or '').upper() != 'BH']
    if mths and all(mm == '09' for mm in mths): lyDo = 'Mã tháng 9 (T09) — không tính thưởng T10'; o['loaiThuong'] = 'thang-9'
    elif st == 'Thất bại': lyDo = 'Base Thất bại/Hủy'; o['loaiThuong'] = 'base-that-bai'
    elif m and not m.group(1) and not d: lyDo = 'Có trên Pos, KHÔNG có trên Base'; o['loaiThuong'] = 'khong-co-base'
    elif m and m.group(1) and not d: lyDo = 'Đơn thêm %s không có dòng riêng trên Base (vẫn tính như cũ)' % m.group(1).upper()
    elif not m and first: lyDo = 'Ghi chú không có mã bộ đếm đọc được'
    if lyDo: check.append({'ma': first, 'sale': o.get('saleBan'), 'sdt': o.get('sdt'), 'giaTri': o.get('giaTriDon'), 'ngayPos': o.get('ngayTao'), 'trangThaiPos': o.get('trangThai'), 'lyDo': lyDo, 'loaiThuong': o.get('loaiThuong', ''), 'id': o.get('id')})
print('gia niem yet tour cao cap khoi phuc tu Base:', ccFix)
json.dump(orders, open(W + '/orders.json', 'w'), ensure_ascii=False)
json.dump(check, open(W + '/checktay.json', 'w'), ensure_ascii=False)
print('gan ngay Base cho %d/%d don; LOAI khoi thuong: %d don (Base that bai %d, khong co Base %d); check tay: %d dong' % (hit, len(orders),
      sum(1 for o in orders if o.get('loaiThuong')), sum(1 for o in orders if o.get('loaiThuong') == 'base-that-bai'), sum(1 for o in orders if o.get('loaiThuong') == 'khong-co-base'), len(check)))

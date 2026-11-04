#!/usr/bin/env python3
"""Gan baseNgayTao (ngay tao don tren BASE) + donGoc vao orders.json de doanh thu NGAY / don dau tien tinh theo NGAY LEN DON TREN BASE nhu CRM (js/12 _bonusYmd_).
Dung: python3 add_base_date.py <Check_DT.xlsx co sheet Base> <thu_muc_work>   (chay SAU extract_orders_pos.py, TRUOC calc_bonus.js)
NGUYEN NHAN GOC: calc_bonus.js truoc day tinh ngay theo ngay POS -> don len Base 20/10 nhung len Pos 23/10 bi tinh vao 23/10 (trangNH2005 23/10 = 62,12tr nhan nham thuong ngay 60tr; theo Base 23/10 chi 17,4tr).
Don khong khop Base (NG..., don them) giu ngay Pos; donGoc=true cho moi don (khong loai don them nhu web) de giu hanh vi cu."""
import sys, json, re, warnings, openpyxl
warnings.filterwarnings('ignore')
x, W = sys.argv[1:3]
ws = openpyxl.load_workbook(x, read_only=True, data_only=True)['Base']
base = {}
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[20] and r[0]: base.setdefault(str(r[20]).strip().upper(), str(r[0])[:10])
orders = json.load(open(W + '/orders.json')); hit = 0
for o in orders:
    first = str(o.get('ghiChu') or '').split('\n')[0].strip().upper()
    d = base.get(first)
    if d: o['baseNgayTao'] = d; hit += 1
    else:
        m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', str(o.get('ngayTao') or ''))
        o['baseNgayTao'] = '%s-%02d-%02d' % (m.group(3), int(m.group(2)), int(m.group(1))) if m else ''
    o['donGoc'] = True
json.dump(orders, open(W + '/orders.json', 'w'), ensure_ascii=False)
print('gan ngay Base cho %d/%d don' % (hit, len(orders)))

#!/usr/bin/env python3
"""Buoc 1: doc file doi soat T10 (sheet ĐƠN PT + ĐƠN MP + 1_Theo sale) -> orders.json + channels.json.
Dung: python3 extract_orders.py <DOI_SOAT.xlsx> <thu_muc_ra>
KHONG commit orders.json (co SDT/dia chi khach)."""
import sys, json, pandas as pd
src, out = sys.argv[1], sys.argv[2]
import os
# Sua nguoi huong thuong theo don (order_overrides.json): The Pos co khi gan thua/sai sale -> Duyen chot lai tung don; giu the cu o saleBanGoc
OV = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'order_overrides.json'), encoding='utf8')).items() if not k.startswith('_')}
x = pd.read_excel(src, sheet_name=None, header=0)
orders = []
for sh in ('ĐƠN PT', 'ĐƠN MP'):
    df = x[sh]
    val = 'Giá trị đơn hàng sau giảm giá'
    for i, r in df.iterrows():
        the = str(r['Thẻ'] or '').strip()
        if the == 'nan' or not the: continue
        nguon = str(r.get('Nguồn đơn') if pd.notna(r.get('Nguồn đơn')) else '')
        orders.append({
            'id': sh[-2:] + str(i), 'sheet': sh, 'maDon': str(r['Mã đơn hàng']),
            'saleBan': the.strip(', '), 'nguonDon': nguon,
            'maSanPham': str(r['Mã sản phẩm']) if pd.notna(r['Mã sản phẩm']) else '',
            'sanPham': str(r['Sản phẩm']) if pd.notna(r['Sản phẩm']) else '',
            'soLuong': str(r['Số lượng']) if pd.notna(r['Số lượng']) else '',
            'giaTriDon': float(r[val]) if pd.notna(r[val]) else 0,
            'ngayTao': str(r['Ngày tạo đơn']), 'ghiChu': str(r['Ghi chú nội bộ']) if pd.notna(r['Ghi chú nội bộ']) else '',
            'trangThai': str(r.get('Trạng thái') if pd.notna(r.get('Trạng thái')) else ''),   # de calc_bonus.js loai dong Huy/Hoan khoi viec gop don tach
            'giaTriTruocGiam': float(r['Trị giá đơn hàng']) if pd.notna(r.get('Trị giá đơn hàng')) else 0,   # gia niem yet truoc giam (don Tourmaline cao cap xet moc 21,5tr/31,5tr theo gia nay)
            'baoHanh': nguon.strip().lower() == 'bảo hành'})
        if str(r['Mã đơn hàng']) in OV: orders[-1]['saleBanGoc'] = orders[-1]['saleBan']; orders[-1]['saleBan'] = OV[str(r['Mã đơn hàng'])]['saleBan']
s1 = x['1_Theo sale (final)']
ch = {}
for _, r in s1.iterrows():
    nm, k = r.iloc[1], r.iloc[0]
    if isinstance(nm, str) and nm != 'TỔNG' and k in ('On', 'Off'): ch[nm] = 'online' if k == 'On' else 'offline'
json.dump(orders, open(out + '/orders.json', 'w'), ensure_ascii=False)
json.dump(ch, open(out + '/channels.json', 'w'), ensure_ascii=False, indent=1)
print(len(orders), 'don;', sum(o['baoHanh'] for o in orders), 'don bao hanh;', len(ch), 'sale co kenh')

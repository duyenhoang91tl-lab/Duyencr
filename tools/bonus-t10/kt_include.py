#!/usr/bin/env python3
"""Dua LAI vao tinh thuong cac don Pos bi loai 'khong-co-base' MA file KT (C DUYEN-luong sale) VAN TINH.
Dung: python3 kt_include.py <C_DUYEN_luong_sale.xlsx> <work> [all|sale1,sale2]      (chay SAU add_base_date.py, TRUOC calc_bonus.js)

NGUYEN NHAN GOC: add_base_date.py loai don 'Co tren Pos, KHONG co tren Base' (ma T09, BH..., don Pos T10 ma Base export T10 khong co) -> thuydinh95 mat 3 don
(823T09+BH91T10 11,0tr; 1008T09 6,0tr; 162T09 5,15tr) trong khi KT (file chuan Duyen dung de tinh luong) van tinh doanh thu + thuong cho cac don nay.
Quy tac: don khong-co-base duoc tinh lai neu KT co dong chua CUNG ma don (token nnnTmm / BHnnTmm / NGnnTmm) VA the sale cua don co trong dong KT do.
Ngay tinh = ngay tao don tren Pos (khong co ngay Base). Don 'base-that-bai' GIU NGUYEN loai (quy tac Duyen phien 21) - chi liet ke de Duyen xem."""
import sys, re, json, warnings, openpyxl
warnings.filterwarnings('ignore')
KT, W = sys.argv[1:3]
ONLY = set(x.strip().lower() for x in (sys.argv[3] if len(sys.argv) > 3 else 'all').split(',') if x.strip())   # 'all' hoac danh sach sale (vd thuydinh95): chi tinh lai don CUA nhung sale nay; con lai chi liet ke cho Duyen chot
TOK = re.compile(r'(?<![A-Za-z0-9])((?:BH|NG)?\d+T\d{2})(?![0-9])', re.I)
ws = openpyxl.load_workbook(KT, read_only=True, data_only=True).active
kt = []   # (cac the sale lowercase, tokens, gia tri, row)
for i, r in enumerate(ws.iter_rows(min_row=3, max_col=12, values_only=True), 3):
    sales = [str(x).strip().lower() for x in r[:8] if x]
    if not sales or not isinstance(r[10], (int, float)): continue
    kt.append((sales, set(t.upper() for t in TOK.findall(str(r[8] or ''))), r[10], i))
orders = json.load(open(W + '/orders.json')); check = json.load(open(W + '/checktay.json'))
back, still = [], []
for o in orders:
    lt = o.get('loaiThuong')
    if lt not in ('khong-co-base', 'base-that-bai'): continue
    first = str(o.get('ghiChu') or '').split('\n')[0]
    toks = set(t.upper() for t in TOK.findall(first)); mine = [s.strip().lower() for s in str(o['saleBan']).split(',') if s.strip()]
    hit = [k for k in kt if (toks & k[1]) and all(s in k[0] for s in mine)]
    if not hit: continue
    if lt == 'khong-co-base' and not ('all' in ONLY or all(m in ONLY for m in mine)):
        still.append((o['saleBan'], o['maDon'], first[:40], o['giaTriDon'], hit[0][3], 'KT co tinh - CHUA tinh lai (chua duoc Duyen chot cho sale nay)')); continue
    if lt == 'khong-co-base':
        o['ktInclude'] = hit[0][3]; o.pop('loaiThuong', None); o['loaiThuong'] = None
        back.append((o['saleBan'], o['maDon'], first[:40], o['giaTriDon'], o.get('baseNgayTao'), hit[0][3]))
        for c in check:
            if c.get('loaiThuong') == 'khong-co-base' and str(c.get('ma')).strip() == first.strip(): c['loaiThuong'] = ''; c['lyDo'] = c['lyDo'] + ' → ĐÃ TÍNH LẠI vì file KT (dòng %d) vẫn tính đơn này' % hit[0][3]
    else: still.append((o['saleBan'], o['maDon'], first[:40], o['giaTriDon'], hit[0][3]))
json.dump(orders, open(W + '/orders.json', 'w'), ensure_ascii=False); json.dump(check, open(W + '/checktay.json', 'w'), ensure_ascii=False)
print('TINH LAI (KT van tinh, Pos co - Base khong co): %d don' % len(back))
for b in back: print('  +', b)
print('GIU LOAI (Base That bai, KT co dong): %d don - Duyen quyet' % len(still))
for s in still: print('  ?', s)

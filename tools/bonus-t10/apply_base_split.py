#!/usr/bin/env python3
"""Buoc A (che do CHIA THEO DON GOC BASE, Duyen 2026-11-04): doc file xuat 'Check nguoc Base' cua CRM -> base_split.json
(moi don Pos da ghep Base: gia tinh = Base + phan con lai theo The Pos, ty le chia tung sale, ngay tao Base, ma Base).
Dung: python3 apply_base_split.py <CheckNguocBase.xlsx> <thu_muc_work>      (calc_bonus.js / calc_commission.js doc base_split.json qua base_enrich.js)
Ten Base (ho ten) -> tai khoan: NAME_MAP (Duyen xac nhan 2026-11-04)."""
import sys, re, json, unicodedata, pandas as pd
src, W = sys.argv[1:3]
NAME_MAP = {'trịnh phương anh': 'anhtrinh1995', 'nguyễn huyền trang': 'trangNH2005', 'nguyễn thị hải yến': 'yenNTH2004', 'nguyễn thị bích': 'biichnguyen1993', 'nguyễn phương anh': 'anhNP1999',
            'nguyễn phương thanh': 'thanhNP', 'ninhltk': 'ninhLTK1984', 'dungnguyen1995': 'dungnguyen1995', 'thuydinh1995': 'thuydinh95'}
canon = lambda n: NAME_MAP.get(unicodedata.normalize('NFC', str(n)).strip().lower(), unicodedata.normalize('NFC', str(n)).strip())
norm = lambda s: re.sub(r'\s+', ' ', str(s)).strip()
c = pd.read_excel(src, sheet_name='Chia theo sale'); d = pd.read_excel(src, sheet_name='Check ngược từng đơn')
TIEN = [x for x in c.columns if x.startswith('Tiền chia')][0]
DT = [x for x in d.columns if x.startswith('Doanh thu tính')][0]
shares = {}
for _, r in c.iterrows(): shares.setdefault(r['STT đơn Pos'], {}); k = canon(r['Sale']); shares[r['STT đơn Pos']][k] = shares[r['STT đơn Pos']].get(k, 0) + float(r[TIEN])
recs = []
for stt, g in d.groupby('STT đơn Pos', sort=False):
    first = g[g['Giá Pos gốc (1 lần/đơn)'].notna()].iloc[0]; sh = shares.get(stt, {}); tot = sum(sh.values())
    codes = [str(x) for x in g['Mã Base'].dropna()]
    nd = [str(x) for x in g['Ngày tạo Base'].dropna()]
    recs.append({'stt': int(stt), 'ghiChu': norm(first['Ghi chú Pos']), 'giaPos': round(float(first['Giá Pos gốc (1 lần/đơn)'])),
                 'giaTriDon': float(first[DT]) if pd.notna(first[DT]) else tot, 'saleShares': [{'name': k, 'frac': v / tot} for k, v in sh.items() if v > 0] if tot > 0 else [],
                 'baseNgayTao': min(nd) if nd else '', 'codes': codes})
json.dump(recs, open(W + '/base_split.json', 'w'), ensure_ascii=False)
print(len(recs), 'don Pos da ghep Base; tong gia tinh', round(sum(r['giaTriDon'] for r in recs)))

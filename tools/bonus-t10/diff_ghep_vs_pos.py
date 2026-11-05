#!/usr/bin/env python3
"""Tung don ghep: CRM (chia theo don goc Base + phan con lai theo The Pos) vs KT (chia DEU theo The Pos).
Dung: python3 diff_ghep_vs_pos.py <BaoCao_Pos_CheckNguocBase.xlsx> <DOI_SOAT_KT.xlsx> <ra.xlsx>
The Pos co the chua tag KHONG phai sale (Chua doi soat, Giao khong thanh, Dang giao hang...) -> KT da bo; chi giu ten nam trong danh sach sale cua sheet 1_Theo sale cua file KT.
Ten Base (ho ten) -> tai khoan: bang NAME_MAP ben duoi la SUY DOAN theo ten, Duyen/KT xac nhan; ten chua map giu nguyen."""
import sys, unicodedata, pandas as pd
src, ktf, out = sys.argv[1:4]
UNIV = {str(x).strip().lower() for x in pd.read_excel(ktf, sheet_name='1_Theo sale (final)', header=2).iloc[:, 1].dropna()} - {'tổng'}
UNIV |= {v.lower() for v in ['anhtrinh1995','trangNH2005','yenNTH2004','biichnguyen1993','anhNP1999','thanhNP','ninhLTK1984','dungnguyen1995','thuydinh95']}
NAME_MAP = {'trịnh phương anh': 'anhtrinh1995', 'nguyễn huyền trang': 'trangNH2005', 'nguyễn thị hải yến': 'yenNTH2004', 'nguyễn thị bích': 'biichnguyen1993', 'nguyễn phương anh': 'anhNP1999',
            'nguyễn phương thanh': 'thanhNP', 'ninhltk': 'ninhLTK1984', 'dungnguyen1995': 'dungnguyen1995', 'thuydinh1995': 'thuydinh95'}
def canon(n):
    n = unicodedata.normalize('NFC', str(n)).strip(); return NAME_MAP.get(n.lower(), n)   # NFC: ten co dau trong file xuat co the o dang to hop (NFD)
c = pd.read_excel(src, sheet_name='Chia theo sale'); d = pd.read_excel(src, sheet_name='Check ngược từng đơn')
TIEN = [x for x in c.columns if x.startswith('Tiền chia')][0]
d1 = d[d['Giá Pos gốc (1 lần/đơn)'].notna()].copy()
crm = {}
for _, r in c.iterrows(): crm.setdefault(r['STT đơn Pos'], {}); k = canon(r['Sale']); crm[r['STT đơn Pos']][k] = crm[r['STT đơn Pos']].get(k, 0) + float(r[TIEN])
rows = []
for _, r in d1.iterrows():
    stt = r['STT đơn Pos']; gia = float(r['Giá Pos gốc (1 lần/đơn)'])
    names = [canon(x) for x in str(r['Thẻ Pos (nguyên văn)']).split(',') if x.strip() and canon(x).lower() in UNIV]
    if not names: continue
    kt = {}
    for n in names: kt[n] = kt.get(n, 0) + gia / len(names)
    cr = crm.get(stt, {})
    for n in set(kt) | set(cr):
        dif = cr.get(n, 0) - kt.get(n, 0)
        if abs(dif) > 1:
            gl = float(r['Chênh Base − Pos (1 lần/đơn)'] or 0)
            rows.append({'STT': stt, 'Ngày Pos': r['Ngày Pos'], 'Mã Base': r['Mã Base'], 'Sale': n, 'KT: chia đều Thẻ Pos': round(kt.get(n, 0)), 'CRM: theo đơn gốc Base': round(cr.get(n, 0)), 'CRM − KT': round(dif),
                         'Thẻ Pos': r['Thẻ Pos (nguyên văn)'], 'Sale bán (Base)': r['Sale bán (Base)'], 'Giá Pos': gia, 'Giá Base': r['Giá trị đơn gốc Base'], 'Nguyên nhân': ('Giá Base ≠ Pos' if abs(gl) > 1 else '') + (' + ' if abs(gl) > 1 else '') + 'Người chia khác Thẻ Pos'})
df = pd.DataFrame(rows)
df['Nguyên nhân'] = df['Nguyên nhân'].str.replace(r'^ \+ ', '', regex=True)
tot = df.groupby('Sale')[['KT: chia đều Thẻ Pos', 'CRM: theo đơn gốc Base', 'CRM − KT']].sum().sort_values('CRM − KT', key=abs, ascending=False).reset_index()
with pd.ExcelWriter(out) as w:
    tot.to_excel(w, sheet_name='Tong_lech_theo_sale', index=False); df.sort_values('CRM − KT', key=abs, ascending=False).to_excel(w, sheet_name='Lech_tung_don', index=False)
print(len(df), 'dong lech;', len(tot), 'sale'); print(tot.to_string())

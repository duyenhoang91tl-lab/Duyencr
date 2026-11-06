#!/usr/bin/env python3
"""Doi chieu doanh thu T10 tung sale: so KT (sheet 'So Ke toan chot' / Sheet1, file C DUYEN-luong sale) vs Bao cao B 'Theo Sale' cua CRM.
Dung: python3 recon_b_vs_kt_oct.py <file_KT.xlsx> [crm_screen.json] [ra.csv]
  crm_screen.json = {"ten sale (khong phan biet hoa/thuong)": so_CRM_hien_thi, ...}; neu CRM tach ten bi biet (Thuydinh1995 + thuydinh95) thi cong chung 1 ten.
NHOM DONG KT can soat (KHONG phai ket luan nguyen nhan; ket luan can file doi soat xuat tu CRM ky 01-31/10):
  NO-NOTE  : 6 dong KT go TAY cuoi so (khong ghi chu/ma) = cach chia tay cua KT (17T10, 268T10, 416T10, 525T10, M45869 + 42.950.000 Zalo CSKH cua phuongthao2000). CRM chi nhan neu bang acctSplitExtra duoc dien.
  T09      : don ma thang 9 nhung ngay tao Pos thang 10 (da kiem: co tren sheet pos) -> CRM theo ngay thi CO tinh; KHONG coi la loi.
  FB-plain : dong nguon 'Facebook' tron, ghi chu la so thu COD (343, 342...) - chua biet CRM co hay khong.
  M        : 24 dong don quay 30% (CRM dua vao qua Bao cao L).
So KT chia deu theo the A:G (giong cot R:S 'TONG' cua KT)."""
import sys, re, json, csv, collections, warnings
warnings.filterwarnings('ignore')
import openpyxl

def classify(note, src):
    note = str(note or ''); src = str(src or '').strip()
    if not note: return 'NO-NOTE'
    if re.match(r'\s*M\d+', note): return 'M'
    if re.search(r'T09', note.split('+')[0]): return 'T09'
    if src == 'Facebook' and not re.search(r'T\d\d', note): return 'FB-plain'
    return 'T10'

def load(path):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb['Số Kế toán chốt'] if 'Số Kế toán chốt' in wb.sheetnames else wb.worksheets[0]
    per = collections.defaultdict(lambda: collections.defaultdict(float)); tot = collections.defaultdict(float); cnt = collections.Counter()
    for r in ws.iter_rows(min_row=3, values_only=True):
        v = r[10] if len(r) > 10 else None
        if not isinstance(v, (int, float)) or not v: continue
        c = classify(r[8], r[9]); tags = [str(x).strip().lower() for x in r[0:7] if x not in (None, '')]
        if not tags: continue
        tot[c] += v; cnt[c] += 1
        for t in tags: per[t][c] += v / len(tags)
    return per, tot, cnt

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    per, tot, cnt = load(sys.argv[1])
    print('KT theo nhom dong:'); [print(f'  {c:9s} {cnt[c]:5d} dong  {tot[c]:>15,.0f}') for c in ('T10', 'T09', 'FB-plain', 'NO-NOTE', 'M')]
    print(f'  TONG KT   {sum(cnt.values()):5d} dong  {sum(tot.values()):>15,.0f}')
    crm = {k.lower(): v for k, v in json.load(open(sys.argv[2], encoding='utf-8')).items()} if len(sys.argv) > 2 else {}
    rows = []
    for k, v in crm.items():
        p = per.get(k, {}); kt = sum(p.values())
        rows.append([k, v, kt, v - kt, p.get('T09', 0), p.get('FB-plain', 0), p.get('NO-NOTE', 0), p.get('M', 0)])
    if rows:
        hdr = ['sale', 'CRM', 'KT', 'CRM-KT', 'KT:T09', 'KT:FB-plain', 'KT:NO-NOTE', 'KT:M(quay)']
        print('\n' + ' | '.join(hdr)); [print(' | '.join([r[0]] + [f'{x:,.0f}' for x in r[1:]])) for r in rows]
        print(f'TONG CRM {sum(r[1] for r in rows):,.0f} | KT cung 18 sale {sum(r[2] for r in rows):,.0f} | KT tat ca sale {sum(tot.values()):,.0f}')
        if len(sys.argv) > 3:
            with open(sys.argv[3], 'w', newline='', encoding='utf-8-sig') as f: w = csv.writer(f); w.writerow(hdr); w.writerows(rows)

#!/usr/bin/env python3
"""Doi chieu bang thuong CHINH THUC (CSV 'Thuong online', xuat tu Google Sheet) voi bonus-result.json (calc_bonus.js) theo tung don / tung sale.
Dung: python3 diff_official_vs_crm.py <Thuong_online.csv> <work_dir> [thang=10]
In: tong theo sale (CT chinh thuc vs CRM) + tung don lech (ma don, sale, chinh thuc, CRM). Chi so thuong THANG nay (cot 'Thang thuong'). KHONG commit CSV (co SDT)."""
import sys, csv, json, re, unicodedata
from collections import defaultdict
csvf, W = sys.argv[1], sys.argv[2]; MONTH = sys.argv[3] if len(sys.argv) > 3 else '10'
fold = lambda s: re.sub(r'\s+', ' ', unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower().replace('đ', 'd')).strip()
# chi tiet ten -> tai khoan (SUY DOAN theo ten, giong NAME_MAP cua diff_ghep_vs_pos.py)
NM = {'thuy': 'thuydinh95', 'thu thuy': 'thuydinh95', 'nga': 'ninhnga99', 'huyen': 'huyenmaii1990', 'mai huyen': 'huyenmaii1990', 'bich': 'biichnguyen1993', 'phuong thao': 'phuongthao2000',
      'thuy ha': 'thuyha88', 'phuong anh trinh': 'anhtrinh1995', 'hai yen': 'yenNTH2004', 'yen': 'yenNTH2004', 'dung': 'dungnguyen1995', 'minh quach': 'minhquach1995',
      'ninhltk': 'ninhLTK1984', 'ninh 1984': 'ninhLTK1984', 'men': 'menbui2002', 'trang': 'trangNH2005', 'ngoc': 'ngocNB2003saleoff', 'ngoc nb': 'ngocNB2003saleoff'}
RATE = {'10tr': 20000, '15tr': 30000, '20tr': 40000, 'v15tr': 20000, 'v20tr': 30000, '60tr': 50000, '100tr': 100000, 't21': 100000, 't31': 200000, 'thmoon': 10000, 'tht': 8000, 'tha': 8000}
def num(s):
    s = re.sub(r'[^\d]', '', str(s or '')); return int(s) if s else 0
def toks(s): return {m.upper() for m in re.findall(r'(?<![A-Za-z0-9])((?:NG)?\d{1,5}T\d{1,2})(?:/\d{2,4})?', str(s or ''), re.I)}
rows = list(csv.reader(open(csvf, encoding='utf8')))
off = []   # moi dong chinh thuc: (sale tai khoan, ngay, loai, tien, tokens)
for r in rows[2:]:
    if len(r) < 8 or not str(r[1]).strip().isdigit() or str(r[4]).strip() != MONTH: continue
    names = [NM.get(fold(x)) for x in re.split(r'[,+&]| va ', r[2]) if fold(x)]
    names = [n for n in names if n] or [None]
    loai = fold(r[5]).replace(' ', ''); amt = num(r[6]) or RATE.get(loai, 0)
    for n in names: off.append({'sale': n, 'ngay': r[3].strip(), 'loai': r[5].strip(), 'tien': amt / len(names), 'tok': toks(r[7]), 'raw': r[7].strip(), 'stt': r[1]})
res = json.load(open(W + '/bonus-result.json')); crm = defaultdict(list)
for s in res['bySale']:
    for it in s['items']: crm[s['name']].append(dict(it, tok=toks(it.get('maDonPos', '')), sale=s['name']))
tot_o = defaultdict(float); [tot_o.__setitem__(o['sale'], tot_o[o['sale']] + o['tien']) for o in off]
print('SALE'.ljust(22), 'CHINH_THUC'.rjust(11), 'CRM'.rjust(10), 'LECH'.rjust(10))
for n in sorted(set(tot_o) | {s['name'] for s in res['bySale']}, key=lambda x: str(x)):
    c = sum(i['amount'] for i in crm.get(n, [])); o = tot_o.get(n, 0)
    if abs(c - o) > 1 or True: print(str(n).ljust(22), f'{o:11,.0f}', f'{c:10,.0f}', f'{c - o:10,.0f}')
print('\n== TUNG DON LECH (don-theo-ma; thuong theo ngay doi chieu theo sale+ngay) ==')
used = set()
for o in sorted(off, key=lambda x: (str(x['sale']), x['stt'])):
    if not o['sale']: print('?? chua map ten:', o['raw'], o['tien']); continue
    if o['tok']:
        m = [i for i in crm.get(o['sale'], []) if i['tok'] & o['tok'] and id(i) not in used]
        c = sum(i['amount'] for i in m); [used.add(id(i)) for i in m]
        if abs(c - o['tien']) > 1: print(f"{o['sale']:18} STT{o['stt']:>4} {o['raw'][:28]:28} {o['loai']:8} chinh thuc {o['tien']:8,.0f} | CRM {c:8,.0f}  {'; '.join(i['program'][:30] for i in m)}")
    else:
        d = o['ngay']; m = [i for i in crm.get(o['sale'], []) if i['scope'].startswith('Theo ngày') and str(i['date'])[-2:].lstrip('0') == d.lstrip('0') and id(i) not in used and abs(i['amount'] - o['tien']) < 1]
        if m: used.add(id(m[0]))
        else: print(f"{o['sale']:18} STT{o['stt']:>4} ngay {d:>3} {o['loai']:8} chinh thuc {o['tien']:8,.0f} | CRM khong co (thuong ngay)")
print('\n== CRM CO NHUNG CHINH THUC KHONG CO (theo don/sp) ==')
for n, its in sorted(crm.items(), key=lambda x: x[0]):
    for i in its:
        if id(i) in used or i['scope'].startswith('Theo ngày'): continue
        if any(o['sale'] == n and o['tok'] & i['tok'] for o in off): continue
        print(f"{n:18} {i['date']} {i['program'][:38]:38} {i['amount']:7,.0f}  {i.get('maDonPos','').replace(chr(10),' ')[:50]}")

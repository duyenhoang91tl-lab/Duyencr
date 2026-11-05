#!/usr/bin/env python3
"""KIEM DOC LAP file thuong T10 da xuat (KHONG dung calc_bonus.js) theo 2 bang CT Duyen gui (thu viec / online-chinh thuc).
Dung: python3 audit_bonus_file.py <file_thuong.xlsx> <work>      (work = thu muc co orders.json da qua add_base_date.py)
Kiem: (1) tong sheet 2 = tong sheet 4; (2) bac COMBO 10/15/20tr dung (SP + gia tri) va 'chia deu k sale'; (3) Bill vong mix charm 15/20tr;
(4) thuong SAN PHAM Ty huu Moon/Tour/Aqua = SL x muc / so sale, KHONG dinh chat lieu loai tru; (5) thuong DOANH SO NGAY 60/100tr (chinh thuc) va
25/50/80tr + so don/ngay + don dau (thu viec) tinh lai tu orders.json theo ngay Base; (6) dong trung (cung don, cung CT)."""
import sys, re, json, collections, datetime, warnings, openpyxl
warnings.filterwarnings('ignore')
XL, W = sys.argv[1:3]
wb = openpyxl.load_workbook(XL, data_only=True)
tot = {r[0]: r[-1] for r in wb['2_Tổng thưởng sale'].iter_rows(min_row=2, values_only=True) if r[0] and r[0] != 'TỔNG'}
kenh = {r[0]: r[1] for r in wb['2_Tổng thưởng sale'].iter_rows(min_row=2, values_only=True) if r[0] and r[0] != 'TỔNG'}
det = [r for r in wb['4_Chi tiết thưởng'].iter_rows(min_row=2, values_only=True) if r[0]]
bad = []
def flag(k, r, msg): bad.append((k, r[1], r[0], r[4], r[5], msg))
# (1) tong
for s, t in tot.items():
    x = sum(r[5] for r in det if r[1] == s)
    if abs(x - t) > 1: bad.append(('TONG', s, '', '', t, 'tong sheet2 %s != tong chi tiet %s' % (t, x)))
# (2)(3) combo + vong mix
COMBO = [(4, 20e6, 40000), (3, 15e6, 30000), (2, 10e6, 20000)]
for r in det:
    c = str(r[6]); k = int(re.search(r'chia đều (\d+) sale', c).group(1)) if re.search(r'chia đều (\d+) sale', c) else 1
    m = re.match(r'Giá trị đơn (\d+) — (\d+) sản phẩm', c)
    if r[4].startswith('Đơn từ') and m:
        v, n = float(m.group(1)), int(m.group(2)); tier = next(((nn, th, a) for nn, th, a in COMBO if n >= nn and v >= th), None); exp = tier[2] if tier else 0
        if tier and v == tier[1]: flag('BIEN', r, 'gia tri DUNG BANG moc %d: bang ghi "don TREN 10tr/15tr/20tr" (>) nhung engine/KT tinh >= -> Duyen chot' % v)
        if kenh.get(r[1]) != 'probation' and abs(exp / k - r[5]) > 1: flag('COMBO', r, 'gia tri %d, %d SP -> ky vong %d /%d sale = %d, file ghi %d' % (v, n, exp, k, exp / k, r[5]))
        if kenh.get(r[1]) == 'probation': flag('COMBO', r, 'sale THU VIEC khong co CT combo (bang thu viec khong co)')
    m = re.match(r'Phần vòng \+ charm mix (\d+)', c)
    if r[4].startswith('Bill vòng') and m:
        v = float(m.group(1)); exp = 30000 if v >= 20e6 else 20000 if v >= 15e6 else 0
        if abs(exp / k - r[5]) > 1: flag('VONG', r, 'mix %d -> ky vong %d/%d, file ghi %d' % (v, exp, k, r[5]))
# (4) Ty huu
EX = re.compile(r'LAM|BÍCH|BICH|CẨM THẠCH|CAM THACH|RUBY|SAPH|SAPP', re.I)
KW = {'Moon': ('MOON', 10000), 'Tourmaline': ('TOUR', 8000), 'Aquamarine': ('AQUA', 8000)}
for r in det:
    if r[3] != 'Theo sản phẩm': continue
    key = next((v for n, v in KW.items() if n in r[4]), None)
    if not key: continue
    k = int(re.search(r'chia đều (\d+) sale', str(r[6])).group(1)) if re.search(r'chia đều (\d+) sale', str(r[6])) else 1
    qty = 0
    for it in re.split(r' \|\| |; ', str(r[8] or '')):
        mm = re.match(r'(.*?)(?: x(\d+))?$', it.strip()); name = mm.group(1).upper(); q = int(mm.group(2) or 1)
        if 'TỲ HƯU THIÊN LỘC' in name and key[0] in name and not EX.search(name.replace('TỲ HƯU THIÊN LỘC', '')): qty += q
    if qty == 0: flag('TYHUU', r, 'khong tim thay SP Ty huu %s hop le tren don (chat lieu loai tru hoac khong khop)' % key[0])
    elif abs(qty * key[1] / k - r[5]) > 1: flag('TYHUU', r, 'SL %d x %d / %d sale = %d, file ghi %d' % (qty, key[1], k, qty * key[1] / k, r[5]))
# (5) doanh so ngay + thu viec tu orders.json
orders = json.load(open(W + '/orders.json')); START = {'ngocNB2003saleoff': '2026-10-14', 'haPTN': '2026-10-10', 'thanhNP': '2026-10-10'}
day = collections.defaultdict(float); cnt = collections.defaultdict(int)
for o in orders:
    if o.get('loaiThuong'): continue
    ss = [s.strip() for s in str(o['saleBan']).split(',') if s.strip()]
    for s in ss: day[(s, o['baseNgayTao'])] += o['giaTriDon'] / len(ss); cnt[(s, o['baseNgayTao'])] += 1
have = collections.defaultdict(int)
for r in det:
    if r[3].startswith('Theo ngày') and 'doanh số' in r[4].lower(): have[(r[1], str(r[0]), 'rev')] += r[5]
exp = collections.defaultdict(int)
for (s, d), v in day.items():
    if s in START:
        n = (datetime.date.fromisoformat(d) - datetime.date.fromisoformat(START[s])).days + 1
        if n >= 4: exp[(s, d, 'rev')] = 100000 if v >= 80e6 else 50000 if v >= 50e6 else 30000 if v >= 25e6 else 0
    elif s in tot: exp[(s, d, 'rev')] = 100000 if v >= 100e6 else 50000 if v >= 60e6 else 0
for key in sorted(set(exp) | set(have)):
    # menbui2002 (CSKH) chi tinh don Facebook Pham Thu Hien -> doanh so ngay khong kiem duoc tu tong don
    if exp.get(key, 0) != have.get(key, 0) and key[0] in tot and key[0] != 'menbui2002':
        bad.append(('NGAY', key[0], key[1], 'doanh so ngay', have.get(key, 0), 'ky vong %d (tong ngay %.2f tr)' % (exp.get(key, 0), day.get((key[0], key[1]), 0) / 1e6)))
# (6) trung
seen = collections.Counter((r[1], r[4], str(r[7])[:30], r[0]) for r in det if r[3] != 'Theo ngày (doanh số)' and r[7])
for k, n in seen.items():
    if n > 1 and 'Tỳ Hưu' not in k[1]: bad.append(('TRUNG', k[0], k[3], k[1], '', 'cung CT + cung don xuat hien %d lan: %s' % (n, k[2])))
print('KIEM %s: %d dong chi tiet, %d sale' % (XL.split('/')[-1], len(det), len(tot)))
cnt_by = collections.Counter(b[0] for b in bad)
print('LOI/NGHI VAN:', dict(cnt_by) if bad else 'KHONG')
for b in bad: print(' -', b)

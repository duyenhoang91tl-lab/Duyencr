#!/usr/bin/env python3
"""Doi chieu bang thuong SALE TU NHAP (PDF Thuong_online/offline) voi Pos + Base + ket qua calc_bonus.js.
Dung: python3 check_sale_entries.py <Check_DT.xlsx> <thu_muc_work> <entries.csv> <ra.json>     (chay SAU calc_bonus.js)
entries.csv: ma_don,muc(10|15|20|V15|V20|T21|T31),ngay(so hoac trong),ten_sale_ghi_tren_bang   (KHONG commit: co thuong tung nguoi)
Quy tac Duyen 2026-11-04: don sale nhap + chuan ngay len Base + co tren Pos + Base KHONG Huy/That bai -> tinh (engine da lam dung); don Base That bai/khong co Pos -> khong tinh.
Phan loai: KHOP | LECH muc (engine khac muc sale nhap) | ENGINE=0 (co ly do) | LOAI (Base that bai/khong co Base) | KHONG CO POS | CHECK: lech ngay Base."""
import sys, json, re, csv, collections, openpyxl, warnings
warnings.filterwarnings('ignore')
X, W, CSV, OUT = sys.argv[1:5]
T = {'10': 20000, '15': 30000, '20': 40000, 'V15': 20000, 'V20': 30000, 'T21': 100000, 'T31': 200000}
orders = json.load(open(W + '/orders.json')); res = json.load(open(W + '/bonus-result.json'))
base = {}
for r in openpyxl.load_workbook(X, read_only=True, data_only=True)['Base'].iter_rows(min_row=2, values_only=True):
    if r[20] and r[0]: base.setdefault(str(r[20]).strip().upper(), (str(r[0])[:10], str(r[7] or '')))
TOK = re.compile(r'(NG|BH)?(\d{1,5})T(\d{1,2})')
def keys(s): return [(m.group(1) or '') + m.group(2) + 'T' + m.group(3) for m in TOK.finditer(str(s).upper())]
pos = collections.defaultdict(list)
for o in orders:
    for k in keys(str(o['ghiChu']).split('\n')[0]): pos[k].append(o)
paid = collections.defaultdict(list)
for s in res['bySale']:
    for i in s['items']:
        if i.get('scope') == 'Theo đơn':
            for k in set(keys(i.get('maDonPos') or '')): paid[k].append((s['name'], i['amount'], i['detail']))
out = []
for row in csv.reader(open(CSV, encoding='utf8')):
    c, t, d, n = row[:4]; amt = T[t]; k = c.upper(); p = pos.get(k, []); b = base.get(k + '/2026'); pd_ = paid.get(k, []); tot = sum(a for _, a, _ in pd_)
    lt = sorted({o.get('loaiThuong') for o in p if o.get('loaiThuong')}); bd = b[0] if b else (p[0].get('baseNgayTao') if p else '')
    sp = ' | '.join(o['sanPham'][:60] for o in p)[:140]; why = ''
    if not p: cls = 'KHÔNG CÓ TRÊN POS'; why = 'Không tìm thấy mã đơn trên Pos → không tính'
    elif lt: cls = 'LOẠI'; why = 'Base Thất bại/Hủy → không tính' if lt[0] == 'base-that-bai' else 'Không có trên Base → không tính'
    elif tot == amt: cls = 'KHỚP'
    elif tot == 0:
        cls = 'ENGINE = 0'; gv = max(o['giaTriDon'] for o in p)
        why = 'Bill vòng/chuỗi mix charm dưới 15tr (không đạt V15)' if re.search(r'HẠT|CHARM', sp.upper()) and gv < 15e6 else 'Pos chỉ có 1 sản phẩm chính (quà hộp/lá bồ đề/phí kiểm định không tính SP) → chưa đạt combo 2 SP'
    else:
        cls = 'LỆCH MỨC'; why = ('Đơn chia %d sale: engine chia đều mức thưởng' % len(pd_)) if len(pd_) > 1 else 'Engine đếm số SP/giá trị theo Pos: ' + pd_[0][2][:80]
    dl = ''
    if d and bd[:7] == '2026-10' and int(bd[8:10]) != int(d): dl = 'Sale ghi ngày %s, Base lên ngày %s' % (d, bd[8:10])
    out.append({'ma': c, 'sale_ghi': n, 'muc': t, 'tien_sale': amt, 'ngay_sale': d, 'ngay_base': bd, 'tt_base': b[1] if b else '-', 'ket_luan': cls, 'tien_engine': tot,
                'engine_chi_cho': ', '.join('%s %d' % (s, a) for s, a, _ in pd_), 'ly_do': why, 'lech_ngay': dl, 'pos': '; '.join('%s %.2ftr %s' % (o['saleBan'], o['giaTriDon'] / 1e6, o['trangThai']) for o in p)})
json.dump(out, open(OUT, 'w'), ensure_ascii=False)
print(collections.Counter(o['ket_luan'] for o in out), 'lech ngay:', sum(1 for o in out if o['lech_ngay']))

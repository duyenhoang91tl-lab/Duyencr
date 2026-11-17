#!/usr/bin/env python3
# Dung: python3 tools/bonus-t10/build_acct_extra.py <file_KT_co_sheet_HUYEN.xlsx> <ra.txt>
# Sinh 2 khoi JSON dan vao CRM de Bao cao B (Pos) khop ke toan (sheet HUYEN), theo quyet dinh cua Duyen 2026-11-05:
#  (1) acctSplitExtra  -> Cai dat team > "Chia don theo KT (bo sung)"  : 17T10, 268T10 (chia tay), 1162T10 (COD) — gia tri/chia theo KT
#  (2) orderSaleOverride -> Cai dat team > "Ep sale theo don" > "Dan JSON": cac don BAO HANH KT them/doi the (vd lanVH1995). Gia tri bao hanh KHONG dua vao
#      day vi CRM da co _bhPrepaidDeduct_ (Pos - tien tra truoc) = KT o 162/169 don. BH386T10/2026 giu theo Pos; don quay (M44707...) di qua Bao cao L.
# Tu kiem tung don: sau ep the, (Pos - tra truoc) chia deu theo the == dong KT trong HUYEN.
import sys, json, re, collections, unicodedata, openpyxl
src, out = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True)
H = []
for r in wb['HUYỀN'].iter_rows(min_row=3, values_only=True):
    cards = [str(c).strip() for c in r[0:7] if c not in (None, '')]
    if cards or r[10] is not None: H.append({'cards': cards, 'note': r[8], 'val': r[10] or 0})
nf = lambda s: ''.join(c for c in unicodedata.normalize('NFD', str(s or '').lower()) if unicodedata.category(c) != 'Mn').replace('đ', 'd').strip()
key = lambda s: (lambda m: m.group(1) if m else None)(re.search(r'((?:NG|BH)?\d+T\d+/20\d\d(?:/\d+)?)', str(s or '').upper().replace('\n', ' ')))
def code1(s):   # ma bo dem dau tien trong ghi chu (giong _extractCounterCodes_)
    m = re.search(r'(?<![A-Za-z0-9])([A-Za-z]{0,3}\d{1,6}[A-Za-z]{0,3}T\d{1,2}(?:/\d{2,4})?)(?![A-Za-z0-9])', str(s or '')); return m.group(1).upper() if m else None
kk = collections.defaultdict(list)
for x in H: kk[key(x['note'])].append(x)
EXTRA = [  # Duyen chot: 17T10 theo KT (xac nhan truoc do); 268T10 = 10.780.000 chia deu Ninh+Nga + 4.180.000 cua Nga; 1162T10 COD theo KT
 {'code': '17T10/2026', 'sales': ['ninhnga99', 'huyenmaii1990'], 'tong': 6700000}, {'code': '17T10/2026', 'sales': ['ninhnga99'], 'tong': 10708000},
 {'code': '268T10/2026', 'sales': ['ninhLTK1984', 'ninhnga99'], 'tong': 10780000}, {'code': '268T10/2026', 'sales': ['ninhnga99'], 'tong': 4180000},
 {'code': '1162T10/2026', 'sales': ['thuyha88'], 'tong': 5664000}]
SKIP = ('BH386',)   # Duyen: BH386T10/2026/6190 tinh theo Pos
ovr, eq, ne = {}, 0, []
for r in wb['ĐƠN PT'].iter_rows(min_row=2, values_only=True):
    if not r[9] or nf(r[27]) != 'bao hanh': continue
    k, c = key(r[26]), code1(r[26])
    if not c or k not in kk or len(kk[k]) != 1 or any(s in k for s in SKIP): continue
    pos = [t.strip() for t in str(r[1] or '').split(',') if t.strip()]; kt = kk[k][0]['cards']
    if sorted(n.lower() for n in pos) == sorted(n.lower() for n in kt): continue
    ovr[c] = ', '.join(kt)
    val = r[23] or 0; pre = r[25] or 0; v = val - (min(pre, max(0, val)) if pre > 0 else 0)
    crm = {n.lower(): v / len(kt) for n in kt}; ktv = {n.lower(): kk[k][0]['val'] / len(kt) for n in kt}
    if all(abs(crm.get(n, 0) - ktv.get(n, 0)) <= 1 for n in set(crm) | set(ktv)): eq += 1
    else: ne.append(k)
txt = ('=== KHOI 1: dan vao "Chia don theo KT (bo sung)" (Cai dat team) — thay toan bo noi dung o JSON ===\n'
       + '[\n' + ',\n'.join('  ' + json.dumps(e, ensure_ascii=False) for e in EXTRA) + '\n]\n\n'
       + '=== KHOI 2: dan vao "Ep sale theo don" > bam "Dan JSON" > "Gop vao danh sach" > Luu (cac don BAO HANH KT them the, vd lanVH1995) ===\n'
       + json.dumps(ovr, ensure_ascii=False, indent=1) + '\n')
open(out, 'w', encoding='utf8').write(txt)
print('acctSplitExtra', len(EXTRA), 'dong | orderSaleOverride', len(ovr), 'don BH | chia dung KT:', eq, '| con khac:', ne)

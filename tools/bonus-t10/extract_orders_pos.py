#!/usr/bin/env python3
"""Buoc 1 (cho file dang Check_DT_t10.xlsx: sheet `pos` + `Base` + `1_Theo sale (final)`, KHONG co sheet 'DON PT'):
doc sheet `pos` -> orders.json + channels.json cho calc_bonus.js. Doc XML tho (KHONG qua openpyxl) vi cot gia tri/so luong cua sheet pos co dinh dang NGAY
lam openpyxl doc ra '#VALUE!'.
Dung: python3 extract_orders_pos.py <Check_DT.xlsx> <thu_muc_ra>      (KHONG commit orders.json — co SDT/dia chi khach)
Quy tac: bo tag khong phai sale (Chua doi soat, Giao khong thanh, Dang giao hang, Da hoan hang, Cho chuyen hoan, Doanh thu cu, Hoan mot phan, Dieu Tam DMP);
dong khong con sale nao bi bo; ngay = ngay tao don Pos (DD/MM/YYYY); them 'sdt' de calc_bonus.js gop dung don GHEP cung khach; ap order_overrides.json."""
import sys, re, json, zipfile, datetime, os
from lxml import etree
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def col2n(c):
    n = 0
    for ch in c: n = n * 26 + ord(ch) - 64
    return n - 1
def read_raw(path):
    z = zipfile.ZipFile(path); ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in etree.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS): ss.append(''.join(si.itertext()))
    wbx = etree.fromstring(z.read('xl/workbook.xml')); rels = {r.get('Id'): r.get('Target') for r in etree.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    out = {}
    for s in wbx.find('m:sheets', NS):
        tgt = rels[s.get('{%s}id' % NS['r'])].lstrip('/'); tgt = tgt if tgt.startswith('xl/') else 'xl/' + tgt
        rows = []
        for row in etree.fromstring(z.read(tgt)).find('m:sheetData', NS):
            r = {}
            for c in row:
                ci = col2n(re.match(r'[A-Z]+', c.get('r')).group()); ty = c.get('t'); v = c.find('m:v', NS)
                if ty == 'inlineStr': r[ci] = ''.join(c.find('m:is', NS).itertext())
                elif v is None: continue
                elif ty == 's': r[ci] = ss[int(v.text)]
                elif ty in ('str', 'e'): r[ci] = v.text
                elif ty == 'b': r[ci] = bool(int(v.text))
                else: r[ci] = float(v.text)
            rows.append((int(row.get('r')), r))
        out[s.get('name')] = rows
    return out
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
d = read_raw(src)
NON = {'chưa đối soát', 'giao không thành', 'đang giao hàng', 'đã hoàn hàng', 'chờ chuyển hoàn', 'doanh thu cũ', 'hoàn một phần', 'diệu tâm dmp'}
OV = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'order_overrides.json'), encoding='utf8')).items() if not k.startswith('_')}
xd = lambda n: datetime.datetime(1899, 12, 30) + datetime.timedelta(days=n)
orders = []
for rn, r in d['pos']:
    if rn == 1: continue   # tieu de: STT, Ngay tao don, The, Khach hang, SDT, Dia chi, Tinh, Nguon don, San pham, Ma SP, SL, Gia tri sau giam, COD, Marketer, Trang thai, Danh muc, Ghi chu noi bo, Ma bo dem(=Ma don Pos Mxxxxx), Tien tra truoc
    toks = [t.strip() for t in str(r.get(2) or '').split(',') if t.strip()]
    sales = [t for t in toks if t.lower() not in NON]
    v = r.get(11)
    if not sales or r.get(1) is None or not isinstance(v, (int, float)): continue
    nguon = str(r.get(7) or ''); qty = r.get(10); ph = r.get(4)
    o = {'id': 'PT%d' % rn, 'sheet': 'ĐƠN PT', 'maDon': str(r.get(17)), 'saleBan': ', '.join(sales), 'nguonDon': nguon,
         'maSanPham': str(r.get(9) or ''), 'sanPham': str(r.get(8) or ''), 'soLuong': qty if isinstance(qty, str) else '', 'giaTriDon': float(v),
         'ngayTao': xd(r[1]).strftime('%d/%m/%Y'), 'ghiChu': str(r.get(16) or ''), 'trangThai': str(r.get(14) or ''), 'giaTriTruocGiam': 0,
         'baoHanh': nguon.strip().lower() == 'bảo hành', 'sdt': str(int(ph)) if isinstance(ph, float) else str(ph or '')}
    if o['maDon'] in OV and 'split' in OV[o['maDon']]:   # TACH 1 don Pos thanh nhieu don theo tung nguoi (gia tri rieng; 'giaTri' bo trong = phan con lai cua Pos) - Duyen chot 2026-11-04 cho M45869
        rest = o['giaTriDon'] - sum(p.get('giaTri') or 0 for p in OV[o['maDon']]['split'])
        for k, p in enumerate(OV[o['maDon']]['split']):
            q = dict(o); q['id'] = o['id'] + 's%d' % k; q['saleBanGoc'] = o['saleBan']; q['saleBan'] = p['saleBan']; q['giaTriDon'] = float(p.get('giaTri') or rest); q['ghiChu'] = p['ghiChu']; orders.append(q)
        continue
    if o['maDon'] in OV and 'saleBan' in OV[o['maDon']]: o['saleBanGoc'] = o['saleBan']; o['saleBan'] = OV[o['maDon']]['saleBan']
    if o['maDon'] in OV and OV[o['maDon']].get('giaTriTruocGiam'): o['giaTriTruocGiam'] = float(OV[o['maDon']]['giaTriTruocGiam'])   # gia NIEM YET (file Check_DT khong co cot nay) -> CT Tourmaline cao cap T21/T31 xet theo gia nay
    orders.append(o)
ch = {}
for rn, r in d.get('1_Theo sale (final)', []):
    if r.get(0) in ('On', 'Off') and isinstance(r.get(1), str): ch[r[1]] = 'online' if r[0] == 'On' else 'offline'
json.dump(orders, open(out + '/orders.json', 'w'), ensure_ascii=False); json.dump(ch, open(out + '/channels.json', 'w'), ensure_ascii=False, indent=1)
print(len(orders), 'don;', len(ch), 'sale co kenh. Luu y: giaTriTruocGiam=0 (file nay khong co gia niem yet) -> CT Tourmaline cao cap T21/T31 xet theo gia sau giam.')

#!/usr/bin/env python3
"""build_final_sale.py — dựng file ĐỐI SOÁT T10 FINAL cho Sale (4 sheet).
PHIÊN BẢN 2 (2026-11-04, Duyên: check ngược Base phải KHỚP Pos). Chia theo ĐƠN GỐC BASE nhưng khoá tổng = Pos.
Dùng:  python3 tools/bonus-t10/build_final_sale_base.py <file_Huyen.xlsx> <export_Base.xlsx|.xls> <DOI_SOAT_final_cu.xlsx> <ra.xlsx>
  - file Huyền   : sheet 'HUYỀN' (thẻ A..G, mã Base cột I, giá trị cột K, pivot TỔNG R:S), 'ĐƠN PT', 'ĐƠN MP', '1_Theo sale (final)' (Kênh + cột huỷ)
  - export Base  : file Base "export_jobs_of_don-cac-kenh…" sheet 'Tất cả' (Mã bộ đếm, Sale bán, Tổng giá trị đơn hàng (ko ship), Giá trị chênh của đơn đổi). .xls bị lỗi với xlrd -> script tự đổi sang .xlsx bằng soffice
  - final cũ     : lấy nguyên sheet '2_Tổng thưởng sale' + '4_Chi tiết thưởng' (thưởng CHƯA tính lại theo Base)
  - số check tay : tools/bonus-t10/base_cap_overrides.json  {"mã Base": giá trị được tính}
Quy tắc: số chuẩn = ĐƠN PT + ĐƠN MP; đơn PT có mã Base tra được thì chia theo ĐƠN GỐC BASE (người bán + giá trị, đơn đổi cộng chênh), các đơn Pos dùng chung mã Base gộp lại so với Base (base_cap_alloc.py): tổng = Pos; Base > Pos mà các đơn gốc khác người bán -> CHECK TAY; Base < Pos -> phần dư theo thẻ Pos. Đơn bảo hành (BH), đơn mỹ phẩm, mã không có trong export (NG…, DMP) -> chia đều theo thẻ Pos. HOANGKIEU gộp vào kieuHT1997.
Sau khi chạy cần recalc (skill xlsx: scripts/recalc.py) vì file dùng công thức.
Dòng KT ghi tay (mã Base rỗng) 1448/1450/1452/1454/1456/1457/1458 của sheet HUYỀN được gán về đơn chia tay tương ứng (REMAP) — nếu KT đổi số dòng phải sửa REMAP."""
import sys
FILE_A=FILE_B=sys.argv[1]; BASE_FILE,OLD_FINAL,OUT=sys.argv[2],sys.argv[3],sys.argv[4]
import os,json,subprocess,tempfile,math
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from base_cap_alloc import allocate_pos_order
if BASE_FILE.lower().endswith('.xls'):
    _td=tempfile.mkdtemp(); subprocess.run(['soffice','--headless','--convert-to','xlsx','--outdir',_td,BASE_FILE],check=True,capture_output=True)
    BASE_FILE=os.path.join(_td,os.path.basename(BASE_FILE)[:-4]+'.xlsx')
import openpyxl,collections,re
A=openpyxl.load_workbook(FILE_A,data_only=True)
s1=A["1_Theo sale (final)"]
CANON={}
KTC={}
for r in s1.iter_rows(min_row=4,max_row=47,values_only=True):
    CANON[r[1].lower()]=r[1]; KTC[r[1]]=r[2]
def canon(x):
    x=x.strip(); return CANON.get(x.lower(),x)
def code(x):
    x=str(x or '').strip().split('\n')[0].strip(); return x
def cards(s): return [canon(x) for x in str(s or '').split(',') if x.strip()]
pt=[]
d=A["ĐƠN PT"]
for i,r in enumerate(d.iter_rows(min_row=2,max_col=35,values_only=True),start=2):
    pt.append(dict(row=i,stt=r[0],cards=cards(r[1]),pos=r[9],code=code(r[26]),val=r[23] or 0,date=r[7],status=r[6],note=r[29],chan=r[30],cust=r[12],src=r[27],raw=r[1]))
mp=[]
for i,r in enumerate(A["ĐƠN MP"].iter_rows(min_row=2,max_col=30,values_only=True),start=2):
    if r[1] or r[23]:
        mp.append(dict(row=i,cards=cards(r[1]),pos=r[9],code=code(r[26]),val=r[23] or 0,date=r[7],note=r[29],raw=r[1],status=r[6],cust=r[12],chan=None,stt=r[0],src=r[27]))
ALIAS={'HOANGKIEU':'kieuHT1997'}
def al(c): return ALIAS.get(c,c)

B=openpyxl.load_workbook(FILE_B,data_only=True)
h=B["HUYỀN"]
ktH=[]
for i,r in enumerate(h.iter_rows(min_row=3,max_row=2000,max_col=23,values_only=True),start=3):
    if r[8] or r[10]: ktH.append(dict(row=i,cards=[canon(str(x)) for x in r[0:7] if x],code=code(r[8]),raw=r[8],val=r[10] or 0,src=r[9]))
pivH={}
for r in h.iter_rows(min_row=3,max_row=80,min_col=18,max_col=19,values_only=True):
    if r[0]: pivH[canon(r[0])]=r[1] or 0

fin=pt+mp
PP=collections.defaultdict(list)
for p in fin: PP[p['code']].append(p)
KK=collections.defaultdict(list)
_c681=[p['code'] for p in pt if p['pos']=='M45869'][0]
REMAP={1448:'17T10/2026',1450:'268T10/2026',1452:'416T10/2026',1454:'525T10/2026',1456:'1222T10/2026',1457:_c681,1458:_c681}
for k in ktH:
    k['code']=REMAP.get(k['row'],k['code'])
    KK[k['code']].append(k)
# ================= BASE: chia theo đơn gốc, khoá tổng = Pos =================
import pandas as pd
CANON['thuydinh1995']='thuydinh95'
SALES=set(CANON.values())
_ovp=os.path.join(os.path.dirname(os.path.abspath(__file__)),'base_cap_overrides.json')
_ov=json.load(open(_ovp,encoding='utf-8')) if os.path.exists(_ovp) else {}
OVR=_ov.get('gia_tri',{})      # {mã Base: giá trị được tính}  — số Duyên check tay (đơn nào Pos đã giảm)
OVS=_ov.get('nguoi_ban',{})    # {mã Base: [sale,...]}        — ép người bán nếu Base ghi sai
def _n(x):
    x=str(x).replace(',','').strip()
    if x in ('','nan','None'): return 0.0
    try: return float(x)
    except ValueError: return 0.0
_bd=pd.read_excel(BASE_FILE,sheet_name='Tất cả',dtype=str)
BS={}
for _,r in _bd.iterrows():
    sl=[al(canon(x)) for x in str(r['Sale bán']).split(',') if x.strip() and x.strip()!='nan']
    BS[str(r['Mã bộ đếm']).strip()]=dict(sellers=[s for s in dict.fromkeys(sl) if s in SALES],
        val=_n(r['Tổng giá trị đơn hàng (ko ship)'])+_n(r['Giá trị chênh của đơn đổi']),stage=r['Giai đoạn'],kenh=r['Kênh bán'],all=sl)
    if str(r['Mã bộ đếm']).strip() in OVS: BS[str(r['Mã bộ đếm']).strip()]['sellers']=[al(canon(x)) for x in OVS[str(r['Mã bộ đếm']).strip()]]
TOK=re.compile(r'(?<![A-Za-z0-9])((?:BH|NG)?\d+[A-Z]*T\d{2})(?:/(20\d\d))?(?![A-Za-z0-9])')
def tokens(raw): return [m.group(1)+'/'+(m.group(2) or '2026') for m in TOK.finditer(str(raw or '').split('\n')[0])]
par={}
def _f(x):
    while par.setdefault(x,x)!=x: par[x]=par[par[x]]; x=par[x]
    return x
for p in pt: p['isMP']=False
for p in mp: p['isMP']=True
for p in fin:
    p['key']=(id(p),); _f(p['key']); p['res']=[]; p['cal']=[al(c) for c in p['cards']]
    if p['isMP']: continue
    firstline=str(p['code'] or '')
    if 'BH' in firstline: continue
    p['res']=[t for t in tokens(firstline) if t in BS and BS[t]['sellers']]
    for t in p['res']: par[_f(p['key'])]=_f(('B',t))
COMPS=collections.defaultdict(list)
for p in fin: COMPS[_f(p['key'])].append(p)
def _tag_equal(ps):
    o=collections.defaultdict(float)
    for p in ps:
        for c in p['cal']: o[c]+=p['val']/len(p['cal'])
    return o
CINFO=[]
for k,ps in COMPS.items():
    te=_tag_equal(ps); toks=sorted({t for p in ps for t in p['res']}); P=sum(p['val'] for p in ps)
    if not toks:
        for p in ps:
            p['alloc']={}
            for c in p['cal']: p['alloc'][c]=p['alloc'].get(c,0)+p['val']/len(p['cal'])
            p['basediff']=False; p['cinfo']=None
        continue
    bl=[dict(code=t,value=BS[t]['val'],sellers=BS[t]['sellers']) for t in toks]
    cards=list(dict.fromkeys(c for p in ps for c in p['cal']))
    a=allocate_pos_order(P,bl,cards,overrides={c:v for c,v in OVR.items() if c in toks})
    sets={tuple(sorted(b['sellers'])) for b in bl}
    manual=(a['status']=='BASE_CAO_HON_POS' and len(sets)>1 and a['manual'])
    dif={s:a['shares'].get(s,0)-te.get(s,0) for s in set(a['shares'])|set(te)}
    dif={s:v for s,v in dif.items() if abs(v)>1}
    info=dict(ps=ps,toks=toks,bl=bl,P=P,a=a,manual=manual,dif=dif,cards=cards,te=te,
              seller_diff=set(s for b in bl for s in b['sellers'])!=set(cards))
    CINFO.append(info)
    for p in ps:
        w=p['val']/P if P else 0
        p['alloc']={s:v*w for s,v in a['shares'].items()}; p['basediff']=bool(dif); p['cinfo']=info
# kiểm: tổng chia = tổng Pos
assert abs(sum(sum(p['alloc'].values()) for p in fin)-sum(p['val'] for p in fin))<1, 'Tong chia != tong Pos'
def alloc_p(c):
    f=collections.defaultdict(float)
    for p in PP.get(c,[]):
        for s,v in p['alloc'].items(): f[s]+=v
    return f
def alloc_k(c):
    f=collections.defaultdict(float)
    for q in KK.get(c,[]):
        for s in q['cards']: f[al(s)]+=q['val']/len(q['cards'])
    return f
DIFF=[]
for c in set(PP)|set(KK):
    f=alloc_p(c);k=alloc_k(c)
    ds={s:f[s]-k[s] for s in set(f)|set(k) if abs(f[s]-k[s])>1}
    if ds: DIFF.append((c,f,k,ds))

from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment,Border,Side
from openpyxl.utils import get_column_letter as L_
import datetime
fmt=lambda v:f"{v:+,.0f}".replace(",",".")
num=lambda v:f"{v:,.0f}".replace(",",".")
C_BH="Bảo hành: KT thêm lanVH1995 vào thẻ"
C_BASE="Chia theo đơn gốc Base (khác KT)"
C_TAY="Base cao hơn Pos — CHECK TAY"
C_THE="Thẻ khác Pos"
C_GT="Giá trị khác Pos"
C_Q="Đơn quầy (phần của sale)"
cats=[C_BH,C_BASE,C_TAY,C_THE,C_GT,C_Q]
def baseshow(c): return c.replace('\n',' ')[:90]
def _bdetail(info):
    return "; ".join(f"{b['code']} ({', '.join(b['sellers'])}) = {num(b['value'])}" for b in info['bl'])
orders=[]
for c,f,k,d in DIFF:
    ps=PP.get(c,[]);ks=KK.get(c,[])
    pv=sum(p['val'] for p in ps);kv=sum(q['val'] for q in ks)
    pc=[];kc=[]
    for p in ps:
        for s in p['cards']:
            if al(s) not in pc: pc.append(al(s))
    for q in ks:
        for s in q['cards']:
            if al(s) not in kc: kc.append(al(s))
    infos=[p['cinfo'] for p in ps if p.get('cinfo')]
    info=infos[0] if infos else None
    valdiff=abs(pv-kv)>1
    pos=", ".join(p['pos'] for p in ps) or "—"
    date=ps[0]['date'] if ps else ""; cust=ps[0]['cust'] if ps else ""
    rows=[q['row'] for q in ks]; n=len(pc) or 1
    kdetail="; ".join(f"dòng {q['row']}: {' + '.join(q['cards'])} = {num(q['val'])}" for q in ks)
    final_txt=", ".join(f"{s} {num(v)}" for s,v in sorted(f.items(),key=lambda x:-x[1]) if abs(v)>=1)
    howc=f"Pos: mở đơn {pos} → xem ô Thẻ và Giá trị đơn hàng sau giảm giá (chuẩn: «{', '.join(pc)}» / {num(pv)})."
    chk="Pos"
    if info and info['manual']:
        cat=C_TAY
        dg=(f"Base {num(info['a']['base_sum'])} > Pos {num(info['P'])} (+{num(info['a']['diff'])}): Pos đã giảm tiền ở 1 trong các đơn gốc — {_bdetail(info)}. "
            f"Chưa biết giảm ở đơn nào nên TẠM co theo tỷ lệ (tổng = Pos): {final_txt}.")
        fix="Mở từng đơn gốc Base xem Pos giảm ở đơn nào → báo Duyên số đúng của từng đơn gốc (ghi vào base_cap_overrides.json); KT tạm sửa theo số tạm tính."
        chk="Pos + Base"
        howc+=f" Base: mở đơn {', '.join(info['toks'])} → so giá trị từng đơn gốc với Pos."
    elif set(kc)-set(pc)=={'lanVH1995'} and set(pc)<=set(kc) and not info:
        cat=C_BH
        dg=f"Đơn bảo hành. Pos: thẻ chỉ có «{', '.join(pc)}», giá trị {num(pv)}. KT: thêm «lanVH1995» vào thẻ nên chia đôi"+(f" và ghi giá trị {num(kv)} (≠ Pos {num(pv)})" if valdiff else f" ({num(kv/2)}/người)")+"."
        fix=f"Dòng {rows[0]}: bỏ «lanVH1995» khỏi cột thẻ"+(f"; sửa giá trị {num(kv)} → {num(pv)}" if valdiff else "")+"."
        howc+=f" Base: đơn {baseshow(c).split('+')[0].strip()} (kèm đơn bảo hành BH…) → xác nhận người bán không có lanVH1995."
    elif c in ('M44756','M44707'):
        cat=C_Q
        dg=f"Pos: phần sale của đơn quầy {num(pv)}. KT: "+(kdetail if ks else "chưa có dòng nào")+"."
        fix="Cập nhật phần của sale = "+num(pv)+" (đơn quầy)."
    elif info and (info['dif'] or c in ('17T10/2026','268T10/2026','416T10/2026','525T10/2026','765T10/2026','1222T10/2026')):
        cat=C_BASE
        dg=(f"Base: {_bdetail(info)} → tổng Base {num(info['a']['base_sum'])}, Pos {num(info['P'])}. Chia theo Base (tổng = Pos): {final_txt}. "
            f"Thẻ Pos «{', '.join(pc)}»; KT ghi: {kdetail or 'không có dòng'}"+(f" (tổng KT {num(kv)} ≠ Pos {num(pv)})" if valdiff and ks else "")+".")
        fix=f"Chia lại theo Base: {final_txt}"+("; xoá dòng chia thừa nếu đơn bị tính 2 lần." if len(ks)>1 else ".")
        chk="Base + Pos"
        howc+=f" Base: mở đơn {', '.join(info['toks'])} → xem người bán và giá trị từng đơn gốc ({_bdetail(info)})."
    elif set(pc)!=set(kc):
        cat=C_THE
        dg=f"Pos: thẻ «{', '.join(pc)}», giá trị {num(pv)}. KT: thẻ «{', '.join(kc)}», giá trị {num(kv)}."
        fix=f"Dòng {', '.join(map(str,rows))}: sửa thẻ → «{', '.join(pc)}»"+(f", giá trị → {num(pv)}" if valdiff else "")+"."
    else:
        cat=C_GT
        dg=f"Thẻ giống nhau («{', '.join(pc)}») nhưng giá trị khác: Pos {num(pv)} — KT {num(kv)}."
        fix=f"Dòng {', '.join(map(str,rows))}: sửa giá trị {num(kv)} → {num(pv)}."
    orders.append(dict(code=c,base=baseshow(c),pos=pos,date=date,cust=cust,cat=cat,pv=pv,kv=kv,pc=", ".join(pc),kc=", ".join(kc),rows=", ".join(map(str,rows)) or "—",d=d,dg=dg,chk=chk,howc=howc,fix=fix,valdiff=valdiff))
def dkey(o):
    try: dd=datetime.datetime.strptime(o['date'],"%d/%m/%Y")
    except Exception: dd=datetime.datetime(2026,10,31)
    return (cats.index(o['cat']),dd,o['pos'])
orders.sort(key=dkey)
# làm tròn VND nguyên: tổng các sale = tổng Pos; chênh từng đơn cộng đúng bằng chênh từng sale (đối chiếu = 0)
FS=collections.defaultdict(float)
for p in fin:
    for s_,v_ in p['alloc'].items(): FS[s_]+=v_
_tot=int(round(sum(p['val'] for p in fin)))
SALE_FINAL={s_:int(math.floor(v_)) for s_,v_ in FS.items()}
_gap=_tot-sum(SALE_FINAL.values())
for s_ in sorted(FS,key=lambda x:-(FS[x]-math.floor(FS[x])))[:max(_gap,0)]: SALE_FINAL[s_]+=1
assert sum(SALE_FINAL.values())==_tot
for o in orders: o['d']={s_:int(round(v_)) for s_,v_ in o['d'].items()}
for s_ in {x for o in orders for x in o['d']}:
    r_=(SALE_FINAL.get(s_,0)-int(round(pivH.get(s_,0))))-sum(o['d'].get(s_,0) for o in orders)
    if r_:
        t_=min((o for o in orders if s_ in o['d']),key=lambda o:(o['cat'] in (C_Q,C_BH),-abs(o['d'][s_])))
        t_['d'][s_]+=r_
SD=collections.defaultdict(lambda: collections.defaultdict(list))
for o in orders:
    for s,v in o['d'].items(): SD[s][o['cat']].append((o['code'],v,o))
def shortc(c): return c.split('+')[0].strip().split('(')[0].strip()
def explain(s):
    parts=[]
    for cat in cats:
        its=SD[s].get(cat)
        if not its: continue
        tot=sum(v for _,v,_ in its);n=len(its)
        codes=", ".join(shortc(c) for c,_,_ in its[:4])+(" …" if n>4 else "")
        if cat==C_BH:
            nv=sum(1 for _,_,o in its if o['valdiff'])
            if s=='lanVH1995': t=f"{n} đơn bảo hành: thẻ Pos không có lanVH1995, KT tự thêm để chia đôi → bỏ ({fmt(tot)})"
            else: t=f"{n} đơn bảo hành: thẻ Pos chỉ có {s}, KT chia bớt cho lanVH1995 → trả lại ({fmt(tot)})"
            if nv: t+=f"; trong đó {nv} đơn giá KT ≠ giá Pos"
        elif cat==C_BASE: t=f"{n} đơn chia theo đơn gốc Base ({codes}): {fmt(tot)}"
        elif cat==C_TAY: t=f"{n} đơn Base > Pos cần CHECK TAY ({codes}): {fmt(tot)} (tạm co theo tỷ lệ, tổng = Pos)"
        elif cat==C_THE: t=f"{n} đơn khác thẻ Pos ({codes}): {fmt(tot)}"
        elif cat==C_GT: t=f"{n} đơn giá KT ≠ giá Pos ({codes}): {fmt(tot)}"
        else: t=f"đơn quầy ({codes}): Pos lấy phần sale, KT ghi khác: {fmt(tot)}"
        parts.append(t)
    return "; ".join(parts)

# --------------- workbook
FN="Arial"
hdr_fill=PatternFill("solid",fgColor="1F3864");hf=Font(name=FN,bold=True,color="FFFFFF",size=10)
bf=Font(name=FN,size=10);bb=Font(name=FN,size=10,bold=True)
thin=Side(style="thin",color="BFBFBF");bd=Border(left=thin,right=thin,top=thin,bottom=thin)
wrap=Alignment(wrap_text=True,vertical="top");ctr=Alignment(horizontal="center",vertical="center",wrap_text=True)
NUM='#,##0;[Red]-#,##0;0';CHG='[Color10]+#,##0;[Red]-#,##0;0'
def header(ws,r,vals):
    for i,v in enumerate(vals,1):
        c=ws.cell(r,i,v);c.fill=hdr_fill;c.font=hf;c.alignment=ctr;c.border=bd
    ws.row_dimensions[r].height=42
def style_row(ws,r,n,numcols=(),chgcols=(),wrapcols=()):
    for i in range(1,n+1):
        c=ws.cell(r,i);c.font=c.font if c.font.bold else bf;c.border=bd
        if i in numcols: c.number_format=NUM
        if i in chgcols: c.number_format=CHG
        c.alignment=wrap if i in wrapcols else Alignment(vertical="top")
wb=Workbook()
# ---- sheet 1
ws=wb.active;ws.title="1_Theo sale (final)"
s1=A["1_Theo sale (final)"]
meta={}
for r in s1.iter_rows(min_row=4,max_row=47,values_only=True):
    meta[r[1]]=dict(ch=r[0] or "",huy09=r[6] or 0,huyold=r[8] or 0)
fsh=collections.defaultdict(float)
for p in pt+mp:
    for s_,v_ in p['alloc'].items(): fsh[s_]+=v_
ws["A1"]="DOANH THU THEO SALE — T10/2026 (FINAL cho Sale) — kỳ 01–31/10/2026"
ws["A1"].font=Font(name=FN,bold=True,size=13)
ws["A2"]=("Số chuẩn = doanh thu đơn Pos (đơn PT + đơn mỹ phẩm), mỗi đơn tính 1 lần, TỔNG LUÔN = Pos. Đơn có mã Base thì chia theo ĐƠN GỐC BASE (người bán + giá trị đơn gốc; đơn đổi cộng chênh); "
          "Base < Pos → phần dư chia theo thẻ Pos; Base > Pos → xem sheet 5 (chỉ ca khác người bán mới cần check tay). Đơn bảo hành / mỹ phẩm / mã không có trong Base (NG…) chia đều theo thẻ Pos. "
          "So sánh với file chốt của kế toán Huyền (sheet HUYỀN, cột TỔNG). Diễn giải chỉ nêu theo Pos/Base. "
          "Huỷ T09 là phần hoàn/huỷ của tháng trước trừ vào kỳ này (giữ nguyên số của file Huyền). HOANGKIEU được gộp vào kieuHT1997 (cùng người).")
ws["A2"].alignment=wrap;ws["A2"].font=bf;ws.merge_cells("A2:L2");ws.row_dimensions[2].height=48
H=["Kênh","Sale","KT Huyền (cột TỔNG)","Số chuẩn (final)","Thay đổi so với KT Huyền","Tăng / Giảm","Diễn giải (theo Pos / Base)","Huỷ tháng 09 (trừ)","Số chuẩn sau khi trừ huỷ T09","Huỷ tháng cũ hơn (không trừ)","Nếu trừ hết huỷ"]
header(ws,4,H)
names=list(pivH.keys())
r0=5
for i,n in enumerate(names):
    r=r0+i;m=meta.get(n,dict(ch="",huy09=0,huyold=0))
    ws.cell(r,1,m['ch']);ws.cell(r,2,n)
    ws.cell(r,3,round(pivH[n]));ws.cell(r,4,SALE_FINAL.get(al(n),0))
    ws.cell(r,5,f"=D{r}-C{r}")
    ws.cell(r,6,f'=IF(ROUND(E{r},0)>0,"▲ Tăng",IF(ROUND(E{r},0)<0,"▼ Giảm","—"))')
    ws.cell(r,7,explain(al(n)) if abs(SALE_FINAL.get(al(n),0)-round(pivH[n]))>=1 else "")
    ws.cell(r,8,m['huy09']);ws.cell(r,9,f"=D{r}-H{r}");ws.cell(r,10,m['huyold']);ws.cell(r,11,f"=D{r}-H{r}-J{r}")
    style_row(ws,r,11,numcols=(3,4,8,9,10,11),chgcols=(5,),wrapcols=(7,))
rl=r0+len(names)-1;rt=rl+1
ws.cell(rt,2,"TỔNG")
for col in (3,4,5,8,9,10,11): ws.cell(rt,col,f"=SUM({L_(col)}{r0}:{L_(col)}{rl})")
ws.cell(rt,6,f'=IF(ROUND(E{rt},0)>0,"▲ Tăng",IF(ROUND(E{rt},0)<0,"▼ Giảm","—"))')
for i in range(1,12):
    c=ws.cell(rt,i);c.font=bb;c.border=bd;c.fill=PatternFill("solid",fgColor="D9E1F2")
    if i in (3,4,8,9,10,11): c.number_format=NUM
    if i==5: c.number_format=CHG
for col,w in zip("ABCDEFGHIJK",[8,20,18,18,18,12,95,15,18,16,18]): ws.column_dimensions[col].width=w
ws.freeze_panes="C5"
S1_TOT=rt
# ---- sheet 3 (build before sheet 2 order) 
ws3=wb.create_sheet("3_Đơn cần đổi")
ws3["A1"]="CHỈ NHỮNG ĐƠN CẦN THAY ĐỔI SO VỚI FILE CHỐT CỦA KẾ TOÁN HUYỀN — và cách check theo Base hay Pos"
ws3["A1"].font=Font(name=FN,bold=True,size=13)
ws3["A2"]=("Mỗi dòng là 1 đơn mà số tính cho từng sale trong file Huyền khác số chuẩn. Cột chênh = số chuẩn − số KT Huyền cho từng sale (dương = KT đang thiếu, âm = KT đang thừa). "
           "Số dòng KT là dòng trong sheet HUYỀN của file Huyền. Cách check: Pos = mở đơn Mxxxxx trên Pos xem Thẻ + Giá trị sau giảm giá; Base = mở mã đơn Base (cột Ghi chú nội bộ) xem người bán/giá trị đơn gốc.")
ws3["A2"].alignment=wrap;ws3["A2"].font=bf;ws3.merge_cells("A2:V2");ws3.row_dimensions[2].height=44
# summary block
ws3["A4"]="TÓM TẮT THEO NHÓM";ws3["A4"].font=bb
header(ws3,5,["Nhóm","Số đơn","Tổng chênh (Σ các sale)"])
SUMR0=6
HR=SUMR0+len(cats)+3
ncol=22
cols=["STT","Ngày tạo đơn","Mã Base (ghi chú nội bộ)","Mã Pos","Khách","Nhóm","Giá trị Pos","Giá trị KT Huyền","Thẻ Pos (chuẩn)","Thẻ KT Huyền","Dòng KT (sheet HUYỀN)","Sale 1","Chênh 1","Sale 2","Chênh 2","Sale 3","Chênh 3","Diễn giải","Check theo","Cách check","Cần sửa trên file KT","Tổng chênh đơn"]
header(ws3,HR,cols)
for i,o in enumerate(orders):
    r=HR+1+i
    vals=[i+1,o['date'],o['base'],o['pos'],o['cust'],o['cat'],round(o['pv']),round(o['kv']),o['pc'],o['kc'],o['rows']]
    for j,v in enumerate(vals,1): ws3.cell(r,j,v)
    items=sorted(o['d'].items(),key=lambda x:(-abs(x[1]),x[0]))
    for j,(s,v) in enumerate(items[:3]):
        ws3.cell(r,12+2*j,s);ws3.cell(r,13+2*j,round(v))
    ws3.cell(r,18,o['dg']);ws3.cell(r,19,o['chk']);ws3.cell(r,20,o['howc']);ws3.cell(r,21,o['fix'])
    ws3.cell(r,22,f"=M{r}+O{r}+Q{r}")
    style_row(ws3,r,ncol,numcols=(7,8),chgcols=(13,15,17,22),wrapcols=(3,5,6,9,10,18,20,21))
LAST=HR+len(orders)
for k,cname in enumerate(cats):
    r=SUMR0+k
    ws3.cell(r,1,cname);ws3.cell(r,2,f'=COUNTIF($F${HR+1}:$F${LAST},A{r})');ws3.cell(r,3,f'=SUMIF($F${HR+1}:$F${LAST},A{r},$V${HR+1}:$V${LAST})')
    style_row(ws3,r,3,numcols=(2,),chgcols=(3,))
rr=SUMR0+len(cats)
ws3.cell(rr,1,"TỔNG");ws3.cell(rr,2,f"=SUM(B{SUMR0}:B{rr-1})");ws3.cell(rr,3,f"=SUM(C{SUMR0}:C{rr-1})")
for i in (1,2,3): ws3.cell(rr,i).font=bb;ws3.cell(rr,i).border=bd;ws3.cell(rr,i).fill=PatternFill("solid",fgColor="D9E1F2")
ws3.cell(rr,3).number_format=CHG
ws3.cell(rr+1,1,"Đối chiếu với sheet 1 (phải = 0)");ws3.cell(rr+1,3,f"=C{rr}-'1_Theo sale (final)'!E{S1_TOT}");ws3.cell(rr+1,3).number_format=NUM
ws3.cell(rr+1,1).font=bf;ws3.cell(rr+1,3).font=bb
widths=[6,12,34,14,22,28,14,14,26,26,14,18,13,18,13,18,13,60,11,60,48,14]
for i,w in enumerate(widths,1): ws3.column_dimensions[L_(i)].width=w
ws3.column_dimensions["A"].width=40
ws3.freeze_panes=ws3.cell(HR+1,4)
# ---- sheet 4: chi tiết thưởng
OLDF=openpyxl.load_workbook(OLD_FINAL,data_only=True)
ct=OLDF["4_Chi tiết thưởng"]
ws4=wb.create_sheet("4_Chi tiết thưởng")
ws4["A1"]="CHI TIẾT THƯỞNG SALE ONLINE / OFFLINE — T10/2026";ws4["A1"].font=Font(name=FN,bold=True,size=13)
header(ws4,3,["Ngày","Sale","Kênh","Loại thưởng","Chương trình","Tiền thưởng (đ)","Căn cứ","Mã đơn Base (ghi chú nội bộ)"])
n4=0
for i,row in enumerate(ct.iter_rows(min_row=4,max_row=ct.max_row,max_col=8,values_only=True)):
    if not row[1]: continue
    r=4+n4;n4+=1
    for j,v in enumerate(row,1):
        c=ws4.cell(r,j,v)
        if j==1 and isinstance(v,(datetime.datetime,datetime.date)): c.number_format="dd/mm/yyyy"
    style_row(ws4,r,8,numcols=(6,),wrapcols=(5,7,8))
D1,D2=4,3+n4
for col,w in zip("ABCDEFGH",[12,20,10,30,44,14,50,36]): ws4.column_dimensions[col].width=w
ws4.freeze_panes="A4";ws4.auto_filter.ref=f"A3:H{D2}"
# ---- sheet 2: tổng thưởng
ws2=wb.create_sheet("2_Tổng thưởng sale",1)
th=OLDF["2_Tổng thưởng sale"]
ws2["A1"]="BẢNG TỔNG THƯỞNG SALE ONLINE / OFFLINE — T10/2026";ws2["A1"].font=Font(name=FN,bold=True,size=13)
ws2["A2"]=("Chỉ đội Online + Offline (18 sale đã phân loại). Doanh thu = đơn PT chia đều theo thẻ (không gồm đơn mỹ phẩm). "
           "Thưởng THEO ĐƠN / THEO SẢN PHẨM / THEO DOANH SỐ NGÀY / THỬ VIỆC cộng bằng SUMIFS từ sheet 4_Chi tiết thưởng; cột doanh thu là số nhập tay lấy từ file chuẩn.")
ws2["A2"].alignment=wrap;ws2["A2"].font=bf;ws2.merge_cells("A2:H2");ws2.row_dimensions[2].height=44
header(ws2,4,["Sale","Kênh","Doanh thu đơn PT T10 (đ, không MP)","Thưởng THEO ĐƠN (giá trị đơn)","Thưởng THEO DOANH SỐ NGÀY","Thưởng THEO SẢN PHẨM","Thưởng THỬ VIỆC (đơn đầu / số đơn)","TỔNG THƯỞNG"])
T="'4_Chi tiết thưởng'"
types=["Theo đơn (giá trị đơn)","Theo doanh số ngày","Theo sản phẩm","Thưởng thử việc (đơn đầu/số đơn)"]
srows=[r for r in th.iter_rows(min_row=5,max_row=22,values_only=True)]
for i,r in enumerate(srows):
    rr_=5+i
    ws2.cell(rr_,1,r[0]);ws2.cell(rr_,2,r[1]);ws2.cell(rr_,3,round(r[2]))
    for j,tp in enumerate(types):
        ws2.cell(rr_,4+j,f'=SUMIFS({T}!$F${D1}:$F${D2},{T}!$B${D1}:$B${D2},$A{rr_},{T}!$D${D1}:$D${D2},"{tp}")')
    ws2.cell(rr_,8,f"=SUM(D{rr_}:G{rr_})")
    style_row(ws2,rr_,8,numcols=tuple(range(3,9)))
e=4+len(srows)
labels=[("TỔNG ONLINE","Online"),("TỔNG OFFLINE","Offline"),("TỔNG THỬ VIỆC","Thử việc")]
for k,(lab,key) in enumerate(labels):
    r=e+1+k;ws2.cell(r,1,lab)
    for col in range(3,9): ws2.cell(r,col,f'=SUMIFS({L_(col)}$5:{L_(col)}${e},$B$5:$B${e},"{key}")')
r=e+4;ws2.cell(r,1,"TỔNG CỘNG")
for col in range(3,9): ws2.cell(r,col,f"=SUM({L_(col)}5:{L_(col)}{e})")
for rr_ in range(e+1,e+5):
    for i in range(1,9):
        c=ws2.cell(rr_,i);c.font=bb;c.border=bd;c.fill=PatternFill("solid",fgColor="D9E1F2")
        if i>=3:c.number_format=NUM
notes=["LƯU Ý:",
"1) Thưởng ước tính theo 12 chương trình mẫu «Thưởng online chính thức»; chương trình bật thật có thể khác.",
"2) Chưa tự loại Tỳ Hưu Ngọc/Ruby/Saphire và đơn huỷ. THƯỞNG + cột doanh thu của sheet này CHƯA tính lại theo chia Base (giữ số bản trước, tính theo thẻ Pos) — sheet 1 mới là số doanh thu chuẩn.",
"3) Ngọc (ngocNB2003saleoff) là sale THỬ VIỆC, bắt đầu tính thưởng từ 14/10/2026: ngày 1–3 (14,15,16/10) thưởng ĐƠN ĐẦU TIÊN TRONG NGÀY 50.000đ; từ ngày 4 (17/10) thưởng bậc số đơn/ngày và doanh số ngày (mẫu «Cơ chế thưởng kích hoạt Sale mới»). Không dùng bảng thưởng chính thức.",
"4) Thưởng THEO ĐƠN / THEO SẢN PHẨM tính theo từng đơn trên sheet ĐƠN PT; thưởng THEO DOANH SỐ NGÀY tính theo sale–ngày nên chỉ có ở sheet 4_Chi tiết thưởng."]
for k,t in enumerate(notes):
    c=ws2.cell(e+6+k,1,t);c.font=bb if k==0 else bf
for col,w in zip("ABCDEFGH",[22,12,24,18,18,18,20,16]): ws2.column_dimensions[col].width=w
ws2.freeze_panes="A5"

# ---- sheet 5: Base vs Pos — đơn cần check tay / xác nhận
ws5=wb.create_sheet("5_Check tay Base-Pos")
ws5["A1"]="ĐƠN BASE ≠ POS — CHECK TAY / XÁC NHẬN";ws5["A1"].font=Font(name=FN,bold=True,size=13)
ws5["A2"]=("Nguyên tắc: Pos là số chuẩn, tổng chia cho các sale của đơn luôn = Pos. Loại A = Base CAO HƠN Pos và các đơn gốc khác người bán → chưa biết Pos giảm ở đơn nào, CHECK TAY (số tạm co theo tỷ lệ). "
           "Loại B = người bán trên Base khác thẻ Pos → đã chia theo Base, cần xác nhận. Loại C = Base cao hơn Pos nhưng cùng người bán → không ảnh hưởng cách chia (chỉ để tham khảo).")
ws5["A2"].alignment=wrap;ws5["A2"].font=bf;ws5.merge_cells("A2:L2");ws5.row_dimensions[2].height=48
H5=["Loại","Mã Pos","Ngày tạo","Mã Base","Giá trị Pos","Tổng Base (đơn gốc)","Base − Pos","Chi tiết đơn gốc Base (mã / người bán / giá trị)","Thẻ Pos","Số chia (final, tổng = Pos)","Chia theo thẻ Pos (cũ) → thay đổi","Cần làm"]
header(ws5,4,H5)
def _kind(i):
    if i['manual']: return "A. CHECK TAY"
    if i['seller_diff'] and i['dif']: return "B. Người bán Base ≠ thẻ Pos"
    if i['a']['status']=='BASE_CAO_HON_POS': return "C. Base > Pos, cùng người bán"
    return None
L5=[]
for i in CINFO:
    k=_kind(i)
    if k: L5.append((k,i))
L5.sort(key=lambda x:(x[0],-abs(x[1]['a']['diff']),x[1]['ps'][0]['pos']))
for j,(k,i) in enumerate(L5):
    r=5+j
    ps=i['ps']
    final_txt=", ".join(f"{s} {num(v)}" for s,v in sorted(i['a']['shares'].items(),key=lambda x:-x[1]) if v)
    chg_txt="; ".join(f"{s} {fmt(v)}" for s,v in sorted(i['dif'].items(),key=lambda x:-abs(x[1])))
    todo={"A":"Mở đơn gốc xem Pos giảm tiền ở đơn nào → báo số đúng (base_cap_overrides.json). Tạm dùng số co theo tỷ lệ.",
          "B":"Xác nhận người bán đúng theo Base (nếu đúng thẻ Pos thì sửa Pos/Base cho khớp).",
          "C":"Không cần làm (Pos đã giảm giá; chia đều cùng người bán)."}[k[0]]
    vals=[k,", ".join(p['pos'] for p in ps),ps[0]['date'],", ".join(i['toks']),round(i['P']),round(i['a']['base_sum']),f"=F{r}-E{r}",_bdetail(i),", ".join(i['cards']),final_txt,chg_txt or "—",todo]
    for c_,v in enumerate(vals,1): ws5.cell(r,c_,v)
    style_row(ws5,r,12,numcols=(5,6),chgcols=(7,),wrapcols=(4,8,9,10,11,12))
for col,w in zip("ABCDEFGHIJKL",[26,18,12,26,14,16,13,60,34,50,50,50]): ws5.column_dimensions[col].width=w
ws5.freeze_panes="B5"; ws5.auto_filter.ref=f"A4:L{4+len(L5)}"
print("sheet5 rows",len(L5),collections.Counter(k for k,_ in L5))
wb.save(OUT)
print("orders",len(orders),"detail rows",n4,"| tong chia",round(sum(fsh.values())),"| tong Pos",round(sum(p["val"] for p in pt+mp)))

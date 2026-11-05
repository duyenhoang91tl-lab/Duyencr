#!/usr/bin/env python3
"""build_final_sale.py — dựng file ĐỐI SOÁT T10 FINAL cho Sale (4 sheet).
Dùng:  python3 tools/bonus-t10/build_final_sale.py <DOI_SOAT_T10_CHUAN_GOP.xlsx> <file_KT_Huyen.xlsx> <ra.xlsx>
  - file chuẩn  : sheet 'ĐƠN PT', 'ĐƠN MP', '1_Theo sale (final)' (cột huỷ), 'THUONG_Tong_theo_sale', 'THUONG_Chi_tiet', 'LECH_tung_don'
  - file KT Huyền: sheet 'HUYỀN' (thẻ ở cột A..G, mã Base cột I, giá trị cột K, pivot TỔNG ở R:S)
Quy tắc: số chuẩn = ĐƠN PT + ĐƠN MP chia đều theo thẻ Pos, mỗi đơn 1 lần; HOANGKIEU gộp vào kieuHT1997.
Sau khi chạy cần recalc (skill xlsx: scripts/recalc.py) vì file dùng công thức.
Dòng KT ghi tay (mã Base rỗng) 1448/1450/1452/1454/1456/1457/1458 của sheet HUYỀN được gán về đơn chia tay tương ứng (REMAP) — nếu KT đổi số dòng phải sửa REMAP."""
import sys
FILE_A,FILE_B,OUT=sys.argv[1],sys.argv[2],sys.argv[3]
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
kt=[]
t=A["Trang_tính1"]
for i,r in enumerate(t.iter_rows(min_row=3,max_col=20,values_only=True),start=3):
    if r[8] or r[10]: kt.append(dict(row=i,cards=cards(r[0]),code=code(r[8]),raw=r[8],val=r[10] or 0))
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
def alloc_p(c):
    f=collections.defaultdict(float)
    for p in PP.get(c,[]):
        for s in p['cards']: f[al(s)]+=p['val']/len(p['cards'])
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
_c681=[p['code'] for p in pt if p['pos']=='M45869'][0]
HAND={'17T10/2026','268T10/2026','416T10/2026','525T10/2026','765T10/2026','1222T10/2026','M44756','M44707',_c681}
DUYEN={'162T10/2026','430T10/2026'}
lech=A["LECH_tung_don"]
LECH=collections.defaultdict(list)
for r in lech.iter_rows(min_row=4,values_only=True):
    if r[2]: LECH[code(r[2])].append(r)

def baseshow(c):
    return c.replace('\n',' ')[:90]
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
    if c in HAND: cat="Đơn chia nhiều sale / đơn quầy (KT ghi tay)" if c not in ('M44756','M44707') else "Đơn quầy (phần của sale)"
    elif c in DUYEN: cat="Thẻ Pos đã chốt lại (chỉ còn 1 sale)"
    elif set(kc)-set(pc)=={'lanVH1995'} and set(pc)<=set(kc): cat="Bảo hành: KT thêm lanVH1995 vào thẻ"
    elif set(pc)!=set(kc): cat="Thẻ khác Pos"
    else: cat="Giá trị khác Pos"
    valdiff=abs(pv-kv)>1
    pos=", ".join(p['pos'] for p in ps) or "—"
    date=ps[0]['date'] if ps else ""
    cust=ps[0]['cust'] if ps else ""
    rows=[q['row'] for q in ks]
    n=len(pc) or 1
    kdetail="; ".join(f"dòng {q['row']}: {' + '.join(q['cards'])} = {num(q['val'])}" for q in ks)
    if cat.startswith("Bảo hành"):
        dg=f"Đơn bảo hành. Pos: thẻ chỉ có «{', '.join(pc)}», giá trị {num(pv)}. KT: thêm «lanVH1995» vào thẻ nên chia đôi" + (f" và ghi giá trị {num(kv)} (≠ Pos {num(pv)})" if valdiff else f" ({num(kv/2)}/người)")+"."
        fix=f"Dòng {rows[0]}: bỏ «lanVH1995» khỏi cột thẻ" + (f"; sửa giá trị {num(kv)} → {num(pv)}" if valdiff else "")+"."
        chk="Pos"
    elif cat.startswith("Thẻ Pos"):
        dg=f"Pos đã chốt thẻ chỉ còn «{', '.join(pc)}» (giá trị {num(pv)}). KT vẫn chia: {kdetail}."
        fix=f"Dòng {rows[0]}: sửa thẻ → «{', '.join(pc)}»."
        chk="Pos"
    elif cat.startswith("Đơn quầy"):
        dg=f"Pos: phần sale của đơn quầy {num(pv)}. KT: " + (kdetail if ks else "chưa có dòng nào")+"."
        fix="Cập nhật phần của sale = "+num(pv)+" (đơn quầy)."
        chk="Pos"
    elif cat.startswith("Đơn chia"):
        dg=f"Pos: thẻ «{', '.join(pc)}» → chia đều {num(pv/n)}/người trên tổng {num(pv)}. KT ghi tay: {kdetail or 'không có dòng'}." + (f" Tổng KT {num(kv)} ≠ Pos {num(pv)}." if valdiff and ks else "")
        fix=f"Chia lại theo thẻ Pos (đều {num(pv/n)}/người, tổng {num(pv)}); xoá dòng chia thừa nếu đơn bị tính 2 lần."
        chk="Pos + Base"
    elif cat.startswith("Thẻ khác"):
        dg=f"Pos: thẻ «{', '.join(pc)}», giá trị {num(pv)}. KT: thẻ «{', '.join(kc)}», giá trị {num(kv)}."
        fix=f"Dòng {', '.join(map(str,rows))}: sửa thẻ → «{', '.join(pc)}»"+(f", giá trị → {num(pv)}" if valdiff else "")+"."
        chk="Pos"
    else:
        dg=f"Thẻ giống nhau («{', '.join(pc)}») nhưng giá trị khác: Pos {num(pv)} — KT {num(kv)}."
        fix=f"Dòng {', '.join(map(str,rows))}: sửa giá trị {num(kv)} → {num(pv)}."
        chk="Pos"
    howc=f"Pos: mở đơn {pos} → xem ô Thẻ và Giá trị đơn hàng sau giảm giá (chuẩn: «{', '.join(pc)}» / {num(pv)})."
    base=baseshow(c)
    plus = ('+' in c and not c.startswith('M')) 
    lr=LECH.get(c)
    if lr or (cat.startswith("Đơn chia")) or (plus and not cat.startswith("Bảo hành")):
        chk="Pos + Base"
        howc+=f" Base: mở đơn {base} → xem người bán và giá trị của từng đơn gốc"
        if lr: howc+="; Base ghi: "+"; ".join(dict.fromkeys(f"{x[8]} / {num(x[10] or 0)}" for x in lr))
        howc+="."
    elif cat.startswith("Bảo hành"):
        howc+=f" Base: đơn {base.split('+')[0].strip()} (kèm đơn bảo hành BH…) → xác nhận người bán không có lanVH1995."
    orders.append(dict(code=c,base=base,pos=pos,date=date,cust=cust,cat=cat,pv=pv,kv=kv,pc=", ".join(pc),kc=", ".join(kc),rows=", ".join(map(str,rows)) or "—",d=d,dg=dg,chk=chk,howc=howc,fix=fix,valdiff=valdiff))
def dkey(o):
    try: dd=datetime.datetime.strptime(o['date'],"%d/%m/%Y")
    except: dd=datetime.datetime(2026,10,31)
    return (o['cat'],dd,o['pos'])
orders.sort(key=dkey)
# per sale explanation
cats=["Bảo hành: KT thêm lanVH1995 vào thẻ","Thẻ Pos đã chốt lại (chỉ còn 1 sale)","Thẻ khác Pos","Giá trị khác Pos","Đơn chia nhiều sale / đơn quầy (KT ghi tay)","Đơn quầy (phần của sale)"]
SD=collections.defaultdict(lambda: collections.defaultdict(list))
for o in orders:
    for s,v in o['d'].items(): SD[s][o['cat']].append((o['code'],v,o))
def shortc(c): 
    c=c.split('+')[0].strip().split('(')[0].strip(); return c
def explain(s):
    parts=[]
    for cat in cats:
        its=SD[s].get(cat)
        if not its: continue
        tot=sum(v for _,v,_ in its);n=len(its)
        codes=", ".join(shortc(c) for c,_,_ in its[:4])+(" …" if n>4 else "")
        if cat.startswith("Bảo hành"):
            nv=sum(1 for _,_,o in its if o['valdiff'])
            if s=='lanVH1995': t=f"{n} đơn bảo hành: thẻ Pos không có lanVH1995, KT tự thêm để chia đôi → bỏ ({fmt(tot)})"
            else: t=f"{n} đơn bảo hành: thẻ Pos chỉ có {s}, KT chia bớt cho lanVH1995 → trả lại ({fmt(tot)})"
            if nv: t+=f"; trong đó {nv} đơn giá KT ≠ giá Pos"
        elif cat.startswith("Thẻ Pos"): t=f"Pos đã chốt thẻ lại ({codes}): {fmt(tot)}"
        elif cat.startswith("Thẻ khác"): t=f"{n} đơn khác thẻ Pos ({codes}): {fmt(tot)}"
        elif cat.startswith("Giá trị"): t=f"{n} đơn giá KT ≠ giá Pos ({codes}): {fmt(tot)}"
        elif cat.startswith("Đơn quầy"): t=f"đơn quầy ({codes}): Pos lấy phần sale, KT ghi khác: {fmt(tot)}"
        else: t=f"{n} đơn chia nhiều sale ({codes}): Pos chia đều theo thẻ, KT ghi tay chia khác: {fmt(tot)}"
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
    for x in p['cards']: fsh[al(x)]+=p['val']/len(p['cards'])
ws["A1"]="DOANH THU THEO SALE — T10/2026 (FINAL cho Sale) — kỳ 01–31/10/2026"
ws["A1"].font=Font(name=FN,bold=True,size=13)
ws["A2"]=("Số chuẩn = doanh thu đơn Pos (đơn PT + đơn mỹ phẩm), chia đều theo số người trên thẻ Pos, mỗi đơn tính 1 lần. "
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
    ws.cell(r,3,round(pivH[n]));ws.cell(r,4,round(fsh.get(al(n),0)))
    ws.cell(r,5,f"=D{r}-C{r}")
    ws.cell(r,6,f'=IF(ROUND(E{r},0)>0,"▲ Tăng",IF(ROUND(E{r},0)<0,"▼ Giảm","—"))')
    ws.cell(r,7,explain(al(n)) if abs(round(fsh.get(al(n),0))-round(pivH[n]))>=1 else "")
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
ct=A["THUONG_Chi_tiet"]
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
th=A["THUONG_Tong_theo_sale"]
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
"2) Chưa tự loại Tỳ Hưu Ngọc/Ruby/Saphire và đơn huỷ; đơn chia nhiều sale chưa có tỷ lệ thật thì tính chia đều theo thẻ Pos.",
"3) Ngọc (ngocNB2003saleoff) là sale THỬ VIỆC, bắt đầu tính thưởng từ 14/10/2026: ngày 1–3 (14,15,16/10) thưởng ĐƠN ĐẦU TIÊN TRONG NGÀY 50.000đ; từ ngày 4 (17/10) thưởng bậc số đơn/ngày và doanh số ngày (mẫu «Cơ chế thưởng kích hoạt Sale mới»). Không dùng bảng thưởng chính thức.",
"4) Thưởng THEO ĐƠN / THEO SẢN PHẨM tính theo từng đơn trên sheet ĐƠN PT; thưởng THEO DOANH SỐ NGÀY tính theo sale–ngày nên chỉ có ở sheet 4_Chi tiết thưởng."]
for k,t in enumerate(notes):
    c=ws2.cell(e+6+k,1,t);c.font=bb if k==0 else bf
for col,w in zip("ABCDEFGH",[22,12,24,18,18,18,20,16]): ws2.column_dimensions[col].width=w
ws2.freeze_panes="A5"
wb.save(OUT)
print("orders",len(orders),"detail rows",n4)

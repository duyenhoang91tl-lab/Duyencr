#!/usr/bin/env python3
"""Sau recalc.py: LibreOffice ghi autofilter cu thanh operator="**none**" (khong hop le, Excel co the bao loi). Tra ve dung bo loc goc (khac " ").
Dung: python3 fix_filters.py <file.xlsx>  (ghi de tai ccho)"""
import sys, zipfile, shutil
src = sys.argv[1]; tmp = src + '.tmp'; n = 0
zi = zipfile.ZipFile(src); zo = zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED)
for it in zi.infolist():
    d = zi.read(it.filename)
    if it.filename.startswith('xl/worksheets/sheet'):
        s = d.decode('utf-8'); k = s.count('operator="**none**" val=""')
        if k: s = s.replace('<customFilter operator="**none**" val=""/>', '<customFilter val=" " operator="notEqual"/>'); n += k; d = s.encode('utf-8')
    zo.writestr(it, d)
zo.close(); shutil.move(tmp, src); print('da sua', n, 'bo loc')

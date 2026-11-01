#!/usr/bin/env python3
"""So gas/*.gs (+ appsscript.json) với bản Apps Script ĐANG CHẠY của deployment (đã `clasp pull --versionNumber N` vào thư mục thứ 2).
Thoát 0 nếu GIỐNG HỆT (bỏ qua deploy, khỏi tốn 1 phiên bản trong hạn mức 200), 1 nếu khác hoặc không chắc (=> cứ deploy cho an toàn).
Dùng: python3 tools/gas-same-as-live.py <thư_mục_gas> <thư_mục_live>"""
import os, sys

def load(d):
    out = {}
    for f in os.listdir(d):
        base, ext = os.path.splitext(f)
        if ext not in ('.gs', '.js', '.json') or f.startswith('.') or f in ('INDEX.md',):
            continue
        key = f if ext == '.json' else base            # clasp pull lưu .js, ta lưu .gs => so theo tên không đuôi
        if f == 'appsscript.json' or ext != '.json':
            with open(os.path.join(d, f), encoding='utf-8', errors='replace') as fh:
                out[key] = fh.read().replace('\r\n', '\n').rstrip('\n')
    return out

def main(a, b):
    if not os.path.isdir(a) or not os.path.isdir(b):
        return 1
    x, y = load(a), load(b)
    if 'appsscript.json' in x and 'appsscript.json' in y:   # manifest do CI chép từ bản đang chạy nên chỉ so phần code
        x.pop('appsscript.json'); y.pop('appsscript.json')
    if not y or not x:
        return 1                                            # không kéo được bản đang chạy => deploy
    return 0 if x == y else 1

if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))

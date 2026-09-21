#!/usr/bin/env python3
"""Đồng bộ gas_v13.js -> khối <script type="text/plain" id="gas-code-v9"> trong index.html.

Vì sao cần: nút "Copy code" trong modal ⚙ Google Sheets của index.html lấy mã GAS từ khối này
(không đọc gas_v13.js). Sửa gas_v13.js mà quên chạy file này thì Duyên copy ra bản CŨ.

Cách dùng (chạy ở thư mục gốc repo, SAU MỖI LẦN sửa gas_v13.js):
    python3 sync_gas_to_index.py
"""
import re, sys

GAS, IDX = 'gas_v13.js', 'index.html'
gas = open(GAS, encoding='utf-8').read()
if '</script' in gas.lower():
    sys.exit('LỖI: gas_v13.js chứa "</script" — sẽ làm vỡ thẻ <script> trong index.html. Hãy đổi cách viết chuỗi đó.')
idx = open(IDX, encoding='utf-8').read()
pat = re.compile(r'(<script type="text/plain" id="gas-code-v9">)(.*?)(</script>)', re.S)
m = pat.search(idx)
if not m:
    sys.exit('LỖI: không tìm thấy khối <script type="text/plain" id="gas-code-v9"> trong index.html')
new_block = m.group(1) + '\n' + gas.strip('\n') + '\n' + m.group(3)
if m.group(0) == new_block:
    print('Đã đồng bộ sẵn — không có gì thay đổi.')
else:
    open(IDX, 'w', encoding='utf-8').write(idx[:m.start()] + new_block + idx[m.end():])
    print('Đã cập nhật khối GAS trong index.html (%d -> %d ký tự).' % (len(m.group(0)), len(new_block)))

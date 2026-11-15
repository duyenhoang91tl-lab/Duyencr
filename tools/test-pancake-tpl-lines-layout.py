# Test layout THAT (Chromium qua playwright; can `pip install playwright && playwright install chromium`): 'Tung doan' phai co chu rong >100px, nut nam trong panel.
# Dung lai bug 2026-11-14: .pk-tpl-line xep chu + 2 nut 1 hang -> chu rong 0px. Chay: python3 tools/test-pancake-tpl-lines-layout.py
import sys, os
from playwright.sync_api import sync_playwright
def page(css):
    line="Nhẫn kim gồm 3 biểu tượng: 1 là tỷ hưu mang ý nghĩa công việc thuận lợi, tăng vững vàng và thành quả được giữ bền lâu"
    lines=''.join(f'<div class="pk-tpl-line"><span class="pk-tpl-line-txt">{line}</span><button type="button" class="pk-btn-outline" data-lc="a|{k}">📋 Copy đoạn</button><button type="button" class="pk-btn-outline" data-li="a|{k}">➡ Chèn</button></div>' for k in range(3))
    return f'''<html><head><style>{css}</style></head><body style="background:#ddd">
<div id="pk-ai-panel"><div id="pk-ai-header"><div id="pk-ai-header-title" style="flex:1"><div>🤖 Pancake AI</div></div></div>
<div id="pk-ai-body"><div id="pk-menu-wrap"><div id="pk-menu-content"><div id="pk-tpl-body"><div id="pk-tpl-result">
<div class="pk-price-item pk-ai-suggestion-item" data-tid="a"><div class="pk-ctkm-title">TRANG SỨC NHẪN KIM VẠN LỘC</div><div>{line}</div>
<div class="pk-tpl-acts"><button type="button" class="pk-btn-outline">📋 Copy cả câu</button><button type="button" class="pk-btn-outline">➡ Chèn cả câu</button><button type="button" class="pk-btn-outline">📑 Từng đoạn (3)</button></div>
<div class="pk-tpl-lines">{lines}</div></div></div></div></div></div></div></div></body></html>'''
with sync_playwright() as p:
    b=p.chromium.launch()
    for name in ['new']:
        pg=b.new_page(viewport={'width':520,'height':900})
        pg.set_content(page(open(os.path.join(os.path.dirname(__file__),'..','extension-pancake','pancake-content.css'),encoding='utf8').read()))
        pass
        m=pg.evaluate("""()=>{const t=document.querySelector('.pk-tpl-line-txt').getBoundingClientRect(),bt=document.querySelector('.pk-tpl-line .pk-btn-outline').getBoundingClientRect(),pn=document.getElementById('pk-ai-panel').getBoundingClientRect();return {txtW:t.width,txtH:t.height,btnRight:bt.right,panelRight:pn.right}}""")
        print(name,m)
        assert m['txtW']>100 and m['btnRight']<=m['panelRight'], 'LOI: chu doan bi bop / nut tran ra ngoai panel'
        print('OK: Tung doan hien du chu, nut nam trong panel')
    b.close()

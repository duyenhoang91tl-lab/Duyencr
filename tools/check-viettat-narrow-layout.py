#!/usr/bin/env python3
# Đo LAYOUT THẬT (Chromium/Playwright) của thẻ Viết tắt CRM ở khổ điện thoại hẹp 320/360/390px — jsdom không có layout nên test-*.js không thấy lỗi nút lệch/tràn.
# Kiểm: không tràn ngang, mọi nút (📄 ✏️ 🗑 ⌨️) nằm trọn trong thẻ + màn hình, cao >=36px, cụm nút căn phải cùng 1 mép giữa các thẻ. Ảnh chụp: /tmp/vt-shot-<rộng>.png
# Chạy (cần `pip install playwright` + chromium): python3 tools/check-viettat-narrow-layout.py   — trả mã thoát 1 nếu có vấn đề.
import os, re, sys
from playwright.sync_api import sync_playwright
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
h = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
links = [l for l in re.findall(r'<link[^>]+rel="stylesheet"[^>]*>', h) if 'href="css/' in l]
blk = re.search(r'<div id="vt-section"[\s\S]*?<div id="vt-list"[^>]*></div>\s*</div>', h).group(0)
page = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="file://%s/">%s</head><body><div style="padding:8px">%s</div></body></html>' % (root, ''.join(links), blk)
open('/tmp/vt-harness.html', 'w', encoding='utf-8').write(page)
SN = [
 {"id": "a", "abbr": "chao", "keyword": "chào, hello, xin chào", "options": ["Dạ em chào chị {tên} ạ, em có thể giúp gì cho chị không ạ? Chị cần tư vấn mẫu nào ạ", "Chào anh/chị"], "scope": "team", "nhom": "Chào hỏi/Mở đầu", "images": [{"id": "IMGabcdefghijklmnopqrs", "name": "a.jpg"}], "audios": [{"id": "AUDabcdefghijklmnopqrs", "name": "v.mp3"}]},
 {"id": "b", "abbr": "gb", "keyword": "giá", "options": ["Giá nhẫn bạc từ 500k"], "scope": "me", "nhom": ""},
 {"id": "c", "abbr": "tplmau", "keyword": "", "options": ["Mẫu tin nội dung"], "scope": "team", "nhom": "Mẫu tin", "fromTpl": True, "tplId": "mt_1", "createdBy": "Duyen"},
 {"id": "d", "abbr": "viettatrataidai", "keyword": "", "options": ["x"], "scope": "team", "nhom": ""}]
JS = """() => { const vw = document.documentElement.clientWidth, res = {vw, sw: document.documentElement.scrollWidth, cards: []};
  [...document.getElementById('vt-list').children].filter(c => c.querySelector && c.querySelector('code')).forEach(card => {
    const cr = card.getBoundingClientRect(), acts = card.querySelector('.vt-acts'), ar = acts && acts.getBoundingClientRect();
    res.cards.push({abbr: card.querySelector('code').textContent, cardR: cr.right, actR: ar ? ar.right : null, nActs: card.querySelectorAll('.vt-acts').length,
      btns: [...card.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return {t: b.textContent.trim().slice(0, 12), w: r.width, h: r.height, ok: r.width > 0 && r.left >= cr.left - 1 && r.right <= cr.right + 1 && r.right <= vw + 0.5}; })}); });
  return res; }"""
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for W in (320, 360, 390):
        pg = b.new_page(viewport={"width": W, "height": 780}, device_scale_factor=2, has_touch=True, is_mobile=True)
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file://") else r.abort())
        pg.goto("file:///tmp/vt-harness.html")
        pg.evaluate("() => { window.gsUrl = 'https://gas.test/exec'; window.toast = () => {}; window.currentPhone = ''; window.allCustomers = []; }")
        pg.add_script_tag(path=os.path.join(root, 'js/57-viettat.js'))
        pg.evaluate("(sn) => { _vtSt.list = sn; _vtSt.canTeam = true; _vtSt.me = 'Duyen'; vtRender(); }", SN)
        pg.wait_for_timeout(150)
        r = pg.evaluate(JS); pg.screenshot(path='/tmp/vt-shot-%d.png' % W, full_page=True); pg.close()
        probs = []
        if r['sw'] > r['vw']: probs.append('tràn ngang %d>%d' % (r['sw'], r['vw']))
        for c in r['cards']:
            if c['nActs'] != 1: probs.append('%s: %d khung nút (phải đúng 1)' % (c['abbr'], c['nActs']))
            for x in c['btns']:
                if not x['ok']: probs.append('%s: nút %s ra ngoài thẻ/màn hình' % (c['abbr'], x['t']))
                if x['h'] < 35.5: probs.append('%s: nút %s cao %.0f<36px' % (c['abbr'], x['t'], x['h']))
            if c['actR'] is not None and abs(c['actR'] - (c['cardR'] - 11)) > 6: probs.append('%s: cụm nút không sát mép phải thẻ (lệch %.0fpx)' % (c['abbr'], c['cardR'] - 11 - c['actR']))
        print('%dpx: %s' % (W, 'OK' if not probs else '; '.join(probs))); bad += len(probs)
    b.close()
sys.exit(1 if bad else 0)

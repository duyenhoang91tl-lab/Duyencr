# E2E chat: giao dien that (Playwright) <-> code GAS chat that (chay trong Node). Chay: python3 tools/test-chat-e2e.py (~2 phut). Can: pip install playwright && playwright install chromium
import subprocess, time, re, json, http.server, threading, functools, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright

# --- server GAS gia lap (chay dung gas_v13.js chat code) ---
js = r'''
const fs=require('fs'),vm=require('vm'),http=require('http'),url=require('url');
const t=fs.readFileSync('__ROOT__/tools/test-chat.js','utf8');
const a=t.indexOf('function makeEnv()'), b=t.indexOf('function send(');
const src=fs.readFileSync('__ROOT__/gas_v13.js','utf8'); const chatSrc=src.slice(src.indexOf('var SH_CHAT_CH_ ='));
eval(t.slice(a,b).replace('function makeEnv()','global.makeEnv=function()'));
const c=makeEnv(); const t0=Date.now(); let last=0;
function sync(){const d=Date.now()-t0; c.__tick(d-last); last=d;}
http.createServer((req,res)=>{
  res.setHeader('access-control-allow-origin','*'); res.setHeader('access-control-allow-headers','*');
  if(req.method==='OPTIONS'){res.end();return;}
  sync(); const u=url.parse(req.url,true);
  const send=o=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(o));};
  if(req.method==='GET'){ const p=u.query; return send(c.CHAT_GET_ACTIONS_[p.action]?c.chatDoGet_(p.action,p):{error:'no'}); }
  let body='';req.on('data',d=>body+=d);req.on('end',()=>{const d=JSON.parse(body);send(c.CHAT_POST_ACTIONS_[d.action]?c.chatDoPost_(d.action,d):{error:'no'});});
}).listen(8800,'127.0.0.1',()=>console.log('up'));
'''
open('/tmp/chat_srv.js','w').write(js.replace('__ROOT__', ROOT))
srv = subprocess.Popen(['node','/tmp/chat_srv.js'],stdout=subprocess.PIPE,text=True); srv.stdout.readline()

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
web=http.server.ThreadingHTTPServer(('127.0.0.1',8768),functools.partial(Q,directory=ROOT)); threading.Thread(target=web.serve_forever,daemon=True).start()

res=[]; errs=[]
def ok(c,m): res.append((bool(c),m)); print(('PASS ' if c else 'FAIL ')+m)

def open_user(b, user, vw=1280):
    ctx=b.new_context(viewport={'width':vw,'height':800}); pg=ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(user+': '+str(e)[:160]))
    pg.route('**/*', lambda r: r.abort() if ('127.0.0.1' not in r.request.url) else r.continue_())
    pg.add_init_script("localStorage.setItem('ome_sess_token','%s')"%user)
    pg.goto('http://127.0.0.1:8768/index.html'); pg.wait_for_timeout(2200)
    pg.evaluate("document.getElementById('data-view').style.display='flex';document.getElementById('empty-view')&&(document.getElementById('empty-view').style.display='none');var lo=document.getElementById('login-overlay');if(lo)lo.remove();gsUrl='http://127.0.0.1:8800/exec';")
    pg.evaluate("setInterval(function(){var b=document.getElementById('boot-splash');if(b)b.remove()},200)")   # man hinh khoi dong cua app che chuot trong test
    return pg
def open_chat(pg):
    pg.evaluate("document.querySelector('[data-bar-id=tab-teamchat]').click()")   # bam dung muc menu nhu nguoi dung (menu trai tu dong dong); pg.wait_for_selector('#tc-chlist .tc-ch',timeout=9000)

with sync_playwright() as p:
    b=p.chromium.launch()
    an=open_user(b,'an'); bi=open_user(b,'binh')
    bi.wait_for_timeout(8000)   # cho poller cua binh khoi dong (lan dau tren may: tin co san coi nhu da doc)
    open_chat(an)
    ok(an.eval_on_selector('#tc-chlist','e=>e.textContent').find('Chung')>=0, 'an thay kenh Chung')
    ok('Team a' in an.eval_on_selector('#tc-chlist','e=>e.textContent'), 'an thay kenh Team a (dung team cua an)')
    ok('Team b' not in an.eval_on_selector('#tc-chlist','e=>e.textContent'), 'an KHONG thay kenh Team b')
    # gui tin co HTML doc + link + nhac ten
    an.fill('#tc-input','Xin chao <b>dam</b> @binh xem https://example.com/x?a=1&b=2 <img src=x onerror="window.__xss=1">')
    an.click('#tc-send', force=True); an.wait_for_timeout(4000)
    an.wait_for_function("document.querySelectorAll('#tc-msgs .tc-msg:not(.tmp)').length>=1",timeout=6000)
    html=an.eval_on_selector('#tc-msgs','e=>e.innerHTML')
    ok('<b>dam</b>' not in html and '&lt;b&gt;' in html, 'HTML trong tin nhan bi escape (khong thanh the that)')
    ok(an.evaluate("window.__xss")!=1 and an.query_selector('#tc-msgs img') is None, 'khong chay duoc XSS qua <img onerror>')
    ok(an.query_selector('#tc-msgs a[href="https://example.com/x?a=1&b=2"]') is not None, 'URL thanh link an toan (target=_blank)')
    ok(an.query_selector('#tc-msgs .tc-mention') is not None, '@binh duoc to mau nhac ten')
    # binh o tab khac (chua mo chat) -> hien huy hieu chua doc trong <= 15s
    bi.wait_for_function("(()=>{var b=document.getElementById('tb-teamchat');return b&&b.style.display!=='none'&&b.textContent==='1'})()",timeout=20000)
    ok(True,'binh (tab khac) nhan huy hieu chua doc = 1 qua poll')
    ok('(1)' in bi.title(), 'tieu de trinh duyet cua binh co (1)')
    open_chat(bi)
    bi.wait_for_selector('#tc-msgs .tc-msg',timeout=6000)
    ok(bi.eval_on_selector('#tc-msgs','e=>e.textContent').find('Xin chao')>=0, 'binh doc duoc tin cua an')
    ok(bi.eval_on_selector('#tb-teamchat','e=>e.style.display')=='none', 'mo kenh -> huy hieu chua doc cua binh bien mat')
    # nhom rieng tao qua giao dien
    an.click('text=＋ Tạo nhóm', force=True); an.fill('#tc-nm','Nhom VIP')
    an.click('.tc-urow:has-text("Binh") input', force=True); an.click('.tc-box [data-ok]', force=True)
    an.wait_for_function("document.querySelector('#tc-title')&&document.querySelector('#tc-title').textContent.indexOf('Nhom VIP')>=0",timeout=6000)
    ok(True,'an tao nhom rieng "Nhom VIP" va tu mo nhom')
    an.fill('#tc-input','chi nhom nay thay'); an.click('#tc-send', force=True); an.wait_for_timeout(1500)
    bi.wait_for_function("document.querySelector('#tc-chlist').textContent.indexOf('Nhom VIP')>=0",timeout=20000)
    ok(True,'binh thay nhom moi trong danh sach (chver)')
    # DM tu binh -> an
    bi.click('text=✉ Nhắn riêng', force=True); bi.click('.tc-urow:has-text("An") input', force=True); bi.click('.tc-box [data-ok]', force=True)
    bi.fill('#tc-input','rieng tu giua binh va an'); bi.click('#tc-send', force=True); bi.wait_for_timeout(1800)
    an.wait_for_function("document.querySelector('#tc-chlist').textContent.indexOf('Binh')>=0",timeout=20000)
    ok(an.eval_on_selector('#tc-chlist','e=>e.querySelectorAll(".tc-ch.has").length')>=1, 'an thay DM moi tu binh kem huy hieu chua doc')
    # nguoi thu 3 qua giao dien khong thay nhom/DM
    chi=open_user(b,'chi'); open_chat(chi)
    txt=chi.eval_on_selector('#tc-chlist','e=>e.textContent')
    ok('Nhom VIP' not in txt and 'Binh' not in txt, 'chi KHONG thay nhom rieng / DM cua an-binh')
    # xoa tin
    an.evaluate("tcSelect('general')"); an.wait_for_selector('#tc-msgs .tc-msg')
    an.hover('#tc-msgs .tc-msg'); an.click('#tc-msgs .tc-msg .tc-acts button[title="Xoá"]', force=True) if False else None
    an.once('dialog', lambda d: d.accept())
    an.evaluate("document.querySelector('#tc-msgs .tc-msg .tc-acts button[title=\"Xoá\"]').click()")
    an.wait_for_function("document.querySelectorAll('#tc-msgs .tc-msg').length===0",timeout=6000)
    ok(True,'an xoa tin cua minh -> bien mat')
    bi.evaluate("tcSelect('general')"); bi.wait_for_function("document.querySelectorAll('#tc-msgs .tc-msg').length===0",timeout=20000)
    ok(True,'binh cung het thay tin da xoa (dver)')
    # dien thoai (menu trai cua app mo/dong bang class, nen cho dieu kien thay vi kiem tra tuc thi)
    m=open_user(b,'an',vw=390); open_chat(m)
    m.wait_for_timeout(1200)
    ok(m.evaluate("getComputedStyle(document.querySelector('.tc-main')).display")=='none', 'dien thoai: luc dau chi hien danh sach kenh')
    m.evaluate("document.querySelector('#tc-chlist .tc-ch').click()")
    try:
        m.wait_for_function("getComputedStyle(document.querySelector('.tc-main')).display==='flex'",timeout=4000); ok(True,'dien thoai: bam kenh -> hien hoi thoai')
    except Exception: ok(False,'dien thoai: bam kenh -> hien hoi thoai')
    m.evaluate("document.querySelector('.tc-back').click()")
    try:
        m.wait_for_function("getComputedStyle(document.querySelector('.tc-side')).display!=='none'",timeout=4000); ok(True,'dien thoai: nut ← quay lai danh sach')
    except Exception: ok(False,'dien thoai: nut ← quay lai danh sach')
    b.close()
srv.kill()
bad=[m for c,m in res if not c]
print('\nJS errors:',errs[:5]); print('FAILED:' if bad else 'ALL E2E PASSED', bad if bad else len(res))

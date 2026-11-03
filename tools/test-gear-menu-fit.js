// Test _srFitGearMenu_ (js/12): menu ⚙ (Tac vu / Mau loc nhanh) khong duoc tran ra ngoai man hinh dien thoai.
// jsdom khong co bo cuc nen gia lap getBoundingClientRect theo style.left/right/max-width that ma ham dat. Chay: NODE_PATH=<jsdom> node tools/test-gear-menu-fit.js
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '12-fn-rendersalesreporttabe.js'), 'utf8');
const i = src.indexOf('function _srFitGearMenu_(el){'), j = src.indexOf('function closeGearMenus(){');
if (i < 0 || j < 0) throw new Error('thieu _srFitGearMenu_');
let ok = 0, fail = 0; const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };

function scene({ vw, hostLeft, hostW, menuW, wrapLeft }) {
  const dom = new JSDOM('<body><div id="wrap" style="overflow-x:hidden"><div class="gear-menu" id="h"><button>x</button><div class="gear-menu-list" id="m" style="display:block"></div></div></div></body>', { runScripts: 'outside-only' });
  const w = dom.window, D = w.document, h = D.getElementById('h'), m = D.getElementById('m'), wrap = D.getElementById('wrap');
  Object.defineProperty(D.documentElement, 'clientWidth', { value: vw, configurable: true });
  if (wrapLeft === undefined) wrap.style.overflowX = '';                      // khong co khung cuon cha
  h.getBoundingClientRect = () => ({ left: hostLeft, right: hostLeft + hostW, width: hostW, top: 0, bottom: 20, height: 20 });
  wrap.getBoundingClientRect = () => ({ left: wrapLeft || 0, right: vw, width: vw - (wrapLeft || 0), top: 0, bottom: 800, height: 800 });
  m.getBoundingClientRect = () => {                                           // mo phong: width = min(menuW, max-width); left theo style.left (px) hoac can phai nut (right:0)
    const mw = m.style.maxWidth ? Math.min(menuW, parseFloat(m.style.maxWidth)) : menuW;
    const left = (m.style.left && m.style.left !== 'auto') ? hostLeft + parseFloat(m.style.left) : hostLeft + hostW - mw;
    return { left, right: left + mw, width: mw, top: 20, bottom: 300, height: 280 };
  };
  const fit = new w.Function('document', 'window', src.slice(i, j) + '\nreturn _srFitGearMenu_;')(D, w);
  return { m, fit, rect: () => m.getBoundingClientRect() };
}
// 1) Dien thoai 360px, nut sat mep trai (12..82): can phai -> left am -> phai keo vao
let S = scene({ vw: 360, hostLeft: 12, hostW: 70, menuW: 250 }); const before = S.rect().left; S.fit(S.m);
t('dien thoai: truoc khi sua menu tran ra ngoai mep trai (left=' + before + ')', before < 0);
t('dien thoai: sau khi sua menu nam tron trong man hinh (left=' + S.rect().left + ', right=' + S.rect().right + ')', S.rect().left >= 8 && S.rect().right <= 352);
t('dien thoai: chua le 8px o mep trai', Math.abs(S.rect().left - 8) < 0.01);
// 2) Menu vua san (nut gan mep phai): giu nguyen can phai nhu cu (khong dat left/right)
S = scene({ vw: 360, hostLeft: 280, hostW: 70, menuW: 250 }); S.fit(S.m);
t('menu da vua: KHONG doi cach can (left/right rong)', S.m.style.left === '' && S.m.style.right === '' && S.rect().left === 100);
// 3) Menu rong hon man hinh: thu max-width + ve mep trai
S = scene({ vw: 360, hostLeft: 100, hostW: 70, menuW: 500 }); S.fit(S.m);
t('menu rong hon man hinh: max-width = 344 va nam gon', S.m.style.maxWidth === '344px' && S.rect().left >= 8 && S.rect().right <= 352);
// 4) Khung cuon cha (overflow-x:hidden) lech trai 40px: khong tran ra ngoai khung
S = scene({ vw: 800, hostLeft: 50, hostW: 70, menuW: 250, wrapLeft: 40 }); S.fit(S.m);
t('khung cha lech trai 40: menu khong thoat khoi khung (left>=48)', S.rect().left >= 48);
// 5) Nut tran ra mep phai: keo vao mep phai
S = scene({ vw: 360, hostLeft: 300, hostW: 80, menuW: 250 }); S.fit(S.m);
t('nut sat mep phai: menu khong qua 352', S.rect().right <= 352 && S.rect().left >= 8);
// 6) Mo lai nhieu lan: moi lan do lai tu mac dinh, ket qua on dinh
S = scene({ vw: 360, hostLeft: 12, hostW: 70, menuW: 250 }); S.fit(S.m); const a = S.rect().left; S.fit(S.m); S.fit(S.m);
t('goi lai nhieu lan van cho ket qua nhu nhau', S.rect().left === a);
// 7) Man hinh may tinh: nut o giua rong rai -> khong dung vao gi
S = scene({ vw: 1400, hostLeft: 800, hostW: 90, menuW: 250 }); S.fit(S.m);
t('may tinh rong: khong doi', S.m.style.left === '' && S.m.style.right === '');
console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);

// Test CRM client: thong bao 'resale' (KH mua lai o sale khac) hien nhu su kien + bam mo modal don cua khach. Chay: node tools/test-nt-resale.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '39-fn-notify.js'), 'utf8');
const fn = n => { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('khong thay ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
let fail = 0; const t = (n, v) => { console.log((v ? 'OK   ' : 'FAIL ') + n); if (!v) fail++; };
// DOM gia toi thieu
const els = {}; const mk = (id) => { const e = { id, classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); } }, listeners: {}, addEventListener(ev, f) { this.listeners[ev] = f; }, innerHTML: '', set className(v) {}, onclick: null }; els[id] = e; return e; };
const body = { appendChild: (e) => {} }; const toasts = [], opened = [], marks = [];
let fetchUrl = null, fetchResp = null;
const ctx = { esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), fmt: n => (n || 0).toLocaleString('vi-VN'),
  gsUrl: 'http://gas/exec', toast: m => toasts.push(m), openDp: p => opened.push(p), customerMap: { '0901234567': {} },
  document: { getElementById: id => els[id] || null, createElement: () => { const e = mk('__tmp'); delete els['__tmp']; return e; }, body: { appendChild: (e) => { els[e.id] = e; } }, addEventListener() {} },
  fetch: (u) => { fetchUrl = u; return Promise.resolve({ json: () => Promise.resolve(fetchResp) }); }, encodeURIComponent };
ctx._ntItems = [{ id: 'n1', kind: 'resale', refType: 'resale', refId: '0901234567', refId2: '2026-10-28', text: 'Khách Chị Lan đang mua lại đơn doanh thu 3.500.000đ tại kênh Page B, Sale dungnguyen1995 bán', read: true }];
ctx._ntMark = () => {}; ctx.ntClose = () => {};
vm.createContext(ctx);
vm.runInContext(['_ntIsTaskEvt', '_ntTaskIcon', '_ntRsDate_', '_ntRsHtml_', '_ntOpenResale_', 'ntOpenItem'].map(fn).join('\n') + '\n', ctx);
// ntOpenItem dung element tao boi _ntOpenResale_ -> khoi tao qua createElement gia: ghi id sau khi gan innerHTML
const origCreate = ctx.document.createElement; ctx.document.createElement = () => { const e = mk('nt-rs-overlay'); return e; };
const origAppend = ctx.document.body.appendChild;
ctx.document.body.appendChild = (e) => { els['nt-rs-body'] = mk('nt-rs-body'); els['nt-rs-open'] = mk('nt-rs-open'); els['nt-rs-close'] = mk('nt-rs-close'); };

t('resale hien nhu su kien (text day du) + icon rieng', ctx._ntIsTaskEvt({ kind: 'resale' }) === true && ctx._ntTaskIcon({ kind: 'resale' }) === '🔁' && ctx._ntIsTaskEvt({ kind: 'note' }) === false);

// HTML: dung vi du Duyen — khach co don cu (sale A) va don moi (sale B)
const orders = [{ date: '2026-10-28', product: 'Nhẫn vàng', qty: '1', revenue: 3500000, source: 'Page B', status: '', sale: 'dungnguyen1995', note: '' },
  { date: '2026-10-10', product: 'Lắc tay', qty: '1', revenue: 2000000, source: 'Page A', status: 'Đang giao hàng', sale: 'anhNP1999', note: 'x<script>' }];
const html = ctx._ntRsHtml_(orders, '2026-10-28', 'TEXT');
t('tong don moi + tong tien dung (1 dong, 3.500.000đ)', /1 dòng, tổng <b>3\.500\.000đ<\/b>/.test(html));
t('chi don ngay 28/10 duoc to sang + the MOI, don cu thi khong', (html.match(/nt-rs-new/g) || []).length === 1 && (html.match(/>MỚI</g) || []).length === 1 && html.indexOf('28/10/2026 <span') > 0);
t('hien du kenh + sale cua ca 2 don (sale cu xem duoc don do sale khac ban)', /Page B/.test(html) && /dungnguyen1995/.test(html) && /anhNP1999/.test(html) && /Page A/.test(html));
t('chong XSS trong ghi chu', html.indexOf('<script>') < 0 && html.indexOf('x&lt;script&gt;') > 0);
t('khong co don -> bao khong thay (khong vo)', /Không tìm thấy đơn/.test(ctx._ntRsHtml_([], '2026-10-28', 'T')));

// Bam thong bao -> goi dung API + hien modal
fetchResp = { ok: true, orders };
ctx.ntOpenItem('n1');
t('bam thong bao -> goi donOrdersByPhone dung SDT', fetchUrl === 'http://gas/exec?action=donOrdersByPhone&phone=0901234567');
t('modal mo (class open) + dang tai', els['nt-rs-overlay'].classList.contains('open') && /Đang tải/.test(els['nt-rs-body'].innerHTML));
setTimeout(() => {
  t('sau khi tai xong: modal co cau thong bao + bang don', /Khách Chị Lan đang mua lại đơn doanh thu 3\.500\.000đ tại kênh Page B/.test(els['nt-rs-body'].innerHTML) && /nt-rs-tbl/.test(els['nt-rs-body'].innerHTML));
  els['nt-rs-open'].onclick();
  t('nut "Mo ho so khach" -> dong modal + openDp(SDT)', opened[0] === '0901234567' && !els['nt-rs-overlay'].classList.contains('open'));
  // loi tu server
  fetchResp = { ok: false, error: 'Khach nay khong thuoc pham vi cua ban.' };
  ctx.ntOpenItem('n1');
  setTimeout(() => {
    t('server tu choi -> hien loi, van hien cau thong bao', /không thuộc|khong thuoc/.test(els['nt-rs-body'].innerHTML) && /Khách Chị Lan/.test(els['nt-rs-body'].innerHTML));
    console.log(fail ? 'FAILED ' + fail : 'ALL NT RESALE TESTS PASSED'); process.exit(fail ? 1 : 0);
  }, 20);
}, 20);

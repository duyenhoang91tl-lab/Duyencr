#!/usr/bin/env node
// Test: SDT/ten khach trong bang don bam duoc -> mo ho so khach (Duyen yeu cau 2026-10-23: "cho nao check don deu mo duoc ho so khach khi co ma don, sdt").
// Chay: NODE_PATH=<noi cai jsdom>/node_modules node tools/test-cust-link.js -> "CUST LINK TESTS PASSED"
const fs = require('fs'), path = require('path'); const { JSDOM } = require('jsdom');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const dom = new JSDOM('<body><table><tbody><tr id="row"><td id="cell"></td></tr></tbody></table></body>', { runScripts: 'dangerously' });
  const w = dom.window, log = { open: [], pull: [], toast: [], row: 0 };
  w.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  w.normPhone = s => String(s || '').replace(/\D/g, ''); w.toast = m => log.toast.push(m);
  w.customerMap = { '0901111222': { phone: '0901111222' } };
  w.openDp = p => log.open.push(p);
  w._pullSearchCustomer_ = async p => { log.pull.push(p); w.customerMap[p] = { phone: p }; return p; };
  const src = rd('29-sidenav.js'); w.eval(src.slice(src.indexOf('async function _openCustomerByPhone_')));
  // dong co onclick cha (vd mo popup don) — bam SDT KHONG duoc kich hoat onclick cha
  w.document.getElementById('row').addEventListener('click', () => log.row++);
  w.document.getElementById('cell').innerHTML = w._custLinkHtml_('0901111222', 'Bich <b>0901111222</b>');
  w.document.querySelector('.cust-link b').click(); await sleep(10);
  ok(log.open[0] === '0901111222' && log.row === 0, 'bam trong SDT mo ho so, khong kich hoat dong cha: ' + JSON.stringify(log));
  // khach ngoai danh sach -> nap rieng roi mo
  w.document.getElementById('cell').innerHTML = w._custLinkHtml_('0909999999', 'X'); w.document.querySelector('.cust-link').click(); await sleep(10);
  ok(log.pull[0] === '0909999999' && log.open[1] === '0909999999', 'khach ngoai pham vi: nap roi mo');
  // khong co SDT -> chu thuong (khong link)
  ok(w._custLinkHtml_('', 'abc') === 'abc' && w._custLinkHtml_(null, 'abc') === 'abc' && w._custLinkHtml_('12', 'abc') === 'abc', 'khong SDT hop le => khong thanh link');
  // demo-mode khong nap ngoai danh sach
  w.document.body.classList.add('demo-mode'); await w._openCustomerByPhone_('0908888888');
  ok(log.pull.length === 1 && log.open.length === 2 && log.toast.length === 1, 'demo-mode chi mo khach co san');
  // bang chi tiet doi soat M (js/50 that): cot Ten KH + SDT la link; dong khong SDT khong loi
  global._custLinkHtml_ = w._custLinkHtml_;
  const sp = require(path.join(__dirname, '..', 'js', '50-split-orders.js'));
  const det = { from: '2026-10-01', to: '2026-10-31', summary: { baseOrders: 1, baseTotal: 100, baseShare: 50 }, base: [{ date: '2026-10-01', month: '10', name: 'Bich', phone: '0901111222', code: '1011T09/2026', sales: 'a', product: 'p', total: 100, share: 50 }, { date: '2026-10-02', month: '10', name: 'Khong sdt', phone: '', code: 'X1', sales: 'a', product: 'p', total: 10, share: 5 }] };
  const html = sp.splitDetailPanelHtml_({ tab: 'base', sale: 'a', data: det });
  ok((html.match(/data-cust-phone="0901111222"/g) || []).length === 2, 'Ten KH + SDT deu la link (2 o)');
  ok(!/data-cust-phone=""/.test(html) && /Khong sdt/.test(html), 'dong khong SDT hien chu thuong');
  // static: cac cho khac da dung helper
  const has = (f, re, m) => ok(re.test(rd(f)), m);
  has('11-fn-srload.js', /_custLinkHtml_\(o\.soDienThoai/, 'check nguoc Base');
  has('11-fn-srload.js', /_custLinkHtml_\(r\.phone, esc\(r\.name\)\)/, 'bang khach dRows');
  has('11-fn-srload.js', /_custLinkHtml_\(r\.phone, '<b>'\+esc\(r\.tenKh/, 'bao cao lich hen/L');
  has('23-opendupordersmodal.js', /_custLinkHtml_\(row\.phone/, 'don trung');
  console.log('CUST LINK TESTS PASSED'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

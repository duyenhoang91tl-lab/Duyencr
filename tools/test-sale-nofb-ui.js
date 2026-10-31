// Test web: muc "Doanh thu theo Sale — loai kenh Facebook" (js/11 _srSaleNoFbHtml_). Chay: node tools/test-sale-nofb-ui.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
function grab(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } }
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const charts = [];
const ctx = { _srState: { saleSearch: '' }, esc: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), fmt: n => (n || 0).toLocaleString('vi-VN'), _srMoney: n => (n || 0).toLocaleString('vi-VN') + 'đ',
  _srViewToggleHtml: k => '[toggle:' + k + ']', _srTotalRowHtml_: c => '<tr class="tot">' + c.join('|') + '</tr>', _srChartSvg: (rows, n, v, view, mf, ok2, opts) => { charts.push({ rows, view, opts }); return '<svg data-view="' + view + '"></svg>'; } };
vm.createContext(ctx); vm.runInContext(grab('_srSaleNoFbHtml_'), ctx);
const F = vm.runInContext('_srSaleNoFbHtml_', ctx);
const d = { bySaleNoFb: [{ name: 'A', orders: 2, giaTri: 700000, trungBinhDon: 350000 }, { name: 'B', orders: 1, giaTri: 200000, trungBinhDon: 200000 }], noFb: { kenh: ['facebook'], excludedOrders: 2, excludedRevenue: 1300000, keptOrders: 2, keptRevenue: 900000 } };
let h = F(d);
ok(/Doanh thu theo Sale/.test(h) && /loại kênh “Facebook”/.test(h) && /\[toggle:aSaleNoFbView\]/.test(h), 'tieu de + nut Bang/Tron/Cot (khoa aSaleNoFbView rieng, khong dung chung voi bang tren)');
ok(/<td>A<\/td><td style="text-align:right">2<\/td><td style="text-align:right"><b>700\.000đ<\/b>/.test(h) && /<td>B<\/td>/.test(h), 'mac dinh dang bang: tung sale + so don + doanh thu');
ok(/Tổng\|3\|900\.000đ\|300\.000đ/.test(h), 'dong Tong: 3 luot don, 900.000đ, TB 300.000đ');
ok(/Đã loại khỏi mục này: <b>2 đơn<\/b>, <b>1\.300\.000đ<\/b> của kênh “Facebook”/.test(h) && /Facebook Phạm Thu Hiền/.test(h), 'ghi chu so don/tien da loai + nhac "Facebook Pham Thu Hien" van tinh');
ctx._srState.saleSearch = 'b'; h = F(d); ok(/<td>B<\/td>/.test(h) && !/<td>A<\/td>/.test(h), 'o tim nhanh theo ten sale loc duoc muc nay');
ctx._srState.saleSearch = 'zzz'; ok(/Không có dữ liệu/.test(F(d)), 'khong khop -> "Khong co du lieu"');
ctx._srState.saleSearch = ''; ctx._srState.aSaleNoFbView = 'pie'; h = F(d); ok(/data-view="pie"/.test(h) && charts[0].rows.length === 2 && /không gồm kênh Facebook/.test(charts[0].opts.ordersLabel), 'che do Tron: ve bieu do voi dung du lieu');
ctx._srState.aSaleNoFbView = 'bar'; ok(/data-view="bar"/.test(F(d)), 'che do Cot');
ok(/Chưa có số liệu mục này — máy chủ \(GAS\) chưa cập nhật/.test(F({})) && /Chưa có số liệu/.test(F(null)), 'GAS cu (chua co bySaleNoFb) -> bao ro ly do, khong vo trang');
h = F({ bySaleNoFb: [{ name: '<b>x</b>', orders: 1, giaTri: 1, trungBinhDon: 1 }], noFb: d.noFb }); ctx._srState.aSaleNoFbView = 'table'; h = F({ bySaleNoFb: [{ name: '<b>x</b>', orders: 1, giaTri: 1, trungBinhDon: 1 }], noFb: d.noFb }); ok(h.indexOf('<b>x</b>') < 0 && h.indexOf('&lt;b>x') > 0, 'chong XSS ten sale');
ok(/saleHtml\+_srSaleNoFbHtml_\(d\)\+'<\/div>'/.test(src), '_srRenderA gan muc moi NGAY DUOI saleHtml (cot trai)');
ok(/js\/11-fn-srload\.js\?v=20261031a/.test(fs.readFileSync(__dirname + '/../index.html', 'utf8')), 'index.html da doi ?v= cua js/11');
process.exit(fail ? 1 : 0);

// Test giao dien Thuong phat doi Sale (js/60-team-bonus.js) — 2026-10-30. Chay: NODE_PATH=<noi co jsdom> node tools/test-team-bonus-ui.js
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const dom = new JSDOM('<body><div id="host"></div></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
const w = dom.window;
const reqs = [];
let resp = null;
w.fetch = async (u, o) => { reqs.push({ u, o }); const r = typeof resp === 'function' ? resp(u, o) : resp; return { text: async () => JSON.stringify(r) }; };
w.localStorage.setItem('ome_sess_token', 'TOK123');
w.eval('var gsUrl = "https://gs.example/exec"; var _srState = {};');
w.eval(R('js/60-team-bonus.js'));
w.confirm = () => true; w.alert = () => {};
const cfg = { dailyMinOrders: 6, dailyReward: 50000, weeklyReward: 50000, monthlyReward: 100000, penalties: [
  { type: 1, label: 'Tin trôi', amount: 50000 }, { type: 2, label: 'BC', amount: 50000 }, { type: 3, label: 'Đọc', amount: 50000 }, { type: 4, label: 'Đơn gộp', amount: 200000 }, { type: 5, label: 'Mong cầu', amount: 50000 }] };
const D = { ok: true, month: '2026-10', today: '2026-10-20', cfg, canEdit: true, seeAll: true, team: [{ name: 'Hoa', group: 'online' }, { name: 'Nam<b>', group: 'offline' }],
  daily: [{ date: '2026-10-19', partial: false, top: 7, qualified: true, winners: [{ name: 'Hoa', orders: 7 }], list: [{ name: 'Hoa', orders: 7 }, { name: 'Nam<b>', orders: 5 }], excluded: 3 },
          { date: '2026-10-20', partial: true, top: 4, qualified: false, winners: [], list: [{ name: 'Hoa', orders: 4 }], excluded: 0 }],
  weekly: [{ from: '2026-10-12', to: '2026-10-18', effTo: '2026-10-18', partial: false, label: '12/10 – 18/10', avgHeld: 113.3, noData: false,
    rows: [{ name: 'Hoa', held: 200, closed: 30, closeRate: 15, eligible: true }, { name: 'Mai', held: 40, closed: 20, closeRate: 50, eligible: false }], winners: [{ name: 'Hoa', held: 200, closed: 30, closeRate: 15 }] }],
  monthly: { from: '2026-10-01', to: '2026-10-31', effTo: '2026-10-20', partial: true, avgHeld: 300, noData: false, rows: [{ name: 'Hoa', held: 600, closed: 90, closeRate: 15, eligible: true }], winners: [{ name: 'Hoa', held: 600, closed: 90, closeRate: 15 }] },
  rewards: [], penalties: [{ id: 'p1', date: '2026-10-05', sale: 'Hoa', type: 4, amount: 200000, note: '<script>x</script>', by: 'Admin', at: '' }],
  totals: [{ name: 'Hoa', reward: 50000, penalty: 200000, net: -150000, dayWins: 1, weekWins: 0, monthWins: 0, penaltyCount: 1 }, { name: 'Nam<b>', reward: 0, penalty: 0, net: 0, dayWins: 0, weekWins: 0, monthWins: 0, penaltyCount: 0 }] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // panel tu tai lan dau
  resp = D;
  w.document.getElementById('host').innerHTML = w.eval('_tbPanelHtml_()');
  await sleep(50);
  ok(reqs.length === 1 && /action=teamBonusReport/.test(reqs[0].u) && /month=\d{4}-\d{2}/.test(reqs[0].u) && /token=TOK123/.test(reqs[0].u), 'lan dau tu goi teamBonusReport kem month + token');
  const body = () => w.document.getElementById('tb-body').innerHTML;
  ok(/Tổng hợp/.test(body()) && body().includes('−150.000₫') && body().includes('−200.000₫'), 'tong hop: thuong - phat = thuc nhan am hien dung dau tru');
  ok(!/<b>'/.test(body()) && body().includes('Nam&lt;b&gt;'), 'ten sale duoc escape (chong chen HTML)');
  // tab thuong ngay
  w.eval("_tbTab('day')");
  ok(body().includes('19/10') && body().includes('Hoa') && /tạm tính/.test(body()) && /chưa đủ 6 đơn/.test(body()), 'tab ngay: nguoi dat, ngay hom nay tam tinh, chua du 6 don');
  // tab tuan/thang
  w.eval("_tbTab('period')");
  ok(/THÁNG 2026-10/.test(body()) && /tạm tính đến 20\/10/.test(body()) && /TUẦN 12\/10 – 18\/10/.test(body()) && /🏆 Hoa/.test(body()) && /tương tác &lt; TB 113.3|tương tác < TB 113.3/.test(body()), 'tab tuan/thang: thang tam tinh, tuan, cup nguoi dan dau, ly do khong du dieu kien');
  ok(!/→ 100.000₫/.test(body()) && /→ 50.000₫/.test(body()), 'tuan da ket thuc ghi tien 50k; thang tam tinh chua ghi tien');
  // tab phat (admin): form + chong XSS ghi chu + xoa
  w.eval("_tbTab('pen')");
  ok(!!w.document.getElementById('tb-f-sale') && w.document.getElementById('tb-f-type').options.length === 5, 'admin: co form ghi phat voi 5 loai');
  ok(body().includes('&lt;script&gt;x&lt;/script&gt;') && !/<script>x/.test(body()), 'ghi chu phat duoc escape');
  reqs.length = 0;
  w.document.getElementById('tb-f-sale').value = 'Hoa'; w.eval("_tbState.form.sale='Hoa'; _tbState.form.type='4'; _tbState.form.date='2026-10-19'");
  resp = (u, o) => (o && o.method === 'POST' ? { ok: true, id: 'p9' } : D);
  await w.eval('_tbSavePenalty()');
  const post = reqs.find(r => r.o && r.o.method === 'POST'), pb = post && JSON.parse(post.o.body);
  ok(pb && pb.action === 'teamPenaltySave' && pb.token === 'TOK123' && pb.sale === 'Hoa' && pb.type === 4 && pb.date === '2026-10-19' && pb.amount === '', 'ghi phat: gui dung action/token/sale/loai/ngay, so tien trong = mac dinh');
  ok(reqs.some(r => /action=teamBonusReport/.test(r.u) && /nocache=1/.test(r.u)), 'sau khi ghi tu tai lai (bo cache)');
  reqs.length = 0;
  await w.eval("_tbDeletePenalty('p1')");
  const del = reqs.find(r => r.o && r.o.method === 'POST'), db = del && JSON.parse(del.o.body);
  ok(db && db.action === 'teamPenaltyDelete' && db.id === 'p1', 'xoa phat gui dung id');
  // loi tu may chu
  resp = { ok: false, code: 'FORBIDDEN', error: 'Chi admin duoc ghi/xoa nhat ky phat.' };
  await w.eval('_tbSavePenalty()');
  ok(/Chi admin duoc ghi/.test(body()), 'loi may chu hien ra cho nguoi dung, khong nuot');
  // nguoi thuong: khong co form/xoa
  resp = Object.assign({}, D, { canEdit: false, seeAll: false });
  await w.eval('_tbLoad(true)'); w.eval("_tbTab('pen')");
  ok(!w.document.getElementById('tb-f-sale') && !/🗑/.test(body()), 'nguoi khong phai admin: khong co form ghi / nut xoa');
  // loi tai du lieu lan dau
  w.eval('_tbState.data=null; _tbState.err=""'); resp = { ok: false, error: 'Ban khong co quyen xem muc nay', code: 'FORBIDDEN' };
  await w.eval('_tbLoad(false)');
  ok(/Ban khong co quyen/.test(body()) && /Thử lại/.test(body()), 'khong du quyen xem: hien thong bao + nut thu lai');
  // xuat Excel: dung dung cac so cua panel
  resp = D; await w.eval('_tbLoad(true)');
  const X = w.eval('_tbExportRows_(_tbState.data)');
  ok(X.sum.length === 3 && X.sum[1][0] === 'Hoa' && X.sum[1][7] === 200000 && X.sum[1][9] === -150000, 'xuat: tong hop co thuong/phat/thuc nhan');
  ok(X.day.length === 3 && X.day[2][1] === 'Tạm tính' && X.day[1][1] === 'Đạt' && X.day[1][2] === 'Hoa' && X.day[1][6] === 50000 && X.day[2][6] === 0, 'xuat: ngay tam tinh khong co tien, ngay da ket thuc 50k');
  ok(X.per.some(r => r[0] === 'Tuần' && r[3] === 'Hoa' && r[10] === 50000) && X.per.some(r => r[0] === 'Tháng' && r[2] === 'Tạm tính' && r[10] === 0), 'xuat: tuan da ket thuc 50k, thang tam tinh 0');
  ok(X.pen.length === 2 && X.pen[1][4] === 200000 && X.rule.length === 9, 'xuat: nhat ky phat + 4 dong thuong/5 dong phat trong quy dinh');
  let saved = null; w.XLSX = { utils: { book_new: () => ({ s: [] }), aoa_to_sheet: a => a, book_append_sheet: (b, s, n) => b.s.push(n) }, writeFile: (b, n) => { saved = { b, n }; } };
  w.eval('_tbExportXlsx()');
  ok(saved && saved.n === 'ThuongPhat_DoiSale_2026-10.xlsx' && saved.b.s.join(',') === 'Tong hop,Thuong ngay,Thuong tuan-thang,Nhat ky phat,Quy dinh', 'xuat: ten file + 5 sheet');
  ok(/onclick="_tbExportXlsx\(\)"/.test(w.eval('_tbPanelHtml_()')), 'panel co nut Xuat Excel');
  // moc ma nguon: gan vao bao cao B, sau cac muc cua B
  const s11 = R('js/11-fn-srload.js'), idx = R('index.html');
  ok(/html \+= _tbPanelHtml_\(\);[^\n]*\n\s*html \+= _srBaseCheckPanelHtml_\(d\);/.test(s11), 'js/11: _srRenderB gan panel truoc muc check Base');
  ok(/js\/60-team-bonus\.js\?v=/.test(idx) && idx.indexOf('js/60-team-bonus.js') > idx.indexOf('js/11-fn-srload.js'), 'index.html nap js/60 sau js/11 co ?v=');
  process.exit(fail ? 1 : 0);
})();

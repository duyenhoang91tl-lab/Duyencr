// Test UI ⚙ Cau hinh: thoi gian bao sale cu khi khach mua lai (js/37). Chay: node tools/test-cfg-resale-ui.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', '37-fn-configpage.js'), 'utf8');
let fail = 0; const t = (n, v) => { console.log((v ? 'OK   ' : 'FAIL ') + n); if (!v) fail++; };
const a = src.indexOf('// ── THÔNG BÁO KHÁCH MUA LẠI'), b = src.indexOf("// ── TỪ CẤM (Settings 'bannedWordsCfg')");
t('tim thay khoi code that', a > 0 && b > a);
t('da noi vao _cfgLoad (key) va _cfgRender', src.includes("'bannedWordsCfg', 'resaleNotifyLookback'") && src.includes('_cfgResaleHtml_() +') && src.includes('_cfgResaleApply_(v.resaleNotifyLookback)'));
const els = { 'cfg-rs-days': { value: '90' }, 'cfg-rs-save': {} }, calls = [], toasts = []; let resp = {}, renders = 0;
const ctx = { esc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), gsUrl: 'http://gas', currentUser: { name: 'Duyên' }, _cfgRender() { renders++; }, toast: m => toasts.push(m),
  document: { getElementById: id => els[id] || null }, fetch: (u, o) => { calls.push(JSON.parse(o.body)); return Promise.resolve({ json: () => Promise.resolve(resp) }); } };
vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
t('mac dinh 60 ngay (2 thang)', ctx._cfgResaleDays === 60 && /60 ngày ≈ 2 tháng/.test(ctx._cfgResaleLabel_(60)));
ctx._cfgResaleApply_('120'); t('nap 120 tu server', ctx._cfgResaleDays === 120);
ctx._cfgResaleApply_('3'); t('server tra gia tri sai (<7) -> ve 60', ctx._cfgResaleDays === 60);
ctx._cfgResaleApply_(undefined); t('chua cai dat -> 60', ctx._cfgResaleDays === 60);
const h = ctx._cfgResaleHtml_(); t('HTML co o nhap, gia tri hien tai, nut nhanh 30/60/90/180/365, nut luu', /id="cfg-rs-days"[^>]*value="60"/.test(h) && /90 ngày<\/button>/.test(h) && /365 ngày<\/button>/.test(h) && /_cfgResaleSave\(\)/.test(h));
(async () => {
  await ctx._cfgResaleSave();
  t('luu 90: gui setSetting dung key + gia tri, ghi nhat ky', calls[0].action === 'setSetting' && calls[0].key === 'resaleNotifyLookback' && calls[0].value === '90' && calls[1].action === 'saveAudit' && calls[1].rows[0].oldValue === '60 ngày' && calls[1].rows[0].newValue === '90 ngày');
  t('luu xong cap nhat gia tri + ve lai man hinh', ctx._cfgResaleDays === 90 && renders === 1);
  calls.length = 0; els['cfg-rs-days'].value = '5'; await ctx._cfgResaleSave();
  t('nhap 5 (<7) -> bao loi, KHONG gui', calls.length === 0 && /từ 7 đến 1500/.test(toasts.pop()));
  els['cfg-rs-days'].value = 'abc'; await ctx._cfgResaleSave(); t('nhap chu -> khong gui', calls.length === 0);
  els['cfg-rs-days'].value = '60.5'; await ctx._cfgResaleSave(); t('so le 60.5 -> lam tron xuong 60 va gui', calls.length >= 1 && calls[0].value === '60');
  calls.length = 0; await ctx._cfgResaleSave(true);
  t('Ve mac dinh -> gui 60', calls[0].value === '60' && ctx._cfgResaleDays === 60);
  resp = { error: 'Chi admin (da dang nhap) moi duoc sua' }; calls.length = 0; els['cfg-rs-days'].value = '100'; await ctx._cfgResaleSave();
  t('khong phai admin -> bao loi, KHONG doi gia tri o may', ctx._cfgResaleDays === 60 && /Lưu lỗi/.test(toasts.pop()));
  console.log(fail ? 'FAILED ' + fail : 'ALL CFG RESALE UI TESTS PASSED'); process.exit(fail ? 1 : 0);
})();

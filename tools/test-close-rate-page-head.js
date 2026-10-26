// Test: tieu de cot bang "Ty le chot theo Sale — tung Page" hien ty le chot CHUNG cua tung Page (2026-10-25). Ham THAT trong js/11-fn-srload.js.
const fs = require('fs'); let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const src = fs.readFileSync(__dirname + '/../js/11-fn-srload.js', 'utf8');
function fn(name) { const i = src.indexOf('function ' + name + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const api = new Function('esc', fn('_srPageTotals_') + '\n' + fn('_srPageThHtml_') + '\nreturn { _srPageTotals_, _srPageThHtml_ };')(s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'));
// so lieu theo anh Duyen gui: 2 sale, 3 page
const scbp = { pages: [{ kenhBan: 'K1', pageName: 'HIỂN PHẠM TOURMALINE' }, { kenhBan: 'K2', pageName: 'HIỂN TOUR SHOP' }, { kenhBan: 'K3', pageName: 'Page chưa ai chốt' }],
  rows: [{ name: 'thanhNP', perPage: { K1: { closed: 1, held: 43, rate: 2.3 }, K3: { closed: 0, held: 0 } }, total: { closed: 2, held: 57, rate: 3.5 } },
         { name: 'trangNH2005', perPage: { K1: { closed: 2, held: 130, rate: 1.5 }, K2: { closed: 0, held: 18, rate: 0 } }, total: { closed: 9, held: 304, rate: 3 } }] };
const T = api._srPageTotals_(scbp);
ok(T.pages[0].closed === 3 && T.pages[0].held === 173 && T.pages[0].rate === 1.7, 'Page K1: (1+2)/(43+130) = 3/173 = 1.7% (cong don + cong tuong tac cua MOI sale)');
ok(T.pages[1].closed === 0 && T.pages[1].held === 18 && T.pages[1].rate === 0, 'Page K2: 0/18 = 0%');
ok(T.pages[2].held === 0 && T.pages[2].rate === 0, 'Page khong co tuong tac: held 0, khong chia cho 0');
ok(T.all.closed === 11 && T.all.held === 361 && T.all.rate === 3, 'Tong chung: 11/361 = 3%');
const h = api._srPageThHtml_(scbp);
ok(/HIỂN PHẠM TOURMALINE<div[^>]*>1\.7% <span[^>]*>\(3\/173\)<\/span><\/div>/.test(h), 'tieu de cot K1 hien "1.7% (3/173)" ngay duoi ten Page');
ok(/Page chưa ai chốt<div[^>]*>—<\/div>/.test(h), 'Page khong co du lieu hien dau —');
ok(/Tổng cá nhân<\/b><div[^>]*>3% <span[^>]*>\(11\/361\)/.test(h), 'cot "Tong ca nhan" hien ty le chung 3% (11/361)');
ok((h.match(/<th/g) || []).length === 4, '4 o tieu de (3 Page + Tong ca nhan), khong them cot');
ok(api._srPageThHtml_({ pages: [{ kenhBan: 'X', pageName: '<b>x' }], rows: [] }).indexOf('<b>x') < 0, 'ten Page duoc escape HTML');
// ca 2 bang (Bao cao A + B) deu dung ham chung, khong con tieu de cu
ok((src.match(/_srPageThHtml_\(scbp/g) || []).length === 3 && !/esc\(p\.pageName\)\+'<\/th>'; \}\)\.join\(''\)\+\n\s+'<th style="text-align:right"><b>Tổng cá nhân<\/b><\/th>/.test(src), 'Bao cao A va B deu dung _srPageThHtml_');
console.log(bad ? 'FAILED ' + bad : 'ALL PASS'); process.exit(bad ? 1 : 0);

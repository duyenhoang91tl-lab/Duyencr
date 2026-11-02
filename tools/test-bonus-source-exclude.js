const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../js/12-fn-rendersalesreporttabe.js', 'utf8');
const pick = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const els = { 'bp-xsrc-add': { value: ' Nguồn ra ' }, 'bp-xsrc-q': { value: '' }, 'bp-xsrc-list': {}, 'bp-xsrc-sel': {} };
const ctx = { document: { getElementById: id => els[id] }, esc: s => String(s), _srState: { nguonOptions: ['facebook', 'Nguồn ra', 'Mỹ phẩm'] }, _bpDraft: { excludeSources: [], sources: [] }, _bpXSrcQuery: '', _bpNorm_: s => String(s).toLowerCase() };
vm.createContext(ctx);
vm.runInContext(['_bonusNormSrc_', '_bonusHasSrcFilter_', '_bonusSourceExcluded_', '_bonusSourceOk_', '_bonusAggSources_', '_bpNormalize_', '_bpXSrcListHtml_', '_bpXSrcSelHtml_', '_bpXSrcRefresh_', '_bpXSrcToggle', '_bpXSrcAdd'].map(pick).join('\n'), ctx);
let bad = 0; const ok = (c, m) => { if (!c){ bad++; console.log('FAIL', m); } };
const run = c => vm.runInContext(c, ctx);
// loại nguồn, không chọn nguồn áp dụng → mọi nguồn trừ nguồn bị loại
const p = { sources: [], excludeSources: ['Facebook', 'nguồn ra'] };
ctx.p = p;
ok(run('_bonusSourceOk_(p,"facebook")') === false && run('_bonusSourceOk_(p," NGUỒN RA ")') === false, 'đơn nguồn bị loại → không tính');
ok(run('_bonusSourceOk_(p,"Mỹ phẩm")') === true && run('_bonusSourceOk_(p,"")') === true, 'nguồn khác vẫn tính');
// chương trình cũ không có excludeSources → như cũ
ctx.q = { sources: ['Mỹ phẩm'] };
ok(run('_bonusSourceOk_(q,"mỹ phẩm")') === true && run('_bonusSourceOk_(q,"facebook")') === false && run('_bonusHasSrcFilter_({})') === false, 'CT cũ chỉ có sources chạy như cũ');
// vừa chọn vừa loại: loại thắng
ctx.r = { sources: ['facebook', 'Mỹ phẩm'], excludeSources: ['facebook'] };
ok(run('_bonusSourceOk_(r,"facebook")') === false && run('_bonusSourceOk_(r,"mỹ phẩm")') === true, 'loại thắng chọn');
// gom theo ngày: bỏ nguồn bị loại khi đếm đơn/doanh số
ctx.g = { name: 'a', date: '2026-10-14', bySrc: { 'facebook': { revenue: 1000, count: 2, firstOrderTime: '08:00' }, 'mỹ phẩm': { revenue: 500, count: 1, firstOrderTime: '09:30' }, 'nguồn ra': { revenue: 300, count: 1, firstOrderTime: '07:00' } } };
let a = run('_bonusAggSources_(g, [], ["facebook","Nguồn ra"])');
ok(a.revenue === 500 && a.count === 1 && a.firstOrderTime === '09:30', 'gom ngày: chỉ còn Mỹ phẩm ' + JSON.stringify(a));
a = run('_bonusAggSources_(g, ["facebook","Mỹ phẩm"], [])'); ok(a.revenue === 1500 && a.count === 3, 'gom theo nguồn chọn như cũ');
a = run('_bonusAggSources_(g, ["facebook","Mỹ phẩm"], ["facebook"])'); ok(a.revenue === 500 && a.count === 1, 'chọn + loại');
// normalize chương trình cũ
ok(Array.isArray(run('_bpNormalize_({}).excludeSources')), 'chuẩn hoá thêm excludeSources');
// UI gõ tay + tick
run('_bpXSrcAdd()'); ok(JSON.stringify(ctx._bpDraft.excludeSources) === '["Nguồn ra"]' && /data-src="Nguồn ra" checked/.test(els['bp-xsrc-list'].innerHTML), 'thêm nguồn loại gõ tay');
run('_bpXSrcToggle("facebook", true)'); ok(ctx._bpDraft.excludeSources.length === 2 && /LOẠI 2 nguồn/.test(els['bp-xsrc-sel'].innerHTML), 'tick loại facebook');
run('_bpXSrcToggle("facebook", false)'); ok(ctx._bpDraft.excludeSources.length === 1, 'bỏ tick');
console.log(bad ? 'FAIL' : 'ALL PASS'); process.exit(bad ? 1 : 0);

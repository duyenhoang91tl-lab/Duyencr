#!/usr/bin/env node
// Test Node cho BUOC 5a cua docs/SUPABASE-PLAN.md: sbSanSangBuoc5_ (kiem tra san sang truoc khi bo dual-write — CHI DOC) + moc <cong tac>_AT khi bat/tat doc.
// Chay: node tools/test-supabase-step5.js -> "ALL STEP5 TESTS PASSED". Khong goi mang that.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const code = src.slice(src.indexOf('var SB_BATCH_ ='));
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
const DAY = 86400000;
const props = {}; let writes = 0; const triggers = [];
const ctx = { Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { writes++; props[k] = String(v); }, deleteProperty: k => { writes++; delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
  ScriptApp: { getProjectTriggers: () => triggers.slice() }, LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) } };
vm.createContext(ctx); vm.runInContext(code, ctx);
const run = c => vm.runInContext(c, ctx);
const calls = { compare: 0 };
ctx.__cmp = { care: { ok: true }, dt: { ok: true }, don: { ok: true }, throwDon: false };
vm.runInContext(`
  sbCompareCare_ = function () { __calls.compare++; return __cmp.care; };
  sbCompareOrders_ = function (w) { __calls.compare++; if (w === 'don' && __cmp.throwDon) throw new Error('boom'); return __cmp[w]; };`, Object.assign(ctx, { __calls: calls }));
function good() {
  Object.keys(props).forEach(k => delete props[k]); triggers.length = 0;
  Object.assign(props, { SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_KEY: 'SECRETKEY', SB_MODE: 'read',
    SB_ORD_STATE: JSON.stringify({ dt: { syncedAt: Date.now() - 5 * 60000, rows: 10, last: 11 }, don: { syncedAt: Date.now() - 5 * 60000, rows: 10, last: 11 } }),
    SB_ORD_READ: 'on', SB_ORD_READ_AT: String(Date.now() - 8 * DAY), SB_CARE_DELTA_READ: 'on', SB_CARE_DELTA_READ_AT: String(Date.now() - 9 * DAY), SB_CARE_FULL_READ: 'on', SB_CARE_FULL_READ_AT: String(Date.now() - 7 * DAY - 60000) });
  triggers.push({ getHandlerFunction: () => 'sbOrdersTick_' });
  ctx.__cmp.care = { ok: true }; ctx.__cmp.dt = { ok: true }; ctx.__cmp.don = { ok: true }; ctx.__cmp.throwDon = false;
}
const check = () => run('sbSanSangBuoc5_()');
const failsOf = r => r.failing.join(' | ');

// ===== chua cau hinh =====
Object.keys(props).forEach(k => delete props[k]);
let r = check(); ok(!r.autoOk && r.checks.length === 1 && /CHUA nen/.test(r.verdict), 'chua cau hinh -> khong san sang, chi 1 check');

// ===== tat ca dat =====
good(); const before = JSON.stringify(props); writes = 0; r = check();
ok(r.autoOk && r.failing.length === 0 && r.checks.length === 13, 'tat ca dat (13 check): ' + r.checks.length + ' ' + failsOf(r));
ok(r.manual.length === 6 && /manual/.test(r.verdict) && /Duyen dong y/.test(r.verdict), 'autoOk van kem muc manual + can Duyen dong y');
ok(writes === 0 && JSON.stringify(props) === before, 'CHI DOC: khong ghi/xoa Script Property nao');
ok(!JSON.stringify(r).includes('SECRETKEY'), 'ket qua khong lo key');
ok(calls.compare >= 3, 'co goi doi chieu care + dt + don');

// ===== tung dieu kien hong rieng le -> autoOk=false, dung 1 muc hong =====
function breaks(label, mutate, expectRe) {
  good(); mutate(); const b = JSON.stringify(props); writes = 0; const x = check();
  ok(!x.autoOk, label + ': phai KHONG san sang'); ok(expectRe.test(failsOf(x)), label + ': hong dung muc (' + failsOf(x) + ')');
  ok(/CHUA nen/.test(x.verdict), label + ': verdict'); ok(writes === 0 && JSON.stringify(props) === b, label + ': van chi doc');
}
breaks("che do 'write'", () => props.SB_MODE = 'write', /che do 'read'/);
breaks('STALE', () => props.SB_STALE = '2026 x', /STALE/);
breaks('SDT dirty', () => props.SB_DIRTY_CARE = '["0910000001"]', /dirty/);
breaks('doi chieu care lech', () => ctx.__cmp.care = { ok: false, mismatches: [1] }, /CareData khop/);
breaks('doi chieu dt lech', () => ctx.__cmp.dt = { ok: false }, /\(dt\) khop/);
breaks('doi chieu don nem loi', () => ctx.__cmp.throwDon = true, /\(don\) khop/);
breaks('dt dong bo cu 31 phut', () => props.SB_ORD_STATE = JSON.stringify({ dt: { syncedAt: Date.now() - 31 * 60000, rows: 1, last: 2 }, don: { syncedAt: Date.now() - 60000, rows: 1, last: 2 } }), /Don hang \(dt\)/);
breaks('chua dong bo lan nao', () => props.SB_ORD_STATE = '{}', /Don hang \(dt\)/);
breaks('don dirty sau dong bo', () => props.SB_DON_DIRTY = String(Date.now()), /Don hang \(don\)/);
breaks('dong bo bao loi', () => props.SB_ORD_STATE = JSON.stringify({ dt: { syncedAt: Date.now() - 60000, rows: 1, last: 2, err: 'HTTP 500' }, don: { syncedAt: Date.now() - 60000, rows: 1, last: 2 } }), /Don hang/);
breaks('mat trigger', () => triggers.length = 0, /Trigger/);
breaks('doc don hang dang tat', () => { delete props.SB_ORD_READ; delete props.SB_ORD_READ_AT; }, /Doc don hang/);
breaks('delta moi bat 6 ngay', () => props.SB_CARE_DELTA_READ_AT = String(Date.now() - 6 * DAY), /delta/);
breaks('FULL bat truoc ban nay (khong co moc)', () => delete props.SB_CARE_FULL_READ_AT, /FULL/);
{ good(); props.SB_CARE_FULL_READ_AT = String(Date.now() - 7 * DAY + 60000); ok(!check().autoOk, 'cach dung 7 ngay 1 phut -> chua du'); }
{ good(); props.SB_CARE_FULL_READ_AT = String(Date.now() - 7 * DAY - 60000); ok(check().autoOk, 'qua 7 ngay 1 phut -> du'); }

// ===== moc <cong tac>_AT =====
good(); ['SB_ORD_READ', 'SB_CARE_DELTA_READ', 'SB_CARE_FULL_READ'].forEach(k => { delete props[k]; delete props[k + '_AT']; });
run('_sbSetReadOn_(PropertiesService.getScriptProperties(), "SB_ORD_READ")');
const at1 = props.SB_ORD_READ_AT; ok(props.SB_ORD_READ === 'on' && at1 && Math.abs(+at1 - Date.now()) < 5000, 'bat ghi moc thoi gian');
props.SB_ORD_READ_AT = String(+at1 - 3 * DAY); run('_sbSetReadOn_(PropertiesService.getScriptProperties(), "SB_ORD_READ")');
ok(props.SB_ORD_READ_AT === String(+at1 - 3 * DAY), 'bat lai khi dang bat KHONG ghi de moc dau tien');
run('_sbSetReadOff_(PropertiesService.getScriptProperties(), "SB_ORD_READ")'); ok(!props.SB_ORD_READ && !props.SB_ORD_READ_AT, 'tat xoa ca co lan moc');
// qua cac ham bat/tat that
good(); ['SB_ORD_READ', 'SB_CARE_DELTA_READ', 'SB_CARE_FULL_READ'].forEach(k => { delete props[k]; delete props[k + '_AT']; });
let en = run('sbCareListEnable_("SB_CARE_DELTA_READ")'); ok(en.ok && props.SB_CARE_DELTA_READ === 'on' && props.SB_CARE_DELTA_READ_AT, 'sbCareListEnable_ ghi moc: ' + JSON.stringify(en).slice(0, 200));
run('sbCareListDisable_("SB_CARE_DELTA_READ")'); ok(!props.SB_CARE_DELTA_READ && !props.SB_CARE_DELTA_READ_AT, 'sbCareListDisable_ xoa moc');
en = run('sbOrdReadEnable_()'); ok(en.ok && props.SB_ORD_READ === 'on' && props.SB_ORD_READ_AT, 'sbOrdReadEnable_ ghi moc: ' + JSON.stringify(en).slice(0, 200));
run('sbOrdReadDisable_()'); ok(!props.SB_ORD_READ && !props.SB_ORD_READ_AT, 'sbOrdReadDisable_ xoa moc');
good(); run('sbSetMode_("off", false)');
ok(!props.SB_ORD_READ_AT && !props.SB_CARE_DELTA_READ_AT && !props.SB_CARE_FULL_READ_AT && !props.SB_ORD_READ && props.SB_MODE === 'off', 'sbSetMode off xoa sach 3 cong tac + 3 moc');
ok(typeof ctx.sbSanSangBuoc5 === 'function', 'co ham chay tay sbSanSangBuoc5');
console.log('ALL STEP5 TESTS PASSED');

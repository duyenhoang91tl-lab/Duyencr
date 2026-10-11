#!/usr/bin/env node
// Test Node cho P2a (docs/ROADMAP-YEU-CAU.md): cau hinh quet hoi tham fuStart / fuSources trong Settings. Khong goi mang that.
// Chay: node tools/test-fu-config.js -> "ALL FU-CONFIG TESTS PASSED" neu dat.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const fn = name => { const i = src.indexOf('\nfunction ' + name + '('); if (i < 0) throw new Error('khong thay ham ' + name); const j = src.indexOf('\n}\n', i); return src.slice(i + 1, j + 3); };
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
let settings = {}, boom = false;
const ctx = { VN_OFFSET_MS: 7 * 3600 * 1000, getSetting_: k => { if (boom) throw new Error('sheet loi'); return settings[k] ?? null; } };
vm.createContext(ctx);
const hdr = src.slice(src.indexOf('var FU_START ='), src.indexOf('function fuSourceAllowed_'));
vm.runInContext(hdr + fn('_vnMidnight_') + fn('_vnYmd_') + fn('parseVNDate_') + fn('_dateStrToVnYmd_') + fn('fuSourceAllowed_') + fn('_fuConfig_'), ctx);
const day = d => ctx._vnYmd_(d);

// 1) Mac dinh = hanh vi cu
let c = ctx._fuConfig_();
ok(c.start.getTime() === new Date(2026, 4, 1).getTime(), 'mac dinh start = FU_START');
ok(JSON.stringify(c.sources) === JSON.stringify(['landipage', 'landing', 'messenger', 'mess', 'web']), 'mac dinh nguon');
ok(ctx.fuSourceAllowed_('Landipage Duyen') && ctx.fuSourceAllowed_('MESSENGER') && !ctx.fuSourceAllowed_('KH Renew') && !ctx.fuSourceAllowed_(''), 'fuSourceAllowed_ mac dinh (khong tham so)');
// 2) fuStart ca 2 dinh dang
settings.fuStart = '2026-07-15'; ok(day(ctx._fuConfig_().start) === '2026-07-15', 'yyyy-MM-dd -> ' + day(ctx._fuConfig_().start));
settings.fuStart = '01/09/2026'; ok(day(ctx._fuConfig_().start) === '2026-09-01', 'dd/MM/yyyy');
// 3) fuStart sai/ngoai ngu canh -> mac dinh
for (const bad of ['abc', '2026-13-45x', '1999-01-01', '31/02/2026', '2026-02-30', ' ']) { settings.fuStart = bad; const t = ctx._fuConfig_().start.getTime(); ok(t === new Date(2026, 4, 1).getTime(), 'fuStart "' + bad + '" phai ve mac dinh'); }
// 4) fuSources: tach phay, trim, hoa/thuong, bo rong
settings.fuStart = ''; settings.fuSources = ' Renew , ,WEB,landipage ';
c = ctx._fuConfig_(); ok(JSON.stringify(c.sources) === JSON.stringify(['renew', 'web', 'landipage']), 'fuSources: ' + JSON.stringify(c.sources));
ok(ctx.fuSourceAllowed_('KH Renew', c.sources) && !ctx.fuSourceAllowed_('messenger', c.sources), 'danh sach tuy chinh duoc ap dung, khong dung danh sach cu');
settings.fuSources = ' , ,'; ok(ctx._fuConfig_().sources.length === 5, 'chi toan dau phay -> mac dinh');
// 5) Settings loi -> mac dinh, khong nem
boom = true; settings = {}; c = ctx._fuConfig_(); ok(c.sources.length === 5 && c.start.getTime() === new Date(2026, 4, 1).getTime(), 'loi doc Settings -> mac dinh');
// 6) runFollowUpScan_ that su dung cau hinh (khong con ghi cung)
const scan = fn('runFollowUpScan_');
ok(scan.indexOf('_fuConfig_()') > 0 && scan.indexOf('d < fuCfg.start') > 0 && scan.indexOf('fuSourceAllowed_(o.source, fuCfg.sources)') > 0, 'runFollowUpScan_ phai dung _fuConfig_');
ok(!/[^_]FU_START[^_]/.test(scan.replace(/\/\/[^\n]*/g, '')), 'runFollowUpScan_ khong duoc dung FU_START truc tiep');
console.log('ALL FU-CONFIG TESTS PASSED');

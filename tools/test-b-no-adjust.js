#!/usr/bin/env node
// Duyen 2026-11-10: "load mai khong duoc bao cao thang 10; phan chot hoan huy chuyen qua bao cao K; B tinh nhu binh thuong".
// Kiem nguon that: (1) action salesReportB KHONG goi applyPosMonthAdjustToReportB_ (xem thang 10 khong tinh them thang 9);
// (2) Bao cao B (_srRenderB) khong con chen khoi Chot thang; (3) man K (renderSalesReportTabK_) co khoi Chot thang; (4) cac action chot van con.
const fs = require('fs'), path = require('path'); const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } else console.log('OK   ' + m); };
const gas = R('gas_v13.js'), i = gas.indexOf("if (action === 'salesReportB')"), j = gas.indexOf("if (action === 'csStats')");
const blk = gas.slice(i, j);
ok(i > 0 && j > i && blk.length > 200, 'tim thay khoi action salesReportB (' + blk.length + ' ky tu)');
ok(!/applyPosMonthAdjustToReportB_\s*\(/.test(blk), 'salesReportB KHONG goi applyPosMonthAdjustToReportB_ (B tinh binh thuong, khong tinh lai thang truoc)');
ok(/buildSalesReportB_\(fB\)/.test(blk) && /_cachePutBig_\(cKeyB/.test(blk), 'salesReportB van tinh + cache cum nhu cu');
ok(/action === 'closePosMonth'/.test(gas) && /action === 'posMonthAdjust'/.test(gas), 'action closePosMonth + posMonthAdjust (man K dung) van con');
const js11 = R('js/11-fn-srload.js');
ok(!/html \+= _srPosMonthPanelHtml_\(\)/.test(js11) && /function _srPosMonthPanelHtml_\(/.test(js11), 'Bao cao B (js/11) khong con chen khoi Chot thang; ham van con de man K dung');
const k = R('js/67-report-k.js');
ok(/function renderSalesReportTabK_/.test(k) && /_srPosMonthClose_\(\)/.test(k) && /posMonthK/.test(k), 'man K MOI (js/67) co bang chot thang + nut Chot thang + goi posMonthK');
const bd = R('js/28-fn-bonusdetail.js');
ok(/function renderSalesReportTabBD_/.test(bd) && !/renderSalesReportTabK_/.test(bd) && !/_srPosMonthPanelHtml_/.test(bd), 'Chi tiet thuong cu doi ten BD, khong con khoi chot thang');
console.log(fails ? '\n' + fails + ' LOI' : '\nTAT CA QUA'); process.exit(fails ? 1 : 0);

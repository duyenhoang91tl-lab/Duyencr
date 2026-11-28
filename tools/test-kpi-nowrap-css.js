#!/usr/bin/env node
// Test CSS: the KPI bao cao keo ngang theo so tien, KHONG ngat dong (css/17-reports-pro.css). Chay: node tools/test-kpi-nowrap-css.js
const fs = require('fs');
const css = fs.readFileSync(__dirname + '/../css/17-reports-pro.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = sel => { const i = css.indexOf(sel + '{'); if (i < 0) return ''; return css.slice(i, css.indexOf('}', i)); };
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const val = block('#salesreport-wrap .kpi-card .kpi-val,#salesreport-wrap .kpi-val');
ok(/white-space:\s*nowrap/.test(val), 'so tien .kpi-val: white-space:nowrap');
ok(!/overflow-wrap:\s*anywhere/.test(val) && /overflow-wrap:\s*normal/.test(val), 'bo overflow-wrap:anywhere (nguyen nhan be so giua chung)');
ok(/display:\s*flex/.test(block('#salesreport-wrap .kpi-grid')) && /flex-wrap:\s*wrap/.test(block('#salesreport-wrap .kpi-grid')), 'luoi KPI desktop: flex-wrap (the keo ngang)');
ok(/min-width:\s*min-content/.test(block('#salesreport-wrap .kpi-card')), 'the KPI: min-width:min-content (khong hep hon con so)');
const mob = css.slice(css.indexOf('@media (max-width:640px)'));
ok(/\.kpi-grid\{display:grid;grid-template-columns:repeat\(2/.test(mob), 'dien thoai: tra ve luoi 2 cot (display:grid)');
ok(/\.kpi-card\{min-width:0;\}/.test(mob) && /clamp\(15px,4\.4vw,18px\)/.test(mob), 'dien thoai: the co lai + so co chu bang clamp');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

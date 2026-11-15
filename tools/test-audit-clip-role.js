#!/usr/bin/env node
// R9c — nhật ký đổi phân quyền không bị cắt ở 1500 ký tự. Chạy: node tools/test-audit-clip-role.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
function fn(name) { const i = src.indexOf('function ' + name + '('); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; }
const written = []; const sh = { getLastRow: () => 1, getRange: () => ({ setValues: v => written.push(...v) }) };
const ctx = { AUDIT_HEADERS: [1, 2, 3, 4, 5, 6], SH_AUDIT: 'A', getSheet_: () => sh, _sessVerify_: () => ({ u: 'admin' }), _AUDIT_TOKEN_: 'x' };
vm.createContext(ctx); vm.runInContext(['_auditClip_', '_auditClipMax_', '_auditActor_', '_auditCfg_'].map(fn).join('\n'), ctx);
const big = JSON.stringify({ roles: 'x'.repeat(8000) }), huge = 'y'.repeat(25000), mid = 'z'.repeat(3000);
t(ctx._auditClip_(mid) === mid.slice(0, 1500) + '…(+1500 ký tự)', 'mặc định vẫn cắt ở 1500 (hành vi cũ)');
ctx._auditCfg_([['setting:roleConfig', big, big]]);
t(written[0][4] === big && written[0][5] === big, 'roleConfig 8000 ký tự: ghi NGUYÊN VẸN cả cũ lẫn mới');
ctx._auditCfg_([['setting:roleConfig', huge, huge]]);
t(written[1][4].length < huge.length && /…\(\+5000 ký tự\)$/.test(written[1][4]) && written[1][4].length <= 20000 + 30, 'roleConfig >20000: cắt ở 20000');
ctx._auditCfg_([['setting:hangKH', mid, mid]]);
t(written[2][4].length < 1600 && written[2][4].indexOf('…(+1500') > 0, 'khóa khác (hangKH) vẫn cắt ở 1500');
t(JSON.parse(written[0][5]).roles.length === 8000, 'JSON roleConfig ghi ra vẫn parse được (không bị cắt hỏng)');
console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);

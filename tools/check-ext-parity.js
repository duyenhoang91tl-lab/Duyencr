#!/usr/bin/env node
// KIEM TRA QUY TAC SONG SONG Zalo AI <-> Pancake AI (docs/crm-kb/08-extension-parity.md): "tinh nang co o Pancake AI thi Zalo AI cung co va nguoc lai".
// Quet moi action GAS ma moi extension goi (action=xxx / action:'xxx'); action CHI o 1 ben ma CHUA ghi trong tools/ext-parity-allow.json -> LOI (exit 1):
// phai lam o ben con lai, hoac ghi vao allow-list voi status 'platform' (dac thu nen tang + ly do) / 'gap' (con thieu, cho Duyen chot).
// Chay: node tools/check-ext-parity.js  (them --list de in cac muc 'gap' con thieu)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
function acts(dir) {
  const out = {};
  for (const f of fs.readdirSync(path.join(root, dir)).filter(n => n.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(root, dir, f), 'utf8');
    for (const m of s.matchAll(/action\s*[:=]\s*['"]?([A-Za-z_][A-Za-z0-9_]*)/g)) { if (!['function', 'true', 'false', 'null'].includes(m[1])) (out[m[1]] = out[m[1]] || new Set()).add(f); }
  }
  return out;
}
const z = acts('extension-zalo'), p = acts('extension-pancake'), allow = JSON.parse(fs.readFileSync(path.join(__dirname, 'ext-parity-allow.json'), 'utf8'));
const onlyZ = Object.keys(z).filter(a => !p[a]).sort(), onlyP = Object.keys(p).filter(a => !z[a]).sort();
let bad = 0;
const chk = (list, key, other) => list.forEach(a => { if (!allow[key][a]) { bad++; console.error(`LECH: action "${a}" chi co o ${key === 'onlyZalo' ? 'Zalo AI' : 'Pancake AI'} (${[...(key === 'onlyZalo' ? z : p)[a]].join(', ')}) — lam them o ${other}, hoac ghi vao tools/ext-parity-allow.json (platform + ly do | gap).`); } });
chk(onlyZ, 'onlyZalo', 'Pancake AI'); chk(onlyP, 'onlyPancake', 'Zalo AI');
// muc trong allow-list ma khong con lech nua (da lam o ca 2 ben, hoac da bo) -> nhac don dep
const stale = [];
Object.keys(allow.onlyZalo).forEach(a => { if (p[a] || !z[a]) stale.push(`${a} (onlyZalo)`); });
Object.keys(allow.onlyPancake).forEach(a => { if (z[a] || !p[a]) stale.push(`${a} (onlyPancake)`); });
if (stale.length) { bad++; console.error('allow-list CU: cac muc sau khong con lech (da co o ca 2 ben hoac da bo) — xoa khoi tools/ext-parity-allow.json: ' + stale.join(', ')); }
const gaps = [...Object.entries(allow.onlyZalo).map(([a, v]) => ['Zalo co, Pancake thieu', a, v]), ...Object.entries(allow.onlyPancake).map(([a, v]) => ['Pancake co, Zalo thieu', a, v])].filter(x => x[2].status === 'gap');
const shared = Object.keys(z).filter(a => p[a]).length;
if (process.argv.includes('--list')) gaps.forEach(([w, a, v]) => console.log(`  [gap] ${w}: ${a} — ${v.note}`));
if (bad) { console.error(`FAIL: ${bad} van de song song`); process.exit(1); }
console.log(`OK: ${shared} action dung chung; lech co ghi chu: ${Object.keys(allow.onlyZalo).length + Object.keys(allow.onlyPancake).length} (platform ${Object.values(allow.onlyZalo).concat(Object.values(allow.onlyPancake)).filter(v => v.status === 'platform').length}, gap ${gaps.length} — chay them --list de xem)`);

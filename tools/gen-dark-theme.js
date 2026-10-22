#!/usr/bin/env node
// SINH TU DONG lop CHE DO TOI cho cac mau CUNG (hex) trong css/*.css, khoi <style> o index.html va style="..." inline (index.html + js/*.js).
// Ly do: css/10-dark.css chi doi bien mau (--bg, --text...) nen moi cho dung mau cung (#fff, #f3f4f6, #fef3c7, chu #9a3412...) khong doi theo ->
// nen sang + chu sang (chu "vo hinh") hoac nen toi + chu toi. Cong cu nay doc cac mau cung do va tao quy tac ghi de CHI khi html[data-theme="dark"].
// Che do sang KHONG bi anh huong. Ket qua: css/99-dark-auto.css (nap SAU CUNG trong index.html).
// Dung:  node tools/gen-dark-theme.js          # ghi css/99-dark-auto.css
//        node tools/gen-dark-theme.js --check   # CI/dev: bao loi neu file da sinh khong khop (quen chay lai sau khi doi mau cung)
//        node tools/gen-dark-theme.js --stats   # in thong ke
// Quy tac anh xa (tom tat): NEN sang -> be mat toi (--surface/--surface2/--surface3) hoac mau pha toi cung sac (vd #fef3c7 -> vang toi); CHU toi trung tinh
// -> var(--text)/--muted/--hint, chu mau toi -> cung sac nhung sang hon; VIEN sang -> var(--border-md) hoac vien mau toi. Mau dac/giua (nut xanh, badge dam) GIU NGUYEN.
// Ngu canh: neu cung 1 khoi co nen KHONG doi (nen dac/mau giua) thi chu cua khoi do cung KHONG doi (tranh chu toi tren nen vang dam bi sang len).
// Ngoai le thu cong: viet them vao css/10-dark.css (nap truoc, nhung quy tac o day dung !important nen neu can ghi de thi dung selector cu the hon + !important).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'css', '99-dark-auto.css');
// Bien mau THUONG HIEU dung vua lam NEN (thanh tab duoi, nut tim) vua lam CHU (tieu de, link): KHONG doi gia tri bien (nen giu nguyen),
// chi doi cac cho dung bien do lam color/fill sang mau chu SANG tuong ung o che do toi.
const INK_VARS = { '--pro-ink': 'var(--text)', '--pro-purple': '#b9a8f5', '--pro-purple2': '#c9bbfa', '--pro-blue': '#7eb0ff', '--pro-blue2': '#8fbcff', '--pro-green': '#7fd98a', '--pro-green2': '#8fe39a', '--pro-orange': '#ffb067', '--pro-orange2': '#ffc085', '--pro-red': '#ff8a80' };
const inkUse = v => { const m = v.trim().match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i); return m && INK_VARS[m[1].toLowerCase()] ? INK_VARS[m[1].toLowerCase()] : null; };
const HAND_VARS = new Set(((fs.existsSync(path.join(ROOT, 'css', '10-dark.css')) ? fs.readFileSync(path.join(ROOT, 'css', '10-dark.css'), 'utf8') : '').match(/--[a-z0-9-]+(?=\s*:)/gi)) || []);   // bien da chinh tay: khong ghi de
const P = 'html[data-theme="dark"]';

// ---------- mau ----------
function parseHex(h) { h = h.replace('#', '').toLowerCase(); if (h.length === 3) h = h.split('').map(c => c + c).join(''); if (h.length !== 6) return null; const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function lum(rgb) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
function sat(rgb) { return (Math.max(...rgb) - Math.min(...rgb)) / 255; }
function toHsl(rgb) { let [r, g, b] = rgb.map(x => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function hslHex(h, s, l) { const a = s * Math.min(l, 1 - l); const f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); }
const named = { white: '#ffffff', black: '#000000' };
function rgbOf(tok) { tok = tok.toLowerCase(); if (named[tok]) tok = named[tok]; return /^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(tok) ? parseHex(tok) : null; }

// Tra ve chuoi gia tri moi, hoac null neu GIU NGUYEN.
function mapBg(rgb) {
  const L = lum(rgb); if (L < 0.45) return null;
  if (sat(rgb) < 0.10) return L >= 0.97 ? 'var(--surface)' : L >= 0.90 ? 'var(--surface2)' : 'var(--surface3)';
  if (L < 0.55) return null;
  const [h, s] = toHsl(rgb); return hslHex(h, Math.min(s, 0.5) * 0.9, L >= 0.78 ? 0.17 : 0.24);
}
function mapText(rgb) {
  const L = lum(rgb); if (L >= 0.6) return null;
  // Xam chu kieu Tailwind (#111827, #374151, #6b7280...) hoi ngả xanh (bao hoa tới ~0.2) van la CHU TRUNG TINH -> dung mau chu chuan cua che do toi
  if (sat(rgb) < 0.22) return L < 0.06 ? 'var(--text)' : L < 0.30 ? 'var(--muted)' : 'var(--hint)';
  const [h, s] = toHsl(rgb); return hslHex(h, Math.min(s, 0.75), 0.72);
}
function mapBorder(rgb) {
  const L = lum(rgb); if (L < 0.45) return null;
  if (sat(rgb) < 0.10) return 'var(--border-md)';
  if (L < 0.55) return null;
  const [h, s] = toHsl(rgb); return hslHex(h, Math.min(s, 0.4) * 0.8, 0.30);
}
const COLOR_RE = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b|\bwhite\b|\bblack\b/g;
// Thay moi mau trong gia tri bang fn; tra ve {value, changed, unmappedColors}
function mapValue(val, fn) {
  let changed = false, kept = false;
  const out = val.replace(COLOR_RE, tok => { const rgb = rgbOf(tok); if (!rgb) return tok; const m = fn(rgb); if (m === null) { kept = true; return tok; } changed = true; return m; });
  return { value: out, changed, kept };
}
const hasColor = v => { COLOR_RE.lastIndex = 0; return COLOR_RE.test(v); };
// Nen dang GRADIENT: neu co it nhat 1 diem mau SANG can doi thi doi luon cac diem TRUNG BINH (L>=0.25) de gradient khong con dau sang giua nen toi
// (vd linear-gradient(#7fbf93 0%, #d3ecd9 28%, #eef1f5 62%): diem dau #7fbf93 la xanh trung binh nen mapBg giu lai -> dau thanh ben van sang).
function mapBgMid(rgb) { const L = lum(rgb); if (L < 0.25) return null; if (sat(rgb) < 0.10) return L >= 0.97 ? 'var(--surface)' : L >= 0.90 ? 'var(--surface2)' : 'var(--surface3)'; const [h, s] = toHsl(rgb); return hslHex(h, Math.min(s, 0.5) * 0.9, 0.20); }
function mapBgValue(val) {
  if (/gradient\(/i.test(val)) { const first = mapValue(val, mapBg); if (first.changed) return mapValue(val, rgb => mapBg(rgb) || mapBgMid(rgb)); return first; }
  return mapValue(val, mapBg);
}

// ---------- phan tich 1 khoi khai bao: [[prop, value]] -> danh sach ghi de [prop, value, orig] ----------
function darkDecls(decls) {
  const out = [];
  let bgPresent = false, bgUnmapped = false;
  const bgs = [];
  for (const [p, v] of decls) {
    if (/^background(-color|-image)?$/.test(p) && hasColor(v)) { bgPresent = true; const m = mapBgValue(v); if (m.changed) bgs.push([p, m.value]); if (m.kept && !m.changed) bgUnmapped = true; }
  }
  const textOk = !bgPresent || (!bgUnmapped && bgs.length > 0);   // chu chi doi khi nen cung doi (hoac khong khai bao nen)
  for (const [p, v] of decls) {
    if ((p === 'color' || p === 'fill') && inkUse(v)) { if (p === 'fill' || textOk) out.push([p, inkUse(v)]); continue; }
    if (!hasColor(v)) continue;
    if (/^background(-color|-image)?$/.test(p)) { const m = mapBgValue(v); if (m.changed) out.push([p, m.value]); }
    else if (p === 'color') { if (textOk) { const m = mapValue(v, mapText); if (m.changed) out.push([p, m.value]); } }
    else if (/^(border|outline)(-(top|right|bottom|left))?$/.test(p)) {   // shorthand: chi doi mau
      const m = mapValue(v, mapBorder); if (m.changed) out.push([p + '-color', m.value.match(/var\(--border-md\)|#[0-9a-fA-F]{6}/)[0]]);
    }
    else if (/^(border|outline)(-(top|right|bottom|left))?-color$/.test(p)) { const m = mapValue(v, mapBorder); if (m.changed) out.push([p, m.value]); }
    else if (p.startsWith('--') && !HAND_VARS.has(p) && !INK_VARS[p]) {   // bien mau tuy chinh: doan vai tro theo TEN bien
      const fn = /(line|border|divider|stroke|outline)/i.test(p) ? mapBorder : /(ink|text|fg|foreground|font)/i.test(p) ? mapText : /(soft|grey|gray|bg|surface|fill|tint|panel|bar|wash|hover|alt|bgc|back)/i.test(p) ? (rgb => mapBg(rgb) || mapBgMid(rgb)) : null;
      if (fn) { const m = mapValue(v, fn); if (m.changed) out.push([p, m.value]); }
    }
  }
  return out;
}

// ---------- bo phan tich CSS toi gian ----------
function parseCss(text) {
  let i = 0; const n = text.length;
  function skipWsComments() { for (;;) { while (i < n && /\s/.test(text[i])) i++; if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; } else break; } }
  function readPrelude() { let s = '', depth = 0, q = ''; while (i < n) { const c = text[i]; if (q) { s += c; if (c === '\\') { s += text[++i] || ''; } else if (c === q) q = ''; i++; continue; } if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; } if (c === '"' || c === "'") { q = c; s += c; i++; continue; } if (c === '(' || c === '[') depth++; if (c === ')' || c === ']') depth--; if (depth <= 0 && (c === '{' || c === ';' || c === '}')) break; s += c; i++; } return s.trim(); }
  function readBlockRaw() { let s = '', depth = 1, q = ''; while (i < n && depth > 0) { const c = text[i]; if (q) { s += c; if (c === '\\') { s += text[++i] || ''; } else if (c === q) q = ''; i++; continue; } if (text.startsWith('/*', i)) { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; } if (c === '"' || c === "'") { q = c; s += c; i++; continue; } if (c === '{') depth++; if (c === '}') { depth--; if (depth === 0) { i++; break; } } s += c; i++; } return s; }
  function items() {
    const res = [];
    for (;;) {
      skipWsComments(); if (i >= n) break; if (text[i] === '}') { i++; break; }
      const pre = readPrelude();
      if (text[i] === ';') { i++; continue; }
      if (text[i] === '}') continue;
      if (text[i] !== '{') break;
      i++;
      if (pre[0] === '@') {
        if (/^@(media|supports|layer|container)\b/i.test(pre)) res.push({ at: pre, children: items() });
        else readBlockRaw();   // keyframes, font-face, page...: bo qua
      } else res.push({ sel: splitSel(pre), decls: splitDecls(readBlockRaw()) });
    }
    return res;
  }
  return items();
}
function splitSel(s) { const out = []; let cur = '', d = 0, q = ''; for (const c of s) { if (q) { cur += c; if (c === q) q = ''; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if (c === '(' || c === '[') d++; if (c === ')' || c === ']') d--; if (c === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += c; } if (cur.trim()) out.push(cur.trim()); return out; }
function splitDecls(block) { const out = []; let cur = '', d = 0, q = ''; const push = () => { const m = cur.match(/^\s*([a-zA-Z-]+)\s*:\s*([\s\S]*?)\s*$/); if (m) out.push([m[1].toLowerCase(), m[2].replace(/\s*!important\s*$/i, '')]); cur = ''; }; for (const c of block) { if (q) { cur += c; if (c === q) q = ''; continue; } if (c === '"' || c === "'") { q = c; cur += c; continue; } if (c === '(') d++; if (c === ')') d--; if (c === ';' && d === 0) push(); else cur += c; } push(); return out; }

// ---------- phat quy tac CSS ----------
function darkSelector(sel) {
  sel = sel.trim();
  if (/^(:root|html:root)$/i.test(sel) || sel === '*') return null;
  if (/^html\b(?![-\w])/.test(sel)) return P + sel.slice(4);
  return P + ' ' + sel;
}
let nRules = 0;
function emitRules(list, indent, out) {
  for (const it of list) {
    if (it.at) { const sub = []; emitRules(it.children, indent + '  ', sub); if (sub.length) { out.push(indent + it.at + '{'); out.push(...sub); out.push(indent + '}'); } continue; }
    let dd = darkDecls(it.decls); if (!dd.length) continue;
    const rootLike = it.sel.some(x => /^(:root|html|html:root)$/i.test(x.trim()));
    if (rootLike) { dd = dd.filter(([p]) => p.startsWith('--')); if (!dd.length) continue; }
    const sels = it.sel.map(x => /^(:root|html|html:root)$/i.test(x.trim()) ? P : darkSelector(x)).filter(Boolean); if (!sels.length) continue;
    out.push(indent + sels.join(',') + '{' + dd.map(([p, v]) => p + ':' + v + '!important').join(';') + '}'); nRules++;
  }
}

// ---------- inline style="..." ----------
function inlineStyles(text) {   // tra ve cac chuoi noi dung style (da bo escape \")
  const res = []; const re = /\bstyle\s*=\s*(\\?)(["'])/g; let m;
  while ((m = re.exec(text))) {
    const esc = m[1], q = m[2], start = re.lastIndex, endTok = esc + q; const end = text.indexOf(endTok, start); if (end < 0) continue;
    const body = text.slice(start, end); if (body.length > 600) continue;
    if (/['"]\s*\+|\+\s*['"]/.test(body)) { res.push(body); continue; }   // noi chuoi JS: van lay phan literal (declaration nao thieu gia tri se bi bo)
    res.push(body);
  }
  return res;
}
function esc(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
const inlineMap = new Map();   // key = khai bao goc trong style -> {prop, val, orig, kind}
const protList = [];           // {bg, k, orig}: nen KHONG doi + chu dang duoc anh xa o noi khac -> can khoi phuc
function addInline(body) {
  const parts = body.split(';').map(s => s.trim()).filter(Boolean);
  const decls = []; for (const raw of parts) { const m = raw.match(/^([a-zA-Z-]+)\s*:\s*([^'"+]+?)\s*(!important)?$/); if (m && !/\$\{|\{\{/.test(raw)) decls.push({ raw: raw.replace(/\s*!important$/, ''), p: m[1].toLowerCase(), v: m[2].replace(/\s*!important$/, '') }); }
  const dd = darkDecls(decls.map(d => [d.p, d.v]));
  const mappedProps = new Set(dd.map(x => x[0]));
  for (const d of decls) {
    const ink = (d.p === 'color' || d.p === 'fill') ? inkUse(d.v) : null;   // style="color:var(--pro-ink)" -> mau chu sang o che do toi
    if (ink) { const key = d.raw; if (!/"/.test(key) && !inlineMap.has(key)) inlineMap.set(key, { prop: d.p, val: ink, orig: d.v, kind: d.p === 'color' ? 'text' : 'other' }); continue; }
    if (!hasColor(d.v)) continue;
    let prop = d.p, newVal = null;
    if (/^background(-color|-image)?$/.test(d.p)) { const m = mapBgValue(d.v); if (m.changed) newVal = m.value; }
    else if (d.p === 'color') { if (mappedProps.has('color')) { const m = mapValue(d.v, mapText); if (m.changed) newVal = m.value; } }
    else if (/^(border|outline)(-(top|right|bottom|left))?$/.test(d.p)) { const m = mapValue(d.v, mapBorder); if (m.changed) { newVal = m.value.match(/var\(--border-md\)|#[0-9a-fA-F]{6}/)[0]; prop = d.p + '-color'; } }
    else if (/^(border|outline)(-(top|right|bottom|left))?-color$/.test(d.p)) { const m = mapValue(d.v, mapBorder); if (m.changed) newVal = m.value; }
    if (newVal === null) continue;
    const key = d.raw; if (/"/.test(key)) continue;
    if (!inlineMap.has(key)) inlineMap.set(key, { prop, val: newVal, orig: d.v, kind: d.p === 'color' ? 'text' : 'other' });
  }
  // Ngu canh: nen khong doi + chu dang duoc anh xa o noi khac -> khoi phuc cho to hop nay
  const bgDecls = decls.filter(d => /^background(-color|-image)?$/.test(d.p) && hasColor(d.v));
  const unmappedBg = bgDecls.filter(d => { const m = mapBgValue(d.v); return !m.changed; });
  const txt = decls.find(d => d.p === 'color' && hasColor(d.v));
  if (unmappedBg.length && txt && mapValue(txt.v, mapText).changed) for (const b of unmappedBg) protList.push({ bg: b.raw, k: txt.raw, orig: txt.v });
}
function attrSelectors(raw, kind) {   // cac selector khop DUNG khai bao `raw` trong thuoc tinh style, co ranh gioi trai/phai
  const r = esc(raw);
  if (kind !== 'text') return [`[style*="${r};" i]`, `[style$="${r}" i]`];
  // Chu (property `color`) la hau to cua background-color/border-color nen can ranh gioi trai: dau chuoi, sau ';' hoac sau dau cach
  return [`[style^="${r};" i]`, `[style="${r}" i]`, `[style*=";${r};" i]`, `[style$=";${r}" i]`, `[style*=" ${r};" i]`, `[style$=" ${r}" i]`];
}

// ---------- chay ----------
function main() {
  nRules = 0; inlineMap.clear(); protList.length = 0;
  const out = []; const css = [];
  const files = fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css') && !/^(10-dark|99-dark-auto)/.test(f)).sort();
  for (const f of files) { out.push('/* ── ' + f + ' ── */'); const rules = parseCss(fs.readFileSync(path.join(ROOT, 'css', f), 'utf8')); const sub = []; emitRules(rules, '', sub); out.push(...sub); css.push(f); }
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const styleBlocks = [...idx.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  if (styleBlocks.length) { out.push('/* ── <style> trong index.html ── */'); for (const b of styleBlocks) { const sub = []; emitRules(parseCss(b), '', sub); out.push(...sub); } }
  // inline
  const srcs = ['index.html', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort().map(f => 'js/' + f)];
  for (const f of srcs) for (const body of inlineStyles(fs.readFileSync(path.join(ROOT, f), 'utf8'))) addInline(body);
  out.push('/* ── style="..." inline (index.html + js/*.js): khop theo chuoi khai bao ── */');
  const keys = [...inlineMap.keys()].sort();
  for (const k of keys) { const e = inlineMap.get(k); out.push(attrSelectors(k, e.kind).map(s => P + ' ' + s).join(',') + '{' + e.prop + ':' + e.val + '!important}'); }
  // khoi phuc chu tren nen khong doi (do dac thu cao hon: 2 thuoc tinh style)
  const restores = [];
  for (const q of protList) if (inlineMap.has(q.k) && inlineMap.get(q.k).kind === 'text' && !/"/.test(q.bg)) restores.push(`${P} [style*="${esc(q.bg)}" i][style*="${esc(q.k)}" i]{color:${q.orig}!important}`);
  out.push(...[...new Set(restores)].sort());
  const header = '/* TỰ SINH bởi tools/gen-dark-theme.js — ĐỪNG SỬA TAY (sửa tool rồi chạy lại: node tools/gen-dark-theme.js). Chỉ có hiệu lực ở chế độ tối.\n   Nguồn: ' + css.join(', ') + ', <style> + style="…" trong index.html và js/*.js. Ngoại lệ thủ công: css/10-dark.css. */\n';
  return { text: header + out.join('\n') + '\n', stats: { cssRules: nRules, inline: keys.length, restores: restores.length } };
}
function write() { const r = main(); fs.writeFileSync(OUT, r.text); return r; }
module.exports = { mapBg, mapBgValue, mapText, mapBorder, darkDecls, parseCss, inkUse, INK_VARS, main, write, OUT };
if (require.main === module) {
  const r = main();
  if (process.argv.includes('--stats')) console.log(JSON.stringify(r.stats), (Buffer.byteLength(r.text) / 1024 | 0) + ' KB');
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== r.text) { console.error('css/99-dark-auto.css CU/CHUA CO so voi nguon. Chay: node tools/gen-dark-theme.js'); process.exit(1); }
    console.log('OK: css/99-dark-auto.css khop nguon (' + JSON.stringify(r.stats) + ')');
  } else if (!process.argv.includes('--stats')) { fs.writeFileSync(OUT, r.text); console.log('Da ghi css/99-dark-auto.css', JSON.stringify(r.stats), (Buffer.byteLength(r.text) / 1024 | 0) + ' KB'); }
}

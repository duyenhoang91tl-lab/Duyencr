// GOP DON POS TACH cho HOA HONG (Duyen 2026-11-06: don cung khach tach 2 don, TONG >= 15tr => tinh muc 1,5% (ghi chu KT "dthu 1.5")).
// Cung logic voi calc_bonus.js mergeTach() va gas_v13.js _mergeTachDon_ (web CRM da gop san) — dung DUNG TACH_DON_RE_SRC_ doc tu gas_v13.js. Dong Huy/Hoan khong tham gia gop; dong trung chi giu 1.
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
const gasSrc = R('gas_v13.js');
const tachRe = new RegExp(eval(gasSrc.match(/var TACH_DON_RE_SRC_ = (\'.*\');/)[1]), 'i');
const tachParse = note => { const str = String(note || ''); if (str.indexOf('/') < 0) return null; const m = tachRe.exec(str); if (!m) return null; let yr = m[3]; if (yr.length === 2) yr = '20' + yr; return { key: (m[2] + '/' + yr).replace(/\s+/g, '').toUpperCase(), n: parseInt(m[4], 10) }; };
const excludedSt = v => /^(huy|hoan|da huy|da hoan|dang hoan|chuyen hoan)/.test(String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim());
function mergeTach(list) {
  const out = [], groups = {}, groupList = [];
  list.forEach(o => {
    const tp = excludedSt(o.trangThai) ? null : tachParse(o.ghiChu);
    if (!tp) { out.push(o); return; }
    let g = groups[tp.key]; if (!g) { g = groups[tp.key] = { pos: out.length, parts: [], seen: {} }; out.push(null); groupList.push(tp.key); }
    const sig = [tp.n, o.maDon, o.giaTriDon].join('|'); if (g.seen[sig]) return; g.seen[sig] = 1; g.parts.push(o);
  });
  const info = [];
  groupList.forEach(k => {
    const g = groups[k], ps = g.parts;
    if (ps.length === 1) { out[g.pos] = ps[0]; return; }
    const m = Object.assign({}, ps[0]), sales = [], seen = {};
    ps.forEach(p => String(p.saleBan || '').split(',').forEach(x => { x = x.trim(); if (x && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = 1; sales.push(x); } }));
    m.giaTriDon = ps.reduce((a, p) => a + (Number(p.giaTriDon) || 0), 0); m.saleBan = sales.join(', ');
    m.sanPham = ps.map(p => p.sanPham).filter(Boolean).join(', '); m.maSanPham = ps.map(p => p.maSanPham).filter(Boolean).join(';'); m.soLuong = ps.map(p => p.soLuong).filter(Boolean).join(', ');
    m.ghiChu = ps.map(p => p.ghiChu).filter(Boolean).join(' | '); m.tachKey = k; m.tachSoDon = ps.length; m.tachGiaTri = ps.map(p => p.giaTriDon);
    out[g.pos] = m; info.push({ key: k, firstId: ps[0].id, ids: ps.map(p => p.id), maDon: ps.map(p => p.maDon), tong: m.giaTriDon });
  });
  mergeTach.info = info; return out;
}
module.exports = mergeTach;

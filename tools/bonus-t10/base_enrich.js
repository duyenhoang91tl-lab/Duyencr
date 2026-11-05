// Gan thong tin CHIA THEO DON GOC BASE vao orders (giong buildSalesReportB_ tra ve): giaTriDon = Base + phan con lai theo The Pos, saleShares, baseNgayTao, donGoc.
// Dung chung cho calc_bonus.js / calc_commission.js. Can base_split.json (apply_base_split.py). Khong co file -> tra nguyen orders (che do cu: chia deu theo The Pos).
const fs = require('fs');
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const noYear = c => String(c || '').toUpperCase().replace(/\s/g, '').replace(/\/\d{2,4}$/, '');
const isOriginalNote = (ghiChu, codes) => {   // = _isOriginalCounterNote_ (gas_v13.js)
  const first = String(ghiChu || '').split(/[\r\n]/)[0].trim(); const m = /^([A-Za-z]{0,3}\d{1,6}[A-Za-z]{0,3}T\d{1,2}\/\d{2,4})$/.exec(first);
  return !!m && (codes || []).some(x => noYear(x) === noYear(m[1]));
};
module.exports = function enrich(orders, W, overrides) {
  const f = W + '/base_split.json'; if (!fs.existsSync(f)) return { orders, matched: 0, unmatched: [], mode: 'the-pos' };
  const recs = JSON.parse(fs.readFileSync(f, 'utf8')), q = {};
  recs.forEach(r => { (q[norm(r.ghiChu) + '|' + r.giaPos] = q[norm(r.ghiChu) + '|' + r.giaPos] || []).push(r); });
  let matched = 0; const used = new Set();
  const out = orders.map(o => {
    if (o.sheet === 'ĐƠN MP') return o;
    const k = norm(o.ghiChu) + '|' + Math.round(Number(o.giaTriDon) || 0), list = q[k]; if (!list || !list.length) return o;
    const r = list.shift(); used.add(r.stt); matched++;
    const e = Object.assign({}, o, { giaTriPos: o.giaTriDon, giaTriDon: r.giaTriDon, saleShares: r.saleShares.length ? r.saleShares : undefined, baseNgayTao: r.baseNgayTao || undefined,
      donGoc: isOriginalNote(o.ghiChu, r.codes) ? true : undefined, maBase: r.codes.join('+') });
    const ov = overrides && overrides[o.maDon]; if (ov && ov.saleBan) { e.saleShares = [{ name: ov.saleBan, frac: 1 }]; e.saleBan = ov.saleBan; }
    return e;
  });
  return { orders: out, matched, unmatched: recs.filter(r => !used.has(r.stt)), mode: 'don-goc-base' };
};

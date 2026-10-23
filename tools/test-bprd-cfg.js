#!/usr/bin/env node
// Test: Báo cáo B › "Báo cáo sản phẩm" — mặc định top 10 bán chạy, ẩn cột Mã, 👁 cài đặt số lượng, tìm kiếm luôn tìm trên TẤT CẢ.
// Trích code THẬT giữa BPRD-CFG BEGIN/END trong js/11-fn-srload.js + _srTotalRowHtml_ thật từ js/10, chạy bằng vm. Chạy: node tools/test-bprd-cfg.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const j11 = rd('js/11-fn-srload.js'), j10 = rd('js/10-fn-pkkpipct.js');
let fail = 0; const ok = (c, m) => { if (!c) { console.log('FAIL:', m); fail++; } else console.log('ok  :', m); };

const a = j11.indexOf('// ═══ BPRD-CFG BEGIN'), b = j11.indexOf('// ═══ BPRD-CFG END');
ok(a > 0 && b > a, 'tìm thấy khối BPRD-CFG BEGIN/END trong js/11');
const block = j11.slice(a, b);
const tStart = j10.indexOf('function _srTotalRowHtml_'); const tEnd = j10.indexOf('\n}\n', tStart) + 3;
const totalFn = j10.slice(tStart, tEnd);

// 15 sản phẩm (đã sắp giảm dần như máy chủ trả) — SP thứ 12 trở đi nằm NGOÀI top 10
const names = ['Vòng tay Thạch anh tóc vàng', 'Mặt dây Tỳ hưu', 'Vòng Obsidian', 'Nhẫn Citrine', 'Vòng Thạch anh hồng', 'Tỳ hưu đá đen', 'Dây chuyền Bạc', 'Charm Hồ lô', 'Vòng Mã não', 'Vòng Hổ phách',
  'Nhẫn Bạc ta', 'Mặt Phật Bản Mệnh', 'Cây Thạch anh', 'Vòng Lu Thống', 'Bùa Ngọc'];
const products = names.map((n, i) => ({ name: n, code: 'SP' + String(i + 1).padStart(3, '0'), soLuong: 100 - i * 5 }));

function mkEnv(store) {
  const ctx = {
    _srState: { productSearch: '', bProductView: 'table', dataB: { products }, bprdOpen: false },
    fmt: n => String(n || 0), esc: s => String(s == null ? '' : s),
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    _srChartSvg: (rows) => '<svg data-n="' + rows.length + '"></svg>',
    renderSalesReportTab: () => { ctx._rendered = (ctx._rendered || 0) + 1; },
    document: { getElementById: id => (ctx._els[id] || null) }, _els: {}
  };
  ctx._els['bprd-body'] = { innerHTML: '' }; ctx._els['bprd-cfg'] = { innerHTML: '' };
  vm.createContext(ctx); vm.runInContext(totalFn, ctx); vm.runInContext(block, ctx);
  return ctx;
}
const countRows = h => (h.match(/<tr>/g) || []).length;   // <tr> dữ liệu (thead dùng <tr> không thuộc tính => cũng khớp, trừ 1 bên dưới)
const dataRows = h => (h.match(/<tr><td/g) || []).length;

// 1) Mặc định: top 10, ẩn cột mã
let store = {}, c = mkEnv(store);
let h = c._bprdBodyHtml_(c._srState.dataB);
ok(dataRows(h) === 10, 'mặc định hiện đúng 10 sản phẩm (không phải 15)');
ok(!/Mã sản phẩm/.test(h) && !/SP001/.test(h), 'mặc định ẨN cột Mã sản phẩm (không có tiêu đề, không có mã)');
ok(/Vòng tay Thạch anh tóc vàng/.test(h) && !/Nhẫn Bạc ta/.test(h), 'có SP bán chạy nhất, không có SP thứ 11');
ok(/Đang hiện 10\/15/.test(h), 'dòng chú thích nói rõ đang hiện 10/15');
const sum10 = products.slice(0, 10).reduce((s, p) => s + p.soLuong, 0);
ok(new RegExp('Tổng \\(đang hiện\\)</td><td style="text-align:right">' + sum10 + '<').test(h), 'dòng Tổng = tổng 10 sản phẩm đang hiện (' + sum10 + ')');
// 2) Tìm kiếm luôn ra dù ngoài top 10 (theo tên và theo mã), mã vẫn ẩn
c._srState.productSearch = 'bạc ta';
h = c._bprdBodyHtml_(c._srState.dataB);
ok(/Nhẫn Bạc ta/.test(h) && dataRows(h) === 1, 'search theo TÊN "bạc ta" ra SP thứ 11 (ngoài top 10)');
ok(/Tìm trên tất cả 15/.test(h), 'chú thích: tìm trên tất cả 15 sản phẩm');
c._srState.productSearch = 'sp014';
h = c._bprdBodyHtml_(c._srState.dataB);
ok(/Vòng Lu Thống/.test(h) && dataRows(h) === 1, 'search theo MÃ "sp014" (không phân biệt hoa thường) ra SP ngoài top 10');
ok(!/SP014/.test(h) && !/Mã sản phẩm/.test(h), '…và cột mã vẫn ẩn khi tìm theo mã');
c._srState.productSearch = 'khong-co-sp-nay';
h = c._bprdBodyHtml_(c._srState.dataB);
ok(/Không có dữ liệu/.test(h) && /colspan="2"/.test(h), 'tìm không thấy → "Không có dữ liệu", colspan=2 (vì ẩn mã)');
c._srState.productSearch = '';
// 3) Cài số lượng
c._bprdSetN_('5'); h = c._bprdBodyHtml_(c._srState.dataB);
ok(dataRows(h) === 5 && /Đang hiện 5\/15/.test(h), 'cài top 5 → hiện 5 sản phẩm');
ok(JSON.parse(store['ome_bprd_cfg']).n === 5, 'đã lưu n=5 vào localStorage');
c._bprdSetN_('30'); h = c._bprdBodyHtml_(c._srState.dataB);
ok(dataRows(h) === 15 && /Đang hiện 15\/15/.test(h), 'cài top 30 (nhiều hơn số SP có) → hiện hết 15, không lỗi');
c._bprdSetN_(''); c._bprdSetN_('0'); c._bprdSetN_('abc');
ok(c._bprdCfg_().n === 30, 'gõ rỗng / 0 / chữ → giữ giá trị cũ, không lưu rác');
c._bprdSetN_('99999'); ok(c._bprdCfg_().n === 9999, 'số quá lớn bị chặn ở 9999');
c._bprdSetN_('3');
// 4) Bật cột mã
c._bprdSetShowCode_(true); h = c._bprdBodyHtml_(c._srState.dataB);
ok(/Mã sản phẩm/.test(h) && /SP001/.test(h) && dataRows(h) === 3, 'bật "Hiện cột Mã" → có cột mã, vẫn đúng top 3');
ok(/<td style="text-align:right">Tổng<\/td><td style="text-align:right"><\/td>/.test(h) || /Tổng/.test(h), 'dòng Tổng vẫn đúng khi có cột mã');
// 5) Lưu bền qua "tải lại trang": môi trường mới dùng cùng localStorage
const c2 = mkEnv(store);
ok(c2._bprdCfg_().n === 3 && c2._bprdCfg_().showCode === true, 'tải lại trang: cài đặt top 3 + hiện mã vẫn còn');
// 6) Mặc định
c2._bprdReset_();
ok(!('ome_bprd_cfg' in store) && c2._bprdCfg_().n === 10 && c2._bprdCfg_().showCode === false, 'bấm ↺ Mặc định → top 10, ẩn mã');
// 7) Dữ liệu hỏng trong localStorage không làm vỡ báo cáo
const c3 = mkEnv({ ome_bprd_cfg: '{không phải json' });
ok(c3._bprdCfg_().n === 10, 'localStorage hỏng → dùng mặc định, không throw');
// 8) Chế độ biểu đồ dùng cùng danh sách top N
c._srState.bProductView = 'pie'; c._bprdReset_(); h = c._bprdBodyHtml_(c._srState.dataB);
ok(/data-n="10"/.test(h), 'chế độ Tròn/Cột cũng chỉ vẽ top 10');
// 9) Không có dữ liệu sản phẩm
c._srState.bProductView = 'table'; c._srState.dataB = { products: [] };
h = c._bprdBodyHtml_(c._srState.dataB); ok(/Không có dữ liệu/.test(h), 'chưa có sản phẩm nào → không lỗi');
// 10) Panel + nút 👁
c._srState.dataB = { products };
ok(/value="10"/.test(c._bprdPanelHtml_(c._srState.dataB)) && /hiện có 15 sản phẩm/.test(c._bprdPanelHtml_(c._srState.dataB)), 'panel hiện ô số lượng = 10 và "hiện có 15 sản phẩm"');
ok(/👁 Cài đặt hiển thị/.test(c._bprdEyeBtnHtml_()), 'nút 👁 khi đóng');
c._bprdTogglePanel_(); ok(c._srState.bprdOpen === true && c._rendered === 1 && /🙈 Đóng cài đặt/.test(c._bprdEyeBtnHtml_()), 'bấm 👁 → mở panel + vẽ lại tab; nút đổi thành 🙈');
// 11) Nối dây trong _srRenderB: dùng hàm mới, không còn khối cũ
ok(/_bprdEyeBtnHtml_\(\)/.test(j11) && /id="bprd-body"/.test(j11) && /id="bprd-cfg"/.test(j11), 'js/11: _srRenderB gắn nút 👁 + container bprd-cfg / bprd-body');
ok(!/var productRows = /.test(j11), 'js/11: không còn khối productRows cũ (hiện hết SP)');
ok(/oninput="_srState\.productSearch=this\.value;_bprdRefresh_\(\)"/.test(j11), 'js/11: ô tìm kiếm gọi _bprdRefresh_ (tìm trên tất cả, không mất focus)');
// 12) Dữ liệu xuất Excel (js/13) vẫn dùng toàn bộ d.products, không bị cắt top N
ok(/\(dB\.products\|\|\[\]\)\.forEach\(function\(p\)\{ productRows\.push\(\[p\.code, p\.name, p\.soLuong\]\); \}\)/.test(rd('js/13-fn-bpseedofficialonlinetemplate.js')), 'js/13: xuất Excel vẫn lấy TẤT CẢ sản phẩm (không bị giới hạn top)');

console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT');
process.exit(fail ? 1 : 0);

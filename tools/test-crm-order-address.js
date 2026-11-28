// Test địa chỉ nhận hàng MỚI/CŨ của màn Tạo đơn (js/99-d-crm-order.js + data/vn-address-*.json).
// Chạy: node tools/test-crm-order-address.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL: ' + m); } else console.log('OK   ' + m); };
const NEW = JSON.parse(fs.readFileSync(path.join(root, 'data/vn-address-new.json'), 'utf8'));
const OLD = JSON.parse(fs.readFileSync(path.join(root, 'data/vn-address-old.json'), 'utf8'));
const els = {}; const fakeEl = id => (els[id] = els[id] || { id, innerHTML: '', style: {}, textContent: '' });
let netFail = false, fetched = [];
const w = { gsUrl: 'https://gs/exec', currentUser: { name: 'Hoa' }, registerExtraTab: () => {}, toast: () => {}, confirm: () => true,
  document: { getElementById: id => (id === 'xt-wrap-taodon' || id === 'co-addr') ? fakeEl(id) : (els[id] || null), addEventListener() {} },
  fetch: async u => { fetched.push(u); if (netFail) throw new Error('offline'); const f = /vn-address-(new|old)\.json/.exec(u); if (!f) return { ok: true, json: async () => ({}) }; return { ok: true, json: async () => (f[1] === 'new' ? NEW : OLD) }; },
  Math, Date, Number, String, Object, JSON, isFinite, setTimeout, console, encodeURIComponent, Promise, Array };
w.window = w; vm.createContext(w); vm.runInContext(fs.readFileSync(path.join(root, 'js/99-d-crm-order.js'), 'utf8'), w);
const run = c => vm.runInContext(c, w);
const flush = () => new Promise(r => setTimeout(r, 5));
const opts = html => (html.match(/<option /g) || []).length;

(async () => {
  // 1) số liệu danh mục
  ok(NEW.p.length === 34 && NEW.p.reduce((a, p) => a + p[1].length, 0) === 3321, 'MỚI: 34 tỉnh, 3.321 phường/xã');
  ok(OLD.p.length === 63 && OLD.p.reduce((a, p) => a + p[1].length, 0) === 696 && OLD.p.reduce((a, p) => a + p[1].reduce((b, d) => b + d[1].length, 0), 0) === 10035, 'CŨ: 63 tỉnh, 696 quận/huyện, 10.035 phường/xã');
  ok(!NEW.p.some(p => p[0] === 'Tỉnh Hà Giang') && OLD.p.some(p => p[0] === 'Tỉnh Hà Giang') && NEW.p.some(p => p[0] === 'Tỉnh Tuyên Quang'), 'Hà Giang chỉ có ở hệ cũ (đã nhập vào Tuyên Quang ở hệ mới)');
  // 2) hàm thuần
  let L = w._coAddrLists(NEW, false, 'Thành phố Hồ Chí Minh', '');
  ok(L.provs.length === 34 && L.dists.length === 0 && L.wards.length > 100, 'MỚI: Hồ Chí Minh → không có quận/huyện, ' + L.wards.length + ' phường/xã');
  L = w._coAddrLists(OLD, true, 'Thành phố Hà Nội', 'Quận Ba Đình');
  ok(L.provs.length === 63 && L.dists.length === 30 && L.wards.indexOf('Phường Phúc Xá') >= 0 && L.wards.length === 13, 'CŨ: Hà Nội → 30 quận/huyện, Ba Đình 13 phường (có Phúc Xá)');
  L = w._coAddrLists(OLD, true, 'Thành phố Hà Nội', '');
  ok(L.dists.length === 30 && L.wards.length === 0, 'CŨ: chưa chọn quận/huyện → chưa có danh sách phường');
  L = w._coAddrLists(OLD, true, 'Tỉnh Quảng Ngãi', 'Huyện Lý Sơn');
  ok(L.wards.length === 0, 'CŨ: huyện đảo Lý Sơn không có phường/xã (danh sách rỗng, không lỗi)');
  // 3) luồng giao diện — mặc định địa chỉ MỚI
  ok(run('_co.addrOld') === false, 'mặc định: địa chỉ MỚI (chưa tích địa chỉ cũ)');
  await w._coAddrLoad('new');
  let h = w._coAddrHtml();
  ok(/<select id="co-f-province"/.test(h) && /<select id="co-f-ward"/.test(h) && !/co-f-district/.test(h) && !/Quận \/ Huyện/.test(h), 'MỚI: có ô Tỉnh + Phường/Xã, KHÔNG có Quận/Huyện');
  ok(opts(h) === 1 + 34 + 1, 'MỚI: ô Tỉnh có 34 mục + placeholder, ô Phường có placeholder (chưa chọn tỉnh): ' + opts(h) + ' option');
  ok(/Chọn tỉnh trước/.test(h), 'chưa chọn tỉnh → ô Phường nhắc "Chọn tỉnh trước"');
  w._coAddrPick('province', 'Thành phố Hồ Chí Minh');
  h = els['co-addr'].innerHTML;
  const hcmWards = NEW.p.find(p => p[0] === 'Thành phố Hồ Chí Minh')[1];
  ok(opts(h) === 35 + 1 + hcmWards.length, 'chọn Hồ Chí Minh → ô Phường nạp ' + hcmWards.length + ' phường/xã');
  w._coAddrPick('ward', hcmWards[0]);
  ok(run('_co.ward') === hcmWards[0] && new RegExp('<option value="' + hcmWards[0] + '" selected>').test(els['co-addr'].innerHTML), 'chọn phường → lưu đúng tên + hiện là mục đang chọn');
  w._coAddrPick('province', 'Thành phố Hà Nội');
  ok(run('_co.ward') === '' && run('_co.district') === '', 'đổi tỉnh → phường/xã bị xoá (không giữ phường của tỉnh khác)');
  // 4) payload địa chỉ MỚI → district rỗng
  run("_co.phone='0912345678'; _co.items=[{name:'SP',qty:1,price:1000}]; _co.province='Thành phố Hồ Chí Minh'; _co.ward=" + JSON.stringify(hcmWards[0]) + ';');
  let P = w._coPayload(run('_co'));
  ok(P.province === 'Thành phố Hồ Chí Minh' && P.district === '' && P.ward === hcmWards[0], 'payload địa chỉ MỚI: tỉnh + phường, district rỗng');
  // 5) tích địa chỉ CŨ
  fetched = []; w._coAddrToggle(true); await flush();
  ok(run('_co.addrOld') === true && run('_co.district') === '' && run('_co.ward') === '', 'tích địa chỉ cũ → xoá quận/huyện + phường (khác hệ)');
  ok(fetched.some(u => /vn-address-old\.json/.test(u)), 'file địa chỉ CŨ chỉ tải khi tích (lười)');
  ok(run('_co.province') === 'Thành phố Hồ Chí Minh', 'tỉnh còn trong hệ cũ → giữ nguyên');
  h = els['co-addr'].innerHTML;
  ok(/co-f-district/.test(h) && /Quận \/ Huyện/.test(h) && /<select id="co-f-ward"/.test(h), 'CŨ: có đủ 3 ô Tỉnh / Quận-Huyện / Phường-Xã');
  const hcmD = OLD.p.find(p => p[0] === 'Thành phố Hồ Chí Minh')[1];
  w._coAddrPick('district', hcmD[0][0]);
  h = els['co-addr'].innerHTML;
  ok(new RegExp('<option value="' + hcmD[0][0] + '" selected>').test(h) && h.includes(hcmD[0][1][0]), 'chọn quận → ô Phường nạp phường của quận đó');
  w._coAddrPick('ward', hcmD[0][1][0]);
  P = w._coPayload(run('_co'));
  ok(P.district === hcmD[0][0] && P.ward === hcmD[0][1][0], 'payload địa chỉ CŨ: có đủ tỉnh + quận/huyện + phường');
  // 6) chuyển lại MỚI: tỉnh chỉ có ở hệ cũ bị xoá
  w._coAddrPick('province', 'Tỉnh Hà Giang');
  w._coAddrToggle(false); await flush();
  ok(run('_co.addrOld') === false && run('_co.province') === '' && run('_co.district') === '', 'bỏ tích: Hà Giang (không còn ở hệ mới) bị xoá, không giữ tên sai');
  // 7) giá trị gõ tay cũ không bị mất
  run("_co.province='Hà Nội'");
  h = w._coAddrHtml();
  ok(/<option value="Hà Nội" selected>Hà Nội \(nhập tay\)/.test(h), 'giá trị cũ gõ tay không có trong danh mục → vẫn hiện (nhập tay), không mất');
  // 8) tải lỗi → quay về ô gõ tay
  run("_co.province=''"); w._coAddr.data.old = null; netFail = true;
  run('_co.addrOld = true'); await w._coAddrLoad('old'); h = w._coAddrHtml();
  ok(/<input id="co-f-province"/.test(h) && /<input id="co-f-district"/.test(h) && /<input id="co-f-ward"/.test(h) && /Không tải được/.test(h) && /Thử lại/.test(h), 'tải lỗi → ô gõ tay như trước + báo lỗi + nút Thử lại');
  netFail = false; w._coAddr.err.old = ''; await w._coAddrLoad('old');
  ok(/<select id="co-f-province"/.test(w._coAddrHtml()), 'Thử lại thành công → lại có ô chọn');
  // 9) dữ liệu an toàn để đưa vào HTML
  const names = []; NEW.p.forEach(p => { names.push(p[0]); p[1].forEach(x => names.push(x)); }); OLD.p.forEach(p => { names.push(p[0]); p[1].forEach(d => { names.push(d[0]); d[1].forEach(x => names.push(x)); }); });
  ok(!names.some(n => /["<>]/.test(n)) && !names.some(n => !n || n !== n.trim()), 'mọi tên trong danh mục: không rỗng, không ký tự phá HTML');
  console.log(fails ? '\n' + fails + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fails ? 1 : 0);
})();

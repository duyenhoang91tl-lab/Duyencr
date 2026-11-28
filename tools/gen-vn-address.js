#!/usr/bin/env node
// Sinh data/vn-address-new.json + data/vn-address-old.json (danh mục Tỉnh/Quận-Huyện/Phường-Xã cho màn Tạo đơn CRM, js/99-d-crm-order.js).
// Nguồn: gói npm `vn-local-divisions` (MIT; mã GSO) — MỚI = hệ từ 01/07/2025 (NQ 202/2025/QH15): 34 tỉnh → phường/xã (KHÔNG còn quận/huyện);
// CŨ = hệ trước 01/07/2025: 63 tỉnh → 696 quận/huyện → 10.035 phường/xã (đã bỏ các đơn vị "retired" đã sáp nhập từ trước).
// Chạy lại khi nhà nước đổi địa giới:  npm i --no-save vn-local-divisions && node tools/gen-vn-address.js
// Định dạng gọn (chỉ tên, có tiền tố Tỉnh/Thành phố/Quận/Phường...):  MỚI {v,p:[[tinh,[xa...]]...]}   CŨ {v,p:[[tinh,[[huyen,[xa...]]...]]...]}
const fs = require('fs'), path = require('path');
const L = require('vn-local-divisions/legacy'), C = require('vn-local-divisions/current');
const out = path.join(__dirname, '..', 'data');
fs.mkdirSync(out, { recursive: true });
const nm = x => x.name;
const cp = C.getProvinces().map(p => [nm(p), C.getWardsByProvinceCode(p.code).map(nm)]);
const lp = L.getProvinces().map(p => [nm(p), L.getDistrictsByProvinceCode(p.code).map(d => [nm(d), L.getWardsByDistrictCode(d.code).map(nm)])]);
const cnt = (a, f) => a.reduce((s, x) => s + f(x), 0);
fs.writeFileSync(path.join(out, 'vn-address-new.json'), JSON.stringify({ v: '2025-07-01', p: cp }));
fs.writeFileSync(path.join(out, 'vn-address-old.json'), JSON.stringify({ v: '2025-06-30', p: lp }));
console.log('MOI: ' + cp.length + ' tinh, ' + cnt(cp, p => p[1].length) + ' phuong/xa');
console.log('CU : ' + lp.length + ' tinh, ' + cnt(lp, p => p[1].length) + ' quan/huyen, ' + cnt(lp, p => cnt(p[1], d => d[1].length)) + ' phuong/xa');

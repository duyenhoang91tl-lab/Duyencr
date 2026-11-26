#!/usr/bin/env node
// Test giao dien "Xuat doanh thu B ca team / tung sale" (js/99-b-export-sale-ui.js) bang jsdom. Thieu jsdom thi tu bo qua.
// Chay: NODE_PATH=<noi co jsdom> node tools/test-b-export-sale-ui.js
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('SKIP: can jsdom (npm i --no-save jsdom@24)'); process.exit(0); }
const fs = require('fs');
let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const R = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
const grab = (src, name) => { const i = src.search(new RegExp('function ' + name + '\\(')); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); } } };
const dom = new JSDOM('<body><div id="toast"></div></body>', { runScripts: 'outside-only' }), w = dom.window;
const written = [], toasts = [];
w.XLSX = { utils: { book_new: () => ({ s: [] }), aoa_to_sheet: r => ({ r }), book_append_sheet: (wb, ws, n) => wb.s.push(n) }, writeFile: (wb, name) => written.push({ name, sheets: wb.s }) };
w.fmt = n => String(n); w.esc = s => String(s); w.toast = m => toasts.push(m); w._foldVi = s => String(s).toLowerCase();
w._srIsAdmin = () => false; w.currentUser = { role: 'leader' };
w._srState = { dateFrom: '2026-11-01', dateTo: '2026-11-30', dataB: null };
w._srBFilterDesc_ = () => [];
w.teams = [{ id: 't1', name: 'Team Ninh', leader: 'ninh', members: ['Thuong BT'] }, { id: 't2', name: 'Team trong', leader: 'zzz', members: [] }];
w._teamMembersList = t => [t.leader].concat(t.members);
w._personAliases = n => (n === 'Thuong BT' ? ['thuong'] : [n]);
w.alert = m => toasts.push('ALERT ' + m);
const j13 = R('js/13-fn-bpseedofficialonlinetemplate.js');
['_srBuildExportB_', '_srExportBLabel_'].forEach(n => w.eval(grab(j13, n)));
w.eval(R('js/98-b-export-sale.js')); w.eval(R('js/99-b-export-sale-ui.js'));
const O = (khach, val, bsx) => ({ ngayTaoDon: '2026-11-10', posRow: 5, ghiChu: 'GC' + khach, khachHang: khach, soDienThoai: '09', nguonDon: 'FB', theSale: '', giaTriSauGiam: val, cod: 0, bsx, bcx: [] });
w._srState.dataB = { totalOrders: 2, totalGiaTri: 2000000, totalCod: 0, orders: [O('A', 1000000, [['ninh', 1000000]]), O('B', 1000000, [['thuong', 500000], ['linh', 500000]])],
  bySale: [{ name: 'ninh', orders: 1, giaTri: 1000000, cod: 0 }, { name: 'thuong', orders: 1, giaTri: 500000, cod: 0 }, { name: 'linh', orders: 1, giaTri: 500000, cod: 0 }] };
// 1) quyen
ok(w._srBxAllowed_() === true, 'truong nhom (leader) duoc xuat');
w.currentUser = { role: 'cs' }; ok(w._srBxAllowed_() === false, 'nhan vien thuong KHONG duoc xuat');
w.openBExportSale_(); ok(toasts.some(t => /Chỉ admin/.test(t)) && !w.document.getElementById('srbx-modal'), 'nhan vien thuong bam goi ham -> bi chan, khong mo hop thoai');
w._srIsAdmin = () => true; ok(w._srBxAllowed_() === true, 'admin duoc xuat'); w.currentUser = { role: 'admin' };
// 2) mo hop thoai
w.openBExportSale_();
const modal = w.document.getElementById('srbx-modal');
ok(modal && modal.style.display === 'flex', 'mo duoc hop thoai');
ok(modal.querySelectorAll('#srbx-list input[type=checkbox]').length === 3, 'liet ke 3 sale');
ok(/Team Ninh/.test(modal.innerHTML), 'co nut chon nhanh theo team');
// 3) chon theo team (member "Thuong BT" -> alias "thuong"; leader "ninh")
w._srBxPickTeam_('t1');
ok(JSON.stringify(w._srBx.names.sort()) === JSON.stringify(['ninh', 'thuong']) && w._srBx.label === 'Team Ninh', 'chon Team Ninh -> ninh + thuong (khop theo alias), nhan=Team Ninh');
w._srBxPickTeam_('t2'); ok(w._srBx.names.length === 0 && toasts.some(t => /không có sale nào/.test(t)), 'team khong co sale nao trong du lieu -> bao');
// 4) tim + chon tay
w._srBx.q = 'lin'; ok(w._srBxVisible_().length === 1 && w._srBxVisible_()[0].name === 'linh', 'tim "lin" ra linh');
w._srBx.q = ''; w._srBxRender_();
const cb = modal.querySelector('#srbx-list input[data-i="2"]'); cb.checked = true; w._srBxToggle_(cb);
ok(w._srBx.names.join() === 'linh' && w._srBx.label === '', 'tick tay 1 sale; bo nhan team');
// 5) xuat: moi sale 1 file
w._srBx.names = ['ninh', 'linh']; w._srBx.mode = 'files'; w._srBx.label = '';
const realST = w.setTimeout; w.setTimeout = (f) => f();   // chay ngay, khong cho 700ms
w._srBxRun_();
ok(written.length === 2 && written.map(x => x.name).join().includes('ninh') && written.map(x => x.name).join().includes('linh'), 'mode files: tai 2 file ninh + linh: ' + written.map(x => x.name).join(' | '));
ok(written.every(x => x.sheets.join() === 'Tổng quan,Chi tiết đơn'), 'moi file co sheet Tong quan + Chi tiet don');
written.length = 0; w._srBx.mode = 'team'; w._srBx.label = 'Team Ninh'; w._srBx.names = ['ninh', 'thuong']; w._srBxRun_();
ok(written.length === 1 && /Team Ninh/.test(written[0].name) && written[0].sheets.join() === 'Tổng hợp,Chi tiết chia theo Sale', 'mode team: 1 file, ten co ten team');
ok(w._srBx.busy === false, 'xong tra lai trang thai ranh');
console.log(bad ? bad + ' LOI' : 'DAT'); process.exit(bad ? 1 : 0);

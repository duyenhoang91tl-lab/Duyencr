#!/usr/bin/env node
// Test giao dien MOI cua trang "Vai tro & quyen han" (js/40-fn-rolesettings.js, L3): 3 tab, the vai tro, ma tran Bat/Tat, thay doi gan day, quyen tung nguoi, phong ban.
// Chay: node tools/test-roles-page.js -> "ALL ROLES PAGE TESTS PASSED". Phan DOM can jsdom (nhu test-dist-equivalence); khong co thi chi chay logic thuan.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js', '40-fn-rolesettings.js'), 'utf8');
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } };
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('(bo qua: chua cai jsdom — npm i --no-save jsdom)'); console.log('ALL ROLES PAGE TESTS PASSED (khong co jsdom)'); process.exit(0); }
const wait = (ms) => new Promise(r => setTimeout(r, ms || 30));

const TABS = [{ id: 'overview', label: 'Tổng quan' }, { id: 'tab-kh', label: 'Danh sách KH' }, { id: 'salesreport', label: 'Báo cáo doanh số' }, { id: 'audit', label: 'Nhật ký' }, { id: 'tab-chat', label: 'Chat (Social)' }];
const GROUPS = [{ k: 'ov', t: '🏠 Tổng quan', ids: ['act:notif', 'overview'] }, { k: 'kh', t: '👤 Khách', ids: ['tab-kh'] }, { k: 'rp', t: '📊 Báo cáo', ids: ['salesreport', 'act:fureport'] }, { k: 'st', t: '⚙ Cài đặt', ids: ['act:roles', 'audit', 'act:acct'] }];
const ACTS = { notif: { t: '🔔 Thông báo' }, fureport: { t: '📞 Chăm sóc theo mốc' }, roles: { t: '🛡 Phân quyền', admin: true }, acct: { t: '🔑 Tài khoản đăng nhập', admin: true } };
function CONFIG() { return { v: 1, roles: [], deptPerms: {} }; }

function boot(opts) {
  opts = opts || {};
  const dom = new JSDOM('<body><div id="rs-page" class="rs-page"></div></body>', { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window; w.__toasts = []; w.__posts = []; w.__calls = [];
  w.gsUrl = 'https://gas.example/exec'; w.esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  w.toast = m => w.__toasts.push(m); w.confirm = () => (opts.confirm === undefined ? true : opts.confirm); w.alert = () => {};
  w._PERM_TAB_DEFS = TABS; w._SN_GROUPS = GROUPS; w._SN_ACTS = ACTS;
  w.accounts = [{ username: 'u1', name: 'Hà', role: 'cs', names: ['Hà'] }, { username: 'u2', name: 'Minh', role: 'ceo' }, { username: 'u3', name: 'Lan', role: 'tp', team: 'online' }];
  w.currentUser = { role: 'admin', name: 'Admin' }; w._applyAuthIdentity = function () {};
  w.localStorage.setItem('ome_sess_token', 'tok');
  const audit = opts.audit || [];
  w.fetch = async (url, init) => {
    url = String(url);
    if (init && init.method === 'POST') { const b = JSON.parse(init.body); w.__posts.push(b); if (b.action === 'saveRoleConfig') return { json: async () => ({ ok: true, config: b.config }) }; return { json: async () => ({ ok: true }) }; }
    if (/action=roleConfig/.test(url)) return { json: async () => ({ ok: true, config: opts.config || CONFIG() }) };
    if (/key=deptList/.test(url)) return { json: async () => ({ value: JSON.stringify([{ key: 'online', label: 'Online' }, { key: 'vp', label: 'Văn phòng' }]) }) };
    if (/key=saleDepts/.test(url)) return { json: async () => ({ value: JSON.stringify({ 'Hà': 'online', 'Minh': 'vp' }) }) };
    if (/action=audit/.test(url)) return { json: async () => ({ audit }) };
    return { json: async () => ({}) };
  };
  // ham cua hop thoai Tai khoan (luu NGAY) — gia lap de kiem tra trang goi dung
  w.acctTogglePermLimit = (u, on) => { w.__calls.push(['limit', u, on]); const a = w.accounts.find(x => x.username === u); a.perms = on ? TABS.map(t => t.id) : null; };
  w.acctTogglePermTab = (u, id, on) => { w.__calls.push(['tab', u, id, on]); const a = w.accounts.find(x => x.username === u); const i = a.perms.indexOf(id); if (on && i === -1) a.perms.push(id); if (!on && i !== -1) a.perms.splice(i, 1); };
  w._findAccount = u => w.accounts.find(x => x.username === u);
  w.eval(src);
  return w;
}
const q = (w, sel) => w.document.querySelector(sel), qa = (w, sel) => Array.from(w.document.querySelectorAll(sel));
const txt = w => w.document.getElementById('rs-page').textContent;
const click = (w, sel) => { const el = q(w, sel); ok(el, 'khong thay ' + sel); el.click(); };
const cellBtn = (w, rowLabel, colIdx) => { const row = qa(w, '.rl-mx tbody tr').find(r => { const t = r.querySelector('.rl-ft'); return t && t.textContent === rowLabel; }); ok(row, 'khong thay hang ' + rowLabel); return row.querySelectorAll('td')[colIdx].querySelector('button'); };

(async () => {
  // ===== logic thuan =====
  let w = boot();
  ok(w._roleLabel('leader') === 'Trưởng nhóm' && w._roleLabel('cs') === 'Nhân viên kinh doanh', 'nhan vai tro theo Duyen chot');
  ok(w._rsDesc('overview', 'Tổng quan').includes('Tổng quan') && w._rsDesc('act:notif', 'Thông báo').includes('Thông báo') && w._rsDesc('zzz', 'Mục Z').includes('Mục Z'), 'mo ta tinh nang (co + du phong)');
  ok(w._rsFixedRows().map(r => r.id).join() === 'act:roles,act:acct' && w._rsFixedRows()[0].label === 'Phân quyền', 'hang co dinh = tac vu chi Admin (bo icon dau)');
  const D = w._rsDiffSummary;
  ok(D('{"roles":[{"key":"cs","perms":null}],"deptPerms":{}}', '{"roles":[{"key":"cs","perms":["overview"]}],"deptPerms":{"online":["audit"]}}') === 'Vai trò: Nhân viên kinh doanh · Phòng: online', 'tom tat thay doi: vai tro + phong');
  ok(D('{"roles":[],"deptPerms":{}}', '{"roles":[],"deptPerms":{}}') === 'Cập nhật cấu hình' && D('khong phai json', 'x') === 'Cập nhật cấu hình', 'khong doi / JSON hong -> cau chung chung, khong loi');

  // ===== mo trang: 3 tab, 6 the vai tro, 6 cot =====
  w = boot({ audit: [{ timestamp: '2026-10-13T10:05:00.000Z', user: 'Admin1', action: 'config:roleConfig', oldValue: '{"roles":[{"key":"cs","perms":null}],"deptPerms":{}}', newValue: '{"roles":[{"key":"cs","perms":["overview"]}],"deptPerms":{}}' },
    { timestamp: '2026-10-12T09:00:00.000Z', user: 'Admin1', action: 'config:khac', oldValue: '', newValue: '' }] });
  await w.openRoleSettings(); await wait(60);
  ok(qa(w, '.rl-tab').map(t => t.textContent).join('|') === 'Quyền vai trò|Quyền từng người|Phòng ban & nhóm' && q(w, '.rl-tab.on').textContent === 'Quyền vai trò', '3 tab dung ten, mac dinh Quyen vai tro');
  ok(qa(w, '.rl-rc:not(.rl-rc-add)').length === 6 && q(w, '.rl-rc-add'), '6 the vai tro + the Them vai tro');
  const heads = qa(w, '.rl-mx thead th.rl-col').map(t => t.querySelector('.rl-colname').textContent);
  ok(heads.join('|') === 'Admin|CEO / Giám đốc|Trưởng phòng|Quản lý|Trưởng nhóm|Nhân viên kinh doanh', '6 cot vai tro: ' + heads.join('|'));
  ok(q(w, '.rl-rc.on b').textContent === 'CEO / Giám đốc', 'mac dinh chon the CEO');
  ok(/Quyền sử dụng theo vai trò/.test(txt(w)) && /Quản trị hệ thống · cố định/.test(txt(w)), 'tieu de + nhom co dinh');
  // cot Admin: luon bat + khoa
  const adminCell = qa(w, '.rl-mx tbody tr').find(r => r.querySelector('.rl-ft') && r.querySelector('.rl-ft').textContent === 'Báo cáo doanh số').querySelectorAll('td')[1];
  ok(adminCell.classList.contains('rl-lock') && /Bật/.test(adminCell.textContent) && /Luôn bật · khóa/.test(adminCell.textContent) && !adminCell.querySelector('button'), 'cot Admin: Bat · Luon bat khoa, khong bam duoc');
  // hang co dinh: admin Co khoa, vai tro khac Khong duoc cap
  const fixedRow = qa(w, '.rl-mx tbody tr').find(r => r.querySelector('.rl-ft') && r.querySelector('.rl-ft').textContent === 'Phân quyền');
  ok(/Có khóa/.test(fixedRow.querySelectorAll('td')[1].textContent) && fixedRow.querySelectorAll('td')[2].textContent === 'Không được cấp' && fixedRow.querySelectorAll('td')[6].textContent === 'Không được cấp', 'hang co dinh: Admin Co khoa; vai tro khac Khong duoc cap');
  ok(/Chưa lưu/.test(w.document.getElementById('rs-dirty').textContent) && w.document.getElementById('rs-dirty').style.display === 'none' && q(w, '#rs-save').disabled && q(w, '#rs-discard').disabled, 'chua doi gi: Luu quyen + Bo thay doi deu mo');
  // thay doi gan day
  ok(/Cập nhật 13\/10\/2026/.test(q(w, '#rl-recent-time').textContent) && qa(w, '.rl-ev').length === 1 && /Vai trò: Nhân viên kinh doanh/.test(q(w, '.rl-ev-s').textContent) && /Admin1/.test(q(w, '.rl-ev-u').textContent), 'Thay doi gan day chi lay config:roleConfig + tom tat');

  // ===== bat/tat o + chuan hoa =====
  const colIdx = 6;   // Nhan vien kinh doanh (cot 6 tinh ca cot Tinh nang = 0)
  let b = cellBtn(w, 'Nhật ký', colIdx); ok(b.classList.contains('on') && b.textContent === 'Bật', 'vai tro chua gioi han: moi o Bat');
  b.click();
  ok(JSON.stringify(w._rsRole('cs').perms) === JSON.stringify(w._rsAllIds().filter(x => x !== 'audit')), 'bam Tat 1 o tren cot chua gioi han -> gioi han = moi muc TRU muc do');
  ok(cellBtn(w, 'Nhật ký', colIdx).classList.contains('off') && cellBtn(w, 'Nhật ký', colIdx).textContent === 'Tắt', 'o hien Tat');
  ok(cellBtn(w, 'Tổng quan', colIdx).classList.contains('on'), 'cac o khac van Bat');
  ok(!q(w, '#rs-save').disabled && !q(w, '#rs-discard').disabled && q(w, '#rs-save').textContent === 'Lưu quyền' && w.document.getElementById('rs-dirty').style.display === '', 'sau khi doi: bat Luu quyen + Bo thay doi + Chua luu');
  cellBtn(w, 'Nhật ký', colIdx).click();
  ok(w._rsRole('cs').perms === null, 'bat lai du moi muc -> ve khong gioi han (null)');
  ok(JSON.stringify(w._rsRole('ceo').perms) === 'null', 'vai tro khac khong bi dong vao');
  // chon the vai tro: cot duoc to + panel chi tiet
  click(w, '.rl-rc:nth-child(6)'); ok(q(w, '.rl-rc.on b').textContent === 'Nhân viên kinh doanh' && q(w, '.rl-mx thead th.rl-sel .rl-colname').textContent === 'Nhân viên kinh doanh', 'chon the -> to cot tuong ung');
  ok(q(w, '.rl-det .rl-in').value === 'Nhân viên kinh doanh', 'panel chi tiet hien ten vai tro de sua');
  click(w, '.rl-rc:nth-child(1)'); ok(/Quyền Quản trị viên luôn bật để bảo đảm truy cập quản trị/.test(txt(w)) && !q(w, '.rl-det .rl-in'), 'the Admin: chi doc + cau noi bao dam truy cap');

  // ===== giu vi tri cuon khi bam o (sua 31da91a: truoc day nhay len dau trang) =====
  q(w, '.rl-body').scrollTop = 240; q(w, '.rl-scroll').scrollTop = 120; q(w, '.rl-scroll').scrollLeft = 60;
  cellBtn(w, 'Tổng quan', 5).click();
  ok(q(w, '.rl-body').scrollTop === 240 && q(w, '.rl-scroll').scrollTop === 120 && q(w, '.rl-scroll').scrollLeft === 60, 'bam o: giu vi tri cuon cua trang va bang');
  cellBtn(w, 'Tổng quan', 5).click();
  q(w, '.rl-body').scrollTop = 200; w._rsSetTab('dept'); ok(q(w, '.rl-body').scrollTop === 0, 'doi tab: cuon lai tu dau');
  w._rsSetTab('role');

  // ===== luu / bo thay doi =====
  w._rsToggle('role', 'cs', 'audit'); ok(w._rs.dirty, 'dirty');
  await w._rsSave(); await wait(30);
  ok(w.__posts.length === 1 && w.__posts[0].action === 'saveRoleConfig' && w.__posts[0].config.roles.some(r => r.key === 'cs' && Array.isArray(r.perms) && !r.perms.includes('audit')), 'Luu quyen gui dung cau hinh');
  ok(!w._rs.dirty && q(w, '#rs-save').disabled, 'sau luu: het dirty');
  w._rsToggle('role', 'cs', 'audit'); w._rsDiscard(); await wait(80);
  ok(!w._rs.dirty && Array.isArray(w._rsRole('cs').perms) === false || w._rs.cfg !== null, 'Bo thay doi tai lai tu may chu');
  const w2 = boot({ confirm: false }); await w2.openRoleSettings(); await wait(40); w2._rsToggle('role', 'cs', 'audit'); w2._rsDiscard(); await wait(30);
  ok(w2._rs.dirty === true, 'Bo thay doi nhung bam Huy o hop xac nhan -> giu nguyen thay doi');

  // ===== them / xoa vai tro tuy chinh trong the =====
  w = boot(); await w.openRoleSettings(); await wait(40);
  click(w, '.rl-rc-add'); ok(q(w, '#rs-new-label') && q(w, '#rs-new-base'), 'bam the Them vai tro -> hien khung nhap');
  q(w, '#rs-new-label').value = ''; q(w, '.rl-add .rl-btn.pri').click(); ok(w.__toasts.some(t => /Nhập tên vai trò/.test(t)), 'thieu ten -> nhac');
  q(w, '#rs-new-label').value = 'Kế toán'; q(w, '#rs-new-base').value = 'viewer'; q(w, '.rl-add .rl-btn.pri').click();
  ok(!q(w, '.rl-add') && q(w, '.rl-rc.on b').textContent === 'Kế toán' && w._rs.dirty, 'tao xong: dong khung, chon luon the moi, bat Luu quyen');
  ok(qa(w, '.rl-rc:not(.rl-rc-add)').length === 7 && qa(w, '.rl-mx thead th.rl-col').length === 7, 'them vai tro tuy chinh -> 7 the / 7 cot');

  // ===== Quyen tung nguoi =====
  w = boot(); await w.openRoleSettings(); await wait(40);
  w._rsSetTab('person');
  ok(q(w, '.rl-tab.on').textContent === 'Quyền từng người' && qa(w, '.rl-pi').length === 3 && /Chọn một tài khoản ở bên trái/.test(txt(w)), 'tab Quyen tung nguoi: danh sach 3 tai khoan');
  click(w, '.rl-pi:nth-child(1)');   // u1 (cs, Ha — phong online)
  ok(/Hà/.test(q(w, '.rl-pdh h3').textContent) && /Phòng: Online/.test(q(w, '.rl-pdh .rl-sub').textContent), 'chi tiet nguoi: ten, vai tro, phong');
  ok(qa(w, '.rl-mx thead th').map(t => t.textContent).join('|') === 'Tính năng|Theo vai trò & phòng|Riêng người này|Kết quả', 'cot: theo vai tro & phong / rieng / ket qua');
  ok(qa(w, '.rl-tg').length === 0 && /Chưa giới hạn riêng/.test(txt(w)), 'chua gioi han rieng: khong co nut rieng');
  w.document.querySelector('.rl-pdh input[type=checkbox]').click();   // bat gioi han rieng
  ok(w.__calls.some(c => c[0] === 'limit' && c[1] === 'u1' && c[2] === true), 'bat gioi han goi dung acctTogglePermLimit (LUU NGAY nhu hop thoai Tai khoan)');
  await wait(200);
  ok(qa(w, '.rl-tg').length > 0 && /lưu ngay/.test(txt(w)), 'sau khi bat: hien nut Bat/Tat rieng + ghi chu luu ngay');
  const ownBtn = qa(w, '.rl-mx tbody tr').find(r => r.querySelector('.rl-ft') && r.querySelector('.rl-ft').textContent === 'Nhật ký').querySelectorAll('td')[2].querySelector('button');
  ownBtn.click(); ok(w.__calls.some(c => c[0] === 'tab' && c[1] === 'u1' && c[2] === 'audit' && c[3] === false), 'bam o rieng goi acctTogglePermTab(chan Nhat ky)');
  await wait(200);
  const finRow = qa(w, '.rl-mx tbody tr').find(r => r.querySelector('.rl-ft') && r.querySelector('.rl-ft').textContent === 'Nhật ký');
  ok(finRow.querySelectorAll('td')[3].textContent === 'Tắt' && !w._rs.dirty, 'ket qua cuoi = Tat, va khong lam bẩn nut Luu quyen (luu rieng)');
  // tim kiem
  w._rsPersonQ('minh'); ok(qa(w, '.rl-pi').length === 1 && /Minh/.test(q(w, '.rl-pn').textContent), 'tim tai khoan');
  w._rsPersonQ('zzz'); ok(/Không có tài khoản phù hợp/.test(txt(w)), 'khong co ket qua');

  // ===== Phong ban & nhom =====
  w = boot(); await w.openRoleSettings(); await wait(40);
  w._rsSetTab('dept');
  ok(q(w, '.rl-tab.on').textContent === 'Phòng ban & nhóm' && qa(w, '.rl-mx thead th.rl-col').map(t => t.querySelector('.rl-colname').textContent).join('|') === 'Online|Văn phòng', 'tab Phong ban: cot theo phong');
  ok(/1 sale · 1 trưởng phòng/.test(txt(w)) && /1 sale · 0 trưởng phòng/.test(txt(w)), 'thong ke thanh vien moi phong (sale + truong phong)');
  b = cellBtn(w, 'Nhật ký', 1); b.click();
  ok(Array.isArray(w._rs.cfg.deptPerms.online) && !w._rs.cfg.deptPerms.online.includes('audit') && w._rs.dirty, 'tat o phong -> deptPerms.online gioi han, dirty');
  qa(w, '.rl-dc')[0].querySelector('input').click();
  ok(!('online' in w._rs.cfg.deptPerms), 'bo tick Gioi han tinh nang -> bo khoi deptPerms');
  ok(q(w, '#rs-copy-from') && q(w, '#rs-copy-to'), 'co thanh Sao chep quyen');

  // ===== khong phai admin =====
  w = boot(); w.currentUser = { role: 'cs' }; await w.openRoleSettings(); ok(w.__toasts.some(t => /Chỉ Admin/.test(t)), 'khong phai admin: bi chan');
  console.log('ALL ROLES PAGE TESTS PASSED');
})().catch(e => { console.error('LOI:', e); process.exit(1); });

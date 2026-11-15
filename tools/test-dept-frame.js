#!/usr/bin/env node
// R9b — trang 🏢 Phòng ban: thẻ số + chip "N người" theo khuôn, CHỈ hiển thị. Chạy: node tools/test-dept-frame.js
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'); const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0; const t = (c, m) => { if (c) console.log('ok   ' + m); else { fail++; console.log('FAIL ' + m); } };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = ['_dpStatsInner_', '_dpStatsHtml_', '_dpCntHtml_', '_dpRoomsHtml', '_dpCount', '_dpNames', '_dpTeams', '_dpOpts'];
function fn(src, name) { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; }
function load(src, withKit, dp) {
  const ctx = { console, esc, teams: [], accounts: [], document: { readyState: 'complete', addEventListener() {}, getElementById: () => null }, location: { search: '' } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext((withKit ? R('js/68-ui-kit.js') + '\n' : '') + 'var _dp=' + JSON.stringify(dp) + ';\n' + NAMES.map(n => fn(src, n)).join('\n'), ctx); return ctx;
}
const NEW = R('js/35-fn-deptsettings.js');
const DP = { list: [{ key: 'a', label: 'Sale' }, { key: 'b', label: 'Kế toán' }, { key: 'c', label: '  ' }], map: { 'Hà': 'a', 'Minh': 'a', 'Lan': 'b', 'Ghost': 'zzz' }, q: '' };
const A = load(NEW, true, DP), B = load(NEW, false, DP);
const st = A._dpStatsInner_();
t(/Số phòng/.test(st) && /Đã gán phòng/.test(st) && /Chưa phân phòng/.test(st), 'có js/68: 3 thẻ số');
const num = (h, label) => { const m = h.match(new RegExp(label + '</div><div class="ui-stat-n">([^<]*)<')); return m && m[1]; };
t(num(st, 'Số phòng') === '2', 'Số phòng = 2 (bỏ phòng trống tên)');
t(num(st, 'Đã gán phòng') === '3', 'Đã gán = 3 (Hà, Minh, Lan; bỏ Ghost trỏ phòng không tồn tại)');
t(num(st, 'Chưa phân phòng') === '1', 'Chưa phân phòng = 1 (Ghost)');
t(/ui-tone-warning/.test(st), 'còn người chưa phân phòng → thẻ warning');
const all = load(NEW, true, { list: [{ key: 'a', label: 'Sale' }], map: { 'Hà': 'a' }, q: '' })._dpStatsInner_();
t(num(all, 'Chưa phân phòng') === '0' && !/ui-tone-warning/.test(all), 'gán hết → 0 và không cảnh báo');
t(B._dpStatsInner_() === '' && B._dpStatsHtml_() === '', 'thiếu js/68: không có thẻ số');
t(/id="dp-stats"/.test(A._dpStatsHtml_()), 'có js/68: khối #dp-stats để làm mới khi sửa');
t(/ui-chip/.test(A._dpCntHtml_(2)) && /2 người/.test(A._dpCntHtml_(2)) && /ui-tone-info/.test(A._dpCntHtml_(2)) && /ui-tone-neutral/.test(A._dpCntHtml_(0)), 'chip "N người": info khi >0, neutral khi 0');
t(B._dpCntHtml_(5) === '<span class="dpg-cnt">5 người</span>', 'thiếu js/68: "N người" y hệt bản cũ');
let old = ''; try { old = cp.execSync('git show HEAD:js/35-fn-deptsettings.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 27 }).toString(); } catch (e) {}
if (old && old !== NEW) {
  const g = s => ['_dpSave', '_dpPost', '_dpGet', '_dpAssignTeam', '_dpSetPerson', '_dpAddPerson', '_dpDelRoom', '_dpPeopleListHtml', '_dpTeamsHtml'].map(n => fn(s, n)).join('\n');
  t(g(old) === g(NEW), 'thân hàm lưu/gán/đọc KHÔNG đổi so với HEAD');
  const oldRooms = load(old, false, DP)._dpRoomsHtml();
  t(B._dpRoomsHtml() === oldRooms, 'thiếu js/68: danh sách phòng HTML y hệt HEAD từng ký tự');
}
console.log(fail ? '\n' + fail + ' LỖI' : '\nTẤT CẢ ĐẠT'); process.exit(fail ? 1 : 0);

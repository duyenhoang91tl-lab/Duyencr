// Test _vtSame_ linh hoat (2026-10-27): app Android gui by=<ten CS go tay> ('duyenht') nhung muc rieng luu owner = ten tai khoan CRM ('Duyên HT').
// Chay ham THAT trong gas_v13.js (readVietTat_ voi sheet gia).
const fs = require('fs'), vm = require('vm'); let bad = 0; const ok = (c, t) => { if (!c) { bad++; console.log('FAIL', t); } else console.log('ok  ', t); };
const src = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
function fn(n) { const i = src.indexOf('function ' + n + '('); if (i < 0) throw new Error('thieu ' + n); let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } }
const H = ['id', 'nhom', 'abbr', 'keyword', 'options', 'owner', 'createdBy', 'updatedAt', 'images'];
const rows = [
  ['1', '', 'ch', 'chào', JSON.stringify(['Chào {tên}']), '', 'admin', 1, '[]'],                 // muc CHUNG
  ['2', '', 'dc', 'dia chi', JSON.stringify(['Số 1']), 'Duyên HT', 'Duyên HT', 2, '[]'],        // muc rieng cua Duyen HT
  ['3', '', 'tk', 'tai khoan', JSON.stringify(['STK 123']), 'Nguyễn Văn An', 'x', 3, '[]']];    // muc rieng nguoi khac
const ctx = { VIETTAT_HEADERS: H, SH_VIETTAT: 'VietTat', VIETTAT_NHOM_MAX: 80, VIETTAT_MAX_IMAGES: 3, String, Number, Date, JSON, Array, Object, RegExp,
  getSheet_: () => ({ getLastRow: () => rows.length + 1, getRange: () => ({ getValues: () => rows }) }) };
vm.createContext(ctx);
vm.runInContext(['_stripVN_', '_vtKey_', '_vtSame_', '_vtNhom_', '_vtImgsFromCell_', '_vtRowToObj_', 'readVietTat_'].map(fn).join('\n'), ctx);
const names = caller => ctx.readVietTat_({ name: caller }).map(x => x.abbr).join(',');
ok(names('Duyên HT') === 'ch,dc', 'dung y nguyen "Duyên HT": thay muc chung + muc rieng cua minh, KHONG thay muc rieng nguoi khac');
ok(names('duyenht') === 'ch,dc', 'LOI GOC: app gui "duyenht" -> truoc day khong khop owner "Duyên HT"; nay thay muc rieng');
ok(names('  Duyen   HT ') === 'ch,dc', 'thua khoang trang / khong dau');
ok(names('DUYÊN ht') === 'ch,dc', 'hoa-thuong lan lon');
ok(names('nguyen van an') === 'ch,tk', 'nguoi khac go "nguyen van an" -> thay muc rieng cua Nguyễn Văn An');
ok(names('') === 'ch' && names(undefined) === 'ch', 'khong ten -> chi muc chung (khong khop owner rong)');
ok(names('Duyen') === 'ch', 'ten NGAN hon ("Duyen") KHONG khop "Duyên HT" (khong khop mot phan)');
ok(names('Trần Thị B') === 'ch', 'ten khac hoan toan -> chi muc chung');
ok(ctx._vtSame_('', '') === false && ctx._vtSame_(null, null) === false && ctx._vtSame_('...', '---') === false, 'rong / toan ky tu la -> KHONG bao gio coi la cung ten');
ok(ctx._vtSame_('Đạt', 'dat') === true && ctx._vtSame_('Thanh Huyền', 'thanhhuyen') === true, 'chu Đ va dau tieng Viet');
ok(ctx._vtSame_('An', 'Bình') === false, 'hai nguoi khac ten van phan biet');
process.exit(bad ? 1 : 0);

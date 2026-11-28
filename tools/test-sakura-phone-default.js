// Test: cánh đào (js/66) — mặc định TẮT trên điện thoại (≤640px) nếu chưa chọn; máy tính bật; đã chọn thì theo lựa chọn.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('js/66-sakura-petals.js', 'utf8');
function fn(name){ const i = src.search(new RegExp('function ' + name + '\\s*\\(')); let j = src.indexOf('{', i), d = 0; for (let k = j; k < src.length; k++){ if (src[k] == '{') d++; else if (src[k] == '}'){ d--; if (!d) return src.slice(i, k + 1); } } }
function run(w, stored){
  const store = stored === undefined ? {} : { ome_sakura: stored };
  const ctx = { KEY: 'ome_sakura', window: { innerWidth: w }, document: { documentElement: { clientWidth: w } }, localStorage: { getItem: k => (k in store ? store[k] : null) } };
  vm.createContext(ctx); vm.runInContext('var KEY="ome_sakura";' + fn('onPhone') + fn('isOn'), ctx); return vm.runInContext('isOn()', ctx);
}
let fail = 0; function ok(c, m){ if (!c){ fail++; console.log('FAIL', m); } else console.log('ok  ', m); }
ok(run(390) === false, 'điện thoại 390px chưa chọn → tắt');
ok(run(640) === false, '640px chưa chọn → tắt');
ok(run(641) === true, '641px chưa chọn → bật');
ok(run(1280) === true, 'máy tính chưa chọn → bật như cũ');
ok(run(390, '1') === true, 'điện thoại đã bấm Bật → bật');
ok(run(1280, '0') === false, 'máy tính đã bấm Tắt → tắt');
console.log(fail ? fail + ' lỗi' : 'TẤT CẢ OK'); process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// js/31 (tổng quan tổ chức) + js/60 (thưởng team): 🤖 → mèo máy qua proCatTag_, fallback "🤖 ". Chạy: node tools/test-ov-tb-cat.js
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
[['js/31-fn-orgoverview.js', '_ovCat_', [['openTeamAnalysisModal()">', 'AI phân tích team</button>'], ['_ovAskAI(this.dataset.n)">', 'Nhờ AI nhận xét &amp; gợi ý việc cần làm</button>']]],
 ['js/60-team-bonus.js', '_tbCat_', [['font-size:13px">', 'Gợi ý phạt từ tin nhắn Pancake</b>']]]].forEach(([f, fn, sites]) => {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const i = src.indexOf('function ' + fn), j = src.indexOf('\n', i);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(i, j), ctx);
  ok(vm.runInContext(fn + '(16)', ctx) === '🤖 ', f + ': chưa nạp proCatTag_ → "🤖 "');
  vm.runInContext('proCatTag_ = function(px){ return "<span>M" + px + "</span>"; }', ctx);
  ok(vm.runInContext(fn + '(16)', ctx) === '<span>M16</span>', f + ': có proCatTag_ → HTML mèo');
  vm.runInContext('proCatTag_ = function(){ throw new Error("x"); }', ctx);
  ok(vm.runInContext(fn + '(16)', ctx) === '🤖 ', f + ': lỗi → "🤖 "');
  sites.forEach(([a, b]) => ok(src.indexOf(a + "' + " + fn + "(16) + '" + b) > 0, f + ': vị trí "' + b.slice(0, 22) + '…" dùng ' + fn));
  ok(!/>🤖 /.test(src), f + ': không còn >🤖 cứng trong HTML');
});
console.log(fail ? 'CÓ LỖI ' + fail : 'TẤT CẢ QUA (' + pass + ')'); process.exit(fail ? 1 : 0);

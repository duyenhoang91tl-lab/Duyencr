// Pancake AI: "Lay goi y moi" phai LUON bao ket qua ngay trong khung goi y (khong chi dong trang thai o dau panel)
// va cho phep che do chi co "Ngu canh / San pham" (khong co tin nhan).
const fs = require('fs');
const bg = fs.readFileSync(__dirname + '/../extension-pancake/pancake-background.js', 'utf8');
const ct = fs.readFileSync(__dirname + '/../extension-pancake/pancake-content.js', 'utf8');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

const a = bg.indexOf('function buildPrompt(payload)');
const b = bg.indexOf('// Soạn 1 trong 3 "câu mở đầu"');
const buildPrompt = new Function(bg.slice(a, b) + ';return buildPrompt;')();
const p1 = buildPrompt({ platform: 'pancake', messages: [], tone: 'Thân thiện', context: 'tỷ hưu', custLines: [] });
ok(/Tư vấn sản phẩm: tỷ hưu/.test(p1) && !/\[TN khách\]/.test(p1), 'khong co tin nhan + co ngu canh -> prompt tu van san pham');
const p2 = buildPrompt({ platform: 'pancake', messages: [{ from: 'customer', text: 'giá?' }], tone: 'Thân thiện', context: 'tỷ hưu', custLines: [] });
ok(/\[TN khách\] Khách: giá\?/.test(p2), 'co tin nhan -> giu nguyen kieu [TN khach]');

const rs = ct.slice(ct.indexOf('async function requestSuggestion'), ct.indexOf('// ── 3 câu mở đầu chủ động'));
ok(/!messages\.length && !ctxText/.test(rs), 'chi chan khi CA tin nhan VA ngu canh deu trong');
ok(/showSugNotice_\("⚠️ " \+ msg, "warn"\)/.test(rs), 'khong doc duoc tin nhan -> bao ngay trong khung goi y');
ok(/showSugNotice_\("⏳ Đang lấy gợi ý/.test(rs), 'co trang thai dang tai canh nut');
ok(/refreshBtn\.disabled = true/.test(rs) && /done_\(\);/.test(rs), 'khoa nut khi dang goi, mo lai khi co phan hoi');
ok(/#pk-ctx-input"\)\.addEventListener\("keydown"/.test(ct), 'Enter o o Ngu canh/San pham = lay goi y');
ok(/AI không trả về gợi ý nào/.test(ct), 'backend tra rong -> bao trong khung goi y');
process.exit(fail ? 1 : 0);

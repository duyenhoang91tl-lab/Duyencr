// Bao mat 4c-3: extension Zalo KHONG con nut/hanh dong xoa don (chi admin xoa tren web CRM).
const fs = require('fs');
const z = fs.readFileSync(__dirname + '/../extension-zalo/zalo-content.js', 'utf8');
const g = fs.readFileSync(__dirname + '/../gas_v13.js', 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
ok(/const ZAI_CAN_DELETE_ORDERS = false;/.test(z), 'co cong tac ZAI_CAN_DELETE_ORDERS = false');
ok(!/deleteDuplicateOrders|findDuplicateOrders/.test(z), 'extension khong con goi deleteDuplicateOrders / findDuplicateOrders');
ok(/async function zaiCheckDuplicates_\(phone\) \{\s*\n[^\n]*\n\s*alert\(/.test(z), 'zaiCheckDuplicates_ chi con stub bao loi');
ok(/async function _zaiDeleteOneOrder_\([^)]*\) \{\s*\n[^\n]*\n\s*alert\(/.test(z), '_zaiDeleteOneOrder_ chi con stub bao loi');
ok(/ZAI_CAN_DELETE_ORDERS && orders\.length > 1\) \? `<button[^`]*zai-dup-btn/.test(z), 'nut kiem tra don trung chi render khi cong tac bat');
ok(/if \(!ZAI_CAN_DELETE_ORDERS\) \{ btn\.remove\(\); return; \}/.test(z), 'nut x tren tung don bi go khi cong tac tat');
const ext = g.match(/var EXT_ALLOWED_ = \{([\s\S]*?)\n\};/)[1];
ok(!/deleteDuplicateOrders/.test(ext), 'EXT_ALLOWED_ khong con deleteDuplicateOrders cho extension nao');
console.log(fail ? '\nFAILED ' + fail : '\nALL ZALO-NO-DELETE TESTS PASSED'); process.exit(fail ? 1 : 0);

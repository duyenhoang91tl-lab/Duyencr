#!/usr/bin/env node
// Test buoc 3a: extension Pancake AI (pancake-background.js) co lenh GET_CHAT_COACH goi GAS chatCoach?conv=... (nhac quy trinh chat).
// Chay: node tools/test-ext-chat-coach.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-background.js'), 'utf8');
let oks = 0, fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); c ? oks++ : fails++; };
const grab = (name) => { const i = src.indexOf('async function ' + name + '('); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const fnCode = grab('handleGetChatCoach');
ok(!!fnCode, 'co ham handleGetChatCoach trong pancake-background.js');
ok(/msg\?\.type === "GET_CHAT_COACH"[\s\S]{0,200}handleGetChatCoach\(msg\.payload\)[\s\S]{0,200}sendResponse\(\{ ok: true, data \}\)[\s\S]{0,200}return true;/.test(src), 'onMessage dinh tuyen GET_CHAT_COACH -> handler -> sendResponse({ok,data}) va giu kenh bat dong bo (return true)');
const calls = []; let store = { gasUrl: 'https://gs.test/exec' }, reply = { ok: true, found: true, reminders: [] };
const ctx = { chrome: { storage: { sync: { get: async () => store } } }, DEFAULT_SETTINGS: { gasUrl: '' }, encodeURIComponent, String, Error, Promise,
  fetch: async (u, o) => { calls.push({ u, o }); return { json: async () => reply }; } };
vm.createContext(ctx); vm.runInContext(fnCode + '; this.H = handleGetChatCoach;', ctx);
(async () => {
  const data = await ctx.H({ conv: 'P1_U1' });
  ok(calls.length === 1 && calls[0].u === 'https://gs.test/exec?action=chatCoach&conv=P1_U1', 'goi dung URL GAS: ...?action=chatCoach&conv=P1_U1');
  ok(calls[0].o.method === 'GET', 'dung GET (chi doc)');
  ok(data.found === true, 'tra ve nguyen object cua GAS');
  store = { gasUrl: 'https://gs.test/exec?x=1' }; await ctx.H({ conv: 'A_B' });
  ok(calls[1].u === 'https://gs.test/exec?x=1&action=chatCoach&conv=A_B', 'URL GAS da co dau ? thi noi bang &');
  await ctx.H({ conv: 'P 1/U&1' }); ok(calls[2].u.endsWith('conv=P%201%2FU%261'), 'ma hoi thoai duoc ma hoa URL (khong chen duoc tham so)');
  const rej = async (p, re) => { try { await p; return false; } catch (e) { return re.test(String(e.message)); } };
  ok(await rej(ctx.H({ conv: '' }), /Thieu ma hoi thoai/), 'thieu c_id -> bao loi (content script an the)');
  ok(await rej(ctx.H({}), /Thieu ma hoi thoai/), 'khong co payload -> bao loi, khong sap');
  store = { gasUrl: '' }; ok(await rej(ctx.H({ conv: 'X' }), /URL Web App GAS/), 'chua cau hinh GAS URL -> bao loi ro');
  store = { gasUrl: 'https://gs.test/exec' };
  reply = { ok: false, code: 'AUTH', error: 'Can dang nhap hoac khoa extension hop le.' }; ok(await rej(ctx.H({ conv: 'X' }), /khoa extension/), 'GAS tu choi (AUTH) -> nem loi de content script an the');
  reply = { error: 'Unknown action' }; ok(await rej(ctx.H({ conv: 'X' }), /Unknown action/), 'GAS cu chua co action -> nem loi');
  reply = null; ok(await rej(ctx.H({ conv: 'X' }), /GAS khong tra ket qua/), 'GAS tra rong -> nem loi, khong sap');
  console.log('\n' + oks + ' OK, ' + fails + ' FAIL'); process.exit(fails ? 1 : 0);
})();

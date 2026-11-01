#!/usr/bin/env node
// Test nut "🚫 Quet tu cam" (Pancake AI, 2026-10-21): (A) GAS scanBannedText_ dung bo phat hien that cua giam sat chat; (B) UI extension (jsdom).
// (B) can jsdom (thieu thi tu bo qua phan B). Chay: node tools/test-pancake-banned-scan.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const gas = fs.readFileSync(path.join(__dirname, '..', 'gas_v13.js'), 'utf8');
const ext = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-content.js'), 'utf8');
const bg = fs.readFileSync(path.join(__dirname, '..', 'extension-pancake', 'pancake-background.js'), 'utf8');
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
function fnSrc(src, name, indent) {
  const i = src.indexOf((indent || '') + 'function ' + name + '('); if (i < 0) throw new Error('khong thay ' + name);
  let d = 0; for (let j = src.indexOf('{', i); j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) return src.slice(i, j + 1); }
}
// ---------- A: server ----------
const names = ['_stripVN_', '_cvNorm_', '_cvHasVN_', '_cvStrip_', '_cvWordCh_', '_cvFindPhrase_', '_cvSplitCsv_', '_cvCompile_', 'cvDetect_', 'scanBannedText_'];
let code = names.map(n => fnSrc(gas, n)).join('\n');
const list = [{ tuCam: 'Thỉnh', thayThe: 'mời' }, { tuCam: 'lộc', thayThe: 'TL' }, { tuCam: 'thiên lộc', thayThe: 'TL' }];
const ctx = { _cvBannedCompiled_: null, String, Object, Array, JSON, Error };
vm.createContext(ctx); vm.runInContext(code, ctx);
ctx._cvBannedCompiled_ = () => ctx._cvCompile_(list, '');
const W = r => r.hits.map(h => h.word).join('|');
ok(W(ctx.scanBannedText_('Dạ em xin Thỉnh vòng về nhà ạ')) === 'Thỉnh', 'co "Thỉnh" -> bat');
ok(W(ctx.scanBannedText_('dạ em xin thỉnh vòng')) === 'Thỉnh', 'khong phan biet hoa/thuong');
ok(W(ctx.scanBannedText_('em xin thinh vong ve nha')) === 'Thỉnh', 'go KHONG DAU (thinh) van bat');
ok(ctx.scanBannedText_('Dạ chào anh chị ạ').hits.length === 0 && ctx.scanBannedText_('Dạ chào anh chị ạ').ok === true, 'tin sach -> hits rong');
ok(ctx.scanBannedText_('   ').hits.length === 0, 'chuoi trong -> khong bat');
ok(W(ctx.scanBannedText_('vòng thiên lộc')) === 'thiên lộc', 'cum dai nuot cum ngan ("thiên lộc" khong bao them "lộc")');
ok(ctx.scanBannedText_('thịnh vượng').hits.length === 0, '"thịnh" (tu khac) KHONG bi bat nham thanh "Thỉnh"');
ok(ctx.scanBannedText_('x'.repeat(9000) + ' Thỉnh').hits.length === 0, 'cat tai 5000 ky tu (khong treo)');
ctx._cvBannedCompiled_ = () => { throw new Error('sheet loi'); };
const er = ctx.scanBannedText_('abc'); ok(er.ok === false && /sheet loi/.test(er.error), 'loi doc danh sach -> ok:false + thong bao, khong nem loi');
ok(/if \(action === 'scanBanned'\)\s+return jsonOut_\(scanBannedText_\(data\.text\)\)/.test(gas), 'doPost co action scanBanned');
ok(/msg\?\.type === "SCAN_BANNED"[\s\S]{0,400}action: "scanBanned"/.test(bg), 'background co handler SCAN_BANNED -> action scanBanned');
// ---------- B: UI ----------
let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch (e) { try { ({ JSDOM } = require('/tmp/jt/node_modules/jsdom')); } catch (e2) { console.log('SKIP phan B: chua cai jsdom'); process.exit(fail ? 1 : 0); } }
const uiNames = ['_readDraftText_', '_banWarnHtml_', 'scanBannedDraft_'];
const uiCode = uiNames.map(n => fnSrc(ext, n, '  ')).join('\n');
function mk(draft, resp, box) {
  const dom = new JSDOM('<!doctype html><body><div id="pk-ai-panel"><button id="pk-ban-btn">🚫 Quét từ cấm</button><div id="pk-ban-result" style="display:none"></div></div>' +
    (box === 'ta' ? '<textarea id="rb"></textarea>' : box === 'ce' ? '<div id="rb" contenteditable="true"></div>' : '') + '</body>', { runScripts: 'outside-only' });
  const w = dom.window, d = w.document; const rb = d.getElementById('rb');
  if (rb && draft != null) { if (box === 'ta') rb.value = draft; else Object.defineProperty(rb, 'innerText', { value: draft, configurable: true }); }
  w.panelEl = d.getElementById('pk-ai-panel'); w.sent = null;
  w._slashGetChatBox_ = () => rb || null; w._lastEditableEl_ = null; w.PK_API_ERR = 'Lỗi API';
  w.escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.safeSendMessage_ = (m, cb) => { w.sent = m; cb(resp); };
  w.eval('const panelEl = window.panelEl; let _lastEditableEl_ = window._lastEditableEl_; const _slashGetChatBox_ = window._slashGetChatBox_; const escapeHtml = window.escapeHtml; const safeSendMessage_ = window.safeSendMessage_; const PK_API_ERR = window.PK_API_ERR;\n' + uiCode + '\nwindow.run = scanBannedDraft_;');
  return { w, out: d.getElementById('pk-ban-result'), btn: d.getElementById('pk-ban-btn') };
}
let t = mk('Dạ em xin Thỉnh vòng ạ', { ok: true, data: { hits: [{ word: 'Thỉnh', thayThe: '' }] } }, 'ta'); t.w.run();
ok(t.w.sent && t.w.sent.type === 'SCAN_BANNED' && t.w.sent.payload.text === 'Dạ em xin Thỉnh vòng ạ', 'gui dung noi dung o tra loi (textarea)');
ok(t.out.textContent === '⚠️ Từ cấm “Thỉnh” không được phép sử dụng nhé!', 'canh bao dung cau Duyen yeu cau: ' + t.out.textContent);
ok(t.out.className === 'pk-ban-warn' && t.out.style.display !== 'none' && t.btn.disabled === false, 'hien khung do + nut bam lai duoc');
t = mk('Thỉnh lộc', { ok: true, data: { hits: [{ word: 'Thỉnh', thayThe: 'mời' }, { word: 'lộc', thayThe: '' }] } }, 'ce'); t.w.run();
ok(/Từ cấm “Thỉnh”, “lộc” không được phép/.test(t.out.textContent) && /Thỉnh” → mời/.test(t.out.textContent), 'nhieu tu (contenteditable) + goi y thay the');
t = mk('Dạ chào chị', { ok: true, data: { hits: [] } }, 'ta'); t.w.run();
ok(t.out.className === 'pk-ban-ok' && /Không có từ cấm/.test(t.out.textContent), 'tin sach -> bao xanh');
t = mk('   ', { ok: true, data: { hits: [] } }, 'ta'); t.w.run();
ok(t.w.sent === null && /trống/.test(t.out.textContent), 'o trong -> khong goi server, nhac go tin');
t = mk(null, null, null); t.w.run();
ok(t.w.sent === null && /Không tìm thấy ô soạn tin/.test(t.out.textContent), 'khong thay o tra loi -> nhac, khong goi server');
t = mk('abc', { ok: false, error: 'Chưa cấu hình URL Web App GAS.' }, 'ta'); t.w.run();
ok(t.out.className === 'pk-ban-info' && /Không quét được từ cấm: Chưa cấu hình/.test(t.out.textContent), 'loi mang/GAS -> bao ro, KHONG bao "sach"');
t = mk('<img src=x onerror=1>Thỉnh', { ok: true, data: { hits: [{ word: '<b>x</b>', thayThe: '' }] } }, 'ta'); t.w.run();
ok(t.out.innerHTML.indexOf('<b>') < 0, 'tu tra ve duoc escape (khong chen HTML)');
process.exit(fail ? 1 : 0);

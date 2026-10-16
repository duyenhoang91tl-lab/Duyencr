// Test: danh sach hoi thoai Social > Chat (js/42 _scRenderList) PHAI cau truc dung — moi dong .sc-conv la con TRUC TIEP cua #sc-convs, KHONG long nhau.
// Bug that (commit 99129f2 UI Pro P5a, phat hien 16/10): mau HTML mo <div.sc-conv> + <div.sc-conv-body> nhung chi dong 1 </div> -> moi dong sau
// bi long vao dong truoc, xep ngang, chu bi ep hep (body rong 0px), dong dau cao 305px. Test chay bang jsdom: node tools/test-sc-list-markup.js (can npm i jsdom).
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const dom = new JSDOM('<body><div id="toast"></div><div id="tab-chat" style="display:flex"><div id="chat-wrap"></div></div></body>', { url: 'https://crm.test/', runScripts: 'outside-only' });
const w = dom.window; let ok = 0, fail = 0;
const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
w.eval('var gsUrl="https://gs.example/exec"; var _activeV9Tab="chat"; function proInitials_(n){return String(n||"?")[0];}');
w.eval(R('js/01-fn-splitmulti.js').match(/function _foldVi\(str\)\{[\s\S]*?\n\}/)[0]);
w.fetch = async () => ({ json: async () => ({ ok: true, conversations: [] }) });
w.eval(R('js/41-fn-pkchat.js')); w.eval(R('js/42-fn-socialchat.js'));
w.renderSocialChatTab();
const convs = [
  { id: 'A', name: 'Hạnh Dungg', phone: '0867321200', lastAt: '2026-10-16T03:00:00+00:00', lastText: 'Chào', seen: false, tags: [{ id: '1', t: 'L1', c: '#0a7a3a' }], assignees: ['Le Ninh'] },
  { id: 'B', name: 'Quynh', phone: '', lastAt: '2026-10-16T03:01:00+00:00', lastText: 'Hello', seen: true, tags: [], assignees: [] },
  { id: 'C', name: '<b>x</b>', phone: '', lastAt: '2026-10-16T03:02:00+00:00', lastText: '', seen: false, tags: [], assignees: [] }];
w.eval('_sc.convs = ' + JSON.stringify(convs) + '; _scRenderList();');
const box = w.document.getElementById('sc-convs');
t('3 hoi thoai -> dung 3 .sc-conv la con TRUC TIEP cua #sc-convs', [...box.children].filter(e => e.classList.contains('sc-conv')).length === 3 && box.children.length === 3);
t('khong co .sc-conv nao long ben trong .sc-conv khac', box.querySelectorAll('.sc-conv .sc-conv').length === 0);
t('moi dong co dung 1 avatar + 1 thân (.sc-conv-body) la con truc tiep', [...box.children].every(r => r.querySelectorAll(':scope > .sc-av').length === 1 && r.querySelectorAll(':scope > .sc-conv-body').length === 1));
t('thân dong chua ten/gio/tin cuoi (khong tran ra ngoai)', [...box.children].every(r => r.querySelector(':scope > .sc-conv-body > .sc-conv-n') && r.querySelector(':scope > .sc-conv-body > .sc-conv-t')));
t('dong dau co dau cham chua doc + the + nguoi xu ly nam TRONG than', !!box.children[0].querySelector('.sc-conv-body > .sc-dot') && !!box.children[0].querySelector('.sc-conv-body > .sc-conv-g') && !!box.children[0].querySelector('.sc-conv-body > .sc-conv-s'));
t('ten chua HTML duoc escape (khong tao the lam vo cau truc)', !box.querySelector('.sc-conv b b') && box.children[2].textContent.includes('<b>x</b>'));
// cau truc cua CHUOI HTML: so <div mo = so </div> dong cho moi dong
const html = box.innerHTML; const rows = html.split(/(?=<div class="sc-conv)/);
t('so the <div> mo = so the </div> dong (chuoi sinh ra can bang)', (html.match(/<div\b/g) || []).length === (html.match(/<\/div>/g) || []).length);
w.eval('_sc.convs = []; _scRenderList();');
t('khong co hoi thoai -> thong bao, khong dong nao', w.document.querySelectorAll('#sc-convs .sc-conv').length === 0 && /Không có hội thoại/.test(w.document.getElementById('sc-convs').textContent));
console.log(ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);

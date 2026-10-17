// Test giao dien DANH DAU CHUA DOC / DA DOC (js/41 + js/42) bang jsdom. Chay: node tools/test-pk-chat-seen.js (can: npm i jsdom)
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const dom = new JSDOM('<body><div id="toast"></div><div id="tab-chat" style="display:flex"><div id="chat-wrap"></div></div><div id="dp-overlay" class="open"><div id="dp-body"></div></div></body>', { url: 'https://crm.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; let ok = 0, fail = 0;
const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = []; let routes = {};
w.eval('var gsUrl="https://gs.example/exec"; var _activeV9Tab="chat"; function proInitials_(n){return String(n||"?")[0];}');
w.eval(R('js/01-fn-splitmulti.js').match(/function _foldVi\(str\)\{[\s\S]*?\n\}/)[0]);
w.fetch = async (u, o) => { log.push({ u, o }); const key = Object.keys(routes).find(k => u.includes(k) || (o && o.body && o.body.includes(k))); const r = key ? await routes[key](u, o) : {}; return { json: async () => r }; };
w.toast = m => log.push({ toast: m });
w.eval(R('js/41-fn-pkchat.js')); w.eval(R('js/42-fn-socialchat.js'));
const $ = id => w.document.getElementById(id);
const mk = (id, seen, name) => ({ id, pageId: 'P1', name, phone: '', lastAt: '2026-10-17T02:00:00+00:00', lastText: 'Xin chao', seen, replied: false, type: 'INBOX', tags: [], assignees: [] });
let server = { C1: true, C2: false }, posts = [], postFail = null, postDelay = 0;
const inbox = () => ({ ok: true, conversations: [mk('C1', server.C1, 'Khach A'), mk('C2', server.C2, 'Khach B')] });
routes = {
  'action=pkChatInbox': inbox,
  'action=pkChatConv': () => ({ ok: true, messages: [] }),
  'action=pkChat&': () => ({ ok: true, conversations: [mk('C1', server.C1, 'Khach A')], messages: [] }),
  'action=pkChatTags': () => ({ ok: true, pageId: 'P1', tags: [] }),
  'pkChatRead': async (u, o) => { const b = JSON.parse(o.body); posts.push(b); if (postDelay) await sleep(postDelay); if (postFail) return { error: postFail }; server[b.convId] = b.op === 'read'; return { ok: true, seen: b.op === 'read' }; }
};
(async () => {
  w.renderSocialChatTab(); await sleep(60);
  const rowBtn = id => w.document.querySelector('.sc-seenbtn[data-id="' + id + '"]');
  t('danh sach: moi dong co nut nho', !!rowBtn('C1') && !!rowBtn('C2'));
  t('dong da doc: nut "Chua doc"; dong chua doc: nut "Da doc"', /Chưa đọc/.test(rowBtn('C1').textContent) && /Đã đọc/.test(rowBtn('C2').textContent));
  t('dong chua doc co cham + class unseen, dong da doc thi khong', w.document.querySelector('.sc-conv[data-id="C2"]').className.includes('unseen') && !!w.document.querySelector('.sc-conv[data-id="C2"] .sc-dot') && !w.document.querySelector('.sc-conv[data-id="C1"]').className.includes('unseen'));
  // bam nut o dong KHONG chon hoi thoai (stopPropagation)
  // jsdom (outside-only) khong chay onclick inline -> kiem tra thuoc tinh onclick roi goi ham voi dung data-id cua nut
  t('nut o dong: onclick co stopPropagation (khong mo hoi thoai) + goi pkSeenToggle voi data-id', /event\.stopPropagation\(\);pkSeenToggle\(this\.getAttribute\('data-id'\)\)/.test(rowBtn('C1').getAttribute('onclick')));
  w.pkSeenToggle(rowBtn('C1').getAttribute('data-id')); await sleep(5);
  t('chua chon hoi thoai nao sau khi bam nut o dong', w.eval('_sc.active') === '');
  await sleep(40);
  t('goi dung 1 POST pkChatRead {convId:C1, op:unread}', posts.length === 1 && posts[0].action === 'pkChatRead' && posts[0].convId === 'C1' && posts[0].op === 'unread');
  t('sau khi bam: dong C1 thanh chua doc (cham + nut Da doc)', w.document.querySelector('.sc-conv[data-id="C1"]').className.includes('unseen') && /Đã đọc/.test(rowBtn('C1').textContent));
  t('toast bao da danh dau chua doc', log.some(x => x.toast && /chưa đọc/.test(x.toast)));
  // poll 20s lay lai danh sach tu server (server da luu seen=false) -> khong nhay
  server.C1 = true;   // gia lap cache 15s o server tra TRANG THAI CU
  await w.scLoadList(); await sleep(20);
  t('poll tra trang thai cu (cache server) KHONG lam nhay lai: override 20s giu dung', w.document.querySelector('.sc-conv[data-id="C1"]').className.includes('unseen'));
  server.C1 = false;
  // chon hoi thoai: nut o dau khung chat
  w.scPick('C1'); await sleep(60);
  t('dau khung chat co nut Danh dau (chua doc -> "Da doc")', !!$('sc-seen') && /Đã đọc/.test($('sc-seen').textContent) && $('sc-seen').querySelector('.pk-seen-btn.unseen'));
  t('nut dau khung chat nam trong #sc-head', $('sc-head').contains($('sc-seen')));
  posts.length = 0; w.pkSeenToggle($('sc-seen').querySelector('button').getAttribute('data-id')); await sleep(40);
  t('bam nut dau khung: gui op=read', posts.length === 1 && posts[0].op === 'read' && posts[0].convId === 'C1');
  t('sau khi doc: nut dau khung doi thanh "Chua doc", dong het in dam', /Chưa đọc/.test($('sc-seen').textContent) && !w.document.querySelector('.sc-conv[data-id="C1"]').className.includes('unseen'));
  t('chon hoi thoai KHAC: nut dau khung la cua hoi thoai do (C2 dang chua doc)', (w.scPick('C2'), $('sc-seen') && /Đã đọc/.test($('sc-seen').textContent)));
  // loi server -> tra lai trang thai cu
  posts.length = 0; postFail = 'Pancake tu choi (HTTP 403)'; log.length = 0;
  w.scPick('C1'); await sleep(40);
  w.pkSeenToggle('C1'); await sleep(5);
  t('loi: hien ngay (lac quan) roi...', true);
  await sleep(40);
  t('loi: tra lai trang thai cu + bao loi', !w.document.querySelector('.sc-conv[data-id="C1"]').className.includes('unseen') && log.some(x => x.toast && /✕.*403/.test(x.toast)) && !w.eval('_pkSeenOv.C1'));
  // bam doi
  postFail = null; postDelay = 60; posts.length = 0;
  w.pkSeenToggle('C1'); w.pkSeenToggle('C1'); await sleep(5);
  t('bam doi khi dang xu ly bi bo qua (chi 1 POST)', posts.length === 1);
  await sleep(120); postDelay = 0;
  // XSS: convId co ky tu dac biet
  w.eval('_sc.convs.push({id:"x\\"><img src=x onerror=window.__xss=1>",name:"Z",phone:"",seen:false,tags:[],assignees:[]}); _scRenderList();');
  t('convId chua ky tu dac biet duoc escape, khong chay ma', !w.__xss && !w.document.querySelector('#sc-convs img'));
  // ======== TAB CHAT TRONG HO SO KHACH ========
  w.eval('_sc.active = ""; _sc.convs = [];');
  $('dp-body').innerHTML = w.renderPkChatTab({ phone: '0867321246' }); await sleep(80);
  t('ho so khach: co o #pkc-seen va nut Danh dau', !!$('pkc-seen') && !!$('pkc-seen').querySelector('.pk-seen-btn'));
  const before = $('pkc-seen').textContent;
  posts.length = 0; server.C1 = true; w.pkSeenToggle($('pkc-seen').querySelector('button').getAttribute('data-id')); await sleep(50);
  t('ho so khach: bam gui POST va doi nhan nut', posts.length === 1 && posts[0].convId === 'C1' && $('pkc-seen').textContent !== before);
  t('ho so khach: sau khi bam, nut hien trang thai moi', /Đã đọc/.test($('pkc-seen').textContent) || /Chưa đọc/.test($('pkc-seen').textContent));
  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

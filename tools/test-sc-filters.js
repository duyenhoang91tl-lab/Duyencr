// Test giao dien BO LOC + THU MUC cua Social > Chat (js/42) bang jsdom. Chay: NODE_PATH=<jsdom> node tools/test-sc-filters.js
const { JSDOM } = require('jsdom'); const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const dom = new JSDOM('<body><div id="toast"></div><div id="tab-chat" style="display:flex"><div id="chat-wrap"></div></div></body>', { url: 'https://crm.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window; let ok = 0, fail = 0;
const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const urls = []; let inboxDelay = 0, optsReply = null, conv = [];
w.eval('var gsUrl="https://gs.example/exec"; var _activeV9Tab="chat"; function proInitials_(n){return String(n||"?")[0];}');
w.eval(R('js/01-fn-splitmulti.js').match(/function _foldVi\(str\)\{[\s\S]*?\n\}/)[0]);
const mk = (id, name, extra) => Object.assign({ id, pageId: 'P1', name, phone: '', lastAt: '2026-10-18T02:00:00+00:00', lastText: 'Xin chao', seen: true, replied: false, type: 'INBOX', tags: [], assignees: [] }, extra || {});
w.fetch = async (u) => { urls.push(u);
  if (/action=pkChatInbox/.test(u)) { if (inboxDelay) await sleep(inboxDelay); return { json: async () => ({ ok: true, conversations: conv }) }; }
  if (/action=pkChatFilterOpts/.test(u)) return { json: async () => optsReply };
  return { json: async () => ({ ok: true, messages: [] }) }; };
w.toast = () => {};
w.eval(R('js/41-fn-pkchat.js')); w.eval(R('js/42-fn-socialchat.js'));
const $ = id => w.document.getElementById(id);
const inboxUrls = () => urls.filter(u => /action=pkChatInbox/.test(u));
const lastInbox = () => inboxUrls().pop() || '';
(async () => {
  conv = [mk('C1', 'Khach A', { phone: '0912345678', tags: [{ t: 'VIP', c: '#ff0000' }] }), mk('C2', 'Khach B')];
  optsReply = { ok: true, pages: [{ id: 'P1', name: 'Page Mot', kenh: 'Online' }, { id: 'P2', name: 'Page Hai', kenh: '' }], nguon: ['Cua hang', 'Online'], staff: [{ id: 'S1', name: 'Hoa' }, { id: 'S2', name: 'An' }] };
  w.renderSocialChatTab(); await sleep(60);
  t('mac dinh: thanh nut Bo loc + Thu muc co mat', !!$('sc-fbtn') && !!$('sc-folbtn'));
  t('mac dinh: Thu muc (cac chip) AN', $('sc-folders') && $('sc-folders').style.display === 'none');
  t('mac dinh: panel Bo loc AN va chua tai danh sach', $('sc-fpanel').style.display === 'none' && urls.every(u => !/pkChatFilterOpts/.test(u)));
  t('mac dinh: khong gui tham so loc', !/[&](type|un|ph|page|nguon|nv)=/.test(lastInbox()));
  t('mac dinh: khong hien "Xoa loc"', $('sc-fx').style.display === 'none');
  w.scToggleFolders(); t('bam Thu muc -> hien cac chip', $('sc-folders').style.display === '' && /Tất cả/.test($('sc-folders').textContent));
  w.scToggleFolders(); t('bam lai -> an', $('sc-folders').style.display === 'none');
  w.scToggleFilters(); await sleep(30);
  t('bam Bo loc -> hien panel va tai danh sach 1 lan', $('sc-fpanel').style.display !== 'none' && urls.filter(u => /pkChatFilterOpts/.test(u)).length === 1);
  const sels = $('sc-fpanel').querySelectorAll('select'); t('panel co 6 o chon: Loai / Chua tra loi / SDT / Page / Nguon / Nhan vien', sels.length === 6);
  const txt = $('sc-fpanel').textContent; t('o Page co ten + kenh; Nguon; Nhan vien', /Page Mot · Online/.test(txt) && /Cua hang/.test(txt) && /Hoa/.test(txt) && /Đã đọc nhưng chưa trả lời/.test(txt) && /Có SĐT/.test(txt));
  w.scToggleFilters(); w.scToggleFilters(); await sleep(20);
  t('mo/dong nhieu lan khong tai lai danh sach', urls.filter(u => /pkChatFilterOpts/.test(u)).length === 1);

  w.scSetF('ph', '1'); await sleep(40);
  t('loc "Co SDT" -> gui &ph=1', /&ph=1(&|$)/.test(lastInbox()));
  t('co loc: nut Bo loc sang mau + dem (1), hien Xoa loc', /\(1\)/.test($('sc-fn').textContent) && $('sc-fbtn').className.includes('on') && $('sc-fx').style.display === '');
  w.scSetF('page', 'P1'); w.scSetF('nv', 'S2'); w.scSetF('nguon', 'Online'); w.scSetF('un', 'wait'); w.scSetF('type', 'COMMENT'); await sleep(60);
  const u = lastInbox(); t('gop du 6 bo loc trong 1 yeu cau', ['ph=1', 'page=P1', 'nv=S2', 'nguon=Online', 'un=wait', 'type=COMMENT'].every(x => u.includes('&' + x)) && /\(6\)/.test($('sc-fn').textContent));
  w.eval('_sc.q = "Lan"'); w.scSetF('ph', '0'); await sleep(40);
  t('ket hop o tim kiem + bo loc', /&q=Lan/.test(lastInbox()) && /&ph=0/.test(lastInbox()));
  w.eval('_sc.q = ""');
  w.scSetF('bad', 'x'); t('khoa loc la bi bo qua', !('bad' in w.eval('_sc.f')));
  // dang tai do thi doi loc
  inboxDelay = 80; const n0 = inboxUrls().length; w.scSetF('ph', '1'); await sleep(5); w.scSetF('nv', ''); await sleep(5); w.scSetF('nv', 'S1');
  await sleep(300); inboxDelay = 0;
  t('doi loc khi dang tai do: tai lai DUNG 1 lan sau do voi bo loc moi nhat', inboxUrls().length - n0 === 2 && /&nv=S1/.test(lastInbox()));
  // trang thai trong
  conv = []; w.scSetF('page', 'P2'); await sleep(40);
  t('khong co ket qua: bao "khong khop bo loc"', /khớp bộ lọc/.test($('sc-convs').textContent));
  // xoa loc
  conv = [mk('C1', 'Khach A'), mk('C2', 'Khach B')]; w.scClearFilters(); await sleep(40);
  t('Xoa loc: het tham so, het dem, an nut Xoa loc', !/[&](type|un|ph|page|nguon|nv)=/.test(lastInbox()) && $('sc-fn').textContent === '' && $('sc-fx').style.display === 'none');
  t('Xoa loc: cac o chon ve Tat ca', Array.from($('sc-fpanel').querySelectorAll('select')).every(s => s.value === ''));
  // thu muc van loc duoc + hien (1) khi dang chon ma dang an
  conv = [mk('C1', 'Khach A', { seen: false, tags: [{ t: 'VIP', c: '#ff0000' }] }), mk('C2', 'Khach B')]; await w.scLoadList(); await sleep(20);
  w.scFolder('@unseen'); t('chon thu muc Chua doc -> chi con 1 hoi thoai', $('sc-convs').querySelectorAll('.sc-conv').length === 1);
  t('thu muc dang chon nhung dang AN: nut Thu muc co (1) + Xoa loc hien', /\(1\)/.test($('sc-foln').textContent) && $('sc-fx').style.display === '');
  w.scClearFilters(); await sleep(30); t('Xoa loc cung bo luon thu muc dang chon', w.eval('_sc.fold') === '' && $('sc-convs').querySelectorAll('.sc-conv').length === 2);
  // loi tai danh sach
  w.eval('_sc.opts = null; _sc.fopen = false;'); optsReply = { error: 'Doc danh sach loc loi: x' }; w.scToggleFilters(); await sleep(40);
  t('loi tai danh sach: hien ghi chu loi, cac o co dinh (Loai/SDT) van dung duoc', /Doc danh sach loc loi/.test($('sc-fpanel').textContent) && $('sc-fpanel').querySelectorAll('select').length === 6);
  // XSS
  w.eval('_sc.opts = {pages:[{id:"x\\"><img src=x onerror=window.__x=1>",name:"<b>P</b>",kenh:""}], nguon:["<i>n</i>"], staff:[{id:"s",name:"<u>u</u>"}]}; _sc.fopen = true; _scRenderFPanel_();');
  t('ten Page/Nguon/Nhan vien duoc escape, khong chay ma', !w.__x && !$('sc-fpanel').querySelector('img,b,i,u'));
  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

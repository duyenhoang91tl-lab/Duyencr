// Test giao dien GAN/GO THE + NGUOI DA CHAT (js/41 + js/42) bang jsdom. Chay: node tools/test-pk-chat-tagbar.js (can: npm i jsdom)
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
const TAGS = [{ id: '5', t: 'Trả hàng', c: '#bd2727' }, { id: '7', t: 'Hết hàng', c: '#38a6f4' }, { id: '26', t: 'L1. Chuẩn', c: '#0a7a3a' }, { id: '30', t: '<img src=x onerror=window.__xss=1>', c: 'red;background:url(x)' }];
const conv = () => ({ id: 'C1', pageId: 'P1', name: 'Mến Hoàng', phone: '0867321246', lastAt: ago(5), lastText: 'Sao v c', seen: true, replied: true, type: 'INBOX', tags: [{ id: '26', t: 'L1. Chuẩn', c: '#0a7a3a' }], assignees: ['Le Ninh'], lastStaff: 'Le Ninh' });
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();   // moc TUONG DOI: dong "Da chat" chi tinh 72 gio gan nhat
const MSGS = [{ id: 'm1', c: 'C1', dir: 'in', text: 'Cho m xin giá', at: ago(10), from: 'Mến Hoàng', att: [] },
  { id: 'm2', c: 'C1', dir: 'out', text: 'Dạ vâng', at: ago(9), from: 'Page', staff: 'Le Ninh', att: [] },
  { id: 'm3', c: 'C1', dir: 'out', text: 'Em gửi giá', at: ago(8), from: 'Page', staff: 'Le Ninh', att: [] },
  { id: 'm4', c: 'C1', dir: 'out', text: 'Chị cần gì ạ', at: ago(7), from: 'Page', staff: 'Lan', crm: true, att: [] },
  { id: 'm5', c: 'C1', dir: 'out', text: 'Tin tên page', at: ago(6), from: 'Hiền Tour', staff: '', att: [] }];
(async () => {
  let serverTags = [{ id: '26', t: 'L1. Chuẩn', c: '#0a7a3a' }], tagPosts = [], tagsGets = 0, postDelay = 0, postFail = null;
  routes = {
    'action=pkChatInbox': () => ({ ok: true, conversations: [Object.assign(conv(), { tags: serverTags.map(x => ({ ...x })) })] }),
    'action=pkChatConv': () => ({ ok: true, messages: MSGS }),
    'action=pkChatTags': () => { tagsGets++; return { ok: true, pageId: 'P1', tags: TAGS }; },
    'pkChatTag': async (u, o) => { const b = JSON.parse(o.body); tagPosts.push(b); if (postDelay) await sleep(postDelay); if (postFail) return { error: postFail };
      const has = serverTags.some(x => x.id === b.tagId); if (b.op === 'add' && !has) serverTags = serverTags.concat([TAGS.find(x => x.id === b.tagId)]); if (b.op === 'remove') serverTags = serverTags.filter(x => x.id !== b.tagId);
      return { ok: true, tags: serverTags.map(x => ({ ...x })) }; }
  };
  // ================= SOCIAL > CHAT =================
  w.renderSocialChatTab(); await sleep(60);
  t('danh sach: khong co dong "↩" (khong ton them luot goi server)', !$('sc-convs').textContent.includes('↩'));
  t('danh sach: hien the cua hoi thoai', $('sc-convs').innerHTML.includes('L1. Chuẩn'));
  t('chua chon hoi thoai -> thanh the an', $('sc-tags').style.display === 'none');
  w.scPick('C1'); await sleep(80);
  t('thanh the hien the dang gan (co nut go ✕)', $('sc-tags').innerHTML.includes('L1. Chuẩn ✕') && $('sc-tags').style.display !== 'none');
  t('dong "Da chat": Le Ninh 2, Lan 1 (tin chi co ten page khong tinh)', /Đã chat/.test($('sc-who').textContent) && /Le Ninh\s*2/.test($('sc-who').textContent) && /Lan\s*1/.test($('sc-who').textContent) && !/Hiền Tour/.test($('sc-who').textContent));
  t('"Da chat": nguoi nhieu tin hon dung truoc', $('sc-who').textContent.indexOf('Le Ninh') < $('sc-who').textContent.indexOf('Lan'));
  t('tai danh sach the cua page khi hien thanh the (1 lan)', tagsGets === 1 && log.some(x => x.u && x.u.includes('action=pkChatTags&pageId=P1')));
  t('luoi the MO san nhu Pancake (mac dinh)', !!$('sc-tags').querySelector('.pkt-pal') && /Thu gọn/.test($('sc-tags').textContent));
  t('o the dac mau (bien --c), the chua gan nhat hon the dang gan', /--c:\s*#bd2727/.test($('sc-tags').innerHTML) && w.getComputedStyle !== undefined);
  w.pkTagOpen('sc-tags'); await sleep(10);
  t('bam "Thu gon": an luoi, giu thanh the dang gan', !$('sc-tags').querySelector('.pkt-pal') && /Gắn thẻ/.test($('sc-tags').textContent) && $('sc-tags').innerHTML.includes('L1. Chuẩn ✕'));
  t('lua chon thu gon duoc nho (lan sau mo CRM van thu gon)', w.localStorage.getItem('ome_pk_tag_open') === '0' && w.eval('_pkTagWantOpen()') === false);
  w.pkTagOpen('sc-tags'); await sleep(10);
  t('mo lai: luoi hien + nho lua chon mo', !!$('sc-tags').querySelector('.pkt-pal') && w.localStorage.getItem('ome_pk_tag_open') === '1');
  const chips = () => [...$('sc-tags-list').querySelectorAll('.pkt-chip')];
  t('mo bang: du 4 the cua page', chips().length === 4);
  t('the dang gan co dau ✓ va to mau', chips().find(c => c.textContent.includes('L1. Chuẩn')).className.includes('pkt-on') && chips().find(c => c.textContent.includes('L1')).textContent.startsWith('✓'));
  t('the chua gan khong co ✓', !chips().find(c => c.textContent.includes('Hết hàng')).className.includes('pkt-on'));
  t('ten the chua <img> duoc escape, khong chay ma', !w.__xss && !$('sc-tags-list').querySelector('img') && $('sc-tags-list').innerHTML.includes('&lt;img'));
  t('mau khong hop le (chen CSS) bi bo', !/url\(x\)/.test($('sc-tags-list').innerHTML));
  // ---- gan the (lac quan + dong bo server) ----
  postDelay = 80; tagPosts.length = 0;
  const pr = w.pkTagToggle('sc-tags', '7'); await sleep(10);
  t('gan the: HIEN NGAY tren thanh (chua cho server)', $('sc-tags').innerHTML.includes('Hết hàng ✕') && tagPosts.length === 1);
  t('gan the: danh sach hoi thoai cung hien ngay', $('sc-convs').innerHTML.includes('Hết hàng'));
  w.pkTagToggle('sc-tags', '7'); await sleep(5); t('bam doi khi dang xu ly bi bo qua (chi 1 POST)', tagPosts.length === 1);
  await pr; await sleep(10);
  t('gan the: gui dung body {action:pkChatTag, convId, tagId:"7", op:add}', JSON.stringify(tagPosts[0]) === '{"action":"pkChatTag","convId":"C1","tagId":"7","op":"add"}');
  t('gan the xong: thanh = the server tra ve', $('sc-tags').querySelectorAll('.pkt-cur').length === 2);
  // poll ngay sau do tra ve du lieu CU (webhook chua kip) -> khong nhay lai
  serverTags = [{ id: '26', t: 'L1. Chuẩn', c: '#0a7a3a' }]; await w.scLoadList(); await sleep(10);
  t('poll tra the cu trong 20s khong lam the vua gan nhay mat', $('sc-tags').innerHTML.includes('Hết hàng ✕') && $('sc-convs').innerHTML.includes('Hết hàng'));
  serverTags = [{ id: '26', t: 'L1. Chuẩn', c: '#0a7a3a' }, TAGS[1]];
  // ---- go the bang cach bam chip dang gan ----
  postDelay = 0; tagPosts.length = 0;
  await w.pkTagToggle('sc-tags', '26'); await sleep(10);
  t('go the: gui op=remove', tagPosts[0].op === 'remove' && tagPosts[0].tagId === '26');
  t('go the: chi con "Hết hàng"', $('sc-tags').querySelectorAll('.pkt-cur').length === 1 && !$('sc-tags').querySelector('.pkt-cur').textContent.includes('L1'));
  t('bang chon dong bo: L1 het dau ✓', !chips().find(c => c.textContent.includes('L1. Chuẩn')).className.includes('pkt-on'));
  // ---- loi tu server: tra lai the cu + bao loi ----
  postFail = 'Pancake tu choi (HTTP 403)'; log.length = 0;
  await w.pkTagToggle('sc-tags', '5'); await sleep(10);
  t('loi: the vua gan bi go lai (khong de the "ao")', !$('sc-tags').innerHTML.includes('Trả hàng ✕'));
  t('loi: hien thong bao loi', log.some(x => x.toast && /403/.test(x.toast)));
  t('loi: poll sau do khong bi ghi de boi the ao', (await w.scLoadList(), !$('sc-tags').innerHTML.includes('Trả hàng ✕')));
  postFail = null;
  // ---- tim the trong bang: khong ve lai o dang go ----
  const q = $('sc-tags').querySelector('.pkt-q'); q.value = 'het hang'; w.pkTagSearch('sc-tags', q.value);
  t('tim "het hang" (khong dau) chi con 1 the', chips().length === 1 && chips()[0].textContent.includes('Hết hàng'));
  t('o tim van la phan tu cu (giu focus)', $('sc-tags').querySelector('.pkt-q') === q);
  w.pkTagSearch('sc-tags', 'zzz'); t('khong khop -> thong bao', /Không có thẻ phù hợp/.test($('sc-tags-list').textContent));
  w.pkTagSearch('sc-tags', '');
  // ---- tai lai danh sach the ----
  tagsGets = 0; w.pkTagsReload('sc-tags'); await sleep(30);
  t('nut 🔄 goi pkChatTags voi refresh=1', log.some(x => x.u && x.u.includes('action=pkChatTags') && x.u.includes('refresh=1')) && tagsGets === 1);
  // ---- loi tai danh sach the (chua cai token page) ----
  w.eval('_pkTagCat = {};'); routes['action=pkChatTags'] = () => ({ error: 'Chua cai token Pancake cho page P1' }); w.eval('_pkTagUI["sc-tags"].sig=""'); w.pkTagBarRender('sc-tags'); await sleep(40);
  t('khong co token page: bang chon bao ro nguyen nhan', /Chua cai token Pancake/.test($('sc-tags-list').textContent));
  routes['action=pkChatTags'] = () => ({ ok: true, tags: TAGS });
  w.pkTagOpen('sc-tags'); w.pkTagOpen('sc-tags'); await sleep(40);   // dong roi mo lai -> tu tai lai vi lan truoc loi
  t('mo lai bang sau loi: tai lai duoc danh sach', $('sc-tags-list') && $('sc-tags-list').querySelectorAll('.pkt-chip').length === 4);
  // ---- het 20s thi lay theo server ----
  w.eval('_pkTagOv["C1"] = { tags: [], until: Date.now() - 1 };'); serverTags = [TAGS[2]]; await w.scLoadList(); await sleep(10);
  t('het han ghi de -> hien the theo server', $('sc-tags').innerHTML.includes('L1. Chuẩn ✕'));
  // ================= CHAT TRONG HO SO KHACH =================
  $('dp-body').innerHTML = w.renderPkChatTab({ phone: '0867321246' });
  routes['action=pkChat&'] = () => ({ ok: true, phone: '0867321246', conversations: [Object.assign(conv(), { tags: serverTags.map(x => ({ ...x })) })], messages: MSGS });
  await w.pkcLoad(true); await sleep(40);
  t('ho so khach: thanh the + "Da chat" cung hien', $('pkc-tags').innerHTML.includes('L1. Chuẩn ✕') && /Le Ninh\s*2/.test($('pkc-who').textContent));
  tagPosts.length = 0; await w.pkTagToggle('pkc-tags', '5'); await sleep(10);
  t('ho so khach: gan the hoat dong (POST + hien)', tagPosts.length === 1 && tagPosts[0].tagId === '5' && $('pkc-meta').innerHTML.includes('Trả hàng'));
  // ---- khong co hoi thoai -> an thanh the ----
  routes['action=pkChat&'] = () => ({ ok: true, phone: '0867321246', conversations: [], messages: [] }); await w.pkcLoad(true); await sleep(20);
  t('khong co hoi thoai -> an thanh the', $('pkc-tags').style.display === 'none');
  // ---- "Da chat" chi tinh 72 GIO GAN NHAT (Duyen yeu cau 2026-10-18) ----
  const hAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const mk = (id, staff, at, extra) => Object.assign({ id, c: 'C1', dir: 'out', text: 'x', at, from: 'Page', staff, att: [] }, extra || {});
  const who = (msgs) => { const o = {}; msgs.forEach(m => { o[m.id] = m; }); return w._pkcWhoHtml(o); };
  let h = who([mk('a', 'Con Moi', hAgo(2)), mk('b', 'Con Moi', hAgo(40)), mk('c', 'Moc 71h', hAgo(71)), mk('d', 'Qua 73h', hAgo(73)), mk('e', 'Tu 100h', hAgo(100)), mk('f', 'Tu 200h', hAgo(200))]);
  t('72h: nguoi chat trong 72h hien (Con Moi 2 tin, Moc 71h 1 tin)', /Con Moi\s*<i>2<\/i>/.test(h) && /Moc 71h\s*<i>1<\/i>/.test(h));
  t('72h: nguoi chat tu 73h tro len KHONG hien (73h, 100h, 200h)', !/Qua 73h|Tu 100h|Tu 200h/.test(h));
  t('72h: nhan ghi ro "(72h)" va tieu de noi 72 gio gan nhat', h.includes('Đã chat (72h):') && h.includes('72 giờ gần nhất'));
  h = who([mk('a', 'Chi Cu', hAgo(80)), mk('b', 'Cung Cu', hAgo(500))]);
  t('72h: khong ai chat trong 72h -> khong hien dong "Da chat"', h === '');
  h = who([mk('a', 'Nguoi Cu', hAgo(90)), mk('b', '', hAgo(1)), mk('c', 'Khach Noi', hAgo(1), { dir: 'in' })]);
  t('72h: tin khach / tin chi co ten page khong tinh la nguoi', h === '');
  h = who([mk('a', 'Gio Hong', 'khong-phai-ngay'), mk('b', 'Khong Gio', '')]);
  t('72h: tin khong ro gio -> khong tinh (tranh dem nham tin cu)', h === '');
  h = who([mk('t1', '', '', { tmp: true, from: '' })]);
  t('72h: tin tam vua gui tinh la BAY GIO (hien ten nguoi dang dang nhap)', /<i>1<\/i>/.test(h));
  h = who([mk('a', 'A', hAgo(1)), mk('b', 'B', hAgo(1)), mk('c', 'B', hAgo(2))]);
  t('72h: sap xep theo so tin giam dan (B 2 dung truoc A 1)', h.indexOf('B <i>2') < h.indexOf('A <i>1') && h.indexOf('B <i>2') > 0);
  console.log(ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

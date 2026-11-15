// Test: Zalo AI — admin dang nhap o Cai dat -> mau tin tao tren panel kem token => server duyet luon (song song voi tools/test-pk-tpl-token.js).
// Chay: NODE_PATH=<noi co jsdom> node tools/test-zalo-tpl-token.js
const fs = require('fs'), vm = require('vm'), path = require('path'), { JSDOM } = require('jsdom');
const ex = path.join(__dirname, '..', 'extension-zalo');
const contentSrc = fs.readFileSync(path.join(ex, 'zalo-content.js'), 'utf8');
const optHtml = fs.readFileSync(path.join(ex, 'zalo-options.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
const optJs = fs.readFileSync(path.join(ex, 'zalo-options.js'), 'utf8');
let ok = 0, fail = 0;
const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
const grab = (src, head) => { const i = src.indexOf(head); if (i < 0) throw new Error('khong thay ' + head); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  // ===== zalo-content.js: _zaiAdminTokenField_ + _zaiTplCall_ =====
  const local = {}, posts = [];
  const cb = (o) => ({ get: (k, f) => { const r = {}; [].concat(k).forEach((x) => { if (x in o) r[x] = JSON.parse(JSON.stringify(o[x])); }); f(r); }, set: (v, f) => { Object.assign(o, v); f && f(); }, remove: (k, f) => { [].concat(k).forEach((x) => delete o[x]); f && f(); } });
  let reply = { ok: true, status: 'approved' };
  const ctx = { chrome: { storage: { local: cb(local) } }, GAS_URL: 'https://w.example/gas', Date, JSON, Error, Promise,
    fetch: async (u, o) => { posts.push(JSON.parse(o.body)); return { json: async () => reply }; } };
  vm.createContext(ctx);
  vm.runInContext(grab(contentSrc, 'function _zaiAdminTokenField_()') + '\n' + grab(contentSrc, 'async function _zaiTplCall_(') + '\nthis.call=_zaiTplCall_;', ctx);
  const last = () => posts[posts.length - 1];
  const tpl = { title: 'Chao', content: 'Xin chao', createdBy: 'duyenht', product: 'Vong' };

  let r = await ctx.call('SAVE_MESSAGE_TEMPLATE', tpl);
  t('chua dang nhap admin: KHONG kem token', r.ok && !('token' in last()) && last().action === 'saveMessageTemplate');
  local.ome_admin_auth = { token: 'TOK.A', name: 'Duyen HT', expiresAt: Date.now() + 1e6 };
  r = await ctx.call('SAVE_MESSAGE_TEMPLATE', tpl);
  t('admin da dang nhap: kem token, tra status approved cho giao dien', last().token === 'TOK.A' && !('token' in last().template) && r.data.status === 'approved');
  await ctx.call('DELETE_MESSAGE_TEMPLATE', { id: 'mt_1', createdBy: 'duyenht' });
  t('xoa mau: kem token', last().action === 'deleteMessageTemplate' && last().token === 'TOK.A');
  local.ome_admin_auth = { token: 'OLD', expiresAt: Date.now() - 1 };
  await ctx.call('SAVE_MESSAGE_TEMPLATE', tpl);
  t('token het han: khong kem + don dep storage', !('token' in last()) && !local.ome_admin_auth);
  delete local.ome_admin_auth;
  await ctx.call('SAVE_MESSAGE_TEMPLATE', { ...tpl, createdBy: 'duyenht' });
  t('chi khai ten duyenht (khong dang nhap): khong co bang chung quyen', !('token' in last()));
  t('giao dien: dong thong bao "dung ngay" co trong zalo-content.js', /dùng được ngay \(admin không cần duyệt\)/.test(contentSrc) && /status === 'approved'/.test(contentSrc));

  // ===== zalo-options.js: dang nhap admin =====
  const lo = { ome_gas_url: 'https://w.example/gas' }, optPosts = [];
  const dom = new JSDOM(optHtml, { runScripts: 'outside-only', url: 'https://x.invalid/' });
  const w = dom.window; let optReply;
  w.chrome = { storage: { local: cb(lo) } };
  w.fetch = async (u, o) => { optPosts.push(JSON.parse(o.body)); return { json: async () => optReply }; };
  w.eval(optJs);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const q = (id) => w.document.getElementById(id), click = async (id) => { q(id).click(); await wait(20); };
  t('chua dang nhap: hien form dang nhap, an khung da dang nhap', q('apprLoggedIn').style.display === 'none' && q('apprLoggedOut').style.display !== 'none');
  q('apprUser').value = 'lan'; q('apprPass').value = 'p';
  optReply = { ok: true, token: 'TOK.LAN', expiresInMs: 7 * 864e5, user: { username: 'lan', name: 'Lan', role: 'cs' } };
  await click('apprLogin');
  t('tai khoan khong phai admin: bi tu choi, KHONG luu token', /không phải admin/.test(q('apprMsg').textContent) && !lo.ome_admin_auth);
  q('apprUser').value = 'duyenht'; q('apprPass').value = 'matkhau';
  optReply = { ok: true, token: 'TOK.ADM', expiresInMs: 7 * 864e5, user: { username: 'duyenht', name: 'Duyen HT', role: 'admin' } };
  await click('apprLogin');
  const sent = optPosts[optPosts.length - 1];
  t('admin: goi webLogin dung tai khoan', sent.action === 'webLogin' && sent.username === 'duyenht');
  t('luu token + han (~7 ngay), KHONG luu mat khau', lo.ome_admin_auth && lo.ome_admin_auth.token === 'TOK.ADM' && lo.ome_admin_auth.expiresAt > Date.now() + 6 * 864e5 && !JSON.stringify(lo).includes('matkhau'));
  t('xoa o mat khau sau khi bam + hien khung da dang nhap', q('apprPass').value === '' && q('apprLoggedIn').style.display !== 'none' && /Duyen HT/.test(q('apprName').textContent));
  optReply = { ok: false, error: 'Sai tai khoan hoac mat khau.' };
  await click('apprLogout');
  t('dang xuat: xoa token', !lo.ome_admin_auth && q('apprLoggedOut').style.display !== 'none');
  q('apprUser').value = 'duyenht'; q('apprPass').value = 'sai'; await click('apprLogin');
  t('sai mat khau: bao loi cua server, khong luu', /Sai tai khoan/.test(q('apprMsg').textContent) && !lo.ome_admin_auth);
  delete lo.ome_gas_url; q('apprUser').value = 'duyenht'; q('apprPass').value = 'x'; const n0 = optPosts.length; await click('apprLogin');
  t('thieu URL GAS: bao loi, khong goi mang', /URL GAS/.test(q('apprMsg').textContent) && optPosts.length === n0);

  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

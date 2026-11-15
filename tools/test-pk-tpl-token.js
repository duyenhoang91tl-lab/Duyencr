// Test: mau tin tao tren Pancake AI kem token admin (neu da dang nhap o Cai dat) de server duyet luon. Chay: node tools/test-pk-tpl-token.js
// Nguyen nhan goc can test: truoc day saveMessageTemplate khong kem token -> server coi la extension an danh -> mau cua admin (duyenht) van 'Cho duyet'.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ex = path.join(__dirname, '..', 'extension-pancake');
const bgSrc = fs.readFileSync(path.join(ex, 'pancake-background.js'), 'utf8');
let ok = 0, fail = 0;
const t = (n, v) => { console.log((v ? 'OK  ' : 'FAIL') + ' ' + n); v ? ok++ : fail++; };
const fn = (src, n) => { const i = src.indexOf('async function ' + n + '('); if (i < 0) throw new Error('khong thay ham ' + n); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } };
(async () => {
  const local = {}, calls = [];
  const area = o => ({ get: async () => JSON.parse(JSON.stringify(o)), set: async v => Object.assign(o, v), remove: async k => { [].concat(k).forEach(x => delete o[x]); } });
  const ctx = { chrome: { storage: { local: area(local), sync: area({}) } }, Date, JSON, Math, Number, String, Array, Object, Error };
  vm.createContext(ctx);
  vm.runInContext('const APPROVER_KEY = "pkApprover";\n' + ['_apprGet_', '_apprTokenField_', 'handleSaveMessageTemplate', 'handleDeleteMessageTemplate'].map(n => fn(bgSrc, n)).join('\n') +
    '\nvar __calls=[]; async function _postGas_(body){ __calls.push(body); return {ok:true,status:"x"}; }\nthis.api={save:handleSaveMessageTemplate,del:handleDeleteMessageTemplate,calls:__calls};', ctx);
  const A = ctx.api, last = () => A.calls[A.calls.length - 1];
  const tpl = { title: 'Chao khach moi', content: 'Xin chao', createdBy: 'duyenht', product: 'Vong tay' };

  await A.save(tpl);
  t('chua dang nhap admin: KHONG kem token (mau van vao Cho duyet nhu cu)', last().action === 'saveMessageTemplate' && !('token' in last()) && last().template.createdBy === 'duyenht');

  local.pkApprover = { token: 'TOK.ADMIN', name: 'Duyen HT', expiresAt: Date.now() + 1e6 };
  await A.save(tpl);
  t('admin da dang nhap: kem token phien that', last().token === 'TOK.ADMIN' && last().template.title === 'Chao khach moi');
  t('token nam NGOAI doi tuong template (server doc data.token)', !('token' in last().template));

  await A.del({ id: 'mt_1', createdBy: 'duyenht' });
  t('xoa mau: kem token khi da dang nhap', last().action === 'deleteMessageTemplate' && last().token === 'TOK.ADMIN' && last().id === 'mt_1');

  local.pkApprover = { token: 'OLD', name: 'D', expiresAt: Date.now() - 1 };
  await A.save(tpl);
  t('token het han: khong kem (khong gui token chet len server)', !('token' in last()) && !local.pkApprover);

  // Chi go TEN duyenht trong Cai dat KHONG duoc tu duyet: khong co token thi payload khong co gi chung minh quyen
  delete local.pkApprover;
  await A.save({ ...tpl, createdBy: 'duyenht' });
  t('ten tu khai "duyenht" khong kem token => khong co bang chung quyen admin', !('token' in last()) && !('priv' in last()) && !('role' in last().template));

  console.log('\n' + ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

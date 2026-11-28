// Menu: chi Truong nhom thay 2 muc "Data cua team" / "Bao cao nhan vien". Chay: node tools/test-lead-menu.js
const fs = require('fs'), vm = require('vm'), { JSDOM } = require('jsdom');
const dom = new JSDOM('<header></header><div id="data-view"><div class="tabs"></div></div>', { runScripts: 'outside-only', url: 'https://x.test/' });
const w = dom.window, ctx = dom.getInternalVMContext();
vm.runInContext('var currentUser=null,_authAccount=null,_bootstrapAdmin=false,__opened=[];function _applyAuthIdentity(a){currentUser={role:a.role};_authAccount=a;}', ctx);
vm.runInContext(fs.readFileSync('js/29-sidenav.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('js/96-lead-assign.js', 'utf8'), ctx);
vm.runInContext('window.openLeadModal=function(t){__opened.push(t||"split")};', ctx);
let ok = 0, fail = 0;
const t = (c, n) => { c ? ok++ : fail++; console.log((c ? 'OK   ' : 'FAIL ') + n); };
const el = k => w.document.querySelector('.sn-act[data-act="' + k + '"]');
const shown = k => !el(k).classList.contains('sn-hide');
const login = role => new Promise(r => { vm.runInContext('_applyAuthIdentity({role:"' + role + '"})', ctx); setTimeout(r, 20); });
(async () => {
  await new Promise(r => setTimeout(r, 20));
  t(!shown('leadassign') && !shown('leadreport'), 'chua dang nhap: an');
  await login('leader'); t(shown('leadassign') && shown('leadreport'), 'truong nhom: hien (sau dang nhap, khong can F5)');
  el('leadassign').click(); el('leadreport').click();
  t(w.eval('__opened.join()') === 'split,report', 'bam menu mo dung tab');
  await login('cs'); t(!shown('leadassign') && !shown('leadreport'), 'doi sang CS: an');
  await login('admin'); t(!shown('leadassign') && shown('assign'), 'admin: dung "Chia data", khong hien muc cua lead');
  console.log(ok + ' OK, ' + fail + ' FAIL'); process.exit(fail ? 1 : 0);
})();

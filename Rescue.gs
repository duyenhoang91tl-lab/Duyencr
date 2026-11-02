// Rescue.gs - trang cứu hộ: dán nội dung file, bấm là commit lên nhánh GitHub

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Rescue')
    .setTitle('Cứu hộ push GitHub')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function rescueEnsureBranch_(branch) {
  var c = gh_cfg_();
  var base = '/repos/' + c.owner + '/' + c.repo;
  var exist = gh_request_('get', base + '/git/ref/heads/' + encodeURI(branch));
  if (exist.code === 200) return false; // nhánh đã có

  var repoInfo = gh_request_('get', base).data;
  var def = repoInfo.default_branch;
  var ref = gh_request_('get', base + '/git/ref/heads/' + encodeURI(def)).data;
  gh_request_('post', base + '/git/refs', {
    ref: 'refs/heads/' + branch,
    sha: ref.object.sha
  });
  return true; // vừa tạo nhánh mới từ nhánh mặc định
}

function rescuePush(form) {
  var path = String(form.path || '').trim().replace(/^\/+/, '');
  var branch = String(form.branch || '').trim();
  var message = String(form.message || '').trim() || ('Cap nhat ' + path);
  var content = String(form.content || '');
  var allowMain = !!form.allowMain;

  if (!path) throw new Error('Chưa nhập đường dẫn file');
  if (!branch) throw new Error('Chưa nhập tên nhánh');
  if (!content) throw new Error('Chưa có nội dung');
  if (/\s/.test(path) || /\s/.test(branch)) {
    throw new Error('Đường dẫn và tên nhánh không được có khoảng trắng');
  }
  if ((branch === 'main' || branch === 'master') && !allowMain) {
    throw new Error('Đang chặn push thẳng main. Dùng nhánh wip/... hoặc tick ô cho phép.');
  }

  var created = rescueEnsureBranch_(branch);
  ghPutFile(path, content, message, branch);

  var c = gh_cfg_();
  return {
    ok: true,
    createdBranch: created,
    url: 'https://github.com/' + c.owner + '/' + c.repo + '/blob/' + branch + '/' + path
  };
}

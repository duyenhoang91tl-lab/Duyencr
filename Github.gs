// Github.gs - gọi GitHub API từ GAS, token lấy từ Script Properties

function gh_cfg_() {
  var p = PropertiesService.getScriptProperties();
  return {
    token: p.getProperty('GITHUB_TOKEN'),
    owner: p.getProperty('GITHUB_OWNER'),
    repo: p.getProperty('GITHUB_REPO')
  };
}

function gh_request_(method, path, payload) {
  var c = gh_cfg_();
  if (!c.token) throw new Error('Thiếu GITHUB_TOKEN trong Script Properties');
  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + c.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  var res = UrlFetchApp.fetch('https://api.github.com' + path, options);
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 400 && code !== 404) {
    throw new Error('GitHub ' + code + ': ' + body.substring(0, 300));
  }
  return { code: code, data: body ? JSON.parse(body) : null };
}

// Đọc nội dung 1 file trong repo
function ghGetFile(path, branch) {
  var c = gh_cfg_();
  var q = branch ? '?ref=' + encodeURIComponent(branch) : '';
  var r = gh_request_('get', '/repos/' + c.owner + '/' + c.repo + '/contents/' + path + q);
  if (r.code === 404) return null;
  return {
    sha: r.data.sha,
    content: Utilities.newBlob(Utilities.base64Decode(r.data.content.replace(/\n/g, ''))).getDataAsString('UTF-8')
  };
}

// Tạo mới hoặc cập nhật 1 file (ví dụ HANDOFF.md)
function ghPutFile(path, content, message, branch) {
  var c = gh_cfg_();
  var existing = ghGetFile(path, branch);
  var body = {
    message: message,
    content: Utilities.base64Encode(Utilities.newBlob(content).getBytes())
  };
  if (branch) body.branch = branch;
  if (existing) body.sha = existing.sha;
  return gh_request_('put', '/repos/' + c.owner + '/' + c.repo + '/contents/' + path, body).data;
}

// Tạo Issue cho 1 đầu việc
function ghCreateIssue(title, bodyText, labels) {
  var c = gh_cfg_();
  return gh_request_('post', '/repos/' + c.owner + '/' + c.repo + '/issues', {
    title: title,
    body: bodyText,
    labels: labels || []
  }).data;
}

// Ghi nhanh file bàn giao giữa các phiên Claude
function ghSaveHandoff(text) {
  return ghPutFile('HANDOFF.md', text, 'Cap nhat HANDOFF.md');
}

// Chạy thử 1 lần để kiểm tra token hoạt động
function ghTest() {
  var c = gh_cfg_();
  var r = gh_request_('get', '/repos/' + c.owner + '/' + c.repo);
  Logger.log(r.code === 200 ? 'OK: ' + r.data.full_name : 'Lỗi ' + r.code);
}

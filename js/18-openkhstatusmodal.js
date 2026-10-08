
// ═══════════════════════════════════════════════════════
//  TRẠNG THÁI KH MANAGER
// ═══════════════════════════════════════════════════════
let _khStatusDraft = [];

function openKhStatusModal() {
  var isAdmin = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  if (!isAdmin) { toast('Chỉ admin mới quản lý ' + FIELD_LABEL_KH + '.'); return; }
  _khStatusDraft = JSON.parse(JSON.stringify(CUSTOMER_STATUS_TREE));
  _renderKhStatusTree();
  _renderKhParentSel();
  var t = document.getElementById('kh-status-modal-title'); if (t) t.textContent = '⚙ Quản lý ' + FIELD_LABEL_KH;
  var m = document.getElementById('kh-status-modal');
  if (m) m.style.display = 'flex';
  // Update save button label
  var btn = document.getElementById('khs-save-btn');
  if (btn) btn.textContent = '💾 Lưu' + (gsUrl ? ' + Sync GSheets' : '');
}

function closeKhStatusModal() {
  var m = document.getElementById('kh-status-modal');
  if (m) m.style.display = 'none';
}

function _renderKhParentSel() {
  var sel = document.getElementById('khs-parent-sel');
  if (!sel) return;
  var html = '<option value="">— Thêm vào gốc (nhóm/lá) —</option>';
  _khStatusDraft.forEach(function(node, pi) {
    if (node.children) {
      html += '<option value="' + pi + '">Thêm vào: ' + esc(node.label) + '</option>';
    }
  });
  sel.innerHTML = html;
}

function _renderKhStatusTree() {
  var el = document.getElementById('kh-status-tree-list');
  if (!el) return;
  if (!_khStatusDraft.length) {
    el.innerHTML = '<div style="color:var(--hint);font-size:12px;text-align:center;padding:12px">Chưa có trạng thái nào.</div>';
    return;
  }
  var html = '';
  _khStatusDraft.forEach(function(node, pi) {
    if (node.children) {
      // GROUP node
      html += '<div class="khs-group" data-pi="' + pi + '">';
      html += '<div class="khs-parent-row" draggable="true" data-drag-pi="' + pi + '">' +
        '<span class="khs-drag" title="Kéo nhóm">☰</span>' +
        '<span class="khs-icon">📁</span>' +
        '<span class="khs-lbl">' + esc(node.label) + '</span>' +
        '<span class="khs-group-badge">Nhóm · ' + node.children.length + ' con</span>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px" title="Đổi tên" onclick="editKhLabel('+pi+',null)">✏️</button>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px;color:var(--blue);border-color:var(--blue-b)" title="Chuyển thành lá" onclick="convertKhNode('+pi+',null,\'toLeaf\')">🔄 → Lá</button>' +
        '<button class="btn danger sm" style="padding:2px 7px" onclick="removeKhNode('+pi+',null)">✕</button>' +
      '</div>';
      if (node.children.length) {
        html += '<div class="khs-children" data-ci-wrap="' + pi + '">';
        node.children.forEach(function(child, ci) {
          var moveOpts = '<option value="">— Chuyển sang nhóm —</option>';
          _khStatusDraft.forEach(function(n2, pi2) {
            if (n2.children && pi2 !== pi) {
              moveOpts += '<option value="' + pi2 + '">' + esc(n2.label) + '</option>';
            }
          });
          html += '<div class="khs-child-row" draggable="true" data-drag-pi="' + pi + '" data-drag-ci="' + ci + '">' +
            '<span class="khs-drag" title="Kéo sắp xếp">☰</span>' +
            '<span class="khs-icon" style="color:#6d28d9">↳</span>' +
            '<span class="khs-lbl">' + esc(child.label) + '</span>' +
            '<select class="form-select" style="width:150px;padding:2px 5px;font-size:10px" title="Chuyển sang nhóm khác" onchange="moveKhChild('+pi+','+ci+',this.value);this.value=\'\'">' + moveOpts + '</select>' +
            '<button class="btn sm" style="padding:2px 7px;font-size:10px;color:var(--tn);border-color:var(--tn-b)" title="Tách ra thành lá gốc" onclick="moveKhChild('+pi+','+ci+',\'root\')">↑ Ra gốc</button>' +
            '<button class="btn sm" style="padding:2px 7px;font-size:10px" onclick="editKhLabel('+pi+','+ci+')">✏️</button>' +
            '<button class="btn danger sm" style="padding:2px 7px" onclick="removeKhNode('+pi+','+ci+')">✕</button>' +
          '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    } else {
      // LEAF node at root
      var moveOpts2 = '<option value="">— Nhóm vào —</option>';
      _khStatusDraft.forEach(function(n2, pi2) {
        if (n2.children) {
          moveOpts2 += '<option value="' + pi2 + '">' + esc(n2.label) + '</option>';
        }
      });
      html += '<div class="khs-leaf-row" draggable="true" data-drag-pi="' + pi + '" data-drag-ci="null">' +
        '<span class="khs-drag" title="Kéo sắp xếp">☰</span>' +
        '<span class="khs-icon">🔹</span>' +
        '<span class="khs-lbl">' + esc(node.label) + '</span>' +
        '<select class="form-select" style="width:150px;padding:2px 5px;font-size:10px" title="Nhóm vào một nhóm mẹ" onchange="moveKhLeafToGroup('+pi+',this.value);this.value=\'\'">' + moveOpts2 + '</select>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px;color:var(--blue);border-color:var(--blue-b)" title="Chuyển thành nhóm mẹ" onclick="convertKhNode('+pi+',null,\'toGroup\')">🔄 → Nhóm</button>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px" onclick="editKhLabel('+pi+',null,true)">✏️</button>' +
        '<button class="btn danger sm" style="padding:2px 7px" onclick="removeKhNode('+pi+',null)">✕</button>' +
      '</div>';
    }
  });
  el.innerHTML = html;
  _initKhDragSort(el);
}

function editKhLabel(pi, ci, isLeaf) {
  var node = _khStatusDraft[pi];
  var current = (ci !== null && ci !== undefined && node.children) ? node.children[ci].label : node.label;
  var newLabel = prompt('Đổi tên:', current);
  if (!newLabel || !newLabel.trim()) return;
  newLabel = newLabel.trim();
  if (ci !== null && ci !== undefined && node.children) {
    node.children[ci].label = newLabel;
    node.children[ci].value = newLabel;
  } else {
    node.label = newLabel;
    if (!node.children) node.value = newLabel;
  }
  _renderKhStatusTree();
  _renderKhParentSel();
}

function removeKhNode(pi, ci) {
  var node = _khStatusDraft[pi];
  if (ci !== null && ci !== undefined && node.children) {
    if (!confirm('Xóa trạng thái con "' + node.children[ci].label + '"?')) return;
    node.children.splice(ci, 1);
    if (!node.children.length) {
      // Nhóm rỗng → chuyển thành lá
      _khStatusDraft[pi] = { label: node.label, value: node.label };
    }
  } else {
    var msg = node.children && node.children.length
      ? 'Xóa nhóm "' + node.label + '" và ' + node.children.length + ' trạng thái con?'
      : 'Xóa "' + node.label + '"?';
    if (!confirm(msg + '\n\nDữ liệu KH đang có trạng thái này vẫn giữ nguyên.')) return;
    _khStatusDraft.splice(pi, 1);
  }
  _renderKhStatusTree();
  _renderKhParentSel();
}

// ── Convert KH node: leaf↔group ──
function convertKhNode(pi, ci, direction) {
  var node = _khStatusDraft[pi];
  if (direction === 'toGroup') {
    if (!confirm('Chuyển "' + node.label + '" thành nhóm mẹ?\nBản thân nó sẽ trở thành mục con đầu tiên.')) return;
    _khStatusDraft[pi] = { label: node.label, children: [{ label: node.label, value: node.value || node.label }] };
  } else if (direction === 'toLeaf') {
    if (node.children && node.children.length) {
      if (!confirm('Chuyển nhóm "' + node.label + '" thành lá đơn?\n' + node.children.length + ' mục con sẽ được tách ra thành lá gốc.')) return;
      var kids = node.children.map(function(c) { return { label: c.label, value: c.value || c.label }; });
      _khStatusDraft.splice(pi, 1, { label: node.label, value: node.label });
      kids.forEach(function(k, i) { _khStatusDraft.splice(pi + 1 + i, 0, k); });
    } else {
      _khStatusDraft[pi] = { label: node.label, value: node.label };
    }
  }
  _renderKhStatusTree();
  _renderKhParentSel();
}

// ── Move child → parent khác / ra gốc ──
function moveKhChild(fromPi, ci, toPiOrRoot) {
  var fromNode = _khStatusDraft[fromPi];
  if (!fromNode || !fromNode.children) return;
  var child = fromNode.children.splice(ci, 1)[0];
  if (!child) return;
  if (!fromNode.children.length) {
    _khStatusDraft[fromPi] = { label: fromNode.label, value: fromNode.label };
  }
  if (toPiOrRoot === 'root') {
    var insertAt = _khStatusDraft.indexOf(fromNode);
    if (insertAt < 0) insertAt = _khStatusDraft.length;
    _khStatusDraft.splice(insertAt + 1, 0, { label: child.label, value: child.value || child.label });
  } else {
    var toPi = parseInt(toPiOrRoot);
    var toNode = _khStatusDraft[toPi];
    if (!toNode || !toNode.children) return;
    toNode.children.push(child);
  }
  _renderKhStatusTree();
  _renderKhParentSel();
}

// ── Move leaf → into a group ──
function moveKhLeafToGroup(leafPi, groupPi) {
  if (groupPi === '' || groupPi === undefined) return;
  groupPi = parseInt(groupPi);
  var leaf = _khStatusDraft[leafPi];
  if (!leaf || leaf.children) return;
  var group = _khStatusDraft[groupPi];
  if (!group || !group.children) return;
  group.children.push({ label: leaf.label, value: leaf.value || leaf.label });
  _khStatusDraft.splice(leafPi, 1);
  _renderKhStatusTree();
  _renderKhParentSel();
}

function addKhStatusItem(asGroup) {
  var label = (document.getElementById('khs-new-label').value || '').trim();
  if (!label) { toast('Nhập tên trạng thái trước.'); return; }
  var parentSel = document.getElementById('khs-parent-sel');
  var parentIdx = parentSel ? parentSel.value : '';

  if (parentIdx !== '') {
    // Thêm con vào nhóm đã có
    var pi = parseInt(parentIdx);
    if (!_khStatusDraft[pi].children) _khStatusDraft[pi].children = [];
    _khStatusDraft[pi].children.push({ label: label, value: label });
  } else if (asGroup) {
    // Thêm nhóm mới ở gốc (không có value, chỉ có children rỗng)
    _khStatusDraft.push({ label: label, children: [] });
  } else {
    // Thêm lá ở gốc
    _khStatusDraft.push({ label: label, value: label });
  }
  document.getElementById('khs-new-label').value = '';
  _renderKhStatusTree();
  _renderKhParentSel();
}

// ═══════════════════════════════════════════════════════════════════
//  QUẢN LÝ TRƯỜNG TỰ TẠO (admin)
//  - Thêm/đổi tên/xoá "trường lớn" (ngang hàng Tình trạng CS / Trạng thái KH)
//  - Với mỗi trường: sửa cây lựa chọn mẹ/con (thêm nhóm, thêm mục, chuyển lá↔nhóm)
// ═══════════════════════════════════════════════════════════════════
let _cfDraft = [];        // bản nháp toàn bộ danh sách trường
let _cfEditingIdx = -1;   // đang mở cây của trường nào (-1 = chưa chọn)

function openCustomFieldsModal() {
  var isAdmin = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  if (!isAdmin) { toast('Chỉ admin mới quản lý trường tự tạo.'); return; }
  _cfDraft = JSON.parse(JSON.stringify(CUSTOM_FIELDS));
  _cfEditingIdx = _cfDraft.length ? 0 : -1;
  _renderCfModal();
  var m = document.getElementById('cf-modal');
  if (m) m.style.display = 'flex';
}
function closeCustomFieldsModal() {
  var m = document.getElementById('cf-modal');
  if (m) m.style.display = 'none';
}

function _cfNewId() { return 'cf_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

function _renderCfModal() {
  // ── Cột trái: danh sách trường lớn ──
  var listEl = document.getElementById('cf-field-list');
  if (listEl) {
    if (!_cfDraft.length) {
      listEl.innerHTML = '<div style="color:var(--hint);font-size:11px;padding:10px;text-align:center">Chưa có trường nào.<br>Nhập tên bên dưới để tạo.</div>';
    } else {
      listEl.innerHTML = _cfDraft.map(function(f, i){
        var cnt = (f.tree||[]).reduce(function(s,n){ return s + (n.children ? n.children.length : 1); }, 0);
        return '<div class="cf-frow' + (i === _cfEditingIdx ? ' cf-active' : '') + '" onclick="_cfSelectField(' + i + ')">'
          + '<span class="cf-fname">' + esc(f.label) + '</span>'
          + '<span class="cf-fcnt">' + cnt + ' mục</span>'
          + '<button class="cf-mini" title="Đổi tên" onclick="event.stopPropagation();_cfRenameField(' + i + ')">✏</button>'
          + '<button class="cf-mini cf-del" title="Xoá trường" onclick="event.stopPropagation();_cfDeleteField(' + i + ')">✕</button>'
          + '</div>';
      }).join('');
    }
  }
  // ── Cột phải: cây lựa chọn của trường đang chọn ──
  var treeEl = document.getElementById('cf-tree');
  var titleEl = document.getElementById('cf-tree-title');
  var toolsEl = document.getElementById('cf-tree-tools');
  if (!treeEl) return;
  if (_cfEditingIdx < 0 || !_cfDraft[_cfEditingIdx]) {
    if (titleEl) titleEl.textContent = 'Chọn 1 trường ở cột trái để sửa lựa chọn';
    if (toolsEl) toolsEl.style.display = 'none';
    treeEl.innerHTML = '';
    return;
  }
  var f = _cfDraft[_cfEditingIdx];
  if (titleEl) titleEl.textContent = 'Lựa chọn của: ' + f.label;
  if (toolsEl) toolsEl.style.display = '';
  var tree = f.tree || [];
  if (!tree.length) {
    treeEl.innerHTML = '<div style="color:var(--hint);font-size:11px;padding:10px;text-align:center">Chưa có lựa chọn nào.</div>';
  } else {
    treeEl.innerHTML = tree.map(function(node, pi){
      if (node.children) {
        var kids = node.children.map(function(ch, ci){
          return '<div class="khs-child-row">'
            + '<span class="khs-icon">↳</span>'
            + '<span class="khs-lbl">' + esc(ch.label) + '</span>'
            + '<button class="cf-mini" title="Đổi tên" onclick="_cfRenameNode(' + pi + ',' + ci + ')">✏</button>'
            + '<button class="cf-mini cf-del" title="Xoá" onclick="_cfDeleteNode(' + pi + ',' + ci + ')">✕</button>'
            + '</div>';
        }).join('');
        return '<div class="khs-group"><div class="khs-parent-row">'
          + '<span class="khs-icon">📁</span>'
          + '<span class="khs-lbl">' + esc(node.label) + '</span>'
          + '<span class="khs-group-badge">nhóm</span>'
          + '<button class="cf-mini" title="Đổi tên" onclick="_cfRenameNode(' + pi + ',null)">✏</button>'
          + '<button class="cf-mini" title="Thêm mục con" onclick="_cfAddChild(' + pi + ')">+</button>'
          + '<button class="cf-mini cf-del" title="Xoá cả nhóm" onclick="_cfDeleteNode(' + pi + ',null)">✕</button>'
          + '</div><div class="khs-children">' + kids + '</div></div>';
      }
      return '<div class="khs-leaf-row">'
        + '<span class="khs-icon">🔹</span>'
        + '<span class="khs-lbl">' + esc(node.label) + '</span>'
        + '<button class="cf-mini" title="Đổi tên" onclick="_cfRenameNode(' + pi + ',null)">✏</button>'
        + '<button class="cf-mini" title="Chuyển thành nhóm (có mục con)" onclick="_cfLeafToGroup(' + pi + ')">🔄</button>'
        + '<button class="cf-mini cf-del" title="Xoá" onclick="_cfDeleteNode(' + pi + ',null)">✕</button>'
        + '</div>';
    }).join('');
  }
}

function _cfSelectField(i) { _cfEditingIdx = i; _renderCfModal(); }

function _cfAddField() {
  var inp = document.getElementById('cf-new-field');
  var label = (inp ? inp.value : '').trim();
  if (!label) { toast('Nhập tên trường mới'); return; }
  if (_cfDraft.some(function(f){ return f.label.toLowerCase() === label.toLowerCase(); })) {
    toast('Đã có trường tên này'); return;
  }
  _cfDraft.push({ id: _cfNewId(), label: label, tree: [] });
  if (inp) inp.value = '';
  _cfEditingIdx = _cfDraft.length - 1;
  _renderCfModal();
}
function _cfRenameField(i) {
  var f = _cfDraft[i]; if (!f) return;
  var v = prompt('Đổi tên trường:', f.label);
  if (v === null) return;
  v = v.trim(); if (!v) return;
  f.label = v;
  _renderCfModal();
}
function _cfDeleteField(i) {
  var f = _cfDraft[i]; if (!f) return;
  if (!confirm('Xoá trường "' + f.label + '"?\n\nLưu ý: giá trị khách hàng đã chọn ở trường này sẽ không còn hiển thị (dữ liệu vẫn nằm trong Sheet, hiện lại nếu bạn tạo lại trường cùng tên ID).')) return;
  _cfDraft.splice(i, 1);
  if (_cfEditingIdx >= _cfDraft.length) _cfEditingIdx = _cfDraft.length - 1;
  _renderCfModal();
}

function _cfAddNode(asGroup) {
  if (_cfEditingIdx < 0) { toast('Chọn 1 trường trước'); return; }
  var inp = document.getElementById('cf-new-node');
  var label = (inp ? inp.value : '').trim();
  if (!label) { toast('Nhập tên lựa chọn'); return; }
  var f = _cfDraft[_cfEditingIdx];
  if (!f.tree) f.tree = [];
  f.tree.push(asGroup ? { label: label, children: [] } : { label: label, value: label });
  if (inp) inp.value = '';
  _renderCfModal();
}
function _cfAddChild(pi) {
  var f = _cfDraft[_cfEditingIdx]; if (!f) return;
  var node = f.tree[pi]; if (!node) return;
  var v = prompt('Tên mục con mới trong nhóm "' + node.label + '":', '');
  if (v === null) return;
  v = v.trim(); if (!v) return;
  if (!node.children) node.children = [];
  node.children.push({ label: v, value: v });
  _renderCfModal();
}
function _cfRenameNode(pi, ci) {
  var f = _cfDraft[_cfEditingIdx]; if (!f) return;
  var node = f.tree[pi]; if (!node) return;
  var target = (ci === null || ci === undefined) ? node : (node.children || [])[ci];
  if (!target) return;
  var v = prompt('Đổi tên:', target.label);
  if (v === null) return;
  v = v.trim(); if (!v) return;
  target.label = v;
  // Mục chọn được (lá/con) thì value đi kèm label để dữ liệu lưu đúng cái CS nhìn thấy
  if (target.value !== undefined) target.value = v;
  _renderCfModal();
}
function _cfDeleteNode(pi, ci) {
  var f = _cfDraft[_cfEditingIdx]; if (!f) return;
  var node = f.tree[pi]; if (!node) return;
  if (ci === null || ci === undefined) {
    if (node.children && node.children.length && !confirm('Xoá nhóm "' + node.label + '" và toàn bộ ' + node.children.length + ' mục con?')) return;
    f.tree.splice(pi, 1);
  } else {
    (node.children || []).splice(ci, 1);
  }
  _renderCfModal();
}
function _cfLeafToGroup(pi) {
  var f = _cfDraft[_cfEditingIdx]; if (!f) return;
  var node = f.tree[pi]; if (!node || node.children) return;
  f.tree[pi] = { label: node.label, children: [{ label: node.label, value: node.value || node.label }] };
  _renderCfModal();
}

async function saveCustomFields() {
  CUSTOM_FIELDS.length = 0;
  _cfDraft.forEach(function(f){ CUSTOM_FIELDS.push(f); });
  saveLS('ome_custom_fields', CUSTOM_FIELDS);
  // Đồng bộ qua action 'setSetting' CHUNG (giống khStatusTree/nickZaloList) — không cần thêm
  // action riêng ở backend GAS.
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ action: 'setSetting', key: 'customFields', value: JSON.stringify(CUSTOM_FIELDS) })
      });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
      else toast('✓ Đã lưu và đồng bộ trường tự tạo lên Google Sheets');
    } catch(e) { toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message); }
  } else {
    toast('✓ Đã lưu trường tự tạo (local)');
  }
  closeCustomFieldsModal();
  // Vẽ lại form chi tiết nếu đang mở để thấy trường mới ngay
  if (typeof currentPhone !== 'undefined' && currentPhone && typeof renderDpTab === 'function'
      && typeof currentDpTab !== 'undefined' && currentDpTab === 'care') {
    try { renderDpTab('care'); } catch(e){}
  }
}

function resetKhStatusToDefault() {
  if (!confirm('Khôi phục trạng thái KH về mặc định? Dữ liệu KH vẫn giữ nguyên.')) return;
  _khStatusDraft = JSON.parse(JSON.stringify(CUSTOMER_STATUS_TREE_DEFAULT));
  _renderKhStatusTree();
  _renderKhParentSel();
}

async function saveKhStatusTree() {
  // Cập nhật runtime
  CUSTOMER_STATUS_TREE.length = 0;
  _khStatusDraft.forEach(function(n) { CUSTOMER_STATUS_TREE.push(n); });
  // Lưu local
  saveLS('ome_kh_status_tree', CUSTOMER_STATUS_TREE);
  // Đồng bộ GSheets — dùng action 'setSetting' CHUNG đã có sẵn ở backend (khoá 'khStatusTree'),
  // giống hệt cách 'nickZaloList' đang đồng bộ. (Trước đây gọi action 'saveKhStatusTree' — action
  // này KHÔNG tồn tại ở backend nên chưa bao giờ đồng bộ thật, dù toast vẫn báo thành công.)
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ action: 'setSetting', key: 'khStatusTree', value: JSON.stringify(CUSTOMER_STATUS_TREE) })
      });
      var d = await r.json().catch(function(){ return {}; });
      if (d && d.error) toast('Lưu local ✓ — GSheets: ' + d.error);
      else toast('✓ Đã lưu và đồng bộ ' + FIELD_LABEL_KH + ' lên Google Sheets');
    } catch(e) {
      toast('✓ Đã lưu local — chưa đồng bộ GSheets: ' + e.message);
    }
  } else {
    toast('✓ Đã lưu ' + FIELD_LABEL_KH + ' (local)');
  }
  closeKhStatusModal();
  // Refresh dropdown trong form nếu đang mở
  var sel = document.getElementById('cs-kh-status');
  if (sel) {
    var cur = sel.value;
    sel.innerHTML = _buildCustStatusOptions(cur);
  }
}

// ── Drag & drop sắp xếp trong modal KH ──
function _initKhDragSort(container) {
  var dragSrc = null, dragPi = null, dragCi = null;

  function getRows(el) {
    return Array.from(el.querySelectorAll('[draggable="true"]'));
  }

  container.querySelectorAll('[draggable="true"]').forEach(function(row) {
    row.addEventListener('dragstart', function(e) {
      dragSrc = row;
      dragPi = row.dataset.dragPi !== undefined ? parseInt(row.dataset.dragPi) : null;
      dragCi = (row.dataset.dragCi !== undefined && row.dataset.dragCi !== 'null' && row.dataset.dragCi !== '') ? parseInt(row.dataset.dragCi) : null;
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.4';
    });
    row.addEventListener('dragend', function() { row.style.opacity = ''; });
    row.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', function(e) {
      e.preventDefault();
      if (dragSrc === row) return;
      var toPi = row.dataset.dragPi !== undefined ? parseInt(row.dataset.dragPi) : null;
      var toCi = (row.dataset.dragCi !== undefined && row.dataset.dragCi !== 'null' && row.dataset.dragCi !== '') ? parseInt(row.dataset.dragCi) : null;

      // Root-level reorder (both are root rows)
      if (dragCi === null && toCi === null && dragPi !== null && toPi !== null) {
        var moved = _khStatusDraft.splice(dragPi, 1)[0];
        _khStatusDraft.splice(toPi, 0, moved);
        _renderKhStatusTree();
        _renderKhParentSel();
        return;
      }
      // Child reorder within same parent
      if (dragCi !== null && toCi !== null && dragPi === toPi) {
        var parent = _khStatusDraft[dragPi];
        if (parent && parent.children) {
          var movedChild = parent.children.splice(dragCi, 1)[0];
          parent.children.splice(toCi, 0, movedChild);
          _renderKhStatusTree();
          return;
        }
      }
      // Cross-parent drag: child → child slot in another parent
      if (dragCi !== null && toCi !== null && dragPi !== toPi) {
        var fromP = _khStatusDraft[dragPi];
        var toP = _khStatusDraft[toPi];
        if (fromP && fromP.children && toP && toP.children) {
          var movedC = fromP.children.splice(dragCi, 1)[0];
          if (!fromP.children.length) { _khStatusDraft[dragPi] = { label: fromP.label, value: fromP.label }; }
          toP.children.splice(toCi, 0, movedC);
          _renderKhStatusTree();
          _renderKhParentSel();
          return;
        }
      }
      // Child drag to root (drop on a root-level row or group header)
      if (dragCi !== null && toCi === null && dragPi !== null && toPi !== null) {
        var fromP2 = _khStatusDraft[dragPi];
        if (fromP2 && fromP2.children) {
          var movedC2 = fromP2.children.splice(dragCi, 1)[0];
          if (!fromP2.children.length) { _khStatusDraft[dragPi] = { label: fromP2.label, value: fromP2.label }; }
          _khStatusDraft.splice(toPi, 0, { label: movedC2.label, value: movedC2.value || movedC2.label });
          _renderKhStatusTree();
          _renderKhParentSel();
          return;
        }
      }
    });
  });
}


// ═══════════════════════════════════════════════════════
//  CARE STATUS MANAGER — TREE (nhóm mẹ/con)
// ═══════════════════════════════════════════════════════
let _careStatusDraft = [];  // bản nháp đang chỉnh trong modal (tree)

function openCareStatusModal() {
  var isAdmin = (_authAccount && _authAccount.role === 'admin') || _bootstrapAdmin;
  if (!isAdmin) { toast('Chỉ admin mới quản lý ' + FIELD_LABEL_CS + '.'); return; }
  _careStatusDraft = JSON.parse(JSON.stringify(CARE_STATUS_TREE));
  renderCareStatusList();
  _renderCsParentSel();
  var t = document.getElementById('care-status-modal-title'); if (t) t.textContent = '⚙ Quản lý ' + FIELD_LABEL_CS;
  var m = document.getElementById('care-status-modal');
  if (m) m.style.display = 'flex';
  var btn = document.getElementById('cs-save-btn');
  if (btn) btn.textContent = '💾 Lưu' + (gsUrl ? ' + Sync GSheets' : '');
}
function closeCareStatusModal() {
  var m = document.getElementById('care-status-modal');
  if (m) m.style.display = 'none';
}

// ── Render dropdown chọn nhóm mẹ (cho "Thêm mới") ──
function _renderCsParentSel() {
  var sel = document.getElementById('cs-parent-sel');
  if (!sel) return;
  var html = '<option value="">— Thêm vào gốc —</option>';
  _careStatusDraft.forEach(function(node, pi) {
    if (node.children) {
      html += '<option value="' + pi + '">Thêm vào: ' + esc(node.label) + '</option>';
    }
  });
  sel.innerHTML = html;
}

// ── Render toàn bộ tree ──
function renderCareStatusList() {
  var el = document.getElementById('care-status-list');
  if (!el) return;
  if (!_careStatusDraft.length) {
    el.innerHTML = '<div style="color:var(--hint);font-size:12px;text-align:center;padding:8px">Chưa có tình trạng nào.</div>';
    return;
  }
  var html = '';
  _careStatusDraft.forEach(function(node, pi) {
    if (node.children) {
      // GROUP node
      html += '<div class="khs-group" data-pi="' + pi + '">';
      html += '<div class="khs-parent-row" draggable="true" data-drag-pi="' + pi + '">' +
        '<span class="khs-drag" title="Kéo nhóm">☰</span>' +
        '<span class="khs-icon">📁</span>' +
        '<span class="khs-lbl">' + esc(node.label) + '</span>' +
        '<span class="khs-group-badge">Nhóm · ' + node.children.length + ' con</span>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px" title="Đổi tên" onclick="editCsLabel('+pi+',null)">✏️</button>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px;color:var(--blue);border-color:var(--blue-b)" title="Chuyển thành lá (leaf)" onclick="convertCsNode('+pi+',null,\'toLeaf\')">🔄 → Lá</button>' +
        '<button class="btn danger sm" style="padding:2px 7px" onclick="removeCsNode('+pi+',null)">✕</button>' +
      '</div>';
      if (node.children.length) {
        html += '<div class="khs-children" data-ci-wrap="' + pi + '">';
        node.children.forEach(function(child, ci) {
          // Build parent move dropdown
          var moveOpts = '<option value="">— Chuyển sang nhóm —</option>';
          _careStatusDraft.forEach(function(n2, pi2) {
            if (n2.children && pi2 !== pi) {
              moveOpts += '<option value="' + pi2 + '">' + esc(n2.label) + '</option>';
            }
          });
          html += '<div class="khs-child-row" draggable="true" data-drag-pi="' + pi + '" data-drag-ci="' + ci + '">' +
            '<span class="khs-drag" title="Kéo sắp xếp">☰</span>' +
            '<span class="khs-icon" style="color:#6d28d9">↳</span>' +
            '<span class="khs-lbl">' + esc(child.label) + '</span>' +
            '<select class="form-select" style="width:150px;padding:2px 5px;font-size:10px" title="Chuyển sang nhóm mẹ khác" onchange="moveCsChild('+pi+','+ci+',this.value);this.value=\'\'">' + moveOpts + '</select>' +
            '<button class="btn sm" style="padding:2px 7px;font-size:10px;color:var(--tn);border-color:var(--tn-b)" title="Tách ra thành lá gốc" onclick="moveCsChild('+pi+','+ci+',\'root\')">↑ Ra gốc</button>' +
            '<button class="btn sm" style="padding:2px 7px;font-size:10px" onclick="editCsLabel('+pi+','+ci+')">✏️</button>' +
            '<button class="btn danger sm" style="padding:2px 7px" onclick="removeCsNode('+pi+','+ci+')">✕</button>' +
          '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    } else {
      // LEAF node at root
      var moveOpts2 = '<option value="">— Nhóm vào —</option>';
      _careStatusDraft.forEach(function(n2, pi2) {
        if (n2.children) {
          moveOpts2 += '<option value="' + pi2 + '">' + esc(n2.label) + '</option>';
        }
      });
      html += '<div class="khs-leaf-row" draggable="true" data-drag-pi="' + pi + '" data-drag-ci="null">' +
        '<span class="khs-drag" title="Kéo sắp xếp">☰</span>' +
        '<span class="khs-icon">🔹</span>' +
        '<span class="khs-lbl">' + esc(node.label) + '</span>' +
        '<select class="form-select" style="width:150px;padding:2px 5px;font-size:10px" title="Nhóm lá này vào nhóm mẹ" onchange="moveCsLeafToGroup('+pi+',this.value);this.value=\'\'">' + moveOpts2 + '</select>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px;color:var(--blue);border-color:var(--blue-b)" title="Chuyển thành nhóm mẹ" onclick="convertCsNode('+pi+',null,\'toGroup\')">🔄 → Nhóm</button>' +
        '<button class="btn sm" style="padding:2px 7px;font-size:10px" onclick="editCsLabel('+pi+',null,true)">✏️</button>' +
        '<button class="btn danger sm" style="padding:2px 7px" onclick="removeCsNode('+pi+',null)">✕</button>' +
      '</div>';
    }
  });
  el.innerHTML = html;
  _initCsDragSort(el);
}

// ── Đổi tên ──
function editCsLabel(pi, ci, isLeaf) {
  var node = _careStatusDraft[pi];
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
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Xóa ──
function removeCsNode(pi, ci) {
  var node = _careStatusDraft[pi];
  if (ci !== null && ci !== undefined && node.children) {
    if (!confirm('Xóa tình trạng con "' + node.children[ci].label + '"?\n\nDữ liệu KH vẫn giữ nguyên.')) return;
    node.children.splice(ci, 1);
    if (!node.children.length) {
      // Nhóm rỗng → chuyển thành lá
      _careStatusDraft[pi] = { label: node.label, value: node.label };
    }
  } else {
    var msg = node.children && node.children.length
      ? 'Xóa nhóm "' + node.label + '" và ' + node.children.length + ' tình trạng con?'
      : 'Xóa "' + node.label + '"?';
    if (!confirm(msg + '\n\nDữ liệu KH đang có tình trạng này vẫn giữ nguyên.')) return;
    _careStatusDraft.splice(pi, 1);
  }
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Convert: leaf↔group ──
function convertCsNode(pi, ci, direction) {
  var node = _careStatusDraft[pi];
  if (direction === 'toGroup') {
    // Lá → Nhóm mẹ (giữ lại chính nó làm con đầu tiên)
    if (!confirm('Chuyển "' + node.label + '" thành nhóm mẹ?\nBản thân nó sẽ trở thành mục con đầu tiên.')) return;
    _careStatusDraft[pi] = { label: node.label, children: [{ label: node.label, value: node.value || node.label }] };
  } else if (direction === 'toLeaf') {
    // Nhóm → Lá (các con sẽ bị mất khỏi nhóm; hỏi xác nhận)
    if (node.children && node.children.length) {
      if (!confirm('Chuyển nhóm "' + node.label + '" thành lá đơn?\n' + node.children.length + ' mục con sẽ bị tách ra thành lá gốc.')) return;
      // Chèn các con ra gốc trước vị trí hiện tại
      var kids = node.children.map(function(c) { return { label: c.label, value: c.value || c.label }; });
      _careStatusDraft.splice(pi, 1, { label: node.label, value: node.label });
      kids.forEach(function(k, i) { _careStatusDraft.splice(pi + 1 + i, 0, k); });
    } else {
      _careStatusDraft[pi] = { label: node.label, value: node.label };
    }
  }
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Move child → parent khác ──
function moveCsChild(fromPi, ci, toPiOrRoot) {
  var fromNode = _careStatusDraft[fromPi];
  if (!fromNode || !fromNode.children) return;
  var child = fromNode.children.splice(ci, 1)[0];
  if (!child) return;
  // Nhóm rỗng → tự chuyển thành lá
  if (!fromNode.children.length) {
    _careStatusDraft[fromPi] = { label: fromNode.label, value: fromNode.label };
  }
  if (toPiOrRoot === 'root') {
    // Tách thành lá ở gốc (ngay sau vị trí nhóm mẹ)
    var insertAt = _careStatusDraft.indexOf(fromNode);
    if (insertAt < 0) insertAt = _careStatusDraft.length;
    _careStatusDraft.splice(insertAt + 1, 0, { label: child.label, value: child.value || child.label });
  } else {
    var toPi = parseInt(toPiOrRoot);
    var toNode = _careStatusDraft[toPi];
    if (!toNode || !toNode.children) return;
    toNode.children.push(child);
  }
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Move leaf → into a group ──
function moveCsLeafToGroup(leafPi, groupPi) {
  if (groupPi === '' || groupPi === undefined) return;
  groupPi = parseInt(groupPi);
  var leaf = _careStatusDraft[leafPi];
  if (!leaf || leaf.children) return;
  var group = _careStatusDraft[groupPi];
  if (!group || !group.children) return;
  group.children.push({ label: leaf.label, value: leaf.value || leaf.label });
  _careStatusDraft.splice(leafPi, 1);
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Thêm mới ──
function addCareStatusItem(asGroup) {
  var inp = document.getElementById('care-status-new-input');
  var val = (inp ? inp.value : '').trim();
  if (!val) { toast('Nhập tên tình trạng trước.'); return; }
  var parentSel = document.getElementById('cs-parent-sel');
  var parentIdx = parentSel ? parentSel.value : '';

  if (parentIdx !== '') {
    var pi = parseInt(parentIdx);
    if (!_careStatusDraft[pi].children) _careStatusDraft[pi].children = [];
    _careStatusDraft[pi].children.push({ label: val, value: val });
  } else if (asGroup) {
    _careStatusDraft.push({ label: val, children: [] });
  } else {
    _careStatusDraft.push({ label: val, value: val });
  }
  if (inp) inp.value = '';
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Khôi phục mặc định ──
function removeCareStatusItem(idx) {
  // legacy shim — không còn dùng nhưng giữ để an toàn
  removeCsNode(idx, null);
}

function resetCareStatusToDefault() {
  if (!confirm('Khôi phục danh sách mặc định? Các tình trạng tự thêm sẽ bị xóa khỏi menu (dữ liệu KH vẫn giữ nguyên).')) return;
  _careStatusDraft = JSON.parse(JSON.stringify(CARE_STATUS_TREE_DEFAULT));
  renderCareStatusList();
  _renderCsParentSel();
}

// ── Drag & drop cho Care Status tree ──
function _initCsDragSort(container) {
  var dragSrc = null, dragPi = null, dragCi = null;

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

      // Root-level reorder
      if (dragCi === null && toCi === null && dragPi !== null && toPi !== null) {
        var moved = _careStatusDraft.splice(dragPi, 1)[0];
        _careStatusDraft.splice(toPi, 0, moved);
        renderCareStatusList();
        _renderCsParentSel();
        return;
      }
      // Child reorder within same parent
      if (dragCi !== null && toCi !== null && dragPi === toPi) {
        var parent = _careStatusDraft[dragPi];
        if (parent && parent.children) {
          var movedChild = parent.children.splice(dragCi, 1)[0];
          parent.children.splice(toCi, 0, movedChild);
          renderCareStatusList();
          return;
        }
      }
      // Cross-parent drag: child → child slot in another parent
      if (dragCi !== null && toCi !== null && dragPi !== toPi) {
        var fromP = _careStatusDraft[dragPi];
        var toP = _careStatusDraft[toPi];
        if (fromP && fromP.children && toP && toP.children) {
          var movedC = fromP.children.splice(dragCi, 1)[0];
          if (!fromP.children.length) { _careStatusDraft[dragPi] = { label: fromP.label, value: fromP.label }; }
          toP.children.splice(toCi, 0, movedC);
          renderCareStatusList();
          _renderCsParentSel();
        }
      }
    });
  });
}

async function saveCareStatusList() {
  // Cập nhật runtime tree
  CARE_STATUS_TREE.length = 0;
  _careStatusDraft.forEach(function(n) { CARE_STATUS_TREE.push(n); });
  _syncCareStatusFlat();
  // Lưu local
  saveLS('ome_care_status', CARE_STATUS_TREE);
  // Đồng bộ GSheets — gửi tree (GAS sẽ stringify như cũ)
  if (gsUrl) {
    try {
      var r = await fetch(gsUrl, {
        method: 'POST', redirect: 'follow',
        body: JSON.stringify({ action: 'saveCareStatus', careStatus: CARE_STATUS_TREE })
      });
      var d = await r.json();
      if (d && d.error) { toast('Lưu local ✓ — GSheets báo lỗi: ' + d.error); }
      else { toast('✓ Đã lưu và đồng bộ ' + FIELD_LABEL_CS + ' lên Google Sheets'); }
    } catch(e) {
      toast('✓ Đã lưu local — không đồng bộ được GSheets: ' + e.message);
    }
  } else {
    toast('✓ Đã lưu ' + FIELD_LABEL_CS + ' (chưa kết nối Google Sheets)');
  }
  // Refresh toàn bộ UI liên quan
  _refreshCareStatusUI();
  closeCareStatusModal();
}

function _refreshCareStatusUI() {
  // Đồng bộ flat array từ tree
  _syncCareStatusFlat();
  // 1. Sidebar care-filters
  updateSidebarCareFilters();
  // 2. Advanced filter chips nếu đang mở
  if (document.getElementById('adv-care-chips')) {
    buildAdvChips('careStatus', CARE_STATUS, advFilters.careStatus, 'adv-care-chips');
  }
  // 3. Column dropdown care
  renderColDdItems('care', '');
  // 4. Detail panel select (nếu đang mở) — DÙNG optgroup "Mẹ - Con" giống Trạng thái KH (không đánh số phẳng nữa)
  var sel = document.getElementById('cs-status');
  if (sel) {
    var cur = sel.value;
    sel.innerHTML = _buildCareStatusOptions(cur);
  }
  // 5. Reapply filters để badge count đúng
  if (typeof allCustomers !== 'undefined' && allCustomers.length) {
    updateStats();
    updateSidebarBadges();
    applyFilters();
  }
}

// Pull CARE_STATUS từ GSheets khi sync — hỗ trợ cả string[] cũ và tree mới
function _applyCareStatusFromGS(list) {
  if (!Array.isArray(list) || !list.length) return;
  var migrated = _migrateCareStatusIfNeeded(list);
  CARE_STATUS_TREE.length = 0;
  (migrated || list).forEach(function(n) { CARE_STATUS_TREE.push(n); });
  _syncCareStatusFlat();
  saveLS('ome_care_status', CARE_STATUS_TREE);
  _refreshCareStatusUI();
}

// Render sidebar care filters dynamically
function updateSidebarCareFilters() {
  var container = document.getElementById('care-filters');
  if (!container) return;
  // Màu dot mặc định theo index
  var dotColors = [
    '#16a34a','#ca8a04','#2563eb','#059669','#d97706',
    '#9ca3af','#dc2626','#f59e0b','#7c3aed','#0891b2','#64748b','#ec4899','#6b7280'
  ];
  var existing = currentCare; // giữ lại filter đang chọn
  container.innerHTML =
    '<button class="section-btn ' + (currentCare==='all'?'active':'') + '" onclick="setCareFilter(\'all\',this)"><div class="fleft"><span>Tất cả</span></div><span class="fbadge" id="bc-all">0</span></button>' +
    CARE_STATUS.map(function(st, i) {
      var color = dotColors[i % dotColors.length];
      var active = existing === st ? 'active' : '';
      var sid = 'bc-cs-' + i;
      return '<button class="section-btn ' + active + '" data-st="' + esc(st) + '" onclick="setCareFilter(this.dataset.st,this)">' +
        '<div class="fleft"><span class="fdot" style="background:' + color + '"></span><span><span style="color:var(--hint);font-size:10px;margin-right:2px">' + (i+1) + '.</span>' + esc(st) + '</span></div>' +
        '<span class="fbadge" id="' + sid + '">0</span></button>';
    }).join('');
  // Cập nhật badge count
  updateSidebarBadges();
}

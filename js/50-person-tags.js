// ═══════════════════════════════════════════════════════════════════════════════════════
//  THẺ CỦA NHÂN VIÊN (đặt ở Quản lý Team)
//  Mỗi người có thể có nhiều "thẻ" = các tên khác nhau của CHÍNH người đó trong Base (cột Sale bán) và Pos (cột Thẻ),
//  vd thuthuy95 + thuthuy1995. Chọn nhân viên = chọn tất cả thẻ của họ; chọn thẻ = ra đúng nhân viên đó (2 chiều).
//  Lưu ở Settings 'salePersonTags' = { "<tên chính>": ["thẻ 1", "thẻ 2", ...] } — backend (_userAliasGroups_) đọc cùng dữ liệu,
//  nên lọc Sale/Team và bảng "Theo Team" của mọi báo cáo đều dùng chung. Chọn Team → ra đúng báo cáo của mọi thẻ thuộc thành viên.
// ═══════════════════════════════════════════════════════════════════════════════════════
var SALE_PERSON_TAGS = (function(){
  try { var o = JSON.parse(localStorage.getItem('ome_sale_person_tags') || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch(e){ return {}; }
})();
function _ptFold(x){ return String(x||'').trim().toLowerCase(); }
// Nhóm đầy đủ (tên chính + các thẻ) chứa tên này, hoặc null.
function _ptGroupOf(name){
  var f = _ptFold(name); if (!f) return null;
  var keys = Object.keys(SALE_PERSON_TAGS);
  for (var i = 0; i < keys.length; i++){
    var grp = [keys[i]].concat(SALE_PERSON_TAGS[keys[i]] || []);
    for (var j = 0; j < grp.length; j++) if (_ptFold(grp[j]) === f) return grp;
  }
  return null;
}
function _ptPrimaryOf(name){
  var f = _ptFold(name), keys = Object.keys(SALE_PERSON_TAGS);
  for (var i = 0; i < keys.length; i++){
    if (_ptFold(keys[i]) === f) return keys[i];
    if ((SALE_PERSON_TAGS[keys[i]] || []).some(function(t){ return _ptFold(t) === f; })) return keys[i];
  }
  return name;
}
// Gắn thêm thẻ vào hàm gom tên theo người có sẵn (trước đây chỉ theo tài khoản nhiều tên).
(function(){
  var base = (typeof _personAliases === 'function') ? _personAliases : function(n){ return [n]; };
  _personAliases = function(name){
    var b = base(name) || [name], g = _ptGroupOf(name);
    if (!g) return b;
    var seen = {}, out = [];
    b.concat(g).forEach(function(n){ var k = _ptFold(n); if (n && !seen[k]) { seen[k] = 1; out.push(n); } });
    return out;
  };
})();
function _ptSave(){
  try { localStorage.setItem('ome_sale_person_tags', JSON.stringify(SALE_PERSON_TAGS)); } catch(e){}
  if (!gsUrl) return Promise.resolve();
  return fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setSetting', key:'salePersonTags', value: JSON.stringify(SALE_PERSON_TAGS) }) })
    .then(function(r){ return r.json().catch(function(){ return {}; }); })
    .then(function(d){ if (d && d.error) toast('Lưu local ✓ — chưa đồng bộ máy chủ: ' + d.error); });
}
async function _ptSyncFromGAS(){
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=salePersonTags', { redirect:'follow' });
    var d = await r.json();
    if (d && d.value){
      var o = JSON.parse(d.value);
      if (o && typeof o === 'object' && !Array.isArray(o)){ SALE_PERSON_TAGS = o; try { localStorage.setItem('ome_sale_person_tags', JSON.stringify(o)); } catch(e){} }
    }
  } catch(e){}
}
setTimeout(_ptSyncFromGAS, 0);

var _ptModal = { name:'', primary:'', tags:[], cands:[], q:'' };
async function _ptLoadCandidates(){
  var set = {}, add = function(n){ n = String(n||'').trim(); if (n) set[_ptFold(n)] = set[_ptFold(n)] || n; };
  (typeof _srState !== 'undefined' ? (_srState.saleBOptions || []).concat(_srState.saleOptions || []) : []).forEach(add);
  if (!Object.keys(set).length && typeof _srFetch === 'function'){
    try { var o = await _srFetch('salesReportOptions', {}); ((o && o.saleB) || []).concat((o && o.sale) || []).forEach(add); } catch(e){}
  }
  try { _allCSNames().forEach(add); } catch(e){}
  return Object.keys(set).map(function(k){ return set[k]; }).sort(function(a, b){ return a.localeCompare(b, 'vi'); });
}
async function openPersonTagsModal(name){
  if (currentUser.role !== 'admin'){ toast('Chỉ Admin mới sửa thẻ nhân viên'); return; }
  var primary = _ptPrimaryOf(name);
  _ptModal = { name: name, primary: primary, tags: (_ptGroupOf(name) || [primary]).filter(function(n){ return _ptFold(n) !== _ptFold(primary); }), cands: [], q: '' };
  var ov = document.getElementById('pt-modal');
  if (!ov){
    ov = document.createElement('div'); ov.id = 'pt-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:12px';
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div style="background:var(--bg,#fff);color:inherit;border-radius:12px;padding:16px;width:520px;max-width:100%;max-height:90vh;overflow:auto">Đang tải danh sách thẻ…</div>';
  ov.style.display = 'flex';
  _ptModal.cands = await _ptLoadCandidates();
  _ptRender();
}
function _ptOwnerOf(tag){
  // Thẻ này đang thuộc người nào khác? (tên chính của người đó) — để đổi ngược: biết thẻ là của ai.
  var f = _ptFold(tag), keys = Object.keys(SALE_PERSON_TAGS);
  for (var i = 0; i < keys.length; i++){
    if (_ptFold(keys[i]) === _ptFold(_ptModal.primary)) continue;
    if (_ptFold(keys[i]) === f || (SALE_PERSON_TAGS[keys[i]] || []).some(function(t){ return _ptFold(t) === f; })) return keys[i];
  }
  return '';
}
function _ptRender(){
  var ov = document.getElementById('pt-modal'); if (!ov) return;
  var m = _ptModal, q = _ptFold(m.q);
  var chosen = m.tags.map(function(t){
    return '<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;border-radius:12px;padding:2px 8px;margin:2px;font-size:12px">'+esc(t)+
      ' <span style="cursor:pointer;color:#b91c1c" data-tag="'+esc(t)+'" onclick="_ptToggle(this.dataset.tag)">✕</span></span>';
  }).join('') || '<span style="color:var(--muted);font-size:12px">Chưa có thẻ nào — tích bên dưới.</span>';
  var rows = m.cands.filter(function(n){ return _ptFold(n) !== _ptFold(m.primary) && (!q || _ptFold(n).indexOf(q) !== -1); }).slice(0, 80).map(function(n){
    var on = m.tags.some(function(t){ return _ptFold(t) === _ptFold(n); });
    var owner = _ptOwnerOf(n);
    return '<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid var(--border,#eee);cursor:pointer;font-size:13px">'+
      '<input type="checkbox" '+(on?'checked':'')+' data-tag="'+esc(n)+'" onchange="_ptToggle(this.dataset.tag)"> <span>'+esc(n)+'</span>'+
      (owner ? '<span style="color:#b45309;font-size:11px;margin-left:auto">đang là thẻ của '+esc(owner)+' — tích để chuyển sang người này</span>' : '')+'</label>';
  }).join('') || '<div style="color:var(--muted);padding:10px;font-size:12px">Không có thẻ nào khớp.</div>';
  ov.firstElementChild.innerHTML =
    '<div style="font-weight:700;font-size:15px;margin-bottom:4px">🏷️ Thẻ của <span style="color:#15803d">'+esc(m.primary)+'</span></div>'+
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.5">Thẻ = các tên của <b>cùng người này</b> trong Base (cột Sale bán) và Pos (cột Thẻ). Chọn nhân viên hay chọn thẻ đều ra cùng 1 người; chọn Team sẽ lấy đủ mọi thẻ của thành viên để báo cáo ra đúng.</div>'+
    '<div style="margin-bottom:8px"><b style="font-size:12px">Đang gán ('+m.tags.length+'):</b><div>'+chosen+'</div></div>'+
    '<input placeholder="🔍 Tìm thẻ (tên trong Base/Pos)…" value="'+esc(m.q)+'" oninput="_ptModal.q=this.value;_ptRender()" style="width:100%;box-sizing:border-box;margin-bottom:6px">'+
    '<div style="max-height:260px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:8px;padding:2px 6px">'+rows+'</div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn secondary" onclick="_ptClose()">Hủy</button><button class="btn" onclick="_ptCommit()">Lưu thẻ</button></div>';
  var inp = ov.querySelector('input[placeholder^="🔍"]'); if (inp && m.q){ inp.focus(); inp.setSelectionRange(m.q.length, m.q.length); }
}
function _ptToggle(tag){
  var i = _ptModal.tags.findIndex(function(t){ return _ptFold(t) === _ptFold(tag); });
  if (i >= 0) _ptModal.tags.splice(i, 1); else _ptModal.tags.push(tag);
  _ptRender();
}
function _ptClose(){ var ov = document.getElementById('pt-modal'); if (ov) ov.style.display = 'none'; }
async function _ptCommit(){
  var m = _ptModal, primary = m.primary;
  var before = (SALE_PERSON_TAGS[primary] || []).slice();
  // Mỗi thẻ chỉ thuộc 1 người: gỡ khỏi người khác (nếu vừa chuyển sang đây).
  Object.keys(SALE_PERSON_TAGS).forEach(function(k){
    if (_ptFold(k) === _ptFold(primary)) return;
    SALE_PERSON_TAGS[k] = (SALE_PERSON_TAGS[k] || []).filter(function(t){ return !m.tags.some(function(x){ return _ptFold(x) === _ptFold(t); }); });
    if (!SALE_PERSON_TAGS[k].length) delete SALE_PERSON_TAGS[k];
  });
  if (m.tags.length) SALE_PERSON_TAGS[primary] = m.tags.slice(); else delete SALE_PERSON_TAGS[primary];
  // Đồng bộ vào danh sách thành viên Team: thêm thẻ mới / bỏ thẻ vừa gỡ — để Team luôn chứa đủ thẻ của người đó.
  var removed = before.filter(function(t){ return !m.tags.some(function(x){ return _ptFold(x) === _ptFold(t); }); });
  (teams || []).forEach(function(t){
    var all = [t.leader].concat(t.members || []).filter(Boolean);
    var inTeam = all.some(function(n){ return _ptFold(n) === _ptFold(primary) || m.tags.concat(before).some(function(x){ return _ptFold(x) === _ptFold(n); }); });
    if (!inTeam) return;
    t.members = t.members || [];
    m.tags.forEach(function(x){ if (_ptFold(x) !== _ptFold(t.leader) && !t.members.some(function(y){ return _ptFold(y) === _ptFold(x); })) t.members.push(x); });
    t.members = t.members.filter(function(y){ return !removed.some(function(x){ return _ptFold(x) === _ptFold(y); }); });
  });
  saveLS('ome_teams', teams);
  try { logAudit('team', '', before.join(', '), 'Thẻ của ' + primary + ': ' + m.tags.join(', ')); } catch(e){}
  try { pushTeamsToGS(); } catch(e){}
  await _ptSave();
  _ptClose();
  toast('✓ Đã lưu thẻ của ' + primary);
  try { renderTeamTab(); } catch(e){}
}

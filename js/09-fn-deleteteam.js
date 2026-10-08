function deleteTeam(id){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  if (!confirm('Xoá team "'+t.name+'"? (Không xoá khách hàng, chỉ xoá nhóm)')) return;
  teams = teams.filter(function(x){ return x.id!==id; });
  saveLS('ome_teams', teams); logAudit('team','', t.name, 'Xoá team'); pushTeamsToGS();
  renderTeamTab();
  if (_activeV9Tab==='dashboard') renderDashboard();
}
function setTeamLeader(id, name){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  if ((t.members||[]).indexOf(name)===-1) t.members.push(name);
  t.members = t.members.filter(function(m){ return m!==name; });
  t.leader = name;
  saveLS('ome_teams', teams); logAudit('team','', '', t.name+': đặt leader = '+name); pushTeamsToGS();
  renderTeamTab();
}
function addTeamMember(id, name){
  name=(name||'').trim(); if(!name) return;
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  if (name===t.leader) return;
  t.members = t.members || [];
  // thêm 1 tên thì thêm luôn các tên khác của CÙNG 1 người (cùng tài khoản) — để team không bị thiếu/lệch tên
  _personAliases(name).forEach(function(a){
    if (a && a!==t.leader && t.members.indexOf(a)===-1) t.members.push(a);
  });
  if (t.members.indexOf(name)===-1) t.members.push(name);
  saveLS('ome_teams', teams); logAudit('team','', '', t.name+': + '+name); pushTeamsToGS();
  renderTeamTab();
}
function removeTeamMember(id, name){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  var _als = _personAliases(name).map(function(x){ return String(x).toLowerCase(); });   // xoá cả các tên khác của cùng 1 người
  if (_als.indexOf(String(t.leader).toLowerCase())!==-1){ t.leader=''; }
  t.members = (t.members||[]).filter(function(m){ return _als.indexOf(String(m).toLowerCase())===-1; });
  saveLS('ome_teams', teams); logAudit('team','', name, t.name+': − '+name); pushTeamsToGS();
  renderTeamTab();
}
// ── Ô tìm & thêm 1 thành viên vào team (gõ để lọc, không phân biệt hoa/thường/dấu; bấm vào ô = xổ cả danh sách) ──
// Thay cho <select> cũ (không gõ tìm được) + ô "gõ tên mới" (gõ rồi Enter là TẠO tên mới ngay → dễ thêm nhầm
// "ninh" thay vì chọn "ninhnga99"). Nay Enter luôn chọn dòng đang sáng; tên mới chỉ thêm khi chọn dòng "＋ Thêm mới".
function _vnNorm(x){ return String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim(); }
function _teamComboMatches(teamId, q){
  var t = teams.find(function(x){ return x.id===teamId; }); if(!t) return {matches:[], canNew:false, q:''};
  var inTeam = {}; [t.leader].concat(t.members||[]).forEach(function(m){ if(m) inTeam[m]=1; });
  var all = _allCSNames();
  var nq = _vnNorm(q);
  var matches = all.filter(function(n){ return !inTeam[n] && (!nq || _vnNorm(n).indexOf(nq)!==-1); });
  var raw = String(q||'').trim();
  var exists = all.some(function(n){ return _vnNorm(n)===nq; });   // đã có (kể cả đã là thành viên) → không đề nghị tạo mới
  return {matches:matches, canNew: !!raw && !exists, q: raw};
}
function _teamComboShow(inp){
  var list = inp.parentNode.querySelector('.team-combo-list'); if(!list) return;
  var tid = inp.getAttribute('data-team');
  var r = _teamComboMatches(tid, inp.value);
  var h = r.matches.map(function(n,i){
    return '<div class="team-combo-item'+(i===0?' hi':'')+'" data-name="'+esc(n)+'" onmousedown="event.preventDefault();_teamComboPick(\''+tid+'\',this.dataset.name,false)">'+esc(n)+'</div>';
  }).join('');
  if (r.canNew) h += '<div class="team-combo-item team-combo-new'+(!r.matches.length?' hi':'')+'" data-name="'+esc(r.q)+'" onmousedown="event.preventDefault();_teamComboPick(\''+tid+'\',this.dataset.name,true)">＋ Thêm mới “'+esc(r.q)+'”</div>';
  if (!h) h = '<div class="team-combo-empty">Không còn nhân viên nào để thêm</div>';
  list.innerHTML = h; list.style.display = '';
}
function _teamComboHide(inp){
  setTimeout(function(){ var l = inp.parentNode && inp.parentNode.querySelector('.team-combo-list'); if(l) l.style.display='none'; }, 120);
}
function _teamComboKey(ev, inp){
  var list = inp.parentNode.querySelector('.team-combo-list'); if(!list) return;
  var items = [].slice.call(list.querySelectorAll('.team-combo-item'));
  if (ev.key==='Escape'){ list.style.display='none'; return; }
  if (!items.length) return;
  var cur = items.findIndex(function(el){ return el.classList.contains('hi'); });
  if (ev.key==='ArrowDown' || ev.key==='ArrowUp'){
    ev.preventDefault();
    var nx = ev.key==='ArrowDown' ? Math.min(items.length-1, cur+1) : Math.max(0, cur-1);
    items.forEach(function(el){ el.classList.remove('hi'); }); items[nx].classList.add('hi');
    items[nx].scrollIntoView({block:'nearest'});
  } else if (ev.key==='Enter'){
    ev.preventDefault();
    var el = items[cur>=0?cur:0];
    _teamComboPick(inp.getAttribute('data-team'), el.dataset.name, el.classList.contains('team-combo-new'));
  }
}
function _teamComboPick(teamId, name, isNew){
  addTeamMember(teamId, name);
  // addTeamMember vẽ lại cả tab → đặt lại con trỏ vào ô để thêm tiếp người kế mà không phải bấm lại
  setTimeout(function(){ var el = document.querySelector('.team-combo-inp[data-team="'+teamId+'"]'); if(el) el.focus(); }, 0);
}
function toggleTeamPicker(id){ _teamPickerOpen[id] = !_teamPickerOpen[id]; renderTeamTab(); }
function setTeamMemberChecked(id, name, checked){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  if (name===t.leader) return;                       // leader luôn là thành viên
  var _als2 = _personAliases(name);
  t.members = t.members || [];
  if (checked){ _als2.forEach(function(a){ if (a && a!==t.leader && t.members.indexOf(a)===-1) t.members.push(a); }); }
  else { var _lw = _als2.map(function(x){ return String(x).toLowerCase(); }); t.members = t.members.filter(function(m){ return _lw.indexOf(String(m).toLowerCase())===-1; }); }
  saveLS('ome_teams', teams); pushTeamsToGS();
  renderTeamTab();
}
function teamPickAll(id, checked){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  if (checked){ t.members = _allCSNames().filter(function(n){ return n!==t.leader; }); } // chọn tất cả (trừ leader đã nằm trong)
  else { t.members = []; }                            // bỏ hết (leader vẫn giữ)
  saveLS('ome_teams', teams);
  logAudit('team','', '', t.name + (checked ? ': chọn TẤT CẢ CS làm thành viên' : ': bỏ hết thành viên'));
  pushTeamsToGS();
  renderTeamTab();
}
function _teamPickerFilter(id, q){
  q = (q||'').toLowerCase().trim();
  var grid = document.getElementById('team-picker-grid-'+id); if(!grid) return;
  grid.querySelectorAll('.team-cs-chk').forEach(function(el){
    el.style.display = (!q || (el.getAttribute('data-name')||'').indexOf(q)!==-1) ? '' : 'none';
  });
}
function toggleTeamChanPicker(id){ _teamChanPickerOpen[id] = !_teamChanPickerOpen[id]; renderTeamTab(); }
function setTeamChannelChecked(id, channel, checked){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  t.channels = t.channels || [];
  if (checked){ if (t.channels.indexOf(channel)===-1) t.channels.push(channel); }
  else { t.channels = t.channels.filter(function(c){ return c!==channel; }); }
  saveLS('ome_teams', teams); logAudit('team','', '', t.name+': kênh → '+(t.channels.length?t.channels.join(', '):'(không giới hạn)'));
  pushTeamsToGS();
  renderTeamTab();
  if (_activeV9Tab==='dashboard') renderDashboard();
}
function teamChannelPickAll(id, checked){
  var t = teams.find(function(x){ return x.id===id; }); if(!t) return;
  t.channels = checked ? _allChannelNames() : [];
  saveLS('ome_teams', teams);
  logAudit('team','', '', t.name + (checked ? ': chọn TẤT CẢ kênh (= không giới hạn)' : ': bỏ hết kênh đã chọn (= không giới hạn)'));
  pushTeamsToGS();
  renderTeamTab();
  if (_activeV9Tab==='dashboard') renderDashboard();
}
function _teamChanPickerFilter(id, q){
  q = (q||'').toLowerCase().trim();
  var grid = document.getElementById('team-chan-grid-'+id); if(!grid) return;
  grid.querySelectorAll('.team-cs-chk').forEach(function(el){
    el.style.display = (!q || (el.getAttribute('data-name')||'').indexOf(q)!==-1) ? '' : 'none';
  });
}

async function _pkLoadNameMap(){
  if (!gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=pancakeNameMap', { redirect:'follow' });
    var d = await r.json();
    _pkState.nameMap = d.map || {};
    _pkState.serverNames = d.allNames || [];
    _pkState.nameMapLoaded = true;
  } catch(e){ console.error('pancakeNameMap load lỗi', e); }
}

// Khop pageId Pancake <-> "Kenh ban" chuan dung trong DT TONG (de ghep doanh thu/so don
// theo dung Page o Bao cao KPI tong hop). Cung load danh sach Kenh ban co san (tu DT TONG)
// de lam dropdown, tranh go tay sai chinh ta lam khop nham.
async function _pkLoadPageMap(){
  if (!gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=pancakePageMap', { redirect:'follow' });
    var d = await r.json();
    _pkState.pageMap = d.map || {};
    _pkState.serverPages = d.allPages || [];
    var opts = await _srFetch('salesReportOptions', {});
    _pkState.kenhOptions = (opts && opts.kenh) || [];
    _pkState.pageMapLoaded = true;
  } catch(e){ console.error('pancakePageMap load lỗi', e); }
}

// Bản đồ "quy chuẩn tag lạ → L1..L6", lưu chung trên server (setSetting/getSetting có sẵn)
// để cả team dùng chung, không phụ thuộc trình duyệt như tagRows.
async function _pkLoadTagOverrideMap(){
  if (!gsUrl) return;
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=getSetting&key=pancakeTagOverride', { redirect:'follow' });
    var d = await r.json();
    var map = {};
    if (d && d.value) { try { map = JSON.parse(d.value) || {}; } catch(e){} }
    _pkState.tagOverrideMap = map;
    _pkState.tagOverrideLoaded = true;
  } catch(e){ console.error('pancakeTagOverride load lỗi', e); }
}

// ── Goi y tu dong quy chuan tag -> ma Sale (doi chieu ten tag voi Ten Facebook / User Base trong _PK_SALE_DIR) ──
function _pkNorm_(str){
  return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^a-z]/g,'');
}
function _pkBigrams_(t){ var o={}; for (var i=0;i<t.length-1;i++) o[t.substr(i,2)]=1; return o; }
function _pkSim_(a,b){
  if (!a||!b) return 0;
  if (a===b) return 1;
  var mn = Math.min(a.length,b.length);
  if (mn>=4 && (a.indexOf(b)===0 || b.indexOf(a)===0)) return 0.9;
  var A=_pkBigrams_(a), B=_pkBigrams_(b), ka=Object.keys(A), kb=Object.keys(B);
  if (!ka.length||!kb.length) return 0;
  var common=0; ka.forEach(function(k){ if (B[k]) common++; });
  return 2*common/(ka.length+kb.length);
}
// tagNames: mang ten tag chua quy chuan. Tra ve {list:[{tag,code,label,score,level}], byTag:{tag:idx}}
function _pkSuggestTagMap(tagNames){
  var list=[], byTag={};
  tagNames.forEach(function(tag){
    var hint = (String(tag).match(/^\s*([SsOo])\s*[-_.]/)||[])[1];
    hint = hint ? hint.toUpperCase() : '';
    var t = _pkNorm_(String(tag).replace(/^\s*[SsOo]\s*[-_.]\s*/,''));
    if (t.length<3) return;
    var scored = _PK_SALE_DIR.filter(function(sd){ return !hint || sd.code.charAt(0)===hint; }).map(function(sd){
      var fields=[_pkNorm_(sd.fb), _pkNorm_(sd.base)];
      var sc=0; fields.forEach(function(f){ sc=Math.max(sc,_pkSim_(t,f)); });
      return {sd:sd, sc:sc};
    }).sort(function(a,b){ return b.sc-a.sc; });
    if (!scored.length) return;
    var best=scored[0], second=scored[1];
    if (best.sc<0.65) return;
    if (second && second.sc>=best.sc-0.05) return; // 2 nguoi gan ngang nhau -> khong doan
    if (second && best.sc<0.9 && best.sc-second.sc<0.12) return;
    var level = best.sc>=0.9 ? 'high' : 'med';
    byTag[tag]=list.length;
    list.push({ tag:tag, code:best.sd.code, label:best.sd.code+' \u2013 '+best.sd.fb+(best.sd.base?' ('+best.sd.base+')':''), score:best.sc, level:level });
  });
  return { list:list, byTag:byTag };
}
async function _pkSaveTagOverrideMany(pairs){ // pairs: [{tag, code}] — 1 lan ghi cho ca lo
  if (!gsUrl){ toast('\u26a0\ufe0f Ch\u01b0a c\u1ea5u h\u00ecnh URL Google Apps Script.'); return; }
  try {
    var map = Object.assign({}, _pkState.tagOverrideMap || {});
    pairs.forEach(function(p){ if (p.code) map[p.tag]=p.code; else delete map[p.tag]; });
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'pancakeTagOverride', value: JSON.stringify(map) }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    _pkState.tagOverrideMap = map;
    logAudit('pancake_tag_map','', '', 'Quy chu\u1ea9n '+pairs.length+' tag (g\u1ee3i \u00fd t\u1ef1 \u0111\u1ed9ng): '+pairs.map(function(p){ return p.tag+'\u2192'+p.code; }).join(', '));
    toast('\u2713 \u0110\u00e3 quy chu\u1ea9n '+pairs.length+' tag');
    _pkRenderAll();
  } catch(e){ toast('\u26a0\ufe0f L\u1ed7i l\u01b0u quy chu\u1ea9n tag: ' + e.message); }
}
function _pkUseTagSuggest(i){ var x=(_pkState.tagSuggest||[])[i]; if (x) _pkSaveTagOverrideMany([{tag:x.tag, code:x.code}]); }
function _pkUseAllTagSuggest(level){
  var arr=(_pkState.tagSuggest||[]).filter(function(x){ return level==='all' || x.level==='high'; });
  if (!arr.length) return;
  var msg='\u00c1p d\u1ee5ng '+arr.length+' g\u1ee3i \u00fd?\n\n'+arr.map(function(x){ return x.tag+'  \u2192  '+x.label; }).join('\n');
  if (confirm(msg)) _pkSaveTagOverrideMany(arr.map(function(x){ return {tag:x.tag, code:x.code}; }));
}

async function _pkSaveTagOverride(sel){
  var tag = sel.getAttribute('data-tag');
  var code = sel.value;
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  try {
    var map = Object.assign({}, _pkState.tagOverrideMap || {});
    if (code) map[tag] = code; else delete map[tag];
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'pancakeTagOverride', value: JSON.stringify(map) }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    _pkState.tagOverrideMap = map;
    var saleRec = _PK_SALE_DIR.filter(function(sd){ return sd.code===code; })[0];
    var codeLabel = code ? (_PK_STATUS_LABEL[code] || (saleRec ? (saleRec.code+' – '+saleRec.fb) : code)) : '(bỏ quy chuẩn)';
    logAudit('pancake_tag_map','', '', 'Quy chuẩn tag "'+tag+'" → '+codeLabel);
    toast('✓ Đã quy chuẩn "'+tag+'" → '+codeLabel);
    _pkRenderAll();
  } catch(e){
    toast('❌ Lỗi lưu quy chuẩn tag: ' + e.message);
  }
}

async function renderPancakeTab(){
  var wrap = document.getElementById('pancake-wrap');
  if (!wrap) return;
  if (!_pkState.nameMapLoaded) { wrap.innerHTML = '<div style="padding:20px;color:var(--muted)">Đang tải dữ liệu khớp tên…</div>'; await _pkLoadNameMap(); }
  if (!_pkState.tagOverrideLoaded) await _pkLoadTagOverrideMap();
  if (!_pkState.pageMapLoaded) await _pkLoadPageMap();
  _pkRenderAll();
}

function _pkRenderAll(){
  var wrap = document.getElementById('pancake-wrap');
  if (!wrap) return;
  var isAdmin = currentUser.role === 'admin' || currentUser.role === 'demo';
  var html = '';

  html += '<div class="dash-section-title">📥 Nhập báo cáo Pancake hàng ngày</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Trên Pancake: <b>Thống kê → Thống kê tương tác → Xuất Excel</b> (file <code>pages_statistics_engagements...xlsx</code>). Có thể nạp lại nhiều lần trong ngày — dữ liệu cùng ngày sẽ tự ghi đè, không bị nhân đôi.</div>';
  html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'+
    '<input type="file" id="pk-file-input" accept=".xlsx,.xls" onchange="_pkOnFileSelected(this)">'+
    (_pkState.parsedRows.length ? '<span style="font-size:12px;color:var(--muted)">Đã đọc <b>'+_pkState.parsedRows.length+'</b> dòng — kiểm tra bên dưới rồi bấm Lưu.</span>' : '')+
  '</div>';

  if (_pkState.parsedRows.length){
    html += _pkRenderPreviewHtml();
  }

  html += '<div class="dash-section-title" style="margin-top:22px">📱 Nhập báo cáo SĐT thu thập / đơn chốt hàng ngày</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Trên Pancake: <b>Thống kê → Thống kê nhân viên → Xuất Excel</b> (file <code>user_statistics_multi_pages...xlsx</code>). Có thể nạp lại nhiều lần trong ngày — dữ liệu cùng ngày sẽ tự ghi đè, không bị nhân đôi.</div>';
  html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'+
    '<input type="file" id="pk-sdt-file-input" accept=".xlsx,.xls" onchange="_pkOnSdtFileSelected(this)">'+
    (_pkState.sdtParsedRows.length ? '<span style="font-size:12px;color:var(--muted)">Đã đọc <b>'+_pkState.sdtParsedRows.length+'</b> dòng — kiểm tra bên dưới rồi bấm Lưu.</span>' : '')+
  '</div>';

  if (_pkState.sdtParsedRows.length){
    html += _pkRenderSdtPreviewHtml();
  }

  html += '<details'+(_pkState.nameMapSectionOpen?' open':'')+' ontoggle="_pkState.nameMapSectionOpen=this.open" style="margin-top:22px">'+
    '<summary class="dash-section-title" style="cursor:pointer;display:inline-block">🔗 Khớp tên Nhân viên Pancake ↔ Sale CRM</summary>'+
    '<div style="font-size:12px;color:var(--muted);margin:8px 0">Tên "Nhân viên" trên Pancake là tên Facebook cá nhân, thường không khớp tên đăng nhập (Sale) trong CRM — khớp 1 lần, dùng lại cho mọi lần nạp báo cáo sau.</div>'+
    _pkRenderMapTableHtml(isAdmin)+
  '</details>';

  html += '<div class="dash-section-title" style="margin-top:22px">🔗 Khớp Page Pancake ↔ Kênh bán CRM (DT TỔNG)</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Dùng để ghép đúng doanh thu/số đơn của mỗi Page (cột "Kênh bán" trong DT TỔNG) với số liệu tương tác/SĐT của Page đó ở Báo cáo KPI tổng hợp.</div>';
  html += _pkRenderPageMapTableHtml(isAdmin);

  html += '<div class="dash-section-title" style="margin-top:22px">📊 Báo cáo theo Page &amp; theo CS</div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">'+
    _quickRangeSelectHtml(_pkState.fromQuick, "_pkApplyQuickRange(this.value)")+
    '<input type="date" value="'+esc(_pkState.from)+'" onchange="_pkState.from=this.value;_pkState.fromQuick=\'custom\'" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<span>→</span>'+
    '<input type="date" value="'+esc(_pkState.to)+'" onchange="_pkState.to=this.value;_pkState.fromQuick=\'custom\'" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
    '<button class="btn primary" onclick="_pkLoadReport()">'+(_pkState.reportLoading?'Đang tải...':'Xem báo cáo')+'</button>'+
    '<select onchange="_pkState.pkSplit=this.value;if(_pkState.report)_pkLoadReport();" title="Áp dụng khi 1 tên Pancake gắn cho nhiều Sale" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
      '<option value="equal"'+(_pkState.pkSplit==='full'?'':' selected')+'>Tên gắn nhiều Sale: chia đều</option>'+
      '<option value="full"'+(_pkState.pkSplit==='full'?' selected':'')+'>Tên gắn nhiều Sale: tính đủ cho mỗi Sale</option>'+
    '</select>'+
    (_pkState.report ? '<button class="btn sm secondary" onclick="_pkExportReport()">⬇ Xuất Excel</button>' : '')+
  '</div>';
  html += '<div id="pk-report-area">' + (_pkState.report ? _pkRenderReportHtml() : '<div style="color:var(--muted);padding:10px">Chọn khoảng ngày rồi bấm "Xem báo cáo".</div>') + '</div>';

  html += _pkTagSectionHtml();

  wrap.innerHTML = html;
}

// Phân loại 1 tên tag -> {type:'sale'|'status'|'other', code:'S1'|'L5.1'|''}
function _pkClassifyTag(name){
  var n = String(name||'').trim();
  // Uu tien quy chuan tay (admin gan thu cong cho cac tag khong theo dung mau) truoc regex.
  var ov = _pkState.tagOverrideMap && _pkState.tagOverrideMap[n];
  if (ov){
    if (_PK_STATUS_LABEL[ov]) return { type:'status', code: ov };
    if (/^([SO])\d+$/i.test(ov)) return { type:'sale', code: ov.toUpperCase() }; // gan thang ve 1 Sale du ten tag khong theo mau S#/O#
  }
  var m = n.match(/^([SO])\s*(\d+)(?![\d])/i);
  if (m) return { type:'sale', code: m[1].toUpperCase()+parseInt(m[2],10) };
  // tag trạng thái cũ "L6. Chờ CK" (trước khi đổi tên) -> vẫn hiểu là L5.1
  if (/^L\s*\d?\.?\s*ch[oờ]\s*ck/i.test(n) || /^L5\.1/i.test(n)) return { type:'status', code:'L5.1' };
  if (/^L5\.2/i.test(n) || /^L\s*\d?\.?\s*ch[oờ]\s*l[eê]n/i.test(n)) return { type:'status', code:'L5.2' };
  m = n.match(/^L\s*(\d)(?!\d)/i);
  if (m) return { type:'status', code:'L'+m[1] };
  return { type:'other', code:'' };
}

function _pkParseTagFile(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(ev){ try { resolve(_pkParseTagWorkbook(XLSX.read(ev.target.result, {type:'array'}))); } catch(err){ reject(err); } };
    reader.onerror = function(){ reject(new Error('Không đọc được file.')); };
    reader.readAsArrayBuffer(file);
  });
}

function _pkParseTagWorkbook(wb){
  var rows = [], warnings = [], pageNames = {}, dates = {}, fileStart = '';
  // ngày bắt đầu của file (lấy từ dòng "Thời gian tải về" ở bất kỳ sheet nào)
  wb.SheetNames.forEach(function(sn){
    if (fileStart) return;
    var a0 = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:''});
    for (var q=0;q<Math.min(a0.length,8);q++){
      var mq = String(a0[q][0]||'').match(/Th[oờ]i gian t[aả]i v[eề]:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (mq){ fileStart = mq[3]+'-'+mq[2].padStart(2,'0')+'-'+mq[1].padStart(2,'0'); break; }
    }
  });
  wb.SheetNames.forEach(function(sn){
    if (!/^\d+$/.test(sn.trim())) return;            // chỉ lấy sheet theo ngày "<pageId>", bỏ sheet "<pageId> today" (theo giờ)
    var pageId = sn.trim();
    var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:''});
    var hRow = -1;
    for (var i=0;i<Math.min(aoa.length,15);i++){
      if (String(aoa[i][0]).trim()==='ID' && String(aoa[i][1]).trim()==='name'){ hRow = i; break; }
    }
    if (hRow === -1){ warnings.push('Sheet "'+sn+'": không thấy dòng tiêu đề (ID, name) — bỏ qua.'); return; }

    // Tên Page + năm/tháng bắt đầu từ các dòng đầu
    var startY = new Date().getFullYear(), startM = 1;
    for (var a=0;a<hRow;a++){
      var c = String(aoa[a][0]||'');
      var mp = c.match(/Th[oờ]i gian t[aả]i v[eề]:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (mp){ startM = parseInt(mp[2],10); startY = parseInt(mp[3],10); }
      if (/^Trang:/.test(c)){
        var body = c.replace(/^Trang:\s*/, ''), re = /(?:^|,\s*)(.+?)\s*\((\d{8,})\)/g, mm;
        while ((mm = re.exec(body))) pageNames[mm[2]] = mm[1].trim();
      }
    }
    // Các cột ngày: '19/09' (DD/MM)
    var head = aoa[hRow], dateCols = [];
    for (var col=4; col<head.length; col++){
      var dm = String(head[col]).trim().match(/^(\d{1,2})\/(\d{1,2})$/);
      if (dm){
        var mo = parseInt(dm[2],10), y = startY + (mo < startM ? 1 : 0);
        dateCols.push({ col: col, date: y+'-'+String(mo).padStart(2,'0')+'-'+String(parseInt(dm[1],10)).padStart(2,'0') });
      }
    }
    if (!dateCols.length){
      // Sheet không có cột ngày (thường là page không có dữ liệu): dùng cột "total" nếu có số, ngược lại bỏ qua
      var hasNum = false;
      for (var z=hRow+1; z<aoa.length; z++){ if (!isNaN(parseFloat(aoa[z][3]))){ hasNum = true; break; } }
      if (!hasNum || !fileStart) return;
      dateCols.push({ col: 3, date: fileStart });
    }
    for (var r=hRow+1; r<aoa.length; r++){
      var name = String(aoa[r][1]||'').trim();
      if (!name) continue;
      var cls = _pkClassifyTag(name);
      dateCols.forEach(function(dc){
        var v = parseFloat(aoa[r][dc.col]); if (isNaN(v)) v = 0;
        dates[dc.date] = true;
        rows.push({ date: dc.date, pageId: pageId, tagId: String(aoa[r][0]||''), tagName: name, type: cls.type, code: cls.code, count: v });
      });
    }
  });
  rows.forEach(function(x){ x.pageName = pageNames[x.pageId] || x.pageId; });
  return { rows: rows, warnings: warnings, dates: Object.keys(dates).sort() };
}

function _pkTagAggregate(rows){
  var pages = [], pageSeen = {};
  rows.forEach(function(x){ if (!pageSeen[x.pageId]){ pageSeen[x.pageId] = 1; pages.push({id:x.pageId, name:x.pageName}); } });
  function bucket(){ var b = {total:0}; pages.forEach(function(p){ b[p.id] = 0; }); return b; }
  var sale = {}, status = {}, other = {};
  _PK_SALE_DIR.forEach(function(s){ sale[s.code] = bucket(); });
  Object.keys(_PK_STATUS_LABEL).forEach(function(k){ status[k] = bucket(); });
  rows.forEach(function(x){
    var cls = _pkClassifyTag(x.tagName); // phan loai lai theo quy chuan hien tai (khong dung x.type/x.code da cache luc parse), de quy chuan tay ap dung duoc cho ca du lieu cu
    var tgt = null;
    if (cls.type === 'sale'){ if (!sale[cls.code]) sale[cls.code] = bucket(); tgt = sale[cls.code]; if (!tgt.names) tgt.names = {}; tgt.names[x.tagName] = 1; }
    else if (cls.type === 'status'){ tgt = status[cls.code]; }
    else { if (!other[x.tagName]) other[x.tagName] = bucket(); tgt = other[x.tagName]; }
    if (tgt){ tgt[x.pageId] += x.count; tgt.total += x.count; }
  });
  return { pages: pages, sale: sale, status: status, other: other };
}

function _pkN(v){ return (Math.round(v*100)/100).toLocaleString('vi-VN'); }

function _pkTagLoad(){
  if (_pkState.tagLoaded) return;
  _pkState.tagLoaded = true;
  try {
    var raw = localStorage.getItem(_PK_TAG_LS);
    if (raw){ var rows = JSON.parse(raw); if (Array.isArray(rows) && rows.length){ _pkState.tagRows = rows; _pkTagResetRange(); } }
  } catch(e){ console.warn('pk tag load lỗi', e); }
}
function _pkTagSave(){
  try { localStorage.setItem(_PK_TAG_LS, JSON.stringify(_pkState.tagRows)); }
  catch(e){ toast('⚠️ Không lưu được dữ liệu tag trên trình duyệt (bộ nhớ đầy?). Vẫn xem được trong phiên này.'); }
}
function _pkTagDates(rows){
  var m = {}; rows.forEach(function(x){ m[x.date] = 1; });
  return Object.keys(m).sort();
}
function _pkTagResetRange(){
  var ds = _pkTagDates(_pkState.tagRows);
  _pkState.tagFrom = ds.length ? ds[0] : '';
  _pkState.tagTo = ds.length ? ds[ds.length-1] : '';
  _pkState.tagQuick = 'custom';
}
function _pkTagFiltered(){
  var f = _pkState.tagFrom, t = _pkState.tagTo;
  return _pkState.tagRows.filter(function(x){ return (!f || x.date >= f) && (!t || x.date <= t); });
}
// Gộp dòng mới vào dữ liệu cũ: cùng ngày + page + tag thì lấy bản mới nhất
function _pkTagMerge(newRows){
  var map = {};
  _pkState.tagRows.concat(newRows).forEach(function(x){ map[x.date+'|'+x.pageId+'|'+(x.tagId||x.tagName)] = x; });
  _pkState.tagRows = Object.keys(map).map(function(k){ return map[k]; });
}

async function _pkOnTagFileSelected(input){
  var files = input.files ? Array.prototype.slice.call(input.files) : [];
  if (!files.length) return;
  _pkTagLoad();
  var okFiles = 0, added = 0, warns = [];
  for (var i=0;i<files.length;i++){
    try {
      var res = await _pkParseTagFile(files[i]);
      if (!res.rows.length){ warns.push(files[i].name+': không đọc được dòng nào (đúng file "Thống kê tag" chưa?)'); continue; }
      _pkTagMerge(res.rows); okFiles++; added += res.rows.length;
      res.warnings.forEach(function(w){ warns.push(w); });
    } catch(e){ warns.push(files[i].name+': '+e.message); }
  }
  if (okFiles){ _pkTagSave(); _pkTagResetRange(); }
  if (warns.length) toast('⚠️ ' + warns.join(' | '));
  else toast('✅ Đã nạp '+okFiles+' file tag.');
  _pkRenderAll();
}
function _pkTagApplyQuick(key){
  _pkState.tagQuick = key;
  if (key === 'custom'){ _pkRenderAll(); return; }
  var r = _pkQuickRange(key); if (!r){ _pkRenderAll(); return; }
  // FIX: du lieu tag chi co trong khoang ngay THUC SU da tung nap (allDates), khac voi cac
  // bao cao doc thang tu Sheet — chon nhanh "Nam truoc" ma chi co 1 tuan du lieu se ra khoang
  // trong, khong co gi de xem. Gioi han (clamp) ket qua trong khoang du lieu that co.
  var allDates = _pkTagDates(_pkState.tagRows);
  if (allDates.length){
    var from = r.from < allDates[0] ? allDates[0] : r.from;
    var to = r.to > allDates[allDates.length-1] ? allDates[allDates.length-1] : r.to;
    if (from > to){ from = allDates[0]; to = allDates[allDates.length-1]; }
    _pkState.tagFrom = from; _pkState.tagTo = to;
  } else {
    _pkState.tagFrom = r.from; _pkState.tagTo = r.to;
  }
  _pkRenderAll();
}
function _pkTagSetRange(which, val){
  _pkState[which === 'from' ? 'tagFrom' : 'tagTo'] = val;
  _pkState.tagQuick = 'custom';
  if (_pkState.tagFrom && _pkState.tagTo && _pkState.tagFrom > _pkState.tagTo){
    var tmp = _pkState.tagFrom; _pkState.tagFrom = _pkState.tagTo; _pkState.tagTo = tmp;
  }
  _pkRenderAll();
}
function _pkTagClear(){
  if (!confirm('Xóa toàn bộ dữ liệu tag đã nạp trên trình duyệt này?')) return;
  _pkState.tagRows = []; _pkState.tagFrom = ''; _pkState.tagTo = '';
  try { localStorage.removeItem(_PK_TAG_LS); } catch(e){}
  _pkRenderAll();
}

// Đẩy dữ liệu tag (đang chỉ nằm trên trình duyệt máy này) lên sheet PancakeTagStats trên CRM —
// dùng chung cho cả team, và là NGUỒN DUY NHẤT mà tab "Báo cáo KPI Pancake" đọc để tính tỷ lệ
// L1-L7 (server không đọc được localStorage của trình duyệt). Gửi nguyên _pkState.tagRows —
// savePancakeTagStats_ tự khử trùng theo khoá ngày+page+tag, gửi lại nhiều lần vẫn an toàn.
async function _pkTagSaveToServer(){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  var rows = _pkState.tagRows;
  if (!rows.length){ toast('Chưa có dữ liệu tag để lưu.'); return; }
  _pkState.tagSaving = true; _pkRenderAll();
  try {
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'savePancakeTagStats', rows: rows }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    _pkState.tagSavedAt = new Date().toLocaleString('vi-VN');
    _pkState.kpiReport = null; // du lieu tag vua doi -> bao cao KPI tong hop cu co the sai, yeu cau tinh lai
    _pkKpiRefreshIfOpen();
    logAudit('pancake_tag_save','', '', 'Lưu '+rows.length+' dòng dữ liệu tag Pancake lên CRM');
    toast('✓ Đã lưu '+d.written+' dòng dữ liệu tag lên CRM.');
  } catch(e){
    toast('❌ Lưu dữ liệu tag lỗi: ' + e.message);
  } finally {
    _pkState.tagSaving = false; _pkRenderAll();
  }
}

function _pkTagSectionHtml(){
  _pkTagLoad();
  var all = _pkState.tagRows, has = all.length > 0;
  var html = '<div class="dash-section-title" style="margin-top:22px">🏷️ Báo cáo theo TAG (file "Thống kê tag")</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Trên Pancake: <b>Thống kê → Thống kê tag → Xuất Excel</b> (file <code>pages_statistics_tag...xlsx</code>). Có thể chọn nhiều file cùng lúc; mỗi ngày nạp 1 file, dữ liệu được gộp và lưu trên trình duyệt này để xem theo khoảng ngày. Nạp lại file của cùng một ngày thì bản mới thay bản cũ. Tag Sale khớp theo mã <b>S1, S2… O8, O9…</b> nên tên tag bị Pancake cắt ngắn vẫn khớp đúng.</div>';
  html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><input type="file" id="pk-tag-file-input" accept=".xlsx,.xls" multiple onchange="_pkOnTagFileSelected(this)">'+
    (has ? '<button class="btn sm primary" onclick="_pkTagSaveToServer()" '+(_pkState.tagSaving?'disabled':'')+'>'+(_pkState.tagSaving?'Đang lưu...':'💾 Lưu lên CRM (dùng chung cả team)')+'</button><button class="btn sm secondary" onclick="_pkExportTagReport()">⬇ Xuất Excel</button><button class="btn sm secondary" onclick="_pkTagClear()">🗑 Xóa dữ liệu tag (trình duyệt này)</button>' : '')+'</div>';
  if (_pkState.tagSavedAt) html += '<div style="font-size:11px;color:var(--muted);margin:-4px 0 10px">Lần lưu lên CRM gần nhất: '+esc(_pkState.tagSavedAt)+'.</div>';
  if (!has) return html;

  var allDates = _pkTagDates(all);
  var st = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">'+
    '<span style="font-size:12px">Khoảng ngày:</span>'+
    _quickRangeSelectHtml(_pkState.tagQuick, "_pkTagApplyQuick(this.value)")+
    '<input type="date" value="'+esc(_pkState.tagFrom)+'" min="'+esc(allDates[0])+'" max="'+esc(allDates[allDates.length-1])+'" onchange="_pkTagSetRange(\'from\',this.value)" style="'+st+'">'+
    '<span>→</span>'+
    '<input type="date" value="'+esc(_pkState.tagTo)+'" min="'+esc(allDates[0])+'" max="'+esc(allDates[allDates.length-1])+'" onchange="_pkTagSetRange(\'to\',this.value)" style="'+st+'">'+
    '<button class="btn sm secondary" onclick="_pkTagResetRange();_pkRenderAll()">Tất cả ngày</button>'+
  '</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Đang có dữ liệu <b>'+allDates.length+'</b> ngày ('+esc(allDates[0])+(allDates.length>1?' → '+esc(allDates[allDates.length-1]):'')+').</div>';

  var rows = _pkTagFiltered();
  if (!rows.length){ return html + '<div style="color:var(--muted);padding:10px">Không có dữ liệu trong khoảng ngày này.</div>'; }
  var ag = _pkTagAggregate(rows), pages = ag.pages;
  var th = function(t){ return '<th style="text-align:right">'+esc(t)+'</th>'; };
  var headPages = pages.map(function(p){ return th(p.name); }).join('');
  var cells = function(b){ return pages.map(function(p){ return '<td style="text-align:right">'+(b[p.id]?_pkN(b[p.id]):'')+'</td>'; }).join('')+'<td style="text-align:right"><b>'+(b.total?_pkN(b.total):'')+'</b></td>'; };

  // Tag trạng thái
  html += '<div class="dash-section-title">Theo tag trạng thái (L1 → L6)</div>';
  html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Tag</th>'+headPages+th('Tổng')+'</tr></thead><tbody>';
  Object.keys(_PK_STATUS_LABEL).forEach(function(k){ html += '<tr><td>'+esc(_PK_STATUS_LABEL[k])+'</td>'+cells(ag.status[k])+'</tr>'; });
  html += '</tbody></table></div>';

  // Theo ngày (chỉ khi khoảng chọn có từ 2 ngày trở lên)
  var rangeDates = _pkTagDates(rows);
  if (rangeDates.length > 1){
    var codes = Object.keys(_PK_STATUS_LABEL), byDay = {};
    rangeDates.forEach(function(d){ byDay[d] = {}; codes.forEach(function(c){ byDay[d][c] = 0; }); });
    rows.forEach(function(x){ if (x.type === 'status' && byDay[x.date]) byDay[x.date][x.code] += x.count; });
    html += '<div class="dash-section-title" style="margin-top:16px">Tag trạng thái theo ngày (cộng các Page)</div>';
    html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Ngày</th>'+codes.map(function(c){ return th(c); }).join('')+'</tr></thead><tbody>';
    rangeDates.forEach(function(d){ html += '<tr><td>'+esc(d)+'</td>'+codes.map(function(c){ return '<td style="text-align:right">'+(byDay[d][c]?_pkN(byDay[d][c]):'')+'</td>'; }).join('')+'</tr>'; });
    html += '</tbody></table></div>';
  }

  // Tag Sale
  html += '<div class="dash-section-title" style="margin-top:16px">Theo tag Sale (S = văn phòng, O = online)</div>';
  html += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>Mã</th><th>Sale (User Base)</th><th>Tên Facebook</th>'+headPages+th('Tổng')+'</tr></thead><tbody>';
  var known = {};
  _PK_SALE_DIR.forEach(function(s){ known[s.code] = 1; html += '<tr><td>'+esc(s.code)+'</td><td>'+esc(s.base||'—')+'</td><td>'+esc(s.fb)+'</td>'+cells(ag.sale[s.code])+'</tr>'; });
  Object.keys(ag.sale).filter(function(c){ return !known[c]; }).forEach(function(c){
    var nm = Object.keys(ag.sale[c].names||{}).join(', ');
    html += '<tr style="background:#fff7ed"><td>'+esc(c)+'</td><td colspan="2">⚠️ Chưa có trong danh sách Sale ('+esc(nm)+')</td>'+cells(ag.sale[c])+'</tr>';
  });
  html += '</tbody></table></div>';

  var oth = Object.keys(ag.other).filter(function(k){ return ag.other[k].total; });
  if (oth.length){
    html += '<div style="margin:12px 0 6px;padding:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:12px;color:#9a3412">'+
      '<div style="margin-bottom:6px">⚠️ '+oth.length+' tag chưa theo quy tắc (S/O + số, hoặc L1–L6) — chọn quy chuẩn bên dưới để tính vào đúng bảng (áp dụng luôn cho cả dữ liệu cũ đã nạp, dùng chung cho cả team):</div>';
    var sug = _pkSuggestTagMap(oth);
    _pkState.tagSuggest = sug.list;
    var nHigh = sug.list.filter(function(x){ return x.level==='high'; }).length;
    if (sug.list.length){
      html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px;padding:6px 8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:12px;color:#166534">'+
        '\u2728 T\u00ecm \u0111\u01b0\u1ee3c <b>'+sug.list.length+'</b> g\u1ee3i \u00fd theo t\u00ean (\u0111\u1ed1i chi\u1ebfu Ten Facebook / User Base trong danh s\u00e1ch Sale).'+
        (nHigh ? ' <button class="btn sm primary" onclick="_pkUseAllTagSuggest(\'high\')">\u00c1p d\u1ee5ng '+nHigh+' g\u1ee3i \u00fd kh\u1edbp cao</button>' : '')+
        (sug.list.length>nHigh ? ' <button class="btn sm secondary" onclick="_pkUseAllTagSuggest(\'all\')">\u00c1p d\u1ee5ng t\u1ea5t c\u1ea3 '+sug.list.length+'</button>' : '')+
        '<span style="color:#15803d">B\u1ea5m l\u00e0 c\u00f3 h\u1ed9p x\u00e1c nh\u1eadn danh s\u00e1ch tr\u01b0\u1edbc khi l\u01b0u.</span></div>';
    }
    var stOpts = '<option value="">— Bỏ qua —</option>' +
      '<optgroup label="Trạng thái">' + Object.keys(_PK_STATUS_LABEL).map(function(c){
        return '<option value="'+esc(c)+'">'+esc(_PK_STATUS_LABEL[c])+'</option>';
      }).join('') + '</optgroup>' +
      '<optgroup label="Gán về Sale">' + _PK_SALE_DIR.map(function(sd){
        return '<option value="'+esc(sd.code)+'">'+esc(sd.code)+' – '+esc(sd.fb)+(sd.base?' ('+esc(sd.base)+')':'')+'</option>';
      }).join('') + '</optgroup>';
    oth.forEach(function(k){
      html += '<div style="display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap">'+
        '<span style="min-width:160px">'+esc(k)+' ('+_pkN(ag.other[k].total)+')</span>'+
        '<select data-tag="'+esc(k)+'" onchange="_pkSaveTagOverride(this)" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+stOpts+'</select>'+
        (sug.byTag[k]!==undefined ? (function(x,i){ return '<span style="font-size:11px;color:'+(x.level==='high'?'#166534':'#92400e')+'">gợi ý: <b>'+esc(x.label)+'</b> ('+(x.level==='high'?'khớp cao':'khớp vừa — xem lại')+') <button class="btn sm" onclick="_pkUseTagSuggest('+i+')">Dùng</button></span>'; })(sug.list[sug.byTag[k]], sug.byTag[k]) : '')+
      '</div>';
    });
    html += '</div>';
  }
  return html;
}

function _pkExportTagReport(){
  var rows = _pkTagFiltered(); if (!rows.length) return;
  var ag = _pkTagAggregate(rows), pages = ag.pages;
  var head = pages.map(function(p){ return p.name; });
  var line = function(b){ return pages.map(function(p){ return b[p.id]||0; }).concat([b.total||0]); };
  var st = [['Tag'].concat(head, ['Tổng'])];
  Object.keys(_PK_STATUS_LABEL).forEach(function(k){ st.push([_PK_STATUS_LABEL[k]].concat(line(ag.status[k]))); });
  var sa = [['Mã','Sale (User Base)','Tên Facebook'].concat(head, ['Tổng'])];
  var known = {};
  _PK_SALE_DIR.forEach(function(s){ known[s.code] = 1; sa.push([s.code, s.base, s.fb].concat(line(ag.sale[s.code]))); });
  Object.keys(ag.sale).filter(function(c){ return !known[c]; }).forEach(function(c){ sa.push([c, '(chưa có trong danh sách)', Object.keys(ag.sale[c].names||{}).join(', ')].concat(line(ag.sale[c]))); });
  var codes = Object.keys(_PK_STATUS_LABEL), days = _pkTagDates(rows), byDay = {};
  days.forEach(function(d){ byDay[d] = {}; codes.forEach(function(c){ byDay[d][c] = 0; }); });
  rows.forEach(function(x){ if (x.type === 'status') byDay[x.date][x.code] += x.count; });
  var dy = [['Ngày'].concat(codes)];
  days.forEach(function(d){ dy.push([d].concat(codes.map(function(c){ return byDay[d][c]; }))); });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(st), 'Theo tag trang thai');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dy), 'Trang thai theo ngay');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sa), 'Theo Sale');
  XLSX.writeFile(wb, 'BaoCaoTagPancake_'+days[0]+(days.length>1?'_'+days[days.length-1]:'')+'.xlsx');
}

// ── Đọc file Excel (SheetJS đã có sẵn trong trang) ──
function _pkParseFile(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(ev){
      try {
        var wb = XLSX.read(ev.target.result, {type:'array'});
        var rows = [], warnings = [];
        wb.SheetNames.forEach(function(sn){
          if (!/By user$/i.test(sn)) return; // bỏ qua sheet "By time" (theo giờ, không theo nhân viên)
          var pageIdMatch = sn.match(/^(\d+)/);
          if (!pageIdMatch) { warnings.push('Không nhận diện được Page ID ở sheet "'+sn+'" — bỏ qua.'); return; }
          var pageId = pageIdMatch[1];
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:''});

          // Tìm dòng "Thời gian tải về: DD/MM/YYYY ..." để lấy ngày báo cáo
          var date = '';
          for (var i=0;i<Math.min(aoa.length,10);i++){
            var cell = String(aoa[i][0]||'');
            var m = cell.match(/Thời gian tải về:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (m){ date = m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); break; }
          }
          if (!date){ warnings.push('Không tìm thấy ngày báo cáo ở sheet "'+sn+'" — bỏ qua.'); return; }

          // Tìm dòng tên Page (dòng "<Tên Page> - <pageId>")
          var pageName = sn;
          for (var j=0;j<Math.min(aoa.length,10);j++){
            var c0 = String(aoa[j][0]||'');
            if (new RegExp('\\s-\\s*'+pageId+'\\s*$').test(c0)){ // dòng "<Tên Page> - <pageId>" (không lấy nhầm dòng "Trang: ..." liệt kê cả 4 page)
              pageName = c0.replace(new RegExp('\\s*-\\s*'+pageId+'\\s*$'), '').trim();
              break;
            }
          }

          // Tìm dòng sub-header (ô thứ 2 = 'KH cũ') để biết dòng dữ liệu bắt đầu từ đâu
          var headerRow = -1;
          for (var k=0;k<aoa.length;k++){
            if (String(aoa[k][1]||'').normalize('NFC').trim() === 'KH cũ'){ headerRow = k; break; } // không đòi ô đầu rỗng: ô "Nhân viên" được gộp 2 dòng nên có file lặp chữ ở dòng này
          }
          if (headerRow === -1){ warnings.push('Không nhận diện được dòng tiêu đề cột ở sheet "'+sn+'" — bỏ qua.'); return; }

          for (var r=headerRow+1; r<aoa.length; r++){
            var row = aoa[r];
            var nhanVien = String(row[0]||'').trim();
            if (!nhanVien || nhanVien === 'Tổng TT') continue; // bỏ dòng tổng cuối bảng
            var num = function(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; };
            rows.push({
              date: date, pageId: pageId, pageName: pageName, nhanVien: nhanVien,
              khCu: num(row[1]), khMoi: num(row[2]), tongTT: num(row[3]),
              tinNhan: num(row[4]), binhLuan: num(row[5]), hoiThoaiMoi: num(row[6]),
              dhKhMoi: num(row[7]), dhKhCu: num(row[8]), tongDH: num(row[9])
            });
          }
        });
        resolve({ rows: rows, warnings: warnings });
      } catch(err){ reject(err); }
    };
    reader.onerror = function(){ reject(new Error('Không đọc được file.')); };
    reader.readAsArrayBuffer(file);
  });
}

async function _pkOnFileSelected(input){
  var file = input.files && input.files[0];
  if (!file) return;
  try {
    var res = await _pkParseFile(file);
    if (!res.rows.length){
      toast('⚠️ Không đọc được dòng nào phù hợp trong file này — kiểm tra lại đúng file "Thống kê tương tác" chưa.');
      return;
    }
    _pkState.parsedRows = res.rows;
    var unmapped = {};
    res.rows.forEach(function(r){ if (!_pkState.nameMap[r.nhanVien]) unmapped[r.nhanVien] = true; });
    _pkState.parsedUnmapped = Object.keys(unmapped).sort();
    if (res.warnings.length) toast('⚠️ ' + res.warnings.join(' | '));
    _pkRenderAll();
  } catch(e){
    toast('❌ Lỗi đọc file: ' + e.message);
  }
}

function _pkRenderPreviewHtml(){
  var byDatePage = {};
  _pkState.parsedRows.forEach(function(r){
    var k = r.date+'|'+r.pageName;
    if (!byDatePage[k]) byDatePage[k] = { date:r.date, pageName:r.pageName, count:0, tongTT:0, tongDH:0 };
    byDatePage[k].count++; byDatePage[k].tongTT+=r.tongTT; byDatePage[k].tongDH+=r.tongDH;
  });
  var html = '<div style="border:1px solid var(--border);border-radius:var(--rsm);padding:10px;margin-bottom:10px;background:var(--surface2)">';
  html += '<table class="dash-table"><thead><tr><th>Ngày</th><th>Page</th><th style="text-align:right">Số nhân viên</th><th style="text-align:right">Tổng tương tác</th><th style="text-align:right">Tổng ĐH</th></tr></thead><tbody>';
  Object.values(byDatePage).forEach(function(g){
    html += '<tr><td>'+esc(g.date)+'</td><td>'+esc(g.pageName)+'</td><td style="text-align:right">'+g.count+'</td><td style="text-align:right">'+fmt(g.tongTT)+'</td><td style="text-align:right">'+fmt(g.tongDH)+'</td></tr>';
  });
  html += '</tbody></table>';

  if (_pkState.parsedUnmapped.length){
    html += '<div style="margin-top:10px;padding:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px">';
    html += '<b style="font-size:12px;color:#9a3412">⚠️ '+_pkState.parsedUnmapped.length+' tên Nhân viên Pancake chưa khớp Sale CRM</b> — khớp ở bảng bên dưới trước khi lưu (không bắt buộc, có thể lưu trước rồi khớp sau).';
    html += '</div>';
  }

  html += '<div style="margin-top:10px;display:flex;gap:8px">'+
    '<button class="btn primary" onclick="_pkUploadToCRM()" '+(_pkState.uploading?'disabled':'')+'>'+(_pkState.uploading?'Đang lưu...':'💾 Lưu lên CRM ('+_pkState.parsedRows.length+' dòng)')+'</button>'+
    '<button class="btn sm secondary" onclick="_pkState.parsedRows=[];_pkState.parsedUnmapped=[];_pkRenderAll()">Huỷ</button>'+
  '</div>';
  html += '</div>';
  return html;
}

async function _pkUploadToCRM(){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  if (!_pkState.parsedRows.length) return;
  _pkState.uploading = true; _pkRenderAll();
  try {
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'savePancakeStats', rows:_pkState.parsedRows }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    toast('✓ Đã lưu '+d.written+' dòng lên CRM.');
    logAudit('pancake_import','', '', 'Nhập báo cáo Pancake: '+d.written+' dòng');
    // Ghi nhan lai toan bo ten Nhan vien trong file nay vao serverNames TRUOC khi xoa parsedRows,
    // de bang "Khop ten" van hien du de khop tiep (khong con phu thuoc parsedUnmapped tam thoi nua).
    var seen = {};
    _pkState.parsedRows.forEach(function(r){ seen[r.nhanVien] = true; });
    Object.keys(seen).forEach(function(n){ if (_pkState.serverNames.indexOf(n)===-1) _pkState.serverNames.push(n); });
    _pkState.parsedRows = []; _pkState.parsedUnmapped = [];
    var fi = document.getElementById('pk-file-input'); if (fi) fi.value = '';
    _pkState.report = null; // buoc xem lai bao cao de lay du lieu moi
    _pkState.kpiReport = null; // du lieu tuong tac vua doi -> bao cao KPI tong hop cu co the sai, yeu cau tinh lai
    _pkKpiRefreshIfOpen();
  } catch(e){
    toast('❌ Lưu lỗi: ' + e.message);
  } finally {
    _pkState.uploading = false; _pkRenderAll();
  }
}

// ═══════════════════════════════════════════════════════
//  SDT MANG VE / DON CHOT (file "Thong ke nhan vien" — sheet "<pageId> By staff")
//  Cung khuon mau voi file "Thong ke tuong tac" o tren, khac o: sheet ten "By staff"
//  (khong phai "By user"), va header la 1 DONG DUY NHAT (khong gop 2 dong nhu file kia).
// ═══════════════════════════════════════════════════════
function _pkParseSdtFile(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(ev){
      try {
        var wb = XLSX.read(ev.target.result, {type:'array'});
        var rows = [], warnings = [];
        wb.SheetNames.forEach(function(sn){
          if (!/By staff$/i.test(sn)) return; // bỏ qua sheet "By time" (theo ngày, không theo nhân viên)
          var pageIdMatch = sn.match(/^(\d+)/);
          if (!pageIdMatch) { warnings.push('Không nhận diện được Page ID ở sheet "'+sn+'" — bỏ qua.'); return; }
          var pageId = pageIdMatch[1];
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header:1, defval:''});

          // Tìm dòng "Thời gian tải về: DD/MM/YYYY ..." để lấy ngày báo cáo
          var date = '';
          for (var i=0;i<Math.min(aoa.length,10);i++){
            var cell = String(aoa[i][0]||'');
            var m = cell.match(/Thời gian tải về:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (m){ date = m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); break; }
          }
          if (!date){ warnings.push('Không tìm thấy ngày báo cáo ở sheet "'+sn+'" — bỏ qua.'); return; }

          // Tìm dòng tên Page (dòng "<Tên Page> - <pageId>")
          var pageName = sn;
          for (var j=0;j<Math.min(aoa.length,10);j++){
            var c0 = String(aoa[j][0]||'');
            if (new RegExp('\\s-\\s*'+pageId+'\\s*$').test(c0)){
              pageName = c0.replace(new RegExp('\\s*-\\s*'+pageId+'\\s*$'), '').trim();
              break;
            }
          }

          // Header la 1 dong duy nhat: o dau = "Nhân viên"
          var headerRow = -1;
          for (var k=0;k<aoa.length;k++){
            if (String(aoa[k][0]||'').normalize('NFC').trim() === 'Nhân viên'){ headerRow = k; break; }
          }
          if (headerRow === -1){ warnings.push('Không nhận diện được dòng tiêu đề cột ở sheet "'+sn+'" — bỏ qua.'); return; }

          for (var r=headerRow+1; r<aoa.length; r++){
            var row = aoa[r];
            var nhanVien = String(row[0]||'').trim();
            if (!nhanVien || /^tổng/i.test(nhanVien)) continue; // bỏ dòng trống / dòng tổng cuối bảng (nếu có)
            var num = function(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; };
            rows.push({
              date: date, pageId: pageId, pageName: pageName, nhanVien: nhanVien,
              tinNhanTuBinhLuan: num(row[1]), binhLuan: num(row[2]), phienTLBinhLuan: num(row[3]),
              tinNhan: num(row[4]), phienTLTinNhan: num(row[5]),
              sdtMangVe: num(row[7]), soDonChot: num(row[8])
            });
          }
        });
        resolve({ rows: rows, warnings: warnings });
      } catch(err){ reject(err); }
    };
    reader.onerror = function(){ reject(new Error('Không đọc được file.')); };
    reader.readAsArrayBuffer(file);
  });
}

async function _pkOnSdtFileSelected(input){
  var file = input.files && input.files[0];
  if (!file) return;
  try {
    var res = await _pkParseSdtFile(file);
    if (!res.rows.length){
      toast('⚠️ Không đọc được dòng nào phù hợp trong file này — kiểm tra lại đúng file "Thống kê nhân viên" chưa.');
      return;
    }
    _pkState.sdtParsedRows = res.rows;
    var unmapped = {};
    res.rows.forEach(function(r){ if (!_pkState.nameMap[r.nhanVien]) unmapped[r.nhanVien] = true; });
    if (res.warnings.length) toast('⚠️ ' + res.warnings.join(' | '));
    _pkRenderAll();
  } catch(e){
    toast('❌ Lỗi đọc file: ' + e.message);
  }
}

function _pkRenderSdtPreviewHtml(){
  var byDatePage = {};
  _pkState.sdtParsedRows.forEach(function(r){
    var k = r.date+'|'+r.pageName;
    if (!byDatePage[k]) byDatePage[k] = { date:r.date, pageName:r.pageName, count:0, sdtMangVe:0, soDonChot:0 };
    byDatePage[k].count++; byDatePage[k].sdtMangVe+=r.sdtMangVe; byDatePage[k].soDonChot+=r.soDonChot;
  });
  var html = '<div style="border:1px solid var(--border);border-radius:var(--rsm);padding:10px;margin-bottom:10px;background:var(--surface2)">';
  html += '<table class="dash-table"><thead><tr><th>Ngày</th><th>Page</th><th style="text-align:right">Số nhân viên</th><th style="text-align:right">SĐT mang về</th><th style="text-align:right">Số đơn chốt</th></tr></thead><tbody>';
  Object.values(byDatePage).forEach(function(g){
    html += '<tr><td>'+esc(g.date)+'</td><td>'+esc(g.pageName)+'</td><td style="text-align:right">'+g.count+'</td><td style="text-align:right">'+fmt(g.sdtMangVe)+'</td><td style="text-align:right">'+fmt(g.soDonChot)+'</td></tr>';
  });
  html += '</tbody></table>';
  html += '<div style="margin-top:10px;display:flex;gap:8px">'+
    '<button class="btn primary" onclick="_pkUploadSdtToCRM()" '+(_pkState.sdtUploading?'disabled':'')+'>'+(_pkState.sdtUploading?'Đang lưu...':'💾 Lưu lên CRM ('+_pkState.sdtParsedRows.length+' dòng)')+'</button>'+
    '<button class="btn sm secondary" onclick="_pkState.sdtParsedRows=[];_pkRenderAll()">Huỷ</button>'+
  '</div>';
  html += '</div>';
  return html;
}

async function _pkUploadSdtToCRM(){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  if (!_pkState.sdtParsedRows.length) return;
  _pkState.sdtUploading = true; _pkRenderAll();
  try {
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'savePancakeSdtStats', rows:_pkState.sdtParsedRows }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    toast('✓ Đã lưu '+d.written+' dòng lên CRM.');
    logAudit('pancake_sdt_import','', '', 'Nhập báo cáo SĐT Pancake: '+d.written+' dòng');
    var seen = {};
    _pkState.sdtParsedRows.forEach(function(r){ seen[r.nhanVien] = true; });
    Object.keys(seen).forEach(function(n){ if (_pkState.serverNames.indexOf(n)===-1) _pkState.serverNames.push(n); });
    _pkState.sdtParsedRows = [];
    var fi = document.getElementById('pk-sdt-file-input'); if (fi) fi.value = '';
    _pkState.sdtReport = null;
    _pkState.kpiReport = null; // du lieu SDT vua doi -> bao cao KPI tong hop cu co the sai, yeu cau tinh lai
    _pkKpiRefreshIfOpen();
  } catch(e){
    toast('❌ Lưu lỗi: ' + e.message);
  } finally {
    _pkState.sdtUploading = false; _pkRenderAll();
  }
}

function _pkSalesOf(v){ return String(v||'').split('|').map(function(x){ return x.trim(); }).filter(Boolean); }

function _pkRenderMapTableHtml(isAdmin){
  var names = Object.keys(_pkState.nameMap);
  // Uu tien nguon ben vung tu server (moi ten Nhan vien tung xuat hien trong bao cao da luu) —
  // khong mat du CS da bam "Luu len CRM" hay F5 lai trang truoc khi khop het. parsedUnmapped
  // (tu file vua doc, chua luu) chi la lop bo sung de thay ten moi ngay lap tuc.
  (_pkState.serverNames||[]).forEach(function(n){ if (names.indexOf(n)===-1) names.push(n); });
  _pkState.parsedUnmapped.forEach(function(n){ if (names.indexOf(n)===-1) names.push(n); });
  names.sort(function(a,b){ return a.localeCompare(b,'vi'); });
  var allCS = _allCSNames().filter(function(s){ return String(s).indexOf('|') === -1; });
  var html = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Mỗi tên Pancake có thể gắn với <b>nhiều Sale</b> (tick nhiều ô), và nhiều tên Pancake cùng gắn về 1 Sale cũng được.</div>';
  html += '<table class="dash-table"><thead><tr><th>Tên trên Pancake</th><th>Sale CRM (chọn được nhiều)</th></tr></thead><tbody>';
  if (!names.length){
    html += '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:14px">Chưa có tên nào — nạp 1 file báo cáo để bắt đầu khớp.</td></tr>';
  }
  names.forEach(function(n){
    var cur = _pkSalesOf(_pkState.nameMap[n]);
    var cell;
    if (isAdmin){
      var items = allCS.slice();
      cur.forEach(function(c){ if (items.indexOf(c)===-1) items.push(c); }); // giữ cả Sale đã khớp nhưng không còn trong danh sách
      items.sort(function(a,b){ return a.localeCompare(b,'vi'); });
      var boxes = items.map(function(s){
        return '<label class="pk-pick-item" style="display:flex;gap:6px;align-items:center;padding:3px 4px;cursor:pointer;white-space:nowrap"><input type="checkbox" value="'+esc(s)+'"'+(cur.indexOf(s)!==-1?' checked':'')+'> '+esc(s)+'</label>';
      }).join('');
      cell = '<details data-n="'+esc(n)+'"'+(_pkState.mapOpen===n?' open':'')+' ontoggle="_pkMapDetailsToggle(this)" style="position:relative">'+
        '<summary style="cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);display:inline-block;min-width:180px">'+
          (cur.length ? esc(cur.join(', '))+(cur.length>1?' <span style="color:var(--muted);font-size:11px">('+cur.length+' Sale)</span>':'') : '— Chưa khớp —')+'</summary>'+
        '<div style="max-height:260px;overflow:auto;margin-top:4px;padding:4px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
          '<input type="search" placeholder="🔍 Tìm tên Sale..." oninput="_pkPickFilter(this)" style="position:sticky;top:0;width:100%;box-sizing:border-box;padding:5px 8px;margin-bottom:4px;border:1px solid var(--border);border-radius:6px;background:var(--surface);z-index:1">'+
          '<div class="pk-pick-list">'+(boxes || '<div style="color:var(--muted);padding:6px">Chưa có danh sách Sale.</div>')+'</div>'+
          '<div class="pk-pick-empty" style="display:none;color:var(--muted);padding:6px">Không có tên nào khớp.</div>'+
          '<div style="display:flex;justify-content:flex-end;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">'+
            '<button type="button" class="btn sm primary" onclick="_pkMapSaveClose(this)">💾 Lưu &amp; đóng</button>'+
          '</div>'+
        '</div></details>';
    } else {
      cell = esc(cur.join(', ')||'—');
    }
    html += '<tr><td>'+esc(n)+(cur.length?'':' <span style="color:#9a3412;font-size:11px">⚠️ chưa khớp</span>')+'</td><td>'+cell+'</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

// Ô tìm dùng chung cho mọi danh sách chọn tên (Sale tick nhiều / Kênh bán chọn 1): chỉ ẨN/HIỆN
// các .pk-pick-item theo chữ gõ (không vẽ lại → không mất dấu tick đang chọn dở, không mất focus).
// Bỏ dấu tiếng Việt để gõ "thuy" vẫn ra "Thuý/Thủy".
function _pkNorm(t){ return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase(); }
function _pkPickFilter(inp){
  var q = _pkNorm(inp.value).trim();
  var box = inp.parentNode, shown = 0;
  Array.prototype.forEach.call(box.querySelectorAll('.pk-pick-item'), function(el){
    var ok = !q || _pkNorm(el.textContent).indexOf(q) !== -1;
    el.style.display = ok ? '' : 'none';
    if (ok) shown++;
  });
  var em = box.querySelector('.pk-pick-empty'); if (em) em.style.display = shown ? 'none' : '';
}

function _pkMapDetailsToggle(det){
  var n = det.getAttribute('data-n');
  if (det.open) _pkState.mapOpen = n;
  else if (_pkState.mapOpen === n) _pkState.mapOpen = '';
}

function _pkMapSaveClose(btn){
  var det = btn.closest('details'); if (!det) return;
  var n = det.getAttribute('data-n');
  var vals = Array.prototype.map.call(det.querySelectorAll('input[type=checkbox]:checked'), function(x){ return x.value; });
  _pkState.mapOpen = ''; // luu xong thi dong lai, khong giu mo nua
  _pkMapNameInline(n, vals.join('|'));
}

async function _pkMapNameInline(pancakeName, saleName){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  try {
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'savePancakeNameMap', pancakeName:pancakeName, saleName:saleName }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    _pkState.nameMap[pancakeName] = saleName;
    _pkState.parsedUnmapped = _pkState.parsedUnmapped.filter(function(n){ return n!==pancakeName; });
    var shown = _pkSalesOf(saleName).join(', ');
    logAudit('pancake_map','', '', 'Khớp tên Pancake "'+pancakeName+'" → Sale "'+shown+'"');
    toast('✓ Đã khớp "'+pancakeName+'" → "'+(shown||'(bỏ khớp)')+'"');
    _pkState.report = null; // ket qua bao cao cu co the da tinh sai ten -> yeu cau xem lai
    _pkRenderAll();
  } catch(e){
    toast('❌ Lỗi khớp tên: ' + e.message);
  }
}

// ── Khớp Page Pancake (pageId) ↔ Kênh bán chuẩn trong DT TỔNG (1-1, khác Sale là nhiều-nhiều) ──
function _pkRenderPageMapTableHtml(isAdmin){
  var pages = (_pkState.serverPages||[]).slice();
  pages.sort(function(a,b){ return String(a.pageName||a.pageId).localeCompare(String(b.pageName||b.pageId),'vi'); });
  var kenhOpts = _pkState.kenhOptions || [];
  var html = '<table class="dash-table"><thead><tr><th>Page Pancake</th><th>Kênh bán CRM</th></tr></thead><tbody>';
  if (!pages.length){
    html += '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:14px">Chưa có Page nào — nạp 1 file báo cáo tương tác hoặc SĐT để bắt đầu khớp.</td></tr>';
  }
  pages.forEach(function(p){
    var cur = _pkState.pageMap[p.pageId] || '';
    var label = p.pageName ? p.pageName + ' (' + p.pageId + ')' : p.pageId;
    var cell;
    if (isAdmin){
      var list = kenhOpts.slice();
      if (cur && list.indexOf(cur) === -1) list.push(cur); // giu ca gia tri da khop nhung khong con trong danh sach kenh hien tai
      list.sort(function(a,b){ return a.localeCompare(b,'vi'); });
      var rname = 'pkpg_'+String(p.pageId).replace(/[^A-Za-z0-9_]/g,'_');
      var radio = function(v, label){
        return '<label class="pk-pick-item" style="display:flex;gap:6px;align-items:center;padding:3px 4px;cursor:pointer;white-space:nowrap"><input type="radio" name="'+rname+'" value="'+esc(v)+'"'+(v===cur?' checked':'')+' onchange="_pkPagePick(this)"> '+label+'</label>';
      };
      cell = '<details data-pid="'+esc(p.pageId)+'" data-pname="'+esc(p.pageName||'')+'" style="position:relative">'+
        '<summary style="cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);display:inline-block;min-width:200px">'+(cur ? esc(cur) : '— Chưa khớp —')+'</summary>'+
        '<div style="max-height:260px;overflow:auto;margin-top:4px;padding:4px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">'+
          '<input type="search" placeholder="🔍 Tìm Kênh bán..." oninput="_pkPickFilter(this)" style="position:sticky;top:0;width:100%;box-sizing:border-box;padding:5px 8px;margin-bottom:4px;border:1px solid var(--border);border-radius:6px;background:var(--surface);z-index:1">'+
          radio('', '<i style="color:var(--muted)">— Bỏ khớp —</i>')+list.map(function(k){ return radio(k, esc(k)); }).join('')+
          '<div class="pk-pick-empty" style="display:none;color:var(--muted);padding:6px">Không có kênh nào khớp.</div>'+
        '</div></details>';
    } else {
      cell = esc(cur||'—');
    }
    html += '<tr><td>'+esc(label)+(cur?'':' <span style="color:#9a3412;font-size:11px">⚠️ chưa khớp</span>')+'</td><td>'+cell+'</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

async function _pkPagePick(radio){
  var det = radio.closest('details'); if (!det) return;
  var sel = { value: radio.value, getAttribute: function(k){ return det.getAttribute(k); } };
  var ok = await _pkSavePageMapInline(sel);
  if (ok){
    var sm = det.querySelector('summary'); if (sm) sm.textContent = radio.value || '— Chưa khớp —';
    det.open = false;
  }
}

async function _pkSavePageMapInline(sel){
  var pageId = sel.getAttribute('data-pid');
  var pageName = sel.getAttribute('data-pname');
  var kenhBan = sel.value;
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return false; }
  try {
    var res = await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'savePancakePageMap', pageId:pageId, pageName:pageName, kenhBan:kenhBan }) });
    var d = await res.json();
    if (d.error) throw new Error(d.error);
    _pkState.pageMap[pageId] = kenhBan;
    logAudit('pancake_page_map','', '', 'Khớp Page "'+pageName+'" ('+pageId+') → Kênh bán "'+(kenhBan||'(bỏ khớp)')+'"');
    toast('✓ Đã khớp Page "'+(pageName||pageId)+'" → "'+(kenhBan||'(bỏ khớp)')+'"');
    _pkState.kpiReport = null; // ket qua Bao cao KPI tong hop cu co the sai -> yeu cau tinh lai
    return true;
  } catch(e){
    toast('❌ Lỗi khớp Page: ' + e.message);
    return false;
  }
}

function _pkApplyQuickRange(key){
  _pkState.fromQuick = key;
  if (key !== 'custom'){
    var r = _pkQuickRange(key);
    if (r){ _pkState.from = r.from; _pkState.to = r.to; }
  }
  _pkRenderAll();
  if (_pkState.report) _pkLoadReport();
}
async function _pkLoadReport(){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  _pkState.reportLoading = true; _pkRenderAll();
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var r = await fetch(gsUrl + sep + 'action=pancakeReport&from='+encodeURIComponent(_pkState.from)+'&to='+encodeURIComponent(_pkState.to)+'&split='+encodeURIComponent(_pkState.pkSplit||'equal'), { redirect:'follow' });
    var d = await r.json();
    _pkState.report = d;
  } catch(e){
    toast('❌ Tải báo cáo lỗi: ' + e.message);
  } finally {
    _pkState.reportLoading = false; _pkRenderAll();
  }
}

// Khoa pham vi Sale cho tab KPI Pancake giong het co che _srEnforceScope() ben Bao cao doanh
// so (dung lai _srIsAdmin/_srMyNames/_srLeaderTeamNames co san): CS thuong chi xem duoc doanh
// thu cua chinh minh, Leader xem duoc ca team minh phu trach, Admin xem het khong gioi han.
function _pkEnforceScope(){
  if (typeof _srIsAdmin !== 'function' || _srIsAdmin()) { _pkState.kpiSaleScope = null; return; }
  var my = (typeof _srMyNames === 'function') ? _srMyNames() : [];
  if (currentUser && currentUser.role === 'leader' && typeof _srLeaderTeamNames === 'function') {
    var teamNames = _srLeaderTeamNames();
    _pkState.kpiSaleScope = teamNames.length ? teamNames : my;
  } else {
    _pkState.kpiSaleScope = my;
  }
}

async function _expLogRun(){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  if (!_expLogState.from || !_expLogState.to){ toast('⚠️ Chọn đủ khoảng ngày trước đã.'); return; }
  if (_expLogState.from > _expLogState.to){ toast('⚠️ Ngày bắt đầu đang sau ngày kết thúc.'); return; }
  _expLogState.loading = true; _pkRenderKpiPancake();
  try {
    var r = await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'exportDailyReportLogs', from: _expLogState.from, to: _expLogState.to }) });
    var d = await r.json();
    if (!d.ok){ toast('❌ Xuất lỗi: ' + (d.error||'')); _expLogState.result = null; }
    else { toast('✓ Đã xuất nhật ký ' + d.days + ' ngày'); _expLogState.result = d; }
  } catch(e){ toast('❌ Lỗi: ' + e.message); }
  finally { _expLogState.loading = false; _pkRenderKpiPancake(); }
}

function _expLogRenderResult(){
  var d = _expLogState.result; if (!d) return '';
  var lbl = { sale:'Sale bán', kenh:'Kênh bán', mkt:'MKT', tag:'Tag' };
  return '<div style="margin-top:10px;font-size:11.5px;color:var(--text)">'+
    '<div>✓ Đã xuất <b>'+d.days+'</b> ngày ('+esc(d.from)+' → '+esc(d.to)+') — <a href="'+esc(d.sheetUrl)+'" target="_blank" style="color:var(--primary,#2563eb)">mở Google Sheet</a></div>'+
    '<div style="margin-top:4px;color:var(--muted)">'+
      Object.keys(lbl).map(function(k){
        var s = d.result && d.result[k];
        return (s ? (lbl[k]+': '+s.total+' dòng (thêm '+s.added+', xóa '+s.removed+')') : '');
      }).filter(Boolean).join(' · ')+
    '</div></div>';
}

async function renderKpiPancakeTab(){
  var wrap = document.getElementById('kpipancake-wrap');
  if (!wrap) return;
  _pkEnforceScope();
  if (!_pkState.nameMapLoaded) await _pkLoadNameMap();
  if (!_pkState.pageMapLoaded) await _pkLoadPageMap();
  _pkRenderKpiPancake();
  if (!_pkState.kpiReport && !_pkState.kpiReportLoading) _pkLoadKpiReport();
}

async function _pkLoadKpiReport(){
  if (!gsUrl){ toast('❌ Chưa cấu hình URL Google Apps Script.'); return; }
  if (!_pkState.kpiFrom || !_pkState.kpiTo){ toast('⚠️ Hãy chọn đủ ngày bắt đầu và ngày kết thúc.'); return; }
  if (_pkState.kpiFrom > _pkState.kpiTo){ toast('⚠️ Ngày bắt đầu đang sau ngày kết thúc — hãy đổi lại.'); return; }
  _pkState.kpiReportLoading = true; _pkRenderKpiPancake();
  try {
    var sep = gsUrl.includes('?') ? '&' : '?';
    var saleQ = (_pkState.kpiSaleScope && _pkState.kpiSaleScope.length) ? '&sale='+encodeURIComponent(_pkState.kpiSaleScope.join(',')) : '';
    var r = await fetch(gsUrl + sep + 'action=kpiReport&from='+encodeURIComponent(_pkState.kpiFrom)+'&to='+encodeURIComponent(_pkState.kpiTo)+saleQ, { redirect:'follow' });
    var d = await r.json();
    if (d.error) throw new Error(d.error);
    _pkState.kpiReport = d;
  } catch(e){
    toast('❌ Tải Báo cáo KPI Pancake lỗi: ' + e.message);
  } finally {
    _pkState.kpiReportLoading = false; _pkRenderKpiPancake();
  }
}

// Neu nguoi dung dang dung o tab "KPI Pancake" khi du lieu vua duoc luu -> tai lai ngay,
// khong bat ho tu bam "Xem bao cao". Neu dang o tab khac thi thoi: kpiReport da = null nen
// lan sau mo tab do renderKpiPancakeTab() se tu tai.
function _pkKpiRefreshIfOpen(){
  try {
    var el = document.getElementById('tab-kpipancake');
    if (el && el.style.display !== 'none' && !_pkState.kpiReportLoading) _pkLoadKpiReport();
  } catch(e){}
}


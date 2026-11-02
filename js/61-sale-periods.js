// ════════════════════════════════════════════════════════════════════
//  LỊCH SỬ PHÂN LOẠI + CHƯƠNG TRÌNH THƯỞNG THEO NGÀY, CÀI RIÊNG TỪNG SALE (yêu cầu Duyên 2026-11-02)
//  VD sale A: 10/09→10/10 = Thử việc (áp CT thử việc), từ 11/10 = Chính thức (Online) áp CT chính thức.
//  SALE_PERIODS = { "<tên sale>": [ {from:'yyyy-MM-dd', to:'yyyy-MM-dd'|'' (trống = đến hiện tại), group:'<key đội>',
//                                    programs:[<id chương trình thưởng>] ('' / [] = theo đối tượng của từng CT)} ] }
//  Ngày nằm ngoài mọi giai đoạn -> dùng phân loại cũ SALE_CHANNELS (không đổi hành vi cũ).
//  Lưu: localStorage 'ome_sale_periods' + Google Sheets Settings key 'salePeriods' (cùng cách với saleChannels).
// ════════════════════════════════════════════════════════════════════
let SALE_PERIODS = (function(){
  try { var v = loadLS('ome_sale_periods'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; } catch(e){ return {}; }
})();

function _spToday_(){ var d = new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function _spListOf_(name){ var l = _cfgByAlias(SALE_PERIODS, name); return Array.isArray(l) ? l : []; }
// Giai đoạn chứa ngày ymd (nhiều giai đoạn chồng nhau -> lấy giai đoạn bắt đầu muộn nhất)
function _salePeriodAt_(name, ymd){
  if (!ymd) return null;
  var hit = null;
  _spListOf_(name).forEach(function(p){
    if (!p || !p.from || ymd < p.from) return;
    if (p.to && ymd > p.to) return;
    if (!hit || p.from > hit.from) hit = p;
  });
  return hit;
}
// Đội của sale tại ngày ymd. Có ymd: theo giai đoạn (không có giai đoạn -> '' để dùng phân loại cũ).
// Không ymd (hiển thị chung): giai đoạn đang chạy hôm nay -> else (chưa có phân loại cũ) giai đoạn mới nhất -> else ''.
function _salePeriodGroupOf_(name, ymd, staticGroup){
  if (ymd){ var p = _salePeriodAt_(name, ymd); return p ? (p.group || '') : ''; }
  var cur = _salePeriodAt_(name, _spToday_());
  if (cur && cur.group) return cur.group;
  if (staticGroup) return '';
  var l = _spListOf_(name).filter(function(x){ return x && x.from && x.group; }).sort(function(a,b){ return a.from < b.from ? 1 : -1; });
  return l.length ? l[0].group : '';
}
// Danh sách id CT thưởng được GÁN RIÊNG cho sale tại ngày đó; null = không gán (dùng quy tắc đối tượng như cũ)
function _salePeriodProgramList_(name, ymd){
  var p = _salePeriodAt_(name, ymd);
  return (p && Array.isArray(p.programs) && p.programs.length) ? p.programs : null;
}
// Ngày bắt đầu thử việc dự phòng: giai đoạn "probation" sớm nhất (khi tài khoản chưa đặt Ngày bắt đầu)
function _salePeriodTvStart_(name){
  var l = _spListOf_(name).filter(function(x){ return x && x.from && x.group === 'probation'; }).sort(function(a,b){ return a.from < b.from ? -1 : 1; });
  return l.length ? l[0].from : '';
}
// Kiểm tra danh sách giai đoạn trước khi lưu — trả về chuỗi lỗi hoặc ''
function _spValidate_(list){
  var s = (list || []).slice().sort(function(a,b){ return String(a.from) < String(b.from) ? -1 : 1; });
  for (var i = 0; i < s.length; i++){
    if (!s[i].from) return 'Giai đoạn '+(i+1)+' chưa chọn "Từ ngày".';
    if (!s[i].group) return 'Giai đoạn từ '+s[i].from+' chưa chọn đội.';
    if (s[i].to && s[i].to < s[i].from) return 'Giai đoạn từ '+s[i].from+': "Đến ngày" nhỏ hơn "Từ ngày".';
    if (i > 0){
      var prevEnd = s[i-1].to || '9999-12-31';
      if (s[i].from <= prevEnd) return 'Giai đoạn từ '+s[i-1].from+' và từ '+s[i].from+' đang chồng ngày nhau.';
    }
  }
  return '';
}

async function saveSalePeriods(){
  saveLS('ome_sale_periods', SALE_PERIODS);
  if (typeof gsUrl !== 'undefined' && gsUrl){
    try {
      var r = await fetch(gsUrl, { method:'POST', redirect:'follow',
        body: JSON.stringify({ action:'setSetting', key:'salePeriods', value: JSON.stringify(SALE_PERIODS) }) });
      var d = await r.json().catch(function(){ return {}; });
      toast(d && d.error ? ('Lưu local ✓ — GSheets: '+d.error) : '✓ Đã lưu và đồng bộ lịch sử phân loại/thưởng lên Google Sheets');
    } catch(e){ toast('✓ Đã lưu local — chưa đồng bộ GSheets: '+e.message); }
  } else toast('✓ Đã lưu lịch sử phân loại/thưởng (local)');
  if (typeof renderSalesReportTab === 'function' && typeof _srState !== 'undefined' && _srState && (_srState.sub === 'G' || _srState.sub === 'E')) renderSalesReportTab();
}
async function _syncSalePeriodsFromGAS(){
  if (typeof gsUrl === 'undefined' || !gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=salePeriods', {redirect:'follow'});
    var data = await r.json();
    if (data && data.value){
      var obj = JSON.parse(data.value);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)){
        SALE_PERIODS = obj; saveLS('ome_sale_periods', SALE_PERIODS);
        if (typeof _srState !== 'undefined' && _srState && (_srState.sub === 'G' || _srState.sub === 'E') && typeof renderSalesReportTab === 'function') renderSalesReportTab();
      }
    }
  } catch(e){ /* giữ bản local nếu lỗi mạng/parse */ }
}
if (typeof setTimeout === 'function') setTimeout(_syncSalePeriodsFromGAS, 0);

// ── Tóm tắt 1 dòng cho bảng phân loại: "TV 10/09–10/10 → Online từ 11/10" ──
function _spGroupLabel_(key){
  var g = (typeof SALE_GROUPS !== 'undefined' ? SALE_GROUPS : []).filter(function(x){ return x.key === key; })[0];
  return g ? g.label : (key === 'probation' ? 'Thử việc' : key);
}
function _spDmy_(ymd){ var m = String(ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (m[3]+'/'+m[2]+'/'+m[1]) : ''; }
function _spSummary_(name){
  var l = _spListOf_(name).slice().sort(function(a,b){ return a.from < b.from ? -1 : 1; });
  if (!l.length) return '';
  return l.map(function(p){ return _spGroupLabel_(p.group)+' '+_spDmy_(p.from)+(p.to ? '→'+_spDmy_(p.to) : ' → nay'); }).join(' | ');
}

// ── Modal chỉnh giai đoạn của 1 sale ──
let _spDraft = null, _spName = '';
function openSalePeriodsModal(name){
  if (typeof currentUser === 'undefined' || currentUser.role !== 'admin'){ toast('Chỉ Admin mới cài lịch sử phân loại/thưởng.'); return; }
  _spName = name;
  _spDraft = _spListOf_(name).map(function(p){ return { from:p.from||'', to:p.to||'', group:p.group||'', programs:(p.programs||[]).slice() }; })
    .sort(function(a,b){ return a.from < b.from ? -1 : 1; });
  var m = document.getElementById('sp-modal');
  if (!m){
    m = document.createElement('div'); m.id = 'sp-modal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483000;align-items:center;justify-content:center';
    m.innerHTML = '<div style="background:var(--surface);border-radius:12px;width:min(860px,96vw);max-height:90vh;overflow:auto;padding:16px"><div id="sp-body"></div></div>';
    document.body.appendChild(m);
  }
  _renderSalePeriodsModal_();
  m.style.display = 'flex';
}
function closeSalePeriodsModal(){ var m = document.getElementById('sp-modal'); if (m) m.style.display = 'none'; _spDraft = null; }
function _renderSalePeriodsModal_(){
  var body = document.getElementById('sp-body'); if (!body || !_spDraft) return;
  var groups = (typeof SALE_GROUPS !== 'undefined' ? SALE_GROUPS : []).slice();
  if (!groups.some(function(g){ return g.key === 'probation'; })) groups.push({key:'probation', label:'Thử việc'});
  var progs = (typeof BONUS_PROGRAMS !== 'undefined' && Array.isArray(BONUS_PROGRAMS)) ? BONUS_PROGRAMS : [];
  var inp = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px';
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><b style="font-size:15px">📅 Lịch sử phân loại &amp; thưởng — '+esc(_spName)+'</b>'+
    '<button class="btn xs secondary" onclick="closeSalePeriodsModal()">✕</button></div>'+
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Mỗi giai đoạn: chọn khoảng ngày + đội (Thử việc/Online/Văn phòng…) + chương trình thưởng áp dụng. '+
    'Không tick chương trình nào = áp dụng theo "Đối tượng" của từng chương trình. Ngày nằm ngoài mọi giai đoạn dùng phân loại hiện tại của sale. Để trống "Đến ngày" = đến hiện tại.</div>';
  if (!_spDraft.length) h += '<div style="color:var(--muted);padding:10px;text-align:center">Chưa có giai đoạn nào.</div>';
  _spDraft.forEach(function(p, i){
    h += '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">'+
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<span style="font-size:12px">Từ ngày</span><input type="date" value="'+esc(p.from)+'" onchange="_spDraft['+i+'].from=this.value" style="'+inp+'">'+
      '<span style="font-size:12px">Đến ngày</span><input type="date" value="'+esc(p.to)+'" onchange="_spDraft['+i+'].to=this.value" style="'+inp+'">'+
      '<select onchange="_spDraft['+i+'].group=this.value" style="'+inp+'"><option value="">— Chọn đội —</option>'+
      groups.map(function(g){ return '<option value="'+esc(g.key)+'"'+(p.group===g.key?' selected':'')+'>'+esc(g.label)+'</option>'; }).join('')+'</select>'+
      '<button class="btn xs danger" onclick="_spDraft.splice('+i+',1);_renderSalePeriodsModal_()" title="Xoá giai đoạn">🗑</button></div>'+
      '<div style="margin-top:8px;font-size:12px"><b>Chương trình thưởng áp dụng:</b> '+
      (progs.length ? progs.map(function(bp){
        return '<label style="display:inline-block;margin:3px 10px 3px 0"><input type="checkbox" '+(p.programs.indexOf(bp.id)!==-1?'checked':'')+
          ' onchange="_spToggleProg_('+i+',\''+esc(bp.id)+'\',this.checked)"> '+esc(bp.name||bp.id)+'</label>';
      }).join('') : '<i style="color:var(--muted)">Chưa có chương trình nào (tạo ở 🏆 Chương trình thưởng)</i>')+'</div></div>';
  });
  h += '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn sm secondary" onclick="_spAddRow_()">+ Thêm giai đoạn</button>'+
    '<span style="flex:1"></span><button class="btn sm secondary" onclick="closeSalePeriodsModal()">Huỷ</button>'+
    '<button class="btn sm primary" onclick="_spSave_()">💾 Lưu</button></div>';
  body.innerHTML = h;
}
function _spToggleProg_(i, id, on){
  var l = _spDraft[i].programs, k = l.indexOf(id);
  if (on && k === -1) l.push(id); else if (!on && k !== -1) l.splice(k, 1);
}
function _spAddRow_(){
  var last = _spDraft.slice().sort(function(a,b){ return a.from < b.from ? -1 : 1; }).pop();
  var from = '';
  if (last && last.to){ var m = last.to.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m){ var d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]+1)); from = d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2); } }
  _spDraft.push({ from:from, to:'', group:'', programs:[] });
  _renderSalePeriodsModal_();
}
function _spSave_(){
  var err = _spValidate_(_spDraft);
  if (err){ toast('⚠ '+err); return; }
  var clean = _spDraft.map(function(p){ return { from:p.from, to:p.to||'', group:p.group, programs:p.programs.slice() }; })
    .sort(function(a,b){ return a.from < b.from ? -1 : 1; });
  // ghi vào đúng khoá đang có (nếu tên đã lưu dưới bí danh khác) để không tạo bản trùng
  var key = _spName, al = (typeof _cfgAliasesOf === 'function') ? _cfgAliasesOf(_spName) : [_spName];
  for (var i = 0; i < al.length; i++) if (SALE_PERIODS[al[i]] !== undefined){ key = al[i]; break; }
  if (clean.length) SALE_PERIODS[key] = clean; else delete SALE_PERIODS[key];
  closeSalePeriodsModal();
  saveSalePeriods();
  if (typeof _renderSaleChannelsModal === 'function') _renderSaleChannelsModal();
}

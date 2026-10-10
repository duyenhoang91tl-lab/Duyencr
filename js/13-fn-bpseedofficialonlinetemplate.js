// Theo bảng "Thưởng online" (quy tắc thưởng CHÍNH THỨC) Duyên gửi 2026-10. Dù tên file/cột ghi
// "Sale online", Duyên xác nhận 2026-10: bảng này áp dụng cho MỌI Sale CHÍNH THỨC (cả online lẫn
// offline) — "online" chỉ nói đến kênh bán, không phải loại nhân viên — nên audience mặc định
// {online:true, offline:true}. Sale đang ở trạng thái "Thử việc (TV)" KHÔNG được tính các CT này
// (xem fix _bonusProgramApplies_ ở trên) — Sale thử việc dùng mẫu "Thưởng Sale thử việc" riêng.
// Vài dòng trong bảng gốc có NHÃN và ĐIỀU KIỆN lệch nhau (vd nhãn "25tr" nhưng điều kiện ghi "từ
// 20tr") — đã lấy theo cột "Điều kiện áp dụng" (cột chấm tự động), kèm extraNote nhắc kiểm tra
// lại. Các CT gắn với 1 dòng sản phẩm cụ thể (Tỳ Hưu Thiên Lộc, Tourmaline cao cấp) mà hệ thống
// không tách được theo CHẤT LIỆU/sản phẩm CHÍNH XÁC (chỉ khớp theo giá trị đơn hoặc từ khoá tên
// sản phẩm) đều có ghi chú nhắc kế toán đối chiếu tay trước khi chốt — đúng tinh thần các mục 5/8
// (ghi chú tự do, không tự động chấm) đã có sẵn trong hệ thống.
function _bpSeedOfficialOnlineTemplate_(){
  if (!confirm('Tạo mới các chương trình mẫu theo đúng bảng "Thưởng online" (quy tắc thưởng chính thức, Google Sheet Duyên gửi 2026-10)? Bạn nên kiểm tra lại từng chương trình (đặc biệt 2 mục có nhãn/điều kiện lệch nhau, và 2 mục Tourmaline cao cấp) trước khi dùng thật. Không ảnh hưởng các chương trình đã có sẵn.')) return;
  // Duyen xac nhan 2026-10: bang nay ap dung cho MOI Sale CHINH THUC (ca online lan offline),
  // KHONG phai rieng Sale online — "online" trong ten bang/cot chi noi den kenh ban hang, khong
  // phai loai nhan vien. Chi loai tru Sale dang "Thu viec (TV)" (xem fix channel==='probation'
  // trong _bonusProgramApplies_ o tren).
  var common = { audience: {online:true, offline:true}, product:'', extraNote:'', exclusionNote:'' };
  var mk = function(o){ var p = _bpNewProgram(); return Object.assign(p, common, o, {id: 'bp_'+Date.now()+'_'+Math.floor(Math.random()*1000)}); };
  var seeded = [
    mk({ name: 'Đơn từ 10tr (combo 2 sản phẩm)',
      revenue: {enabled:true, scope:'order', min:10000000, max:''}, bonusAmount: 20000 }),
    mk({ name: 'Đơn từ 15tr (combo 3 sản phẩm)',
      revenue: {enabled:true, scope:'order', min:15000000, max:''}, bonusAmount: 30000 }),
    mk({ name: 'Đơn từ 20tr (combo 4 sản phẩm)',
      revenue: {enabled:true, scope:'order', min:20000000, max:''}, bonusAmount: 40000 }),
    mk({ name: 'Bill vòng mix charm — DT từ 20tr',
      requireProduct: 'vòng',
      revenue: {enabled:true, scope:'order', min:20000000, max:''}, bonusAmount: 30000,
      extraNote: 'Nhãn gốc trong bảng ghi "25tr" nhưng cột Điều kiện áp dụng ghi "Doanh thu từ 20tr" — đã lấy theo điều kiện, kiểm tra lại với Duyên nếu không đúng ý.' }),
    mk({ name: 'Bill vòng mix charm — đơn từ 15tr',
      requireProduct: 'vòng',
      revenue: {enabled:true, scope:'order', min:15000000, max:''}, bonusAmount: 20000,
      extraNote: 'Nhãn gốc trong bảng ghi "50tr" nhưng cột Điều kiện áp dụng ghi "Đơn từ 15tr" — đã lấy theo điều kiện, kiểm tra lại với Duyên nếu không đúng ý.' }),
    mk({ name: 'Thưởng doanh số/ngày — đạt từ 60tr',
      revenue: {enabled:true, scope:'day', min:60000000, max:''}, bonusAmount: 50000 }),
    mk({ name: 'Thưởng doanh số/ngày — đạt từ 100tr',
      revenue: {enabled:true, scope:'day', min:100000000, max:''}, bonusAmount: 100000 }),
    mk({ name: 'Tỳ Hưu Thiên Lộc Moon',
      product: 'Tỳ hưu thiên lộc Moon, Thiên Lộc Moon, THMoon', bonusAmount: 10000,
      extraNote: 'Cộng thưởng trực tiếp theo số lượng sản phẩm bán ra (nhẫn, vòng cổ, lắc, charm vàng bất kỳ) — Kế toán tự update theo đúng văn bản gốc.',
      exclusionNote: 'Không áp dụng cho Tỳ Hưu chế tác từ chất liệu Ngọc (Ngọc Lam, Ngọc Bích, Ngọc Cẩm Thạch B), Ruby, Saphire.' }),
    mk({ name: 'Tỳ Hưu Thiên Lộc Tourmaline (Hồng/Xanh)',
      product: 'Tourmaline Hồng, Tourmaline Xanh', bonusAmount: 8000 }),
    mk({ name: 'Tỳ Hưu Thiên Lộc Aquamarine',
      product: 'Aquamarine', bonusAmount: 8000 }),
    mk({ name: 'Tourmaline cao cấp — đơn từ 21tr500',
      dateFrom: '2026-09-21',
      revenue: {enabled:true, scope:'order', min:21500000, max:''}, bonusAmount: 100000,
      extraNote: 'Áp dụng cho dòng Tourmaline cao cấp — hệ thống chỉ chấm theo giá trị đơn (chưa tách được theo đúng sản phẩm), kế toán đối chiếu lại sản phẩm trên đơn trước khi chốt.',
      exclusionNote: 'Không tính thưởng nếu đơn phát sinh huỷ.' }),
    mk({ name: 'Tourmaline cao cấp — đơn từ 31tr500',
      dateFrom: '2026-09-21',
      revenue: {enabled:true, scope:'order', min:31500000, max:''}, bonusAmount: 200000,
      extraNote: 'Áp dụng cho dòng Tourmaline cao cấp — hệ thống chỉ chấm theo giá trị đơn (chưa tách được theo đúng sản phẩm), kế toán đối chiếu lại sản phẩm trên đơn trước khi chốt.',
      exclusionNote: 'Không tính thưởng nếu đơn phát sinh huỷ.' })
  ];
  BONUS_PROGRAMS = BONUS_PROGRAMS.concat(seeded);
  saveBonusPrograms();
  _renderBonusProgramsModal();
  toast('✓ Đã tạo '+seeded.length+' chương trình mẫu (Thưởng chính thức - Online) — nhớ kiểm tra lại từng mục trước khi dùng thật.');
}

function _srPctStr(v){ return (v===null || v===undefined) ? '—' : Math.round(v*10)/10 + '%'; }
function _srGrowthStr(v){
  if (v===null || v===undefined) return '<span style="color:var(--muted)">— (mới)</span>';
  var sign = v>0 ? '+' : '';
  var color = v>0 ? 'var(--green)' : (v<0 ? 'var(--red)' : 'var(--muted)');
  return '<span style="color:'+color+'">'+sign+Math.round(v*10)/10+'%</span>';
}

function _hFold_(s){
  return String(s||'').replace(/^\s*\d+(\.\d+)*\.?\s*/,'')   // bỏ số thứ tự "1." / "1.1 " ở đầu
    .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d')
    .toLowerCase().replace(/[^a-z0-9]+/g,'');
}
// Ngày của 1 lượt chia -> 'YYYY-MM-DD' ('' nếu không đọc được). Backend có thể trả chuỗi 'YYYY-MM-DD HH:mm'
// (đúng như lúc tạo) hoặc chuỗi Date của JS nếu Google Sheet tự đổi ô thành kiểu ngày giờ.
function _hEntryDate_(s){
  s = String(s||'');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  var d = new Date(s);
  return isNaN(d) ? '' : _ymd(d);
}
// Các nhóm mẹ 1–6 của Tình trạng CS (đọc động từ CARE_STATUS_TREE — admin sửa cây là báo cáo tự theo).
function _hGroups_(){
  var tree = (typeof CARE_STATUS_TREE !== 'undefined' && CARE_STATUS_TREE) ? CARE_STATUS_TREE : [];
  var numbered = tree.filter(function(n){ return /^\s*[1-6]\s*[.\-)]/.test(n.label||''); });
  var nodes = numbered.length ? numbered : tree.slice(0, 6);
  return nodes.map(function(n){
    var vals = n.children ? n.children.map(function(c){ return c.value; }).filter(Boolean) : (n.value ? [n.value] : []);
    return { label: n.label || '', values: vals, noContact: _hFold_(n.label).indexOf('khonglienlac') !== -1 };
  });
}
function _hGroupIndex_(groups){
  var idx = {};
  groups.forEach(function(g, i){ g.values.forEach(function(v){ idx[v] = i; }); });
  return idx;
}
// Trạng thái KH GỢI Ý theo Tình trạng CS: (1) admin đã gán tay cho nhóm CS đó -> dùng; (2) khớp theo tên
// (tên con rồi tên nhóm mẹ, có bảng tên gọi khác ở trên); không khớp được -> '' (để CS tự chọn).
function _hAutoKh_(status){
  if (!status) return '';
  var groups = _hGroups_();
  var tree = (typeof CARE_STATUS_TREE !== 'undefined' && CARE_STATUS_TREE) ? CARE_STATUS_TREE : [];
  var leafLabel = '', groupLabel = '';
  tree.forEach(function(n){
    if (n.children){ n.children.forEach(function(c){ if (c.value === status){ leafLabel = c.label || c.value; groupLabel = n.label || ''; } }); }
    else if (n.value === status){ leafLabel = n.label || n.value; groupLabel = n.label || ''; }
  });
  if (!leafLabel) leafLabel = status;
  var ov = _hKhMapOverride[groupLabel];
  if (ov) return ov;
  var kh = (typeof CUSTOMER_STATUS_TREE !== 'undefined' && CUSTOMER_STATUS_TREE) ? CUSTOMER_STATUS_TREE : [];
  function findKh(target){
    var f = _hFold_(target), res = '';
    kh.forEach(function(n){
      if (res) return;
      if (n.children){
        n.children.forEach(function(c){ if (!res && c.value && (_hFold_(c.label||c.value) === f)) res = c.value; });
        if (!res && _hFold_(n.label) === f){
          var same = n.children.filter(function(c){ return c.value && _hFold_(c.label||c.value) === _hFold_(leafLabel); })[0];
          res = (same || n.children.filter(function(c){ return c.value; })[0] || {}).value || '';
        }
      } else if (n.value && _hFold_(n.label||n.value) === f) res = n.value;
    });
    return res;
  }
  var cands = [leafLabel, groupLabel];
  for (var i = 0; i < cands.length; i++){
    if (!cands[i]) continue;
    var r = findKh(cands[i]) || (_H_ALIAS_[_hFold_(cands[i])] ? findKh(_H_ALIAS_[_hFold_(cands[i])]) : '');
    if (r) return r;
  }
  return '';
}
// Nhãn (con, nhóm mẹ) của 1 Tình trạng CS theo CARE_STATUS_TREE hiện hành
function _hLabelsOf_(status){
  var tree = (typeof CARE_STATUS_TREE !== 'undefined' && CARE_STATUS_TREE) ? CARE_STATUS_TREE : [], out = { leaf:'', group:'' };
  tree.forEach(function(n){
    if (n.children){ n.children.forEach(function(c){ if (c.value === status){ out.leaf = c.label || c.value; out.group = n.label || ''; } }); }
    else if (n.value === status){ out.leaf = n.label || n.value; out.group = n.label || ''; }
  });
  return out;
}
// Tình trạng CS thuộc nhóm "Chốt" (hoặc "Đã chốt") -> form hiện thêm ô Doanh thu đơn + Ghi chú đơn
function _hIsChot_(status){
  if (!status) return false;
  var l = _hLabelsOf_(status), re = /^(da)?chot$/;
  return re.test(_hFold_(l.group)) || re.test(_hFold_(l.leaf));
}
// Form cập nhật CS: đổi Tình trạng CS -> (1) hiện/ẩn khung đơn chốt, (2) Trạng thái KH tự nhảy theo, TRỪ khi CS đã tự chọn tay ô KH trong lần mở form này.
function _hOnCsStatusChange_(){
  var st = document.getElementById('cs-status'), kh = document.getElementById('cs-kh-status');
  if (!st) return;
  try {
    var box = document.getElementById('cs-chot-box');
    if (box) box.style.display = _hIsChot_(st.value) ? 'block' : 'none';
    if (!kh || kh.dataset.manual === '1') return;
    var hint = document.getElementById('cs-kh-hint');
    var v = _hAutoKh_(st.value);
    if (v && Array.prototype.some.call(kh.options, function(o){ return o.value === v; })){
      kh.value = v;
      if (hint) hint.textContent = '↻ Tự nhảy theo Tình trạng CS — bạn vẫn đổi tay được';
    } else if (hint){
      hint.textContent = st.value ? 'Chưa có quy tắc tự nhảy cho tình trạng này — chọn tay (Admin có thể gán ở Báo cáo H → ⚙ Trạng thái KH tự nhảy)' : '';
    }
  } catch(e){ console.warn('_hOnCsStatusChange_ lỗi:', e); }
}

function _hChotMonth_(mk){ return _hChot[mk] || (_hChot[mk] = loadLS('ome_chot_orders_' + mk) || {}); }
function _hChotMerge_(mk, remote){
  var cur = _hChotMonth_(mk);
  Object.keys(remote || {}).forEach(function(k){ if (!cur[k] || (remote[k].t || 0) > (cur[k].t || 0)) cur[k] = remote[k]; });
}
function _hChotToday_(phone){ var d = _ymd(new Date()); return _hChotMonth_(d.slice(0,7))[phone + '|' + d] || null; }
function _hFmtMoneyInput_(el){
  var n = parseInt(String(el.value).replace(/[^\d]/g, ''), 10);
  el.value = n ? n.toLocaleString('vi-VN') : '';
}
async function _hPushChot_(mk){
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=chotOrders_' + mk, { redirect:'follow' });
    var d = await r.json();
    if (d && d.value) _hChotMerge_(mk, JSON.parse(d.value));
    saveLS('ome_chot_orders_' + mk, _hChot[mk]);
    await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'chotOrders_' + mk, value: JSON.stringify(_hChot[mk]) }) });
  } catch(e) { toast('⚠ Đơn chốt đã lưu trên máy — chưa đồng bộ được lên Google Sheet: ' + e.message); }
}
// Gọi từ saveCare khi Tình trạng CS thuộc nhóm Chốt
function _hSaveChotFromForm_(phone, cs){
  var revEl = document.getElementById('cs-chot-rev'), codeEl = document.getElementById('cs-chot-code');
  if (!revEl && !codeEl) return;
  var rev = parseInt(String(revEl ? revEl.value : '').replace(/[^\d]/g, ''), 10) || 0;
  var code = codeEl ? codeEl.value.trim().toUpperCase().replace(/\s+/g, ' ') : '';
  var d = _ymd(new Date()), mk = d.slice(0,7), id = phone + '|' + d, cur = _hChotMonth_(mk);
  if (!rev && !code && !cur[id]) return;   // chưa nhập gì -> không tạo đơn rỗng
  cur[id] = { id:id, phone:phone, cs: cs || (currentUser && currentUser.name) || '', date:d, rev:rev, note:(cur[id] && cur[id].note) || '', code:code, t:Date.now() };  // note = ghi chu don cu (giu lai de khong mat du lieu da luu); code = ma bo dem / ma don Base
  saveLS('ome_chot_orders_' + mk, cur);
  clearTimeout(_hChotTimers[mk]);
  _hChotTimers[mk] = setTimeout(function(){ _hPushChot_(mk); }, 700);
  if (typeof _srState !== 'undefined' && _srState.sub === 'H') renderSalesReportTab();
}
function _hChotMonthsInRange_(){
  var from = (_srState.hDateFrom || _ymd(new Date())).slice(0,7), now = _ymd(new Date()).slice(0,7), out = [], y = +from.slice(0,4), m = +from.slice(5,7), n = 0;
  while ((y + '-' + String(m).padStart(2,'0')) <= now && n++ < 12){ out.push(y + '-' + String(m).padStart(2,'0')); m++; if (m > 12){ m = 1; y++; } }
  return out;
}
async function _hLoadChot_(){
  var months = _hChotMonthsInRange_(), changed = false;
  for (var i = 0; i < months.length; i++){
    var mk = months[i];
    if (_hChotLoaded[mk]) continue;
    _hChotLoaded[mk] = true;
    _hChotMonth_(mk);
    if (!gsUrl) continue;
    try {
      var r = await fetch(gsUrl + '?action=getSetting&key=chotOrders_' + mk, { redirect:'follow' });
      var d = await r.json();
      if (d && d.value){ _hChotMerge_(mk, JSON.parse(d.value)); saveLS('ome_chot_orders_' + mk, _hChot[mk]); changed = true; }
    } catch(e) {}
  }
  if (changed && _srState.sub === 'H') renderSalesReportTab();
}

// ── Số đơn chốt / Doanh thu nhập tay ──
function _hManualGet_(key){ var m = _hManual[key.slice(0,7)] || {}; return m[key] || { o:0, r:0 }; }
function _hMonthsInRange_(){
  var out = [], from = _srState.hDateFrom, to = _srState.hDateTo;
  if (!from || !to) return [String(from||to||_ymd(new Date())).slice(0,7)];
  var y = +from.slice(0,4), m = +from.slice(5,7), ey = +to.slice(0,4), em = +to.slice(5,7), n = 0;
  while ((y < ey || (y === ey && m <= em)) && n++ < 12){
    out.push(y + '-' + String(m).padStart(2,'0'));
    m++; if (m > 12){ m = 1; y++; }
  }
  return out;
}
function _hMergeManual_(mk, remote){
  var cur = _hManual[mk] || (_hManual[mk] = loadLS('ome_assign_manual_' + mk) || {});
  Object.keys(remote || {}).forEach(function(k){
    if (!cur[k] || (remote[k].t || 0) > (cur[k].t || 0)) cur[k] = remote[k];
  });
}
async function _hLoadManual_(){
  var months = _hMonthsInRange_(), changed = false;
  for (var i = 0; i < months.length; i++){
    var mk = months[i];
    if (_hManualLoaded[mk]) continue;
    _hManualLoaded[mk] = true;
    _hMergeManual_(mk, null);
    if (!gsUrl) continue;
    try {
      var r = await fetch(gsUrl + '?action=getSetting&key=assignReportManual_' + mk, { redirect:'follow' });
      var d = await r.json();
      if (d && d.value){ _hMergeManual_(mk, JSON.parse(d.value)); saveLS('ome_assign_manual_' + mk, _hManual[mk]); changed = true; }
    } catch(e) { /* giữ bản local nếu lỗi mạng/parse */ }
  }
  if (changed && _srState.sub === 'H') renderSalesReportTab();
}
async function _hPushManual_(mk){
  if (!gsUrl) return;
  try {
    // đọc lại bản mới nhất trên Settings rồi gộp theo timestamp từng dòng (tránh đè số của CS khác nhập cùng tháng)
    var r = await fetch(gsUrl + '?action=getSetting&key=assignReportManual_' + mk, { redirect:'follow' });
    var d = await r.json();
    if (d && d.value) _hMergeManual_(mk, JSON.parse(d.value));
    saveLS('ome_assign_manual_' + mk, _hManual[mk]);
    await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'assignReportManual_' + mk, value: JSON.stringify(_hManual[mk]) }) });
  } catch(e) { toast('⚠ Đã lưu trên máy — chưa đồng bộ được lên Google Sheet: ' + e.message); }
}
function _hSetManual_(key, field, val){
  // Chi lay chu so: kieu VN dung dau cham/phay lam dau ngan cach hang nghin (9.000.000 = 9 trieu), KHONG phai dau thap phan
  var n = parseInt(String(val).replace(/[^\d]/g, ''), 10) || 0;
  var mk = key.slice(0,7);
  _hManual[mk] = _hManual[mk] || loadLS('ome_assign_manual_' + mk) || {};
  var e = _hManual[mk][key] || { o:0, r:0 };
  e[field] = n; e.t = Date.now();
  _hManual[mk][key] = e;
  saveLS('ome_assign_manual_' + mk, _hManual[mk]);
  clearTimeout(_hSaveTimers[mk]);
  _hSaveTimers[mk] = setTimeout(function(){ _hPushManual_(mk); }, 700);
  renderSalesReportTab();
}

// Phạm vi xem: admin = tất cả; trưởng nhóm = cả team; CS thường = chỉ chính mình.
function _hScopeNames_(){
  if (_srIsAdmin()) return null;
  if (currentUser && currentUser.role === 'leader'){
    var t = _srLeaderTeamNames();
    if (t.length) return t;
  }
  return _srMyNames().concat([currentUser && currentUser.name]).filter(Boolean);
}
function _hAddMap_(a, b){ Object.keys(b||{}).forEach(function(k){ a[k] = (a[k]||0) + b[k]; }); }
function _hBuild_(){
  var from = _srState.hDateFrom, to = _srState.hDateTo, scope = _hScopeNames_();
  var teamF = _srState.hTeam || '', csF = _srState.hCs || '', byCs = (_srState.hGroup === 'cs');
  var groups = _hGroups_(), gIdx = _hGroupIndex_(groups);
  var map = {}, csSeen = {};
  (typeof assignHistory !== 'undefined' ? assignHistory : []).forEach(function(e){
    var d = _hEntryDate_(e.date); if (!d) return;
    if (from && d < from) return;
    if (to && d > to) return;
    var cs = e.csName || '(chưa rõ)';
    if (scope && scope.indexOf(cs) === -1) return;
    csSeen[cs] = 1;
    if (csF && cs !== csF) return;
    var tm = _teamOf(cs), tn = tm ? (tm.name || '(chưa đặt tên)') : 'Chưa có team';
    if (teamF && tn !== teamF) return;
    var key = byCs ? cs : (d + '|' + cs);
    var r = map[key] || (map[key] = { key:key, date: byCs ? '' : d, cs:cs, team:tn, phones:new Set(), mkeys:{} });
    (e.phones || []).forEach(function(p){ r.phones.add(p); });
    r.mkeys[d + '|' + cs] = 1;
  });
  var rows = Object.keys(map).map(function(k){ return map[k]; });
  var chotList = [];
  Object.keys(_hChot).forEach(function(mk){ Object.keys(_hChot[mk]).forEach(function(id){ chotList.push(_hChot[mk][id]); }); });
  rows.forEach(function(r){
    r.total = r.phones.size; r.g = groups.map(function(){ return 0; }); r.other = 0; r.none = 0;
    r.contact = { ok:0, kll:0, none:0 }; r.zalo = {}; r.kh = {};
    r.phones.forEach(function(p){
      var c = (typeof careData !== 'undefined' && careData[p]) || {}, st = c.status || '';
      if (!st){ r.none++; r.contact.none++; }
      else {
        var gi = gIdx[st];
        if (gi === undefined){ r.other++; r.contact.ok++; }
        else { r.g[gi]++; if (groups[gi].noContact) r.contact.kll++; else r.contact.ok++; }
      }
      var z = c.zalo || '(chưa rõ)'; r.zalo[z] = (r.zalo[z]||0) + 1;
      var k = c.khStatus || _hAutoKh_(st) || '(chưa có)'; r.kh[k] = (r.kh[k]||0) + 1;
    });
    // Don chot CS nhap o form (chi tinh SDT nam trong data da chia cho CHINH CS do, don tao tu ngay chia tro di) + phan bo sung tay
    r.autoOrders = 0; r.autoRevenue = 0;
    chotList.forEach(function(e){
      if (e.cs === r.cs && r.phones.has(e.phone) && (!r.date || e.date >= r.date)){ r.autoOrders++; r.autoRevenue += e.rev || 0; }
    });
    r.orders = r.autoOrders; r.revenue = r.autoRevenue;
    // Số đơn/doanh thu CHỈ tổng hợp từ báo cáo CS nhập (form chăm sóc khi chọn Chốt) — không còn cộng phần nhập tay.
  });
  var teamOrder = {}; (teams||[]).forEach(function(t, i){ teamOrder[t.name || '(chưa đặt tên)'] = i; });
  rows.sort(function(a, b){
    var ta = teamOrder[a.team] === undefined ? 999 : teamOrder[a.team], tb = teamOrder[b.team] === undefined ? 999 : teamOrder[b.team];
    if (ta !== tb) return ta - tb;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.cs.localeCompare(b.cs, 'vi');
  });
  return { rows: rows, groups: groups, csOptions: Object.keys(csSeen).sort(function(a,b){ return a.localeCompare(b,'vi'); }) };
}
function _hSum_(rows, groups){
  var s = { total:0, g: groups.map(function(){ return 0; }), other:0, none:0, contact:{ ok:0, kll:0, none:0 }, zalo:{}, kh:{}, orders:0, revenue:0 };
  rows.forEach(function(r){
    s.total += r.total; s.other += r.other; s.none += r.none; s.orders += r.orders; s.revenue += r.revenue;
    r.g.forEach(function(v, i){ s.g[i] += v; });
    s.contact.ok += r.contact.ok; s.contact.kll += r.contact.kll; s.contact.none += r.contact.none;
    _hAddMap_(s.zalo, r.zalo); _hAddMap_(s.kh, r.kh);
  });
  return s;
}
function _hChips_(m, color){
  var ks = Object.keys(m||{}).sort(function(a,b){ return m[b] - m[a]; });
  if (!ks.length) return '<span style="color:var(--hint)">—</span>';
  return ks.map(function(k){
    return '<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:9px;background:'+color+';font-size:10.5px;white-space:nowrap">'+esc(k)+' <b>'+m[k]+'</b></span>';
  }).join('');
}
function _hContactCell_(c){
  var h = '';
  h += '<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:9px;background:var(--green-bg);color:var(--green);font-size:10.5px;white-space:nowrap">Đã liên hệ <b>'+c.ok+'</b></span>';
  h += '<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:9px;background:#fee2e2;color:#b91c1c;font-size:10.5px;white-space:nowrap">Không LL được <b>'+c.kll+'</b></span>';
  if (c.none) h += '<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 6px;border-radius:9px;background:var(--surface2);color:var(--muted);font-size:10.5px;white-space:nowrap">Chưa CS <b>'+c.none+'</b></span>';
  return h;
}
function _hMoney_(n){ return (n||0).toLocaleString('vi-VN'); }

function _hMetrics_(x, groups){
  var ci = -1, pi = -1;
  groups.forEach(function(g, i){ var f = _hFold_(g.label); if (ci < 0 && f.indexOf('chot') !== -1) ci = i; if (pi < 0 && f.indexOf('phanvan') !== -1) pi = i; });
  if (ci < 0) ci = 0; if (pi < 0) pi = 1;
  var m = { chot: x.g[ci] || 0, pv: x.g[pi] || 0, conn: 0, inter: Math.max(0, x.total - x.none), zRep: 0, zAsk: 0 };
  groups.forEach(function(g, i){ if (!g.noContact) m.conn += x.g[i] || 0; });
  _H_ZALO_REPLY_.forEach(function(k){ m.zRep += (x.zalo && x.zalo[k]) || 0; });
  _H_ZALO_ASKED_.forEach(function(k){ m.zAsk += (x.zalo && x.zalo[k]) || 0; });
  m.rCare = x.total ? m.inter / x.total : null;          // Tỷ lệ chăm sóc = đã tương tác / data được chia
  m.rClose = m.conn ? x.orders / m.conn : null;          // Tỷ lệ chốt = số đơn chốt / kết nối
  m.rZalo = m.zAsk ? m.zRep / m.zAsk : null;             // Tỷ lệ Zalo = phản hồi / đã xin kết bạn, nhắn tin
  m.avg = x.orders ? Math.round(x.revenue / x.orders) : null;   // TB/đơn = doanh thu / số đơn
  m.rConn = m.inter ? m.conn / m.inter : null;           // Tỷ lệ kết nối = kết nối / đã liên hệ
  return m;
}
function _hPct_(v){ return v == null ? '—' : (Math.round(v * 1000) / 10).toLocaleString('vi-VN') + '%'; }
function _srRenderH_(d){
  if (!d.rows.length) return '<div style="color:var(--muted);text-align:center;padding:40px">Không có data nào được chia trong khoảng ngày này (hoặc ngoài phạm vi bạn được xem).</div>';
  var byCs = (_srState.hGroup === 'cs'), groups = d.groups;
  var ncol = 14;
  var th = 'style="text-align:right;white-space:nowrap"';
  var html = '<div class="h-sticky-wrap"><table class="dash-table h-sticky"><thead><tr>'+
    '<th>Ngày</th><th>Tên CS</th><th '+th+'>Data được chia</th>'+
    '<th '+th+' title="Số khách có Tình trạng CS = Chốt">Chốt</th>'+
    '<th '+th+' title="Số khách có Tình trạng CS = Phân vân">Phân vân</th>'+
    '<th '+th+' title="Chốt + Phân vân + Đang liên hệ + Từ chối + Khiếu nại">Kết nối</th>'+
    '<th '+th+' title="Số khách Zalo phản hồi (Đã kết bạn)">Zalo phản hồi</th>'+
    '<th '+th+' title="Tổng hợp tự động từ báo cáo CS nhập ở form chăm sóc khi chọn Chốt">Số đơn chốt</th>'+
    '<th '+th+' title="Tổng hợp tự động từ báo cáo CS nhập ở form chăm sóc khi chọn Chốt">Doanh thu</th>'+
    '<th '+th+' title="Tổng khách đã tương tác / Data được chia">Tỷ lệ chăm sóc</th>'+
    '<th '+th+' title="Số đơn chốt / Kết nối">Tỷ lệ chốt</th>'+
    '<th '+th+' title="Zalo phản hồi / Tổng khách đã xin kết bạn, nhắn tin">Tỷ lệ Zalo</th>'+
    '<th '+th+' title="Doanh thu / Số đơn">TB / đơn</th>'+
    '<th '+th+' title="Kết nối / Tổng khách đã liên hệ">Tỷ lệ kết nối</th></tr></thead><tbody>';
  function rateCells(m){
    return '<td style="text-align:right">'+_hPct_(m.rCare)+'</td><td style="text-align:right">'+_hPct_(m.rClose)+'</td>'+
      '<td style="text-align:right">'+_hPct_(m.rZalo)+'</td><td style="text-align:right">'+(m.avg == null ? '—' : _hMoney_(m.avg))+'</td>'+
      '<td style="text-align:right">'+_hPct_(m.rConn)+'</td>';
  }
  function totalRow(label, s, strong){
    var bg = strong ? 'background:var(--surface2);' : 'background:#f8fafc;', m = _hMetrics_(s, groups);
    return '<tr style="font-weight:700;border-top:2px solid var(--border);'+bg+'"><td colspan="2">'+label+'</td>'+
      '<td style="text-align:right">'+fmt(s.total)+'</td>'+
      '<td style="text-align:right">'+fmt(m.chot)+'</td><td style="text-align:right">'+fmt(m.pv)+'</td><td style="text-align:right">'+fmt(m.conn)+'</td>'+
      '<td style="text-align:right">'+fmt(m.zRep)+'</td>'+
      '<td style="text-align:right">'+fmt(s.orders)+'</td><td style="text-align:right">'+_hMoney_(s.revenue)+'</td>'+
      rateCells(m)+'</tr>';
  }
  var teamsInOrder = [];
  d.rows.forEach(function(r){ if (teamsInOrder.indexOf(r.team) === -1) teamsInOrder.push(r.team); });
  teamsInOrder.forEach(function(tn){
    var tr = d.rows.filter(function(r){ return r.team === tn; });
    html += '<tr><td colspan="'+ncol+'" style="background:var(--green-bg);color:var(--green);font-weight:700">👥 Team: '+esc(tn)+'</td></tr>';
    tr.forEach(function(r){
      var oCell = fmt(r.orders), rCell = _hMoney_(r.revenue);   // tự tổng hợp từ báo cáo CS, không nhập tay
      var rm = _hMetrics_(r, groups), z0 = function(v){ return v ? fmt(v) : '<span style="color:var(--hint)">0</span>'; };
      html += '<tr><td style="white-space:nowrap">'+(r.date ? esc(r.date.split('-').reverse().join('/')) : '—')+'</td><td>'+esc(r.cs)+'</td>'+
        '<td style="text-align:right;font-weight:600">'+fmt(r.total)+'</td>'+
        '<td style="text-align:right">'+z0(rm.chot)+'</td><td style="text-align:right">'+z0(rm.pv)+'</td><td style="text-align:right">'+z0(rm.conn)+'</td>'+
        '<td style="text-align:right">'+z0(rm.zRep)+'</td>'+
        '<td style="text-align:right">'+oCell+'</td><td style="text-align:right">'+rCell+'</td>'+
        rateCells(rm)+'</tr>';
    });
    if (teamsInOrder.length > 1) html += totalRow('Tổng team ' + esc(tn), _hSum_(tr, groups), false);
  });
  html += totalRow('TỔNG CỘNG', _hSum_(d.rows, groups), true);
  html += '</tbody></table></div>';
  html += '<div style="margin-top:8px;font-size:11px;color:var(--muted);line-height:1.5">'+
    'ℹ️ Tình trạng CS / Zalo tính theo <b>trạng thái HIỆN TẠI</b> của từng SĐT trong data đã chia (không phải trạng thái tại ngày chia). '+
    'Kết nối = Chốt + Phân vân + Đang liên hệ + Từ chối + Khiếu nại. Đã tương tác/đã liên hệ = SĐT đã có Tình trạng CS. Zalo phản hồi = Đã kết bạn; đã xin kết bạn/nhắn tin = Đã kết bạn + Chưa đồng ý + Không nhận tn lạ + Chặn + Hủy kết bạn. '+'Số đơn chốt / Doanh thu = tổng hợp tự động từ báo cáo CS nhập ở form chăm sóc khi chọn Chốt (chỉ tính SĐT thuộc data đã chia cho chính CS đó, đơn tạo từ ngày chia trở đi).'+'</div>';
  return html;
}
function renderSalesReportTabH_(wrap, subTabs){
  var d = _hBuild_();
  var sel = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  var filters = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  // Báo cáo H: bỏ tiêu đề + dải nút tab A–H cho gọn (bảng H rộng, cần chỗ). Để vẫn chuyển được sang
  // báo cáo khác mà không bị kẹt ở H (menu trên cùng chỉ đổi giữa các tab lớn), thay bằng 1 ô chọn nhỏ.
  var _subNames = {A:'A — Base',B:'B — Pos',C:'C — So sánh kỳ Base',D:'D — Sale tự thêm',E:'E — Hoa hồng nhân viên Pos',F:'F — KPI Sale',G:'G — Thưởng thử việc / chính thức',H:'H — Tổng quan data đã chia'};
  filters += '<select onchange="_srSetSub(this.value)" style="'+sel+';font-weight:600" title="Chuyển sang báo cáo khác">'+
    Object.keys(_subNames).map(function(k){ return '<option value="'+k+'"'+(k==='H'?' selected':'')+'>Báo cáo '+_subNames[k]+'</option>'; }).join('')+'</select>';
  filters += _quickRangeSelectHtml(_srState.hDateQuick, "_srApplyQuickRange('hDateQuick','hDateFrom','hDateTo',this.value)");
  filters += '<input type="date" value="'+esc(_srState.hDateFrom)+'" onchange="_srSetField(\'hDateFrom\',this.value);_srState.hDateQuick=\'custom\';_srApply()" title="Từ ngày" style="'+sel+'">';
  filters += '<span style="color:var(--muted)">→</span>';
  filters += '<input type="date" value="'+esc(_srState.hDateTo)+'" onchange="_srSetField(\'hDateTo\',this.value);_srState.hDateQuick=\'custom\';_srApply()" title="Đến ngày" style="'+sel+'">';
  var teamNames = (teams||[]).map(function(t){ return t.name || '(chưa đặt tên)'; });
  if (_srIsAdmin() || (currentUser && currentUser.role === 'leader')){
    filters += '<select onchange="_srState.hTeam=this.value;renderSalesReportTab()" style="'+sel+'" title="Lọc theo Team (CSKH / Quầy / Sale...)"><option value="">Tất cả team</option>'+
      teamNames.concat(['Chưa có team']).map(function(n){ return '<option value="'+esc(n)+'"'+(_srState.hTeam===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select>';
    filters += '<select onchange="_srState.hCs=this.value;renderSalesReportTab()" style="'+sel+'" title="Lọc theo tên CS"><option value="">Tất cả CS</option>'+
      d.csOptions.map(function(n){ return '<option value="'+esc(n)+'"'+(_srState.hCs===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select>';
  }
  filters += '<select onchange="_srState.hGroup=this.value;renderSalesReportTab()" style="'+sel+'">'+
    '<option value="dayCs"'+(_srState.hGroup!=='cs'?' selected':'')+'>Theo ngày × CS</option>'+
    '<option value="cs"'+(_srState.hGroup==='cs'?' selected':'')+'>Gộp theo CS</option></select>';
  filters += '<button class="btn secondary sm" onclick="_srApply()">Lọc</button>';
  filters += '<button class="btn sm" onclick="_hExportCsv_()">⬇️ Xuất CSV</button>';
  if (_srIsAdmin()) filters += '<button class="btn sm" onclick="openHKhMapModal_()" title="Gán Trạng thái KH tự nhảy theo từng nhóm Tình trạng CS">⚙ Trạng thái KH tự nhảy</button>';
  filters += '</div>';
  wrap.innerHTML = filters + _srRenderH_(d);
}
function renderSalesReportTabI_(wrap, subTabs) {
  // ═══ Báo cáo I — Chia data Renew (nguồn CSKH-Duyên) ═══
  // KH được chia = assignHistory.phones ∩ cskhData (có trong sheet cskh-duyen)
  // Metrics: # KH được chia, đã chăm, chốt đơn, DT; tỷ lệ theo CS / Phân loại / Tháng chia

  var sel = 'padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface)';
  var from = _srState.iDateFrom || '', to = _srState.iDateTo || '';
  var csF = _srState.iCs || '', teamF = _srState.iTeam || '';

  // ── Build renew phone set (SDT có trong cskhData) ──
  var renewPhones = new Set(typeof cskhData !== 'undefined' ? Object.keys(cskhData) : []);

  // ── Flatten assign history → chỉ lấy phones thuộc Renew ──
  var scope = _hScopeNames_();
  var groups = _hGroups_(), gIdx = _hGroupIndex_(groups);
  var teamNames = (teams||[]).map(function(t){ return t.name || '(chưa đặt tên)'; });

  var csMap = {}; // cs -> { total:Set, done:Set, chot:Set, revenue, g:[], contact, zalo:{}, kh:{}, months:{} }
  var monthSet = new Set();
  (typeof assignHistory !== 'undefined' ? assignHistory : []).forEach(function(e) {
    var d = _hEntryDate_(e.date); if (!d) return;
    if (from && d < from) return;
    if (to && d > to) return;
    var cs = e.csName || '(chưa rõ)';
    if (scope && scope.indexOf(cs) === -1) return;
    if (csF && cs !== csF) return;
    var tm = _teamOf(cs), tn = tm ? (tm.name || '(chưa đặt tên)') : 'Chưa có team';
    if (teamF && tn !== teamF) return;
    var mo = d.slice(0, 7); monthSet.add(mo);
    (e.phones || []).forEach(function(p) {
      if (!renewPhones.has(p)) return; // chỉ lấy KH Renew
      var r = csMap[cs] || (csMap[cs] = {
        cs: cs, team: tn, total: new Set(), done: new Set(), chot: new Set(),
        revenue: 0, g: groups.map(function(){ return 0; }), other: 0, none: 0,
        contact: {ok:0,kll:0,none:0}, zalo: {}, kh: {}, months: {}
      });
      r.total.add(p);
      r.months[mo] = (r.months[mo] || new Set()); r.months[mo].add(p);
      var c = (typeof careData !== 'undefined' && careData[p]) || {}, st = c.status || '';
      if ((e.donePhones || []).indexOf(p) !== -1) r.done.add(p);
      if (st === 'Chốt' || (c.khStatus || '') === 'Chốt') r.chot.add(p);
      r.revenue += (c.revenue || 0);
      if (!st) { r.none++; r.contact.none++; }
      else {
        var gi = gIdx[st];
        if (gi === undefined) { r.other++; r.contact.ok++; }
        else { r.g[gi]++; if (groups[gi].noContact) r.contact.kll++; else r.contact.ok++; }
      }
      var z = c.zalo || '(chưa rõ)'; r.zalo[z] = (r.zalo[z]||0)+1;
      var k = c.khStatus || _hAutoKh_(st) || '(chưa có)'; r.kh[k] = (r.kh[k]||0)+1;
    });
  });

  var rows = Object.values(csMap);
  rows.sort(function(a,b){ return b.total.size - a.total.size; });

  // ── KPI tổng ──
  var allRenewAssigned = new Set(), allDone = new Set(), allChot = new Set(), totalRev = 0;
  rows.forEach(function(r){
    r.total.forEach(function(p){ allRenewAssigned.add(p); });
    r.done.forEach(function(p){ allDone.add(p); });
    r.chot.forEach(function(p){ allChot.add(p); });
    totalRev += r.revenue;
  });
  var totalRenew = renewPhones.size;
  var totalAssigned = allRenewAssigned.size;
  var neverAssigned = Math.max(0, totalRenew - totalAssigned);
  var pctAssigned = totalRenew ? Math.round(totalAssigned/totalRenew*100) : 0;
  var pctDone = totalAssigned ? Math.round(allDone.size/totalAssigned*100) : 0;
  var pctChot = totalAssigned ? Math.round(allChot.size/totalAssigned*100) : 0;

  var maxBar = rows.length ? rows[0].total.size : 1;
  var months = Array.from(monthSet).sort();

  // ── Pivot: tier ──
  var tierMap = {}, tierKeys = ['VIP','Thân thiết','Tiềm năng','Chưa bán lại được'];
  allRenewAssigned.forEach(function(p){
    var c = (typeof allCustomers !== 'undefined' ? allCustomers : []).find(function(x){ return x.phone===p; });
    var t = (c&&c.tier)||'—';
    tierMap[t] = (tierMap[t]||{total:0,done:0,chot:0});
    tierMap[t].total++;
    if (allDone.has(p)) tierMap[t].done++;
    if (allChot.has(p)) tierMap[t].chot++;
  });

  // ── Filters UI ──
  var isAdminOrLeader = _srIsAdmin() || (currentUser && currentUser.role === 'leader');
  var allCSNames = Array.from(new Set((typeof assignHistory!=='undefined'?assignHistory:[]).map(function(h){return h.csName;}))).sort();
  var filtersHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border)">';
  filtersHtml += _quickRangeSelectHtml(_srState.iDateQuick||'', "_srApplyQuickRange('iDateQuick','iDateFrom','iDateTo',this.value)");
  filtersHtml += '<input type="date" value="'+esc(from)+'" onchange="_srSetField(\'iDateFrom\',this.value);_srState.iDateQuick=\'custom\';renderSalesReportTab()" title="Từ ngày" style="'+sel+'">';
  filtersHtml += '<span style="color:var(--muted)">→</span>';
  filtersHtml += '<input type="date" value="'+esc(to)+'" onchange="_srSetField(\'iDateTo\',this.value);_srState.iDateQuick=\'custom\';renderSalesReportTab()" title="Đến ngày" style="'+sel+'">';
  if (isAdminOrLeader) {
    filtersHtml += '<select onchange="_srState.iTeam=this.value;renderSalesReportTab()" style="'+sel+'"><option value="">Tất cả team</option>'+
      teamNames.map(function(n){ return '<option value="'+esc(n)+'"'+(teamF===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select>';
    filtersHtml += '<select onchange="_srState.iCs=this.value;renderSalesReportTab()" style="'+sel+'"><option value="">Tất cả CS</option>'+
      allCSNames.map(function(n){ return '<option value="'+esc(n)+'"'+(csF===n?' selected':'')+'>'+esc(n)+'</option>'; }).join('')+'</select>';
  }
  filtersHtml += '<button class="btn sm" onclick="exportRenewReport_()">⬇️ Xuất CSV</button>';
  filtersHtml += '</div>';

  // ── KPI cards ──
  var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px;margin-bottom:16px">';
  var kpis = [
    ['🗂️',totalRenew,'Tổng KH Renew','var(--text)',''],
    ['📤',totalAssigned,'Đã được chia','var(--blue)',pctAssigned+'% tổng Renew'],
    ['⬜',neverAssigned,'Chưa chia lần nào','var(--hint)',''],
    ['✅',allDone.size,'Đã chăm xong','var(--green)',pctDone+'% đã chia'],
    ['🎯',allChot.size,'Đã chốt','#059669',pctChot+'% đã chia'],
  ];
  kpis.forEach(function(k){
    kpiHtml += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px 12px">' +
      '<div style="font-size:20px;font-weight:800;color:'+k[3]+';line-height:1">'+fmt(k[1])+'</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:3px">'+k[0]+' '+esc(k[2])+'</div>' +
      (k[4]?'<div style="font-size:9px;color:var(--hint);margin-top:1px">'+esc(k[4])+'</div>':'') +
      '</div>';
  });
  kpiHtml += '</div>';

  // ── Bar chart theo CS ──
  var barHtml = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:12px 14px;margin-bottom:14px">';
  barHtml += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--hint);margin-bottom:12px">📊 KH Renew được chia & kết quả theo CS</div>';
  if (rows.length === 0) barHtml += '<div style="font-size:12px;color:var(--hint);padding:8px 0">Không có data</div>';
  rows.forEach(function(r){
    var tot=r.total.size, don=r.done.size, cho=r.chot.size;
    var pD=tot?Math.round(don/tot*100):0, pC=tot?Math.round(cho/tot*100):0;
    barHtml += '<div style="margin-bottom:11px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">' +
        '<span style="font-size:12px;font-weight:600">'+esc(r.cs)+'</span>' +
        '<span style="font-size:11px;color:var(--muted)">'+tot+' KH &nbsp;|&nbsp; <span style="color:var(--green)">✓'+don+' ('+pD+'%)</span> &nbsp;|&nbsp; <span style="color:#059669">🎯'+cho+' ('+pC+'%)</span></span>' +
      '</div>' +
      '<div style="position:relative;height:14px;background:var(--surface3);border-radius:4px;overflow:hidden">' +
        '<div style="position:absolute;top:0;left:0;height:100%;width:'+(tot/maxBar*100)+'%;background:#e0e7ff;border-radius:4px"></div>' +
        '<div style="position:absolute;top:0;left:0;height:100%;width:'+(tot?don/tot*100:0)+'%;background:var(--green-mid);opacity:.55;border-radius:4px"></div>' +
        '<div style="position:absolute;top:0;left:0;height:100%;width:'+(tot?cho/tot*100:0)+'%;background:#059669;border-radius:4px"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:2px;font-size:9px;color:var(--hint)"><span style="color:#818cf8">■ Tổng</span><span style="color:var(--green)">■ Đã xong</span><span style="color:#059669">■ Chốt</span></div>' +
    '</div>';
  });
  barHtml += '</div>';

  // ── Tỷ lệ theo Phân loại KH ──
  var tierHtml = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:12px 14px;margin-bottom:14px">';
  tierHtml += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--hint);margin-bottom:10px">🏅 Phân tích theo Phân loại KH Renew</div>';
  tierHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">';
  var tierColors = {VIP:'#7c3aed','Thân thiết':'#0891b2','Tiềm năng':'#059669','Chưa bán lại được':'var(--muted)'};
  (tierKeys.concat(Object.keys(tierMap).filter(function(t){ return tierKeys.indexOf(t)===-1; }))).forEach(function(t){
    var d = tierMap[t]; if (!d) return;
    var pD2 = d.total ? Math.round(d.done/d.total*100):0;
    var pC2 = d.total ? Math.round(d.chot/d.total*100):0;
    var pT = totalAssigned ? Math.round(d.total/totalAssigned*100):0;
    tierHtml += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--rsm);padding:10px 12px">' +
      '<div style="font-size:11px;font-weight:700;color:'+(tierColors[t]||'var(--text)')+';margin-bottom:6px">'+esc(t)+'</div>' +
      '<div style="font-size:18px;font-weight:800;line-height:1">'+fmt(d.total)+'</div>' +
      '<div style="font-size:10px;color:var(--muted);margin-top:2px">'+pT+'% tổng đã chia</div>' +
      '<div style="margin-top:6px;height:4px;background:var(--surface3);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+pD2+'%;background:var(--green)"></div></div>' +
      '<div style="font-size:9px;color:var(--hint);margin-top:2px">Đã xong: '+d.done+' ('+pD2+'%) &nbsp;|&nbsp; Chốt: '+d.chot+' ('+pC2+'%)</div>' +
    '</div>';
  });
  tierHtml += '</div></div>';

  // ── Bảng chi tiết theo CS × Tháng ──
  var tableHtml = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:12px 14px;margin-bottom:14px">';
  tableHtml += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--hint);margin-bottom:10px">📋 Chi tiết CS × Tháng chia</div>';
  tableHtml += '<div style="overflow-x:auto"><table class="dash-table"><thead><tr><th>CS</th><th>Team</th>';
  months.forEach(function(m){ tableHtml += '<th style="text-align:right">'+esc(m)+'</th>'; });
  tableHtml += '<th style="text-align:right">Tổng KH</th><th style="text-align:right">Đã xong</th><th style="text-align:right">Chốt</th><th style="text-align:right">% Xong</th><th style="text-align:right">% Chốt</th></tr></thead><tbody>';
  rows.forEach(function(r, ri){
    var tot=r.total.size, don=r.done.size, cho=r.chot.size;
    tableHtml += '<tr style="border-bottom:1px solid var(--border);'+(ri%2===1?'background:var(--surface2)':'background:var(--surface)')+'">' +
      '<td style="font-weight:500;white-space:nowrap">'+esc(r.cs)+'</td>' +
      '<td style="font-size:11px;color:var(--muted)">'+esc(r.team)+'</td>';
    months.forEach(function(m){
      var n = r.months[m] ? r.months[m].size : 0;
      tableHtml += '<td style="text-align:right">'+(n?fmt(n):'<span style="color:var(--hint)">—</span>')+'</td>';
    });
    tableHtml += '<td style="text-align:right;font-weight:700">'+fmt(tot)+'</td>' +
      '<td style="text-align:right;color:var(--green)">'+fmt(don)+'</td>' +
      '<td style="text-align:right;color:#059669">'+fmt(cho)+'</td>' +
      '<td style="text-align:right">'+(tot?Math.round(don/tot*100):0)+'%</td>' +
      '<td style="text-align:right">'+(tot?Math.round(cho/tot*100):0)+'%</td>' +
    '</tr>';
  });
  // Tổng footer
  tableHtml += '<tr style="font-weight:700;border-top:2px solid var(--border-md);background:var(--surface3)"><td colspan="2">Tổng cộng</td>';
  months.forEach(function(m){
    var n = 0; rows.forEach(function(r){ n += r.months[m] ? r.months[m].size : 0; });
    tableHtml += '<td style="text-align:right">'+fmt(n)+'</td>';
  });
  tableHtml += '<td style="text-align:right;color:var(--green)">'+fmt(totalAssigned)+'</td>' +
    '<td style="text-align:right;color:var(--green)">'+fmt(allDone.size)+'</td>' +
    '<td style="text-align:right;color:#059669">'+fmt(allChot.size)+'</td>' +
    '<td style="text-align:right">'+(totalAssigned?Math.round(allDone.size/totalAssigned*100):0)+'%</td>' +
    '<td style="text-align:right">'+(totalAssigned?Math.round(allChot.size/totalAssigned*100):0)+'%</td>' +
  '</tr></tbody></table></div></div>';

  wrap.innerHTML = '<div class="dash-section-title" style="margin-top:0">📈 Báo cáo doanh số</div>' +
    subTabs + filtersHtml + kpiHtml + barHtml + tierHtml + tableHtml;
}

function exportRenewReport_() {
  // Export CSV báo cáo I
  var from = _srState.iDateFrom||'', to = _srState.iDateTo||'', csF = _srState.iCs||'', teamF = _srState.iTeam||'';
  var renewPhones = new Set(typeof cskhData!=='undefined' ? Object.keys(cskhData) : []);
  var scope = _hScopeNames_(), groups = _hGroups_(), gIdx = _hGroupIndex_(groups);
  var csMap = {};
  (typeof assignHistory!=='undefined'?assignHistory:[]).forEach(function(e){
    var d=_hEntryDate_(e.date); if(!d) return;
    if(from&&d<from) return; if(to&&d>to) return;
    var cs=e.csName||'(chưa rõ)';
    if(scope&&scope.indexOf(cs)===-1) return;
    if(csF&&cs!==csF) return;
    var tm=_teamOf(cs), tn=tm?(tm.name||'(chưa đặt tên)'):'Chưa có team';
    if(teamF&&tn!==teamF) return;
    (e.phones||[]).forEach(function(p){
      if(!renewPhones.has(p)) return;
      var r=csMap[cs]||(csMap[cs]={cs:cs,team:tn,total:new Set(),done:new Set(),chot:new Set()});
      r.total.add(p);
      if((e.donePhones||[]).indexOf(p)!==-1) r.done.add(p);
      var c=(typeof careData!=='undefined'&&careData[p])||{};
      if(c.status==='Chốt'||(c.khStatus||'')==='Chốt') r.chot.add(p);
    });
  });
  var q=function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; };
  var head=['CS','Team','Tổng KH Renew','Đã xong','Chốt','% Đã xong','% Chốt'];
  var lines=[head.map(q).join(',')];
  Object.values(csMap).forEach(function(r){
    var tot=r.total.size,don=r.done.size,cho=r.chot.size;
    lines.push([r.cs,r.team,tot,don,cho,tot?Math.round(don/tot*100)+'%':'0%',tot?Math.round(cho/tot*100)+'%':'0%'].map(q).join(','));
  });
  var blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='renew-report_'+(from||'')+'_'+(to||'')+'.csv';
  document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
}

function _hExportCsv_(){
  var d = _hBuild_(), g = d.groups, q = function(v){ return '"' + String(v==null?'':v).replace(/"/g,'""') + '"'; };
  var head = ['Team','Ngày','Tên CS','Data được chia','Chốt','Phân vân','Kết nối','Zalo phản hồi','Số đơn chốt','Doanh thu','Tỷ lệ chăm sóc','Tỷ lệ chốt','Tỷ lệ Zalo','TB/đơn','Tỷ lệ kết nối'];
  var lines = [head.map(q).join(',')];
  d.rows.forEach(function(r){
    var m = _hMetrics_(r, g);
    lines.push([r.team, r.date, r.cs, r.total, m.chot, m.pv, m.conn, m.zRep, r.orders, r.revenue, _hPct_(m.rCare), _hPct_(m.rClose), _hPct_(m.rZalo), m.avg == null ? '' : m.avg, _hPct_(m.rConn)].map(q).join(','));
  });
  var blob = new Blob(['﻿' + lines.join('\r\n')], { type:'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'bao-cao-chia-data_' + (_srState.hDateFrom||'') + '_' + (_srState.hDateTo||'') + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
// Modal admin: gán Trạng thái KH cho từng nhóm Tình trạng CS (để trống = tự khớp theo tên)
function openHKhMapModal_(){
  var groups = _hGroups_();
  var old = document.getElementById('h-khmap-modal'); if (old) old.remove();
  var m = document.createElement('div'); m.id = 'h-khmap-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:center;justify-content:center';
  m.innerHTML = '<div style="background:var(--surface);border-radius:10px;padding:18px;max-width:520px;width:92%;max-height:86vh;overflow:auto">'+
    '<div style="font-weight:700;margin-bottom:6px">⚙ Trạng thái KH tự nhảy theo Tình trạng CS</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">Chọn Trạng thái KH sẽ tự điền khi CS chọn Tình trạng CS thuộc nhóm đó. Để "— Chọn —" = tự khớp theo tên (VD: Chốt → Chốt). CS vẫn tự đổi tay được.</div>'+
    groups.map(function(g, i){
      return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><div style="flex:1;font-size:13px">'+esc(g.label)+'</div>'+
        '<select data-glabel="'+esc(g.label)+'" class="form-select" style="flex:1">'+_buildCustStatusOptions(_hKhMapOverride[g.label]||'')+'</select></div>';
    }).join('')+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn sm" onclick="document.getElementById(\'h-khmap-modal\').remove()">Đóng</button>'+
    '<button class="btn primary sm" onclick="saveHKhMap_()">Lưu</button></div></div>';
  document.body.appendChild(m);
}
async function saveHKhMap_(){
  var o = {};
  document.querySelectorAll('#h-khmap-modal select[data-glabel]').forEach(function(s){ if (s.value) o[s.dataset.glabel] = s.value; });
  _hKhMapOverride = o; saveLS('ome_cs_kh_map', o);
  var mm = document.getElementById('h-khmap-modal'); if (mm) mm.remove();
  if (gsUrl){
    try { await fetch(gsUrl, { method:'POST', body: JSON.stringify({ action:'setSetting', key:'csKhMap', value: JSON.stringify(o) }) }); toast('✓ Đã lưu và đồng bộ'); }
    catch(e){ toast('✓ Đã lưu trên máy — chưa đồng bộ GSheets: ' + e.message); }
  } else toast('✓ Đã lưu (local)');
  if (_srState.sub === 'H') renderSalesReportTab();
}
async function _hSyncKhMap_(){
  if (!gsUrl) return;
  try {
    var r = await fetch(gsUrl + '?action=getSetting&key=csKhMap', { redirect:'follow' });
    var d = await r.json();
    if (d && d.value){ var o = JSON.parse(d.value); if (o && typeof o === 'object'){ _hKhMapOverride = o; saveLS('ome_cs_kh_map', o); } }
  } catch(e) {}
}
function _srRenderCTable(rows, entType, search, searchKey){
  var filtered = rows.filter(function(r){ return !search || r.name.toLowerCase().indexOf(search.toLowerCase())!==-1; });
  var html = '<table class="dash-table"><thead><tr>'+
    '<th>'+(entType==='sale'?'Nhân viên (Sale)':'Kênh bán')+'</th>'+
    '<th style="text-align:right">KPI kỳ trước</th><th style="text-align:right">Kết quả kỳ trước</th><th style="text-align:right">%HT KPI kỳ trước</th>'+
    '<th style="text-align:right">KPI kỳ này</th><th style="text-align:right">Kết quả kỳ này</th><th style="text-align:right">%HT KPI kỳ này</th>'+
    '<th style="text-align:right">% Tăng trưởng</th></tr></thead><tbody>';
  filtered.forEach(function(r, i){
    var rowId = entType+'_'+i;
    var expanded = _srState.cExpandedRow === rowId;
    html += '<tr style="cursor:pointer" onclick="_srToggleCRow(\''+rowId+'\')" title="Bấm để xem chi tiết đơn">'+
      '<td>'+(expanded?'▾ ':'▸ ')+esc(r.name)+'</td>'+
      '<td style="text-align:right">'+(r.kpiPrev?_srMoney(r.kpiPrev):'—')+'</td>'+
      '<td style="text-align:right">'+_srMoney(r.resultPrev)+'</td>'+
      '<td style="text-align:right">'+_srPctStr(r.pctKpiPrev)+'</td>'+
      '<td style="text-align:right">'+(r.kpiCur?_srMoney(r.kpiCur):'—')+'</td>'+
      '<td style="text-align:right">'+_srMoney(r.resultCur)+'</td>'+
      '<td style="text-align:right">'+_srPctStr(r.pctKpiCur)+'</td>'+
      '<td style="text-align:right">'+_srGrowthStr(r.growthPct)+'</td>'+
      '</tr>';
    if (expanded){
      var d = _srState.dataC;
      var ordCur = (d.ordersCur||[]).filter(function(o){ return entType==='sale' ? splitSaleNames_(o.saleBan).indexOf(r.name)!==-1 || (r.name==='(chưa gán sale)' && !splitSaleNames_(o.saleBan).length) : (o.kenhBan||'(chưa có kênh)')===r.name; });
      var ordPrev = (d.ordersPrev||[]).filter(function(o){ return entType==='sale' ? splitSaleNames_(o.saleBan).indexOf(r.name)!==-1 || (r.name==='(chưa gán sale)' && !splitSaleNames_(o.saleBan).length) : (o.kenhBan||'(chưa có kênh)')===r.name; });
      html += '<tr><td colspan="8" style="background:var(--surface2);padding:10px">'+
        '<div style="font-weight:600;font-size:11px;margin-bottom:4px">Đơn kỳ này ('+ordCur.length+')</div>'+
        _srMiniOrderTable(ordCur)+
        '<div style="font-weight:600;font-size:11px;margin:8px 0 4px">Đơn kỳ trước ('+ordPrev.length+')</div>'+
        _srMiniOrderTable(ordPrev)+
        '</td></tr>';
    }
  });
  if (!filtered.length) html += '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:14px">Không có dữ liệu</td></tr>';
  else {
    // Tong tien cong don binh thuong; % thi phai tinh lai theo TY LE TONG (khong duoc cong don
    // cac % rieng le voi nhau), vi khong co y nghia thong ke — VD 2 sale dat 50% va 200% KPI thi
    // "tong %" khong phai 250%, ma phai la tong ket qua chia tong KPI cua ca 2.
    var sumKpiPrev=0, sumResultPrev=0, sumKpiCur=0, sumResultCur=0;
    filtered.forEach(function(r){
      sumKpiPrev += Number(r.kpiPrev)||0; sumResultPrev += Number(r.resultPrev)||0;
      sumKpiCur += Number(r.kpiCur)||0; sumResultCur += Number(r.resultCur)||0;
    });
    var pctPrevTot = sumKpiPrev ? (sumResultPrev/sumKpiPrev*100) : null;
    var pctCurTot = sumKpiCur ? (sumResultCur/sumKpiCur*100) : null;
    var growthTot = sumResultPrev ? ((sumResultCur-sumResultPrev)/sumResultPrev*100) : null;
    html += _srTotalRowHtml_(['Tổng',
      sumKpiPrev?_srMoney(sumKpiPrev):'—', _srMoney(sumResultPrev), _srPctStr(pctPrevTot),
      sumKpiCur?_srMoney(sumKpiCur):'—', _srMoney(sumResultCur), _srPctStr(pctCurTot),
      _srGrowthStr(growthTot)]);
  }
  html += '</tbody></table>';
  return html;
}
function splitSaleNames_(s){ return (s||'').split(',').map(function(x){return x.trim();}).filter(Boolean); }
function _srMiniOrderTable(orders){
  if (!orders.length) return '<div style="color:var(--muted);font-size:11px">Không có đơn</div>';
  var html = '<table class="dash-table" style="font-size:11px"><thead><tr><th>Ngày tạo</th><th>Kênh</th><th>Sale</th><th style="text-align:right">Giá trị</th></tr></thead><tbody>';
  var miniCap_ = 300; // đơn của 1 bucket hiếm khi vượt; vượt thì báo thay vì vẽ hết
  orders.slice(0, miniCap_).forEach(function(o){
    html += '<tr><td>'+esc(String(o.ngayTao))+'</td><td>'+esc(o.kenhBan)+'</td><td>'+esc(o.saleBan)+'</td><td style="text-align:right">'+_srMoney(o.giaTriDon)+'</td></tr>';
  });
  if (orders.length > miniCap_) html += '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:8px">… còn '+(orders.length-miniCap_)+' đơn nữa (chỉ hiện '+miniCap_+' đơn đầu)</td></tr>';
  html += '</tbody></table>';
  return html;
}
function _srToggleCRow(rowId){
  _srState.cExpandedRow = (_srState.cExpandedRow === rowId) ? '' : rowId;
  renderSalesReportTab();
}

function _srRenderC(d){
  if (!d) return _srNoDataHtml_();
  var p = d.period || {};
  var cCur = (d.byEmployee||[]).reduce(function(s,r){return s+(r.resultCur||0);},0);
  var cPrev = (d.byEmployee||[]).reduce(function(s,r){return s+(r.resultPrev||0);},0);
  var cGrowth = cPrev>0 ? Math.round((cCur-cPrev)/cPrev*1000)/10 : (cCur>0?null:0);
  var cGrowColor = cGrowth===null ? 'var(--muted)' : (cGrowth>=0 ? '#16a34a' : '#dc2626');
  var html = '<div class="kpi-grid" style="margin-bottom:14px">'+
    '<div class="kpi-card" style="border:1.5px solid #16a34a"><div class="kpi-val" style="color:#16a34a">'+_srMoney(cCur)+'</div><div class="kpi-label"><b>Doanh thu kỳ này</b> ('+esc(p.curLabel||'')+')</div></div>'+
    '<div class="kpi-card"><div class="kpi-val">'+_srMoney(cPrev)+'</div><div class="kpi-label">Doanh thu kỳ trước ('+esc(p.prevLabel||'')+')</div></div>'+
    '<div class="kpi-card" style="border:1.5px solid '+cGrowColor+'"><div class="kpi-val" style="color:'+cGrowColor+'">'+(cGrowth===null?'—':(cGrowth>=0?'+':'')+cGrowth+'%')+'</div><div class="kpi-label">Tăng trưởng so kỳ trước</div></div>'+
  '</div>';
  html += '<div style="display:flex;gap:16px;margin-bottom:14px;font-size:12px">'+
    '<div><span style="color:var(--muted)">Kỳ này:</span> <b>'+esc(p.curLabel||'')+'</b></div>'+
    '<div><span style="color:var(--muted)">Kỳ trước:</span> <b>'+esc(p.prevLabel||'')+'</b></div>'+
    (p.curKey ? '' : '<div style="color:var(--hint)">(Kỳ tùy chỉnh — không tra được KPI, chỉ tab Tuần/Tháng/Quý mới có KPI)</div>')+
    '</div>';

  html += '<div class="dash-section-title">Theo Nhân viên (Sale bán) <span style="font-weight:400;color:var(--muted);font-size:11px">'+
    (_srState.byCreator ? '(tính trọn vẹn cho người tạo đơn — không chia đều)' : '(tiền chia đều cho số sale/đơn khi đơn có nhiều sale)')+
    '</span>'+_srViewToggleHtml('cEmpView')+'</div>';
  html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên..." value="'+esc(_srState.cEmpSearch)+'" oninput="_srState.cEmpSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
  if (_srState.cEmpView === 'table'){
    html += _srRenderCTable(d.byEmployee||[], 'sale', _srState.cEmpSearch);
  } else {
    var empRowsChart = (d.byEmployee||[]).filter(function(r){ return !_srState.cEmpSearch || r.name.toLowerCase().indexOf(_srState.cEmpSearch.toLowerCase())!==-1; });
    html += '<div style="font-size:11px;color:var(--hint);margin-bottom:4px">Vẽ theo "Kết quả kỳ này"</div>';
    html += _srChartSvg(empRowsChart, 'name', 'resultCur', _srState.cEmpView, true);
  }

  if (_srIsAdmin()){
    html += '<div class="dash-section-title">Theo Kênh bán'+_srViewToggleHtml('cKenhView')+'</div>';
    html += '<input type="text" placeholder="🔍 Tìm nhanh theo tên kênh..." value="'+esc(_srState.cKenhSearch)+'" oninput="_srState.cKenhSearch=this.value;renderSalesReportTab()" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px;width:220px;margin-bottom:6px">';
    if (_srState.cKenhView === 'table'){
      html += _srRenderCTable(d.byKenh||[], 'kenh', _srState.cKenhSearch);
    } else {
      var kenhRowsChart = (d.byKenh||[]).filter(function(r){ return !_srState.cKenhSearch || r.name.toLowerCase().indexOf(_srState.cKenhSearch.toLowerCase())!==-1; });
      html += '<div style="font-size:11px;color:var(--hint);margin-bottom:4px">Vẽ theo "Kết quả kỳ này"</div>';
      html += _srChartSvg(kenhRowsChart, 'name', 'resultCur', _srState.cKenhView, true);
    }
  }

  html += '<div style="font-size:11px;color:var(--hint);margin-top:8px">Chỉ tiêu KPI lấy từ tab "'+esc('KPI_ChiTieu')+'" trong Google Sheet CRM — tự vào Sheet điền/sửa số. Bấm vào 1 dòng để xem chi tiết đơn của kỳ này/kỳ trước.</div>';
  return html;
}

function exportSalesReportC(){
  var d = _srState.dataC;
  if (!d){ alert('Chưa có dữ liệu để xuất — bấm "Lọc" trước.'); return; }
  var p = d.period || {};
  var fDescC = [];
  fDescC.push('Lọc theo: ' + (_srState.cDateField==='thoiGianHT'?'Thời gian hoàn thành':'Ngày tạo'));
  if ((_srState.cSale||[]).length) fDescC.push('Sale: ' + _srState.cSale.join(', '));
  if ((_srState.cKenh||[]).length) fDescC.push('Kênh bán: ' + _srState.cKenh.join(', '));
  if (_srState.byCreator) fDescC.push('Tính theo người tạo đơn (không chia đều theo sale)');
  var summary = [['Kỳ này', p.curLabel], ['Kỳ trước', p.prevLabel], ['Bộ lọc', fDescC.join(' | ')]];
  var empRows = [['Nhân viên','KPI kỳ trước','Kết quả kỳ trước','%HT KPI kỳ trước','KPI kỳ này','Kết quả kỳ này','%HT KPI kỳ này','% Tăng trưởng']];
  (d.byEmployee||[]).forEach(function(r){
    empRows.push([r.name, r.kpiPrev, r.resultPrev, r.pctKpiPrev, r.kpiCur, r.resultCur, r.pctKpiCur, r.growthPct]);
  });
  var kenhRows = [['Kênh bán','KPI kỳ trước','Kết quả kỳ trước','%HT KPI kỳ trước','KPI kỳ này','Kết quả kỳ này','%HT KPI kỳ này','% Tăng trưởng']];
  (d.byKenh||[]).forEach(function(r){
    kenhRows.push([r.name, r.kpiPrev, r.resultPrev, r.pctKpiPrev, r.kpiCur, r.resultCur, r.pctKpiCur, r.growthPct]);
  });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Kỳ so sánh');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(empRows), 'Theo Nhân viên');
  if (_srIsAdmin()) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kenhRows), 'Theo Kênh bán');
  XLSX.writeFile(wb, `BaoCaoDoanhSo_C_${_ymd(new Date())}.xlsx`);
}

function _srbBuildData(key){
  var cfg = _SRB_COMBO_CFG[key];
  var raw = cfg.getOptions ? cfg.getOptions() : (_srState[cfg.optKey]||[]);
  _srbComboData[key] = (raw||[]).map(function(v){ return {value:v, label:v}; });
}
function srbComboRender(key, filter){
  var cfg = _SRB_COMBO_CFG[key];
  var list = document.getElementById(cfg.id+'-list');
  if (!list) return;
  if (!_srbComboData[key]) _srbBuildData(key);
  var q = _foldVi(filter||'');
  var sel = _srState[cfg.stateKey] || [];
  var items = q ? _srbComboData[key].filter(function(it){ return _foldVi(it.label).indexOf(q)!==-1; }) : _srbComboData[key];
  if (!items.length){ list.innerHTML = '<div class="cs-combo-empty">Không tìm thấy</div>'; _srbComboIdx[key]=-1; return; }
  list.innerHTML = items.map(function(it){
    var checked = sel.indexOf(it.value)!==-1;
    return '<div class="cs-combo-opt '+(checked?'is-sel':'')+'" data-v="'+esc(it.value)+'" onmousedown="srbComboToggleItem(\''+key+'\', event, this.getAttribute(\'data-v\'))">'+
      '<span>'+(checked?'☑':'☐')+' '+esc(it.label)+'</span></div>';
  }).join('');
  _srbComboIdx[key] = -1;
}
function srbRenderChips(key){
  var cfg = _SRB_COMBO_CFG[key];
  var wrap = document.getElementById(cfg.id+'-chips');
  if (!wrap) return;
  var sel = _srState[cfg.stateKey] || [];
  wrap.innerHTML = sel.map(function(name){
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
      esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="srbComboRemove(\''+key+'\', this.parentNode.dataset.name)">✕</span></span>';
  }).join('');
  var lbl = document.getElementById(cfg.id+'-label-count');
  if (lbl) lbl.textContent = sel.length ? ' ('+sel.length+' đã chọn)' : '';
  var clr = document.getElementById(cfg.id+'-clear');
  if (clr) clr.style.display = sel.length ? '' : 'none';
}
function srbComboOpen(key){
  _srbBuildData(key);
  var cfg = _SRB_COMBO_CFG[key];
  var ci = document.getElementById(cfg.id+'-input');
  srbComboRender(key, ci ? ci.value : '');
  var l = document.getElementById(cfg.id+'-list'); if (l) l.classList.add('open');
}
function srbComboClose(key){ var cfg=_SRB_COMBO_CFG[key]; var l=document.getElementById(cfg.id+'-list'); if(l) l.classList.remove('open'); }
function srbComboToggle(key, e){
  if (e) e.stopPropagation();
  var cfg = _SRB_COMBO_CFG[key];
  var l = document.getElementById(cfg.id+'-list'); if (!l) return;
  if (l.classList.contains('open')) srbComboClose(key);
  else { var ci=document.getElementById(cfg.id+'-input'); if(ci) ci.focus(); srbComboOpen(key); }
}
function srbComboFilter(key, v){ srbComboRender(key, v); var cfg=_SRB_COMBO_CFG[key]; var l=document.getElementById(cfg.id+'-list'); if(l) l.classList.add('open'); }
function srbComboToggleItem(key, e, value){
  if (e && e.preventDefault) e.preventDefault();
  var cfg = _SRB_COMBO_CFG[key];
  var arr = (_srState[cfg.stateKey]||[]).slice();
  var idx = arr.indexOf(value);
  if (idx!==-1) arr.splice(idx,1); else arr.push(value);
  _srState[cfg.stateKey] = arr;
  if (_srTeamFieldToSaleField_[cfg.stateKey]){ _srSyncTeamToSale_(cfg.stateKey); renderSalesReportTab(); return; }
  var ci = document.getElementById(cfg.id+'-input');
  srbComboRender(key, ci?ci.value:'');
  srbRenderChips(key);
}
function srbComboRemove(key, value){
  var cfg = _SRB_COMBO_CFG[key];
  _srState[cfg.stateKey] = (_srState[cfg.stateKey]||[]).filter(function(v){ return v!==value; });
  if (_srTeamFieldToSaleField_[cfg.stateKey]){ renderSalesReportTab(); return; }
  srbRenderChips(key);
  var l = document.getElementById(cfg.id+'-list');
  if (l && l.classList.contains('open')){ var ci=document.getElementById(cfg.id+'-input'); srbComboRender(key, ci?ci.value:''); }
}
function srbComboClear(key, e){
  if (e) e.stopPropagation();
  var cfg = _SRB_COMBO_CFG[key];
  _srState[cfg.stateKey] = [];
  if (_srTeamFieldToSaleField_[cfg.stateKey]){ renderSalesReportTab(); return; }
  var ci = document.getElementById(cfg.id+'-input'); if (ci) ci.value = '';
  srbRenderChips(key);
  var l = document.getElementById(cfg.id+'-list');
  if (l && l.classList.contains('open')) srbComboRender(key, '');
}
function srbComboKey(key, e){
  var cfg = _SRB_COMBO_CFG[key];
  var list = document.getElementById(cfg.id+'-list');
  if (!list || !list.classList.contains('open')){ if (e.key==='ArrowDown') srbComboOpen(key); return; }
  var opts = [...list.querySelectorAll('.cs-combo-opt')];
  if (!opts.length) return;
  if (e.key==='ArrowDown'){ e.preventDefault(); _srbComboIdx[key] = Math.min((_srbComboIdx[key]==null?-1:_srbComboIdx[key])+1, opts.length-1); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); _srbComboIdx[key] = Math.max((_srbComboIdx[key]==null?-1:_srbComboIdx[key])-1, 0); }
  else if (e.key==='Enter'){
    e.preventDefault();
    var idx = _srbComboIdx[key];
    var pick = (idx>=0 && opts[idx]) ? opts[idx] : (opts.length===1 ? opts[0] : null);
    if (pick) srbComboToggleItem(key, e, pick.getAttribute('data-v'));
    return;
  } else if (e.key==='Escape'){ srbComboClose(key); return; }
  else { return; }
  opts.forEach(function(o,i){ o.classList.toggle('active', i===_srbComboIdx[key]); });
  if (_srbComboIdx[key]>=0 && opts[_srbComboIdx[key]]) opts[_srbComboIdx[key]].scrollIntoView({block:'nearest'});
}
function _srbComboHTML(key){
  var cfg = _SRB_COMBO_CFG[key];
  var sel = _srState[cfg.stateKey] || [];
  var lbl = cfg.getLabel ? cfg.getLabel() : cfg.label;
  return '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label">'+esc(lbl)+'<span id="'+cfg.id+'-label-count" style="color:var(--green)">'+(sel.length?' ('+sel.length+' đã chọn)':'')+'</span></div>'+
    '<div class="cs-combo" id="'+cfg.id+'" style="width:170px">'+
    '<input type="text" id="'+cfg.id+'-input" class="cs-combo-input" placeholder="'+esc(cfg.placeholder)+'" autocomplete="off" '+
    'oninput="srbComboFilter(\''+key+'\', this.value)" onfocus="srbComboOpen(\''+key+'\')" onkeydown="srbComboKey(\''+key+'\', event)">'+
    '<button type="button" class="cs-combo-clear" id="'+cfg.id+'-clear" onclick="srbComboClear(\''+key+'\', event)" style="display:'+(sel.length?'':'none')+'">✕</button>'+
    '<span class="cs-combo-caret" onclick="srbComboToggle(\''+key+'\', event)">▾</span>'+
    '<div class="cs-combo-list" id="'+cfg.id+'-list"></div>'+
    '</div>'+
    '<div id="'+cfg.id+'-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;max-width:200px">'+
    sel.map(function(name){
      return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
        esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="srbComboRemove(\''+key+'\', this.parentNode.dataset.name)">✕</span></span>';
    }).join('') +
    '</div></div>';
}

function exportSalesReport(){
  if (_srState.sub === 'A'){
    var d = _srState.dataA;
    if (!d){ alert('Chưa có dữ liệu để xuất — bấm "Lọc" trước.'); return; }
    var fDescA = ['Lọc theo: ' + (_srState.dateField==='thoiGianHT'?'Thời gian hoàn thành':'Ngày tạo')];
    if (_srState.dateFrom || _srState.dateTo) fDescA.unshift('Khoảng ngày: ' + (_srState.dateFrom||'...') + ' → ' + (_srState.dateTo||'...'));
    if ((_srState.sale||[]).length) fDescA.push('Sale: ' + _srState.sale.join(', '));
    if ((_srState.kenh||[]).length) fDescA.push('Kênh: ' + _srState.kenh.join(', '));
    if (_srState.byCreator) fDescA.push('Tính theo người tạo đơn (không chia đều theo sale)');
    var summary = [['Bộ lọc', fDescA.join(' | ')], [],
      ['Chỉ số','Giá trị'],
      ['Số lượng đơn', d.totalOrders],
      ['Tổng tiền đã cọc/CK (tham khảo)', d.totalCoc],
      ['Trong đó: chênh lệch đơn đổi', d.totalGiaTriChenh||0],
      ['Tổng đơn (doanh thu, ko ship)', d.totalGiaTri],
      ['Trung bình đơn', d.trungBinhDon]];
    var bySaleRows = [['Sale','Số đơn','Cọc','Tổng đơn','TB đơn']];
    (d.bySale||[]).forEach(function(s){ bySaleRows.push([s.name, s.orders, s.coc, s.giaTri, s.trungBinhDon]); });
    var byTeamRows = [['Team Sale','Số đơn','Cọc','Tổng đơn','TB đơn']];
    (d.byTeamSale||[]).forEach(function(t){ byTeamRows.push([t.name, t.orders, t.coc, t.giaTri, t.trungBinhDon]); });
    var byKenhRows = [['Kênh','Số đơn','Cọc','Tổng đơn','TB đơn']];
    (d.byKenh||[]).forEach(function(k){ byKenhRows.push([k.name, k.orders, k.coc, k.giaTri, k.trungBinhDon]); });
    var byMktRows = [['MKT','Số đơn','Cọc','Tổng đơn','TB đơn']];
    (d.byMkt||[]).forEach(function(k){ byMktRows.push([k.name, k.orders, k.coc, k.giaTri, k.trungBinhDon]); });
    var detailRows = [['Ngày tạo','Thời gian hoàn thành','Kênh bán','Sale bán','Sản phẩm','Phân loại','Cọc','Giá trị đơn','Giá trị chênh lệch','Giai đoạn','Trạng thái','ID']];
    (d.orders||[]).forEach(function(o){
      detailRows.push([o.ngayTao, o.thoiGianHT, o.kenhBan, o.saleBan, o.sanPham, o.phanLoai, o.giaTriCoc, o.giaTriDon, o.giaTriChenh, o.giaiDoan, o.trangThai, o.id]);
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Tổng quan');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bySaleRows), _srState.byCreator ? 'Theo người tạo đơn' : 'Theo Sale bán');
    if (_srIsAdmin()) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byTeamRows), 'Theo Team Sale');
    if (_srIsAdmin()) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byKenhRows), 'Theo Kênh bán');
    if (_srIsAdmin()) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(byMktRows), 'Theo MKT');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), 'Chi tiết đơn');
    XLSX.writeFile(wb, `BaoCaoDoanhSo_A_${_ymd(new Date())}.xlsx`);
  } else {
    var dB = _srState.dataB;
    if (!dB){ alert('Chưa có dữ liệu để xuất — bấm "Lọc" trước.'); return; }
    var summaryB = [['Chỉ số','Giá trị'],
      ['Số lượng đơn', dB.totalOrders],
      ['Tổng giá trị sau giảm giá', dB.totalGiaTri],
      ['Tổng COD', dB.totalCod]];
    var productRows = [['Mã sản phẩm','Tên sản phẩm','Tổng số lượng']];
    (dB.products||[]).forEach(function(p){ productRows.push([p.code, p.name, p.soLuong]); });
    var bySaleRowsB = [['Sale','Số đơn','Giá trị sau giảm giá','COD']];
    (dB.bySale||[]).forEach(function(s){ bySaleRowsB.push([s.name, s.orders, s.giaTri, s.cod]); });
    var detailRowsB = [['Ngày tạo đơn','Khách hàng','SĐT','Nguồn đơn','Sale','Sản phẩm','Mã sản phẩm','Số lượng','Giá trị sau giảm','COD','Marketer']];
    (dB.orders||[]).forEach(function(o){
      detailRowsB.push([o.ngayTaoDon, o.khachHang, o.soDienThoai, o.nguonDon, o.theSale, o.sanPham, o.maSanPham, o.soLuong, o.giaTriSauGiam, o.cod, o.marketer]);
    });
    var wbB = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(summaryB), 'Tổng quan');
    XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(bySaleRowsB), 'Theo Sale');
    if (_srIsAdmin()) XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(productRows), 'Báo cáo sản phẩm');
    XLSX.utils.book_append_sheet(wbB, XLSX.utils.aoa_to_sheet(detailRowsB), 'Chi tiết đơn');
    XLSX.writeFile(wbB, `BaoCaoDoanhSo_B_${_ymd(new Date())}.xlsx`);
  }
}

function _teamMembersList(t){ return _dedupePeopleNames([...(new Set([t.leader].concat(t.members||[]).filter(Boolean)))]); }   // theo NGƯỜI: 1 người nhiều tên chỉ giữ tên chính
function _getTeamSelSet(t){
  if (!_teamAssignSel[t.id]) _teamAssignSel[t.id] = new Set(_teamMembersList(t)); // mặc định chọn hết
  return _teamAssignSel[t.id];
}
function _toggleTeamMember(teamId, member, checked){
  var t = teams.find(function(x){ return x.id===teamId; }); if (!t) return;
  var sel = _getTeamSelSet(t);
  if (checked) sel.add(member); else sel.delete(member);
  // cập nhật số "≈ KH/người" hiển thị
  if (typeof renderAssignTeam==='function') renderAssignTeam();
}
function _setTeamMembersAll(teamId, checked){
  var t = teams.find(function(x){ return x.id===teamId; }); if (!t) return;
  _teamAssignSel[t.id] = checked ? new Set(_teamMembersList(t)) : new Set();
  if (typeof renderAssignTeam==='function') renderAssignTeam();
}
function renderAssignTeam(){
  var body = document.getElementById('assign-body');
  if (!body) return;
  var pool = (typeof _getAssignPool==='function') ? _getAssignPool() : [];
  if (!teams.length){
    body.innerHTML = '<div style="color:var(--muted);padding:18px;text-align:center">Chưa có team nào. Hãy tạo team ở tab <b>Quản lý Team</b> trước.</div>';
    return;
  }
  var html = '<div style="margin-bottom:10px;font-size:13px">Tổng data sẽ chia: <b>'+fmt(pool.length)+' KH</b> '+
    '<span style="color:var(--muted)">(nhập % cho từng team; data của team sẽ chia đều cho các thành viên đã set up trong team)</span></div>';
  html += '<table class="dash-table"><thead><tr><th>Team</th><th>Thành viên</th><th style="width:120px">% nhận</th><th style="width:90px;text-align:right">≈ KH</th></tr></thead><tbody>';
  teams.forEach(function(t){
    var members = _teamMembersList(t);
    var pct = _teamAssignPct[t.id] != null ? _teamAssignPct[t.id] : 0;
    var approx = Math.round(pool.length * pct / 100);
    html += '<tr><td><span class="rank-badge" style="background:'+(t.color||'var(--green)')+';color:#fff">●</span> '+esc(t.name)+'</td>'+
      '<td style="color:var(--muted);font-size:12px">'+(members.length?members.map(esc).join(', '):'<span style="color:var(--red)">chưa có ai — set up ở Quản lý Team</span>')+'</td>'+
      '<td><input type="number" min="0" max="100" value="'+pct+'" style="width:70px" oninput="_setTeamPct(\''+t.id+'\',this.value)"> %</td>'+
      '<td style="text-align:right;font-weight:700" id="ta-approx-'+t.id+'">'+approx+'</td></tr>';
  });
  html += '</tbody></table>';
  html += '<div id="ta-total" style="margin-top:8px;font-size:12px;color:var(--muted)"></div>';
  body.innerHTML = html;
  _updateTeamAssignTotal();
}
function _setTeamPct(id, v){
  _teamAssignPct[id] = Math.max(0, Math.min(100, parseInt(v)||0));
  var pool = (typeof _getAssignPool==='function') ? _getAssignPool() : [];
  var cell = document.getElementById('ta-approx-'+id);
  if (cell) cell.textContent = Math.round(pool.length * _teamAssignPct[id] / 100);
  _updateTeamAssignTotal();
}
function _updateTeamAssignTotal(){
  var total = Object.keys(_teamAssignPct).reduce(function(s,k){ return s + (_teamAssignPct[k]||0); }, 0);
  var el = document.getElementById('ta-total');
  if (el) el.innerHTML = 'Tổng %: <b style="color:'+(total>100?'var(--red)':'var(--green)')+'">'+total+'%</b>'+(total>100?' — vượt quá 100%!':'');
}
function doAssignByTeam(){
  var pool = (typeof _getAssignPool==='function') ? _getAssignPool() : [];
  if (!pool.length){ toast('Không có data nào để chia'); return; }
  var active = teams.filter(function(t){ return (_teamAssignPct[t.id]||0) > 0; });
  if (!active.length){ toast('Hãy nhập % cho ít nhất 1 team'); return; }
  var totalPct = active.reduce(function(s,t){ return s + (_teamAssignPct[t.id]||0); }, 0);
  if (totalPct > 100){ toast('⚠ Tổng % vượt quá 100%'); return; }

  var now = new Date().toISOString().slice(0,16).replace('T',' ');
  var cursor = 0;
  var entries = [];
  active.forEach(function(t){
    var members = _teamMembersList(t);   // tất cả thành viên đã set up trong team
    if (!members.length){ return; }
    var nTeam = Math.round(pool.length * (_teamAssignPct[t.id]||0) / 100);
    var teamPhones = pool.slice(cursor, cursor + nTeam);
    cursor += nTeam;
    if (!teamPhones.length) return;
    // chia đều cho các thành viên của team
    var per = Math.floor(teamPhones.length / members.length);
    var rem = teamPhones.length % members.length;
    var mc = 0;
    members.forEach(function(m, idx){
      var take = per + (idx < rem ? 1 : 0);
      if (take === 0) return;
      var phones = teamPhones.slice(mc, mc + take);
      mc += take;
      var entry = {
        id: Date.now().toString() + '_' + Math.random().toString(36).slice(2,6),
        date: now, csName: m, phones: phones,
        label: 'Team '+t.name+' → '+m+' ('+phones.length+' KH)',
        team: t.name, donePhones: []
      };
      entries.push(entry);
      assignHistory.unshift(entry);
    });
  });
  if (!entries.length){ toast('Không chia được — các team chưa có thành viên (set up ở Quản lý Team)'); return; }
  saveLS('ome_assign_hist', assignHistory);
  _invalidateFilterCache();
  _rebuildAssignIndex();
  if (typeof _applyCareCSToAssigned === 'function') _applyCareCSToAssigned(entries);
  entries.forEach(function(e){ logAudit('assign', '', '', 'Team '+e.team+': '+e.phones.length+' KH → '+e.csName); });
  if (gsUrl && typeof pushAssignHistToGS==='function') pushAssignHistToGS();
  toast('✓ Đã chia '+cursor+' KH cho '+entries.length+' CS ('+active.length+' team)');
  if (typeof updateMyDataBadge==='function') updateMyDataBadge();
  if (typeof closeAssignModal==='function') closeAssignModal();   // chia xong tự đóng
}

function _aaDefaultCfg(){
  return {
    enabled:false,
    runHour:7,                 // giờ (VN) bắt đầu được chia trong ngày — server & trình duyệt chỉ chia khi đã qua giờ này
    teamMembers:{},            // teamId -> [tên] danh sách thành viên đã gộp 1-người-nhiều-tên, UI lưu sẵn để GAS dùng đúng
    days:[1,2,3,4,5,6],        // 0=CN,1=T2..6=T7 ; ngày không tích → KHÔNG chia
    onlyUnassigned:true,       // chỉ lấy KH chưa từng chia (tránh chia lại đúng KH cũ mỗi ngày)
    dailyTotal:0,              // tổng KH/ngày (dùng khi Team chia theo %)
    teams:{},                  // teamId -> {on, mode:'count'|'pct', val}
    memberMode:{},             // teamId -> 'pct'|'count'
    members:{},                // teamId -> {tenNV: {on, val}}
    src:{ mode:'pct', vals:{} },   // chung; vals rỗng/0 hết = lấy mọi nguồn theo tỷ lệ bằng nhau
    prio:{ mode:'pct', vals:{} },
    hang:{ mode:'pct', vals:{} },   // Phan hang KH: thuong/tt/vip/super (chua cai = khong loc theo hang)
    teamSrc:{}, teamPrio:{}, teamHang:{},   // teamId -> {mode, vals} (ghi đè)
    memberSrc:{}, memberPrio:{}, memberHang:{}, // teamId -> {tenNV: {mode, vals}} (ghi đè)
    cskhEnabled:false,         // MUC RIENG: chia data CSKH-Duyen (khong dinh ty le nguon/uu tien/hang cua POS)
    cskhDays:[1,2,3,4,5,6],
    cskhTotal:0,               // tong KH CSKH/ngay (dung khi Team chia theo %)
    cskhTeams:{}, cskhMemberMode:{}, cskhMembers:{},   // cung dang teams/memberMode/members cua POS
    lastRun:'',                // YYYY-MM-DD ngày đã chạy gần nhất
    lastResult:null
  };
}


// ═══════════════════════════════════════════════════════
//  DATA ASSIGNMENT SYSTEM — NÂNG CAO
// ═══════════════════════════════════════════════════════
let assignHistory = loadLS('ome_assign_hist') || []; // [{id, date, csName, phones[], label, donePhones[]}]
let currentAssignTab = 'create';
let _assignFilteredList = []; // phones from current filter at time of opening modal
let _assignSelectedCS = ''; // kept for compat (single)
let _myDataFilter = 'active'; // 'active' | 'done' | 'all'

// Advanced assign state
let _advAssign = {
  sourceMode: 'filter',   // 'filter' | 'count'
  customCount: 0,
  sortMode: 'default',    // 'default' | 'vip' | 'tt' | 'tn' | 'unassigned' | 'h_thuong' | 'h_tt' | 'h_vip' | 'h_super' (Phan hang KH theo doanh thu)
  dateFrom: '',           // lọc thêm theo khoảng ngày ĐƠN HÀNG (c.ymList[].ds), để trống = không giới hạn
  dateTo: '',
  srcSet: new Set(),      // lọc theo NGUỒN dữ liệu (c.dataSrc: dt|don|cs|cskh) — rỗng = mọi nguồn. Khách chưa có ngày đơn (vd CSKH-Duyên) vẫn được lấy khi đã chọn nguồn
  selectMode: 'cs',       // 'cs' (chọn CS riêng lẻ) | 'team' (chia theo Team, tỷ lệ nội bộ theo %)
  selectedCS: new Set(),  // multi select
  selectedTeams: new Set(), // multi select team id — dùng khi selectMode==='team'
  distMode: 'equal',      // 'equal' | 'custom' — áp dụng cho CS (khi selectMode='cs') hoặc Team (khi selectMode='team')
  customDist: {},         // csName|teamId -> count (số KH ở cấp phân phối trên cùng)
  customPct: {},          // teamId -> % người dùng vừa gõ (chỉ để hiển thị lại đúng số đã gõ; nguồn sự thật vẫn là customDist)
  memberDistMode: 'pct',  // 'pct' (tỷ lệ %) | 'count' (nhập số lượng cụ thể) — cách chia NỘI BỘ trong từng Team
  memberRatio: {},        // teamId -> { tenNhanVien: phanTramTyLe } — dùng khi memberDistMode==='pct'
  memberCount: {},        // teamId -> { tenNhanVien: soLuongKH } — dùng khi memberDistMode==='count'
  label: '',
};

function openAssignModal() {
  // Lấy ĐÚNG danh sách KH đang hiển thị trên bảng. KHÔNG lọc lại ở đây
  // (việc lọc lại trước đây đôi khi ra 0 và GHI ĐÈ danh sách đúng → đó là lỗi "0 KH").
  var src = (typeof window !== 'undefined' && Array.isArray(window.__omeFiltered) && window.__omeFiltered.length) ? window.__omeFiltered
          : (typeof _lastFilteredObjs !== 'undefined' && _lastFilteredObjs && _lastFilteredObjs.length) ? _lastFilteredObjs
          : (typeof _lastFilteredList !== 'undefined' && _lastFilteredList && _lastFilteredList.length) ? _lastFilteredList.map(function(ph){ return { phone: ph }; })
          : [];
  _assignFilteredList = src.map(function(c){ return c.phone; }).filter(Boolean);
  try { console.log('[ChiaData] window.__omeFiltered =', (window.__omeFiltered||[]).length, '| _lastFilteredObjs =', (typeof _lastFilteredObjs!=='undefined'&&_lastFilteredObjs)?_lastFilteredObjs.length:'n/a', '| → _assignFilteredList =', _assignFilteredList.length); } catch(e){}
  _advAssign.selectedCS = new Set();
  _advAssign.selectedTeams = new Set();
  _advAssign.selectMode = 'cs';
  _advAssign.sourceMode = 'filter';
  _advAssign.customCount = _assignFilteredList.length;
  _advAssign.distMode = 'equal';
  _advAssign.customDist = {};
  _advAssign.customPct = {};
  _advAssign.memberDistMode = 'pct';
  _advAssign.memberRatio = {};
  _advAssign.memberCount = {};
  _advAssign.sortMode = 'default';
  _advAssign.dateFrom = '';
  _advAssign.dateTo = '';
  _advAssign.srcSet = new Set();
  _advAssign.label = '';
  switchAssignTab('create', document.querySelector('.assign-tab'));
  document.getElementById('assign-modal').classList.add('open');
}
function closeAssignModal() {
  document.getElementById('assign-modal').classList.remove('open');
}
function switchAssignTab(tab, el) {
  currentAssignTab = tab;
  document.querySelectorAll('.assign-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const footer = document.getElementById('assign-footer');
  if (tab === 'create') {
    footer.innerHTML = '<button class="btn" onclick="closeAssignModal()">Đóng</button><button class="btn primary" onclick="doAssignDataAdvanced()">✓ Xác nhận chia</button>';
    renderAssignCreate();
  } else if (tab === 'history') {
    footer.innerHTML = '<button class="btn" onclick="closeAssignModal()">Đóng</button>';
    renderAssignHistory();
  } else {
    footer.innerHTML = '<button class="btn" onclick="closeAssignModal()">Đóng</button>';
    renderAssignReport();
  }
}

// ── Lọc thêm theo khoảng ngày ĐƠN HÀNG (để trống dateFrom/dateTo = không lọc) — áp dụng TRƯỚC
// mọi bước khác (nguồn, ưu tiên lấy, phân phối), dùng cùng field c.ymList[].ds ('YYYY-MM-DD')
// như bộ lọc chính của bảng Danh sách KH, nhưng tách riêng để không phụ thuộc bộ lọc đang bật
// trên bảng — admin có thể mở modal rồi tự chọn khoảng ngày khác ngay trong Chia data.
function _advAssignValidBase() { return (_assignFilteredList || []).filter(isValidVnPhone); }   // chỉ SĐT di động VN hợp lệ
function _advAssignDateFilteredList() {
  var _base = _advAssignValidBase();
  var hasSrc = _advAssign.srcSet && _advAssign.srcSet.size > 0;
  var hasDate = !!(_advAssign.dateFrom || _advAssign.dateTo);
  if (!hasSrc && !hasDate) return _base;
  // NGUYÊN NHÂN GỐC (đã sửa 2026-10-07): trước đây tra customerMap[p] — object THÔ (chỉ có orders), KHÔNG có
  // ymList (ymList chỉ tính sẵn trên các phần tử allCustomers trong buildCustomers) → luôn undefined → mọi KH bị
  // loại → khoảng ngày nào cũng ra "0 KH". Dùng _assignCustMap() (Map SĐT → phần tử allCustomers).
  var _cm = _assignCustMap();
  return _base.filter(function (p) {
    var c = _cm.get(p);
    if (!c) return false;
    if (hasSrc) {
      var d = c.dataSrc || {}, ok = false;
      _advAssign.srcSet.forEach(function (k) { if (d[k]) ok = true; });
      if (!ok) return false;
    }
    if (!hasDate) return true;
    var yl = c.ymList || [];
    // Khách KHÔNG có ngày đơn nào (vd nguồn CSKH-Duyên): khoảng ngày không áp dụng được → khi đã chọn nguồn
    // thì cứ chia theo nguồn; chưa chọn nguồn thì vẫn loại như cũ.
    // NGUYEN NHAN GOC (da sua 2026-10-10): truoc day KH POS (dt/don/cs) KHONG co ngay don van lot qua khi da chon nguon -> chia "khach thang 9" bi lan khach khong ro ngay.
    // Nay chi KH thuoc nguon CSKH-Duyen (khong co ngay don) moi duoc miễn loc ngay, va chi khi CSKH nam trong nguon da chon.
    if (!yl.some(function (o) { return o.ds; })) return hasSrc && _advAssign.srcSet.has('cskh') && !!(c.dataSrc && c.dataSrc.cskh);
    return yl.some(function (o) {
      if (!o.ds) return false;
      if (_advAssign.dateFrom && o.ds < _advAssign.dateFrom) return false;
      if (_advAssign.dateTo && o.ds > _advAssign.dateTo) return false;
      return true;
    });
  });
}

// Chọn / bỏ chọn 1 nguồn dữ liệu trong modal Chia data
// Chien dich: 1 = POS/Base (DT tong + Du lieu don + Cham soc), 2 = CSKH-Duyen (rieng). Bam lai de bo chon.
function _advAssignCampaign(key) {
  var want = key === 'pos' ? ['dt', 'don', 'cs'] : ['cskh'];
  var cur = _advAssign.srcSet, same = cur.size === want.length && want.every(function (k) { return cur.has(k); });
  _advAssign.srcSet = same ? new Set() : new Set(want);
  renderAssignCreate();
}
function _advAssignToggleSrc(k) {
  if (_advAssign.srcSet.has(k)) _advAssign.srcSet.delete(k); else _advAssign.srcSet.add(k);
  renderAssignCreate();
}
// Mo "Lọc nâng cao" (bộ lọc CS/sản phẩm/nguồn/trạng thái CS-Zalo/trường tự tạo...) ngay TỪ BÊN
// TRONG modal Chia data, khỏi phải đóng Chia data ra ngoài rồi mở lại. Khi đóng Lọc nâng cao
// (dù Áp dụng hay Đóng) sẽ tự quay lại đây và làm mới "Bộ lọc hiện tại" — xem closeAdvModal().
function _advAssignOpenAdvFilter() {
  const am = document.getElementById('assign-modal');
  if (am) am.classList.remove('open');
  _advAssignReopenAfterFilter = true;
  openAdvModal();
}
// Khoảng ngày nhanh (Hôm nay, Hôm qua, Tuần này/trước, Tháng này/trước, Quý này/trước, Năm nay/trước). Tuần bắt đầu thứ Hai.
function _advAssignPreset(key) {
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  var y = t.getFullYear(), m = t.getMonth(), a, b;
  var dow = (t.getDay() + 6) % 7; // 0 = Thứ Hai
  if (key === 'today') { a = b = t; }
  else if (key === 'yesterday') { a = b = new Date(y, m, t.getDate() - 1); }
  else if (key === 'thisweek') { a = new Date(y, m, t.getDate() - dow); b = new Date(y, m, t.getDate() - dow + 6); }
  else if (key === 'lastweek') { a = new Date(y, m, t.getDate() - dow - 7); b = new Date(y, m, t.getDate() - dow - 1); }
  else if (key === 'month') { a = new Date(y, m, 1); b = new Date(y, m + 1, 0); }
  else if (key === 'lastmonth') { a = new Date(y, m - 1, 1); b = new Date(y, m, 0); }
  else if (key === 'quarter') { var q = Math.floor(m / 3) * 3; a = new Date(y, q, 1); b = new Date(y, q + 3, 0); }
  else if (key === 'lastquarter') { var q2 = Math.floor(m / 3) * 3 - 3; a = new Date(y, q2, 1); b = new Date(y, q2 + 3, 0); }
  else if (key === 'year') { a = new Date(y, 0, 1); b = new Date(y, 11, 31); }
  else if (key === 'lastyear') { a = new Date(y - 1, 0, 1); b = new Date(y - 1, 11, 31); }
  else return;
  _advAssign.dateFrom = iso(a); _advAssign.dateTo = iso(b);
  renderAssignCreate();
}

// ── CACHE TRA CUU NHANH CHO CHIA DATA ─────────────────────────────────────────────────────────
// NGUYEN NHAN LAG (da sua): sau khi them nguon CSKH-Duyen (~134k KH), moi lan bam BAT KY nut nao trong
// modal Chia data (renderAssignCreate) / go so luong (_getAssignPool) deu chay cac vong lap BAC HAI tren
// toan bo danh sach: allCustomers.find(...) cho TUNG SDT, va assignHistory.some(h => h.phones.includes(p))
// (wasEverAssigned) cho TUNG SDT, cong them dung lai tap CS tu toan bo KH (_buildCsSet_ moi KH) o MOI lan ve.
// Nay dung Map/Set dung chung, chi dung lai khi allCustomers hoac assignHistory thuc su doi.
var _asgCache = { custRef:null, custLen:-1, custMap:null, histSig:null, everSet:null, csRef:null, csLen:-1, csDV:-1, csList:null };
function _assignCustMap(){
  if (_asgCache.custMap && _asgCache.custRef === allCustomers && _asgCache.custLen === allCustomers.length) return _asgCache.custMap;
  var m = new Map();
  for (var i = 0; i < allCustomers.length; i++) m.set(allCustomers[i].phone, allCustomers[i]);
  _asgCache.custRef = allCustomers; _asgCache.custLen = allCustomers.length; _asgCache.custMap = m;
  return m;
}
function _everAssignedSet(){
  var sig = (assignHistory || []).map(function(h){ return h.id + ':' + (h.phones ? h.phones.length : 0); }).join(',');
  if (_asgCache.everSet && _asgCache.histSig === sig) return _asgCache.everSet;
  var set = new Set();
  (assignHistory || []).forEach(function(h){ (h.phones || []).forEach(function(p){ set.add(p); }); });
  _asgCache.histSig = sig; _asgCache.everSet = set;
  return set;
}
function _assignAllCSNames(){
  // csSet/careCSSet da tinh san trong buildCustomers — khong goi lai _buildCsSet_ cho tung KH moi lan ve modal
  if (_asgCache.csList && _asgCache.csRef === allCustomers && _asgCache.csLen === allCustomers.length && _asgCache.csDV === _dataVersion) return _asgCache.csList;
  var names = new Set();
  for (var i = 0; i < allCustomers.length; i++) {
    var c = allCustomers[i];
    if (c.csSet) c.csSet.forEach(function(n){ if (n) names.add(n); });
    if (c.careCSSet) c.careCSSet.forEach(function(n){ if (n) names.add(n); });
  }
  var list = [...names].sort();
  _asgCache.csRef = allCustomers; _asgCache.csLen = allCustomers.length; _asgCache.csDV = _dataVersion; _asgCache.csList = list;
  return list;
}

// ── Helper: get sorted pool based on advAssign settings ──
function _getAssignPool() {
  let pool = [..._advAssignDateFilteredList()];
  if (_advAssign.sortMode === 'unassigned') {
    pool = pool.filter(p => !wasEverAssigned(p));
  } else if (/^h_(thuong|tt|vip|super)$/.test(_advAssign.sortMode)) {
    const _hangWant = _advAssign.sortMode.slice(2);   // Phan hang KH (doanh thu): lay dung hang duoc chon
    const _cmH = _assignCustMap();
    pool = pool.filter(p => { const c = _cmH.get(p); return c && c.hangKey === _hangWant; });
  } else if (_advAssign.sortMode === 'vip' || _advAssign.sortMode === 'tt' || _advAssign.sortMode === 'tn') {
    const _tierWant = _advAssign.sortMode === 'vip' ? 'VIP' : (_advAssign.sortMode === 'tt' ? 'Thân thiết' : 'Tiềm năng');
    const _cm = _assignCustMap();
    pool = pool.filter(p => { const c = _cm.get(p); return c && c.tier === _tierWant; });
  }
  if (_advAssign.sourceMode === 'count') {
    const n = Math.min(parseInt(_advAssign.customCount) || 0, pool.length);
    pool = pool.slice(0, n);
  }
  return pool;
}

// ── Compute distribution of pool among selected CS ──
function _computeDist(pool, csList) {
  const n = pool.length;
  const k = csList.length;
  if (k === 0 || n === 0) return {};
  if (_advAssign.distMode === 'equal') {
    const base = Math.floor(n / k);
    const extra = n % k;
    const dist = {};
    csList.forEach((cs, i) => { dist[cs] = base + (i < extra ? 1 : 0); });
    return dist;
  } else {
    // custom — return saved values (clamped)
    const dist = {};
    let total = 0;
    csList.forEach(cs => {
      const v = Math.max(0, parseInt(_advAssign.customDist[cs]) || 0);
      dist[cs] = v;
      total += v;
    });
    return dist;
  }
}

// ── Chia 1 lượng KH (đã phân cho 1 Team) cho các thành viên trong Team đó THEO TỶ LỆ % ──
// ratioMap: { tenNhanVien: phanTram }. Nếu TẤT CẢ đều rỗng/0 (chưa ai thiết lập) → chia đều.
// Dùng phương pháp "số dư lớn nhất" (largest remainder) để tổng các phần làm tròn luôn khớp
// đúng total, không bị lệch 1-2 KH do làm tròn từng người riêng lẻ.
function _computeMemberRatioDist(total, members, ratioMap) {
  if (!members || !members.length || total <= 0) return {};
  ratioMap = ratioMap || {};
  let pcts = members.map(m => Math.max(0, Number(ratioMap[m]) || 0));
  let sum = pcts.reduce((a, b) => a + b, 0);
  if (sum <= 0) { pcts = members.map(() => 100 / members.length); sum = 100; }
  const raw = pcts.map(p => total * p / sum);
  const floors = raw.map(Math.floor);
  const used = floors.reduce((a, b) => a + b, 0);
  let remainder = total - used;
  const order = raw.map((_, i) => i).sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  const dist = {};
  members.forEach((m, i) => { dist[m] = floors[i]; });
  for (let k = 0; k < remainder && k < order.length; k++) { dist[members[order[k]]]++; }
  return dist;
}

// ── Chia 1 lượng KH (đã phân cho 1 Team) cho các thành viên THEO SỐ LƯỢNG CỤ THỂ do admin tự
// nhập (countMap: { tenNhanVien: soLuong }) — KHÔNG tự chia đều, chỉ đọc đúng số đã nhập (clamp
// về 0 nếu âm/rỗng). Dùng khi _advAssign.memberDistMode === 'count'.
function _computeMemberCountDist(members, countMap) {
  const dist = {};
  (members || []).forEach(m => { dist[m] = Math.max(0, parseInt((countMap || {})[m]) || 0); });
  return dist;
}

function renderAssignCreate() {
  // TỰ CHỮA: nếu danh sách rỗng nhưng bảng đang hiển thị có KH → lấy lại NGAY từ bảng (nguồn sự thật)
  if ((!_assignFilteredList || !_assignFilteredList.length)
      && typeof window !== 'undefined' && Array.isArray(window.__omeFiltered) && window.__omeFiltered.length) {
    _assignFilteredList = window.__omeFiltered.map(function(c){ return c && c.phone; }).filter(Boolean);
    _advAssign.customCount = _assignFilteredList.length;
  }
  const allCS = _assignAllCSNames();

  const dateFilteredList = _advAssignDateFilteredList();
  const totalFiltered = dateFilteredList.length;
  const pool = _getAssignPool();
  const isTeamMode = _advAssign.selectMode === 'team';
  const csList = [..._advAssign.selectedCS];
  const teamIds = [..._advAssign.selectedTeams];
  const dist = _computeDist(pool, csList);
  const distTotal = Object.values(dist).reduce((s,v)=>s+v,0);
  const remaining = pool.length - distTotal;
  const selectedCount = isTeamMode ? teamIds.length : csList.length;

  // 1 vong duy nhat (O(N)) thay vi 2 lan filter x wasEverAssigned x allCustomers.find (O(N^2))
  const _everSet = _everAssignedSet();
  const _custMap = _assignCustMap();
  let alreadyAssigned = { length: 0 }, neverAssigned = { length: 0 };
  const tierCount = { VIP:0, 'Thân thiết':0, 'Tiềm năng':0, other:0 };
  const hangCount = { thuong:0, tt:0, vip:0, super:0 };
  const srcCount = { dt:0, don:0, cs:0, cskh:0 };
  _assignFilteredList.forEach(p => {
    const d = _custMap.get(p)?.dataSrc;
    if (d) { if (d.dt) srcCount.dt++; if (d.don) srcCount.don++; if (d.cs) srcCount.cs++; if (d.cskh) srcCount.cskh++; }
  });
  dateFilteredList.forEach(p => {
    if (_everSet.has(p)) alreadyAssigned.length++; else neverAssigned.length++;
    const c = _custMap.get(p);
    const t = c?.tier || 'other';
    if (tierCount[t] !== undefined) tierCount[t]++; else tierCount.other++;
    hangCount[(c && c.hangKey) || 'thuong']++;
  });

  const html = `
  <!-- STEP 1: SOURCE -->
  <div class="assign-section">
    <div class="assign-section-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>① Nguồn data</span>
      <button class="btn sm secondary" onclick="_advAssignOpenAdvFilter()" title="Mở Lọc nâng cao (CS, sản phẩm, nguồn, trạng thái CS/Zalo, trường tự tạo...) để chọn đúng data muốn chia">⚙ Lọc nâng cao${countAdvFilters()>0?` <span class="adv-filter-active-badge">${countAdvFilters()}</span>`:''}</button>
    </div>
    <div class="assign-preview" style="margin-bottom:10px">
      Bộ lọc hiện tại: <strong>${totalFiltered} KH</strong>${(_assignFilteredList.length - _advAssignValidBase().length) > 0 ? ` <span style="color:#92400e;font-size:11px" title="Chỉ chia SĐT di động Việt Nam hợp lệ (10 số, đầu số 03/05/07/08/09)">(đã loại ${_assignFilteredList.length - _advAssignValidBase().length} SĐT không hợp lệ)</span>` : ''} &nbsp;|&nbsp;
      <span style="color:var(--vip)">VIP: ${tierCount.VIP}</span> &nbsp;·&nbsp;
      <span style="color:var(--tt)">Thân thiết: ${tierCount['Thân thiết']}</span> &nbsp;·&nbsp;
      <span style="color:var(--tn)">Tiềm năng: ${tierCount['Tiềm năng']}</span><br>
      <span style="color:var(--muted)">Phân hạng KH (doanh thu): ${HANG_KEYS.map(k=>`${HANG_LABEL[k]} ${hangCount[k]}`).join(' &nbsp;·&nbsp; ')}</span><br>
      <span style="color:var(--green)">✓ Chưa chia: <strong>${neverAssigned.length}</strong></span> &nbsp;|&nbsp;
      <span style="color:#92400e">⚠ Đã chia: <strong>${alreadyAssigned.length}</strong></span>
      ${totalFiltered === 0 ? '<br><span style="color:var(--red)">⚠ Không có KH nào khớp (bộ lọc bảng + nguồn + khoảng ngày bên dưới). Hãy xoá bớt bộ lọc / nới khoảng ngày / đổi nguồn rồi thử lại.</span>' : ''}
    </div>

    <div style="font-size:11px;color:var(--muted);margin-bottom:5px;font-weight:500">Chiến dịch <span style="font-weight:400">(chọn nhanh nguồn; chia lần lượt từng chiến dịch):</span></div>
    <div class="assign-sort-row" style="margin-bottom:10px">
      <div class="assign-sort-btn ${(_advAssign.srcSet.size===3&&['dt','don','cs'].every(k=>_advAssign.srcSet.has(k)))?'active':''}" onclick="_advAssignCampaign('pos')">① POS / Base (DT tổng + Dữ liệu đơn + Chăm sóc)</div>
      <div class="assign-sort-btn ${(_advAssign.srcSet.size===1&&_advAssign.srcSet.has('cskh'))?'active':''}" onclick="_advAssignCampaign('cskh')">② CSKH-Duyên — chiến dịch riêng (${srcCount.cskh})</div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:5px;font-weight:500">Nguồn dữ liệu <span style="font-weight:400">(bấm để chọn, chọn được nhiều — không chọn = mọi nguồn; khách chưa có ngày đơn như CSKH-Duyên vẫn lấy theo nguồn)</span>:</div>
    <div class="assign-sort-row" style="margin-bottom:10px">
      ${[['dt','DT tổng'],['don','Dữ liệu đơn'],['cs','Chăm sóc'],['cskh','CSKH-Duyên']].map(([k,l])=>`<div class="assign-sort-btn ${_advAssign.srcSet.has(k)?'active':''}" onclick="_advAssignToggleSrc('${k}')">${l} (${srcCount[k]})</div>`).join('')}
    </div>

    <div style="font-size:11px;color:var(--muted);margin-bottom:5px;font-weight:500">Khoảng thời gian lấy data <span style="font-weight:400">(theo ngày đơn hàng — để trống = không giới hạn)</span>:</div>
    <div class="assign-sort-row" style="margin-bottom:6px">
      ${[['today','Hôm nay'],['yesterday','Hôm qua'],['thisweek','Tuần này'],['lastweek','Tuần trước'],['month','Tháng này'],['lastmonth','Tháng trước'],['quarter','Quý này'],['lastquarter','Quý trước'],['year','Năm nay'],['lastyear','Năm trước']].map(([k,l])=>`<div class="assign-sort-btn" onclick="_advAssignPreset('${k}')">${l}</div>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <input type="date" class="assign-input" style="width:auto" value="${esc(_advAssign.dateFrom||'')}" onchange="_advAssign.dateFrom=this.value;renderAssignCreate()" title="Từ ngày">
      <span style="color:var(--muted)">→</span>
      <input type="date" class="assign-input" style="width:auto" value="${esc(_advAssign.dateTo||'')}" onchange="_advAssign.dateTo=this.value;renderAssignCreate()" title="Đến ngày">
      ${(_advAssign.dateFrom || _advAssign.dateTo) ? `<button class="btn sm" onclick="_advAssign.dateFrom='';_advAssign.dateTo='';renderAssignCreate()">✕ Xoá khoảng ngày</button>` : ''}
    </div>

    <div style="font-size:11px;color:var(--muted);margin-bottom:5px;font-weight:500">Lấy từ:</div>
    <div class="assign-mode-row">
      <div class="assign-mode-btn ${_advAssign.sourceMode==='filter'?'active':''}" onclick="_advAssign.sourceMode='filter';renderAssignCreate()">
        📋 Toàn bộ bộ lọc <span style="font-size:10px;display:block;font-weight:400;margin-top:2px">${totalFiltered} khách hàng</span>
      </div>
      <div class="assign-mode-btn ${_advAssign.sourceMode==='count'?'active':''}" onclick="_advAssign.sourceMode='count';renderAssignCreate()">
        🔢 Chọn số lượng <span style="font-size:10px;display:block;font-weight:400;margin-top:2px">Nhập tay số KH</span>
      </div>
    </div>

    ${_advAssign.sourceMode==='count' ? `
    <div class="assign-qty-row" style="margin-top:6px">
      <span style="font-size:12px;color:var(--muted)">Số lượng KH muốn chia:</span>
      <input class="assign-qty-input" type="number" min="1" max="${totalFiltered}" value="${Math.min(_advAssign.customCount||totalFiltered,totalFiltered)}"
        oninput="_advAssign.customCount=this.value;renderAssignDistPreview()">
      <span style="font-size:11px;color:var(--hint)">/ ${totalFiltered} KH</span>
    </div>` : ''}

    <div style="font-size:11px;color:var(--muted);margin-bottom:5px;margin-top:10px;font-weight:500">Ưu tiên lấy:</div>
    <div class="assign-sort-row">
      ${[
        ['default','Mặc định (theo bộ lọc)'],
        ['unassigned','Chưa chia lần nào'],
        ['vip',`VIP (${tierCount.VIP})`],
        ['tt',`Thân thiết (${tierCount['Thân thiết']})`],
        ['tn',`Tiềm năng (${tierCount['Tiềm năng']})`],
        ['h_thuong',`Hạng: Khách thường (${hangCount.thuong})`],
        ['h_tt',`Hạng: Ưu tiên (${hangCount.tt})`],
        ['h_vip',`Hạng: Vip (${hangCount.vip})`],
        ['h_super',`Hạng: Super VVip (${hangCount.super})`]
      ].map(([k,l])=>`<div class="assign-sort-btn ${_advAssign.sortMode===k?'active':''}" onclick="_advAssign.sortMode='${k}';renderAssignCreate()">${l}</div>`).join('')}
    </div>
  </div>

  <!-- STEP 2: CS / TEAM SELECTION -->
  <div class="assign-section">
    <div class="assign-section-title">② Chọn nơi nhận data</div>
    <div class="assign-mode-row" style="margin-bottom:10px">
      <div class="assign-mode-btn ${!isTeamMode?'active':''}" onclick="_advAssign.selectMode='cs';renderAssignCreate()">
        👤 CS riêng lẻ <span style="font-size:10px;display:block;font-weight:400;margin-top:2px">Chọn từng người</span>
      </div>
      <div class="assign-mode-btn ${isTeamMode?'active':''}" onclick="_advAssign.selectMode='team';renderAssignCreate()">
        👥 Theo Team <span style="font-size:10px;display:block;font-weight:400;margin-top:2px">Chia tỷ lệ % cho từng người trong Team</span>
      </div>
    </div>

    ${!isTeamMode ? `
    <div style="font-size:10px;font-weight:400;color:var(--muted);margin-bottom:6px">(gõ tên để tìm, bấm để chọn — chọn được nhiều CS)</div>
    <input class="assign-input" id="assign-cs-search" placeholder="🔍 Gõ tên CS để tìm nhanh..." style="width:100%;margin-bottom:8px;box-sizing:border-box"
      oninput="_filterAssignCSChips(this.value)">
    <div class="assign-cs-list" id="assign-cs-chips" style="margin-bottom:8px">
      ${allCS.map(cs => `<div class="assign-cs-chip-multi ${_advAssign.selectedCS.has(cs)?'selected':''}" data-cs="${esc(cs)}" onclick="_advAssignToggleCS(this.dataset.cs)">${esc(cs)}</div>`).join('')}
      ${allCS.length===0?'<span style="color:var(--hint);font-size:12px">Chưa có CS trong hệ thống</span>':''}
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;color:var(--muted)">Thêm CS mới:</span>
      <input class="assign-input" id="assign-cs-manual" placeholder="Nhập tên CS rồi Enter..." style="flex:1"
        onkeydown="if(event.key==='Enter'){_advAssignAddManual(this.value);this.value='';}">
      <button class="btn sm" onclick="_advAssignAddManual(document.getElementById('assign-cs-manual').value);document.getElementById('assign-cs-manual').value=''">Thêm</button>
    </div>
    ${_advAssign.selectedCS.size===0?'<div style="font-size:11px;color:var(--hint);margin-top:6px">⬆ Chọn ít nhất 1 CS</div>':''}
    ` : `
    <div style="font-size:10px;font-weight:400;color:var(--muted);margin-bottom:6px">(bấm để chọn Team — chọn được nhiều Team, tỷ lệ % cho từng thành viên nhập ở bước ③ bên dưới)</div>
    <div class="assign-cs-list" id="assign-team-chips" style="margin-bottom:8px">
      ${teams.map(t => `<div class="assign-cs-chip-multi ${_advAssign.selectedTeams.has(t.id)?'selected':''}" data-team="${esc(t.id)}" onclick="_advAssignToggleTeam(this.dataset.team)">${esc(t.name)} <span style="opacity:.6">(${(t.members||[]).length})</span></div>`).join('')}
      ${teams.length===0?'<span style="color:var(--hint);font-size:12px">Chưa có Team nào — vào tab "Quản lý Team" để tạo Team trước.</span>':''}
    </div>
    ${_advAssign.selectedTeams.size===0?'<div style="font-size:11px;color:var(--hint);margin-top:6px">⬆ Chọn ít nhất 1 Team</div>':''}
    `}
  </div>

  <!-- STEP 3: DISTRIBUTION -->
  ${selectedCount > 0 ? `
  <div class="assign-section">
    <div class="assign-section-title">③ Phân phối data</div>
    <div class="assign-mode-row" style="margin-bottom:10px">
      <div class="assign-mode-btn ${_advAssign.distMode==='equal'?'active':''}" onclick="_advAssign.distMode='equal';renderAssignCreate()">
        ⚖ Chia đều <span style="font-size:10px;display:block;font-weight:400;margin-top:2px">~${Math.ceil(pool.length/Math.max(selectedCount,1))} KH/${isTeamMode?'Team':'CS'}</span>
      </div>
      <div class="assign-mode-btn ${_advAssign.distMode==='custom'?'active':''}" onclick="_advAssign.distMode='custom';renderAssignCreate()">
        ✏ Tuỳ chỉnh từng ${isTeamMode?'Team':'CS'} <span style="font-size:10px;display:block;font-weight:400;margin-top:2px">Nhập số KH cho mỗi ${isTeamMode?'team':'người'}</span>
      </div>
    </div>
    <div id="assign-dist-preview">
      ${isTeamMode ? _renderTeamDistTable(pool, teamIds) : _renderDistTable(pool, csList, dist, distTotal, remaining)}
    </div>
  </div>` : ''}

  <!-- STEP 4: LABEL -->
  <div class="assign-section">
    <div class="assign-section-title">④ Ghi chú đợt chia (tuỳ chọn)</div>
    <input class="assign-input" id="assign-label" placeholder="VD: VIP tháng 6, Tiềm năng Q2..." style="width:100%" value="${esc(_advAssign.label||'')}" oninput="_advAssign.label=this.value">
  </div>`;

  document.getElementById('assign-body').innerHTML = html;
}

function _renderDistTable(pool, csList, dist, distTotal, remaining) {
  if (csList.length === 0) return '';
  const totalPool = pool.length;
  if (_advAssign.distMode === 'equal') {
    return `
    <table class="assign-dist-table">
      <thead><tr><th>CS</th><th style="text-align:right">Số KH nhận</th><th style="min-width:120px">Tỷ lệ</th></tr></thead>
      <tbody>
        ${csList.map(cs=>{
          const n = dist[cs]||0;
          const pct = totalPool > 0 ? Math.round(n/totalPool*100) : 0;
          return `<tr>
            <td><strong>${esc(cs)}</strong></td>
            <td style="text-align:right;font-weight:700;color:var(--green)">${n}</td>
            <td><div class="assign-dist-bar"><div class="assign-dist-fill" style="width:${pct}%"></div></div><span style="font-size:10px;color:var(--muted)">${pct}%</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
      <span class="assign-remaining-badge ok">✓ ${totalPool} KH sẽ được chia cho ${csList.length} CS</span>
    </div>`;
  } else {
    // Custom mode
    const rem = totalPool - distTotal;
    const remClass = rem === 0 ? 'ok' : rem > 0 ? 'warn' : 'err';
    const remText = rem === 0 ? `✓ Đã phân đủ ${totalPool} KH` : rem > 0 ? `Còn ${rem} KH chưa phân` : `⚠ Vượt quá ${-rem} KH`;
    return `
    <table class="assign-dist-table">
      <thead><tr><th>CS</th><th style="text-align:center">Số KH</th><th style="min-width:120px">Tỷ lệ</th><th></th></tr></thead>
      <tbody>
        ${csList.map(cs=>{
          const n = dist[cs]||0;
          const pct = totalPool > 0 ? Math.round(n/totalPool*100) : 0;
          return `<tr>
            <td><strong>${esc(cs)}</strong></td>
            <td style="text-align:center"><input class="assign-dist-input" type="number" min="0" max="${totalPool}" value="${n}" data-cs="${esc(cs)}"
              oninput="_advAssign.customDist[this.dataset.cs]=parseInt(this.value)||0;_refreshDistPreview()"></td>
            <td><div class="assign-dist-bar"><div class="assign-dist-fill" style="width:${pct}%"></div></div><span style="font-size:10px;color:var(--muted)">${pct}%</span></td>
            <td style="white-space:nowrap;font-size:11px;color:var(--green);font-weight:600">${n} KH</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="assign-remaining-badge ${remClass}" id="assign-rem-badge">${remText}</span>
      <button class="btn sm" onclick="_autoFillRemaining()">🔄 Tự động phân phần còn lại</button>
    </div>`;
  }
}

function _refreshDistPreview() {
  const pool = _getAssignPool();
  const el = document.getElementById('assign-dist-preview');
  if (!el) return;
  if (_advAssign.selectMode === 'team') {
    el.innerHTML = _renderTeamDistTable(pool, [..._advAssign.selectedTeams]);
  } else {
    const csList = [..._advAssign.selectedCS];
    const dist = _computeDist(pool, csList);
    const distTotal = Object.values(dist).reduce((s,v)=>s+v,0);
    const remaining = pool.length - distTotal;
    el.innerHTML = _renderDistTable(pool, csList, dist, distTotal, remaining);
  }
}

function renderAssignDistPreview() {
  _refreshDistPreview();
}

// Dùng chung cho cả 2 chế độ: keyList là csList (chế độ CS) hoặc teamIds (chế độ Team) — hàm
// _computeDist/customDist không quan tâm ý nghĩa của key, chỉ cần key trùng với key render ra.
function _autoFillRemaining() {
  const pool = _getAssignPool();
  const keyList = _advAssign.selectMode === 'team' ? [..._advAssign.selectedTeams] : [..._advAssign.selectedCS];
  if (!keyList.length) return;
  const used = keyList.reduce((s,k) => s + (parseInt(_advAssign.customDist[k])||0), 0);
  const rem = pool.length - used;
  if (rem <= 0) { toast('Đã phân đủ rồi!'); return; }
  const base = Math.floor(rem / keyList.length);
  const extra = rem % keyList.length;
  keyList.forEach((k, i) => {
    _advAssign.customDist[k] = (parseInt(_advAssign.customDist[k])||0) + base + (i < extra ? 1 : 0);
  });
  _refreshDistPreview();
}

function _advAssignToggleCS(cs) {
  if (_advAssign.selectedCS.has(cs)) {
    _advAssign.selectedCS.delete(cs);
    delete _advAssign.customDist[cs];
  } else {
    _advAssign.selectedCS.add(cs);
  }
  renderAssignCreate();
}

function _advAssignAddManual(val) {
  const name = val.trim();
  if (!name) return;
  _advAssign.selectedCS.add(name);
  renderAssignCreate();
}

function _advAssignToggleTeam(teamId) {
  if (_advAssign.selectedTeams.has(teamId)) {
    _advAssign.selectedTeams.delete(teamId);
    delete _advAssign.customDist[teamId];
    delete _advAssign.customPct[teamId];
    delete _advAssign.memberRatio[teamId];
    delete _advAssign.memberCount[teamId];
  } else {
    _advAssign.selectedTeams.add(teamId);
  }
  renderAssignCreate();
}

// Sửa tỷ lệ % nhận data của 1 thành viên trong 1 Team (đọc data-team/data-member thay vì nhúng
// tên trực tiếp vào chuỗi onclick, tránh lỗi khi tên có dấu nháy/ký tự đặc biệt)
function _advAssignSetMemberRatio(el) {
  const teamId = el.dataset.team, member = el.dataset.member;
  if (!teamId || !member) return;
  if (!_advAssign.memberRatio[teamId]) _advAssign.memberRatio[teamId] = {};
  _advAssign.memberRatio[teamId][member] = parseFloat(el.value) || 0;
  _refreshDistPreview();
}

// Sửa SỐ LƯỢNG KH cụ thể nhận của 1 thành viên trong 1 Team (dùng khi memberDistMode==='count')
function _advAssignSetMemberCount(el) {
  const teamId = el.dataset.team, member = el.dataset.member;
  if (!teamId || !member) return;
  if (!_advAssign.memberCount[teamId]) _advAssign.memberCount[teamId] = {};
  _advAssign.memberCount[teamId][member] = Math.max(0, parseInt(el.value) || 0);
  _refreshDistPreview();
}

// Tự động chia hết phần KH CÒN LẠI của 1 Team (ở chế độ nhập số lượng cụ thể) cho các thành
// viên CHƯA được gán hoặc gán 0 — chia đều phần dư, giống _autoFillRemaining nhưng khoanh vùng
// trong phạm vi 1 Team thay vì toàn bộ danh sách CS/Team.
function _advAssignAutoFillTeamMembers(teamId) {
  const team = teams.find(t => t.id === teamId);
  const members = _dedupePeopleNames((team && team.members) || []);   // 1 người nhiều tên chỉ nhận 1 phần
  if (!members.length) return;
  const pool = _getAssignPool();
  const teamDist = _computeDist(pool, [..._advAssign.selectedTeams]);
  const teamCount = teamDist[teamId] || 0;
  if (!_advAssign.memberCount[teamId]) _advAssign.memberCount[teamId] = {};
  const cm = _advAssign.memberCount[teamId];
  const used = members.reduce((s, m) => s + (parseInt(cm[m]) || 0), 0);
  const rem = teamCount - used;
  if (rem <= 0) { toast('Team này đã phân đủ rồi!'); return; }
  const base = Math.floor(rem / members.length);
  const extra = rem % members.length;
  members.forEach((m, i) => { cm[m] = (parseInt(cm[m]) || 0) + base + (i < extra ? 1 : 0); });
  _refreshDistPreview();
}

// Cột "Tỷ lệ" của bảng Team (chế độ Tuỳ chỉnh) nhập được cả %: số KH = làm tròn xuống(pool × %/100),
// vẫn lưu vào customDist nên _computeDist và mọi chỗ chia thật không phải đổi gì.
// Hiển thị lại đúng số % người dùng đã gõ nếu nó còn khớp với số KH; nếu số KH bị sửa/auto-fill
// thì tính lại % từ số KH (1 chữ số thập phân).
function _teamPctShown(tid, n, total) {
  const typed = _advAssign.customPct[tid];
  if (typed !== undefined && total > 0 && Math.floor(total * typed / 100 + 1e-9) === n) return typed;
  return total > 0 ? Math.round(n / total * 1000) / 10 : 0;
}
// field: 'n' (ô Số KH) hoặc 'p' (ô %). Render lại bảng rồi trả focus + con trỏ về đúng ô đang gõ
// (không trả focus thì gõ 1 ký tự là mất ô).
function _teamDistSet(tid, field, raw) {
  const total = _getAssignPool().length;
  if (field === 'p') {
    const p = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    _advAssign.customPct[tid] = p;
    _advAssign.customDist[tid] = Math.floor(total * p / 100 + 1e-9); // làm tròn XUỐNG: tổng các team không bao giờ vượt pool; phần dư để nút "Tự động phân phần còn lại" xử lý
  } else {
    delete _advAssign.customPct[tid];
    _advAssign.customDist[tid] = Math.max(0, parseInt(raw) || 0);
  }
  _refreshDistPreview();
  const el = Array.prototype.find.call(document.querySelectorAll('#assign-dist-preview input[data-f]'),
    i => i.dataset.cs === tid && i.dataset.f === field);
  if (el) { el.focus(); try { const L = el.value.length; el.setSelectionRange(L, L); } catch (e) {} }
}

// Bảng phân phối khi chia THEO TEAM: trước tiên chia pool cho các Team đã chọn (chia đều hoặc
// tuỳ chỉnh, dùng chung _computeDist/customDist như chế độ CS), sau đó mỗi Team chia tiếp cho
// thành viên của mình THEO TỶ LỆ % (xem _computeMemberRatioDist).
function _renderTeamDistTable(pool, teamIds) {
  if (!teamIds.length) return '<div style="font-size:12px;color:var(--hint)">Chọn ít nhất 1 Team ở trên.</div>';
  const totalPool = pool.length;
  const teamDist = _computeDist(pool, teamIds);
  const distTotal = Object.values(teamDist).reduce((s,v)=>s+v,0);
  let html = '';

  if (_advAssign.distMode === 'custom') {
    const rem = totalPool - distTotal;
    const remClass = rem === 0 ? 'ok' : rem > 0 ? 'warn' : 'err';
    const remText = rem === 0 ? `✓ Đã phân đủ ${totalPool} KH` : rem > 0 ? `Còn ${rem} KH chưa phân` : `⚠ Vượt quá ${-rem} KH`;
    html += `
    <table class="assign-dist-table">
      <thead><tr><th>Team</th><th style="text-align:center">Số KH</th><th style="min-width:120px">Tỷ lệ</th></tr></thead>
      <tbody>
        ${teamIds.map(tid=>{
          const team = teams.find(t=>t.id===tid) || {name:tid};
          const n = teamDist[tid]||0;
          const pct = totalPool > 0 ? Math.round(n/totalPool*100) : 0;
          return `<tr>
            <td><strong>${esc(team.name)}</strong></td>
            <td style="text-align:center"><input class="assign-dist-input" type="number" min="0" max="${totalPool}" value="${n}" data-cs="${esc(tid)}" data-f="n"
              oninput="_teamDistSet(this.dataset.cs,'n',this.value)"></td>
            <td><div style="display:flex;align-items:center;gap:6px"><input class="assign-dist-input" type="number" min="0" max="100" step="0.1" style="width:64px" value="${_teamPctShown(tid,n,totalPool)}" data-cs="${esc(tid)}" data-f="p"
              oninput="_teamDistSet(this.dataset.cs,'p',this.value)"><span style="font-size:11px;color:var(--muted)">%</span></div>
              <div class="assign-dist-bar"><div class="assign-dist-fill" style="width:${Math.min(100,pct)}%"></div></div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="assign-remaining-badge ${remClass}">${remText}</span>
      <button class="btn sm" onclick="_autoFillRemaining()">🔄 Tự động phân phần còn lại</button>
    </div>`;
  } else {
    html += `
    <table class="assign-dist-table">
      <thead><tr><th>Team</th><th style="text-align:right">Số KH nhận</th><th style="min-width:120px">Tỷ lệ</th></tr></thead>
      <tbody>
        ${teamIds.map(tid=>{
          const team = teams.find(t=>t.id===tid) || {name:tid};
          const n = teamDist[tid]||0;
          const pct = totalPool > 0 ? Math.round(n/totalPool*100) : 0;
          return `<tr>
            <td><strong>${esc(team.name)}</strong></td>
            <td style="text-align:right;font-weight:700;color:var(--green)">${n}</td>
            <td><div class="assign-dist-bar"><div class="assign-dist-fill" style="width:${pct}%"></div></div><span style="font-size:10px;color:var(--muted)">${pct}%</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:8px"><span class="assign-remaining-badge ok">✓ ${totalPool} KH sẽ được chia cho ${teamIds.length} Team</span></div>`;
  }

  // Phân phối NỘI BỘ từng Team — luôn hiện, bất kể đang Chia đều hay Tuỳ chỉnh ở cấp Team phía
  // trên. 2 cách: theo % tỷ lệ (tự tính số KH), hoặc nhập thẳng số lượng cụ thể cho từng người.
  const isCountMode = _advAssign.memberDistMode === 'count';
  html += '<div style="margin-top:14px;border-top:1px dashed var(--border);padding-top:10px">';
  html += `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
    <div style="font-size:11px;color:var(--muted);font-weight:500">Chia trong từng Team cho từng thành viên:</div>
    <div class="assign-mode-row" style="flex:none;width:auto">
      <div class="assign-mode-btn ${!isCountMode?'active':''}" style="flex:none;padding:4px 10px;font-size:11px" onclick="_advAssign.memberDistMode='pct';renderAssignCreate()">⚖ Theo %</div>
      <div class="assign-mode-btn ${isCountMode?'active':''}" style="flex:none;padding:4px 10px;font-size:11px" onclick="_advAssign.memberDistMode='count';renderAssignCreate()">🔢 Số lượng cụ thể</div>
    </div>
  </div>`;
  teamIds.forEach(tid => {
    const team = teams.find(t=>t.id===tid) || {name:tid, members:[]};
    const members = _dedupePeopleNames(team.members || []);   // 1 người nhiều tên chỉ nhận 1 phần
    const teamCount = teamDist[tid] || 0;
    html += `<div style="margin-bottom:10px">`;
    html += `<div style="font-weight:700;font-size:12px;margin-bottom:4px">${esc(team.name)} <span style="font-weight:400;color:var(--muted)">— ${teamCount} KH</span></div>`;
    if (!members.length) {
      html += `<div style="font-size:11px;color:var(--hint);padding-left:8px">⚠ Team chưa có thành viên — vào "Quản lý Team" để thêm, nếu không data của Team này sẽ không ai nhận.</div>`;
    } else if (isCountMode) {
      const countMap = _advAssign.memberCount[tid] || {};
      members.forEach(m => {
        const n = parseInt(countMap[m]) || 0;
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;padding-left:8px">
          <span style="flex:1;font-size:12px">${esc(m)}</span>
          <input class="assign-dist-input" type="number" min="0" max="${teamCount}" step="1" style="width:64px" value="${n}" data-team="${esc(tid)}" data-member="${esc(m)}" oninput="_advAssignSetMemberCount(this)">
          <span style="font-size:11px;color:var(--muted)">KH</span>
        </div>`;
      });
      const used = members.reduce((s,m)=> s + (parseInt(countMap[m])||0), 0);
      const rem = teamCount - used;
      const remClass = rem === 0 ? 'ok' : rem > 0 ? 'warn' : 'err';
      const remText = rem === 0 ? `✓ Đã phân đủ ${teamCount} KH` : rem > 0 ? `Còn ${rem} KH chưa phân trong Team này` : `⚠ Vượt quá ${-rem} KH so với ${teamCount} KH của Team`;
      html += `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-left:8px;margin-top:4px">
        <span class="assign-remaining-badge ${remClass}">${remText}</span>
        <button class="btn sm" onclick="_advAssignAutoFillTeamMembers('${esc(tid)}')">🔄 Tự động chia phần còn lại</button>
      </div>`;
    } else {
      const ratioMap = _advAssign.memberRatio[tid] || {};
      const sumPct = members.reduce((s,m)=> s + Math.max(0, Number(ratioMap[m])||0), 0);
      const usingDefault = sumPct <= 0;
      const memberDist = _computeMemberRatioDist(teamCount, members, ratioMap);
      members.forEach(m => {
        const pctDisplay = usingDefault ? (100/members.length).toFixed(1) : (Number(ratioMap[m])||0);
        const cnt = memberDist[m] || 0;
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;padding-left:8px">
          <span style="flex:1;font-size:12px">${esc(m)}</span>
          <input class="assign-dist-input" type="number" min="0" max="100" step="0.1" style="width:64px" value="${pctDisplay}" data-team="${esc(tid)}" data-member="${esc(m)}" oninput="_advAssignSetMemberRatio(this)">
          <span style="font-size:11px;color:var(--muted)">%</span>
          <span style="font-size:12px;font-weight:600;color:var(--green);min-width:54px;text-align:right">${cnt} KH</span>
        </div>`;
      });
      if (!usingDefault && Math.abs(sumPct-100) > 0.5) {
        html += `<div style="font-size:10px;color:#92400e;padding-left:8px">⚠ Tổng tỷ lệ đang là ${sumPct.toFixed(1)}% (không nhất thiết phải tròn 100% — hệ thống vẫn chia đúng theo tỷ trọng đã nhập).</div>`;
      }
    }
    html += `</div>`;
  });
  html += '</div>';
  return html;
}
// Lọc nhanh chip CS theo tên (không render lại modal để giữ ô tìm kiếm)
function _filterAssignCSChips(q){
  const qf = (typeof _foldVi==='function') ? _foldVi(q||'') : String(q||'').toLowerCase();
  document.querySelectorAll('#assign-cs-chips .assign-cs-chip-multi').forEach(function(el){
    const nm = (typeof _foldVi==='function') ? _foldVi(el.textContent||'') : (el.textContent||'').toLowerCase();
    el.style.display = (!qf || nm.indexOf(qf) >= 0) ? '' : 'none';
  });
}

function doAssignDataAdvanced() {
  const pool = _getAssignPool();
  if (pool.length === 0) { toast('Không có data nào để chia'); return; }

  // finalDist: tên người nhận (csName, kể cả khi lấy từ thành viên 1 Team) -> số KH cuối cùng.
  // Dùng Set để gom theo tên duy nhất — phòng trường hợp 1 người xuất hiện ở 2 Team được chọn
  // cùng lúc, tránh bị cắt pool 2 lần cho cùng 1 người.
  let finalDist = {};
  let orderedNames = [];

  if (_advAssign.selectMode === 'team') {
    const teamIds = [..._advAssign.selectedTeams];
    if (teamIds.length === 0) { toast('Vui lòng chọn ít nhất 1 Team'); return; }
    const teamDist = _computeDist(pool, teamIds);
    if (_advAssign.distMode === 'custom') {
      const distTotal = Object.values(teamDist).reduce((s,v)=>s+v,0);
      if (distTotal > pool.length) { toast(`⚠ Tổng phân phối cho Team (${distTotal}) vượt quá số KH có sẵn (${pool.length})`); return; }
      if (distTotal === 0) { toast('Vui lòng nhập số KH cho từng Team'); return; }
    }
    const isCountMode = _advAssign.memberDistMode === 'count';
    const orderedSet = new Set();
    for (const teamId of teamIds) {
      const team = teams.find(t => t.id === teamId);
      const members = _dedupePeopleNames((team && team.members) || []);   // 1 người nhiều tên chỉ nhận 1 phần
      const teamCount = teamDist[teamId] || 0;
      if (!members.length || teamCount <= 0) continue;
      let memberDist;
      if (isCountMode) {
        memberDist = _computeMemberCountDist(members, _advAssign.memberCount[teamId] || {});
        const sumN = Object.values(memberDist).reduce((s,v)=>s+v,0);
        if (sumN > teamCount) {
          toast(`⚠ Team "${team.name}": tổng số KH đã nhập (${sumN}) vượt quá ${teamCount} KH của Team — sửa lại trước khi chia.`);
          return;
        }
      } else {
        memberDist = _computeMemberRatioDist(teamCount, members, _advAssign.memberRatio[teamId] || {});
      }
      members.forEach(m => {
        const n = memberDist[m] || 0;
        if (n <= 0) return;
        finalDist[m] = (finalDist[m] || 0) + n;
        orderedSet.add(m);
      });
    }
    orderedNames = [...orderedSet];
    if (orderedNames.length === 0) { toast('Chưa có thành viên nào được phân KH — kiểm tra lại Team đã chọn/tỷ lệ hoặc số lượng'); return; }
  } else {
    const csList = [..._advAssign.selectedCS];
    if (csList.length === 0) { toast('Vui lòng chọn ít nhất 1 CS'); return; }
    finalDist = _computeDist(pool, csList);
    if (_advAssign.distMode === 'custom') {
      const distTotal = Object.values(finalDist).reduce((s,v)=>s+v,0);
      if (distTotal > pool.length) { toast(`⚠ Tổng phân phối (${distTotal}) vượt quá số KH có sẵn (${pool.length})`); return; }
      if (distTotal === 0) { toast('Vui lòng nhập số KH cho từng CS'); return; }
    }
    orderedNames = csList;
  }

  const label = (document.getElementById('assign-label')?.value || _advAssign.label || '').trim();
  const now = new Date().toISOString().slice(0,16).replace('T',' ');

  // Cắt pool tuần tự theo thứ tự orderedNames — mỗi người nhận đúng finalDist[tên] KH liên tiếp.
  let cursor = 0;
  const entries = [];
  orderedNames.forEach(name => {
    const n = finalDist[name] || 0;
    if (n === 0) return;
    const phones = pool.slice(cursor, cursor + n);
    cursor += n;
    const entry = {
      id: Date.now().toString() + '_' + Math.random().toString(36).slice(2,6),
      date: now,
      csName: name,
      phones,
      label: label || `Chia ${phones.length} KH`,
      donePhones: []
    };
    entries.push(entry);
    assignHistory.unshift(entry);
  });

  saveLS('ome_assign_hist', assignHistory);
  _invalidateFilterCache();
  if (typeof _rebuildAssignIndex === 'function') _rebuildAssignIndex();
  try { _applyCareCSToAssigned(entries); } catch(e){ console.warn('applyCareCSToAssigned lỗi:', e); }   // chia data → cập nhật "CS chăm sóc" + ghi OrderData cột N
  entries.forEach(e => logAudit('assign', '', '', `Chia ${e.phones.length} KH → ${e.csName}`));
  // Chi day CAC DOT MOI (saveAssign tung dot) — truoc day pushAssignHistToGS() ghi de TOAN BO lich su (kem mang SDT cua moi dot)
  // len sheet moi lan chia: body hang MB va backend clearContents() truoc khi ghi nen loi giua chung la mat lich su tren Sheet.
  try { if (gsUrl) (async function(){ for (const _e of entries) { await pushAssignToGS(_e); } })(); } catch(e){ console.warn('pushAssignToGS lỗi:', e); }

  const summary = entries.map(e=>`${e.csName}: ${e.phones.length} KH`).join(', ');
  toast(`✓ Đã chia ${cursor} KH → ${summary}`);
  updateMyDataBadge();
  closeAssignModal();   // chia xong tự đóng modal (xem lại ở tab "Lịch sử chia" khi cần)
}

// Keep old compat functions
function selectAssignCS(cs, el) {
  _advAssignToggleCS(cs);
}
function selectAssignCSManual(val) {
  _assignSelectedCS = val.trim();
}
function doAssignData() { doAssignDataAdvanced(); }

// Khi chia data: đặt "CS chăm sóc" (careCS) = CS được chia cho từng KH, đồng bộ CareData + ghi OrderData cột N.
// CS chăm sóc mới nhất thắng (chia lại sẽ đổi sang CS mới).
function _applyCareCSToAssigned(entries){
  if (typeof careData === 'undefined' || !entries || !entries.length) return 0;
  const cmap = (typeof allCustomers !== 'undefined') ? _assignCustMap() : null;   // dung Map cache, khong dung lai 136k cap moi lan chia
  const updates = [];
  entries.forEach(e => {
    const cs = e.csName || '';
    (e.phones || []).forEach(p => {
      const ph = String(p);
      if (!careData[ph]) careData[ph] = {};
      careData[ph].cs = cs;
      if (cmap){ const c = cmap.get(ph); if (c) c.careCS = cs; }   // KHÔNG đụng csSet (CS phụ trách giữ nguyên)
      updates.push({ phone: ph, careCS: cs });
    });
  });
  saveLS('ome_care', careData);
  if (gsUrl && updates.length){
    // 1 lần ghi careCS xuống OrderData cột N cho tất cả SĐT vừa chia
    // Chia THEO LO 2000 SDT/request (truoc day 1 request chua toan bo — hang tram nghin SDT — de bi timeout/nghen)
    (async function(){
      for (let i = 0; i < updates.length; i += 2000) {
        try { await fetch(gsUrl, { method:'POST', redirect:'follow', body: JSON.stringify({ action:'setOrderCareCSBatch', updates: updates.slice(i, i + 2000) }) }); } catch(e) {}
      }
    })();
    // đồng bộ careData.cs lên CareData (theo lô)
    updates.forEach(function(u){ if (typeof queueCareSync === 'function') queueCareSync(u.phone); });
  }
  if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
  if (typeof applyFilters === 'function') applyFilters();
  return updates.length;
}

function wasEverAssigned(phone) {
  return _everAssignedSet().has(phone);   // O(1) — truoc day quet toan bo lich su chia cho TUNG SDT (O(N^2) khi goi trong vong lap)
}

function renderAssignHistory() {
  if (assignHistory.length === 0) {
    document.getElementById('assign-body').innerHTML = '<div style="padding:30px;text-align:center;color:var(--hint)">Chưa có lần chia nào</div>';
    return;
  }
  const html = assignHistory.map((h, idx) => {
    const done = h.donePhones ? h.donePhones.length : 0;
    const total = h.phones.length;
    const pct = total > 0 ? Math.round(done/total*100) : 0;
    return `<div class="assign-hist-item">
      <div class="assign-hist-hdr">
        <div>
          <strong>${esc(h.label)}</strong>
          <span class="assign-hist-badge">👤 ${esc(h.csName)}</span>
        </div>
        <button class="btn sm" onclick="openBroadcastCompose('${h.id}')" style="padding:2px 7px;font-size:10px;background:#00b14f;color:#fff;border:none">📢 Gửi hàng loạt</button>
        <button class="btn sm danger" onclick="deleteAssignEntry('${h.id}')" style="padding:2px 7px;font-size:10px">✕ Xóa</button>
      </div>
      <div class="assign-hist-meta">
        📅 ${h.date} &nbsp;·&nbsp; ${total} KH &nbsp;·&nbsp;
        <span style="color:var(--green)">✓ ${done}/${total} hoàn thành (${pct}%)</span>
      </div>
      <div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:4px">
        ${h.phones.slice(0,8).map(p => {
          const c = _assignCustMap().get(p);
          const isDone = h.donePhones && h.donePhones.includes(p);
          return `<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:${isDone?'var(--green-bg)':'var(--surface2)'};color:${isDone?'var(--green)':'var(--muted)'};border:1px solid ${isDone?'rgba(26,107,69,.2)':'var(--border)'}">
            ${isDone?'✓ ':''} ${c ? esc(c.name) : p}
          </span>`;
        }).join('')}
        ${h.phones.length > 8 ? `<span style="font-size:10px;color:var(--hint)">+${h.phones.length-8} KH nữa</span>` : ''}
      </div>
    </div>`;
  }).join('');
  document.getElementById('assign-body').innerHTML = html;
}

function deleteAssignEntry(id) {
  if (!confirm('Xóa lịch sử chia này?')) return;
  assignHistory = assignHistory.filter(h => h.id !== id);
  saveLS('ome_assign_hist', assignHistory);
  if (gsUrl) pushAssignHistToGS();  // đồng bộ xóa lên GS
  renderAssignHistory();
  updateMyDataBadge();
  if (typeof updateCampaignFilter === 'function') updateCampaignFilter();
  toast('Đã xóa');
}

// ── PIVOT REPORT STATE ──
let _rptFilters = { cs: new Set(), tier: new Set(), label: new Set(), dateFrom: '', dateTo: '', dateQuick: 'custom',
  product: new Set(), careStatus: new Set(), khStatus: new Set(), zaloStatus: new Set(), source: new Set(), nickZalo: '' };
let _rptPivotRow = 'cs';    // cs | tier | label | month | source
let _rptPivotCol = 'tier';  // tier | careStatus | done | month | source
let _rptMetric = 'kh';      // kh | orders | revenue
let _rptSortCol = 'total';
let _rptSortDir = -1;

function renderAssignReport(keepBar) {
  // Build filter options from history
  const allCS    = [...new Set(assignHistory.map(h=>h.csName))].sort();
  const allLabels= [...new Set(assignHistory.map(h=>h.label))].sort();
  const allTiers = ['VIP','Thân thiết','Tiềm năng','Chưa bán lại được'];
  const allSources = [...new Set(allCustomers.flatMap(c=>c.sources||[]).filter(Boolean))].sort();
  const allKhStatus = (typeof _flatCustStatusValues==='function' ? _flatCustStatusValues() : []).filter(Boolean);

  // Luu tuy chon cho combo loc (_rptComboHTML doc tu day, khong tinh lai allSources tren hang chuc nghin KH)
  _rptComboOpts = { cs: allCS, tier: allTiers, label: allLabels, careStatus: (typeof CARE_STATUS!=='undefined'?CARE_STATUS:[]), khStatus: allKhStatus, zaloStatus: (typeof ZALO_STATUS!=='undefined'?ZALO_STATUS:[]), source: allSources };
  // Apply filters to get working set of batches
  const batches = assignHistory.filter(h => {
    if (_rptFilters.cs.size    && !_rptFilters.cs.has(h.csName)) return false;
    if (_rptFilters.label.size && !_rptFilters.label.has(h.label)) return false;
    if (_rptFilters.dateFrom && h.date < _rptFilters.dateFrom) return false;
    if (_rptFilters.dateTo   && h.date > _rptFilters.dateTo + ' 99') return false;
    return true;
  });

  // Nguồn (kênh) gần nhất của 1 khách — dùng đơn có ngày mới nhất; không có đơn nào thì '—'
  function _rptCustSource(c){
    if (!c || !c.orders || !c.orders.length) return '—';
    let latest = null;
    for (const o of c.orders) {
      if (!o.source) continue;
      if (!latest || (o.date instanceof Date && (!(latest.date instanceof Date) || o.date > latest.date))) latest = o;
    }
    return (latest && latest.source) || c.sources?.[0] || '—';
  }
  const productTerms = [...(_rptFilters.product||[])].map(t=>_foldVi(t)).filter(Boolean);
  const nickTerm = _foldVi(_rptFilters.nickZalo||'').trim();

  // Flatten to phone rows with metadata
  const phoneRows = [];
  const custByPhone = new Map();
  for (const h of batches) {
    for (const p of h.phones) {
      const c = _assignCustMap().get(p);
      if (_rptFilters.tier.size && !(c && _rptFilters.tier.has(c.tier))) continue;
      if (_rptFilters.careStatus.size && !(c && _rptFilters.careStatus.has(c.careStatus||''))) continue;
      if (_rptFilters.khStatus.size && !(c && _rptFilters.khStatus.has(c.khStatus||''))) continue;
      if (_rptFilters.zaloStatus.size && !(c && _rptFilters.zaloStatus.has(c.zaloStatus||''))) continue;
      if (_rptFilters.source.size && !(c && (c.sources||[]).some(s=>_rptFilters.source.has(s)))) continue;
      if (productTerms.length) {
        const ptxt = (typeof _customerProductText==='function' && c) ? _customerProductText(c) : '';
        if (!productTerms.some(t=>ptxt.indexOf(t)!==-1)) continue;
      }
      if (nickTerm) {
        const nicks = (c && Array.isArray(c.nickZalos)) ? c.nickZalos : [];
        if (!nicks.some(n=>_foldVi(n).indexOf(nickTerm)!==-1)) continue;
      }
      if (c && !custByPhone.has(p)) custByPhone.set(p, c);
      phoneRows.push({
        phone: p,
        csName: h.csName,
        label: h.label,
        date: h.date,
        month: h.date ? h.date.slice(0,7) : '—',
        tier: c?.tier || '—',
        careStatus: c?.careStatus || 'Chưa liên hệ',
        source: _rptCustSource(c),
        isDone: (h.donePhones||[]).includes(p),
        cust: c
      });
    }
  }
  // Quy đổi giá trị 1 tập SĐT sang metric đang chọn (số KH / số đơn / doanh thu)
  function _rptMetricValue(phoneSet){
    if (_rptMetric === 'kh') return phoneSet.size;
    let sum = 0;
    phoneSet.forEach(p=>{
      const c = custByPhone.get(p);
      if (!c) return;
      sum += _rptMetric==='revenue' ? (c.totalRevenue||0) : (c.totalOrders||0);
    });
    return sum;
  }
  function _rptFmtMetric(n){ return _rptMetric==='revenue' ? fmtVND(n) : fmt(n); }

  // Global KPIs
  const totalKH   = new Set(phoneRows.map(r=>r.phone)).size;
  const totalDone = new Set(phoneRows.filter(r=>r.isDone).map(r=>r.phone)).size;
  const totalChot = new Set(phoneRows.filter(r=>r.careStatus==='Chốt').map(r=>r.phone)).size;
  const neverAssigned = allCustomers.filter(c=>!wasEverAssigned(c.phone)).length;   // wasEverAssigned gio la O(1)
  const totalBatches  = batches.length;

  // Build pivot data
  const pivotRowKey = _rptPivotRow;
  const pivotColKey = _rptPivotCol;
  const rowKeys = [...new Set(phoneRows.map(r => r[pivotRowKey] || '—'))].sort();
  const colKeys = pivotColKey === 'done'
    ? ['Đã xong','Chưa xong']
    : [...new Set(phoneRows.map(r => pivotColKey==='done'? (r.isDone?'Đã xong':'Chưa xong') : (r[pivotColKey]||'—')))].sort();

  // pivot[row][col] = count of unique phones
  const pivot = {};
  const rowTotals = {};
  const colTotals = {};
  let grandTotal = 0;
  for (const r of phoneRows) {
    const rk = r[pivotRowKey] || '—';
    const ck = pivotColKey==='done' ? (r.isDone?'Đã xong':'Chưa xong') : (r[pivotColKey]||'—');
    if (!pivot[rk]) pivot[rk] = {};
    if (!pivot[rk][ck]) pivot[rk][ck] = new Set();
    pivot[rk][ck].add(r.phone);
    if (!rowTotals[rk]) rowTotals[rk] = new Set();
    rowTotals[rk].add(r.phone);
    if (!colTotals[ck]) colTotals[ck] = new Set();
    colTotals[ck].add(r.phone);
  }
  const allPhoneSet = new Set(phoneRows.map(r=>r.phone));
  grandTotal = allPhoneSet.size;
  const grandMetricVal = _rptMetricValue(allPhoneSet);

  // Sort rows (theo đúng metric đang chọn — KH / Số đơn / Doanh thu)
  const sortedRows = [...rowKeys].sort((a,b) => {
    const va = _rptMetricValue(rowTotals[a]||new Set());
    const vb = _rptMetricValue(rowTotals[b]||new Set());
    return _rptSortDir * (vb - va);
  });

  // Bar chart data per CS for visual
  const csBar = {};
  for (const r of phoneRows) {
    if (!csBar[r.csName]) csBar[r.csName] = {total:new Set(), done:new Set(), chot:new Set()};
    csBar[r.csName].total.add(r.phone);
    if (r.isDone) csBar[r.csName].done.add(r.phone);
    if (r.careStatus==='Chốt') csBar[r.csName].chot.add(r.phone);
  }
  // Tỷ lệ phản hồi Zalo = KH có cờ phản hồi / KH đã kết bạn Zalo (chỉ tính KH đã kết bạn → luôn ≤ 100%)
  const _zrConn = new Set(), _zrRep = new Set();
  for (const r of phoneRows) {
    if (!_zaloConnectedOf(r.cust)) continue;
    _zrConn.add(r.phone);
    if (_zaloReplyOf(r.cust)) _zrRep.add(r.phone);
    const b = csBar[r.csName]; if (b) { (b.conn = b.conn || new Set()).add(r.phone); if (_zaloReplyOf(r.cust)) (b.rep = b.rep || new Set()).add(r.phone); }
  }
  const _zrPct = _zrConn.size ? Math.round(_zrRep.size / _zrConn.size * 1000) / 10 : 0;
  const csBarRows = Object.entries(csBar).sort((a,b)=>b[1].total.size-a[1].total.size);
  const maxBar = csBarRows.length ? csBarRows[0][1].total.size : 1;

  const PIVOT_ROW_OPTS  = [{v:'cs',l:'CS phụ trách'},{v:'tier',l:'Phân loại KH'},{v:'label',l:'Đợt chia'},{v:'month',l:'Tháng chia'},{v:'source',l:'Kênh (Nguồn)'}];
  const PIVOT_COL_OPTS  = [{v:'tier',l:'Phân loại KH'},{v:'careStatus',l:FIELD_LABEL_CS},{v:'done',l:'Hoàn thành'},{v:'month',l:'Tháng chia'},{v:'source',l:'Kênh (Nguồn)'},{v:'cs',l:'CS phụ trách'}];

  const rptHtml = `
  <!-- KPI ROW -->
  <div id="rpt-kpi">
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px">
    ${[
      ['📋',totalBatches,'Đợt chia','var(--text)'],
      ['👥',grandTotal,'KH được chia','var(--blue)'],
      ['✅',totalDone,'Đã chăm xong','var(--green)'],
      ['🎯',totalChot,'Đã chốt','#059669'],
      ['⬜',neverAssigned,'Chưa chia lần nào','var(--hint)'],
    ].map(([ic,n,l,c])=>`
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:9px 10px">
        <div style="font-size:18px;font-weight:800;color:${c};line-height:1">${n}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${ic} ${l}</div>
        ${n>0&&l!=='Chưa chia lần nào'?`<div style="font-size:9px;color:var(--hint);margin-top:1px">${grandTotal>0?Math.round(n/grandTotal*100):0}% tổng</div>`:''}
      </div>`).join('')}
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:9px 10px" title="Phản hồi Zalo / KH đã kết bạn Zalo (trong tập đang lọc). Ô tích 'Phản hồi Zalo' ở chi tiết khách.">
        <div style="font-size:18px;font-weight:800;color:#0891b2;line-height:1">${_zrPct}%</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">💬 Phản hồi Zalo</div>
        <div style="font-size:9px;color:var(--hint);margin-top:1px">${_zrRep.size}/${_zrConn.size} KH đã kết bạn</div>
      </div>
  </div>

  </div>
  <!-- FILTERS + PIVOT CONTROLS -->
  <div id="rpt-filterbar" style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px 12px;margin-bottom:12px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--hint);margin-bottom:8px">🔽 Bộ lọc báo cáo</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      ${_rptComboHTML('cs')}
      ${_rptComboHTML('tier')}
      ${_rptComboHTML('label')}
      <div>
        <div style="font-size:10px;color:var(--hint);margin-bottom:3px">Khoảng ngày</div>
        ${_quickRangeSelectHtml(_rptFilters.dateQuick, "_rptApplyQuickRange(this.value)")}
      </div>
      <div>
        <div style="font-size:10px;color:var(--hint);margin-bottom:3px">Từ ngày</div>
        <input type="date" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" value="${_rptFilters.dateFrom}" oninput="_rptFilters.dateFrom=this.value;_rptFilters.dateQuick='custom';renderAssignReport()">
      </div>
      <div>
        <div style="font-size:10px;color:var(--hint);margin-bottom:3px">Đến ngày</div>
        <input type="date" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" value="${_rptFilters.dateTo}" oninput="_rptFilters.dateTo=this.value;_rptFilters.dateQuick='custom';renderAssignReport()">
      </div>
      ${_rptComboHTML('careStatus')}
      ${_rptComboHTML('khStatus')}
      ${_rptComboHTML('zaloStatus')}
      ${_rptComboHTML('source')}
      <div>
        <div style="font-size:10px;color:var(--hint);margin-bottom:3px">Sản phẩm (cách nhau bằng dấu phẩy)</div>
        <input type="text" placeholder="vd: tỳ hưu, nhẫn 10k" style="min-width:170px;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" value="${esc([..._rptFilters.product].join(', '))}" oninput="_rptFilterInputChanged('product', this.value, true)">
      </div>
      <div>
        <div style="font-size:10px;color:var(--hint);margin-bottom:3px">Nick Zalo</div>
        <input type="text" placeholder="Tìm nick..." style="min-width:110px;font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" value="${esc(_rptFilters.nickZalo||'')}" oninput="_rptFilterInputChanged('nickZalo', this.value, false)">
      </div>
      <button class="btn sm danger" onclick="_rptResetFilters()" style="margin-bottom:1px">✕ Xóa lọc</button>
    </div>
  </div>

  <div id="rpt-rest">
  <!-- BAR CHART: KH THEO CS -->
  <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px 12px;margin-bottom:12px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--hint);margin-bottom:10px">📊 Data chia & kết quả theo CS</div>
    ${csBarRows.length === 0 ? '<div style="font-size:12px;color:var(--hint);padding:10px 0">Không có data</div>' : ''}
    ${csBarRows.map(([cs,d])=>{
      const tot = d.total.size, don = d.done.size, cho = d.chot.size;
      const pctDone = tot ? Math.round(don/tot*100) : 0;
      const pctChot = tot ? Math.round(cho/tot*100) : 0;
      const wTotal = tot/maxBar*100;
      const wDone  = tot ? don/tot*100 : 0;
      const wChot  = tot ? cho/tot*100 : 0;
      const zc = d.conn ? d.conn.size : 0, zr = d.rep ? d.rep.size : 0, zp = zc ? Math.round(zr/zc*100) : 0;
      return `<div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:12px;font-weight:600">${esc(cs)}</span>
          <span style="font-size:11px;color:var(--muted)">${tot} KH &nbsp;|&nbsp; <span style="color:var(--green)">✓${don} (${pctDone}%)</span> &nbsp;|&nbsp; <span style="color:#059669">🎯${cho} (${pctChot}%)</span> &nbsp;|&nbsp; <span style="color:#0891b2" title="Phản hồi Zalo / KH đã kết bạn Zalo">💬${zr}/${zc} (${zp}%)</span></span>
        </div>
        <div style="position:relative;height:14px;background:var(--surface3);border-radius:4px;overflow:hidden">
          <div style="position:absolute;top:0;left:0;height:100%;width:${wTotal}%;background:#e0e7ff;border-radius:4px"></div>
          <div style="position:absolute;top:0;left:0;height:100%;width:${wDone}%;background:var(--green-mid);opacity:.55;border-radius:4px"></div>
          <div style="position:absolute;top:0;left:0;height:100%;width:${wChot}%;background:#059669;border-radius:4px"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:2px;font-size:9px;color:var(--hint)">
          <span style="color:#818cf8">■ Tổng</span><span style="color:var(--green)">■ Đã xong</span><span style="color:#059669">■ Chốt</span>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- PIVOT TABLE -->
  <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px 12px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--hint)">🔀 Pivot table</div>
      <div style="display:flex;align-items:center;gap:8px;font-size:11px">
        <span style="color:var(--muted)">Hàng:</span>
        <select style="font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" onchange="_rptPivotRow=this.value;renderAssignReport()">
          ${PIVOT_ROW_OPTS.map(o=>`<option value="${o.v}" ${_rptPivotRow===o.v?'selected':''}>${o.l}</option>`).join('')}
        </select>
        <span style="color:var(--muted)">Cột:</span>
        <select style="font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" onchange="_rptPivotCol=this.value;renderAssignReport()">
          ${PIVOT_COL_OPTS.map(o=>`<option value="${o.v}" ${_rptPivotCol===o.v?'selected':''}>${o.l}</option>`).join('')}
        </select>
        <span style="color:var(--muted)">Metric:</span>
        <select style="font-size:11px;padding:3px 7px;border:1px solid var(--border);border-radius:var(--rsm);outline:none;background:var(--surface)" onchange="_rptMetric=this.value;renderAssignReport()">
          <option value="kh" ${_rptMetric==='kh'?'selected':''}>Số KH</option>
          <option value="orders" ${_rptMetric==='orders'?'selected':''}>Số đơn</option>
          <option value="revenue" ${_rptMetric==='revenue'?'selected':''}>Doanh thu</option>
        </select>
        <button class="btn sm" onclick="_rptSortDir*=-1;renderAssignReport()" title="Đảo chiều sắp xếp">${_rptSortDir===-1?'↓':'↑'} Sắp xếp</button>
      </div>
    </div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:400px">
      <thead>
        <tr style="background:var(--surface3)">
          <th style="padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--hint);border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;left:0;background:var(--surface3)">
            ${PIVOT_ROW_OPTS.find(o=>o.v===_rptPivotRow)?.l||_rptPivotRow}
          </th>
          ${colKeys.map(ck=>`<th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--hint);border-bottom:1px solid var(--border);white-space:nowrap">${esc(ck)}</th>`).join('')}
          <th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text);border-bottom:1px solid var(--border);white-space:nowrap">Tổng</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--hint);border-bottom:1px solid var(--border);white-space:nowrap">% Tổng</th>
        </tr>
      </thead>
      <tbody>
        ${sortedRows.map((rk,ri)=>{
          const rowPhones = rowTotals[rk]||new Set();
          const rowVal = _rptMetricValue(rowPhones);
          const pct = grandMetricVal ? Math.round(rowVal/grandMetricVal*100) : 0;
          const fillPct = grandMetricVal ? rowVal/grandMetricVal*100 : 0;
          return `<tr style="border-bottom:1px solid var(--border);${ri%2===1?'background:var(--surface2)':'background:var(--surface)'}">
            <td style="padding:6px 10px;font-weight:500;position:sticky;left:0;background:inherit;white-space:nowrap">${esc(rk)}</td>
            ${colKeys.map(ck=>{
              const cellPhones = (pivot[rk]&&pivot[rk][ck]) ? pivot[rk][ck] : new Set();
              const n = _rptMetricValue(cellPhones);
              const pctCell = rowVal ? Math.round(n/rowVal*100) : 0;
              return `<td style="padding:6px 8px;text-align:right">
                <div style="font-weight:${n>0?'600':'400'};color:${n>0?'var(--text)':'var(--hint)'}">${n?_rptFmtMetric(n):'—'}</div>
                ${n>0?`<div style="font-size:9px;color:var(--hint)">${pctCell}%</div>`:''}
              </td>`;
            }).join('')}
            <td style="padding:6px 8px;text-align:right;font-weight:700">${_rptFmtMetric(rowVal)}</td>
            <td style="padding:6px 8px;text-align:right">
              <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end">
                <div style="width:40px;height:5px;background:var(--surface3);border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${fillPct}%;background:var(--green);border-radius:3px"></div>
                </div>
                <span style="font-size:11px;color:var(--muted)">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--surface3);font-weight:700;border-top:2px solid var(--border-md)">
          <td style="padding:7px 10px;position:sticky;left:0;background:var(--surface3)">Tổng cộng</td>
          ${colKeys.map(ck=>`<td style="padding:7px 8px;text-align:right;color:var(--text)">${_rptFmtMetric(_rptMetricValue(colTotals[ck]||new Set()))||'—'}</td>`).join('')}
          <td style="padding:7px 8px;text-align:right;color:var(--green)">${_rptFmtMetric(grandMetricVal)}</td>
          <td style="padding:7px 8px;text-align:right;color:var(--muted)">100%</td>
        </tr>
      </tfoot>
    </table>
    </div>
  </div>
  </div>`;

  // Che do keepBar (dung khi tick combo loc): CHI thay KPI + phan ket qua, GIU NGUYEN thanh loc de dropdown dang mo khong bi dong/mat o go tim.
  if (keepBar === true && document.getElementById('rpt-filterbar')) {
    const tmp = document.createElement('div'); tmp.innerHTML = rptHtml;
    let okSwap = true;
    ['rpt-kpi','rpt-rest'].forEach(id => { const nn = tmp.querySelector('#'+id), cur = document.getElementById(id); if (nn && cur) cur.innerHTML = nn.innerHTML; else okSwap = false; });
    if (okSwap) return;
  }
  document.getElementById('assign-body').innerHTML = rptHtml;
  document.getElementById('assign-footer').innerHTML = `
    <button class="btn" onclick="closeAssignModal()">Đóng</button>
    <button class="btn secondary" onclick="exportAssignReport()">📊 Xuất Excel</button>`;
}

// ── Combo loc kieu Excel cho "Bo loc bao cao" (Data chia): dropdown, go de tim, tick nhieu muc,
//    dong "(Chon tat ca)" cho ket qua dang tim, chip xoa rieng tung muc. Thay cho <select multiple>
//    luon hien san nhieu dong. Trang thai nam trong _rptFilters[key] (Set) nhu cu nen logic loc khong doi.
//    Tick KHONG ve lai ca panel (se dong dropdown): chi cap nhat chip + danh sach roi ve lai KPI/ket qua sau 250ms
//    qua renderAssignReport(true) (giu nguyen thanh loc). ──
var _rptComboOpts = {};
var _RPT_COMBO_CFG = {
  cs:         { id:'rpt-cs-combo',         label:function(){return 'CS';},                 ph:'🔍 Tìm & chọn CS...' },
  tier:       { id:'rpt-tier-combo',       label:function(){return 'Phân loại KH';},       ph:'🔍 Tìm & chọn phân loại...' },
  label:      { id:'rpt-label-combo',      label:function(){return 'Đợt chia';},           ph:'🔍 Tìm & chọn đợt chia...' },
  careStatus: { id:'rpt-carestatus-combo', label:function(){return (typeof FIELD_LABEL_CS!=='undefined' && FIELD_LABEL_CS) || 'Tình trạng CS';}, ph:'🔍 Tìm & chọn...' },
  khStatus:   { id:'rpt-khstatus-combo',   label:function(){return (typeof FIELD_LABEL_KH!=='undefined' && FIELD_LABEL_KH) || 'Trạng thái KH';}, ph:'🔍 Tìm & chọn...' },
  zaloStatus: { id:'rpt-zalostatus-combo', label:function(){return 'Kết bạn Zalo';},       ph:'🔍 Tìm & chọn...' },
  source:     { id:'rpt-source-combo',     label:function(){return 'Kênh (Nguồn)';},       ph:'🔍 Tìm & chọn kênh...' }
};
var _rptComboIdx = {}, _rptComboT = null;
function _rptComboItems_(key){ return (_rptComboOpts[key] || []).filter(function(v){ return v !== '' && v != null; }); }
function _rptChipHtml_(key, name){
  return '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--green-bg);color:var(--green);border-radius:10px;padding:2px 6px 2px 8px;font-size:10.5px;white-space:nowrap" data-name="'+esc(name)+'">'+
    esc(name)+'<span style="cursor:pointer;font-weight:700" onclick="rptComboRemove(\''+key+'\', this.parentNode.dataset.name)">✕</span></span>';
}
function _rptComboHTML(key){
  var cfg = _RPT_COMBO_CFG[key], sel = [..._rptFilters[key]];
  return '<div class="cs-filter-wrap" style="margin-bottom:0"><div class="cs-filter-label" style="padding:0;margin-bottom:3px">'+esc(cfg.label())+
    '<span id="'+cfg.id+'-label-count" style="color:var(--green)">'+(sel.length?' ('+sel.length+' đã chọn)':'')+'</span></div>'+
    '<div class="cs-combo" id="'+cfg.id+'" style="width:160px">'+
    '<input type="text" id="'+cfg.id+'-input" class="cs-combo-input" placeholder="'+esc(cfg.ph)+'" autocomplete="off" '+
    'oninput="rptComboFilter(\''+key+'\', this.value)" onfocus="rptComboOpen(\''+key+'\')" onkeydown="rptComboKey(\''+key+'\', event)">'+
    '<button type="button" class="cs-combo-clear" id="'+cfg.id+'-clear" onclick="rptComboClear(\''+key+'\', event)" style="display:'+(sel.length?'':'none')+'">✕</button>'+
    '<span class="cs-combo-caret" onclick="rptComboToggle(\''+key+'\', event)">▾</span>'+
    '<div class="cs-combo-list" id="'+cfg.id+'-list"></div></div>'+
    '<div id="'+cfg.id+'-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;max-width:200px;max-height:54px;overflow-y:auto">'+
    sel.map(function(n){ return _rptChipHtml_(key, n); }).join('')+'</div></div>';
}
function rptComboRender(key, filter){
  var cfg = _RPT_COMBO_CFG[key], list = document.getElementById(cfg.id+'-list');
  if (!list) return;
  var q = _foldVi(filter||''), sel = _rptFilters[key];
  var items = _rptComboItems_(key);
  if (q) items = items.filter(function(v){ return _foldVi(String(v)).indexOf(q) !== -1; });
  if (!items.length){ list.innerHTML = '<div class="cs-combo-empty">Không tìm thấy</div>'; _rptComboIdx[key] = -1; return; }
  var allOn = items.every(function(v){ return sel.has(v); });
  var html = items.length > 1
    ? '<div class="cs-combo-opt rpt-all" style="border-bottom:1px solid var(--border);font-weight:600" onmousedown="rptComboAll(\''+key+'\', event)"><span>'+(allOn?'☑':'☐')+' (Chọn tất cả'+(q?' kết quả tìm':'')+')</span></div>'
    : '';
  html += items.map(function(v){
    var on = sel.has(v);
    return '<div class="cs-combo-opt '+(on?'is-sel':'')+'" data-v="'+esc(v)+'" onmousedown="rptComboToggleItem(\''+key+'\', event, this.getAttribute(\'data-v\'))"><span>'+(on?'☑':'☐')+' '+esc(v)+'</span></div>';
  }).join('');
  list.innerHTML = html;
  _rptComboIdx[key] = -1;
}
function _rptComboSync_(key){
  var cfg = _RPT_COMBO_CFG[key], sel = [..._rptFilters[key]];
  var wrap = document.getElementById(cfg.id+'-chips');
  if (wrap) wrap.innerHTML = sel.map(function(n){ return _rptChipHtml_(key, n); }).join('');
  var lbl = document.getElementById(cfg.id+'-label-count'); if (lbl) lbl.textContent = sel.length ? ' ('+sel.length+' đã chọn)' : '';
  var clr = document.getElementById(cfg.id+'-clear'); if (clr) clr.style.display = sel.length ? '' : 'none';
  var l = document.getElementById(cfg.id+'-list');
  if (l && l.classList.contains('open')){ var ci = document.getElementById(cfg.id+'-input'); rptComboRender(key, ci ? ci.value : ''); }
  clearTimeout(_rptComboT);
  _rptComboT = setTimeout(function(){ if (document.getElementById('rpt-filterbar')) renderAssignReport(true); }, 250);   // chi ve lai neu thanh loc con tren man hinh (tranh de len tab khac neu CS vua chuyen tab/dong modal)
}
function rptComboOpen(key){
  Object.keys(_RPT_COMBO_CFG).forEach(function(k){ if (k !== key) rptComboClose(k); });
  var cfg = _RPT_COMBO_CFG[key], ci = document.getElementById(cfg.id+'-input');
  rptComboRender(key, ci ? ci.value : '');
  var l = document.getElementById(cfg.id+'-list'); if (l) l.classList.add('open');
}
function rptComboClose(key){ var l = document.getElementById(_RPT_COMBO_CFG[key].id+'-list'); if (l) l.classList.remove('open'); }
function rptComboToggle(key, e){
  if (e) e.stopPropagation();
  var cfg = _RPT_COMBO_CFG[key], l = document.getElementById(cfg.id+'-list'); if (!l) return;
  if (l.classList.contains('open')) rptComboClose(key);
  else { var ci = document.getElementById(cfg.id+'-input'); if (ci) ci.focus(); rptComboOpen(key); }
}
function rptComboFilter(key, v){ rptComboRender(key, v); var l = document.getElementById(_RPT_COMBO_CFG[key].id+'-list'); if (l) l.classList.add('open'); }
function rptComboToggleItem(key, e, value){
  if (e && e.preventDefault) e.preventDefault();   // giu focus o o go tim
  var s = _rptFilters[key];
  if (s.has(value)) s.delete(value); else s.add(value);
  _rptComboSync_(key);
}
function rptComboAll(key, e){
  if (e && e.preventDefault) e.preventDefault();
  var ci = document.getElementById(_RPT_COMBO_CFG[key].id+'-input'), q = _foldVi(ci ? ci.value : '');
  var items = _rptComboItems_(key).filter(function(v){ return !q || _foldVi(String(v)).indexOf(q) !== -1; });
  var s = _rptFilters[key], allOn = items.every(function(v){ return s.has(v); });
  items.forEach(function(v){ if (allOn) s.delete(v); else s.add(v); });
  _rptComboSync_(key);
}
function rptComboRemove(key, value){ _rptFilters[key].delete(value); _rptComboSync_(key); }
function rptComboClear(key, e){
  if (e) e.stopPropagation();
  _rptFilters[key] = new Set();
  var ci = document.getElementById(_RPT_COMBO_CFG[key].id+'-input'); if (ci) ci.value = '';
  _rptComboSync_(key);
}
function rptComboKey(key, e){
  var cfg = _RPT_COMBO_CFG[key], list = document.getElementById(cfg.id+'-list');
  if (!list || !list.classList.contains('open')){ if (e.key === 'ArrowDown') rptComboOpen(key); return; }
  var opts = [...list.querySelectorAll('.cs-combo-opt[data-v]')];
  if (e.key === 'Escape'){ rptComboClose(key); return; }
  if (!opts.length) return;
  var i = _rptComboIdx[key]; if (i == null) i = -1;
  if (e.key === 'ArrowDown'){ e.preventDefault(); i = Math.min(i+1, opts.length-1); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); i = Math.max(i-1, 0); }
  else if (e.key === 'Enter'){
    e.preventDefault();
    var pick = (i >= 0 && opts[i]) ? opts[i] : (opts.length === 1 ? opts[0] : null);
    if (pick) rptComboToggleItem(key, e, pick.getAttribute('data-v'));
    return;
  } else return;
  _rptComboIdx[key] = i;
  opts.forEach(function(o, j){ o.classList.toggle('active', j === i); });
  if (opts[i]) opts[i].scrollIntoView({block:'nearest'});
}
document.addEventListener('click', function(e){
  Object.keys(_RPT_COMBO_CFG).forEach(function(k){
    var c = document.getElementById(_RPT_COMBO_CFG[k].id);
    if (c && !c.contains(e.target)) rptComboClose(k);
  });
});
function _rptApplyQuickRange(key){
  _rptFilters.dateQuick = key;
  if (key !== 'custom'){
    const r = _pkQuickRange(key);
    if (r){ _rptFilters.dateFrom = r.from; _rptFilters.dateTo = r.to; }
  }
  renderAssignReport();
}
// Ô nhập tự do (Sản phẩm, Nick Zalo) — debounce để khỏi render lại (mất focus) mỗi phím gõ
let _rptDebounceT = null;
function _rptFilterInputChanged(key, val, isCsv) {
  _rptFilters[key] = isCsv ? new Set((val||'').split(',').map(t=>t.trim()).filter(Boolean)) : (val||'');
  clearTimeout(_rptDebounceT);
  _rptDebounceT = setTimeout(renderAssignReport, 450);
}
function _rptResetFilters() {
  _rptFilters = { cs: new Set(), tier: new Set(), label: new Set(), dateFrom: '', dateTo: '', dateQuick: 'custom',
    product: new Set(), careStatus: new Set(), khStatus: new Set(), zaloStatus: new Set(), source: new Set(), nickZalo: '' };
  renderAssignReport();
}

function exportAssignReport() {
  const rows = [['CS', 'Lần chia', 'Tổng KH', 'Đã xong', 'Tỷ lệ %']];
  const csMap = {};
  for (const h of assignHistory) {
    if (!csMap[h.csName]) csMap[h.csName] = {total:0, done:0, batches:0};
    csMap[h.csName].total += h.phones.length;
    csMap[h.csName].done += (h.donePhones||[]).length;
    csMap[h.csName].batches++;
  }
  for (const [cs, d] of Object.entries(csMap)) {
    rows.push([cs, d.batches, d.total, d.done, d.total>0?Math.round(d.done/d.total*100):0]);
  }
  // Detail sheet
  const detail = [['Ngày chia', 'CS', 'Label', 'Tên KH', 'SĐT', 'Phân loại', FIELD_LABEL_CS, 'Đã xong']];
  for (const h of assignHistory) {
    for (const p of h.phones) {
      const c = allCustomers.find(x=>x.phone===p);
      const isDone = (h.donePhones||[]).includes(p);
      detail.push([h.date, h.csName, h.label, c?c.name:p, p, c?c.tier:'', c?c.careStatus:'', isDone?'Xong':'Chưa']);
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Tổng hợp CS');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detail), 'Chi tiết');
  XLSX.writeFile(wb, `BaoCao_ChiaData_${_ymd(new Date())}.xlsx`);
}

function exportMyDataReport() {
  const csName = document.getElementById('mydata-cs-sel')?.value || '';
  const myBatches = assignHistory.filter(h => h.csName === csName);
  const allPhones = [...new Set(myBatches.flatMap(h=>h.phones))];
  const rows = [['Tên KH','SĐT','Phân loại',FIELD_LABEL_CS,'Zalo','Đã chăm xong','Batch']];
  for (const p of allPhones) {
    const c = allCustomers.find(x=>x.phone===p);
    const isDone = myBatches.some(h=>(h.donePhones||[]).includes(p));
    const batchLabel = myBatches.filter(h=>h.phones.includes(p)).map(h=>h.label).join('; ');
    rows.push([c?c.name:p, p, c?c.tier:'', c?c.careStatus:'', c?c.zaloStatus:'', isDone?'Xong':'Chưa', batchLabel]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Data của ' + (csName||'CS'));
  XLSX.writeFile(wb, `Data_${csName||'CS'}_${_ymd(new Date())}.xlsx`);
}

// ── MY DATA TAB ──
function renderMyDataTab() {
  const csName = document.getElementById('mydata-cs-sel')?.value || '';
  const batchId = document.getElementById('mydata-batch-sel')?.value || '';
  const noAction = document.getElementById('mydata-no-action')?.checked || false;
  const body = document.getElementById('mydata-body');
  if (!csName) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--hint)">Chọn tên CS của bạn để xem data được chia</div>';
    return;
  }
  const myBatches = assignHistory.filter(h => h.csName === csName);
  if (myBatches.length === 0) {
    body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--hint)">Chưa có data nào được chia cho <strong>${esc(csName)}</strong></div>`;
    return;
  }

  // Populate batch selector
  const batchSel = document.getElementById('mydata-batch-sel');
  if (batchSel) {
    const curBatch = batchSel.value;
    batchSel.innerHTML = '<option value="">Tất cả chiến dịch</option>' +
      myBatches.map(h => `<option value="${esc(h.id)}" ${h.id === curBatch ? 'selected' : ''}>📋 ${esc(h.label || h.date.slice(0,10))} · ${h.phones.length} KH</option>`).join('');
  }

  // Filter batches by selected batchId
  const activeBatches = batchId ? myBatches.filter(h => h.id === batchId) : myBatches;

  // Gather phones from active batches
  const phoneMap = {}; // phone -> {batches, isDone, batchIds}
  for (const h of activeBatches) {
    for (const p of h.phones) {
      if (!phoneMap[p]) phoneMap[p] = {batches:[], batchIds:[], isDone:false};
      phoneMap[p].batches.push(h.label || h.date.slice(0,10));
      phoneMap[p].batchIds.push(h.id);
      if ((h.donePhones||[]).includes(p)) phoneMap[p].isDone = true;
    }
  }
  const phones = Object.keys(phoneMap);
  const doneCount = phones.filter(p => phoneMap[p].isDone).length;
  const activePhones = phones.filter(p => !phoneMap[p].isDone);
  const noActPhones = phones.filter(p => {
    const c = allCustomers.find(x => x.phone === p);
    return !c || !c._lastActionDate;
  });

  // Status filter
  let displayPhones = _myDataFilter === 'done' ? phones.filter(p=>phoneMap[p].isDone)
    : _myDataFilter === 'active' ? activePhones : phones;

  // No-action filter
  if (noAction) {
    displayPhones = displayPhones.filter(p => {
      const c = allCustomers.find(x => x.phone === p);
      return !c || !c._lastActionDate;
    });
  }

  const today = _ymd(new Date());

  let html = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div class="assign-report-box" style="flex:1;min-width:80px"><div class="assign-report-n">${phones.length}</div><div class="assign-report-l">Tổng được chia</div></div>
      <div class="assign-report-box" style="flex:1;min-width:80px"><div class="assign-report-n" style="color:var(--green)">${doneCount}</div><div class="assign-report-l">Đã chăm xong</div></div>
      <div class="assign-report-box" style="flex:1;min-width:80px"><div class="assign-report-n" style="color:var(--tn)">${phones.length-doneCount}</div><div class="assign-report-l">Còn lại</div></div>
      <div class="assign-report-box" style="flex:1;min-width:80px"><div class="assign-report-n" style="color:var(--red)">${noActPhones.length}</div><div class="assign-report-l">Chưa tác động</div></div>
    </div>
    <div class="my-data-filter" style="flex-wrap:wrap;gap:4px">
      <div class="my-data-tab ${_myDataFilter==='active'?'active':''}" onclick="_myDataFilter='active';renderMyDataTab()">Chưa xong (${activePhones.length})</div>
      <div class="my-data-tab ${_myDataFilter==='done'?'active':''}" onclick="_myDataFilter='done';renderMyDataTab()">Đã xong (${doneCount})</div>
      <div class="my-data-tab ${_myDataFilter==='all'?'active':''}" onclick="_myDataFilter='all';renderMyDataTab()">Tất cả (${phones.length})</div>
    </div>`;

  if (displayPhones.length === 0) {
    html += '<div style="padding:20px;text-align:center;color:var(--hint);font-size:12px">Không có KH nào</div>';
  } else {
    html += displayPhones.map(p => {
      const c = allCustomers.find(x => x.phone === p);
      const isDone = phoneMap[p].isDone;
      const batchLabels = [...new Set(phoneMap[p].batches)].join(', ');
      // Last action display
      let lastActHtml = '';
      if (c && c._lastActionDate && c._lastActionDate > 1) {
        const daysAgo = _calendarDaysAgo(c._lastActionDate);
        const color = daysAgo <= 3 ? 'var(--green)' : daysAgo <= 14 ? 'var(--tn)' : 'var(--hint)';
        const label = daysAgo === 0 ? 'Hôm nay' : daysAgo === 1 ? 'Hôm qua' : `${daysAgo} ngày trước`;
        lastActHtml = `<span style="font-size:10px;color:${color}">⚡ ${label}</span>`;
      } else {
        lastActHtml = `<span style="font-size:10px;color:var(--red);font-weight:500">⚡ Chưa tác động</span>`;
      }
      const ns = nextSched ? nextSched(p) : null;
      const schedHtml = ns ? `<span style="font-size:10px;color:${isOverdue(ns)?'var(--red)':'#2563eb'}">📅 ${schedTypeLabel(ns.type)} · ${fmtDate(ns.date)}</span>` : '';
      return `<div class="my-data-row" style="flex-wrap:wrap;gap:4px">
        <input type="checkbox" class="my-data-check" ${isDone?'checked':''} data-cs="${esc(csName)}" onchange="toggleMyDataDone('${p}',this.dataset.cs,this.checked)">
        <div style="flex:1;min-width:0" class="${isDone?'my-data-done':''}">
          <div style="font-weight:500;display:flex;align-items:center;gap:6px">${c ? esc(c.name) : p}${lastActHtml}</div>
          <div style="font-size:11px;color:var(--muted)">${p} · ${c?c.tier:''} · ${c?careBadgeText(c.careStatus):''}</div>
          <div style="font-size:10px;color:var(--hint);display:flex;gap:8px;flex-wrap:wrap">${esc(batchLabels)}${schedHtml?'&nbsp;·&nbsp;'+schedHtml:''}</div>
        </div>
        <button class="btn sm" onclick="openDp('${p}')" style="flex-shrink:0">Chi tiết</button>
      </div>`;
    }).join('');
  }

  body.innerHTML = html;
}

function careBadgeText(st) {
  if (!st) return 'Chưa CS';
  return careStatusFullLabel(st) || st;
}

function toggleMyDataDone(phone, csName, isDone) {
  // Update in all batches for this CS
  for (const h of assignHistory) {
    if (h.csName !== csName || !h.phones.includes(phone)) continue;
    if (!h.donePhones) h.donePhones = [];
    if (isDone && !h.donePhones.includes(phone)) {
      h.donePhones.push(phone);
    } else if (!isDone) {
      h.donePhones = h.donePhones.filter(p => p !== phone);
    }
  }
  saveLS('ome_assign_hist', assignHistory);
  if (gsUrl) pushAssignHistToGS();
  updateMyDataBadge();
  renderMyDataTab();
}

function updateMyDataBadge() {
  // Count total undone across all batches
  const allActive = new Set();
  for (const h of assignHistory) {
    const _doneSet = new Set(h.donePhones || []);   // Set thay vi includes() trong vong lap (O(N^2))
    for (const p of h.phones) {
      if (!_doneSet.has(p)) allActive.add(p);
    }
  }
  txt('tb-mydata', fmt(allActive.size));
  // Also populate CS selector
  const sel = document.getElementById('mydata-cs-sel');
  if (sel) {
    const allCS = [...new Set(assignHistory.map(h=>h.csName))].sort();
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- Chọn tên CS --</option>' + allCS.map(cs=>`<option value="${esc(cs)}" ${cs===cur?'selected':''}>${esc(cs)}</option>`).join('');
  }
  // Refresh campaign filter dropdown in list tab
  if (typeof updateCampaignFilter === 'function') updateCampaignFilter();
}

// ── GS PUSH/PULL cho chiến dịch (AssignData) — có kiểm tra & cảnh báo backend cũ ──
let _assignBackendOK = true;     // backend (Apps Script) có hỗ trợ lưu chiến dịch không
let _assignWarnShown = false;

// ── DEPLOY GUIDE BANNER (hiện khi GAS chưa hỗ trợ AssignData) ──
function showDeployGuideBanner() {
  if (document.getElementById('deploy-guide-banner')) return;
  const wrap = document.getElementById('data-view') || document.body;
  const el = document.createElement('div');
  el.id = 'deploy-guide-banner';
  el.style.cssText = 'position:fixed;bottom:16px;right:16px;width:360px;background:#fff;border:1.5px solid #f97316;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,0.15);z-index:9999;font-size:12px;overflow:hidden;';
  el.innerHTML = `
    <div style="background:#fff7ed;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #fed7aa;">
      <span style="font-weight:700;color:#c2410c;font-size:13px;">⚠️ Chiến dịch chưa lưu được lên Google Sheets</span>
      <button onclick="document.getElementById('deploy-guide-banner').remove()" style="background:none;border:none;font-size:16px;color:#9a3412;cursor:pointer;line-height:1">✕</button>
    </div>
    <div style="padding:12px 14px;color:#44403c;line-height:1.7;">
      <p style="margin-bottom:8px">Apps Script đang dùng <strong>bản cũ</strong> — chưa có sheet <code style="background:#f5f5f4;padding:1px 4px;border-radius:3px">AssignData</code>. Nhân viên khác chưa thấy chiến dịch bạn vừa chia.</p>
      <p style="font-weight:600;color:#c2410c;margin-bottom:6px">Cách fix — chỉ mất 2 phút:</p>
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span style="background:#f97316;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">1</span>
          <span>Bấm <strong>"📋 Copy Apps Script"</strong> bên dưới</span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span style="background:#f97316;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">2</span>
          <span>Mở Google Sheet → <strong>Extensions → Apps Script</strong> → Xóa hết code cũ → Dán code mới vào</span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span style="background:#f97316;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">3</span>
          <span>Bấm <strong>Deploy → New deployment</strong> (Type: <em>Web app</em>, Access: <em>Anyone</em>) → Chọn URL mới dán vào app</span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span style="background:#22c55e;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px">4</span>
          <span>Bấm <strong>"Kiểm tra kết nối"</strong> → nếu thành công, chiến dịch sẽ tự đồng bộ ngay</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="copyGsCode();this.textContent='✓ Đã copy!';setTimeout(()=>this.textContent='📋 Copy Apps Script',2000)" style="flex:1;padding:6px 10px;background:#f97316;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">📋 Copy Apps Script</button>
        <button onclick="openGsModal()" style="flex:1;padding:6px 10px;background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600">🔗 Mở cài đặt GS</button>
      </div>
    </div>`;
  document.body.appendChild(el);
}

async function pushAssignToGS(entry) {
  // Giữ tương thích: ghi 1 entry (dùng khi cập nhật tiến độ donePhones)
  if (!gsUrl || !entry) return;
  try {
    const r = await fetch(gsUrl, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'saveAssign', entry })
    });
    _checkAssignResp(await r.text());
  } catch(e) { console.warn('GS assign push failed', e); }
}

// Ghi TOÀN BỘ lịch sử chia lên sheet AssignData (overwrite) → là "vết" bền vững trên trang tính.
// Gọi mỗi khi tạo/xoá chiến dịch để sheet luôn khớp với máy, không mất khi xoá localStorage.
async function pushAssignHistToGS() {
  if (!gsUrl) return;
  try {
    const r = await fetch(gsUrl, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({ action: 'saveAssignHistory', history: assignHistory })
    });
    _checkAssignResp(await r.text());
  } catch(e) { console.warn('GS assign hist push failed', e); }
}

function _checkAssignResp(txt) {
  let ok = false;
  try { const j = JSON.parse(txt); ok = !!(j && (j.ok || j.written !== undefined)); } catch(e) { ok = false; }
  if (ok) { _assignBackendOK = true; }
  else { _assignBackendOK = false; showAssignBackendWarning(); }
}

// Kéo chiến dịch từ sheet về (merge — chỉ BỔ SUNG, không bao giờ xoá entry đang có ở máy).
async function pullAssignHistory() {
  if (!gsUrl) return;
  try {
    const sep = gsUrl.includes('?') ? '&' : '?';
    // noOrders=1 để backend cũ (bỏ qua tham số action) không trả về toàn bộ đơn hàng
    const ar = await fetch(gsUrl + sep + 'action=assign&noOrders=1', { redirect: 'follow' });
    const ad = await ar.json();
    // Backend cũ không có khái niệm assignHistory → cảnh báo cần deploy lại bản mới
    if (!ad || typeof ad.assignHistory === 'undefined') {
      _assignBackendOK = false; showAssignBackendWarning(); return;
    }
    _assignBackendOK = true;
    if (ad.assignHistory.length > 0) {
      const localIds = new Set(assignHistory.map(h => h.id));
      let added = 0;
      for (const h of ad.assignHistory) {
        if (!localIds.has(h.id)) {
          // Normalize phones trong chiến dịch từ GS (có thể mất số 0 do Excel lưu kiểu số nguyên)
          if (h.phones) h.phones = h.phones.map(p => (typeof normPhone === 'function') ? (normPhone(p) || String(p)) : String(p));
          if (h.donePhones) h.donePhones = h.donePhones.map(p => (typeof normPhone === 'function') ? (normPhone(p) || String(p)) : String(p));
          assignHistory.push(h); localIds.add(h.id); added++;
        }
      }
      if (added > 0) {
        assignHistory.sort((a, b) => String(b.date).localeCompare(String(a.date)));
        saveLS('ome_assign_hist', assignHistory);
        if (typeof _invalidateFilterCache === 'function') _invalidateFilterCache();
        if (typeof _rebuildAssignIndex === 'function') _rebuildAssignIndex();
        if (typeof updateCampaignFilter === 'function') updateCampaignFilter();
        if (typeof updateMyDataBadge === 'function') updateMyDataBadge();
        // Làm mới danh sách KH ngay sau khi pull chiến dịch về
        if (typeof applyFilters === 'function') applyFilters();
      }
    }
  } catch(e) { console.warn('Pull assignHistory failed:', e.message); }
}

function showAssignBackendWarning() {
  if (_assignWarnShown) return;
  _assignWarnShown = true;
  if (typeof showDeployGuideBanner === 'function') showDeployGuideBanner();
}

// ── BROADCAST STATUS ──────────────────────────────────────────────
// Kéo toàn bộ chiến dịch "gửi hàng loạt" (Broadcasts sheet) về để biết
// từng KH đã được gửi tin thành công / lỗi / chưa gửi trong từng chiến dịch.
let broadcastHistory = []; // [{id,label,message,images,phones,sent:{phone:{status,ts}},csName,createdAt,status}]
let bcStatusFilterId = ''; // '' = tự động lấy chiến dịch bắn gần nhất có chứa KH đó

async function pullBroadcastHistory() {
  if (!gsUrl) return;
  try {
    const sep = gsUrl.includes('?') ? '&' : '?';
    const r = await fetch(gsUrl + sep + 'action=broadcastList', { redirect: 'follow' });
    const d = await r.json();
    if (!d || !Array.isArray(d.broadcasts)) return;
    broadcastHistory = d.broadcasts.map(b => {
      const sent = {};
      Object.keys(b.sent || {}).forEach(p => {
        const np = (typeof normPhone === 'function') ? (normPhone(p) || p) : p;
        sent[np] = b.sent[p];
      });
      return { ...b, phones: (b.phones||[]).map(p => (typeof normPhone === 'function') ? (normPhone(p) || String(p)) : String(p)), sent };
    });
    broadcastHistory.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (typeof updateBroadcastFilter === 'function') updateBroadcastFilter();
    if (typeof applyFilters === 'function') applyFilters();
  } catch(e) { console.warn('Pull broadcastHistory failed:', e.message); }
}

// Trạng thái gửi TN của 1 KH: ưu tiên chiến dịch đang chọn ở dropdown; nếu để "Tất cả"
// thì lấy chiến dịch bắn GẦN NHẤT (createdAt mới nhất) có chứa KH đó (dù đã gửi hay chưa).
function _bcStatusForPhone(phone) {
  if (!broadcastHistory.length) return null;
  const cands = bcStatusFilterId
    ? broadcastHistory.filter(b => b.id === bcStatusFilterId)
    : broadcastHistory;
  for (const b of cands) {
    if (!b.phones.includes(phone)) continue;
    const rec = b.sent[phone];
    return { campaign: b.label, status: rec ? (rec.status || 'sent') : 'pending', ts: rec ? rec.ts : null };
  }
  return null;
}

function _bcStatusBadge(phone) {
  const r = _bcStatusForPhone(phone);
  if (!r) return '<span style="color:var(--hint);font-size:11px">—</span>';
  const st = String(r.status || '');
  const tsStr = r.ts ? (' · ' + new Date(r.ts).toLocaleString('vi-VN')) : '';
  if (st === 'sent') return `<span class="badge" style="background:#dcfce7;color:#15803d;border-color:#86efac" title="${esc(r.campaign)}${tsStr}">✓ Đã gửi</span>`;
  if (st.startsWith('failed')) return `<span class="badge" style="background:#fef2f2;color:#dc2626;border-color:#fecaca" title="${esc(r.campaign)}${tsStr} — ${esc(st)}">✗ Gửi lỗi</span>`;
  if (st.startsWith('skip')) return `<span class="badge" style="background:#f3f4f6;color:#6b7280;border-color:#e5e7eb" title="${esc(r.campaign)}${tsStr} — ${esc(st)}">— Bỏ qua</span>`;
  return `<span class="badge" style="background:#fff7ed;color:#c2410c;border-color:#fed7aa" title="${esc(r.campaign)}">⏳ Chưa gửi</span>`;
}

// Dropdown chọn chiến dịch bắn để xem trạng thái (giống campaign-filter của Chia data)
function updateBroadcastFilter() {
  const sel = document.getElementById('bc-status-filter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Chiến dịch bắn gần nhất</option>' +
    broadcastHistory.map(b => `<option value="${esc(b.id)}">${esc(b.label)} (${b.phones.length} KH)</option>`).join('');
  sel.value = broadcastHistory.some(b => b.id === prev) ? prev : '';
  bcStatusFilterId = sel.value;
}


// Keep track of last filtered list for assign modal
let _lastFilteredList = [];

// Extend switchTab to handle mydata
const _origSwitchTab = switchTab;
switchTab = function(tab, el) {
  _origSwitchTab(tab, el);
  const mydata = document.getElementById('tab-mydata');
  if (mydata) mydata.style.display = tab === 'mydata' ? 'flex' : 'none';
  if (tab === 'mydata') { updateMyDataBadge(); renderMyDataTab(); }
}
